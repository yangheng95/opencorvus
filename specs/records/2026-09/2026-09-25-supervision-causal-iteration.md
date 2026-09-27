# 监督与自进化的无人值守因果迭代

[六类机制清单](2026-09-27-supervision-mechanism-consolidation.md)已被用户指出未定位核心问题，现撤回为实施依据。核心根因尚未定位；该清单和下列 G 号均不得自动派生修复工单，原主管应从具体原始失败链重新判断。

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

## G41：测量回执身份与实际评价对象

### Recall、影响面及本地反例计划

- G40 b12a0969已push，真实pre-push模块1123/5695零SCC、4cold imports及其他检查/secret scan通过。本轮从干净工作区继续；无模型/业务世界或旧run。用户要求的是全局可靠纠错和可验证进化，先确认测量对象才能继续选择完整性，不能让typed receipt盖章替代真正的观察。
- 已读`execute-evolution-metrics`、`metric-evaluation-host`、`metrics/executor`所有evaluator分支、scorer authoring schema、Campaign Planner及scorer contract。生产路径明确从Run读取Trial ID，但host.metrics.evaluate把`scope.taskID`传给通用executor，把`scope.projectDirectory`作为workDir；shell未指定cwd时用它，shell配置的workspace_digest只写进输出；judge得到直接选中的Run envelope字节；query/aggregator使用Evaluator Task中metric流水。这些事实尚不能把所有evaluator一概判错：聚合在Evaluator Task内合并测量是合理的，judge也可能只评价元数据。
- 有界反例：在既有真实Host/隔离Trial fixture中，初态Trial目录写marker=0，Evaluator项目目录写marker=1；两者在Campaign资源冻结前写入。唯一将原constant_value=1 scorer替换为无显式cwd、读取marker的真实shell scorer，其workspace_digest声明精确Trial冻结目录。沿原collect→Run→execute-evolution-metrics→immutable receipt读取值和attempt.json中的实际cwd/stdout身份；再与两个原文件逐值比对。只运行确定性本地进程，无LLM、伪Tool结果或原历史数据修改。
- 先保留原路径结果，不把预期1当正确答案；随后精确恢复临时测试。若结果证明对象错位，修复需以原Trial/immutable collector作唯一subject权威，区分评分流水归属和被评对象、可变现场与冻结证据、各种evaluator和跨Task/import范围；没有完整合同前不把cwd硬改成某目录或新增Host业务gate。Run/Evaluation全集和合法后续观察仍待继续，不因这个旁支宣称已完成。

### G41真实反例与下一实施边界

- 真实Host/实际shell完整通过原发布链，9项122断言完成；`.tmp/g41-metric-subject-probe.json`、log、patch及精确原/临时测试副本保留。Trial `tsk_g00VWLsNj200NUzoF2H4`目录marker为0，Evaluator `tsk_g00VWLsMZR005kyHii47`项目marker为1；Run与metric receipt精确声明前一个Trial，实际attempt.json的task_id/cwd却是后一个Evaluator，stdout实际为1、raw_value与receipt都measured=1。Scorer asset所写workspace_digest与Trial冻结目录一致，但executor只是原样记录它，没有把它用于选择实际被评workspace。不是计算器算错或模型复述错，也不凭测试标题认定反例；实际路径、两个文件、进程stdout和immutable receipt可逐值核对。
- 这是明确的测量对象错位：对需要Trial结果文件的shell scorer，准确的Trial标签仍会包住来自Evaluator目录的数值。原constant_value测试只能验通道，不能证明评分对象。该例没有candidate臂或promotion，不称真实错误晋升或自主LLM错误。临时探针在结束后精确恢复为b12a0969的测试；没有新增长期“错误行为应通过”回归断言。G40生产修复和所有旧业务世界均未改。
- 全仓调用核对：当前只有Evolution Lab调用`host.metrics.evaluate`；通用`executeMetrics`还服务其他当前Task评分，不能全局把task_id改成Trial。metric流水保存到Evaluator Task是合理的归属；应修的是显式subject及其被执行/读取的数据。query/aggregator在同次Evaluator metric结果上聚合并不因此有错；judge当前仅收到所选Run envelope、无自动追资源读取，是否满足业务rubric另需准确输入证据，不泛称所有judge必错。
- 下一实施前的两个必要事实：①终态Git checkpoint、嵌套仓库及既有WorkspaceTree/TaskArtifact原语能否提供**该次不可变结果**的评分目录，且不执行在旧Trial活动现场、不因cwd覆盖冻结scorer语义；②judge应接收哪些明确选中且同Trial的原始内容，如何在既有完整读取/权限/冻结字节上保留来源，而不是Host猜业务证据。inactive/awaiting观察只有live_observation tree identity，不能伪造成已归档终态结果；不能直接拿Campaign初始workspace_digest检验已经合法修改过的最终结果。
- 这项已证根因优先于继续给完整集合加引用门：先把被评对象和证据输入接对，再解决Run exact Campaign归属、消费集合及不同观察合法关系。当前G41仅交付真实反例及完整影响边界，生产修复尚未实施；Codex继续原语审查，02:45后按用户要求交回同一准确Opus主管，不等待用户逐步指挥。业务可靠纠错与真实进化收益仍未达成。

## G42实施前：复用冻结资源，显式分离评价对象与评分流水

### Recall与已核对原语

- 用户授权Codex在Opus恢复前继续修复；本轮从647e718c干净工作区继续，不重复G41反例或任何已停实验。已读AGENTS、五段图/G39–G41，核对`task-artifact/store.ts`的Git commit file/subtree读取、发布/materialize/close；`engine/git-process.ts`的封闭Git词汇；`execution-capsule/tree-digest.ts`、`workspace-tree.ts`、Snapshot实现；所有`host.metrics.evaluate`/`executeMetrics`定义调用、各evaluator和metric judge真实消息渲染。没有生产改动、模型或委托。
- 现有TaskArtifact精确commit读取已经使用cat-file/ls-tree验证commit、文件mode、blob大小及路径，subtree拒绝非regular条目。已验证快照的materialize在Evaluator Task管理目录复制实际bytes并复核inventory，close统一回收；应复用，不另造存储/ledger。**当前限制**：读取绑定scope.taskID/projectDirectory，只支持自己的project源；subtree是包子目录而非通用多仓库终态结果导出。不能篡改Evaluator scope或把另一Task ID伪装成当前owner去通过。
- WorkspaceTree当前只存path/base64，不保留文件mode；source snapshot对Git symlink存的是readlink目标文本，嵌套仓库按当时活动目录展开。因此它是现有输入身份的表示，不能未经合同扩展就把这些bytes写成普通文件后声称恢复了同一可执行终态。Snapshot.track也是独立当前工作区捕获，不是collector所声明的terminal Git commit，不能替换原终态权威。
- `MetricEvaluationHost.evaluate`当前唯一生产调用是Evolution Lab，通用executor目前也仅由该Host调用；上一轮“通用executor另有当前Task评分调用”的措辞过强，准确事实是它的数据契约与查询/聚合以评分owner Task为域，不能据此把所有task_id换成被评Trial。后续改动仍需核对消费者而非假定另有调用。shell的cwd可显式绝对路径；judge发送给模型的是直接selectedEvidence字节，既不追resource，也不执行Tool读取。

### 单一因果设计与未决完整性

- 单一机制是**显式、不可变的metric subject**：Run引用的采集资源/结果及明确选中的同Trial证据决定被评输入；Evaluator Task只拥有评分执行、metric流水与receipt。subject身份进入原metric attempt/receipt来源，不新增独立ledger、角色或Agent业务判断。Host只解析/读取/验证确切身份和完整性，评价准则与选择证据仍来自冻结scorer和Agent。
- shell路径拟在采集/证据发布阶段，沿原终态occurrence与repository checkpoint捕获对应结果资源，复用TaskArtifact的精确commit读取和现有发布/materialize。必须显式区分只读source authority（原Trial/Project/terminal/repository）与destination owner（真实Evaluator Tool调用），不能借source union猜归属或临时改Instance。之后评分只在这些不可变资源的隔离物化中执行，mutable Trial cwd和Evaluator项目cwd都不作默认替代。现有显式cwd也须清楚约束为subject内路径；不能默默忽略冻结配置或允许它绕过subject。
- 需要在实施前进一步收敛的实际字段/错误：完整根仓库与嵌套仓库的路径映射、gitlink/symlink/executable mode语义、原Git对象缺失或Project已删除、当前/历史terminal occurrence与import后可读的资源身份。对无法完整恢复的对象保留typed unavailable，不能取当前HEAD或活动目录补齐。inactive/awaiting仅有live_observation，不能制造terminal snapshot；Campaign初始workspace_digest不能作为最终内容相等门槛。
- judge路径应传入明确选中的原始内容，不能把Run locator/hash当作已读业务材料。已有collector可选Message body与Artifact目录索引可作为选择入口；具体选择/完整读取API须沿现有同Project/Trial身份核对，不能Host按关键词挑业务答案或自动塞所有隐藏内容。需要保持原max_evidence_bytes/MIME/UTF-8的明确错误语义，不截断后称完整。query/aggregator继续以本次评分流水聚合，prebuilt验证明确subject来源，不能误改成Trial内并不存在的metric spec。
- 实施验收应保留G41原0/1反例：真实shell结果必须来自冻结Trial的0；采集后再改Trial活动文件以及Evaluator文件，物化评分仍读原0；物化中的允许写入只作用于副本并由现有close清理。补同Project不同Task、不同Project、旧occurrence、嵌套文件和明确不支持条目的真实正向输出/错误；judge核对实际发送的原始字节与确切locators，不能仅测构造对象或新字段存在。没有业务LLM运行登记，不启动模型来替代这些本地合同。
- 本段是**待落实的精确方案/风险清单**，没有宣称现有Git读取已支持跨Task终态导出、没有已验证的实现patch。Opus恢复后接管这一方案和G41原始反例，自主收敛字段/实施，不重新争论已经实测的cwd错位；G40快照修复已交付，完整测量集合与合法后续观察仍是随后任务。

### 有界物化原型预登记

- 在全新无模型test-driver中复用G41两个marker目录，只验证一个已存在的具体路径：当前测试的Trial worktree与Evaluator project共用Git对象库，原terminal commit可由同Project的精确commit读取原语访问。先按原Host评分留存1，再将Trial活动文件改为9；通过原`publishTaskArtifactProjectFiles(merged_primary_commit)`读取collector所绑定terminal commit中的marker0，发布为真实Evaluator Task资源，并通过同一TaskArtifact.materialize得到隔离副本。
- 同一个原`executeMetrics`、同一冻结shell配置在该物化目录进行第二次明确test-driver测量，评分owner仍为Evaluator Task；原receipt不改。预期新attempt raw_value0、cwd物化目录、Trial活动文件仍9、Evaluator文件仍1。该原型用于证明既有原语可承载正确信息，不冒充已修复的public Host路径；不证明独立Git库、完整根目录/嵌套库或link/mode处理。临时测试和输入修改结束后精确恢复，不保留第二控制器或替代生产实现。

### G42原型实际结果

- 新隔离真实Host/DB/scorer过程9项123断言通过，`.tmp/g42-materialized-subject-probe.json`、log和patch保留。观察精确为`originalMetric=1 / frozenMetric=0 / liveTrial=9 / evaluator=1 / frozenCopy=0`；新attempt的cwd是Evaluator Task受管artifact materializations目录，owner仍为Evaluator Task，原receipt=1未被覆盖。
- 具体复用了现有`publishTaskArtifactProjectFiles`的exact commit模式、TaskArtifact真实publish/materialize/close和原`executeMetrics`，没有第二评分器/伪Tool/模型/世界。测试直接给executor传物化context，是明确的接线原型；**公开host.metrics.evaluate仍有G41错误，不能将此原型当生产修复已完成**。原型只复制被该scorer读取的一份regular文件，不能外推为完整多仓库执行环境。临时测试已精确恢复，生产源仍是G40的.4。
- Opus接手已有可证伪正向样例：将真实公开Host subject绑定实施后，应沿同一公开调用取得上述0和完整来源，同时保留Task owner、评分receipt、原历史数据和回收边界。还需覆盖公开路径与未决的完整结果树/显式cwd/特殊条目/独立Git库/旧occurrence/导入和judge原始输入。不得把原型context硬编码进生产，或只在metadata补Trial标签。

## G43：Opus接管——公开评分路径绑定Trial终态主体（实施前）

### Recall

- 用户“让opus解决这些问题”后，Codex在Opus额度等待期完成G32–G42并交回；我从G42与干净HEAD`2c6b507d`（=upstream）继续，不重做已完成项。四项目标中，推送链（G32）与Review完整发现/取代/晋升新鲜性/别名闭包（G36–G39）、Run用量快照（G40）已交付；H-B（G35）干预未执行、业务未修。当前首要是G41已证的评分对象错位：它使任何真实Campaign的shell测量与judge输入都不可信，是“进化收益”可测的前提，也先于不同Run/Evaluation集合语义。
- 已读AGENTS、G40–G42、G42原型patch；核对`metric-evaluation-host.ts`、`metrics/executor.ts`（shell/judge/prebuilt/query/aggregator与attempt发布）、`task-artifact/store.ts`（精确commit文件/子树读取、materialize/close受管目录）、`engine/git.ts`终态checkpoint、`execute-evolution-metrics.ts`、plugin `MetricEvaluationRequestSchema`与shell/judge配置、scorer合同、`metrics-evidence-runtime`与真实Host测试。`host.metrics.evaluate`唯一调用者是Evolution Lab；`build-tool`的workDir无关评分。

### 事实、根因与单一方案

- 现象（G41真实反例）：公开路径中shell评分的cwd是Evaluator项目目录（`config.cwd`或Host传入的`scope.projectDirectory`），测到Evaluator的marker而非Trial的；judge收到的是Run envelope元数据字节，而且其中含`arm`标签，违背judge不得接触臂信息的冻结准则，也看不到Trial实际输出。
- 根因：评分请求只传“所选证据”，没有被评对象；执行器用评分owner的目录代替被评Trial。评分流水属于Evaluator，被评subject属于Trial，两者被合并。
- 唯一权威：Run Artifact所载的collector资源（Host采集、发布时已核对等于新鲜采集的canonical bundle）。其`workspace_checkpoint.result`给出Trial终态Git commit与仓库集合，其被Evaluator选定的Message正文是Trial的原始输出。不再另存整棵结果树：终态commit本身就是不可变事实，复制全部文件只会造第二份。
- 改动：plugin评分请求增加必填`subject`（该collector资源引用）。Host在Evaluator Task内精确读取并校验该bundle；只有`terminal_git`且仅根仓库时，才用现有精确commit读取原语把该commit的完整树物化到本execution受管目录（只接受regular文件，保留100755可执行位，大小逐一核对，大小写冲突拒绝），随execution关闭回收；嵌套仓库、symlink/gitlink、缺失对象、`live_observation`（inactive/awaiting）一律让shell评分typed `input_unavailable`，绝不回退到任何活动目录。执行器以`subject`取代`workDir`：shell的cwd为主体根或其内相对`cwd`，绝对或越界路径为`configuration_invalid`；attempt记录主体Task、commit、tree与实际cwd。Evolution Lab评分工具把collector资源同时作为`subject`与judge的唯一所选证据，judge因此读到Trial的canonical bundle与所选Message正文，不再接触Run envelope中的arm标签。query/aggregator继续在Evaluator评分流水中聚合，prebuilt不变。
- 不做：不新增ledger、角色、业务gate或另一存储；不改历史receipt/Run；不复制Trial结果树为Artifact；不宣称大仓库性能（逐文件精确读取，正确优先）。

### 验证计划

- 真实Host测试把冻结scorer改为读取Trial结果文件的shell：Trial在基线之后写marker=1并终结，Evaluator项目写marker=0；采集后把Trial活动文件改成9。公开`execute-evolution-metrics`必须得到1，attempt记录Trial主体commit与受管物化cwd，工具结束后目录已回收；导入后的再评分同样得到1。修前同路径应得到0（红测）。另覆盖相对cwd、绝对cwd的`configuration_invalid`、inactive主体的shell `input_unavailable`、judge实际收到的是collector bundle字节；执行器运行时测试改为显式主体。再做类型、包拓扑、docs、diff、源嵌入同步与版本记录，完整pre-push后推送。

### G43额度中断后Codex接手复核（实施前补充）

- 2026-09-27 03:14:44上海原Opus进程自然退出，159 turns、exit1、is_error=true、terminal_reason=api_error，原文`You've hit your session limit · resets 7:40am (Asia/Shanghai)`。原stdout与exit在`.tmp/opus55-global-resolution-20260926T184512131Z.*`；没有重试。累计CLI估算87.654808美元，减前65.7677364为本轮21.8870716，非外部账单。按用户原授权由Codex接手；07:45或以后再交回同一会话。完整未提交差异已另存`.tmp/g43-opus-uncommitted.patch`。
- 原13项107断言通过；公开Host8过1失败124断言的失败点为旧包版本期待.4、实际.5。代码、检查与提交尚未完成，不能以局部绿测交付。接手先重读AGENTS/Recall/G40–G43、当前架构权限与Task runtime路径，搜索所有metric请求/执行器/attempt/物化调用，确认只一个生产调用链，无HTTP/DDL/SDK公共响应变化；未改UI，不做UI自动化。
- 校正主管方案的过强措辞：G41证明依赖Trial文件的shell测错目录；不能由此证明所有Campaign/judge分数必错。collector bundle包含原始Message及运行身份，改读它只修正所选输入，不能称完整盲审或保证业务证据充分。原消息不删改、隐藏、合成。
- 本次补充验收：真实Host绑定原终态commit且不同于活动文件/评分owner，保留导入后再评分；真实inactive/awaiting采集资源映射shell input_unavailable；实际judge消息渲染取得同一collector字节（无外部模型调用，理解/能力未测）；Git树中大小写冲突目录在Windows会合并，现实现只检查文件冲突，须同一物化原语明确拒绝目录拼写冲突并加真实Git对象测试。保留特殊条目/缺对象错误、相对cwd与清理检查。修改仅收敛已有subject方案，不新增业务gate或实验。
- 新增真实Host重复调用红测已实际触发`Metric scorer live-subject-shell conflicts with the frozen Task scorer definition`，见`.tmp/g43-codex-focused.log`：第一次live subject评分已产生typed unavailable，第二次同一定义/Task/新iteration在ensureFrozenScorers失败。全仓确认readSpecsForTask仅被该Host和executeMetrics消费；它把带Timestamps的DB整行直接断言为MetricSpec，语义比较意外加入time_created/time_updated。修复点是现有唯一读取入口用现有MetricSpec schema解析，既不更新冻结行、忽略真实配置差异，也不新增fallback；重复定义应继续评分，改target仍给原精确冲突错误。此为真实共享评分入口问题，不是inactive特例。
- 二次复核真实Git对象红测：在同一隔离fixture创建tree replacement，`materializeGitCommit`仍标原commit/tree却写出替换tree的binary内容，断言原README字节失败；`.tmp/g43-replace-objects-red.log`保留。这不是哈希形式检查：实际文件内容被改变。全仓核对task-artifact精确commit file/subtree/full-tree各自cat-file/ls-tree及batch调用、共享gitProcessArgs默认未禁replace。只对该模块的精确对象读取使用Git原生--no-replace-objects，覆盖这三种既有读取入口；不改变通用Git操作/用户refs、不重写仓库对象、不建立第二版本权威。正向测试在replacement存在时仍物化确切原commit的实际文件。
- 包同步初次与剩余测试进程重叠时遇EUNKNOWN(open generated payload)，收据g43-codex-package-sync.log保留；全部测试进程结束后同生成器成功。随后源/嵌入身份检查发现本轮Python写README/Skill采用Windows行尾，生成器按仓库既有规则生成LF；将本任务这两个源文件按.gitattributes恢复LF，保留实际内容与同一未发布.5版本，重跑原loader身份验收。此为不可变发布包身份检查，不用行尾代替功能验证。

### G43实际交付与边界

- 公开Host9项135断言与Git publication/materialization7项57断言最终通过（`.tmp/g43-codex-verified-tests.log`）；metric runtime6项53断言通过（`.tmp/g43-codex-final-tests.log`该文件含此前包身份红测，不能将整个文件称全绿）。合计22项245断言。真实值为Evaluator0、Trial现场9、原terminal commit副本1、公开receipt1；同项目跨Task导入后仍得到1。inactive和awaiting的真实collector资源均经公开Host得到input_unavailable；同一定义第二次iteration可执行，改target仍精确冲突。judge原始bundle经过生产消息渲染器逐字节核对；没有外部模型调用或理解验证。
- 单一subject源、评分owner及attempt schema 2已接通；单文件/子树/完整树的精确Git对象读取统一禁用replacement解释。真实tree replacement存在时仍得到原README/完整3文件；binary/CRLF原文件bytes、特殊条目/缺对象/文件及目录大小写冲突、清理均有实际Git/文件输出。Windows只验证文件内容与类型，POSIX执行位断言在此平台未执行，不冒称跨平台运行验证。
- 支持范围明确为当前Evaluator可读取Git对象的单根regular文件树；独立Git对象库的跨Project端到端导入未验证、也未新增对象运输。缺对象和不支持的tree形态明确unavailable。副本供本次评分调用执行，非操作系统沙箱；未证明任意shell scorer之间的副作用隔离。旧collector/attempt/receipt原件不改，未推广任何用户项目包。G41错误已修，业务可靠纠错和真实进化收益仍未达成。
- Evolution Lab源/嵌入为2026.09.27.5，最终contentDigest `3794f61310a631b9be4ee04615b5c1b590fba6621c0ef70d8513fd43736c0a58`；真实loader身份通过，只更新该包，未夹带base漂移。类型8项、docs342ops25groups、API6规则34文件、包拓扑122/135通过；原始日志g43-codex-types-final.log/docs.log/api.log/topology.log。完整待推送集合与真实pre-push在范围提交后按原流程核验，尚不预写成功。
- 下一机制问题仍为不同payload Run/Evaluation完整集合与合法后续观察，不能把本轮subject修复当全集修复。旧G31半成品不应用、旧业务实验不恢复；Opus07:45后恢复时应先读本结果而非重做G43。

## G44：完整测量集合之前的回执事实权威复核

### Recall、影响面与有界原路径检查

- 从已push的bc76455a与干净工作区继续，先重读AGENTS、Recall/五段图/G40–G43、02-data及2026-08-17测量/Review所有权拆分。沿publisher、comparison、measurement alias resolver、promotion freshness、跨Task import、collector、metric store/receipt搜定义与调用。没有模型或旧实验；继续遵守已授权本地真实Checker和07:45以后Opus交接。
- G40–G43并未消除已知集合缺口：Run无独立Campaign字段，来源并集不是唯一归属；Evaluation有exactCampaign/Run，但其不同观察没有合法取代语义。不能简单把全部目录Run或所有后续Evaluation强制混入一个slot，导致无关观察混用或永久冲突。原2026-08-17只规定每slot单一测量，不提供任意测量重做择优权限；此边界保持，不靠新字段/关键词猜业务。
- 本轮全仓查到一个先验需要反证的精确点：Evaluation publisher解析唯一receipt JSON并盖章其scorers，但当前没有调用原engine_metric_result账本或读取所引attempt核对；execute-evolution-metrics确实产生真实receipt，然而TaskArtifact publish也能接收其它新JSON。不可变只证明发布后字节不变，不自动证明这些字节出自评分器。现阶段仅为代码线索，不能称模型曾伪造/所有分数错误，也不能以此假设给测量加修订。
- 有界真实Host探针：沿G43现有实际shell=1→attempt→receipt链，另创建一个全新的测试驱动receipt资源，保持同Trial/Campaign/Run和真实attempt locator，仅将scorer value声明为0；调用原公开Evaluation publisher并读取实际持久化值。所有原receipt/attempt不改；检查publisher是否拒绝或接受矛盾事实。若证实接受，则应把score事实回接原唯一metric result/attempt权威，而不是增加业务金额gate、重跑评分、修改旧Evaluation或另建ledger。临时探针与原文件差异先保存，结果后决定单一实现；无外部Provider费用。

### G44原版实际反例与实施决定

- 真实Host原路径9项135断言完成，g44-receipt-authority-probe.json/log/patch保留；actual attempt=1、原receipt=1，另行发布的新receipt声称0但引用同一原attempt，原Evaluation publisher接受并持久化scorers.value=0（Artifact art_heb2L6iYlIaVQvqZFfft）。原attempt/receipt未改。此处是可实际发布矛盾测量事实，不是猜测模型会抄错、不代表已观察到自主模型欺骗或实际晋升。临时测试差异已保存并精确恢复为bc76455a。
- 根因在事实权威边界：publisher只确认receipt字节不可变/形状合法，没证明其中分数和evidence属于真实metric执行。此前“已从immutable receipt盖章，因此模型不能改分”的结论必须收窄。G43修评分对象没有解决评分结果重写运输；补全这种不可靠集合会把伪测量和真实测量一同传播，故先修此确切根因，不新增测量修订/重跑权限。
- 单一实现：原metrics store增加按当前评分owner Task与exact evidence_ref读取已持久结果，沿原MetricSpec和原attempt校验identity/status/value；公开package Host metrics增加只读recorded observation接口，读回Task/iteration/scorer revision/原Trial subject与measured或unavailable事实。没有第二ledger、签名旁路或业务评分判断；所有数值仍由原executor和engine_metric_result拥有。未落账/非当前owner的独立JSON不能冒充结果，原历史字节不改。
- Evaluation publisher对每项receipt使用这个原生读取入口，并将原Run/Trial/collector、冻结Campaign scorer集合/revision与实际observation关联；原receipt若与原生事实不一致，给明确integrity error，不替换分值后保留一份自相矛盾的receipt。正常receipt继续盖章，原同receipt发布别名保持，导入后重新评分仍走当前owner。已有Evaluation跨Task导入读取不重写；这不承诺把任意独立导入的原receipt重发为新的测量。
- 同路径还发现typed unavailable运输待验点：Host outcomes.results也含raw_value=null的已落账不可用行，而package execute-evolution-metrics先按results当measured，可能在读取unavailable之前抛错。先按实际接口与正向测试验证并将唯一状态映射复用，不能把null当0或更换scorer。
- 验收：真实Host正确receipt→同值发布；声明改分/替换未落账attempt→精确错误；真实inactive shell产生unavailable可经package receipt发布且精确read回；同Task异subject/Trial/scorer与owner隔离；聚焦runtime/Host、源嵌入/类型/docs/prepush。无HTTP/DDL/UI改动。Lab提升一个尚未发布版本，旧@1对象仍只读，不将本修复称完整Run/Evaluation全集或进化收益。

### G44实现、验收与仍未满足项

- 生产修复已实现：metrics.recorded沿当前Task+exact evidence_ref读取唯一原engine_metric_result，并读原MetricSpec及不可变attempt核对Task/spec/iteration/status/value，再返回原Trial subject/scorer revision及typed outcome。没有模型填写结果的第二事实源或新的ledger。Evolution执行与发布通过新metric-context.ts共用已有Campaign/Run身份检查及recorded scorer投影；旧工具内重复逻辑移出，未保留备用路径。publisher对receipt完整scorer集合、slot、Trial/collector、scorer revision和数值状态逐值一致性检查；历史原件不改。
- 真实Host9项141断言通过（.tmp/g44-host-final.log），覆盖：真实shell=1正常发布/别名；另写receipt=0→明确recorded observation错误；另写匹配score=0的attempt JSON而没有DB结果→found0错误；错误Trial ID→exact Trial/slot错误；另一Task借原评分ref→owner域found0；新本地fixture Trial的冻结输出是非数值文本，原shell实际返回后给parse_failed，经真实execute-evolution-metrics→receipt→Evaluation发布保留unavailable。此为确定性测试驱动，不是新业务模型实验或收费Trial。
- Metric runtime6项53断言、完整包投影1项40断言通过（g44-focused-tests.log对应两文件exit0；该log的首轮Host仍含失败）。合计16项234断言。初次新测试把复制ref按非canonical属性序写入receipt，先被原canonical检查拒绝；修正fixture为原schema序后实际到达DB权威错误。新增公共helper使两份精确包文件清单断言过期，按真实当前inventory同步后通过。错误日志保留，没有放宽原canonical/冻结文件或身份校验。
- 源/嵌入Lab2026.09.27.6、contentDigest1db936231f4b13655508e3fea8933818822cc6e63612c23b7ddaba034d1064d1，单一生成器只同步Lab。类型8项、docs342ops25groups、API6规则34文件、包拓扑122/135和diff通过，g44-types/docs/api/topology/package-sync.log保留。无HTTP/DDL/SDK响应变化、无UI自动化或Provider费用，未安装推广项目包；范围提交后再按完整outgoing与pre-push核验推送。
- 本修复证明新Evaluation数值来自记录过的真实评分，并不保证比较已包含所有真实测量。仍可能在同subject的多次metric执行间选择或拼接已真实记录的attempt；receipt目前没有独立“同一执行发生”的完整集合身份，只有native observation的iteration/owner和各资源来源。下一步应先沿原Tool Part/TaskArtifact producer/metric结果的真实发生关系审查，不凭时间最新、iteration等同Trial或引用数来补洞；需真实反例再决定单一来源，不先加新ledger或随意测量修订。不同Run的Campaign归属与未公开Trial全集同样尚未解决。整体业务可靠纠错/真实进化收益未达成，Opus恢复先读本结果。

## G45：一次评分Tool调用的真实来源一致性

### Recall、边界与原路径反例计划

- 从673b3a22已push/clean继续。读AGENTS、本记录Recall/五段图/G43–G44、02-data；全仓核对MetricEvaluationHost/evaluate、唯一Lab调用、executeMetrics逐scorer publish→writeMetricResult、TaskArtifact manifest/producer/idempotency、真实scope解算和Session ToolPart request/outcome。无模型、无旧实验、无委托。
- 已知原事实：真实Task scope必须匹配持久Session/assistant Message/Tool Part及call ID；request_part_id的terminal outcome唯一。metric attempt由原生execution.publish发布（非plugin幂等wrapper），每个snapshot的不可变producer保留package/agent/session/message/tool_call_id；一般TaskArtifact幂等发布可能保留首次producer，因此不能对任意资源默认“当前调用就是来源”。当前Lab execute-evolution-metrics公开Tool每次恰好调用一次metrics.evaluate；纯executor或任意SDK调用可在同一Tool中多次调用，这个更宽语义不能仅由Tool producer区分。
- 一次evaluate顺序产生全部当前冻结scorer的attempt与DB结果。G44已逐项验真，但publisher未比较多个真实attempt的原调用；iteration为模型显式评分参数，不等于调用、Trial或repetition，也不是不可变的全局批次键。资源snapshot ID则逐scorer变化，不能要求所有scorer同snapshot。
- 本地原路径探针：将既有真实Host fixture的冻结scorer集合扩为两个（原shell+constant query），同Trial/同collector在两个不同持久Tool call ID的Host scope中评分，iteration都0；另写一份新receipt分别取A、B的一项原始结果，走当前publisher读回。原两份receipt/attempt不改，使用的数值均为真实记录；这检验来源拼接，不以相同数值声称数值变坏、收益提高或实际晋升。两调用均为明确test-driver，不是自主模型行为。先保存原路径结果及差异，再改正向检查。
- 若被接受，最小候选修复是从原attempt snapshot manifest经既有真实reader取得完整producer，加入只读recorded observation；publisher要求该receipt的全部scorer来自同一Task/Tool producer与iteration，再保留G44逐项subject/冻结scorer校验。不新增批次ledger/UUID、角色/消息或按tool名字猜意义，不选择最新/最好。不声称同一Tool里任意多次底层evaluate已获得唯一批次身份；也不证明不同完整测量的选择/已发布全集已解决。若证据否定其有效性，记录范围而不硬加门。

### G45原版证据与实施范围

- 原真实Host已实际发布拼接回执：同一个Trial/collector、相同iteration=0和冻结双scorer，原snapshot manifest分别记录call-evolution-abi-chain与call-g45-metric-second；新receipt取A的correctness和B的coverage，当前publisher接受并持久化。g45-mixed-occurrence-probe.json/log/patch保留。两值均为1，故证明的是来源拼接被接受，不声称分值变坏、模型欺骗或实际晋升。两个scope和第二Tool请求/结果由明确本地test-driver写入原Session存储，使用真实Host/执行器/SQLite/资源，不冒称完整模型工具调度验收。
- 采用已有来源事实：metrics.recorded用原TaskArtifact manifest reader取得该exact attempt snapshot的producer，API只投影它，不新建发生记录；publisher逐项G44校验后，再要求task_id、完整producer和iteration一致。不同snapshot可属同一调用；引用数量/相同分数/相同iteration不足以替代来源。读取的producer来自评分attempt，不来自后来重发的receipt，完整B回执重发仍合法。
- 范围是当前Lab公开Tool的一次调用（该冻结代码内只有一次evaluate）；不以“Tool调用”冒充所有可能SDK内部evaluate批次。也不要求外层Tool必须success：已经落账且完整的原事实可在外层交付失败后继续读取，不能因为收尾故障丢弃测量。Task/Mission调度与terminal occurrence不改；已检查scope严格解算、Tool request/outcome唯一索引与Task/Project目录权限，当前没有新增调度异常要改。
- 正向测试保留双scorer原真实链，拼接A/B给精确integrity error，B整份及原别名/导入/typed unavailable保持；native recorded producer逐值等于原manifest。不同完整测量的选择/全集、同一Tool内部多次SDK evaluate的更细身份仍单列未知，不靠永久冲突/新ledger修饰。
- G45首轮正向检查在“B整份回执合法重发”触发真实共享store错误`idempotent snapshot identity collision`，g45-focused-tests.log保留。根因是stable publication key包含snapshot_kind，但existing manifest复核硬写catalog；engine_resource第一次成功，原字节重发却被误判。审查全部kind定义/publish入口：公共Host原合同已支持两kind，具体实现也支持；TaskArtifactStoreExecution类型仍只写catalog，须与原单一manifest kind契约对齐。修复仅用existingManifest.snapshot_kind核对，不放宽identity、不改幂等key或首次producer。扩展真实store checker覆盖catalog和engine_resource分别重发/半完成恢复与原bytes，Task/Project隔离和目录授权保持。
- 来源发生进一步审查：scope解算要求持久assistant/part/provider/call匹配；Session恢复对普通未完成Tool收敛失败，特殊恢复路径单列；权限执行已有成功结果时重放durable result，无outcome时为unknown，MCP恢复单独查询原任务。这里只做源码审查，不冒称重启真实模型验收；未改任何调度/恢复/lease/terminal实现。当前一致性主张仍限确切Tool producer，而非任意内部SDK批次。

### G45已完成验证及范围

- Native recorded observation现在从同一原snapshot manifest reader投影producer，publisher要求全scorer的task_id/producer/iteration一致。真实request表有(message_id, callID)唯一索引，故这一元组指向原Tool request；outcome表对request_part_id也唯一。无新ID/DDL/ledger或工作流状态门，不把Tool名称、字段数或时间戳当身份。每项原生测量权威与subject/scorer校验保持G44。
- 最终23项307断言：Host9/146（g45-host-store-final.log对应Host exit0，该log后一个旧store断言失败保留）；store7/68（g45-store-verified.log全过）；runtime6/53与package projection1/40（g45-focused-tests.log两对应文件exit0，该log首轮Host幂等失败保留）。原版两调用均iteration0的拼接被接受；新版native producer逐值等于原manifest、调用A/B精确区别、拼接返回声明的integrity error；B完整回执重发成功，原正确值/别名/导入再评分/typed unavailable链仍通过。
- engine_resource幂等根因已在共享store修复：existingStable使用existingManifest.snapshot_kind，类型复用原manifest kind union。两种kind相同bytes仍是两个身份，各自重复发布同identity；两类manifest-last中断场景都正确恢复原snapshot ID和bytes。扩展测试首次忘记把新engine_resource计入内部listTaskArtifactSnapshots完整清单，实际返回两项使断言失败；按真实完整inventory纠正后通过，不改变catalog provider的可见范围。
- Lab源嵌入2026.09.27.7/contentDigest178272b6d9907f4e3bb8cda451d1f7353f65aef1a58f26e5c5c4df283a6453a1，只同步Lab、未推广。类型8/docs342ops25/API6规则34文件/包拓扑122/135与diff检查通过，日志g45-types/docs/api/topology/package-sync保留。范围提交后按当前upstream完整outgoing和真实pre-push交付；本轮无Provider费用、UI自动化、HTTP或SDK响应变化。
- 仍未满足：不同完整评分调用之间择取/遗漏观察，Run/Campaign精确归属、未公开Trial全集，以及同一Tool内任意SDK多次evaluate的细批次。本修复不禁止完整观察重新表达、不把第二记录永久毒化，也不按最新/最佳代替合法关系。下一轮先检验这些原始发生事实在跨Task导入后是否仍可沿当前Task证据完整取得，再决定测量集合的单一权威；不能拿源snapshot ID猜producer，不能要求Agent读取未授权的source Task。整体可靠业务纠错和真实进化收益仍未达成。

## G46：已发布评分证据跨Task运输与关系消费

### Recall、影响面及原路径检查计划

- 从已push的b1df7e0e/clean继续；读AGENTS、Recall/五段图/G44–G45、02-data和2026-08-17所有权拆分历史，搜索跨Task import、完整资源复制、source_producer/source_provenance、publisher/comparator、Review freshness/history/mutation及真实Host import测试。无模型、旧实验或委托，保持07:45 Opus交接。
- 代码事实先分开：直接resource导入保留原snapshot producer到import_lineage；EngineArtifact导入保留该Artifact producer与source provenance并复制所带资源，但资源新snapshot producer是Mission importer。Evaluation payload仍原字节，内含原Campaign/Run/attempt locator；现测试只验证导入Campaign/Run后重新评分，没有验证直接消费已发布Evaluation/Review。因此不能概括为全部来源丢失，也不能把重新评分当原测量运输。
- 有界原路径探针：沿既有真实Host双scorer链，将原Campaign/Candidate/Run/Evaluation/Review以及一个原attempt作为明确完成交付导入新Task；从新Task公开read读取完整原件与资源，核对原producer/引用和原bytes，尝试用这些已导入记录发布Comparison。旧记录不改、不重跑Trial或评分；只增加确定性test-driver的完成交付与原import流程。比较若拒绝，记录第一个真实错误；若能完成则核对原安全unavailable finding是否真实进入结果，不根据“导入成功”认定下游语义可消费。
- 当前线索：比较器按精确当前locator验证Evaluation→Campaign/Run及Review→Evaluation，而import内部引用仍原Task；Review自动发现及freshness也用当前Evaluation locator集合。这个关系是否导致真实失败待探针，暂不改生产实现。后续方案须同时解释首次导入/重复导入/多跳导入、原scope与当前授权、显式Review取代与合法旧证据改判、history/promotion及不可变历史；不能由每个消费者复制转换器或让下游跨权限追源。Run/Campaign全Trial集合仍另列未解决。

### G46实际反例与单一运输修复决定

- 原真实Host首跳：直接attempt导入保留原worker producer，Evaluation连带attempt的原bytes相同、其目标snapshot producer如实为Mission；不把复制动作当原评分。Campaign/Candidate/Run/Evaluation/Review均按完成交付导入，但Comparison实际报`comparison evaluation slot case-1:baseline:0 has the wrong Campaign or Candidate source`。原始收据g46-imported-measurement-probe-initial.json与log/patch；后续同probe再次执行的JSON见非initial文件及second-import-probe.log。无新模型/评分择优，失败被探针记录而非长期正确行为断言。
- 第二跳真实import→persist后，Evaluation payload仍原值，但新import_lineage只保留上一Mission producer及空外层source provenance；原worker和原Campaign/Run关系链不再在当前Task envelope中。现worker checker实际报`must be produced by Evolution Lab worker evolution-evaluator`。g46-second-import-probe.json/log/patch保留。这个更前置的不可逆运输丢失必须先修，否则消费者的locator转换器无法从当前已授权证据恢复原事实；不能回源猜补或只特判第一跳。
- 本提交边界收敛为共享import运输：在原import_lineage加入可选非空prior_imports，每项为已有一跳source事实（不含递归字段），writer在导入已imported envelope时保留其原一跳及已携带的older facts。当前一跳身份/source_producer保持即时来源，旧payload/resources字节保持；不flatten成错误的直达来源，不写第二ledger或重造参与者。字段缺失只表示没运输更早事实，不能假定历史Mission来源等于最初作者；已有丢失历史不回填。
- 唯一纯reader从当前envelope返回已保存source chain。现Lab worker producer验证及attribution/opportunity原关系使用同一reader的最早已知事实；链终点若仍是Mission/unknown，既有明确authority错误继续显示，禁止外查未授权Task。非imported事实原路径保持。新增范围是所有通用cross-Task import生产入口复用原writer，完成/失败取消授权仍由原terminal authority决定，包角色/授予及生命周期不变。
- 真实正向验收保留原Task→两次import→实际persist→当前read原payload/bytes/worker与逐跳provenance，覆盖每次即时来源及原来源；已完成/failed-terminal import合同、源权限检查维持。首跳Comparison关系消费、Review闭包、history对import的排除与promotion producer要求尚需下一共同reader接线，不能把本运输修复冒称比较成功；下轮以已证反例直接推进，不等Opus或重跑业务样本。公共Envelope schema由原位置扩展，检查API/SDK是否实际暴露再生成；无UI改动。

### G46实现与验证结算

- 共享import writer已在第二次及以后导入时完整保留原source chain，当前源Task/locator/Mission producer仍准确指向上一跳。唯一engineArtifactSourceChain只读当前envelope。Lab的原作者及归因/机会关联消费同一链；native产物保持原作者检查，不能借lineage字段改作者。没有重建已丢失历史、跨权限回源、重新测量、迁移DB或隐藏消息。
- 最终22项272断言：真实Host9/166（g46-host-final.log），Task终态/完成交付/failed同Mission导入12/66、完整包投影1/40（g46-focused-tests.log）。Host真实完成交付、prepare/import/persist连续三跳，逐值确认原payload、原attempt bytes、每跳即时producer和最早worker/source provenance；错误worker和缺少早期链明确拒绝，原first-hop重新评分仍通过。本轮没有完整Campaign、真实Provider或实际晋升。
- 首次探针编辑因匹配到两个host anchor而在写文件前停止，误执行的是原版9/146基线（g46-unmodified-baseline.log）；随后精确修正anchor才得到首跳比较失败和第二跳作者丢失的原版真实收据。临时失败行为探针已转为当前正确运输合同，没有将“Comparison应失败”保留成通过要求。首跳比较错误收据保留供下一轮实修。
- Lab源/嵌入2026.09.27.8/contentDigest f58d51602e891abe0c83f570ba9e3ebd5cd97074e2d5d3bb0b2b43ecbacc441d，仅同步Lab未推广；首次生成a1a4…在最后保留native作者边界后被同一未提交版本重新生成，非修改已发布包。类型8/docs342ops25/API6规则34文件/包拓扑122/135通过，日志g46-types/docs/api/topology/package-sync-final保留；公共HTTP以原JSON资源交付envelope，OpenAPI不展开该lineage，因此无SDK响应/DDL变更。按范围提交后再跑实际pre-push及完整outgoing审查。
- 下一G47直接消费这条完整已运输来源：统一当前Task内exact locator关系解析，覆盖Comparison发现/比较、Review显式取代及freshness、history和promotion。当前Comparison仍以新本地locator硬比原payload locator；history源码currentRows/historicalRows排除import rows，mutation exactArtifact也仅认原生投影producer。前者已有真实反例，后两者目前是源码确定边界、未宣称新真实安装失败。需要同一权威映射保留原字节/每跳身份，歧义不能默认最新或第一份，缺源不能跨权限追读，不让每个消费者各写转换器。先落盘完整影响面和精确方案，再原反例转正，不重做本运输修复。不同完整测量全集与真实进化收益仍未完成。

## G47：当前Task中的同源引用解析与下游消费

### Recall、影响面和实施契约

- 从8cd519bc已push/clean继续，重读AGENTS/Recall/五段图/G44–G46/02-data；全仓核对publisher的显式来源、Catalog冻结分页、comparison纯函数、Review resolver、measurement别名闭包、freshness的授权/执行/receipt事务、history current/historical查询及graph/detail、mutation intent/Core反馈和恢复边界。G46首跳真实Host错误直接作本轮反例，不重跑旧模型或从空白设计。
- 根因是跨Task已运输身份与本地发布身份被当成必须逐字相等：Evaluation→Campaign/Run、Review→Evaluation/parents以及原direct source都保存原locator。现Host import已保存每跳完整事实，但消费者没有共同的关系解释。目录扩大或重抄payload不会根治；原body/分值/Review语义仍由真实原作者拥有。
- 单一纯引用索引放plugin共享层，只接收调用者当前Task/同一Catalog快照内已完整读取的envelopes。精确current locator与Mission import链中的exact Engine locators构成同一原件的运输身份；相同SHA文本/分值/时间不构成关系。同一原件若被声称为不同type/schema/payload，返回明确一致性错误，不能挑第一/最新。索引返回全部本地身份、仅供本次计算的等价key及原作者/direct source投影，不持久化新表或改写原件，不提供跨Task读取权限。history按Task分别建索引，不能把全Project记录混成授权域。
- native来源仍原作者；import来源取当前envelope中最早已知的真实producer/source provenance。链末Mission/unknown仍不满足Lab作者要求。显式Review supersedes用同一引用key解析，保留每个原件及全部运输身份；两个独立native Review即使payload相同也不是同一原件。重复导入同一已审原件不产生新的审查结论；后发不同原件/新Review仍参与freshness，不按finding内容决定是否忽略。typed finding语义和测量统计不改，G38完整payload测量分组不放宽。
- publisher在原冻结目录完成measurement别名及Review发现，用共享key关联原引用；Comparison纯函数接收这一个引用上下文，原native纯数据调用仍是空导入关系的精确key。原Review的finding/supersedes直接来源校验读取其真实origin provenance；当前新Review仍必须提供自己的直接来源。原样保留payload、locators与原raw evidence，不把运输副本当新评分或新review。
- mutation保持当前Task exact read、现有Project/CAS/真实用户授权和原manager journal/receipt immediate原子复核。Lab来源允许通过已保存import链证明原作者；Core feedback/restoration边界不借此扩大。freshness先在当前Task读取确切本地/已导入证据并关联，缺少原comparison所需source时给精确缺源错误，不能静默当没有Review；已提交receipt仍先重放，历史不重判。history纳入可验证的Lab imports并按Task保留当前真实Artifact身份，graph关联和Review解析使用同一索引；不把duplicate imports当新模型Trial或收益样本。
- 正向验收：G46首跳真实Host完整旧Review（含安全unavailable）能发布准确inconclusive比较；新Task对同一Evaluation基于旧事实明确改判、父Review保留并正确取代；多跳/同一原件重复import/新独立Review、错引用/跨Task scope和缺源有明确合同。实际DB/package manager路径验证imported Campaign/Candidate/Comparison的授权/安装/后来Review阻断、history新旧快照及receipt重放，真实model仍无调用。聚焦旧比较/Review/Host/mutation/feedback/CAS、类型/源嵌入/docs/diff及完整prepush；不加UI测试/DDL/业务gate。

### G47当前实现与真实验证

- 新唯一plugin引用索引只合并exact current/import-chain身份，检查同一原件type/schema/payload一致性；纯计算代表key不持久化、不选不同测量。resolve保留全部当前身份并优先返回所指的当前exact副本，其余同原件副本按稳定身份排序。publisher、comparison、Review resolver、history、mutation/freshness共用；原native直接相等与import特殊转换散落路径已替换。pure comparison缺省没有任何import关系，仍由同一key算法处理；生产publisher始终提供已读当前目录索引。
- G46原首跳Host反例已转正：imported Review的原security unavailable实际进入新比较、对应required dimension准确；在新Task对同一imported Evaluation/Review用原证据发布显式改判，旧Comparison真实freshness报新增Review身份，重发比较与原纠正后的矩阵逐值相等。原payload/测量bytes不改。不同native Review仍独立；同一原件多副本可一并列为supersedes而成为一条取代关系，所有原件状态保留；同一exact locator写两次仍报duplicate_parent。
- 实际DB/manager新增imported-evidence分支：源Task按原failed terminal authority把完整已发布比较图导入新Task，缺源子集真实授权报missing_source；完整集合真实授权通过。随后新Review使旧execute拒绝，history保留旧promote但当前intent=null，旧catalog上界仍显示当时intent；同证据显式改判与新比较后实际安装测试candidate，commit后新增Review不改变原receipt重放。此为预置数值的确定性test-driver/真实管理器路径，不是模型自主Campaign、真实业务收益或新用户项目推广。Core反馈/恢复权限及原CAS/journal协议保持。
- 全仓进一步找到独立e2e evidence summarizer仍用旧作者/locator检查，已接同一索引；验收旧Comparison时用它当时实际引用的身份重算，返回/读取仍是当前已授权副本，不改旧诊断ID。新增两跳已运输纯fixture合同与仅foreign Task持有缺少Review时的明确错误；未启动旧controller、页面或模型。该harness原“唯一逻辑Comparison”profile保持，不能外推任意多推荐选择已解决。
- 最终94项606断言：引用索引3/11、比较52/157、真实Host9/172、mutation/history5/108、e2e support14/40（g47-consumers-final.log）；manager CAS1/30、真实feedback9/48、包projection1/40（g47-final-tests.log）。前面的g47-focused-initial和g47-final-tests记录分别是接入checker之前的通过结果，最终对应消费者已重跑；G46原错误原件仍保留。本轮没有新的业务Provider费用或UI自动化。
- Lab源/嵌入2026.09.27.9/contentDigest966d23669c3521f242cffddcfa7d585fbb3d560196bd164750d85025e05b8731，单一生成器仅同步Lab，未推广；第一次未提交生成4adc…在加入README契约后重生成，非覆盖已发布包。最终类型8、docs342ops25、API6规则34文件、包拓扑122/135过，g47-types-final/docs/api/topology/package-sync-final保留；无HTTP/SDK响应/DDL变化。范围提交后按完整outgoing与实际pre-push完成交付。
- 下一G48回到不同完整Run/Evaluation集合与合法后续观察：当前只修已读/已导入原件关系，仍允许Owner选不同完整测量子集。不要把source/import引用等价当作完整Trial注册表，不按最新/最佳或同值选择；G40同一source图可比实际派生输入更宽仍有效。先全仓核对publication显式输入与Turn选择来源并集的契约、Campaign/Run实际语义归属、原metric Tool发生/iteration/Task terminal occurrence和合法恢复，利用已保存真实反例再决定一个有事实授权的最小机制。若具体路线无可证伪方案则如实收束该路线并转向有证据的问题，不重复同义模型抽样。整体业务可靠纠错与真实进化收益仍未达成；07:45之后Opus优先接管，先读本结果而非重做G47。

## G48：比较计算输入与宽来源图的边界

### Recall与实施前调查

- 从d32af8fc已push/clean继续，重读AGENTS、Recall/五段图/G46–G47、02-data；搜索通用artifact_publish、typed Plugin Host、publisher显式参数、comparison/freshness/history/mutation及独立e2e checker和2026-08-17、2026-09-12历史。无委托、无外部模型。
- 通用publisher的source_read_refs是本次显式来源；typed Host保留同一物理Turn既有选择加本次选择。这是不同公开契约，不能为方便比较而删除宽来源或当作相同语义。G40已证宽图可包含未参与数值派生的另一Run。现Comparison仅存派生结果，checker/freshness/mutation却把宽来源当其实际输入；因此完整集合研究前必须先确认本次计算发生的精确身份能否重放，而非直接增加全目录冲突门。
- 先用当前真实Host已发布的Comparison送入现有summarizeEvolutionEvidence，保存实际源图/原payload/错误。原记录只读，test-driver不是模型行为。若复现，下一个候选最小机制为唯一比较器给结果盖章精确计算输入，保留完整宽provenance和原始证据；所有消费面共用同一解析器，不能各写转换。历史缺少该事实时明确unknown，不从宽来源猜输入或重算覆盖旧结果。新字段的历史读取/当前安装权限、跨Task导入、别名与Review修订必须一起界定，之后才改生产。
- 此边界不解决已发布全集、未公开Trial或合法重复测量取代；不会把记录了输入当成输入选得完整。后入账/恢复/再评分不得以时间最新或结果最好自动选择，也不新增ledger/角色/业务gate。

### G48确定反例与精确实施契约

- 当前真实Host首份Comparison已发布并正确读回；独立summarizeEvolutionEvidence读取当前Task真实Engine行后报`source was not completely read`，所指是宽provenance里的task_artifact_resource评分attempt，不是缺少实际参与比较的Engine原件。原收据g48-comparison-consumption-probe.json/log/patch。这个fixture缺candidate测量，因此不能称promote失败或完整Campaign；已证同一公开产物无法按其真实计算输入重放。
- 新Comparison `calculation_inputs`由唯一deriveComparisonRecommendation盖章：exact Campaign、Candidate及全部实际传入Run/Evaluation/Review locators（包括被取代Review和等值别名），排序保留身份。模型输入仍空payload；宽source/observed/resource原样保留，不删反证。字段可缺失仅表达历史未记录的unknown，绝不从宽来源fallback猜值；旧payload读回保持原数值，当前安装/重放需要已记录的计算身份，缺失返回明确错误，history保留旧结果并说明不可重放。不是另一ledger或模型自报清单。
- 唯一纯reader校验字段结构、每个输入属于原直接来源、类型与当前Task已读原件关系；重放/Review freshness/history/mutation共用。native与G47多跳import均只用当前已授权副本，不跨Task追读。新Comparison Campaign/Candidate严格绑定实际计算对，不能借同Turn另一背景Campaign授权。旧receipt先重放、未提交安装同事务freshness等既有时序不变。
- 核心验收：真实Host原反例转正且宽图包含原评分资源；计算输入逐项核对。追加背景Review或不同测量仅作为宽来源时，不伪称它已被比较消费；相关新Review仍由G37/G39完整目录复核发现。历史缺字段保留原推荐、current intent为空且精确issue；明确缺源/错类型/非直接来源/错误Campaign对的正向错误。正向比较、Host、mutation/history、导入、独立checker及包投影/类型/API/docs实际检查。无新模型/world/UI/DDL。
- 这一步不准许选择性遗漏真实不利测量，亦不声称已关闭它；不同Run/Evaluation全集及合法后续观察的因果合同继续待续。记录精确输入是区分“已发现/作为背景引用/实际纳入计算”的必要原始事实。

### G48已实施与最终验证

- 当前比较器在同一返回值盖章calculation_inputs，排序精确保存全部实际Campaign/Candidate/Run/Evaluation/Review身份；原宽source/observed/resources完全保留。唯一reference模块reader校验已记录输入、直接来源、原件类型和当前Task可达性；native/imported消费共用，不用时间或同值猜身份。history按实际输入展示测量；背景Campaign不能取得该比较的晋升权限，背景Review引用不能冒充已被比较消费。
- 原真实Host反例含14个宽sources，其中1个是评分资源；原checker误当计算输入。修复后公开Host实际产物通过现有checker重放，计算输入逐项与实际fixture身份相等、原宽评分资源仍存在。独立checker已有单opportunity/attribution profile；本Host夹具另测过另一scope的一对前驱，最终驱动只把本声明profile的一对交给该checker，Comparison原宽sources不变，全部Run/Evaluation/Review仍交付。不是已解决任意多Campaign或多推荐profile。
- 真实DB/manager：同宽图额外Campaign不能授权；历史未记录输入仍原promote但current intent=null/COMPARISON_INPUTS_UNAVAILABLE；后发Review即使在宽sources中、未在实际计算输入中也精确触发freshness。宽来源里的不同Run/Evaluation不会被谎称为该次已消费测量；明确声明冲突的保留记录仍公开原conflict。合法改判后安装、receipt重放、rename/恢复与跨Task导入路径继续通过。旧历史不重算、不补字段、不改原receipt。
- 最终95项620断言在g48-final-tests.log全部8文件exit0：reference4/16、comparison52/161、真实Host9/170、mutation/history5/115、独立e2e support14/40、manager CAS1/30、真实feedback9/48、package projection1/40。没有业务模型调用/费用或UI自动化。公开Host的102份Review使新Comparison超过64KiB，旧测试单chunk完整断言失败，现沿真实next_offset完整读取，保持原生产分页合同。
- 其它初始失败均保留：纯alias测试原先把统计相等误当含输入的整产物相等；纯import fixture缺observed来源；mutation夹具新增多Campaign后旧数组第0项断言失效；checker原缺源错误更新为唯一reference错误。修复测试的明确正向输出与身份，不放宽生产校验。原探针和g48-focused-initial/consumers-tests/host-mutation-verified日志保留；最后两文件的局部绿不能冒称整个文件绿。
- Lab源/嵌入2026.09.27.10/contentDigestc9845d9c6e21dfa9fcc1f0cd39bf7472b275d7a030e5bfd7406e2a458cda8d3b，仅Lab同步未推广；初次未提交生成584f…在Owner/Skill说明和共享identity排序更新后前向生成，同一未发布版本。root类型8、docs342ops25、API6规则34文件、包拓扑122/135/diff通过。SDK唯一生成器实际运行；OpenAPI递归验证仅新增6处COMPARISON_INPUTS_UNAVAILABLE联合分支，其余JSON逐值相等。检查脚本曾用Windows默认cp1252错读UTF-8造成35个假乱码差异，修正显式UTF-8后g48-openapi-verified.json准确通过，未改生成内容掩盖差异。
- 下一G49继续不同完整测量全集与合法后续观察。G48关闭的是“比较发生实际用了哪些输入不可重放”这个共同根因，不是集合完备或真实进化收益。现在应沿真实calculation_inputs与已发布Evaluation exactCampaign/Candidate/Run事实调查遗漏；Run仍没有exactCampaign payload，不能以宽provenance推断归属。先核对实际Task创建/collector/metric发生事实及历史合同，区分原收费后记、合法恢复与再评分/重跑择优；无权威就不能默认最新/最好或永久封锁第二记录。07:45或以后优先准确Opus5.5接管，在此之前继续有依据本地工作，无新登记不启动业务模型。

## G49：Campaign矩阵中的Trial身份重复使用

### Recall、影响面与原路径探针

- 从0e292128已push/clean继续，重读AGENTS、Recall/五段图/G46–G48、02-data；全仓核对Task creation request/model/panel/CreateTask、collector真实terminal reference与usage、metric store/evaluate/Tool invocation、Run/Evaluation publisher、comparison/history/freshness及2026-08-17单slot合同。无模型/委托/旧实验。
- 当前Task创建只有预期package digest，未预绑定Campaign/case/repetition清单；metadata/request文本不能替代结构化事实。collector有真实Task ID与当前terminal occurrence，usage后入账并不改变Task身份；不同metric iteration或Tool调用是评分观察发生，不是独立Trial。既有Lab orchestrator明确为冻结case/arm/repetition创建separate fixed-profile target Tasks，矩阵统计用每个槽位作为独立运行观察。
- 新静态疑点：Run槽位由Evaluator提供，比较器检查每slot的Run/Evaluation Task身份相等，却没有跨slot检查。故同一个原Trial可能被重标为两个repetition而都被计入。此与同Task同slot的后入账/继续/恢复不同，后一情况不能被永久毒化；不同Campaign重用一个已测baseline也不是本次检查范围。
- 先在原真实Host fixture冻结两repetition矩阵，走同一个已采集Trial的Run再次发布、原Metric实际执行与Evaluation发布，把两份真实记录作为不同repetition交给真实Comparison publisher；保存完整身份/receipt/inputs和结果。fixture缺candidate，不能把原Host结果称错误promote。另用现有纯比较器的完整数值矩阵确认重复Trial是否影响独立性/区间判定，纯函数证据不能冒称模型或真实业务收益。先保存反例再恢复探针，若成立才实现共享身份校验/历史诊断/当前安装复核。

### G49反例与实施契约

- 真实Host已确认：同一Trial tsk_g00VWMsQi100JbaAA4c0、同一canonical collector被发布成repetition0/1，两个真实metric receipt也分别标这两个槽位；Comparison成功保存两份计算输入，fixture缺candidate所以inconclusive。原g49-reused-trial-probe.json/log/patch保留，捕获后test-driver用G49_PROBE_CAPTURED主动结束该临时探针，不把日志exit1称产品自然故障。前两版探针时机过晚，分别被旧采集freshness和夹具主动混合模型账本拒绝；initial/second日志保留，第三版将重复Run发布放到原合法单模型阶段，未弱化任何校验。
- 独立纯比较探针将每臂一个Task复用成两个repetition（2个Trial身份/4个槽位），原返回promote/high及0.6常数区间。g49-reused-trial-calculation.json/log/patch为预置数值/纯函数证据，不是实际模型晋升。原探针文件已精确恢复，再扩展正向测试。
- 唯一新增纯身份规则：在一次exact Campaign/Candidate计算集合内，按Run.task_id与Evaluation.trial_task_id归并它们实际声称的case/arm/repetition。一个Task可以有多个发布别名和同一slot的后续观察；但不能充当两个独立矩阵槽位。与资源内容是否相同、locator新旧、时间或分数无关；不同Task即使输出相同也保持不同Trial。这是必要身份条件，不证明统计独立、初态一致或所有Trial已披露。
- shared measurement模块输出确切collision(Task/slots/原locators)；比较器及当前授权/未提交执行的既有证据复核调用同一校验，history在原冻结目录公开TRIAL_SLOT_COLLISION、保留原推荐及原测量身份但current intent为空；原receipt先重放仍有效。当前freshness的immediate事务/manager journal/恢复路径不改，不加新的状态机/数据表/Task创建流程。旧Run/Evaluation/Comparison字节不改；跨Task导入payload保留原Trial身份，仍按当前授权目录解析。
- 正向验收：真实Host两repetition同一Trial映射到明确错误，纯比较跨case/arm/repetition错误、同slot别名及两个不同Trial同值正常输出；真实mutation/history旧已记录promote与重复Trial的明确拒绝、原推荐和证据可见及receipt重放回归。全部合法后续观察仍不能冒充独立重跑；本修复不解决同slot不同观察选择或全集，继续保留该待办。

### G49已实施与验证

- 新唯一evolutionTrialSlotConflicts只按实际Run/Evaluation的原Trial Task身份和所声称槽位计算collision；requireEvolutionTrialSlotIdentity共用于比较与当前授权/未提交执行的既有事务复核。错误精确携带Trial/slots/observations。history使用相同计算公开TRIAL_SLOT_COLLISION，保留旧推荐数值和全部原测量/别名，current intent为空。未改Task/Session/terminal occurrence创建或调度、receipt/journal/重启顺序、Scorer数值或统计公式，没有新ledger、DDL或业务Gate。
- 真实Host正向路径冻结独立的两repetition Campaign，在同一合法单模型采集阶段为原Trial发布另一slot Run，再实际执行两个评分/发布Evaluation/Review；原重复Trial关系明确映射到EvolutionTrialSlotConflictError。原单repetition正常比较、102Review分页、同scope不同Campaign、导入再评分/独立checker均继续通过。新增测试Campaign仅为本地无模型夹具，不是业务运行或新增真实预算。
- 真实DB/manager保留一份原promote数值、计算输入把相同原Trial跨repetition复用的历史声明；实际authorize拒绝，history仍显示promote及确切collision/current intent=null，两个原槽位的真实Run与别名保留。其他合法改判、rename/中断恢复、imported-evidence安装与commit后receipt重放回归通过。该历史声明是明确test-driver，不冒称模型行为或真实业务promote。
- 最终89项557断言全过（g49-focused-tests.log）：Host9/173、mutation/history5/118、comparison56/170、reference4/16、e2e support14/40、包projection1/40。pure跨case/arm/repetition都报告确切错误；不同Task即使值/资源相同仍正常promote；既有same-slot别名和费用/terminal观察错误合同保留。原探针捕获错误及两次时机错误保留，未将错误行为留作长期通过断言；实现后本轮正向测试没有失败。
- Lab源/嵌入2026.09.27.11/contentDigest9220b4b2e0a7a0c1d15036bada3b14b777136e2a317acb2e285ed865495bf724，仅Lab同步未推广。root类型8、docs342ops25、API6规则34、包拓扑122/135/diff通过；SDK唯一生成器实际生成，g49-openapi-verified.json确认只有6处TRIAL_SLOT_COLLISION联合分支，其余JSON逐值相等。无业务Provider费用/UI自动化。范围提交后执行pull/完整outgoing/真实prepush与push。
- 下一G50继续完整已发布测量集合，但必须先区分真正另一次测量与同一测量改用已证明的引用别名。当前groupEvolutionMeasurements用完整Evaluation payload（包括metric_receipt_resource和run_evidence_locator）分组，而G44证明receipt是运输、scorer的原native attempt才是数值权威。要用真实Host证伪：同一次原attempt/subject/scorers，仅把Run引用改成其已发布等值别名再运输同一回执，是否被误当不同测量；这是待核对假设，不是已确定bug。不能直接忽略全部receipt或仅按值合并；不同Tool评分即使同分仍是不同观察，导入资源也必须保持原发生/权限事实。若假设被否定，记录边界，继续利用已发布Evaluation的exactCampaign关系研究遗漏，不能停在无信息巡检。未公开Trial无法由catalog证明、同slot合法恢复/晚到费用/再评分的取代契约及整体可靠业务纠错/真实进化收益仍未达成。

## G50：同次原评分经引用别名再次运输

### Recall与实施前调查

- 从6cbf9b21已push/clean继续，读AGENTS/Recall/五段图/G48–G49与02-data；搜索groupEvolutionMeasurements、expandEvolutionMeasurementAliases所有consumer、publisher G44/G45原native result与attempt验证、metric-context、G47引用原链以及history/mutation。没有重跑业务样本/委托/外部模型。
- 当前Evaluation完整payload里混有评分事实和运输身份：metric_receipt_resource是回执运输，run_evidence_locator是被评Run的发布身份；原scorer evidence精确指向native账本已核验的attempt。当前group按整个payload判断是否同一观察，可能把同一次原测量用Run等值发布别名再运输后的Evaluation判为冲突。不能仅据源码疑点修改，亦不能只按同分数或Task/iteration去合并。
- 本地真实Host探针：原Run及等值发布别名已由G38 fixture实际生成；同一原metric receipt只替换run_evidence_locator为该别名，经原taskArtifacts新快照运输和真实Evaluation publisher验证，原attempt/value/status/Trial/collector不变，不再次调用metrics.evaluate。然后把原Evaluation和这份新发布一起交给真实Comparison，保存两个payload/相同scorer事实、Run值与错误。只读旧产物，不改原回执/DB/模型Tool记录。若确有冲突再收敛单一身份方案，区分新评分与合法运输，当前时限07:45优先Opus交接。

### G50已确认反例与精确身份方案

- 原真实Host成功发布换Run等值别名的Evaluation，原scorers（含每个attempt完整ref）逐值相等，Run完整payload也相等；仅run_evidence_locator与metric_receipt_resource不同。真实比较报conflicting evaluation observations。g50-transported-measurement-probe.json/log/patch保留，捕获后driver主动G50_PROBE_CAPTURED退出，原临时文件已精确恢复。无新metrics执行、无业务模型。
- 最小权威来自已有engine_metric_result.id，不再让回执包装决定评分发生。metrics.recorded额外投影其当前owner Task内确切原row ID，Evaluation publisher在原G44/G45验证后盖章measurement_identity={owner_task_id,scorer_results:[scorer_id,metric_result_id]}；不建表/ledger或用新UUID替代原身份。原payload/回执/resources都保留。历史缺少该事实明确未记录，只能保留完整payload相等的发布别名，不能因同值/同Task/同iteration猜是同次评分；不回填旧记录。
- 单一measurement key从完整已解析事实生成：已记录身份的Evaluation保留原Task/slot/revision/scorer value-status-evidence/native result IDs，按scorer ID规范集合顺序，Campaign/Candidate经G47原件引用索引，Run引用仅在完整Run事实已证明相同时归一；只有运输receipt身份不作为另一次评分。未记录身份保持其原运输声明的精确完整性，不能据回执不同就声称已证明另一次真实执行。Run本身仍完整payload相等才是别名，后入账/不同terminal不合并。不同原result ID（即使同Tool/iteration或同分数）保持不同观察。
- 分组、发现闭包、历史和mutation Review新鲜性共用此key/引用上下文；Comparison仍保留全部原发布身份，Review显式取代仍以自己exact Evaluation原件为scope，不借“同一测量”扩大改判权限。generic artifact_publish已有strict ABI类型拒绝，不能绕过typed publisher任填测量身份；此处不新增工具隐藏或流程门。
- 验收：原真实Host反例转正、原两个独立Tool评分保持区别、相关运输别名上的Review由冻结目录发现、history与当前安装新鲜性同源；原scorer/attempt未重新执行或改写。纯函数/预置数据只能证明局部合同，真实Host和既有DB/manager必须通过。该修复仍不证明不同真实测量全集或后续观察取代规则，07:45优先交接前须收敛范围提交。

### G50已实施与验证

- 原生metric_result_id通过现有recorded入口读取并由publisher盖章到Evaluation；原native结果/attempt/receipt与广义来源保持不变。唯一createEvolutionMeasurementKey共供比较、目录别名闭包、history和mutation Review新鲜性；Run完整事实、scorer原结果ID/值/状态/evidence保留，只有已证运输差异被归一。Review显式取代仍要求同一exact Evaluation原件，不跨测量别名自动取代。未改评分流水写入/Task终态/调度/统计公式/DDL，也没有新账本或业务gate。
- 真实Host原反例转正：用同次原attempt和Run等值发布别名运输新回执，publisher投影同一组原native IDs，Comparison实际inputs保留两份Evaluation并维持原矩阵；另一真实Tool评分即使同分，其原result IDs仍不同。新运输别名上的permission unavailable审查进入完整目录比较，同证据明确改判后恢复原矩阵。原跨Task导入/完整读取与不可用结果合同继续通过，未启动外部Provider。
- 真实DB/manager的alias-review路径同时增加等值Run发布和新receipt运输，旧Comparison授权/执行准确报后发Review身份；history保留旧promote且当前intent为空，冻结旧上界保持原历史。各exact Evaluation显式改判后新Comparison正常安装，后续新Review不改变已提交receipt重放。此安装仍为test-driver预置测量，不是模型自主Campaign/真实用户项目推广。
- 最终96项619断言全部通过（g50-focused-tests.log）：真实Host9/178、mutation/history5/118、比较57/174、reference4/16、e2e证据消费14/40、包projection1/40、metric runtime6/53。原纯比较fixture把多份不同Run复用一个locator，已改成各真实逻辑条目自己的标识，关系同步而非弱化身份检查；旧未记录测量的不同回执仍保留未知/冲突，不将其描述为已证不同执行。原探针主动捕获退出保留，最终正向验收无失败。
- Lab源/嵌入2026.09.27.12/contentDigestcab52fb838a7eeaedefce003ef027052a9ecf28d6fb66a23cc3235aa7c38718c（g50-package-sync.log），仅Lab同步未推广。类型8、docs342ops25、API6规则34、包拓扑122/135和diff检查通过。新增字段仅内部recorded/不可变Artifact payload，history公开响应投影仍是原Artifact identities/scorer slots；无HTTP/SDK响应/DDL/UI变化。范围提交后按原规则pull、审完整outgoing、实际pre-push和push。
- 下一范围仍是不同完整已发布测量的选择/遗漏和合法后续观察；本次只消除运输造成的假冲突，不证明全集、后续取代关系、业务可靠纠错或真实进化收益。须用现已可区分的native result ID和Evaluation exactCampaign/Candidate/Run关系定位，不能以Turn宽来源猜Run唯一归属，不能把后入账/恢复/重评分/新Trial全部永久毒化或默认最新/最好。无全部Trial预绑定清单时catalog最多证明已发布集；07:45优先将精确现状交给原Opus主管，旧业务实验继续只读停止。

## G51：不同完整测量的遗漏与模型侧契约同步

### Recall与实施前影响面

- 从G50的2301c65b已push/clean继续，重读AGENTS/Recall/五段图/G48–G50/02-data、2026-08-17 ownership split与campaign resume段、现Evaluator/Owner/Auditor/scheduler/Campaign Skill、metric-context/execute/store、G48精确输入与G50共享测量key。继续主线测量→父代选择，不把局部协议完成当业务收益；07:45上海优先交给原Opus主管，不开启新业务模型或旧样本。
- 历史合同只给每slot一份测量和保留既有结果的stage resume；当前Skill允许resume/import继续阶段，明确禁止重跑择优。Campaign冻结Dataset/cases/repetitions/scorers/model/environment等，却没有结构化TrialID全名单或第二次完整评分的保留/选择/取代协议。通用metrics iteration是评分owner域参数，不等于Trial repetition；每次writeMetricResult产生自己的原生ID，无“最新即权威”合同。现有事实不足以把任何后续观察自动取代前件，也不足以把全部第二观察永久定性无效。
- 已确认模型侧契约漂移：G50实现/README已把同原评分的receipt视作运输，但Recommendation Owner真实system.md仍称Different receipts为不同观察，并称exact-payload闭包。该旧规则会要求模型把已证合法运输误报冲突，需同步成当前单一原生身份合同，不是增加同义提醒。影响只限该角色原prompt、Lab版本/源嵌入与实际Capability prompt投影测试；不改grant/角色/工作流/比较算法或业务gate。
- 另做有界真实Host probe：复用G45原fixture已执行两次的完整评分，各自native IDs不同；给第二Evaluation实际发布permission unavailable Review，只选择第一份测量发布Comparison，再选择两份比较。保存原结果/原native身份/实际calculation_inputs/Review/错误，精确区分“不利独立审查被遗漏”与“同测量运输别名已被G50覆盖”。这是明确test-driver，不是LLM自主行为或真实promote；现fixture缺candidate不能夸大推荐收益。probe结束恢复精确原文件，不能留下把已知错误当通过的长期断言。
- 若独立测量遗漏证实，先保留可复核事实与未满足的选择授权，不能为了闭合目录立即做永久冲突门或机械移植Review supersedes。模型侧旧规则的精确同步可独立完成并验证；完整不同测量协议交接主管继续，原Artifact/world/评分不改。

### G51真实遗漏反例与本轮修复范围

- 两份真实Evaluation同Trial tsk_g00VWN54V1005VfchrYB、同scorer值[1,1]，但原native result IDs各自不同；第二份art_hQ6L3HjoqK3VAVjY5ted的独立permission/unavailable/blocker Review art_hbW7ipkbxEintFHU42yq已真实发布。只传第一份测量，当前Comparison成功发布、calculation_inputs只包含第一份及其G50运输别名；第二份测量与其Review没有进入实际输入，其required dimension也未进入结果。传两份则报conflicting evaluation observations。g51-distinct-measurement-omission-probe.json/log/patch保留。
- 夹具缺candidate且原第一份Review已有另一个security unavailable，两种情况下不能夸称实际错误promote或收益差。新反例精确证明不同真实测量上的不利审查可被遗漏，区别于G39/G50已关闭的同一测量别名遗漏。首次driver错误引用后方尚未定义的reviewPayload，修成从已读第二Evaluation构造独立Review后到达真实路径；initial日志保留。捕获后的G51_PROBE_CAPTURED是主动停止driver，非自然产品失败；临时源已逐字恢复，不把已知遗漏留作长期通过测试。
- 当前只精确修复已确认的模型侧旧契约：Recommendation Owner从“不同回执必是不同测量”改为消费Host已盖章的原native result IDs及完整事实，保持未知历史/独立评分/完整证据/禁止重跑择优边界。删除旧exact-payload闭包说法，同步Lab源嵌入；实际安装包→resolveWorkerCapability正向验收当前promptOverlay。此测试证明真实投影，不声称已发模型或理解；没有模型运行。不同完整测量遗漏尚未修复，不能用这次prompt同步冒称全集完成。
- 交给主管的核心未决点：现有单slot合同未声明多次完整测量的纳入/合法取代授权；阶段resume和同原结果再次运输已有正向能力，但不能据此推定不同原结果间的支配关系。next应依据冻结协议与原发生事实定义当前测量集及合法后续观察，并使实际比较/安装新鲜性消费一致。不得默认最新/最好，也不得把每个第二记录永久毒化；Run仍无exactCampaign字段，宽source不能猜归属；catalog不能证明未公开Trial。保持旧评分/世界/Artifact只读。

### G51同一模型侧合同的数量冲突

- 同轮进一步读到orchestrator/system.md要求依赖派单前每个前驱类型恰好一个Engine Artifact；但Campaign的cases×arms×repetitions、Evaluator每slot输出和Auditor每Evaluation审查天然允许多个同类型原件，G50实际Host已生产多份。这里是角色文案对现有数据合同的确定数量冲突，不是新发现的runtime调度故障，也不能据此宣称它导致历史模型遗漏。原completion-decision.ts按完整终端worker集合派生原件列表，未要求每类型单一；当前Catalog/Host真实多产物路径已验证。
- 修复限于同一Lab模型合同：scheduler依据冻结Campaign与原角色所有权读完整前驱集合，区分Campaign/Candidate单一精确身份和多slot测量/逐Evaluation Review，并保留别名/显式修订/冲突记录。manifest Evaluator节点description的both frozen Trials改为every frozen Trial slot，去掉暗含单pair的错误限制；不改变graph/agent/grant/Task生命周期/host检查。实际resolveSchedulerCapability的promptOverlay验证当前集合文案，Owner同样实际投影。源/嵌入在同一未提交.13版本前向重生，随后重跑对应公开Host/包投影。

- 安装消费面补一项有界诊断：以既有真实DB/package-manager测试的预置promote矩阵，授权后新增同Trial但另一个原生测量身份的Evaluation和阻断Review，实际执行旧请求并核对receipt/安装目录。身份与数值为明确typed fixture，原native身份来源另由上述Host probe证明；不能把此驱动称模型选择/真实业务晋升。只修改临时test-driver并保存/恢复，不改生产新鲜性或构造长期错误通过断言。

### G51安装消费面与最终验收

- 真实DB/package-manager诊断确认：预置完整promote矩阵先授权，再发布同Trial的另一个明确measurement_identity及security failed/blocker Review；追加后的authorize仍成功，原请求实际安装candidate、写入promotion receipt，installedDigest等于candidateDigest。g51-distinct-measurement-promotion-probe.json/log/patch保留。这里的测量ID/数值是明确test-driver预置typed输入，非native ledger实测；上一个Host反例单独证明同scope真实第二评分可发布且被遗漏，两项证据不能冒充一次模型自主Campaign。capture后主动G51_PROMOTION_PROBE_CAPTURED退出，临时测试已逐字恢复。
- 因而未解决项同时涉及发布比较与当前安装：G37/G39/G50只复核已选测量家族的Review，未选不同真实测量及其Review不会让旧Comparison失效。原G48精确输入/旧receipt重放规则仍正确；修复必须先定义完整已发布测量的当前集合及合法后续观察关系，不能把历史推荐直接重算覆盖，也不能靠任意Review去消除真实测量。
- 第二次嵌入同步曾在打开generated/expert-squad-payload.ts时发生Bun EUNKNOWN（g51-package-sync-initial-error.log）。本轮局部同步助手改为调用原唯一生成器输出临时文件，渲染进程退出后再以精确输出写入目标；写入前核对非Lab段/非Lab revision行原字节相等。原OS打开失败的具体持有者未知，未操作其它进程。随后真实源/嵌入身份验收通过；不是手写生成包或放宽digest规则。中间owner-only .13未提交digest5eed…保留，最终同一未发布版本前向生成为eea2f9e6dab6990ac97dd0a3db40c41201d788c7e62b01a3699c74f23300e515。

- 最终聚焦验收15项339断言：当前Lab实际投影1/43与真实Host9/178在g51-final-tests.log，精确恢复诊断测试后真实mutation/history5/118在g51-mutation-restored.log，均exit0。较早g51-focused-tests.log只覆盖Owner同步的中间版本，不当最终scheduler验收；原Host probe initial ReferenceError与两个主动捕获退出均保留。原native评分、G50别名/Review改判/导入、原安装/回滚/重放合同均保持。没有外部Provider或UI自动化。
- Lab源/嵌入2026.09.27.13/eea2f9e6dab6990ac97dd0a3db40c41201d788c7e62b01a3699c74f23300e515，仅Lab同步，不推广。类型8、docs342ops25、包拓扑122/135/diff检查通过；本轮无公共接口、SDK、DDL、grant/graph、比较或安装算法变更。范围提交后pull审完整outgoing/实际pre-push/push，保留原收据。07:45上海交回准确Opus5.5：先以本G51两项原始反例处理不同完整测量遗漏/合法后续观察，不能重复G50或把本次指令同步当集合根治；整体业务可靠纠错/真实进化收益仍未完成。

## G52：Campaign比较的已发布测量全集与同槽多次观察（Opus恢复，实施前）

### Recall与主管排序

- 2026-09-27 07:46上海以准确claude-opus-5-5恢复同一主管会话；HEAD b31dada6=origin/main、clean，无业务模型、同任务Claude或旧实验运行。Codex在额度等待期完成并推送G43–G51；已读AGENTS、本记录Recall/五段图、G43–G51全部结果、02-data相关段、2026-08-17 ownership split（“两份evaluation-result会成为一次测量的两个语义事实”“已有有效Artifact的slot不再发布第二次”）及Campaign Skill resume/禁止重跑择优。不重做G43–G51，不应用旧G31半成品。
- 四项总目标现状：推送链（第4项）已解；G29指出的Review选择/取代与比较事实转录（第3项）由G33/G36/G37/G39/G47/G48落地；业务可靠纠错（第1项）与真实进化收益（第2项）仍未证明。H-B结论为干预未执行、业务未修，禁止隐藏目标/过滤搜索制造“未曝光”，当前没有经证据支持的新业务机制可登记真实运行。进化环是唯一能在不由Host做语义判断的前提下，用冻结测量改进业务verifier包的路径；而G51已证该环的父代选择仍可漏掉另一份真实测量的阻断Review并实际安装候选。故本轮先修这一选择可信度缺口，再评估是否具备登记真实Campaign的条件。
- 本轮全仓核对：comparison.ts按Owner所传Run/Evaluation分槽，同槽多个不同观察直接抛错；publisher的discoverComparisonEvidence只把所选事实补全为G38/G50别名及其Review；core freshness（missingComparisonReviews/requireCurrentEvolutionReviews）与history（comparisonGraph/completeness/detailSlots）也只看已消费事实家族；G49的跨槽Trial重用在比较器内抛错。Evaluation有由native结果盖章的exact Campaign/Candidate/Run（G44/G45/G50），Run没有exact Campaign字段（宽source是同Turn选择并集）。

### 已证事实与根因

- G51两项原始反例：①真实Host中同Trial两次完整评分（native result IDs不同、值[1,1]），第二份带permission/unavailable/blocker Review；Owner只传第一份即可发布Comparison，第二份及其required维度不在calculation_inputs；两份都传则抛conflicting evaluation observations。②真实DB/manager中授权后再发布同Trial另一测量身份及failed blocker Review，旧请求仍实际安装候选并写receipt。
- 根因是“比较消费集合”由Owner选择决定，而同槽第二份观察唯一的处理方式是抛错：隐藏它可以得到结果，暴露它则比较永远无法发布。两条路径都不符合冻结合同（已发布证据不可被选择性遗漏；冲突要明确报告，不能按最新/最好消解）。只把目录发现扩大而保留抛错，会让任何同槽第二记录永久阻断发布（Owner节点无可执行修复），正是本轮必须避免的“永久毒化”。

### 单一方案

- 成员权威：Comparison(C,K)消费当前Task冻结目录中所有“由自身盖章事实绑定到该对”的已发布Evaluation：campaign_spec_locator经G47引用索引等于C，且candidate臂的candidate_revision_locator等于K、baseline臂为null（沿用比较器现有接受规则；绑定了候选的baseline测量本来不能被任何比较消费，保持为已知边界）。这些Evaluation精确引用的Run（及其G38发布别名）与全部Review（G36/G39/G47）随之纳入。Owner所选测量必须是成员或仍按原规则报错；Owner无需也不能替比较决定遗漏哪份。Run因无exact Campaign字段，不从宽source猜归属：未被任何成员Evaluation引用的Run只在Owner明确选择时参与（记录为边界）。
- 同槽多次观察的派生（唯一共享纯函数，比较器与history共用）：不丢弃任何观察，也不以时间或分值择一。
  - Trial身份：一个槽位的观察必须属于一个Trial Task；且其终态观察只能有一个终态发生（task_id+terminal_time）。多个Trial或同Task多个终态发生（重跑、终态后再恢复）为required `trial_conflict:<slot>`。
  - 终态优先：槽位存在终态Run观察时，结果/资源/评分值只取终态观察及测量该终态观察的Evaluation；同一Trial的非终态观察（inactive/awaiting，outcome=unavailable）仍作为输入与其Review生效，但不提供值。只有非终态观察时维持现有语义（run_outcome required，已测值仍可见并进入差值）。
  - 一致性：参与取值的观察逐项比较。scorer的measured值唯一则采用；多值为required `scorer_conflict:<scorer>:<slot>`；typed unavailable不提供值也不与已测值冲突（无观测≠反证）。终态outcome多值为required `run_outcome_conflict:<slot>`。token/cost/activity不一致只使对应资源差值不可用（`run_resource_conflict:<slot>`，非required），不借“更新更全”择一。
  - Review：槽内所有成员Evaluation的当前Review全部生效；同一Evaluation的显式revision仍按G36，不跨测量扩大取代。
- 比较器把G49跨槽Trial重用和上述冲突一律写成明确required维度并发布inconclusive，不再抛错；其余身份/版本/运行时/未声明槽错误保持原抛错（成员经metric工具身份检查，不会因发现而新增此类错误）。calculation_inputs记录全部实际消费身份。
- 安装与历史新鲜性：授权/执行（原immediate事务）重算当前目录中该对成员；存在未被消费的不同测量事实（按G50测量key/Run完整事实，运输别名不算新测量）时给新的`EvolutionComparisonMeasurementChangedError`，Review缺失沿用原错误且扩展到全部成员Evaluation。history新增`MEASUREMENT_SNAPSHOT_CHANGED`（missing_measurement_locators）并使current intent为null；`MEASUREMENT_OBSERVATION_CONFLICT`只在派生有冲突时出现（多份一致观察不再误报），completeness/detail slot按同一派生投影。已提交receipt仍先重放；旧Comparison字节不改、不重算。
- 不做：不新增ledger/角色/业务gate/Host语义判断；不引入测量修订或按最新/最好取代；不宣称目录可证明未发布的测量（Evaluator执行了评分却不发布Evaluation、原生账本存在而未发布的测量仍不可见——此为已知下一层边界，需原生账本完整性另立事实）或未公开Trial。

### 验证计划

- 纯比较：同槽两份一致测量（不同native ID）+第二份阻断Review→inconclusive且含其finding维度；一致且无阻断→与单份同统计；不一致→scorer_conflict且不抛错；unavailable+measured→取已测值；两Trial/同Task两终态→trial_conflict；inactive+终态且judge值不同→取终态值；late usage→仅资源差值不可用、推荐不因此改变；G49跨槽重用→明确维度。
- 真实Host：G51原反例转正——Owner只传第一份，发布的Comparison实际发现第二份测量及其Review，calculation_inputs含两份、required维度出现、推荐inconclusive；另用读取主体外计数文件的冻结shell评分产生真实不同值，公开路径发布scorer_conflict而非抛错。
- 真实DB/manager：G51安装诊断转正——授权后发布不同测量身份与阻断Review，执行旧请求明确拒绝且未安装；history给MEASUREMENT_SNAPSHOT_CHANGED、intent为null；一致的运输别名不触发；原合法改判/重放/回滚回归。再做类型、SDK唯一生成器/API、docs、拓扑、源嵌入同步与完整pre-push。

### G52额度中断与Codex独立复核

- Opus于08:27:10.718上海真实退出：exit1、131 turns、is_error=true、terminal_reason=api_error，原文You've hit your session limit · resets 12:40pm (Asia/Shanghai)。准确调用模型claude-opus-5-5；末尾synthetic是CLI额度错误消息，不是另换模型。累计CLI估算109.9422252美元，前87.654808，增22.2874172，非账单/业务费用。原stream/exit及g52-opus-quota-review.json、g52-opus-interrupted.patch保留。22文件未提交由Codex按用户授权接手，不重启该CLI。
- 已核验Opus的原7文件聚焦101项667断言和相邻25项74断言通过，SDK原唯一生成器exit0；仍需独立语义审查、SDK结构差异核对、根类型/文档/拓扑、范围提交/push。测试通过不代表独立审查已完成。
- 复核发现待真实checker证伪的具体缺口：G52把同槽不同Evaluation一起纳入，却仍只要求槽内有一份Review；第二个独立评分未被审查时，第一份Review可能被当作整个槽的覆盖。现Auditor合同仍逐Evaluation审查，G29的reviewed/空findings合法结论不支持把未审查的新测量当已审。先加纯比较正向缺失审查→required维度、后发真实Review→恢复的红测；确认后用唯一已分组测量身份计算覆盖，comparison与history共用；真正运输别名仍共享同次测量的Review，不强设finding category。
- 另复核终态身份：G52用task_id+terminal_time判发生，原collector拥有真实terminal_occurrence.lifecycle.terminalEventID，时间不是发生身份。需保留这一边界并实证，不能以同时间猜同终态。先完成已证相关覆盖缺口与当前交付收尾；无依据的全局新策略不能混入本修复。

- 审查覆盖红测已确认：原G52 received promote/required=[]，62pass/1fail；现共享evolutionMeasurementReviewCoverage按真正测量组核对current Review，comparison与history共用，未审新评分明确required，实际补审可恢复。纯多观察夹具补其各自真实语义的Review，不复用别的测量审查。
- 终态身份的实施契约：Run新增可选terminal_event_id，由publisher从原collector terminal_occurrence.lifecycle.terminalEventID盖章；非终态为null，历史未记录保持undefined，不从时间/摘要回填。当前新发布总携带该事实。共享slot派生用原Task+eventID核对终态，已知ID矛盾即conflict；同事件不同时间是事实不一致，不当作晚到费用。多个终态观察若有未记录身份则明确required trial_occurrence，而非猜同发生；单份历史观察原样保留。真实Host核对盖章ID，纯合同覆盖同时间不同事件、同事件晚到费用、历史发生未知，不改生命周期/原事件/历史字节或另造ledger。

### G52最终实现与交付验收（Codex收敛）

- G51两条原反例已在当前生产路径转正。公开Host只传第一份测量时，仍完整发现该Campaign/Candidate已发布的另一独立测量及其Review；同槽不同值的scorer_conflict/inconclusive在G52由纯比较检查验证，真实Host不同值路径由G53补验（此前把计划中的该项写成已执行，G53复核已纠正）。当前Task目录按一个固定快照分页；宽provenance没有删减，真正运输别名仍按G50归并，native结果不同不会合并成同一发生。
- 不同观察现在能够显式报告一致、冲突、不可用和缺审查，而非通过抛错使任何第二记录都无法进入Comparison。统计每slot计一次；一致值和typed unavailable的处理是本次明确落盘的domain派生合同，不等于证明任意重复执行有独立统计收益。所有独立测量都需自己的current Review覆盖，真正别名共享同一次审查；全部当前finding仍贡献，合法显式Review改判保持原exact scope。
- 原实施前方案以task_id+terminal_time判终态的部分已由上段原生terminal_event_id合同替换。历史缺少发生ID不回填；多份终态事实无法证明同一发生时明确trial_occurrence required。原生不同终态/Trial为trial_conflict；inactive/awaiting原件及其Review保留，有终态时仅终态观察供应值。此为终态事实消费变化，没有改Task/Session事件创建或恢复路径。
- 当前安装唯一requireCurrentEvolutionEvidence同时核对已发布测量集合和Review集合，授权、未提交execute预检及原SQLite immediate收据事务共用。新增真实manager测试在安装后、写receipt前追加独立测量和阻断Review，收到EvolutionComparisonMeasurementChangedError及确切locator，实际安装回滚至baseline；完整重新比较/明确Review改判后可安装，commit后追加事实仍重放原receipt。旧Comparison数值、冻结旧上界历史及原测量全部不改。
- 最终聚焦98项653断言：公开Host9/179、纯比较64/207、reference4/16、独立e2e证据消费14/41、包投影1/43在.tmp/g52-codex-focused.log；其中mutation中间5/133由最终.tmp/g52-codex-atomic-tests.log的5/137替代，不重复计数；manager CAS1/30在.tmp/g52-codex-cas.log。全部对应文件exit0。真实Host包含缺审查→required、实际补审后恢复、原生终态ID、不同native测量发现、导入与完整分页；G52不同值冲突的直接验证是纯比较合同，见G53纠正与补验。实际DB/manager包含授权/执行拒绝、rename后回滚、中断恢复、显式改判、历史上界、跨Task导入及receipt重放。明确test-driver身份，不冒称自主模型Campaign或业务收益。
- 初始红测及修正完整保留：Opus comparison初轮50pass/7fail、Host未同步嵌入identity失败、mutation初轮失败；Codex缺审查红测原promote（62pass/1fail，g52-codex-review-red.log），补覆盖后旧夹具未提供独立Review的失败（g52-codex-review-first.log），以及新历史发生测试把undefined显式写入JSON被canonical校验正确拒绝（g52-codex-occurrence-tests.log）。后者改为真正缺字段，未放宽原JSON校验；没有把含失败日志称全绿。
- Lab源/嵌入2026.09.27.14，最终contentDigest为39f87368b9246bf3097d3d11b97c438a4b4a066e4d5ea5deeae6d678686d5ef2（g52-codex-package-final-sync.log）；末次README澄清“仅非终态观察”与“已出现终态”的区别后同步。只同步Lab，其他base版本漂移原样保留，未向用户项目推广。所有未提交中间摘要不是已发布版本。原唯一SDK生成器成功，递归JSON核对只增加history/detail六处MEASUREMENT_SNAPSHOT_CHANGED联合分支，去掉这六处后与HEAD逐值相等（g52-openapi-verified.json）；无DDL、新ledger、角色或UI自动化。
- 末次包同步后公开Host9/179与实际包投影1/43再次通过，完整exit0在g52-codex-host-package-final.log；它替代上面的同两文件中间运行，重复测试不另计入98/653。
- 根类型8任务、docs342ops25groups、API6规则34文件、包拓扑122/135及diff检查均通过（g52-codex-types/docs/api/topology.log）；范围提交后按原规则pull、审全部outgoing、实际pre-push并push，收据使用.tmp/g52-push.log。
- 未完成边界：本次只能保证当前授权Task冻结目录中的已发布Evaluation集合；未发布的native评分、未移交的source Task产物、未公开Trial仍不是目录可证明的事实。Run无exact Campaign字段，未测量Run不能从宽source猜归属。下一步先核对原metric执行发生/冻结Campaign归属与已发布成员之间的事实可达性，再用具体真实路径确认是否有可修的遗漏，不能凭猜测添第二ledger、任意取代测量或重开旧样本。整体可靠业务纠错/真实进化收益仍未达成。
- 主管下一次恢复不早于2026-09-27 12:45上海（原限额明确12:40恢复），继续同一session、准确claude-opus-5-5、原参数与全新时间戳收据，不加用户未设预算。恢复前收敛当时Codex修改并更新全文交接；启动后Codex停止并行编辑。当前G52只做本地确定性检查，没有外部业务Provider费用。

## G53：原生评分发生与未发布测量的可达性

### Recall与实施前影响面

- 从a98e5826已push/clean继续。用户要求额度期间实质推进原生评分到父代选择的事实链，不能把G52已发布目录当全部发生；不新开业务模型、旧样本、作者或Campaign运行。已读AGENTS、Recall/五段图/G51–G52、02-data、2026-08-17所有权拆分、当前Campaign Skill，以及metric-context、execute-evolution-metrics、metric-evaluation-host、metrics executor/store/types/sql、原TaskArtifact producer、Session tool-part-facts/MessageStore、目录资源发现及正式跨Task导入。
- 已确定的源码边界：原engine_metric_result记录owner Task、spec、iteration、attempt ref；attempt记录原Trial subject/commit和selected evidence，manifest记录原producer的Session/Message/Tool call。Lab执行Tool的原request另外保存exact Campaign/Candidate/Run；原ToolPart投影从独立持久request事实取input，不从结果/时间猜归属。通用metrics本身不声明Campaign。原package调用是唯一生产evaluate入口，但SDK底层与已导入attempt仍不能仅靠一个Tool名称猜同一完整批次。
- 可达性并非“未发Evaluation就完全不可见”：TaskArtifact catalog会给engine_resource提供resource条目，只省略其snapshot条目；attempt也是catalog资源。直接resource正式导入保留原manifest producer，Engine Artifact连带resource与原Tool request/原native DB行的运输是不同范围。当前已导入Evaluation保持G46/G47合同；本轮不跨权限读取source Task，不造并行测量ledger或合成Evaluation。
- 还发现G52交付说明的证据表述过强：最终公开Host测试真实第二次评分仍为[1,1]，另一个Trial是parse_failed；真实“同一Trial、同一冻结shell、不同已测值”的Host分歧检查在最终文件中没有实现，scorer_conflict目前只由纯比较合同直接覆盖。G52相应实现结论需用本轮真实检查补实，不能把实施前计划当已执行证据。
- 本轮具体Checker：在Campaign冻结前声明同一shell读取原subject文件及一个明确test-driver控制文件；首两次1保持原合同，第三次同一Trial/collector/iteration在不同持久Tool调用实际输出0。保存native row、attempt、manifest producer、原request输入和公开catalog可读身份；在Evaluation发布前后分别发布Comparison，记录实际calculation_inputs/scorer维度差异。原scorer/subject不改，变化的是已声明外部控制文件，明确这不是OS隔离或模型收益验证。捕获前后反例仅留.tmp，之后长期正向验收仅保留原生发生可达性、真实发布后冲突输出，不能把遗漏当正确行为断言。
- 影响面限现有真实Host测试及本记录；暂不修改生产集合/权限/安装算法。当前Task原request足以证明本次调用选择，跨Task仅有attempt资源时是否具备完整发生绑定仍未知；下一实现必须先明确当前授权事实闭包，不能按时间/iteration/文件名自动推断或让Host裁业务分数。无公共API、SDK、DDL、模型或UI改动预期。

### G53真实反例与修订方案（实施前）

- 第三次同Trial/collector/iteration的原native结果mtr_g0VWNWF5x00Ss9hTgG0T实测0，原第一次1；原producer指向独立持久Tool call-g53-metric-third，原request精确绑定Campaign/Run，当前Task公开catalog实际可读该attempt。Evaluation未发布时Comparison仅4份Evaluation输入，没有baseline scorer_conflict；发布并补审后5份输入，出现scorer_conflict:correctness:case-1:baseline:0。两次因fixture缺candidate都inconclusive，不能称实际错误promote。完整g53-unpublished-measurement-probe.json/log/patch保留；capture后主动G53_PROBE_CAPTURED退出，非产品自然失败。初次重用旧非canonical Message ID、第二次新Message漏step-start被原契约拒绝，均保留并修正driver，未放宽生产校验。
- 后续真实正向收据目录检查给出新的红测：attempt条目确实可见，但尚未被Evaluation引用的原receipt目录条目缺失（g53-receipt-visibility-red.log/patch，8pass/1fail）。此前只读snapshotCandidates而判断engine_resource均可见不完整；完整provider路径先按Engine引用过滤engine_resource，只有catalog类型独立进入当前Task目录。原receipt准确locator仍可读取，缺口是公开发现而非丢失字节或权限拒绝。
- 根因与单一修复：execute-evolution-metrics已经完成并持久化全部评分，再以engine_resource发布receipt；这把尚未产生Evaluation时的恢复入口依赖到caller Tool输出。将这份原有receipt改为catalog snapshot，使它像原attempt一样独立可发现；保留原JSON、producer、native账本、后续Evaluation单一publisher及全部G44/G45验证。只改该生产调用，不放开通用engine_resource目录，不新建ledger、角色或消息；已发布历史种类不迁移。仅同Task恢复可见性有保证，跨Task仍须正式导入原源且不得冒充目标Task新评分。
- 影响面：该Tool、Evaluator与README合同、Lab版本/嵌入及真实Host与包投影。红测保持为原receipt公开目录的正向producer/locator检查，真实0/1发布后冲突检查保持；临时“遗漏是正确结果”的断言不保留。原发布/比较/安装算法不因这个可见性修复自动获得未发布评分全集保证，G53反例仍界定下一层工作。先验证再范围提交/push，无模型费用。

### G53实施与验收

- 原执行Tool唯一receipt publication改为snapshot_kind=catalog；没有新增资源、JSON字段、ledger或读写旁路。Evaluator/README/02-data同步同Task找回原收据再发布Evaluation的合同，历史engine_resource原件不回填，不放宽通用catalog或跨Task权限。
- 正向真实Host在第三次评分Tool关闭后，从公开分页目录实际找到原attempt与原receipt，核对producer及原生值0，MessageStore读取原持久Tool input精确等于Campaign/Run输入；完整读取找到的receipt，再直接用其原resource set发布Evaluation和Review。Comparison实际包含这份测量并给出同槽1/0的scorer_conflict/inconclusive。没有再次评分或重写该收据；长期测试不保留“原生0被忽略是通过”的断言。
- 聚焦10项231断言：Host9/188在g53-host-verified.log完整exit0，包投影1/43在g53-host-projection-final.log的第二文件exit0；该较早合并日志整体exit1，因为当时Host长链触及runner默认60秒并中断，不称整份全绿。检查路径已从原53–57秒级长链增加原生评分/分页/跨调用读取，按原测试运行器支持的逐用例窗口设120秒，仅本用例；重跑Host全文件81.51秒、该长用例53.10秒通过。此为本地测试窗口，不是模型或业务运行预算。原超时与SuppressedError收据g53-host-timeout.log保留；其他驱动初次ID、step-start和receipt可见性红测亦全保留。
- Lab源/嵌入2026.09.27.15，contentDigest5a373b6a8b980f6203b8806d20e942a5683127552b0c5c6c269495b3825c6225，原生成器只更新Lab（g53-package-sync.log），非Lab漂移原样保留，未推广。根类型8、docs342ops25groups、包拓扑122/135与diff通过；当前Tool返回JSON/API/SDK/DDL不变，作用是原持久收据的当前目录可达性。范围提交后pull/审完整outgoing/实际pre-push/push收据为g53-push.log。
- G52说明中的“真实Host不同值分歧已验收”已更正为当时纯比较验证，本G53才补齐真实Host同subject/冻结scorer的不同native值检查；原G52测试数值/日志未改。本轮是明确test-driver写入合法Session/Tool事实并走真实Host/DB，不是模型自主选择、完整Task resume调度或真实业务收益验证。
- 下一项仍是已发生但未发布Evaluation的集合消费：当前Task的native row→不可变attempt→原producer→持久Tool request可以给出原Campaign/Run绑定，不能从iteration/值/路径猜；当前metrics.recorded尚未对package投影原request关联。需先核对该原事实的单一只读投影、完整/中断调用、冻结快照与跨Task正式运输，再用本G53反例验证比较/安装消费；不能用receipt可见性代替完整性，不能跨权限取source Task或新增第二ledger、任意评分取代、业务gate。业务可靠纠错与真实进化收益仍未达成；Opus仍等12:40重置、12:45以后一次恢复。

## G54：评分原请求的当前Task权威投影

### Recall、根因与实施前影响面

- 从a27b6a2d已push/clean继续，用户要求推进G53未发布Evaluation集合遗漏，不重跑旧反例、不等待主管才动。已重读AGENTS/Recall/五段图/G52–G53/02-data，核对Metric host/schema/store/sql、immutable attempt与manifest、Task Session lineage、producer-turn、Session tool_part_request/outcome/progress分表、MessageStore、当前comparison/freshness同步事务与全部recorded调用。
- G53已实证原native行本身没有Campaign，attempt只有subject/scorer、manifest只有原Tool producer；完整Lab请求保存在独立tool_part_request。其(message_id, callID)有数据库唯一约束，原请求input不会因Tool进度/结果改变。已有assertTaskAssistantProducerMessage证明精确Task/Session/assistant身份，不能仅凭同名Tool、时间、iteration或后来receipt取得执行归属。
- 当前metrics.recorded从原row/attempt验证值，但package拿不到原request事实；直接扩大目录或在比较器猜receipt上下文都会越过未证明的执行关联。先完成唯一只读原请求投影：在producer-turn沿已有Task身份断言，按exact Message/call读取原request，返回原Tool Part ID、名称和完整input；不读取outcome来判测量是否有效，不匹配Tool名称路由。metrics.recorded增加tool_request字段从原manifest producer定位该事实，不从当前调用者或后来receipt推导。
- Core producer没有Tool身份时明确tool_request=null，仍保留其原native数值；带Tool身份却找不到精确同Task请求是明确完整性错误，不能回退当前scope或外查另一Task。导入旧Evaluation仍走已有G46/G47消费，直接导入attempt不凭源producer获得当前Task账本权限。该投影只描述原请求，不声称它识别同一Tool内部任意多个SDK evaluate。
- 影响面为producer-turn新增只读reader、内部MetricRecordedObservationSchema/Host、当前架构与聚焦真实测试；既有assertTaskAssistantProducerToolPart保持原语义，不改Architect/completion decision/调度、数据库写入、DDL、HTTP或SDK响应。最终完整集合/安装原子一致性仍需在此权威基础上实现；当前同步SQLite receipt事务不能夹带异步文件读取，不另造DB ledger或从外层Tool success推断完整发生。
- Checker在G53真实评分链加原request精确输出红测，分别在Tool仍running与实际持久error后读取同一原native行，值和request一致；原完整成功评分继续通过，错误Task/缺call为确定错误，原跨Task账本拒绝保留。明确本地test-driver，不是新的业务模型或整体闭环验收。

### G54实现与验收

- 新readTaskAssistantProducerToolRequest复用原Task/Session/assistant身份断言，在同一同步读取事务按Message/call唯一键返回原Part ID、Tool名称和完整JSON input；入口仅接受身份，不带完成状态选项。原assertTaskAssistantProducerToolPart及Architect/completion decision行为保持原实现，没有扩大为生命周期改造。
- metrics.recorded的tool_request来自被读取attempt的原manifest producer，主线程后来调用、transport receipt和Tool outcome均不是来源。Core原件没有Tool身份时null；其他原件的wrong Task或missing call精确拒绝。没有重写native行、request、attempt、receipt或Evaluation，也不依赖Tool名称推断Campaign。
- 真实红测原字段缺失，8pass/1fail（g54-origin-request-red.log）；新增正确输出通过后，原第三次native0在外层Tool仍running时可读取精确Campaign/Run请求。随后test-driver按原持久化接口将该Tool结算为明确PostMeasurementFailure，原request和native值再读取逐值相同；仍从原catalog receipt发布Evaluation，原真实0/1冲突完整保留。该错误由driver明确构造，不冒称模型或生产运行自发失败。旧跨Task导入及current-owner账本边界回归通过，不把失败Tool整体丢弃或凭success认定测量完整。
- 最终聚焦16项260断言：Host9/192、metrics runtime6/53、Tool request/outcome真实存储1/15，全文件exit0见g54-focused-tests.log。wrong Task和missing call断言走同一实际reader，未使用mock替换DB；字段红测保存，不称旧行为正确。根类型8通过（g54-types.log），docs/API及完整pre-push随范围提交/pull/outgoing审查执行，push收据为g54-push.log。
- 本轮6文件范围：Host/plugin内部读取契约、新reader、真实Host测试、02-data与本记录；无DDL、HTTP或公共SDK响应变化，无Lab源码/嵌入变更，包仍2026.09.27.15/5a373b6a8b980f6203b8806d20e942a5683127552b0c5c6c269495b3825c6225且真实Host身份通过，没有推广/模型费用。
- 未解决：G53已实证的未发布Evaluation遗漏尚未被比较与安装消费关闭。下一G55应基于这一现成原请求投影及native ID/subject/scorer事实定义完整作用域，验证当前Task完整与中断调用的观察集合，并考虑原同步receipt事务所需的可复核快照。原执行Campaign不自动成为排他性归属，也不能据此禁掉已允许的跨Campaign baseline复用；一个Tool内部任意多SDK调用不能只靠同request合并。跨Task原request和原native账本未运输时明确授权/事实边界，不跨权限外查、不合成Evaluation、不开第二ledger或无依据门槛。整体业务可靠纠错/真实进化收益仍未完成，准确Opus下次恢复仍为12:45上海以后。

## G55：未发布原生测量的比较输入与当前安装集合

### Recall、影响面与实施前方案

- 起点0caab3de/main=origin、clean。承接G53原native0遗漏反例与G54已实现原request权威，不重复探针或旧实验。已读AGENTS/五段图/G52–54/02-data，全仓核对metrics写入/recorded/唯一evaluate调用、原Tool request、比较publisher/deriver/reference、history冻结读取、安装authorize/execute/reconcile/receipt immediate事务及独立checker。无委托、业务Provider、调度/终态修改。
- 根因：G52只枚举Engine Evaluation；原native行在每个attempt发布之后独立追加，既不要求外层Tool成功，也不等待完整Evaluation。G54能读取请求但不自动消费。原生行与Engine catalog_revision无共同序列，不能把当前native集合伪装为旧目录上界的历史集合；也不能在SQLite同步receipt事务中异步读取manifest。
- 唯一当前Task native snapshot由已有metrics.recorded验证每个原row/attempt/producer/request，并核对异步读取前后原row ID全集未变。只投影既有事实，不新建ledger/批次/UUID。所有原ID进入Comparison calculation_inputs的native快照；相关但尚未被Evaluation measurement_identity覆盖的原结果保留确切attempt和Run身份，派生required unpublished_measurement，允许发布inconclusive，不合成Evaluation或默许漏分。
- 相关性取实际Trial+完整collector资源字节身份+冻结scorer revision。选中Run与已发布Evaluation的Run都参与；原持久request的exact Campaign/Run可补入本Campaign未选Run，但须有当前授权目录中的原件及实际subject/scorer一致。对已确定的Run，其他Campaign请求中的同subject/scorer仍相关，故不把请求Campaign当排他归属。不同native ID不按同Tool/iteration/值合并。部分中断调用保留已发生原行并显式缺少Evaluation；没有事实证明的批次不能拼接修复。完整合法再评分发布后由G52一致值/分歧/Review覆盖处理，不永久拒绝每个第二记录。
- 原native ID全集是本次读取身份快照而非业务选择协议。安装与history共用同步ID集合差异：原Comparison任务相同则比其记录全集；导入Comparison只核对目标Task当前原生集合，不越权读取源Task。历史未记录且当前Task有原生行时明确未覆盖，当前空集则有真实当前无行事实。任何新增行（包括尚未分类的新subject）要求重新比较；新比较可排除已验证不相关观察，故不是永久业务gate。receipt原immediate事务内同步查询既有表即可覆盖rename到commit窗口，已commit receipt仍优先重放。
- 历史目录上界仅冻结Engine产物，原推荐/calculation_inputs不改。native差异明确标为当前Task的live检查，current intent据此不可用，不声称复原过去native集合；旧目录上界不能隐藏当前安装需复核的新行。此语义与当前installed revision一样属于当前性，新增明确诊断，不用时间映射两个序列。跨Task未运输的原native/request、未公开Trial仍未知。
- 影响面：内部MetricEvaluationHost快照、既有store只读集合查询、plugin唯一native比较投影/输入schema、Lab publisher/deriver、exact输入reader/独立checker、history及安装共享差异、模型合同/源嵌入/SDK错误枚举。无DDL、公开评分写API、Task调度、UI或新增角色。真实Checker将G53第三次native0在Evaluation之前验证required与原refs，发布后验证原0/1冲突；增加真实native追加后的manager拒绝及receipt事务回滚、提交后重放。保留原失败日志，按最终影响面验证/范围commit/pull/outgoing/push。

### G55实现、真实验收与边界

- `metrics.recordedSnapshot`从当前Task原生表读取每个原row，和exact-ref recorded共用唯一projectRecorded的attempt/spec/producer/request验证，再核对ID全集稳定；snapshot按每个原row投影，因此即使多个native ID引用同一不可变attempt也不合并。单独recorded(ref)仍要求exact ref唯一，并保留异步拒绝契约；不猜哪个SDK批次。最终比较快照再次核对原生ID集合，没有第二写入事实源或后台补Evaluation。
- plugin唯一native相关性函数按Trial/collector字节/scorer revision取事实；原request可引入授权目录中exact Run，baseline不因请求中的另一个Candidate而失去复用资格。比较输入盖章原生Task/ID全集及尚未被该比较Evaluation覆盖的确切attempt/Run；publisher完整read/select这些原attempt。required unpublished_measurement让原缺失可见，完整原receipt补发后走原G52数值一致/分歧及独立Review逻辑。独立checker重放原native输入，G48宽provenance保留。
- 真实Host原G53第三次native0在Evaluation前已进入required和exact inputs；外层Tool的driver错误没有抹掉该测量。找到并使用原receipt发布Evaluation后unpublished为空，真实0/1成为scorer_conflict。原fixture还在另一个兼容Campaign实际做过两次baseline评分，首轮新增缺失维度揭示它们并未在当前比较中声明；现测试只重新运输这两份原receipt并发布当前Evaluation/Review，没有重新评分，也没有按原request的Campaign排除这些事实。首轮原失败保存。
- 真实DB/package-manager在target rename后、receipt前，由明确test-driver保存合法assistant/Tool原请求，再用真实executeMetrics constant query发布attempt、落native行，并通过recordedSnapshot核对原request和实测0；旧Comparison提交精确EvolutionComparisonNativeMeasurementChangedError并回滚baseline，之后authorize同样拒绝。历史旧catalog上界仍保留原promote，但native问题明确current_task_live且intent=null。新比较使用实际验证过的native snapshot；这份query subject与Campaign Trials不同，单一相关性函数明确无pending，故可以合法刷新安装，非永久拒绝第二行。commit后再追加native行，原receipt重放保持。原比较矩阵仍是typed fixture，不冒称模型Campaign、实际shell收益或用户项目推广。
- 最终104项714断言：Host9/199、comparison65/215在g55-host-comparison-verified.log；mutation/history5/147在g55-native-atomic-final.log；reference4/16、e2e证据消费14/41、projection1/43、metrics runtime6/53在g55-consumers-final.log，均对应整文件exit0。新pure合同另外核对不同native IDs、部分覆盖、不同Trial/scorer、另一Campaign及另一Candidate baseline复用。此前g55-focused-final.log因三处命令文件名错误及recorded同步抛错而整体失败，不能因名称final称绿；正确文件已实际重跑。其余原fixture使用旧snapshot形状、Bun toMatchObject修改嵌套matcher对象、manager初版不支持的core scope均保留原日志并修正driver，未放宽生产契约。
- Lab源/嵌入2026.09.27.16/contentDigest13388a21a1d2d9279b14dc1def07a47e37fe7cb94c1d47c23eba3cd6461c5b9a，只同步Lab，默认base漂移保持原样，未推广。SDK唯一生成器后验证只有history/detail六处NATIVE_MEASUREMENT_SNAPSHOT_CHANGED分支，剩余JSON与HEAD逐值相等（g55-openapi-verified.json）；根类型8、docs342ops25、包拓扑122/135通过，完整pre-push随范围提交执行，实际push收据g55-push.log。
- 尚未证明：未公开Trial、没有已授权Run/可核对请求绑定的native subject、未正式运输的源Task native/request，以及任意SDK内部部分执行的完整receipt恢复协议。G55不合成测量、不赋予任意supersedes、不跨Task查询账本；未知范围没有被称为全集。下一项应回到当前真实Campaign运行链的输入/交付可达性与必要独立预登记准备，优先核对这些明确边界是否在实际公开调用可达，再选择有信息的Checker，不能重复G43–55或把局部机制测试当可靠业务纠错/进化收益。Opus仍等12:40重置，12:45以后按原约定交回。

- G55首次范围提交2e4d6364已通过真实pre-push并push：module1123/5698、零SCC、4clean imports/secret0。随后的角色归属复核发现新增Owner句子“recover ... publish the measurement”没有指明补发Evaluation的现有授权Evaluator，易造成共享Tool分支的角色误用。按原evolutionArtifactOwner与实际能力投影合同收尾：Owner报告给Scheduler，由Evaluator找回原receipt并发布，Owner继续如实呈现inconclusive；不新增角色、消息或Host调度。追加实际resolveWorkerCapability promptOverlay正向断言。因.16已push，前向发布源/嵌入.17，不覆盖已发布.16身份。
- 角色收尾最终Lab源/嵌入2026.09.27.17，contentDigest da482268b19976251f235608703dfc70d9cdbe56f5940bcd731744ae5ea84638（g55-role-package-sync.log）。实际包projection1/44及Host9/199再次全绿（g55-role-package-final.log），替代上段projection1/43后本G55唯一测试总数104项715断言，重复运行不累加。第二次7文件范围提交仅角色归属/版本嵌入/对应验收/本记录，实际pre-push与push收据g55-role-push.log。当前完整交付仍非模型理解或业务收益证明。

## G56：原生集合复核在实际Package Tool进程中的等待合同

### Recall与实施前影响面

- 从ba29d354已push/clean继续。按用户要求回到真实完整链的可达性，重读AGENTS/五段图/G54–55/02-data、campaign Skill/所有权、七角色/工作流、旧2026-08-17决策与现有e2e准备器、collector/Task创建/dispatch continuation/原生package运行路径，继续使用benchmark-debug-template，无委托、业务模型或旧实验运行。
- 两个初步疑点没有给出新修复依据：dispatch的initial node只绑定一次，已有continuation复用原workflow occurrence与Session；Run.workspace_digest当前已经来自collector初始tree而不是简单照抄Campaign。没有把这两项重新标成bug，也不重新跑已完成checker。
- 新源码事实：当前真实package Tool经prompt-profile-resolver→executePackageToolInCapsule→Node worker的hostProxy调用所有Host方法；hostCall总是返回Promise，父端逐条异步dispatch。native与隔离Capsule共用同一WORKER_SOURCE和wire协议。G55新增assertRecordedSnapshot却声明返回void、实现同步，publisher没有await。直接Host测试只能证明同步分支；真实跨进程调用可能忽略错误并继续publish，甚至以未处理Promise拒绝终结进程。全仓目前唯一生产调用是Lab Comparison，另有一个直接Host断言；recorded/evaluate等其它metrics方法均已异步，context.metadata为worker本地方法，不属于此缺口。
- 本轮先在已存在真实Host/DB夹具末端使用实际已编译Lab Tool bundle与真实Node Capsule执行Comparison，测试driver仅在native snapshot读取后追加一次真实原生评分，保留原snapshot与新行。读取原调用/返回/持久Comparison身份，证明真实RPC成功或失败语义，不能把源码疑点当已发生。临时原版探针只留原始.tmp收据，不把错误发布行为保留成通过断言；不调用模型或重启旧实验。
- 若反例成立，唯一修复是内部Host签名Promise<void>、实现async、publisher显式await；同一底层store同步ID核对与receipt immediate事务保持，桥接器无需替调用者猜依赖/等待所有消息，也不新增调度、ledger或gate。原recorded异步错误不再改形态。扩展正向真实Capsule checker：正常调用返回实际Comparison/native输入；快照后原生追加返回确切snapshot-changed错误；G55最终安装原子保护不重复认领为本次新修复。
- 影响面：plugin内部MetricHost、Host实现、Lab publisher/版本嵌入、真实Host/Capsule测试与本记录/当前数据契约。无HTTP/DDL/公共SDK响应变化，无新消息角色、权限扩大或业务判断。修复后聚焦真实RPC与直接Host回归、类型/文档/包身份/必要拓扑，范围commit/pull/outgoing审查后push。当前业务验证准备仍未完成；这次若验证协议边界成立，只证明真实调用链可正确承接已有复核，不证明模型判断或进化收益。

### G56原版真实Capsule反例

- 原Task tsk_g00VWNrfin00pY5Xg4ER的真实Native snapshot含2条结果。test-driver在该读取完成后调用原metrics.evaluate，同一Trial/冻结scorer实际再写2条，随后真实Node worker继续发布路径。原始RPC事件依次assert_requested、assert_failed（精确Native metric snapshot changed）、publication_requested、publication_committed；实际持久Comparison为art_hQzjYBwU3ILZZILhhOPd/revision177。Node因未await的Promise拒绝退出1，调用方得到ExecutionCapsuleRuntimeUnavailableError及原stderr，而非正常Tool failure协议。
- 原收据g56-capsule-snapshot-probe.json/log/patch完整保留。它使用真实已编译Lab bundle、Task process binding、Node worker/Host RPC、DB、metric executor和publisher；并发追加时点由明确driver包装原snapshot读取控制，不是模型自主行为或自然调度故障。capture后主动G56_CAPSULE_PROBE_CAPTURED退出不是产品自然错误，产品的Node退出1另有原stderr。原payload未被手工改写，没有执行promotion；G55安装原子保护仍独立有效。
- 据此实施上列Promise<void>/async/await单一修复。共享RPC桥本身正确返回Promise，不新增自动推断依赖、等待所有调用或重试；扫描其Host合同只发现这个新void方法，metadata是worker本地回调。长期正向测试保留精确跨进程错误与随后正常Comparison/native输入，不保留错误发布为通过断言。

### G56实施、验收与真实验证准备边界

- 内部MetricHost.assertRecordedSnapshot改为Promise<void>，原Host实现async，唯一生产publisher调用显式await。底层assertMetricResultIDs和receipt immediate同步事实读取完全不变，没有把异步读文件放进SQLite事务，也没有改桥接器/Task/Mission/Session/调度状态机。
- 正向checker使用实际已编译Lab bundle、Node worker、RPC和原Host；driver在真实snapshot读取之后用原executor追加评分。跨进程返回精确Error/Native metric snapshot changed，而非worker退出导致的RuntimeUnavailable。随后新的正常Capsule调用返回真实Comparison，读回native ID全集与原账本一致、全部尚未发布测量给精确required维度和inconclusive。原快照/原测量/旧推荐不改。driver只控制并发窗口，未把Host stub当成这条公开路径；另有原RPC值运输与native process binding合同回归。
- 最终14项263断言（g56-capsule-focused.log整文件exit0）：Host9/204、真实包投影1/44、RPC值运输3/5、native package进程1/10。最后一项含原8个并发introspection，仍归同一Task process authority。根类型8、docs342ops25、拓扑122/135及diff通过；不重复G55统计或原安装测试冒充本轮新增收益。模型调用0，费用0代表没有外部业务Provider调用。
- 横向只读检查：原生与隔离Capsule分支共用同一WORKER_SOURCE/hostProxy；本轮实际运行Windows native Node，未启动OCI镜像。39个package TypeScript文件中68个Host调用的直接表达式检查当前无裸Host调用（g56-package-host-call-audit.json）；这是机械补充，不能证明任意Promise别名的数据流。其余Host合同原本异步，metadata/Stats本地方法保持同步，无需改共享RPC协议或新增调用队列。
- Lab源/嵌入2026.09.27.18/contentDigest d6df7e22af13e9fb01706f2da409a83cad061713367b63548537cf33e68cc35c，仅同步Lab（g56-package-sync.log），默认base漂移保留，未推广。9文件范围提交，完整pre-push与实际push收据g56-push.log；内部返回类型变化无HTTP/公共SDK响应/DDL改动。
- 真实Campaign准备的新确定边界：旧随机e2e脚本默认openai/gpt-5.6-terra、controller inactivity1200000ms、judge120000ms，prompt固定repetitions=1/max_runs=2/max_cost=10，独立checker也硬认一次repetition。这些是旧协议验收输入，不是当前用户新的Luna/300秒真实无活动/不得自行费用预算授权；n=1在现有比较器不能形成支持promote的完整区间，也不能把non-executing inconclusive当真实进化收益。未启动该脚本、凭据或旧run，也不为凑结果修改旧预登记。
- 下一G57继续把新的独立验证压成明确可证伪机制与真实可执行输入，先审现有Campaign预算字段/冻结范围和新用户约束（当前max_cost要求显式非负数，没有已证“0=无限”含义，不能偷用0或10），选定足以回答机制问题的固定次数、来源/包/模型/目录、失败停止与全费用记录，再准备新入口。不能直接重用旧随机抽样、伪造金额gate或替补失败样本。当前Capsule协议修复不等于模型会正确恢复测量，不等于原业务纠错/真实进化收益已达成；Opus仍12:45上海以后交回。

## G57：未声明费用上限的真实Campaign输入与展示

### Recall、影响面与实施前方案

- 从f99d76bc/main=origin/clean继续；用户禁止自行设费用预算，要求新的独立真实验证先完整登记并使用流式Luna/300秒真实无活动。本轮首先回答一个可证伪的准备机制问题：没有声明费用上限的授权能否沿Opportunity→Campaign Tool输入→真实持久化→history→实际页面保留原义，而不被迫伪造0或10？这不是业务模型预登记，不启动Provider、旧随机控制器、旧实验或新的Campaign模型任务；12:45上海优先交回原Opus。
- 已读AGENTS、Recall/五段图/G55–56、02-data、当前Campaign/Opportunity输入与Artifact schema、history context、真实publisher、Planner/Observer/Skill/README、旧e2e配置和checker、历史2026-08-17合同及实际Host/mutation测试。全仓max_cost/maxCost搜索确认三个Artifact/input预算定义和history预算均只接受非负数；未找到max_cost执行金额gate，旧e2e仅硬声明/核对10。唯一页面消费在ExpertSquadEvolutionPanel预算行，公共history/detail SDK类型也受影响。无委托。
- 可观察现象是明确null输入会被数值schema拒绝；根因是合同没有“未声明上限”表示。旧固定10仅使协议夹具可运行，不能代表本用户授权；0是实际零值，不能私定无限语义。当前费用统计/usage ledger不是这个字段，不能用未知计价混淆未声明上限。此次不触及调度、终态、角色授权、测量集合、统计方法或安装事务。
- 单一实现：在已有evolution公共schema定义共享cost ceiling与Campaign budget；max_cost必填且为非负数字或null，null精确表示未声明金额上限，数字（含0）原义保留。Opportunity建议预算用同一cost定义，Campaign存储/输入/history共用同一budget定义。无默认值、fallback、历史回填或新ledger；此数据表示不增加花费授权，也不新增Host金额gate。
- 同步模型侧Observer/Planner与现README/Skill：没有用户/Mission声明时写null，建议值不等于授权上限。页面明确显示“未声明费用上限”，不把null显示为空或计价未知；英文同步。原数字历史原样读取。公共OpenAPI/SDK用唯一生成器更新并审查精确差异。Lab源/嵌入仅前向同步Lab，默认base漂移不动。
- 验收：先保留原Tool输入null的明确红测，再经真实Host实际发布Opportunity/Campaign并读取持久化原值；共享schema验证null/0/有限数及负数明确错误，实际history读取null。页面只用隔离本地真实服务/ui、真实浏览器交互与截图人工复核，不新增/运行UI自动化测试；本地诊断夹具明确标示，无凭据或业务模型。必要根类型/docs/拓扑、SDK结构检查、差异审查后范围commit/pull merge/审完整outgoing/auto push。
- 风险与边界：允许null只解决当前真实验证准备的预算表达阻碍。既有controller模型/超时/重复数/随机输入问题仍需独立方案，不能直接运行。此次不宣称已完成模型Campaign、监督纠错或进化收益；实际页面若无法获得证据，必须明确报告该未达成项。

### G57交付与验证

- 原发布输入的budget子schema真实拒绝null，ZodError指向budget.max_cost/expected number（g57-budget-schema-red.log）；这是输入合同红测，不冒称原完整模型Tool运行。现EvolutionCostCeilingSchema与EvolutionCampaignBudgetSchema是唯一实现，Opportunity建议、Campaign输入/持久化及history共用。null明确未声明金额上限，0和有限正数原义保留，负数映射到too_small错误；字段仍必填。没有金额gate、实际费用代值或历史回填。
- 正向生产Host实际发布并读回Opportunity.suggested_budget.max_cost=null和Campaign.budget.max_cost=null，原后续比较/跨Task导入/Capsule路径通过。实际DB/history在review-freshness分支读回null，其他安装/恢复分支仍使用有限数1并保留原值。最终81项615断言，g57-focused-tests.log四文件exit0：Host9/205、comparison66/219、mutation/history5/147、实际包projection1/44。没有新的外部Provider请求。
- 真实页面验证使用独立.tmp/g57-visual-runtime/home与project、实际source Server.listen及本次编译overlay/ui；未复制auth/models。显式本地诊断Task tsk_g00VWNyA6m00Nr7pnBZ3、Campaign art_g0VWNyAHu00oqj1mMoF6/revision3只作预算呈现夹具，无模型请求/候选/业务实验。经真实Installed Expert Squads→Evolution History交互，页面从实际history读取budget={max_runs:4,max_cost:null}，截图人工确认“Budget: 4 runs · No cost ceiling declared”完整可读、无遮挡；首次截图该行在折叠视口下方，滚动后才实际看见。英文页面实际验收，中文文案同步；未宣称中文页面另验。截图在本次CUA工具回执，种子/服务收据g57-visual-seed.json/g57-visual-server.json、日志g57-visual-server.log保留。浏览器页关闭，自有服务通过stop marker正常exit0；没有UI自动化测试。
- Lab源/嵌入2026.09.27.19/contentDigest88cea9739a98a32fa78522ec44d1ae14f18f09af3a2fa574fd13030870e09327（g57-package-sync.log），仅Lab同步，base漂移保留，未推广。Observer/Planner/Skill/README明确未声明写null，建议预算不等于花费批准。SDK由唯一生成器完成；g57-openapi-verified.json逐值确认仅history/detail两处max_cost从number扩为number|null，其余JSON相同。无HTTP路由/数据库表变化。
- 根类型8/8、docs342ops25、包拓扑122/135、前端正式构建与diff通过；实际pre-push与推送结果以g57-push.log为准。上述可达性修复不构成新业务Campaign预登记，不重启旧随机e2e，不代表可靠纠错/进化收益。
- 下一G58应收敛新独立验证的完整输入与执行计划：优先选定一个可证伪的机制问题，明确自然证据/来源、唯一改动、固定源包/候选边界、Luna模型、300秒真实无活动poll2、目录、固定次数与停止失败/全费用。可用null忠实表达未声明金额上限；旧e2e的随机target、n1硬断言、默认Terra与超时仍不能直接当本用户新运行。先核对真实Mission→stage Task→target Trials→import→evaluation的输入可执行性；需要新执行入口时复用当前原语，不造并行ledger/隐藏答案/业务gate。没有完整独立登记前不调用Provider，不将永久等待登记当结果。12:45上海优先范围提交并交回原Opus。

## G58：新独立验证输入与Trial初态可达性

### Recall、影响面与实施前方案

- 从d30935ca已push/clean继续。用户要求实质准备一条新的独立真实验证，而非重跑旧世界、随机target或把G43–57局部合同当收益。重读AGENTS、Recall/五段图/G56–57、02-data、benchmark-debug-template、Evolution Lab三个workflow/角色/Skill、旧e2e入口及checker、panel.create_task/Task创建、工作区初态/Project目录注册、候选prepare/merge、source snapshot、cross-task import、metrics subject全部相关定义。无委托、Provider请求或旧run巡检。
- 当前没有已证新模型侧因果修复；不能先造一个候选或削弱baseline再声称进化。选择新的固定本地经营数据诊断，target为已有data-analysis包，不随机抽样：分层成功率都提高但混合总体下降时，能否保存正确分母、如实给数值和组成效应解释并完成原工作流？输入是本轮新合成且明确标注的两期两层计数，不用旧Cycle/H样本。完整执行计划将先有一次自然诊断；若正确，只记普通交付、不启动无依据作者；若出现具体错误，保留原件再据实确定单一可改机制，不能重抽同义案例找失败。
- 本轮产出是冻结输入、独立算术验收及本地运行可达性Checker；尚不执行模型。完整诊断启动登记需要固定实际source commit/target包身份/目录、精确Provider预检与停止成本合同后才算可执行，不能把本段计划当已经运行。后续Campaign阶段必须沿实际自然结果登记唯一改动，不因为预先想要提升而修改测量定义。
- 新源码边界：旧e2e仅把4个case/subject文件放workspace template，却把README和campaign/model/environment/workspace/scorer等也提交到同一Git源目录；Task创建从原sourceSnapshotPaths完整枚举，metric-context比较完整Run.workspace_digest，因此不是可以直接沿用的真实初态。候选作者还向其primary提交候选目录；共享同一物理Trial根不能靠叙述“相同环境”消除此变化。不给Host放宽workspace校验、不让模板包含自己、不从Case子集冒称整个初态。
- 已有合法路径而非新状态机：panel.create_task已有directory，EngineService在原项目目录上下文调用Project.registerExecutionDirectory，把一个明确独立Git执行库排他登记到同一durable Project；其配置/包权限仍来自原项目，物理root/初始tree按各Trial登记。跨Task import检查同Project/Mission而非相同物理路径。普通Worktree.create总取其所在Git库primary分支，故独立Git库可隔离后续candidate/Trial写入，不修改生产worktree实现。是否完整可达须真实createTask/checkpoint/Artifact运输证明，不能仅凭源码宣称。
- 有界Checker：在隔离临时Project中使用原注册/EngineService.createTask和原持久Task binding，两个独立Git库拥有同一完整输入树；原primary另有控制文件，再追加阶段交付。确认两Task持久project相同、directory分别准确、initial tree与固定输入逐字相等；真实文件追加使该库新快照变化而另一库仍原值。测试driver明确接管ingress，避免模型调用；这只证明真实接受/绑定和物理隔离，不冒称模型调度或独立Git对象已可供shell评分。G43独立库shell对象缺失仍须typed unavailable，不借这个准备绕过；后续真实诊断本身不调用Evolution metrics。
- 影响面仅新独立输入/规格索引及聚焦非UI测试，若既有合法路径被反证则保留原错误并收敛精确阻碍，不盲改Task/Project/调度。无公共API/DDL/角色/ledger/gate、无UI测试、无业务金额或模型预算。测试与文档检查、范围commit/pull merge/outgoing审查/push后更新交接；12:45上海优先交回原Opus。

### G58实际准备与验收

- 已固定新合成service-mix输入：2026-07/08、standard/complex两层、4条完整eligible/successful计数。它不是旧案例重抽，未故意弱化target。独立Python Fraction只从同一metrics.json派生：整体49/65→73/110、两层分别+1/10/+1/25；以前期权重标准化后21/25，within28/325、mix−97/550，和精确等于总体−129/1430。原operator算术收据g58-arithmetic.json，未注入模型消息或变为Host gate。输入/定义/一次诊断与停止/费用/未知合同在specs/artifacts/2026-09-27-evolution-readiness/README.md；真实模型仍未运行。
- 真实目标package manager安装embedded builtin/data-analysis@2026.09.02.1，原包digest27141f11209e4891fc2119b3f84a239238c08d8951cd5fefab6143e30f31e0ed，不是generated contentDigest，两者不混用。此次目标选择是与固定经营数据匹配的现有包，不使用旧随机selector。没有写新候选、改角色或推广。
- 现有directory路径正向Checker1项14断言通过（g58-readiness-initial.log全文件exit0，首次即通过）。实际EngineService.createTask接受两个独立Git执行库，Task IDs tsk_g00VWO20KF00e4qfAeFe/tsk_g00VWO20YO006p2eHrZQ，同Project prj_h4DjXROuxh7fRcUAdfCP、原package/process binding准确，初态完整4文件（.gitattributes/.gitignore/metrics.json/request.md）相同，tree d285b2ec25c80d6389dee4cfb6092a45a4533157466dbf96caa3ec8f20ac036b。协调根追加control和第一执行库新增report后，第二库逐字保持初态，第一Task原binding不改。所有库由本地Checker新建并清理，未在开发仓库创建branch/worktree。
- 原Task接受与数据库绑定是真实生产路径；既有test hook持有ingress，未调用Provider，没有冒称模型调度、Mission panel原调用、checkpoint终结、完整Artifact跨库运输或shell评分。源码核对Mission panel directory→同一EngineService、原sameProject/Mission import与独立目录登记合同；整体执行仍需新launcher。G43独立Git库的shell对象缺失限制保留，不能把原生collector bytes当对象运输授权或把unavailable改成通过。
- 旧e2e四文件模板与更宽实际Git源的差异属于本轮源码确定准备问题，未重启旧controller或重跑其历史实验；新Checker证明可用原显式目录合同保留初态，没有放宽生产workspace身份或新增配置/调度路径。本轮只新增聚焦测试/冻结输入/独立算术与索引、记录，无生产API/DDL/SDK/包嵌入变化。
- 下一G59应实现并本地验证最小diagnostic-01运输入口：使用上述冻结实际包/新input和独立执行库，单一model/inactivity配置、成对auth/models及精确流式预检、原Mission创建/状态/abort/费用事实，固定只一次自然diagnostic目标Task，不隐式调用候选/旧随机脚本。启动前把最终source commit、目录、实际模型预检结果和输入/包身份写独立launch receipt；不存在receipt即未运行。有自然正确交付只记普通成功，有自然错误先定位再另登记单一干预和后续Trials，不能为了产生候选追抽。完整启动条件未满足前不碰Provider；这是待完成运行器工作，不是授权阻塞。12:45上海优先交回原Opus。

## G59：固定诊断的独立运输、预检与收尾入口

### Recall与实施前影响面

- 从75de77a8已push/clean继续，已读AGENTS/Recall/五段图/G57–58与G58输入登记、原e2e request/status/abort/活动primitive、RealProviderAudit及全部调用者、native audit plugin、原UsageLedger、Mission活动cursor、Task目录接受与自有runtime清理。目的只把固定diagnostic-01变成可审查运行入口，不启动旧控制器、随机target、候选或Campaign。尚无业务Provider调用。
- 单一入口拟为script/evolution-diagnostic.ts：prepare模式只初始化新隔离home/coordinator/独立execution Git库，真实安装指定embedded data-analysis、读取完整初态、生成普通Mission请求、启动/关闭本地真实服务并保存准备收据；run模式需显式auth源、干净已提交代码、唯一固定run目录，复制成对auth/models并验证原模型投影后才进行一次真实流式preflight和Mission wake。已有目录是明确错误，不覆盖/另抽。最终Provider启动源身份写launch，准备测试目录不能冒充注册运行。
- 模型/小模型统一为登记的Luna，复用原配置及Native process audit插件，不加total turns/duration/cost。现RealProviderAudit构造器强制数字maxRequests，native插件也以Number读env；新增显式null表无请求计数上限，原有限数字调用保持原义。不是用MAX_SAFE_INTEGER伪装未设置。流式/模型一致性继续原唯一audit；前检poll显式2000ms，旧调用默认值保持其原既有配置。
- 原copiedOAuthExpiresAt在过期后拒绝任意外部请求；为严格遵守不刷新复制凭据，原audit同时对OAuth标准refresh_token grant给明确权限错误（无凭据输出）。母进程与native插件共享同一进程audit实例，避免同一次请求两份统计；其余子进程各自原snapshot publication保存请求元数据，原usage表仍唯一用量账本，不把请求收据当第二费用账本。
- 运行只用原HTTP Mission wake/status/activity-cursor/abort与Task读取、原Session preflight。300秒真实活动窗口复用durable cursor并结合原流活动，poll和写observer收据不算活动；固定一Task超出登记、明确Provider错误、pending交互、Task失败或无活动终止该次，不重试Mission。终态需自然Mission inactive+原Task terminal；成功只报execution settled/business pending review，不在runner按关键词替模型或人判断业务正确。
- 收尾先停止本轮Mission/活动与listener、settle原instances/processes/DB，再删除本轮成对凭据；保留原Task/Message/Tool/terminal报告与全部usage、未知/未定价和preflight；provider异常也保留中断原件。只对自有隔离根执行清理，不触用户或旧进程。原生read/projection与本地prepare可测试，真实凭据/Provider还未验证，不因本地checker绿称业务通过。
- 验收：null及有限上限、准确模型/流式/复制凭据refresh错误的聚焦正向合同；真实新process prepare→Host/package/输入/收尾收据与唯一目录冲突错误。脚本类型检查/root类型/docs/diff及完整prepush，范围提交/pull/outgoing/push；12:45上海优先收敛交给Opus。启动真实诊断必须在入口源码提交后独立进行，不将开发期间prepare标成真实样本。

### G59入口交付与本地验证

- 新evolution-diagnostic.ts提供互斥prepare/run。prepare用新目录真实启动原source Host/InstanceBootstrap，安装冻结data-analysis，封存原完整4文件初态、生成可见Mission请求并正常收尾；不接收凭据，providerProjection明确not_checked。run只用已注册diagnostic-01根，要求干净提交和显式已授权auth源，原配对models须含Luna；仅复制原OpenAI记录，先建立不刷新/过期检查，再加载凭据相关runtime。claim防重复，实际包/输入/模型投影齐全后才写唯一launch.json并开始真实stream preflight。当前测试阶段尚未写真实run launch或调用Provider。
- 原RealProviderAudit新增显式maxRequests=null，旧数字（含0）继续其原计数合同；native插件读取显式JSON ceiling。同一进程audit实例供入口与插件共享，子进程各自记录原请求元数据；没有第二费用账本。复用原UsageLedger全行导出，unpriced/unknown或无行的cost仍null。原copied-access检查之外，标准OAuth refresh_token grant精确CopiedOAuthRefreshForbiddenError，测试没有真实刷新。新入口preflight轮询显式2秒，无新增model total/turn/cost预算。
- 运行路径仅原Mission wake/status/activity-cursor/abort及Task读取；原durable cursor结合in-process stream last_activity_at，不把controller写文件/轮询本身算进展。固定一Task，失败/交互/超出预登记/300秒无活动都停止同次而不换样本；natural settled仅execution_settled/business requires independent review，runner不按业务数字或关键词定成功。收尾先原runtime/自有processes/DB并导出usage，再删本轮凭据；收尾错误独立cleanup_failed，不能把prepared误报整体通过。
- 最终13项46断言（g59-verified-tests.log，entry1/5、audit12/41，均exit0）：真实新进程prepare封存原d285…完整tree、加载实际27141…目标包、正常listener/实例关闭；第二次同目录精确DiagnosticRunAlreadyExists且原收据逐值保持。真实本地HTTP传输验证null不设计数上限、一次请求只有一份共享audit、正确模型/流式/原有限计数/过期与refresh权限错误；不是外部Provider或Luna能力证明。显式脚本类型检查g59-script-types-verified.log与root类型8/8、docs342ops25通过。
- 原失败保留：entry初版多写一个右括号（g59-entry-audit-initial.log）；继承test process root未对齐自有home导致隔离错误（g59-entry-second.log），现显式自有process root；prepare没有models却试图验证Luna配置给ProviderModelNotFound（g59-entry-third.log），不是凭据错误，现prepare不启用Provider配置而显式not_checked，run仍要求真正paired catalog和原校验，没有伪造模型条目。第一次单文件tsconfig漏载原*.md声明且inputFiles空数组推断never；加入原sql.d.ts等声明及准确数组类型后实际检查通过，没有suppress错误。
- 单独只读核对当前已授权源路径C:/Users/hengu/AppData/Local/opencorvus/data/auth.json及相邻models.json：文件存在，OpenAI记录类型oauth、到期1791088087790晚于当前时间，catalog中存在gpt-5.6-luna。未输出credential值，未刷新/复制；这只是期限和目录事实，不代表网络凭据已可用。真正stream preflight仍待提交后的唯一run证明。
- 下一步在本范围commit/pull/upstream..HEAD完整审查/实际push后，若无新的实现阻碍，用已登记唯一run调用该入口；运行中不改源码/spec、不另开业务样本，每五分钟必要原收据快照。12:45上海仍优先交回准确Opus；若诊断届时还在运行，向原主管明确运行源码冻结，先监督同一run到自然结算，不并行改其运行依赖。真实业务结果以新launch/preflight/Mission/Task原件为准，不用此次本地13项代替。

### G59唯一启动的真实初始化失败与修正方案

- 已push源594670201bc477ef107eeee7f3acf6327ee6c9f5后，于2026-09-27 11:39:24上海实际调用登记入口，claim PID25072，11:39:29 exit1。原根.tmp/evolution-readiness-g58/diagnostic-01保持：claim存在，launch/preflight/Mission均未产生，audit requests=0、UsageLedger原表0行；runtimeDisposed/credentialsRemoved均true，原result/log保留。没有实际业务样本或模型费用，不能称诊断已执行，也不连续重启或换目录。
- 原先只读源catalog含Luna不等于裁剪后catalog可用。本次真正上游错误是provider phase=catalog.read：models.json missing required provider kilo；后面才是openai不在模型列表及ProviderModelNotFound。入口为了少复制内容把models裁成openai，却破坏ModelsDev完整catalog要求（kilo/opencorvus是必需元数据）。这是本轮runner根因，不是源凭据或Luna额度错误，不改核心模型目录验证、不补造provider条目。
- 单一修复方案：把授权文件读取/成对stage抽到此入口的一个helper；auth仅原OpenAI credential record，models完整原字节运输，先用原ModelsDev.validateExplicitCatalog验证整份源与指定模型。返回只有expiry/provider/model元信息。caller仍在该stage前标记可能部分复制以保证收尾，scope/不刷新/唯一目录原规则不变。一个真实本地file stage测试从原完整catalog读取、写回逐字一致、再用原catalog parser检查指定模型及必需providers；无需凭据真实请求。更新原README中过强“仅OpenAI记录”措辞，保留原失败claim；当前不自动重试该诊断。
- 修复已经落到唯一stageDiagnosticProvider；本地真实文件运输及原ModelsDev解析检查通过，原完整catalog字节、指定模型、kilo/opencorvus元数据逐值保留，auth只运输OpenAI结构。此用例用明确本地测试OAuth值及测试目录原catalog，不能当真实账号或Luna请求证明。最终14项52断言全绿（g59-catalog-tests.log，entry2/11、audit12/41）；显式脚本类型g59-catalog-types.log、根类型8/8（7cached，g59-catalog-root-types.log）及docs342ops25（g59-catalog-docs.log）通过。无公共API/SDK/DDL/包嵌入改动。
- 原diagnostic-01初始化失败根及零请求原件完整保留，没有重新运行或更换样本。运行器仍要求唯一新根，当前业务诊断未开始；要继续必须先明确同一已登记初始化的恢复合同并保持原失败收据和唯一业务launch，不能删除claim、覆盖result、换目录或将本地prepare当真实模型验收。整体可靠纠错与进化收益仍未完成。

## G60：同一诊断在业务启动前的初始化恢复

### Recall、影响面与实施前方案

- 从1094abb8/main=origin/clean继续。用户授权修复本地运行器后继续已登记的一次诊断，禁止重抽/替补/覆写历史；12:45上海交回原Opus。已读AGENTS、本文Recall/五段图/G58–59、G58 artifact README、02-data、入口/Provider stage/audit snapshot、原SQLite表与其他真实运行器。使用benchmark-debug-template但不应用重复业务样本循环，无委托。用户仅问GPT-6 Luna可用性，当前5.6 Luna登记保持。
- 原G59根11:39失败已正常清理。此次再次只读原DB：session/engine_task/provider_usage_event/provider_activity_request均0；原audit所有publisher最新snapshot均0请求；没有launch/preflight/Mission，当前真实命令行无此入口进程。直接触发是唯一root的mkdir拒绝重复；根因是入口把本地初始化claim与业务launch混成只能首次进入，目录运输修好后仍不能沿原诊断继续。未知/已发生模型请求不能以最后error覆盖。不是Task/Mission/Session occurrence异常：生产调度尚未接收任何Session，原路由和停止/终态路径保持。
- 单一恢复入口为显式--resume-initialization <原收据相对目录>，原首次目录用“.”；只在同一root复用原home/coordinator/execution/DB。原claim/result/initial-tree及审计字节保持；新初始化收据放root下新initializations子目录。每个已结算parent只允许一个append-only continuation.json（exclusive create），指向唯一child；并发重入给明确already-continued错误，不按时间挑最近，不回收未知存活claim。新业务launch仍只在root exclusive create一次，业务已开始/stop/未清理/证据缺失均精确拒绝初始化恢复。
- 恢复前从原claim+result核对mode/model/pid/start/source、finished/cleanup与注册约束，读取当前原DB四表及全部原audit，要求可证明业务未开始。无原DB或缺audit不能猜0；prepare模式可继续同一已完成无Provider的准备，用于真实checker，run仍只认失败且未launch。input文件从实际execution与原登记源逐字核对，再用原完整tree primitive核对原initial-tree；不重新init/commit或重写输入来抹变化。原包仍由真实manager读取同一冻结digest。
- 横审范围含入口首次/恢复、prepare/run、清理失败/中断、并发parent、跨root路径、已有launch/原生请求事实；仅诊断transport收据受影响。原Mission/Task/Session创建、model配置、原native usage、调度和业务停止规则不改；不增加Host业务gate/第二费用ledger/新角色，不动旧controller。恢复前结算原本地初始化不消耗新业务样本，仍只允许一份未来业务launch。
- 验收：原完整prepare启动/停止后沿显式同root恢复再真实Host/package/完整tree/cleanup；原parent收据逐字保持、continuation精确指向child；同parent再次恢复、路径越界、已launch或原DB有请求给明确错误。阶段性file/DB fixture用于错误合同，不能冒称真实模型。完成脚本/root类型/docs/diff/范围commit/pull/outgoing/push后，才可对原diagnostic-01做一次已授权初始化恢复；失败原件保留，不自动循环。若临近交接，先交付可审查实现，不抢占原主管。

### G60实际本地验收与交付边界

- 唯一claimDiagnosticInitialization读取原DB与audit后，exclusive创建parent continuation并分配新收据目录；evolution-diagnostic.ts首次入口与显式恢复共用同一剩余执行路径。原home/coordinator/execution/DB复用，输入只读核对，恢复不再git init/add/commit；完整tree仍用原primitive逐值核对。业务launch仍是root级exclusive文件。未修改业务Role/Task/Session/Mission/Provider core或费用权威。
- 初次真实准备及恢复均正常启动/关闭实际Host、原包加载、完整初态保留；原parent claim/result逐字相同。原业务launch标记、原实际schema插入的明确local-test usage行、越界parent及重复parent分别返回精确错误；并发两个claim真实争用同一文件，恰一份success/一份already_continued，原continuation指向成功者。用量行只是本地错误合同fixture，不是外部Provider测量；prepare不请求模型。
- g60-focused-tests.log全部exit0，14项62断言（entry2/21、audit12/41）；此前g60-entry-initial.log2/19为增加并发断言前的中间通过，不重复计数。脚本类型g60-script-types-final.log、根类型8/8（7cached，g60-root-types.log）、docs342ops25（g60-docs.log）通过。没有遇到新的生产调度/终态异常；原业务诊断仍需提交后唯一恢复及真实preflight证明。

## G61：diagnostic-01独立复核与最早支持机制（Opus恢复）

### Recall与复核范围

- 2026-09-27 12:46上海以准确claude-opus-5-5恢复同一主管会话；HEAD 0ab85736=origin/main、clean。G52–G60由Codex交付不重做；G60 diagnostic-01已于12:41:44自然结算（controller exit0、runtimeDisposed/credentialsRemoved均true），本轮不重启、不恢复、不补样本。只读取原root/initializations/f81ffbbf收据、原隔离SQLite（`mode=ro`）与不可变TaskArtifact快照；提取脚本`.tmp/g61-read-artifacts.py`、`.tmp/g61-writer-tools.py`与导出`.tmp/g61-diagnostic-artifacts.json`保留。
- 报告资源经原manifest逐字核对：snapshot c00f4f6b…/manifest a330f937…/`artifacts/data-analysis/report.md` 4581 bytes sha256 d96b2bab…，与Completion Decision art_g0VWOOokY00BVgcxbt6N/rev45所列deliverable一致。

### 业务结论（按G58登记的独立验收）

- 报告逐项正确：July 80/100、18/30、98/130=75.3846%；August 9/10、64/100、73/110=66.3636%；整体−9.0210pp；两层分别+10.0000pp、+4.0000pp；占比76.9231%→9.0909%、23.0769%→90.9091%；以七月权重固定得84.0000%（=273/325），rate effect +8.6154pp（=28/325），mix residual −17.6364pp（=−1261/7150），二者精确合成−9.0210pp（=−129/1430）。明确七月为参照、把分解称为描述性算术而非因果，下一步有界（复杂层失败样本复核），并列出聚合数据不能证明的事项及August standard仅10个样本。按登记的业务验收：**通过**，是一次未修改baseline的普通正确交付，不是纠错或进化收益。
- fact-checker的`data-analysis/audit` art_hYsAng8Pl1vIiJpAIUpG/rev37独立重算了同样数字并给出“无需更正”；insight-brief rev33同值。该次审计没有反证可供纠错，因此本样本不能检验“真实反证→改判→返工”。

### 同一交付中的真实证据链失败（自然发生、原件保留）

- 终稿Engine Artifact art_hFDlmYZ9zebkGDdpfiPy/rev42的`source_artifact_locators`只有request.md与metrics.json两项原始输入；六个类型化前驱（charter/dossier/performance/segment/insight/audit）一个也未消费。报告正文与payload都写“No data-analysis/audit predecessor Artifact was available in the current Task catalog”，而audit在其之前（rev37，1790483440307）已发布。这是交付物中的**错误流程事实**，不是业务数值错误。
- report-writer真实Tool序列：①按提示只找`data-analysis/audit`，但用`sources:["task_artifact"]`——宿主返回`catalog_total:3、catalog_complete:true、no_match`并把`artifact_types`列为unmatched，没有说明Engine来源被该过滤排除；②package类型化发布器依次拒绝：payload形状、`data-analysis/report requires 6 exact source Artifact locator(s)`、两次`Artifact inspection failed with 1 diagnostics`（诊断内容未进入模型可见消息）、一次伪造manifest_sha256格式错误；③Engine文本检索“service completion”对41项为0；④**改用通用`artifact_publish`，以`data-analysis/report`类型和两项原始输入发布成功**，绕过类型化发布器的六前驱/生产者/ABI校验。
- 同一搜索误用在全部七个worker出现：planner、steward、performance、segment、insight、report-writer的首次前驱检索都把Engine类型放进`sources:["task_artifact"]`或错配`kinds/labels`而得到“完整目录无匹配”；五个随后用宽检索恢复，steward经原生coordination后才找到charter，report-writer未恢复并绕过。类型化发布器全程失败23次（主要是把resource_set/sources塞进artifact及来源数量），193个Tool请求中32个未完成。orchestrator另有7次相同`cursor:"bad"`失败检索。
- orchestrator的Completion Decision同时引用报告与audit作为证据并接受，未指出报告自称“无audit”且未消费任何前驱；Mission随后被唤醒复核Task完成，但diagnostic controller在Mission会话刚开始流式（step-start 1790484104493）时以`status==inactive && Task completed`结算并停机，该Mission回合以`MessageAbortedError: Server.stop graceful runtime shutdown`终止——Mission自身对终稿的复核被运行器截断，这是runner结算竞态，不是模型行为。

### 用量与未决请求

- 原生`provider_usage_event` 204行，全部openai/gpt-5.6-luna/session/priced：total 10,162,160 tokens（input 1,436,205、output 78,906、reasoning 10,633、cache-read 8,636,416、cache-write 0），本地cost_usd合计0——只是本地字段，不是账单或免费。provider audit 205个流式请求：204个HTTP200；第205个是上述Mission回合，1790484104470创建activity、step-start后97ms被停机中止，无状态、无usage行，其提供方计费未知（可能计入prompt tokens），如实保留为unknown。provider_activity_request 202行（按assistant message归属，与审计计数口径不同）。旧初始化publisher 25072为0请求，不重复累计。

### 机制判断与主管排序

- 不能把这次正确数值称为可靠：独立审计这一“反证通道”被终稿完全绕过，且宿主允许以包的正式类型发布；若审计给出反证，同一路径同样会被忽略。按“目标→原始事实→独立判断→返工/复核/结算”排序，最早可改变的真正责任层依次为：
  - **D1 宿主事实（原始事实层）**：`artifact_search`在`sources`过滤时把被裁剪子集称为`catalog_complete`并给出无匹配诊断，没有披露被排除来源中存在请求的类型；七个worker中六个首次被误导。属于宿主的目录事实准确性，修正不含语义判断或隐藏答案。
  - **D5 模型可见错误（事实层）**：共享`ArtifactInspectionError`消息只写“failed with N diagnostics”，具体期望/实际丢失；这正是既有“模型面错误必须给expected/received”规则的违反，直接导致report-writer无法修正来源形状。
  - **D2 宿主类型权威（复核/结算层）**：通用`artifact_publish`只保护`evolution-lab/`；另外9个内置包（commercial-legal、data-analysis、hr-operations、marketing-growth、omnichannel-distribution、sales-strategy、seo-geo、tax-compliance、viral-content）各有类型化发布器，但其ABI类型可被通用发布绕过。需要包对其类型化类型的显式、宿主可读声明，而不是按名称/输入形状猜。
  - **D3 包合同**：生成模板的终点writer提示只列直接依赖（data-analysis只写audit），而其发布器要求完整六前驱；hr-operations、sales-strategy同模板。属于包文本缺陷，是后续登记进化Campaign的自然候选，不在宿主层手改冒充收益。
  - **D4 语义接受**：orchestrator接受自相矛盾的终稿，是Agent判断，不加宿主业务gate；D2完成后该终稿本不可能以正式类型发布。
  - runner：diagnostic controller结算条件须等待Mission会话完成其对终态的回合，再结算。
- 本轮先实施D5、D1与runner结算修复（证据最直接、改动局部、可真实checker复现），再以显式声明实施D2；D3留作独立登记的进化候选，D4不做宿主gate。修复后是否再运行一次诊断，须另行完整预登记单一改变，不以本次正确数值或局部测试宣称业务可靠纠错或进化收益。

### Codex额度接手：D1/D5影响面复核与收敛方案

- Opus于13:03:59上海真实exit1/91turns/api_error，原session limit重置17:40；原launch/exit/stream和未提交diff保留于g61-opus-quota-review.json/g61-opus-interrupted.patch。CLI累计估算133.720985、增23.7787598，非账单或业务费。Codex按已有授权接手，17:45或以后交回同会话；原业务诊断已结束且不重启。
- D1原始直接根因再定位：生产ArtifactSearchTransportPageSchema为压缩输出移除了applied_filters和facets，模型只见完整标志、计数与resolution，缺少与这些事实紧邻的实际来源/版本范围。因此完整标志只对请求子集成立，却容易被读成全Task。Opus初版为诊断去读取excluded providers，失败时静默用空集，且未以同一snapshotSequenceUpper冻结排除来源；这是扩大读取并引入另一个完整性语义，不能将其局部2/24通过当最终方案。
- 收敛为唯一已有请求事实：resolution显式携带scope.sources和scope.version_scope，所有计数/完整标志/unmatched仍只针对原请求与同一冻结membership；scope经实际Agent Tool运输保留。删除初版excluded读取，不查另一权限域/未请求provider，不凭排除来源读取失败断言全Task不存在。原filters、cursor、provider error和权限合同不变；未匹配本范围不证明其他来源缺失。Tool描述及02-data同步，公共schema/生成物按真实引用影响面处理，无默认历史回填或兼容双源。
- 聚焦红绿检查：真实50-entry分页在首尾之间追加未请求TaskArtifact，既有cursor的resolution保持同一scope/诊断；真实sources=task_artifact查询Engine前驱在model-facing Tool输出中明确给task_artifact范围和no_match，广搜仍返回真实Engine原件。不存在类型仍给本范围unmatched，provider损坏仍原incomplete_catalog。D5保持唯一ArtifactInspectionError消息携带实际expected/received，并进入真实Package Tool错误路径复核；不凭字符串测试称完整模型理解。
- runner/Mission收尾和D2正式类型权威是尚待完成的后续机制，不把当前scope改动当全部修复，不增业务样本。所有现存原工具/消息/用量/报告只读；先完成此有界当前改动的真实检查与范围交付，再继续后续项。

### Codex独立复核与D1/D5实际验收

- 原DB以SQLite只读连接backup到专用offline-reader目录；仅克隆元数据供生产reader初始化，未启动Server/InstanceBootstrap/Provider，原DB/消息/产物不写。`readTaskArtifactRef`及`readExactArtifact`验证原完整报告4581bytes和audit7998bytes的权限/精确版本/manifest/字节，原收据g61-codex-reader-receipt.json，完整派生文本g61-codex-verified-report.md/audit.json。Codex逐项读全文并用原arithmetic.py再算同一输入（g61-codex-arithmetic.json）：数值、分母、七月权重、非因果口径及小样本限制通过；报告声称没有audit的流程事实明确错误。因此将主管早先“业务验收通过”收窄为**数值部分通过**，完整交付不能称全部正确。原Task accepted与原分/字节不改。
- 新真实红测g61-codex-scope-red-verified.log证明初版读取excluded snapshot使同一Engine-only冻结cursor的unmatched kinds在追加文件后改变；实际Agent Tool还缺少范围事实。最终唯一scope来源是原normalized request，model运输保留sources/version_scope，所有诊断只用同一stableCandidates，删除初版额外查询及其静默错误处理，不建立第二目录。保持原cursor/权限/错误语义；全仓发现此类型经TaskAPI、Panel和Package Host/Agent Tool消费，公共HTTP/SDK没有展开此response，原OpenAPI不含unmatched_filters，因此无生成响应变动。
- D5通过真实Node Package Tool进程检验：原DB持久化schema_version2前驱→真实artifact_search取得exact locator→原readTaskArtifact跨Host RPC完整读取→实际viral-content类型化发布器抛出并运输“Artifact inspection failed: schema_version must be 1; received 2”。它是明确本地fixture，证明真实错误链，非模型理解或外部行为。未修改包源码或发布身份。
- 最终41项296断言：scope cursor2/25（g61-codex-scope-final.log）；plugin26/194（g61-plugin-errors-test.log）；native process1/11与terminal/catalog/import12/66（g61-native-catalog-verified.log），各文件exit0。根类型8/8、docs342ops25通过。中间red.log第一次提取helper遗留project局部变量报ReferenceError，不算产品红测；修正后上述verified-red才是真反例。native-catalog-tests.log首轮把recordEngineArtifact返回ID错当row且误写两个测试文件名，原错误保留，改用真实Catalog locator及存在的文件后重跑通过，没有放宽生产校验。
- 本范围仅D1/D5和真实诊断结果归档。runner提前结束Mission及通用发布器正式类型绕过仍待修复，不能以41项绿称整体完成；下一轮继续原生Mission最终回合/请求/终态共同事实，按AGENTS横审共享路径并先落盘方案，不重启diagnostic-01或另开未登记模型。

## G62 — 运行器等待原Mission接受与最终回复（实施前）

### Recall、根因与影响面

- 从08b57d19已push/clean继续；用户授权Codex在17:45上海交回Opus前实质修复。G61 D1/D5不重做，diagnostic-01只读结束，无Provider、凭据、业务样本或委托。本轮继续benchmark-debug-template的真实检查流程，原实验不重跑。目标是保护Mission对真实交付的独立判断与结算，不以Task completed或正确算术代替完整复核。
- 原日志已证Server.stop取消最后Mission回复。直接触发是evolution-diagnostic只检查活动投影inactive与一个Task completed；expert-squad-evolution-e2e也有inactive/allTasksTerminal分支。Task终态可能先于生命周期消息交付、Mission读取和判断；多次空轮询或增加等待秒数均不能证明完成。两入口共享错误的消费合同，不需要改Session/Task生命周期或增加完成ledger。
- 已读AGENTS、Recall/五段图/G60–G61、02-data/task-control-plane、Mission routes/projection/board/completion/session/execution-closure/process-recovery、Session状态及ProtocolStore occurrence读取、duplex检查与真实存储测试、两个运行器/cleanup、AutomationBench终结与scheduler settlement。全仓搜索inactive、allTasksTerminal、Server.stop、missionRecord与finalEvidence调用。Mission /status只是活动事实；唯一接受/blocked权威是missionRecord.outcome，原board校验Tool输入/收据、完整read refs和当前Task终态发生。不存在GET单Mission路由，使用已有按directory定位的原Mission读路径。
- 横审结论：Task正常/失败/取消与复开时旧terminal reference校验已有；Mission接受/blocked和新operator输入、Session retry/streaming/idle/terminal/error/aborted分别有原事实。恢复路径读取持久化occurrence及未完成assistant，不可用进程内idle冒充恢复后完成。duplex原检查已要求接受Tool所在input occurrence、完成后的finish=stop回复、所有同parent回复completed及原执行终结；AutomationBench另有完整transcript/outcome、scheduler drain与quiescence检查，单独inactive函数只用于等待期分类，不是直接成功出口。本轮不改其样本或调度合同。多项目按原directory/Mission/session身份定位，消息与事件只读同Session；并行其他Mission的idle/完成不能用于本Mission。

### 单一方案与正向Checker

- 从duplex辅助抽出唯一通用最终回复判定及原ProtocolStore occurrence读取；保留duplex特有nonce、交付、Tool和费用验收。新共享只读观察器用原Mission投影、真实Message与事件在同一读取事务派生pending/accepted/blocked/failed，不写第二完成事实。接受收据尚未出现、Tool已返回但最终回复仍streaming、同输入有未完成assistant均为pending；原error/aborted为failed。若接受后已有新输入，亦须其原回复/occurrence完成，防止旧收据遮住已入队的后续回合；未来未发生定时输入不是本轮已执行事实。
- 两运行器只在该原接受及回复结算成立时进入原产物验收/cleanup；blocked/失败输出明确错误，原Task失败/交互/真实无活动停止合同不变。不增总时长、轮次、金额预算，不注入消息、补写接受或替模型判断。当前诊断原receipt/输入/分数保持。
- 真实Checker扩展现有本地DB→Task terminal→完整read ref→真实panel_complete_mission Tool链：Task已completed但无Mission接受给pending；Tool收据已落账且回复未完仍pending；真实最终stop和精确执行终结后accepted；后续输入pending、终态复开旧收据失效。通用原判定继续验证retry/error/aborted、错误发生及同Session隔离；真实读取持久化event覆盖进程状态释放后恢复读取。测试driver显式构造合法参与者事实，不冒称模型自主行为。聚焦测试、脚本类型、根类型/docs及实际prepush后范围提交/pull merge/outgoing/push。
- 影响限于本地运行器/共享检查器/测试和文档，无HTTP、SDK、DDL、包源码/嵌入或UI变化。D2正式类型权威仍后续实施，整体可靠业务纠错/真实进化收益未达成。

### 实施、原件复核与验收

- `script/mission-settlement.ts`提取原duplex最终回复谓词和精确ProtocolStore读取，原duplex复用且保留自身业务/费用检查。只读观察器按原directory/Mission/Session身份读取当前outcome，同一DB读取事务投影接受所在occurrence及最新真实输入的回复；批量输入用原Message.acceptedInputMessageIDs定位其真实parent，不从时间猜因果。没有Instance初始化、Server、消息/状态写入。两运行器使用此观察器；旧evolution入口接受后产物检查失败明确抛出，不再吞错等待。没有改模型、样本数或源包，旧入口没有执行。
- 真实Task/DB/Panel Tool Checker中，原inactive+Task completed条件已经成立而观察器为pending；真实panel_complete_mission落收据后仍pending；实际Message stop及原SessionStatus→message protocol bridge→ProtocolStore终结后accepted。随后本地owner释放仍可从持久化事实读到accepted；新已入队delay消息使latestReply pending。真实block_mission也只在最后回复完后给blocked，Instance释放再读保持，Task新终态使旧outcome失效回pending。错误Session给确切identity mismatch；纯合同补齐retry/coordinated pending、error/aborted failed、另一Session未完消息与本occurrence隔离。它们是合法本地test-driver，不是完整跨进程重启或模型自主验收。
- 首轮`g62-initial-tests.log`中真实Panel测试6pass/1fail：测试只调SessionStatus，未装生产事件桥，内存idle但原事件缺失，观察器正确保持pending。接入唯一原bridge后通过，未放宽持久化条件。`g62-script-types-initial.log`还发现旧duplex的completion类型已改outcome、旧evolution空数组推断never及闭包selection收窄丢失；按当前真实类型作最小修正，无兼容实现。初版及中间日志均保留，不当最终计数。
- 对G61只读备份的原诊断元数据，用新观察器直接复核（不启动Instance/Server/Provider、不写原DB）：`g62-original-settlement.json`返回failed，Mission原outcome缺失，最新回复明确failed。原assistant `msg_g0VWOOpJF00cB902q5hu`的parent正是`msg_h236mNcpKemb0MsHRVfD`；原MessageAbortedError携带Server.stop/process.shutdown/session-wake-loop。后者是输入Message，不误称assistant。原execution_settled、Task accepted、报告、账本均不改；这个只读结论不是新样本。首次带tsconfig-override的Bun退出0但尾部有内部directory warning，改正常自动解析调用后`g62-original-settlement-verified.log`干净exit0，同一观察结果。
- 最终18项130断言：terminal authority7/59、blocked1/12、duplex8/38在`g62-settlement-verified.log`全部exit0；真实入口prepare2/21在`g62-focused-final.log`第四文件exit0（其前三文件是前一相同合同运行，不重复加总）。prepare只验证独立source Host/原包/输入/cleanup，无Provider。脚本包含三个入口和共享helper的专项类型通过`g62-script-types-verified.log`；根类型8/8（7cached）与docs342ops25通过，原日志`g62-root-types.log`/`g62-docs.log`。本次没有新业务费用。
- 下一项仍是G61 D2：先核对全部包类型化发布器、通用publisher与包manifest/安装/实际Host投影的唯一类型权威，显式声明正式类型后按当前caller身份执行完整性合同；不能靠包名前缀、关键词或业务结果造gate。D3 writer前驱文本属于后续独立干预候选，不能并入Host改动冒称进化收益。17:45或以后按原授权交回准确Opus。

## G63 — 包显式正式类型与当前发布工具权威（实施前）

### Recall、根因与影响面

- 起始df8ef2d0/main=origin/main/clean；按用户额度期间授权继续D2，17:45上海交回原Opus。已读AGENTS/Recall/五段图/G61–G62、02-data、SDK manifest-v2/authoring、registry immutable snapshot/load/projection、runtime binding/Task Tool scope、generic Artifact Tool、Plugin Host、唯一publishExpertArtifact和真实包测试；沿全部engineArtifacts.publish/作用域/包安装/公共类型调用搜索。无委托/Provider/旧诊断恢复，D3提示词不并入本干预。
- 原自然反例无需重抽：data-analysis/report通过通用Tool仅引用输入发布，而真实typed publisher明确要求六前驱。直接原因是generic仅用从Evolution ABI推导的全局namespace名单拒绝；包manifest无显式正式类型→发布能力关系。另一个包Tool也可调用同一Host.publish，单改通用Tool仍留旁路。因此责任点是两个入口共用的canonical publisher，检查真实调用能力和绑定包声明，不做业务判断/来源语义替代。
- 现TaskToolExecutionScope已验证原Task/Session/Message/call/part、当前runtime contract、immutable package revision、worker descriptor及精确授权能力；但返回时丢掉当前package Tool原ref。provider展示名与canonical tool ref不同，不能从字符串前缀/哈希反推。由真实runtime binding保留packageToolRef（其他Tool明确null），中央publish只消费这一Host事实。包代码不能给RPC参数伪造该字段。

### 实施合同与边界

- 唯一SDK manifest新增可选artifact_publishers字典：精确artifact_type→已声明的本包Tool CapabilityRef；null保留Host-only正式类型，包/通用Tool均不能发布。验证类型属于本包namespace、ref为本包tool且确实投影，原registry继续验证其实际文件。没有独立类型注册表、第二ledger或keyword名单。10个已存在typed publisher包显式登记现有完整类型集；Lab promotion-receipt声明null，原Core安装receipt权威不改。
- publishExpertArtifact按scope的原packageDigest加载已有不可变包snapshot并核对namespace/id/version，精确查声明，只有当前packageToolRef等于声明ref才继续原字节/来源/幂等事务。通用和不同包Tool给包含expected/actual的ArtifactPublisherAuthorityError；自定义未声明类型继续原generic合同。移除旧全局namespace常量和generic入口前置检查，原真实owner/命名空间校验继续。
- 这是包版本上的显式合同。未声明的历史snapshot不会被新包声明追溯改写，其未声明类型仍只有原generic数据合同；不能宣称新类型权威保护旧版本或把历史Artifact补成typed。旧Lab按整个前缀拒绝的隐式全局政策被精确声明替换，当前所有正式Lab类型含Host receipt均登记；未知自定义类型不再仅因前缀一概拒绝。原已结束Task/安装包/分数不变，新源包提升版本并仅同步相应嵌入，不自动推广任何已有Task。该边界必须文档明示。
- 非调度改动：不改Task/Mission/Session/queue/retry/terminal机制；重放使用原immutable binding及同一出版身份，声明不从当前磁盘安装版本漂移。HTTP/DDL无新路由/字段；SDK manifest公开类型与文档需同步，生成响应若实际引用受影响按唯一生成器核对。无UI变动。

### 聚焦真实验收

- SDK正向schema检查实际声明、错误owner/kind/缺能力/外部类型及null保留。原包typed流水线用真实DB/Host验证现有正式输出和六前驱，补generic发布正式report的明确错误、未声明note成功、不同Tool错误及真正publisher正常；当前已解析包snapshot与包升级后固定旧revision分别验证，不改旧诊断。
- 至少一条进入原Package Node Capsule/真实运行绑定与Host RPC证明caller身份不是模型参数；单元/手工scope夹具只能证明本地合同。现所有TaskToolExecutionScope测试夹具按真实用途补明确Tool ref；需要包身份的旧fake digest夹具改用原loader真实snapshot，不放宽生产校验。生成包逐项核对声明覆盖、目标版本/身份；无外部费用。聚焦测试、类型/docs/diff、范围commit/pull merge审全部outgoing/prepush/push后交付，未证边界如实保留。

### 已发现的固定登记版本边界

- 新10包源/嵌入同步后，原diagnostic-01入口的prepare真实本地检查按原固定digest拒绝当前data-analysis新版本，`g63-registration-boundary-red.log`保留；这是正确的登记边界，不应改原targetDigest或放宽run。原G58目录/Task binding Checker使用当前实际包，仍1/14通过，不是重跑业务诊断。
- 本轮仅把已安装的实际target身份先写入初始化结果再执行原相等断言，使失败可审查；固定登记值和准入条件不变。过期prepare测试改为该精确mismatch错误/新实际身份/正常cleanup，并继续验证相同零业务初始化链的原件保留、排他continuation和业务边界错误。README明确新源码不满足旧登记，不将准备期失败改称业务样本或增加另一诊断。旧原result和最初包身份只读。

- 首轮Lab完整Host链105秒通过，但新中央检查每次调用完整包加载器，重复准备所有Skill/Tool bundle；其所需事实只有原snapshot manifest。改为registry共用同一snapshot目录/全包digest验证，再直接用原readPackageMetadata读取manifest；完整运行加载器也复用这个验证入口。无缓存、第二manifest解析器或略过包身份。该拆分只减少每次出版不需要的运行物化工作，仍须真实Host链复测，不能把时间差冒称业务收益。

### 实际结果与交付边界

- 当前正式声明共73类型（9个domain包64项，Lab9项），唯一Host-owned promotion-receipt为null。10个manifest与对应源嵌入同步；9包版本2026.09.27.1，Lab2026.09.27.20。g63-package-sync.log列出全部contentDigest，仅原生成器输出的10个目标块/行应用，其他包字节保持；已有base源/嵌入漂移未顺手修改。Lab contentDigest ee13ab8d61aa65102e2b754edb24463f6f1ea6665c2345d5df928177890f75d8，data-analysis contentDigest 51572e75216c1119d4dbff6724f860c6c69aeb7a5a516c12b87c3551b11955d4，后者实际安装packageDigest c96c5e687dc0fdf2ea4b81a4e3be427d6cfda85889ff09fe2091b229fc5a2fe0。没有推广已有Task或改原诊断包。
- 真正runtime绑定Checker通过原conversation authoring安装声明包、EngineService接受Task（原test hook持有调度）、实际scheduler projection/调用发生/Package Node Capsule/Host RPC。声明Tool出版正式report成功，另一个真实Tool收到expected/actual错误，Host-only类型明确拒绝，未声明note正常发布。明确是本地driver和scheduler package调用，不冒称真实worker模型或业务Campaign。data-analysis原DB/Host完整六前驱链正常；直接generic scope正式report给精确权威错误、typed路径缺六前驱给原错误、generic note仍成功。历史版本测试只用本地复制包的已捕获snapshot，证明当前源恢复新声明后，旧未声明revision仍按自己的合同读取，不冒称历史包已获得保证。
- 最终去重93项710断言：SDK38/85(g63-sdk-tests.log)；6个domain包18/237(g63-packages-tests.log前六文件)，data-analysis4/39与声明覆盖2/10及Lab9/205(g63-authority-final.log对应成功文件)；native1/5(g63-caller-final.log第一文件)；authority3/14、reference3/12、初始化版本边界2/23、Task terminal/import12/66(g63-publication-consumers-final.log所有文件exit0)；目录Task绑定1/14(g63-registration-boundary-red.log第二文件exit0)。重复运行不累加；名称含final/red的混合日志不能整体称绿。Lab最终大链79.88秒/全文件110.18秒，未改既有120秒窗口；不是外部成本或业务收益。
- SDK唯一生成器完成；g63-openapi-verified.json逐值核对只在validate-folder响应manifest增加artifact_publishers，其他JSON值相同。根类型8/8、专项脚本/新增测试类型、docs342ops25通过；g63-module-index.log验证1124模块/5700运行边/零SCC/4个clean imports。无DDL/新路由/UI或Provider。
- 中间错误全部保留：首次SDK dist未重建导致新manifest字段被旧parser拒绝，正常SDK生成/编译后解决；辅助脚本在.tmp误用workspace包导入改为真实相对源码路径；native driver先缺Provider step-start，后提前写assistant使原user文本不可变，现按原因果次序先用户文本→capability occurrence→step-start→Tool；没有放宽生产规则。旧包版本期待、测试误用不存在的plugin子路径与旧replace参数/locator宽类型均按当前契约修正。g63-authority-final.log的authority文件导入失败由最后消费者日志替代，不能混算。原业务诊断和用量不写。

## 用户纠偏 — 后续优先业务闭环

- 用户明确质疑“又开始钻研不重要的问题，抓小放大”。这项批评有证据支持：G63虽修的是原自然反例，但范围扩到10包/47余文件和大量局部检查；持续将机制修补当作主线，仍未给出可靠业务纠错或真实进化收益。当前把已经验证的G63范围收束提交，不再由潜在基础设施疑点自动派生下一轮源码任务。
- 主验收重新固定为：原始业务义务→真实可核验错误/反证→独立判断改变→同一Task实际修正→复核后的业务结果，以及固定输入/相同源和测量下基线与候选的可比收益。G60数值正确只证明一次普通交付；steward修正来源形状只证明局部协议纠正；G43–63本地检查不代替上述结果。
- 下一动作先用现有记录做简短整体证据复盘，只保留一个最大的未完成业务环节及能证伪它的最小验证。只有该验证真实执行路径遇到明确阻碍，才继续修基础设施。D3提示前驱冲突不自动升级为下一源码工单；不得为了找失败同义追抽，也不得把新增输入后的正常交付说成纠错。新模型验证仍须完整独立预登记，所有旧样本只读不恢复。必要准备自主推进，17:45或以后把本纠偏和实际事实优先交回原Opus。

## G64 — 先检验独立业务判断，不再扩大基础设施

### Recall、原事实与有界验证（实施前）

- 从a0ab6087已push/clean继续。用户最新纠偏优先；本轮不修生产源码、角色、Schema或包，不重跑diagnostic-01，不创建候选/Campaign，不将普通交付或局部合同当纠错。已读本记录Recall/五段图/G61–63、G58登记/原报告审查、当前Task控制面、原Task transcript/Completion Decision、data-analysis三个角色及workflow、orchestrator-core，使用既有benchmark skill但不循环抽样。无委托。
- 更精确的观察：原Task根Session容器ses_-zUTbl2Avzz0WRMDhOjn本身无消息，实际决策者由Completion Decision指向ses_-zUTbl1IWzzFNgwNlnTF。其read_agent_message Part prt_g0VWOMBG700ppi8iVvfI取得fact-checker原final（六项通过、零纠正、audit已发布）；最终artifact_read Part prt_g0VWOOdu800o7fug7V50真实输出完整Engine report8498bytes和Markdown4581bytes、complete=true，含“没有audit”陈述。随后同assistant msg_hEP8ABfoO9mg5TY1esSR的manage_task Part prt_g0VWOOksI00n45yVSYyb仍complete，summary引用六项通过且解释generic publisher绕过，原evidence同时列report rev42及audit rev37。不能把它仅归为未读取终稿；Tool结果投影不证明模型如何注意/理解，也不单独证明这些bytes在最终Provider请求未被上下文裁剪。
- 原audit完整payload明确审的是insight-brief rev33；它先于report rev42，不能为后者新增陈述背书。数值仍正确。最大缺口收敛为“反证能否改变独立接受判断”，不是再加类型/读取门。Core已有原义务、矛盾解决和同Task返工要求，当前没有证据支持重复追加同义prompt。包once措辞/D3继续作为背景，不自动改它们。
- 最小诊断是一个全新、独立、只读的普通Chat复核（review-01），输入仅原公开请求/metrics、生产reader已核验的原report/audit及其精确出处；不携带operator答案、错误位置、旧Completion摘要或本分析。明确这些是旧已结束交付的只读资料；不重新生成业务交付、恢复原Task、变更原分或替补样本。使用现有global/chat/start原参与者，不新增角色。唯一研究变量是把完整评审材料在一个新的可见请求中集中呈现；历史原Task与它不构成受控A/B收益比较。
- 预测：若独立Luna自行识别真实不一致且区分早先简报审查与最终报告，说明集中上下文下可完成这个语义判断，可据此再设计同Task反馈验证；若漏判，记录该失败，不换模型/添答案/继续追问或重抽。即使通过也不声称原Task已修、因果改善、可靠返工或进化收益。单次能力诊断只排除一个解释，不以它外推可靠率。
- 登记、输入原件与运行边界见specs/artifacts/2026-09-27-supervision-review/README.md。运输只复用现有source Server、paired stage、native audit、global Chat和原Session消息/用量；300秒真实无活动/poll2、全成本、无用户未设总时长/轮次/费用上限。启动前提交完整登记及运输文件、原输入完整性检查和无凭据本地prepare；实际launch固定最终source commit后再唯一preflight与唯一复核。缺少launch仍未运行。17:45交回规则不变。

### 唯一复核的实际结果

- 登记与运输e37b622f/3add75a7范围push完成，g64-registration-push.log原完整prepush通过；生产源码/角色/包未改。实际2026-09-27 14:53:44.72309上海bun PID19956启动，source3add75a7711f0285b3066fea804e5b8fb06804c8，原exec68797取回exit0；14:54:28.346结算。唯一根.tmp/supervision-review-g64/review-01，日志g64-review-01.log。preflight ses_hVuEzN27depeuDQsmi9f实际credential usable/catalog projected/gpt-5.6-luna/streaming；review ses_hL5Ij8Y60PqJJN7d2gR6/input msg_h2hFzM8Rce6W5BH2Po9G，原final msg_g0VWOw80u00nzi3AGdGw，持久化final-reply settled。全部证据已归档review-01.md/receipt及assessment，未改原result里的not_evaluated。
- 语义结果是**部分证据，不是全部通过**：Luna自行指出终稿“没有audit”与原audit/rev37矛盾，认为not fully supported as written，保留正确数字、非因果和建议。但它没有明确区分审查対象是早先brief而非最终报告；建议改成report was assessed against supplied audit record，若作为原writer行为陈述仍缺事实支持，不能替它润色后说通过。原conditionally accepted标签保留，operator完整注册结论未通过。
- 这证明一次集中证据下的发现能力，不证明历史错因就是上下文丢失，不构成历史/当前因果A/B，也没有同Task返工、可靠率或进化收益。既有Chat及memory helper共4次真实流式gpt-5.6-luna/HTTP200，4原native用量：input66116/output1892/reasoning839/cache_read0/total68847，local priced cost0非免费/账单。无业务Task（原DB count0）/Tool调用/作者/候选/Campaign。实际runtimeDisposed/credentialsRemoved true，auth/models已删除。原visible User Message逐字等于登记packet；不冒称存有全部Provider serialized request。
- 输入准备先误将pretty-printed审查导出字节与原compact身份相比而失败，最终从原DB只读提取并匹配原sha、与生产reader结果逐值一致。派生provenance JSON的自算hash/换行门已删除，仅4份原不可变输入身份参与检查。无凭据prepare03成功、usage0/cleanup true，专项类型和docs通过。prepare即时关服出现scheduler disposing取消日志及Bun显式tsconfig override尾部directory warning保留，没有据此扩基础设施工单；真实review无中断，全部请求/用量完整落账。
- 下一唯一业务边界仍是反证改变接受决定→同一Task真实返工→按原义务复核。先形成能合法观察该转换的独立完整登记；新增草稿编辑/新增输入后正常交付不算该转换，若自然没有错误则标未触发而不补样本。不得重开review-01/diagnostic-01，不自动改D3或堆一轮机制测试。用户纠偏、此部分结果和未满足目标优先交给17:45恢复的Opus。

## 用户再次纠偏：先用Codex与ZCode校准团队调度

用户明确质疑“搞了这几天……闭门造车，比如codex和zcode是怎么处理agent team调度的？够你反思吗？”本轮先做外部一手资料对照，不新增生产实现或模型调用。ZCode暂按Z.ai官方zai-org/ZCode；已异步询问项目身份，未收到更正。Codex本机npm包只有启动器/二进制，不能据此声称读过其Rust调度实现；下述Codex事实来自已实际打开的官方产品与API文档，API与本机产品的实现不混为一谈。ZCode源码按2026-09-24提交29628c9acdb81b703bbd4080c207a0e7ce5e276e只读取得，未安装/启动其程序。

| 参照 | 已核对机制 | 对当前工作的约束 |
| --- | --- | --- |
| [Codex子agent文档](https://learn.chatgpt.com/docs/agent-configuration/subagents) | 主agent管理目标/决策/最终结果；独立上下文处理有界工作，摘要回传；支持创建、跟进、等待和结束。文档专门提醒长主上下文被中间日志淹没会降低可靠性。 | 不能把每轮几十项机制历史继续塞进主指令，再让历史缺口自动生成新工作。主线程必须保留当前目标、一个阻碍和下一决定。 |
| [OpenAI Responses多agent契约](https://developers.openai.com/api/docs/guides/responses-multi-agent) | 模型通过spawn_agent/send_message/followup_task/wait_agent/interrupt_agent/list_agents协调；运行时处理并发和传递。官方另明确独立工作适合并行，强依赖/共享可变写入需谨慎。 | 先用创建、通信、等待、继续原上下文、返回结果这几个语义解释当前Task/worker链；再论证额外正式产物协议的必要性。该API说明不是本机CLI源码验收。 |
| [ZCode普通子agent](https://zcode.z.ai/cn/docs/subagents) | 主agent选择独立上下文和前后台；前台等结果、后台完成通知主对话。源码SubagentPort明确launch/run/start/wait/stop/sendMessage，消息有queued/steered/resumed_background状态；原runtime command queue接收子agent结果。 | 活动中指导、已结束后继续、结果回传是协作基础，不能用一次性固定节点完成替代闭环。 |
| [ZCode动态工作流合同](https://github.com/zai-org/ZCode/blob/29628c9acdb81b703bbd4080c207a0e7ce5e276e/apps/zcode-cli/packages/bundled-skills/skills/dynamic-workflows/SKILL.md)及[实际ask调度器](https://github.com/zai-org/ZCode/blob/29628c9acdb81b703bbd4080c207a0e7ce5e276e/apps/zcode-cli/packages/dynamic-workflow/src/engine/scheduler.ts) | 普通Agent与显式CreateWorkflow分开；脚本里agent().ask<T>、并行分支和结果条件表达控制。每actor按FIFO接续，跨actor受并发上限；planner/reviewer循环保留上下文并把具体feedback带回，最后需要时另用新上下文检查最终稿。检查按错误影响安排，避免多层重复审查。 | 反馈闭环应是实际执行路径；独立性来自上下文与证据，不来自角色名/审核状态。正式Artifact发布成功与业务结论成立分开。 |

**不作错误外推。** ZCode也有类型编译、journal、恢复和完整并发调度器；不能将此次反思简化为“成熟系统没有状态机/越少代码越好”。它的subagent-messages实现有model-only synthetic user notice，动态workflow示例有round cap；这些不符合本项目真实可见参与者及不得自设预算的约束，不照搬。上述是文档/源码机制调查，不是两个外部产品已跑通本业务案例的实测结论。

**具体纠偏。** G64另开Chat只验证聚焦材料下的一次判断，仍没有测试团队把反证送回原执行者并完成修正；把主目标拆成容易通过的局部问题，是此前方法偏差的一部分。停止继续同形微实验。下一动作先把当前一个真实团队链路映射到“派单→结果→异议→继续原执行者→新结果→独立复核”，明确已有可复用能力、阻碍反馈的冲突和仅属审计/业务产物的额外要求，再决定最小必要改动。无证据支持的新增协议、角色、运行器或整仓重写均不开始；不以此次对照为由粗暴删除已有完整性/权限保护。把外部参照及用户纠偏置于后续自动任务与Opus交接最前，停止由旧待办清单驱动扩大范围。

### 当前团队路径映射：已有原语与真正缺口

Recall：从8abcb06f已push/clean继续，只读当前data-analysis团队及原G60/G64证据，不启动模型、不重做测试、不改生产实现。已查dispatch schema/adapter/continuation renderer、Task结果读取与coordination、fact-check adapter及其目标绑定、Mission resume、选定包scheduler/workflow/publisher，并定位已有streamed-dispatch检查；引用旧实际运行只用于证据，不重启。

| 协作步骤 | 当前可复用实现 | 证据与边界 |
| --- | --- | --- |
| 派单 | `orchestrator/dispatch-agent-tool.ts`的initial Turn和单个/批量dispatch；`orchestrator/tools.ts`提交原Session/lineage | 首次逻辑节点与后续物理Turn分开；原G60七节点实际执行。无须另建spawn API。 |
| 结果回传 | 原dispatch settlement及`read_agent_message`；原Artifact reader提供独立持久产物 | 原G60调度者实际收到fact-checker final，完整读到报告正文。返回/可读不自动等于接受，不能再归咎于完全没收到结果。 |
| 异议/指导 | worker的`request_orchestrator_decision`，scheduler的`respond_agent_coordination`；已知证据也可直接形成continuation guidance | 原steward确有coordinated与真实后续派单；它是来源获取/发布合同纠正，不是终稿业务返工证明。 |
| 原执行者继续 | `turn.kind=continuation`引用当前prior_dispatch或coordination_action，带guidance/evidence_locators；完整turn.input可更新本轮结构化目标 | `tools.ts`验证当前dispatch后复用existingSessionID、原workflow_occurrence_id及目录；`dispatch-turn-projection.ts`将实际增量和证据呈现给原worker。已有能力对应follow-up/steering，不应再造队列或会话。 |
| 重新判断当前结果 | `fact-check-tool.ts`/`fact-check/index.ts`接收确切target Session/Message与内容身份，复用已有审查Session；核心验收指令要求解决实质矛盾 | 可通过continuation的完整input把目标改为新writer Message；旧目标结论不自动获得新目标身份。该能力的代码/现有检查不是新业务闭环已成功的证据。 |
| Task已终态后的同Task返工 | `panel.ts`的resume_task与原Mission acceptance gap/ledger/receipt | 与活动worker continuation是两条不同层级的已有入口，仍指向原Task。原G60 Mission复核被取消，未观察到这条业务反馈链；所有旧run禁止再恢复。 |

**当前真正需要澄清的是两种“审核”的作用域。** 包正式`data-analysis/audit`的唯一前驱是insight-brief，属于分析简报阶段的业务产物；Core FactCheckReview是一次针对确切Message的审查判断。二者用途不同，不得把简报audit的六项通过继承成后来report所有新增陈述的保证。原G60正是在终稿加入false audit-availability陈述后，scheduler仍用早先六项通过作完成说明。G64仅证一次集中上下文能识别该矛盾，未说明历史漏判的完整原因。

当前包scheduler的“Dispatch every node exactly once”、workflow Skill的“Every node runs once”和fact-checker的固定“single synthesized insight brief”措辞，与现有多Turn/可更新target能力存在解释冲突。它们是当前可观察的指令合同问题；原steward在这些措辞下仍成功续行，所以不能称它们已被证明是硬性运行阻断或历史最终漏判的唯一原因。固定publisher前驱维护的是这份阶段产物的来源合同，也不应被随意扩成通用最终稿review以消除表面冲突。

**保留/复用/简化决定：** 保留原Task/Session身份、权限、精确来源、租约/持久化和当前Turn校验；复用现有continuation、targeted FactCheckReview及必要时Mission同Task恢复。需要简化的是把“初始阶段产物链”和“其后的具体反馈/复核”混成一次性完整流程的指令解释，不能再加Host状态机来替模型做业务判断。新上下文与复用旧上下文各有用途，不能把沿用审查Session称为fresh-eyes验证，也不新增一个角色来装作独立。

**下一项有界决策：** 以data-analysis现有一条团队路径为单位，把初始发布、后续返工及当前交付对象的复核职责讲清；先确认这些职责能完全由现有入口表达。若需要改指令，范围只针对这项冲突，阶段Artifact原件与完整性合同保留，效果必须通过独立登记的整条团队反馈观察判断。D3来源发现措辞、更多角色、另一套runtime和另起Chat微实验不随之自动扩入。当前没有足够证据宣称需要新的调度底座，也没有证明业务纠错/进化已完成。

### 选定团队的初始与续行职责澄清（实施前）

- Recall：从c40e3e9c已push/clean继续；本轮只收敛上述已定位指令冲突，不以局部检查替代业务验证。外部参照强调同actor接收反馈与审查实际交付；当前Host已有对应入口。无委托/Provider/旧run恢复，不改变D3前驱发现方式、其他包、图拓扑、权限、Schema或生命周期。
- 已补核写入边界：BuildAgent.run接受existingSessionID，核对原Project/目录，每次run创建本轮merge_back工具实例；成功合并的single-flight结果属于该实例，后续run重新物化工具。mergeSafely返回原合并结果，不在该函数删除worker工作区。Artifact snapshot仍核对已持久化merge_back的确切primary_head。由此不能把“本轮merge后不再写”解释为原writer永久禁止后续返工；本轮不修改或扩大这些实现。本结论是代码边界核对，不是新模型已完成第二次合并。
- 事实审查adapter的本轮collector以target Session/Message/内容身份绑定Core FactCheckReview；它允许existingSessionID与完整新turn.input。包data-analysis/audit仍只审insight-brief，两种产物的语义不得混合。为复核后来report，无须改该包audit前驱或重算历史audit，应对当前writer Message形成已有Core Review。
- 最小改动：仅data-analysis已有scheduler、workflow说明、fact-checker、writer及对应简短角色描述/README。把once限于initial dispatch；对后续实质异议复用continuation，改变审查对象时必须显式完整turn.input；将brief阶段audit与对当前报告的Core Review分开；writer的每次交付Turn仍遵守write→commit/merge→读取原确切提交→publish，本轮merge后只读，但合法后续Turn可按反馈修正。保留原角色/工具/DAG/typed publication，不新增自动业务gate、不把每份产物套重复review。
- 验收只检查实际包加载/安装→scheduler/worker promptOverlay运输和既有真实DB/Host阶段产物链，明确只能证明配置合同与原接口相容。仅该包增版本并同步其嵌入，其他包及历史绑定不变；不冒称模型理解、业务返工成功或候选收益。完整团队反馈效果留给独立完整预登记，不能重启旧diagnostic或review。按实际影响面跑聚焦检查/docs/types及范围commit/pull merge/outgoing/push。

### 选定团队职责澄清的实际交付

- 仅上述data-analysis范围实施：初始七节点图保留，后续反馈明确复用原节点；完整新turn.input选择当前writer Message，Core FactCheckReview与原brief阶段audit分开；writer按每个交付Turn重新完成合并及精确提交发布。D3的audit-only前驱发现段未改，没有新增Host/运行器/角色/工具/接口或业务判断门。
- 源与嵌入版本2026.09.27.2，contentDigest `4d09ee442a8e915cebf66de9dad62d854e77816b27a9ca8134081406240bcaed`。原生成器输出到临时文件、进程退出后应用确切字节；仅data-analysis payload块与revision行变化，其余包字节及原base漂移保留。没有推广原Task或回填历史包绑定。
- 原data-analysis-package检查改为实际嵌入安装，核对安装身份与源包一致、实际scheduler和七worker的promptOverlay逐字来自该包；原真实DB/Host六前驱发布链继续通过。`team-feedback-package-tests.log`为4项48断言、0失败、文件exit0。它证明真实配置运输和接口相容，不证明模型理解或第二轮业务合并。`team-feedback-types.log`根类型8/8（7缓存），`team-feedback-docs.log`文档342操作/25组均exit0，diff检查通过。没有Provider请求或新业务样本。
- 下一验收只针对完整反馈链：在一个独立完整登记的新团队任务中，观察原义务、自然产生的实质错误/反证、针对当前交付的独立判断、反馈回到原执行者、实际修正与复核。若自然无错误，记为未触发；不制造失败、不另开Chat代替、不继续同义抽样。当前仍没有可靠业务纠错或进化收益证据；本次指令澄清不能当作历史漏判唯一原因或候选收益证明。

## 完整团队反馈观察：独立登记与入口准备（实施前）

- Recall：从1446e775已push/clean继续。目标只观察现有团队是否完成真实反证→原执行者修正→复核；使用已读benchmark skill的登记/证据方法，用户禁止重抽优先于其循环要求。旧diagnostic-01/review-01关闭。本轮无委托，不改生产调度/包指令，不把一次观察当可靠率或进化收益。
- 新业务输入选纽约市官方311公开行政记录，固定NYPD、Noise - Residential、2025年7/8月创建的请求，按创建月/关闭月/borough/下载时status汇总。2026-09-27T07:41:30Z一次读取24组、3394原始bytes，只有公开计数和类别，没有地址/个人信息。保留全部查询结果，不筛选能诱发模型错误的组；与旧人工两层组成效应题不同。公开元数据只定义created/closed/status，关闭不是现实问题解决或人员绩效证明。原下载和查询保留，模型只收到原事实/任务，不收到operator答案。
- 当前真实阻碍仅运输配置：evolution-diagnostic.ts把旧根、旧输入和旧包身份写死；当前新包会精确身份失败。它已具备单Mission/单Task、原settlement、流式预检、native用量、初始化恢复及cleanup。全仓调用只有该CLI、entry检查和初始化helper，不需要复制第二运行器。修改为必填显式registration JSON，移出这些常量，旧G58登记单独保留；新运行复用同一入口。登记包含唯一根、输入位置、包身份、模型和原无活动/poll配置，claim/result保留原登记，初始化恢复核对同一完整登记，禁止换case借原receipt恢复。
- 影响面仅此离线CLI/初始化helper/entry检查与两份登记文件/文档索引。没有Host/HTTP/SDK/DDL/角色/运行时并发策略变更；生产生命周期横审不因纯运输参数搬迁重复展开。原相同Session continuation/目标重定向/二次交付按前节已有接口使用，业务正确性由自然团队与独立结果审查判断，不写自动业务gate。既有prepare检查更新为真实新登记安装成功，并保留明确旧版本错误与原零业务恢复合同。
- 运行及业务判定详见新artifact README。先无凭据prepare真实启动/安装/输入树/cleanup和聚焦检查、专项类型/docs，范围commit/pull merge/outgoing/push；再冻结实际source commit、包、输入、目录后唯一launch。无完整冻结收据不运行Provider。若自然没有实质错误，记未触发；若有错误，分别记录发现/反馈/实际修正/复核，不补样本或operator干预。17:45交回优先，运行中则冻结依赖交给原主管监督同一运行。

### 登记运输的本地验收

- 同一CLI现必填registration；原G58根/输入/包只移入其历史登记，业务根仍不可恢复。新登记完整保存在claim/result，初始化helper在创建continuation前逐值核对claim/result/调用登记，不允许换case。原settlement、真实活动期限、审计/用量和cleanup未变，未新增业务判断。新输入原查询24组全部逐值保留，operator算术仅在独立reference.py，不复制进Task。
- `team-feedback-entry-verified.log`真实entry/staging 2项29断言exit0；`team-feedback-entry-types.log`专项类型exit0，`team-feedback-registration-docs.log`342操作/25组通过。初轮entry最后错误只是把两个独立安装目录的完整target对象相比；改为原包id/version/packageDigest后原检查通过，未放宽生产校验。身份读取辅助脚本首次误用Bun --tsconfig命令失败，--tsconfig-override实际输出正确身份/exit0但有Bun内部directory warning；真正prepare无该参数，完整安装成功且无该warning，不把辅助读取当实际运行验收。
- 独立`.tmp/team-feedback-20260927/prepare-01`以真实source Host安装2026.09.27.2/packageDigest ecb3aa0e89e113336d2fa7e693834c14973e6d8b9d64df27d29a115f93ef704d，完整初态2e4cade92def04ceac7df7071e34fd56bf5f28647764ae204d23a9f3f2d651f4，仅四文件；零Session/Task/Provider活动/用量，exit0且cleanup完成。源OAuth只读取类型/到期元信息，当前尚有效且成对models存在；这不替代实际流式预检。此时仍未启动模型。

### 完整团队反馈观察的真实结算与独立结果

- 登记/运输a6ea550b已push后，唯一feedback-01于2026-09-27 15:52:23.349127上海启动，source/包/输入全程冻结。真实Luna流式预检通过，Mission b6fc7138760eba83创建唯一Task tsk_g00VWPBCxD00HpB2NIEq；17:05:17.438写execution_settled，launcher及exec4459均exit0、实际进程消失、cleanup完成且复制auth/models已删除。Mission接受Tool和最后reply已真实settled，原status快照仍running不等于未终结。本次没有旧runner提前取消Mission的问题。
- **完整业务反馈目标未通过，具体业务解释判为漏判。** 原资料/登记/独立assessment、两版原报告、生产reader收据和原Tool证据在`specs/artifacts/2026-09-27-team-feedback/`。原Task/Mission accepted与所有原分/bytes不改，不重启/补问/替补。
- 已验证的窄正例：writer自己发现Bronx舍入23.42%应23.41%，原coordination→scheduler response→同Session continuation→两次真实merge_back→重发布确实发生。生产reader完整核验rev39/rev47两份7200bytes原报告，唯一字节变化是该数字，19行显示算术全部吻合冻结源。0.01pp不改变排名或建议，不能接受模型自称material就把它当独立发现的重要错误，更不证明可靠率或进化收益。终稿目标未新增Core FactCheckReview，原clean只审brief；Mission确实随后读了完整终稿。
- 更重要的原生错误仍被接受：终稿称remaining“不显示后来是否关闭”，而原24组全部有closed_month，10个跨月组明确给出July117在August、August391在September的行政关闭记录。它不证明现实噪声解决、精确耗时或重开历史，但不能把已有关闭月份称为未知。该误述影响对508个remaining请求的业务解释。早期charter的过宽限制、segment的“No opening backlog or later closure”、brief/audit与writer相近措辞均保留；这是原观察到的传递关系，不冒称已证明内在思考或单一prompt因果。Mission原panel_read_task_artifact回执7200/7200 complete、truncated=false含该句，接受Tool仍通过，不能归为终稿未送达。
- 另有来源误判恢复：fact-checker最初带过滤查询却称brief缺失，原brief rev22已在；同Session协调续行后发audit rev34/Core review rev35。它是来源判断恢复，不替代业务纠错。performance/segment实际分别dispatch_agent串行，第二派单明确增加前一分析为输入；已读真实请求及及时accepted回执，未复现所请求并行batch在Host失效，也未审当时完整Provider工具定义，不能据此直接重写调度。
- 原audit315次流式准确gpt-5.6-luna/HTTP200；native usage312行全session/priced，input2622230/output117678/reasoning13663/cache_read18351104/total21104675，local cost0非免费/发票。Provider activity309逻辑请求全done，306单attempt、3双attempt，sum312。审计无逐请求ID/时间，尚不能完整逐次对账或给外部账单；不能凭计数差发明取消/收费原因。CLI费用与业务用量分开。
- 本轮只封存结果，不改生产实现/角色/原样本、不再开模型。原readonly辅助导出遇到Python默认cp1252及tuple-key JSON错误，改明确UTF-8/可序列化汇总后取得原事实；这不是产品运行失败。下一决定应围绕“独立判断是否挑战上游解释并尊重源字段”而非再补调度底座/类型协议；17:45优先将用户纠偏、真实窄修正及漏判原证据交回原Opus，任何新干预另行有据登记。

## G65（Opus恢复）：独立判断的证据标准——单一改变与登记（实施前）

### Recall与原件依据

- 2026-09-27 17:45后以准确claude-opus-5-5恢复同一主管会话，从2e0da6b6（=origin/main、clean）继续；无运行中业务。已读用户两次纠偏、Codex/ZCode对照、当前团队路径映射、data-analysis职责澄清与feedback-01独立结果/原件。G61–G64与团队反馈已交付项不重做；diagnostic-01、review-01、feedback-01全部只读关闭。无委托。
- 原义务：请求要求说明同月关闭测量“能与不能”说明什么、使用给定字段定义与时间分辨率，且“不支持时说明限制而非发明值”。把输入已有的字段说成未知，同样违反“使用给定字段”的义务。原字段：24组全部有`closed_month`；同月以外的10组正是July 117→2025-08、August 391→2025-09的行政关闭记录。
- 解释的传递（原件逐字可见，不推断模型内部）：charter的`unknowns`写“No historical backlog at 2025-07-01 or complete later closure view”，`source_policy`/`stopping_conditions`把later closure列为禁止推断、“unsupported claims remain limitations”；segment写“No opening backlog or later closure”；brief写“the extract cannot show later closure completeness”；audit写“later closure completeness … remain unsupported by the source”；终稿写remaining“does not show whether they subsequently closed”。七个角色提示都含同一句“Preserve explicit unknowns instead of inventing inputs”，上游声明的未知在下游作为应保留事实出现。
- 独立判断失效的精确形态：brief的Core FactCheckReview（evidence.json第35项）第3项已从metrics.json行算出July 117/August 391 remaining，反证在审查者自己的上下文里；第4项“limitations are factually supported”的三条证据却是brief自身、metrics.json里与此无关的`source_limits`文字、以及charter“explicitly prohibits inferring … later closure completeness”。它检验的是“是否符合charter禁令、各方是否一致”，不是“输入字段能否支持该限制”。包审查提示只说“trace claims to sources”，未界定sources；Core fact-check要求每项有具体指针，但不排除团队产物作证据。
- Mission另为判断点：runner请求把它设为“diagnostic执行者，preserve any failure”；它开头读过metrics.json，验收前读完整终稿与各worker“已审clean”的最终消息后接受。本次保持该请求不变作对照，不在同一次改变里叠加。
- 外部校准（只读ZCode `dynamic-workflows/SKILL.md` §2–§3，固定commit见上文）：持续复用的审查者会锚定于自己先前判断；fresh eyes四条中“Separate context”“Ask for failures, not approval… approving takes evidence and objecting is the easy move”“Give the eyes the same evidence（判断正确性必须读原始材料）”，并提醒相关审查者（同模型同提示）增益很小。对照当前data-analysis：同actor反馈续行已由feedback-01证实可用；缺的是审查者的证据集与问题形式——它把团队链条当证据、以批准为默认。initial fact-check Turn本身已是独立Session，因此无需新协议或新角色即可让它只看目标与原始材料。

### 单一改变与刻意不变

- 只改`data-analysis-fact-checker`：审查以原请求与Task输入文件为唯一证据；charter、dossier、分析、先前审查等团队产物及其范围限制/未知都是待检声明，不用来支持目标，团队一致不是独立证据；问法改为找出使目标出错之处——不能由输入行复现的数字、偏离给定定义/单位、未满足的请求义务、以及输入字段其实能回答的限制或未知；只有指向请求或输入的证据才可verified，查不到的为unresolved。审查者自身那句“Preserve explicit unknowns”改为“只有输入缺该值时未知才成立”。manifest中该角色描述同步“对照原请求与输入文件”，包版本2026.09.27.3，只同步data-analysis嵌入。
- 刻意不变：planner/steward/两分析/synthesizer/writer提示（含其“Preserve explicit unknowns”）、scheduler、workflow图、typed ABI、Host/Schema/SDK/调度、runner及Mission请求、冻结输入、模型与限制。目的在检验纠错而非预防：生产者不变，自然错误仍可能出现；若同时改生产者，一份正确终稿无法区分“被纠正”与“未发生”。
- 不是同义提醒：原文没有界定证据集，Core允许任意指针；本改变修改可接受证据与审查问题，原件可证伪（若审查仍以团队产物背书或放过输入可回答的限制即失败）。不是Host业务gate、新角色、新ledger或隐藏答案；审查者仍自行判断。

### 预测、证伪与登记

- 登记见`specs/artifacts/2026-09-27-review-evidence/README.md`与`registration.json`：同一冻结NYC 311输入、唯一新根、唯一Mission/Task、流式openai/gpt-5.6-luna、300秒真实无活动/poll2、无总时长/轮次/请求/金额上限、固定1次、不补样本。
- 预测：若团队再次在brief或终稿中声称输入不能显示同月以外请求后来是否/何时关闭，改后的审查以metrics.json行指出矛盾；调度者把具体反证送回同Task负责者；交付结果改为按记录的关闭月份描述（仍保留“关闭≠现实解决/精确时长/重开历史”等真实限制），并有针对改后结果的审查。证伪：审查仍verified此类限制或以团队产物为证据（漏判）；标出但交付未改（未执行）；改了但无后续审查或丢失已正确内容（未验证/失败）。若团队未产生此类或其他实质错误，记“未触发”，不重跑。
- 一次观察即使完整通过，也只证明该机制在此例可以闭环，不是可靠率、因果A/B或进化收益；把改变归因到“证据集”还是“问法”也不可分。

### 包与登记的本地验收

- 仅改审查者提示与角色描述，manifest 2026.09.27.3；原唯一生成器渲染到临时文件后替换，核对payload中data-analysis块以外字节与HEAD完全相同、revisions只改该行（contentDigest 4509dfea…）；生成器同时报告的base 2026.09.14.15→2026.09.27.1已知无关漂移未夹带。源包packageDigest 6bce55825c4dccde60f62bd6016e65a15b223052d89b17627454d3d6efc838a9。
- 聚焦检查`.tmp/g65-focused-tests.log`：data-analysis包4/48（实际嵌入安装身份=源包、scheduler与七worker promptOverlay逐字来自源、原DB/Host六前驱发布链）、diagnostic入口2/29（新登记真实prepare/恢复合同，旧G58登记精确身份错误）、发布权威3/14、typed schema 2/10、G58可达性1/14，共12项115断言、各文件exit0。根类型8/8（7缓存）、docs 342/25、内置专家团拓扑122/135、diff检查通过。这些只证明配置运输与接口相容，不证明模型会按新标准审查。
- 独立无凭据`.tmp/review-evidence-20260927/prepare-01`真实安装.3/6bce5582…，完整初态2e4cade92def04ceac7df7071e34fd56bf5f28647764ae204d23a9f3f2d651f4，与feedback-01逐字相同的四文件；runtime结算、无凭据。唯一业务launch须在本提交push后按登记执行。

### 唯一运行的真实结算与独立结果

- 14574871 push后于2026-09-27 18:09:42上海唯一启动（claim PID65504，source 14574871），流式预检ses_hv1cFSDEjIsQ5yCp1V5s实际gpt-5.6-luna/usable/projected；Mission 0159b4acbae66907创建唯一Task tsk_g00VWPjil300cs26sAmF。18:53:57调度者fail_task，runner按登记的“Task failed即停”规则中止Mission正在进行的一回合（其对失败的反应未能观察）、runtime结算并删除复制auth/models（已核），launcher exit1。原件不改、不重跑；完整结果`specs/artifacts/2026-09-27-review-evidence/assessment.md`及receipt/review/publisher/报告副本。
- **登记分类：漏判（2）。** 生产者不变时同类错误更强地复现：charter“August eventual closure is unknown”、dossier“Current extract cannot distinguish later closure, still open, unavailable closure”、performance与brief把“remaining后来是否关闭”列为unknown，已提交终稿写“A remaining request may later close, remain open, or lack a recorded closure”。终稿15行数值与operator参考一致。
- **证据集改变生效，但审查单位仍是生产者的叙述。** brief的Core审查rev28只打开brief本身，两项分析claim的证据指向metrics.json/request.md，不再引用charter；第一项发布事实仍指向brief本身——这部分行为确实变了；但它只登记了synthesizer最终叙述消息里的3条概括声明，“interpretation limits were reconciled”用metrics.json第27–39行source_limits文字背书，未逐项检验brief里的具体unknown；verdict clean，audit无required corrections。feedback-01的审查同样只有5条概括声明。结论：读对证据不足以纠错，被审的是生产者自述而不是交付内容；“找失败”的措辞没有改变审查单位。
- **交付失败于类型化发布器的参数形状（系统性执行路径缺陷）。** 原tool记录：本次六个阶段先失败后成功，writer三次均失败，共26失败/6成功，其中17次把`resource_set`/`source_artifact_locators`放进`artifact`对象；feedback-01为25失败/8成功（11次嵌套），G60记录23次发布器失败。提供给模型的schema本身正确（三字段顶层必填，`artifact`是15.5KB七个严格变体的union），拒绝信息也精确；writer两次失败、调度者按原错误给出修复续行后第三次仍同样嵌套，调度者如实fail_task。G63前该角色可经通用发布器绕过，G63后包类型只能走本包发布器，此形状陷阱变为致命。
- 用量：审计209次流式gpt-5.6-luna，208×HTTP200、1次无状态（停机时被中止的Mission回合，计费未知）；原生usage 208行全session/priced，input1617440/output90928/reasoning11951/cache_read9021696/total10742015，本地cost0非账单。
- 判断：这次证伪了“只改证据集即可”的预测，并暴露两个比措辞更大的阻碍：审查单位（叙述而非交付内容）与发布器参数形状（每角色、每次运行、已致命）。后者是验证路径上的明确阻碍，按用户纠偏可修；二者都需新的独立登记后再观察，不重跑本根。


## G66 — 额度后独立接手：只收敛已发生的发布参数障碍（实施前）

### Recall、证据与影响面

- 用户要求停止抓小放大，已有同Task续行与二次合并原语可用；目标仍是独立业务判断及真实修正。本轮不启动模型，不恢复任何旧run，不委托。Opus于2026-09-27 19:09:17.511上海真实exit1，原terminal api_error/131turns，额度原文`You've hit your session limit · resets 10:40pm (Asia/Shanghai)`；exec44309已收。CLI累计152.5812776、本轮18.8602926美元，仅CLI估算。22:45之后再单次恢复同session/准确模型。
- 已读AGENTS、本记录Recall/五段图/G65、G65登记/assessment/原result/launcher/原只读DB、包codec/publisher/schema投影和本地/native工具checker；用benchmark-debug-template技能做证据复核，用户禁止同义重抽优先于技能循环。当前HEAD af1b4181=origin/main；原修改完整保存`.tmp/g66-opus-interrupted.patch`，额度收据`.tmp/g66-opus-quota-review.json`。
- 现象与触发：原`tool_part_request`/`tool_part_outcome`三条writer请求prt_g0VWPsxsb00uUUJMQhd3、prt_g0VWPtA8M00bMkBw67or、prt_g0VWPuDge00eyaygEN04都只有顶层artifact，里面同时包含artifact_type/payload/resource_set/source_artifact_locators；冻结.3 schema只允许后两字段在外层，因此返回精确ZodError。模型在后续续行仍重复形状。源schema无错读/参数丢失证据；不能据此声称Host调度故障或新形状必使模型正确。
- 控制流：package Tool args→原生工具schema parse→包execute→exact predecessor read/select→Host engineArtifacts.publish。原严格union将正文与发布控制字段分为两层；旧修复是重试提示，未改变这个易混淆的接口。Opus未完成的placedOnce接受两种位置并用unknown/optional降级模型声明，违反单一契约。保留原patch后删除双路解析，不能提交为兼容方案。
- 全仓检索该schema只有本包publisher生产消费；显式调用为data-analysis-package测试，另外typed-publisher-provider-schema共用投影检查。所有七stage生产者共用该Tool；包README、嵌入payload/revisions、native执行checker和prepare登记身份需同步。旧已安装包及Task immutable binding不回填；其他九包有类似接口但本轮没有其业务反例，不扩范围。API/SDK/DDL/Host/runtime/调度/终态/权限未改，不适用调度横审；原Task按登记failed即停，Mission中止如实保留。
- G65独立核对：原result failed、launcher exit1、auth/models实际删除；原usage208行/10742015tokens/local cost0。精确Tool名原DB共32调用=26failed/6completed（原byType已为26/6，归档文案将成功数多计1，已修正）；最后三次错误已直接读原回执。Core review确有三项概括claim/clean，第一项引用brief发布事实，其余引用原输入；不能笼统称每条指针只在原输入。审查漏判的业务结论保留，不能把“必要”或单一prompt因果当已证结论。

### 唯一方案与验收

- 当前.4只改发布入口：唯一`artifact`对象含四个必填字段artifact_type/payload/resource_set/source_artifact_locators；资源为原nullable locator、来源为原locator数组，每个type仍绑定原严格payload。模型schema与实际parse共用定义；execute直接消费它，删除外层两个字段和placedOnce；原来源数量/类型/生产者/资源/发布权限不变。
- 审查单位提示新增段从本轮撤下；未提交review-unit草案原件保存到.tmp，登记未启动（原root不存在）。它不是完成登记或允许立即开新模型的成果，后续与主管从业务证据决定。现有.3审查标准保留，不与接口修复叠加。
- 正向checker复用原data-analysis真实Task/DB/Host七stage链，改为通过原生Node package capsule执行及introspection，核对新唯一schema、全部七产物与最终不可变资源，保留缺前驱明确错误和正式publisher身份错误；验证错typed locator的明确schema错误。原本地driver不冒充模型行为/业务效果。准备测试用隔离临时registration固定当前包身份，不为测试新建业务样本，旧登记身份错误仍明确。
- 运行聚焦checker、包类型/root类型/docs/必要生成与diff检查，范围commit，pull merge完整outgoing审查后push。失败日志保留。交付只说明当前契约及真实本地路径；新模型会否用对、业务独立复核/纠错与进化收益继续未知。


### G66本地交付与独立核对

- .4发布器现只有一个artifact输入对象，四字段均以原真实类型声明；删除双位置解析，所有七stage仍有原类型/payload关联和exact前驱、生产者、资源与Host authority检查。fact-checker prompt与HEAD逐字相同；未提交review-unit草案已完整存.tmp/g66-opus-review-unit-draft，原目录文件删除、索引撤回。没有新的业务登记/Provider调用或角色变更。
- 包contentDigest 9dd3786b85fc036d15463cc0f87453e9a5f161c36382726cb4e1ddcf1749265e，实际源与嵌入安装packageDigest 6dbc6fcbb2d8eaa7f6991cac4b8711a7e3127c5d0eb3a35e5325a43c8e4a2eb9。生成模块除data-analysis条目外逐字不变，revisions只变该行；base既有漂移不夹带。
- 聚焦验收g66-focused-final.log：包4项58断言（完整源/嵌入安装/七worker运输，真实DB/Host RPC→native Node package Tool→六前驱/最终不可变资源发布与回读），provider schema2项10断言，真实prepare/原初始化合同2项29断言；共8项97断言，各文件exit0。原生检查是本地driver，不是自主模型业务效果。根类型g66-types.log 8/8。
- 首次g66-focused-tests.log失败保留：原生完整发布链已通过，但Python默认写换行令lib源码CRLF与生成LF字节不一致，导致安装身份不同；修为原LF后真实源/安装身份相同。prepare test首轮把保留runRoot放到了workspace .tmp之外，改本地临时登记的保留路径满足既有入口，未放宽生产校验/更新历史登记。
- G65原数据库始终mode=ro，仅backup副本由production reader打开；g66-original-reader-receipt.json记录40个原catalog exact reads及原snapshot报告资源，6862bytes/SHA81957c03260d595ef653a4d55b389cd4114b03d6aef53d36c5c9791e0c379000，与已归档report逐字一致。原Core review三项、两项分析以inputs支持而第一项出版以brief支持；原工具表确为26failed/6completed/17内嵌层级错误，归档byType已正确，仅文案算错总数，现更正。既有漏判/Task failed结论、原件与分数不改。
- 本次仅确认接口合同和本地真实运输，不承诺新模型使用该形状的成功率；整体独立业务纠错及进化收益仍未达成。将这项必要接口修复收敛后交回原主管；不能以等待额度为由继续扩底座或立即抽同输入新样本。

## G67（Opus 22:50恢复）：未知声明沿用的候选解释与提示调整

> 23:03 起的退出后独立复核不接受“核心机制已找到并修复”的结论。修改前 `.3/.4` 审查提示已明确把团队未知视为待检声明、要求检查输入能够消除的未知并给出纠正；`unknowns` 字段也不限制模型否定其内容。原件证明漏判和错误沿用，不证明合同禁止否定未知。以下提示调整已提交，但其效果、必要性和核心因果均未获业务验证，不据此启动新的样本。

- Recall：从f4309419（=origin/main、clean）恢复；六类总方案已撤回，不作依据。只沿NYC 311真实失败链（feedback-01与G65 run-01）判断，旧运行只读、不重跑、无新Provider样本。
- **主管提出的解释及独立复核边界：** 生产者保留未知的文案可能促使上游错误被沿用；这仍是候选解释。
  1. 六个生产者提示含“Preserve explicit unknowns instead of inventing inputs”（hr-operations、sales-strategy同一模板各7处），但该句本身没有要求保留已被原输入推翻的声明。
  2. 修改前data-analysis审查提示已有“their scope limits and stated unknowns”都是团队主张、“limits or unknowns that the supplied fields actually resolve”以及“an unknown stands only where the input files lack the value”。因此“所有角色只防编造、无人负责否定未知”的说法不成立。
  3. 共享stage codec为七类产物提供`unknowns`字符串数组，并为audit提供`required_corrections`等字段；它保存声明，不判定声明真伪，也未禁止审查者否定未知。字段存在不能作为“只能累积”的控制流证据。
- **原件证据（只读backup，逐字）：** feedback-01：charter rev5“…complete later closure view”→segment rev18“No opening backlog or later closure”→**audit rev34自己的unknowns**“…later closure completeness… remain unsupported by the source”→report rev39/rev47 unknowns同句。run-01：charter rev6“August eventual closure is unknown”→dossier rev10→performance rev15→brief rev23“Whether remaining requests later closed, remained open, or lacked recording”→**audit rev27自己的unknowns**“Whether residual requests later closed, remained open, or lacked closure recording”→报告“A remaining request may later close, remain open, or lack a recorded closure”。输入24/24组都有`closed_month`。审查者没有判它、而是把它当作自己的未知转发。
- **对照的限制：** 两个“缺失”错误——G60 steward称charter不存在、feedback-01 fact-checker称brief缺失——涉及前驱存在性，可以由类型化发布器验证身份与完整性。业务声明真伪由模型负责；两类检查责任不同，不能由此推导业务内容缺少检查，或要求Host增加业务裁决。
- **区分三层：** 原件确定显示审查者没有完成已有明确职责；生产者文案如何影响此次漏判、为什么原审查规则未被执行，尚未定位。不能从“只改审查提示后仍失败”推出“必须改全部生产者”，也不能归因于audit的`unknowns`字段。被测业务断言的含义：说“同月关闭这个指标本身不显示后续关闭”是正确的指标限制；说“这份extract不能显示/不知道remaining后来是否关闭”与已有关闭月字段矛盾。
- **不解释的：** Cycle3、H-T/H-B的错误是正值/关系判断错误（如4×5000），不是未知陈述；G60终稿“没有audit”也是缺失陈述，但其接受者是调度者，本判断不外推为所有历史失败的单一原因。
- **已实施的提示调整（未确证的干预）：** 三个同模板包将保留未知的句子改为对称规则：不编造输入，也不把输入已显示的内容称为未知；从前驱继承的未知或限制是关于输入的主张，只在输入确实缺该值时保留。三个审查者（fact-checker）另加一句：目标陈述的每条未知/限制都是待核对的主张；audit自己的unknowns只写审查者自己无法核对的事项，不得照抄目标的未知。codec、Host、调度、图、角色、ABI不变；不加新gate/ledger/schema。相同模板证明了改动覆盖范围，不能证明三个包共享已定位的业务根因。
- **验证边界：** 本地只能证明配置文本被实际安装与投影，不能证明模型行为。尚无有区分力的因果依据支持再抽样；同时改变生产者与审查者，即使未来交付正确也不能单凭结果区分错误预防与独立纠错。本轮不启动新样本。

### G67实施与本地验证

- 21份提示（三包各7份：6个生产者含writer，以及1个fact-checker）调整了未知声明要求；三个fact-checker另加“目标的每条未知/限制是待核对主张，audit自己的unknowns只写无法核对的事项，不照抄目标”。data-analysis `2026.09.27.5`（contentDigest af4db610…，packageDigest 196e4f8d7a55a01783f00b4b46074dbaf17b2783b3856b43000c710988dfeb68）、hr-operations `2026.09.27.2`（d470d2fd…/20e40e4186b346751d7c8cbd14a9456a503272cf2ecb17e4e5e12c2ce7994ee7）、sales-strategy `2026.09.27.2`（7cb392c8…/6d02e25969c350582ed0a3f00069ccc3d2c8a90b65a1bb0d04afc297858554b8）。原唯一生成器渲染到临时文件后替换；核对payload中这三个块以外字节与HEAD相同、revisions只改这三行；生成器同时报告的base已知漂移未夹带。源文件无CRLF。codec/Host/调度/图/ABI/其他包未改。
- `.tmp/g67-focused-tests.log`：data-analysis 4/73（实际嵌入安装→scheduler与七worker promptOverlay逐字来自源包，且每个角色含对称规则、不含旧句，审查者含不得照抄；原DB/Host七阶段typed链与G66单一artifact参数合同）、hr-operations 4/51、sales-strategy 4/51（真实安装投影同样三条断言）、provider schema 2/10、diagnostic入口 2/29（真实`.5` prepare/恢复合同）、发布权威 3/14，共19项228断言、各文件exit0。根类型8/8、docs 342/25、内置拓扑122/135、diff检查通过。
- 这些只证明配置文本被实际安装和投影；不证明Luna会据此不产生或能否定错误未知，也不是可靠业务纠错或进化收益。上条历史日志包含违反仓库测试规范的负向文案断言，退出后独立复核删除它们，保留真实安装及当前提示的正向运输检查。

### G67退出后独立复核：Recall、影响面与收敛方案

- 用户要求定位核心问题，不接受将现象、候选解释或测试数量当成果。本轮独立复核读取AGENTS、本文Recall/最新记录、修改前审查提示、当前core及codec、主管真实Tool结果与提交差异；不开新业务样本，不恢复旧run，不自动再次启动主管。
- 23:00:55.656上海主管真实exit0，当前完整session命令行查询成功且结果为空；本次exit.json、最后terminal completed/is_error=false/26turns与exec27768 exit0一致。实际模型仅claude-opus-5-5。累计CLI估算160.615417美元，减基线152.5812776得8.0341394美元；不是账单或业务费用。
- 1ee4424026dceda0f69f1977041dcb69c776c1f8为真实已推送31文件提交，远端main已独立核对。g67-focused-tests与完整g67-push收据确实成功，不能据此接受主管最终答复或提交说明中的“因为只有防编造规则”这一因果断言。
- 本次明确修复范围仅为本文过度结论和三个包测试各一处`not.toContain`负向断言及其过度注释。保留正向提示投影检查与真实安装/发布链，运行这三个包的原checker及docs:check，再范围提交、pull merge、审完整outgoing、push。无生产提示、包版本、Host、schema、调度、凭据或原业务产物改动；不以本次记录更正宣称业务目标进展。核心根因和可靠纠错/进化收益仍未达成。
- 原checker重跑成功，见`.tmp/g67-independent-tests.log`：data-analysis 4项66断言、hr-operations与sales-strategy各4项44断言，均通过真实安装/投影与原产物链；docs:check通过（342 ops/25 groups），diff检查通过。结算收据`.tmp/g67-independent-settlement.json`保留三项退出证据与费用差额。未重复原业务运行或声称上述测试证明模型纠错。
