# 已选会话加载状态的桌面证据

基线于 2026-11-22 深夜通过独立开发模式页面取得。

| 基线 | 人工观察 |
| --- | --- |
| [英文 Mission 载入](baseline-en-mission-opening.jpg) | 北区已选中、连接在线且加载条显示，标题为 `New Work`，输入区却要求恢复连接。 |
| [英文 Mission 完成](baseline-en-mission-settled.jpg) | 展示北区草稿标题与实际原请求。 |
| [英文 Work 载入](baseline-en-work-chat-opening.jpg) | 真实切到南区工作对话，连接在线，输入区仍要求恢复。 |
| [英文 Work 完成](baseline-en-work-chat-settled.jpg) | 原南区工作对话正常载入。 |
| [中文 Mission 载入](baseline-zh-mission-opening.jpg) | 北区已选中，标题短暂为「新建 Work」，输入区提示恢复连接。 |
| [中文 Mission 完成](baseline-zh-mission-settled.jpg) | 同一北区原请求正常显示。 |

[实际健康和选中读取回执](baseline-runtime-proof.json) 记录两个项目的明确会话和真实 200。

[首轮候选的延迟读取](interim-en-empty-while-held.jpg) 中，输入区已正确显示加载，正文却在准确记录返回前显示空状态。此图记录随后修正的判断条件。

| 最终候选 | 人工观察 |
| --- | --- |
| [英文 Mission 水合](candidate-en-mission-opening.jpg) | 已选北区，标题是 Mission，输入区显示 `Loading conversation`。 |
| [英文等待确切记录](candidate-en-exact-read-opening.jpg) | 水合条结束，真实 200 尚未交付，正文区域继续等待。 |
| [英文 Mission 完成](candidate-en-mission-settled.jpg) | 放行同一响应后展示北区标题和待启请求。 |
| [英文 Work 水合](candidate-en-work-chat-opening.jpg) | 直接切南区工作对话，输入区显示加载。 |
| [英文 Work 完成](candidate-en-work-chat-settled.jpg) | 南区实际工作对话标题、创建记录及输入可见。 |
| [中文 Mission 水合](candidate-zh-mission-opening.jpg) | 「多步任务」和「正在加载对话」同时显示。 |
| [中文 Mission 完成](candidate-zh-mission-settled.jpg) | 同一北区原请求照常载入。 |
| [中文 Work 水合](candidate-zh-work-chat-opening.jpg) | 正在加载南区通用工作对话。 |
| [中文 Work 完成](candidate-zh-work-chat-settled.jpg) | 同一南区工作对话可读，输入恢复就绪。 |
| [中文新对话](candidate-zh-launcher-ready.jpg) | 新对话仍接受输入，随后清空临时文字。 |

[候选运行回执](candidate-runtime-proof.json) 记录两次真实精确读取的暂留和放行、最终页面入口、健康与原记录读取及三个隔离数据库的只读计数。
