# 编辑器嵌入资源可选媒体类型的真实证据

本人独立操作实际 ACP 进程、公共接口和 Windows Chrome 开发页面。未使用 UI 自动化测试或外部凭据；本机流式参与者是 `acp-review/local`，并非外部模型验收。

- [基线实际运行](baseline-runtime.json)：47 字节资源在缺省类型的普通提示、`null` 类型的注册命令及网页对话中丢失；相同字节明确类型的对照得到可下载原件。所有提示均真实完成。
- [基线网页](baseline-web-missing-resource.png)：用户文字和已完成回复可见，缺省类型资源未成为历史附件。已人工复核。
- [候选实际运行](candidate-runtime.json)：普通提示、注册命令、明确类型对照和网页对话均保留同名、同媒体类型的 47 字节原件，并在同一持久用户消息下回放。
- [候选网页](candidate-web-resource.png)：真实页面显示原附件及下载操作。点击下载后得到 `binary packet.bin`，47 字节，与源文件相同；[下载与页面资源记录](candidate-web.json)。已人工复核。
- [实际本机流式记录](model-stream.jsonl)：20 次请求及完成，精确模型 `local`，全部流式；不代表外部模型理解了不支持的通用二进制格式。
- [停机后的只读数据事实](runtime-counts.json)：两者各四个会话、八条消息；候选比基线多出三份原来丢弃的文件部件。三个监听均已释放。

[根因、影响和后续验收](../../records/2026-11/2026-11-19-acp-embedded-resource-optional-mime.md)
