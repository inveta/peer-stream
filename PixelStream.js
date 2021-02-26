
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
const ToClientMessageType = {
  QualityControlOwnership: 0,
  Response: 1,
  Command: 2,
  FreezeFrame: 3,
  UnfreezeFrame: 4,
  VideoEncoderAvgQP: 5,
};


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





window.PixelStream = class {
  constructor() {

    // whether to prevent browser's default behavior when keyboard/mouse have inputs, like F1~F12 and Tab
    this.preventDefault = true;
    this.VideoEncoderQP = "N/A";

    this.ws = undefined;  // WebSocket
    this.pcClient = new RTCPeerConnection({
      sdpSemantics: "unified-plan"
    });
    this.dcClient = null; // RTCDataChannel

    this.sdpConstraints = {
      offerToReceiveAudio: 1,
      offerToReceiveVideo: 1,
    };

    this.aggregatedStats = {};


    this.setupVideo();




    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement === self.video) {
        self.registerMouseLockEvents()
      } else {
        self.registerMouseHoverEvents()
      }
    }, false);

  }





  onDataChannelMessage(data) {
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
        console.info('You should setup a on-screen keyboard')
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
      this.VideoEncoderQP = new TextDecoder("utf-16").decode(data.slice(1));
      console.log(`received VideoEncoderAvgQP`, this.VideoEncoderQP);
    } else {
      console.error(`unrecognized data received, packet ID`, view[0]);
    }
  }



  setupVideo() {

    //Create Video element and expose that as a parameter
    this.video = document.createElement("video");
    this.video.tabIndex = 0 // easy to focus..
    this.video.playsInline = true;

    // Recently many browsers can only autoplay the videos with sound off
    this.video.muted = true;
    this.video.autoplay = true;

    // this.video.onsuspend 
    // this.video.onplaying  


    // double click: pointer lock mode
    this.video.ondblclick = e => {
      this.video.requestPointerLock();
    };

    // this.video.onresize 

    this.video.style = `
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' version='1.1' height='50px' width='200px'><text x='0' y='40' fill='white' font-size='30'> loading </text></svg>");
      background-repeat: no-repeat;
      background-position: center;
      background-color: #222;
      width: unset;
      height: unset;
      position: fixed;
      top: 50%;
      left: 50%;
      display: none;
      transform: translateX(-50%) translateY(-50%);
      object-fit: fill; `




  }

  setupDataChannel(label = 'hello world') {
    const self = this;

    this.dcClient = this.pcClient.createDataChannel(label, { ordered: true });
    console.log(`Created datachannel (${label})`);

    this.dcClient.onopen = (e) => {
      console.log(`data channel (${label}) connect, waiting for video`);
      this.video.style.display = 'block'
    };

    this.dcClient.onclose = (e) => {
      console.log(`data channel (${label}) closed`);
      this.video.style.display = 'none'
    };

    this.dcClient.onmessage = (e) => {
      self.onDataChannelMessage(e.data);
    };


  }


  setupPeerConnection() {

    this.pcClient.ontrack = (e) => {
      console.log("handleOnTrack", e.streams);
      this.video.srcObject = e.streams[0];
    };
    this.pcClient.onicecandidate = (e) => {
      if (e.candidate && e.candidate.candidate) {
        console.log(
          `got iceCandidate`, e.candidate
        );
        this.ws.send(JSON.stringify({ type: "iceCandidate", candidate: e.candidate }));
      }
    };

  }

  // fetch then reduce the stats array
  async fetchReduceStats() {
    const self = this;

    if (!self.pcClient) return
    const stats = await self.pcClient.getStats(null);

    let newStat = {};

    stats.forEach((stat) => {
      if (
        stat.type == "inbound-rtp" &&
        !stat.isRemote &&
        (stat.mediaType == "video" || stat.id.toLowerCase().includes("video"))
      ) {
        Object.assign(newStat, stat);


        if (self.aggregatedStats.timestamp) {
          if (self.aggregatedStats.bytesReceived) {
            // bitrate = bits received since last time / number of ms since last time
            //This is automatically in kbits (where k=1000) since time is in ms and stat we want is in seconds (so a '* 1000' then a '/ 1000' would negate each other)
            newStat.bitrate =
              (8 *
                (newStat.bytesReceived - self.aggregatedStats.bytesReceived)) /
              (newStat.timestamp - self.aggregatedStats.timestamp);
            newStat.bitrate = Math.floor(newStat.bitrate);
            newStat.lowBitrate = Math.min(
              self.aggregatedStats.lowBitrate || Infinity,
              newStat.bitrate
            );
            newStat.highBitrate = Math.max(
              self.aggregatedStats.highBitrate || -Infinity,
              newStat.bitrate
            );
          }

          if (self.aggregatedStats.framesDecoded) {
            // framerate = frames decoded since last time / number of seconds since last time

            newStat.lowFramerate = Math.min(
              self.aggregatedStats.lowFramerate || Infinity,
              newStat.framesPerSecond
            );
            newStat.highFramerate = Math.max(
              self.aggregatedStats.highFramerate || -Infinity,
              newStat.framesPerSecond
            );
          }


        }
      }

      //Read video track stats
      if (
        stat.type == "track" &&
        (stat.trackIdentifier == "video_label" || stat.kind == "video")
      ) {
        Object.assign(newStat, stat);

        newStat.framesDroppedPercentage =
          (stat.framesDropped / stat.framesReceived) * 100;
      }

      if (
        stat.type == "candidate-pair" &&
        stat.hasOwnProperty("currentRoundTripTime")
      ) {
        Object.assign(newStat, stat);
      }
    });

    self.aggregatedStats = newStat;
    return newStat;
  }

  //Called externaly to create an offer for the server
  async createOffer() {
    this.pcClient.close();

    this.pcClient = new RTCPeerConnection({
      sdpSemantics: "unified-plan"
    });

    this.setupPeerConnection();
    this.setupDataChannel();
    const offer = await this.pcClient.createOffer(this.sdpConstraints);

    this.pcClient.setLocalDescription(offer);
    // (andriy): increase start bitrate from 300 kbps to 20 mbps and max bitrate from 2.5 mbps to 100 mbps
    // (100 mbps means we don't restrict encoder at all)
    // after we `setLocalDescription` because other browsers are not c happy to see google-specific config
    offer.sdp = offer.sdp.replace(
      /(a=fmtp:\d+ .*level-asymmetry-allowed=.*)\r\n/gm,
      "$1;x-google-start-bitrate=10000;x-google-max-bitrate=20000\r\n"
    );
    let offerStr = JSON.stringify(offer);
    this.ws.send(offerStr);
    console.log(`offer sent:`, offer);
  }



  async connect(url = location.href.replace("http://", "ws://").replace("https://", "wss://")) {

    const self = this;

    return new Promise((resolve, reject) => {

      this.ws = new WebSocket(url);

      this.ws.onopen = resolve;
      this.ws.onerror = reject;

      this.ws.onmessage = async (event) => {
        var msg = JSON.parse(event.data);
        if (msg.type === "config") {

          console.info("Starting connection to UE4, please wait");
          self.createOffer();


        } else if (msg.type === "answer") {
          console.log(`Received answer`, msg);
          var answerDesc = new RTCSessionDescription(msg);
          self.pcClient.setRemoteDescription(answerDesc);

        } else if (msg.type === "iceCandidate") {

          let candidate = new RTCIceCandidate(msg.candidate);
          await this.pcClient.addIceCandidate(candidate);
          console.log("ICE candidate successfully added", msg.candidate);
        } else {
          console.error(`WS: invalid message type: ${msg.type}`);
        }
      };


      this.ws.onclose = (e) => {

        this.pcClient.close();


        console.info(`WS & WebRTC closed:`, e.reason || e.code);

        // 3s后重连
        setTimeout(() => {
          self.connect(url).catch(err => {
            console.warn(err, 'try again later')
          })
        }, 2000);
      }
    })

  }







  registerKeyboardEvents() {
    const self = this;

    self.video.onkeydown = function (e) {
      if (self.preventDefault) e.preventDefault();
      self.dcClient.send(
        new Uint8Array([MessageType.KeyDown, SpecialKeyCodes[e.code] || e.keyCode, e.repeat]).buffer
      );
      //  e.stopPropagation
    };

    self.video.onkeyup = function (e) {
      if (self.preventDefault) e.preventDefault();
      self.dcClient.send(new Uint8Array([MessageType.KeyUp, SpecialKeyCodes[e.code] || e.keyCode]).buffer);
    };

    self.video.onkeypress = function (e) {
      if (self.preventDefault) e.preventDefault();
      let data = new DataView(new ArrayBuffer(3));
      data.setUint8(0, MessageType.KeyPress);
      data.setUint16(1, SpecialKeyCodes[e.code] || e.keyCode, true);
      self.dcClient.send(data.buffer);
    };
  }



  registerTouchEvents() {
    const self = this;

    // We need to assign a unique identifier to each finger.
    // We do this by mapping each Touch object to the identifier.
    var fingers = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
    var fingerIds = {};

    function rememberTouch(touch) {
      let finger = fingers.pop();
      if (finger === undefined) {
        console.info("exhausted touch indentifiers");
      }
      fingerIds[touch.identifier] = finger;
    }

    function forgetTouch(touch) {
      fingers.push(fingerIds[touch.identifier]);
      delete fingerIds[touch.identifier];
    }

    self.video.ontouchstart = function (e) {
      // Assign a unique identifier to each touch.
      for (let t = 0; t < e.changedTouches.length; t++) {
        rememberTouch(e.changedTouches[t]);
      }
      self.emitTouchData(MessageType.TouchStart, e.changedTouches, fingerIds);
      if (self.preventDefault) e.preventDefault();
    };

    self.video.ontouchend = function (e) {
      self.emitTouchData(MessageType.TouchEnd, e.changedTouches, fingerIds);
      // Re-cycle unique identifiers previously assigned to each touch.
      for (let t = 0; t < e.changedTouches.length; t++) {
        forgetTouch(e.changedTouches[t]);
      }
      if (self.preventDefault) e.preventDefault();
    };

    self.video.ontouchmove = function (e) {
      self.emitTouchData(MessageType.TouchMove, e.touches, fingerIds);
      if (self.preventDefault) e.preventDefault();
    };
  }








  // 触屏模拟鼠标
  registerFakeMouseEvents() {
    const self = this;

    var finger = undefined;

    const boundingRect = self.video.getBoundingClientRect()

    self.video.ontouchstart = function (e) {
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
        self.video.onmouseenter(e);
        self.emitMouseDown(MouseButton.MainButton, finger.x, finger.y);
      }
      if (self.preventDefault) e.preventDefault();
    };

    self.video.ontouchend = function (e) {
      for (let t = 0; t < e.changedTouches.length; t++) {
        let touch = e.changedTouches[t];
        if (touch.identifier === finger.id) {
          let x = touch.clientX - boundingRect.left;
          let y = touch.clientY - boundingRect.top;
          self.emitMouseUp(MouseButton.MainButton, x, y);
          // Hack: Manual mouse leave event.
          self.video.onmouseleave(e);
          finger = undefined;
          break;
        }
      }
      if (self.preventDefault) e.preventDefault();
    };

    self.video.ontouchmove = function (e) {
      for (let t = 0; t < e.touches.length; t++) {
        let touch = e.touches[t];
        if (touch.identifier === finger.id) {
          let x = touch.clientX - boundingRect.left;
          let y = touch.clientY - boundingRect.top;
          self.emitMouseMove(x, y, x - finger.x, y - finger.y);
          finger.x = x;
          finger.y = y;
          break;
        }
      }
      if (self.preventDefault) e.preventDefault();
    };
  }






  registerMouseHoverEvents() {
    const self = this;

    self.preventDefault = false


    self.video.onmousemove = (e) => {
      self.emitMouseMove(e.offsetX, e.offsetY, e.movementX, e.movementY);
      if (self.preventDefault) e.preventDefault();
    };

    self.video.onmousedown = (e) => {
      self.emitMouseDown(e.button, e.offsetX, e.offsetY);
      if (self.preventDefault) e.preventDefault();
    };

    self.video.onmouseup = (e) => {
      self.emitMouseUp(e.button, e.offsetX, e.offsetY);
      if (self.preventDefault) e.preventDefault();
    };

    // When the context menu is shown then it is safest to release the button
    // which was pressed when the event happened. This will guarantee we will
    // get at least one mouse up corresponding to a mouse down event. Otherwise
    // the mouse can get stuck.
    // https://github.com/facebook/react/issues/5531
    self.video.oncontextmenu = (e) => {
      self.emitMouseUp(e.button, e.offsetX, e.offsetY);
      if (self.preventDefault) e.preventDefault();
    };


    self.video.onmousewheel = (e) => {
      self.emitMouseWheel(e.wheelDelta, e.offsetX, e.offsetY);
      if (self.preventDefault) e.preventDefault();
    };
  }








  registerMouseLockEvents() {
    const self = this;

    self.preventDefault = true
    console.info('mouse locked in, ESC to exit')

    const { clientWidth, clientHeight } = self.video
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

    self.video.onmousemove = (e) => {
      updatePosition(e)
      self.emitMouseMove(x, y, e.movementX, e.movementY);
    };

    self.video.onmousedown = function (e) {
      self.emitMouseDown(e.button, x, y);
    };

    self.video.onmouseup = function (e) {
      self.emitMouseUp(e.button, x, y);
    };

    self.video.onmousewheel = function (e) {
      self.emitMouseWheel(e.wheelDelta, x, y);
    };

  }





  registerMouseEnterAndLeaveEvents() {
    const self = this;

    self.video.onmouseenter = function (e) {
      var Data = new DataView(new ArrayBuffer(1));
      Data.setUint8(0, MessageType.MouseEnter);
      self.dcClient.send(Data.buffer);
    };

    self.video.onmouseleave = function (e) {
      var Data = new DataView(new ArrayBuffer(1));
      Data.setUint8(0, MessageType.MouseLeave);
      self.dcClient.send(Data.buffer);
    };
  }









  emitMouseMove(x, y, deltaX, deltaY) {
    let coord = this.normalizeAndQuantizeUnsigned(x, y);
    deltaX = deltaX * 65536 / this.video.clientWidth
    deltaY = deltaY * 65536 / this.video.clientHeight
    var Data = new DataView(new ArrayBuffer(9));
    Data.setUint8(0, MessageType.MouseMove);
    Data.setUint16(1, coord.x, true);
    Data.setUint16(3, coord.y, true);
    Data.setInt16(5, deltaX, true);
    Data.setInt16(7, deltaY, true);
    this.dcClient.send(Data.buffer);
  }

  emitMouseDown(button, x, y) {

    let coord = this.normalizeAndQuantizeUnsigned(x, y);
    var Data = new DataView(new ArrayBuffer(6));
    Data.setUint8(0, MessageType.MouseDown);
    Data.setUint8(1, button);
    Data.setUint16(2, coord.x, true);
    Data.setUint16(4, coord.y, true);
    this.dcClient.send(Data.buffer);
  }

  emitMouseUp(button, x, y) {

    let coord = this.normalizeAndQuantizeUnsigned(x, y);
    var Data = new DataView(new ArrayBuffer(6));
    Data.setUint8(0, MessageType.MouseUp);
    Data.setUint8(1, button);
    Data.setUint16(2, coord.x, true);
    Data.setUint16(4, coord.y, true);
    this.dcClient.send(Data.buffer);
  }

  emitMouseWheel(delta, x, y) {

    let coord = this.normalizeAndQuantizeUnsigned(x, y);
    var Data = new DataView(new ArrayBuffer(7));
    Data.setUint8(0, MessageType.MouseWheel);
    Data.setInt16(1, delta, true);
    Data.setUint16(3, coord.x, true);
    Data.setUint16(5, coord.y, true);
    this.dcClient.send(Data.buffer);
  }





  emitTouchData(type, touches, fingerIds) {
    let data = new DataView(new ArrayBuffer(2 + 6 * touches.length));
    data.setUint8(0, type);
    data.setUint8(1, touches.length);
    let byte = 2;
    for (let t = 0; t < touches.length; t++) {
      let touch = touches[t];
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
    this.dcClient.send(data.buffer);
  }





  emitDescriptor(descriptor, messageType = MessageType.UIInteraction) {
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
    this.dcClient.send(data.buffer);
  }







  normalizeAndQuantizeUnsigned(x, y) {
    let normalizedX = x / this.video.clientWidth
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
  };;



};
