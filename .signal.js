"http://localhost:88/test.html";

// 前端端口
process.env.player = 88;
// UE5端口
process.env.engine = 8888;

// process.env.token = "/hello";
process.env.limit = 4;
process.env.throttle = true;

// 开启静态文件服务，同WS端口
process.env.http = true;

// 一对一
process.env.one2one = true;

// 自启动脚本池，以"UE5_"开头
process.env.UE5_GPU_0 = "start C:/Users/admin/Desktop/Windows/demo.exe -Unattended -RenderOffScreen -PixelStreamingURL=ws://127.0.0.1:8888/ -GraphicsAdapter=0 -ProjectID=GPU_0";
process.env.UE5_GPU_1 = "start C:/Users/admin/Desktop/Windows/demo.exe -Unattended -RenderOffScreen -PixelStreamingURL=ws://127.0.0.1:8888/ -GraphicsAdapter=0 -ProjectID=GPU_1";
process.env.UE5_GPU_2 = "start C:/Users/admin/Desktop/Windows/demo.exe -Unattended -RenderOffScreen -PixelStreamingURL=ws://127.0.0.1:8888/ -GraphicsAdapter=0 -ProjectID=GPU_2";

// process.env.UE5_GZA = 'curl http://v4.gza.com/run_UE5'

require("./signal.js");

