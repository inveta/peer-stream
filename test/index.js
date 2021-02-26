

const statsDiv = document.getElementById("stats");
const logsWrapper = document.getElementById("logs");
const overlay = document.getElementById("overlay");
const qualityStatus = document.getElementById("qualityStatus");



console.info = (...text) => {
    console.log(...text)
    // show log top left, disappear after timeout

    const log = document.createElement("div");
    log.innerHTML = text;
    logsWrapper.appendChild(log)
    setTimeout(() => {
        logsWrapper.removeChild(log)
    }, 2000);
}



function onExpandOverlay_Click(/* e */) {
    overlay.classList.toggle("overlay-shown");
}





function onAggregatedStats(reducedStat, VideoEncoderQP) {
    let numberFormat = new Intl.NumberFormat(window.navigator.language, {
        maximumFractionDigits: 0,
    });

    receivedBytesMeasurement = "B";
    receivedBytes = reducedStat.bytesReceived || 0;
    ["KB", "MB", "GB"].find(dataMeasurement => {
        if (receivedBytes < 100 * 1000) return true;
        receivedBytes /= 1000;
        receivedBytesMeasurement = dataMeasurement;
    })





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

    qualityStatus.style.color = color

    const duration = new Date(performance.now() + (new Date()).getTimezoneOffset() * 60 * 1000).toTimeString().split(' ')[0]
    statsText += `
			<div>Duration: ${duration}</div>
			<div>Video Resolution: ${reducedStat.frameWidth + "x" + reducedStat.frameHeight}</div>
			<div>Received (${receivedBytesMeasurement}): ${numberFormat.format(receivedBytes)}</div>
			<div>Frames Decoded: ${numberFormat.format(reducedStat.framesDecoded)}</div>
			<div>Packets Lost: ${numberFormat.format(reducedStat.packetsLost)}</div>
			<div style="color: ${color}">Bitrate (kbps): ${numberFormat.format(reducedStat.bitrate)}</div>
			<div>FPS: ${numberFormat.format(reducedStat.framesPerSecond)}</div>
			<div>Frames dropped: ${numberFormat.format(reducedStat.framesDropped)}</div>
			<div>Latency (ms): ${numberFormat.format(reducedStat.currentRoundTripTime * 1000)}</div>
			<div style="color: ${color}">Video Quantization Parameter: ${VideoEncoderQP}</div>	`;

    statsDiv.innerHTML = statsText;
}




document.body.onload = () => {
    window.ps = new window.PixelStream();


    //  registerTouchEvents( );
    ps.registerMouseEnterAndLeaveEvents();
    ps.registerFakeMouseEvents()
    ps.registerKeyboardEvents();
    ps.registerMouseHoverEvents()

    ps.connect('ws://localhost')
        .then(() => {

            document.body.appendChild(ps.video);
            // ps.video.play()

            setInterval(async () => {
                const stat = await ps.fetchReduceStats();
                if (stat)
                    onAggregatedStats(stat, ps.VideoEncoderQP);
            }, 1000);
        }).catch(err => {
            console.log('WS error:', err)
        })

}