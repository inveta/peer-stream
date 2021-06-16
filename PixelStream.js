/*
 *  https://xosg.github.io/PixelStreamer/PixelStream.js
 *  2021/5/31 @xosg
 */

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

class PixelStream extends HTMLVideoElement {
  constructor(...params) {
    super(...params);

    window.ps = this;
    this.VideoEncoderQP = NaN;

    this.ws = undefined; // WebSocket
    this.pc = new RTCPeerConnection({});
    this.dc = null; // RTCDataChannel

    this.setupVideo();
    this.registerKeyboardEvents();
    this.registerMouseHoverEvents();
    this.registerFakeMouseEvents();

    document.addEventListener(
      "pointerlockchange",
      () => {
        if (document.pointerLockElement === this) {
          this.registerPointerlockEvents();
        } else {
          this.registerMouseHoverEvents();
        }
      },
      false
    );
  }

  connectedCallback() {
    // This will happen each time the node is moved, and may happen before the element's contents have been fully parsed. may be called once your element is no longer connected
    if (!this.isConnected) return;

    const signal =
      this.getAttribute("signal") ||
      `ws://${location.hostname || "localhost"}:88/insigma`;

    if (this.ws) this.ws.close(1000, "forever");
    this.ws = new WebSocket(signal);

    this.ws.onerror = (e) => {
      console.warn(e);
    };

    this.ws.onopen = async (e) => {
      console.info("connected to", this.ws.url);
      await this.setupOffer();
    };

    this.ws.onmessage = (e) => {
      this.onWebSocketMessage(e.data);
    };

    this.ws.onclose = (e) => {
      this.pc.close();
      // this.dc.close();
      console.info("WebSocket & WebRTC closed.", e.reason || "");

      // 3s后重连
      if (e.reason === "forever") return;
      setTimeout(() => {
        this.connectedCallback();
      }, 3000);
    };
  }

  disconnectedCallback() {
    // 永久关闭，不再重连
    this.ws.close(1000, "forever");
  }

  adoptedCallback() {}

  attributeChangedCallback(name, oldValue, newValue) {}
  static get observedAttributes() {
    return [];
  }

  async onWebSocketMessage(msg) {
    try {
      msg = JSON.parse(msg);
    } catch {
      console.error("signalling server:", msg);
      return;
    }

    if (msg.type === "answer") {
      console.log("received answer", msg);
      let answerDesc = new RTCSessionDescription(msg);
      await this.pc.setRemoteDescription(answerDesc);
    } else if (msg.type === "iceCandidate") {
      let candidate = new RTCIceCandidate(msg.candidate);
      // this.remoteCandidate = candidate;
      await this.pc.addIceCandidate(candidate);
      console.log("received candidate", msg.candidate);
    } else {
      console.warn(this.ws.url, msg);
    }
  }

  onDataChannelMessage(data) {
    let view = new Uint8Array(data);
    if (view[0] === toPlayerType.VideoEncoderAvgQP) {
      this.VideoEncoderQP = +new TextDecoder("utf-16").decode(data.slice(1));
      console.log("received Video Encoder Average QP", this.VideoEncoderQP);
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
      console.error("invalid data type:", view[0]);
    }
  }

  setupVideo() {
    this.tabIndex = 0; // easy to focus..
    this.addEventListener("playing", (e) => {
      this.focus();
    });
    this.playsInline = true;

    // Recently many browsers can only autoplay the videos with sound off
    this.muted = true;
    this.autoplay = true;

    this.poster = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' version='1.1'><text x='20' y='40' fill='red' font-size='30'>Loading</text></svg>`;

    // this.onsuspend
    // this.onresize
    // this.requestPointerLock();

    this.style = `
        background-color: #222;
        margin: auto;
        display: none;
        object-fit: fill; `;
  }

  setupDataChannel(label = "insigma") {
    this.dc = this.pc.createDataChannel(label, { ordered: true });

    this.dc.onopen = (e) => {
      console.log("data channel connected:", label);
      this.style.display = "block";
      this.dispatchEvent(new CustomEvent("open"));
    };

    this.dc.onclose = (e) => {
      console.log("data channel closed:", label);
      this.style.display = "none";
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
      this.srcObject = e.streams[0];
    };
    this.pc.onicecandidate = (e) => {
      if (e.candidate && e.candidate.candidate) {
        console.log("sending candidate:", e.candidate);
        this.ws.send(
          JSON.stringify({ type: "iceCandidate", candidate: e.candidate })
        );
      }
    };
  }

  async setupOffer() {
    this.pc.close();

    this.pc = new RTCPeerConnection({
      //If this is true in Chrome 89+ SDP is sent that is incompatible with UE WebRTC and breaks.
      offerExtmapAllowMixed: false,
      sdpSemantics: "unified-plan",
      // iceServers: [
      //   {
      //     urls: [
      //       "stun:stun.l.google.com:19302",
      //       "stun:stun1.l.google.com:19302",
      //       "stun:stun2.l.google.com:19302",
      //       "stun:stun3.l.google.com:19302",
      //       "stun:stun4.l.google.com:19302",
      //     ],
      //   },
      // ],
    });

    this.setupPeerConnection();
    this.setupDataChannel();
    const offer = await this.pc.createOffer({
      // 我们的场景不需要音频
      offerToReceiveAudio: this.muted ? 0 : 1,
      offerToReceiveVideo: 1,
    });

    offer.sdp = offer.sdp.replace(
      "useinbandfec=1",
      "useinbandfec=1;stereo=1;maxaveragebitrate=128000"
    );

    this.pc.setLocalDescription(offer);
    // increase start bitrate from 300 kbps to 20 mbps and max bitrate from 2.5 mbps to 100 mbps
    // (100 mbps means we don't restrict encoder at all)
    // after we "setLocalDescription" because other browsers are not c happy to see google-specific config
    offer.sdp = offer.sdp.replace(
      /(a=fmtp:\d+ .*level-asymmetry-allowed=.*)\r\n/gm,
      "$1;x-google-start-bitrate=10000;x-google-max-bitrate=20000\r\n"
    );

    // if (this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(JSON.stringify(offer));
    console.log("sending offer:", offer);
  }

  registerKeyboardEvents() {
    this.onkeydown = (e) => {
      this.dc.send(
        new Uint8Array([
          toUE4type.KeyDown,
          SpecialKeyCodes[e.code] || e.keyCode,
          e.repeat,
        ]).buffer
      );
      // whether to prevent browser's default behavior when keyboard/mouse have inputs, like F1~F12 and Tab
      e.preventDefault();
      //  e.stopPropagation
    };

    this.onkeyup = (e) => {
      this.dc.send(
        new Uint8Array([toUE4type.KeyUp, SpecialKeyCodes[e.code] || e.keyCode])
          .buffer
      );
      e.preventDefault();
    };

    this.onkeypress = (e) => {
      let data = new DataView(new ArrayBuffer(3));
      data.setUint8(0, toUE4type.KeyPress);
      data.setUint16(1, SpecialKeyCodes[e.code] || e.keyCode, true);
      this.dc.send(data.buffer);
      e.preventDefault();
    };
  }

  registerTouchEvents() {
    // We need to assign a unique identifier to each finger.
    // We do this by mapping each Touch object to the identifier.
    let fingers = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
    let fingerIds = {};

    this.ontouchstart = (e) => {
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
      e.preventDefault();
    };

    this.ontouchend = (e) => {
      this.emitTouchData(toUE4type.TouchEnd, e.changedTouches, fingerIds);
      // Re-cycle unique identifiers previously assigned to each touch.
      for (let touch of e.changedTouches) {
        // forget touch
        fingers.push(fingerIds[touch.identifier]);
        delete fingerIds[touch.identifier];
      }
      e.preventDefault();
    };

    this.ontouchmove = (e) => {
      this.emitTouchData(toUE4type.TouchMove, e.touches, fingerIds);
      e.preventDefault();
    };
  }

  // 触屏模拟鼠标
  registerFakeMouseEvents() {
    let finger = undefined;

    const boundingRect = this.getBoundingClientRect();

    this.ontouchstart = (e) => {
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
        this.onmouseenter(e);
        this.emitMouseDown(MouseButton.MainButton, finger.x, finger.y);
      }
      e.preventDefault();
    };

    this.ontouchend = (e) => {
      for (let touch of e.changedTouches) {
        if (touch.identifier === finger.id) {
          let x = touch.clientX - boundingRect.left;
          let y = touch.clientY - boundingRect.top;
          this.emitMouseUp(MouseButton.MainButton, x, y);
          // Hack: Manual mouse leave event.
          this.onmouseleave(e);
          finger = undefined;
          break;
        }
      }
      e.preventDefault();
    };

    this.ontouchmove = (e) => {
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
      e.preventDefault();
    };
  }

  registerMouseHoverEvents() {
    this.registerMouseEnterAndLeaveEvents();

    this.onmousemove = (e) => {
      this.emitMouseMove(e.offsetX, e.offsetY, e.movementX, e.movementY);
      e.preventDefault();
    };

    this.onmousedown = (e) => {
      this.emitMouseDown(e.button, e.offsetX, e.offsetY);
      // e.preventDefault();
    };

    this.onmouseup = (e) => {
      this.emitMouseUp(e.button, e.offsetX, e.offsetY);
      // e.preventDefault();
    };

    // When the context menu is shown then it is safest to release the button
    // which was pressed when the event happened. This will guarantee we will
    // get at least one mouse up corresponding to a mouse down event. Otherwise
    // the mouse can get stuck.
    // https://github.com/facebook/react/issues/5531
    this.oncontextmenu = (e) => {
      this.emitMouseUp(e.button, e.offsetX, e.offsetY);
      e.preventDefault();
    };

    this.onmousewheel = (e) => {
      this.emitMouseWheel(e.wheelDelta, e.offsetX, e.offsetY);
      e.preventDefault();
    };
  }

  registerPointerlockEvents() {
    this.registerMouseEnterAndLeaveEvents();

    console.info("mouse locked in, ESC to exit");

    const { clientWidth, clientHeight } = this;
    let x = clientWidth / 2;
    let y = clientHeight / 2;

    this.onmousemove = (e) => {
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

    this.onmousedown = (e) => {
      this.emitMouseDown(e.button, x, y);
    };

    this.onmouseup = (e) => {
      this.emitMouseUp(e.button, x, y);
    };

    this.onmousewheel = (e) => {
      this.emitMouseWheel(e.wheelDelta, x, y);
    };
  }

  registerMouseEnterAndLeaveEvents() {
    this.onmouseenter = (e) => {
      let Data = new DataView(new ArrayBuffer(1));
      Data.setUint8(0, toUE4type.MouseEnter);
      this.dc.send(Data.buffer);
    };

    this.onmouseleave = (e) => {
      let Data = new DataView(new ArrayBuffer(1));
      Data.setUint8(0, toUE4type.MouseLeave);
      if (this.dc.readyState === "open") this.dc.send(Data.buffer);
    };
  }

  emitMouseMove(x, y, deltaX, deltaY) {
    let coord = this.normalizeAndQuantizeUnsigned(x, y);
    deltaX = (deltaX * 65536) / this.clientWidth;
    deltaY = (deltaY * 65536) / this.clientHeight;
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
      let x = touch.clientX - this.offsetLeft;
      let y = touch.clientY - this.offsetTop;

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
    let normalizedX = x / this.clientWidth;
    let normalizedY = y / this.clientHeight;
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

  debug(nodeJS) {
    // 调试信令服务器
    this.ws.send(JSON.stringify({ type: "debug", debug: nodeJS }));
  }
}

customElements.define("pixel-stream", PixelStream, { extends: "video" });
