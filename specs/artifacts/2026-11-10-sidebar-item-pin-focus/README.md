# 侧栏置顶和列表更新焦点的证据

见[调查、范围与验收](../../records/2026-11/2026-11-10-sidebar-item-pin-focus.md)。下列图从本人直接操作并复核的真实桌面画面裁切。仅含隔离项目及测试工作项。

| 画面 | 可见结果 |
| --- | --- |
| [基线 Tab 跳到最近](03-baseline-tab-jumps-to-recents.jpg) | 项目区置顶 `Pin oldest` 后，下一次 Tab 聚焦最近区的 `Pin newest`。 |
| [基线项目列表未交付](05-baseline-list-held-menu-closed.jpg) | 置顶写入已成功；原项目行菜单正常关闭并归还焦点，行仍在第三。 |
| [基线项目列表交付后](06-baseline-list-released-focus-lost.jpg) | 同一行升至第一，焦点掉到网页主体。 |
| [基线单列表重排](09-baseline-one-list-pin.jpg) | `Pin oldest` 到首位后失焦。 |
| [基线最近列表未交付](10-baseline-recents-menu-close-held.jpg) | 取消置顶写入已成功；最近副本的原菜单按钮仍持焦。 |
| [基线最近列表交付后](11-baseline-recents-replaced-after-refresh.jpg) | 最近顺序未变，原触发器和焦点随分组更新消失。 |
| [候选项目置顶](12-candidate-project-pin-focus.jpg) | `Pin oldest` 升至首位且同一操作按钮仍持焦；主区继续显示 `Pin middle`。 |
| [候选最近取消置顶](14-candidate-recents-unpin-focus.jpg) | 项目恢复原排序，焦点留在最近的 `Pin oldest` 操作按钮。 |
| [候选单列表置顶](15-candidate-single-list-pin-focus.jpg) | 同一触发器随目标行移到首位。 |
| [候选单列表取消置顶](16-candidate-single-list-unpin-focus.jpg) | 同一触发器随目标行移到末位。 |
| [候选中文草稿续用菜单](18-candidate-zh-mission-unpin-available.jpg) | 草稿升到首位后，直接回车重开同一菜单，可见「取消置顶」。 |
| [候选迟到列表不抢焦点](20-candidate-zh-release-composer-focus.jpg) | `Pin newest` 移到 `Pin oldest` 之前，输入框仍聚焦并保留未发送文字。 |
