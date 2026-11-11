# 服务商保存后目录反馈的证据

- 项目从[原模型](01-baseline-original-model.png)改为[两个新模型](02-baseline-saving-form.png)。实际读回在途时仍显示[旧编号与旧数量](03-baseline-saved-catalog-held.png)。
- 项目真实截断后出现[两份错误](04-baseline-saved-catalog-cut.png)。[原位重试](05-baseline-retry-pending.png)接受新模型后，[原保存反馈仍显示错误](06-baseline-retry-recovered.png)。
- 全局从[原模型](08-baseline-global-original-model.png)改为[两个新模型](09-baseline-global-saving-form.png)。实际读回[在途](10-baseline-global-saved-held.png)、[截断](11-baseline-global-saved-cut.png)与[重试恢复](12-baseline-global-recovered.png)都复现同一问题。
- [基线实际回执](baseline-provider-evidence.json)包括真实项目与全局目录、全局保存响应、截断和重试，以及五项独立正式接口响应校验。

截图均由本人复核。[根因、影响及验收方案](../../records/2026-11/2026-11-12-provider-save-catalog-feedback.md)
