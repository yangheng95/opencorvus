# Task Rendering 与执行轮次

## Recall

539继续单开发agent，不启Codex子agent/外部线程。用户最新单agent规则覆盖旧Goal三Astra文字。上一轮为progress：c1b24b58a67fed7faff4154f0da2220ed87622df已正常hook/push/fresh0/0，修复已知epoch snapshot0越过live retention floor漏终态；两原Task自然完成，29次Sol原EOF，12实图/7归档，两个服务原exec/native/output/request/精确出生exit0，8份auth/models配对退休，源数据保持。不是整体Sources/Rendering已通过；一次新Source追加和活跃更新owner连续性仍开放。开始工作区只有原.bun/、packages/opencorvus/bun/。

已重读AGENTS、538全部Recall/根因/验收、536正确cleanup诊断与失败观测作废记录、535普通Session新Source/重连边界；沿用benchmark-debug-template与computer-use。用户UI自动化禁令优先：只真实页面交互、截图人工复核与只读观测，不新增/运行DOM/组件/文案/快照/fixture/Playwright test/像素断言。非UI真实契约可聚焦正向测试。未委托，无委托反馈。

当前事实来源为panel-reactivity、Task控制/数据/运行时架构。已读TextPart/text-part-model/markdown worker、CardParts三层Index/消息与工具分组、ConversationCard分支、ChatBubble、SubagentConversationPanel资源/投影/刷新/阅读与成员选择、AgentRail、conversation-agents和后端conversation/view、Task executionProjection/SessionStatus及恢复terminalize。全仓定义/调用/历史搜索：Rendering仅在pending且frozenHtml空时显示；正常追加保留已挂载HTML，不能看到标签就推定worker慢或加缓存。536曾因诊断cleanup读取失效props制造Solid重入，只有正常观测捕获的普通快照可用于cleanup日志，禁止再次在cleanup读响应式对象。跨Task/Mission/Session、正常/终态/retry/restart/串并行/多Project共享审计不能省略。

## 修改前问题深度与影响

现象：原用户侧栏Rendering反复闪烁、Sources不易阅读；538两原任务完成前的Agent rail仍同时列出同Session旧Running与新Completed，而All agents只显示最新轮次Completed。历史Running究竟是规范原事实还是未结算生命周期，目前未知。UI的文本只在空文、owner退休/新建或分组移位重建时可能重新空；原Task的消息/Source/身份/派发顺序必须保留，不通过隐藏占位、强制completed、加fallback/缓存、切换runtime、删旧事实或放宽证据合同处理。

代码线索：terminalizeRecoveredIncompleteAssistant将旧assistant和Tool写真实中断终态，却未在该函数内发布旧input的SessionStatus终态；taskExecutionProjectionForTask读取每个input的全部原agent.execution.lifecycle，旧streaming可能仍为latest。前端按真实生命周期决定Running，不从正文终态猜状态。还需以原持久化事件、Prompt owner/Provider事实及真实公开端点核实，不能先改reader或靠Taskcompleted批量覆盖旧状态。该边界可能涉及共享恢复，不允许降级为单个产品成员或模型问题。

另一路尚未知：CardParts按消息/执行/body/source位置Index复用，插入旧消息错误投影、新Source或移除真实Tool草稿时是否改变后续owner。仅代码有Index不是缺陷证据，需真实运行绑定/退休/块数观测。诊断只构建私有资源，不改生产状态、顺序、请求与渲染算法；任何工具故障先修工具并重跑原验收。

## 固定调查与验收方案

1. 先只读已结清538-after真实SQLite及原事实：两原Task、每个input的lifecycle事件、assistant/Tool完成、Prompt owner、原Provider EOF。以代码/持久化事实区分真实调度未结算与UI投影错误，完成全部生产入口横审后再落具体修复分析。真实schema3不改、已交付迁移不改，不操作真实用户数据库。
2. 若需真实页面，before539使用19067，条件after19069，各32真实Sol请求、合计最多64（preflight/memory/编排器/原产品成员均计），不扩容、不重启重置预算。完整90表/全部字段与时间、canonical五键、真实应用对象/integrity从已结清538-after复制。原Task为tsk_g00VYlyopB00h7w27eIw/原A ses_h33yzvtiYmW1UEyocSXB、B ses_hHpC127wALpwIiSOX86d，身份取原实际202；原PNG按明确538-after生产者namespace配对复制到当前DB namespace、公共接口核对实际643字节，不猜目录或改引用。
3. 正常413/446监督、固定Bun1.4.0+34cbb9a40、504 Source CLI开发/ui，正式Node Vite构建，无单独Vite服务器。before可使用536已纠正的低频owner诊断，仅绑定实际目标Session，cleanup只记录最后正常快照；每个console窗口立即保存，500条上限不当作连续证据。after若有产品修复使用无诊断正式构建，视觉与观测资格区分。
4. 只读历史若不足验证活跃Source，可在隔离副本通过真实composer向同Task提交一条明确新增有限责任，要求仅由原B在原会话接续，不新建Task/Goal/成员/helper。原A/B交付保留。新责任只读一次已知公开arXiv摘要URL，前后各输出有限长文，用于人工观察来源追加/正文流。原ACL两入口不重读、不搜索/拓展。实际工具选择由模型和真实上下文决定；审阅真实permission scope手工Allow Once，不通过Host门/伪消息/SQL状态改写强制路径。若终态Task不能正常接收新增责任，记录真实错误/合同，不能偷换成新简化任务。
5. 目标：原Sources规范身份与正文保留、新Source实际添加可读/复制、正在输出的正文与Rendering/owner变化有真实证据，列表/详情/dock及历史轮次状态和原事实一致。18万级历史不删减为小fixture。截图实际呈现查看，遇到问题补完整根因/影响/唯一实现方案再修改；非UI修复需聚焦正向合同，UI只人工实测，不用静态字符串/单元测试冒充端到端。
6. 180秒启动无活动边界，业务按真实活动等待；20分钟仅自有资源外边界。原句柄定时有界检查，观察超时不当作服务终止。先完整复制已授权OpenAI条目+完整models目录，分别校验credential usable、目标投影、actual model/API=gpt-6.1-sol/stream。源bytes/mtime保持，无refresh/exchange，实际值不进日志/spec/prompt/Git。关闭只自有页面/服务，用户18571不刷新/重启/关闭。
7. 任务和读流自然结算或明确失败后，正常public shutdown/原exec/native物理/output/request/精确出生核对，runtime/private配对仅在物理结束后退休；失败EOF不得伪造。全90表原行差异按正常新增/恢复/记忆变化解释；完整源数据保持。最小证据归档、三索引/docs及实际值扫描/diff，范围commit→fresh fetch/merge→完整待推送集合审计→正常hook/push→fresh一致。任一文件改动均收敛为提交。Goal继续active。

## before 原事实、工具边界与修复前补充

只读538-after数据库确证两Task共四个旧worker input的最后生命周期仍streaming，原assistant已ProcessExecutionInterruptedError/time.completed且Prompt owner空。正常新continuation各有独立input和真实terminal/completed，不能用新input覆盖旧input。共享横审已覆盖Task原始/续写、Mission exact frontier恢复、普通Session Prompt恢复、compaction helper、Task-root activation恢复、abandoned dispatch和终态取消；terminalizeRecoveredIncompleteAssistant是消息/Tool/Provider恢复，不等于整个input结束，同input有合法继续/重试，所以不能在该函数内简单补terminal。abandoned dispatch另有不可变基础设施settlement，正常终态走共享status-publication，已有collection/individual ingress按原基础设施fact去重。四个旧轮次如何在现有已结算数据中恢复其生命周期，尚未完成全合同证明；不伪造生命周期、不按Taskcompleted批量修改、不松动真实final-message资格。此项仍开放，继续共享机制调查。

before真实原Task由completed经正常composer重新打开新epoch，原B同Session续写，原A未重做、没有新增Task/Goal/成员/helper。实际14个Sol请求中13原EOF、1原fetch_failed/status null，正常现有重试后Task自然完成；源reader失败不是EOF，Provider整组qualification为false。原48052/native正常exit0、public shutdown200、物理/output/request/精确出生全结清，runtime/private四份auth/models配对退休，实际值扫描129文件0。90表182026原行中7项目标变化为memory chunk/file各1、容量lease2、3 Session更新时间，源完整原行/bytes/mtime/canonical/schema3/integrity保持。after复制资格必须分别保留这一个真实fetch失败，不可因为数据可用于调查就声称全部模型请求成功。

实际新Source prt_g0VYmUqRe00iwQUDpLhe 归属原B、原新增msg_g0VYmUOVB0012dG1c1pk、真实webfetch prt_g0VYmUc6c00U1v3LhnCg，URL为指定arXiv摘要。原两ACL Source全身份保留，公共HTTP/生产parse/merge证实新3来源和后正文Part；手工复制出现Copied、Task Completed实图。原已完两Task及新增责任不是同一个执行epoch，不把历史Task终态当这次新增责任已完成。

发现独立且可修复的UI读取风暴：真实server日志在该成员上394次GET（含少量外部只读checker），12:35:04.542/.784/12:35:05.082仍以约200—300ms间隔读取。processor明确每200ms将流中文本完整snapshot持久化，另发完整value delta；events只排除了message.part.delta，却将这些中间message.part.updated全推进transcriptSequence，触发120ms成员回读。完整snapshot和delta已经进入原live projection，反复HTTP/parse/merge没有提供新边界，额外增加资源refreshing/ready和渲染工作。不能把这直接宣称为所有Rendering闪烁的根因。

Rendering观测工具也有边界：before沿用536修正的cleanup（只读最后普通快照）没有重入异常；但panel-state/read-start/end日志在每次回读打印，223之后下一窗口达到500且前缀已丢失，filter也是对截断窗口筛选，缺口不能靠后来body-only1条补成连续owner证明。保留原31/223/500各窗口，不声称整个新增Source过程owner连续已通过。首次鼠标点击发生长文重排未打开，随后真实Enter打开，尚未证明是产品事件处理错误；不按该现象修改焦点或dock配置。

唯一UI修改方案：在现有advanceLiveConversationAgentTranscriptSequence中，区分原Part的流中状态。只有canonical tree-writer能证明同Session/Message为未完assistant，且收到有真实time.start、无time.end的text/reasoning快照，或未提交pending Tool草稿时，保持现有回读revision，由原live projection展示原内容。消息/Part未知、已完消息重写、user正文、Source、文件、Tool实际admission/outcome、Part end/removal及Message创建/更新/移动/删除继续推进原revision并回读。不能仅看Part无end而跳过已完成消息的合法后改；复用现有projectedConversationMessageFacts，不添缓存/owner/并行配置/定时器，不延长现有窗口，不改后端persist/stream/路由/模型/权限/schema。全仓仅一处调用推进函数，Task与Session已共用该路径，Mission/其他Project同样按确切消息归属隔离。

这属于UI客户端刷新实现，遵循UI自动化禁令，不新增或运行UI单元/DOM/组件/源码文案测试。验收进入正式after页面，用同一原B的另一条有限新增责任（arXiv HTML入口一次、前后长文）实际产生新Source/正文并完成；既有全文/Source和新的可复制来源必须实际呈现。以真实server GET记录说明读取变化，不把次数比较替代视觉或owner证明。修改后执行正常类型/文档/OpenAPI与push hook。after最多32，总上限64保持，原before失败reader保留；若没有连续owner窗口则明确仍未达到该项，不能借删除Rendering文字伪装通过。

## 实施与正式页面复验

唯一生产修改落在 conversation-agents 的 transcript revision：复用 canonical tree-writer 的已投影 Message 事实，仅对明确未完 assistant 的流中文本/reasoning snapshot 和 pending Tool 草稿保持 revision。现有实时投影继续接收完整原事件，未结束正文仍实际增长。Source、文件、Tool 实际 admission/outcome、Part 结束、Message 边界、未知消息与已完消息后改均沿原 canonical 回读。没有新状态源、缓存、定时器、协议、后端或 schema 改动。架构事实来源同步更新。

after 为无诊断正式构建，原服务19069正常提供 /ui。原 Task 经 composer 接受另一条有限责任，原 B 同 Session 续写；批准的 continuation 仅复用原 dispatch art_htjYNLgEngJKAbr6RLuQ，网络权限仅指定 https://arxiv.org/html/2509.11035v1 单次。未新建业务 Task/Goal/成员/helper。读取前正文 Part prt_g0VYma2wD003owRu5m9l 实际2120字符；真实 webfetch prt_g0VYmaILg00lskNxTy35 之后生成 Source prt_g0VYmaLy10038WK7z7WL，归属 msg_g0VYma20K00NMix5Hzs1，sourceId 9779f0e41fe8fe96dfd1293da0f393cc2c85f41ecd6ad73dedd70a84017c4478。读取后 Part prt_g0VYmaNTs00F3UDN30bC 从306字符实际增长到2980字符，最终 assistant msg_g0VYmaLzr00YbB7uU14g 为 stop/completed；要求为约2300中文字，没有声称精确字数合格。

公开成员端点实际 snapshot 2043/16消息→4315/16消息，使用生产 parse/merge 核对全部原三条 Source 身份和正文保留，新增第四来源正确。手工页面观察长文持续增长、滚动回看、新 Source 标题/域名、实际 Copy→Copied 及表格/围栏，最后 Task 正常 Completed。网页真实返回被工具截断50506/101177字节，省略50671字节；模型正文明确保留此边界，不冒充全文阅读或界面验收。B 的实际 HTML 正文和 Source 增长不再只用历史静态内容替代。

after 真实 server 成员 GET 共17次（含baseline与两次外部只读 capture）；before共394次（同样含少量checker）。after 读取前长文从12:54:31.878到12:55:47.940之间、读取后长文从12:55:58.080到12:56:54.364之间无每200ms回读，消息/工具/Source边界仍产生真实读取。两轮来源内容及责任规模不同，该记录证明消除具体中间快照读取风暴，不能作受控性能倍数或完整 Rendering 根治结论。正式构建没有 owner 诊断；before诊断窗口曾截断，连续 owner 验收仍未达到。14张实际截图均呈现查看，7张精选归档；09/10虽文件名含Source，实际画面为读取后正文，不冒充Source实图，11/12才是明确新来源和复制反馈。

## 资源收尾、真实失败与数据保持

before 14次请求为13原 EOF、1 fetch_failed/status null，具体连接失败根因仍未知，正常重试后 Task 完成不使失败变成功。after 15次为14原 EOF、1后台 memory 请求 aborted/HTTP200；所有实际请求模型/API均为 gpt-6.1-sol 且 stream=true，合计29/64，但两scope整组 Provider qualification 均为 false。

after Task Completed、pending interaction=0、unfinished assistant=0、Prompt owner=0 的快照同时保留实际 memory source-reader=reading。此次错误在于关闭前只按 Task/Prompt owner 收尾，遗漏了独立后台记忆流；其 receivedAt=1792673895050、最后读字节=1792673931468、abortedAt=1792673931530。正常 public shutdown 之后该后台流中止，不能归咎于来源网页或冒充 EOF。私有 snapshot checker 已增加全部实际 reader 明细，读取真实保存的关闭前快照正向核对得到 reading/1条memory，再读取原终结事实得到 settled/aborted，见 reader-settlement.json；这是观测工具修复与原事实复核，不是重新完成实际Provider验收。后续固定采用“全部实际 Provider request 的原 reader 已结算”核对，不得只检查 Task 完成；在原资源边界内等待，超界保留明确失败。该问题是本次验收收尾不足，不改产品关闭语义，不通过放宽 qualification 处理。before 原查询未保存公共附件读取，故不声称 before 这项通过；after 原 PNG 公共路由200/image/png/643原字节已验证。

两个原 exec 48052/94181 均已 join exit0；public shutdown各200，native物理完成/output drain/request cleanup/精确出生host和target dead_or_reused完整核对。runtime两对和private两对共8份auth/models仅在物理结清后退休。after退休实际值扫描156文件/142520766字节零命中，原auth/catalog完整字节、修改时间和实际access/refresh保持；正式提交前再扫描归档和所改源文档。用户18571页面、服务和真实数据库未操作，两个自有页已关闭。

只读最终重跑两scope完整90表：before原182026行、after原185294行，来源全部原rowid/主键/字段/时间与文件bytes/mtime/canonical五键保持，schema3/完整应用对象/integrity一致。目标各7个原行变化均为实际memory chunk/file各1、容量lease2、三个原Session更新时间；正常新增消息/Source/事件/Provider活动完整保留，不声称目标数据全部不变。一次保留检查漏传参数返回空数组，已用明确 before after 重跑得到两组90表事实；空结果不作证据。最初误用Windows PowerShell5.1调用关闭helper，在精确进程检查前报null；改用既有PowerShell7运行器后原public shutdown200，没有重启或杀进程。

## 交付与未达项

overlay类型检查exit0、前后Node Vite构建均exit0。最终docs:check为345 operations/26 groups，architecture-index为20当前文档全部链接有效；git diff --check通过。正常push仍执行完整hook和fresh远端一致性核对，其实际结果以本轮工具/Git记录为准，不绕过hook。此次为可独立审查的UI读取修复，不更版本、不创建release/tag/PR。

仍需继续：历史中断input的共享生命周期正向结算；新增Source期间完整连续owner证据；全部请求原EOF的有限实际Provider验收（本轮两项失败均保留）。不得把此次修复描述为整个Sources/Rendering或总Goal完成，Goal继续active且仅单开发agent。
