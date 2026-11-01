# 主输入发送接受与草稿归属

## Recall

用户要求持续单agent自主排查UI/UX（User Interface/User Experience，用户界面/体验）与功能、真实页面/截图人工复核、范围提交及正常推送，不操作使用中的窗口。旧Goal的Astra委托已被后续单agent要求覆盖，不委托。上一轮864已真实交付3f4190c281a6e9b0a55f9c492afef3655a6ec123，2026-11-01T08:23:23Z远端重新读取0/0，50任务文件干净、176无关状态及共享索引正文保留；41项非UI正向测试、28实图及正式原件读取/Sources通过。五服务/十配对副本退休，最新864-after4可作闭合源：schema（数据库结构）9/92表237113行、77项目、9Goal、108会话/778消息/2209 Part。模型累计1187，不能重开旧scope或延长其截止。

本轮开始状态保存.tmp-product-iteration/status-before865-private.txt，HEAD重新读取仍3f4190c28。尚未修改产品。已读864 Recall/真实16失败与结清、当前07-panel草稿/分配/接受/侧聊合同、ChatComposer的唯一onSubmit/markDispatched与同步draft effect、main.tsx全部提交分支、chat.ts三个真实HTTP路径、conversation-session创建/选择、composer-draft、messageStore及TreeWriter真实消息事实与发布token。全仓搜索onSubmit/markDispatched、composerSubmission/moveComposerDraft、全部创建调用、ChatRequestState、当前Session幂等prompt、Task严格输入和Mission现requestID合同。相关既有测试是纯数据/transport（传输）合同；不运行或增加UI自动化。

## 已确认的问题与影响

864图16和实际POST/session/.../message的500/ENOENT发生在真实用户Message持久化前；主输入文本和附件却已消失。当前代码证明ChatComposer.markDispatched在HTTP发出前清文本、scope draft/quotation和附件，catch只为quotation特殊恢复旧key，普通输入没有恢复；不能把HTTP dispatch（发出）当durable acceptance（持久接受）。新对话分支虽使用已支持composerDraftKey的工厂，却没传该参数，因而自动新Session既不移动草稿，也不保留暂存附件。Goal创建分支已正确传入，旧分配修复并未覆盖这条普通首次发送入口。

Session /message等待完整模型响应，真实用户Message会先通过SSE（Server-Sent Events，服务端事件流）进入唯一TreeWriter；其现服务每次调用重造Message ID，简单恢复输入并重发会失去既有后端幂等契约。Side Chat已按唯一draft.submission保留真实Message ID并以精确用户消息判断接受，不应另造缓存或恢复消息。Mission wake支持既有requestID回放、返回真实接受后再导航；Task message的202同样是持久接受，但当前严格TaskMessageInput没有caller Message ID字段。本轮不把Task未知结果重发宣称为已具备幂等能力，不为客户端恢复扩展调度/Task协议或制造消息。

共享前端入口覆盖普通Session、Mission、Task follow-up（后续输入）；Side有自己的既有正确接受实现。必须保留其不同真实接受时机，区分HTTP未发出、未接受错误、接受后模型/投影错误、Stop、实际导航、重连/旧authority退休及原输入已被改写。当前问题发生在客户端输入清理/归属，不是调度、队列、唤醒或终态收敛异常。任何真实执行异常出现则立即扩展审计全部生产入口、Task/Mission/Session轮次、正常/终态、重试/重启、串并行和多项目；不以单例通过降级。

## 实施前方案与待闭合调查

先用独立before/38535复现当前首次发送拒绝。正式开发/ui、本人新项目/原件，后台内置页，用户18571、真实库、窗口及进程不操作。仅将本实例新上传的blob/metadata pair可逆移至同一自有run的evidence备份目录，再原样恢复，触发真实canonical reader的500。必须一起保护两文件：只移走metadata会令过期blob成为本来允许回收的未发布物，不能让故障注入本身失去原件。移动前验证两绝对路径位于本人新项目/namespace与备份位于同一自有run，核对原bytes/metadata/mtime；不修改原件字节、不改路由/返回值、不mock（模拟）HTTP、不触及旧项目，并明确这是受控存储故障注入。检查当前错误后字段、附件、真实Session/Message与回到项目的行为，不能仅凭代码称数据永久丢失。

拟让现唯一提交拥有“发出”和“真实接受”两个明确回调：前者绑定当前已准入draft key/epoch并捕获现entry revision，不清输入；后者只清该请求仍拥有的原稿/附件。Session按既有caller Message ID及唯一TreeWriter真实user事实确认，也在正式HTTP完成后确认；Mission/Task在其已有202/200真实接受后、视图重载前确认。新会话工厂沿原moveComposerDraft与preserveComposerAttachments交接，自动Project分配也必须移动同一记录。成功后不留下源launcher副本，错误保留当前准入scope输入，不恢复到旧key或覆盖另一会话/新草稿。

主Session重试使用现composerSubmission保存的caller ID：比较实际请求body的确定序列化字符串，字段仍是现submission.text，表示该请求的内容身份，不把序列化身份写进模型Message。原draft.text继续保存真实作者文本，Side原quoted text调用不变，不新增持久字段/存储版本、散列、平行输入或消息。Mission可沿现requestID能力使用同一内容身份，Task现无caller ID合同则如实保留边界。Stop已明确接受取消后退休对应未接受输入的重试身份、保留原文，不把取消与未知网络结果混为一谈。所有状态清理需精确authority、请求、准入scope/epoch及现entry内容/revision，不拿bool忙状态或最后错误文字推断接受。

实施前还需闭合：TreeWriter接受回执的唯一接入点及完整校验、preparing/dispatch回调顺序，Session创建/激活失败前后的具体scope通知，Task/Mission接受后投影失败路径，以及composer-draft更新和附件编辑的原稿revision保护。未闭合前不修改产品。公共API（Application Programming Interface，应用接口）、SDK（Software Development Kit，开发工具包）、数据库schema和持久格式拟保持；若真实分析迫使改变则先补完整合同/迁移方案。

## 验收与交付约束

准备新单批75分钟绝对期限，所有实例沿同一截止，启动至少余10分钟、结清至少余5分钟。Provider（模型提供方）认证和完整模型目录按现授权配对复制，并分别验证可用注册和精确openai/gpt-6.1-sol投影；before额度0，候选先按未接受错误0验收，确需真实恢复发送时在首次启动前明确最多6（含既有memory前置、读取/回复），累计从1187起算，不向已启动scope增加额度。所有LLM（Large Language Model，大语言模型）调用流式，不派发子agent。

非UI数据/传输改动需要聚焦正向测试；UI只真实交互、原图和人工视觉复核，不写/运行DOM（Document Object Model，文档对象模型）、组件、源码文案、快照或Playwright测试。覆盖失败后真实输入/原件仍可核对、恢复metadata后人工重发、唯一真实用户消息和稳定caller ID、接受后输入清理及新草稿保留、项目/Session范围与两语言反馈；未做矩阵明确记录。旧9Goal公开事实、所有源业务行（正常过期容量槽位复用单独精确验收）、完整真实namespace、原项目业务文件/Git及源认证/模型保持。结束公开shutdown200、原exec/native/launcher0、物理/输出/请求和出生身份结清，退休全部配对副本。

同步三索引，当前docs:check；范围提交、fresh fetch（重新拉取）及普通merge（合并）、完整待推提交审查、正常hook/push和远端回读。保留176无关状态，不创建分支/工作树/Release/tag/PR。持续Goal保持active，上一轮是progress（已产生权威进展），不是仅状态复述。

## 基线完成与实施决定

before实际main-mQQga4p6.js、自有108页，新send-recovery-865-before。01核对32字节original-865.txt；02原提示/附件/精确Sol模型。按已落盘方案把本人pair移到同run evidence，正常Send创建真实Session ses_-zUQHv8A1zzW0Vlh4jFr，但/message在持久化前500；03正文空、附件计数消失、Send禁用。正式GET消息200且数组为空，Provider0，不是模型失败。恢复pair后公开GET200/原bytes、metadata及mtime精确保持。04实际点击返回项目首页同样空白，排除“只在旧Project key藏着原稿”。原9Goal公开事实保持；自有页关闭、公开shutdown200、原exec/native/launcher0、三项物理结清与配对副本退休，无用户窗口操作。

已闭合数据流：TreeWriter只在完整处理真实message.updated后把精确role/user、Message ID/Session ID交给现messageStore的请求owner回调；不增加消息或并行接受缓存。Session服务在准备完成后用实际parts/model的确定JSON字符串调用现composerSubmission，保留同一格式的submission.messageID/text；该text是请求内容身份串，draft.text始终是真实作者原文，Side原quoted text消费者不变。callback注册晚于onDispatch，另读唯一现投影处理已接受重试，HTTP成功也确认。MCP（Model Context Protocol，模型上下文协议）调用若无composer key，保持原独立请求，不参与草稿清理。

请求进入传输时只捕获当前准入key/epoch及真实draft entry snapshot，真实接受时比较现记录内容/updated/quotation/submission；不覆盖已改稿。附件编辑也更新原draft.updated，保护离开页面后的新意图；仍是原唯一draft记录，不增加影子状态。当前scope才清可见附件，接受后的旧owner可以只消费其仍未改动的原稿；断开或导航后的错误不能落到新页面。原quotation补救路径因输入从未提前删除而同步删除，不保留双源。Stop在原远端取消成功后只退休该请求的重试标识，保留未被接受的作者原文。

普通创建传composerDraftKey，工厂在实际创建回执/原move后、激活读取前通知准入Session key，保护激活失败；Mission自动分配也通过原move后绑定Project key。创建被用户取消应为原AbortError（中止错误），不制造“未跨dispatch”失败。Mission现requestID按同一实际body身份使用，不改变其协议；Task现202只按正式返回的持久接受回执清理，且清理早于loadBoard，后续投影失败不能复活已接受输入。Task未知结果重发仍没有caller ID合同，本轮不冒称已解决该独立后端能力，也不引入其调度/重放实现。三个入口的正常/错误、重试、Scope/authority和Stop控制流已横向代码审计；尚未覆盖的真实执行矩阵按实际记录，不以Session单例代替。

接受后HTTP连接失败使用明确“消息已接收，响应状态未确认”本地化反馈，保留原诊断；接受前失败保持原Send failed及可修改输入。不会自动重发或依赖最后错误标题推断接受。副作用回调和所有校验只处理真实数据/请求归属，不改变LLM工具选择、提示词或流程。接口变化仅限上述Overlay内函数/props，公开API/SDK/schema/存储字段均保持。

## 第一候选真实发现与修订方案

第一候选main-CztqQIaB.js真实500后原文、引用附件及Send保留；恢复后从同页重发，真实User仅一条、read完成且回复原值，接受SSE后填写的新草稿在HTTP完成后仍保留，Sources打开真实只读原件。实际message请求观察却证明两次caller ID不同：第一次新会话时body没有model，重试时有openai/gpt-6.1-sol。不能把此候选宣称为稳定重试通过。

已追到selectConversationSession会清空composerModel，而其既有projectComposerModelFromSession配置投影以void异步继续；普通首次发送紧随工厂返回，比投影更早，因此原promptSessionMessage读取暂时空的视图值，省略了真实Session模型。旧纯传输测试显式给了model，无法发现这条创建与模型读取时序。全仓模型读取/投影/Session创建及调用点已核对，当前有效模型的唯一权威是Session config（会话配置）；不能把稍后补全的视图值当作用户改了模型，或给序列化串增加别名匹配/后备ID。

修订：promptSessionMessage在调用者未提供明确model时，先通过既有getSessionConfig读取该确切Session及目录的真实有效模型，验证provider/model引用并构造同一实际body；成功后再次核对authority/selection/Stop，再创建内容身份和dispatch。不写模型偏好、不增加模型状态或公共接口、不等待/改变被动历史投影，不退回另一个模型。失败沿原配置错误保留输入。测试补上“首次无视图模型、重试明确模型”两次真实请求body/ID一致和错误合同。第一候选正常结清；同一75分钟截止内启动新after2/38537、额度首次明确6，沿闭合源完整复制旧数据和模型配对，再重复实页故障/手动重试、中文反馈/新草稿及Source验收。不得延长旧scope或删除失败证据。

## 最终真实验收与复核

最终after2/38537冻结main-C643JuC6.js，110后台页（已关闭），本人新项目send-recovery-865-after2。明确Code Chat与openai/gpt-6.1-sol；配对认证/完整catalog在首次启动前通过注册、精确模型投影及6次额度检查。中文页正常首次发送，在同样受控原件pair移走后正式/message 500；正式GET消息200且为空、Provider0，12图清楚显示作者原文、原件附件和可用发送。恢复pair后原bytes/metadata/mtime保持、公开GET200，直接从页面手动重发，未重新填写输入或附件。

诊断observer仅克隆观察本人请求，不改路由、响应或正文。两次完整真实请求body逐字段相等，Message ID均msg_4cdcaaf2-93ea-411c-9cc8-0b1d12836eb4，模型均精确Sol；正式Session ses_-zUQHnh1CzzNu2ppVia3只保存一条User、附件一项、read真实完成，助手回复恢复输入原值865。真实User到达、HTTP尚未结束时输入新草稿；完成后13图仍保留，14实际点击Sources打开正确只读原件。随后实际reload（重新加载）、返回项目首页、重新进入原Session，15–17验证新稿保留且项目首页没有已发送原稿残留。英/中失败反馈及原诊断分别由06–07、12人工复核；应用内普通预览08保持，未弹出原生浏览器或全屏窗口。09、13截图时响应已结束，不把图片名称或前一步运行状态说成图片本身仍在运行。

23项聚焦纯数据/传输正向测试、55断言：14草稿记录测试（其中5项新revision/引用/取消/身份测试），9真实客户端服务的传输合同测试（首次配置缺位、精确重试/附件改变、真实角色消息回执、接受后投影错误、Session/Mission Stop和Mission已有requestID）。初次测试使用null成功回执被真实TreeWriter拒绝，随后明确改为“接受先发生、投影错误保持原错误”的正向合同；未用桩代替实页。当前命令：

```text
node .tmp-product-iteration/composer-send-acceptance-865/run.mjs unit-drafts bun run --cwd packages/overlay script/run-unit-tests.ts test/composer-draft.test.ts
node .tmp-product-iteration/composer-send-acceptance-865/run.mjs unit-transport-delivery bun run --cwd packages/overlay script/run-unit-tests.ts test/chat-message-acceptance.test.ts
node .tmp-product-iteration/composer-send-acceptance-865/run.mjs types-delivery bun run --cwd packages/overlay typecheck
node .tmp-product-iteration/composer-send-acceptance-865/run.mjs i18n-after bun run --cwd packages/overlay check:i18n
node .tmp-product-iteration/composer-send-acceptance-865/run.mjs ui-build-delivery bun run --cwd packages/overlay build
```

全部上述最终检查0；两语言2688键。没有运行/新增UI自动化或全量bun test。构建使用自有runtime，不执行build:overlay，不碰用户库。非UI部分与UI真实操作分别记录，不互相冒充。

三服务before/after/after2公开shutdown200、原exec/native/launcher0、出生身份及physicalCompletion/outputDrainComplete/requestCleanupComplete均真实结清；6份配对副本全部退役。before Provider严格audit额度0/实际0，旧私有launcher admission展示字段继承6，与实际强制额度不一致；该辅助字段不作为before授权/零调用证据，正式audit及退出证据明确0。after及after2均首次额度6、各实际3、未耗尽，均精确Sol/streaming/200/EOF，累计1187→1193，未增加已启动额度。所有实例同一75分钟截止，退休余量4107518/2674850/2308975毫秒。

schema9/92表保持，三实例既有237113/237179/237991行保留，当前237179/237991/238803。后两实例各2个原本已过期容量槽位由本实例正常复用，精确核对资源/槽位、owner出生与获取/释放时间，其余原行完整相等；源DB全部行原样。完整真实namespace分别207/209/213项、77/78/79旧项目业务文件及Git事实保持，零文件系统排除；九个Goal公开事实前后相同。新项目内部.opencorvus配置属于正式应用工作产物，不把它计作旧项目业务文件。源catalog字节/元数据及认证元数据不变；不读取或记录凭据内容。资格检查及具体增量见verification.json。

风险/边界：Task未知结果重发缺少caller ID公共合同，本轮未扩展；Mission/Stop仅有代码横向审计与聚焦数据/传输测试，完整真实执行矩阵未覆盖；接受后网络错误提示未做视觉故障注入。本轮没有观察到调度或终态异常，不把这些未执行矩阵标为通过。附件离页仍按当前易失契约，未新增持久字段/存储版本；公开API、SDK、数据库schema保持。非本轮176个状态及共享索引他人正文须在交付前后精确复核，正常提交、fresh fetch/普通merge、完整待推集合、hook/push与远端回读仍待交付步骤完成。持续Goal仍active。

交付复核发现Mission现请求owner只绑定本地requestID，没有绑定本轮由wakeMission生成的正式重试身份，导致确认Stop后虽正确取消远端，却不能退休该输入的重试ID。Session路径已绑定并测试，不能据此冒称全部入口都覆盖。修订仅让已有wakeMission.onDispatch把实际body.requestID交给调用者；promptSessionMessage的Mission分支将其绑定到同一现request owner，Stop仍由现forgetComposerSubmission匹配清理，不增加状态或协议。全部wakeMission调用点已搜索，未使用回调的调用者保持；原零参数回调仍可接收并忽略参数。新增严格WorkLedgerMissionRow解析的纯传输正向测试，覆盖真实服务分派、正式abort回执、保留原文与退休身份。此项不改变已截图的Session/UI行为，另跑最终类型检查、构建和聚焦测试；不把Mission纯传输验收宣称为真实页面模型执行。

交付检查已通过：最终9项传输测试39断言，加14项草稿数据测试16断言，合计23/55；types-delivery和ui-build-delivery均0。交付构建main-D2WqW_LM.js与实页冻结main-C643JuC6.js分别记录，后者已真实覆盖Session流程，前者增加的仅是上述Mission服务身份交接，其验收为非UI聚焦测试，不虚称新一轮视觉模型执行。工作期间另一个会话修改了不相交的2026-10-29-heavy-workbench-long.md，本轮保存其当前差异/内容，仅将其作为新增无关状态保护，未修改或混入提交；原176状态保持，加该项共177，不因无冲突并行改动等待。
