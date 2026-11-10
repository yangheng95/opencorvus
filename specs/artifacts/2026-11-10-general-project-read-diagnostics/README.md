# 通用设置项目读取故障实页证据

对应[调查、方案与验收](../../records/2026-11/2026-11-10-general-project-read-diagnostics.md)。原图来自独立真实开发 `/ui`、1280×720 桌面页面的手工操作，已目视复核。

| 场景 | 原图 | 观察 |
| --- | --- | --- |
| 基线两路扩展读取故障 | [英文](baseline-en-raw-extension-issues.jpg)、[中文](baseline-zh-raw-extension-issues.jpg) | 两条同样的英文解析器诊断直接出现在页首；没有用户摘要。 |
| 首版视觉调整 | [英文](draft-en-extension-summary.jpg) | 已分离摘要与诊断，但 `extension information` 没有对应的可见产品名称。 |
| 最终英文 | [Enter 展开](candidate-en-keyboard-diagnostics.jpg)、[Enter 收起](candidate-en-keyboard-collapsed.jpg) | 一条摘要明确技能或 MCP 连接，展开有两条原始诊断，焦点在 Details。 |
| 最终中文 | [摘要](candidate-zh-extension-summary.jpg)、[鼠标展开](candidate-zh-expanded-diagnostics.jpg) | 本地化正文和「详细信息」；两条原始诊断仍保留。 |
| 恢复后的另一项目 | [选择 beta](candidate-zh-switched-beta.jpg)、[健康通用页](candidate-zh-healthy-general.jpg) | 两路实际读取恢复后，通用页重新显示原有的权限、偏好与诊断布局。 |

[公开读取和传输回执](receipts.json) 记录真实请求身份、截断与原样传输、两个隔离项目的状态和数据库计数。验收没有连接服务器、改变权限或使用模型。
