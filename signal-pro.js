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
      "npm run engine",
      {
        cwd: __dirname,
      },
      (err, stdout, stderr) => {
        global.lock = false;
      }
    );
  }
});

const fs = require("fs");
const path = require("path");

// serve HTTP static files
global.PLAYER._server.prependListener("request", (req, res) => {
  // websocket请求时不触发

  const file = path.join(__dirname, req.url);
  const r = fs.createReadStream(file);

  r.on("error", (err) => {
    res.end(err.message);
  });

  r.on("ready", (e) => {
    r.pipe(res);
  });
});
