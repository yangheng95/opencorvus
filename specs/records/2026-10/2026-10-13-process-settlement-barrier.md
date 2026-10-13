# 原始进程结算屏障与完整 Handle 合同

## Recall

用户要求持续批次并行体验/审计 UI（User Interface，用户界面）和功能，分析真实根因与全部共享影响并先落specs，再实施、真实桌面/人工截图、聚焦正向检查和必要的已授权GPT-6.1 Sol流式端到端验收、精确提交/上游合并/正常push后下一批，直到明确停止。当前Goal仍active，未收到停止。上一批83ee0d843019dad0b921254afcc487c3ec6d3b95已commit/fetch/merge/push全0、upstream ancestor0，33测试107断言/24图/22真实读/前后普通Native与parentjoin0；不是仅计划或未push。此后的Native调查保原before-failed Aggregate子原因unknown，不用新EPIPE倒填旧失败。

本轮开始与多次git status检查，当前已有其它owner的0ea2a524b/e7cbfee23/f6c93a756和当前dirty压缩/执行身份/Univer补丁/package/bun.lock/spec等；保留全部foreign staged/unstaged/untracked，当前real index空，不建branch/worktree/粗回退。不使用no-verify/rebase/force。按用户明确并行请求一层限定file_alias_audit与functional_audit只读独立审计、file_alias_contracts调查搜索，禁止再委托。Root已完整读barrier-and-handle-contract、focused-validation-plan、capsule-boundary-audit及独立occurrence/capsule-review报告；细分读被截断的段落，不把找不到的旧fixture或架构名称算证据。实际OCI fixture是test/fixtures而非fixture。

已读当前server-runtime-readiness、task-runtime-directory、Task控制面/03-control/04-extensions相关合同，原Native规格与v2原journal；全仓查三项Handle定义、全部生产constructor/传播wrapper、spawn/run/原lease/registry/dispose/terminal/checkpoint/restart调用、同名非进程字段、旧factories与引入历史。权威[ECMAScript Promise.all/allSettled合同](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promise.allsettled)明确前者首拒绝结束、后者收齐各settled；repo actualBun/Node时序仍需原checker，不能借标准说明当实机通过。

## 可观察故障、触发和共享根因

独立v2断本人stdout reader：实验6b4e0ab5-9513-4091-a797-37c4ac72cf0f，Host81060/Target13496、原birth与requestca047e46-c804-404b-9f6c-907720ac13c6已绑定。唯一shutdown200后Target exited0；Host write返回false，原once(drain) EPIPE→for-await退出destroy source→原ABORT_ERR包装ref14。公开output和raw output Promise ID5同来源。journal31公开Facade.settled13:13:23.624Z拒绝，32外collector收齐同.624，33Host Aggregate .626，34原Supervisor.settled .629拒绝且35 request ENOENT，36owner退休.647。Host/controller1与Target0分别保留，不把fault报告成功当普通exit0。baseline v2所有具名分支fulfilled、65536B/61B完整、原物理/request/owner/parent0，仅证明其正常分支。

直接根因是util/process-facade.ts69/70唯一Host/Task spawner之后74 Promise.all(terminal,output,原settled)会早拒绝。原Windows Supervisor1940先allSettled物理/输出、真实request cleanup、再组合原错误；公开adapter可以先拒绝并遗漏后来cleanup错误。此次cleanup成功，遗漏后续IO（Input/Output，输入输出）错误分支只有代码证据，不能假称实际制造。通用util/process.ts390–410虽allSettled，收到的raw.settled已是早拒绝adapter，无法恢复丢失原Promise。普通success、runProcess.finally严格dispose与旧正常实例掩盖该公开错误barrier，原before-failed缺逐cause不能归因。

原Task read lease/registry仍等待原tracked Handle，未知physical保owner；修公开barrier不靠counter注销、UI owner、队列/route/LLM（Large Language Model，大语言模型）gate或全局吞错。当前5000ms cleanup budget独立执行deadline，typed uncertainty保pending/evidence，不当完整收尾。继承输出、MCP（Model Context Protocol，模型上下文协议）、browser与capsule资源仍有独立共享边界，不据Host单例降级问题。

## 唯一当前 Handle 来源和接口影响

实际childHandle、Windows Native constructor都有terminalFact/outputSettled/settled，tracked/POSIX detached/Task capsule wrapper真实传播。Windows terminalFact来自已验证exited→exitCode/signal:null；required不新增OS（Operating System，操作系统）signal观测。历史output可选652597357/settled可选76132f342/adapter与terminalFact可选08d9445e2，生产当时已具字段；optional保留理由unknown，没有找到产品缺字段producer。外部wildcard export消费者不可穷举，不以此造兼容后备。

Phase A完整required三项，删除5产品文件13同合同后备：util/process-facade terminalFact??/output??/settled??；Supervisor optional fields及215/226/1182/1292/1297/1857；shell.ts150；file/ripgrep244/261；package-tool-capsule599。保joinPhysicalAndOutputSettlement作为childHandle2027真实唯一constructor primitive，删其optional-output bypass和missing-settled替代用途。server/server56是PendingRuntimeRollbackReceipt的缓存、OAuth/credential/skill同名字段属独立语义，明确排除。

全仓审阅7个factory测试，15构造；需要迁移的是6文件14旧构造（缺F14/O3/S9），plugin signal完整无需字段迁移，仅回归。精确文件为command-inactivity-settlement、file/ripgrep-protocol、process-authority-runtime、process-supervisor-control-plane、shell-deadline、tool/search-code-bounded-execution；control-plane579 ?.catch直接原required Promise。不得加任意resolved闭合字段掩盖仍open/delayed/failing真实fixture流，原byte-source fixture立即settled与后来source failure的矛盾必须按当前prefix/cause合同修正。检索这些7文件无UI自动化或核心负向断言；factory只是局部契约，不替代真实OS/Task模型验收。

Adapter等待原terminal/output/settled allSettled后按原稳定成员顺序收rejected（undefined也是真reason），复用lazy-import的ProcessSupervisor.combineFailures，仅nonempty失败时调用，保sole原引用与多distinct原因。Supervisor一层flatten与通用util递归flatten已有差异保其原角色，不export/copy新collector、不扩无关错误抽象。成功只投影原fulfilled terminal receipt。严格dispose/terminate、物理/输出源和所有公共route/db/epoch/model请求不改。

## 立即横审新 Capsule 资源根因；整体未完成

唯一createOciTaskExec→wrapTaskCapsuleCommand→Supervisor495：runc exec前创建command UUID processFile（含实际args/env，不得原样dump），真实controllerUnit+Task控制root。awaitWithAbort只停止等wrap，latewrap仍可写文件；postwrap signal或defaultSpawn reject无准备owner；exited.finally void unlink.catch吞错且返回base.settled。三Task shell/gated/command入口共享，原lease/terminal/checkpoint消费此缺file的原settled；disposeOciTaskContainer只stop/prove unit，不收commandfiles，retry新UUID和restart无原writer occurrence重读，不能借大目录finally清理证明收尾。

writeFile(wx)可能在独占创建后部分写失败；必须producer先exclusive-open获得删除authority，不能在EEXIST盲删别人文件。拟Phase B由唯一producer持必需prepared cleanup能力穿透wrap，收齐原prepPromise/所有admission失败与base+file唯一settled，保physical未知与原全部cause，不造dummy Handle。原控制命令无signal/deadline，直接join可能无界；传播当前控制与有限uncertainty需独立完整方案。当前spec无writer birth，live-owner修复不能声称crash后安全回收，禁止扫目录认领旧文件。这些不是局部Windows排除，而是仍在整体共享根治范围，Phase A不能宣称全部settlement正确。

唯一wrap现在总返回runc+processFile，unitName/systemctl undefined；旧每command runSystemctlStop/stopUnit静态不可达。替换准备资源时可删除该已证明的旧实现及optional return字段，删除影响仅旧command形状，真实Task container systemd owner是有效独立控制面。本阶段不为兼容旧形状保双源，也不扩大为无关系统服务清理。Phase B实施之前须补原参数/ownership/控制/错误/恢复与真实Linux资格，尚未授其产品修改。

已检索OCI probe冻toolchain支269–286 Playwright launch/goto/textContent属现存UI自动test，未运行。按用户明确规则删除这段及仅为其服务的BROWSER输出期待/配置，保非UI loopback/runc功能；不要改成新的DOM（Document Object Model，文档对象模型）断言。现OCI checks直接create+Bun.spawn和全root删除，不进入真实Supervisor，不作wrapper E2E。Windows helper仅C:→/mnt/c对D:checkout不合格，需修成熟路径转换再重跑真正checker，跳过不算通过。

## 真实矩阵与平台资格

全生产已横审Host/Task pipe/inherit、plugin spawn/run、CLI Child/pager、Shell/bash/Session raw strict、MCP/browser destination、ripgrep/codebase/filebroker/package工具、mandatory/auxiliary/readlease/terminal/checkpoint、重试epoch、restart/orphan/transfer、Task/Mission/Session durable generation、同backend两Project串并行。Task Facade生产仅Process.runTask和command-inactivity.run，均finally strictdispose；没有自然Task只spawn等publicsettled入口。真实Sol search_code→grep.runTask可验证Task authority/轮次/隔离，不能冒充公开错误屏障的直接E2E；Bash更是原Supervisor。真实shell/Mission/Task需要原公开API和真实root/worker/Prompt/epoch，不私填SQL（Structured Query Language，结构化查询语言）或消息、改route/executor强迫覆盖。

root只读平台检查：docker本地npipe engine实际29.7.2/linux/amd64，WSL（Windows Subsystem for Linux）列表Ubuntu24.04初态Stopped、docker-desktop Running。一次Ubuntu只读tool-path命令的原CLI实际terminal exit-1，Wsl/Service/CreateInstance/HCS_E_CONNECTION_TIMEOUT，保UTF16原log；这是该原CLI真实错误，不是tool观察timeout，不猜Linuxshell/VM已死或重开同实例。尚未证明rootless runc/user systemd/controller/path/toolchain可用，不重启Docker/WSL用户服务、不给privileged容器或跳过造green。可继续只读真实状态与选择自有隔离checker；必要服务动作必须先具精确证据和用户授权。Linux/Capsule真实验收、恢复仍unknown，不用Windows替代。

## Phase A验收输入、输出、环境与有限预算

实施前保存和审阅当前5源/6旧factory测试差异，只改授权内容；新增实际adapter正向文件serialized原factory：原output早O→原settled晚O→public同原O的完整event顺序；晚cleanup C最终[O,C]原引用各一次；独立cleanup C原原因；成功原occurrence/pid/signal/receipt；真实Task binding局部服务分支资格。不得core断言未调用/不存在/未settled。原测试按官方backend script/run-tests.ts隔离逐文件，Bun1.4 PATH，当前360000无活动/60000testcase/900000每file执行deadline；准确区分runner与生产45秒请求input，不缩deadline到1ms，模型交互如需要全流式。

原before actualv2已复现，修后Native v3两全新roots native-sink-baseline-01a133-v3 / native-sink-reader-01a133-v3，同真实Bun1.4 Host/finite producer/Node parent，原45秒Facade执行input、65536Bstdout+stderr唯一尾、一次normal shutdown200、不改write(false)→once drain算法；fault只destroy本人reader。透明nonasync原spawn调用一次并return同原Promise；raw observers在adapter之前登记，保原Handle/Promise alias/cause。新增public settled callback在任何catch/finally额外metrics等之前读取原request状态并保存raw-before-public event，不以elapsed最低ms作gate，不伪造错误。

baseline真实terminal0/full bytes/raw/public/native/parent全fulfilled、原request/helper/target/birth/active-zero/cleanupENOENT/owner退休+Host/parent0。fault真实Target0而Host/parent1、原EPIPE/ABORT与parentprematureclose全保，public只在原rawsettled完成后拒绝，发布点原cleanup事实正确；collectorfulfilled不等成员success。callback owner退休单独观察，不为微任务间隙造新gate。fault本身非普通shutdown0，实际branch以原输入/工具output判定。

外围Native checker成熟run-with-inactivity120000，与官方focused runner360000不同；其每command900000和内部45秒是明确执行input，观测窗口到期只记pending并继续原handle，绝不exit/restartsolely观察超时或输出延长input。保v2 finally额外约20ms资格，v3publiccallback在其前建立新barrier，不借finally等待证明。先纯五脚本syntax、root逐个读原代码/inputs再另授一次baseline，真实结算后才fault和原birth只读observer；不触用户进程窗口、不凭据/模型。

focused7factory回归+foreground actualexit7/tree/实际deadlinepeer；必要generic util两个process tests按自身runner；未改lease则不无目标全量生命周期tests。真实UI本人isolated sourceCLI /ui实际Project/Files/search/普通工具交互截图人工作为集成smoke，不能当Native/Capsule机制证明；搜索并发另file-search-publication-order规格。Sol TaskA/B/取消重开/Mission原自然链及capsule/restart独立矩阵继续未完成，环境需成对auth/models、分别资格credential可用/目标projection/每实际requestmodel、无secret记录，无fakeProvider。

## 实施后的独立复核与原检查失败

Phase A五源已实施，独立完整复核三required字段/13后备删除、5个新增正向合同和OCI仅19行UI自动分支删除；当前Task contract是持久binding+注入真实Promise的局部服务证明，不冒称自然Task/LLM端到端。新5tests修改前2pass/3fail/14expect/exit1，原Host/Task早发布顺序及晚cleanup遗漏保日志。修改后官方9文件81tests/140expect/exit0；backend typecheck0。独立复核指出delayed auxiliary disposal factory原settled立即resolved与实际dispose等待不一致，已改引用原disposal并finally释放后join，physical-only正向0合同本身通过。

该单文件原重跑17项中16pass/1fail，不能沿用前9文件green：原background shell test在固定sleep250后仅凭metrics owner count1发送dispose，期望自然root7实际1，原root前态unknown，不能认定旧次必因提前cancel或Native丢7。不能加sleep、改期望或称偶发。root已读真实Rust748–806：root process Wait signaled先break、GetExitCode原code、再Job activezero，尚活时才cancel kill；因此250ms/count1不证明root已自然exit，旧checker准入未知。立即要求normal/cancel/root-exit policy共享横审所有Host/Task/Shell/前后台/lease/recovery入口，真实原ready TargetPID/birth+OS证明原root dead_or_reused后才能测试保原7，background整个Job仍原owned时dispose。returned Handle.exited可能等整个Job，不能拿它代替原root提前终态，root太快时事后observedProcessOccurrence可能不可得，应按原ready出生事实绑定而非猜PID/UUID。

拟只修该正向checker的固定等待，以当前真实原Native协议与OS observer证明准入；产品Rust控制时序不因未证故障改动。先完整横审/原输入方案/root授再修改重跑原control-plane checker；当前其失败仍真实未满足。新增test-types检查的scratch typeRoots本地故障也须修成熟实际依赖路径后重跑，首次TS2688原保，不用工具失败掩盖字段合同。Native v3五脚本/root已逐个完整审与syntax0，baseline原45s/65536tail/普通shutdown与外围120s/900s实际input已另授，未有结果前不宣称通过。

两独立审计和root共享横审已收齐：Shell.run Host/Task=true、Session gated=true、Bash=!background；Shell.launch/一般HostTask command/plugin/inactivity/util facade当前false/默认false，nativeTask原透传；detached restart是exact transfer独立协议，Capsule的runc lifecycle仍Phase B未验。原Rust先存GetExitCode再收Job，live root cancel1合法；当前5源差异不改这些policy或Task/Mission/Session原lease/registration/retry/orphan判断。旧实例没有ready/OS前态，旧1来源仍unknown，不凭源码推测倒填。

现在限定实施旧checker正向准入修正：spawn之前装原request observer，只记request UUID/ready path/runtime自产owner；finally即spawn失败也restore。spawn后读原protocol3 ready，核request/runtime、handle.pid=target_pid、真实targetbirth、detached=false与background=false policy。使用非缓存observeRuntimeProcessOccurrence观察原target（tuple沿现orphan reader924–928，UUID标为request owner来源而非新造Target自产identity）；只有dead_or_reused才继续，unknown_live/观察预算不足保原事实报资格不足，不fallback/count当物理proof。随后正向核具体owner pid/count、真正dispose原7并join原output/rawsettled。标题收成真实已证的background root exit/job结算合同，不声称count证明child可用。删除固定250ms，不改产品policy/期望、不增加睡眠或fakePromise；重跑同一个官方control-plane checker与触及的test类型，原首次失败保留。

Phase B完整独立设计已root读：same Task starts Map共用准备，首command signal不能终止其它正常caller；有限Host.run的5000ms ProcessSettlementUncertainError不携带原pending capability，三个Task catch即释放registration/readlease会越过仍活准备。必须同唯一starts/Task owner保原operation与registration原结算，有限caller结果不当原owner完成，不能计数poll/测试observer当产品capability。现唯一descriptor只有不相关package_tool_inactivity_ms，未找到准备/控制绝对期限与真实descriptor writer；完整crash recovery还缺command→真实writer/consumer的canonical fact family，虽已有runtime_process物理ledger不能伪称已有映射。Linux WSL原实际失败仍未恢复资格、Docker现image并非rootless runc/user systemd checker。只加timeout/cleanup callback或Windows一例都不根治，Phase B未授权产品改动，继续追踪这些原共享缺口。

## 交付与当前状态

初次方案落盘时未改产品/测试或运行新服务/模型/Native v3；目前Phase A已实施，原control-plane/类型工具已修复并重跑通过，Native v3原普通和reader错误轮次已收齐。Phase A scope只5源、6迁移测试+新positive契约、当前runtime架构、已发现19行UI自动分支删除、root/month/artifact索引/分析和原工具logs；Phase B产品未实施，缺口如上明确保留继续推进，不称整体基本完成。root负责真实检查/人工复核，所有本任务文件修改结束前精确commit，freshfetch/merge审完整待push集合、正常hook/push，不混foreign。工具故障先修、原首次失败保留；无法取得Linux/semantic资格时如实列出精确未满足与影响，Goal持续active。

## 最终实际验证与证据资格

旧background checker修正过程中另三次原失败（control-plane-os-root、holder、capture）完整保存。capture原日志证明request observer取得原string字段后，Bun1.4.0的该次toMatchObject/asymmetric matcher把原request字段改为object，造成readFile ERR_INVALID_ARG_TYPE；这是实际检查器传递原事实对象的边界问题，不能把它当产品ready协议缺失。所有matcher改接浅拷贝的断言投影，物理观察仍使用原request/ready/helper；未添加产品fallback、timer或registry gate。最终同官方control-plane检查17tests/38expect/exit0，request96f9d982-fc6e-4e6d-a68d-41a26740bb55，原Target84348/birth639275022797348739在dispose前dead_or_reused，原Helper87360/birth639275022796198659 exact_live，真实dispose7、terminal7/null、原output/settled均fulfilled。原首次1来源仍unknown，不倒填。

初始官方9文件81tests/140expect全部0；随后仅因实际fixture/type/checker改动分别重跑control-plane17/38和process-authority1/13全部0，不能把初始140称为最后整套重跑。ZIP（压缩归档）helper遵守实际声明await Writer.getData()；search source的单literal保source-file类型；scratch类型配置修实际node types路径和src/**/*.d.ts，不造替代声明。最终selected9-file静态检查exit0，backend最终typecheck与root独立原session99222再次typecheck均exit0。原输入、日志、失败、中间config和最终差异见artifact analysis/implementation。

Native v3 baseline experiment3d423824-1112-4bdc-a8c7-0fc0da4e8197，原requestf3505861-857d-47ad-9360-e4dd2e350aa4：实际Target0/Host0/driver0，两输出65536/61bytes精确、所有原raw/public/Native/parent分支fulfilled，15:03:20.204Z public callback原raw settled ID6 fulfilled、原request ENOENT/metrics0。reader experimenta81f5548-2a7e-420c-9cc9-98fe3ff529d6，原requestd53ec252-2746-4d23-82b4-aa6a5c00b996：原Target0，Host/driver真实1，原EPIPE ref13及ABORT_ERR ref15→原Supervisor ref14、Aggregate ref16[14,13]和parent ERR_STREAM_PREMATURE_CLOSE均完整保留。15:12:32.636Z raw settled ID6 reject→.637原request ENOENT→.638 public ID8拒绝同ref14与callback→.640 Host保Aggregate→.641 owner退休；callback在额外finally/metrics等待之前，原request关联资格成立。两次同原run的只读birth observer真实0、原Host/Target dead_or_reused/request ENOENT；fault1保为真实失败，不改写普通0。

根桌面集成由另一file-search-publication-order原UI轮次提供：本人Tab21真实Files query/picker/Editor/简体中文人工查看6张图，18bytes上传完整、当前query2成员，4只读API200，唯一shutdown200、原Native与parent51920真实0。无UI自动测试、无模型/凭据，不能当Task/Mission/Session自然链或Capsule验收。全部原始证据以完整bytes gzip归档，9张页面PNG原样保存；字节回读只验证归档未损坏，不替代功能验收、不以可变源码摘要作门槛。Phase B准备/控制绝对期限的唯一descriptor producer、durable writer/consumer恢复映射、Linux资格，以及其余semantic/输出目的地真实矩阵仍未满足。
