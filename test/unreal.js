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
  // https://codepen.io/tmrDevelops/details/XXWyNd
  const $ = canvas.getContext("2d");
  let t = 0;

  $.fillStyle = "white";
  $.strokeStyle = "black";
  $.lineWidth = 0.3;

  (function frame() {
    $.fillRect(0, 0, canvas.width, canvas.height);
    let x = 0;
    $.beginPath();
    for (let j = 0; j < 350; j++) {
      x += 0.55 * Math.sin(15);
      const y = x * Math.sin(3.0 * t + x / 60) * 2;
      const b = (j * 2 * Math.PI) / 2.99;
      const _x = x * Math.cos(b) - y * Math.sin(b);
      const _y = x * Math.sin(b) + y * Math.cos(b);
      $.lineTo(canvas.width / 2 - _x, canvas.height / 2 - _y);
    }
    $.stroke();

    t += 1 / 60;
    requestAnimationFrame(frame);
  })();

  return canvas.captureStream();
}
