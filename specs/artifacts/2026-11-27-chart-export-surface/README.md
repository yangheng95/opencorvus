# 原生图表导出底色证据

关联[根因、影响及实施前方案](../../records/2026-11/2026-11-27-chart-export-surface.md)。

本人独立完成真实桌面操作和逐图人工复核；没有新增或运行界面自动化、组件/DOM（Document Object Model，文档对象模型）断言、快照或像素检查。浏览器拒绝本地文件导航后，独立SVG（Scalable Vector Graphics，可缩放矢量图形）仅用只读本地sharp渲染器查看，没有通过其他浏览器传输方式绕行。产品视觉结论来自隔离开发页面 `/ui/`，静态文件查看仅负责导出交付结果。

## 发现过程

- [原深色页面](before-dark-page.png)、[原透明下载](before-sales-review.svg)、[白色承载面失读](before-export-on-white.png)。
- [修改前默认与配置图](before-custom-backgrounds.png)、[配置底色被吞而顶层正常](before-custom-lower.png)。
- [第一候选旧背景重放](found-default-white-background.png)、[同候选配置与顶层底色](found-background-projection.png)。这些发现截图不属于最终通过版本。

## 最终原生页面

- [深色看板默认表面](accepted-dashboard-dark-top.png)、[配置蓝底和顶层绿底](accepted-custom-backgrounds.png)。
- [原Chart深色](accepted-chart-dark.png)、[同图浅色](accepted-chart-light.png)，五笔及区域汇总保持。
- [浅色华东3/28.25](accepted-dashboard-light-east.png)、[深色英语保持3/28.25](accepted-dashboard-dark-en-east.png)、[清除恢复5/35.60](accepted-dashboard-clear-all.png)。
- [原生框选深色交互记录](selected-native-legacy-dark.png)、[主题重建后浅色30.30/2](accepted-selection-light.png)。旧图作者明确白背景导致深色文字不匹配，前一图只证明交互，不声称视觉通过。

## 实际下载与本地查看

| 浏览器实际下载 | 字节 / 尺寸 | 归档原文件 | 人工查看 |
| --- | --- | --- | --- |
| visualization (5).svg | 17752 / 949×220 | [配置蓝底](config-background.svg) | [白色承载面](config-background-on-white.png) |
| visualization (6).svg | 27082 / 766×513 | [深色Chart](dark-sales-review.svg) | [白色承载面](dark-sales-review-on-white.png) |
| visualization (4).png | 80129 / 766×513 | [原生PNG](dark-sales-review.png) | 实际文件已人工查看 |
| visualization (7).svg | 26917 / 766×513 | [浅色Chart](light-sales-review.svg) | [白色承载面](light-sales-review-on-white.png) |

原文件与浏览器下载按真实字节核对，没有后处理产品导出；`*-on-white.png`仅为本地只读SVG呈现副本。没有哈希/像素判分门槛。[下载身份及元数据](native-downloads.json)保留具体对象与实际路径。

## 正式工具与数据证据

- [CSV原始来源](sales.csv)、[真实Sol发布payload（载荷）](published-dashboard.json)、[正式read/publish部分](tool-parts-run57.json)、[实际产物API（Application Programming Interface，应用程序接口）](api-artifact-run59.json)、[模型终态](task-status.json)。session `ses_hWk3v4UmiuIuz6byTk3B`、artifact `art_g0Vc9g8Lh00oK4FDYhNf`；不是模型自述或模拟产物。
- [修改前实际checker](facts-run57.json)、[最终实际checker](facts-run59.json)核对22原文件、2020旧持久行、原CSV每字段/Decimal汇总、样本HEAD及SQLite完整性。
- [汇总、三轮预检/排空/原句柄退出及限制](verification.json)：10次精确GPT-6.1 Sol流式请求均完整结算/流结束，服务正常退出、配对副本退役；最终类型/构建50.58秒、文档及架构检查通过。

## 范围限制与下一批

[旧图作者背景](legacy-chart-presentation.json)确实指定#FFFFFF。既有轴/标题主题强制优先级在这种作者背景上可能失配；新明确深底的浅色界面也可见作者浅轴色被覆盖。未改写历史payload，本批默认主题/导出底色通过不代表作者样式优先级已完整解决。下一批先调查这一共同机制，再决定实现。验收限桌面浏览器，未操作Office认证、用户外部编辑器或移动端。凭据、模型目录内容、完整数据库和加密推理没有归档。
