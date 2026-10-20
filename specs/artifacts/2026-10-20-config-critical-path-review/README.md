# 完整配置关键路径与原物理终态复用

[实施前Recall及完整裁决](../../records/2026-10/2026-10-20-config-critical-path-review.md)。单开发agent；无UI（User Interface，用户界面）自动化、用户18571操作或用户数据库访问。

## 实际结果与范围

原完整production Config service → browser HostTransport → HTTP（Hypertext Transfer Protocol，超文本传输协议）检查器保留所有当前目录、模型/插件候选验证、完整canonical恢复和四类并发读取。原10秒/5秒/20秒指标没有放宽。

| 原scope/检查句柄 | 保存毫秒 | 恢复毫秒 | 最长并发读取毫秒 | 判定 |
| --- | ---: | ---: | ---: | --- |
| before54172 / writer22044 / readers33705，带私有观察 | 17300.0061 | 17032.8007 | 17475.4437 | 保存/恢复未达标；读取通过 |
| after56754 / writer21337 / readers3767，未插桩 | 17302.3458 | 17259.3533 | 17355.6937 | 保存/恢复未达标；读取通过 |
| 同after / writer15327 / readers76201，未插桩连续轮 | 16874.0041 | 16332.0342 | 16935.9883 | 保存/恢复未达标；读取通过 |

[完整writer/reader及原判定](performance.json)与[按原HTTP request ID归组的phase](phase-summary.json)。三次都成功且完整恢复Ask；所有并发读200，目录227 Provider/8133模型。本次没有建立稳定整体性能收益，不能把微小波动归功于终态复用。

## 原生观察与改动

[分段摘要](process-profile-summary.json)与[895条原helper样本](process-samples.jsonl)由同一个原Target被动观察；另1个只读遇到的其他owner request目录单独标明，没有算成该Target的新调用。观察脚本保留原builtins、参数、原promise和错误；只观察原spawn/exit/close，不添加stdout消费者、不保存环境或请求正文。完整scope的所有样本均有原close和原请求删除完成。

两个真实PATCH窗口分别包含290/286条命令：同步spawn累计6547/6403ms、helper close至请求删除完成累计4231/4414ms。请求文件sync累计2696/2791ms，不能单独解释17秒。窗口可能包含并发页面/reader命令；重叠累计时长不是CPU（Central Processing Unit，中央处理器）或整个请求墙钟。观察开销不能当作未插桩资格。实际调用代码与隔离启动附在[profile](profile.ts.txt)、[before launch](launch-before.ps1.txt)、[after launch](launch-after.ps1.txt)，文本相对路径以原scratch目录为准。

共享supervisor的原exited已验证精确request/runtime/helper/target和active-process-zero；settled/dispose都等待它，清理却又读同一套marker。当前仅让清理继续依赖这个原exited，保留独立output分支、原初次标记校验/缺失重试、cleanup失败重试、detached所有权与orphan恢复。没有新身份缓存、另一物理状态或减少Project身份/候选验证。此简化有单一已验证物理事实的直接依据；不将它包装为完整性能修复。

[28例/84断言](process-tests.log)包括新增的真实native终态多消费者、实际stdout/stderr与原exit7，原Host/Task facade、前台子树、取消/deadline、缺失物理证明和Windows orphan冲突/恢复；全部正式隔离runner通过。5个文件均为非UI功能检查。当前[backend typecheck](typecheck.log)通过。

## 人工视觉复核

全部11张均来自当前477正式UI与源码CLI（Command Line Interface，命令行界面）的真实/ui页面，逐张实际呈现并人工查看。UI源码未修改，不宣称新的视觉修复。

- 原设置及首轮目录：[01](01-before-general.png)、[02](02-before-providers-writing.png)、[03](03-before-providers-restored.png)、[04](04-before-ask-restored.png)。02拍在首个提交完成、恢复仍在进行时，已加载目录真实保留；不冒称Loading。
- 未插桩首轮：[05](05-after-general.png)、[06](06-after-providers-writing.png)、[07](07-after-providers-restored.png)、[08](08-after-ask-restored.png)。06首次打开Provider时显示真实加载说明，之后完整目录恢复。
- 未插桩连续轮：[09](09-repeat-providers-writing.png)、[10](10-repeat-providers-restored.png)、[11](11-final-ask-restored.png)。已有目录在写入期间保留，最终原Ask设置可见。

重复画面是不同时间的实际截图，未作为Rendering异常判断；03和10另外从落盘PNG（Portable Network Graphics，便携式网络图形）完整打开复核。

## 数据、凭据与生命周期

[原生结算](native-settlement.json)：before54172/after56754原句柄均exit0，两个公开shutdown200；physical/output/request/launcher与全部writer/reader结算，日志都在下一启动前冻结。完整auth/models成对预检精确gpt-6.1-sol；整批4/8个真实请求全部stream200且原source reader EOF（End Of File，流结束），完成时间早于运行对退休。无活跃扩额、refresh/exchange或源写入。

[只读历史核对](history.json)：147 Project/196 Session → 149/198/schema3；每个旧身份、目录和归属保留，真实双Sources会话的32 Message/72 Part/62协议行及rowid逐行相同。仅新增两个实际凭据预检会话；没有业务输入或schema变更。完整parsed canonical等于最初私有快照。[凭据退休记录](credential-retirement.json)：144个自有证据文件按5个实际凭据值检查通过，源凭据大小和修改时间不变；私有完整auth/models对已在原始结算后退休。

[文档检查](docs-check.log)通过345个操作/26组；[架构索引](architecture-check.log)通过20篇当前文档。未更新版本或执行发布。

仍未完成：完整配置保存≤10秒/恢复≤5秒；剩余主线程同步启动与全量身份成本还需调查，Sources/Rendering的广泛体验也继续。本记录的真实小改动与局部时段不替代整个长期目标。
