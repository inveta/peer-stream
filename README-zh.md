# 3D 像素流: 虚幻引擎 WebRTC 核心组件

和 EpicGames 官方的像素流 SDK 相比，我们开发出了更轻量的像素流 SDK，包含 2 个文件：前端组件（WebComponents API）外加信令服务器（NodeJS）。

- signal.js：信令服务器，5KB
- peer-stream.js：前端组件，20KB

## 启动信令服务器

首先从 npm 安装 WebSocket 依赖，然后启动 signal.js。

```
npm install ws@8.2.3
node signal.js {key}={value}
```

启动选项:

| 选项   | 默认值 | 作用                 |
| ------ | ------ | -------------------- |
| player | 88     | 浏览器（玩家）端口   |
| engine | 8888   | UE4 端口             |
| token  | hello  | 信令密码（url 末端） |
| limit  | 4      | 玩家数量上限         |

## 启动 UE4

首先开启像素流插件，然后在独立启动模式的设置中，或者打包后的文件中输入启动选项。

```
Plugins > Built-In > Graphics > Pixel Streaming > Enabled
Editor Preferences > Level Editor > Play > Additional Launch Parameters
start packaged.exe -{key}={value}
```

常用的启动选项：

```
 -ForceRes
 -ResX=1920
 -ResY=1080
 -AudioMixer
 -RenderOffScreen
 -graphicsadapter=0
 -AllowPixelStreamingCommands
 -PixelStreamingEncoderRateControl=VBR
 -PixelStreamingURL="ws://localhost:8888"
```

## 前端的 2 种调用方法

JavaScript:

```
import "peer-stream.js";
const ps = document.createElement("video", { is: "peer-stream" });
ps.setAttribute("signal", "ws://127.0.0.1:88/hello");
document.body.append(ps);
```

or HTML:

```
<script src="peer-stream.js"></script>
<video is="peer-stream" signal="ws://127.0.0.1:88/hello"></video>
```

## 常用的调试命令

信令服务器可以通过 eval 函数解释执行任意的 NodeJS 代码，使用时需要注意安全。

```
ps.debug('PLAYER.clients.size')   // 显示玩家数量
ps.debug('PLAYER.clients.forEach(p=>p.playerId!==playerId&&p.close(1011,"Infinity"));limit=1;')  // 移除其他玩家
ps.debug('[...PLAYER.clients].map(x=>x.req.socket.remoteAddress)')  // 每个玩家的IP地址
ps.debug('playerId')  // 我的ID
ps.onmouseenter=_=>{ps.focus();ps.requestPointerLock()})    // 鼠标锁
ps.style.pointerEvents='none'   // 只读的<video>
```

## 常见排错方法和技巧（前后端、测试组、三维组遇到的各种坑汇总）

- nginx 代理时，心跳超时问题。
- video 标签被遮挡（等 UI 和样式问题）。
- video 标签是否存在、是否在 DOM 中（window 和 parent 上都挂有 ps）。
- 其他 WebSocket 请求堵塞单线程，导致信令被挂起。
- 所有依赖升级到最新版，包括浏览器、NodeJS、UE4、像素流。
- 网络问题：是否能 ping 通，是否开了防火墙（可用 test/unreal.html 测试）。
- 高频的 WebRTC 重连导致 UE4 崩溃。
- 通过 ps.ws 检查信令服务，通过 ps.pc 检查 WebRTC。
- 网络带宽过低（至少 10m 才能跑一路视频，启动 VBR 以节省带宽）。
- 前端意外打包 peer-stream.js 导致文件出错。
- 检查当前人数是否已满（limit）。
- UE4 跑了几天几夜后需要重启，否则画面撕裂。
- CPU、GPU 超负荷导致视频卡顿。
- 检查信令密码（token）。
- 浏览器 console 中可以看到各种日志，其中 verbose 一栏可查看周期性日志。
- UE4 还未启动完全的时候，不要发请求。
- 使用 ps.debug 在信令服务器上执行任意的 NodeJS 代码并返回结果至前端。
- UE4 是否成功地启用了像素流插件。
- 信令服务器和 UE4 一一对应，与玩家（浏览器）一对多，多余的玩家和多余 UE4 无法连接到信令。
- 前端 Vue 框架集成 peer-stream.js 静态文件的问题（如路径问题）。
- UE 端通过检查启动命令行来判断像素流的相关信息。
- 不需要像素流的时候只要把 video 移出 DOM 即可，不用手动关闭 WebRTC。
- 访问外网时，需要添加 stun。
- 修改 signal、ip、port、token 属性会触发重连。
- 默认不接收音频，需要的话得手动开启。
- 使用 test/index.html 进行前端测试，可以监控 WebRTC。
- 像素流 2 个 js 文件的版本号和虚幻引擎的版本号同步。
- 在任务管理器中通过“命令行”一列获悉 UE4 程序的启动参数。
- 窗口模式下（非后台）运行时，最小化窗口会导致视频流暂停。

## 丑化 JS 代码

为了屏蔽我们的开发环境（虚幻引擎），需要对 JS 文件进行丑化，删除关键字，替换变量名。

```
npm install uglify-js -g
uglifyjs peer-stream.js > ps.min.js
uglifyjs signal.js > signal.min.js
```

## 软件要求

- Google Chrome 88+
- Unreal Engine 4.27+
- NodeJS 14+
- npm/ws 8.0+
