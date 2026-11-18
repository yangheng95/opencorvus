# 附件编码声明验收证据

方案见[本批记录](../../records/2026-11/2026-11-19-attachment-declared-text-encoding.md)。

- baseline-runtime.json：公开上传、原件字节核对、真实持久消息、官方 ACP 加载/恢复/派生回放。
- baseline-western-error.png、baseline-western-chinese-errors.png：本人真实桌面展开后逐张复核，原件声明被忽略，显示 UTF-8 编码错误。
- [候选真实上传/回放](candidate-runtime.json)、[重启后回放](candidate-restart-runtime.json)：四种文本准确，未知编码为同一原字节 blob；resume 恢复模式，显式 load 才回放。
- [真实 MCP 工具](candidate-tool-runtime.json)、[实际产物发布](candidate-artifact-runtime.json)、[模型请求记录](model-stream-events.json)：实际发现、启用、调用与流式请求中的解码文本，以及持久重放和真实发布产物。
- [最终验收](final-validation-summary.json)、[基线持久事实](baseline-persistence-final.json)、[候选持久事实](candidate-persistence-final.json)：71 项聚焦测试通过、四次真实下载逐字节一致、14 个本机流式请求全部完成、两库输入所有者为零，所有本人端口正常关闭。
- candidate-western-readable.png、candidate-western-chinese-readable.png、candidate-utf16be-readable.png、candidate-utf16-both-readable.png：本人依次真实展开并人工核对原文。
- candidate-unknown-encoding-error.png、candidate-chinese-encoding-feedback.png：未知标签的英文和中文错误与原下载；原文件名、编码标签保留技术事实。
- candidate-chinese-draft-bom.png、candidate-chinese-draft-closed.png：原生文件选择器上传本人 UTF-16 草稿、准确只读预览、原下载、关闭和移除未发送草稿。
- candidate-chinese-text-artifact.png、candidate-chinese-after-restart.png：真实工具发布的文本产物和服务重启后历史原文，均由本人查看。
- zed-candidate-acp.jsonl 是首次候选进程的官方 ACP 传输记录，不是 native Zed 验收。所有模型均为本人本机流式参与者，不称为 GPT-6.1 Sol 或外部模型理解验收。
