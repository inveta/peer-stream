"http://localhost:88/test.html";

process.env.player = 88;
process.env.engine = 8888;
process.env.token = "hello";
process.env.limit = 4;
process.env.throttle = true;
process.env.http = true;
process.env.UE5 =
  "start C:/Users/admin/Desktop/Windows/demo.exe -Unattended -RenderOffScreen -PixelStreamingURL=ws://127.0.0.1:8888/path -graphicsadapter=0 -ProjectID=/path";

require("./signal.js");

