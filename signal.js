'5.1.0'

const { Server } = require('ws')

G_StartUe5Pool = []
function InitUe5Pool() {
  execUe5Pool = Object.entries(process.env)
    .filter(([key]) => key.startsWith('UE5_'))
    .map(([key, value]) => {
      return [key, value]
    })

  for (const item of execUe5Pool) {
    const [key, value] = item
    // 将命令行字符串转换为数组
    const args = value.split(' ')

    // 使用正则表达式提取 -PixelStreamingURL 参数的值
    const match = value.match(/-PixelStreamingURL=([^ ]+)/)

    // 如果匹配成功，则输出 PixelStreamingURL 的值
    if (!match) {
      console.error(`PixelStreamingURL not found. ${value}`)
      continue
    }
    const url = require('url')
    const pixelStreamingURL = match[1]
    const paseUrl = url.parse(pixelStreamingURL)
    paseUrl.pathname = key
    const newPixelStreamingURL = url.format(paseUrl)

    // 使用正则表达式或字符串替换修改 PixelStreamingURL 值
    const modifiedArgs = args.map((arg) =>
      arg.replace(
        /-PixelStreamingURL=.*/,
        `-PixelStreamingURL=${newPixelStreamingURL}`
      )
    )

    let localCmd = true
    let startCmd

    const ipAddress = args[0]
    const isIpAddress = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.test(args[0])
    if (isIpAddress) {
      localCmd = false
      modifiedArgs.shift()
      startCmd = modifiedArgs.join(' ')
      G_StartUe5Pool.push([localCmd, ipAddress, key, startCmd])
      continue
    }
    startCmd = modifiedArgs.join(' ')
    G_StartUe5Pool.push([localCmd, '', key, startCmd])
  }
}
function GetFreeUe5() {
  onLineExecIp = []
  onLineClient = []

  for (exeUeItem of G_StartUe5Pool) {
    const [localCmd, ipAddress, key, startCmd] = exeUeItem
    hasStartUp = false
    for (ueClient of ENGINE.clients) {
      //websocket 获取的url前面会加上一个'/'
      if ('/' + key == ueClient.req.url) {
        hasStartUp = true
        break
      }
    }
    if (false == hasStartUp) {
      if (true == localCmd) {
        return exeUeItem
      }
      index = onLineExecIp.indexOf(ipAddress)
      if (-1 != index) {
        return [...exeUeItem, onLineClient[index]]
      }
    }
  }
  return
}
function getIPv4(ip) {
  const net = require('net')
  if (net.isIPv6(ip)) {
    const match = ip.match(/::ffff:(\d+\.\d+\.\d+\.\d+)/)
    if (match) {
      return match[1]
    }
  }
  return ip
}
function StartExecUe() {
  execUe5 = GetFreeUe5()
  if (execUe5) {
    const [localCmd, ipAddress, key, startCmd, exeWs] = execUe5
    //启动本地的UE
    if (localCmd) {
      require('child_process').exec(
        startCmd,
        { cwd: __dirname },
        (error, stdout, stderr) => {
          if (error) {
            console.error(`exec error: ${error}`)
            return
          }
        }
      )
    } else {
      //启动远端的UE
    }
  }
}

InitUe5Pool()

global.ENGINE = new Server({ noServer: true, clientTracking: true }, () => {})
const iceServers = [
  {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
      'stun:stun3.l.google.com:19302',
      'stun:stun4.l.google.com:19302',
    ],
  },
]

ENGINE.on('connection', (ue, req) => {
  ue.req = req

  ue.fe = new Set()
  // sent to UE5 as initial signal
  ue.send(
    JSON.stringify({
      type: 'config',
      peerConnectionOptions: {
        // iceServers
      },
    })
  )

  // 认领空闲的前端们
  for (const fe of PLAYER.clients) {
    if (!fe.ue) {
      PLAYER.emit('connection', fe, fe.req)
    }
  }
  print()

  ue.onmessage = (msg) => {
    msg = JSON.parse(msg.data)

    // Convert incoming playerId to a string if it is an integer, if needed. (We support receiving it as an int or string).

    if (msg.type === 'ping') {
      ue.send(JSON.stringify({ type: 'pong', time: msg.time }))
      return
    }

    // player's port as playerID
    const fe = [...ue.fe].find(
      (fe) => fe.req.socket.remotePort === +msg.playerId
    )

    if (!fe) return

    delete msg.playerId // no need to send it to the player
    if (['offer', 'answer', 'iceCandidate'].includes(msg.type)) {
      fe.send(JSON.stringify(msg))
    } else if (msg.type === 'disconnectPlayer') {
      fe.close(1011, msg.reason)
    } else {
    }
  }

  ue.onclose = (e) => {
    ue.fe.forEach((fe) => {
      fe.ue = null
    })
    print()
  }

  ue.onerror
})

const HTTP = require('http')
  .createServer()
  .listen(+process.env.PORT || 88)

const path = require('path')
HTTP.on('request', (req, res) => {
  // websocket请求时不触发
  // serve HTTP static files

  const read = require('fs').createReadStream(path.join(__dirname, req.url))
  const types = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
  }
  const type = types[path.extname(req.url)]
  if (type) res.setHeader('Content-Type', type)

  read
    .on('error', (err) => {
      res.end(err.message)
    })
    .on('ready', () => {
      read.pipe(res)
    })
})

HTTP.on('upgrade', (req, socket, head) => {
  // password
  if (process.env.token) {
    if (req.url !== process.env.token) {
      socket.destroy()
      return
    }
  }

  // WS子协议
  if (req.headers['sec-websocket-protocol'] === 'peer-stream') {
    // throttle 防止前端频繁刷新
    if (process.env.throttle) {
      if (global.throttle) {
        socket.destroy()
        return
      } else {
        global.throttle = true
        setTimeout(() => {
          global.throttle = false
        }, 500)
      }
    }
    // players max count
    if (process.env.limit) {
      if (PLAYER.clients.size >= process.env.limit) {
        socket.destroy()
        return
      }
    }
    PLAYER.handleUpgrade(req, socket, head, (fe) => {
      PLAYER.emit('connection', fe, req)
    })
  } else {
    ENGINE.handleUpgrade(req, socket, head, (fe) => {
      ENGINE.emit('connection', fe, req)
    })
  }
})

// front end
global.PLAYER = new Server({
  clientTracking: true,
  noServer: true,
})
// every player
PLAYER.on('connection', (fe, req) => {
  fe.req = req

  if (process.env.one2one) {
    // 选择空闲的ue
    fe.ue = [...ENGINE.clients].find((ue) => ue.fe.size === 0)
  } else {
    // 选择人最少的ue
    fe.ue = [...ENGINE.clients].sort((a, b) => a.fe.size - b.fe.size)[0]
  }

  if (fe.ue) {
    fe.ue.fe.add(fe)
    fe.ue.send(
      JSON.stringify({
        type: 'playerConnected',
        playerId: req.socket.remotePort,
        dataChannel: true,
        sfu: false,
      })
    )
  } else {
    StartExecUe()
  }

  print()

  fe.onmessage = (msg) => {
    if (!fe.ue) {
      fe.send(`! Engine not ready`)
      return
    }

    msg = JSON.parse(msg.data)

    msg.playerId = req.socket.remotePort
    if (['answer', 'iceCandidate'].includes(msg.type)) {
      fe.ue.send(JSON.stringify(msg))
    } else {
      fe.send('? ' + msg.type)
    }
  }

  fe.onclose = (e) => {
    if (fe.ue) {
      fe.ue.send(
        JSON.stringify({
          type: 'playerDisconnected',
          playerId: req.socket.remotePort,
        })
      )
      fe.ue.fe.delete(fe)
    }
    // 当用户连接数大于ue实例的时候，有用户退出意味着可以，认领空闲的前端们
    for (const fe of PLAYER.clients) {
      if (!fe.ue) {
        PLAYER.emit('connection', fe, fe.req)
      }
    }

    print()
  }

  fe.onerror
})

// keep alive
setInterval(() => {
  for (const fe of PLAYER.clients) {
    fe.send('ping')
  }
}, 50 * 1000)

// 打印映射关系
function print() {
  console.clear()
  console.log()

  ENGINE.clients.forEach((ue) => {
    console.log(
      ue.req.socket.remoteAddress,
      ue.req.socket.remotePort,
      ue.req.url
    )
    ue.fe.forEach((fe) => {
      console.log(
        '     ',
        fe.req.socket.remoteAddress,
        fe.req.socket.remotePort,
        fe.req.url
      )
    })
  })

  const fe = [...PLAYER.clients].filter((fe) => !fe.ue)
  if (fe.length) {
    console.log('idle players:')
    fe.forEach((fe) => {
      console.log(
        '     ',
        fe.req.socket.remoteAddress,
        fe.req.socket.remotePort,
        fe.req.url
      )
    })
  }
}
function Preload() {
  //只在one2one模型下载进行预加载，共享模式，加载不太频繁，不考虑
  if (!process.env.one2one) {
    return
  }
  if (!process.env.preload) {
    return
  }
  let ueNumber = ENGINE.clients.size
  let playerNumber = PLAYER.clients.size
  if (ueNumber < playerNumber + parseInt(process.env.preload)) {
    StartExecUe()
  }
}

function PreloadKeepAlive() {
  setInterval(() => {
    Preload()
  }, 5 * 1000)
}
PreloadKeepAlive()
// debug
require('readline')
  .createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  .on('line', (line) => {
    console.log(eval(line))
  })

process.title = __filename
