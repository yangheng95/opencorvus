# 作者图表配置优先级证据

关联[Recall、根因及实施前方案](../../records/2026-11/2026-11-27-chart-author-style.md)。本人完成真实开发页面原生操作并逐图人工复核，未新增或运行UI（User Interface，用户界面）自动化、DOM（Document Object Model，文档对象模型）/组件断言、快照或像素测试。仅归档正式工具/数据、实际下载、人工截图与脱敏运行元数据；凭据、模型目录、完整数据库和加密推理未归档。

## 作者轴色与真实新设计

- [修改前深底上的暗轴](before-explicit-axis-colors.png)、[同一作者配置现在清楚](accepted-explicit-axis-colors.png)，作者明确#eef2ff得到保留。后图是实际行内页面，不将一次不存在的关闭按钮操作当作展开成功。
- [新报表浅色界面](accepted-fixed-light.png)、[深色界面保留完整浅色设计](accepted-fixed-dark.png)、[英语重建保持原设计](accepted-fixed-dark-en.png)。背景#f4f7fb、前景#1b2430、轴字号13、标题18及作者区域柱色由同一原生config呈现。
- [原生退款明细](accepted-fixed-refund-tooltip.png)显示A003/华东/-2.05/退款，备注来源真实。
- [旧看板正常汇总及五订单](accepted-old-dashboard-all.png)、[原生退款筛选1/5及-2.05](accepted-old-dashboard-refund.png)。只复验这些可见区域，不声称本次旧看板每张图都逐张新截图。
- [旧框选两笔30.30](accepted-old-brush-selected.png)、[语言重建后中文仍保持](accepted-old-brush-zh.png)。均为原生拖选/展开/关闭及语言菜单操作，无脚本注入交互状态。

## 实际原生下载

| 实际浏览器文件 | 身份与尺寸 | 归档及人工查看 |
| --- | --- | --- |
| visualization (8).svg | 33802字节，911×562 | [原生SVG（Scalable Vector Graphics，可缩放矢量图形）](fixed-sales-report.svg)、[本地只读呈现](fixed-sales-report-on-white.png) |
| visualization (5).png | 86588字节，911×562 | [原生PNG（Portable Network Graphics，便携式网络图形）](fixed-sales-report.png) |

[下载身份元数据](native-downloads.json)。原文件与实际下载字节一致，本地呈现和实际PNG均已人工查看。未对产品导出后处理，也未用其他浏览器方式绕行此前被拒绝的file导航。

## 正式执行、数据与恢复证据

- [sales.csv](sales.csv)、[实际发布payload（载荷）](published-chart.json)、[正式read/bash/publish部分](tool-parts-run61.json)、[实际产物API（Application Programming Interface，应用程序接口）](api-artifact-run61.json)、[主任务终态](task-status.json)。session `ses_hrwcHDrDJe7cezsinVXK`、artifact `art_g0Vc9mmkV00BbTrQxUBF`；新作品来自实际Sol任务，未合成消息或模拟发布。
- [实际checker（检查器）](facts-run61.json)核对四个原字段、派生订单类型、全部5/35.60、华东3/28.25、华南2/7.35，22原文件/2042旧持久行、样本HEAD、SQLite完整性与实际下载身份均通过。[此前同一Dashboard持久声明](before-published-dashboard.json)为作者轴色证据。
- [正向提示/工具集成检查](prompt-tests.log)3项/5断言，[类型](typecheck.log)、构建51.72秒/renderer公开表面、文档353操作/26组及架构20文档通过；这些不替代截图。
- [物理流与活动身份](physical-stream-outcomes.json)明确memory活动attempt0读取ECONNRESET，attempt1完整EOF（End Of File，流结束）；[正式记忆接口](memory-retry-result.json)为revision30/idle/pending0/dropped0。错误保留，不能把10次HTTP200说成10次物理EOF。
- [汇总及原句柄退出](verification.json)：run60/61合计10次精确GPT-6.1 Sol流式请求、9 EOF/1已恢复读取错误，全部物理读取结算；原服务正常排空、配对副本退役，自有页面关闭。没有调度/终态残留事实。

## 限制

缺少相配前景的旧固定底色仍属于原作者不完整设计，本批不猜色或改写历史。只验收实际呈现的设计/交互，未覆盖每个原生配置组合、每张历史图、Office、移动端或用户外部编辑器。
