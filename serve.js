//  开启web服务和信令服务



var express = require("express");
var app = express();

const path = require("path");


// 优先级：命令行参数 > config.json
const {
  httpPort,
  streamerPort,
  homepageFile,
  peerConnectionOptions,
} = Object.assign(require("./config.js"), require("./modules/argument.js"));



var http = require("http").Server(app);



// `clientConfig` is send to Streamer and Players
// Example of STUN server setting
// let clientConfig = {peerConnectionOptions: { 'iceServers': [{'urls': ['stun:34.250.222.95:19302']}] }};
var clientConfig = { type: "config", peerConnectionOptions: {} };

if (typeof peerConnectionOptions != "undefined") {
  clientConfig.peerConnectionOptions = JSON.parse(peerConnectionOptions);
  console.log(
    `peerConnectionOptions = ${JSON.stringify(
      clientConfig.peerConnectionOptions
    )}`
  );
}


app.use("/", express.static(path.join(__dirname, "/public")));

app.get("/", function (req, res) {
  const homepageFilePath = path.join(__dirname, homepageFile);

  res.sendFile(homepageFilePath);
});

http.listen(httpPort, function () {
  console.log("Http listening on *: " + httpPort);
});

// console.log(123,app.toString())


// 以下是信令服务

const WebSocket = require("ws");

let streamerServer = new WebSocket.Server({ port: streamerPort, backlog: 1 });
console.log(

  `WebSocket listening to Streamer connections on :${streamerPort}`
);
let streamer; // WebSocket connected to Streamer

streamerServer.on("connection", function (ws, req) {
  console.log(
    `Streamer connected: ${req.socket.remoteAddress}:${req.socket.remotePort}`
  );

  ws.on("message", function onStreamerMessage(msg) {
    console.log(`<- Streamer: ${msg}`);

    try {
      msg = JSON.parse(msg);
    } catch (err) {
      console.error(`cannot parse Streamer message: ${msg}\nError: ${err}`);
      streamer.close(1008, "Cannot parse");
      return;
    }

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
      console.error(`unsupported Streamer message type: ${msg.type}`);
      streamer.close(1008, "Unsupported message type");
    }
  });

  function onStreamerDisconnected() {
    disconnectAllPlayers();
  }

  ws.on("close", function (code, reason) {
    console.error(`streamer disconnected: ${code} - ${reason}`);
    onStreamerDisconnected();
  });

  ws.on("error", function (error) {
    console.error(`streamer connection error: ${error}`);
    ws.close(1006 /* abnormal closure */, error);
    onStreamerDisconnected();
  });

  streamer = ws;

  streamer.send(JSON.stringify(clientConfig));
});

let playerServer = new WebSocket.Server({
  server: http,
});
console.log(
  `WebSocket listening to Players connections on :${httpPort}`
);

let players = new Map(); // playerId <-> player, where player is either a web-browser or a native webrtc player
let nextPlayerId = 100;

playerServer.on("connection", function (ws, req) {
  // Reject connection if streamer is not connected
  if (!streamer || streamer.readyState != 1 /* OPEN */) {
    ws.close(1013 /* Try again later */, "Streamer is not connected");
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
