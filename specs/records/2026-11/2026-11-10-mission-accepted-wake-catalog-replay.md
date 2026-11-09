# Mission 已接受请求在模型目录变更后的重放

## Recall

用户要求持续分批迭代，最新要求独立工作，不使用子 agent。每批先落盘根因和影响，再做实证修复、正向检查、真实桌面交互及本人截图复核、范围提交、合并并普通推送。B158 `4260a368c` 已推送，本地与上游 0/0，原工作区 177 项保留。已读根 AGENTS、B158 [首次目标](2026-11-10-mission-first-wake-request-identity.md)、B157 [保留终态](2026-11-10-retained-execution-owner-and-readers.md)、B156 [草稿](2026-11-10-mission-draft-creation-replay.md)、B154–155 会话和项目分配记录、02-data/03-control/07-panel、Task control plane 和 runtime readiness。全仓检索 `openMissionExecutionWithWake`、`acceptedMissionDispatchPrompt`、`exactOperatorRequestClosure`、`PersistedWakeReplay`、`wakeWithReceipt`、`resumePersistedWakeWithReceipt`、`validateConfigModelReferences`、Expert Squad projection、附件物化、Provider 投影及公共调用，已读取 HTTP（超文本传输协议）路由、工具 panel、Session loop/owner、Mission recovery、Task ingress、Automation、Event、Scheduler Message 和持续目标调用。无委托、外部凭据或真实模型请求。模型样本明确配置到本机关闭端口，保留实际模型错误；本批验收为已接受输入/轮次，不评价模型能力。

## 现象、根因、影响

在真实隔离开发服务 39374，通过实际配置路由给两个 Git Project 配置两个明确的本地模型。实际 `/config/providers` 证明目录中有 b159-retired/offline 与 b159-current/offline。首次 wake（显式及省略模型）、手动草稿 dispatch 和单独关闭用例实际接收并留下每条一个 User Message 与一个 opened 事件。更换主 Project 默认模型并删除旧 Provider 配置后，仅主 Project 的实际投影下线旧模型。相同键和内容的首次 wake（串行、并行、显式目标）、dispatch 都由原 200 变 400；已关闭同键由 `MissionExecutionWakeClosedError` 409 变 400；已接受同键换正文也被 400 遮盖。未接受的旧模型新请求 400 是正确行为，新模型新请求 200 且真实 Message 模型为新模型；省略模型的已接受请求、第二项目原模型原样重发仍 200。SQLite 查到 2 项目、6 Session、6 User Message 及原 opened、完整的 closed 事件和可见已结束的失败答复；无 Task、Automation 或 Provider 用量。桌面真实打开旧派发，看到原文、真实已结束诊断和原模型标识。[基线记录与截图](../../artifacts/2026-11-10-mission-accepted-wake-catalog-replay/README.md)。

B158 修正首次请求找同一个目标，未改变模型预检顺序。wake/dispatch 路由在读/比较同一已接受的 Message、Part、opened 和对应 terminal 前，先调用当前 `validateConfigModelReferences` 与 `resolveAgentModel`，wake 显式传 Squad 时也重查活动目录。dispatch 旧读法只提取接受的草稿正文，随后仍先预检。共享 `openMissionExecutionWithWake` 先准备可变 Session 配置后才检查身份；实际输入写入层的 `PersistedWakeReplay` 只有经过 `SessionWake.wakeWithReceipt` 的模型/Agent 预检才可达。这是已提交事实与新请求预检的时序错置。持久身份为 Project 内 Session + ingress source + 业务 requestID 的 Message/Part/control 和现 opened 绑定；当前 catalog 只决定新输入与实际模型执行，不能替换原接受或终态。已接受的旧显式模型仍真实留在消息；不能改成新默认模型、补写一条消息、删除原结果或声称旧模型重新可用。

影响面：首次和显式目标 wake，草稿 dispatch，CLI/工作台/生成 SDK（软件开发工具包）经现 API 使用者，面板 `wake_mission` 与已保存 Tool Part 恢复共用入站；无新 UI 文案，无变更公共请求/响应结构或持久 schema（结构）。Attachment（附件）继续由现项目归属及内容身份验证，已接受的原始正文、模型、Parts 与配置/持有 Squad 上下文仍通过原匹配合同；不引入第二套 fingerprint（指纹）、重放映射、数据库或迁移。首次输入仍验证模型、专家团以及可持久化的上下文。强制关闭/删除/重开、并发事务和运行所有权是风险重点。

### 共享轮次横向审计

Mission 全部 operator 生产入口（两条 HTTP 路由及 panel 新建/Tool Part 恢复），同目标已接受/输入改变/关闭/删除/首次提交，并行和第二项目已由上列实际路由及持久证据对照。Expert Squad 显式名单的现解析器在进入目录时按原序验证所有 ID 且不允许未知或不兼容项，接受后相同名单可依据 Session 已持有集合按原输入语义比较；不修改执行期实际 Squad availability。Task 新建已有带键接受回执读取与纯调用比较，后续 operator note 接口自身没有本批 Mission 的业务重放键，新输入才预检配置后原子提交；Session 全局 Chat/Work 首条接受、后续 Message 分别读现 Message/control/占有事实，已持久的 global Chat 直接复用 SessionWake 的 persisted owner。Mission process recovery、Automation、Event、Scheduler Message 和持续目标的已持久分支也直接复用该 owner，并以原 run/fire/delivery/goal/closure 绑定校验；新的 scheduler 投递仍完整预检，不把旧输入当新工作。B154–B158 的真实串并行、重启、终态、项目隔离证据与本批实际对照共同定位到 Mission operator 这一共享入站；不能以模型输出或单个 Squad 归因。未在本批重新触发全部定时器业务链；按直接依赖补聚焦的调度与 recovery 契约检查，记录范围。面板真实模型工具触发需真实模型授权，当前仅验证共用持久路径和已有测试。

## 实施及验收

1. 扩展 Mission operator 命令的同一入站：按确定的 Message/Part 身份读取 Project lineage 的真实已接受输入和对应 opened。dispatch 直接从接受的真实 Part 取原正文，未接受时才读取当前草稿。先比较当前提交者意图的原有 fingerprint 与确切 Message/Part，保持 changed 与 exact closed 的类型和优先序。已打开的 exact replay 接入现 `SessionWake.resumePersistedWakeWithReceipt`，保留 Prompt owner 的事务围栏和运行期观察、原 Message、默认不重试已失败答复；不再走可变 preflight 或 overlay 写入。保留首次提交原子化及事务里竞争赢家检查；允许预检开始时尚未接受的并发请求按当时的新输入合同失败，下一次原样重发按已提交事实。已删除目标沿当前 404。
2. HTTP wake 已有 Session 对已接受的显式 Squad 用持有集合校验，不重查目录；保持产品线、选中名单语义和原输入比较。全新目标在分配前验证模型/目录，现目标的新输入在原子接受前验证当前模型/目录。HTTP dispatch 同样只验证新输入。面板继续用已冻结模型和真实 Tool Part，不修改其创建事实。生成 API 描述及双语文档、维护当前架构。
3. 复用基线数据库重启真实候选；同键串并行、显式/首次、隐式模型、dispatch、变更、已关闭、当前模型新请求、原模型新请求错误、第二项目。对照原 Message 和打开/关闭事件、真实已结束的 Assistant ID、配置 overlay，记录重启。真实桌面通过本地透明代理在第一回执成功后截断并切换隔离 Project 目录，使用同一表单重试，截图查看同一 Mission/原正文和持久诊断；如界面模型选择不直接支持显式启动，就用已有会话接受消息与真实公开 API 双证据，不能用合成消息或 UI 自动化测试。聚焦后端合同，运行类型、文档和拓扑检查。真实 GPT-6.1 Sol 不用于已提交回执与本地目录删除合同，模型效果不列入本批通过项。

## 实际验收

- 在原基线 SQLite 上用 39376 启动候选，并正常重启。原明确旧模型 wake 的串行/并行/显式续用、原隐式模型和旧草稿 dispatch 都返回原目标；已关闭返回相同关闭事件的 409，已接受键修改正文或模型返回各自的输入冲突 409。第二项目保留原目录和原目标。新键使用已下线模型仍返回原 400；独立新 Mission 使用当前模型 200，真实 User Message 投影对应新模型。
- 桌面不是表单模拟：本人进入隔离第三项目，在真实工作台选 Work · Mission 和明确的旧模型，填写并发送。代理只截断第一次真实上游 200 回执的响应体。页面保留原文、模型和发送控件。本人再次发送时，代理先经真实配置接口下线旧模型，实际投影只剩新模型，再原样转发。两个不同 HTTP 跟踪 ID 对应同一业务标识和输入，两次上游 200 返回同一 Mission/Session。桌面打开原消息、原诊断、原模型，看板搜索只一条。原模型的真实失败答复和其父消息均保留；没有真实模型调用或验收。
- 六条原 Session 的 Project、原始 User ID 与模型、配置覆盖、opened/closed 和原 Assistant ID 在初启与重启完全相同。SQLite 版本 12，完整、零外键问题；初启/重启证据为 3 项目、7 Session、0 Task/Automation/Provider 用量。之后独立新模型对照的准确目标和模型见桌面接收记录。
- 正向后端 Mission wake、dispatch、执行轮次、进程恢复 9 项/50 断言；Panel 原 Tool Part、Automation/事件执行轮次及真实 owner 契约 4 项/11 断言。后端类型、SDK 生成、路由、文档及架构索引通过。未新增或运行界面自动化。所有本人隔离标签页、服务和代理均已关闭。详见[证据索引](../../artifacts/2026-11-10-mission-accepted-wake-catalog-replay/README.md)。
