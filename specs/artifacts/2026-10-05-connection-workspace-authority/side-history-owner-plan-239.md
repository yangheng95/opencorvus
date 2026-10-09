# 239 Side Chat历史owner与当前actor

## Recall

持续UI（User Interface，用户界面）/功能迭代，最新仅单agent。238新真实Sol Main Sources与Side回复完成，但关闭重开同Side报session actor drift、正文与引用消失；完整原失败和9次Sol EOF（End Of File，流结束）/Native0分开保存，abd6e0792已推送。用户IAB23/18107不操作，不委托/branch/worktree/发布。现工作区干净；原238不重启、不移交凭据、不重发请求。本轮用完整原历史的独立无凭据开发/ui验证修复。

已读238 Recall/原截图/完整canonical、Session.fork真实clone与sideChat.inheritedMessageIDs、backend conversation/view每消息和聚合Session投影、shared parseSubagentConversation与load/Side session.connected调用、当前07-panel。全仓搜索sessionAgentID/parse/load调用，覆盖Main树、成员HTTP/delta、Side连接snapshot与Mission root真实读取；已读subagent-conversation-service/side-chat-transport与backend server side-chat测试。它们为纯数据/HTTP（HyperText Transfer Protocol，超文本传输协议）契约测试，不调用DOM（Document Object Model，文档对象模型）、组件渲染或视觉基线；UI自动化测试不新增或运行。

## 修改前深度与影响

直接现象为Side完成后Close panel Return→可见Open right dock current-focus Return重开，同SID消失正文并Connecting报错，原message msg_g0VXYdL9g00LigHzvWS5。事实：Side.metadata明确记录4条引用IDs，首个user及3条assistant继承原work，后续新user/assistant是真实chat；没有消息损坏或Provider失败。

根因：backend ConversationMessageView已有每message.sessionAgentID（该消息执行owner），聚合view.sessions.agentID按最后消息更新为chat。shared parser却将所有历史message.info.sessionAgentID与聚合当前actor比较。最初连接只有work引用，随后live投影按逐消息身份接受chat，因而看起来成功；重连完整snapshot才撞上错误假设。旧路径把Session membership与历史actor当成同一约束。此次是解析身份错误，不是调度/队列/恢复执行/并发终态异常；Native0、全部流式EOF和完整持久化消息证明后端执行已收敛。

共享影响面：普通Session角色变化、fork引用、Side连接/重连、成员Task/Session snapshots/delta共用parser。Task ledger、Mission caller证据和helper participant约束仍由现backend生产投影校验；前端必须继续校验Session membership、Part Session/Message/orderKey与每消息view participant/owner/stage/time/parent。新增字段、双读、Side关键字例外、改写历史author或禁用全部identity校验均不采用。当前无UI自动化测试发现；旧纯数据fixture少了已存在的view.messages.sessionAgentID，须按当前契约更新，不能添加兼容fallback。

## 实施与验证

shared membership只携带真实Session ID，聚合Session agent仍须完整。每transcript message的sessionAgentID必填；可见view message用现meta.sessionAgentID严格匹配该消息info.sessionAgentID，再保留所有原participant/order/time/parent一致性。协议control-only消息没有可见meta仍保留必填owner、Session/Part归属校验。错误明确区分缺失owner与view身份不一致。纯数据契约测试更新现fixture，正向验证同Session继承work与新chat各自原身份被接受、helper owner与participant保留；实际backend Session.fork→持久化chat回复→真实会话HTTP读取→shared parser联合正向验证。局部测试不能当端到端；真实原历史页面后续独立验收。

先准备readiness/frontier/普通Session完整copy/native launch/archive/custody/pile助手，fresh source birth/port/pair/完整关闭，全部Project配置、schema、Task/Mission/Session/leases/恢复入口人工审查后manifest；90表全行直接比较、不用哈希，保留原Main/Side/Project/目录/引用ID。R=.../2026-10-09/side-history-owner-239-review-01，port18171，无凭据/模型/Task重启，Native固定900000ms。只读历史后自己新IAB真实打开原Main→现Side，展开reference、读原Source/new回复，读中段关闭重开、亲自看截图。若发现新的位置问题，先追加根因/范围再改，不把actor解析成功当全部阅读资格。

聚焦数据契约测试、类型/build、docs/architecture。所有UI人工截图；流式中间帧/成员/Tauri（桌面框架）仍未知。尽快关闭自己UI，sole shutdown/原foreground和Native实际结局/physical-output-request/pair闭合；全canonical核心表和所有Project文件差异复核。observer全终态后最后精确birth/bounds归档五个Bun文件。root/月/目录索引、范围commit、fetch/merge/outgoing完整检查与正常push。持续goal active。

## 第一次after与状态读取共享影响追加

25个纯数据契约测试、实际Session.fork→HTTP→parser正向测试、类型11881/build39797（49.77s）actual0。review-01 own78/18171/main-BsFv_2HJ.js真实恢复全部Side正文和4条引用，但明确保留新错误截图：GET session/status因缺当前gpt-6.1-sol返回400 ProviderModelNotFoundError。原actor drift已经消除，当前不是完整绿色资格。该scope已关闭，sole shutdown/原foreground64928/Native与独立archive/custody0，核心13表原行不变。私有旧launcher的purpose文字仍写original236；实际source manifest/copy/90表/所有SID都是238，该原字段不回填、不当事实身份。

修改前第二根因：project-route-context唯一分类表遗漏GET /session/status，要求InstanceBootstrap完整执行runtime并验证模型；而handler只是读已有SessionStatus.list。现list是跨Project的process singleton，公开project-scoped handler直接返回全map，还存在跨项目输出的代码风险。已读全仓两个list调用：公开GET与内部automationbench（后者本来需要全process观察）；全部status生产写入仍由Task/Mission/Session/执行occurrence owner控制，不修改调度、终态或写入。此为读取准入/投影问题，不能改模型配置、忽略API错误或加fallback。

追加方案：GET /session/status进入现唯一identity分类；handler将现process状态按实际DB SessionTable project_id、存在/删除的单一Session契约投影，只返回当前已准入Project的真实SID与原状态值。全process list及内部benchmark用途不变，不建影子状态。保留模型/配置/执行请求的runtime验证和当前directory/header权限。增加两个注册Project、真实持久化输入/production status写入、冷模型不可用下公开API仍返回各自明确终态map的正向合同，以及route分类当前输出。类型/相关数据测试/路由与文档检查；新独立完整原238历史review-02/18172/fixed15分钟，再实际Side读取/Source/关闭重开。第一个after原错误与闭合保留，第二个成功不能改写它。

## 第二after的阅读位置分析追加

第二after own79/18172已真实恢复Side全部消息/连接，状态读取错误也消除；但中段1023.333313关闭重开跳到1342底部（截图/数字分别保留）。直接触发是SideChatPanel退役/重建controller，onMount无条件bottom且选择effect无条件tracking=true，没有现有阅读intent。数据与执行仍完整，不属于调度异常。

已读现Side连接/选择/cleanup、Subagent reader的position primitive、Source excerpt与唯一conversation-ui store、dom-utils pending restore/input取消。采用同store内有界Side阅读intent（top/following），以API authority+原source+Side SID为key，并用现primary selectEpoch/可见geometry fence写入，primary清理同步清除，不持久化为消息。controller跟随selected Side owner创建/清理，恢复现position primitive，用户返bottom仍正常follow；不使用新的内容缓存或滚动writer。shared controller只增加读出其现restoreTop或actual scrollTop/following的getter，让未完成恢复的clamped0不能覆盖原intent，不另存pending状态。旧底部onMount和无条件tracking路径替换删除。全部Source/Main/Subagent调用点搜索、类型/build及原真实中段重开/来源/中文深色复核；无UI自动化测试。窗口resize的语义文本锚点仍未知。

## 最终实施与资格

共享parser改用已有逐消息view.sessionAgentID并保留全部其他身份检查；control-only owner必填。status GET使用唯一identity分类，按当前Project/真实可见Session将同一process状态投影；内部全process list不变。Side阅读intent进入现UI store（同200条边界/primary清理），原controller派生getter及selected owner可见写入/restore取代无条件bottom。没有新增协议字段、旧兼容、模型fallback、内容快照或UI自动化测试。

数据契约25pass；实际fork/读取/混合actor与冷模型不可用下两个Project终态map2pass；route分类与runtime候选错误18pass（共45）。旧candidate测试默认/status不再是执行runtime入口，改用当前/project/current以继续验证原执行配置错误，没有保留错误读取语义。UI类型99926、后端类型7143、最后build93616（49.81s）actual0；API文档生成按当前脚本完成，生成内容无额外差异。

review-02原fore95006/Native deadline_exceeded1（14:14:22Z），不是正常资格；14:14:31后console连接失败与14:15保存观察保留，不能将该后段截图扩大为在线成功。02预审输出调用中曾提前写manifest草稿，原public draft留存；人工看完后独立admitted manifest才用于完整copy/启动，原字段不回填。

新短review-03 fresh全项目/前沿审查后才admit：原238完整90表逐行相等复制，own80/18173/main-CaWal6Pk.js实际200，原Side正文/4条引用/5来源组完整。真实中段720→Close panel Return→可见Open right dock current-focus Return重开→720，原位置和正常连接均亲自查看；最初0样本是加载后向上到开头，不作中段资格。actual /session/status200。sole shutdown/原fore6100/Native41636 actual0（14:20:27Z），早于原14:32:54Z固定期限；独立archive/custody0、核心13表全行相等，两Project仅primary .git目录mtime差异。前三scope原失败/结果完整保留，不能相互覆盖。

最终中文深色/实时新stream/成员/Mission真实页面/Tauri/selection与API竞态/缓存淘汰/resize语义锚点未重新覆盖；不以45个局部测试或CSS/Data/DOM替代这些视觉资格。持续goal active。

## 最后交付检查修正

首次api:routes-check明确失败：route层直接SQL/Database.use违反服务层契约，且OpenAPI说明未同步。现唯一投影移到已有Session服务的statusInProject，route只调用服务；不重复实现、功能/状态输出未改。原两个production HTTP正向合同重跑92430仍2pass、后端type81631 actual0。SDK当前构建66266 actual0，仅生成openapi.json和sdk.gen.ts一行当前Project描述，无版本/发布或其他生成改动。原api:routes-check重跑actual0（6规则/34文件），docs/architecture实际0。原失败工具输出属于真实交付修正，不声称第一次检查通过。
