/*
 *  https://xosg.github.io/PixelStreamer/signal.js
 *  2021/8/23 @xosg
 */

/* eslint-disable */

// command line format: key-value pairs connected by "=", separated by " "
// process.argc[0] == 'path/to/node.exe'
// process.argc[1] === __filename
const args = process.argv.slice(2).reduce((prev, curr) => {
  let [key, ...value] = curr.split("=");
  value = value.join("") || "true";
  try {
    value = JSON.parse(value);
  } catch {}
  prev[key] = value;
  return prev;
}, {});
Object.assign(
  global || this,
  {
    playerPort: 88,
    UE4port: 8888,
  },
  args
);

const WebSocket = require("ws");

let UE4server = new WebSocket.Server({ port: UE4port, backlog: 1 });
console.log("WebSocket for UE4:", UE4port);

let UE4; //  UE4's Socket

let playerServer = new WebSocket.Server({ port: playerPort, backlog: 1 });
console.log("WebSocket for players:", playerPort);

let players = {}; // playerId <-> player's Socket

// 必须是uint32
let nextPlayerId = 100;

UE4server.on("connection", (ws, req) => {
  ws.req = req;
  UE4 = ws;

  console.log(
    "UE4 connected:",
    req.socket.remoteAddress,
    req.socket.remotePort
  );

  ws.on("message", (msg) => {
    try {
      msg = JSON.parse(msg);
    } catch (err) {
      console.error("cannot JSON.parse UE4 message:", msg);
      return;
    }

    console.log("UE4:", msg.type, msg.playerId || "");

    if (msg.type === "ping") {
      UE4.send(JSON.stringify({ type: "pong", time: msg.time }));
      return;
    }

    let playerId = msg.playerId;
    delete msg.playerId; // no need to send it to the player
    let player = players[playerId];
    if (!player) {
      console.error("cannot find player", playerId);
      return;
    }

    if (["answer", "iceCandidate"].includes(msg.type)) {
      player.send(JSON.stringify(msg));
    } else if (msg.type == "disconnectPlayer") {
      player.close(1011, msg.reason);
    } else {
      console.error("invalid UE4 message type:", msg.type);
    }
  });

  ws.on("close", (code, reason) => {
    console.log("UE4 closed", reason);
    UE4 = null;
    for (const id in players) {
      players[id].send("UE4 stopped");
    }
  });

  ws.on("error", (error) => {
    console.error("UE4 connection error:", error);
    UE4.close(1011, error.message);
  });

  // sent to UE4 as initialization signal
  UE4.send(
    JSON.stringify({
      type: "config",
      peerConnectionOptions: {
        // iceServers: [{ urls: ["stun:34.250.222.95:19302"] }],
      },
    })
  );

  for (const id in players) {
    // restart
    players[id].close(1011, "UE4 started");
  }
  players = {};
});

//  require("crypto").createHash("sha256").update(req.url.slice(1)).digest("hex");

// every player
playerServer.on("connection", async (ws, req) => {
  if (req.url.slice(1) !== "insigma") {
    ws.send("Authentication Failed !!");
    //  req.socket.destroy();
    return;
  }

  let playerId = ++nextPlayerId;

  console.log(
    "player",
    playerId,
    "connected:",
    req.socket.remoteAddress,
    req.socket.remotePort
  );

  ws.req = req;
  players[playerId] = ws;

  ws.on("message", (msg) => {
    if (UE4?.readyState !== WebSocket.OPEN) {
      ws.send("UE4 not ready");
      return;
    }

    // offer or iceCandidate

    try {
      msg = JSON.parse(msg);
    } catch (err) {
      console.error("player", playerId, "cannot JSON.parse message", msg);
      ws.send("JSON.parse Error");
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
      console.error("player", playerId, "invalid message type:", msg.type);
      ws.send("invalid message type: " + msg.type);
      return;
    }
  });

  function onPlayerDisconnected() {
    delete players[playerId];
    UE4?.send(JSON.stringify({ type: "playerDisconnected", playerId }));
  }

  ws.on("close", (code, reason) => {
    console.log("player", playerId, "closed", reason);
    onPlayerDisconnected();
  });

  ws.on("error", (error) => {
    console.error("player", playerId, "connection error:", error);
    ws.close(1011, error.message);
    onPlayerDisconnected();
  });
});
