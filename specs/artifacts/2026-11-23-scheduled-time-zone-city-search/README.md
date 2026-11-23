# 定时任务时区搜索的桌面证据

Windows 桌面独立标签。基线开发服务 `40572`，构建 `main--fSyB91_.js`。

| 截图 | 人工核对 |
| --- | --- |
| [01](01-baseline-en-clock-selected-before-search.jpg) | 正常键盘操作可以在时钟两列选 11 PM 与 59 分钟，尚未应用，主字段仍为 9:00 AM。 |
| [02](02-baseline-en-city-spaces-no-result.jpg) | 11:59 PM 已实际应用；输入普通城市名 New York 无可见选项或空结果说明。 |
| [03](03-baseline-en-identifier-matches.jpg) | 同一时区框输入 New_York 可得到唯一准确的正式标识。 |
| [04](04-baseline-zh-region-city-no-result.jpg) | 简中表单用地区和城市词 `america new york` 仍没有可操作结果。 |

最后候选开发服务 `40574`，构建 `main-4zW2vX8j.js`。

| 截图 | 人工核对 |
| --- | --- |
| [05](05-candidate-en-natural-city-match.jpg) | 输入 New York 直接显示正式 `America/New_York`。 |
| [06](06-candidate-en-empty-search-explains-result.jpg) | 无匹配时有英文说明，搜索框保持可编辑。 |
| [07](07-candidate-en-exact-identity-selected.jpg) | 技术标识可搜索并用键盘明确选择。 |
| [08](08-candidate-en-escape-retains-confirmed-zone.jpg) | 放弃另一次搜索回到已明确选择的纽约时区和原焦点。 |
| [09](09-candidate-zh-empty-search.jpg) | 简中空匹配状态说明清晰可见。 |
| [10](10-candidate-zh-mixed-words-match-zone.jpg) | 改正为不同大小写和顺序的词后返回真实选项。 |
| [11](11-candidate-zh-future-schedule-ready.jpg) | 生效前核对 2099 年 11 月 23 日 23:59 和确切时区。 |
| [12](12-candidate-zh-saved-schedule-paused.jpg) | 隔离定义已暂停，记录当地钟点和原时区，界面报告尚未运行。 |
| [13](13-candidate-zh-reopened-saved-zone-remains-searchable.jpg) | 重开已保存的定义，仍可用自然词查到当前所选时区。 |

[创建后的正式状态](active-definition.json) · [暂停后的正式状态](paused-definition.json)

[规格和验收](../../records/2026-11/2026-11-23-scheduled-time-zone-city-search.md)
