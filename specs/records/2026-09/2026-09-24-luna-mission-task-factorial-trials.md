# Luna × Mission/Task × 专家团进化：十例配对 trial 设计

## Recall

- 用户原话：“设计这几个实验trial：luna+mission/task+静态专家团/自进化专家团+10个case”。交付实验设计，当前不启动模型、作者 Task、服务或 automation。上一条“别测了”所产生的停测/暂停状态保持有效。
- 设计目标：分别测量 Mission 监督层的收益、专家团自进化产生的定义变化收益，以及二者是否有交互作用；同时定位漏项发生在哪一层。共四个实验臂，每臂同十例，一次开发探针共 40 个 case episode（案例执行），另计一次候选创作成本。
- 硬约束：全部真实模型请求（含 Mission、Orchestrator、worker、压缩、小模型与作者）只使用流式 `openai/gpt-5.6-luna`；原始输入、世界、业务产物、消息、Tool 输入输出、评分和历史候选只读。禁止手写/修补自进化候选、替换分数、按分数选择重试、额外请求限制或隐含扩展测试轮数。不存在用户授权的 3000 次/85%预算。
- 现有状态：监督数据链修复提交 `02d5bc8b33aaa0e7d57f99be7be99123cc52abb8` 已推送，76 项本地契约通过；没有修复后的真实模型效果结论。旧 Inspect 路径直接创建 actor=user Task，未运行 Mission。共享 permission 恢复异常另有记录，不能称已修。
- 已读：根 AGENTS；[监督修复记录](2026-09-24-supervision-acceptance-repair.md)、[自进化算法记录](2026-09-24-expert-squad-evolution-algorithm.md)、[原十例实验](2026-09-24-automationbench-self-evolution.md)；Task control-plane 架构；实际 Task/Mission 路由、Mission completion/board/projection、Panel Task 创建契约、Inspect adapter/solver/AutomationBench world/setup。全仓搜索确认当前没有 Mission-mode Inspect adapter。未委托子 agent。
- 本次是文档设计，不使用 benchmark skill 的持续运行循环。没有生产代码、评分器或原案例修改；不以设计代替可执行验收。

## 1. 实验矩阵与要回答的问题

采用 2×2 全因子设计，以 case 为配对区组。两个因素为入口层级和专家团定义。四个臂必须使用同一份冻结软件与配置，不能把旧分数当作新实验的对照。[NIST 全因子设计](https://www.itl.nist.gov/div898/handbook/pri/section3/pri3331.htm)与[区组设计](https://www.itl.nist.gov/div898/handbook/pri/section3/pri332.htm)支持组合覆盖和区组内比较；具体试验配置是本项目的设计决定。

| ID | 模型 | 真实入口及监督链 | 专家团 | case 数 |
| --- | --- | --- | --- | --- |
| TS | Luna | Task → Orchestrator → executor/verifier | 静态 S0 | 10 |
| TE | Luna | Task → Orchestrator → executor/verifier | 自动生成后冻结的 E1 | 10 |
| MS | Luna | Mission → Task → Orchestrator → executor/verifier → Mission 验收/必要返工 | 静态 S0 | 10 |
| ME | Luna | Mission → Task → Orchestrator → executor/verifier → Mission 验收/必要返工 | 与 TE 完全相同的 E1 | 10 |

本轮“自进化”指真实算法生成的定义经过冻结后接受测量，不在案例间继续学习。若每个 case 后改定义，运行顺序、训练量和所用版本都会混入效果，属于另一个在线学习实验，不能塞入本矩阵。

对 strict 与 partial 分别逐 case 计算，再取十例均值：

- Task 下的进化效应：`TE − TS`。
- Mission 下的进化效应：`ME − MS`。
- 静态定义下的 Mission 效应：`MS − TS`。
- 进化定义下的 Mission 效应：`ME − TE`。
- 交互作用：`(ME − MS) − (TE − TS)`；不能只凭 ME 分数最高就称两种机制协同。

这是十例开发探针。每格只有一次执行，不能把 40 次执行当成 40 个独立案例，也不能据此宣称显著性、泛化能力或完整 Evolution Lab Campaign 通过。后续若另行要求复现，可预先安排相同十例完整重复；不得只重跑低分样本。

## 2. 静态与自进化定义如何确定

### S0：一个共同父版本

以当前仓库 `expert-squads/builtin/automationbench` 的 `2026.09.24.2` 为静态父定义。启动前由正式加载器解析为不可变 package revision，并记录其真实身份。所有组都使用修复后的相同 Core 提示词/工具/运行时，因此历史 .2 得分不构成本轮基线。

### E1：一次真实创作，两个入口共享

1. 在独立作者 Task 中，由 Luna 对 S0 调用生产 `evolve_expert_squad_from_feedback`，形成一个候选；作者入口和算法版本预先锁定，不为 Task/Mission 各造一个不同候选。
2. 创作材料在四组运行前固定：已有历史十例原始结果与操作证据、完整 S0 定义、监督缺陷与已修复项说明。历史已关闭的传输缺陷要标注，不能继续用提示词补偿它。材料文件清单和实际完整读取记录分别保留，提供文件不等于模型读过。
3. 只允许专家团的行为指令变更；本矩阵保持角色数、Tool 授权、executor/verifier 拓扑和 Core/Mission 提示词相同。Host 自动推导版本。角色/授权拓扑变化需要另立实验，不能混作本轮“指令进化”。
4. 精确文本/来源校验拒绝可以在同一作者 Task 内纠正到首次成功发布，全部尝试计成本；首次发布后停止创作。没有多个候选打分挑优；若发布内容违反事先范围，整次候选准备不合格，保留它并报告，不手工改到合格。
5. 固定 E1 的候选 Artifact、父身份、完整字节及算法源提交，然后才开始 40 次测量。TE 与 ME 使用同一份 E1。四组的新分数和世界不可反馈给作者。

旧 .3/.4/.5/.6 不是 S0 的这次直接进化结果，且用过不同历史上下文，不能直接混用为 E1。历史十例已参与过调试/创作，所以本设计明确是同分布开发探针，不能称独立留出集。将来要测泛化，必须另立从未进入创作材料的案例集；本次不擅自增加案例。

## 3. 固定十例与预先登记的运行顺序

唯一案例来源：[`probe-manifest.json`](../../artifacts/2026-09-24-automationbench-self-evolution/probe-manifest.json)，官方 AutomationBench `4a8e106`。保留每个 case 原请求和 `official-world-clock-v1` 上下文；官方未指定时间的仍为 null，不补系统当前时间。

下表是设计阶段用排序种子 `20260924` 生成并冻结的顺序。种子只控制实验排程，不是 Provider 随机种子。每个 case 的四组在独立世界依次执行；四组在各顺序位置出现次数相差至多 1。全部案例四组完成才汇总，不根据中途分数改顺序。

| 区组顺序 | case | example_id | 四组执行顺序 |
| --- | --- | --- | --- |
| 1 | `hr.candidate_submittal_docs` | 5034 | TS → TE → ME → MS |
| 2 | `sales.create_new_opportunity` | 9 | TE → MS → TS → ME |
| 3 | `sales.unreliable_label_account_review` | 1203 | MS → ME → TE → TS |
| 4 | `operations.sheets_asana_approved_request` | 1223 | ME → TS → MS → TE |
| 5 | `hr.probation_review_reminder` | 5019 | ME → TS → MS → TE |
| 6 | `finance.late_fee_calculation` | 4030 | TS → TE → ME → MS |
| 7 | `support.zoho_desk_capacity_planning` | 1585 | TE → MS → TS → ME |
| 8 | `marketing.podcast_episode_promotion` | 1125 | MS → ME → TE → TS |
| 9 | `operations.monday_slack_inventory` | 1210 | MS → ME → TE → TS |
| 10 | `finance.annual_budget_prep` | 4078 | ME → TS → MS → TE |

## 4. 共用控制条件与隔离

- 同一冻结源码基准：当前修复 `02d5bc8b`；Mission adapter 尚需实现并验收，因此真正开跑的共同 revision 还未确定。该后续交付完成后必须在第一例前锁定四组同一 revision，测量中不改代码、Core 提示词、自进化算法或配置。
- 已安装版本的精确区分：`inspect_ai=0.3.259`，`opencorvus-inspect=0.3.3`。后者是项目适配器版本，不是 Inspect AI 版本。新增 Mission 支持后的适配器版本/依赖锁也须在整轮开始前锁定，旧版本数字不能冒充新实现身份。
- 同一官方世界实现、初始数据、案例输入、评分策略 `official-strict-assertions-v1`、工具 schema、模型采样配置、内部调度配置与业务交互约束。外层 Inspect 使用 `model=none`；实际 Provider 请求模型身份逐次审计。
- 一 case episode 一个独立项目、runtime、数据库、Mission/Task/Session 树、世界、证据目录。业务 Tool 指向该例专用模拟世界。禁止跨 episode 共享业务状态、记忆、摘要或调度器上下文；不把创作材料挂进测量项目。
- 建议本轮外层 case 并发为 1；生产专家团内部并发配置四组一致。四组共同采用该新实验配置，故也不与历史并发 2 的运行作纯对照。这隔离共享状态干扰，不等于修复或验证跨项目 permission 恢复缺陷。
- 仅本轮固定 40 个 episode 加一项创作工作，不设 agent 自造的 3000 请求上限。所有预检、作者、压缩、失败请求、内部重试均计入真实成本。模型身份错误、凭据错误或宿主公共故障要明确停在基础设施问题，不能用另一模型顶替。
- 若以后启动真实运行，使用有效授权与配套模型目录；隔离副本不刷新，秘密不进入日志/提交。当前设计阶段不读取或使用凭据，不启动预检。

## 5. 两种入口的真实契约

### Task 臂

复用公开 `POST /task`，让服务自然生成 actor=user。每例一个初始 Task，绑定该臂不可变 S0/E1。观察该 Task 的真实活动及终态；completed 与 failed 都保留真实终态和官方得分，取消/超时不可冒充业务 0 分。调度器在 Task 内正常返工属于该例执行，人工重开已结束样本不属于本 trial。

### Mission 臂

必须经过公开 `POST /mission/wake`，`productPillar=work`、`model=openai/gpt-5.6-luna`、`expertSquadIDs=[automationbench]`，在只安装本臂版本的独立项目中启动真正的 Mission。身份、创建和 Task 归属都由生产路径产生，不能直接创建 Task 再写一个 actor=mission 标签。

Mission 接收完全相同的原始业务请求和官方时钟；另加固定的入口控制说明：使用指定专家团建立一个初始业务 Task，并在原 Task 上完成验收与必要返工。MS/ME 的 Mission 说明字节相同。Task assignment 可以由 Mission 正常组织，但原始请求始终可追溯，任务缩窄是待测缺陷，不由 harness 帮它补写。此矩阵隔离“额外监督层”，不同时比较多 Task 分解策略。

必须记录：真实 kind=mission Session、mission.execution.opened、真实 `panel_create_task` 调用、服务写入的 Mission 归属、子 Task 固定 package revision、完成事件送达 Mission 的真实唤醒、Mission 读取 Completion Decision/participant Messages 的记录、必要时原 Task acceptance ledger 与新 epoch、最后的 `panel_complete_mission` 事实。未触发返工并不自动算失败；需按是否存在真实遗漏判断。没有这些入口/归属证据，不能将样本算作 Mission 臂。

观察边界必须覆盖整个 Mission 及子 Task 树：子 Task 第一次 completed/failed 时仍保持同一个官方世界存活，等待 Mission 审查和合法同 Task 返工；不能提前封存世界，也不能看到部分得分后替 Mission决定是否返工。Mission 成功端点为当前 completion 事实且整个相关执行树静止；仅 `status=inactive` 或 board 的 `review` 不是完成。

当前 Mission 没有与 Task.failed 对称的通用失败终态，因此不能在适配器里伪造一个。未产生真实完成、持续等待/遗留 review 的样本按预注册无活动超时保留 unavailable，并计入端到端收尾失败；官方质量均值不得只挑成功完成的 Mission 子集对比 Task 全集。额外创建业务 Task、跨版本或错模型等协议偏离都保留原始记录、单列有效性诊断，不静默丢弃或重跑。

## 6. 观察、收尾和原始评分

- 两入口同为 300 秒真实无活动超时、2 秒轮询。Task 使用既有持久化活动事实；Mission 使用公开 `/:missionID/activity-cursor` 覆盖根 Session 和所有子 Task。轮询自身、相同快照或宿主等待循环不算业务活动。正常活跃工作不因运行总时长达到 300 秒被杀死。
- Mission 适配器不得以 Task 终态代替 Mission 完成，亦不得以关闭/取消作为“完成”。任何终态后的评分先等相应范围内写入者和任务活动停止，再通过同一官方世界的现有自然 seal/scorer 流程产生本次独立结果。
- 原始 `.eval`、world event sequence、snapshot、Tool receipts、native 状态与错误原样保存。人工分析读取已存分数，不编辑/替换评分，也不重算覆盖历史。Inspect 原生日志提供执行细节和样本级分析接口，沿用它，不造第二套评分真相。[Inspect 日志文档](https://inspect.aisi.org.uk/eval-logs.html)
- 各样本区分 official_scored、timeout_unscored、infrastructure_error、protocol_deviation、operator_cancelled。未知/不可评分为 null，禁止补 0、补跑、复用最佳输出或自动 `eval-retry` 混入主结果。
- 新无活动超时先保存真实异常和活动证据，再经公共 cancel/abort 收尾该 episode 自有树；不影响用户进程、其他例或历史实验。公共故障若使剩余实验不可运行，停止本轮并保留未执行条目，修复后另开完整实验而非拼接“干净”样本。
- 若真正启动长跑，再启用五分钟持久化快照跟进，仅在实质变化、失败、需处理或完成时通知。当前 automation 继续 PAUSED。

## 7. 指标与机制归因

| 层面 | 指标/记录 | 解释边界 |
| --- | --- | --- |
| 业务结果 | 官方 strict 成功数/可评分数；平均 partial；十例逐例差值与回退 | 首要质量指标；native completed 不代替官方成功 |
| 执行可靠性 | 计划 10、实际执行、可评分、超时、基础设施错、协议偏离和人工取消数 | 分母始终公开；不通过丢弃未评分样本提高均值 |
| 宣称与结果冲突 | Task/Mission 宣称完成而官方 strict 未通过的数量；再逐条原证据复核 | 前者是报警代理量，字面断言失败不自动等于语义虚报 |
| 监督数据链 | 所选验收身份一致性、实际投影标准/能力、源记录与 mutation receipt 的读取、未完成项的实际交接 | 用真实 Message/Part/Tool 引用证明，提示词写了不算执行过 |
| Mission 附加贡献 | 已存在遗漏 → Mission 实际发现 → 原 Task 返工 → 原始效果被修复的可追溯链；也记录漏检和新回退 | 不为中间状态另造分数；未发生返工的必要性按原请求证据判断 |
| 成本 | 实际 Provider 请求、输入/输出/推理/缓存 token、业务/协调 Tool 次数、耗时、epoch/返工次数 | Mission 和作者成本不能漏算；本地 cost=0 不意味着服务免费 |
| 进化过程 | 首次候选生成成功、拒绝/修正次数、完整读取覆盖、精确编辑归属、父身份与发布后不变性 | 只证明本次创作过程；一个候选不证明算法普遍有效 |

附加义务审计以原始请求和真实源记录为准，使用统一表格：义务、责任角色、源证据、实际操作、核验依据、接受/返工决定及未决点。四组结束后只读复核，附加审计不写回官方分数，不把隐藏评分细节暴露给运行中的模型。

完整十例可评分且协议有效时，使用预先定义的保守改善标准：strict 与 mean partial 均不下降，至少一项提高；同时公开每例回退及成本增幅。质量与成本冲突属于权衡，不宣称全面胜出。Mission 效应包含额外监督推理和合法返工机会，不是等 token 预算下的纯协调效率；等成本对照属于另一个实验，本次不自设请求预算。Provider 缓存命中单列，独立本地 runtime 不等于 Provider 冷缓存。若缺分，只展示观测分数及缺失数/相同可评分案例的描述性对比，不能宣布完整十例改善；必要时展示未知分的理论上下界，并明确其不是补评分。

分别报告四组执行成本，以及共享一次 `C_author`。TE/ME 平分作者成本时按全部 20 个进化组 episode 分摊，同时保留未分摊成本。历史创作材料产生的已发生成本单独列出，不混入这轮新增成本，也不假装历史材料免费生成。所有候选尝试必须计入，不能只计成功发布的一次。

## 8. 实现缺口与启动前验收

当前只完成设计，四组尚未具备一键可运行条件。实际代码证据：`adapter.py` 是公开 Task API 调用器；`automationbench/task.py` 当前 setup 仅按 Task completed/failed 封存世界；因此直接复用旧 CLI 无法测 Mission 完整循环。

后续要实现一个明确的入口因素（暂名 entrypoint=task|mission），复用同一 world/scorer，分别由真实入口适配完成观察。必须通过模型无关的合同验收：Mission 创建归属、held Squad/模型身份、child Task 第一次终态后世界继续存活、原 Task repair epoch、根与子树活动推进、正常完成后封存、超时孤儿公共收尾、序列化结果与 null 错误输出、跨 episode 隔离。不得发明 Host 业务成功 gate 或伪造 Mission 消息。

这是必要测量入口支持的设计提案；不在本次悄悄修改此前冻结的引擎。实施后会形成一个新的共同冻结运行基准。正式四组开始之前还需真实 Luna 的接口/模型与 Mission 归属烟测，单独标为预检成本，不能占用或替代任一正式评分样本。本次不执行这些预检。

启动清单是实验身份/数据完整性核对，不是教模型选流程的 Host gate：S0/E1 已冻结，作者来源清单存在，四组共同源码/依赖/配置已锁，十例输入一致，Mission 自然入口及完整观察可用，持久化和清理正常。设计不把这些尚未完成项写成已通过。

## 9. 预期交付和当前状态

后续每个 episode 独立保留 `trial_id + case + example_id + replicate`、源码与适配器版本、请求和模型身份、包父/候选身份、Mission/Task/Session/epoch、原 .eval/world/操作证据、状态和成本。汇总形成一张 10×4 原分表、四个配对主比较、交互差值、成本表和按实际决策定位的失败报告。历史 run 不删除、不覆盖。

当前交付：已完成上述设计、源码可行性审查及十例/版本核对。仅新增此文档并更新索引。未生成 E1、未实现 Mission adapter、未运行 40 例、未启用自动跟进、未使用 Provider 凭据。后续实现/运行仍需以届时明确工作指令推进。


设计复核：已逐项核对表内 case/example_id 与原 manifest 完全一致，十个区组每个含 TS/TE/MS/ME 各一次、合计 40 次，每个臂在各顺序位置的出现次数差不超过 1。`docs:check`（342 operations/25 groups）、`check:architecture-index`（17 current documents）和差异空白检查通过。仅文档及索引变更；数据结构核对不是模型或 benchmark 验收。文档生成后的控制台输出曾因 Windows 默认编码失败，文件已正确写入 UTF-8；随后以显式 UTF-8 读取和核对成功，没有模型运行或结果变更。


## Execution authorization and concurrency checkpoint

- 用户新指令：“开始并发进行实验”。这授权完成方案所需的 Mission 入口适配、模型无关验收、一次真实 E1 候选创作，以及正式 40 个 case episode 的运行。旧停测指令对上一轮仍成立，原始候选/分数只读；本轮是新实验身份。
- “并发”更新原顺序约定：十个 case 区组按上表顺序推进，每个区组的四个臂各用独立主机/项目/世界**同时**运行，最多四个正式 episode 在途。表中四臂顺序只控制入队启动顺序和启动时间差的记录，不再要求同区组串行完成；全部四臂终态或不可评分后进入下一区组。外层并发固定四，内部 Expert Squad 调度配置保持各臂一致。上表每个位置的频次平衡是启动顺序平衡，结果分析仍按 case 配对。
- 由于新增 Mission 入口必须真实覆盖根 Session/子 Task 与世界最终封存，先读既有 `adapter.py`/`solver.py`/Mission public routes，再补单一 Inspect 入口因子，保留旧 Task 路径和同一官方 world/scorer。修复前先审计直接触发点、跨 Task/Mission/Session 的活动/终态/重启恢复、多项目并发隔离；专注只读观察契约，不修改业务评分。
- 检查发现公开 Mission `activity-cursor` 是持久化事件树，Task 原 `conversation/session` 有额外 liveEpoch/lastLiveSequence。Mission 纯流式未持久化期间的 live 进度是否可从现有公开 API 读取仍未知；必须在模型无关测试和真实预检中确认 300 秒无活动判定不会把仍在推进的 Mission 流误认为停滞。若不可观测，不以系统状态猜测进度或提前启动正式计分。
- 当前尚未启动主机、作者或 Inspect。第一步完成 Mission adapter 合同与源代码共同冻结；随后核对当前凭据有效性、配套模型目录和精确 Luna 请求身份，再一次创作 E1。任何已存在的 `host.json`/Inspect process 先按指针和 PID 核对，不能重复启动。


## Mission adapter and real preflight checkpoint

- Inspect adapter 0.3.4 now accepts one `entrypoint=task|mission` factor while reusing the same official case/world/scorers. Task original client behavior and solver remain intact. Mission goes through public `/mission/wake`, obtains real Mission ID/Session, reads its public list and durable activity cursor, waits beyond the first child Task terminal boundary, and accepts only the current `MissionRecord.completion` with exactly one Mission-owned completed Task and matching project directory. Official world seal for Mission follows that exact Mission completion; a mere child Task completed leaves `unscored`. Native completion is a separate diagnostic scorer; official strict/partial are unchanged.
- Focused Python contract tests exercise natural Mission completion after two observations of a completed child Task, exact real endpoint request body, one-Task protocol error, typed 300-second-policy inactivity error, original Task client, and same-world seal boundary. Initial 22 related tests and 19 later tests passed; Ruff and mypy passed before the final canonical-directory adjustment. The missing `pip` module in the venv was resolved by using the already available `uv pip install -e . --no-deps`; adapter distribution metadata now reports 0.3.4. No production runtime/evaluator code was changed.
- Isolated host preflight attempt 1 (`.tmp/inspect-factorial-20260924/preflight-host`) ended before any Provider request because the temporary runtime root was a sibling rather than child of the declared test process root. Its failure receipt and credential-copy cleanup remain. The host script was corrected; attempt 2 (`preflight-host-2`, PID 9988) performed an actual paired auth/catalog check and streamed exact Luna reply, then a distinct read-only Mission smoke (no official case) via the public Mission API. The real Mission `f824fc20d18cffb4` created Task `tsk_g00VW9BhGU005drwwpwc`, both naturally completed with zero active work, and the Mission wrote completion Message `msg_g0VW9CLld00foIh4tRe0`. The host recorded 35 actual Luna requests in total, including preflight and smoke. It stopped normally with `credentialCopiesRemoved=true`; exact copied auth/models files and PID are absent. Evidence is retained in its host, Provider audit, preflight and Mission smoke receipts.
- A read-only route check exposed that `GET /mission?directory=...` returned an empty list for a forward-slash caller path even though the stored Mission directory used Windows separators. The adapter now reads the public Mission collection and checks the returned exact Mission ID, Session ID, and normalized project directory itself. No business-state shortcut or Host acceptance gate was introduced. Route check and final local contract checks must pass before authoring or formal scoring begins.
- The Mission durable cursor includes persisted root/child work. The real smoke completed without false inactivity; a single short smoke does not prove arbitrary long unpersisted streaming progress is observable. During the formal run, any such timeout is retained as an unscored infrastructure/observation defect with raw evidence, never silently counted as business failure. A future read-only live-Mission cursor would require an independently scoped runtime change, not a hidden score repair.
- Formal TS/TE/MS/ME cases and E1 author remain unstarted at this checkpoint. The previous stopped `.6` trial and paused old automation are untouched.


### Preflight closure and common adapter validation

- The actual public Mission smoke took 35 streamed `openai/gpt-5.6-luna` requests in its isolated host, including the credential/model preflight. The real parent completed only after its Mission-owned child Task completed. The host PID 9988 has exited; `host.json` says `stopped`, `credentialCopiesRemoved=true`, and copied `auth.json`/`models.json` are absent. The original credential source was unchanged. This smoke used a read-only arithmetic request and `base` Squad, not any of the ten official cases or the intended E1 candidate; it validates the production Mission→Task→Mission entry path, not case quality or AutomationBench Squad behavior.
- The public Mission collection filtered by a forward-slash Windows directory can be empty while the Mission exists under the canonical backslash directory. This was observed after the smoke. Mission adapter now reads the unfiltered public collection, validates exact Mission ID/Session ID, and compares normalized project directories before accepting facts. Task client still uses its existing project-scoped API path. A timeout or protocol failure after Mission admission now requests public abort for that exact owned Mission before its simulated business world closes; the primary error remains the original error and the cleanup outcome is attached to the observation.
- Current local qualification: 30 focused Python tests covering original Task paths, new Mission transport, official world seal, suite registration and old benchmark task; Ruff and mypy pass, OpenCorvus workspace typecheck and docs check pass. Next required work is the durable four-arm block driver, one frozen E1 author Task, then the actual 40-case matrix; no formal case has started.

## Four-arm launch checkpoint (2026-09-24 14:49 UTC)

- Common measured source revision `5f8ee78985121b14793820d0886a1368b085beca` was committed and pushed before scoring. The durable driver `packages/inspect-benchmark/script/run_factorial_trials.py` parsed the exact registered ten-case schedule in plan-only mode; Ruff, mypy, 19 focused adapter/AutomationBench tests and normal Git push checks passed. It creates four isolated host/Inspect pairs concurrently within each case block and advances blocks in the registered order. The original official world, scorer and ten-case manifest remain unchanged.
- One Luna author Task `tsk_g00VW9GOS500npeRiU6M` in `.tmp/inspect-factorial-20260924/author-project` completed naturally. The production `evolve_expert_squad_from_feedback` tool had four recorded calls: three `ArtifactReferenceResolutionError` failures from incomplete source read references, followed by the first successful publication. Core Artifact `art_htlKPEY0jcPBzYSWZofg` binds parent `builtin/automationbench@2026.09.24.2` digest `bc55a3c7c71cb7ef2c05f688a339c9132b3f5d5f752299437276dc3243a3a394` to E1 `2026.09.24.3` digest `b8aa3005032babd803bd9ebc2244de9035d5bf0ff6e11b9cd5c60f90408c75eb`.
- Read-only comparison of all six files found only `agents/orchestrator/system.md` and the manifest version changed; roles, capabilities, selector, executor and verifier prompts remain byte-identical. The successful call cited one fully read supervision-repair document; the other historical case files were supplied but are not proven completely read by that successful publication. This is a provenance limitation, not an excuse to hand-edit or regenerate E1. The immutable candidate directory and all failed calls remain under `.tmp/inspect-factorial-20260924/author-host`; `e1.json` records the exact parent/candidate/attempt identities. The author host exited normally and deleted its copied auth/catalog files.
- Formal controller PID 6252 started at 14:47 UTC with `.tmp/inspect-factorial-20260924/formal-1/matrix.json`. First registered case `hr.candidate_submittal_docs` now has all four isolated hosts and Inspect processes concurrently live: TS, TE, MS and ME. Public read-only snapshots show genuine Mission records in MS/ME and `inspect-ai` Task records in TS/TE. Each arm's Provider audit contains only streamed `gpt-5.6-luna` requests so far. No first-block official score is claimed yet. The five-minute `inspect-luna` heartbeat was updated from its paused prior-trial instruction to monitor only this new controller, remain silent while state is unchanged, preserve errors/null scores, and close its own resources after final analysis.

## First paired block observation (2026-09-24 15:04 UTC)

- `hr.candidate_submittal_docs` has four independent original `.eval` records under `.tmp/inspect-factorial-20260924/formal-1/block-01`. TE alone received an official score: strict `0`, partial `0.625`, native Task `failed`, bound to the frozen E1 digest. TS recorded `OpenCorvusTaskTimeout` after 300 seconds of observed inactivity while its Task was active; that Task later reached `failed` before controller cleanup. TS remains **unscored/null**. MS and ME each recorded `OpenCorvusMissionTimeout` after 300 seconds, last board lane `review`; both remain **unscored/null**. No unavailable value is converted to zero, recovered from business state, or selectively rerun.
- Read-only persisted Mission messages show that both Mission agents stated the business outcome was blocked; neither produced the required `panel_complete_mission` completion fact. The adapter therefore did not seal the world or assign an official score on a child Task terminal or a natural-language final answer. This is a concrete closure/measurement limitation of the current Mission path, not evidence that its official business score was zero or that the durable activity cursor alone caused the timeout. The Task/Mission scheduling and terminal mechanisms would need a separate cross-entry audit before any future runtime change; the current frozen trial is not patched mid-run.
- Controller cleanup used public abort for the two exact owned Missions (HTTP 200) and found zero active owned Tasks afterward. All four block-01 hosts report `stopped`, `credentialCopiesRemoved=true`; Provider audits contain only streamed Luna requests. Raw request counts were TS 65, TE 73, MS 103, ME 84, including each host's preflight. Controller PID 6252 continued unchanged into block 02 with four new isolated hosts; this first block's missing scores are retained in the ten-case denominators and preclude a complete paired effect unless the remaining protocol supports a later fully scored independent experiment.
