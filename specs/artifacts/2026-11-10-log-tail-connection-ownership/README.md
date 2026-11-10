# 日志尾部跟随实际连接的证据

第 209 批。用两个独立开发服务和一个隔离桌面标签复现连接切换时的旧服务器日志。只使用专门写入两端的独立样本。

- [基线：已连 B，等待期间仍显示 A](baseline-en-authority-b-waiting-shows-a.jpg)。
- [最终：同连接刷新保持 A](final-en-a-refresh-keeps-a.jpg)、[切到 B 后独立等待](final-en-b-connection-loading.jpg)、[接受 B 的实际四条记录](final-en-b-accepted.jpg)。
- [中文原诊断](final-zh-original-tail-error.jpg)、[中文等待](final-zh-retry-loading.jpg)、[保留焦点并恢复](final-zh-keyboard-recovered.jpg)及[实际无匹配](final-zh-confirmed-no-match.jpg)。

[回执](receipt.json)列出真实公开接口、实际页面尾部响应、各隔离数据库和退出证据。代理只延迟或截短真实日志响应；截图为本人复核的实际 1280 × 720 桌面。

[规格与根因](../../records/2026-11/2026-11-10-log-tail-connection-ownership.md)。
