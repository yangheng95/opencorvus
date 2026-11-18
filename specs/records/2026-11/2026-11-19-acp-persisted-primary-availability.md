# 编辑器恢复真实主助手身份

## Recall

- 用户要求本人持续分批调查 UI（User Interface，用户界面）、功能和缺陷，先完整分析根因/影响并落盘，再实施、真实 Windows 桌面交互与逐张截图人工复核、聚焦正向检查、范围提交、上游合并和普通推送；明确不用子 agent。本批第 326 批。前批 `e33e2ff8f`、`636e098f8` 已推送，分支 0/0，原有 177 项工作区改动逐项一致。
- 已读根 `AGENTS.md`，当前扩展、角色、原件/配置和公共会话架构，ACP（Agent Client Protocol，编辑器客户端协议）的完整新建/加载/恢复/派生、角色选择和提示、初始化失败清理与连接状态恢复，PrimaryAssistantRegistry（主助手注册表）、角色合同及物化、会话身份解析、网页 Chat/Work（对话/通用工作）元数据和提示覆盖、会话派生及公共 Mission（持续目标）/Task（任务）权限边界。全仓搜索主助手 get/list、hidden（目录隐藏）过滤、`resolveAcpPrimaryMode`、`resolvePersistedAcpPrimaryMode`、六个 `loadPrimarySurface` 调用、列表分页、全部相关公开角色契约和历史决定。没有把此前附件回放记录的独立角色失败当作附件根因。
- 阅读 [ACP 会话列表](https://agentclientprotocol.com/protocol/v1/session-list)、[会话设置](https://agentclientprotocol.com/protocol/v1/session-setup)和[模式](https://agentclientprotocol.com/protocol/v1/session-modes)：发现的历史用于后续加载，加载回放真实历史，当前模式反映实际运行模式，客户端选择只能来自返回的可选目录。当前 SDK（Software Development Kit，软件开发工具包）仍是官方 1.4，不能为新文档中的其他能力增加旧协议兼容层。
- 验收：原生 coding（直接编码）新会话目录继续正常；网页 Chat/Work 空会话即声明其真实固定角色，已有历史的加载、恢复、派生和下一轮保持真实身份。普通会话已明确选择的隐藏主助手也能准确恢复，未选中的隐藏角色不进入通用选择器。原网页固定角色不能由适配器声称切换成另一角色；普通派生按真实目标身份及历史角色运行。重启、并发和多项目一致，公共 Task/Mission/Control（控制）入口权限继续由当前身份合同决定。
- 自有本机 `acp-review/local` 流式参与者，先核真实模型投影，实际请求精确 `local` 且流式。不用外部凭据、GPT-6.1 Sol 或子 agent。只通过真实开发网页 `/ui/`、官方协议客户端及人工截图验收，不新增/运行 UI 自动化。

## 真实基线

隔离开发服务 `40148` 新建四个真实根会话：原生编码 `ses_-zUOdDKxRzzv3lEj1TME`、网页 Chat `ses_h4lPv1sq8vbTndiFbSCM`、网页 Work `ses_hvPE3mBMZPKDsLN0zMCI`、普通会话显式 Chat `ses_-zUOdDJMTzz3WOzPy7uN`。网页元数据来自各自公开创建入口，普通 Chat 来自公开 `session.prompt(agent: chat)`，没有直写历史。

四个初始输入都正常 `stop/end_turn`。原生编码的 load/resume/fork 全部成功；另外三者全部返回 JSON-RPC（JavaScript Object Notation 远程过程调用）`-32603`，细节为对应 `chat/work` 主助手不可用。正常退出并重启同一库后，全部结果一致。列表却正确列出这四个根会话。

两个空网页会话在首次输入前 load 都成功，但错误声明 `currentModeId: coding` 和只有 coding 的目录；随后实际公共输入保存的用户 `agent` 分别是 `chat/work`。这说明适配器的声明与真实运行身份早已不同，不能只放宽一次加载来修复。

另一独立项目 `prj_hnNu2OopuYqQo54sJWYJ` 中，原生 coding 和网页 Chat 两个输入实际并发提交且都正常完成。其原生的三种恢复操作成功，Chat 的三种操作同样因目录隐藏失败。项目列表分别为 4/2 条根历史，全局 6 条；项目和会话身份没有混淆。本人在真实 Chrome 实际打开主项目 Chat 和 Work，原用户输入与助手正文均完整、空闲，角色标签分别为 chat/work。不是模型错误、缺少 Provider（模型供应方）、历史丢失或某一网页的附件问题。

## 根因与旧路径未根治原因

`loadPrimarySurface` 对唯一注册表的结果先过滤 `hidden !== true`，随后把这份“通用选择器可见目录”同时当作“真实主助手可运行集合”。`chat/work/control/mission` 在注册表中真实存在且有各自提示/权限，hidden 仅影响默认和目录展示；真实消息身份解析使用精确 `PrimaryAssistantRegistry.get`，并不把 hidden 当作不可用。故已合法产生的 Chat/Work 历史在 ACP 校验阶段被错误拒绝。

第二个数据流遗漏是目录读取不绑定目标 Session（会话），也不读取网页 Chat/Work 的权威元数据。空会话因此错误采用项目默认 coding，后续实际公开处理器仍按网页合同覆盖成 chat/work。普通 `Session.fork` 保留父链及真实历史，但不复制网页会话元数据，所以派生应按实际目标而非源网页假定固定角色。旧模型作用域、历史分页、消息回放和严格角色恢复修复各自保留了精确历史身份，但都没有拆开可运行集合与可选目录，也没有绑定这份目录的会话作用域。

## 恢复共性横向审计

| 范围 | 代码、持久事实与真实运行结论 |
| --- | --- |
| 所有生产入口 | `resolveAcpPrimaryMode` 与持久角色恢复仅 ACP 使用。六个目录入口为新建、加载、派生、恢复、切模式和提示。共享注册表其他生产消费者是精确角色 get、配置提示目录及公开角色列表，没有相同 hidden 可用性过滤。统一修 ACP 的目录投影，不能分别针对 chat 或某次失败做例外。 |
| Session occurrence（执行轮次）与终态 | 六个真实输入的用户/助手身份和正常 stop/end_turn 可核对；原生恢复成功，隐藏角色恢复在执行前失败。失败初始化恢复原连接快照，失败派生清理新目标，源历史保留。最终需只读库核对所有权、终态及清理事实，不凭错误标题或单场景通过判断。 |
| 重试、重启、串并行及项目 | 同库正常重启重复失败；独立项目并发两轮亦为同一角色差异，列表 4/2/6 和持久 projectID（项目标识）各自正确。候选继续实际重启、并发和多项目，不增加锁、队列或影子身份。 |
| Task 及 Mission occurrence | 公共输入先执行 Mission canonical（唯一领域）权限、projected worker（投影工作者）准入和 runtime contract（执行身份合同）。动态 Task 的投影身份由实际 runtime contract 及 Host（编排宿主）注册表解析；不使用 ACP 可见目录。Mission 会话公开提示/派生仍由 `MissionSessionAuthorityError` 指向 `mission.wake`；本批不通过 ACP 绕过。 |
| Control 与其他固定角色 | 通用 `session.prompt(agent: control)` 由现有公开处理器明确拒绝，只能走 typed Control ingress（结构化控制入口）。注册表恢复不移除该权限。固定领域 Session kind（会话类型）若在唯一角色合同中绑定主助手，则目录应反映绑定；投影工作者/编排器没有可随意转换为 primary（主助手）的替代路径。 |
| 公共和持久合同 | 当前可见默认编码和已存精确 agent 均保持。网页角色来自单一权威身份 helper，固定类型来自唯一角色表，历史角色来自真实最后用户记录。无数据库/元数据/消息格式或迁移，不翻译技术角色、不伪造历史、不将隐藏提示当作授权机制。 |

代码、真实持久身份、跨项目并发和重启均指向 ACP 目录用途混用；没有证据支持共享执行队列或领域终态故障。Task/Mission 的完整外部模型执行未在此批运行，不把公共身份合同检查冒充该验收。

## 实施前方案

1. 同一 `AcpPrimarySurface` 分开表示真实注册表的可运行模式与当前通用可选模式标识，不建立另一份注册表。新建依旧使用项目可见默认；真实历史可准确恢复已存在的隐藏主助手。公共返回目录包含可见选择及已选择的当前身份，不向普通新会话展示所有隐藏角色。
2. 目录读取接收已知 Session 身份，通过公开同项目读取获得真实元数据。网页固定 Chat/Work 只投影其对应角色；唯一角色合同绑定的固定 Session kind 同理。空会话使用其固定真实角色。缺失、损坏或与固定作用域不符的历史继续明确报错，不默认替换成 coding。
3. 加载、恢复、切换和提示绑定各自目标；派生先按当前公开原语创建实际目标，再读取目标目录及历史，模型仍按源根配置解析。保留初始化清理、精确历史快照、回放、所有权和模型配置的原合同。模式切换只接受本会话公开返回的选择；无效请求用明确 `invalidParams`（参数错误）报告真实会话、请求角色及当前可选标识。
4. 在现有真实 ACP/HTTP/Provider 检查中增加正向行为：空网页固定角色、完成历史的 load/resume/fork 和实际后续输入、普通显式隐藏角色恢复及切换到编码、网页固定角色切换的精确参数错误、派生目标按真实元数据运行；保持原生新会话、消息回放和模型作用域检查。运行聚焦 ACP、领域公共权限及身份检查、后端类型、文档/架构；不新增或运行 UI 自动化。
5. 独立候选开发服务 `40150/ui/` 使用同一真实六场景及多项目并发，正常重启后再次加载/恢复/派生并提交后续输入，核每个真实用户/助手身份和实际流式请求。本人查看真实网页 Chat/Work 的后续历史并截图复核；有需要时再使用自有隔离编辑器，不操作用户进程。保存只读库、协议和流式证据，正常退出自有服务，范围提交、上游合并和普通推送。

证据集中于[本批主助手恢复验收](../../artifacts/2026-11-19-acp-persisted-primary-availability/README.md)。候选尚未修改；此规格先提交再实施。
