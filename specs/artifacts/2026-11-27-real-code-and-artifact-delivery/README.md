# 实际代码与产物交付证据

本人通过独立开发服务的真实桌面页面发起销售汇总编程任务，正常产品创建 Mission/Task，完成代码、9 项测试和四个原文件交付；本人另行执行命令、读取不可变发布资源并实际点击四次下载，逐字节核对通过。同时修复真实交接消息和控制唤醒都显示为“调度上下文”的界面问题。根因、影响与范围见[规格](../../records/2026-11/2026-11-27-real-code-and-artifact-delivery.md)。

- [实际 Task 完成决定、终态事件及最终回复](task-delivery-facts.json)、[Mission 生命周期事件](mission-events.json)、[真实消息作者与原 Part 类型](message-origins.json)。测试项目自身提交 `db01a7d` 属于隔离示例，不是 OpenCorvus 本批提交。
- [独立执行、统计值、四文件发布读取及真实浏览器下载核对](run1-delivery-check.json)、[新界面候选服务的四文件读取](run2-delivery-check.json)。示例最终结果：[JSON](delivered-summary.json)、[中文报告](delivered-销售报告.md)。原输入 181 字节与初始 Git 提交中的输入完全相同。
- [模型请求汇总](model-request-summary.json)、[任务运行 75 次原审计](run1-model-request-audit.json)、[候选查看服务 2 次原审计](run2-model-request-audit.json)。77 次均精确请求 GPT-6.1 Sol 并流式、HTTP 200；76 次读取正常结束，1 次连接重置，后续同一条回复重试读取正常结束，详见[原错误及恢复事实](stream-error-recovery-facts.json)。不能称全部流读取成功。
- [任务服务收据](run1-runtime.json)、[候选服务收据](run2-runtime.json)：原进程句柄均结清、退出码 0、复制凭据与模型目录退役。候选服务复用同一已完成 Task 及原始资源，仅重新构建界面并检查显示/读取，不冒充第二次完整编程任务。
- [界面类型检查](overlay-types.log)、[界面构建原输出](overlay-build.log)；构建有第三方指令和大块体积提示，退出码为 0。

以下均为本人实际查看的桌面截图，没有自动截图断言或像素比较：

- [任务执行进展](run1-task-progress.png)、[修复前两种消息同名](run1-request-and-wake-same-label.png)、[原文件清单与中文报告预览](run1-published-report-preview.png)。
- [修复后中文消息展开](run2-distinct-contexts-zh.png)、[成员输入预览及键盘折叠](run2-input-preview-zh.png)、[成员完整会话](run2-member-context-zh.png)、[英文当前语言名称](run2-contexts-en.png)。
