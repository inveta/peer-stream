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
      if (!e.candidate?.candidate) return;
      console.log("sending candidate to", playerId, e.candidate);
      ws.send(
        JSON.stringify({
          type: "iceCandidate",
          candidate: e.candidate,
          playerId,
        })
      );
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

function setupCanvas() {
  const $ = canvas.getContext("2d");
  const l = Math.min(canvas.width, canvas.height) / 2;

  $.strokeStyle = `hsl(${360 * Math.random()}deg 100% 50%)`;
  $.lineWidth = 6;

  $.beginPath();
  $.arc(l, l, l, 0, Math.PI * 2);
  $.clip();

  (function frame(time) {
    $.clearRect(-l, -l, l * 2, l * 2);

    for (let x = 1; x <= l; x += $.lineWidth + 2) {
      $.strokeRect(-x, -x, x * 2, x * 2);
      const theta = Math.sin(x / l - time / 512) * 60;
      $.setTransform(new DOMMatrix().translate(l, l).rotate(0, 0, theta));
    }

    window.animationFrame = requestAnimationFrame(frame);
  })(0);

  return canvas.captureStream();
}
