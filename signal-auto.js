require("../signal.js");
const WebSocket = require("ws");
const child_process = require("child_process");

global.PLAYER.on("connection", (ws, req) => {
  // throttle
  if (global.throttle) {
    ws.close();
  } else {
    global.throttle = true;
    setTimeout(() => {
      global.throttle = false;
    }, 500);
  }

  // start UE5 automatically
  if (!global.lock && global.ENGINE.ws.readyState !== WebSocket.OPEN) {
    global.lock = true;
    child_process.exec(
      `npm run ${global.player}`,
      {
        cwd: __dirname,
      },
      (err, stdout, stderr) => {
        global.lock = false;
      }
    );
  }
});
