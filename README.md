![](logo.png)

# Pixel Streamer

Lightweight WebRTC frontend SDK (including signalling channel) for UnrealEngine's PixelStreaming plugin. PixelStreamer is out-of-box single file with zero dependency compared to official SDK.

- PixelStream.js: https://xosg.github.io/PixelStreamer/PixelStream.js
- signal.js: https://xosg.github.io/PixelStreamer/signal.js
- Official SDK: https://github.com/EpicGames/UnrealEngine/tree/release/Engine/Source/Programs/PixelStreaming/WebServers/SignallingWebServer
- Pixel Streaming Protocol: https://github.com/EpicGames/UnrealEngine/tree/release/Engine/Plugins/Media/PixelStreaming
- Adapter for IOS: https://webrtc.github.io/adapter/adapter-latest.js

## Signalling Server

```
npm install ws
node signal.js playerPort=88 UE4port=8888
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
// JavaScript
import "PixelStream.js";
document.createElement("video", { is: "pixel-stream" }).setAttribute("signal", "wss://127.0.0.1");

or:

<!-- html -->
<script src="PixelStream.js"></script>
<video is="pixel-stream" signal="wss://127.0.0.1"></video>
```

## APIs

```
// lifecycle
video.addEventListener("open", e => {});
video.addEventListener("message", e => {});
video.addEventListener("close", e => {});

// Mouse, Keyboard, Touch events
video.registerTouchEvents()
video.registerKeyboardEvents()
video.registerFakeMouseEvents()
video.registerMouseHoverEvents()
video.registerPointerlockEvents()
```

## Requirement

- Chrome 88+
- NodeJS 14+
- Unreal Engine 4+

## License

[Apache-2.0](./LICENSE)
