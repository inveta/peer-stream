# UE5 Pixel Streaming SDK [中文](README-zh.md) [English](README.md)

Compared to EpicGame's heavily-designed SDK for Pixel Streaming, peer-stream.js is a lightweight WebRTC library with 0 dependency, containing a frontend component (using WebComponents API), along with a signaling server (using NodeJS).

- peer-stream.js: browser SDK for player
- signal.js: node.js signaling server
- signal.json: configure signal.js
- signal.html: GUI for signal.js and example for peer-stream.js

## Demo

```s
# install WebSocket
npm install ws@8.5.0

# start Signaling Server
node signal.js

# start packaged UE5
start path/to/UE5.exe -PixelStreamingURL="ws://localhost:88"

# visit webpage
start http://localhost:88/signal.html
```

## signal.json

| options       | type     | default | usage                                                               |
| ------------- | -------- | ------- | ------------------------------------------------------------------- |
| PORT          | number   | 88      | WebSocket/HTTP port for player & UE5                                |
| UE5           | string[] | []      | run command when player connected (UE5 auto start)                  |
| one2one       | bool     | false   | one-to-one mapping for player & UE5                                 |
| auth          | string   | ''      | HTTP Basic Auth username:password                                   |
| boot          | bool     | false   | node signal.js on system boot                                       |
| exeUeCoolTime | number   | 60      | Time interval between starting the same UE instance again next time |
| preload       | int      | 1       | Number of pre started UE instances                                  |

### Load Balance

`signal.js` accept multi UE5 & player connections, where each UE5 maps to multi-players with load-balancing. Turn `one2one` on to keep one-to-one mapping. Provide `UE5` to start UE5 automatically. All configs in `signal.json`.

## Unreal Engine

enable the plugin:

```s
Plugins > Built-In > Graphics > Pixel Streaming > Enabled
Editor Preferences > Level Editor > Play > Additional Launch Parameters
start path/to/UE5.exe -{key}={value}
```

common startup options:

```s
 -PixelStreamingURL="ws://localhost:88"
 -RenderOffScreen
 -Unattended
 -GraphicsAdapter=0
 -ForceRes
 -ResX=1280
 -ResY=720
 -PixelStreamingWebRTCFps=30
 -Windowed
 -AudioMixer
 -AllowPixelStreamingCommands
 -PixelStreamingEncoderRateControl=VBR
```

## peer-stream.js

HTML:

```html
<script src="//localhost:88/peer-stream.js"></script>
<video is="peer-stream" id="ws://127.0.0.1:88/"></video>
```

or JavaScript:

```html
<script type="module">
import "//localhost:88/peer-stream.js";
const ps = document.createElement("video", { is: "peer-stream" });
ps.id = "ws://127.0.0.1:88/";
document.body.append(ps);
</script>
```

### Messages

sending messages:

```js
// object will be JSON.stringify()
ps.emitMessage(msg: string | object);
```

receiving messages:

```js
ps.addEventListener("message", e => {
    // JSON.parse(e.detail)
});
```

## Requirement

- Google Chrome 90+
- Unreal Engine 5.0.3
- NodeJS 14+
- npm/ws 8.0+

## © MIT License

Copyright (c) 2020-2024 Inveta

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
