// Must be kept in sync with JavaScriptKeyCodeToFKey C++ array.
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

// https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
const MouseButton = {
  MainButton: 0, // Left button.
  AuxiliaryButton: 1, // Wheel button.
  SecondaryButton: 2, // Right button.
  FourthButton: 3, // Browser Back button.
  FifthButton: 4, // Browser Forward button.
};

// Must be kept in sync with PixelStreamingProtocol::EToClientMsg C++ enum.
const toPlayerType = {
  QualityControlOwnership: 0,
  Response: 1,
  Command: 2,
  FreezeFrame: 3,
  UnfreezeFrame: 4,
  VideoEncoderAvgQP: 5,
};

// Must be kept in sync with PixelStreamingProtocol::EToUE4Msg C++ enum.
const toUE4type = {
  /*
   * Control Messages. Range = 0..49.
   */
  IFrameRequest: 0,
  RequestQualityControl: 1,
  MaxFpsRequest: 2,
  AverageBitrateRequest: 3,
  StartStreaming: 4,
  StopStreaming: 5,

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
};

window.PixelStream = class extends EventTarget {
  constructor(url) {
    super();

    // whether to prevent browser's default behavior when keyboard/mouse have inputs, like F1~F12 and Tab
    this.preventDefault = true;
    this.VideoEncoderQP = "N/A";

    this.ws = undefined; // WebSocket
    this.pc = new RTCPeerConnection({
      sdpSemantics: "unified-plan",
    });
    this.dc = null; // RTCDataChannel

    this.sdpConstraints = {
      offerToReceiveAudio: 1,
      offerToReceiveVideo: 1,
    };

    this.aggregatedStats = {};

    this.setupVideo();

    document.addEventListener(
      "pointerlockchange",
      () => {
        if (document.pointerLockElement === this.video) {
          this.registerMouseLockEvents();
        } else {
          this.registerMouseHoverEvents();
        }
      },
      false
    );

    this.connect(url);
  }

  async onWebSocketMessage(data) {
    let msg = JSON.parse(data);
    if (msg.type === "config") {
      this.peerConnectionOptions = msg.peerConnectionOptions;
      console.info("connecting to UE4");
      await this.createOffer();
    } else if (msg.type === "answer") {
      console.log(`Received answer`, msg);
      let answerDesc = new RTCSessionDescription(msg);
      await this.pc.setRemoteDescription(answerDesc);
    } else if (msg.type === "iceCandidate") {
      let candidate = new RTCIceCandidate(msg.candidate);
      await this.pc.addIceCandidate(candidate);
      console.log("received candidate", msg.candidate);
    } else {
      console.warn(`invalid WS message:`, msg);
    }
  }

  onDataChannelMessage(data) {
    let view = new Uint8Array(data);
    if (view[0] === toPlayerType.VideoEncoderAvgQP) {
      this.VideoEncoderQP = new TextDecoder("utf-16").decode(data.slice(1));
      console.log(`received VideoEncoderAvgQP`, this.VideoEncoderQP);
    } else if (view[0] === toPlayerType.Response) {
      // user custom message
      let response = new TextDecoder("utf-16").decode(data.slice(1));
      this.dispatchEvent(new CustomEvent("message", { detail: response }));
    } else if (view[0] === toPlayerType.Command) {
      let commandAsString = new TextDecoder("utf-16").decode(data.slice(1));
      let command = JSON.parse(commandAsString);
      console.log(command);
      if (command.command === "onScreenKeyboard") {
        console.info("You should setup a on-screen keyboard");
      }
    } else if (view[0] === toPlayerType.FreezeFrame) {
      let size = new DataView(view.slice(1, 5).buffer).getInt32(0, true);
      let jpeg = view.slice(1 + 4);
    } else if (view[0] === toPlayerType.UnfreezeFrame) {
    } else if (view[0] === toPlayerType.QualityControlOwnership) {
      let ownership = view[1] !== 0;
      console.info("received Quality Control Ownership", ownership);
    } else {
      console.error(`invalid data type:`, view[0]);
    }
  }

  setupVideo() {
    this.video = document.createElement("video");
    this.video.tabIndex = 0; // easy to focus..
    this.video.playsInline = true;

    // Recently many browsers can only autoplay the videos with sound off
    this.video.muted = true;
    this.video.autoplay = true;

    // this.video.onsuspend
    // this.video.onplaying

    // double click: pointer lock mode
    this.video.ondblclick = (e) => {
      this.video.requestPointerLock();
    };

    // this.video.onresize

    this.video.style = `
      background-color: #222;
      width: unset;
      height: unset;
      position: fixed;
      top: 50%;
      left: 50%;
      display: none;
      transform: translateX(-50%) translateY(-50%);
      object-fit: fill; `;
  }

  setupDataChannel(label = "hello world") {
    this.dc = this.pc.createDataChannel(label, { ordered: true });

    this.dc.onopen = (e) => {
      console.log(`data channel connected:`, label);
      this.video.style.display = "block";
      this.dispatchEvent(new CustomEvent("open"));
    };

    this.dc.onclose = (e) => {
      console.log(`data channel closed:`, label);
      this.video.style.display = "none";
      this.dispatchEvent(new CustomEvent("close"));
    };

    this.dc.onmessage = (e) => {
      this.onDataChannelMessage(e.data);
    };
  }

  setupPeerConnection() {
    this.pc.ontrack = (e) => {
      // called twice for audio & video
      console.log("received track:", e);
      this.video.srcObject = e.streams[0];
    };
    this.pc.onicecandidate = (e) => {
      if (e.candidate && e.candidate.candidate) {
        console.log(`sending candidate:`, e.candidate);
        this.ws.send(
          JSON.stringify({ type: "iceCandidate", candidate: e.candidate })
        );
      }
    };
  }

  // fetch then reduce the stats array
  async getStats() {
    const stats = await this.pc.getStats(null);

    let newStat = {};

    stats.forEach((stat, i) => {
      if (
        stat.type === "inbound-rtp" &&
        !stat.isRemote &&
        stat.mediaType === "video"
      ) {
        Object.assign(newStat, stat);

        // bitrate = bits received since last time / number of ms since last time
        //This is automatically in kbits (where k=1000) since time is in ms and stat we want is in seconds (so a '* 1000' then a '/ 1000' would negate each other)
        newStat.bitrate =
          (8 * (newStat.bytesReceived - this.aggregatedStats.bytesReceived)) /
          (newStat.timestamp - this.aggregatedStats.timestamp);
        newStat.bitrate = Math.floor(newStat.bitrate);
        newStat.lowBitrate = Math.min(
          this.aggregatedStats.lowBitrate || Infinity,
          newStat.bitrate
        );
        newStat.highBitrate = Math.max(
          this.aggregatedStats.highBitrate || -Infinity,
          newStat.bitrate
        );
      }

      //Read video track stats
      else if (
        stat.type == "track" &&
        (stat.trackIdentifier == "video_label" || stat.kind == "video")
      ) {
        Object.assign(newStat, stat);

        newStat.framesDroppedPercentage =
          (stat.framesDropped / stat.framesReceived) * 100;
      } else if (
        stat.type == "candidate-pair" &&
        stat.hasOwnProperty("currentRoundTripTime")
      ) {
        Object.assign(newStat, stat);
      } else if (stat.type === "data-channel") {
        newStat.dataChannel = stat;
      }
    });

    this.aggregatedStats = newStat;
    return newStat;
  }

  async createOffer() {
    this.pc.close();

    this.pc = new RTCPeerConnection({
      sdpSemantics: "unified-plan",
      ...this.peerConnectionOptions,
    });

    this.setupPeerConnection();
    this.setupDataChannel();
    const offer = await this.pc.createOffer(this.sdpConstraints);

    this.pc.setLocalDescription(offer);
    // increase start bitrate from 300 kbps to 20 mbps and max bitrate from 2.5 mbps to 100 mbps
    // (100 mbps means we don't restrict encoder at all)
    // after we `setLocalDescription` because other browsers are not c happy to see google-specific config
    offer.sdp = offer.sdp.replace(
      /(a=fmtp:\d+ .*level-asymmetry-allowed=.*)\r\n/gm,
      "$1;x-google-start-bitrate=10000;x-google-max-bitrate=20000\r\n"
    );
    this.ws.send(JSON.stringify(offer));
    console.log(`offer sent:`, offer);
  }

  connect(url = location.href.replace(/^http/, "ws")) {
    this.ws = new WebSocket(url);

    // this.ws.onopen
    this.ws.onerror = (e) => {
      console.warn(e);
    };

    this.ws.onmessage = (e) => {
      this.onWebSocketMessage(e.data);
    };

    this.ws.onclose = (e) => {
      this.pc.close();
      console.info(`WS & WebRTC closed:`, e.reason || e.code);

      // 3s后重连
      setTimeout(() => {
        this.connect(url);
      }, 3000);
    };
  }

  registerKeyboardEvents() {
    this.video.onkeydown = (e) => {
      if (this.preventDefault) e.preventDefault();
      this.dc.send(
        new Uint8Array([
          toUE4type.KeyDown,
          SpecialKeyCodes[e.code] || e.keyCode,
          e.repeat,
        ]).buffer
      );
      //  e.stopPropagation
    };

    this.video.onkeyup = (e) => {
      if (this.preventDefault) e.preventDefault();
      this.dc.send(
        new Uint8Array([toUE4type.KeyUp, SpecialKeyCodes[e.code] || e.keyCode])
          .buffer
      );
    };

    this.video.onkeypress = (e) => {
      if (this.preventDefault) e.preventDefault();
      let data = new DataView(new ArrayBuffer(3));
      data.setUint8(0, toUE4type.KeyPress);
      data.setUint16(1, SpecialKeyCodes[e.code] || e.keyCode, true);
      this.dc.send(data.buffer);
    };
  }

  registerTouchEvents() {
    // We need to assign a unique identifier to each finger.
    // We do this by mapping each Touch object to the identifier.
    let fingers = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
    let fingerIds = {};

    this.video.ontouchstart = (e) => {
      // Assign a unique identifier to each touch.
      for (let touch of e.changedTouches) {
        // remember touch
        let finger = fingers.pop();
        if (finger === undefined) {
          console.info("exhausted touch indentifiers");
        }
        fingerIds[touch.identifier] = finger;
      }
      this.emitTouchData(toUE4type.TouchStart, e.changedTouches, fingerIds);
      if (this.preventDefault) e.preventDefault();
    };

    this.video.ontouchend = (e) => {
      this.emitTouchData(toUE4type.TouchEnd, e.changedTouches, fingerIds);
      // Re-cycle unique identifiers previously assigned to each touch.
      for (let touch of e.changedTouches) {
        // forget touch
        fingers.push(fingerIds[touch.identifier]);
        delete fingerIds[touch.identifier];
      }
      if (this.preventDefault) e.preventDefault();
    };

    this.video.ontouchmove = (e) => {
      this.emitTouchData(toUE4type.TouchMove, e.touches, fingerIds);
      if (this.preventDefault) e.preventDefault();
    };
  }

  // 触屏模拟鼠标
  registerFakeMouseEvents() {
    let finger = undefined;

    const boundingRect = this.video.getBoundingClientRect();

    this.video.ontouchstart = (e) => {
      if (finger === undefined) {
        let firstTouch = e.changedTouches[0];
        finger = {
          id: firstTouch.identifier,
          x: firstTouch.clientX - boundingRect.left,
          y: firstTouch.clientY - boundingRect.top,
        };
        // Hack: Mouse events require an enter and leave so we just
        // enter and leave manually with each touch as this event
        // is not fired with a touch device.
        this.video.onmouseenter(e);
        this.emitMouseDown(MouseButton.MainButton, finger.x, finger.y);
      }
      if (this.preventDefault) e.preventDefault();
    };

    this.video.ontouchend = (e) => {
      for (let touch of e.changedTouches) {
        if (touch.identifier === finger.id) {
          let x = touch.clientX - boundingRect.left;
          let y = touch.clientY - boundingRect.top;
          this.emitMouseUp(MouseButton.MainButton, x, y);
          // Hack: Manual mouse leave event.
          this.video.onmouseleave(e);
          finger = undefined;
          break;
        }
      }
      if (this.preventDefault) e.preventDefault();
    };

    this.video.ontouchmove = (e) => {
      for (let touch of e.touches) {
        if (touch.identifier === finger.id) {
          let x = touch.clientX - boundingRect.left;
          let y = touch.clientY - boundingRect.top;
          this.emitMouseMove(x, y, x - finger.x, y - finger.y);
          finger.x = x;
          finger.y = y;
          break;
        }
      }
      if (this.preventDefault) e.preventDefault();
    };
  }

  registerMouseHoverEvents() {
    this.registerMouseEnterAndLeaveEvents();

    this.preventDefault = false;

    this.video.onmousemove = (e) => {
      this.emitMouseMove(e.offsetX, e.offsetY, e.movementX, e.movementY);
      if (this.preventDefault) e.preventDefault();
    };

    this.video.onmousedown = (e) => {
      this.emitMouseDown(e.button, e.offsetX, e.offsetY);
      if (this.preventDefault) e.preventDefault();
    };

    this.video.onmouseup = (e) => {
      this.emitMouseUp(e.button, e.offsetX, e.offsetY);
      if (this.preventDefault) e.preventDefault();
    };

    // When the context menu is shown then it is safest to release the button
    // which was pressed when the event happened. This will guarantee we will
    // get at least one mouse up corresponding to a mouse down event. Otherwise
    // the mouse can get stuck.
    // https://github.com/facebook/react/issues/5531
    this.video.oncontextmenu = (e) => {
      this.emitMouseUp(e.button, e.offsetX, e.offsetY);
      if (this.preventDefault) e.preventDefault();
    };

    this.video.onmousewheel = (e) => {
      this.emitMouseWheel(e.wheelDelta, e.offsetX, e.offsetY);
      if (this.preventDefault) e.preventDefault();
    };
  }

  registerMouseLockEvents() {
    this.registerMouseEnterAndLeaveEvents();

    this.preventDefault = true;
    console.info("mouse locked in, ESC to exit");

    const { clientWidth, clientHeight } = this.video;
    let x = clientWidth / 2;
    let y = clientHeight / 2;

    this.video.onmousemove = (e) => {
      x += e.movementX;
      y += e.movementY;
      if (x > clientWidth) {
        x -= clientWidth;
      } else if (x < 0) {
        x += clientWidth;
      }
      if (y > clientHeight) {
        y -= clientHeight;
      } else if (y < 0) {
        y += clientHeight;
      }
      this.emitMouseMove(x, y, e.movementX, e.movementY);
    };

    this.video.onmousedown = (e) => {
      this.emitMouseDown(e.button, x, y);
    };

    this.video.onmouseup = (e) => {
      this.emitMouseUp(e.button, x, y);
    };

    this.video.onmousewheel = (e) => {
      this.emitMouseWheel(e.wheelDelta, x, y);
    };
  }

  registerMouseEnterAndLeaveEvents() {
    this.video.onmouseenter = (e) => {
      let Data = new DataView(new ArrayBuffer(1));
      Data.setUint8(0, toUE4type.MouseEnter);
      this.dc.send(Data.buffer);
    };

    this.video.onmouseleave = (e) => {
      let Data = new DataView(new ArrayBuffer(1));
      Data.setUint8(0, toUE4type.MouseLeave);
      if (this.dc.readyState === "open") this.dc.send(Data.buffer);
    };
  }

  emitMouseMove(x, y, deltaX, deltaY) {
    let coord = this.normalizeAndQuantizeUnsigned(x, y);
    deltaX = (deltaX * 65536) / this.video.clientWidth;
    deltaY = (deltaY * 65536) / this.video.clientHeight;
    let Data = new DataView(new ArrayBuffer(9));
    Data.setUint8(0, toUE4type.MouseMove);
    Data.setUint16(1, coord.x, true);
    Data.setUint16(3, coord.y, true);
    Data.setInt16(5, deltaX, true);
    Data.setInt16(7, deltaY, true);
    this.dc.send(Data.buffer);
  }

  emitMouseDown(button, x, y) {
    let coord = this.normalizeAndQuantizeUnsigned(x, y);
    let Data = new DataView(new ArrayBuffer(6));
    Data.setUint8(0, toUE4type.MouseDown);
    Data.setUint8(1, button);
    Data.setUint16(2, coord.x, true);
    Data.setUint16(4, coord.y, true);
    this.dc.send(Data.buffer);
  }

  emitMouseUp(button, x, y) {
    let coord = this.normalizeAndQuantizeUnsigned(x, y);
    let Data = new DataView(new ArrayBuffer(6));
    Data.setUint8(0, toUE4type.MouseUp);
    Data.setUint8(1, button);
    Data.setUint16(2, coord.x, true);
    Data.setUint16(4, coord.y, true);
    this.dc.send(Data.buffer);
  }

  emitMouseWheel(delta, x, y) {
    let coord = this.normalizeAndQuantizeUnsigned(x, y);
    let Data = new DataView(new ArrayBuffer(7));
    Data.setUint8(0, toUE4type.MouseWheel);
    Data.setInt16(1, delta, true);
    Data.setUint16(3, coord.x, true);
    Data.setUint16(5, coord.y, true);
    this.dc.send(Data.buffer);
  }

  emitTouchData(type, touches, fingerIds) {
    let data = new DataView(new ArrayBuffer(2 + 6 * touches.length));
    data.setUint8(0, type);
    data.setUint8(1, touches.length);
    let byte = 2;
    for (let touch of touches) {
      let x = touch.clientX - this.video.offsetLeft;
      let y = touch.clientY - this.video.offsetTop;

      let coord = this.normalizeAndQuantizeUnsigned(x, y);
      data.setUint16(byte, coord.x, true);
      byte += 2;
      data.setUint16(byte, coord.y, true);
      byte += 2;
      data.setUint8(byte, fingerIds[touch.identifier], true);
      byte += 1;
      data.setUint8(byte, 255 * touch.force, true); // force is between 0.0 and 1.0 so quantize into byte.
      byte += 1;
    }
    this.dc.send(data.buffer);
  }

  emitDescriptor(descriptor, messageType = toUE4type.UIInteraction) {
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
    for (let char of descriptorAsString) {
      // charCodeAt() is UTF-16, codePointAt() is Unicode.
      data.setUint16(byteIdx, char.charCodeAt(0), true);
      byteIdx += 2;
    }
    this.dc.send(data.buffer);
  }

  normalizeAndQuantizeUnsigned(x, y) {
    let normalizedX = x / this.video.clientWidth;
    let normalizedY = y / this.video.clientHeight;
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
  }
};

// export default PixelStream;
