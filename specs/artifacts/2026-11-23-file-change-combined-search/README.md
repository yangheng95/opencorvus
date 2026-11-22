# 文件审阅组合搜索实页截图

Windows 桌面，本人专用浏览器标签。基线端口 40540，应用构建 main-DHceUq2y.js。项目中的新增和修改均由真实 Git 工作树变化和应用快照产生。

| 截图 | 人工核对 |
| --- | --- |
| [01](01-baseline-en-release-results.jpg) | 空查询时显示三条。左边原摘要显示各条路径及类型，右边列表仍使用真实记录。 |
| [02](02-baseline-en-combined-query-empty.jpg) | 英文路径和类型组合显示 0 / 3，左边记录仍显示同一文件的 Modified 状态。 |
| [03](03-baseline-zh-combined-query-empty.jpg) | 中文类型在前、路径用反斜杠时显示 0 / 3，同一文件仍在左边摘要。 |

[规格和验收](../../records/2026-11/2026-11-23-file-change-combined-search.md)

候选端口 40542，应用构建 main-DEARkWWg.js。以下为最终构建原图。

| 截图 | 人工核对 |
| --- | --- |
| [04](04-candidate-en-search-hint.jpg) | 英文提示在默认审阅栏完整显示，空查询仍为 3 / 3。 |
| [05](05-candidate-en-path-and-status.jpg) | 原英文输入回到正确的唯一目标 1 / 3。 |
| [06](06-candidate-en-reordered-terms.jpg) | 反序和大写匹配同一个文件，输入保持原样。 |
| [07](07-candidate-en-filter-intersection.jpg) | 已有「新增」状态筛选与修改查询叠加后显示 0 / 3。 |
| [08](08-candidate-en-clear-restores-inventory.jpg) | 清除按钮恢复 3 / 3 和已有列表选择。 |
| [09](09-candidate-zh-search-hint.jpg) | 中文提示完整显示，原路径与文件名保持。 |
| [10](10-candidate-zh-backslash-and-status.jpg) | 中文和反斜杠查询显示 1 / 3，目标为 docs/release-notes.txt。 |
| [11](11-candidate-zh-added-record.jpg) | 中文新增查询准确选中 docs/release-checklist.txt。 |
| [12](12-candidate-zh-open-current-record-file.jpg) | 从匹配记录打开实际文件，显示准确路径和磁盘正文。 |
| [13](13-candidate-zh-return-retains-query.jpg) | 返回「审阅」保持该输入、数量和同一选中记录。 |
