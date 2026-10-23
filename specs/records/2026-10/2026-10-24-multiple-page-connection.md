# 多页面共享连接调查

## Recall

558继续单agent自主迭代，后续禁止多agent的用户指令覆盖旧Goal中的Astra文字，不委托。557是progress：a2cc9ffb4已通过完整hooks、正常push和fresh0/0；定位专用剪贴板reader首次初始化边界并修正人工验收，真实574/51840字符粘贴通过。四自有页194—197、19159服务/原exec28757已全部关闭，0模型、catalog退休、90表169304原行保持。额外观察是三个同源页并存时196短暂Connecting/主输入disabled，后端health200，关闭另两页后原页恢复Online，未刷新或重启；该关联尚非根因。

起始工作区有171项旧素材删除、62项专家团/生成文件/测试/架构/CHANGELOG/共享索引修改和三个未跟踪路径，全部归属其他工作，本批保留且不混入。最新已发布Goal加号菜单b731725ad独立交付，UI正式构建入口main-CpLITCN5.js，workspace dist-vite与该记录一致；本批冻结其完整字节到自有bundle，不重编或资格化外部专家团源码。

已读557Recall及闭合事实、Goal菜单真实资格、07-panel-reactivity连接/请求/流所有权，检查HostTransport.openStream全部六个生产调用：selected Task/Mission、work-ledger、Side Session、panel/message POST、VCS commit-message POST、MCP App订阅；读取tauri-transport的原生EventSource/带Auth fetch GET/POST分支及原关闭/超时协议，sse全局与选中stream启停，connection健康检查和main模块关闭。现有相关stream测试是纯Host/事件传输合同，未发现所读路径的DOM/组件/UI自动化，不新增运行UI自动化。PowerShell误用了只读$Host变量的只读调查已改为任务变量，未影响产品或运行器。

## 修改前分析与横向范围

可观察异常仅为连接和输入准入的暂时变化，没有模型任务、业务队列或终态变化证据。默认每页work-ledger/events及selected task/session events各一条；Side与MCP订阅可另占流。Browser与Tauri当前均由同一个HostTransport进入原生EventSource（无Authorization的GET）或fetch流（有Auth GET、全部POST），业务层拥有重连，物理关闭调用原source.close/AbortController。当前Bun.serve使用普通HTTP localhost，没有TLS/HTTP2配置。健康GET有5秒AbortSignal，事件流打开有10秒界限。连接额度、未释放的流、启动配置成本、服务本身阻塞仍需真实因果区分。

这是共享连接/恢复/并发问题，不能降为一个Task局部：横向审计包含全部六类入口、Task/Mission/Session身份及执行轮次约束、正常/错误/终止/重试/页面关闭/服务重启、并列与串行、同/不同项目和已有权限隔离。执行层调度/唤醒不先修改；只有代码与持久事实及实际运行排除其根因后才将影响收敛到连接机制。发现执行异常立即扩大到其全生产链，不以无模型或单场景通过代替排除。

MDN当前官方说明指出HTTP/1中的SSE（Server-Sent Events，服务器发送事件）连接数在同源多标签页共享，常见上限为6：[Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)。这是候选解释而非本仓根因结论，不采用搜索返回的第三方方案或其自动化测试建议。没有先决定引入SharedWorker、旁路HTTP请求、延长超时、轮询后备或第二事件流。

## 真实复现与证据计划

fresh multiple-page-connection-558，19161，20分钟原生进程边界、180秒启动无活动、至少五分钟收尾。完整复制正常闭合557的90表/原字段时间/canonical，源字节mtime保持；复制完整models用于历史投影、不复制auth、真实Provider请求预算0，不操作用户服务/窗口/数据库。UI冻结为已发布main-CpLITCN5.js，启动后核对页面实际入口。

Source CLI现有BeforeRequest观察钩子只记录method/pathname/时间、events的现有stream instance ID与incoming abort事实，不拦截请求、不改响应、正文/认证/完整query不入日志。后台原日志和native端口连接快照作为独立辅助。直接健康探测带本scope诊断header，仅标识自有非浏览器请求，证明当时真实服务器响应；不以直接HTTP替代网页资格。

先单页真实Task至Online，保存实际截图及请求/流；再第二页同Task，最后第三页，人工逐步观察Online/Connecting、配置/项目请求是否到达服务、原流/连接数和时间。若重现，在原服务和页上正常关闭已完成自有页释放连接，观察原页恢复及请求到达，禁止刷新/重启来制造通过。根据实际结果补做不同Source/项目、Side/普通Session或页面关闭组合，保持原20分钟边界，不发Prompt或委派。所有动作人工，无浏览器fixture、自动动作循环、DOM断言或截图基线。

若证明产品根因，补齐定义/调用/公共协议/旧路径未治原因/测试/风险及唯一实现方案后再编辑，采用现有成熟primitive，不引入双源、兼容层或隐含策略。修复后新服务捕获正式Node新资产并重新实际呈现和截图；非UI代码有聚焦正向合同，UI只人工资格。若仅为本验收资源使用错误，修正工具链并重做原场景，不制造产品补丁。若范围尚未覆盖或证据不足，明确未满足项并持续调查，不宣称根因已治。

收尾关闭全部自有页、公开shutdown、原exec/native/launcher/output/request/精确进程出生闭合、catalog退休；核对源90表全部字段时间/字节mtime/canonical、目标原行变化、实际schema3对象/integrity与0模型。非秘密证据及四索引、当前文档检查、必要类型和正式构建；本任务全部修改范围提交，fresh fetch/merge/完整待推集合审查/正常push/fresh0/0。整体Goal保持active。

## 真实复现及独立的Session读取根因

19161实际main-CpLITCN5.js。单页/双页分别2/4条已到达且未abort的规范事件流，页面Online。第三Task页第6流于19:19:56.505Z到达，此后普通浏览器请求不再到达，19:20:19快照仍最后是该流；独立health19:20:21返回200/95.9194ms，端口精确6个Established。第三页Connecting、输入disabled且原正文Rendering，关闭一自有页后普通请求/渲染worker资源到达，原页恢复Online和原正文。实际abort及业务重连事实独立记录，不把旧流全由单次关闭解释。不同项目Task+Chat+既有Side的5流可读，再加第三项目Mission页work-ledger占第6流，同样停止普通请求到达，独立health200/114.0671ms。说明问题横跨Task/Session/Side/项目，不是Task局部；长期流与有限HTTP连接额度的冲突已确证，尚无传输修复，不把释放页面当产品已修复。

Mission链接另有独立错误：GET /session/ses_-zURQjvQ8zz3y3NgFyVx实际400 ProviderModelNotFoundError，释放连接后仍存在，不能当成网络恢复未成功。该读入口只调用getActiveProjectSession→Session.assertLineageInProject→规范Session/父链DB读取；project-route-context却遗漏裸Session详情，进入InstanceBootstrap并提前validateConfigCandidate，使普通历史导航依赖当前模型可执行。Chat标题入口/coding读取和message/conversation/events已identity，因此此前其它历史通过未根治裸Mission入口。全仓仅Server共同分类器决定此准入，public Session.get/children/list/todo/turn-artifacts调用及原正向路由合同已核对。现有project-route-context测试还把裸详情写成runtime，是过期合同，需同步替换，不为通过保留错误路径。

先修该共享读取根因：现有唯一分类器把纯持久投影的Session项目列表、裸详情、children、todo、turn-artifacts赋予identity，保留原Project归属/完整父链/墓碑/错误契约；列表/children/todo分别直接使用现有规范DB reader，turn-artifacts在已identity的conversation中使用相同投影函数。Session config仍有真实模型配置校验合同，prompt/创建/取消/生命周期等执行仍runtime，DELETE仍persisted，不扩大为所有GET旁路。diff有自身路径规范化写回，不纳入这组纯元数据读取。非UI修改增加真实Server.App路由正向合同：缺失模型冷启动下assistant/mission根与子详情、项目列表、真实children输出与跨项目404；原工具历史、配置400仍验证。没有新协议/字段/schema/持久格式或第二读取实现。

19161全部自有页与服务/原exec69544已关闭；public shutdown200，native/launcher0，physical/output/request/精确出生闭合，reserve416081ms。catalog退休、0模型，原90表169304行与目标原行均零差异，实际schema3对象/integrity/canonical和源文件保持。后续fresh19163完整复制此闭合源，复用同一正式UI、0模型/无auth，先单页重验同一Mission历史可打开及独立配置提示；再以健康可控的两页组合确认Task/Session历史。共享连接额度问题保留下一阶段完整传输方案与验收，不宣称随元数据修复而解决。

### 同一打开链的第二处遗漏

两份聚焦合同10项/82断言通过，但19163真实页面继续报链接错误，未通过最终资格。实际GET Session已200且kind/projectID精确正确，随后GET mission/cf0a5f07eb9045c3/status仍400 ProviderModelNotFoundError。main.restoreClientLocation明确先Session详情再loadMissionStatus，因此不得以第一个200或测试绿宣称Mission可打开。09/10图只保留中间失败。

继续同一共性根因：Mission.routes只四类GET，列表是全局持久投影，status调用missionRouteSession→missionStatusRecord，后者只汇总同源规范Task/Session事实；activity-cursor只读Session树、Task与Artifact/交互持久活动。两者无需模型初始化，应进入同一identity分类。project-archive有实际Git/文件归档过程，不在本组纯元数据范围。所有Mission唤醒、草稿/策略/生命周期更改保持runtime，未新增执行入口。补充真实Server.App状态/活动游标身份输出和跨项目404合同，不验证或重算活动摘要作为门槛。

19163已关闭页202并public shutdown200，原exec10698/native/launcher0、所有物理/output/request出生闭合，reserve1073463ms；catalog退休、0模型、原90表169304行和目标原行零差异。完整同源fresh19165仅重跑当前完整打开链和双页阅读，不沿用中间UI失败当最终资格；后端改动无需重编未修改的静态UI。

## 最终交付与未完成项

最终两文件合同10项/88断言通过。fresh19165同一Mission Session详情与mission/status均实际HTTP200，精确missionID cf0a5f07eb9045c3/sessionID ses_-zURQjvQ8zz3y3NgFyVx/inactive；页203正常显示原四条消息、MISSIONGOAL463READY及既有1/1轮已完成Goal，独立Model configuration unavailable仍只限制新发送。页204另一项目原Task历史正常、两页Online、四条规范流。没有重发消息/模型请求，未复制认证。11—13最终实图人工查看；09/10中间失败没有回写为通过。

网络问题确证：两个六流窗口内无普通浏览器请求到达，窗口时长分别42343/35750ms，独立健康200/95.9194与114.0671ms。第三页Markdown worker请求19:20:38.904Z到达，距关闭一页19:20:38.848Z仅56ms；原正文Rendering并非一定是Markdown对象重建，也可能是worker启动资源排队。共享HTTP流机制尚未修复，下一阶段需在唯一HostTransport与服务流适配边界完整解决，不采用隐藏Rendering、提前加载worker、改超时、URL分片或有限个同源流去重来冒充根治。POST/VCS/MCP实际并发、Native多窗口/带Auth以及服务重启仍是传输修复的待验收范围。

三scope原exec69544/10698/87275均public shutdown200、native/launcher0、physical/output/request/精确出生闭合，余量416081/1073463/1071903ms；全部自有页198—204均关闭。catalog共3副本退休、原9155406bytes/mtime/内容保持。源各90表169304行所有字段时间/字节mtime/canonical保持，目标各原行零差异，实际schema3对象/integrity保持，provider_activity_request421→421；所有原Task/Mission/Session/occurrence持久事实保持，0模型，无执行唤醒或终态更改证据。范围Git diff检查通过，整个外部工作区有别人正在修改的空白问题，未修或纳入本批。增量AX缺少稳定Online文本曾造成错误bool，已改按08真实截图记录，不以缺失增量当Offline。

[十三实图、原请求时序与收尾](../../artifacts/2026-10-24-multiple-page-connection/README.md)。当前非UI正向合同和实页Mission读取可交付；整体Goal继续active，单agent继续共享流传输修复。
