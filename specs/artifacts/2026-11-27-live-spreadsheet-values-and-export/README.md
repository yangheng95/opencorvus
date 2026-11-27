# 可编辑销售表格与导出失败反馈证据

对应[规格与Recall](../../records/2026-11/2026-11-27-live-spreadsheet-values-and-export.md)。根因是共享作品动作只写日志；已接入当前卡片反馈，并让两个表格导出出口共用结构化大小错误。全部页面由本人真实交互、逐图查看，未使用UI自动化测试。

- 实际输入：[原任务](new-work.json)、[大范围核对任务](range-task-input.json)、[原始CSV](source.csv)。真实Sol读取后自然发布[普通两表payload](art_g0Vc8gdaZ00BYeqDlb3g-payload.json)和[大范围payload](art_g0Vc8huLy00mCG4xZXyM-payload.json)，没有SQL插入或浏览器对象注入。
- 基线：[明细](before-detail-sheet.png)、[汇总](before-summary-sheet.png)、[实际改值重算](before-live-recalculation.png)、[远端标记](before-far-cell.png)、[导出静默失败](before-export-limit.png)、[清空标记](before-cleared-far-cell.png)。[初始明细](before-details.csv)/[初始汇总](before-summary.csv)/[编辑汇总](before-edited-summary.csv)/[清空恢复明细](before-range-recovered-details.csv)来自实际浏览器下载。
- 第一候选：[占位符错误](candidate-placeholder-failure.png)已否证，未作为通过证据；随后仅修两语插值语法。最终：[中文原因](after-limit-zh.png)、[中文完整诊断](after-details-zh.png)、[稳定英语作品窗口](after-workspace-en.png)、[恢复导出](after-recovered-export-en.png)。[语言切换中间画面](after-limit-en.png)仅保留过程，不冒作稳定展开截图。
- 恢复后[英语改值重算](after-recalculation-en.png)、[切回中文保持编辑](after-recalculation-zh.png)。[恢复明细228字节](after-range-recovered-details.csv)与基线相同；[英语编辑CSV](after-summary-en.csv)和[中文编辑CSV](after-summary-zh.csv)均1049字节、逐字节相同，含30.25与37.6。CSV保留值，界面按格式显示37.60。
- [普通文档下载截图](after-document-download.png)、[实际4221字节原件](after-document-original.md)与既有项目报告相同，验证共享操作栏正常路径。
- 实际checker：[源码/持久数据/正式接口](check-facts.py)、[浏览器下载字节与业务值](check-downloads.py)；结果[run35](facts-run35.json)、[run36](facts-run36.json)、[run37](facts-run37.json)、[下载核对](download-facts.json)。原21文件/1804旧持久行保持、SQLite完整性ok，两新表原始payload仍35.60。
- [原错误类型合同失败](export-red.log)、[33项/38断言通过](export-green.log)、[初候选构建](candidate-build.log)、[最终构建](final-build.log)。日志仅归一化展示行尾空白；CSV保留原始下载字节，暂存blob逐项比较。
- 精确Sol流式审计：[run35](run35-model-audit.json)、[run36](run36-model-audit.json)、[run37](run37-model-audit.json)及[汇总](verification-summary.json)：14次HTTP200/settled/eof，三原句柄退出0、配对副本退役、三端口关闭。没有凭据、模型目录本体、加密推理或原私密历史副本。

复制失败及进行中来源切换只做共享代码审查；默认窄列的长注释裁剪未在本修复解决。本任务是应用内交互表格，不是原生Office或Excel重算验收。
