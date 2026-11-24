# 完整归档键盘浏览与续页的桌面证据

真实基线 `41640/ui/`，资产 `main-DpFpBy5E.js`。Windows 桌面 1280 × 720，英文 100%、简体中文 160%。

| 基线截图 | 观察 |
| --- | --- |
| [英文未筛选页键](baseline-en-unfiltered-page-leaves-archived-action-offscreen.jpg) | 屏幕已显示其他归档，实际焦点仍是离屏的 `Workshop machine receiving notes`。 |
| [英文未筛选回车](baseline-en-unfiltered-enter-opens-old-readonly-record.jpg) | 回车打开之前离屏的原始通用工作归档，实际呈现只读说明。 |
| [中文加载更多](baseline-zh-load-more-focuses-first-appended-record.jpg) | 真实新增首条为 `AR-009`，按钮在屏幕内，但归档行的路径下部被裁。 |
| [中文加载后用页键](baseline-zh-page-after-load-more-leaves-action-behind.jpg) | 上翻后其他记录可见，`AR-009` 的 Open 焦点仍离屏。 |
| [中文加载后回车](baseline-zh-enter-opens-offscreen-appended-record.jpg) | 打开的实际只读会话仍为 `AR-009`。 |
| [中文带词对照](baseline-zh-filtered-page-shows-actual-open-action.jpg) | 带词结果的页键已正确带焦点及整行到 `AR-104`。 |

[真实焦点坐标和操作](baseline-desktop-focus.json)、[正式归档列表与两条分页链](baseline-archive-fixture.json)。
