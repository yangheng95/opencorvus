# Mission 手动草稿创建的请求身份与原子提交

## Recall

持续按批迭代，本人独立工作，不使用子 agent。每批独立并行读代码、取接口与页面证据，根因和影响先落盘；实施后走真实桌面、本人截图复核、聚焦正向验证、范围提交、普通上游合并及推送。上一批 f68e4c6e6 已推送，上游 0/0，原 177 个 Git 状态项保留。只使用本人隔离目录和开发服务；草稿不执行，本批不读取凭据或模型目录。已读根 AGENTS、[全局会话分配](2026-11-10-global-conversation-creation-allocation.md)、[本地环境保存重发](2026-11-10-local-environment-save-acknowledgement.md)、[表单回车归属](2026-11-09-form-search-enter-ownership.md)、当前 02-data、03-control、07-panel 和 Task 控制架构。已读 MissionCreateDialog、MissionBoard、main 和 mission 客户端、服务端 draft/edit/dispatch/wake、Session 单写入/事件、Mission 运行目录、保留和删除事件、项目迁移及数据库 trigger/migration。全仓查 mission.createDraft、ensureMissionSession、setMissionPendingPrompt、requestID、Session.deletion、Mission 快照和创建时写入；生产手动创建仅此入口，现有 pending setter 的其他命中是测试和恢复样本；没有运行或引入界面自动化测试。没有委托。

## 修改前现象与根因

版本 11 的真实隔离开发服务 39354 中，POST /mission/draft 两组相同业务正文各发送两次（串行、并行），全返回 200，但得到四个不同 Mission ID、四个不同 Session ID。真实 GET /mission 与数据库独立确认四条待执行草稿；同一 Project、同一请求原文、同一专家团 dynamic；Message、Task、定时 Run 和模型使用均为零。桌面 1280×720 在 Tasks 看板看到两对同名卡片、Backlog 4，打开其中一张进入其独立草稿会话；侧栏也显示重复。数据见[基线与截图](../../artifacts/2026-11-10-mission-draft-creation-replay/README.md)。这是两次真实送达实验；真实浏览器丢响应后透明重发的先前证据见本地环境批次。

直接触发是手动草稿没有业务请求标识。对话框 submitting 只压制本次挂起期间再次点击；服务端 /draft 接受后用每次新随机 Mission ID，Session 事务内的唯一性和进程内锁只认这个新 ID。现实现依次提交初始 Session、标题、待执行请求；旧的 Session 事务未包含后二者，并在返回前等待文件目录物化，任一中途退出可留下部分草稿。该写入间隙由控制流确认；基线未人为制造部分数据。路由、Work Ledger（工作账本）和 Mission Board（任务看板）都读实际 Session，不能用前端去重或限制同名标题处理。既有 draft edit 的 compare-and-set 针对现有待执行请求；dispatch 的 requestID 针对同一已定位 Session 的执行输入，均无法给首次创建补身份。

本批影响公共 HTTP（超文本传输协议）参数/错误、SDK（软件开发工具包）、真实作者重试、Mission Session 发布初态、文件目录物化与重启、专家团可变目录的重发顺序、更新/归档/删除之后的结果、独立项目和目录。产品页面复用原创建反馈和失败诊断，输入和请求原文保留。已存在草稿不改、不合并；不是执行轮次变更，不增加调度或唤醒条件。项目从匿名位置迁移时保持 ID/代次、Session ID 和同一相对目录；必须避免重发分配新草稿。已读 Session.relocateProject，它同步改真实目录与 metadata.mission.cwd、保留其余元数据。外部工作树以独立目录作用域保持隔离。版本 12 用两个新冻结触发器声明作者绑定的形状和不可变性，以版本化升级保留旧数据。无版本发布、模型、权限或新增页面词条。

### 共享边界的横向核对

现有 Chat/Work 的项目内创建与全局创建分别有 B154/B155 的真实串并行、重启和删除证据；Session 首消息、Task 创建从既定 Message/请求及 Task 创建合同接受，不能以其运行证明草稿创建。Mission 的 draft、edit、dispatch、已有 missionID 的 wake、首次 wake、后台恢复及归档/删除分别核对：草稿无执行，edit 有版本比较，dispatch/已有目标 wake 由 Project/directory/Session/source/request 的已接受事实绑定；关闭、删除和进程恢复按现有 owner/事件归属。同一 POST /mission/wake 不传 missionID 会在计算作者 requestID 前分到新 Mission ID，连带首次执行可能绕过同一已接受事实；看板 Start now 当前也不提供固定键。公开 Automation Run Now 与工具触发也各有入口：工具基于调用因果，公开路径当前只在未收敛期间拒绝并发、结束后新建 fire。这里均为代码线索，未用真实模型触发成功执行，不据此声称运行轮次重发或终态已覆盖。后续保留独立实际复验项目：Task/Mission/Session 全部生产入口和正常/终态、重试/重启、串并行及多项目；发现真实执行异常即按共享机制处理。当前只改已实证的无执行手动草稿。

## 实施与验收方案

1. /mission/draft 新增可选业务 requestID。浏览器实际保存总是传入，在同一开启表单上按目标、标题、正文、类型与排序后的专家团选择保留最近一次提交身份；修改后提交或关闭再开启产生新意图。HTTP 追踪 ID 不作业务键。不带键的公开请求每次仍是独立意图，通过同一实现。首次草稿用 Project 代次、规范目录作用域和请求标识确定 Mission 与 Session；项目内部用相对工作目录确保搬迁保持身份，外部工作树单独隔离。保留现 Mission ID 路径约束，接受读取验证实际目录与项目所有权。
2. Session 是单一持久归属。复用现 Mission 准备与 Session 插入/发布，将作者绑定、标题、待执行请求和当时已解析专家团一次提交；调用前先按作者身份读取已有 Session，事务内复核竞争。绑定仅存版本、requestID 和规范作者输入指纹，不另存原文；明确提供的专家团按集合语义排序，省略是单独输入。重复同一合同返回当前 canonical Mission，不覆盖以后编辑、归档或消耗的草稿；不同输入/所有权与删除进行中返回有类型 409，终态删除按 Session tombstone 返回 410。继续复用已有文件目录物化和删除互锁；提交后物化失败可由同一请求重试恢复同一目录。目录读取/租约/持久删除保持单一权威。
3. 版本 12 只追加声明，不修改旧迁移；现有行不填伪造身份。更新接口、生成 SDK、双语 API（应用程序接口）文档、02-data/03-control/07-panel。用正向后端检查覆盖串/并行、项目隔离、改变输入/删除的明确错误契约、修改后重发、在目录物化点读取已经完整的 Session；检查当前读者、已有 Mission draft edit 和版本升级。真实开发服务用相同请求、重启、删除仅本人隔离样本；需要时用本地代理丢失首次响应，只记录无敏感草稿输入与真实状态。真实桌面手动保存或重试、查看成功与看板唯一卡片、打开正确原文，人工截图。验收约束为零执行、零模型；覆盖程度以实际证据为准。

## 实际验收

- 实际开发服务将复制的版本 11 数据库升级到 12。自动备份和目标库均完整、外键一致；新增写入前，4 条旧 Mission Session 和 1 条 Project 在两个库的每列和物理行号都与原库一致。原始两个隔离 Git 提交及笔记保留；另用空库直接启动到 12。
- 同一作者请求串、并行返回同一 Mission/Session；同样正文明确新建、同样键跨项目各有独立身份。编辑后的重发读取现正文，改用同一个键提交修改后的原始输入返回类型化 409；归档后的重发保留归档，恢复后保留编辑正文。实际将隔离匿名项目转为命名项目后，用新目录重发得到原 Mission、原 Session 和原文，项目文件保持；正常重启后主项目、第二项目和迁移项目保持这些身份。
- 两个真实桌面分别截断第一次成功响应的正文，只送 16 字节；真实对话框提示输入已保留，再点击「Save draft」得到成功回执。两个实际到达的请求使用同一作者键、各有独立 HTTP 追踪 ID，两个上游 200 返回同一 Mission 和 Session。干净档明确只有一张 Backlog 草稿；点击「Open Mission」打开该会话并复核原文。实服 /mission 与 /work-ledger 返回 200，干净库实际只保留一个 Project 和一个 Session。
- 删除回放的范围：隔离库实际观察首次 DELETE 新草稿、旧版本草稿均先写关闭事件，然后 HTTP 返回 500。新草稿的实际堆栈显示缺少 Project Instance 上下文；已有运行恢复最终写入同一关闭/删除事实。重复 DELETE 已接受，重复 POST 草稿得到类型化 410，重启后仍为 410；这证明本批重发不复活已删除草稿。与此同时常用 /mission、/work-ledger 都因选择到保留的已删除 Session 行返回 404，归档账本返回 200；真实图 05–06 留存。已对 Mission abort/archive、Task cancel/delete、Session delete、恢复和列表的共享入口开始横向审计。删除首响与普通读取作为独立下一批优先处理；本批不宣称首次删除已修复。
- 聚焦检查：新后端集成 1 项 / 11 断言、既有 draft edit 1 项 / 29、Mission Session 4 项 / 32、迁移 25 项 / 81；工作台请求 3 项 / 10。后端和工作台类型、构建、路由、文档、架构、迁移对象检查均通过。没有界面自动化测试。两份验收数据库无消息、Task、定时 Run 或模型调用；本人开的服务和代理已关闭。见[截图与回执](../../artifacts/2026-11-10-mission-draft-creation-replay/README.md)。
