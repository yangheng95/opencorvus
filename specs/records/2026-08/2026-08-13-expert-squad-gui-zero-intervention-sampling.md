# Expert Squad GUI 零干预抽查与收敛记录

Status: completed; three representative GUI samples passed without post-submit operator intervention

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

- 首次规划时 `HEAD=3ed88deb13585592e9dc3d4e5bd52c2077e650a1`。最终收敛前重新 fetch 后，当前 `HEAD=a33304a1de267c32462bd87b9d5ae7f90a681b19`、`origin/main=984d94c384fff4faaf99d30764dbb261e26e788a`，behind 0 / ahead 9。
- 待推集合夹有并行任务提交，禁止自动 merge、rebase 或 force push。2026-08-13 首轮收敛观测时 shared worktree 约有 391 行并行 tracked/untracked 状态，且计数随并发任务变化；不能把混合工作树验证归因于单一提交。
- GUI 验收使用从精确 Git 对象加本任务明确补丁构造的隔离源码快照，并让最终 package manifest、payload stamp、checker 与运行时版本共同绑定实际运行内容。
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
- 旧的 mock qualification 只记录 cwd，没有让 Task cwd 通过真实 `resolveTaskProcessExecution`，所以没能发现发行路径问题。修复边界是让 Task workspace 使用 `taskWorkArtifactRuntimeRoot(projectRoot, taskID)`，conversation workspace 使用 `rootSessionWorkArtifactRuntimeRoot(projectRoot, sessionID)`。正向测试建立 immutable native process binding 后直接通过 `Process.runTask` 启动子进程，验证真实 Task process authority 接受该 Task-owned runtime root；它不再把 mocked OfficeCLI 当成 authority 证据。
- 修复后必须重建 finalized 包并从真实 GUI 创建新的隔离 Mission；只有新 Mission 在提交后零干预完成 author -> inspect -> validate -> deliver，才能关闭本轮验收。
- 首条 Mission 中 builder 自主创建了 task-local Windows junction 后，Task cwd containment 得以通过，进而暴露第二个发行路径问题：finalized Windows 可执行文件的 inspector 冷启动实测约 13 秒，而 profile 的 parser wall-clock 是 10 秒，因此真实 OfficeCLI 输出在解析开始前即被超时。该模型侧 workaround 不是验收路径；产品修复仍删除 `%TEMP%` 双源，并把 parser 的独立硬墙钟预算调整为 30 秒（整个 Work operation 仍受 120 秒硬上限），随后重生成 qualification matrix。
- 首条 Mission 随后成功完成 author/inspect，但 validate 只返回泛化的 `reported presentation issues`，丢弃 OfficeCLI 已产生的具体 issue data，使无人干预 builder 无法按证据修正版面。Harness 必须把有界、结构化的 issue data 保留在明确错误契约中；这不是让 host 指挥模型，而是把真实 checker 证据完整返回给调用者。
- 只读复跑 OfficeCLI issues 还确认六条均为 text overflow。输入使用 PowerPoint 常见的 inch 坐标（如宽 `13.333`），但 Harness 实际把数字解释为厘米；Tool schema 与 Skill 只说“slide bounds”，没有向模型声明单位。单一修复边界是在真实 Tool JSON schema、Work Artifact Skill 和 Office Delivery builder prompt 同时明确 centimeters 及 33.867 cm x 19.05 cm 画布，并通过生成的 schema hash/Skill/package revision传播，不能靠模型猜测单位。
- 厘米坐标修复后，builder 在零人工干预下连续根据具体 overflow 证据重新 author/inspect/validate，但第三次 validate 在 OfficeCLI `view ... screenshot` 失败：pinned OfficeCLI 1.0.143 会调用系统 Chrome/Edge 的 headless 模式，却没有传递 Chrome 136+ 要求的非默认 `--user-data-dir`。builder 自行下载 Playwright Chromium 也不会改变 OfficeCLI 的可执行文件发现路径，因此该 Mission 是真实零干预失败证据，不能记为通过。
- pinned OfficeCLI 同一运行时已支持 `view <pptx> svg --start N --end N`；对实际候选 PPTX 的诊断证明该命令返回完整 SVG，并可由现有打包 Sharp 确定性转为 1280x720 单帧 PNG。根因修复边界是让 Work Harness 直接消费 OfficeCLI SVG 并生成 fresh PNG render，不再使用需要外部浏览器的 screenshot adapter。这保留 OfficeCLI 对 PPTX 布局的语义解释和现有 receipt/render digest 契约，同时让五个公开目标的用户都无需安装 LibreOffice、Chrome 或 Playwright。修复后必须通过真实 pinned OfficeCLI packaged lifecycle，并用新的隔离 GUI Mission 单次提交重跑。
- 首次重建 GUI `overlay-server` 包后，final checker 还发现该发行入口只注册 serve/mcp，未注册已有的包内 typed Work Artifact acceptance 命令，因而无法从真实 GUI 二进制启动端到端验收。修复为 overlay-server 仅在 argv 明确为 `debug` 时惰性注册同一内部命令；命令仍要求 compiled binary 和专用 acceptance env，普通 serve/help 不加载该路径。
- 内部命令首次在 overlay-server 实际加载时还暴露 acceptance helper 直接 `import sharp`，这与打包二进制的 native package 解析契约不一致；服务生产路径早已通过 `requireRuntimePackage` 从可执行文件同目录的受管 `node_modules` 解析 Sharp。acceptance helper 改为消费同一 runtime package primitive，禁止从源码 workspace 或上层 `node_modules` 偶然解析。
- final checker 自身的直接 OfficeCLI smoke 也仍使用旧 screenshot adapter，导致失败后 Chrome 占用临时 workspace，checker cleanup 最终映射为 Windows `EBUSY`。该 checker 必须与生产 Harness 共用同一 OfficeCLI SVG -> 1280x720 PNG 验收语义，不得用另一条未受支持的浏览器路径作为 release evidence。
- 最终独立终审发现 SVG -> PNG 的 Sharp CPU 阶段仍在主进程内，且 overlay-server 为 acceptance 临时注册了完整 Debug CLI。收敛后，生产与 release checker 均调用同一 `renderWorkArtifactSvgToPng`：它把最大 20 MiB SVG 送入受 Process Supervisor 管理的独立 renderer process，继承 operation 剩余 deadline、abort 和 20 MiB 输出上限，超时会先终止并结算子进程。compiled binary launcher 仅在内部 renderer authority 环境变量存在时加载该入口。
- overlay-server 的 `debug` 父命令现在只包含隐藏、compiled identity + 专用 acceptance env 双重保护的 `work-artifact-lifecycle`；不再注册 config、file、ripgrep、snapshot、gc、paths 或 wait 等通用 Debug surface。候选发行包实际调用 `debug work-artifact-lifecycle --help` 可达，`debug gc --help` 只回到空的 debug parent，不暴露 gc 子命令。

### 最终真实 GUI 验收结果

- `base`：Mission `8f768ce3144b7281` / Task `tsk_g00VS7MOBj0088GnRKGA` 完成；绑定 `base@2026.08.09.1`，planner、researcher、developer、tester 全部形成 terminal-success evidence。interaction API 原始响应为 `[]`，SQLite interaction 行数和 `interaction.requested` event 数均为 0，提交后无 operator 干预。
- `data-analysis`：Mission `d593eb4f81368d75` / Task `tsk_g00VS7RMsO00kGSNzREQ` 完成；绑定 `data-analysis@2026.08.10.1`，planner、data steward、两名并行 analyst、synthesizer、fact checker、report writer 全部完成，两名 analyst 存在约 8 分 51 秒真实重叠执行。interaction API 原始响应为 `[]`，SQLite interaction 行数和 `interaction.requested` event 数均为 0，提交后无 operator 干预。
- `office-delivery`：最终 packaged Mission `fcd774257faed7c8` / Task `tsk_g00VS8qW4R007K21HSnY` 完成；Mission board lane 为 `completed`，绑定项目安装的 `office-delivery@2026.08.13.3` 与 package digest `0d6fae7c965400002daec8c4bb557699aed54d1412d4ad9448a89c24896a9933`。
- Office workflow 的 planner 先 terminal-completed，随后 source analyst 与 builder 同前沿启动并重叠执行 `242814 ms`；三名 package agent 的 latest execution occurrence 均为 `terminal/completed`。builder 在无人工回复、重试或 steer 的情况下根据 18 条、1 条和后续 2 条 overflow checker 证据自行迭代，并在 fresh render 暴露不可见文字后主动拒绝候选、重新设计，最终完成 `work_artifact_author -> work_artifact_inspect -> work_artifact_validate -> work_artifact_deliver -> artifact_publish`。
- Task completion decision 绑定 Orchestrator Session `ses_-fe6006f3c58cffffffffffffq0v76pE0F3hSuo`、Message `msg_g019ff919a8fe000000000000FfRYXxfu1bLtcI`、Tool Call `call_HsydHF8gcqQdK81NuzqYHTV9`、Tool Part `prt_g019ff919c7f3000000000000GGauDtGbrSVKNP`、virtual workflow 与四个精确 evidence locator。该 workflow 不使用 Delivery Slice，因此 `acceptedDeliverySliceRevisionIDs` 合法为空；最终 deliverable locator 位于 completion decision 的 `deliverableArtifactLocators`。
- 最终文件 `executive-growth-update.pptx` locator 为 `/attachment/6a58f6da010d8e1c8e78b3465ee1cd4acffa9273/2befe7c351b92bf135859859419951cd81683d1738987a4f24cbd7da31021030.pptx`；现场 SHA-256 为 `2befe7c351b92bf135859859419951cd81683d1738987a4f24cbd7da31021030`，精确一致。OOXML closure 包含 2 个 slide part、5 个原生 chart part、0 个 macro/OLE/ActiveX part；CSV 的 Q1-Q4 customer、revenue 与 renewal facts 均在 fresh render 中可读且一致。
- host-issued validation receipt 为 `a8067358b844616158e24fd5648200ed811489679118bbbb3ebcbcc0c9683775.json`，绑定 pinned OfficeCLI `1.0.143`、runtime lock/package SHA、source SHA、2 张 render SHA 与资源用量；fresh delivery receipt 为 `80b2af9a4bb2382d26cc015fac525923e89d8865d9eaf56897cdbcad6b6b632a.json`。两次 receipt 的 render SHA 一致，delivery 重新执行 validation，wall-clock 分别为 `11714 ms` 与 `12103 ms`。
- 两张 1280x720 fresh PNG 已人工查看：布局完整、无截断，图表及数据标签清晰；视觉风格为克制的蓝色数据图表。验收边界仍诚实保留：OfficeCLI render fidelity 不等同于 Microsoft PowerPoint pixel fidelity。
- Office Task 的零干预由三条独立事实共同证明：`GET /task/tsk_g00VS8qW4R007K21HSnY/interactions` 原始 body 精确为 `[]`；SQLite `engine_interaction_request WHERE task_id=...` 行数为 `0`；`protocol_event` 中同 Task 的 `interaction.requested` 数为 `0`。提交后 operator message、steer、reply、retry、replan 与 cancel 调用均为 0。
- 最终 GUI 截图显示 Mission transcript 已执行 `complete_mission`，页面可见 `Mission completed and accepted` 与精确 PPTX locator；截图绝对路径为 `D:\myhexin-local\opencorvus\.scratch\expert-squad-gui-3ed88deb13\.acceptance-office-packaged-svg-final\evidence\final-gui-completed.png`，SHA-256 为 `403cd175eee2d94f41a53d261acdacbb8c2b4a8f3b980dd73118c2ab73010cfe`，不进入源码提交。

### 打包与跨操作系统边界

- Windows x64 finalized package `0.0.0-main-202608131140` 的 release checker 已从包内 OpenCorvus 启动 compiled typed lifecycle，证明 `compiled_opencorvus_typed_lifecycle`、`canonical_validation_receipt` 与 `fresh_delivery_revalidation`，随后同一包启动真实后端与 `/ui/` 完成上述 GUI Mission。终审 hardening 后另构建 `0.0.0-main-202608131215` 独立候选包，final manifest 与 payload stamp 均重写完成，其同一 release checker 再次通过三项 evidence（`100.4 s`）。
- Harness 与 checker 现在使用 bundled pinned OfficeCLI 的 SVG 输出，再由包内受管 Sharp 转成 fresh PNG；没有调用或安装 LibreOffice、Chrome、Edge、Playwright browser。五个公开发行目标都把 pinned OfficeCLI、Sharp native closure、runtime lock、license/notice、final manifest 与 packaged lifecycle checker 纳入发行包，因此最终用户不需要自行安装 LibreOffice 或浏览器渲染器。
- 本轮真实 compiled GUI lifecycle 只在 Windows x64 实跑；macOS arm64/x64 与 Linux glibc arm64/x64 的相同契约由各目标 release job 强制执行，但本轮没有在本机宣称这些 OS 已实跑。

### 验证边界与已知非本任务失败

- 聚焦 canonical receipt/fresh delivery 测试通过：`1 pass`。
- 终审 hardening 后从稳定隔离快照重跑同一 canonical receipt/fresh delivery 测试为 `1 pass / 0 fail`（`37.96 s`）；真实 Task process authority 测试为 `4 pass / 0 fail`，其中新增用例实际建立 immutable native binding、通过 `Process.runTask` 启动子进程，并验证 cwd 为 Task-owned Work Artifact runtime root。
- 使用真实 pinned packaged OfficeCLI 的 `packaged-lifecycle.test.ts` 通过：`1 pass`。
- finalized Windows x64 `check-work-artifact-profile --package-root` 通过，约 `100.6 s`，并显式返回三项 packaged evidence。
- 完整 `qualification.test.ts` 当前为 `12 pass / 3 fail`；三项失败是现有 Windows process-supervisor physical-settlement marker/timeout 契约，与 SVG render 路径无代码交集，不能把整文件表述为绿。
- package typecheck 被共享工作区中并发修改的 `src/provider/schema.ts` 与 `src/tool/artifact-catalog.ts` 错误阻断；本任务文件没有诊断。该事实不削弱上述真实 packaged checker 与 GUI evidence，但阻止宣称共享混合工作树全量 typecheck 通过。
- Office Delivery projection 聚焦测试最初在与 GUI 包一致的生成闭包上为 `4 pass / 0 fail`。把 expert-squad generated payload 机械收敛为 `HEAD` payload 仅替换 Office Delivery block 后，共享混合树复跑被并发 `academic-paper-review` 的 `integrity base_role requires the explicit platform_integrity_review execution contract` schema 迁移拦截；该错误不在本任务包或 payload block。尝试从 `HEAD` 构造隔离候选并安装其自身 workspace dependencies，又因 package manifest 下载连续 `ConnectionClosed` 无法完成，因此没有把这次隔离重跑包装成通过。

## 执行顺序

1. 从精确 HEAD 构造隔离源码快照，编译 Web UI，并建立隔离 runtime、managed config、Git identity 和三个项目。
2. 只复制一个真实 Provider 的必要凭据，写入无 secret 的精确配置，随机端口启动后端；验证 health 与 `/ui/`。
3. 使用应用内 Browser 人工完成三次 GUI Task 提交；每次提交后停止一切输入，只观察进度、最终状态与交付物。
4. 对每条 Task 读取 canonical API/SQLite/event/Git/Artifact 证据，分析任何失败的症状、触发、调用链、根因、共用修复边界和影响面。
5. 若修复代码，添加聚焦正向非 UI 测试并从新快照重跑受影响的完整 GUI 链；最终进行独立只读复核、精确提交，并仅在待推集合安全时 push。
