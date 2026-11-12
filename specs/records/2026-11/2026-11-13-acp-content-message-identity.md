# 编辑器协议用持久身份区分内容分段

## Recall

- 用户要求本人独立持续分批并行调查，先记录根因和影响，再实施、真实 Windows 桌面交互和逐张截图复核、聚焦正向检查、范围提交、合并上游及普通推送。第 312 批 `b2db9598c` 已推送，主分支同步，177 项原有工作区状态逐行一致。
- 已读 `AGENTS.md`、[扩展架构](../../current/architecture/04-extensions.md)、[控制架构](../../current/architecture/03-control.md)、[编辑器命令附件](2026-11-12-acp-command-context.md) 和 Agent Client Protocol（ACP，智能体客户端协议）第一版官方会话加载与内容声明。全仓查 `user_message_chunk`、`agent_message_chunk`、`agent_thought_chunk`、`processMessage`、`loadSession`、`unstable_forkSession`、`message.part.delta`、已存 `Message.id`、公开消息读取、取消和共享 Session（会话）执行轮次。已核对仓库固定的官方 SDK（Software Development Kit，软件开发工具包）1.4.0 支持可选 `messageId`，也查看了实测 Zed 1.28.1 的确切内容边界处理源码。检索路径未见界面自动化测试。[协议会话加载](https://agentclientprotocol.com/protocol/v1/session-setup#loading-a-session) · [Zed 1.28.1 接收实现](https://github.com/zed-industries/zed/blob/v1.28.1/crates/acp_thread/src/acp_thread.rs#L4638)
- 使用真实 Zed、实际 `opencorvus acp` 和隔离本机流式 `acp-review/local`。验收同一旧会话重启、相邻用户消息、同一助手思考与文字分段、原文件内容及派生会话。以公开持久读取、协议回执、真实流式调用和桌面截图核对。不涉及外部凭据。

## 修改前现象、根因和影响

真实 Windows Zed 1.28.1 通过本地公开 ACP 端口 `40072` 提交两条输入。第一轮 `94917ce0-a00b-484c-86e5-0b767796b8a4` 在实际流等待期间由编辑器取消，回执为 `cancelled`，助手持久记录终态 `error`，没有可见内容。第二轮 `4af0ed8b-d056-4c25-a365-32dfc68a0099` 有实际思考和两段文字，回执为 `end_turn`。编辑器实时显示两个独立用户框。关闭专用窗口并重开同一实际项目，`session/load` `d61fe1c0-d019-4ce8-85b8-bdf25bc07298` 对两个用户文本分别发通知，却都省略了消息身份。实际 Zed 把两个不同用户输入拼成一行。公开读取明确返回 `msg_g0VamJM8r00Z6FVg7f2X`、`msg_g0VamJRWe00NSSgVh5z8` 两个用户身份；第二个助手 `msg_g0VamJjl70006650Va4E` 的 `parentID` 是第二条输入且实际 `finish=stop`。[现场截图、协议与持久证据](../../artifacts/2026-11-13-acp-content-message-identity/README.md)

回放 `processMessage` 从每条持久记录顺序映射文字、思考及各类文件内容，通知带会话及角色，丢失了当前 `Message.id`。真实会话加载和派生共用该投影。实时 `message.part.delta` 已用同一 ID（Identifier，标识符）读取真实助手与部件，却在发送两类内容分段时也丢弃标识。现 SDK 的 `messageId` 明确区分同一消息的多个分段和下一条消息；Zed 的当前客户端据此分组。以原持久身份贯穿可见块，避免为边界伪造额外内容或改变文字及媒体字节。工具通知的 `toolCallId` 继续承载实际工具调用。

取消后流式记录中的首条文本曾像重复执行。该请求只产生自动标题；`ensureTitle` 在会话仍是默认标题时使用首条真实用户输入，公开会话标题 `a4b4bceb-1bad-47c5-a7b2-318963cc8c72` 与该本机标题响应逐字相同。之后真实执行模型请求收到了第二条，持久父级与 `end_turn` 对应。已横查 ACP 和公共 Session 取消、`SessionStatus.beginExecutionOccurrence`、普通及控制入口、Task（任务）及 Mission（使命）取消作用域、子会话和重启恢复、串并行及多项目的现有作用域。证据指向显示投影，未发现共用调度、唤醒或终态归属故障。保持现取消、工具、权限、命令、源模型输入、会话数据库及真实附件合同。风险集中在派生后混用父消息身份、实时分段误标到另一轮、用统一助手身份覆盖用户文件块以及重放没有内容的记录。

## 实施与验收

从已读取的真实助手消息给实时文字和思考分段赋 `messageId`。加载、派生重用已有同一回放，对一条消息的所有实际内容块使用该条持久 ID，包括用户文字、助手文字、思考、链接、图片及嵌入文本或二进制资源。加载读原会话的真实历史，派生读派生记录的真实身份。保留现有无可见部件的记录投影、原顺序、内容、工具通知和会话错误语义。

隔离复制已停机基线数据库，以同一实际 Zed 线程重新加载并核对两条真实用户框与原思考、助手文字。用真实本机流式多段回复对照公开持久身份，读取实际派生会话的块。聚焦 ACP 实际传输、取消后独立输入、跨项目、资源原件与派生的正向检查，再运行类型、文档和架构索引。记录官方协议、桌面与请求证据后按范围提交及正常推送。
