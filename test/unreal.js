window.players = {};
setInterval(() => {
  stats.innerHTML = "";
  for (const id in players) {
    const pc = players[id];
    stats.innerHTML += `\n ${id} ${pc.connectionState}  `;
  }
}, 1000);

navigator.mediaDevices
  .getUserMedia({
    audio: false,
    video: true,
  })
  .then((stream) => {
    window.stream = stream;
    video.srcObject = stream;
  })
  .catch((error) => {
    window.stream = setupCanvas();
    console.warn("camera error:", error);
  })
  .finally(() => {
    setupSignal();
    console.log("Unreal Simulator is running!");
  });

async function onSignalMessage(msg) {
  try {
    msg = JSON.parse(msg.data);
  } catch (err) {
    console.error("cannot JSON.parse message:", msg);
    return;
  }

  const playerId = String(msg.playerId);
  const pc = players[playerId];
  delete msg[playerId];

  if (msg.type === "offer") {
    players[playerId]?.close();

    const pc = (players[playerId] = new RTCPeerConnection());

    pc.onicecandidate = (e) => {
      if (e.candidate?.candidate) {
        console.log("sending candidate to", playerId, e.candidate);
        ws.send(
          JSON.stringify({
            type: "iceCandidate",
            candidate: e.candidate,
            playerId,
          })
        );
      }
    };

    // 不能放在后面
    stream.getVideoTracks().forEach((track) => pc.addTrack(track, stream));

    const offer = new RTCSessionDescription(msg);
    console.log("Got offer from", playerId, offer);
    await pc.setRemoteDescription(offer);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    ws.send(JSON.stringify({ playerId, ...answer.toJSON() }));
    console.log("sending answer to", playerId, answer);
  } else if (msg.type === "iceCandidate") {
    if (!pc) {
      console.error("player", playerId, "not found");
      return;
    }

    const candidate = new RTCIceCandidate(msg.candidate);
    await pc.addIceCandidate(candidate);
    console.log("Got candidate from", playerId, candidate);
  } else {
    console.log("Got", msg);
  }
}

function setupSignal() {
  window.ws = new WebSocket("ws://localhost:8888");
  ws.onclose = (e) => {
    setTimeout(setupSignal, 500);
  };
  ws.onmessage = onSignalMessage;
  ws.onopen = (e) => {
    console.info("connected to", ws.url);
  };
  ws.onerror = (e) => {};
}

function setupCanvas() {
  // https://codepen.io/tmrDevelops
  const $ = canvas.getContext("2d");
  const { width, height } = canvas;
  let t = 0;

  $.fillStyle = "black";
  $.strokeStyle = "white";
  $.lineWidth = 0.3;

  (function frame() {
    $.fillRect(0, 0, width, height);
    let x = 0;
    $.beginPath();
    // 大小
    for (let j = 0; j < Math.min(width, height); j++) {
      x -= 0.4 * Math.sin(7);
      const y = x * Math.sin(t + x / 20);
      const b = [x, -y, -x, y];
      $.lineTo(width / 2 - b[j % 4], height / 2 + b[(j + 1) % 4]);
    }
    $.stroke();

    // 速度
    t += 1 / 60;
    requestAnimationFrame(frame);
  })();

  return canvas.captureStream();
}
