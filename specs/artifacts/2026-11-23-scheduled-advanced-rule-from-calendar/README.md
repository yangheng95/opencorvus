# 高级定时规则转换的真实桌面截图

基线由 `40768/ui/` 提供并加载 `main-CWSIgPZQ.js`。本人操作真实隔离表单后查看下列原图。

- [英文 100% 重复模式选择](01-exploration-en-100-repeat-choices.jpg)
- [从默认日程切到高级时正文为空](02-exploration-en-100-advanced-starts-with-empty-recurrence.jpg)
- [实际填写 2099 年星期五 10:45 和纽约时区](03-baseline-en-100-weekly-friday-1045-new-york-authored.jpg)
- [切换高级后当前完整常用日程没有进入编辑器](04-baseline-en-100-weekly-values-do-not-reach-advanced-rule.jpg)
- [简体中文 160% 回到常用模式仍可看到原选定字段](05-baseline-zh-160-return-to-basic-keeps-calendar.jpg)
- [已亲手写入的高级文本在来回切换中保持](06-baseline-zh-160-authored-rule-survives-mode-switch.jpg)
- [分段年份未填完整时保持当前输入状态](07-baseline-zh-160-incomplete-date-segment.jpg)

候选由 `40770/ui/` 提供并加载 `main-B406TzLp.js`。下列原图按实际操作顺序保存并核对。

- [英文 100% 首次生成纽约星期五 10:45 的完整规则](08-candidate-en-100-weekly-rule-carries-current-calendar.jpg)
- [改为 11:45 后从同一表单重新生成尚未编辑的规则](09-candidate-en-100-unedited-rule-refreshes-from-1145.jpg)
- [简体中文 160% 切换后仍显示手写的两周间隔](10-candidate-zh-160-authored-rule-ready-to-save.jpg)
- [真实保存详情显示换算后的首次运行及从未运行](11-candidate-zh-160-accepted-future-schedule.jpg)
- [暂停隔离计划后的详情](12-candidate-zh-160-owned-plan-paused.jpg)
- [从已暂停计划重新打开高级规则和提示词](13-candidate-zh-160-reopened-authored-rule.jpg)
- [切回高级后明确清空的草稿保留空编辑区](14-candidate-zh-160-explicitly-cleared-rule-stays-empty.jpg)
- [新建表单的分段年份显示占位符](15-candidate-zh-160-year-placeholder-before-conversion.jpg)
- [不完整常用日期保留手动输入入口和格式提示](16-candidate-zh-160-incomplete-calendar-leaves-manual-entry.jpg)
- [退出未保存草稿后列表只显示已暂停计划](17-candidate-zh-160-return-to-single-paused-plan.jpg)
