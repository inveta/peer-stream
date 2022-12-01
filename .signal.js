"http://localhost:88/test.html";

// 设置环境变量

// 唯一端口号
process.env.PORT = 88;

// process.env.token = "/test.html";
// process.env.limit = 4;
process.env.throttle = true;

// 一对一
// process.env.one2one = true;

// 自启动脚本池，以"UE5_"开头
process.env.UE5_GPU_0 = "start C:/Users/admin/Desktop/Windows/demo.exe -Unattended -RenderOffScreen -PixelStreamingURL=ws://127.0.0.1:88/ -GraphicsAdapter=0 -ProjectID=GPU_0";
process.env.UE5_GPU_1 = "start C:/Users/admin/Desktop/Windows/demo.exe -Unattended -RenderOffScreen -PixelStreamingURL=ws://127.0.0.1:88/ -GraphicsAdapter=0 -ProjectID=GPU_1";
process.env.UE5_GPU_2 = "start C:/Users/admin/Desktop/Windows/demo.exe -Unattended -RenderOffScreen -PixelStreamingURL=ws://127.0.0.1:88/ -GraphicsAdapter=0 -ProjectID=GPU_2";

// process.env.UE5_10_0_42_16 = 'curl http://10.0.42.16/RUN-UE5'

require("./signal.js");

