require('child_process').exec(`start http://localhost:88/test.html`)

// 设置环境变量

// 唯一端口号
process.env.PORT = 88
//signal服务器IP地址
process.env.SIGNALIP = '127.0.0.1'
//启动exec-ue.js,实现跨机器负载均衡
//process.env.execue = true

// process.env.token = "/test.html";

//limit参数不再使用，改成用户排队功能，即用户websocket可以创建成功，等有新的资源之后，就可以连接上来了
// process.env.limit = 4;
process.env.throttle = true

// 一对一
process.env.one2one = true

// 自启动脚本池，以"UE5_"开头
process.env.UE5_GPU_0 =
  '127.0.0.1 start C:/ue5demo/demo.exe -Unattended -RenderOffScreen -PixelStreamingURL=ws://127.0.0.1:88/ -GraphicsAdapter=0 -ProjectID=GPU_0 -ForceRes -ResX=600 -ResY=400 -AllowPixelStreamingCommands'
process.env.UE5_GPU_1 =
  '127.0.0.1 start C:/ue5demo/demo.exe -Unattended -RenderOffScreen -PixelStreamingURL=ws://127.0.0.1:88/ -GraphicsAdapter=0 -ProjectID=GPU_1 -ForceRes -ResX=600 -ResY=400 -AllowPixelStreamingCommands'
process.env.UE5_GPU_2 =
  '127.0.0.1 start C:/ue5demo/demo.exe -Unattended -RenderOffScreen -PixelStreamingURL=ws://127.0.0.1:88/ -GraphicsAdapter=0 -ProjectID=GPU_2 -ForceRes -ResX=600 -ResY=400 -AllowPixelStreamingCommands'

// 预加载1个空闲的UE5进程
process.env.preload = 2

// process.env.UE5_10_0_42_16 = 'curl http://10.0.42.16/RUN-UE5'

if (process.env.execue) {
  require('./exec-ue')
  return
}
require('./signal.js')
