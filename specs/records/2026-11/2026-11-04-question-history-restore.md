# 已答提问的冷读、重连与原文历史

## Recall

- 用户授权持续自主改善全部UI（User Interface，用户界面）/UX（User Experience，用户体验）和功能，实际体验、根因分析落盘、验证后提交推送；仅本人一个agent，不操作用户18571窗口、进程和数据库。旧长期Goal中的三Astra文字由后续单agent要求覆盖，不委托。
- 上轮923是progress：cadf8263e4463c4e7a64d7997e936d4fa45dc07c已正常推送；2026-11-03T20:04:04Z fresh fetch/普通合并后HEAD=origin/main、0/0，28本人普通文件、1架构段落和3索引行已提交，177条无关状态保留。实际两次两阶段Goal均13次精确gpt-6.1-sol流200/正常结束，修复关闭问题弹窗的原文/选项丢失；17张实图。
- 923只读新实例确证已答Question（提问）冷读缺口：原实时页展示请求/回答卡片，重新打开时只有自然消息和原工具结果；原bus_publication_outbox的真实asked/replied和Tool（工具）结果完整，两个Goal完成/空闲、预算与交付保持。因此撤回单独文案formatter候选，本轮必须修复完整读取/恢复链，不把旧构建或模型完成自述当根因。
- 数据源是正常退役923-final：schema（数据库结构）10、92表、285809行、111项目、273附件/元数据文件；该只读阶段旧行精确、源库/旧项目文件与Git保全、成对副本退役。累计模型请求1367。被验收交付前端是923的ui-after/main-B3Xi2ME_.js，923-final/main-EzNWZF0-.js是已撤回标签候选，不能误继承为当前产品基线。
- 已读当前AGENTS、923 Recall/全部根因和验收，07-panel/reactivity的独立交互/连接切换/历史合同，Session路由的tail/hydrate/history/events、公共model定义、Question原始publicationFacts/物理pending、session-mirror、Task lineage/EngineInteraction、Main树写入与SideChat适配、transcript formatter、相关服务/数据测试和现有隔离原生启动/退役/保全工具。没有委托反馈。
- 全仓检索覆盖Session/Task/Mission/独立子Session的Question生产入口、事件映射和终态、pending/已答投影、Main/SideChat/Board调用、冷读与重连/历史分页、相同原始事实和旧404/408决策。后续细节查证继续补录；未将UI恢复错误直接归类为调度故障。
- 本轮先声明共同90分钟绝对截止、至少5分钟正常退役预留；before38687/after38688、可选只读final38689，各0实际模型请求，总0，累计1367。重用真实923两个Goal的原始记录，不造问题/用户/工具消息、夹具或新模型执行；测试仅验证非UI数据/传输合同，页面/视觉只用真实原生开发/ui、隐藏自有页、实际交互和截图人工查看。禁止新增、修改或运行UI自动化测试。
- OpenAI认证与完整模型目录配对，只用于既有原生初始化和正式账号读取，原来源保持；0请求禁止后台模型工作。用户已授权自行处理登录和实际模型验收，不重复询问或强制刷新有效认证。无Release（发布）、tag（标签）、版本、schema、迁移或权限扩大。

## 修改前问题深度与影响面

可观察现象与直接触发：923图13真实回答已进入独立请求/回答卡片；图17在新原生实例读取同一Session，独立历史消失，展开原question工具仍包含真实问题、原选择名称/值和完整自定义回答。原持久Tool、总用量/Goal、CSV/提案/最终文件均精确；不是仅按最后状态或标题推测数据丢失。

根因：普通Session hydration和connected只提供完整当前pendingQuestions，而Main resetWriter清空standaloneInteractions后只恢复pending；实时resolveQuestionInteraction遇到缺少原Asked也返回undefined，历史不能仅靠终态恢复。断线重连保留当前页resolved的局部Map不能为冷读提供权威历史。单独修改答案formatter不能补齐缺失的原Request。旧404修复相同不可变pending的组件身份，408修复已有历史的呈现，均没有建立已答Question的冷读事实输入。

共享审计：Question原始请求/全部四种终态唯一来源是Bus publication（事件发布）事实；publicationFacts严格绑定project/session/request及asked/terminal occurrence（执行轮次）身份，物理waiter不是终态源。普通Session/Work/Mission及其非Task子Session经isStandaloneInteractionSession按持久祖先和Project隔离；Task-owned Question由EngineInteraction读取相同原始事实进入Board interactions，不能再进入独立副本。Permission（权限请求）在Main终态删除pending卡片，审批事实由原ledger/工具与设置历史持有，不是Question实时保留请求/回答的同一生命周期；仍核对其pending和Task/多项目合同。正常/终态、已答/拒绝/到期/基础设施关闭、延迟Asked、terminal-first、重连/原生重启、串并行/多项目都需要数据正向测试或实读证据，不能以923正常Goal完成代替整个恢复审计。未发现新执行调度/唤醒/队列异常；如发现立即扩大到全部Task/Mission/Session入口和执行轮次，不将其降级为模型行为。

公共合同与调用面：SessionConversationHydration/ConnectionSnapshot当前只有pendingQuestions/pendingPermissions，SessionEvent/SessionProtocolEvent已有Question全部事件类型；Task Board已有完整interaction合同。Main与SideChat使用同一Question严格适配器，Main保留resolved历史，SideChat pending集合终态退休、原工具结果保留。现有公共schema、SDK（Software Development Kit，软件开发工具包）、API（Application Programming Interface，应用程序接口）与文档检查必须随变更同步，不能用fallback（后备路径）兼容缺失字段或合成历史。

## 实施前方案

1. 先从923-final做0模型前测，正式原生开发/ui实际重开两个Goal，记录Request/回答卡片缺失和原Tool可读；读取规范Bus事实、公开hydrate/connected、两个Goal/原文件及15 Mission/4 Task/信箱/Office合同。正常shutdown、原句柄exit0、出生身份/输出/请求结清和成对副本退役、完整保全后才继承后测。
2. 在唯一Question publicationFacts基础上增加项目/Session集合的历史读取，派生已终态Request和原终态，不增加数据库副本或存储格式。共享session-mirror投影为终态事件携带原Request及其原interaction orderKey（时间线顺序键），live与冷读使用同一绑定规则，禁止重放历史Asked为可答pending。
3. 公共Session hydration/connected增加必需resolvedQuestions完整集合，和物理pending在最终同步事实读取中一次生成，独立于有界消息tail；旧pending字段只承载当前实际回复owner。接入Main原唯一Map的原子替换，删除靠当前页resolved残留恢复的路径；完整终态即使未观察到Asked也可恢复同一原Request/回答。相同原Request的已终态吸收延迟Asked，冲突仍明确报错。SideChat继续使用同一严格适配器和现有pending生命周期，不创建第二个历史实现。
4. 原formatter按精确选项value呈现其原label，自定义回答保持原文；不改canonical答案和Tool输出。UI改动不用源码文案/DOM/组件测试；共享数据/传输与public schema变更补聚焦正向测试，覆盖四种真实终态、冷读和实时同身份、延迟Asked/terminal-first、项目/Task隔离及连接原子性。已检索到的非UI后端和side-chat transport测试只作为数据/传输证据，先审查过期或负向断言并更新当前合同。
5. 正常SDK/API生成与检查、类型检查、普通Node构建。0模型后测读取同一真实923记录，实际冷打开/重载/导航返回/中英历史与原文、Sources最终稿/Goal详情，截图人工复核；公开hydrate/connected/history分页和旧Task/Permission合同复读。若集合全量显示造成不合理历史归属/密度，按真实截图修正当前投影，不用隐藏原消息掩盖。
6. 按相同绝对边界正常退役/保全、归档真实证据和未覆盖项、同步三索引与当前架构，文档检查后范围提交；fresh fetch/普通合并/全部待推集合复核与正常push，保留全部无关更改，不创建分支/工作树或跳过钩子。长期Goal保持active。

## 当前状态

本轮已完成实现、聚焦数据/传输测试、正式SDK生成及真实原生页面验收，两次只读实例均已正常关闭、保全并退役成对认证/目录副本；下面记录具体证据。尚待范围提交和正常推送，未作发布或新模型执行声明。

## 前测确证与最终实施决定

before38687/main-B3Xi2ME_、自有页259，正式账号HTTP200/ok，0模型。实际侧栏切换两个原923 Goal，四张原图中03仅为加载中、不算通过图；01/02/04确认完成Goal和原工具存在，独立Question历史未恢复。两次真实公共HTTP hydration与SSE（Server-Sent Events，服务端事件流）connected都只有pending字段；两个原Goal、12组Tool请求/结果、四个真实文件和原Bus Asked/Replied完整。四个原Task的完整hydrate也已保存（完成801和未完成793各有1个Board interaction），作为后测全对象对照。初/末15 Mission/4 Task、信箱24/24与2/7/0、Office文件、915 Goal均读通；正常shutdown200、原71945句柄exit0、物理/输出/请求结清并退役2副本。2026-11-03T20:17:03Z资格检查通过：285809→285811行，仅新增本次正常控制租约/授权各一行，92表/schema10、111项目和273附件、原业务行与源库均保持。没有操作用户窗口。

具体合同选定为必需resolvedQuestions数组，元素为带原Request（含原orderKey）的原终态SessionEvent；它是独立交互的完整当前已终态集合，和物理pending集合互斥，独立于有界Message tail，历史分页不复制另一套事实。现有Task Board完整交互不进入独立集合。先await权限读取和物理pending reader准备，再在最后同步段读取pending/terminal原事实并生成一次快照，避免两个集合跨await读出相互矛盾状态。live终态也经同一映射携带原Request，能够在未见Asked时直接恢复已答历史，不临时发布旧pending。

前端共用Question快照适配器严格读取pending和resolved，检查完整身份和重复ID；Main原Map在hydrate/connected中原子替换全部规范事实，删除以本页resolved残留补冷读的路径。已终态吸收完全相同Request的晚到Asked；重复终态必须同时间/同原文/同结果，否则明确报错。SideChat使用同一规范事实Map作去重和终态吸收，仅把其中pending投影给原可答卡片，历史仍沿其现有真实消息/工具结果；不另造SideChat历史渲染器。Permission的既有终态退休与ledger归属保持，Task已有完整Board合同保持。

涉及定义/调用点为Question.publicationFacts及同源集合读取、session-mirror的live/冷读终态映射、Session公共schema和两条读取出口、Main/SideChat共用适配/Map提交、原答案formatter和当前架构；SDK/API按正式脚本同步。验证包括四终态、相同原事实的terminal-first/晚Asked、Project/Task过滤、snapshot/live一致和原并发切换合同，不能用单例或纯文本断言替代真实checker。当前只读实际数据没有待答问题，新增pending/race行为由非UI正向数据/HTTP/SSE测试资格，产品实页只声明原923真实已答记录的冷读/返回/重载与阅读结果。

实施复核还发现：即使同一同步JavaScript段，另一数据库写入进程仍可能在pending检查和terminal集合查询之间提交终态。故将两者进一步收敛到同一次publicationHistory事实集：物理pending只在该集中原Request逐项一致且尚无terminal时投影，resolved也由该集生成。已有terminal吸收旧物理pending投影，但不恢复物理waiter、改持久事实或增加锁/队列；真实权限读取仍先完成再同步生成这一份Question快照。同步删除路由内原独立pendingQuestionsForConversation路径，保留单一shared snapshot实现，不保留刚引入的平行resolved读取入口。

## 实现与验收结果

- 唯一历史读取在Question.publicationHistory，复用publicationFacts原始请求/终态校验；session-mirror的standaloneQuestionSnapshot分割pending/resolved。公共SessionResolvedQuestion要求原Request，Session hydrate和connected要求完整resolvedQuestions。Main一次替换规范集合，Side Chat保留终态事实以吸收晚Asked，原Permission与Task Board归属保持。formatter仅按精确原value呈现原label，自定义回答原文与真实Tool输出保持。
- 新增非UI question-history-read数据测试2条/26断言；原publication projection按当前合同12条/58断言，清除4条过期空pending负向断言并保留原事实/恢复正向验收；HTTP/SSE连接切换13条/47断言；普通跨进程恢复1条/14断言；Side Chat transport16条/40断言。最终聚焦集合共44条/185断言，全部通过。最初新增测试手写旧顺序键格式导致的测试错误已改为当前唯一timelineOrderKey工具并重跑通过，未为旧格式保留实现。
- 正式SDK生成成功，仅更新openapi.json及生成types；正式API renderer成功，6规则/36路由文件及352操作/26组文档检查通过。core、overlay类型检查和Node普通构建均exit0，真实后测发布main-0GaABhLf.js。删除两个大文件的无关格式改动前保存原差异，并比较完整规范格式化结果相同，保留具体语义修改；不以源码摘要作验收。
- after38688自有页260；2026-11-03T20:34:53Z正式账号读取HTTP200/ok，完整模型目录投影精确openai/gpt-6.1-sol，0新模型请求。两次实际HTTP及SSE connected对每个923 Goal均恢复唯一原已答Question，原Asked、答案与终态时间精确。两Goal均complete/idle，470051/472109令牌、各1自动轮次；各12组原Tool请求/结果、四个交付文件字节保持。
- 真实网页以侧栏打开、原URL刷新、切换923-before项目、设置中文后返回923-after、打开Goal详情、展开Sources并打开final.md。11张截图已实际呈现并人工查看；图03只是加载中，图01/05只是完成上下文，不冒充提问视觉证据。图06/07/09显示原提问、原选项名称和完整反馈；图08是另一项目独立原文；图10原目标详情；图11为应用内正常侧栏最终文件预览。一次手工构造URL遗漏sessionKind/experience而显示明确链接错误，随后使用真实侧栏生成完整URL并以其刷新通过；不将错误输入归因本轮恢复实现。
- 额外实际HTTP tail_limit=1仍包含完整已答集合；两个对话分别3页历史恢复出14条原消息，完整对象与原hydrate精确。4个既有Task完整conversation响应与前测全对象一致，15 Mission/4 Task根Session、24/24信箱及2/7/0查询、Office typed404/200binary/200text、915完成Goal均初末读通。
- 2026-11-03T20:38:40Z后测原native句柄36883退出0、HTTP shutdown200，随后核对进程出生身份、输出和请求均结清；成对副本退役，累计1367请求保持，本轮2实例合计0。共同绝对截止未延长，退役保留3792315毫秒余量。
- 2026-11-03T20:39:16Z后测保全通过：285811→285813行，仅新增本次控制授权和租约各一行；两次只读总变化285809→285813，全部原业务行精确，92表/schema10、源库、111项目文件/Git及273附件完整，未用容量或内存可用性豁免。原认证/目录来源保持，用户18571未操作。

验证产物：[截图与资格说明](../../artifacts/2026-11-04-question-history-restore/README.md)、[实际资格数据](../../artifacts/2026-11-04-question-history-restore/qualification.json)。未覆盖项：本轮没有新LLM工作流、Side Chat独立实页或拒绝/到期/基础设施终态视觉运行；这些终态/共享适配只声明对应数据、传输与跨进程测试结果。没有schema、迁移、版本、Release或tag修改，当前已安装0.1.44不能宣称包含本轮源码。
