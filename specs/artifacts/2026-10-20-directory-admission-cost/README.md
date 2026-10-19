# 共享目录准入成本证据

[Recall 与验收合同](../../records/2026-10/2026-10-20-directory-admission-cost.md)。保存实际阶段与 checker 结果；不保存凭据、数据库或完整模型响应。

本轮完整性能目标为 **failed**：冷保存24.59s→19.97s，暖恢复4.06s，原canonical已完整恢复且保持Ask。before56项目、after57项目；并发冷页面读取未测。checks/benchmark-result.json.gz保留原门槛与实际结果，before/after-cost保留原requestID及逐span阶段，其他checks保存工具与正向合同日志，runtime保存精确物理结算及仅含模型/流/HTTP状态的Provider摘要。

- [英文首页实景](01-home-before.jpg)：复用已交付UI。
- [中文首页与输入焦点](02-home-zh.jpg)：真实点击“填写第一条需求”。
- [原有Chat的创建目标表单](03-goal-create-zh.jpg)：仅打开阅读，未提交或触发续跑。

两scope共4次真实gpt-6.1-sol流预检，200/EOF；两个公开shutdown200及原句柄join0后确认physical/output/request结算，再退休运行和私有auth/models对。原Codex auth尺寸与mtime保持准备前。UI只做真实人工交互/截图，没有UI自动化；本轮未修改UI、schema或真实用户数据库。
