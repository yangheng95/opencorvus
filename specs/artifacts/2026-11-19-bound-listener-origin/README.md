# 监听器来源证据

- `baseline-acp-probe.json`：官方 ACP 初始化成功，而实际创建会话被错误 IPv6 URL 拒绝。
- `baseline-runtime.json`：真实 serve 启动回执的不可解析地址、实际请求错误和正确监听地址的直接诊断会话。
- `baseline-ipv6-text.png`：本人通过已知真实 IPv6 监听地址打开的诊断网页和原件；不代表错误回执可用。
- `candidate-acp-probe.json` 记录官方 ACP 的真实会话生命周期与流式公共协议更新。
- `candidate-runtime.json` 和 `candidate-restarted.json` 记录实际回执、重开原会话及原件和下载字节核对。
- `candidate-ipv6-text.png` 和 `candidate-restarted-ipv6.png` 是本人查看的重启前后真实附件界面。
- `source-restart-result.json` 记录直接启动因所在 Job 拒绝执行的前置条件。`standalone-capability.json` 记录普通隐藏启动的独立性探测。
- `source-restart-final-result.json` 记录独立启动最终 14 项通过。`standalone-final-launch.json` 和 `standalone-checker-terminal.json` 记录该启动和退出。
- `runtime-audit.json` 记录只读持久事实和实际流式请求。

本批使用本人隔离服务及精确 `acp-review/local` 流式参与者，不代表外部模型或 GPT-6.1 Sol 验收。见[根因和方案](../../records/2026-11/2026-11-19-bound-listener-origin.md)。
