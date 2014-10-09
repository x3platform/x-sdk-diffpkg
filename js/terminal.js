var async = require('async'),
    path = require('path'),
    fs = require('fs'),
    mysql = require('mysql');

// 数据库连接配置
var mysqlConfig = require('./mysql-config.json');
// 数据库名称
var DATABASE_SDK_CONFIG = 'db_sdk_config';
// 创建连接
var connection = mysql.createConnection(mysqlConfig);

connection.config.queryFormat = function(query, values)
{
    if (!values) return query;
    return query.replace(/\:(\w+)/g, function(txt, key)
    {
        if (values.hasOwnProperty(key))
        {
            return this.escape(values[key]);
        }
        return txt;
    }.bind(this));
};

exports.currentVersion = function(options)
{
    connection.query('USE ' + DATABASE_SDK_CONFIG);

    connection.query('SELECT * FROM Patch_Task WHERE name = \'' + options.taskName + '\' LIMIT 0,1 ', function(err, results, fields)
    {
        if (err) throw err;

        // 执行回调函数
        options.callback(
        {
            taskName: options.taskName,
            versionType: results[0].version_type,
            versionValue: Number(results[0].version_value),
            versionTimestamp: results[0].version_timestamp
        });
    });
};

exports.syncVersion = function(options)
{
    connection.query('USE ' + DATABASE_SDK_CONFIG);

    connection.query('UPDATE Patch_Task SET version_value = ' + options.versionValue + ', version_timestamp = CURRENT_TIMESTAMP, update_date = CURRENT_TIMESTAMP WHERE name = \'' + options.taskName + '\' ', function(err, results, fields)
    {
        if (err) throw err;

        // 执行回调函数
        options.callback();
    });
};

exports.toJSON = function(options)
{
    var data = fs.readFileSync(options.path, 'utf8');

    // JavaScript 注释规则的正则表达式
    var reg = /("([^\\\"]*(\\.)?)*")|('([^\\\']*(\\.)?)*')|(\/{2,}.*?(\r|\n))|(\/\*(\n|.)*?\*\/)/g;

    if (data.length > 0)
    {
        // 去除注释后的文本
        data = data.replace(reg, function(word)
        {
            return /^\/{2,}/.test(word) || /^\/\*/.test(word) ? "" : word;
        });

        //console.log(data);

        return JSON.parse(data);
    }

    return null;
}

// 创建所有目录
var mkdirs = module.exports.mkdirs = function(directory, mode, callback)
{
    fs.exists(directory, function(exists)
    {
        if (exists)
        {
            callback(directory);
        }
        else
        {
            // 尝试创建父目录，然后再创建当前目录
            mkdirs(path.dirname(directory), mode, function()
            {
                fs.mkdir(directory, mode, callback);
            });
        }
    });
};

/**
 * 创建所有目录
 */
var mkdirsSync = module.exports.mkdirsSync = function(directory)
{
    //尝试创建父目录，然后再创建当前目录
    parent = path.dirname(directory)

    if (!fs.existsSync(parent))
    {
        mkdirsSync(parent);
    }

    if (!fs.existsSync(directory))
    {
        fs.mkdirSync(directory);
    }
};

/**
 * 数字补零
 */
var paddingZero = module.exports.paddingZero = function(value, length)
{
    var zero = null;

    for (var i = 0; i < length; i++)
    {
        if (zero == null)
        {
            zero = "0";
        }
        else
        {
            zero += "0";
        }
    }

    // 此处有错误, 需要修改
    var result = zero == null ? value : (zero + value);

    return result.substr(result.length - length, length);
}

/**
 * 数字补零
 */
var copyFile = module.exports.copyFile = function(source, dest)
{
    fs.stat(source, function(err, stats)
    {
        // 复制文件
        var sourceStream = fs.createReadStream(source);

        var destStream = fs.createWriteStream(dest);

        // 设置文件时间
        sourceStream.on('end', function()
        {
            fs.utimes(dest, stats.atime, stats.mtime);
        });

        sourceStream.pipe(destStream);
    });
}

exports.getOutputDirectoryName = function(options)
{
    // 简单的规则模式
    var patterns = options.outputDirectoryRule.split('}{');

    if (patterns.length > 0)
    {
        patterns[0] = patterns[0].substr(1, patterns[0].length - 1);
        patterns[patterns.length - 1] = patterns[patterns.length - 1].substr(0, patterns[patterns.length - 1].length - 1);
    }

    for (var i = 0; i < patterns.length; i++)
    {
        if (patterns[i].indexOf('tag:') == 0)
        {
            patterns[i] = patterns[i].substr(4, patterns[i].length - 4);
        }
        else if (patterns[i] == 'date')
        {
            var time = new Date();

            patterns[i] = time.getFullYear() + paddingZero(time.getMonth() + 1, 2) + paddingZero(time.getDate(), 2);
        }
        else if (patterns[i] == 'version')
        {
            patterns[i] = options.versionValue;
        }
    };


    return patterns.join('');
}