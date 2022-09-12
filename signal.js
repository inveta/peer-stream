"5.0.3";

// node signal.js player=88 engine=8888
const WebSocket = require("ws");


global.ENGINE = new WebSocket.Server({ port: +process.env.engine || 8888 }, () => {
  console.log("signaling for engine:", +process.env.engine || 8888);
});
ENGINE.ws = {}; // Unreal Engine's WebSocket

ENGINE.on("connection", (ws, req) => {
  // only one UE5
  if (global.ENGINE.clients.size > 1) {
    ws.close();
  }

  ws.req = req;
  ENGINE.ws = ws;

  console.log("Engine connected:", req.socket.remoteAddress, req.socket.remotePort);

  ws.on("message", (msg) => {
    try {
      msg = JSON.parse(msg);
    } catch (err) {
      console.error("? Engine:", msg);
      return;
    }

    // Convert incoming playerId to a string if it is an integer, if needed. (We support receiving it as an int or string).
    const playerId = String(msg.playerId || "");
    delete msg.playerId; // no need to send it to the player
    console.log("Engine:", msg.type, playerId);

    if (msg.type === "ping") {
      ws.send(JSON.stringify({ type: "pong", time: msg.time }));
      return;
    }

    const p = [...PLAYER.clients].find((x) => x.playerId === playerId);
    if (!p) {
      console.error("? player not found:", playerId);
      return;
    }

    if (["offer", "answer", "iceCandidate"].includes(msg.type)) {
      p.send(JSON.stringify(msg));
    } else if (msg.type == "disconnectPlayer") {
      p.send(msg.reason);
      p.close(1011, "Infinity");
    } else {
      console.error("? invalid Engine message type:", msg.type);
    }
  });

  ws.on("close", (code, reason) => {
    // reason is buffer ??
    console.log("Engine closed:", String(reason));
    for (const client of PLAYER.clients) {
      client.send(`Engine stopped`);
    }
  });

  ws.on("error", (error) => {
    console.error("! Engine connection error:", error);
    // A control frame must have a payload length of 125 bytes or less
    // ws.close(1011, error.message.slice(0, 100));
  });

  // sent to Unreal Engine as initial signal
  ws.send(
    JSON.stringify({
      type: "config",
      peerConnectionOptions: {
        // iceServers: [{
        //     urls: [
        //       "stun:stun.l.google.com:19302",
        //       "stun:stun1.l.google.com:19302",
        //       "stun:stun2.l.google.com:19302",
        //       "stun:stun3.l.google.com:19302",
        //       "stun:stun4.l.google.com:19302",
        // ],},],
      },
    })
  );

  for (const client of PLAYER.clients) {
    // reconnect immediately
    client.send(`Engine started`);
    client.close(1011, "1");
  }
});

const http = require("http");

const fs = require("fs");
const path = require("path");
function listener(req, res) {
  // websocket请求时不触发
  // serve HTTP static files

  const file = path.join(__dirname, req.url);
  const r = fs.createReadStream(file);

  r.on("error", (err) => {
    res.end(err.message);
  });

  r.on("ready", (e) => {
    r.pipe(res);
  });
}

// browser client
global.PLAYER = new WebSocket.Server({
  server: http.createServer((+process.env.http) === 0 ? undefined : listener).listen(+process.env.player || 88, () => {
    console.log("signaling for player:", +process.env.player || 88);
  }),
  // port:   88,
  clientTracking: true,
});
let nextPlayerId = 100;
// every player
PLAYER.on("connection", async (ws, req) => {
  // password
  if (process.env.token) {
    if (req.url.slice(1) !== process.env.token) {
      ws.close()
      return;
    }
  }

  // players max count
  if (process.env.limit) {
    if (global.PLAYER.clients.size > process.env.limit) {
      ws.close();
      return;
    }
  }

  // throttle
  if (+process.env.throttle !== 0) {
    if (global.throttle) {
      ws.close();
      return;
    } else {
      global.throttle = true;
      setTimeout(() => {
        global.throttle = false;
      }, 500);
    }
  }


  // start UE5 automatically
  if (process.env.UE5) {
    if (!global.lock && global.ENGINE.ws.readyState !== WebSocket.OPEN) {
      global.lock = true;
      child_process.exec(
        process.env.UE5,
        {
          cwd: __dirname,
        },
        (err, stdout, stderr) => {
          global.lock = false;
        }
      );
    }
  }


  const playerId = String(++nextPlayerId);

  console.log("player", playerId, "connected:", req.socket.remoteAddress, req.socket.remotePort);

  ws.req = req;
  ws.playerId = playerId;

  ws.on("message", (msg) => {
    if (ENGINE.ws.readyState !== WebSocket.OPEN) {
      ws.send(`! Engine not ready`);
      return;
    }

    try {
      msg = JSON.parse(msg);
    } catch (err) {
      console.info("player", playerId, String(msg));
      ws.send("? " + msg.slice(0, 100));
      return;
    }

    console.log("player", playerId, msg.type);

    msg.playerId = playerId;
    if (["answer", "iceCandidate"].includes(msg.type)) {
      ENGINE.ws.send(JSON.stringify(msg));
    } else if (msg.type === "debug") {
      let debug;
      try {
        debug = String(eval(msg.debug));
      } catch (err) {
        debug = err.message;
      }
      ws.send("【debug】" + debug);
    } else {
      ws.send("? " + msg.type);
    }
  });

  ws.on("close", (code, reason) => {
    console.log("player", playerId, "closed:", String(reason));
    if (ENGINE.ws.readyState === WebSocket.OPEN)
      ENGINE.ws.send(JSON.stringify({ type: "playerDisconnected", playerId }));
  });

  ws.on("error", (error) => {
    console.error("! player", playerId, "connection error:", error);
  });

  if (ENGINE.ws.readyState === WebSocket.OPEN)
    ENGINE.ws.send(
      JSON.stringify({ type: "playerConnected", playerId: playerId, dataChannel: true, sfu: false })
    );
});
