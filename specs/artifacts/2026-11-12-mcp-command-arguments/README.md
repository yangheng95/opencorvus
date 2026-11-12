# 远端提示命令参数的真实基线

[真实编辑器、公开接口和持久会话](baseline-acp-evidence.json)、[远端实际收到的参数](baseline-prompt-events.jsonl)及[本地流式模型对照](baseline-stream-events.jsonl)。

| 桌面实拍 | 画面 |
| --- | --- |
| [02](02-baseline-strict-connection-en.png) | 真实设置显示严格提示服务已连接 |
| [03](03-baseline-strict-catalog-500.png) | Chrome 原生页面显示完整命令目录 500 |

## 候选版本

[真实编辑器与公开接口](candidate-acp-evidence.json)、[参数目录和读取中途换源](candidate-argument-runtime.json)、[远端收到的日期及范围](candidate-prompt-events.jsonl)、[受控远端进入和释放](candidate-held-events.jsonl)、[本地实际流式正文](candidate-stream-events.jsonl)、[SQLite 存储复核](candidate-storage.json)与[进程重启后恢复](restart-acp-evidence.json)。

| 桌面实拍 | 画面 |
| --- | --- |
| [04](04-candidate-strict-connected-en.png) | 英文设置中的项目连接 |
| [05](05-candidate-strict-connected-zh.png) | 中文设置中的同一项目连接 |
| [06](06-candidate-strict-command-arguments.png) | Chrome 原生目录显示必填日期和可选范围，普通命令保留模板 |

以上截图来自独立的真实 Windows Chrome 窗口，并逐张人工复核。流式正文仅记录带该会话用户消息的本地请求，Provider（模型供应商）独立记录确认四条会话回复各结算一次。当前批次的验收使用隔离本地模型 `acp-review/local`。
