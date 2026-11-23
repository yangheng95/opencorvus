# 多步任务看板搜索结果的键盘验收截图

以真实隔离开发模式和桌面界面采集并人工复核。基线、首候选和最终实例 `40858/ui/`、`40860/ui/`、`40862/ui/` 分别读取该隔离项目中的同一组四个真实手动草稿。原图保留基线、首候选的焦点裁切证据及最终验收。

| 原图 | 实际观察 |
| --- | --- |
| [01 英文列表基线](01-baseline-en-down-stays-in-mission-search.jpg) | 输入 Cedar 后有三项，按向下键焦点仍在查询。 |
| [02 英文原生 Tab](02-baseline-en-tab-reaches-clear-before-results.jpg) | 搜索框之后是现有的清除动作，整卡打开按钮在后。 |
| [03 中文看板 160% 基线](03-baseline-zh-160-board-up-stays-in-search.jpg) | 按向上键后焦点仍在查询，待规划列显示三项且首张卡在视口内。 |
| [05 首候选英文中间结果](05-candidate-en-adjacent-middle-result.jpg) | 相邻按钮获得焦点，外部阴影大部被卡裁掉，仅见边缘。 |
| [08 首候选中文末项](08-candidate-zh-160-board-up-scrolls-to-last.jpg) | 实际滚到末项，焦点环仅在下边缘可见。 |
| [12 最终英文首项](12-final-en-first-result-visible-focus.jpg) | 方向键进入首项，整卡打开按钮内部显示焦点轮廓。 |
| [13 最终英文相邻结果](13-final-en-middle-result-visible-focus.jpg) | 下一次向下定位中间结果并显示焦点轮廓。 |
| [14 最终英文原生 Tab](14-final-en-tab-preserves-edit-focus.jpg) | 现有编辑请求按钮得到自己的焦点。 |
| [15 最终英文原文](15-final-en-enter-shows-exact-original-request.jpg) | Enter 打开准确标题和完整原请求，交接到对话。 |
| [16 最终中文看板末项](16-final-zh-160-last-result-and-boundary.jpg) | 向上从搜索进入末项，再向下保持末项并可见轮廓。 |
| [17 最终中文上一项](17-final-zh-160-previous-result-visible-focus.jpg) | 向上浏览到上一项并看到新的焦点。 |
| [18 最终中文首项边界](18-final-zh-160-first-boundary.jpg) | 继续向上到首项，边界仍保留首项焦点。 |
| [19 最终中文空结果](19-final-zh-160-empty-query-matches-keeps-focus.jpg) | 在所选项目搜 Granite，明确无匹配且焦点留在输入。 |
| [20 最终中文清除](20-final-zh-160-clear-restores-four-project-cards.jpg) | Escape 后保留项目、四个原结果恢复，输入仍持焦。 |
| [21 最终中文项目与请求](21-final-zh-160-project-and-request-match.jpg) | 搜索 short transfer 只聚焦原请求匹配的整卡。 |
| [22 最终中文原文](22-final-zh-160-opens-exact-filtered-request.jpg) | Enter 打开同一草稿，原请求和对话焦点完整。 |

[问题、方案与验收记录](../../records/2026-11/2026-11-23-mission-board-search-result-navigation.md)
