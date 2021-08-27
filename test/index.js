//  document.querySelector("[is=pixel-stream]");

ps.addEventListener("message", (e) => {});

ps.addEventListener("open", (e) => {
  clearInterval(ps.statTimer);
  ps.statTimer = setInterval(aggregateStats, 1000);
});

ps.addEventListener("close", (e) => {
  clearInterval(ps.statTimer);
});

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
  setTimeout(() => log.remove(), 3000);
};

Number.prototype.format = function () {
  const suffix = ["", "K", "M", "G"];
  let quotient = this;
  while (quotient > 9999) {
    quotient /= 1024;
    suffix.shift();
  }
  return ~~quotient + " " + suffix[0];
};

let lastTransport = {};
async function aggregateStats() {
  const stats = await ps.pc.getStats(null);

  let statsText = "";

  if (ps.VideoEncoderQP > 35) {
    statsWrapper.style.color = "red";
    statsText += `\n Bad network connection 😭`;
  } else if (ps.VideoEncoderQP > 26) {
    statsWrapper.style.color = "orange";
    statsText += `\n Spotty network connection 😂`;
  } else {
    statsWrapper.style.color = "lime";
  }
  statsText += `\n Video Quantization Parameter: ${ps.VideoEncoderQP}`;

  stats.forEach((stat) => {
    switch (stat.type) {
      case "data-channel": {
        statsText += `\n DataChannel —> ${stat.bytesSent.format()}B`;
        statsText += `\n DataChannel <— ${stat.bytesReceived.format()}B`;
        break;
      }
      case "inbound-rtp": {
        if (stat.mediaType === "video")
          statsText += `
      Resolution: ${stat.frameWidth + " x " + stat.frameHeight}
      Frames Decoded: ${stat.framesDecoded.format()}
      Packets Lost: ${stat.packetsLost.format()}
      FPS: ${stat.framesPerSecond}
      Frames dropped: ${stat.framesDropped.format()}
      Video <— ${stat.bytesReceived.format()}B`;
        else if (stat.mediaType === "audio")
          statsText += `\n Audio <— ${stat.bytesReceived.format()}B`;
        break;
      }
      case "candidate-pair": {
        if (stat.state === "succeeded")
          statsText += `\n Latency(RTT): ${
            stat.currentRoundTripTime * 1000
          } ms`;
        break;
      }
      case "remote-candidate": {
        statsText +=
          `\n` + stat.protocol + " :// " + stat.ip + " : " + stat.port;
        break;
      }
      case "transport": {
        const bitrate =
          ((stat.bytesReceived - lastTransport.bytesReceived) /
            (stat.timestamp - lastTransport.timestamp)) *
          (1000 * 8);

        statsText += `\n bitrate: ${bitrate.format()}bps `;

        lastTransport = stat;
        break;
      }
      default: {
      }
    }
  });

  statsWrapper.innerHTML = statsText;
}
