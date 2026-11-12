# 编辑器远端传输的真实协议证据

[官方客户端与项目接口](baseline-acp-evidence.json)及[协议服务实际请求](baseline-remote-events.jsonl)。请求头证据保留校验布尔值。

| 桌面实拍 | 画面 |
| --- | --- |
| [02](02-baseline-transport-http-failed.png) | 主项目英文设置中的编辑器远端连接失败 |
| [03](03-baseline-transport-alternate.png) | 同名对照项目的显式 SSE 和项目接口 HTTP 均已连接 |

## 修复复核

[候选编辑器与接口请求](candidate-acp-evidence.json)、[真实协议请求](candidate-remote-events.jsonl)、[重启](restart-acp-evidence.json)、[真实桌面断开与重连](candidate-desktop-evidence.json)及[持久化检查](candidate-verification.json)。协议请求记录包含首次重接、串行复现、受控结算探针、正常重试和重启。

[首次并行重接诊断](first-candidate-diagnostics.json)、[串行重接诊断](serial-candidate-diagnostics.json)和[受控结算探针](late-peer-baseline.json)记录了同名配置更换时待修复的共享凭据代际问题。

| 桌面实拍 | 画面 |
| --- | --- |
| [04](04-candidate-transport-main-en.png) | 主项目英文页面的 HTTP、SSE 和本地连接 |
| [05](05-candidate-transport-disconnected-zh.png) | 实际断开主项目 HTTP 后的中文状态 |
| [06](06-candidate-transport-reconnected-zh.png) | 在中文设置重新连接后显示已连接 |
| [07](07-candidate-transport-alternate-zh.png) | 中文桌面切到同名对照项目，显示其独立两条连接 |
