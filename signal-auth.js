require("./signal.js");
const WebSocket = require("ws");
const child_process = require("child_process");

global.PLAYER.on("connection", (ws, req) => {
  // password
  // if (req.url.slice(1) !== "hello") {
  //   ws.close()
  //   return;
  // }

  // players max count
  // if (global.PLAYER.clients.size > 3) {
  //   ws.close();
  //   return;
  // }

  // throttle
  if (global.throttle) {
    ws.close();
    return;
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
      "npm run " + global.PLAYER.address().port,
      {
        cwd: __dirname,
      },
      (err, stdout, stderr) => {
        global.lock = false;
      }
    );
  }
});
