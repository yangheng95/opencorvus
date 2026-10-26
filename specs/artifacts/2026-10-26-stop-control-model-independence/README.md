# 停止控制与模型独立性

[方案与共享根因](../../records/2026-10/2026-10-26-stop-control-model-independence.md) · [脱敏证据](evidence.json)

本批修复当前模型不可用时停止请求被执行初始化挡住的问题，覆盖六类精确公开路径、Task 独立取消所有权及启动时的原取消/关闭清理。原物理取消、领域权限、取消收据与终态写入仍是事实来源。

| 原始截图 | 人工复核结果 |
| --- | --- |
| [01](01-natural-command-encoding-failure.jpg) | 第一条真实命令因 Python cp1252 编码失败，原退出码1保留；不算停止通过 |
| [02](02-live-command-before-stop.jpg) | 实际 Sol 调用180秒命令，已有连续输出，工具仍在运行 |
| [03](03-actual-command-stopped.jpg) | 人工点击 Stop 后原工具取消，输入框恢复 |
| [04](04-followup-budget-boundary.jpg) | 首次续聊触达隔离请求上限，原诊断保留 |
| [05](05-original-stopped-conversation-resumed.jpg) | 冷重启同一会话后真实流式回复“停止后会话可继续”，原失败历史保持 |

后端修前8项失败，修后13项停止/恢复合同及10项路由合同通过，共50断言。完整Server中间件覆盖Chat/Work/普通Session、Task与Mission；取消跨两个Project、HTTP（Hypertext Transfer Protocol，超文本传输协议）结束后延迟收尾、重复原收据及冷恢复范围有正向状态验证。backend与当前测试扩展类型检查通过；普通Node前端构建0。没有UI（User Interface，用户界面）自动化测试。

623/624分别使用8/4次真实流式gpt-6.1-sol请求，累计179；配对凭据/模型副本在原native/launcher/exec均0、输出/请求结算后退休，来源认证/模型文件保持。两次shutdown200，提前669903/1092742ms关闭；复制的原92表9567/11975行在来源逐行保持，目标原278/345条关键历史只允许同一真实会话的活动时间推进。未打开用户数据库，schema（结构）仍8，无迁移改动。

资格边界：截图为未经修改的1119×720左侧捕获，右端图标不在图内。不可用模型以完整Server后端合同验收；付费页面使用可用模型。实际Bash沿生产物理结算屏障完成，服务物理/输出/请求由原native结算独立观测，单条命令的进程身份未被本次harness（验收运行器）单独保留。projected child只验证当前权限错误合同。冷identity取消物理失败后的在线周期接管、首条Python编码问题的宿主/隔离环境归因尚未完成，不宣称全产品或整个重试机制已完成。
