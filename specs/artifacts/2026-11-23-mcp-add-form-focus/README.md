# 项目 MCP 新增表单焦点的桌面证据

真实 OpenCorvus 开发模式 `/ui/`，桌面视口 1280×720。全部文本与目录来自自有隔离项目，截图由本人逐张复核。

| 基线实拍 | 实际画面和焦点 |
| --- | --- |
| [01 键盘展开](01-baseline-keyboard-open-trigger-focus.jpg) | 表单显示，焦点仍在顶部 Add MCP。 |
| [02 展开后第一次 Tab](02-baseline-tab-delete-all-focus.jpg) | 焦点停在已禁用的 Delete All。 |
| [03 键盘取消](03-baseline-cancel-web-area-focus.jpg) | 表单已收起，网页根部有焦点。 |
| [04 再次展开](04-baseline-reopen-retains-local-draft.jpg) | 原名称草稿保留，顶部按钮仍聚焦。 |
| [05 原字段校验](05-baseline-invalid-address-field.jpg) | 无协议的远程地址有英文错误及地址框焦点。 |

| 候选实拍 | 实际画面和焦点 |
| --- | --- |
| [06 英文键盘展开](06-candidate-en-keyboard-open-name-focus.jpg) | 100% 下从标题的 Add MCP 按 Enter 即聚焦 Name。 |
| [07 英文地址校验](07-candidate-en-invalid-address-field.jpg) | 保留输入，原地址框和错误处均可见。 |
| [08 英文键盘取消](08-candidate-en-keyboard-cancel-trigger-focus.jpg) | 折叠且焦点恢复到原按钮。 |
| [09 英文再次展开](09-candidate-en-keyboard-reopen-original-draft.jpg) | 回到原名称输入，地址和错误仍在。 |
| [10 中文键盘取消](10-candidate-zh-160-keyboard-cancel-visible-trigger.jpg) | 160%、710 像素设置栏，折叠后按钮完整可见并聚焦。 |
| [11 中文键盘再展开](11-candidate-zh-160-keyboard-reopen-visible-name.jpg) | 中文名称及草稿完整可见，名称聚焦。 |
| [12 中文地址校验](12-candidate-zh-160-invalid-address-visible.jpg) | 远程地址及中文错误在窄栏内可见，地址聚焦。 |
| [13 中文本地类型](13-candidate-zh-160-local-type-draft.jpg) | 本地类型、命令及参数使用原内容。 |
| [14 中文鼠标取消](14-candidate-zh-160-pointer-cancel-visible-trigger.jpg) | 从滚动区退出后可见顶部按钮，辅助技术确认焦点。 |
| [15 中文鼠标再展开](15-candidate-zh-160-pointer-reopen-local-draft.jpg) | 同项目重新展开恢复本地类型及名称，名称聚焦。 |
| [16 中文标题折叠](16-candidate-zh-160-pointer-collapse-trigger.jpg) | 点击标题按钮折叠，辅助技术确认焦点在原按钮。 |
| [17 第二项目](17-candidate-zh-160-second-project-fresh-draft.jpg) | 属于 `second-project` 的空名称输入聚焦，使用默认远程类型。 |
