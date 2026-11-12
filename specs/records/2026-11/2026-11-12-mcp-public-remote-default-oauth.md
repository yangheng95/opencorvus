# 默认启用 OAuth 的公共远程 MCP 连接

## Recall

- 用户要求本人持续按批次并行调查体验、功能与缺陷。先形成根因、影响和规格，再改动、真实桌面交互、人工复核截图、运行聚焦正向检查、范围提交、同步上游并正常推送。此前字段批次的合法远程地址能真实保存，但默认连接显示需要认证，显式关闭 OAuth（开放授权）时同一地址可连接。[上一批实际请求与协议响应](../../artifacts/2026-11-12-mcp-add-field-validation/README.md)
- 已读 `AGENTS.md`、04-extensions、05-config、项目连接的字段与回执规格、已安装 Model Context Protocol（MCP，模型上下文协议）软件开发工具包（SDK）1.32.0 中的 `Client.connect`、`StreamableHTTPClientTransport._commonHeaders`、授权调用顺序，以及[官方协议的授权要求](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization#protocol-requirements)。授权是可选能力，受保护资源用 401 发起挑战。
- 全仓搜索了 `getForUrl`、`ensureRevision`、`captureCredentialSnapshot`、`new McpOAuthProvider`、`createSafely`、`authKey:`、`ScopedConnectionOwner`、连接状态、SDK 启动和凭据错误的生产调用与测试。最近的契约变更包括 `6e0a4b1a5` 持久代际和 `ea3d74192` 授权服务器签发方绑定。重点读了真实 OAuth 交换、进程间撤销、静态凭据和配置写入排序测试。所触及路径无用户界面自动化测试。
- 本批仅使用隔离项目、真实开发服务和本机协议端点。现有授权测试使用生成的本机协议凭据。本批没有模型调用或真实外部账号的验收需求。

## 现象与根因

1. 相同回环 HTTP（Hypertext Transfer Protocol，超文本传输协议）端点 `39883/mcp` 的真实新增请求 `7fe792bf-c690-46be-9a2a-8e393076e978` 与 `974b89f2-2c37-453c-8c01-ae08af329c8e` 都正常保存且首个 `initialize` 收到 200。默认分支停在首个响应之后并被投影为 `needs_auth`。显式 `oauth:false` 分支送达 `notifications/initialized`（202）与 `tools/list`（200），返回 `connected`。没有远程 401。
2. 持久凭据存储的 `ensureRevision` 给从未授权的连接创建只有 `revision` 的合法记录。当前 `getForUrl` 过滤整条记录，只有可匹配 URL（Uniform Resource Locator，统一资源定位符）和凭据身份的条目才保留。SDK 在每个 HTTP 请求前独立调用 `tokens()`。第一次正常捕获空凭据并返回空值。第二次取值拿到同一个空投影，将其中的 `undefined` 当作当前版本并与非空的入场版本比较，抛出 `MCP OAuth credential snapshot changed; retry connection`。真实隔离持久存储和 Provider 直接复现同样两次读取，存储版本仍完全一致。[隔离证据](../../artifacts/2026-11-12-mcp-public-remote-default-oauth/README.md)
3. 此本地错误继承 SDK 的 `UnauthorizedError`。由于没有披露存储令牌，`create` 按远程交互授权处理，发布 `AuthRequired` 并返回 `needs_auth`。旧代际与签发方加固的用例主要覆盖有凭据读写、真实挑战与回调。在没有令牌且服务能成功响应的情形，旧测试未执行随后继续使用同一连接的请求序列。工作台表单仅投影真实状态，问题在运行时凭据读取。

## 入口、终态与隔离

- 项目 `configure` 先通过项目配置提交及归并，连接由 `ensureConfiguredConnections` 进入 `createSafely`。启动或首次使用、显式连接和重试、普通工具/资源/提示读取同走项目连接。授权启动先以 `add` 进行同一连接预检，成功即可结束，真实 401 仍进入交互授权。授权启动与回调交换的另两次 Provider 构造使用 `authorization` 模式和持久 callback occurrence（执行轮次），交换完成后的重连再走 `add`。CLI（Command-Line Interface，命令行界面）也使用这些项目状态及授权入口。
- Task（任务）、Mission（使命）和 Session（会话）读取项目已观察目录时会看见同一项目状态。专家团、编排器和会话的私有连接，以及临时 scoped catalog（作用域目录）解析，显式传 `authKey:false`，不构造项目 OAuth 读取器。该分界由 `createSafely` 的五处生产调用和 Task API、编排器、会话 runtime owner（运行时所有者）共同核对。没有调度、队列、唤醒、运行轮次终态异常证据。此次缺陷是项目协议连接的错误终态及重试问题。
- 连接关闭、重新连接和后端重启继续从同一存储读取当前项目代际。项目凭据键按项目和服务名隔离，owner admission（所有权准入）、连接发布的配置身份校验、同服务并发归并及旧连接的终态清理继续由现有所有者负责。需要以两个不同项目同名连接并行请求、实际断开再连接、隔离进程重启验证。真实撤销、替换、刷新令牌写入和回调竞争用既有聚焦合同核对。
- 静态凭据是唯一其他生产调用者。它只需要同一 URL/配置身份的凭据材料，必须继续获得相同投影。没有存储格式迁移、公开接口或配置字段变化，没有对用户项目写入。真实外部 OAuth 发行方与模型调用不在本批验收范围。

## 实施与验收

- 将按 URL 读取改为从同一个持久条目一起返回代际和匹配的凭据。连接模式在返回客户端信息或令牌前以这个代际校验准入，再对匹配的令牌及绑定客户端执行现有快照比较。代际有效而缺少匹配材料可继续每次匿名请求，只有真实撤销或匹配材料发生变化时返回本地连接错误。SDK 的授权错误仍用于真正的授权流程。本地连接错误走既有脱敏失败映射。静态读取同用这一个投影实现。授权模式、写入时所有权、签发方和项目配置围栏沿用现有事实来源。
- 以同一真实协议传输运行一个正向核心合同，验证默认配置的匿名服务器经过初始化、通知、工具发现和调用。另在既有授权合同验证真实挑战、受保护凭据、跨进程版本与回调竞争。真实桌面以默认表单添加公共服务，检查连接状态、断开再连和重启后连接。两个项目以同名服务独立验证状态、配置和各自协议响应，最终关停隔离资源并检查数据库及零模型活动。
