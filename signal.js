"5.0.3";

const { Server } = require("ws");

global.ENGINE = new Server(
  { port: +process.env.engine || 8888, clientTracking: true },
  () => { }
);

ENGINE.on("connection", (ue, req) => {
  ue.req = req;

  ue.fe = new Set()
  // sent to UE5 as initial signal
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

  // 认领空闲的前端们
  for (const fe of PLAYER.clients) {
    if (!fe.ue) {
      fe.ue = ue;
      ue.fe.add(fe)
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

  ue.on("message", (msg) => {
    msg = JSON.parse(msg);


    // Convert incoming playerId to a string if it is an integer, if needed. (We support receiving it as an int or string).

    if (msg.type === "ping") {
      ue.send(JSON.stringify({ type: "pong", time: msg.time }));
      return;
    }

    // player's port as playerID
    const fe = [...ue.fe].find((fe) =>
      fe.req.socket.remotePort === +msg.playerId
    );
    if (!fe) {
      // console.error("? player not found:", playerId);
      return;
    }

    delete msg.playerId; // no need to send it to the player
    if (["offer", "answer", "iceCandidate"].includes(msg.type)) {
      fe.send(JSON.stringify(msg));
    } else if (msg.type === "disconnectPlayer") {
      fe.close(1011, msg.reason);
    } else {
      // console.error("? invalid Engine message type:", msg.type);
    }
  });

  ue.on("close", (code, reason) => {

    ue.fe.forEach(fe => fe.ue = null)
    print();
  });

  ue.on("error", (error) => {
    // A control frame must have a payload length of 125 bytes or less
    // ue.close(1011, error.message.slice(0, 100));
  });


});
































function onRequest(req, res) {
  // websocket请求时不触发
  // serve HTTP static files

  const read = require("fs").createReadStream(
    require("path").join(__dirname, req.url)
  );

  read.on("error", (err) => {
    res.end(err.message);
  }).on("ready", () => {
    read.pipe(res);
  });
}



const pool = Object.entries(process.env)
  .filter(([key]) => key.startsWith('UE5_'))
  .map(([, value]) => value)

// front end
global.PLAYER = new Server({
  server: require("http")
    .createServer(process.env.http ? onRequest : undefined)
    .listen(+process.env.player || 88, () => { }),
  // port:   88,
  clientTracking: true,
});
// every player
PLAYER.on("connection", (fe, req) => {
  fe.req = req;

  if (process.env.one2one) {
    fe.ue = [...ENGINE.clients].find(ue => ue.fe.size === 0)
  } else {
    fe.ue = [...ENGINE.clients].sort((a, b) => a.fe.size - b.fe.size)[0]
  }


  // password
  if (process.env.token) {
    if (req.url !== process.env.token) {
      fe.close();
      return;
    }
  }

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






  if (fe.ue) {
    fe.ue.fe.add(fe)
    fe.ue.send(
      JSON.stringify({
        type: "playerConnected",
        playerId: req.socket.remotePort,
        dataChannel: true,
        sfu: false,
      })
    );
  } else if (pool.length) {
    require("child_process").exec(
      pool[0],
      { cwd: __dirname, },
      (err, stdout, stderr) => { }
    );
    pool.push(pool.shift())

  }



  print();



  fe.on("message", (msg) => {
    if (!fe.ue) {
      fe.send(`! Engine not ready`);
      return;
    }

    msg = JSON.parse(msg);

    // console.log("player", playerId, msg.type);

    msg.playerId = req.socket.remotePort;
    if (["answer", "iceCandidate"].includes(msg.type)) {
      fe.ue.send(JSON.stringify(msg));
    } else {
      fe.send("? " + msg.type);
    }
  });

  fe.on("close", (code, reason) => {
    if (fe.ue) {
      fe.ue.send(JSON.stringify({
        type: "playerDisconnected",
        playerId: req.socket.remotePort
      }));
      fe.ue.fe.delete(fe)
    }


    print();
  });

  fe.on("error", (error) => {
    // console.error("! player", playerId, "connection error:", error);
  });



});

// keep alive
setInterval(() => {
  for (const fe of PLAYER.clients) {
    fe.send("ping");
  }
}, 50 * 1000);

// 打印映射关系
function print() {
  console.clear();
  console.log()

  ENGINE.clients.forEach(ue => {
    console.log(
      ue.req.socket.remoteAddress,
      ue.req.socket.remotePort,
      ue.req.url
    );
    ue.fe.forEach(fe => {
      console.log(
        '     ',
        fe.req.socket.remoteAddress,
        fe.req.socket.remotePort,
        fe.req.url
      );
    })
  })

  const fe = [...PLAYER.clients].filter(fe => !fe.ue)
  if (fe.length) {
    console.log("idle players:");
    fe.forEach(fe => {
      console.log(
        '     ',
        fe.req.socket.remoteAddress,
        fe.req.socket.remotePort,
        fe.req.url
      );
    })
  }


}


