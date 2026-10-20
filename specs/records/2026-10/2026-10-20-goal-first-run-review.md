# Goal 首次使用、确认说明与模型配置

## Recall

持续单开发 agent，不委托；用户后续单 agent 指令覆盖 active Goal 的旧三 Astra 文案。上一轮476为progress：bbc517a720749179866881cdd02359194441482e已正常push，fresh fetch后HEAD=origin/main。Goal有界正文滚动/固定操作区、真实revision冲突当前额度显示修复通过19次人工截图（07/08重复实际图）、9个实际gpt-6.1-sol流式200/EOF请求；同一个QA Goal六轮/205123累计及明确暂停先于第六回复完成、operator完成均有原事件。before62334/after76553 exit0，physical/output/request/runtime与private完整auth/models对结算；源metadata保持，无refresh/exchange。原QA147 Project/196 Session/schema3，全部旧身份/来源记录和canonical保持；当前仅原.bun/与packages/opencorvus/bun/未跟踪。

用户原始需求仍是深入体验并持续修复UI（User Interface，用户界面）、功能和缺陷，尤其Goal可理解性、默认页布局、Sources与Rendering；本线程长期Goal未完成。476实图17/18明确暴露Home确认前“授权当前会话”“先完成当前目标”的措辞与尚未创建Conversation的事实不符。原完整保存10秒/恢复5秒仍失败，不能因本轮体验改进改写其门槛。

已读476 Recall/根因/最终资格、当前continuous-goal与06-provider模型契约，ContinuousGoalControl两个about调用/objective_hint/guide、Home确认handler、Conversation factory、普通Composer modelAvailable/global提交、workspace resolveGlobalComposerSubmissionContext、composer-model projection、唯一agent/model.ts及Goal controller。当前模型解析只有显式请求/Task或Session overlay/agent配置/顶层model；没有“首个Provider”“最近模型”或环境猜测。Home appStore.composerModel为空也可能合法继承，所以不得用空字符串做新阻断或新模型事实。现有native413 wrapper的owned-host分支可监督任意真实CLI Target，不要求使用其Task/Sol预检分支。沿用computer-use/IAB2和benchmark-debug-template；禁止UI自动化，不动用户18571或既有147/196历史库。

## 修改前深度分析

已证可观察措辞缺陷：Home点击创建目标时没有当前Conversation，scope.new_chat已准确说明“确认后创建新对话”，但共享about和objective_hint仍假定当前会话/目标已存在。直接触发是两个locale的同一共享key；调用仅介绍与创建表单，共用组件覆盖Home、现有Chat/Task/Mission/SideChat。此前472改确认边界、476改滚动与版本复核，没有纠正这两个陈述。数据、API（Application Programming Interface，应用程序接口）、schema、预算、权限、模型和调度不因文案需要变化。不能为不同入口建立平行Goal逻辑或修改用户/模型原文。

尚未知的首次启动体验：没有配置模型时，普通Home与Goal都允许继承配置；新环境根本没有可继承model。当前Goal自动续跑在原SessionWake/model resolver内处理，具体是否返回创建错误、持久化输入/错误、如何向用户显示及如何恢复须真实验证。不能凭按钮或源码猜测故障，也不能把缺少model误报成凭据错误。若发现调度/恢复异常，立即横审全部Chat/Task/Mission/Session occurrence、正常/终态、重试/重启、串并行和多Project，以现有恢复/模型配置机制收敛，不以UI提示掩盖执行失败。

## 实施前方案与验收

1. 创建全新自有477-first-run root/project/home/appdata/localappdata，在导入生产模块前绑定OPENCORVUS_HOME并清理继承环境。只复制完整模型目录元数据，不复制/读取凭据，不配置model/small_model，不使用existing147/196库。原413 owned-host +现有release helper监督真正源码CLI serve18809，使用当前476正式UI、真实startup receipt/managed parent/health。原20分钟监管寿命和180秒无活动观察保持；超时不视为句柄已终止，不重启用户进程。此阶段不冒充真实Provider验收。
2. 在真实/UI页面查看中英Home/介绍/创建与取消，确认没有提前创建会话；再明确创建一个有限1轮Goal，观察无配置模型时的公开返回、真实Message/control/error和Goal事实。配置、凭据、目录投影分别记录，错误按实际code/日志判断。未获得实际请求证据不声称Provider0次或凭据可用。保留所有真实失败记录，不清库/改写旧消息，不伪造成功。
3. 根据实际失败/恢复面补方案后实施。已证措辞使用同一共享key的通用、确认后时态，明确创建后objective固定和模型/权限沿用事实；指南说明应先连接/配置可用模型，同时保留合法继承，不添加appStore空值gate（流程门）、隐式模型fallback（后备路径）或另一配置面。若功能故障成立，先完整分析共享定义/调用/契约与恢复路径，再提供正向合同和真实复验；不能只记录问题或仅改提示。
4. 源码改动后正式build、冻结新UI并启动新隔离scope实际截图人工复核。若需要真实模型恢复，另建完整私有auth+models对，源不refresh/exchange/写入；启动Task前分别验证凭据、目标目录投影与实际精确gpt-6.1-sol流式请求。此阶段最多6次/整批最多6次实际请求（含memory/helper），前一scope完整结算及最终计数后才能分配，不能活跃扩额。沿现有Model选择/配置、公开Auth API或启动前stageDiagnosticProvider及原Retry/Resume恢复，不另建工作流或直接篡改数据库/运行凭据。
5. 每scope公开shutdown、原native physical/output/request和launcher完整结算；真实source reader EOF后退休完整运行对，再经实际秘密值扫描退休private对。关闭自有页面；新root只做首次体验，不缩窄原完整保存性能或已有历史资格。若触及非UI行为，相关正向测试需进入真实checker；不得新增/运行DOM（Document Object Model，文档对象模型）、组件、源码文案、Playwright或截图断言测试。三索引/当前文档检查、范围提交、fresh fetch/merge、完整待推集合与正常hook push/fresh fetch。长期Goal保持active。

## 实际无模型失败与实施前补充分析

18809真实首次创建pev_g0VYbMZ8t00C0MskiYW0 / ses_-zUROdQv5zz44ZJn5zu0：取消后公开ledger为0 Chat；确认后Goal active、0 tokens/0 accepted turns、Message空。截图04显示Active/Not running且无失败提示。dev.log每秒给出同一work MissingModelConfigError，原因不是凭据：SessionWake的canonical preflightUserMessageModel在Message/receipt落盘前拒绝，controller的scheduler外层仅log。

横审：唯一reconcileContinuousGoal同时供scheduler正常/重启和直接checker；Chat走SessionWake，Mission外包原opened occurrence admission再走同一Wake；Task经deliverContinuousGoalMessage/buildTaskSessionMessageBundle/messageContext，以taskID调用唯一resolveAgentModelRef，在原Message/ingress/epoch事务前抛同一类型。accepted recovery分支仍进入原SessionWake或Task ingress，不能另建重试状态。边界、暂停、预算、活跃Prompt、FIFO（First In First Out，先进先出）、Interaction、worker settlement及Project隔离判断均在同一reconciler/store中；新处理不能替代或绕过它们。

决定：只对真实typed MissingModelConfigError，将当前Goal的同一revision通过既有updateContinuousGoal记为blocked，reason使用单一可本地化的model_not_configured，author为真实goal-controller；原配置错误日志保留。这个事实明确表示配置阻止执行，不由Host判断目标完成、不选择模型/工具。使用确定requestID+expectedRevision；并发Pause/完成/归档/新revision仍由原事务拒绝，禁止覆盖。未知错误保持原错误路径。新字段、schema迁移、OpenAPI响应形状、model resolver、Provider调用及普通Message协议不变。配置可用模型后必须用户显式Resume，继续同一Goal并保留计数；没有model时再Resume应再次明确blocked。原receipt若已接受仍保留，不能重复计数。

实施：共享reconciler包裹唯一typed处理，既有UI reason映射中加入模型配置说明；修正共享about/objective_hint/guide。增加非UI正向合同覆盖Chat/Task/Mission、重复读取/恢复、旧usage、并发revision/多Project和配置后的原流式恢复；真实/UI复验先确认blocked与原失败Goal保留，再检查中英guide/form。原before scope先公开Pause/shutdown和物理结算，源凭据仍未读。若后续需真实Provider，先完成原定成对资格和6次硬上限。

## 实施与完成证据

唯一reconciler新增typed配置阻塞处理，使用同一个updateContinuousGoal事务和确定requestID；并发同一错误正确重放同一blocked修订，用户Pause竞争得到原revision_conflict并保留用户决定。进一步全仓核对MissingModelConfigError构造点，effective.ts的矛盾task/session lineage错误没有agent字段；仅agent-bound缺配置进入本地化reason，结构性错误沿原路径抛出。没有改模型解析优先级、权限、消息身份、正常Task/Mission admission、数据库schema或OpenAPI形状。

正式5文件功能检查35例/214断言通过：新5例覆盖三owner、usage17累计、重复读取、显式未配置重试、确定请求并发重放和用户Pause竞争；已有30例覆盖正常/终态、归档恢复、跨Project、晚usage、原流式进程重启及跨进程收敛。最终agent字段收紧后5例/27断言复验通过。第一次并发用例错误期待同requestID返回409，实际store正确重放同一个blocked；改为验证真实重放/唯一作者，另写用户暂停竞争正向错误合同。最后类型检查发现as Error阻碍unknown收窄，去掉类型断言后原typecheck exit0；运行语义相同。

实际/UI：13张截图均已呈现并人工查看，[全部证据](../../artifacts/2026-10-20-goal-first-run-review/README.md)。首个修复页面从同一paused Goal显式Resume，在缺模型环境投影blocked/0轮，英文原因可见。中文发现“继续”与现有“恢复”按钮不一致，修正共享locale、重新正式build（50.39秒+renderer surface）并冻结final bundle，再启动独立recovery scope。最终中英guide/form均完整，目标创建后不可变、确认前时态与模型/权限说明准确，取消未增加会话。截图08真实保留新对话hover浮层，没有作为闪烁或新缺陷推断。

真实Provider恢复：在前两个scope完整结算后，新建私有完整auth/models对，仅映射原授权access，未refresh/exchange/写源。调用成熟stageDiagnosticProvider，在原自有根canonical配置明确设置model和small_model为openai/gpt-6.1-sol，然后启动源码CLI。凭据可用、完整catalog中的精确模型和actual request分别验证；预检2次实际200/EOF，之后才点击原Goal“恢复”。模型同一Goal调用update_continuous_goal完成并实际输出FIRST_RUN_477，最终1轮/33,611令牌。整批4/6次请求全部流式200，全部original source reader EOF，无活跃扩额。恢复从原Goal/Session继续，原失败决策完整保留，最终新根2 Project/2 Session/schema3，其中另一个是预检；没有对历史147/196库或用户18571运行操作。

原native scope对应原exec：before21090、after13492、recovery32185均exit0，公开shutdown都200；各ready/settled中实际PID（Process Identifier，进程标识）与birth身份、物理完成、output drain、request cleanup及launcher事实已收录。四条source reader结算后退休运行auth/models；1412个实际文件秘密值检查clear、源metadata unchanged后退休私有完整对。自有tab33/34/35均关闭。完成证据中的ready/settled为原始观察，不使用早期摘要中不同层级的parent PID代替真正Host。

日志保全限制：修复前活跃时原工具确实读到14:52:20.417Z至24.421Z每秒相同MissingModelConfigError；随后CLI重启替换dev.log，原文件未冻结。最终collector误把当前dev.log的0次当作历史计数，该无效产物已删除，改为明确标注的[当时工具观察记录](../../artifacts/2026-10-20-goal-first-run-review/model-failure-observation.md)。不会宣称已保全原始失败日志；截图、12条原Session协议事件和三个owner真实resolver检查仍可复核。

检查：backend及overlay typecheck exit0；i18n为2 locales/2523 keys；docs:check为345 ops/26 groups；architecture-index为20 current documents。正式UI构建使用dist-vite并附renderer检查，没有运行任何UI自动化。新增记录和artifact已更新三个索引；当前架构同步同一阻塞/恢复合同。提交前已复核44个本任务暂存文件并检查实际凭据值clear。Git交付采用范围提交、fresh fetch/merge、全部待推提交复核和正常hook push；此处不预称尚未发生的推送结果。

边界：本轮真实Sol恢复只验证Work Chat；Task/Mission配置缺失有真实resolver正向合同，不冒充其Sol端到端。没有覆盖服务商登录和模型选择器完整设置流程，使用的是明确设置canonical默认模型后的实际页面Resume。原完整配置保存10秒/恢复5秒仍未达成，Sources/Rendering长期广泛体验仍继续；不能由首次使用小根或本次Goal完成推导长期任务完成。
