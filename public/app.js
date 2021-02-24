
let webRtcPlayerObj = new window.WebRTC();
let playerElement = webRtcPlayerObj.video;

const statsDiv = document.getElementById("stats");
const logsWrapper = document.getElementById("logs");



// whether to prevent browser's default behavior when keyboard/mouse have inputs, like F1~F12 and Tab
window.preventDefault = false
// 触屏模拟鼠标
window.fakeMouseWithTouches = false

var ws;
const WS_OPEN_STATE = 1;





// window.addEventListener("resize", resizePlayerStyle, true);
// window.addEventListener("orientationchange", resizePlayerStyle);



function showTextOverlay(text = '', timeout = 2000) {
	// show log top left, disappear after timeout

	console.log(text)
	const log = document.createElement("div");
	log.innerHTML = text;
	logsWrapper.appendChild(log)
	setTimeout(() => {
		logsWrapper.removeChild(log)
	}, timeout);
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

function setupWebRtcPlayer() {
	document.body.appendChild(webRtcPlayerObj.video);


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



	webRtcPlayerObj.onDataChannelMessage = function (data) {
		var view = new Uint8Array(data);
		if (view[0] === ToClientMessageType.QualityControlOwnership) {
			let ownership = view[1] !== 0;

		} else if (view[0] === ToClientMessageType.Response) {
			// user custom message
			let response = new TextDecoder("utf-16").decode(data.slice(1));

		} else if (view[0] === ToClientMessageType.Command) {
			let commandAsString = new TextDecoder("utf-16").decode(data.slice(1));
			console.log(commandAsString);
			let command = JSON.parse(commandAsString);
			if (command.command === "onScreenKeyboard") {
				showTextOverlay('You should setup a on-screen keyboard')
			}
		} else if (view[0] === ToClientMessageType.FreezeFrame) {
			let size = new DataView(view.slice(1, 5).buffer).getInt32(
				0,
				true
			);
			let jpeg = view.slice(1 + 4);

		} else if (view[0] === ToClientMessageType.UnfreezeFrame) {
			// 
		} else if (view[0] === ToClientMessageType.VideoEncoderAvgQP) {
			VideoEncoderQP = new TextDecoder("utf-16").decode(data.slice(1));
			console.log(`received VideoEncoderAvgQP ${VideoEncoderQP}`);
		} else {
			console.error(`unrecognized data received, packet ID ${view[0]}`);
		}
	};



	registerMouseEnterAndLeaveEvents(webRtcPlayerObj.video);
	registerTouchEvents(webRtcPlayerObj.video);



	showTextOverlay("Starting connection to server, please wait");
	webRtcPlayerObj.createOffer();

	if (ws && ws.readyState === WS_OPEN_STATE) {

		// double click: pointer lock mode
		webRtcPlayerObj.video.ondblclick = e => {
			webRtcPlayerObj.video.requestPointerLock();
		};

	}


	document.addEventListener("pointerlockchange", () => {
		if (document.pointerLockElement === webRtcPlayerObj.video) {
			setupMouseLockEvents()
		} else {
			setupMouseHoverEvents()
		}
	}, false);

	setupMouseHoverEvents()

	return webRtcPlayerObj.video;
}

function onAggregatedStats(reducedStat) {
	let numberFormat = new Intl.NumberFormat(window.navigator.language, {
		maximumFractionDigits: 0,
	});

	receivedBytesMeasurement = "B";
	receivedBytes = reducedStat.bytesReceived || 0;
	["KB", "MB", "GB"].find(dataMeasurement => {
		if (receivedBytes < 100 * 1000) return true;
		receivedBytes /= 1000;
		receivedBytesMeasurement = dataMeasurement;
	})


	let qualityStatus = document.getElementById("qualityStatus");



	const orangeQP = 26;
	const redQP = 35;

	let statsText = "";

	let color = "lime";
	if (VideoEncoderQP > redQP) {
		color = "red";
		statsText += `<div style="color: ${color}">Bad network connection</div>`;
	} else if (VideoEncoderQP > orangeQP) {
		color = "orange";
		statsText += `<div style="color: ${color}">Spotty network connection</div>`;
	}

	qualityStatus.style.color = color

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
	webRtcPlayerObj.onClosed = () => {
		clearInterval(webRtcPlayerObj.aggregateStatsIntervalId);
	}
}

function onWebRtcIce(iceCandidate) {
	if (webRtcPlayerObj) webRtcPlayerObj.handleCandidateFromServer(iceCandidate);
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
	webRtcPlayerObj.send(data.buffer);
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


function normalizeAndQuantizeUnsigned(x, y) {
	let normalizedX = x / playerElement.clientWidth
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
};;



function emitMouseMove(x, y, deltaX, deltaY) {
	let coord = normalizeAndQuantizeUnsigned(x, y);
	deltaX = deltaX * 65536 / playerElement.clientWidth
	deltaY = deltaY * 65536 / playerElement.clientHeight
	var Data = new DataView(new ArrayBuffer(9));
	Data.setUint8(0, MessageType.MouseMove);
	Data.setUint16(1, coord.x, true);
	Data.setUint16(3, coord.y, true);
	Data.setInt16(5, deltaX, true);
	Data.setInt16(7, deltaY, true);
	webRtcPlayerObj.send(Data.buffer);
}

function emitMouseDown(button, x, y) {

	let coord = normalizeAndQuantizeUnsigned(x, y);
	var Data = new DataView(new ArrayBuffer(6));
	Data.setUint8(0, MessageType.MouseDown);
	Data.setUint8(1, button);
	Data.setUint16(2, coord.x, true);
	Data.setUint16(4, coord.y, true);
	webRtcPlayerObj.send(Data.buffer);
}

function emitMouseUp(button, x, y) {

	let coord = normalizeAndQuantizeUnsigned(x, y);
	var Data = new DataView(new ArrayBuffer(6));
	Data.setUint8(0, MessageType.MouseUp);
	Data.setUint8(1, button);
	Data.setUint16(2, coord.x, true);
	Data.setUint16(4, coord.y, true);
	webRtcPlayerObj.send(Data.buffer);
}

function emitMouseWheel(delta, x, y) {

	let coord = normalizeAndQuantizeUnsigned(x, y);
	var Data = new DataView(new ArrayBuffer(7));
	Data.setUint8(0, MessageType.MouseWheel);
	Data.setInt16(1, delta, true);
	Data.setUint16(3, coord.x, true);
	Data.setUint16(5, coord.y, true);
	webRtcPlayerObj.send(Data.buffer);
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



function registerMouseEnterAndLeaveEvents(video) {
	video.onmouseenter = function (e) {
		var Data = new DataView(new ArrayBuffer(1));
		Data.setUint8(0, MessageType.MouseEnter);
		webRtcPlayerObj.send(Data.buffer);
	};

	video.onmouseleave = function (e) {
		var Data = new DataView(new ArrayBuffer(1));
		Data.setUint8(0, MessageType.MouseLeave);
		webRtcPlayerObj.send(Data.buffer);
	};
}

function setupMouseLockEvents() {
	preventDefault = true
	showTextOverlay('mouse locked in, ESC to exit')

	const { clientWidth, clientHeight } = webRtcPlayerObj.video
	let x = clientWidth / 2;
	let y = clientHeight / 2;

	function updatePosition(e) {
		x += e.movementX;
		y += e.movementY;
		if (x > clientWidth) {
			x -= clientWidth;
		}
		if (y > clientHeight) {
			y -= clientHeight;
		}
		if (x < 0) {
			x = clientWidth + x;
		}
		if (y < 0) {
			y = clientHeight - y;
		}
	}

	webRtcPlayerObj.video.onmousemove = (e) => {
		updatePosition(e)
		emitMouseMove(x, y, e.movementX, e.movementY);
	};

	webRtcPlayerObj.video.onmousedown = function (e) {
		emitMouseDown(e.button, x, y);
	};

	webRtcPlayerObj.video.onmouseup = function (e) {
		emitMouseUp(e.button, x, y);
	};

	webRtcPlayerObj.video.onmousewheel = function (e) {
		emitMouseWheel(e.wheelDelta, x, y);
	};

}






function setupMouseHoverEvents() {
	window.preventDefault = false


	webRtcPlayerObj.video.onmousemove = (e) => {
		// console.log(e.offsetX,e.offsetY)
		emitMouseMove(e.offsetX, e.offsetY, e.movementX, e.movementY);
		if (preventDefault) e.preventDefault();
	};

	webRtcPlayerObj.video.onmousedown = (e) => {
		emitMouseDown(e.button, e.offsetX, e.offsetY);
		if (preventDefault) e.preventDefault();
	};

	webRtcPlayerObj.video.onmouseup = (e) => {
		emitMouseUp(e.button, e.offsetX, e.offsetY);
		if (preventDefault) e.preventDefault();
	};

	// When the context menu is shown then it is safest to release the button
	// which was pressed when the event happened. This will guarantee we will
	// get at least one mouse up corresponding to a mouse down event. Otherwise
	// the mouse can get stuck.
	// https://github.com/facebook/react/issues/5531
	webRtcPlayerObj.video.oncontextmenu = (e) => {
		emitMouseUp(e.button, e.offsetX, e.offsetY);
		if (preventDefault) e.preventDefault();
	};


	webRtcPlayerObj.video.onmousewheel = (e) => {
		emitMouseWheel(e.wheelDelta, e.offsetX, e.offsetY);
		if (preventDefault) e.preventDefault();
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
		webRtcPlayerObj.send(data.buffer);
	}

	if (fakeMouseWithTouches) {
		var finger = undefined;

		const playerElementClientRect = playerElement.getBoundingClientRect()

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
			if (preventDefault) e.preventDefault();
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
			if (preventDefault) e.preventDefault();
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
			if (preventDefault) e.preventDefault();
		};
	} else {
		playerElement.ontouchstart = function (e) {
			// Assign a unique identifier to each touch.
			for (let t = 0; t < e.changedTouches.length; t++) {
				rememberTouch(e.changedTouches[t]);
			}


			emitTouchData(MessageType.TouchStart, e.changedTouches);
			if (preventDefault) e.preventDefault();
		};

		playerElement.ontouchend = function (e) {

			emitTouchData(MessageType.TouchEnd, e.changedTouches);

			// Re-cycle unique identifiers previously assigned to each touch.
			for (let t = 0; t < e.changedTouches.length; t++) {
				forgetTouch(e.changedTouches[t]);
			}
			if (preventDefault) e.preventDefault();
		};

		playerElement.ontouchmove = function (e) {

			emitTouchData(MessageType.TouchMove, e.touches);
			if (preventDefault) e.preventDefault();
		};
	}
}

function registerKeyboardEvents() {

	// Must be kept in sync with JavaScriptKeyCodeToFKey C++ array. The index of the
	// entry in the array is the special key code given below.
	// special keycodes different from KeyboardEvent.keyCode 
	const SpecialKeyCodes = {
		Backspace: 8,
		ShiftLeft: 16,
		ControlLeft: 17,
		AltLeft: 18,
		ShiftRight: 253,
		ControlRight: 254,
		AltRight: 255,
	};


	webRtcPlayerObj.video.onkeydown = function (e) {
		if (preventDefault) e.preventDefault();
		webRtcPlayerObj.send(
			new Uint8Array([MessageType.KeyDown, SpecialKeyCodes[e.code] || e.keyCode, e.repeat]).buffer
		);
		//  e.stopPropagation
	};

	webRtcPlayerObj.video.onkeyup = function (e) {
		if (preventDefault) e.preventDefault();
		webRtcPlayerObj.send(new Uint8Array([MessageType.KeyUp, SpecialKeyCodes[e.code] || e.keyCode]).buffer);
	};

	webRtcPlayerObj.video.onkeypress = function (e) {
		if (preventDefault) e.preventDefault();
		let data = new DataView(new ArrayBuffer(3));
		data.setUint8(0, MessageType.KeyPress);
		data.setUint16(1, SpecialKeyCodes[e.code] || e.keyCode, true);
		webRtcPlayerObj.send(data.buffer);
	};
}

function onExpandOverlay_Click(/* e */) {
	let overlay = document.getElementById("overlay");
	overlay.classList.toggle("overlay-shown");
}

function connect(url = location.href.replace("http://", "ws://").replace("https://", "wss://")) {

	ws = new WebSocket(url);

	ws.onmessage = function (event) {
		console.log(`<- SS: ${event.data}`);
		var msg = JSON.parse(event.data);
		if (msg.type === "config") {
			setupWebRtcPlayer();
			registerKeyboardEvents();
		} else if (msg.type === "answer") {
			onWebRtcAnswer(msg);
		} else if (msg.type === "iceCandidate") {
			onWebRtcIce(msg.candidate);
		} else {
			console.log(`WS: invalid message type: ${msg.type}`);
		}
	};

	ws.onerror = function (event) {
		showTextOverlay(`WS error: ${JSON.stringify(event)}`);
	};

	ws.onclose = function (event) {
		ws = undefined;

		// remove from parent
		webRtcPlayerObj.video.remove();
		webRtcPlayerObj.close();


		showTextOverlay(`WS closed: ${event.reason}`);

		// 3s后重连
		setTimeout(connect, 3000);
	};
}


