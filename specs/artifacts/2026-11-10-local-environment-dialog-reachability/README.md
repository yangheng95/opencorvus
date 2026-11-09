# 项目本地环境长表单：桌面证据

[实施前分析与验收](../../records/2026-11/2026-11-10-local-environment-dialog-reachability.md)。所有图片来自本人隔离项目的真实开发页面，并已人工查看。键和值为无敏感验收数据。

| 图 | 旧版 1280×720，main-1In-HNjq.js |
| --- | --- |
| [01](01-before-edit-entry.jpg) | 已配置环境，入口仍显示 Create local environment。 |
| [02](02-before-long-form.jpg) | 十二行打开后在第七行裁切；初始化脚本、保存与取消在裁切外。 |
| [03](03-before-wheel-clipped.jpg) | 面板内真实滚轮向下三页，所见区域保持在顶部。 |
| [04](04-before-keyboard-scroll.jpg) | 从名称按 Shift+Tab，焦点进入不可见 Save；画面没有移动。 |
| [05](05-before-zh-long-form.jpg) | 中文界面仍显示创建，实际裁切相同。 |

[旧版服务启动](before-startup.json) · [旧版服务关停](before-shutdown.json)

| 图 | 首轮候选 39335，main-EG3Jjkdn.js |
| --- | --- |
| [06](06-after-edit-entry.jpg) | 已配置环境改为 Edit，配套编辑图标。 |
| [07](07-after-long-form-top.jpg) | 十二行表单的开头、名称焦点和可见操作栏。 |
| [08](08-after-keyboard-visible-save.jpg) | Shift+Tab 到达可见 Save，蓝色焦点环。 |
| [09](09-after-wheel-bottom.jpg) | 真滚轮到底，第十二行、脚本、操作同时可见。 |
| [10](10-after-long-row-edit.jpg) | 鼠标点击末行，逐字修改后实际保存。 |
| [11](11-after-zh-edit-entry.jpg) | 中文项目编辑入口。 |
| [12](12-after-zh-reopen-bottom.jpg) | 中文重开底部，已保存末行和初始化脚本。 |
| [13](13-after-cancel-focus-return.jpg) | 取消后回到原页面；实际焦点返回环境信息按钮。 |
| [14](14-after-create-entry.jpg) | 第二个隔离项目无配置，显示创建。 |
| [15](15-after-short-create.jpg) | 短表单没有拉伸到视窗上限。 |
| [16](16-after-validation-visible.jpg) | 提示可见，但首轮截图发现旧提示图标独占一行。 |

| 图 | 最终候选 39335，main-CeKFPQ9E.js |
| --- | --- |
| [17](17-final-validation-visible.jpg) | 清空名称并按回车，标准反馈整齐、按钮保持可见。 |
| [18](18-final-corrected-short-form.jpg) | 修正名称后保留焦点及完整短表单；按回车完成创建。 |
| [19](19-final-created-reopened.jpg) | 重开改为编辑，读到刚创建的名称。 |
| [20](20-final-long-bottom.jpg) | 复用实际持久数据，滚到底仍保留第十二行值、脚本和操作。 |
| [21](21-final-long-validation.jpg) | 空变量的校验提示、对应输入框和操作栏同时可见；随后取消。 |

[首轮资源](first-candidate-asset.json) · [首轮启动](first-candidate-startup.json) · [首轮关停](first-candidate-shutdown.json) · [最终资源](after-asset.json) · [最终启动](after-startup.json) · [最终关停](after-shutdown.json) · [实际读取与磁盘比对](after-config-check.json) · [检查器](check-layout-persistence.mjs) · [项目/数据库](isolated-disk-check.json) · [端口/进程](owned-cleanup.json)
