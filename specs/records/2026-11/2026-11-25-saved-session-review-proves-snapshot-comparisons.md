# 保存的会话快照提供可验证的历史比较

## Recall

- 用户要求本人独立持续分批迭代。每批先实际验证根因和影响并落盘，再实现、实际桌面交互与人工截图、聚焦正向检查、范围提交、普通合并和正常推送。上一批 [工作对话切换核验](2026-11-25-review-verifies-work-conversation-scope.md) `7396f7b92` 已推送并确认远端，原工作区 177 条状态保留。
- 已读[面板与比较证据](../../current/architecture/07-panel.md)、[持久数据演进](../../current/architecture/02-data.md)、[此前的文件审阅](2026-11-23-file-change-combined-search.md)、`Snapshot.diffFull`、`treeObjects`、`catFileBatch`、`FileDiff`、`SessionSummary`、`Session.Event.Diff`、保存比较目录与回收、共享跨进程 JSON 锁、公开会话和差异路由、新旧 Review 投影和渲染。全仓查 `sessionDiffPath`、`Snapshot.FileDiff`、`Snapshot.diffFull`、`Session.diff`、`session.diff`、`savedSessionChangeGroups`、`review-focus` 及既有差异、协议和快照检查。所查路径无界面自动化测试。已核对 Git 的机器可读数值统计、文件状态和 NUL（空字符）分隔协议。[Git 官方差异格式](https://git-scm.com/docs/git-diff#Documentation/git-diff.txt---numstat)

## 实施前证据与根因

- 在自有 Git 项目使用真实快照与保存入口。前后两棵不可变树给出新增两行文本、零字节新增、非文本新增、文本修改、删除及已存在的空文件变为非空，共六项。由正式工作对话 `ses_hdYutfJdkkEU3dDRxoMw` 的 `/session/:sessionID/conversation` 回执 `f6b8a0e1-4241-4d6d-a437-76b24d6c9e4a` 同一条条读回。零字节空文本和 6 字节二进制在旧记录中都为 `status=added`、前后空字串、增删数各 0。这两个明确不同的状态用旧字段无法区分。[原始快照观察及公开记录](../../artifacts/2026-11-25-saved-session-review-proves-snapshot-comparisons/README.md)
- `41810/ui/` 真实加载 `main-C-xJO_hb.js`。从摘要进入 Review（审阅），六项均表示行数未知。新增普通文本已有原始正文，仍显示保存记录不足以可靠预览。选择真实空文本和二进制时均显示相同的未知提示。[三张桌面基线图](../../artifacts/2026-11-25-saved-session-review-proves-snapshot-comparisons/README.md)
- `Snapshot.diffFull` 读取 `--numstat`，已区分二进制标记，并从原始 Git 树查找文本前后对象。当前生产者把不存在的端点、零字节以及二进制正文统一写为空字串，二进制计数也写 0，丢弃了可证实的比较分类。早期审阅为保留证据约束，明确将所有 saved Session（已保存会话）的 DTO（Data Transfer Object，数据传输对象）映为不完整；仅改变提示或由旧字段猜测任何类别都会扩大误判。文件名原来经过 Git 的显示转义及文本行切分，历史读取还会尝试反转义，不能成为新比较身份的事实来源。
- 实际持久路径是 `ProjectRuntimePaths.sessionDiffPath` 的项目缓存 JSON 文件。`SessionSummary` 统一写入，正式会话和差异路由都读其具体同一目标；`Session.diff` 另有无调用的旧直接读取。`Session.Event.Diff` 的当前 API（应用程序接口）定义复用同一个 FileDiff，协议历史镜像以一般负载保存原有观察，Overlay 正常持久页面从正式会话读重建比较，历史镜像保持原始负载。工具编辑也借用 FileDiff 的基本字段，其记录生产者及读取器有现有独立证据合同。审阅与会话摘要是唯一 saved Session 投影的两个消费者；不可变构建和单工具报告不在此链路。当前发现未涉及调度、队列、重试、唤醒或终态。

## 实施与验收方案

- Git 状态及数值统计统一使用机器可读 `-z`。前后对象仍来自相同的不可变树，使用原始路径身份和普通文件模式。Git 明确的二进制统计供 `comparisonKind=binary`。证明了物理状态、所需对象存在／缺失和有效 UTF-8（Unicode Transformation Format，8 位统一字符编码）的普通文件正文才给 `comparisonKind=text`。文本的证据约束包括新增前方为空位、删除后方为空位、修改两侧都真实存在，存在的零字节文本仍是实际空白，未知对象或非法文本得到显式 `unknown`。沿用原前后文本、状态、计数、格式和组标识作为数据；新增分类只描述生产时得到的事实。保持子模块、符号链接或未取得文本对象的比较明确不可预览，避免从当前文件替代历史内容。
- 将已经保存的比较文件演进为版本 2 容器，为每条记录保存明确分类。纯旧数组按版本 1 自动升级，保留路径、原文、数值和额外已有字段，按现有旧路径反转义接入新版本，分类置 `unknown`。用已有按文件跨进程锁加原子写入包住迁移和新写入，进锁后重读避免迁移覆盖并发发布，已成功持久化的版本 2 读取保持只读。缺文件沿用空列表合同；无法解析或未知版本保留原字节并沿当前错误路径反馈。收敛到 `SessionSummary` 的单一持久读写，清理已查无调用的直接读取。正式接口与当前事件增加可选比较证据字段以保有旧历史观察原文，当前保存形态始终持久化明确分类。正式 SDK（Software Development Kit，软件开发工具包）和应用程序接口文档随声明生成。
- 使用唯一 `savedSessionChangeGroups` 从明确分类和相应负载生成原 Review 比较。文本显示原端点与确切计数，已证明的二进制使用现有二进制反馈且无行数，旧或未证明的记录沿明确受限状态。通用比较、当前文件打开、选择与导航使用原机制，无新 UI 组件、无第二份持久比较、无需业务模型或用户凭据。
- 针对真实 Git 原始树、同一路径从空文本变为非空、二进制／零文本、增加／修改／删除的完整分类编写聚焦正向检查。验证旧记录版本自动升级及原数据保留、重新读取稳定、并发下不能覆盖当前证据及初次缺文件正常输出。既有协议、公开 API、端点身份和数据投影检查跟进。用同一隔离项目重放候选生产者，真实界面分别读取旧、当前两会话，查看准确文本、增删行、零字节和二进制，验证当前文件为正交入口。各阶段复核真实截图，核对明确保存版本、正式接口返回、无发送消息，执行生成物、类型、构建及文档检查，然后提交合并并推送。

## 迁移路径复核

- 实施期间在隔离 Git 仓库用 `git mktree -z` 创建含汉字、补充平面字符和制表符的路径，明确避开 Windows 文件名限制。真实 `--numstat` 把路径放在引号里、保留 `字` 和 `😀`、转义制表符，真实 `--numstat -z` 返回原路径。旧 `unquoteGitPath` 把未转义 UTF-16（Unicode Transformation Format，16 位统一字符编码）码元当成字节，实际把两个 Unicode 字符解码成 `W-=` 加空字符。这个旧行为此前只影响显示，在本批原地迁移会持久化损坏后的路径。全仓搜索无其他引号解析实现或调用者。[Git 路径转义定义](https://git-scm.com/docs/git-config#Documentation/git-config.txt-corequotePath)
- 迁移函数将原样 Unicode 片段编码为 UTF-8，再与 Git 单字符和八进制转义的实际字节拼合。无法解释的内容保留原值。新记录经 `-z` 读取路径，版本 2 不再经过旧解码。检查覆盖原样 UTF-8 和转义字节两种旧固定输入，并核对迁移后的正式存储。[实际 Git 路径回执](../../artifacts/2026-11-25-saved-session-review-proves-snapshot-comparisons/candidate-legacy-git-path-observation.json)

## 验收

- 使用原两棵真实 Git 树重放生产者，经 `SessionSummary.publishDiff` 保存到 Current 工作对话。各条旧字段和原树重放一致，五条记录标记为文本，一条标记为二进制。Legacy 第一次实际页面读取前仍是原数组，打开会话后实际文件升级为版本 2，六条旧比较保留原字段，证据为未知。重启最终后端，两个会话的公开对话与差异端点均返回同一存储事实，两个转录都为空。[快照重放、正式接口与存储证据](../../artifacts/2026-11-25-saved-session-review-proves-snapshot-comparisons/README.md)
- 在实际桌面页面 `/ui/` 加载 `main-CrEaNKLv.js`，从会话摘要打开 Review。手工选择新增、修改、删除、零字节新增、原已有空文件及二进制，逐张复核正文、颜色、原行号与增删计数。二进制单项显示非文本，切换 Hide non-text（隐藏非文本）后显示 6 项中的 5 项。另由历史预览入口打开 `was-empty.txt` 的当前版本，文件面板显示实际正文。旧会话依旧可列出 6 条记录并明确提示证据不足。汇总行数在仍有非文本记录时沿当前总数合同显示未知。[候选截图索引](../../artifacts/2026-11-25-saved-session-review-proves-snapshot-comparisons/README.md)
- `packages/opencorvus` 的真实 Git、旧记录迁移、并发保存与会话历史检查合计 7 项，40 个断言。`packages/overlay` 的纯比较投影、记录标识和搜索检查合计 25 项，39 个断言。两包类型检查、桌面资源构建、正式路由检查、文档和架构索引检查均通过。应用读取路径由实际服务和桌面交互验收。该修改不涉及模型选择、请求或生成，验收未发送对话消息。
