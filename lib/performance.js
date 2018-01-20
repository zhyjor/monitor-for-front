const parse = require('url').parse;
const fs = require('fs');
const path = require('path');
const redis = require("redis"),
    client = redis.createClient();

client.on("error", (err) => {
    console.log("Error " + err);
});


var createFolder = function(to) { //文件写入
    var sep = path.sep
    var folders = path.dirname(to).split(sep);
    var p = '';
    while (folders.length) {
        p += folders.shift() + sep;
        if (!fs.existsSync(p)) {
            fs.mkdirSync(p);
        }
    }
};

/**
 * 
 * 
 * @param {Object} config  [配置]
 * @returns {Functon} 中间件
 */
module.exports = function(config) {
	const configer = {
		time: config.time ? parseInt(config.time) : 10, // 秒为单位
		originalDir: config.originalDir ? config.originalDir : './originalData', // 数据的目录
		errDir: config.errDir ? config.errDir : './errorData' // 报错的目录
    }
	 var okData_200 = {
        status: '200',
        msg: 'OK!',
    };
    // 设置定时器来循环存放数据
    setInterval(saveData(configer), 1000 * configer.time);
	return (req, res ,next) => {
        const url = parse(req.url);
		// 劫持对应的路由
	    if (url.pathname == '/action') {
	    	// 监听用户行为数据
	        let user_ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            user_ip = user_ip.replace('::ffff:', '');
	        const info = decodeURIComponent(req.url.split('?')[1]);
            const urlData = `user_ip=${user_ip}${info}`
	        client.hset(["hash key", urlData, "some value"], redis.print);
			res.end(JSON.stringify(okData_200));
	    }
	    if(url.pathname == '/error') {
	    	// 监听错误的情况
            const info = req.url.split('?')[1].replace('/r', '');
	        client.hset(["error key", info, "some value"], redis.print);
			res.end(JSON.stringify(okData_200));
        }
	    next();
	}
}
/**
 * 
 * 
 * @param {Object} config  [配置]
 */
function saveData(config) {
	return () => {
        // redis 数据库存储
        const nowDate = new Date().toLocaleDateString();
        const arr = [];
        const errarr = [];
        // 定义好存放的目录
        const ORIGINSL_DIR = `${config.originalDir}/${nowDate}data.txt`;
        const ERROR_DIR = `${config.errDir}/${nowDate}error.txt`;

        createFolder(ORIGINSL_DIR);
        createFolder(ERROR_DIR);

        client.hkeys("hash key", function (err, replies) {
            // console.log(replies.length + " replies:");
            replies.forEach(function (reply, i) {
                // console.log("    " + i + ": " + reply);
                arr.push(reply);
            });
            if (arr.length > 0) {
                arr.push('\n');
                const data = arr.join('\n');
                fs.appendFile(ORIGINSL_DIR, data, 'utf8',  (err) => {
                    if (err) {
                        console.log(err);
                    } else {
                        // console.log('info success');
                        client.del('hash key');
                    }
                })
            }else {
                fs.appendFile(ORIGINSL_DIR, '', 'utf8',  (err) => {
                    if (err) {
                        console.log(err);
                    } else {
                        // console.log('info success');
                        // client.del('hash key');
                    }
                })
            }
        });
        client.hkeys("error key",  (err, replies) => {
            replies.forEach((reply, i) => {
                // console.log("    " + i + ": " + reply);
                errarr.push(reply);
            });
            // const dir = './errorData';
            if (errarr.length > 0) {
                errarr.push('\n');
                const data = errarr.join('\n');
                fs.appendFile(ERROR_DIR, data, 'utf8', (err) => {
                    if (err) {
                        console.log(err);
                    } else {
                        // console.log('error success');
                        client.del('error key');
                    }
                })
            } else {
                const data = `msg=null&nowTime=${new Date().getTime()}\n`;
                fs.appendFile(ERROR_DIR, data, 'utf8', (err) => {
                    if (err) {
                        console.log(err);
                    } else {
                        // console.log('error success');
                        client.del('error key');
                    }
                })
            }
        });
    }
}
