
module.exports = async function (request, response, HTTP) {

  switch (request.url) {
    case "/signal": {
      return Signal(request, response, HTTP);

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
      return Write(request, response, HTTP);

      break;
    }
  }
};

// 修改整体配置
async function Signal(request, response, HTTP) {

  let newSignal = JSON.parse(decodeURIComponent(request.headers['signal']))


  //修改了端口，执行下列方法使其生效
  if (newSignal.PORT) {
    await global.serve(newSignal.PORT);

  }

  let signal = require('./signal.json');

  Object.assign(signal, newSignal);

  Object.assign(global, newSignal);



  if (newSignal.UE5) {
    await global.InitUe5Pool();
  }

  if (newSignal.boot !== undefined) {
    await global.Boot()
  }

  await require('fs').promises.writeFile(__dirname + '/signal.json', JSON.stringify(signal, null, '\t'));

  await new Promise(res => {
    response.end(JSON.stringify(newSignal), res);
  })


  if (newSignal.PORT) {
    HTTP.closeAllConnections()
    HTTP.close(() => { });
  }



}



async function Write(req, res, HTTP) {

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



global.restartProcess = function () {
  HTTP.closeAllConnections()
  HTTP.close(() => {
    console.log(1111)
    require('child_process').spawn(
      process.argv[0],
      [process.argv[1], ...process.argv.slice(2)], {
      stdio: 'inherit',
      detached: true
    }).unref();
    process.exit();
  });
}

