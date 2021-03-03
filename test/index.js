const statsDiv = document.getElementById("stats");
const logsWrapper = document.getElementById("logs");
const overlay = document.getElementById("overlay");
const qualityStatus = document.getElementById("qualityStatus");

console.info = (...text) => {
  console.log(...text);
  // show log top left, disappear after timeout

  const log = document.createElement("div");
  log.innerHTML = text;
  logsWrapper.appendChild(log);
  setTimeout(() => {
    logsWrapper.removeChild(log);
  }, 2000);
};

function onExpandOverlay_Click(/* e */) {
  overlay.classList.toggle("overlay-shown");
}

function onAggregatedStats(reducedStat, VideoEncoderQP) {
  let numberFormat = new Intl.NumberFormat(window.navigator.language, {
    maximumFractionDigits: 0,
  });

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

  qualityStatus.style.color = color;

  statsText += `
 			<div>Resolution: ${
        reducedStat.frameWidth + "x" + reducedStat.frameHeight
      }</div>
			<div>Video Received: ${numberFormat.format(
        reducedStat.bytesReceived
      )} bytes</div>
			<div>Frames Decoded: ${numberFormat.format(reducedStat.framesDecoded)}</div>
			<div>Packets Lost: ${numberFormat.format(reducedStat.packetsLost)}</div>
			<div style="color: ${color}">Bitrate (kbps): ${reducedStat.bitrate}</div>
			<div>FPS: ${numberFormat.format(reducedStat.framesPerSecond)}</div>
			<div>Frames dropped: ${numberFormat.format(reducedStat.framesDropped)}</div>
			<div>Latency (ms): ${numberFormat.format(
        reducedStat.currentRoundTripTime * 1000
      )}</div>
      <div>DataChannel —> ${reducedStat.dataChannel.bytesSent} bytes</div>
      <div>DataChannel <— ${reducedStat.dataChannel.bytesReceived} bytes</div>
			<div style="color: ${color}">Video Quantization Parameter: ${VideoEncoderQP}</div>	`;

  statsDiv.innerHTML = statsText;
}

document.body.onload = () => {
  // window.ps = new PixelStream("ws://localhost");
  window.ps = new PixelStream("ws://10.0.42.16");

  //  registerTouchEvents( );
  ps.registerFakeMouseEvents();
  ps.registerKeyboardEvents();
  ps.registerMouseHoverEvents();

  ps.addEventListener("message", (e) => {
    console.log("Data Channel:", e.detail);
  });

  ps.addEventListener("open", (e) => {
    document.body.appendChild(ps.video);
    // ps.video.play()

    ps.statTimer = setInterval(async () => {
      const stat = await ps.getStats();
      if (stat) onAggregatedStats(stat, ps.VideoEncoderQP);
    }, 1000);
  });

  ps.addEventListener("close", (e) => {
    clearInterval(ps.statTimer);
  });
};
