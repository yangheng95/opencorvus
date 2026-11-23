# 会话 Shell 保留多行命令和项目设置程序

## Recall

用户要求持续分批调查并由本人独立完成。先记录根因、影响、规格与证据，再实现、访问真实桌面、截图复核、运行聚焦正向验证、提交、合并上游并普通推送。上一批远端 `main` 确认为 `8aa9cf83dce2699907dcc7030b76a2ce09a48406`，本地 177 条原状态保留。此前[对话查找的真实输入](2026-11-23-conversation-search-visible-spacing.md)记录 Shell 多行输出差异。本批使用自建专用回环服务、项目和 Git Bash（Git 附带的命令解释器），只有隔离子进程的 Shell 用户目录，未使用 Provider 凭据或生产进程。

已读 `session.shell` 路由和重放属主、`SessionShell.shell`、Bash Tool（Bash 工具）、`LocalEnvironment.projectShellCommand`、Shell 选择、进程监管参数和本项目真实配置、授权归属、状态发布、两个 Session（会话）Shell 聚焦测试及 05-config、02-data 中的约束。全仓核对 `SessionPrompt.shell`、`SessionShell.shell`、`projectShellCommand`、`spawnHostShellGated`、`spawnTaskShellGated`、启动别名和多行脚本调用。历史 `27f0cf2de`、`e08e65695`、`95f8d9a36` 已覆盖命令输入留存和完成，不验证实际输出行。所查范围未发现界面自动化测试。

## 根因与影响（实施前）

前批实际存储 CRLF（回车和换行）时，Windows Git Bash 回执把两条命令合成一行。现在在 `40612/ui/` 的独立项目显式选用已安装的 Git Bash，初始化脚本经正式配置读取确认，启动别名来自隔离目录的实际 .bashrc。两次走真实项目对话创建、`POST /session/:id/shell`、状态及正式导出。第一条两行 `echo`：保存原文保留换行，真实输出却是 Bash 把后续词当作 `export` 参数的错误，退出码 1。同样，启动别名、项目变量和普通输出三行的第二条返回退出码 1。本人复核两份实页工具回执，正式重放恢复相同最终消息及原工具输出。[基线截图](../../artifacts/2026-11-23-session-shell-preserve-command-source/README.md)

直接触发是在 Bash 及 Zsh 路径从共享项目环境取得含有原换行的脚本后，再按 JSON（JavaScript Object Notation，结构化文本格式）字符串编码交给 Shell 解释。这个额外解释阶段将原换行变成普通字符，启动段和程序段的命令边界丢失。真实 Git Bash 用同一隔离启动文件、项目脚本和常规 `-c` 程序文本，按顺序输出 `startup-copper`、`setup-ready`、`visible-receipt`，退出 0。Bash 工具已经把共享项目环境的完整程序直接传给监管器；普通 Shell 进程接口也接收真实程序文本。原生解释器文档说明别名在读入命令时展开，启动行需要先执行。[GNU Bash 运行过程](https://www.gnu.org/software/bash/manual/html_node/Shell-Operation.html) [GNU Bash 别名](https://www.gnu.org/software/bash/manual/html_node/Aliases.html)

实际影响是显式会话 Shell 在 Bash/Zsh 下的命令文本、项目 setup_script、正常多行命令输出和已有别名的可用性。代码分岔早于宿主或任务执行授权选择。当前非零退出的实际进程已结束，`completed` 代表该命令轮次收敛，原 Tool（工具）回执保留退出 1，且正式重放读到同一持久消息。现有测试也覆盖非零退出的已结算轮次。核对 Task（任务）/Mission（使命）权威入口及独立 Bash 工具消费方，此处没有已观察到的任务调度、队列、执行重复或终态不收敛。保留项目设置及权限、原始输入、外部进程监管、工作目录、结构化结果、串并行隔离、历史重放和终态。公开接口、数据结构、版本发布与模型均不涉修改。

## 方案和验收

Bash 与 Zsh 保留各自现有初始化行，之后以标准程序文本继续在同一个解释器中执行共享项目脚本和原始命令。原始字节由已经存在的 Shell 调用参数透传，取消中间语言编码和额外解释。其它 Shell 按现有原始程序文本调用。不同初始化命令仍独立；不改变监管器收到的授权、环境、安全过滤及执行身份。风险包括初始化别名失效、项目变量作用域错误、原命令换行/引号改变、退出码或重放身份回归。

候选 `40614/ui/` 使用同一隔离程序和 Git Bash，核对两次实际输出及退出码 0、项目设置和启动别名、API（Application Programming Interface，应用程序接口）导出的原始字节、结算视图以及同一次请求的完全一致回执。真实桌面展开命令详情和实际输出，视觉复核英文与中文及原始输入文案。聚焦真实 Shell 轮次测试同时验证输出、退出码及原输入，覆盖串行原始身份和已有并行项目、取消或重放合同。以本机真实 Windows Git Bash 验收；若没有真实 Zsh 环境，明确记录该分支未运行。后端类型、文档、架构及差异检查，确认隔离数据、两个工作实例正常退出，再提交、合并并推送。
