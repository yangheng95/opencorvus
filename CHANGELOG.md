# 更新日志

本文记录 OpenCorvus 从 `0.0.35beta` 开始的版本变化。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)；产品版本使用 `0.0.35beta` 形式，代码元数据使用对应的 SemVer（Semantic Versioning，语义化版本）形式 `0.0.35-beta`。

## 未发布

## 0.0.59beta - 2026-09-05

本版本从最后一个公开版本 `0.0.54-beta` 继续发布，包含下方未公开 `0.0.58-beta` 候选的全部改动，并完成其后的调度架构收敛、Search-native 能力迁移与 Light 专家团验收。桌面端、命令行、更新清单和公开网站都绑定到同一份 `0.0.59-beta` 源码；产品版本只允许 `major.minor.patch` 三段数字以及可选的 `beta` 标签，不再接受 `beta.1` 一类第四段编号。

### Changed

- Task、Mission、Session、Wait、Automation、Project 与 Work 的创建、派发、唤醒、重试、恢复、关闭和保留统一绑定到持久化 occurrence 与明确的租约/结算事实；跨进程接管使用同一事实来源，不再由进程内回调或时间猜测决定。
- Expert Squad 能力引用迁移到类型化、occurrence-bound 的 Search-native 目录；Light 调度器只获得清单显式授权的 7 个 Tool，worker 仍使用平台统一 transport，安装继续遵循下一回合才激活的边界。
- Mission 接受与最终关闭绑定到精确输入、Task epoch、证据 lineage、最终 artifact 和可见 assistant response；worker 报告只接受本轮已派发 Session 的精确消息引用。

### Fixed

- 修复并发 collection wake、重复派发、跨 Project 容量竞争、延迟消息、Automation recurrence/retry、Task wait ingress、关闭后 archive/delete，以及进程退出恢复中的重复、遗漏和错误接管。
- 修复并行 worker 结果逐条读取造成的额外 Turn：编排器现在一次读取精确的 `message_ids` 集合，并在单次 completion 中核对完整派发集合。
- 修复 Light 咨询在来源约束、工具预算和并行调查上的漂移；真实四成员咨询以一次派发、四个重叠 Provider Session、一次批量读取和一次完成收敛，没有 Tool 失败或 operator correction。

### Performance

- Automation、Wait 与 recovery 热路径改为带索引的有界分页/批量 reducer；查询次数按页而不是按定义、Fire 或历史记录增长。

## 0.0.58beta - 2026-08-29

这是未公开的候选版本，记录当时已完成的全仓架构债清理与真实 Mission 调度验收：统一 Task、Mission、Session、Provider、MCP、调度器、持久化与 Overlay 的事实和组合边界；新增全局 Chat、运行时 Skill Market、Inspect AI benchmark 适配与 Light 专家团。SDK、util 与 plugin 的源码包元数据同步到同一候选版本并通过打包安装预检；npm registry 发布不属于该候选范围。`v0.0.56-beta` 因 frozen lockfile 漂移在共享依赖安装阶段失败关闭，`v0.0.57-beta` 又因干净 runner 的 Overlay 未选择工作区 `source` export condition 而在打包阶段失败关闭；这些标签与 `v0.0.58-beta` 均保留为不可变审计证据，其改动由 `0.0.59-beta` 公开发布。

### Security

- 桌面端渲染进程不再向 `window` 暴露实时设置、应用和看板 store、明文服务器密码，以及目录切换、任务加载/选择、看板加载和设置持久化等业务写入入口；相关生产代码改为直接使用类型化模块导入。渲染进程中的任意脚本或开发者工具表达式因此无法再读取服务器密码或触发这些业务写入。

### Added

- 新增 `GET /lifecycle/{occurrenceID}`：`server.shutdown` 与 `server.restart` 现在同步受理为一次带稳定标识的生命周期 occurrence，响应携带 `occurrenceID`；受理后处理器被清除或失败会把该 occurrence 结算为 `failed` 并附精确错误，重复请求收敛到在途 occurrence，冲突的另一种转换以 409 拒绝并返回在途 occurrence 标识。关机成功即进程退出，无法自证，故没有 `succeeded` 状态。
- 新增幂等的全局 Chat start API：一次请求原子创建可见 Chat、持久化首条真实用户消息并返回 canonical Session 流坐标；相同请求重放收敛到同一对话和同一回合。
- 新增运行时 Skill Market 搜索、检查与 exact-hash 托管安装链；外部内容在安装前后校验同一 SHA-256，安装仅影响下一回合，不会热挂载到当前执行。
- 新增 Inspect AI benchmark 注册表和 OpenCorvus Task 适配器，以及面向咨询、调查和澄清问题的两角色 Light 专家团；二者都复用现有 Task/Session runtime，不引入第二套 Agent 执行器。

### Changed

- Mission acceptance 现在由 revisioned ledger、criterion 状态、Task execution epoch、obligation/evidence 绑定和受影响 lineage continuation 共同决定；调度、恢复、重试和最终关闭使用同一套持久化事实。
- Session prompt owner、运行时 package publication、Task root ingress、scheduler wake、artifact provenance 与 execution directory 等跨进程边界迁移到各自单一 owner，并由 module topology 与 architecture checker 防止重新形成反向依赖或双源。
- 原生 OpenAI/Azure 在带 Tool 的单个 Provider step 内关闭并行 function calls；独立 Session、Task、Agent 与 Project 仍可并发。Provider schema 保留开放 JSON record 语义，canonical Zod schema 继续负责执行前校验与默认值物化。
- Overlay 的 Mission/Task/Session 消息统一走 subscribe-before-snapshot 与同一 causal frontier，实时增量和重连 hydration 收敛到同一 Message/Part lineage；较早历史可继续分页读取，大型折叠 Tool payload 延迟到显式展开。
- Provider plugin 的能力改为最小权限 ABI：运行期 OAuth refresh 必须通过 `PluginInput.credentials.refresh` 进入引擎持久化 exchange occurrence；plugin 不再获得完整 SDK client，只获得受管 credential 操作与只读 Session facts。非网络 API credential metadata 只通过带 observed-key 比较的窄更新接口写入。OAuth credential alias 从 callback success 的动态 `provider` 字段迁移为 method-level 静态 `credentialProvider` 声明；外部 plugin 必须在 authorize 前声明真实 credential target。
- MCP（Model Context Protocol，模型上下文协议）OAuth 凭据引入持久化租约代：一次授权流程在开始时建立租约，流程内的多次写入共用这一代；吊销或新流程铸新代后，旧持有者的写入被精确拒绝，包括由同一数据根上另一后端执行的吊销。删除后重建的凭据不再可能被删除前的持有者写入。
- 调度器、总线、权限、构建清理、会话控制、任务取消收敛等全部控制租约持有方现在与其结算收据同事务归还租约；新增 `check:control-lease-owners` 守卫（pre-push 运行），任何新增取租约位置必须声明其释放路径。
- 共享 JSON 事实文件（全局/项目配置、Provider 凭据、MCP 凭据、专家团配置）的读改写迁移到跨进程锁内，多后端并发写不再丢失更新。
- Provider OAuth 授权成为持久化流程 occurrence：`ProviderAuthAuthorization` 新增必填 `flowID`，CLI、Overlay 与两个回调路由都必须携带它以精确结算对应流程；pending executor 持有可续租的 Provider-wide owner，另一授权在其存活期间得到 409 而不会替换或泄漏其 loopback/device executor。回调对方法不匹配、已结算、不可执行分别返回具名错误（`ProviderAuthOauthFlowMismatch`、`ProviderAuthOauthFlowAlreadySettled`、`ProviderAuthOauthFlowNotExecutable`）。CLI 不再直接执行 plugin callback 或写凭据，`auth/execute` 也只接受 API credential method。
- 公共 Session 执行变更（`session.prompt`、`session.command`、`session.shell`）现在必须携带调用方铸造的稳定请求 occurrence——输入消息标识 `messageID`（`session.shell` 的公共 schema 新增该字段）；服务器不再在省略时代铸标识。相同标识与指纹的重试收敛到首次 occurrence：prompt/command 返回或续跑既有回合，shell 直接返回持久 occurrence、绝不重复执行命令；同一标识配不同请求体以 409 `PublicSessionPromptIdentityConflictError` 拒绝（command/shell 路由新增该冲突响应）。`session.shell` 的响应 schema 修正为与实际一致的 `{info, parts}`。
- Browser 附着失败不再隐式降级到独立浏览器：附着与独立是两个浏览器身份（不同 Cookie、不同登录态），跨越这条边界现在必须由配置显式声明。默认的 `OPENCORVUS_BROWSER_MODE=chrome` 在 Chrome 不可附着时以具名错误失败并给出精确原因；接受在另一身份下工作需设置 `OPENCORVUS_BROWSER_MODE=chrome_or_isolated`；直接选择 `isolated` 仍是独立模式。此前依赖静默回退的部署会明确失败，直到声明策略。
- 托管服务器就绪改为机器可读的启动收据：SDK 通过 `--startup-receipt`/`--startup-occurrence` 向服务器交付一次性收据通道，并只依据其中的框架化事实结算启动（绑定 URL 或精确的终态错误），标准输出仅作诊断。SDK `0.0.55-beta` 与不认识这两个参数的旧版 `opencorvus` 二进制不兼容，需成对升级。

### Fixed

- 修复 Mission 创建 Task、Task 完成投递、父级唤醒、acceptance repair 与终态关闭之间可能出现重复 occurrence、遗漏回执、错误重开或 head-of-line starvation 的共享调度缺陷；真实 `openai/gpt-5.6-terra` Mission 以一个 Task、一个 epoch 和 planner/developer/tester 各一次完成，Provider、Tool 与 Bus 逐项全成功结算。
- 修复 OpenAI 在复杂 Panel surface 上同一并行批次内产生部分 canonical、部分嵌套 `parameters` 输入的问题；最终 artifact reads 逐次使用同一 flat schema，不再产生 `tool-input-invalid` 与下一 Turn 重试。
- 修复 Conversation/Session 首次连接、重连、旧消息分页、飞行中 operator message、child-Agent activity 和 Work Ledger hierarchy 的多处投影分叉；真实参与者消息保持完整可见，Standalone 与 Mission-owned Task 各自只出现一次。
- GitLab Provider auth 不再加载会自行刷新并写入 OpenCode `auth.json` 的旧 npm plugin；仓库内适配器把 OAuth 首次交换、运行期 refresh 与 Personal Access Token（PAT，个人访问令牌）提交全部交还中央 Provider auth authority，并保留原 MIT 来源声明。错误 state 的 loopback 请求只得到固定 400，不会终止合法的在途授权。
- 修复 Provider 初次 OAuth 授权与运行期 token refresh 在远端交换成功、`auth.json` 提交前进程退出时丢失 minted credential 且无精确事实的问题：Project、global、CLI、内置 plugin 与 account-usage 共用 Provider-wide renewable owner，按 `exchanging → credential_ready → consumed` 持久化；`auth.json` 的 generation/tombstone 与输出 digest 同时证明精确提交并阻止 ABA 覆盖，owner 过期时收敛为成功或 `exchange_uncertain`。结果不确定的 rotating refresh fence 在原 credential generation 仍有效时不按时间淘汰，因此不会在 24 小时后重新交换同一 refresh token。
- 修复全局任务创建的请求重放会重复分配项目与任务的问题：请求身份现在在项目分配之前全局解析，重放返回首次提交的同一 `{task_id, project_id, directory}`，冲突重放由既有的项目内幂等检查拒绝。
- 修复 MCP `configure` 被打断会留下"有定义无凭据"的半配置服务器的问题：密钥现在先暂存（staged）、定义提交后再晋升为生效凭据，前一定义正在使用的密钥在其退役提交之前绝不被销毁；任何窗口的崩溃都由下一次项目配置提交的凭据对账收敛——匹配已提交定义的暂存密钥被晋升，不匹配的被丢弃。
- 修复 MCP OAuth 授权发起进程死亡后回调无法完成的问题：回调进程现在可仅凭持久事实（凭据租约、OAuth state、PKCE verifier）重建流程并完成兑换，全部写入仍以原租约代为栅栏。
- 修复会话回合执行期间发送的用户消息持久化失败（HTTP 500）的问题：飞行中标记 `pendingDelivery` 此前写在深冻结的物化快照上而抛出 TypeError，现在写在持久化副本上；回合中到达的消息重新可以入队并在回合边界投递。

### Removed

- 移除渲染进程遗留的全局诊断 ABI（Application Binary Interface，应用程序二进制接口）：`window.__ocNextChatMetadata` 聊天元数据注入入口、`window.__overlayTest` 与 `window.__ocOverlayTiming` 超时覆盖、`window.__overlayInitSettled` 就绪标记、`window.__ocMarkdownRenderPrewarmPending` 预热计数、无调用方的 `window.openWorkspaceDiff`，以及由 `?acceptance-locale` 查询参数写入、可在正式版本中覆盖界面语言的 `__OPENCORVUS_LOCALE__` 入口。这些入口在当前仓库中已无任何写入方或读取方。渲染进程现在只保留一个显式声明的全局（启动接管握手），并由 `bun run --cwd packages/overlay check:renderer-surface` 作为构建后的正向契约守卫。

## 0.0.54beta - 2026-08-25

本版本为共享 LLM 流停滞恢复增加明确上限，并修复公开网站“页面显示新版、主按钮却未绑定精确新版安装包”的下载交互；桌面端、命令行二进制和网站使用同一份 `0.0.54-beta` 发布事实。

### Changed

- LLM 首字节等待缩短为 90 秒；首字节或流式空闲超时各只重试一次，使同一停滞请求链在十分钟内以具名错误收敛，不再重复等待长超时。
- 网站下载菜单逐项显示架构、格式、当前版本和精确文件名；Windows 主按钮明确标出 EXE，避免与同架构 MSI 混淆。

### Fixed

- 修复首次标题生成在执行轮次开始后、主会话处理器启动前可能无限等待的问题；标题、项目记忆整理和提交信息生成现在统一使用共享的首字节、语义空闲与总时限契约。标题继承所属执行轮次的取消信号，项目记忆整理和提交信息生成继承各自调用方的取消信号。
- 修复浏览器不提供高熵架构提示时，Windows 主按钮仍停留在 GitHub Release 页面、却显示为直接下载的问题；当发布清单证明该平台只有一个架构时，按钮现在绑定清单排序的当前 EXE。
- 修复无法安全判定平台或架构时仍把 Release 链接包装成下载动作的问题；此时主按钮会展开当前版本的显式选择菜单。

## 0.0.53beta - 2026-08-24

本版本修复长时间运行任务的唤醒、活动续期与恢复终态收敛，同时恢复桌面端右侧工作区、工作台重命名和工具详情交互，并同步发布桌面端、命令行二进制和公开网站。

### Changed

- 延迟唤醒现在公开稳定的持久化结算事实；长时间 Tool 执行会根据真实流式输出和持久化进度续期，不再被固定的绝对暂停时限误判为失活。
- 临时 Provider 诊断在进入持久化日志和错误边界前统一脱敏，避免上游请求上下文被意外记录。

### Fixed

- 修复恢复执行的 Task occurrence 在子 Session 已终止后仍无法收敛父级终态的问题。
- 修复 Overlay 右侧 Dock 的切换与新增菜单交互、Work Ledger 双击重命名，以及工具披露需要点击两次才能展开的问题。

## 0.0.52beta - 2026-08-22

本版本收敛专家团工作流的公开投影、交付结算与独立验收权威链路，并同步发布桌面端、命令行二进制和公开网站。

### Changed

- 公开 Market 与双语架构文档现在投影 Base 的 2 条、Advanced 的 6 条当前工作流；注册表、生成目录与详情页使用同一份当前 package 事实。
- Base、Advanced 与生成专家团模板的独立验收改为从原始要求和有限权威来源重建 action matrix，并按实体、规则与实际效果逐行核对。

### Fixed

- 修复调度器在 Agent Session 已完成、但父级尚未收到终态投递时缺少持久化结算事实的问题；协议现在公开可复核的 Session delivery settlement。
- 修复验收链在接收交付声明时可能丢失权威来源和效果证据，导致后续接受判断无法证明原始要求的问题。

## 0.0.51beta - 2026-08-22

本版本继续修复多 Agent Harness 的调度、工具分配和外部业务系统验收质量，并同步发布桌面端、命令行二进制和公开网站。

### Changed

- Base 与 Advanced 会先把验收标准拆成稳定编号，并按真实 Tool 能力把规划、执行和独立验收交给对应 Agent；只读 Agent 不再接收本地客户端、命令或外部状态变更。
- 对由当前政策、流程、模板或历史记录决定的批量业务操作，执行 Agent 会先冻结有限权威来源清单，再建立逐实体、逐规则、逐效果的 action matrix；Tester 会从原始要求和当前权威源独立重建并逐行核对。
- 可移植 Expert Squad 模板同步采用有限来源闭包、同效果表示证明和独立验收契约，避免新生成的专家团重复旧缺陷。

### Fixed

- 修复同一编排 Turn 内先更新 Goal、随后并行 dispatch 时，后续 Tool 会因决策身份漂移而被拒绝的问题；重启恢复继续使用持久化的同一决策集合。
- 修复运行时 prompt 标签、Prompt composition 指纹和实际 Agent/Session 归因可能不一致，导致 Provider 调用证据无法稳定复核的问题。
- 修复 `squad-sdk` 当前包字节仍声明旧 revision，以及 revision digest 读取平台相关 checkout 换行符、使 Windows 与 Linux 对同一提交生成不同基线的问题；生成器现在与 package payload 共用 UTF‑8/LF 规范字节。

## 0.0.50beta - 2026-08-21

本版本修复多 Agent Harness 在外部业务系统交付中的 Skill 投影与独立验收链路，并同步发布桌面端、命令行二进制和公开网站。

### Changed

- Advanced 对外部系统的变更统一绑定到 `planned-delivery` 工作流；执行变更的 Agent 不再用自己的交付物充当独立验收，Tester 会从原始要求和权威数据源重新观察结果。
- Base 同步明确：变更执行者发布的 Artifact 是交付声明，不是独立验收证据。

### Fixed

- 修复 `universal-build` 能解析 Expert Squad Skill、却不出现在 Skill mount matrix 中的双源问题；matrix 现在同时覆盖 scheduler-only 与 package-projected Agent，并标明能力由 package 还是 platform 提供。
- 修复 Advanced 外部系统任务可能直接派给通用 worker、绕过计划交付和独立测试的问题。

## 0.0.49beta - 2026-08-19

本版本把公开站与 README 的主张收敛到长程任务与自进化上，并汇总自 `0.0.48beta` 发布以来的用户可见改动。

### Added

- 落地页新增三段：**长程工作在哪里断**（跑不彻底、结果不能核对、工作流永远不会变好，各自对应真实机制）、
  **专家团组合起来**（以「从调研资料到一篇可投的论文」为案例，6 支专家团 / 33 个具名角色，另附三组已集成组合）、
  **会修订自己的专家团**（反馈修订与度量式活动两条路径，以及「没有你的确认就不安装」的边界）。
- 新增三篇双语文档：`concepts/long-horizon`、`concepts/squad-composition`、`expert-squads/evolution`。
- 双语 README 同步换主张，并新增同样的三节内容。
- 专家团组合的支数与角色数改为构建期从已发布目录解析（`squad-compositions.generated.ts`），
  文案里不再出现手抄的计数。

### Changed

- 落地页与 README 的定位从「开箱即用的多 Agent Harness」改为「面向长程任务的 Harness」。
- 内置工具数量按注册表更正为 43（此前 README 多处写作 42）。

### Fixed

- 修复 Work Ledger 行内固定项没有带上所属 Project。
- 修复 Release 标签打在派发时的分支头部而不是实际构建出的那个提交上。
- 修复 Mission 收不到自己已完成子任务的消息：两处解码用的 schema 要求存储层放在 SQL 列里的字段，
  判定永远不可能成立。
- 修复子 Agent 在多个界面里各出现一次：同一个会话的多轮执行收敛为一条记录，查找也不再返回最旧的那次。
- 修复重试被租约拖住：记录「500 毫秒后重试」却仍持有两分钟租约时，实际要等两分钟；租约现在可以提前到期。
- 修复 macOS 红绿灯按钮与窗口顶栏没有对齐。
- `artifact_publish` 的 JSON 解析错误改为报出行号、列号与出错处的原文摘录，不再报字节偏移
  —— CJK 载荷下字节偏移与作者能数的位置相差三倍。

### Removed

- 删除无人引用的落地页文案模块 `packages/web/src/content/landing.ts`。

### Performance

- Overlay 不再在每一个流式片段到达时重新推导整段会话。
- Overlay 启动包从 2.89 MB 降到 1.70 MB：七个 artifact 渲染器与代码编辑器改为按需加载。

## 0.0.48beta - 2026-08-19

本版本汇总自 `0.0.46beta` 发布以来的全部用户可见改动。`0.0.47beta` 发布过二进制，但没有单列条目，其改动一并计入本节。

### Added

- 落地页 hero 之下改为播放一段真实运行录屏：滚入视口才开始下载和播放，滚出即暂停，`prefers-reduced-motion` 下不自动播放，读者按过播放器后由读者说了算。它取代了原先二十张交付物截图的轮播。
- 专家团详情页可直接唤起桌面端安装（`opencorvus://expert-squad/install`），ZIP 下载降为次选路径；客户端仍会重新校验重定向、字节长度与 SHA-256，并要求显式作用域。
- Overlay 侧边栏可一键下载并安装更新，且只在确有可用更新时出现。
- Overlay 输入区的专家团选择器接入专家团市场：输入两个字符即可搜索未安装的专家团，并就地装入当前 Project。
- 进化面板可回到目标持有过的任意修订，反馈可直接修订清单。
- 编排器名册展示每个投影 worker 实际可调用的 Tool 集合。
- 关于面板写明作者与联系方式；README 与落地页 FAQ 说明运行时与桌面端都出自本仓库，底层没有第三方 agent 引擎。

### Changed

- 通用公开 `/session` 面收紧为：Mission Session 只能经 Mission 授权访问。
- 桌面更新清单改为描述本次实际构建出的平台，不再因为缺少某个平台而拒绝整个 Release。
- 进化实验室的候选作者提示词补上「一次修订如何改变行为」，此前每次修订只会在既有指令旁追加一句对冲表述，导致两个对照臂无法区分。

### Fixed

- 修复 VS Code Dark 等主题下 K 线图渲染为空白：主题把颜色写成 `color-mix()`，图表库只认旧式语法，颜色改在边界处解析回 `rgba()`。
- 修复浅色主题下终端选中色丢失强调色（同一根因，同一处解析器）。
- 修复图表导出菜单常驻展开，恢复为点击展开。
- 修复 Mission Board 侧边栏行的悬浮提示与其它导航行样式不一致。
- 修复 Overlay 只从协议信封取回 Session 身份、丢掉 Task 身份，导致 `review.stream.*` 找不到可投影的 Task。
- 修复公开站页脚的访问统计：改为按页面访问计数，删除按浏览器 opt-in 的令牌、Cookie 与同意标记，不再存任何与读者相关的东西。
- 修复手动触发的 Release 把紧凑版本号（`0.0.48beta`）原样传给打包任务，导致十个平台全部以 `Invalid OPENCORVUS_VERSION` 失败。
- 修复落地页 hero 的第二段录制永远不会播放。
- 修复更新安装失败后卡在 `DESKTOP_UPDATE_NOT_DOWNLOADED`：宿主在两条失败路径上都归还已准备好的安装包，客户端重试将重新下载。
- 修复单个构建机停滞就丢弃全部九个已完成平台、整个 Release 无从重跑的问题。
- 修复打包的 Work Artifact 验收先把助手消息置为完成再追加 Tool Part，导致 CLI 归档任务的生命周期检查失败。
- 修复仓库工具文件放在专家团授权根目录下会让生成流程抛错。
- 修复原生命令种类枚举存在手抄副本。
- 修复两个内置专家团在已发布版本号下更换了工具字节，导致站点注册表导入失败。

## 0.0.46beta - 2026-08-18

本版本汇总自 `0.0.44beta` 发布以来的全部用户可见改动。`0.0.45beta` 只是分支版本基线，没有发布过二进制，因此不单列条目。

### Added

- 公开站收敛改版：落地页与专家团市场两个 surface，配套双主题、移动端布局和令牌化设计系统；退役 URL 全部 301 重定向到新位置。
- 增加 Composer 权限模式控制，可在发起对话前直接选择权限档位。
- 恢复桌面端自动更新，并在侧边栏提供入口。

### Changed

- 任意终态 Task（含已取消）收到操作者消息即恢复执行；Retry 意图整体移除，Task 边界只剩取消与删除。
- Task-root 入口改为具名 host fault 结算：故障只影响当前入口并释放队首，不再吸收后续消息。
- 证据定位器由宿主盖章生成内容摘要，不再接受模型转抄的摘要入参。
- 执行控制状态收敛到不可变事实之上，移除冗余的派生状态投影。
- 专家团搜索本地化改为构建期生成产物。

### Fixed

- 修复流活动 pause 未配对 resume 时空闲监视器被永久禁用的问题，补上超时兜底。
- 修复 worktree 会话的所有权风险链，避免子会话权限恢复扫描误结算直播中的回合。
- 修复共享数据库后端启动、项目重复删除的冲突返回，以及调度器无动作与信箱重放的收敛。
- 修复 Mission 唤醒来源投影和 Mission Task 发布收敛。
- 修复 Overlay 的任务流切换、启动器任务布局、子 agent dock 实时跟随，以及稀疏 K 线在首次插入时不可见的问题。

## 0.0.38beta - 2026-08-09

### Added

- 增加 Provider 错误凭据脱敏契约，防止 API Key 和 Bearer Token 进入诊断消息与响应正文。

### Changed

- 将 workspace 的 Bun 类型依赖和独立决策站点的包管理器规范统一到 Bun `1.3.14`，重新生成依赖锁定结果并移除旧 Bun 类型 package。
- 退役旧 benchmark 执行树及其专用测试与 CI job，把仍在使用的浏览器停滞检测迁移到当前脚本路径，并保留 Host MCP（Model Context Protocol，模型上下文协议）的真实连接统计契约。

## 0.0.37beta - 2026-08-08

### Added

- 增加签名桌面热更新通道，并由发布矩阵统一生成和发布跨平台更新清单。
- 建立根更新日志，并在发布流程和中英文 README 中提供唯一入口。

### Changed

- 在中英文 README 顶部加入下载入口，直接指向按平台选择桌面安装包和命令行运行时的说明。

### Fixed

- 在共享启动流程中显式初始化原生 Task 进程模式，保持命令行与桌面打包运行一致。
- 打开模型选择框时刷新模型，进入 Providers 时刷新 Provider；刷新失败写入应用日志并保留界面可用性。

## 0.0.35beta - 2026-08-07

- 本版本是更新日志的记录起点；更早版本不在此倒推补录。
