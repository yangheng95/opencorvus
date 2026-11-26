# 无请求次数上限的真实任务恢复验收

## Recall

- 用户要求本人持续独立改进当前 OpenCorvus，先落盘根因及影响分析，再修复、真实页面交互与截图人工复核、聚焦正向检查、范围提交、上游普通合并及正常推送；不用子 agent，不把只有验收记录当成产品改进。
- 用户在 2026-11-27 明确撤销模型请求次数限制。继续使用已授权的现有 Provider（模型服务提供方）凭据及完整模型目录，目标仍为 GPT-6.1 Sol；所有调用必须流式，实际模型和物理请求保持可核查。上一批 32/32 是已结清的历史事实，不改写其结果，不将其剩余量复用为新上限。
- 上批提交 `9d2993d9b` 已推送，修复检查器漏传必填 `promptProfile`。真实首 Task 完成，第二 Task 因原授权次数上限失败，取消与重启阶段未进入。已重读其完整 Recall、结果、当前控制面及审计代码。当前起点工作区仍为原 177 条状态，已独立保存；不创建分支或工作树。
- 读取并定位 `task-control-check` 的 driver、三个阶段、请求结算、配置读取与复制凭据边界；读取 `RealProviderAudit`、现 native-provider-audit-plugin、evolution-diagnostic 及实际 HTTP（超文本传输协议）审计正向测试。所有相关无上限实现已经统一用 number|null，环境中以 JSON（结构化数据格式）字面量 `null` 表示，无需发明另一种状态或配置面。

## 请求额度接入分析与实施边界

- 现象与直接触发：现 Task 检查器对环境值做 `Number()`，driver 只允许正整数，阶段也强制转换为 number；显式 `null` 会得到 NaN 并被拒绝。用户新授权无法通过当前入口表达，而公共审计器本来支持 null 并继续逐次记录请求。
- 数据流根因：检查器的父进程、阶段环境传递及余额运算只承认有界整数，把更完整的已有审计合同收窄了。此前只用明确有限额度，没有运行这个新授权分支，局部 32 次验收不能证明无上限路径。
- 全仓搜索结果：`RealProviderAudit` 已将 maxRequests 定义为 number|null，并在非 null 时才执行预算拒绝；原生审计插件用 JSON.parse 读同一语义，evolution diagnostic 显式传 `"null"`。本次仅让 Task 检查器遵守现有合同，不修改 Provider、LLM（大语言模型）工具、角色、生产调度或权限。
- 方案：父进程以 JSON 解析现有 `TASK_CONTROL_CHECK_MAX_REQUESTS`，保留默认 256 和显式正整数；允许 null。阶段参数、传递及余额改为 number|null，只有有限余额才比较与扣减；阶段仍使用原 RealProviderAudit。运行记录保存实际 null 与完整累计数，禁止使用 Infinity、伪造很大整数、另设开关或跳过审计。
- 风险与验证：有限阶段的零余额仍由审计器返回明确预算错误；原整数语义必须保留。运行现有真实本地 HTTP 正向无上限/有界审计测试与脚本专项类型检查，再用明确 `null` 运行原完整真实检查器。局部 HTTP 测试只验证审计合同，不能代替模型或桌面验收。

## 真实验收与问题处理

1. 新独立运行根与项目，成对复制现有 auth.json、models.json；分别验证凭据可用、精确模型目录投影与实际请求 gpt-6.1-sol，所有请求流式。必要刷新只通过原授权源的现有凭据交换所有者，不刷新复制副本，不输出凭据。
2. 重跑原首 Task 完成、执行中进度问题、先进先出输入、进程重启、取消回执与重启后清理的全部阶段。保留真实事件、Message/Tool、完成决定、进程及请求回执；无实际活动 180 秒失败，轮询不续时，定时查看活跃进程句柄和结果。
3. 任何调度、队列、唤醒、恢复、并发或终态异常立即横审共享机制：全部生产入口，Task/Mission/Session 的执行轮次，正常与终态，重试与重启、串并行及多项目隔离；不得将模型自述、一个场景通过或最后错误标题当作根因。完成观察、触发、数据/控制流、历史未根治原因、定义/调用、数据/测试/文档/交付与风险分析并补充本规格后再修改。
4. 开发服务 `/ui` 使用专用桌面页面，真实查看工具、成员会话、结果与错误，截图人工复核；不运行或创建界面自动化测试。只对已证实问题做产品修改，修复后回到原真实验收。
5. 相关正向测试、必要类型/文档检查与人工差异复核后，完成范围提交、fetch/merge、完整待推集合检查和正常 push。保留原 177 条状态；任何未满足要求如实列出，不宣称持续目标已完成。

## 真实运行发现：SDK 流错误丢失当前类型

- 可观察现象：无上限首 Task `tsk_g00Vc6QvBM00Fn9ccu0y` 已真实完成。第二 Task `tsk_g00Vc6RG7s00NSSwd2vN` 的成员收到实际过载流错误，页面及原始成员生命周期是 `UnknownError: AI_StreamProviderError: Our servers are currently overloaded. Please try again later.`。真实 Task Board 显示该 Task 后来收敛为 failed，原完成/失败执行轮次均保留；尚没有证据证明队列丢失或终态卡住。
- 直接触发与数据流根因：当前 AI SDK 7.0.138 把合法 Provider 流错误规范为 `StreamProviderError` 实例，提供 code/type/message/data。共享 `ProviderError.parseStreamError` 仍把实例直接交给要求外层 `type="error"` 的传输解码器；SDK 实例的 type 是 Provider 类型，因而无法解码。`Message.fromError` 又在原始流错误解析之前用通用 Error 分支返回 UnknownError，第二次丢失结构。现错误类判断和消息持久化都有相同缺口。
- 历史未根治原因：原 `provider-stream-error` 正向测试只送原始嵌套/平铺对象，确实证明了那一层协议，但没有让当前 SDK 从真实 HTTP 事件流生成实例。当前 SDK 自带源码、normalize-stream-provider-error 和官方[StreamProviderError 文档](https://ai-sdk.dev/docs/reference/ai-sdk-errors/ai-stream-provider-error)一致，识别应使用 SDK 的 isInstance；isRetryable 不等于可以自动重放已消费输出。
- 横向影响审计：`LLMActivity` 的共享分类用于 SessionProcessor，以及 memory organizer、提交说明和标题的 collectLLMText；Task 的 Orchestrator、Worker、普通 Chat/Work、Mission、ACP（Agent Client Protocol，代理客户端协议）及相关 Message/Session writer 共用 `Message.fromError`。代码调用点已全仓检索。错误投影是显式输入上的纯转换，没有队列、唤醒、租约、执行轮次、跨项目缓存或新的共享状态；正常完成及已持久化历史错误不改写。SDK 上下文溢出实例也会丢失既有 context_overflow 分类，影响现有压缩恢复入口，须用明确 code 的正向测试验证，不以自然语言关键字猜测。
- 修复方案：仅在 Provider 层通过 SDK 类标记把当前实例的明确元数据与原始 data 投影到已有流错误合同，继续用唯一解码器与结构化脱敏。Message 的通用 Error 分支让当前 SDK 流错误进入原有一次流错误映射，删除不了解错误类型的提前吞并；保留其他 Error、APICallError、取消和已规范错误的原优先级。正常 Provider 流错误仍为非自动重放的 provider_stream_error，上下文溢出沿原 context_overflow 入口，不新增重试、后备 Provider 或宿主工具路由。
- 公开合同与数据：使用既有 APIError/ContextOverflowError 和诊断正文，不增加持久化格式或 schema，不迁移或重写历史 UnknownError。保留 Provider 消息、code/type 和原始数据的结构化脱敏结果；不把 SDK 推导的状态伪称为真实 HTTP 状态。风险是包装元数据与原始诊断的展示、敏感字段和部分输出归属，需明确正向检查。
- 验证计划：先增加真实 SDK 实例及本地真实 HTTP 事件流的复现测试，证明当前错误，再修复并验证正常 API 错误、上下文分类、原始流对象和 SDK 对象、部分文本保留及单一终态。现无上限运行按原进程句柄结清后，再以新根重跑完整真实 GPT-6.1 Sol 检查器和桌面复核，不把局部 HTTP 合同测试冒充真实 Provider 复验。

## 第二轮终态检查：进程归属证据待补齐

- run2 首 Task 完成、运行中进度响应、两个持久输入的重启顺序恢复均通过。取消受理约 94ms，唯一取消终态在约 10080ms 形成；Task 已 cancelled、当前 prompt owners 与 started-incomplete frontier 均为空。第三阶段在全局 `metricsSnapshot().live=1` 处失败，未执行其后的原进程 PID 核对，因此不能宣称清理验收已完成。
- 共享机制横向调查：Task 工具、文件 broker、MCP（模型上下文协议）与进程 facade 均通过显式 Task identity 注册；Chat 的 Host 进程、项目索引和浏览器宿主则进入同一全局 registry，但没有 Task identity。Task 取消 barrier 只收拢该 Task mandatory 注册、执行 capsule 和物理终态，auxiliary 有独立清理边界；其他 Task、Mission Session、项目 Host 不能由一个 Task 的取消清理。正常退出 unregister 与重启 Windows orphan recovery 共用原始物理结算证据。当前检查器用全局数量判失败，错误却只保存数量，既无法定位 owner，也不能排除其他范围。
- 未知与实施顺序：目前无法证明这个 live handle 属于目标 Task、其他执行轮次或服务自身；不得先改成局部计数放行，也不得改调度/取消机制。先让原检查点与失败诊断保存已有完整全局 owner/PID 和精确 Task owner/PID；不更改原验收条件，再运行同一完整 checker 取得真实归属证据。随后核对全生产入口、正常/终态、重试/重启、串并行与项目隔离，才决定修复范围。
- 数据、测试、文档和风险：此步只增加现有诊断的进程元数据，不含命令正文、环境或凭据，不改变产品与持久数据；正向验收仍由真实 checker 负责。原阶段进程已确认退出，后续使用新的成对授权凭据/模型副本，不复用活跃旧进程。

## 已实施与聚焦验证

- run3 的原验收失败定位到全局 `process:run-host` owner/PID 6816，而同时记录的精确 `taskProcessMetrics={live:0,owners:{}}`、Task cancelled、prompt owners 和 started-incomplete 均为空。`Process.runHost` 唯一默认 owner 经 supervisedHostProcessFacade 注册 `spawnHostCommand`，没有 taskID；Task facade 则显式注册 `spawnTaskCommand`。因此已用真实失败诊断与共享实现排除这次计数的 Task 清理根因，原检查器把 Host 的公开生命周期错当成目标 Task。
- 修复前全仓搜索 `processMetrics`、`taskProcessMetrics` 和 checker 结果消费者，当前只由该脚本输出，无独立产品接口或数据迁移。方案是将取消后通过条件绑定已有 `taskMetricsSnapshot(taskID)`，完整全局快照继续作为诊断输出；不按 owner 名白名单剔除，不等待或杀死别的范围，不改取消生产逻辑。原始 worker、取消前受监管根及继承句柄子进程的旧 PID 核对全部保留。错误与成功结果同时保留两个集合，再回到完整真实 checker 复验。

- Task checker 已按现有 number|null 审计合同接入显式 null，有限余额仍按原累计方式结算；真实每次流式请求保留完整回执，不设置替代次数上限。
- `ProviderError.parseStreamError` 通过当前 SDK 标记投影明确元数据，`Message.fromError` 的通用 Error 分支不再提前吞掉该类型。原单一传输解码器、结构化脱敏、ContextOverflowError 与终态策略继续作为事实来源；当前 Provider 架构同步说明此边界。
- 在修改产品前，SDK 过载、SDK context code 与本地真实 HTTP → 当前 OpenAI adapter → AI SDK 的部分输出后错误三个正向用例均复现失败。修复后 `bun test --timeout 60000 ./test/provider-stream-error.test.ts ./test/provider-error-redaction.test.ts` 为 14 pass、45 个断言。本地事件流的输出前错误明确产生 APICallError/503/server_5xx；输出后产生 StreamProviderError/provider_stream_error，并保留原部分文本及唯一 failed 终态。两种当前合同分别验证，不将前者改成后者。
- 无上限/有限末次/余额耗尽三个既有真实本地 HTTP 审计用例为 3 pass、11 个断言。`process-checkpoint-lifetime.test.ts` 原生进程正向检查为 4 pass、14 个断言，覆盖 mandatory/auxiliary、两项目并行、同 Task 串行检查点及失败后原错误与下一合法命令输出；此处 Task 数据由 fixture 建立，不能声称为模型端到端验收。
- 包含 checker 及所有可达核心声明的专项 TypeScript 检查通过；`bun run docs:check` 和 `bun run check:architecture-index` 通过。未新增或运行任何界面自动化测试。
- 真实页面人工复核：run1 完成 Task 和成员原始消息、实际过载 UnknownError；run2 重启后两个用户输入及按序原始回答；run3 完成 Task 的成员报告与展开的 manage_task 完成决定。截图分别绑定真实运行和 Task 身份。模型原文保留英语，页面控件使用当前中文；未改 UI 产品源码。截图中旧服务下线对应 checker 的预期阶段切换，不据此认定连接缺陷。
- 边界：候选真实 GPT 运行已验证正常输出与恢复路径，但尚未再次发生同种远端部分输出后过载。错误修复由真实 SDK/HTTP 正向复现及分类证明，不伪称远端故障已经重现并通过。

## 最终真实运行结果

- run4 三阶段全部通过，driver 退出码 0。该轮实际观测 41 次 `gpt-6.1-sol` 流式请求，三个阶段审计均落盘、成对授权副本清理通过。整批四轮累计 181 次同模型流式请求，无替代次数上限。原失败、未进入阶段、reading/awaiting_response/fetch_failed 与 aborted 快照全部如实保留；阶段记账完整不等于被骤停请求收到 EOF。
- 正常 Task `tsk_g00Vc6XOYf00cAQ6V7v2` 使用真实成员最终报告、精确生命周期 `pev_g0Vc6XrQ1009PJDsdsH6` 与同轮控制输入 `art_hmxGKuw8XFI0i21F5Llw` 完成。本人在真实候选 `/ui` 展开 manage_task，核对已完成状态、成员文件内容检查结果及工具原始完成回执，截图落盘。
- 控制 Task `tsk_g00Vc6XvsG00uCbRWrO3` 的进度输入在 267.187ms 进入处理，子工作当时仍运行。两条持久恢复输入在重启后分别于 1795717277900、1795717297631 激活，严格按接受顺序处理。首次激活在旧租约到期约 15ms 后，尚未评估降低该等待的产品改进，不将正确性通过解释为恢复延迟最优。
- 取消请求约 66.017ms 受理，精确事件 `pev_g0Vc6YobB00Qb6dscQck`；唯一取消终态在 10081ms 形成。再次重启后原重复取消复用同一请求事件；Task 状态 cancelled、控制输入均 terminal_inapplicable、物理执行前沿 settled，prompt owners 与 started-incomplete 为空。
- 目标 Task 进程集合 `{live:0,owners:{}}`，原工具 PID 32984、继承句柄根 PID 28128 和后代 PID 16684 均通过原操作系统存活核对。全局仍有 Host `process:run-host` PID 28660，完整保留在结果，既不伪称该进程属于 Task，也不清理其他范围。
- `request-accounting.json`、`model-request-audit.json`、`task-facts.json` 及各轮预检/检查点保存上述可核查事实；没有将源码摘要作为验收条件，没有将 `source.patch` 或用户无关改动纳入证据提交。提交前范围审查与原始凭据值扫描通过；交付使用当前分支普通合并与正常 hook（钩子）推送，Git 结果另由真实命令核对。
