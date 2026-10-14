# 407 消息完成与权限续行退休

## Recall

用户原始要求：持续按批次并行体验和调查 UI（User Interface，用户界面）、功能完成度与缺陷；每批先完整根因/影响分析落specs，再有证据实施、真实桌面交互/原截图人工复核、聚焦正向功能测试及需要的已授权GPT-6.1 Sol流式端到端验收、范围提交/上游merge/正常push，然后自主下一批，直到明确停止。goal active且无预算；仍只既有audit_functionality/audit_ui两agent，单层不得再次委托。

406已实际交付dcc2469e29c640f59519cf5b08bcedc829fde956（parent73664470621ff6b76b84c40c554afadd6ecc8759，1144范围路径）。P去重55tests/247assert、原600s两个实际进程入口各4/58、八child/各资源服务完整闭合；最终U3四真实桌面页23原JPEG，十页含修前49原JPEG人工看，原答案/Tool/自然final/Board均实际读回。原commit外父1是Git commit成功后index同步被并行锁拒绝，reconcile01/02原1保留；03精确all-own同步0，普通暂存区空，未删锁/动用户进程/回退整仓。fresh fetch/merge后pending唯一此commit，原push30555 join3d46c5 exit0；八包types及全部正常hooks0，main→main736644706..dcc2469e2。freshfetch3a1896和ancestor aad149各0确认upstream。[实际原回执](../../artifacts/2026-10-14-execution-owner-recovery-406/after-delivery01/README.md)由本批承接。

406仍未完成：普通Ask消息完成后的normal retirement触发；Question Phase Q、Task ordinary Question死owner与双活恢复、MCP（Model Context Protocol，模型上下文协议）真实远端task、本批Sol/真实OS unknown/live跨120s效果；Connecting短窗口/基础设施历史视觉、ASCII310 native cwd267、Task业务完工/result checkpoint与Work/Mission独立Question均保持原未满足。406结果不代这些格，原Settings skill/mounts500及Base catalog500不是console clean。

已读：406完整Recall/retirement-timing-review与四process01原完成消息/Tool/durable CSV/完整ledger；当前security-permission、02-data、03-control/task-control-plane；Root已亲读PermissionAuthority原retireMessageContinuations/continuationReady/retireContinuation、Session全部upsertMessageRow1451–1580及前后用途、Database同步immediateTransaction/savepoint/effect/outbox，module-topology当前无retained SCC（Strongly Connected Component，强连通分量）预算/四clean import入口。全仓retireMessageContinuations/resumeApprovedContinuations/updateMessage/upsertMessageRow/afterCommit及历史已有406横审，现版本重新查询并由两个agent保存到.tmp-message-retirement-407，完整反馈待Root审阅。

硬约束：唯一真实事实/原Project-Session-Message-call-attempt-activation-occurrence；Tool成功与Message完成分开，不能为绿检查提前退休恢复入口。全部LLM（Large Language Model，大语言模型）交互流式，不教模型工具流程的host gate，不合成消息/terminal/答案/时间/死亡。没有新queue/timer/注册callback/状态影子/双源/fallback，遵守当前架构单一契约。UI禁止自动化/DOM（Document Object Model，文档对象模型）或文案/组件/截图基线/像素断言；只真桌面/ui及人工看原图。真实Provider验收必须auth/models同对、凭据可用/目标已投影/实际精确gpt-6.1-sol分别确认，原600服务/20请求/180无活动/60收尾，不泄露凭据或延原预算。

开始/结束核git status；当前只有其他compaction/prompt/测试及索引排序等变更，保留不混入。Session/index与Permission authority在406交付后clean。只当前main、不新branch/worktree、不rebase/force/no-verify。所有本任务修改必须范围commit，fresh拉取merge/完整pending核对与正常push；不自动发布/tag/PR。压缩恢复先重读此Recall、最新精确授权/实际owner/deadline与未完成项。

## 已证现象、直接触发与旧路径

406原四live完成消息都有time.completed、HTTP prompt200、原Tool completed、durable CSV结果与自然final stop，Ask原ledger却只有requested→allowed_once→execution_started→execution_succeeded。process01错误期待立即stale已修正为当前执行合同，产品正常退休仍未保证；不能据55绿格抹此真实缺口。

当前唯一canonical retirement writer1310只在恢复resumeExactContinuation及SessionLoop恢复结算调用。reply仅赢允许且没有live waiter才恢复；Instance首次entry扫描flag在await前置true，暖请求/普通Prompt finish没有重扫保证。正常processor完成写Session.updateMessage，经唯一同步upsert提交Message及Updated outbox，未接退休。Full access同结果事务stale是现有不同合同，不能复制给Ask提前关闭Tool→Message crash接续。

全共享影响覆盖普通public Session/Main/Global/Work/Side/非Task子会话、ACP（Application Client Protocol，应用客户端协议）/CLI（Command Line Interface，命令行界面）/channel/control、Task-root retained activation/worker/delegate及Mission normal/restart；串并行多Tool、live peer/unknown/dead、正常/终态/retry/reopen、多Project均由相同writer与原恢复入口决定。成功结果仍权威并可durable replay，当前没有二次效果实证；合法Message/Session retention删除后cold scan重复NotFound风险只有推导、尚未真实复现。

历史86fbe0bca首扫故障隔离、49028f70c Full access同结果stale、385 e08017392只给恢复链加入Message完成retirement，均没有normal完成接线。406物理effect修复不改变该缺口。

## 当前调查方案与边界

本批主方向为在真实完成Message的唯一canonical写入/发布边界，复用唯一退休writer，以原真实completed Message和具体Tool outcome关闭成功续行；保持未全完成Tool与retained Task activation恢复入口。需先解决同步事务/实际错误合同/运行时依赖：当前retireContinuation吞写错误只日志，若原样放同Message事务，不能直接声称完成与stale原子保证；直接Session→Authority值import是否新增SCC也尚未知。必须全定义/调用/历史与原checker证据后决定，禁止为绕cycle放宽module-topology或给每route/Prompt补新扫描。

audit_functionality只读完整canonical writer、所有silent/replay/recovered/fork/copy/atomic调用、Task/Mission完成与Project/retention、错误/事务/outbox/import影响，给最小唯一primitive方案。audit_ui只读Question已接受源/物化/终态入口及Task两层活owner准入、真实A2A（Agent-to-Agent，代理间协作）action与普通fixedID区别、Main/Dialog/Side/Board唯一投影消费；基于405原red04/live01，不把406 U3视觉当Q后台完成。本Q审计供后续精确方案，当前不并行改共享Authority。

当前**仅调查/文档**，尚未授权生产、正式测试修改、服务/模型/page启动。完整反馈/定义caller/import错误合同/公共数据范围与风险Root亲审后再落最终实施方案和精确授权。非UI聚焦正向验收应证明normal Ask自然Tool→Message完成完整ledger/result/Message、同Message两个Tool首完第二pending、Task retained同activation真实最终typed completion、Mission normal、暖Project/live peer/两Project、正常完成后cold恢复及合法retention真实边界；mock仅局部、不显式手动retire冒自动接线，不以absence断言取代具体完整结果。

## 首轮静态反馈（尚不授实施）

Root亲读agent原module-topology-analysis：仅复用当前checker五个pure AST（Abstract Syntax Tree，抽象语法树）函数读取当前1163模块/5936边，baseline SCC=0、Authority→Session runtime path=null；虚拟加入Session→Authority值import仍0。这是可核代码图证据，不能预设“避环必须新抽leaf”，最小方向优先复用既有writer。没有运行clean-import/产品模块/服务，这份图不证明运行时初始化通过；最终真实checker仍需执行。strict错误传播、upsert早return、atomic part次序、全部caller/reply/public风险仍等完整报告，生产冻结。

407初始文档原docs650b20/architecture5bf10b各exit0，345ops/26groups、19current/links，原600s physical/output/request完整。初次README补丁猜错现有标题而整体拒绝，没有部分写入；Root读取真实标题后精确重补，未覆盖其他索引排序。新增407条目与406原交付回执须范围提交/正常push；后续任何方案扩展仍先更新本Recall与实证边界。
