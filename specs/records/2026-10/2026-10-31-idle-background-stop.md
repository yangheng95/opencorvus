# 空闲对话后台活动停止与项目转换引导

## Recall

用户要求单agent持续自主体验和改进，真实UI（User Interface，用户界面）交互/截图复核、聚焦正向合同、范围提交和正常同步推送；明确的后续单agent要求覆盖旧Goal多agent文案，不委托。上一轮824是progress：a83a610cb与198bd0a31已推送，2026-10-30T22:03:46Z main/upstream 0/0；44普通文件干净、三索引行各一次，182项其他改动保留。浏览器转换父目录、连续Dialog焦点、已提交搬迁后的原Sources读取修复已真实验证；37后端正向合同，四scope正常物理结清并退休配对认证。最新project-organize-824-verified有schema9/92表214198行，75附件、原十项目/28 tracked、十三原文件/另十七文件保持，另有824实际命名项目的六真实消息、两read来源和八文件。累计模型请求1112，单次Dependabot重扫授权已消费，不重复；用户18571真实服务/数据库/窗口未操作。当前本轮开始再次检查git status，源代码干净，外部记录/媒体清理改动保留。

已读当前AGENTS、824 Recall/实施/交付与物理数据回执，当前02-data的standby所有权、03-control的精确input取消与idle保留、07-panel的所有权与可见idle区别；WorkLedger.canStop/stop确认、ProjectLedgerGroup错误边界、main.stopWorkLedgerChat、conversation-session.stop、ApiError/body、transport WorkLedgerChatStatus定义、work-ledger projection与resolveSessionActivityStatus、routes/session abort及engine/cancellation-scope、engine/runtime guard和promote route。全仓搜索上述公开定义/调用、已存在的typed error UI模式、owner guard生产入口、同语义停止与取消/standby正向测试。原生浏览器能力沿824实现，不改。

## 分析与影响面

可观察现象：824实际gpt-6.1-sol完成回复且六请求EOF（End of File，正常流结束），界面显示非进行中；确认转换返回409 OwnedPromptControllersError，详情是Owned prompt controllers exist。手工显式调用本次QA会话公开session.abort得到200/true后，相同UI转换成功。侧栏及顶栏实际菜单无idle停止入口。Root原因不是生成卡住：loop.beginStandby正常发布idle并保留waitForUserMessage；02-data明确可持有物理Prompt owner，Project维护保护按进程本地精确Session→Project判断，不从显示状态猜物理存活。WorkLedger的chat停止菜单却仅在status===active呈现，把可见生成状态当成用户操作是否可用；后端projection有active/idle/terminal三个真实状态，idle本来允许独立的public abort并保留已发表input事实。ProjectLedgerGroup将所有失败统一呈现“未能确认操作结果”，typed 409的明确原因和下一动作藏于技术详情。旧824只释放QA待机以完成Sources实测，明确记录此入口缺口，没有伪称修复。

现状横向核对：Task停止沿taskCanStop和Task域取消，Mission沿interruptible与子Task，独立Chat/Work经现public Session abort；取消、等待、receipt/reuse顺序归engine/cancellation-scope/SessionPromptState，不改调度、队列、唤醒、终态或跨项目owner归属。全部owner检查生产入口是project conversion/initGit、project app mutation和global mutation；保留它们。暂无调度异常新证据；若真实运行出现异常，立即按AGENTS横审全部Task/Mission/Session执行轮次、终态/重试恢复/串并行/多项目，不能把它降为UI问题。

公共契约/数据：本轮只改UI动作资格和呈现，复用已有coding/:experience/session/:id/abort及其共享Session取消writer与promote API（Application Programming Interface，应用接口），不新增backend路径/SDK（Software Development Kit，软件开发工具包）/schema/持久格式、物理状态副本或自动停止。所有LLM（Large Language Model，大语言模型）交互继续streaming。Message由真实用户/模型/工具自然产生。旧Task/Mission/终态/归档规则保留；后台活动停止只面向未归档的active/idle Chat/Work，terminal仍无此动作。idle表示动作可以执行，不宣称该会话必然有物理owner。停止先经明确确认、可取消，操作用当前API authority及原Session/kind/directory身份；返回焦点归实际行，不自动停止整个项目或其他会话。

## 实施前方案与验收

先从已退休824-verified完全续存idle-stop-825-before/38437，固定普通前端资源main-kEyQ-FOW.js。配对复制授权auth和完整models，分别验证OAuth、目标gpt-6.1-sol投影和实际模型完全一致；秘密不进prompt/日志/spec/commit。第一scope原生启动时建立60分钟绝对deadline，候选与复核共用，不因观察超时重启或扩时，至少五分钟结清余量。本批总最多六模型请求，预检/记忆等辅助全计入，从累计1112开始；before可用总六，after仅取得剩余额度，不能叠加。通过全局新对话实际选择gpt-6.1-sol并发送只回PREFLIGHT_825_BEFORE_OK的可见预检，不创建Task/子会话/agent、不联网/安装/Git/命令。实际验证idle菜单和转换409；只操作本轮新QA项目，不搬迁此前十一受保护项目。记录完整模型/会话、持久owner与请求事实后正常关闭/退休before。

实页复现后实施：WorkLedger对未归档active/idle Chat提供停止动作，idle显示“停止后台活动…”及明确保留记录、可发新消息继续的确认；active原停止语义、Task/Mission不改。确认用精确Session/kind/directory及API authority，复用既有确认与返回焦点primitive（基础组件）。转换动作的精确owner=promote:directory且ApiError.status409/body.name OwnedPromptControllersError时，显示本地化明确标题和停止相关对话活动后重试的操作说明；保留完整技术详情和诊断。不是英文关键词匹配、自动停止或绕过保护。中文旧“实名项目”菜单改为“命名项目”，与真实named概念一致。其他未知错误仍归现边界，不能声称已知提交失败为成功。

普通前端build/type/双语与docs检查后冻结after/38438，开发原生serve提供/ui，不另开Vite。用另一个本轮新QA项目做可见实际模型预检PREFLIGHT_825_AFTER_OK（仍计入总六），其原物理owner进入standby后，确认转换出现可执行typed提示；检查停止确认默认Cancel、取消后继续返回保护；再实际确认停止，核对原完整消息/idle发表事实保持、精确abort请求及物理owner收敛，再真实转换该新项目至本轮新fixture命名目录，核对同一Project/generation/Session、完整文件/Git和原对话。中英菜单/提示/确认、键盘焦点、终态/旧Task/Mission动作及824原Sources至少实际回归。未实操分支明确标注；不操作用户原生应用，原生Tauri选择器排除本轮实操范围。

纯UI改动不新增/修改/运行任何UI自动化测试；真实截图逐张实际呈现人工看，类型/build/DOM（Document Object Model，文档对象模型）文本不替代视觉验收。后端运行代码若因新证据必须改，先补根因与正向真实契约；现取消合同可按相关正向案例精确筛选验证，不用mock（模拟）代替端到端。

数据/交付：复制原DB（Database，数据库）并保存readonly baseline。保护旧十一QA项目的Git/28 tracked、75附件、十三+十七原文件及824八文件/六消息/两来源，另保护before新预检完整两消息与文件。92表逐列比对，只有新模型/维护真实事实及精确容量槽位按实际owner writer证据解释。after新QA项目的显式停止和搬迁属于本轮授权样本，旧业务事实不改。服务public shutdown200、原exec/native/launcher0、物理/输出/请求和OS（Operating System，操作系统）出生身份结清后退休配对副本；原auth元数据/models字节和元数据保持。同步本记录/证据/当前架构/三索引，正常docs检查，范围提交、fresh fetch/普通merge/完整待推提交审查、正常hooks push及fresh0/0；不新branch/worktree/Release/tag/PR，长期Goal保持active。

## 当前基线实页复现

38437/main-kEyQ-FOW.js新全局Code/Chat真实预检产生Session ses_-zUQQNSS4zzLa7R7hxmg、Project prj_h1J8vbtXmLPCKFONrwMa，两个gpt-6.1-sol streaming/200/EOF请求，只有两条自然消息和六默认文件，末回复PREFLIGHT_825_BEFORE_OK。持久agent.execution.lifecycle明确streaming→idle，session_prompt_owner.owner_pid20508与本次native匹配；行菜单03实页只有Pin/Archive；转换明确返回409 OwnedPromptControllersError，05普通摘要未给出可执行动作、06技术详情确认同一个请求。04仅请求中间帧已明确命名pending，不冒充错误结果。旧Task/Mission/Chat/Goal/原Sources与824六消息、两94/90字节来源完整HTTP保持。页面97关闭后public shutdown200，原exec58760/native/launcher0、物理/输出/请求/出生身份结清，配对副本退休、原认证/目录保持；余3203381ms，同一deadline1793401846919。before用2/6请求，累计1114；候选只可用剩余4，不叠加额度。

最终实现范围保持上述方案。停止确认的归属直接捕获API authority及同一Session id/kind/directory，并在排队打开、提交后和返回焦点时核对；不引入第二物理owner状态或以row对象身份阻止正常刷新。typed错误映射匹配精确动作owner=promote:directory、HTTP409及公开错误name，不匹配英文错误正文。保持原技术详情、Task/Mission取消语义和后端guard。实现只触及WorkLedger、ProjectLedgerGroup、双语文案及当前架构，无backend/格式/API结构变更。

## 续行时的物理窗口调整（候选启动前）

2026-10-31T04:19:46Z继续时，距基线实页/退休已约六小时；重新读取retirement/物理回执并查询端口38437/38438，基线已在2026-10-30T22:17:31Z正常退出和退休，两个端口均无listener，候选从未创建或启动。原batch-deadline1793401846919已过，保留该文件与原始结清证据，不能据观察过期重启原进程/改写旧deadline。先完成before逐表/文件资格并构建当前候选，再为这一个从未启动的候选建立独立60分钟verification-deadline，至少五分钟结清余量；任何候选后续复核共用这个新固定窗口，不续期。这是已退休基线与首次候选之间的续行计划调整，原先“全批同一墙钟窗口”验收未达成，不能声称达成。总模型请求仍严格6，before已用2，候选及后续合计剩余4，不新增额度。原用户18571不操作。已检查当前peer HEAD27c250c40，不相关L01与媒体清理工作保留。本轮代码尚未提交，先验证再范围提交/正常推送。

候选构建前类型检查发现stopLabel重复读取row()导致联合类型未收窄（TS2339）；已改为捕获同一个current，原typecheck重跑types-repair退出0。最后构建包含该改动及精确侧栏提示。候选额度仍4；在两请求预检之外，如剩余足够，将在显式停止/搬迁后发送可见只回复PREFLIGHT_825_RESUME_OK的消息，验证文案承诺的继续能力；所有辅助请求仍计入总6，不追加额度。若实际到达额度上限，保留明确未覆盖边界，不触发额外模型调用。

## 最终体验、真实请求与数据验收

候选main-D8vP1FAa.js/38438实页完成：08英文空闲行出现Stop background activity；09确认框默认Cancel且说明保留记录；取消后回原行，持久owner完整匹配、原两条消息及整个snapshot保持。10与12中英typed提示明确侧栏的停止路径并解释idle可待机；11“转换为命名项目”语义正确；13/14中文入口与默认取消/明确停止。两次真正确认均由浏览器发送POST /coding/chat/session/ses_-zUQOl0aXzzkhjbfWmI5/abort，origin localhost38438、diagnostic=false。它是现conversationSessionPath按experience=chat选择的公开入口，RightSidebarConversationRoutes→closeRightSidebarConversationSession→cancelSessionPromptInScope/awaitSessionPromptFinishedInScope，与通用/session/:id/abort共用取消/await writer；实际调用不应误记为通用路由，初版私有打包检查器因此匹配零请求，改为精确现路径后两次请求均核对通过。生产没有新增路由或绕行。

第一次确认后原两消息逐part保持、owner释放、同一个input仍idle，没有把已完成回复改为aborted；随后第三次真实UI转换成功，Project prj_hv9yeLtFqfum0wy5GM3A及generation、Session ses_-zUQOl0aXzzkhjbfWmI5、六原文件和Git head/ref/index/status保持（15）。16在这个搬迁后的原会话发送新可见消息，实际得到PREFLIGHT_825_RESUME_OK，建立不同generation的Prompt owner；17从UI再次确认停止，四条完整消息保持、owner释放，第二input的已发表idle事实仍保留。两次转换保护来自未停止owner，第三次搬迁才发生。没有host自动停止、隐藏模型消息或为通过保护删会话。

真实model消费before2+after4=6/6，累计1118，包含两次after主请求和辅助记忆请求，全部gpt-6.1-sol、streaming、HTTP200、reader settled/EOF；两scope均exhausted=false。新项目继续后文件六→八，仅增加现CapabilityCatalogBinding.publish→AttachmentStore.write的capability-catalog.json快照和metadata，原六文件字节和Git状态完全保持，不误报模型违反只回复要求。

回归18原已完成Task交付页面、19原Mission历史（仅阅读旧已停止/失败事实，不是本轮执行或新调度异常）、20搬迁前中文历史Source实际打开原内容；完整HTTP再次保持Task68/Mission80/Chat3/complete Work8、旧README4/176字节、Web4/2来源、文件3/8来源、823预检2及Goal9/242063/1、824六消息与两94/90字节来源、原报告Goal12/380471/1。初次手工组合taskID与directory链接不符合当前导航合同，改经真实命令面板找到原任务并打开，未据此修改产品路由。

数据逐列资格before214198→214790、after214790→215866，始终schema9/92表；旧十一项目28 tracked、75附件、十三原文件及另二十五文件保持；before新预检完整两消息/六文件也保持。两scope各两个容量槽位按过期后复用，owner绑定本次native PID，变更字段仅expires_at/lease_id/owner_id/time_acquired，且释放早于初始TTL（Time To Live，存活期限）；其余旧业务各列保持。新增Project/Session、消息/记忆/用量及事件均为本次真实预检/停止/搬迁/继续事实。

两scope正常public shutdown200、原exec/native/launcher0、物理/输出/请求与OS出生身份结清后退休配对auth/models，原auth元数据及models字节/元数据保持。before余3203381ms，after余3141739ms；用户续行后首次候选固定verification-deadline1793425804787，没有延长正在运行的occurrence。原先跨全批单墙钟窗口未达成，已在候选启动前明确调整，不冒充通过。没有操作18571用户服务/数据库/窗口，不创建branch/worktree。

最终普通前端build/renderer退出0，类型首轮TS2339修复后types-repair退出0，双语2661键及docs通过。所有二十截图均实际呈现人工复核；纯UI改动不新增/修改/运行UI自动化，无无目标全量bun test。Task/Mission活动停止、归档终态菜单和原生Tauri未重新触发，本轮仅其原有代码分支审查/历史阅读，不扩大为完整域停止验收。待当前docs最终检查、范围commit和fresh fetch/merge/完整待推集合审查/正常hooks push；不发布Release、tag或PR。
