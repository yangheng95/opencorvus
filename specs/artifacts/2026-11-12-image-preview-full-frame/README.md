# 全图预览边角裁切基线

| 桌面实拍 | 画面 |
| --- | --- |
| [01](01-baseline-file-original.png) | 文件栏原图可辨认四色角标 |
| [02](02-baseline-preview-corners-clipped.png) | 100% 全图预览几乎裁去整个角标 |
| [03](03-baseline-preview-200.png) | 放大到 200% 后标记边角仍被裁切 |
| [04](04-baseline-preview-small.png) | 32×32 方图在全图窗口显示为圆形 |

[两张实际源图的尺寸与原件下载](baseline-source-images.json)。以上为真实开发页面截图，已逐张人工复核。

## 候选验收

| 桌面实拍 | 画面 |
| --- | --- |
| [05](05-candidate-preview-corners-100-en.png) | 英文文件栏全图 100% 显示完整角标和直边 |
| [06](06-candidate-preview-corners-200-en.png) | 实际放大至 200% 后显示完整四色角标 |
| [07](07-candidate-preview-original-size-en.png) | 从菜单选择原始尺寸，回到 100%，完成原件下载 |
| [08](08-candidate-draft-square-100-zh.png) | 中文草稿的 32×32 小图保持方形 |
| [09](09-candidate-preview-menu-zh.png) | 实际右键菜单使用当前界面语言 |
| [10](10-candidate-draft-escape-zh.png) | Escape 后焦点返回草稿缩略图 |
| [11](11-candidate-draft-square-125-zh.png) | Enter 重新打开，实际放大到 125% 后仍为方形 |

[四色角标源图](source-corner-markers.png)、[小方图源图](source-panel-small.png)与[开发页面接口和下载事实](candidate-runtime.json)。所有截图来自独立的真实 Windows Chrome 窗口，并逐张人工复核。
