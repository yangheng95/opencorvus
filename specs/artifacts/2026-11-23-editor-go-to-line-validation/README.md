# 跳转到行的输入错误提示与纠正截图

[根因与验收](../../records/2026-11/2026-11-23-editor-go-to-line-validation.md)

基线 `40640/ui/` 的实际文件工作台，均由本人逐张复核。

- [基线 01 · 提交前的原输入 line 42](01-baseline-en-line-prefixed-input-before-submit.jpg)
- [基线 02 · Enter 后静默关闭，仍在原行](02-baseline-en-invalid-enter-closes-without-guidance.jpg)
- [基线 03 · 鼠标提交缺少列号的输入同样关闭](03-baseline-en-incomplete-column-pointer-submit-dismisses.jpg)
- [基线 04 · 重开后输 42 才实际定位](04-baseline-en-corrected-number-jumps-after-reopen.jpg)

候选 `40642/ui/` 的同一份文件及实际编辑器，均由本人逐张复核。

- [候选 05 · 英文 Enter 保留原输入、焦点和提示](05-candidate-invalid-enter-en.jpg)
- [候选 06 · 原框改正后高亮第 42 行并回焦](06-candidate-corrected-line-42.jpg)
- [候选 07 · 中文鼠标提交保留 42: 和完整说明](07-candidate-invalid-click-zh.jpg)
- [候选 08 · 改成 40:3，选择后的单字符可见](08-candidate-corrected-column-zh.jpg)
- [候选 09 · +2 从第 40 行到第 42 行](09-candidate-relative-line-42.jpg)
- [候选 10 · 50% 到第 71 行](10-candidate-percent-line-71.jpg)
- [候选 11 · 999 截取到第 141 行](11-candidate-clamped-line-141.jpg)
- [候选 12 · 取消后仍在第 141 行，文件没有未保存的更改](12-candidate-escape-keeps-line-141.jpg)
