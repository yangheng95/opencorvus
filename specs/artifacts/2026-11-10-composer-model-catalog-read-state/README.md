# 模型选择器读取状态实页证据

规格：[主输入区区分模型目录读取失败与没有可用模型](../../records/2026-11/2026-11-10-composer-model-catalog-read-state.md)。隔离桌面截图来自真实手工操作，代理只截断指定的真实目录响应。

[真实读取回执](receipts.json)覆盖白名单基线 39459/39460、候选 39461/39462、实际 200、三次候选截断及随后真实重读，不含认证正文或本机绝对路径。

| 实页截图 | 人工观察 |
| --- | --- |
| [基线读取失败](baseline-failed-read-claims-no-models.jpg) / [基线实际空态](baseline-confirmed-empty-same-appearance.jpg) | 原来两种状态的文案一样。 |
| [英文候选失败](candidate-en-distinct-read-failure.jpg) / [等待](candidate-en-retry-busy-focus.jpg) | 可就地重试，等待中保留焦点和 `openrouter`。 |
| [英文真实空态](candidate-en-accepted-empty-query-retained.jpg) | 完整读取后显示没有可用模型，焦点回到原查询。 |
| [中文候选失败](candidate-zh-distinct-read-failure.jpg) / [真实空态](candidate-zh-accepted-empty-query-retained.jpg) | 中文区分读取失败和真实空态，查询保留。 |
| [等待期间关闭](candidate-zh-closed-retry-keeps-trigger-focus.jpg) / [重新打开](candidate-zh-reopen-reads-accepted-empty.jpg) | 关闭后回执不抢走模型按钮焦点；再次打开重新读取。 |
