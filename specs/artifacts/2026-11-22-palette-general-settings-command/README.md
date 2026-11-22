# 命令面板通用设置入口的桌面验收

2026-11-22 独立开发服务和桌面浏览器原图。

| 基线场景 | 人工观察 |
| --- | --- |
| [无查询](baseline-empty.jpg) | 如期提示 Settings 及其快捷键。 |
| [查询 general](baseline-general-duplicate.jpg) | 同时出现 Suggested 中的 Settings 和 Commands 中的 General。 |
| [点击 Settings](baseline-suggestion-opens.jpg) | 进入当前 General 设置页。 |
| [点击 General](baseline-command-opens.jpg) | 仍进入同一个 General 设置页。 |

| 候选画面 | 人工观察 |
| --- | --- |
| [英文空查询焦点](candidate-en-suggested-focus.jpg) | 两次方向键选中 Settings 建议，原建议顺序与快捷键仍在。 |
| [英文建议的实际落点](candidate-en-suggested-page.jpg) | Enter 打开 General。 |
| [英文 general 搜索](candidate-en-general.jpg) | 一个 General 命令及设置类别与快捷键提示。 |
| [英文命令的实际落点](candidate-en-general-page.jpg) | Enter 打开 General。 |
| [英文 preferences 别名](candidate-en-preferences.jpg) | 指向同一个 General 命令。 |
| [英文组合词结果](candidate-en-network.jpg) | `proxy server` 仍命中 Network。 |
| [英文 Network 落点](candidate-en-network-page.jpg) | 鼠标打开真实网络设置。 |
| [中文空查询](candidate-zh-empty.jpg) | 推荐区显示本地化设置建议。 |
| [中文界面的原英文别名](candidate-zh-alias.jpg) | `preferences` 指向「通用」。 |
| [中文通用查询](candidate-zh-general.jpg) | 「通用」只出现一项，独立的「通用工作」也匹配。 |
| [中文通用落点](candidate-zh-general-page.jpg) | 鼠标打开真实「通用」设置页。 |
| [中文项目查询](candidate-zh-project.jpg) | 展示真实隔离项目及完整路径。 |
| [中文清空查询](candidate-zh-restored.jpg) | 恢复空查询建议和输入焦点。 |

[正式项目查询回执](candidate-ledger-receipts.json)包含实际项目和通用词对工作记录的查询结果。
