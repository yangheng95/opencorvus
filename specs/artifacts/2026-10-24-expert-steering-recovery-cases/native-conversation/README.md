# 真实会话读取拖延原生结算

[完整调查与先行方案](../../../records/2026-10/2026-10-24-expert-steering-recovery-cases.md)；[实际前后结果](comparison.json)。这是同一已关闭营销Task的非UI后端/原生并发诊断，未创建模型消息或调用模型。

| 输入 | 修前原严格处置 | 修后原严格处置 |
| --- | --- | --- |
| 单独冻结工具 | 25ms，完成 | 29ms，完成 |
| 加一次完整会话读取 | 1987ms，完成 | 1363ms，完成 |
| 加两次完整会话读取 | 3254ms，完成 | 1988ms，完成 |
| 加四次完整会话读取 | 6138ms，原5000ms错误 | 3758ms，完成 |
| 加一次默认tail读取 | 1007ms，完成 | 729ms，完成 |
| 加一次board读取 | 321ms，完成 | 300ms，完成 |

两份完整2433003字节正式HTTP响应、280条原消息逐字段相等。每轮八次完整history也与原业务快照深度相等；完整响应原文件保留在私有04/05 scope的`evidence/actual-conversation-*.json`，没有用摘要、校验和或字数代替内容比对。

- [before/diagnostic.json](before/diagnostic.json)与[after/diagnostic.json](after/diagnostic.json)：真实HTTP读取、request/ready、原dispose/exited/output/settled及原文件操作计时。诊断收集器退出0不代表修前工具成功；其rejected原错误完整保留。
- [修前CPU profile](before/conversation.cpuprofile)与[修后CPU profile](after/conversation.cpuprofile)：Bun CLI原生采样，没有JS周期采样器。inclusive耗时存在父子包含，不相加当作总CPU时间。
- 两目录的`native-host-settled.json`、`launcher-child-exit.json`、`retirement.json`：原自有进程正常退出、物理/输出/请求完整结算、零模型、catalog退休；从未复制用户凭据。
- [driver-source.txt](driver-source.txt)、[launcher-source.txt](launcher-source.txt)：04/05原诊断驱动与launcher的源码副本，用于核对实际输入和观察逻辑；原可执行入口保留在私有`.tmp-product-iteration/expert-steering-recovery/`，源码副本不作为默认测试运行。

修前只通过Bun模块加载器读取不可变提交`acab57ac0`的原`message-bridge.ts`，实际加载一次。修后读取当前生产源码；其他代码、真实历史、查询输入、原生helper及5000ms均相同。没有回退工作区、mock领域结果、增加超时或加流程gate。

根因是history投影对父Message和每个Part反复解析同一执行身份，而Part的metadata结果被丢弃。修复保留父Message完整身份/descriptor完整性验证，Part绑定父Message/Session后复用唯一持久排序检查。实时事件继续完整身份验证；没有新增跨请求缓存或第二身份来源。其余board成本未扩大重构，不能据此承诺无限并发均低于固定期限。
