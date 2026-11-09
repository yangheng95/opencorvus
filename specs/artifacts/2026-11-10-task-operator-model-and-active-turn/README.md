# Task 跟进模型回执与活动轮次模型证据

对应[规格](../../records/2026-11/2026-11-10-task-operator-model-and-active-turn.md)。全部输入和模型均为隔离本地测试数据；本机流式 Provider 收据只记录模型、是否流式及固定场景。没有外部凭据或模型调用。

- [基线：旧轮次失败的详情](before-task-model-conflict.jpg)。在真实工作台 1280×720 展开，原助手身份错误和两条真实跟进均可见。后台持久事件 `pev_g0VaWPXRm00Q6XYqR5gU` 证明 epoch 1 以 `interrupted` 失败。串行对照明确 C、真实请求 C，Message 仍存 B。
- [候选：A 正在输出](candidate-1-running-model-a.jpg)；[切到 B 并发送时旧回复仍在运行](candidate-2-follow-up-while-running.jpg)；[同一 Task 中两条回复均已完成](candidate-3-both-replies.jpg)。三张截图均为本人在同一候选真实工作台的交互后人工复核。B 是 Composer 之后提交的配置；截图本身不证明线上 Provider 模型。对应实际流式请求 11/13 为 A，14 为 B，Message 与 Tool 结果见下方。
- [运行事实](runtime-observations.json) 记录三个实际开发进程阶段的脱敏请求、从 SQLite 按精确 Project/Task/Session 读取的原始消息与接收事实、通过独立 Tool request/outcome 行核对的六个 `no_action` 完成，以及冷重启的实际 202（原 Message、ingress 和 opened event）。`intermediate` 保存首次候选进一步揭示的目录配置冲突；`candidate` 保存主接口、桌面、第二项目三个对照。`active` 是 Task lifecycle，截图中的 `Idle` 是当前工作台执行活动已空闲，固定 Tool 夹具没有结束 Task 业务轮次。
