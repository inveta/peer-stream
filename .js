const fs = require('fs').promises;

module.exports = function (request, response, server) {
  // response.setHeader('Content-Type', "application/json")
  //路由
  if (request.url === '/updateConfig') {
    updateConfig(request, response, server);
  } else if (request.url === '/restartSignal') {
    restartSignal(request, response);
  }
};

// 读取配置：先读取配置文件，配置文件中没有的从环境变量加载
// json直接读取

// 修改整体配置
function updateConfig(request, response, server) {
  let body = '';
  request.on('data', (chunk) => {
    body += chunk;
  });

  request.on('end', async () => {
    //获取页面提交的json串
    body = JSON.parse(body);

    let signal = require('./signal.json');

    Object.assign(signal, body);

    //配置全局生效  除PORT|UE5未生效、  env暂时不管
    Object.assign(global, body);

    try {


      //修改了端口，执行下列方法使其生效
      if (body.PORT) {
        await global.serve();

      }

      if (body.UE5) {
        global.InitUe5Pool();
      }

      await fs.writeFile('./signal.json', JSON.stringify(signal, null, '\t'));

      await new Promise(res => {
        response.end(JSON.stringify(body), res);
      })


      if (body.PORT) {
        server.closeAllConnections()
        server.close(() => { });
      }


    } catch (err) {
      response.writeHead(400);
      response.end(err.message || err);
    }
  });
}

