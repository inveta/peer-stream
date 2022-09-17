"5.0.3";

const WebSocket = require("ws");

global.ENGINE = new WebSocket.Server(
  { port: +process.env.engine || 8888, clientTracking: true },
  () => { }
);

ENGINE.on("connection", (ue, req) => {
  ue.req = req;

  ue.on("message", (msg) => {
    try {
      msg = JSON.parse(msg);
    } catch (err) {
      // console.error("? Engine:", msg);
      return;
    }

    // Convert incoming playerId to a string if it is an integer, if needed. (We support receiving it as an int or string).

    if (msg.type === "ping") {
      ue.send(JSON.stringify({ type: "pong", time: msg.time }));
      return;
    }

    // player's port as playerID
    const fe = [...PLAYER.clients].find((fe) => fe.req.socket.remotePort === +msg.playerId);
    if (!fe) {
      // console.error("? player not found:", playerId);
      return;
    }

    delete msg.playerId; // no need to send it to the player
    if (["offer", "answer", "iceCandidate"].includes(msg.type)) {
      fe.send(JSON.stringify(msg));
    } else if (msg.type == "disconnectPlayer") {
      fe.close(1011, msg.reason);
    } else {
      // console.error("? invalid Engine message type:", msg.type);
    }
  });

  ue.on("close", (code, reason) => {
    // reason is buffer ??
    // for (const client of PLAYER.clients) {
    //   client.send(`Engine stopped`);
    // }
    print();
  });

  ue.on("error", (error) => {
    // console.error("! Engine connection error:", error);
    // A control frame must have a payload length of 125 bytes or less
    // ue.close(1011, error.message.slice(0, 100));
  });

  // sent to Unreal Engine as initial signal
  ue.send(
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

  for (const fe of PLAYER.clients) {
    if (fe.req.url === req.url) {
      fe.ue = ue;
      ue.send(
        JSON.stringify({
          type: "playerConnected",
          playerId: fe.req.socket.remotePort,
          dataChannel: true,
          sfu: false,
        })
      );
    }
  }
  print();
});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const http = require("http");

const fs = require("fs");
const path = require("path");
function onRequest(req, res) {
  // websocket请求时不触发
  // serve HTTP static files

  const r = fs.createReadStream(path.join(__dirname, req.url));

  r.on("error", (err) => {
    res.end(err.message);
  });

  r.on("ready", () => {
    r.pipe(res);
  });
}

const child_process = require("child_process");

// front end
global.PLAYER = new WebSocket.Server({
  server: http
    .createServer(process.env.http ? onRequest : undefined)
    .listen(+process.env.player || 88, () => {
      // console.log("signaling for player:", +process.env.player || 88);
    }),
  // port:   88,
  clientTracking: true,
});
// every player
PLAYER.on("connection", (fe, req) => {
  fe.req = req;

  fe.ue = [...ENGINE.clients].find((ue) => ue.req.url === req.url) || {};

  // password
  // if (process.env.token) {
  //   if (req.url.slice(1) !== process.env.token) {
  //     fe.close();
  //     return;
  //   }
  // }

  // players max count
  if (process.env.limit) {
    if (PLAYER.clients.size > +process.env.limit) {
      fe.close();
      return;
    }
  }

  // throttle
  if (process.env.throttle) {
    if (global.throttle) {
      fe.close();
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
    if (fe.ue.readyState !== WebSocket.OPEN) {
      child_process.exec(
        process.env.UE5.replaceAll("/path", req.url),
        {
          cwd: __dirname,
        },
        (err, stdout, stderr) => {

        }
      );
    }
  }



  fe.on("message", (msg) => {
    if (fe.ue.readyState !== WebSocket.OPEN) {
      fe.send(`! Engine not ready`);
      return;
    }

    try {
      msg = JSON.parse(msg);
    } catch (err) {
      fe.send("? " + msg.slice(0, 100));
      return;
    }

    // console.log("player", playerId, msg.type);

    msg.playerId = req.socket.remotePort;
    if (["answer", "iceCandidate"].includes(msg.type)) {
      fe.ue.send(JSON.stringify(msg));
    } else if (msg.type === "debug") {
      let debug;
      try {
        debug = String(eval(msg.debug));
      } catch (err) {
        debug = err.message;
      }
      fe.send("【debug】" + debug);
    } else {
      fe.send("? " + msg.type);
    }
  });

  fe.on("close", (code, reason) => {
    if (fe.ue.readyState === WebSocket.OPEN)
      fe.ue.send(JSON.stringify({ type: "playerDisconnected", playerId: req.socket.remotePort }));

    print();
  });

  fe.on("error", (error) => {
    // console.error("! player", playerId, "connection error:", error);
  });

  if (fe.ue.readyState === WebSocket.OPEN)
    fe.ue.send(
      JSON.stringify({
        type: "playerConnected",
        playerId: req.socket.remotePort,
        dataChannel: true,
        sfu: false,
      })
    );

  print();

});

// keep alive
setInterval(() => {
  for (const client of PLAYER.clients) {
    client.send("ping");
  }
}, 50 * 1000);

function print() {
  console.clear();
  const players = new Set(PLAYER.clients);

  ENGINE.clients.forEach((ue) => {
    console.log('-',
      ue.req.socket.remoteAddress,
      ue.req.socket.remotePort,
      ue.req.url
    );
    [...players]
      .filter((fe) => fe.ue === ue)
      .forEach((fe) => {
        players.delete(fe);
        console.log(
          '    |',
          fe.req.socket.remoteAddress,
          fe.req.socket.remotePort,
          fe.req.url
        );
      });
  });

  if (players.size) {
    console.log('-', "(( idle ))");
    players.forEach((fe) => {
      console.log(
        '    |',
        fe.req.socket.remoteAddress,
        fe.req.socket.remotePort,
        fe.req.url
      );
    });
  }
}


