# 原meta timeout：共享读取/进程机制只读横审

## Recall与证据边界

Root要求对新发现的两条原`overlay:project-load`错误立即做共享机制横审，不以已正常File页面、后来的B正常读、模型或“偶发”降级。授权仅当前source、指定原owned log/Native证据和本scratch报告；不改产品/test/spec/Git、不启动API/UI/模型/进程、不重启服务、不读数据库/auth/providers/models、不再委托。原发生实例与之前before图完全相同；Root已普通关闭，实际physical回执也保原exited0，不等于此次meta失败变成功。

已读meta/config/init/TaskDirBar/workspace/connection-projection/HostTransport/api/AppLog/SSE/events/event-policy、app routes/project-route-context/Instance admission、Vcs.info及依赖、hostGit/taskGit/Process/facade/原Windows request settlement；重读07-panel元数据/语言与scope合同、07-panel-reactivity、原skill cold-latency与Native/barrier记录。全仓精确loadMeta/reloadProjectScope/retireMetaProjection/Vcs.info/BranchUpdated定义调用已核。当前其它owner的config/provider/session/storage/SDK与文档改动保留。

另实际静态读取已服务的private `main-QQQUstIX.js`中`mm`（loadMeta，`loadMeta failed`原marker offset344142）与`$E`（reloadProjectScope，`reload failed`原marker offset513777）片段，确认原authority/request/selectEpoch/directoryEpoch/directory fences及两HTTP并行与当前源码一致。此是原bundle源码绑定，不是新运行、摘要门槛或字符串UI验收。

## 两条完整原envelope与原错误字段

原run root：`C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/directory-target-before-01a133`。原`runtime/log/dev.log:219/:264`与`stderr.log:219/:264`都包含以下完整行；before-evidence-pack/verification.json.serviceErrors也保同两对象。原数据是`meta load failed`和`meta reload failed`，不是一个名为“meta信号等待”的错误类型。

```json
{"level":"error","time":"2026-10-13T18:05:43.463Z","service":"overlay:project-load","logDomain":"non-session","data":{"directory":"C:\\Users\\hengu\\.codex\\opencorvus-product-iteration\\2026-10-14\\directory-target-before-01a133\\project","error":"signal timed out"},"message":"meta load failed"}
{"level":"error","time":"2026-10-13T18:06:12.441Z","service":"overlay:project-load","logDomain":"non-session","data":{"directory":"C:\\Users\\hengu\\.codex\\opencorvus-product-iteration\\2026-10-14\\directory-target-before-01a133\\project","error":"signal timed out"},"message":"meta reload failed"}
```

**原Error name/code/stack/cause/reference与client HTTP request ID均未在这两envelope内保存。**init:175–187/config:517–547把Promise rejected reason只投影为message；meta:97–99的DEBUG也只有String(e)，当前原CLI INFO没有该原debug条目。不能把文字`signal timed out`倒填为已观察的DOMException、某个native exit或SSE cause。

AppLog:103–126将日志排队，500ms flush到POST/log；payload保service/message/extra但不保原client ts。server跳过/log access记录而生成落盘日志。因此上述time是服务端接收日志的时刻，不是精准AbortSignal发火或meta catch时刻；不可强令与15秒整点完全相等。

## 原HTTP时间链与具体等待资格

所有原server request如下（原dev.log行号已核），无需新请求：

| 原请求ID/路径 | started UTC | completed UTC/status | 原duration |
| --- | --- | --- | --- |
|79cb264f-07f5-48fc-8f25-fa4a23cd624e /path（57/59）|18:05:28.010|18:05:28.657 /200|647ms|
|6f976313-6f07-4524-84f5-ae8a954e19e4 /vcs（62/314）|18:05:28.664|18:08:11.931 /200|163267ms|
|817d335f-5a9f-43aa-b13b-ea34b8892a5e /path（239/240）|18:05:56.923|18:05:56.923 /200|0ms|
|16171aae-88c2-4beb-85bf-41f97927435d /vcs（243/330）|18:05:56.925|18:08:41.741 /200|164816ms|
|cc653f02-6b17-45e7-8755-a4ff93a58bd5 /path（391/392）|18:09:50.781|18:09:50.785 /200|5ms|
|183ffe7d-eaf4-41b8-b5e5-7e176ce4ea02 /vcs（393/400）|18:09:50.786|18:09:51.778 /200|992ms|

meta唯一生产loadMeta:87–90是`Promise.all([apiJson(path),apiJson(vcs)])`，**没有SSE/meta等待Promise或信号事件等待**。HostTransport:23/118–122缺caller signal/显式timeout时创建15000ms AbortSignal；Tauri与browser同request实现:431–463，将该signal给fetch并等待response body。两次meta无signal/null timeout覆盖。第一/vcs server started到日志ingest为14799ms，第二为15516ms；signal在browser创建早于server进入handler、flush另延迟，原时间链与15秒客户端超时吻合。

原慢/vcs与快/path、唯一load/reload错误族及private bundle形成很强关联：meta在等待两HTTP聚合时被当前客户端transport期限打断，慢的服务端路径是/vcs。**但原access log不含query/header/directory，未保存该两次browser fetch完整response/error receipt**；严格request-ID级scope绑定和具体哪一apiJson raw exception先reject不能由这些字段直接复原。A/project scope由原issue.directory和loadMeta captured query源代码支持，而不是把server path字段当有directory。不存在client“已收到/path所有bytes”原回执，不能仅用server200补这个事实。

第一条`meta load failed`唯一来自init.loadInitialData的meta rejected收集；它位于原/ui main资产27.357加载后的initial数据族，支持startup调用，未持久化init generation。第二条`meta reload failed`唯一来自config.reloadProjectScope；附近18:05:56.904读取A注册Chat，timeout之后11.930开始其conversation，符合workspace applyDirectory→reload→conversation路径，但具体调用stack未保，不能将这推断写成原stack证据。

原bundle mm.catch只有`isCurrent()`为真才throw，失败退休则return fulfilled。因此两meta rejected issue证明**在原catch/throw时不是retired owner**；reload聚合还通过其当前authority/selection/directory owns才发issue。此后scope能改变，server日志可500ms后才落盘，不说ingest时仍同epoch。两旧/vcs后来200不会重新执行已超时fetch的then或恢复原meta projection；它们只是原服务端处理完成，不是客户端原timeout成功。

## backend慢段：目前可定位到Vcs.info整体，不能定位某Git子命令

GET/vcs app:401–421唯一调用Vcs.info；当前project-route-context将GET/path和GET/vcs均归identity，server:912–920走Instance.provideProjectIdentity。旧f00c59156已将info branch从完整Vcs.state()/模型bootstrap改为currentBranch；本次不能又把未知模型配置或完整InstanceBootstrap当必经慢因。原另一些Project.open/vcs.init约202/156ms是其它调用的阶段，不等于此次info阶段计时。

Vcs.info:714–738源顺序：probe initialized；hasHead（hostGit rev-parse，fast）；有Head才currentCommit（fast）；currentBranch（hostGit symbolic-ref，fast）；随后parallel `git status --porcelain=v1 -z --branch --untracked-files=all`（default）与`git remote`（fast）；严格gitText检查有效结果后parse。没有File.list或Ripgrep参与info；不能把它归到新directoryTarget resolver。全untracked扫描与普通metadata小命令不同。

util/git唯一executeGit规定fast15000/default90000/network300000ms为**真实stdout/stderr活动重置的inactivity window**，不是这些数值的绝对执行cap；status还可能等待此前步骤/prepare/ready及后续Job/output/request结算。Process.run:536先await原spawn，588 onSpawned后593才设inactivity；正常handle.settled/双流/650 dispose完整join。Host/task均共成熟Facade/Supervisor；当前required三字段和allSettled屏障已在Phase A，不因此假定Native准备或Git输出慢因排除。

本次原INFO logs没有各Git argv/start/end/raw stdout/stderr/terminal/birthID。metrics18:05:44.069显示process:run-host pid29724，18:06:44.072与18:07:44.075显示29724/86128两owner；18:08:44以后和18:09:44均live0。这证明原supervised Host工作曾持续并重叠，**不证明这两个PID就是status、是Git还是helper、其原birth或某一个phase**。/vcs200按照当前源表示依赖最终取得有效数据，但不补一份原status.exit0逐命令receipt。

源指定的Windows request证据位置：Global.createTemporaryDirectory→runtimePaths.temporary=`<OPENCORVUS_HOME>/tmp`→supervisor-*，本run原OPENCORVUS_HOME为runRoot/runtime；已只读查这个精确`runtime/tmp`，当前supervisor directory count=0。Supervisor:1870/1940正常原physical/output后validateDurablePhysicalSettlement并rm该requestDir，符合实际closed时清理；没有残存request.json/ready.json/settled.json可复原这些inner Git命令。未搜索共享系统tmp、未读数据库或凭据。

外层原Native durable receipt仍完整：Host89556与Target88500各原birth；terminal.reason=exited/exitCode0，original terminal/settled/outputSettled fulfilled，stdout/stderr file与parent-forward都fulfilled，physical/output/request true，原Host/Target后态dead_or_reused。它证明**service owner普通收束**，不证明inner每一Git phase的时长/cause或原meta timeout消失。原client已超时而backend继续read并最后完成与server未透传client raw.signal到这些hostGit相符；是否需要新read cancellation是另公共合同决定，不能将该正常入场read结算直接叫leak。

## 全生产入口/共享矩阵

| 共性入口/域 | 原owner/正常失败和恢复路径 | 本次资格/未排除 |
| --- | --- | --- |
|App init与connection monitor重连（init158/289/310）|tasks/meta allSettled；current lifecycle/API/workspace epoch及directory再核；meta failed进projectLoadIssues但初始结果仍loaded=true，随后restoration/capability继续。|实际第一load失败；恢复/重启再次同路径，未自动修原失败。没有Task dispatch。|
|project reload（config512）|config/extensions/meta/tasks allSettled；当前authority/selection/directory才投影issue；workspace1071、connection-projection57、explicit initGit utils/git163调用。|实际第二reload失败；具体上层stack未保，不能制造调用Trace。|
|Runtime面板scope/open和菜单Refresh（TaskDirBar1219/1316）|直接loadMeta原request最新owner；catch消费reject，原vcsError仍供面板alert。|本次未打开此alert图；所有目录/选项scope均共享同backend /vcs性能边界。|
|VCS已接受switch/commit/push（meta118）|写入成功与后续metadata失败分离；只原current authority/selection/directory记录accepted+cause，未自动重放mutation。|无本次Git写操作UI验收；慢info在这些公开返回和后续读也可达。|
|显式Open Directory initGit检查（workspace1023）|另一个直接/vcs reader，沿原authority/selection与caller signal；默认initGit=false。|不是loadMeta，但同backend依赖；不把默认off视作其它入口排除。|
|公开Vcs.info/branches/switch/commit/push|app GET/vcs唯一直接外部info；switch/commit/push内部调用info；currentBranch也给branches/state watcher。hostGit是同唯一run原语。|全untracked扫描可能影响读与已接受写后响应；未知不能只降为Explorer功能。|
|Project/Task/Mission/Session选择|activeProjectDirectory由selectedTask owning directory或selectedSession.directory；Mission经main的session selection+directory；meta只按该目录/authority/request/selectEpoch/directoryEpoch最新投影。|实际A两meta overlap，后来B顺序读992ms/独立图只证明正常B当前投影，不排所有late/parallel/source恢复。execution occurrence/lease不同于metaRequest。|
|正常/retired/failed owner|loadMeta只有两个read都success且isCurrent才setPath/setVcs；isCurrent false吞旧投影为fulfilled void；current error设vcs=null/vcsError并throw；finally仅最新request清vcsLoading。|本两错误throw时current；原failure对象只保message，丢失多分支定位资格。Promise.all首reject并不等待另一个raw HTTP终结，这次/path已server完成；其它双失败/late sibling未知，不能冒metadata完整read回执。|
|串行/同A并行/两Project|每次loadMeta++request淘汰旧投影，未取消后台旧/vcs；独立API query与Project identity context；hostGit每次真实新run，不共cache。|本两A/vcs相隔28.261秒开始，重叠到first结束；没有同期A/B metadata parallel实验，不凭B正常排Native队列或全局路径问题。|
|重试/connection restart/retirement|Runtime Refresh新真实read；connection authority替换先retireMetaProjection、stopSSE/other projections，再reload/board/conversation/startSSE；页面重启新meta counter，服务重启独立原owner。|本次无实际重连/重启matrix，原scope时刻计数未日志化；不能在旧run重启造新事实。|
|SSE/Event Streams（服务器发送事件）|sse.ts独立stream owner/open/close/reconnect；vcs.branch.updated在event-policy:50为显式noop事件，events399消费并记sequence，不触loadMeta；connection restore阶段可先await项目reload再start selected SSE。|不是“等待meta信号”的直接原因；metadata失败/慢可影响选择恢复耗时，但本timeout后原Session events已真实启动，不能扩称SSE断链。|
|Host/Task Native共原Process底层|hostGit→Process.runHost；taskGit→Process.runTask，共supervised facade barrier、stdin ignore、原inactivity/abort/strictdispose；Task registration/lease另由Supervisor负责。|此次metrics仅Host发生实例。真实Task/Mission/Session terminal/retry/orphan及Capsule未知继续原spec，不以service0排除共享底层。|

meta用户影响源定义准确：当前vcs null/vcsError、Runtime alert（TaskDirBar1456）和Settings General的projectLoadIssues（88）；启动/切换仍可继续使Chat/Files可用。因此“页面能用”不是metadata成功。原截图未展示该两alert，不伪称用户已视觉看到。path与VCS由同成功聚合发布，这次meta失败也阻止其本次path更新；不能把服务端/path200当UI path已同步。

## 候选根因与旧路径为什么未排除

prepared-fixture原实体18:00:38.055 root-link和18:00:38.111 aliases/root-back都是junction指向A本实体根，原readlink/realpath/target inode均确认；它们早于/vcs两次18:05/18:06开始。第一before-probe mutation在18:11之后，故已移动link不可能引发首次timeout。**Git for Windows全untracked扫描遇这些循环junction可能膨胀**，是带物理输入的候选，但原status phase/输出未留，不从名字或目录flag直接归因。

仍可能是其他Git phase、Windows Native准备/Job/output结算、全局spawn/同A资源竞争，或活动性输出延长inactivity；目前不能排其共享根因。现metadata fences解决过旧scope写回，Vcs f00解决模型配置/完整bootstrap耦合，Native Phase A解决公开错误屏障；它们各自没有证明本次status/Native耗时。原skill/mounts历史也曾有相同客户端文字而不同业务慢段，正说明不能拿`signal timed out`关键字当统一根因。

## 下一次最小独立真实资格建议（未执行、须Root另落spec/授权）

先用全新owned no-Provider/non-UI Native实例、同源码/宿主/Git环境和有限UTF-8/CRLF tiny Git roots。分明control无junction、healthy junction、root self junction、ancestor back-junction以及两者共存五个预声明物理输入；不是修改旧namespace、不是自动UI测试。先每case串行冷/暖，再同Project两请求与A/B并行对照；保存原GET/path与GET/vcs URL/query/完整body/client Error name/code/cause/方法/请求身份与实际服务器access结果，保15秒client超时为失败，不扩产品timeout、不造scope gate或缓存false。

要定位子段，原HTTP应用路径与direct `hostGit` primitive资格必须分别标清。direct primitive可按Vcs实际hasHead/currentBranch/status/remote原argv/profile真实运行并保存完整stdout/stderr/exit/时长，这是Git/Native局部资格，不能冒应用或Mission端到端。应用路径则需先设计可审的透明原WindowsRequestObserver捕获request/ready/settled owner pid/birth/runtime/request ID并在正常cleanup前保存；若不能取得命令或原handle阶段，不fakepass。不要并列消费生产byte streams或加吞错误/global handler来取日志；若现observer不足以定位Git phase，须Root先另正式设计成熟DEBUG诊断再授权，当前不加源码补丁。

每个独立发生实例固定原执行cap、原inactivity输入与普通shutdown；观察窗口到期只标pending/继续原handle，不kill/restart换namespace。调用层15s、Git fast15/default90活动窗口、Native实际prepare/terminal/output/request、外围服务900s/120s各是不同合同，完整持久事实一起记录。timeout后的原backend200不能改写client failure；原meta owner若scope退休/被新request superseded，保存其真实发生轮次和返回资格。无UI/LLM/copy credentials/model目录需要；普通关闭/原父join与physical核实全部后才准新下一case。

本报告完成当前只读横审，**slow Git stage、原完整client cause、ID级directory、inner PID/birth与stdout仍未满足**。没有产品根修复或新验收结果，原两timeout保持真实失败；本调查不撤换已取得的before图，也不提前声明目录link浏览完整交付。
