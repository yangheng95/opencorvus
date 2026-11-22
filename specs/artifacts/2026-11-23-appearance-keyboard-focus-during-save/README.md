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
