process.env.player = 88
process.env.engine = 8888
process.env.token = 'hello'
process.env.limit = 4
process.env.throttle = true
process.env.UE5 = 'start demo.exe -Unattended -RenderOffScreen -PixelStreamingURL=ws://127.0.0.1:8888 -graphicsadapter=0 -ProjectID=UE5';
 
require('./signal.js')

// start http://localhost:88/test.html