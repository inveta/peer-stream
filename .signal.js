// require('child_process').exec(`start http://localhost:88/test.html`);

// 设置环境变量

// 唯一端口号
process.env.PORT = 88

// process.env.token = "/test.html";
// process.env.limit = 4;
process.env.throttle = true

// 一对一
// process.env.one2one = true;

// 自启动脚本池，以"UE5_"开头
process.env.UE5_GPU_0 =
  'start C:/Users/admin/Desktop/Windows/gza.exe -Unattended -RenderOffScreen -PixelStreamingURL=ws://127.0.0.1:88/ -GraphicsAdapter=0 -ProjectID=GPU_0 -ForceRes -ResX=1920 -ResY=1080 -AllowPixelStreamingCommands'
process.env.UE5_GPU_1 =
  'start C:/Users/admin/Desktop/Windows/gza.exe -Unattended -RenderOffScreen -PixelStreamingURL=ws://127.0.0.1:88/ -GraphicsAdapter=0 -ProjectID=GPU_1 -AllowPixelStreamingCommands'
process.env.UE5_GPU_2 =
  'start C:/Users/admin/Desktop/Windows/gza.exe -Unattended -RenderOffScreen -PixelStreamingURL=ws://127.0.0.1:88/ -GraphicsAdapter=0 -ProjectID=GPU_2 -AllowPixelStreamingCommands'

// 预加载1个空闲的UE5进程
// process.env.preload = 1;

// process.env.UE5_10_0_42_16 = 'curl http://10.0.42.16/RUN-UE5'

//启动UE实例的冷却时间
//process.env.exeUeCoolTime = 60

//ice配置
process.env.iceServers = [
  {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
      'stun:stun3.l.google.com:19302',
      'stun:stun4.l.google.com:19302',
    ],
  },
]
require('./signal.js')
