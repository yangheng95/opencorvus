# 侧栏Rendering真实流式验收与接口闭合证据

[Recall、源码根因链与完整边界](../../records/2026-10/2026-10-14-sidebar-render-root.md)。本轮只有一个开发agent。复用原父会话及唯一既有成员，未创建新产品子成员。

before是当前代码的被动诊断构建，after是相同UI实现的正式构建，不是旧bug/新修复基线。历史已交付的输入去重、HTML保留、target/request生命周期分离由本次实际新流复核；本轮没有另造UI生产补丁。9张截图均真实交互后人工查看，不是UI自动化断言或快照测试。

| 原图 | 真实场景 |
| --- | --- |
| [01](before/01-existing.jpg) | 原有侧栏正文 |
| [02](before/02-live-history.jpg) | 新回复流中回看已有正文 |
| [03](before/03-live-return.jpg) | Running期间列表往返 |
| [04](before/04-reopen.jpg) | 已完成后关闭重开，只算完成态 |
| [05](before/05-completed-body.jpg) | 新回复16节及核对表完成态 |
| [06](after/06-production-history.jpg) | 正式构建已有历史 |
| [07](after/07-production-live-return.jpg) | 正式构建流中列表往返 |
| [08](after/08-production-live-reopen.jpg) | 正式构建流中关闭并重开，正文持续呈现 |
| [09](after/09-production-source-reading.jpg) | 实际来源复制及正文查看，完成态 |

before/lifecycle-*.json.gz保留重叠原console观察及608条去重结果；侧栏owner5–10创建后持续到观察终点，增量解析期间已接受HTML保留。初始主会话另有一次owner切换，不将其掩盖。截图不是连续视频，未据单场景宣称所有触发全面消除。

facts/final.json.gz是原412三个身份范围内的只读持久事实；facts/preservation.json.gz逐字段核对3个session、8条原消息、19个part及2组tool/outcome。数据已自动迁移至版本2，原字段值保留。facts/provider-summary.json.gz和各native最新审计记录两scope共10条真实gpt-6.1-sol流，HTTP200/settled/eof。所有凭据仅内存收集脱敏，未归档auth/models、数据库或运行二进制。

各scope的request/response/send、launch/settle/shutdown脚本和native原件可核对输入、实际结果及资源收尾。before公开shutdown成功；after在业务自然完成后触发600秒资源上限，启动句柄exit1，终态deadline_exceeded。两者都完成physical/output/request收尾与复制凭据配对退休；不能把after描述为公开shutdown或exit0。

checks包含Node诊断/正式构建、首次错误cwd构建失败与正确重试、canonical SDK生成、6项11断言的VCS错误合同测试、通过的OpenAPI路由检查。facts/historical-fixes.patch.gz保存精确生产修复历史；实现本轮开始前已经存在，新增证据不会替代生产修复。
