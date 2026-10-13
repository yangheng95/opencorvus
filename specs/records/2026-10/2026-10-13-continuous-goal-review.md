# 持续目标独立测试与修复

## Recall

- 用户追加要求：“独立agent测试并修复可能的问题”。原目标是为 Chat、Task、Mission 增加持续目标；已授权新 worktree 和使用现有 Provider/模型目录进行隔离验收。
- 复用已附着 worktree continuous-goal-mode，起点 f507df21d；原 main 工作区有其他任务未提交修改，必须保留。仅一层委托。
- 独立 agent 负责 store/schema/tool/routes 的定义、授权、用量、revision、取消/归档合同和单独正向测试文件；主 agent 负责 controller、原唤醒/恢复路径与最终核验证据、集成、提交和正常推送。
- 不把前一轮的28项测试、真实三模式成功场景或模型完成自述视为全面正确性证明。新增测试必须验证明确状态、事件、输出或错误合同；禁止 UI 自动化。
- 已读原方案 Recall、continuous-goal 当前架构、AGENTS、Scheduler、SessionWake、completed-reply、Task continuation adapter、原多进程测试；独立 agent 另行记录其搜索和发现。
- 使用隔离 Bun1.4.0；不修改用户全局工具、生产配置或已在用进程。真正 Provider 请求保持流式，凭据与 models.json 成对复制并清理。

## 调查与影响面

当前 controller 使用现有 Scheduler、SessionPromptOwner、SessionWake 和 Task ingress。既有多进程测试仅证明预占身份与暂停 revision 的持久化；没有执行重启后的真实 Prompt 激活，也未证明原 Message 与 continuation receipt 在所有入口都只结算一次。所有 owner 共用 store/reconciler，因此任何异常都必须横向覆盖三种入口、正常/终态、重试/重启、串并行和项目隔离，不能判为单一场景问题。

本轮先独立复现再修改。重点检查：目标 scope 是否受真实父子关系约束，停止边界能否因无关更新被清除，预算与请求身份是否可错归，以及多进程重放是否保留同一真实输入。若改动公共合同，先搜索所有定义和调用并同步当前架构。暂不假设现有实现有特定根因。

## 验收与交付

1. 独立审计提交可重复的代码/数据证据，覆盖明确的输入、结果及失败前态。
2. 修复实际根因，增加正向合同并用真实生产入口验证；受控 Provider 协议测试与真实 Provider 验收分别标注，不冒充。
3. 覆盖已有13项核心、独立新增合同和必要的多进程/恢复路径；执行类型、文档、拓扑及原 pre-push 检查。
4. 更新[独立审计记录](2026-10-13-continuous-goal-independent-audit.md)，记录反馈、修复和剩余范围；提交只包含当前任务文件，合并 upstream，复核完整待推送集合并正常推送，收敛 main。

## 当前结果

独立 agent 已完成审计，主 agent 已复核差异并独立复跑。确认并修复两个共享 store 缺陷：

1. 归档 owner 被当作身份失效而跳过重叠检查。Mission 归档后可以给其子 Task 创建目标，反向同样成立；实际 HTTP 返回 200 而不是明确的 409/overlapping_owner。现在归档只影响可执行性，未完成目标仍保留范围；创建与 active 更新同事务重检；子任务在归档期间的计量仍归原目标。
2. Chat/Mission 的保留历史删除仍保留 Session 行，旧目标读取只检查行存在/归档，导致删除后仍投影 active。现在身份解析、工具准入和边界投影读取原有 session.deleted 事实，返回 owner_unavailable；在途已捕获的 usage 仍精确结算至旧目标。

公开 schema、工具授权、模型交互和 UI 无需更改。架构事实来源已同步，测试只验证明确状态、数据及错误合同。独立 agent 先得到 12 项中 2 失败，扩展删除后 15 项中 4 失败，修后 15 pass/119 assertions。详细证据在[独立审计](2026-10-13-continuous-goal-independent-audit.md)及[日志索引](../../artifacts/2026-10-13-continuous-goal-review/README.md)。

## 主 agent 运行复核与横向审计

- 全仓调用检查确认三种 owner 的 API、原生/投影工具和 controller 共用同一 store；没有修改另一套状态源。三 owner 的删除/归档/恢复、正常完成后新身份、迟到计量、子树及跨项目正向合同均复跑。Mission/Task 两个跨树方向分别覆盖；Chat 只有 standalone primary 子树，子 Worker 创建收到明确 owner_forbidden。
- 新增真实两进程测试：在第一进程已提交 controller Message 并发出实际流式 HTTP 请求后，终止该测试私有进程；第二进程通过 reconcileContinuousGoal → SessionWake → SessionPromptOwner/Prompt 恢复同一输入。最终保留同一 continuation ID、同一 controller Message、turnsAccepted=1、budget_limited/turn_budget，并得到 provider reply 2；两次物理请求 stream=true。原并发双进程 reservation 测试同时通过。
- 新测试前三次超时，不作为产品失败直接下结论。实际恢复已经得到回复，测试未释放待机 Prompt owner，等待进程退出挂住；对照仓库 Mission recovery driver 使用 SessionPromptState.release 清理私有 owner 后原验收通过（37.59 秒）。添加 result/error 屏障明确区分结果产生与进程清理。Provider fixture 用专用 small_model 身份识别 Memory Organizer（记忆整理器）的请求，避免动态目标上下文使系统提示全文识别不适用。
- 另检查 process.shutdown 被当作用户取消的候选：SessionWake 使用 typed cancellation（带类型取消原因）直接 cancelOwned；Session loop 的 publishTerminal 对该类型提前返回，没有走通用 aborted 发布分支。未在无真实证据下修改公共状态合同；优雅关闭全部矩阵仍未执行。
- 横向覆盖包括：三 owner 的正常/终态与归档/删除；并发两进程预占；Chat 真实 Prompt 退出/重启；跨项目隔离。Task/Mission 的物理崩溃和多项目并行真实模型执行没有在本轮扩展。
- 独立 agent 对新恢复测试及 fixture 进行了第二次只读复核，未发现确定问题，核对了真实调用链、结果断言及仅终止私有进程的清理范围。该用例中断点是请求已发出但尚未返回响应；不覆盖部分输出中断。第二进程直接调用 reconciler，不覆盖全局 Scheduler 启动发现链。Provider 未给 usage，因此不声称恢复后的模型计量已由该运行用例证明。

## 验证与交付状态

- 主 agent 命令：`bun run --cwd packages/opencorvus test -- test/continuous-goal.test.ts test/continuous-goal-independent.test.ts test/continuous-goal-process.test.ts`，29 pass；另 `test/continuous-goal-runtime.test.ts`，1 pass。总计 **30 pass**，使用隔离 Bun 1.4.0 与真实数据库/生产调用链。
- 新增运行用例的模型端为本机受控流式 Provider，仅证明传输/调度/持久化/恢复合同，不是本轮真实模型端到端验收。没有使用真实凭据、额外模型额度，也未运行 UI 自动化。本轮未修改 UI，不重复前一轮视觉验收。
- 根 typecheck 通过（8/8）；docs:check 通过（348 ops/26 groups）；architecture-index 通过（19 current documents）。正常 pre-push 的 routes、control lease owners、package topology、committed-tree release mutation/module topology 和 secret scan 均通过，未绕过 hook。
- 修复提交 `a347f98c3`；拉取并合并远端 `3d4adff49`，合并提交 `4535ddf67` 仅三个文档索引冲突，保留双方条目。合并后重复实际进程恢复测试通过（19.12 秒）。完整待推送集合为该修复与合并提交，已正常推送至 origin/main。
- main 从 `3d4adff49` 快进至 `4535ddf67`。预先审查并备份三个有并行修改的索引，只插入本任务新条目；去除插入内容后原用户文件逐字相同，其他脏文件保持原样。本任务源码与测试已收敛主交付来源；本次收尾文档随后单独提交并正常推送。
