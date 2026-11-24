# 手动滚动后用量区间焦点的桌面证据

原始隔离开发服务 `41600/ui/`。Windows 桌面 1280 × 720，英文 100%，简体中文 160%。

| 基线截图 | 本人复核 |
| --- | --- |
| [英文月图初态](baseline-en-month-first-interval.jpg) | 11 月 1 日真实焦点和提示同屏。 |
| [英文月图滚轮后按方向键](baseline-en-month-arrow-moves-focus-offscreen.jpg) | 读到 11 月 2 日的新提示，图与实际焦点仍在屏幕外。 |
| [中文年图滚轮前](baseline-zh-year-last-day-before-wheel.jpg) | 已选真正 12 月 31 日，描边和日期同屏。 |
| [中文年图纵向滚轮后按 Home](baseline-zh-year-home-bucket-stays-offscreen.jpg) | 焦点已变为 1 月 1 日，屏幕仍是官方来源卡片。 |
| [中文年图横向滚轮后按 Home](baseline-zh-year-home-remains-horizontal-offscreen.jpg) | 选择仍为 1 月 1 日，图只显示 5 月之后的列，首日没被恢复可见。 |

[真实输入前后日期及位置](baseline-desktop-focus.json)和[四周期实际用量与项目持久状态](baseline-statistics-evidence.json)。
