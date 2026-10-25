# Issue 51 — Package Tool RPC physical lifetime

## Recall

- 用户原始要求：“解决issue中提出的问题”；用户明确选定 [issue 51](https://github.com/yangheng95/opencorvus/issues/51)。只修当前分支，保留已有脏文件；不委托、不使用真实 Provider、不发布、不写 issue。
- 验收：真实 Node 包工具、原 Task/ProcessSupervisor；嵌套进程真实字节、完成的文件操作及网络响应体字节刷新闲置时间；真实静默仍超时；取消/超时/worker 与协议故障立即封闭接纳并取消物理子操作，返回前等待全部 Host 效果；提前 terminal 必须返回明确协议错误并结算。串并行、跨 Task/Project 和后续调用独立。
- 硬约束：不加心跳、不加大超时、不绕文件 broker、不改 Task/SessionLoop 调度与持久化；没有 UI 变更及 UI 自动化；聚焦正向合同、实际运行路径与文档 checker；提交仅含本任务，fetch/merge upstream 后审查全部待推送提交并 push。
- 已读：`AGENTS.md`、root/package scripts、`04-extensions.md`、`capability-search-runtime.md`、原 issue 全文；`package-tool-capsule.ts`、`plugin-tool-host.ts`、`plugin-tool-files-host.ts`、`file-broker.ts`、`process-supervisor.ts`、`process-facade.ts`、`execution-files.ts`、`expert-squad-package-host.ts`、TaskArtifact execution track/close；native-runtime/RPC/files capability 测试与 runner/pre-push。
- 全仓搜索：生产 execute 唯一入口在 `prompt-profile-resolver.ts`，其 wrapper 为 `withTaskScopedPluginToolHost`；执行与 Task/validation introspection 共用 `runCapsule`。文件适配器亦供 codebase-tools/executionFiles 使用；broker 唯一调用来自该适配器。进程执行共有 runCommand、broker、ProcessFacade 三条相关适配路径，最终使用同一 ProcessSupervisor。原 task-tool-invocation 只持身份/权限，不承担物理寿命，不能混为另一事实源。
- 权威资料：[Node asynchronous context](https://nodejs.org/api/async_context.html)、[AbortSignal](https://nodejs.org/api/globals.html#class-abortsignal)。用现有 Context primitive 传播调用内物理 scope，保持公开 ToolHost/宿主中立 process 契约。

## 调查与影响面

- 可观察现象为 issue 所述下游集成 20 秒 idle 错误前后仍有文件修改；该日志不是 pristine upstream 复现。本轮先使用真实 native worker 和 barrier 文件效果复现当前源码。
- 直接触发：worker 等待 Host 时 stdout/RPC 静默；Host 内 broker/command 输出或已完成文件操作没有回传 idle。Response encode 的 `arrayBuffer()` 完成前同样全程静默。
- 控制流根因：`void dispatch()` 不拥有其 Promise；result 立即 resolve，abort/finally 只回收 worker。已有 wrapper 仅记录部分操作；commandAbort 到 callback 结束才发出，文件 broker 没有 invocation signal，fetch 只追踪 headers Promise 且 signal 仅是外部 abort。
- 旧路径未根治原因：Task process lease 与 worker physical settlement 只证明各自进程终止，不能代替 invocation 内 Host Promise 与响应体的结算；调高 idle 只掩盖窗口。
- 横向审计：Task/Mission/Session occurrence 最终均从投影 runtime Tool 经 resolver 进入同一 owner；introspection 无 Host authority。终态包括正常 result、failure、JSON/协议错误、worker exit、stdin error、外部 abort、真实 idle；必须同步撤销并 join。重试与重启不引入新持久状态，单次调用 scope 不缓存到 Task/Project；进程强制崩溃后的持久 Task 恢复仍归现有 supervisor/Task owner，不能声称本轮已做整机恢复。串行/并行与多项目测试验证 scope 隔离。
- 公共契约：ToolHost 与包协议版本不变；提前 result 带未完成 Host 调用改为明确错误。保留有限不可中断 native 操作的 join；不把取消信号当作已物理停止。
- 数据/schema/迁移、产品页面、Provider/凭据、发布均不适用。Linux OCI broker 的实机环境可用性尚未知，须保留实际验收边界。

## 实施方案

1. 添加真实 worker/barrier 正向合同，运行原 checker 留下原始失败；使用参数化本地配置测试 idle，不修改生产默认阈值。
2. 单一 invocation physical scope 传播 abort/真实 activity，拥有 admitted Host dispatch 与相关物理进程，原 supervisor 继续唯一负责进程回收。三条进程适配与文件能力、fetch/body 收敛到该 scope。
3. runCapsule 同步 fence terminal/错误，统一取消、join、worker disposal，保留 primary 与 cleanup 错误；严格验证 RPC packet 与提前 terminal。
4. 聚焦真实进程/本地 HTTP/文件合同，原 RPC/native publisher 回归、typecheck、docs checker；更新当前架构。最终记录实际边界、git 提交和自动推送。

## 验证与交付

测试通过 `bun run --cwd packages/opencorvus test <selected files>`；未运行无目标全量测试或 UI 自动化。

- 原源码真实回归（runner `opencorvus-test-run-5nM9Mk`）：两例均失败。取消实际顺序 `entered, abort, terminal, effect`；提前结果实际顺序 `entered, terminal, effect`。相关生产文件与起始 HEAD `393325e36` 一致；这是本地真实 Node 包工具/bundle 的修复前复现，未使用 issue 的下游代码。工作区原有其他改动不归本任务。
- 首轮修复后这两例及原 RPC 二进制/Stats/Response 三例全通过。随后扩展 checker 的两个错误是验收代码误用：cleanup API 实际返回 `{disposed,pids}`，Response 已被 owner decode 后又 decode 一次；均已修正。第二轮新增跨项目测试误把 memory fixture dispose 放在另一项目的 Instance callback 内，触发明确生命周期保护；改为所有项目先在 callback 外持有，全部并发结束后再 dispose，没有修改生产保护或绕行。
- 已验证原 native runtime（含 8 个并发 metadata worker）1 例/11 断言、原 RPC 3 例/5 断言、portable frozen publisher 1 例/2 断言全部通过；package typecheck 与 `docs:check`（350 operations/26 groups）通过。
- 横向检查中发现 `plugin-tool-files-host.ts` 的未导出 `tracked` helper 仅剩定义，生产操作均使用唯一 `operations.map(...track)` 实现；移除该死函数，不影响调用面，不扩大清理。
- Linux 实机资格探测：本机存在 Ubuntu-24.04 WSL 分发，但执行 `wsl -d Ubuntu-24.04 --exec /bin/bash -lc ...` 返回 `Wsl/Service/CreateInstance/HCS_E_CONNECTION_TIMEOUT`。未重启、停止或杀死用户 WSL/虚拟机，未启动 OCI broker。Linux OCI broker 的完整实机运行/系统重启恢复本轮未验收；Windows 原生真实 Task、Node 包工具、进程、文件、HTTP 和共享 owner 可独立验收。保持符号链接安全 worker 源码及 OCI 契约不变。

- 最终新增合同 11 例/35 断言通过（实际 Node worker、Task process、有限原生写入、HTTP 流与静默、跨 Project 并发、多个 admitted call）。错误保留例是在真实子进程完成原 dispose 后故意抛出诊断错误，证明 worker 主错误与该故障共同可见，不把注入诊断描述为操作系统实际清理失败。
- 原 ProcessFacade 实进程 4 例/7 断言、原 settlement barrier 5 例/18 断言通过；barrier 原测试是局部错误合同，不冒充本轮真实物理证明。最终 package typecheck exit 0；architecture-index 20 documents 和 docs:check 350 ops/26 groups 均通过。

- 最终一次完整相关检查：`bun run --cwd packages/opencorvus test test/package-tool-rpc-lifetime.test.ts test/expert-squad/package-tool-native-runtime.test.ts test/package-tool-capsule-rpc.test.ts test/portable-publisher-runtime.test.ts test/plugin-process-facade.test.ts test/process-facade-settlement-barrier.test.ts` exit 0，六文件共 25 例、78 断言全通过；运行实际 supervisor 的 runner 正常完成并结算。
- `git diff --check` 通过；首次 fetch 后本地与 origin/main 均为 `393325e36`，无分歧。提交只包含六份生产源码、一个聚焦测试、当前架构、本记录及两个索引中本任务的新增条目；已有依赖、UI、测试删除与其他记录改动保持独立。

提交与推送执行结果见最终交付；不创建 tag、Release、PR 或远端 issue 评论。
