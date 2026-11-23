# 会话 Shell 程序文本的实页证据

基线为隔离服务 `40612/ui/` 的实际会话工具回执。

| 画面 | 观察 |
| --- | --- |
| [01 两行命令正式输出](01-baseline-multiline-shell-output-fails.jpg) | 显示原始两行输入和 Bash 退出码 1。 |
| [02 启动别名和项目设置](02-baseline-startup-and-project-setup-output-fails.jpg) | 原始程序完整留存，实际输出是 `export` 参数错误。 |

候选 `40614/ui/` 的四张真实桌面截图由本人操作并复核。

| 画面 | 观察 |
| --- | --- |
| [03 英文两行命令](03-candidate-en-multiline-shell-output.jpg) | 正常显示两行输入、两行输出和退出码 0。 |
| [04 英文 Windows 换行](04-candidate-en-crlf-shell-output.jpg) | 原 CRLF 输入实际执行两行，退出码为 0。 |
| [05 中文项目设置和启动别名](05-candidate-zh-startup-and-setup-output.jpg) | 三行实际输出依次来自初始化别名、同进程项目变量和最后一条命令。 |
| [06 中文原始输入](06-candidate-zh-raw-command-source.jpg) | 当前输入明细保留完整命令和真实输出。 |
