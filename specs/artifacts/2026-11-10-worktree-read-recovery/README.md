# 工作树读取与恢复实页证据

对应[根因和方案](../../records/2026-11/2026-11-10-worktree-read-recovery.md)。基线本人在隔离项目的真实环境面板观察手动刷新、重复诊断、实际自动成功后的过期诊断，以及冷读取失败时缺少恢复入口。

- 基线：[一次失败显示两处错误](baseline-manual-failure-duplicates-diagnostic.jpg)、[成功后残留过期提示](baseline-recovered-read-leaves-stale-refresh-failure.jpg)。
- 最终英文：[读取等待与原按钮焦点](final-en-refresh-pending-keeps-focus.jpg)、[单一诊断和上次列表](final-en-single-failure-retains-confirmed-worktree.jpg)、[恢复后保留主动移开的焦点](final-en-auto-recovery-keeps-other-focus.jpg)。
- 最终中文：[冷读等待](final-zh-cold-loading-state.jpg)、[原诊断和详情焦点](final-zh-original-details-has-focus.jpg)、[后台成功交回刷新](final-zh-auto-success-returns-detail-focus.jpg)、[手动重试等待](final-zh-cold-manual-retry-pending.jpg)、[手动完整读回](final-zh-cold-manual-retry-success.jpg)、[独立主工作树的确认空态](final-zh-confirmed-primary-only.jpg)。
- [真实读取、原 Git 状态、隔离数据库和关停回执](receipt.json)。
