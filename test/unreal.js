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
  let pc = players[playerId];
  delete msg[playerId];

  if (msg.type === "offer") {
    pc?.close();

    pc = players[playerId] = new RTCPeerConnection();

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
    setTimeout(setupSignal, 1000);
    h1.textContent = "Unreal Engine Simulator";
  };
  ws.onmessage = onSignalMessage;
  ws.onopen = (e) => {
    console.info("connected to", ws.url);
    h1.textContent = ws.url;
  };
  ws.onerror = (e) => {};
}

// https://codepen.io/tmrDevelops
function setupCanvas() {
  const $ = canvas.getContext("2d");
  const { width, height } = canvas;
  const w = width / 2;
  const h = height / 2;

  $.strokeStyle = "white";
  $.lineWidth = 1;

  (function frame(time) {
    $.clearRect(0, 0, width, height);
    $.beginPath();
    for (let x = 0; x < Math.min(w, h); x++) {
      const y = x * Math.sin(time / 512 - x / 40);
      const direction = [-x, y, x, -y];
      $.lineTo(w - direction[x % 4], h + direction[(x + 1) % 4]);
    }
    $.stroke();

    window.animationFrame = requestAnimationFrame(frame);
  })();

  return canvas.captureStream();
}
