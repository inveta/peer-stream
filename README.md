![](logo.png)


# Pixel Streamer

Lightweight PixelStreaming frontend SDK (with signalling channel) for UnrealEngine's PixelStreaming plugin. Culling many expensive libraries and useless codes from original version.

Original Version:
https://github.com/EpicGames/UnrealEngine/tree/release/Engine/Source/Programs/PixelStreaming/WebServers/SignallingWebServer

Adapter for IOS:
https://webrtc.github.io/adapter/adapter-latest.js





## Signalling Server
```
npm install ws
node signalling.js playerPort=80 UE4port=8888
```

 
## UE4
```
// Editor Preferences > Level Editor > Play > Additional Launch Parameters

-RenderOffScreen 
-AllowPixelStreamingCommands 
-AudioMixer 
-PixelStreamingIP=localhost 
-PixelStreamingPort=8888
```



## Frontend
```
import 'PixelStream.js';

const ps = new PixelStream('ws://localhost');

ps.registerMouseHoverEvents();
ps.registerKeyboardEvents();
ps.registerTouchEvents();

ps.addEventListener('connected', e => {
    document.body.appendChild(ps.video);
});
ps.addEventListener('message', ({detail}) => {
    ps.emitDescriptor('received');
});
```





## Requirement
- Chrome
- NodeJS 10+
- Unreal Engine 4+
