# 销售 Word 审阅稿真实证据

任务、根因与未完成的分页线索见[规格](../../records/2026-11/2026-11-27-sales-document-delivery.md)。本批修复共享Office检查器将Info当作失败的问题，真实Sol继续交付同一原稿，所有截图均由本人查看。没有合成交付、消息或收据，不含凭据。

- [可编辑 Word 原件](销售经理审阅稿.docx)7997字节、[两页 PDF 预览](销售经理审阅稿-preview.pdf)149493字节；20段/1218汉字，五笔订单及净额35.60。
- `run13-native-request.png` / `run13-blocked-delivery.png` / `run13-office-tool-parts.json`：原生初次请求、实际阻断和三个原Office工具，其中六条Info被误拒；没有将初次源保存冒充最终交付。
- `run14-native-recovery-request.png`、`run14-office-tool-parts.json`、`run14-delivered-artifact.json`：同一真实会话正常继续，旧失败保持、同一规范源自然发布。
- `retained-information-report.json`：成功校验中的六条Info与原失败报告逐字段相同；原文、路径和金额没有改写或隐藏。
- `run14-source-read.json` / `run14-preview-read.json` / `run14-delivery-check.json`：OOXML精确正文/样式、按正式Unicode视觉等价映射的两页正文覆盖、真实最终收据与两份浏览器下载核对、210条原历史及七份原项目文件保留。PDF提取中三处radical码点与源不同，不能声称码点一致。
- `run14-validated-page-*.png` / `run14-delivered-page-*.png`：实际校验及最终发布的两页图片；各页字节对应。第一页末节标题与正文分在两页，是下一批明确待调查的排版问题。
- `run14-native-preview-*.png` / `run14-native-download-menu.png`：真实桌面展开、逐页/末段、缩放、中英文、实际原件及PDF下载入口；验收后恢复中文并收起。没有界面自动化测试、截图基线或像素断言。
- `issue-red.log` / `issue-green.log` / `native-lifecycle.log` / `backend-types.log`：旧误拒红例、12项正向合同、三格式真实文件生命周期及类型检查；这些与真实模型/人工视觉证据分别陈述。
- `runtime-summary.json`、两份 `*-model-request-audit.json` / `*-runtime.json`：29次精确Sol流式请求，25次业务及4次预检，全200/源读取结清EOF；两个原句柄退出0、服务关闭、成对凭据/目录副本退役。`run14-served-build.json`只证明实际前端身份，纯后端修复未重新构建UI。

证据中的 localhost 地址为当次实际服务来源，现已正常关闭。当前未声称原生Word像素一致性或章节标题分页质量全部完成。
