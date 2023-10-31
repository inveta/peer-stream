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

  request.on('end', () => {
    console.log('111---' + body);
    //获取页面提交的json串
    var obj = JSON.parse(body);
    //TODO 校验

    var signalDb = require('./signal.json');
    let PORTDB = signalDb['PORT'];
    let PORT = obj['PORT'];
    Object.assign(signalDb, obj);
    //写入文件
    fs.writeFile('./signal.json', JSON.stringify(signalDb));
    //配置全局生效  除PORT|UE5未生效、  env暂时不管
    Object.assign(global, signalDb);

    response.end(JSON.stringify(signalDb));

    //修改了端口，执行下列方法使其生效
    if (PORTDB !== PORT) {
      HTTP.closeAllConnections();
      HTTP.close(() => {
        HTTP.listen(PORT);
      });
    }
  });
}

//重启信令服务
function restartSignal(request, response) {
  HTTP.closeAllConnections();
  HTTP.close(() => {
    process.on('exit', function () {
      require('child_process').spawn(process.argv.shift(), process.argv, {
        cwd: process.cwd(),
        detached: true,
      });
    });
    process.exit();
  });
}
