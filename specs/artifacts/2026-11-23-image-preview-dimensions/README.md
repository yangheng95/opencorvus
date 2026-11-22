# 全图预览固有尺寸的实页截图

Windows 桌面浏览器真实本机开发页面。实际操作后的原图已逐张查看。[方案与结果](../../records/2026-11/2026-11-23-image-preview-dimensions.md)

| 原图 | 实际结果 |
| --- | --- |
| [01 宽图适应状态](01-baseline-open-no-dimensions.jpg) | 宽图初始 72%，全图界面没有宽高信息。 |
| [02 宽图放大](02-baseline-zoom-only.jpg) | 现有放大动作改为 97%，仍只显示缩放比例。 |
| [03 小图原始比例](03-baseline-small-no-dimensions.jpg) | 小图以 100% 显示，也没有像素宽高。 |
| [04 宽图显示宽高](04-candidate-wide-intrinsic-dimensions.jpg) | 英文标题旁显示 `1,200 × 630 px`，初始适应比例 72%，图片操作保有焦点。 |
| [05 放大后的宽图](05-candidate-dimensions-unchanged-on-zoom.jpg) | 显示比例 97%，宽高继续为 `1,200 × 630 px`。 |
| [06 恢复原始比例](06-candidate-original-zoom-dimensions.jpg) | 图片操作菜单恢复到 100%，宽高继续为 `1,200 × 630 px`。 |
| [07 原入口焦点](07-candidate-focus-returns-to-wide-file.jpg) | Escape 后原文件预览入口获得焦点。 |
| [08 小图宽高](08-candidate-small-image-own-dimensions.jpg) | 当前文件显示 `32 × 32 px` 和 100%。 |
| [09 中文普通图](09-candidate-chinese-overview-dimensions.jpg) | 当前文件显示 `120 × 80 像素` 和 100%，四角标记可见。 |
| [10 中文放大](10-candidate-chinese-zoom-dimensions.jpg) | 125% 时仍显示 `120 × 80 像素`，四角标记可见。 |

隔离项目三张图片分别复制自仓库网页 `og.png` 和既有[全图四角证据](../2026-11-12-image-preview-full-frame/README.md)中的 `source-corner-markers.png`、`source-panel-small.png`。
