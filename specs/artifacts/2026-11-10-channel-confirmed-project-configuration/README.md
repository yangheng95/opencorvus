# 通道项目选择与配置等待实页证据

对应[根因、方案与验收](../../records/2026-11/2026-11-10-channel-confirmed-project-configuration.md)。图片来自真实独立开发 `/ui` 的 1280×720 桌面，经手工交互和人工复核。

| 场景 | 原图 | 观察 |
| --- | --- | --- |
| 正常基线 | [首个项目](baseline-en-channel-accepted-address.jpg)、[另一个项目放行后](baseline-zh-channel-address-after-release.jpg) | 两个真实配置各有不同的公网基地址和可读目录。 |
| 基线无项目 | [英文](baseline-en-channel-no-project.jpg)、[中文](baseline-zh-channel-no-project.jpg) | 页面只有静态指示，无法原地选项目。 |
| 基线配置未接受 | [响应扣留](baseline-zh-channel-editable-before-config.jpg)、[响应截断](baseline-zh-channel-config-failed.jpg)、[仍可打开编辑器](baseline-zh-channel-edit-without-config.jpg) | 空地址仍可保存；独立目录成功后可以打开以默认值渲染的编辑器。未填写或提交。 |
| 候选英文原地选择 | [入口](candidate-en-channel-project-entry.jpg)、[键盘打开](candidate-en-channel-working-directory.jpg)、[取消](candidate-en-channel-keyboard-cancel.jpg)、[确认首个项目](candidate-en-channel-confirmed-review.jpg) | 复用目录对话框，取消回入口，确认后在通道页显示实际项目地址和目录。 |
| 真实慢配置 | [等待](candidate-en-channel-config-loading.jpg)、[放行](candidate-en-channel-config-released.jpg) | 等待时两区提示读取；放行后同页出现相邻项目的真实地址、目录和外部访问焦点。 |
| 中文配置失败 | [鼠标取消](candidate-zh-channel-mouse-cancel.jpg)、[配置故障而目录可读](candidate-zh-channel-config-failure-catalog-readable.jpg)、[重试中](candidate-zh-channel-config-retrying.jpg)、[恢复](candidate-zh-channel-config-recovered.jpg) | 目录和文档入口仍可用；配置编辑等待真实重试；完成后外部访问恢复原地址和焦点。 |
| 原编辑器 | [恢复后打开](candidate-zh-channel-editor-after-recovery.jpg)、[返回原行](candidate-zh-channel-editor-return-focus.jpg) | Slack 编辑器能打开并用 Escape 退出，焦点回同一行。没有改输入或启用。 |
| 目录单独失败 | [地址仍可用](candidate-zh-channel-catalog-failure-config-ready.jpg)、[重试中](candidate-zh-channel-catalog-retrying.jpg)、[恢复](candidate-zh-channel-catalog-recovered.jpg) | 当前已确认地址仍在，目录重试后焦点在「可用通道」。 |
| 确认空地址 | [空编辑器](candidate-zh-channel-confirmed-empty-address.jpg) | 真实配置接受后，确实无地址的项目可以编辑。 |

[公开读取与传输回执](receipts.json) 记录实际请求身份、三个隔离项目和响应放行/截断事实。展开诊断的原图包含本机目录，只留本地；未打开外部文档、保存设置、使用凭据或模型。
