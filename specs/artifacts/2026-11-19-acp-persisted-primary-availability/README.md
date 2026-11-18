# 编辑器主助手恢复验收

第 326 批，2026-11-19，本人独立调查。见[根因、共性恢复审计和实施前规格](../../records/2026-11/2026-11-19-acp-persisted-primary-availability.md)。仅自有本机流式参与者，无外部模型、凭据或子 agent。

- [原生、网页 Chat/Work、普通显式 Chat 的真实协议及持久身份](baseline-runtime.json)
- [同库正常重启后的四场景](baseline-restart-runtime.json)
- [另一项目的并发输入、恢复和项目列表](baseline-secondary-runtime.json)
- [本人所见：网页 Chat 原始历史](baseline-web-chat-history.png)
- [本人所见：网页 Work 原始历史](baseline-web-work-history.png)

原生 coding 恢复正常，真实 chat/work 隐藏角色均在加载、恢复、派生时被可见目录误判为不可用。空网页会话还错误报告 coding，但实际初始输入均保存真实 chat/work。独立项目同样复现，目录 4/2/6、消息与项目身份正确，六个实际输入正常 stop。候选尚未实施和验收。
