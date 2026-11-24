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

候选 `41662/ui/` 加载 `main-B2Tql0pN.js`。同一桌面与缩放设置，人工查看下列原图。

| 候选截图 | 观察 |
| --- | --- |
| [英文无词入口](candidate-en-full-list-hint.jpg) | 空搜索已有可用键盘提示，显示默认完整列表。 |
| [英文完整列表上翻](candidate-en-full-page-focus.jpg) | SC-25 的标题、全局范围、暂停状态和同行操作均在焦点框内。 |
| [英文对应详情](candidate-en-paged-detail.jpg) | 原 SC-25 显示全局收件箱、暂停、完整原提示和无运行历史。 |
| [中文仅筛选入口](candidate-zh-filter-only-hint-160.jpg) | 空搜索保留「已暂停／项目」和翻页说明。 |
| [中文 Escape 返程](candidate-zh-filter-only-escape-retains-160.jpg) | 从分页后的计划回到搜索，两个筛选依然选中。 |
| [中文仅筛选上翻](candidate-zh-filter-only-page-focus-160.jpg) | SC-02 完整聚焦，显示计划名、项目和暂停状态。 |
| [中文对应概要](candidate-zh-filtered-detail-overview-160.jpg) | 回车后从 SC-02 概要起点开始，返回键聚焦。 |
| [中文真实项目及提示](candidate-zh-filtered-detail-project-and-instruction-160.jpg) | 详情下方显示实际绑定项目路径和原提示。 |
| [中文仅筛选单项](candidate-zh-global-active-single-160.jpg) | SC-27 是实际活动的全局项，显示本地化的 2099 年时间。 |
| [中文仅筛选零项](candidate-zh-filter-only-empty-160.jpg) | 空项目结果保留输入焦点并提供清除筛选。 |

[实页焦点及筛选状态](candidate-desktop-focus.json)、[完整和各筛选的实际顺序与详情](candidate-desktop-order.json)、[正式接口保存的精确定义](candidate-definitions.json)。
