# PDF 缩放阅读位置的桌面证据

Windows 桌面独立标签、正式开发服务 40564、构建 `main-BFL1gus-.js`。测试文件为 [已验收的八页原件](../2026-11-23-pdf-direct-page-navigation/field-handbook.pdf)。

| 截图 | 人工核对 |
| --- | --- |
| [01](01-baseline-en-reading-before-zoom.jpg) | 200% 时，手册内部链接在实际阅读区顶部。 |
| [02](02-baseline-en-same-scroll-after-zoom.jpg) | 两次键盘放大到 250%，链接大幅远离顶部。 |
| [03](03-baseline-en-link-before-zoom-out.jpg) | 250% 重新滚到同一链接，链接仍在阅读区顶端。 |
| [04](04-baseline-en-zoom-out-loses-current-line.jpg) | 缩小到 225% 时，同一页只剩空白，链接在可视区上方。 |

只读几何作为截图补充，记录真页面的滚动距离、页框和文字层相对坐标。 [基线几何](baseline-geometry.json)

候选开发服务 40566，构建 `main-0HQLd2Cf.js`。

| 截图 | 人工核对 |
| --- | --- |
| [05](05-candidate-en-reading-before-zoom.jpg) | 200% 英文页面从同一位置开始，链接靠近阅读区顶部。 |
| [06](06-candidate-en-rapid-zoom-keeps-link.jpg) | 两次回车放大到 250%，链接留在顶部，键盘焦点在放大按钮。 |
| [07](07-candidate-en-two-axis-reading-position.jpg) | 鼠标横滚后，链接靠近上、左两个阅读边缘。 |
| [08](08-candidate-en-zoom-out-keeps-both-axes.jpg) | 缩小到 225% 时，链接仍靠近两个阅读边缘。 |
| [09](09-candidate-zh-zoom-out-keeps-link.jpg) | 简中界面继续缩到 200%，同一行可读，焦点保留。 |
| [10](10-candidate-zh-fit-width-clamps-reading-position.jpg) | 适合宽度显示完整封面及实际链接。 |
| [11](11-candidate-zh-internal-link-goes-to-page-seven.jpg) | 实点文档链接后显示第 7 页的交接清单。 |
| [12](12-candidate-zh-direct-page-keeps-zoom-starts-at-top.jpg) | 从已滚动第 7 页直接进入第 8 页页首，维持 200% 倍率。 |

[候选几何记录](candidate-geometry.json)

[规格和验收](../../records/2026-11/2026-11-23-pdf-zoom-reading-anchor.md)
