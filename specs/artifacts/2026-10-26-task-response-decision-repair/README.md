# Task 回复与决定回执

[根因与验收](../../records/2026-10/2026-10-26-task-response-decision-repair.md) · [原事实脱敏汇总](evidence.json)

任务停止后的原始追问曾在同一assistant（助手消息）写出三条相同文本，最终耗尽决定预算。根因是首轮与修复提示没有清楚区分可见答复和必要控制回执，核心提示另含错误的complete动作名。本批修正唯一现行提示，保留原工具权限、消息、决定协议与有限预算。

| 原截图 | 实际人工复核 |
| --- | --- |
| [01](01-original-task-history.jpg) | 已取消Task（任务）的三条原失败回复完整保留 |
| [02](02-single-reply-completed.jpg) | 同一Task、完全相同新输入只回复一次，原manage_task complete_task完成；上方旧三条仍可见 |
| [03](03-control-receipt.jpg) | 展开实际工具回执，明确确认语不等于命令执行或物理停止证明 |

628使用真实开发CLI（Command Line Interface，命令行界面）的/ui、原普通Node冻结前端main-Dm1PjLZY.js及当前后端；没有UI（User Interface，用户界面）自动化测试。三张原图均为未经修改的1119×720左侧捕获，视口1280×720，右端未包含在图中。实际Task epoch（执行轮次）3完成，原控制入口最终terminal_inapplicable，真实工具outcome（结果）completed，原三条失败历史保持。

46项后端合同270断言及完整后端类型检查通过。628配对认证/完整模型目录预检后共5次gpt-6.1-sol流式请求，全部200/EOF settled，累计194；首轮即提交有效决定，本次没有触发修复提示。tool_choice（工具选择模式）保持auto，原Dynamic的12工具保持。该用例通过不代表统计可靠性、零工具或长命令停止通过。

public shutdown200，原exec52416/native/launcher（原生宿主/启动器）均0，物理、输出、请求全部结清，提前958433ms关闭后退休认证/模型副本。来源92表15292行保持；目标450条原关键事实除两个明确Session活动时间外保持，schema（结构）仍8，8组原附件复制，未操作用户数据库/18571服务/窗口。中文Python环境及投影子任务物理停止仍为后续独立验收项。
