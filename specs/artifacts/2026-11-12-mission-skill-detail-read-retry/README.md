# 技能详情目录重试的证据

- [可刷新列表](01-baseline-list-ready.png)取得内置技能 `general`。[进入详情](02-baseline-detail-pending.png)后仍在等待原刷新。
- 真实截断后，[详情](03-baseline-detail-failed.png)显示原诊断和旧技能内容。[返回列表](04-baseline-required-list-return.png)才出现刷新入口，[真实列表恢复](05-baseline-list-recovered.png)后目录可用。
- [基线真实回执](baseline-mission-skill-evidence.json)记录扣留、截断、成功回读和两个正式接口响应校验。
- 英文详情显示[正在刷新](06-candidate-en-detail-pending.png)、[失败和重试](07-candidate-en-detail-failed.png)、[重试中](08-candidate-en-detail-retrying.png)与[再次失败](09-candidate-en-detail-retry-failed.png)。成功后按 Tab 到达[复制调用](10-candidate-en-detail-restored-focus.png)。
- 中文详情显示[正在刷新](11-candidate-zh-detail-pending.png)与[失败和重试](12-candidate-zh-detail-failed.png)。[重试时展开工具](13-candidate-zh-detail-retrying-tools.png)，成功后仍显示[同一技能和 14 个工具](14-candidate-zh-detail-restored-tools.png)，反向 Tab 到达复制调用。
- [候选真实回执](candidate-mission-skill-evidence.json)对应两种语言的目录失败和成功，以及实际正式接口校验。

截图由本人复核。[根因、影响及方案](../../records/2026-11/2026-11-12-mission-skill-detail-read-retry.md)
