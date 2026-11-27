# 图表主题、尺寸与悬停明细证据

- 关联[修改前根因、影响与方案](../../records/2026-11/2026-11-27-chart-theme-text.md)。run50旧Dashboard真实深色截图已人工复核，未指定颜色的汇总/金额text mark为black，坐标已随产品变亮；旧Chart副标题同样缺少主题前景。
- 共享缺省text和subtitle前景接入产品主题，显式配置/mark/encoding语义色仍走原生优先级。Chat/Work与两个发布工具入口共享一段主题创作指导，不改写历史payload（载荷）。原生状态重建省略根画布尺寸，避免把fit后的绘图区反复当作新画布；每View的原生Tooltip通过唯一ID和现有top-layer归属函数挂载，原作品toggle更新归属，卸载与异步完成均清理自己的元素。
- 修改前/发现截图：`before-dashboard-dark.png`黑色缺省文字；`found-dashboard-light-sizing.png`反复重建后高度86/25、图形重叠；`found-tooltip-workspace.png`原生明细在body被作品顶层遮挡；`found-inline-tooltip-offset.png`初版同父挂载在虚拟列表contain布局下偏移。`inline-tooltip-ancestors.json`为对应只读祖先包含块事实。
- 最终run54的15张`accepted54*.png`均实际查看：行内A002/20.20/中文客户；作品窗口A003/-2.05/退款、A004/0.00/免费样品、华东28.25/3；新图深色全貌及明细；看板深色多View的逐单和区域明细、主题/语言往返、英语退款1/5/-2.05；上批A001+A002框选30.30/2及主题/语言往返保持。截图是人工视觉证据，不是自动化基线。旧作者显式#111827金额标签仍保留，深色历史图的这些标签未宣称被主题缺省修复。
- `published-chart.json`来自真实Sol正式发布，`task-status.json`保存finish=stop及正式工具ID（Identifier，标识符）。`api-artifact-run54.json`和`api-publication-run54.json`来自最终开发服务实际接口；`facts-run54.json`/`check-facts.py`核对源字段、整数分、21项目文件/1938旧行与发布输入输出。只读原生归属/框选文字和浏览器错误日志仅作补充，不替代截图。
- `sales-review.svg`是原生菜单实际下载的27035字节、766×513文件，保留5笔/35.60及全部订单和区域金额；`sales.csv`是181字节真实源文件。文件身份按实际字节比对，无可变源码摘要作为验收。SVG内容检查不冒充另一个文件查看器的视觉复核。
- `verification.json`含14次精确Sol流式200/全部settled/eof（读取结算/流结束）、配对副本清理、正常退出和聚焦检查结果。3项后端prompt（提示）正向集成通过、5条断言；类型、样式令牌、构建54.05秒和renderer（渲染器）公开表面检查通过。只归档相关小日志，完整构建输出在仓外。
- 未新增或运行UI自动化；ProjectDeliveries模态投影仅代码审计，本批人工交互为消息产物行内及原生作品窗口，未扩展移动端和Office。凭据、模型目录及含加密推理的数据库完整副本只留仓外，原有177项工作区更改未混入交付。
