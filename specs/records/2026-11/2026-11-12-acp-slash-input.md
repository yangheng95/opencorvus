# 编辑器斜杠命令选择时提示参数

## Recall

- 用户要求本人持续按批完成调查、规格、实施、真实桌面与截图复核、聚焦正向测试、提交与上游同步。上一批参数执行已正常推送到 `af78b8dda`。工作区已有其他改动，单独暂存本批精确路径。
- 已读 `AGENTS.md`、[扩展架构](../../current/architecture/04-extensions.md)、[编辑器会话命令通知](2026-11-12-acp-attached-command-announcement.md)、[实际远端参数](2026-11-12-mcp-command-arguments.md)、双语编辑器协议及命令文档。全仓检查 `Command.catalog/get/list`、静态模板参数提示、会话斜杠命令解析、四个编辑器入口、协议通知与官方软件开发工具包（SDK）类型、现有 ACP 和公共目录测试。检索路径未发现界面自动化测试。
- Agent Client Protocol（ACP，智能体客户端协议）第一版允许 `AvailableCommand.input.hint`。客户端将用户填写的文字随普通 `session/prompt` 提交。Windows Zed 1.28.1 使用此字段决定选中命令时是否等待参数，并可将提示绘制在输入位置。[ACP 斜杠命令](https://agentclientprotocol.com/protocol/v1/slash-commands) · [Zed 补全确认](https://github.com/zed-industries/zed/blob/v1.28.1/crates/agent_ui/src/completion_provider.rs#L1452-L1508) · [Zed 输入提示](https://github.com/zed-industries/zed/blob/v1.28.1/crates/agent_ui/src/message_editor.rs#L606-L646)

## 修改前证据

独立的 Windows Zed 1.28.1 使用本机项目、真实 OpenCorvus 命令行代理和第一版 ACP。项目公开 `/command` 返回 200 `ffeaa829-a2e1-46b3-a4c6-60766482c297`。远端 `editor_strict:strict_report` 声明必填 `date`、可选 `scope`，本地 `review-date` 的模板声明 `$1`，`review-note` 的模板没有参数位置。真实 ACP 的目录通知为这些命令都只给出名称和说明。

在 Zed 输入远端命令前缀并按 Enter 接受补全，编辑器立即提交 `/editor_strict:strict_report`。真实调用 `1120abef-8359-4570-8658-758604ee293b` 返回 `-32602` 与缺少日期，编辑器显示错误。用相同操作选中本地 `/review-date`，编辑器提前发送，流式模型收到的是 `Use the strict-project note for .`，界面随后显示了正常回复。[实际接口、协议、流式输入和实拍](../../artifacts/2026-11-12-acp-slash-input/README.md)

## 根因与影响

`Command.definitions` 已从实际绑定的 Model Context Protocol（MCP，模型上下文协议）提示与静态模板得到声明。用于 ACP 的 `Command.catalog` 丢弃了这部分信息，`loadSessionMode` 又把命令投影成只有 `name` 和 `description` 的对象。上两批已经使连接附加后读取目录及命令执行使用真实参数。编辑器需要在第一次提交前收到声明，执行入口才能收到用户原本想填的文字。

新建、加载、派生、恢复均使用 `loadSessionMode` 的一个通知路径。斜杠命令执行也使用同一目录检查名称。增加可选 ACP 通知字段即可复用同一事实来源。公开接口、模板执行、错误格式、权限、持久化格式、调度和恢复机制在本批调查中排除。会话执行入口已能报告缺参，提前提交发生于编辑器接受补全时。可填参数的命令在支持该字段的编辑器中会先保留在输入框，静态模板的原有空输入仍可由用户直接提交。无参数声明的命令保有直接选择执行行为。

## 实施和验收

- 目录带出实际 MCP 参数或已有静态模板提示，保持不求值读取。ACP 用 `<date> [scope]` 一类语法按声明顺序表示具名必填和可选参数。对使用位置标记或 `$ARGUMENTS` 的静态模板提供 `[arguments]`，保持静态模板现有自由文本契约。无输入声明的命令和内置 compact 继续只投影名称和说明。
- 用现有聚焦协议用例验证真实新建、加载、派生、恢复时的完整通知，覆盖远端具名参数、静态自由输入和无参命令。对照真实公开目录与命令执行路径。
- 在隔离 Zed 真实桌面选择远端命令，人工核对输入位置提示，实际填写日期和带引号的范围并提交，核对远端和本地流式请求。对照静态模板和无参数命令的选择行为。应用网页仍从真实开发服务进入，复核命令所在项目连接。更新双语编辑器文档、类型与文档检查，范围提交及合并后正常推送。本批协议内容与界面选择可由本地流式端点精确验证。
