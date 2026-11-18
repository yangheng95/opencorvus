# 已发布附件媒体身份验收

第 323 批，2026-11-19，本人独立调查。见[根因、共享机制审计和方案](../../records/2026-11/2026-11-19-attachment-published-media-identity.md)。使用隔离本机流式参与者，无外部模型和凭据。

- [有效原生会话的修改前后协议、原件及公开消息](baseline-runtime.json)
- [同一库正常重启后的复现](baseline-restart-runtime.json)
- [两项目串行建立及并发重复/不同媒体上传](baseline-shared-publication.json)
- [实际改写后的持久媒体回执](baseline-published-metadata.json)
- [正常退出后的只读库及旧文件部件](baseline-persistence-first-run.json)
- [本人所见：原正文仍可读取，不能替代引用一致性验收](baseline-original-still-readable.png)

102 字节原件从 `text/plain` 被重新发布为 `application/octet-stream`，同一 URL 的旧引用随即验证失败；原生前置 load 成功，之后 load/fork 和重启后均失败。resume 与普通下一轮正常，字节下载仍相同。两项目的并发错误亦在各自命名空间重现。独立网页 `chat` 角色加载问题和持久采集工具修正已在规格记录，不混入本次根因证据。

候选实施、跨进程检查、正式正向测试和最终桌面验收待完成。
