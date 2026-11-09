# 撰写器市场安装后的搜索和焦点：真实验收

1280 × 720 隔离开发 `/ui` 桌面原图，由实施者本人复核。没有发送草稿或创建执行。

- [01 旧安装焦点](01-before-focused-install-for-search.jpg) 与 [02 旧安装后](02-before-success-clears-query-and-focus.jpg)：真实安装使搜索清空、焦点落到页面根。
- [03 新安装焦点](03-after-focused-install-for-same-query.jpg) 与 [04 新安装后](04-after-success-preserves-query-and-focus.jpg)：同一操作完成后原查询保持、搜索框聚焦、实际安装进入可选列表。
- [05 主动改变工作类型](05-after-explicit-work-type-change-resets-search.jpg)、[06 真实提及](06-after-active-mention-uses-real-results.jpg)、[07 中文搜索](07-after-chinese-reference-search.jpg)。

[真实按键时间和焦点观察](after-keyboard-attempt.json) 与[物理数据和服务日志](owned-final-check.json) 可对照：界面仍处于等待时再次按键，服务此前已返回，记录只有一次真实安装。实际接口：[旧安装后](before-installed.json)、[新安装前](after-available.json)、[新安装后](after-installed.json)，由[真实接口检查器](check-composer-market-install.mjs) 校验。参见[本批规格](../../records/2026-11/2026-11-09-composer-market-install-continuity.md)。
