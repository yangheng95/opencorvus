# Goal 的终态所属对象体验

## Recall

用户要求持续单 agent 自主体验、排查和修复，真实页面交互及截图复核后范围提交推送；不再委托，不重复已解决的 Rendering 闪烁。当前长期 Goal 保持 active；原文中的三个 Astra 已被后续明确要求覆盖。Dependabot 单次远端重扫授权已在先前批次消耗，本轮不重复调用。上一批 802 的附件局部恢复已提交推送为 1dc141bbf，fresh fetch/merge 为 0/0；本轮起点保留另一任务正在修改的 activity/loop/processor/bash/stream-activity、两个测试、新 execution-deadline 文件和历史媒体删除，不合入本批。

已读当前 continuous-goal 架构、store/controller/schema、ContinuousGoalControl 创建/保存/刷新与错误呈现、公开 task-api 的调用位置；已核对 Oct20 Task Goal 真实续跑、Task/Mission 入口、Oct29 780 SideChat 预算恢复记录与 802 Recall。Task 基本 Goal 和 Mission 单轮 Goal 曾真实通过，不能称从未覆盖。当前 store 对 completed/failed Task 允许专用 Goal receipt 重开，对 cancelled Task/closed Mission 明确要求原所属对象先恢复。Goal 完成与 Task/Mission 业务完成是不同事实。先调查已完成子 Task 所属已关闭 Mission 的入口、错误反馈和可见恢复路径，不先断言跨边界调度失败。

## 调查、影响面与实施前方案

可观察目标是用户能否从当前已完成 Task/Mission 清楚理解持续目标的归属和启动条件。直接入口是公共 Goal 控件与同一 project-scoped GET/POST/PATCH；store 的 ownerBoundary 与现有 Mission occurrence 是唯一执行权威。已全仓搜索 Goal 定义、公开工具/路由、Task delivery、owner boundary、同语义 reason 和历史记录。UI 暂停 reason 已使用稳定标识，780 的早期线索已由当前代码修复，不重复改动。当前尚无已证产品缺陷；旧入口验收没有覆盖当前 schema9 下完整已关闭 Mission 的表单旅程。Task 下级独立 Goal 是否受父关闭约束仍未知，需沿真实 task-api 核对，不能仅凭名称推断。

1. 只读核对已物理完整关闭的 802-after QA 数据（203938 行、92 表、schema9）中 801 Mission/Task、各自控制事件和现有 Goal。复制完整数据库、产物与附件 namespace、正式普通 UI main-DIncBPIS.js 到新的 803 自有目录，保留所有源身份与原始字节。不得触碰用户 18571、真实数据库或原失败 793 项目。
2. 新开发 /ui 端口 38374，原始固定 25 分钟物理寿命、到期前 5 分钟正常 shutdown，启动 inactivity 180 秒。配对复制授权 auth 与完整 models 供本地真实投影，但 Provider 请求额度严格为 0；不发送消息、不创建可执行 Goal、不重开 Task/Mission。仅真实 UI 打开既有终态所属对象、表单/详情、指南与取消，并用公开读取和只读数据库区分 completed 与 closed；闭合准入错误仅在已证确定拒绝时提交。认证可用/目标投影和实际 Provider 请求分开陈述，本轮没有模型运行验收。
3. 如发现功能或视觉问题，先补足数据/控制流、同语义调用、公共合同、测试、文档与风险证据，再实施根因修复。当前另一批正修改执行链；不覆盖其文件，不用其尚未稳定的运行行为冒充独立产品失败。若出现任何队列/恢复/调度/终态异常，立即按全入口、Task/Mission/Session occurrence、正常终态、重试重启、串并行与多项目进行共享机制审计。
4. 不新增或运行 UI 自动化；真实页面截图逐张人工查看。若改 UI，用正式构建的新冻结页面重新交互截图；非 UI 改动需聚焦正向合同测试。保留原消息和参与者，不制造 SQL Goal/Message、假执行或 host 流程旁路。
5. 收拢全部自有页、公开 shutdown、原 exec/native/launcher 和物理/输出/请求；逐行核对源数据与副本变化，单列预期 runtime 身份收据；原文件和项目 Git 状态保持。配对复制退休，源凭据 metadata 与完整目录字节核对；不归档秘密。更新三索引、真实证据和当前 package 文档检查，范围提交，fresh fetch/merge、完整待推送集合复核和正常 push。没有确认缺陷时只记录真实覆盖及限制，不虚构修复。

## 启动前事实校正

只读原副本发现 801 Mission 仅有 mission.execution.opened（seq1），Task 有 task.completed（seq135）；没有该 Mission 的 execution.closed。上一批所称“完整关闭”指物理 native 收拢，不能推断业务 Mission occurrence 已关闭。终态体验必须分别选真实 closed Mission 与已 completed Task，不能把 801 标成 closed，也不能因模型业务完成而人为补写关闭事件。新复制尚未启动时已经完成这项核对，后续先选实际存在的关闭事实。

## 已证缺陷与实施决定

真实已关闭 Mission 为 ses_-zUQi8aC3zzDyYDXPxXm（原 title-goal-746 项目），持久 mission.execution.closed seq7、当前未归档。真实 +→Goal→提交返回 HTTP409 / ContinuousGoalError / owner_unavailable，原件详情保留准确 POST 与请求身份；独立公开 GET 同一 Goal 返回 HTTP200/null。关掉失败表单后，页面却说“无法确认当前目标，请重试读取实际状态”，唯一 Retry 只重新读取，不重新提交。这是保存失败与读取失败反馈混用，未发现执行准入或调度异常。已完成 Task801 的真实表单归属正确，未提交或续跑。

直接触发为 mutate catch 写 failure 后关闭表单。共享根因在 ContinuousGoalControl：持久 mutation failure 与 projection.error 合成 error()，外部 Feedback 不保留错误来源，总渲染读取失败正文/Retry。反复读取成功不会改变原保存错误，旧可恢复读取逻辑不能恢复该意图。已审查组件全部 setFailure/errorSummary/两处 Feedback、创建/状态修改/预算/完成/首页 launch 入口，以及同语义 locale 和公开 store/HTTP。公共服务、SDK（Software Development Kit，软件开发工具包）、schema9、持久状态和执行控制无需改变；仅调整统一控件的展示和导航，不重放请求、不自动恢复 owner。

实施：当前读取错误优先呈现自身原始诊断及现有 Retry；读取成功后如仍有保存错误，明确“更改未保存”，提供 Review goal，重新打开当前已有目标的详情或无目标时的创建表单。沿用现有 open、真实 goal projection、createDraft 与 selection/authority 隔离，避免另一份状态或推测保存成功。首页无 owner 的失败也可回表单。保存错误不承诺全部完成证据草稿保留；创建草稿按已有合同保留。新两语言文案、当前 continuous-goal 架构同步，原错误详情继续保留。风险为读取/保存同时失败时错误优先级与回表单目标选择；通过真实关闭 Mission 保存错误、重新打开原创建草稿、中英文和独立读取错误恢复分别复核，不新增 UI 自动化。

## 基线验收启动器故障

首次自有 native 由通用 run-with-inactivity 包装。该运行器按 stdout/stderr 活动判定命令静默，服务日志写 dev.log、UI 请求也真实发生，静默180秒后运行器将自有进程树结清（原 exec68750/runner35028 exit1，日志明确 Physical/output settlement confirmed:true）；不能把它当产品执行终态或正常 shutdown200。手动关闭先误用 Windows PowerShell5.1 的 ArgumentList API，随后 PowerShell7 精确身份观察已 dead，因此未对死亡/复用身份发送 shutdown。保留两次失败，不重启该 occurrence。

修复本批自有验收启动方式：长期 native 直接受既有 exact-process host 的原固定 deadline 与预定正常 shutdown 监管，启动阶段仍以真实 dev.log/receipt 的180秒 inactivity 检查；短命 build/check 命令继续走通用 stdout/stderr runner。不添加周期假输出，也不延长 803 原截止1793311039936。完成原物理/输出/请求资格及复制对退休后，新 803-after occurrence 使用同一原截止和新的正式 UI 做修复后验证。

读取错误的真实复核准备：当前 QA 历史没有 archived Task 或 Session，不能虚构原归档事实。通过现有公开 POST /session 创建一个有明确本轮标题的独立空 Chat，再经原 PATCH /session/:id 归档，使用其真实恢复 URL 打开并观察 Goal 的 owner_unavailable 读取错误/Retry。只创建元数据，不发送消息、创建 Goal、执行 Provider 或触碰原会话。该归档态是当前产品真实数据和真实路由结果，不注入响应或 SQL 夹具；新增记录单列保留，不能冒充原历史数据。

## 修复后实页结果与范围校正

普通main-DYdWYk7e.js实页：同一closed Mission填写目标、5000令牌/3轮后仍正确POST409。关表单明确显示更改未保存，真实Review goal带回原文、两个预算和展开状态；切中文重复保存拒绝、关闭、查看目标，全部按当前语言且草稿原样。共[十张原图](../../artifacts/2026-10-30-goal-terminal-owner-experience/README.md)逐张人工查看，恢复英文后全部自有页24/25/26/27关闭。已完成Task表单归属正确，未运行Task/Mission新Goal。

扩展读取场景的准备首用普通POST/session创建ses_-zUQWL1zKzzXx2Ng4OqQ，虽是真实Session，但不是原生Chat；原链接GET coding/chat/session返回404/NotFoundError。归档与恢复都不能改变这个身份，不能把图09误称归档准入。核对coding聚合路由、right-sidebar-conversation和chat/session原生身份契约后，改经POST coding/chat/session（201）创建ses_-zUQWKSgYzzXgm2YLTag；真实读取成功并显示准确标题。原生archive入口后，当前页和同URLreload都展示缺少原标题/归档说明的空Chat视图，Goal owner从可见列表中消失，因此没有触发Goal读取错误。图10如实留存，作为下一批归档所属对象恢复体验线索。没有伪造响应或给普通Session补写原生身份，两空Session最终均真实归档；本轮不宣称读取错误、同时读写失败、已有目标更新冲突或首页失败实页矩阵通过。

## 数据、工具与终态复核

源schema9/92表/203938行原样；before203940、after204260，全部203938原行保留。Node.js SQLite读取带空字符TEXT时不能作为完整值证据，故补充原生SQLite只读EXCEPT跨库比较，每表原完整行均与源一致，覆盖BLOB和完整TEXT。三库integrity/foreign_key通过。新增2Session、9个仅归属它们的created/updated outbox，66次投递均有succeeded回执，精确包含空字符的deliveryID与lease匹配、在回执时间释放，27份exact/global/wildcard阶段回执完整。当前原生各1runtime_process收据符合joinProcessLiveness合同，精确PID/出生身份已dead；没有调度/唤醒/恢复异常证据。

初版数据检查把802临时草稿也算作应永久保留文件，又把递归.derived文件名与顶层目录比较，并错误把全部67个activation lease当1个runtime lease；三次失败均保留原工具回执，修复检查范围后重跑。源81文件全部字节相同；两副本各75已发布文件字节相同，3个未发送草稿及metadata由当前AttachmentStore.sweep回收。原native stdout日志各有真实deleted3/bytesFreed74/kept5，代码以持久引用集合和60秒并发写保护选择；没有删原namespace或通过恢复垃圾迎合检查。三个QA项目16个tracked文件、HEAD/ref/index/working全部精确保持。

首个自有scope按原失败exit1保留，原运行器物理/输出settlement、精确host/target/launcher链死亡与端口关闭已复核；Provider0，所以没有未结模型请求。未产生正常native graceful回执，不称该scope shutdown200。新candidate实际持续约470秒、公开shutdown200、原exec82003/native/launcher0，物理/输出/请求三项完成及精确出生链死亡；结清距原同一截止564824毫秒，未续期。两套配对复制均退休，源auth metadata和catalog metadata/完整字节保持。Provider合计0，累计1083，未做真实凭据请求或模型续跑，只有本地注册/目录投影。

正式build（含renderer surface）、overlay typecheck、2语言2629键、docs:check351操作/26组通过；无UI自动化。只有统一控件、两语言和当前Goal展示合同有产品修改，未修改SDK/OpenAPI、schema或执行链。范围提交和正常hook/push结果以最终Git交付回执为准，保留全部无关工作区改动。长期Goal保持active，下一批继续调查真实归档Chat空视图。
