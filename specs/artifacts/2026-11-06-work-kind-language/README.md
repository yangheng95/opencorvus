# 工作操作实页证据

- [修改前默认页](01-before-home-zh.png)
- [修改前任务目标范围混用英文](02-before-task-goal-zh.png)
- [修改前多步任务目标范围混用英文](03-before-mission-goal-zh.png)
- [修改前标题栏菜单与工具结果](04-before-mission-menu-zh.png)
- [修改前重命名表单](05-before-rename-dialog-zh.png)
- [修改前定位多步任务及子任务](06-before-located-mission-zh.png)
- [修改前侧栏菜单](07-before-sidebar-menu-zh.png)
- [修改前按Esc仍保持打开的菜单](08-before-escape-still-open.png)
- [修改前阻塞工具英文结果](09-before-blocked-tool-zh.png)
- [中文侧栏菜单和完成结果](10-after-mission-menu-zh.png)
- [首次Esc关闭菜单并返回动作按钮](11-after-mission-escape-focus.png)
- [第二次Esc返回多步任务主行](12-after-mission-row-focus.png)
- [菜单方向键所有权](13-after-menu-arrow-ownership.png)
- [子任务行按键返回](14-after-task-escape-focus.png)
- [对话行菜单按键返回](15-after-chat-escape-focus.png)
- [任务目标范围及中性正文](16-after-task-goal-zh.png)
- [正式定位的当前任务菜单焦点返回](17-after-current-task-menu-focus.png)
- [多步任务目标范围及中性正文](18-after-mission-goal-zh.png)
- [中文重命名表单保留原标题](19-after-rename-dialog-zh.png)
- [英文目标范围及中性正文](20-after-mission-goal-en.png)
- [英文阻塞结果](21-after-blocked-en.png)
- [中文阻塞结果](22-after-blocked-zh.png)
- [展开原始阻塞收据](23-after-original-receipt.png)
- [刷新后同一工具的折叠态](24-after-refresh-receipt-zh.png)
- [刷新后重新展开同一原始收据](25-after-refresh-open-receipt.png)

25张均来自本人后台独立开发`/ui`，逐张人工查看。任务/多步任务目标说明使用既定中文类型并明确下属范围；中英文均保留原对象标题。菜单和重命名表单只打开/取消。10/18/19/22呈现对应中文结果，20/21呈现英文。23/25原始协议字段、身份和总结保留；24是实际折叠态，25才是重开收据。

07/08复现侧栏菜单Esc被行快捷键抢走；11/12/13及17验证原生菜单先返回更多按钮、再返回主行，方向键仍按实际DOM所属处理；15对话行同样通过。14是临时子任务展开，焦点离开父行后正常收起，随后正式定位原Task741完成17的首次/二次Esc复核。立即读取的退出动画节点不当作菜单未关闭；真正焦点和截图在下一次按键前读取。

[运行回执](qualification.json)包含36个原业务检查点、14份原三题事实、两阶段各6份真实完成/阻塞Tool收据及两个原Goal归属、原文件修改和三组旧项目、四份既有Goal交付。原HTTP/SSE、输入/收据/身份/总结/证据、全部原行/内容/源库及129项目119配置299附件和文件/Git保持，schema10/92表。before309201→309203、after309203→309205仅新增各两条控制激活租约事实。

首次before Tool检查误用Task选择字段，已按真实Task id合同修正；首次after检查在已有15秒限制内读超时，成功的首个回执保留，同一实例/原超时限制补完其余八检查，原失败也保留；该首次读延迟根因未隔离，不宣称原整条命令通过。两个原生句柄exit0、公开关闭200、物理/输出/请求结清，四份认证/完整模型目录副本退役，0新模型请求/累计1461，原绝对截止和五分钟收敛保留。

稀有错误、运行中停止、空标题、独立普通Chat体验及子菜单没有单独自然视觉覆盖。不创建/改变原任务/目标，不下载、置顶、归档或操作系统剪贴板。仍看到其他原工具详情如Task created、mission_state commit；下一批继续核对其生产契约，不能据本批称全界面英文已清零。未操作用户窗口、未发布。
