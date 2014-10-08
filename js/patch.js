// -*- ecoding=utf-8 -*-

var path = require('path');
var fs = require('fs');

var tasks = JSON.parse(fs.readFileSync('./patch.json', 'utf8'));

// 设置任务名称
var taskName = '12582wap';

var options = tasks[taskName];

// 开始时间
var beginDate =options.timestamp;
// 结束时间
var endDate = new Date();

// 日志文件
var logFile = options.destPath + "patch.log";
// 管理版本文件
var versionFile = options.destPath + "patch.version";

// 格式化参数格式

var version = 1;

// var version = ReadPatchVersion(versionFile, taskName, versionType, version, ref beginDate);

// 输出目录
// var outputPath = destPath + GetOutputDirectoryName(outputDirectoryRule, ref version) + "\\";
options.outputPath = options.destPath + 'test' + '/';

// 设置程序更新包内部一级目录路径
var innerOutputPath = options.outputPath;

if (options.innerOutputDirectoryName != '')
{
    innerOutputPath = options.outputPath + options.innerOutputDirectoryName + '/';
}

console.log('destPath:' + innerOutputPath);

var patchFiles = [];

// DirectoryHelper.Create(innerOutputPath);

if (!fs.existsSync(innerOutputPath))
{
    fs.mkdirSync(innerOutputPath);
}

// FindPatchFiles(patchFiles, sourcePath, sourcePath, innerOutputPath, beginDate, endDate, ignoreDirectories, ignoreFiles, ignoreBinaries);

// 查找需要打补丁的文件
findPatchFiles(
    [],
    options.sourcePath,
    options.sourcePath,
    innerOutputPath,
    beginDate,
    endDate,
    options.ignoreDirectories,
    options.ignoreFiles,
    options.ignoreBinaries);

tasks[taskName].timestamp = endDate;

fs.writeFile('./patch.json', JSON.stringify(tasks, null, 4));
/*


            if (patchFiles.Count == 0)
            {
                Console.WriteLine("There is no patch file.");
            }
            else
            {
                WritePatchLog(logFile, patchFiles, sourcePath, beginDate, endDate, ignoreDirectories, ignoreFiles);

                // 写入版本文件
                WritePatchVersion(versionFile, options.Task, version);
            }

            // 复制 readme 文件
            if (File.Exists(destPath + "readme.txt"))
            {
                File.Copy(destPath + "readme.txt", outputPath + "readme.txt", true);
            }
*/

/* #region 静态函数:FindPatchFiles(IList<string> patchFiles, string sourcePath, string inputPath, string outputPath, DateTime beginDate, DateTime endDate, string ignoreDirectories, string ignoreFiles, string ignoreBinaries) */
/**
 * 查找需要打补丁的文件
 */
function findPatchFiles(patchFiles, sourcePath, inputPath, outputPath, beginDate, endDate, ignoreDirectories, ignoreFiles, ignoreBinaries)
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
        if (file.toLowerCase().match('(' + ignoreFiles.join('|') + ')$'))
        {
            // console.log('[ignore][file] ' + file);
            return;
        }

        if (path.basename(path.dirname(destFileName)).toLowerCase() == 'bin' && file.toLowerCase().match('(' + ignoreBinaries.join('|') + ')$'))
        {
            // console.log('[ignore][file] ' + file);
            return;
        }

        var stats = fs.statSync(file);

        // console.log(fs.realpathSync(file));
        // console.log(file + ', lastWriteTime:' + stats.mtime + ', beginDate:' + beginDate + ', endDate:' + endDate);

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
*/
            if (!fs.existsSync(destPath))
            {
                mkdirs(destPath);
            }

            if (fs.existsSync(destFileName))
            {
                // File.SetAttributes(destFileName, System.IO.FileAttributes.Normal);
                // fs.chmodSync(destFileName, 777);
            }
            /*

            if (File.Exists(destFileName))
            {
                File.SetAttributes(destFileName, System.IO.FileAttributes.Normal);
            }
*/
            // File.Copy(sourceFileName, destFileName, true);
            fs.createReadStream(sourceFileName).pipe(fs.createWriteStream(destFileName));

            // console.log(file.replace(sourcePath, ''));
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

        /*
        DirectoryInfo directoryInfo = new DirectoryInfo(directory);

        string relativePath = directoryInfo.FullName.Replace(sourcePath, string.Empty).ToLower() + "\\";

        if (ignoreDirectories.IndexOf(relativePath + ";") > -1 || ignoreDirectories.IndexOf(directoryInfo.Name.ToLower() + ";") > -1)
        {
            continue;
        }
        */

        findPatchFiles(patchFiles, sourcePath, directory, (outputPath + '/' + path.basename(directory)), beginDate, endDate, ignoreDirectories, ignoreFiles, ignoreBinaries);
    });

    /*    
    foreach(var directory in directories)
    {
        DirectoryInfo directoryInfo = new DirectoryInfo(directory);

        string relativePath = directoryInfo.FullName.Replace(sourcePath, string.Empty).ToLower() + "\\";

        if (ignoreDirectories.IndexOf(relativePath + ";") > -1 || ignoreDirectories.IndexOf(directoryInfo.Name.ToLower() + ";") > -1)
        {
            continue;
        }

        findPatchFiles(patchFiles, sourcePath, directory, string.Format("{0}\\{1}", outputPath, directoryInfo.Name), beginDate, endDate, ignoreDirectories, ignoreFiles, ignoreBinaries);
    }*/
}

/**
 * 数字补零
 */
function paddingZero(version, length)
{
    var zero = null;

    for (var i = 0; i < length; i++)
    {
        zero += "0";
    }
    // 此处有错误, 需要修改
    return zero == null ? version : (zero + version);
}

/**
 * 创建所有目录
 */
function mkdirs(directory)
{
    //尝试创建父目录，然后再创建当前目录
    parent = path.dirname(directory)

    if (!fs.existsSync(parent))
    {
        mkdirs(parent);
    }

    if (!fs.existsSync(directory))
    {
        fs.mkdirSync(directory);
    }
};