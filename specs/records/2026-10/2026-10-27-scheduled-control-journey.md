# 计划任务完整控制体验

## Recall

持续自主改进当前产品UI（User Interface，用户界面）、UX（User Experience，用户体验）和功能；只用当前单agent（代理），旧Goal（目标）中的Astra委托要求被用户后续单agent指令覆盖。已解决Rendering/Sources闪烁不重开，不恢复首页独立目标卡。上一轮为进展：6ccf59c1fcdb9d10e1db16b5895edba592ef27b0修复保存错误呈现与当前语言，15张真实原图、正式构建/类型/语言/渲染器公开面及正常push（推送）完成。2026-10-26 17:08:15 UTC（协调世界时）fresh fetch/merge（重新拉取合并）后0/0，本轮文件清洁，177项同行发布记录、索引排序、历史清理和临时目录保留。645原exec98340、原生宿主/启动器、tab28已结清；无认证、模型新增0，累计218。

不操作用户18571、用户数据库或用户窗口，不建立分支/工作树、不处理同行CHANGELOG、版本或发布，不发送同行消息。只有真实不能安全判断的冲突才等待。沿用benchmark-debug-template（端到端调试模板），但UI验收按用户硬约束只能真实交互/截图/人工复核，不创建或运行UI自动化测试。

## 任务、输入输出与修改前调查

本轮先实际体验计划任务列表、创建、编辑、暂停/恢复、筛选与详情结果入口；输入为明确自有远期global（全局）任务，期望输出为规范公共API（Application Programming Interface，应用程序接口）定义、准确的原日历/版本/状态、对应界面可见事实和清楚的操作反馈。不能预先宣称有bug，也不能把配置写入当模型执行通过。发现问题后补完整根因和影响分析，确定实施方案后才改产品。

已读当前07-panel计划任务日历/快照/revision（版本）/模型身份/导航合同，03-control独立结果合同；ScheduledAutomationsPanel列表、表单、快照、状态控制与输入/错误/模型选项，services/automations/automation-recurrence规范传输与RFC 5545（互联网日历规则）序列化，global全部自动化公共路由与AutomationService.create/assertPublicInput。原global路由独立于项目执行模型预检，不把文件能力旧根因套到本页。读取旧scheduled-result-visibility及legacy-upgrade最终8的既有范围，历史错误仅作线索，不能当现版本证据。全仓搜索现定义/调用、ConfigDialogHost、当前SDK（Software Development Kit，软件开发工具包）类型和已存在scheduled-automations服务测试；该测试只测纯日历/传输契约，不是DOM（Document Object Model，文档对象模型）或渲染测试，本轮尚未运行。没有发现所检索路径中的UI自动化。

当前已知保护：编辑有原定义快照和expectedRevisionId（已观察版本），背景刷新不能改导航；基本日历有显式日期/时间/时区，未改日历时PATCH（部分更新）省略recurrence（循环规则），高级原规则完整保留。模型/推理保留身份已有显式标签。原错误状态仍是翻译后的字符串、非409错误直接显示原技术串；这是待实际验证的体验线索，不以与文件页相似就假定现状失败。全局创建默认active（启用），因此本批输入必须使用2099年远期锚点，不点Run now（立即执行）。

## 环境、时限与第一阶段验收

1. 646独立38151从完全关闭645只读备份当前数据库，逐表全行核对，复制13组附件原件；正式前端main-CQhqpHfW.js与当前Scheduled源码一致。项目开发CLI（Command Line Interface，命令行界面）/ui，不单开Vite。不复制认证，模型预算0。原源库/816条关键历史/原文件保持，仅新增本批命名的计划定义及其正常状态版本。
2. 页面进入Scheduled（计划任务），先读公共/global/automations原列表及当前定义范围。实际创建名称“计划任务控制验收646”、全局、2099年日历、明确自有提示词；验证真实成功回执和原定义。实际编辑名称/提示词而保留日历，实际暂停/恢复再暂停，核对每次当前revision和明确状态。实际筛选/返回详情，语言/布局问题按截图复核，不伪造HTTP（Hypertext Transfer Protocol，超文本传输协议）或模型结果。
3. 自有任务最后保持paused（暂停），保留原定义与审计事实，不删除历史。每个观察阶段用公共GET（读取）快照记录当前状态；不会从原库直接改定义或跳过公共写入。若任何调度/队列/唤醒/恢复/并发/终态异常实际出现，立即按全部Task/Mission/Session occurrence（任务/使命/会话执行轮次）、所有生产入口、正常终态、重试重启、串并行及多项目共享机制横向审计。
4. 原准备/请求各有180000ms无活动观察边界，API单请求15000ms；整体20分钟物理安全边界，目标十分钟公共shutdown（关闭）并预留至少五分钟结清。只关闭自建tab/自有服务；收集原exec/native/launcher（执行会话/原生宿主/启动器）、物理/输出/请求、源库/原件事实，不重启同一实例来重置时钟。不得用静态检查、分数或DOM文字冒充视觉资格。
5. 后续真实模型执行需要单独新运行与明确输入/输出、最多4个新增实际gpt-6.1-sol请求（含认证实际预检），与原218累计共同计数，不因失败重开预算。必须成对复制已授权auth/models（认证/模型目录），分别验证凭据可用、模型投影及实际请求模型完全一致，所有流式调用由原RealProviderAudit检查。为避免历史定时任务带入付费副作用，优先全新隔离数据库/项目，只通过本轮公共UI/API创建的远期任务手动执行；不修改旧历史以规避调度。运行前补齐具体方案，不把计划当已验收。
6. 若实际确认产品缺陷，先更新当前spec（规格）根因/公共契约/测试/交付影响，再实现、聚焦正向非UI测试与新独立实页复核。所有本轮文件范围提交、三索引/当前文档检查、upstream（上游）合并、完整待推集合审查和正常push；不修改Release（版本发布）、tag（标签）或PR（Pull Request，拉取请求）。整体Goal保持active。

## 646实际结果、根因及确定实现

原公共列表为空。实际UI创建远期全局任务atm_g0VZB27HV00sXNHMpUyW成功，原规则DTSTART;TZID=Asia/Shanghai:20990105T090000与Next4071258000000一致。实际编辑名称/提示词后revisionId更新为atm_g0VZB2Hfu00gDtj66nFt，原日历完整保持；实际暂停、恢复、再次暂停分别产生原规范版本，最终atm_g0VZB2uJG00aoHQ3yg14/paused，组合搜索646+Paused+Global正确保留同一任务。没有执行模型，lastRun仍null。以上七张原图/公共快照证明功能路径通过，不能凭代码猜测失败。

新体验问题由04/05/06/07实图与API共同确认：已暂停定义仍保留原nextRun时间，详情的Next run继续显示未来日期；全部列表只有图标区别，没有明确暂停文字，仍显示Next: Jan 5, 2099, 9:00 AM，在Paused筛选下亦然。根因是列表与详情均无条件formatTimestamp(nextRun)，把保留的原日历/Fire frontier（执行发生轮次前沿）当作即将自动执行的承诺。不能以清空后端时间修文案：原日历/版本是恢复的事实来源。旧工作修的是日历不重置、版本快照和结果身份，没有覆盖暂停状态的时间语义。

已核对Automation投影与claim：原定义可保留next_run，自动scheduled claim明确要求当前active；手动force入口另有明确语义，可以在paused定义上单独执行一次。没有实际观察到暂停任务自行执行、唤醒或终态异常，本轮是产品状态呈现问题，不冒充调度故障。后台Task/Mission/Session occurrence、重试/恢复/多项目机制保持，若新实际运行出现异常再立即按共享机制全面横审。

确定实现仅在ScheduledAutomationsPanel的两处时间展示复用一个读取原status/nextRun的局部呈现函数：paused时当前语言显示“自动运行已暂停”，active时仍显示原本地化时间，列表的Next前缀只用于active。保留现有图标、详情状态badge（徽标）、全部操作、原日历/完整高级规则、版本、API与后端。新增中英同键文本，不新建派生状态/持久值、格式化器或定时器，没有非UI新合同、无死代码需要删除，不增加UI自动化测试。恢复后的原时间必须实际重新出现。

646已先结清：自建tab29关闭，公共shutdown200，原exec1151/native/launcher均0，物理/输出/请求结清，余量863173ms。源92表30250行、816原关键历史与13组原件保持，仅本批自有计划定义及其规范版本新增；模型新增0，累计218。

## 647完整验收具体方案

按前述已授权认证/模型规则使用新隔离647/38152、全新数据库和自有项目，避免把历史Task/Event/Goal恢复带入付费验收；不复制旧历史或修改旧定义来规避执行。本批646的原paused定义与全部历史独立保留。普通Node正式构建新UI，当前模型固定openai/gpt-6.1-sol。原stageDiagnosticProvider成对复制完整models及该Provider认证，原RealProviderAudit校验所有实际请求model完全一致、stream=true（流式），先完成有真实回复的认证/目录预检，再开放验收页面。总预算最多4个新增请求，含预检、任何重试及本批后续；原累计218，最大222，不重开预算。项目目录只含明确自有README，没有历史执行入口。

真实API重建同样远期全局输入并暂停，然后实际页面检查中英暂停列表/详情、实际Resume→原未来时间、再Pause→明确暂停；Run now实际执行一次，期望仅SCHEDULE647READY、规范持久成功回执与可打开结果会话，定义仍paused且原2099日历保持。实际打开结果后重新进入Scheduled检查相同宿主范围定义，验证跨会话/项目上下文的列表事实。这里是全新隔离定义，不能声称ID与646相同或对旧历史做了付费恢复验收。

仍使用原3分钟无活动预检/请求边界与20分钟物理安全边界，目标十分钟关闭并留至少五分钟结清；后端实际原cli服务/ui，不单开Vite，不进行UI自动化。关闭自建标签、公共shutdown、原exec/native/launcher/物理/输出/请求全部结清之后，精确退休隔离auth/models两份副本，未用请求配额退休不滚入后续批次。若认证/目录/实际模型任一预检失败，保留原具体错误并结清，不把它称产品执行通过，也不放宽模型或无授权扩预算。

## 647实际验收发现长操作请求故障（未交付）

正式Node构建main-3iP3VtQ-.js、前端类型、语言2套2552键与原renderer公开面检查均通过。647新数据库正常建立当前版本8，未打开用户数据库。成对认证/完整目录和当前Provider投影均通过，原真实预检获得gpt-6.1-sol流式200回复，凭据可用。新公共API创建atm_g0VZB5hjm007CRrTQ8Ob并暂停；验收Node客户端在已完成201/200和落盘回执后主动process.exit触发libuv（Node事件循环库）关闭断言。工具已改为自然返回，并对同一已写入ID重新公共回读验证0，没有重建或重复请求。首次自建页面使用directory/experience而没有资源的链接，被当前参数契约正确拒绝；改用原/ui默认入口，未当作产品缺陷。

实页确认英语暂停列表/详情显示Automatic runs paused；实际Resume恢复原2099时间，再Pause正确显示暂停。随后只点击一次Run now，页面报signal timed out，Last run和历史仍保留未运行旧状态。真实同次manual_api Fire atm_g0VZB6yPO00W0niX8SGV、Run atr_automation_da7d95367d360df33d0c73881887a013在1793036154094→1793036203358约49.264秒成功，只有一次attempt，原定义仍paused、规则/未来前沿保持。刷新原历史后Succeeded出现，实际打开原结果Session ses_automation_dd8aca87716ec76f810185ae185194bd显示SCHEDULE647READY；公共正式消息也完整匹配，原README字节保持。后台完整业务成功不等于原UI请求正确，11/12/13原图保留了超时、刷新后成功及原模型结果，不能宣称本轮端到端全部通过。

初步直接代码证据：HostTransport（宿主传输）默认请求超时15000ms，services/automations.runAutomationNow以普通apiJson POST调用一个等待完整执行回执的接口；现API已有显式业务长操作策略。实际49.264秒回执和页面15秒超时、捕获异常后跳过load/loadRuns共同说明前端把长操作当普通请求，产生假失败与旧状态。尚未完成共享入口审计，禁止现在只拉长全局超时或修改调度。必须横查全部长操作生产入口、Task/Mission/Session、浏览器/原生、正常/终态、重试/恢复、串并行及多项目传输/执行权属；以真实同次Fire/Run/Session及代码排除后台共享根因，决定唯一策略后才实施额外修复。

647已先结清：tab30关闭，公共shutdown200，原exec66984/native/launcher均0，物理/输出/请求完整结清，余量486397ms。认证/模型副本各一份精确退休，源两文件字节/元数据保持。实际最终审计新增3次、累计221（此前218），模型均gpt-6.1-sol、streaming true、状态200、reader（读取器）均settled（结清）；第三次调用的归属尚待原活动事实核对，不能按先前中途两次计数。原本批最多4次的总预算仍有效，只剩1次，任何后续原生运行不得重置或再拨4次。当前没有活的本批服务/付费运行。

下一步先核对第三次调用和原请求/活动日志、读现长操作原语及全仓消费者、完成共享审计；再落盘决定与正向服务合同测试（不是UI测试），实现和实际复核。若需要复用已证明可用的同源认证事实必须明说来源与当前模型/源身份核对，不得伪称又做了付费预检；不能为了复测悄悄扩模型预算。当前只实现了暂停呈现，传输修复与完整后续验收尚未完成，所有本轮修改结束前仍须范围提交推送。

## 长请求共享审计与实施决定

647物理请求时间明确：实际索引0/1在预检ready之前，索引2在唯一手动执行期间；打开结果没有第四次请求。预算按最终3次计，先前未用的647内部配额已退休，本批总上限222保持。648只分配剩余1次，绝不再次拨付预检预算。

全仓生产入口搜索确认：公共POST /global/automations/:id/run等待runNow返回每目标已完成Run；schedule工具直接调用runNowFromTool，不经过前端HTTP超时。定时runDue、手动API和工具路径都进入原执行permit、claim/版本快照、executeWithRuntimeSettlement与持久Fire/Run/Receipt；原lease、inactivity fence（无活动边界）和运行进程结清负责后台生命周期。重试和重启读取原pending Fire/receipt，串行/并行共享容量，目标项目generation和会话归属逐项验证。不会因HTTP客户端15秒终止改写成新的逻辑轮次。647同一Fire只有一次attempt且成功，明确排除了本次后台丢调度/重试/终态不收敛；这些跨场景依据是代码审计，不能称全部做过新付费实测。

浏览器和桌面都由host-transport-runtime选择createTauriTransport，统一transportRequestSignal：显式caller signal优先，timeoutMilliseconds:null表示由原服务回执或caller取消结清，普通请求15000ms。现serverSettledRequest为唯一业务长操作原语。Task/Session对话提交传入自己的AbortController并跟踪真实活动，panel提交使用openStream；Mission唤醒/分发/草稿、删除归档与配置/项目等已显式使用原语；会话删除/归档同样已有。Scheduled唯一消费runAutomationNow的当前面板却漏掉该合同。不存在第二个浏览器实现或需要全局加大超时的证据。异常响应仍经当前ApiError/authority校验；不改变API、SDK、后端持久格式、调度、重试或恢复。

确定实现：runAutomationNow复用serverSettledRequest，保留显式server/caller生命周期；扩展该原语注释使其覆盖等待执行结果。先给纯服务测试补正向transport策略断言并观察red（失败），再修复后green（通过）。面板现唯一mutationOwner加入operation字段，从同一owner派生“正在运行…”及加载图标；不新增平行执行状态，不重发请求。save/status/delete仍消费原owner，运行结束后沿用原load/loadRuns。中英键齐全，当前架构同步。不存在死代码删除、schema变更或升级交付需求。

648采用全新独立数据库/项目/38153及新正式UI，成对暂存已授权认证/完整目录，启动前核对源文件元数据与647已实际证明可用的源一致，并再次验证OAuth有效期与目标模型投影；明确引用647的真实成功凭据证据，不伪称新付费预检。只有页面的一次Run now可能调用模型，audit最多1次，实际模型/流式和读取结清均由原审计器验证，累计221→至多222。先实页核对暂停中英状态、恢复原2099时间、再暂停，点击一次执行并查看原运行反馈和规范结果；记录实际耗时，不能刻意延迟或伪造大于15秒。结束原实例/标签/所有请求并退休成对副本。若源身份变化无法复用凭据事实，停止此依赖步骤而不扩预算，其余服务契约/交付继续。

## 648实际复核与交付证据

实现前原聚焦服务断言red，10项中1项因timeoutMilliseconds为undefined明确失败；改为唯一serverSettledRequest后原10项与原语1项全部green。正式Node构建main-BKiGP2PC.js（71秒）、前端类型、两套2553键语言、原renderer公开面检查均0。新增纯网络服务正向测试进入两个真实生产HostTransport，实现真实loopback（环回）HTTP服务器17秒后返回完整Run回执，浏览器17025.98ms与桌面17006.21ms均通过，共2项6断言；不操作DOM、不渲染组件、不使用UI fixture或浏览器自动化，也不是后台模型验收。

新648自有库正常建立当前8，源文件元数据与647一致，OAuth有效/完整目录及gpt-6.1-sol当前投影通过。实页新计划atm_g0VZBCRAF00qYY71nENH暂停列表明确Automatic runs paused，恢复显示2099原时间，再暂停；只点击一次Run now，立即显示加载图标与Running…、操作同一owner禁用。此次原Fire atm_g0VZBCaCj003e4gov7P0、Run atr_automation_e8327aba34b8ffdef5132fccbc2fde24约6.386秒成功，回执后上次运行与Succeeded历史自动出现，未点击刷新。17.7秒时的截图是成功状态观察，不是大于15秒的模型耗时证明；跨15秒正确性由上述真实17秒网络合同单独验证。

实际点击原历史Chat，Session ses_automation_e5be13f68bb63665233c525b9648f5e1正确导航并显示SCHEDULE648READY；原助手消息、实际请求模型和流式完全匹配。随后从该结果上下文进入外观改中文、再打开计划列表，仍是同一host-wide（宿主全局）定义，中文“自动运行已暂停”、详情成功历史和本地日期正确。中文运行中未另耗请求复测，不能宣称覆盖。原2099规则/未来前沿保持，原README字节保持。最终20张真实原图及去凭据运行事实在对应artifact目录，逐张人工查看；没有UI自动化或像素比较。

648先结清再交付：自建tab31已关闭，公共shutdown200，原exec46798/native/launcher均0，物理/输出/请求全部结清，余量1049542ms；原认证和模型目录元数据保持，两份临时副本精确退休。实际新增1次、累计222，本批3+1=4上限用完；全部gpt-6.1-sol、stream=true、200且reader结清，没有新模型运行。646保留原历史，647/648仅自有库/项目操作，用户18571及真实数据库不变。不存在schema变更、版本升级或发布流程。

本轮验收命令（均使用自有隔离环境和固定Bun1.4运行器；构建/浏览器使用Node）：

- `node .tmp-product-iteration/shell-text-629/canonical-tests.mjs scheduled-settlement-red bun run --cwd packages/overlay test:unit test/scheduled-automations.test.ts`：实现前预期1失败。
- 同运行器`scheduled-settlement-green`运行`test/scheduled-automations.test.ts test/server-settled-request.test.ts`：11通过。
- 同运行器`scheduled-long-http`运行`test/automation-run-http-settlement.test.ts`：2通过、真实34.44秒网络往返。
- 隔离`scheduled-settlement-ui-build`、`scheduled-settlement-types`、`scheduled-settlement-language`、`scheduled-settlement-surface`均0。

三索引只追加本轮条目，同行现存排序/历史清理/发布改动保持。交付还须通过当前docs:check与正常pre-push（推送前）检查，fetch/merge upstream后审查完整待推集合并正常推送；不能因另一个会话存在就等待，也不把其无关文件混入本轮提交。持续Goal保持active，下一批继续其他真实产品体验，不重开Rendering旧问题。
