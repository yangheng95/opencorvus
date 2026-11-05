# 依执行证据显示导航状态

## Recall

- 用户要求持续自主改善UI（User Interface，用户界面）/UX（User Experience，用户体验）和功能；提问/文件摘要及中文应易懂，单agent（代理），真实页面复核后提交推送，不操作用户窗口。最新单代理要求覆盖旧目标中的多代理措辞，本轮不委托。
- 上轮58d270929已推送并完成原生实页、14项后端测试、8次真实流式调用和冷启动读取，属于有效进展。它修复未来接纳批次遗漏，明确没有重写旧8MGR记录。本轮解决旧输入被显示成持续排队的另一根因，不重复处理已解决的Rendering闪烁。
- 开始HEAD为58d270929；177项其他状态与上轮收尾完全一致。保留它们，不创建分支/工作树，不操作18571、真实用户数据库或窗口，不发布版本。
- 已读：当前02-data、07-panel和task-control-plane；上轮input-batch-acceptance、旧execution-navigation记录；conversation/view、Task execution projection、两类conversation路由、engine/model响应schema（结构）、Overlay的conversation-agents、agent-activity、Rail/侧栏/进度卡及SDK（Software Development Kit，软件开发工具包）生成入口。
- 全仓搜索：状态字面值在后端view、engine/model响应Zod、前端AgentActivityStatus及生成SDK重复；真实执行状态来自prepared worker descriptor、精确agent.execution.lifecycle或可见输入的pendingDelivery。Task/Mission/Session快照和SSE（Server-Sent Events，服务端事件流）连接共用projectConversationAgentView；前端水合及Message/Part身份创建均另有默认pending。未发现本轮目标路径的UI自动化测试，不新增/运行此类测试。
- 原大库延续源是963-before退休的309211行、129项目、299附件；全局模型累计1469，源库自身读取回执累计1461，两者分别有真实账本。963-after只有独立验收的两项目，不能代替大库。本轮仍保留所有独立验收库，不向真实用户数据导入。

## 深度与根因

原Task801最终completed，导航却有一条“orchestrator · 等待中 · 执行8MGR”。该Message有真实Mission原文和第三条Task-root ingress投递收据；上轮已确认其后控制输入hbZ9有实际回复，旧接纳数组只有控制输入。不得根据Task终态替这条Message补写接纳或完成。

本轮只读原协议库：Task有122条agent.execution.lifecycle事件，属于5个不同输入ID（4个控制轮次和1个worker），其中没有8MGR；全库当前pendingDelivery输入为0。该事实不能单独推断调度成功，但结合实际代码足以定位状态标签来源：view.ts的ensureExecution为每条transcript推导的输入建立记录并无条件status=pending；ledger未见状态时也默认pending。前端水合缺省值、live助手身份初建和侧栏选项同样默认pending。由此把“有消息、没有对应执行状态证据”误当成“已排队”，并用执行/开始时间描述记录身份。

现有后端测试还把无lifecycle的已出现助手内容及未接纳输入期望为pending，固化了这一错误推断。准备执行的descriptor和实际pendingDelivery是明确等待证据，必须保持pending；已有lifecycle必须继续精确投影为running/idle/completed/error/skipped，不能借父Task或Session最新状态盖过历史轮次。

这是共享历史/实时状态默认值的共性问题，不能归为单一Task。影响面包括Task根协调/worker、Mission与普通/侧聊Session、初次输入、事件到达前、重连和冷启动；调度、重试、epoch、owner接管与终态 reducer本轮不改变。尚未取得新页面及新协议输出证据，实施后逐项补记。

## 实施方案

1. 在现有transport-protocol导出唯一Conversation Agent状态集合/类型，新增unobserved，含义为已有消息/身份记录、未记录对应执行状态；后端view、Zod响应和前端类型改用它，删除重复字面值源。公开SDK/OpenAPI（开放应用程序接口描述）由当前生成器同步生成，不手改产物，不建立旧协议兼容分支。
2. ledger、transcript-only记录及前端缺省/实时身份初建使用unobserved；真实prepared仍pending，可见原输入pendingDelivery=true仍pending，精确lifecycle继续覆盖。原Message、接纳数组、input/execution ID、活动、排序、定位和Task终态保持，不新增持久状态或迁移。
3. 前端重连合并中，明确执行状态优先于unobserved，不让Message活动时间戳把已知lifecycle降成未知。其他已有精确状态的比较保持。无记录输入仍可定位和阅读，使用“消息记录”“记录…”及记录时间，解释缺少执行状态的事实；双语同步，保留真实agent/file/原文身份。没有等待动画或完成暗示。
4. 后端纯数据正向测试验证neutral、原pending标记、prepared、精确lifecycle、批次身份与其他Session/历史错误；过期pending期望按新合同修复。测试不导入UI、翻译、DOM（Document Object Model，文档对象模型）或组件。UI只通过真实交互、截图人工复核，类型/构建不替代视觉验收。
5. 修改当前02-data/07-panel公开合同与三索引。风险为新状态遗漏消费者、错误覆盖真正等待/终态、实时与水合不一致或SDK生成牵连其他差异；须全仓复查状态映射，正常类型与OpenAPI/SDK检查、真实HTTP（Hypertext Transfer Protocol，超文本传输协议）和SSE读取及保全证明后交付。

## 资源与验收

分配服务/数据/成对凭据前写入新共同60分钟绝对截止，至少保留5分钟正常收敛；before38807、after38808、可选final38809，全部0模型请求，累计1469保持。不使用963旧截止。完整复制上述原大库、配置、项目/Git和附件；隔离原生开发/ui，前后实际打开同一Task801，查看8MGR标签、时间、键盘/点击定位与原文、已有执行和worker侧栏，切换中英文并重开。

API/SSE逐字段保护原身份、顺序、全部原工具/提问/文件摘要/Goal事实，仅按新证据合同变化缺省状态；有自然的真实pending样本才称其视觉通过，原库0排队标记不能伪造为实页排队验收。焦点类型/SDK/普通Node前端构建与当前文档检查，正向后端用例；不发新模型请求。

各阶段正常shutdown 200、原exec句柄exit0及物理/输出/请求结清、成对凭据/完整模型目录副本退休，逐行保全原库/全部项目文件/附件。scope（范围）复核后提交，获取并普通合并上游、检查完整待推集合、正常hook推送；结束前保留177条其他状态，持续目标仍进行中。未实测完整编排、崩溃恢复和所有实时乱序不得称已通过。

## 实施与证据

before 38807已核对同一原任务：01的Task页显示已完成，但8MGR Tooltip显示等待中/执行/开始时间；02实际Enter定位至原23秒消息组，03从该组展开第一条调度上下文读到真实Mission回复，没有执行历史指令。公共接口另证Task793也有一条无对应执行投影的输入被默认pending，故不限定终态Task。六个Task/Session/Mission样本共32条导航记录，已有29条明确状态，三个默认pending视图（包含同一8MGR的Task和Session视图）应依证据变为消息记录。

before已正常shutdown、原句柄exit0、配对副本退休和全部原行/129项目/299附件资格通过，0请求/累计1469，共同截止余量3250030毫秒。开始按上述方案实施共享状态、后端/实时缺省、SDK、双语与导航说明。

消费者复查发现TaskDirBar聚合摘要把所有非终态记录计作“进行中”，新增neutral若直接沿用会形成第二处错误标签。因此在修改该消费者前补充方案：unobserved独立以“消息记录”计数，已有明确非终态/终态计数语义保持；选择入口优先真实非终态，仍通过现有目标打开。此分支没有自然的neutral child样本，不伪称其视觉通过。其余真实worker/来源/导航页面仍须实看。

后端完整schema用例进一步覆盖只有Session身份、尚无Message的ledger条目。因此在启动after页面前收紧双语措辞为“状态未记录”，说明仅有消息或会话记录；不一概声称已保存消息。记录ID/记录时间仍保留，聚合摘要独立显示未记录状态的数量。首次该schema测试误把Zod union当作object访问shape失败，已改为对真实规范ID的完整投影执行公开union解析；11项/18断言通过，原失败保留。SDK生成完成，首次UI构建通过；精确措辞重建后再发布到尚未启动的after实例，不复用旧图。

首次类型检查又定位到侧栏整合约束：选中子会话的记录状态直接传入真实transcript Card，CardStatus另有一份相同六状态类型，因新增unobserved正确报错。本轮同时让CardStatus引用同一共享类型，保留真实状态而不强制转换为idle/completed。相邻utils/card-tree的私有normStatus全仓只有定义，无调用或导出，旧failed/done别名转换不在任何运行路径；删除这一已审阅的死块，不增加新调用或兼容实现。其他卡片构造、终态推导和渲染算法不改。构建的语言字典为独立i18n资源，字典修改不要求主JS名称变化；按当前完整发布目录验证而不以主文件摘要充当功能验收。

after已取得6个API样本/32条记录的逐字段比较：恰三处无证据pending变为unobserved，原29条明确状态和原文、身份、顺序、活动保持；两条Session连接SSE的11条记录与HTTP精确相同。11项/18断言及SDK、8包类型、路由、文档、语言检查通过。04英文Tooltip、05中文Tooltip、06Enter定位后展开同一Mission原文、07相邻真实idle执行均已人工查看。05提示末尾“态。”单独换行，虽含义正确仍不作为最终视觉交付；已缩短双语提示，使用预先声明的final38809/0请求复核。after正常收敛后才复制final，不增加原截止或请求额度，不重写历史。

final的08英文/09中文已确认短提示正常换行，10查看真实已完成worker时发现中文导航仍写“全部 Agent”。搜索确认同一翻译键仅供该侧栏的两处成员返回入口使用，不涉及用户原文或成员身份；在本轮已触及组件内统一改为“全部成员”，保留英文翻译。重建后仅发布新生成的独立中文词典到本轮隔离开发包，关闭并重开自己的页面复核，不修改用户服务、不延长截止、不重新启动服务。

上述运行中发布计划经实页证伪：新开自己的35号页仍显示旧文字。继续读取OverlayUI.routes契约确认，原生服务在注册路由前冻结完整静态资源，属正常的整包一致性保护，不能靠替换磁盘词典热更新；不改此契约，不注入页面状态。final已正常shutdown200、原启动句柄exit0、两份副本退休，余量500331毫秒；309215→309217仅增加正常lease/grant，原所有行、129项目/Git、299附件、schema10/92表保全，0请求/累计1469。964三个阶段全部结清，不延长原截止。

为最后这一已构建的中文源变更另开独立只读验收965：在分配任何新资源前写入20分钟绝对截止，保留5分钟收敛，端口38810、0模型请求、累计1469。来源严格为已退休且资格通过的964-final大库及当前最终生成UI，不重用其进程或冻结的资源。先复制完整数据/项目附件及成对凭据和模型目录，分别检查认证、目标模型投影；真实页面查看“全部成员”和中性记录，正常关闭、清退副本并再次保全。此阶段仅补验当前词典，不能把它声称为新执行编排或未覆盖的实时竞态验收。

965真实设置切换简体中文后，11看到“全部成员（1）”，实际点击返回，12看到唯一真实base-tester成员及已完成状态；既有中性8MGR仍可见。认证200、模型投影准确，6个API样本32条记录及2个Session连接快照11条记录再次保持精确合同。正常shutdown200、原句柄/启动器exit0、物理/输出/请求结清、两份副本退休，保留1041403毫秒余量。309217→309219仅增加正常lease/grant，全部原行/129项目/299附件/schema10/92表保全，0请求/累计1469。四次页面均未改用户服务、窗口或数据库，自己的所有页面已关闭。

本轮11项后端正向用例/18断言、实际SDK/OpenAPI生成、8包类型检查、普通Node构建及语言检查通过。保留首次Zod测试、类型和运行中静态词典发布的失败证据及对应修正。最终文档/推送检查随交付复核。未取得自然排队/neutral child实页样本，未重新触发完整编排、崩溃恢复、重试与新实时乱序，不宣称其端到端通过；旧Message及accepted数组没有回填。
