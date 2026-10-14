# 406 原执行者恢复权威与 Question 选项呈现

## Recall

用户原始要求：持续按批次并行体验与调查 UI（User Interface，用户界面）、功能完成度与缺陷；每批先完整根因/影响分析落 specs，再有证据实现、真实桌面交互及原截图人工复核、聚焦正向功能测试与需要的已授权 GPT-6.1 Sol 验收，范围提交、拉取合并上游与正常推送，随后自主进入下一批，直到明确停止。目标 active，无预算。仅既有 audit_functionality/audit_ui 两个独立 agent，单层且不得再次委托。

405 已交付 ba5f55cb3647385db64bc77a93260619e2ef3fb5，原 commit exec27474 join0，push exec37802 join0，原 fedd04743..ba5f55cb3 main→main；fresh fetch 验证 origin/main 祖先。前端八源、38 tests/97 assert、types/private build、六真实桌面页与19原JPEG、453原证据均有原闭合记录。Task red04 实际普通 Tool 中断后 Question/Board仍pending；live01 原B接管活A，Permission未知结果抢槽让A真实执行结果报SQLite唯一约束，均未由405前端交付修复。Connecting短窗口与基础设施历史视觉未满足；原ASCII310 native cwd267、Task业务完工/result checkpoint及Work/Mission独立页面Question仍未满足。

已读：405 Recall/analysis/red04/live01-summary/原四ledger行与完整公开API对象；406 scratch406-analysis全文、全部Question/Permission caller、历史决定、22组相关源选段定位，Root亲自读authority原admission/start/effect/outcome/reconcile、project-authority、permission schema、control-lease、process-liveness、Question原ask/restore；当前security-permission、02-data、03-control、task-control-plane及panel-reactivity契约。原live01没有取effect lease行，实际lease ID/owner未知，禁止用当前源码反填；源码与历史能证明设计缺口，不替未跑运行格。406源码摘录和查询在独立.tmp-task-question-recovery-406，不覆盖405原失败或归档。

硬约束：唯一真实事实、原Request/Project/Session/Message/call/attempt/activation/occurrence归属，全部模型流式；不合成消息、Abandoned、答案、时间、进程死亡或模型成功。泛用已授权工具直接提供，不用host流程门/工具名白名单教模型。复用现有持久租约和进程身份组件，不另造表/影子状态/恢复队列/兼容fallback；删除被替换旧路径。先完整分析全部生产入口和Task/Mission/Session执行轮次、正常/终态、重试重启、串并行、多Project；unknown与未跑项明确保留。

非UI需正式聚焦正向合同；UI禁止任何自动化、DOM（Document Object Model，文档对象模型）/源码文案/组件/截图基线测试，必须Root实际桌面/ui和原JPEG人工看。当前只改自己的隔离服务/页，用户进程不可动。需要真实Sol时auth/models配对且凭据可用、模型已投影、实际精确gpt-6.1-sol分别确认；原600s服务/20请求/180s无活动/60s收尾，不延长。不写凭据。每个fresh受控过程父600s、child180s、HTTP（Hypertext Transfer Protocol，超文本传输协议）请求30s、父60s收尾，原物理/输出/请求结算后原父清理。

工作树含他人FileExplorer、directory target、work-ledger、SDK（Software Development Kit，软件开发工具包）及混合README更改，保留不混入。所有本任务修改范围commit；正常钩子，fresh fetch/merge、完整pending集合核对、normal push，无新branch/worktree/rebase/force/tag/release。

压缩恢复先重读此Recall、最新精确授权、原owner/deadline与未完成项，不把405已结束scope重新启动或把403/404的Sol结果当本406模型通过。

## 三个独立可观察异常与证据

1. Task red04正式0pass/1fail/13assert：真实Task202、Research Studio合法包catalog/mounts200、自然Git基线、精确Question Permission Allow Once200；普通Question原Tool/assistant.activation→lease→runtime_process→操作系统exact_live。producer83728真实exit23并物理join，新65960正常Host恢复且old owner dead_or_reused；原Tool ProcessExecutionInterruptedError/time.end1791935846811，Question que_g0VXydjbi00suv3952UA与Board仍pending。第14 Board断言未运行，独立公开观察保留；原Asked已物化，不能称source-only。
2. live01原A86572/runtime62e6355f-0f33-4cda-a0ec-afc657ac92a8仍exact_live，B68708/runtime6f31006f-11be-411b-8feb-623e042582c9正常同runtime启动。B完整Question集合实际含A que_g0VXykEQe00vD1YaYAO0与自己的真实独立root control que_g0VXykG1o00CATWZiooI。B自己的原Tool/PromptOwner/回答/natural final成功；不是整个双owner控制通过。
3. 同scope Permission request per_hH5RlBJY02BuIhy7nBef、attempt per_h7QpS5pCf0kh4Bt0jMFu：requested1791937284978→allowed_once1791937285021→execution_started1791937285252→outcome_unknown1791937290052。B自己的bootstrap日志定位reconcile阶段，A仍活。A真实Question reply200/Board answered/Cedar/time1791937291555后，其Tool于1791937291757报UNIQUE constraint failed: permission_ledger.outcome_slot。答案已持久，失败为Permission执行/Tool结果结算。正式0/1/1只在child exits[1,1]失败，后续全集断言未执行；父与双child/provider/runtime均原闭合。

旧404固定ID、无Tool/activation的source-only red03只证明原接受事实枚举/物化缺口，不证明能重建普通JavaScript Promise。所有原失败及未知保持。

## Permission 直接触发、根因与影响

新backend/普通Project打开会触发lazy state或project/bootstrap的reconcileInterruptedAttempts；当前扫描全库started、只排除已有outcome和MCP（Model Context Protocol，模型上下文协议）持久task，直接写unknown。没有canonical Project SQL（Structured Query Language，结构化查询语言）过滤、原effect/physical owner、OS（Operating System，操作系统）观察或检查写入同事务CAS（Compare-and-Set，比较并交换）。原start先提交、原effect lease后取得，存在未绑定窗口；effect.owner当前随机call标记不是进程身份。120s期限/30s续租或最新SessionPromptOwner不能证明原执行者死亡。

原正常completeExecution与appendEffectOutcome严格比较effect fence并原子存result/terminal/release，是有意义的唯一成功/失败合同；禁止删除唯一约束、吞SQLite冲突、覆盖已有unknown为成功或盲目重执行效果。后续resumeApprovedContinuations已有Project和Prompt准入，但不能撤销此前抢写的terminal。

权威资料复核：SQLite同一数据库同时只有一个write transaction，BEGIN IMMEDIATE从开始取得写事务；独立连接只看到完整提交，旧read snapshot不能当当前writer事实。采用本项目已有immediate writer重验与同事务start/lease，而不是分开读后假设无竞争；不会在数据库事务里做操作系统等待。[SQLite事务文档](https://www.sqlite.org/lang_transaction.html)、[SQLite隔离文档](https://www.sqlite.org/isolation.html)。

共享影响覆盖：Main/Global Chat/Work/Side/非Task子Session、CLI（Command Line Interface，命令行界面）、ACP（Application Client Protocol，应用客户端协议）、channel/scheduler、Task-root/worker/专家团/Mission、plugin/Skill/Browser/Computer/外部projected、MCP同步工具和MCP App直接authority。MCP App不保证有SessionPromptOwner。MCP持久task需要真实server任务接续和明确lease handback；不能降为普通unknown或再次执行callTool。full_access与ask都受同执行合同约束。多Project扫描缺过滤为源码已证，实际跨Project进程尚未跑。

## Phase P 最小方向与批准边界

当前仅设计审阅，尚未批准生产或正式测试执行。候选先独立收敛permission/authority.ts：

- 现成joinProcessLiveness注册原runtime_process身份，effect lease owner取真实runtime occurrence，target仍exact attempt。ref覆盖admission到结果提交或真实MCP handback的所有分支；未获权、异常也完整release。
- 原immediate transaction同时重验Request/decision/attempt、取得effect lease并提交唯一execution_started，不再两事务窗口。
- 恢复用既有permissionRequestOwnerBelongsToProject限定canonical requested owner；事务外观察exact attempt原effect lease对应物理receipt。活、未知、缺合法身份均保留未terminal并明确诊断。
- 确死后同事务重验原start/lease ID/owner/MCPtask/outcome赢家，收敛真实unknown与原lease。expired原lease不能要求仍有效、不能假续期或伪造结束时间；正常已提交结果先胜。明确MCP handback与自然expiry区别仍须读原grant/release事实设计，Root追加批准前不实施。

不改generic lease/ProcessSupervisor/schema/config或公共Request。旧opaque/missing owner不能补猜或做兼容restore，保留原定位和明确未证明死亡。需要扩大合同先把缺失事实/影响写入此spec再批准。

## Question 后续阶段：方向已分析、生产尚未授权

唯一accepted Asked源按真实Project分页枚举，先同原projectQuestion物化原请求/已存在terminal，再恢复原业务执行者。删除Project-only无条件Question.restore和waiters为空的并行A2A分类；真实A2A（Agent-to-Agent，代理间协作）只由原action/epoch/Tool接受事务和exact reexecution重入原Question Promise，固定requestID本身不授予持久接续。

普通Tool只有原physical owner确死且原Tool实际写入合法interruption时，才能按同Project/Session/message/call源与已提交Tool.end发布原唯一infrastructure terminal。原terminal先赢、原时间/答案/userInput保持；必须覆盖Tool中断已commit而Question terminal前crash的重检。无Tool/opaque旧记录仅保留Asked/Board并明确缺恢复权威，不造terminal或空waiter。

Task-root expiry caller与后续reducer都需同原physical owner保护：只阻止terminalizer但仍让后继按expiry激活不完整。Task worker必须原Message/WorkerTurnDescriptor/dispatch lineage，Mission须原lifecycle/frontier/wake准入，不能最新Session/Task owner代替。当前六候选生产路径见只读稿；任何新增reducer/fact-store合同先精确扩大分析与批准。普通Session当前physical pending与404正确契约保持。

## UI 调查方向：当前只读

405原Main/Side截图和真实AX（Accessibility，辅助功能）名都见CedarRecord/IrisRecord粘连；Dialog视觉有独立标题/说明，但其辅助功能语义尚未独立实页证明。原inline控件是inline-flex，其label内部两span仍inline，gap只隔control与wrapper；Dialog专属grid布局分行。Kobalte现成Label注册还会拼接整段名称，不能只补空格/aria字符串或复制一套字段renderer。UI agent只读现有primitive/调用/样式，准备最小语义与布局方案，Root完整读后另加精确授权。不得修改Question数据/草稿/回复或运行UI自动化。

## 聚焦正向验收和交付

Phase P至少正向证明实际双backend各自Tool/Permission result成功、真实非空当前全集；同DB不同Project串/并行各自原ledger/result归属；same attempt并发与实际失败/abort/MCP handback；确死unknown、unknown/opaque明确保留全集/诊断、已commit成功原结果恢复。真正OS与owner过程不能由纯fixture冒端到端。已有裸started旧测试按当前原owner事实改正，不能因旧expect保留错误unknown。

Question阶段覆盖red04、双活、source-first、已terminal cut、真实A2A exact action接续、worker/Mission/reopen和多Project；普通固定ID夹具不当A2A。先聚焦相关正式checker，不全量bun test。每个scope以实际父/child/API预算和原结算为准，保留原失败。

UI阶段必须真实桌面/ui目标区域原JPG、人工看、再截图；类型/build与后台契约不能替视觉。需要真实Sol时先完整Provider/model/合法工具输入，再有限原生实际流式路径。当前406尚无实现、正式绿测、真实模型或新页面通过。

## Phase P 完整附录复核与精确实施授权

本方案新增索引与分析artifact后，原docs:check chunkd53f22退出1；Root读原stderr及当前Route/SDK diff，精确差异为并行file.list新增500 UnknownError而两既有生成API文档未同步，各一行。先保存两文档原源与既有diff（原diff空），仅执行package当前docs:api生成器，同一原docs:check重跑chunk08198a退出0（345ops/26groups）；没有改Route/SDK或消除错误契约。两生成行与当前file.list同源，待其原功能交付一起收敛，不混进本权限/UI生产scope。原失败/同步/重跑输出保存在plan-checks，不能用旧405文档0替406当前检查。

Root已全文读P1–P4补充，另核Database.immediateTransaction现成nested savepoint、control lease immutable grant与真实release实现。批准audit_functionality仅以下生产/测试范围，并先保存现状原源与原差异：

1. 生产仅packages/opencorvus/src/permission/authority.ts：原physical liveness reference绑定effect owner；exact canonical start+lease同一个immediate writer；canonical Project SQL限定；事务外原OS观察及事务内same start/lease/owner/MCP/outcome CAS。正常成功/失败仍原未过期fence；恢复dead expired不借该assert、不续期、不造lease，原expired时间不改，unexpired原release与unknown同事务。grant同exact lease最高ordinal；expires等grant仅自然expiry，少于grant才有明确release，MCP接续只原same attempt/taskId及完整physicalreceipt。missing/opaque/inconsistent只明确unknown，原错误/结果与唯一约束保持。
2. 正式正向测试仅permission-two-mode.test.ts及新增permission-execution-owner-process.test.ts/唯一专用fixture worker；不改通用Provider fixture或production hook。正常Ask/full_access/replay/result、当前owned start/lease/result全集、MCP原callback真实协议上下文同taskId、缺/opaque完整原事实/诊断。局部fixture或observer unknown合同如实限为局部，不当真实OS过程；显式operator reconcile旧测试是有效合同保留。已检索的control-lease-settlement负向核心测试不纳运行，本phase不触generic primitive；若后续触及则先报并正向替换。
3. 准备实际公开Session/prompt_async→受控流式Provider→真实webfetch→自有公开回环CSV资源的bounded过程helper。原HTTP/资源hold均≤30s；父600/child180/父60reserve。双活sameProject和双Project各自原结果/ledger/result成功；确死且lease未到期及自然120s真实到期后bootstrap未知结果，原Tool/lease/grant/OS逐一保存。首次新helper启动前给Root全文审与精确输入，不先起服务。现成正式集中测试/typecheck可原bounded runner执行，给原owner/deadline和完整结算，不跑全量或UI测试。

reference覆盖执行、renew清理、durable serialization、result/outcome commit、MCP handback直到全部结束；loser、throw、commit/fence失败均finally只释放本ref，不释放他人lease。结果持久化失败不伪execution_failed。旧错误unknown不自动覆盖成功。自然expired/live边界只明确当前合同，不用改时钟或造grant当真实过程。若此最小范围无法维持上述契约，先给实际缺失对象/数据/公开影响，Root落新增分析后才扩大；Question/UI、generic lease/process-liveness、schema/SDK/Mission协议目前不由此授权。

## Phase U 完整分析与精确实施授权

Root全文读scratch406-ui-analysis、亲读Checkbox/原生Radio、InteractionCard单/多选和base/Dialog两套CSS；复核16摘录/全部5组caller检索定位。准确根因是wrapper内两inline span并非gap覆盖的两个flex child，且描述位于命名Label后又被aria-describedby引用。已安装Kobalte0.13.11注册Label会追加name，不能只给Input补aria-labelledby。三个实际InteractionCard入口为CardParts/InteractionDialogHost/SideChatPanel；Checkbox八处JSX的其余消费者不输入新description，保持原markup行为。触及测试仅pure transport的type-only import，未发现UI自动化，不删除有效纯传输测试。

权威资料：辅助功能短名称与补充描述应分工并优先实际可见文字/原生Label；Label for提供浏览器原激活，不自造点击或键盘切换。[WAI命名与描述](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/)、[HTML Label](https://html.spec.whatwg.org/multipage/forms.html#the-label-element)、[Kobalte Checkbox](https://kobalte.dev/docs/core/components/checkbox/)。当前安装源码是具体版本合并行为的事实来源，不把新在线版本反填本库实现。

批准audit_ui先存原源/已有diff，仅改三生产文件：InteractionCard.tsx的Radio可见短label稳定ID/原description引用与Checkbox独立description；ui/Checkbox.tsx复用Kobalte Label/Description，Description作为原生label for精确同Input稳定ID，默认ID一次createUniqueId，原caller inputID保持；删除仅此一caller的旧inputAriaDescribedBy定义/拆解/传递，与新Description唯一注册替换同步；styles/surfaces/card.css将原Dialog结构grid提到共享option，Dialog仅留原大间距/点击区域/hover/焦点，inline仍紧凑。RadioGroup.tsx、全局selection-control、Question事实/选择/草稿/回复/SDK/i18n及其他Checkbox调用不改，无空label词条fallback或隐藏原description。正常不含描述行不留空布局，长原文在原窄Side可换行。

支持检查仅现有Overlay typecheck、CSS token checker、独立Node/Vite私有build，原600s检查scope及完整物理结算；无UI自动化/DOM/字符串或formatter tests。新bundle到406/ui-after，不覆盖405。Root真实single/multiple、Main/Dialog/Side、keyboard/description点击/disabled/no-description/长原文、语言与既有非Question Checkbox人工验收仍须另freshhelper。helper准备可复用原mature405源码，保存preimage；全新406场景声明Question业务120s（合法新输入，不续延任何原30s请求）、服务600/HTTP30/Side prompt180/60s收尾，保持原流式受控Provider和公开合法Global Chat/Side接纳。仅准备不启动，Root先读精确参数/源码再批准首次页面。缺同scope时间就正常关闭并保留未满足，不延时或改已有Question expiry。
