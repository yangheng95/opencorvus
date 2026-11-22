# 定时编辑器保留已保存的时区标识

[调查和验收记录](../../records/2026-11/2026-11-23-scheduled-saved-time-zone-identity.md)

基线来自独立项目 `http://127.0.0.1:40464/ui/`。

- [两份实际已暂停的远期规则](01-baseline-paused-time-zone-definitions.jpg)
- [详情显示确切链接标识](02-baseline-link-details.jpg)
- [普通编辑器打开时没有投影当前时区](03-baseline-link-editor-empty-zone.jpg)
- [键入已保存标识后仍是未提交的输入](04-baseline-existing-link-query.jpg)
- [相同编辑器的主要标识对照](05-baseline-primary-editor-value.jpg)
- [正式创建、暂停和原规则回执](baseline-definition-receipts.json)

候选来自 `http://127.0.0.1:40466/ui/`。

- [英语编辑器打开即显示确切保存标识](06-candidate-editor-keeps-exact-zone.jpg)
- [用键盘临时选主要标识](07-candidate-temporary-primary-selection.jpg)
- [已保存标识在同一编辑轮次仍可搜索和重新选中](08-candidate-saved-link-remains-selectable.jpg)
- [切中文后仍显示完整原时区和日历时间](09-candidate-chinese-preserves-exact-zone.jpg)
- [实际保存名称后详情保持暂停及原时区](10-candidate-saved-title-keeps-zone.jpg)
- [重新编辑已保存的新修订，时区仍相同](11-candidate-reopened-stored-link.jpg)
- [主要标识在独立对照方案中仍正确显示](12-candidate-primary-plan-keeps-value.jpg)
- [普通新建草稿仍用浏览器的默认时区](13-candidate-new-draft-uses-browser-zone.jpg)
- [取消后正式列表仍是原两份暂停定义](14-candidate-cancelled-draft-two-paused-definitions.jpg)
- [候选正式列表与真实运行历史对照](candidate-verified-definitions.json)
