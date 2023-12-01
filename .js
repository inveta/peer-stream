
module.exports = async function (request, response, server) {

  switch (request.url) {
    case "/signal": {
      return Signal(request, response, server);

      break;
    }

    case "/eval": {
      return eval(decodeURIComponent(request.headers['eval']))

      break;
    }

    case "/exec": {
      return new Promise((res, rej) => {

        require('child_process').exec(
          decodeURIComponent(request.headers['exec']),
          (error, stdout, stderr) => {
            if (error) {
              rej(stderr)
            } else {
              res(stdout)
            }
          });
      })
      break;
    }

    case "/write": {
      return Write(request, response, server);

      break;
    }
  }
};

// 修改整体配置
async function Signal(request, response, server) {

  let newSignal = JSON.parse(decodeURIComponent(request.headers['signal']))


  let signal = require('./signal.json');

  Object.assign(signal, newSignal);

  Object.assign(global, newSignal);



  //修改了端口，执行下列方法使其生效
  if (newSignal.PORT) {
    await global.serve();

  }

  if (newSignal.UE5) {
    global.InitUe5Pool();
  }

  await require('fs').promises.writeFile(__dirname + '/signal.json', JSON.stringify(signal, null, '\t'));

  await new Promise(res => {
    response.end(JSON.stringify(newSignal), res);
  })


  if (newSignal.PORT) {
    server.closeAllConnections()
    server.close(() => { });
  }



}



async function Write(req, res, server) {

  const chunks = [];

  // Receive chunks of data
  req.on('data', chunk => {
    chunks.push(chunk);
  });

  const body = await new Promise(res => {
    req.on('end', () => {
      res(Buffer.concat(chunks));
    })
  })

  await require('fs').promises.writeFile(__dirname + decodeURIComponent(req.headers['write']), body)

  return ('updated');



}