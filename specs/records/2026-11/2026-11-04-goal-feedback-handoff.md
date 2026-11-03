# 持续目标等待反馈与继续交付

## Recall

- 用户要求持续自主改善整个UI（User Interface，用户界面）/UX（User Experience，用户体验）和功能完成度，使用真实模型端到端验收，单agent工作、实际页面与截图人工复核后提交推送，不操作用户正在使用的窗口或18571服务。后续单agent要求覆盖旧Goal目标中的三Astra委托文字。
- 上轮922为实质进展：已记录比较增加原行/新行与新增/删除说明，修正680–799px审阅区过早双栏造成列表筛选折行和正文压窄；三独立实例/15图真实复核，提交b87dadb3已正常推送。2026-11-03T19:16:09Z重新获取/普通合并后HEAD=origin/main、0/0，21本人普通文件与8个语言字段/3索引行已提交，179条无关状态保留。
- 资格源为已正常退役的922-final：schema（数据库结构）10、92表、279261行、109项目、269附件/元数据文件；累计模型请求1341。上轮final有一份具名项目记忆可用性代次1→2，与原日志时间窗对应，业务内容/源库/项目文件/Git/附件保持，不能说所有旧字段精确。
- 已读当前AGENTS、continuous-goal架构的相关完整合同、07-panel持续目标/归属与消息合同、915实际开始工作与完成验收、874/878/879入口和预算记录，当前Goal工具/Schema/Store/Controller、ContinuousGoalControl的创建/状态变更/保存、main启动接口及原922的隔离验证基础设施。没有委托。
- 全仓搜索覆盖等待外部输入、blocked/paused/active/complete、人工输入与自动轮次、恢复授权、Goal请求归因、前端保存/状态按钮和所有当前Goal生产入口。Goal状态由原protocol_event投影，普通人工消息和自动goal-controller输入是不同真实作者；恢复不清空用量，已接纳请求可在预算到达后结束，不能从最后标题/状态推断调度异常。
- 目标是完整“持续目标→第一阶段文件→等用户确认→真实反馈→最终文件→完成”的体验。首阶段等待可由真实Interaction（交互）或明确blocked（外部阻塞）事实承接，必须保持第二阶段尚未完成的事实；不强制模型选择某个工具或在host（宿主）增加文案识别/工作流路由。
- 本轮开始前新模型请求0。首次准备前声明共同75分钟绝对截止、至少5分钟正常结清预留；before/after各最多22次精确gpt-6.1-sol流式请求、整批最多44，累计起点1341。可在同一边界追加只读final阶段，额度0；不重置截止、增加请求额度或因观察超时重启实例。
- 产品内本人QA（Quality Assurance，质量验收）Goal使用明确输入的Token总限额2000000和自动轮次上限3；它们不同于诊断请求数上限。每阶段新建独立本人项目，只放明确合成的brief.md/actions.csv；旧项目只读保护。首阶段proposal保留原字段4行/3未完成；确认A-03从open变closed后，final应4行/2未完成，原CSV与proposal保持。
- OpenAI认证和完整模型目录配对复制；目标启动前分别验证正式账号接口可用、Provider（模型服务商）投影和实际请求模型一致。凭据不进日志/规格/提交。上轮实际登录有效，仍以本轮正式读取为准，不强制轮换或要求用户重复登录。
- 禁止UI自动化测试，包括文案断言、DOM（Document Object Model，文档对象模型）/组件/快照/浏览器夹具/截图基线；不运行已有此类测试。真实原生开发`/ui/`、隐藏独立页，截图人工查看。数据/请求检查只能证明其各自合同，不能代替视觉。

## 修改前调查与影响面

915已真实完成一个Goal，920已真实执行文件交付及人工跟进；这不能证明第一阶段等待确认、反馈到达后的继续执行与完成体验。当前不存在已证实的新产品缺陷，必须先走完整当前版本流程，不凭旧图或已修复问题再修改。

当前控制流：Goal的active/blocked/paused/complete与预算由唯一Store投影；Controller在complete/paused/blocked时停止新自动续轮，Interaction、SessionPromptOwner（会话执行所有权）和真实Task/Mission入口保留原权限。人工消息可以作为独立真实输入被接纳，Goal恢复/预算变更需明确用户授权。Goal工具直接提供给模型，只能按真实目标完成或具体外部阻塞更新，不合成用户反馈或从自然语言生成隐式调度状态。

本轮实际触发点、根因和旧路径未覆盖原因尚未知。可能影响目标状态条/原因/详情、原反馈控件或普通输入框、消息归属、请求/用量关联和文件交付；不是预设这些路径已坏。若发现任何调度/队列/唤醒/恢复/并发/终态异常，立即横向审计全部生产入口、Task/Mission/Session执行轮次、终态与正常路径、重试/重启、串并行及多项目隔离，依据代码/持久事实/真实运行排除共享根因后才定性；不得以模型自述或单例通过降级。

若是纯UI问题，只改已有唯一呈现并做实际交互复核；若需改接口/提示词/工具/共享运行合同，先全仓补定义、调用点、同语义实现与历史决策调查，落盘确定方案，再补非UI聚焦正向测试。当前不计划API（Application Programming Interface，应用程序接口）/SDK（Software Development Kit，软件开发工具包）、schema/迁移、发布、依赖或权限改动。

## 首次验收方案

1. 从922-final复制隔离数据，复用其最终普通前端main-DuXKZypz.js；端口38684/38685（只读final若需要用38686）。每阶段自然注册一个新QA项目，启动默认目录指向新项目；原Office目录仅保留公共文件合同回归。75分钟/44请求共同边界先落盘，不单开Vite（前端开发服务器）或热换运行产物。
2. 正式账号接口接受、配对模型投影后，从真实页面明确选择openai/gpt-6.1-sol，打开持续目标表单，确认项目/模型和3轮/2000000Token预算，输入两阶段工作目标；实际创建与首个模型请求必须归属刚确认的同一项目/Session/Goal。
3. 第一阶段只从原CSV生成并回读proposal.md，保留编号/责任人/截止日/状态；请求对A-03的状态确认，第二阶段仍未授权。实际查看等待原因、第一文件、状态条/详情与可用反馈入口。等待应有真实交互/外部阻塞承接，不能让第二阶段在确认前擅自完成。
4. 通过模型实际提供的交互入口或普通页面输入，给出真实QA确认：A-03已完成，状态open→closed，其余字段保持；明确继续同一个持续目标并交付final.md。若需显式Resume（恢复）界面操作，先保留反馈，再通过既有操作明确恢复，不靠改数据库或模拟事件推进。
5. 自然运行结束后核对Goal完成证据、真实Session空闲、所有模型流/原Tool输入输出、第一/最终交付逐行字段/排序/4与3→2统计、原CSV和proposal原字节保持；人工消息、目标控制器消息和自动轮次/Token归因各按真实参与者及请求开始事实报告，不预设准确请求数或必须两轮自动输入。
6. 每阶段初/末公共读取15原Mission（多步任务）、4原Task（任务）完整状态和根会话、24Mailbox（信箱）/查询、3原Office文件合同及915已完成Goal。完整原业务内容、源库、旧项目文件/Git、附件受保护；原生启动只操作隔离副本，迁移注册检查仅内存SQLite（嵌入式数据库）。
7. 固定绝对时间内以有界只读观察脚本/原进程句柄检查进展，不监听长日志或因等待超时重启。正常shutdown（关闭）200、消费原进程exit0，物理出生身份/输出/请求结清、配对副本退役和完整保全后才继承后测。遇到实际故障修根因；没有故障不造补丁，有确切未覆盖项明确记录。
8. 同步规格、验收证据与三索引，当前docs:check及必要检查通过后范围提交；获取/普通合并上游、审阅全部待推提交、正常推送并复查状态。保留并行发布会话与历史删除等无关改动；不创建分支/工作树、不变基/强推/跳钩子或发布。长期迭代Goal保持active。

## 当前状态

before原生38684、独立隐藏页256，正式账号读取HTTP200且ok=true，模型投影与实际13次流式请求均为openai/gpt-6.1-sol、200/EOF（正常流结束）。真实Goal `pev_g0VZwLVjD00U77xRGpKi` 在当前单一Session先交付542字节proposal，保持4条/3未完成；自然question等待确认。19:29:24Z的6次请求检查点只有proposal，Goal active、1/3自动轮次，尚未授权最终文件。

## 实页确证与实施前决定

图04在真实问题弹窗输入完整确认草稿，图05按Escape关闭后，对话内同一请求的文本框回到空值；没有提交或拒绝问题。随后只能重输同一真实QA确认并点击Answer。代码根因：InteractionDialogHost和CardParts都复用InteractionCard，但每个组件实例分别拥有customText/drafts局部signal；Dialog关闭卸载自己的实例，inline实例一直持有另一份初值。shared reply mutex只统一请求提交，并未统一编辑事实。旧404修复同一个不可变Question的重连对象身份，530修复焦点离开与主动关闭，均未覆盖两种同时挂载表面之间的编辑交接。

修改前全仓搜索确定当前生产调用为CardParts、InteractionDialogHost、SideChatPanel，Board通过CardParts消费；Question规范化/重放保持请求身份，回复仍经interaction-reply按现有endpoint和目录路由。相关测试只命中side-chat-transport服务合同测试，属于非UI传输，不作为视觉验收、当前不需运行；未命中目标组件的现存UI自动化测试。未发现新的调度、队列或终态异常：真实回答后同一Goal在1个自动轮次内继续，19:34:52Z已complete、Session idle、470051Token；实际最终文件与字段仍待checker复核，不能仅采信模型完成原因。

实施限定为InteractionCard唯一UI组件内的共享编辑owner：以当前API连接authority、项目目录、回复endpoint及interaction ID精确归属；同一待答请求的已挂载表面共用一份选项和原文signal。使用现有Solid signal/memo/cleanup，挂载引用计数只管理编辑状态的生命周期，最后一个表面卸载后的当前微任务回收；保留同一批次重挂载和关闭Dialog后仍挂载的inline编辑。切换API或不同项目/请求使用独立owner，不宣称跨页面刷新、最后表面关闭后的持久草稿。删除原每实例两份草稿，保留局部busy/error和唯一提交mutex，不增加第二pending队列、存储、API、权限、调度、schema或非流式模型调用；不增加额外配置和工具选择gate。

风险为两种表面的选项/文本同步、组件重挂载清理、API/目录身份隔离和默认选项；需在修复后原生38685重复真实两阶段工作流，实际编辑/选中后Escape，从inline继续同一草稿并提交；查看最终文件与Goal状态、原文反馈持久事实，并进行中文界面截图复核。多选/自定义关闭/跨API切换等没有真实触发的边界须保留限制，不用静态或DOM断言冒充。当前07-panel同步记录编辑owner的准确生命周期，类型/构建/文档检查只证明集成。

## after确证与回答历史可读性补充方案

after38685普通构建main-B3Xi2ME_、独立页257，同样正式账号HTTP200/ok与精确模型投影。真实Goal `pev_g0VZwOZI300sc5tIc1qy` 第一阶段6次流式200/EOF、190377Token、1/3轮，只交付774字节proposal。图10通过实际可见标签选中“改为closed，继续”并输入完整确认，两表面同步；图11按Escape后inline保持完整文本和选择，图12通过现有Settings切换中文返回，草稿仍在，实际中文“回复”提交成功。第一次直接对透明原生radio调用浏览器check未改值，重新读取页面后通过可见标签成功；这不属于产品失败证据，不重复猜测。首阶段read deliverables在目录创建前返回精确File not found错误，模型随后自然apply_patch创建目录/文件并成功回读；保留这个真实工具失败，不能把13次流200等同于工具全部成功。

中文提交后图13又确证历史把被选中的技术value `closed_continue`直接当成回答名称；用户当时看到的label是“改为closed，继续”。直接触发是interactionAnswerLines对canonical response.answers字符串直接join；原选项的value/label已完整保留在同一interaction.payload.questions，未用于历史呈现。全仓搜索该导出只由本工具函数及CardParts历史使用，Task与普通Session同一显示路径，SideChat消息投影仍沿既有合同；当前目标路径没有命中UI测试。旧历史只保留原回答数据，并未区分已选选项身份与自定义原文，不是服务或模型选择错误。

在实施前限定补充方案：仅在当前transcript UI文字投影中，将精确匹配本问题option.value的选择呈现为其原label；自定义回答和无法匹配的原值按原文保留，不翻译用户/模型事实、不改canonical答案和工具输出。两个已有answers形状使用同一私有格式函数，不增加协议或兼容分支；保持Markdown/问题标题/自动回复与权限历史路径。以同一75分钟边界内0模型请求的final38686读取已正常闭合after，重新普通构建、实际打开该原Session检查历史中文选项与完整自定义原文，比较旧持久事实并查看最终文件和Goal详情；不造夹具或重新发模型请求。只读final是新增呈现的复核，不能冒充重新执行整个模型流程。跨API、多选和原页最后表面退休后的草稿持久性仍未资格。

### 冷读复核未通过，撤回未资格的标签候选

final38686、只读0额度、页258实际读取923-after后，工具与自然模型文本保留，但实时页中的Question请求/回答独立历史没有重建。当前Session hydration的board没有interactions，只返回pendingQuestions；前端hydrate/connected只准备这些pending，已答Question仅存在原实时页的standaloneInteractions集合。因此仅改文字formatter并不能证明历史阅读已修复，不能把该只读页称为标签通过。原bus_publication_outbox中的真实question.asked/replied、原Tool输入/结果与完整原文均仍在，current-goals-proof核对12个原Tool请求/结果、Goal与文件保持；这属于冷读显示合同缺口，尚无新的执行/调度或数据丢失证据。

已先保存并逐行审查本人标签差异，仅撤回transcript.ts和对应三行当前架构候选，未触及其他改动；本轮交付仅为已在main-B3Xi2ME_真实全流程验证的共享回答草稿。final的main-EzNWZF0-是未通过标签资格的只读候选，不能作为已交付标签修复证据。后续优先从真实Question持久事实、Session hydration/connected/历史分页、Main/SideChat/Task公共显示合同调查冷读重建并统一可读标签；不靠伪造消息、工具夹具或重发模型补历史。当前未满足“标签历史完成”明确保留，长期迭代仍active。

## 本批已验证交付与保全

两个实际工作流的checker通过：第一阶段检查点只有proposal，真实Question回复时序早于final写入；两个原输入文件与提案原字节保持，按截止日排序的四行/十六字段逐项对照，final仅A-03状态改变，未完成3→2。两个Goal分别470051/472109Token、同一Session和项目、1个真实goal-controller作者输入/1个自动轮次，终态complete与Session idle；各13次精确gpt-6.1-sol流式200/EOF，所有requestContext同一真实work/Provider/模型，不含记忆模型请求。before12个Tool完成，after11个完成加1个具名的创建前目录读取错误；实际创建与三文件回读均完成。功能checker不代替17张实图的人工视觉。

三个原生实例38684/38685/38686均正常公共shutdown200、原launcher/service exit0、原出生身份物理结束、输出和请求结清；6份认证/完整模型目录副本退役，原账号来源与模型目录保持，累计1341→1367。schema10/92表不变，279261→282551→285807→285809行；前后测各复用一次已过期容量槽并在本owner时间窗释放，不能称全部旧字段精确。除此之外原业务内容、源数据库、109/110/111个旧项目文件与Git、269/271/273份附件/元数据保全；只读final原行全精确。六个初/末公共检查点的15原Mission、4原Task完整状态和根Session、24/24信箱与2/7/0查询、原Office三文件200/404合同、915已完成Goal345102Token/1轮/idle均保持；final两次再次检查本轮两个Goal及原12组Tool请求/结果和所有交付字节。

正式账号接口三个scope均HTTP200/ok，未强制刷新仍有效的原认证、未要求用户再次登录。用户18571及正在使用的窗口/进程/数据库未操作。0.1.44由独立发布会话冻结3827428ac并完成发布，754b92499证据提交已到当前main；本批与上批b87位于冻结点之后，不宣称已包含在0.1.44安装包。本agent没有发布、tag、远端管理写入或向其他会话发消息。

主要验证命令（均已执行，非UI测试）：

```text
node .tmp-product-iteration/goal-feedback-handoff-923/check-workflow.mjs before
node .tmp-product-iteration/goal-feedback-handoff-923/check-workflow.mjs after
node .tmp-product-iteration/goal-feedback-handoff-923/current-goals-proof.mjs initial
node .tmp-product-iteration/goal-feedback-handoff-923/current-goals-proof.mjs final
node .tmp-product-iteration/goal-feedback-handoff-923/qualify.mjs before
node .tmp-product-iteration/goal-feedback-handoff-923/qualify.mjs after
node .tmp-product-iteration/goal-feedback-handoff-923/qualify.mjs final
bun run --cwd packages/overlay typecheck
```

普通Node/Vite构建及对应类型检查均exit0；交付依据为after真实页面和main-B3Xi2ME_，额外标签候选构建成功不代表其阅读验收通过。当前docs:check通过352个接口操作/26组。交付范围为29个本人文件和三个共享索引行，当前架构仅七行草稿生命周期说明；采用独立暂存索引保留并行未提交内容，正常钩子、获取上游/普通合并、完整待推集合复核及实际推送结果以本轮Git交付说明为准。多选、custom=false、跨API/独立Task与SideChat本轮新提问、跨刷新及最后表面退休后的草稿持久性不在已达成资格中。已答Question冷读与标签仍未完成，明确列为后续优先项。
