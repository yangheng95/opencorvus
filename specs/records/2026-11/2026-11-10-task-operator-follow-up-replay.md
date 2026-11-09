# Task 跟进重发复用已接受的消息与轮次

## Recall

用户要求持续分批迭代，最新明确由本人独立工作，不使用子 agent。每批先落盘根因、影响与方案，再做有证据的改动、正向检查、真实桌面截图人工复核、范围提交、合并并普通推送。B160 `38fa00858` 已推送且上游 0/0，原 177 项工作区状态保留。已读根 AGENTS、[B160 回执提示](2026-11-10-composer-delivery-uncertain-feedback.md)、[B159 Mission 重放](2026-11-10-mission-accepted-wake-catalog-replay.md)、[B157 保留终态](2026-11-10-retained-execution-owner-and-readers.md)、02-data/03-control/07-panel、Task control-plane、runtime readiness 以及既有 Task operator 原子接受和真实交付验证。全仓搜索 TaskMessageInput/Result、/task/:taskID/message 与 inject、所有 appendAndWakeTaskOperatorMessage/buildTaskSessionMessageBundle、TaskRootMessageProvenance、Session Message Move/Task project lineage、persistTaskRootMessageIngressInTransaction/dispatchPersistedTaskLoop、scheduler/goal/Mission/worker steer、持久 schema（结构）版本和公开 SDK（软件开发工具包）、CLI（命令行界面）、客户端调用。无委托、外部凭据或真实模型。隔离模型 b161-review/offline 明确投影到关闭的本机端口，本批证明实际接收、移交与轮次身份，不评价模型产出。

## 现象、根因和影响

真实开发服务 39384，两个独立 Git 项目和两个 Task。公开 /task/:id/message 对额外业务 requestID 返回 400；同一正文、来源、模型的合法请求各串行/并行送达两次，四次 202 生成四条不同真实 User Message。另一个项目同内容有自己的独立接收。Task 正常结束为 failed 后，按完全相同内容再次发送两次，真实接受事件先后把原 Task 从 epoch 1 打开到 2、再到 3，每次有新 Message 和 ingress ID。SQLite 保留两项目、两 Task，主 Task 六个独立 operator ingress 分布在 1/1/1/1/2/3，对照项目一个；无外部 Provider 用量或 Automation run。真实桌面打开同一 Task，原样看到两组重复正文及原模型诊断。证据见[截图与数据库](../../artifacts/2026-11-10-task-operator-follow-up-replay/README.md)。

根因是发送端对 Task follow-up 没有把既有 composerSubmission 业务键交给服务，严格 HTTP（超文本传输协议）输入也不接收该键。服务在决定接受输入、应用配置、appendTaskRewindCleared、终态 reopen 和写 ingress 之前就为每次调用生成独立 Message ID；现 (Task,source,source_id) 唯一索引只会去重同一个已经分配的来源，无法识别本来就是同一次作者操作。不能用正文哈希直接去重两次合法相同要求，也不能用最后的模型错误、状态、请求追踪 ID 或 Task 名称确定作者重发。

关键实际数据：epoch 2/3 接受的两条 Message 初始回执属 Task 根 Session，随后由原交付路径移到同一 Task 的 Orchestrator 子 Session；Message ID、实际内容和 ingress 始终不变。现 DDL（Data Definition Language，数据定义语言）只豁免同内容原 Message 的这一物理移交，原接受事实不可改写。只按根 Session 查重会漏掉已交付请求、再开一轮。通过不可变 Task ingress + 原 Message 主键 + 原 Project 与 root/Orchestrator lineage 读回它的真实当前位置和真实 Parts，使用现投影，不能创建合成回执或根会话影子消息。回执固定的是原 Message/ingress 身份和接受事实；其可见物理位置随合法移交前进。

影响为标准 Task follow-up HTTP、主输入的 Task 分支、CLI/SDK 和双语说明，以及现原子接受/轮次、归档/删除、消息移动、并发和升级。保留未给业务键的每次请求为明确独立操作，已有历史消息无此键，不猜测补配或合并。该新持久 provenance 字段通过现迁移器和约束加版本。没有任何调度状态机、模型路由、提示词、外部写入或发布变化。

### 共享轮次审计

Task 创建有 Project 级业务身份，公开 follow-up 与注入都走同一根消息 primitive；注入是显式独立动作，不改变其公共入参。Mission/Orchestrator Tool 注入、持续目标和 scheduler/event/Automation 现以 Tool Part、Goal request、Fire/delivery 等真实来源绑定根 ingress，非 operator 不能获得终态重新打开权；Mission wake/dispatch、普通 Session Chat/Work 有各自的已持久身份（B154–B159 验证多个项目、并发、重启和终态）。Task worker steer 保持自己原作用域和 request identity。原 Task 控制面已按精确 epoch/FIFO（先进先出）及 Project 领有扫描；删除在 retained Task tombstone 下保持原 fact 并阻止重新打开。基线现象由同一 root ingress 写入独立 ID 以及已实际触发的两个 reopen 证实，非单项目、单专家团或模型行为。当前未重新跑全部 scheduler 模型业务链；候选用直接依赖的调度、Task 生命周期和真实 cold restart 对照。若实际发现更广的持久身份或运行所有权问题，更新此规格再改。

## 实施及验收

1. 公开 Task follow-up 增加可选稳定 `requestID`（trim 后 1–200 字符）。未给时在同一接受路径分配一次单独键。由 Task ID、根 Session ID 与业务键推导同一个 Message 主键，在现 Task-root operator provenance 保存版本 1 作者键和原调用语义指纹。指纹只取实际提交的文本、来源、明确模型（无则 null）、附件内容/规范引用、元数据及既有请求用户身份字段；不使用当前模型、配置或渲染 envelope（封套）。附件复用现 Task 调用的纯输入身份，原件写入仍用原 Project owner，不补造数据。以现根 Message/ingress 原子提交为唯一事实源。新增数据库版本 13 保护该可选字段的真实写入形状与 Task 根归属，现 accepted Message 内容保护已覆盖之后不可变；保留原版本 12 业务行、行号、迁移备份和同一 ingress/移交权威。
2. 先在当前 Project/Task lineage 下查确定 Message 和绑定的不可变 ingress；已接受的精确重发在可变模型与配置预检之前返回同原身份的 202，并沿现 detached scan 通知实际已持久工作，不主动重新打开轮次。输入漂移返回 typed 409；Task 显式删除或跨项目沿现 404。新请求仍预检模型/附件/配置，并用一个 immediate transaction 在写入前再检查同键赢家。若首调用和竞争者都进入预检，最终由数据库赢家决定，现配置/附件、rewind、epoch、Message/Part、TaskMessageRecorded 和 ingress 仍在同一次原子写入；已接受路径不重做这些效果。用真实 Message/Parts 的当前根或 Orchestrator 位置产生现投影，轮次随后进入现运行所有权。
3. 工作台的 Task 分支发送前用相同 canonical payload 与现 scoped composerSubmission 保存相同的键，只在真实 202 后清当前作者输入；Task Stop 的已接受取消应像其他入口一样退休相符的未确认键，保留原文，并保持实际 scope。CLI 支持明确键及一次生成的默认键，生成并维护 SDK 与双语文档。保留当前 Task inject 等其他调用的既有语义。
4. 复用真实版本 12 基线数据库升级并冷重启，核对历史 Task/Session/Message/Part/ingress/Move/terminal 原身份及备份，另验收从零初始化。真实请求核对首条、串并行、真实已交付后的同键、模型目录下线后 exact replay、内容改变、取消/失败后原键及新键、已删除、第二 Task/Project、匿名键分开、重启后原接受身份。聚焦正向后端契约、已有共享 root/scheduler 检查、工作台纯传输契约以及 SDK/数据库/文档检查。已有涉及失败注入的聚焦测试保留明确错误响应和完整原子成功契约，若有过期负向主断言，按当前正向事实改写。真实桌面从 Task 原会话发送，经本地代理只截断首次 202，再从同输入重发；本人截图检查两次业务键、真实原消息、单份 ingress 和终态不会意外 reopen。没有界面自动化，不把隔离模型失败当 GPT-6.1 Sol 模型验收。

## 实际验收

- 基线真实开发服务 39384：同内容的串行/并行两组分别形成不同的 Message/ingress；失败后再次提交从 epoch 1→2→3。实体 Message 的物理所属 Session 真实改变，原 User ID 和 ingress 仍可核对。
- 用原 SQLite 12 数据库实际启动 39386，自动备份升级到 13。原独立 v12 副本与迁移备份的 2 Project、4 Session、2 Task、17 Message、17 Part、9 ingress、79 协议事件逐行及 rowid 一致；当前库还保留旧 root/owner、Message 内容、Part 和 ingress。独立空配置 39390 实际初始化 0→13，新 Task 的两个并发同键 202 收敛成一个 Message 与一个 ingress；两库完整，无外键问题。
- 候选主 Task 的首次同键并发在原终态打开 epoch 4 一次。失败后以及原 Message 已真实移交时，原样重发仍是原 202 和原 ingress；下线显式旧模型后亦相同。改模型/正文返回具名 409，新键用已下线模型得到原 400。用可用模型和附件另发一条形成独立 ingress 及 epoch 5；本批未验收模型运行输出。该新输入回执仍带提交前解析的原 Message model 标识，虽已有新请求配置和新轮次；这是独立的输入模型标识调查，不计为本批模型正确性证据。第二 Task 同键独立、跨 Project 404；实际取消后同键返回原接收且保持原终态，删除后 404；不传业务键的两次明确独立。正常重启后，已移交旧接受的 Part、Message、ingress 与当前生命周期保持。
- 第一次桌面试跑发现服务先于工作台构建启动，仍提供旧前端资源，检查代理在上游转发之前退出，Task 仍是 epoch 1。仅重启隔离服务，实际确认最终资产 `main-CuRigCTg.js`。在真正的 1280×720 工作台，打开第二 Project 的已失败 Task，填写并发送一条跟进。第一响应实际 202，代理仅截断 16 字节；黄色未确认提示和原稿可见。等实际 epoch 2 已失败后手动重发，仍为同业务键、相同 Message/ingress，原 User Message 已从根移到 Orchestrator 子 Session；两次原始回执的物理 Session 均可核对。桌面只显示一条目标跟进，输入清空，生命周期前后字节字段一致，仍为同一个 epoch 2 的终态。没有外部模型凭据或实际 Provider 用量。
- 聚焦后端接受原子性、移交与 CLI 3 项/11 断言；直接 Task root/运行时 1/3；Automation/Event 2/5；工作台纯传输 10/45。后端和工作台类型、工作台构建、SDK、数据库迁移、文档和架构检查均通过。没有新增或运行 UI 自动化。关闭所有隔离页、开发服务和代理，已验证进程及端口退出。详见[证据索引](../../artifacts/2026-11-10-task-operator-follow-up-replay/README.md)。
