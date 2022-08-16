# peer-stream.js

Compared to EpicGame's heavily-designed SDK for Pixel Streaming, peer-stream.js is a lightweight WebRTC library with 0 dependency, containing a frontend component (using WebComponents API), along with a signaling server (using NodeJS).

- peer-stream.js: frontend SDK.
- signal.js: signaling server.
- signal-pro.js: signaling server with advanced features.
- package.json: maintain all parameters.
- test.html: frontend page.

## Signaling Server

```
# install WebSocket
npm install ws@8.5.0

# start Signaling Server
node signal.js player=88 engine=8888

# or start Signaling Server Pro
node signal-pro.js player=88 engine=8888
```

## signal-pro.js

- require("signal.js");
- authenticate player with token before connection;
- limit max number of players connected;
- WebSocket throttle, prevent frequent reconnection; (or UE5 will crash)
- start UE5 automatically when player connected; (using package.json)
- serve HTTP static files; (share same port with WebSocket)

## Unreal Engine

enable the plugin:

```
Plugins > Built-In > Graphics > Pixel Streaming > Enabled
Editor Preferences > Level Editor > Play > Additional Launch Parameters
start myPackagedGame.exe -{key}={value}
```

common startup options:

```
 -PixelStreamingURL="ws://localhost:8888"
 -RenderOffScreen
 -Unattended
 -graphicsadapter=0
 -ForceRes
 -windowed
 -ResX=1280
 -ResY=720
 -AudioMixer
 -AllowPixelStreamingCommands
 -PixelStreamingEncoderRateControl=VBR
```

## Browser

HTML:

```
<script src="peer-stream.js"></script>
<video is="peer-stream" signal="ws://127.0.0.1:88/hello"></video>
```

or JavaScript:

```
<script type="module">
import "peer-stream.js";
const ps = document.createElement("video", { is: "peer-stream" });
ps.setAttribute("signal", "ws://127.0.0.1:88/hello");
document.body.append(ps);
</script>
```

## Messages

sending messages:

```
// object will be JSON.stringify()
ps.emitMessage(msg: string | object);
```

receiving messages:

```
ps.addEventListener("message", e => {
    e.detail;   // string
});
```

## Common Commands

```
ps.debug('PLAYER.clients.size')   // show players count
ps.debug('PLAYER.clients.forEach(p=>p.playerId!==playerId&&p.close(1011,"Infinity"));limit=1;')  // kick other players
ps.debug('[...PLAYER.clients].map(x=>x.req.socket.remoteAddress)')  // every player's IP
ps.debug('playerId')  // show my id
console.log(ps.pc.remoteDescription.sdp)    // show peer info
ps.addEventListener('mouseenter',()=>{ps.focus();ps.requestPointerLock()})    // pointer lock
ps.style.pointerEvents='none'   // read only <video>
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
