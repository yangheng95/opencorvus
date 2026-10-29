# 文本编码与结构化附件实页证据

2026-10-29，单 agent，真实隔离开发 serve `/ui`，普通构建，原默认 1280×720 视口。没有 UI 自动化测试或像素断言。每张均为真实页面原图，已实际呈现并人工查看。

- [方案、Recall、根因与交付边界](../../records/2026-10/2026-10-29-text-encoding-journey.md)
- [实际运行、模型与正常退休](runtime.json)：38353 五个 gpt-6.1-sol 流式 HTTP200/EOF 请求（含 preflight），38354 配对认证但模型预算0、无新增请求；累计793。
- [数据库、原件、真实工具与下载](data.json)：schema9/92表，原114655旧行除四项已解释记忆/过期容量变化外精确，回看116026旧行全精确；五份实际下载原字节、六份持久附件和11份旧输入核对。
- [聚焦检查与限制](checks.json)：九项纯字节正向测试、最终类型/build/i18n/docs/架构检查。初次类型检查发现下载组件提取遗漏的三个媒体调用，已修复并重新构建；最终实页只使用修复后的 main-D7log08P.js。

| 原图 | 实际观察 |
| --- | --- |
| [01](01-before-utf16le.png) | 修改前 UTF-16LE 中文/emoji乱码及NUL |
| [02](02-before-utf16be.png) | 修改前 UTF-16BE 同一问题 |
| [03](03-before-invalid.png) | 修改前非法UTF8被静默替换，无错误摘要/下载 |
| [04](04-before-json.png) | 原UTF8 JSON内容正确 |
| [05](05-json-answer.png) | 自然发送的真实JSON、read工具、Sources及完成回复 |
| [06](06-json-history.png) | 最终版本真实JSON历史、原文与下载 |
| [07](07-after-utf16le.png) | 最终LE中文/emoji与下载 |
| [08](08-after-utf16be.png) | 最终BE中文/emoji与下载 |
| [09](09-after-invalid-en.png) | 英文明确编码错误和取回原件入口 |
| [10](10-after-invalid-zh.png) | 中文错误、下载及关闭 |
| [11](11-after-unicode-zh.png) | 中文界面、Unicode原文与键盘末尾 |
| [12](12-binary-download.png) | 既有gzip非文本原件下载 |
| [13](13-json-source.png) | Sources打开真实JSON物理原件，只读 |
| [14](14-pdf-regression.png) | 既有PDF实际呈现第1页，保持折叠入口与分页控件；未宣称完整两页复核 |
| [15](15-image-regression.png) | 既有JPEG全图预览 |
| [16](16-json-history-zh.png) | 跨项目返回后的中文JSON历史与下载，Chat身份一致 |

新QA文本未发送，均实际移除；只JSON产生真实消息。复制/归档、新编码FilePreviewArtifact、页面内UTF8 BOM/非法UTF16、Office/native picker和短视口没有独立验收，不宣称覆盖。纯字节测试覆盖BOM/非法UTF16；后端read工具、文件编辑与保存编码合同不变。

旧未发送gzip副本有一对文件已回收；源码中真实bootstrap调用和60秒保护期、其未持久化身份及旧namespace/输入字节已核对，初始dev.log未保留精确回收时刻。此处明确标为依据代码与事实的推断，不伪称有对应GC日志。所有持久FilePart原件仍可访问。
