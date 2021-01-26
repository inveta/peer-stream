// 静态目录中间件


const path = require("path");
const fs = require("fs");


module.exports=(path,dir)=>{
    
    


    return (req,res)=>{
        const filePath = path.join(dir,req.url);

    }
}