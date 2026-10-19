# 全局配置保存耗时调查与改进

## Recall

本文 UI 指 User Interface（用户界面），QA 指 Quality Assurance（质量验收），API 指 Application Programming Interface（应用程序接口），HTTP 指 Hypertext Transfer Protocol（超文本传输协议）；tsc 为 TypeScript Compiler（TypeScript 编译器），DEBUG 为调试日志级别。

持续单 agent 自主体验与修复，直到用户停止；后续单 agent 指令覆盖持久 goal 中旧的 Astra 委托文字。上一轮为 progress：35b993936 已通过正常 hooks 推送，HEAD 与 origin/main 一致，真实页面验证了权限未知态、重读和 Goal 路径。本轮调查原生独立 QA 中 global/config 写入 44–76 秒、恢复 17 秒造成读取超时的问题。保留 .bun/、packages/opencorvus/bun/，不操作用户 18571、不清库或改 schema、不新增 branch/worktree、不发布。使用 benchmark-debug-template skill，用户明确约束优先于 skill 中的 UI 自动化示例及总时长建议：只用真实页面人工截图；自有 native 运行器保留物理安全期限，操作超时按真实活动更新。

## 修改前分析与已读资料

已读 434/435 Recall、05-config 的 generation/层级/runtime settlement 全合同、config writer 与 candidate/model validation、snapshotForProject、Project.registeredDirectories、Instance.provideProjectIdentity、SkillReadDiagnostics、现有 native 413 harness 和日志 primitive。全仓搜索全局及项目 writer、mutation owners、候选校验、Skill phases、相关测试与历史决策。Model/API/数据库协议不需要变更；若后续发现影响会先补分析和方案。

已观察事实是 435 最终实际 PATCH username 50,155ms，恢复 17,367ms，服务 200 且完整 canonical source 恢复；并发 UI config read 实际超过既有 20 秒 deadline。生成 fence、有限操作完成和读写归属已修，不能把耗时继续解释为前端丢失回执。直接路径为 global writer 的全部 registered+active Projects：Skill removal检查、两次只读快照、候选模型/Profile/能力验证、persist、cache reset、全部 runtime projection/事件结算。旧实现保证一致性，但尚未有阶段耗时证据识别重复成本。根因目前未知；不得靠删注册项目、跳校验、shadow cache 或提前返回掩盖它。

共享机制影响面包含 global/project writer、peer convergence、活跃/非活跃 Project、A/B 多项目隔离、正常与协调失败、重试和重启恢复，以及沿 Config 读取的 Task/Mission/Session。是否属于锁等待/队列异常需测量，不从最后一个 timeout 作结论。如证实共享调度异常，按 AGENTS 横向审计所有生产入口与 occurrence，而不是只修 username 用例。

## 实施前方案与 benchmark 合同

1. 首先只读保留上轮尚在磁盘的原 dev.log（435 verified 的真实 occurrence）。按原始 requestID 汇总已有 SkillReadDiagnostics spans 和 server request 生命周期；只保留明确字段，不写完整 config、模型响应或凭据。已有 harness 实际启用 DEBUG，无需先添加一套平行 tracer。若证据缺关键阶段，再根据已读调用链补最小生产诊断及聚焦正向测试。
2. benchmark 输入是同一自有 QA 数据库内全部已注册项目和当前 global source，使用生产 config service/HostTransport 对 username 写入唯一 QA 值并完整恢复。输出是两个实际接受响应、相同解析 canonical source、Ask 保持、当前有效配置读取成功和阶段耗时。原样本已在 435 checker 通过保存/恢复功能合同，不能仅凭 mock/静态字符串代替。
3. 测量记录 cold 与 warm 分开、当前 Project 数、active 数、每阶段 wall time 和次数。性能目标是在同样全部 Projects 和完整校验/协调合同下，cold 写 <=10s、warm 写/恢复各 <=5s，并发现有 config read 在其 20s deadline 内完成。这是本批明确的改进目标，未达到就不宣称性能完成；不得重算期望值或删除样本使其过线。
4. 根因证实后才修改实际实现，先补充定义/全部调用点与风险分析。非 UI 修复提供正向功能合同，聚焦运行真实 checker/相关 generation 与 peer 测试，禁止全量 bun test、UI 自动化或 hash 门槛。实际页面验证保存及读取，截图人工复核。
5. 新独立 runtime publication/端口和 native occurrence；如需 Provider，授权 auth 与完整 models 成对复制，分别确认可用/目标投影/实际 gpt-6.1-sol 流请求，最终公开 shutdown/join/physical/output/request 结算并退休副本。新 batch 的数据仍只在现有自有 QA，源凭据只读。证据、三索引和架构同步；任何本批修改最终范围提交、fresh fetch/merge、pending 全集审查和正常 push，goal 保持 active。

## 只读基线与后续结果

原 dev.log 3.79MB 保留 DEBUG、6514 条现有 Skill 诊断，但精确 PATCH requestID 关联结果为零。进一步读取 server middleware 证实只有 GET /skill/mounts 才进入同一诊断 request context，不能把零关联误判为零成本。时间窗观察（不冒充 request 归属）显示 49 次 inventory、252 次 config.load 累计 11.1s，catalog held 50.142s、admission 2ms；至少本次慢保存发生在 owner 已取得后的工作，尚未定位其余约 39 秒。

实施测量决定：扩展现有 SkillReadDiagnostics 的 closed phase 集合，对 global writer 的项目枚举、removed Skills、before/after snapshot、快照 Git worktree 边界、candidate model/profile/capability 校验、persist/reset/reconcile 分段。HTTP 仍用同一个 request context，把 PATCH /config 和 PATCH /global/config 纳入观察；不新增平行 tracer、状态或配置，不改变任何准入/写入/校验/错误或 owner 顺序。现有 diagnostics 正向测试验证原 Promise/错误身份及实际日志归属，新 phase 增加对应正向合同。完整代码来源和调用点已经搜索，追加 phase 不破坏既有 closed union 调用；日志只带名称、计数与时长，不带配置字段值。先跑 instrumented before 再决定性能实现。

## 根因证据与修复前决定

436-before 的原生服务 18639 对 52 个注册/active Projects 完成两次真实写入，原请求 200；checker 接受与完整恢复均通过。新诊断精确关联 requestID：首次 78,655ms，其中 removed-skills 52 次共 34,401ms、snapshot Git 104 次共 17,094ms、模型 53 次共 2,139ms、runtime reconcile 309ms、persist 4ms；恢复 49,486ms，其中 removed-skills 31,849ms、Git 15,130ms、模型 1,551ms、reconcile 257ms。首写并发执行了一次 backend tsc，会影响绝对性能，不能把两轮差异全归因到产品；恢复时它已结算。实际页面 01 再次确认 config 读超时。native 55595 已公开 shutdown 200/join0/物理结算，原 auth/models 副本已成对退休，私有 authority 暂留供后续独立 scope（最终必须退休）。原 dev.log 的精确 spans 已保存在 before-cost.json。

代码进一步证实全局 writer 先串行进入全部 Project 做 installed Skill 读取，再串行回到每个 Project 做两个物理快照和完整校验。每个独立 Project 都在同一 global write generation 内，彼此不修改配置；当前 server 每次 Project 请求结束调度 cache convergence，默认只保留 4 个空闲实例，所以另一个读请求可正常退休第一轮已关闭的 identity lease，第二轮重新发现同一 Project。现有 project.open.stage 明确记录冷 Project.fromDirectory 每个约 0.7–1.0s；不是以最后的 UI timeout 推定锁死。不能提高 cache limit 或关闭收敛来掩盖它。

决定把同一 Project 的 inventory、两份 snapshot 和完整候选验证收敛到一个现有 Instance.provideProjectIdentity lease 内，并用已有 util/queue.settledWork 处理独立 Project。并发度由已有 os 模块的 availableParallelism() 决定（本机实际 12），不新增配置面或常数策略；该 API 的官方含义是建议的可用并发量，[Node OS 文档](https://nodejs.org/api/os.html#osavailableparallelism)。每个异步 Project 仍沿既有 AsyncLocalStorage 归属，[官方异步上下文合同](https://nodejs.org/api/async_context.html#class-asynclocalstorage)。共享 Skill/Conversation/Config/canonical-file owner 顺序保持。settledWork 等所有已接收工作成功或失败结算后才返回，按原目录顺序选取原错误；不得使用早退 Promise.all 放出仍在运行的子操作。loadedDirectories 必须在这批调查读取开始前捕获，只 rewarm 原来已加载的状态。

此修复保留全部 Projects、Skill removal、两份原快照及 Git 物理 worktree 判定、模型/Profile/能力校验、persist 后的全部 projection 和事件，不增加 source cache。先测这项实际控制流改进；若仍未达 cold10s/warm5s，继续根据数据处理重复快照成本，不能改目标放宽通过。可能的外部/本地 Skill 来源移除语义尚无失败证据，本批不基于猜测改写它。Task/Mission/Session 执行 occurrence/队列不变；同一 generation 的项目隔离、验证失败排空、peer 恢复及 runtime 终态需聚焦测试。新增 native preflight 每 scope 建立自己的 QA 项目，后续注册集合会增加，原有项目完整保留，计数必须逐轮报告，不能裁样本匹配数字。

## 第一版实际复测与继续修复决定

首轮聚焦测试新增两 Project 正确投影通过；无效 Profile 用例最初误用字符串旧形状，实际当前合同为 prompt_profile.active 对象，已修夹具并原命令重跑，两项/19 expect 通过。共享 catalog/reference read→write 正向 4 项/8 expect 与 diagnostics 5 项/35 expect 通过。tsc 指出 Instance.provideProjectIdentity<R> 的既有嵌套 Promise 类型，worker 改为显式 async/await 正规展开，重跑通过；不扩大修改全局公共接口。

新 after 18641 原生服务的 53 个 Projects（原样本全保留并增加 preflight 项目）实际保存 22,673ms、恢复 6,095ms，原服务 200、checker 完整恢复 Ask 与 canonical source。02 是写入期间当前配置尚未到达；03 实际读取已成功并显示 Ask。虽明显改善，cold10s/warm5s 未通过，不能交付为性能完成。after 页已关闭，82047 公开 shutdown200/join0/物理结算和运行凭据对退休。当前 before/after 精确 spans 均已保存，private authority 仍待最终退休。

进一步已读 Project identity/physical ownership 当前合同（02-data 与 task-runtime-directory）、全部 findExactWorktreeRow 调用、fromDirectory 完整 durable admission、sameFilesystemLocation 与相应 physical identity/convergence 测试。冷路径仍在 Project discovery 中串行逐 registry row 做相同物理身份谓词；findExactWorktreeRow 被初次 discovery 和获得目录 generation 后的 revalidation 各调用，每个 Project 随注册量线性增长，组合到全量检查是平方数量。谓词、durable admission 与重验证不能删除，改为已有 settledWork、可用并发量，并按原 row 顺序处理真实结果和原错误，所有比较完整结算后返回。这是全部 Project 入口共享的只读物理比较改进，注册/删除、目录 occurrence、旧数据、Task/Session/附件/权限记录的身份合同全部保持，需运行真实 hard-link/独立 wide-inode 和 duplicate worktree/registered sandbox 正向契约。

warm 剩余重复成本有原 spans 证据：106 次 Git worktree 查询，累计重叠 43,250ms（并行合计不能当 wall time）。决定同一 Project 的 before/after 使用一次实际物理 Git boundary 捕获，两份配置仍各自读取和验证源 revisions；抽出唯一私有 snapshot reader，公开 snapshotForProject 仍独立捕获边界并走同一 reader，不改其只读和项目注册语义。只有 global transaction 的配对快照复用该次实际边界，不新增长寿 cache、不改用另一个身份来源、不删除 Git 判断。下一轮 verified 新 scope 再按原目标验收。

## 第二轮结果与范围收敛

verified 18643 的 54 个 Projects 真实保存 21,935ms、恢复 4,089ms，原服务 200/21,881ms 和 200/4,089ms；完整解析 canonical source 与 Ask 保持。Git 查询已为每次 54 次，before/after 各 54 次、模型 55 次、capability 54 次，完整项目集和验证仍可核对。warm 目标通过，cold10s 仍失败。04 是手动 New Chat 后仍在读取的 General，05 已实际恢复 Ask；只有原 HTTP 请求和页面截图能支持这些状态，不用空 console 冒充全链成功。

全量聚焦正向合同已跑到真实 runner：global-project-validation 2、layer-inheritance 23、filesystem-identity 2、peer-convergence 7 全通过，另选 duplicate/alias/sandbox 三项通过，catalog lock-order 4、diagnostics 5 通过；backend tsc 通过。物理比较并行实验在整体冷写上没有足够收益证据，不能把 22s→21s 当作它的根因证明，故精确撤回新增的 Project.findExactWorktreeRow 改动，只保留有真实收益的 global pipeline 和成对快照。恢复既有物理身份实现，避免把未证实的 Project 子系统优化混入交付；既有成功测试记录保留。新的 final scope 必须验证最终源码。

继续读取源码发现 ProjectDirectoryAdmission.run 使用共享目录队列，fromDirectory 在其中重新验证完整物理注册集合并结算 durable directory generation；冷身份发现的具体 wall time 仍需按该 owner 的 admission/held 再分段，不能将所有耗时都归因到 findExactWorktreeRow，也不能绕过或放松目录 occurrence/删除隔离。完整冷写目标明确未完成，持续 goal 保持 active，后续对这个共享机制横向调查。当前批次收敛暖写改进与真实诊断证据，不宣称整个性能问题完成。

## 最终源码验收及未满足项

final 18645 确认撤回物理比较实验后的源码：55 个当前 Projects，username 真实保存 21,864ms、恢复 4,226ms，原请求均 200、完整解析 canonical source 恢复、Ask 保持。快照 Git 边界 55 次，before/after/capabilities 各 55 次、models/profile 各 56 次（含 global），未裁掉当前注册枚举。原 HTTP 事实确认手动 New Chat 后 GET /global/config 从 16:31:13.306Z 到 16:31:15.775Z，2,469ms/200，发生在真实 restore PATCH 内；06 实际 General 显示 Ask。这个实际读样本通过 20s 目标，不代表从冷写起点发起的所有读取均能通过。

执行 evaluate.mjs 的原结果 exit1/status=failed：cold<=10s 未满足，warm<=5s、已观察读取<=20s、canonical 接受与恢复通过。不能以部分通过重定义本批完整性能目标；首次保存仍可能影响 20s 读取 deadline。下一步保留原目标，对共享 ProjectDirectoryAdmission.run 的 admission/held、物理 registry revalidation 和 durable transaction 做完整归因，覆盖全部生产 Project/Task/Mission/Session 入口及重试/恢复，不先放宽锁或身份校验。

最终新增 global-project-validation 两项已再次跑过；另补 published Skill recovery 与并发 writer 的真实子进程契约一项、Config 插件加载加入在途 generation 与跨进程目录 owner 两项。去重后的相关正向用例共 49 项/153 expect，通过；其中依赖安装替身只证明局部 readiness 合同，不能冒充网络安装端到端。实际产品链验收仍是四个独立 native scope 的生产 service/transport/HTTP/canonical 文件及人工页面截图。无新增或执行 UI 自动化测试，UI 包复用 435 的正式构建，本批没有改动前端源码。没有发现需要另行删除的既有死代码；只撤回本轮未提交实验和无关格式变化。

四页均关闭，四个自有服务分别由公开 shutdown200、原 exec 55595/82047/34219/38257 join0 和 native physical/output/request 完整回执结算，运行 auth/models 均已成对退休。额外私有 authority 也精确退休，源 Codex auth 尺寸/mtime 与准备时相同。每 scope 两次实际 gpt-6.1-sol 流预检均 200/reader EOF，合计八次；完整 models 目录与 auth 绑定并确认实际模型。未保存凭据、数据库或完整 Provider 响应；选定 artifact（含 gzip 解压内容）已用内存中实际凭据值检查通过。运行器错误文案里的历史 v1 只检查自有历史 DB 文件存在，不是 schema 版本证据；本批不改 schema 或迁移。

方案、三索引与当前 05-config 合同已同步。范围提交及正常 hooks 推送完成后进入下一轮；持续 goal 不完成、不暂停。
