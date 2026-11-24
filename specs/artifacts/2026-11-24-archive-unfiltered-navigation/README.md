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

最终真实服务 `41642/ui/`，资产 `main-Cl0OupMa.js`。下列截图已本人逐张复核。

| 最终构建 | 观察 |
| --- | --- |
| [英文完整归档](candidate-en-full-archive-shows-keyboard-guidance.jpg) | 真实首批 100 项及无关键词浏览提示。 |
| [翻页到 `AR-099` 的实际焦点](candidate-en-full-archive-page-keeps-row-visible.jpg) | 打开按钮、标题、项目和档案日期同屏。 |
| [英文实际只读对话](candidate-en-opens-correct-readonly-ar099.jpg) | 正确打开 `AR-099`，焦点在原归档说明。 |
| [中文首批后的加载更多](candidate-zh-load-more-reachable-after-loaded-tail.jpg) | 通过末行原生 Tab 访问实际续页按钮。 |
| [中文实际续页焦点](candidate-zh-first-appended-record-entire-row-visible.jpg) | `AR-009` 的完整项目路径、标题及「打开」焦点可读。 |
| [中文翻到已加载通用工作](candidate-zh-pages-through-append-to-real-work-item.jpg) | 翻页和方向键进入准确记录 `AR-004`。 |
| [中文准确只读通用工作](candidate-zh-opens-correct-readonly-ar004.jpg) | 实际会话归档说明持有焦点。 |
| [中文单项](candidate-zh-exact-search-sole-open-action.jpg) | 精确 `AR-004`，实际唯一按钮边界不变。 |
| [中文空结果](candidate-zh-empty-results-keep-real-search.jpg) | 保持用户输入及本地化空状态。 |

[最终焦点坐标](candidate-desktop-focus.json)、[实际 109 项顺序](candidate-desktop-archive-order.json)、[正式归档和两条游标链](candidate-archive-fixture.json)、[实页与正式顺序比较](candidate-archive-comparison.json)、[基线持久状态](baseline-archive-persistence.json)、[最终持久状态](candidate-archive-persistence.json)。
