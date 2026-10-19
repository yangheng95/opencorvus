# 目录读取在连续配置写入中的进展

## Recall

持续单agent，不委托；旧goal中三Astra描述已被用户后续明确要求覆盖。上一轮为progress：36270590e06d3a3ca0bc41c82c815543bd0fe279正常commit、fetch/merge、全待推集合审查、完整hook push、fresh fetch HEAD=origin/main。38个聚焦正向backend用例/84断言、1 POSIX明确skip，修复Git不可用/损坏/父仓库误认，并将Windows同轮两路径查询合为一个命令；没有去掉初次/准入复核。已有.bun/与packages/opencorvus/bun/保留。工作区开始无其他tracked修改。

原完整QA（Quality Assurance，质量验证）412历史保留85 Projects、schema2，canonical完全恢复；四个448 native服务和原检查句柄全部physical/output/request/launcher结算，所有复制的auth/models对退休，源授权metadata未变。用户18571应用和窗口未动。Goal首页及默认布局441已真实验证；本轮继续同一benchmark-debug-template，不创建branch/worktree，不使用UI（User Interface，用户界面）自动化，不发布tag/Release。

原门槛cold≤10s、restore≤5s、全部真实并发页面GET≤20s保持。448最后一次15.800/16.366s；25个完成GET中/chat/capability 28915ms、/expert-squad/catalog 28977ms，均HTTP（Hypertext Transfer Protocol，超文本传输协议）200也不能当性能通过。之前只筛配置GET的工具覆盖缺口已更正并保留历史判断，最终results全部false。上一轮没有只用模型叙述或名称归因共享锁。

## 修改前分析与证据边界

已读448完整Recall/交付/原始availability日志、25个GET和两次真实writer request、当前04-extensions/05-config、server request middleware、SkillReadDiagnostics、Skill reference-lock、SkillManager、SkillReplacementPublication、DurablePublicationStore.withSubjectLock/runSubjectCallback、Conversation capability与Instance引用读边界、当前Lock读写实现。全仓搜索withSubjectLock、withSkillCatalogReferenceRead/Mutation、withConversationCapabilityReferenceRead/Mutation、withCatalogProjection/MutationOwner。没有源代码或数据修改。

直接可证事实：Config mutation先持有catalog owner→Skill reference write→Conversation reference write→Config generation；候选全项目验证的原Git/文件读取期间也保持这些owner。目录读取先进入同一catalog owner。DurablePublicationStore对未继承有效lease的同subject调用直接竞争proper-lockfile随机退避，没有本地按到达顺序的入场队列；这可能使后来的writer赶在已等待reader之前，但尚非根因结论。不能先改通用RW（Read/Write，读写）锁的writer优先策略，不能释放catalog owner或以旧缓存返回来遮蔽一致性。

追查实际两个长GET的diagnostic spans得到空集合。代码证明server.ts只给GET /skill/mounts与PATCH /config、/global/config建立request scope，其他路径即使内部有catalog阶段也无法绑定实际HTTP request ID。这个诊断工具缺口会阻碍真实调用链核对。修复观测的影响面独立明确：所有非日志HTTP请求复用现有request primitive，同一个原next及Promise、返回、错误和流式响应生命周期；/log类保持当前递归日志排除，DEBUG关闭时primitive直接执行原操作。无新路由/配置/计时器/数据/凭据/LLM（Large Language Model，大语言模型）调用合同，无用户界面变更。

共享机制横审不能限于当前页面：withSubjectLock生产调用包含Skill replacement、Project implicit creation/promotion/worktree deletion、Workspace生命周期、Bun安装receipt和SDK（Software Development Kit，软件开发工具包）生成事务，另有store create/phase/terminal/retire内部复用。需要覆盖正常/失败/终态、重试/重启、有效祖先lease重入和已退休上下文、并发与物理alias、多项目/不同data-root/不同subject、跨进程owner。Task/Mission/Session通过Project/Workspace/Skill/catalog消费者进入；配置写涉及其runtime reconciliation。若证明是队列异常，按这个共享范围测试，不能按单页或特定团降级。当前具体插队位置和跨进程公平性仍未知。

## 实施前方案

1. 先修观测：server同一middleware为全部非log HTTP包裹现有SkillReadDiagnostics.request。新增聚焦真实Server.App health响应与其原requestID的正向事件用例，先复现旧缺口，再原checker重跑。现有diagnostic测试覆盖真实Promise/错误/creator/join/late lifetime，继续验证，禁止UI自动化。
2. 自有新native开发服务，完整85+历史、正式441 UI，完整auth+models配对，分别验证credential/catalog/实际gpt-6.1-sol streaming。复制源仍为已授权Codex auth与完整用户models目录，内容不进prompt/log/spec/Git。用原Config service→HostTransport→HTTP两次保存/恢复和实际页面交互，所有GET都计入，原native终态/输出/请求结算与原launcher join后才退休两对文件。独立旧服务不重启；不触用户数据库。
3. 将实际长reader的catalog.admission/held及writer对应时间、真实owner callback入场/完成相连；必要时仅在自有diagnostic launcher对原withSubjectLock作被动callback计时，保留参数、owner、返回和原错误，不改持久协议，也不作为未插桩资格。证明具体先后关系后再补充根因与生产修复方案。没有证据就不添加FIFO（First In First Out，先进先出）影子authority、worker/IPC（Inter-process Communication，进程间通信）或放宽超时。
4. 如果需要共享入场队列，先读完全部生产subject和现有真实同进程/跨进程/重入/重启测试，明确它只约束本地竞争顺序、原file lease仍是唯一事实，保留所有原owner lifetime及不同subject并行。禁止把局部FIFO宣称为跨进程全局公平。只有分析完成才改；先失败→正向真实合同，再完整原checker和手动页面截图。
5. 文档/三索引与必要架构同步，docs/architecture/OpenAPI检查，实际敏感值扫描，所有本轮修改范围提交，fetch/merge与完整待推集合审查、正常hook push、fresh fetch和结束status。性能不达标继续迭代，goal保持active。

## 修改前根因确认与横向审计

观测修复先真实失败→通过：Server.App /global/health原响应200及request header有效，但没有对应request phase；新增正向事件测试失败。改为全部非log HTTP后，7个观测合同和4个catalog/config锁序合同均通过。对原85+历史新before服务实际预检gpt-6.1-sol流式，原checker37090和native launcher19045最终joined0、public shutdown200，runtime pair退休，canonical完整恢复；private pair保留供本轮after使用。

关键真实时序：writer1 request00524dab在23:18:26.194–41.265执行；能力reader92d7eccf在23:18:29.919开始catalog.admission，直到57.296才进入，等待27377ms，整个HTTP27387ms。后来的writer2 bec4ba73直到41.284才开始，却在41.377就进入同一catalog owner，等待93ms，持有至57.274。reader实际操作仅数毫秒，长等不是模型输出、解析或最后状态。原SkillReplacementPublication KIND/SUBJECT和同一Global data root将它们定位到同一个物理subject，真实DEBUG span与server request ID一致。根因为同进程所有竞争者直接进入proper-lockfile随机退避：旧reader在退避期间，刚来的writer可立即尝试并抢先取得文件锁。

已核对锁定[proper-lockfile4.1.2官方合同](https://raw.githubusercontent.com/moxystudio/node-proper-lockfile/v4.1.2/README.md)：它提供原子锁、保活、retries和release，不承诺到达顺序。本轮不替换该跨进程authority、不改变stale/update/retry、不改读写锁优先级或降级为旧目录缓存。补充同进程FIFO只决定谁先尝试原文件锁，不能宣称跨进程全局公平。

全部生产DurablePublicationStore构造/withSubjectLock入口已逐项读取：

| 入口 | 正常/终态与恢复合同 | 本轮影响边界 |
| --- | --- | --- |
| Skill replacement/catalog/config | recovery→原目录/config projection、immutable phase/terminal、故障保留 | 同subject root入场有序；祖先有效lease照旧重入 |
| Implicit Project creation | duplicate sweep的terminal+removeSettled原子回调、restart listOpen | 嵌套store操作必须复用同lease并完整drain |
| Project promotion | project ID subject、目录before/after/recovery、terminal retirement | project隔离和原Project generation不变 |
| Project worktree deletion | DB instance/Project generation/path subject、原physical frontier/reclaim/replay | 不引入新的删除authority或取消路径 |
| Workspace lifecycle | create/delete immutable subject、dead-owner frontier recovery、withOwner+phases | Task/Mission/Session工作目录的原生命周期/DB事实保持 |
| Managed Worktree readiness | begin/created/populated/committed/removeSettled | 只有原READY terminal允许reuse，队列不是READY |
| Bun install receipt | 同版本安装intent、superseded terminal/retry | 不改变package/version或执行环境 |
| SDK generation transaction | staging/backup/replace、同package root恢复/终态 | 正常产物与rollback事实不变，无新生成协议 |
| Store create/appendPhase/settle/removeSettled | 所有上述入口共用、immutable事实/子回调排空 | 仅本地root admission；跨进程文件锁仍实际取得后才给owner |

现有withSubjectLock无AbortSignal合同，本轮不新增排队取消API。必须测试准入/operation失败后的下一个owner可进展、有效祖先重入、退休上下文重新排队、不同root/subject并行、同物理root alias、真实子进程crash/restart。所有持久事实/owner.isCurrent含义和原锁序保持。当前原readiness、Workspace等没有新异常证据，不按某一团局部处理，也不由名称推导结果。

## FIFO实施前具体方案

在原canonical physical root+kind/subject identity算出、原有效lease重入判定之后，给独立root callback登记一个进程内settlement ticket，等待此前同key ticket，然后进入原proper-lockfile与runSubjectCallback。ticket只在原callback/子回调、租约退休和原file release全部完成（或原错误结算）后resolve；finally仍等前一个ticket，防止早期准备/准入失败让更晚操作绕过旧owner。只有本key最后ticket完成时删除map项。不同root/subject无共享尾队列，其他backend仍由同一个原文件锁隔离，不落盘队列、不造owner或重放状态。

为让正向合同观测真实接受顺序，复用现有仅测试故障cut机制，增加subject-queued点（实际file lease之前，不能当owner）。现有全部cut消费者都按精确point/kind过滤，原intent/phase/terminal crash点保持。先只加这个观测点并在原不公平实现运行真实文件竞争测试：记录12个同subject、交替root拼写的实际queue acceptance，再核对真实callback顺序及owner；旧实现应按实际失败证据记录。随后才加入FIFO，重跑相同合同。新增准备失败、不同subject进展的正向合同，复用原durability/跨进程恢复测试；没有“不调用/不存在”核心断言，不用函数调用计数冒充实际结算。最终新未插桩全历史after服务、原阈值与所有GET继续验证。

## 实施与正向合同

旧实现真实接受顺序0..11，callback却为11,1,4,2,9,8,10,5,0,6,3,7，第12个后来者首先执行。原失败checker完整退出后才加入本地subjectAdmissions。最终同一物理目录、尾分隔符和真实junction三个store交替竞争，callback按实际接受顺序完成，所有owner都来自原file lease。准备失败、callback原错误、后继有效owner以及其他subject在旧owner持有期间的独立进展均验证。

原crash用例中的泛化非零退出断言已按当前正向合同替换：fixture在精确cut写入action/cut receipt，然后执行原SIGKILL；Windows实测original child exit1，POSIX分支使用原SIGKILL signal（本平台未执行）。检查精确receipt及immutable事实，不能把任意失败当作成功crash验收。没有新增UI自动化或持久协议。

原聚焦runner共44个正向用例/176断言：共享store11/38、诊断7/46、catalog/config锁序4/8；readiness3/6、SDK生成6/12；Skill跨backend多目标恢复1/45、Project promotion3/5、implicit Project3/6、Workspace create/delete/restart4/8、安装receipt2/2。各原文件runner均DONE exit0。长domain wrapper原35705的最终工具输出在上下文裁剪中丢失，恢复后handle已关闭；保留原各文件完整DONE exit0日志，不把Unknown process当作额外重跑或虚构outer退出证据。util与backend类型检查通过。格式检查发现两处新增长行及server既有shutdown表达式的换行，已统一格式；最后该处仅5行格式变化，无逻辑变化。

## 真实完整历史 after 验收

新自有native服务18697，使用与before相同完整QA库、同一正式441界面、原配置与发布helper。完整auth/models配对分别验证credential usable、catalog projected、实际gpt-6.1-sol streaming。实际会话ses_hqBEHVgSBmrf1JMkl0Wx显示OK，CUA（Computer Use Automation，计算机交互工具）手动首页→原会话、输入框、Goal创建说明→关闭；截图人工复核，未创建额外目标。用户18571进程、窗口、数据库未触及。

after旧能力reader7772a609从23:42:16.385Z等待，在30.596Z取得catalog owner；后到第二个writer5f705430在30.597Z才开始准入，30.666Z取得owner。旧读取先完成，不再被第二次保存插队。另一次真实能力读取恰在第二个writer后到，等待17347ms符合实际owner顺序。

两次各41个全部并发GET纳入，按原HTTP writer真实开始/完成窗口匹配，不只筛/config：before最长27387ms，after最长17355ms；after全部HTTP200且≤20000ms，页面读取门槛通过。cold15079.162→16789.526ms、restore16002.126→17368.494ms仍高于10000/5000ms，不宣称保存性能改善；完整Project集合从86到87，未清库或降低项目数量。默认runtime收敛及各Project初始化/Git观测的成本仍需下一轮调查，不能跳过物理身份或以旧缓存返回遮蔽。

原checker26315 joined0、native launcher23669 joined0，public shutdown200，原physical/output/request全部fulfilled、Host/Target精确身份dead_or_reused、18697 listener结算后才退休runtime auth/models；before19045/37090亦已joined0。最终直接SQLite readonly验证schema2/87 Projects，无生产initializer。private authority auth/models随后按精确新scope退休，源授权metadata保持；归档前扫描实际敏感值，归档目的地在任何写入前核对绝对新目录。

## 文档、交付与限制

当前02-data新增唯一subject准入合同，04-extensions链接同一合同，server-runtime-readiness说明所有非log原HTTP诊断scope。三索引同步；util原NodeNext产物构建、docs:check、check:architecture-index与api:routes-check（6规则/35文件）通过。全部证据见[artifact入口](../../artifacts/2026-10-20-catalog-reader-admission/README.md)。本地队列不承诺跨进程FIFO，不新增AbortSignal/取消合同或数据库格式；POSIX signal分支未实际验收。原保存性能仍失败，持续goal保持active，单agent继续迭代。
