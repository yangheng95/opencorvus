# 既有Task成员的目标与正文生命周期

> 后续用户已明确确认闪烁早已解决，并纠正重复排查偏离了完整产品迭代。该调查线已关闭；下文保留当时观察的历史边界，不再作为Rendering待办或后续验收门槛。当前工作见[完整产品体验](2026-10-25-current-product-walkthrough.md)。

## Recall

591继续用户授权的自主产品迭代；当前只用一个编码agent，不委派，不创建分支/worktree，只在实际且无法安全取舍的冲突时等待。上一goal turn为progress：1a3917ae8修复Undici/Zod/DOMPurify/Astro安全依赖、控制程序静态声明初始化及时间精度合同，真实HTTP/SQLite、8类类型、OpenAPI/docs、网站构建和人工中英文页面复核完成，正常hook推送后fresh0/0；GitHub实际JavaScript五条告警关闭，剩余4条Rust（含两个历史before锁）。本轮回到原成员Dock反复Rendering与Sources体验，不把安全补丁代替原始目标。

开始HEAD1a3917ae8，工作区187行既有变更属于其它会话/已有删除：包括overlay events/subagent-conversation/tree-writer和两个UI测试删除、fact-check prompt、Git source实现/测试、三个共享README与架构记录及缓存。全部保留，不将其混入本轮交付。已有UI自动化测试删除不恢复、不运行。本轮不会操作18571、用户窗口或活动用户数据库。

已读588/589 Recall与原真实流/分组证据、07-panel-reactivity公开合同、SubagentConversationPanel所有target/resource/storage/live/reading分支、TextPart/model/worker、CardParts分组、ConversationCard/ChatBubble、agent store hydrate/live更新、main选择scope和ApiAuthority实际定义/全部更新调用。589的234/236可投影Session、21个用户上下文重放坐标变化和758条最终词法结果，不能证明实时Task正文owner稳定。588/588b两次普通Session真实长流owner47在人工采样稳定、Sources归属完整，也没有覆盖原Task成员轮次；两个真实缺失Message错误、未持久化token前缀和采样间未知保持。

## 修改前分析

可观察现象：原截图密集Sources成员栏在正文间出现Rendering。当前提示条件是pending且已挂载HTML为空；正常append渲染保留HTML，整批agent hydrate在同一Solid batch提交。需要区分当前成员缺失、target变化/组件退休、同一owner源回空、词法结果空和worker排队，不能隐藏提示或扩大缓存遮蔽根因。当前尚无新生产根因证据，不修改界面实现。

本轮已核实一个候选不成立：ApiAuthority只有URL/凭据变化或原生实例真实轮换才advance；普通SSE/同源恢复只推进独立workspace epoch，不会改变它。target/选择使用authority是公开数据隔离合同，不因名字revision就删除它。activity store对整个Session的最新execution记录、parent/stage、snapshot membership仍需在原Task真实运行中观察。

当前Task公开operator-steer只提交有固定request_id的真实agent_coordination_request并唤醒orchestrator；它不直接向worker写消息。已读路由、EngineService、target lineage和原WorkerTurnDescriptor校验。原Task537的B成员存在实际历史身份；不能使用普通Session prompt绕过该权威。只有原生orchestrator按当前投影自然继续该已有成员，才算覆盖，不将一次202或模型自述计为成功。

影响面为普通Session/Task/Mission共同消息呈现、backend真实Bus→bridge→agentView/transcript→frontend live/store→target/CardParts→TextPart。此阶段不改调度或持久协议。如果出现调度、队列、唤醒、恢复、并发或终态异常，立即横审全部生产入口、Task/Mission/Session执行轮次、正常/终态、重试/重启、串并行与跨项目，不以局部用例降级。任何生产修复须补齐定义/调用/公开合同/数据/测试/文档/交付风险后才实施。

## 实施前方案与验收边界

1. 使用已完整关闭的588b schema8副本作为只读源，复制全表、原字段/时间及canonical配置到fresh591隔离目录，保存源文件bytes/mtime与逐字段事实。先以有限进程只读检查原Task/成员/Worker描述符、冻结模型与运行事实。原源不迁移/改写；目标已有8不升级。Provider凭据先不复制；模型目录与凭据在决定执行时必须成对转交，分别确认凭据可用、目标Sol投影、冻结合同与实际请求精确一致。
2. 仅当原任务与成员当前契约允许时，在独立native开发/ui使用已有Task与B Session；不创建新Task/Goal，不委派编码工作。通过唯一公开operator-steer发送一次固定request_id，要求原成员完成有明确终止条件的只读来源核对与带来源分节正文；不重发未知结果、不直接写入子Session、不注入/合成消息、提示或Part。初始诊断预算0；真实执行上限18个精确gpt-6.1-sol流式请求，工作/记忆/后台合计，启动前明确全角色配置，不把未投影说成无凭据。预算不因失败或观察超时扩大。
3. 最新Node生产Vite构建发布到自有不可变前端资源目录，必要时只使用被动owner/pending/源长度/HTML块数/退休观察，不增加UI断言、测试或业务行为。UI验收只用真实页面手工交互、截图并人工查看；结合backend原事件和真实持久结果定位触发点。旧历史/DOM统计/console clean/类型build不得代替实时或视觉证据。若不能取得真实续跑，保留原错误，继续合法的独立调查，不伪称覆盖。
4. 自有native进程使用生产ProcessFacade/Windows Job，20分钟物理上限，至少5分钟提前开始原公开停止/关闭；原caller、HTTP、全部Provider reader、native/launcher、双输出、请求与精确出生链必须结清。有限请求按真实活动重置180秒无活动观察；原handle观测超时不是终态，不重启同scope。凭据/catalog关闭后清退，源数据/配置与当前catalog原件核对。除公开续跑的自然状态变化外不得改写原数据，以完整差异说明。
5. 新spec/证据同步三索引和目录README，按实际变更运行聚焦正向非UI合同与真实checker，正常文档/类型/OpenAPI检查。所有本轮修改范围提交、fetch/merge上游、完整待推集合审查及正常push；TLS故障采用已验证的单命令schannel、sslVerify=true、HTTP/1.1，保持证书与hook，不改持久Git配置、不发布Release/tag/PR。

## 当前真实预检与计划修正

fresh591源/目标schema均8，92表214319原行，零凭据预检原有限进程退出0/Instance dispose，所有原Task描述符、成员身份、冻结模型及配置均精确Sol。另复制原不可变包修订9文件70361字节、durable publication文件及数据库命名空间内原PNG/metadata；模型目录完整投影。Node构建当前源码和被动Part/body/scroll观察（main-C2S7-n7X.js）通过，目标DB大小/mtime在构建前后相同。未注入业务状态或UI测试。

启动前逐项审查发现继承launcher仍指向普通412项目，已在执行前改为原Task实际537目录；未以错误项目启动后绕过身份检查。native54088使用生产Windows Job/20分钟deadline，06:15:11Z—06:35:11Z，最迟06:30开始停止；当前原exec90303仍有效。真实OAuth注册、完整catalog、模型投影及Worker描述符再次通过，startup recovery attempted0；未触碰18571。

首次自制协调ID错误使用operator-steer前缀，真实route明确400/invalid_format/request_id，未受理，原输入/结果保存为invalid-id文件。修正验收caller使用已声明artifact身份前缀后，仅一次有效POST202/EOF，固定art_591_fac85b54-1cf6-4aa8-8fa0-d9d6e2e3fb17。没有重发未知结果或改服务端校验。

实际Task已completed；当前orchestrator/agent.ts的terminalConversationAuthority明确只允许对该协调请求作acknowledge_terminal，不能派发工作或改变生命周期。真实orchestrator两次精确Sol流均200/原reader EOF，实际回执明示未向B传递指令；B正文没有新轮次。该结果是当前入口合同的真实边界，不判成丢唤醒/调度故障，也不能冒充已完成Task成员Rendering验收。UI手工基线已看到原B完整Sources/正文，scroll1、23个body owners2—24；console首次订阅前的mount事件未捕获，DOM被动观察是补充，不作自动断言。

据此将本次实际续跑入口修正为现有`POST /task/:taskID/message`（TaskMessageInput: text/source/model），追加一条新的明确后续工作授权；原协调回执保留，原18请求累计预算不重置。主消息只发送一次、无自动重试、不用inject或普通child prompt。仍复用原Task/B/原来源责任，不创建新Task/Goal；正式root Message和所有后续自然参与者必须公开可见。该修正发生在新发送前，沿公开Task新输入/终态重开合同，不改host数据或workflow规则。最晚06:30开始原公开取消/关闭并join，若时间不足保留未完成状态而不延长scope。

## 本次真实运行结果

公开Task新输入一次受理202，原reader EOF，ingress为`art_h02HA45x94ZXV3QxHBZv`，真实用户Message为`msg_g0VZ2WmdR00VOSZ9Um99`。原orchestrator通过实际dispatch_agents continuation继续原B，未创建新Session。B按Tabs、Disclosure、Dialog顺序各完成一次webfetch，逐次可见说明后输出最终Message `msg_g0VZ2XjG400zvKgj8s3r`，正文Part `prt_g0VZ2Xlrx00vqX4HSgM3`。关闭后的只读SQLite核验确认3510字符、八节标题、六数据行表格与三个新source-url；每个来源均与同Message下原webfetch request和completed outcome绑定。该检查基于真实持久结果，不以模型自述或202代替执行。

主agent在真实`/ui`选中原Task/B，逐次使用Allow Once审查上述只读来源操作，最终允许该隔离Task完成。三张归档截图均实际呈现并人工查看：基线、第一来源/新增正文、完成后展开Tabs摘录。标题、域名、复制控件、原工具归属与摘录均可阅读；展开保留了成员上下文。第一次尝试点击来源时新的第三次webfetch权限弹层已出现，控件因此不可交互；保留失败输入，消除弹层后实际展开成功，不将该次无匹配操作判为Source故障。关闭服务后的额外长文图包含预期Offline提示，仅作私有保留，不冒充在线验收。

被动浏览器日志七次采样共584条唯一记录，其中578条body-state。新增长文owner37在被采到的379—3510字符区间保持同一Part身份，HTML块由5到30；pending切换时已有正文保留。初始正文owner32、前两份来源说明owner34/35分别观察到首次零块到一块的实际加载，然后继续保持身份。23个原历史正文owner2—24，在初始、派发、新来源和关闭后保留页的采样中一致；滚动owner均1。最终保留页共28个正文owner，新增第三份说明owner36及最终长文owner37。完整实时初始mount、owner36流式过程、长文前378字符和日志采样间隔未覆盖，不能将计数当作闪烁频率或完整寿命证明。

原GlobalBus（全局事件总线）被动记录2818条：265次Part更新、2549次delta、4次Part移除。移除项是原pending Tool向持久Tool request/outcome转换的工具Part，不能仅按名字判作正文丢失。观察器对delta记录的是单个增量长度；不使用其appendFromPrevious字段证明累计正文正确性。

另核对历史72bacb0cb：2026-09-19曾修复ConversationCard普通条件依赖整个投影对象、使ChatBubble反复创建的问题；当前非keyed Show已具备稳定布尔分支。本轮真实样本支持当前分支的限定稳定性，但原用户后来报告的高频Rendering仍未在本轮复现，未证明它就是同一旧根因，不追加隐藏提示、扩缓存或替换Index的补丁。

## 物理收敛、数据与验收边界

06:29:44.574Z原公开shutdown请求到达，06:29:44.662Z返回200，距离固定deadline仍326740ms；原exec90303、launcher和native均退出0，生产ProcessFacade（进程门面）证明physical/output/request完成，精确出生链均dead_or_reused。复制auth/models在确认原链关闭后退休；原auth大小/mtime与catalog完整字节/大小/mtime保持。

累计15次真实精确gpt-6.1-sol流，均200且原reader settled；其中14次EOF（End Of File，自然读完），最后一个orchestrator后台memory流在实际shutdown到达后50ms内终止为aborted。工作正文与任务已完成，但原全reader自然EOF指标未满足，不能记为15次EOF或重新启动扩大预算。继承的全EOF退休前置检查真实失败已保留；凭据清退改为独立核对实际物理闭合、全部reader settled及唯一memory取消落在原shutdown窗口，再清退副本，不修改产品验收结论。

源数据库95,719,424字节、schema8、92表214319原行逐字段保持，源mtime与canonical配置相同；目标schema仍8、integrity_check为ok，全部原行保留。目标七个原行的自然变化已逐一核对：原QA项目的memory_chunk内容/token/更新时间、memory_file更新时间、三个原Session更新时间及两个容量slot租约。两个slot的expires_at分别为1792909784625/1792909657073，均早于进程终态；durable-execution-capacity.release的现行合同正是保留行并将expiry写为实际释放时间，不是仍有活跃执行。新增持久事实见preservation.json，未修改用户18571库，也未做schema升级。

本次不可变前端publication `main-C2S7-n7X.js`来自当前工作区，包含开始时已有、尚未提交的三个message.moved消费者修复；它们归另一进行中交付，不混入本提交，也不能将本次结果称为纯净1a3917ae8或8ce8a4649版本验收。后者在本轮期间由已授权CI会话推送，其范围与本轮证据独立。后端运行使用当时工作区源码，并非额外冻结的纯净提交快照。没有新增或运行UI自动化测试；诊断只存在私有构建插件，生产源码未添加logger或业务状态。

本轮交付为真实原Task成员续跑、Sources实页与渲染生命周期的限定调查，原高频Rendering根因及整体产品迭代仍未完成。证据见[本轮产物](../../artifacts/2026-10-25-task-member-rendering-lifecycle/README.md)。文档检查、范围提交及正常上游同步/push结果在形成后补记。

本轮新增记录与证据已同步三个索引。隔离固定Bun1.4.0运行当前`docs:check`实际检查350 operations / 26 groups通过，原caller与生产inactivity runner退出0并排空输出。当前没有生产行为变更，不新增以UI源码、DOM或组件为断言的测试；真实页面与持久事实是本次限定验收证据。提交后的正常pre-push仍执行仓库完整必需检查，不跳过hook。
