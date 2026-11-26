# 通用工作真实销售分析证据

本批用真实 Work（通用工作）对话完成销售分析，并补充筛选/排序时的完整表格下载范围说明。根因、实施及界限见[规格](../../records/2026-11/2026-11-27-work-sales-analysis.md)。所有页面截图均为本人实际交互取得并查看，不是自动化测试或截图基线。

- 原业务入口：[原生提交](run9-native-submission.png)记录点击后的初始提交过渡；[实际读取/复算执行](run9-work-running.png)才是进入真实 Work 会话的执行画面。
- 原交付本人复核：[展开五笔订单](run9-table-expanded.png)、[金额数值升序](run9-amount-ascending.png)、[中文退款筛选](run9-refund-filter.png)、[报告来源与统计](run9-report-expanded.png)、[分区及交付说明](run9-report-summary.png)。[原筛选下载菜单](run9-filtered-export-menu.png)只有文件名，截图保留菜单打开过渡，不能当作改进后效果。
- 改进后本人视觉通过：[中文内联](run10-inline-export-scope-zh.png)、[中文展开](run10-expanded-export-scope-zh.png)、[清空/原序恢复](run10-original-view-restored.png)、[1280×720 英文桌面](run10-desktop-english-scope.png)、[原任务 CSV 共享路径](run10-original-csv-scope.png)。已恢复中文和默认桌面视窗。
- [原业务检查](run9-delivery-check.json)、[候选检查及五次实际下载](run10-delivery-check.json)：从真实 HTTP 原工具/产物读取、CSV 与 Marked 报告表格建立数据证据；五笔净额 35.60、区域 28.25/7.35、退款/零金额各1。原六份项目文件与先前实际发布的原文件逐字节相同。
- `run9-published-artifacts.json` / `run10-published-artifacts.json` 是两份正式产物完整读取，候选与原发布逐字段相等；`run9-tool-parts.json` / `run10-tool-parts.json` 是四份原真实已完成工具片段，包含读取、复算和两个发布的输入/结果身份。没有伪造消息或预置正确产物。
- [原发布报告](report-published.md)、[浏览器下载归档](downloads/)保留实际字节；文件名中的 `(1)`/`(2)` 等是浏览器新下载名称，按点击前目录清单识别，未覆盖其他文件。表格筛选/排序时下载仍完整且按原序；原规范区域 CSV 为全部 59 字节。
- 下载目录的局部 `.gitattributes` 将 CSV 证据作为二进制原件保存，保留实际 CRLF 换行，防止仓库通用文本转换改变所记录的 308/59 字节；不改变产品文件或下载行为。
- [真实 Provider 汇总](provider-summary.json)：10 次实际流式 `gpt-6.1-sol` 请求，业务会话6次、两个服务预检各2次，全部 200 / settled / eof；两服务原句柄正常结清退出码0，成对凭据/目录副本实际退役。`run9/run10-model-request-audit.json` 与 `run9/run10-runtime.json` 保留脱敏元数据及收据，没有凭据或模型正文。
- [实际构建身份](run10-served-assets.json)、[类型日志](overlay-types.log)、[构建日志](overlay-build.log)仅为辅助静态/对象身份检查，不能替代本人截图或真实下载。
