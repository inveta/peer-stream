// command line format: key-value pairs connected by "=", separated by " ", for example:
// node serve.js httpPort=80 streamerPort=8888


// argv[0]: path/to/node.exe
// process.argc[1] === __filename
const args = process.argv.slice(2).reduce((prev, curr) => {
  const [key, value = true] = curr.split("=");
  prev[key] = parseFloat(value) || value;
  return prev;
}, {});

module.exports = args;
