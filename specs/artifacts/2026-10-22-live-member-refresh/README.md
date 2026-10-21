# 成员正文流中刷新：真实证据

[方案与结论](../../records/2026-10/2026-10-22-live-member-refresh.md)。只有一个开发agent；被体验产品内的两个真实研究成员与开发委托区分。当前f99ee66b30951cd05b977223ca6b6452b0d65d5c对应正式main-B1unUUgO通过Source CLI（Command Line Interface，命令行接口）开发/ui18945提供，无私有响应式观察器或伪造响应。

## 核心证据

| 对象 | 已取得的证据 |
| --- | --- |
| [实际状态/请求/时段](result-observation.json) | Task tsk_g00VYhrJxy00qIC54qvM自然completed；pending、unfinished assistant、Task prompt owners均0。全部15请求精确gpt-6.1-sol、stream=true、HTTP（Hypertext Transfer Protocol，超文本传输协议）200/原source reader EOF（End Of File，流结束）。 |
| [刷新前可见B](browser-b-before-refresh.json)、[恢复后可见B](browser-b-restored.json) | 17:35:23.678Z/17:35:35.998Z，同原ses_h0gcSAerl0lMXEbz1cq3可见文字5079→5787字元，第七节继续到第八节。原reader覆盖两时点，消息在17:35:36.958Z完成，晚于恢复观测960毫秒。不是只有Task仍运行或徽章Running。 |
| [最终Message/Part与持久快照摘录](result-observation.json) | 原msg_g0VYhrsOH00hjUPFf8uK、正文prt_g0VYhrto600RdxDOvFYd最终5542字元，原状态Part141字元。真实document /ui请求17:35:23.698Z返回200；刷新没有替换成别的模型回复。 |
| [预检](preflight-ready.json)、[原始创建输入](before-task-create-request.json)、[202结果](before-task-create-response.json) | 分别确认credential usable/catalog projected/actual gpt-6.1-sol stream=true后，才创建有限QA Task，原消息/工具/审批/完成自然可见。 |
| [完整数据核对](data-preservation-observation.json) | 原源90表152721行/字段/身份/时间、bytes/mtime、schema3/实际对象/integrity、完整五键canonical保持；副本三条容量租约随真实执行正常变化，其余原行保持，Provider activity382→391。 |
| [物理/配对结算](physical-terminal-and-pair-cleanup.json)、[私有配对退休](before-authority-retirement.json) | 原83274 exit0、公开shutdown200、native physical/output/request/launcher/精确出生完整；runtime与私有源auth/models共四个副本退休，实际秘密值扫描134文件/66820863字节0命中。原源auth/catalog保持。 |
| [范围与限制](scope-disposition.json) | 实际15/已启动32，条件after未启用、余额退休，模型失败资格与已关闭凭据退休分开。成功实际运行链通过；未制造或宣称已实跑失败分支。 |

时间为UTC（Coordinated Universal Time，协调世界时），截图显示用户当地时间。可见文字长度包含成员标题、来源、状态和正文，不等同纯正文长度；Message/Part字段另列，不用DOM（Document Object Model，文档对象模型）或长度断言验收。

## 十张实图及人工结论

| 图 | 人工复核 |
| --- | --- |
| [01 启动](01-task-start.png) | 当前真实Task和原派发输入正在生成。 |
| [02 原派发审批](02-dispatch-permission.png) | 原模型产生的两成员责任，真实Allow Once；两来源网络请求也分别审批。 |
| [03 A来源与活跃正文](03-a-stream-before-refresh.png) | 原arXiv卡片和正文可见；随后观测工具两次错误拖延，A第一次刷新前已完成，不能用它证明选中A流中刷新。原图已单独打开人工查看。 |
| [04 B流中刷新前](04-b-stream-before-refresh.png) | 原1cq3成员，第七节末句未完成。 |
| [05 B刷新恢复](05-b-restored-stream.png) | 原1cq3，原正文继续第八节，末句仍在输出，原reader尚未EOF。 |
| [06 刷新后来源B](06-b-source-after-refresh.png) | 标题/域名/原ACL入口和自己的读取状态保持。 |
| [07 第八节](07-b-final-eighth-section.png) | 原B完整长文仍可阅读，Task已完成。 |
| [08 完整尾部](08-b-final-tail.png) | LIVE511B_END与真实结尾可见。 |
| [09 隐藏重开](09-b-tail-reopened.png) | 同B尾部和阅读位置保持，原Main成员卡仍在。 |
| [10 切回A](10-a-source-final.png) | pAmh对应原arXiv标题/域名/正文，未串到B来源。 |

这些是实际交互和人工画面复核，没有UI（User Interface，用户界面）自动化测试、DOM/源码文案/组件/快照/像素断言。browser errors为空只作补充。刷新后通过已有入口重选B，没有声称自动保留跨刷新成员选择或位置；也没有同文档真实断流、连续帧、全部Rendering状态或独立Work/Mission资格。

## 工具与边界

当前owned收尾脚本把物理结束与Provider资格分开，精确关闭后不会因为HTTP/model/reader/退出资格失败提前跳过副本退休。实际正常链重新验证了明确收尾/资格/配对退休输出，失败分支只完成控制流审查，不能当作另一次真实失败模型验收。关闭日志sessions=1对应预检Chat的进程wake owner，原预检Session、shutdown取消与wake取消事实在结果文件中，Task范围早已prompt owners0，不按console计数认定Task未完成。

只归档原状态摘录、请求时段和必要运行器。全库dump、原数据库、完整prompt日志、完整目录及凭据不归档。新数据来自已关闭510-after，配对来自用户已授权源；原生20分钟边界、固定请求预算，IAB97及空白能力查询96已关闭。用户18571/真实库未操作，无schema/迁移、清库、版本或发布变化。没有证实需改生产渲染实现，本批生产源码不改。
