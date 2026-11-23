# 全图预览按当前窗口缩放的桌面证据

基线与候选分别来自独立开发页面 `40580/ui/`、`40582/ui/`，按实际操作顺序保留。

| 画面 | 观察 |
| --- | --- |
| [01 手动选择 75%](01-baseline-small-image-manual-75.jpg) | 通过缩小按钮改变 120×80 图的比例。 |
| [02 窗口调整](02-baseline-small-image-resize-retains-75.jpg) | 比例仍是用户选的 75%。 |
| [03 窄窗口首次打开宽图](03-baseline-wide-open-narrow.jpg) | 初值 73%，以现有打开策略呈现。 |
| [04 窄窗口适应整图](04-baseline-wide-fit-image-narrow.jpg) | 在 1000×550 实际执行，得到约 45%。 |
| [05 扩窗后适应整图](05-baseline-wide-fit-image-keeps-narrow-geometry.jpg) | 1440×900 的预览区域仍使用 45%，留白过大。 |
| [06 扩窗后适应宽度](06-baseline-wide-fit-width-keeps-narrow-geometry.jpg) | 同一大窗口仍使用原 73%，未利用当前宽度。 |
| [07 同尺寸重开](07-baseline-wide-reopen-remeasures-viewport.jpg) | 重开即读到大窗口可用尺寸，显示 88%。 |
| [08 缩窄后适应整图裁出区域](08-baseline-wide-fit-image-after-shrink-crops.jpg) | 缩回 1000×550 后仍使用 88%，图像底部不可见。 |
| [09 候选窄窗整图](09-candidate-narrow-fit-image.jpg) | 45% 完整呈现 1200×630 原图的四边。 |
| [10 扩窗后整图 88%](10-candidate-expansion-fit-image-88.jpg) | 同一预览重新执行后占满当前可用宽度。 |
| [11 缩窄后恢复边界](11-candidate-shrink-fit-image-restores-full-frame.jpg) | 同一预览适应当前高度，整图不再出现旧比例裁切。 |
| [12 窄窗适应宽度](12-candidate-narrow-fit-width-73.jpg) | 73% 贴合当前 871 像素宽度，可继续滚动查看余下高度。 |
| [13 扩窗适应宽度](13-candidate-expansion-fit-width-88.jpg) | 88% 贴合当前 1055 像素宽度。 |
| [14 原始比例](14-candidate-original-size-100.jpg) | 仍按原图像素显示，标题保留 1200×630。 |
| [15 手选比例保持](15-candidate-window-resize-retains-manual-75.jpg) | 调整窗口后小图维持 75%，四角可见。 |
| [16 中文宽度适应](16-candidate-zh-grid-fit-width.jpg) | 窗口变化后按当前区域得到约 20%。 |
| [17 中文拖动宽图](17-candidate-zh-grid-pan-in-width-mode.jpg) | 实际向下滚动约 171 像素，可读到网格下部。 |
| [18 中文整图适应](18-candidate-zh-grid-fit-image-resets-scroll.jpg) | 约 13% 显示整个网格，滚动复位。 |
