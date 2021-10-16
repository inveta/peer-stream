//  document.querySelector("[is=peer-stream]");

ps.addEventListener("message", (e) => {});

ps.addEventListener("playing", (e) => {
  clearInterval(ps.statTimer);
  ps.statTimer = setInterval(aggregateStats, 1000);
});

ps.addEventListener("suspend", (e) => {
  clearInterval(ps.statTimer);
});

const statsWrapper = document.getElementById("stats");
const logsWrapper = document.getElementById("logs");

console.info = (...text) => {
  console.log(...text);
  // show log, disappear after timeout

  const log = document.createElement("pre");
  log.innerHTML = text.join(" ");
  logsWrapper.append(log);
  setTimeout(() => log.remove(), 3000);
};

Number.prototype.format = function () {
  const suffix = ["", "K", "M", "G", "T"];
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
    statsText += `\n Bad Network 😭`;
  } else if (ps.VideoEncoderQP > 26) {
    statsWrapper.style.color = "orange";
    statsText += `\n Spotty Network 😂`;
  } else {
    statsWrapper.style.color = "lime";
  }
  statsText += `\n Video Quantization Parameter: ${ps.VideoEncoderQP}`;

  stats.forEach((stat) => {
    switch (stat.type) {
      case "data-channel": {
        statsText += `\n Data Channel << ${stat.bytesSent.format()}B`;
        statsText += `\n Data Channel >> ${stat.bytesReceived.format()}B`;
        break;
      }
      case "inbound-rtp": {
        if (stat.mediaType === "video")
          statsText += `
      Size: ${stat.frameWidth} x ${stat.frameHeight}
      Frames Decoded: ${stat.framesDecoded.format()}
      Packets Lost: ${stat.packetsLost.format()}
      FPS: ${stat.framesPerSecond} Hz
      Frames Dropped: ${stat.framesDropped?.format()}
      Video >> ${stat.bytesReceived.format()}B`;
        else if (stat.mediaType === "audio")
          statsText += `\n Audio >> ${stat.bytesReceived.format()}B`;
        break;
      }
      case "candidate-pair": {
        if (stat.state === "succeeded")
          statsText += `\n Latency(RTT): ${stat.currentRoundTripTime} s`;
        break;
      }
      case "remote-candidate": {
        statsText += `\n ` + stat.protocol + ":// " + stat.ip + ": " + stat.port;
        break;
      }
      case "transport": {
        const bitrate =
          ((stat.bytesReceived - lastTransport.bytesReceived) /
            (stat.timestamp - lastTransport.timestamp)) *
          (1000 * 8);

        statsText += `\n Bitrate: ${bitrate.format()}bps `;

        lastTransport = stat;
        break;
      }
      default: {
      }
    }
  });

  statsWrapper.innerHTML = statsText;
}
