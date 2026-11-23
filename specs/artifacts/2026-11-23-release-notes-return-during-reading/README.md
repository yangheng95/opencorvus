# 真实桌面更新日志详情导航截图

四张基线来自隔离开发入口 `40600/ui/`。

| 画面 | 观察 |
| --- | --- |
| [01 英文安装版顶部](01-baseline-en-release-top.jpg) | 详情最前方显示全部版本和网站操作。 |
| [02 英文安装版末尾](02-baseline-en-release-bottom-hides-return.jpg) | 读到升级影响时需要向上滚回才能点全部版本。 |
| [03 英文历史版末尾](03-baseline-en-historical-release-bottom-hides-return.jpg) | 从真实搜索选中的 0.1.51 复现同一问题。 |
| [04 中文历史版放大](04-baseline-zh-historical-release-bottom-hides-return.jpg) | 160% 桌面缩放下读到末尾，同一操作栏离屏。 |

本人复核第一候选的布局问题，以及最终候选 `40602/ui/` 的九张图。

| 画面 | 观察 |
| --- | --- |
| [08 第一候选的吸顶空带](08-candidate-en-inline-link-remains-keyboard-visible.jpg) | 键盘可见原正文链接，但顶栏上方露出滚动正文。 |
| [09 英文安装版首屏](09-final-en-current-release-top.jpg) | 已有操作、版本号、日期和正文按原顺序出现。 |
| [10 英文安装版末尾](10-final-en-current-release-bottom.jpg) | 操作等高对齐阅读区顶部，升级说明仍可读。 |
| [11 从末尾点击返回](11-final-en-current-return-focus.jpg) | 实际点击后聚焦当前版本行。 |
| [12 英文原正文链接](12-final-en-authored-link-focus-at-bottom.jpg) | Tab 聚焦实际源码比较链接，粘性操作栏保持在顶部。 |
| [13 英文原历史结果](13-final-en-history-query-and-focus-retained.jpg) | 末尾键盘返回后保留筛选及准确行。 |
| [14 中文 160% 详情](14-final-zh-history-detail-at-160-percent.jpg) | 当前语言对应标题、标签和日期。 |
| [15 中文 160% 中段](15-final-zh-history-middle-at-160-percent.jpg) | 滚动内容沿顶部操作栏下方呈现。 |
| [16 中文 160% 末尾](16-final-zh-history-bottom-keyboard-return.jpg) | 「全部版本」保留可见的键盘焦点。 |
| [17 中文原历史结果](17-final-zh-history-original-result-focus.jpg) | Enter 返回同一查询及正确版本行。 |
