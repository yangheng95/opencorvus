# Expert Squad GUI 零干预抽查与收敛记录

Status: execution in progress; final packaged Office Delivery rerun pending

## Recall

### 用户原始要求

- Work Artifact Harness 完成后启动 OpenCorvus 后端与 Web UI。
- 以真实 GUI 形式抽查 Expert Squad（专家团）。
- 最终目标是用户通过 GUI 提交 Task 后，不再追加消息、回答问题、批准、重试、重规划或取消，专家团能够自行跑完整个工作流并交付结果。

### 验收边界

- 使用后端真实 `/ui/` 页面和真实 Provider，不用 UI 自动化测试、fixture 页面、DOM 断言或截图基线代替验收。
- 唯一允许的人为动作是通过 GUI 创建/选择项目、选择 Expert Squad、填写一次完整任务并提交。提交后不调用 operator message、steer、interaction reply、retry、replan 或 cancel。
- 抽查三条相互独立的 Task：
  1. `base`：小型 Git 项目中的一处明确代码改动及聚焦测试，覆盖 planner 与同前沿 researcher/developer/tester 协作。
  2. `data-analysis`：带明确口径的小型本地 CSV，覆盖 planner、data steward、两个并行 analyst、synthesizer、fact checker、report writer 的多跳 fan-out/fan-in。
  3. `office-delivery`：确定性事实表生成 1–2 页 PPTX（含图表），只验收当前已资格化 PPTX，覆盖 Work Artifact Skill、OfficeCLI、render、validation receipt 和 final artifact locator。

### 成功判据

- GUI 可见 Task 到达 completed，最终摘要与可打开的交付 Artifact 一致；没有当前 process incident 或 failure。
- canonical Task completion decision 绑定所选 Expert Squad 的 ID、revision、digest、workflow、accepted delivery slice、evidence locators、deliverable artifact locators 和 Orchestrator Session/Message/Tool Part lineage。
- 每个声明工作流节点只执行一次并具有 terminal-success evidence；依赖节点只在前置节点完成后展开，同前沿兄弟节点存在真实重叠执行。
- 每条 Task 的 `GET /task/:taskID/interactions` 原始响应精确为 `[]`；只读 SQLite 中该 task_id 的 interaction 行数为 0；Task event 中 `interaction.requested` 数量为 0。
- 提交后的 operator message、steer、interaction reply、retry、replan、cancel 调用均为 0。`pendingInteractions=0` 或 UI 无红点不足以单独证明零干预。

### 隔离与安全约束

- 验收绑定到不可变源码身份；共享 dirty worktree 不能直接作为可复现源码证据。
- 使用新的绝对 `OPENCORVUS_HOME`、空的 `OPENCORVUS_TEST_MANAGED_CONFIG_DIR`、随机 loopback 端口和三份独立临时 Git 项目。
- 清除继承的 `OPENCORVUS_CONFIG`、`OPENCORVUS_CONFIG_DIR`、`OPENCORVUS_CONFIG_CONTENT` 与 `OPENCORVUS_DISABLE_PROJECT_CONFIG`，再注入精确最小配置。
- Provider/model 必须真实、固定且可用；凭据只通过隔离运行时 auth 边界提供，不写入日志、spec、截图或提交。
- Git HOME、USERPROFILE、global config、template/hooks 目录隔离；不读取或执行用户 Git hook。
- 不停止、刷新或修改用户现有 OpenCorvus、浏览器或其他服务进程；只管理本轮由 Codex 启动且命令行与隔离根可证明归属的进程树。

### 已读资料与全仓搜索

- `AGENTS.md`、`BUILD_AND_DEV_QUICKSTART.md`。
- `specs/records/2026-08/2026-08-10-expert-squad-publish-install-reuse-e2e.md`。
- `specs/records/2026-08/2026-08-12-work-artifact-harness-p0-implementation.md`。
- `packages/opencorvus/src/cli/cmd/serve.ts`、`src/server/overlay-ui.ts`、Task interaction route 与 Engine interaction store。
- `packages/overlay` 的 browser-mode HostTransport、settings、workspace、Task、Mission 与 Expert Squad Composer surface。
- `expert-squads/builtin/{base,data-analysis,office-delivery}` 的 manifest、agents、workflow nodes、package Skill references 和工具声明。
- Browser skill：真实页面交互使用应用内 Browser；截图用于人工视觉复核，不产生 UI 自动化测试资产。

### 当前代码与运行前事实

- 当前 `HEAD=3ed88deb13585592e9dc3d4e5bd52c2077e650a1`；`origin/main=984d94c384fff4faaf99d30764dbb261e26e788a`。
- 当前分支相对远端 behind 7 / ahead 6；待推集合夹有并行任务提交，禁止自动 merge、rebase 或 force push。
- shared worktree 有大量并行 tracked/untracked 修改，不能直接启动并把结果归因于 HEAD；本阶段将从精确 Git 对象构造隔离源码快照。
- 当前 shell 没有 Provider 环境变量；默认运行根保存有 `openai` OAuth 与 `deepseek` API 凭据。正式隔离运行只复制所选 Provider 的必要 auth record 到新运行根，不打印 secret 字节。
- 后端 `serve --hostname 127.0.0.1 --port 0` 可选择随机端口并打印 `/ui/` 地址；同一后端服务真实 Overlay Web UI，避免占用固定 Vite 5173。

### 独立 agent 反馈

- 独立只读监督建议 `base + data-analysis + office-delivery` 作为最小完整矩阵。
- 监督明确要求零干预由 interaction API、SQLite 与 event 三重证明，并校验 completion decision、package binding、节点依赖/并行时序、Artifact 与 GUI 摘要。
- 监督未发现上述验收契约本身的代码阻断；运行前阻断是稳定源码身份、真实 Provider 和隔离环境，均已纳入本计划。

### 真实 GUI 首轮结果与根因分析

- `base` 与 `data-analysis` 两条隔离 GUI Mission 已在提交后零干预完成；两者均到达 canonical completed，interaction API 为 `[]`，并形成完整 package/workflow/evidence/deliverable 绑定。
- `office-delivery` 的源码启动观察证明包投影修复有效：builder 获得四个 `work_artifact_*` 工具并按要求调用，但源码进程不能代表发行包，且无法从 Bun 安装目录解析打包 OfficeCLI。因此最终验收改用 finalized `opencorvus-overlay-server-windows-x64`。
- finalized Windows x64 包已从同一不可变快照构建；manifest 为 `phase: final`，内嵌 Web UI、OfficeCLI、browser Node runtime、process supervisor 和 package payload stamp 均来自包目录。用户无需安装 LibreOffice。
- 最终包的首条真实 GUI Mission 在零干预下完成 planner，并并行展开 source analyst 与 builder。builder 读取 canonical source/Skill 后调用 `work_artifact_author`，被 `ExecutionCapsuleRuntimeUnavailableError` 拒绝：Work Harness 在 Windows 把 OfficeCLI cwd 建于系统 `%TEMP%`，而 Task native process binding 的不可变 root 是当前项目目录。
- 触发链为 `work_artifact_author` -> `authorWorkArtifactPresentation` -> `withOfficeWorkspace` -> Windows `%TEMP%` workspace -> `Process.runTask` -> `resolveTaskProcessExecution` root containment check。安全检查本身正确；根因是 Harness workspace 选择没有消费既有 `ProjectRuntimePaths` Task/Session 单一运行时目录契约。
- 旧的 mock qualification 只记录 cwd，没有让 Task cwd 通过真实 `resolveTaskProcessExecution`，所以没能发现发行路径问题。修复边界是让 Task workspace 使用 `ProjectRuntimePaths.toolOutputDir(taskPrimaryProjectRoot(...), taskID, sessionID)`，conversation workspace 使用 `rootSessionToolOutputDir`，并在正向测试中让 mocked OfficeCLI 调用真实 Task process resolution。
- 修复后必须重建 finalized 包并从真实 GUI 创建新的隔离 Mission；只有新 Mission 在提交后零干预完成 author -> inspect -> validate -> deliver，才能关闭本轮验收。
- 首条 Mission 中 builder 自主创建了 task-local Windows junction 后，Task cwd containment 得以通过，进而暴露第二个发行路径问题：finalized Windows 可执行文件的 inspector 冷启动实测约 13 秒，而 profile 的 parser wall-clock 是 10 秒，因此真实 OfficeCLI 输出在解析开始前即被超时。该模型侧 workaround 不是验收路径；产品修复仍删除 `%TEMP%` 双源，并把 parser 的独立硬墙钟预算调整为 30 秒（整个 Work operation 仍受 120 秒硬上限），随后重生成 qualification matrix。
- 首条 Mission 随后成功完成 author/inspect，但 validate 只返回泛化的 `reported presentation issues`，丢弃 OfficeCLI 已产生的具体 issue data，使无人干预 builder 无法按证据修正版面。Harness 必须把有界、结构化的 issue data 保留在明确错误契约中；这不是让 host 指挥模型，而是把真实 checker 证据完整返回给调用者。
- 只读复跑 OfficeCLI issues 还确认六条均为 text overflow。输入使用 PowerPoint 常见的 inch 坐标（如宽 `13.333`），但 Harness 实际把数字解释为厘米；Tool schema 与 Skill 只说“slide bounds”，没有向模型声明单位。单一修复边界是在真实 Tool JSON schema、Work Artifact Skill 和 Office Delivery builder prompt 同时明确 centimeters 及 33.867 cm x 19.05 cm 画布，并通过生成的 schema hash/Skill/package revision传播，不能靠模型猜测单位。

## 执行顺序

1. 从精确 HEAD 构造隔离源码快照，编译 Web UI，并建立隔离 runtime、managed config、Git identity 和三个项目。
2. 只复制一个真实 Provider 的必要凭据，写入无 secret 的精确配置，随机端口启动后端；验证 health 与 `/ui/`。
3. 使用应用内 Browser 人工完成三次 GUI Task 提交；每次提交后停止一切输入，只观察进度、最终状态与交付物。
4. 对每条 Task 读取 canonical API/SQLite/event/Git/Artifact 证据，分析任何失败的症状、触发、调用链、根因、共用修复边界和影响面。
5. 若修复代码，添加聚焦正向非 UI 测试并从新快照重跑受影响的完整 GUI 链；最终进行独立只读复核、精确提交，并仅在待推集合安全时 push。
