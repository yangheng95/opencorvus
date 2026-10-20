# 当前长文件来源与成员阅读复核

[Recall、调查与范围](../../records/2026-10/2026-10-21-sources-reading-review.md)。本轮**没有修改产品源码**，没有发起模型任务；单开发agent，使用完整真实历史副本、源码CLI（Command Line Interface，命令行界面）开发服务18829与冻结480正式UI（User Interface，用户界面），不启动独立Vite或UI自动化。

从已关闭的自有412 QA（Quality Assurance，质量保证）根只读导出SQLite（Structured Query Language，结构化查询语言的本地数据库实现）完整快照到新481根。用户18571、用户数据库和原QA运行状态均未操作。源数据库原大小/mtime不变；[保留核对](history.json)证明Project149、Session198、Message518、Part1155、Tool request119、Tool outcome119及protocol1407，共3665行的原rowid、身份、完整数据与时间均逐行相同，schema3、integrity_check ok。没有数据库演进。

## 当前实际页面

十张原1280×720截图均实际呈现并人工查看；所读内容和来源由此前真实参与者产生，没有新建成员、合成消息或Source：

| 截图 | 实际观察 |
| --- | --- |
| [01长文件来源](01-before-long-source.png) | 原文件名按单行省略，L2:11与原目录可读。 |
| [02展开与完整提示](02-before-long-tooltip.png) | 原来源组增加第二条L3:15，键盘聚焦提示完整展示文件名、原路径、摘录和来源身份。 |
| [03真实文件定位](03-before-long-source-file.png) | 文件工具页准确定位第3行；主区变窄后文件名与行列号保持独立可读。 |
| [04成员初次打开](04-current-member-open.png) | 成员长历史自然定位最新内容，不将已完成内容当作流中。 |
| [05向上阅读](05-current-member-reading.png) | 人工从侧栏空白边缘滚动长历史，中间正文保持可读。 |
| [06原始Sources](06-current-member-original-source.png) | 最早成员read与README L2–3来源、原解释保持真实关联。 |
| [07成员列表](07-current-member-list.png) | 只显示一个既有成员，最新实际活动为Idle；旧初次执行Completed与其后独立输入不混为一轮。 |
| [08隐藏时调整宽度后返回](08-current-member-resized-return.png) | 列表期间侧栏宽379→441后返回同一成员，原顶部及Sources位置保留。 |
| [09成员来源定位](09-current-member-file.png) | 同一侧栏File页准确选中README第2—3行。 |
| [10返回原成员](10-current-member-file-return.png) | 切回Agents后仍保留原来源段和顶部阅读位置。 |

“before”文件名仅表示当前已有构建的观察，没有新修复后的虚假对照。[真实公开HTTP（Hypertext Transfer Protocol，超文本传输协议）读取](public-sources.json)分别返回200，两个原Session的7/4条Source逐条匹配持久Part的完整来源事实、Session/Message/Part身份、路径、标题、范围与工具绑定。公开投影另提供原orderKey，不将持久data里没有该显示字段误报为来源差异。

## 根因判断与覆盖边界

本次未复现需要修改的长文件来源或已完成成员阅读问题。初次打开时工具观察到首次Markdown处理状态，随后真实截图已正常呈现；这不证明重复Rendering，也不排除未采样的瞬时帧。没有连续帧或新流式资格，不能据此宣称全部闪烁修复。

原历史仅含27条file Source，URL/document均为零；它不能覆盖网页摘录。完整代码检查确认webfetch已经在正文解码后提取HTML标题及Markdown元数据标题，最初只看urlSource构造而作出的“缺少标题”线索已撤回。工具单独持久在request/outcome表，不能从Part表中tool类型为零推断工具丢失。下一批应通过真实网页工具取得来源并检查原始生产链路；不重写旧来源、制造fixture或先改渲染器。

[原native结算](settlement.json)：原18471 join exit0，公开shutdown200，精确Host/Target物理、output drain、request cleanup与launcher均完成；原日志冻结，自有tab43关闭。[实际凭据值扫描](evidence-scan.json)：1243个自有文件按5个实际值检查clear；源凭据只用于比较、原大小/mtime未变，本轮没有复制凭据/模型目录、refresh/exchange或Provider预检。

[正式文档检查](docs-check.log)与[当前架构索引](architecture-check.log)为本轮输出。产品构建仍是480已交付版本；没有产品/测试代码变化，不重复构建或运行UI自动化。原完整配置10秒保存/5秒恢复和未采样Sources/Rendering仍未完成，长期Goal继续。
