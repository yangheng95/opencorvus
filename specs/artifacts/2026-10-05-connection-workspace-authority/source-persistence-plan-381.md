# 381 Sources 并发持久化边界

## Recall

用户要求持续自主迭代，重点解决 Sources 呈现与反复 rendering；最新明确只用单 agent。本轮遵守新版界面完整本地化规范，不委托。379 已交付 ba1c6e5；本轮工作区有其他任务持续提交及未提交修改，完整保留，索引只提交本轮条目。先读 source-persistence、processor、MessageStore、Session canonical writer、Database transaction/effect、permission authority/recovery、Source 正向合同、当前 02-data/07-panel 与 379/359 Recall，再实施。

## 现象、调用与根因分析

Source helper 承诺每条真实 assistant Message 内按 type/sourceId 唯一。当前先 await MessageStore.parts 读取整条消息，再逐条 await updatePart；查重和写入不在同一事务。两个调用可同时读到相同旧集合。单流 for-await 的 tool-result 与 provider source 是串行的，不能据此声称所有普通并行工具均重复。completeRecoveredToolPart 复用该 helper，锁只按 toolCallID；不同恢复调用可交错。先用真实数据库及真实 processor 入口验证这一窗口，不把假设包装成网页现象。

该读取还会投影所有 ToolRequest/Outcome 与 permission result 全文，而查重只需要 Sources。MessageStore 的 persistedPart 是规范 Part 校验与损坏诊断入口；应复用它，不能另建数据解释。Session.writePartInTransaction 现有同步 writer 已统一处理身份、终态、Task activation、删除准入和 post-commit publication。Database.immediateTransaction 在读取前拿 SQLite writer reservation，覆盖同进程和多进程；不能只增加内存 mutex 或第二套唯一身份。

## 共享机制横向审计

- 全仓 persistMessageSources 生产调用只有 processor 的工具完成与 provider source 两处；恢复通过 completeRecoveredToolPart 进入同一实现。普通 Task、Mission、独立 Session 的工具处理共享 processor，不按专家团特判。
- 普通流逐事件 await；不同工具恢复持有不同 call 锁。Permission reply/replyUser 与 cancelSessions、项目启动 resumeApprovedContinuations 均可进入恢复；启动循环自身串行，AsyncLocalStorage exactContinuation 只是身份上下文。活跃 Message owner 已有 live 保护。
- 不同 Message/Session/Project 必须维持独立来源集合。复用已存在来源的重试在 Message 完成后应得到原事实；新增来源必须继续受到已完成 Message 写入错误合同约束。
- Tool 成功 outcome 先提交、display/Source 后提交的窗口是另一个未证明完整恢复行为的调查项。现有成功 outcome 可在 parent 终态后结算，而 Source 新增受终态保护；不可草率把二者绑为事务，造成真实外部成功被回滚或永远 running。本轮不修改 Tool 执行、权限 receipt、助手终态、调度或恢复重放策略；该窗口仍列为后续未完成调查，不宣称已排除共享终态风险。

## 实施与验收

先新增正向后台合同，经正式单文件 runner 证明旧行为：同消息交叠 Sources 调用、真实 recovered Tool completion 调用与 provider helper 交叠；再覆盖重试、完成后已存在来源、错误 session/message 配对、独立消息隔离。测试使用真实数据库/规范 writer，无 UI（User Interface，用户界面）自动化，不冒充完整恢复或多进程端到端。

将查重和整批 Source 写入放在一个 immediateTransaction 内。MessageStore 增加限定真实 parent 身份的 Source-only 读取，复用 persistedPart；Source 写入复用现有同步 writer，返回规范 orderKey。API 保持 async；publication 使用既有事务 outbox，无第二套 writer、schema migration、后台修补或全局 effect drain。

后态启动项目真实 /ui 开发服务，使用已授权 gpt-6.1-sol 流式请求读取同一公开网页两次，人工复核 Sources、展开、再次打开消息和真实截图；真实原始消息、工具结果、Source 数据及 Provider 审计分别保存。当前 UI 语言覆盖产品控件，用户/网页原文保留。禁止新增/运行 UI 自动化测试。

每个 NativeService 固定 600000ms/12 Provider 请求，原有请求语义 inactivity checker 不替换为总超时。只操作新建隔离页面/服务，auth/models 成对复制，启动前分别验证 credentials usable/model projected/实际请求模型一致。若共享 package 工作目录含其他进程 pile，先为本轮 wrapper/launcher 使用独立工作目录且保留绝对生产 CLI/import；不得覆盖、移动或删除他人 pile。关闭本轮页面、正常 shutdown、join 原 launcher，核对物理进程/output/request/port/凭据配对清理。

运行聚焦合同、typecheck、docs:check 和 architecture-index。更新根/月/证据索引并范围提交；fresh fetch/merge upstream、审查完整待推集合后普通 push。真实并发权限全链、Task/Mission 恢复和异常 display 原子性未验收时明确保留，不以普通 UI 成功代替。持续 goal 保持 active。

## 实施进展与运行声明

77154 原正式 runner exit1：4合同1pass/3fail。交叠批次出现 a,a,b,c,b；两个真实 completeRecoveredToolPart 产生两个 shared Source；错误 Session 配对得到 resolved。完成后重放原事实通过。修改后的12053 exit0：6个新合同12断言、原合同4断言，共7pass；事件回调读取实际数据库时每次均看到完整批次。类型52783 exit0。均为后台实存储合同，不宣称真正进程重启恢复。

预声明唯一后态 source-persistence-381-after，端口18390，RunRoot 为 C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-13/source-persistence-381-after；固定600000ms/12请求。启动前准备独立 launcher/wrapper/shutdown：Host 与 Native cwd 为本轮 RunRoot，observer cwd 为本轮专属目录，生产模块改为同一绝对导入；产品代码和Provider流程未绕过。使用377正式私有UI产物。不会触碰 package 内其他运行的 pile。

## 本轮结果及未完成项

新增跨项目正向合同后99146实际exit0，8测试19断言；类型85222 exit0。原Source单一writer及post-commit publication保留。独立项目和消息事实、完成后重放/新增错误、批次完整可见与并发completion去重均通过后台真实存储检查。

真实初始请求成功完成两次webfetch与自然终答，两个工具分属两个Message，各保留一条Source。追加同一步并行两次要求时，运行原固定12请求被耗尽，第三次抓取完成后助手明确E2E_REQUEST_BUDGET_EXHAUSTED，第四次未完成。未延长、重启或重置额度。五图已人工查看，来源展开/重载/点击到官网通过；完整同一步双调用端到端未达成。请求审计12次实际gpt-6.1-sol流式200/EOF（memory4/chat1/work7），不能以模型自述或Source数量推断并发。

本轮原launcher62148 exit1，OWNED_PROVIDER_COMPLETION_INVALID；shutdown exit0、Native310253ms正常退出且Host/Native/output/request/port/auth-models配对完成。运行失败证据完整保留。其他Task/Mission真实恢复、跨进程与Tool/display/Source中断窗口仍需后续调查，持续goal不关闭。
