# 销售工作簿真实交付证据

计划、根因分析和完整边界见[规格](../../records/2026-11/2026-11-27-sales-workbook-delivery.md)。本批从真实 `sales.csv` 自然完成可编辑 Excel 交付，并改进页面缺少当前 PDF 预览文件名的问题。没有伪造工具、产物或收据；所有截图均由本人查看，不是界面自动化测试。

- [实际 XLSX 原文件](销售核对.xlsx)（6793字节）与[三页 PDF 预览](销售核对-preview.pdf)（389261字节）：订单明细、区域汇总、统计说明；五笔订单/净额35.60、退款和零金额各一笔。
- `run11-initial-workbook-read.json`、两份 `*-workbook-check.json`：openpyxl真实单元格/数值及布尔类型、最终规范收据、原33条数据库事实/6份项目文件保留和两轮四份真实浏览器下载核对。
- 两份 `*-office-tool-parts.json`、`*-delivered-artifact.json`：真实生成、检查、校验、交付工具及同一发布产物；`run11-validation-output.json` / `run11-validated-sheet-*.png` 是模型校验工具的实际多模态输出及本人查看的规范渲染。
- `run11-native-followup.png`、`run11-preview-sheet-*.png`：原生请求及修复前逐页预览；初始页面未显示实际PDF文件名。`run12-preview-filename-zh.png` / `run12-inline-preview-filename-zh.png` / `run12-preview-filename-en.png`：修复后的展开/内嵌、中英实际文件身份。
- `run12-desktop-720-*.png` / `run12-download-identities-en.png`：1280×720桌面下的首页、长表顶部与末行、固定工具栏和两个真实下载项。验收后已恢复默认尺寸、简体中文并收起产物。
- `runtime-summary.json`、两份 `*-model-request-audit.json`：20次真实Work业务请求及4次预检，共24次，精确Sol/流式/200/读取结清EOF。两份 `*-runtime.json`：原进程退出码0和成对凭据/目录副本退役，端口已关闭，不包含凭据内容。
- `run12-served-build.json` 仅证明实际页面使用本批构建；`overlay-types.log` / `overlay-build.log` 为常规类型和构建检查，不能替代前述实际业务及人工视觉复核。

服务已正常关闭，证据中的 localhost 地址为当次真实来源，不是常驻预览链接。公开能力限本次三个字面值工作表，未验收公式、宏或原生 Excel 桌面编辑。
