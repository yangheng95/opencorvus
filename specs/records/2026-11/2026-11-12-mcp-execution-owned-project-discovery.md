# 项目发现尊重内置 MCP 的执行所有权

## Recall

- 用户要求本人持续按批次调查产品体验、功能和缺陷，先分析根因及影响并落盘规格，再实施、真实桌面交互、截图人工复核、聚焦正向检查、范围提交、合并上游与正常推送。上一批发现通用资源读取返回 500。手动断开修复与补齐生成接口规格已推送到 `8710b7ce5`，本地与上游 0/0，原 177 项工作区状态保留。[上一批真实运行记录](../../artifacts/2026-11-12-mcp-manual-disconnect-status/candidate-manual-evidence.json)
- 已读 `AGENTS.md`、04-extensions 的 Browser 和 Computer 执行所有权与配置契约、07-panel、capability-search-runtime，项目 `Config.get` 的内置声明注入与保留名验证，`MCP.createSafely`、`ensureConfiguredConnections`、`startConnection`、`MCP.connect`、`MCP.disconnect`、`HostSessionMcpRuntime`、Task（任务）专家团投影、连接 API（Application Programming Interface，应用程序编程接口）、`Command`、`/experimental/resource`、MCP App 与 SDK（Software Development Kit，软件开发工具包）生成路径。全仓搜索了所有这组生产入口、客户端状态类型、错误映射与真实作用域测试。所触及路径无 UI（User Interface，用户界面）自动化测试。
- 本批只使用本人的隔离项目、本机协议服务器和独立 Chrome。浏览器内置配置在基线取明确禁用以隔离 Computer 原因，开发后端另以独立浏览器模式运行。验收可通过真实协议能力和有归属的只读目录完成，无需外部账号、模型请求或调用桌面工具执行输入。

## 现象、根因与影响

1. 上一批内置默认配置下 `/experimental/resource` 的 500 已在实际日志定位到 `computer` 缺少宿主运行权限。本批隔离环境 `39892` 将 `browser` 禁用以控制变量，两项目均保存并连接同一个本地真实远程服务。主项目先请求 `/experimental/resource` 再请求 `/command`，另项目反序。四次均 500，首个失败的原因一致。主项目还通过正式接口及桌面分别点击 `computer` 的 Connect，结果都是 500。界面显示 `computer` Failed，同屏远程 `review-public` Connected，禁用的 `browser` 仍显示 Connect。六笔错误逐笔关联实际适配器诊断，项目外部服务协议初始化真实成功。[基线截图和接口](../../artifacts/2026-11-12-mcp-execution-owned-project-discovery/README.md)
2. `Config.get` 将保留名 `browser`、`computer` 注入有效配置，提供可供 Chat、Work 和 Task 分配的声明。项目连接枚举目前把全量配置的每条 enabled local 声明视作项目 transport 准入，`startConnection` 用项目 cwd 和普通 host process authority 直接启动适配器。Computer 真正的 Session（会话）或 Task owner 必须注入精确端点、授权和执行作用域，通用项目连接没有这三项，`ComputerHostClient.fromEnvironment` 因此拒绝。项目级 `assertConfiguredConnectionsSucceeded` 随后使整个目录错误，`Command.list/get` 在构建本地和远程命令集合时共享失败。显式 Connect 复用同一路径；浏览器还有项目级从禁用声明合成启用配置的旧逻辑，实际 Chat/Work 按持久配置与 assignment 决定是否创建自己的 owner。
3. 默认设置和独立项目都受影响。资源列表、命令列表及命令解析、项目 Configure/Connect、项目绑定工具及 MCP App 客户端共用项目接入机制，已逐一查阅。配置查询、项目状态和被动能力目录应继续展示声明，声明不会因此启动进程。直接 Chat/Work 的 `HostSessionMcpRuntime`、Task 与 Mission（使命）在已授权专家团投影时的执行连接走 `ScopedConnectionOwner` 和配置的精确作用域，Computer 端点由对应执行所有者注入。临时 scoped catalog、正常执行、重试、unexpected-close、Session dispose、Task/Mission 清理与多项目隔离使用现有精确 owner。此次证据定位到项目连接的错误准入和终态，未观察到任务调度、队列或唤醒异常。
4. 当前架构明确两类平台声明只是 capability inventory。项目层不得建立影子 Browser 或 Computer 连接。外部本地与远程连接、OAuth（开放授权）、配置启停、分配、持久状态和已有项目数据保持原合同。公共项目状态需要表达该连接的执行作用域，显式控制对错作用域应有稳定错误。真实远程故障仍按原项目发现错误处理。本批不改变外部服务列表失败的既有政策、产品分配权限或 Browser/Computer 进程实现。

## 实施与验收

- 以现有保留名作为执行连接的唯一身份判定。在项目共享接入函数排除它们，并在项目直接连接/断开以及直接创建入口按同一判定拒绝。删除项目级把禁用 Browser 声明转成运行配置的旧入口。正常项目枚举与错误断言使用同一接入集合。
- 项目/有效状态和配置回执用同一声明投影，保留现 `disabled` / `disconnected` 判别，给内置行增加 `scope:"execution"`，后者表示当前项目只观察声明。显式项目 Connect/Disconnect 对该作用域返回同一个具名 409 错误。项目连接面板保留配置禁用和普通连接状态，以当前语言标明执行所有权并去除无权限的项目操作，沿用现有 Chat/Work 分配入口。更新已生成的接口结构与 SDK 类型。
- 核心正向检查项目真实资源和命令目录、内置声明及稳定的控制错误、合法的独立 scoped owner、普通连接和真实故障合同。实际开发后端用两个独立项目重跑同样正式路由与命令模板，核对本地命令、外部协议资源/提示、项目配置和进程事件。桌面用两个界面语言复核内置声明、分配导航和外部服务的连接控制，复拍候选状态。关停隔离资源并核对零模型活动。
