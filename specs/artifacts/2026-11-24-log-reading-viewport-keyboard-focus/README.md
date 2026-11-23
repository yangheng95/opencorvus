# 日志查看器键盘阅读区的验收截图

真实隔离开发模式、正式文件访问日志及桌面界面原图。基线 `40864/ui/` 有 20 条已核对的访问记录。首候选 `40866/ui/` 及最终 `40868/ui/` 在验收中各扩增至 24 条。

| 原图 | 实际观察 |
| --- | --- |
| [01 英文详情焦点](01-baseline-en-tab-jumps-to-a-rendered-detail.jpg) | 搜索、清除后直接到某条虚拟化日志的详情摘要。 |
| [04 英文跳到末尾](04-baseline-en-end-jump-removes-row-focus.jpg) | 末尾记录可见，持焦详情已卸载且焦点退到文档。 |
| [05 中文 160% 详情焦点](05-baseline-zh-160-tab-focuses-log-detail.jpg) | 持焦可见于特定详情，界面显示 20 条匹配。 |
| [06 中文 160% 跳到前段](06-baseline-zh-160-home-unmounts-log-detail.jpg) | Home 滚到日志前段，原详情焦点被释放。 |
| [07 首候选英文区域](07-candidate-en-100-tab-focuses-named-log-viewport.jpg) | 新增焦点在真实阅读区，标题、搜索和计数同屏。 |
| [17 首候选中文布局](17-candidate-zh-160-page-up-keeps-focus-but-hides-header.jpg) | 翻页焦点稳定，外层已把标题和查询滚出。 |
| [18 最终英文阅读区](18-final-en-100-named-region-with-intact-controls.jpg) | 20 条匹配时依次 Tab 至真实视口，外层位置为 0。 |
| [19 最终英文翻页](19-final-en-100-continuous-page-down.jpg) | 阅读下一段，区域边界持续可见。 |
| [20 最终英文末尾](20-final-en-100-end-keeps-reader-focused.jpg) | 到真实末尾后仍可继续键盘操作。 |
| [21 最终英文原详情](21-final-en-100-details-preserve-raw-and-structured-log.jpg) | Tab 后 Enter 展开真实结构化字段和同一原始行。 |
| [22 最终英文刷新前](22-final-en-100-refresh-pinned-reading-before.jpg) | 20 条匹配下的具体段落及焦点。 |
| [23 最终英文刷新后](23-final-en-100-refresh-preserves-reading-with-count-24.jpg) | 24 条匹配，原段与偏移保留，刷新持焦。 |
| [24 最终英文关闭](24-final-en-100-escape-restores-help.jpg) | Escape 把焦点交还帮助。 |
| [25 最终中文 160% 整体](25-final-zh-160-toolbar-and-scroll-focus-stay-visible.jpg) | 标题、工具、查询和实际焦点同时可见。 |
| [26 最终中文向前翻页](26-final-zh-160-page-up-only-scrolls-log-pane.jpg) | Page Up 只移动日志内层，工具区保持位置。 |
| [27 最终中文到首条](27-final-zh-160-home-reaches-first-record.jpg) | 重复 Home 达到真实首条，阅读区仍持焦。 |
| [28 最终中文空结果](28-final-zh-160-no-matches-keeps-search-and-toolbar.jpg) | 空态与查询焦点、完整工具栏同屏。 |
| [29 最终中文恢复](29-final-zh-160-clear-recovers-unfiltered-log.jpg) | 清除查询后恢复实际未过滤日志，输入继续持焦。 |
| [30 最终中文手动收窄](30-final-zh-160-manually-resized-dialog-keeps-logs-and-controls.jpg) | 实拖窄后控件和日志仍可读。 |
| [31 最终中文原始日志](31-final-zh-160-expanded-log-reads-original-raw-line.jpg) | 回到阅读区再翻页，完整原始数据可读。 |

[调查及验收记录](../../records/2026-11/2026-11-24-log-reading-viewport-keyboard-focus.md)
