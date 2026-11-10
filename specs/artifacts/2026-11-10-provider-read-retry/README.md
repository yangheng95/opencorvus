# 模型服务商原位读取证据

规格：[在当前页面重试模型服务商读取](../../records/2026-11/2026-11-10-provider-read-retry.md)。隔离项目的代理只截断指定真实读取。真实截图手工复核，归档不含本机绝对路径或认证正文。

[公开读取和真实请求回执](receipts.json)覆盖白名单基线 39455/39456、候选 39457/39458。源端项目及全局读取 200；代理记录真实状态、请求身份、截断长度和人工释放，不保存正文。此前不合格的隔离页不纳入验收。

| 实页截图 | 人工观察 |
| --- | --- |
| [基线失败](baseline-read-failure-preserves-search-without-retry.jpg) / [重新进入](baseline-reopen-recovers-but-clears-search.jpg) | 认证错误旁没有重读入口；重新进入恢复配置计数但清掉筛选。 |
| [英文原位重试](candidate-en-in-place-retry-with-filter.jpg) / [键盘忙碌](candidate-en-retry-busy-keeps-focus.jpg) | 读失败、重试和仍可用的筛选同屏；忙碌按钮保持焦点。 |
| [再次失败](candidate-en-repeat-failure-stays-retryable.jpg) / [成功](candidate-en-success-retains-query-and-focuses-search.jpg) | 失败后按钮仍可用；成功后读取配置 0、目录 88、保留 `openrouter` 并回到搜索。 |
| [中文原位重试](candidate-zh-retry-with-filter.jpg) / [等待时移动焦点](candidate-zh-user-moves-focus-during-retry.jpg) / [成功后保持焦点](candidate-zh-success-keeps-user-focus.jpg) | 中文摘要和重试清楚；主动移到“添加”后响应不会把焦点移走。 |
