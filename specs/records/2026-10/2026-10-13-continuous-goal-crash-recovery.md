# Task / Mission 持续目标真实崩溃恢复验收

## Recall

- 用户追加：“继续让独立 agent 补齐 Task 和 Mission 的崩溃恢复验收，使用已授权的真实 Provider 做隔离测试，发现问题直接修复并复测。”授权沿用已有新 worktree、真实 Provider 凭据及配套模型目录；不操作用户在用的进程或窗口。
- 复用 `C:/Users/hengu/.codex/worktrees/continuous-goal-mode/opencorvus`，本轮已从 `601d70f78` 快进到已发布的 `43a596c26`。主工作区存在其他任务的文档修改，保持原样。本轮只委托一个独立 agent，禁止再次委托。
- 应用 `C:/Users/hengu/.codex/skills/benchmark-debug-template/SKILL.md`：先建立实际 checker，按真实无活动超时判断停滞，记录失败，分析共享根因，修复后重跑原验收，主 agent 复核产物。显式请求/用量上限是安全边界，不通过延长既有失败 run 的预算掩盖问题。
- 已读：根 AGENTS.md；持续目标原方案、当前架构及独立复核记录；`script/continuous-goal-check.ts`；先前受控 Chat 进程恢复测试；新合入的完整 Tool 结果恢复记录。上述记录没有证明 Task/Mission 的真实 Provider 崩溃恢复。
- 已搜索：continuous-goal 生产 store/controller、真实 checker/real-provider-audit、process-recovery 测试与 host-recovery 入口。独立 agent 在实施前继续补充全部调用和共享恢复机制证据，不能只按单一模式打补丁。
- 验收不使用模拟 Provider 替代真实运行，不新增或运行 UI 自动化；本轮属于后台崩溃恢复验收。所有模型请求流式；真实凭据及模型目录成对隔离，核对 credential usable、model projected、实际请求 model 三项事实；日志脱敏，结束时检查进程、请求和凭据副本清理。

## 已知现状与影响面

现有目标依赖真实 owner 的 protocol events、确定 continuation/Message 身份、Task root ingress 或 Mission SessionWake。目标自身没有独立持久化队列，重启必须通过已有生产启动恢复和 Scheduler（调度器）重新发现事实。之前 Chat 用例直接调用 reconciler（协调器），中断点在请求发出但响应尚未返回；Task/Mission、实际模型和恢复用量均未被该用例覆盖。

旧真实 checker 只验证正常多轮；旧多进程用例验证并发 reservation（续跑预占）及 paused revision（暂停修订）。本轮需真实终止测试拥有的执行进程，保留同一隔离数据库，然后由新进程从正式启动路径恢复。不能向模型补发人工“继续”消息，也不能重新创建目标来替代恢复。Task 原输入可以产生新的物理 attempt（执行尝试），但原 goal/continuation/input 身份及预算计数必须保持一致。Mission 要保持原 canonical Session 和 opened occurrence（开启轮次）；若测试涉及子 Task，计量须沿现有精确父子关系归属。

尚未知：故障后 Task ingress 的终态/重试归约、Mission accepted wake 的物理恢复、途中流式取消与错误的用量结算是否都符合上述合同。缺少真实运行证据前不判定存在或不存在缺陷。若出现调度/恢复异常，审计全部生产入口、Task/Mission/Session、正常与终态、重试和重启、串并行与跨项目，不增加旁路或影子状态。

## 验收定义与实施分工

1. 独立 agent 拥有新 `continuous-goal-crash-check` checker/driver、相关聚焦测试、本记录的运行设计与证据目录；发现问题可修改实际共享根因及必要当前架构，先同步根因和文件范围。不自行提交或推送；主 agent 负责二次审查、索引、回归、最终提交和 main 集成。
2. 两个独立运行分别通过真实 Task 与 Mission 公共入口创建有限目标。在至少一个已接受的自动目标轮次中观察真实 Provider 活动，再终止精确私有进程；记录 PID（Process Identifier，进程标识）、实际 occurrence、owner/input/receipt、物理请求及中断点。应优先覆盖已收到部分响应的中断；若模型响应过快，必须如实记录实际断点，不用“已开始”代替故障事实。
3. 重启同一隔离 home/project 的正式服务，通过原 host recovery 与 Scheduler 完成恢复。checker 不直接替代 reconcile 调度、不伪造完成事件、不发新的用户继续消息。最终核对 goal complete、原 Task/Mission 结算合同、同一目标身份、同一 continuation 预算、真实模型输出及实际 provider_usage_event/goal usage 关联。
4. 运行前在本记录补充 exact model、运行根、输入、请求/目标预算和无活动超时；所有配置只保存非敏感值。Provider 凭据只从本机已授权来源读取到私有目标，不输出内容。后台运行采用有界定时检查，不持续监听日志；工具链失败先修复后重跑原验收。
5. 分别留存成功/失败的原始脱敏日志和结构化判定。独立 agent 报告后主 agent 对数据库身份、物理崩溃/重启、模型请求及用量再次核对，并运行与实际修改相关的聚焦测试和正常交付检查。

## 当前状态

独立 agent 已完成 Task run1 与 Mission run2 的真实 Provider 崩溃恢复验收；Mission run1 的检查器失败原记录完整保留。主 agent 已复跑聚焦合同并独立核对物理进程、数据库、真实请求、用量及正文。没有修改生产恢复实现，检查器缺陷已修复并完整复测；具体边界与交付验证见末节。

## 独立执行设计（请求前冻结）

- 精确模型为 `openai/gpt-6.1-sol`，实际 Provider API 模型必须等于 `gpt-6.1-sol`。授权来源为本机默认运行根 `C:/Users/hengu/AppData/Local/opencorvus/data/` 下成对的 `auth.json`、`models.json`；只复制到新隔离根，不写回源。静态预检确认 OAuth（Open Authorization，开放授权）尚未过期、模型目录包含目标。usable 仍需正式服务的真实流式 preflight 验证，不能以文件存在代替。
- 各模式独立 run：现成 `bootstrapIsolatedTestRuntime` 在系统临时目录创建 `opencorvus-test-run-*`，确切 home/project/database 路径在任何 Provider 请求前写入该 run 的 `manifest.json`；证据目录 `specs/artifacts/2026-10-13-continuous-goal-crash-recovery/<kind>-<runID>/`，新 run 使用新目录，不覆盖失败。
- 每 run 总请求上限 **32**（包含 preflight、崩溃前、恢复后全部模型请求），goal 的 `tokenBudget=800000`、`turnBudget=3`。第二进程的准入额度为总额减去第一进程持久化审计计数，不能因重启重置上限。若用尽则停止并记录失败；不提高既有 run 额度。
- 真实无活动超时 **180000ms**：Provider source-reader 字节/状态变化、Message/Part/协议/Tool 事实变化或服务启动输出是活动；不把固定轮询和时间戳本身算活动。单次 HTTP 请求限 30000ms，服务清理限 30000ms。长运行只定时读取结构化结果，不持续监听日志。
- 输入为有限说明交付：首轮明确创建持续目标并给出两阶段结构，结束当前输入保持 active；第一个 goal-controller 自动轮次输出六项具体验收标准，再核对实际输出完成目标并完成原模式合同。说明若运行时进程中断，应核对持久化事实并完成同一六项标准，不重复已结算工作。Task 使用现有 no_action 结算首轮，最终正常完成 Task；Mission 只做有限协调、无子 Task，最终调用原 complete_mission 合同。原始完整输入写入 manifest。
- driver 以 Bun 子进程句柄运行正式 `src/index.ts serve --project-dir ... --startup-receipt ...`；审计 preload 只复用 `RealProviderAudit` 观察真实请求/reader，每100ms快照，不消费第二份响应或干预模型流。服务本身的原启动链执行 `host-recovery`、全局 Scheduler 和项目 bootstrap。
- 前置入口是 `/provider` 投影查询与真实 `/global/chat/start` preflight；目标入口仅 `/task` 或 `/mission/wake`。自动轮次出现后，用只读 SQLite 事实和对应 reader requestContext 绑定断点；已收到 bytes、reader 未结算，且相关 assistant 的 text/reasoning 长度或 Tool 请求已有持久化进度时优先物理终止。推理只记录长度，不导出原文。
- 崩溃使用持有的私有进程句柄强制终止并 await exited；同一运行根/database/project 启动第二个正式服务。恢复观察只读数据库与审计文件，完成自动恢复前不请求可能初始化项目的目标 GET 路由，不发人工继续、不直接调用 reconciler。
- Mission 允许真实 `OpenCorvus runtime recovery` 参与者的新 Message：核对其 openedEventID/deadOwnerGeneration/interruptedAssistantMessageIDs 因果身份，保留原 goal-controller Message 与 continuation 唯一性；不强迫恢复回复 parentID 等于原 Message。Task 核对同一 root ingress/source Message/execution epoch 的新物理 attempt。
- 最终要求目标 complete、原模式正常完成、原 goal/continuation/input 身份及 turnsAccepted 保持、真实可见输出、实际 usage 行与 goal 引用累计相等。被硬中断且 Provider 尚未返回用量的成本标记 unknown，不估算补写。
- 预计文件：`script/continuous-goal-crash-check.ts`、`script/continuous-goal-crash-preload.ts` 与必要聚焦正向 checker/生产根因测试；生产修改待实际失败证据确认后记录。索引、最终提交和推送由主 agent 负责。

已补充阅读/搜索：真实 Provider audit 及 source-reader observation、正式 serve startup receipt/host-recovery、Task root ingress goal continuation、Mission process-recovery/facts/driver、bootstrap/Scheduler 注册和 Task/Mission 正常完成合同。父 agent 特别复核了 Mission 恢复参与者语义、跨进程请求上限和未返回 usage 的边界，已纳入设计。

### checker 二次复核约束

Task run1 已启动后，主 agent 独立复核指出需收紧验收器：Task 完成必须属于 cut ingress 的 execution_epoch 且最终公共状态为 completed；Mission 最终公共 outcome 必须 accepted，openedEventID/deadOwnerGeneration/中断 assistant 精确绑定；恢复用量须是崩溃后快照之外、第二进程启动后的新增 usage。kill 与落盘之间有窗口，必须在旧进程真正退出后、新进程启动前保存 `crashed-facts.json`，证明目标与 cut assistant 仍未结算。上述是 checker 精度修正，不是生产缺陷；已开始的 v1 run 不会热替换断言，缺失必需证据时不能计作验收通过，须保留后新 run 复测。

### Mission run1 失败与共享恢复审计

- run1 已命中真实自动轮次：reader收到473994 bytes/22 chunks，cut assistant已持久化4字符正文；旧PID81624被SIGKILL，新正式serve PID80608自动恢复。退出后快照保留原未完成assistant与old Prompt generation，未人工发送任何续跑消息。
- 原checker硬性要求新 `mission.process_recovery` Message，实际goal reconciler先取得物理owner，沿已接受的原goal-controller Message恢复。旧assistant由生产SessionLoop写入 `ProcessExecutionInterruptedError`；新PID下后续所有assistant保持原accepted input，目标/receipt/轮数/opened均保持。该运行在检查“Mission runtime recovery cites interrupted assistant”时失败，保留failed原记录，不改为passed。
- 已横向复核 Chat/Task/Mission：Chat使用原SessionWake，Task使用原root ingress/FIFO；Mission的goal receipt重放与常规process recovery均进入原opened admission和SessionPromptOwner。专门recovery通过旧generation精确事务释放及write-ahead acquisition fence防止替换新live owner。当前continuous-goal合同允许原accepted wake重放，没有规定每次物理中断都必须新增runtime Message；本轮没有发现可据此修改生产调度的证据。
- checker改为证明单一真实持久化因果链，并记录 `recoveryEvidence.kind`：`task_ingress`、`accepted_goal_input` 或 `mission_process_recovery`。共同要求旧assistant被生产恢复terminalize、新PID和不同generation的Prompt owner、实际新Provider request绑定新assistant；Mission原input恢复核对同input/opened，runtime input恢复再严格核对opened/dead generation/interrupted frontier。新owner证据在首条恢复reader出现时保存，不能依赖最终standby仍保留owner。
- 第二个checker缺陷是多条SELECT和reader定时快照可能取到tool step间隙：run1失败后快照已有新的未完成assistant。改为只读数据库事务快照，Mission最后一个正常assistant必须finish=stop且completed晚于complete Tool outcome，随后才检查公共accepted outcome及精确receipt；不以瞬间live=0或model自述代替正常结算。
- 无活动判定剔除Session更新时间、租约续租、owner heartbeat和审计采样时间，只保留Message/Part/Tool/业务Protocol/usage前沿与物理reader进度。stdout/stderr仅在服务启动阶段算活动，防止重复日志使业务超时无限延后。
- 以上均为checker修复与既有架构语义澄清，不改变生产实现。补充三种恢复因果及明确activity投影正向合同后，使用新Mission run2重跑完整真实验收，原run额度和结果不续改。

## 独立执行结果与二次复核

| run | 结果 | 真实模型请求 | 目标结算用量 | 实际断点/恢复 |
| --- | --- | --- | --- | --- |
| task-run1 | 通过；v1 checker 的精确身份/时序由原始事实和主 agent 独立脚本补强 | 11 | 212143 token | 自动轮次的真实流已接收544748 bytes，随后持久化 read_task_message Tool 请求；SIGKILL PID83328，正式serve PID71272沿原Task ingress/epoch1恢复 |
| mission-run1 | 失败，保留原checker错误结论 | 14 | 不作为通过run汇总 | 473994 bytes/22 chunks且已持久化4字符正文；SIGKILL PID81624后PID80608合法恢复原accepted goal input，checker却要求runtime Message，并在正常final stop前误收束 |
| mission-run2 | 完整修后通过 | 19 | 225103 token | 自动轮次已持久化2字符正文；SIGKILL PID75032，退出后仍保留未完成assistant；正式serve PID83872自动恢复同input，新Prompt generation被首条恢复reader现场保存 |

- 所有 run 使用 `openai/gpt-6.1-sol`，每个真实模型请求均受精确模型/stream=true校验；Task和Mission成功run各保留同一goal、唯一continuation和一个已接受自动轮次，没有人工“继续”、重新创建目标或直接调用reconciler替代正式启动。
- Task 原输入映射到 `orchestrator_control_ingress.ingress_id=art_hqIRZPDrSSfsnDP4cL8g`；旧assistant `msg_hdkwhkYFdpTewMzsCORv` 在新进程中于1791882571338被生产逻辑结算为 `ProcessExecutionInterruptedError`，晚于SIGKILL断点1791882457192，证实原物理执行未正常完成。唯一task.completed和原opened均属于epoch1，最后3条新usage晚于第二进程实际Provider收到响应的事实；累计4条目标usage为212143。六项标准可见正文已逐项人工复核。
- Task run1少了独立的post-kill/pre-restart快照；主 agent 用上述生产恢复terminalization、exact输入/epoch、两物理PID与第二进程reader/usage时间建立等价证据，独立脚本结果保存在该run的 `parent-evidence-review.json`。没有改写run1原记录或为重复收集已具备的事实再次消耗模型。
- Mission run2的 `recoveryEvidence.kind=accepted_goal_input`；原opened、goal、continuation与输入均保持；旧assistant中断错误、新PID及新generation、实际恢复请求、4条恢复后新增目标usage和最终accepted Mission Tool回执逐项吻合。19次真实请求全部HTTP200，8条恢复请求均EOF；最终正常assistant finish=stop晚于完成Tool的time.end。原公共Mission outcome为accepted，精确message/toolCall/part与receipt一致，task_acceptances=[]。
- 新增checker正向测试 **4 pass、6 assertions**，覆盖Task exact ingress、Mission原input恢复、Mission runtime recovery完整因果、以及仅业务前沿/reader进度的无活动投影。Backend typecheck三次均通过；最终 `git diff --check` 通过。主 agent 另在当前基线复跑原29项目标合同通过；全仓交付检查与提交由主 agent汇总。
- 本轮修改范围仅两个新checker脚本、一个checker合同测试、当前continuous-goal架构语义澄清与本记录。没有修改生产调度/恢复实现，也没有运行UI自动化。

### 模型自述与真实证据的边界

Mission成功run最终正文声称“未发生真实中断”，与SIGKILL、新PID、新generation、`ProcessExecutionInterruptedError`及恢复usage事实矛盾。该模型自述不能作验收依据。实际用户目标“六项说明交付和真实恢复机制”分别由正文及持久化/物理事实证明，不能混淆。

只读代码核对提供了一个明确的既有上下文边界：`session/loop.ts` 默认调用 `Message.toModelMessages` 时未设置preserveAssistantErrors；`session/message.ts` 默认跳过带错误的assistant，ProcessExecutionInterruptedError不属于保留部分正文的MessageAbortedError例外。专用runtime recovery Message若未产生，默认模型历史不保证包含中断说明。该策略可解释自述，但本轮没有记录实际Provider input body，不能声称已比对该次模型输入的具体字节，也不据此扩大为未经验证的全局错误历史重构。

### 清理与证据归档

- 六个正式服务进程均已通过各自持有句柄确认退出；断点旧进程为SIGKILL，末次服务收束后7878端口不可访问。Task run1第一条端口reachable=true来自尚在运行的新进程复用了该端口，最终false；checker已改为全部子进程收束后检查去重端口。
- 三run的auth.json/models.json隔离副本均已删除，settlement.json记录credentialPairRemoved=true。源凭据只读；被硬中断且Provider未返回的用量保持unknown，没有估算或补写账本，也不声称远端已结算全部成本。
- 原每100ms审计快照已逐run完整压缩为 `audit-snapshots.jsonl.gz`，每行含原相对path及完整JSON；解压后的全部对象与原快照逐项直接比较一致后才删除本run两个快照目录。Task510、Mission失败757、Mission成功1032条，共2299条事实全部保留。关键JSON、transcripts、failed-facts、stdout/stderr及主agent证据文件保持原样。
- 未覆盖：提交continuation前崩溃、仅Message提交/Provider尚未开始的断点、恢复过程中再次崩溃、真实Mission子Task崩溃/恢复计量、Task跨epoch的崩溃、真实多项目并行和全部优雅关闭矩阵。本轮成功证明两个独立场景中自动轮次已开始且存在真实模型输出/Tool进度后的硬中断与正式启动恢复。

### 可重放命令

在 `packages/opencorvus` 执行，`GOAL_CRASH_KIND` 分别设为task/mission，`GOAL_CRASH_EVIDENCE` 必须为新的、尚未存在的run目录：

```powershell
$env:GOAL_CRASH_ALLOW_REAL_PROVIDER='1'
$env:GOAL_CRASH_KIND='mission'
$env:GOAL_CRASH_MODEL='openai/gpt-6.1-sol'
$env:GOAL_CRASH_AUTH_SOURCE='C:/Users/hengu/AppData/Local/opencorvus/data/auth.json'
$env:GOAL_CRASH_EVIDENCE='<absolute new run directory>'
& C:/Users/hengu/AppData/Local/npm-cache/_npx/214ebe133ee6a004/node_modules/bun/bin/bun.exe script/continuous-goal-crash-check.ts
& C:/Users/hengu/AppData/Local/npm-cache/_npx/214ebe133ee6a004/node_modules/bun/bin/bun.exe script/run-tests.ts test/continuous-goal-crash-checker.test.ts
```

原具体命令执行输出为工作树 `.tmp-goal-crash-task-run1.log`、`.tmp-goal-crash-mission-run1.log`、`.tmp-goal-crash-mission-run2.log`；完整证据在 `specs/artifacts/2026-10-13-continuous-goal-crash-recovery/`。独立agent不提交推送，主agent负责最终证据复核、索引、提交与main收敛。

## 主 agent 交付复核

- 原29项目标合同与新增4项checker合同在当前工作树独立复跑通过，共33项；真实Task和Mission成功场景均由独立证据脚本和人工正文复核再次确认。根8个工作区类型检查、文档/架构检查和格式检查通过。66个证据文件（含gzip解压内容）的已知凭据扫描为0命中。
- 本轮验收提交为 `13a045642`。合并已发布上游后的 `9a7a5aa9e` 正常推送成功，原pre-push的类型、路由、文档、lease owners、架构/包/committed-tree模块拓扑及secret scan全部通过，未绕过hook。只出现三个文档索引冲突，保留双方条目；上游后端生产路径未改动，无须重复真实Provider收费运行。
- 同步主工作区时发现并行提交 `099aaf2b3`。已核对其387规格Recall、真实模型与桌面/编辑导出、typecheck/build及收尾证据，确认属于另一个已授权且验证通过的交付；在隔离工作树合并它，避免覆盖或丢弃主工作区历史。主工作区尚有其他未提交改动，仅对本任务与其重叠的文档索引逐文件备份、验证并保留，其他文件不纳入本轮提交。
