# 文件审阅跨虚拟窗口的键盘焦点截图

真实开发服务和隔离工作会话。基线 `40880/ui/`、首候选 `40882/ui/` 和最终 `40884/ui/` 各通过正式读取提供 84 条精确快照。

| 原图 | 实际观察 |
| --- | --- |
| [01 英文首条](01-baseline-en-virtual-search-enters-first-record.jpg) | 从搜索直接进入绝对可见的原首项。 |
| [02 英文 End](02-baseline-en-end-mounts-last-but-loses-focus.jpg) | 末段渲染，原预览保留，实际焦点已回到文档。 |
| [03 英文 Home](03-baseline-en-home-mounts-first-but-loses-focus.jpg) | 从原末项回到首段，实际焦点同样丢失。 |
| [04 中文 160%](04-baseline-zh-160-virtual-end-releases-focus.jpg) | 实际滚到第 84 项，选中背景仍在但可见焦点消失。 |
| [05 首候选英文 End](05-candidate-en-end-focuses-visible-final-record.jpg) | 实际把完整可见焦点交给末条。 |
| [09 首候选分页旧缺陷](09-candidate-en-page-up-leaves-item-after-selector-error.jpg) | Page Up 仍留在末条，真实日志记录了默认键委托的选择器异常。 |
| [15 首候选中文预览阻断](15-candidate-zh-160-selected-preview-stops-after-resource-error.jpg) | 第 84 条已聚焦，选择后预览仍卡在第 83 条。 |
| [16 最终英文末条聚焦](16-final-en-end-makes-visible-focus-before-selection.jpg) | End 到第 84 条，第一条预览仍在。 |
| [17 最终英文明确选择](17-final-en-enter-selects-exact-last-record.jpg) | Enter 选择第 84 条的准确预览。 |
| [18 最终英文 Home](18-final-en-home-focuses-first-keeps-last-preview.jpg) | 首条实际聚焦、末条预览仍在。 |
| [19 最终英文连续输入](19-final-en-consecutive-end-enter-selects-84.jpg) | 连续 End 与 Enter 选择第 84 项。 |
| [20 最终英文离开列表](20-final-en-search-focus-kept-after-leaving-jump.jpg) | 原生斜杠回搜索，现有查询仍实际持焦。 |
| [21 最终英文五项结果](21-final-en-narrowed-five-keeps-normal-list-selection.jpg) | 筛回普通列表后第 83 项可独立聚焦并准确选择。 |
| [22 最终中文 Home](22-final-zh-160-home-focuses-first-preserves-83.jpg) | 第一条焦点完整可见，第 83 条预览保持。 |
| [23 最终中文 End](23-final-zh-160-end-focuses-visible-84-before-selection.jpg) | 末条焦点完整可见，预览尚未改变。 |
| [24 最终中文空格](24-final-zh-160-space-selects-current-84-preview.jpg) | 明确选择后成功显示第 84 项预览。 |
| [25 最终中文连续按键](25-final-zh-160-home-enter-selects-exact-first.jpg) | Home 后紧接 Enter 更新到准确首项。 |
| [26 最终中文原文件](26-final-zh-160-opens-current-file-with-original-content.jpg) | 工作台实际读到原精确路径及文本。 |
| [27 最终中文返回](27-final-zh-160-return-restores-query-and-first-record.jpg) | 返回后仍是原查询和首项预览。 |
| [28 最终中文清除空结果](28-final-zh-160-clear-recovers-saved-list-after-empty.jpg) | 有效清除后实际恢复 84 项、现有查询归属和预览。 |

[调查、方案与验收](../../records/2026-11/2026-11-24-file-review-virtual-keyboard-focus.md)
