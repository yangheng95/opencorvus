# 算法框架层设计反模式审计

> 系列第五份。前四份分别是 [code-smell-report.md](code-smell-report.md)（全仓坏味道）、[code-smell-remediation-plan.md](code-smell-remediation-plan.md)（整改）、[host-design-critique.md](host-design-critique.md)（Host 过度工程）、[state-audit.md](state-audit.md)（状态面）。
> 生成：2026-08-18。
>
> **本文范围与前四份互补，不重叠。** 前四份审的是「宿主机制」——锁、租约、状态机、闸门、依赖方向。本文审的是**做判断的代码**：打分、匹配、排序、收敛、预算、统计推断、验收判定。这一层此前没有被单独审过。
>
> **判定口径（四问）**：对每个产生数值或布尔判断的函数问——**①这个常数是从哪里标定出来的？②这个判断被什么真值集合验证过？③判断错了会以什么形式被观察到？④它的失败方向（fail-open / fail-closed）是不是它承担的风险方向？** 四问全无答案的判定逻辑记为反模式。

## 总判

算法层的问题**不是算法写错了，而是判定逻辑没有被当成算法对待**：它们被当成业务代码写——手工调参、随手加分支、靠个案测试锁行为——但它们承担的是排序、验收、晋升、预算这类**只有在统计意义上才有对错**的职责。

三条主线：

1. **未标定常数当判据**。全层的关键阈值——发现分 0.22、SSIM 0.95、语义轮次 3、token = 字符数/4、记忆种类权重 1.45/1.25/1.1/0.95/0.8——没有一条附带标定过程或验证集。测试是为拟合常数而写的个案，不是常数的来源。
2. **算出了统计量却不用它做判断**。进化对照实验完整计算了配对差值的方差与 95% 置信区间，然后用**点估计的正负号**做晋升决定；`confidence` 字段由样本量而非它刚算出的方差推导。
3. **失败方向与风险方向相反**。重试分类器默认可重试（fail-open），而全仓 4535 处确定性 `throw` 中只有 **8 处**显式登记为不可重试——安全分类是那个需要在每个点上额外做功的分类。决策链上的门则相反，全是 fail-closed 且乘法叠加。

一个具体后果的组合：编排器一次唤醒最多 3 次语义尝试（`semanticTurnLimit: 3`），而它必须穿过的工具面上有 90 处 `throw`（`orchestrator/tools.ts` 单文件）。宿主对模型失败的唯一干预手段是**追加一段英文说教**——`toolChoice` 的 `"required"` 与 `{type:"tool"}` 变体已经从 `session/llm.ts` 一路接到 provider，生产代码里一次都没用过。

## 优先级建议

- **P0**：ALG-01（重试分类 fail-open 只有 8 处豁免）、ALG-02（决策修复只有自然语言这一个杠杆）、ALG-03（进化晋升规则里权重是装饰品）。三条都直接决定「任务能不能推进 / 进化能不能收敛」。
- **P1**：ALG-04（token 估算）、ALG-05（记忆排序种类双计）、ALG-06（发现分未标定）。
- **P2**：ALG-07 ~ ALG-12。

---

## P0

### ALG-01 重试分类器 fail-open，而豁免是逐点 opt-in：4535 处 throw 里只有 8 处受保护 ✅

- **位置**：[llm/activity.ts:269](../packages/opencorvus/src/llm/activity.ts)（`classify` 末行 `return "unknown"`）、:345（`isRetryable`，`unknown` 不在拒绝表里）、:381（`maxRetries: { default: 5 }`）；[llm/host-fault.ts](../packages/opencorvus/src/llm/host-fault.ts)（`isHostProcessingFault` 要求显式 `HostProcessingFaultError` 或 `SQLITE_CONSTRAINT` 码）。
- **事实**：`rg "throw new " packages/opencorvus/src -g "*.ts" -g "!*.test.ts"` = **4535 处**。`HostProcessingFaultError` 的构造点 = **8 处，全部在 [session/index.ts:1707-1893](../packages/opencorvus/src/session/index.ts) 一个文件里**，且注释自陈是 2026-08-16 那次事故后补的。
- **四问**：③判断错了怎么观察到——观察不到，一个确定性不变量错误会被静默重试 5 次（退避基数 2s、上限 30s），只在日志里表现为同一个错误连出 5 遍。④失败方向——反的。分类器对**未识别的**错误默认「可重试」，可是未识别的错误里绝大多数是宿主自己的不变量，而 provider 侧的真实瞬时错误（5xx、429、ECONNRESET、TLS）**全部有显式分支**。默认分支实际承接的只有宿主错误。
- **补充反模式**：`classify` 对 4xx body 和 message 做正则匹配（`/context.{0,12}overflow|maximum context|too many tokens|prompt is too long|.../i`）来判定 `context_overflow`。这是**拿供应商自撰的、可本地化的、随时会变的文案当控制流**——[host-design-critique.md](host-design-critique.md) 第三节点名过一次，`host_fault` 分支落地了，正则表仍在。
- **删除方向**：反转默认。`unknown` 归为不可重试，可重试性由**显式的 provider 传输类**（HTTP 状态、传输错误码、abort cause 标记）授予；正则匹配的两条（`context_overflow`、`stream_protocol`）降级为诊断标签，不参与重试决策。这样 4535 处 `throw` 不需要逐个改写就自动获得正确语义，8 处显式包装可以删掉。

### ALG-02 决策修复的唯一杠杆是一段英文；结构化约束已接通但从未启用 ✅

- **位置**：[session/loop.ts:177](../packages/opencorvus/src/session/loop.ts)（`taskRootDecisionRepairPrompt`）、:1576-1587（把它 push 进 `system`）、:1858（`toolChoice: undefined`）；[engine/task-root-fact-store.ts:71](../packages/opencorvus/src/engine/task-root-fact-store.ts)（`semanticTurnLimit: 3, activationLimit: 4`）；[engine/task-root-ingress-reducer.ts:422](../packages/opencorvus/src/engine/task-root-ingress-reducer.ts)（`exhausted / semantic_limit`）。
- **事实**：编排器一步结束却没产出合法 decision receipt 时，宿主的全部动作是在 system 尾部追加一个 `<task-root-decision-repair>` 段落，说明「这是第 N 次 / 共 3 次」。采样参数不变，工具面不变，模型不变。第 2、3 次尝试与第 1 次是同一分布的重抽样，只多了自己上一步的失败记录。3 次之后 ingress 转 `exhausted`。
- **`toolChoice` 的现状**：`rg toolChoice` 在非 provider、非测试代码里只有三个结果——[session/llm.ts:61](../packages/opencorvus/src/session/llm.ts) 的类型声明（含 `"required"` 与 `{ type: "tool"; toolName: string }`）、[session/loop.ts:1858](../packages/opencorvus/src/session/loop.ts) 的 `undefined`、[memory/project-memory-organizer.ts:295](../packages/opencorvus/src/memory/project-memory-organizer.ts) 的 `"none"`。**约束模型必须落在决策工具集上的机制已经完整接到 provider 层，生产路径一次都没调用过。**
- **四问**：①`3` 从哪来——无出处。②验证——这条路径没有决策级测试。③错了怎么观察——表现为「任务卡住不动」，与模型能力不足不可区分。
- **删除方向**：修复阶梯改成机制升级而非文案升级。第 1 次失败 → `toolChoice: "required"`；第 2 次 → 把工具面裁到 `ORCHESTRATOR_DECISION_TOOL_NAMES` 并 pin 到该集合。文案块随之删除。若三级机制约束仍拿不到 receipt，那才是真的 `exhausted`，而且此时这个结论有信息量。

### ALG-03 进化晋升规则：算出置信区间不用，权重完全不影响结果 ✅

- **位置**：[comparison.ts:168-188](../expert-squads/builtin/evolution-lab/lib/evolution-lab/comparison.ts)（配对差值统计）、:216-231（`directionalMeans` / `aggregateScore` / `regressions`）、:237（`confidence`）、:273-282（`recommendation`）。
- **规则原文**：`aggregateScore > 0 && regressions.length === 0 && outcomeRates.candidate.failure <= outcomeRates.baseline.failure → "promote"`。
- **三个独立缺陷**：
  1. **权重是装饰品**。`regressions` = `directionalMeans` 中 `value < 0` 的项；要求 `regressions.length === 0` 就是要求**每个 scorer 的定向均值 ≥ 0**（Pareto 支配）。在全部分量 ≥ 0 且权重为正的前提下，加权平均 `aggregateScore > 0` 唯一能否决的情形是「全部分量恰为 0」。也就是说 **campaign 里声明、校验、并写进产物的 `scorer.weight`，除了 0/非 0 这个二值之外，对晋升决定没有任何影响**。相对权重可以任意改写而结果不变。
  2. **置信区间算了不用**。:172-179 算出 `standardError` 与 95% CI（`lower`/`upper`）并写进产物，晋升判据只看 `mean` 的符号。在 `repetitions` 通常是个位数的情况下，这等于**在噪声上做晋升决定**。而 :237 的 `confidence` 由 `pairedCount >= 5 ? "high" : "medium"` 推导——用样本量给出的标签，与它手上刚算出的方差完全脱钩。
  3. **CI 本身系统性偏窄**。:170 `variance(deltas, average)` 除以 `n`（总体方差），:172 `sqrt(populationVariance / deltas.length)` 当标准误，:176 用 `1.96` 正态分位数。样本量 2~5 时应当用样本方差（n−1）与 t 分位数；当前写法在小样本上同时低估 SE 又高估分位精度。产物是要给人做晋升复核的证据，这个偏差会被读者当成真的。
- **叠加效应**：`requiredUnavailable.size > 0 || visualReview.status === "unavailable" || rewardHackingReview.findings.length > 0 → "inconclusive"`。这三个否决项与 ALG-08 的 SSIM 0.95 串联，构成 memory 里记过的「验收耦合 + fail-closed 门乘法结构」。晋升需要**同时**：每个 scorer 不退步、失败率不上升、每个 slot 的每个 scorer 都 measured、每个视觉 region SSIM > 0.95、无 reward hacking 发现。scorer 数量一多，「至少一个分量因噪声为负」的概率趋近 1。
- **修正方向**：晋升判据改用它已经算出的区间——`lower > 0`（或对退步用 `upper < 0` 判定真退步），`confidence` 由区间宽度推导；`regressions` 用「CI 上界 < 0」而不是「均值 < 0」，噪声不再阻断；总体方差改样本方差，正态分位改 t 分位。要么让权重真正参与（去掉硬 Pareto 约束，改为加权净收益 + 单项退步的 CI 判据），要么删掉权重字段——不要发布一个不影响结果的参数。

---

## P1

### ALG-04 token 预算建立在「JSON 序列化字符数 ÷ 4」之上，且它把关一条 fail-closed 出口 ✅

- **位置**：[util/token.ts:2](../packages/opencorvus/src/util/token.ts)（`CHARS_PER_TOKEN = 4`）；[session/compaction.ts:517](../packages/opencorvus/src/session/compaction.ts)、:550（`Token.estimate(JSON.stringify(...))`）；[session/loop.ts:681-707](../packages/opencorvus/src/session/loop.ts)（`predictiveCompactionDecision`）。
- **事实**：全部上下文预算判断——预测性压缩触发、尾部保留轮次选择、`fail-tool-schema`、`fail-prompt-budget`——都来自同一个标量：`JSON.stringify(messages).length / 4`。
- **四问**：①`4` 是英文 ASCII 的经验值。本项目的主要使用语言是中文；CJK 在主流 BPE 下大致 1~1.5 字符/token，`/4` 在中文内容上**系统性低估 3~6 倍**。同时 `JSON.stringify` 把引号、转义、键名一起计入，在小消息上又高估。两个方向的偏差都不受控。②`predictiveCompactionDecision` 被文档明确标注为 "Pure decision"、有完整的四步注释、是为修一次死循环而写的——`rg predictiveCompactionDecision packages/opencorvus/test` **零结果**。③错了怎么观察——低估时表现为 provider 端 context overflow（尚可恢复），高估时表现为 `fail-prompt-budget` 直接终结这一轮，且这条路径不可恢复。
- **修正方向**：估算器改为按脚本分段（ASCII / CJK / base64 走不同系数），并且只对**内容**估算而非序列化结果；`fail-prompt-budget` 这类不可恢复出口改由 provider 的真实 usage 回执驱动，估算值只用于「提前触发压缩」这类可恢复决定。给 `predictiveCompactionDecision` 补决策表测试。

### ALG-05 记忆排序把种类权重计了两次，第二次直接压过分数 ✅

- **位置**：[memory/search.ts:13-21](../packages/opencorvus/src/memory/search.ts)（`KIND_WEIGHT`）、:117（`score *= KIND_WEIGHT[row.kind]`）、:149-153（`compareResults`）。
- **事实**：`score` 里已经乘过 `KIND_WEIGHT`；`compareResults` 的**第一判据**又是 `KIND_WEIGHT[b.kind] - KIND_WEIGHT[a.kind]`，只有同种类才比较分数。结果是**跨种类时相关性分数完全不起作用**——一条 BM25 极低的 `profile` 永远排在一条命中极准的 `fact` 前面。[memory/index.ts:566-583](../packages/opencorvus/src/memory/index.ts) 的 `recall()` 恰好在一次调用里混合 `profile/lesson/fact/note` 四种，是这个路径的主要使用者。
- **同处第二个缺陷**：`user_message: 0` 与 `project_context: 0`。默认 `kindFilter` 只排除 `user_message`（:63），所以 `project_context` 行**能通过 SQL 过滤、占用 200 条候选名额、然后被 `score *= 0` 清零并被 `score < minScore` 丢弃**——索引了但永远搜不出来，且挤占候选预算。显式传 `kinds: ["project_context"]` 的调用者恒定得到空数组。[code-smell-report.md:37](code-smell-report.md) 点过这个笑点，当前 HEAD 仍在。
- **四问**：①1.45/1.25/1.1/0.95/0.8、`0.8 + importance/200`、`0.85 + confidence/250`、半衰期 30 天、`1/(1+exp(-(rank-1)*1.5))`——全部无出处。②`rg MemorySearch packages/opencorvus/test` 零结果。
- **修正方向**：`compareResults` 删掉种类主键，只按 score 再按时间；种类影响只保留乘法那一处。`project_context` 要么给非零权重并进默认过滤白名单，要么和 `user_message` 一样从默认查询里排除，别让它占候选名额。

### ALG-06 能力发现分：15 个手调常数 + 内嵌中文停用词表，10 条个案断言当验证 ◐

- **位置**：[capability/fuzzy.ts](../packages/opencorvus/src/capability/fuzzy.ts) 全文。常数清单：`MINIMUM_DISCOVERY_SCORE = 0.22`、`SEPARATORLESS_RUN_SCORES = [0,0,0.15,0.46,0.72,0.86,0.94]`、`SEPARATORLESS_MINIMUM_PAIR_COVERAGE = 0.25`、`coverage * 1.6`、`* 0.85`、`TOKEN_STEM_MINIMUM = 5`、`token.length >= 4 → 0.8`、`shared >= min-3 → 0.7`、`DOCUMENT_TOKEN_DAMPING = 0.75`、`includes → 0.98`、`0.82 + min(0.12, coverage*0.12)`、`tokenCoverage * 0.9`、`dice * 0.88`。
- **反模式本体**：`scoreField` 的最终形态是 `Math.max(fuzzysort分, token覆盖分*0.9, Dice系数*0.88, 无分隔符脚本分)`——**对四个量纲不同、值域分布不同的打分器取最大值**，再用一个全局阈值 0.22 截断。取 max 意味着任何一个打分器的假阳性都能单独把候选推过阈值，四个打分器的假阳性率直接相加。
- **停用词表硬编码在算法里**：`SEPARATORLESS_FILLER` 正则内联了约 70 个中文虚词与全部平假名。这是**语言资源写进了打分函数**，改词表要改算法文件，且没有任何机制保证它对新增语言（韩语已在 `SEPARATORLESS_SCRIPT` 里，却没有对应的 filler 表）成立。
- **验证现状**：[test/capability/fuzzy.test.ts](../packages/opencorvus/test/capability/fuzzy.test.ts) 56 行、10 条 `expect`，全部是手写个案，断言形如 `toBeGreaterThan(0.22)` / `toBeGreaterThan(0.4)`——**断言是照着常数写的，不是常数的来源**。没有排序数据集，没有 P@k / MRR，没有回归基线。
- **风险方向**：这条打分链决定编排器**能不能发现某个专家团**。排序退化是静默的——与 [host-design-critique.md](host-design-critique.md) 事故 #7（能力表漏登记导致静默失能）同一故障类别，只是从「手工表漏行」换成了「打分器排序漂移」。
- **另有隐性全局**：`separatorlessRunCacheQuery` / `separatorlessRunCache` 是模块级可变单例（原则 6）。功能上无误（同一 query 扫多个候选时命中），但它使这个纯函数模块携带进程状态，交替 query 时静默退化为全量重算。
- **修正方向**：先建排序验证集（真实请求 → 期望包）并落地 P@k 基线，再谈调参；四路取 max 换成显式的证据合并（先按证据类型分级，同级内才比较分数）；停用词表移出算法文件成为数据；缓存显式传入或删除。

---

## P2

### ALG-07 编排器工具面：单文件 90 处 `throw`，全是散文式 `Error`，无 expected/received ◐

- **位置**：[orchestrator/tools.ts](../packages/opencorvus/src/orchestrator/tools.ts)（90 处 `throw`，其中 39 处 `throw new Error(...)` 模板串）。决策路径合计：`task-root-ingress-delivery.ts` 38、`task-root-fact-store.ts` 43、`orchestrator/agent.ts` 30、`dispatch-agent-tool.ts` 32、`session/loop.ts` 62 —— **7 个文件 264 处**。
- **问题**：这些几乎全是宿主不变量（"Continuation Session … has no persisted Task authority descriptor"），却抛裸 `Error`。经 ALG-01 的链路它们被分类为 `unknown` → 可重试 → 最多 5 次。同时它们不带 `expected` / `received`（memory 里 `model-facing-errors-need-expected-value` 记过：模型面报错不写期望值会导致编排器无限重试）。
- **修正**：先落地 ALG-01 的默认反转（一次性覆盖全部 264 处），再逐类判定哪些应当是模型可见的输入校验（补 expected/received）、哪些是纯宿主 fault（不进模型上下文）。

### ALG-08 视觉验收：全局 SSIM > 0.95 一刀切 ⬜

- **位置**：[verification/visual/evaluate.ts:51](../packages/opencorvus/src/verification/visual/evaluate.ts)（`WEBPAGE_REFERENCE_COMPARISON_SSIM_PASS_THRESHOLD = 0.95`）、:53（`report.ssimScore > threshold`）；消费方 [browser-preview/region-comparison.ts:496](../packages/opencorvus/src/browser-preview/region-comparison.ts)、[browser-preview/scroll-slice-comparison.ts:199](../packages/opencorvus/src/browser-preview/scroll-slice-comparison.ts)。
- **问题**：SSIM 0.95 在真实网页截图上接近像素级同一。字体渲染差异、抗锯齿、1px 布局位移都会击穿它，而这些与「实现是否忠实于设计稿」无关。同一个常数同时服务于「大块图像区域」和「密集文本表格区域」，二者的 SSIM 分布完全不同。`overallScore` 被明确降级为 "diagnostic only"——即**唯一参与判定的是这个未标定的单一标量**。
- **叠加**：该判定通过 ALG-03 的 `visualReview.status === "unavailable" → inconclusive` 直接否决进化晋升。
- **修正**：阈值按 region 类型（图像 / 文本 / 混合）标定并可在 campaign 中声明；或改为「相对基线的 SSIM 差值」而非绝对值——后者天然消掉渲染环境常量偏置。

### ALG-09 空白检测假设背景是白色 ✅

- **位置**：[util/pixel-stats.ts:35-63](../packages/opencorvus/src/util/pixel-stats.ts)（`nonWhiteDensity`：`max(r,g,b) < 250` 即记为有内容）；判据在 [acceptance/visual-feedback-verification.ts:367-375](../packages/opencorvus/src/acceptance/visual-feedback-verification.ts)（`source >= 0.002 && implementation <= 0.0001` → 判空白；`source unique_color >= 3 && implementation <= 1` → 判单色空白）。
- **问题**：深色主题页面的 `nonWhiteDensity` 恒等于 1.0，该指标对深色 UI **不携带任何信息**——一个全黑的失败截图与一个正常的深色页面得到相同的度量。0.002 / 0.0001 / 3 / 1 四个常数同样无出处。本仓库自己的产物是 theme-aware 的，这个假设与产品事实冲突。
- **修正**：改为「与该 crop 众数背景色的距离」而非「与白色的距离」；四个常数按主题分别标定或改为相对基线的比值。

### ALG-10 算法层生产代码里 99 处测试钩子 ◐

- **事实**：`rg "TestHooks|ForTest\b"` 在 `session/ orchestrator/ engine/ scheduler/ capability/ llm/ agent/` 的非测试文件中 = **99 处 / 18 个文件**。典型：[scheduler/execution-inactivity.ts:16](../packages/opencorvus/src/scheduler/execution-inactivity.ts) 的模块级 `let timeoutForTest`（超时判据的实际来源）、[orchestrator/tools.ts:189-197](../packages/opencorvus/src/orchestrator/tools.ts) 的 `WeakMap` lineage 钩子（同时命中 host-design-critique 事故 #6 的侧带状态类别）。
- **问题**：违反原则 8。判定逻辑的输入（超时、时钟、lineage）由全局可变量提供，意味着这些算法**无法在不改全局状态的前提下被参数化验证**——这正是 ALG-04/05/06 都缺验证集的结构性原因。
- **修正**：判定所需的时钟、超时、策略作为显式入参下沉到纯函数；测试通过传参而非改全局。

### ALG-11 `confidence` / `regressions` / `unavailable` 三套词表语义重叠 ⬜

- **位置**：[comparison.ts:229-240](../expert-squads/builtin/evolution-lab/lib/evolution-lab/comparison.ts)。`unavailable` 与 `required_unavailable` 两个集合、`regressions` 一个集合、`confidence` 三值枚举，四者对「这次实验能不能下结论」各表达了一部分，判定时又只用其中两个。产物读者需要同时理解四个字段才能复现一个布尔结论。
- **修正**：把「能不能下结论」收敛成单一派生谓词，其余字段降级为诊断明细。

### ALG-12 `test/algorithm-*.test.ts` 名不副实 ◐

- **位置**：[test/algorithm-batch-one.test.ts](../packages/opencorvus/test/algorithm-batch-one.test.ts)（实际内容是 worktree 所有权、git lock、session 取消作用域）、[test/algorithm-repair-contracts.test.ts](../packages/opencorvus/test/algorithm-repair-contracts.test.ts)（实际内容是 URL 规范化与压缩投影）。
- **问题**："algorithm" 在这里是批次编号而非领域名，`batch-one` 更是纯序号。本文点名的判定逻辑（打分、晋升、预算）**一条都不在这两个文件里**，而名字会让人以为已覆盖。
- **修正**：按被测判定重命名（`capability-ranking`、`evolution-promotion-rule`、`context-budget-decision`），或直接并入对应模块的测试文件。

---

---

## 落地记录（2026-08-18）

> 标记：✅ 已修并有测试锁定 · ◐ 部分修（下方各条注明剩余部分与不修的理由）· ⬜ 未动。
> 全部改动均按「先改判据、再补锁定该判据的测试」推进；不具备验证集的常数一律不动——在没有真值的情况下调参，正是本文点名的反模式。

| 编号 | 状态 | 落地内容 |
| --- | --- | --- |
| ALG-01 | ✅ | `isRetryable` 由拒绝表改为**授予表** `RETRYABLE_CLASSES`，`unknown` 不在其中。新增 ErrorClass 默认不可重试。测试反转为「未识别错误首次尝试即终结」+「可识别传输错误仍重试」双向锁定。 |
| ALG-02 | ✅ | 新增 `taskRootDecisionRepairRung`：gap≥1 → `toolChoice: "required"`；gap≥2 → 同时把工具面裁到 `ORCHESTRATOR_DECISION_TOOL_NAMES`（决策工具不存在时降级保留弱档并告警）。`toolChoice` 首次真正接到生产路径。 |
| ALG-03 | ✅ | 总体方差→样本方差；1.96 正态分位→按自由度查 t 分位表；晋升判据由 `mean > 0` 改为 `aggregate_interval.lower > 0`；退步判据由「均值<0」改为「整段区间<0」；`confidence` 由样本量改为区间宽度推导。新增 `aggregate_interval` 字段并写进 schema。**权重从此真正影响结论**——新增测试用同一组测量数据、只改权重，得到 promote / retain 两种结果。 |
| ALG-04 | ✅ | `Token.estimate` 改为按字型分段（CJK 1.5 字符/token，其余 4），预算比较全部改走 token 而非字符；`COMPACTION_MIN_RESIDUE_CHARS` 改为 `COMPACTION_MIN_RESIDUE_TOKENS`。`predictiveCompactionDecision` 从零测试补到完整决策表，含一条「中文负载在旧口径下会被跳过、新口径下正确触发压缩」的回归。 |
| ALG-05 | ✅ | `compareResults` 删掉种类主键；`user_message`/`project_context` 从 `KIND_WEIGHT` 整体移除并在 SQL 过滤中显式排除，显式请求这两类改为带 expected/received 的抛错（且在空项目短路**之前**校验）。 |
| ALG-06 | ◐ | 已删模块级可变缓存（runs 改为每次打分调用算一次并向下传递），停用词表移入 `capability/discovery-filler.ts` 成为数据。新增「交错查询结果必须与孤立查询一致」的纯度测试。**15 个常数一个未动**——没有排序验证集之前调它们只是换一组没有依据的数字。 |
| ALG-07 | ◐ | ALG-01 的默认反转已一次性覆盖这 264 处（不再被误判为可重试）。逐处补 `expected`/`received` 与「哪些该是 HostFault」的分类未做。 |
| ALG-08 | ⬜ | 未动。把 SSIM 0.95 改成可按 region 类型声明需要标定数据；在没有数据的情况下发明一组新阈值与现状同质。 |
| ALG-09 | ✅ | `nonWhiteDensity` → `contentPixelRatio`：背景取该裁图自身的众数色，偏离超过容差才算内容。深色页面从恒等于 1.0（无信息）变为与浅色同一含义。产出字段随之改名 `content_pixel_ratio`。 |
| ALG-10 | ◐ | 点名的 `scheduler/execution-inactivity.ts` 模块级 `let timeoutForTest` 与 `SchedulerExecutionInactivityTestHooks` **零调用点**，整体删除（测试本就通过 config 注入）。其余 98 处未扫。 |
| ALG-11 | ⬜ | 未动。属于表达收敛，收益低于风险。 |
| ALG-12 | ◐ | 本轮新增的测试按被测判据命名（`context-budget-decision`、`task-root-decision-repair`、`pixel-content-ratio`）。既有两个 `algorithm-*.test.ts` 未改名。 |

### 验证结果（全量 290 个测试文件）

| 口径 | 结果 |
| --- | --- |
| 带全部改动逐文件扫描 | **265 通过 / 25 失败**（runner 遇首个失败即 `break`，故改为逐文件扫描，不中断） |
| 把 22 个改动文件全部还原到 HEAD，重跑这 25 个 | **23 个在 HEAD 上同样失败** → 与本轮改动无关 |
| HEAD 上通过、带改动失败 | **仅 2 个**，见下 |

两次还原与恢复均以 md5 校验 + diff 逐字节比对确认改动完整（`BYTE-IDENTICAL TO ORIGINAL`）。

- `expert-squad-evolution-mutation.test.ts` —— **真回归，已修**。ALG-03 让晋升需要置信区间后，该夹具的 1 case × 1 repetition 不再足以晋升。修法是把夹具补到每臂 2 次重复（并同步 evidence 计数、completeness、slot 矩阵断言），**不是放宽判据**。
- `execution-capsule-systemd-lifecycle.test.ts` —— 扫描期压力下的 flake；该用例在 Windows 上本就 skip，单跑通过，HEAD 也通过。

另有 `evolution-artifact-evidence-host.test.ts`：它在 HEAD 上也失败（故整体不计为本轮回归），但其 8 个用例中有 2 个确实因本轮改动而红并已修复——三处 ABI 夹具补 `aggregate_interval`、两处版本 pin 随包版本升级更新，该文件由 5/8 修到 7/8。剩下 1 个是工作树中他人在途改动删除了 `publish-evolution-artifact.ts` 的两处 `EvolutionArtifactIntegrityError` 所致。

23 个既有失败的成因分布（均非本轮引入）：7 个报 `Artifact provenance requires persisted Tool Part …`（与工作树中在改的 `work-artifact/packaged-acceptance.ts` 同一区域）、1 个 `Export named 'listInterruptedSessionEvidence' not found`（在途重构缺导出）、1 个 SQL 语法错误、其余为 worktree 准入与 git index 相关的既有病（本机 `.git/index.lock` 陈旧）。

### 修复过程中新发现的两条

1. **`bm25RankToScore` 的 sigmoid 饱和得太快，相关性几乎不参与区分**。`1/(1+exp(-(|rank|-1)*1.5))` 在正常匹配区间已贴近 1，于是跨种类排序实际仍由 `KIND_WEIGHT` 主导——只是现在通过分数而非排序主键。ALG-05 修掉的是「分数被排序键彻底架空」，这一条是分数本身分辨率不足，属于**需要验证集才能动**的同一类，记在这里不改。
2. **进化对照的既有测试夹具本身就是 1 case × 1 repetition，而它在旧规则下断言 `promote`**。也就是说「一个样本就能晋升」不仅在代码里可能，在测试里是被当作期望行为固化的。新规则下同一夹具产出 `retain` / `confidence: low`，夹具已重写为可参数化，并补了足量重复数下的 promote 路径。

## 复查：前四份审计在算法层的残留

| 前文结论 | 本文的补充 |
| --- | --- |
| host-design-critique 事故 #5「错误分类当控制流」 | 已修的是 `host_fault` 一个分支。**默认仍是 fail-open，豁免仍是 opt-in，覆盖率 8/4535**（ALG-01） |
| host-design-critique 事故 #7「手工能力表静默失能」 | 手工表换成了打分器，故障类别不变：**排序漂移同样静默**，且无排序基线（ALG-06） |
| host-design-critique 事故 #6「WeakMap 侧带状态」 | 算法层仍有 99 处测试钩子/全局可变量参与判定输入（ALG-10） |
| state-audit「每引入一个状态必须交付离开它的普通动作」 | `exhausted / semantic_limit` 的出口是「再发一条消息」，但**宿主在耗尽前没有升级过任何机制**，3 次是同分布重抽样（ALG-02） |
| memory：进化 E2E 25 次全败源于「验收耦合 + fail-closed 门乘法结构」 | 定位到具体乘法项：Pareto 硬约束 + SSIM 0.95 + 三条 inconclusive 否决（ALG-03 / ALG-08） |
| code-smell-report:37「memory 某类权重设成 0 导致索引了搜不到」 | 当前 HEAD 仍在，且**同一函数还把种类权重计了第二次并压过分数**（ALG-05） |
| framework-architecture-design 原则 7「让非法状态不可表示」 | 算法层的对应缺口不是类型，是**判据没有验证集**——ALG-03/04/05/06 四条的共同根因 |

## 本文没有发现问题的地方

为免误读为「全层都烂」，以下判定逻辑复查后认为设计正确，不需要动：

- [orchestrator/loop.ts](../packages/opencorvus/src/orchestrator/loop.ts)：单趟决策、无内部循环、无水位线，注释里记录了三个被删掉的 FSM 伪装唤醒。这是本层最干净的一处。
- [scheduler/recurrence.ts](../packages/opencorvus/src/scheduler/recurrence.ts)：用 rrule + luxon，显式处理 TZID 与宿主时区的漂移，`MAX_STALE_OCCURRENCES` 有明确的推进语义。
- [session/context-budget.ts](../packages/opencorvus/src/session/context-budget.ts)：常数集中、全部可配置覆盖、语义单一。问题在喂给它的估算值（ALG-04），不在它本身。
- [capability/harness-projection.ts](../packages/opencorvus/src/capability/harness-projection.ts)：内容寻址 + 去重 + 冻结，是「一个概念一处实现」的正面例子。
