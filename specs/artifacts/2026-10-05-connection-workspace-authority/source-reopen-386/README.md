# 386 Sources 多文件与刷新实页

[方案与Recall](../source-reopen-plan-386.md) · [月度记录](../../../records/2026-10/2026-10-13-source-reopen-386.md) · [规范事实复核](runtime-review.json)

## 实际页面结果

当前源码构建经独立CLI服务的localhost:18406/ui提供。真实GPT-6.1 Sol在Work/Chat中连续读取三个真实中文文件的第2—3行，给出正确价格/交付比较。每个read有各自真实Message、Tool和Source；没有注入消息、工具结果或来源，没有委托子agent。

主agent已亲自查看四张真实截图：

- [三个来源](01-three-sources.png)：文件名与L2–3常显，位置与真实read相邻，三者均可识别。
- [长文件名定位](02-long-file-lines.png)：打开右侧文件后名称仍可读，原文件第2—3行真实高亮。
- [刷新重开](03-after-reload.png)：刷新自有页面、重新选择原会话，全部来源和比较结果完整。
- [刷新后再次点击](04-after-reload-file-lines.png)：方案甲仍打开正确文件并高亮第2—3行。

readonly SQLite checker核对三份刷新前/后/最终快照，所有原Source、Tool、outcome及Message保持一致；它只证明后台事实，不代替视觉检查。模型实际串行三次读取，不外推同Message并行、折叠多来源组、中文界面或子agent侧边栏。没有产品源码修改或UI自动化。

## 严格运行验收未全通过

原launcher31036真实exit1，错误OWNED_PROVIDER_REQUEST_INVALID。8次出站均为gpt-6.1-sol/stream=true，其中7次HTTP200/EOF，首个预检memory调用fetch_failed。生产11:05:42.659Z llm日志绑定预检session、memory和APIError，报告socket unexpectedly closed/isRetryable=true；没有HTTP响应，不推断远端原因。凭据/模型预检及主会话最终回复成功不消除该原失败，不改严格checker或续开scope。

页面记录14条ResizeObserver通知递送错误。当前源代码中textarea和toolbar有同步尺寸回调，但还没有逐callback运行证据，根因未知；不能用main.tsx现有debug分级或正常截图宣称闪烁已经根治。它成为下一轮明确调查对象。

## 物理收尾与证据

本轮自有tab4已关闭；Target67052/Host83860在269590ms后正常退出0，Job/output/request完整结算、port18406释放，复制auth/models均在物理完成后移除。Native物理成功与上述全请求资格失败分开保留。

checks保存完整脱敏日志、全部Provider快照、原生监督与清理回执、三份规范快照、原始checker/launcher和样本。gzip解压字节与完整脱敏输入核对只证明归档完整，不作为功能验收。前轮385的并发推送失败及同步后exit0日志一并保留；385提交e08017392已在上游。本轮没有用户实例重启、旧schema升级、界面自动化、branch/worktree或发布。
