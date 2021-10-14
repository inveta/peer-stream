"4.27.1";

/* eslint-disable */

// node signal.js player=88 engine=8888 token=insigma limit=1

const WebSocket = require("ws");
const http = require("http");

// process.argv[0] == 'path/to/node.exe'
// process.argv[1] === __filename
const args = process.argv.slice(2).reduce((pairs, pair) => {
  let [key, ...value] = pair.split("=");
  value = value.join("") || "true";
  try {
    value = JSON.parse(value);
  } catch {}
  pairs[key] = value;
  return pairs;
}, {});
Object.assign(
  global,
  {
    player: 88,
    engine: 8888,
    token: "insigma",
    limit: 4,
    nextPlayerId: 100,
  },
  args
);

const ENGINE = new WebSocket.Server({ noServer: true });
ENGINE.ws = {}; // Unreal Engine's WebSocket

// browser client
const PLAYER = new WebSocket.Server({
  noServer: true,
  clientTracking: true,
});

http
  .createServer()
  .on("upgrade", (request, socket, head) => {
    try {
      if (request.url.slice(1) !== token) throw "";
      if (PLAYER.clients.size >= limit) throw "";
    } catch (err) {
      socket.destroy();
      return;
    }

    PLAYER.handleUpgrade(request, socket, head, (ws) => PLAYER.emit("connection", ws, request));
  })
  .listen(player, () => console.log("signaling for player:", player));

http
  .createServer()
  .on("upgrade", (request, socket, head) => {
    try {
      // 1个信令服务器只能连1个UE
      if (ENGINE.ws.readyState === WebSocket.OPEN) throw "";
    } catch (err) {
      socket.destroy();
      return;
    }

    ENGINE.handleUpgrade(request, socket, head, (ws) => ENGINE.emit("connection", ws, request));
  })
  .listen(engine, () => console.log("signaling for engine:", engine));

ENGINE.on("connection", (ws, req) => {
  ws.req = req;
  ENGINE.ws = ws;

  console.log("Engine connected:", req.socket.remoteAddress, req.socket.remotePort);

  ws.on("message", (msg) => {
    try {
      msg = JSON.parse(msg);
    } catch (err) {
      console.error("【JSON error】 Engine:", msg);
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
      console.error("cannot find player", playerId);
      return;
    }

    if (["answer", "iceCandidate"].includes(msg.type)) {
      p.send(JSON.stringify(msg));
    } else if (msg.type == "disconnectPlayer") {
      p.send(msg.reason);
      p.close(1011, "Infinity");
    } else {
      console.error("invalid Engine message type:", msg.type);
    }
  });

  ws.on("close", (code, reason) => {
    // reason是buffer？？
    console.log("Engine closed:", String(reason));
    for (const client of PLAYER.clients) {
      client.send(`Engine:${engine} stopped`);
    }
  });

  ws.on("error", (error) => {
    console.error("Engine connection error:", error);
    // A control frame must have a payload length of 125 bytes or less
    // ws.close(1011, error.message.slice(0, 100));
  });

  // sent to Unreal Engine as initial signal
  ws.send(
    JSON.stringify({
      type: "config",
      peerConnectionOptions: {
        // iceServers: [{ urls: ["stun:34.250.222.95:19302"] }],
      },
    })
  );

  for (const client of PLAYER.clients) {
    // reconnect immediately
    client.send(`Engine:${engine} started`);
    client.close(1011, "1");
  }
});

// every player
PLAYER.on("connection", async (ws, req) => {
  const playerId = String(++nextPlayerId);

  console.log("player", playerId, "connected:", req.socket.remoteAddress, req.socket.remotePort);

  ws.req = req;
  ws.playerId = playerId;

  ws.on("message", (msg) => {
    if (ENGINE.ws.readyState !== WebSocket.OPEN) {
      ws.send(`Engine:${engine} not ready`);
      return;
    }

    try {
      msg = JSON.parse(msg);
    } catch (err) {
      console.info("player", playerId, String(msg));
      ws.send("hello " + msg.slice(0, 100));
      return;
    }

    console.log("player", playerId, msg.type);

    msg.playerId = playerId;
    if (["offer", "iceCandidate"].includes(msg.type)) {
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
      ws.send("hello " + msg.type);
    }
  });

  ws.on("close", (code, reason) => {
    console.log("player", playerId, "closed:", String(reason));
    if (ENGINE.ws.readyState === WebSocket.OPEN)
      ENGINE.ws.send(JSON.stringify({ type: "playerDisconnected", playerId }));
  });

  ws.on("error", (error) => {
    console.error("player", playerId, "connection error:", error);
  });
});
