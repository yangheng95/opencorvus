# 演进历史续页提示和键盘证据

规格：[专家团演进历史在原位重试续页](../../records/2026-11/2026-11-10-evolution-history-continuation-focus.md)。截图来自手动键盘及真实开发页面，代理只截断或暂缓指定的真实响应。

[真实回执和持久事实](receipts.json)记录两组真实 200 的请求身份，以及相同的 20+3 个精确制品身份。基线为 39445/39446，候选为 39447/39448；隔离目录路径省略。两次 Enter 只产生一次续页源请求；两种语言的重试仍用 `27/6`。

| 实页截图 | 人工观察 |
| --- | --- |
| [基线原按钮焦点](baseline-keyboard-footer.jpg) | Tab 从第 4 条来到 Load More Campaigns。 |
| [基线在途](baseline-continuation-in-flight.jpg) | 按钮被原生禁用，焦点丢回文档。 |
| [基线错误时的列表尾部](baseline-failure-footer-no-feedback.jpg) | 仍是原按钮，视口内没有失败说明。 |
| [基线失败在顶部](baseline-error-only-at-top.jpg) | 回到页头才看到失败和 `Failed to fetch`。 |
| [基线成功](baseline-success-focus-still-lost.jpg) / [下一 Tab](baseline-next-tab-skips-new-records.jpg) | 追加三条但焦点没有进入新记录。 |
| [候选英文在途](candidate-busy-keeps-footer-focus.jpg) | 同一个忙碌按钮保持焦点。 |
| [候选英文失败](candidate-failure-visible-at-footer.jpg) / [原诊断](candidate-footer-preserves-original-diagnostic.jpg) | 反馈紧挨重试按钮，键盘可打开 Details。 |
| [候选成功焦点](candidate-success-focus-first-new-row.jpg) / [Tab](candidate-tab-goes-to-second-new-row.jpg) / [Enter](candidate-enter-opens-second-new-campaign.jpg) | 焦点到第 3 条、再到第 2 条，回车打开第 2 条。 |
| [候选中文在途](candidate-zh-loading.jpg) / [重试](candidate-zh-retry-in-place.jpg) | 加载、失败和重试文案本地化，原按钮保留焦点。 |
| [候选中文用户移走焦点](candidate-zh-keeps-user-moved-focus.jpg) / [用户继续 Tab](candidate-zh-manual-tab-enters-new-page.jpg) | 响应后保持原第 4 条，下一 Tab 由用户进入第 3 条。 |
