# 编辑器命令选择与参数提示

真实 Windows Zed 1.28.1 使用 OpenCorvus 的命令行进程。已人工复核同一项目的三张基线图。

| 桌面实拍 | 画面 |
| --- | --- |
| [01](01-baseline-zed-command-picker.jpg) | 远端命令出现在补全列表 |
| [02](02-baseline-zed-selection-submits.jpg) | 接受补全时立即提交并显示缺少日期的错误 |
| [03](03-baseline-zed-static-submits.jpg) | 带模板位置参数的项目命令提前提交并得到回复 |

[真实 Zed 双向协议](baseline-zed-acp.json)、[公开命令目录](baseline-command-catalog.json)、[本地模型收到的缺参正文](baseline-stream-events.jsonl)。

## 候选验收

| 桌面实拍 | 画面 |
| --- | --- |
| [04](04-candidate-zed-remote-hint.jpg) | 在输入框显示必填 `<date>` 和可选 `[scope]` |
| [05](05-candidate-zed-remote-result.jpg) | 输入带引号的范围后得到流式回复 |
| [06](06-candidate-zed-static-hint.jpg) | 静态模板选择后显示自由输入提示 |
| [07](07-candidate-zed-all-results.jpg) | 远端、有参静态和无参静态命令的三次实际结果 |
| [08](08-candidate-web-connection.png) | 开发服务真实应用设置中手动连接同一个远端提示服务 |
| [09](09-candidate-zed-restored-history.jpg) | 关闭重开后恢复三轮，历史用户区显示已展开的执行正文 |
| [10](10-candidate-zed-restored-hint.jpg) | 在恢复会话中再次选择，显示相同参数提示 |
| [11](11-candidate-zed-optional-result.jpg) | 只填日期并得到流式回复 |

[真实 Zed 协议](candidate-zed-acp.json)、[重启后的协议](restart-zed-acp.json)、[会话与存储复核](candidate-durable.json)、[远端收到的实际参数](candidate-prompt-events.jsonl)、[本地流式请求](candidate-stream-events.jsonl)、[候选公开目录](candidate-command-catalog.json)与[实际应用连接](candidate-web-connection.json)。所有截图均为真实桌面窗口实拍并逐张人工复核。流式请求来自隔离本地模型 `acp-review/local`。
