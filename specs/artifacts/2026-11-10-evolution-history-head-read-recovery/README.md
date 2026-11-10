# 专家团演进首页刷新实页证据

对应[根因和方案](../../records/2026-11/2026-11-10-evolution-history-head-read-recovery.md)。基线真实桌面已人工查看选中的第 22 条、等待时列表卸载、刷新失败、冷读失败和重试等待。代理只改变本批真实首页的传输时序或交付字节。

- 基线：[等待卸载列表](baseline-en-refresh-clears-read-history.jpg)、[冷读重试失焦](baseline-en-cold-retry-unmounts.jpg)；首轮：[首页接纳时原选中行失焦](candidate-en-selected-campaign-focus-after-accept.jpg)。
- 最终首读：[再次失败保留原诊断](final-en-cold-repeat-error-original-details.jpg)、[等待保留 Retry 焦点](final-en-cold-retry-holds-focus.jpg)、[接纳后回 Refresh](final-en-cold-retry-accepted-refresh-focus.jpg)。
- 最终英文刷新：[在途说明与原目录](final-en-toolbar-pending-confirmed-history.jpg)、[在途两条原证据](final-en-toolbar-pending-retains-evidence.jpg)、[失败说明](final-en-refresh-failure-retains-history.jpg)、[等待时选第 23 条](final-en-selects-campaign-during-retry.jpg)、[接纳后仍焦点在第 23 条](final-en-acceptance-keeps-campaign-focus.jpg)、[冻结续页首条新记录](final-en-frozen-tail-focus-first-new.jpg)。
- 最终中文：[本地化摘要和原诊断](final-zh-refresh-failure-details-confirmed-history.jpg)、[两组原证据](final-zh-failure-retains-comparison-evidence.jpg)、[等待时重试焦点](final-zh-retry-owns-focus.jpg)、[接纳时用户选择的标签焦点](final-zh-accepted-preserves-user-tab-focus.jpg)、[另一安装真实空历史](final-zh-independent-install-accepted-empty.jpg)。
- [运行回执](receipts.json)包含真实请求标识、交付字节与扣留时间、冻结续页和精确证据、独立数据库与三个服务轮次的关停结果。
