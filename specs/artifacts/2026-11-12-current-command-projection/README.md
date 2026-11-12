# 真实命令目录与模板的基线证据

[同进程配置与目录](baseline-command-config-evidence.json)、[删除读回](baseline-command-removal-evidence.json)、[手动断开后的目录](baseline-disconnected-command-evidence.json)、[缺失命令](baseline-missing-command-evidence.json)与[服务原因](baseline-command-diagnostics.json)。

| 桌面实拍 | 画面 |
| --- | --- |
| [02](02-baseline-command-connection-en.png) | 真实设置中的命令来源连接 |
| [04](04-baseline-pretty-command-response.png) | Chrome 原生视图显示旧描述和新模板 |
| [05](05-baseline-manual-disconnect-en.png) | 真实手动断开状态，目录随后 404 |

## 修复复核

[同一进程的真实请求](final-command-evidence.json)、[受控协议请求先到达后放行](controlled-prompt-events.jsonl)、[重启后的配置和目录](restart-command-evidence.json)与[SQLite 读回](candidate-storage-evidence.json)。两个会话来自同名的独立项目。浏览器视图中的命令正文来自实际接口，设置页按按钮操作。

| 桌面实拍 | 画面 |
| --- | --- |
| [08](08-final-mcp-connected-en.png) | 英文设置已连接状态 |
| [09](09-final-mcp-disconnected-en.png) | 在英文设置手动断开 |
| [10](10-final-command-disconnected.png) | 断开后真实响应仍列出新增项目命令 |
| [12](12-final-mcp-disconnected-zh.png) | 切到中文后显示准确的手动断开状态 |
| [13](13-final-mcp-reconnected-zh.png) | 在中文设置点击连接后显示已连接 |
| [14](14-final-command-reconnected.png) | 重连后的真实响应显示一致的提示描述和模板 |
