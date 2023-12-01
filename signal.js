'5.1.2';

Object.assign(global, require('./signal.json'));

require('child_process').exec(`start http://localhost:${PORT}/signal.html#/updateConfig`);

////////////////////////////////// 2024年6月 删除 !!!!
if (global.env) {
  const signal = {
    //  env: false,
    PORT: +process.env.PORT,
    auth: process.env.auth,
    one2one: process.env.one2one,
    preload: +process.env.preload,
    exeUeCoolTime: +process.env.exeUeCoolTime,
    UEVersion: +process.env.UEVersion,
    UE5: Object.entries(process.env).filter((([key]) => key.startsWith('UE5_')).map(([key, value]) => value)),
  }
  require('fs').promises.writeFile('./signal.json', JSON.stringify(signal));
  Object.assign(global, signal);
  // require('fs').promises.rm('./.signal.js');
}
////////////////////////////////// 2024年6月 删除 !!!!



const { Server } = require('ws')

G_StartUe5Pool = []
global.InitUe5Pool = function () {

  for (const key in (global.UE5 || [])) {
    const value = UE5[key];
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
      G_StartUe5Pool.push([localCmd, ipAddress, key, startCmd, new Date(0)])
      continue
    }
    startCmd = modifiedArgs.join(' ')
    G_StartUe5Pool.push([localCmd, '', key, startCmd, new Date(0)])
  }
}
function GetFreeUe5() {
  onLineExecIp = []
  onLineClient = []

  for (exeWs of EXECUE.clients) {
    onLineExecIp.push(getIPv4(exeWs.req.socket.remoteAddress))
    onLineClient.push(exeWs)
  }
  for (exeUeItem of G_StartUe5Pool) {
    const [localCmd, ipAddress, key, startCmd, lastDate] = exeUeItem
    hasStartUp = false
    for (ueClient of ENGINE.clients) {
      //websocket 获取的url前面会加上一个'/'
      if ('/' + key == ueClient.req.url) {
        hasStartUp = true
        break
      }
    }
    let now = new Date()
    let difSecond = (now - lastDate) / 1000
    let coolTime = 60
    if (global.exeUeCoolTime) {
      coolTime = global.exeUeCoolTime
    }
    if (difSecond < coolTime) {
      continue
    }
    if (false == hasStartUp) {
      if (true == localCmd) {
        exeUeItem[4] = now
        return exeUeItem
      }
      index = onLineExecIp.indexOf(ipAddress)
      if (-1 != index) {
        exeUeItem[4] = now
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
    const [localCmd, ipAddress, key, startCmd, lastDate, exeWs] = execUe5
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
      exeWs.send(startCmd)
    }
  }
}

InitUe5Pool();

function InitExecUe() {
  //exec-ue的websocket连接管理
  global.EXECUE = new Server({ noServer: true, clientTracking: true }, () => { })
  EXECUE.on('connection', (socket, req) => {
    socket.req = req

    socket.isAlive = true
    socket.on('pong', heartbeat)
  })
  EXECUE.on('onclose', () => { })
  EXECUE.on('error', () => { })
}

InitExecUe()

global.ENGINE = new Server({ noServer: true, clientTracking: true }, () => { })

ENGINE.on('connection', (ue, req) => {
  ue.req = req

  ue.isAlive = true
  ue.on('pong', heartbeat)

  ue.fe = new Set()
  // sent to UE5 as initial signal
  ue.send(
    JSON.stringify({
      type: 'config',
      peerConnectionOptions: {
        iceServers: global.iceServers,
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

const path = require('path')

global.serve = async () => {


  const HTTP = require('http').createServer()



  HTTP.on('request', (req, res) => {
    // websocket请求时不触发

    // Basic Authentication
    if (global.auth) {
      let auth = req.headers.authorization?.replace('Basic ', '');
      auth = Buffer.from(auth || '', 'base64').toString('utf-8');
      if (global.auth !== auth) {
        res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Authorization required"' });
        res.end('Auth failed !');
        return;
      }
    }

    // serve static files
    const read = require('fs').createReadStream(path.join(__dirname, path.normalize(req.url)))
    const types = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
    }
    const type = types[path.extname(req.url)]
    if (type) res.setHeader('Content-Type', type)

    read
      .on('error', (err) => {
        require('./.js')(req, res, HTTP).then(result => {
          if (!res.writableEnded)
            res.end(result)
        }).catch(err => {
          res.writeHead(400);
          res.end(String(err), () => { });
        });
      })
      .on('ready', () => {
        read.pipe(res)
      })
  })

  HTTP.on('upgrade', (req, socket, head) => {

    // WS子协议
    if (req.headers['sec-websocket-protocol'] === 'peer-stream') {
      // throttle 防止前端频繁刷新
      if (global.throttle) {
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

      PLAYER.handleUpgrade(req, socket, head, (fe) => {
        PLAYER.emit('connection', fe, req)
      })
    } else if (req.headers['sec-websocket-protocol'] === 'exec-ue') {
      EXECUE.handleUpgrade(req, socket, head, (fe) => {
        EXECUE.emit('connection', fe, req)
      })
    } else {
      ENGINE.handleUpgrade(req, socket, head, (fe) => {
        ENGINE.emit('connection', fe, req)
      })
    }
  })

  return new Promise((res, rej) => {
    HTTP.listen(PORT ?? 88, res);
    HTTP.once('error', err => {
      rej(err)
    });
  })

}

serve();

// front end
global.PLAYER = new Server({
  clientTracking: true,
  noServer: true,
})
// every player
PLAYER.on('connection', (fe, req) => {
  fe.req = req

  fe.isAlive = true

  if (global.one2one) {
    // 选择空闲的ue
    fe.ue = [...ENGINE.clients].find((ue) => ue.fe.size === 0)
  } else {
    // 选择人最少的ue
    fe.ue = [...ENGINE.clients].sort((a, b) => a.fe.size - b.fe.size)[0]
  }

  fe.send(JSON.stringify({
    type: 'seticeServers',
    iceServers: global.iceServers
  }))

  if (fe.ue) {
    fe.ue.fe.add(fe)
    if (global.UEVersion && global.UEVersion === 4.27) {
      fe.send(
        JSON.stringify({
          type: 'playerConnected',
          playerId: req.socket.remotePort,
          dataChannel: true,
          sfu: false,
        })
      )
    } else {
      fe.ue.send(
        JSON.stringify({
          type: 'playerConnected',
          playerId: req.socket.remotePort,
          dataChannel: true,
          sfu: false,
        })
      )
    }
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
    if (['offer', 'answer', 'iceCandidate'].includes(msg.type)) {
      fe.ue.send(JSON.stringify(msg))
    } else if (msg.type === "pong") {
      fe.isAlive = true
    }
    else {
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

function heartbeat() {
  this.isAlive = true
}

// keep alive
setInterval(() => {
  PLAYER.clients.forEach(function each(fe) {
    if (fe.isAlive === false) return fe.close()

    fe.send(JSON.stringify({
      type: 'ping',
    }))
    fe.isAlive = false
  })

  ENGINE.clients.forEach(function each(ue) {
    if (ue.isAlive === false) return ue.close()

    ue.isAlive = false
    ue.ping('', false)
  })

  EXECUE.clients.forEach(function each(ws) {
    if (ws.isAlive === false) return ws.close()

    ws.isAlive = false
    ws.ping('', false)
  })
}, 30 * 1000)

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
let lastPreStart = new Date(0)
function Preload() {
  //只在one2one模型下载进行预加载，共享模式，加载不太频繁，不考虑
  if (!global.one2one) {
    return
  }
  if (!global.preload) {
    return
  }
  let ueNumber = ENGINE.clients.size
  let playerNumber = PLAYER.clients.size
  if (ueNumber < playerNumber + global.preload) {
    //预加载的时间间隔需要和实例的冷却时间匹配
    //https://github.com/inveta/peer-stream/issues/80
    let now = new Date()
    let difSecond = (now - lastPreStart) / 1000
    let coolTime = 60
    if (global.exeUeCoolTime) {
      coolTime = global.exeUeCoolTime
    }
    if (difSecond < coolTime) {
      return
    }
    lastPreStart = now
    StartExecUe()
  }
}

function PreloadKeepAlive() {
  setInterval(() => {
    Preload()
  }, 5 * 1000)
}
PreloadKeepAlive()

//在one模式下，当gpu资源实例不足时，用户进行排队，并定期通知给用户当前排队进展
function PlayerQueue() {
  const fe = [...PLAYER.clients].filter((fe) => !fe.ue)
  if (!fe.length) {
    return
  }
  let seq = 1
  let msg = {}
  msg.type = 'playerqueue'
  fe.forEach((fe) => {
    msg.seq = seq
    seq = seq + 1
    if (!fe.PlayerQueueSeq) {
      fe.PlayerQueueSeq = msg.seq
      fe.send(JSON.stringify(msg))
      return
    }
    if (fe.PlayerQueueSeq != msg.seq) {
      fe.PlayerQueueSeq = msg.seq
      fe.send(JSON.stringify(msg))
      return
    }
  })
}

function PlayerQueueKeepAlive() {
  if (!global.one2one) {
    return
  }
  setInterval(() => {
    PlayerQueue()
  }, 5 * 1000)
}

PlayerQueueKeepAlive()
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

if (global.boot) {
  switch (process.platform) {
    case "win32": {
      const signal_bat = require('path').join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'signal.bat');
      const bat = `start "${process.argv[0]}" "${__filename}"`;
      require('fs').writeFile(signal_bat, bat, () => { });
    }
    case "linux": {

    }
  }
}
