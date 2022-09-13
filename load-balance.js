const { Worker } = require("node:worker_threads");
new Worker("./signal.js", {
  env: {
    player: 88,
    engine: 8888,
    limit: 1,
    UE5: "start C:/Users/admin/Desktop/Windows/gza.exe -Unattended -RenderOffScreen -PixelStreamingURL=ws://127.0.0.1:8888 -graphicsadapter=0 -ProjectID=8888",
  },
});

new Worker("./signal.js", {
  env: {
    player: 89,
    engine: 8889,
    limit: 1,
    UE5: "start C:/Users/admin/Desktop/Windows/gza.exe -Unattended -RenderOffScreen -PixelStreamingURL=ws://127.0.0.1:8889 -graphicsadapter=0 -ProjectID=8889",
  },
});

new Worker("./signal.js", {
  env: {
    player: 90,
    engine: 8890,
    limit: 1,
    UE5: "start C:/Users/admin/Desktop/Windows/gza.exe -Unattended -RenderOffScreen -PixelStreamingURL=ws://127.0.0.1:8890 -graphicsadapter=0 -ProjectID=8890",
  },
});

const pool = ["ws://localhost:88", "ws://localhost:89", "ws://localhost:90"];
const { Server } = require("ws");

const redirect = new Server({ port: 80 }, () => {
  console.log("ws://localhost/");
});

redirect.on("connection", (ws, req) => {
  ws.close(3333, pool[0]);
  pool.push(pool.shift());
});
