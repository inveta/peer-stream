document.body.onload = () => {
  window.ps = new PixelStream(`ws://${location.hostname}:88/insigma`);
  // window.ps = new PixelStream("ws://localhost:88/insigma");

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

// 打印玩家数量
// ps.debug('Object.keys(players).length')
// 查看选定的candidate
// (await ps.pc.getStats(null)).forEach(x=>x.type==='remote-candidate'&&console.log(x))

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

let lastTransport = {};
function onAggregatedStats(stats, VideoEncoderQP) {
  let dataChannel = {};
  let video = {};
  let audio = {};
  let candidate = {};
  let remote = {};
  let thisTransport = {};
  stats.forEach((stat) => {
    if (stat.type === "data-channel") {
      dataChannel = stat;
    } else if (stat.type === "inbound-rtp" && stat.mediaType === "video") {
      video = stat;
    } else if (stat.type === "inbound-rtp" && stat.mediaType === "audio") {
      audio = stat;
    } else if (stat.type === "candidate-pair" && stat.state === "succeeded") {
      candidate = stat;
      candidate.availableBitrate =
        candidate.availableIncomingBitrate ||
        candidate.availableOutgoingBitrate;
    } else if (stat.type === "remote-candidate") {
      remote = stat;
    } else if (stat.type === "transport") {
      thisTransport = stat;
    }
  });

  let formatter = new Intl.NumberFormat(navigator.language, {
    // 小数位
    maximumFractionDigits: 0,
  });

  let statsText = "";

  let color = "lime";
  if (VideoEncoderQP > 35) {
    color = "red";
    statsText += `<div style="color: ${color}">Bad network connection</div>`;
  } else if (VideoEncoderQP > 26) {
    color = "orange";
    statsText += `<div style="color: ${color}">Spotty network connection</div>`;
  }

  const bitrate =
    ((thisTransport.bytesReceived - lastTransport.bytesReceived) /
      (thisTransport.timestamp - lastTransport.timestamp)) *
    ((1000 * 8) / 1024);
  qualityStatus.style.color = color;
  statsText += `
 			<div>${remote.protocol + "://" + remote.ip + ":" + remote.port}</div>
 			<div>Resolution: ${video.frameWidth + " x " + video.frameHeight}</div>
			<div>Video <— ${formatter.format(video.bytesReceived / 1024)} KB</div>
			<div>Audio <— ${formatter.format(audio.bytesReceived / 1024)} KB</div>
			<div>Frames Decoded: ${formatter.format(video.framesDecoded)}</div>
			<div>Packets Lost: ${formatter.format(video.packetsLost)}</div>
			<div style="color: ${color}">bitrate: ${formatter.format(bitrate)} kbps </div>
			<div>FPS: ${video.framesPerSecond}</div>
			<div>Frames dropped: ${formatter.format(video.framesDropped)}</div>
			<div>Latency: ${formatter.format(
        candidate.currentRoundTripTime * 1000
      )} ms</div>
      <div>DataChannel —> ${formatter.format(dataChannel.bytesSent)} B</div>
      <div>DataChannel <— ${formatter.format(dataChannel.bytesReceived)} B</div>
			<div style="color: ${color}">Video Quantization Parameter: ${VideoEncoderQP}</div>	`;

  statsDiv.innerHTML = statsText;

  lastTransport = thisTransport;
}
