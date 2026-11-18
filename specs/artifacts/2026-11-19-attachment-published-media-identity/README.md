# 已发布附件媒体身份验收

第 323 批，2026-11-19，本人独立调查。见[根因、共享机制审计和方案](../../records/2026-11/2026-11-19-attachment-published-media-identity.md)。使用隔离本机流式参与者，无外部模型和凭据。

- [有效原生会话的修改前后协议、原件及公开消息](baseline-runtime.json)
- [同一库正常重启后的复现](baseline-restart-runtime.json)
- [两项目串行建立及并发重复/不同媒体上传](baseline-shared-publication.json)
- [实际改写后的持久媒体回执](baseline-published-metadata.json)
- [正常退出后的只读库及旧文件部件](baseline-persistence-first-run.json)
- [本人所见：原正文仍可读取，不能替代引用一致性验收](baseline-original-still-readable.png)

102 字节原件从 `text/plain` 被重新发布为 `application/octet-stream`，同一 URL 的旧引用随即验证失败；原生前置 load 成功，之后 load/fork 和重启后均失败。resume 与普通下一轮正常，字节下载仍相同。两项目的并发错误亦在各自命名空间重现。独立网页 `chat` 角色加载问题和持久采集工具修正已在规格记录，不混入本次根因证据。

候选保留原发布媒体，同媒体去重或修复继续可用，另一媒体得到命名 409。正式聚焦检查 56 项、314 断言、7 文件通过；SDK 正式生成、前后端/SDK 类型、路由、文档、架构、两语言 3229 键、样式及构建/渲染器检查均通过。

- [基线真实跨进程改写](baseline-cross-process.json)、[候选跨进程去重与明确冲突](candidate-cross-process.json)
- [候选原生/网页真实会话及首次、重复、冲突上传](candidate-runtime.json)
- [候选同库重启后的加载、派生、恢复与原引用提交](candidate-restart-runtime.json)
- [候选双项目相反媒体首发及并发重复/冲突](candidate-shared-publication.json)
- [三次实际浏览器文件选择器上传响应](browser-upload-responses.json)
- [首次实际下载](browser-download.json)、[重启和重试后实际下载](browser-download-after-retry.json)：均原名、102 字节、原始字节相同
- [最终基线库](baseline-persistence-final.json)、[最终候选库](candidate-persistence-final.json)
- [最终基线媒体回执](baseline-published-metadata-final.json)、[最终候选媒体回执](candidate-published-metadata-final.json)
- [22 次精确本机流式请求与完成](model-stream-events.json)、[最终验证及自有服务正常退出](final-validation-summary.json)

以下页面均由本人通过真实桌面坐标/键盘操作，逐张实际查看；没有 DOM 或截图自动断言：

- [候选原正文展开](candidate-original-readable.png)
- [首次复核发现常规弹窗泄露冗长技术诊断，作为修正前证据](candidate-composer-media-conflict-en.png)
- [修正后的英文摘要](candidate-localized-conflict-en.png)
- [修正后的中文摘要](candidate-localized-conflict-zh.png)
- [中文展开详情保留真实 HTTP 409 和诊断](candidate-conflict-details-zh.png)
- [重启和重试后的中文正文及下载入口](candidate-original-after-retry-zh.png)

最终候选 4 会话、18 消息、52 部件、7 文件部件，提示所有权计数 0；所有权和终态证据取自只读持久库及实际协议。自有 Chrome、ACP 和模型服务正常关闭，40130/40132/40134 已关闭。只使用隔离脚本模型参与者证明传输和数据合同；没有外部模型或凭据。旧版已改写媒体的自动恢复、HTTP 原件媒体头、SVG 派生及网页角色 ACP 加载仍需独立调查。
