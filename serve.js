// web & signalling server



var express = require("express");
var app = express();

const path = require("path");


// command line format: key-value pairs connected by "=", separated by " ", for example:
// node serve.js httpPort=80 streamerPort=8888 useHTTPS


// process.argc[0] == 'path/to/node.exe'
// process.argc[1] === __filename
const args = process.argv.slice(2).reduce((prev, curr) => {
  let [key, ...value] = curr.split('=')
  value = value.join('') || 'true'

  try {
    value = JSON.parse(value)
  } catch { }

  prev[key] = value;
  return prev;
}, {});





Object.assign(global || this,
  {
    httpPort: 80,
    streamerPort: 8888,
    peerConnectionOptions: {},
  },
  args
)





var http = require("http").Server(app);



// `clientConfig` is send to Streamer and Players
// Example of STUN server setting
// let clientConfig = {peerConnectionOptions: { 'iceServers': [{'urls': ['stun:34.250.222.95:19302']}] }};
var clientConfig = { type: "config", peerConnectionOptions };


app.use("/", express.static(path.join(__dirname, "/public")));

app.get("/", function (req, res) {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

http.listen(httpPort, function () {
  console.log("Http listening on *: " + httpPort);
});



// below are signalling services

const WebSocket = require("ws");

let streamerServer = new WebSocket.Server({ port: streamerPort, backlog: 1 });
console.log(`WebSocket waiting for Unreal Engine on :${streamerPort}`);

let streamer; // WebSocket connected to Streamer

streamerServer.on("connection", function (ws, req) {
  console.log(
    `Unreal Engine connected: ${req.socket.remoteAddress}:${req.socket.remotePort}`
  );

  ws.on("message", function onStreamerMessage(msg) {

    try {
      msg = JSON.parse(msg);
    } catch (err) {
      console.error(`cannot parse Unreal Engine message: ${msg}\nError: ${err}`);
      streamer.close(1008, "Cannot parse");
      return;
    }

    console.log(`Unreal Engine:`, msg);

    if (msg.type == "ping") {
      streamer.send(JSON.stringify({ type: "pong", time: msg.time }));
      return;
    }

    let playerId = msg.playerId;
    delete msg.playerId; // no need to send it to the player
    let player = players.get(playerId);
    if (!player) {
      console.log(
        `dropped message ${msg.type} as the player ${playerId} is not found`
      );
      return;
    }

    if (msg.type == "answer") {
      player.ws.send(JSON.stringify(msg));
    } else if (msg.type == "iceCandidate") {
      player.ws.send(JSON.stringify(msg));
    } else if (msg.type == "disconnectPlayer") {
      player.ws.close(1011 /* internal error */, msg.reason);
    } else {
      console.error(`unsupported Unreal Engine message type: ${msg.type}`);
      streamer.close(1008, "Unsupported message type");
    }
  });

  ws.on("close", function (code, reason) {
    console.error(`Unreal Engine disconnected: ${code} - ${reason}`);
    disconnectAllPlayers();
  });

  ws.on("error", function (error) {
    console.error(`Unreal Engine connection error: ${error}`);
    ws.close(1006 /* abnormal closure */, error);
    disconnectAllPlayers();
  });

  streamer = ws;

  streamer.send(JSON.stringify(clientConfig));
});





let playerServer = new WebSocket.Server({
  server: http,
});

console.log(`WebSocket waitint for players on :${httpPort}`);

let players = new Map(); // playerId <-> player, where player is either a web-browser or a native webrtc player
let nextPlayerId = 100;

playerServer.on("connection", function (ws, req) {
  // Reject connection if streamer is not connected
  if (!streamer || streamer.readyState != 1 /* OPEN */) {
    ws.close(1013 /* Try again later */, "Unreal Engine is not connected");
    return;
  }

  let playerId = ++nextPlayerId;
  console.log(
    `player ${playerId} (${req.socket.remoteAddress}:${req.socket.remotePort}) connected`
  );
  players.set(playerId, { ws: ws, id: playerId });

  function sendPlayersCount() {
    let playerCountMsg = JSON.stringify({
      type: "playerCount",
      count: players.size,
    });
    for (let p of players.values()) {
      p.ws.send(playerCountMsg);
    }
  }

  ws.on("message", function (msg) {
    console.log(`<- player ${playerId}: ${msg}`);

    try {
      msg = JSON.parse(msg);
    } catch (err) {
      console.error(`Cannot parse player ${playerId} message: ${err}`);
      ws.close(1008, "Cannot parse");
      return;
    }

    if (msg.type == "offer") {
      console.log(`<- player ${playerId}: offer`);
      msg.playerId = playerId;
      streamer.send(JSON.stringify(msg));
    } else if (msg.type == "iceCandidate") {
      console.log(`<- player ${playerId}: iceCandidate`);
      msg.playerId = playerId;
      streamer.send(JSON.stringify(msg));
    } else if (msg.type == "kick") {
      let playersCopy = new Map(players);
      for (let p of playersCopy.values()) {
        if (p.id != playerId) {
          console.log(`kicking player ${p.id}`);
          p.ws.close(4000, "kicked");
        }
      }
    } else {
      console.error(
        `<- player ${playerId}: unsupported message type: ${msg.type}`
      );
      ws.close(1008, "Unsupported message type");
      return;
    }
  });

  function onPlayerDisconnected() {
    players.delete(playerId);
    streamer.send(
      JSON.stringify({ type: "playerDisconnected", playerId: playerId })
    );
    sendPlayersCount();
  }

  ws.on("close", function (code, reason) {
    console.log(
      `player ${playerId} connection closed: ${code} - ${reason}`
    );
    onPlayerDisconnected();
  });

  ws.on("error", function (error) {
    console.error(`player ${playerId} connection error: ${error}`);
    ws.close(1006 /* abnormal closure */, error);
    onPlayerDisconnected();
  });

  ws.send(JSON.stringify(clientConfig));

  sendPlayersCount();
});

function disconnectAllPlayers(code, reason) {
  let clone = new Map(players);
  for (let player of clone.values()) {
    player.ws.close(code, reason);
  }
}
