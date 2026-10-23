# 专家团真实端到端机制抽样

## Recall

- 用户要求：沿已授权能力自主发现、加载、执行的方向，抽取几个专家团，设计并实际运行端到端 case；发现机制问题后深入分析，形成合理方案再解决。
- 前序交付 `11ff4c56a` 已修 Explore、包准入、共享 Schema、用途发现和执行闭合。本轮扩大到不同真实专家团的完整职责链，不以单个工具成功或 Task 自述完成作为通过。
- 已读：AGENTS.md、benchmark-debug-template、前序 Recall 和证据、capability-search-runtime、17-code-work-agent-platform、包 manifest/Skill/调度与成员 prompt、package manager、真实 Provider audit、正式 Task HTTP 路由、前序隔离服务及完整进程结算脚本。全仓搜索生产 Task 创建/查询/会话/产物入口和待测包工具、工作流及角色。
- 当前工作区有 overlay 修改、07-panel 修改及视频/旧截图删除，均非本轮任务；保留全部既有更改，不创建分支/工作树，不委托独立 agent，不操作现用进程。产品内专家团成员是被测系统的正常执行者。
- 用户已授权本轮隔离真实 Provider 验收使用本机 OpenAI 凭据及完整 models 目录；继续限定本地能力验收，不作外部发布。新服务、项目、输入和产物全部隔离。凭据不进入 prompt、日志、spec、提交。

## 抽样与可执行验收

| Case | 原包及目的 | 受控输入 | 必须观察的输出与事实 |
| --- | --- | --- | --- |
| DA | data-analysis：结构化包工具、七阶段证据链、分支汇合与文件交付 | 两月四条经营记录与明确口径；收入300→420，增长40%；成本180→250；利润120→170；第二月A/B收入180/240 | 原包方法/流程真实读取；七类 typed Artifact、真实前驱读取/选择/发布；最终报告与匹配document@1；关键数字可从原CSV复算；Task正常完成 |
| MK | meeting-knowledge：并行取证/分类、汇合与独立审阅 | 带时间戳会议稿；明确确认、仅提议、拒绝认领及后续更正；仅本地内部交付 | 完整读取真实输入和共享方法；编辑者消费两个实际前驱；最终纪要/决策/行动/未决事项和独立复核；准确保留状态、矛盾及来源；Task正常完成 |
| RD | review-debug：读写角色、计划与独立因果调查、修复和原复现回归 | 独立小型Node.js项目：金额计算截断小数字符串；真实断言命令及明确正向结果 | 计划、静态审阅、因果证据、修复责任者改动产品；原命令输出正确金额；最终差异与实际命令可检查；独立角色复核；Task正常完成 |

- 使用三个原始包，不改manifest/prompt来强迫通过。请求给出目标、输入、口径和边界，不把精确工具调用序列写进host。沿正式`/task`创建、`/task/:id/conversation`/board收集真实事实；私有原始诊断保留，交付证据脱敏缩减。
- 实际`openai/gpt-6.1-sol`全流式。启动前分别确认凭据、完整模型目录和实际模型一致。三项目顺序创建Task，整服务最多180请求；超额明确列为检查器预算失败。每案例180秒无实际流/会话/工具/产物变化判停滞，不按启动时间判失败。自有进程监督90分钟仅为泄漏保护，不作功能验收时限。
- 按间隔读取紧凑进度，不持续监听日志；使用真实`/ui`人工截图复核，不运行或新增UI自动测试。后台checker与正向合同可自动执行。
- 每轮记录请求型号/状态/原reader结算、Task/Mission/Session轮次、成员、工具输入结果、精确产物和最终文件。人工二次复核关键数字、来源状态与实际修复输出。

## 问题调查与修复规则

- 尚未运行：是否存在新机制缺陷为未知。前序单成员调用与机会发布不能外推完整多成员、前驱传输和文件交付。
- 每个失败先区分检查器、环境、能力声明、上下文/工具定义、数据/控制流和调度终态。保留最初失败与原错误。不得用延长等待、伪造结果、外层路由或单包绕过代替修复。
- 若发现调度/队列/唤醒/恢复/并发/终态异常，立即横向覆盖全部生产入口、Task/Mission/Session occurrence、正常/终态、恢复/重试、串并行及多项目隔离；凭代码与持久运行事实排除共享根因后才收敛。
- 生产修改前补录症状、触发点、根因、旧路径未根治原因、定义/调用/历史决策、公共契约、数据/测试/文档/交付与风险；不适用项明确排除，未知标记未知。比较方案后实施单一实现，补聚焦正向合同并重跑原案例。
- 保留权限和不可逆操作确认；无新增凭据用途、外部通知/发布、数据库破坏性变更或现用服务操作。持久格式演进沿当前迁移合同。
- 完成后等待原流、进程、输出、请求结算，清理隔离auth/models并核对原源保持；更新记录/README，文档和聚焦检查、人工复核、提交、fetch/merge、核查待推送集合并正常push。

## 当前结果

- 三个原包真实案例、真实usage/predictive自动压缩、双项目四项OS恢复及关联共享修复已经独立实质裁定。原失败与每次检查器错误保留，最终边界、验证与交付状态见末尾记录；不以本段替代原始证据。

## Goal 与独立裁定

- 用户后续明确要求建立Goal、持续检查修复关联问题，并由独立子agent裁定。已建立active Goal；此前默认不委托由此新增明确授权覆盖。
- 独立裁定者`/root/independent_judge`，仅一层、禁止再委托；独立读取代码、契约及真实证据，可运行聚焦非UI后台检查；不改文件、不使用凭据、不操作服务或提交。先审修复方案与遗漏，待实际案例/重复验证证据齐备后独立裁定。
- 收敛定义：三个原包案例达到逐项输出契约；发现的同类生产入口完成检查与正向回归；修复案例和关联机制经重复真实运行未产生新的未解释缺陷；独立裁定者确认根因、实现、证据和边界成立。任一新问题重开分析、方案、修复和原案复验。不能把有限矩阵结论称为全系统绝对无缺陷。
- 既有隔离服务保持其原180请求上限，不事后提高；后续复验每个独立服务同样有明确原始预算并分别结算。服务预算失败与产品失败分别保留。

## DA首轮故障、横向分析与实施决定（生产修改前）

- 原Task `tsk_g00VYtrfwE00i76IXhYK`，原包`2026.10.14.1`。规划成员读取并选择CSV和口径快照，按planner的“exact selected semantic source locators”提交两个resource locator。真实native发布返回`data-analysis/analysis-charter requires 0 exact source Artifact locator(s)`，随后发出真实协调请求。调度器让同节点继续并以空数组发布章程，额外发生协调与重读；首个阶段工具契约失败保留，不能算无故障通过。基准在已证明的失败边界后通过正式cancel结束该原轮次，正常cancelled；不伪称产品自然失败或完成。原输入/工具事实已保存至私有`data-analysis-original-failure.json`。
- 直接触发：包输入`source_artifact_locators`声明宽泛ArtifactReadLocator，实际代码却要求固定数量、类型、生产者的Engine Artifact前驱。首阶段固定0，原始文件语义证据合法但无法放入该字段。控制流是模型遵循包prompt→宽Schema接受资源→native publisher错误。不是权限、凭据、Schema大小或调度唤醒故障。
- 根因：把“阶段前驱列表”和“输出完整语义来源”用同名字段混成一个公共契约。Host的`selectedArtifactLocators()`从同Turn真实完整读取/选择恢复最终envelope来源，自动保留已选择的原始资源；publisher参数实际上只用于检验固定typed前驱。旧测试全部以预组装typed前驱或空数组直接调用，覆盖了局部校验却没有自然语言请求下真实选择原始输入的路径。viral-content仅用文案解释排除快照，仍保留同名歧义和宽Schema。
- 全仓影响：七个相同精确计数发布器为data-analysis、viral-content、commercial-legal、hr-operations、tax-compliance、sales-strategy、omnichannel-distribution；marketing-growth和seo-geo也按完整类型集合要求精确Engine前驱，属于同一契约，共九包。Evolution的source字段还用于完整finding evidence及supersedes关系，不等同固定前驱，保留其真实语义。通用artifact_publish的source_read_refs和Engine envelope的source_artifact_locators继续表示完整语义来源，不改。
- 排除方案：放宽计数/跳过原始资源会混淆必要前驱与附加证据，削弱完整性；仅教模型传空数组继续保留工具声明和实际契约冲突；host路由改写输入属于绕过。决定在九包当前唯一输入中使用`predecessor_artifact_locators`，收窄为EngineArtifactLocator，并明确原始语义证据沿真实read/select进入Host来源。删除旧输入名，不双读或兼容。保留既有类型/生产者/完整读取/选择/终端资源校验。
- 交付面：同步包Schema、工具描述、成员/流程说明、README、聚焦正向测试和生成payload/revisions；九包修订`2026.10.24.1`并在根CHANGELOG未发布区记录日期、变化及旧Task保持冻结版本。无需数据库或持久化envelope迁移：历史输入仍属于其原不可变包，runtime API与来源格式不变。风险是遗漏包声明/测试或附加证据被丢弃，故补真实Host中“typed前驱+原始资源同时完整保留”的正向合同并重跑原自然语言案例。
- 测试工具观察：Provider audit磁盘文件只在绑定/终态持久化，中间chunk计数会暂时陈旧；不能用它推断真实静默。下一隔离轮次每5秒仅持久化现有内存原reader事实，不新建reader或改Provider请求，用实际最后活动时间判180秒无活动。

## 独立复核发现与关联方案（后续修改前）

- 裁定者指出首轮尚不成立：DA/HR/Sales终稿角色仍要求把全部语义来源交给前驱参数，且只说明发现audit，实际终稿分别要求六个前驱。已核对三个原prompt与expectedSources。补齐真实六类前驱、精确生产者及原始资源选择说明；规范路径应服从用户明确交付路径，无明确要求时才使用包默认路径，避免同时建立两份canonical文件。原始DA规划已提出保留用户路径和包路径的重复输出，当前只作为候选风险，不宣称已实测终稿故障。
- Evolution排除结论被独立复核否决。源码证实共享source控制字段在固定前驱、候选Campaign重复校验、review语义证据、comparison提示及无操作分支间混用，且最终publish不传此字段，真实来源始终来自Host选择。拟按分支只保留真实输入：failure/campaign/run/comparison使用Engine前驱；opportunity/evaluation删除未使用控制值；candidate以已有development_campaign_locator为唯一事实；review以evaluation_result_locator、supersedes及finding evidence为唯一事实并验证完整read/select。同步全部定义、调用、成员提示与正向合同，不双读旧参数。细节需独立复核及真实Host证明，不以静态字段检查交付。
- 版本工具链也存在已复现关联缺陷：生成器`nextVersionFor("2026.10.24.1", UTC2026-10-23)`真实输出`2026.10.23.1`，回退父版本日期；runtime的`nextExpertSquadVersion`已按较晚日期正确递增，属于同语义双实现漂移。全仓调用只有生成器plan与两个聚焦测试模块/feedback内部。决定把现有正确实现移至纯version模块，runtime和生成器共用，删除旧函数与调用；补实际生成plan在UTC落后时输出父日期下一修订的正向测试。无持久格式变化，保留旧包事实与版本含义。修改触及的可变源码摘要/换行差异测试及负向摘要断言不能证明功能正确，删除这些验收，保留真实二进制字节合同与明确版本状态输出。
- 第一隔离服务结算：MK `tsk_g00VYttXB5007eh07gqg`实际completed，四成员、两独立前驱、outputs/meeting.md、独立review与精确Core FactCheckReview均有真实记录；关键提议/确认/拒绝/9000取代12000及未知状态已人工核对，最终裁定待独立子agent。原DA为检查器取消后的cancelled，不算成功。129次模型请求中128个原reader已settled、1次DA取消时fetch_failed（未产生response reader）；初版shutdown检查器把fetch_failed错当活跃，修正终态判断后原命令HTTP200，原exec90790 exit0，native/launcher/output/request全部结清。四份隔离auth/models已删除，实际凭据值扫描0，源内容与mtime保持。无调度或终态异常证据。

## 关联入口的局部复现与方案

- Marketing Growth与SEO/GEO：独立复核发现手写`readSource`只检查通用envelope、在验证类型/生产者前就select，未限制ABI1、未解析领域payload。聚焦`growth-predecessor-integrity.test.ts`真实执行两包publisher，受控Host返回实际不可变JSON字节及其协议digest：两个合法前驱通过，四个版本/领域错误契约均失败，因为发布器实际接纳了ABI2及空payload。该证据是局部合同复现，不称真实Provider事故。共享根因是两包复制了弱reader绕过成熟inspect/domain验证链。决定删除手写reader，统一使用既有readExactArtifactsSettled、inspectEngineArtifactEnvelope(schemaVersion:1)、领域parse，所有依赖/生产者/内容验证成功后再select。无权限、API或持久格式变化；错误透传成熟类型。补合法发布、ABI错误和字段错误正向合同，随后真实包准入与相关native验证。
- portable模板：唯一生成器仍向PackageEngineArtifactPublishRequest传已排除的source_artifact_locators，且README把模型的source_read_refs误写成来源locator数组。生成器及模板副本一致过时，现有检查未验证生成的工具对当前ToolHost类型可执行。决定修唯一生成源、再生成副本；模型传实际read refs，包Tool通过read/select声明来源且publish不重传，政策本体无语义来源则只发布自身真实配置。增加对实际生成工具的类型/原生调用验证，保留完整语义来源与当前唯一authoringSkill说明。该缺陷目前是代码/声明证据，尚未冒充真实Provider失败。
- 独立裁定MK：通过该受控案例。精确原始request/outcome及Permission结果已从结算DB只读恢复，分页字节与持久化Artifact正文逐字相等，最终9598字节文件与发布资源直接一致；编辑者两真实前驱和原始来源、复核七项实质检查及精确target均核实。此通过不外推其余修复或整个Goal。
- portable真实编译复现：把生成的package工具加入现有唯一expert-squads/tsconfig检查面，原检查命令准确给出TS2345（JSON模块被再次JSON.parse为字符串）和TS2353（publish已排除source字段）。修生成器采用JSON模块的真实对象、移除冗余来源参数、修source_read_refs文档并再生成后，同一命令exit0。此处是工具类型/输入契约检查，不宣称模型端到端通过。
- Evolution细化：保留Campaign development分区、父target/baseline、mutable closure、evaluation ABI/producer、review supersedes同evaluation/slot等既有完整性校验。既有candidate.provenance、opportunity.evidence、attribution.owner_evidence和review.findings.evidence若成为正式领域证据，则必须经成熟exact read/select链实际读取并进入Host来源，不接受仅把locator抄入payload。通用typed Engine reader复用exact-reader和schemaVersion=1检查；candidate Campaign补planner生产者校验。没有新reader实现或第二份来源数组。需要局部正向错误与真实Host来源合同证明。

## RD预算中断与新轮次边界（启动前）

- RD原轮`tsk_g00VYtzcus00n4P9yBTE`因检查器`E2E_REQUEST_BUDGET_EXHAUSTED`在180请求失败。原只读审阅角色已亲跑原命令与八项回归，最终复核尚未发布；因此不算通过。保持原预算及失败事实，交独立裁定者分析请求消费，不能把预算失败当产品根因或抹成成功。
- 对全新隔离DA/RD各自服务，在启动前将新轮服务上限明定为360请求；原来180是本任务检查器自行设定，并非用户金额授权上限。复杂完整职责链包含每次工具调用后的真实流式模型步骤，原RD给出下界180但尚未收敛。新轮180秒真实无活动判停滞、90分钟泄漏保护及凭据清理合同保持。两新轮分别计数和报告，不修改旧服务预算，不借继续旧轮隐藏中断。
- RD服务已正式shutdown，生产ProcessSupervisor的物理/输出/请求清理及原launcher均exit0；Windows PowerShell旧版Invoke-WebRequest在收到shutdown后解析响应报NullReference，不能凭此误判服务未结算。后续检查器加UseBasicParsing，原结算证据独立保留。四份隔离auth/models已删除且源保持，凭据值扫描0。
- 关联追查发现Evolution的`attributionIdentifiesOpportunity`还把完整输出来源要求为length=1，才承认跨Task导入的原机会身份；这与Host保留附加语义证据冲突。原机会locator本地直接相等时短路，旧案无附加诊断来源，故未暴露。修为同一既有reference resolver同时确认owner_evidence和实际sources中存在精确机会身份，去掉来源独占假设；其他额外来源保持完整。补真实Host中带诊断证据的机会→归因和跨Task消费链，确认前驱身份与完整来源可并存。

## 因果调查角色模板失配（修改前）

- 独立裁定者读取RD全部177次Task请求，根角色23、Planner26、调查48、修复35、复核45；Provider均HTTP200且原reader EOF/settled、attempt=0。正式调度为Planner一次→三个独立成员并行一次→原reviewer lineage续轮一次，没有重试风暴或重复初始节点。调查者48次中的34次用于成功的update_research_*，另一次inspect；这不是返工。
- 代码与契约：RD因果system/workflow只要求只读代码/运行因果链与causal-evidence，没有ResearchBrief。manifest却选deep-research base及capability_set，runtime-template-registry把其设为exactRuntimeContract并附完整ResearchBrief core，禁止shell且要求scope/summary/evidence/facts/inferences/problems/user_needs/constraints/document_outline/bundle/notes/citations/questions。真实轮最终同时产生ResearchBrief和causal-evidence。根因是包职责与模板必需输出失配，不是Provider或调度器，单纯提高预算不会根治。
- 横向已解析全部builtin manifest并逐字读取相关prompt：22包25个deep-research角色（最初94是字符串命中数，不能当角色数）。Evolution failure-analyst同样只要求typed failure-attribution却绑定deep-research。相近internal-audit、manufacturing、academic因果/逻辑角色已用delegated-worker。其余20包23项为研究资料整理等职责，未发现第三个明确纯代码/运行因果调查失配，不整体替换Research模板。
- 决定先将RD因果调查与Evolution failure两个已证明失配角色改为delegated-worker及其唯一capability_set，保留只读、完整证据、替代假设和独立因果证明；不改全局Deep Research模板，不动已冻结Task。新增正向真实投影合同，随后新冻结版本的真实独立调查与完整交付重验；原版360轮作为完整baseline成本保留，不冒充修复后版本。无API/持久数据迁移；包修订按当前生成器派生。允许执行通用命令不等于允许修改产品，角色只读职责继续明确。
- 创作指引也只称base_role为能力上界，并无条件建议独立证据前沿使用deep-research，遗漏模板强制领域输出。同步squad-sdk唯一authoringSkill、可移植模板生成源及当前架构说明，明确选择模板同时接受core输出契约，普通代码调查使用delegated-worker，确实交付ResearchBrief才选deep-research。不用host关键字推断领域或新静态语义gate；作者/审阅者基于真实契约作决定。

## 检查器预检超时根因（修改前）

- 新RD-fixed服务在任何模型请求前退出7，`checker-error.json`为TimeoutError；没有Task建立，不能算产品案例失败。真实日志显示CLI已监听，预检`/global/chat/start`正在建立冷启动项目。共享RealProviderAudit.preflight的HTTP请求硬编码15秒，早于本次配置的180秒无活动边界；原reader计数0、Provider型号已投影。这与凭据无关。
- 全仓定位唯一preflight helper及其调用者，决定HTTP控制请求同样使用既有input.inactivityMs作为无响应边界，删除平行15秒配置；不增加重试、第二reader或抬升原失败轮预算。控制响应前没有可观测HTTP进展时可按该时间判静默；获得会话后仍按真实消息/活动变化判断。补配置被实际HTTP请求使用的正向合同，再建全新隔离服务重跑原预检和RD。该失败轮物理/输出/请求已结清，清理允许原launcher非零但必须精确记录7及实际清理事实，不能篡改成0。
- 原HTTP204测试假定总有空body reader，当前Bun实际返回null body，audit已正确记录typed body_absent；测试却调用要求非空body的reader helper。修正为真实204文本响应和body_absent状态输出，不伪造reader或EOF。该检查器合同不涉及LLM响应或生产Provider处理变更。
- 独立复核指出新watch脚本的GET若悬挂，循环后的180秒判断无法执行。修为同一180秒配置传HTTP AbortSignal，响应不可观测单独报CHECKER_HTTP_OBSERVATION_TIMEOUT并记录当时原reader状态，不能将其宣称为模型无活动。RD包无固定因果Artifact类型声明，原版两轮分别自然使用causal-evidence和root-cause-evidence，结构checker改按真实producer角色覆盖判断，不以自选type命名充当机制约束；内容仍交独立原始证据裁定。

## Evolution剩余生产入口闭合（修改前）

- 独立裁定者全包追到metric-context和rehydrate资源入口：前者被真实metric执行和evaluation发布共同调用，后者负责跨Task Campaign/Candidate资源重建；两者仍各有手写先select后parse的reader，前者只限ABI1、后者连ABI1也未检查，均未确认原typed producer。这证明原publisher内修复不覆盖全生产入口。
- 删除三份reader双源，将已修的成熟exact读取、ABI1、原生产者解析、领域payload校验和选择迁至一个包lib；publisher、metric-context、rehydrate共同调用，沿existing import provenance解析原生产者，不弱化或伪造跨Task身份。剩余native metric attempt是资源证据，使用exact资源读，不套Engine producer契约。补合法原始/导入来源、错误ABI/生产者的正向明确错误，并重跑真实Host的测量、发布、导入、资源还原、历史完整链。数据库/Host权限合同保持。
- Evolution故障归因从Deep Research换通用模板后，须在角色prompt明确只读取证、禁止修改项目/包/证据和实施修复；保留通用命令能力用于实际因果证明，不另加Host gate。
- 独立裁定确认`readRecordedMetricScorer`虽由metrics.recorded真实读取并验证原native attempt，但其底层execution.read不更新Plugin ToolHost的invocationReadFacts/Selected；Evaluation.scorers[].evidence消费该值并携带ref，却未建立来源边。将通用exact语义证据helper移入同一包lib，权威recorded验证后对observation.evidence_ref实际read/select；资源携带不能替代语义来源。补真实Host的Evaluation来源含精确attempt、Campaign/Run的正向合同，保留native result身份校验。
- RD原版360 baseline已由独立裁定者通过实质验收：199请求全部目标模型/stream/200/settled；最终代码256字节、测试1290字节与发布资源逐字相等，四前驱完整读取与正文直接相等，check514/request925保留，实际node命令四值及11回归通过；原reviewer精确产物@22/目标提交和权限回执吻合。模板额外ResearchBrief是原版成本，不外推新版本。

## 续轮上下文协议冲突（修改前）

- DA因隔离fixture未配置Git作者发生一次真实协调，正常root给出如实标识的自动化身份并继续原lineage，不是调度循环。但respond_agent_coordination实际成功回执仍教调用dispatch_agent，当前Task真实可见工具仅dispatch_agents；模型自行使用正确集合不能证明文案正确。
- 横搜确认同义冲突还在respond Tool description两分支与orchestrator-core多处，其中甚至声称单个入口为only surface。agent.ts已有依据真实usesDispatchFrontier投影生成的唯一调用形状说明，core原文未被替换。故只改回执不闭合。
- 保留当前动态投影说明为唯一入口名/包装结构来源；core描述每个dispatch entry的target、typed turn、独立occurrence和authority，不再硬编码另一入口；respond描述只要求显式按当前可见schema继续，回执返回已持久化request/response、真实target/work_scope和typed continuation authority事实。调度/队列/轮次/恢复/终态实现均不改，不增加兼容入口或host流程路由。现有真实生产coordination→lineage/descriptor测试补正向pending回执断言，再检查实际模型上下文与已完成案例的同一控制流。
- DA还有一次capability_search的queries=[]错误。独立裁定核对实际Schema和公开说明都要求1–4条query，空枚举应为[""]，并复现明确too_small(min1)；相同ref改合法query后completed，没有机制契约冲突。最初把pkg_tool__alias当作错误logicalRef的猜测已由真实catalog代码排除：packageTools.providerName正是此source=package ref.local_ref的合法当前身份。不得按名字改协议或把这次输入错误升级为未证实根因。

## DA 自动压缩终态失败：共享机制分析与方案（生产修改前）

- 原完整复验Task `tsk_g00VYu4FNL00eJSblW8C` epoch1，在254/360请求时failed：`completed without a durable reply`。七类业务产物、9137字节报告与document以及最终十项事实复核均已真实完成；这些不能替代Task完成。根assistant `msg_hmdMdvr6oJQulVVjgJJ2` 仅read_agent_message/artifact_search，无decision receipt，却在成功tool-calls后被写completed；随后同源compaction summary完成，未再调用根Provider。原始精确Tool/Permission/Artifact及254条请求事实保留，不抹成通过。
- 直接控制流：processor成功finish-step usage超过ContextBudget，设置needsCompaction；统一收尾把needsCompaction当成不安全续轮，跳过Task owner continuation decision，完成固定activation assistant，然后返回compact。loop成功消费control后重入processTurn，精确持久assistant已completed，直接stop；completedReply的真实持久回复检查正确拒绝。根因是自动维护边界与逻辑activation完成边界混淆。早期compaction-task-runtime只在测试server手动create control，未走成功usage overflow的收尾路径；此前部分覆盖/同activation恢复机制正确，不能覆盖此触发点。
- 第二关联路径经独立裁定确认：predictive超限分支无条件removeMessage(processor.message.id)，而beginAssistantReply早已提交activationID；Session层及数据库双层immutability会拒删任何Task root激活消息（首次空prepared root也一样）。可达条件是预测输入超限且剩余历史可压缩。现有保护阻止真实删除，因此结论是流程失败风险，不是已删数据。普通Session新建的空prepared assistant不带activation，仍应正常清理。
- 全仓定义/调用：SessionProcessor.create生产三处，loop.processTurn（普通Session/worker/Task root）、loop.shell（非Task root续轮）、compaction helper；只有projected-scheduler且携带taskIngressID/activationID走确定性根assistant复用。Task initial/coordination/lifecycle/operator/recovery均经Orchestrator.processTask同一投影；Mission驱动Task同享此路径，Mission独立Session及普通worker不带此root所有权。SessionCompaction的自动control创建/租约/summary/checkpoint消费与恢复均是既有唯一持久协议。没有修改消息身份、数据库格式、队列或租约的需求。所有入口必须作为共享机制验收，不能按DA单包问题收敛。
- 决定：成功维护不取消既有owner的健康续轮判定，继续按真实decision receipt、有限decision-gap与park/handoff/error确定完成；保留failureOccurrence及error的安全边界。自动summary继续独立作者和Message身份，既不作为回复也不伪造decision。预测压缩只清理普通Session新建空prepared消息，持久Task activation及已有Parts保持，下一轮仍读取同一原assistant。删除reply guard、制造新activation、把summary当回复、修改包避开压缩均不成立。
- 验收：先用真实Task HTTP流式transport的聚焦backend checker复现两条故障，修后保持相同activation、Parts、累计usage、control consumed与真实no_action收据；覆盖纯文本decision-gap、普通Session压缩、真实decision/park、Provider错误/溢出/cancel、手动summary、进程重开恢复、串行和双项目并行。脚本化transport只能证明共享执行机制，另重跑原DA真实gpt-6.1-sol完整案例并人工查看/UI复核，由独立子agent裁定。原失败轮保留且正式结算，不在旧轮偷偷重写completed assistant。风险主要为错误保留真正终态或普通Session空消息，使用正向状态合同防止。

## Evolution 验收读取分页修复（检查器修改前）

- 新增完整scorer来源边后，原真实Host长链已通过Evaluation精确来源断言，随后checker在unavailable Evaluation上JSON.parse单个65,536字节chunk失败。真实产物正文超过页长；这不是publisher或来源错误。测试文件其他输出及导入也用同一单页假设，另有重复手写分页reader。
- 决定在该检查器使用现有readExactArtifact/inspectEngineArtifactEnvelope读取完整不可变字节，替换真实envelope检查的单页假设与手写分页；保持页面传输上限与完整正式来源，不扩大max_bytes或裁剪数据。显式测试单页协议的调用保留其用途。重跑原真实Host长链，不能用局部单测冒充其通过。

## Provider overflow 与缺失回复的分类核验（后续修改前）

- 成功usage触阈值与真正Provider ContextOverflowError不能套用同一完成规则。新增本地流式HTTP反例首次要求两者同activation，实际400后已完成旧error assistant，正式control以其为predecessor建立新activation；原断言因身份变化失败。独立裁定者已撤回‘必然恢复失败’推断。修正验收要求后原生产Provider路径完整通过：旧ContextOverflowError/已完成原件保留、同Session合法新control/activation、原自动压缩consumed、后续真实read与no_action，Task仍active。没有生产Provider修改，不造RetryPart、不清原error；继续补精确ProviderOutcome/ingress与运行结算证明。
- DA缺少durable reply的错误归属还与当前架构冲突：普通Error经agent被当执行失败写Task failed，而成熟completed-reply谓词已能证明这是Host完成不合法。决定只对已确认的completed Task root原assistant、相同activation/accepted source及真实ToolParts不满足isSettledReplyToUserMessage的情况，复用TaskRootIngressIntegrityError。reader从同一持久事实恒定得到host_fault/evidence_violation，loop出口采用相同证明才抛typed错误，既有agent保Task open。没有独立状态/新错误协议/数据库迁移。普通无decision文本stop/length、真正error/cancel、合法park/handoff仍按既有谓词/有限语义预算区分；不把任意缺回复统称Host fault。
- 正向合同用真实backend链与明确局部故障注入制造提前completed tool-calls，验证host_fault、真实基础故障证据和Task active；原成功压缩/普通decision/Provider恢复作为对照，补后继operator输入可继续与语义预算真实exhausted。故障注入只证明错误归属，不冒充真实模型复现。

## 双项目恢复检查器准入错误（修改前）

- `compaction-runtime-crash-check.ts`原Task/during-compaction双项目轮因180秒无持久进展失败，原失败报告/两项目facts/原请求与shutdown信号保留。实际alpha已恢复并完整保留原错误、压缩与后继no_action，beta尚无新owner/lease/Message，不可据此宣称已修复或产品共享恢复失败。
- 独立裁定者从正式serve scope与日志定位：启动参数project-dir=alpha只恢复alpha（attempted=1/initialized=1）。脚本用GET /session当成beta的runtime准入，但当前路由明确是identity，只读取历史而不安装runtime driver。旧检查器依赖已不成立的读副作用，不是Provider问题。完整Scope/路由定义和当前数据证实后才排除本次共享根因。
- 决定改用当前正式runtime级项目入口GET /project/current打开两个明确项目，核对返回项目worktree身份，再沿原恢复链与同一断言验收，不增加专用恢复旁路、不强制内部scan、不改180秒预算。四种Task/Mission × pending/completed-checkpoint分别保留独立报告及原件恢复/源绑定/后继轮次/两项目隔离，原失败轮保留。仅修本地checker准入后重跑原验收。
- 局部分类checker还误把Bun matcher数组断言后的变异对象当持久事实：projection.evidenceIDs被expect.any改成{}，查询gate失败；在assert前保留真实对象，仅对clone匹配后，原真实gate/disposition和后继输入完整通过。真实DB/产品均未修改。后继operator还会自然调用title/metadata helper，脚本化SSE须按其真实无工具请求响应，不能把每个请求当根工具请求。测试返回后显式等待正式scan与真实execution hooks结清。

## 外来压缩租约等待的共享热转（生产修改前）

- 原恢复失败轮的alpha虽然最终恢复，却真实产生162个idle生命周期事件：新Task activation在1792788382093获租约，原compaction租约到8385377，等待区间8382318–8385373约3.055秒、平均18.98毫秒重入一次。该事实来自原protocol事件及精确lease时间，不以日志标题或最终成功掩盖。
- 根因两条独立即时唤醒：foreign-control等待在处理当前armed runtime wake前进入standby，waitForUserMessage无条件把这同一待处理wake当新wake；standby基线lastAssistant??lastUser又选择旧compactor，导致已观察的新control user再次被尾扫描当新输入。等待本意是foreign control终态/租约期限，旧测试只覆盖普通Session无armed wake，未覆盖恢复Task新activation。共享入口为唯一loop/beginStandby/waitForUserMessage，适用于Task、Mission与普通Session，必须全部检查。
- 同一检查还发现提前结算控制的延迟：SessionControl.subscribeWake只通知创建；poll永远排除当前ignored ID却未读取其终态，foreign owner提前consume/fail后可能仍等旧expiry。这是相同事实观察边界遗漏，不应增加第二套调度状态或靠额外idle去轮询。
- 决定在外来control等待中传本次已观察的真实最新Message orderKey及当前runtime contract精确快照，忽略同一个已观察的armed wake，新的wake/input/control仍自然唤醒；不提前consume该wake。持久poll从同一control事实检查其pending→terminal，终态立即续行，租约expiry保持既有时钟。普通standby不传观察快照时保持当前行为。新正向真实backend案例覆盖foreign等待的一次正确standby→真实summary→后继decision、以及普通/Mission/Task的已观察wake、提前consume/fail、真正新input/newwake/cancel、跨Project隔离；原四类进程恢复重新验收。

## 移动消息与延迟bridge事件：调查中

- 独立裁定从双项目原DB查明四个operator输入均存在真实session.bridge.persist_failed。原PartUpdated在root Session事务提交，随后正式move把同Message/Part移至Orchestrator并重定时间；延迟bridge再按旧sessionID查询当前Message，报missing persisted row。原message.moved完整快照与正文仍存在，不能宣称用户消息丢失。
- 去掉session过滤或把旧事件重定向新Session也会混淆真实历史坐标/时间并触发key drift。需继续核全部定义、订阅、Bus outbox、move原始事实与当前projection合同，再决定以原已提交事件及真实move事实闭合投影；尚未改bridge生产代码，也不以吞异常或最终快照存在代替修复。

## Permission 进程切断检查器的模型声明修复（修改前）

- 完整tool-result-control-protocol回归34通过、两项真实OS process cut在预期86之前退出1。原stderr为Config candidate validation的ProviderModelNotFoundError，发生在任何权限切断前；不是权限恢复产品失败。
- fixture仅替换Provider.getModel却在真实project config中写了未声明的测试型号，当前唯一catalog验证不受该替换影响。决定在该fixture同一project config声明准确Provider/model及既有能力/限制，保留原真实Permission/Tool事实及各cut exit86/87/88与最终恢复断言；不放宽生产模型校验、不把fixture当真实Provider模型质量验收。重跑原两cut，再核完整文件结果。

## 恢复等待与检查器投影补充（修改前）

- 外部压缩租约不仅可能到期或对应control终结，还可能因真实失败路径提前交还。等待器须按当前唯一租约到期事实及时续跑；缺失租约同样已无外部owner。补六个合同的真实外部租约及lease-backed终结，并验证提前交还，不用时间延长掩盖遗漏。staged runOnce当前尚未armed时不能被当成已观察的wake，否则同一snapshot随后arm会被吞掉；仅把进入等待时已经pending的同一snapshot视为已观察。
- Permission跨进程fixture在补全模型目录后直接执行wait并永远等待Asked。对比当前生产与同文件已通过的fixture，独立worker的runtime tool factory遗漏唯一source=scheduler-projection，反而声明test-runtime-tool；其冻结invocation自然不走scheduler权限路径。决定补准确生产factory身份，保留真正Permission Asked、allow_once、两个进程cut及精确once-only效果断言；不是在生产强迫已授权工具额外确认。原exit143事实保留，不提高300秒边界。

## 延迟消息投影实施方案（生产修改前）

- 完整Move是当前唯一正式所有权移交事实，和原Message/Part改址同一事务提交。Bus原事件有不可变occurrenceID及outbox正文，桥接却丢弃该身份，只查当前旧Session坐标。这是故障根因。只去掉Session过滤会变成orderKey漂移；改写旧事件坐标/重新发Move会破坏消费者归属与真实消息原则，均排除。
- 只对已有生产合法的Task-root不可变user Message之Updated、PartUpdated处理覆盖：传递原occurrenceID，验证原outbox精确类型、project和正文；索引seek同project、Message ID的真实完整Move，严格验证source/target、当前Task同lineage、当前Message/Part身份及快照。证明成立则该原增量已被完整Move覆盖，正常消费原Bus occurrence，由既有Move订阅发送唯一完整投影。校验必须在message info cache写入前完成，防止旧Updated污染Move后缓存。
- Delta、Removed、PartRemoved横查：唯一Move生产者只移交已冻结user Message，未产生流式Delta/删除；不将这些未知事件静默丢弃。错owner、伪occurrence、错part、无真实Move继续当前明确错误契约。没有新持久状态、协议字段或合成事件。
- outbox现索引只有project/time，按Message查Move会全历史扫描；追加版本4表达式部分索引，当前DSL及唯一迁移DDL同步，版本1–3保持不可变。使用既有自动备份迁移保留全部用户事实；验证v3历史outbox移植与索引查询计划、当前DDL一致性。风险为错误消费不完整Move或跨Task事件，需原正式交付+延迟drain正向回归、严格错误合同和双项目真实crash原案复验，交独立裁定。

- Bridge独立复核补齐：PartRemoved若有精确原durable occurrence，且完整Move.parts已不含该Part，其删除效果也由快照覆盖；若同ID仍在Move中则明确错误。该分支共用同一证明，不覆盖Removed/ephemeral Delta。原orderKey还须在唯一timeline模块验证canonical域、实体、rank/sequence/time，不能因为忽略移交字段而吞错键。无需时间先后假设，原始快照与Move正文/身份直接证明覆盖，同毫秒或时钟回拨不构成错误。

## Permission wait 检查器根因修正与裁定

- 上段factory source猜测已被实际数据库否定：补source后仍无任何permission_policy/ledger，wait效果却成功。当前唯一Permission分类把wait与request_orchestrator_decision视为观察工具，正确直执行。两个父进程测试的instrument以对象spread包装raw.wait，丢失非枚举NativeTaskToolBinding，loop才把无Core身份的工具重绑projected/package-tool而人为产生权限请求；独立worker没有错误包装故始终等不到Asked。不是生产恢复、凭据或catalog校验故障。
- 独立裁定者读完整生产producer集合后确认四个过时wait权限测试及专用worker应删除，不为保旧测试新增生产审批或fake binding。保留其余真实park/ToolPart/assistant恢复；原生产wait用ask模式真实执行，正向验证原scheduler factory身份、实际授权调用providerKind=builtin、完整park和真实wait registration。Permission持久化由现有真实副作用跨进程检查器覆盖。先前模型catalog补丁随仅供错误测试的worker删除，不遗留第二fixture协议。

## 诊断快照读取竞争（检查器修改前）

- DA完成前watch在读取provider-audit-current.json时读到半份JSON。根因是本轮私有serve辅助脚本每5秒直接覆写同一文件，与read-only checker跨进程读取竞争；生产RealProviderAudit内存原reader和HTTP正常，Task随后完成。既有script/audit-snapshot.ts已提供不可变revision文件及latestAuditSnapshotFiles，本辅助脚本未复用，属于检查器双实现。
- 决定新轮诊断writer直接复用成熟不可变publisher，checker复用唯一latest查询；删除直接覆写current作为运行中事实源。已经物理结算的旧轮可从稳定原audit创建一份不可变证据副本，保留原文件和watch SyntaxError，不伪造请求或抹掉失败。最终checker输出current只是交付视图，原不可变revision才是依据。不增加读重试/fallback或更改模型预算。

## 包进程处置竞态：共享分析与方案（生产修改前）

- DA-fixed Task最终completed但并非无故障：两条task.infrastructure.failed指向同一publisher introspection，错误为dispose requested后1000ms未退出。227个实际Tool request最终均completed，第一次report writer在resolveTools阶段失败，原模型后来显式重派并恢复，不可用最终绿状态掩盖。独立裁定者已核原错误及时间，原生child/marker时刻缺失，不能猜测OS具体迟滞根因。该轮也没有compaction control，不冒充真实模型压缩验收。
- 唯一ProcessSupervisor.disposeAndWaitForExit把dispose/settled 5000ms和exited/output 1000ms从同一时刻并行计时；Windows exited自身还等待helper物理退出与durable marker验证，settled包括output与request清理。合法处置超过1秒时，较短时钟在完整5秒边界之前先制造失败，即使随后全部真实结算。包工具introspect和execute每次都会走此finally；同一API还覆盖MCP stdio/browser、plugin/process facade、bash/session shell、Task reclaim和late admission，不能只放宽DA。
- 全仓未发现dispose调用者设置exitTimeoutMs，只有terminate协议使用独立exit阶段；dispose对外是一个完整结算操作。决定删除dispose的平行exitTimeoutMs选项，入口按原cleanupTimeoutMs（默认仍5000ms）或调用者已有deadlineAt生成唯一绝对边界，四个原promise在同一边界共同结算；不增加常数、重试、阶段累加或旁路。保留原cause聚合与真实请求清理证明。terminate协议不在本故障范围，不改。
- 验收先用真实native子进程及受控的1.2秒合法处置阶段复现旧1秒错误，记录target实际存活/退出、原exited/output/settled。补晚output、晚physical、已退出而request清理尚未完成、多个原错误和绝对deadline错误合同；再跑原生包工具并发装配/执行与共享ProcessSupervisor真实检查，重跑真实模型自然发布路径。存在真实退出失败仍需如实报错，不能仅以增加等待作为修复。

- 删除专用worker后原回归明确暴露另一文件两个重复wait cut仍引用它；这是调用点搜索遗漏，已全仓定位并同步删除同一错误分类的重复测试。该文件真实Mission permission恢复案例保留并重跑；不是删除真实产品失败。Bridge的invalid-key新增断言曾只await publication已提交及已入订阅队列，早于真实drain；修为按该精确occurrence三阶段结算后核错误。初始失败均保留，不加sleep逃避原边界。

## 真实模型自动压缩定向案例（启动前）

- 旧DA真实失败曾触发自动压缩，但新完整案可能因自然模型路径较短而不触发；最终业务完成不能充当触发路径验收。新增独立本地base Task：当前协调者完整读取8份受控交易页，在可见答复给出每页记录数/金额及总计，然后按真实完成决定结束。请求只描述输入和输出，不指定工具序列；不更改包职责或Host选路。
- 每页180条明确交易，金额为page*1000+row分，共1440条、6610320分；文字明细供真实read/分页和压缩，不用哈希/摘要代替身份与功能。沿唯一现有compaction配置max_context_tokens=48000、preserve_recent_tokens=4000缩小本次上下文预算，不改变完整模型目录、模型API身份或生产默认常数。所有请求仍gpt-6.1-sol/streaming，另一个独立服务在启动前上限64次、180秒真实无活动边界，沿已授权的同一隔离凭据用途。
- 验收要求真实自动control被consumed、真实summary成功且更小、原根assistant/activation在成功维护后继续执行至决定，原Tool/Parts和输入完整保留，最终1440/6610320及逐页数值可从原数据复算，Task completed，无新的未解释基础设施故障；完整ProviderOutcome/原reader和DB证据交独立裁定。若只触发预测压缩必须如实区分，成功usage触发至少一次才关闭原A路径的真实模型复验。

- 独立复核另定位ordinary/exclusive并发检查器仍以spread丢失read_context/internal和wait/builtin原生身份。保留该有用真实顺序测试，使用成熟bindNativeTaskTool携原精确绑定，核实际authorizer收到相同providerKind，不修改生产分类。
- 已触及orchestrator-mission-root-message-read的overlay专属API authority/对话parse-merge/live投影自动断言，按AGENTS四节删除这些断言及专用imports/setup。真实Mission权限读取、原Message/Part和正式HTTP/durable Move合同保留，只有删除UI部分后才运行该后端文件。
- 真实压缩定向首轮在任何Task模型请求前因48K配置小于原工具定义157032字符/39271估算token所需预算被既有校验拒绝（service含3次预检/辅助请求）。保留Task failed原错误；校验行为正确，不改生产工具投影或隐藏授权工具。新独立轮在启动前使用max_context_tokens=128000、threshold=0.7、preserve_recent_tokens=4000；64请求上限不变。该配置容纳完整工具并以真实明细历史触发自动维护，原轮正常shutdown并清理后再建新轮。

## 默认保尾误判空材料：共享根因与实施方案（生产修改前）

- 原定向真实轮 context-real-2 / Task `tsk_g00VYua9TS00Taze1ePu` 在7/64服务请求时失败。四次实际全文read均completed，原Provider均成功；第五步预测93659 tokens，超过128000×0.7=89600，自动control的overflow=false。selectCompactionInput却在保尾预算4000/实际30609时返回空head，抛SessionCompactionMaterialUnavailableError；没有调用summary Provider。原8页、根assistant、Parts、control及请求证据保留。该轮只证明predictive触发，尚未证明successful usage路径。
- 全仓复核唯一selectCompactionInput、turns、Message.isCompactionTailBoundary、CompactionCoverage、process/repeatedCompactionInput及当前project-memory/task-control契约。tail_turns默认2与preserve_recent_tokens是保留上限；最近窗口不足预算或首个窗口恰为全部历史，不意味着锚点后没有内容。两个guard分别在无keep且recent[0]靠近source，以及keep.start靠近source时返回空head；默认32000预算下同一历史会命中第二处，单修4000分支不完整。普通/Mission首次大assistant也可达，同一Task长寿命assistant不是唯一影响入口。
- 旧测试把tail_turns设0且overflow=true，直接绕过保尾选择；四项OS恢复矩阵证明恢复及原件完整，但也不能证明默认保尾。Message完成状态不是压缩前提：已有covered_parts快照/后续suffix、running Tool outcome变化、重复checkpoint与重开数据库支持同一开放消息，不需创建step消息或提前完成activation。真正无post-anchor仍保留明确无材料错误。source之后更晚已接受user的截断边界不变，不扩大当前授权输入。
- 决定在唯一selector先计算非空post-anchor完整候选，overflow/无保尾/无有效turn直接使用该同一候选；保尾没有有效keep或keep会占掉全部候选时仍选它。只有存在更早真实head时才保留合法小tail。同步删除两处错误空head假设及重复完整head构造，不放宽tail boundary、不改消息身份、配置/Schema/持久格式/权限，不教模型避开压缩，也不增加预算或隐藏已授权工具。
- 先补正向红例：默认正tail的真实Task predictive路径，普通Session和正式Mission入口的大首assistant（open/completed；4000及默认预算），以及既有小tail、queued user边界、无head错误、重复覆盖与重开合同。修后重跑原8页同64请求/128000/.7/4000真实gpt-6.1-sol；若仍只predictive则另设计自然高token密度真实输入证明successful usage，不修改旧案例预算或模型目录。独立裁定者复核全部证据后才算闭合。风险是保尾策略误吞可保留小tail或覆盖后续输入，须由保留tail和原source绑定合同排除。

## Mission transcript-copy 准入遗漏（生产修改前）

- 默认保尾实流程扩到正式Mission后，summary与原件保留成立，但测试直接调用Session.fork默认fork时SQL抛mission identity metadata incomplete。当前正常fork只允许独立会话；正式HTTP/session fork、panel及gateway已由唯一assertPublicSessionOperationAuthority明确返回MissionSessionAuthorityError/409和canonicalOperation=mission.wake。Session.fork内部只检查Task身份，遗漏同一Mission规则，不能把SQL约束失败当契约错误或复制Mission身份。
- 已搜fork定义、全部调用、当前project-memory、Mission authority及既有HTTP测试；独立裁定确认复用原guard。决定在既有assertCopyOwnership的side-chat早退之后调用同一authority函数，入口和事务内原位置都保留；不新建错误、不改kind、不改持久格式，不增加路由旁路。普通fork和显式独立side-chat保持唯一原子copier。补直接Mission fork到真实既有typed error及原HTTP回归；Mission压缩测试在live阶段核原projection与明确错误，最终完整回复后走合法side-chat验证引用/coverage，避免测试制造未授权Mission副本。

## 延迟增量修复的 pre-accept 修改边界（调查中）

- PartRemoved扩展红例首次观测到[PartUpdated,Moved]，进一步源码证明非事务Session.updatePart发真实临时Bus事件，已在Move前可见，不属延迟durable；该断言不能混淆两类事件。改以成熟事务writePartInTransaction真实提交draft，再remove、accept、formalMove后，确实得到persist_failed，原无修改案例此前通过不能排除此缺口。
- 原guard要求旧Part与Move同正文或仍在Move，遗漏接受前合法修改/删除。已冻结user在Move前可先编辑，旧durable增量仍是原时间真实事实。尚在审查如何仅以原outbox与完整Move证明覆盖，不能吞未知/伪事件、修改旧坐标或新增第二状态源。生产Bridge暂未调整，待独立裁定确认完整证据边界。

## 接受前修订的延迟投影实施决定（生产修改前）

- 独立裁定补足真实writer边界：既有Part仅text/reasoning允许同type修订；其他payload不可变。已删除Part必须另有同project/source Session/Message/Part/type的真实durable PartRemoved事实，不能仅凭Move缺席推断。User info在accept前可修summary/format/model等字段，但真实参与者role/author/agent与源身份必须保持。原Updated、PartUpdated均验证原occurrence原正文及canonical键，Move须唯一、真实同Task root→orchestrator、完整快照精确等于当前冻结user和Parts；不以时钟或rowid证明先后。
- 决定保留同一覆盖函数：User历史info比对真实参与者身份；存活可变text/reasoning按原writer同ID/Message/type修订合同覆盖，存活不可变Part继续逐字段比较；已删Part以原durable removal及当前完整Move同时证明覆盖。PartRemoved自身需真实partType。未知Removed/Delta及未证明的增量仍保留明确错误；不改事件坐标，不补发Move，不制造历史记录。
- 给removal精确查找追加同project/Message/sourceSession/Part/type的部分表达式索引；本轮尚未交付的版本4迁移同时构建Move和removal索引，已交付版本1–3原文保持不动。复验旧v3用户事实和两种EXPLAIN索引使用及当前Schema一致性，不复制状态或新增fallback。
- 红例扩成四种真实作者：事务提交存活text旧版本→修订、删除draft、user summary修订→accept→Move→延迟drain；完整Move投影/原occurrence三阶段结算/实际typed错误是正向输出。原真实双项目OS恢复须在最终实现重跑。以上是共享消息投影修复，不扩为任意历史正文变化。

## 独立旁聊的维护消息完成边界（复现与方案）

- 独立裁定发现Session.fork(side-chat)的lastComplete仅查completed/finish，已完成compaction summary因此可充当用户回复；raw chronology又把创建较早但仍open的根assistant及其晚到Parts纳入副本。这违反当前07-panel仅复制completed reference history及summary不是reply的契约，尚需真实copier红例确定。
- 更换为isSettledReplyToUserMessage仍不足：失败compactor被正式processor写summary=false/finish=error，仍可能被当完成reply。已读HelperAgentRegistry唯一角色分类，覆盖compaction/title/summary/memory；不能用summary布尔值代替真实参与者身份。原copier还用finish=tool-calls一刀切排除真正携持久turn-control的完成决定，同一现有settled谓词已能正确区分。
- 先以纯后端真实Session.persistMessage、publishCompactionCheckpoint、追加running Tool/晚到text、正式side-chat copier复现：普通/Mission，旧完成回复或无旧回复，成功summary/失败compactor/title helper。明确核副本的真实历史、source locator及源open occurrence/Parts保持。此夹具证明复制机制，不冒称真实Provider；不运行含overlay parser的server/side-chat UI自动测试。
- 若红例成立，唯一copier复用isSettledReplyToUserMessage和HelperAgentRegistry.isID，保留原unknown排除；成功/失败维护作者都不能扩大完成边界，真实带turn-control的tool-calls终态按原共享谓词进入正确历史。只改复制选择，不改运行中源消息、不扩大授权、不增消息或持久格式；同步project-memory并重跑原atomic copy和compaction lifecycle合同。边界无旧回复应得到合法空独立历史，显式side-chat权限仍通过原入口，普通fork的完整复制合同不变。

- 复现结果：12个成功/失败维护作者与open owner场景均真实暴露错误；2个typed Tool fixture最初end=start被既有Schema正确拒绝，修为合法时刻后才可验证复制，不能把这两次计作产品红例。
- 首版仅替换lastComplete后，原checkpoint/citation/开放消息最终复制合同暴露退化：真实owner创建→summary→同owner继续并completed时，Message创建顺序仍把summary排在owner之后。不能新增owner消息推动时间序列来让测试过关。独立裁定确认必须保留‘完成前缀的有效checkpoint表示’，原测试保留。
- 完整决定：先用真实settled owner确定完成prefix与accepted inputs；helper只在自身completed、parent/accepted batch及checkpoint anchor/tail/covered message依赖全在已选集合时，按现有chronology逐项纳入。成功summary必须满足现有CompactionHandoff并有实际checkpoint；失败helper仅作为历史诊断，不能证明owner完成或成为MEMORY。任何覆盖open owner的checkpoint均原样排除，不裁剪marker、不重算coverage或改写原件。依赖闭合只决定本次同一copier选择，不创建版本表/权威或新的helper执行状态。

## 收敛验收与独立裁定（提交前事实）

| 真实案例 | 精确轮次与结果 | 独立核验 |
| --- | --- | --- |
| Meeting Knowledge | `tsk_g00VYttXB5007eh07gqg` completed；原纪要9598字节，两个typed前驱及原会议稿，7项精确目标复核 | 已核真实read/request/outcome、完整原文、语义状态及文件身份、02人工截图和原生结算。129是含已取消首轮DA的原服务总请求，不冒充MK单案请求数 |
| Review Debug 修复后 | `tsk_g00VYu8k4L00yAPsmtMI` completed；161次专用服务请求全部目标型号/stream/200/settled；256字节修复与952字节实际回归文件，原四值和9项回归通过 | 已核只读因果角色实际模板、四前驱完整字节、真实shell结果、最终目标review、04实图及结算；旧180预算失败和原ResearchBrief baseline保留 |
| Data Analysis 最终新轮 | `tsk_g00VYuVhNR0096PKwiBo` completed；226/360，全目标型号/stream/200/settled；7业务类型、7997字节报告和相同document正文，最终9项target-bound review | 83个read分片逐字一致、47次select当时覆盖完整；终稿六typed前驱+两原文件进入来源图；总量/分组/增量/舍入与边界独立复算，06/07实图通过。该轮无新的infrastructure/bridge失败 |
| 原输入自动压缩复验 | `tsk_g00VYudm9N00InO5Av3x` completed，28/64；同8页同128K/.7/4K，1440笔/6610320分 | 原失败context2输入逐字相等；8个真实完整read，两个predictive control consumed及真stop summary，同root/activation继续算术和完成，11实图与结算通过 |

- DA真实successful usage路径：原root `msg_hSCU4L4wImPswX9baQfT` / `act_g0VYucjV800P01hyssvd`，239682超过默认230400；`sctl_g0VYucvMZ00pbftyi1N` amended+consumed，summary `msg_g0VYucvNg00Or4WbW47s` 真stop。23个captured Parts按原协议绑定仍与原件一致，后继同root输入usage降为87350，最终真实manage_task及task.completed。没有以新activation或summary假充回复。
- 交易轮两次预测第5/11步93629/93658超过89600；维护后实际输入usage由69182→50892、69768→51631。原根`msg_hL4yZQtsSuZE4HKS62Ki` / `act_g0VYudmRj00eO33PsOV5`及accepted batch不变。每页180笔实际金额分别196290/376290/556290/736290/916290/1096290/1276290/1456290。一次对healthy root猜读diagnostics按明确CompactionEvidenceReadError返回，真实错误保留；它不构成‘原交易读取失败’，也没有证据要求改生产吞错。已公开输入生成器并与实际8份原文件直接逐字核对。
- 最终四项OS（Operating System，操作系统）矩阵为Task/Mission × during-compaction/after-checkpoint，每项两独立项目，分别32/30/30/28个受控流式请求。全部原before工具请求/结果在恢复后逐对象保留，实际后继Provider上下文含各自更正原文、TRACE和next_offset=17031；中断error原件保留，后继真实activation及Task no_action/Mission panel_complete_mission结果、最终DB收敛和SIGTERM结算成立，bridge.persist_failed均0。该矩阵是本地流式机制验收，usage不冒称真实模型token计费。
- 11个有凭据的隔离服务均已沿自有精确进程正常结算并保留原退出事实，四份auth/models副本逐轮退休；最终复核全部44个副本路径已不存在，11份retirement记录secretMatches=0、源凭据/目录内容与mtime保持。原失败预检退出7被保留；没有操作现用服务或对外发布。
- 独立裁定者`/root/independent_judge`全程只读，直接核代码、原DB、字节、请求/结果、Provider reader、权限结果、人工图及结算；分别否决过不完整保尾、丢检查点等方案，最终通过上述案例、共享根因和当前有界矩阵。当前未发现新的已证明机制缺陷；该结论不等同全系统绝对无缺陷，模型明确输入错误也不被伪装成零错误模型表现。

## 最终聚焦验证索引

- 122个当前包沿真实loadSourcePackage准入：122 validated / 0 invalid；声明→能力投影→原生执行由前驱/领域/角色/portable/实际Host合同及三个自然专家团案例分别证明，不能称122包都完成真实模型全流程。
- 包合同8文件：Evolution证据9、Growth/SEO 6、因果角色2、portable原生1、模板1、版本7、feedback9、Provider audit26均通过；原authorized-capability-execution 17通过。当前九发布器及typed Schema的最终9文件33项回归通过，保留`publisher-delivery-regressions.log`。Evolution长链实际Host 144断言通过，完整分页使用成熟exact reader。
- 压缩主合同21、真实Task触发9、默认尾普通/Mission开放消息6均通过；包括小tail、后继已接受user、重复checkpoint、running outcome变化、真实Provider overflow与Host fault分类。外部控制等待10、Bridge四作者/旧修订/删除/不可变错值9、v3→v4迁移及双索引23、Mission公共authority3通过。
- 旁聊最终14+3+12+6=35个后端合同通过：helper不推进owner完成边界；依赖闭合的真实checkpoint、原引用、copySources、原子事务及accepted steering batch保持。成功summary和失败helper均覆盖，未靠新增owner消息绕过长寿命根消息。
- 最终接入同一旁聊后端入口时，按AGENTS删除server/side-chat既有overlay parser和UI view自动断言；保留实际HTTP/transcript的原Work作者和新Chat消息、项目authority、配置及完整历史合同。删除UI部分后才运行纯后端文件，7项通过，未运行其旧UI形态。
- 共享进程dispose 6、control-plane 17、实际并发原生包执行1通过；原1.2秒正确处置在旧1秒时钟下失败的真实对照保留。权限真实副作用四项OS恢复4通过；错误的wait权限fixture及重复消费者删除，真正Mission权限恢复和准确factory身份验证保留。
- 最终backend typecheck、expert-squads唯一typecheck、docs:check（346 ops/26 groups）、architecture-index（20）、database-migrations（目标v4，两种索引及当前Schema一致）通过；提交前diff whitespace检查通过。后端路由、原生清理和实际页面各按其真实契约验收，没有运行UI自动化或全量bun test。
- 审阅子集及原交付字节位于`specs/artifacts/2026-10-24-expert-squad-mechanism-cases/`，完整原DB/audit/失败日志在已退休凭据的各原隔离目录保留。本记录为提交前验收事实；实际提交、upstream合并及推送身份以Git历史与最后交付消息为准，不预写未发生的动作。

## 最终架构文档对齐

- 独立交付复核发现04-extensions仍把公开调度Schema固定写成单个dispatch_agent。横向搜索当前架构后，03-control的调度与continuation说明也有同义残留；task-control-plane及expert-squad-scheduling已经准确区分真实单调用与collection member，并复用同一执行器。
- 已核dispatch-agent-tool、dispatch-agents-contract、dispatch-agents-tool与tools的真实投影：每个条目都是dispatch对象，初次派发的隔离选择实际位于dispatch.turn.use_worktree。决定只将两份架构中的旧固定工具文案对齐当前投影的委派条目/Schema，明确每个真实调用或collection member对应原不可变lineage；不改生产工具、权限、执行或历史身份。完成后重跑文档与架构检查，并交独立裁定者复核。
