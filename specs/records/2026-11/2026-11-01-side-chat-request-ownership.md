# Side Chat 重复操作与请求归属

## Recall

用户要求持续单 agent 自主排查 UI/UX（User Interface/User Experience，用户界面/体验）与功能，实际隔离页面交互、原图人工复核、验证后提交推送；不动正在使用的窗口。旧 Goal 的多个 Astra 委托已被后续明确单 agent 要求覆盖。上一轮属于 progress（已改变权威状态）：866 的 b68da4ce1093a7acca80fb7bf025f1cc664add11 已正常推送，2026-11-01T10:39:26Z fresh fetch（重新拉取）及普通 merge（合并）后本地/远端一致，25 个任务文件干净；16 项数据正向测试、12 张真实原图，创建失败/重载保留源稿、确认后交接及旧重试保护新输入。两个服务原 native/launcher 0、全部物理结清及两组配对副本退休，模型请求 0，累计 1193。最近闭合源866-after：schema（数据库结构）9、92表239041行，82项目115会话784消息2225 Part，217项真实附件、9个Goal；不重开旧 scope（作用域）、不延长旧截止。

本轮 git status 已保存 .tmp-product-iteration/status-before867-private.txt，HEAD b68da4ce1；另一个授权会话正在改月结 benchmark（基准测试）的三个独立文件，仅实际冲突才等待，不冻结它的保存/提交。已读 AGENTS.md、07-panel 的 Side/主输入/引用/请求消费合同、866记录，ChatComposer 的 localCommand/handleSubmit/submitting，main 的全部 requestSideChat/consume/authority retirement（权限上下文退休）调用，SideChatPanel 的列表加载/attemptedRequest/create/失败/重试/销毁，服务 createSideChat 和后台公开 Session.fork(purpose side-chat) 入口。全仓搜索限定源码与规格，避免生成 bundle 的单行噪音；未检出或执行相关 UI 自动化测试。

## 现象线索与影响分析

当前主 /side 回调只发布临时请求，await 很快返回，主 submitting 恢复；866正确保留主草稿直到真实交接。SidePanel 的 creating 只保护单次 create，attemptedRequest 只比较请求对象引用。第二次点击可能把同一作者版本包装成另一对象；第一笔完成后若新请求仍在，effect 可能创建额外 Side。此刻只是代码线索，必须通过真实双击、正式 Side 列表及原服务器请求证据确认，未证实前不改产品、不宣称已有重复创建。

待确认的直接触发是同一未改写主稿的快速连续提交；可能根因是“作者意图版本”和“临时包装对象身份”被混用。866解决了持久草稿提前清理，未证明连续点击的创建归属。影响面包括相同稿的进行中/成功/失败、失败后的明确手动重试、不同新稿、空 /side、选文 Ask、Side 自身加号、关闭/重载、切换 source/Project/API authority；只有完全相同 source、authority 与作者版本才可能加入同一创建，不能用相同文本抑制新的真实意图。

相关定义与公共契约已定位：SideChatRequest/consumeRequest是当前单一UI请求路径；Backend每次合法POST均创建独立Session，用户明确新建相同内容仍是合法行为。创建不调用模型，不改变 schema/API（Application Programming Interface，应用接口）/SDK（Software Development Kit，开发工具包）/Message/调度合同。若发现真实执行并发、调度、队列、唤醒或终态异常，立即按共享机制审计所有Task/Mission/Session轮次、生产入口、正常/终态、重试/重启、串并行和多项目，不能只修Side。现阶段同时审查主Chat/Task/Mission的创建与提交拥有者，区分界面重复创建与后台执行异常。

## 复现、方案与验收

新批次绝对75分钟，before/38540、after/38541共用，启动至少余10分钟、结清至少余5分钟；不延长、不重开过期实例。完整保护闭合QA（Quality Assurance，质量验收）源库全部旧行、真实附件namespace（命名空间）及旧项目业务文件/Git，所有非内部schema对象逐项比较。两实例按现授权配对认证及完整模型目录，启动分别验证注册/精确openai/gpt-6.1-sol投影；首次额度0、运行中不增加，不点Side正式发送，不把模型预检说成真实远端调用。只用本人隐藏IAB（In-App Browser，应用内浏览器）新tab和完整开发服务/ui，不启动独立Vite，不读/刷新/重启/关闭用户18571窗口。

先通过真实公开接口创建本人新项目和空白源，用真实按钮双击/连续点击，保存之前/之后原图，并读正式Side列表、真实源与Side消息、请求到达日志。先不注入网络/响应延迟、不mock（模拟）接口，不用脚本合成UI事件；正常快速操作若不足以复现，先调查真实创建耗时与输入事件，必要的自有存储诊断须另写明确范围与回收方案，不能为了证明猜想制造产品结论。

若证实同一作者版本被重复创建，沿当前单一请求/创建拥有者修正同意图加入与消费；必须保留真实失败的手动重试、新作者版本的独立交接和空命令打开语义，不新增文本启发式去重、第二持久草稿/状态库、备用路由、伪造消息或Host端LLM（Large Language Model，大语言模型）流程门。具体实施决定以真实复现及完整影响分析补入本记录后执行。

UI只用真实交互/原图/人工复核，不新增/运行源码文案、DOM（Document Object Model，文档对象模型）、组件、快照、Playwright测试、像素断言。纯UI改动不编造自动测试；如新增非UI数据合同，必须聚焦正向测试。类型、i18n（Internationalization，国际化）、普通前端构建及当前docs:check均需通过；lint/typecheck/build不代替视觉验收。真实故障/恢复要覆盖当前英文与中文反馈。最后核对9Goal公开事实、源/旧业务数据、结构/附件/旧Git完整，public shutdown200、原exec/native/launcher0、physical/output/request结清与全部配对副本退休。同步三个索引，独立提交；每次push前fresh fetch/普通merge、完整待推集审查、正常hook、远端重新回读。本持续Goal保持active。

## 已证实的基线与实施决定

before/38540真实开发服务，原main-DJUBbXEj.js，本人隐藏tab113。公开接口新建唯一source ses_-zUQHTPMIzzxbzoV1SqG/project prj_h1R6wnzfR2ht5oRomh3n。先打开空右Dock保持按钮几何稳定，填入同一 /side 问题，用真实clickCount=2双击Send，无延迟注入/响应替换/合成事件。02–04原图显示两个正式Side和完全相同问题；公开列表实读sideCount2，两个Side与源消息均0，Provider0。界面瞬时AX（Accessibility，可访问性）观察先见Side1，紧随的原截图已见Side2，不能把异步中间快照说成最终事实。基线页关闭，shutdown200、原exec/native/launcher0、物理/输出/请求结清、配对副本退休；全部239041旧行保持、239221当前行，83项目118会话，217附件及82旧项目完整，schema9/92全部对象相等，9Goal公开完整事实保持，零过期容量槽复用。

横向审查：Main Chat/Code/Task/Mission均由ChatComposer持有submitting直到await真正onSubmit（panelMessage或wakeMission及实际Session创建/选择）结束；首次ChatSession creation、MissionCreateDialog分别保持自身launcherSubmitting/submitting和selectionEpoch/authority。Side标题新建加号直接await同一个create且creating期间禁用；选文Ask与header open/主命令都进入同一requestSideChat；仅主/side在已保留稿上可多次产生新包装对象。后台Session.fork单笔事务整体提交、每次POST独立身份；基线新增仅1源/2Side会话及正常发布收据，Task/Mission/Prompt/模型消息数据与所有旧行保持，不是一次后台执行或恢复被调度两次。Task/Mission当前requestID/occurrence（执行轮次）及恢复/终态控制合同、跨项目界限沿现task-control-plane/continuous-goal；本轮不改变这些机制，也不以这次0请求UI体验宣称其完整运行矩阵重新通过。重载不重放临时Side请求，作者稿沿唯一store保留。将问题归于已证实的UI请求包装归属，而不是模型或共享执行调度。

决定沿现Side创建拥有者在完成/失败点收敛同一源稿请求：比较sourceSessionID、directory、API authority revision、intent、prompt及quotation同一身份，且要求两个sourceDraft具有相同key和完整现有草稿版本。capture返回的是现记录的值快照，不是entry对象引用；提取现clearComposerDraftRevision使用的全字段版本比较为唯一sameComposerDraftRevision并复用，不能只按文本或时间戳去重。成功时现consumeRequest消费该创建目前最新的同版本包装；真实失败时把现attemptedRequest标到同版本最新包装，避免creating解除后把双击误当一次自动重试。失败后的新主点击有新的包装引用，或Side明确Retry，仍可发起真实创建；改写的新版本保持独立。无需新队列/Promise总线、额外pending标记、持久字段或后台幂等协议。风险是错误合并不同作用域/新作者版本及误封手动重试，必须在after实际验证后才可交付。非UI版本比较提取增加正向值快照测试；UI归属只真实页面验收。

候选的手动重试验收需真实存储错误：仅在after本人副本、本人新project/source上复用866已验证的精确SQLite触发诊断，名称owned_side_draft_fault_867，匹配NEW.project_id及metadata.sideChat.sourceSessionID，RAISE ABORT原文“Owned QA side-chat storage rejection 867”。不是替换接口/响应或给正常双击注入延迟。两轮各stage/restore，退出前逐对象确认schema回原样；只从本人数据库路径执行，旧源只读。分别验英文失败后主输入明确重试，以及中文失败后改写主输入再点Side Retry。主稿/原问题归属与正式Side计数、真实POST节点合并复核；不点击Side发送。

## 候选实页、结果与交付边界

after/38541，冻结main-DS0BafsL.js；正式新建source ses_-zUQHRpo3zzRaoxrFxhl/project prj_hSEfMbdBjgxFyPyragsD，本人隐藏tab114。正常真实双击只创建Side1，原问题完整进入可编辑Side，主稿此时才消费（05）。英文存储500时原稿完整保留，恢复后主Send明确重试成功创建Side2（06–07）。中文失败时同样保留（09）；改主稿为新的 `/side 独立新稿867…` 后点击Side重试，原问题归Side3，新主稿不变（10）。随后实际双击新主稿只创建Side4（11），空 `/side` 双击仍打开该Side并消费命令（12），明确加号创建Side5（13）。填写独立主稿并实际reload，header打开、选回Side4，主稿及Side4原问题仍保持（14）。未点击Side Send，没有模型回复或隐藏消息。正式节点Side计数1/1/2/2/3/4/4/5、源/Side消息数组空，before2个POST，after9个POST=5次成功+4次真实500。

两组失败双击的第一笔500已经在第二次点击到达前完成：英文10:51:25.899Z早于25.934Z，中文10:52:56.247Z早于56.289Z，见原错误requestID和请求到达事实。因此后一次是已失败操作的明确新点击，不将其说成进行中合并失败或后台自动重试，也不宣称全部错误双击只有一笔请求。09前曾按已变化的AX索引误点splitter；无请求、无产品改变，原08保留并命名为提交前画面，随后根据新控件完成真实验收。最初准备的长进程在10秒观察点仍运行，原handle继续等待至0，未重启或重开scope。

17项纯数据测试20断言、类型检查、i18n2688键及普通前端构建均0，未新增/运行UI自动化或全量bun test。本人两个tab均关闭；两服务public shutdown200、原exec/native/launcher0，physicalCompletion/outputDrainComplete/requestCleanupComplete和出生身份链全部结清，4份配对副本退休，源认证元数据与模型目录字节/元数据保持。真实Provider0、首次额度0且未增加、累计1193。75分钟共同截止未改变，退休余量4359966/3811863毫秒。全部239041/239221旧行逐字段保留，当前239221/239584行，84项目124会话，schema9/92所有非内部对象逐项相等、诊断trigger已撤销；217真实附件、旧82/83项目业务文件及Git事实保持，零文件系统排除/过期容量槽复用，9Goal完整公开事实前后相等。实际读取/结构/物理证据见本轮artifact的verification.json等。

本轮只改SideChatPanel、唯一composer-draft版本比较与正向数据测试，07-panel合同同步；没有后台API/SDK/schema/持久格式变更或版本发布。引用历史、其他source/authority退休与Task/Mission实际执行矩阵仅代码及旧事实审查，未冒充新的全链模型验收。正常docs:check、独立范围提交、fresh fetch/普通merge、全部待推提交审查、正常hook及push远端回读按实际工具收敛；持续Goal保持active，后续继续从真实体验找问题。

交付期间另一个明确授权会话已提交82cbf11369fa581a4554c994e44e5f70a55daa13，85个benchmark规格/产物/索引文件，没有产品代码重叠。已核对其用户新增授权记录及原消费者执行证据：合法credit-basis和两份真实产物修后native_exit均0、旧冻结4仍保留。它的99个远端请求属于该独立任务，不计入本UI验证的0/累计1193，不拿其结果替代本轮验收。以最新HEAD为提交基线；待推集合若仍含82，则作为该已授权且有验证证据的交付保留，不回退、不重写或混入本轮27文件提交。

```text
node .tmp-product-iteration/side-chat-request-867/run.mjs unit-drafts-after bun run --cwd packages/overlay script/run-unit-tests.ts test/composer-draft.test.ts
node .tmp-product-iteration/side-chat-request-867/run.mjs types-after bun run --cwd packages/overlay typecheck
node .tmp-product-iteration/side-chat-request-867/run.mjs i18n-after bun run --cwd packages/overlay check:i18n
node .tmp-product-iteration/side-chat-request-867/run.mjs ui-build-after bun run --cwd packages/overlay build
```
