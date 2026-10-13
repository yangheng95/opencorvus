# 持续目标重复崩溃与 Mission 子 Task 真实验收

最终交付复核：三项生产修复和五次真实运行证据已完成独立复核；Task两次崩溃、Mission修后两次崩溃及Mission子Task一次崩溃均通过。原两次失败保留。合并远端`f6c93a756`后25项92断言聚焦回归全通过，详见同轮artifact的`parent-review.md`与`integrated-*.log`。

## Recall

- 用户继续要求“继续测试修复”，授权同一独立 agent、隔离工作树与真实 Provider 配对配置。先覆盖 Task、Mission 恢复进程再次崩溃，由第三个正式服务自动恢复；再覆盖 Mission 真实子 Task 中断恢复与目标用量归属。禁止再次委托、UI 自动化、人工续跑输入和直接调用 reconciler 替代启动发现。独立 agent 不提交或推送；父 agent 维护索引、复核和 Git 交付。
- 基线锁定 `830972c0d69315c31af6d0efe760fb96d5cce9dc`，工作树 `C:/Users/hengu/.codex/worktrees/continuous-goal-mode/opencorvus` 初始 clean。不操作主工作区或用户进程；运行中不 fetch/merge。
- 已重新阅读 AGENTS.md、benchmark-debug-template SKILL、上轮 crash-recovery Recall/结果、当前 continuous-goal 架构及现有 checker/测试。上轮 Task 单次崩溃与 Mission 单次崩溃通过，Mission run1 保留检查器过窄失败；它们不证明本轮新增断点。
- 已搜索/追踪：continuous-goal store/controller、正式 host-recovery/bootstrap/Scheduler、Task root ingress/activation/occurrence、Mission process-recovery 与 persisted recovery wake、SessionPromptOwner、RealProviderAudit、Mission 子 Task 查询及 completion receipt。近期上游涉及 permission recovery 物理 owner、Instance 后台取消、compaction 引用来源和 fork 边界，continuous-goal 本身未变；本轮以新基线真实运行重新验证。
- 父 agent 反馈：Mission 的 actionable runtime recovery wake 可以保留第一次原因并重放；子 Task 必须按 project/mission/session 精确关系选取；凭据复制须纳入 finally；最终子 Task acceptance 必须绑定真实完成 occurrence 和已读取 artifact 字节。父级基线 33 项合同及 1 项受控 Chat 重启通过，仅作为局部/集成对照，不替代真实模型验收。

## 问题深度与调用影响

尚未证明生产缺陷。本轮首先补齐检查器不足：它当前只支持一次 cut 和第二进程，第二次 cut 只接受原 goal input，且 runtime recovery 校验假定每次新建原因。直接复制检查器或每次重置请求额度会形成平行事实源或假阳性。应在原 checker 中按真实进程代次循环，保存每次物理 accepted input 与原 goal input，以及不可变 runtime 原因的继承证据。

影响面为 `script/continuous-goal-crash-check.ts`、其聚焦正向测试、必要审计 preload、本记录和证据子目录。生产 Task/Mission/Session 恢复实现暂不修改。若真实调度/终态异常出现，先横向审计所有入口、occurrence、正常/终态、重试/重启、串并行和跨项目；向父 agent 提交根因及文件范围后再修复，不以模型自述解释调度事实。UI、发布、版本和全局错误历史重构不在范围。

## 第一阶段冻结设计

- 两个独立 run：`task-repeated-run1`、`mission-repeated-run1`，证据在 `specs/artifacts/2026-10-13-continuous-goal-repeated-recovery/` 对应新子目录。任何失败保留；修复后创建新 run，不能提高原 run 额度。
- 精确模型 `openai/gpt-6.1-sol`；授权 source 为 `C:/Users/hengu/AppData/Local/opencorvus/data/auth.json` 及同目录 `models.json`。副本成对隔离，实际路径在请求前 manifest 固定；目标模型 projected、真实流式 preflight usable、所有实际请求 model/stream 逐项核对。所有初始化和请求阶段均受 finally 配对清理保护，日志只保存脱敏元数据。
- 每 run **48 次总 Provider 请求**，跨三个进程累计，含 preflight/辅助模型；goal **tokenBudget=1200000，turnBudget=3**。每次启动准入额度为总额减去所有已退出进程持久化审计请求数。goal 实际已结算 usage 与原账本精确比对；被中断且未返回 usage 的请求成本未知，不估算。
- **两次物理 SIGKILL**：第一个 goal-controller 自动轮次内，已有该次真实 reader 字节和持久化正文/推理长度或 Tool 进度后终止私有进程；第二进程正式启动恢复，保存新 Prompt generation、新 assistant、接受输入、reader 和旧 assistant 的生产中断结算，再于真实恢复输出中执行第二次 SIGKILL。第三进程沿相同 home/database/project 的正式 serve 启动自动恢复。每次 await exited 后、新进程之前读取 crashed facts，证明 cut assistant/goal 尚未完成且保留旧 owner 身份。
- 输入沿用上轮有限六项交付：首次创建持续目标、给出两阶段结构并保持 active；第一个自动轮次输出两阶段各三项标准（每项包含证据和通过条件，输入不固定六个标题），校对并 complete goal，再正常完成 Task/Mission。允许运行时发生多次中断，依据持久化事实继续同一目标，不新建目标或人工续跑；不创建子 Task。Task 首轮 no_action、最终正常完成；Mission 最终合法 `task_acceptances=[]`。完整原文在 manifest 保存且请求前固定。
- 无活动阈值 **180000ms**，仅真实 Message/Part/Tool/业务协议/usage/reader 进度刷新；续租、采样时间和业务阶段日志不刷新。HTTP 30000ms；每个服务清理 30000ms 后可强制终止其已持有句柄。外部检查采用有界定时结果读取。
- 每代恢复既可保持原 goal input，也可创建精确 runtime recovery input，或重放上一代已经验证的不可变 runtime input。新创建原因绑定当时 opened/generation/frontier；重放保存原原因与上一代 accepted input 的精确相等，并另外验证刚中断 assistant 被生产 terminalize、新 PID/generation/reader。始终保留唯一原 goal/continuation/controller input 和 turnsAccepted=1，Task 同 ingress/epoch；Mission 同 opened。
- 最终公共 Task completed 精确 epoch，或 Mission accepted outcome 与完整 Tool receipt 精确身份一致；Mission 最新 assistant finish=stop 晚于 complete Tool。所有代次在原目标有效 scope 内启动并捕获目标的已返回 usage 均纳入 goal 账本，第三进程存在新的结算 usage，真实正文六项人工复核。收束全部私有进程后验证去重端口关闭、auth/models 副本移除。

## 第二阶段边界

复用同一 checker，扩展 exact project/mission/session 子 Task 关系、root ingress/occurrence/activation/usage 读取；使用真正创建、执行、读取交付证据、接受同一次 child completion 的公共生产工具链。不得以模拟 child 或仅有 metadata 代替真实因果。

### 第二阶段请求前冻结

- run `mission-child-run1`，scenario `mission_child`，一次 child 执行中 SIGKILL 后第二个正式服务自动恢复。独立 **64 次跨进程总请求、goal tokenBudget=1600000、turnBudget=3**；同一精确模型/配对隔离/180000ms 无活动/HTTP 与清理 30000ms。阶段一完成后才启动；额度不追补、不覆盖失败。
- 完整输入语义：首次只创建 Mission 持续目标并给出两阶段结构，结束本输入保持 active，不创建 child。第一自动轮次创建且仅创建一个独立生命周期的 base Expert Squad 子 Task；明确指定 `openai/gpt-6.1-sol`。child 自行交付两阶段各三项标准（每项证据和通过条件），把结果作为真实可读取交付 Artifact 按当前 Task 正常合同完成。child 不创建自己的持续目标或额外 Task，不操作网站、部署、凭据、权限、定时等待。Mission 等待 child 的生产完成通知，读取其真实 artifact 的全部字节，核对同一次 completed occurrence，汇总六项标准，complete 原 goal，携带唯一 child 的真实 evidence_read_refs 正常 complete Mission。若发生中断，沿同一 child 和同一目标的持久化事实继续。最终请求原文由 checker 在任何 Provider 请求前写入 manifest。
- cut 须由 `engine_task_creation_contract.creator_tool_part_id` 绑定到接受第一 goal-controller input 的真实 Mission assistant/Tool，再绑定 exact child 的 root ingress 和当前 assistant 的 accepted control input；读到真实响应与持久化输出后终止。父 Mission 和 child scope 同进程，一并保存事实。恢复仍要求旧 child assistant 被生产 terminalize、新 PID/Prompt generation/reader 接受同 child ingress。
- 原 cut continuation 身份必须保留；最终 `turnsAccepted` 等于实际不同 continuation 数且不超过3。child 完成通知和目标新 frontier 可能自然产生另一个合法自动轮次，不能以固定1误判恢复重复。每个 controller Message 与其 continuation 确定身份一致。
- 子 Task 完成 receipt 中 `terminal_lifecycle_reference.terminalEventID` 精确对应该 child 的 task.completed event/epoch。Mission accepted outcome 精确回执包含唯一 child 的 evidence_locators，核对原输入 evidence_read_refs 与实际完成的读取 Tool 输出；完整字节覆盖由正式公共 outcome 权威重验。
- 计量只要求在原目标有效 scope 内启动并捕获目标的 usage；preflight、创建目标前调用、goal 完成后的正常 owner 结算不强制归属。child 在目标创建后开始并先于目标完成结算，因此其已结算 scope usage 须完整关联此 goal，恢复进程须有真实新增 child usage。中断未返回 usage 保持 unknown。

## 当前执行状态

Task repeated run1 已通过：12请求，目标212967 tokens，同一续跑/epoch，两次SIGKILL后第三正式进程完成。父级独立脚本及正文复核通过。

### Mission repeated run1 暴露的生产问题（修改前分析）

- 真实路径为 PID67152 → 85220 → 58308，两个cut分别有6和2字符持久化正文。第三进程先取得新Prompt generation并创建真实 runtime recovery input，原goal/continuation不变。恢复完成六项交付并将goal标为complete后，尚在正常Mission收尾的assistant于1791896712944被MessageAbortedError结算；服务仍活着，尚无Mission accepted completion。现场保存`observed-runtime-abort-facts.json`，最终checker失败保留，不修改结果。
- 根因为 `recoverMissionProcessSession` 默认120000ms绝对deadline的signal贯穿恢复事实协调、物理owner准入和整个LLM回复completion。第三代恢复1791896592918到中断约120s；活跃流/Tool进度不能刷新这个固定期限。现有Provider/session活动策略已有单一无活动权威，恢复期限错误地成为第二个执行寿命限制。旧单次恢复可能走原goal输入，或在120s内完成，因此未命中。
- 相关定义/调用已全仓检索：Mission process-recovery由engine/host-recovery及SessionLoop permission recovery调用；Task root ingress只有明确持久化policy期限，普通Chat/Mission wake及goal continuation无此默认整回复上限。新permission recovery调用也受相同影响。关闭/retention自身有限事务清理期限不等同模型执行，暂不改变。项目、Mission opened、旧generation精确fence和输入恢复authority仍保留。
- 生产修复范围首先为`mission/process-recovery.ts`：120s只约束恢复准入，获得真实`receipt.activation`后清除timer；继续保持caller signal、lease失效取消及正常Prompt执行期activity权威直到completion。参数明确更名`admissionDeadlineAt`，全仓更新调用/fixture，不保留旧别名。不增加活动计时器，不单纯加大120s。
- 聚焦测试扩展原`mission-process-recovery-driver.test.ts`及原worker：真实受控Provider恢复越过短准入期限后仍正常完成；准入前超时仍释放恢复lease并由后继接管；已激活后真实caller取消仍结算。受控Provider用于根因回归，修后必须新Mission真实Provider run2重跑原两次崩溃场景。
- 另一个共享观察：SessionWake原先把任意caller.signal abort都投影为process.shutdown，实际不一定是进程关闭。父级已完成RuntimeExecutionSettlement取消来源审查，下一条记录其完整authority证据和修复范围；不能靠错误source文本判定根因。AbortSignal.any保留首个aborted signal的reason是原生合同（https://nodejs.org/api/globals.html#static-method-abortsignalanysignals）。
- 父级完成取消来源全调用面复核：RuntimeExecutionSettlement gate的生产取消由server收束触发，SessionWake caller.signal是另一路。共享`session/wake.ts`修复在caller入口保留已typed ExecutionCancellationError，普通caller reason封装为现有runtime.prompt_owner来源；onCancel沿用typed origin，只有真正gate普通Error按process.shutdown记录。未增加枚举、后备路径或新的活动计时器。Task、Mission、Chat及任何SessionWake调用方均遵守同一取消来源合同。新增受控进程测试分别验证普通caller来源和typed用户来源。
- 调查期间曾暂停子Task收费运行与实现，至原Mission重复崩溃修后复测通过才恢复推进；没有修改当时已冻结run的参数。
- 父级独立复核失败run共23真实请求，最后reader字节距取消仅381ms，恢复terminalization到MessageAborted为120026ms，证实有活动的真实流被绝对期限终止。修后共享wake/关机/Chat回归20项43断言通过（`parent-wake-regression.log`），分别为runtime-execution-settlement17、scheduler-wake-message-identity2、真实Prompt受控Chat重启1。后台typecheck通过。

### 修后重复 Mission 与聚焦回归

- `mission-repeated-run2` 完整通过：24真实流式请求，goal365132 tokens，turnsAccepted=1；PID78608→85144→38668，cut正文2/10字符。第三代走正式mission_process_recovery路径，恢复terminalization为1791897446262，超过170s后仍有正常Prompt/Tool进度，最终accepted Mission回执与final stop成立，实际越过原120s失败点。三进程退出、端口关闭、配对凭据副本清理均有settlement。
- 修后的原Mission driver测试10项19断言通过。新增越过3秒准入期限正常stop，以及激活后ordinary/typed caller取消来源的真实进程合同。初跑两个caller测试用固定3秒timer，工具初始化较慢时在可见Provider请求前取消；改成测试实际见到Provider请求后通过私有barrier触发取消，再完整重跑通过。保留初跑失败日志，不归为产品故障。
- Mission核心恢复4项8断言通过；扩展checker6项9断言通过；子Task扩展后backend typecheck通过。附带旧mission-streamed-recovery测试一次失败，父级负责进一步诊断并单独记录，不将其包装为本轮真实Provider失败或已修复。
- 第二阶段`mission-child-run1`按冻结64请求/1600000tokens/3turns执行，最终因请求上限未完成Mission收尾，失败保留。新增snapshot按真实project/mission/session和creation contract绑定子Task，包含child Task events/ingresses/activations、精确scope和原始Provider ledger。

### 子Task请求额度失败与共享竞争回归

- child run1实际恢复同Task并完成epoch1，Mission完整读取交付及验证Artifact后将goal complete，但第65个请求在发送前被64次硬上限拒绝；Mission正常完成合同尚未结算，run判failed且清理，不回写passed。1600000目标token阈值只限制新自动轮次，已接受Task的生产、独立验证和完成流程实际结算费用可超过该值；额度未修改。
- 新child run2在请求前冻结为**96次总请求**，原输入、模型、单次child断点、1600000 goal tokens/3 turns及180s无活动均不变。只扩展checker明确请求上限参数并在manifest记录；原run1可用显式64重放，不延长已失败进程。
- 父级在附带streamed真实后台路径复现共享竞争：同final Message的recovery partial先于正常Build domain observation2008ms持久化。根因scanner在检查仍存活的delivery owner之前使用terminal lifecycle恢复domain settlement，抢先first-committer-wins。父级负责移动现有owner检查到missing-domain恢复前，已有domain settlement的delivery保持先行。
- 独立agent新增`test/task-control-terminal-owner.test.ts`，复用真实Task/lineage/worker descriptor与terminal report/本地detached pipeline/物理peer process，正向验证live owner的有限recheck结果、之后真实terminal_success结算和delivery，以及peer退出后missing-domain的partial恢复。它不证明真实Provider端到端；child run2在修复及聚焦合同通过后重新实际运行。
- 新owner回归3项18断言通过：local pipeline与真实peer分别保持30s有限recheck，正常domain成功后以exact settlement artifact交付；peer退出才通过exact lifecycle event恢复partial。初跑暴露Bun1.4 `expect(actual).toMatchObject({wakeAt:expect.any(Number)})`原地把实际数字替换为matcher对象；最小独立复现输出`Any<Number>`/object，保存原数字再断言解决，生产时间值始终正常。另纠正测试把两种合法delivery来源都假定protocol_event的错误，现按真实success artifact/abandoned lifecycle区分并匹配精确身份。
- 父级共享owner修复已独立读diff：仅把现有physical owner检查提前到missing-domain terminal恢复前，已有domain settlement快路径仍先交付；local registry、physical process observation、正常/终态/重启和Task occurrence权威均沿用。原streamed回归修后通过且没有改变Mock决策；后续复现的真实partial先于domain observation证明共享竞争，首次失败缺少当时settlement明细，不能倒推其具体原因。完整对照以parent-review为准。
- `mission-child-run2`使用请求前冻结的`GOAL_CRASH_REQUEST_LIMIT=96`完整通过；原run1的64请求、错误和清理事实完整保留，3234份审计快照已逐JSON验证压缩，原目录按审批拒绝要求留在本地。没有续跑原失败run或改写既有额度。

## 可重放入口

在工作树`packages/opencorvus`执行，证据目录必须尚不存在。原始每run的manifest保存完整输入与隔离路径。下例重放修后的child场景；重复owner场景把KIND设task或mission、SCENARIO设owner、COUNT设2、REQUEST_LIMIT设48；历史child额度失败用64。

```powershell
$env:GOAL_CRASH_ALLOW_REAL_PROVIDER='1'
$env:GOAL_CRASH_KIND='mission'
$env:GOAL_CRASH_SCENARIO='mission_child'
$env:GOAL_CRASH_COUNT='1'
$env:GOAL_CRASH_REQUEST_LIMIT='96'
$env:GOAL_CRASH_MODEL='openai/gpt-6.1-sol'
$env:GOAL_CRASH_AUTH_SOURCE='C:/Users/hengu/AppData/Local/opencorvus/data/auth.json'
$env:GOAL_CRASH_EVIDENCE='<absolute new evidence directory>'
& C:/Users/hengu/AppData/Local/npm-cache/_npx/214ebe133ee6a004/node_modules/bun/bin/bun.exe script/continuous-goal-crash-check.ts
```

聚焦后台回归使用同一Bun：

```powershell
& C:/Users/hengu/AppData/Local/npm-cache/_npx/214ebe133ee6a004/node_modules/bun/bin/bun.exe script/run-tests.ts test/continuous-goal-crash-checker.test.ts test/mission-process-recovery-driver.test.ts test/task-control-terminal-owner.test.ts
```

父级维护原streamed复现、Task control共享回归、根typecheck/docs及最终Git交付。独立agent不提交或推送，不运行UI自动化。

## 最终独立执行结果

| run | 结果 | 真实请求 | 已结算goal tokens | 物理执行 |
| --- | --- | --- | --- | --- |
| task-repeated-run1 | 通过 | 12 | 212967 | 54756→85060→84164，两次SIGKILL，同epoch1/原续跑完成 |
| mission-repeated-run1 | 失败，原120s恢复期限取消活跃流 | 23 | 460083 | 67152→85220→58308；保留失败事实 |
| mission-repeated-run2 | 修后通过 | 24 | 365132 | 78608→85144→38668；恢复跨原期限后正常完成 |
| mission-child-run1 | 失败，64次硬上限阻断Mission收尾 | 64 | 3349061 | 28060→86292；Task及goal已完成，Mission合同未完成 |
| mission-child-run2 | 修后完整通过 | 50 | 2110219 | 79780→85072；真实child中断、正式启动恢复、Task及Mission完成 |

- 共173次真实请求；上述tokens是实际已返回并关联goal的账本事实，包含失败run已结算量，不包含preflight/未捕获goal的其他调用，也不推算硬中断未返回用量。child run2在原已接受执行内结算2110219，超过1600000新自动轮次准入阈值；没有调整该阈值，始终只有原一条continuation。预算不是执行中单请求费用截断。
- child run2的精确子Task为`tsk_g00VXwDWps00q3xF6qSs`，Task completed event为`pev_g0VXwG0fh00sROQKq1Fl`（epoch1）。原creator Tool、Mission accepted goal input、Task root ingress、新PID/generation/assistant/reader和旧assistant生产ProcessExecutionInterruptedError完整绑定。child及其后代的已结算Provider ledger合计1270875，全部关联原Mission goal，包含重启后的新增真实用量。
- Mission最终公共outcome为accepted，精确message/toolCall/part匹配真实`mission_completed` receipt；唯一child acceptance引用同一completed event。完整读取8466字节正式Markdown、11308字节独立报告和2237字节完成关联记录，其中正文及报告分别跨两页，所有真实read refs在最终回执中归并为完整字节覆盖。独立agent已人工读全文：R1–R3和A1–A3字段齐全，任务完成关联补齐独立报告中明确保留的后续边界，Mission可见最终回复与事实一致。模型对指定模型身份仅声明来源；实际模型验收来自checker自己的精确Provider请求审计。
- 恢复本身不增加turn；后续独立合法frontier仍可经原goal-controller准入增加计数。此真实child run最终仍为1轮，不能据此宣称整个目标生命周期计数固定。
- 五run共13个私有正式服务进程均经持有句柄确认退出；各最终去重端口不可达，五对auth/models副本均移除。未操作用户进程，源配置只读。9232份原审计快照完整压缩，并逐相对path/JSON解压比较；自动审批拒绝删除原目录，原`*-audit`目录保留本地且不纳入提交，未换壳绕过。关键结果、失败facts、transcripts和父级审查文件均保留。
- 独立最终聚焦：checker6项9断言、Mission driver10项19断言、terminal-owner3项18断言、Mission核心4项8断言通过；父级另完成共享wake/Chat20项43断言、Task control8项130断言（包含新owner3项）、原streamed1项34断言及根typecheck8/8、docs348ops/26groups、architecture19。初跑夹具失败、Bun matcher影响和原真实生产失败保留，不以最后通过覆盖历史。
- 新增覆盖：Task/Mission已接受自动轮次的两次真实硬崩溃、第三正式服务恢复；Mission创建唯一真实child后child输出中硬崩溃、同Task/epoch恢复、真实Artifact分页读取与最终验收、包含实际后代的goal用量归属。未覆盖提交continuation前崩溃、多child并发、跨epoch重开中断、多项目真实并行、所有外部副作用/优雅关闭矩阵；同一runtime recovery input再次重放分支有聚焦正向合同，本轮真实Mission观察到的是原goal输入恢复后再创建runtime恢复输入，不扩大为所有恢复路径组合已实测。

本轮授权的真实验收目标已达成。独立agent文件已稳定，后续凭据扫描、Git提交、远端合并、集成回归和推送由父级完成。
