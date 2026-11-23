# 输入区引用选中、取消与焦点截图

[分析和验收](../../records/2026-11/2026-11-23-composer-reference-toggle-focus.md)

实际隔离基线 `40632/ui/`，本人逐张复核。

- [基线 01 · research-report 的真实键盘焦点](01-baseline-en-focused-research-skill.jpg)
- [基线 02 · 选中技能后只余选中样式，焦点离开](02-baseline-en-skill-selected-focus-on-page.jpg)
- [基线 03 · 再按 Down 只滚动页面](03-baseline-en-down-cannot-reach-next-reference.jpg)
- [基线 04 · 重新定位到已确认匹配的 Research Studio](04-baseline-en-focused-matching-squad.jpg)
- [基线 05 · 选择专家团后焦点同样丢失](05-baseline-en-selected-squad-focus-on-page.jpg)
- [基线 06 · 范围外保留项可用键盘操作](06-baseline-en-retained-squad-before-removal.jpg)
- [基线 07 · 移除保留项后搜索框未获得焦点](07-baseline-en-retained-removal-focus-on-page.jpg)

候选实际 `40634/ui/` 保留相同请求与键盘操作。

- [候选 08 · Space 选中技能时仍聚焦原行](08-candidate-en-skill-selected-keeps-exact-focus.jpg)
- [候选 09 · 从技能到 Research Studio 并选中，焦点留在该行](09-candidate-en-squad-selected-keeps-exact-focus.jpg)
- [候选 10 · 连续选中 Base，列表计数为 3](10-candidate-en-next-squad-selects-without-restarting.jpg)
- [候选 11 · 移除范围外专家团后回到同一搜索](11-candidate-en-removing-retained-squad-refocuses-search.jpg)
- [候选 12 · 直接改搜并取消技能时焦点可见](12-candidate-en-direct-requery-and-skill-cleared.jpg)
- [候选 13 · 退出后保持原草稿和入口焦点](13-candidate-en-closing-keeps-original-draft-and-trigger.jpg)
- [候选 14 · 中文生成器选中后保留同一项焦点](14-candidate-zh-selected-generator-retains-focus.jpg)
- [候选 15 · 中文场景也能用鼠标选中 Dynamic](15-candidate-zh-pointer-selects-dynamic.jpg)
- [候选 16 · 取消一项范围外选择时保留另一项](16-candidate-zh-retained-removal-keeps-other-selection.jpg)
- [候选 17 · Tab 到原有精算专家团的市场动作](17-candidate-zh-keyboard-reaches-real-market-action.jpg)
