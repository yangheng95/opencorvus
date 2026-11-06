# 折叠选择保存实页

对应[方案](../../records/2026-11/2026-11-06-fold-preference-save.md)。原生开发页面、真实键盘/来源交互和人工截图；不运行UI自动化。

| 原图 | 人工复核内容 |
| --- | --- |
| [01](01-before-tool-expanded-zh.png) | 前态：同一原工具展开，等待旧展开选择落盘。 |
| [02](02-before-tool-reopened-expanded-zh.png) | 前态：118毫秒内实际收起并关页，重开却恢复展开。 |
| [03](03-before-sources-expanded-zh.png) | 前态：原brief.md/bugs.csv来源组展开。 |
| [04](04-before-sources-reopened-expanded-zh.png) | 前态：157毫秒内底部收起并关页，原组重开却展开。 |
| [05](05-after-tool-expanded-en.png) | 后态：英文工具先展开。 |
| [06](06-after-tool-reopened-collapsed-en.png) | 后态：127毫秒内收起关页，英文重开保持收起。 |
| [07](07-after-sources-expanded-zh.png) | 后态：中文来源组展开，底部真实收起动作可用。 |
| [08](08-after-sources-reopened-collapsed-zh.png) | 后态：145毫秒内收起关页，原来源组重开保持收起。 |
| [09](09-after-tool-reopened-expanded-zh.png) | 后态：160毫秒内展开关页，中文重开保持展开，原文件差异31/19可读。 |
| [10](10-after-task-member-navigation-zh.png) | 同一文档从工作切换到已完成Task，执行记录导航正确打开原成员完整会话。 |
| [11](11-after-task-work-return-zh.png) | 返回原工作，工具仍展开、来源仍收起，原修改差异保持。 |
| [12](12-after-file-record-summary-zh.png) | 中文文件摘要明确3条记录，非文本/行数未知及无法汇总原因可见。 |
| [13](13-after-question-answer-count-zh.png) | 中文三题历史明确共3项/已答2项/留空1项，多选加文字仍按一题计。 |

13张原图均本人查看。01—04使用前态main-pRmHMlgL.js，05—13使用后态main-B-xKJnLe.js。前态实际输入后DOM已收起，输入至关页完成118/157毫秒，均小于原400毫秒延迟；相同URL和原来源身份重开却展开。后态收起127/145毫秒、展开160毫秒后立即关页，重开保留所选值。计时是本次真实键盘操作的上界观察，不是新增UI测试。

只有setCardExpanded的同一有界折叠映射改为立即保存，旧定时器及选择时刷新策略删除；50会话/200项、原存储键与值保持。搜索切换Task和Work、原执行记录成员导航实际响应，返回后工具展开/来源收起各自保持。Mission/Goal/Requirements只做代码影响审计，不宣称新视觉覆盖。问题3/2/1和文件3条记录是现有真实资料的阅读回归，没有新提问、文件编辑或模型执行。

19个真实会话42份完整工具Part、HTTP历史及SSE连接快照，以及原提问/文件三会话8份工具记录在前后精确一致。8包类型、两语言2899键、普通Node构建、文档352操作/26组、20份架构文档和CSS9183引用检查通过。没有新增/运行UI自动化、后端、SDK、数据库/迁移、模型工具或调度改动。

两阶段公开关闭200、原生/启动器exit0、物理/输出/请求结清，4份成对认证/完整目录副本退役，56—62本人七个隐藏页关闭。310418→310420→310422只增加各阶段正常控制lease/grant各1；所有原业务行、源库、130项目文件/Git及301物理附件保持，schema10/92表、零文件系统豁免、0新请求、累计1474。未操作用户窗口、18571、进程或真实数据库。[资格记录](qualification.json)保留范围与限制。
