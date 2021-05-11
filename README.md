![](logo.png)

# Pixel Streamer

Lightweight WebRTC frontend SDK (including signalling channel) for UnrealEngine's PixelStreaming plugin. PixelStreamer is out-of-box single file with zero dependency compared to official SDK.

- Official SDK: https://github.com/EpicGames/UnrealEngine/tree/release/Engine/Source/Programs/PixelStreaming/WebServers/SignallingWebServer
- Pixel Streaming Protocol: https://github.com/EpicGames/UnrealEngine/tree/release/Engine/Plugins/Media/PixelStreaming
- Adapter for IOS: https://webrtc.github.io/adapter/adapter-latest.js
- Online CDN: https://xosg.github.io/PixelStreamer/PixelStream.js

## Signalling Server

```
npm install ws
node signalling.js playerPort=88 UE4port=8888
```

## UE4

```
// Editor Preferences > Level Editor > Play > Additional Launch Parameters

-AudioMixer
-RenderOffScreen
-PixelStreamingPort=8888
-PixelStreamingIP=localhost
-AllowPixelStreamingCommands
```

## Frontend

```
import 'PixelStream.js';

const ps = new PixelStream('wss://localhost');

ps.addEventListener('open', e => {
    document.body.appendChild(ps.video);
});
ps.addEventListener('message', e => {
    ps.emitDescriptor(e.detail);
});
```

## Requirement

- Chrome
- NodeJS 10+
- Unreal Engine 4+

## License

[Apache-2.0](./LICENSE)
