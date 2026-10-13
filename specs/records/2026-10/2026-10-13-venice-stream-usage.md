# 持续迭代第六批：Venice 流式用量与共享后台停机

## Recall

用户要求持续分批并行体验 UI/UX（User Interface/User Experience，用户界面/用户体验）、调查功能与缺陷，直到明确停止；先分析落盘 specs，再实施、真实桌面交互和截图人工复核、聚焦正向测试、必要且授权的 GPT-6.1 Sol 端到端验收、范围提交、fresh fetch/merge upstream 和正常 push，再下一批。第五批6f8c5905f已正常push，原exec51648实际exit0、全部hook通过；HEAD/origin/main/ls-remote均同一6f8c5905f。原push/delivery回执在独有 .tmp-codex-provider-url-01a133。开始检查git status，保留其他任务的权限恢复、文件、来源/压缩、电子表格和共享文档改动，不建分支/工作树。

两个既有一层分工、禁止再次委托：功能分工只读审计Venice适配器、发布包与宿主范围，UI分工只读审计设置。UI已人工查看第五批英文“1 models”截图，发现同一复数目录调用差异及自定义与目录交集重复加入搜索分母；Memory失败/空状态仅源码候选。这些独立界面问题下一批收敛，本批不捎带修改。

主agent已读当前安装venice-ai-sdk-provider2.0.2的package和唯一convertVeniceChatUsage、getArgs/doStream/factory，AI SDK（Software Development Kit，软件开发工具包）7的usage原生转换，Provider bundled/getSDK/wrapModel、llm/api共享onStepEnd、Session.getUsage、UsageLedger/UsageStats与UsagePanel各消费者；正向dependabot-runtime-contract/stream-ledger/provider-usage-normalization，06-provider计量/宿主公开合同，历史2026-10-13-dependabot-upgrades，root patches/manifest/lock和check-ai-runtime及CI（Continuous Integration，持续集成）Node设置。全仓搜索venice/includeUsage/include_usage/totalTokens/cacheWrite及统计调用：所有生产stream使用同一llm/api、同一ledger，不能在Session/统计层按Venice改数。首个错误checker路径已用rg --files定位到根script/check-ai-runtime.ts后读取，失败读取不算覆盖。

权威源：[Venice Chat Completions](https://docs.venice.ai/api-reference/endpoint/chat/completions)官方样例prompt612、completion146、total758；[官方OpenAPI（开放API描述）](https://api.venice.ai/doc/api/swagger.yaml)当前7992–8020明确cacheRead/cacheCreation是prompt子集、reasoning是completion子集，1437声明stream_options.include_usage。web工具读取该YAML失败，功能分工无凭据获取到本地venice-public-swagger.yaml，主agent按相关行直接复核；不把工具失败或网页简略schema当作“字段未知”。[SDK官方usage转换](https://raw.githubusercontent.com/vercel/ai/main/packages/ai/src/types/usage.ts)相加input.total和output.total；[上游Venice源码](https://raw.githubusercontent.com/dpuyosa/venice-ai-sdk-provider/v6/src/venice-chat-language-model.ts)已采用snake字段和per-call优先。

## 根因、影响与未根治原因

当前manifest/lock/安装均2.0.2：converter把raw.total_tokens写到input.total，再由SDK加一次output；612/146/758会成为904。noCache直接用prompt，cacheRead/cacheWrite另投，分量与计费重复；reasoning完全未拆分。全部正常流式flush调用这个唯一converter，错误沿SDK→Session→llm/api onStepEnd→provider_usage_event→UsageStats/HTTP（Hypertext Transfer Protocol，超文本传输协议）→UI传播。Session和统计正确保存收到的事实，不能在此遮蔽错误。无缓存费用仍可正确，不能宣称所有费用重复；缓存分量和有价Token覆盖受影响。旧真实本地SSE（Server-Sent Events，服务器发送事件）测试输入10/2/12，只断言input/output，漏total；6测试30断言绿不证明总量正确。

另一个同边界根因：2.0.2/2.1.1 doStream将stream_options写成includeUsage而非协议include_usage，并覆盖getArgs的显式streamOptions。工厂不设默认；Provider只为npm含openai-compatible设includeUsage=true，Venice不匹配。默认及显式选择的请求未落实当前计量合同，旧参与者无条件返回usage掩盖请求错误。官方没有承诺省略参数仍必定返回用量，不能据局部绿测试断言真实服务一定报用量。

发布包2.1.1已修input总量/cacheRead/reasoning，但未扣cacheCreation、wire仍错；2.2.0修wire但仍未扣cacheCreation，Node要求提高到24。产品core由Bun1.4 compile且Venice是bundled，随包Node22 sidecar不是core宿主；不能以本机Node25证明所有产品host满足新增要求。单纯升级任何已检查发布包都未根治三个已证实合同。选择项目成熟的Bun patchedDependencies，对现有可读2.0.2 dist唯一实现完整修复，同时ESM（ECMAScript Modules，模块导入）/CJS（CommonJS，模块导入）交付；不另存converter、不添host厂商分支或兼容层，也不使用统计重算。发布包和实际加载图分别核对，lock里的嵌套peer记录不是另一个实际调用SDK；check-ai-runtime顶层检查的绿不能证明整个lock图无旧peer记录。

影响Venice所有聊天流、Session与非Session helper、默认/显式constructor与per-call选项、输入总量/两种缓存/文本/推理/覆盖/费用以及ESM/CJS交付。价格仍用请求canonical metadata，不引入估算和真实费用假事实。历史账本缺raw详细数据，不自动迁移或重算。不同Provider适配器与通用账本保持原接口。没有调度、队列、唤醒、重试或终态异常线索，本批不改这些机制；若真实运行发现立即横向审计共享owner。全部LLM（Large Language Model，大语言模型）验收必须流式，不新增doGenerate调用。

## 修改前方案

1. 先用独有无凭据隔离生产backend/ui和本地TCP（Transmission Control Protocol，传输控制协议）参与者记录修前wire、SDK、真实ledger/Usage HTTP与可见非零统计。声明输入来自官方合同的协议样例，不是真实Venice推理或在线账单；请求合同参与者只在正确include_usage下报告usage，另明确converter-only样例用于定位各层。
2. 在唯一vendor converter使用prompt.total；noCache=prompt-cacheRead-cacheWrite，保留原两缓存数量；completion.total、text=completion-reasoning、reasoning分量。响应内部schema补completion_tokens_details，否则现有Zod解析会退休该字段。非法计数由原Session合同处理，不发明另一统计状态。factory聊天模型includeUsage默认true、显式false继续有效；getArgs把streamOptions.includeUsage映射snake，doStream保留per-call优先于constructor，显式false序列化为include_usage:false，不依赖服务省略默认。ESM/CJS同改，通过现有Bun patch/install生成唯一补丁和lock，不编辑其他依赖或添加包装SDK。[Bun官方patch流程](https://bun.sh/docs/pm/cli/patch)先创建不与全局cache共用硬链接的副本，再提交补丁。
3. 在真实production loader→本地SSE→共享streamText→Session/ledger→实际Usage HTTP的正向合同中检查默认请求、官方612/146/758、缓存读写+推理、显式per-call开启覆盖constructor false，以及显式false的真实报量合同；所有测试核对明确字段/输出/计费覆盖，不加负向断言/源码检查或UI自动化。补旧测试完整total，复用现有孤立runner与模型归一化正向回归；验证实际ESM/CJS和frozen安装/AI runtime检查、必要编译。
4. 后态重新独有运行根与同一声明输入，真实/ui桌面中英文统计、费用/完整分量、Provider/model明细、热力图详情实际交互和截图人工复核。统计响应和页事实必须来自真实共享ledger，不直接造UI或插库；数字测试不替代截图。没有Venice凭据授权，不调用线上Venice；GPT-6.1 Sol不是此供应方wire语义的证据，若改到公共SDK/loader/LLM路径再评估已授权Sol验收。本批计划只改唯一vendor实现。
5. 写当前06-provider/bilingual未发布日志、根/月/artifact索引及证据；自有tab正常关闭、production stop与实际进程exit/PID/port回执。保留并行改动，范围提交、fresh upstream同步、完整待推集合复核、正常push，持续goal active。

## 实施前状态

源码/公开数据根因与影响分析完成，产品尚未改动。本地修前完整请求/ledger/UI、vendor修复、正向合同与后态/提交推送待执行，不声明已完成。

## 已取得的修前运行与视觉证据

独有before/PID71720、生产listener/recovery、第五批私有前端，两个明确声明本地输入经实际TCP/SSE、production Provider/wrapper/ledger，GET /global/usage实际200。wire均includeUsage:true；612/146/758被保存904、1000/300/1300+read200/write20/reason80保存1600/input1000/output300/reason0，费用0.001645。严格协议参与者仅认snake，未跟踪wire探针收到正文而usage未知；这个探针不制造第三条账本。完整HTTP统计2calls/2504tokens/0.002549USD，分量1612/446/0/220；真实英文桌面总量、composition和model明细均已截图人工查看。两个参与者模式明确分开记录，converter-only报量不能冒充完整wire成功。自有tab已关闭、原exec17256实际exit0。下一步按方案修唯一vendor并补聚焦正向合同。

## 首轮后态收尾故障与共享横审（修测试前）

补丁已经由Bun正式准备/commit/frozen install安装；manifest/lock只新增单一补丁映射，两入口五处同义，类型检查与AI runtime checker通过。新增八条初版正向wire合同在旧依赖实际全部fail；复核补constructor false未设per-call后为十条。首轮后态原checker未通过：前三个实例报告InstanceSettlementInactivityError，serving/activities=0/closing=false。原exec74780被对自有handle发Ctrl-C后实际exit1，PID80516/父68952/runner7848物理已缺席；原错误日志与隔离DB保留，不重启旧scope、不把观察超时当终态。数据库最后轮有一条显式false调用的0计数记录，Session/Task/Provider activity均0；不据此宣称此前数值断言全部通过。

根因是新checker生命周期误用：Instance.provide创建lease、await callback，finally才closeLease；callback在finally await Server.stop，Server.stop调用完整process settlement，在351等待所有lease.closedSignal，其中包括当前callback。停止等待callback返回，callback又等停止；无模型/调度终态能解这个环。不能延长timeout、fire-and-forget、只清ambient context或改gate来掩盖。修正方案只把listener创建/销毁放到整个await Instance.provide之外，按真实公开关闭合同释放自己再等待全局排空。

立即横审全部生产stop/settle调用：CLI bootstrap先allSettled(provide)再settle；ACP在provide外finally.stop；serve与失败recovery为外层生命周期owner；shutdown/restart控制路由通过既有routeRequiresProjectDirectory=false无项目准入合同绕过项目lease，/global才位于project中间件之前。Task/Session共同writer先广播取消所有physical owners再join，Mission恢复按项目/occurrence区分live/woken/closing/closed；全局gate有意排空所有目录，失败release gate/恢复admission支持重试。主agent直接读取相关调用链，功能分工只读复核；本批修前真实runtime在provide后stop正常exit0，前几批多个独立scope也同样真实退出。

尚未完成的共享排除：活跃Mission/跨项目后台work完整停机矩阵未实际跑过。分工提出runInstanceBackgroundWork的内部cancel位于disposeAll、而Server先wait实例再dispose的独立顺序候选；尚无真实触发，不把源码线索当已证实bug，也不称所有共享生产根因已排除。正在沿RuntimeExecutionScope/guard与实际无凭据native primitive做独立横验。本新checker并未启动该背景工作，当前自持callback环有独立代码/日志/数据根因，先按公开生命周期修工具并重跑原验收；不改生产停机或与其他任务的权限恢复混因。

## 共享后台停机根因与扩充方案（生产修改前）

主agent已直接复核分工的独立 native Bun1.4 单/双项目 v2 observations、probe、launcher：所有外层 provide callback 已返回，后台 serving lease 持有真实文件 handle，已写入并 sync，只有真实 AbortSignal 才解除等待。正常外层 Server.stop 已到 Instance gate（新准入产生明确 InstanceProcessAdmissionClosedError），500ms 后仍没有取消信号且物理 work 未收敛；双项目释放首项目仍等待另一项目。仅测试自身外部 controller 随后广播才让两项目写入 cancelled、sync、close 和正常 exit0。这是修前缺陷复现及安全清理，不是停机成功验收。v2避免首版可变数组引用的记录错误；旧版不作为合格证据。PID80028/83936原进程已退出，主agent物理查询为空。没有Provider、SessionPrompt owner或RuntimeExecution owner，此证据定位共享背景lease，不能冒称真实Memory模型闭环。

直接原因是 Server.settleCurrentProcessExecution 在350取得 Instance process gate、351等待背景 serving lease，352才进入 disposeInstances；Instance.disposeAll在2004才调用唯一 cancelInstanceBackgroundWork。这与当前03-control“先取消、后排空”合同相反，形成背景work等取消、关闭等背景work的顺序环。既有单项目dispose、全局dispose、Scheduler取消测试只直接走disposeAll，没经真实外层Server.stop；它们未覆盖先行waitForIdle。runInstanceBackgroundWork没有对应RuntimeExecution reservation，因此前面的Task/Prompt取消不是它的信号owner，不能用空Prompt队列推断背景工作结束。生产Memory organizer没有外部ownerSignal，LLM.stream消费内部signal，其默认活动/首字节/空闲预算均可长于停机60s；scheduler-message和event-service另有外部ownerSignal，须横验前序join。不是某一专家团或模型选择问题。

已全仓搜索定义、全部三个生产背景调用点、cancel四个既有销毁/刷新调用点、gate唯一Server及三个直接checker调用点，读取03-control、server-runtime-readiness、project-memory、RuntimeExecution/Session/Task termination、Mission occurrence recovery、所有生产stop/settle入口。一般CLI/ACP/serve/global shutdown/restart/failed startup都通过同一终态协议；writer先根据当前active occurrence登记持久handoff，再向所有物理Prompt广播取消并等待完整收尾，terminal occurrence事实保留；不同Project以directory cache隔离，全局gate应同时排空全部项目。故扩充本批范围为唯一Instance背景取消顺序，不添Server专用旁路、公共接口、影子信号或延长timeout；已有fixture生命周期环仍独立修复。

实施以本节为准：在现有gate的waitForIdle校验token后，使用现有cancelInstanceBackgroundWork向全部cache entry广播，然后读取真实closedSignal并排空。acquire只建立准入边界并返回handle；放到wait起始保证Server已持有handle，取消/排空错误可由现有catch释放、恢复准入及重试，避免取得handle前异常泄漏token。重复wait/独立dispose继续使用同一controller、同一helper，abort幂等。保持已经进入的背景lease上下文直到物理清理结束；新背景准入由既有process gate拒绝；先广播全部项目，再await任何lease，避免串行关闭放大同根因。durable恢复仍由原work事实负责，不制造终态或重新选择模型。

验收扩充为聚焦正向单/双Project真实listener stop、实际文件write/sync/close、广播后完整清理顺序，以及gate失败释放/新owner再准入；原Venice三个checker重跑。复核共享RuntimeExecution、Task normal/terminal、多Project Question publication、Mission recovery、scheduler-message/event owner相关checker，不运行UI自动化。无凭据native v2新scope必须直接正常stop结束，不用外部controller造成功。公共停机原语改动后增加必要且已授权的GPT-6.1 Sol真实流式后台取消验收，先用成熟stageDiagnosticProvider成对绑定auth/catalog，分别核验凭据、目标投影和实际请求模型，再启动任务；只保存经redactor脱敏事实，所有自有进程实际结束后移除复制pair。若线上模型验收未达成，必须明确记录而不包装为闭环。

风险：全局取消是既有停机合同，现在发生在先行排空前，可能暴露真实清理错误；保留同一错误诊断、inactivity预算和rollback，不吞异常。单项目refresh/dispose不改变，历史Usage ledger不重算，其他并行权限/压缩/文件改动不纳入本批。重启恢复需保留后台任务原持久状态；当前spec不声称完整所有业务Mission矩阵已通过，待验收填写实际覆盖。

## Venice后态与工具链原验收

修正checker的外层listener生命周期后原三个checker实际exit0：10条ESM/CJS Venice正向合同98断言、6条当前依赖/ACP合同30断言、5条usage归一化5断言，共21测试133断言；原错误日志保留。两个账本调用现已使用严格wire参与者，include_usage:true、758/1300、推理80、输入1392、输出366、缓存读200写20、总2058、cost0.002329、priced2058。真实后态PID65328/port18573/参与者59491，私有前端复用第五批已build的Usage未修改源码。英文当天总览、完整composition+非零热力图详情、两模型表及中文当天composition/模型表已实际交互截图、由主agent亲自查看，模型身份原文保留；不以DOM文字或本地数据冒充视觉。自有tab14关闭，正常stop-requested后原exec26699实际exit0，不关用户窗口。首个误写stop文件没有触发清理，已读取helper后用准确stop-requested完成原scope收尾；该工具输入修正也不算产品缺陷。

## 共享修复与横向运行验证

生产改动只有现有Instance gate的四行：token校验后用现有helper广播全部cache，再await原closedSignal排空。无Server入口变化、信号owner替换、状态并源、模型选择gate、timeout增长或持久事实改写。新增真实listener正向检查在旧代码单项目、双项目串行/并行均明确fail，安全finally仅用于失败清理；修后全部通过，并加普通前台lease仍持有时的明确InstanceSettlementInactivityError、同gate重试排空和释放后新准入。以输出/事件/错误和文件write/sync/close为验收，无UI自动化或否定行为核心断言。

分工第二次只读复核建议将广播放waitForIdle而非取得handle前，主agent采纳并核对Server原catch释放。另两类入口已沿真实取消链排除前序同根因：scheduler-message新drain拥有Scheduler ownerSignal，加入已有drain的轮询者由awaitWithAbort释放自身等待；Mission receipt的session_wake_loop独立reservation先被Server取消，Task物化只确认durable ingress。event discovery的Fire登记scheduler_event_fire，提前收到runtime取消，finally释放running/permit；新Fire在关闭admission时返回明确错误并退出。保留gate当前时机，Task/Prompt终态writer仍在它前面进入项目身份上下文写持久handoff。此为代码证据，不替代真实模型业务矩阵。

原生Bun新scope无需测试外部abort释放：单项目PID69424、双项目PID81624各自已退出外层callback，正常Server.stop在现有Instance owner的明确reason下取消所有背景signal，物理文件完整写入started/cancelled并关闭，原exec实际exit0，新物理查询PID/页面端口均为空。首个后态launcher替换顺序误写worker路径导致Module not found、actualexit1，原scope保留；修准确路径后使用全新v3而非覆盖旧失败，重新跑同验收。未宣称编译安装包或发布验收。

聚焦共享横验覆盖正常/终态Task、双Project Question发布、门失败/rollback/retry、Session wake物理reservation、启动失败/重启过程独立Project队列、Scheduler message新旧Mission opened occurrence、FIFO（First In First Out，先进先出）重放与持久分页、Event Fire同身份重试/跨项目容量、Mission副作用恢复和独立verifier。原checker exit0的11个文件合计95条当前正向测试427断言：Instance背景4/20、原背景17/41、runtime settlement17/32、shutdown Task3/8、Venice10/98、依赖6/30、usage归一化5/5、startup12/23、scheduler-root8/105、event-fire12/31、Mission streamed recovery1/34（测试数/断言数）。受控transport或fixture仅证明各自合同，不冒称所有实际模型Mission串并行已通过。backend typecheck实际exit0、AI runtime checker通过，Bun正式frozen install成功；历史失败checkers保留为独立证据。最终只读复核指出应在同一事件序列上比较各实际file close和listener stop，而非仅分别await两者；已新增每项目closed→listener:stopped正向序列，重跑本文件待确认，最终断言数以新原checker为准。

## 真实Sol验收检查器修正记录

每轮均独有native Bun、完整auth/models pair、source metadata和redactor，不记录凭据内容、不refresh复制凭据；成熟stageDiagnosticProvider分别验证OAuth访问有效和目标目录，生产Provider投影apiModel=gpt-6.1-sol，实际请求audit要求精确模型且stream=true。Sol-01/PID71244在首次模型任务之前因checker误用listenWithRecoveredServerRuntime参数名（当前是options/recover）失败，aggregate的另一cleanup细节未采集，不推断为产品根因；更正当前调用合同后重跑原验收。Sol-02/PID82744真实公共预检有persisted streamed reply、可用凭据、目标已投影，Chat/Memory实际各一请求model完全一致；随后checker/session/尾斜杠请求实际404，未到计划的主检查，正常finally取消Memory reader并收尾。这个附带取消不包装为完整合格验收。

Sol-03/PID80672尝试复用已经完成的预检Memory，实际Memory和Chat都先达EOF（End Of File，流正常结束），因此未获得计划的活跃取消边界；checker在原180s观察预算后失败并正常关闭、删除复制pair。这是验收设计不足，不是生产模型或停机故障。根据实际EOF证据修正为：先完成真实公共credential preflight，再用同一已验证模型经既有/global/chat/start接纳一条独立检查输入，在其自然触发的Organizer读取真实字节时观察并正常stop，避免等待已结束的工作，也不合成消息/插入账本/拦截响应。原各scope失败与实际exit/pair-cleanup回执保留，Sol-04正向完整收尾仍待原exec结果，不能提前宣称通过。

## 最终验收状态

Sol-04检查器将公共start的合法202误写成200，原actualexit1及pair cleanup保留；主agent直接读当前global route的202 schema和handler，更正现行正向接纳合同，重新启动独有Sol-05，而不修改产品路由。Sol-05/PID66224真实credential preflight得到持久流式正文，随后公共start202自然触发精确Session/Project的Memory helper。主agent亲自读原事实：apiModel/modelID/providerID均openai/gpt-6.1-sol，HTTP200，真实2chunks/5410bytes，activity attempt0，status organizing；普通外层Server.stop后同一Response reader terminal=aborted，持久status retry_wait、pendingCount1。此次观察至关闭102ms只属于这次运行，不是服务延迟保证。4个实际出站请求都stream=true且模型精确，其中预检Memory/Chat均EOF，主Memory明确aborted，主Chat在收到Response之前因取消fetch_failed、HTTP和reader身份未知，不制造第四个HTTP200或reader收尾事实。原exec63736实际exit0，父进程已确认port18574释放并移除复制auth/models，root物理PID查询0。没有线上Venice请求，没有凭据内容进入spec/artifact/提交。

只读最终复核的序列建议已实施：原文件4测试23断言实际exit0，全部物理file close发生在listener:stopped之前。因此11文件当前合计95测试430断言；既有427是序列补强前的真实历史成绩，不覆盖当前断言数。对empty streamOptions的额外疑点已以实际ESM/CJS schema与public d.ts排除：对象optional，但内部includeUsage必填，不能将{}擅自当作合法选择；未增加无需求的协议。partial usage内部宽读不代表线上任意组合，官方required三字段及现行Session归零合同保持。

本批实际边界：真实Sol只验证必要的公共Chat→自然Organizer后台流→普通停机→持久retry事实；重试与重启、Task/Mission多项目的其他验收为各自聚焦受控合同及native primitive，不宣称完整线上业务矩阵或自动复跑Memory。当前版本未发布，不创建tag/Release/PR，历史账本不重算。当前03-control和06-provider合同、双语未发布日志与索引已更新；文档checker、范围提交、fresh upstream merge与正常push仍待执行，只有实际回执确认后才称本批交付。

文档checker随后实际exit0（348 ops/26 groups），代码和新正向测试格式检查通过。暂存期间其他任务在同一manifest/lock追加Univer补丁，复核已发现并用精确cached patch从本批暂存移出，完整保留其工作区内容与补丁文件；三个共享README也只暂存本批两行，未包含他人重排。日志中Bun输出的行尾空白保留原证据，不把格式差异当功能失败或重写原日志。提交/推送实际回执保存在独有.tmp-codex-venice-usage-01a133，本批后续摘要以原exec退出与远端身份核验为准；持续goal保持active，下一批按已有UI调查继续。
