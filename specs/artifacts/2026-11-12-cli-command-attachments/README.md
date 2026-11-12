# 命令行斜杠命令附件基线

[开发页面实拍](01-baseline-web-command-attachment-missing.png)显示真实浏览器会话经命令行续接后得到了展开的命令正文与回复，该轮没有附件。

[本地与连接模式的命令行记录](baseline-cli.json)、[续接网页会话的命令行记录](baseline-web-cli.json)、[会话及存储核对](baseline-runtime.json)与[实际流式请求](baseline-stream-events.jsonl)。

## 候选验收

| 桌面实拍 | 画面 |
| --- | --- |
| [02](02-candidate-web-command-attachment.png) | 实际命令行续接产生的图片、命令正文与流式回复 |
| [03](03-candidate-web-image-preview.png) | 点击会话图片打开预览和原件下载 |
| [04](04-candidate-web-preview-zoom.png) | 实际点击缩放，显示 125% |
| [05](05-candidate-web-restored-attachment.png) | 浏览器重新载入后保留同一轮图片 |

[本地与连接模式命令行记录](candidate-cli.json)、[续接真实网页会话](candidate-web-cli.json)、[持久会话和原件接口](candidate-runtime.json)、[真实流式图片](candidate-stream-events.jsonl)及[浏览器实际下载](candidate-browser-download.json)。截图逐张人工复核。预览当前使用圆角裁切小图，原件下载字节与源图一致。
