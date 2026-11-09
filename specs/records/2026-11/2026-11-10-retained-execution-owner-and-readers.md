# 保留删除的 Project 执行所有权与列表可见性

## Recall

用户要求持续按批迭代；最新要求本人独立，不用子 agent。独立读代码、数据库、接口与真实桌面；先记录根因和影响，再实施；使用真实开发服务、本人截图复核及聚焦正向检查，范围提交、上游普通合并与推送。16e1bfde0 已正常推送，上游 0/0，原 177 条工作区状态保留。已读根 AGENTS、[手动草稿重发](2026-11-10-mission-draft-creation-replay.md)、[全局分配](2026-11-10-global-conversation-creation-allocation.md)、当前 02-data/03-control、Task 控制、server-runtime-readiness、Project route context、Project identity lease、Task cancel/delete/Session deletion、Mission close/recovery/retention、Work Ledger 和 Session list/read、Protocol event schema。全仓搜索 closeMissionExecutionOperation、initializeProjectCleanupControl、cancelTask、cancelTaskWithIndependentProjectOwner、runWithIndependentProjectIdentity、runWithProjectDeletionIdentity、session.deleted、两种 tombstone helper、Mission/Session/WorkLedger list 和当前测试。没有使用真实模型或用户凭据；Task 验收的明确模型指向本机已关闭的测试端口，只用于写入正常 Task 与取消事实，不作为模型执行验收。原部署和其他进程不触碰；不运行界面自动化。

## 修改前现象与根因

真实隔离开发服务 39364 克隆本人版本 12 库，有已保留的 Mission 删除事件。未修改产品时，普通 GET /mission、GET /work-ledger 各返回 404，Archive 200。又用真实草稿接口建立可见和可删除各一个；第一次 DELETE 新草稿返回 500，后台最终为该 Mission 写入同一 close 的 closing/closed、delete_requested 与 session.deleted。桌面 1280×720 的真实任务看板与侧栏同时报告该已删除 Session，拒绝显示其他合法内容。GET /session 对同目录同关键词 limit=1 返回空页，虽仍有符合的可见 Mission。旧草稿独立复现见前批；不由新作者 metadata 引起。

相同服务明确配置本机关闭端口模型，经真实 POST /task 收到两个 202，分别进行首次 DELETE /task 和 Task 根 Session 的 DELETE /session?deleteTasks=true，均返回 500。三条实际日志的直接错误都是 No context found for instance，并共同经过 configureTaskCancellationReconciler → initializeProjectCleanupControl；Mission 入口来自 close，Task 与根 Session 入口来自 cancelTaskOnce。两条 Task cancellation.requested 后由原恢复逻辑提交 task.cancelled，未等价产生 Task 或 Session 的删除事实。真实独立 Session POST 200、DELETE 200 和 physically_deleted 对照排除整个持久路由都损坏。数据库完整，provider_usage_event 为 0，实际 Task 的内部消息与事件属于正常入口，不声称零内部执行事件。见[真实接口、截图和数据](../../artifacts/2026-11-10-retained-execution-owner-and-readers/README.md)。

直接触发点和控制流：这三条公开 DELETE 刻意只绑定已登记的 persisted Project，避免为清理启动模型、插件和执行能力。Mission close 先提交 closing，再直接在 HTTP 调用上下文初始化按 Project Instance 存放的清理状态；Task 取消同样先提交取消事实再初始化。persisted context 只含 Project/目录，不提供 Instance；以前的初始化或已加载缓存不能给新的异步请求补上下文。真正的直接 cancel 入口已有独立身份 owner；Startup/reconcile 路径也已有清理用身份 lease，所以后台有时能前进，HTTP 500 仍与真实接受状态矛盾。Mission abort/archive 走 identity；独立 Session 物理删除不调用 Task cancellation；Project 删除在正式 admission 下另有精准的 deletion-identity；普通 Task delete、Task-owned Session delete 和 Mission child Task cancellation 共享同一底层取消。不能全路由改成启动运行时，也不能用重试掩盖失败。

读取根因独立但同属终态：Mission 与 Task 绑定的 Session 行必须保留审计，真正可见性以 protocol_event 的 session.deleted 为准。单 Session 的公开读取已用 tombstone 检查；Mission 列表和 Work Ledger 先从 retained Session 表挑选候选（Mission list 又在事务之外逐行读取），再将其中的已删除对象传给 Session.get，导致任一候选的 404 终止整页。Session list 也在 limit 之后丢已删除对象，导致分页空洞。Archive 仅因为当前死行未归档才返回 200，需同一选择规则。Task 候选已在 limit 前检查 task.deleted；后续读选中项仍要以精确 Session ID 和同一数据库快照。禁止吞掉所有 404 或把某个 UI 加后备列表。

### 横向审计边界

- 正常及终态：公开 Task create/cancel/archive/delete、Mission draft/dispatch/wake/abort/archive/delete、Session 普通与 Task 绑定 delete、右侧 Chat/Work delete、Project delete、恢复扫描分别对照其启动上下文与 terminal fact。真实本批已复现三个受影响删除入口；前批的 archive/restore、abort、Mission 删除重发及重启 410 提供对照。已存在调度和唤醒控制仍从现有 lifecycle/recovery 读取，不能用清理修复改变执行输入、Owner、租约或消息协议。
- 恢复与并发：关闭、取消及归档的赢家继续是原生命周期/取消 lease；计划验证第一响应、同 ID 重发、两个并发同目标、独立项目不串扰，且正常重启后现有关闭及墓碑保持。Task 两个失败样本只持久了取消，当前 Task/session 的首个删除尚未提交；不推断旧取消记录已授权后台自动继续更广的删除。现有处理模式不新增恢复队列，也不改变用户审计历史。
- 作用域：低权限目录身份、Task/Mission/Session 终态和候选读取、分页、当前架构文档、真实工作台可见性。既有消息、产物、任务记录、状态协议、模型、调度、数据库结构与发布流程没有改动。已有 protocol_event_session_deleted_idx 支持按身份读取；不新增 Schema 或迁移。连续审计保留首次 Mission wake 丢业务身份等前批线索，本批不宣称已覆盖所有模型驱动执行。

## 实施与验收方案

1. Mission close 在确认为非终态后用已接受 Session 的精确项目与目录进入现有 cleanup-only 独立 Project identity，读回并校验当前所有者，整个清理器初始化、租约、效果和 handback 使用该作用域。已终态直接回现有结果；恢复与 HTTP 共用同一物理 close，不切换成完整 bootstrap。Task 公共取消/删除/Session 删除和 Mission 子 Task 使用唯一取消入口，在普通情况下绑定已持久 Task 的执行目录；已有显式 Project deletion admission 继续用对应身份。复用原 request、lease、Task/Mission/Session 事件和读回，不添加新启动器、重试门或补写事件。检查清理初始化与生命周期 lease 的相互触发，防止本请求竞争自己的恢复。
2. 用一条会话 tombstone SQL（Structured Query Language，结构化查询语言）谓词作为普通读者事实来源，在 Session 与 Mission 列表和 Work Ledger 候选的筛选、排序、limit、游标之前排除。直接 Session 点读继续按原 NotFound 合同。Mission 从同一读快照组装已选完整行；Work Ledger 候选、按精确 Session ID 的投影及游标在同一同步数据库读事务处理，避免候选与第二次读取之间出现新墓碑。一致性保留已删除原审计行、Task 读状态、项目隔离、Archive 范围、恢复可见性。按全仓消费判断共享函数的落点，不让专用恢复读者失去审计事实。
3. 聚焦验证真实 HTTP 和持久事实：首次/重发 Mission DELETE、非终态 Task DELETE、带 Task 的 Session DELETE 与独立物理 Session DELETE；abort/archive、正常排程路径及恢复现有测试；选择/分页至少有已删除最新记录、可见记录、两个项目及 archived 列表；校验终态的真实事件顺序、项目和启动恢复。至少再启隔离真实开发服务，打开任务看板和侧栏、操作打开可见保留条目、确认正常内容及截图；需要用真实 UI 删除时只在已授权的自有隔离样本且保持工具确认规则。通过 HTTP 验收隔离删除与恢复不代表真实模型运行；模型成功不是本批范围。所有新规格先保存后修改产品代码。

候选回归补充：真实首次 Mission、Task、Task 根 Session 的修复路径已返回 200；既有冷 Mission Stop 自动恢复测试发现“取得 lease 后、因已取消的调用信号而在清理初始化前退出”人为中断会留下 closing 且后台未安装扫描。应在取得同一个 lease 后先安装既有恢复驱动，再检查调用的中断并进入测试切点和实际效果；不能把初始化挪回 lease 之前，否则请求自己的发现器可能抢同一关闭。重跑该用例及其他 Stop/恢复检查。

## 实际验收

- 同一故障库的复制件无需变更 Schema，在 39366 恢复原列表和项目。Mission、Work Ledger、Archive 的实服读取均 200；以最新的已删除同名样本和仍可见样本验证，Mission、Session、Work Ledger 的 limit=1 分页返回同一个可见 Session，归档分页返回仍归档的独立样本。
- 真实新样本首次 Mission DELETE 200、非终态 Task DELETE 200、带 Task 的 Session DELETE 200（tombstoned）、独立 Session DELETE 200（physically_deleted）。两次同时删除同一 Mission 经原 lease 收敛，后续重发同一完成回执；实际 200/409 取值保存在接口记录。以前只提交取消的两个 500 样本按真实入口重发后都完成原意图，保留原请求身份。正常重启后三类重发仍成功，另一隔离项目中新的首次 Mission DELETE 200，原同项目可见草稿保持。
- 版本 12 数据库完整，外键问题 0；4 个 Task 都有打开、取消请求、同关联 ID 的取消终态与删除事实；两条带 Task 根 Session 的行仍有审计和终态标记，普通独立 Session 对照有终态事件且物理行已删除。被删 Mission 审计行保留，已接受关闭/终态对应原同一操作。4 个内部消息为实际 Task 控制数据，模型用量事件为 0；未使用用户凭据或外部模型。隔离项目的 Git 提交及原文件保持。
- 本人从最终版本真实页面进入 Tasks，确认原先报错的看板及项目侧栏已有内容；键入搜索词、切换 Board，查看唯一符合条件的保留草稿，点击打开并复核原文和选中项目。图 02–04 是实际重启后 1280×720 页面，图 01 是修改前；无界面自动化。
- 真实路由的 Stop/删除/冷恢复 19 项 / 66 断言已通过。另覆盖 Mission 进程恢复 4 / 10、现有 Mission wake 轮次 3 / 4、Work Ledger 搜索与分页 7 / 46、Mission 正文 1 / 22，定时 Mission 关闭/恢复与多项目 3 / 13。后端类型、路由、文档、架构与差异检查通过；只关闭本人进程，端口 39364/39366 无监听。详见[证据](../../artifacts/2026-11-10-retained-execution-owner-and-readers/README.md)。
