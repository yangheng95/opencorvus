# 专家团当前源码追加交付与更正场景

## Recall

- 用户原要求：抽几个专家团，设计端到端case，找到机制问题并深入分析后再制定合理方案解决，直到找不到新问题为止。上轮只核旧原件和41项局部合同，不能替代当前源码新的完整业务验收。
- 用户在当前聊天明确授权使用本机已配置OpenAI凭据和完整模型目录，限定全新隔离项目、gpt-6.1-sol流式调用、每服务最多360次请求、不操作现用服务或对外发布。此授权仅用于当前真实端到端场景；不把其他任务记录当成本聊天授权。
- 使用benchmark-debug-template；不委托独立agent。产品内原专家团是被测系统真实成员。当前main起点078d936d4，数据库版本8；保留171项既有删除、两级README其他任务新增入口和两个未跟踪目录。并行Expert recovery审计负责Manager保全/安装接续，当前不修改该分区。
- 已读原机制案例Recall/结果、当前专家团调度、Task控制面、记忆/恢复架构、三个候选原包manifest/README/交付角色/工作流/前驱Schema，以及真实Provider审计、paired目录移交、原生进程监督、正式Task创建/message/conversation和现有真实案例启动/结算脚本。搜索确认Task消息正式入口为server/routes/orchestrator.ts，语义由task-api/index.ts唯一handleTaskMessage负责。

## 问题深度与影响面（实施前）

- 可观察候选：marketing-growth和seo-geo的writer及共享workflow明确固定artifacts路径，sales-strategy等已明确优先用户指定路径。前两包另有绝对“merge后不再修改”而未说明后续授权Turn。它们与当前用户可继续Task的公共合同可能冲突；尚未真实运行，故不宣称产品已失败。
- 直接触发拟为用户指定outputs路径、worker运行中更正原约束、完成后同Task继续交付。数据流需核原operator Message/Parts→接受轮次与root ingress→真实调度/worker读取→实际文件、资源和document→当前completion。不能按标题或模型声称完成定因。
- 尚未知：高优先级package prompt是否实际导致忽略用户路径；新消息是否遗漏/重复；多个项目是否串台；重启是否重新消费原事实。先真实运行，不能从局部测试绿例排除。
- 旧路径未证明根治的原因：原三个自然案例没有覆盖这两个包，局部publisher合同不验证自然语言路径选择和后续更正；之前的恢复矩阵证明共享机制特定切点，不能证明当前新包语义。
- 影响面：原包身份/工具/Skill、Task/Mission/Session轮次、正常及终态、继续/恢复、串并行与项目隔离、单一交付资源及审阅契约。发现任何控制面异常立即横审全部生产入口；此阶段只准备隔离checker和输入，无生产修复或格式变化。若需修改，先补完整根因/定义调用/历史/风险方案，版本更新须同步生成物及实质更新日志。

## 案例与验收

| 案例 | 输入及操作 | 明确输出与事实 |
| --- | --- | --- |
| MG | marketing-growth；三渠道合成数据；原预算3000，首个worker实际运行后由正式Task message更正当前预算1200；请求outputs/growth-plan.md | 完整七类业务产物、真实前驱read/select、独立审阅；输入合计曝光6000/点击370/线索47/成本1900；分渠道线索成本20/50/60；当前预算1200、建议仍为待验证假设；指定文件、发布资源与document逐字一致，原Task完成 |
| SEO | seo-geo；本地三页内容清单及明确缺口，请求outputs/discovery-plan.md | 原包证据→独立内容/技术分析→汇合/审阅/规范交付；只据实际清单区分观察和建议，未知真实排名/流量；原始URL身份及指定交付路径完整，资源/document一致 |
| SALES | sales-strategy；合成客户分组/访谈摘录，指定outputs/sales-playbook.md；完成后正式追加一条预算更正和交付要求 | 原七类业务与独立复核完整；完成事件保留原epoch，追加输入开启新epoch并实际更正同一规范文件，新的交付/审阅绑定新内容；原记录仍可读 |

- 各案例使用fresh根目录和独立服务/项目；先顺序运行以便归因。若出现共享并发或恢复候选，再用两个项目及精确自有进程补原切点。禁止为了完成case提高既定360预算；预算用尽归为checker边界，保留原轮。
- 环境：既有本机auth.json及同目录完整models.json，凭据内容不输出；启动前分别验证registered credential、目标模型投影和实际预检请求型号一致。原Provider reader变化/实际会话/工具/产物变化驱动180秒无活动超时；90分钟仅为自有进程泄漏保护。
- 使用项目开发serve的`/ui`与真实页面交互、截图人工复核，不运行或新增UI自动化。结构checker不能替代数字、来源状态和最终内容复核。
- 结算等待真实Provider reader、原生进程/输出/请求完成后，移除所有隔离auth/models副本并核源保持。原失败日志/SQLite保留。每个逻辑交付更新记录/索引、文档检查、精确提交、fetch/merge、审阅完整待推送集合后正常push；未满足完整矩阵不关闭Goal。

## 当前状态

原输入和私有checker已落盘。MG-01在任何模型调用前因checker逐字符串比较Windows正/反斜杠路径失败；实际同一路径，改用成熟path.resolve比较，原失败原生进程exit1且physical/output/request均settled，两个authority副本已精确退休。该错误不计产品故障。

MG-02已启动：`C:/Users/hengu/.codex/opencorvus-expert-steering-20261024-mg-02`，正式开发服务19140/ui，原Task `tsk_g00VYyaN1P00F4nc7t13`。现有凭据、完整models目录、目标投影及实际gpt-6.1-sol流式预检均通过；360预算在启动前固定。服务启动时Manager保全分区有他任务的三文件修改，完整source.patch保存在该轮evidence，不将运行源伪称纯078d936d4。并行修改不在本任务提交范围。

当前真实根编排器已加载原方法/工作流并开始对原始文件snapshot/read/select；尚未完成、尚未更正预算，所有候选保持未证实。浏览器已通过隔离IAB访问真实/ui并看到原Task运行，没有运行界面自动化。

- MG首次实际planner运行时，正式Task message返回202/accepted，原Message `msg_g0VYybEYq00nKOf6pD1Y`、ingress `art_hWbd5lgSNQ7sEIgM6IU5`，原epoch1；更正完整原文和真实user来源落库，原初始调度保持。此事实只证明接受，不证明最终消费或交付正确。
- 为在真实模型运行期间继续覆盖其他原包，后续独立案例改为可并发启动，每服务仍保原360请求、独立目录/端口/数据库及实际源码差异。它们证明隔离业务运行；不把不同数据库的并发冒称同库多Project调度验收。若出现共享控制异常，再补同库两项目及重启矩阵。

## MG真实基础设施故障与共享审计（生产修改前）

- 原Task在50/360请求时真实failed，原epoch1与terminal事件`pev_g0VYydMIV00jguN1t42o`保留，未因完成截图或后续恢复抹去原失败。追加输入的原Message`msg_g0VYybEYq00nKOf6pD1Y`在1792851273805收到真实执行轮次error，原事件`pev_g0VYybEb800CYNiHQs3v`明确报告scheduler Session缺runtime contract；它随后通过同一ingress重试并看到了1200更正，但该早期错误不是模型错误。已保存真实01截图及原current.json/SQLite。
- 第二故障独立保留：来源研究者`ses_hLRbD2ZibpjZxlqm3Paa`因package publisher原生进程dispose/settlement超过5000ms而error，继而根编排器准备工具时同类失败并收敛Task failed。实际两个task.infrastructure.failed、原消息error、原Provider reader及Task终态均有原件。5000ms为何超过、物理/输出/请求哪段慢仍未知，不以扩大时限或模型重试解决；先补原生观察并做全部调用者审计。
- MG原服务已正式HTTP shutdown并沿原launcher退出0，physical/output/request真实结算，四份隔离auth/models副本退休且源保持。其他两个独立案例继续其原轮次，目前不具有MG追加输入；可为公共处置问题提供独立对照，不重复MG原失败。
- 已查共享定义/调用：全部Task/Mission/Session的Task-root参与者最终进入唯一`Orchestrator.processInvocation`；它当前在任何scheduler配置/模型/能力准备前就调用`deliverTaskRootMessageToOrchestratorSession`搬移原Message。旧SessionLoop返回standby且原contract清理后，这次真实Move可先唤醒旧loop，而新的runtime要数百行异步准备之后才安装。`message-identity.ts`和continuation校验正确拒绝缺contract；错误不应通过放宽身份校验消除。
- 旧路径未根治：原delivery fence与Mission阅读测试核内容、身份、冻结、协议及来源，却没有覆盖“已有待机loop+下一轮准备间隙”；原41项合同不包含此路径。`processInvocation`共同覆盖普通operator、Mission/orchestrator原参与者、scheduler delivery、正常/终态接续及恢复；Task epoch和Project权威仍沿原入口。配置/Provider准备失败时，原Message应保持原Task-root权威，准备完成后才能在同一真实Move中发布新的可执行输入。
- 拟先建立聚焦后端红例：真实Task创建/正式message→实际Orchestrator，沿成熟流式协议驱动真实no_action工具；只在唯一scheduler projection准备点暂停真实调用，不伪造领域结果。核准备期间Message的明确root归属和原文，再释放后核同Message/Part迁移、正确runtime/input身份及真实回复结算。该局部故障注入不称真实模型E2E；MG原运行才是自然失败证据。
- 红例成立后方案：保留唯一Move函数，把调用收敛到runtime安装之后；复用现有beforeVisibilityEffects事务primitive，将精确runtime wake的arm安排在Move可见效果之前，同事务提交后再让已有loop自然唤醒。已有Move重放沿同一身份复用。拒绝Host路由绕过、隐藏输入、第二消息或弱化runtime身份。无HTTP/Schema/持久格式变化；重点风险是准备失败、Move重放、当前可见Message选择、run-once唤醒及双Project隔离，须用真实正向合同及原MG新轮证明。
- 聚焦红例已沿原runner退出1：真实Task原no_action后，正式追加输入进入实际Orchestrator；暂停真实scheduler projection时，原Message已位于orchestrator而非预期root（正文仍逐字正确）。原root-input-runtime-red2.log与隔离DB保留。首次测试把Moved误挂Session.Event而非Message.Event，只属checker错误，root-input-red.log保留，不计产品红例。
- 重试细化：有些合法决策接续还需原orchestrator control Message。只将Move挪到runtime set后仍可能让待机loop在control Message提交前先看到原用户，因而把原Move分为异步准入和同步commit，同一SQL实现供普通交付与control preflight复用；control前驱下，Move与原control bundle处于同一事务，arm仍用原control的beforeVisibilityEffects。原Message不是control替身；无新增消息、持久状态、身份协议或语义流程gate。
- 当前根修已实施，聚焦真实stream/Task/Message合同1项3断言通过。首次修后checker错误地要求每个新runtime都绑定原operator Message，但实际已声明的control occurrence可作为当前input，原Message同时完整可见；按现有canonical control身份核对后，真实回复归属与Task绑定通过，原错误保留。相关六文件只在control-message旧测试出现一项提前观察：Database effect idle不保证异步Bus回调完成。改为等待原visible回调自身的真实Promise，保持原顺序断言后，原7项21断言通过；其余原五文件通过，不修改Bus生产语义。
- 原生处置对照：复用现有native package测试，在唯一request observer只读保留原request/ready/helper/settled及清理观察；8个并发冻结工具及后续原生操作共24个真实请求，原1项11断言通过。它没有复现MG的5000ms故障，不能据此排除共享根因。下一MG新服务将观察原dispose函数的原始handle promises和native标记，不更换factory、不延时、不重试或放宽deadline；必须分别定位physical/output/request阶段。
- 根输入修复的扩展后端验收：原runner四文件依次13/1/7/2项全部通过，另按明确test-name-pattern执行新增同库双Project交错提交1项通过，共24项；四类原参与者的只读准备、事务失败保持原owner、同一commit重放、原文身份与正确Task/Project归属均有明确输出。原六文件中的Mission阅读、standby和正式Task消息原子接受已通过。backend typecheck、docs:check（350操作/26组）和architecture-index通过。它们不是完整真实模型或OS重启验收。
- MG-03原Task `tsk_g00VYyl3AK00URPjoC7V`在19140新隔离服务上复测，202/accepted更正原Message `msg_g0VYylKwV009EBHg4hrI`、ingress `art_h5hCdth0ACMjZJX473Rg`。真实页面已看到原编排器明确接收1200、保留3000草案关系、准确复算6000/370/47/1900及40.43，随后自然继续来源整理；02截图只证明这一阶段，尚未完整交付。至少203次原生工具处置已分别观察到物理/输出/请求完成，无处置失败，不能用此排除原异常。
- SEO原轮在原writer Session `ses_hhUkRAw84u1Sqvm2BrWs`真实再次出现同类处置故障，原Message `msg_g0VYylepk00qisGfR9de`及生命周期事件 `pev_g0VYym4LP008Wza7gxKO`保持；Task随后由原编排器明确处理失败并接续同一writer，不能抹去故障。日志14:57:35处置错误、15:02:47原detached completion及root loop恢复早于本轮打开UI，排除“打开页面才恢复”的猜测。原watcher只观察Task/Message/reader而在真实结算等待期报无活动，已保留原observer失败；重新观察同一Task，不新建输入或重新起算原预算。
- 只读环境采样：当时系统CPU100%、磁盘2%且队列0、可用内存约24GiB，主要计算来自VS Code进程65608的多路Mermaid文件检索。这是同时发生的负载事实，尚不能作为原超时的完整根因；没有终止或修改这些用户进程。真实native阶段观测显示个别正常处置总耗时2735ms，但原两轮缺少失败时各阶段marker，不能猜测其确切长尾。既定5000ms和现有绝对deadline合同保持，未扩大超时或跳过清理。
