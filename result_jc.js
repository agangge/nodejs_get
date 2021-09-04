var sys = require('util'),
http = require('http'),
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
    process.exit(0);//自动终止进程
  },
  config.restartTime * 30 * 60 * 1000, exec, execPath);
}

//由于nodejs自身没有对http连接的可配置的超时控制机制,需要自行增加
http.request = (function(_request) {
    return function(options, callback) {
        var timeout = options['timeout'],
        timeoutEventId;
        var req = _request(options,function(res) {
            res.on('end',function() {
                clearTimeout(timeoutEventId);
				//console.log(options);
                //console.log('response end...');
            });

            res.on('close',function() {
                clearTimeout(timeoutEventId);
                //console.log('response close...');
            });

            res.on('abort', function() {
                //console.log('abort...');
            });

            callback(res);
        });

        //超时
        req.on('timeout', function() {
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
			"User-Agent":"Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0; BOIE9;ZHCN)"
        }
    };
    var req = require(isHttp ? 'http' : 'https').request(options, function(res) {
        var _data = '';
        if(character=='utf-8') {
            res.on('data', function(chunk) {
                _data += chunk;
            });
            res.on('end', function() {
                fn != undefined && fn(_data);
            });
        } else {
            var bufferHelper = new BufferHelper();
            res.on('data', function(chunk) {
                bufferHelper.concat(chunk);
            });
            res.on('end', function() {
                _data = iconv.decode(bufferHelper.toBuffer(), 'GBK');
                fn != undefined && fn(_data);
            });
        }
        
    });
    req.write(content);
    req.end();
}



var date = new Date();
var createtime = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();

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
        clock += day ;

        return (clock);
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
		setTimeout(getRealSpvalue, 1000 * 2, client,'jcspf');
		setTimeout(getRealSpvalue, 1000 * 2, client,'jcjqs');
		setTimeout(getRealSpvalue, 1000 * 2, client,'jccbf');
		setTimeout(getRealSpvalue, 1000 * 2, client,'jcbqc');
		setTimeout(getRealSpvalue, 1000 * 2, client,'jcrqspf');
   
  });
}

//遍历所有数据
GetData = function(client) {
  client.query('select lotteryid from lot_ssc_class where lotteryid in (41,42,43,44,45)',
  function selectZ(error, results, fields) {
    if (error) {
      console.log('GetData Error' + error.message);
      //client.end();
      return;
    }
   //setTimeout(getSpvalues, 100, 45, 8) //by fleaphp.net
    for (var i = 0; i < results.length; i++) {
        setTimeout(getSpvalues,10 * (i+1), results[i]['lotteryid'],0); //by fleaphp.net
        setTimeout(getSpvalues,10 * (i+1), results[i]['lotteryid'],1); //by fleaphp.net
       // setTimeout(getSpvalues,10 * (i+1), results[i]['lotteryid'],2); //by fleaphp.net

				 data.get_lottery(client, results[i]['lotteryid'],
                function(arr) {
                    var message = '正在获取开奖结果,彩种:' + arr[1];
                    console.log(message);
                });
    }
 
   

  });
  //client.end();
  //console.log(('休眠3600秒后,刷新开奖记录...').blue);
  //setTimeout(ClientConnectionReady, 30 * 60 * 1000, client);
}

//更新数据


//http://localhost:7082/index.php?c=spvalues&a=getspvalues&callType=JSON&game=bdspf
getRealSpvalue = function(client, type) {
   
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
					var expect=20+sp_Id.substr(0,6);
					var orderid = sp_Id.substr(6,3);
                    var real_odds = sp_Value.join(',');
                    var real_str = real_odds.replace(/,/g, "");
					
                    if (real_str != '' && real_str != null) {
                        setTimeout(updateRealSpvalue, 10 * (k + 1), client, type, real_odds, expect, orderid); //by fleaphp.net
                    }
                }
            });
        } catch(err) {
            console.log((err.message).red);
            //log.error(err);
            return;
        }
  
}
function dateAdd(day, n) {

  var OneMonth = day.substring(5, day.lastIndexOf('-'));
  var OneDay = day.substring(day.length, day.lastIndexOf('-') + 1);
  var OneYear = day.substring(0, day.indexOf('-'));

  var dt = new Date(OneYear, OneMonth, OneDay);
  var dtnow = new Date(dt.getTime() + n * 24 * 3600 * 1000);
  var nowYear = dtnow.getFullYear();
  var nowMonth = dtnow.getMonth();
  var nowDay = dtnow.getDate();

  if (parseInt(nowMonth) < 10) {
    nowMonth = '0' + nowMonth;
  }

  if (parseInt(nowDay) < 10) {
    nowDay = '0' + nowDay;
  }

  return nowYear + "-" + nowMonth + "-" + nowDay;

}

function getSpvalues(id,d) {

   //for (var d = 0; d < 10; d++) {

  var lottery_num=dateAdd(curentTime(),-d);
  // var lottery_num='2017-05-31';
  
  switch (parseInt(id, 10)) {
  case 41:
    var URL = 'http://zx.500.com/jczq/kaijiang.php?playid=2&d='+lottery_num;
    break;
  case 42:
    var URL = 'http://zx.500.com/jczq/kaijiang.php?playid=1&d='+lottery_num;
    break;
  case 43:
    var URL = 'http://zx.500.com/jczq/kaijiang.php?playid=3&d='+lottery_num;
    break;
  case 44:
    var URL = 'http://zx.500.com/jczq/kaijiang.php?playid=4&d='+lottery_num;
    break;
  case 45:
    var URL = 'http://zx.500.com/jczq/kaijiang.php?playid=5&d='+lottery_num;
    break;
  }

 console.log(URL);
  var req = http.request(URL,
  function(res) {

    var bufferHelper = new BufferHelper();
    var data = "";
    res.on('data',
    function(_data) {
      bufferHelper.concat(_data);
    });

    res.on('end',
    function() {
      var html = iconv.decode(bufferHelper.toBuffer(), 'GBK');

      jsdom.env({
        html: html,
        src: [jquery],
        done: function(errors, window) {
          var $ = window.$;

          switch (parseInt(id, 10)) {
	  
        
          case 41:
          case 42:
          case 43:
          case 44:
		  case 45:



            //var date = $("#date").attr('value');
            //var expect = lottery_num.replace(/-/g, "");
	        var time=new Date();
	        var preYear=time.getFullYear().toString();


            var num = /([\d]{3})/;
			var cn = /^[\u4e00-\u9fa5]{2}/;
			var gameList = $('.ld_table').find("tr");
			gameList=gameList.slice(1);
			gameList.each(function(i, td) {
		    var $td = $(td);
			var strs = $td.find("td:eq(0)").text().trim(); 
        console.log(strs);
            var stro = strs.match(num); 
			var orderid = stro[0];
			
			var strw = strs.match(cn); 
			var weeks = strw[0];
			var week =  weeks.weekid();
		
			var weeks =  strs.replace(orderid,'');
			console.log(weeks);
			var week =  weeks.weekid();
			var expect_str = $td.find("td:eq(2)").text().trim();
			//var date_str = /([\d-]{5})/;
			//var expects = expect_str.match(date_str);
			var match_day= preYear +'-'+ expect_str+':00';

           
      var odds = $td.find("td:eq(9)").text().trim();
      var result = $td.find("td:eq(7)").text().trim();
            //updateSpvalues(client, id, expect, orderid, odds, result);
			var matchName = $td.find("td:eq(1)").text().trim();
			var homeName = $td.find("td:eq(3)").text().trim();
			var guestName = $td.find("td:eq(5)").text().trim();
			var expect= lottery_num.replace(/-/g, "");
			//竞彩的查询日期并非比赛日期 
			console.log(match_day);
			setTimeout(updateSpvalues, 100 * (i+1), client, id, match_day ,orderid,  odds, result, matchName, homeName, guestName); //by fleaphp.net
			});
			
			
            break;


          }

          window.close(); // 释放window相关资源，否则将会占用很高的内存
        }
      });

    });

  });
  req.end();	
//  }

							
}


ballCheck  = function(expect, id) {
       var url='http://'+config.url.admin+'?c=ball&a=check&expect=' + expect + '&lotteryid=' + id;
	   console.log(url);
	   try {
	   var req = get(url, {}, 'utf-8',function(res) { 
	   var str = eval("(" + res + ")"); // 把接收到的数据 转成json
	   console.log((str.msg).yellow);
	   }); 
	   } catch(err) {
				console.log((err.message).red);
				//log.error(err);
				return;
	   }
}



//更新赔率
updateSpvalues = function(client, id, lottery_num,  orderid, odds, result, matchName, homeName, guestName) {

  switch (parseInt(id, 10)) {
  case 41:
    //var sql = "update lot_jcteam set odds =? , result = ?  where  orderid=? and matchName like ? and homeName like ? and guestName like ?   ";
	//var sql = "update lot_jcteam set odds = ? , result = ?  where orderid= ?  and left(matchtime,10) = ?  ";
    var sql = "update lot_jcteam set odds = ? , result = ?  where orderid= ?  and matchtime = ?  ";
    break;
  case 42:
   // var sql = "update lot_jcteam set c_odds = ? , c_result = ?  where  orderid=? and matchName like ? and homeName like ? and guestName like ?   ";
	var sql = "update lot_jcteam set c_odds = ? , c_result = ?  where orderid= ?  and matchtime = ?   ";
    break;
  case 43:
   // var sql = "update lot_jcteam set a_odds = ? , a_result = ?  where  orderid=? and matchName like ? and homeName like ? and guestName like ?   ";
	var sql = "update lot_jcteam set a_odds = ? , a_result = ?  where orderid= ?  and matchtime = ?  ";
    break;
  case 44:
   // var sql = "update lot_jcteam set s_odds = ? , s_result = ?  where  orderid=? and matchName like ? and homeName like ? and guestName like ?   ";
	var sql = "update lot_jcteam set s_odds = ? , s_result = ?  where orderid= ?  and matchtime = ?  ";
    break;
  case 45:
    //var sql = "update lot_jcteam set h_odds = ? , h_result = ?  where  orderid=? and matchName like ? and homeName like ? and guestName like ?  ";
	var sql = "update lot_jcteam set h_odds = ? , h_result = ?  where orderid= ?  and matchtime = ?  ";
    break;
  }
 // var values = [odds, result, orderid, ["%"+matchName+"%"], ["%"+homeName+"%"], ["%"+guestName+"%"]];
  var values = [odds, result, orderid,  lottery_num];
  console.log('正在更新' + '第' + lottery_num + '-' + orderid + '期赔率:' + odds + ',赛果:' + result);
  var sqls = client.format(sql, values);
  log.error(sqls);
  console.log(sqls);
  client.query(sql, values,
  function(error, results) {
    if (error) {
      console.log('Update Error:' + error.message);
      //client.end();
      return;
    }
    ballCheck(lottery_num, id);
  });

}

updateRealSpvalue = function(client, type, real_odds, expect, orderid) {
    var values = [real_odds, expect, orderid];

    switch (type) {
    case "jcspf":
        var sql = "update lot_jcteam set real_odds = ?  where lottery_num=? and orderid=?  ";
        break;
    case "jcjqs":
        var sql = "update lot_jcteam set real_a_odds = ?  where lottery_num=? and orderid=?  ";
        break;
    case "jccbf":
        var sql = "update lot_jcteam set real_s_odds = ?  where lottery_num=? and orderid=?  ";
        break;
    case "jcbqc":
        var sql = "update lot_jcteam set real_h_odds = ?  where lottery_num=? and orderid=?  ";
        break;
    case "jcrqspf":
        var sql = "update lot_jcteam set real_c_odds = ?  where lottery_num=? and orderid=?  ";
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
