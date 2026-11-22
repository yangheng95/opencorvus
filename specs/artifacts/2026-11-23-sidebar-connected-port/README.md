# 侧栏当前连接端口的桌面验收

2026-11-23，隔离开发模式服务与桌面浏览器实页截图。

| 基线 | 人工观察 |
| --- | --- |
| [最后一个侧栏操作持焦](baseline-en-last-sidebar-focus.jpg) | 键盘聚焦项目的 Start work，页脚只显示 Online。 |
| [下一次 Tab](baseline-en-after-sidebar-tab.jpg) | 焦点已移到分隔条，工作页的在线状态依旧没有端口。 |
| [英文网络设置](baseline-en-network-endpoint.jpg) | 已应用端点实际为 `http://127.0.0.1:40386`。 |
| [简体中文侧栏](baseline-zh-status.jpg) | 约定位置只显示「在线」。 |

[基线运行回执](baseline-runtime.json) 记录实际端点与健康读。

| 候选 | 人工观察 |
| --- | --- |
| [英文在线](candidate-en-status.jpg) | 工作页直接可读 `Online · Port 40388`。 |
| [英文键盘顺序](candidate-en-tab-order.jpg) | 原分隔条获得焦点，端口正文保持可见。 |
| [英文最窄侧栏](candidate-en-narrow-status.jpg) | 208 像素时完整显示端口。 |
| [未保存的地址](candidate-en-unsaved-endpoint.jpg) | 编辑器内暂为 `40398`。 |
| [返回工作页](candidate-en-applied-after-draft.jpg) | 侧栏仍显示实际应用的 `40388`。 |
| [重新进入网络设置](candidate-en-network-reopened.jpg) | 编辑器从已应用地址重新读取。 |
| [中文最窄侧栏](candidate-zh-narrow-status.jpg) | 「在线 · 端口 40388」完整可读。 |
| [真实离线](candidate-zh-offline.jpg) | 本人候选服务关闭后，页脚显示离线，同时现有诊断反馈可以看见。 |

[候选运行回执](candidate-runtime-proof.json) 保留候选入口、实际最窄宽度、正常关闭情况和隔离数据库只读计数。
