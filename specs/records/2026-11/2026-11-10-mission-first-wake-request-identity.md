# Mission 首次启动重发的项目作用域和执行目标

## Recall

用户要求持续分批迭代，最新明确本人独立工作，不使用子 agent。每批根因和影响先落盘，再实施、聚焦正向检查、真实桌面与本人截图复核、范围提交、合并和普通推送。B157 fb28fe282 已正常推送，本地/上游 0/0，原 177 项 Git 状态保留。已读根 AGENTS、[B157 终态与读者](2026-11-10-retained-execution-owner-and-readers.md)、[B156 手动草稿](2026-11-10-mission-draft-creation-replay.md)、[B153 真实透明重发](2026-11-10-local-environment-save-acknowledgement.md)、02-data/03-control/07-panel、Task control 与 runtime readiness。全仓搜索 MissionWakeInput、newMissionID、findExistingMissionSession、ensureMissionSession、requestID 和精确 operator Message/Part、Mission 关闭/删除/恢复、所有 wakeMission/CLI/SDK 调用、项目目录身份、overlay 创建表单与 composerSubmission。读了首次启动和续用目标、dispatch、持久 wake、公开 API（Application Programming Interface，应用程序接口）文档与测试。无委托，无真实 Provider 凭据；实证模型仅为配置到本机关闭端口的隔离 catalog，验收针对接受及执行轮次身份，不把模型报错当根因或真实模型验收。

## 证据、根因和影响

隔离开发服务 39368，两组完全相同的无 missionID、带 requestID 的真实 POST /mission/wake，各串行/并行送达两次。四次 HTTP（超文本传输协议）200 返回四个独立 Mission 与 Session，SQLite 精确查到四个独立真实 User Message 和四个独立 mission.execution.opened、两个原业务标识；明确请求及持久模型均是 b158-loopback/offline，用量事件为 0。真实桌面看板显示四条，对其中一条真实打开可见用户消息与隔离模型的预算错误（本批没有模型成功验收）。对照真实同 Session：显式发送最早接受的 missionID 和相同键，返回同 Session；同目标变更正文返回 MissionExecutionWakeInputConflictError 409；实际 abort 后对显式目标重发返回 MissionExecutionWakeClosedError 409；仍不提供 missionID 的同键却得到新 Mission 和 200。见[基线证据](../../artifacts/2026-11-10-mission-first-wake-request-identity/README.md)。

路由先用每次随机 newMissionID 生成 Mission，查/建 Session 后才将业务 requestID 交给 openMissionExecutionWithWake；既有稳定的 Message、Parts、controls、opened、close、activation 以 Session/source/request 为边界，无法合并随机不同的 Session。现有 ensureMissionSession 的并发锁、SQLite 唯一 (Project,directory,Mission) 和 Session 创建事实对同 Mission 工作正常；稳定 Message 主键发生在目标已经分裂之后。前端 Composer 有持久草稿提交 ID，仍受同缺口；Mission Board Start now 与单次快捷调用未必送 ID。HTTP 追踪 ID 是单次传输观测，并非固定作者操作。不能通过消除重复界面行或限制模型工具解决。

影响：Mission 首次公开 /mission/wake、工作台 AI 启动、Composer、CLI（命令行界面）和客户端文档、项目身份、已接受输入及 closed/deleted 边界，多个 Project 和目录的隔离。同一 Project 移动时复用 B156 已经实证的项目内相对作用域。已有 Mission 的显式续用、手动草稿的 dispatch、Task、Automation 调度和公共 Session input 仍走原有路径。此次无新增 SQLite 格式或迁移：新 ID 符合现 MissionID 约束，通过现有事务和真实 Message/事件形成唯一事实。已有历史随机 ID 无法从两条相同文字安全推断哪条应合并，不改动，不建立旧映射。用户/模型文字、权限、调度状态机和发布流程无改。

### 共享轮次横向审计

已对照独立项目和匿名目录分配、Task 全局/项目创建和输入接受、Session project/global 创建及 Chat Start/后续 Message、Mission draft/dispatch、已知目标及无目标 wake、事件/定时唤醒、正常及终态、恢复代码。B154–B157 提供其他分支已证实的串并行、重启、已删除持久事实；B157 的三个共享删除入口有实际服务和恢复测试。Mission 显式目标现在有本批真实 active/change/abort/closed 对照，重发目标断点被证实，不能归因于模型、专家团或单个项目。后续实际检查本批同键串并行、两项目、持久已接受、关闭/新键、重启与桌面。尚未完整复现实服所有成功模型路径；Task/Automation 的现接受合同保留。SessionWake 的已持久 Message 重放依然先解析可变模型/专家团配置，这是已有的另一审查点，本批不改变模型选择/激活流程；验收在同一配置下，不能外推到 catalog 下线。全局无项目 Composer 的项目分配由现 workspace owner 先独立完成，本批只保证已确定 Project 的 wake HTTP 重发，不扩展无项目分配。

## 实施及验收计划

1. 在进入 ensureMissionSession 前，首次请求按 B156 的同一个 Project 代次、规范目录作用域与作者 requestID 推导合法 wake- Mission ID；同一字符串跨项目独立；未给 requestID 的 HTTP 调用分配单独本次业务键，继续走同一目标算法。已给 missionID 的调用保留原目标规则。保留原 Session/Message 唯一写入、专家团与模型预检、真实流式执行、关闭及删除分支；逻辑首次回执的 created 仍表示该请求是首次创建意图，同请求复用同一 Mission/Session。避免无证据扩大到新 SQL 或第二分配数据源。
2. Mission Board 既有表单提交身份同时覆盖手动/Start now；在同一已开表单同作者输入失败重试保留键，改变输入或新开表单新键，复用现反馈和输入保存。wakeMission 保留现 composerSubmission 及明确指定键，单次调用否则生成业务键；CLI 也为一次执行提供键。同步生成 SDK（Software Development Kit，软件开发工具包）、双语 API 与 Mission 示例文档；不新增文案。
3. 聚焦正向后端用真实路由/存储查 Mission、Session、Message、opened 归属：串并行、显式继续、同一键输入冲突、closed 与已删除、两个项目、正常重启；本地产品不使用外部模型。真实桌面用实际 Start now 与本地代理截断首次成功回执再点击重试，查看唯一 Mission 及真实输入消息，核对实际业务键、两次回执和数据库；必要时补以单独已接受会话打开。先落盘本方案再改产品。

## 实际验收

- 真服务 39370：相同作者键串行和并行各返回原 Mission、Session 及首次回执。同键在第二 Project 分开；两个未传键的独立调用也各自接受，不合并。显式继续返回同 Session、created=false；同键改正文 409；abort 后未指定目标重送也得到原 409；另一次明确新建相互独立，删除后重送返回 404。实服正常重启，活跃接受身份、原 User Message、closed 的事件和删除后 404 均保持。
- 真实 1280×720 桌面在 39372 通过代理加载最终开发构建。本人填写 Start now、Work 与 Dynamic，第一次上游 200 后只下发 16 字节。界面保留原输入并提供重试；再次明确点击后导航到原 Mission Session，真实 User Message 原文可见。返回 Tasks 搜索只出现一条。同两次实际 POST 使用一个业务标识、两个 HTTP 跟踪 ID，200 回执的 Mission、Session、created 一致。隔离模型预算诊断实际显示，本批没有验收模型答复。
- SQLite 版本保持 12，完整且无外键问题。两个 Project、7 条 Session 对应实际隔离意图；每条只一个用户启动 Message 与一个对应 opened。已关闭和删除的审计事实保留。模型用量、Task 和定时 Run 都为 0。两份隔离项目笔记及 Git HEAD 保持。
- 聚焦后端首次启动 1 项 / 11 断言、现有 wake 轮次 3 / 4、手动草稿 1 / 11；工作台请求 3 / 10、composer 接受 9 / 39。工作台和后端类型、工作台构建、SDK 生成、双语文档及路由、架构检查通过。没有界面自动化。本人服务 39368、39370 及代理 39372 已正常关停。详见[截图与回执](../../artifacts/2026-11-10-mission-first-wake-request-identity/README.md)。
