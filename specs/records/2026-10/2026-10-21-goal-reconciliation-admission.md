# Goal调度在执行前读取真实工作需求

## Recall

499持续单agent，不委托；长期Goal旧三Astra描述被用户后续多次单agent要求覆盖。上一轮是progress：2685cb9ca658eef1946ccc81805a77ade443ab37已正常推送，fresh HEAD=upstream，11项正向合同、六项真实HTTP（Hypertext Transfer Protocol，超文本传输协议）、五张人工截图及90表131156原行保留；本轮开始status仅原.bun/与packages/opencorvus/bun/。498全部自有服务与页面已结束，不重启用户进程或窗口。

用户要求自主持续体验修复、内置浏览器调试、实际验证后提交推送。沿benchmark-debug-template技能，已重读498 Recall/交付、当前continuous-goal架构及controller/store/schema、Scheduler、Project identity/independent owner/bootstrap、Goal HTTP和Tool入口、SessionWake/完成回复、Task根ingress（入口）与Mission恢复、Task/Automation/Event初始化调用及对应非UI测试。全仓搜索全部reconcileContinuousGoal/initializeContinuousGoals/plan/request调用；仅根AGENTS，无子目录规则。当前问题是调度共享机制，不能当单个历史Chat局部故障。

## 修改前根因与影响面

498真实Source CLI（Command Line Interface，命令行接口）after日志中，continuous-goal每秒重复goal project reconciliation failed，前一阶段config.validate拒绝原openai/gpt-6.1-sol。该库完整保留一条intent active、turnBudget1/已接受1、已有最终回答的Chat Goal。外层SQL（Structured Query Language，结构化查询语言）只选最近创建且最新显式意图active的目录；预算、owner关闭/取消、Prompt物理运行、已答复和恢复资格只在进入完整InstanceBootstrap后才由canonical Goal/执行投影计算。模型不可用使初始化先失败，永远到不了本来应返回budget_limited的协调器。模型可用时同样会无工作地初始化/保持项目能力，故根因是执行需求判断晚于能力初始化，而不是Provider凭据本身。

直接加预算SQL过滤会复制事实来源并漏掉已经接收、耗尽最后额度、尚未答复的崩溃恢复。既有reconcileGoal明确先检查上次已接收输入再限制新轮次，必须完整保留；暂停/blocked/complete返回、活跃Prompt、Task交互/等待/dispatch结算/FIFO（First In, First Out，先进先出）、Mission子Task/关闭与同一Message身份也不得跳过。

横审入口：HTTP/原生与投影Tool均只改变同一store事件，由server启动与InstanceBootstrap注册同一全局Scheduler id；普通执行和重启都用同一reconcileContinuousGoal。Scheduler activeByTask/starting/coalesced使同id轮次串行，项目与owner原Promise.allSettled并行；独立Project owner清除调用者Database/Instance上下文。Task交付仍通过deliverContinuousGoalMessage及持久ingress，Chat仍SessionWake，Mission仍admitMissionExecutionWake与Prompt owner；Task取消/epoch、Mission opened occurrence、Session owner物理代次与原恢复入口不变。其他Automation/Event/host-recovery/SessionWake调用完整初始化是其已确认执行生命周期，不修改通用helper或放宽运行权限。读取探测与完整初始化必须顺序分离，先释放identity lease（身份生命周期句柄），防止持有只读lease等待其自身排空。

本轮不会清库、改schema/迁移、改模型/配置、改LLM（Large Language Model，大语言模型）工具/提示词、增加后备路径或影子队列、隐藏/合成消息；不修无关命名或UI（User Interface，用户界面），不新增/运行UI自动化。ProviderModelNotFoundError的执行失败仍是原合同，不能伪称本轮已把它变成可执行或持久blocked。真实模型请求预算0，不复制auth/models；已有本地可控流式Provider仅作进程与恢复合同，不能冒充真实Sol质量验收。

## 实施前方案与验收

1. 提取当前reconcileGoal的单一事实决策为内部只读计划，返回明确idle结果或原continuation request与accepted/recovered结果；reconcile与调度探测复用同一函数。保留现有分支顺序、完成回复判断、相同receipt/Message身份，不缓存或持久化计划。
2. 每个粗目录先用现有runWithIndependentProjectIdentity扫描同一projectGoalOwners并解析当前事实。只有计划需要交付的owner进入原runWithInitializedIndependentProject；identity作用域返回后才初始化。执行时重新resolve/read/plan，原事务preflight、revision/frontier/occurrence与Prompt owner仍为最终授权。删除原“先初始化再对所有历史owner协调”的被替换调用位置，不保留双路径。
3. 用现有真实数据库测试primitive补充正向候选集合合同，覆盖Chat/Task/Mission、未开始active、明确pause/complete/blocked、turn/token预算派生、已接收待答复及回复完成。候选集合返回准确可执行owner，配合当前状态/同一receipt/用量正向输出，不用“不调用初始化”型负向测试。现有聚焦Goal/模型阻塞/独立项目与本地流式进程重启测试证明执行路径，不能冒充Web UI或真实Sol。
4. 以已关闭498原运行日志抽取原时间线/失败次数和对应真实Goal事实作为before；源库只读。完整90表131156行和5键canonical复制至新的499隔离服务18883，复用现有native20分钟资源边界/无活动180秒启动超时、正式c1前端。after通过真实Source CLI开发/ui手动查看Goal与详情截图；固定观察窗检视同路径实际运行日志，记录原错误/初始化实际计数及canonical候选结果，不能只用日志无错误代替功能。
5. 结束自有服务public shutdown、原handle exit/native物理/output/request/launcher/原出生结算，复查完整原数据/字段/时间/rowid/主键、schema3/integrity、源bytes/mtime及完整canonical。原失败样本保留；不提交私有原全库行JSON（JavaScript Object Notation，数据表示格式）/DB/凭据/原运行历史。三索引/docs同步，范围提交、fresh fetch/merge、全部待推送审查、正常hook/push/fresh相等。不得使用force/rebase/no-verify或另开branch/worktree。

尚待真实复测；长期Goal不因本轮局部通过完成。原完整149目录配置保存10秒/恢复5秒未达，交付成果/持续目标命名冲突和其他UI问题不被本轮声明覆盖。

## 验收中复核与补强计划

新增三种owner测试首轮漏填update.reason，原明确ZodError（结构校验错误）保留；只修正测试输入，重跑19项/106断言通过。其他模型阻塞5项、独立owner15项、持久进程1项、原本地流式恢复1项通过。原流式恢复测试只直接调用reconcileContinuousGoal，尚不能证明本次改变的全局扫描/identity释放/完整初始化链。因此在交付前把该私有恢复worker改为启动真实initializeContinuousGoals，由原一秒Scheduler从同一预算耗尽输入自动恢复，保留真实2次stream=true请求、原Message/receipt/轮数/最终回复断言；移除不能由Scheduler直接提供的outcome自述，改记录实际驱动和既有持久事实。触及的等待改为依据barrier/请求/消息进展重置的无活动超时，初始私有进程的有限hold仅是资源边界。此本地可控Provider合同仍不冒充真实Sol或网页质量。

## 实施、真实结果与二次复核

生产controller已提取单一只读plan，返回原idle outcome或原GoalContinuation。全局扫描先在独立identity下取得精确owner候选、退出lease后才进入原完整初始化，再resolve/read/plan一次；Task/Chat/Mission仍走各自原交付，revision/frontier/Message/receipt/Prompt owner及持久事务权限不变。原分支被替换，无平行预算SQL、第二队列、缓存计划或执行绕行。当前架构同步这一合同。

最终聚焦五文件合计41项/260断言通过：修正输入后的Goal19/106，原模型阻塞5/27、独立owner15/119、持久进程1/4和新全局调度流式恢复1/4。原48565整组因输入错误exit1保留，20570重跑19项exit0，21679全局恢复exit0；backend类型73764 exit0。新全局恢复在第一私有Prompt进程结束后，由真实initializeContinuousGoals扫描/identity探测/完整初始化/SessionWake启动第二次本地stream=true请求，回复provider reply 2关联原controller Message；Goal/continuation身份及1/1轮保持，候选包含该预算耗尽owner。原直接驱动一次、新全局驱动首次及观察器修正后重跑9932各一次，三次各有两个本地流式请求、合计6次，均有原进程结束与测试运行器结算；没有真实Sol请求或凭据副本。

全量真实历史Source CLI 18883用完整498-after源90表131156行和原5键canonical，无auth/models、模型输入预算0、正式c1 UI（无前端变化）。生产候选函数在该CLI的真实Project identity中读取八个旧Goal：七complete，一budget_limited（37196 tokens、1/1轮），候选为空。原日志与新日志各取首个真实Scheduler tick起60秒：before60次run/60次Goal project failure/60次config.validate start；after60次run/0次Goal project failure/0次Goal owner failure。after完整观察141次真实run。窗口仍有5次config.validate start，和真实显式runtime读取400一并保留，不把聚合数据归因到每个请求，也不声称全部项目初始化已经消失。实际健康HTTP200/healthy，六项原Goal读取/跨Project409/runtime400合同再次通过。

内置浏览器自有70页人工查看并保存两张1280×720图：原预算Goal状态与完整详情均可读，模型不可用提示仍准确，未点击Save/resume/complete或发送消息。页面已关闭，当前自有页数0。after公开shutdown200、原5032 exit0，native原出生host/target结束，physical/output/request/launcher结算完整。结束后全量保留检查：所有90表131156原行字段/时间/rowid/主键差异0，原60751872 bytes/mtime、完整canonical、schema对象/user_version3/integrity相等，Provider activity321→321。未升级或清空数据库，未启动用户进程。

二次复核已逐分支对照旧决策顺序：complete/paused/blocked提前返回、已接收恢复先于预算判断、活跃Prompt/Task FIFO/交互/等待/dispatch及Mission子Task仍由原frontier判断；新的探测只携owner identity，执行重新读取，原最终事务校验保留。多Project候选以当前Instance.project.id作用域读取，新增正向候选断言与独立owner事实测试通过。已验证全局Chat进程恢复；Task/Mission候选/预算/原公共交付/取消/归档/usage有聚焦数据库合同及代码审计，本批没有新增真实Task/Mission崩溃或Sol流，不扩大此证据范围。

复核新无活动观察器时，发现writeAtomic先写临时文件再rename；对全部readdir结果逐一stat可能碰到刚被rename的临时文件。观察器只计已发布的.json barrier并排序，避免临时文件消失或目录返回顺序造成假活动。原通过日志保留，重跑同一全局恢复验收，不改生产机制。

9932同一全局恢复重跑1项/4断言通过、exit0。三索引及当前架构已更新；docs:check通过345 operations/26 groups。实际凭据扫描仅做安全核验，不把安全扫描误当模型调用计数；当前完整历史服务0模型输入，与独立可控流式测试6次请求分别留证。

交付前实际值安全扫描79文件41287920字节、匹配0，无凭据内容输出。所有本轮服务、原测试handle和自有页面均终态；只提交本轮范围，保留初始两个无关untracked目录。

证据见[产物](../../artifacts/2026-10-21-goal-reconciliation-admission/README.md)。不提交原私有全库行JSON/DB/完整原运行历史。此次没有无关死代码清理、版本修改、tag/Release/PR。交付面板命名/默认布局、其他Sources/Rendering持续体验及原完整配置性能指标仍需后续迭代，长期Goal继续active。
