# 编辑器斜杠命令附件的真实基线

| 桌面实拍 | 画面 |
| --- | --- |
| [01](01-baseline-zed-file-attached.jpg) | 文件作为独立附件出现在 Zed 输入框 |
| [02](02-baseline-zed-file-result.jpg) | Zed 显示文件标记及成功回复 |
| [03](03-baseline-zed-image-attached.jpg) | 本地命令包含实际图片 |
| [04](04-baseline-zed-image-result.jpg) | 图片仍显示在用户提交处，实际会话只保存展开的命令文本 |

[真实 Zed 双向协议](baseline-zed-protocol.json)、[公开会话读取](baseline-zed-durable.json)、[官方协议客户端对照](baseline-acp-evidence.json)、[远端收到的错误参数](baseline-prompt-events.jsonl)与[本地实际流式输入](baseline-stream-events.jsonl)。

## 候选验收

| 桌面实拍 | 画面 |
| --- | --- |
| [05](05-candidate-zed-file-attached.jpg) | 在 Zed 输入框中实际选择维护记录 |
| [06](06-candidate-zed-file-result.jpg) | 远端命令和记录成功提交 |
| [07](07-candidate-zed-image-attached.jpg) | 在本地命令中实际选择测试图片 |
| [08](08-candidate-zed-image-result.jpg) | 本地命令及图片已提交并收到回复 |
| [09](09-candidate-web-connected.png) | 开发服务项目设置中成功连接实际远端 |
| [10](10-candidate-zed-restored-context.jpg) | 重启后同一会话显示多行记录和图片标记 |
| [11](11-candidate-zed-restored-image.jpg) | 点击恢复的图片标记，打开真实项目图片预览 |

[真实 Zed 双向协议](candidate-zed-protocol.json)、[官方协议客户端对照](candidate-acp-evidence.json)、[远端收到的实际参数](candidate-prompt-events.jsonl)、[本地模型实际流式输入](candidate-stream-events.jsonl)、[公开会话读取](candidate-zed-durable.json)、[项目附件下载](candidate-attachment-download.json)、[重启时实际编辑器回放](restart-zed-protocol.json)与[会话存储复核](candidate-storage.json)。逐张人工复核截图。图片下载和重启回放按实际编辑器发送的字节比较。
