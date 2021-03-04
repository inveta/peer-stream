![](logo.png)


# Pixel Streamer

Lightweight PixelStreaming frontend SDK (with signalling channel) for UnrealEngine's PixelStreaming plugin. Culling all dependencies and useless codes from original version.

Original Version:
https://github.com/EpicGames/UnrealEngine/tree/release/Engine/Source/Programs/PixelStreaming/WebServers/SignallingWebServer

Pixel Streaming Protocol:
https://github.com/EpicGames/UnrealEngine/tree/release/Engine/Plugins/Media/PixelStreaming

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

-AudioMixer 
-RenderOffScreen 
-PixelStreamingPort=8888 
-PixelStreamingIP=localhost 
-AllowPixelStreamingCommands 
```



## Frontend
```
import 'PixelStream.js';

const ps = new PixelStream('ws://localhost');

ps.registerMouseHoverEvents();
ps.registerKeyboardEvents();
ps.registerTouchEvents();

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