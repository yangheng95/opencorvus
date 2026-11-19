# 代理前缀下的网页实时事件

## Recall

- 用户要求本人独立持续迭代，先落盘完整根因和影响，随后聚焦正向测试、真实桌面互动与逐图复核、范围提交、合并上游和正常推送。上一批 `944bee2d0`、`644653061` 已推送，与上游 0/0。保留 177 项原状态。
- 已读 11 月 9 日工作侧栏验收代理、上一批网页默认连接、本月软件开发工具包路由目录、10 月连接归属和当前 05-config、07-panel、server-runtime-readiness。全仓搜 `openStream`、`openSocketStream`、`apiUrl`、`STREAM_SOCKET_TARGET_HEADER`、`startSSE`、`startWorkLedgerSSE`、`work-ledger.connected`、`project.updated`、`routeRequiresProjectDirectory`。已核对 Browser 和 Tauri 宿主共同 transport、后端 ticket 准入及派发、调用方事件处理、重接和注册项目读模型。已找到非界面 `stream-socket-runtime.test.ts` 和 `stream-socket.test.ts`。
- 目标为通过保留双向升级的隔离反向代理打开真实桌面页面，直接连接并接收共享侧栏事件。已打开页面随第二项目登记收敛，仍能选择两项目并保留精确目录。代理入口与服务内部目标各有且只有一个所有者。根地址行为、查询、方法、数据、请求归属、终态及清理沿现有合同。

## 基线、根因和影响

1. 上一批只转发普通 HTTP（Hypertext Transfer Protocol，超文本传输协议），那一轮不能判断实时故障。本批先换成支持 WebSocket（双向网络连接）的隔离代理。实际 `40226/team/ui/edge/ui/` Online、主区显示 `live-project-review`，侧栏持续显示 `No work yet.`。代理记录健康 200、流准入 200、真实升级 101。浏览器传出的内部流目标是 `/team/ui/edge/work-ledger/events`。隔离目录第二项目通过真正的 `/path` 登记，公共 `/work-ledger` 200 返回两个项目，打开中的代理界面继续没有项目。直接访问同一后端 `40222/ui/` 看到两个项目。没有运行任务、工作流或模型，两个项目登记是隔离测试数据。
2. 用同一转发器和实际服务握手，控制唯一变量 `x-opencorvus-stream-target`。带前缀的请求准入 200，升级后 `response` 为 400、`streaming=false`，返回具名 `DirectoryRequiredError`，实际发现目标目录策略按错误路径识别。使用服务器相对的 `/work-ledger/events` 时准入仍 200，升级后 `response` 为 200、`streaming=true`，真实流发出 `work-ledger.connected`。验收工具第一次解帧把局部 `event` 误写成覆盖形参，修正临时工具后重跑同一对照记录，不把工具错误当生产现象。
3. `tauri-transport.ts` 给普通请求构造带前缀的公开 URL（Uniform Resource Locator，统一资源定位符），物理流又把其 `pathname+search` 原样作为内部目标。代理正确剥离外层准入路径并透明转交目标头。服务器将该头按当前监听服务重新建请求，所以部署前缀混入内部路由。根部署的公开路径和内部路径相同，现有根端口测试及 11 月 9 日同样只对照升级能力，因而未覆盖这次前缀错误。重试仍复用同一构造，物理升级成功及健康 Online 不证明流已可读。
4. 共同物理路径覆盖全局 Work Ledger 与 Mailbox/Memory 触发、选中 Task（任务）和 Session（会话）事件、Mission（多步任务）的 Session 事件、Side Chat、交互产物的 MCP（Model Context Protocol，模型上下文协议）事件、Panel message 和版本控制提交消息的 `POST` 流。消耗真实业务流前皆调用同一 `openSocketStream`，没有生产者可自行去前缀。选中 Task 的 `after` 与 live replay 查询、会话的明确目录、全局事件与两个写入流的既有目录规则需保留。底层 SDK（Software Development Kit，软件开发工具包）的 HTTP 事件流走另一种公共路由，并不读取此内部目标头。
5. 共性审计已查首次连接、切换项目和会话、连接变更后退休、正常接收、错误重接、任务完成投影、进程关闭和再启动。浏览器和原生端依据同一 API（Application Programming Interface，应用程序接口）归属，连接轮次变化已有 `onAuthChange` 中止并交回旧所有者。服务每次准入生成一次性同 Origin ticket，各流依据自己 `STREAM_INSTANCE_QUERY_KEY`、控制器、回执和原目录分开，进程关闭清理。观察到的是所有这些入口的统一路由问题，尚无证据表明执行记录、分派、并行隔离、持久轮次、恢复工作或终态本身损坏。真实基线串行对照和同页重接均保留唯一项目和正确连接；候选再验证多项目同时可见、退出后重开及有真实多连接的运行时测试。无授权的模型执行轮次在本批保持未覆盖，不能据此宣称收敛测试通过。
6. 风险为错误移除同名业务路径片段、损坏目录和普通查询、让事件跨端点或重复启动、伪造仅升级成功的验收。修复从逻辑路径构造一次真实内部目标，再按现有已应用服务地址形成外部路径。已公开 HTTP 接口、服务验证、鉴权、执行路由和存储格式不需变化，也不在代理改写头以掩盖产品失败。

## 实施与验收方案

1. 共用现 `apiUrl` 的相同路径和查询构造，允许传入已捕获的服务基地址以选择根路径解析。`openSocketStream` 捕获当前实际服务地址，一次构造查询含流标识的内部路径，头仅提交这条服务相对路径。按同一地址形成带部署前缀的诊断 URL（统一资源定位符）与物理准入/升级地址。两次物理动作共享同一入口，认证、目录、请求正文、AbortSignal（中止信号）、既有业务重接与关闭保持。普通传输沿用当前构造默认值。
2. 聚焦正向测试从实际连接传输读取物理准入路径、请求方法/正文、内部目标/精确目录、查询和流身份。重跑现有真实监听器测试，并覆盖多个独立连接的正向事件输出。启动正式构建 `40224` 和完整转发 `40228`，同一真实界面先看到第一个项目。在已经打开的页面连接内，通过合法 `/path` 登记第二个项目，不刷新页面就显示两套身份。通过键盘打开第二项目并复核真实路径或设置的作用域。记录真实转发、实际 socket 的正向事件、真实列表和逐张截图，不建立 UI 自动化。
3. 保留初次及重接/重开的实际流证据。退出时核隔离服务归属、模型未调用及正常关闭。Overlay 类型、语言、构建、文档/架构与路由检查通过后提交；合并上游、检查完整待推集合和正常推送。

[真实基线及通路对照](../../artifacts/2026-11-19-prefixed-stream-target/README.md)
