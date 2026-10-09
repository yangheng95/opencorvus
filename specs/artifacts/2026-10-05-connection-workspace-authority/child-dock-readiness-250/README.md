# 250 原始历史启动审查

这是本次启动前重新执行的只读审查，不把旧准入当作永久许可。原进程创建身份、端口、完整 Task/Session/Project、当前配置、持久前沿和全部恢复入口在复制前核对。

- [精确进程与端口观察](guard.json)。原 Native 与 Host 精确实例已退出，原 18098 与新 18185 没有监听；原凭据对已退役。
- [当前生产启动投影](result-startup.json)：schema（数据库结构）一致，Task completed/epoch1，Provider/Tool 终态齐全，恢复候选及未闭合发布/投递均为空；两个原 Project 的配置、终端、能力与文件边界已审查。
- [持久恢复前沿](result-frontier.json)：15 条 assistant 均完成，权限 8 组开始/结果与两个 checkpoint（检查点）闭合，入口 resolved/resolved/terminal_inapplicable，memory（记忆）空闲。
- [root 准入说明](admitted-manifest.json)：保留原始 Task、Project、root Session、request 与 canonical（持久事实）项目目录。

唯一 MAX_SAFE_INTEGER 的 runtime_process（运行进程）记录是精确物理进程身份的非到期存储形式；其原 PID（Process Identifier，进程标识符）实例已由操作系统观察确认退出。当前 process-liveness 实现使用物理身份判定，不把这条历史记录误判成活动任务。默认 MCP（Model Context Protocol，模型上下文协议）声明没有待执行调用；本轮只读历史，不创建模型或 agent 执行。

一次准入工具起初误用原 Run 根目录的 closed-log-audit-custody 路径，真实缺文件失败后找到原 Evidence 的正式文件并重新完成检查。一次输出读取误用 result.json，实际文件是 result-frontier.json，随后读取正确事实；没有改写结果或降低准入。
