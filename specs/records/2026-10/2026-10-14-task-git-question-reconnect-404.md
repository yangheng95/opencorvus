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
