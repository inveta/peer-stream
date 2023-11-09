const fs = require('fs').promises;

module.exports = function (request, response) {
  // response.setHeader('Content-Type', "application/json")
  //路由
  if (request.url === '/updateConfig') {
    updateConfig(request, response);
  } else if (request.url === '/restartSignal') {
    restartSignal(request, response);
  }
};

// 读取配置：先读取配置文件，配置文件中没有的从环境变量加载
// json直接读取

// 修改整体配置
function updateConfig(request, response) {
  let body = '';
  request.on('data', (chunk) => {
    body += chunk;
  });

  request.on('end', async () => {
    //获取页面提交的json串
    body = JSON.parse(body);
    //TODO 校验

    var signalDb = require('./signal.json');

    Object.assign(signalDb, body);
    //写入文件
    await fs.writeFile('./signal.json', JSON.stringify(signalDb, null, '\t'));
    //配置全局生效  除PORT|UE5未生效、  env暂时不管
    Object.assign(global, body);


    //修改了端口，执行下列方法使其生效
    if (body.PORT) {
      HTTP.closeAllConnections();
      HTTP.close(() => {
        HTTP.listen(body.PORT);
      });
    }

    if (body.UE5) {
      global.InitUe5Pool();
    }

    response.end(JSON.stringify(signalDb));
  });
}

