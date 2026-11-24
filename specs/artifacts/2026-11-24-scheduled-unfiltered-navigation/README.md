# 完整和仅筛选定时任务的桌面证据

基线真实 `41660/ui/` 加载 `main-C_f1Yhct.js`，Windows 桌面 1280 × 720。英文 100%，简体中文 160%。

| 基线截图 | 观察 |
| --- | --- |
| [英文未筛选下翻](baseline-en-full-list-detached-focus.jpg) | 正文已滚到其他计划，原 SC-04 的聚焦行离开视口。 |
| [英文回车打开原计划](baseline-en-full-enter-opens-original.jpg) | 详情仍打开原 SC-04，显示暂停状态、项目和原指令。 |
| [中文仅筛选下翻](baseline-zh-filter-only-detached-focus-160.jpg) | 「已暂停／项目」中焦点仍在离屏 SC-26。 |
| [中文仅筛选 Escape 后重开](baseline-zh-filter-only-escape-resets-160.jpg) | 两项筛选均恢复默认值。 |
| [中文相同交集的有词对照](baseline-zh-filter-with-query-page-control-160.jpg) | 仍是同样 13 条计划，下翻后实际聚焦可视的 SC-02。 |

[实际焦点和正文矩形](baseline-desktop-focus.json)、[正式接口保存的精确定义](baseline-definitions.json)。
