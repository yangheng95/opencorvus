# 共享连接凭据代际的真实跨进程基线

[真实请求与持久代际比较](cross-process-baseline.json)。证据只记录代际是否改变，授权材料和代际原值均不进入产物。

| 桌面实拍 | 画面 |
| --- | --- |
| [02](02-baseline-peer-writer-failed-en.png) | 已保存正确配置的写入后端被第二次撤销后显示失败 |
| [03](03-baseline-peer-observer-connected-en.png) | 同一项目的观察后端显示已连接 |

## 修复复核

[两端项目写入、并发、回到旧定义和真实桌面操作](cross-process-candidate.json)、[全局配置变更](global-candidate.json)、[实际进程重启](restart-candidate.json)、[编辑器首次正确重接](reattach-acp-evidence.json)与[持久存储复核](candidate-storage.json)。

| 桌面实拍 | 画面 |
| --- | --- |
| [04](04-candidate-peer-writer-connected-en.png) | 写入后端英文页面显示同一项目已连接 |
| [05](05-candidate-peer-observer-connected-zh.png) | 观察后端中文页面显示同一项目已连接 |
| [06](06-candidate-peer-writer-disconnected-en.png) | 真实断开写入方，观察方的实际提示读取继续返回 200 |
| [07](07-candidate-peer-writer-reconnected-en.png) | 真实重连写入方后显示已连接 |
