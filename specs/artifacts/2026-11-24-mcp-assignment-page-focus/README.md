# 连接分配分页的实页证据

前态由隔离的真实开发服务 `41570/ui/` 提供，范围是自有项目的两个产品设置。本批所有展示截图本人已目视复核。

| 基线 | 观察 |
| --- | --- |
| [英文对话分配入口](baseline-en-chat-assignment-entry.jpg) | MCP（模型上下文协议）连接页深链接到当前对话的已接受分配区。 |
| [英文对话翻页](baseline-en-chat-page-down-leaves-old-assignment-focused.jpg) | 正文下翻，焦点仍在屏幕外的 01。 |
| [中文通用工作翻页](baseline-zh-work-page-up-leaves-last-assignment-focused.jpg) | 160% 下画面前移，真实焦点仍在后段的 23。 |

[前态焦点坐标](baseline-desktop-focus.json)及[产品正式读取](baseline-assignment-proof.json)。

候选是 `41572/ui/` 的真实桌面及相同隔离配置。

| 候选 | 观察 |
| --- | --- |
| [英文对话说明](candidate-en-chat-assignment-guidance.jpg) | 原深链接到可用连接，增加本地化指引。 |
| [英文对话翻页](candidate-en-chat-page-focus-complete-row.jpg) | 准确 14 的名称、状态与复选框同屏。 |
| [确认精确分配](candidate-en-chat-exact-assignment-confirmed.jpg) | 真实空格保存确认 14，焦点停在原复选框。 |
| [恢复原分配](candidate-en-chat-assignment-restored.jpg) | 同一原生复选框确认恢复未分配。 |
| [中文通用工作说明](candidate-zh-work-assignment-guidance.jpg) | 160% 下原深链接和当前产品说明清楚。 |
| [中文通用工作翻页](candidate-zh-work-page-focus-complete-row.jpg) | 15 的完整行和焦点可辨。 |
| [普通侧栏进入](candidate-zh-work-sidebar-opens-page-start.jpg) | 通用工作从页首打开，范围和技能区呈现。 |

[候选焦点实测](candidate-desktop-focus.json)。正式接口、精确配置及数据检查见[基线](baseline-end-proof.json)、[候选初始](candidate-before-proof.json)、[保存后](candidate-selected-proof.json)和[恢复后](candidate-restored-proof.json)。
