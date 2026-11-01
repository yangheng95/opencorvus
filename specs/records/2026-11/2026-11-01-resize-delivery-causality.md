# 会话切换的 ResizeObserver 通知因果调查

## Recall

用户要求持续单agent自主体验UI/UX（User Interface/User Experience，用户界面/体验）与功能，真实隔离页面、截图人工复核，验证后提交推送，不操作正在使用的窗口。旧Goal多个Astra委托已被明确单agent要求覆盖；不委托。上一轮属于progress（权威状态已改变）：b159a4bbf534917ca9a2398f8130c4b574ab3adf修复Goal本地化操作检索，正常推送检查通过，17实页原图，Goal表单/预算/帮助往返及原稿保留已实际验证。2026-11-01T11:36:13Z fresh fetch（重新拉取）/普通merge（合并）后HEAD/upstream均a65cd9101，0/0；a65是另一授权benchmark（基准测试）会话的独立SQLite准备交付。本人28文件/索引行完整、保留176无关状态；不能冻结另一会话的索引或临时检查目录，不因无冲突改动等待。

本轮git status保存.tmp-product-iteration/status-before869-private.txt，HEAD a65cd9101。闭合源868-after：schema（数据库结构）9/92表239592行，86项目124会话784消息2225 Part，217真实附件、9Goal。两旧服务原native/launcher0、全部物理/输出/请求结清，4配对副本退休；模型0，累计1193。不重开旧scope（作用域）或延长旧截止。868前后版本分别在11:10:42.118Z和11:18:47.178Z记录相同ResizeObserver delivery文本，原日志是debug，每个时间有两行；不能据行数认定两个浏览器Error事件，更不能据名称判根因或断言仍是旧Rendering闪烁。

已读07-panel的共享AutoGrowTextarea、对话虚拟化/读位、Dock/对话/预览测量合同；main错误分类/记录、AutoGrowTextarea、ChatComposer工具栏观察器、animation-frame、SourceParts/ToolPayload调度，以及Oct11/Oct21旧调查。旧记录确认这些通知未证明整树重置，读位稳定也未证明所有观察器正常，根因仍未定位。全仓源码清点26处直接new ResizeObserver，包含主输入、Side/Mission/Goal共用输入、对话/卡片、Dock、引用摘录/ToolPayload、预览、CodeEditor、设置及交互产物。多数已有createAnimationFrameScheduler；输入框回调调用resize并同步height写入，工具栏回调同步改变布局状态。它们是候选而非已证根因。未修改产品或运行UI自动化。

## 分析与证据边界

可观察事实是旧Task恢复或Home到旧Session切换时出现原浏览器通知，未见模型调用/执行失败。直接触发回调尚未知，不能更改错误分类、吞日志、把所有观察器盲目包RAF（requestAnimationFrame，请求下一动画帧）或仅以错误消失冒充布局正确。输入框以宽度变化过滤自己的高度通知，但仍在观察回调中重设auto、读取scrollHeight并写最终高度；宽度过滤不等于本轮绘制没有尺寸写入。工具栏依据实宽选择full/icons/overflow，也可能在回调中改变被观察结构。须将实际回调/目标/前后样式、框尺寸和window.error按时间关联，排除库内观察器及其它同语义路径。

权威资料已查：[MDN ResizeObserver观察错误](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver#observation_errors)、[CSSWG工作草案的处理模型](https://drafts.csswg.org/resize-observer/#deliver-resize-loop-error)、[WHATWG绘制顺序](https://html.spec.whatwg.org/multipage/webappapis.html#event-loop-processing-model)。通知说明有当前绘制周期跳过的尺寸观察，并不单凭其文本证明无限循环；应检查尺寸写入和稳定收敛。帧调度可以推迟写入，但也可能只把循环搬到下一帧，必须以实际尺寸/读位/交互验证。本文将源代码和实际运行作为本项目根因依据，不把通用文档当本项目诊断结论。

影响面横向审查包括所有实际观察器定义/调用、隐藏再显示、挂载/销毁、主/Side/Goal/Mission输入、对话内容和工具栏、缩放/宽度变化、项目与API（Application Programming Interface，应用接口）authority（权限上下文）退休。暂无后台调度/队列/恢复/并发/终态异常证据；若发现，立即按共享Task/Mission/Session所有生产入口、执行轮次、正常/终态、重试/重启、串并行、多项目审计，不能拿UI成功排除执行问题。数据库/API/SDK（Software Development Kit，开发工具包）/持久格式与LLM（Large Language Model，大语言模型）流式合同不拟改变。

## 被动诊断与实施方案

新75分钟共同绝对截止；before/38544诊断、after/38545候选诊断、production/38546正式构建，共用截止，启动至少余10分钟、结清余5分钟，不增加运行中模型额度、不重开或延长。依次完整复制最近已闭合库和全部真实附件namespace（命名空间）、旧项目业务文件/Git，源只读；schema9/92全部非内部对象、每一旧行和9Goal完整公开事实逐项复核。三个scope首次额度均0，按现授权配对认证和完整模型目录，分别预检注册与精确openai/gpt-6.1-sol投影；不点模型发送或Goal开始，不把投影说成远端模型验收。只开本人隐藏IAB（In-App Browser，应用内浏览器）新tab、完整CLI开发服务/ui，不碰用户18571窗口/服务，不启动独立Vite。

诊断前端沿当前Vite正式配置构建，插件只在构建内存中为真实ResizeObserver回调加被动记录，保留原原生constructor/回调参数/同步调用/返回/异常。记录precomputed（浏览器已算出的）entry内容框和目标id/class/inline style，原回调前后仅读属性，不额外强制测布局、不修改DOM（Document Object Model，文档对象模型）、不安排额外RO/帧/输入事件、不替换请求响应、不伪造消息或测试夹具。每个观察器具源文件/行标识，诊断window.error只将有界原回调记录送入既有AppLog.debug；原错误处理完整保留。库模块中同样语义的直接constructor也按AST（Abstract Syntax Tree，抽象语法树）处理，未覆盖的构造形式要明确披露。插件/诊断源码都只在.tmp自有工具目录；生产源保持，不能把诊断构建用作性能分数或正式最终视觉交付。

实际手动重复868的Home/旧Task恢复、Home搜索并切换旧Session，以及输入/打开关闭Dock、Side、预算与Goal帮助等适用入口，保存原截图并人工看文本/滚动/尺寸是否稳定。先从实际回调证据完成根因与旧路径未根治解释，再落盘具体修正；只修根因涉及的唯一现有primitive（基础组件），删除替代旧路径，不添加第二状态/observer/布局配置。若诊断不足以定位，继续修观测工具，不修改猜想中的产品机制。

候选诊断证明因果链和最终尺寸收敛后，另用普通压缩正式构建重跑真实页面、宽度/内容/隐藏显示/关闭重开/原稿/读位/焦点；诊断模块不得进入正式产物。UI只手动真实交互/原图/人工复核；不写或运行UI自动化、DOM/组件/源码文案/快照/Playwright测试、浏览器fixture（夹具）或像素断言。追踪是实际生产路径的被动诊断，不作自动UI断言；如改动非UI数据合同，须有聚焦正向测试。类型/国际化/普通构建/docs:check及正常hook要通过，不替代视觉验收。每个服务正常shutdown200、原exec/native/launcher0、物理/输出/请求/出生身份结清，全部配对副本退休。三索引同步、清晰范围提交，fresh fetch/普通merge/全部待推集审核和正常push回读；持续Goal保持active。

## 首轮诊断与工具补全

before38544、本人成员tab117、main-CUC8feRV.js，原native handle65717保持运行，未重启。首次构建实际记录49个constructor，含26个应用内定义。真实恢复Task793，01原图实际查看；被动记录有四个不同performance时间/event序号的通知，服务批量flush使用相同墙钟时间，不能再把相同日志时间当事件去重依据。通知前尾部是对话虚拟窗口多轮实际高度变化，应用Conversation与dom-utils回调前后属性不变，不支持先归因AutoGrow。

实际读取virtua/solid/lib实现发现`new (L(H(r)).ResizeObserver)(e)`，首工具只识别全局Identifier，漏了属性访问constructor。这是诊断覆盖故障，必须补齐再重跑而非据缺失记录判因。修正AST识别括号内PropertyAccess/明确同名ElementAccess，保留原constructor表达式与参数求值，只包原callback。第二诊断在同一原生服务发布新的不可变命名资源，原v1所有资源/index副本/日志保留；只更新本人bundle的HTML入口并重新导航本人页，不动用户窗口、不重开scope/模型额度或延长截止。后续payload带publication，区分两个页面寿命和原事件。

实际交付校验纠正：第二诊断构建50处（26应用+virtua属性constructor），磁盘新index已写，但真实DOM script和独立HTTP读取仍为main-CUC8feRV.js，HTTP200/no-cache；该原服务缓存了旧入口。没有冒称V2已被体验，也不篡改请求/响应绕缓存。本人tab117已关闭、原服务正常shutdown200及原handle65717退出0；结清/配对退休与逐行资格完成后，新增fresh before2/38547，从这个闭合副本完整续拷并在启动前装入main-DxKxD1_k.js。仍沿同一个13:03:50Z绝对截止、首次额度0；旧实例不重启、旧资源/日志/失败发布证据全部保留。后续是否需要候选after和正式production scope由已确认根因决定，不为消除已知库通知预先改产品。

## 完整探针的因果结论与方案收敛

before2/38547实际DOM script为main-DxKxD1_k.js，03原图已人工查看。恢复Task793的四个不同事件performance时间4034、4149.1、4296.6、4335.7ms，每个前约0.8–5.1ms均有真实virtua/solid回调；首事件记录观察项从隐藏、估算top320px到已测top400px，后续top1889.03→2047.64、2047.64→2082.67。相同墙钟12:07:42.207Z是服务flush，不是相同浏览器事件。切换保留Session865、打开/关闭Sources文件Dock、展开/收起原附件的事件5–10同样紧邻Virtua尺寸回调；事件9随后还有CodeMirror/CodeEditor的仅读属性回调，不能仅凭最后一条回调错误归因CodeEditor。

安装的virtua0.49.3实际Solid条件解析lib/solid/index.jsx，1075构造观察器，1088–1106把原contentRect送入ACTION_ITEM_RESIZE；525–537估算/更新消息尺寸、shouldSync=true并解释同步更新用于减少可见跳动且可触发该浏览器通知。README对应条目也明确说明。对照main.tsx现有精确消息分类，当前已经作为debug记录，不是执行失败或用户错误弹窗。此次真实证据支持在已观测恢复/内容重排中由虚拟化同步测量产生有界通知，不支持把AutoGrowTextarea或toolbar猜想当修复根因，更不支持“旧Rendering闪烁仍存在”。不修改库、不新增全局RAF、不吞日志、不升依赖。

本轮收敛为有证据的诊断交付，删除尚未实施的候选after环节。before2闭合/退休/全库资格通过后，production/38546从before2完整续拷、装入普通正式构建，额度首次0、共同截止不变，人工再核对正式页面的来源、阅读、输入、工具面板与预览。诊断构建不作最终产品交付或性能依据；新功能性迭代另开完整方案和预算，不在当前0额度实例发送模型请求。04原图是会话切换的加载中间态，05是完成态；07实际是内联附件展开而非弹窗，将修正文件名和清单，不冒称已检验独立弹窗。

## 正式构建工具修复与并行工作边界

首次构建命令错误地把--cwd放在run之前，Bun输出帮助但退出0；读取完整日志发现后保留该失败工具证据，不把它算构建通过。修正为`bun run --cwd packages/overlay build`，真实Vite构建及renderer public surface checker均0。production初次准备随后因共享dist-vite在另一授权紧凑面板会话构建期间改变、复制目标缺index而失败；此时尚未产生preparation/配对凭据/startup、服务没有启动或admit（准入），不能称实例重启或扩大额度。

根治准备工具的共享输出冲突：沿原Vite正式配置用Node启动、仅把outDir改为本人唯一production-ui-owned目录，普通压缩构建0，441真实资源逐字节复制核对；未改产品构建脚本、不使用独立Vite服务。保留原不完整UI目录为同一bin下ui-partial-before-start，重新逐行核对已复制库与baseline/source、全部附件后完成原production首次准备，不删库、不重开scope。最终启动入口main-DNRBKxif.js。before2全部旧239597行保留，新增自己的项目/两记忆行/两运行租约共5行，239602；9Goal公开事实保留，物理/输出/请求结清，认证和目录2副本退休，模型0，余3044819ms。

真实诊断before2使用已启动冻结的旧页面；正式页面使用当时工作区的正常构建，包含另一已授权紧凑面板会话的15个UI/样式工作文件。已读该会话Recall与具体diff，Conversation改动仅首页说明/动作容器，另有Scheduled筛选容器及样式尺度；不改变已定位的虚拟化回调合同。本轮不编辑、暂存或替它宣称全部验收通过。其独立变更和shared indexes（共享索引）持续演进应保留；只能在自身改写边界证明同伴内容保留，不能以冻结其它会话作交付条件。新ffc4a201b是另一SQLite真实配对benchmark独立记录，推送前单独审核完整待推集。

## 真实复核与闭合结果

共17原图已逐张人工查看。完整探针实际观察Task793恢复、切换Session865、Sources打开文件Dock、附件展开/收起、多行输入、工具面板宽度变化/关闭。10个通知集中于首次测量及实际内容高度变化；12:11:17最后一条之后继续真实输入与面板操作，闭合原日志仍10条，不能据此外推所有页面。来源身份、文件内容、草稿和阅读完成态均可见。正式普通压缩页119/38546实际入口main-DNRBKxif.js，重复恢复、会话、原件Dock、窄工具栏/多行草稿、Goal普通表单与帮助返回、关闭后原输入。没有因本轮观察触发系统全屏或操作用户窗口。此轮没有新增产品bug修复，根因澄清的价值是结束对已修闪烁的错误追踪，转向有真实影响的功能；不把诊断产物包装成功能交付。

三个实例均正常shutdown200、原exec/native/launcher退出0、精确出生链物理/输出/请求结清；全部6认证/完整模型目录配对副本退休，源认证metadata/目录原bytes与metadata保留。依次旧239592→239597、239597→239602、239602→239607；新增仅各自项目、两文件索引记忆和两运行租约共5行。schema9/92表及全部非内部对象、全部原业务行、217附件、86/87/88旧项目文件/Git均保留，未重用过期capacity slot，无文件排除。项目最终89，124会话784消息2225 Part不变；9Goal三次实时公开读取保留，模型0、累计1193，最终退休距原绝对截止2616621ms。未触碰真实用户数据库，也没有数据库升级。

验收范围明确：被动探针是诊断，不是UI自动化或性能分数；普通构建与真实页面/原图才是最终视觉证据。未执行Goal开始/暂停/恢复、模型或调度新轮次，因此不宣称这些功能新验收通过。下一批优先继续完整Goal功能与真实模型链路，用新的首次预算与绝对截止，不重开本轮实例。文档检查、提交及fresh fetch/普通merge/正常push另由实际回执收尾，持续Goal保持active。
