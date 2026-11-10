# 收件箱续页重试的真实页面证据

对应[规格](../../records/2026-11/2026-11-10-mailbox-continuation-retry.md)。[读取观测](read-observations.json)保留两个项目的规范消息顺序、游标、实际请求和传输结果。基线和候选使用相同隔离项目和原 54 条状态；代理仅改变选定真实响应的时机或长度。所有 15 张截图均实际显示并由本人复核。

| 现场 | 人工复核 |
| --- | --- |
| 基线 39421/39422 | [原页末项被勾选](baseline-accepted-page.jpg)；[续页中断后原列表消失](baseline-continuation-hidden.jpg)；[通用重试重读首页](baseline-retry-head.jpg)；[再点加载更多才接到最后一条](baseline-second-load-works.jpg) |
| 首次候选 39423/39424 | [等待期间主动把焦点移到搜索](candidate-zh-retry-focus-left.jpg)；[追加后焦点仍留在搜索](candidate-zh-appended-focus-retained.jpg)；[折叠分组已追加但焦点仍丢失的中间态](candidate-zh-collapsed-group-lost-focus.jpg) |
| 最终英文 39425/39426 | [原页、勾选和同一动作保持](final-en-first-cut.jpg)；[原展开内容、诊断与在途焦点](final-en-retry-in-flight.jpg)；[原消息仍展开，焦点到第一条新增](final-en-new-message-focus.jpg) |
| 最终中文 39425/39426 | [折叠组原 13 条及中文错误](final-zh-collapsed-retry.jpg)；[追加到 27 条、焦点到仍折叠的项目标题](final-zh-collapsed-group-focus.jpg)；[新查询只显示自己的原消息](final-zh-query-replaced.jpg) |
| 最终基础读取对照 39425/39427 | [基础失败仍显示原提示与重试](final-base-query-failed.jpg)；[重试后回搜索并显示真实无匹配](final-base-query-recovered.jpg) |
