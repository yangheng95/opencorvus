# 活动 Task 的指导与侧栏流式恢复

## Recall

用户要求持续自主体验、修复 UI（User Interface，用户界面）/UX（User Experience，用户体验）及功能，重点 Sources 和成员侧栏 Rendering 闪烁；最新人工约束只用一个开发 agent，旧 goal 的 Astra 并行文字不再适用。已授权实际 gpt-6.1-sol 及原 OpenAI 凭据配对使用。旧数据已清理且当前 schema v1 已交付，复用当前版本隔离库，不再清空数据。原凭据内容不得进入日志/规格/提交。

413 为 progress：2648949cf 修复终态指导解释、输入可访问名称、中英文提示及发送按钮定位；12 张原图、23 条真实 Sol 流、三个物理收尾 scope 已保存。两条 terminal 协调请求均真实确认，但第一条追加工作没有执行，符合 Task 已完成合同，不能当作活动指导成功。完整流中关闭再打开和不同成员切换仍未验证。两次并发 push 被远端更新拒绝，原结果保留；最终 15260 join4a951d exit0/Everything up-to-date，远端 58096d4d7 包含 own2648949cf，自己的修改已提交。整体目标 active。

当前 HEAD 58096d4d7 另已修复所有 Task rootMessage 经既有单条消息投递进入编排器；当前工作区有其他权限、Git、CommandPalette 和测试/索引改动，全部保留，不纳入本轮。仅当前分支、单 agent；有自己的文件修改即范围提交、fresh fetch/merge、完整 pending 审阅、正常 push；无分支/worktree/rebase/force/发布。

## 已读和分析

重读 413 Recall/原证据、AGENTS、03-control 的协调四类不可变事实和 continuation 合同；Task API operatorSteerAgentSession、前端 sender/workerSteerTargetSessionID 及 Card/ChatBubble 全仓调用检索，现有 OperatorSteerForm、07-panel-reactivity 的消息段/完成时间合同。成熟 413 Native Host/Target 包装器、正式 CLI 创建/预检/收尾脚本、Node Vite 构建配置已读。检索没有新增第二发送路径；本轮不运行 UI 自动化测试，其他任务的投影测试删除保留。

可观察缺口：上轮读取成员只产出约 200 字，打开表单并提交时 Task 已完成；这属于验收时序和当前终态合同，不能通过延长旧 scope、隐式重开或改写为 root 用户输入来伪造活动指导成功。真正的活动请求会冻结原 dispatch lineage/epoch，经 Orchestrator response/action 再显式 dispatch_agent 在原 child Session 新 Turn 续跑。接受回执只证明受理；必须核对真实响应、派发、成员输入与最终产出。

侧栏闪烁目前没有新复现根因。UI 消息卡按真实参与者相邻消息分段，末条 Message 决定完成时刻。413 的 27m33s 已与原编排器第二段首消息到后续确认完成的真实跨度吻合，原 Message 完成时间不变；尚不能据此声称计时或调度故障。本轮重点活动指导和流中阅读，未计划更改时长含义、数据库、权限、协议、模型配置或调度。如果出现队列/恢复/终态异常，立即横向覆盖 Task/Mission/Session 全生产入口、轮次、重启重试、串并行/多项目，共享根因未排除前不归为单个成员或模型。

## 实施前验收方案

复用已关闭的 member-live-rendering-412-fresh 独立项目和 v1 数据库，新增 active-task-dock-414-live scope/端口18535。当前源码 Node 构建到独立 bundle，正式开发 /ui/ 页面；不单独启动 Vite。沿原包装器和 checker，预先固定40条累计请求、Native最大600秒、模型无活动180秒，不提高正在运行的预算。完整 auth/models 由成熟配对助手复制，先验证可用凭据、投影与实际请求 Sol/streaming 完全一致，再正式 CLI 创建。

Task 原始输入请唯一读取成员读取 README 第2—3行，产出约2400字中文解释，保留测试限定/价格/交付/原来源、章节与表格，不联网、不改文件。长正文是实际请求，不加 sleep 或人为拦截 Provider。先准备自有浏览器/截图目录及 CLI，再启动范围；收到真实 Task 后及时从工作记录进入成员，在持续增量时提交简短补充要求（末尾附明确短摘要），记录是否原 Task 仍 active。关闭/重开真实成员 Dock，人工截图查看旧正文、位置、来源与后续增量；若完成太快，明确只资格完成态，不把它当流中成功。

后台只读 checker 比较原 Task、child、request/response/action/outcome、派发 lineage/新输入、Source Tool/Part 及末文真实输出；不制造任何 Task/消息/来源或 UI 断言。发现产品缺陷先补根因和影响计划再改；UI 改动必须真实页面修前/修后原截图人工复核，非 UI 改动有聚焦正向合同。最终关闭自有页面，公开 shutdown，join 原 handle，验证原PID/出生身份和 physical/output/request 后退休复制凭据配对，保留 v1 数据。失败和未满足项原样记录。

证据与脚本在[本轮产物](../../artifacts/2026-10-14-active-task-dock/README.md)。更新相关索引并执行 package 声明的 docs:check 与架构检查，按实际结果交付，不预写成功。

## 修前真实发现与修复方案

原 Node build11839 joinc6e184 exit0，82秒。新scope Target83240，正式CLI499480 exit0接受 Task tsk_g00VXzpdDA00tndVb8tx，04:49:03发送/04:49:10接受。唯一base-tester ses_hW1vyFBEMJySTHz2coab真实read2—3行、来源与长正文齐全。03图在正文第3节生成中关闭Dock，重开后04图已增长至第8—9节，05图向上滚动后来源/旧首段可读，真实worker尚未完成。没有观察到这次旧正文被Rendering替换；单次通过不覆盖全部快速切换或两成员情形。07原图实际打开README并高亮2—3行。

真实障碍：长回复正在生成时侧栏末尾没有Add guidance。全仓搜索定位唯一ConversationTurnControl调用在ChatBubble；其外层hasFinalTurnOutput要求非pending/running且正文非空，把指导入口与最终复制栏一起延后。当前工具栏内本来独立按onAgentSteerToggle显示指导、按copyText显示复制，因此外层完成态条件比后端合法目标合同更窄。Card/嵌套OperatorSteerBox没有该完成态限制。旧412只修合法Task目标，413只修说明/定位，都未触及这一共享ChatBubble的完成态条件。

直到成员完成才可打开指导；实际提交已经晚于Task终态，又生成art_43c98f882ea84001b097及真实acknowledge_terminal response/action/completed outcome，引用pev_g0VXzqIuG00MOV2dpy9B。短摘要未由成员追加，保留未达成。没有把终态确认误当新调度故障或重复同一次请求。33页面关闭，公开shutdown244856 HTTP200，原19442 join1606ba exit0，物理和配对退休原件保留。

最小实现：沿现有唯一工具栏，外层条件改为最终正文或合法steerTarget；复制文本仍只在hasFinalTurnOutput时提供。这样pending/running的合法Task成员始终有指导入口，不复制半截正文，不新建第二触发器/状态/路由，不改后台协调、角色权限、草稿和请求身份。既有日期/用量组件直接使用原投影，成员完成时同一工具栏继续保留。影响仅ChatBubble主区/成员Dock；结构化Card与普通Session适用性不改。既有两个语言字段复用，没有新增文案或接口；无非UI合同变化，不新增/运行UI自动测试。

修后另开active-task-dock-414-after/18537，重新构建当前前端、同一v1隔离库、新Task receipt文件；预先同样40请求/600秒/180秒，不扩旧scope。原长文本输入保持，尽早在worker仍活动时开指导并发送三句摘要要求，人工查看输入/受理/续跑和完成态复制。实际新原Task/child/action链单独核对，修前失败和原图完整保留。聚焦overlay类型、真实构建/实页与docs检查后范围交付。

## 修后真实续跑与新发现的受理超时

overlay类型41683 join755f94 exit0；修后Node构建26138 join9e376e exit0、55.54秒。CLI14567b exit0，Task tsk_g00VXzrKTb00FHxBs7dV，04:55:49发送/04:55:54接受。08原图在Task 58秒/成员21秒、真实工具活动中已能填写指导，正文尚未完成；通过同一表单发送后，后台创建唯一请求art_1c71e9b10c80478ebf95（1791953821096）。编排器真实response为redispatch，action art_hagBE5lSsf6fiDpt37XA冻结原worker ses_hLcNyyhKeflPEoHXQXoF；随后真实dispatch_agent使用该action权威，在原Session追加真实新输入msg_g0VXzrvVL00shLO4ogjY。原长文1791953895251完成，后续三句摘要msg_g0VXzrwjd003dt5niBzT在1791953904638完成，10/11图可读原长文末尾与新增摘要。action outcome art_hKIz4kO7sRkpv1r47zZd为completed，原Task正常completed。这次真正覆盖活动指导后原成员续跑。

新缺陷保留：首次界面请求在15秒默认传输期限后显示“signal timed out”，虽然持久请求已经接受且实际续跑成功。09文件名含accepted，但原图/AX显示的是超时状态，不是成功回执；10明确显示红色错误和保留原输入。按现有controller保持同一原文/requestID重试，11得到完全相同art_1c71e9b10c80478ebf95回执；最终持久事实仍唯一request及唯一action，不把重试通过覆盖首次失败。

源调用链已定位：operatorSteerAgentSession在request与root ingress同事务持久化后，仍await dispatchTaskLoop→reconcileTaskControlPlane；后者等待实际编排处理，而HostTransport的默认request timeout为15000ms。createOperatorSteerCoordinationRequest已经通过persistCoordinationIngressInTransaction的Database.effect通知现有project-owned后台扫描，API额外同步等待混淆了“接受持久输入”和“完成执行”。精确replay及并发replay分支还await deliverTaskRootIngress，存在同种受理耦合。不是凭据缺失、没有入队或成员未执行；不应延长前端timeout来遮盖。

立即开展共享机制搜索：全部生产dispatchTaskLoop调用、deliverTaskRootIngress调用、Task创建/新Message/持久wake入口、协调transaction effect、Instance lease脱离与completionHooks、终态conversation、worker continuation已定位。Task API两个activity-reconciliation回答入口同样await deliverTaskRootIngress；Task/Mission正常持久输入多已用dispatchPersistedTaskLoop或后台scan。直接Session流式prompt是另一明确长请求合同，不能仅因await而删除等待。剩余需逐一完成全部入口与正常/终态、重试重启、轮次、串并行/多Project审计及聚焦正向验收后再改；目前不能宣布共享根因已经全面排除。可复用的正确primitive是requestTaskControlScanInBackground/既有事务后扫描，具备新Instance lease和owned completion，不能自行float裸Promise或增加备用唤醒。

下一批直接处理该受理缺陷：审查OperatorSteerDispatch注入和engine-interaction-recovery/原process worker测试的旧dispatch调用计数，按真实持久receipt/identity合同更新；新测试证明请求受理的明确响应与原不可变请求/ingress身份，真实慢成员/实际页面证明首次回执能在成员继续执行时返回。不能以mock计数、请求增时、重试后成功或本轮UI入口修复代替。后台尚未修改，因此这项明确未完成，整体goal active。

本轮34页面已关闭，公开shutdown f8d698 HTTP200；原77295 join0d6d72 exit0。两scope合计41条实际Sol流，均200/reader settled/eof，Native物理/output/request及auth/models退休齐全。原Task的15条Message、所有Part/Tool/outcome与已有Artifact payload在修后保留；来源绑定真实completed read2—3行。只读checker cc5fed exit0，详见persisted-check/execution-summary。11张原JPEG人工查看。无UI自动化测试，无后台合同改动；本轮交付UI活动入口及实际续跑证据，保留受理超时与两成员切换未资格。
