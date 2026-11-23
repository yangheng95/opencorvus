# 专家团配置操作焦点的真实桌面实拍

隔离 OpenCorvus 开发页面，视口 1280×720。原图由本人逐张复核，只使用自有非秘密演示值。 [规格](../../records/2026-11/2026-11-23-expert-squad-configuration-action-focus.md)

| 基线实拍 | 实际画面和焦点 |
| --- | --- |
| [01 键盘聚焦 Reload](01-baseline-en-reload-holds-keyboard-focus-before-read.jpg) | 正常焦点环和原表单。 |
| [02 Reload 读完](02-baseline-en-successful-reload-drops-focus.jpg) | 原内容恢复，焦点回网页根。 |
| [03 键盘聚焦 Save](03-baseline-en-save-holds-keyboard-focus-before-write.jpg) | 显示焦点环和非秘密草稿。 |
| [04 Save 写入完成](04-baseline-en-successful-save-drops-focus.jpg) | 成功反馈出现，焦点落在网页根。 |
| [05 下一次 Tab](05-baseline-en-next-tab-returns-to-first-field.jpg) | 焦点回到表单的第一个字段。 |
| [06 中文 160% 保存前](06-baseline-zh-160-save-focus-before-write.jpg) | 窄设置区底部原保存按钮聚焦。 |
| [07 中文 160% 保存后](07-baseline-zh-160-save-loses-focus-and-feedback-offscreen.jpg) | 焦点消失，成功说明位于当前可见范围之外。 |

| 候选实拍 | 实际画面和焦点 |
| --- | --- |
| [08 英文重载前](08-candidate-en-reload-focus-with-unsaved-draft.jpg) | 非秘密草稿存在，键盘聚焦原 Reload。 |
| [09 英文重载成功](09-candidate-en-real-reload-restores-value-and-keeps-button-focus.jpg) | 恢复正式持久值，原 Reload 焦点环保留。 |
| [10 英文保存成功](10-candidate-en-save-focus-and-local-confirmation.jpg) | Save 仍聚焦，Saved 在同一操作区。 |
| [11 英文 Shift+Tab](11-candidate-en-shift-tab-visits-adjacent-reload.jpg) | 直接聚焦到相邻的 Reload。 |
| [12 中文 160% 编辑后](12-candidate-zh-160-edit-clears-prior-confirmation.jpg) | 上一次回执退休，恢复用的草稿保留，保存获得焦点。 |
| [13 中文 160% 保存成功](13-candidate-zh-160-save-keeps-visible-focus-and-confirmation.jpg) | 原保存焦点和已保存反馈在窄区同屏。 |
| [14 中文 160% Shift+Tab](14-candidate-zh-160-shift-tab-remains-at-form-actions.jpg) | 相邻重新加载重新获得焦点。 |
