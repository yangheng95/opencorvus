# 验收交接设计审查

本文件是待验证设计，不是已实施的生产协议。离线原型只暴露给定关系，
不会成为Task或Mission的结算条件。目标仍是完整业务义务、有效纠错和有依据的进化选择。

以下返工范围审查保留G3时的历史调用图；其输入冲突与活动权限边界已由主记录G4–G10
更新。H-E方法交接本身仍未实施；最新的关系义务证据和输入观察见[input-observation](input-observation.md)。
G12已把下述提案收敛成[单段patch与两次行为观察预登记](method-handoff.md)，
包括真实read-ref交接、旧方法随终态证据保留的影响及尚缺的启动冻结收据。
G13已应用源包`.14`，以下未实施措辞保留最初设计时点；不代表行为改善已证实。

## 真实调用图

| 边界 | 当前生产路径 | 能证明什么 |
| --- | --- | --- |
| 原目标与派单 | `delegated-worker/context.ts`从Task request和选中Slice构建上下文；`delegated-worker/agent.ts`将可见instruction与该上下文送入runner | 原目标与执行指导有独立来源。派单并不是唯一目标来源 |
| 初始与返工输入 | `orchestrator/delegated-worker-tool.ts`调用同一runner；`dispatch-turn-projection.ts`生成可见continuation；`agent/runner.ts`使用已有Session和增量输入 | 返工保留同一Session，前次判断留在历史中；这不等于判断一定锚定，也不等于真实wire上下文已全部抓取 |
| 执行与验证顺序 | `expert-squads/builtin/automationbench/expert-squad.jsonc`中verifier依赖executor；角色指令要求执行结束后验证 | 事后验证是当前明确契约。不能悄悄前置verifier或反转依赖，把图改动称为文案调整 |
| 验收材料 | generic delegated worker返回真实final；`tool/artifact-catalog.ts`保存真实作者发布的不可变namespaced JSON及显式来源读取引用 | 原生publisher验证来源和类型边界，不证明JSON里的业务结论。Artifact保存与final相互替代不了独立推导 |
| 判断和结算 | Task scheduler读取真实报告后作complete/fail决定；Mission读取当前终态和证据后作accept/block或same-Task repair决定 | 当前没有自动执行的另一个`llm_judge`。`AcceptanceSpec.scorers`是给Agent的规范 |
| 进化选择 | feedback revision发布未测候选；Evolution Lab另有Campaign/metric/review/comparison/promotion链 | 本交接实验即使改善，也不能自动晋升一个候选或认定完整优化闭环成立 |

源码路径均相对`packages/opencorvus/src/`，表中单独列出的expert-squads路径相对仓库根。
本次还读取了Cycle3四条真实WorkerTurnDescriptor：两次executor、两次verifier均为原官方API
和Artifact/participant工具投影，均没有bash。Research Studio的计算能力不能直接搬入。

## 两个不同的待验证问题

**H-E：独立预期形成。** Cycle3的验证者实际读到全部价格项，仍把单价当总价。
正确公式由operator提供后，原型能识别差异；作者只提供错误公式和不完整事实集合时，
同一原型仍matched。因此不能把原型、严格字段或来源引用称为业务修复。

**H-R：新前提对旧判断的影响。** 原返工只追size/source缺口，原定价结论未改变。
原型每次计算给定记录，没有消费前次accepted、依赖变化或实际continuation，
所以它没有验证撤销旧判断的能力。两者不能用同一张“13项通过”表代替。

## 可审查的最小交接提案

下一步只考虑既有verifier及Artifact通道，保留执行后验证的现有工作流。
拟改变的对象是**真实产物产生和读取的顺序**，不是再添加一句“独立思考”。
以下是设计输入输出，不是已经注册的新Tool或安装的候选：

| 阶段与语义责任者 | 输入 | 唯一可见输出及消费 |
| --- | --- | --- |
| verifier形成依据 | 原请求、当前Slice、独立读到的权威源；executor提供的定位仅为检索线索 | 用现有artifact_publish记录每项义务、适用条件/排除项、支持该方法的原文坐标、未决前提和推导方法；明确哪些材料已经受producer结论影响。记录发布在比较之前，不能追改它 |
| 同一verifier比较 | 自己刚发布并完整读回的依据、真实操作收据与当前业务观测 | 发布后续review，引用依据的精确locator，列预期/实际/差异/未知；发现先前方法有误则新产物保留原引用、反证和改判理由，不能改第一份或复制它作为已验真结果 |
| scheduler裁决与返工 | 原请求、上述两份真实产物及必要原始来源 | 对具体差异决定同Task纠正；返工报告列新证据改变了哪些前提、哪些旧结论需重审、哪些成功义务仍有依据。现有dispatch/continuation执行动作，Artifact不拥有生命周期状态 |
| Mission复核 | 完整目标、当前Task真实终态与精确证据 | 独立决定接受或提出具体gap；不能将有两份产物或schema通过当接受理由。沿用现有Mission ledger，不复制criterion状态到新平台账本 |

这项提案没有“盲审”保证：真实源可能包含已有结果，scheduler handoff可能已经带入解释，
同一模型也可能独立犯同错。工具和可见消息不隐藏或删改。独立性应由真实读取顺序、
方法与结果的依赖证据衡量，不能靠角色名称、两个Session或自称独立认定。

与现有指令相比，新增可观察对象是比较之前的不可变方法记录及之后明确的修改关系。
它使事后倒推预期可被审查，但**尚无证据证明会减少错误判断**。两个反例仍可穿透该设计：
验证者预先选错方法；所有层共同遗漏适用来源。因此本阶段不把它落成强制发布Tool、Host gate
或新的包版本，也不把离线计算器放到生产链路。

## 可证伪预测与真实验证边界

若之后实施这个唯一数据交接变化，应先预登记原输入/模型/版本/世界/样本数和具体问题，
不用operator公式或隐藏答案辅助模型。真实checker必须同时观察：

1. 方法记录确实在比较前由当前verifier发布，其依据来自真实读取；未生成则交接预测失败。
2. 它是否自行覆盖原义务的必要计算/资格/投递项；先写错误方法也算失败，不能说协议成功。
3. 对实际偏差是否给出正确反证，是否导致真实同Task修复、再复核和正确业务记录；
   只写正确报告而不纠正业务值，不能称纠错成功。
4. 原已成功义务是否保留。直接正常交付只支持正常路径；没有自然发生的差异就没有纠错证明。

本轮不新开世界。未来单个开发诊断也只能检验该路径，不能分离全部随机性、声称总体增益
或等同完整Campaign。只有运行前提出了不同可观察预测，才有理由增加观察。

## 返工范围冲突：需要先横审的独立问题

`dispatch-turn-projection.ts`在Mission acceptance repair输入中要求：
“Recheck only these criteria. Preserve every acceptance not named here”。但
`mission/acceptance-ledger.ts::requireAcceptedTransition`允许旧accepted项在保留原证据并取得
新invalidating evidence后以`stale_evidence`重新打开；Mission core也明确这个动作。
前者把“保持未受影响的成功结果”写成“保持所有未命名的验收”，语义范围过强。

这不是Cycle3金额错误的已证根因：Cycle3没有Mission resume或acceptance repair Turn。
也不能直接换一句提示就宣称修好。全仓仅发现`task-api/index.ts`调用该ledger append函数；
`resumeMissionTask`在调用前和事务内均要求当前Task为准确引用的终态，取消态不恢复；
它在同一事务重新打开Task，再append新epoch的ledger。内部append要求active epoch，
不代表已有面向active repair的公开修改入口。`dispatch-agent-tool.ts`则将repair选择限制在
当前ledger的open criterion。要让worker报告的新反证影响其它accepted项，必须先核对
消息传递、当前Task如何保持真实生命周期以及谁能正式修订范围，不能跳过这些契约。

后续优先审查这个共同边界的正常/失败/取消/重启/串并行/多项目路径，确认区分：
读取并报告新反证、授权纠正动作、修改canonical accepted状态。不得通过伪complete/fail、
第二账本或新增Host语义判断绕开当前责任归属。横审完成前不修改恢复或终态控制。
