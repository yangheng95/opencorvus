# 404 Task Git 冻结目录与 Question 同页重连

## Recall

用户原始要求：持续迭代当前版本直到明确停止；每批并行体验/调查 UI、功能与缺陷，先完成根因/影响分析并落盘，实施有证据的改进，真实桌面交互与截图人工复核、聚焦正向功能检查及需要的授权 GPT-6.1 Sol 验收，范围提交、拉取合并上游并正常推送，然后自主进入下一批。不限 token 预算。本批两个既有单层 agent：audit_functionality 和 audit_ui，均禁止再次委托。

上一批已交付：402 实现 b3958bebfd9728c43c42c8f7ba4b9d9af53beb72、证据修正 e0ba0bbe5cb5e34e50534cd7ad7a3fe0a2d79520。原 push-final02 进程正常退出 0，日志记录 a168da234..e0ba0bbe5 main -> main，全部正常钩子通过；随后 fetch 确认两个提交均为 upstream 祖先。402 原页面/服务/模型 occurrence 均关闭。保留原失败与迟关页面边界；没有把 Work/Mission 根权限、Question 真重连或 Task 全链完成写成通过。

本批指标：实际 Git 重现须记录可核对 executable/version/cwd/argv、仅环境变量名称、marker/realpath/frozen authority、数值退出及 stdout/stderr；修复须保留冻结权威、工作目录、pathspec、锁与原输入，真实 prepare/complete 输出成功；UI 须在同一独立页、同一 Request，真实断流重连前后截图与可继续编辑/精确提交结果。未经实证不得预先实施候选修复。

硬约束：无 UI 自动化测试；所有模型交互流式；不合成消息/决定/终态，不缩短目录、复制仓库或关闭 Git authority 来遮蔽问题；不改变用户 Git/操作系统设置，不操作用户进程/页；无凭据写入。受控 Provider 证明产品执行路径，不能冒充 Sol 验收。真实 Sol 如必要保持配对 auth/models、精确模型验证和原 600s/20 请求/180s 无活动期限，页面在 deadline-60s 前关闭；物理退出后原父 owner 清理。仅提交本批路径，保留共享工作区改动；无新增分支/worktree。

已读材料：402 Recall/最终结果/Scope08 公开 Task 基线错误；当前 07-panel、07-panel-reactivity、task-runtime-directory、Task 控制与 Git checkpoint 架构；EngineGit/EngineGitProcess、Process/NodeProcess、Session/Question/Permission SSE、Main/SideChat/InteractionDialogHost 与合法 Work/Mission 创建路径，相关非 UI 后台测试。Git、checkpoint、Question 与 Work/Mission 定义/调用/同语义入口及历史搜索由两 agent 完成并由 Root 阅读下列冻结报告；报告全文保留在 scratch，新增公开 evidence 时排除凭据/数据库/原始真实 Provider 负载。

委托反馈：`.tmp-standalone-permission-projection-402/next-task-git-investigation.md` 说明显式绝对 Git 目录候选、全部生产消费者、终态/retry/restart/multi-project 边界与尚缺原 argv；同目录 `next-work-mission-question-investigation.md` 说明合法入口、真实 Question replay 身份链、同页断流方案、聚焦协议 checker 与未知。两者均只读生产、仅写独立 scratch，没有运行服务/测试/浏览器/模型或读取凭据。

全仓搜索结果：EngineGitProcess 是 checkpoint 的闭合 Git 命令词汇唯一实现，普通 cwd discovery 与 frozen repository 命令共用 execute；snapshot/index、build-observation-ref、cleanup 的显式 Git 参数为同语义影响面，须分别分析，不盲改。Question 一份 canonical pending store；Main 与 SideChat 均消费 session.connected 之后的真实 Asked replay，组件草稿属于各自 owner。GlobalCreation kind 只有 global_task/global_chat_start；Work 与 Mission 有自己的合法 API，不能手造 Mission 或修改 metadata 验收。

恢复/压缩后先重读本 Recall、文末进度、原 owner/deadline 和验证命令，再继续；不重新生成已经接受的 occurrence 或改写原失败回执。

## A. Task Git：根因和影响分析（待实证）

可观察现象：402 Scope08 正常 POST /task 接受后，真实 prepare-baseline 写基础设施错误 `Git HEAD inspection failed for repository .: fatal: '$GIT_DIR' too big`；该错误比后续 Permission 创建早 1119ms。Task 保持 active，后续外部 CSV 不在任务根的 Tool error 与没有 typed 决策的 exhausted 是独立问题。不得把批准成功说成 Task Git 或 Task 终态成功。

直接触发候选：engine/git.ts repositoryStatus 的 symbolic-ref -q HEAD 返回非 0/1；不能依据产品前缀声称只有 rev-parse HEAD 失败。repositoryAuthority 先通过 cwd discovery 冻结 workspace/git_dir/common_dir/index_path/object_format，再由 git-process.execute 无条件生成绝对 --git-dir/--work-tree。实际 source 中 core.longPaths 已启用，环境没有继承父 GIT_DIR/GIT_WORK_TREE；错误中的变量名称来自 Git 的 argv 解析。

机制依据：[当前本机版本对应 Git for Windows setup.c](https://github.com/git-for-windows/git/blob/v2.45.1.windows.1/setup.c#L878-L902) 在读取显式目录前检查字符串长度；[官方 Git 命令说明](https://git-scm.com/docs/git) 允许 --git-dir 使用相对 cwd 的路径，仍禁用仓库自动发现。旧实现开启 longPaths 仅解决文件系统路径展开，未处理显式目录启动约束。原 Scope08 的 cwd 为 219 ASCII 字节，普通 .git 候选为 224，但原 executable/完整 argv/marker/frozen git_dir/数值 exit 未保存，以上推导不可补写成历史事实。

影响范围：Task API、worker、CLI、Panel、Mission 创建的 Task，共享 EngineGit prepare/checkpoint/result/complete、immutable epoch outcome、checkpoint lease、project Git lock、raw blob/index/tree/CAS ref 与重启对账。取消/终态路径中需要 checkpoint 的状态仍可能失败；已持久失败 outcome 不可原 epoch 重写，修复只使新合法发生轮次成功。普通 Chat/SideChat 没有 Task baseline，本错误不能泛化到它们。每个 Project authority 独立；串并行、普通仓库、managed worktree marker、嵌套仓库、同/跨盘外部管理目录、Unicode 字节均须分析。Snapshot 等消费者是否同一根因仍未知，不能先增另一配置源或覆盖所有 Git。

公共错误/数据合同：保留原基础设施 error cause、immutable request/outcome、Task workspace identity 与终态 absorbing 规则；不取消冻结 authority 以回到 cwd discovery，不加失败后 retry/fallback，不改 cwd 影响 pathspec。确证后候选只允许在单一 Git argv 编码层表达同一个 canonical authority；跨盘无法相对表达的情形必须保持明确正确合同，不能猜测。

风险：不同盘/外部 admin、managed worktree、repository relocation 与 replay；Git binary 版本/byte threshold 差异；参数序列与环境覆盖。目录实际内容和 checkpoint 行为是验收对象，源码摘要或重新计算期望哈希不是门槛。原真实 Git probes 与生产闭合命令 checker 均不得触碰主仓 Git 状态。

## B. Question：根因和影响分析（待实页）

可观察现象尚未知：402 已有普通 custom 输入/提交通过，没有同页断流；不能把 reload 或关闭面板后的丢稿作为本合同。当前候选是同一 pending Question 的 Asked replay 替换 interaction 引用。Main handleStandaloneQuestion 每次创建新对象，Dialog keyed Show 随引用重挂载；SideChat connected 清空全部 pending，随后 replay 新建 Question。InteractionCard 的 customText/drafts 为局部 signals。Main connected 仅保留 Map Question 不足以保证后续 replay 仍同 owner。

数据流：Question canonical store -> 订阅 -> 捕获 pending snapshot -> drain -> connected -> 同 ID Asked -> 缓冲 live events；重叠合法重复。终态真实 replied/rejected 包含时间/答案，不得隐去。产品 transport 关闭失败的 EventSource 后由同一业务层 3s 重连，原文档不导航。Main Dialog/inline 和 SideChat 分属 owner，切页/切 source/关闭面板不是本轮草稿保留合同。

影响范围：Global/项目 Chat、Work、Mission 的非 Task Main Question；Task Board Question 另有 owner，必须审合同避免修改；独立 SideChat 本身。multi-request 排序、更早 Permission 抢 Dialog、超时/自动答复/离线终态、source/directory 切换、同 ID 不同 payload、child 准入均须精确分析，未知处保留；禁止为保存草稿建立 localStorage/第二 pending 队列或残留已终态影子请求。不直接取消 keyed Show，因为不同 ID 的闭包与草稿串用尚未证明。

旧路径原因候选：仅 Map 幂等 ID 并没有保持组件引用；SideChat Permission 快照整体替换同时误清 Question。修复方向须由真实 before 决定：同 immutable Request 重放保持一个当前投影身份；合法终态/权威 snapshot 收敛仍真实更新。若完整 pending Question 快照为正确收敛所需，必须先审公共 schema/所有消费者并按正常 SDK generation 更新，不能把缺失快照用旧 pending 猜测补全。

## 实施与验证顺序

1. audit_functionality 可在独立 `.tmp-task-git-question-reconnect-404` 编写并运行真实 Git 有界探针与非 UI checker，不改生产。保存 executable/version/cwd/完整 argv、环境名及每个真实 exit；复现 ordinary 长路径 discovery 成功/显式同 frozen directory 失败，另验证同 canonical authority 的候选编码与 worktree/嵌套/外部 admin/Unicode。原 child 物理退出后原 owner 删除隔离目录，输出留公开 scratch；不得增预算、短路径绕行或复制原 Git 内容。证据返回 Root 才批准生产范围与正向测试。
2. audit_ui 可在同一 scratch 编写 Node 原生 HTTP 透明 relay 及非 UI 原始字节 transport checker；禁止自动操控页面/截图/DOM 或运行 UI 测试。所有 method/path/query/body/end-to-end headers 和 SSE 字节原样转发，只登记 exact Session events route 的 stream pair；本地 control 仅断目标流、不改事件，不重启真实后端。relay 与原服务同固定 owner/deadline 管理，先验证普通 HTTP/真实流式字节、断开后新连接输出与正常关闭/join。报告给 Root；生产仍只读。
3. Root 用真实开发模式 `/ui` 的独立 relay 页，Main Dialog/inline、SideChat 分别同 Request 输入公开 draft -> 截图 -> exact SSE 一次真实断开 -> 原业务重连 -> 截图/继续编辑/提交。核对 original Request、工具 answers 和自然 final reply。首例若丢稿保存原态，先完成影响分析和实施决定，不扩大试例冒充通过。截图保存原始 JPEG、人工查看。Work/Mission 外部 read 分别合法 Composer/API 创建，准确标明哪种创建方式，不强造 Mission/Task completed。
4. 有证据后按本 spec 追加最小实施文件/公共合同/测试清单，再授权 agent 实施各自非共享范围；Root 负责共享架构、SDK 事务协调、真实页面、必要 exact Sol、归档与 Git。聚焦正向功能测试实际输出/状态/错误，不以 UI 源码/DOM/快照证明草稿。遇调度/恢复/终态异常立即共享机制横审全部入口/occurrence/多项目，不能降级为模型偶发。
5. 完成核心/Overlay/SDK 需要的 typecheck、真实 checker、人工复核与 docs:check；归档公开输入输出/原始截图/生命周期及未达成边界。只 stage 本批 exact paths/共享 index 精确 hunks，正常提交，fetch/merge/upstream..HEAD 全集审查、必要验证与正常 push；不创建 Release/tag/PR。之后自动下一批。

## 当前进度与验证命令

2026-10-14 05:25 本地：只读调查与 Root 方案落盘完成；生产没有本批修改，Git/Question 候选尚未运行复现。共享脏文件属于 compaction 等其他已授权任务，保留。未新增 UI 自动化或新 branch/worktree。

正式运行器使用仓库 Bun 1.4.0：`.tmp-product-iteration/sse-compression-305/bun140/bun-windows-x64/bun.exe`。聚焦测试实际文件由证据决定，当前不得无目标全量运行。文档命令为 package.json 当前 `bun run docs:check`；必要类型分别 `bun run --cwd packages/opencorvus typecheck`、`bun run --cwd packages/overlay typecheck`。每个运行记录原 command/cwd/exit 与输出，不能借 peer 后续变动改写失败原因。

## 2026-10-14 第一轮真实证据（实施前）

方案提交 a2f8a793d4a1955da0aa4870a0a3a7850f780afd，docs:check 345 ops/26 groups 退出0。实际 fetch 后 upstream..HEAD 仅这一个 Root 方案提交，merge already up-to-date；原 push exec57942 退出0、全部正常钩子通过，日志 74ff844f6..a2f8a793d main -> main。共享 compaction 改动保留。

Git 探针01保留完整失败：ordinary/nested/Unicode/同盘外部 admin 的 cwd discovery 成功，绝对 frozen 参数退出128，same-cwd relative 候选退出0并校验原 ref/pathspec/公开二进制字节；跨盘 relative 实际仍绝对且退出128，managed worktree 的 Git 自身默认 checkout 也在 fixture 准备阶段触发同错误。71个真实 Git 子进程均结算，worker自然退出1，原父删除独立双盘输入。探针02用合法 worktree add --no-checkout 明确区分准备与后续实际 checkout，84命令/6边界检查正常退出0；跨盘失败被明确作为未满足边界记录，不能据 checker0说完整修复。探针03正在验证另一单一 argv 编码，生产仍只读。

Root 原私有 UI 构建实际退出0；第一次 scratch 复制命令误在 packages/overlay cwd 使用相对根路径，原工具错误保留，随后绝对路径复制成功；此错误没有启动产品或覆盖原402输入。Node透明relay最后一次非UI checker `relay-check-1791926908114/result.json` 五项正向 HTTP/原 gzip 字节/先段流式/精确连接中断与另一连接完成/新流跨 chunk Unicode/正常关闭合同通过（五步中部分组合多个子项），原child61452自然close0，上游已关闭。relay owner kill0 只证明 liveness；物理身份/结算由 Root NodeProcess 原 occurrence负责，最大600000ms，不续期。

### Question Main Dialog：同页草稿丢失已真实复现

独立 `question-before-01`：产品 PID85116，原 NodeProcess occurrence80b8a743-3a97-4541-96ea-43ae23fac68f；服务内部 occurrence8ae1dd83-b63a-4e00-bbe3-e06df7d64e56另记，不能混用。relay PID87584，原 NodeProcess occurrence011b4631-33e1-4d46-9fdb-b87e90f10b45，控制 occurrence53db98e0-8819-4998-885b-b076403618b3。原deadline1791927564684、closeBy1791927504684。页面tab12从relay59484 /ui首次进入，原服务54759，Main真实Session ses_hqElzdDiO8HYgFV2Kb2V/Project prj_hNTceRjXnI9KnhuQ3Hic。公开受控streaming Provider自然产生真实Question，未调用Authority拼请求。

手动Dialog输入 `Draft before reconnect Cedar 404`，原JPEG `dialog-draft-before.jpg`人工可见。GET真实conversation于1791927038019记录pending ID que_g0VXy38Oe002YAEFtRnD、time/questions/tool原事实。手动relay控制1791927038291仅切该Session pair9acaed2c-71ad-40ac-adea-9e9258b6b1a5，cutCount1；原stream关闭，新pair d2ff1e58-0659-4580-abae-69bf9346401b于1791927041303打开，间隔3012ms。Root没有reload/导航/关闭Dialog/切source/重启服务。原JPEG `dialog-draft-after-reconnect.jpg`显示custom为空、焦点回到第一选项；这是草稿保留真实失败。relay只记录连接事实没有解码/保存业务事件，不能虚称已保存该新stream完整connected/Asked原始payload。

随后明确重新填写 `Recovered after loss Cedar 404` 并真实UI Answer，属于正常收尾而非草稿保留通过。后台实际checker输出：原Tool message msg_g0VXy31Tv00pAC4DidDx/call_controlled_recovery_next 状态completed、metadata.answers精确该新答案；自然final msg_g0VXy3KNZ00PDvqxjYDU finish stop、原用户输入绑定/Session一致，Board idle；原JPEG `reentered-answer-natural-final.jpg`人工可见Not running与正文。page-closed早于closeBy，先关闭relay、再请求原产品停机，原exec35920退出0，两个NodeProcess物理/output正常结算0，原parent移除外层runtime且内层随之移除；`close-review.json`保存具体回执。没有真实Sol调用。Dialog before得到证据，inline/SideChat与Work/Mission尚未运行，不能外推。

机制已获得代码和真实页面共同支持：[Solid Show官方行为](https://docs.solidjs.com/reference/components/show)说明keyed值变化重建；当前Main Asked replay无条件产生新interaction且局部草稿随该owner初始化。禁止只改Show或新增平行草稿存储。补充横审正在核对question.expired/abandoned全入口：后台model/mirror/Task interaction已有真实终态，Main event-policy/tree-writer与SideChat只接asked/replied/rejected；离线终态不能靠“保留旧Map”推断收敛。完整公共Question快照/不可变Request身份/所有consumer的实施决定须再落盘后批准。

## A 实施决定：同一冻结权威的单一显式参数编码

Root已阅读探针03源码、214个真实命令/六case与独立checker-result、物理回执和原父cleanup。Git2.45.1.windows.1下六类ordinary224/nested231/Unicode252/external235/managed248/cross-volume235字节：原绝对显式参数都返回128；单一候选都返回0。候选固定为 `-C <dirname(frozen git_dir)> --git-dir=<basename(frozen git_dir)> --work-tree=<frozen workspace>`，Process.runHost cwd仍原workspace。Git相对解析指向同一原realpath，不另发现仓库、不造短路径/复制目录、不根据失败切换实现。不采用仅relative目录方案，因为真实跨盘失败。

实际验证覆盖原Process cwd、canonical authority、symbolic-ref/root ls-files pathspec/diff、两公开文件字节、fast-import精确二进制、absolute独立index的read-tree/update-index/write-tree、commit-tree/CAS ref/read/delete/recreate与canonical index；真实object ID用于Git对象协议与真实读取，并非可变源码摘要门槛。原host执行闭合词汇全部repository目标由inRepository构造cwd=workTree，其他discovery目标没有repository，保持原路径。外部index/identity/environment/security overrides维持原值，追加-C在既有core.longPaths等配置之后。

批准 audit_functionality 实施范围：`packages/opencorvus/src/engine/git-process.ts` 的唯一 execute固定参数构造；新增一个聚焦非UI正式正向测试（名称由agent明确提交Root），覆盖真实EngineGit.prepare/complete的合法长目录/原raw bytes/immutable checkpoint receipt与项目隔离，先保存当前正向测试红态再实施。必要复跑既有闭合环境、checkpoint transaction、fact reconciliation的直接合同，过期负向测试若触及须按正向错误/状态合同修复而非保留兼容。不得修改public outcome schema、旧失败同epoch数据、Task admission/Orchestrator策略或其他Git调用者。更长的实际filesystem路径（至少300字节）和既有source/worktree prepare路径须在批准范围内补实证，失败先分析工具/产品rootcause，不缩短输入后宣布通过。

风险/交付边界：六类原始probe通过不能代表真实EngineGit/Task/Sol或Linux已验收。Managed fixture原默认worktree checkout失败独立保留；不能把--no-checkout准备当产品worktree流程已修复。Snapshot/build-observation/cleanup源只读审查后另列是否适用，本次不并行重写它们。Root仍需真实Task页面与需要的exactSol及范围Git交付；Question生产此时仍未批准，等待完整终态/快照分析。

Root下一条SideChat before为同机制影响面核实：独立新原600s scope，不沿用已关闭Main occurrence。Main正常plain流式reply，仅由真实UI Side chat按钮创建独立自身Session，随后公开Session message提交明确可见Question用户输入并选择独立受控side模型；报告API prompt + UI创建/决策，不冒称全文UI发起。只切该side Session SSE并截图其inline草稿；保留Main stream，使用原server/relay生命周期。此步骤不批准生产，不扩大child/Task Question能力，失败后原证据保留并正常收尾。

## B 实施决定：真实发布事实、Task收敛与单一重连快照

Root已读完整 `question-terminal-snapshot-review.md`、`question-implementation-plan.md`、三个真实红态源码/输出及原Task/Question/Store代码。SideChat before同页丢稿也已亲自查看原JPEG：独立Side ses_-zUS1uV6Qzz9AhWaLvu9/Question que_g0VXy5beU007NzwQoo5i，cut仅Side一条，3012ms新连接；原Main pair未改变。重连前后canonical Question/time相同，草稿为空。明确重新填写后的真实Tool答案与自然final/idle通过，不能改写为保留成功。原exec94181退出0，产品88536与relay70284各自原NodeProcess物理/output结算0，页在原closeBy前关闭，原parent runtime已移除。

共享机制实证：red01（0pass/2fail/4assert）、red02（0pass/3fail/6assert）标准Bun1.4 isolated包runner实际退出1且结算；不是UI测试/源字符串检查。Asked真实subscriber可观察完整Request时canonical pending尚为空；延迟原durable Asked后，真实reply先成功，随后Session投影出现replied→asked；Task terminal subscriber在request行尚缺时return，之后Asked补pending行，真实recovery将已回答Request恢复为pending。这同时影响正常/终态/重试与重启收敛，不能只修UI。完整报告覆盖Task/Mission/Session/occurrence、普通工具与durable coordination、CLI/ACP、串并行/多Project，未知UI与全入口实机边界明确保留。

### 唯一数据流与事务合同

1. Question初次接受两分支合进既有Database.immediateTransaction，保留acceptanceEffects/exactOccurrence成对校验。利用原Database.effect：在Bus发布effect之前登记完全同步的原pending waiter/timer安装effect。root commit后effect按序运行；rollback/savepoint丢掉effect，不安装未提交pending。重复Ask仍附着原完整Request/time/expiry；不等待所有慢Asked消费者，不改通用Bus跨occurrence排序。
2. Question提供一个typed publication-facts reader，直接查原BusPublicationOutboxTable、现有Request/五Event schemas与原terminalOccurrenceID。校验原Project/session/request/Asked occurrence，terminal先到则从最多两条精确匹配原Asked事实取得Request；重复/错Project/identity为明确错误。返回原Request/terminal properties/原occurrence/time/answers/origin；没有终态事实才是pending。无新表/cache/配置/Request schema/第二terminal writer。canonical list/snapshot读取也核该事实，物理waiter Map仅保留既有生命周期职责。
3. Task五Question事件和恢复使用一个原source-backed projector：在单个原事务查/补request source pointer，已terminal时补唯一outcome source pointer、原真实userInput memory和原resolved通知。原insert/resolve/ProjectMemory/Task control scan primitive复用。terminal先到与Asked迟到均收敛同一originalAsked+terminal；recovery先对账再恢复真正pending，不能重装ghost。direct control-plane、Permission、A2A action owner不伪装成Question；不改Task状态机、工具选择或调度预算。
4. Session mirror按同一原事实处理当前投影；已terminal的迟Asked不得再投pending，必要重投时只能使用已接受原terminal的完整payload/原时间/身份，不造新的Bus消息/用户消息/模型回复或决定。原Question事实保留在真实Tool/发布记录，不能隐藏或改写。
5. connected增加必有pendingQuestions数组，复用现有SessionPendingQuestion与cold纯Request/orderKey投影；原subscription→snapshot→drain→connected→buffer sequence保持。删除手工pendingQuestionEvents Asked重放路径与仅服务它的函数，正常live Asked/terminal仍真实发布。缺项只移当前pending投影，不猜answered/expired，不造resolution time。无optional/default[]旧协议兼容。
6. 明确批准cold/warm child一致合同：选中Session的真实Project/Session tree内、非Task所属Question由Session投影；Task所属唯一由Board/EngineInteraction。原isStandalonePermissionSession原位更名isStandaloneInteractionSession、函数体保持durable lineage/Project/taskID事实，更新全部调用并复用Question，不留旧名wrapper/第二predicate。Main在当前source/authority/generation下消费服务端已核树事件，不再依赖临时knownMission/root UI gate。SideChat只exact自身Session。角色/transcript/lifecycle不扩改；真实child/Project/Task正向checker必须证明合同，既有before不代表child实页通过。
7. Main/Side共用一个pure Question normalizer，完整immutable fields含expiry、time/orderKey、session/id/questions/tool/automatic及持有directory。同pending Request重用原对象，不同ID才新建，冲突给明确错误；canonical array一次提交、四terminal明确映射（answered/rejected/expired含真实origin/time，Side移exact ID）。不用hash/标题匹配/tombstone/localStorage/第二草稿来源，不取消组件keyed。Dialog/inline分别保原owner，切source仍原reset。

### 分工与精确写入清单

audit_functionality完成Git后接后台Question：question/index.ts、engine/interaction.ts、engine/task-session-lineage.ts、protocol/session-mirror.ts、engine/model.ts、server/routes/session.ts。新增正式 `test/question-publication-projection.test.ts` 承接实际三个红态，扩现有engine-interaction-recovery与session-event-connection-snapshot及必要session-permission-projection当前contract；只能非UI正向输出/状态/真实错误，触及过期负向测试按当前合同改或删。原red和原Source先冻结；无Bus/DDL策略重构。确有import环或契约新增范围先报告具体证据Root补spec，不能猜测绕行。

audit_ui负责Overlay：services/conversation.ts、tree-writer.ts、side-chat.ts、event-policy.ts，以及新增utils/question-interaction.ts；把原normalizer搬至新共同实现并删除原定义/wrapper。仅现有纯transport/state测试side-chat-transport、subagent-conversation-service的正向协议fixture与必要pure identity/error契约；不得DOM/render/source-copy/截图/Playwright测试。组件暂不改；真实inline若仍重挂载先把visual结果交Root分析。

Root独占SDK正常完整generation/build/publish/join事务，后台模型/路由冻结后生成types.gen.ts和openapi.json，不手改/不混peer差异；Root负责共享architecture/spec/index/CHANGELOG、真实Desktop/截图与需要的exactSol、公开归档及Git。两agent不提交/push、不互相扩大写入/再委托。各自原600s以内own检查，终态必须physical/output/request join，禁止新凭据或操作用户进程/页。

### 正向验证与交付边界

正式checker涵盖：接受observer看到完整Request；acceptance transaction明确错误/原另一个pending完整集合；terminal-first/lateAsked/原retry/恢复按真实answered/rejected/expired/infrastructure/automatic/time/answers收敛；真正pending复原、多Question/两Project隔离；cold/connected完整同Request数组、实际HTTP reader断开后重连、离线四terminal剩余集合、cutover竞争、合法child与Task soleowner。测试双数据库/恢复fixture仅后台合同，不冒称所有E2E路径通过。原Task gate/Permission继续既有真实合同。

Root后态必须真实Main Dialog、inline、独立SideChat各自同页断流后原草稿继续编辑/精确提交，明确请求身份与自然reply；同时做可达expired/abandoned或离线terminal人工场景并标注准确覆盖，合法Work/Mission read仍独立范围。Git16tests/215assert+types0不替代真实Task/模型/UI；ASCII310 native267原限制保留。无哈希/源码摘要/视觉分数交付门。

### B 同文件producer与并行源码追加核对

功能agent发现Question Instance disposer仍随机发布Abandoned，而其他四terminal helper已用原terminalOccurrenceID。批准原位统一该producer到既有terminal槽，已有真实terminal时必须结算原物理waiter，不能再写冲突Abandoned。历史已经接受的outbox仍是同一当前Event schema真实事实：typed reader统一按Project/session/request/四terminal类型查最多2条，返回实际originalOccurrence，不采用先canonical ID失败后随机ID的fallback或兼容reader。唯一事实允许明确pending分支；多条不一致terminal为明确数据合同错误，不以latest错误/标题/时间猜胜者。加入真实accepted reply、postcommit interruption与dispose重叠的正向当前结果检查。

当前共享工作区另有已授权peer修改bus/index.ts和新增delivery-transaction.ts；本批不修改这些文件。实施前重读其当前Database effect/delivery上下文，保存原red与新源HEAD时间，正式checker验证当下source；不把此前源码假设当peer现状，不覆盖其diff。

Git最终冻结自有1生产+1新后台test+2既有正向更新，去重5文件16tests/215assert通过，core包声明typecheck0。产品managed Worktree.create原来就是no-checkout+cwd-only reset，新实机Ready/prepare/complete通过，UTF8 371/UTF16 227；probe01默认Git worktree命令的失败不能称该产品入口失败。普通路径UTF8 330–332/UTF16 186–188通过、两Project并行/immutable replay/raw bytes通过。首ASCII310 native267未满足，原事实另存且共享27调用文件只读横审已完成，不改用户设置/短路径/监督器；命名空间/UNC/POSIX更广实机仍未知。

公开before归档：`specs/artifacts/2026-10-14-task-git-question-reconnect-404`，148原公开输入/输出条目、6原JPEG、总原字节2343769；冻结capture03作为原字节验证对象，originalSource仅来源定位，后续源修改不重算“期待摘要”。第一次归档工具白名单遗漏txt、第二次试图遍历own project元数据，均在接触不允许数据前拒绝；原partial01/02保留于scratch，修正显式目录排除后第三次完成。未归档凭据/真实模型目录/runtime数据库/二进制/privateUI或peer全仓diff；产物只是原before证据，不使尚未验收项通过。

## B 冻结检查与新增恢复边界

后台六生产/三test已冻结：去重39tests/226assertions，包含真实TCP双Project、合法非Task child、四终态、cutover与重连；core声明typecheck0。原11scope均physical/output/request结算并在原600s内结束。扩展检查保留timer继承closed Database effect owner、dispose exact publication未retry两真实实施问题，以及旧reader并发、非法architect fixture、abort先于reader cancel三检查输入/工具失败；当前分别修正，不能用后续绿态抹去原回执。

Root SDK完整六目标generation transaction final02退出0，实际PID86276/occurrence80915fc8-fc16-4f2f-9aaf-2c02b742f80f，20.6s、原deadline1791930702536，physical/output/request均结算后原父清理。实际tracked只有types.gen.ts和openapi.json新增required pendingQuestions完整Request数组。原首调用路径分隔符校验失败未创建scope，第二次final01缺少父process supervisor声明在spawn前失败，runtime已清理、physicalJoined未宣称；修正沿用原项目primitive后重新完整final02成功。未外部发布SDK。

新增只读未知：普通非Task工具Question进程突然退出时，canonical waiter重建为空；InstanceBootstrap注册bridge/Engine后启动非join Bus.resume，EngineInteraction仅恢复Task请求，Question.restore只有该caller，abandonRecovered没有生产caller。若原Asked已接受而wildcard未结算，正常恢复/重试可能再发pending，当前publicationFacts无terminal，实际reply因waiter缺失404。此为源码可达候选，真实public重启时序与UI尚无证据，不能预先宣称已复现/根治。立即横审全部Main/Work/Mission/Side与Task/durable入口、accepted/terminal、串并行与Project隔离；agent只读补完整报告与原600s真实process red方案，Root读证据后才能批准运行/实施。暂不改Bus、SessionLoop、恢复策略或新增状态来源，当前39/226不能覆盖该未知。

Root已读补审完整13文件事实与矩阵（question-crash-recovery-review.md）：普通Main/Work/Side同Tool waiter，Mission recovery结算原Tool却未归属Question terminal；Task未物化Asked与scan先后也未知，已物化Task和A2A重执行不可外推。批准只在独立scratch实现并运行该报告真实process red：父原600s、最多两个顺序child各原≤180s、请求≤30s、留60s结算；实际受控streaming Provider→公开SessionPrompt→QuestionTool，现有suppressAutomaticDurableDrain仅建立commit未delivery窗口，crash23物理join后相同持久runtime正常重启，identity SSE先连接、真实GET/question触发InstanceBootstrap/Bus.resume，捕获原Asked、canonical数组与精确reply HTTP/错误合同。不得手工mirror/造消息/Question.restore/终态/改clock/新凭据；fixture prerequisite失败准确保留。尚未批准生产扩展。原Task未物化与已terminal control方案继续按报告补证，不允许以Map缺失伪造Abandoned。

private finalizePending全仓仅一非export声明、preimage亦零调用，十行wrapper没有模块effect或公共契约。精确删除不会改变实际takePending调用与当前terminal合同，可在最终自有Question范围删除并重跑原聚焦正向合同；不扩大无关清理或加“函数不存在”测试。

Root 后态真实页面：question-after-dialog01（tab14，产品75332/06f59cf5-f68d-4fd8-8b6b-064dce01f7ec）同Request que_g0VXyHORI00zzOwQGFe9，原pair ff06919a→36af3b17，一次切流后原草稿`Dialog draft kept Cedar 404`保留，追加` plus Iris`精确Tool answers，自然final msg_g0VXyHXm0002PiHuPnHR stop/idle。question-after-inline01（tab15，产品83480/5a471a77-d393-4152-af5b-afc3ecacc2c2）先Esc关闭Dialog再内嵌输入，不声称跨owner同步；原que_g0VXyHli500EEOOt8HJx/pair11cabb57→b8305821，原`Inline draft kept Iris 404`保留再追加` plus Cedar`，完整Tool答案/final msg_g0VXyHuYx00gY32mAhQr stop/idle。question-after-side01（tab16，产品29724/5bb97b34-005f-4155-babf-61ea90ae6ffb）真实UI创建独立ses_-zUS1hg26zzvEWEg3xha，公开可见API prompt触发工具；原que_g0VXyIT1v00K13tYJZu1/pair cfe19cf5→12ad1a45，Main c44d7752保持；原`Side draft kept Maple 404`保留再追加` plus Iris`，精确答案/final msg_g0VXyId0i00jcRWIhPlC stop/idle。三个原页面均早于其closeBy关闭，原exec54780/67649/90389自然0并physical/output/request结算，原父runtime清理；每条3原JPEG亲自查看。Side原attention banner仍持续，候选另记，不说整页问题全修。

前端最终pure transport36/90与Node私有build0（90848/5f3c4ad3-ffba-4ef6-b34e-4e445524a472）；首typecheck2六诊断全部指向并行Providers未补import，未改peer。其源码补import后，在同原deadline1791930858188内复验type0（66160/0afb5d60-9b08-433a-9dde-559d2b621f4b），物理/输出/请求闭合。UI bundle构建早于该peer import修正，本批五Question源未变，不把复验说成重新构建了Providers。

真实SolQuestion01：NativeService原deadline1791931376984/closeBy1791931316984/20请求/180s无活动未改。配对auth+完整models由成熟原生wrapper分别验证usable/projected/actual gpt-6.1-sol streaming；Root原tab17实际QuestionTool自然Asked que_g0VXyJ82r00zo7UKjJXw，UI回答`Cedar 与 Iris 公开样例 404`，Tool完整answers，原assistant msg_g0VXyJKH100mT80tkxIk准确中文`你的完整答案是：Cedar 与 Iris 公开样例 404`、stop/idle。共5实际流式200/reader settled EOF（含预检，不计为5业务轮）；Root人工看2原JPEG。page先关，再正常shutdown，原exec17972/84228各join0；Target31016/Host76388原native physical/output/request自然0/端口释放后原父移除两个副本。首观察helper明确process.exit(0)触发Node UV_HANDLE_CLOSING断言、退出1，观察原JSON已保存，修helper自然退出后observe/check0；未重启服务/续期/掩盖工具失败。manual-after公开151条/11原JPEG/1674027原字节，排除raw真实Provider负载/凭据/模型目录/runtime数据库/privatebundle。

突然退出真实red01：正式0pass/1fail/8assert，红仅liveIDs与canonicalIDs完整集合不一致。实际Provider→公开SessionPrompt→真实QuestionTool/Asked已commit且wildcard未完成；原producer29528自然exit23并join，新81580正常identity connected[]→GET/question bootstrap→原Asked que_g0VXyJVoR004gV9Za76I→cold[]→精确public reply404/NotFoundError→reconnect[]。原owner实际dead_or_reused；第二child正常server/DBclose自然0，父exec24028 exit1/join、Provider关闭和物理退出后runtime删除，19.5s、原600s未延。此为真正错误证据，不能算恢复通过；Task尚未物化控制和唯一投影方案正在补分析，生产未扩改。

Root补空header/真实期限UI：仅复制既有自有manual helper到新scratch入口，固定warm-question，公开Tool参数header为空（当前Request合法字符串，不改schema）和现有OPENCORVUS_QUESTION_TIMEOUT_MS=30000，明确experimental.auto_question=true；无生产变动/造Question/终态。新原600sscope真实UI查看无硬编码标题情况下的正文/可回答控件，再等待原真实deadline、Tool错误与自然Providerfinal，截图人工复核。不得把新短Question业务期限当延长原服务预算，不能以截图/DOM自动断言验收。此例不必再次调用真实Sol。

Root已读task-git-public-harness-plan.md完整source/调用证据，批准audit_ui仅四新scratch helper实施（driver/server/facts/control），旧402/404helpers不覆盖、不改production/SDK、不启动直到Root读helper确认。继承双层runtime及GlobalChat实际原长目录，202后Task接纳前flagwx公开CSV写入实际根；同Task独立Provider首次Tool对象在实际请求前绑定真实路径，Task body base/work/unique model、exact directory header+initgit真实202。父原600s/closeBy-60；seed/memory自然release，Taskfirst暂hold待RootUI、second Prompt只受控transporthold；Root实际Allow/read/原Stop取消。publicBoard不调用EngineGit.project，metadata.git不可验baseline，选定read-only SQLite join唯一request/outcome与Task/root/binding，加真实git show originalCommit:CSV原字节，不能checker调用prepare/complete。取消明确跳过resultcheckpoint，只验baseline/read/cancel并原physical/output/request结算，不说Taskcompleted。当前输入长度/实际运行结果尚未知，不得短目录替代。Task“Board不展示Git投影”只列独立候选，未扩产品范围。

## C 崩溃重放：唯一投影与恢复 authority 分析

Root已读question-crash-results-and-minimal-contract.md全部事实、原红测/控制和原Message→Tool→PromptOwner链。red03真实Task source-only已持久Asked但无request行、原child29060 crash23；新82796正常bootstrap后Board pending/canonical[]/reply404，formal0/1/8。已terminal控制原occurrence/time1791931313635/answers/userInput唯一outcome均正确。首red02未Git初始化导致Execution Capsule source enumeration prerequisite失败0/1/1，按原memoryProject primitive新scope准备后red03复现；保留原stderr中的Task正常停机abort、memory样例empty markdown拒绝、Bun内部warning，不当Question根因或clean。全部物理/输出/请求及原runtime闭合，无真实Task业务模型运行。

Session直接根因是把“原Asked事实且无terminal”误当当前Server可回答pending；cold/connected/publicreply已使用本Server物理集合，而live却仅outbox，两路径同概念不同准入。批准audit_functionality在已触及protocol/session-mirror.ts的Question Asked非terminal分支，复用现有Question.list的同原publication-facts canonical reader，完整Project/Session/Request/time/questions/tool/automatic/expiry身份匹配后投其原Request；缺本地waiter表示当前Server无pending投影，原Asked/Tool历史仍完整保留，不造终态/时间/消息、不判全局dead、不隐藏Task Board、不加缓存/perID API/fallback/第二pending来源。有原terminal仍逐字段保原事实，先Project/Task准入保持。multiBackend B不能答A，B必须同自身canonical集合；A waiter不改。无UI/SDK/schema/Bus/SessionLoop扩大。聚焦正向checker需在同原机制重启后验证完整canonical/live集合，并增加真正当前新pending可公开回答200的控制与原Asked/Tool事实完整身份；不能以“旧事件不出现”负向断言为核心。

Task直接根因不同：一次恢复只扫已经物化的request，异步accepted Asked之后才物化，因此缺同一被授权恢复owner的pending重建。Task Board是durable事实，不能套Session过滤遮蔽。当前Project-only恢复函数与Question.restore空waiter本身不证明原peer已死；Message.activation/Task lease/native binding/Host recovery owner与原physical身份链须进一步全仓只读核对，禁止每个live projectQuestion无条件restore来形成第二owner。批准agent先补精确owner/accepted-source枚举 primitive、所有production recovery入口与正常/终态/retry/重启/串并行/multiProject/multiBackend证据及推荐方案，先落spec才可扩大生产实施。该真实Task恢复要求当前未满足，不以Session投影修正宣称根治全部Question恢复。

publicTask01原scope：Task tsk_g00VXyNpAy00jyiGA5rx，产品69264/原NodeProcess f275910e-59dc-49a9-a39d-1e5879573265，原600s deadline1791932533084。baseline checker da3bfd63/76964/1d4e76e2真实0、physical/output/request闭合；原root219 UTF8/UTF16、git_dir224、唯一baseline:1 receipt success、原commit e24ebcb39aecc5e653a94c0a4a2b0b8fe8898acd实际读取CSV35B一致。Task随后1791931951561 failed，完整原error与stack证明Base声明default/mcp/browser而fixture禁用；未产生Task业务Provider/Tool/read/cancel。Roottab19实际failed页JPG保留，page早于closeBy关，原stop正常join但产品/driver1正确保留未达read/cancel；原父runtime已清理。不能把此scope说成整体通过。

Root已读task-git-profile-review.md全部manifest/调用/日志：Research Studio完整scheduler/五worker/platform-set/universal-build均没有default MCP，scheduler显式read；不是Base减工具或自造包。General/两个目录skill/mounts/catalog500同一resolver1128失败（实际requestID+stack），非此前parent Git猜测；mission-skill另200。批准仅自有task-git-server.ts用单一taskProfile='research-studio'同时投Globalactive和Task body，并在bootstrap/实际长目录Task接纳前保存catalog200(active.effective相同)+mounts200真实技术preflight；保留disabled MCP/原CSV/长目录/模型/Ask/固定600deadline全部真实合同。旧helper-source与所有原失败保留，Root读freshhelper再起public02，不恢复旧failedepoch或操作用户browser。此为修合法测试输入，不扩生产能力。

Session窄修scratch实际red04完整正向控制：current新Question公开200、实际Toolcompleted/自然final、原Asked/Tool事实保持，唯一全集多旧ID红；red06/rereader red07各1pass/14assert、原owner闭合，core type03/type04各0。最终实现terminal先核原facts、不访问disposing State；非terminal准备原pendingSnapshotReader后同步重读facts+canonical完整Request，回避await陈旧判断，无新API/cache。批准功能agent正式迁移为两个聚焦非UI文件test/question-process-projection.test.ts + test/fixture/question-process-projection-worker.ts：只ordinary分支，复用现有controlled streaming Provider、正式isolated preload、NodeProcess owned_tree和managed temporary目录；移除scratch Task/Git分支/外部必填env，不另建runner/config。原父600s/两顺序child≤180s/请求≤30s/60s收尾，真实公开Prompt/Tool→原commit/crash23→normal bootstrap→完整原Asked/Tool与明确404错误合同→真正current child Question200/精确Tool答案/自然final→完整live/cold集合一致。保留正向14断言机制，不加UI/源码文案/DOM/负向旧事件absence测试。必要本次投影+新过程正式文件及core type复验；未满足Task物化恢复不能据此宣称通过。

## 404 范围交付与未满足项

Root实际publicTask02采用上述合法Research Studio输入，两目录各catalog/mounts均200，原Task tsk_g00VXyQ05D00kQSIgvoP/root ses_-zUS1ZzePzzhtWjZRQof，真实managed目录UTF8/UTF16为219、git_dir224。baseline:1唯一成功receipt及原commit838141d125aa0440af5e1103c8319447efacb53d的CSV35字节核对通过；真实Provider产生read Tool完整三行，Root展开并滚动查看原截图task-read-all-csv-rows.jpg。根内read未出现Permission，不能声称本例点击Allow。真实页面Stop按钮产生actor=user/surface=overlay.composer_stop的取消请求pev_g0VXyQU8Q00xoGbDLDS1及终态pev_g0VXyQULP00pMJ35xIlW，1791932579893 cancelled；最终页面仍保留完整read及原ExecutionCancellationError。baseline/read/cancelled三个独立checker均0，物理/输出/请求join；页面早于原closeBy1791932984876关闭，产品31384/deb38ac1-08e0-4865-8e23-ffb8019b3f60正常0，原exec90555 join0，原父1791932597571结算后删除runtime。仅证明基线、读取和真实用户取消，未证明Task完成或result checkpoint。

空header真实30秒期限：Root在实际Settings语言控件选中文后查看Dialog与inline原JPG，标题空行省略、原模型正文保留、控件随当前中文；原Question que_g0VXyLOij002KIOc8LsL以deadline origin在timeExpires=timeResolved=1791931396637结束。实际askAndFormat工具合同为completed + metadata.status=expired/answers=null，不是error；首错误checker输入与exit1完整保留，修正期望后原source/terminal/time/Tool/natural final检查0。自然final msg_g0VXyLWZk00uFuYFNy5U/stop/idle、canonical全集为空。最终图Project tooltip遮住历史摘要，未宣称精确expiry caption视觉通过。原产品34612/a9db277d-a2e5-4b98-a59b-38885270cf1c、relay55868自然0，原exec8413已join，页在原closeBy前关闭，原父物理结算后清理。

正式后台最终去重Question为40tests/240assert，core types05=0；新process-projection-formal01进入实际公开SessionPrompt/受控流式Provider/QuestionTool，真实child49464/a40960fb退出23，再89968/08d91d2f正常0，14正向断言验证原完整事实、明确404错误与current child真实reply200/Tool答案/自然final、完整live/canonical DTO相等。父600s、child180s、HTTP30s原期限未延，两Provider及物理/输出/请求全部闭合。原Task red03仍0pass/1fail/8assert：source-only Asked恢复后Board pending、canonical[]、reply404；不冒称修复。Root删除无人调用private finalizePending已包含当前复验。Git16tests/215assert、Overlay纯transport36/90，分别去重；SDK整事务final02/types与UI私有build和实际Sol证据见前文，不叠加重复检查。

completion/新增630原始公开对象（623gzip文本、7原JPEG、23837452原字节），包含Git正式红绿、最终后台/Overlay/SDK原回执和精确来源、崩溃红态01–07、publicTask01/02、空header期限与helper首错。before/及manual-after/历史冻结保持；合计归档24原JPEG。所有凭据family扫描0，公开fixture字面值单列，排除auth/models、DB、runtime、二进制、private UI bundle和真实Provider原payload。字节相等只证明保存对象身份，非功能/视觉门槛。

未满足：Task source-only恢复及物理执行owner权威；ASCII310原native cwd267；Task正常业务完成/result checkpoint；Work/Mission独立页面Question、所有生产入口实机、UNC/POSIX。SideChat网络attention残留、空header历史泛化caption作为有证据的下一批候选，尚未修复。旧Git失败epoch/outcome不改写，source-only Task不能以Session过滤遮蔽。下一批405单层两agent调查明确Task原activation/dispatch进程存活与普通Tool/durable A2A接续合同，Root先落新spec再实施。
