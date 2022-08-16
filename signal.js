"5.0.3";

// node signal.js player=88 engine=8888 token=hello limit=4

const WebSocket = require("ws");

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

global.ENGINE = new WebSocket.Server({ port: args.engine || 8888 });
ENGINE.ws = {}; // Unreal Engine's WebSocket

console.log("signaling for engine:", ENGINE.address().port);

ENGINE.on("connection", (ws, req) => {
  // only one UE5
  if (global.ENGINE.clients.size > 1) {
    ws.close();
  }

  ws.req = req;
  ENGINE.ws = ws;

  console.log("✅ Engine connected:", req.socket.remoteAddress, req.socket.remotePort);

  ws.on("message", (msg) => {
    try {
      msg = JSON.parse(msg);
    } catch (err) {
      console.error("❌【JSON error】 Engine:", msg);
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
      console.error("❌ player not found:", playerId);
      return;
    }

    if (["offer", "answer", "iceCandidate"].includes(msg.type)) {
      p.send(JSON.stringify(msg));
    } else if (msg.type == "disconnectPlayer") {
      p.send(msg.reason);
      p.close(1011, "Infinity");
    } else {
      console.error("❌ invalid Engine message type:", msg.type);
    }
  });

  ws.on("close", (code, reason) => {
    // reason is buffer ??
    console.log("❌ Engine closed:", String(reason));
    for (const client of PLAYER.clients) {
      client.send(`❌ Engine stopped`);
    }
  });

  ws.on("error", (error) => {
    console.error("❌ Engine connection error:", error);
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
    client.send(`✅ Engine started`);
    client.close(1011, "1");
  }
});

const http = require("http");

// browser client
global.PLAYER = new WebSocket.Server({
  server: http.createServer().listen(args.player || 88),
  // port: args.player || 88,
  clientTracking: true,
});
console.log("signaling for player:", PLAYER.address().port);
let nextPlayerId = 100;
// every player
PLAYER.on("connection", async (ws, req) => {
  const playerId = String(++nextPlayerId);

  console.log("✅ player", playerId, "connected:", req.socket.remoteAddress, req.socket.remotePort);

  ws.req = req;
  ws.playerId = playerId;

  ws.on("message", (msg) => {
    if (ENGINE.ws.readyState !== WebSocket.OPEN) {
      ws.send(`❌ Engine not ready`);
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
      ws.send("hello " + msg.type);
    }
  });

  ws.on("close", (code, reason) => {
    console.log("❌ player", playerId, "closed:", String(reason));
    if (ENGINE.ws.readyState === WebSocket.OPEN)
      ENGINE.ws.send(JSON.stringify({ type: "playerDisconnected", playerId }));
  });

  ws.on("error", (error) => {
    console.error("❌ player", playerId, "connection error:", error);
  });

  if (ENGINE.ws.readyState === WebSocket.OPEN)
    ENGINE.ws.send(
      JSON.stringify({ type: "playerConnected", playerId: playerId, dataChannel: true, sfu: false })
    );
});
