var mysql = require('mysqli'),
sys = require('util'),
http = require('http'),
url = require('url'),
querystring = require('querystring'),
crypto = require('crypto'),
iconv = require('iconv-lite'),
BufferHelper = require('bufferhelper'),
config = require('./config.js'),
common = require('./common.js'),
data = require('./data.js'),
exec = require('child_process').exec,
execPath = process.argv.join(" ");

var fs = require('fs'),
Log = require('log'),
log = new Log('debug', fs.createWriteStream('./data/my.log'));

var colors = require('colors');

//var date = new Date();
//var createtime = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
var createtime = curentTime();

// 抛出未知错误时处理
process.on('uncaughtException',
function(e) {
    console.log(e);
    // process.exit(0);//自动终止进程
});

// 自动重启
if (config.restartTime) {
    setTimeout(function(exec, execPath) {
        exec(execPath);
        process.exit(0); //自动终止进程
    },
    config.restartTime * 1 * 30 * 1000, exec, execPath);
}

//由于nodejs自身没有对http连接的可配置的超时控制机制,需要自行增加
http.request = (function(_request) {
    return function(options, callback) {
        var timeout = options['timeout'],
        timeoutEventId;
        var req = _request(options,
        function(res) {
            res.on('end',
            function() {
                clearTimeout(timeoutEventId);
                //console.log(options);
                //console.log('response end...');
            });

            res.on('close',
            function() {
                clearTimeout(timeoutEventId);
                //console.log('response close...');
            });

            res.on('abort',
            function() {
                //console.log('abort...');
            });

            callback(res);
        });

        //超时
        req.on('timeout',
        function() {
            //req.res && req.res.abort();
            //req.abort();
            req.end();
        });

        //如果存在超时
        timeout && (timeoutEventId = setTimeout(function() {
            req.emit('timeout', {
                message: 'have been timeout...'
            });
        },
        timeout));
        return req;
    };
})(http.request);

function get(url, data, character, fn) {
    data = data || {};
    character = character || 'utf-8';
    var content = require('querystring').stringify(data);
    var parse_u = require('url').parse(url, true);
    var isHttp = parse_u.protocol == 'http:';
    var options = {
        host: parse_u.hostname,
        port: parse_u.port || (isHttp ? 80 : 443),
        path: parse_u.path,
        method: 'GET',
        headers: {
            "User-Agent": "Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0; BOIE9;ZHCN)"
        }
    };
    var req = require(isHttp ? 'http': 'https').request(options,
    function(res) {
        var _data = '';
        if (character == 'utf-8') {
            res.on('data',
            function(chunk) {
                _data += chunk;
            });
            res.on('end',
            function() {
                fn != undefined && fn(_data);
            });
        } else {
            var bufferHelper = new BufferHelper();
            res.on('data',
            function(chunk) {
                bufferHelper.concat(chunk);
            });
            res.on('end',
            function() {
                _data = iconv.decode(bufferHelper.toBuffer(), 'GBK');
                fn != undefined && fn(_data);
            });
        }

    });
    req.write(content);
    req.end();
}

function curentTime() {
    var now = new Date();
    var year = now.getFullYear(); //年
    var month = now.getMonth() + 1; //月
    var day = now.getDate(); //日
    var hh = now.getHours(); //时
    var mm = now.getMinutes(); //分
    var ss = now.getSeconds(); //秒
    var clock = year + "-";

    if (month < 10) clock += "0";
    clock += month + "-";

    if (day < 10) clock += "0";
    clock += day + " ";

    if (hh < 10) clock += "0";
    clock += hh + ":";

    if (mm < 10) clock += '0';
    clock += mm + ":";

    if (ss < 10) clock += '0';
    clock += ss;
    return (clock);
}

function createMySQLClient() {
    try {
        return mysql.createClient(config.dbinfo).on('error',
        function(err) {
            //console.log(err);
            throw ('连接数据库失败');
        });
    } catch(err) {
        log('连接数据库失败：' + err);
        return false;
    }
}

//接连数据库
var client = createMySQLClient();
//选择哪个库
_ClientConnectionReady = function(client) {
    console.log('正在连接数据库...');
    client.query('use icaipiao',
    function(error, results) {
        if (error) {
            console.log('Connection Error:' + error.message);
            //client.end();
            return;
        }
        //setTimeout(GetData, 1000 * 1, client);
       // getRealSpvalue(client, 'bdspf');
    });
}

//接连数据库
var client = require('mysql').createConnection(config.dbinfo);
//选择哪个库
ClientConnectionReady = function(client) {
    console.log('正在连接数据库...');
    client.query('use icaipiao',
    function(error, results) {
        if (error) {
            console.log('Connection Error:' + error.message);
            //client.end();
            return;
        }
        client.query("SET sql_mode=''");
        GetData(client);

		setTimeout(getRealSpvalue, 1000 * 2, client,'bdspf');
		setTimeout(getRealSpvalue, 1000 * 2, client,'bdjqs');
		setTimeout(getRealSpvalue, 1000 * 2, client,'bdcbf');
		setTimeout(getRealSpvalue, 1000 * 2, client,'bdbqc');
		setTimeout(getRealSpvalue, 1000 * 2, client,'bdsxp');
    });
}

ballCheck = function(expect, id) {
    var url = 'http://' + config.url.admin + '?c=ball&a=check&expect=' + expect + '&lotteryid=' + id;
    // http://127.0.0.105:6060/admin.php?c=ball&a=check&expect=151102&lotteryid=64
    try {
        var req = get(url, {},
        'utf-8',
        function(res) {
            var str = eval("(" + res + ")"); // 把接收到的数据 转成json
            // console.log((str.msg).yellow);
        });
    } catch(err) {
        console.log((err.message).red);
        //log.error(err);
        return;
    }
}

//http://localhost:7082/index.php?c=spvalues&a=getspvalues&callType=JSON&game=bdspf
getRealSpvalue = function(client, type) {
    data.get_curIssue(client,
    function(results) {
        var expect = results[0];
       // console.log(expect);

        var url = 'http://' + config.url.web + '/?c=spvalues&a=getspvalues&game=' + type;
        try {
            var req = get(url, {},
            'utf-8',
            function(res) {
                var obj = eval('(' + res + ')');
                for (var k = 0; k < obj.length; k++) {
                    var sp = [];
                   // console.log(obj[k]);
                    var arr_string = obj[k];
                    for (var a in arr_string) {
                        sp.push(arr_string[a]);
                    }
                    var sp_Value = sp.slice(1);
                    var sp_Id = sp[0];
                    var real_odds = sp_Value.join(',');
                    var real_str = real_odds.replace(/,/g, "");
                    if (real_str != '' && real_str != null) {
                        setTimeout(updateRealSpvalue, 10 * (k + 1), client, type, real_odds, expect, sp_Id); //by fleaphp.net
                    }
                }
            });
        } catch(err) {
            console.log((err.message).red);
            //log.error(err);
            return;
        }
    });
}

//遍历所有数据
GetData = function(client) {
    client.query(" select lottery_num,expect from lot_bjteam where UNIX_TIMESTAMP(NOW())-UNIX_TIMESTAMP(matchtime)> 60 * 60 * 1000 * 2 and ( s_result='' or h_result ='' or c_result ='' or d_result ='' or h_odds ='' or c_odds ='' or s_odds ='' ) group by lottery_num order by endtime desc limit 7 ",
    function selectZ(error, results, fields) {
        if (error) {
            console.log('GetData Error' + error.message);
            return;
        }
        for (var i = 0; i < results.length; i++) {
            console.log(results[i]['lottery_num'] + " - " + results[i]['expect']);
            setTimeout(getResults, 2000 * (i + 1), client, results[i]['lottery_num'], results[i]['expect']); //by fleaphp.net
        }
    });
    //  setTimeout(ClientConnectionReady, 60 * 60 * 1000 * 6, client);
}

getResults = function(client, day, issue) {
    var OS = require("os").type();
    if (OS == 'Windows_NT') {
        var file = 'F:/001/java2012/tdata/result/' + day + '/bjdc_' + issue + '.json';
    } else {
        var file = '/001/java2012/tdata/result/' + day + '/bjdc_' + issue + '+.json';
    }
    //  console.log(file);
    fs.exists(file,
    function(exists) {
        if (exists) {
            try {
                common.readFile(fs, file,
                function(obj) {

                    var obj = eval('(' + obj + ')');
                    var results = obj['row'];
                    //console.log(results);
                    for (var k = 0; k < results.length; k++) {
                        var orderids = results[k].orderid;
                        var order_arr = orderids.split('-');
                        var expect = order_arr[0];
                        var orderid = order_arr[1];
                        var c_odds = results[k].spf_odds;
                        var a_odds = results[k].jqs_odds;
                        var s_odds = results[k].cbf_odds;
                        var d_odds = results[k].sxp_odds;
                        var h_odds = results[k].bqc_odds;
                        var c_result = results[k].spf_result;
                        var a_result = results[k].jqs_result;
                        var s_result = results[k].cbf_result;
                        var d_result = results[k].sxp_result;
                        var h_result = results[k].bqc_result;
                        //时间设为 2000 * (k+ 1) 会停，最好 100 * (k + 1)
                        setTimeout(updateSpvalue, 100 * (k + 1), client, c_odds, c_result, a_odds, a_result, s_odds, s_result, h_odds, h_result, d_odds, d_result, expect, orderid); //by 
                    }

                    // var message = '正在获取开奖结果,彩种:' + results[i]['lotteryname'];
                    // console.log(message);
                });
            } catch(err) {
                console.log(err.message);
            }

        } else {
            getSpvalues(day, issue);
        }

    });
    //console.log(('休眠' + '120' + '秒后,刷新开奖记录...').blue);
    //setTimeout(GetData, 1000 * 60 * 2); //整个流程走完都需要3分钟，重新运行时间不得少于3分钟
}

function getSpvalues(date, expect) {
    var OS = require("os").type();
    if (OS == 'Windows_NT') {
        var paths = 'F:/001/java2012/tdata/result/';
    } else {
        var paths = '/001/java2012/tdata/result/';
    }
    var URL = 'http://www.aicai.com/lottery/dcSpForOneDay.jhtml?issueNo=' + expect + '&gameId=405&day=' + date.substr(0, 4) + '-' + date.substr(4, 2) + '-' + date.substr(6, 2);
    //http://www.aicai.com/lottery/dcSpForOneDay.jhtml?issueNo=160502&gameId=405&day=2016-05-06
    console.log(URL);
    var rq = get(URL, {},
    'utf-8',
    function(res) {
        var ostr = eval("(" + res + ")"); // 把接收到的数据 转成json
        var dataI = [];
        if (ostr.status == 'success') {
            var oddlist = ostr.result.result;
            var day = ostr.result.day;

            var file_path = paths + day.replace(/-/gi, "");
            if (!fs.existsSync(file_path)) {
                //fs.mkdirSync(file_path);
                common.mkdirs(file_path, '777',
                function(e) {
                    if (e) {
                        console.log('出错信息：' + e);
                    }
                });
            }

            for (var k = 0; k < oddlist.length; k++) {
                var data = {};
                var orderid = oddlist[k].matchNo;
                var c_odds = oddlist[k].spSfp;
                var a_odds = oddlist[k].spJqs;
                var s_odds = oddlist[k].spBf;
                var d_odds = oddlist[k].spSxds;
                var h_odds = oddlist[k].spBcsfp;
                var c_result = oddlist[k].result_spf;
                var a_result = oddlist[k].result_jqs;
                var s_result = oddlist[k].result_bf;
                var d_result = oddlist[k].result_sxds;
                var h_result = oddlist[k].result_bcsfp;

                data.orderid = expect + "-" + orderid;

                data.spf_result = c_result;
                data.spf_odds = c_odds;
                data.jqs_result = a_result;
                data.jqs_odds = a_odds;
                data.cbf_result = s_result;
                data.cbf_odds = s_odds;
                data.sxp_result = d_result;
                data.sxp_odds = d_odds;
                data.bqc_result = h_result.replace("-", "");
                data.bqc_odds = h_odds;
                if (c_result != '' && c_result != null) {
                    dataI.push(data);
                }

            }

            var test_arr = JSON.stringify(dataI);
            var gameInfo = '{"row":' + test_arr + '}';
            //console.log(gameInfo);
            if (dataI.length > 0) {
                var json_filename = file_path + "/bjdc_" + expect + '.json';
                console.log(json_filename);
                common.fsWrite(json_filename, gameInfo);
            }
        }
    });

}

updateSpvalue = function(client, c_odds, c_result, a_odds, a_result, s_odds, s_result, h_odds, h_result, d_odds, d_result, expect, orderid) {
    var values = [c_odds, c_result, a_odds, a_result, s_odds, s_result, h_odds, h_result, d_odds, d_result, expect, orderid];
    var sql = "update lot_bjteam set c_odds = ? , c_result = ? ,a_odds = ? , a_result = ?,s_odds = ? , s_result = ?,h_odds = ? , h_result = ?,d_odds = ? , d_result = ? where expect=? and orderid=?  ";
    console.log('正在更新' + '第' + expect + '-' + orderid + '期赔率:' + c_odds + ',赛果:' + c_result);
    var sqls = client.format(sql, values);
    log.error(sqls);
    client.query(sql, values,
    function(error, results) {
        if (error) {
            console.log('Update Error:' + error.message);
            //client.end();
            return;
        }
        /* ballCheck(expect, 61);
        ballCheck(expect, 62);
        ballCheck(expect, 63);
        ballCheck(expect, 64);
        ballCheck(expect, 65);
		*/
    });

}

updateRealSpvalue = function(client, type, real_odds, expect, orderid) {
    var values = [real_odds, expect, orderid];

    switch (type) {
    case "bdspf":
        var sql = "update lot_bjteam set real_c_odds = ?  where expect=? and orderid=?  ";
        break;
    case "bdjqs":
        var sql = "update lot_bjteam set real_a_odds = ?  where expect=? and orderid=?  ";
        break;
    case "bdcbf":
        var sql = "update lot_bjteam set real_s_odds = ?  where expect=? and orderid=?  ";
        break;
    case "bdbqc":
        var sql = "update lot_bjteam set real_h_odds = ?  where expect=? and orderid=?  ";
        break;
    case "bdsxp":
        var sql = "update lot_bjteam set real_d_odds = ?  where expect=? and orderid=?  ";
        break;
    }

    console.log('正在更新' + '第' + expect + '-' + orderid + '期 ' + type + ' 实时赔率:' + real_odds);
    var sqls = client.format(sql, values);
    log.error(sqls);
    client.query(sql, values,
    function(error, results) {
        if (error) {
            console.log('Update Error:' + error.message);
            //client.end();
            return;
        }
    });

}

ClientConnectionReady(client);
