// -*- ecoding=utf-8 -*-

var async = require('async'),
    path = require('path'),
    fs = require('fs');

// 设置是否输出日志
var enableLog = false;

// 设置任务名称
var taskName = 'x-collaborative-framework';

var terminal = require('./terminal');

// 读取配置信息
var config = terminal.toJSON(
{
    path: './diffpkg.json'
});

var options = config[taskName];

var filelogs = [];

async.series([
    // 获取版本信息
    function(callback)
    {
        terminal.currentVersion(
        {
            taskName: taskName,

            callback: function(result)
            {
                options.versionType = result.versionType;
                options.versionValue = result.versionValue;
                options.versionTimestamp = result.versionTimestamp;

                // console.log('{"version":{"value":' + result.versionValue + ',"timestamp":"' + result.versionTimestamp + '"}');
                options.versionValue++;

                callback();
            }
        });
    },
    // 创建输出目录
    function(callback)
    {
        // 输出目录名称
        var outputDirectoryName = terminal.getOutputDirectoryName(
        {
            outputDirectoryRule: options.outputDirectoryRule,
            versionValue: options.versionValue
        });

        options.outputPath = options.destPath + outputDirectoryName + '/';

        // 设置程序更新包内部一级目录路径
        var innerOutputPath = options.innerOutputPath = options.outputPath;

        if (options.innerOutputDirectoryName != '')
        {
            innerOutputPath = options.outputPath + options.innerOutputDirectoryName + '/';
        }

        // console.log('destPath:' + innerOutputPath);

        var patchFiles = [];

        terminal.mkdirs(innerOutputPath, 0777, function()
        {
            options.innerOutputPath = innerOutputPath;
            console.log(innerOutputPath + ' created.');
            callback();
        });

        // console.log(options);
    },
    // 复制需要的文件
    function(callback)
    {
        // 开始时间
        var beginDate = new Date(options.versionTimestamp || 0);

        // 结束时间
        var endDate = new Date();

        // 查找需要打补丁的文件
        copyFiles(
            [],
            options.sourcePath,
            options.sourcePath,
            options.innerOutputPath,
            beginDate,
            endDate,
            options.ignoreDirectories,
            options.ignoreFiles,
            options.ignoreBinaries);

        callback();
    },

    // 更新版本信息
    function(callback)
    {
        if (filelogs.length == 0)
        {
            callback();
        }

        filelogs.forEach(function(item)
        {
            console.log(item);
        });

        terminal.syncVersion(
        {
            taskName: taskName,
            versionValue: options.versionValue,
            callback: function(result)
            {
                // 同步成功
                console.log('finished.');
                callback();
            }
        });
    }
]);

return;

config[taskName].timestamp = endDate;

/* #region 静态函数:copyFiles(IList<string> patchFiles, string sourcePath, string inputPath, string outputPath, DateTime beginDate, DateTime endDate, string ignoreDirectories, string ignoreFiles, string ignoreBinaries) */
/**
 * 复制需要打补丁的文件
 */
function copyFiles(patchFiles, sourcePath, inputPath, outputPath, beginDate, endDate, ignoreDirectories, ignoreFiles, ignoreBinaries)
{
    if (inputPath[inputPath.length - 1] == ('\\') || inputPath[inputPath.length - 1] == ('/'))
    {
        inputPath = inputPath.substr(0, inputPath.length - 1);
    }

    if (outputPath[outputPath.length - 1] == ('\\') || outputPath[outputPath.length - 1] == ('/'))
    {
        outputPath = outputPath.substr(0, outputPath.length - 1);
    }

    // console.log('inputPath:' + inputPath);
    // console.log('outputPath:' + outputPath);

    var files = [],
        directories = [];

    var list = fs.readdirSync(inputPath);

    list.forEach(function(item)
    {
        var tmpPath = inputPath + '/' + item;

        var stats = fs.statSync(tmpPath);

        if (stats.isDirectory())
        {
            directories[directories.length] = tmpPath;
        }
        else if (stats.isFile())
        {
            files[files.length] = tmpPath;
        }
    });

    // console.log('files:' + files.length);
    // console.log('directories:' + directories.length);

    files.forEach(function(file)
    {
        if (file.toLowerCase().match(new RegExp('(' + ignoreFiles.join('|') + ')$', 'i')))
        {
            // console.log('[ignore][file] ' + file);
            return;
        }

        if (path.basename(path.dirname(destFileName)).toLowerCase() == 'bin' && file.toLowerCase().match(new RegExp('(' + ignoreBinaries.join('|') + ')$', 'i')))
        {
            // console.log('[ignore][file] ' + file);
            return;
        }

        var stats = fs.statSync(file);

        // console.log(fs.realpathSync(file));
        // console.log(file + ', lastWriteTime:' + stats.mtime + ', beginDate:' + beginDate + ', endDate:' + endDate);
        // console.log('stats.mtime >= beginDate (' + (stats.mtime >= beginDate) + ') && stats.mtime <= endDate (' + (stats.mtime <= endDate) + ')');

        // 判断更新时间
        if (stats.mtime >= beginDate && stats.mtime <= endDate)
        {
            patchFiles[patchFiles.length] = file;

            var sourceFileName = file,
                destFileName = file.replace(inputPath, outputPath);

            var destPath = path.dirname(destFileName);
            /*
            console.log('file:' + file);
            console.log('destPath:' + destPath);
            console.log('dirname:' + path.basename(path.dirname(destFileName)));
            console.log('inputPath:' + inputPath);
            console.log('outputPath:' + outputPath);
            console.log('destFileName:' + destFileName);
            // */
            if (!fs.existsSync(destPath))
            {
                terminal.mkdirsSync(destPath);
            }

            if (fs.existsSync(destFileName))
            {
                // File.SetAttributes(destFileName, System.IO.FileAttributes.Normal);
                // fs.chmodSync(destFileName, 777);
            }

            // 复制文件
            terminal.copyFile(sourceFileName, destFileName);

            filelogs.push(file.replace(sourcePath, ''));
        }
    });

    directories.forEach(function(directory)
    {
        // console.log('directory:' + directory);

        if (path.basename(directory).toLowerCase().match('(' + ignoreDirectories.join('|') + ')$'))
        {
            // console.log('[ignore][directory] ' + directory);
            return;
        }

        copyFiles(patchFiles, sourcePath, directory, (outputPath + '/' + path.basename(directory)), beginDate, endDate, ignoreDirectories, ignoreFiles, ignoreBinaries);
    });
}