# MCP 工作区选择的桌面证据

对应 [根因与验收](../../records/2026-11/2026-11-10-mcp-choose-project-first.md)。原图来自真实开发模式 `/ui` 的 1280×720 桌面页面，使用隔离项目手工操作并逐张查看。

| 场景 | 截图 | 观察 |
| --- | --- | --- |
| 基线 | [英文无项目](baseline-en-unscoped-warning-with-controls.jpg)、[英文无项目新增](baseline-en-unscoped-add-form.jpg)、[中文无项目](baseline-zh-unscoped-warning-with-controls.jpg) | 无项目仍可打开真实表单，提示没有选择目录动作。 |
| 基线的可用路径 | [侧栏标准目录选择器](baseline-zh-standard-folder-dialog.jpg) | 必须先离开设置，从应用侧栏进入同一工作目录流程。 |
| 首版视觉调整 | [重复提示](draft-en-repetitive-instructions.jpg) | 按钮和说明重复说选目录；最终让说明交代每项目独立管理。 |
| 最终英文 | [无项目](candidate-en-choose-project.jpg)、[目录选择](candidate-en-folder-dialog.jpg)、[取消后的焦点](candidate-en-cancel-focus.jpg) | 回车进入已存在的目录选择器，Escape 回到原按钮。 |
| 最终中文 | [无项目](candidate-zh-choose-project.jpg)、[目录选择](candidate-zh-folder-dialog.jpg)、[取消后](candidate-zh-cancel-focus.jpg) | 点击打开和取消，设置页保留；焦点回到同一入口。 |
| 确认目录 | [英文 beta](candidate-en-beta-selected-in-settings.jpg)、[中文 alpha](candidate-zh-alpha-selected-in-settings.jpg) | 同一个设置页转为实际项目，焦点落在项目控件，实际连接保持禁用。 |
| 选项目后的功能 | [beta 新增表单](candidate-en-beta-add-form.jpg)、[alpha 连接分配区](candidate-zh-alpha-chat-assignments.jpg) | 两个真实入口可用，未提交新增、未改分配。 |

[实际公开读回](receipts.json) 只含隔离项目标识、状态、准确目录匹配和请求身份。输入真实隔离路径后的原图如果含本机账户目录，只留在本机。本证据不含 MCP 凭据、应用用户数据或原始服务响应内容。
