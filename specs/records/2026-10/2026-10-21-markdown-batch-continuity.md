# Markdown 分批呈现连续性

## Recall

497持续单agent，不委托；旧Goal三Astra要求已被后续人工单agent指示覆盖。上一goal turn为progress：496以两个完整隔离开发服务、9张实际查看截图与7次真实Sol流证明当前Home/Goal创建/网页来源/完成链，618d0db9d7063395c6bb95e396a41e3ca5417baf正常push后fresh HEAD=upstream。没有新生产修复；成员Rendering仍需新证据，完整149目录配置保存10秒/恢复5秒仍未达。开始git status仅原.bun/和packages/opencorvus/bun/。

用户要求持续自主排查修复、Sources优先、Rendering根因、实际体验后提交推送；已授权内置浏览器调试。已读AGENTS、496 Recall/验收、420根因/生命周期、473父子并发、487成员阅读、现行07-panel-reactivity Markdown合同、TextPart/text-part-model/markdown-render/worker与唯一Vite配置。已使用的benchmark-debug-template及computer-use规则继续适用，无委托反馈。

## 修改前分析与范围

既有修复已解决pending每次显示Rendering、实际输入相同重复解析、成员target/request及forceMount生命周期等根因，不能再从首次冷解析或旧截图推断复发。当前发现尚未实测的代码路径：text-part-model.mount每次只接受16块/4毫秒，收到新revision的部分HTML时会以当前target前缀构造next，首个变动块一旦出现就setFrozenHtml(next.slice())。如果worker尚未发送完整尾部，这会把已呈现的其余旧正文先移除，随后又分批插回。长正文尾部新增参考定义，或界面语言导致前部代码复制标签改变，都可能触发前部HTML变化。直接触发与肉眼影响未证实，先用真实已有长文检查，不先改生产。

影响面是Main、Side Chat、成员side dock共用的同一Markdown model，包括Chat/Task/Mission Session真实正文与静态文档。Sources仍由真实Message/Part身份拥有，不能因块替换复制或错配来源。计划先审视同revision多batch/新revision、追加/替换/缩短/空文本、流中/完成、语言切换、缓存命中和dispose；业务调度/队列/Provider/数据库均无已证实异常，不改其入口或策略。若发现业务恢复或终态异常，按AGENTS横审全部生产入口及Task/Mission/Session执行轮次，不降级局部现象。

旧路径为什么未根治的候选：已有HTML不显示Rendering仅约束提示行，不保证HTML块替换期间旧尾部的连续性；forceMount只保持组件owner，无法保证同owner正文长度。这仍是待真实呈现确认的假设。公共类型/函数/API不变，worker解析器/队列/缓存上限不改，不新增影子正文、不扩缓存、不人为延时或隐藏真实参与者。没有schema或数据格式变更，不发布版本，不清库。

## 实施前方案

1. 只读原412 QA全量149Project/198Session/3665行与当前schema3，先只取真实长正文的身份/长度/块与代码围栏计数，避免输出历史正文。若可用，按原487成熟无凭据开发服务方式完整serialize到新的497 before/after自有runtime；原canonical完整5键保留，不作完整配置性能达标声明。无真实LLM（Large Language Model，大语言模型）输入、无凭据/models复制、无Provider预检，本轮初始模型请求预算0。任何后续真实流需求须另行启动前明确有限预算与完整成对模型授权，不暗增额度。
2. Node.js以正式Vite配置构建before被动观察UI：仅在原model输入/reply/mount记录owner、revision、目标/已呈现块数、长度与时间，不改文本、分支、节奏或可见内容；不自动点击、不制造消息、不做DOM（Document Object Model，文档对象模型）/组件/源码文案/截图断言。正式Source CLI开发/ui，自有18875/18877，原446 native与413 owned-host、20分钟资源上限；不用单独Vite服务器，不动用户18571进程。
3. 内置浏览器2自有页面手动打开已有真实长文，语言切换/侧栏阅读/关闭重开，实际截图并人工复核；被动日志只能解释可见现象，不能替代视觉。如果有真实复发，先补根因、完整影响审计和修改方案，再关闭原before并join完成，随后改生产。否则保留未知而不造补丁。
4. 候选修复只在原frozenHtml/target序列内，按已接受范围替换已有HTML，完整done时收敛真实长度；不保留第二份正文、不改解析语义。每次真实目标改变退休旧pending挂载，避免新旧任务交叉；具体实现在证据后确定。before日志与图保留，after新独立bundle/服务人工复核同区域。所有界面沿当前中英文；无新文案则不改i18n。
5. 各原服务public shutdown及原handle exit、native physical/output/request/launcher和exact birth终态结算；源完整行/字段/rowid/时间、size/mtime、schema/integrity和canonical保留。只归档非秘密证据，三索引/docs同步、实际类型/构建/必要正式检查，范围提交、fresh fetch/merge、完整待推集合审查、正常push/fresh相等。长期Goal active，不因本批停止而complete。

### 启动前的真实流资格补充

原历史metadata扫描（不输出正文）仅有6条超过5000字的assistant正文，最长7104字/55段与原成员6491字/92段，全部代码围栏0。不能用语言切换稳定制造前部HTML变动，也不能注入夹具冒充真实流。故在任何本轮服务启动前，将本轮资格明确为新的“尾部参考定义重排”用例：总最大16次真实模型请求，before8/after8，含两侧全部preflight/memory/helper/主请求；每侧只向已存在QA成员ses_-zUS0WzzQzzDOGrIbYwN发一个真实输入，要求连续48段、首段参考链接在末尾才定义，不使用任何工具/其他成员/Task/Mission/Goal。不是新建委派；父会话ses_-zUS0X33CzzWEKMgCk98仅用于打开原side dock。输入/结束标记与实际parser结果均保留，模型未按要求输出时如实记失败，不合成文本。

沿用496完整授权+9155406字节models配对准备、当前access/投影/真实Sol模型预检与413审计/原生监管器；不得把上一批未用5次带入。before18875使用被动诊断构建，after18877使用新正式构建（若有修复）或相同正式488 UI（没有修改）；各独立bundle/完整原canonical clone，20分钟资源边界。零请求方案在启动前被此明确有限新用例取代，不改变已发生请求额度。若before未确认根因，也不强行修改或自动重发同一输入。实际物理/source-reader结算后退役完整runtime与private auth/models对。

## Before 实际事实与修改决定

before Node诊断构建原19736 exit0（64秒）。一次在build尚未settled时过早启动被启动器以缺少ui/index.html拒绝，尚未创建服务/复制runtime凭据；原失败日志保留，等待原19736成功后才启动，未因观察超时重启构建或服务。原44323/18875 ready、实际Sol预检通过。真实已有成员单输入原67802 exit0，200/finish stop，文本5090字、48段和原参考定义自然输出；4/8实际请求均stream/200/source EOF。

IAB66实际打开原父会话的唯一已有成员。01旧历史、02新流、03向上手动滚动暂停跟随、04文末定义前、05自然完成后均实际查看。03/04/05侧栏同在第22—26段，首尾scrollTop均43218；没有捕获瞬时画面或永久位置丢失，不能说成截图已证明连续闪烁。被动原commit日志却明确显示同owner42/同5090字实际源码setter在末尾引用解析时49→1（receivedRevision762/current763、complete false），随后16→1（763、complete true），约148毫秒内再补到50。该症状是现存正文块真实被缩短/重插，不是提示行、模型自述或组件重建。

根因落在mount：next=current.slice(0,prefix)把所有未处理旧尾部裁掉，用frozenHtml长度又同时充当“本帧处理到哪里”。因此即使完整target已经到达，16块/4ms的分帧替换仍先丢后半部。旧pending/forceMount/身份修复不能约束此数组提交。修复在唯一frozenHtml/target内按索引替换已接受的块、保留尚未处理旧尾部，用本次局部index追踪处理范围；只有complete且已处理完整target才裁剪最终长度。是否继续挂载按index而非保留尾部后的数组长度判定，防止误报已完成。

影响审计：TextPart/StaticTextPart和CardParts唯一调用共享model，Main/Side/成员Chat/Task/Mission数据均经过相同边界；不改来源身份或语义。追加保持原块身份；非追加/缩短在新done前保留已呈现范围，done后收敛目标；真实空文本仍立即清空；新revision沿原callback/locale/input校验退休旧结果；完整artifact恢复和dispose沿原路径。没有业务调度/恢复/终态异常，provider原source已EOF；该修复不改worker单队列/缓存/业务执行，只改前端块数组呈现，业务Task/Mission/Session入口不变。相关renderer UI自动化搜索无命中，未新增或运行UI测试。

before已公开shutdown200，原44323 exit0，native physical/output/request/launcher及exact出生结算完成，runtime完整对退休后才改源码。after为便于同口径观察使用同一仅日志的诊断插件+修复源码，真实新服务18877；另运行当前正式build:vite/checker，正式资源不含诊断。实际视觉结论将明确来自诊断构建的真实页面，不把构建通过当视觉证据；两侧插件相同且不改分支/文本/节奏。

### 完整数据核验的真实活动合同

before只读逐字段差异调查确认仅原选中QA成员Session的time_updated因本次真实输入变化，其他全部原3665行字段一致。SessionPrompt run.ts:89/117明确await Session.touch，Session/index.ts:570起在原事务中写当前活动时间。这是原public prompt的正常持久事实，不能为了“字段不变”而回写测试数据、修改生产touch或隐去差异。preserve保留源全部字段/bytes/mtime精确核验；clone逐原rowid/所有字段核验时，只对两侧各自这个精确Session的time_updated记录实际前后值，并要求其处于原请求发出/原响应收到的真实时间区间。所有其他原行/时间仍精确一致，原schema3、integrity和完整canonical保持。这是新真实用例的数据验收合同，不是兼容schema或削弱源数据保护。

### After 原输入的格式失败与额度内纠正

原40990自然200/stop、4910字/48段，但第48段与reference定义仅单换行；真实最终AX中首链接仍为原始标记，未解析成link。原图10实际停在前一条旧历史尾部，不能冒称已查看该新链接。此输出未覆盖before的引用解析触发，不能作为修复通过。真实before5090字/50段落单元、定义前后均空行；after4910字/49单元、定义前只有单换行。已读当前lexMarkdown=marked.lexer、renderMarkdownToken=marked.parser([token])及[CommonMark 0.31.2引用定义](https://spec.commonmark.org/0.31.2/#link-reference-definitions)，引用定义不能打断已有段落，保留该自然失败样本。

不增加16总预算或after8上限。原after已实际4次（preflight2+该输入2）；在同一服务/模型审计/权限下，只再发送一次明确纠正参考定义前空行的真实完整48段输入，不改模型输出或补造UI。每侧只一次输入的初始方案在此根据原样本失败显式调整为after一次受限纠正；若剩余额度耗尽或仍未形成真实触发，保留未达而不再重试。公开输入原request ID/自然回复均另存after-correction，不覆盖首次失败。验收仍要求完整长文与真实首链接解析，不能改成短文或只检查收尾状态。

## 修复后真实验收与边界

after诊断构建原56900 exit0/48.43秒，正式build:vite原27530 exit0/58.63秒，89585 overlay typecheck exit0。两侧Node/Vite诊断插件相同、只观察实际setter，不改分支/输入/定时；正式dist-vite无诊断。没有UI自动化/DOM断言/组件或截图测试。新Source CLI开发服务原42674/18877，IAB67实际交互。06首次after流、07暂停跟随、08/09自然完成同第25—29段；首次格式失败不能当引用重排资格。

纠正原87953 exit0、200/finish stop、4859字/48段、50段落单元、参考定义前后空行。11在第09—13段真实流中，12末尾第45—48段和原结束标记，14首段真实“阅读入口”蓝色link，AX value example.com/；15实际All agents往返后仍在相同首段位置，当前正文、链接与后续段落保持。13停在原失败消息/新输入边界，不能当首链接截图，14才是实际链接对应图。纠正流没有在结束前固定阅读锚点，不以07/09的另一次输出位置证明该流的锚点。

原日志实际观察：before868条去重记录，其中owner42的856条观察含49→1及16→1，最终50块；after首次267条只算普通追加；correction495条中owner46的485条观察，从48块保持48块并处理新目标，最后增加到50。最终窗口current428/received427保持48→48；current428/received428/target50/complete true继续保持48→48，而非依赖最终50长度过早结束，随后收敛50。offline analyze只描述原记录，不进行UI阈值/通过断言。截图不是连续视频，实际修复结论限定为这条分批替换导致的正文截断机制，不能宣称所有Rendering上下文已全面消失。

真实非UI runtime checker首轮要求所有source-reader EOF时，一个后台memory原请求还在reading；没有把原public prompt已200误当全部物理完成。保留runtime-check-reading-001.log，读取同原审计确认memory继续有chunk并正常EOF，再重跑原checker通过：before4/8、after6/8，合计10/16，全部gpt-6.1-sol/streaming/200/源reader settled EOF。3条真实业务回复均stop并有原持久assistant完成事实，没有合成消息或降级接受失败样本。

after公开shutdown HTTP200，原42674 join exit0；两个原native physical/output/request/launcher及exact出生均终态，两runtime完整auth/models对已退休。preserve原checker通过，源全部7表3665行/rowid/字段/时间、schema3/integrity、DB bytes/mtime及完整5键canonical精确保持；clone只有该既有QA Session正常活动时间变化并位于各自真实请求时间窗口，其余原字段与时间精确保留。原授权文件及完整9155406字节models未变。当前版本号不变，无Release/tag/PR或用户进程操作。完整配置性能10秒/5秒仍未达；长期Goal保持active。

交付证据：[原输入、失败样本、15张实页与原生收尾](../../artifacts/2026-10-21-markdown-batch-continuity/README.md)。

最终原秘密值扫描212个自有文本/28612874字节，匹配0、跳过0，private完整auth/models已在两个原scope物理/source EOF后退休；总10/16，未用6次退休。docs:check通过345 ops/26 groups，正式build/overlay typecheck与真实runtime checker均通过。仅提交本轮model、当前架构合同、三索引/本记录和非秘密原证据，保留原.bun/及packages/opencorvus/bun/无关目录。
