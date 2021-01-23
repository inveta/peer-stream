
var webRtcPlayerObj = null;
var print_inputs = false;
var connect_on_load = false;
const fillWindowButton = document.getElementById("enlarge-display-to-fill-window-tgl");
const statsDiv = document.getElementById("stats");

// 键盘是否阻止浏览器默认行为
window.preventDefault = true
var is_reconnection = false;
var ws;
const WS_OPEN_STATE = 1;

var qualityControlOwnershipCheckBox;
var matchViewportResolution;
// TODO: Remove this - workaround because of bug causing UE to crash when switching resolutions too quickly
var lastTimeResized = new Date().getTime();
var resizeTimeout;

var onDataChannelConnected;
var responseEventListeners = new Map();

var freezeFrameOverlay = null;
var shouldShowPlayOverlay = true;
// A freeze frame is a still JPEG image shown instead of the video.
var freezeFrame = {
	receiving: false,
	size: 0,
	jpeg: undefined,
	height: 0,
	width: 0,
	valid: false,
};

// Optionally detect if the user is not interacting (AFK) and disconnect them.
var afk = {
	enabled: false, // Set to true to enable the AFK system.
	warnTimeout: 120, // The time to elapse before warning the user they are inactive.
	closeTimeout: 10, // The time after the warning when we disconnect the user.

	active: false, // Whether the AFK system is currently looking for inactivity.
	overlay: undefined, // The UI overlay warning the user that they are inactive.
	warnTimer: undefined, // The timer which waits to show the inactivity warning overlay.
	countdown: 0, // The inactivity warning overlay has a countdown to show time until disconnect.
	countdownTimer: undefined, // The timer used to tick the seconds shown on the inactivity warning overlay.
};

// If the user focuses on a UE4 input widget then we show them a button to open
// the on-screen keyboard. JavaScript security means we can only show the
// on-screen keyboard in response to a user interaction.
var editTextButton = undefined;

// A hidden input text box which is used only for focusing and opening the
// on-screen keyboard.
var hiddenInput = undefined;

var t0 = Date.now();
function log(str) {
	console.log(`${Math.floor(Date.now() - t0)}: ` + str);
}

function setupHtmlEvents() {
	//Window events
	window.addEventListener("resize", resizePlayerStyle, true);
	window.addEventListener("orientationchange", resizePlayerStyle);
	fillWindowButton.addEventListener('change', resizePlayerStyle);

	//HTML elements controls
	let overlayButton = document.getElementById("overlayButton");
	overlayButton.addEventListener("click", onExpandOverlay_Click);




	qualityControlOwnershipCheckBox = document.getElementById(
		"quality-control-ownership-tgl"
	);
	if (qualityControlOwnershipCheckBox !== null) {
		qualityControlOwnershipCheckBox.onchange = function (event) {
			requestQualityControl();
		};
	}

	let prioritiseQualityCheckbox = document.getElementById(
		"prioritise-quality-tgl"
	);
	let qualityParamsSubmit = document.getElementById("quality-params-submit");

	if (prioritiseQualityCheckbox !== null) {
		prioritiseQualityCheckbox.onchange = function (event) {
			if (prioritiseQualityCheckbox.checked) {
				// TODO: This state should be read from the UE Application rather than from the initial values in the HTML
				let lowBitrate = document.getElementById("low-bitrate-text").value;
				let highBitrate = document.getElementById("high-bitrate-text").value;
				let minFPS = document.getElementById("min-fps-text").value;

				let initialDescriptor = {
					PrioritiseQuality: 1,
					LowBitrate: lowBitrate,
					HighBitrate: highBitrate,
					MinFPS: minFPS,
				};
				// TODO: The descriptor should be sent as is to a generic handler on the UE side
				// but for now we're just sending it as separate console commands
				//emitUIInteraction(initialDescriptor);
				sendQualityConsoleCommands(initialDescriptor);
				console.log(initialDescriptor);

				qualityParamsSubmit.onclick = function (event) {
					let lowBitrate = document.getElementById("low-bitrate-text").value;
					let highBitrate = document.getElementById("high-bitrate-text").value;
					let minFPS = document.getElementById("min-fps-text").value;
					let descriptor = {
						PrioritiseQuality: 1,
						LowBitrate: lowBitrate,
						HighBitrate: highBitrate,
						MinFPS: minFPS,
					};
					//emitUIInteraction(descriptor);
					sendQualityConsoleCommands(descriptor);
					console.log(descriptor);
				};
			} else {
				// Prioritise Quality unchecked
				let initialDescriptor = {
					PrioritiseQuality: 0,
				};
				//emitUIInteraction(initialDescriptor);
				sendQualityConsoleCommands(initialDescriptor);
				console.log(initialDescriptor);

				qualityParamsSubmit.onclick = null;
			}
		};
	}

	let showFPSButton = document.getElementById("show-fps-button");
	if (showFPSButton !== null) {
		showFPSButton.onclick = function (event) {
			let consoleDescriptor = {
				Console: "stat fps",
			};
			emitUIInteraction(consoleDescriptor);
		};
	}

	let matchViewportResolutionCheckBox = document.getElementById(
		"match-viewport-res-tgl"
	);
	if (matchViewportResolutionCheckBox !== null) {
		matchViewportResolutionCheckBox.onchange = function (event) {
			matchViewportResolution = matchViewportResolutionCheckBox.checked;
		};
	}

	document.getElementById("show-stats-tgl").onchange = function (event) {
		let stats = document.getElementById("statsContainer");
		stats.style.display = event.target.checked ? "block" : "none";
	};


	var kickButton = document.getElementById("kick-other-players-button");
	if (kickButton) {
		kickButton.onclick = function (event) {
			console.log(`-> SS: kick`);
			ws.send(JSON.stringify({ type: "kick" }));
		};
	}
}

function sendQualityConsoleCommands(descriptor) {
	if (descriptor.PrioritiseQuality !== null) {
		let command = "Streamer.PrioritiseQuality " + descriptor.PrioritiseQuality;
		let consoleDescriptor = {
			Console: command,
		};
		emitUIInteraction(consoleDescriptor);
	}

	if (descriptor.LowBitrate !== null) {
		let command = "Streamer.LowBitrate " + descriptor.LowBitrate;
		let consoleDescriptor = {
			Console: command,
		};
		emitUIInteraction(consoleDescriptor);
	}

	if (descriptor.HighBitrate !== null) {
		let command = "Streamer.HighBitrate " + descriptor.HighBitrate;
		let consoleDescriptor = {
			Console: command,
		};
		emitUIInteraction(consoleDescriptor);
	}

	if (descriptor.MinFPS !== null) {
		var command = "Streamer.MinFPS " + descriptor.MinFPS;
		let consoleDescriptor = {
			Console: command,
		};
		emitUIInteraction(consoleDescriptor);
	}
}

function setOverlay(htmlClass, htmlElement, onClickFunction) {
	var videoPlayOverlay = document.getElementById("videoPlayOverlay");
	if (!videoPlayOverlay) {
		var playerDiv = document.getElementById("player");
		videoPlayOverlay = document.createElement("div");
		videoPlayOverlay.id = "videoPlayOverlay";
		playerDiv.appendChild(videoPlayOverlay);
	}

	// Remove existing html child elements so we can add the new one
	while (videoPlayOverlay.lastChild) {
		videoPlayOverlay.removeChild(videoPlayOverlay.lastChild);
	}

	if (htmlElement) videoPlayOverlay.appendChild(htmlElement);

	if (onClickFunction) {
		videoPlayOverlay.addEventListener("click", function onOverlayClick(event) {
			onClickFunction(event);
			videoPlayOverlay.removeEventListener("click", onOverlayClick);
		});
	}

	// Remove existing html classes so we can set the new one
	var cl = videoPlayOverlay.classList;
	for (var i = cl.length - 1; i >= 0; i--) {
		cl.remove(cl[i]);
	}

	videoPlayOverlay.classList.add(htmlClass);
}

function showConnectOverlay() {
	var startText = document.createElement("div");
	startText.id = "playButton";
	startText.innerHTML = "Click to start";

	setOverlay("clickableState", startText, (event) => {
		connect();
		startAfkWarningTimer();
	});
}

function showTextOverlay(text) {
	var textOverlay = document.createElement("div");
	textOverlay.id = "messageOverlay";
	textOverlay.innerHTML = text ? text : "";
	setOverlay("textDisplayState", textOverlay);
}

function showPlayOverlay() {
	var img = document.createElement("img");
	img.id = "playButton";
	img.src = "/images/Play.png";
	img.alt = "Start Streaming";
	setOverlay("clickableState", img, (event) => {
		if (webRtcPlayerObj) webRtcPlayerObj.video.play();

		requestQualityControl();

		showFreezeFrameOverlay();
		hideOverlay();
	});
	shouldShowPlayOverlay = false;
}

function updateAfkOverlayText() {
	afk.overlay.innerHTML =
		"<center>No activity detected<br>Disconnecting in " +
		afk.countdown +
		" seconds<br>Click to continue<br></center>";
}

function showAfkOverlay() {
	// Pause the timer while the user is looking at the inactivity warning overlay.
	stopAfkWarningTimer();

	// Show the inactivity warning overlay.
	afk.overlay = document.createElement("div");
	afk.overlay.id = "afkOverlay";
	setOverlay("clickableState", afk.overlay, (event) => {
		// The user clicked so start the timer again and carry on.
		hideOverlay();
		clearInterval(afk.countdownTimer);
		startAfkWarningTimer();
	});

	afk.countdown = afk.closeTimeout;
	updateAfkOverlayText();

	if (inputOptions.controlScheme == ControlSchemeType.LockedMouse) {
		document.exitPointerLock();
	}

	afk.countdownTimer = setInterval(function () {
		afk.countdown--;
		if (afk.countdown == 0) {
			// The user failed to click so disconnect them.
			hideOverlay();
			ws.close();
		} else {
			// Update the countdown message.
			updateAfkOverlayText();
		}
	}, 1000);
}

function hideOverlay() {
	setOverlay("hiddenState");
}

// Start a timer which when elapsed will warn the user they are inactive.
function startAfkWarningTimer() {
	afk.active = afk.enabled;
	resetAfkWarningTimer();
}

// Stop the timer which when elapsed will warn the user they are inactive.
function stopAfkWarningTimer() {
	afk.active = false;
}

// If the user interacts then reset the warning timer.
function resetAfkWarningTimer() {
	if (afk.active) {
		clearTimeout(afk.warnTimer);
		afk.warnTimer = setTimeout(function () {
			showAfkOverlay();
		}, afk.warnTimeout * 1000);
	}
}

function createWebRtcOffer() {
	if (webRtcPlayerObj) {
		console.log("Creating offer");
		showTextOverlay("Starting connection to server, please wait");
		webRtcPlayerObj.createOffer();
	} else {
		console.log("WebRTC player not setup, cannot create offer");
		showTextOverlay("Unable to setup video");
	}
}

function sendInputData(data) {
	if (webRtcPlayerObj) {
		resetAfkWarningTimer();
		webRtcPlayerObj.send(data);
	}
}

function addResponseEventListener(name, listener) {
	responseEventListeners.set(name, listener);
}

function removeResponseEventListener(name) {
	responseEventListeners.remove(name);
}

// Must be kept in sync with PixelStreamingProtocol::EToClientMsg C++ enum.
const ToClientMessageType = {
	QualityControlOwnership: 0,
	Response: 1,
	Command: 2,
	FreezeFrame: 3,
	UnfreezeFrame: 4,
	VideoEncoderAvgQP: 5,
};

var VideoEncoderQP = "N/A";

function setupWebRtcPlayer(htmlElement, config) {
	webRtcPlayerObj = new window.webRtcPlayer({
		peerConnectionOptions: config.peerConnectionOptions,
	});
	htmlElement.appendChild(webRtcPlayerObj.video);
	htmlElement.appendChild(freezeFrameOverlay);


	webRtcPlayerObj.onWebRtcOffer = function (offer) {
		if (ws && ws.readyState === WS_OPEN_STATE) {
			let offerStr = JSON.stringify(offer);
			console.log(`-> SS: offer:\n${offerStr}`);
			ws.send(offerStr);
		}
	};

	webRtcPlayerObj.onWebRtcCandidate = function (candidate) {
		if (ws && ws.readyState === WS_OPEN_STATE) {
			console.log(
				`-> SS: iceCandidate\n${JSON.stringify(candidate, undefined, 4)}`
			);
			ws.send(JSON.stringify({ type: "iceCandidate", candidate: candidate }));
		}
	};

	webRtcPlayerObj.onDataChannelConnected = function () {
		if (ws && ws.readyState === WS_OPEN_STATE) {
			showTextOverlay("WebRTC connected, waiting for video");
		}
	};

	function showFreezeFrame() {
		let base64 = btoa(
			freezeFrame.jpeg.reduce(
				(data, byte) => data + String.fromCharCode(byte),
				""
			)
		);
		freezeFrameOverlay.src = "data:image/jpeg;base64," + base64;
		freezeFrameOverlay.onload = function () {
			freezeFrame.height = freezeFrameOverlay.naturalHeight;
			freezeFrame.width = freezeFrameOverlay.naturalWidth;
			resizeFreezeFrameOverlay();
			if (shouldShowPlayOverlay) {
				showPlayOverlay();
				resizePlayerStyle();
			} else {
				showFreezeFrameOverlay();
			}
		};
	}

	webRtcPlayerObj.onDataChannelMessage = function (data) {
		var view = new Uint8Array(data);
		if (freezeFrame.receiving) {
			let jpeg = new Uint8Array(freezeFrame.jpeg.length + view.length);
			jpeg.set(freezeFrame.jpeg, 0);
			jpeg.set(view, freezeFrame.jpeg.length);
			freezeFrame.jpeg = jpeg;
			if (freezeFrame.jpeg.length === freezeFrame.size) {
				freezeFrame.receiving = false;
				freezeFrame.valid = true;
				console.log(`received complete freeze frame ${freezeFrame.size}`);
				showFreezeFrame();
			} else if (freezeFrame.jpeg.length > freezeFrame.size) {
				console.error(
					`received bigger freeze frame than advertised: ${freezeFrame.jpeg.length}/${freezeFrame.size}`
				);
				freezeFrame.jpeg = undefined;
				freezeFrame.receiving = false;
			} else {
				console.log(
					`received next chunk (${view.length} bytes) of freeze frame: ${freezeFrame.jpeg.length}/${freezeFrame.size}`
				);
			}
		} else if (view[0] === ToClientMessageType.QualityControlOwnership) {
			let ownership = view[1] === 0 ? false : true;
			// If we own the quality control, we can't relenquish it. We only loose
			// quality control when another peer asks for it
			if (qualityControlOwnershipCheckBox !== null) {
				qualityControlOwnershipCheckBox.disabled = ownership;
				qualityControlOwnershipCheckBox.checked = ownership;
			}
		} else if (view[0] === ToClientMessageType.Response) {
			let response = new TextDecoder("utf-16").decode(data.slice(1));
			for (let listener of responseEventListeners.values()) {
				listener(response);
			}
		} else if (view[0] === ToClientMessageType.Command) {
			let commandAsString = new TextDecoder("utf-16").decode(data.slice(1));
			console.log(commandAsString);
			let command = JSON.parse(commandAsString);
			if (command.command === "onScreenKeyboard") {
				showOnScreenKeyboard(command);
			}
		} else if (view[0] === ToClientMessageType.FreezeFrame) {
			freezeFrame.size = new DataView(view.slice(1, 5).buffer).getInt32(
				0,
				true
			);
			freezeFrame.jpeg = view.slice(1 + 4);
			if (freezeFrame.jpeg.length < freezeFrame.size) {
				console.log(
					`received first chunk of freeze frame: ${freezeFrame.jpeg.length}/${freezeFrame.size}`
				);
				freezeFrame.receiving = true;
			} else {
				console.log(
					`received complete freeze frame: ${freezeFrame.jpeg.length}/${freezeFrame.size}`
				);
				showFreezeFrame();
			}
		} else if (view[0] === ToClientMessageType.UnfreezeFrame) {
			invalidateFreezeFrameOverlay();
		} else if (view[0] === ToClientMessageType.VideoEncoderAvgQP) {
			VideoEncoderQP = new TextDecoder("utf-16").decode(data.slice(1));
			console.log(`received VideoEncoderAvgQP ${VideoEncoderQP}`);
		} else {
			console.error(`unrecognized data received, packet ID ${view[0]}`);
		}
	};

	registerInputs(webRtcPlayerObj.video);

	// On a touch device we will need special ways to show the on-screen keyboard.
	if ("ontouchstart" in document.documentElement) {
		createOnScreenKeyboardHelpers(htmlElement);
	}

	createWebRtcOffer();

	if (ws && ws.readyState === WS_OPEN_STATE) {
		if (shouldShowPlayOverlay) {
			showPlayOverlay();
			resizePlayerStyle();
		}
	}




	webRtcPlayerObj.pcClient.addEventListener('track', e => {

	})

	return webRtcPlayerObj.video;
}

function onAggregatedStats(reducedStat) {
	let numberFormat = new Intl.NumberFormat(window.navigator.language, {
		maximumFractionDigits: 0,
	});

	receivedBytesMeasurement = "B";
	receivedBytes = reducedStat.bytesReceived || 0;
	let dataMeasurements = ["KB", "MB", "GB"];
	dataMeasurements.find(dataMeasurement => {
		if (receivedBytes < 100 * 1000) return true;
		receivedBytes /= 1000;
		receivedBytesMeasurement = dataMeasurement;
	})


	let qualityStatus = document.getElementById("qualityStatus");

	// "blinks" quality status element for 1 sec by making it transparent, speed = number of blinks
	let blinkQualityStatus = function (speed) {
		let iter = speed;
		let opacity = 1; // [0..1]
		let tickId = setInterval(
			function () {
				opacity -= 0.1;
				// map `opacity` to [-0.5..0.5] range, decrement by 0.2 per step and take `abs` to make it blink: 1 -> 0 -> 1
				qualityStatus.style = `opacity: ${Math.abs((opacity - 0.5) * 2)}`;
				if (opacity <= 0.1) {
					if (--iter == 0) {
						clearInterval(tickId);
					} else {
						// next blink
						opacity = 1;
					}
				}
			},
			100 / speed // msecs
		);
	};

	const orangeQP = 26;
	const redQP = 35;

	let statsText = "";

	let color = "lime";
	if (VideoEncoderQP > redQP) {
		color = "red";
		blinkQualityStatus(2);
		statsText += `<div style="color: ${color}">Bad network connection</div>`;
	} else if (VideoEncoderQP > orangeQP) {
		color = "orange";
		blinkQualityStatus(1);
		statsText += `<div style="color: ${color}">Spotty network connection</div>`;
	}

	qualityStatus.className = `${color}Status`;

	const duration = new Date(performance.now() + (new Date()).getTimezoneOffset() * 60 * 1000).toTimeString().split(' ')[0]
	statsText += `
		<div>Duration: ${duration}</div>
		<div>Video Resolution: ${reducedStat.frameWidth + "x" + reducedStat.frameHeight}</div>
		<div>Received (${receivedBytesMeasurement}): ${numberFormat.format(receivedBytes)}</div>
		<div>Frames Decoded: ${numberFormat.format(reducedStat.framesDecoded)}</div>
		<div>Packets Lost: ${numberFormat.format(reducedStat.packetsLost)}</div>
		<div style="color: ${color}">Bitrate (kbps): ${numberFormat.format(reducedStat.bitrate)}</div>
		<div>FPS: ${numberFormat.format(reducedStat.framesPerSecond)}</div>
		<div>Frames dropped: ${numberFormat.format(reducedStat.framesDropped)}</div>
		<div>Latency (ms): ${numberFormat.format(reducedStat.currentRoundTripTime * 1000)}</div>
		<div style="color: ${color}">Video Quantization Parameter: ${VideoEncoderQP}</div>	`;

	statsDiv.innerHTML = statsText;
}

function onWebRtcAnswer(webRTCData) {
	webRtcPlayerObj.receiveAnswer(webRTCData);

	webRtcPlayerObj.aggregateStatsIntervalId = setInterval(async () => {
		const stat = await webRtcPlayerObj.fetchReduceStats();
		onAggregatedStats(stat);
	}, 1000);

}

function onWebRtcIce(iceCandidate) {
	if (webRtcPlayerObj) webRtcPlayerObj.handleCandidateFromServer(iceCandidate);
}

var styleWidth;
var styleHeight;
var styleCursor = "default";

const ControlSchemeType = {
	// A mouse can lock inside the WebRTC player so the user can simply move the
	// mouse to control the orientation of the camera. The user presses the
	// Escape key to unlock the mouse.
	LockedMouse: 0,

	// A mouse can hover over the WebRTC player so the user needs to click and
	// drag to control the orientation of the camera.
	HoveringMouse: 1,
};

var inputOptions = {
	// The control scheme controls the behaviour of the mouse when it interacts
	// with the WebRTC player.
	controlScheme: ControlSchemeType.LockedMouse,

	// UE4 has a faketouches option which fakes a single finger touch when the
	// user drags with their mouse. We may perform the reverse; a single finger
	// touch may be converted into a mouse drag UE4 side. This allows a
	// non-touch application to be controlled partially via a touch device.
	fakeMouseWithTouches: false,
};


function setupFreezeFrameOverlay() {
	freezeFrameOverlay = document.createElement("img");
	freezeFrameOverlay.id = "freezeFrameOverlay";
	freezeFrameOverlay.style.display = "none";
	freezeFrameOverlay.style.pointerEvents = "none";
	freezeFrameOverlay.style.position = "absolute";
	freezeFrameOverlay.style.zIndex = "30";
}
function showFreezeFrameOverlay() {
	if (freezeFrame.valid) {
		freezeFrameOverlay.style.display = "block";
	}
}
function invalidateFreezeFrameOverlay() {
	freezeFrameOverlay.style.display = "none";
	freezeFrame.valid = false;
}
function resizeFreezeFrameOverlay() {
	if (freezeFrame.width !== 0 && freezeFrame.height !== 0) {
		let displayWidth = 0;
		let displayHeight = 0;
		let displayTop = 0;
		let displayLeft = 0;

		if (fillWindowButton.checked) {
			let windowAspectRatio = window.innerWidth / window.innerHeight;
			let videoAspectRatio = freezeFrame.width / freezeFrame.height;
			if (windowAspectRatio < videoAspectRatio) {
				displayWidth = window.innerWidth;
				displayHeight = Math.floor(window.innerWidth / videoAspectRatio);
				displayTop = Math.floor((window.innerHeight - displayHeight) * 0.5);
				displayLeft = 0;
			} else {
				displayWidth = Math.floor(window.innerHeight * videoAspectRatio);
				displayHeight = window.innerHeight;
				displayTop = 0;
				displayLeft = Math.floor((window.innerWidth - displayWidth) * 0.5);
			}
		} else {
			displayWidth = freezeFrame.width;
			displayHeight = freezeFrame.height;
			displayTop = 0;
			displayLeft = 0;
		}
		freezeFrameOverlay.style.width = displayWidth + "px";
		freezeFrameOverlay.style.height = displayHeight + "px";
		freezeFrameOverlay.style.left = displayLeft + "px";
		freezeFrameOverlay.style.top = displayTop + "px";
	}
}

function resizePlayerStyle(event) {
	var playerElement = document.getElementById("player");

	if (!webRtcPlayerObj) return;

	updateVideoStreamSize();


	if (fillWindowButton.checked) {
		webRtcPlayerObj.video.classList.replace('actual-size', 'fit-size')
	} else {
		webRtcPlayerObj.video.classList.replace('fit-size', 'actual-size')
	}


	// Calculating and normalizing positions depends on the width and height of
	// the player.
	playerElementClientRect = playerElement.getBoundingClientRect();
	setupNormalizeAndQuantize();
	resizeFreezeFrameOverlay();
}

function updateVideoStreamSize() {
	if (!matchViewportResolution) {
		return;
	}

	var now = new Date().getTime();
	if (now - lastTimeResized > 1000) {
		var playerElement = document.getElementById("player");
		if (!playerElement) return;

		let descriptor = {
			Console:
				"setres " +
				playerElement.clientWidth +
				"x" +
				playerElement.clientHeight,
		};
		emitUIInteraction(descriptor);
		console.log(descriptor);
		lastTimeResized = new Date().getTime();
	} else {
		console.log("Resizing too often - skipping");
		clearTimeout(resizeTimeout);
		resizeTimeout = setTimeout(updateVideoStreamSize, 1000);
	}
}


// Must be kept in sync with PixelStreamingProtocol::EToUE4Msg C++ enum.
const MessageType = {
	/**********************************************************************/

	/*
	 * Control Messages. Range = 0..49.
	 */
	IFrameRequest: 0,
	RequestQualityControl: 1,
	MaxFpsRequest: 2,
	AverageBitrateRequest: 3,
	StartStreaming: 4,
	StopStreaming: 5,

	/**********************************************************************/

	/*
	 * Input Messages. Range = 50..89.
	 */

	// Generic Input Messages. Range = 50..59.
	UIInteraction: 50,
	Command: 51,

	// Keyboard Input Message. Range = 60..69.
	KeyDown: 60,
	KeyUp: 61,
	KeyPress: 62,

	// Mouse Input Messages. Range = 70..79.
	MouseEnter: 70,
	MouseLeave: 71,
	MouseDown: 72,
	MouseUp: 73,
	MouseMove: 74,
	MouseWheel: 75,

	// Touch Input Messages. Range = 80..89.
	TouchStart: 80,
	TouchEnd: 81,
	TouchMove: 82,

	/**************************************************************************/
};

// A generic message has a type and a descriptor.
function emitDescriptor(messageType, descriptor) {
	// Convert the dscriptor object into a JSON string.
	let descriptorAsString = JSON.stringify(descriptor);

	// Add the UTF-16 JSON string to the array byte buffer, going two bytes at
	// a time.
	let data = new DataView(
		new ArrayBuffer(1 + 2 + 2 * descriptorAsString.length)
	);
	let byteIdx = 0;
	data.setUint8(byteIdx, messageType);
	byteIdx++;
	data.setUint16(byteIdx, descriptorAsString.length, true);
	byteIdx += 2;
	for (i = 0; i < descriptorAsString.length; i++) {
		data.setUint16(byteIdx, descriptorAsString.charCodeAt(i), true);
		byteIdx += 2;
	}
	sendInputData(data.buffer);
}

// A UI interation will occur when the user presses a button powered by
// JavaScript as opposed to pressing a button which is part of the pixel
// streamed UI from the UE4 client.
function emitUIInteraction(descriptor) {
	emitDescriptor(MessageType.UIInteraction, descriptor);
}

// A build-in command can be sent to UE4 client. The commands are defined by a
// JSON descriptor and will be executed automatically.
// The currently supported commands are:
//
// 1. A command to run any console command:
//    "{ ConsoleCommand: <string> }"
//
// 2. A command to change the resolution to the given width and height.
//    "{ Resolution: { Width: <value>, Height: <value> } }"
//
// 3. A command to change the encoder settings by reducing the bitrate by the
//    given percentage.
//    "{ Encoder: { BitrateReduction: <value> } }"
function emitCommand(descriptor) {
	emitDescriptor(MessageType.Command, descriptor);
}

function requestQualityControl() {
	sendInputData(new Uint8Array([MessageType.RequestQualityControl]).buffer);
}

var playerElementClientRect = undefined;
var normalizeAndQuantizeUnsigned = undefined;
var normalizeAndQuantizeSigned = undefined;

function setupNormalizeAndQuantize() {
	let playerElement = document.getElementById("player");
	let videoElement = playerElement.getElementsByTagName("video");

	if (playerElement && videoElement.length > 0) {
		let playerAspectRatio =
			playerElement.clientHeight / playerElement.clientWidth;
		let videoAspectRatio =
			videoElement[0].videoHeight / videoElement[0].videoWidth;

		// Unsigned XY positions are the ratio (0.0..1.0) along a viewport axis,
		// quantized into an uint16 (0..65536).
		// Signed XY deltas are the ratio (-1.0..1.0) along a viewport axis,
		// quantized into an int16 (-32767..32767).
		// This allows the browser viewport and client viewport to have a different
		// size.
		// Hack: Currently we set an out-of-range position to an extreme (65535)
		// as we can't yet accurately detect mouse enter and leave events
		// precisely inside a video with an aspect ratio which causes mattes.
		if (playerAspectRatio > videoAspectRatio) {
			if (print_inputs) {
				console.log(
					"Setup Normalize and Quantize for playerAspectRatio > videoAspectRatio"
				);
			}
			let ratio = playerAspectRatio / videoAspectRatio;
			// Unsigned.
			normalizeAndQuantizeUnsigned = (x, y) => {
				let normalizedX = x / playerElement.clientWidth;
				let normalizedY = ratio * (y / playerElement.clientHeight - 0.5) + 0.5;
				if (
					normalizedX < 0.0 ||
					normalizedX > 1.0 ||
					normalizedY < 0.0 ||
					normalizedY > 1.0
				) {
					return {
						inRange: false,
						x: 65535,
						y: 65535,
					};
				} else {
					return {
						inRange: true,
						x: normalizedX * 65536,
						y: normalizedY * 65536,
					};
				}
			};
			unquantizeAndDenormalizeUnsigned = (x, y) => {
				let normalizedX = x / 65536;
				let normalizedY = (y / 65536 - 0.5) / ratio + 0.5;
				return {
					x: normalizedX * playerElement.clientWidth,
					y: normalizedY * playerElement.clientHeight,
				};
			};
			// Signed.
			normalizeAndQuantizeSigned = (x, y) => {
				let normalizedX = x / (0.5 * playerElement.clientWidth);
				let normalizedY = (ratio * y) / (0.5 * playerElement.clientHeight);
				return {
					x: normalizedX * 32767,
					y: normalizedY * 32767,
				};
			};
		} else {
			if (print_inputs) {
				console.log(
					"Setup Normalize and Quantize for playerAspectRatio <= videoAspectRatio"
				);
			}
			let ratio = videoAspectRatio / playerAspectRatio;
			// Unsigned.
			normalizeAndQuantizeUnsigned = (x, y) => {
				let normalizedX = ratio * (x / playerElement.clientWidth - 0.5) + 0.5;
				let normalizedY = y / playerElement.clientHeight;
				if (
					normalizedX < 0.0 ||
					normalizedX > 1.0 ||
					normalizedY < 0.0 ||
					normalizedY > 1.0
				) {
					return {
						inRange: false,
						x: 65535,
						y: 65535,
					};
				} else {
					return {
						inRange: true,
						x: normalizedX * 65536,
						y: normalizedY * 65536,
					};
				}
			};
			unquantizeAndDenormalizeUnsigned = (x, y) => {
				let normalizedX = (x / 65536 - 0.5) / ratio + 0.5;
				let normalizedY = y / 65536;
				return {
					x: normalizedX * playerElement.clientWidth,
					y: normalizedY * playerElement.clientHeight,
				};
			};
			// Signed.
			normalizeAndQuantizeSigned = (x, y) => {
				let normalizedX = (ratio * x) / (0.5 * playerElement.clientWidth);
				let normalizedY = y / (0.5 * playerElement.clientHeight);
				return {
					x: normalizedX * 32767,
					y: normalizedY * 32767,
				};
			};
		}
	}
}

function emitMouseMove(x, y, deltaX, deltaY) {
	if (print_inputs) {
		console.log(`x: ${x}, y:${y}, dX: ${deltaX}, dY: ${deltaY}`);
	}
	let coord = normalizeAndQuantizeUnsigned(x, y);
	let delta = normalizeAndQuantizeSigned(deltaX, deltaY);
	var Data = new DataView(new ArrayBuffer(9));
	Data.setUint8(0, MessageType.MouseMove);
	Data.setUint16(1, coord.x, true);
	Data.setUint16(3, coord.y, true);
	Data.setInt16(5, delta.x, true);
	Data.setInt16(7, delta.y, true);
	sendInputData(Data.buffer);
}

function emitMouseDown(button, x, y) {
	if (print_inputs) {
		console.log(`mouse button ${button} down at (${x}, ${y})`);
	}
	let coord = normalizeAndQuantizeUnsigned(x, y);
	var Data = new DataView(new ArrayBuffer(6));
	Data.setUint8(0, MessageType.MouseDown);
	Data.setUint8(1, button);
	Data.setUint16(2, coord.x, true);
	Data.setUint16(4, coord.y, true);
	sendInputData(Data.buffer);
}

function emitMouseUp(button, x, y) {
	if (print_inputs) {
		console.log(`mouse button ${button} up at (${x}, ${y})`);
	}
	let coord = normalizeAndQuantizeUnsigned(x, y);
	var Data = new DataView(new ArrayBuffer(6));
	Data.setUint8(0, MessageType.MouseUp);
	Data.setUint8(1, button);
	Data.setUint16(2, coord.x, true);
	Data.setUint16(4, coord.y, true);
	sendInputData(Data.buffer);
}

function emitMouseWheel(delta, x, y) {
	if (print_inputs) {
		console.log(`mouse wheel with delta ${delta} at (${x}, ${y})`);
	}
	let coord = normalizeAndQuantizeUnsigned(x, y);
	var Data = new DataView(new ArrayBuffer(7));
	Data.setUint8(0, MessageType.MouseWheel);
	Data.setInt16(1, delta, true);
	Data.setUint16(3, coord.x, true);
	Data.setUint16(5, coord.y, true);
	sendInputData(Data.buffer);
}

// https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
const MouseButton = {
	MainButton: 0, // Left button.
	AuxiliaryButton: 1, // Wheel button.
	SecondaryButton: 2, // Right button.
	FourthButton: 3, // Browser Back button.
	FifthButton: 4, // Browser Forward button.
};

// https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/buttons
const MouseButtonsMask = {
	PrimaryButton: 1, // Left button.
	SecondaryButton: 2, // Right button.
	AuxiliaryButton: 4, // Wheel button.
	FourthButton: 8, // Browser Back button.
	FifthButton: 16, // Browser Forward button.
};

// If the user has any mouse buttons pressed then release them.
function releaseMouseButtons(buttons, x, y) {
	if (buttons & MouseButtonsMask.PrimaryButton) {
		emitMouseUp(MouseButton.MainButton, x, y);
	}
	if (buttons & MouseButtonsMask.SecondaryButton) {
		emitMouseUp(MouseButton.SecondaryButton, x, y);
	}
	if (buttons & MouseButtonsMask.AuxiliaryButton) {
		emitMouseUp(MouseButton.AuxiliaryButton, x, y);
	}
	if (buttons & MouseButtonsMask.FourthButton) {
		emitMouseUp(MouseButton.FourthButton, x, y);
	}
	if (buttons & MouseButtonsMask.FifthButton) {
		emitMouseUp(MouseButton.FifthButton, x, y);
	}
}

// If the user has any mouse buttons pressed then press them again.
function pressMouseButtons(buttons, x, y) {
	if (buttons & MouseButtonsMask.PrimaryButton) {
		emitMouseDown(MouseButton.MainButton, x, y);
	}
	if (buttons & MouseButtonsMask.SecondaryButton) {
		emitMouseDown(MouseButton.SecondaryButton, x, y);
	}
	if (buttons & MouseButtonsMask.AuxiliaryButton) {
		emitMouseDown(MouseButton.AuxiliaryButton, x, y);
	}
	if (buttons & MouseButtonsMask.FourthButton) {
		emitMouseDown(MouseButton.FourthButton, x, y);
	}
	if (buttons & MouseButtonsMask.FifthButton) {
		emitMouseDown(MouseButton.FifthButton, x, y);
	}
}

function registerInputs(playerElement) {
	if (!playerElement) return;

	registerMouseEnterAndLeaveEvents(playerElement);
	registerTouchEvents(playerElement);
}

function createOnScreenKeyboardHelpers(htmlElement) {
	if (document.getElementById("hiddenInput") === null) {
		hiddenInput = document.createElement("input");
		hiddenInput.id = "hiddenInput";
		hiddenInput.maxLength = 0;
		htmlElement.appendChild(hiddenInput);
	}

	if (document.getElementById("editTextButton") === null) {
		editTextButton = document.createElement("button");
		editTextButton.id = "editTextButton";
		editTextButton.innerHTML = "edit text";
		htmlElement.appendChild(editTextButton);

		// Hide the 'edit text' button.
		editTextButton.classList.add("hiddenState");

		editTextButton.addEventListener("click", function () {
			// Show the on-screen keyboard.
			hiddenInput.focus();
		});
	}
}

function showOnScreenKeyboard(command) {
	if (command.showOnScreenKeyboard) {
		// Show the 'edit text' button.
		editTextButton.classList.remove("hiddenState");
		// Place the 'edit text' button near the UE4 input widget.
		let pos = unquantizeAndDenormalizeUnsigned(command.x, command.y);
		editTextButton.style.top = pos.y.toString() + "px";
		editTextButton.style.left = (pos.x - 40).toString() + "px";
	} else {
		// Hide the 'edit text' button.
		editTextButton.classList.add("hiddenState");
		// Hide the on-screen keyboard.
		hiddenInput.blur();
	}
}

function registerMouseEnterAndLeaveEvents(playerElement) {
	playerElement.onmouseenter = function (e) {
		if (print_inputs) {
			console.log("mouse enter");
		}
		var Data = new DataView(new ArrayBuffer(1));
		Data.setUint8(0, MessageType.MouseEnter);
		sendInputData(Data.buffer);
		playerElement.pressMouseButtons(e);
	};

	playerElement.onmouseleave = function (e) {
		if (print_inputs) {
			console.log("mouse leave");
		}
		var Data = new DataView(new ArrayBuffer(1));
		Data.setUint8(0, MessageType.MouseLeave);
		sendInputData(Data.buffer);
		playerElement.releaseMouseButtons(e);
	};
}

// A locked mouse works by the user clicking in the browser player and the
// cursor disappears and is locked. The user moves the cursor and the camera
// moves, for example. The user presses escape to free the mouse.
function registerLockedMouseEvents(playerElement) {
	var x = playerElement.width / 2;
	var y = playerElement.height / 2;

	playerElement.requestPointerLock =
		playerElement.requestPointerLock || playerElement.mozRequestPointerLock;
	document.exitPointerLock =
		document.exitPointerLock || document.mozExitPointerLock;

	playerElement.onclick = function () {
		playerElement.requestPointerLock();
	};

	// Respond to lock state change events
	document.addEventListener("pointerlockchange", lockStateChange, false);
	document.addEventListener("mozpointerlockchange", lockStateChange, false);

	function lockStateChange() {
		if (
			document.pointerLockElement === playerElement ||
			document.mozPointerLockElement === playerElement
		) {
			console.log("Pointer locked");
			document.addEventListener("mousemove", updatePosition, false);
		} else {
			console.log("The pointer lock status is now unlocked");
			document.removeEventListener("mousemove", updatePosition, false);
		}
	}

	function updatePosition(e) {
		x += e.movementX;
		y += e.movementY;
		if (x > styleWidth) {
			x -= styleWidth;
		}
		if (y > styleHeight) {
			y -= styleHeight;
		}
		if (x < 0) {
			x = styleWidth + x;
		}
		if (y < 0) {
			y = styleHeight - y;
		}
		emitMouseMove(x, y, e.movementX, e.movementY);
	}

	playerElement.onmousedown = function (e) {
		emitMouseDown(e.button, x, y);
	};

	playerElement.onmouseup = function (e) {
		emitMouseUp(e.button, x, y);
	};

	playerElement.onmousewheel = function (e) {
		emitMouseWheel(e.wheelDelta, x, y);
	};

	playerElement.pressMouseButtons = function (e) {
		pressMouseButtons(e.buttons, x, y);
	};

	playerElement.releaseMouseButtons = function (e) {
		releaseMouseButtons(e.buttons, x, y);
	};
}

// A hovering mouse works by the user clicking the mouse button when they want
// the cursor to have an effect over the video. Otherwise the cursor just
// passes over the browser.
function registerHoveringMouseEvents(playerElement) {
	styleCursor = "none"; // We will rely on UE4 client's software cursor.
	//styleCursor = 'default';  // Showing cursor

	playerElement.onmousemove = function (e) {
		emitMouseMove(e.offsetX, e.offsetY, e.movementX, e.movementY);
		e.preventDefault();
	};

	playerElement.onmousedown = function (e) {
		emitMouseDown(e.button, e.offsetX, e.offsetY);
		e.preventDefault();
	};

	playerElement.onmouseup = function (e) {
		emitMouseUp(e.button, e.offsetX, e.offsetY);
		e.preventDefault();
	};

	// When the context menu is shown then it is safest to release the button
	// which was pressed when the event happened. This will guarantee we will
	// get at least one mouse up corresponding to a mouse down event. Otherwise
	// the mouse can get stuck.
	// https://github.com/facebook/react/issues/5531
	playerElement.oncontextmenu = function (e) {
		emitMouseUp(e.button, e.offsetX, e.offsetY);
		e.preventDefault();
	};

	if ("onmousewheel" in playerElement) {
		playerElement.onmousewheel = function (e) {
			emitMouseWheel(e.wheelDelta, e.offsetX, e.offsetY);
			e.preventDefault();
		};
	} else {
		playerElement.addEventListener(
			"DOMMouseScroll",
			function (e) {
				emitMouseWheel(e.detail * -120, e.offsetX, e.offsetY);
				e.preventDefault();
			},
			false
		);
	}

	playerElement.pressMouseButtons = function (e) {
		pressMouseButtons(e.buttons, e.offsetX, e.offsetY);
	};

	playerElement.releaseMouseButtons = function (e) {
		releaseMouseButtons(e.buttons, e.offsetX, e.offsetY);
	};
}

function registerTouchEvents(playerElement) {
	// We need to assign a unique identifier to each finger.
	// We do this by mapping each Touch object to the identifier.
	var fingers = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
	var fingerIds = {};

	function rememberTouch(touch) {
		let finger = fingers.pop();
		if (finger === undefined) {
			console.log("exhausted touch indentifiers");
		}
		fingerIds[touch.identifier] = finger;
	}

	function forgetTouch(touch) {
		fingers.push(fingerIds[touch.identifier]);
		delete fingerIds[touch.identifier];
	}

	function emitTouchData(type, touches) {
		let data = new DataView(new ArrayBuffer(2 + 6 * touches.length));
		data.setUint8(0, type);
		data.setUint8(1, touches.length);
		let byte = 2;
		for (let t = 0; t < touches.length; t++) {
			let touch = touches[t];
			let x = touch.clientX - playerElement.offsetLeft;
			let y = touch.clientY - playerElement.offsetTop;
			if (print_inputs) {
				console.log(`F${fingerIds[touch.identifier]}=(${x}, ${y})`);
			}
			let coord = normalizeAndQuantizeUnsigned(x, y);
			data.setUint16(byte, coord.x, true);
			byte += 2;
			data.setUint16(byte, coord.y, true);
			byte += 2;
			data.setUint8(byte, fingerIds[touch.identifier], true);
			byte += 1;
			data.setUint8(byte, 255 * touch.force, true); // force is between 0.0 and 1.0 so quantize into byte.
			byte += 1;
		}
		sendInputData(data.buffer);
	}

	if (inputOptions.fakeMouseWithTouches) {
		var finger = undefined;

		playerElement.ontouchstart = function (e) {
			if (finger === undefined) {
				let firstTouch = e.changedTouches[0];
				finger = {
					id: firstTouch.identifier,
					x: firstTouch.clientX - playerElementClientRect.left,
					y: firstTouch.clientY - playerElementClientRect.top,
				};
				// Hack: Mouse events require an enter and leave so we just
				// enter and leave manually with each touch as this event
				// is not fired with a touch device.
				playerElement.onmouseenter(e);
				emitMouseDown(MouseButton.MainButton, finger.x, finger.y);
			}
			e.preventDefault();
		};

		playerElement.ontouchend = function (e) {
			for (let t = 0; t < e.changedTouches.length; t++) {
				let touch = e.changedTouches[t];
				if (touch.identifier === finger.id) {
					let x = touch.clientX - playerElementClientRect.left;
					let y = touch.clientY - playerElementClientRect.top;
					emitMouseUp(MouseButton.MainButton, x, y);
					// Hack: Manual mouse leave event.
					playerElement.onmouseleave(e);
					finger = undefined;
					break;
				}
			}
			e.preventDefault();
		};

		playerElement.ontouchmove = function (e) {
			for (let t = 0; t < e.touches.length; t++) {
				let touch = e.touches[t];
				if (touch.identifier === finger.id) {
					let x = touch.clientX - playerElementClientRect.left;
					let y = touch.clientY - playerElementClientRect.top;
					emitMouseMove(x, y, x - finger.x, y - finger.y);
					finger.x = x;
					finger.y = y;
					break;
				}
			}
			e.preventDefault();
		};
	} else {
		playerElement.ontouchstart = function (e) {
			// Assign a unique identifier to each touch.
			for (let t = 0; t < e.changedTouches.length; t++) {
				rememberTouch(e.changedTouches[t]);
			}

			if (print_inputs) {
				console.log("touch start");
			}
			emitTouchData(MessageType.TouchStart, e.changedTouches);
			e.preventDefault();
		};

		playerElement.ontouchend = function (e) {
			if (print_inputs) {
				console.log("touch end");
			}
			emitTouchData(MessageType.TouchEnd, e.changedTouches);

			// Re-cycle unique identifiers previously assigned to each touch.
			for (let t = 0; t < e.changedTouches.length; t++) {
				forgetTouch(e.changedTouches[t]);
			}
			e.preventDefault();
		};

		playerElement.ontouchmove = function (e) {
			if (print_inputs) {
				console.log("touch move");
			}
			emitTouchData(MessageType.TouchMove, e.touches);
			e.preventDefault();
		};
	}
}


// Must be kept in sync with JavaScriptKeyCodeToFKey C++ array. The index of the
// entry in the array is the special key code given below.
const SpecialKeyCodes = {
	BackSpace: 8,
	Shift: 16,
	Control: 17,
	Alt: 18,
	RightShift: 253,
	RightControl: 254,
	RightAlt: 255,
};

// We want to be able to differentiate between left and right versions of some
// keys.
function getKeyCode(e) {
	if (e.keyCode === SpecialKeyCodes.Shift && e.code === "ShiftRight")
		return SpecialKeyCodes.RightShift;
	else if (e.keyCode === SpecialKeyCodes.Control && e.code === "ControlRight")
		return SpecialKeyCodes.RightControl;
	else if (e.keyCode === SpecialKeyCodes.Alt && e.code === "AltRight")
		return SpecialKeyCodes.RightAlt;
	else return e.keyCode;
}

function registerKeyboardEvents() {
	document.onkeydown = function (e) {
		if (preventDefault) e.preventDefault();
		sendInputData(
			new Uint8Array([MessageType.KeyDown, getKeyCode(e), e.repeat]).buffer
		);
		//  e.stopPropagation
	};

	document.onkeyup = function (e) {
		if (preventDefault) e.preventDefault();
		sendInputData(new Uint8Array([MessageType.KeyUp, getKeyCode(e)]).buffer);
	};

	document.onkeypress = function (e) {
		if (preventDefault) e.preventDefault();
		let data = new DataView(new ArrayBuffer(3));
		data.setUint8(0, MessageType.KeyPress);
		data.setUint16(1, e.charCode, true);
		sendInputData(data.buffer);
	};
}

function onExpandOverlay_Click(/* e */) {
	let overlay = document.getElementById("overlay");
	overlay.classList.toggle("overlay-shown");
}

function start() {
	// update "quality status" to "disconnected" state
	let qualityStatus = document.getElementById("qualityStatus");
	qualityStatus.className = "grey-status";

	statsDiv.innerHTML = "Not connected";

	if (!connect_on_load || is_reconnection) {
		showConnectOverlay();
		invalidateFreezeFrameOverlay();
		shouldShowPlayOverlay = true;
		resizePlayerStyle();
	} else {
		connect();
	}

	updateKickButton(0);
}

function updateKickButton(playersCount) {
	var kickButton = document.getElementById("kick-other-players-button");
	if (kickButton) kickButton.value = `Kick (${playersCount})`;
}

function connect() {
	"use strict";

	ws = new WebSocket(
		window.location.href
			.replace("http://", "ws://")
			.replace("https://", "wss://")
	);

	ws.onmessage = function (event) {
		console.log(`<- SS: ${event.data}`);
		var msg = JSON.parse(event.data);
		if (msg.type === "config") {
			onConfig(msg);
		} else if (msg.type === "playerCount") {
			updateKickButton(msg.count - 1);
		} else if (msg.type === "answer") {
			onWebRtcAnswer(msg);
		} else if (msg.type === "iceCandidate") {
			onWebRtcIce(msg.candidate);
		} else {
			console.log(`invalid SS message type: ${msg.type}`);
		}
	};

	ws.onerror = function (event) {
		console.log(`WS error: ${JSON.stringify(event)}`);
	};

	ws.onclose = function (event) {
		console.log(`WS closed: ${JSON.stringify(event.code)} - ${event.reason}`);
		ws = undefined;
		is_reconnection = true;

		// destroy `webRtcPlayerObj` if any
		let playerDiv = document.getElementById("player");
		if (webRtcPlayerObj) {
			playerDiv.removeChild(webRtcPlayerObj.video);
			clearInterval(webRtcPlayerObj.aggregateStatsIntervalId);
			webRtcPlayerObj.close();
			webRtcPlayerObj = undefined;
		}

		showTextOverlay(`Disconnected: ${event.reason}`);
		var reclickToStart = setTimeout(start, 4000);
	};
}

// Config data received from WebRTC sender via the  web server
function onConfig(config) {
	let playerDiv = document.getElementById("player");
	let playerElement = setupWebRtcPlayer(playerDiv, config);
	resizePlayerStyle();

	switch (inputOptions.controlScheme) {
		case ControlSchemeType.HoveringMouse:
			registerHoveringMouseEvents(playerElement);
			break;
		case ControlSchemeType.LockedMouse:
			registerLockedMouseEvents(playerElement);
			break;
		default:
			console.log(
				`ERROR: Unknown control scheme ${inputOptions.controlScheme}`
			);
			registerLockedMouseEvents(playerElement);
			break;
	}
}

function load() {
	setupHtmlEvents();
	setupFreezeFrameOverlay();
	registerKeyboardEvents();
	start();
}
