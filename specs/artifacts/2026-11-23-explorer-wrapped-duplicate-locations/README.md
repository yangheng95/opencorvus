# 同名文件区分目录的真实桌面截图

基线页面由 `40792/ui/` 实际提供，使用 `main-mNnpbipP.js`。本人显示并检查以下原图。

- [英文 100% 两份同名结果截断到相同开头](01-baseline-en-100-long-differentiating-directory-clipped.jpg)
- [简体中文 160% 同样看不到长目录中的 east 和 west](02-baseline-zh-160-both-result-paths-show-same-prefix.jpg)
- [打开后原始路径和正文可辨认确切西侧文件](03-baseline-zh-160-west-identity-only-obvious-after-opening.jpg)
- [十二项真实列表中 End 到达最后一项但编号不可见](04-baseline-zh-160-keyboard-reaches-last-lot-with-clipped-number.jpg)

候选 `40794/ui/` 实际加载 `main-BDeP-LAp.js`，下列原图按真实操作复核。

- [英文 100% 的两条长目录结果同时可辨认](05-candidate-en-100-both-distinguishing-locations-visible.jpg)
- [键盘打开真实东侧文件及其正文](06-candidate-en-100-keyboard-opens-east-document.jpg)
- [简体中文 160% 同屏显示两条换行路径](07-candidate-zh-160-wrap-keeps-both-directions-visible.jpg)
- [鼠标按可见路径选择并打开真实西侧文件](08-candidate-zh-160-pointer-opens-west-document.jpg)
- [两条较短的同名路径仍可读](09-candidate-zh-160-short-duplicate-paths-remain-readable.jpg)
- [唯一搜索结果保持单行密度](10-candidate-zh-160-unique-search-retains-compact-row.jpg)
- [清空查询恢复正常项目树和行高](11-candidate-zh-160-normal-tree-uses-original-row-density.jpg)
- [默认桌面 End 跳到可读的第十二项](12-candidate-zh-160-end-focuses-visible-lot-twelve.jpg)
- [默认桌面 Home 跳回可读的第一项](13-candidate-zh-160-home-focuses-visible-lot-one.jpg)
- [桌面列表视区比一行更矮时 End 仍可聚焦真实第十二项](14-candidate-zh-160-oversized-row-receives-end-focus.jpg)
- [恢复默认桌面并用 Enter 打开第十二项的实际正文](15-candidate-zh-160-keyboard-opens-confirmed-lot-twelve.jpg)
