# 监督与自进化的无人值守因果迭代

## Recall

- 用户在停止 Sol 大矩阵并要求整夜复盘后，要求“如何拨乱反正，从哲学上不再出现逻辑错误？”，认可讨论的工作背景后明确下令“开始无人值守迭代”。本轮授权自主调查、范围内修复、聚焦真实验证与定时继续；不是恢复已停止的任一 formal 控制器，也不是要求不断制造候选或四十例。
- 目标仍是原始业务义务被可靠完成，监督实际发现并纠正缺口，自进化只在有证据时提出并验证改进。目的、原始事实、因果假设和验收分开；合法发布、角色数、已读字节、状态收敛与实际效果互不替代。不把没有查到当不存在，不把官方分数争议全归模型能力。
- 用户在Cycle 2运行中最新要求“改回luna测试”。自该指令起，新的必要真实运行使用流式 `openai/gpt-5.6-luna`，包括所有内部角色、压缩与预检；既有Sol记录保留其原模型，不改写历史。此前Sol偏好已被本次明确选择替代。不重启已停止的任一formal或probe，不刷新复制凭据，不自设用户请求预算。真实费用按所有请求和用量记录，不把本地计价0解释为免费。已有成对 auth/models 使用授权限于隔离验证；不触碰真实业务帐号、用户进程或其他实验。
- 官方案例、输入、时钟、世界、评分器及全部历史消息/Tool/分数/候选只读。机制复现可在预登记的全新世界执行同一历史案例，必须独立标记为开发诊断、保留所有失败，不补写正式矩阵、不选最好一次、不改原分。新诊断不向模型提供隐藏断言、答案、初始世界私有标识或 operator 的可达性查询。
- 使用已读取的 `benchmark-debug-template`，但具体停机、范围和证据要求以用户最新指令为准。无子 agent 委托。已读根 AGENTS、[整夜记录及停止复盘](2026-09-24-luna-mission-task-factorial-trials.md)、[自进化 Tool 修复](2026-09-24-expert-squad-evolution-algorithm.md)、[监督数据流修复](2026-09-24-supervision-acceptance-repair.md)、当前 Task control-plane 架构、三角色定义和 `.13` manifest、Task lifecycle schema/Tool、原始播客/逾期费 `.eval` 与播客终态 Tool 收据。全仓搜索覆盖 `complete_task`/`fail_task`、原请求/证据投影、反馈编辑 provenance、既有真实检查运行脚本和四臂控制器。

## 决策方法与完成边界

1. 每轮先写明一个可观察错误、触发条件、责任层、竞争解释、已有反例和未知。代码/指令当前没有该缺陷的证据时，先观察当前路径，不凭旧版本失败直接改当前代码。
2. 实验前登记输入、版本、模型、隔离目录、样本数和能区分解释的预测。机制验证和完整效果评估分开；已通过另一案例不能替代原机制预测。正式评分与逐项业务证据并列，歧义不改分也不冒称修好了模型。
3. 修改必须针对已定位的数据/控制/指令缺陷，复用单一事实来源。Host 只验证身份、完整性、权限与终态一致性，不用关键词、业务 gate 或自动路由替模型判断。若触及调度/恢复/终态，先横审 Task/Mission/Session 正常、失败、取消、重启、串并行及多项目路径。
4. 每个已实施修复先做聚焦正向合同，再在预登记真实路径验证预测。预测失败则修改解释或停止该分支；不得继续同义提醒、换案例追分、重试取优或叠新角色。如果证据只支持局部改善就限定主张。模型能力仍未被区分时如实标未知，不自动扩模型或预算。
5. 有充分机制证据、回归风险与实验可达性解释后才决定是否扩大测量。默认不自动开四十例。只有明确可交付改进且相关行为/回归通过时才称完成；若当前路径经证伪后无支持的修复，暂停该路径并通知精确阻塞，而非制造下一版本。
6. 长运行由同一线程五分钟 heartbeat 读取持久化快照。无变化安静，进展/失败/完成/需用户选择时通知。每次继续先读本 Recall、最新 checkpoint 和实际 PID/Task，禁止重复启动。任务收尾后正常停自有服务并核对成对凭据删除。

## 证据账本：当前决定

| ID | 事实与范围 | 解释/未知 | 本轮处置 |
| --- | --- | --- | --- |
| E1 | 旧作者证据2000字符截断、重写声明假阳性；精确编辑与完整 Artifact 读取已实现并验真 | 可读不代表理解，不代表候选收益 | 保留已证实的数据完整性修复，不重写候选；需要创作时才检验作者因果范围 |
| E2 | 旧 failed Task 原始消息未开放给 Mission，当前共享 reader/Panel 与紧凑因果索引已实现 | 当前使用和语义判断仍依赖真实轨迹 | 先检查实际读取；不给 Host 新的业务裁决权 |
| E3 | 旧播客 `.6` 原请求含两封邮件；双方报告未发；调度器真实 complete_task | 决策时已知缺口，不能解释为通知未到；当前 `.13` 是否仍犯错未知 | 首个可达且要求明确的机制复现 |
| E4 | 旧逾期费豁免空白被写0，官方 preservation 断言失败 | 原业务政策写 waive/no fee，未逐字要求保持空格；实际改写确定，业务含义需单独审定 | 不把该官方断言直接当首个无歧义修复目标，不修改官方原分 |
| E5 | Mission blocked、Git初始化、cleanup outcome、Question停机已有代码/合同和部分真实证据 | 正常失败结算不证明业务不可完成或监督有效 | 保留修复，真实运行只作为基础条件，异常横审 |
| E6 | 多角色共同漏来源/公式；formal-6、formal-7 无稳定进化收益 | 新提示是否导致回退、模型能力贡献未分离 | 不开新作者，不把 pending acceptance 候选当更优父代 |
| E7 | Asana项目公开发现缺口、4007人数推定争议已有接口/政策证据 | 这些案例不适于无条件判模型弱 | 从机制归因中排除争议解释，原分完整保留 |

当前源码的 orchestrator-core、delegated-worker-core、CompleteTaskInputSchema 和 `.13` 专家团都已有原请求优先、逐项义务、实际写入/结果分离、已知缺口同 Task 返工的指令。没有发现新的语义冲突足以支持再追加同义提醒。首轮不改生产代码/角色定义。

## Cycle 1：当前播客路径的诊断基线

- **确定历史事实**：`.tmp/evolution-algorithm-20260924/measurement-1/candidate-v6/2026-09-24T12-20-23-00-00_opencorvus-automationbench_7Q8LgT2tZd49p4TeQ7HF5v.eval` 的1125，Task `tsk_g00VW8kMPC00VvEF5deH`。原 SYSTEM 禁止澄清；USER 要求 Slack 和两个指定订阅者的邮件。原 `api_fetch` 无 Gmail send，验证者邮件查验为空，`manage_task.complete_task` summary明确“No emails were sent”后仍成功结算。完整历史收据另见该目录的 `tsk_g00VW8kMPC00VvEF5deH-terminal-evidence.json`。历史 `.6` 不是当前 `.13`，不能直接断言当前仍有同错。
- **可达性先验**：operator在全新只读 OfficialWorld，经原公开 Drive files.list、`name contains 'Subscriber'` 查到 Podcast Subscribers 文件；下一步沿它的真实ID读取Sheet可确认opt-in。该读路径没有读取隐藏评分，不修改历史世界，也不进入被测模型输入。Slack/Gmail实际投递可由原官方 scorer 与原工具事件独立观察。字面 podcast 的断言只作为官方分数一部分；监督机制重点是明确要求的邮件义务及真实结算。
- **输入/环境**：官方 `marketing.podcast_episode_promotion`/1125，原 manifest里的原CASE、SYSTEM/USER与world clock完全不变。一次 Task 入口、新隔离世界、当前 `.13` 的既有不可变包 `9061cb18bd24f80563430abb437afb4460843cc48fb4c4a8eaa60171e6a74a8b`；只用真实流式 Sol。先验证模型目录与凭据及精确预检；采用原Inspect outer none、300秒真实无活动、poll2。使用现有 controller 的 launch_host/run_inspect/settle_owned_activity/stop_host，不改 scorer或生产调度，不启动整套factorial。
- **目录/次数**：`.tmp/supervision-causal-20260925/cycle-01/task-baseline`，Task一次。这次为复现已知问题的开发诊断，不计入旧矩阵、不叫独立留出、不以旧 `.6` 的 Luna结果作单变量比较。结束后先分析；不得自动复制样本或创建下一个Task。Mission相同原例的一次独立验证只在本轮结论明确后登记其确切预测和目录。
- **竞争解释与预测**：H1—必要来源/原请求未进入实际接收上下文；查真实消息/Tool和handoff才能成立。H2—源可用但共同漏读/将401空查询认定全局缺失；原始调用链应显示缺失与判断。H3—已知必需效果未满足且decision仍complete；须同时有接收证据、未完成业务效果与真实complete调用。H4—当前已完成邮件/Slack且verification和结算正确；则旧错当前未复现，禁止凭旧事实继续改。若runtime异常，保留null单独审计，不把它当H1/H2/H3证据。
- **观察与验收**：原始官方strict/partial；实际读取订阅记录、收件人/正文/send收据、受限节目处理；verifier是否从原请求核验并给具体缺口；调度器是否按实际证据返工/结算；真实模型请求、token、Tool、时长。没有产生错误就不能称“已验证纠错”；那只证明本次正常路径。若发现失败，先定位第一个失真边界再写单一修复预测；原产物只读。

## 交付与运行 checkpoint

- 当前旧Sol formal-1已停，八host退出及凭据清理记录在原试验 `user-stop-20260925T042935Z/closure.json`。任何后续新运行都使用新目录；先检查重复controller/Task。
- 计划/索引修改需docs:check和差异复核后提交。启动前固定源码身份。运行中不得修改正在测量的源；每次后续修复在收尾后落盘，必要正向合同与真实Checker验证后单独提交。
- Git当前待推送链含未核验其他工作流 `2a55323e`。每次交付仍pull/merge检查整链，不夹带、不强推，不用新branch/worktree规避。推送阻塞不妨碍已授权的本地证据调查，但必须如实报告。

## 用户修正：全局机制先行

用户原话：“从全局机制思考出发，遇到小问题再修复小问题，不要视野落到局部问题”。据此将本计划主线固定为下表的端到端机制；Cycle 1只是观察点，不以单例失败重置问题、不直接接着改播客文案或启动Mission。区分三种闭环：交付是否满足原始目标，纠错是否让反证改变行动，进化是否让测量改变候选选择。协议收敛为三者提供基础，但不能替代任何一种语义判断。

| 共同边界 | 唯一事实源与真实输入/输出 | 语义责任与纠错/终止 | 当前实现与证据边界 |
| --- | --- | --- | --- |
| 目标→分工 | 真实用户Message、Task creation contract；Mission authored request、Task `# User Request`、真实dispatch输入 | Mission保持总体scope，Task scheduler按原目标派单，worker不把派单摘要扩成新权限；缺scope回到同一归属纠正 | task-control-plane Outcome and delegated input；mission-core scope/Done when；orchestrator/agent.ts request renderer。当前1125两次dispatch实际完整保留SYSTEM/USER；其他Task/Mission仍需按证据核对，不能外推 |
| 执行→观察 | 原业务source、Task Session/ToolPart、dispatch settlement和Artifact | 执行者获取业务事实；read_agent_message只投影，不替模型选真值；页/引用不完整时续读 | 同一共享reader及failed Task Panel路径，已有字节/归属合同；完整引用仍不能补不存在的查询。1125 verifier实际用两次evidence_reads读取原输入/输出 |
| 观察→判断 | 原请求、原始记录、生产者和独立验证者的真实消息 | verifier独立建适用义务，scheduler裁决冲突；报告完成不等于业务通过 | Task CompleteTaskInputSchema及core已有此要求。旧1125已知未发却完成，旧sales多层共用错来源；当前1125发送完成，未产生纠错机会 |
| 判断→返工/结算 | Task lifecycle事件、Completion Decision索引；Mission acceptance ledger/current terminal refs、accepted/blocked ToolPart | scheduler同occurrence continuation；Mission基于具体gap恢复原Task，新增resolution evidence后再验收；外部不可修复才blocked | mission/acceptance-ledger.ts保留各criterion及观察/修复/解决/失效/阻塞证据；core对应resume步骤。正常交付不证明这条纠错反馈实际发生；不能增加第二ledger或Host语义gate |
| 测量→进化选择 | frozen Campaign/Candidate/Run/Evaluation/Review Artifacts，comparison-recommendation，独立mutation intent/receipt | 作者提出有范围的假设；Evaluator测量；Auditor审证；Recommendation Owner按同源比较推荐；是否安装另有授权 | feedback-revision.ts只有development_campaign_locator=null与包完整性比较。既有Evolution Lab→metrics→独立review→comparison→mutation-intent是另一条路径。旧人工feedback+Inspect外循环并未运行这条完整路径，因此其bug不能当旧分数原因 |

### Cycle 1已完成：结果与限制

- 唯一Task `tsk_g00VWCpO8f00u3fgS462`自然completed，controller finished；Host/PID均已退出，公开cleanup无active，auth/models复制件实际不存在。原输入、候选、世界与评分未改。源`7633774407af5e8c4c8c6c310fb8a28cd2a5df84`、`.13` immutable binding精确匹配。
- 原官方strict=0、partial=6/7；唯一失败为给regular地址的邮件缺字面`Episode 42`。原USER明确要求嘉宾与主题，并未明确要求该数字短语；保留原分和这一额外断言边界，不为命中它改通用prompt。核心旧缺陷“无邮件仍完成”本次未复现，不能称本次验证了返工或证明模型替换根治。
- 原事件6经Drive实际找到订阅表、7/8读取meta和List；15发Slack，16/17发两封邮件；verifier重新读取内容/订阅表（26）和实际sent记录，读取原工具input/output并明确接受。两个dispatch都带原SYSTEM/USER，不存在本次将原请求缩成仅Slack的事实。原生completion基于这些真实效果；H4对核心邮件义务成立，H1/H2/H3没有在本次重现。
- 57次真实流式Sol请求、57条用量，input281134/output12177/reasoning1892/cache_read1700096/cache_write0/total1995299 tokens，官方Tool30次，episode490.52秒。账本cost_usd=0只是本地计价字段，不是账单免费。一次Task观察，不产生新的四臂或模型效果结论。
- 正式原分对原生终态的Markdown混淆矩阵仅此一个样本：TP0、FP1、FN0、TN0、null0。这里的FP包含上述字面断言差异，不能自动解释为多层监督忽视未发送邮件。

## 全局审计发现 G1：独立审查结论在进化比较中被丢弃

### 修改前事实、影响面与旧路径

- Schema `packages/plugin/src/expert-squad-evolution-artifact.ts`定义review.status=reviewed/unavailable，并独立定义finding.category（evidence_integrity/reward_hacking/permission/side_effect/security）、outcome（passed/failed/unavailable）、severity（info/warning/blocker）。完成审查与各项审查结论是两个维度。
- `expert-squads/builtin/evolution-lab/lib/evolution-lab/comparison.ts`的classifyComparisonAvailability只检查整个review是否缺失或status unavailable。后续只有reward_hacking的failed被消费；其余category的failed blocker以及全部category的unavailable blocker均不影响推荐。Recommendation Owner被生产publisher要求提交与该函数完全相等的推荐，因此靠模型读懂审计也不能提交不同合法结论。这是确定性数据消费缺口，非模型行为推断。
- 在新`.tmp/supervision-causal-20260925/global-audit/`用现有comparison test fixture（明确合成数据）调用实际生产函数：三次相同baseline0.2/candidate0.8，唯一candidate review换成各category的failed/unavailable blocker。结果见comparison-before.json：四种非reward failed blocker与五种unavailable blocker仍为promote；reward failed沿旧规则inconclusive。passed blocker为promote。该诊断不是完整真实Campaign；未创建模型、世界、候选或篡改历史Artifact。Bun tsconfig-override产生工具内部directory warning，但实际函数正常输出；后续在package标准test入口复验，不能只以这次脚本输出当交付。
- 已搜索定义/调用点、publisher审查者身份与finding.evidence归属检查、comparison source closure、plugin schema/history投影、mutation-intent推荐验证、Auditor/Recommendation Owner指令和现有comparison/Artifact发布测试。只有一份deriveComparisonRecommendation被生产publisher调用；mutation-intent消费它的exact Artifact和recommendation。本修复不改变Task/Mission/Session调度/恢复/终态，不涉及UI、官方评分或历史测量；这些横向入口不新增行为。

### 修复预测与实现范围

- 在既有domain比较函数消费已声明的typed findings，不重新判业务语义，也不添加Host流程门：`reviewed`仅表示审查过程完成；任一finding为severity=blocker且outcome=unavailable时，该slot的对应审查维度成为required unavailable，aggregate null且recommendation=inconclusive。任一已reviewed的failed blocker使recommendation=inconclusive，保留已测数值和原finding的failed事实；总体不能形成可靠采用建议，不把失败改写成unknown。沿用既有reward_hacking failed的inconclusive规则。
- passed blocker和非阻断warning/info仍按既有分数/区间规则决定；severity由Auditor的真实结构化结论提供，代码不匹配文字、不猜测权限含义。对已完成review的全部finding分类统一处理；已有Review Artifact及comparison source closure继续是唯一依据，不新增可写ledger、不改public Artifact schema、不补写历史推荐。
- 正向验收先复现红测试，再覆盖五category的passed/failed/unavailable blocker与非阻断warning；断言具体promote/inconclusive、aggregate和required dimension输出，而非“不调用/不存在”。同样正向分数下只改变审查finding，明确检验因果预测。再进入生产publish-evolution-artifact的真实持久化前驱/来源解析路径验证审查维度传到推荐，不用静态字符串检查冒充行为。
- 同步Auditor/Recommendation Owner和现有README说明typed outcome与review完成状态；不扩权、不启动Campaign、不改统计方法。运行聚焦comparison、相关真实Artifact出版合同、包typecheck、docs和diff检查，独立复核后提交/pull审查；旧业务低分与本bug的因果关系仍明确为无证据（旧试验没有走此比较路径）。

### G1实施与验证 checkpoint

- 在唯一domain比较器中实现上述两类finding消费，使用原Review中的category/outcome/severity和slot身份；没有改scorer、统计区间、任何历史Artifact、Task/Mission生命周期、公共schema或安装权限。Evolution Lab当前源码包版本升为`2026.09.25.1`，模型侧Auditor/Recommendation Owner与README同步该语义；已发布payload和历史包保留原样，未做安装/推广。
- 标准package测试入口先复现9个红测试（4类failed blocker、5类unavailable blocker仍promote）；修复后comparison全部30项通过，涵盖五category的passed/failed/unavailable blocker和非阻断warning，以及既有统计行为。相同正向观测仅改变审查finding即可改变推荐，符合本轮因果预测。
- 生产`publish-evolution-artifact`真实Host前驱持久化/完整读取/归属/来源/精确推荐校验路径通过：已完成baseline review内第二项security unavailable blocker自然投影到`integrity_finding:case-1:baseline:0:security:1`，publisher接受完全同源的inconclusive结果。连同当前源码包材料化共2项/52 assertions通过；这使用隔离真实存储与生产Tool、合成测试输入，不是LLM自主Campaign。另两项owner/跨Taskimport正向合同通过。移除了受触及测试的两个冗余not.toThrow断言，保留实际验证调用并对完整source producer作正向输出断言。
- OpenCorvus TypeScript typecheck、docs:check与diff检查通过。曾误将`evolution-lab-package-projection`的**已发布payload**版本期待改为当前源码版本，测试正确返回旧`2026.09.06.1`；核对installPayloadPackage后精确撤销这两行不当测试修改，重跑原1项/40 assertions通过。该released-payload测试不冒充新源码包验证；新源码闭包由上一条材料化测试覆盖。
- 独立复核确认：failed blocker保持原failed事实和已测数值，推荐inconclusive；unavailable blocker保留具体维度且aggregate null；passed与warning沿原规则。模型仍负责审查语义，domain比较只消费其明确结构化结论；不新增Host语义判定或第二事实源。未声称该修复解决业务漏项或证明自进化整体收益。
- 下一优先级仍是全局机制：用已有多个Mission/Task轨迹检查“原目标→真实委托→反证→同Task返工→复核”的实际传递与控制是否一致，并核对手动feedback外循环与现有Campaign测量/选择路径的证据边界。当前没有任何运行中的实验；不自动启动播客Mission、作者或四十例，不因本次6/7改业务prompt。必要新观察必须回答共同机制的明确未知并先登记。

## 全局审计 G2：反馈存在不代表纠错，重复判断不代表独立判断

### 范围、正反例与实际边界

- 只读盘点旧formal-6/7中42个已有result的episode，其中20个Mission；14个episode有worker continuation请求，20个Mission决策为10次accepted、10次blocked，没有观察到`panel_resume_task`请求。这是选定旧轨迹的请求盘点，既不等于所有continuation都成功，也不证明resume实现坏了。原账本只读，派生索引在`.tmp/supervision-causal-20260925/global-audit/repair-corpus-inventory.json`。
- 深读formal-6的sales和account-risk两例MS/ME共四条原始`.eval`、Task数据库Tool请求/outcome/participant message，完整派生摘录在同目录`four-trajectory-extract.json`。生产读取器输出含真实消息及可继续的Tool索引；不能把索引或末条报告等同于实际已读原始业务来源。

| 边界 | 失败轨迹中的实际事实 | 对照与可支持结论 |
| --- | --- | --- |
| 原目标→来源覆盖→判断 | sales ME实际读了标准价表，但本条完整官方事件中没有Gmail记录读取。scheduler的verifier continuation `prt_g0VWAgZry00rHFmmUCLM`却要求确认“broader absence of an applicable health policy”。最终以不存在健康政策而fail；Mission进一步把policy缩成定价adjustment并blocked | 同例MS事件33/35/36实际找到并读取更新及政策，计算54,000且On Hold；原官方满分。未读的来源不能升格为不存在；真实政策改变stage，也不是必须改变金额。这是来源覆盖与解释被收窄的证据，不是停止通知缺失 |
| 判断→返工→复核 | account ME verifier `msg_g0VWAjMr400Yz1eh58CF`将空活动日期认定为入选，scheduler在`prt_g0VWAjZaQ0054n41SBV3`把该解释写成既定修复目标；worker寻找缺失金额并删除此前邮件，复核继续检查金额缺失与删除结果，Task和Mission均认定阻塞 | 同例MS按排除解释发出官方接受的两账户邮件。这里必须进一步限定：公开读到的表同时含Churned排除规则，但Vanguard的实际expired/cancelled证明未在这些读取中出现，Salesforce只有被用户提醒可能过期的标签。因此官方满分不单独证明MS推理完整，也不能把“Vanguard必须排除”硬编码。可证的是有争议的资格前提未经重审就成为返工事实 |
| Task→Mission证据 | sales ME Mission成功读取四条final与62条因果Tool索引，但返回三条`inventory_next_before`未续读，`evidence_reads=[]`；account ME Mission只读取最后verifier final与16条Tool索引，`evidence_reads=[]`，随后blocked | Mission能收到失败与真实final，不等于它独立核验了来源覆盖或资格解释。reader可用和terminal收敛只能证明协议；本样本中没有Mission重新打开Task的真实行为 |
| 实际continuation控制 | 上述sales两次continuation、account有效executor与verifier continuation均有completed Tool outcome及后续业务读取。account另一次`input:null`请求被真实typed输入错误拒绝，原样保留；随后正确input请求才执行 | 不把尝试次数当纠错次数，不把无效参数修正当业务改进；没有证据可把本组共同问题归咎为worker没被唤醒 |

### 当前实现、归因限制与优先级

- 当前`delegated-worker/context.ts`从Task唯一request自动投影原始Task请求，`intent/request-prompt.ts`明确Mission assignment是协调者撰写，可组织但不能扩权；worker并非只能看到scheduler摘要。当前core已要求独立从原请求推导义务，scheduler已有真实Tool读取和未知来源处理，Mission已有exact terminal、完整读取、same-Task resume和独立判断规则。旧E3轨迹不能证明当前`.13`仍相同，也不能支持再堆同义提醒。
- 共同风险是**认识上的反馈失真**：一次模型解释被派单写成前提，后续角色围绕它确认，而未返回更高权威重新判适用性。角色数量、相同结论、返工次数和更多read都不自动消除此风险；新增Host语义gate或固定来源路由会产生另一事实源，不能作为修复。
- 当前证据支持保留G1确定性修复，以及对当前Mission路径做一次有界观察；不支持立即修改角色prompt、追加author或宣布模型弱。若当前未重现，就停止这条旧错追逐，不靠连续重抽直到得到想要的失败。
- 优化闭环进一步确认：`feedback-revision.ts`只产出未测候选；Tool描述现在明确“不执行trial/comparison/parent selection”。`evolution-mutation-intent.ts`将feedback安装与promotion分开，后者要求同一revision对的Campaign/Candidate/Comparison、promote及无required-unavailable。旧人工外循环把下一轮父代与未被接受的候选链绑定，不能当作完整优化机制被验证。G1只修真实比较消费缺口，未替旧人工选择提供追认。下一候选若确有必要，先确定被证据支持的父代和选择路径；当前不创建候选。

## Cycle 2预登记：当前Mission共同链路观察（非效果重测）

- **全局未知**：当前原始目标经过Mission→Task→worker后，是否保持来源范围；遇到子Task缺口时，Mission是否真正检验未读来源/可疑解释并作出基于原证据的独立决定。Cycle1仅覆盖Task正常交付，不能回答Mission。选sales作为已存在“同源政策可达但旧多层误判”的观察点，原输入未要求不可公开获取的ID，不使用account资格歧义作修复判据。
- **唯一运行**：`.tmp/supervision-causal-20260925/cycle-02/mission-observation/MS`，官方`sales.create_new_opportunity`/9，一个全新独立世界、一次Mission。使用已有不可变`.13`包`9061cb18bd24f80563430abb437afb4460843cc48fb4c4a8eaa60171e6a74a8b`、真实流式`openai/gpt-5.6-sol`、原manifest/input/world/scorer、outer none、300秒真实无活动、poll2。源码为本预登记提交完成后的确切HEAD，写入独立controller receipt；运行中冻结。复用已验证现有driver启动/评分/公共收尾，检查成对auth/models与精确预检；不把operator的已知来源ID、答案或本审计文案传给模型。
- **互斥解释**：C2a—原目标/权限在委托或上下文丢失，必须由真实接收输入证明；C2b—信息可用但来源漏读/推理偏差且监督沿用，须定位首次把未知升级为事实的真实消息；C2c—Task有具体缺口，Mission以新证据执行same-Task修复并再验收，须有真实gap、resume、epoch及新结果；C2d—Task直接完成且Mission证据支持验收，仅为正常交付，纠错仍未被触发。运行时错误单列并保留null，不冒充C2a/b证据。
- **判读/停止**：先逐段核对原请求、Mission assignment、worker输入、源记录及实际写入、verifier与Mission真实读取/决策；官方分数与机制结论并列。只运行一次，任何结果都保留；通过不能证明修复/模型因果，失败不能触发同义prompt修改或下一例追分。只有能定位当前真实实现缺陷才进入单一修复预测，否则记录未证或解释被证伪并停止该诊断分支。收尾先核对正常公共API、零活动、Host/PID退出及auth/models删除，再修改记录。

## 用户模型切换：Cycle 2中止，Cycle 3使用Luna

- 用户原话“改回luna测试”授权切换当前诊断模型。先保留Cycle 2当前Mission原始快照，再公共POST abort仅Mission `55a1e74079b3dd65`；其子Task `tsk_g00VWCzIST00SkdfRAxP`真实cancelled。确认零活动后，精确停止仍等待业务outcome的Inspect observer子进程56932（属于原Inspect57260），原controller自然进入cleanup并正常停止自有Host。未触及其他进程/实验，没有伪造业务accepted/blocked终态。
- Cycle 2的controller最终`finished`只代表运行器收尾，业务测量为`sample_unavailable`、strict/partial均null、sample_count=0，原因是用户中止，不是自然失败，也不是零分。原日志/数据库/Tool结果/候选均保留；独立中止收据在`cycle-02/user-model-switch-20260925T060046Z/`。Host56208、controller54944、launcher54568和Inspect父子均已退出，复制auth/models实际不存在，公共cleanup active=[]。
- 全部83次Sol实际请求保留，HTTP200为83；用量账本82条，input366790、output13190、reasoning2410、cache_read2420864、cache_write0、total2803254 tokens。最后取消边界上的请求与用量条数不同，不能用已记录token推断完整账单成本。中止前的执行事实是已读真实定价/政策并创建54,000 On Hold商机；Mission尚未验收，不能把该片段当完整成功或模型优劣结果。
- **Cycle 3预登记**：`.tmp/supervision-causal-20260925/cycle-03/mission-observation/MS`，一个全新世界、一次Mission，仍为`sales.create_new_opportunity`/9与不可变`.13` digest`9061cb18bd24f80563430abb437afb4460843cc48fb4c4a8eaa60171e6a74a8b`。唯一实验变量为用户指定流式`openai/gpt-5.6-luna`；官方输入/时钟/scorer、角色定义、outer none、300秒真实无活动、poll2沿用。源码为本记录提交后的确切HEAD，除本记录外相对Cycle2不修改源码。全套角色/压缩/预检均使用Luna，启动前验证成对凭据/模型目录及实际请求模型。
- 继续回答Cycle2的同一全局机制问题及C2a/b/c/d解释，保持原始目标→证据/反证→判断→纠错/结算→测量选择主线。这是明确用户要求的模型切换新观察，不是按得分补跑或选择最佳结果。中止Sol的null不能作为Luna提升基线；不拼分、不启动大矩阵或新作者。通过只说明本次实际路径，失败先归因首个边界，不能自动追加提醒。新运行五分钟快照，结束先公共收尾/零活动/Host退出/凭据删除，再记录结果。

## Cycle 3结果：事实补齐，错误验收仍贯穿Task与Mission

### 原分、状态与成本

- 运行于2026-09-25 06:04:20.054511–06:22:06.431205 UTC，Inspect episode用时1066.341秒（约17.8分钟）。原日志为`cycle-03/mission-observation/MS/eval/2026-09-25T06-04-19-00-00_opencorvus-automationbench_fzXpVguERSbrSncYDgTNNf.eval`，Inspect success/exit0、sample无error、官方scored。严格分0、部分分0，均是有效原分，不是超时/null。
- 唯一纳入分母的官方断言是组合业务检查：指定账户的Analytics机会、Amount54,000、Stage On Hold。实际Amount5,000使其失败；另外六项排除断言的原结果为passed/excluded，未进入分母。因此0分不等于所有操作都失败；账户/模块/On Hold及真实创建均已发生，但核心定价不合格。
- 原生Task `tsk_g00VWD2mc600O3enX3TS` completed，Mission `18bc7430b41f50ae`真实`panel_complete_mission` accepted。controller finished，cleanup保留accepted且active=[]，Host stopped；launcher55452/controller48652/host55396/Inspect56976均退出，auth/models复制件实际不存在。数据库、原消息/Tool/评分/日志及`.13`候选保留，未重算、补写或重启。

下表以原生Mission是否接受为预测、官方严格检查为实际，仅此一个样本；不能与用户中止的Sol/null拼成模型效果比较。

| 原生Mission决定 | 官方通过 | 官方失败 | 官方不可评分null |
| --- | ---: | ---: | ---: |
| accepted | 0 | 1 | 0 |
| blocked/未接受 | 0 | 0 | 0 |

| 成本口径 | 原始账本结果 |
| --- | --- |
| 实际Provider请求 | 121，全部HTTP200、流式gpt-5.6-luna，含预检与所有角色 |
| 用量事件 | 121 |
| input / output / reasoning tokens | 915,758 / 23,652 / 5,847 |
| cache_read / cache_write / total tokens | 4,094,976 / 0 / 5,040,233 |
| 官方业务Tool事件 | 52 |
| 原生全部Tool请求 | 111，其中9个failed：1个错误Message引用、8个add_goal参数错误；与官方52为不同范围，不能相加 |
| 账单金额 | 未取得；本地cost_usd=0不能当免费或真实结算金额 |

### 原目标到最终决定的实际链路

完整只读派生索引`global-audit/cycle03-final-evidence.json`保留原输入、原score/events、角色final、Tool请求/outcome及其引用的permission result。前期摘录`cycle03-manage-task-early-errors.json`、`cycle03-first-business-mutation.json`、`cycle03-repair-dispatch-and-sources.json`仍保留，不覆盖；原DB/日志为事实来源。

| 共同边界 | 实际观测 | 解释与反例 |
| --- | --- | --- |
| 目标→委托 | Mission创建request与verifier初次dispatch `prt_g0VWD4Bxe004hN45oIFu`均保留按account size/tier、最新价格及健康政策定价的要求。初次verifier handoff传入原任务与真实record/message定位，未直接把5,000写成应得答案 | 本次错误总价不能解释成原请求只要求单价。Mission并未逐字转发原SYSTEM的禁止澄清/合理假设句；本次没有question行为，尚无证据把该措辞缺失当本次金额错误原因，不能据此设Host自然语言gate |
| 来源→首次写入 | 执行者读`msg_q4_pricing_001`，原文是每联系人5,000、base不变，却在读取基础价/人数/折扣前以`prt_g0VWD3wVO00vN8ku2rjW`创建Amount5,000机会`ba03de82c6c548e0a7`；真实success及回读吻合 | 第一次可观察业务失真是把费率当总额，成功写入/同值回读只证明写了什么，不证明算对。公开来源后来给出(40,000+4×5,000)×90%=54,000，和原官方断言一致；无需隐藏答案即可反证5,000 |
| 独立判断→返工目标 | 首verifier `msg_g0VWD4tvz006sS0WMa1Y`把5,000与更新费率一致判为Pricing satisfied，仅将直接size字段为空列为gap；scheduler真实continuation `prt_g0VWD50Zc00vVYjbcLeC`据此聚焦size/source evidence | 系统有反馈、有返工，但修复目标沿用未证实的“定价已正确”。新的读取只被用来关闭被命名的gap，未有效重审依赖它的金额结论 |
| 返工事实→再判断 | executor实际读标准表base40,000/Gold10%和4条Contacts，仍不修改。第二verifier自身也实际执行`prt_g0VWD643R00cxZfPYtoW`人数查询及`prt_g0VWD65IV00Hco4AJ9Bt`标准表读取。其final `msg_g0VWD6Hw900oqmR6FaIP`同时列出全套计算项与当前5,000，却Accepted | 这里已不是缺凭据、来源不可达、读取器截断或缺人数证据；原始事实和相反的结论同处实际报告。代码里的完整读取/身份合同不能替代模型完成关系与计算判断 |
| Task→Mission结算 | Task complete调用`prt_g0VWD6a3B00DrkdM9TkO`summary保留这些矛盾值并接受Slice。Mission完整读5份Artifacts（complete=true）和5条participant messages（complete=true），随后`prt_g0VWD6zA700u93eA9l4g`明确接受5,000；没有Mission resume | Mission收到足以质疑的内容，却认定事实补齐等于业务正确。不是通知没到，也不是必须新增第二ledger。所有业务mutation只有首次创建；另一个POST是Intercom只读search且401，不是金额修正 |

### 与当前实现对照后的结论和停止边界

- 当前实际binding为`.13`；该不可变verifier prompt已明确要求独立枚举每项term/adjustment并recompute，orchestrator prompt已要求独立formula再接受，shared core也要求将原义务、实际操作、结果分开。当前`DelegatedWorkerAgent`把packageRevision、原Task上下文及真实增量guidance送入同一runner；本轮未发现遗漏原定价要求或未交付新数据的实现证据。未捕获每个Provider请求的完整wire prompt，不能把源码检查夸大为完整输入审计。
- 首阶段9个参数/引用错误后来通过真实成功调用自行纠正。AddGoal schema确实要求`goal.acceptance_specs[].severity`、`goal.owned_paths`与外层`reason`，错误调用把层级放错；OpenAI operation envelope与canonical materialization需区分，但未证实schema丢字段。它们增加成本，却不能解释后续收到完整价格事实仍接受错误总额。
- 本次支持C2b：事实可用，部分独立读取和真实Task内部continuation都发生了，但错误解释跨worker→scheduler→Mission被保持。C2c未得到证明：没有Mission acceptance-gap/resume/new epoch，也没有金额修正；C2d正常交付被原始业务证据与官方检查共同否定。不能把121个HTTP200、完整读取、两次验证、Delivery Slice或accepted终态当业务通过。
- 多条旧轨迹和当前观察共同支持的全局问题是：监督没有形成可靠的独立预期并用反证更新既有判断，后续层次在错误解释上继续确认。这是观察到的行为机制；究竟多少来自上下文锚定、任务指令优先解释或模型能力，当前未分离。不得把它偷换成已证明“Luna整体太弱”，也不得把再写一次“独立计算”称为根治。
- 本轮有实证交付是G1确定性比较消费修复，以及上述全链诊断；**业务误验收尚未修复，可靠自主纠错及进化收益尚未达成**。目前没有新的已定位实现缺陷足以支持代码修补。依预登记停止这条观察路径，不开下一世界/作者，不为制造版本变化堆提醒、例题答案或Host业务gate。保留当前未通过结论，暂停自动跟进，避免无信息唤醒；后续重新设计或验证必须先给出能区分竞争解释的新预测，不能再以相同提示词重抽替代机制改进。

## 续审：停止重复观察不等于停止共同机制工作

- 用户随后质疑“你无能为力吗？”。继续原无人值守授权下的机制调查；此前从“当前没有可证明的实现bug”直接收束为暂停整体推进，过早排除了协议/验收产物设计的改进空间。保留Cycle3失败及旧停止事实，不重新启动它，不把后续调查当既有问题已修复。
- 新只读代码核对：`acceptance/types.ts`明确`AcceptanceSpec.scorers`是给下游Agent执行的规范，不是Host运行的检查；`orchestrator/acceptance-prompt.ts`仅渲染它。`CompleteTaskInputSchema`接收语义summary、证据与已接受Slice身份；当前AutomationBench verifier是generic delegated-worker，产物没有独立预期/实际观测/比较的专属结构。现有`fact-check/schema.ts`提供verified/corrected/unresolved及影响面，Research Studio已有可复算结果与后置fact-check的设计，可作为复用边界调查；不得复制一套新的平台ledger或宣称这些声明天然验证了业务。
- 共同机制待验证假设：如果验收只交付“结论+来源引用”，即使数据读取完整，也可能把事实齐备当作推理成立；将原义务、独立导出的预期、实际观测和差异作为可复核的验收产物，可能暴露当前被叙述掩盖的矛盾。另一相关假设是返工新增前提后，只复核原gap而未重审依赖该前提的旧accepted判断。二者是设计假设，不是已证修复；不能把换字段名或多写提醒当算法改进。
- 下一步先全仓核对现有typed FactCheckReview、包级Artifact和可复算结果的实际生产者/消费者、工具授权及prompt优先级，明确可复用部分与尚无覆盖的边界。原Task/Mission/worker仍分别承担其语义决定；Host仅做来源/类型/一致性校验。若要实现，应落盘单一产物/交接契约的确切输入输出和竞争解释，先验证能否忠实表达已有成功、当前错误与未知三类证据，再确定必要的最小真实Checker，不能直接跳到新作者/候选/大矩阵。
- 本续审阶段不启动新的模型/世界，不改变官方输入/scorer/历史记录，不写案例答案，不扩大工具权限，不新增角色/隐藏消息或Host业务路由。先完成上述本地机制审计与可审查设计；新运行仍须单独预登记其预测和样本数，用户最新模型保持Luna。恢复定时跟进仅推进此项未完成机制工作，状态不变不通知，不把已停止进程再次唤起。

## G3设计审计：验收比较记录的表达能力与反例

### 已核对的生产调用链和复用边界

| 现有机制 | 实际生产者→消费路径 | 可复用部分与限制 |
| --- | --- | --- |
| FactCheckReview | fact-check/index.ts构造真实目标Message与Artifact发现上下文→tools.ts记录typed review并检查分类计数/verdict一致性→orchestrator/fact-check-tool.ts核对target scope→persist.ts发布单一Artifact→catalog供下游Agent判断 | 已有纠正、未知、影响面和来源引用，无需新增角色或第二事实账本；但verified项只有claim/evidence，没有独立预期、实际值、计算关系，不能将其schema合法等同于事实为真 |
| Research Studio复算 | analyst角色生成执行过的计算资源及canonical表→原artifact_snapshot/publish→fact-check角色读取并要求实际复算→typed FactCheckReview→writer/调度器消费 | 可借鉴方法与资源归属。其fact-check runtime允许bash，当前AutomationBench不等价；不能把其它包的能力从名称或prompt推定为本包已有 |
| 当前AutomationBench | generic delegated-worker→已有artifact_publish以namespaced任意JSON发布，Host解析唯一JSON键、真实作者/来源read refs→scheduler与Mission完整读取并语义裁决 | 复用现有Artifact单一存储/来源路径；若定义专属比较记录，仍需模型生成正确方法和完整适用范围，通用publisher本身不会替它判真假 |
| 当前工具能力事实 | Cycle3真实worker_turn_descriptor的tools.enabled列出四个官方MCP与Artifact/participant transport，无bash；verifier以其实际descriptor为准 | 审计时已发现base runtime的可投影池与具体已授权投影不是同一集合，不能直接搬入Research Studio执行能力。本阶段不改权限或给真实模型新增工具 |

### 实施前原型方案（不是生产修复或新benchmark）

- 在`specs/artifacts/2026-09-25-acceptance-comparison-design/`形成离线设计原型：一份严格JSON schema、一个只计算所给声明的纯Python解释器、可审查输入及输出对照。它不被生产代码导入、不注册工具、不发布候选、不调用模型/业务API。沿用已有Python/jsonschema，不引入依赖，不部署新的ledger或Host裁决。
- 输入明确分开criterion、expected声明与actual observation。数值expected由作者指定的输入及四则运算树计算，禁止执行字符串代码；literal expected用于非数值义务。每个输入和观测带来源指针，available/unavailable显式区分。输出只判断**所给表达式和观察的关系**为matched/contradicted/unresolved，并列出未使用输入；绝不声称检查了源选择完整性、公式业务适用性或引用真实读取。
- 预登记离线对照：完整公式与正确实际值→matched；同公式与Cycle3错误实际值→contradicted；缺必要输入→unresolved；新费率输入改变后仍沿用旧总额→contradicted；缺邮件效果→contradicted。保留一个必要的反例：选择错误但语法合法的“只用单价”表达式，会与错误5000得到matched，且列出其它unused inputs。这会直接证伪“增加expected/actual字段或计算器即可根治”的强假设，不能删除反例或把它硬改成失败来粉饰原型。
- 验收为表达与消费合同，不是LLM行为验收：预先声明每例具体状态/数值/缺项输出，覆盖公式运算、缺输入、观测不可用与错误方法反例。原始Cycle3分数与证据不修改；这些operator撰写的设计向量单独标记，不输入被测模型、不计入历史效果。原型通过只证明能表示/检查给定关系；若反例仍matched，就明确限定价值并继续研究如何独立形成预期，而不直接推广或加Host gate。
- 原型复核补充一个明确的精度边界：未指定舍入规则的非终止小数运算应返回`derivation_precision_unavailable`，不能静默舍入后宣称精确匹配。加入第13个正向输出对照；这仍是本地表达合同，不引入财务计算策略。此前“旧费率总额”向量只是手写的63,000对照，改为明确的假想旧观测，不能冒充读取过的历史价格或已验证依赖失效机制。

### G3本地结果与交接设计 checkpoint

- 已执行离线原型，13个预声明输出全部吻合：[完整输入、解释器、结果和交接设计](../../artifacts/2026-09-25-acceptance-comparison-design/README.md)。它们是operator手写设计对照，不是模型生成数据、真实业务checker或13个benchmark样本；原Cycle3仍0分，业务误验收仍未修复。当前没有新模型请求、实验进程或权限变更。

| 对照类别 | 数量 | 实际输出及边界 |
| --- | ---: | --- |
| 完整数值/投递记录正对照 | 2 | matched；只证明给定输入的比较 |
| 正确方法对错误观测 | 3 | contradicted，含Cycle3的54,000对5,000关系、假想旧观测和漏投递 |
| 错误方法与错误实际相同 | 2 | **仍matched**；其中一例连必要输入也省略，unused为空。直接否定仅靠字段/计算器保证业务正确 |
| 缺输入/观测/单位一致性/定义域/精度 | 5 | unresolved，各有明确reason；未将未知转换为0或通过 |
| 非数值观测 | 1 | invalid_contract，精确路径observation.value |

- 代码调用图新增核对：当前AutomationBench图明确executor→verifier；共享worker core已经要求先形成义务再读producer verdict。初始dispatch注入原Task request，continuation使用同一Session及可见增量指导；**不能把重新排一句“先独立推导”当新设计**。真实Cycle3的四个WorkerTurnDescriptor均有原官方API/Artifact工具，无bash；未把Research Studio能力移植进来。
- [交接设计](../../artifacts/2026-09-25-acceptance-comparison-design/handoff-design.md)具体描述一个仍待验证的变化：既有verifier在比较前用现有不可变Artifact发布方法与前提，比较后另产真实review并引用它，方法变更需保留原记录及反证。仍执行原工作流、不增角色/权限、不设Host gate、不复制Mission ledger。它提供可检查的生成顺序，**不保证独立性、公式正确或来源完整**；两个错误方法反例仍然适用。本阶段没有将提案写入生产定义、安装包或启动新世界。
- H-R另发现具体语义冲突：`dispatch-turn-projection.ts`的Mission repair输入写“Recheck only these criteria. Preserve every acceptance not named here”，但`acceptance-ledger.ts::requireAcceptedTransition`明确允许新反证使accepted重新成为open/stale_evidence。前者把保持未受影响结果扩大成保持一切未命名验收。此路径未出现在Cycle3，不能据此认领该失败根因。
- 下一优先级是该共享反馈边界的横审：全仓唯一生产append调用在`task-api/index.ts`，内部append要求active epoch；还须核对公共resume的终态前提、活跃repair中发现新反证时的真实消息/状态归属、下游criterion选择、checkpoint恢复与正向测试。先确认可用反馈路线再修冲突，不能让worker以虚假complete/fail换取下一轮，或新增第二ledger。此项比立即发布上述方法记录提案更有确定的代码切入点；仍从共同五段机制图定位，不开启按案例追分。
- 继续核对已确认：`resumeMissionTask`在入口和事务内两次绑定当前终态，先open再append新epoch；取消态保留其取消权限边界。`dispatch-agent-tool.ts`的criterion选择只允许当前ledger的open项。`acceptance-checkpoint.ts`把完整criterion状态和locator放进原有compaction control，保留成功/失败attempt。故内部append的active断言不能被解读为已有active修订API；当前下一步必须审查活跃返工中的反证回传与权限，而非仅删除一句“only”。现有`mission-acceptance-delta.test.ts`覆盖stale reopen、下游初次派单与checkpoint等局部合同，但本轮未运行或修改这些生产测试，也没有证明运行中扩大受影响范围已经可达。
- 本次验证：离线probe 13个精确输出吻合；`bun run docs:check`通过；`git diff --check`通过。没有生产源码修改、没有新的运行凭据或残留实验。交付是可执行设计反例、具体调用图和下一共同边界定位，尚不是业务误验收修复。

## G4：返工行动范围不能冻结证据判断

### 修改前共享路径横审

| 入口或边界 | 代码事实 | 结论与本次范围 |
| --- | --- | --- |
| Mission→Task恢复 | `panel/capability.ts`只提供completed/failed的resume；`task-api/index.ts::resumeMissionTask`绑定当前terminal、项目/Mission归属与完整读取，事务内重新核验后open新epoch、append单一ledger | 取消不恢复；普通operator消息是另一已授权入口。活跃repair不能借此直接更新ledger。本次不改变这些权限和生命周期 |
| Task-root恢复输入 | `orchestrator/agent.ts::renderWakeProvenanceNotice`真实写入“Preserve every listed acceptance” | 与worker端无条件保留相同风险，必须一起修，不能只改局部角色prompt |
| Worker初始/延续输入 | shared `renderDispatchContinuationTurn`同时用于新下游节点的initial repair与现有Session continuation；`delegated-worker-tool.ts`和runner保留当前authority/真实Message | 现有“Recheck only”将派工范围偷换为事实审查范围。恢复checkpoint携带完整原criteria，但不会自行消除相冲突指令 |
| Worker→Task反证 | `request_orchestrator_decision`以真实Tool输入形成worker_handoff；已有dispatch owner归还真实coordination，或由正常final交回报告。`agent-coordination-facts`保留原summary/details及请求身份 | 已有合法上报通道，无需新增角色、工具或伪Message；上报不是判定成立，更不是修订ledger |
| Task↔Mission沟通 | Task工具factory和Mission `scheduler_message`共用`protocol/scheduler-message.ts`，从真实source Message/Tool Part读取正文，持久化request/reply并按所属Mission/Task路由 | 活跃Task可上报反证并请求决策。消息没有resume或改ledger权限；不能以传递成功声称活跃修订已实现 |
| 串并行与多项目 | dispatch lineage固定Task/epoch/workflow/Session；修复criterion选择按当前ledger及责任校验。通信绑定project与owner，消息lease/replay独立归还原调用 | 本次不改选择/租约/队列/并发，也不把一个Task反证写入另一个Task状态。新增指导只是同一canonical输入在各合法Session中的投影 |
| 正常、失败、取消及重启 | 普通非repair输入不经过该分支；failed/completed经同一公开resume；cancel保持取消；checkpoint使用Task/epoch/ledger/gap/Session和原attempt事实 | 本次改动不增入口、状态或恢复分支。代码横审不能当作新真实LLM/重启端到端验收，相关运行性质仍由已有机制负责 |

### 单一修复预测与边界

- 已证缺陷是**共享输入同时要求接受反证和无条件维持旧验收**。修复仅消除后一个禁令，明确区分：保持仍有效的成功业务效果；允许新反证质疑未选中的旧结论并通过真实报告/既有coordination上报；修改业务和ledger仍须当前权限。它不是增加同义“仔细核验”提醒，也不宣称消除了模型锚定。
- 在`mission/acceptance-gap.ts`定义一份共享的证据指导，由Task-root wake notice和worker initial/continuation renderer消费，替换两处无条件保留语句。保持既有schema、Artifact、Tool权限、Task/Mission/Session生命周期和派单责任校验。本次不实现活跃ledger修订，不用fake complete/fail制造下一epoch；该执行范围缺口继续单列。
- 可证伪的局部预测：当前合法初始worker repair、同Session continuation和Task-root resume的真实输入构造结果，都会明确允许新证据否定选择范围外的旧验收，并区分证据上报与扩大行动权限；修前这三个正向输出合同失败。现有stale-evidence状态转换及checkpoint合同保持通过。
- 聚焦测试修改现有`mission-acceptance-delta.test.ts`和`orchestrator-mission-resume-provenance.test.ts`。后者已有一条以“旧字符串不存在”为核心的断言，按AGENTS删除，保留当前operator root输入的正向authority断言。不加UI测试。测试只证明生产输入构造和已有状态合同，不能冒称LLM实际发现/纠正了业务错误；本阶段仍不新开模型或世界。
- 完整H-R尚未交付：正式活跃验收范围如何更新、跨责任节点的新反证如何得到执行仍需单一事实源的后续设计。Cycle3没有走Mission acceptance repair，本修复不能计作其金额根因修复，也不能改变其原分。

### G4实施与验证

- 已用单一`renderAcceptanceRepairEvidenceGuidance`替换Task-root的“Preserve every listed acceptance”和worker的“Recheck only/Preserve every acceptance”。新指导区分仍有依据的业务效果、新反证及其原始义务、真实上报渠道和当前修改权限；共享原型位于既有acceptance-gap模块，无新schema/Tool/ledger。当前架构同步记录这个边界。
- 实际全仓调用链还包含Build、Analyze Intent、Explore、Frontend Design、Fact Check、Workload Analysis等适配器经`dispatchAdapterContinuationPrompt`使用共享renderer，以及runner的初始repair材料化；不是只给AutomationBench写特例。没有触及这些适配器权限或运行器控制代码。
- 修前运行现有生产测试入口，新增的三个正向输入合同准确失败（worker初始、worker延续、Task-root），其余相关合同通过。修后`bun run test test/mission-acceptance-delta.test.ts test/orchestrator-mission-resume-provenance.test.ts`为17通过、0失败；其中保留真实本地数据库的resume事务/Message/ledger以及精确错误合同、stale-evidence转换和checkpoint attempt测试。
- `bun run typecheck`、根`bun run docs:check`和`git diff --check`通过。上述测试使用隔离测试环境，其中resume事务测试替代了后续ingress runner，未调用真实LLM；没有新模型请求、官方世界、候选或凭据副本。它们验证共享输入与数据合同，**不是模型可靠纠错或完整端到端业务验收**。
- 复核结论：已经移除一个会压制新反证的输入冲突，仍未打通活跃repair中新反证跨责任节点改变正式范围的完整链路。下一步应以本地隔离的真实公共API/持久化事实构造“旧accepted A、当前open B、修B时出现A反证”的最小机制场景，检查Message、读证据、合法决定和ledger的实际可达性。逐个明确失败的公共合同，再决定是否需要变更现有单一契约；不再仅改提示词，也不以虚假终态获取resume。该本地协议验证不是新官方世界或模型实验。

## G5预登记：活跃返工证据与修订边界的本地公共API检查

- 已读新调用事实：`EngineService.readMissionTaskArtifact`和Panel query/read都调用`requireMissionArtifactSourceAuthority`，后者在校验项目与所属Mission后额外要求Task终态；同一函数还服务正式跨Task导入。活跃自有Task的只读监督和终态产物移交目前共用该限制。不能只改一个低层predicate而放开导入/完成验收；必须先分别测量读、移交、修订三个契约。
- 新增聚焦测试`packages/opencorvus/test/mission-active-repair-boundary.test.ts`，使用仓库隔离测试runtime和真实`EngineService.createTask`、`terminalTask`、Artifact publish/read、`resumeMissionTask`，不直接写Task/ledger/Protocol表。初始测试故障是明确的初始化B失败，A为已有可读输入证据；故criteria使用合法`task_initialization`归属，**不冒充跨worker dispatch实验**。原生API创建Mission所属Task，首次真实失败终态仅是预登记测试前提；之后绝不以假complete/fail获取修订入口。
- 原始测试输入与反证JSON明确标为`local_protocol_test`，全部在独立临时数据库，不进入旧运行。Mission通过现有真实wake原语打开；测试hook只替代后续LLM执行，Task ingress同样不进入Provider。不会捏造assistant消息或声称已执行worker→Task协调/真实模型Tool选择。当前先验证最早公共边界；若该处失败，完整参与者闭环仍未验收，已有通信源码审计不能补作运行证明。
- 精确步骤与预测：初始终态时Mission按实际locator完整读取A/B→首次resume写accepted A/open B及epoch2→原Task新Artifact记录A反证→Mission读取该不可变Artifact若因active被拒，得到精确错误→以A stale_evidence/B新证据提交另一次resume，若因active被拒，得到`MissionTaskResumeLifecycleConflictError`及currentLifecycle=active。旧Tool调用精确重放仍返回原receipt，新证据仍在同Task catalog，旧ledger/epoch保持真实原状态。取消仅用于测试最终收尾，核对取消权限回复，不能把取消当业务修复。
- 竞争解释：若原Artifact连终态都读不了，先修测试输入/身份问题，不能归因active限制；若active读取可行，则推翻该读路径假设；若当前API能提交active修订，则沿已有路径继续，不能预设新API；若二者被确切拒绝，记录机制不可达的具体边界，而非宣称LLM弱或以更多prompt补齐。
- 本检查不引入新的模型、官方世界、候选、凭据或生产权限。其结果只能证明公共服务层和持久化合同，不能叫完整真实LLM Checker或效果改善。后续修复前还需横审Panel read-reference绑定、跨Task导入、完成证据归属和活跃epoch并发；保持单一生命周期和ledger，不将读取权限与语义接受混为一谈。

### G5实际结果：两个公共边界均阻断，消息到达不等于可复核或可返工

| 真实本地服务调用 | 结果 |
| --- | --- |
| `EngineService.createTask`以已打开的Mission为owner创建原生Task | 真实Task/root/归属由生产代码建立，未直接写表 |
| 测试初始化失败后Mission读取A来源、A原验收材料、B缺口 | 三份原Artifact均complete，项目/所属Mission与定位正确 |
| 首次`resumeMissionTask` | active epoch2，单一ledger revision1，A accepted/B open |
| 新A反证发布，原Task用自身catalog读取 | complete且JSON为预登记的corrected输入；证据并未丢失或不可读取 |
| 所属Mission调用`readMissionTaskArtifact`读同一locator | 精确拒绝`Cross-Task Artifact source <taskID> is not terminal` |
| 以保留原resolution、新invalidating证据构造合法stale A，尝试新resume调用 | 精确`MissionTaskResumeLifecycleConflictError`，currentLifecycle=active；因Mission读被拒，测试没有伪造该新Artifact的完整Mission读取凭证 |
| 精确重放最初的resume调用 | 返回同一receipt/Message，Task仍epoch2、原ledger不变；重放不是正式扩大范围 |
| 公共`cancelTask`测试收尾 | cancelled epoch2。没有用取消或假complete/fail获取第二次业务修订 |

- `bun run test test/mission-active-repair-boundary.test.ts`最终1项通过、13个正向断言。两次先期测试构造错误也保留在开发过程说明中：首次将真实reader的`chunk`误认为顶层输出；第二次把同一A来源用于observation和resolution，违反当前role唯一性。已按真实接口修正前者，并用明确不同的A原始来源和原验收材料作为后者的合法测试前提；没有改生产返回值/约束来使测试通过。不是新的业务世界重试或取最好分。
- 这是公共服务层的确定性复现，进一步限定“已有反馈”含义：真实scheduler消息通道存在，并不提供活跃Artifact读取权或active ledger修订。当前Panel query/read还要求本Turn已观察的terminal reference，并在分页/read前后复验；这解释了为何不能只移除底层`isTaskTerminal`检查。
- 本测试没有构造assistant Message、worker模型输出或Tool结果。Native API调用标识和materialize的read-reference映射由明确的测试driver提供；它们不冒充Panel生成的Host读取凭证。Task/Mission后续模型loop被测试hook替代，故worker→Task协调、Task→Mission真实Tool请求及自主选择仍只完成源码审计，**未完成运行验收**。测试场景使用初始化归属，跨worker节点纠正也未运行。不能把本结果说成完整自主纠错链已覆盖。
- 下一设计必须把三个不同权威分开但沿用唯一事实源：所属Mission对不可变Artifact的活动监督读取；对当前终态的正式接受/跨Task移交；对当前repair范围的证据驱动修订。先核对`tool/panel.ts`的query/read/完成/恢复消费者、`agent/artifact-read-facts.ts`的locator与读取引用绑定、`engine/cross-task-artifact-import.ts`的正式移交约束，再确定最小变更。不可直接放开全部导入或让active读取自动成为Mission完成依据，也不能新增另一份可变状态来跳过当前epoch/CAS校验。
- 本轮尚未改生产读取、修订或权限。G4输入冲突已修，但G5证明正式活跃纠错仍有确定性协议缺口；Cycle3未经过该返工路径，其0分仍不能归因于此。H-E独立预期形成与进化选择的其它边界继续保留，不能让这项协议发现替代总体业务目标。
- 交付复核：新测试1通过/13断言，`bun run typecheck`、根`bun run docs:check`、`git diff --check`通过；隔离Task通过公共取消收尾，测试runtime按现有fixture清理。模型调用、官方样本与候选数量均未增加。

## G6实施前方案：活动观察与终态验收使用同一Artifact，不混同权限

- 影响面已定位：`task-review-facts`只从已完成query_task输出取terminal引用；Panel catalog分页、locator解析、read前后检查与read凭证均绑定它；`artifact-provenance-facts`还用这些真实read引用供Mission complete/block/resume。正式跨Task导入使用`requireMissionArtifactSourceAuthority`。因此本次实现仅打通**既有所属Task的只读监督**，不修改active ledger、不新增Tool/角色/grant，不把终态移交约束一起移除。
- 单一观察契约：终态观察继续携带精确`terminal_lifecycle_reference`；活动观察明确为该字段null并携带`active_execution_reference={openedEventID,executionEpoch}`，引用原Protocol lifecycle事实。两个互斥变体是当前不同生命周期的真实观察，不是新旧协议fallback。终态现有事实原样有效；活动观察不能伪造terminal ID。共享schema/投影/等价检查验证查询、分页和read前后同一发生轮次，取消或重新打开导致引用变化时明确要求重新查询。cancelling仍属于尚未终结的同一执行轮次，只读观察不批准新工作。
- 数据流：query_task输出活动引用→同一物理Turn的query_task_artifacts使用该已读引用→现有catalog返回同一观察绑定的locator→原read_task_artifact产生带明确观察种类的Host读取引用。所属Mission/项目检查仍在服务端；跨Task导入、complete/block、resume、Message/dispatch终态reader继续要求真实终态。不会增加另一份状态表、复制Artifact或使用新消息通道。
- 验收消费：活动读取证明的只有不可变字节已读，不是Task完成。终态read-ref解析及正式Mission验收仍只接受对应当前terminal的真实读取；防止用活动阶段的完整读取补齐终态阶段的部分读取，再以一个terminal片段冒充完整终态复核。既有Artifact事实聚合增加明确的终态过滤参数供终态动作使用，普通来源读取仍以原immutable locator判断完整性。
- 预测与测试：G5中的活动Mission读取应变成complete且原内容相同；正式导入仍返回其精确终态权限错误；active resume仍返回精确生命周期错误，不能声称整个H-R已完成。新增观察schema/轮次变化正向合同，沿已有Panel与provenance测试证明活动引用可读、终态接受不混用活动凭证，旧终态接受与重开检查保持有效。共享生产服务与Tool代码是真实被测路径，脚本fixture不是LLM自主行为；本阶段不启动模型/官方世界。
- 横向边界：独立Task读取不新增Mission权限；Mission只读自有Task；初始/重开active epoch由原lifecycle计算；所有项目隔离仍使用现有ownership与catalog authority；每次分块前后复验并在重启后从持久化Tool事实恢复。没有调度、队列、终态写入或在途worker失效策略变更。本次仅改变观察输入，正式活跃返工范围更新仍需单独设计，不能让此局部修复代替独立判断和业务纠错。
- 实施复核补充：旧`panelTaskArtifactPage`按页码每次从第一页重新搜索，依赖终态目录稳定。开放active后该做法会在新Artifact进入排序前部时产生页漂移。必须同步替换为现有Artifact catalog的签名cursor续页，保留页码作返回顺序；Mission续页还须绑定当前Turn上一页的真实`next_cursor`、下一页码及同一生命周期观察。移除从第一页重算的旧实现，不另存分页状态、不保留无cursor的旧续页fallback。Native catalog自身仍验证查询过滤、Task和快照签名；首次page1不带cursor，page>1必须提交Host返回的cursor。
- 批量输出契约核对：`artifactSearchBatch`已将cursor/page continuation统一写到`next_queries`并按`request_index`关联结果，本次消费这一单一事实，不在单页再复制续页字段。原Panel callback没有传递批量分配的字节额度，可能在多查询时重复生成同样超额页面；本次分页替换同时把该额度交给现有`boundedArtifactPage`，验证同一批次多查询的实际返回、剩余项和续页。

### G6实施与验证 checkpoint

- 已实现单一`task-artifact-observation`契约，从现有Task lifecycle读取opened event/epoch或terminal event，不新增状态表。`query_task`、catalog页、locator解析与read输出共同使用它。所属Mission对active Task的不可变Artifact可真实读取；原终态移交检查单独保留。模型可见Tool说明与当前`07-panel`、`task-control-plane`架构同步更新，无新Tool/角色/执行权限、无UI改动。
- 分页改为消费既有签名cursor及批量`next_queries`。在同一活动Task第一页返回后新增第34份Artifact，第二页仍完成原33份目录，原ID集合完全一致；新查询返回34份。两查询同批次实际返回各自1/34个匹配总量、合法后续cursor并满足共享输出上限。旧从第一页重算路径已删除，不增加游标账本。初次实现错误地从单页取续页字段，生产批量路径准确拒绝；现已按原`request_index`关联`next_queries`修正，没有增加双份续页字段。

| 检查路径 | 实际结果 | 证据层级 |
| --- | --- | --- |
| 原G5服务层场景，A accepted/B open、epoch2中发布A反证 | 原Task与所属Mission均complete读取同一不可变内容；其它Mission得到归属错误 | 真实EngineService/Artifact/本地数据库，后续模型loop被测试hook替代 |
| 当前活动读取与正式动作 | 正式跨Task移交/complete仍得到当前非终态错误；active resume仍为`MissionTaskResumeLifecycleConflictError`；精确重放仍返回原receipt | 服务层及Panel真实Tool实现；不代表活跃ledger已能修订 |
| 活动与终态读取聚合 | 活动完整读取可作普通来源证据；terminal partial读取不能借活动字节补全，得到精确完整读取错误；活动read-ref用于完成得到错误终态归属 | 明确标注的Tool事实fixture，真实provenance reducer；不是模型产出 |
| Panel query→catalog→read | 实际Tool生成active epoch引用、catalog locator与完整read-ref；终态/重开后旧引用得到轮次变化错误 | 脚本化Session/Tool请求fixture，执行真实生产Tool并持久化实际输出；不是自主Tool选择或LLM端到端 |
| 原终态完成路径 | 当前终态分块证据跨Mission inputs保留并完成原有验收，operator/scheduled新输入仍打开新的受限Mission acceptance | 现有隔离本地合同保持通过 |

- 最终聚焦命令：`bun run test test/panel-mission-terminal-authority.test.ts test/artifact-read-facts-provider-input.test.ts test/mission-active-repair-boundary.test.ts`：**11项通过、0失败、85个明确断言**。`bun run typecheck`、根`bun run docs:check`（342 ops/25 groups）、`git diff --check`通过。首次测试driver把后续依赖调用放在同一Provider step内，真实事实作用域正确阻止消费；已将每个依赖调用安排到下一明确step，没有放宽生产的物理Turn/step边界。反证读取fixture的格式、引用长度与EOF标记错误也按现有契约修正，没有降低reader校验。
- 所有新运行都是隔离本地协议测试，无Provider请求、官方世界、作者或候选。原Cycle3四个PID仍已退出；不重启任何历史实验。服务测试以公共cancel收尾，临时runtime由既有fixture清理。尚未执行真实worker→Task→Mission的反证上报、自主范围修订和业务再验收；也未进行真实进程重启的模型链验证。
- 下一未闭合边界明确为：**已经读到新反证，但正在active repair的单一ledger如何合法改变范围**。继续横审当前ledger append、criterion选择、dispatch descriptor/checkpoint、Task/Mission的真实coordination与所有生命周期入口。先落盘一个最小契约，明确语义责任、当前epoch/ledger比较并交换（CAS）、在途worker旧引用、串并行/多项目/取消/恢复；不得用假complete/fail得到resume，不得直接放开active修改而忽略在途工作。当前不再重复验证已修读取拒绝，不急于新官方样本或H-E作者；G6仍不能认领从未Mission resume的Cycle3金额误验收根因，业务可靠纠错和进化收益尚未达成。

## G7实施前：多义务修订中的保持规则与活动期边界

### 共享机制横审的新事实

| 边界 | 真实定义和调用 | 对活动期修订的约束 |
| --- | --- | --- |
| 唯一ledger写入 | `acceptance-ledger::appendTaskAcceptanceLedgerRevisionInTransaction`核对当前Artifact比较并交换、active epoch、责任与证据连续性；唯一生产caller仍为`resumeMissionTask` | 内部可写active不提供公开权限；不得直接暴露此函数绕开Mission输入、原子Message/ingress和归属 |
| 原子恢复与重复调用 | `resumeMissionTask`在Task-root ingress owner内同事务记录真实Mission Message、epoch open、ledger、ingress、receipt，提交后才调reconciler；精确Tool重放返回旧receipt | 取消权不变化；新active契约必须留在同epoch且有自己的确切调用事实，不能伪resume或隐式重开 |
| 正式范围和在途输入 | `createOrchestratorTools`构造时读取当前repair，dispatch校验并生成不可变Turn；`runner`读descriptor引用的特定ledger并检查gap/epoch，checkpoint按revision隔离 | 直接后台改latest会让已构造root工具和在途worker仍持原revision。历史输入不能重写；必须区分保留有效子集与需要新决定的变化，不能仅新增一个API |
| 根Session与worker恢复 | Task-root仅在missionAcceptanceResume事件消费对应ledger checkpoint；worker continuation消费指定revision checkpoint。重启使用持久化descriptor/ingress/attempt | 单独新增Artifact无法确保新义务被实际输入。真实Mission消息、root接收和后续选择须同一因果链；不可合成消息或只更新latest投影 |
| 完成/失败/取消 | lifecycle Tools沿Task execution与completion closure/dispatch settled事实结算；当前完成契约不以ledger全部accepted为Host gate | 不能用Host替模型判断；修订与结算竞争应按原epoch/输入发生轮次串行，而非加业务成功锁或丢弃已请求副作用 |
| 消息与多项目 | scheduler_message从真实source Part读取正文并以项目/endpoint/occurrence持久化request/reply；coordination保留原dispatch与归属 | 消息传递不等于授权已写ledger。新契约只能使用原Task/Mission/Session单一事实源，不能在通知回调偷偷修改状态 |

### 已定位的共同数据合同缺陷与本次实现范围

- `requireOpenTransition`目前对**每一个**open→open项要求新增证据或新repair action；`requireCriterionStateContinuity`又要求保留所有旧项。因此重开accepted A时，即便有明确新反证，也无法原样携带未受影响的open B。旧测试在此场景给B人为改变actionSequence才通过，掩盖了无须修改B的真实输入。这是多义务修订的共同表达缺口，独立于是否开放active API；现有终态resume也会遇到它。
- 单一修复预测：有依据的A变化或新增C可以与**完全相同**的open B共存；B若被改写仍须按原规则提供新证据或新修复动作。整份revision若所有criteria都不变，改gap名、改reviewed terminal或调整数组顺序也不能制造新修订。accepted/blocked保持、证据role保留、责任、CAS和epoch检查维持原合同。这里比较的只是声明是否改变及引用结构，不替Agent判业务真假。
- 实施只改现有ledger transition reducer：精确相同的open项可以携带；变化的open项继续原校验；完成所有项校验后要求至少一个新增或有合法变化的criterion。不新增schema、API、Tool、ledger、权限、消息或生命周期路径。它是活动范围方案的必要条件，**不是整个活动期修订已完成**。
- 先在现有delta测试写正向“只修A、保留B”的输出与“全复制/仅改文字”的精确错误，再运行修前失败；同时将G5/G6既有本地服务场景的B改为真正原样保留，在已经通过公共resume建立的隔离Task上直接调用真实ledger事务检查append、旧revision保留及CAS拒绝。该直接domain调用明确是测试driver，不冒充新的公开active权限，不伪造Task终态或模型Message。公共active resume的原拒绝仍保留，公共cancel收尾。

### 活动期单一契约设计的当前约束（尚未实现）

- 最小候选是同一Mission对现有repair的**证据驱动增量修订**，保留同一Task epoch、唯一ledger与现有owner。Mission判断哪些旧accepted项被新证据推翻，Host只校验身份、观察轮次、引用完整性和结构连续性。新revision与真实Mission输入必须原子发布，Task-root在原输入串行边界接收并重新投影工具/检查点，不能在当前Provider步骤背后换范围。
- 首先须证明是否可在原root ingress owner边界发布并由现有reconciler可靠接收；同时规定旧在途dispatch仅继续它仍有效的原criterion子集，新范围只由新revision派发。若改动了正在执行项的原授权，必须走真实协调/停工回执再形成下一合法dispatch，不能篡改descriptor、伪造完成或把取消当成功。尚需从真实owner/queue代码和隔离合同证明这一时序；未将该草案当已证实现，也未新增active控制入口。
- 下一公共端到端局部Checker应覆盖Mission真实Tool请求→root持久化输入→当前revision选择→worker归属及重启恢复，区分已接受修订、旧epoch/旧CAS拒绝、取消/完成竞态与无进展请求。当前不启动模型或官方世界；局部协议可达后，真实Luna行为仍须另行预登记。

### G7实施结果及被否定的时序假设

- 共同reducer已允许原样携带open项，同时把“必须有进展”绑定到整份criterion集合；变化的open项仍必须有新证据或新action，责任和证据角色保持不变。Mission core的原“Repeat an open criterion only…”也同步替换为准确的当前契约，避免代码允许保留B而实际指令仍强迫改B；不是追加业务核验提醒。没有修改已发布的`.13`包或历史prompt字节。
- 修前delta测试3项失败：有依据重开A但B不变、A有新证据/B不变、全重复修订的新精确错误；隔离服务场景中的真实ledger append也以`Repeated criterion B`失败。修后`bun run test test/mission-acceptance-delta.test.ts test/mission-active-repair-boundary.test.ts`为**20通过、0失败、70断言**。其中实际domain writer在公共resume创建的epoch2追加revision2，A stale/open、B完整原样，原revision1仍可读；过期CAS和仅改gap名均得到精确错误，latest仍revision2，最终公共cancel结算epoch2。
- 域事务直接调用明确是测试driver，不是新的公开active入口、Mission自主选择或LLM端到端。公共active resume仍拒绝，Task不伪造终态/重开；原Message/Tool/世界不动。测试后的runtime由既有fixture清理，无新Provider请求/凭据/模型成本。package typecheck通过；当前架构同步记录修订集合规则。没有以一个函数测试通过宣称活动纠错完成。
- 新全仓调用事实否定了前述草案的一项隐含前提：`SessionPromptState.runTaskRootIngress`的生产caller只有`resumeMissionTask`。其实现是process-local的root键Promise链，并非所有Task-root Provider/Tool步骤的统一执行租约。**不能仅套用这个函数就宣称active修订与在途root/complete互斥**。当前终态resume额外有准确terminal前提，所以该缺口不等于已有resume发生竞态；它是新增active方案必须解决的条件。此前“root ingress owner内写入”只描述实际resume调用，不能扩成所有执行的全局锁。
- 下一实现前必须核对真正的Task-root ingress admission/activation lease、SessionLoop和Task completion closure之间的边界，选择同一持久化输入发生轮次来接收修订并重新建立工具投影。未经这一步，禁止直接发布active API、更新latest后只发通知，或取消worker来掩盖陈旧输入。重点是**接收Mission原始修订意图**与**在正确root执行边界生效为唯一ledger**的区别；若需要已接受但尚未应用的输入，应复用现有ingress事实而非第二份ledger。串并行/跨进程/重启/取消的证据尚未完成，继续本地推进。

## G8实施前：真实激活时丢失Mission resume事件

- 沿真正的执行边界发现更早的确定性缺口：`persistMissionAcceptanceResumeIngressInTransaction`传入结构化`missionAcceptanceResume`，但`sourceForEvent`在有Message ID时只存`source=message`。`eventForIngress`恢复所有Message来源时统一返回`rootMessage`，没有从同事务的`mission_acceptance_resume_receipt`重建专门事件。因此原始可见repair文字和ledger仍存在，**typed resume身份却在持久化→激活之间丢失**，`orchestrator/agent.ts`依赖`event.missionAcceptanceResume`的root checkpoint、专门授权及wake notice分支无法由这条真实路径进入。旧provenance测试手工构造typed event，只验证后半段；G5/G6的runner hook又没有检查实际event，故未覆盖这个边界。
- 全仓审计：typed event用于actor当前输入、checkpoint、interaction/root-message授权与worker调度上下文；唯一writer是公共resume事务。普通operator/Mission消息、schedulerDelivery、协调Artifact、生命周期Protocol event和inline事件各有原authority，不应统统改路由。激活真实串行权威是`acquireTaskRootIngressLease`的数据库事务：project admission、当前epoch、FIFO先行输入和唯一control lease；`activate`在取得租约前从不可变源恢复event，再交给原runner。正常扫描、重启和post-Turn都使用同一loader。completion closure为独立Task/epoch租约，不能替代输入恢复或当活动修订全局锁。
- 本次单一修复方案：保持Message为唯一可见participant输入，以原同事务resume receipt为该Message的typed控制身份来源，按准确Task/ingress/Message关联还原事件。提取现有receipt schema及查询到一个共享模块供writer/replay与loader共同消费，删除Task API私有重复schema/查询；不另存inline payload或复制新ledger。验证receipt、原Message的Task/作者/Session、原ledger/gap/epoch与reviewed terminal一致；缺失/错配为明确ingress integrity错误，不能退回普通消息。这里只识别结构化协议身份，不用业务关键词路由，不改Agent决定。
- 预测与Checker：在既有隔离公共create/resume场景，用测试hook只接收实际reconciler传给runner的event（不伪造模型输出），断言真实恢复得到原mission/Tool/Message/ledger/gap身份及原专门wake投影；修前应实际得到rootMessage并失败。再覆盖同一持久化输入重读、普通Mission消息和终态/epoch边界的现有合同。该验证仍无Provider、无官方世界，不能冒称已执行LLM checkpoint/自主纠错。先补通现有终态resume的数据链，不基于断链另起active入口。

### G8实施与验证 checkpoint

- 公共`resumeMissionTask`经过原后台reconciler实际激活后的hook输入，在修前确为普通`rootMessage: {kind: mission, messageID}`；新增断言失败，原ledger/gap文字并未消失。修后得到完整`missionAcceptanceResume`，包含原Mission、Panel/Tool、Message、ledger与原gap身份，真实wake renderer可输出准确revision。没有把手写typed event作为这项修复的主要证据。
- 新共享`mission/acceptance-resume-receipt.ts`承接原唯一receipt schema和Task/Tool查询，并新增同一事实的Task/ingress查询；Task API私有schema/reader已删除。查询精确检测歧义与非法payload。Message loader只对真实mission provenance的resume来源按原receipt还原typed event，验证原ledger的gap/epoch和Message/Task归属；普通Mission或operator/scheduler消息保持自身输入类型。不增加inline副本、第二ledger、状态机或模型消息。
- source恢复在lease获取前进入现有evidence reader，已知结构完整性错误投影为原ingress fault；不依赖事后通知来修补typed身份。即使测试driver后来在同epoch追加r2，按原ingress和按原Tool查询仍返回同一receipt、原r1/gap，而非偷偷选latest。当前actual runner的检查点分支所需typed输入已恢复；测试hook替代了LLM执行，因此**没有证明模型执行了压缩检查点或自主纠错**。
- 聚焦验证：`mission-active-repair-boundary.test.ts`3通过/36断言；`orchestrator-mission-resume-provenance.test.ts`2通过/32断言；`task-control-reconciliation.test.ts`12通过/49断言；`scheduler-task-root-message-schema.test.ts`8通过/106断言。合计**25项、223断言，全部通过**。覆盖实际resume交接、原分块事件投影、Question/错误归属、FIFO、失联assistant的并发恢复、终态后的原活动结算，以及多项目scheduler、Mission关闭重开和Project取消。各测试为明确隔离fixture/生产函数合同，不把这些局部证据称完整真实LLM或操作系统进程重启验收。
- package typecheck、根docs:check（342 ops/25 groups）、diff检查通过。无新增模型请求/官方世界/候选/凭据副本，无历史数据改写；本地服务场景仍公共cancel收尾。G8修复的是现有终态resume→实际root输入的共同链路，不是Cycle3从未发生的Mission resume，也不能认领其金额错误修复。
- 活动修订下一步仍在原五段机制之内：真正可用串行边界已定位为`task-root-fact-store::acquireTaskRootIngressLease`的数据库事务，它检查项目admission、同epoch和FIFO先行输入后获取当前control lease；原Promise链不是它的替代。先以隔离并发Checker验证新的修订输入在旧root运行时仅被接收、取得真实租约后才应用并重建工具/检查点；先行完成/取消或CAS变化须产生明确结算，而非重开Task/替换历史。旧worker descriptor保持不可变，需要改其授权时必须有真实coordination回执。公开入口与应用事务尚未实施，禁止把现在可恢复typed resume说成active范围修订已完成，也不立即重跑benchmark。

## G9实施前：当前输入结算与Task返工义务不能混同

- 为租约顺序Checker核对真实decision生产者时发现：`createOrchestratorTools`不分当前输入来源，将`activeAcceptanceGapID`传给`createNoActionTool`；后者只因gap存在便拒绝全部no_action。它没有读取当前输入是否状态询问、是否已有worker或后续输入负责返工。这是Host用业务状态代替Agent选择流程的硬禁令，违反本仓库职责边界。未完成gap确实不能算完成，但这不等于每个后续输入都必须派工或终结Task。
- 影响面为全部具有Mission acceptance ledger的Task-root输入：原repair、worker/lifecycle/scheduler通知、operator状态询问和恢复。`no_action`的真实输出只结算当前ingress并park该Turn，没有Task终态、ledger或未来wake写入；durable reducer按原Tool事实释放FIFO。原精确`observed_task`一致性检查属于合法数据校验，保留。不会新增另一套“允许no_action的输入类型”Host白名单或自动替模型选工具。
- 单一修复：删除`activeAcceptanceGapID`参数及无条件拒绝，现有工具说明明确返工义务仍有效、receipt只结算当前输入。Agent仍必须对已知未满足目标采取真实行动或交给已存在的独立执行，不能以no_action宣称业务完成。语义误判要由真实验收发现，不用Host gate遮盖。现有dispatch/criterion选择、ledger/lifecycle和全部权限保持不变。
- 预测：公共resume建立的真实A accepted/B open Task中，脚本化状态询问输入调用实际精确no_action工具，返回当前epoch观察和park收据；Task仍active、ledger完全相同。修前精确拒绝，修后成功。此为明确测试driver的Tool请求，不是假模型自主决策，返回值必须由真实生产Tool产生。
- 新租约顺序Checker使用公共createTask/handleTaskMessage接收两个独立状态输入，实际reconciler进入被测试hook替代的runner；第一输入由barrier持有，第二输入已持久化时由真实acquire返回blockedByIngressID。释放后用明确脚本请求调用实际no_action，持久化**真实返回值**，原reducer释放FIFO并激活后续输入。仅Session/Tool请求使用显式fixture；不直接写Task/Protocol/ledger表，不手写“decision committed”输出，也不称LLM端到端。公共cancel仅作最终清理，不用于取得resume。
- 这次Checker证明已有输入串行边界，不能把普通operator输入当已实现的Mission amendment。公开active修订及其CAS应用/完成竞态结算仍需在该边界上实现；当前不新增模型/世界或用旧分数宣称改善。

### G9实施与租约边界验证 checkpoint

- 已删除`createNoActionTool.activeAcceptanceGapID`和唯一caller的传参/全局拒绝分支；保留精确当前epoch、opened/terminal事件、status校验与原exclusive/park控制。工具与架构明确只结算当前输入，ledger/Task义务不变。没有用输入关键词或来源类型白名单重新建一个Host gate。现有Mission repair的业务指令继续要求真实纠错或有证据的结算，并没有把未完成工作改成成功。
- 公共resume产生的真实active/epoch2、A accepted/B open，在修前调用实际no_action工具得到`Acceptance gap ... no_action cannot settle it`；修后返回真实观察收据，Task仍active、ledger完整相同。新输入的具体语义由明确测试请求给定，不声称模型自主选择正确。
- 新`task-root-input-lease-boundary.test.ts`通过公共createTask与handleTaskMessage生成真实Task及两个输入；第一输入实际取得lease并由barrier持有时，第二输入的API立即返回accepted且已持久化。直接调用原lease writer作为竞争测试driver得到`acquired=false/blockedByIngressID=first/projection=ready`。释放第一输入后，脚本请求调用真实no_action实现并持久化实际返回值，两个原ingress按序成为resolved，Task保持active epoch1，最后仅公共cancel清理为cancelled epoch1。没有直接写Task/lifecycle/ledger表或手写Tool成功结果。
- 该测试使用显式Session/Tool请求fixture驱动真实代码，不是Provider输出或业务checker；竞争driver的liveness callback是测试输入，只验证FIFO拒绝路径，不能宣称已取得真实跨进程owner。当前尚未把Mission amendment写入这些输入，也未验证请求应用/CAS业务结算。首次运行因为将可复用API返回对象直接交给Bun非对称matcher，后续读到`ExpectAny`而失败；已对断言使用独立标量快照，未改生产租约代码。
- 聚焦结果：`mission-active-repair-boundary`3通过/38断言，`task-root-input-lease-boundary`1通过/7断言，`no-action-tool`1通过/8断言；合计**5通过、53断言**。package typecheck通过。没有新模型请求、凭据、官方世界、候选或旧数据修改，隔离Task均公共收尾。
- 仍未交付的核心是active Mission修订的合法生效，不是再次证明FIFO或另跑低分案例。下一方案必须明确请求接收与应用两类事实，以及先行完成/取消、ledger CAS失配的真实结果；不能将普通no_action结算当修改ledger。已有输入串行链可以复用，业务语义决定继续属于Agent。需要运行中改变worker授权时必须有实际协调回执，不能在它未接收新输入时把latest revision当已遵守。业务自主纠错/收益均仍未验证。

## G10实施前：同一执行轮次中的追加返工义务

- Recall：用户授权继续全局机制修复，要求推进真实可用的active修订，不再用局部通过冒充业务根治。本次只本地协议实现与明确fixture驱动的生产检查；无Provider/官方世界/作者/候选，全部历史只读。已读G6–G9、handoff设计、ledger、Task API、Panel读取凭证、durable ingress source/delivery/reducer/fact-store/disposition、root/worker检查点与终态工具。当前唯一ledger仍为`task_acceptance_ledger`。
- 现象与根因：所属Mission已能读active反证，但现有resume只授权真实终态开启下一epoch；后台修改latest会绕过当前root输入及已固定的worker descriptor。Promise链不是执行租约，G9已证明真正FIFO租约边界。此前修复分别解决观察、集合表达、typed恢复及输入结算，均没有提供活动请求的合法生效路径。
- 单一最小契约命名为“追加返工义务”：保持Task epoch，保留所有既有open项的完整授权；允许有新反证的accepted项重新open/stale及新增open项，且至少新增一个open义务。任意修改/撤销现有open授权不属于此操作，仍须真实协调和执行结算。这样旧worker的不可变descriptor仍只拥有原有效子集；不会以latest代替它实际收到的输入。
- Mission原始请求、当前active观察、精确base ledger与完整read evidence经现有Panel/公共服务进入真实Mission Message和原durable ingress；接收回执明确pending，不称应用成功。请求是不可变输入，非第二ledger。取得原root lease后，在同一数据库事务中检查epoch/CAS并追加唯一ledger；Task不终结、不重开。应用结果保留可读原请求/结果关联。精确Tool重放沿同一请求，不再次写入。
- 排队中旧CAS是正常结构冲突：必须产生明确的不可变拒绝结果并释放该输入的FIFO位置，不能伪造assistant决定、host_fault或业务失败。先行完成/取消/新epoch沿现有terminal_inapplicable边界，不能偷偷复活。来源损坏仍为原integrity故障。成功应用后从请求和指定ledger重建typed输入、当前工具及checkpoint；当前在途root不会看到后台变化。
- 横向影响：Task/Mission归属、Project admission及取消仍由原事实核验；正常/恢复扫描使用同一lease和loader；同项目不同Task以及跨项目无共享范围；独立Session和普通operator/scheduler消息不新增权限。formal导入/complete/block/resume继续要求准确终态。现有root completion closure不是输入租约，须验证先行终态使队列请求不适用。无UI或外部执行工具权限变化。
- 可证伪预测与Checker：公共resume建立epoch2、A accepted/B open；真实root lease持有期间Mission提交A反证追加请求，立即持久化但ledger仍r1；旧输入以真实Tool结果结算后请求在原lease边界应用r2，A stale/open、B完全原样、epoch2，并进入实际runner typed输入。同base第二请求明确CAS拒绝；重放保持同请求/r2；先行取消明确不适用；旧descriptor引用仍读原revision。使用隔离runtime/真实公共API与生产Tool返回，模型loop显式hook替代，不能宣称LLM自主纠错。必要新错误合同、恢复及多项目检查按实际影响覆盖。
- 竞争解释与交付限制：这项修复只证明读到反证后的授权与输入可达性，不证明Agent会推导正确公式、提出有效反证或修好Cycle3；Cycle3从未Mission resume。若实现发现租约不能提供所需原子性，应更正此方案而不是加Host语义流程门；本地合同通过后仍需另行预登记真实行为验证。

### G10实施与公共Tool链验证 checkpoint

- 新增Mission专属`panel_extend_task_acceptance`及公共`EngineService.extendMissionTaskAcceptance`。复用原query/catalog/read、同一gap materializer、真实Mission Message与durable ingress；active read-ref按精确观察聚合完整字节，原terminal消费也改用同一观察解析函数，未保留并行reader。原`resume_task`仍只处理completed/failed。模型可见声明、Mission core、当前Panel与Task-control架构已同步；无外部执行工具或角色扩权。
- 接收事务只发布不可变request和真实输入，返回pending。原`acquireTaskRootIngressLease`成功取得唯一当前租约的事务内验证epoch、opened event、base ledger和scope growth，追加原单一ledger并记录不可变outcome。新模块再次核对准确live lease。允许新增open项或用新反证重开accepted；既有open项须完整相同，其在途descriptor与授权不变。任意撤销/改写正在执行的open项不在此能力范围内，仍需真实协调及结算。
- CAS失配产生`ledger_conflict`拒绝outcome，原reducer投影`input_rejected`；数据库disposition合同要求其指向同Task/ingress的真实request/outcome。该输入随即释放FIFO并继续后继输入，不写assistant决定、Task failed或Host fault。先行完成/取消仍由原lifecycle使输入terminal_inapplicable。request/outcome有数据库不可变约束；重复与并发重复调用返回同一request，竞争事务自己的Message回滚，不重复应用。
- 正常激活及失联后恢复均从原request、Message与指定ledger恢复`missionAcceptanceExtension`；根Agent使用同一repair投影构造授权、工具和checkpoint，同时保留resume/extension的真实来源区别。原义务与账本保持Agent语义，不把结构检查当业务验收。request接收、账本应用、Agent实际消费、业务修正是不同事实，现有Artifact目录显示前两种事实，不宣称它们自动证明后两种。

| 本轮检查 | 实际结果 | 证明范围 |
| --- | --- | --- |
| 真正Panel query→catalog→逐份完整read→extend | Host实际生成active引用/read-ref和pending请求；未注入手写Tool成功输出 | 显式脚本化Mission Session/Tool请求，生产Tool执行，无Provider |
| root旧输入持lease时请求排队 | r1保持；原输入用实际no_action返回结算后，同epoch2应用r2，A stale/open、B原样 | 公共API、真实事务/租约/reconciler，root模型loop显式hook替代 |
| 同base第二请求、并发精确重放 | 同一重复request；旧CAS明确rejected，后续operator输入实际激活 | 冲突/replay/FIFO数据合同，不是业务失败 |
| 原请求篡改、异Mission、旧epoch、改写open B | 分别得到数据库不可变错误、归属错误、精确观察变化错误、范围保持错误 | 真实生产writer/API错误合同 |
| 应用后执行丢失再恢复 | 测试driver在第一次应用后的runner入口结束而不制造决定；有限租约后恢复第二次激活，仍同r2/原request | 失联模拟+实际恢复扫描；不是操作系统进程重启或真实LLM |
| 已排队请求遇先行completed/cancelled | application明确inapplicable；原r2保持，原ingress为对应closed/cancelled边界 | 两个独立隔离场景，完成为预登记本地生产terminal writer前提；取消为公共API |
| 原resume/worker/checkpoint/多项目控制路径 | 聚焦现有合同通过 | 泛化共享路径检查；没有运行真正worker反证上报或新的多项目模型实验 |

- 最终有效结果合计**55测试、397断言通过**：extension 2/50、Panel terminal authority 7/50、read facts 1/8、Mission root message 2/19、input lease 1/7、active repair 3/38、acceptance delta 17/38、resume provenance 2/32、control reconciliation 12/49、scheduler Task-root 8/106。package typecheck与docs:check（342 ops/25 groups）通过。触及的旧reader签名及旧文案断言已更新为当前合同，没有为旧测试保留兼容路径。
- 实施过程保留事实：首次registry顺序未与canonical action目录一致，立即在模块加载时失败；fixture先装Mission wake hook与已有open fixture重复，按原hook生命周期修正；旧terminal reader测试参数与旧resume文案断言因契约变化失败，已更新。恢复fixture最初只等待未决Promise，无法可靠维持隔离test host的定时器活性；改为在应用边界缩短测试租约并明确维持一个1700ms本地恢复观察窗口，不修改生产时间策略/预算。早期未完成的本地测试已精确停止；最后进程核对没有残余测试或历史实验。未把这些fixture错误说成模型/业务故障。
- 数据与部署边界：新disposition与不可变约束修改canonical DDL。本仓库pre-0.1.0既有策略会拒绝不匹配的旧数据库；本轮只在隔离新runtime验证，**未打开、迁移、重置任何用户或旧实验数据库**。新request/outcome是不可变输入及应用回执，只有`task_acceptance_ledger`是验收状态事实源。无UI改动；无Provider调用、凭据复制或费用、新官方分数、世界、作者或候选。
- 尚未达成：真实worker→Task→Mission反证上报、Agent选择扩展、真实worker在原Task中修复、复核与业务结算，以及自主进化收益。G10也不是Cycle3金额错误的已证修复。下一工作应从五段机制重新核对新能力解决了什么、仍需何种可区分解释的行为证据，再预登记必要的最小Luna验证；不要重复这55项当进展、继续堆提示或直接重启旧/40例benchmark。当前阶段不启动模型或官方世界。

## G11实施前：关系义务丢失与可证伪的输入观察

- Recall：按用户要求回到五段共同机制；本轮不启动模型/世界/作者/候选，不增加角色、业务gate或演算器。已读原始Cycle3两个verifier的`artifact_publish`完整输入、四次真实dispatch、原任务及Goal内容、当前`.13`三个角色与core、delegated-worker context/agent、continuation renderer/runner、fact-check schema、G3 handoff与原型反例，并全仓查相应调用。后续动作必须区分证据可达、实际输入、模型判断、业务效果。
- 新的具体观察：`prt_g0VWD4qjQ001d6Og7Htl`的首份review把`pricing`列为satisfied，同时account-size unresolved；`prt_g0VWD6ETd00e8wda3MsV`的最后review把项目改成`account_size`、`standard_pricing_basis`、`latest_pricing`、`opportunity`等各自satisfied。原Goal仍要求依据size/tier/current pricing确定pricing，最终Artifact完整列了各项来源与5000实际金额，却未提供金额与这些项之间的推导/比较。不能把“各输入存在且被读过”的合取当成“目标金额满足它们之间关系”。这是报告的可见语义变化；不能据报告缺公式断言模型内部从未计算。
- 原始约束中的关系仍保留在Mission assignment与Task Goal，未发现Host删掉这一金额关系。初始Task request是明确标注为Mission作者的assignment，并非逐字原operator全文；缺少某些原SYSTEM文字另列，不将其未经证据归为金额根因。现有core/角色早已要求独立推导和重算，当前运行中没有另一个自动执行的`llm_judge`。G10没有经过此普通continuation路径，不能据此认领修复。
- 因果未知：源文本/重算指令是否在出站请求的正确位置，先前解释是否造成锚定，以及新鲜上下文能否形成正确方法仍未分离。只读打开旧DB（SQLite mode=ro/query_only）确认`provider_activity_request`只有id/assistant_message_id/time；descriptor存system摘要而非完整请求体。源码重建、已持久化Message和最终自述均不能追认旧wire上下文。
- 本次最小实现针对这个观察缺口，复用现有`script/real-provider-audit.ts`的唯一fetch审计入口及隔离factorial host。默认仍只保留model/stream/status；显式提供一份预登记文本探针清单时，审计实际发送的JSON字串，记录探针ID、精确匹配的JSON pointer/UTF-8字节位置、片段长度与身份摘要及整份请求体身份摘要。**不保存prompt正文、请求头、URL认证信息或凭据**，也不把未匹配当调用失败/业务失败。所有匹配都只是已知片段的出站位置证据，不声称完整上下文已留存或远端模型理解了它。
- 探针文本只进入隔离审计器内存，不加入任何模型消息/工具或改变原请求。已知凭据由原CredentialRedactor统一核对，探针ID/正文若含该凭据则配置明确拒绝；输出只包含无正文的定位与身份资料。已有四个e2e及native plugin调用默认不启用；只给当前隔离host增加显式文件入口，保持模型/流式/成对目录/expiry及原request预算策略不变，不新增代理或第二日志事实源。摘要只证明本次不可变出站对象/片段身份，不作为业务正确性或代码验收门槛。
- 单一预测与局部Checker：用本地fetch接收器驱动同一实际包装器，含Unicode和重复片段的JSON请求应返回准确位置，并把原请求字节/stream/model送到接收器；Request对象与string body走同一观察函数。凭据命中应为明确配置错误，已消费清单后调用方改动清单不能改写注册对象；普通HTTP状态/原模型错误/过期复制凭据合同保持。无LLM、无外部连接，这只验证未来观察能力。
- 下一行为验证的判别问题固定为：在预先登记的原目标与原始来源下，独立方法是否形成；前次结论/窄化派单进入前后是否改变同一关系判断。H-E比较前方法Artifact仍只是待验证交接提案，错误方法和来源遗漏仍可穿透。不能用观察器、摘要、报告字段或更多API当纠错收益。本轮先交付可用观察能力与具体关系证据；真正Luna对照须另行锁定输入、唯一改动、生产入口、版本、目录及样本数，不能在未定义可区分预测时重跑旧案例。

### G11实施与验证 checkpoint

- 已在原`RealProviderAudit`增加显式注册的输入观察，默认不启用；factorial host以`AUTOMATIONBENCH_FACTORIAL_INPUT_PROBES`接收预登记JSON文件。复用原fetch包装、原redactor及原provider-audit记录，无第二代理、请求体日志、Role/Tool新增或模型输入改写。已注册定义按值固定，后续调用方修改数组不影响已登记片段；精确模型、流式、复制OAuth expiry和原请求余额合同不变。
- 每个观察记录只增加请求体身份/UTF-8长度、每个片段的身份/长度及精确JSON位置、解码后字符串的UTF-8偏移；保留最近的标准role字段及其位置，帮助区分同一文字在指令/消息/工具定义等不同位置。JSON pointer或role中已知凭据被原redactor遮盖；已知凭据出现在登记正文/ID时配置明确失败。它记录JSON结构事实，不把role字样或片段匹配自动变成语义权威，不以未匹配阻断请求。没有捕获完整wire上下文或追认旧请求。
- [关系证据与配置说明](../../artifacts/2026-09-25-acceptance-comparison-design/input-observation.md)列出了两份原verifier Artifact及两次真实返工的精确ID；[清单](../../artifacts/2026-09-25-acceptance-comparison-design/input-probes.json)中三个片段分别在原USER、`.13` verifier原文及原事件49中核对为一次出现。这只证明登记对象有来源，**不是本轮模型收到它们的证据**，清单不加入模型消息。Handoff历史段标记为G3快照，避免把G4–G10已经完成的API边界继续当当前缺陷。
- 聚焦`bun run test test/real-provider-audit.test.ts`为**9测试、31断言通过**。其中两个请求实际穿过原包装器并由随机端口的localhost HTTP接收器读取，证明原请求字节/stream/model与记录位置相符；分别覆盖string body、Request对象、Unicode偏移、重复片段及developer/user/root instructions位置。接收器只返回测试运输确认，不伪装Provider或模型输出。其它case为明确transport fixture，覆盖配置错误、敏感路径、既有模型/流式/expiry/余额及redactor合同。没有外部Provider调用，临时HTTP服务已停止。
- package typecheck、docs:check（342 ops/25 groups）、diff通过。由于package配置明确排除script/test，还用临时配置扩展原tsconfig并显式包含audit、host、测试、原`src/sql.d.ts`和package的Bun类型根，完整类型检查通过。首次临时配置缺Bun类型根/Markdown ambient declarations已按原类型来源补齐；触及的原catch补类型收窄，没有修改生产行为或绕过检查。没有新增永久平行配置面。
- 结论只到：本例可见报告用来源/字段存在替代了关系验证，且下一次可以观察预登记片段的实际出站位置。模型内部推理、锚定与能力贡献仍未分离；未修复或验真业务误验收。下一阶段应把H-E的方法形成/比较交接落实为一个可区分解释的最小行为对照，先明确唯一干预、生产入口、固定样本数和失败后的结论边界；不再添加观察功能、重复旧协议检查或无信息重抽，也不能把新增字段/Artifact当算法收益。此阶段没有新模型、官方世界、候选、作者或历史分数。

## G12实施前：把H-E收敛为单一可审查干预

- Recall：本轮按用户指令回到独立预期与反证改变判断，不启动模型、世界、作者、候选或Campaign，不增加API/观察能力或同义提醒。已重读五段图、G6–G11、handoff/input-observation、当前`.13` manifest/verifier/orchestrator、delegated-worker core/context/agent/adapter、generic Artifact publisher与来源read-ref定义、当前02-data的终态产物完整性契约及既有Artifact测试。全仓搜索未发现AutomationBench已经实施的比较前方法Artifact契约；现有“先独立推导”指令真实存在，不能以新增措辞重复认领。
- 当前可确定的实现边界：generic `artifact_publish`允许当前专家团命名空间的JSON产物，真实作者/Task/Session/Tool身份由Host产生；方法发布后仍须原search→完整read得到当前Turn read-ref，后续review以`source_read_refs`选择它，正文自写ID不替代真实来源关系。continuation保留原worker Session；跨Turn旧read-ref不能复用，需重新读取原不可变方法。不改worker权限、工作流executor→verifier顺序或ledger。
- 新发现的设计约束：verifier是工作流terminal node，现有Task completion要求包含该节点全部current expert_output，故方法与被更正的方法也可能进入完成证据集合。不能为减少材料而隐藏旧产物、改completion或添加“方法已发布即合格”的Host规则；最终review必须解释其方法引用/改判关系，未知仍未知。额外发布与回读有成本，须计入所有请求和tokens。
- 本次产物是可直接审查的未应用单段patch及两次运行的预登记设计，不修改`.13`、core、Host或生产schema。只替换verifier现有raw-receipt comparison段，具体要求它真实发布方法/前提，再以原read-ref连接比较记录；其余角色、工具、原输入保持。方法由模型自己选择，没有案例名称、金额答案、来源ID或operator公式。模型不执行该交接、先形成错误方法、只有文档而没有修正，分别按预登记失败类别记录，不当收益。
- Checker层级：本轮只检查patch确切适用于当前`.13`单个文件、diff范围和docs；不新增或运行模型/语义fixture测试，不以静态文字通过证明行为。未来固定同案例两个全新Mission世界，baseline与treatment各一次；这能观察交接/判断/行动差异，但executor先前行为与随机性仍是竞争解释，不声称完全隔离锚定和能力。下一文档将列明确判定表、来源曝光约束、终止条件与尚欠的启动冻结收据。

### G12设计交付 checkpoint

- [method-handoff.md](../../artifacts/2026-09-25-acceptance-comparison-design/method-handoff.md)现在包含完整英文干预、生产调用/来源选择边界、终态证据影响和两次观察的固定设计。唯一拟改内容是verifier原比较段4行替换为31行：原Agent先真实发布方法，再用当前Turn完整read-ref连接比较；新前提改变时保留旧方法引用并改判。没有发布/安装包、改生产prompt、增加工具/角色/Host gate，也未把输入观察再扩成新功能。
- 可审查[patch](../../artifacts/2026-09-25-acceptance-comparison-design/verifier-method-handoff.patch)已经由精确原段与登记文本生成；`git apply --check`通过，`--numstat`确认仅一个verifier文件31增/4删。只读逐字节核对原`.13`immutable目录与当前source verifier相同（5651字节），不是用可变代码摘要判断功能。patch尚未应用；它是设计交付而非纠错实现。
- 两个未来episode固定为同sales/9、同Mission入口，B1原`.13`后T1唯一干预，各一次、不替补；不将两次随机执行之差当因果效果。明确列出方法先错、producer暴露、正确差异未行动、两臂都直接正确、前置执行结果不同、未执行交接及runtime/null各自能说明什么。无自然纠错机会就不声称纠错成功，也不补跑求反例。不存在等token/盲审控制，能力与锚定仍可能未分离。
- 设计不是已就绪启动收据：新包实际版本/digest、共同运行源码、manifest参数解析、空目录和成对目录/模型精确预检尚未冻结。本轮未访问凭据、发送模型/预检、创建世界或复用旧controller。后续可依据这个明确的单一方案实施必要的角色交接，再完成原包loader/来源身份检查与独立冻结记录；不要再从空白重写计划或新增另一项干预，运行前仍须满足预登记边界。
- 根docs:check（342 ops/25 groups）、差异检查通过；纯spec与未应用patch，无生产代码/测试修改，未重复运行G6–G11的合同来当行为证据。原输入/Tool/世界/评分/候选保持只读，全部历史host仍已停。可靠业务纠错与进化收益尚未达成，下一实际验收必须经过真实模型/Tool/业务结果链。

## G13实施前：应用已登记交接并准备独立冻结

- Recall：本轮按用户已授权的G12下一步实施唯一verifier段改动，不再另写干预或扩展观察器。已核对G12精确patch、当前`.13`、generic publisher/read-ref与terminal expert_output合同、原loader/materialization和driver的launch/run/cleanup路径；没有发现需要扩大权限、改scheduler/core或制造新schema的契约。旧运行全部停止且工作区起始干净。
- 实施范围固定为应用原patch、源manifest版本`.13`递增到`2026.09.25.14`。原不可变`.13`及全部旧记录不变；`.14`是operator登记的开发干预，不是生产evolve作者产物、性能已证候选或更优父代。无其它角色/工具/流程改变。
- 验证先走现有AutomationBench真实package loader测试，并在新的隔离本地目录用同一loader材料化两包、比较完整文件树及manifest语义；预期仅verifier段和version不同，API权限/工作流相同。比较真实immutable资源身份有意义，不作为业务正确性门槛。因只有包内容改动不改TypeScript，不重复共享生命周期测试或增加静态prompt文案测试。
- 验证并范围提交后，才把共同Git源、两包真实版本/digest、原manifest/Inspect配置与未使用目录写入独立运行冻结收据。当前尚未发模型预检；后续两个隔离host各自以既有成对auth/models、精确Luna流式preflight后才启动官方episode。复用原primitive、单控制器顺序B1/T1，失败按G12不替补，运行时不改冻结源码/spec。

### G13实施与启动准备 checkpoint

- 精确patch已应用，源包为`2026.09.25.14`。真实`ExpertSquadRegistry.loadSourcePackage`和`loadPackageRevisionSnapshot`在新隔离runtime材料化并重读两包；baseline`.13` digest仍为`9061cb18bd24f80563430abb437afb4460843cc48fb4c4a8eaa60171e6a74a8b`，treatment`.14`为`b4c645f4a90c002e83842c46d56afbb1563ee24f7a9cb215f2488a1d9d379f93`。完整六文件比较只变verifier与manifest，manifest去version后完全一致，原生产capability materializer两角色授权相同。材料化收据在`.tmp/supervision-causal-20260925/he-01-preparation/package-freeze.json`，不是安装到用户项目/进化推广。
- 聚焦`bun run test test/automationbench-expert-squad.test.ts`为1通过、5断言，验证真实loader、三角色、官方API能力与dependency DAG。方法形成/真实选源/业务纠错仍未验证。首次临时材料化脚本把runtime与process目录设成siblings，被原隔离校验明确拒绝；按原合同改为process内child后通过，未改生产隔离。去掉临时命令的多余tsconfig override后也消除了Bun诊断噪声。
- 原Inspect `load_cases`与`_settings`已实际解析两臂配置，原upstream固定`4a8e1061254004d9dac807054eed33fad7d1ff14`、sales/9、strict/context policy均原样；此例官方world_clock为null，明确保留unspecified，不填运行日期。未构造OfficialWorld、未调用评分器。原SYSTEM/USER投影与配置保存在`he-01-preparation/inspect-settings.json`；loopback端口1仅用于纯配置解析，真正URL由各host preflight receipt绑定。
- 只读核对原成对auth/models存在，OAuth当时未过期且目录确实含精确Luna；不输出凭据、不刷新。本地检查不能代替真实preflight，两个host启动后仍各自按原实现验证可用性/投影/实际streaming模型。六项已登记输入观察统一用于两臂，其中新增角色标题和方法/比较原文片段；它们仅进审计器，不进模型消息。
- 新`he-01-preparation/run_pair.py`只组织原driver的launch_host/run_inspect/settle_owned_activity/stop_host，已py_compile。controller独占创建，B1/T1各一次，每300秒存只读快照；评分失败保留，runtime/null或cleanup未达成则停止余项。cleanup需零活动、正常stopped、进程退出与两文件实际删除后才进T1。该编译只证明脚本语法，不能当运行成功。所有启动字段在提交后写入`.tmp/supervision-causal-20260925/he-01/freeze.json`，再启动唯一controller；未来事实在原receipt中保存，运行期间不更新本spec或源码。
- 源包改动、原package loader与文档检查完成后按AGENTS提交。本次交付是待测交接实现，不是可靠纠错或自进化收益；G12的两个样本及全部反例/未知/停止规则不变。

## G14：H-E两次运行完成，正常交付不能冒充纠错收益

- Recall：严格完成G12固定两次Mission世界B1/T1，没有补跑/替补、作者或Campaign。源全程`fe233643e8bfbea3cd46dc81ed6123fec5720c84`，两包精确binding、原输入/clock/scorer保留。controller于11:35:10.971 UTC finished；追加本记录前核对两个host stopped、所有自有controller/Inspect/host进程退出、零活动、auth/models实际删除。原SQLite用`mode=ro/query_only`读取，未启动/迁移旧runtime、改分或重算评分。
- 完整[结果报告](../../artifacts/2026-09-25-acceptance-comparison-design/he-01-results.md)包含原分、逐段归因、原native/官方Markdown矩阵、请求/token/Tool/时长及原证据引用。原始与派生文件分别在`he-01/{B1,T1}`和`he-01/audit`，原收据只读。两个Task均completed、Mission均accepted；B1原strict0/partial0且最终20,000，T1原strict1/partial1且最终54,000。两者都各一次原始创建、两个initial dispatch，没有金额修正/continuation/Mission resume。
- B1并非重复Cycle3“全部计算项已齐”：复杂Drive查询空结果后，没有读取价表/折扣；executor和verifier均读到含base不变的原邮件，却将`4×5000=20000`判完整。真实verifier Artifact `art_hhq98XNCPfLqTy4xdxng`明确把该公式satisfied，不是通知缺失。空查询与模拟API复合query语义未分离，不能单凭它归模型弱，但未完成的依赖仍不能当正确总价。
- T1真实executor POST `prt_g0VWEMFsx00xBksrTjw3`于11:28:49.571已是54,000，官方事件22成功且最终world吻合；之后verifier方法`art_h1YKQBld9fGslU5KgD8r`于11:31:50.117发布，比较`art_hHQZrQnqaH8IDvQHUwQj`于11:32:54.871真实选源方法，公式正确。这支持现有Tool下交接可执行和本次正常交付，**不证明verifier修复了错误，更不能把+1分归为因果收益**。两臂前置executor结果不同，不能事后装作同起点。
- 曝光边界也有新事实：T1 verifier在11:31:08.225已GET实际Opportunity，先于方法；方法选源executor且自述已读executor。其“Deferred to comparison”文字不能倒置真实读取顺序。方法先于比较publication成立，但未见实际结果前形成方法不成立；独立推导与确认既有正确解释未分离。G11显示原重算/标题在B1 18次、T1 25次出站instructions出现，新方法/比较段仅T1 25次出现；这是片段发送证据，不是完整wire/理解保证。
- 成本完整记录：B1 79请求/79usage、2,826,202 tokens、27官方Tool/71全Tool、534.622秒；T1 78/78、2,727,654 tokens、32官方Tool/70全Tool、626.884秒。全157请求均Luna流式HTTP200，usage数量缺口0，合5,553,856 tokens。包含preflight/内部调用；原cost_usd0不是免费账单。verifier本身由18请求/490,273tokens变25/946,978，其它角色成本也变，不能以整体tokens稍低宣称交接节省成本。
- 决策：本次两episode闭合，不再重抽，不晋升`.14`为已证更优父代。它保留为有一次正常路径证据的开发交接，可靠纠错/自进化收益仍未达成。下一可做的本地工作只审查如何固定同一自然错误交付与允许来源的真实、明确归属、只读验收起点，排除前置executor不同的识别问题；不得复活旧Task、改官方world、伪造producer、泄露operator答案或立即增加模型样本。合法设计未成立时应明确未知/不可识别边界，而不是同义prompt或更多随机世界。整体五段机制工作继续，停止此对照不等于暂停整体工作。

## G15实施前：固定归档材料的归属与可执行性

- Recall：本轮只做G14留下的同起点识别审查，无模型/世界/作者/新包、凭据或旧Task恢复。已读Task `CreateTaskInput`/`materializeApiAttachments`、AttachmentStore、共享附件index投影、跨Task正式移交、worker能力resolver、原`.13/.14` manifest与相关成功合同；当前架构02-data及task-control-plane是权限事实源。全仓调用区分数据可复制、模型可读取、原Tool身份可消费、正式移交四件事。
- 当前代码事实：API附件原入口支持bytes/base64即时材料化，持久化为中性`task_input/user-upload`；共享worker只投影附件index，不能用存储成功冒充实际读到内容。跨Task正式移交要求当前DB内同Project/Mission lineage的终态及精确deliverable，不能从另一个已停止runtime搬旧ID。`.13/.14` worker声明了原AutomationBench MCP能力，`defaultMcpServersForRefs`精确要求真实配置；不能删工具声明或伪造MCP来把归档当原运行。
- 单一具体产物：从B1只读原链复制原operator请求、全部27条实际官方调用及其返回、原verifier的验收主张，标明operator整理的历史材料与原归属，旧ID仅作归档坐标。排除整份world、评分/assertions、其它arm/Cycle的知识及operator答案；不筛选“有利”的source子集。复制品不进入原Task或原Artifact表，也不伪造新participant/Tool结果。它能固定待审文本，尚不能固定新的模型派单或执行上下文。
- B1没有取得基础价/折扣，所以该闭卷材料不能合法要求模型给出54,000；最多检验是否识别计算依据未闭合、保留unknown而非继续接受。若要完整数值修正或重新发现来源，就需要另一个明确的环境/权限契约，不能将其偷偷加入本轮。此限制在评估侧说明，不把定位答案附加到模型输入。
- 本地Checker仅验证原AttachmentStore写入/完整读取保持同一归档bytes，并调用真实worker resolver观察缺少原MCP配置时的确切合同。使用新隔离runtime/project，无Task/LLM/假assistant消息。若resolver拒绝，这是诊断方案前提不满足，不是待修Host bug；不为测试绕过权限。实施后给出已证/未知和下一决定，不称为真实业务纠错。

### G15本地结果与路线决定

- 已生成[固定历史输入](../../artifacts/2026-09-25-acceptance-comparison-design/archive-review-input.json)，81,724字节：原请求、完整27条顺序调用/原返回、原verifier主张，分别逐值比对原B1链。外层明确operator整理、原IDs仅为归档坐标，未写入新Task/Artifact/Message或伪造Tool。完整world、评分/assertions、T1/Cycle3与operator答案未进入该输入。
- 原`AttachmentStore.write`、URL解析、read/readReference在新隔离Project真实保存并完整读回相同bytes与MIME/长度，内容身份`4375156964102c71e4d16a33d5eeb826dfeed8dcd1bfbd891be81801850be215`。这是不可变材料传输证据，不是模型看过材料或业务判断通过。
- 两版immutable包的真实`resolveWorkerCapability`均返回`Active expert squad projects missing default MCP server default/mcp/automationbench.`。使用明确test-driver binding和空MCP配置，没有修改包、隐藏原工具、替换服务或调用Provider。收据`.tmp/supervision-causal-20260925/archive-input-local/receipt.json`保留；本地DB为Project1，其余Task/Session/Message/Provider activity/usage均0，无auth/models，进程已退出。旧runtime未打开为产品实例、未迁移或重置。
- [入口审计](../../artifacts/2026-09-25-acceptance-comparison-design/archive-review-ingress.md)给出中性附件、真实worker读取、正式跨Task移交与MCP投影的边界。停止“只上传归档就能原权限直跑verifier”的方案；这是前提不满足，不是新增Host修复理由，也不证明所有同起点设计都不可能。不能把另一角色/无工具问答仍叫原生`.13/.14`对照。
- 主验收仍为真实业务纠错。当前归档包只支持有限的依据充分性审计，不能从B1未读到的价表中凭空要求正确总价。若继续同起点研究，下一设计应优先审查既有业务引擎能否支持明确标注的开发fixture和原真实API，而不是把只读文字判断当完整交付；不能改旧官方世界/原分、冒充旧参与者、增加权限或立即创建新world/model。若该边界不能合法满足，应记录停止该方案，不以更多随机样本替代。当前无已登记的新运行。
- 并行工作区事实：本地Checker收据写于11:58:38 UTC；随后12:03:10出现非本轮操作产生的提交`ba89e5cb`（Freeze AutomationBench business clock across input world and replay），HEAD从`a550f822`前进。该提交还包含本轮已写的根spec索引链接；保留其已提交状态，不回退/改写。新的benchmark源不能冒充H-E原`fe233643`；未来运行须先核对更新后的Inspect架构/时钟契约并重新登记，不改历史分数。此提交的授权/验证归属未在本线程核验，完整待推送集合需连同原`2a55323e`一起审查；当前继续保留推送阻塞。

## G16实施前：固定业务状态与固定监督输入的识别边界

- Recall：本轮从`e90bc09b`继续G15，只读核对新的时钟记录/Inspect架构、官方Case/WorldState/MCP、通用solver的sample setup、原包executor→verifier依赖和原API更新实现。产物限于具体设计与只读结构收据，不创建世界、Task、模型、服务器、包或凭据，不改变旧数据/评分。起始工作区干净，按路径核对未见原实验运行；不操作旧PID。
- 现象与直接原因：H-E两臂executor交付不同，上传归档又不能满足原MCP投影。现有`load_cases`只认原官方case；`rescore`恢复snapshot用于官方评分，不是公开活动世界入口；`sample_environment`固定创建官方世界并自动评分。不能把派生初态塞进同一官方身份，也不能用归档输出充当当前API结果。
- 新的共享数据风险：B1 snapshot含全部48个服务字段，但原`meta.allowed_services`只有gmail/google_drive/google_sheets/salesforce；`OfficialWorld`把initial_state键重新交给`compute_allowed_services`，因此直接拿完整snapshot作seed会扩大服务范围。B1原业务记录description还保留错误公式，不能为了“独立”删掉它。新的时钟修复只冻结世界业务时间；Salesforce update仍由上游写入实际wall-clock修改时间，应与业务时间、原数据和运行时间分别记录。
- 本轮单一方案：明确标记的“固定既有错误状态的业务返工”开发诊断。评估者保留B1完整状态/原身份与外侧真值，模型经原四个API工具自行发现来源并修改现有记录；新Task不承接旧participant身份。该方案可回答整条业务修复链，不能单独识别verifier段的因果收益：原executor仍先执行。保持相同verifier输入还要求改变流程/角色入口，本轮不作该改动、不添加gate或假producer。
- 落盘前补齐原helper对权限派生的只读检查、原快照结构/时间/来源边界和原API路由证据；不得构造WorldState/OfficialWorld、重评分或发API。最终设计须给出确切数据流、operator新业务请求、修改/保持义务、共同适配及未实现部分、成功/失败解释和未来本地Checker合同。仅文档与结构收据不称可运行行为验收；未实现和未预登记部分保持关闭。

### G16设计交付与识别结论

- 已完成[固定业务状态返工设计](../../artifacts/2026-09-25-acceptance-comparison-design/fixed-state-repair-design.md)：明确源快照/归档作者/当前入口/当前真实Tool与评估侧真值的分界，提供不含来源ID/答案的新业务请求、修改与保持义务、未来真实MCP Checker和停止条件。只选择整条业务返工链的诊断，不把归档问答作为业务成功，也不再提出无法固定verifier输入的H-E两臂。
- 原`compute_allowed_services(snapshot.world, [], [])`本轮真实纯函数结果为48服务，原B1允许列表为4；B1业务clock为`2026-09-25T11:15:25.718221Z`，Sheets跟踪为空。没有World构造器、API、Provider、scorer或服务器调用。该结果写入设计表，只证明不可直接把展开snapshot当seed，不是新生产故障或已实现的fixture导入器。
- 正式API源码存在Opportunity PATCH/GET路径，原MCP、solver的sample_setup及Mission请求可复用。必要适配应只分离原唯一API运输/事件/状态组件与官方评分，开发入口明确新身份并恢复原权限/clock；不能借OfficialWorld官方标签评分、扩大4服务或删除原错误description。当前仅设计，未创建fixture文件、未改生产代码/包/权限。
- 识别边界已收敛：相同初态仍允许executor先改变业务值及交接内容，因此它不能保证verifier见到相同待审结果或排除锚定。保留原工作流时停止“固定verifier完整输入”的这个方案；未来固定初态若成功，只能按真实轨迹区分executor直接修复、监督触发返工、误accept或未知，不能外推进化收益。未实施部分及任何新模型诊断仍须单独方案/验证/冻结，不因本设计提交自动启动。
- 根`docs:check`通过（342 ops/25 groups），`git diff --check`通过；本轮没有生产行为改动，未运行旧模型/协议测试或UI测试。新clock提交已按源码和当前架构读到，但不重算历史，也未在本线程独立核验其外部授权/验收。完整待推送仍须检查原`2a55323e`及`ba89e5cb`归属；本地设计交付不解除推送阻塞。业务可靠纠错和进化收益仍未达成。

## G17实施前：单一模拟API会话与开发环境适配

- Recall：按用户本轮明确授权把G16必要适配推进到本地实现。起始`ba7f2c35`/工作区干净，原实验均已停；读过原world/MCP/Task setup/solver、全部包内同名调用、相关正向测试、当前Inspect架构和新时钟记录。继续使用benchmark-debug-template，无委托、无模型/凭据/旧Task重启。旧原始材料不参与本轮活动world。
- 已定位的职责耦合是`OfficialWorld`同时承担三工具调用、状态/事件和官方评分，`sample_environment`又包含重复不了的项目配置/MCP资源生命周期。G16权限4→48反例要求恢复完整状态而非重新seed；不是修改官方业务转移。计划新增`automationbench/api_session.py`承接唯一call和原始state snapshot/restore，原OfficialWorld继承该会话、删除迁出的call/重复state导出；官方rescore消费同一restore。MCP只改会话类型，不变工具定义/权限。
- 新`automationbench/environment.py`承接原唯一squad bytes冻结与新项目/MCP作用域；官方setup原状态/评分逻辑保留，开发setup共用它。新`automationbench/development.py`仅接受显式operator-derived fixture envelope和完整state/provenance/request，公开输入clock来自恢复状态，记录新事件与未评估开发末态，复用原SampleSetup→Mission solver。没有新注册模型任务/业务scorer，不让official manifest接受任意seed，不复制业务引擎/当前状态或增加角色/执行权限。
- 一致性检查只处理完整序列化状态、明确clock、非null且合法的服务列表、Sheets跟踪、fixture身份/来源；不能用Host判断金额/来源充分性。业务意义仍由Agent与外侧验收负责。调度/Task/Mission/Session协议不改；环境作用域横向检查正常退出、异常/取消、多项目并行及恢复后的独立会话，沿原资源清理，不修改用户进程或Task生命周期。
- 可证伪预测：同一完整状态通过开发入口恢复后，真实MCP GET可见给定记录；原PATCH改变同一record并GET可读，权限仍只4服务、其它服务真实401；保存/恢复保留业务clock、全部记录与Sheets写标记，新会话事件从1开始。原官方checker的empty/partial/complete分数与snapshot replay契约保持。若为达成它必须改业务Tool/放开权限/伪造输出，停止实现而非绕过。

### G17模型无关Checker独立预登记

- 输入：新增`tests/test_automationbench_development.py`内明确由test-driver构造的完整WorldState序列化fixture；不是B1或任何旧world。固定clock `2026-01-15T09:00:00Z`，四服务，测试Opportunity `checker-opportunity`初值20及原description、独立保留记录、一个测试Sheet行。driver显式PATCH为42并改测试说明，随后GET；此数值仅测试数据，生产模块不包含它，不是模型业务答案。
- 执行：仅包内venv的pytest/原localhost MCP客户端与真正上游API，临时目录由pytest隔离；落盘日志目录预留`.tmp/supervision-causal-20260925/g17-local-check/`。输入作者为test-driver，无OpenCorvus Task/模型/伪participant。两个独立会话用于状态和事件隔离；一次正常、一次异常/取消资源作用域合同。任何driver产物不能用作未来模型初态。此登记仅授权这些本地Checker，没有自然业务修复样本。
- 预期输出：明确的GET记录/更新返回/401错误、完整恢复state、开发身份和`assessment=not_evaluated`、同项目配置与原工具集合；原官方正向checker仍调用其原rubric。非法kind/clock/权限/不完整state输入映射精确ValueError；不新增负向字符串/不调用断言或UI测试。只在代码实现后执行该登记检查，不使用旧eval评分器重算历史。
- 验证范围：上述新文件、原`test_automationbench.py`中因共享会话/环境被迁移的合同；Ruff/Mypy及根docs/diff。新环境的本地MCP检查是运输/状态验收，不是Agent自主纠错、Luna能力、正式分数或进化收益。任何未来真实行为另行冻结输入/目录/版本/模型/样本和停止规则。
- 共享项目配置复核另执行原`automationbench-project-admission.test.ts`：其真实Python sample setup/localhost MCP→产品ConfigPaths/Config/原package与worker resolver→base64实际返回，使用临时本地Project、无模型或业务Task。它验证此次迁出的同一环境构造，没有新角色或工具权限；不是LLM行为。

### G17实施与本地验收 checkpoint

- 已实现`ApiSession`作为唯一三工具call/事件/原始状态导出的owner，OfficialWorld继承它并保留原Case初始化和官方rubric；已删除迁出的call/导出实现。官方rescore与开发入口共用`restore_world_state`，要求完整序列化状态、明确clock/服务列表/Sheets写入跟踪，原状态复原不重新扩大seed权限。MCP四工具定义与原业务转移不变，api_catalog仍是文档。
- `environment.py`承接原唯一squad bytes冻结、创建新目录、MCP/project config作用域；官方setup保留原评分/错误合同。新`development.py`严格接受`operator-derived-business-repair` envelope、作者/来源/请求/完整state；新Task输入必须匹配冻结identity/request，clock从state公开投影。输出只有development身份、新事件与末态，`assessment=not_evaluated`；closed不代表Task/Mission成功。没有注册可自动启动的模型Task、业务scorer、角色、API权限或第二ledger。
- 登记的本地真实MCP检查以test-driver新合成状态运行：GET原20→PATCH42/说明→同record GET42；原On Hold和另一个记录保持；未连接Slack真实401；全部48个序列化字段仍仅4服务授权；Sheets真实PUT后写入跟踪保持，JSON保存/恢复state完整、新会话事件从1开始。开发setup两项目并行、输入冻结、取消后保留state/明确CancelledError且端口ConnectError；错identity/request和不完整/不合法输入映射明确ValueError。所有这些是测试driver行为，不是模型发现或纠错。
- 验证表：新增Python开发检查最终14通过；共享变化涉及的原官方Python合同19通过（正常empty/partial/complete原分、重放、clock、Mission状态观察、异常/取消、并行项目）；真实跨语言project admission 1通过/11断言。package Mypy23源文件、新测试Mypy1文件、Ruff、docs342ops25groups与diff通过。Python最终增补只涉及两个错误输入测试，官方19项沿同一未变生产实现的上一轮有效结果，不重复累计旧运行。
- 保留两类检查器输入错误：首次driver写v59 URL，原上游只实现v61，GET返回无Amount的错误对象使测试失败；按实际原路由改测试v61，没有改生产API。随后两项错误入口测试尝试给Inspect只读input/sample_id属性赋值，返回AttributeError；改为构造合法TaskState携带待拒输入，真实返回预期ValueError。原失败日志保留在`.tmp/supervision-causal-20260925/g17-local-check/pytest.log`/xml，最终14项在`pytest-development-final.*`，跨语言在`project-admission.log`。首v59失败只在本轮工具输出，未伪造持久化收据。
- 检查进程均正常退出；按本轮路径复核没有遗留python/bun进程，未创建模型Task/controller、使用或复制auth/models，也未把B1旧snapshot启动为活动世界。当前架构和package README已同步；G16文档标明历史设计时点。旧官方input/world/原分与包`.13/.14`只读，未重算历史。
- 下一未证边界是自然错误材料经这条入口进入真实Agent后，事实是否改变判断并实际修正。现在可准备一个公开归属的固定状态业务诊断冻结，但不得把这34项本地合同当可靠业务纠错/进化收益，也不能重复扩展环境API代替行为检查。任何B1材料导出须先原eval逐值核对并明确新身份、完整初态/原服务/clock/description；真实Luna调用仍另行预登记，不从本检查产物接着运行模型。

## G18实施前：一次固定错误业务状态诊断的输入与运行冻结

- Recall：本轮起始`d5871ffd`/干净工作区，核对原实验均已停止，读G16/G17、原H-E收据、原Inspect solver/config/driver与实际开发输入契约。目标是把可读来源转成正确判断/真实修正/复核，交付仍与监督返工及进化收益分开。用户问的v61已解释为上游Salesforce REST API路径版本；没有把检查器URL错误当业务模型问题。
- 本轮先准备：从B1原`.eval`以Inspect reader只读取sample、snapshot和原事件，逐值匹配B1-final-chain；导出新operator-derived fixture，全集复制world和Sheets跟踪，保持原4服务、clock、目标description及噪声。新请求采用G16明确的“审查并修正既有记录”，不附operator公式/来源ID/官方断言。原SYSTEM作为公开历史任务约束保留其文字，create动作由当前返工请求明确替换，不合成新system/participant消息。外侧义务与具体判定单独落盘，不作为fixture输入。
- 必要入口改动限定为`automationbench/development_task.py`组合原loader/development_environment/build_opencorvus_solver的Mission入口；原纯配置`_settings`移到environment.py成为唯一sample_settings，官方消费者同步迁移、删除旧定义。Inspect registry注册显式开发任务；不改生命周期/权限/包/业务API，无另一个runner或Provider客户端。scorer为None，原生结果及业务证据只入metadata，任何业务结论仍须完整外侧审查，不能把没有scorer变成0或完成。
- 入口构造/错误配置先做局部正向检查与Ruff/Mypy/docs/diff，不重复34项当新进展。真实`.14`由原loader在新隔离材料化目录核验digest/六文件与权限；仅材料化不是安装推广。新增计划/索引和必要入口代码验证提交后才冻结实际source SHA。新的测量问题与信息/授权变化单独说明，不使用原official manifest/create rubric。
- 预定样本：`.tmp/supervision-causal-20260925/repair-01/`一个新Mission/新世界、`.14`一次、无替补；准备目录为`repair-01-preparation/`。控制器复用原driver的launch_host/精确preflight/公共cleanup/stop_host，仅Inspect命令与开发结果读取按新入口调整；独占创建controller，300秒快照，outer none/真实无活动300秒/poll2。源码、fixture和精确script身份全冻结后才可能启动，不运行旧脚本/旧目录、不自设请求预算。
- 启动条件：已提交源/真实包身份、原始来源一致性、冻结公开请求与评估侧义务、唯一新目录/控制器、成对auth/models及精确Luna流式预检。当前写本段时尚未移交凭据或发模型预检。若全部成立，才依原无人值守授权考虑这一已登记单次诊断；任何条件失败保留null及实际原因，不能重复抽样。运行期间不改源码/spec。正常收尾需本轮零活动/Host退出/复制件删除后再分析。

### G18准备与实现 checkpoint

- 已完成[Repair 01预登记](../../artifacts/2026-09-25-acceptance-comparison-design/repair-01-preregistration.md)，包含固定材料、原错误对象/来源、当前返工请求与历史create范围的显式差异、外侧业务义务、错误/未知/停止、完整成本与公共收尾。控制器和只读准备脚本作为可审查artifact提交；没有新增业务scorer或Host语义判断。
- 从B1原eval只读核对snapshot/input/27事件与原链逐值相等，读取前后eval字节身份一致。新fixture为231,703 bytes、`af809c323ab14ac90b6df4193825bc65d5cae3697eb434ed8b4d727989ebe869`，源eval为`373c00b3732e478dc02d7bdfb57a48c296df10903e8d0c5130b5d8462cb789c9`。只用于确切不可变输入身份，不作业务验收。完整state、4服务、clock和description保留；原分/断言/其它arm/producer历史没有投影到新Task。source-receipt位于新准备目录，旧输入未改。
- 真实loader从H-E不可变`.14`材料化到新package-runtime并reload；digest仍`b4c645f4a90c002e83842c46d56afbb1563ee24f7a9cb215f2488a1d9d379f93`，六文件字节相等、两worker原capabilities/流程保留，package-freeze收据已落盘。不是晋升父代或安装到用户项目。
- 新`opencorvus_business_repair`入口仅组成原Mission solver/setup，注册名明确为开发返工。纯配置校验迁为environment.sample_settings，旧私有定义已删除、官方消费同一个函数。scorer=None，输出原生结果与未评估开发证据，外侧按逐项事实审查。实际构造B1派生输入成功，公开request UTF8为1844 bytes且无补入金额/公式/source ID；无活动MCP或模型在此构造中启动。
- 聚焦入口/错误配置及原官方构造共5测试通过；package Mypy24源文件/新测试Mypy1文件、Ruff（含两个artifact脚本）、脚本py_compile、docs342ops25groups/diff通过。初次静态检查指出controller在async中同步Popen和测试metadata/kwargs类型，已沿原driver的to_thread写法与准确类型修正；不是模型/runtime失败，也没有绕过检查。原G17行为合同不重复累计。
- 只读检查原auth/models存在、OAuth当时未过期、目录含精确Luna，没有输出凭据或刷新。真实preflight仍须新Host执行并记录usable/projected/exact/streaming。提交后的freeze及controller将记录准确源SHA、数据/脚本身份、一次样本和实际运行过程；在这些运行收据出现前不能说模型已经启动。

### Repair 01启动边界失败：业务样本尚未开始

- 源`d24c215c27a6a56cc03e80f65929815edfd7b5a6`在12:58 UTC按原freeze启动一次controller。Luna真实预检通过（usable/projected/gpt-5.6-luna/streaming），随后Inspect在实际log计划登记时报告`Object 'solve' does not have registry info`，没有生成eval。进程exit0并不是成功；原controller精确记录`log_unavailable`/assessment null，停止在runtime boundary。
- 原controller54268/launcher42572/host34880/Inspect57848均已退出，cleanup为零活动、host stopped，auth/models复制件实际删除。旧数据只读核对`engine_task=0`；两次Luna请求只来自预检，usage2条/input29046/output62/reasoning111/cache0/total29219 tokens。不能记业务0分或称业务判断失败；原controller不重启、不补写原记录。
- 横审发现不是局限新开发任务：`ba89e5cb`为保持单一clock删除了官方`@solver automationbench_task_solver`包装，直接把plain build_opencorvus_solver闭包交给Inspect；G18新入口沿用该模式。H-E原eval实际计划仍记录旧registered automationbench_task_solver，解释旧运行为何能启动。当前官方Task/Mission与新开发Mission均受影响；通用opencorvus_task仍有装饰器，目录构造和MCP checker路径没有进入这个原生任务日志边界。
- 检查覆盖缺口由本任务负责：G18只做了Task构造检查；G17官方本地checker自身有注册solver，不能代替真实原生任务的Inspect启动。不是`scorer=None`或Luna能力问题，也不是业务API v61问题。停止真实样本路径，先修工具链并用模型无关真实Inspect错误路径验收；是否再登记业务运行另行决定，不静默把失败替掉。

## G19实施前：恢复Inspect执行计划的真实注册身份

- 已读当前Inspect0.3.259的solver decorator/registry参数序列化、resolve_plan/plan_to_eval_plan，以及全仓build_opencorvus_solver调用。计划保留唯一公共HTTP/lifecycle实现；官方与开发两种输入工厂分别使用参数为可序列化路径/配置的真实`@solver`，不手写registry属性、合成日志或把callback名字伪装成可重建参数。官方包装显式接受Task已冻结的effective unspecified_clock，不能恢复过去两次取当前时间的旧缺陷；官方原Case、开发归档来源各自唯一权威。
- 范围限于两个Inspect Task组合模块及聚焦测试/架构。通用Task已注册路径、Mission/Task HTTP客户端、取消/恢复/并行调度实现不改。测试覆盖官方Task、官方Mission、开发Mission三种入口的真实eval计划/错误日志、clock保持和资源收尾；原通用solver合同作为对照。
- 独立无模型Checker：用G17合成fixture或原smoke Case；socket独占bind但不listen的本机随机端口是明确不可用API端点，避免碰用户服务。Inspect实际eval(model=none)启动自己的本地MCP/项目，真正HTTP连接失败应生成含准确registered solver/参数的eval与OpenCorvusAPIError和原环境error；不伪造product成功响应或LLM/Tool输出。日志放`.tmp/supervision-causal-20260925/g19-local-check/`，不使用B1活动world，不发Provider。先红后绿核对这个精确失败，不用静态字符串替代。

### G19修复与验证 checkpoint

- 官方`automationbench_task_solver`恢复为真实`@solver`，显式接收Task构造时已经选定的clock；开发`business_repair_solver`注册真实fixture/squad/config参数。两者继续调用唯一build_opencorvus_solver；路径指向同一冻结输入，未手写registry信息、复制HTTP/生命周期实现或重新按当前wall-time给world定时。原通用opencorvus_task仍沿原注册路径。
- 三种真实Inspect检查在修前均复现无registry导致eval未写出；修后都生成可完整读取的eval，保存准确solver名、真实参数和各sample的OpenCorvusAPIError。官方Task和Mission的input投影clock与最终world clock一致。整体`log.status=success`在fail_on_error=False下仅代表日志完成，sample仍明确error；初次Checker把它预期为overall error，已改为断言真实sample错误和完整计划，没有放宽生产错误语义。controller原先同时检查环境closed/原生outcome，因此本次没有误判成功。
- 聚焦三个原生入口、原通用solver、官方构造/clock共7测试通过；这是无Provider的实际Inspect计划/HTTP连接错误/MCP收尾路径，非LLM或业务修复。原料为新合成或smoke输入，未使用B1活动world。package Mypy24源文件/新测试1文件、Ruff、docs342ops25groups/diff均通过；按当前路径复核所有检查/本轮host进程已退出。原Repair 01保持停止，不重启控制器、不补写eval或把null记0。
- `repair-01/failure-review.json`只读记录engine_task0、两次流式LunaHTTP200预检请求、2usage/29219 tokens、零活动及host停止/两复制件删除。原Provider activity表只有1条不等于只有1次调用，以真实审计2请求和2usage并列保存。恢复这个零业务样本的运行需新的独立冻结/明确失败保留策略，不能沿用已停止目录或把未开始的业务验证称为通过。

## G20预登记：零业务样本启动失败后的独立恢复

- Recall：用户本轮明确要求界定并推进恢复。Repair 01未创建业务Task，原null、日志、2次预检/29219 tokens及旧freeze完整保留。G19已定位并真实验证注册故障修复；这次恢复不是挑选业务结果或H-E第三臂。起始`9eee9b1e`/工作区干净，实际无旧controller/host/Inspect进程运行。
- 只进行一次恢复启动，目录`.tmp/supervision-causal-20260925/repair-01-recovery/`，episode在其子目录；同一fixture身份`af809c323ab14ac90b6df4193825bc65d5cae3697eb434ed8b4d727989ebe869`、同一1844字节公开请求、同一原4服务/clock/完整description、同一`.14/b4c645f4...`及原评估侧义务。业务样本上限仍1，无替补。若再次runtime失败，保留null并停止这条真实启动路径，不循环试启动；若业务失败照样保留，不更改提示重抽。
- 原单一controller源码增加必填`--run-dir`以读取显式独立freeze，删除硬编码旧RUN目录；episode必须归属于该登记目录。没有第二controller实现、后备路径或改变原host/Inspect/cleanup逻辑。旧运行目录/controller.json/freeze/log只读，旧源码版本在`d24c215c`保留，新实例按新source/script身份独占创建。先py_compile/Ruff和实际CLI错误合同（episode越界→明确ValueError）核对，无模型。
- 验证并提交后写新freeze，引用旧失败收据说明业务Task为0，所有新旧预检和后续调用累计报告。真实包/输入按原已核验收据再核对身份，不重新生成源、材料化候选或扩大测试。新Host使用同一成对授权/模型目录并重新做精确Luna流式预检，不刷新凭据副本；预检不通过就收尾。
- 新旧两次启动各自完整留存，结果不得拼入原H-E/官方历史。本次只验证G16/G18规定的真实修正、保持义务和判断/返工来源；executor首次修正仍不证明监督触发。运行期间源码/spec冻结、五分钟快照；新Task/Mission身份以实际收据为准，不提前填造。结束先零活动/host退出/复制件删除，再读完整原Tool/消息/产物/世界判定。

## G21结果：真实后续调查没有修正错误价格，H-E交接不足

- [完整结果](../../artifacts/2026-09-25-acceptance-comparison-design/repair-01-results.md)按G18/G20原义务审定。恢复源8560c039、同fixture与`.14`，新Mission `bd1e13b3299af570` / Task `tsk_g00VWEnlcF00x17zwsMd`。controller于13:34:50 UTC finished，Task failed/Mission blocked；原公共cleanup active=[]、host stopped、成对复制件实际删除，13:37核对精确自有进程全退出。Inspect closed/log success只表示观测及收尾完成，官方strict/partial null，不套create rubric。
- 两方实际读到定价邮件“Base prices remain unchanged.”、Gold及4Contacts，但没有Drive/Sheets业务读取。初始executor认20,000及原说明已正确，无需修改；verifier的方法`art_hJrFxBRCwUnfhZ7nJzgl`也先选择4×5,000=20,000。方法完整读后比较`art_hf0OMARvH3yU7cngCkZf`真实引用它；交接顺序发生，不代表方法正确，producer报告和目标GET均先曝光。
- verifier提出健康政策文字只适用于创建新机会，以及缺全字段baseline的疑问；scheduler真实continuation `prt_g0VWEpqHs00FInV5oBdG`限制为只读政策调查、不得修改机会/说明，executor查询后发布未找到扩展的证据。第二verifier仍认pricing satisfied；真实fail_task和panel_block_mission均继续肯定20,000，因政策/保持证据疑问结算。不是通知没到或缺后续执行，而是错误通过项未被重开；本次没有Mission resume/extension。
- 全45业务事件为5 api_search+40 GET，完整最终state与初态逐值相同；目标ID/名称/Account/On Hold和所有无关事实保持，但金额20,000与原580字节错误description未修。初态原Sheet仍有base40,000/Gold10%，登记金额关系54,000仅在评估侧。健康政策“when creating new opportunities…until cases resolved”的既有记录适用性歧义单列，不拿它证明整项不可完成、不重判旧官方分。该歧义不消除确定的价格修复缺失。
- 原116请求/116usage全部Luna流式HTTP200，4,867,281tokens，106全Tool（104completed/2failed）/45业务事件，sample1061.288秒。两次Tool失败分别为非terminal settlement Message身份与旧Turn locator，实际错误保留，不假称runtime失败或价格根因。加原零业务启动失败2请求/29,219tokens，共118请求/4,896,500tokens。全成本、分角色、原生/外侧矩阵见结果文档；原eval/DB只读派生在`repair-01-recovery/audit/`，未改分或拼历史。
- 本次反证限定为：可审查方法/引用与同Task后续调查不足以保证关系判断和业务纠错。H-E单段改写没有得到可宣称的纠错收益，不再同义改写或抽样；`.14`不晋升/推广。整体可靠纠错/进化收益未完成；当前没有本轮证据支持的新生产补丁或下一次模型登记。先交付共同机制结论与未识别项，后续新干预必须有不同的可检验因果机制，不能用再加API或局部通过替代。

## G22：跨轨迹机制结论与研究方向边界

- Recall：按用户要求收敛Cycle3、H-E B1/T1、G21四条轨迹，区分交付、纠错、优化与协议收敛；不再重复提取原数据、不启动模型/世界/候选。起始4396553c/工作区干净。已读五段机制图、四轨迹已交付报告、G4–G10记录与当前task-control-plane；沿现有manifest、scheduler/verifier prompt、SDK authoring schema、workflow-binding/facts、dispatch-agent-tool及workflow-node-occurrence-authority测试审查下一假设的表达边界。
- 新机制交付见[跨轨迹决策](../../artifacts/2026-09-25-acceptance-comparison-design/mechanism-decision.md)。共同可观察问题为原目标关系退化成错误的局部充分条件，并跨判断/派单/结算保持；不能将其当模型内部唯一因果根因。Cycle3否定“只补来源即可”；G21否定“方法Artifact与后续调查足以纠错”；T1只提供正常交付反例，不能用来估计H-E效果。G4–G10局部合同保留，不扩大成业务验证；G1仍无真实完整Campaign收益证据。
- 一个不同但未验证的候选是“预期形成前移到执行者开始前”。当前`.14`manifest和scheduler明确executor→verifier；仅在同一后验verifier里再说先推导不能改变新producer结论已存在的事实。当前prompt-profile-resolver明确workflow图由真实Agent可见决定遵守、不是Host硬gate；SDK/绑定分别有node_id与agent_id，已有同一agent绑定不同节点/Session的局部合同。故可讨论原verifier的前置方法节点→原executor→原verifier复核节点，复用角色/能力/Artifact，不增加Host语义门；但它改变工作流、节点出现次数、上下文和成本，不能称原H-E单段或只改一行。
- 本轮没有创建该图、包、fixture、Task或运行登记；既有错误业务文本仍可在前置节点被读到，不能保证盲审，也不能用Host隐藏它。候选仅能检验“没有新executor报告时方法是否仍错”等条件，不能一次分离固有来源选择/旧文本锚定/能力的全部贡献。后续需要明确是否转向这种执行顺序研究；当前结束H-E后验方法记录的自动试错路径，保留整体未达成状态。无运行期间不继续五分钟查旧日志或制造重复报告。

## G23实施前：继续已授权本地设计，不将方向判断转为逐步确认

- 用户问“怎么不做了”。纠正G22执行上的过早停顿：原无人值守授权覆盖有依据的本地研究、设计与检查，无需再让用户批准这一步。停止无信息重抽不等于停止机制工作。本轮继续H-T的精确未应用差异和局部生产合同检查，不启动模型/业务世界、不替代运行登记。G22文末“等待选择”属于已被本次纠正的历史状态。
- 可证伪的本地预测：原manifest表达三节点但仍只有原两个worker角色，真实loader/immutable reload能读取；原MCP能力完全相同；scheduler的真实可见instruction可以区分两个verifier节点并携带同Task方法坐标，原render不替模型补阶段；最终证据仍包含前后两次verifier产物，旧方法不能隐藏。这里证明表达/身份/数据合同，不能证明方法正确、实际遵循顺序或业务纠错。
- 已读新增边界：delegated-worker/context保留原请求；ordinary initial不走renderDispatchContinuationTurn，其阶段必须由真实scheduler放入既有instruction，不能假定node_id自动出现在初始正文。completion-decision当前按terminal agent及包归属收集expert_output，因此复用同verifier角色会带入前置方法，最终复核应明确引用及改判关系；不是只剩最终节点报告。本轮不修改Host completion或消息/权限实现。
- 范围：在spec产物生成可审查patch，仅调整包manifest三节点、scheduler阶段交接、verifier前置/最终职责及README；executor/selector/core/API权限保持。版本只作未发布设计身份，原`.14`源及不可变包不改。将patch应用于新的隔离临时副本，使用原生产loader、capability materializer、workflow binding与初始prompt renderer检查；不安装到用户项目、不生成模型Task/Message/Tool结果或启动MCP world。失败若来自真实合同，先记录再改设计，不增Host门或绕过检查。

### G23精确设计与本地检查 checkpoint

- [精确设计](../../artifacts/2026-09-25-acceptance-comparison-design/expectation-first-design.md)、未应用`expectation-first.patch`和明确test-driver检查器已落盘。实际四文件差异为manifest/README/scheduler/verifier；executor/selector原字节和所有能力保持。角色仍两个，节点三个；真实调度者通过原instruction表达阶段、以同Task Artifact交接，不隐藏初态旧错误说明。原source`.14`没有应用patch，没有安装/推广。
- 隔离副本位于`.tmp/supervision-causal-20260925/ht-local-design/staged-squad`。首次版本suffix被原schema明确拒绝，改用合法未发布设计版本2026.09.25.15；真实loader/immutable reload identity为`a231dffdaed86a638cb8cc0995eab387a67dba8d70330980b37210553fd37b40`。检查六文件reload相同、两个worker全部grant及四MCPrefs与`.14`相同、三个topology wave及node→agent绑定正确、初始renderer保留显式阶段和原测试请求；receipt在`checker-run-02/receipt.json`。全部为本地loader/纯合同，无LLM/MCP业务调用/Task/participant消息，不能当模型顺序或效果验证。
- git apply --check/四文件numstat、专用检查器typecheck、docs342ops25groups/diff通过。专用tsconfig第一版遗漏项目原*.md声明，补入原src/**/*.d.ts后通过，未新增假类型声明。completion收集前后verifier产物的结论仍是源码核对，未做Task sealing运行。所有失败/限制在设计文档保留，不把检查器通过包装业务根治。
- 已恢复原heartbeat的本地工作跟进，不等待G22选择题。下一步是具体的H-T测量预登记审查，核对新问题是否能区分预测、原输入/旧文本/评估侧隔离、次数/停止规则；当前仍没有真实运行收据，不启动模型/业务world/候选作者/Campaign，也不重启任何旧run。

## G24预登记：只观察一个新的前置方法前缀与完整业务闭环

- Recall：继续用户明确的无人值守要求，读取G23/原repair/fixed-state约束及单一controller/registered development Task调用。起始677fa711、工作区干净，实际无本任务controller/Inspect/host在运行。新[H-T01预登记](../../artifacts/2026-09-25-acceptance-comparison-design/ht-01-preregistration.md)只改变新producer报告与方法形成的时序；原record中的历史错误说明完整可见。H-E/G21为历史背景，不作效果对照或父代选择。
- 信息增益限于真实前缀：此前T1/G21已观察的方法产物形成前都见过新executor结论；现在检验原verifier在新executor不存在时的方法及其后续改变。前置已错只否定新executor报告是必要条件，不分离旧文本锚定/来源选择/能力；没有顺序就记干预未执行。固定一次、无替补/自动恢复，不因结果不理想改prompt重抽。
- 同一原fixture af809c…/1844字节公开request、clock/四服务/完整错误description和外侧义务保持。使用G23真实loader的`.15/a231dffd…`不可变设计包，原默认source`.14`不必改；实际诊断project显式绑定设计包，不推广/晋升。原run-repair-01.py可接受新ht-01目录/冻结包身份，registered Inspect Mission入口/scorerNone/300秒无活动/poll2均沿原实现，无控制器或业务引擎改动。
- 登记先提交，再生成独立freeze核对source、原料和包、controller/probe/外侧登记身份；必要真实启动之前仍需成对凭据/模型目录的只读检查及新host精确Luna流式预检。没有freeze/预检不开始业务Mission。运行时源码/spec冻结，完整成本与cleanup必须保留，不能用本地loader通过当模型验证。

### G24启动前核对

- 新`.tmp/supervision-causal-20260925/ht-01-preparation/entry-construction.json`核对原fixture及1844字节公开request身份、`.15`不可变六文件与G23已检设计相同。真实registered development Task constructor接受该输入/包/新目录并返回原sample/request、Mission配置、scorerNone；只是构造，没有调用solver或启动业务API世界，不能冒称实际Inspect已跑过。
- 原授权auth/models源只读核对通过OAuth未过期及openai目录有精确Luna；未复制/刷新凭据，未发模型预检。真实preflight必须由新host另行完成。controller源码不变，无新平台或测量代码；本登记和索引docs/diff通过后范围提交，准确运行SHA写新freeze，不改旧Repair01/H-E记录。

## G25结果：前置方法已在先，错误关系仍穿过全链

- [H-T01完整结果](../../artifacts/2026-09-25-acceptance-comparison-design/ht-01-results.md)按G24原登记逐项审定。唯一新Mission `1d6cb3654d038745`、Task `tsk_g00VWF7Deg00jKHmW9Kv`真实绑定隔离`.15/a231dffd…`，运行源`0a8780f3`。controller 14:51:13 UTC自然finished；公开cleanup active=[]、host stopped；精确launcher/controller/host/Inspect进程均退出，episode内成对auth/models复制件实际不存在。原eval/DB/世界只读，数据库`mode=ro`/`query_only`；官方strict/partial仍null。
- 三个成功初始dispatch真实为前置verifier节点→executor节点→最终verifier节点。前置方法`art_hwy9iy8BrDqRLCNRsnoD`在14:38:46发布，新executor首派单在14:39:44。scheduler完整read/select、executor完整read、最终verifier完整read原方法与执行产物，比较`art_h69rY5TyXL0yVb0LMisl`真实引用两者。时序干预及资料交接成立，不等于方法正确。
- 前置verifier先GET原Opportunity，已见20,000及旧错误Description；它读到定价邮件原句“Base prices remain unchanged.”、Gold账户和四联系人，却没有读Drive/Sheets原base40,000与Gold10%。方法在新executor出现前就认`4×5000=20000`，因此**新executor报告不是本次错误方法的必要条件**；旧业务文本锚定、来源选择、指令解释、推理能力仍未分离，不能称盲审或Luna整体弱。
- executor实际PATCH同一机会的Amount20,000及逐字相同的580字节说明，返回`{}`、Tool completed，后续GET仍20,000；完整初末world仅目标`last_modified_date`由上游PATCH变动，其余字段/来源/4服务/clock/Sheets跟踪均同值。最终verifier仍价格pass，真实`complete_task`与`panel_complete_mission` accepted。原生终态相对外侧登记关系54,000及说明更正为错误接受；没有业务修正或监督触发的同Task返工。健康政策对既有机会的适用性及年份文字歧义仍单列，不遮蔽价格缺口。
- 本次113请求/113usage全流式LunaHTTP200，input675757/output24746/reasoning3287/cache-read3853056/cache-write0/total4556846 tokens；104全Tool（101 completed/3 failed）、42业务事件（8 search/33 GET/1 PATCH）、sample1009.282秒/controller1033.098秒。三次非终止Tool错误为错误Task Message身份、首次派单输入无效、首次方法JSON无效；后续合法轮次均真实完成，错误原样保留。完整成本不能与G21/H-E差额当边际收益，cost_usd0非免费。
- 这次证伪“方法形成在新执行者前，就足以避免错误关系被接受”。仅保留有界时序识别与已通过的协议/运行器合同，不晋升`.15`、安装推广、补第二次样本、同义改写或开启作者/Campaign。可靠业务纠错与自进化收益仍未达成；当前没有证据支持把这个错误接受改称交付或把H-T继续随机扩样。

## G26：目录噪声可见，语义关系失真仍无合法局部补丁

- Recall：按用户原无人值守与全局机制要求，承接G25的新反证，在无活动实验/Host且`e2a31895`工作区干净时，只读核对当前Agent指令、模拟API发现/真实权限、Task/Mission裁决的全仓定义与调用，不重提取旧评分、不启动模型/世界。结论及代码边界见[来源依赖审查](../../artifacts/2026-09-25-acceptance-comparison-design/source-dependency-boundary.md)。
- 当前共同`ApiSession`将`api_search`原样交上游全部schema的BM25目录，`api_catalog`同样列全服务；真正`api_fetch`另按world.meta.allowed_services四服务做401。H-T01前两次泛查询各20条，分别混入14与7条未连接服务，均无Drive/Sheets，表明发现噪声；但当前Sheets读取合约存在、四服务允许、Agent未发相关定向查询，不能由目录噪声证明Sheets不可达或若过滤就会修好。
- 当前executor/verifier/scheduler指令已经要求完整base、人数、tier调整及原始来源，G25有部分出站片段和实际定价邮件读取；仍在新executor之前选错方法。Cycle3即使读齐全部依赖仍错误接受，否定“只改目录发现就是共同根治”。Task Completion Decision及Mission的Host校验覆盖真实Message/Artifact、生命周期等身份与一致性，而不判价格公式；H-T01是错误业务判断被真实裁决接受，不是调度状态丢失或Host工具没调用。
- 因此不改原官方Tool、world/scorer或Host业务gate，不再同义追加方法/角色/随机样本，也不把目录过滤作为这次业务修复交付。目录文档与连接权限的差别可作为**独立发现能力问题**另行研究，但受官方Tool只读边界约束且不足以处理读齐仍误判。当前没有证据支持一个同时解决来源选择和方法判断、且不转移Agent语义权的最小生产修改；这一具体路径收束，整体可靠业务纠错和进化收益仍未达成。

## G27：测量结果进入父代选择前的运行终态缺口

- Recall：用户明确指出将G26具体假设收束误当成整体工作停止；本轮继续五段机制中的“测量→父代选择”，不复活任何业务实验、作者或Campaign。起始`4a57f0f9`且工作区干净，已读本记录Recall/五段图/G1–G2/G25–G26、Evolution Lab当前比较器、Artifact发布器、Run Evidence Bundle类型与终态映射、Promotion Mutation Intent、README及比较/发布测试。全仓搜索`deriveComparisonRecommendation`、`required_unavailable_dimensions`和`run-evidence-bundle`的生产调用与相关测试；以下修改仅触及当前唯一确定性比较实现与聚焦测试，不改变Tool、权限、官方输入或业务语义。
- 可观察现象与直接触发点：比较器在`classifyComparisonAvailability`把**缺失**的Run Artifact、Evaluation、独立Review和不可用Scorer列为必需不可用，但对**存在且`outcome: unavailable`**的Run Artifact不列入。后续`outcome_rates`虽报告不可用比例，`recommendation`仅比较candidate/baseline的`failure`，因此其余测量值与Review齐全且正向时仍可能给出`promote`。需用同一比较夹具的一个candidate不可用运行和四次稳定测量构造红色正向反例，保留其真实typed状态与测量值，不伪造缺失Artifact。
- 共享根因与影响：Run publisher从规范Task Run Evidence Bundle的`inactive`/`awaiting_interaction`映射为`unavailable`，并校验发布值；Recommendation publisher又要求用户声明精确等于此确定性比较结果；下游Promotion Mutation Intent只校验`recommendation=promote`与必需不可用维度为空。因此模型自行谨慎不足以补这处代码遗漏，可能把无终态业务结果的Trial送入父代选择。旧G1修了独立Review blocker，未消费Run自身的typed不可用；H-T等业务失败也不能靠该修复变成成功。
- 精确改动：在原`classifyComparisonAvailability`同一slot中，将现有Run的`outcome=unavailable`记为`run_outcome:<case>:<arm>:<repetition>`必需不可用。保持`failure`独立计入失败率；保留原Run/Scorer/Review及配对测量供审计，aggregate与推荐按既有必需不可用路径变为null/inconclusive。不要改Artifact ABI、另建gate或给LLM新的业务规则。Evolution Lab README补明typed终态语义；package版本是否需要改变按实际包交付契约核对后决定。
- 验证与风险：先运行聚焦反例确认当前错误`promote`，再运行比较单测的成功/失败/不可用合同和真实发布器检查；运行`check:expert-squad-types`、受影响package typecheck、`docs:check`与`git diff --check`。测试为当前输出的正向断言，不加“没有调用”式负向检查。若真实发布器或上游schema否定反例，撤回此机制结论而不是强行补丁。修复只保证未完成运行不被推荐为父代，不证明业务纠错、候选收益或自动推广；不启动新LLM Campaign。完整出站提交集合仍含他任务未核验提交，按Git规则不得夹带推送。
- 红色反例已实测：四次稳定测量与`reviewed`俱全、一个candidate Run为`unavailable`时，旧比较器仍输出空的必需不可用维度；失败Trial的对照仍按失败率`retain`。本轮修改后聚焦比较测试已绿。检查分发路径又发现`generated/expert-squad-payload.ts`内Evolution Lab仍是G1前的`.06`及旧比较函数；只改源包会令嵌入式生产包继续使用旧策略。故本任务必须同步**Evolution Lab条目**的生成字节，版本升为`2026.09.26.1`，验证其与当前源一致。生成器还输出AutomationBench五行的既有无关漂移；按精确行与HEAD核对后保留原嵌入内容，不夹带这项工作。该局部生成同步与完整生成物检查的差别须在验收中披露。
- 交付复核：源与内嵌Evolution Lab由真实`loadSourcePackage`/`loadEmbeddedPackage`得到同一不可变package digest；版本均`2026.09.26.1`。生成revision记录原来也停在`.06`；用当前单一`packageContentDigest`算得本包内容身份`af0427f2fd2b7675e8b8de05081d9082e038899caa9953ee01a7cd94d4ce9b0e`，精确更新本包记录并由正向测试复核。完整revision生成计划另会给无关`base`包盖新版本，故未执行有副作用的整表生成，不把它混入本提交。新版比较器明确记录`run_outcome:case-1:candidate:0`、`aggregate_score=null`、`recommendation=inconclusive`，仍保留配对测量与`outcome_rates.candidate.unavailable=0.25`；正常成功仍`promote`，真实失败仍按失败率`retain`。
- 验证：聚焦比较32项通过；真实Artifact发布/读取合同1项通过；生产嵌入包身份合同1项通过；真实Promotion Mutation Intent的合法promote/restore路径1项通过；Expert Squad类型检查、opencorvus类型检查、122 manifest拓扑、`docs:check`（342 ops/25 groups）和`git diff --check`通过。首次从仓库根运行Bun时额外拾取`tmp/gallery-project`副本并因其缺依赖报错，改在目标package目录运行同一聚焦测试通过；发布合同默认5秒timeout，按其真实耗时改用命令行60秒超时后通过，无生产合同放宽。没有新Provider、业务世界或模型费用。该修复是父代选择的证据完整性边界，不是业务语义纠错或已证进化收益；未推广任何候选。

## G28：Trial用量观测必须来自同一不可变账本

- Recall：用户再次指出没有活动代码可“跟”，要求停止把定时巡检当进展。本轮直接审查测量→父代选择，不开模型、旧世界或Campaign。起始`23bb9386`干净工作区；已读AGENTS、本记录G27、当前架构的Task运行证据、Evolution Lab Run Artifact schema/发布器/比较器、Tool Host、Provider用量账本及真实Session归属、原发布/晋升测试。全仓搜索`token_usage`、`cost_delta`、`TaskRunEvidenceHost`、`ProviderUsageEventTable`及其调用与测试。
- 现象/根因：`TaskRunEvidenceBundle`的canonical collector验证Task、Session、消息、Artifact、终态和包身份，却不含Provider用量。Run Artifact另收`token_usage`与`cost`两个非负数字；当前publisher严格复收前者的原运行证据，但不比对这两个数字。Comparison直接求candidate-baseline均值差并公开，Recommendation Owner据此报告成本；因此任意数字可随真实run Artifact发布。旧G27只核对outcome，不覆盖用量。下游父代`promote`当前不以成本差为门槛，故本轮不声称能改变晋升决策；它修测量报告的来源完整性。
- 现有唯一用量事实源是不可变`provider_usage_event`：每步记录`session_id`、总token、USD估计及`priced/unpriced/unknown`；Task活动集已有真实Session归属，未归属的preflight不应塞入Trial。方案是在现有`TaskRunEvidenceHost`增加一项按Task/Project归属收集的**账本观测**，复用原Task活动Session集合，在同库事务中求和并返回token总数和仅全部已定价时可知的cost，否则cost为null。Run Artifact的`cost`允许null；publisher在发布时用该Host观测精确核对`token_usage`/`cost`。Comparison对任一null cost返回null与现有`cost_delta`不可用维度，保留质量评分与原结果，不用0冒充免费。原Artifact的数值cost仍可解析，原始材料只读；不新建ledger、LLM工具、角色、关键词流程gate或外部账单保证。
- 影响面：插件Tool Host ABI、OpenCorvus唯一Host实现、Run Artifact schema与publisher、comparison、Evolution Lab源包/生成嵌入包及版本记录、真实发布与比较测试；`package-tool-capsule`动态转发同一Host成员，无第二实现。不得变更原业务World/scorer或历史运行。风险是账本事件可能缺失或有`unknown`计费，故返回的仅是**内部已记录用量/已定价估计**，不称外部发票；没有事件的Task不能凭0证明模型从未请求，须由测试与观察注明此上限。若现有Host权限/归属无法证明精确关联，就保留发现而停止实现，不造假收据。
- 实施/验收：原`collect-run-evidence` Tool回执投影同一Host账本观测，使Agent能填准确值；publisher发布前再按同一Host核对，不能要求模型猜账本数字，也不能静默改写其输入。先在真实发布测试让有账本token的Run携带错误数，要求精确完整性错误；再用正确数真实发布/读取，另验证unpriced/unknown时cost为null且comparison保留null差额。正常成功/失败与G27不可用推荐合同保持。聚焦测试、类型、生成包身份、docs和diff检查后范围提交；不借此启动Campaign或声称业务纠错。

## G28主管重判：测量事实由宿主盖章，而非让Agent复述后比对

### Recall

- 用户2026-09-26要求以主管身份接管全部无人值守监督/自进化工作：不把上面G28中断实现当既定方向，从原始事实、代码和目标重判优先级，并完成最有信息量的下一项实际工作；逐层区分目标→原始事实/反证→独立判断→同Task返工/复核/结算→测量/父代选择，协议收敛、正常交付、业务纠错、优化收益互不顶替；特别审查G1、G27的测量/父代选择边界与G25业务错误接受，不从H-E分差推因果收益。G28 diff须先审定义、调用、测试、生成包与历史Artifact读取，再决定补完、重做或精确撤回；不因测试绿忽略账本覆盖与unpriced语义。禁止重复已结束运行、改官方输入/world/scorer/原分、偷跑Campaign/作者/候选；新真实模型行为须单独预登记；Host不做业务金额gate、不隐藏/伪造消息、不增第二ledger/角色。
- 已读：根AGENTS、本记录Recall/五段机制图/G1–G28、`he-01-results`/`repair-01-results`/`ht-01-results`/`mechanism-decision`/`source-dependency-boundary`、`docs/evolution-gate-audit.md`、当前架构`02-data`与`06-provider`；源码`comparison.ts`、`publish-evolution-artifact.ts`、`collect-run-evidence.ts`、`execute-evolution-metrics.ts`、plugin `task-run-evidence.ts`/`expert-squad-evolution-artifact.ts`、`task-run-evidence-host.ts`、`plugin-tool-host.ts`、`package-tool-capsule.ts`、`usage/`、`llm/api.ts`、`session/llm.ts`、`agent/model.ts`、`evolution-mutation-intent.ts`、`evolution-history.ts`、Evolution Lab README/Skill/七个角色prompt与相关测试。全仓搜索`run-evidence-bundle`、`token_usage`、`cost_delta`、`taskRuns`、`model_configuration`、`usageAttribution`、`getSmallModel`的定义与调用。无委托、无模型请求。

### 全局判断：五段机制的已证、反证与未知

| 段 | 已证 | 被反证的充分条件 | 未知/未达成 |
| --- | --- | --- | --- |
| 目标→分工 | Cycle1/3、H-E、Repair01、H-T01的真实派单保留原定价/邮件义务 | “原请求在派单中丢失”不是这些失败的统一解释 | Mission未逐字转发原SYSTEM是否影响其它案例 |
| 执行→观察 | 来源可达、实际读取和写入收据完整；G26目录噪声可见 | “只补来源即可”（Cycle3读齐仍错） | H-T01/Repair01为何未读Sheets：来源选择、锚定、能力未分离 |
| 观察→判断 | 四条轨迹都出现“完整业务关系被局部充分条件替代并被后续层沿用” | 方法Artifact交接（G21）、方法前置时序（G25）都不充分 | 没有已识别的新机制；无合法Host补丁（金额gate/关键词路由被禁止）。不启动新运行 |
| 判断→返工/结算 | G4–G10协议合同、G8 typed resume、G10活跃追加的本地真实服务合同 | “发生continuation即返工成功”（Cycle3/G21续跑都针对错误gap） | 真实模型经监督发现业务错误并同Task修正：**0次观察到**；活跃追加从未被真实模型使用 |
| 测量→选择 | G1审查blocker、G27 Run不可用进入比较；promote需区间下界>0，n=1不可能promote | H-E的+1分不是处理效应：两臂executor起点不同，T1无纠错机会 | 从未跑通真实Campaign；本段仍有确定性数据缺口（下节） |

- G25专项：H-T01的错误接受发生在“观察→判断”，前后verifier、Task complete与Mission accept均通过身份/来源/生命周期校验，没有协议违约；G26“无合法局部补丁”的结论成立。本轮不把它写成已修复，也不设金额或关键词gate。
- G1专项补充：比较器只消费**已出现**的finding；`status: reviewed`且`findings: []`（测试夹具即如此）仍可promote，缺失的审查类别被当成无问题。这是与G1同源、尚未处理的“未观察当通过”缺口，列为下一项，不在本次改动中顺带修改。

### G28差异审查结论：方向对，做法错，重做

- 现象与直接触发点：Run Artifact除G28关注的`token_usage`/`cost`外，`model`、`environment_digest`、`last_activity_at`同样由Evaluator填写，publisher从不核对；而`comparison.ts`与`execute-evolution-metrics.ts`恰恰用`run.model === campaign.model`、`run.environment_digest === campaign.environment_digest`判断“同一冻结运行时”。Evaluator拿不到任何宿主提供的Trial模型事实，只能照抄Campaign值，该检查因此永远成立。仓库自己的真实host测试即反例：Trial assistant消息为`test/test`，G28写入的账本事件为`openai/gpt-5.6-luna`，Run却声称`provider/model`，照样发布并被度量工具接受。
- 根因：Run发布仍是“Agent复述宿主事实→publisher比对”的旧协议（16个字段中7个是64位摘要），与同一publisher对candidate-revision、evaluation-result已采用的“宿主盖章”相反；`docs/evolution-gate-audit.md`已把“run-evidence-bundle does not match its canonical collector and package revision facts”列为待删除并改宿主盖章的第一类门。G28在此之上**新增**一个同类门（Agent只能抄collector回执里的数字，门只能制造抄写错误，发现不了真实不一致），且没有覆盖真正被当作门用的`model`。
- 账本覆盖：`provider_usage_event`只由共享stream wrapper在上游step完成时写入，且只有`session/llm.ts`带Session归属；中断/未完成step不入账，无Session归属的helper不计入Trial。所以它是“已记录用量”下界，不是发票。计价：`getUsage`只写`priced`/`unpriced`，迁移回填的旧行可能是`unknown`；任一非priced即cost为null正确。G28对零事件返回cost=0（空集全priced）会把“无记录”表成“已计价为0”。
- 未完成项：新null-cost比较测试未运行；Evolution Lab嵌入生成包与版本记录未同步；collector回执新增`usage`只为让Agent抄写。
- 处置：保留“用量来自Trial自身账本”“cost可null且比较输出null差额”两项正确部分；撤回“复述后比对”与collector回执`usage`；改为下述盖章方案。

### 单一修复方案（实施前）

- **模型面输入**：新增`EvolutionRunEvidencePublishInputSchema`，Evaluator只提交它确实拥有的Campaign槽位`case_id`/`arm`/`repetition`，`resource_set`为collector资源，`source_artifact_locators`为唯一一份所读的campaign-spec。存储schema不变（除`cost`可null），历史Run Artifact照常解析；不保留旧输入的双形态。
- **宿主盖章**：publisher读取并校验collector资源（唯一JSON、canonical、与新鲜采集完全相同、canonical摘要自洽），读取Campaign（planner生产者），再调用`TaskRunEvidenceHost.usage`。盖章字段：`workspace_digest`、`run_evidence_sha256`/`run_evidence_resource`、`task_id`、`terminal_time`、`last_activity_at`（同一终态时间ISO）、`outcome`、`activity_duration_ms`、五项revision equality、`token_usage`、`cost`、`model`、`environment_digest`（来自所引Campaign）。
- **账本观测**：`TaskRunEvidenceHost.usage`返回Trial Session树（与bundle同一`readTaskDurableActivityScope`）内已记录事件的`token_usage`总和、`cost`（非空且全部priced才求和，否则null）与排序去重的`models`。空账本cost为null。
- **真实边界而非抄写门**：记录模型不是恰好一个（零个或多个）时，Trial不是单模型Campaign运行，publisher返回写明expected/received模型列表的typed错误，该槽位保持不可用；revision事实不等时返回列出五个摘要的错误；collector资源过期时返回两份canonical摘要并说明需重新采集。它们描述Trial本身的事实，不是要求Agent重抄。
- **消费方**：比较与度量工具的同运行时检查不改写，但此后比较的是宿主观测模型；`comparison.ts`保留G28的null cost处理。Mission晋升仍只消费确定性推荐。
- **不变项**：不改Task/Mission/Session生命周期、调度、ledger、权限、官方world/scorer或历史Artifact；不新增角色、Tool、工作流或业务gate；Run存储schema字段集不变。
- **影响面**：plugin ABI（Host接口、Run发布输入、发布联合体）、OpenCorvus Host实现、Evolution Lab publisher/collector/Evaluator与Recommendation Owner prompt/README/ownership参考、嵌入生成包与版本记录（`2026.09.26.2`）、架构`02-data`/`06-provider`、`docs/evolution-gate-audit.md`状态、真实host与比较测试。`package-tool-capsule`按成员名动态转发，无第二实现；`evolution-history`按存储schema解析，不受输入变化影响；SDK/OpenAPI不含Run payload。
- **可证伪预测与Checker**：在真实host测试（真实DB、collector、publisher、metrics Tool）中：账本记录Campaign模型并priced时，只交槽位即发布，读回payload的每个盖章字段等于Host事实；追加同模型unpriced事件后再发布，cost为null、token累加；追加另一模型事件后发布得到列出两个模型的错误；账本模型与Campaign不同时，metrics返回`EvolutionMetricIdentityError`。比较单测验证null cost只使`cost_delta`不可用。若真实publisher或Host合同否定上述预测，停止并修正方案，不放宽检查。
- **风险与限制**：已记录用量是下界；单模型限制会使按角色配置不同模型的Trial无法入Campaign（如实报错，不猜主模型）；`environment_digest`表示Run所属Campaign声明的环境，宿主不能观测Trial实际环境。本修复只修测量来源完整性，不证明业务纠错、候选收益或自动晋升。

### G28重判实施与验证 checkpoint

- 已按上方案实现：plugin新增`EvolutionRunEvidencePublishInputSchema`（只含槽位）并作为发布联合体的Run分支；`TaskRunEvidenceHost.usage`改为返回`TaskRunUsageObservation`（token、cost、models），空账本cost为null；Host按Task durable Session树读取账本；publisher要求唯一campaign-spec来源与唯一JSON collector资源，保留“资源等于新鲜采集”检查（错误改为写出两份canonical摘要并要求重新采集），删除随之冗余的canonical摘要复算、`sameResourceIdentity`与全部复述比对，改为盖章；collector回执恢复为HEAD（撤回G28的`usage`）；比较器保留G28的null cost处理。Evaluator/Recommendation Owner prompt、README、ownership参考、架构`02-data`/`06-provider`与门审计状态同步。包版本`2026.09.26.2`，嵌入payload只替换Evolution Lab一个条目（8个文件），revision记录内容身份`a54eb67614bb76d6dafadce51de0985440ef6ac474ac9d756f9f16f3f34c5a4f`。
- 失败与反证保留：G28新增的null-cost比较测试写作`candidateFirstRunCost ?? 1.2`，显式null被`??`变回1.2，首次运行实得`cost_delta=0.2`而失败——它从未检验过null cost；已改夹具仅在选项缺省时取默认，生产代码未为此修改。嵌入包身份测试在同步前按预期失败（源与嵌入digest不同）。变异检验：把publisher临时改成盖Campaign模型（旧“复述”语义），真实host测试在另一模型Trial断言处变红，恢复后逐字节与变异前一致。
- 新增真实host证据（真实DB、collector、publisher、metrics Tool）：只交槽位即可发布，读回payload的全部盖章字段等于Host事实（模型取账本`provider/model`，而该Trial assistant消息写的是`test/test`）；追加同模型unpriced step后再发布，token 100、cost null；追加另一模型step后发布，返回列出`["openai/gpt-5.6-luna","provider/model"]`的精确错误；另建一个只由`openai/gpt-5.6-luna`服务、其余身份均与Campaign一致的Trial，发布得到该模型与token 50/cost 0.75，metrics Tool以“Trial execution identity differs from the frozen campaign inputs”拒绝。缺Campaign来源得到精确source错误。比较单测新增“另一模型的Run不能进入冻结模型比较”的错误合同。
- 顺带修复的既有红测试：`evolution-lab-package-projection.test.ts`把已发布版本写死为`2026.09.06.1`，而自G27提交`23bb9386`同步嵌入payload为`2026.09.26.1`后它已必然失败（G27验证未运行此文件）。改为读取生成revision记录这一单一来源，恢复原1项/40断言通过。
- 验证：`bun run test`（packages/opencorvus）——`evolution-comparison` 34通过/98断言；`evolution-artifact-evidence-host` 9通过/93断言；`evolution-lab-package-projection` 1/40；`expert-squad-evolution-mutation` 1、`random-evolution-e2e-support` 14、`evolution-chain-host-defect-repairs` 3、`evolution-candidate-manifest-surface` 13、`expert-squad-feedback-revision` 9、`evolution-feedback-revision` 4，全部通过。plugin、opencorvus、`check:expert-squad-types`类型检查exit 0；拓扑122 manifests；`docs:check` 342 ops/25 groups；`git diff --check`通过。仓库无Biome可执行文件与lint脚本，未运行lint。
- 如实边界：revision计划显示与本修复无关的既有漂移（`automationbench`源`.25.14`对记录`.24.2`；`base`内容变化未升版本），本提交不夹带。`06-provider.md`的CRLF来自自动checkpoint `2a55323e`，新增行按`.gitattributes`的`eol=lf`写入，不重写其它行。已记录用量是下界；按角色配置多模型的Trial不能进入单模型Campaign（如实报错）；`environment_digest`表示所引Campaign声明的环境。无Provider请求、无真实Campaign/作者/候选、无官方world/scorer改动；本修复只闭合测量来源完整性，**不证明业务纠错、候选收益或晋升正确**。下一项仍是同一测量段的G1同源缺口：`reviewed`而`findings: []`可promote（缺失审查类别被当无问题），需先定义必需审查维度再改，避免把缺失处理成新的抛错门。

## G29：独立Review的空findings是已审无发现；丢失的是Auditor已声明的未观察

### Recall

- 用户2026-09-26要求有界核实我在G28重判末尾提出的“`status: reviewed`且`findings: []`仍可promote是G1同源覆盖缺口”，并把它当可被推翻的假设：区分“没有负面发现”与“没有执行某项必需审查”，不能凭空数组判未审，也不能擅自把五个category设成每个Campaign必需；先证明必需维度的权威来源与真正未观察的表达，再定单一方案。无合法依据则只写反证与边界、不制造代码或新抛错gate；同一审计直接发现的确定性根因可在完成影响面后处理，不得无目标扩大。不重启旧运行、不造世界/Campaign/作者/候选、不推广包。
- 已读：根AGENTS、本记录Recall/G1/G27/G28主管重判；Review/Campaign ABI（`expert-squad-evolution-artifact.ts`）、metric scorer observation class、Evolution Lab README/Skill/调度与七个角色prompt/manifest工作流描述、`platform-capability-sets.ts`（Auditor实际工具）、publisher Review与comparison分支、`comparison.ts`、`evolution-mutation-intent.ts`、`evolution-history.ts`、Artifact幂等发布身份、`2026-08-17-evolution-evaluation-review-ownership-split.md`、`docs/evolution-gate-audit.md`、平台Integrity的覆盖检查（算法层R2-06/R2-20）及相关正向测试。另用真实`deriveComparisonRecommendation`做了只读探针（`packages/opencorvus/.tmp`，已忽略、不入库）。

### 假设被推翻：必需维度的权威来源与未观察的表达

- 权威来源只有两处：Auditor自己的typed结论（`status`决定该slot审查是否完成；每个finding的`severity: blocker`决定是否阻断采用），以及Campaign冻结的visual scorer（比较器已据此要求visual review）。Review schema、Campaign ABI、Skill、README、调度prompt与工作流都没有声明每个Campaign必需的审查类别列表；category只是允许值。manifest中的Auditor描述属于候选可改写的描述性文本，不能当契约；平台Integrity的“空checkID即缺陷”依赖已注册检查与需求覆盖，Evolution Lab没有对应声明，不能移植。scorer observation class只有quality/diagnostic/efficiency，安全维度不由scorer测量。
- Auditor的实际能力：`delegated-worker-base`（bash/read/search/web等）加Artifact传输与`read_agent_message`，只能读评估Task中的Campaign、Candidate、Run bundle（Evaluator选定披露的消息正文）与Evaluation；看不到Trial Task全部transcript。某类别能否观察取决于证据，必须由Auditor判断并记录，不能由枚举静态决定。
- 真正未观察已有typed表达且被比较器消费：整份审查未完成发布`status: unavailable`（理由写在`unknowns`）→`integrity_review:<slot>`必需不可用；某不变量无法观察记`outcome: unavailable`，阻断采用时`severity: blocker`→`integrity_finding:<slot>:<category>:<index>`必需不可用（G1）。缺失Review同样必需不可用。publisher对`reviewed`要求的完成证据（所审Evaluation为直接来源、finding证据为直接来源）在空findings时依然存在。
- 结论：`reviewed`+`[]`是Auditor对完整审查且无可报告项的声明，比较器promote符合当前契约；它无法区分“审过且干净”与“声称完成但未审”，但这是依赖Auditor如实声明的设计边界，不是消费缺陷。把五类设为必需会凭空创造Host外的新门，本次不做。上轮称其为“G1同源缺口”不成立。

### 同一审计直接发现的确定性缺口

- 现象（真实比较器探针）：Review记`side_effect`或`reward_hacking`为`outcome: unavailable`但非阻断时，推荐仍promote（符合Auditor自定严重度），而`unavailable_dimensions`为空；整份Review为`unavailable`时推荐inconclusive且记必需维度，但Auditor写在`unknowns`里的原因不进入比较的`unknowns`。
- 触发与根因：`classifyComparisonAvailability`只在`severity === "blocker"`时登记`unavailable` finding，把“未观察”与“必需”合成一个条件；`derivedUnknowns`只取`reviewed`的Review。该函数自身注释把`unavailable`定义为“no evidence supports”的维度、`requiredUnavailable`为其阻断子集，且已把非阻断的cost/token/activity缺失计入`unavailable`；Review的非阻断未观察是唯一被丢掉的一类。
- 影响：不改变任何推荐或晋升（Mission只消费必需维度与推荐）。但比较是决策事实，Recommendation Owner必须逐字等于它、渲染不得新增数值，所以Auditor明确说出的“未观察”在决策Artifact里无法出现，读者会把它当作已观察。历史详情仍逐slot显示Review原文，信息没有从数据库消失。
- 旧路径不足：G1只把阻断的未观察接进必需集合；G27/G28未触及Review。现有单测只断言非阻断未观察“保持promote”，没有断言其是否出现在不可用向量。

### 精确改动与验证计划

- `comparison.ts`：每个`outcome: unavailable` finding都以原名称计入`unavailable`，仅blocker再计入`requiredUnavailable`；`unknowns`取所有所引Review（含`unavailable`）的`unknowns`与`accepted_limitations`。推荐规则、必需集合、schema、Mission晋升、Host均不改。README写明空findings的含义、非阻断未观察的报告方式与没有声明的必需类别表。包版本`2026.09.26.3`，只同步Evolution Lab嵌入条目与revision记录。
- 可证伪预测：修前探针C/F的`unavailable_dimensions`为空、B的`unknowns`为空；修后分别出现该finding名称与原因，推荐与必需集合不变。比较单测覆盖：全部适用类别均有证据地passed、以accepted limitation明示不适用、非阻断与阻断未观察、整份不可用含理由、缺失Review、阻断与非阻断实际失败、空findings。真实host测试在已有Auditor Review里加入一条非阻断未观察，经真实publisher发布并让比较精确等值通过。再做类型、拓扑、docs、diff检查。
- 不做与下一项：同一Evaluation可发布多份Review（幂等身份含payload），比较只消费Recommendation Owner所选那一份，失败blocker的Review可被另一份干净Review替代且历史不标为未链接——这需要先决定取代语义（最新有效、全部取并集或冲突即不可用），本次只记录。非阻断的实际失败在比较输出中没有字段；比较推荐仍要求Owner逐字复现（门审计第一类待改）；均不在本次范围。

### G29实施与验证 checkpoint

- 已按方案改`comparison.ts`两处：每个`outcome: unavailable`的finding都以原名称计入`unavailable`，只有Auditor标`blocker`的才进入必需集合；`unknowns`取全部所引Review（含`unavailable`）的`unknowns`与`accepted_limitations`。推荐规则、必需集合、schema、publisher、Mission晋升与Host均未改。README补写空findings的含义、非阻断未观察的报告、没有声明的必需类别表与ABI无not-applicable结果。包版本`2026.09.26.3`，嵌入payload只替换Evolution Lab条目（manifest、comparison、README三个文件），revision内容身份`eef7914a6c7b21472daa2cf2ceeb4b9785da3565144aad1fed9fb5a42e5fef79`；revision计划对本包稳定，仍只显示既有无关的`automationbench`/`base`漂移。
- 探针前后对照（真实比较器、只读、未入库）：修前非阻断未观察的`side_effect`/`reward_hacking`不在`unavailable_dimensions`，整份不可用Review的原因不在`unknowns`；修后二者出现，七种形态的推荐与必需集合全部不变。空findings、缺失Review、非阻断实际失败与带unknown的passed输出前后相同。
- 比较合同测试新增并收紧：空findings为“无可报告项”仍promote且不可用/unknowns为空；五类均有证据地passed仍promote；以accepted limitation明示不适用只进入unknowns；五类非阻断未观察出现在不可用向量但不必需；整份不可用为必需且带原因；缺失Review为必需；非阻断实际失败不算未观察。把`comparison.ts`临时换回HEAD版本时恰好6项变红（5类非阻断未观察+不可用Review原因），其余新测试在修前修后都通过，说明它们钉住的是既有正确语义；恢复后逐字节一致。
- 真实发布路径：`evolution-artifact-evidence-host`里已由真实publisher发布的Auditor Review增加一条非阻断`side_effect`未观察；Recommendation Owner的比较声明须含`integrity_finding:case-1:baseline:0:side_effect:2`，真实publisher逐字核对通过。换回HEAD比较器时，同一发布以`comparison-recommendation must equal the deterministic ... matrix`被拒——修复前Owner即使读懂Review也无法报告这项未观察。
- 验证：`bun run test`（packages/opencorvus）`evolution-comparison` 39/126、`evolution-artifact-evidence-host` 9/93、`evolution-lab-package-projection` 1/40、`expert-squad-evolution-mutation` 1/23、`random-evolution-e2e-support` 14/33、`evolution-chain-host-defect-repairs` 3/13、`evolution-candidate-manifest-surface` 13/13、`expert-squad-feedback-revision` 9/48、`evolution-feedback-revision` 4/12，全部通过；`check:expert-squad-types`与opencorvus类型检查exit 0；拓扑122 manifests；`docs:check` 342 ops/25 groups；`git diff --check`通过。plugin源码本轮未改。
- 边界：本修复只让Auditor已声明的未观察进入决策Artifact，不判定哪些类别必需，不能区分“审过且干净”与“声称完成但未审”，也不证明任何业务纠错、候选收益或晋升正确。同一Evaluation可有多份Review而由Owner选一份、非阻断实际失败在比较输出中无字段、比较推荐仍需Owner逐字复现，三项保持未处理，前者需先决定取代语义。

## G30：主管接管四项未完成目标——排序、接受条件与计划

### Recall

- 用户2026-09-26最新要求“让opus解决这些问题”：由我（Claude Opus 5.5主管）直接负责四项未完成目标的分析、实现、验证和交付，不再委托、不缩成巡检，不重复G29。四项：1）可靠业务纠错未证；2）自进化收益未证；3）同一Evaluation多份Review的选择/取代语义，及同审计涉及的比较事实由Owner逐字转录、非阻断失败报告边界；4）待推送链中`2a55323e`/`ba89e5cb`应主动核验授权、真实改动、验收与前向修复，能安全解决就交付，确缺用户独有选择才报告唯一缺失事实。旧运行与原世界/输入/评分/消息/Tool/候选只读；新真实验证须先独立预登记单一改变、输入/源/包/模型/目录/次数/停止条件与全部费用；业务模型只用流式`openai/gpt-5.6-luna`；Host只做身份/来源/类型/完整性/一致性。
- 已读：本记录Recall/五段图/G25–G29、`2026-09-24-luna-mission-task-factorial-trials.md`（授权与formal-2源漂移段）、`engine/git.ts` checkpoint生成、`af5213a2`、基准adapter/solver的`init_git`、Evolution Lab发布器/比较器/ABI/prompt、`.husky/pre-push`；本地会话库仅用于核对`ba89e5cb`的原始用户请求。

### 主管排序（目标→事实/反证→判断→返工/结算→测量/选择）

| 目标 | 已证 | 被推翻的充分条件 | 最先可改变的真正责任层 |
| --- | --- | --- | --- |
| 1 业务纠错 | 协议可达（G4–G10）；四条轨迹记录了同一关系失真 | 补读来源（Cycle3读齐仍接受5,000）、方法交接（G21）、方法前置（G25 H-T01先写4×5,000）、多轮/同义提示；目录噪声只可能影响未读Sheets的三例 | 语义判断属真实Agent；Host不能改。已有诊断未证明包内手工改写根治；拟继续检验“测量→父代选择”闭环（见3、2），当前未验不能写成必然不可执行 |
| 2 进化收益 | G1/G27/G28/G29的局部合同 | 合同通过、候选发布、一次accepted | 评估阶段的转录与选择契约继续审查；本主线尚无真实完整闭环跑通的证据，拟先处理3的确定问题，再以登记运行观察其可执行性 |
| 3 评估证据 | Review/Run/Evaluation的typed事实 | “Owner读懂即可” | 比较事实由Owner逐字转录（门审计第一类），且Owner决定哪份Evaluation/Run/Review进入比较——同一槽位多份事实时可挑选有利者、同一Trial可重复计入 |
| 4 推送链 | 见下方核验 | 旧“未核验”标签 | 前向修复`2a55323e`遗留的行尾，再完整验证整链 |

### 4 的核验事实（已完成调查）

- `2a55323e`由产品`EngineGit` baseline checkpoint生成（`engine/git.ts`的“Checkpoint before …”），发生在用户授权的formal-2（`4888dccc`）首组启动时：该组ME臂Mission项目`attempt-1`没有自己的`.git`（其余三臂有），checkpoint上溯到外层开发仓库，把工作树中128个文件以CRLF提交。忽略CR后差异为空；这些文件在其父提交中均为LF，其中含`deploy/racknerd/opencorvus-activate-release`脚本（CRLF会破坏Linux执行）。根因已由同链`af5213a2`修复（Mission基准项目init-git并校验工作树等于项目目录），此后各运行未再写入main。同类产品checkpoint已有7个（2026-08-08至08-26）在`origin/main`上，属本仓库既有dogfooding历史。HEAD中仍有86个纯CRLF与42个混合行尾文件，恰为这128个，仓库其余文件无CRLF。
- `ba89e5cb`由Codex侧对话线程`01a0d846…`产生：用户原话2026-09-25 11:15Z“我需要你检查bench环境是否有bug”、11:50Z“我认为不止这些问题，修复全部问题”，12:03Z提交；其记录`2026-09-25-automationbench-environment-clock-audit.md`列出验证。它删去注册solver的缺陷已由本记录G19修复并以真实Inspect验证。
- 处置：新增范围提交，把这128个文件按`.gitattributes`（`* text=auto eol=lf`）恢复为LF，忽略CR后零内容变化；随后在HEAD运行pre-push全套（根typecheck、API路由、docs、租约所有者、架构索引、包/模块/发布拓扑、secret scan）及链上各记录的聚焦检查，逐提交列出归属与验证后推送。不改写历史、不force。

### 3 的单一方案（实施前）

- 共同根因：比较结果与其证据集合都由模型角色提供，Host只做事后逐字比对。改为：Owner只命名Campaign与Candidate，publisher在当前Task目录发现所有绑定该Campaign（及候选臂的Candidate）的Evaluation、Run与Review，完整读取并选择它们，推导并盖章比较；比较来源因此是完整证据集。
- 槽位与Trial：一个槽位多份Evaluation→`evaluation_conflict:<slot>`必需不可用；一个Trial出现在多个槽位→`trial_reuse:<slot>`；槽位有来自不同Trial的Run→`trial_conflict:<slot>`；同一Trial的多次Run发布取被Evaluation引用者，无Evaluation时取最新。均为typed不可用，不抛错、不毒化后续发布。
- Review取代：新Review以同一Evaluation的旧Review为直接来源即取代它；旧Review中每个failed/unavailable blocker必须在新Review中以相同category与invariant出现，若结论改变须引用旧finding未引用的新证据，否则发布返回写明缺失项的typed错误（可自纠）。比较只用未被取代的Review；同一Evaluation多份未互相取代的Review取并集（任一不可用或blocker生效）。区分有新证据的改判与无依据丢弃blocker。
- 非阻断失败：决策无关，保留在Review中；Review现为比较的完整直接来源并在历史详情逐槽显示，不改比较schema。
- 限制：Evaluator从未收集的Trial仍不可见（需要在Trial创建时绑定Campaign，另议）；跨Task导入的Evaluation仍按原Campaign定位不参与比较（与现状相同）。

### 2、1 的后续

- 3完成后，按新登记用现有`check:evolution-e2e`观察一次真实闭环能否执行（单次、固定停止条件、全部费用），失败先定位首个缺陷；任何结果都不等于进化收益。收益需要同源多案例、候选对父代的区间判定与独立审查，当前无此数据集能力。
- 业务纠错的下一可证伪机制依赖“以真实业务案例为Campaign数据集”的Trial环境（每个Trial需独立AutomationBench世界）；当前Evolution Lab的Trial是Mission项目内普通Task，无法提供。本轮只在2的闭环可执行后评估其规模，不以同义提示或重抽替代。

### G30额度中断 checkpoint（调用方核验）

- 本轮真实主管为`claude-opus-5-5`，恢复原会话`a6ab2544-f778-492f-a880-c21f191aad43`，原始流式收据`.tmp/opus55-global-resolution-20260926T1118.jsonl`、新任务prompt`.tmp/opus55-global-resolution-task.md`。40 turns后CLI退出1，`terminal_reason=api_error`、HTTP429，原错误`You've hit your session limit · resets 9:40pm (Asia/Shanghai)`。2026-09-26 19:31上海时间已核对该主管进程退出；没有启动任何业务实验。
- 实际交付仅上述来源调查和实施前计划，生产代码未修改；第3项仍为待完整审查及真实Checker证伪的设计，不能当成已经实现、验证或批准的契约。尤其证据全集的发现范围、显式取代的既有语义、冲突/重复Trial分类以及用category/invariant和新引用表达改判的充分性，恢复后必须继续完成定义/调用/历史影响面审查，不把字符串相等或多一个引用冒充业务判断正确。
- 调用方已核验原工具输出中时钟侧对话的真实用户请求，以及Git仅此记录35行计划新增。CLI估算累计费用`42.4022432`美元包含上轮`30.534527`美元，本轮增量约`11.8677162`美元；不是外部账单核对，也不是业务模型费用。原失败和全部收据保留，不换账号、凭据或模型绕过限额，不立即重试。
- 后续安排上海时间2026-09-26 21:45恢复同一主管会话、同一四项目标，从本checkpoint继续；无需用户再次确认。恢复前核对是否已有同任务Claude，不能重复启动。当前四项总体目标未完成，行尾前向修复、完整出站验证和推送尚未执行。

### G30第4项实施 checkpoint：行尾前向修复与整链验证（进行中）

- `4ae54dbe`把`2a55323e`遗留的128个文件恢复为LF；`--ignore-cr-at-eol`差异为空，索引中已无CRLF或混合行尾。
- 整链验证先跑出站链触及的33个OpenCorvus测试文件与4个Python测试文件：Python 50项全过；OpenCorvus 29个文件通过，4个失败。4个失败同一原因：`50dcb47a`（G10）新增Mission Panel工具`panel_extend_task_acceptance`，而钉死Mission/Control精确工具列表的`catalog-index`、`host-session-runtime`、`native-mission-transport-base`、`session-loop-tool-authority-integration`未更新。`MISSION_PANEL_ACTION_IDS`包含该动作且Control本就持有全部Panel叶工具（含`resume_task`），所以这是G10的既定契约，按现契约补入列表后49项全过。
- 同类排查又发现两份过期钉住：`scheduler-message-harness-contract`的5条Mission原文条款（其中3条在`origin/main`上已不存在，说明该测试推送前就是红的；另2条因链上`c9aa1f18`/`d362e9a9`把terminal改为completed并合并句子而过期），按现文重钉；`session-loop-provider-tool-input`缺G6为续页新增的可选`cursor`。两文件11项全过。
- 因链上提交未跑全受影响测试，改为按“直接导入链上内容变更的41个源模块或`mission-core.txt`”选出146个测试文件做整链清扫，结果写入本checkpoint后再决定推送。

### G31：比较证据全集由宿主发现，Review显式取代（实施前方案）

- 契约审查事实：比较器有15处按槽位证据抛错（未声明/重复槽位、scorer集合、包版本、Campaign/Candidate来源、运行时、Run与Evaluation身份）和2处Campaign/Candidate配对错误。Owner必须提交与推导逐字相等的比较（门审计第一类），并自选来源；同一Evaluation可发布多份Review，同一槽位可有多份Evaluation或来自不同Trial的Run，同一Trial可被标到多个repetition。Engine Artifact的current/historical版本只用于核心原地投影；包产出按内容派生ID，没有既有取代原语。目录search支持精确类型过滤与游标分页，并报告`catalog_complete`与provider错误。
- 单一方案：Owner只提交空payload，以Campaign与Candidate为唯一两个来源；publisher分页搜索当前Task目录中的Run、Evaluation、Review，完整读取后只选择绑定到该Campaign/Candidate的证据，推导并盖章比较。目录不完整或有provider错误时拒绝发布（可重试）。绑定：Evaluation按其Campaign定位与候选臂的Candidate定位；Run按其唯一Campaign来源（G28）与包版本属于基线或本候选；Review按所审Evaluation。其它候选的证据不绑定。
- 槽位问题一律成为typed必需不可用维度而非抛错，比较始终可发布：`evaluation_invalid`（scorer集合或版本不符）、`evaluation_conflict`（同槽位多份Evaluation）、`run_revision`（臂标签与包版本不符）、`trial_conflict`（同槽位来自不同Trial的Run）、`trial_reuse`（同一Trial占多个槽位）、`run_runtime`（workspace/environment/model与冻结值不符）、`undeclared_evidence`（未声明的case或repetition）。同一Trial多次发布的Run取被Evaluation引用者，无Evaluation时取最新目录修订。测量或Trial的重复不是可在同一Campaign内更正的对象：预登记实验中重测或换Trial即偏离，诚实结果是该槽位不可用，合法更正是新冻结的Campaign，而原比较仍可发布，不被毒化。
- Review取代：新Review若以同一Evaluation的旧Review为直接来源即取代它。旧Review中每个failed或unavailable的blocker必须在新Review中以同category与invariant再次出现；结论改变时须引用旧finding未引用的证据，否则发布返回列出该blocker的typed错误（可自纠）。这只保证blocker不被静默丢弃、改判留下可审计的新来源，不证明新判断正确；语义仍归Auditor，比较保留被取代的Review为来源。比较只用未被取代的Review；同一Evaluation有多份互不取代的Review时取并集（任一不可用或blocker生效），后续一份同时取代它们的Review即可解除，不永久毒化。
- 非阻断失败：不影响决策，保留在Review中；Review现在是比较的完整直接来源并在历史详情逐槽显示，不改比较schema。
- 验证计划：比较单测覆盖每种typed维度、其它候选证据不绑定、Review取代后promote、互不取代的并集、同Trial重发布取引用者；真实host测试用空payload发布比较并断言盖章结果含已存在的冲突证据，真实publisher上验证合法改判被接受、静默丢弃blocker被拒；更新e2e支持脚本与测试以同一取代信息复算。限制：Evaluator从未收集的Trial仍不可见；跨Task导入的Evaluation仍不绑定（与现状同）。

### G31主管第二次额度中断与调用方复核（未实施交付）

- 2026-09-26上海21:47恢复同一主管会话，真实模型`claude-opus-5-5`；收据`.tmp/opus55-global-resolution-resume-20260926T1347.jsonl`。92 turns后CLI退出1、HTTP429、`terminal_reason=api_error`，原错误`You've hit your session limit · resets 2:40am (Asia/Shanghai)`；本轮时长2209.869秒。累计CLI估算65.7677364美元包含此前42.4022432，本轮增量约23.3654932美元，非外部账单。未启动业务模型/新世界/作者/Campaign。
- Opus只修改了G31比较器的一部分；新增的`currentIntegrityReviews`尚无实现，publisher/ABI/消费者/包身份/新测试未完成。调用方完整保存差异为[待续补丁](../../artifacts/2026-09-25-acceptance-comparison-design/comparison-evidence-in-progress.patch)（21988字节），审查后只对本轮从干净状态修改的`comparison.ts`执行单文件恢复。生产比较器恢复HEAD原实现；补丁未应用、未通过类型或行为验收。`git apply --check`通过仅证明差异可续用，不是功能通过。
- 对G31仍须解决两个具体反证：①同一冻结Trial的错误Evaluation被更正，不等于重跑Trial取优；把任何第二份Evaluation永久记冲突并要求新Campaign，可能使合法纠错永久不可采用。“仍可发布inconclusive”本身不能排除此问题。②Cycle3的既有事实已读齐，重新推导可纠正逻辑而不新增事实；硬要求新引用、以category与自由文本invariant严格相等定义义务身份，可能拒绝合法改判或激励无意义引用。这两点恢复后交回同一Opus审查，不机械应用待续补丁，不以这些假设已经成立为实现依据。
- Opus另交付[H-B预登记](../../artifacts/2026-09-25-acceptance-comparison-design/hb-01-preregistration.md)、隔离读取顺序补丁和真实loader检查器。真实检查回执`.tmp/supervision-causal-20260926/hb-local-design/checker-run/receipt.json`确认6文件、四项文件差异、两worker能力与三节点拓扑保持，设计包`2026.09.26.1`/`0a13f0021ee42d57a23d6c9052220966c61aaf7cae1bc0df99e06a574b2fdf62`；默认AutomationBench源`.14`未改。没有H-B运行freeze或业务Task。调用方纠正了预登记中“未见目标而方法正确即说明曝光牵连错误”的因果过度主张：单新样本只能符合预测，不能识别因果贡献；改判证据也区分新事实与旧事实重新推导。
- 已核验原始工具结果：Python受影响4文件50项通过；四个工具名单修正后49项通过；提示原文与cursor两项修正后11项通过；补充扫描发现Mission Skill前置工具声明遗漏同一验收延展工具，补源声明并仅同步general嵌入后`execution-authority-tool-surface`6项通过。146文件补充扫描在Claude退出后仍由本轮自有runner继续，不能把部分结果记为全通过；调用方继续收尾并在下面记录最终结果。没有停止或修改用户既有Claude/终端进程。
- 后续上海时间2026-09-27 02:45恢复同一主管会话；先读此checkpoint与最新任务prompt，核对无重复进程，从未完成项继续，不重做已交付调查。整体四项目标仍未完成，当前尚未push。

### G30交付检查补项：同步既有Artifact类别导出（调用方）

- 生产比较器恢复后根`bun typecheck`通过；lease owner、架构索引、package topology、docs检查通过。`api:routes-check`真实失败：G10提交`50dcb47a`已在唯一`engine.sql.ts`类型源声明`mission_acceptance_extension_request`与`mission_acceptance_extension_outcome`，原OpenAPI/SDK生成物却缺它们。触发为比较运行时生成OpenAPI与tracked版本，直接根因为该提交的生成同步遗漏，不是新增路由或运行时语义问题。
- 已查定义、`task-api`写入、`mission/acceptance-extension`读写、DDL完整性、现架构task-control-plane、routes检查器及`packages/sdk/js/script/build.ts`的现有事务生成器；SDK工作区修改前干净。补项仅运行唯一SDK生成器同步这两个既有类别，审查全部输出，重跑实际route库存与SDK类型检查。不会手写第二份schema、放宽运行时契约或改变比较/调度/业务判断；生成器的暂存/替换目标均限制在当前SDK package目录。
- 实际完整生成差异还揭示同一链上G6的`query_task_artifacts.cursor`/immutable目录说明与G10的`extend_task_acceptance`结构化输入未导出，非另一新增设计。JSON递归差异核对只涉及这两类动作定义及三个位置的两项Artifact枚举；共生成`openapi.json`、`sdk.gen.ts`、`types.gen.ts`三个文件，其余SDK输出逐字未变。真实SDK build及其事务暂存类型编译通过；`api:routes-check`重跑6规则/34文件通过，SDK独立类型检查通过。原失败保留在调用方工具记录；无新模型、服务或业务实验。
- 上述Skill/测试与SDK同步已范围提交`3d2c5283`。`check:release-mutation-topology --treeish HEAD`（5项权威）与`check:expert-squad-topology`（122 manifests/135 workflows）通过。
- 新的真实推送阻塞：`check:module-topology --treeish HEAD`对`3d2c5283`失败，13模块形成未许可跨边界循环；同一checker对`origin/main`（`4888dcccae6b`）通过，1118模块/5650 runtime edges/4 clean imports。关键环为`storage/db → goal-workload-analyst/relational-integrity → agent/artifact-provenance-facts → engine/task-artifact-observation → engine/task-lifecycle → storage/db`，还合入协议与项目模块。当前`artifact-provenance-facts`只需观察schema/纯比较函数，但同一观察模块顶层导入`taskLifecycleProjection`；该模块由本任务`373f4169`引入、`50dcb47a`后续触及。此为有源码和checker反证的待处理架构问题，不放宽拓扑检查、不把旧授权问题当作仍未解决。留给同一Opus继续完成影响面和单一依赖来源修复；暂不push。
- 22:50上海时间调用方核验扫描完整结束：146个文件均有DONE，145文件原次通过、唯一失败为第25个`execution-authority-tool-surface`，该项修正后已有独立6项全通过的原收据，不改写原扫描失败。逐文件时长合计2453.7秒不是全工程耗时；汇总及Temp原日志完整副本保存在`.tmp/supervision-causal-20260926/g30-closure/verification-summary.json`与同目录5个日志。精确命令匹配的本轮test runner/timeout与同任务Claude均已退出，未处理用户的其它进程。
- 最终生产比较器保持已提交原实现，未完成G31只以未应用补丁保存。SDK同步后的根类型检查再次通过（8个实际typecheck任务），实际API routes、SDK typecheck、docs342ops25groups、lease owner18/22、architecture index17、package topology10、release topology5及专家团拓扑122通过。当前唯一已发现且未修的推送验收失败是上述module-topology；不以其余通过绕过它。没有执行push、发布、安装推广或新业务实验。
- H-B检查器的独立类型检查通过：复用G23的真实package tsconfig与Markdown声明，只将检查入口换为`check-blind-expectation.ts`，`bunx tsc --noEmit -p .tmp/supervision-causal-20260926/hb-local-design/tsconfig-checker.json`退出0。结合此前真实loader回执，仅验证本地包设计与检查器，不代表H-B行为实验已经执行。

## G32：Codex接手，分离观察数据契约与生命周期读取

### Recall、根因与影响面（实施前）

- 用户最新指令“你自己接手弄，等opis上线了再交接”授权调用方在Opus限额期间继续实质工作，恢复后交接，不等待额度才修。起点`9010d5d7`工作区干净；原业务运行全部只读。先处理已复现模块循环，再继续总体问题，不把解循环等同业务纠错或进化收益。
- 现象与触发：当前module-topology报告13模块循环，上游同检查通过。`373f4169`把观察schema/纯值规范化/纯相等比较，与`currentTaskArtifactObservation`、`assertCurrentTaskArtifactObservation`这两个数据库生命周期读取函数放入同一模块；低层provenance解析导入纯契约时也加载`task-lifecycle → ProtocolStore/Database`，经`Database → relational-integrity → artifact-provenance-facts`闭环。此前功能测试可通过但未运行该整链拓扑检查；这不是某个业务案例的错误，也不是新调度状态异常。
- 已读当前task-control-plane的active/terminal观察约束、`terminal-lifecycle-reference-schema.ts`分层、Task生命周期实现、module-topology真实图与cold import入口、全部9个观察模块import点（7生产文件、2测试文件），以及G5/G10历史。纯消费者：provenance/read/review facts、Panel query schema、Mission extension schema；混合消费者：Panel Tool与Task API；测试覆盖观察schema、真实active→terminal→reopen失效、延展的完成/失败/取消/重启/多项目边界。
- 精确改动：将所有schema、type、refinement、规范化和相等比较**移动**到唯一`engine/task-artifact-observation-schema.ts`，与既有terminal schema分层一致；原`task-artifact-observation.ts`仅保留两个实时读取/校验函数并直接导入该纯契约。所有纯消费者和混合消费者的纯部分直接导入新文件，不保留旧模块re-export兼容路径。字段、Zod错误、生命周期读取、DB/DDL、API、权限和动作语义均不变；不添加状态、缓存、业务gate或白名单。
- 验收：已有正向schema与真实Mission active-repair/acceptance-extension两文件重跑，另跑真实provenance/agent-message证据检查；module-topology在工作树及提交快照验证图与4个clean imports，类型/docs/diff检查。重用刚完成的其余146文件结果，不无目标重复全套。若解环后出现另一条环或任何当前契约失败，按实际依赖继续定位而不放宽检查。

### G32实施与验收

- 已原样移动53行纯契约到独立schema模块，原模块只保留两个实时读取/校验函数，7个生产消费者与1个混合测试入口改为直接依赖所需层；旧路径不re-export，DDL/字段/API/权限/业务逻辑未改。首次补丁因架构段落定位失败整体未应用，确认源码未变后重试；首次差异检查发现新文件末尾多一空行，已移除，没有放宽检查。
- 暂存快照的真实`module-topology --index`通过：1122模块、5690 runtime edges、零多模块环、4个clean imports通过。根类型检查8项通过（7个无变化package缓存、当前opencorvus重新检查）。真实四文件9项/108断言通过：active-repair 3/38、extension 2/50、provider-input read facts 1/8、agent-message证据3/12；保留active/terminal/reopen的原身份与失效错误合同。原日志`.tmp/g32-module-topology.log`、`g32-observation-tests.log`、`g32-typecheck.log`。
- `api:routes-check`6规则/34文件通过，证明公开导出与现有生成SDK一致；docs342ops25groups与diff通过。此为依赖分层与交付闭环修复，无新模型或业务运行，不构成业务纠错或进化收益证据。提交后继续pull/merge、完整出站核对及真实pre-push检查，全部通过再自动推送。
- `e3910e40`已提交；pull up-to-date并复核完整64项出站集合后，真实pre-push的根类型、API、docs、lease owner、architecture/package/release/module topology与secret scan全部通过，`4888dccc..e3910e40 main -> main`推送成功。提交快照仍为1122模块/5690边/4 clean imports。原“他任务未知”与模块循环推送阻塞均已解除，继续业务/测量机制工作。

## G33：比较派生事实由唯一发布器盖章

### Recall、影响面与方案（实施前）

- 延续用户要求Codex接手直至Opus恢复；主线第4项已完成交付，接着处理第3项测量事实的重复所有权。G31全目录发现/取代方案仍待语义审查，本次不机械应用待续patch、不声称已解决择优。已读plugin存储/发布Schema、publisher全部分支、唯一比较器、Owner指令/Skill所有权、Mutation/history/e2e消费者、真实Host测试、2026-08-17所有权拆分史及门审计。
- 真实根因：比较publisher先从所选不可变Campaign/Candidate/Run/Evaluation/Review算出完整`deriveComparisonRecommendation`，却只用它与模型逐项重抄的payload比较，再把模型payload存储。模型没有拥有这些统计数值的事实源，错误字符串不能给出整份正确高熵结果；Run与Evaluation已经采用空/最小输入+宿主盖章，comparison尚保留同类重复。历史门审计明确标为待改。此问题影响发布输入、role指令、包闭包和真实发布测试；不涉及Task/Mission/Session调度、业务语义、既有存储Schema或晋升授权。
- 补充反证：当前Evaluation已从immutable metric receipt盖章，Evaluator不能手抄错误scorer值；2026-08-17明确单slot一个Evaluation。因此G31关于“错误Evaluation同Trial更正”的争议须进一步落到真实可重复指标执行/receipt身份与可用性变化，不能凭想象新增任意修订API。Review来源选择、并行审查及显式取代尚待独立解决。
- 单一改动：新增空对象的Comparison**发布输入**Schema并替换原输入分支；publisher校验原有角色/来源与槽位身份后直接把唯一比较器结果赋为payload并发布，删除模型复述/逐字相等分支，不保留双输入。Owner仍负责当前协议的来源选择和结果解释；源集合完整性/重复槽位规则/统计公式/推荐规则全部保持，既有Comparison存储和历史读取格式不变。
- Owner发布后必须完整读回真实Comparison，再从同一结果渲染文档/图，不再要求提前自算传入派生字段。同步README、所有权文档与历史门审计对应状态，Evolution Lab版本至2026.09.26.4，仅同步该包生成闭包；默认目标包、权限、工作流均不改，不安装推广。
- 验收预测：现有真实DB/collector/metric/Review/publisher测试只交空payload，原版应明确因缺比较字段失败；修复后发布成功且读回逐项等于该夹具独立登记的完整比较结果（包括原failed Trial、缺候选、blocker/非blocker未观察和unknowns），不以调用比较器自行计算期望替代断言。再跑原39项比较规则、包投影和相关晋升/历史e2e合同、类型/包拓扑/docs/diff。没有真实Campaign或业务增益结论。

### G33实施与验证

- 真实原版红测为8通过/1失败：空payload经原发布入口精确返回缺comparison字段错误，日志`.tmp/g33-publisher-red.log`。修复后真实publisher成功并完整读回，逐项匹配独立列出的比较结果；保留原前驱校验与唯一统计实现，仅删除模型复述及其相等门。
- 首轮9文件有一处过期版本断言（写死`.3`，实际嵌入`.4`）失败，原日志`.tmp/g33-green-tests.log`保留；同步当前明确版本后该文件9项/95断言全部通过，见`.tmp/g33-host-final.log`。其余8文件原次全部通过，包括39项比较、真实包投影、晋升mutation、历史e2e解析、链修复、候选surface与feedback。合计93项/503断言，不把初次失败覆盖成通过。
- 源包与嵌入包同步到`2026.09.26.4`，content digest `8e5a56e736edf3a4895e7fea1961e8eca848fa10cc48dfc743bbbb6704182845`；采用现有payload/revision生成器只更新Evolution Lab项，其它设计包/默认包保持。真实loader检查源包/嵌入/登记身份一致。根类型8项全部实际检查通过；专家团拓扑122 manifests/135 workflows、docs342ops25groups与diff通过。当前架构02-data同步单一发布所有权。
- 未启动新业务模型或Campaign，Review完整发现/取代仍未解决，业务纠错与进化收益仍未证。G31归档patch继续未应用；本项不以更多引用或字符串相等代替业务判断。

## G34：Codex接续既有H-B预登记的执行准备

### Recall与执行边界

- 用户明确要求调用方在Opus额度恢复前接手推进，恢复后交接。G32已完成整链推送，G33消除比较结果重抄；本段按G31已提交的[H-B预登记](../../artifacts/2026-09-25-acceptance-comparison-design/hb-01-preregistration.md)继续业务诊断，不重新设计或恢复任何旧run。唯一改变仍为前置方法先于目标记录值/说明读取，原世界、请求、角色、权限与后续执行保持。实际干预以真实读取/发布顺序判定；一个样本不能识别锚定因果效应或总体可靠性。
- 已重读原Repair01外侧义务、Inspect当前架构、唯一controller、driver的冻结源/Host预检/公共cleanup路径和H-B四文件补丁。controller沿用`run-repair-01.py --run-dir`；新目录`.tmp/supervision-causal-20260926/hb-01`，不创建另一控制器。新源码经提交及push前完整检查后冻结；运行中不改源码/spec，不并行交给Opus编辑。
- 本次真实入口构造收据`.tmp/supervision-causal-20260926/hb-01-preparation/entry-construction.json`：调用原`load_development_fixture`与registered `opencorvus_business_repair`，实际sample ID和1844字节公开input一致、scorer=None、Mission配置、300秒真实无活动/poll2正确。六文件staged与G31真实loader的immutable目录逐字相等，包`2026.09.26.1`/`0a13f002…`；完整49个world键=meta+48服务字段，meta内原四连接权限与clock、原Sheets跟踪保持。没有执行solver、API world或Provider。
- 2026-09-26 23:36上海本地只读核对授权auth/models成对存在、OAuth未过期、目录精确含gpt-5.6-luna；未复制/刷新或输出凭据内容。启动前精确命令行扫描没有本任务Claude/controller/Host/Inspect活动，未操作旧PID或其它用户进程。启动后的真实Host仍必须逐项usable/projected/actualModel/streaming预检，静态存在不能替代。
- 下一步骤：独占创建新freeze，绑定准确干净HEAD、既有fixture/request/source receipt/包receipt/控制脚本/六探针以及本次入口收据，再且仅再启动一次。正常或失败均不替补；先核对公共cleanup、零活动、正常退出与复制件删除，再按预登记逐项解释原API/Artifact/dispatch/最终state及全部成本。若运行跨过Opus恢复，交接只读监督当前run，不能重复启动或边运行边改源码。

## G35：H-B结算——提前搜索曝光，干预未执行，错误状态仍被接受

### Recall与新增事实

- G34唯一新运行以`b9e1743f`冻结，15:42:15–15:54:20 UTC自然结束，实际包`.26.1/0a13f002…`正确；Task `tsk_g00VWLEvvX000Oj49XAR` completed、Mission `3c9c6f83e78ff535` accepted。15:56实际核对公共cleanup零活动、Host stopped、精确命令行本轮进程全退出、auth/models复制件实际删除，`hb-01/audit/closure.json`保留。后续不重复查询已停日志，原run不恢复/补跑。
- [完整结果](../../artifacts/2026-09-25-acceptance-comparison-design/hb-01-results.md)按预登记判为**读取顺序干预未执行、业务修复未达成**：前置verifier主动在事件3的SOSL搜索声明RETURNING Account, Opportunity, Case, Task，15:44:34.864返回目标20,000与完整580字节错误Description；方法`art_hX8xSOJQI3YIoj11wt4X`到15:45:50.271才发布，实际首次新executor派单15:46:50.597。方法如实写了提前曝光，不能把后来的exact ID GET较晚说成未曝光；本次对锚定必要性没有合法新结论。
- 三角色实际分别读Gold、4Contacts、pricing邮件（事件9/21/26含Base prices remain unchanged）、health policy/Case；仍未读Drive/Sheets，方法与执行/最终比较都判4×5000=20000。scheduler/两个worker完整读方法并真实引用；最终派单把20,000与七项读取列为待核关系，末verifier将所选子集当覆盖完整。没有独立重选价格关系、continuation或Mission resume，29业务事件=6search+23GET，另3catalog仅文档。完整最终state与初态逐值相等，连last_modified_date也未变；原身份/已满足字段/无关记录保持，错误金额及说明未修。
- 原Task complete与Mission accept均真实发生。Mission首次完成因read-ref拼写错误失败，修正后接受；另一次read_task_message把ingress Artifact ID当Message ID失败。API事件2的SOSL送到query入口返回MALFORMED_QUERY，后改search；它是Tool completed中的业务错误JSON，不混成宿主Tool失败，不删请求。这些协议/调用纠正不是定价纠正。健康政策对既有机会的范围与原年份歧义单列。
- 88请求/88usage全流式LunaHTTP200、usage数量差0；input514832/output18721/reasoning2677/cache-read2630400/cache-write0/total3166630。79全Tool=77completed/2failed，sample702.841秒/controller725.274秒。activity85行与88真实请求并列；本地priced/cost0非账单或免费。历史各轮成本不拼分、不作为同起点随机对照，未推广或晋升包。
- 原eval与DB只读（mode=ro/query_only）；派生`audit/final-chain.json`、`business-review.json`、`artifact-reads.json`、`assessment-check.json`包含29个原事件与Tool请求逐项对应、真实结果/原Message/Artifact/usage和全state。外侧核对器按已登记观察判定通过，不是业务成功。初次提取误查generic part得到空Tool计数，已从唯一tool_part_outcome/permission_execution_result补齐；初次参数对比因MCP把params字典序列化为JSON字符串失败，明确解码运输字段后全部对应，原参数均保留。

### 本段后的实际工作

- H-B这一运行路径按预登记结算，不增加同义提示/隐藏目标/过滤返回再抽。当前未知仍是锚定、来源选择、指令执行与关系判断的贡献；Cycle3读齐仍错不能被目录问题解释。整体可靠纠错/进化收益未达成。
- Codex继续第3项真实问题：Review完整证据发现、显式取代和比较事实传递。G33仅交付确定性派生字段盖章；G31归档patch未应用。先以现有Catalog/Artifact/metric receipt/晋升读取语义确定可审计的改判与完整性契约，再实施正向Checker，不以category自由文本相等、无意义新引用或增加Host业务gate解决。

## G36：Review来源子集的真实发布反例与取代边界

### Recall与有界诊断（生产实现前）

- 用户要求Codex继续实质解决Review多证据选择/取代，Opus额度恢复后交接。H-B已按登记结束，不再启动模型/world。起点`ce3788b5`干净且已push。本段先把已定位的来源子集问题放进真实publisher/DB/完整读取路径，而不是把G31的假设直接编码为新门。
- 已查当前plugin Review/Comparison输入和存储Schema、publisher身份/来源/slot校验、比较器所有索引与可用性规则、Auditor/Owner/Skill、2026-08-17所有权拆分、catalog与plugin-tool-host实现、history和promotion消费，以及真实Host/39项比较测试。原合同每Evaluation一份Review；publisher没有这一唯一性限制，comparator只拒绝**选中集合**的duplicate slot，Owner可交不同子集。promotion只消费选定Comparison的推荐和required维度，不能自动补回未计入的Review。
- Catalog已有单一分页事实：首page固定engineCatalogRevisionUpper与source membership，cursor后续沿同上界，成员漂移报告provider error；新发布不进入旧snapshot。它可支持“该snapshot的完整集合”，但不能把一次分页称作一直到未来promotion都新鲜。现有producer/来源scope必须保留；不得把其它Candidate/Task或未读取的记录混入。
- Plugin Host真实publication来源由同Turn已选择来源和本次完整read/select合并，publish参数本身不是另一个来源权威；比较器目前只计算模型参数中的子集。因此即使实际envelope额外保留了另一个被选过的Review，派生字段仍可能没有消费它。诊断必须同时读回payload与envelope，不能只看source列。
- 本地诊断：在现有真实Host fixture完成原Review和Comparison后，对同一原Evaluation再以真实Auditor发布`reviewed/findings=[]`的新Review，随后Owner分别只以这份Review、以及两份Review调用现有publisher。记录返回的实际required维度、unknowns、source集合和精确错误。此fixture本来缺candidate，所以不能冒称它从inconclusive变promote；它只能证明选择可删除已声明的安全未观察维度。实际推荐影响沿已有完整正向比较测试的blocker契约另行界定。
- 诊断仅临时增加测试驱动观察，先逐字保存原测试，运行标准隔离测试入口、落盘结果后精确恢复本任务插入；不修改生产代码/存储或业务原件、不保留针对错误行为的回归断言。新方案须基于结果明确单一当前Review和**显式**取代、同证据逻辑改判与并行分支关系，不能用默认最新、仅引用、自由文本相等或强制新事实代替作者判断。

### G36真实反例与单一修复设计（实施前）

- 诊断9项/95断言通过，实际两份Review都经同一publisher持久化。只选后发的reviewed/空findings后，原`integrity_finding:case-1:baseline:0:security:1`与side_effect未观察维度及原unknown消失；两个Review一起输入则精确报`EvolutionArtifactIntegrityError: comparison has duplicate review slot case-1:baseline:0`。两次仍inconclusive（fixture缺candidate），不夸称此checker已产生错误promote。日志`.tmp/g36-review-source-probe.log`、完整产物`.tmp/g36-review-source-probe.json`；临时测试补丁单独保存后核对只有本任务47行插入并恢复原字节。还证实后发comparison的实际envelope仍列着先前选择过的Review，而其payload未消费它；增加引用数量本身不能修复。
- 单一当前Review契约：在原`integrity-review` payload上增加可选的`revision`声明（`supersedes`确切Review locators、非空`reason`）。它是当前协议的可选**改判操作**，初始/独立Review不填写即不取代任何记录；不按版本走兼容分支、不将“最新”或普通source引用解释成取代。旧不可变Review字节不改，仍表示未声明取代。Auditor拥有改判理由及完整新结论，Host只校验父记录真实/同Evaluation及slot/确切直接来源/无环，不判断理由正确，不要求新业务事实或强制finding文本同名。
- 当前关系由唯一纯函数从不可变Review和显式revision边计算，返回current与superseded原记录；不新建ledger/角色或合成Review。分支并发时全部未被明确取代的Review都继续有效，typed failed/unavailable blocker按原规则影响比较；一份后续Review可显式取代多个分支并用既有来源重新推导，合法更正能解除它们。循环、缺父、跨Evaluation或slot是明确身份错误，不是业务gate。
- 比较发布输入继续空payload；Owner选Campaign/Candidate/Run/Evaluation，Review不再由它挑子集。publisher在现有current Task catalog一次冻结分页中精确枚举Review，完整读回，绑定到本次Evaluation集合，校验Auditor及原来源后选择全部相关Review（包括被取代的历史原件以保留来龙去脉）。只消费current原记录，但存储全部来源。目录不完整/provider error返回明确可重试错误，不能把查不全当没有。仍保持Run/Evaluation原冻结slot身份及单测量规则；不借本项改变实验取样。
- 比较器和history共用该纯关系函数；history按唯一current Review填原单项投影，分支时单项为null并通过新的review_history逐项展示真实current/superseded身份与原payload，reviewed slot计数按slot而非产物个数。没有伪造合并Artifact。未观察dimension包含原Review身份以区分同slot同category的多个finding。
- 范围限制明确：这是某次comparison发布所用catalog snapshot的完整Review集合，不承诺未来永无新证据。现有promotion消费者对后来新增证据的新鲜性复核另需沿共同mutation权威审查，不把本项局部修复写成全部进化闭环已好；历史Comparison不重算。跨Task导入的原Evaluation相关性保持当前契约，不凭旧DB ID跨域借身份。
- 正向验收：真实Host发布第二份独立Review后，即便Owner不提交它，原blocker仍进入comparison；显式基于原证据取代两份后产生准确解除后的矩阵，普通引用不取代。纯比较器覆盖并列blocker、同证据改判、合并分支、缺父/循环/错slot错误合同；history保留真实修订链。原39项统计/typed维度、实际包投影/晋升与源嵌入/类型/API生成/docs/拓扑复验。只使用明确test-driver，没有新模型、Campaign或包推广。

### G36实现与已完成验收

- 已实现单一`packages/plugin/src/expert-squad-evolution-review.ts`关系解析器，比较器与history共用；无新ledger、角色、模型调用或业务gate。Review的optional revision只表示是否声明改判，既有未声明记录不被改写、不默认取代。publisher在持久化前校验重复父引用/同Evaluation与slot/父记录角色与直接来源；比较消费全部current分支，未观察dimension包含原Review ID。解析器对缺父、错scope、环、重复父给出精确错误。
- Comparison输入不再接受Owner选Review子集；生产publisher真实分页查询current Task的Review目录，沿同一cursor快照，完整read后只把绑定所选Evaluation的记录加入source并校验。其它Evaluation的Review仅被观察，不混成当前来源；相关Review无有效Evaluation身份则明确报错，目录不完整不可冒充空集合。原Run/Evaluation slot规则与统计公式保持。
- 真实Host checker覆盖102份同Evaluation原Review跨两个目录page，Owner不传Review列表仍准确保留原blocker；普通引用旧Review不取代，显式revision用同一原始证据合并全部分支后矩阵按新判断解除原维度；全部旧/新locators均在实际持久化source集合。重复父输入在写入前返回明确错误，防止写入无效关系后阻塞后续比较。最终Host9项/105断言通过，`.tmp/g36-host-verified.log`。
- 纯比较46项/145断言通过（含原39项与7个新关系/错误合同）；真实promotion/restoration/history1项/25断言，新的Review在原measurement不变时支撑派生promote，history逐项显示旧superseded与新current，原Task版本pin不变；包投影1/40，历史e2e消费14/33，相关链修复3/13。合计74项/361断言；是无模型test-driver合同，不是实际自主Campaign或收益证明。原6文件汇总`.tmp/g36-final-tests.log`，后续分页与重复父补验以上述最终Host日志为准。
- 根类型8项实际检查通过；docs342ops25groups、API routes6规则34文件、专家团拓扑122/135通过。唯一SDK生成器build通过，只改变OpenAPI和generated types两文件；递归JSON差异限定于evolution-history/detail的Review revision、review_history及对应required字段，没有新增路由。没有UI代码或UI自动化测试。
- 源/嵌入Evolution Lab同步`2026.09.27.1`，content digest `6e9398066a58346de1e98f6e2d70f5a4853bfd240b278822dba514fcef5cb8b6`；同步Auditor/Owner/scheduler及Campaign Skill，删除通用“已有有效Artifact永不重发”对Review合法改判的阻断，保留测量不重跑择优。只更新本包生成项，其它base/AutomationBench漂移不夹带。当前架构02-data同步，未推广安装。
- 保留检查器失败：未同步生成物时真实source/embedded身份检查失败；本地同步辅助脚本一度以未提交的中间生成版本为发布基线而拒绝同版本更新，改为读取HEAD中的真实已提交基线后完成同一个尚未发布的新版本，未改任何已发布包。第一次相关日志`.tmp/g36-host-tests-initial.log`、`g36-host-final.log`及`g36-package-sync-final.log`保留；最后真实source/embedded/登记身份检查通过。差异只在本任务文件内；部分已触及TS文件随格式化产生排版变化，未改变其余逻辑。
- 仍未交付：比较发布后新证据出现时，promotion新鲜性与完整权威复核；Run/Evaluation全Campaign集合的选择与重复Trial边界。G36不宣称这些已根治，历史Comparison不重算，业务可靠纠错/进化收益仍未知。下一步沿现有mutation授权/检查/提交同一链审查这些事实边界，不通过新业务样本掩盖。

## G37：晋升提交时的 Review 证据新鲜性

### Recall 与实施前影响面

- 用户要求Codex继续实际开发，在02:45上海以后交回准确Opus5.5；本轮沿G36剩余边界工作，不开新业务模型/世界/Campaign，不修改历史Artifact。验收是旧Comparison在相关新Review出现后返回可审查的证据身份差异，新Comparison仍可支持合法晋升，已提交回执的重试/恢复继续返回原事实；不将此称作真实进化收益。
- 已读AGENTS、主记录Recall/五段机制图/G35–G36、02-data当前架构、Review publisher/resolver、Catalog冻结分页、mutation-intent/mutation/authorization、manager安装锁/journal/回执恢复、history冻结读取、真实mutation测试。全仓查到晋升/恢复只经server两入口及此mutation权威；feedback工具复用prepare但有独立授权语义。没有UI改动，不运行UI自动化。
- 可观察触发：Comparison发布后，同Task同Evaluation发布新独立或显式改判Review。prepare只核对原Campaign/Candidate/Comparison身份、promote、required为空、CAS和Project，没有当前Review集合；authorize和execute复用该旧事实检查，history也仍提供旧promotion_intent。G36保证一次发布快照完整，无法保证之后未出现新事实。先在原实际DB/包安装测试驱动复现“授权后新增blocker→执行旧Comparison”的真实安装结果，再限定结论。
- 共同控制流横审：mutation授权基于真实root operator消息；执行先验证授权，再查确定性已提交receipt，未提交才进入包安装锁。manager先恢复journal，再CAS/暂存/rename，durable receipt是唯一提交点。未提交的异常或重启按原journal回滚，已有receipt则保留已装版本并清理。Task创建会先恢复未完mutation；Project/session归属、project/global范围、feedback/restoration走原规则。不能把新鲜性检查放在receipt重放前，否则后来Review会破坏已完成操作的幂等恢复。
- 拟议单一修复：对Comparison确切Evaluation来源，按同Task当前完整Review身份检查其是否都已进入Comparison来源。检查只回答身份/完整性，不判断findings真假或新记录优劣；新增空结论也需新的可审查Comparison，显式更正可由新Comparison解除旧阻断，旧Comparison字节和推荐保留。不同Evaluation/Task不混入；物理版本变化按确切locator区分，不用时间/版本号/自由文本代替一致性。
- 校验点：authorize前与未提交execute前快速复核；在既有durable receipt写入的同一个SQLite immediate事务再次复核，使并发Review写入与晋升提交有确定顺序。若安装期间出现新Review，原manager无receipt回滚真实包；若receipt已提交，之后的新Review不倒改历史或自动卸载。恢复重放只重现原回执，不再进行新的晋升授权。history在自己的冻结目录上调用同一纯差异计算，保留原推荐同时以结构化问题停止提供该快照已知过期的promotion_intent；真正执行仍重读当前DB。
- 边界：此次不修Run/Evaluation集合选择、不重算历史比较、不增加Review ledger或角色，不修改manager已有journal协议。来源集合齐全不证明历史payload曾正确派生，也不证明业务判断正确。若真实反例或检查否定方案，保留证据并调整，不制造新的运行门。
- 计划正向Checker：旧版实际安装反例；新增Review后authorize/execute精确错误与缺失locator；安装到提交间真实新增Review触发回滚并读回baseline；同证据显式改判后新Comparison安装；提交后再新增Review仍可重放同receipt/恢复；其它Evaluation/Task不影响当前比较；原异常恢复/串行重放/多Project/feedback测试复验。类型、API生成（如schema变化）、docs/diff和实际pre-push随后验证，范围提交/pull merge/审完整出站后push。

### G37原版反例与实现复核

- 原版真实DB/包manager路径确实完成了过期晋升：Comparison原recommendation=promote，真实授权后向同Evaluation新增security/failed/blocker独立Review，再执行原请求，返回durable promotion receipt并实际读回candidate安装身份。对完整新集合调用原唯一比较器仅作诊断，得到inconclusive；没有覆盖原Comparison。原始收据`.tmp/g37-stale-promotion-probe.json`、日志和临时补丁保留，测试源核对只有本轮插入后精确恢复。该反例使用明确合成test-driver，证明安装权限消费过期证据，不是模型自主行为或业务收益。
- 新鲜性计算只比较当前相关Review的确切locator是否已在Comparison来源中；mutation与history共用`missingComparisonReviews`。授权预检、未提交执行和最终receipt immediate事务共用当前DB读取权威；receipt已存在时直接走原reconcile/重放，不倒判。审查时发现前置执行拒绝还可能留下旧journal，因此未提交执行先调用既有manager reconcile，恢复原包后才检查新增Review；不新增journal/安装状态。
- 首轮修后真实测试回归路径通过，但新history测试错把detail字段写作comparison而非record中的comparison，抛TypeError；改用公开ResponseSchema真实字段后2项/46断言通过。保留`.tmp/g37-mutation-initial.log`，这属于test-driver错误，不放宽生产协议；后续补测中断后新证据与全相关合同。

### G37已完成验收与限制

- 真实mutation三条路径3项/69断言通过：原授权/安装/崩溃恢复/恢复旧版/Project与global隔离；新Review在授权前后导致精确身份错误；实际rename后、receipt前发布Review使原manager回滚并读回baseline；中断遗留candidate先reconcile到baseline再返回过期错误；同原证据显式改判与新Comparison真实安装；commit之后追加Review仍重放同一receipt及安装身份。旧Comparison payload逐值保持。另一Evaluation与另一Task的Review不影响当前Comparison；新鲜性并不因此保证Run/Evaluation全集，那个问题仍待审查。
- history真实读回保留promote原结论并公开REVIEW_SNAPSHOT_CHANGED和null promotion_intent；原目录上界读取仍保留当时的promotion_intent，不回写历史。新的纯差异实现由当前DB提交与冻结history共用；没加安装状态或第二证据ledger。HTTP沿既有ExpertSquadPackageError包装保留完整NamedError名称/身份数据文字，未新增路由或HTTP状态。
- 五文件聚焦检查合计68项/397断言通过：mutation3/69、manager CAS与project/global隔离1/30、feedback9/48、真实Host publisher9/105、comparison46/145；`.tmp/g37-focused-tests.log`。最后缩小测试排版差异和限制新增提前reconcile只用于promotion后，mutation3/69再次通过，`.tmp/g37-mutation-final.log`。根类型8项、docs342ops25groups通过；所有检查无模型/业务费用，无UI代码/自动化。
- canonical SDK生成器完成；OpenAPI递归结构对比只新增history与detail中6处REVIEW_SNAPSHOT_CHANGED联合分支，原其它字段和值相等，`.tmp/g37-openapi-changes.json`。文本大diff来自嵌套联合展开/对齐，不是新增其它API；生成types同步。没有修改专家团源码或嵌入包，真实Host source/embedded身份检查仍通过，Evolution Lab保持2026.09.27.1，不新增候选或推广。
- 安装commit时的Review全集一致性已本地验证；先后顺序由原SQLite immediate writer事务与原manager journal确定，检查器通过真实持久化插入控制交错点，不冒称真实并发模型试验。后发Review不自动卸载已提交包，既有restore授权仍可按确切已安装回执恢复。历史Comparison即使sources齐全也未必曾正确派生，本修复不重算它；G33/G36前的错误派生不靠新增引用数量治愈。真实可靠业务纠错与进化收益仍未达成。

## G38：Run/Evaluation 集合与测量重复的边界

### Recall 与诊断前影响面

- 用户要求继续有依据的机制开发，Opus额度恢复后交接；不重复G36/G37或真实业务样本。当前验收先区分相同测量的多个发布身份与不同测量，不以全部第二份证据错误、默认最新或挑最好作为方案。尚未决定生产修复；先经真实Host发布反证。
- 已读当前publisher Run/Evaluation/Comparison路径、collectTaskRunEvidence及collectTaskRunUsage、execute-evolution-metrics、Plugin Host source合并、artifact-catalog idempotentExpertPublicationIdentity、比较器slot校验、Campaign Skill/Evaluator和2026-08-17测量与Review所有权拆分。搜索覆盖Task终态/current occurrence、metric receipt、真实Host测试和当前history/mutation消费者。当前Run从fresh collector+ProviderUsage账本盖章，Evaluation完全投影immutable metric receipt，模型不能填写scorer值。
- 明确事实：通用idempotent publication身份包含完整source_artifact_locators，Plugin Host合并真实Turn与本次已选择来源；同payload/resource在后来新增来源后可能产生不同Artifact身份。同一terminal Trial在usage账本追加后重新发布也可能有不同token/cost（G28测试真实覆盖），这不同于重新执行业务任务。collector要求当前terminal occurrence，同Task恢复后不能用旧terminal引用重新采集当前状态；旧Run Artifact仍是当时不可变观察。metric工具的iteration属于评价调用，不是预登记Trial repetition。
- 比较只检查Owner输入的Run/Evaluation，重复slot一律报错；Evaluation中的Campaign/Candidate/Run确切引用已校验，Run通过envelope直接Campaign及package/runtime事实关联。Campaign当前没有预绑定全部Trial Task IDs的执行清单，目录完整只可能证明已发布的集合，不能证明没有未公开执行。新机制不得伪造这种更强保证。
- 诊断以原真实Host测试为driver：完全相同Run收据在新增已选来源后重发；完全相同metric receipt重发；对比payload/resource与实际publication identity；保留原单份比较与同时包含两份时的精确输出/错误。另外读取原已发布不同usage观察及其它Trial事实，确认完整发现不能机械套用“所有同slot都为不同样本”。仅保存新隔离诊断收据，不改原实验、评分或生产源码；再据实际结果落盘单一修复方案。

### G38真实反例与实施选择

- 已复现真实Host两次发布：Run与Evaluation各自payload逐值相同，仍分别得到不同Artifact ID；因完整来源集合新增了原件等已选择证据，符合通用publication identity，不是hash碰撞。把两份Evaluation一起交比较器，报`comparison has duplicate evaluation slot case-1:baseline:0`；原单份仍可正常比较。这不是两个Trial或两次measurement，不能为了目录完整性将它们永久判冲突。收据`.tmp/g38-identical-measurement-probe.json`、log、临时patch保留；9项105断言通过仅证明原诊断正常执行，不表示修复验收。首次driver误用不存在的candidateReceipt变量，allError是ReferenceError；已另存initial收据并改为真实candidateSource后复验，不能拿首次错误当业务证据。
- 同一真实Trial另有原G28追加usage后发布的Run：token从80变100、cost从1.25变null。这些payload不相同，必须保持不同观察，不能因为Task/slot相同就合并；不同terminal occurrence、新Trial、不同metric receipt同样不自动合并。当前没有足够协议事实授权“最新/最佳”胜出。
- 本轮先实现完整集合处理的必要前提：唯一typed measurement grouping按slot及**完整已验证payload**将事实完全相等的Run/Evaluation发布别名归为一组，保留全部真实locators/producer原件。只有一组时才有一个测量值；locator稳定排序只选展示代表，不选择业务优劣；不同值/收据/Trial保持多组，比较器继续返回明确冲突，不能捏合平均或抹掉旧观察。无需改通用publisher identity或新增ledger/模型/角色。
- 比较器以这些组计样本与统计，Run/Evaluation交叉引用接受同一事实组内确切别名；Review仍引用自己原Evaluation且保留显式改判语义，来自等值Evaluation别名的独立Review全部进入判断，不凭代表选择漏掉它。history共用分组，slot显示完整真实别名集合；冲突时不伪造单项或分数，返回明确图问题。原Comparison不重算。
- 全目录发现不能先机械套上旧duplicate-slot错误再称完成；本提交仅解除已证实的表示重复障碍，Run/Evaluation全集发现和后发测量新鲜性仍作为随后独立实施边界。该分步不依赖Opus上线；当前继续有依据地完成本地实现/真实Checker/包同步与提交。未发布Trial执行是否完整仍无预绑定清单，不能由目录伪证。

### G38实现中的真实边界检查

- 已实现唯一`groupEvolutionMeasurements`，比较与history共用。它只归并完整typed payload相同的别名，保留各原记录；不同事实不被时间排序取代。展示代表按locator稳定排序，仅在值相等的组内使用。比较的Review关联接受任一Evaluation别名，Evaluation→Run关联接受任一Run别名，统计及成本按唯一事实计，不按Artifact数量加权。
- history增加run_aliases/evaluation_aliases；只有一个事实组才有单项。多组时保留MEASUREMENT_OBSERVATION_CONFLICT和所有原locators，slot的scorer展示为conflicting_evaluation_observations未可判定，原Evaluation数值与历史Comparison不改。这个投影不把已测原值抹成null，原件仍在完整候选证据目录内可读。
- 新实际history检查发现另一个相关旧缺口：只要求Campaign来源的合法Run/基线Evaluation，即使被Comparison直接使用，也会因缺Candidate直接来源被标成unlinked。修为沿已归属Comparison的真实直接source边建立可达性，未给原件补Candidate引用。首轮纯比较52项通过；mutation原roundtrip在该误报处失败，另两条真实freshness/recovery通过；保留`.tmp/g38-local-initial.log`。修复后mutation3项/73断言通过，包含别名计数不膨胀、精确别名原件、保留历史多观察冲突和G37全部恢复合同。
- 本轮未改变测量发布identity、评分器、metric receipt、终态或Trial运行规则。Evaluator不能重写数值，Review显式取代仍限原确切Evaluation。全文档发现与后发等值Evaluation别名上的新Review关联仍需下一步完善，不能将本轮局部别名支持称为集合闭环完成。

### G38验收与交付范围

- 最终65项/380断言通过：比较52/157（原46及6条新增别名/差异观察合同）、真实mutation/history3/73、真实Host publication9/110、包投影1/40。Host实际重发同一collector和metric receipt，得到不同publication身份但完整payload相同；同时输入全部原件/别名后比较payload与原单份逐值相等，四个原locators都在真实持久化source中。等值Evaluation别名上的另一个failed blocker Review仍可改变结论；不是根据代表省掉反证。数值不同的usage、新Trial/terminal、同值不同metric receipt保持冲突。日志`.tmp/g38-focus-tests.log`、`g38-host-final.log`、`g38-comparison-final.log`；展示排序改用code-unit顺序后比较重验通过。
- 根类型8项通过，docs342ops25groups/API6规则34文件/包拓扑122manifest135workflow通过。canonical SDK生成完成，结构差异仅history/detail的6处MEASUREMENT_OBSERVATION_CONFLICT分支、detail的两个alias字段及required列表；`.tmp/g38-openapi-changes.json`。源和嵌入Evolution Lab同步2026.09.27.2，content digest754f3a9c73e8c97bfcd4747d2ace4c34e8f36102ab847f09808e31ebc244a29e，仅同步本包。默认AutomationBench/base、已发布历史包与原实验均未修改，未安装推广，没有新Provider/业务费用或UI自动化。
- 另保留一次旧版本测试期待：包已生成.27.2时Host测试仍期待.27.1，8/9通过；更新此当前版本期待后9/110通过，没有为旧断言保留旧代码。第一次诊断driver变量错误和history真实可达性失败的原日志也保留，不混算为模型失败。
- 未完成项准确保留：Owner仍可挑Run/Evaluation子集；published目录完整性不等于Trial执行全集；后来相同payload Evaluation别名上的新Review也需要跟随别名全集发现；不同usage/occurrence的合法后续观察尚无可据以默认取代的测量契约。G39须先据这些原事实追完整发现/当前安装权限，不能机械apply旧G31 patch或靠“duplicate”错误一律永久锁住。旧Comparison的payload与source图可能来自旧错误派生，history现可显示矛盾，安装权威的完整测量图复核尚未因此自动实现。持续推进这些共同机制，不开同义业务抽样。

## G39：同一测量的完整发布别名与 Review 闭包

### Recall、影响面与诊断

- 用户要求Codex持续推进，02:45上海后交回准确Opus5.5；本轮不启动业务模型/旧实验。先处理G38已经证明可达的选择绕过：同payload Evaluation别名上的独立Review，不能因为Owner挑另一份等值Evaluation而消失。验收必须同时进入原publisher和真实DB/安装链，保留旧Comparison；不把一次局部闭包称作完整Trial集合。
- 已重读AGENTS/Recall/G36–G38、当前02-data、publisher冻结搜索/完整读取/producer校验、通用publication identity、collectTaskRunEvidence/current terminal、metric receipt盖章、G37授权/execute/receipt immediate事务/reconcile/replay和history冻结图。定义/调用搜索确认当前publisher仅按选中Evaluation ID搜索Review；G37同样只取Comparison直接Evaluation ID。G38承认同payload多个ID是同一测量后，这两个精确ID集合仍漏别名边，直接触发点是事实身份与发布身份没有在读取闭包中连通。
- 诊断在实际Host发布alias Review后对比只选原Evaluation与选全别名的Comparison required维度；原fixture缺candidate，不能声称它有真实promote。另在既有真实DB/package-manager checker中先发布完整promote并授权，再增加同payload candidate Evaluation别名及failed blocker Review，执行旧请求并读回真实安装receipt；用原比较器消费全别名/Review只作外侧对照，不重写旧Artifact。先保留原版结果，再实施。
- 单一拟议修复：在已选Run/Evaluation事实基础上，沿同一Task当前Catalog冻结snapshot枚举Run/Evaluation/Review，按G38完整payload相等关系补齐全部发布别名，再读取这些Evaluation别名的全部Review；不是选最新或合并不同测量。仅目录获取/等值闭包/原producer与引用一致性检查由Host/工具执行，finding判断仍属Auditor及唯一比较器。
- 同一纯别名闭包供publisher、live mutation和history使用。publisher把别名与Review放在**一次**固定upper/membership分页，避免两个目录快照混称一份全集；全部相关原件完整read/select。mutation在已有SQLite事务同时读取measurement/Review当前记录再查缺失Review，仍在durable receipt处最终重验；已提交receipt重放和未提交journal恢复顺序保持G37。history用自己的冻结目录，旧上界不倒写后来记录。
- 本轮不对不同payload观察建立未经授权的取代关系：same Trial inactive/awaiting→terminal、后记usage、另一metric receipt与新Trial，需要各自真实因果/冻结契约，不能依赖artifact时间或“第二份”一律裁决。Campaign/createTask未绑定全部Trial ID的边界不变，未公开执行全集仍未知。不同Campaign的Evaluation引用不同且payload不相同，不能混入；Run相同完整事实只补别名，不借此引入别的Trial。跨Task只沿当前Task已导入的原协议，不借外部旧ID。

### G39原版实际反例

- 实际Host测试在同一metric receipt的Evaluation别名上发布permission/unavailable/blocker Review，只传原Evaluation时缺失该Review对应required dimension，传两份后维度出现。两次因fixture缺candidate仍inconclusive，不称此处错误promote。真实publisher/完整read/source已执行，`.tmp/g39-alias-review-host-probe.json`、log和patch保留；9项112断言用于完成诊断，不冒充新机制验收。
- 原实际DB/package-manager驱动在已发布完整promote且授权后，另写同payload candidate Evaluation别名与failed blocker Review，旧请求仍返回durable promotion receipt，真实candidate安装读回一致；唯一比较器对完整别名/Review集合给inconclusive。`.tmp/g39-alias-review-promotion-probe.json`、log/patch保留。该驱动使用明确合成typed记录及真实安装权威，与上面的真实publisher合同分别报告，不伪称自主LLM Campaign。旧Comparison未改；临时test-driver插入核对后精确恢复再添加回归合同。

### G39实现与完成验收

- 唯一`expandEvolutionMeasurementAliases`补齐同artifact type+完整payload的发布身份，publisher、当前安装复核和冻结history共用。没有更改generic publisher的source身份，也没有挑较新/较好值。publisher一次Catalog分页同时枚举Run/Evaluation/Review，先扩展选中事实的全部等值别名，再完整read/select关联Review；删除原独立Review-only枚举实现，不保留双路径。不同payload观察只被目录观察，不冒充选中事实。
- live mutation在同一DB snapshot读取三类记录；原G37授权/执行/receipt immediate事务/reconcile/replay复用这一闭包。新增alias Review会使旧Comparison失去当前安装条件，即使旧source没有那个Evaluation发布ID；history报告同一精确缺失Review，并在旧目录上界保持原决定。
- 真实mutation/history4项94断言通过，新增alias-review路径覆盖Comparison后新别名、授权与执行拒绝、history新旧上界、安装后到receipt前同时新增另一别名和Review并回滚、按各exact Evaluation分别显式改判后真实安装，以及commit后幂等重放。fixture原所谓otherEvaluation其实与原payload相同，按G38真别名定义已不能当不同scope；现用不同value/receipt明确表示另一测量，未为测试保留遗漏别名的旧行为。
- 实际Host publisher9项116断言通过：不传新别名/Review仍发现其permission unavailable维度，包含Run/Evaluation所有真别名及Review原件；原别名上的同证据显式更正后，比较准确回到原不含该维度的结果，旧Review仍在source。原102份跨页Review检查同样通过，现在三个类型共用一次upper/membership。比较52/157、包投影1/40也通过；共66项/407断言。日志`.tmp/g39-mutation-final.log`、`g39-package-tests.log`。第一次实现把history局部Map命名为已有confirmation evidence数组同名，编译器精确拒绝；改名catalogEvidence后全部通过，保留`g39-mutation-initial.log`，不误报业务失败。
- root类型8项、docs342ops25groups、API6规则34文件、拓扑122manifest135workflow通过。源与嵌入Evolution Lab2026.09.27.3，contentDigest8ab7dcb9ef5549baa3772a828a77ecd5cd261a715d8d07eb60b02dc4ba5e25eb；只同步此包，没有公共JSON schema变化、不生成无关SDK差异，不安装推广。未启动Provider/业务实验、无UI自动化。
- 剩余边界：不同payload Run/Evaluation全集仍由Owner选；同Trial合法后续观察/usage补记与重跑择优不能按“第二份”或时间一律处理；缺少预绑定Trial身份的目录不能证明执行全集。旧Comparison payload与更宽source图可能曾由旧错误子集生成，仍不可重算历史以伪修。G40须继续沿真正的Campaign归属/测量事实/当前安装权威审查，不把本轮同事实Review闭包包装成业务可靠纠错或进化收益。

## G40：不同测量的归属与观察完成时序

### Recall、影响面与检查计划

- 用户要求继续有依据的实质开发，02:45上海后交回准确Opus5.5。本轮从已push的76d7b4d8及干净工作区开始；没有业务模型、旧实验、凭据或另一个agent参与。目标是为完整测量集合确定真实权威，不能把G39等值别名闭包直接扩大成按source并集猜Campaign，或把所有后续记录永久判冲突。
- 已读本记录Recall/五段图/G37–G39、02-data、2026-08-17测量/Review所有权及Campaign恢复历史；全仓检查publisher、collector、metric receipt、比较器、history、mutation授权/receipt事务、generic publication identity、Task创建和跨Task导入。另定位唯一生产UsageLedger.record调用到llm/api.ts的onStepFinish；沿Session processor和真实complete_task/terminalTask检查时序。当前只是待验证的可达时序，不能把源码顺序说成真实Luna已丢费用。
- 直接触发与数据根因候选：Owner仍显式选不同payload的Run/Evaluation；G39只补同payload身份。Run模型入参中的唯一Campaign经Host读取但payload没有保存该exact locator；实际envelope的source集合又包含同Turn以前的选择，所以不能把每个Campaign source成员都解释为这次Run的归属。Evaluation有exact Campaign/Candidate/Run，但没有合法不同测量取代合同；原2026-08-17每slot一次测量约束仍有效。
- 先做两个有界本地Checker：(1) 原真实Host fixture在已发布80-token Run后生成100-token/unpriced Run，分别选择前者与两者，保存原publisher结果与完整source集合，区分所消费集合、持久provenance与统计结果；不把缺candidate的fixture称作实际promote。(2) 流式SDK生产封装配确定性test-driver输入和真实Task终态写入，直接读取在工具完成时、step回调时和流结束后的ProviderUsageEvent，验证同一调用是否可在终态后入账。后者证明运行器合同，不是外部Provider或自主LLM验收。
- 两项检查不得改变历史Artifact或改写生产生命周期/用量账本。原路径临时探针先保存精确原文件和diff，运行后精确恢复；若建立可长期复用的正向时序合同，单独保留测试。不同Trial/非终态继续/同Task重新打开/重复metric执行各自的取代权威在设计成立前仍未知，不用默认最新、最好或新Host业务gate填补。待原反例和时序结果明确后再决定生产修复范围。

### 原反例与单一快照实施决定

- 原真实Host9项117断言通过，`.tmp/g40-different-run-selection-probe.json`及final.log/patch保存三项结果：同一collector资源先得到80 tokens/$1.25，再得到100 tokens/cost null；只选择80的Run产生inconclusive（原夹具缺candidate），同时选择两份报`comparison has conflicting run observations for slot case-1:baseline:0`；先完整选择100的Run、再仍只传80作为语义输入时，持久Comparison source包含100，但派生结果仍只消费80。**来源图不等于消费清单**已经由真实publisher证实。该临时probe结束后精确恢复原测试文件。
- 新正向时序Checker使用确定性Provider传输输入、真实SDK、complete_task、SQLite终态和UsageLedger：工具返回和caller onStepFinish时Task已completed/账本0，流结束后记录150 tokens/$0.00018。它证明正常完成调用可以晚于Task终态入账，不是合成追加usage的猜测，也不是外部Luna或账单验收。横向源码检查区分complete/fail工具中的终态、startup/stream错误终态与cancel的实际prompt-settlement barrier；不能把一个完成路径断言推广成取消也必然迟记。terminal conversation及同Task resume还可追加真实调用，因而Task终态不是永久费用封口。
- **本次生产修复限定为采集快照一致性**：把已记录用量及原ledger event IDs放进原collector的同一SQLite读事务，与Session树/消息/终态一起形成唯一canonical资源；Run publisher只从已验真的bundle盖章，不在采集之后另读账本。删除原独立`taskRuns.usage` Host入口和独立采集函数，不保留双路径。相同collector资源不能再承载两个不同费用观察；后入账时原fresh-check给出明确过期资源错误，重新采集生成新资源。这里核对SHA是真实不可变证据身份，不以哈希代业务正确。
- collector JSON显式升级为schema_version 2，要求usage快照；旧资源保留原字节，不回填、不迁移旧runtime、不添加版本fallback。旧历史Run/Comparison仍按原Artifact数据读取，本次不重算它们；以后需要新发布/执行metric的采集输入必须使用当前v2资源，旧v1输入由schema给出不匹配错误。Evolution Lab源/嵌入同步一个新版本；无DDL、公共HTTP或SDK响应变化。原Run Artifact字段、slot计数、比较统计、Review改判、promotion路径本轮不改。
- 全集选择仍未解决：新快照使不同观察可追溯，但不宣称旧观察自动失效或已获得跨观察取代授权。Run exact Campaign归属、真实消费集合、inactive/awaiting→terminal、同Task恢复与重复metric执行须继续设计；禁止借本修复挑最新/最好或丢弃旧失败。聚焦验收包括真实Host旧资源→明确过期错误→新资源准确100/unpriced、混合模型仍精确拒绝、流式终态时序、原collect/review/compare合同、源嵌入/类型/docs及完整push检查。

### G40实现与验收

- collector在原Task/Session读取事务内枚举同一Session树的ProviderUsageEvent，按occurred_at/id稳定顺序记录event IDs及原有总量/定价语义。用量进入canonical bundle v2，Run只读bundle.usage；独立Host usage入口及另开事务的采集函数已删除。只有一个当前实现，没有重写历史账本、Task终态或测量结果。
- 真实Host9项122断言通过：原80-token资源后遇到追加20-token/unpriced事件，旧资源明确报fresh-collection不一致；重新采集得到2个确切ledger IDs、100 tokens/cost null及新的collector资源，原资源读回仍为80/$1.25。再次采集混合模型后原精确模型拒绝仍成立；另一个Trial独立模型/用量保持隔离。终态/Artifact12项66断言及共享usage2项4断言通过，包含本次SDK→真实complete_task→原账本150-token时序。比较52/157及完整包投影1/40通过，共76项389断言。
- 第一轮Host测试早于异步包生成完成，加载的是旧嵌入.3而期待.4；保留`.tmp/g40-host-and-order-tests.log`，同步后真实Host全过，见`g40-host-final.log`的首个文件exit=0。该复验命令还误列了不存在的`expert-squad-evolution-comparison.test.ts`，其工具错误同样保留；正确的`evolution-comparison.test.ts`及projection已在`g40-comparison-projection.log`独立全部通过，不把命令名错误算业务失败或掩盖检查缺项。原临时时序probe日志`g40-terminal-usage-order.log`也保留。
- 根类型8项、docs342ops25groups、API6规则34文件、topology122manifest135workflow、diff检查通过。源/嵌入Evolution Lab2026.09.27.4/contentDigest4fe44f12d143ec62c475d65ad9c87837204b7efb7fda822d24bd01c44bcb1342；仅同步此包，其他预存base漂移保留，未推广。无公共HTTP schema/SDK或DDL变化，没有UI自动化、外部Provider请求或业务费用。
- 下一问题仍是**完整已发布观察如何进入当前决策**，不是再修相同快照：原Host反例证明source图可能含未参与计算的Run，所以不能只检查引用集合是否齐全就认为旧Comparison已消费它。必须明确Campaign/Trial归属、精确消费快照和同Task后续观察的合法关系；旧值原件与当时Comparison保留。当前修复没有解决Owner对子集的选择，也没有证明业务可靠纠错/自进化收益。尚待进一步核验的相邻边界：execute-evolution-metrics传入Run envelope，但通用metric Host的task_id/workDir仍是Evaluator Task；shell/query/judge各自实际评价对象需沿真实checker区分，不凭变量名直接判定业务测错。
