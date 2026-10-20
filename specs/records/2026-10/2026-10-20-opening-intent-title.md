# 按真实开场意图命名会话

## Recall

用户要求持续单agent自主体验、修复、实际页面验证并提交推送；后续单agent指令覆盖旧goal的三个Astra文案。上一轮459为progress：e959271ebc6d54505af0f5994dea6a9196c373dc已正常push并fresh fetch确认HEAD=origin/main，11张真实内置浏览器截图、gpt-6.1-sol一轮自动Goal与operator完成、完整109 Project/147 Session/schema2保留；两个native scope、所有原checker句柄及runtime/private授权目录复制对均结算退休。完整历史配置保存10s/恢复5s原性能目标仍未达。开始工作区仅既有.bun/和packages/opencorvus/bun/未跟踪；不委托、不建branch/worktree、不碰用户18571/窗口/进程/真实用户DB。

已应用computer-use与benchmark-debug-template。用户指定的CUA内置浏览器直连可用，浏览器清单的Work本地设置错误不能作为IAB阻塞。459自建tab已关闭，新验收使用同一已选iab/browserID2新建自有tab，不重选浏览器。只用真实交互、截图、人工视觉复核；不新增或运行UI自动化。若需真实Provider，新鲜复制已授权auth与完整models成对、独立预检credential/catalog/实际gpt-6.1-sol且流式；秘密不入日志/spec/提交，物理/输出/请求/launcher及原checker结算后退休。

已读AGENTS、459 Recall/实际截图/只读事实、当前continuous-goal/07-panel/07-panel-reactivity/02-data相关契约；first-message-title、流式prompt/title、Session.setTitle及所有生产调用、三处持久化命名调用、Goal store/controller/schema、SessionWake结构化reason、Message身份、chat identity/session、memory owner捕获、现有title-activity/rename/continuous-goal后端测试。全仓检索该helper仅run.ts两处与parts.ts一处，ensureTitle仅loop step1；显式title写入另有普通Session/Chat/Work/Mission路由与panel工具，均使用Session.setTitle。历史文件提交没有修正参与者与transport role混淆；本轮不改显式重命名语义。

## 修改前分析

可观察现象：459真实Goal ses_-zURR5ESgzz9bL80N3L2完成自动轮次后，session.title与页面标题/侧栏均成为“Continuous goal controller — automatic continuation 1.”。同一实际消息info.role=user、author=goal-controller，表明role是模型传输角色，不能当作人类作者。直接触发为setSessionTitleFromFirstUserMessage对所有role=user计数，再取传入正文第一行deriveTitle。该消息由Goal控制器自然产生且应完整可见；不能调换正文、删技术内容、匹配关键字或伪造user来遮症状。

同语义共享根因还存在于ensureTitle的firstRealUserIdx和isFirst，只按role=user。Chat/Work/Mission持久化三入口都会受影响；timestamp默认Session走流式标题路径，Task根有独立任务标题，不应被Goal目标覆盖。Goal表单是用户直接提交的结构化objective，createContinuousGoal已有同一事务和唯一目标事实，可在创建时为默认会话命名，避免为消息反推当前/历史Goal新增查询协议。当前schema/消息/协议/API不需变更；不批量改写旧会话或用户名称。

横向审计命名异步边界发现两项直接相关风险：首次命名读取完Session后又await全历史，显式rename可在期间完成，最后无条件setTitle覆盖新名称；流式生成同样可能迟到覆盖用户选择。现有唯一setter仅按id无条件写。再者count===1会在多个真实用户输入已持久化时漏掉首条，正常/noReply/恢复重放/序列提交均可触发；正确标题来源应是按持久化顺序找到的首个人类输入身份，消息数量不是命名条件。验证将使用两个实际已持久化human及host前缀、显式rename与迟到提交的正向状态，不以“不调用/不存在”等负向断言为核心。

影响面：Session当前标题与Updated事件、默认Chat/Work/Mission/普通Session、Goal原子创建、流式标题collector；显式rename保持无expectedTitle的当前合同。三处持久化调用不另建分支。Task/Mission/Session调度、队列、唤醒、恢复、预算与终态本轮不改；命名不改变occurrence身份或消息/执行准入。恢复/重放会重走同一默认名称条件；串并行及多Project由各Session身份和同一SQLite写事务约束。若实际发现执行异常，立即扩展到全部调度生产入口横审，不以本轮局部标题结果排除共享执行根因。

## 实施前方案与验收

1. 为唯一Session标题写入提取requireActiveTransaction的同步primitive，公开setTitle继续委托它。增加可选expectedTitle，只在当前持久化title仍为读取值时写入并发布Updated；不匹配返回当前真实Session，显式rename仍无条件更新。不新增缓存、影子状态、二次协议或数据库迁移。
2. 首次人类命名通过role=user且author=user找首个持久化输入，允许它之后已有其他输入；异步写回携带expectedTitle。流式标题同样使用首个人类身份与原有限上下文，保持流式collector/重试/取消，最终携带expectedTitle。
3. 默认Chat/Work/Mission和timestamp会话在Goal创建事务里从唯一objective通过既有deriveTitle命名；Task沿用任务标题，已有自定义名称保留。新增能力放现有first-message-title与Session primitive，禁止仅给Goal控制器正文打补丁。幂等Goal replay不重做命名，创建失败仍由同一事务回滚。
4. 先新增聚焦后端正向案例并运行原实现保留失败：Chat/Work/Mission/普通Goal默认标题、显式自定义标题、Goal重放后用户改名、Task标题、host前缀与多个human、CAS（Compare-and-Swap，按预期值比较后写入）结果与不同Project隔离。更新title-activity正向参数及host/多human输入案例；后端mock仅证明局部collector合同，不能替代真实服务。
5. backend typecheck、相关Goal/title/rename后端测试；stage后用--index检查当前模块拓扑。源文件分层若形成新增静态依赖循环必须修复，不绕checker或只验旧HEAD。
6. 自有native开发/ui服务载入当前459正式前端bundle（本轮前端未改）与当前后端，真实IAB创建一个明确一轮预算Goal，观察创建时标题、控制器/assistant原消息和终态、显式rename及reload。保存目标区域截图人工查看；完整QA历史保留。原服务/请求/checker全结算后readonly验证schema与所有原身份/归属/目录、秘密扫描、配对退休、三索引/当前架构、文档检查、范围commit、等待fetch/merge/完整待推集合检查后正常push并fresh fetch。无版本、tag或Release。

## 实施与实际结果

方案已落地，没有从wake正文/关键词反推目标。Session.setTitleInTransaction是唯一当前标题写入/Updated发布实现，公开setTitle委托它；expectedTitle在同一写事务核对当前真实值，不匹配直接返回当前Session。first-message-title两种明确来源是首个持久化human和已授权Goal结构化objective；Goal与默认标题原子提交，Task保持任务名称，重放在原receipt处返回，旧历史名称不批量改写。流式标题仍用原collector/重试/取消，使用首个人类身份和有界原上下文。

原31998 exit1：6项中4项失败、8断言。修复后原53009 exit0：opening-intent-title 6/13、title-activity 4/10、continuous-goal 13/60、conversation-rename-identity 1/12，共24项/95断言。包括真实SQLite写入、多human先已接收、host前缀、两个Project并行、迟到写回返回当前用户名称、Goal默认Chat/Work/Mission/普通Session、用户自选名/幂等replay与Task根。collector的模拟只作为局部合同，不称其为端到端。后端typecheck原6360 exit0。当前stage源码的module-topology --index原22224 exit0：1171模块/5990运行时边/4clean imports，无新增静态循环；不是旧HEAD结果。

18737实际native开发服务中，自有IAB tab2真实创建ses_-zURR01plzzo4CFAVTpg/Goal pev_g0VYZ06O800hLmJployd。创建后主标题和侧栏立即显示“验证持续目标会话命名”；控制器自动一轮gpt-6.1-sol流式HTTP200/eof，回复TITLE460READY，1/1轮budget_limited，38352令牌，标题保持。通过真实Rename chat输入“用户保留的持续目标名称”，重新加载同一URL恢复该名称和两条原消息。然后在Details/Mark complete中由operator提交明确证据，状态complete；不声称模型自动判断完成。[五张原始1280×720截图](../../artifacts/2026-10-20-opening-intent-title/README.md)均人工查看，没有UI自动化。

自有tab已关闭，公开shutdown200、原3562 exit0、native物理/输出/请求/launcher结算。只读数据保留验证schema2、110 Project/149 Session，109/147所有原身份、归属、目录逐项相同。原测试、类型、stage模块检查均结算，实际秘密值扫描通过后runtime/private授权与完整models复制对退休，源文件元数据相同且未写入/刷新。用户18571/进程/窗口与真实用户DB未操作。本轮前端JS未改，使用当前459正式bundle；无需重复构建二进制或发布版本。

未达项继续保留：完整历史配置保存10s/恢复5s性能；已有技术标题保持历史事实，用户可通过现有rename更改。本轮不把标题与Goal真实执行证据扩称Sources/侧栏Rendering新验收。

三索引及当前数据/Goal架构已同步。docs:check 345操作/26组、api:routes-check 35文件/6规则、check:architecture-index 20文档均exit0；工作区与暂存差异空白检查通过。
