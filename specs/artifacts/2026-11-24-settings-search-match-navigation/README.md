# 设置搜索匹配导航的真实桌面截图

OpenCorvus 隔离开发页，1280×720 的原始桌面截图。

| 基线 | 原始截图 |
| --- | --- |
| 英文 100% 输入 `skills`，通用作为当前页保留 | [英文筛选](baseline-en-settings-filter.jpg) |
| 搜索框下键聚焦首个实际匹配 Chat | [英文首个匹配](baseline-en-first-matching-tab.jpg) |
| Chat 的上键将焦点交给不匹配的 General | [英文上键越界](baseline-en-up-enters-retained-tab.jpg) |
| Work 的 Home 将焦点交给不匹配的 General | [英文 Home 越界](baseline-en-home-enters-retained-tab.jpg) |
| 中文 160% 搜索 `MCP`，下键焦点为对话 | [中文首个匹配](baseline-zh-first-matching-tab.jpg) |
| 对话的上键落到不匹配的通用 | [中文上键越界](baseline-zh-up-enters-retained-tab.jpg) |
| 关于作为当前页保留，End 离开匹配的 MCP 连接 | [中文 End 越界](baseline-zh-end-enters-retained-about.jpg) |

| 候选和最终 | 原始截图 |
| --- | --- |
| 首版候选的焦点在末项，应用导航提示将其完全遮挡 | [候选提示遮挡](candidate-en-hint-covers-focused-match.jpg) |
| 英文向上循环到 Skill Library，静止指针下焦点可见 | [英文末项](final-en-last-match-visible-under-pointer.jpg) |
| 英文向下回到真实首项 Chat | [英文回到首项](final-en-wraps-to-first-match.jpg) |
| 从 Work 按 Home 聚焦 Chat | [英文 Home](final-en-home-to-first-match.jpg) |
| Enter 显式打开 Chat，搜索词仍保留 | [英文激活](final-en-enter-activates-chat.jpg) |
| 只有 Network 匹配时保持在 Network | [英文单一结果](final-en-single-network-match.jpg) |
| 无匹配，从输入按下键仍可继续编辑 | [英文空结果](final-en-empty-matches.jpg) |
| 清除查询后使用普通标签方向键 | [英文无筛选导航](final-en-unfiltered-native-tabs.jpg) |
| 中文 End 保持在 MCP 连接，关于仍显示为保留页 | [中文末项](final-zh-end-keeps-last-match.jpg) |
| 中文向下循环到对话 | [中文循环](final-zh-wraps-across-retained-about.jpg) |
| 新悬停在设置入口，中文结果焦点可见 | [中文提示避让](final-zh-new-rail-hover-keeps-focus-visible.jpg) |
| 中文 Enter 打开 MCP 连接 | [中文激活](final-zh-enter-activates-mcp.jpg) |
| 共用的服务商搜索保留首项方向键边界 | [服务商对照](final-zh-provider-search-keeps-first-boundary.jpg) |
| 退出设置后任务入口再次显示悬停提示 | [工作台提示恢复](final-zh-workspace-hover-hint-resumes.jpg) |
