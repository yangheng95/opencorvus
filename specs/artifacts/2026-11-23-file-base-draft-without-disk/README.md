# 独立文件比较和磁盘错误的实页截图

实际 Windows 桌面浏览器中的 OpenCorvus 独立项目。图片均已人工复核。[规格与结果](../../records/2026-11/2026-11-23-file-base-draft-without-disk.md)

| 原图 | 实际结果 |
| --- | --- |
| [01 基线读盘失败](01-baseline-disk-read-failure.jpg) | 磁盘文件暂时移离原位置，磁盘模式正确显示读取失败。 |
| [02 基线基准与草稿](02-baseline-local-mode-blocked.jpg) | 选中纯本地比较，原界面仍只显示磁盘错误。 |
| [03 基线读盘恢复](03-baseline-disk-available-local-difference.jpg) | 还原原文件并重读后，同一模式呈现此前已经可用的本地差异。 |
| [04 磁盘与草稿](04-candidate-disk-to-draft-failure.jpg) | 真正的磁盘错误仍由原诊断呈现。 |
| [05 基准与磁盘](05-candidate-base-to-disk-failure.jpg) | 比较需要实际磁盘快照时，明确保留诊断。 |
| [06 基准与草稿](06-candidate-base-draft-without-disk.jpg) | 同一磁盘错误下，纯本地差异可见，模式仍持焦。 |
| [07 重读等待中](07-candidate-retry-keeps-local-pair.jpg) | 新磁盘读取仍在进行，本地差异保持完整。 |
| [08 重读成功](08-candidate-local-pair-after-retry.jpg) | 磁盘快照已恢复，本地基准和草稿保持。 |
| [09 基准对新磁盘](09-candidate-base-to-fresh-disk.jpg) | 读到真实计数 19，与原基准 18 比较。 |
| [10 新磁盘对草稿](10-candidate-fresh-disk-to-draft.jpg) | 当前磁盘 19 与真实草稿的 18 和新增行比较。 |
| [11 中文对照](11-candidate-chinese-local-difference.jpg) | 中文磁盘错误和真实本地差异同屏。 |
| [12 正式失败诊断](12-candidate-actual-404-with-local-difference.jpg) | 键盘展开当前真实 404 及原始诊断。 |
| [13 诊断展开后的阅读](13-candidate-diff-focus-with-details-open.jpg) | Tab 将真实差异区域滚入视口并聚焦。 |
| [14 返回草稿](14-candidate-draft-preserved-on-close.jpg) | 比较关闭后草稿保持未保存，焦点归还原工具栏。 |
