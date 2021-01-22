// 格式：空格分隔键值对，键值对用“=”连接


// argv[0]: path/to/node.exe
// process.argc[1] === __filename
const args = process.argv.slice(2).reduce((prev, curr) => {
  const [key, value = true] = curr.split("=");
  prev[key] = parseFloat(value) || value;
  return prev;
}, {});

// console.log(args)
module.exports = args;
