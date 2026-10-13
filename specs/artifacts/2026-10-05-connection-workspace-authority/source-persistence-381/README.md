# 381 Sources 持久化证据

依据 [方案与 Recall](../source-persistence-plan-381.md) 单 agent 实施。后台正式 runner 77154 改前4合同1pass/3fail，真实交叠 a,a,b,c,b、双 shared Source，以及错误 Session 配对未拒绝。12053 改后7合同16断言通过。测试包含真实存储和 processor completion，未调用真实权限审批或进程恢复；不冒充这些链路端到端验收。

补充独立项目合同后99146 exit0，共8合同19断言通过；类型85222 exit0，docs:check 345ops/25groups、architecture-index 18文档通过。没有 UI 自动化测试。

| 实际页面 | 人工观察 |
| --- | --- |
| [初始两次读取](after/01-two-real-reads.png) | 两个不同 Message 步骤分别显示一次来源；名称、网址、正文引用完整。 |
| [追加验收的预算失败](after/02-request-budget-failure.png) | 固定12请求上限触发，显示真实 E2E_REQUEST_BUDGET_EXHAUSTED。 |
| [展开已完成工具](after/03-completed-tool-and-source.png) | 实际工具输出可展开，来源在同一结果下可读。 |
| [重载后重新打开](after/04-reopened-source.png) | 已持久化工具、来源及真实错误完整保留。 |
| [点击真实来源](after/05-source-webpage.png) | 来源链接实际打开独立 Example Domain 页面；没有改为手动导航来替代点击证据。 |

以上五图均已实际呈现并人工查看。页面当前语言为英语，产品控件和日期依当前语言；中文输入与模型原文、网页标题保持真实内容。Source UI 本轮没有修改。自己创建的1/2页均已关闭，当前本轮浏览器列表为空。

真实后台检查器读取完整规范数据库，三次实际 webfetch 各有一个对应 Message 的 Source，身份、最终URL和标题正确。初始两次读取属于不同 Message，保留两处来源符合当前归属合同；这不能证明同一消息并发恢复。原 scope 总计12个 gpt-6.1-sol 流式HTTP200/EOF：memory4、chat1、work7；请求预算确已耗尽，追加同一步双调用只完成一次，所请求4次抓取总共完成3次，完整端到端未达成。

shutdown实际exit0；原launcher62148实际exit1（OWNED_PROVIDER_COMPLETION_INVALID），该失败原样保留。Native310253ms、退出0、Host/Native物理收尾/output drain/request cleanup与auth/models配对清理完成，原600000ms/12请求没有扩容或重启续额。[运行复核](runtime-review.json)将 fullQualification 明确记为 false。完整日志、请求审计、监督链和规范数据以脱敏原文gzip归档，不把清理成功替换成验收成功。

尚未完成：真实同一步双调用、真正权限恢复/跨进程写入、Task/Mission终态恢复、Tool成功与display/Source分步提交窗口，以及此前359剪贴板宿主问题。后台合同覆盖实际同步writer和不同恢复completion入口；这些边界不以普通页面成功代替。仅Windows开发服务，未发布或验收Tauri安装包。
