# Word 标题分页真实证据

原问题、方案、根因和验收边界见[规格](../../records/2026-11/2026-11-27-docx-heading-pagination.md)。本批实现原生标题同页语义、唯一Paged.js预览分页、A4实际几何和连续标题链，并补齐同一技能及工具的当前能力说明。

- `run15-original-task-messages.json`、`run15-actual-tool-parts.json`：原任务因说明缺口未交付的真实记录。
- `run16-letter-layout-finding.json`、`run16-letter-preview.pdf`、`run16-letter-page-*.png`：纸张尺寸未通过的实际产物，保留原生源正确/预览错误的事实，不算最终验收。
- `native-docx.log`：初期全文及标题检查通过13断言；该阶段遗漏纸张尺寸，不能作为最终结果。`native-heading-chain-red.log`记录补A4后连续标题链的实际失败，`native-docx-a4.log`为最终20断言通过的真实原生生命周期。
- `stress.pdf`、`stress-2.png`、`stress-3.png`、`long-paragraph-probe.json`：5463字符单长段落三页完整覆盖的独立文档实验；本人查看图片，不是应用界面自动化。
- `heading-chain-probe.pdf`、`heading-chain-probe-page-2.png`：相邻标题链与后续长正文在A4中的实际排版实验。
- `pagedjs-package-evidence.json`、`embedded-pager-probe.json`：官方稳定包来源和真实可执行文件资源嵌入结果；脚本、原MIT许可与版本一起嵌入，无远端脚本。

最终真实任务通过，见[独立检查](run18-delivery-check.json)、[规范源](销售经理审阅稿-分页修订.docx)、[A4预览](销售经理审阅稿-分页修订-preview.pdf)、[正式产物](run18-delivered-artifact.json)、[真实工具](run18-actual-tool-parts.json)、[桌面第一页](run18-native-a4-page-1.png)、[桌面第二页](run18-native-a4-page-2.png)、[最终交付记录](run18-native-final-delivery.png)及[运行汇总](runtime-summary.json)。8016字节原件保持，20段全文、7标题关系、两页A4、两次实际下载、391行既有记录和8原项目文件均验证通过；四个自有服务退出0，44次请求全部精确流式Sol并正常结清。这里不包含凭据或加密推理。
