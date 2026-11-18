# 编辑器主助手恢复验收

第 326 批，2026-11-19，本人独立调查。见[根因、共性恢复审计和实施前规格](../../records/2026-11/2026-11-19-acp-persisted-primary-availability.md)。仅自有本机流式参与者，无外部模型、凭据或子 agent。

- [原生、网页 Chat/Work、普通显式 Chat 的真实协议及持久身份](baseline-runtime.json)
- [同库正常重启后的四场景](baseline-restart-runtime.json)
- [另一项目的并发输入、恢复和项目列表](baseline-secondary-runtime.json)
- [本人所见：网页 Chat 原始历史](baseline-web-chat-history.png)
- [本人所见：网页 Work 原始历史](baseline-web-work-history.png)

原生 coding 恢复正常，真实 chat/work 隐藏角色均在加载、恢复、派生时被可见目录误判为不可用。空网页会话还错误报告 coding，但实际初始输入均保存真实 chat/work。独立项目同样复现，目录 4/2/6、消息与项目身份正确，六个实际输入正常 stop。

候选恢复真实主助手，固定会话只提供真实角色，普通会话提供可见角色与真实历史中已使用的身份，切换或保存新轮次后仍可重选。最终聚焦检查 51 项、319 断言、4 文件通过，后端类型、353 操作文档、36 文件路由及 20 文档架构检查通过；没有新增或运行 UI 自动化。

- [候选四场景、空会话模式、恢复/派生及实际后续轮次](candidate-runtime.json)
- [候选同库正常重启后的恢复和后续轮次](candidate-restart-runtime.json)
- [候选另一项目的并发输入及恢复/派生](candidate-secondary-runtime.json)
- [目录连续性问题修正前](mode-reselect-before.json)、[同一会话修正后](mode-reselect-after.json)：coding/chat → coding → 再选 chat
- [最终实际保存 coding 后再选 Chat、实际派生返回 Work，以及固定/多项目模式](candidate-roundtrip-runtime.json)
- [首次重启后的 Chat](candidate-web-chat-after-restart.png)、[Work](candidate-web-work-after-restart.png)、[coding 派生停靠历史](candidate-fork-coding-dock.png)
- [最终代码真实 Chat](candidate-final-chat.png)、[最终 Work](candidate-final-work.png)、[实际派生从 coding 返回 Work 的完整历史](candidate-final-role-roundtrip-dock.png)
- [基线最终只读库](baseline-persistence-final.json)、[候选最终只读库](candidate-persistence-final.json)
- [两次自有模型进程的全部 62 次流式请求及完成](model-stream-events.json)、[最终验证和正常退出](final-validation-summary.json)

所有目标页面均实际呈现并由本人逐张查看，没有用协议/源码/DOM 自动断言代替视觉验收。最终基线 9 会话/18 消息/45 部件，候选 16 会话/78 消息/195 部件，提示所有权均 0；39 条候选持久助手包括派生复制历史，不能当作实时调用数。62 次实际模型请求全为精确 local/流式，62 次完成。所有自有协议、模型和浏览器正常退出，40148/40150/40152 已关闭。

本批使用真实官方 ACP 标准输入输出及开发 HTTP，不声称新的原生 Zed 或外部模型验收；领域检查是实际公共身份合同，未执行完整 Task/Mission 外部模型工作流。普通派生由真实公开 Session 原语产生，没有委托 Codex 子 agent、复制凭据或直写消息。
