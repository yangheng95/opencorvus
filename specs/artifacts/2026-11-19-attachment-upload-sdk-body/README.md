# SDK 原始附件上传的实际证据

本人独立调查与验收。项目、服务、浏览器及原件均为自有隔离样本；不使用 UI 自动化或外部凭据。

- [基线实际 SDK 请求与原始 HTTP 对照](baseline-uploads.json)：普通 `body: Blob` 参数被当前生成方法遗漏，三个 SDK 请求均为 400；同服务的原始请求保存 31 字节二进制、零字节文本和 100 字节 PNG。
- [隔离生成试验的接口输入](upload-probe.json)：使用已安装的官方 0.97.3 生成器和相同配置，产生必填 `Blob | File` 及原始字节序列化配置。最终实现应以正式生成的 SDK 和真实行为为准。
- [首次候选实际请求](first-candidate-uploads.json)：完整生成已经完成，但共享参数清理仍删除明确的 Blob，三个实际 SDK 上传继续失败；这次失败没有作为通过证据。
- [最终实际 SDK 上传](candidate-uploads.json)：同样的三个调用全部为 200，31、0、100 字节与原件一致，明确类型和原名均保留。
- [实际空配置及对话历史](candidate-conversation.json)：明确空 JSON 正确到达配置入口，原模型保持为 `acp-review/local`；真实用户消息持有三个上传引用，助手父级和终态正确。
- [完整附件页面](candidate-web-attachments.png)、[零字节文本完成读取](candidate-web-empty-text.png)、[原图预览](candidate-web-image-preview.png)：均已逐张人工复核。三次实际下载的建议文件名和字节见[页面请求及下载记录](candidate-web.json)。
- [公开类型消费者](typed-upload.ts)、[本机消费者检查配置](typed-tsconfig.json)：以公开请求类型直接调用上传方法，不使用类型逃逸；实际 TypeScript 检查通过。固定本机路径用于还原此次验收。
- [实际本机模型记录](model-stream.jsonl)：两次 `local` 请求均流式完成，实际收到 100 字节 PNG。不是外部模型验收。
- [正常停机后的只读数据](runtime-counts.json)：候选一个会话、两条消息、八个部件；基线无会话及消息，三个监听均已释放。

[根因、影响和实际验收方案](../../records/2026-11/2026-11-19-attachment-upload-sdk-body.md)
