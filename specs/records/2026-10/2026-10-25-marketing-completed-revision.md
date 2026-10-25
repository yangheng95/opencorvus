# 原营销专家团完成后追加修订重验

## Recall

- 用户要求：继续把原营销专家团完成后追加修订的链路测通；正确准备依赖，在全新隔离项目重跑，深入分析机制问题，禁止用Base通过替代。此前原营销epoch2失败与Base成功分别保留，不重置旧额度或复制旧Task数据库。
- 任务起点源码main `1443c8482`；保留171项外来删除、两个索引既有排序修改及两个未跟踪目录。没有授权新分支、worktree、子agent或操作用户服务。
- 本聊天已明确授权本机OpenAI凭据及完整模型目录，仅新隔离项目、gpt-6.1-sol流式、每服务最多360次，不对外发布。不再次询问授权。使用benchmark-debug-template、documents技能。
- 已读：原2026-10-24专家团记录、2026-10-25 Word失败记录及完整原运行器；marketing-growth manifest、workflow、orchestrator、writer、fact-checker及typed Artifact依赖；当前Task生命周期、数据/隔离边界与正式消息入口。全仓搜索定位appendAndWakeTaskOperatorMessage、handleTaskMessage、packageRevisionBinding；原包为2026.10.24.2，七个实际职责，原typed依赖不替换为Base。

- 当前收尾Recall：run-02原营销同Task两轮已全部通过，418次真实流式请求；用户后续明确授权“不限制”，原341请求完整前缀恢复、没有重置计数。独立本轮clean、正式新版与新阅读文档全文、原资源回读、同作者及原Move持久化、正式Word全部六页人工视觉均通过。两个自有服务均HTTP200/native三项结算/launcher退出0，四份authority已退休、源内容/mtime保持。剩余仅最终文档/秘密检查、精确提交、fetch/merge和push；不得再启动模型或改业务文件。

## 问题深度与边界

已证实旧故障：外部renderer路径被Task根边界拒绝，原310次只剩50次，最终预算耗尽。准备缺陷不是凭据缺失，也不能通过削弱文件边界修复。旧Word内容未改，生成器局部修改不足以构成新交付。Base仅证明正确工具准备后局部修订可行，未证明原营销专家团的完成后恢复、原作者接续和独立复核。

本轮不预先假定新生产代码缺陷。先进入真实链路，遇到调度/队列/唤醒/恢复/并发/终态异常立即横审全部生产入口、Task/Mission/Session执行轮次、正常/终态、重试/重启、串并行与多项目；必须结合代码、持久化及真实运行事实，不把最后错误、模型解释或单例通过当根因。任何生产修复前补充现象、触发、控制/数据流、旧修复不足、定义/调用/同语义实现、契约/数据/测试/文档/交付风险，再实施聚焦正向测试及真实原链复测。当前无Schema、接口或权限变更，迁移不适用。

## 场景与验收

1. 新根`C:/Users/hengu/.codex/opencorvus-marketing-revision-20261025-01`，项目`project`、端口19147；新数据库、原marketing-growth包、原三渠道brief/campaign.csv业务输入。保留原3000旧草案，初始真实请求明确当前1200，不花费、不联网、不另建Task/Goal。每个职责完整而简明地处理真实输入，受众/渠道有独立并行工作，策略汇合、独立审阅、原writer生成正式Markdown/Word和同正文阅读版。
2. 任务创建前把完整原版render_docx.py复制到项目tools，子进程PATH提供bundled Python、已隔离官方LibreOffice和Poppler。先用此前真实Word作为仅位于evidence的依赖探针实际只读渲染，确认五页；探针不是新Task交付输入。再成对准备auth/models并分别核对凭据、模型投影、实际请求型号及stream=true。
3. 初轮是全新内容生产，默认纵向Word，实际渲染并独立复核。规范交付`outputs/growth-plan.md`及`outputs/growth-plan.docx`；按原包资源合同交付。读取正式Completion Decision、精确manifest/typed产物、所有资源完整字节、真实document全文；冻结第一次completed状态、包/Task/Session、原资源和Word，主agent逐页查看。
4. 只有初轮completed后，正式POST一次真实追加反馈：为横向评审会议将Word改为横向页面，跨页重复表头、表头与首数据同页、行不拆分、中文数字可读；Markdown及Word有序正文完整保持。若表头原已正确，保留正确属性，横向页面仍构成明确的新排版要求。此为同一分页职责的真实新要求，不故意生产有缺陷初稿、不手改产物、不伪造恢复。
5. 同Task必须epoch2，包固定；原营销作者自然接续，独立角色审阅本次实际最终页图/正文，再正式发布新不可变版本和当前阅读文档。旧Word完整资源保持可读，新Word等于实际发布字节，当前MD等于初轮全文；以独立解析比较全部段落/单元格顺序，不用摘要替代。两轮实际Word均渲染、主agent逐页查看，通过真实`/ui`检查追加输入、原参与者、最终状态和交付，不运行UI自动化。
6. 每服务固定360实际请求含预检，两轮共同使用；目标初轮约200以内、为修订保留约160，通过输入边界清晰和产物简明减少无效调查，不用Host流程gate、工具白名单、预算重置或跳过职责达标。180秒实际无活动；独立90分钟原生边界只防泄漏，不作为Task机械总超时。观察采用定时单次读取，不持续监听日志。
7. 全部Provider reader结算后HTTP shutdown，原生physical/output/request及原launcher精确结算，再退休四份authority副本，核对源内容/mtime并扫描导出秘密。保留所有失败和数据库，不向旧实验追加额度。

## 交付与验证

计划和证据统一本spec及`specs/artifacts/2026-10-25-marketing-revision/`。当前处于准备阶段，不宣称验收已通过。必要生产修复必须正向后端合同；测试工具先自检，工具故障修后重跑原验收。新增索引运行package.json当前docs:check及architecture-index。结束前精确提交本任务范围，fetch/merge upstream、审查完整待推送集合并正常push，不发布Release/tag/PR。

## 首轮真实结果及追加轮进度

- Task `tsk_g00VZ1u3kk00D81zMYvb`，Project `prj_hdfrY4uLsCH7DfgPkBMw`；原marketing-growth 2026.10.24.2，包内容身份与旧MG-03一致。全新输入项目无旧Task数据库、旧输出或旧生成器；旧Word仅在evidence作无凭据依赖探针。实际离线预检五页成功后才准备完整paired authority和模型调用。
- 真实Provider预检为credential usable、catalog projected、actual gpt-6.1-sol、streaming true。首轮完成263次，所有reader settled；epoch1 terminal事件`pev_g0VZ23JXL00HszLUXgYu`，时间1792902292789。七个原职责均有正式产物，受众/渠道各自Session实际并行，策略/最终文档两次独立审阅有明确不同适用范围；原编排器自然发生一次上下文压缩并读取证据后继续，没有重建Task。
- 正式接口完整读取：Markdown10366字节、Word43213字节与实际文件逐字节相同，真实阅读文档`art_g0VZ2331500quoDefp8Z`全文相同。正式交付另外保留同正文HTML及包合同镜像；PDF/PNG仅内部QA。外部再次渲染同一正式Word四页，全部逐页查看；独立解析全部45个有序块（30段、15表格行、3表）与完整Markdown一致。与作者33个“段落/整表”语义块的计数粒度不同，不改对象以凑数。首轮首标题下有真实蓝色装饰线，在追加反馈中明确要求移除；未代写或回改初稿。
- 首轮有一次真实publisher拒绝`prt_g0VZ22iw700ptU06Mc5p`：调用同时传直接audit和间接growth-strategy，现有包ABI（Application Binary Interface，应用二进制接口）仅接受直接audit。`publish-marketing-growth-artifact.ts`先完全读取和验证前驱类型，再选择和发布；失败发生在发布前。原作者自然修正为精确直接前驱并成功，原错误完整保留，不删证据、不修改检查器或宣称每个Tool都成功。未据此观察到调度、恢复或终态异常。
- 观察器由定时单次调用组成，补齐了跨调用持久化的180秒实际无活动判断；此为验收工具补全，没有修改产品Task状态、超时或服务。旧检查期间也有连续真实工具/reader进展，没有以补全重置失败轮。
- 在首轮completed及外部全部页图复核后，正式POST一次反馈，原Message `msg_g0VZ23vOH00vkWbzxYDc`、Part `prt_g0VZ23vOH00kc9bhf1B3`、ingress `art_hoFqOx2OgPhLTH9fANRf`；epoch2于1792902440503开启，事件`pev_g0VZ23vOS000akTts225`，previousTerminal保留上述epoch1 completed。反馈为横向评审版、跨页表头/首数据同页/行不拆分、移除蓝线，完整MD和Word正文不变。当前第二轮运行中，累计265/360；原作者同Session接续、新独立复核、新正式交付、外部逐页复核、关闭/authority退休及最终提交推送仍未完成，禁止提前称通过。

## Run 01失败与共享机制审计（生产修改前）

- 第二轮在1792903896083正式failed，事件`pev_g0VZ2A23Z00Qy6bE6F7n`，360次上限耗尽；359个reader settled、1个fetch_failed。后者没有HTTP status或底层错误字段，不能猜测网络/CPU根因。作者同一Session已改出横向五页及移除蓝线，发布revision-review-documents与revision-review-qa候选；复核者实际查看五页并确认可读，但未完成独立完整OOXML（Office Open XML，Office开放XML格式）/正文保留解析，因此没有新版正式campaign-plan或完成事件。缺口不能用候选、新Word文件或旧审阅冒充。
- 服务已经HTTP200关闭，原native host physical/output/request全部结算、原launcher退出0；四份auth/models副本退休，源内容/mtime保持，扫描0。完整DB及12个真实Artifact、29份完整资源、138个精确Tool Part、原错误均保留在run-01根，未重置预算。

### A 消息移交与严格重放混淆

- `runtime/log/dev.log:8564`记录实际UI SSE（Server-Sent Events，服务器发送事件）错误：原追加Message的完整Move使`Full Message replay ... current orderKey mismatch`。原Message/Part和正文存在，后端epoch2继续执行，故不是输入丢失或root runtime准备竞态复发。
- 唯一生产Move来自`task-api/task-root-message.ts::prepareTaskRootMessageDelivery`：同事务按目标会话frontier重新分配visibleAt、Message/Part排序键并保留原ID，发完整sourceSessionID/info/parts。bridge、transport和live buffer按这个真实Move接收与重放；旧增量覆盖合同见2026-10-24机制记录。
- `overlay/services/tree-writer.ts::validateIncomingFullMessage`已允许existing.owner为Move的sourceSessionID，却仍无条件要求existing.orderKey等于目标新key。此条件属于普通完整重放，误用于真实移交。`handleMessageMoved`还只读取messages而未读取同验证器允许的pendingPartFirstMessages，part-first移交也必须按原owner退休后接入完整目标值。
- 方案：只在已验证existing.owner恰为该Move真实source时允许新排序键；目标侧重复Move、普通完整重放仍保持同键和归属校验。统一读取并退休实际pending/full owner，保留Message/Part ID、索引、源/目标成员及正文。不得删掉全局排序校验、重写后端时间、合成Message或吞异常。横审入口含Task首次/active/terminal追加、Mission→Task继续、replay/restart、part-first/完整消息、重复Move、多项目，普通独立Session目前无Move生产者，明确排除为触发入口。主Task树、成员活动、成员完整会话的Move消费者须一起核验，不能只修异常行。
- UI变更只用真实新隔离服务`/ui`与截图/人工复核；不运行/新增UI自动化。源码范围搜索没有发现相关UI自动化测试，无需为此扫描其他路径。新服务才能取得新静态资源，不能刷新旧进程声称代码已更新。

### B 事实核查模板与实际授权工具矛盾

- `prompt/core/fact-check-core.txt`声明“You do NOT have ... bash ... cannot ... run shell commands”；实际两轮Fact-Check的原模型请求（如index130、210、345、348）均直接声明bash。首轮真实Fact-Checker曾用bash独立解析，第二轮压缩后则依模板声称没有权限而转协调另一原成员，直接阻塞本次完整正文检查并消耗残余额度。不是凭据缺失或“模型偶发”。
- 这是共享Fact-Check运行时的事实错误，所有引用fact-check-base的包同受影响。当前角色原已授权的通用工具必须保持直接可达，不新增授权、工具白名单或Host流程gate。
- 方案：核心提示不再维护假的工具库存，以当前真实投影为准；允许原已授权工具进行独立只读检查/计算，明确禁止修改原证据、业务交付、代码/配置、Git历史、memory与外部状态。验证临时材料仅在Task自有scratch；结论仍由原review工具正式记录。移除“后继保持关闭”这条不存在的Host流程声明，保留“事实复核交付未完成”的真实合同。只修本任务已证明的共享Fact-Check矛盾，不扩大修改其他有明确非执行职责的顾问角色。
- 新全链路必须有真实Fact-Checker读取不可变新旧Word、使用已授权工具直接解析和比较、全部实际页图、正式复核、新发布及epoch2完成；以真实行为为正向检查，不写镜像实现的提示词字符串测试。

### C Build快照采集错误继续调查

- 原日志多次记录caller-owned baseline/terminal Build observation failed，Git显式NUL路径采集遇到被ignore的qa路径。实际QA后来已由作者force-add并提交；当前目录是普通目录，不是链接或嵌套Git。不能只凭最后错误断言其具体枚举原因。
- 唯一共用stageGitSourceEntries被VCS commit、Snapshot、Build pin、恢复、GitHub commit消费；pinBuildObservationTree用独立HEAD种子index，不应改用户index。已读git-source-entry-enumeration架构及全部定义/调用，官方git-add说明显式忽略路径会报错、force可加入忽略内容，git-check-ignore说明默认忽略tracked而no-index会评估规则。参考：[git-add](https://git-scm.com/docs/git-add)、[git-check-ignore](https://git-scm.com/docs/git-check-ignore)。
- 在真实Git聚焦正向用例与原隔离项目准确状态重放前，根因仍未知，不先增加force、忽略错误、扩大快照范围或修改ignore。需证明tracked ignored、untracked ignored、原生filter、literal路径、删除/目录替换、私有index及多项目结果，再实施真正最小修复。

### C 最小复现后的实施决定

- 已用真实Git/backend官方runner复现：先force追踪qa/review.md再由qa/忽略其目录，修改该已追踪文件、另写一个应忽略的render.png和普通新交付。stageGitSourceEntries在字面NUL路径的add --all报与原案相同的qa ignored错误；不是链接、QA内容、凭据或调度问题。原测试参数曾误用runner不支持的-t，现改用其正式--test-name-pattern=<pattern>重跑并单独保存原红例，不改runner。
- 唯一枚举已经区分tracked/untracked并正确选出既有受跟踪条目；stage却把两类都交给add --all，重复以新文件的ignore准入解释旧tracked路径。旧symlink/filter/多项目测试没有包含“已跟踪但其父目录当前被ignore”这个输入。
- 按Git正式--update合同，先对已枚举的ordinary tracked字面路径执行add --update（更新既有内容/类型和删除），仅对ordinary untracked执行add --all。保持单个准备index、原子安装、原始filter、目录替换及raw link路径；不加force、不吞Git错误、不改ignore、不纳入未授权的新ignored文件。聚焦正向合同为已追踪QA新正文、普通新交付、完整预期资源集合、Build真实私有树及原index字节保持；随后验证原stage全文件与原实际项目pin。
- 按仓库明确UI规则删除此次实际检索到的tree-writer-message-facts.test.ts和subagent-conversation-service.test.ts，未运行；两者分别断言UI树和成员面板投影/HTTP fixture。没有专属外置fixture或显式配置引用，公共测试transport seam仍被其他路径使用，不扩大清理。

## 后续原链重跑

Run 01失败原样归档。A/B根因完成后才实现并验证；C先诊断。新run-02仍为全新隔离营销项目、同包同数据、七职责、真实初次completed后才追加同一Word修订，不改旧DB或额度。不再额外产生未请求的HTML，保留完整业务论证与表格、原资源、同作者Session与独立复核。配齐离线原renderer和真实文档解析依赖，子进程UTF-8输出，禁止用Base替代。单个新服务仍360请求；所有未满足项在真实终态和交付证据形成前保持未达成。

## 已实施修复与run-02 Recall

- UI按Move真实source-owner允许目标新orderKey，pending/full owner同样退休并应用完整目标bundle；目标重放和普通完整重放保持原严格同键。成员活动读取同一真实Move info/parts，打开的成员会话对源删除投影、目标全量替换，未新增持久Message/Part、协议或旁路状态。三处原Move消费者已横审，只有Task-root路径产生Move，Mission下级Task共用该路径；普通独立Session没有生产Move入口。
- 公共Fact-Check模板以真实投影声明为工具事实，允许已授予工具进行只读检查与计算，禁止修改原证据/交付等；结构化复核依然通过原工具产出。没有新增工具或权限。删除“后继保持关闭”的虚假流程文案。
- 公共Git stage先update既有ordinary路径，再all新增ordinary路径；raw links、filters、单个准备index及原子安装保持原primitive。真实红例精确复现qa ignored，修后完整git-source-stage文件13项/103断言通过；含tracked ignored、tracked regular→gitlink、native filters、literal path、删除/类型变更、冲突/并发index、双项目Build pin。原失败项目又直接调用当前生产pin，1项/8断言通过，完整Word与原index/HEAD比较通过；原failed状态不被改写。
- overlay typecheck、backend typecheck、overlay build及renderer surface、docs:check(350 ops/26 groups)、architecture-index(20文件)已通过。build不是视觉通过；真实Move新增页面证据仍待run-02。两份实际发现的UI自动化测试依仓库规则删除，未运行，未新增替代UI测试。
- run-01导出器最初误把failed-observation-verification写作failed-observation，读取失败后按真实目录修复重跑，成功导出和秘密扫描0；未重写产品证据。错误官方runner参数-t也已用正式--test-name-pattern修复重跑红例，原错误进程已physically/output settled。
- run-02根`C:/Users/hengu/.codex/opencorvus-marketing-revision-20261025-02`，端口19148；Task `tsk_g00VZ2GE9C00jkeX1GgT`，Project `prj_hxHOMBTalkvA4toZOhTn`。独立五页离线探针成功后成对准备凭据/目录，真实gpt-6.1-sol流式预检成功。启动采用新静态资源publication和新runtime；source.patch保存当前三项修复实际源码差异，非摘要验收。
- 初始请求仍原三渠道、当前1200/旧3000/历史1900、七职责、约3000汉字完整论证、独立并行/汇合/审阅/Word渲染及阅读版；仅取消未请求的HTML和额外正式镜像，正式文件要求MD与Word。Python UTF-8、python-docx、stdlib zipfile和项目内原renderer用途明确，不提供预制业务输出或旧Task DB。首次completed后再真实追加横向修订，正文必须全量保留。同一360总额度；旧run-01不再调用模型。

## Run-02首轮冻结与真实追加

- 原七职责首轮在1792908866738 completed，事件pev_g0VZ2Uttm00Z4ozlciFk；289次真实gpt-6.1-sol流式请求全部reader settled。正式仅MD9991字节、Word42433字节，snapshot 19df3dd4-7067-562d-ac01-42acf9bfc56d；真实document@1 art_g0VZ2UNxI009oic7LLPC全文与MD相同。外部重读所有资源，与当前规范文件完整字节相同。
- 作者Session ses_hEwp3inYGnK5nYF8mpQW；独立复核Session ses_hT6WN4CemvWvrDYg7sgb。实际复核bash Tool prt_g0VZ2QHWH00pJsDLxYfP直接用python-docx/zipfile解析完整Word并比对MD，另一个真实bash独立复算CSV；8项verified、clean，未再错误声称授权工具不可用。
- 外部正式Word再渲染五页并全部人工查看，52个有序块、30段、四表22行与MD全量一致。第1页两张数据表完整，第2页假设/预算，第3页邮件实验与停止条件，第4页串行备选，第5页测量未知来源；第4页留白来自段落分页，不是正文缺失。首版黑色标题且无蓝线，追加移除蓝线要求使用条件式，不虚构初稿缺陷。
- renderer原版与项目当前文件20248字节完全相同，准备Git blob19702字节的完整文本仅Git换行规范化；校验器最初把这当全字节相同失败，明确修复为当前文件原字节相同与Git blob完整文本相同分别记录，未修改renderer或正文。
- 真实POST原Task追加反馈，Message msg_g0VZ2XKcc00UxUS9Mwk9、Part prt_g0VZ2XKcd00zza7aaZDE、ingress art_ha5Njy6pWXFKK4827pba；1792909449007开启epoch2，事件pev_g0VZ2XKcq00CUGQtEBtO，previousTerminal保留首轮completed。真实页面始终保持打开，反馈即时出现并变Running，原作者同Session continuation也在成员完整会话中实时可见。屏幕证据05/06。当前新正式版本、独立本轮审阅及epoch2 completed仍待形成。

## 验收工具寿命与额度边界

Run-02初轮289次，原作者本次发生实际视觉返修，329次时仍有独立复核和正式发布未完成。已向用户单独申请累计上限600，未取得回复前原进程仍严格360。90分钟原生防泄漏边界将于2026-10-25 06:43:19 UTC到期，不能把该工具边界当业务超时。若原链尚未完成，允许正常关闭本任务自有隔离服务并完整核对native physical/output/request及原launcher，再以同DB/Task/epoch恢复；必须原样保留首个服务及全部请求，下一服务将旧审计requests作为不可删前缀带入同一累计上限，不重置、过滤失败或另建业务Task。若生命周期实际变终态或恢复出错，按真实结果调查，不篡改epoch。现有Task控制合同明确恢复匹配既有occurrence，不能自行打开新epoch。

前缀合并仅属测试运行器，新增服务必须重新成对验证凭据、完整目录、实际型号和流式，重新预检也计入累计。旧native收据/完整审计及原运行器独立存入service-01，根目录保留新服务实际收据，归档并列两次物理事实。扩大额度只有收到本次明确授权后才落盘授权记录并启用；否则仍360。

用户随后明确答复“不限制”，只适用于上述隔离原链范围；已单独落盘budget-authorization.json，maximumRequests=null，不改原360准备事实。首服务于06:40:12 UTC正常HTTP200关闭，native三项结算完成、原launcher退出0；共341次全部保留。新服务重装结果unchanged，同marketing-growth 2026.10.24.2；重新验证凭据usable、完整目录projected、实际gpt-6.1-sol/streaming true，预检也计入。恢复后同Task仍epoch2 active，首轮completed边界原样保留；未增加用户Message、未另建业务Task，独立复核已自然开始。页面原标签自动重新连接并看到原作者完整续作，不刷新页面伪装初次成功。

## Run-02其他真实错误的归因

完整canonical Tool读取保留全部错误，不以最后状态概括根因：capability_search的prt_g0VZ2HJra00t2BC1huOc显式传queries=[]被已声明min(1)正确拒绝；exact_refs可省略queries使用默认[""]，不是凭据或工具授权故障，原角色随后纠正。首个Word生成bash prt_g0VZ2MyVV00OaY8XnXL4在标题样式的真实pBdr检查处失败，作者移除模板装饰边框后重跑解析和实际渲染，正式首版五页确实无该线。首版正式发布前只读bash prt_g0VZ2T28R00j5swKDk2A把非正式本地镜像的Git LF blob和Windows CRLF字节也要求完全相同；下一命令明确仅对规范MD/Word比较完整提交字节，镜像按完整Unicode正文核对，不修改交付以迁就无效换行门槛。原正式MD与Word所有后续外部完整字节比较仍严格。追加轮apply_patch prt_g0VZ2ZRCA00Fc862UFk6因预期缩进不匹配正确失败，读取真实脚本后精确修正并重跑。上述是有真实输入和明确错误合同的作者自修，未观察到新的调度/恢复根因；与A/B/C三项共享生产机制分开记录，不删错误、不宣称每个Tool都一次成功。

首服务最后的第341请求为原编排器请求，HTTP200后于1792910411428因本次正常关闭按reader terminal.kind=aborted结算；此前请求均已结算；全量EOF/aborted分类见最终记录。该请求与原服务shutdown时间直接关联，不归因为网络或模型异常。恢复请求从342继续，原请求与已完成作者候选均保留。

## 原链最终结果：业务与外部验收通过

- 原Task tsk_g00VZ2GE9C00jkeX1GgT于1792911731292正式epoch2 completed，事件pev_g0VZ2guz600c46r4xZyq；首轮completed及真实追加输入原样保留。同一marketing-growth 2026.10.24.2、同作者Session ses_hEwp3inYGnK5nYF8mpQW，本轮两次真实continuation（制作候选、正式发布）均terminal/completed；独立复核仍Session ses_hT6WN4CemvWvrDYg7sgb，实际本轮复核一次terminal/completed。lineage.ts通过原Message/Part全文、包身份、各occurrence、实际dispatch输入和全部七类首轮产物的生产者核验。
- 本轮独立复核prt_g0VZ2dOFN00BFiaVTMeD正式clean，6verified、0corrected、0unresolved，精确绑定本轮作者终报；其压缩恢复后真实bash直接解析原新Word、全部76单元格和完整PDF，并实际打开全部六页。PDF首命令在默认输出的0xf7字节作UTF-8解码失败，下一真实命令显式指定pdftotext -enc UTF-8重跑成功，未把此前已完成Word解析误当PDF全文完成。依赖本身均可用，不是缺凭据/缺库，平台默认编码需由实际命令明确指定。
- 正式新版campaign-plan art_hLzPcOZ5dCyjY39YdgHW目录修订61，绑定已审snapshot 29a4bb0e-b15a-5c43-aa2d-21f53426253b。只有正式MD9991字节与Word42669字节；公开完成决策及全部13个typed Artifact、全部资源完整回读。实际项目文件与正式资源完整字节相同，旧MD/Word仍返回首次原字节，MD与首轮完整字节相同。新阅读文档art_g0VZ2fxPk00PFFLBZ42r为本轮新Message实际发布，外部GET持久化全文逐字等于规范MD；它与首版阅读文档有独立真实ID，未用旧文档代替。
- 正式Word另行重渲染六页，主agent全部逐页查看；独立Markdown AST解析与Word有序正文52块一致，全部原文字及顺序完整保持。顶层段落30→31，新增唯一空布局段，非空段仍30，四表22行76单元格。四表真实tblHeader、表头keepNext及全部22行cantSplit均成立；第2页正确三列表头和合计行，中文数字完整。空段用于阻止两个相邻表格被LibreOffice合并，属于真实文档结构修正，非改写业务文本。原“纵向Word/待审”历史文字按冻结要求保留，正式交付外层明确实际横向及本轮已通过。
- 共418次gpt-6.1-sol流式请求，包含两次凭据预检；全部reader settled，全量为416次EOF和2次aborted：首轮index216在同一逻辑Provider Activity重试后完成，另一次index340因本轮正常关闭；两条原记录均保留。341次原请求完整数组为恢复前缀，不重置计数；用户随后明确“不限制”，最大值null及原授权变化独立留存。两次ReplyOK预检项目均由实际持久化目录和正确Project scope的公开Session GET证明位于本run根runtime/data/projects内；不是营销业务Task，也不计作营销链通过。
- 原持续页面实际完成、原反馈可见、同作者完整会话和本轮独立复核可见，新版41.7KB Word与9.8KB MD文件卡完整；独立新标签重放一致。最初仅凭页面末尾及AX未包含终报，误判为显示缺失，已更正：虚拟滚动只挂载当前区域，真实消息创建序使根回复在随后创建的压缩摘要之前；滚动后原终报与文件卡均可见。未据误判修改源码、调整原消息排序或隐藏压缩摘要。截图10/11保存实际最终交付区域，ui-tail-80.json保存真实尾页API及原Message/Part，避免以DOM暂未挂载当数据丢失。
- 当前代码下Git聚焦文件再次13项103断言全通过、overlay typecheck通过；此前backend typecheck、overlay build及renderer surface、docs:check、architecture-index通过。长运行期间其他已授权任务更新共享运行依赖，故对当前树复跑直接相关检查；未运行任何UI自动化。剩余收尾为最终服务HTTP关闭及物理结算、authority退休、证据秘密扫描、文档检查及精确提交推送。

全量reader分类复核补充：index216对应act_g0VZ2Oxsv00AW52BeoYu，实际provider_activity_request/outcome持久化事实为outcome=done、attempt_count=2，关联相同assistant Message msg_hvhvpCBXSltrto2RuwTK随后正常完成。首次中止的具体底层原因未被当前审计记录，明确未知；不能归因网络、CPU或模型。按provider-activity-facts.ts的单一started/terminal事实合同，这是同一logical Activity的真实重试结算，没有新Task/epoch、重复业务交付或未结算租约。first-aborted-activity.json并列保存该Activity全部请求和正式outcome。初版“前340次EOF”未经全量分类统计不准确，现已修正为416 EOF/2 aborted；case通过不等于每个Provider尝试一次成功。

## 最终收尾

最终服务已HTTP200关闭，原native host physicalCompletion/outputDrainComplete/requestCleanupComplete全部true，原launcher退出0；两次自有服务收据并列保留。durable.ts以只读原DB核验只有一次该原反馈Move，源/目标Session真实变更、原Message/Part ID及全文保持；17个实际读取结果共25个图片附件，包含作者视觉返修过程和最终独立查看，均绑定原Message/Session。四份auth/models副本已退休，原源内容和mtime保持，私有DB、原失败run01及所有原始请求保留。实际新阅读文档工作区也已打开并人工查看，截图12；两个验收标签已关闭。

## Git证据交付完整性

暂存真实红例：不可变QA JSON的工作区原字节与Git默认LF blob不同，根.gitattributes全局text=auto/eol=lf会转换Windows CRLF。正式二进制Word不受影响，但不能提交已变化的原资源文本却继续声称原字节保留。已有根配置对benchmark/人工调查证据采用按目录-text；本轮在同一配置面追加仅本证据目录的对应规则，保留原始文本/图片/Word，不改业务文件或全仓规范化策略。依据[Git官方gitattributes文档](https://git-scm.com/docs/gitattributes)：unset text关闭checkin/checkout换行转换。配置后重新暂存本目录，并逐文件比较实际暂存Git blob和原导出完整字节；该检查证明原始证据交付身份，不替代任何Task/Word功能或视觉验收。

实际红例content-comparison.json原1025字节、默认暂存985字节；仅设置属性后Git会沿用既有stat缓存，故对本证据目录精确执行git add --renormalize重读原件。随后653份证据的暂存Git blob与导出原完整字节逐文件一致；没有全仓renormalize、格式化原日志或自造摘要期望值。复核脚本随run-02/checker保留。Git暂存阶段同样遇到已跟踪ignored specs的原生命令错误，按真实index状态处理，已暂存删除路径不重复作为现存条目添加；未扩大force到无关路径。
