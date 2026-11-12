# MCP 授权必须绑定项目中的确切连接名称

## Recall

- 用户要求本人持续分批体验和调查，先分析根因与影响并落盘，再实施、真实桌面交互及截图复核、聚焦正向验证、范围提交、合并上游和正常推送。上一批已推送 `f51bd12e2`，本地与上游一致，原 177 项工作区状态保持。
- 已读 `AGENTS.md`、[数据迁移](../../current/architecture/02-data.md)、[MCP 授权、凭据与项目生命周期](../../current/architecture/04-extensions.md)、[配置所有权](../../current/architecture/05-config.md)、[连接设置](../../current/architecture/07-panel.md)、[精确删除](2026-11-12-mcp-bulk-delete-exact-targets.md)与[默认远程 OAuth](2026-11-12-mcp-public-remote-default-oauth.md)。全仓查阅 `McpAuth.scopedKey`、`parseScopedKey`、`findOAuthState`、`findOAuthCallbackTerminal`、`oauthFlowKey`、`oauthFinishKey`、`projectAuthPrefix`、`startAuthFlow`、`durableFlowAuthority`、`resolveOAuthCallbackOwner`、`removeStoredAuth`、项目删除清理、所有写入及读取入口、`InstanceBootstrap`、命令行 MCP 授权与凭据状态、连接面板和 Chat（对话）、Work（通用工作）分配。待完成旧凭据迁移的具体入口和锁顺序核对，再实施。
- 仅使用本人隔离开发服务、两个同名项目、可见 Chrome 和本机 OAuth（Open Authorization，开放授权）协议端点。隔离授权服务器真实执行授权重定向、单次 code（授权码）交换及 PKCE（Proof Key for Code Exchange，授权码交换证明密钥）校验，生成仅本机有效的随机材料。证据只保存非敏感结果，不含授权码、state（请求状态标识）、verifier（校验值）、令牌或实际授权地址。未发起模型请求。

## 现象与根因

1. `39906/ui/` 的两个 `archive-review` 项目独立。主项目定义 `"review-oauth"` 和 `" review-oauth "`，另一项目只有规范名。两条主项目声明故意使用完全相同的资源地址和 OAuth 客户端。正式项目状态返回三个确切条目，主项目的确认框也能显示两个不同键，但普通连接行将两个名称显示成相同的文字。[桌面截图和去敏协议证据](../../artifacts/2026-11-12-mcp-oauth-exact-connection-name/README.md)
2. 依次向主项目规范名、另一项目同名、主项目带空格名发出真实授权请求，三笔均返回 200，请求号分别为 `01e37d86-c27e-4830-8d11-3038e94a9be9`、`164d13e0-a2cb-49e1-9650-f0ff381b8dfc`、`1dcb334c-eee1-453c-8846-b70baad0b45a`。主项目两个请求使用同一个持久键，后一次替换前一次的 pending（待完成）状态并发布 `superseded`，另一项目仍保留自己的 pending。第一个真实授权回调返回 400 和 `superseded`。带空格名的回调返回 200，实际是主项目规范名 `connected`、带空格名 `needs_auth`，状态读回 `a8521c69-c8a1-43f8-905c-483194e81713`。另一项目随后独立交换并连接。三组授权重定向中有两组完成 token（令牌）交换及协议初始化，正式授权服务验证了实际 PKCE。
3. 对带空格名称发出真实 `DELETE /mcp/:name/auth`，200 `aa3e3587-8a07-4246-b49d-ed5b5350efc7` 返回 `success:true`。持久检查显示主项目规范名键下已经落盘的令牌被清除，另一项目同名的实际令牌保持相同。桌面验收只打开删除确认框核对两个项目键后取消，未通过桌面执行配置删除。
4. 配置字符串键、公开路由参数、项目状态和连接代际使用原始名称。直接触发点是 `McpAuth.scopedKey` 在生成 `projectID:mcpName` 前执行 `.trim()` 并拒绝空值。待完成流程、凭据代际、停止和回调 owner（所有者）都使用这个有损键；`durableFlowAuthority` 又从它反解连接名，所以即使回调的 state 与 PKCE 校验正确，也只能得到错误连接。旧路径的 URL（Uniform Resource Locator，统一资源定位符）、客户端身份、Project occurrence（项目运行轮次）和精确 state 校验能阻止不同端点或项目串用，不能区分同项目使用同端点和客户端的两个真实名称。协议要求授权响应带回原 state；这次真实授权服务满足该要求，错误发生在应用内部按名称恢复授权归属。[OAuth 2.0 授权响应规范](https://www.rfc-editor.org/rfc/rfc6749.html#section-4.1.2)

## 影响与升级约束

- 受影响的共享认证机制包括项目连接及预检、静态凭据读取和恢复、授权开始及直接完成、独立 broker 回调、正常终态、重复回调、重启恢复、并行 pending、清理/退出登录、配置变更和 Project 删除。首轮已用同项目串发和两个项目交错验证持久所有权差异。连接资源、命令、Chat 和 Work 入口及 Task/Mission/Session（任务、多步任务、会话）的已分配工具由现有运行租约投影；这条认证错误可能影响其共享远程连接的可用性。尚无真实证据表明任务调度状态、队列或轮次终态本身损坏，仍需对共享路径、并行和重启实证。
- 配置名称本身已经持久化，不能在读取时规范化名称或将定义合并。新授权所有权应完整往返精确项目及名称，从同一持久事实选择确切连接。不得根据规范化键、一次成功回调或同一个地址猜测两条定义中的所有者。现有文件对冲突键没有存储原始名称。升级时对可证明的凭据保留，对无法判定实际所有者的材料保留安全迁移证据并要求各自显式授权。回调安全必须保留精确 state 的一次兑换和原终态语义。[OAuth 2.0 安全最佳实践](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.7.1)
- 实施前继续核对受配置代际约束的迁移入口、读写锁顺序、项目删除前后的清理、存量 pending 和 finishing（已消费并在完成中）归属。准备以真实后端重跑正常、空白差异、串并发、两项目、退出登录、重启和旧数据的实际路径。需把确切方案、正向测试及验证命令补在本规格后再修改生产代码。
