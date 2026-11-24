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
