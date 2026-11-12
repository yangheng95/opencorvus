# 编辑器会话广播已接入连接的命令

## Recall

- 用户要求本人持续迭代，先实测与分析，再落盘、实施、真实桌面复核、执行聚焦正向测试、按范围提交并正常合并推送。未委托。上一批 `d7cfee91c` 已推送，主分支和上游为 0/0，原有 177 项工作区状态逐项一致。
- 已读 `AGENTS.md`、[命令目录与模板合同](2026-11-12-current-command-projection.md)、`04-extensions.md`、`05-config.md`、`17-code-work-agent-platform.md`、双语编辑器协议与命令文档。全仓查 Agent Client Protocol（ACP，智能体客户端协议）的 CLI 生产启动器、`ACP.init`、`new/load/fork/resume`、`loadSessionMode`、`available_commands_update`、`mcp.add`、`Command.get/list`、`session.command`、会话状态回滚和已持久化项目配置。对应非界面测试在 `acp-prompt-terminal.test.ts`、`dependabot-runtime-contract.test.ts`、`session-prompt-attachments.test.ts`。本批检索路径未见界面自动化测试。
- 验收从真正的 `opencorvus acp` 命令行入口使用官方协议客户端，经真实标准输入输出、项目接口和本机 Model Context Protocol（MCP，模型上下文协议）进程。真实 `/ui/` 用于复核相同后端、项目和连接状态。无外部凭据。本地流式模型只用于证明正常命令的执行路径及准确输入。

## 修改前证据

真实编辑器协议的新建、加载、派生、恢复各提交一条新连接。四次操作都返回了对应会话，项目接口逐笔返回该连接 `connected`，真实 `/command` 也已有各自提示名称和模板。四次 `available_commands_update` 分别漏掉当次新连接，之前接入的提示在后续会话又可见。另一同名项目只返回自己的普通命令。英文桌面真实设置已显示主项目四条连接均已连接。[基线请求与实拍](../../artifacts/2026-11-12-acp-attached-command-announcement/README.md)

第三个隔离项目接入一个要求有效日期的 `editor_strict:strict_report`。新建会话成功且连接状态为 `connected`。公开完整目录返回 500 `046df527-802c-4cfb-8660-7df55fda0614`，编辑器恢复会话以及执行无关的普通 `/review-note` 都返回 JSON-RPC（JSON Remote Procedure Call，JSON 远程过程调用）`-32603`。后端记录将 `$1` 作为提示参数交给真实服务，服务按日期参数约束返回 `-32602`。即使把旧目录读取移到接入后，接入有效的严格提示也会导致编辑器新会话失败。

## 根因和影响

四个 ACP 会话入口共用 `loadSessionMode`。它先通过软件开发工具包（SDK）读取公开 `/command` 并生成通知载荷，然后才通过 `mcp.add` 写项目配置、确认连接并发送原先的载荷。`available_commands_update` 只要求名称和描述，斜杠命令选择只要求名称，两处却都调用公开的完整模板列表。`Command.list` 必须解析每条 `template`，包括给 MCP 的每个参数填入一个位置标记。任何被服务拒绝的模板都阻断了这两个纯目录消费方。公开 Session 命令执行本身只读取选中的模板。

接入所有权和持久化由现有项目 `mcp.add` 和配置结算维护。保持配置格式、项目归属、会话身份、默认命令顺序、`compact` 与同名配置命令的优先级、正常发送顺序、通知形状和真实执行的权限及流式行为。主 CLI 的 `run --command` 和公开 `/session/:sessionID/command` 使用同一模板执行入口，本批只修改 ACP 的发现消费方。Task（任务）与 Mission（多步任务）的作用域、恢复及终态使用现有运行合同和各自编排入口，查阅未发现其依赖此编辑器通知。此问题与项目命令发现有关，基线成功建立的会话没有进入任务或模型，也没有发现共享队列、唤醒或终态异常。会话重启、同项目并发和两个项目隔离仍需候选实测。需要真实参数才能求值的单个远端提示和公开完整 `/command` 合同另有已复现的求值限制，本批不改变其参数绑定及公开接口。

## 实施与验收

- 从 `Command` 同一当前定义提供名称和描述的投影，直接用于 ACP 进程内准确项目目录。沿用已有 `Instance.provide` 作用域和项目配置结算。`loadSessionMode` 在现有所有 `mcp.add` 正常完成并验证连接后再读取通知目录。ACP 斜杠命令选择也使用同一投影，执行仍由已有的公开 Session 命令入口处理。保持公开完整 `/command` 的现有响应形状，无新增端点、数据库迁移或缓存。
- 官方协议实测新建、加载、派生、恢复首次通知，每次要包含实际新接入提示、当前项目命令及一次 `compact`。覆盖严格日期提示的名称与描述、该项目的普通命令真实流式执行、两个项目并发及隔离、重启加载。通过正向非界面测试核对相同合同。进入真实桌面，按两种界面语言分别切换项目并查看连接状态，人工复核与保存截图。类型、路由、文档和架构索引通过后按批提交、合并和正常推送。
