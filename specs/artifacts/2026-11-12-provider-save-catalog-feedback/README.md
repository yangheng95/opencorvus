# 服务商保存后目录反馈的证据

- 项目从[原模型](01-baseline-original-model.png)改为[两个新模型](02-baseline-saving-form.png)。实际读回在途时仍显示[旧编号与旧数量](03-baseline-saved-catalog-held.png)。
- 项目真实截断后出现[两份错误](04-baseline-saved-catalog-cut.png)。[原位重试](05-baseline-retry-pending.png)接受新模型后，[原保存反馈仍显示错误](06-baseline-retry-recovered.png)。
- 全局从[原模型](08-baseline-global-original-model.png)改为[两个新模型](09-baseline-global-saving-form.png)。实际读回[在途](10-baseline-global-saved-held.png)、[截断](11-baseline-global-saved-cut.png)与[重试恢复](12-baseline-global-recovered.png)都复现同一问题。
- [基线实际回执](baseline-provider-evidence.json)包括真实项目与全局目录、全局保存响应、截断和重试，以及五项独立正式接口响应校验。
- 英文候选项目的[原模型](13-candidate-project-original.png)在[保存后读回等待](14-candidate-project-saved-held.png)时标明来源。[实际截断](15-candidate-project-saved-cut.png)出现一次读取诊断，[重试期间](16-candidate-project-retry.png)沿用原位进度。[读回成功](17-candidate-project-recovered.png)后回到搜索，直接输入编号可[找到新模型](18-candidate-project-search.png)。
- 简体中文候选全局页记录[原模型](19-candidate-global-original.png)、[保留目录等待](20-candidate-global-saved-held.png)、[单一目录错误](21-candidate-global-saved-cut.png)、[原位重试](22-candidate-global-retry.png)、[恢复当前目录](23-candidate-global-recovered.png)和[实际搜索](24-candidate-global-search.png)。
- 最终文案在[英文项目等待](25-candidate-final-en-retained.png)和[中文全局等待](26-candidate-final-zh-retained.png)中均重新查看，[全局读回](27-candidate-final-zh-settled.png)显示两个当前模型。
- [候选保存与重试回执](candidate-provider-evidence.json)记录真实变更、截断、重试与五项独立接口响应。[最终双语重读回执](final-localized-read-evidence.json)记录最终构建的两次实际目录交付。

截图均由本人复核。[根因、影响及验收方案](../../records/2026-11/2026-11-12-provider-save-catalog-feedback.md)
