document.body.onload = () => {
  //  document.querySelector("[is=pixel-stream]");

  ps.addEventListener("message", (e) => {});

  ps.addEventListener("open", (e) => {
    clearInterval(ps.statTimer);
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

const statsWrapper = document.getElementById("stats");
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
    statsWrapper.style.color = "red";
    statsText += `\n Bad network connection 🤪`;
  } else if (VideoEncoderQP > 26) {
    statsWrapper.style.color = "orange";
    statsText += `\n Spotty network connection 😂`;
  } else {
    statsWrapper.style.color = "lime";
  }

  stats.forEach((stat) => {
    switch (stat.type) {
      case "data-channel": {
        statsText += `\n DataChannel —> ${f.format(stat.bytesSent)} B`;
        statsText += `\n DataChannel <— ${f.format(stat.bytesReceived)} B`;
        break;
      }
      case "inbound-rtp": {
        if (stat.mediaType === "video")
          statsText += `
      Resolution: ${stat.frameWidth + " x " + stat.frameHeight}
      Frames Decoded: ${f.format(stat.framesDecoded)}
      Packets Lost: ${f.format(stat.packetsLost)}
      FPS: ${stat.framesPerSecond}
      Frames dropped: ${f.format(stat.framesDropped)}
      Video <— ${f.format(stat.bytesReceived / 1024)} KB`;
        else if (stat.mediaType === "audio")
          statsText += `\n Audio <— ${f.format(stat.bytesReceived / 1024)} KB`;
        break;
      }
      case "candidate-pair": {
        if (stat.state === "succeeded")
          statsText += `\n Latency(RTT): ${f.format(
            stat.currentRoundTripTime * 1000
          )} ms`;
        break;
      }
      case "remote-candidate": {
        statsText += `\n ${stat.protocol + "://" + stat.ip + ":" + stat.port}`;
        break;
      }
      case "transport": {
        const bitrate =
          ((stat.bytesReceived - lastTransport.bytesReceived) /
            (stat.timestamp - lastTransport.timestamp)) *
          ((1000 * 8) / 1024);

        statsText += `\n bitrate: ${f.format(bitrate)} kbps `;

        lastTransport = stat;
        break;
      }
      default: {
      }
    }
  });

  statsText += `\n Video Quantization Parameter: ${VideoEncoderQP}`;

  statsWrapper.innerHTML = statsText;
}
