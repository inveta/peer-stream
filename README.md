# UE5 Pixel Streaming

Compared to EpicGame's heavily-designed SDK for Pixel Streaming, peer-stream.js is a lightweight WebRTC library with 0 dependency, containing a frontend component (using WebComponents API), along with a signaling server (using NodeJS).

- peer-stream.js: browser SDK for player.
- signal.js: node.js signaling server.
- .signal.js: signal.js with env variables.
- test.html: browser web page.

## Demo

```s
# install WebSocket
npm install ws@8.5.0

# start Signaling Server
player=88 engine=8888 node signal.js

# visit webpage
start http://localhost:88/test.html
```

## Env Variables for signal.js

| env      | type      | default   | usage                                                     |
| -------- | --------- | --------- | --------------------------------------------------------- |
| player   | number    | 88        | WS port number for player                                 |
| engine   | number    | 8888      | WS port number for UE5                                    |
| http     | bool      | false     | serve http static files (same port with player)           |
| UE5_*    | string[ ] |           | run command when player connected (e.g. starting UE5.exe) |
| one2one  | bool      | false     | one-to-one mapping for player & UE5                       |
| token    | string    |           | authenticate the player                                   |
| limit    | number    | +Infinity | limit max number of players connected                     |
| throttle | bool      | false     | WebSocket throttle, prevent frequent reconnection         |

## Load Balance in signal.js

signal.js accept multi UE5 & player connections, where each UE5 maps to multi-players with load-balancing. Turn `one2one` on to keep one-to-one mapping. Provide `UE5_*` to start UE5 automatically. More detailed example in `.signal.js`.

## Unreal Engine

enable the plugin:

```s
Plugins > Built-In > Graphics > Pixel Streaming > Enabled
Editor Preferences > Level Editor > Play > Additional Launch Parameters
start myPackagedGame.exe -{key}={value}
```

common startup options:

```s
 -PixelStreamingURL="ws://localhost:8888"
 -RenderOffScreen
 -Unattended
 -GraphicsAdapter=0
 -ForceRes
 -windowed
 -ResX=1280
 -ResY=720
 -AudioMixer
 -AllowPixelStreamingCommands
 -PixelStreamingEncoderRateControl=VBR
```

## peer-stream.js

HTML:

```html
<script src="peer-stream.js"></script>
<video is="peer-stream" signal="ws://127.0.0.1:88/hello"></video>
```

or JavaScript:

```html
<script type="module">
import "peer-stream.js";
const ps = document.createElement("video", { is: "peer-stream" });
ps.setAttribute("signal", "ws://127.0.0.1:88/hello");
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
    e.detail;   // string
});
```

## Requirement

- Google Chrome 90+
- Unreal Engine 5.0.0+
- NodeJS 14+
- npm/ws 8.0+

## © MIT License

Copyright (c) 2020-2022 XOSG

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
