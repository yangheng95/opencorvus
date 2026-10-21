# 成员语言切换与 Sources 实页观察

[分析、原要求与边界](../../records/2026-10/2026-10-22-member-locale-stream.md)。单开发agent，既有成员的一次真实排版输入，Source CLI /ui18975及正式main-DhV28lza；不新建成员/Task/Goal、不使用UI自动化。未复现新的生产渲染问题，产品源码未改，条件after未启动。

| 图 | 真实人工观察 |
| --- | --- |
| [01](01-member-baseline.png) | 原成员及既有长文，输入前 |
| [02](02-member-live-en.png) | 英文UI下新流约第03节 |
| [03](03-member-live-zh-return.png) | 流中切中文并返回，第08节继续增长 |
| [04](04-member-live-read-up.png) | 流中向上阅读第05节 |
| [05](05-member-old-source-live.png) | 流中展开原ACL工具与来源 |
| [06](06-member-live-source-reopen.png) | 流中隐藏/重开，原来源与展开位置保留 |
| [07](07-source-copy-zh.png) | EOF后复制原ACL地址及中文反馈 |
| [08](08-member-final-zh.png) | 自然完成的第24节和原末尾 |
| [09](09-code-copy-zh.png) | EOF后复制原三行代码及中文反馈 |
| [10](10-member-final-en-return.png) | 完成态切回英文保留原正文末尾 |

十图均已实际查看。[观察](result-observation.json)保留原文件捕获时刻和真实Provider source reader边界：02—06在work流reading内，07—10在EOF后，不能把来源复制算作流中动作。几何、clipboard和原URL见[原观察](manual-observations.json)/[英文返回](english-return.json)。来源阅读/重开的top同为52775.19921875，height65808→66591；这是限定范围的观察，不是DOM或连续帧测试。用户/模型原文不随界面语言翻译。

原输入见[真实请求](before-request.json)，回复HTTP200/finish stop、7353字元、24节/24围栏，只有真实step-start/text/step-finish。[预检](preflight-ready.json)和观察中4个实际原reader分别为chat/memory/work/memory、gpt-6.1-sol、stream=true、200/EOF。原work结束20:43:27.841Z，memory结束20:43:49.536Z；runtime/browser error为空。实际4/8，批次最大16但after8未准备/启动即退休，不复用未用额度。原源、全量目录、实际模型与凭据分别核对，不仅凭目标命名。

[物理/预算摘要](resource-summary.json)和[原始结算](physical-terminal-and-pair-cleanup.json.gz)保留原71428/51236 exit0、公开shutdown200、native/output/request/launcher/精确出生完整关闭，108关闭；[授权退休](before-authority-retirement.json)保留runtime和私有源auth/models四成员退休与原源不变。正常记忆请求也包含在4次中，不因辅助角色排除预算。

[数据摘要](data-summary.json)和[完整检查](data-preservation-observation.json.gz)保留90表156566原行、源bytesmtime/全部原字段、schema3对象/integrity及完整canonical事实。目标只有5原行自然更新：2容量租约、当前成员Session更新时间、项目记忆文件和chunk；项目记忆整理revision40/coveredOccurrenceIDs精确关联本轮输入，原chunk31716→31529字元/7577→7528tokens。原Message/Part不变，真实新执行增量保留，不回填租约或记忆。原源库全保持，用户库未操作。

[最终秘密值扫描](credential-scan.json)覆盖当前记录/索引/全部产物和gzip解压内容，原值只在本地内存使用。脚本依赖原504/413与私有路径，按原位置使用，不是独立安装包；数据库、原行私有快照、完整响应/运行日志、凭据均不归档。

未证明连续帧完全稳定、Mission/WebView2、并发新成员/多工具流或全部Sources/Rendering。单普通Session新流与共享代码分析不替代这些资格，长期Goal保持active。
