# SDK 按逻辑路由绑定项目目录

## Recall

- 用户要求本人独立持续批次迭代，先完整根因/影响分析并落盘，再实现、真实桌面交互和截图人工复核、聚焦正向测试、范围提交、合并上游和正常推送；不用子 agent。上一批 `1fb751cef`、`a7b541a99` 已推送，原 177 项状态保持。
- 已读 SDK 当前工厂、生成 HTTP（Hypertext Transfer Protocol，超文本传输协议）与 SSE（Server-Sent Events，服务器推送事件）客户端、请求拦截器、服务 URL（Uniform Resource Locator，统一资源定位符）构建、transport-protocol（传输协议包）目录策略、项目/附件/会话公开路由及当前控制/界面架构。全仓搜索 `directoryScopedFetch`、`withDirectoryQuery`、`routeRequiresProjectDirectory`、SDK 构造与自定义 fetch、相同策略测试和历史；策略唯一来源是 transport-protocol，SDK 的 route-policy 是正式构建生成件。
- [Hey API 官方 Fetch 文档](https://heyapi.dev/docs/openapi/typescript/clients/fetch)支持请求拦截器及每请求 baseUrl/fetch 配置。当前锁定生成代码的拦截器同时接收最终 Request 和原始端点 options，普通与 SSE 都经过此处。本批直接复用此 primitive（基础组件），不另存服务前缀、不硬编码路由白名单。
- 目标：默认项目目录由真实逻辑端点的统一策略决定，与部署前缀、逐请求 baseUrl/fetch 无关；明确传入的目录查询仍保留，正文/头/认证/信号和事件流不变。真实服务应接受所选 B 项目的读取、上传和会话创建；网页人工核对该真实会话和原件。

## 真实基线与完整影响分析

1. 自有隔离开发服务 `40172`、真实转发代理 `40176`、本机精确 local 流式参与者 `40178`。两项目 A/B 已分别通过直接公开接口确认身份。SDK 配置默认 B 目录，普通 `/api/opencorvus` 前缀的项目读取正确，但全局 health URL 错加目录。前缀 `/global/opencorvus` 下项目读取、附件上传和 Chat 创建全部得到明确 `DirectoryRequiredError`，实际转发请求缺少目录。
2. 服务的现有目录校验正确拒绝这些请求，没有误写到 A；此前仅作为待核对风险的“可能选错项目”由真实证据收敛为请求失败。基线网页诊断会话通过直接服务在 B 创建，明确记录 `uiVia=direct-diagnostic-service`，不冒充失败前缀已经可用，也不向历史写入伪错误消息。
3. 根因是工厂把目录政策装在自定义 fetch 外壳里，以完整 Request URL 的 pathname 判断逻辑路由。部署前缀会污染分类：普通前缀使全局路由被当成项目路由，恰与全局前缀相同的路径又使项目路由被当成全局。URL 构建已经正确保留服务前缀，简单删前缀或硬编码 `/api` 会形成另一套地址策略，无法覆盖逐请求地址。
4. 生成客户端允许每请求 fetch 替换配置 fetch，故原外壳还会被真实的逐请求传输选择绕过；同一逻辑端点丢失工厂目录。生成请求拦截器在普通 HTTP 和 SSE 建立请求时均获得原始 `options.url`，并在最终 fetch 选择之前执行；它才是统一执行当前目录策略的位置。旧路径未根治是因为此前仅验证根地址工厂传输，本月来源地址批次才显露前缀条件。
5. 影响所有通过当前工厂使用默认目录的 SDK 调用，包括扩展/ACP（Agent Client Protocol，代理客户端协议）、项目/会话/上传、事件订阅、界面底层连接及其他消费者；全局路由和混合路由成员仍由唯一共享策略识别。显式每请求 query directory 应覆盖默认值，认证头、请求体、方法、AbortSignal（中止信号）、自定义 fetch 和生成错误合同保持。直接构造底层生成 transport 或单独替换 options.client 不属于工厂配置，不为其暗中注入目录。
6. 不改变服务端权限、参数校验、Task/Mission/Session 调度或 occurrence（执行轮次），不修改数据库/持久格式、模型/凭据、HTTP schema（接口结构）和语言正文。项目目录是数据完整性边界，不是 host 教模型选工具的流程 gate（流程门）。没有执行/终态异常，基线三项失败是明确输入参数错误；不据此重写共享调度。
7. 风险包括每请求 baseUrl/fetch、SSE 重连及已显式目录被覆盖、路径参数未替换时策略误判、body/headers 被重建损坏。使用官方现有 Request 重建方式和逻辑 URL，覆盖实际方法与路径参数；不复制共享路由列表。仅本机 HTTP 转发验收，不宣称公网反向代理、认证、HTTPS（HTTP over TLS，加密超文本传输）部署或完整网页子路径托管已通过。

## 方案与验收

1. 删除目录 fetch 外壳；在同一 createClient 实例注册请求拦截器，以生成端点 `options.url` 和实际方法调用唯一目录策略。只有需要项目且尚无明确目录查询时追加默认目录；用户 fetch 与默认禁超时配置保持各自既有合同。
2. 正向聚焦测试根地址、普通前缀、与全局路径重合的前缀、全局路由明确正确 URL、逐请求 baseUrl/fetch、显式项目覆盖、实际二进制 body 和 SSE 事件输出。禁止负向核心断言及 UI（User Interface，用户界面）自动化。SDK 正式构建、相关类型/路由/文档检查分别核退出码。
3. 新候选服务 `40174`、代理 `40180` 同样运行公开读取/上传/创建/流式回复，返回项目身份必须精确为 B；原件地址和下载字节正确。通过真实 `/ui/` 展开候选、截图人工核对及实际下载。事件订阅通过真实 checker（检查器）验证，不把 fixture（夹具）流当产品端到端。
4. 整理真实结果和限制、范围提交；保留 177 项原状态，fetch/merge 上游、完整待推集合审查、正常 push，继续下一批。无版本/Release/tag/拉取请求。
