![](logo.png)

# Pixel Streamer: Unreal + WebRTC

PixelStreamer is a lightweight WebRTC frontend SDK (using WebComponents API), along with a signaling server (using NodeJS) for UnrealEngine's PixelStreaming plugin. PixelStreamer is an out-of-box single file with 0 dependency compared to EpicGame's SDK.

- PixelStream.js: https://xosg.github.io/PixelStreamer/PixelStream.js
- signal.js: https://xosg.github.io/PixelStreamer/signal.js
- WebSocket for NodeJS: https://www.npmjs.com/package/ws
- EpicGame's SDK: https://github.com/EpicGames/UnrealEngine/tree/release/Samples/PixelStreaming/WebServers/SignallingWebServer
- Pixel Streaming Protocol: https://github.com/EpicGames/UnrealEngine/tree/release/Engine/Plugins/Media/PixelStreaming
- Adapter for IOS: https://webrtc.github.io/adapter/adapter-latest.js

## Signaling Server

```
npm install ws@8.2.2
node signal.js {key}={value}
```

startup options:

| key    | default | usage                    |
| ------ | ------- | ------------------------ |
| player | 88      | browser port             |
| unreal | 8888    | unreal engine port       |
| token  | insigma | password appended to URL |
| limit  | 4       | max number of players    |

## UE4

```
// Plugins > Built-In > Graphics > Pixel Streaming > Enabled
// Editor Preferences > Level Editor > Play > Additional Launch Parameters
// start packaged.exe -{key}={value}
```

frequently used startup options:

```
 -ForceRes
 -ResX=1920
 -ResY=1080
 -AudioMixer
 -RenderOffScreen
 -graphicsadapter=1
 -AllowPixelStreamingCommands
 -PixelStreamingEncoderRateControl=VBR
 -PixelStreamingURL="ws://localhost:8888"
```

## Frontend

JavaScript:

```
import "PixelStream.js";
const ps = document.createElement("video", { is: "pixel-stream" });
ps.setAttribute("signal", "ws://127.0.0.1:88/insigma");
document.body.appendChild(ps);
```

or HTML:

```
<script src="PixelStream.js"></script>
<video is="pixel-stream" signal="ws://127.0.0.1:88/insigma"></video>
```

## APIs

lifecycle:

```
video.addEventListener("open", e => {});
video.addEventListener("message", e => {});
video.addEventListener("close", e => {});
```

Mouse, Keyboard, Touch events:

```
video.registerTouchEvents()
video.registerKeyboardEvents()
video.registerFakeMouseEvents()
video.registerMouseHoverEvents()
video.registerPointerlockEvents()
```

## Frequently Used Commands

```
ps.debug('PLAYER.clients.size')   // show players count
ps.debug('PLAYER.clients.forEach(p=>p.playerId!==playerId&&p.close(1011,"Infinity"));limit=1;')  // kick other players
ps.debug('[...PLAYER.clients].map(x=>x.req.socket.remoteAddress)')  // every player's IP
ps.debug('playerId')  // show my id
ps.pc.getReceivers().find(x=>x.track.kind==='video').transport.iceTransport.getSelectedCandidatePair().remote    // show selected candidate
ps.addEventListener('mouseenter',_=>ps.focus()||ps.requestPointerLock())    // pointer lock
ps.style.pointerEvents='none'   // read only <video>
```

## Requirement

- Google Chrome 88+
- Unreal Engine 4.27+
- NodeJS 14+
- npm/ws 8.0+

## License

[MIT](./LICENSE)
