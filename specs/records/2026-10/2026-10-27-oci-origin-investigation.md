# OCI 执行后端引入来源调查

## Recall

- 用户原始问题：“内置的oci运行环境是做什么用的？跟native的区别是什么”“oci为什么会被引入？”，随后要求“追查”。本轮目标是追溯实际引入经过和需求来源，不把当前实现的用途推断冒充原始决策。
- 验收指标：核对 Git（版本控制系统）历史边界、可用旧记录、基准测试与部署入口；给出可核对的时间线、代码和记录来源；区分已证明、推断和未知。
- 硬约束：单 agent 调查，不委托；保留全部既有工作区与暂存区改动；不启动或改变用户进程，不使用 Provider（模型服务）凭据，不运行用户界面自动化，不删除或修改执行后端。本轮仅增加调查记录与两个索引条目，完成文档检查、精确提交与当前分支正常推送。
- 已读资料：仓库 `AGENTS.md`、当前 `package.json`、两个记录索引、`execution-capsule/runtime.ts`、`oci-task-container.ts`、Task（任务）进程绑定和共享进程监督器、包工具执行器；2026-08-12 随机专家团演化记录、2026-08-18 演化范围分层、2026-10-14 Capsule 准备权属调查。
- 已有搜索：当前生产代码和记录中 Open Container Initiative（OCI，开放容器倡议）、Execution Capsule（隔离执行单元）、runc、Prism、任务模式环境变量；文件历史最早可达提交为 `65d0bfc98`，该提交无父提交；普通启动默认 native（宿主原生执行），Capsule 为显式部署输入。当前记录提到旧 Prism/OCI 矩阵，但不能单独证明最初需求。
- 初始工作区：`main`，`HEAD=e3e3f6041`，当时比 `origin/main` 超前一个已存在提交；发布与清理任务存在大量未提交及已暂存改动，两个索引均为混合状态。它们均不属于本轮交付。
- 无委托。

## 问题深度与范围

可观察问题是引入动机尚无原始决策证据，直接触发是用户要求继续追查。当前代码能够证明隔离能力，不能证明提出人、原始用户要求、引入时间或必要性。上一轮停在根提交和一条后来的历史说明，没有检查旧分支、reflog（引用变更日志）、不可达历史对象、旧部署与测试实际输入，因此结论边界仍不足。

调查将沿“历史记录或请求 → 执行环境准备 → 固定配置 → Task 绑定 → 命令和包工具执行”核对。接口、路由、配置、数据库和持久数据均不改动；功能修复、恢复缺口修复和产品视觉验收不在本轮授权范围。已有恢复缺口仅核对原报告的证据边界，不能称本轮已复现或修复。测试只读研究其输入和调用路径，不把模拟或静态检查当真实运行验收。若遇到无法取得的历史对象或原始记录，明确记录缺失来源和影响。

## 实施方案

1. 检查完整/浅历史、根提交、所有本地引用、reflog、远端引用及可用历史对象，确定最早证据边界。
2. 搜索旧树中执行后端、部署、Prism/演化 benchmark（基准测试）入口，核对调用而非只看命名；追踪删除和后续模式决策。
3. 检查仓内与相关本地历史来源，提取与本仓库相关的明确需求和工具证据；不读取凭据或无关私有数据，不重建 2026-06-01 以前的 dated spec（带日期规格记录）。
4. 将证据、时间线、推断和未知更新到本记录；同步根与月份索引；运行当前文档检查及提交/推送必要检查。
5. 仅提交本轮三个文档的精确差异。每次推送前获取并合并最新上游，核对完整待推送提交集合及验证依据；如存在无法安全归属的其他提交，报告精确阻塞，不夹带推送。

## 调查结果

### 已证结论

最早能从可读源码证明的具体接入场景，是专家团自演化的固定开发集对照实验。早期启动器为 baseline/candidate（基线/候选）两组准备同一套运行时、工具链、权限和评分资源，隔离候选可读开发集，并显式让真实 Task 使用 OCI 后端。这比“为了安全执行任意代码”这一泛化说明更贴近现有来源证据，但仍不能把它写成已找回原始引入请求。

2026-08-09 退役旧 benchmark 时，启动器、完整运行描述生成函数、工具链准备脚本及其专用测试一同删除；生产 Task 的 OCI adapter（平台适配器）保留。当前“有合法外部配置入口、没有已定位的仓内完整部署生成器”的状态，可以沿这次删除直接解释。没有证据证明保留是明确的长期产品决定，也没有证据证明它是误删遗漏，不能替维护者补写动机。

### 时间线与原件

| 时间（Asia/Shanghai） | 可核对事实 | 证据 |
| --- | --- | --- |
| 2026-08-07 23:04:36 | 无父提交的代码根提交已同时包含 OCI 后端、native 模式和固定演化实验启动器。native 默认函数当时已存在，OCI 不是在现有后续历史中逐步新增的必选模式。 | `65d0bfc983ca7ed301a83354f27e5cf5f1b19a19` 的 Task 绑定源码、OCI 源码和 `script/benchmark/expert-squad-evolution.ts`。 |
| 同一代码根提交 | 启动 schema（结构约束）固定 Cases 3/4/10 × baseline/candidate × 3 repetitions（重复）共 18 个 slot（试验槽位），并要求 `wsl2-rootless-oci-v1`。 | [旧启动器 30–110 行](https://github.com/yangheng95/opencorvus/blob/65d0bfc983ca7ed301a83354f27e5cf5f1b19a19/packages/opencorvus/script/benchmark/expert-squad-evolution.ts#L30-L110)。 |
| 同一代码根提交 | 真实生成完整描述、复制运行时/目标包/工具链，再向后端传入描述路径及 `OPENCORVUS_TASK_PROCESS_MODE=capsule`。这不是仅供测试的对象拼装。 | [旧启动器 348–399 行](https://github.com/yangheng95/opencorvus/blob/65d0bfc983ca7ed301a83354f27e5cf5f1b19a19/packages/opencorvus/script/benchmark/expert-squad-evolution.ts#L348-L399)、[574–588 行](https://github.com/yangheng95/opencorvus/blob/65d0bfc983ca7ed301a83354f27e5cf5f1b19a19/packages/opencorvus/script/benchmark/expert-squad-evolution.ts#L574-L588)。 |
| 同一代码根提交 | 目标包在 launcher 正向样例中明确是 `mirror/prism`；实际 Mission 输入要求两组相同模型、权限、配置、预算、评分器和数据集，只允许文本策略变化。 | [旧 launcher 测试样例](https://github.com/yangheng95/opencorvus/blob/65d0bfc983ca7ed301a83354f27e5cf5f1b19a19/packages/opencorvus/test/expert-squad-evolution-launcher.test.ts#L140-L220)、[旧 Mission 输入](https://github.com/yangheng95/opencorvus/blob/65d0bfc983ca7ed301a83354f27e5cf5f1b19a19/packages/opencorvus/test/fixtures/expert-squad-evolution-benchmark/mission-request.md)。测试样例只证明预期配置，不能证明某次实验已真实跑完。 |
| 2026-08-08 01:23:44 | `caa26d810` 将 `/specs/` 加入忽略，删除当时已跟踪的五份索引/就绪文档。它未删除 OCI 原始设计，因为该设计不在这次差异内；不能用“spec 被清理”替代原件证据。 | `git show --stat caa26d810` 与 `.gitignore` 差异。 |
| 2026-08-08 22:44:04 | `9a482447a` 将已有 native 默认声明移入共享 bootstrap（启动流程），保留外部/构建嵌入环境选择 Capsule 的机会；这是修复入口一致性，不是引入 OCI。 | [提交差异](https://github.com/yangheng95/opencorvus/commit/9a482447a43c730740900c09f3dde388d6329fbb)、当前 `runtime/shims.ts` 与 `task-process-deployment.ts`。 |
| 2026-08-09 22:33:22 | `3026d8551` 删除整个旧 benchmark 树中的演化启动器和 `build-execution-capsule-toolchain.sh`，连同专用 launcher/inactivity 测试及案例资源；没有删除生产 OCI 后端。 | [提交差异](https://github.com/yangheng95/opencorvus/commit/3026d8551d0e79e04363c2d481abf0cf33ba5a8d)、[当时更新日志](https://github.com/yangheng95/opencorvus/blob/3026d8551d0e79e04363c2d481abf0cf33ba5a8d/CHANGELOG.md)、[发布收敛记录](../2026-08/2026-08-09-v0.0.38-beta-release.md)。 |
| 2026-08-12 记录 | 后来的随机演化验收计划明确说明，旧 launcher 与固定 Prism/OCI 矩阵绑定，当前已转向 Mission（任务群）负责的生产接口，需要新的目标无关测试控制器。 | [随机专家团演化记录](../2026-08/2026-08-12-random-expert-squad-self-evolution-e2e.md)，Root cause 段。 |
| 2026-08-27 00:58:27 | `354a7305f` 对 runtime 描述只删除空 Language Server Protocol（LSP，语言服务器协议）字段，没有新增部署生成器。 | `git show 354a7305f -- packages/opencorvus/src/execution-capsule/runtime.ts`。 |
| 当前 | 普通启动仍默认 native；Capsule 由外部模式和描述路径同时声明，读取运行时身份并写入每个 Task 的不可变绑定。OCI 容器文件自身从代码根提交至当前 `HEAD` 没有历史改动。 | `runtime/task-process-deployment.ts`、`engine/task-execution-capsule-binding.ts`、`git log --all -- src/execution-capsule/oci-task-container.ts`。 |

### 原实验为什么使用隔离：合同与实现分开看

1. **对照条件一致。** Mission 输入明确固定两组模型、权限、配置、预算、评分器和数据集；launcher 从同一 project seed（项目初始材料）复制 18 个工作目录，并固定运行时和工具链来源。可以证明它在服务可比实验，不能据此宣称结果可完全复现。
2. **候选可读材料有边界。** 原资源 README 要求候选只能接触 Cases 3/4/10 的开发索引与案例，保留集和认证集留在父启动器侧。launcher 只向项目物化开发资源。容器仅挂载 Task 工作区与固定工具链，是支持该边界的实现之一；本轮未重新运行攻击或泄漏验收，不能宣称已证明不可突破。
3. **执行代码与凭据分离。** launcher 把声明的 Provider 环境交给后端 controller（控制进程），同时把这些变量名列入子进程排除集合；当前 runtime 仍要求子环境名列表为空，任务网络为 `none`，配置资源上限。它限制任务命令的宿主暴露面，不代表整个应用、插件、Provider 或所有 Host（宿主）能力都被容器覆盖。
4. **候选修改范围的反证边界。** 原 Mission 明确禁止候选修改工具源码、库、权限和评分器，只允许文本策略变化。因此“当时就是为了允许候选生成任意工具代码”没有来源支持；任务本身执行项目代码，与候选允许修改什么，是两个不同事实。

旧的 `build-execution-capsule-toolchain.sh` 会复制指定命令及共享库，并打包浏览器运行时；它确实准备工具链，但不是完整描述的唯一生成器。完整 `capsule-runtime.json` 由同一个旧 launcher 的 `executionCapsuleRuntimeDescriptor` + `copyExecutionCapsuleRuntime` 写入。

### 历史边界和仍然未知的内容

- 仓库不是 shallow clone（浅克隆），但使用 `blob:none` partial clone（按需取文件内容的部分克隆）。全部本地 commit object（提交对象）元数据共 2647 个已检查，包含 reflog 与不可达提交；最早作者时间仍为代码根提交的 2026-08-07。另一个可达根 `a4f9826d` 仅含 LICENSE，2026-08-08 合并，不能提供更早代码来源。
- `git fsck --unreachable --no-reflogs --no-progress` 找到 1895 个不可达提交；检查全部本地提交对象后未找到更早 OCI 引入提交。计数是本轮观察时刻的对象库存，不是验收阈值；并行提交或 Git 自维护后可能改变。
- reflog 最早保留 2026-08-09 clone（克隆）事件，不能填补 2026-08-07 前的请求。`git ls-remote --heads origin` 所列远端分支及本地所有引用没有提供更早代码根。
- 同级 OpenCorvus 2026-09-21 归档、增量 history bundle（历史包）清单及其中同主题记录已查；归档 README 说明其分支历史已收敛入当前主仓库。没有找到被引用的 2026-08-06 自演化架构原件。相邻旧 Argus/OpenCode 仓库停在 2026-05/02 且没有对应 OCI 文件历史，不作为本次引入证据，不复制旧 dated 记录。
- [2026-08 索引](../2026-08/README.md) 已将 `2026-08-06-expert-squad-self-evolution-architecture.md` 标成文件缺失。旧资源 README 引用的 `specs/artifacts/五客户端长链路业务与开发需求.md` 和生成器也不在代码根提交中；不能把生成后的案例或 Mission 输入冒充人类原始请求。
- 一次宽范围内容历史检索因 promisor remote（按需对象远端）下载失败退出，缺失对象为 `3eaf6d4bb28ff476dfd6962cd36efd4136da533b`，错误为 GitHub HTTPS 连接的 `SSL_ERROR_SYSCALL`。后续使用 `GIT_NO_LAZY_FETCH=1` 精确检查已可读原件；上述 launcher、工具链脚本、Mission、资源 README 和删除差异均已实际读到。不声称穷尽远端未下载 blob（文件对象）或私有原始对话。
- **仍未知：** 首次实际引入日期、提出人、原始请求原文、是否明确要求采用 OCI、最初与其他隔离方案比较的理由、18 次真实实验是否完成，以及今天是否仍有外部维护的 Capsule 部署。Git author（提交作者）不能证明需求提出者或代码是人工还是 agent 编写。

### 当前影响与处置边界

可以确认的是“早期固定演化实验配套部署入口被退役，任务隔离后端继续保留”。据此判为历史实验能力的保留部分，是有来源的工程判断；判为无人使用的死代码、误引入或可以直接删除，则证据不足。当前仍有 Task 模式解析、绑定、文件 broker、包工具、搜索与浏览器执行调用，删除会跨这些契约。本轮不扩大到删除、重构或修复既有恢复缺口，也没有运行 Linux、WSL（Windows Subsystem for Linux，适用于 Linux 的 Windows 子系统）或真实 Provider 验收。

## 验证与交付

- `bun run docs:check`：通过，351 operations（接口操作）、26 groups（分组）。
- `bun run check:architecture-index`：通过，20 份当前架构索引与链接有效。
- 本轮只改调查文档及两个索引条目；不新增或运行功能/界面测试，不用检查结果证明 OCI 功能正确。
- 本报告的三个本地 Markdown 链接均已解析到现存文件；索引的本轮差异通过 `git diff --check`。
- 交付范围固定为本报告及根/月索引各一条新增记录；精确提交与推送标识在 Git 操作完成后向用户回报。其他任务的发布提交和未提交清理差异保留，不混入本轮提交。
