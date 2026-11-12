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

## 命令回执的追加根因

- 项目接入修复后，真实 `/command` 走到了之前被 500 掩盖的序列化。候选进程 13512 在两个项目并行请求时发送了 200，公开接口检查发现远程行的 `template` 违反字符串合同。进程随后以未处理拒绝和关闭项目实例 lease（租约）错误退出。独立重启 25820 后，仅一个项目的真实请求 `7f4b1912-16a2-4830-888e-dc5beffba42b` 重复得到本地模板字符串、远程模板 `{}` 和同一退出。没有模型调用。[实际回执和进程记录](../../artifacts/2026-11-12-mcp-execution-owned-project-discovery/README.md)
- 全仓找到 `Command.list` 的唯一生产调用在 `/command`，`Command.get` 的唯一生产调用是 Session 显式命令执行。远程模板是 getter（属性读取器），返回未等待的 Promise。原 HTTP（Hypertext Transfer Protocol，超文本传输协议）路由把命令定义直接交给 JSON（JavaScript Object Notation，数据交换格式）序列化。序列化触发 getter，并把 Promise 当作空对象输出，`Instance.provide` 随响应结算关闭请求租约，而 Promise 之后仍调用同一实例的 `MCP.getPrompt`。进程错误处理按原合同终止未处理拒绝。公开 OpenAPI 规格本来就承诺字符串。旧 Session 命令执行在活跃租约内显式等待模板，其正向测试不会触发公开列表的退出。
- 核对同一租约的完整生产边界，包括通用项目路由的 `Instance.provide`、命令列表、命令执行、同项目重复请求及两个独立项目的并发和重启。Task/Mission 的运行及关闭拥有独立入口和持久执行权，未调用 `Command.list` 或其模板属性。这个失败源于 HTTP 完成前遗留的命令工作，现有中间件、租约生命周期、任务调度、恢复和项目隔离继续作为边界。修复由命令列表在活跃作用域内解析模板，返回字符串快照。Session 精确命令仍按需读取其模板。返回真实错误时由现有 HTTP 错误处理结算，无额外异步重放或生命周期延长。

## 实施与验收

- 以现有保留名作为执行连接的唯一身份判定。在项目共享接入函数排除它们，并在项目直接连接/断开以及直接创建入口按同一判定拒绝。删除项目级把禁用 Browser 声明转成运行配置的旧入口。正常项目枚举与错误断言使用同一接入集合。
- 项目/有效状态和配置回执用同一声明投影，保留现 `disabled` / `disconnected` 判别，给内置行增加 `scope:"execution"`，后者表示当前项目只观察声明。显式项目 Connect/Disconnect 对该作用域返回同一个具名 409 错误。项目连接面板保留配置禁用和普通连接状态，以当前语言标明执行所有权并去除无权限的项目操作，沿用现有 Chat/Work 分配入口。更新已生成的接口结构与 SDK 类型。
- 核心正向检查项目真实资源和命令目录、内置声明及稳定的控制错误、合法的独立 scoped owner、普通连接和真实故障合同。实际开发后端用两个独立项目重跑同样正式路由与命令模板，核对本地命令、外部协议资源/提示、项目配置和进程事件。桌面用两个界面语言复核内置声明、分配导航和外部服务的连接控制，复拍候选状态。关停隔离资源并核对零模型活动。
- 命令列表具体化所有模板后再返回响应，公共结构直接定义字符串，命令执行继续复用同一个提示解析。真实接口验证两项目的远程模板原文和本地模板，重复读取后同一个后端保持健康，核对实际 `prompts/get` 请求与 200 的时序。

## 结果

- 最终后端进程 19964 在两项目按不同顺序并行运行正式资源与命令请求，均为 200。主项目资源和命令请求分别为 `7ee28a8c-5053-441b-9a06-87937a78e520`、`cf448716-8b41-48a0-b1ee-0dfeb6ff123c`。第二项目将 Browser 恢复为默认声明，与默认 Computer 同时保留。两个项目都保留本地命令模板 `isolated project command`，远程模板准确返回 `actual isolated MCP prompt`。四次实际 `prompts/get` 均在对应 200 的请求区间完成。直接连接和断开内置声明均返回精确的 409 和服务名。通过实际 `POST /mcp` 保存 Computer 声明仍返回执行所有权。候选的三次启动记录都来自外部 `review-public`。
- 最终 `39893/ui/` 提供 `main-BlDFmdal.js`。首拍发现两个内置行的所有权文字位置不一致，调整为同一位置，并去除没有项目级操作的行的悬停样式。本人重拍并复核双语 04–09，实际打开对话和通用工作分配。外部连接的手动断开和重连分别为 `ebbc0c48-0f60-4182-80be-d05e59e5196e`、`451d905c-b9d6-4954-b79b-61c43c1a6484`。主项目断开期间，另一个项目的同名外部连接保持已连接。
- 正常化后的公开结构经实际接口验证，最终健康请求 `cee44638-e956-414a-8b8c-4059567c9b08` 返回 200。读回和协议证据属于同一个最终进程。11 个核心和 19 个前端聚焦合同测试通过，含 Session 命令执行、真实提示和资源、独立作用域清理与普通连接。核心和前端类型、3208 条双语键、最终构建、生成的 OpenAPI（开放接口描述）和客户端、双语接口参考及架构索引通过。
- 最早两次核心类型检查暴露项目稀疏配置的类型边界，保留原项目配置校验后的输入约束并重新检查。最终两份隔离会话完整，数据库检查通过，消息、任务、模型活动为零。基线和最终服务正常关停，两次未修复命令探针按证据退出，专用浏览器和回环监听均已关闭。[候选桌面与接口证据](../../artifacts/2026-11-12-mcp-execution-owned-project-discovery/README.md)
