# 反向代理下的实时侧栏证据

- `baseline-live-ledger-empty.png` 显示已在线的代理页面、有效的当前项目和仍为空的侧栏。
- `baseline-after-project-registration.png` 是第二项目真实登记及公开列表读取后，同一代理页持续为空的状态。
- `baseline-direct-projects.png` 显示直连同一开发服务已存在两个项目。
- `baseline-relay-sample.jsonl` 记录浏览器实际准入、升级和普通读取路径，并含随后受控对照。
- `baseline-controlled-targets.json` 保留同一完整代理和服务只变动内部目标的两次真实握手及流响应。正式前缀在外层保持，正确内部目标才收到 `work-ledger.connected`。

[根因及验收规格](../../records/2026-11/2026-11-19-prefixed-stream-target.md)
