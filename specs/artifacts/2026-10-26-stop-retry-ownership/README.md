# 已接受停止的持续收敛

[方案与根因](../../records/2026-10/2026-10-26-stop-retry-ownership.md) · [脱敏证据与新增失败](evidence.json)

本批修复冷Project identity（项目身份）下已接受的Task取消/Mission关闭在第一次失败后失去周期接管者的问题。复用原回调、原驱动、原意图/收据与原物理终态writer（写入器），不新建重试队列；真正执行仍需原runtime（完整运行能力）准入。

| 实图 | 人工复核 |
| --- | --- |
| [01](01-real-task-before-stop.jpg) | 公开API（Application Programming Interface，应用程序接口）创建的真实Task与原模型回复；模型报告无直接bash，未执行Shell |
| [02](02-real-task-cancelled.jpg) | 第一次人工Stop后原Task取消 |
| [03](03-cancelled-task-real-followup.jpg) | 新失败：后续输入重开Task，同一真实assistant产生三条相同text Part（文本片段） |
| [04](04-repeated-reply-stopped.jpg) | 第二次人工Stop保留新执行轮次自己的取消终态 |

后端修前13通过、2失败；修后及聚焦回归共75项139断言通过。覆盖真实Prompt（提示执行）收尾超时后的自动重试、原Mission请求中断后自动关闭、缓存身份与执行模型错误的区分、两Project范围、正常调度与关闭。原6文件扩大回归有一个旧观察点失败，修正为原driver（驱动）的实际扫描轮次后重跑通过；未把原整体exit1写成通过。当前源码/本轮触及测试扩展类型检查0，无UI（User Interface，用户界面）自动化测试。

626使用10次真实流式gpt-6.1-sol，累计189；原Task实际两轮取消均保留原收据。Shell未运行，不宣称长命令停止；周期故障接管由后端真实领域checker（检查器）验收，不冒充付费页面故障注入。原CLI（Command Line Interface，命令行界面）/ui复用未修改的普通Node冻结构建main-Dm1PjLZY.js，截图为未经修改的1119×720左侧捕获，右端图标不在图内。

原exec/native/launcher均0、shutdown200、物理/输出/请求结清，提前999599ms关闭后退休auth及完整models副本，来源认证/模型保持。原来源92表12926行、目标370条关键历史保留，无用户数据库或服务操作，schema（结构）仍8。

新增真实失败仍未解决：后续输入产生epoch（执行轮次）2；同一assistant的三条原text Part后出现exhausted(semantic_limit)。不能用显示去重掩盖，也不能宣称取消后终态续聊通过。当前发送准入、Prompt与决策/continuation（继续执行）的共享根因继续调查；中文Python环境及完整projected child物理停止也未验收。持续Goal（目标）保持活动。
