# Mission看板静置时间显示

## Recall

用户要求持续按批并行体验UI（User Interface，用户界面）/UX（User Experience，使用体验）、功能和缺陷，先根因/影响分析落盘，再真实桌面交互/截图人工复核、聚焦正向测试、清晰提交/上游普通merge/正常push，直到明确停止。b21 cb70d723e已正常push main，全部类型/路由/文档/架构/拓扑钩子通过、密钥扫描0命中，前批7test84断言、实际英中转换身份/原文保持；本人页面/服务均关闭并原session退出0。原177状态保留、暂存空。Sol凭据授权仍未答，不重复问，不读取/使用凭据、模型目录或发模型请求。

functional_audit和ui_audit一层只读并行、禁止再委托。UI线建议验证b03明确保留的MissionBoard静置时间候选；功能线继续无模型真实路径，已排除.wat/.ll文本候选（旧明确设计保持binary），没有证据不得顺手放开。已读MissionBoardCard唯一time/所有调用和List/Board、mission-board唯一分页/reconcile writer、WorkLedger120ms合并刷新、main共享refresh token/唯一挂载、App data-open仅隐藏、relativeTime/detailStamp和现useNowTick/ProvidersPanel/CardHeader调用、纯服务clock测试、当前07-panel-reactivity与b03/b19记录。全仓检索相关定义/调用/旧决定，不复制实现。检索未发现对应UI自动化；纯服务clock/connection authority不当作UI测试。

查阅[Solid细粒度响应](https://docs.solidjs.com/advanced-concepts/fine-grained-reactivity)和[onCleanup](https://docs.solidjs.com/reference/lifecycle/on-cleanup)官方资料，确认signal读取建立依赖、组件scope清理随卸载执行；只据此理解现primitive，实际冻结仍须页面实证。

## 修改前根因与影响分析

候选可观察现象：同一Mission卡片原updated不变，持续可见静置后相对说明停在初值。直接触发是跨秒/分钟边界而没有updated/locale变化；MissionBoardCard现relativeTime(updated)默认Date.now只是普通读取，不建立响应依赖。生产writer按sessionID reconcile，重读相同记录不能可靠推进说明；既有b03只修Provider专属格式，没有覆盖未静置验证的Mission看板。无已观察到调度、队列、唤醒、并发、恢复或终态异常，不能把显示年龄误判执行停滞。

完整影响：单Card相对正文，List/Board共用同一组Card；datetime和title仍原updated/本地化detailStamp。公开记录/Session/Task状态、排序、搜索、过滤、API（Application Programming Interface，应用程序接口）、数据库、模型、执行和持久格式不需改。通用relativeTime原秒/分钟四舍五入与一周后完整日期保持，不套Provider floor规则。其它消费者仍只有静态候选，无本批页面证据不泛改。

若真实冻结成立，最小方案是在现Card组件scope调用原useNowTick()，仅relativeTime(updated,now())读取共享默认1Hz信号。复用唯一clock，不新增timer/active配置/轮询/状态/组件/可见性注入。每个实际Card订阅，过滤或记录清空卸载时退订；主surface只是CSS隐藏Card仍挂载，不能宣称离开看板就停表。document隐藏/恢复沿共享clock既有机制，本批如无法真实验证须明确。

当前检索的services-clock.test.ts是非UI服务测试，含两条cleared===0的负向核心断言，按仓库规则删除这些过期断言，保留正向同interval启动/最终释放合同；第三个重复unsubscribe用例只有类型断言，拟改为剩余真实订阅者获得后续墙钟值的正向输出合同，不改clock实现。不新增或运行UI自动化。纯UI显示由真实页面截图验收；时钟服务测试仅证明计时合同，不冒称页面。

风险：重复timer、原更新时间被误写、locale不更新、隐藏恢复失真或把重挂载误称静置。通过原共享primitive/不动writer、同卡原datetime/title/公开记录逐字保持、连续可见无切换/刷新跨>=65秒截图，以及中英同原时刻验证。证据不足处保留未知，未成立则不做产品补丁。

## 验收与隔离输入

本人Temp opencorvus-iteration-20261108-b22，新profile-before/after、自有Git项目/私有Git配置；dev serve38962/38963 /ui，before现main-BuKeJYrJ.js，若修改UI后正常build再启动after，不单起Vite，不操作用户进程/窗口。真实界面Save a draft建立自有未启动Mission，原请求明确保留草稿；不dispatch、不模型、不合成消息/改时钟/改store。保存后公开GET /mission全record落证，关闭成功提示使卡片可见，记录当前卡time正文/datetime/title与页面visibility/本机墙钟，连续可见静置>=65秒后截图人工查看，再读同一公开record。

若修复成立，after重复真实保存，英语连续静置观察第一/第二分钟，中文切换同updated完整日期与相对文案，保持query/project/layout。允许先读DOM（Document Object Model，文档对象模型）仅作辅助事实，不设置页面状态；视觉截图必须实际呈现。计时等待使用有界定时唤醒，其间继续独立调查/检查，单次不阻塞沟通超过60秒。

辅助类型/语言键/正常build/renderer surface、docs:check/architecture-index不代替视觉；非UI clock聚焦原checker运行。内部执行/Provider E2E（End-to-End，端到端）未验，真实隐藏恢复如工具不支持不伪造。本人资源正常shutdown/原session退出0；保留原177状态/三README仅本条、范围commit/fetch普通merge/完整待推审查/正常push，再进入下一批。

## 修改前实证与实施决定

本人38962/IAB46/main-BuKeJYrJ.js，真实Save a draft/Code/Dynamic保存f0f1cc7eb265bb0b/ses_-zUPbSAKOzzAWNBKqhtT，原请求逐字通过公开reader确认，backlog/tasks=[]且未dispatch。原updated=2026-11-08T15:13:00.594Z；初观测15:13:13.415Z已有12.821秒却仍just now，连续可见静置至15:14:25.861Z（两次间72.446秒、年龄85.267秒）仍just now，datetime/title完全相同。01/02实际截图逐一呈现并人工复核，静置无刷新/语言/筛选/布局动作。公开reader完整record与保存后逐字段一致，排除本批真实任务状态/updated变更异常。页面关闭、本人服务正常shutdown。

按已落盘最小方案实施Card原scope useNowTick默认1Hz与relativeTime原now参数；不新增计时实现、不改服务/状态/排序/locale。ui_audit独立确认完整writer/刷新/隐藏生命周期边界和无相关UI自动化。功能线空目录查询候选仍须公开合同和真实输入证明，保留下一批，不混入本次UI修复。同步删除当前clock服务测试两条cleared===0负向断言，把重复释放弱类型用例改成真实剩余订阅者后续墙钟值正向输出；纯服务测试不作为UI验收。

## 实施与验收

产品差异仅Card import/useNowTick/relativeTime第二参三处，clock实现原样；07-panel-reactivity同步scope/隐藏边界。原非UI clock checker3pass5断言，包括重复释放后实际1100ms墙钟后续值；类型、两语言2921键、普通build66秒/renderer public surface、docs:check352ops26groups和architecture-index20docs均通过。ui_audit只读复核最终差异无必修项。

after38963/IAB47/main-LHPnVMSt.js真实Save a draft/Code/Dynamic建立36607097639c8457/ses_-zUPbRBoLzzbF2AQpwat，原updated15:16:53.216Z。列表初15:17:00.173Z显示6s ago，持续可见无交互至15:18:18.171Z显示1m ago（间隔77.998秒），再到15:19:03.725Z自然2m ago。原datetime及英语完整时间Nov08,2026 11:16PM保持。

其后真实切Board，英语2m ago；当前语言菜单切中文，同卡15:19:23.130Z显示2分钟前，title按中文为2026年11月08日23:16。无交互静置到15:19:55.200Z自然3分钟前，原datetime/title保持。01—08全部实际截图人工查看。公开GET /mission分别在保存、列表静置、最后中文看板后完整等于初record；原请求和backlog/tasks=[]保持，没有dispatch/模型调用或执行事实异常。

未验真实document隐藏/恢复、小时/天/周、其它消费者及Provider/Sol端到端，不冒称共享全矩阵。before服务10898正常shutdown原session退出0，after服务22855正常shutdown原session退出0；两个本人隐藏页面46/47已关闭。原177状态/本条README/提交/上游同步/正常push仍按当前交付规则复核。
