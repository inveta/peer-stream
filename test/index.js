ps.addEventListener("playing", aggregateStats, { once: true });
ps.addEventListener("message", (e) => { });
ps.addEventListener("suspend", (e) => { });

// use WebVTT to show logs
console.info = (...text) => {
  console.log(...text);
  const cue = new VTTCue(ps.currentTime, ps.currentTime + 3, text.join(" "));
  cue.align = "left";
  cue.line = 0;
  ps.textTracks[0].addCue(cue);
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

async function aggregateStats() {
  const statsReport = await ps.pc.getStats(null);
  stats.innerText = "";

  // 大部分都 < 27
  if (ps.VideoEncoderQP < 27) {
    stats.style.color = "lime";
  } else if (ps.VideoEncoderQP < 36) {
    stats.style.color = "orange";
    stats.innerText += `\n Spotty Network`;
  } else {
    stats.style.color = "red";
    stats.innerText += `\n Bad Network ❌`;
  }

  stats.innerText += `\n Video Quantization Parameter: ${ps.VideoEncoderQP}`;
  statsReport.forEach((stat) => {
    switch (stat.type) {
      case "data-channel": {
        stats.innerText += `\n ✉ Data Channel ↑↑ ${stat.bytesSent.format()}B`;
        stats.innerText += `\n ✉ Data Channel ↓↓ ${stat.bytesReceived.format()}B`;
        break;
      }
      case "inbound-rtp": {
        if (stat.mediaType === "video")
          stats.innerText += `
      Size: ${stat.frameWidth} x ${stat.frameHeight}
      Frames Decoded: ${stat.framesDecoded.format()}
      Packets Lost: ${stat.packetsLost.format()}
      FPS: ${stat.framesPerSecond} Hz
      Frames Dropped: ${stat.framesDropped?.format()}
      Video ↓↓ ${stat.bytesReceived.format()}B`;
        else if (stat.mediaType === "audio")
          stats.innerText += `\n ♬ Audio ↓↓ ${stat.bytesReceived.format()}B`;
        break;
      }
      case "candidate-pair": {
        if (stat.state === "succeeded")
          stats.innerText += `\n Latency(RTT): ${stat.currentRoundTripTime} s`;
        break;
      }
      case "remote-candidate": {
        stats.innerText += `\n ` + stat.protocol + ":// " + stat.ip + ": " + stat.port;
        break;
      }
      case "transport": {
        const bitrate =
          ((stat.bytesReceived - this.bytesReceived) / (stat.timestamp - this.timestamp)) *
          (1000 * 8);

        stats.innerText += `\n ⇌ Bitrate: ${bitrate.format()}bps`;

        this.bytesReceived = stat.bytesReceived;
        this.timestamp = stat.timestamp;
        break;
      }
      default: {
      }
    }
  });

  stats.innerText += `\n ⏲ Current Time: ${ps.currentTime} s`;

  ps.timeout = setTimeout(aggregateStats, 1000);
}
