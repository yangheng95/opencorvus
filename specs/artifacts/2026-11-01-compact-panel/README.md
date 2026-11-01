# 紧凑面板截图

来源为隔离开发服务的真实 `/ui/`，默认1280×720，人工交互、截图及视觉复核；未运行UI自动化测试。原图均为浏览器JPEG。方案与验收见[记录](../../records/2026-11/2026-11-01-compact-panel.md)。

## 修改前

- [01 首页](01-before-home.jpg)：标题/工具/输入/快捷操作分散居中，顶部留白过多。
- [02 常规设置](02-before-general.jpg)：大标题和大区组间距使四个普通设置组占满首屏。
- [03 外观](03-before-appearance.jpg)：页面与字段/控件比例不协调，导航分组缩进不一致。
- [04 看板](04-before-mission.jpg)：头部/筛选/内容缺少清晰面板边界。
- [05 计划任务](05-before-scheduled.jpg)：两行筛选及建议之间存在多段留白，身份/时间没有固定列。
- [06 用量](06-before-usage.jpg)：标题、身份、指标与热图叠加大间距。
- [07 服务列表](07-before-providers.jpg)：一屏仅约七个Provider，导航需独立长距离滚动。

- [08 持续目标](08-before-goal.jpg)：原快捷目标交接与表单。

## 最终设计

最终构建采用14px正文、24px页标题、30/32px操作/表单尺度，紧凑来自分组和对齐。以下原图均已人工查看；没有改变默认1280×720视口。

| 原图 | 验证对象 |
| --- | --- |
| [32 真实执行中](32-design-real-stream.jpg) | 最终构建真实第三轮文件任务及工具流 |
| [33 外观](33-design-appearance-en.jpg) / [34 通用](34-design-general-en.jpg) | 英文深色设置分组、行与操作列 |
| [35 真实完成](35-design-real-task-result.jpg) | 第三轮真实最终回复；图中保留当时的Settings悬浮提示 |
| [36 首页](36-design-home-en.jpg) | 深色标题/工具头区、输入与等高快捷项 |
| [37 服务列表](37-design-providers-zh.jpg) | 中文列表密度与导航 |
| [38 定时任务](38-design-scheduled-zh.jpg) / [39 实际表单](39-design-scheduled-form-zh.jpg) | 同行筛选、建议固定列、两列表单 |
| [40 看板](40-design-mission-zh.jpg) | 空看板几何与分界，仅视觉范围 |
| [41 通用浅色](41-design-general-light-zh.jpg) / [42 首页浅色](42-design-home-light-zh.jpg) | 中文浅色层次、分组及文字可读性 |
| [43 预览加载](43-design-real-delivery-preview-light.jpg) / [44 最终预览](44-design-delivery-preview-ready.jpg) | 真实JSON文件并排预览、来源和左对齐变更列表；44为语法高亮完成态 |

## 调查过程

09—14为首轮紧凑候选：首页、Goal、General、计划列表/表单、Usage；13暴露表单仍占多屏。15—19为第一次真实任务的提交、工具流和最终回复，18仍为执行中，暴露pending补丁原始JSON挤占摘要。20—22为中间版文件列表/中文设置/表单。23仍是当时当前会话，不能当作工具展开证据；24跟进截图时已完成，不能当作执行中证据。25实际展开工具，26报告源码，27报告渲染，28—29浅色设置/报告，30为部分表格，31为完整真实四行结果。用户指出首候选审美不合格后重新设计；09—31保留调查事实，不作为最终视觉稿。

## 真实任务证据

通过正式`/ui/`入口完成三轮Code Chat：修复真实统计程序并生成CSV/报告→追加中文复核→生成JSON清单并实际预览、下载。没有合成会话或用静态夹具冒充执行。

- [输入说明](task/README.md)、[10条订单](task/orders.csv)、[模型修复代码](task/sales_summary.py)、[实际CSV](task/summary.csv)。
- [首轮报告](task/REPORT.md)、[第二轮报告](task/REPORT-followup.md)、[最终报告](task/REPORT-final.md)、[真实交付清单](task/delivery.json)。
- [独立行为检查器](task/checker.py)、[首轮计算](task/verification.json)、[最终文件/下载/公开消息事实](task/final-verification.json)。检查器可从仓库根执行：`python specs/artifacts/2026-11-01-compact-panel/task/checker.py specs/artifacts/2026-11-01-compact-panel/task`。
- [首轮Provider审计摘要](task/provider-summary.json)、[第二轮摘要](task/followup-provider-summary.json)、第三轮摘要包含于最终事实。共30次真实流式请求，精确模型gpt-6.1-sol、全部HTTP 200；reader未绑定EOF观测，不能把HTTP/stream标志作为流完整读取证明。

独立程序验证四组金额25.29、-1.25、44.00、0.30及CSV排序、两位小数字符串。最终清单实际由界面下载，306字节与项目文件相同，JSON内容另行解析核验。凭据及完整Provider原始日志不进入此目录。Mission/Task生命周期、定时执行、移动端及最终pending精确瞬态不属于本次已完成证据。
