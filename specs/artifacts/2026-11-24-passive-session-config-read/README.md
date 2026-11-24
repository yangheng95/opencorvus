# 已保存会话配置读取的桌面证据

基线真实 `41700/ui/` 加载 `main-DPV2Gw9j.js`，桌面 1280 × 720。

| 实际结果 | 截图 |
| --- | --- |
| 受保护项目的草稿原文可读，输入区报告模型配置读取失败 | [受保护项目](baseline-protected-draft-model-config-alert.jpg) |
| 同一流程在普通项目看到完整原文及模型选择入口 | [可写项目对照](baseline-writable-project-composer-control.jpg) |

[正式接口状态和界面请求的服务错误](baseline-session-config-reads.json)、[两条待办草稿的原始身份](baseline-seeded-drafts.json)。

修订版真实 `41702/ui/` 使用相同前端入口，在同样的桌面尺寸下复核。

| 实际结果 | 截图 |
| --- | --- |
| 受保护项目原文和当前模型选择入口正常显示 | [受保护项目](candidate-protected-draft-model-config-readable.jpg) |
| 原文仍在，已打开模型搜索和 Provider 配置入口 | [模型选择器](candidate-protected-model-picker.jpg) |
| 普通项目的原文和选择入口同时保持可用 | [可写项目对照](candidate-writable-draft-model-config-readable.jpg) |

[正式接口和配置来源](candidate-session-config-reads.json)、[受保护的原文件及属性](candidate-protected-files.json)、[隔离数据库的实际草稿和执行计数](candidate-persistence.json)。
