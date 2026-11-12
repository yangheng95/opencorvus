# MCP 连接行提供桌面授权入口

## Recall

- 用户要求本人持续按批次调查界面、功能与缺陷，先分析并落盘，再实施、用真实桌面交互和截图复核、运行聚焦正向检查、范围提交、合并上游并正常推送。上一批已推送 `9f6be0c7c`，本地与上游一致，保留原 177 项工作区状态。
- 已读 `AGENTS.md`、[MCP 架构](../../current/architecture/04-extensions.md)、[桌面架构](../../current/architecture/07-panel.md)、[确切授权归属](2026-11-12-mcp-oauth-exact-connection-name.md)、[连接回执与状态](2026-11-12-mcp-connection-status-after-interrupted-receipt.md)。全仓检查 `MCP.connect`、`startAuth`、`authenticate`、`finishAuthCallback`、`needs_auth`、`McpRoutes`、`MCPExecutionConnectionRequiredError`、`connectMcp`、`refreshMcpStatus`、`readMcpStatusAfterMutation`、`nativeOpen`、`externalUrl`、`AppDialogHost`、浏览器激活条件、SDK（Software Development Kit，软件开发工具包）生成客户端及双语接口文档。所触及路径无 UI（User Interface，用户界面）自动化测试。
- 仅用本人隔离开发服务、两个同名项目、专用 Chrome 和本机授权服务器。桌面、网络及存储证据不保留授权码、state（请求状态标识）、校验值、令牌或含其值的完整地址。没有真实 Provider（模型服务商）凭据、外部账户或模型请求。

## 根因与影响

1. 基线 `39910/ui/` 提供 `main-CrJWpmyN.js`。主项目的远程 `review-oauth` 从已断开点击连接，真实协议服务器返回授权挑战，项目状态变为 `needs_auth`。桌面显示 HTTP（Hypertext Transfer Protocol，超文本传输协议）500 `ee78df71-f13c-464e-ae83-5f984d392b05` 和英文状态。展开详情看到 `UnknownError`。切中文仍只显示「需要认证」，没有对应行控件。独立状态读回 `dcd4cc6b-5d5d-4770-a2f3-9f7685171bbf` 确认主项目的状态，另一同名项目仍为已断开。[基线实拍与回执](../../artifacts/2026-11-12-mcp-desktop-authorization-entry/README.md)
2. 后端 SDK 已将初次远端授权挑战投影为 `needs_auth`，`MCP.connect` 却将当前任何未连通的结果抛为通用错误，HTTP 映射因此给出 500。连接面板只允许 `connected`、`disabled`、`disconnected`、`failed` 状态进入同一行操作，`needs_auth` 未接入已经存在的授权服务。另行调用真实 `POST /mcp/review-oauth/auth` 返回 200 `004a9877-8692-4533-a387-77425133cad4`，通过检查目标是本机授权服务并存在 state。当前 CLI（Command-Line Interface，命令行界面）可以进入此流程，桌面缺少入口。
3. `connect` 现有成功回执是布尔 `true`，另外有执行归属 409、目标 404、真实连接错误 500。当前项目、确切名称和同一运行代际仍拥有此次挑战时，授权需求应是具名 409。已有桌面读回只有在确认同一具名回执和真实需要授权状态时才按正常分支呈现行操作；未确认、过期、其他接口错误继续保留原诊断。启动授权沿用现有 HTTP 接口、凭据锁、精确项目及名称、callback（回调）与一次性终态；不新建授权持久事实、配置或协议。连接面板仍从服务端状态读回获取实际结果。
4. 浏览器的外链开启受用户当前点击激活约束，不能假定网络返回后的异步动作可以弹出。已读现有 Provider 授权和 `AppDialogHost` 的手动外链设计。桌面先为确切项目和连接准备链接，再由现有应用对话框的明确「在浏览器中打开」动作使用 host 开启实际 HTTP 地址。项目或连接权限失效时不允许打开旧地址。取消仅结束当前界面的准备，不伪造服务端撤销或连接状态。客户端注册、配置规则、Task/Mission/Session（任务、多步任务、会话）及模型执行没有观察到相关异常。

## 实施与验收

- `MCP.connect` 对确认仍拥有的 `needs_auth` 结果发出具名 409，保留确切连接名。同步正式路由描述、生成 OpenAPI（Open Application Programming Interface，开放应用程序编程接口）、JavaScript 类型和双语接口参考。聚焦真实 SDK 授权挑战、具名错误和连接成功。
- 在服务层读取 `POST /mcp/:name/auth`，保留精确项目及连接作用域，验证成功回执和外部 HTTP 地址，不把原授权地址附到错误诊断。已有可连接凭据时，现有空字符串回执触发真实状态核对。对处于 `needs_auth` 的项目连接行提供双语授权控件。确认界面明确显示项目和连接并调用现有 native URL（Uniform Resource Locator，统一资源定位符）开启路径。若真实 Chrome 的弹窗激活无法通过共享确认动作传递，则在同一界面复用现有同步外链控件并复拍，确保只有一种当前开启路径。成功打开浏览器后释放操作占用，由已有状态轮询反映实际回调。
- 通过隔离开发模式的真实桌面验证从连接按钮获得可操作授权状态、打开专用 Chrome 内的实际授权页、本人点击同意、真实 PKCE（Proof Key for Code Exchange，授权码交换证明密钥）、回调、连接和工具列表。用两个同名项目核对取消、另一项目隔离、中文和英文、实际持久凭据及零模型活动。运行聚焦前端服务、核心接口、类型、双语、构建和文档检查。关闭本批专用浏览器与服务。
