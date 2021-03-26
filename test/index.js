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
      const stats = await ps.pc.getStats(null);
      if (stats) onAggregatedStats(stats, ps.VideoEncoderQP);
    }, 1000);
  });

  ps.addEventListener("close", (e) => {
    clearInterval(ps.statTimer);
  });
};

// 以下内容可移除

// 打印玩家数量
// ps.debug('Object.keys(playerSockets).length')

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

function onAggregatedStats(stats, VideoEncoderQP) {
  let dataChannel;
  let video;
  let audio;
  let candidatePair;
  stats.forEach((stat) => {
    if (stat.type === "data-channel") {
      dataChannel = stat;
    } else if (stat.type === "inbound-rtp" && stat.mediaType === "video") {
      video = stat;
    } else if (stat.type === "inbound-rtp" && stat.mediaType === "audio") {
      audio = stat;
    } else if (stat.type === "candidate-pair") {
      candidatePair = stat;
    }
  });

  let formatter = new Intl.NumberFormat(navigator.language, {
    // 小数位
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
 			<div>Resolution: ${video.frameWidth + "x" + video.frameHeight}</div>
			<div>Video <— ${formatter.format(video.bytesReceived / 1024)} KB</div>
			<div>Audio <— ${formatter.format(audio.bytesReceived / 1024)} KB</div>
			<div>Frames Decoded: ${formatter.format(video.framesDecoded)}</div>
			<div>Packets Lost: ${formatter.format(video.packetsLost)}</div>
			<div style="color: ${color}">max bitrate: ${formatter.format(
    candidatePair.availableIncomingBitrate
  )}  </div>
			<div>FPS: ${video.framesPerSecond}</div>
			<div>Frames dropped: ${formatter.format(video.framesDropped)}</div>
			<div>Latency: ${formatter.format(
        candidatePair.currentRoundTripTime * 1000
      )} ms</div>
      <div>DataChannel —> ${formatter.format(dataChannel.bytesSent)} B</div>
      <div>DataChannel <— ${formatter.format(dataChannel.bytesReceived)} B</div>
			<div style="color: ${color}">Video Quantization Parameter: ${VideoEncoderQP}</div>	`;

  statsDiv.innerHTML = statsText;
}
