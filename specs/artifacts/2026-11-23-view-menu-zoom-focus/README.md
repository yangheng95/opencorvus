# 视图缩放与可见焦点截图

[根因与验收](../../records/2026-11/2026-11-23-view-menu-zoom-focus.md)

独立基线 `40648/ui/` 的真实桌面截图，均由本人逐张复核。

- [基线 01 · 普通桌面打开视图菜单](01-baseline-keyboard-menu-entry.jpg)
- [基线 02 · Reset layout 向上跳到语言选项](02-baseline-arrow-skips-zoom.jpg)
- [基线 03 · Tab 到达缩放滑块](03-baseline-tab-can-reach-zoom.jpg)
- [基线 04 · 滑块 End 放大后控制被裁去](04-baseline-max-zoom-partly-hidden.jpg)
- [基线 05 · 鼠标滚动找回 160% 滑块和重置布局](05-baseline-pointer-scroll-reveals-slider.jpg)
- [基线 06 · 放大后重新打开，裁切复现](06-baseline-reopened-at-160-percent.jpg)

首轮候选同样从实际页面截取。

- [候选 07 · 菜单的缩放项目进入方向键顺序](07-candidate-menu-keyboard-zoom.jpg)
- [候选 08 · 对话框已开，旧菜单触发器仍取得焦点](08-first-candidate-dialog-focus-returned-to-menu.jpg)
- [候选 09 · 右方向键误打开文件菜单，缩放仍为 100%](09-first-candidate-right-key-opens-file-menu.jpg)
- [候选 10 · 第二轮打开后焦点仍留在页面主体](10-second-candidate-dialog-without-focus.jpg)

第三轮恢复正常焦点后复核的实页。

- [候选 11 · 打开后右方向键把实际值调到 105%](11-third-candidate-keyboard-slider-105.jpg)
- [候选 12 · 80% 下未填充轨道几乎看不见](12-third-candidate-low-contrast-80.jpg)
- [候选 13 · 160% 时仍可见滑块、焦点和值](13-third-candidate-visible-maximum-160.jpg)
- [候选 14 · 在高缩放菜单顶部显示数值及滚动条](14-third-candidate-menu-scrollbar-160.jpg)
- [候选 15 · End 揭示完整重置布局项目](15-third-candidate-scroll-reveals-reset-layout.jpg)

第四轮用于定位公共轨道问题的实页。

- [候选 16 · 冷重开后读取已保存的 160%，滑块已聚焦](16-fourth-candidate-persisted-160-and-focus.jpg)
- [候选 17 · 只换色不足以显示零尺寸轨道](17-fourth-candidate-collapsed-track-at-80.jpg)
- [候选 18 · 输入区并行度 5 的空轨道同样不可见](18-fourth-candidate-composer-unfilled-track.jpg)

最终候选 `40650/ui/` 的实际桌面截图。

- [候选 19 · 80% 的整段空轨道与滑块焦点](19-final-en-visible-track-at-80.jpg)
- [候选 20 · 实际鼠标点击轨道中点，得到 120%](20-final-en-pointer-center-120.jpg)
- [候选 21 · 鼠标打开中文控制后键盘到达 160%](21-final-zh-visible-slider-at-160.jpg)
- [候选 22 · 重载后显示已保存的中文与 155%](22-final-zh-cold-155-menu.jpg)
- [候选 23 · 键盘揭示中文高缩放菜单末项](23-final-zh-menu-end-reveals-reset.jpg)
- [候选 24 · 输入区并行度保留 5，完整轨道可读](24-final-zh-composer-shared-track.jpg)
