# Goal 执行完成后的及时读取

[Recall、根因与实施前方案](../../records/2026-10/2026-10-21-goal-settlement-refresh.md)。单开发agent，使用全新自有480数据根与18825/18827源码CLI（Command Line Interface，命令行界面）开发页面。用户18571、用户数据库、旧历史QA（Quality Assurance，质量保证）数据和479数据未操作；没有UI（User Interface，用户界面）自动化。

## 实际对照

原控件只依赖五秒周期、focus/visibility或自己的mutation读取Goal。修复将原执行流的连接、真实assistant完成、物理terminal和Task已有Goal决策接到同一个canonical读取；精确区分连接authority、Project、Chat/Task/Mission与SideChat身份。通知只使读取过期，不复制Goal状态或解析模型工具文本；保留没有执行通知的外部事实周期观察。

| 原真实页面 | Goal | 首次读取开始延迟 | 真实累计令牌 | 原1000ms指标 |
| --- | --- | ---: | ---: | --- |
| 冻结479正式UI | pev_g0VYblJtM00Eu4wNZGMR | 2716ms | 33,642 | 失败 |
| 本次正式构建UI | pev_g0VYbmy5x00CTgKVZpgy | 29ms | 33,643 | 通过 |

[实际时间、原请求和协议/用量](timing-and-execution.json)来自仅只读SQLite（Structured Query Language，结构化查询语言的本地数据库实现）、原服务日志和Provider audit的被动观察器；确认后至资格完成没有浏览器动作或检查器Goal请求。测量是真实assistant完成落盘到实际页面HTTP（Hypertext Transfer Protocol，超文本传输协议）GET开始，**不是画面帧延迟**。两个原读取响应均200，两个Goal各完成一轮。[最终公开投影与原消息](final-projections.json)核对真实complete工具输入、原Goal身份、模型openai/gpt-6.1-sol以及Goal累计等于原用量关联之和。canonical配置始终{}；模型通过实页选择。最终自有根3 Project/5 Session/schema3，包含两次独立预检、两个Goal和一个独立SideChat；没有数据库结构变化。

## 人工页面与功能检查

九张原始1280×720页面截图均实际呈现并人工复核：[01对照表单](01-before-goal-form.png)、[02对照最终完成](02-before-complete.png)、[03修复表单](03-after-goal-form.png)、[04修复完成](04-after-complete.png)、[05独立侧边会话](05-after-side-chat-owner.png)、[06侧边目标表单](06-after-side-goal-form.png)、[07切换回原目标](07-after-switched-owner.png)、[08中文完成状态](08-after-zh-complete.png)、[09中文完成清晰画面](09-after-zh-complete-clean.png)。图02是周期读取收敛后的实际画面，不声称捕获过延迟帧；08保留真实设置悬停提示，09为移动指针后重新截图，无图片编辑。

SideChat显示自己的空Goal与“适用于此Chat”表单，取消后关闭；主会话完成Goal保留。实页切换两个Goal，分别显示33642/33643累计；真实公开读取核对SideChat sourceSession归属。Task/Mission仅验证服务合同，没有其Sol网页端到端；SideChat未发送模型请求。

[正式构建](build.log)53.72秒并通过renderer public surface检查，[overlay类型检查](ui-typecheck.log)、[双语2523键](i18n.log)通过。[四文件初次聚焦检查](focused-tests.log)25例/55断言，新增Project隔离正向合同后[当前刷新合同](final-refresh-tests.log)4例/5断言通过；与其余三文件22例/51断言合计最终**26个独立测试/56断言**。测试仅服务/transport正向契约，mock不冒充网页或真实Provider验收。没有运行UI自动化。

## 结算与限制

[原服务结算](settlement.json)：90003/30487原句柄均join exit0、公开shutdown200，精确Host/Target物理、output drain、request cleanup及launcher完成；原观察器25408/92575也join exit0。固定整批8次实际gpt-6.1-sol请求（每scope两次预检、两次Goal，包含所有helper）全部stream200、source reader EOF（End Of File，流结束），未扩额；先结算before再分配after。各完整运行auth/models对均在原scope结算和4/4 EOF后退休，原日志及时冻结；自有tab41/42关闭。

[实际凭据值检查与退休](credential-retirement.json)：1431个自有文件、5个实际凭据值检查clear，随后精确退休private auth/models完整对；完整目录退休前与源字节一致，源凭据大小/修改时间不变，无refresh/exchange或源写入。

[文档检查](docs-check.log)与[当前架构索引](architecture-check.log)为正式检查输出；归档日志只移除行尾空白，原私有日志保留。本次不宣称所有跨进程外部Goal事实实时更新，也不宣称Sources/Rendering所有历史场景通过。原完整配置10秒保存/5秒恢复仍未达标，长期Goal继续。
