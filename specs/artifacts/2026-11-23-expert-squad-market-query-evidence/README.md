# 专家团市场查询与推荐截图

[分析和验收](../../records/2026-11/2026-11-23-expert-squad-market-query-evidence.md)

基线独立开发页面 `40624/ui/` 的真实交互截图，逐张人工复核。

- [基线 01 · 新建界面已安装结果为空却出现市场推荐](01-baseline-en-mission-unrelated-query-shows-market.jpg)
- [基线 02 · 新建界面展示三条无关推荐](02-baseline-en-mission-irrelevant-three-recommendations.jpg)
- [基线 03 · 正常 research 的三条建议](03-baseline-en-mission-research-recommendations.jpg)
- [基线 04 · 输入区通过同一查询展示无关建议](04-baseline-en-composer-same-unrelated-recommendations.jpg)
- [基线 05 · 精算首项之后混入其它领域](05-baseline-en-composer-actuarial-query-with-weak-results.jpg)

候选实际页面 `40626/ui/` 使用同一目录与独立运行数据。

- [候选 06 · 新建无匹配仍保留原选择](06-candidate-en-mission-preserves-selection-with-no-market-results.jpg)
- [候选 07 · 新建表单中的唯一精算建议](07-candidate-en-mission-exact-actuarial-recommendation.jpg)
- [候选 08 · research 保留前三项与顺序](08-candidate-en-mission-research-preserves-ranking.jpg)
- [候选 09 · 输入区的英文空结果与市场入口](09-candidate-en-composer-empty-search-readable.jpg)
- [候选 10 · 输入区中的唯一精算建议](10-candidate-en-composer-exact-actuarial-recommendation.jpg)
- [候选 11 · 中文合同查询的首项 Commercial Legal](11-candidate-zh-composer-commercial-legal-first.jpg)
- [候选 12 · 中文界面中的三条实际市场结果](12-candidate-zh-composer-details-remain-localized.jpg)
- [候选 13 · 紧凑字符串得到明确中文空结果](13-candidate-zh-composer-compact-query-resolves-empty.jpg)
