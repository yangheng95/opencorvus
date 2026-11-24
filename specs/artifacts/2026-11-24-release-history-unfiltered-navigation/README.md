# 完整版本历史键盘浏览的桌面证据

原始隔离开发服务 `41610/ui/`，资产 `main-7M2rr2X8.js`。Windows 1280 × 720 英文 100%、简体中文 160%。

| 基线截图 | 本人复核 |
| --- | --- |
| [英文全部版本](baseline-en-all-versions-start.jpg) | 全部 90 项并聚焦安装版。 |
| [英文未筛选下翻](baseline-en-unfiltered-page-leaves-install-row-behind.jpg) | 可见其他版本，键盘焦点仍在屏幕外的安装版。 |
| [英文下翻后回车](baseline-en-enter-after-page-opens-old-focus.jpg) | 实际打开刚被滚离屏幕的旧焦点 v0.1.53。 |
| [中文未筛选下翻](baseline-zh-unfiltered-page-leaves-row-offscreen.jpg) | 已浏览 v0.1.52 等条目，真实焦点仍在屏幕外。 |
| [中文下翻后回车](baseline-zh-unfiltered-enter-opens-installed-version.jpg) | 实际仍打开离屏的当前版本 v0.1.54。 |
| [中文筛选后下翻](baseline-zh-filtered-history-pages-to-real-version.jpg) | `0.1.` 的 55 条路径中，Page Down 正确移动到 v0.1.51，整行可读。 |

[键盘动作与实际焦点位置](baseline-desktop-focus.json)、[完整版本与发布日期](baseline-release-versions.json)。

最终服务 `41612/ui/`，资产 `main-BRLloceo.js`。下列桌面截图均已本人复核。

| 最终构建截图 | 观察 |
| --- | --- |
| [英文全部版本和提示](candidate-en-first-boundary-with-empty-search.jpg) | 空搜索显示 90 项、键盘说明及首行边界。 |
| [英文全历史翻页](candidate-en-focus-follows-full-history-page.jpg) | 实际版本 v0.1.46 的四边焦点和日期完整可读。 |
| [英文打开当前焦点](candidate-en-opens-the-version-in-focus.jpg) | Enter 显示 v0.1.46 的真实英文详情。 |
| [中文键盘说明](candidate-zh-navigation-guidance-and-90-versions.jpg) | 空搜索明确显示完整版本数和本地化说明。 |
| [中文完整历史末项](candidate-zh-oldest-is-visible-and-page-edge-stable.jpg) | 空搜索向上直接进入真正最早版本，并在末边界停驻。 |
| [中文向较新的版本上翻](candidate-zh-full-history-page-up-preserves-entire-row.jpg) | v0.0.35beta.4 行、旧日期和完整焦点可见。 |
| [中文旧版详情](candidate-zh-opens-authored-historical-release.jpg) | 焦点是同一旧版标题，正文与日期来自实际日志。 |
| [中文精准筛选](candidate-zh-exact-filter-keeps-single-version.jpg) | 单项 v0.1.25 的实际边界和日期可读。 |
| [中文空结果](candidate-zh-zero-results-keeps-current-entry.jpg) | 保留实际空状态及当前版本按钮。 |
| [中文清除后恢复](candidate-zh-clear-shows-all-versions-and-guidance.jpg) | 实际返回空输入、90 项和键盘说明。 |

[动作、焦点、真实日期和语言](candidate-desktop-focus.json)、[英文完整版本](candidate-en-release-versions.json)、[中文完整版本](candidate-zh-release-versions.json)、[实际列表与随包源比较及持久状态回执](candidate-version-comparison.json)。
