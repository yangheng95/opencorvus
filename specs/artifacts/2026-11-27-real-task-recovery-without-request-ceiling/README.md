# 无次数上限真实任务恢复的证据

用户已撤销模型请求次数限制，审计中 `authorizedCeiling=null`，每次实际请求仍记账。目标为 `openai/gpt-6.1-sol`，通过开发后端 `/ui` 查看真实 Task（任务）和 Session（会话）。

| 运行 | 结果与证据边界 |
| --- | --- |
| run1 | 首 Task 完成；成员实际过载被旧转换写成 UnknownError，后续进度等待因 180 秒无实际活动失败。不是取消验收通过。 |
| run2 | 首 Task、进度、输入恢复与取消事实成立；检查器全局进程数为 1 失败，没有记录归属，尚不能判定清理根因。 |
| run3 | 原条件复现失败；全局 owner 为 `process:run-host`，目标 Task 进程集合为空，证明检查器范围误报。原始旧 PID 核对当时尚未执行。 |
| run4 | 三阶段通过，driver 退出码 0；41 次目标模型流式请求，267.187ms 进度接收、66.017ms 取消受理、10081ms 唯一终态，重启后旧工具及继承句柄父子 PID（进程标识符）均已结清。 |

- [逐次模型请求](model-request-audit.json)、[累计与分阶段结果](request-accounting.json)、[真实 Task 事件与产物](task-facts.json)。本批四轮累计观测 181 次同模型流式请求。计数是实际已观测请求，不把进程骤停时仍为 reading/awaiting_response/fetch_failed 的审计快照改写成 EOF（文件结束）；两次 aborted 亦保留。未进入的阶段保留 unavailable，不宣称完整记账。`accountingComplete` 表示三个阶段都有请求数组，不代表被中断响应完整。错误正文、模型和工具输出不能单独代替其因果事实。
- 各运行的 `provider-preflight` 保存凭据可用、模型投影与实际请求一致的预检结果；`task-control-checkpoint` 保存精确任务/执行身份、持久输入、进程、响应时延与取消事件。凭据及模型目录均不入仓；所有已结束 checker 的授权副本已经退役。
- [修复前复现](stream-error-before.log)、[修复后正向测试](stream-error-after.log)：14 pass，45 个断言；覆盖当前 SDK（软件开发工具包）实例、本地真实 HTTP（超文本传输协议）事件流、输出前后明确错误合同、结构化脱敏、上下文分类和部分输出结算。本地 SDK 检查不冒充 GPT 远端故障复验。
- [原生两项目进程检查](process-isolation.log)：4 pass，14 个断言；真实进程输出与串并行次序，Task 数据由 fixture（夹具）建立，未进行模型任务执行。另有无上限/有限额度的原 HTTP 审计 3 pass、11 个断言，以及 checker 专项类型、文档与架构索引检查通过。

以下截图均由本人实际打开页面、操作并查看；产品控件使用当前中文，模型与用户原文保留原语言：

- [run1 完成 Task](run1-task-execution.png)、[成员完整消息](run1-member-transcript.png)、[修复前实际过载错误](run1-active-worker.png)。
- [run2 重启恢复输入与按序回答](run2-recovered-task.png)。截图底部离线提示对应 checker 结束该阶段服务，不能据此认定连接缺陷。
- [run3 展开的真实完成决定](run3-completed-task.png)，显示成员检查结果、完成状态和原始 manage_task（管理任务）输出。
- [run4 最终候选的完成决定](run4-completed-task.png)，再次查看当前候选服务的完成状态、成员内容检查结果与展开的原始工具回执。

规格与完整根因分析见[本批记录](../../records/2026-11/2026-11-27-real-task-recovery-without-request-ceiling.md)。本批没有 UI（用户界面）产品源码改动，也没有新增或运行界面自动化测试。
