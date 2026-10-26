# 停止控制与模型独立性

## Recall

用户要求持续自主体验并改进整个当前产品，只有用户明确停止才结束。最新长期约束是单 agent，不委托、不创建分支或 worktree（工作树），不重启/刷新/操作用户18571进程、窗口或真实数据库。Rendering/Sources 闪烁已关闭，原普通首页 Composer、加号和 /goal 入口为已接受设计。当前目标文本里的旧三Astra并行要求被后续单agent指令覆盖。

上一 Goal 回合属于 progress（实际进展）：0043fa1a6修复Goal表单/无模型控制/初始化阻塞收敛，06d2f07b3修复四类归档/恢复；均独立正常提交并push（推送）exit0，fresh fetch/merge后06d2本地/上游0/0、自己的源/证据无未提交修改，全部正常hooks（钩子）通过。615–621自有服务与标签全部关闭，配对认证副本退休；真实Sol请求累计167。当前main06d2，0.1.28正式发布由同行以c27129a72冻结，版本/CHANGELOG/原生构建/部署定义与发布spec不改。177项旧视频/图清理、三个README整理和.bun目录保持，仅真正冲突才等待。

已读当前AGENTS、上一归档完整Recall、03-control取消/物理所有权/恢复合同、唯一project-route-context、right-sidebar-conversation/session/orchestrator/mission停止路由、Task API（Application Programming Interface，应用程序接口）的requestTaskCancellation/cancelTask/独立owner、cancellation-scope、Task agent lifecycle、Mission closing effects、independent-project-owner、host-recovery、InstanceBootstrap、Task控制平面与已有Prompt取消/归档/取消权限测试。全仓生产搜索显示requestTaskCancellation只有Task cancel HTTP（Hypertext Transfer Protocol，超文本传输协议）入口；其它Task取消沿同一canonical cancelTask。未发现或运行本批UI（User Interface，用户界面）自动化测试。

## 修改前现象、触发与根因候选

上批实际归档400已修复；本批停止问题当前仍是源码线索，不伪称真实网页复现。GET历史与归档可用，独立POST /coding/(chat|work)/session/:id/abort、/session/:id/abort、/mission/:id/abort、/task/:id/cancel及/task/:id/session/:sessionID/cancel仍归runtime，在进入真实取消前验证执行模型。Task的独立HTTP取消另经cancelTaskWithIndependentProjectOwner调用runWithInitializedIndependentProject，入口分类单改后仍可能第二次被模型拦截。

原停止handler分别保留会话Project/体验/领域权限、精确Prompt取消与原输入终态、Task取消原收据/lease/ingress/权限结清、Mission closing/closed及子Task取消；子会话取消要求真实projected-worker runtime contract。它们停止现有工作，不执行新模型能力，不能省略这些真正的完整性/物理边界。直接触发、实际状态与错误合同须用完整Server.App和真实领域事实先验证，不能仅凭名称推断。

旧路径遗漏：多数低层取消测试直接调用service或子Hono路由，不经过项目模型初始化；原分类测试显式保留abort=runtime。独立取消所需的请求外寿命由现有Project lease和RuntimeExecutionSettlement持有，不能为规避模型验证而退回调用者已关闭的lease。修改应复用独立identity primitive（基础组件），不另建取消队列、并行状态、副本或fallback（后备路径）。模型执行和恢复执行仍要求原完整初始化，不按body/提示词路由模型行为。

## 共享机制横审与未知项

正常、原terminal（终态）、重复取消、显式重试、Task/Mission/Session当前occurrence（执行轮次）、多项目与串并行都纳入。已知Task pending cancellation控制平面回调在InstanceBootstrap后绑定；host-recovery的启动目录初始化也先经过模型preflight（预检）。因此恢复一个已接受但未结清的取消可能与入口有同一模型依赖，必须先做真实失败再决定如何在原canonical取消实现中修复，不能只修独立HTTP入口就声称根治。

控制平面已有活跃Instance的独立lease/driver、正常执行、shutdown（关闭）和rollback（回滚）路径已定位。冷启动pending取消、Mission closing恢复及projected-worker停止的实际模型依赖尚未知，正在审查原发现/分区/lease与测试夹具；这些未知项在修改前补齐。OAuth取消是认证流程，与执行停止领域分开审计，不按关键词混入本批。不修改版本、持久schema（结构）、迁移或原消息，不合成UI消息/模型回复。

## 验收与实施顺序

1. 先建立聚焦正向后端合同：使用完整Server.App、两个真实临时Project和不可用模型配置。Chat/Work/普通Session必须取消精确原Prompt并保留原输入终态；Task必须返回原取消收据并结清；Mission及子Task保留原closing/closed事实；projected child保留原runtime identity；跨Project/领域误用返回原明确错误。全部原pending Promise结清后退出，先保留修前失败。
2. 独立验证Task直接取消、延迟物理收尾/请求外寿命、重试/并发、冷启动恢复和同Project兄弟/多Project隔离。若共享恢复入口失败，继续追到原调度发现和清理机制，补齐方案后再修改；不得用局部通过覆盖它。复用已有真实协议writer与fixture（夹具），无效夹具失败只记工具资格。
3. 完成根因后，在唯一分类/原独立取消owner及必要的canonical恢复入口修复，删除替换的旧调用，不增加另一实现。完整执行初始化仍归执行入口；取消始终经过原领域权限、物理收尾和终态writer。当前架构、公共响应及全仓消费者同步核对。
4. 真实UI使用新自有开发CLI（Command Line Interface，命令行界面）的/ui及普通Node构建，先核对listener/ui-ready再开标签；不单开Vite、不写或跑UI自动化。若实际模型/命令执行需要凭据，成对复制已授权auth和完整models，分别验证凭据、模型投影与实际gpt-6.1-sol/stream=true。预算最多8请求含预检/辅助、累计167起点、上限175；测试只在自有会话，有限任务，不建子agent。Provider删除可能影响配置/凭据，先查真实效果，不主动撤销用户认证。
5. 每次自有运行20分钟物理边界、十分钟目标关闭并留五分钟结算。原exec/进程、physical/output/request全部结清后退休配对副本；观察超时不重启。来源仅用已关闭621自有库只读复制并逐表核对，原消息/工具/Provider/协议事实保护；任何真实合法活动列更新精确绑定目标，不宽泛忽略差异。
6. UI实际交互/截图人工复核，后端聚焦正向测试与当前测试扩展类型、必要构建/语言/文档检查；更新证据、当前合同和三索引，范围独立提交。正常fetch/merge、全部待推集合审查和完整hooks push后继续下一批，不把一轮成功或源代码调查当全产品完成。

## 合格红测试与实施前共享恢复决策

新完整Server/领域checker原始8项均失败、11断言：Chat/Work/普通Session的Stop实际400 ProviderModelNotFoundError且原ownerAborted=false；Task/Mission入口同在模型preflight前被拒绝；Task独立取消直接在第二层初始化拒绝。原Task pending夹具通过真实cancelTask和25ms物理收尾无活动超时得到TaskCancellationIncompleteError、原cancelling收据后，由原owner.finish结清；Mission夹具通过真实closeMissionExecutionOperation及原连接AbortSignal中断，保留原closing/requestID。冷恢复仍未收束这些原意图。原runner全部physical/output结算，exit1并保留输出，不用夹具直接写假终态。Task恢复观察将先断言恢复后的生命周期，再请求原收据，避免后一次显式请求错误掩盖先前恢复状态。

共享根因进一步定位：host-recovery先发现active/cancelling Task、Mission closing/delete/中断执行，再对整个目录直接runWithInitializedIndependentProject。Task cancellationReconciler也只在InstanceBootstrap内部、模型校验之后绑定；因此完整初始化既挡住显式停止，也挡住请求已接受后的冷清理。正常已初始化的控制driver仍在自己的独立Serving lease中收束取消；不应把执行driver改成另一套无模型执行器。

实施决定：停止六类精确POST路径使用已有Project identity上下文；Task detached owner替换为runWithIndependentProjectIdentity，保留请求外lease与RuntimeExecutionSettlement，不复用已关闭调用者。host-recovery在原执行发现之前增加一次现有canonical取消/retention的清理阶段：按同一Task目录发现和Mission候选发现取得明确Project身份，调用原reconcilePendingTaskCancellations；从原scanMissionExecution提取唯一Mission retention/closing清理函数，同时供原scan与冷清理调用。清理只处理已存在的取消/关闭/retention，不唤醒模型、不注册另一个队列。之后重新从原当前领域事实发现真正待执行工作，沿原完整初始化/同一driver与scheduler恢复路径执行。原Mission attempted/completed按真实同一候选核对后累计，不拿清理计数冒充woken。清理失败按Project/候选隔离并保留精确错误；物理未结清不伪写cancelled/closed。

风险与后续本批验证：原pending取消在冷identity入口遇到物理暂未结清后，是否仍被当前控制平面正常重试尚未实证；请求结束后的延迟收尾、同Task并发/原收据复用、两个Project与显式scope、停止后的正常新执行、projected child runtime authority均继续验证，发现失败继续按同一共享机制修正，不以首8项转绿交付。OAuth remove已确认会修改配置与本地凭据，本批不为制造模型错误而撤销用户Provider；实际Provider/Shell网页验收与不可用模型的完整Server合同分别注明覆盖边界。

623实际长命令Stop于约35秒结清、原工具为MessageAbortedError；原Python中文命令真实cp1252 UnicodeEncodeError保留，不算停止通过。续聊发生E2E_REQUEST_BUDGET_EXHAUSTED，原8次Sol流全部settled，累计175；623原native/launcher/exec均0，shutdown200，提前669903ms关闭，认证和完整模型副本已退休、来源保持。续聊不得宣称通过：624只读复制已关闭623（保留同会话原消息/工具/错误），相同普通Node构建，新鲜自有38132监听、配对认证与模型预检，最多8次含预检，累计最多183；只发送一个明确无工具回复请求，十分钟目标关闭、二十分钟物理期限和五分钟余量同原合同，不扩展命令执行。

## 当前实现与验收事实

修复唯一公开分类、独立Task取消owner与原host-recovery清理阶段；抽出的Mission清理函数同时服务原scan和启动清理。未改变schema、执行模型准入、原取消收据、物理所有权及领域终态写入。23项后端正向测试通过50断言（13个停止/恢复、10个路由）；补充两个Project的scope恢复，第一轮只结清原Project，第二轮仍保留cancelling，随后按同一请求结清。原8项修前全失败证据保留。扩展测试先暴露surface字面量/空数组推断错误，已按声明类型修复；backend与最终扩展类型检查均0，普通Node构建0。未写/跑UI自动化。

623实际Sol调用普通180秒Shell，每秒输出stop-check，连续31行后手动Stop，原MessageAbortedError携带原user/session.abort/requestID；界面工具取消、Composer恢复。Bash源码会等待disposeAndWaitForExit，公开Session abort等待原Prompt完成；本次未另留命令进程身份，不将服务native结算冒充单命令独立物理观测。第一中文命令真实cp1252 UnicodeEncodeError、exit1保留，宿主与隔离locale归因待实证。623首次续聊预算耗尽保留；624从已关闭623逐表复制，冷重启同一原会话后真实流式回复“停止后会话可继续”，并保留原工具/错误。截图01–05均实际查看，原1119×720左捕获不宣称右侧像素验收。

623/624使用8/4个真实gpt-6.1-sol请求，全stream=true、HTTP200、reader settled；累计179，624余4额度退休。credential可用、models投影及实际模型分别预检。原exec64944/69554、native、launcher均0；shutdown200，physical/output/request均结清，提前669903/1092742ms关闭；自建tab9/10关闭后退休各auth+models副本。来源auth/model元数据与模型字节保持。原来源92表9567/11975行保持，目标关键9表278/345原事实保留，仅原会话真实活动时间推进；无用户数据库/服务操作。

仍未满足：projected child只验权限错误，非完整物理子agent验收；冷identity取消物理失败后的在线周期重试尚未资格验证，不能称共享取消全链根治；实际模型不可用以完整Server契约验证，付费UI运行可用模型。此批先交付已证实的入口/请求外寿命/启动清理修复，持续Goal保持active，下一批继续真实故障恢复与中文Shell环境，而非重开已关闭闪烁。同行独立0.1.29发布提交4c3860bee及177项清理工作保持。
