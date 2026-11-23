# 全图预览按当前窗口缩放的桌面证据

基线来自独立开发页面 `40580/ui/`，按实际操作顺序保留。

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
