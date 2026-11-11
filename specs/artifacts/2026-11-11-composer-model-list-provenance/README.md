# 主输入区模型列表来源的证据

- [真实目录的两个模型](01-baseline-current-model-list.png)与[重读在途](02-baseline-pending-retained.png)显示同一列表和同一状态文案。
- [重读失败](03-baseline-failed-retained.png)后仍显示旧选项，保留重试入口。
- [失败后的无匹配](04-baseline-failed-no-match.png)和[成功读回后的无匹配](06-baseline-current-no-match.png)使用相同描述。
- [基线实际回执](baseline-api-evidence.json)记录真实等待、截断、重试和五项正式接口响应校验。

- [候选初次成功读取](07-candidate-current.png)后，[重读在途](08-candidate-reading-retained.png)和[重读失败](09-candidate-failed-retained.png)都标明上次列表。
- [保留列表无匹配](10-candidate-failed-no-match.png)在[重试期间](11-candidate-retry-pending.png)继续显示。重试成功后，同一查询回到[当前列表无匹配](12-candidate-current-no-match.png)。搜索 `Review Alpha` [得到一项](13-candidate-search-match.png)，并[选回主输入区](14-candidate-model-selected.png)。
- 中文界面记录[保留列表](15-candidate-zh-retained.png)、[上次列表无匹配](16-candidate-zh-no-match.png)和[当前列表无匹配](17-candidate-zh-current.png)。
- 全局首次读取复核[等待](18-candidate-global-initial-pending.png)、[失败](19-candidate-global-initial-failed.png)和[读回后确认无可用模型](20-candidate-global-confirmed-empty.png)。
- [候选实际回执](candidate-api-evidence.json)记录双语项目和中文全局的目录响应及正式接口定义检查。

截图均由本人复核。[根因、影响与验收](../../records/2026-11/2026-11-11-composer-model-list-provenance.md)
