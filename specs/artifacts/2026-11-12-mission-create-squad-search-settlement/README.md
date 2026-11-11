# 新建多步任务专家团搜索结算的证据

- `advanced` 的[已接受结果](01-baseline-en-accepted-advanced.png)在 `research` [在途期间](02-baseline-en-research-pending.png)仍显示。
- 真实传输失败后，[旧候选变为可勾选](03-baseline-en-research-failed.png)，实际[勾选 Advanced](04-baseline-en-stale-option-checked.png)。
- [重试期间](05-baseline-en-research-retrying.png)两份选择保留。[查询成功](06-baseline-en-research-recovered.png)后可见 Research Studio 和 Base，Advanced 作为[范围之外的选择](07-baseline-en-stale-selection-retained.png)仍在草稿。
- [真实基线回执](baseline-squad-search-evidence.json)包含正式接口检查及两次查询、扣留、截断和重试的请求身份。
- 英文候选从[已接受的 Advanced 查询](08-candidate-en-accepted-advanced.png)切到 Research。新查询[等待](09-candidate-en-research-pending.png)、[失败](10-candidate-en-research-failed.png)与[重试](11-candidate-en-research-retrying.png)只保留 Dynamic 和所选计数。恢复后显示[真实候选及搜索焦点](12-candidate-en-research-recovered.png)，原[草稿请求](13-candidate-en-request-retained.png)仍可编辑。
- 中文候选的[等待](15-candidate-zh-research-pending.png)和[失败](16-candidate-zh-research-failed.png)使用对应语言。按 Tab 到达[保留选择](17-candidate-zh-retained-checkbox-focus.png)，按空格[取消并把焦点交回搜索](18-candidate-zh-selection-cleared.png)。[恢复](19-candidate-zh-research-recovered.png)显示所选 0，[真实空查询](20-candidate-zh-confirmed-empty.png)有明确结果，随后可[选择当前候选](21-candidate-zh-current-selection.png)。
- [候选实际接口回执](candidate-squad-search-evidence.json)记录两种语言的真实截断、成功重试和确认空结果。

桌面截图由本人复核。[根因、影响及方案](../../records/2026-11/2026-11-12-mission-create-squad-search-settlement.md)
