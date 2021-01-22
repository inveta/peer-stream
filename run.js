//-- Server side logic. Serves pixel streaming WebRTC-based page, proxies data back to Streamer --//

var express = require("express");
var app = express();

const fs = require("fs");
const path = require("path");

const logging = require("./modules/logging.js");
logging.RegisterConsoleLogger();

// 优先级：命令行参数 > config.json
const {
  httpPort,
  httpsPort,
  streamerPort,
  homepageFile,
  LogToFile,
  UseHTTPS,
  peerConnectionOptions,
} = Object.assign(require("./config.json"), require("./modules/argument.js"));

if (LogToFile) {
  logging.RegisterFileLogger("./logs");
}

var http = require("http").Server(app);

if (UseHTTPS) {
  //HTTPS certificate details
  const options = {
    key: fs.readFileSync(path.join(__dirname, "./certificates/client-key.pem")),
    cert: fs.readFileSync(
      path.join(__dirname, "./certificates/client-cert.pem")
    ),
  };

  var https = require("https").Server(options, app);
}

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

if (UseHTTPS) {
  //Setup http -> https redirect
  console.log("Redirecting http->https");
  app.use(function (req, res, next) {
    if (!req.secure) {
      if (req.get("Host")) {
        var hostAddressParts = req.get("Host").split(":");
        var hostAddress = hostAddressParts[0];
        if (httpsPort != 443) {
          hostAddress = `${hostAddress}:${httpsPort}`;
        }
        return res.redirect(
          ["https://", hostAddress, req.originalUrl].join("")
        );
      } else {
        console.error(
          `unable to get host name from header. Requestor ${req.ip
          }, url path: '${req.originalUrl}', available headers ${JSON.stringify(
            req.headers
          )}`
        );
        return res.status(400).send("Bad Request");
      }
    }
    next();
  });
}

app.use("/", express.static(path.join(__dirname, "/public")));

app.get("/", function (req, res) {
  const homepageFilePath = path.join(__dirname, homepageFile);

  res.sendFile(homepageFilePath);
});

//Setup http and https servers
http.listen(httpPort, function () {
  console.logColor(logging.Green, "Http listening on *: " + httpPort);
});

if (UseHTTPS) {
  https.listen(httpsPort, function () {
    console.logColor(logging.Green, "Https listening on *: " + httpsPort);
  });
}

const WebSocket = require("ws");

let streamerServer = new WebSocket.Server({ port: streamerPort, backlog: 1 });
console.logColor(
  logging.Green,
  `WebSocket listening to Streamer connections on :${streamerPort}`
);
let streamer; // WebSocket connected to Streamer

streamerServer.on("connection", function (ws, req) {
  console.logColor(
    logging.Cyan,
    `Streamer connected: ${req.socket.remoteAddress}:${req.socket.remotePort}`
  );

  ws.on("message", function onStreamerMessage(msg) {
    console.logColor(logging.Blue, `<- Streamer: ${msg}`);

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
  server: UseHTTPS ? https : http,
});
console.logColor(
  logging.Green,
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
  console.logColor(
    logging.Cyan,
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
    console.logColor(logging.Blue, `<- player ${playerId}: ${msg}`);

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
    console.logColor(
      logging.Yellow,
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
