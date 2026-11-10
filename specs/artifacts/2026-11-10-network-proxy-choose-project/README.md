# 网络代理项目选择实页证据

对应[根因、方案与验收](../../records/2026-11/2026-11-10-network-proxy-choose-project.md)。原图取自真实独立开发 `/ui`、1280×720 桌面，手工交互后已目视复核。

| 场景 | 原图 | 观察 |
| --- | --- | --- |
| 基线无项目 | [英文](baseline-en-proxy-instruction-only.jpg)、[中文](baseline-zh-proxy-instruction-only.jpg) | 代理只有静态说明，独立的客户端连接仍可用。 |
| 基线绕行 | [工作台对话框](baseline-zh-workspace-picker.jpg)、[重新进设置](baseline-zh-settings-reopened-general.jpg) | 现有选择器可打开项目；重新进入设置返回通用，需再次选择网络。 |
| 首版慢读取 | [配置未到](draft-en-proxy-before-config.jpg)、[底部操作](draft-en-proxy-actions-before-config.jpg) | 项目已发布，但配置响应扣留期间表单为空且 Test/Save 可用。未按下。 |
| 最终英文键盘 | [打开](final-en-network-keyboard-picker.jpg)、[取消](final-en-network-keyboard-cancel.jpg)、[确认首个项目](final-en-network-proxy-review.jpg) | 使用原对话框，取消回入口，确认后留在 Network，显示真实 `31921` 和项目范围焦点。 |
| 最终慢读取 | [等待](final-en-network-held-config.jpg)、[放行](final-en-network-released-config.jpg) | 延迟期间显示项目和加载状态；原响应放行后显示 `31922`，仍在网络页。 |
| 最终中文与恢复 | [鼠标取消](final-zh-network-mouse-cancel.jpg)、[读取失败](final-zh-network-config-error.jpg)、[重试中](final-zh-network-config-retrying.jpg)、[恢复](final-zh-network-retry-recovered.jpg) | 中文入口仍可取消；真实解析失败可展开诊断，Enter 重试后恢复同一项目的 `31922`，焦点回范围控件。 |
| 共用入口与确认空配置 | [MCP 取消](final-zh-mcp-project-cancel.jpg)、[选中 beta](final-zh-mcp-beta.jpg)、[已确认空代理](final-zh-network-confirmed-empty-proxy.jpg) | MCP 原按钮、焦点及实际禁用状态保持；已成功读取但没有代理的项目照常呈现空编辑器。 |

[公开读取及传输回执](receipts.json) 包含真实请求身份、完整路径匹配结果、真实配置、扣留/截断/原样放行，以及隔离库计数。展开诊断含本机账户目录，已人工查看，原图只保留在本机验收目录。没有触发连接保存、代理保存/删除/测试、MCP 连接或模型。
