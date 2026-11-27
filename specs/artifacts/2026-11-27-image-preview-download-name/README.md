# 图片预览下载名称真实证据

对应[规格与 Recall](../../records/2026-11/2026-11-27-image-preview-download-name.md)。全部页面由本人真实交互并逐张看图，无UI自动化测试。

- 修复前[预览现场](before-preview.png)/[实际下载名](before-download.json)；候选[首图](after-preview.png)、[第二图](after-second-preview.png)、[文档相对图片](document-image-preview.png)、[文件编辑器图片](editor-image-preview.png)、[截图浏览器](screenshot-browser.png)、[截图附件预览](screenshot-attachment-preview.png)。图片说明原文与下载身份分别保留。
- [实际下载与历史检查](download-and-history-check.json)：6次候选下载正确使用已声明名称，原图字节相同；15原文件/884原历史行/完整正式产物保持。项目仅按方案新增[普通业务审阅文档](project-inputs/图片审阅.md)及其真实规范图副本，用于从实际编辑器打开相对图片。
- [前端类型](overlay-types.log)、[正常构建及公开界面检查](overlay-build.log)；构建警告原样保留。语言3337键/两语言、CSS令牌、当前文档及架构索引检查通过，不替代截图复核。
- [运行总结](runtime-summary.json)、两轮实际请求审计 [run24](run24-model-request-audit.json)/[run25](run25-model-request-audit.json)、运行时 [run24](run24-runtime.json)/[run25](run25-runtime.json)、原句柄退出 [run24](run24-process.json)/[run25](run25-process.json)：4次精确流式Sol全部为预检，业务请求0；原始句柄均正常退出0，端口关闭、成对副本退役。

未访问被策略拒绝的内部浏览器下载页，未采用其他浏览器通道绕过；磁盘核对限于本次实际下载目标。PowerPoint原生编辑数据仍未验证，账户向导未操作。
