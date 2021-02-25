![](public/favicon.png)


# Pixel Streamer

Lightweight signaling & web server for UnrealEngine's PixelStreaming. Culling many expensive libraries and redundant functions from original package.

Source Version:
Epic Games\UE_4.26\Engine\Source\Programs\PixelStreaming\WebServers\SignallingWebServer

Adapter for IOS:
https://webrtc.github.io/adapter/adapter-latest.js



## Usage

```
npm install
npm start
```

Editor Preferences > Level Editor > Play > Additional Launch Parameters

```
-RenderOffScreen 
-AllowPixelStreamingCommands 
-AudioMixer 
-PixelStreamingIP=localhost 
-PixelStreamingPort=8888
```




## Requirement

- Chrome
- NodeJS 10+
- Unreal Engine 4+
