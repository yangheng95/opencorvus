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
