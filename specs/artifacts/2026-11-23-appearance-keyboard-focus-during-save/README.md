# 外观偏好与连续键盘焦点

[调查和验收记录](../../records/2026-11/2026-11-23-appearance-keyboard-focus-during-save.md)

基线来自独立项目开发服务 `http://127.0.0.1:40458/ui/`。

- [从设置导航进入初始主题控件](01-baseline-theme-focused.jpg)
- [使用展开菜单切浅色后回到主题](02-baseline-theme-light-focus.jpg)
- [使用展开菜单切中文后回到语言](03-baseline-language-chinese-focus.jpg)
- [刷新后外观原控件读取浅色和简体中文](04-baseline-reloaded-light-chinese.jpg)
- [收起主题以方向键改到石墨紫](05-baseline-collapsed-theme-arrow-focus.jpg)
- [第一次 Tab 未推进，接着的方向键仍改变主题](06-baseline-collapsed-language-arrow-focus.jpg)
- [重复 Tab 后才到达语言](07-baseline-after-repeated-tab.jpg)
- [收起语言通过方向键成功切回英语](08-baseline-collapsed-language-arrow.jpg)
- [单步复现第一次 Tab 仍停在刚保存的浅色主题控件](09-baseline-first-tab-after-theme-change.jpg)
- [没有偏好变动时的正常 Tab 顺序](10-baseline-unmodified-focus-order.jpg)
- [收起语言更改后正常通过反向 Tab 返回主题](11-baseline-first-shift-tab-after-language-change.jpg)

首轮候选 `40460/ui/` 为排除临时禁用的对照。

- [按钮保持启用时第一次 Tab 仍留在主题](12-candidate-first-tab-after-theme.jpg)
- [独立日志筛选同样需要额外一次 Tab](13-candidate-log-filter-repeats-tab.jpg)

最终复验来自 `40462/ui/`。

- [英语主题改变后的首次 Tab 到达语言](14-final-first-tab-reaches-language.jpg)
- [简体中文切换后，首次反向 Tab 返回主题](15-final-chinese-shift-tab-reaches-theme.jpg)
- [中文主题改变后的首次 Tab 到达语言](16-final-chinese-first-tab-reaches-language.jpg)
- [在弹层提交浅色后恢复主题焦点](17-final-popup-theme-commit.jpg)
- [真实刷新后读出浅色和简体中文](18-final-reloaded-preferences.jpg)
- [还原初始系统主题和英语](19-final-original-preferences-restored.jpg)
- [真实日志由 DEBUG 切至 INFO 后首次 Tab 到达刷新](20-final-log-first-tab-reaches-refresh.jpg)
- [定时草稿改为工作日后首次 Tab 到达日期](21-final-automation-draft-date-focus.jpg)
- [取消后正式计划列表回到空态](22-final-draft-cancelled.jpg)
