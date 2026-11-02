# 持续目标开始工作验收

使用隔离原生开发页面38667/38668、真实交互和截图人工复核。[规格与调查](../../records/2026-11/2026-11-03-goal-start-context.md)记录修改前因果分析和首次资源边界，[完整验收记录](qualification.json)记录数据、模型请求和原生结清，[实际交付文件](delivered-summary.md)由本次真实模型生成。

首页确认表单现在直接显示项目与模型：沿既有项目名称事实和精确composerModel选择，未选择模型时明确继承配置，未选择目录时说明开始创建项目。没有另一份配置或启动路径；已有会话保留原作用范围。

| 截图 | 人工查看结果 |
| --- | --- |
| [01](01-before-home-en.jpg)、[02](02-before-form-en.jpg)、[03](03-before-selected-model-en.jpg) | 修改前Home入口已正常；确认表单只说所选模型，没有具体模型/项目，继承时同样如此。 |
| [04](04-after-inherited-en.jpg) | 英文实际项目与继承配置。 |
| [05](05-after-global-new-project-en.jpg) | 英文全局入口明确开始创建新项目。 |
| [06](06-after-project-name-en.jpg) | 本轮新QA项目正常重命名后，表单显示同一个完整自定义名称。 |
| [07](07-after-selected-model-en.jpg) | 关闭、精确选择Sol并重开，模型身份与原稿均正确。 |
| [08](08-after-selected-model-zh.jpg)、[09](09-before-real-start-zh.jpg) | 中文实际项目/模型、草稿与帮助往返；原2自动轮次确认后才开始真实执行。 |
| [10](10-real-running-zh.jpg) | 真实控制器、读取原文件与流式工作；运行中间态没有冒充终态。 |
| [11](11-real-delivery-zh.jpg)、[12](12-real-file-preview-zh.jpg) | 真实完成回复和实际交付预览，4条记录/3条未完成、责任分布和排序可见。 |
| [13](13-real-completed-details-zh.jpg) | 完成详情保留原证据、345102用量与1/2轮次。 |
| [14](14-existing-conversation-form-zh.jpg) | 既有会话创建表单仍显示原会话归属；只打开后关闭。 |
| [15](15-after-global-new-project-zh.jpg) | 中文新项目提示及当前精确模型，**并非**继承配置截图。 |
| [16](16-reopened-completed-zh.jpg) | 重新进入同一已完成会话，状态与交付保持。 |

真实Goal complete、Session idle；10个精确gpt-6.1-sol/streaming请求均HTTP200及原reader EOF，九个工具结果completed。三文件回读逐行与实际字节一致；4条表格记录与原CSV排序结果完全相等，源文件保持。只新增本轮一个根会话，原8 Task保持。纯UI改动没有新增或运行UI自动化测试；业务检查读取真实文件、工具输入输出和持久事实，不是模拟或视觉测试。

两实例公开关闭200、原句柄0、物理/输出/请求结清，四配对副本退休；首次总上限16实际使用10，累计1319，未用6退休。结构10/92表，所有原业务行、源库、101/102原项目文件与Git、263附件保持。完整保留四检查点15 Mission、4 Task全状态与根会话、24 Mailbox及查询和12次原文件合同读取。没有操作用户现用窗口、真实数据库或发布。
