document.body.onload = () => {
  //  document.querySelector("[is=pixel-stream]");

  ps.addEventListener("message", (e) => {
    console.log("Data Channel:", e.detail);
  });

  ps.addEventListener("open", (e) => {
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

const statsDiv = document.getElementById("stats");
const logsWrapper = document.getElementById("logs");

console.info = (...text) => {
  console.log(...text);
  // show log top left, disappear after timeout

  const log = document.createElement("pre");
  log.innerHTML = text
    .map((x) => JSON.stringify(x, undefined, "\t").replace(/"|,|{|}/g, ""))
    .join(" ");
  logsWrapper.appendChild(log);
  setTimeout(() => {
    logsWrapper.removeChild(log);
  }, 3000);
};

let lastTransport = {};
function onAggregatedStats(stats, VideoEncoderQP) {
  let f = new Intl.NumberFormat(navigator.language, {
    // 小数位
    maximumFractionDigits: 0,
  });

  let statsText = "";

  if (VideoEncoderQP > 35) {
    statsDiv.style.color = "red";
    statsText += `<div>Bad network connection</div>`;
  } else if (VideoEncoderQP > 26) {
    statsDiv.style.color = "orange";
    statsText += `<div>Spotty network connection</div>`;
  } else {
    statsDiv.style.color = "lime";
  }

  stats.forEach((stat) => {
    if (stat.type === "data-channel") {
      statsText += `<div>DataChannel —> ${f.format(stat.bytesSent)} B</div>`;
      statsText += `<div>DataChannel <— ${f.format(
        stat.bytesReceived
      )} B</div>`;
    } else if (stat.type === "inbound-rtp" && stat.mediaType === "video") {
      statsText += `
        <div>Resolution: ${stat.frameWidth + " x " + stat.frameHeight}</div>
        <div>Frames Decoded: ${f.format(stat.framesDecoded)}</div>
        <div>Packets Lost: ${f.format(stat.packetsLost)}</div>
        <div>FPS: ${stat.framesPerSecond}</div>
        <div>Frames dropped: ${f.format(stat.framesDropped)}</div>
        <div>Video <— ${f.format(stat.bytesReceived / 1024)} KB</div>`;
    } else if (stat.type === "inbound-rtp" && stat.mediaType === "audio") {
      statsText += `<div>Audio <— ${f.format(
        stat.bytesReceived / 1024
      )} KB</div>`;
    } else if (stat.type === "candidate-pair" && stat.state === "succeeded") {
      statsText += `<div>Latency(RTT): ${f.format(
        stat.currentRoundTripTime * 1000
      )} ms</div>`;
    } else if (stat.type === "remote-candidate") {
      statsText += `<div>${
        stat.protocol + "://" + stat.ip + ":" + stat.port
      }</div>`;
    } else if (stat.type === "transport") {
      const bitrate =
        ((stat.bytesReceived - lastTransport.bytesReceived) /
          (stat.timestamp - lastTransport.timestamp)) *
        ((1000 * 8) / 1024);

      statsText += `<div>bitrate: ${f.format(bitrate)} kbps </div>`;

      lastTransport = stat;
    }
  });

  statsText += `<div>Video Quantization Parameter: ${VideoEncoderQP}</div>	`;

  statsDiv.innerHTML = statsText;
}
