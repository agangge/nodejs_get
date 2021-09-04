var sys = require('util'),
http = require('http'),
querystring = require('querystring'),
crypto = require('crypto'),
iconv = require('iconv-lite'),
BufferHelper = require('bufferhelper'),
config = require('./config.js'),
common = require('./common.js'),
data = require('./data.js'),
score = require('./score.js'),
exec = require('child_process').exec,
execPath = process.argv.join(" ");

var fs = require('fs'),
Log = require('log'),
log = new Log('debug', fs.createWriteStream('./data/my.log'));

var colors = require('colors'),
jsdom = require('jsdom').jsdom,
async = require('async'),
jquery = fs.readFileSync("./jquery.js", "utf-8");

// 抛出未知错误时处理
process.on('uncaughtException',
function(e) {
    console.log(e);
    //  process.exit(0);//自动终止进程
});

// 自动重启
if (config.restartTime) {
    setTimeout(function(exec, execPath) {
        exec(execPath);
        process.exit(0); //自动终止进程
    },
    config.restartTime * 30 * 60 * 1000, exec, execPath);
}

http.request = (function(_request) {
    return function(options, callback) {
        var timeout = options['timeout'],
        timeoutEventId;
        var req = _request(options,
        function(res) {
            res.on('end',
            function() {
                clearTimeout(timeoutEventId);
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

function request(url) {
    url += '&t=' + (new Date()).getTime();
    http.get(url,
    function(res) {
        res.setEncoding('UTF8');
        res.on('data',
        function(data) {});
    }).on('error',
    function(e) {
        console.log("Got error: " + e.message);
    });
}

/**
 * 使用jsdom将html跟jquery组装成dom
 * @param  {[type]}   html     需要处理的html
 * @param  {Function} callback 组装成功后将html页面的$对象返回
 * @return {[type]}            [description]
 */
function makeDom(html, callback) {
    jsdom.env({
        html: html,
        src: [jquery],
        done: function(errors, window) {
            var $ = window.$;
            callback(errors, $);
            window.close(); // 释放window相关资源，否则将会占用很高的内存
        }
    });
}

/**
 * @param  {Function} callback 一个列表页处理完毕时的回调
 * @return {[type]}            [description]
 */
function getResults(client, expect, id) {
    // 构造请求信息
    //log.error(callback);
    var link = 'basketball/pool_result.php?id=' + id;
    var options = {
        hostname: 'info.sporttery.cn',
        port: 80,
        path: '/' + link,
        method: 'GET',
        // 注意不能为POST 
        timeout: 30000,
        headers: {
            //"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.11 (KHTML, like Gecko) Chrome/24.0.1271.64 Safari/537.11",
            "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/33.0.1750.154 Safari/537.36 OPR/20.0.1387.91",
            "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/536.11 (KHTML, like Gecko) Chrome/20.0.1132.11 TaoBrowser/2.0 Safari/536.11"
        }
    };
    var req = http.request(options,
    function(res) {
        var html = '';
        // res.setEncoding('utf8');
        // 目标页面为GB2312的采用以下处理方式　
        var bufferHelper = new BufferHelper();
        res.on('data',
        function(chunk) {
            bufferHelper.concat(chunk);
        });
        res.on('end',
        function() {
            var html = iconv.decode(bufferHelper.toBuffer(), 'GBK');
            if (html) parseHtml(html, expect, id);
            //对html做解析处理
        });
    });

    req.on('error',
    function(e) {
        log.error(e);
        console.log(('请求列表页失败: ' + e.message).red);
    });

    // write data to request body
    req.write('data\n');
    req.end();
    console.log('开始采集');
}

/**
 * 处理请求成功后的html页面，对页面的信息使用jquery进行提取,将信息拼接为逗号分隔符的形式保存到文件
 * @param  {[type]} html [description]
 * @return {[type]}      [description]
 */
function parseHtml(html, expect, id) {
    makeDom(html,
    function(errors, $) {
        try {
            var gamename = [];
            result = [],
            odds = [],
            ball = "", pre = "",score = "",scores = "";

            var gameList = $('.midbg').find('.table01');

            var dname = $(".dname").text().trim();
            var reg = new RegExp("\\((.| )+?\\)", "igm");
            var dnames = dname.match(reg);
          if (dnames!=null && dnames!=''){
            if (typeof(dnames[2]) != "undefined") {
                score = dnames[2].replace('(', '').replace(')', '');
            }
		  }

            gameList.each(function(i, tab) {
                var $tab = $(tab);
                var gamenames = $tab.find("tr:eq(0)").text().trim();
                gamename.push(gamenames.substring(0, gamenames.length - 4));

                var tr = $tab.find("tr:last");
                tr.each(function(j, td) {
                    var $td = $(td);
                    if (gamename[i] == '胜负') {
                        var sresult = $('.midbg').find('.table01:eq(0)').find('tr:eq(1)').find('td:eq(1)').text().trim();
                        if (sresult == '主负') {
                            result.push('主负');
                            odds.push($td.find('td:eq(1)').text().trim());
                        } else {
                            result.push('主胜');
                            odds.push($td.find('td:eq(2)').text().trim());
                        }

                    } else if (gamename[i] == '让分胜负') {
                        var rresult = $td.find('td:eq(4)').text().trim();
                        if (rresult == '让分主胜') {
                            result.push('主胜');
                            odds.push($td.find('td:eq(3)').text().trim());
                        } else {
                            result.push('主负');
                            odds.push($td.find('td:eq(1)').text().trim());
                        }
                        ball = $td.find('td:eq(2)').text().trim();

                    } else if (gamename[i] == '胜分差') {

                        var cresult = $('.midbg').find('.table01:eq(3)').find('tr:eq(1)').find('td:eq(1)').text().trim();
                        var result_1 = cresult.substr(0, 2);
                        var result_2 = cresult.substring(2, cresult.length);
                        var spks = [],
                        spzs = [];
                        var spk = ['1-5', '6-10', '11-15', '16-20', '21-25', '26+'];
                        var spl = ['01', '02', '03', '01', '05', '06'];
                        var spr = ['07', '08', '09', '10', '11', '12'];

                        spks.push($td.find('td:eq(1)').text().trim());
                        spks.push($td.find('td:eq(2)').text().trim());
                        spks.push($td.find('td:eq(3)').text().trim());
                        spks.push($td.find('td:eq(4)').text().trim());
                        spks.push($td.find('td:eq(5)').text().trim());
                        spks.push($td.find('td:eq(6)').text().trim());
                        spzs.push($td.find('td:eq(7)').text().trim());
                        spzs.push($td.find('td:eq(8)').text().trim());
                        spzs.push($td.find('td:eq(9)').text().trim());
                        spzs.push($td.find('td:eq(10)').text().trim());
                        spzs.push($td.find('td:eq(11)').text().trim());
                        spzs.push($td.find('td:eq(12)').text().trim());
                        if (result_1 == '客胜') {
                            for (var j = 0; j < 6; j++) {
                                if (result_2 == spk[j]) {
                                    result.push('客胜' + spk[j].replace('+', ''));
                                    odds.push(spks[j]);
                                }
                            }
                        } else {
                            for (var j = 0; j < 6; j++) {

                                if (result_2 == spk[j]) {
                                    result.push('主胜' + spk[j].replace('+', ''));
                                    odds.push(spzs[j]);
                                }
                            }
                        }

                    } else {
                       scores = gamenames.substring(10, gamenames.length - 1);
					   pre = $td.find('td:eq(2)').text().trim();
                        var dresult = $td.find('td:eq(4)').text().trim();
                        if (result == '大') {
                            result.push('大分');
                            odds.push($td.find('td:eq(1)').text().trim());
                        } else {
                            result.push('小分');
                            odds.push($td.find('td:eq(3)').text().trim());
                        }

                    }
                });

            });
        } catch(err) {
            console.log((err.message).red);
            log.error(err);
            return;
        }
        try {
            var arr = [];
            for (var i = 0; i < gameList.length; i++) {
                var da = [];

                if (typeof(result[i]) != "undefined") {
                    da['result'] = result[i];
                } else {
                    da['result'] = '';
                }
				
				if (typeof(odds[i]) != "undefined") {
                    da['odds'] = odds[i];
                } else {
                    da['odds'] = '';
                }
				
            
                da['score'] = score;
				da['total'] = total; //总分
                da['scores'] = scores;//预设总分
                da['ball'] = ball;//让分
                arr.push(da);
            }

      
            var lottery = [51, 52, 54, 53];
			if (arr.length>0){
            for (var k = 0; k < lottery.length; k++) {
             
			   setTimeout(updateSpvalues, 1000 * (k + 1), client, id, arr[k]['odds'], arr[k]['result'], arr[k]['score'],arr[k]['scores'],arr[k]['ball'], expect, lottery[k]); //by fleaphp.net
			   
            }
			}

        } catch(err) {
            console.log((err.message).red);
            log.error(err);
            return;
        }

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
    });
}

//遍历所有数据
GetData = function(client) {
    client.query(" select matchId,lottery_num from lot_bbteam where UNIX_TIMESTAMP(NOW())-UNIX_TIMESTAMP(endtime)> 60   and ( score='' or result ='' or c_result ='' or x_result  ='' or d_result ='' or odds ='' or c_odds =''	or x_odds  ='' )  order by endtime desc ",
    function selectZ(error, results, fields) {
        if (error) {
            console.log('GetData Error' + error.message);
            return;
        }
        for (var i = 0; i < results.length; i++) {
            // console.log('matchId' + results[i]['matchId'] );
            setTimeout(getResults, 2000 * (i + 1), client, results[i]['lottery_num'], results[i]['matchId']); //by fleaphp.net
        }
    });
    setTimeout(ClientConnectionReady, 1000 * 5, client);
}

//更新赔率
updateSpvalues = function(client, matchId, odds, result, score, scores, ball, expect, lotteryid) {
	if (result =='' || result == null ){
		 result= score.matchs.get_BB_ResultbyScore( ball, score, scores, lotteryid)
	}
    switch (parseInt(lotteryid, 10)) {
    case 51:
        var sql = "update lot_bbteam set odds = ? , result = ?, score= ?  where matchId = ?  ";

        var values = [odds, result, score, matchId];
        break;
    case 52:
        var sql = "update lot_bbteam set c_odds = ? , c_result = ?  where matchId = ?  ";
        var values = [odds, result, matchId];
        break;
    case 53:
        var sql = "update lot_bbteam set d_odds = ? , d_result = ?  where matchId = ?  ";
        var values = [odds, result, matchId];
        break;
    case 54:
        var sql = "update lot_bbteam set x_odds = ? , x_result = ?  where matchId = ?  ";
        var values = [odds, result, matchId];
        break;
    }
    console.log('正在更新' + '第' + expect + '期赔率:' + odds + ',比分:' + score + ',赛果:' + result);
    var sqls = client.format(sql, values);
    log.error(sqls);
    client.query(sql, values,
    function(error, results) {
        if (error) {
            console.log('Update Error:' + error.message);
            return;
        }
        ballCheck(expect, lotteryid);
    });

}

ballCheck = function(expect, id) {
    var url = 'http://' + config.url.admin + '?c=ball&a=check&expect=' + expect + '&lotteryid=' + id;
    console.log(url);
    try {
        var req = get(url, {},
        'utf-8',
        function(res) {
            var str = eval("(" + res + ")"); // 把接收到的数据 转成json
            console.log((str.msg).yellow);
        });
    } catch(err) {
        console.log((err.message).red);
        //log.error(err);
        return;
    }
}

ClientConnectionReady(client);
