# Artifact 来源声明与文件保全

## Recall

用户要求只用一个 agent 持续自主体验和修复，覆盖 Sources、可用性及完整功能，实际页面验证后范围提交并正常推送；不得继续把已经解决的 Rendering 闪烁当作当前问题。用户授权的单次 Dependabot refresh 已在 790 执行，官方页面 queued、10:10:20Z 只读回读 open=0，不能重复使用一次性授权。当前 Goal 保持 active，旧多人文字被后续单 agent 指令覆盖。

795 已推送 6f11c1c403586e1e3f47d566b8d487b86a4c28a5，fresh upstream 0/0。其 48 次真实 gpt-6.1-sol 流式请求已结算，累计 930；不能重新启动其耗尽的额度。真实 Task tsk_g00VZRwPYV00d8tnhr0L 已修正 counter.py 并实际通过两个 Python 正向测试，但独立 Tester 未完成，Task 因验收器请求预算耗尽失败，Mission 未正常关闭。原失败与未完成项保留。当前工作区他人视频/历史截图删除及 L06 规格和索引改动不属于本轮，不覆盖、不混入提交；无额外 branch/worktree、无子 agent。

## 实施前分析与证据

可观察事实：795 的真实 Tool facts 中，root Session ses_-zUQY3XbvzzjzAx20a7z 先批量读取六份输入，逐个执行六次 artifact_select；修改后再批量读取七份文件，逐个执行七次 artifact_select。purpose 使用“保留修改前原始字节基线”“确认原件未变”等理由。Tester 只进行两次批量读取即触及该范围上限。不能把有界验收的 cap 当作生产调度缺陷，也不能断言这 13 次声明是唯一耗尽原因。

直接触发点与数据流：artifact_snapshot 已保存不可变字节，artifact_read 交付精确内容和 read ref；artifact_select 只从同 Turn 完整读取的持久化事实恢复 locator，登记语义来源及 purpose，既不捕获文件，也不比较前后内容。原说明虽写明 semantic source/zero selections，但没有明确区分文件保全、内容核对和特定输出的来源声明。此次是工具语义说明不足与真实模型使用偏差，不增加 Host 关键词拒绝、来源白名单或流程 gate。

已读定义/调用点：tool/artifact-catalog.ts 共用 description、selectArtifactForSession、普通 Tool 和 Orchestrator AI Tool；plugin/artifact-catalog.ts 输入/输出 schema；agent/artifact-read-facts.ts 和 artifact-provenance-facts.ts 的同 Turn 校验及读取；Orchestrator dispatch/read_context/Architect/VisualReview 消费者；base 包各角色与方法；advanced README；artifact-provider-reference-flow 正式后端测试。全仓搜索确认通用 artifact_publish 已通过 source_read_refs 做本次输出的来源选择；Typed publisher 和需要独立选择回执的消费者继续使用现有选择事实。不能删除真实语义来源的读取或选择要求。

串行假设的核对：provider/tool-call-policy.ts → transform.optionsForToolRequest → session/llm.ts 在原生 OpenAI/Azure 有 Tool 时明确 parallelToolCalls=false。06-provider 及 10-14/10-22 记录已经声明该单 step 策略，不影响不同 Session/Task/Project 并发。本轮不把已有合同误报成新异常，不修改 Provider 策略。没有发现新的调度/队列/唤醒/恢复控制流异常；共享恢复机制沿 794 已验合同，不另造状态。

公共契约/数据：仅澄清现有工具行为，保持工具名、输入/输出、独立选择回执、持久消息和版本完全一致；不需要 schema 升级或历史数据重写。普通未选择读取仍是 observation，真实输出来源仍需明确选择。主要风险是模型仍会过度声明，或反向省略真正的来源；必须分别检查实际 Tool facts 和独立审阅，不能仅凭说明文字或模型自述验收。

## 固定方案与验收

1. 在唯一共用 artifact_select 说明中将 purpose 绑定特定消费者输出，准确解释独立来源回执、已捕获字节及版本核对的区别；提示通用发布直接使用 source_read_refs。snapshot 说明明确其返回即已持久保存捕获字节。同步当前扩展架构中的职责说明，不改校验或执行权限。
2. 正式后端 checker 运行 artifact-provider-reference-flow：真实同 Turn 读取、来源回执、通用发布和跨 Turn 错误合同。该局部合同测试不能冒充真实 Provider/网页验收。运行适用 types、文档及架构索引检查；不新增或运行 UI 自动化测试。
3. 仅在前两项通过后启动一个独立的有限续跑阶段 selection-purpose-796，完整复制已关闭 795 库、package revision 和所有实际附件 namespace；原 795 库逐行保留，原失败事件保留。原 Task/Orchestrator/Tester 身份继续，不另建 Task 替代原未完成义务。自有 QA 项目先保存全部文件、用户 HEAD/index 与备注原件。本轮无 UI 源码变化，复用当前普通前端产物，由开发 serve /ui 真实交互并截图人工复核。
4. 新阶段最多 40 次精确 gpt-6.1-sol 真实流式请求，含可见预检、辅助和恢复请求，累计从 930 继续；首次启动前固定绝对 25min 截止，15min 正常公开 shutdown，至少 5min 结算余量；3min 无真实活动先查原 handle。不得延长期限/追加同范围额度。成对复制 auth/完整模型目录，本地投影和实际请求模型分别核对，凭据不入日志/规格/提交。真实 UI follow-up 只说明继续原独立审阅和收口，不把本轮期望 Tool 数作为模型流程指令。
5. 分别取证：独立 Tester 的实际测试/保全检查、原 Task 正常完成事件、原 Mission 关闭、实际来源声明的语义用途、用户 Git/index/文件保全；每项失败如实保留，不能以其他项通过代替。结束结清原 exec/native/launcher、物理/输出/请求后清退两份凭据副本，再范围提交、fresh fetch/merge、审查全部待推送提交并正常 push。

## 结果

### 796 扩展调查：恢复轮次的证据读取

40 次真实请求已结算（累计 970），公开 shutdown200、原 exec60539/native/launcher 均0，物理/输出/请求三项完成，余量841109ms，成对凭据副本清退。原 Task 在 execution_epoch=2 产生 task.completed/seq179；原 Tester 同一 Session 的 terminal/completed/settled 真实消息为 msg_g0VZSDa9g002hr2lzC1e，独立实际 Python 测试及原件比较均通过。六张实际页面截图已查看，05滚动到底后可见完整交付正文和 manage_task action=complete_task；最初视口未显示末尾正文不构成消息丢失，不能把虚拟化的屏外内容当作缺陷。原失败事件仍保留。

来源用途说明已澄清，但 Tester 仍作了13次独立审阅用途声明，本轮不提供同工作量对照，因此不能宣称调用成本改善。Mission 未正常关闭：15:50:18.623Z panel_query_task 观察 active，Task 15:50:22.103Z 完成，Mission 15:50:23.934Z 向它发送 notification，15:50:30.248Z 得到精确 SchedulerMessageAuthorityError；随后验收上限拒绝了下一请求。该时序是读后正常并发终态收敛，并非 Task 状态丢失。已横查 Mission Tool、Orchestrator Tool/Session loop 入口、sendSchedulerMessage 的唯一 immediate transaction、enqueue 对 Project/owner/root Session/当前 epoch 和 active target 的校验，以及恢复/结算入口；不放宽终态写入。真实原 Mission inbox 结算还需下面正式原库 reader 输出，不能用页面错误推出共享队列缺陷。

收尾在正式 checker 中复制关闭796库，实际 collectTaskRunEvidence **失败**：`execution baseline differs from its immutable creation workspace`（real-reader原日志保留）。其唯一生产入口 plugin-tool-host 及返回 TaskRunEvidenceBundle schema 已全仓搜索：bundle 明确分别保留 initial_tree_sha256 和 execution_baseline_tree_sha256，没有相等约束，也没有其他生产消费者要求相等。EngineGit.project 按 Task 当前 execution epoch 精确读 baseline/result；EngineGit.prepare 已只对首次执行校验创建时 workspace，重开轮次捕获自己的新基线。collector 却对所有轮次重复比较新基线与创建基线，误拒绝保留自身正确输出后的恢复。795首次失败终态 reader 通过、796第二轮完成 reader 失败，构成真实前后证据；不是 schema 变化或副本缺少凭据。

影响面横审：同一个 collector 处理 completed/failed/cancelled 终态及 inactive/awaiting_interaction 现场证据，所有 Project、Task及其root/worker Session共用；重试和进程重启从 canonical binding/checkpoint facts 重建。问题在读取公共证据的跨轮次错误比较，不改变执行调度或 Git writer。首次创建完整性已经由唯一 prepare owner 校验；collector 必须保留两份真实、各自有身份的树值，而不是强制不同轮次相等。删除这处重复错误约束，不加第二个 epoch 判断/后备基线，不替换为第一轮 checkpoint，不改既有 binding、事件、Tool或 bundle schema，无数据库迁移或数据改写。

实施前验收补充：新增聚焦正向后端测试，以真实原生 Git 创建两个独立 Project/Task，每个先捕获第一轮并失败，保存正确工作后重开第二轮并产生自己的 baseline/result；分别核对真实初始树、当前基线树及实际 commit 文件，经过 Instance 重建仍能完整收集，覆盖不同 Project 的并行隔离。先 red 再删除错误比较，重跑同一正式测试和同一关闭796原库真实 completed consumer；真实 Mission inbox audit 单独记录，不与 Task reader 成功混同。不再次启动已耗尽的796付费范围，本批修改完成后按正常hooks提交推送，Mission正常关闭仍是后续义务。

### 最终实现与验收

删除 collector 中跨轮次的错误相等要求，保留 canonical prepare 的首次执行完整性 owner、当前 epoch checkpoint 和两份真实树身份。新正式正向测试 red-baseline 因同一原错误失败；green-baseline 一项36断言通过，覆盖两个 Project 并行、各自两轮、保存正确成果、真实 Git 对象内容和 Instance 重建。没有添加 epoch 旁路、兼容 reader 或改写历史数据。

同一关闭796真实数据库重新进入原正式 reader，real-reader-green退出0：原 completed lifecycle pev_g0VZSDzhU001PP3uocYr、原 completion decision art_g0VZSDywD00w7dE4YBqF、原私有结果52062f2a90a2e3ebe70a1b7b88d901a11c392875完整收集；不是重新制作Task、消息或成功结果。真实 Mission audit.passed=true，没有未结算投递；正常 active→completed 交错被权限合同拒绝，不能据此宣称共享队列失效或放宽终态写入。该纯后端修复新增模型请求0。

引用/发布9项、持久生命周期1项及新增恢复证据1项共11项聚焦后端合同通过，最终core types通过；文档和架构索引在归档后复核。源92表161325行逐行不变，新库92表172843行、schema9、integrity_check=ok，全部原行身份保留；用户HEAD/index和七份原文件一致，51份附件的来源与副本逐字节一致。没有操作18571服务、真实用户数据库或用户页面。原40请求范围已全部HTTP200/EOF并结算清退，不以请求耗尽遮蔽独立审阅及Task成功，也不以这两项成功遮蔽Mission关闭未达成。

原始失败、成功、实页及运行/数据证据见[本轮证据包](../../artifacts/2026-10-29-artifact-selection-purpose/README.md)。首次types误用了不存在的package filter，types2和types-final已使用package声明脚本通过；数据比较器的prototype错误及Windows PowerShell5关闭命令错误均在本地修正并重跑，产品事实与原失败日志保留。普通提交、hooks及fresh上游同步待最后收敛，不提前记录为已推送。Goal继续active，来源调用成本及所属Mission正常收口继续待验证。
