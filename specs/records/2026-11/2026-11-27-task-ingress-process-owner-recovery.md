# Task 根输入的物理进程所有者恢复

## Recall

- 用户要求持续独立迭代直到明确停止，每批先完成根因和影响分析并落盘，再修复、聚焦正向验证、真实 GPT-6.1 Sol 流式任务与桌面截图人工复核、范围提交、上游普通合并和正常推送；禁止子 agent（代理）。用户已撤销模型请求次数限制，现有凭据和完整模型目录继续授权，逐次请求仍审计。
- 上批 `d18ef4be96b2846dd53ac63043fe43a83979e5ef` 已正常推送并确认远端一致、上游差距 0/0、原有 177 条工作区状态精确保留。本批初始状态另存 `%TEMP%/opencorvus-iteration-20261127-dead-owner-recovery/initial-status.txt`。不得创建分支、工作树或改动无关文件，三个脏规格索引只能暂存本批自己的新链接。
- 已重读上一批 Recall 与最终结果、当前 Task 控制面架构、`task-root-ingress-delivery` 的获取/续租/分页扫描/重启/终态、`task-root-fact-store` 和纯 reducer（归约器）、共享 control-lease 与 process-liveness、Session 的中断结算、Mission 恢复及权限 effect（外部效果）物理恢复。全仓搜索当前租约定义、全部 18 个生产 owner（所有者）/25 个获取点、相关实际调用和正向测试；没有运行界面自动化测试。

## 实际现象与当前根因证据

- 上批 run4 正常 Task、顺序恢复和两次重启取消全部通过，但恢复首输入 `art_huus3St4IUqc10rdB0jD` 持续保持旧 leased（已租用），后继 `art_hvmJwNmXv23sC3JUvXOv` 保持 ready（就绪）。旧租约到期 1795717277885，新激活 1795717277900，约晚 15ms；同一运行的旧成员分派早在 1795717160840 已按真实进程死亡恢复为 AbandonedDispatchError（分派所有者已丢失），不是模型一直推理造成约两分钟等待。
- 可核查基线是上批已提交的请求、Task 事件、恢复检查点与规格记录；后续补充从原保留数据库只读导出的精确租约、不可变 grant（授予）与 runtime_process（运行时进程）身份，不重新运行基线来伪造更好比较。
- 直接触发：backend（后端）在 Task 根输入的执行轮次持有有效 120000ms 租约时退出。共享 Task 扫描器先恢复已死亡成员分派，随后 `terminalizeExpiredTaskRootAssistants` 只查询过期的根输入租约；纯归约器继续把未消费且未到期租约投影为 leased，唤醒分类只调度 expiresAt。根输入恢复没有使用分派恢复已经具有的进程身份观察边界。
- 旧路径未根治原因：分派的逻辑完成投递与根输入物理激活是两个不同当前责任，前者已调用共享 `observeProcessLiveness`，后者主要以租约时间及 assistant/effect 收据处理崩溃。既有局部 reducer 测试证明租约排序、终态和效果未知处理，但不足以证明真实进程死亡后未到期租约的及时回收。
- 只读数据库补证：原 PID 24512 对首输入的激活 `act_g0Vc6YBxv00NgR6PVrx2` 自 1795717157885 起有效至 1795717277885，原不可变 grant 与之对应。PID 30776 的后继激活为 `act_g0Vc6YhBg00iz8evhvTv`，时间 1795717277900；原成员中断结算 1795717160840 到新激活相隔 117060ms。完整三行租约及物理身份已存 `baseline-owner-facts.json`。
- 历史决策核对：[406 原执行者恢复](2026-10-14-execution-owner-recovery-406.md)明确指出 Task-root 的到期结算调用者及后续准入都要保护原物理 owner，只阻止 terminalizer（终态结算器）不足以阻止后继抢占。该记录随后实施的是 Permission（权限）物理效果恢复和 Question（提问）呈现，不能当作 Task 根输入已修复；旧记录的一次性审批/请求上限不替代用户当前授权。
- 权威资料：[SQLite 事务文档](https://www.sqlite.org/lang_transaction.html)确认独立读者保留历史快照，IMMEDIATE（立即）事务从开始获得写入资格；操作系统观察必须留在事务外，并在项目现有 immediate writer（立即写事务）内重验精确租约与最新 grant。不能在读快照上完成检查后直接覆盖新所有者。

## 共享机制横向审计范围

- 生产入口：普通操作员输入、调度投递、Mission（任务编排）接受/恢复、目标继续、协调与基础设施通知全部进入同一 Task 根输入扫描；需逐一确认获取点没有直接绕过扫描的恢复变更。普通 Chat/Work（对话/工作）和独立 Mission Session（会话）使用自身 prompt/control 所有权；不得将 Task 修复复制为这些域的第二套状态机。
- 正常与终态：保持 assistant/effect 原始事实和精确激活身份；已 resolved（已解决）、取消/关闭/删除、重新打开后的旧 epoch（执行轮次）不获得额外重放资格。Provider（模型服务提供方）或工具外部效果未结算时仍进入既有 reconcile_required（需要核对）合同，进程死亡也不等于效果失败或可重试。
- 重试与重启：共享 process-liveness 已用持久 PID（进程标识符）、操作系统进程出生身份和 occurrence（进程轮次）观察实际死亡；无效或缺失身份必须明确未知，不能由 heartbeat（心跳）或超时代替死亡。普通错误正常结束应沿既有事实释放；只回收精确旧 owner/lease/grant，观察后事务中必须重验，防止并发续租或新激活被旧观察覆盖。
- 串并行与多项目：保持同 Task 先进先出次序和原 epoch；只观察有界当前根输入前沿，不能扫描全库历史，不能清理其他 Task/Project（项目）或仍活跃的 peer（同机其他后端）。共享租约原语的其他 17 个 owner 必须按各自公开合同排除，不统一缩短租期。
- 待查风险：当前过期 assistant 结算函数本身假定调用方已证明中断；需进一步核对旧进程仍存活/存活未知、相同进程的局部执行注册表、租约刚续期和终态竞争，先用真实运行或聚焦正向测试确认安全条件。此处尚不能宣称所有风险已经排除，禁止在本分析补齐前实施产品修改。

## 拟议方案与验收

1. 完成上述调用、数据及事实边界审计，读取相关历史决策并补齐本规格；先明确一次旧进程证明如何绑定精确当前租约和真实中断收据，再选择实现。复用现有 process-liveness、共享租约释放及 Session 中断结算，不增加后备路径、投影状态、配置面、宿主工具路由或模型重放规则。
2. 以真实原生进程及当前数据库/Task primitive（基础组件）验证：旧进程死亡后未到期激活及时结算，随后恢复原输入及后继；存活 peer 保持原执行并能产出原始完成结果；存活未知返回明确保留合同；并发续租/替换、终态/重新打开和跨项目均保持精确身份。测试必须断言当前明确输出、状态或错误，禁止以“不调用/不存在”为核心断言。
3. 若需要 checker（检查器）新增延迟指标，只测实际 listener（监听服务）发布到新激活发生的时间，排除模型输出完成耗时；初步目标为已证明死亡的首待处理输入在 5000ms 内获得当前激活。先测量原始时间边界再固定阈值，不能以缩短租期、轮询续时或静态摘要充当修复。
4. 用成对复制的授权凭据与模型目录、精确 `openai/gpt-6.1-sol`、无次数上限且全流式审计重跑原三阶段真实 Task checker。本人查看专用开发服务 `/ui` 的真实恢复输入、成员/工具结果并保存截图人工复核，不运行任何界面自动化测试，不单独启动 Vite。
5. 当前持久数据结构与公开错误/路由是否需要变更尚未决定；优先无需 schema（数据库结构）变更的原事实组合。完成后同步当前架构和必要文档，聚焦检查、范围提交、fetch/merge（拉取/合并）、完整待推集合审查与正常 push（推送），精确保留初始工作区。

## 实现前结论与限定方案

- 唯一生产获取链已经全仓核对：`acquireTaskRootIngressLease` 的生产调用只有本模块私有 `activate`，其调用只有同一 `scanTaskRuntimeControlPlane`。普通入口、手动单 Task 交付、项目分页、心跳与重启均进入该扫描，不存在必须复制恢复逻辑的第二条生产获取路径。公共纯归约器的 ready 表示事实和有效租约允许继续归约，并不替代物理执行准入；本次不向纯归约器或事务事实读取中注入操作系统查询，也不伪造未来 expiresAt。
- 生存安全缺口由历史和当前代码共同定位：当前到期结算器只根据租约时钟选择原 assistant，`SessionLoop.terminalizeRecoveredIncompleteAssistant` 按调用方已证明中断工作，不自行检查进程。Session 写入对既有活动的结算可使用 accepted-activity 许可，因此不能以底层通用 writer 一定拦住误结算为由排除风险。必须同时保护结算与后继物理准入，先用原 peer 完成其既有工具/assistant 的正向结果复现。
- 选定实现：在同一 Task 扫描中，用当前精确激活租约、其最新不可变 grant 及既有 runtime_process 身份建立一次观察。外部 owner 通过成熟 `observeProcessLiveness` 在事务外判定，存活/未知保留其原工作，并复用现有 Task 心跳安排物理复查；不得让到期状态绕过该物理准入。当前进程使用现有 Task 根输入执行注册表判定自己的仍活跃执行，未到期的本地激活仍按原租约处理，不凭注册时序空隙回收。
- 确死或已明确失去本地执行时，先按原 Session 中断结算器处理精确激活的未完成 assistant/工具/Provider 事实，再在 immediate writer 中重新验证原当前租约、owner、expiry 和最新 grant；仅将仍有效的同一个租约经现有 release 原语释放，已自然到期的原时间保持不变。原结果先提交或 successor（后继）已获权时尊重该赢家，禁止旧观察覆盖新激活。未创建 assistant 就退出的窗口也以相同精确租约释放恢复，不假造 Message（消息）。
- 物理检查只约束当前 Task 根输入激活和原执行身份，终态/已消费激活仍由已有吸收事实优先处理。历史消息不因为标题、模型错误或同 Session 最新 owner 被重写。当前 activation 的中断记录与既有租约释放共同解释此次恢复；不增加数据库表、数据格式、路由、配置、专业工具发现步骤、人工交互或模型重放策略。现有异常的接口仍为原 integrity/fence/physical-identity 错误。
- 共性审计排除边界：permission/channel 的 effect 已按原 start/lease/grant/物理 owner 核对，只结算确死或明确 handback；runtime_process 仅保存物理身份不代表工作租期；Task 完成/取消、Mission 关闭/保留/恢复的 lifecycle 仍有各自真实执行/终态边界；bus/protocol 投递、Automation/Event、build cleanup、Session control/shell/deletion 和 dispatch admission 各自的 namespace（命名空间）/原始收据不在本次根输入调用链中。共享 acquire/release/renew 原语不变，不能将本修复泛化为“所有租约缩短”或“到期即死亡”。独立 Mission 已明确保留 exact_live/unknown_live 的 Prompt owner；普通 Session 的 enterLoop 也先取得或等待精确物理 Prompt owner。
- 测试及交付：先在仓外诊断脚本中用成熟 Task/Session/租约组件及真实子进程观察两个原行为，保留当前失败；完成证据后再将聚焦正向测试落入仓库，并实现唯一恢复逻辑。之后覆盖相同进程期限、未知/缺身份、续期/替换竞争、终态/重新打开、不同项目与有界前沿，修正本次触及的过期夹具。局部 runner 替身仅验证当前数据与扫描合同，最终仍以原真实 Sol checker 和本人桌面恢复截图验收。
- 仓外原行为已实测 0 pass / 2 fail：真实 child 退出后操作系统观察为 dead_or_reused，但未到期根输入仍 leased；真实 child 仍 exact_live 且原租约自然过期时，当前扫描提前将原工具结算为中断，原执行者随后提交其既有完成结果收到 `HostProcessingFaultError: Tool outcome ... conflicts with its immutable receipt`。这确认存活保护也是同一调用边界内真实可复现的错误，不能只修复恢复速度。该局部检查的 Task 数据/模型 runner 是受控夹具，物理子进程和公共 Session/租约/扫描器是真实；不冒充 Provider 端到端验收。
- 消费判定必须继续用当前 reducer 的同一 `activationConsumed` 实现；为恢复观察开放具备域名的导出并同步原内部两处调用，不复制另一份判断。正常已消费的激活即使其原 backend 仍存活，也允许既有下一语义轮次；物理复查使用现有 30000ms Task 心跳，原后端已经确死的首次重启扫描则无需等待该心跳或 120000ms 租约。
- 正式三项复现修改前为 0 pass / 3 fail；首轮实现后为 3 pass / 9 个断言。相关 reducer、扫描和驱动检查为 60 pass / 2 fail，两失败都来自旧 decision-gap（决策缺口）夹具只命名 dead-owner 却未记录物理身份。按当前合同使用既有 `recordTestProcessIdentity` 补齐明确 prior-instance 身份，保留原正式错误而不添加缺身份后备路径。新测试专项类型检查另发现返回值未缩窄为 assistant 的测试类型问题，增加明确角色检查后重跑。
- 修正夹具后原相关四文件 65 pass / 123 个断言；扩展的独立所有者检查为 7 pass / 20 个断言，另证明存活未知、缺身份的明确错误与补齐后恢复、观察后另一真实 peer 取得 successor 租约的竞争、多项目各自产出原始结果。未知观察分支使用显式观察器替身，仅证明该契约；其余存活/死亡观察使用真实子进程。专项类型检查通过。
- 检查器沿现有接口补记实际 listener 发布、当前进程首激活和最终 FIFO 激活时间以及 owner occurrence。5 秒指标只比较首条恢复输入在新进程中的第一次激活与监听发布，保留原始时间戳和差值；不得误用可能在模型续轮之后的最后激活来计算启动延迟。两个输入的最终激活也必须属于当前物理进程。无用户数据 schema 或公开路由/错误格式变更；检查点新字段属于本次独立运行的阶段证据，不是用户持久数据升级。
- 当前最终五个相关后端文件已通过 72 项正向测试、145 个断言；包含原队列/期限/扫描竞争与纯 reducer、事实存储跨 epoch 和新所有者检查。源、检查器及新测试专项 TypeScript 检查通过；文档、架构索引和 18 个生产租约 owner / 25 个获取点检查通过。真实复验已启动，正常首 Task 已完成且由本人在桌面展开原始完成决定、截图查看；恢复、取消和进程收敛仍需原运行终态证明。

## 真实 run1 的人工拒收及执行准入根因

- 原检查器三阶段退出 0，44 次真实 Sol 流式请求，但本批拒收该结果：首个新进程激活在监听后 219ms 分配，却没有任何 assistant 或 Provider 请求。该激活从 1795719333596 持有至 1795719453596；原始日志报 `Task-root fact runner is not configured for this instance`。真正带 assistant 的后继激活到 1795719453613 才发生，仍多等约 120 秒。原输出没有改写为失败，独立 `run1-execution-admission-failure.json` 保存三行精确租约、每行 assistant/Provider 事实及原始结构化错误，明确区分检查器旧范围通过与本批未达成。
- 初始化链核对后的根因比最初线索更精确：检查器的模型/配置只读预检调用 `Instance.provide` 却不传 `init`。`prepareContext` 对该调用运行空初始化列表并设置 `entry.initialized=true`；正常产品的 full bootstrap 尚未给该实例绑定 Task runner。冷启动清理扫描因而把这个被预检提前标成 initialized 的实例当成运行时可重入实例。现 `tryProvideActive` 本来会拒绝未初始化实例进入 runtime admission（运行准入），不能把预检造成的状态误报为产品所有清理入口都缺初始化保护。
- 横向核对：`initializeProjectCleanupControl` 的生产入口是 Host stop 恢复、Task 取消、Mission 关闭以及完整 InstanceBootstrap；前两域先使用 identity-only（仅身份）Project owner，普通 Task 执行随后经默认 runtime reentry；Mission 扫描亦经默认 runtime reentry，普通 Session 使用 initialized independent owner。完整 Bootstrap 先校验能力后绑定 runner。修正检查器预检为现有 `provideProjectIdentity`，保留原 metadata/credential/model 验证，不增加宿主执行开关、影子就绪状态或 Model 配置后备路径。
- 独立产品缺口：`activate` 先提交物理租约，后在 `runActivation` 闭包中查询 `runner()`；未配置直接抛错，而 catch 只释放本地 reservation，未结束已取得的原租约。其他早期/执行错误也可能把失败转为剩余租期等待。方案是在原派生数据预检阶段解析并捕获唯一实际 runner，之后才取租约；任何失败在原 operation 结清后经成熟 `releaseControlLeaseOnErrorPath` 归还精确原 lease/owner，保留原错误，已提交结果和未知外部效果仍按原 reducer/receipts 收敛，不自动重放效果。
- 局部执行已结束而 backend 还活着也可进入原中断结算器，因此把其通用描述 `Previous process ended` 改为事实正确的 `Previous execution ended`；保留现 `ProcessExecutionInterruptedError` 类型和所有既有调用，历史记录不改写。已全仓搜索两个原消息正文和全部该结算器调用，无依赖此正文的测试/界面契约；Shell 的确死进程描述不在此替换范围。
- 先增加两个正向复现：未配置 executor 的明确错误后，同一原输入可由配置完成的 executor 处理；已配置 executor 的早期真实错误保留原引用，原输入通过下一合法调用完成。检查器同时要求首个新激活具有其真实 assistant 和流式 Provider activity，再根据真实执行时间核对 5 秒指标，不能用空租约作为恢复成功。
- 两个执行准入正向复现修改前均失败，原错误被观察后，根输入均保持一个新分配的 120 秒 leased 投影；未配置和普通执行错误是同一个缺失租约结算路径。初始化本身沿现有 `tryProvideActive` 的 identity/runtime 合同修复预检，不为宿主新增就绪 gate（流程门）；产品只把已有 runner 校验前移并对失败归还原租约。
- 新增两项修复后均通过，专项现为 9 pass / 26 个断言。预检身份错误与正常产品初始化边界的区分已据 `prepareContext`、`tryProvideActive`、三个 cleanup caller（清理调用者）和 Mission/Session 执行入口完成，不改当前 Bootstrap、Mission、Session 身份生命周期或其初始化次序。正在用真实 assistant 创建时间及同一激活的 Provider activity 改进后的检查器做新的完整复验。

## run2 恢复扫描准入与源游标调查

- 第二轮真实运行失败，38 次精确 Sol 流式请求均发生在第一阶段；第二阶段服务报告 production recovery ready（生产恢复就绪），原两个输入没有当前进程激活或新 Provider 请求，180000ms 无实质活动后按原检查器失败。正常 Task 完成收据和恢复等待页面已在真实桌面查看并保存，不能将在线服务、界面计时或原租约当作执行进展；三阶段最终验收尚未通过。
- 当前代码发现更深的公共边界：Task 的 identity 扫描可先通过清理驱动读取有界源页；`scanTaskControlPlane` 的 runtime reentry（运行时重入）在初始化前被正确拒绝，却将 `undefined` 合成为 `{activated:0}`。通用驱动据此把该 Task 当作成功扫描并退休其条目，源页已提交的前进游标不会重新读取旧原输入。后续 Bootstrap 只重设发现定时器，不重新创建该驱动；因此首次预初始化读取会使原待处理输入失去后续所有者。缺失的执行准入被当作扫描完成，与原物理 owner 的死亡回收属于串接的不同故障。
- 需先以实际 identity → initialized（仅身份到完整初始化）生命周期、真实 Task/数据库/原生产驱动证明该因果链，再改实现。限定方案是将原 runtime reentry 的拒绝结果返回为现有 `noProgress`（尚未推进）合同，使驱动保留该原 Task 的有限重试所有权；复用当前退避及心跳，不新增就绪标志、第二游标、绕过初始化或模型路由。已经终态/取消的清理路径仍优先；被删除的 Project 仍按原重入合同退出。
- 横向复查：全部 Task 生产入口共用这一次运行准入；Mission 使用独立全候选周期发现，拒绝时返回零不会消费 Task 的前进源游标，本批不把 Task 专有问题复制到 Mission。Session 的 prompt 准入直接取得或等待 owner，没有此有界源页确认；通用驱动对 `noProgress` 已有有限退避和新事实重试，底层 Instance 身份/初始化合同及队列容量不变。需覆盖原输入在完整初始化后由保留重试自然完成，同时保留已存在并行项目、终态、扫描竞争正向检查。
- 新的正向复现修改前失败：identity 作用域完成扫描后驱动条目被退休。修改后保留同一 Task 的现有退避条目，完整初始化绑定唯一 runner 后，没有再次显式投递输入或请求扫描，原定时重试产生 `Original input after full initialization` 的真实 Session/工具收据；该专项现为 10 pass / 28 个断言。尚需原真实检查器证明端到端恢复、顺序、取消和进程收敛。

## 最终验证与人工复核

- 最终相关五个后端文件为 75 pass / 153 个断言（`focused-identity-final.log`），所有者专项 10 pass / 28 个断言。专项 TypeScript、文档 353 个操作/26 组、当前架构 20 篇索引，以及 18 个生产租约 owner / 25 个获取点检查通过。没有运行或新增界面自动化测试；局部受控 runner 的证明范围与真实 Provider 验收分开记录。
- run3 原三阶段真实检查器退出 0，42 次 `gpt-6.1-sol` 请求全部流式、请求记账完整。完整正常 Task 在成员终态后同一控制唤醒完成；执行中问进度保持原成员存活；两条重启原输入在当前物理进程按先进先出完成；取消请求 81.295ms 返回，第二次重启后唯一取消终态及全部原 PID 清理、该 Task 物理执行前沿 settled（已结清）通过。
- 恢复物理事实：[run3-execution-owner-facts.json](../../artifacts/2026-11-27-task-ingress-process-owner-recovery/run3-execution-owner-facts.json)保存旧 PID 3128 的原 grant 到期 1795721017629，确死后原租约通过当前 release 收敛至 1795720901919，新 PID 8136 于 1795720901922 获得精确后继激活。原成员同进程中断结算是 1795720901874，距离新根输入激活 48ms；旧同口径基线是 117060ms，不依靠缩短新租约。新监听 1795720900693，后继激活 +1229ms、原助手创建 +1548ms；其首个实际 Provider activity 为 1795720908620（监听后 7927ms，包含前置上下文准备），模型最终回答完成耗时不混入 5 秒助手准入指标。首激活确实有原始助手、请求和完整回答，空激活不能再次蒙混通过。
- 本批三轮合计 124 次授权 Sol 请求，全部流式；HTTP（超文本传输协议）200 为 122 次，2 次停在 awaiting_response（等待响应）。117 个读取终态 EOF（流结束）、2 个 aborted（取消），另 5 个因主动重启时审计截点尚未取得终态；保留 reading/awaiting_response 原状，不伪造全部正常完成。run1 的原 checker passed 保留但本批拒收，run2 明确 failed 且 accountingComplete=false（后续阶段未执行）；仅 run3 作为最终完整验收。三轮复制的凭据和模型目录均已按检查器退役，原授权文件未进入证据、日志或提交。
- 本人用专用 Chrome 页面在实际开发后端 `/ui` 展开 run3 的原完成决定、查看成员报告和工具回执，随后进入真实重启服务，看到首输入原回答；再进入第二次重启后的服务，滚动查看两条原输入及各自回答、已取消标记和原成员取消详情。保存 `run3-completed-task.png`、`run3-first-recovery-answer.png`、`run3-recovered-inputs-and-cancellation.png`；最终两条恢复回答截图是在在线端口 64775 的真实服务中取得。服务随后按原三阶段检查器正常结束，不能据临时端口关闭误报产品掉线。
- 产品源差异已人工复核：唯一 Task 根输入恢复逻辑替换旧到期猜测；共用消费判定，精确 lease/grant 事务重验；实际 executor 前置解析及原失败归还；拒绝运行准入按现有有限重试收敛。没有 schema、用户数据格式、公开接口、LLM 路由或新配置变更，没有保留第二条旧恢复实现。当前已声明风险的存活/未知、竞争、多项目和终态边界由上述聚焦正向检查覆盖；本次不是性能基准总体承诺。
