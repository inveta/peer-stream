// command line format: key-value pairs connected by "=", separated by " ", like:
// node signalling.js playerPort=80 UE4port=8888 useWSS

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
    peerConnectionOptions: {},
  },
  args
);

const WebSocket = require("ws");

// `clientConfig` is send to UE4 and Players as initialization signal
// let clientConfig = {peerConnectionOptions: { 'iceServers': [{'urls': ['stun:34.250.222.95:19302']}] }};
let clientConfig = { type: "config", peerConnectionOptions };

let UE4server = new WebSocket.Server({ port: UE4port, backlog: 1 });
console.log(`WebSocket waiting for UE4 on`, UE4port);

let UE4socket; //  UE4's Socket

let playerServer = new WebSocket.Server({ port: playerPort, backlog: 1 });

console.log(`WebSocket waiting for players on`, playerPort);

let playerSockets = new Map(); // playerId <-> player's Socket
let nextPlayerId = 100;

UE4server.on("connection", function (ws, req) {
  UE4socket = ws;

  console.log(
    `UE4 connected:`,
    req.socket.remoteAddress,
    req.socket.remotePort
  );

  ws.on("message", function (msg) {
    try {
      msg = JSON.parse(msg);
    } catch (err) {
      console.error(`cannot JSON.parse UE4 message:`, msg);
      ws.close(1008, "Cannot parse");
      return;
    }

    console.log(`UE4:`, msg.type, msg.playerId || "");

    if (msg.type == "ping") {
      ws.send(JSON.stringify({ type: "pong", time: msg.time }));
      return;
    }

    let playerId = msg.playerId;
    delete msg.playerId; // no need to send it to the player
    let player = playerSockets.get(playerId);
    if (!player) {
      console.error(`cannot find player`, playerId);
      return;
    }

    if (["answer", "iceCandidate"].includes(msg.type)) {
      player.send(JSON.stringify(msg));
    } else if (msg.type == "disconnectPlayer") {
      player.close(1011 /* internal error */, msg.reason);
    } else {
      console.error(`invalid UE4 message type:`, msg.type);
      ws.close(1008, "Unsupported message type");
    }
  });

  ws.on("close", function (code, reason) {
    console.log(`UE4 disconnected:`, code, reason);
    disconnectAllPlayers();
  });

  ws.on("error", function (error) {
    console.error(`UE4 connection error:`, error);
    ws.close(1006 /* abnormal closure */, error);
    disconnectAllPlayers();
  });


  ws.send(JSON.stringify(clientConfig));
});

// every player
playerServer.on("connection", function (ws, req) {
  // Reject connection if UE4 is not connected
  if (!UE4socket || UE4socket.readyState != 1 /* OPEN */) {
    ws.close(1013 /* Try again later */, "UE4 is not connected");
    return;
  }

  // 必须是uint32
  let playerId = ++nextPlayerId;

  console.log(
    `player`,
    playerId,
    "connected:",
    req.socket.remoteAddress,
    req.socket.remotePort
  );
  playerSockets.set(playerId, ws);

  ws.on("message", function (msg) {
    // offer or iceCandidate

    try {
      msg = JSON.parse(msg);
    } catch (err) {
      console.error(`player`, playerId, `cannot JSON.parse message`);
      ws.close(1008, "Cannot parse");
      return;
    }

    console.log(`player`, playerId, msg.type);

    msg.playerId = playerId;
    if (["offer", "iceCandidate"].includes(msg.type)) {
      UE4socket.send(JSON.stringify(msg));
    } else {
      console.error(`player`, playerId, "invalid message type:", msg.type);
      ws.close(1008, "Unsupported message type");
      return;
    }
  });

  function onPlayerDisconnected() {
    playerSockets.delete(playerId);
    UE4socket.send(
      JSON.stringify({ type: "playerDisconnected", playerId: playerId })
    );
  }

  ws.on("close", function (code, reason) {
    console.log(`player`, playerId, "connection closed", code, reason);
    onPlayerDisconnected();
  });

  ws.on("error", function (error) {
    console.error(`player`, playerId, `connection error:`, error);
    ws.close(1006 /* abnormal closure */, error);
    onPlayerDisconnected();
  });

  ws.send(JSON.stringify(clientConfig));
});

function disconnectAllPlayers(code, reason) {
  let clone = new Map(playerSockets);
  for (let player of clone.values()) {
    player.close(code, reason);
  }
}
