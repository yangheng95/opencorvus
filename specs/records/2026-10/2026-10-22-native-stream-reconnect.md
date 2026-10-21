# 同文档事件流断连与恢复

## Recall

512继续单开发agent，无Codex子agent或外部任务委托；旧Goal三Astra文字由用户后续明确单agent要求覆盖。用户要求持续自主修复Sources与Rendering（渲染中）、实际Sol验收、内置浏览器调试、验证后提交推送。上一轮511为progress：604517cbf513b58ffd7bf3fffdd58af0ee883acd已正常push、fresh HEAD=origin/main；15次真实流式请求、十张实图，原B source reader覆盖整页刷新前后，生产未改。同文档实际断连仍未取得资格。原83274/native/所有reader/launcher完整结算，96/97页关闭、auth/models四个副本退休、原数据/schema3保留。开始status仅原.bun/与packages/opencorvus/bun/未跟踪，保留。

已重读511 Recall、AGENTS、当前sse.ts selected stream owner/performSseReconnect/cursor、tauri-transport EventSource关闭与业务恢复、SubagentPanel现有target/resource保留合同、真实Task事件路由及server/sse的原request.signal→abort→订阅清理、Server.bind/listen/transfer和CLI关闭合同。全仓搜索SSE（Server-Sent Events，服务端发送事件）关闭、dispose、Bun.serve和requestIP，实际生产Task事件路由在orchestrator.ts，browser host实际共用tauri-transport.ts；纠正初次猜错路径，没有把搜索失败当产品失败。沿已应用computer-use与benchmark-debug-template技能，无委托。

## 修改前分析与方案选择

当前初始Task恢复已从精确global索引/持久目录走原选择器；同文档断流应该由现有SSE owner从当前durable/live cursor重开，保留同一目标已接受正文。未经授权的浏览器原生EventSource首次error即close，避免它自己重连旧URL形成第二恢复所有者；带Authorization则走真实fetch流，共用业务恢复。普通Session另有原恢复分支。尚没有新生产缺陷，不能据已有注释推定实证通过，也不先补缓存/隐藏Rendering。

实际浏览器级capabilities只有visibility/viewport，页级只有pageAssets/webmcp；当前Windows token不是administrator。没有浏览器offline接口，不更改系统网络、kill用户浏览器、提升权限或重启进程。/instance/dispose和/global/dispose在有Prompt时受409合同约束，而且会改变项目生命周期；Server.stop会结算执行，不能冒充单条网络断连，均不用于本轮故障触发。

可用的真实传输控制是运行时原生[server.timeout(Request, seconds)](https://bun.sh/reference/bun/Server/timeout)：官方[HTTP Server文档](https://bun.sh/docs/runtime/http/server)说明空闲期间包括流式响应，连接超时会在浏览器呈现reset。当前生产listener全局idleTimeout=0、Task心跳10秒。本轮只在自有诊断进程的一条选中Task事件流设置1秒空闲超时，经过真正原生连接中断、原request abort和现有重连链；不生成SSE帧、不换响应、不改产品路由/消息/模型请求，也不重启listener或重置预算。先真实HTTP校准，尚未知现有Bun版本在handler返回后对active Request的timeout是否可用；不能凭API存在宣称断连。

诊断只捕获现有Bun.serve实际fetch入口及原Task events Request/Response，原参数、this、响应字节和signal原样传递。私有控制文件只允许该自有根、已声明Task身份、有限已声明nonce与原生超时动作，记录实际peer、request ID、stream instance、durable/live query、原abort和后继实际请求；不打印headers/凭据，不创建产品控制API或平行恢复实现。若calibration未触发真实abort，停止提升资格并修复工具链；不伪造关闭回调。

横向审计覆盖所有生产selected Task/Session/Mission恢复入口、正常/终态/首次/追加/live replay过期、原authority/selection epoch/Task目录和多项目隔离；本轮先从真实历史Task事件流入手。出现调度、队列、唤醒、恢复、并发或终态异常立即核对Task/Mission/Session occurrence（执行轮次）、正常/终态、重试重启、串并行/多项目共享机制，以真实持久/请求/reader证据决定影响面。不用单场景通过排除全部共享根因。

## 启动前计划与边界

1. historical零模型scope：只读完整关闭511-before并serialize全部90表及原字段/身份/时间、完整五键canonical到native-stream-reconnect-512-historical；原source bytes/mtime/schema3/实际对象/integrity保持。正式main-B1unUUgO、Source CLI（Command Line Interface，命令行接口）开发/ui18949，原生20分钟/启动180秒无活动边界，零请求、不复制auth/models，不操作用户18571/真实库。
2. 私有原生传输观察/控制装在当前owned Source CLI helper；historical最多两次已声明切断：先一个真实HTTP reader校准，再一个内置浏览器实际页面已有selected Task stream。两者只选择原tsk_g00VYhrJxy00qIC54qvM，原生timeout1秒。首次正向checker记录真实200/原事件/原abort或stream read连接错误；随后对照正常重开HTTP200。不是UI测试，也不把校准当网页验收。
3. historical实页选择原B、Sources/长文/阅读位置，截图后对当前Task事件流触发一次原生idle timeout。记录原stream instance中断、同一PID/authority/文档、后继请求的最新cursor、原Message/Part/Source与真实可见状态；实际截图人工复核，禁止DOM（Document Object Model，文档对象模型）/源码文案/组件/快照/像素或UI自动化断言。不注入私有响应式观察器。
4. historical完整结算后，只有原生触发机制真实成立才进入live18951：固定最多32次实际gpt-6.1-sol流式请求，包含完整auth/models配对预检、所有helper及一个有限双成员Task；沿511成熟输入、自然审批/工具/正文/完成合同，不让产品成员验收UI。复核活跃窗口真实断流恢复；一条native timeout若因持续事件一直无空闲，最多等待明确窗口，不能无界重试或强造内容。模型预算不重置/活动扩额。若生产缺陷需修复后复验，条件review18953另固定32，总最大64，未用退休。
5. 每次改生产前补现象/触发/数据流根因/旧遗漏/定义调用/公共契约/数据/测试/文档/交付/风险，再改唯一实现并正式构建实页复验；无证实根因不强造补丁。非UI改动有聚焦正向合同；UI只真实交互/截图，不新增/运行自动化测试。无schema/迁移、持久格式或版本变更预期。
6. 每scope原Task/reader/预算/页面与原exec/native/output/request/launcher/精确出生链完整结算；模型资格与已关闭配对退休独立，任何失败如实保留，实际秘密值扫描。全量原数据核对，真实容量租约变化逐项记录，不回填旧租约。只归档非秘密证据、更新三索引及docs/architecture，范围提交，fresh fetch/merge/完整待推集合/正常push/hooks/fresh相等，无分支/工作树/PR/tag/Release。长期Goal active，未覆盖矩阵不冒充通过。

## 进度

historical18949/原5291/native88712/IAB98已完成。原生HTTP校准真实返回200、29635字节，设置单请求idle timeout1后服务端记录原request abort，客户端在3.697秒读到TypeError ECONNRESET，自己的20秒观测上限尚未到；校准exit0。没有代理、假SSE帧或手动abort回调。

历史实页原B ses_h0gcSAerl0lMXEbz1cq3在01图展示原ACL来源/长文；只对已有Task events Request 057bd3cd…设置native timeout。18:00:54.815Z实际abort后，18:00:57.830Z原页发出新的stream instance，18:00:57.833Z原响应200；前后durable after=41/live=0、原目录、PID88712及原native occurrence一致，未reload页面或重启进程。02图原B正文、Source和阅读位置保持，可见文字5810字元、scrollTop0/height6716/client576均保留。没有对DOM/截图作断言或连续帧资格声明。

historical公开shutdown200、原5291 exit0、native physical/output/request/launcher/精确出生全部结算，98页关闭。0模型/max0、无auth/models副本；源90表156566原行/全部字段/身份/时间、source bytesmtime/schema3/实际对象/integrity及完整五键canonical保持，全部计数相同，Provider activity391→391。browser errors观察为空仅补充事实，真实断流依据是原HTTP/abort/后继请求。当前尚未创建live配对、服务或新Task。

## 活跃阶段实施前补充

原生idle timeout适合已有空闲事件流，活跃正文持续发包则不能保证在指定窗口断连。不得等成员结束后把超时误报为活跃流资格，也不阻塞整个事件循环强造空闲。本轮live改用明确的受控响应流错误：在私有自有Task events响应的原gzip字节流外增加透传TransformStream，正常时逐块原样透传；对已选定的一条响应执行controller.error后，经真实Bun HTTP socket错误、原上游取消/请求abort和既有EventSource业务重连。此原理按[WHATWG Streams标准](https://streams.spec.whatwg.org/#ts-default-controller-error)及当前server/sse.ts已有pipeThrough取消传播核对；仍须独立真实HTTP校准，不能凭代码或标准宣布通过。

这是对前述“不换响应”的明确有限修订：historical原生timeout阶段响应原样，live为可精确中断活跃响应而包装传输体，但不合成、修改、重排或重放任何业务字节/SSE事件/Message，不改生产实现或模型网络。正常/断流均走原产品路由和原Reader；网络错误是实际注入的故障，不冒充自发生产事故。诊断观察、有限动作及目标身份只有一个当前实现；两种触发模式分别用于已声明场景，不增加产品兼容或恢复路径。

live固定32预算、18951、同一进程原20分钟边界不变；先以真实预检通过的服务对原历史Task校准一次受控响应错误，再由真实/global/tasks的202结果更新私有诊断目标到唯一新Task，对实际选中成员正文执行一次切断。各有限动作只作用于自有runtime当前目标的原Request，保存原request/stream/Task身份与实际abort/后继请求。保留历史scope的原网络观察器源码快照用于证据，不将磁盘新版本冒充其运行中版本。只有校准通过才创建新Task；失败先安全收尾/修复工具，不追加模型业务任务或重置预算。

## 活跃断流实际结果与工具修复

live18951/原7582/native81944/IAB99，完整auth/models配对与真实预检证明credential usable/catalog projected/实际gpt-6.1-sol stream=true。先在原历史Task校准透传响应错误：HTTP200/29635字节后，67毫秒内实际ECONNRESET、原始pipe取消完成，独立20秒观测上限未到。此模式原Request.signal没有记录到abort，因此只报告原上游pipe取消和客户端真实网络错误，不将它伪称为原生Request abort；historical原生timeout阶段有独立真实abort事实。

校准通过后POST /global/tasks实际202，创建tsk_g00VYi18zf00L6NKm1vM、prj_hXGZn4ibvNznhd8s9TTo及843504c8目录。两个真实成员A ses_hPtD0Cq6Vusfjey7Dmq7、B ses_h9O6QslVnv3xNRX0ZbdA分别经原派发/网络Allow Once单次读取指定arXiv/ACL并输出长文。snapshot002两正文Part1950/2215字元且均未完成。04图原B仍在第七节、可见文字4606字元；点击第二节并未暂停自动跟随，实际scrollTop4770.4接近底部，不能声称已验证非跟随阅读位置保持。

18:14:01.247Z只对当前原Task SSE响应1cffe43d…执行一次受控传输错误，18:14:01.249Z原pipe取消完成；18:14:04.259Z同一页面发出新stream instance，18:14:04.263Z真实200，新请求从当前durable after=21、live after=6915/epoch1792606202150恢复，PID81944/native occurrence及原Task/目录保持，未reload页面、未重启服务或重置额度。B原msg_g0VYi1Y1X00i6mOc3Trn直到18:14:17.753Z才完成，晚于重开13.49秒；原Provider source reader完整覆盖实际切断/重开，消息继续原输出。05图原B增长到5700可见字元并完整结束，06原ACL标题/域名/入口保持，07原LIVE512B_END和Completed可见。所有七张实图均实际查看；没有连续帧或跨所有状态资格，不据几张图宣称全部Rendering已解决。

发现私有控制器缺陷：先验证当前Task再检查已消费nonce，校准动作消费后仍在控制文件中，创建新Task更新目标会把那条旧动作重复报成AssertionError。源原JSON网络日志保留；这不来自产品、模型或恢复路由。保存实际运行historical v1/live v2观察器快照，完整关闭原服务后才修当前唯一实现：提取resolveOwnedStreamAction，让已消费动作先返回retired receipt，再验证尚待执行动作的当前Task/模式。两个纯后端诊断控制合同先以原顺序复现1失败/1通过，再修复后2通过；断言为明确retired/admitted输出，不是“不调用/不存在”的负向测试，也不是UI测试。真实断流运行使用已保存v1/v2，当前v3修复控制器只以聚焦合同验证，未冒充额外真实模型复验。

生成live helper初次遗漏stage的or形式校验，data prepare在数据库复制/授权配对前assert退出，准备器先前已复制的正式前端不受影响；修正当前生成器及精确输出后重跑原准备通过。另一次apply_patch输入自身的JavaScript字符串语法被工具拒绝，未执行文件/服务操作；改正后正常启动。没有把这些工具故障写成产品缺陷，没有为了重跑重置模型预算。

Task按原消息证据/真实完成审批自然completed；最终pending交互、未完成assistant和Task prompt owners均0。实际15/已启动32、批次最大64，全部精确gpt-6.1-sol、stream=true、HTTP200、原source reader EOF、exhausted false；review未启用/未复制authority/未建服务，余量退休。live公开shutdown200、原7582 exit0、native physical/output/request/launcher/精确出生链完整结算，99页关闭，runtime及私有源auth/models四成员退休，实际秘密值扫描155文件/118681451字节0命中，原auth bytesmtime/access/refresh和完整9155406字节models及mtime保持，无refresh/exchange。shutdown sessions=1仍对应原预检Chat wake owner，Task范围已完全结束，按511同一共享收尾机制核对，不能用console计数指认执行异常。

两scope源90表156566原行/所有字段/rowid或主键/时间、source bytesmtime、schema3/实际应用对象/integrity及完整五键canonical保持；historical全部表计数/原行保持，Provider activity391→391；live三条容量租约的lease_id/owner_id/time_acquired/expires_at随新执行正常变化，其余原行保持，Provider activity391→400，真实新增Task/Session/Message/工具/生命周期保留，不回填旧租约。无用户18571进程/窗口/数据库操作、清库或升级。

本轮没有证实需改生产渲染的根因，生产源码未改；完成了真实同文档历史/活跃断流恢复资格，并修复私有有限动作控制器。带Authorization的fetch SSE、独立Work/Mission、原生应用WebView2、连续帧及全部Rendering、149目录完整性能和Rust父图仍未达。接下来归档/三索引/docs/architecture/范围提交与正常upstream同步/push，长期Goal active。
