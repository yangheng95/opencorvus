# 权限审批与历史的可读呈现

## Recall

持续单 agent 迭代，后续禁止子 agent 覆盖旧goal中的Astra文字。466为progress：acf991cfee4a2906805043eae3c76b8f8ff9a277已正常push并fresh fetch确认；56例/180断言及真实Sol Task epoch3/Goal complete通过。127 Project/172 Session/schema2完整保留；原37992/59764 exit0、Provider21/预设24全部200/stream/eof、原native/output/request/launcher和runtime/private复制对退休、tab14/15关闭。开始仅原.bun/和packages/opencorvus/bun/未跟踪。保留配置保存/恢复性能失败；Sources/侧agent直播Rendering无466新资格。

沿用benchmark-debug-template、CUA browser2；用户已明确“内置浏览器调试”。已读466 Recall/截图、security-permission、07-panel相关权限/Side契约、07-panel-reactivity；全仓检索PermissionRequest及engine/interaction实时桥、engine/store历史重建、前端permissionInteraction、conversation/side-chat/tree-writer全部调用、InteractionCard/DialogHost/CardParts/transcript/Disclosure/CSS/i18n。检索读到overlay/test/permission-mode.test.ts，属于UI配置投影自动化，按规则删除不运行；没有专用fixture/脚本。后端HTTP/ledger合同不是UI测试或视觉证据。

## 修改前深度与影响分析

466真实720px桌面截图中，一条已批准的权限JSON占用超过400px，正常结果被挤走；实时弹窗也重复展示provider digest、arguments hash、scope和长reason。直接触发为三个投影都把summary+JSON(scope)拼入body：前端独立Session适配、Task实时upsert、Task历史store。pending组件用Markdown渲染，历史CardParts又将结构化权限退化成TextPart，产生不必要的异步呈现。此前只共用pending组件，没有共用pending/历史权限内容，也没有区分审核内容和技术身份。这不是Source引用或Goal权限分类问题。

唯一事实已齐备：不可变Permission ledger Request拥有summary/tool/effect/scope/choices；Task payload保留scope/effect，但Session前端适配仅保留choices，连toolName也丢失。Task实时/历史的30字段构造是已证实重复。无需解析旧body、按工具关键字猜动作、增加第二事实源或改变授权。body可仅保留原summary，完整身份和scope留在payload；source-backed历史从原ledger重建，不改写历史批准/fingerprint。没有schema、迁移、模式、请求/回复API或provider变更。问题/用户/模型原文保留Markdown。

影响面覆盖Task主会话、独立Chat/Mission、Side、冷加载/connected/live asked和已完成历史、inline/dialog共用组件。精确Request/Project/Task/Session/Message/Tool身份、scope、choices、replyEndpoint、回复mutex、dialog dismiss及当前locale保持。待审默认展示完整resource供审核，provider/digest/完整scope在技术Disclosure；历史紧凑但可展开同一详情。风险为长参数/不同scope/未知effect/旧历史以及body其他消费者：用通用原始resource、有限滚动区、原完整scope和当前语言标签，全部调用搜索及真实历史验证，不裁剪事实、不添加fallback。无调度/恢复/终态异常；队列机制不修改。

## 实施与验收

1. 收敛后端两个已重复的Request投影helper，body为原summary，payload保留完整scope/精确身份。聚焦正向合同走真实PermissionAuthority Ask→原Task桥→history→单次批准及最终结果；相关HTTP/恢复合同按需验证，不增加UI自动化。
2. Session适配保留toolName/effectClass/scope。一个原生组件共用pending/history：当前语言标题和效果、待审resource、完整scope技术Disclosure；历史紧凑、响应按原决策直接渲染，问题保持原合同。复用Disclosure/CSS tokens，覆盖中英文/键盘/复制/720px桌面。删除检索到的UI自动化，不扩大无关扫描。
3. 正式build新前端，typecheck/i18n/CSS/renderer作为工程检查；自有18773 native开发服务加载新UI，新IAB tab检查466 Task多条历史与展开/语言。原用户18571/进程窗口不动。真实新Goal触发同Task epoch4，Goal写入/Task完成分别Ask单次批准；独立Chat真实write新建QA项目permission-review-467.txt验证Session适配。全批启动前限定最多16实际Sol流式请求，原413 NativeService监管，credential/全models投影/实际模型分别预检，无refresh/exchange/源写入，不抬高已启动scope额度。
4. 修改后真实截图并人工查看，必要时修复→新build→原服务完整结算后新scope；实际checker/公开HTTP/readonly SQLite与视觉资格分别记录。完整QA412历史逐身份/目录/归属保留，schema2。全部Provider、Task/Session及原native/output/request/launcher结算后关闭自有页、公开shutdown、保全日志、秘密实际值扫描后成对退休runtime/private复制对。
5. 三索引/当前架构/产物更新与docs:check；无论是否全达成都创建范围commit。fetch/merge upstream、完整pending审查、正常push/fresh fetch，不建branch/worktree/PR/tag/Release，不绕hook。Goal active继续下一批，配置性能等原失败如实保留。

## 恢复检查新增发现：修改调度前审计

原engine-interaction-recovery中A2A恢复及activity-reconciliation两例失败；同一A2A在仓库声明的Bun1.4.0原driver下也稳定失败，排除只由全局1.4.3版本造成。堆栈直接指向background Task-control scan进入reconcileTaskControlPlane后，process-liveness第一次Database.use继承了已经closed的post-commit effect owner；后续Bun matcher/afterEach清理又继承active Instance上下文。后者是否独立问题仍未知，不先归咎模型或偶发。

横审全部reenter生产入口：Task两个background入口共用runDetachedFromCallerLease，Task/Mission两个TaskControlDriver的heartbeat/hint/rearm/retry共用传入reenter，scheduler event恢复timer、Session loop正常/终态重入与file watcher原生回调。Task background helper只清Instance lease，保留Database effect/transaction AsyncLocalStorage；Database.effect收到void即关闭owner，但重入在waitForIdentityAdmission后的异步回调才真正使用DB。控制Driver定时器同样可能继承创建scope。原Bus durable replay/retry显式Database.runOutsideContext，不能替代调用者自行fire-and-forget的脱离。Task/Mission/Session occurrence、初次/终态/恢复、串并行/跨Project均须按所有权边界检查，不把此认定为一个A2A场景局部问题。

当前最小明确修复边界为两个Task background生产入口及Task/Mission共享控制driver的独立reentry适配：复用Database.runOutsideContext与原reenterActiveInstance，分别清除调用者数据库owner和Instance lease，继续由实际新lease及原completion/driver owner持有物理工作。无DB访问guard放宽、无catch吞错/重试替代。Session正常/终态loop的awaited owner、scheduler timers与OS watcher还需确认其入口owner与实际运行证据；不在证据不足时一并改中央Instance API（它不依赖Database且是底层公开契约）。先用原恢复失败与聚焦post-commit真实driver测试核验上述确定边界，再判断仍有何共享未满足项。

## 已验证结果与最终死路径收束

首轮正式UI及真实审批已完成：Goal pev_g0VYZpebm00K5RrRMT3S由controller msg_hJ6GFlGymjWtOGncxEVT自动重开同Task epoch4，模型输出PERMISSION467READY，Goalcomplete/193569tokens/1turn，Task terminalEvent pev_g0VYZqCXm00XG7LA7tSe/completed。原update与manage两个单次批准保留。独立Chat ses_-zURQ9LiizzMQar6bdaj真实write经中文单次批准，输出PERMISSION467DONE且文件精确为PERMISSION467FILE；实际global New chat创建匿名Project prj_hNiWMIyYG4ToqzJX229Y，文件位于自有QA runtime/data/projects/2026/10/20/b5e2094d-b69b-47ea-8495-0c327141306a，不是原project目录，未伪称原目录写入成功。

首轮截图发现标题与Details仍占两行，已改为compact原生Disclosure单行入口，重新正式build，原scope完整结算后新18775实际英语/中文、展开/滚动/键盘收起、URL恢复均复核。14张截图全部人工查看。原39988/48568 exit0，公开shutdown各200，Provider11+2=13/预设16全部200/stream/eof，runtime/private完整复制对已秘密扫描后退休；原130 Project/175 Session/schema2，启动前127/172与129/174每个身份/目录/归属保留，Ask/canonical/English恢复。preflight耗时之外没有用额外模型请求制造UI事实。

恢复失败的三个修复点已通过原完整engine-interaction-recovery 8例77断言、Task-sweep 3例3断言、Mission跨进程5例5断言；Session Permission HTTP 8例39断言也通过，合计24个独立case/124断言。原失败在声明Bun1.4.0亦复现，修复后其两个聚焦case通过，不能把根因归咎1.4.3。SchedulerEvent/Session/OS其他独立回调owner的共性审计仍开放，不宣称局部或全局恢复全根治。backend与overlay typecheck、i18n2520keys、CSS检查、正式build和renderer通过；原CSS未定义text-secondary已替换为当前text-muted。第一次build输出重定向目录错误在启动前即失败，改绝对路径重跑，未把exit0残值当构建证据。

最后全仓搜索确认interaction-card__body仅残留2处CSS，旧interactionRequestText的permission分支也已无调用。同步删除这两条替换后的死呈现路径，Question原分支不变，避免留下平行实现。删除不改变已查看的目标输出；仍执行最新正式build并用最后隔离scope18777确认当前页面。前两scope实际13请求已固定，第三scope最多3（仅2个原preflight预计），全批16不增加；第三scope启动前再捕获完整历史，所有物理/输出/请求/launcher结算后退休复制对。当前下一步为等待20678/49217构建/类型检查原handle终态，再准备cleanup scope并实际截图，补最终证据/检查/范围commit、fetch/merge/pending审查/正常push/freshfetch。仅单agent，未创建branch/worktree，原用户18571未操作。

## 最终交付事实

最新删除死路径后的正式build原20678 exit0/50.48s，当前overlay typecheck原49217 exit0，CSS 8866引用/2文档/60样式/376源码通过。随后第三自有18777/新tab18实际查看当前Task单行历史、完整详情、滚动、原生键盘收起和选择复制；实际scope920字符、Ctrl+C复制920字符，原浏览器剪贴板0项已恢复空文本。通用clipboard.write拒绝空列表，改用已支持writeText('')恢复；未打印原剪贴板数据，也没有凭据进入复制内容。最后3张截图已人工查看，累计17张。

第三scope原2523 exit0、公开shutdown200，原native physical/output/request/launcher与runtime复制对结算；原Target与birth identity见产物native-settlement。第三仅2个preflight真实流，加首轮11/最终2，共15/预设16，未抬高额度。三份private auth+完整models已实际秘密扫描后成对退休，源metadata未变，无refresh/exchange。最终readonly SQLite为131 Project/176 Session/schema2，基线127/172、129/174、130/175原每个身份/目录/归属均保持；原Chat文件精确内容仍在自有QA匿名Project，原Task Goal累计193569tokens/1turn、Task epoch4 completed保持。三个自有tab16/17/18已关，原用户18571未操作。

[完整产物](../../artifacts/2026-10-20-permission-readable-review/README.md)包含17张真实人工截图、明确前后构建区域资格、原恢复失败与修复后24例/124断言、全部原native/Provider/秘密扫描及历史事实。docs:check345ops/26groups与architecture-index20通过，结束前继续正常hooks、范围commit、fetch/merge和upstream..HEAD完整集合审查、push/freshfetch。尚未完成的共同机制范围为scheduler event/Session/OS其他独立回调owner的横向排查，不能据本轮三个已确认控制入口改动判为局部或称所有恢复问题已消除；下一轮继续。原配置性能、Sources/侧agent直播Rendering等资格缺口保留，长期goal active。
