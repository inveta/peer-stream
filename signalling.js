/*
 *  https://github.com/JinHengyu/PixelStreamer/blob/main/signalling.js
 *  Author: 金恒昱
 *  Version: 0.0.5
 *
 */

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
    playerPort: 80,
    UE4port: 8888,
    peerConnectionOptions: {
      offerExtmapAllowMixed: false, // 为了兼容chrome89+
      // iceServers: [{ urls: ["stun:34.250.222.95:19302"] }],
    },
  },
  args
);

const WebSocket = require("ws");

// to be sent to UE4 and Players as initialization signal
let clientConfig = { type: "config", peerConnectionOptions };

let UE4server = new WebSocket.Server({ port: UE4port, backlog: 1 });
console.log(`WebSocket for UE4:`, UE4port);

let UE4socket; //  UE4's Socket

let playerServer = new WebSocket.Server({ port: playerPort, backlog: 1 });
console.log(`WebSocket for players:`, playerPort);

let playerSockets = {}; // playerId <-> player's Socket

// 必须是uint32
let nextPlayerId = 100;

UE4server.on("connection", (ws, req) => {
  UE4socket = ws;

  console.log(
    `UE4 connected:`,
    req.socket.remoteAddress,
    req.socket.remotePort
  );

  ws.on("message", (msg) => {
    try {
      msg = JSON.parse(msg);
    } catch (err) {
      console.error(`cannot JSON.parse UE4 message:`, msg);
      // ws.close(1008, "Cannot parse");
      return;
    }

    console.log(`UE4:`, msg.type, msg.playerId || "");

    if (msg.type == "ping") {
      ws.send(JSON.stringify({ type: "pong", time: msg.time }));
      return;
    }

    let playerId = msg.playerId;
    delete msg.playerId; // no need to send it to the player
    let player = playerSockets[playerId];
    if (!player) {
      console.error(`cannot find player`, playerId);
      return;
    }

    if (["answer", "iceCandidate"].includes(msg.type)) {
      player.send(JSON.stringify(msg));
    } else if (msg.type == "disconnectPlayer") {
      player.close(1011, msg.reason);
    } else {
      console.error(`invalid UE4 message type:`, msg.type);
    }
  });

  function disconnectAllPlayers(reason) {
    // let clone = new Map(playerSockets);
    Object.values(playerSockets).forEach((s) => s.close(1011, reason));

    playerSockets = {};
  }

  ws.on("close", (code, reason) => {
    console.log(`UE4 disconnected`, reason);
    disconnectAllPlayers(reason);
  });

  ws.on("error", (error) => {
    console.error(`UE4 connection error:`, error);
    ws.close(1011, error.message);
    disconnectAllPlayers(error.message);
  });

  ws.send(JSON.stringify(clientConfig));
});

// every player
playerServer.on("connection", (ws, req) => {
  // Reject connection if UE4 is not connected
  if (!UE4socket || UE4socket.readyState !== 1 /* OPEN */) {
    ws.close(1011, "UE4 is not connected");
    return;
  }

  let playerId = ++nextPlayerId;

  console.log(
    `player`,
    playerId,
    "connected:",
    req.socket.remoteAddress,
    req.socket.remotePort
  );
  playerSockets[playerId] = ws;

  ws.on("message", (msg) => {
    // offer or iceCandidate

    try {
      msg = JSON.parse(msg);
    } catch (err) {
      console.error(`player`, playerId, `cannot JSON.parse message`, msg);
      ws.send(JSON.stringify({ type: "error", error: "JSON.parse Error" }));
      return;
    }

    console.log(`player`, playerId, msg.type);

    msg.playerId = playerId;
    if (["offer", "iceCandidate"].includes(msg.type)) {
      UE4socket.send(JSON.stringify(msg));
    } else if (msg.type === "debug") {
      let debug;
      try {
        debug = String(eval(msg.debug));
      } catch (err) {
        debug = err.message;
      }
      ws.send(JSON.stringify({ type: "debug", debug }));
    } else {
      console.error(`player`, playerId, "invalid message type:", msg.type);
      ws.send(
        JSON.stringify({
          type: "error",
          error: "invalid message type: " + msg.type,
        })
      );
      return;
    }
  });

  function onPlayerDisconnected() {
    delete playerSockets[playerId];
    UE4socket.send(JSON.stringify({ type: "playerDisconnected", playerId }));
  }

  ws.on("close", (code, reason) => {
    console.log(`player`, playerId, "connection closed", reason);
    onPlayerDisconnected();
  });

  ws.on("error", (error) => {
    console.error(`player`, playerId, `connection error:`, error);
    ws.close(1011, error.message);
    onPlayerDisconnected();
  });

  ws.send(JSON.stringify(clientConfig));
});
