# 编辑器按声明接入远端连接传输

## Recall

- 用户要求本人持续按批调查、先落盘根因及影响、实施、真实桌面和截图复核、正向测试、范围提交和正常同步。未委托。上一批 `62f9f0cf7` 已推送，主分支与上游为 0/0，原有 177 项工作区状态逐项一致。
- 已读 `AGENTS.md`、`04-extensions.md`、`05-config.md`、`17-code-work-agent-platform.md`、[编辑器命令通知](2026-11-12-acp-attached-command-announcement.md)及双语编辑器协议文档。全仓搜索 Agent Client Protocol（ACP，智能体客户端协议）能力声明、软件开发工具包（SDK）`McpServer` 联合类型、`loadSessionMode` 的四个调用点、`mcp.add`、`MCP.configure`、项目配置写入、远端传输工厂、项目连接状态和真实提示目录。检索到的相关测试是编辑器协议、项目连接配置和非界面传输测试。
- 参照 ACP 对 Hypertext Transfer Protocol（HTTP，超文本传输协议）与 Server-Sent Events（SSE，服务器发送事件）的独立声明，以及 Model Context Protocol（MCP，模型上下文协议）对 Streamable HTTP 的定义。[ACP 会话设置](https://agentclientprotocol.com/protocol/v1/session-setup#mcp-servers)、[MCP 传输规范](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#streamable-http)

## 修改前证据

实际 `opencorvus acp` 在初始化声明 `http: true` 和 `sse: true`。主项目用官方客户端分别在新建、加载、派生与恢复请求中发送同一 `type: "http"` 连接。四个入口均返回 JSON-RPC（JSON Remote Procedure Call，JSON 远程过程调用）`-32603`。实际项目连接状态为 `failed`，正式配置读取 200 `313665d7-6d91-4455-a1e4-7d6b89e7c085` 将同一端点保存为 `transport: "sse"`。真实协议服务收到已带正确测试请求头的 GET，返回 405，未收到该连接的 `initialize` POST。桌面随后显示 `MCP OAuth connection failed`，其摘要来自失败连接，实际原因由传输和请求证据确定。

同一进程的同名对照项目用 ACP `type: "sse"` 成功建立长连接并发送 `initialize`、提示列表和提示读取。通过真实项目 `mcp.add` 明确提交 `streamable-http`，同一协议服务的另一个项目端点接收 `initialize` POST 200，目录返回正确描述和模板。人工实拍主项目失败以及对照项目两条连接均已连接。[请求和桌面证据](../../artifacts/2026-11-12-acp-remote-mcp-transport/README.md)

## 根因和影响

`loadSessionMode` 的远端分支将所有带 `type` 的已支持服务器统一写为 `transport: "sse"`。项目写入忠实保存该定义，远端工厂据此使用 `SSEClientTransport`，因而连接了错误的协议入口。项目接口直连成功、SSE 对照和官方传输类型共同排除服务端不可用与请求头丢失。错误在新建、加载、派生和恢复共同入口发生，已有失败配置保留在原项目，可由同名正确重接更新。原项目所有者、真实请求头、连接回执和后续命令通知使用现有项目链路。

保持既有本地标准输入输出连接、显式 SSE 及 MCP-over-ACP 的明确无效参数契约。用现有 `streamable-http` 和 `sse` 字段表达传输，无数据库或配置格式迁移。用户原有显式 `sse` 配置与错误的历史映射具备相同字面形状，只有编辑器重新声明 `type: "http"` 才能安全确定该连接的意图。Task（任务）、Mission（多步任务）和其他 Session（会话）生产入口使用自己的项目或执行作用域，传输工厂已经按准确声明连接。本批证据指向编辑器入口的字段映射，未观察到队列、唤醒或终态异常。并发、重启及同名项目继续做实际候选验证。无真实 Provider 请求需要。

## 实施与验收

- 通过同一个远端分支将 `http` 映射到 `streamable-http`、`sse` 映射到 `sse`，复用现有连接工厂。让官方客户端在新建、加载、派生、恢复接入真实远端服务，核对握手、提示、请求头和持久传输。保留基线失败的同名配置，候选重接后须读回准确的 `streamable-http`，重启恢复连接。真实对照覆盖本地标准输入输出、SSE、同名项目并行以及明确的非法传输契约。
- 使用真实桌面设置选择两个项目，至少查看英文和中文状态，实拍确认同一连接从失败转为已连接。运行聚焦正向协议测试、核心类型、文档和架构索引。结束隔离服务后按范围提交并正常同步。测试请求头只用于本机协议证明，证据仅记录接收校验结果。

## 交付证据

- 候选配置准确写为 `streamable-http`，真实协议服务通过 POST 接收 `initialize`、`prompts/list` 和 `prompts/get`，测试请求头校验成功。使用已保存的正确配置再次进入编辑器时，同名 `editor_http` 已连接，正式接口返回准确名称、描述和模板。新建、加载、派生、恢复均成功通知当次连接。SSE 与本地连接也在实际目录中返回准确提示。两个同名项目并行且独立，重启后两次恢复各自原会话及原连接，八次通知身份匹配。真实接口读回 26 次 200。三个持久会话通过 SQLite `quick_check`，消息、任务与模型活动计数均为 0。
- 真实英文桌面显示主项目六条已连接记录，手动断开后切换到中文，重新连接和命令读回分别返回 200 `83ada7c3-81a2-417b-9893-5dd335095fae`、`4c68d228-4a9e-40e9-9e2c-66c70293decb`。对照项目的真实设置只显示其两条连接。逐张实拍及协议记录见[证据](../../artifacts/2026-11-12-acp-remote-mcp-transport/README.md)。
- 已有错误定义改正时，首次候选请求在正确完成握手后仍报 `MCP OAuth credential snapshot changed; retry connection`。并行和串行请求均复现，配置已准确持久化。独立受控探针在写入方建立可读的新连接后释放较早排队的后台准备，证实同一凭据代际再次被撤销。证据显示该问题来自共享配置结算，已有错误定义的首次重接仍受影响。继续核查跨进程、恢复和其他入口并修复共享机制。
- 三组聚焦测试共 21 例、110 项断言通过，覆盖真实传输、请求头、命令通知、明确的非法传输契约及项目和全局配置收敛。首轮广一些的编辑器测试遇到 Windows 原生进程监督器构建目标中的可执行文件占用。按当前源文件在隔离目标目录执行 `cargo build --locked`，经现有 `OPENCORVUS_PROCESS_SUPERVISOR` 路径重跑同组后全部通过。核心类型、双语文档、路由及架构索引通过。
