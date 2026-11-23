# 输入区引用焦点和弹窗滚动截图

[根因和验收](../../records/2026-11/2026-11-23-composer-reference-visible-focus.md)

本人在基线 `40636/ui/` 逐张检查下列真实操作画面。

- [基线 01 · 三次 Down 正确聚焦 Base，但弹窗截断其下半行](01-baseline-en-focus-reaches-base-with-row-clipped.jpg)
- [基线 02 · End 聚焦生成器，弹窗内完全看不到该行](02-baseline-en-end-focuses-option-outside-popup.jpg)
- [基线 03 · 用鼠标滚动外层后看见已聚焦末项](03-baseline-en-pointer-scroll-reveals-end-option.jpg)
- [基线 04 · Home 返回第一个选项，搜索仍在可见区域之外](04-baseline-en-home-returns-first-with-search-scrolled-away.jpg)
- [基线 05 · 中文 150% 下 End 的焦点行完全被遮挡](05-baseline-zh-150-percent-end-row-is-hidden.jpg)

候选 `40638/ui/`。

- [候选 06 · Down 聚焦时看见完整 Base 行](06-candidate-en-focused-base-fully-visible.jpg)
- [候选 07 · End 无需手动滚动即可看见生成器末项](07-candidate-en-end-brings-final-row-into-view.jpg)
- [候选 08 · Home 让第一行直接滚入弹窗](08-candidate-en-home-brings-first-row-into-view.jpg)
- [候选 09 · 滚轮可在同一区域进入下部选项](09-candidate-en-wheel-reaches-lower-options-in-one-region.jpg)
- [候选 10 · Shift+Tab 让搜索框滚回并获得焦点](10-candidate-en-reverse-tab-brings-back-search.jpg)
- [候选 11 · 中文 150% 下 End 显示完整末项](11-candidate-zh-150-percent-end-row-fully-visible.jpg)
- [候选 12 · 中文 150% 下末项在可见焦点处选中](12-candidate-zh-150-percent-last-selection-keeps-visible-focus.jpg)
- [候选 13 · 中文 150% 下 Home 将首项滚回可见区](13-candidate-zh-150-percent-home-row-fully-visible.jpg)
- [候选 14 · 中文 150% 下市场长标题及对应按钮可见](14-candidate-zh-150-percent-long-market-action-visible.jpg)
- [候选 15 · 放大列表的市场末端入口仍可用键盘到达](15-candidate-zh-150-percent-market-footer-visible.jpg)
