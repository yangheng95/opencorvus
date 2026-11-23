# 文件审阅跨虚拟窗口的键盘焦点截图

真实开发服务和隔离工作会话。基线 `40880/ui/` 通过正式读取提供 84 条精确快照。

| 原图 | 实际观察 |
| --- | --- |
| [01 英文首条](01-baseline-en-virtual-search-enters-first-record.jpg) | 从搜索直接进入绝对可见的原首项。 |
| [02 英文 End](02-baseline-en-end-mounts-last-but-loses-focus.jpg) | 末段渲染，原预览保留，实际焦点已回到文档。 |
| [03 英文 Home](03-baseline-en-home-mounts-first-but-loses-focus.jpg) | 从原末项回到首段，实际焦点同样丢失。 |
| [04 中文 160%](04-baseline-zh-160-virtual-end-releases-focus.jpg) | 实际滚到第 84 项，选中背景仍在但可见焦点消失。 |

[调查、方案与验收](../../records/2026-11/2026-11-24-file-review-virtual-keyboard-focus.md)
