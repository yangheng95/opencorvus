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
3. 准备实际公开Session POST /:sessionID/message→受控流式Provider→真实webfetch→自有公开回环CSV资源的bounded过程helper。原HTTP/资源hold均≤30s；父600/child180/父60reserve。双活sameProject和双Project各自原结果/ledger/result成功；确死且lease未到期及自然120s真实到期后bootstrap未知结果，原Tool/lease/grant/OS逐一保存。首次新helper启动前给Root全文审与精确输入，不先起服务。现成正式集中测试/typecheck可原bounded runner执行，给原owner/deadline和完整结算，不跑全量或UI测试。

reference覆盖执行、renew清理、durable serialization、result/outcome commit、MCP handback直到全部结束；loser、throw、commit/fence失败均finally只释放本ref，不释放他人lease。结果持久化失败不伪execution_failed。旧错误unknown不自动覆盖成功。自然expired/live边界只明确当前合同，不用改时钟或造grant当真实过程。若此最小范围无法维持上述契约，先给实际缺失对象/数据/公开影响，Root落新增分析后才扩大；Question/UI、generic lease/process-liveness、schema/SDK/Mission协议目前不由此授权。

首次过程helper准备时发现方案原prompt_async入口错误，尚未启动。Root核对session.ts2058完整公开handler、全server/openapi搜索与8c23dd0e36969c17f7a5c1db2f7ca9dcc127fd91历史：当前仅POST /:sessionID/message等待自然最终200；592处类型残留不能授予已删除路由。批准只修helper为原owned pending HTTP Promise并发观察Permission/资源，保留单请求30s/原输入/原200和失败回执；保存错误helper原像，不新增路由、队列或延时。types02原exec18367 join0只证明类型，不证明HTTP合法。

## Phase U 完整分析与精确实施授权

Root全文读scratch406-ui-analysis、亲读Checkbox/原生Radio、InteractionCard单/多选和base/Dialog两套CSS；复核16摘录/全部5组caller检索定位。准确根因是wrapper内两inline span并非gap覆盖的两个flex child，且描述位于命名Label后又被aria-describedby引用。已安装Kobalte0.13.11注册Label会追加name，不能只给Input补aria-labelledby。三个实际InteractionCard入口为CardParts/InteractionDialogHost/SideChatPanel；Checkbox八处JSX的其余消费者不输入新description，保持原markup行为。触及测试仅pure transport的type-only import，未发现UI自动化，不删除有效纯传输测试。

权威资料：辅助功能短名称与补充描述应分工并优先实际可见文字/原生Label；Label for提供浏览器原激活，不自造点击或键盘切换。[WAI命名与描述](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/)、[HTML Label](https://html.spec.whatwg.org/multipage/forms.html#the-label-element)、[Kobalte Checkbox](https://kobalte.dev/docs/core/components/checkbox/)。当前安装源码是具体版本合并行为的事实来源，不把新在线版本反填本库实现。

批准audit_ui先存原源/已有diff，仅改三生产文件：InteractionCard.tsx的Radio可见短label稳定ID/原description引用与Checkbox独立description；ui/Checkbox.tsx复用Kobalte Label/Description，Description作为原生label for精确同Input稳定ID，默认ID一次createUniqueId，原caller inputID保持；删除仅此一caller的旧inputAriaDescribedBy定义/拆解/传递，与新Description唯一注册替换同步；styles/surfaces/card.css将原Dialog结构grid提到共享option，Dialog仅留原大间距/点击区域/hover/焦点，inline仍紧凑。RadioGroup.tsx、全局selection-control、Question事实/选择/草稿/回复/SDK/i18n及其他Checkbox调用不改，无空label词条fallback或隐藏原description。正常不含描述行不留空布局，长原文在原窄Side可换行。

支持检查仅现有Overlay typecheck、CSS token checker、独立Node/Vite私有build，原600s检查scope及完整物理结算；无UI自动化/DOM/字符串或formatter tests。新bundle到406/ui-after，不覆盖405。Root真实single/multiple、Main/Dialog/Side、keyboard/description点击/disabled/no-description/长原文、语言与既有非Question Checkbox人工验收仍须另freshhelper。helper准备可复用原mature405源码，保存preimage；全新406场景声明Question业务120s（合法新输入，不续延任何原30s请求）、服务600/HTTP30/Side prompt180/60s收尾，保持原流式受控Provider和公开合法Global Chat/Side接纳。仅准备不启动，Root先读精确参数/源码再批准首次页面。缺同scope时间就正常关闭并保留未满足，不延时或改已有Question expiry。

Root已全文审五个新manual helper、精确input/handoff、三源implementation.patch及原types/CSS/private build physical receipts；authority生产已由原agent确认冻结。批准Root逐一启动独立options-main-single-after01/main-multiple/side-single/side-multiple scope，明确新Question120s；正常公开Global Chat/真实UI创建Side，原600s/HTTP30/Side180/closeBy保留。仅真实人工动作、辅助功能观察、原JPG及公开Tool/自然final事实checker；不新增UI自动化或扩展到用户页面。Connecting与infrastructure历史、Question后端恢复以及本批Sol未跑仍保留未满足。

## Phase U 补充：无可见Label消费者的实际命名根因

Root真实Main single/multiple各自Dialog/inline原图与AX已经查看，短名/独立description、native ArrowDown/Tab/Space及description点击可用；Main普通真实回答Cedar/Tool completed/natural final/Board idle两个公开checker均0。多选Dialog实选Cedar+Iris；Escape后inline是另一个原draft，最终实际只Cedar。隐藏No description Input定位click虽返回成功，实际AX/原图仍未选中，根因尚未知；没有将它冒称两值提交或double-toggle，下一fresh页须点真实可见Label/Control补证。原图04文件名含two-selected只是预期命名，内容与实际Tool仅Cedar，归档须明确。

抽查Settings→Product→Chat→Available connections真实既有Checkbox：browser键盘Space勾选、公开GET /chat/capability与/config200读回assigned_refs=[browser]、mcp.enabled=false；再次Space取消，原refs=[]/两disabled配置读回。原Input checkbox-input-cl-395/401在AX无名称，带名称的却是group容器；全部六技能控件同样，原read-only关联JSON亲见Input aria-label/labelledby null、Root aria-label为当前英文产品字符串。不是空目录或Tool结果问题。

根因/影响：Checkbox只把class/children/inputID/description拆为local，余props进Kobalte.Root role=group；Mailbox两处、ConversationCapability两处当前aria-label均落到容器，真正可聚焦Input仅id。Root亲读已安装0.13.11的KSJIJAOF/HYP2U57X/YKGT7A57实际dist，Input fieldProps才消费aria-label，Root formControl字段不含该项。现有注册Label消费者为Question/FileChanges/Mission/Goal，其短名继续原Label注册，当前没有同一Checkbox同时显式aria-label与children的调用。此为同一primitive公开命名合同，不复制四caller的本地化文本，不造状态。

批准audit_ui仅在原三源范围内进一步改Checkbox.tsx：拆出既有aria-label直接传到唯一Kobalte.Input，Root不再收该属性；Description/ID/选择事件/其他consumer不改。先保存本次before及旧私有build，原type/CSS/独立Node build重新进入600s owner到新ui-after-u2；不覆盖任何原截图。Root再真实有Label/无Label、中英、pointer/native键盘与公开配置还原验收；原ui-after只能证明U1，不能冒充U2。旧Main未改Question恢复、原Base catalog500/skill mounts500仍保持诊断。

U2原exec13763实际join chunk7a4bdd exit0；原parent88432/1791940989490→deadline1791941589490，finished1791941048446，type67552/CSS90092/Node89444物理、输出、请求均结算0后runtime清理。Root亲读精确两行与最终scope receipts，批准按同五个已审helper启动新ui-after-u2的side-single-after01/side-multiple-after01及main-single-u2-after01/main-multiple-u2-after01；新Question120s/父600/HTTP30/Side180/60reserve均同原明确输入，无旧scope重启或延长。

## Phase P 过程helper预算审阅发现与修正授权

Root已全文审准备的process test/worker/run-formal及focused-test.patch、真实authority完整diff。当前wrapper原600s，但各case代码仅Date.now()+600s，child只clip本case，未把更早wrapper deadline送入case；README声称更早原父限制尚无代码对应，首次过程尚未执行。批准仅薄wrapper明确传本次原截止到唯一process test，case/child/HTTP/resource/setup均按原最早截止保留父60s reserve；不扩大product、generic runtime或延长任何期限。再次冻结完整diff/参数后Root再批准首跑。真实expired case等原120s自然到期，无clock/lease/grant修改。

Root复审budget-fix.patch全部三辅助源增量：只有唯一正式process文件接收wrapper原OPENCORVUS_PERMISSION_OWNER_DEADLINE_AT；case取原最早deadline，child再次校验≤原wrapper−60s，resource、HTTP、setup均原界限。types05原exec85030实际join0，62952/68e6bdfe-5fd6-420e-8932-ec2a0a48c7fa，1791941147862→deadline1791941747862，ended1791941203228，物理/输出/请求结算，production未变。批准audit_functionality首跑fresh process01/process-evidence01四case，正常包checker、原600/child180/HTTP资源30/reserve60、真实120自然expiry；所有原失败、源、Request/Tool/start/lease/grant/runtime/OS与最终result/原父闭合必须留存。仅自己的测试scope/受控流式Provider，无真实凭据或Sol、Question/Task业务结算仍未跑。

process01原exec9411实际join1，parent89420/child77044-dcc3f285-4cdd-4818-ac5b-8a79e7135a03，1791941467946→1791941639440，171.494s，原deadline1791942067946；正式2pass/2fail/32assert，两个dead合同pass。live正式均止于A账本数组多期待stale，B后续断言未运行；Root另亲读四a/b-completed原件，所有真实CSV Tool/durable result、各自POST200/natural stop/原Tool-message completed和Project requested全集均有证据。八child natural0或自有deliberate23，父/provider/resource/handler完整闭合。

Root亲读completeExecution443–510与retireMessageContinuations1310全部定义及全调用：Full access结果同事务stale；正常Ask结果writer只提交success+result/release，retirement是另一个以原Message完成与Tool outcome为准的writer，现有调用位于resumeExactContinuation和SessionLoop恢复4859。新process首次快照是正常Ask立即结果阶段，不能混入Full access的同事务stale。批准只修新checker此处完整数组为当前四个实际执行事件，再fresh process02/evidence02重验四case；不改production或Full access原合同，旧失败/源完整保留。

正常Ask已完成Message后retirement触发的完整公共保证，与security文档“完成后canonical writer关闭”的时机仍须共享机制横向审计；四原Message均实际completed而立即快照尚无stale，不能因P执行结果重测通过称该时机覆盖或偷偷改架构降低目标。要求agent只读覆盖normal/recovery/Task/Mission/Session所有调用、活/死Prompt与重启/多Project，另报精确触发与未证明项。P本次不扩生产范围。

process02原exec80030实际join1，175.250s，正式3pass/1fail/58assert；双live与dead-expired通过，dead-unexpired所有行为断言后在纯metadata导出body.model处抛TypeError。Root读原checker/stderr/owner和共享fixture全文：request.json捕获失败可合法返回undefined，强制类型转换没有运行时证明；原Provider stop已执行，随后resource.close/cleanup未到。八child物理/输出/请求已闭合且外正式父退出，managed runtime由外父清理；禁止补称缺失case正常收尾。批准只修该辅助源：按原unknown body形状记录明确bodyState及真正存在的model/stream/tools字段，原缺元数据不猜不跳过；先物理关闭所有自有Provider/resource/handler，再导出纯证据，finally保证原cleanup/managed收尾且错误仍失败，不吞或伪造closed=true。保留本轮完整失败与before，修后再fresh03原预算检查四case。

另查正常package checker入口：run-tests.ts默认枚举标准.test.ts并继承原隔离环境；专用外父deadline仅临时wrapper提供，包本身没有该变量。新test/worker若把它强制为必填，会使正常选文件及默认CI（Continuous Integration，持续集成）准入均报错，不能交付只在ignored helper可跑的正式测试。批准仅辅助预算声明修正：case始终拥有当次原600s；若caller确实提供outer deadline，严格验证后取更早值并完整记录，不提供则如实标明没有外父观测，禁止猜外父身份或延长已知截止。child仍原180/HTTP资源30/父60 reserve，worker校验真实argv子期限，提供outer时再次校验该约束。临时wrapper仍只为唯一process文件传自己真实截止，不改通用runner/公共生产配置，不跳测试或引入第二恢复路径。两种正常checker入口须分别聚焦证明，不能只types代替。

Root全文读retirement-timing-review，确认normal processor/updateMessage/finalizePrompt/release缺接线、Instance首扫flag与live waiter均不保证补扫；Task/Mission/全部生产入口和旧385仅恢复证明已横审。该共享正常退休缺口与删除后NotFound重扫风险（后者未实证）保留，待下一独立完成边界方案，不以本P执行结果绿掩盖。

## Phase U3：原生焦点几何异常，当前只读验证

Root亲看U2 Side-single原03 Cedar与04 ArrowDown Iris截图：后者连selector/goal/composer整块上移，05真实回答后恢复。原pending观察只有九祖先，不能据图判具体外层。Root亲读selection-control/Radio、已安装Input定位、全部question-focus-scroll-readonly分析，另Side-multiple实际五Input均比Control低565.333px（No description 890.198 vs324.865）。焦点输入与可见控件坐标已脱离；旧Main隐藏Input定位click真因仍未知，不声称double-toggle。

三个InteractionCard入口共用当前grid option且position static；nativeRadio和Kobalte Input均absolute/1px/clipped，Card/inner scroll/Side panel均static。更近positioned祖先为centerWorkbenchSideChat TabPanel的relative/overflow hidden，再往上rightDockBody同样；已有autoScroll对Input ArrowDown直接return，写入只inner transcript，无法直接移动chrome/composer。候选仅已owned card.css该option建立relative containing block；不加inset、JS焦点/计时/强制scrollTop、outer overflow绕行或generic第四文件。具体外层scroll变化和实际offsetParent尚缺配对证据，不先改生产。

批准Root先fresh options-side-single-before-focus02，同最终U2 bundle/原已审五helper/新Question120s/父600/Side180/HTTP30/60reserve；在实际description click与native ArrowDown前后，只读记录全部祖先到HTML的rect/scrollTop/height/position/overflow/transform/contain/will-change与Input/Control/option/offsetParent、原截图。保留真实Request/回答/Tool/final与原父闭合。该观察无DOM断言或UI自动化，不延旧scope；确认具体因果并补完整分析后再授权U3最小生产修改。

before-focus02实际完成pending及Cedar description两原图/全祖先观察：inner scrollTop567.333→273.333，可见Control y69.865→363.865，hidden Input y634.198不动，TabPanel scrollTop均0/scrollHeight831/client635；所有Input offsetParent读回null，只据实际祖先样式判断containing block，不把null反填DOM身份。上下文恢复后Question已自然终结，ArrowDown定位无匹配，未取得第三配对观测/用户回答；保留原失败，不延Question或复活旧scope。原Side prompt exec82545 join0；自己的页31关闭，relay实际shutdown、product exec12792 join0，父未超原期限。批准再fresh before-focus03仅补原ArrowDown全祖先配对与原回答，其余五helper/原预算完全相同；U3生产仍不改。

Root全文审process03-preparation两辅助源与完整增量。metadata逐原request保留真实bodyState；Provider/resource实际关闭先于export，cleanup出错仍AggregateError且原case错保留，managed删除只基于真实全闭合。原生产authority与two-mode冻结，types06原exec5962 join0。批准audit_functionality启动全新process03/evidence03的原run-formal四case，600/180/30/60原约束及真实120s自然expiry；原01/02失败不覆盖。普通package入口先准备一个仅NodeProcess owned_tree外监督的600s薄wrapper，调用原bun run --cwd packages/opencorvus test精确唯一文件且不传专用outer变量，给Root全文/精确环境差异与参数，未首审前不启动该第二过程；不改generic runner。

Root全文审run-package-entry.ts及package-entry-preparation精确argv/childEnv：现成supervisor/owned_tree，声明外部原600s，副本删除专用outer键，原包选唯一正式文件，原actual onSpawned/settled/output与命令结果完整保留；没有credentials读取或generic runtime修改。批准audit_functionality仅在process03原结算之后，启动fresh package-entry01/package-evidence01，正常包入口缺outer合同如实记录，与外部物理监督区分；原case/child/resource期限不变，全部准确闭合。若03失败先报，不绕过失败启动新入口。

before-focus03原几何已补齐：真实Cedar description点击后TabPanel scrollTop0、inner273.333；native ArrowDown实际Iris选中后TabPanel195.333、inner仍273.333，outer rightDockBody仍0，TabPanel本身rect/height不变，inner rect y233.333→38。原02/03截图亲见selector/goal/composer跟随整块上移195px，原04自然回答后恢复。Iris hidden Input y684.198→488.865但可见Control413.865→218.531，仍脱离约270px；绝对定位Input在innerscroll外的containing block是直接原因，原focus的浏览器scroll-into-view触发outer hidden scroll，并非Question数据/模型/Side会话状态或inner autoScroll写错。全部祖先原position/overflow/contain/transform/will-change记录支持上述范围；offsetParent仍实际null，不声称返回了TabPanel。

影响覆盖共享三个Question renderer的单/多选，原生hidden Radio与Kobalte Checkbox受同option布局；其它Checkbox消费者无option class。本改动不改变模型原文、选项值/disabled/草稿/回复/Permission/API合同或语言。根治仅让option建立absolute containing block，真实Input跟随自己的可见option进入同inner scroll。CSS relative仍在正常流中，不加inset、不改global primitive或native focus，不阻止浏览器焦点滚动。[CSS定位containing block](https://www.w3.org/TR/css-position-3/#def-cb)、[overflow hidden可程序滚动](https://www.w3.org/TR/css-overflow-3/#valdef-overflow-hidden)、[HTML focus API](https://html.spec.whatwg.org/multipage/interaction.html#focus-management-apis)。Root已读现有唯一selector/Radio/primitive/autoScroll/全部callers与历史原像，支持副作用限于共享option定位上下文；Dialog/Main/Side实际最终视觉仍待重新验收。

批准audit_ui仅在已owned card.css共享.interaction-card__option增加position:relative一项；先存U2原像/差异、保持其它两源冻结。按原600s type/CSS/独立Node私有build到全新ui-after-u3，保留U1/U2，不运行任何UI自动化。Root再用最终bundle全新Main单/多、Side单/多/原生keyboard、中文英文非Question名称和实际答案检查，特别复核Side selector/goal/composer位置与上部选项原图。原before-focus03 question que_g0VXzACKx00PxI2UTusD真实Iris Tool.end1791943505726、自然final msg_g0VXzAKg000HI3jLIF7U、Board idle，原checker7885b9 exit0与Side prompt37764 join0；page32已关，产品/relay原owner正常闭合，不把修前成功回答当修后视觉通过。

## 交付检查器登记影响补齐

Root亲读其它已授权交付的三份原push记录；八包types/routes/docs通过后control-lease-owners都在本工作区authority声明1/实际2拒绝。该检查器全文与全部全仓引用/历史已读：唯一DECLARED_OWNERS登记逐文件实际acquire数量与释放合同，扫描三个生产package并保持alias/direct-write识别。新P把原fresh admission的acquire放到start同immediate writer，保留原MCP接续acquire helper，实际同一permission authority现有两个effect入口。旧site计数不再描述当前实现，漏同步是本任务交付影响，不能由peer绕过或删检查。

批准Root只将同一checker的permission/authority条目sites改2，release说明补清两个入口共用terminal writer、真实MCP handback、物理确死unknown同事务释放still-valid lease以及dead expired原到期保持；目标仍effect。其它登记与扫描/错误合同不改，不造第二登记或调弱检查。先存原源/空diff，再进入package原check:control-lease-owners，实际明确owners/sites通过输出作为本登记的正向合同，P真实测试已另资格功能行为。phase03已原join0、四case/八child/各服务/handler/managed准确结算，正式4/0/58；普通package入口仍独立验证。

登记窄修原checker0e716e实际exit0，18 owners/23 sites/all declared；未改变扫描或错误合同。普通package-entry01在外NodeProcess创建child前失败（334b06 exit1，无onSpawned/业务）：监督器只给childEnv，当前process-node.ts112读取外监督自身process.env，成熟run-formal已有父env设置。原wrapper/source/owner保存；批准同成熟wrapper仅补外父OPENCORVUS_PROCESS_SUPERVISOR=原已核路径，在全新entry02/evidence02重验原600，仍不传专用outer给正式测试，不改generic runner或产品。原01失败不覆盖。

U3原exec80889实际join396b5f exit0；parent23680、start1791943670659/deadline1791944270659/finish1791943737703，type87932/CSS90764/Node69752均0且physical/output/request=true，原runtime随后清理。Root亲读handoff/单项及完整diff，实际只有option position:relative新增，其余两源为U2原像。批准Root按已审五helper、最终ui-after-u3启动全新options-{main-single,main-multiple,side-single,side-multiple}-u3-after01四个独立场景；原新Question120s/父600/Side180/HTTP30/60reserve保持，原图和实际选值分别记录，重点native ArrowDown后Side chrome以及多选上部呈现。其它Checkbox中英名称已U2真实确认，但最终U3再实际抽查。修后未看页面前仍不称视觉通过。

## 本批最终资格与保留的未满足项

P聚焦正式去重55tests/247assert：two-mode23/92、continuation8/25、message-settlement10/22、message-recovery6/39、process-liveness4/11及真实四process4/58。原03 exec50614 join0；正常package02 exec85562 join0、170.948s，parent61428→91024/a1b044f7-53d5-4a79-89b6-6ab808fb922c，原1791943710820..4310820、finish3881768。每入口八child[0,0,0,0,23,0,23,0]且各服务/handler/physical/output/request全结算，四managed目录正常移除。package02确实每case outerDeadlineObserved:false/wrapper:null，原900s generic不改；两个入口同四case复验不累计。Root读原final-handoff、owner/cleanup/原结果，原01/02/tool01失败均保留。

Root最终U3四真实1280×720桌面页及23张原JPEG亲看：

| 原scope | 真正操作与答案 | 原checker / 父exec结算 |
| --- | --- | --- |
| side-single-u3-after01 | Cedar description→native ArrowDown Iris；无说明可见Label→Iris description→Answer，最终iris；英文既有browser Checkbox Space选择/恢复与三次API200，Input名称正确 | e92e68 exit0 / 41527 joinfadd46 exit0；Side41340 join1667da exit0 |
| side-multiple-u3-after01 | 中文，上部Cedar/Iris各短名与说明、description点击、Space/Tab/Space、无说明可见Label、完整长文本/disabled/自定义草稿后清空，最终cedar+iris+no-description；最终中文8个既有Input名称正确 | 769137 exit0 / 9388 joina73650 exit0；Side53759 join2f11f7 exit0 |
| main-single-u3-after01 | Dialog native ArrowDown Iris/Escape；独立inline无说明Label选择后Cedar description，最终cedar；原五图亲看 | 4a56a1 exit0 / 37906 join0dc258 exit0 |
| main-multiple-u3-after01 | Dialog description Cedar/Tab+Space Iris/Escape；inline草稿输入/清空，再Cedar description+无说明Label，最终cedar+no-description；原五图亲看 | 848aa5 exit0 / 50684 joinbab729 exit0 |

四场景原Tool completed/自然final/Board idle均实际公开读回，Question原deadline内回答。每页在原closeBy前关闭，relay原shutdown与physical receipt、product原stop和原父output/physical join后runtime清理。U3 Side配对几何TabPanel scrollTop始终0、scrollHeight=clientHeight635，Input与可见control仅局部3px差，native ArrowDown只正确移动inner transcript；对照修前TabPanel195.333证据支持根治。英文Checkbox原05文件名含selected但内容是提交中旧0/disabled；真正接受1为06，07恢复0，归档不得混淆。旧U1Main多选04类似命名偏差仍明确记录，所有原图保留。

包含旧U1/U2四页和before-focus02/03在内，共十隔离页面；Root全部49原JPEG亲看。before02未完成ArrowDown/用户回答，原Question自然结束后未续期，不能纳修后通过。旧scope只有其实际bundle资格，不能冒充U3。所有页/服务已关闭，无UI自动化。原Settings skill/mounts500及Base catalog500诊断保持，不称console clean或Work/Mission创建成功。

本P/U有限交付不解决普通Ask完成Message后的normal retirement缺接线、Question Phase Q、Task普通Question死owner与双活恢复、MCP真实远端task、live跨原120s的真实效果、真实OS unknown或本批Sol。Connecting短窗口/基础设施历史视觉、原ASCII310 native cwd267、Task业务完工/result checkpoint、Work/Mission独立Question仍未满足。已有局部MCP/unknown合同不外推。下一独立批先以原retirement横审与Task/Q原红态落Recall/完整方案，再实施；无限goal保持active，不能因本批范围提交将总体标complete。

CHANGELOG仅新增未发布中英实质增量，产品版本未更新，无Release/tag/发布授权。范围交付须保存原证据、更新三索引精确406条目、当前docs/architecture检查、正常提交与fresh同步完整pending复核后正常push；原peer所有改动保持。

Root全文审P归档builder/ROOT-REVIEW/manifest与UI阅读摘要/精确allowlist。P616精确文件，16全config响应与16含config的HTTP原件及related01两行共4个完整Provider请求排除；17明确标记派生副本仅省略该body/requests，原对象/其他行与receipt保持，原件仍在scratch。UI109实施/支持源、原owners/diff/log，0图片，私有bundle和重复手动数据排除。两有限结构/敏感形状扫描0不冒已知凭据值扫描，未读auth/models；fixture源码固定公开key明确非凭据。

批准Root仅按上述清单及十自有manual页面精确top-file/relay/owner/原helper来源allowlist归档到fresh delivery01；所有49JPEG原bytes直接保存，其余gzip/readback逐字节仅证明归档身份。manual public-global-config及旧Main multi完整capability-before排除，不复制runtime/home/DB/模型/凭据/完整Provider payload。原before02失败与两份说明校正原像均保留，不能通过改名或派生省略抹失败。归档准备器无UI断言或产品操作。

归档Root原106e98 exit0，1096件/20,405,560原字节/49JPEG逐件保存与readback，后加五目录README及独立checks01。当前docs65d659/architecture3da842/owners504554均真实0，345ops/26groups、19current、18owners/23sites，原600s各physical/output/request结算。fresh fetch655ce2/merge650900均0：上游已正常包含79ee53039计划与peer完整交付，当前pending为空；不用旧列表猜远端或声称Root先前push已成功。源冻结后不重复已有绿测试/类型/build，最后正常push仍会进入全部现有hook。

Root范围prepare原d56629已0，1117路径，只含八生产/测试源与登记、两架构、406记录/原证据、四CHANGELOG未发布段与三索引406精确行；新checks组纳入最终重建scope。private index以最新HEAD构造，普通index仅精确own条目更新，保留其他sorted README/compaction等改动。实际提交/同步/push结果在下一批Recall承接；现在未先写成功。
