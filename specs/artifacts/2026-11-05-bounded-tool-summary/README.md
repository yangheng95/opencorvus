# 长工具记录数量证据

对应[方案与完整调查](../../records/2026-11/2026-11-05-bounded-tool-summary.md)。全部截图来自本人隐藏的原生开发页面，逐张实际查看，未使用界面自动化、模拟记录或截图断言。中文界面中的原始工具输出、文件字段、模型名称和真实 agent 身份保留原文。

真实 GPT-6.1 Sol 一次提出四个长问题；人工逐项选择并回复，模型在一个批次写入八份行动卡、逐份回读并正常空闲。before 使用19个精确模型流式请求，after/final 均为0。公共完整记录、原始持久事实和文件内容一致；数量投影保持原4KB/1KB预算。

| 截图 | 实际观察 |
| --- | --- |
| [01](01-before-four-real-questions.png) | 修复前，真实四项长问题等待人工回复。 |
| [02](02-before-completed-question-count-lost.png) | 完成后提问数量退化为“已完成”。 |
| [03](03-before-eight-file-count-lost.png) | 八文件批次也只显示“已完成”。 |
| [04](04-before-cold-eight-file-summary.png) | 原记录冷读后数量仍然丢失。 |
| [05](05-after-cold-eight-file-summary-en.png) | 修复后英文冷读显示8 files。 |
| [06](06-after-four-question-summary-en.png) | 英文提问摘要显示4 questions。 |
| [07](07-after-four-question-summary-zh.png) | 中文提问摘要显示4个问题。 |
| [08](08-after-eight-file-summary-zh.png) | 中文批次摘要显示8个文件。 |
| [09](09-after-review-entry-zh.png) | 有原始记录可读时，提示详情待加载并提供审阅入口。 |
| [10](10-after-review-eight-files-zh.png) | 打开审阅加载八条路径和新增56行的实际对比。 |
| [11](11-after-eighth-file-comparison-zh.png) | 筛选第八份，核对AC-08、赵敏、2026-11-17和原说明。 |
| [12](12-after-current-file-app-preview-zh.png) | 阅读磁盘当前文件，使用应用内普通文件面板。 |
| [13](13-after-model-service-menu-zh.png) | 模型菜单已显示“配置模型服务”。 |
| [14](14-after-other-project-review-zh.png) | 切换历史项目，只显示该项目原有的两条路径。 |
| [15](15-after-old-project-two-files-review-zh.png) | 历史项目审阅只展示proposal/final，没有混入八份行动卡。 |
| [16](16-after-expanded-eight-file-tool-zh.png) | 完整工具披露与有界摘要同为8个文件，新增56行。 |
| [17](17-after-expanded-four-question-tool-zh.png) | 提问披露保持4个问题；同时发现CODE标题残留。 |
| [18](18-after-reload-eight-file-summary-zh.png) | 刷新后八文件摘要保持。 |
| [19](19-final-code-caption-and-question-zh.png) | 最终版本通用标题显示“代码”，原始英文输出保持原文。 |
| [20](20-final-eight-file-summary-zh.png) | 最终版本八文件摘要正确。 |
| [21](21-final-review-eight-files-zh.png) | 最终版本再次打开审阅，八份文件与实际新增内容正确。 |

[结构化验收结果](qualification.json)保留各阶段实际模型、预算、请求数、业务/配置/附件保全和物理关闭结果。before按现有共享机制正常复用了两个已过期容量槽，明确记录该例外，原业务内容与源数据库保持；after和final的全部原始行均保持。before保护111项目/101配置/273附件，后续包括新项目的112项目/102配置/275附件全部保全。

30项非界面正向传输测试、155条断言通过；8工作包类型检查、真实Node构建与正式接口/文档检查通过。移动及重复目标由传输测试覆盖；超大正文截取、无说明图片省略、审阅错误重试未在本轮人工流程中触发，不作为完整视觉验收成果。
