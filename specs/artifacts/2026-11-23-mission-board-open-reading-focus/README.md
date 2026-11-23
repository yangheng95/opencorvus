# 看板打开后的键盘焦点真实桌面截图

基线由 `40758/ui/` 提供，加载 `main-DwezpmBy.js`。本人通过真实隔离桌面交互取得并查看下列原图。

- [英文 100% 回执打开后焦点落到文档](01-baseline-en-100-receipt-open-focus-falls-to-body.jpg)
- [第一次 Tab 进入会话标题的诊断提示](02-baseline-en-100-first-tab-reaches-header-diagnostics.jpg)
- [简体中文 160% 同一卡片返回后阅读位置保留，焦点落到文档](03-baseline-zh-160-same-card-preserves-reading-but-leaves-body-focused.jpg)
- [Page Up 没有推动原阅读区，下一次 Tab 未进入其中](04-baseline-zh-160-page-up-and-tab-leave-reading-view-inactive.jpg)
- [键盘切到不同草稿时也缺少会话阅读焦点](05-baseline-zh-160-different-card-also-leaves-body-focused.jpg)

首候选由 `40760/ui/` 提供，加载 `main-BDmc7Xzv.js`。

- [英文 100% 从回执打开后焦点到会话视口](06-candidate-en-100-receipt-focuses-conversation-viewport.jpg)
- [紧接 Tab 与 End 能进入请求并读到末行](07-candidate-en-100-tab-and-end-read-request-tail.jpg)
- [简体中文 160% 同一卡片返回只保留位置，焦点仍落到文档](08-candidate-zh-160-same-card-focus-preserves-both-offsets.jpg)
