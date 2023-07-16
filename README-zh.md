# 虚幻引擎UE5 像素流 依赖 [中文](README-zh.md) [English](README.md)

和官方臃肿不堪的像素流SDK相比，我们在官方的基础上做了大量的优化和精简，开发出了轻量、零依赖、开箱即用的软件套装，前端的peer-stream.js基于WebComponentsAPI，后端signal.js基于NodeJS和npm/ws。

 | 文件名         | 大小 | 作用                         |
 | -------------- | ---- | ---------------------------- |
 | peer-stream.js | 18KB | 浏览器SDK，一键开启。        |
 | signal.js      | 5KB  | 信令服务器、负载均衡、认证。 |
 | .signal.js     | <1KB | 通过环境变量调节signal.js。  |
 | test.html      | 3KB  | 测试网页。                   |

## 示例

```s
# 安装 WebSocket
npm install ws@8.5.0

# 启动信令服务器
PORT=88 node signal.js

# 启动 UE5
start path/to/UE5.exe -PixelStreamingURL="ws://localhost:88"

# 打开测试网页
start http://localhost:88/test.html
```

## signal.js 信令服务器

signal.js在官方库的基础上做了大量优化

- 文件只有5KB，Gzip压缩后只有3KB。
- 提供http文件服务，和WebSocket共享端口号。
- 面向前端和面向UE5的端口号绑定，通过WebSocket子协议区分。
- 通过环境变量统一传参，支持命令行或配置文件。
- 提供密码认证服务。
- 可以限制最大连接数。
- 支持多个UE5连接。
- 控制台实时打印UE5和前端的多对多映射关系。
- 对WebSocket连接做节流过滤，提高稳定性。
- 支持UE5和前端一一映射。
- 前端连入时，可以自动启动UE5进程。
- 多个UE5连入时，负载均衡。
- 支持stun公网穿透，在公网间互连。
- 控制台可输入调试代码，并打印计算结果。
- 定时发送心跳连接保活。
- 前端的端口号与ID绑定。
- 窗口标题等于当前路径，方便查找文件。

### .signal.js 环境变量

| 环境变量 | 类型       | 默认值    | 功能                           |
| -------- | ---------- | --------- | ------------------------------ |
| PORT     | 正整数     | 88        | WebSocket/HTTP 全局统一端口号  |
| UE5_*    | 命令行列表 | []        | UE5自启动脚本池                |
| one2one  | 布尔       | false     | 限制UE5和前端一一映射          |
| token    | 字符串     | ''        | WebSocket 密码认证             |
| limit    | 正整数     | +Infinity | 限制前端最大连接数             |
| throttle | 布尔       | false     | WebSocket 节流，避免频繁的重连 |
| exeUeCoolTime | 正整数  | 60      | 下次再启动同一个UE实例的时间间隔  |
| preload | 正整数        | 1       | 预启动UE实例的个数  |

### 负载均衡与UE5自启动

`signal.js` 既支持多个前端连接，也支持多个UE5连接，此时前端和UE5的多对多映射关系是均衡负载的：前端会被引向最空闲的UE5进程。若想要限制一一映射关系，开启`one2one` 环境变量。最好提供 `UE5_*` 自启动命令行，更多实例参考 `.signal.js`。流程图如下：

```mermaid
flowchart TD;
    subgraph  
        player([前端连入]);
        manual([手动启动])
    end

    subgraph   
        finish([结束]);
        match([匹配]);
    end

    subgraph  
        claim[寻找空闲前端];
        start --UE5 连入--> claim;
        idle --有--> match;
        start --启动失败--> finish;
        map121 --关--> min ---> match;  
       
        map121[一一映射 ?];
        start(((启动 UE5)));
        idle[寻找空闲进程];
        min[寻找最小负载];
    
        idle --无--> start;
        player -- 有 UE5 进程 --> map121;
        map121 --开--> idle; 
        player -- 无 UE5 进程 --> start;
       
        claim --成功--> match;
        claim --404--> finish;

        manual  --命令行--> start;
    end
```

## 虚幻引擎

启动插件，并在编辑器中测试:

```s
Plugins > Built-In > Graphics > Pixel Streaming > Enabled
Editor Preferences > Level Editor > Play > Additional Launch Parameters
start path/to/UE5.exe -{key}={value}
```

常用的启动选项:

```s
 -PixelStreamingURL="ws://localhost:88"
 -RenderOffScreen
 -Unattended
 -GraphicsAdapter=0
 -ForceRes
 -Windowed
 -ResX=1280
 -ResY=720
 -AudioMixer
 -AllowPixelStreamingCommands
 -PixelStreamingEncoderRateControl=VBR
```

## peer-stream.js 前端开发包

- 文件18KB，压缩后12KB。
- 基于 Web Components API 组件化video标签。
- 断线自动重连。
- DOM生命周期绑定：挂载自动连接，卸载自动断开。
- 支持stun公网穿透。
- 全局挂载一份引用方便调试：window.ps。
- 支持5种键盘/鼠标/触屏输入模式。
- 支持3333端口重定向。
- 支持视频自动播放。
- video标签的id即信令服务器地址，默认指向网页的域名。
- 支持异步请求。（不稳定）

### 引入

纯HTML写法:

```html
<script src="peer-stream.js"></script>
<video is="peer-stream" id="ws://127.0.0.1:88/"></video>
```

或者使用JavaScript:

```html
<script type="module">
import "peer-stream.js";
const ps = document.createElement("video", { is: "peer-stream" });
ps.id = "ws://127.0.0.1:88/";
document.body.append(ps);
</script>
```

### 字符串消息收发

发送消息:

```js
// 若传入对象，会被JSON化
ps.emitMessage(msg: string | object);
```

接收消息:

```js
ps.addEventListener("message", e => {
    // JSON.parse(e.detail)
});
```

异步请求：

```js
response = await ps.emitMessage(request);
// 返回不稳定
```

### video事件监听

```js
// https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video#events
ps.addEventListener('事件名称', e => {
    // 回调函数
});
```

- "message":	接收应用层返回消息：e.detail。
- "playing":	场景开始渲染时，在该事件之后才能安全发送ps.emitMessage()。
- "suspend":	三维停止渲染时。
- "resize":	video元素被拉伸时。
- "pointerlockchange":	沉浸式鼠标切换时。
- "playerqueue":	返回用户排队情况，seq表示当前排队序号  

## IOS端Safari兼容

由于IOS端Safari不支持自定义内置元素（customized built-in element），需要在peer-stream.js之前引入兼容包：https://github.com/ungap/custom-elements 。除此之外，IOS微信内置浏览器（小程序）禁止video自动播放，必须由用户行为（点击）触发调用ps.play()来播放视频流。