signalIp = '127.0.0.1'
signalPort = 88

const protocol = 'exec-ue'

function ConnectWsServer() {
  // 创建 WebSocket 客户端并连接到服务器
  const WebSocket = require('ws')
  const client = new WebSocket(`ws://${signalIp}:${signalPort}`, protocol)
  let reconnect = false
  // 监听连接错误事件
  client.on('error', () => {
    console.log(
      `WebSocket client error signalIp=${signalIp} signalPort=${signalPort}`
    )
    client.close()
    if (true == reconnect) {
      return
    }
    reconnect = true
    setTimeout(() => {
      ConnectWsServer()
    }, 10 * 1000)
  })

  // 监听连接关闭事件
  client.on('close', () => {
    console.log(
      `WebSocket client close signalIp=${signalIp} signalPort=${signalPort}`
    )
    client.close()
    if (true == reconnect) {
      return
    }
    reconnect = true
    setTimeout(() => {
      ConnectWsServer()
    }, 10 * 1000)
  })

  // 监听连接成功事件
  client.on('open', () => {
    console.log(
      `WebSocket client open signalIp=${signalIp} signalPort=${signalPort}`
    )
  })

  // 监听消息事件
  client.on('message', (message) => {
    console.log(`Received message: ${message}`)
    if (message instanceof Buffer) {
      message = message.toString('utf8')
    }
    if (message instanceof ArrayBuffer) {
      message = Buffer.from(message).toString('utf8')
    }
    require('child_process').exec(
      message,
      { cwd: __dirname },
      (error, stdout, stderr) => {
        if (error) {
          console.error(`exec error: ${error}`)
          return
        }
      }
    )
  })
}

ConnectWsServer()
