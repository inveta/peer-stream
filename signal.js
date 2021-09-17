/*
 *  https://xosg.github.io/PixelStreamer/signal.js
 *  2021/9/14
 */

/* eslint-disable */

// node signal.js player=88 unreal=8888 token=insigma limit=1

const WebSocket = require("ws");
const http = require("http");

// process.argc[0] == 'path/to/node.exe'
// process.argc[1] === __filename
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
    unreal: 8888,
    token: "insigma",
    limit: 4,
    nextPlayerId: 100, //uint32?
    UE4: {}, //  UE4's Socket
  },
  args
);

const UNREAL = new WebSocket.Server({ noServer: true });

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
  .listen(player, () => console.log("Listening for players:", player));

http
  .createServer()
  .on("upgrade", (request, socket, head) => {
    try {
      // 1个信令服务器只能连1个UE
      if (UE4.readyState === WebSocket.OPEN) throw "";
    } catch (err) {
      socket.destroy();
      return;
    }

    UNREAL.handleUpgrade(request, socket, head, (ws) => UNREAL.emit("connection", ws, request));
  })
  .listen(unreal, () => console.log("Listening for UE4:", unreal));

UNREAL.on("connection", (ws, req) => {
  ws.req = req;
  UE4 = ws;

  console.log("UE4 connected:", req.socket.remoteAddress, req.socket.remotePort);

  ws.on("message", (msg) => {
    try {
      msg = JSON.parse(msg);
    } catch (err) {
      console.error("cannot JSON.parse UE4 message:", msg);
      return;
    }

    console.log("UE4:", msg.type, msg.playerId || "");

    if (msg.type === "ping") {
      ws.send(JSON.stringify({ type: "pong", time: msg.time }));
      return;
    }

    // Convert incoming playerId to a string if it is an integer, if needed. (We support receiving it as an int or string).
    const playerId = String(msg.playerId);
    delete msg.playerId; // no need to send it to the player
    const p = [...PLAYER.clients].find((x) => x.playerId === playerId);
    if (!p) {
      console.error("cannot find player", playerId);
      return;
    }

    if (["answer", "iceCandidate"].includes(msg.type)) {
      p.send(JSON.stringify(msg));
    } else if (msg.type == "disconnectPlayer") {
      p.send(msg.reason);
      // A control frame must have a payload length of 125 bytes or less
      p.close(1011, "Infinity");
    } else {
      console.error("invalid UE4 message type:", msg.type);
    }
  });

  ws.on("close", (code, reason) => {
    console.log("UE4 closed:", String(reason));
    for (const client of PLAYER.clients) {
      client.send(`UE4:${unreal} stopped`);
    }
  });

  ws.on("error", (error) => {
    console.error("UE4 connection error:", error);
    UE4.close(1011, error.message);
  });

  // sent to UE4 as initialization signal
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
    client.send(`UE4:${unreal} started`);
    client.close(1011, "1");
  }
});

//  require("crypto").createHash("sha256").update(req.url.slice(1)).digest("hex");

// every player
PLAYER.on("connection", async (ws, req) => {
  const playerId = String(++nextPlayerId);

  console.log("player", playerId, "connected:", req.socket.remoteAddress, req.socket.remotePort);

  ws.req = req;
  ws.playerId = playerId;

  ws.on("message", (msg) => {
    if (UE4.readyState !== WebSocket.OPEN) {
      ws.send(`UE4:${unreal} not ready`);
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
      UE4.send(JSON.stringify(msg));
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
    if (UE4.readyState === WebSocket.OPEN)
      UE4.send(JSON.stringify({ type: "playerDisconnected", playerId }));
  });

  ws.on("error", (error) => {
    console.error("player", playerId, "connection error:", error);
    ws.close(1011, error.message);
  });
});
