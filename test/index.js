document.body.onload = () => {
  window.ps = new PixelStream("ws://localhost");
  // window.ps = new PixelStream("ws://10.0.42.16");

  ps.registerKeyboardEvents();
  ps.registerMouseHoverEvents();
  ps.registerFakeMouseEvents();
  //  registerTouchEvents();

  ps.addEventListener("message", (e) => {
    console.log("Data Channel:", e.detail);
  });

  ps.addEventListener("open", (e) => {
    document.body.appendChild(ps.video);
    ps.statTimer = setInterval(async () => {
      // 打印监控数据
      const stat = await ps.getStats();
      if (stat) onAggregatedStats(stat, ps.VideoEncoderQP);
    }, 1000);
  });

  ps.addEventListener("close", (e) => {
    clearInterval(ps.statTimer);
  });
};

// 以下内容可移除

// 打印玩家数量
// ps.debug('playerSockets.size')

const statsDiv = document.getElementById("stats");
const logsWrapper = document.getElementById("logs");
const qualityStatus = document.getElementById("qualityStatus");

console.info = (...text) => {
  console.log(...text);
  // show log top left, disappear after timeout

  const log = document.createElement("div");
  log.innerHTML = text.join(" ");
  logsWrapper.appendChild(log);
  setTimeout(() => {
    logsWrapper.removeChild(log);
  }, 2000);
};

function onAggregatedStats(stat, VideoEncoderQP) {
  let formatter = new Intl.NumberFormat(window.navigator.language, {
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
 			<div>Resolution: ${stat.frameWidth + "x" + stat.frameHeight}</div>
			<div>Video Received: ${formatter.format(stat.bytesReceived)} bytes</div>
			<div>Frames Decoded: ${formatter.format(stat.framesDecoded)}</div>
			<div>Packets Lost: ${formatter.format(stat.packetsLost)}</div>
			<div style="color: ${color}">kbps: ${formatter.format(stat.bitrate)}</div>
			<div>fps: ${formatter.format(stat.framesPerSecond)}</div>
			<div>Frames dropped: ${formatter.format(stat.framesDropped)}</div>
			<div>Latency: ${formatter.format(stat.currentRoundTripTime * 1000)} ms</div>
      <div>DataChannel —> ${stat.dataChannel.bytesSent} bytes</div>
      <div>DataChannel <— ${stat.dataChannel.bytesReceived} bytes</div>
			<div style="color: ${color}">Video Quantization Parameter: ${VideoEncoderQP}</div>	`;

  statsDiv.innerHTML = statsText;
}
