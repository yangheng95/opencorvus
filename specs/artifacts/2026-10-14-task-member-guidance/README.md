# Task成员指导实页证据

[Recall、共享终态审计与实施方案](../../records/2026-10/2026-10-14-task-member-guidance.md)。本轮修复指导表单的终态说明、中英文文案、输入无障碍名称及按钮定位；协调请求、Task生命周期和真实消息协议保持原契约。

| 原始实页 | 观察 |
| --- | --- |
| [01 Task启动](01-task-open.jpg)、[02 成员](02-task-member.jpg)、[03 来源](03-task-source-ready.jpg) | 正式CLI接受Task，模型实际派遣base-tester读取README第2—3行，来源和结论自然产生。 |
| [04 重开](04-task-reopened.jpg)、[05 卡片底部](05-member-bottom.jpg) | Task自然完成，成员底部指导入口可用；重开属于完成态。 |
| [06 提交中](06-guidance-receipt.jpg)、[07 接受](07-guidance-accepted-terminal.jpg) | 新1800字指导被接受，但终态合同只允许确认收到；没有把接受当成员续跑。 |
| [08 初次说明位置](08-after-help-en.jpg) | 帮助在输入框下方、落出视口，保留这个不合格布局。 |
| [09 最终说明](09-final-help-en.jpg)、[10 填写](10-final-filled-en.jpg) | 说明前置，填写时完整可见，发送按钮相对输入框居中。 |
| [11 中文](11-final-help-zh.jpg)、[12 英文回执](12-final-receipt-en.jpg) | 同一确认请求和表单在两种语言间保留；说明、名称、发送、回执正确，按钮位置稳定。 |

12张都是实际`localhost:18529/ui/`、`18531/ui/`和`18533/ui/`原JPEG，人工逐张查看，没有UI自动化或截图断言。三个自有页面30/31/32均关闭；上轮错误页27已由工具回收，当前轮开始列表为空。

[持久事实检查](persisted-check.json)覆盖真正CLI Task tsk_g00VXzaV3900TZX3V9DQ、epoch1、3个实际Session、原read来源绑定和完整协调链。首次Task自然completed，原Task monitor记录17次模型请求、实际prompt owners结算；随后指导art_d8a7b88ce41c4c8fa127的原response明确只确认收到、尚未执行新要求，action/outcome引用同一terminal event。第二条art_fcba9ba90aca406cad3f明确只求确认，实际同样正常确认。Task创建不是手造数据库或消息。

[运行摘要](execution-summary.json)及`live/`、`after/`、`after02/`原件：分别18/2/3条、共23条gpt-6.1-sol真实流，均200/settled/eof；每轮公开shutdown200，原45947/c31763、75595/a603fb、28989/486b36全部exit0；原进程、output/request和复制auth/models配对退休完成。凭据内容不归档。

`facts/`保存四次只读真实Task数据、CLI原请求/接受与绑定；`execution/`保存启动、创建、shutdown、checker与构建/原日志。首次归档把活动stdout采为空，其不完整原件保留；修正后在生产命令退出后捕获完整输出，不把空日志当通过证据。原typecheck61009、构建7909/84230/80496均0。`previous-412/`承接50cf35a83正常push原件和精确远端身份。

未达成：1800字指导没有触发成员续跑，这是终态协调的当前合同；活动Task协调执行、真正流中关开、不同成员切换未在本轮通过。首次快速Open动作未取得可见Dock、菜单一次动态AX ID失效也保留。主区旧Orchestrator段时长的聚合意义待后续结合Message事实调查。本轮不宣称原Rendering问题已全面解决。
