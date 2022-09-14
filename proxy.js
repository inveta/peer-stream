const { WebSocket, createWebSocketStream, Server } = require("ws");

const proxy = new Server({ port: 80 })

proxy.on('connection', (FRONT, req) => {
    let front = createWebSocketStream(FRONT)
    let BACK = new WebSocket('ws://localhost:88')
    let back = createWebSocketStream(BACK)

    BACK.on('error', () => {
        FRONT.close()
    })

    back.on('error',()=>{
        
    })

    front.pipe(back)
    back.pipe(front)

})