# 调度结果的可见会话身份

## Recall

持续单开发agent迭代，不启动Codex子agent。469为progress：b0c05631f4b8a3dca7b4539073b460b0edea862f已正常push/fresh fetch，当前Sources双成员第2/3行、copy/open同文件、原普通成员新流4392字符和All agents往返有10张实际人工截图。4/预设4实际Sol全部200/stream/EOF，原73809 HTTP200/exit0、native21663/公开shutdown200、Host88316/Target83572/physical/output/request/launcher和runtime/private完整对退休；tab20关闭。完整133 Project/179 Session/schema2，基线132/178全部身份/目录/归属及原成员12 Message/29 Part原始行保留。仅原.bun/和packages/opencorvus/bun/未跟踪；配置性能、未采样Rendering、事件结果入口仍待处理。

已读468/469 Recall、当前02-data版本化迁移/保护/构建隔离合同、03-control和17-platform调度职责、AGENTS；全仓精确搜索EventService.create/createFromTool/executeWake、AutomationService project/global/session/worktree与ensureAutomationTargetSession、SessionWake全部生产调用及newConversationExperience、Chat/Work identity/factory/路由/Work Ledger投影、Session message identity/overlay、registry/migrateSchema/Database.Client完整性、现有Event/Automation/迁移/Work Ledger测试。沿用benchmark-debug-template；界面调试已授权IAB browser2。无UI自动化。

## 修改前根因与影响分析

468真实原生HEAD事件产出fire cal_g0VYa3Gwj002if3yEaBV和Session ses_g0VYa3Gwj003t2ichNvt，真实assistant完成EVENT468READY，但按Chat打开返回404。源代码证明Event未绑定Session时用Session.createNext(kind assistant)创建无conversation metadata的根；schedule.create_event同样不传sessionId，createFromTool不补目标。Work Ledger的唯一当前查询只选conversation.surface=right-sidebar且experience为chat/work，打开路由也验证相同身份、Project/directory/lineage。问题是结果创建未进入产品会话合同，而不是模型失败或应放宽Chat路由。

横向搜索发现项目级Automation local/worktree也以同样的ensureAutomationTargetSession创建plain assistant。全局Automation已使用canonical global conversation creator，绑定Session/delay、Task与Mission保持原目标；Global Chat、Panel handoff、continuous Goal和scheduler-message生产调用都传原Session ID。SessionWake自身可省略ID的通用分支已有显式newConversationExperience，但当前生产调用均传ID，不盲改其通用合同。此前修复的是调度上下文/lease/receipt，本轮身份缺口在那些执行成功之后仍然存在。不是新的排队、重试或终态异常；不改变Task/Mission occurrence、预约、权限、容量和原恢复所有者。

范围：Event和项目Automation的新根创建、其既有历史可见身份、不可变Automation身份helper的共享调用、DB registry/当前数据校验、Work Ledger/Work路由正常输出、测试与当前数据/控制架构。无新UI布局、路由旁路、兼容reader或影子列表。所有原消息、角色、来源、权限、目录、Session ID、时间、回执和标题保留；未来根标题采用原job.name，避免把长prompt与固定Scheduled前缀作为标题。已绑定的目标完全沿原会话身份。

## 实施方案

1. 先扩展原Event生产wake正向合同，核对新Session的canonical Work metadata、原target ID/Project/directory与Work Ledger行；新增项目Automation同义正向用例，覆盖真实定义/run和原创建路径，local hook仅隔离模型执行，不冒充端到端。先保存原失败再修改生产。
2. 两处新根创建复用createRightSidebarConversationSession("work", {id,title})；不另造metadata工厂，不放宽路由/可见列表过滤。保持SessionWake原生产路径，当前Work overlay提供其真实Work身份和原权限策略，原Task/Mission目标不转型。
3. 追加数据版本3，复用版本2完整不可改写目标DDL（结构无变化），以同步语义迁移补既有独立调度结果的Work身份。Event只认原fire.created_session_id及exact definition project；项目Automation只认exact run/revision/project与现有deterministicAutomationID("ses",runID)。将该真实ID算法原样移动到无运行初始化的共享模块供生产和迁移使用，原定义删除，不能重算或改旧身份。迁移只处理assistant根，保留所有其他metadata键和原时间/标题；有效既有Chat/Work身份保持，冲突身份返回明确迁移错误，不猜测覆盖。删除过的Session不复活。当前完整性检查使用同一明确候选/身份合同，legacy缺失和真实冲突分别提供既有DATA_MIGRATION_REQUIRED/DATA_INTEGRITY_ERROR语义。
4. registry连续追加3；原1/2条目和SQL不改写。迁移沿现有WAL/EXCLUSIVE/事务/备份/完整性/解锁执行；新库直接当前3。构建/类型检查继续只在内存校验3，不用用户数据库；版本3是明确的持久化身份演进，不把schema applied日志当作结构DDL变化。真实用户18571及其DB/进程不操作。

## 验收

聚焦正向合同：原Event/Automation失败到通过；版本2真实文件在正式迁移器升至3，备份保留原版本/行，原Message/Part、Session身份/目录/标题/权限/时间及其他metadata完整保留，exact Event/Automation根获得Work身份；有效Chat/普通根和绑定目标保留；冲突身份得到精确错误并回滚；当前版本完整性得到正向错误合同。现有permission 1→当前链、schema opener/并发物理锁/恢复与Event/Mission/crossProject/Automation retry/definition target合同按相关正向case运行，不无目标全量bun test。遇UI自动化删除不运行。

真实服务先保留自有QA133/179/schema2完整基线，启动当前开发native服务18785，467当前正式UI（纯后端修复不重build），实际自动迁移原历史、检索并通过产品打开原468结果；再公开API创建新的oneShot HEAD事件，实际OS写回原字节、生产wake、流式Sol完成EVENT470READY，新Work行可从列表打开，来源/原结果仍保持。项目Automation通过公开API有限manual run核对同一Work路径。若实际scope与预期不同如实记录，不伪造事件/消息。全批预设最多10实际gpt-6.1-sol流，同一scope累计，不扩运行预算；完整auth/models一起复制并分别预检凭据/目录/实际model。新tab、截图人工查看，无UI自动测试或独立Vite。Provider/native/output/request/launcher全部结算后公开shutdown、日志归档和完整复制对退休；readonly历史与备份核验。

更新三索引、当前架构和产物，docs:check/迁移检查/typecheck及必要check；所有本任务改动范围提交，fresh fetch/merge、完整upstream..HEAD审阅、正常push/fresh fetch。不开branch/worktree/PR/tag/Release，整体goal保持active。

## 原失败与聚焦修复证据

原64410 exit1，两个扩展正向合同都失败：Event和项目Automation的Session.metadata为undefined，标题分别为固定Scheduled加长prompt；原fire/run本身成功。baseline.log保留精确Session/Project/目录和输出，旧468真实UI404作为可见缺口的先证。改为现有Work工厂后，Event完整11例/26断言和Automation target完整3例/50断言首先通过。原Automation ID函数只移动到纯共享模块，原函数删除，协议和32位摘要切片不变；该摘要来自真实不可变run身份，不作为源码/文件验收门槛。

新迁移测试初次fixture遗漏Project.sandboxes及generation必填列，补齐正式物理合同后重跑；第二次发现新查询的INDEXED BY依赖在迁移回调前已被框架移除，实际事务正确回滚并生成原备份。删除该索引提示，保留同一查询，由正常查询规划器选择现存索引；无查询fallback或框架改动。migration-recheck.log中正式生产opener的2→3/备份/原行、冲突回滚和当前缺失/冲突4例21断言全部通过。原失败日志保留，未把fixture错误或回滚当作迁移完成。

候选身份查询先通过唯一Chat/Work解析器跳过有效根；只在缺失/冲突根中，以原Event FK/Project或原Automation run派生ID/Project确认真实owner。Automation固定ID namespace仅缩小候选查询，不能单凭前缀赋予身份；正常全部有效时不扫描历史run。生产当前完整性和版本3转换共用该事实读取，迁移无Bus/模型消息、不变更执行排队或已有input。

真实服务启动前，readonly SQL和serialize已保存原133 Project/179 Session/schema2及全部原Session/Message/Part/调度/权限图；只发现原468 Session ses_g0VYa3Gwj003t2ichNvt缺少身份。该reader只导入纯身份/SQLite模块，断言仍为2，未求值Database.Client或升级库。原序列化副本与图在私有scheduled-result-visibility-470目录，后续用于真实备份和保留核验。当前尚未启动自有18785，先等待完整迁移/权限/调度回归和typecheck。

## 真实验收发现的历史执行身份根因与追加方案

第一自有scope18785已通过真实2→3启动和模型预检；新Event/项目Automation都完成真实Sol回复，UI列表点击可分别打开EVENT470READY/AUTOMATION470READY，两张截图已人工查看。旧468结果列表与Work打开200，但点击后正文/session/:id/conversation返回500并回首页。请求1142a435-bb1a-4969-8b84-7609eae8b95e的原生日志确认overlayMeta报“agent coding does not match persisted agent work”。最初迁移截图仅是列表可见，原文件migrated-original-result.png需改名，不冒充正文通过。18785已公开shutdown200，原29468 exit0，physical/output/request/launcher全部终结，原始buffer日志已在再次启动前归档。

全仓搜索persistedSessionAgentID/persistedExecutionIdentity与全部调用：message-bridge用户/assistant/删除快照、lifecycle-projection、Task execution projection；session-mirror/session通知和Task agent ledger不带input；WorkerTurnDescriptor仍有其exact projected identity。当前pure resolver先取可变的会话Chat/Work metadata，再读不可变执行输入，导致增加可见surface后把旧coding事实重解释成work。466曾正确移除generic assistant→coding假定，但仍将当前conversation metadata绑定所有历史occurrence，迁移实际运行才揭示这一剩余错误。不是SSE丢失、队列重试或侧栏点击所有权问题；不修改UI选择guard或放宽错误。

追加修改：assistant occurrence只在exact Worker descriptor之后，从该次已持久化用户Message（删除时为原event snapshot）的显式agent解析身份；当前会话metadata只用于没有execution input的Session通知/空容器。Worker/fixed role和跨Session输入验证保持同一合同。新输入仍由server/routes/session、SessionWake、panel和prompt parts现有真实身份解析/Chat Work overlay产生，后续Work请求仍是work。删除“当前metadata改写所有历史occurrence”的旧合同，统一历史投影事实来源，不新增历史分支、双读写、消息补丁或兼容标记。

先扩展原execution-actor测试，覆盖同Session旧coding输入/assistant、后加Work surface、新work输入、三种terminal/retry及重开，原消息保留；原以metadata拒绝历史不同actor的断言过期，改为明确保留实际输入actor。保留跨Project/跨Session精确错误、helper/receipt真实参与者和fixed Worker绑定。真实再启动18787复用同一已升级完整DB，预设该scope最多6实际Sol（第一scope实际4/10，合计最多10），只做预检和历史打开/后续公开路径，UI仍467正式构建（纯后端变化）。不得延长原scope。先在正式checker验证，再原浏览器新页面实际打开旧/新结果和原Task/普通成员，截图人工复核。结束仍执行完整原生结算、完整复制对退休和原数据图/备份核验。

## 完成证据与边界

history-identity-baseline原50989 exit1，两处历史metadata覆盖actor的正向用例失败；移动同一resolver的assistant exact input优先级后原29330 exit0，7例20断言。三种重试/terminal、消息投影、加Work surface和重新打开均保留coding/work/chat实际actor。原跨Session错误、helper身份及固定Worker descriptor校验保持。后端最终typecheck原91825 exit0。加此前6文件59例311断言，相关7文件共66例331断言通过；不重复运行无新失败的全量测试。

18785的真实Event cal_g0VYaJuaD00Q1IgUIYcI、Session ses_g0VYaJuaD00Fnn34urNe和Automation atr_automation_8c13ba3c9f70199220c381e0d5dc4731、Session ses_automation_5aadd9670a9db59502d4a858530b73aa均由真实Sol完成且实际列表点击打开。Event原HEAD字节恢复/保留，oneShot已结束；Automation2099有限规则先paused再manual run，结果保持且仍paused。

第二原生scope18787完整预检通过；旧468结果点击实际打开原coding/EVENT468READY。页面输入msg_2a12811b-7e80-471a-afd9-c3a119ac3aa6得到真实work assistant msg_g0VYaNRsO00pkTg37Ead/MIGRATED470WORKREADY/stop。公开hydration同时返回两个真实actor；自有页面刷新后新旧完整恢复。原Task Goal、普通成员及其read/README.md L2–3实际页面截图正常。共9张人工查看截图，无UI源码修改或UI自动测试。原对“UI选择Abort”的猜测由500实际日志排除，没有改UI selection guard。

第一scope实际4个、第二实际4个Sol，共8/整批预设10，全部200/stream/source-reader settled/EOF。两个原生scope均公开shutdown200，原29468/65486 exit0，Host/Target/physical/output/request/launcher结算，buffer日志在再次启动前分别保留。两个runtime auth/models完整复制对均退休，私有完整对在实际秘密值扫描后退休；源metadata未变，无refresh/exchange，自有tab21/22关闭。原用户18571进程/窗口/数据库未操作。

readonly最终135 Project/183 Session/schema3；原133/179每个ID/归属/目录保持。正式2→3备份与原11表图逐行（含rowid、权限、标题、时间、原消息及part.data）一致。当前原图也逐行核验；只允许旧结果新增Work metadata，及本次实际UI后续输入经已有prompt/run.ts更新同Session的工具开关Ruleset和time_updated。collector第一轮把后续输入的合法Ruleset变化误当作迁移变化，已核对原writer及真实input.tools后按该正向契约重跑通过，没有改产品或“放宽为任意当前值”。原消息内容/作者/时间完全保留。

[产物入口](../../artifacts/2026-10-20-scheduled-result-visibility/README.md)保存真实结果、原失败摘要、9图与两scope完整结算。当前静态Sources图不证明所有瞬时Rendering已经消失，配置耗时和未采样并发场景仍继续。整体goal保持active，不把这一批提交当作总体完成。

交付前docs:check原46079 exit0，实际345 operations/26 groups；architecture-index exit0；真实暂存index的module-topology原46666 exit0，无新增循环。前一个“默认HEAD检查”与不支持tree object的调用没有用作当前改动验收，最终明确使用--index。当前main，上游origin/main fresh fetch无远端新增；仅本任务34文件，原.bun/与packages/opencorvus/bun/未跟踪保持。下一步范围提交、upstream合并/完整待推送集合复核，并执行正常push的完整hook。
