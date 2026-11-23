# 对话能力技能筛选的桌面证据

真实隔离开发入口 `40588/ui/`、`40590/ui/` 的基线与候选画面。

| 画面 | 观察 |
| --- | --- |
| [01 Chat 原可用技能](01-baseline-en-chat-installed-list-without-search.jpg) | 当前项目有效，能力页直接从第一项显示目录。 |
| [02 左侧搜索范围](02-baseline-en-settings-query-only-searches-pages.jpg) | 查询 `cedar handoff` 只检查设置页名称。 |
| [03 实际滚动寻找](03-baseline-en-chat-scroll-to-two-descriptions.jpg) | 向下滚动后才看到两项匹配说明及其现复选框。 |
| [04 Work 原可用技能](04-baseline-en-work-full-installed-list.jpg) | Work 使用同一列表布局，并显示现有默认分配。 |
| [05 首轮候选截断](05-first-candidate-en-placeholder-clipped.jpg) | 英文提示末尾因默认宽度被截断，随后调整文案。 |
| [06 英文完整占位](06-candidate-en-fitted-search-label.jpg) | 同一默认宽度完整显示搜索提示。 |
| [07 两条说明匹配](07-candidate-en-shared-description-two-matches.jpg) | `cedar handoff` 同时显示项目文档和软件包技能。 |
| [08 精确保存](08-candidate-en-unique-result-assigned-with-focus.jpg) | 组合词定位唯一行并正式分配，焦点、展开说明和查询保持。 |
| [09 精确撤销](09-candidate-en-removes-assignment-in-same-result.jpg) | 撤销同一隔离分配，仍显示同一行。 |
| [10 英文空状态](10-candidate-en-terms-must-match-same-skill.jpg) | 分属两项的词组合起来没有匹配项。 |
| [11 Work 独立范围](11-candidate-en-work-opens-with-own-inventory.jpg) | 从 Chat 切换后读到 Work 的全量技能和原分配。 |
| [12 中文按名称](12-candidate-zh-work-name-finds-confirmed-assignment.jpg) | 找到 `work-artifacts` 并显示其原已分配值。 |
| [13 中文按说明](13-candidate-zh-work-description-keeps-author-text.jpg) | 搜到作者原文中的 `handbook cedar` 组合词。 |
| [14 中文空状态](14-candidate-zh-empty-results.jpg) | 能力页显示当前查询没有匹配项。 |
| [15 中文清空](15-candidate-zh-clear-restores-installed-inventory.jpg) | 恢复全量列表，并保留输入焦点。 |
