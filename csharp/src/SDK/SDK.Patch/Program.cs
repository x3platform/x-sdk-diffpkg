namespace X3Platform.SDK.Patch
{
    using System;
    using System.Collections.Generic;
    using System.Text;
    using System.IO;
    using System.Configuration;
    using System.Reflection;

    using X3Platform.Configuration;
    using X3Platform.Util;
    using X3Platform.CommandLine.Text;
    using X3Platform.CommandLine;

    class Program
    {
        private static readonly AssemblyName program = Assembly.GetExecutingAssembly().GetName();

        /// <summary>头部信息</summary>
        private static readonly HeadingInfo headingInfo = new HeadingInfo(program.Name,
            string.Format("{0}.{1}", program.Version.Major, program.Version.Minor));

        private sealed class Options
        {
            #region Standard Option Attribute

            //
            // 创建程序更新包
            //

            [Option("task", DefaultValue = "", Required = true, HelpText = "程序补丁任务的名称。")]
            public string Task { get; set; }

            [Option("begindate", HelpText = "文件更新时间变动范围开始时间。")]
            public DateTime BeginDate { get; set; }

            [Option("enddate", HelpText = "文件更新时间变动范围结束时间。")]
            public DateTime EndDate { get; set; }

            [Option('s', "silent", DefaultValue = false, HelpText = "安静模式，程序执行完毕自动关闭。")]
            public bool Silent { get; set; }

            /// <summary>用法</summary>
            /// <returns></returns>
            [HelpOption(HelpText = "显示帮助信息。")]
            public string GetUsage()
            {
                var help = new HelpText(Program.headingInfo);

                help.AdditionalNewLineAfterOption = true;

                help.Copyright = new CopyrightInfo(KernelConfigurationView.Instance.WebmasterEmail, 2008, DateTime.Now.Year);

                help.AddPreOptionsLine("程序更新包管理命令行工具");
                // help.AddPreOptionsLine("用于日常软件打包管理.\r\n");

                help.AddPreOptionsLine("Usage:");
                help.AddPreOptionsLine(string.Format("  {0} --task wap", program.Name));
                help.AddPreOptionsLine(string.Format("  {0} --task wap --silent", program.Name));
                help.AddPreOptionsLine(string.Format("  {0} --task wap --begindate 2010-01-01 --silent", program.Name));
                help.AddPreOptionsLine(string.Format("  {0} --help", program.Name));
                help.AddOptions(this);

                return help;
            }
            #endregion
        }

        /// <summary>应用程序的主入口点。</summary>
        [STAThread]
        static void Main(string[] args)
        {
            try
            {
                var options = new Options();

                if (args.Length == 0)
                {
                    Console.WriteLine(options.GetUsage());
                    Environment.Exit(0);
                }

                var parser = new CommandLine.Parser(with => with.HelpWriter = Console.Error);

                if (parser.ParseArgumentsStrict(args, options, () => Environment.Exit(1)))
                {
                    Command(options);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("{" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff") + "}");
                Console.WriteLine(ex);
            }

            Environment.Exit(0);
        }

        private static void Command(Options options)
        {
            // 开始时间
            TimeSpan beginTimeSpan = new TimeSpan(DateTime.Now.Ticks);

            if (!string.IsNullOrEmpty(options.Task))
            {
                // 压缩单个任务
                Patch(options);
            }

            // 结束时间
            TimeSpan endTimeSpan = new TimeSpan(DateTime.Now.Ticks);

            CommandLineHelper.SetTextColor(CommandLineHelper.Foreground.Yellow);
            Console.WriteLine("\r\n执行结束，共耗时{0}秒。", beginTimeSpan.Subtract(endTimeSpan).Duration().TotalSeconds);
            CommandLineHelper.SetTextColor(CommandLineHelper.Foreground.White);

            if (!options.Silent)
            {
                Console.WriteLine("Pass any key to continue");
                Console.Read();
            }
        }

        #region 静态函数:Patch(Options options)
        static void Patch(Options options)
        {
            // 任务名称
            string taskName = options.Task;

            // 程序源码目录
            string sourcePath = ConfigurationManager.AppSettings["Patch.Tasks." + taskName + ".SourcePath"];
            // 程序更新包输出目录
            string destPath = ConfigurationManager.AppSettings["Patch.Tasks." + taskName + ".DestPath"];
            // 程序更新补丁包版本类型
            string versionType = ConfigurationManager.AppSettings["Patch.Tasks." + taskName + ".VersionType"];
            // 程序更新补丁包名称规则
            string outputDirectoryRule = ConfigurationManager.AppSettings["Patch.Tasks." + taskName + ".OutputDirectoryRule"];
            // 程序更新包内部一级目录名称 如果为空则不创建内部目录
            string innerOutputDirectoryName = ConfigurationManager.AppSettings["Patch.Tasks." + taskName + ".InnerOutputDirectoryName"];
            // 忽略的目录
            string ignoreDirectories = ConfigurationManager.AppSettings["Patch.Tasks." + taskName + ".Ignore.Directories"];
            // 忽略的文件
            string ignoreFiles = ConfigurationManager.AppSettings["Patch.Tasks." + options.Task + ".Ignore.Files"];
            // 忽略的二进制文件
            string ignoreBinaries = ConfigurationManager.AppSettings["Patch.Tasks." + taskName + ".Ignore.Binaries"];

            DateTime beginDate = options.BeginDate;
            DateTime endDate = options.EndDate;

            // 日志文件
            string logFile = destPath + "xpatch.exe.log";
            // 管理版本文件
            string versionFile = destPath + "xpatch.exe.version";

            // 格式化参数格式
            ignoreDirectories = string.IsNullOrEmpty(ignoreDirectories) ? string.Empty : ignoreDirectories.ToLower();

            ignoreFiles = string.IsNullOrEmpty(ignoreFiles) ? string.Empty : ignoreFiles.ToLower();

            ignoreBinaries = string.IsNullOrEmpty(ignoreBinaries) ? string.Empty : ignoreBinaries.ToLower();

            int version = 1;

            version = ReadPatchVersion(versionFile, taskName, versionType, version, ref beginDate);

            // 输出目录
            string outputPath = destPath + GetOutputDirectoryName(outputDirectoryRule, ref version) + "\\";

            // 设置程序更新包内部一级目录路径
            string innerOutputPath = outputPath;

            if (!string.IsNullOrEmpty(innerOutputDirectoryName))
            {
                innerOutputPath = outputPath + innerOutputDirectoryName + "\\";
            }

            IList<string> patchFiles = new List<string>();

            DirectoryHelper.Create(innerOutputPath);

            FindPatchFiles(patchFiles, sourcePath, sourcePath, innerOutputPath, beginDate, endDate, ignoreDirectories, ignoreFiles, ignoreBinaries);

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
        }
        #endregion

        #region 静态函数:FindPatchFiles(IList<string> patchFiles, string sourcePath, string inputPath, string outputPath, DateTime beginDate, DateTime endDate, string ignoreDirectories, string ignoreFiles, string ignoreBinaries)
        static void FindPatchFiles(IList<string> patchFiles, string sourcePath, string inputPath, string outputPath, DateTime beginDate, DateTime endDate, string ignoreDirectories, string ignoreFiles, string ignoreBinaries)
        {
            if (inputPath.LastIndexOf("\\") == inputPath.Length - 1)
            {
                inputPath = inputPath.Substring(0, inputPath.Length - 1);
            }

            if (outputPath.LastIndexOf("\\") == outputPath.Length - 1)
            {
                outputPath = outputPath.Substring(0, outputPath.Length - 1);
            }

            string[] files = Directory.GetFiles(inputPath);

            string[] directories = Directory.GetDirectories(inputPath);

            foreach (string file in files)
            {
                FileInfo fileInfo = new FileInfo(file);

                if (ignoreFiles.IndexOf(fileInfo.Extension.ToLower() + ";") > -1 || ignoreFiles.IndexOf(fileInfo.Name.ToLower() + ";") > -1) { continue; }

                if (fileInfo.Directory.Name == "bin" && ignoreBinaries.IndexOf(fileInfo.Name.ToLower() + ";") > -1) { continue; }

                // 判断更新时间
                if (File.GetLastWriteTime(file) >= beginDate && File.GetLastWriteTime(file) <= endDate)
                {
                    patchFiles.Add(file);

                    string sourceFileName = file;

                    string destFileName = file.Replace(inputPath, outputPath);

                    string destPath = Path.GetDirectoryName(destFileName);

                    if (!Directory.Exists(destPath))
                    {
                        DirectoryHelper.Create(destPath);
                    }

                    if (File.Exists(destFileName))
                    {
                        File.SetAttributes(destFileName, System.IO.FileAttributes.Normal);
                    }

                    File.Copy(sourceFileName, destFileName, true);

                    Console.WriteLine(file.Replace(sourcePath, string.Empty));
                }
            }

            foreach (string directory in directories)
            {
                DirectoryInfo directoryInfo = new DirectoryInfo(directory);

                string relativePath = directoryInfo.FullName.Replace(sourcePath, string.Empty).ToLower() + "\\";

                if (ignoreDirectories.IndexOf(relativePath + ";") > -1 || ignoreDirectories.IndexOf(directoryInfo.Name.ToLower() + ";") > -1) { continue; }

                FindPatchFiles(patchFiles, sourcePath, directory, string.Format("{0}\\{1}", outputPath, directoryInfo.Name), beginDate, endDate, ignoreDirectories, ignoreFiles, ignoreBinaries);
            }
        }
        #endregion

        #region 静态函数:WritePatchLog(IList<string> patchFiles, string sourcePath, string inputPath, string outputPath, DateTime beginDate, DateTime endDate, string ignoreDirectories, string ignoreFiles)
        static void WritePatchLog(string logFile, IList<string> patchFiles, string sourcePath, DateTime beginDate, DateTime endDate, string ignoreDirectories, string ignoreFiles)
        {
            StringBuilder outString = new StringBuilder();

            outString.AppendLine("=====================================================");
            outString.AppendLine("date:" + beginDate.ToString("yyyy-MM-dd HH:mm:ss") + "～" + endDate.ToString("yyyy-MM-dd HH:mm:ss"));
            outString.AppendLine("source:" + sourcePath);
            outString.AppendLine("-----------------------------------------------------");
            foreach (string patchFile in patchFiles)
            {
                outString.AppendLine(patchFile.Replace(sourcePath, string.Empty));
            }
            outString.AppendLine("-----------------------------------------------------");
            outString.AppendLine("patch date:" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
            outString.AppendLine("-----------------------------------------------------");

            File.AppendAllText(logFile, outString.ToString());
        }
        #endregion

        static int ReadPatchVersion(string versionFile, string taskName, string versionType, int version, ref DateTime timespan)
        {
            if (!File.Exists(versionFile))
            {
                FileHelper.Create(versionFile);
            }

            PropertiesFile properties = new PropertiesFile(versionFile);

            string versionValue = properties.Read(taskName, "version");
            string timpspanValue = properties.Read(taskName, "timpspan");

            DateTime latestTimespan = DateTime.MinValue;

            if (!string.IsNullOrEmpty(timpspanValue))
            {
                latestTimespan = Convert.ToDateTime(timpspanValue);
            }

            if (string.IsNullOrEmpty(versionValue))
            {
                version = 0;
            }
            else
            {
                if (!string.IsNullOrEmpty(versionValue) && versionType == "DailyIncrement")
                {
                    version = (latestTimespan.Day == DateTime.Now.Day) ? Convert.ToInt32(versionValue) : 0;
                }
                else
                {
                    version = Convert.ToInt32(versionValue);
                }

                if (timespan == DateTime.MinValue)
                {
                    timespan = Convert.ToDateTime(timpspanValue);
                }
            }

            return version;
        }

        static void WritePatchVersion(string versionFile, string taskName, int version)
        {
            PropertiesFile properties = new PropertiesFile(versionFile);

            properties.Write(taskName, "version", version.ToString());
            properties.Write(taskName, "timpspan", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
            properties.Save(versionFile);
        }

        static string GetOutputDirectoryName(string expression, ref int version)
        {
            return RunScript(expression, ref version);
            // return RunScript(expression.Replace("{tag:_}{version}", string.Empty).Replace("{version}", string.Empty), ref version);
        }

        /// <summary></summary>
        /// <param name="expression"></param>
        /// <param name="version"></param>
        /// <returns></returns>
        public static string RunScript(string expression, ref int version)
        {
            return RunScript(expression, DateTime.Now, ref version);
        }

        /// <summary></summary>
        /// <param name="expression"></param>
        /// <param name="updateDate"></param>
        /// <param name="version"></param>
        /// <returns></returns>
        public static string RunScript(string expression, DateTime updateDate, ref int version)
        {
            return RunScript(expression, string.Empty, DateTime.Now, ref version);
        }

        /// <summary></summary>
        /// <param name="expression"></param>
        /// <param name="updateDate"></param>
        /// <param name="version"></param>
        /// <returns></returns>
        public static string RunScript(string expression, string prefixCode, DateTime updateDate, ref int version)
        {
            string result = null;

            // 处理前缀标签
            expression = string.IsNullOrEmpty(prefixCode) ?
                expression.Replace("{prefix}", string.Empty) : expression.Replace("{prefix}", "{tag:" + prefixCode + "}");

            // 种子自增
            version++;

            // 拆分为子表达式列表
            IList<string[]> subexpressions = SplitExpression(expression);

            foreach (string[] subexpression in subexpressions)
            {
                result += AnalyzeExpression(subexpression, updateDate, version);
            }

            return result;
        }

        /// <summary></summary>
        /// <param name="expression"></param>
        /// <returns></returns>
        private static IList<string[]> SplitExpression(string expression)
        {
            // 表达式 示例
            // {dailyIncrement:version:6}
            // {date:yyyyMMdd}{tag:-}{int:version}
            IList<string[]> subexpressions = new List<string[]>();

            string[] list = expression.Split('}');

            foreach (string item in list)
            {
                if (item.Length < 2)
                {
                    continue;
                }

                subexpressions.Add(item.Substring(1, item.Length - 1).Split(':'));
            }

            return subexpressions;
        }

        /// <summary>分析表达式</summary>
        /// <param name="subexpression"></param>
        /// <param name="updateDate"></param>
        /// <param name="version"></param>
        /// <returns>结果</returns>
        private static string AnalyzeExpression(string[] subexpression, DateTime updateDate, int version)
        {
            switch (subexpression[0])
            {
                // 标签类型
                case "tag":
                    return subexpression[1];

                // 日期类型
                case "date":
                    if (subexpression.Length == 2)
                    {
                        return DateTime.Now.ToString(subexpression[1]);
                    }
                    else
                    {
                        return DateTime.Now.ToString("yyyyMMdd");
                    }

                case "version":
                case "int":
                    if (subexpression.Length == 3)
                    {
                        return PaddingZero(version, Convert.ToInt32(subexpression[2]));
                    }
                    else
                    {
                        return version.ToString();
                    }

                // 每日自增型数字
                case "dailyIncrement":
                    if (updateDate.ToString("yyyy-MM-dd") == DateTime.Now.ToString("yyyy-MM-dd"))
                    {
                        if (subexpression.Length == 3)
                        {
                            return PaddingZero(version, Convert.ToInt32(subexpression[2]));
                        }
                        else
                        {
                            return version.ToString();
                        }
                    }
                    else
                    {
                        if (subexpression.Length == 3)
                        {
                            return PaddingZero(1, Convert.ToInt32(subexpression[2]));
                        }
                        else
                        {
                            return "1";
                        }
                    }

                // 整数类型自增型数字
                case "code":
                    if (subexpression.Length == 2)
                    {
                        return PaddingZero(version, Convert.ToInt32(subexpression[1]));
                    }
                    else
                    {
                        return PaddingZero(version, 3);
                    }

                default:
                    return "UnkownExpression";
            }
        }

        /// <summary>数字补零</summary>
        /// <param name="version"></param>
        /// <param name="lengthText"></param>
        /// <returns></returns>
        private static string PaddingZero(int version, int length)
        {
            string zero = null;

            for (int i = 0; i < length; i++)
            {
                zero += "0";
            }

            return string.IsNullOrEmpty(zero) ? version.ToString() : version.ToString(zero);
        }
    }
}
