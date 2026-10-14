# 408 保存批准的唯一决定与安全升级

## Recall

用户原始要求：持续按批次并行体验和调查UI（User Interface，用户界面）、功能完成度与缺陷；每批先根因/影响分析落specs，再有证据实施、真实桌面交互/原截图人工复核、聚焦正向功能测试及需要的已授权GPT-6.1 Sol流式端到端验收、范围提交/上游merge/正常push，然后自主下一批，直到明确停止。goal active、无预算；只既有audit_functionality/audit_ui单层委托，不再委托。

407已实际交付8354ac3319bdf66a0292beb615c56208c6f0d8f7，parent58096d4d7cf5695cf290e6737da50332a85c8ae0、637范围路径；独立index正常commit原3968 join54a2e8 exit0，ordinary index精确同步true且空。最终11 selected files、62不同tests/355assert；真实process4/58/8child闭合，公开terminal回复1/22/两listener闭合，4原桌面JPEG人工复核，第二独立Sol原5EOF资格0。首Sol读ECONNRESET资格1、前三公开失败与related01旧wait边界失败保留。完整[407 Recall](2026-10-14-message-continuation-retirement-407.md)和[551交付原件](../../artifacts/2026-10-14-message-continuation-retirement-407/delivery01/README.md)是证据，不把已捕获API核验当新模型轮。

fresh fetch e1950e/merge729190各0、完整pending唯一8354ac331；原正常push88358 join613631 exit0，parent85932→90380/b58e97fa-b9be-41b1-9b83-0c0f177fb660，started1791953230394/deadline1791953830394/end1791953469558。Bun1.4版本、8实际package types（6cache/2fresh）、SDK/AI runtime/迁移v1/专家类型/routes/docs345/26/control owners18/23/architecture20/package10/release5 authorities、exact推送treeish module1163/5937/4clean imports、secret-scan全部正常0；main58096d4d7→8354ac331。这里5937是推送treeish实测，不回改较早运行5936边的原件。再fetch7df990/ancestor911c84各0，确认upstream包含835；HEAD/upstream后来5449398be8381d4ecd9e3669eb86ce4da3220a42、pending空。不是Root创建release/tag/PR。

开始核git status：407本任务文件全部clean，只peer Git扫描/compaction、各索引和`.bun`等改动，保留；不新branch/worktree、不reset/clean/rebase/force/no-verify、不触用户进程/窗口/数据。407收尾检查/Git回执由本批archive承接，不能为写自身commit回执篡改前一提交。

已读：407完整Recall和10 backend路径/所有失败与最后实际owner；完整backend grant-used-followup、UI grant-projection/raw-permission-adapters和151行migration-coordination报告/补读原截断区、当前permission authority/decision/Engine直接slot投影、schema-migration全实现/immutable registry、Database lazy open/strict close/current configure顺序、所有version/liveness/raw openers/fence queries与历史。18段storage原源、24段grant/UI原源、20段raw adapter与已安装ACP（Agent Client Protocol，代理客户端协议）SDK1.4.0保持只读。SQLite官方[WAL锁矩阵](https://sqlite.org/walformat.html#locking_matrix)、[locking_mode](https://www.sqlite.org/pragma.html#pragma_locking_mode)、[WAL共享内存](https://www.sqlite.org/wal.html#use_of_wal_without_shared_memory)及pager源只支持机制推导，不代本机Bun/SQLite实测。一次猜测sqlite-connection.ts不存在已纠正到实际db.ts/openOwnedSqlite，没有当缺失功能证据。

约束：唯一append-only权限账本/唯一current reader-writer/真实Project-Session-Message-call-attempt-activation-occurrence；无新Permission queue/timer/tombstone/平行配置/fallback/历史回写/假批准或时间。全部LLM流式，通用预授权工具实际提供，不以host gate教工具流程。所有非UI改动正向明确输出/错误契约，真实checker；UI不新改跑自动化，只真桌面截图人工看。任何自有验证600s parent/180s child/30s HTTP/60s收尾，原期限不续；Provider需已授权auth+完整models配对、可用/投影/精确请求分别证明、全物理/输出/请求闭合后清理，不能写凭据。当前阶段不访问用户数据库、Provider或用户应用，不改0001基线，不延测试或绕hook。

压缩恢复先读本Recall，再核精确已做/未做/原owner/deadline/命令与最新授权。初始143路径9469和第一锁证据201路径cd19均正常提交/push并fetch/ancestor确认。第一lock-process-01原80885 join38ca9d exit0/2case/11worker全闭合，但Bun内部tsconfig诊断保留；自然package cwd/tsconfig工具修后import-argv-01 d6f095和原完整lock-process-02（7278 join8abb75/2case/11worker）均exit0/全部闭合，Root亲读完整stderr/phase。**无408生产、正式测试、schema revision、业务迁移或服务/page/model启动**。第二297原件已archive，待文档检查/范围提交；backend只准备dual-upgrader/失败释放，UI D1五源码冻结待Root全文审，Task history locale只读。历史graph/consumer报告已Root全文读并选保守冲突策略；event literal/revision/最终source allowlist仍未选，不可提前业务修改。

## 已证共享问题与数据/控制流

Ask的activeGrant分支实际append grant_used但不占唯一decision_slot。execution_started用该真实grant_used.id授权；decisionFor/list/pending/continuationReady、Engine Board直接slot则视为无决定。自43636df96存在，407正常完成仅修现有slot承认的请求，不治此根因。授权capture与revoke/expiry/其他decision竞争需要同immediate事务，现settleDecision两函数catch任意SQL错误后见winner即吞错也需同一严格合同审计。

不能仅在列表/退休加grant_used后备reader。新的真实capture需占原slot、保留原grant source/scope/真实capture time与execution authority，复用既有owned Replied autoReply:true/实际waiter释放且不造userInput或新grant。standalone晚Asked目前只查Project/Session lineage，Task Replied未发exact resolved通知，Board直接读slot timestamp/scope且未持久派生auto_reply；producer和所有current消费者必须一个canonical typed fact reader。历史slotless不可回写、按latest/row order猜winner或把迁移时间伪装原审批时间。

历史候选为追加明确authority-index事实占缺槽、引用准确原grant_used；单一reader只按声明引用解析原授权event id/scope/time。可用原execution_started.source锚定或单一合法历史capture，歧义/冲突/缺source graph给明确迁移错误并保留原backup，不能猜。事件名、最终语义和revision尚未选；closed私有enum/reader/validator/迁移、Settings中英neutral label/operation status、Board原time/id必须一起决定。公开HTTP history event_type为string，不能据新增内部名称便手改SDK；真实shape变化才按原生成流程。

全共享入口含普通Chat/Global/Work/Side/non-Task child、Task-root/worker/delegate/Mission、CLI/ACP/channel/control；normal/terminal/retry/restart/串并行/multiProject须覆盖。原effect physical lease、Task activation/Prompt fence和Mission frontier保持原归属。ACP是真RPC队列，现成typed cooperative cancel不等于peer回复或视觉撤框；CLI为project /event历史输出，channel通知没有edit/delete API且实际人类Task命令重新读Interaction，但确认文案会错述CAS落败winner。外部ACP/channel实客户端未验，不因一个Main页绿就全部通过。

## 升级共性风险与当前最小候选

现schema migrator只在lazy Client首次open运行，BEGIN IMMEDIATE只挡同时writer；旧v1已cached连接不会再查user_version，可读错新index时间/scope或继续追加slotless grant_used。runtime_process只覆盖部分入口，Ask待答/idle/read-only/raw连接可以没有receipt，不是完整DB owner registry。新binary单方version check/新触发器/短BEGIN EXCLUSIVE不能排除旧decoder。

官方WAL（Write-Ahead Logging，预写日志）矩阵明确：已WAL attached连接含idle/read-only连续持文件SHARED。优先实验候选为同handle先NORMAL真正attach已有WAL、再PRAGMA main.locking_mode=EXCLUSIVE并实际BEGIN取得文件exclusive；锁内重读version、同handlebackup/semantic migration/validation/commit，最后NORMAL+实际finalized访问释放锁才暴露业务/安排checkpoint。这是数据完整性准入，不是教模型流程的gate。上游pager支持此路径，但本机Bun内嵌SQLite尚未实测。

必须分析与证明：rollback-journal idle旧连接不适用上述证明；首次EXCLUSIVE会走heap WAL不能直接回NORMAL；两个新upgrader均SHARED可能升级竞争；序列化backup是否同handle；BEGIN/backup/校验/rollback/commit后unlock失败的真实错误与最终version；old真实正常reopen的SCHEMA_VERSION_AHEAD；same-home两Project共享physical DB、不同root隔离、readonly/checkpoint实际句柄。不得杀用户进程或新建registry掩盖缺口。默认WAL之外不猜兼容；未知明确，不先宣布safe migration。

## 当前并行调查与实验准备授权

backend agent先亲读本Recall、当前完整schema-migration/Database physical open/configure/close、真实schema-migration worker/test/checker与全仓caller。只准备一个最小bounded真实锁机制实验方案/source：current v1真实production Database.Client打开并idle/readonly，第二owned process尝试同handle文件exclusive；失败保存明确SQLite错误及原完整v1状态；原owner正常close/join后同候选成功、backup/validation/恢复NORMAL后第二新reader和old reopen的明确合同。借现有成熟NodeProcess/SQLite finalized/migrator原语，不另建测试框架/兼容代码，所有测试输入仅鲜自有data root。先让Root全文审source/原命令与closure，再准运行；此阶段不改生产/正式测试、不写migration callback/新event为业务事实。

UI agent只读更新408生产scope/契约矩阵：一个canonical reader接Authority/standalone晚Asked/Task Board与真实resolved通知/Settings history，加raw ACP/CLI/channel的当前事实边界；挑最小可独立验收的消费范围与真实桌面计划。无新旧UI自动测试检索/运行、无浏览器/服务/模型；不写shared specs/Git。可以保留待决状态，不把未完成外部interop包装为通过。

Root负责407提交/push原回执安全archive、当前资料与全仓历史复核、正式实验选择和实施方案。锁机制未 qualified 前不批准历史index生产；完整旧图/新writer竞争/投影/public错误/SDK与UI语言/交付风险分析未收敛前不开始修改。后续实验证据和方案需先补本spec，再明确授权精确实现。

当前准备进一步收窄：最多两个同时active owned children，总child可随原阶段正常close/join后新occurrence；每个原child180s/阶段请求30s，整个parent600s/60s收尾。v1旧owner必须真正production Client完成WAL初始化而非仅raw夹具；readonly另freshcase由真实Client先建库。候选v2同当前DDL、无semantic callback，只证明锁/版本生命周期，不造业务grant index。当前生产checkpoint实际1s，保持原worker并记录close，不以旧报告间隔假设禁用。prepared source/argv/closure仍需Root亲读后才准实验，没有数据库操作通过声明。

初始安全档案archive408-initial01/fc628b exit0：parent88584→90332/a6609e88-bfc8-440a-8f09-c10360034f85、started1791954072941/deadline1791954672941/end1791954073494，physical/output/request完整，136原件/637854bytes。三README已精确补408行，保留peer排序与资料。下一步先正常docs/index、范围文档commit/上游merge/push，再继续实验准备；不将初始文档提交算本批功能完成。

## Root全文复核与第一真实锁实验输入

Root已全文读`.tmp-grant-decision-recovery-408/functionality/README.md`及launch-lock-probe.ts、run-lock-probe.ts、lock-worker.ts；也全文读UI production-scope-and-desktop-plan及其中D1–D4/原到达顺序、当前语言和外部interop边界。初始文档143路径正常提交9469d4ace470ba5ee3aadcefb3708f139fe68bd7，base c6c2bcafb12d00e90a65481f7abf02389dcf1521；原25826 join e7dd78 exit0、ordinary index精确同步true。fetch f5c25b、merge2127c5各0；后续fresh fetch2b32bb/mergefc8bb7各0。完整pending当时为9469和peer8da864d5共享Git源条目交付；Root已读其要求/实施/验收记录及实际breadth24pass/83assert和5项final-checks原exit0、parent原0与双输出joined。正常push408-plan01原32126仍运行，不能预写已推送。

首版driver在case finally中只保存Promise.allSettled、不检查rejected或真实非正常exit；收尾写入/删除异常可能替换主错误。Root已限定backend agent只修准备工具：主错误和所有cleanup错误分别保留，检查真实receipt.reason/exitCode和physical/output/request，任何失败为failed；仅全闭合后删除精确managed root。launcher也要求真实exited/0，不能由null或其它reason推成功。此项是本地验收工具修复，无生产或正式测试修改；修后Root复核完整diff才启动。

冻结首实验为独立fresh目录`.tmp-grant-decision-recovery-408/functionality/lock-process-01`，只上述三source和成熟NodeProcess/managed directory原语。精确命令：Bun1.4.0完整绝对executable先进入PATH，`bun run .tmp-grant-decision-recovery-408/functionality/launch-lock-probe.ts D:\myhexin-local\opencorvus\.tmp-grant-decision-recovery-408\functionality\lock-process-01`。最外原600000ms，driver继承同deadline/60000ms收尾；worker180000ms且受original closeBy限制、phase30000ms、child15000ms收尾；最多两个同时scenario worker，监督/driver为归属层。失败保原scope，不重写原结果或重置预算；正常关闭精确自有handle，不触用户进程。

两个独立顺序case：actual生产Database.Client/Identity建v1并保持cached idle（真实1s checkpoint不关闭）和actual生产seed闭合后readonly idle。B同handle NORMAL实际WAL attach/完整schema与rowid正文snapshot→EXCLUSIVE→原migrateSchema的真实BEGIN，应得到原SQLITE_BUSY且恢复NORMAL后完整v1事实一致；A normal close/physical-output-request join0后B同handle明确第二次进入，原backup/完整validation/COMMIT到scratch v2（相同当前DDL，无semantic callback）。B持真实exclusive时一个新reader应得到明确SQLITE_BUSY并闭合；NORMAL+finalized read真正释放后新reader原migrator应读from2/to2及原完整事实；旧生产v1 reopen应返回DatabaseUnavailableError的SCHEMA_VERSION_AHEAD与原operation。每个角色原异常/typed cause/cleanup/真实receipt独立保存，同handlebackup另owned文件全v1读取后strict close。逻辑正文/bytes/schema/rowid逐项比较，不以hash当功能验收，不归档整个DB或凭据。

此实验只资格本机Bun1.4/SQLite WAL文件锁与version生命周期，不能资格历史grant semantic migration、rollback-journal、custom/immutable/no-lock VFS（Virtual File System，虚拟文件系统）、compiled Bun1.3、physical alias、两个新upgrader升级竞争、backup/validation/unlock注入或UI/模型。未知仍需下一独立输入；即使本实验成功，也不批准历史index生产。当前尚未启动lock-process-01，准备修正及最终Root复核是下一步。

初始正常push408-plan01现已原32126 join444e5a exit0：parent87416→82940/2d0be023-dabb-47d2-8b1c-2392a255f5df、started1791955108498/deadline1791955708498/end1791955382466，physical/output/request全closed。完整pending两项9469与已核peer8da864d5由main c6c2bcafb→8da864d50正常推送；8 actual typechecks（7cache/1fresh）、SDK/AI runtime/迁移v1/专家类型、routes6/35、docs345/26、leases18/23、architecture20、package10、release5、exact treeish8da module1164/5943/4clean imports/no SCC、secret-scan0hits均0。fresh验证fetch92a82e/ancestor705db8各0、pending空，upstream包含9469。未发Release/tag/PR；原push全日志将进下一安全archive，不把初始文档当功能完成。

Root已全文复核有限cleanup三份精确patch、修后三source和更新README。original cleanup-before三原像保留；child/driver/outer只从实际exited/0及三joins判资格，异常聚合保留，atomic owner文件与真正NodeProcess receipt一致；worker terminal证据失败在原stderr保AggregateError。TypeScript5.8.2只parse source为0，不是运行资格。Root现在批准并亲自启动唯一上述lock-process-01命令；agent不再改这三source，原预算及scope不变。批准仅此fresh机制实验，不含业务index/生产/schema新revision/UI/Provider。

## 第一真实WAL机制结果与工具链诊断

lock-process-01原80885 join38ca9d exit0：outer parent74028→driver50920/af93d144-ef5e-49df-b49d-c1a0d2096959、started1791955599763/deadline1791956199763/end1791955628572，28.8s；两case、11 original workers真实reason exited/exit0、physical/output/request全joined，primary/cleanup正常，两个精确managed roots已删。Root原7c6e30读取driver和各original phase JSON：本机Bun1.4.0/SQLite3.53.2（source ID保原件）、517对象/90表及真实database_authority。生产cached idle和readonly idle分别令B得到SQLITE_BUSY/errno5（5663/5578ms），恢复NORMAL后的完整原v1内容由actual checker比较；A正常close/三joins后B同handlebackup和validation/commitfrom1/to2。Backup实际readonly full v1内容一致并strict close；保exclusive时独立reader确BUSY；NORMAL+真实finalized访问后新reader原from2/to2及原内容一致；old生产v1 Client重开确DatabaseUnavailableError/SCHEMA_VERSION_AHEAD/Database.Client.schemaMigration。无business semantic callback。

补读stderr发现driver及11workers均含Bun `Internal error: directory mismatch` 指向实际packages/opencorvus/tsconfig.json，虽然原receipt全部0。不能称工具链clean，也不据该文字否定已保存真实SQL/closure。Root亲查[Bun原issue25730](https://github.com/oven-sh/bun/issues/25730)、[原issue28605](https://github.com/oven-sh/bun/issues/28605)及[官方runtime](https://bun.sh/docs/runtime)：override已报道类似诊断，不能代本机直接因果。一次猜测官方runtime/tsconfig链接404已改查真实文档，不作实现依据。repo当前packageManager为bun1.4.0。

先修本地工具调用并重跑同原验收：agent已暂停followup扩大，仅保首source于followup-before；考虑driver cwd改现packageDirectory、去两处tsconfig-override，由现唯一package tsconfig自然解析，worker cwd保持package。不复制平行tsconfig、不过滤stderr、不延预算、不改SQL/role或试探用户DB。先准备只import现模块且不调用SQLite构造/Database.Client/migrator的资格入口/原owner，Root全文审后运行；再新lock-process-02完整重跑同两case，第一次scope不覆盖。之后才审两个upgrader的真实竞争/backup文件故障/validation失败/NORMAL释放/commit后unlock失败，rollback-journal/crossalias/compiled旧Bun边界继续未知。历史index语义、canonical reader和生产allowlist尚未选择，UI服务/截图/model未启动。

第一安全原件archive408-lock01/3995a3 exit0：parent86704→48796/46d713c0-8666-4aea-bc7a-810d0d017585，started1791955876245/deadline1791956476245/end1791955877223，三joins全closed。内容为原锁scope/actual source/所有内部诊断、cleanup原像与patch、初始正常提交push原回执和完整UI只读plan；排除任何DB/runtime/auth/models/Provider正文。存储gzip逐bytes还原只验capture身份，未当功能门槛；[本次原件](../../artifacts/2026-10-14-grant-decision-recovery-408/lock01/README.md)承接准确范围与未知。

Root已全文读UI历史single-hop报告（first95+remainder，36807chars/39 source captures），现落具体历史选择：已有任意真实slot与另一slotless grant_used并存均报明确authority conflict，含未started；不按time/rowid消歧。无slot的单合法capture可确认为已捕获而非已执行；多个capture只按合法deterministic execution_started.source准确锚定，否则报ambiguity。合法已捕获U不因当前grant已revoked/expired而删除；旧read/capture交错没有持久eligibility-read时间，不声称证明历史串行化。重复requested保原first occurrence身份/time/summary/metadata，只核全部owner材料（Project/Session/Task/Message/call/provider/fingerprint/scope/mode/policy）；不以所有文案/metadata必须相等排掉合法观察。迁移callback会先drop unique index/trigger，必须全图核slot/attempt/reference再append，不靠.get临时仲裁；canonical reader需接受原TxOrDb、无runtime Database/Authority循环。此处仍未选event literal/revision/最终source allowlist，未授权生产实现。

后续UI agent只准备当前开发/ui的D1 before真实手工流程输入源码/原owner：独立外部非秘密CSV、真实AllowProject、第二exact-scope read、cold hydration和Settings/语言；控制流式Provider资格与真实Sol分开标，不造批准/userInput/终态。不启动DB/服务/页面/模型、无需凭据，工具全文Root审后才准运行；保存闭合的原旧producer data供后续合法迁移。backend先复用唯一physical launcher准备import mode/natural package tsconfig资格，原SQLsuite02仍待Root批准。

本阶段docs408-lock01/b452bb与architecture408-lock01/f8e18e原均0/三joinsclosed；还未提交本阶段新spec/197captures，不预写交付完成。初始自身Git回执保在lock01，下次提交的回执仍由后续记录承接。

197captures与spec本阶段201路径现正常提交cd19bd56c4f68f96f7c9828da201088a181faec4，base6370e9d9805a261ee9980a13bf2aa02f921fb106；原30848 join12a8bc exit0、ordinary index精确同步true/空，未混入peer压缩/UI/Git写入改动。fresh fetch96bdcb/merge3b0237各0，完整pending唯一cd19；正常push408-lock01原93139仍运行，不预写已推送。

Root已全文审去override两patch、import-qualification全source/plan及同一launcher的import-mode有限diff。一次读取import-mode-launch.patch时文件尚未落盘原bb3192报缺失，后续实际文件已亲读，不据暂缺作产品问题。现在准入单一import-argv-01：Bun1.4完整exe和PATH，`bun run .tmp-grant-decision-recovery-408/functionality/launch-lock-probe.ts D:\myhexin-local\opencorvus\.tmp-grant-decision-recovery-408\functionality\import-argv-01 import`。同600s outer/60s收尾，单child180s/原30s import wait、真正package cwd/原empty bunfig；managed fresh runtime、OS names allowlist加精确ownHome/TestHome/ProcessRoot/supervisor。只读取真实module exports、lazy状态及owned path/目录，不调用SQLite构造/Client/Identity/query/migrate；外层核actual PID/deadline/result及三joins后删精确managed root。完整stderr亲读再决定原SQLsuite02；不是UI或业务资格。

import-argv-01原d6f095 exit0、1.59s：outer84144→90096/4e74e93b-2faf-4643-9714-08604e0a8982，started1791956564203/outerdeadline1791957164203/childdeadline1791956744209/end1791956565164，exited0/原returned-settled一致/三joins完整、精确managed runtime已删。实际10module exports/registry1/lazy uninitialized/own Database.Path输出qualified_imports_only；Root已亲读完整原stdout和stderr（原stderr0bytes），不是把语法parse或无DB当SQL机制验收。

Root现在准同唯一launcher-default在fresh lock-process-02重跑原完整两case：`bun run .tmp-grant-decision-recovery-408/functionality/launch-lock-probe.ts D:\myhexin-local\opencorvus\.tmp-grant-decision-recovery-408\functionality\lock-process-02`，完整Bun1.4 absolute executable/PATH、同600/180/30/60，SQL/worker不变。只变已审package cwd/natural tsconfig；01原日志/actual source/diagnostic保留。原original tool需要再次完整join和phase结果复核，尚未准双upgrader/失败注入/业务index/生产/UI/Provider。

lock-process-02原7278 join8abb75 exit0、34.0s：outer78820→88856/8da10af1-f882-413c-90a6-edb8dbbb78b8、started1791956599342/deadline1791957199342/end1791956633375。两个case/11worker实际exited0/三joins和两个managed根删除全部true；Root b3dae0亲读每个phase与每份完整stderr。现actual生产opening/schema info正常、outer stderr0bytes，和01诊断不同；没有keyword过滤。same SQLite3.53.2/WAL/517objects/90tables；live旧owner使原BUSY errno5（5786/5741ms），正常关闭后同handlev2/backupv1完整验证、锁内readerBUSY、NORMAL实际access释放、新reader2→2、旧ClientSCHEMA_VERSION_AHEAD均再次实测。只此argv工具与原机制qualified，未外推语义/双升级者/失败释放或compiled旧宿主。

cd19原正常push93139 join6c96ba exit0：parent19716→89480/8af3bbdd-1a7d-4f70-b1a8-393c1d8a2acf，started1791956524514/deadline1791957124514/end1791956669820/三joins完整。正常hooks全部0：8actual types全cache、SDK/AI runtime/迁移v1/专家类型/routes6/35/docs345/26/leases18/23/architecture20/package10/release5/exact treeish8323 module1164/5943/4clean imports/no SCC/secrets0。启动前完整pending只cd19，但并行HEAD在真正push取值前加入peer8323a502（compaction source-view response边界），实际main6370→8323；Root没有将这个并发事实改写成只推cd19。事后Root亲读完整25-path集合/2production差异/该任务要求与Recall、实际37+46+10=93 backend资格原logs/102 credential-free流式矩阵/expandedtypes/docs，验证它为本仓库已授权交付，未复跑或混充Root408资格。下次正常push将绑定fresh合并及完整审阅的准确HEAD refspec，防止取值期间新增未核提交；不改upstream、不force/rebase/创建branch。fresh fetch262347/ancestor d12bb7各0，pending空，upstream确含cd19。

第二安全archive408-lock02/1bfaca exit0：parent17140→76480/f4d724e9-652e-421c-8122-3e4da37d1330、started1791956907062/deadline1791957507062/end1791956908428，三joins完整，297original files/24443848bytes。完整原02、import qualification、argv/mode原像与patch、历史single-hop39份source/报告和cd19原Git回执承接在[第二机制资格原件](../../artifacts/2026-10-14-grant-decision-recovery-408/lock02/README.md)，未复制DB/runtime/auth/models或Provider正文。docs/index/本阶段范围提交还需真实完成；不把scratch version2当registry已改。

下一只准备：backend复用原唯一tool的显式followup mode审真实两个NORMAL已attach候选升级竞争/失败normal close后current reopen、backup文件故障与validator throw的rollback/NORMAL释放、commit后真实unlock失败（无法合理无mock制造则标unknown，不造失败）；原600/180/30/60/max2不变，尚未准运行。UI D1五helpers（约30KB/412行）已冻结，真实动态端口/保独立owned OS-temp旧数据；Root尚未全文读，未准启动。Task Permission history新auto provenance需一起接当前语言，准备复用现405 Question canonical phase-part/同CardParts，候选utils/interaction.ts/transcript.ts/CardParts.tsx；真实toolName取payload、不剥英语title/存翻译正文/第二renderer，仍只读方案。Task自动卡须自然可达才视觉资格，不能从backend flag冒称。Root全仓搜索确认scopeVersion2/project eligibility与grant_used同源43636df96，不从scope名称猜旧format。

Root后续已全文读D1 README/五source和Task history locale plan。验证工具先补原spawn/admission Promise、physical/output和caller层级真实收束（不得令requestSettled=physicalJoined）、主错+stop/drain/cleanup/terminal-write错真实聚合和package cwd/natural tsconfig/原empty bunfig；agent只改准备工具、保原像和diff，尚未准启动。新手工交互scope声明600s parent/60s收尾，单互动service继承同original deadline，routine lock workers仍180s；这是尚未启动的新scope的预算，不延原01/02或任何既有owner。UI三file history外明确选一个InteractionCard点修pending Task标题，真实payload.toolName+现t label；缺失/未知decision必须明确error，不default allow_once。backend technical原title/用户/模型原文不剥词或回写；只是方案选择，生产/正式UI验收仍未开始。

Root读另一已授权任务的原hostGit静默deadline未结算证据后立即按共享机制横审：actual util/process.ts的scheduleDeadline同一Map/Atomics.waitAsync时钟同时负责admission、absolute deadline、inactivity和settlement；process-node.ts:695 NodeProcess也经同createProcessFacade，不能以01/02正常闭合排除共有timeout问题。已亲读默认clock、Node adapter收束/构造和现Host/Task/SDK/Plugin/channel caller搜索；一处猜src/process目录不存在已纠正到实际util/process，不据目录名归因。全部生产entry、Task/Mission/Session occurrence、正常/终态、timeout/retry/restart/串并行/multiProject的完整原期限资格仍需与[当前真实调查](2026-10-14-project-metadata-latency.md)代码及原进程事实核对；本锁资格只normal+真实SQLite busy。Root未改正在其它任务调查的process源码，也不新增heartbeat/parallel timer/fallback遮蔽。新D1长服务暂不启动，独立继续分析/工具准备；未降低为单workflow或模型行为。

本阶段docs408-qualification01/3cba27与architecture408-qualification01/ae7749原各exit0/三joinsclosed；下一范围仅第二297captures/当前spec与artifact READMEs，正常提交后fresh merge/完整pending审阅/精确已审HEAD refspec正常push。历史index生产与正式正向tests、真实desktop/截图/Sol尚未达成，goal保持active。

301范围路径已正常提交b08202cac9f9fab4131e94218881118645a5b9b4，parent8323a50297f949a4bedeeebba51ffeaa31b2bb86；原93095 join500425 exit0、ordinary index精确同步true/空。commit期间ordinary index尚未同步时原git status读到暂态staged deletes，实际文件全部保留；未restore/reset，原helper完成后本任务index已收敛。fresh fetchb7662f/mergecc71ee各0、完整pending唯一b082，读取已配置origin/refs/heads/main并绑定准确HEAD refspec正常push。原50140 join9da2e4 exit0：parent85080→19684/2190598e-e9b4-40c7-a45a-1663e081d049，started1791957700630/deadline1791958300630/end1791957915278，三joinsclosed；完整normal hook日志保在后续archive，不创建branch/tag/Release/PR。

共享调查新增反证已Root亲读：当前Git原单消费者保存首字节48.048s、随后1/2/3MiB持续增加，125.648s达原4MiB诊断容量，真实output_limit/三joins/Native零active在53ms收齐、index原137bytes保留。旧caller仅等aggregate返回，不能称leaf静默。另真实10s Node无额外timer/Atomic probe，10007ms inactivity terminate及55ms三joins，再加冷Host523ms/waitAsync298ms和共享code，足以排除此Git实例的clock失效根因；不是所有Task/Mission端到端通过。Root已纠正commentary，未修或另建clock/延期限。先前read-only shared-deadline-boundary报告冻结时unknown保其时点，当前因果以实际输出证据补充。原Native Git junction/source比较的独立问题由其完整共享方案继续，不能混入408。

Root全文复核followup-plan、shared-deadline-boundary、handoff与三完整既有source及全部followup02精确patch，限定新mode复用原唯一工具。现在准独立fresh lock-followup-01：`bun run .tmp-grant-decision-recovery-408/functionality/launch-lock-probe.ts D:\myhexin-local\opencorvus\.tmp-grant-decision-recovery-408\functionality\lock-followup-01 followup`，完整Bun1.4 absolute executable/PATH，原600/180/30/60/max2不变。三freshcase/预计14original worker：实际seed正常闭合；两个NORMAL真attach同时单次升级，保存两BUSY或一BUSY+一原commit，全部join后一个明确新occurrence完成/读取current；真实backup路径普通文件故障、真实validator throw，原rollbackv1/完整正文及backup验证、锁内独立readerBUSY、NORMAL真实访问释放后原productionv1正常identity/snapshot重开。只此SQL机制输入，不是历史业务index或新生产registry。commit后unlock真失败不能在合法前提下无mock稳定制造，保unknown，不假故障；rollbackjournal明确不支持idle排除。原01/02/import actual sources和三原像保留，任何原结果不覆盖。

## Followup原失败与新的检查器分析

lock-followup-01原8e9d48真实exit1，无继续session；outer82800→driver79256/92cc2a56-e50c-4073-a9d8-f96851029373，started1791958078263/deadline1791958678263/end1791958083714。只执行normal-candidate-race一个case/3original workers，后续after-race/backup/validator未启动。seed87576正常exited0；race-a80316/53701579-ba4c-4c79-8d0a-9a906324bea2真正原migrateSchema from1/to2与v1 backup；race-b61964/c6a40d44-a07e-4886-a12a-54c32f373c49真正原from2/to2，无backup。race-b随后被worker252的固定from1断言拒绝exited1，首失败保留，不能改写为资格通过。

Root c9d05b/ca00e4/ae32c8亲读原driver/case/attempt/ready/共同marker/原stderr：共同race-start1791958080030含两个actual pid、NORMAL/WAL；两ready已各自读完整original version1。race-a原attempt1791958080042→1791958080419，race-b1791958080044→1791958083609。两成功都被准备工具写成committed，后续driver也误要求busy至少1及用success数量推final version；这三项是未证明的检查器假设。race-a真实NORMAL+finalized access释放有原记录；race-b断言前未走该释放分支，但原finally raw strict close正常完成。全部3workers request/physical/output真实joined；case failure主错和所有cleanup错保留，exact managed runtime只在closure后移除。不能用最后assert错误推断锁本身不安全，也不能从from2/to2就外推旧cached reader安全。

下一只读共享锁转换审计已给现backend agent：核原代码的foreign_keys/schemaVersion pre-BEGIN、pager WAL状态与busy重试，区别合法新candidate重读current和旧cached reader是否被排除；旧production/readonly原01/02事实仍有效但不是本race的第三owner证明。不运行新scope、不放宽断言、不造BUSY、延时或新clock。权威pragma/WAL资料与原代码支持推导，本机真实锁阶段仍是必要证据；首次源码网页不可访问不充当代码证据。

## D1工具复核与准备当前桌面输入

Root全文复核review01 driver/server和README/manifest、其余三源原字节未变，以及完整locale计划的选定四文件范围。driver用现NodeProcess.run原Promise finally记录request settlement，onSpawned只证明实际fulfilled admission，原terminal/outputSettled/settled分别收齐；请求未准入的未知保持not-observed。原错/cause/stack与每项stop/drain/环境cleanup/terminal-write错分别保留，末stderr AggregateError不遮蔽。actual package cwd、现empty-bunfig、自然tsconfig，不复制配置/override/隐式native build。review01原像与准确diff冻结保留。

当前Git共享clock怀疑已由前述真实字节/独立10s Node反证排除此实例，无clock实现改动，无额外timer/heartbeat/期限扩展；不因旧prepared文案继续无期限暂停D1。Root现在选先prepare/read唯一成熟407 private UI build的408 fresh调用，再亲自执行build和D1 before01原600s/60s scope。仍不准agent启动。当前真实开发backend服务/ui，private bundle只编译当前source，不独立Vite服务器；Node启动Vite，不UI自动化。控制Provider全部真实流式但只局部fixture资格，无凭据/真实Sol资格。

D1真实人类动作范围：公开首prompt、在页面对actual请求选AllowProject、同Session真实composer发第二prompt、cold selection、Settings展开两真实operation及同页语言切换、原截图人工复核。保真实saved-grant数据在单独owned retainedRoot供未来已审升级，只归档公开fact/原source/owner/截图，不归档DB/config/private bundle或Provider正文。生产/正式测试/schema仍未改，历史event/revision/最终allowlist还未选择，具体Task automatic arrival视觉尚未达成。

D1 review01尚未运行时发现另一准备工具问题：async appendFile observer不受现ProcessRunRequest同步void合同结算。Root ff16c3/94d4ca亲读process.ts:136–137、collectOutput:473–486、observe:576–586及run收尾：callback原同步调用/仅catch同步throw，不await返回Promise，异步写入或reject可能越过run/output加入。它是准备工具单独callback合同错误，不是已实跑故障或clock根因；影响原日志身份/closure证据，不能保留。Root限定UI agent只将两observer改现成熟同步appendFileSync，保当前review01原像与精确diff、同步void及原错误捕获；不修改共享Process实现、不加副作用队列。build使用已实测407 run返回原bytes后await日志写入合同。Root复核此小patch再运行D1。

Root全文读followup01-race-analysis（078018）及actualschema/worker/driver，独立亲查[SQLite对应3.53.2 Windows源码](https://raw.githubusercontent.com/sqlite/sqlite/version-3.53.2/src/os_win.c)3200–3212与[真实manifest.uuid](https://raw.githubusercontent.com/sqlite/sqlite/version-3.53.2/manifest.uuid)。它和原sqlite_source_id核实同发布源码；EXCLUSIVE升级先winUnlockReadLock，失败重新读锁，原busy handler可内部等待。两个主动新upgrader不能当持续idle旧reader。没有OS逐步trace，不分配具体毫秒到PRAGMA/BEGIN；原事务内第二次schemaVersion才是最终receipt.from。本次真正可证为1→2及2→2两完整快照相同、A真实backup与NORMAL access、B后续assert/strictclose，全scope仍failed。

Root准backend只修现scratch checker分类并准备独立guarded-race mode，保首失败与修前3source/diff：成功按upgraded（原1→2/真实backup）或current（精确原2→2/实际validation）分，busy保存原SQLITE_BUSY。鲜v1/仅两写入者仅合法busy+busy、upgraded+busy、upgraded+current，最多1次真正upgrade；post-closure新from据真正upgrade而非成功调用计数。每成功仍需完整source/rowid/bytes/validation、真实NORMAL access与strictclose，不能仅放宽252。原followup新scope仍max2/600/180/30/60，backup/validator原代码不为分类改动。

三方补格是另一个尚未启动的全新fresh lock-old-reader-race-01，仅该guarded-race场景max3同时scenario workers，原600/180/30/60不变、不改已失败01期限或普通case上限。driver不打开DB；seed真实关闭后一个旧production cached Client/Identity保持原1s checkpoint，两个新候选NORMAL读完整v1，原common marker真实证明第三旧owner已ready。两新者各必须实际SQLITE_BUSY/正常三join，之后旧owner完整v1/identity正常close/三join；再新after-race真正1→2/backup、current2→2与旧build reopen AHEAD。预计7workers/1root；若旧owner live却升级，按共享安全红态保事实调查，不改预期。只准prepare，Root全文审修后source/精确argv/closure再各自准运行；rollbackjournal/alias/compiled旧host/unlock真失败/业务semantic仍未资格。

Root全文读ui/build-ui.ts（10f6b5）和build-before-plan（51d901），及原407完整build-ui、当前overlay package/Vite配置。选当前private fresh ui-before，Node实际Vite argv/overlay cwd，不用UI test/Vite server、不改source conditions/shared dist/config。single child原closeBy540s、parent600s/60reserve，原request finally/admission/terminal/output/settled分别记录、全bytes后await落log，主错/所有收尾错保留。agent冻结后Root准精确命令：package cwd、Bun1.4/现empty-bunfig自然tsconfig运行`.tmp-grant-decision-recovery-408/ui/build-ui.ts`；外层真实join/完整stderr/exit与scope-final后才准D1。这里只批准独立编译输入，不把build当UI验收。

Root96c57c亲读review02唯一syncobserver patch/完整preparation及冻结确认后实际build-before01：原75bad4 session22957→a2c755真实exit0，parent77044→Node66920/028c57ef-df76-4fc0-ae62-93f55422d777，started1791959003750/deadline1791959603750/child closeBy1791959543750/end1791959064490（60.74s）。原run/physical/settled receipts同一exited0、request/output/handle全部joined、exact parent临时root removed、primary/cleanup均空、scope-final built，外层exec已join。private index11891bytes只是实际构建产物，不是功能验收。

首失败archive408-followup01原439ffe exit0：parent80996→72484/9329b419-ca6b-488b-878e-1a130b0e4084，started1791959031449/deadline1791959631449/end1791959032132，三joinsclosed。101originals/12464172原bytes，含首failed01完整actual source/facts/errors/3workers、冻结输入/99行分析与b082正常Git交付原件，明确后续case未启动；不把archive exit0换算原checker通过。

Root现在准D1唯一fresh before01当前backend开发/ui：package cwd、Bun1.4绝对exe/现empty-bunfig、review02五冻结source、已完成ui-before，原600s/60reserve服务继承same original deadline。精确driver argv为绝对`.tmp-grant-decision-recovery-408/ui/d1/grant-read-driver.ts`、绝对`ui/d1/before01`和绝对`ui-before`。只public controlled streaming两read轮/自有非秘密CSV，真人在独立自有页面批准与第二visible prompt，截图手工复核；真实stop后原driver/exec三joins，exact retainedRoot只留作后续合法历史输入。无真实Provider凭据/Sol、生产/schema修改或自动UI测试。

## D1原隔离拒绝与工具根因

before01原e1d7df真实exit1/完整join，无session可续：parent82020→88124/6a26c1f6-b257-4fb1-80cd-dadca7f6befd，started1791959110966/deadline1791959710966/end1791959112684。child/driver原request、physical、output、handle全部joined，parent临时root已删，独立retainedRoot保留；尚未ready/浏览器/用户prompt，requests实际空。Root d33135全文读child原stderr/terminal，根因是工具声明HOME在独立retained目录却继承另一个bootstrap的TEST_PROCESS_ROOT，真实global/index runtime-paths准入报OpenCorvusTestRuntimeIsolationError/INVALID_OPENCORVUS_TEST_RUNTIME。driver91 exit断言只是次级失败，不作根因。首次source和failed terminal保留，不扩大产品root合同、不移除校验或重开原scope。

Root 2baf23亲读runtime-paths完整校验、test-runtime-environment的bootstrap/环境/owner-marker/cleanup权限及runtime-directories成熟原语：TEST_HOME下HOME必须为其真实processRoot严格后代；bootstrap已建立该单一fresh runtimeRoot/tmp。现在最小修正选择**一个原bootstrap owner**：driver先正常bootstrap/apply，再把真实isolated.processRoot/runtimeRoot声明为待保留的retainedRoot/runtime；server核实际已创建runtime目录而不第二次mkdir。child继续继承同一真实owner/nonce/HOME/TEST_PROCESS_ROOT，不手设新root旁路guard，不建立两个隔离配置源。

为未来真实旧数据升级，这个原owned环境在全物理/输出/request正常结算后明确保留（含原home/tool临时环境），temporaryEnvironmentRemoved保持false，原owner path与retained reason真实记录；后续完成迁移验收后Root依据精确owner/normal joins用现成熟删除原语清理。不能仅为现在标removed而删未来输入，不能复制liveDB或伪造cleanup authority。原before01的独立失败root无数据可供迁移，其原件仍保留。本次只准UI agent修driver/server实际环境/retention输入及README/manifest，保review03原像/精确diff，不变Provider/control/facts/SQL或生产；fresh before02复用已闭合ui-before，600/60新scope，Root全文审后准重跑，现尚不执行。

Root06ee5d/1089d3全文读race-review-plan/manifest与三完整精确patch，对照已全文读原三source/首失败actual source。限定分类实际upgraded/current、只有真upgraded备份、原完整validation/快照/NORMAL访问与strictclose；父完整组合/真upgrade计数和原三join控制已修，普通backup/validator原分支字节未变。guarded唯一max3，第三actualoldproduction身份/完整v1与原1s checkpoint不变，候选真实BUSY后才oldnormalclose，原PID/occurrence收据及新after-race三owner闭合核验完整。TypeScript parse0只是静态准备，首失败仍未回写。

Root现在批准并亲自首跑fresh lock-followup-02唯一原launcher `followup`，完整Bun1.4 exe/PATH、原600/180/30/60/max2/3case预计14worker；成功不能由准备预期或版本号单独判断，要亲读原receipt/完整stderr/各phase。guarded-race命令虽已审仍等这轮实际结果后另准，不并发复用任何库。生产/正式测试/schema/Provider权限不扩大。

lock-followup-02原ecb5f9 session27855→34bc52真实exit0，parent80344→36696/25d1e32c-bcde-48b6-bcd0-6bf107a27763，started1791959463588/deadline1791960063588/end1791959487151（23.56s）。三个case/14原worker都exited0与request/physical/output joined、三个exact managed root已删，primary/cleanup空。Root dece0b全文读outer/每个worker完整stderr和case/receipt，a61955亲读各phase真实receipt/error/rollback/NORMAL/Identity；没有把根目录exit代替phase验收。

原race实际race-b真正1→2/backupv1，race-a同原调用2→2；complete signature current+upgraded。两者各原validation2/fullsnapshot/NORMAL finalized访问/strictclose，全部原owners正常join后新after-race2→2、current2→2、旧v1Client真实AHEAD。backup-fault原目录普通文件使mkdir真实EEXIST，SchemaMigrationError/SCHEMA_MIGRATION_FAILED/causeEEXIST；validator-fault原validate已看2后真实OWNED_VALIDATION_REJECTED，原SCHEMA_MIGRATION_FAILED及v1 backup。两者原ROLLBACK完整v1、持exclusive时独立reader原BUSY、NORMAL实际访问后productionv1 Client/Identity完整原内容reopen，最后samehandle正常close。scratch仍无semantic业务callback。首failed01仍failed，不回写。

Root现在准独立新lock-old-reader-race-01唯一`guarded-race`命令，已审同三source，仅此fresh场景max3，原600/180/30/60/预计7worker，第三旧production真实1s checkpoint/identity/v1先ready，两个候选各需原BUSY/closure才oldnormalclose，随后upgrade/current/oldAHEAD。明确范围：本机Bun1.4/SQLite3.53.2/WAL三方共享锁格，不推全VFS、alias、compiled旧宿主、语义业务或unlock真失败；原01/02和本轮完整证据保留。

lock-old-reader-race-01原449358 session88031→14deb0真实exit0，parent75868→82452/8f1bf92a-2f81-4e06-b3ac-f96ec77b0689，started1791959590726/deadline1791960190726/end1791959601907（11.18s）。一case/7workers全exited0/三joins/精确root已删，primary/cleanup空。Root36be6d亲读完整每stderr、case、全部原7receipt/common marker/join marker和实际phase。oldproduction83956/d06d4991-6527-4a12-a7f7-fdea82db0ece真实v1/identity e00db626-f164-4e54-b342-992c4d728f3a；common1791959593634先保存该原owner ready与两NORMAL/WAL候选。race-a/b各原SQLITE_BUSY errno5、5743/5700ms，分别真实join后才1791959599492 oldnormalclose，close前完整v1和原identity一致。后续原after-race1→2/v1backup/fullvalidation/NORMAL，freshcurrent2→2，oldv1Client AHEAD。该独立三方格已实际 qualified，不外推尚未测的别名、rollback-journal、compiled旧Bun、semantic或unlock故障。

Root6b9f23全文读D1 review03 driver/server精确patch和manifest，对照已全文读review02/五sources：一个bootstrap真实owner/nonce/HOME/TEST_PROCESS_ROOT，retainedRoot为original processRoot且runtime已由bootstrap创建；server实际stat且准确env校验，不overrideHOME。finally真实声明整个original环境retained、removed始终false，不造已删除事实。Provider/control/facts原字节未变。Root现在准fresh before02，精确同Bun1.4 packagecwd/empty-bunfig driver仅scope改绝对`ui/d1/before02`，已完成ui-before不重build；new original600/60，外层真实exec保到stop/三join。原before01错误/源/回执保持，后续archive承接。

## D1真实旧producer桌面现象与闭合数据

before02原832fd7 session83255→408225真实exit0：parent84828→81096/648bbfff-740c-4c02-b680-37ce2f8be76b，started1791959729425/deadline1791960329425/closeBy1791960269425/end1791960256418，526.99s。driver原run/physical/settled同一exited0、request/output/handle全joined、primary/cleanup空；server原runtime occurrence 00b3d4c3-fdb1-4379-9a1e-28c88af2fd03和Native launch occurrence不同，保准确PID/期限归属。Root自有IAB（In-App Browser，应用内浏览器）tab39已原close并落page-closure；原stop b8ccce请求1791960256030、server正常stop/recovery/provider结束1791960256281，在原closeBy前，外层已join。原ownerRoot `C:\Users\hengu\AppData\Local\Temp\opencorvus-test-run-G7kWgc`/processRoot runner-84828-llmdTD完整环境明确retained，removed false，未来升级验收结束后才精确清理，不能当已删。

Root公开首输入原ba5d04 session82351→ca2e0f实际202、request41b41a60-9a3e-4bf8-8ac5-958743dd21b1/session ses_hOMDwg64SQWQQJNK8LZc/project prj_h4sjubVUqo4Js0YMwivs；真实外部CSV相对actual匿名Project/Session root在库外，原数据Cedar408,3/Iris408,4。Root在actualDialog手选Always Allow Exact Scope，产生真实local-operator grant per_g0VY0H0CT00yEdimTfa9/project slot per_hnCFinGqbtgBMlG56Q39。原first公开checker06426f记录真实read3lines/原execution start→该grant/成功/自然final provider reply2/idle、pending两数组实际空。

第二请求由Root在同一真实composer输入发送，没有helper POST第二Message或伪终态。原second checker a6947f、cold snapshot585d94记录真实不同request per_hBcYVNAcekU0u32dRkkO、原U per_g0VY0HBaq00drt55gpVv/source精确首grant、scope project、**decision_slot null**，真实S per_g0VY0HBat00yXPH5prjk/source精确U、attempt per_hq7IJr7BOa97OLqGp403、成功per_g0VY0HBbS00gDBEbE2D0、read3lines和自然final provider reply4/idle。API（Application Programming Interface，应用程序接口）pending与coldPending却同列此request。Root实际reload自有页面并cold选同Session，actual completed Tool/3行正文与final仍在，真实Dialog和inline再次要求批准；只Escape收起，不对ghost请求再allow/deny，旧数据图保原样。

8原desktop JPEG由CUA（Computer Use Automation，计算机交互工具）直接保存、Root人工逐图看，位于before02/screenshots：01原pending；02live完成局部；03完整3行输出/final；04cold完成却pending/Dialog；05Settings局部；06英文完整复用时间线；07中文完整时间线/范围/本地化日期；08恢复英文Appearance。1280×720桌面，没有UI自动化断言/截图基线/pixel compare。02/05局部不是完整输出/时间线证据，03/06是后续实际滚动确认；04有实际sidebar hover tooltip，保原图而不修饰。Settings Refresh并展开两实际operation，首请求14:36:33/人工保存14:37:51/执行成功/Request closed，第二14:38:35原Saved approval used/Running/Succeeded，与账本因果一致；其label/body/scope/status/date中英均亲看。Main技术read/原文/路径不翻译。经Appearance切换后General重新创建，**不称同一个Permission panel mount响应性已验**；这只是同一page真实En→Zh→En，Task renderer/Side/自动到达/外部ACP仍未视觉资格。

server terminal真实6个local Provider POST均stream=true/status200：4prompt ordinal1–4和2memory，精确fixture model session-prompt-owner-model、两actual read callIDs；原responseConstructed不是客户端EOF证明。只局部controlled streaming/真实read与公开Message因果，不是真GPT/Sol或模型理解资格，无凭据/付费请求。Root99dbfb读完整terminal后长stderr输出发生截断，不称已全文看stderr；已发现真实catalog.read error（空public catalog缺required opencorvus而actualcustommodel投影/请求成功），给UI agent只读检查完整原log/定义/实际metadata，收敛下一唯一完整fixturecatalog形状与安全archive边界，不以keyword过滤忽略错误或访问真实凭据。

本机WAL已有上述default2/11、复验2/11、followup3/14、guarded1/7真实格，当前机制准备足够继续设计当前唯一reader/writer和业务历史revision；不把它们加总当49种独立业务tests或全宿主验收。现backend agent只读具体canonical ledger/semantic旧图/private error方案；Root候选event grant_decision_indexed、revision2、单permission/ledger-facts.ts尚需精确sourceallowlist/error/函数合同最后冻结，**生产/正式tests/schema registry仍未改**。D1闭合真实旧producer input将用于已审安全历史升级，不能以夹具冒充此自然批准。

## 验收输入的共享目录与Memory合同修正方案

Root83843b实际解析原before02全部939行/265573bytes，939结构日志、0非结构行；182380完整分组20类error及原两warn/6LLM metadata，657e2f核全部data形状。真实96条Provider error：7次catalog.read缺opencorvus与19个CUSTOM_LOADERS缺目录各5次；两warn（原344/531）Project Memory组织输出markdown太短。原6 HTTP200与Memory未完成同时为真；不说整体工具链clean或Memory业务通过，原长输出截断和随后完整结构审计均保留。原日志data只有route/session身份/LLM模型与tools统计等公开metadata，无完整Provider request messages/body；Memory候选错误只保原schema诊断。原rawstderr可安全承接，DB/auth/models/privatebundle和完整Provider request仍排除。

已读当前ModelsDev全namespace/Data/provision/parse/withLocalProviders、Provider.buildState目录失败/自定义load/config合并、bundled public models-bootstrap.json全部provider身份；explicit OPENCORVUS_MODELS_PATH不会补默认目录，empty{}真正无效。当前Provider记录load issue后仍独立读取config.provider得到真实shutdown fixture，是已有生产control flow，不能把success反写为目录存在。最小工具修正：server在动态import Global/Provider前先声明唯一public catalog路径，从仓库已发布公开bootstrap正文通过现ModelsDev.withLocalProviders与validateExplicitCatalog一次建立完整原catalog、exclusive写入，保存真实provider/model计数/parse收据。没有凭据/models用户副本、network refresh、catalog fallback或另一配置文件；只仍选原fixture实际请求模型，保已授权真实Sol的完整auth+models规则独立。

已读当前Project Memory Organizer Candidate/真实prompt/collectLLMText与commitOrganization完整revision/ordered prefix/nonempty/sanitize合同，及两完整旧Provider夹具和controlled-streaming-provider.test.ts。成熟共享fixture和D1各复制的回复都硬编码baseRevision0/markdown空；旧test还把这个非法输出当成功。因此只把markdown换非空仍可能令第二轮revision stale，不是根治。全仓caller搜索指向非UI的Global Chat/Goal/Mission/Permission/Question/server后台真实路径，当前两个tracked fixture/test diff空，先保存原像再修改；没有UI自动化测试检索或运行。

选在**现共享fixture**增加一个controlled Memory回复函数并让两既有调用复用，删除两处旧硬编码/缺字段默默0或[]猜值。它只解析真实已分类Memory user prompt的明确baseRevision/coveredOccurrenceIDs指令行，严格要求各一次/正确integer/非空原ordered IDs，并保原CURRENT MEMORY正文，产生非空、明确标为controlled fixture的实际coverage Markdown；不猜revision、不造批准/用户输入、不把它当真实模型理解。普通Prompt/既有精确Memory classifier/流式SSE与release控制不改。生产Memory prompt/schema不为夹具放宽或加host路由。

精确修改范围为test/fixture/controlled-streaming-provider.ts、其现正向stream test及scratch D1 provider/server；不改产品Memory/Provider实现。旧test改完整当前Memory prompt，核真实stream解码输出baseRevision3/原ordered IDs/保留原memory与明确非空正文，覆盖旧hardcoded0的实际错误。聚焦正向选定stream test后，原公开retirement/projection相关函数验收和fresh当前before03真实desktop两read+实际Memory revision/coverage收束需要重跑；只单streamtest不能冒全E2E。before01/02源/错误/截图不改，before02完整data root依然retained，后续当前UI使用新freshscope及original600/60，不延原服务。

UI agent只读报告因同模型容量连续两次中断，Root收到其已核目录/两warn反馈并已独立亲查上述原代码/统计，未切其它模型或把未产出报告作证。backend生产ledger只读方案仍独立推进；Root继续本地可修工具输入，不把容量问题作为goal blocked或提前结束理由。

全仓补搜eea554/9cbd0e发现同一Memory回复的另外三个当前clone：global-chat-start-process.test.ts（非空但仍base0）、cli-run-check.ts和artifact-batch-check.ts（base0/空正文，且后两还把普通system含Memory说明当helper）。这是验收共享输入合同，不降为D1局部。Root新增精确allowlist只替换这三当前回复/后两classifier为同既有exact-system classifier，保各流式/release/真实进程/业务断言；不要修改归档/旧scratch原件。后两explicit目录还只是copy bootstrap（原公开bootstrap含opencorvus、没有kilo），与当前parse要求不一致，也须同一输入修正，不能声称脚本clean而继续保已知invalidcatalog。

选在现fixture中复用成熟ModelsDev.withLocalProviders/validateExplicitCatalog的一次owned catalog writer（调用时动态import，原test过程根严格descendant、exclusive文件，不导入用户auth或refresh）。D1下一scope改唯一实际目录为其original runtime/data/models.json，CLI/artifact各原fresh过程根models.json；全部调用在正确bootstrap/环境声明后，不能为writer早import Global到用户root。后两脚本用动态fixture import在bootstrap后，D1在已实际环境/路径声明后；不存在另一个providers/model配置面。Catalog原bootstrap公开数据和实际provider/model counts作正向输入证据，不以源码hash、absence或warning过滤验收。已有Root frozen canonical ledger计划待全文复核，此工具变更不准同时修改产品Memory/Provider/权限/storage。

## 本批收尾授权与正式生产计划冻结

用户最新要求「做完了已知的问题可以收尾了」。持续goal改为完成本批已知缺陷及必要共享根因收敛后停止，不再另开下一批；没有要求立即中断当前修复，也不把已有失败当完成。

Root已全文读取backend 197行production-ledger-plan（bd7c6f、d97a37完整补读、c46c8c），批准其中单源typed fact graph、private error、历史source/owner/attempt规则及13路径范围，除schema-migration.ts物理生命周期由Root单独实施。最终选择：新U真实系统actor=saved-grant-policy；per-request reader使用传入TxOrDb的同步read-only transaction/savepoint，startup/迁移沿原事务一次完整装载；搬移唯一request/attempt identity及project grant pure predicate，删除原重复定义；canonical autoReply只从真实grant_used派生，API显式通知位不是新的持久权限来源。

历史事件grant_decision_indexed与semantic revision2正式选定，保持0001不可变、DDL当前列不变、I只定位原U且有自身真实迁移时间，所有resolved/执行source继续原U。完整图验证先于任何I写入，current未知/坏图严格错误；不回填原U或批准时间、不按最新/rowid仲裁、不新增fallback、消息或权限队列。历史slotless stale的无discriminator source只保原opaque审计关联，不用于授权。所有source/attempt/result/owner allowlist与已读完整方案一致。Root批准backend既有agent实施/聚焦真实正向测试，禁止再次委托、UI测试、真实凭据/模型服务、提交或推送；Root独立复核差异与原验证回执后负责交付。

Root继续先修已明确5个controlled Provider共享输入与D1原脚本，并负责schema-migration.ts真实WAL独占防旧客户端、真实旧producer升级及桌面复核；生产Memory/Provider不为fixture放宽。UI已知Task历史语言与Settings新私有事件显示由Root在原已读四路径方案及现Settings源码基础上实施，依真实页面人工验收，不造Task自动卡。新发现仅在此已知问题必要影响范围内处理，不再无限新批。

以下完整backend计划为本批正式落盘实施依据；其原「待Root」字样只保原评审输入，最终选择以上述冻结为准。
# 408 Permission ledger 生产收敛计划（待 Root 最终冻结）

## Recall、真实资格与未授权项

Root 本轮仅授权只读收敛方案/调用证据，未授权生产、正式测试、迁移执行或新服务。已重读408 Recall、historical-authority-index-contract、production-scope-and-desktop-plan、其39份原输入/调用/历史捕获，并对照当前 Authority、Db/migrator、Engine、protocol和直接调用者。旧报告中 INDEX 占位、未started U+其他slot的候选取舍，以Root本轮明确选择为准。此前原工具/源码和失败不修改。

当前只读输入见 [evidence manifest](production-ledger-evidence/manifest.json)：10项definition/caller/history命令、12份当前原source、原39文件清单及17个原完整source与当前逐字节相等的比较记录。身份比较只供准确定位分析输入，不是功能验收。一次猜测的interaction-writer.ts和channel runtime.ts/control路径搜索报不存在，随后按真实engine/store/interaction及channel-runtime/core.ts核对，不据这些检索失败判断缺功能。

Root已实际资格：followup02原ecb5f9/27855→34bc52退出0，23.56s/3cases/14workers；合法current+upgraded，以及原backup EEXIST/validator reject→rollbackv1/readerBUSY/NORMAL访问/旧productionv1重开。guarded01原449358/88031→14deb0退出0，11.18s/7workers，第三真实旧production live时两个候选BUSY5743/5700ms，旧owner正常join后1→2/backup/current2→2/oldAHEAD。D1原真实两read证明第二U slot=null、Tool finished仍cold pending，Root有原截图及闭合。它们分别是物理锁/旧格式现象资格，不是下面尚未实施的grant语义迁移/reader资格。

当前确定根因仍是同一链：`authorize:863–865`捕获G而append U不占slot；`decisionFor:576`、pending/retirement/recovery、Engine/store759只认slot；晚Asked不重读decision。43636df96引入U与scopeVersion2；e0801739确立重复requested保first owner；402/406修投影和physical owner、407修canonical Message原子退休，均未修U的决定身份。本批不能再加`slot || latest U`、回写旧U、双reader/新状态、假human/终态/时间。

## 1. 最终推荐的数据形状

只新增私有事件 `grant_decision_indexed`（下记I）和semantic revision2，数据库列/DDL形状与当前相同。I是原decision的单跳定位事实，不是approval、grant、execution或用户回复：

- `id=Identifier.ascending('permission')`、`time_created=Date.now()`是迁移实际产生的新事实；`request_id=RU`、`decision_slot=RU`、`source_event_id=U.id`。
- `actor_id='schema-migration'`、`metadata={migrationVersion:2}`；`decision_scope/attempt_id/outcome_slot/reason`及全部requested-owner列为null。不能复制G/U的scope/actor/原批准时间，不能把迁移时钟用作resolved时间。
- U仍引用原G；I只能直接引用同request的slotless U，不能I→I、I→G、I→S、I→缺失行。执行S仍引用原U，不能改为I。
- I产生于版本化迁移事务，不发Bus、不造Message/userInput、不释放不存在的旧waiter。新runtime直接U占slot；旧数据只有经I定位后才是current合法格式。

公开history的event_type本来为string，Resolution.eventID可返回原U，Interaction.response是现有record，因此这些内容本身不需SDK公共字段变化。正式schema生成是否零增量应按当前正式checker确认，不能手改SDK。

## 2. 一个低层实现、一个typed事实视图

推荐唯一新生产模块 `permission/ledger-facts.ts`。依赖仅：`import type { Database } from '@/storage/db'`、当前permission.sql表、轻量types/decision/Identifier、drizzle-orm、已存在的纯result envelope decoder及纯值比较。禁止runtime Db/Authority/Instance/Engine/Bus/Config/SessionLoop导入。

对外最小函数（名称可在Root批准后固定，不先写代码）：

| 函数 | 输入/输出与唯一职责 |
| --- | --- |
| `permissionRequestIdentity(input)`、`permissionAttemptIdentity(requestID)` | **搬走**现Authority原公式，非复制；Authority及tool-outcome-facts用同函数。身份材料和生成值不变。 |
| `readPermissionRequestFacts(db: Database.TxOrDb, requestID)` | 返回undefined仅当原请求图完全不存在；存在delta无R为明确错误。返回canonical requested row、原完整Request、slotLocator、original authority row、decision及autoReply，附本request的start/outcome/result/retirement事实供当前调用者使用。 |
| `validateCurrentPermissionLedger(db)` | 在原startup/migrator已有事务中一次装载完整ledger/results，调用同一纯图解析/校验内核，返回void或private typed error。没有业务修复副作用。 |
| `planHistoricalGrantDecisionIndexes(db)` | 只供revision2 callback；一次装载旧图、运行同内核的显式historical输入规则，完整验完后返回只含RU/U.id的计划。不是runtime可调用的slotless fallback。 |

内部仅一份pure `qualifyRequestGraph(material, format)`，格式选项只区分旧迁移输入与已发布current。current入口固定current，不根据查不到slot自动切历史模式。wholegraph和request loader只是不同读取范围，不是不同合法性规则。临时Map/数组属于一次同步计算，不跨请求缓存、不持久化第二套权威。

返回视图的存在关系是判别联合：pending必须`slotLocator/authority/decision`全无；decided必须三者齐全。直接slot的locator===authority；indexed的locator是I、authority是原U。`decision`严格由合法kind/scope映射；不能默认unknown→allow_once。`autoReply`在本批含义明确为**原grant_used捕获事实**，direct U/indexed U均true，其余false。现Full-access allowed_once/nullscope/actor full-access-policy合法，但它原本不发自动Replied，不能将其误作另一次saved-grant reuse。

### 原纯逻辑的必要搬移

现`requestFromRow`会runtime Database.use找owner，又通过重`invocation.ts`做eligibility；不能直接导入startup。将其原完整Request映射和choices构造移入leaf，使用已传入的canonical first requested与**现有PermissionRequest.parse**，不复制第二Request schema。Authority原helper变为调用单一reader/取其Request，删除原raw owner `.get()`和默认decisionFromRow路径。

`permissionProjectGrantEligible`当前在invocation303–319，是不依赖Instance的纯predicate；将该定义原样搬入leaf，invocation与Authority改import。它的filesystem/network canonicalization等重流程不搬。必要的effectClass类型使用type-only引用或现轻量Request类型，不在leaf导入invocation的runtime。原attempt公式在session/tool-outcome-facts56也存在，改引用同一函数，不能在新leaf形成第三份公式。

### 读取一致性与扫描成本

`TxOrDb`包含裸Client；多条SELECT如果没有snapshot，另一physical writer可在中间提交U/slot，造成混合视图。推荐per-request入口用传入db的现成**同步Drizzle transaction**取得读snapshot：Client为只读事务，已有Tx为nested savepoint；内部只select+pure resolve，不调用Database.effect/Bus/任何写入或新Client。startup/migration wholegraph已经处于原migrator事务，只直接装载后调用pure内核，不再套BEGIN。此选择必须以真实Client/Tx的类型和nested正向合同验证，不能把“函数名InTransaction”当已经有snapshot。

request loader依`permission_ledger_request_idx`读全部本R行、依decision_slot唯一键读其locator、依source PK获取I→U→G及G的全部requested/相关grant图、依确定attempt/outcome/result键读关联事实。单跳I+单跳G是固定边界，不递归追索任意source；行数与本请求及源grant历史相关，不每次全表扫描。完整跨request inbound孤儿/重复slot/attempt归wholegraph检测，不谎称一次局部读取扫描了所有别人的错误。

wholegraph一次读取全部rows（真实rowid顺序）和results，建立byID/byRequest/bySlot/byAttempt/Result Map；循环每组走同内核，预先检测全局重复ID/slot/start/outcome、orphan result。计算O(N+结果数+显式引用数)，不用N个全表查询。first requested按原rowid选取，不能按ID/time/latest代替；这个排序只选已定义的owner首观察，**不**用来仲裁授权。

## 3. 精确private错误合同

建议 `PermissionLedgerIntegrityError extends Error`，固定private code `PERMISSION_LEDGER_INTEGRITY`，reason为下列闭合union。只携带requestID/eventIDs/attemptID/field等真实非秘密定位；不把完整scope/参数写入错误。不是NamedError/public schema，不更改现HTTP响应格式。

| reason | 精确触发 |
| --- | --- |
| `event_kind_invalid` | 不在当前私有event allowlist的ledger类型。 |
| `event_shape_invalid` | ID/time/required/null owner形状或该事件角色字段不合法。 |
| `request_owner_missing` | 任一delta/result所属request缺canonical R。 |
| `request_owner_conflict` | 同R多个requested的权威材料矛盾。 |
| `request_identity_invalid` | 当前compact/canonical request ID或原deterministic公式不符。 |
| `scope_version_unsupported` | 无法按支持的baseline scope格式证明其原语义；不能悄悄用v2重解旧版本。 |
| `scope_material_invalid` | stored结构/owner字段/原choices不符合该版本原合同。 |
| `decision_slot_conflict` | 同slot多行，或一个R出现多个/外属slot locator。 |
| `decision_kind_invalid` | slot行类型不是六个direct kinds或I。 |
| `decision_scope_invalid` | direct kind对应scope/Task/eligibility/Full-access例外不符。 |
| `index_shape_invalid` | I的actor/metadata/列null形状/slot/R不符。 |
| `index_source_invalid` | I引用缺失、自身、另一I、错误kind或其他R。 |
| `grant_source_invalid` | U/V引用的G缺失/非grant_created/不拥有其原request槽。 |
| `grant_scope_mismatch` | U/G的Project/fingerprint/provider/结构scope/version或task范围不一致。 |
| `grant_capture_conflict` | 已有任何真实slot与另一distinct slotless U冲突，或slot实际authority与S.source不符。 |
| `grant_capture_ambiguous` | 多U没有唯一合法deterministic S精确锚定。 |
| `grant_capture_unindexed` | current格式存在slotless U而无合法I定位。 |
| `execution_attempt_invalid` | attempt公式/所属R/该事件所需attempt和outcome-slot不符。 |
| `execution_start_conflict` | 同R多个不一致start/不同attempt，不能因每attempt unique就通过。 |
| `execution_authority_mismatch` | S.source不是该R的canonical正向原authority，或指I/negative/外R。 |
| `execution_outcome_invalid` | outcome/unknown/reconciled源链/所属attempt或role不符。 |
| `execution_result_invalid` | success/result缺一、结果envelope非法、result无start/对应success或所属attempt不符。 |

同一明确错误应带原原因，不按SQLite英文文案匹配。普通runtime调用让private error按现serverErrorResponse变sanitized500+requestID，保服务器原cause。startup同validator捕获后用现DatabaseUnavailableError `DATA_INTEGRITY_ERROR`、operation `Database.Client.dataIntegrity.permissionLedger`包裹，HTTP仍503。旧v1语义callback错误由原migrator包`SCHEMA_MIGRATION_FAILED`并保backup/cause；不先在callback改成DATA_INTEGRITY_ERROR，以免混淆“当前坏图”与“升级失败”。

## 4. 完整图规则：owner、scope、source、attempt

### R和retained owner

每个R至少一个requested；所有requested必须相同project_id、session_id、task_id（包括null）、message_id、tool_call_id、mode、policy_revision、provider_kind/id/digest、tool_name、effect_class、scope_version、结构scope、fingerprint。ID/time/summary/metadata是各自观察，不能一律要求整行相等；原first requested的time/summary/metadata/choices作为展示来源。每条requested的ID/time合法，owner的request deterministic公式准确。delta的全部owner列仍null；不能为I复制完整owner。

Project/Session/Task/Message可能已经正常删除，ledger/results按现DDL保留。图验证以R为原owner，不要求当下mutable行存在、不join当前目录或当前选中Project来补identity。读取caller的Project/Session边界仍按已有route/lineage合同验证真实owner，不能因为header换了目录就把全局known-ID读取政策偷偷变更。按Project选出候选后仍加载完整R组验证，防矛盾duplicate被过滤隐藏。

scopeVersion2可按stored scope的provider_kind/id/digest、tool_name、effect_class对齐owner，再比较source/use两完整结构scope及fingerprint。不得重新realpath、访问当前文件、重算provider安装状态或用当前policy解释历史。Root已核grant引入与scopeVersion2为同43636df96；真正未知scopeVersion应明确unsupported，不伪装已迁移。fingerprint仍是原协议身份，不将它当本次功能验收hash。

scope eligibility复用搬移后的唯一pure predicate；metadata.choices实际存在时必须是合法Decision集合且授予的scope在原记录中被允许。optional旧metadata缺失不等于owner改变，沿原choices生成规则由storedTask/eligibility恢复**同一公开Request**，不是无条件允许all scopes。既有Full-access的choices生成也可能包含合法task/project项，不能凭模式名字新增“grant_created必须Ask”这一未经原producer保证的限制。

### Direct决定的allowlist

| authority.event_type | decision_scope/来源与结果 |
| --- | --- |
| `allowed_once` | invocation→allow_once；null仅接受owner full_access且actor full-access-policy的真实原policy branch。不能null默认任意approval。 |
| `grant_created` | task或project；task必须原R有Task，project必须stored版本/pure predicate及存在的choices支持。source_event_id为null，原G拥有自身request slot。 |
| `grant_used` | task或project，必须精确引用G，scope相同；Project和fingerprint、provider/tool/effect、scopeVersion/结构scope一致；task还要求两R同一个非空Task；project允许同Project跨Session/Task。直接current U拥有自己的request slot。 |
| `denied` | invocation，原actor/reason保留，decision=deny。 |
| `cancelled` / slot-owning `stale` | invocation，原系统/真实决定actor和reason，decision=deny；维持原Terminated身份。 |

上述direct的slot必须等于自身request_id，无attempt/outcome槽；negative/allowed/G不是另一event的定位器。slotless stale不是direct决定，不能抢原已批准slot或覆盖其scope/time。

### I、历史capture与唯一选择

先完整验证每条U自身G/owner/scope，以及所有slot/start/outcome/result材料，再决定是否加I。无slot、无U是合法pending；无slot+唯一合法U即便没有S也可索引，但只证明“捕获”，不能宣称effect已执行。多个合法U只有一个合法deterministic S且它.source精准属于其中一个U时才可选该U；不能按time/rowid/相同scope消歧。

**已有任何slot+另一distinct slotless U均是冲突，包括U未started。** 已有direct U自身不是distinct额外U；若还有旧slotless观察，仍冲突。一个已合法I→U的current图可以保留多条旧U观察，但必须同一唯一S锚定被索引U；I定位规则与历史选定规则一致，不能仅因已存在I就绕过歧义。已有合法I的再次验证/重开不追加第二I。

source G即使现在revoked/expired，已存在的真实U仍保其capture；V只影响未来capture。旧writer的eligible-read与U append并非同事务，原rows没有read发生时刻；不能用event时间或rowid证明历史撤销前后串行化，也不回填时间。此次迁移保可证真实capture，不签发历史linearizability保证。

### source allowlist和不能当FK的原审计链接

G的source为null；U只能source G；I只能source同R slotless U；revoked/expired只能source原G且沿G的R owner。S只能source该R正向canonical原authority（allowed_once/G/U），永不source I。outcome_unknown由原reconcile产生时source同attempt的S；execution_reconciled source原同attempt outcome_unknown且metadata.outcome为现有成功/失败枚举；不得把reconciliation变成第二outcome_slot或当新的Permission决定。

必须保留一个现存合法边界：slotless stale.source_event_id既可为full-access完整成功的execution_succeeded.id，也可由changed-identity分支记录尚未注册的新requestID（authority963/999），还可为空。这个字段没有持久discriminator。**不要按“先找ledger，找不到改找request”另造fallback reader，也不要一律当ledger FK。** 对slotless stale只验证其自身R/role/null decision槽和非空source的canonical Permission身份；source作为原opaque审计关联保留，不参与授权/index/执行authority解析。不由reason英文猜子类型。不能声称此不带discriminator的审计链接已被完整语义化。

### Attempt和Result

每R只接受原deterministic `attempt\0R`。唯一S属于该R，source是解析出的同一个正向原authority。无S但U已索引是合法未执行capture；当前live/dead lease判断依原406机制，validator不从missing OS记录造dead，不改effect lease。

execution_succeeded/execution_failed/outcome_unknown拥有outcome_slot=attempt，必须有同R/S且全局只有一个terminal winner。成功必须有同attempt PermissionExecutionResult，result存在也必须配原success；用原resultFromDurable验证envelope。未完成/明确failed/unknown不能借其他Tool结果变成功。已保留的result表无Session/Project cascade，当前src没有删除result路径；owner删除不放宽pair关系。Tool outcome reader仍负责accepted Tool的Project/Session/Message/call/tool与part/Source物化，不把ledger graph validator扩成第二Tool物化器。

MCP Task created/status有同deterministic attempt和实际S、无decision/outcome槽，保原metadata与当前MCP schema/lease/handback消费者；本层只核授权/attempt关联，不复制McpTask schema或宣布远端payload全验。execution_reconciled仍是unknown后的人工审计链，不能据它另行合成durable result；本批不重设计其现有恢复业务。原同source多次观察/矛盾reconciliation若超出当前graph角色约束，应保具体原件并报Root，不静默选latest或扩大本批控制流。

## 5. 当前写入：同一immediate事务、精确CAS、原outbox

`authorize`在descriptor/policy/原R注册后，用一段原Database.immediateTransaction同步读canonical current事实：已有正向winner复用原authority；negative抛原RejectedError；退休仍原StaleContinuation。没有winner才在**同db/同事务**查eligible G及其revoked/expired，再占R slot写新U并保G.source/scope/实际capture time。所有分支都统一返回事实视图的原authority，不把I用于S.source。

activeGrant改接传入db，源G也经同canonical graph确认，不跨两次Database.use读eligible再append。新capture、revoke、expire各自用原outer immediate从原G验证到delta提交；Project deletion已有同fenced事务的expired writer保留，capture读取其真实V。capture先commit则U有效且后V只挡未来；V先commit则本次无eligible G，进入真正pending。不得比较wall-clock给胜负。negative/manual decision同slot CAS，negative先赢则不执行，U先赢则后来operator attempt返回原allow赢家而不发布假的人类批准。

推荐删除`settleDecision`和`settleDecisionInTransaction`两段任意catch，保留一个同步事务内setter。使用现SQLite/Drizzle定向 `ON CONFLICT(decision_slot) DO NOTHING RETURNING`：有返回行才won=true；只有真实0行才读同canonical winner并won=false；0行却无合法winner是完整性错误。其他SQL异常（trigger、I/O、PK、schema、busy、outbox等）原样传播，不见到winner就吞，不按英文文案/泛unique code猜冲突列。普通wrapper由调用者在原immediate里调用此setter，不能保两份平行SQL。

用户reply、非user reply、自动U及cancel/stale都沿该setter；只有真正won的那一事务写原owned outbox。用户winner的真实userInput仍只在其Replied中；自动U的Replied固定autoReply:true、无userInput，建议实际系统actor标识`saved-grant-policy`写入新U并用于其通知（这是新增私有producer identity，待Root最终确认，不复制原grant的人类actor）。历史U原actor/null不回写，迁移不补通知。Full-access policy原是否发通知的合同不扩大。

原`Reply.autoReply`还能经Task API输入，但未作为ledger权威持久化；不能从它重构历史自动决定或新增镜像bool。本批canonical autoReply只证明U，其他现有显式API通知位仍是那次真实通知输入，不作为持久grant权限来源。若Root要求所有第三方输入autoReply都可持久重建，这是额外公共合同，不能暗借I实现。

commit后，winner拥有的Publication按原retry/drain观察；释放真实local waiter用canonical negative/positive结果。`authorize`自身正在执行的capture不另发resumeRequest；真正public reply无waiter仍沿原resume/407 strictretirement。loser不新增outbox/userInput，返回真实赢家Resolution；原winner outbox未delivery由既有Bus机制恢复，不由loser造第二条通知。发布/恢复失败保持原错误，已经commit的decision不回滚伪装不存在。

嵌套时仍用原Database savepoint/effects截断。原outer deferred并不会因嵌套immediate而升级为IMMEDIATE；同步read/write仍在同事务，冲突必须传播busy/typed error，不能宣称提前写锁或重试重排。所有新增outbox与U/decision在同writer，外层rollback应同时撤销它们及postcommit effect；不手清waiter/修改Bus队列。Bun真实SQL target-CAS与nested/trigger错误必须由正式检查器证明后才能交付。

## 6. revision2与startup：单一validator的两个真实入口

建议新增immutable `storage/migrations/0002-grant-decision-index.sql`（当前DDL原快照）和同名`.ts` semantic callback，registry追加version2；0001和现table schema/DDL形状不改。callback用原同handle创建的Drizzle视图（引入现ApplicationSchema以得到真正TxOrDb，不用as伪装），调用historical plan函数，**全图验完**后逐条插I。临时移除unique/index/trigger期间不依赖`.get()`或冲突仲裁，先检测全部slot/owner/attempt/引用再写。I实际id/time在写时产生，不backdate。后续目标对象重建和原migrator current validate必须确认完整图。

当前startup `assertCurrentDataIntegrity(sqlite, integrityDB, dbPath)`增加同一current validator入口，保持现legacy compact/Tool控制结果检查。current格式无locator的slotless U明确error；合法I保多旧观察但唯一真实source不变。迁移callback/validator无Bus/Instance/Project重建，不启动物理recovery。已经capture但未started的I在后续真正startup continuation里可能成为可恢复授权，这属于原生命周期验收：必须结合原Tool/Message/Task activation/原owner死亡或live保护，不把索引当恢复成功。

物理migrator由Root另管：复用已真实资格的NORMAL WAL attach→file EXCLUSIVE/actualBEGIN→同handlebackup/图验/commit→NORMAL+finalized真实访问后才暴露Client/安排checkpoint；fresh库与unsupported rollback模式/实际unlock失败的精确公共错误由Root冻结。锁experiment绿不等于代码已安装。db/migration与leaf值导入图必须跑正式module-topology（包括actual clean imports），不能仅AST无SCC推runtime通过，更不能放宽retained-budget。

## 7. 消费者统一与真实到达顺序

- Authority：原raw decisionFor/requestFromRow/pendingRequest/list/continuationReady/retireMessageContinuations/replay/reconcile相关使用canonical facts；history仍保完整原rows，不能把I替换成U丢失迁移事实。按request解析后使用原requested Project，沿现trueSessionProject退休，不引入ambient fallback。
- Session protocol：standalonePendingPermission先读同canonical facts，严格核 Asked完整Request与原owner，已有decision则不给pending投影；保现Task去重/非Task child准入。原Replied/Terminated仍是真实终态通知，cold/reconnect数组继续同源。原response的orderKey若需准确terminal time，取canonical原authority.time/id，不取I或delivery Date.now；不加公共time字段。
- Engine/store：把759原slot `.get()`及默认allow_once映射删除，使用传入db的canonical视图；原requested引用可为保留的合法同owner观察，但展示time/payload统一first R。time_resolved/time_updated/responseOrderKey来自原D/U，response.auto_reply由真实U派生。保Engine outcome与Permission决定双终态冲突校验。
- Engine/interaction：Replied不再只assertResolvedReplay后返回；读canonical真实winner/owner/Task/Session并使用现ephemeral `interaction.resolved`失效通知。用户发生记录保持原winning userInput。Replied先于Asked时没有Interaction就不造它；随后真实Asked正常materialize后同canonical投影为answered/rejected并按原真实决定通知。Asked先发生时Replied直接收敛。未发Asked的普通自动reuse没有Task卡是合法事实，不能补假卡拍照。
- Settings：显示I的中性索引标签及它自己的实际时间；operationStatus跳过bookkeeping I而取真实decision/execution事实，不能第二套I解析或猜unknown为允许。中/英同mounted视图、Task历史原canonical part复用与已批准的四UI路径由Root/UI agent独立实现实页。

外部ACP/CLI/channel共享现public list/reply返回值，但不是Main的同一个展示合同。bounded本地adapter修复应只在原queue head/实际操作前重新读canonical pending、返回真实winner，不把消失当已批准；ACP合作取消不等于peer Promise已结束，CLI历史notice不可假称已撤回，channel确认不能只复述用户尝试的always。相关精确路径为`acp/agent.ts`、`cli/cmd/run.ts`/`cli/cmd/permission.ts`、`channel-runtime/src/core.ts`；当前本计划不新增外部协议/消息能力。Root可冻结到独立本地adapter子范围，真实外部客户端视觉/撤框尚未验，不能宣称所有客户端都已通过。

## 8. 建议最终生产allowlist与明确不改项

后端必要语义集合（Root需再正式授权）：

1. 新`permission/ledger-facts.ts`；`permission/authority.ts`；`permission/permission.sql.ts`。
2. `permission/invocation.ts`仅搬原pure eligibility定义/改import；`session/tool-outcome-facts.ts`仅改共享attempt公式引用。若实际类型需要改现轻量types，只能先具体报Root，不能先复制McpTask/Request schema。
3. `storage/db.ts`接current validator；`storage/migrations/index.ts`及新`0002-grant-decision-index.ts/.sql`；`storage/schema-migration.ts`仅Root另授权的物理guard生命周期。
4. `engine/store.ts`、`engine/interaction.ts`、`protocol/session-mirror.ts`。

共13个后端路径，其中新leaf/新2个migration文件；不混入另一任务Git/process/channel配置生产。UI所需PermissionsPanel/en-US/zh-CN、已选Task-history四文件由Root/UI单独列精确allowlist；不由本backend先改。现permission/project-authority.ts/project/delete.ts不因I另写expiry路径，其同事务V与owner合同需正向资格。Question、SessionLoop/physical leases/ProcessFacade/Bus/ProtocolStore/DDL基线、公共schemas/SDK生成器不改。删除旧Authority两setter/rawslot/defaultmapper是真替换，不保兼容wrapper。

## 9. 正向正式与真实验收计划

本轮未运行任何下列检查。测试只能backend明确结果/状态/真实错误，不UI自动化、不以缺事件/不调用为核心。

| 资格 | 最小正式候选路径/明确输出 |
| --- | --- |
| 单源current reader与scope图 | 新`test/permission-ledger-facts.test.ts`：每个direct kind、Full-access null例外、current U、I→U、原time/identity；完整duplicate owner材料、删Project/Session后retained owner；每个private reason真实精确错误。 |
| 历史semantic迁移 | 扩`test/storage/schema-migration.test.ts`或独立`permission-ledger-migration.test.ts`（Root选1）：唯一U无S、S锚多U、任意slot+distinctU、完整计划验证后append、原全row/bytes/backup/time/rollback、v2 reopencurrent、currentbad DATA_INTEGRITY vs oldbadFAILEDcause。 |
| 当前capture/并发/错误 | `test/permission-two-mode.test.ts`：真实首grant+第二同scope U+slot+effect/result/407 stale；两caller同R同winner；U vs negative；U vs revoke/expire/Project deletion；sameTask多Session、不同Project；TEMP trigger真实SQL error与PK/slot冲突区别；outer/nested savepoint+真实outbox归属。 |
| pending/late Asked/Task | 现`permission-transport-hydration`、`server/session-permission-projection`、`engine-interaction-recovery`、`server/task-board-validator`：真实accepted Asked/replied交换delivery、cold/reconnect精确全集、Task原time/order/auto provenance及自然通知；不直接造frontend事件。 |
| normal/恢复闭环 | 现`session/permission-message-settlement`、`session/permission-message-retirement`、`permission-continuation-recovery`、真实`permission-execution-owner-process`：保存批准→真实Tool→completed+stale；capture未start、Tool result/Message间process cut、livepeer/unknown/dead原owner/MCP handback保原406合同。原407/source失败保留，不用旧通过数当新资格。 |
| 实际公开链 | controlled streaming Provider→公开SessionPrompt→真实外部public CSV read→真实permission user reply保存grant→第二read/结果/自然final→pending准确、history原G/U；真实HTTP sanitized500与DB503分开。不能用mock materializer或造completed消息。 |
| 物理升级 | Root复用现唯一owned process机制，最终实际v1 producer保留DB→v2 app open/semanticbackup/完整图；三方old cached/双新升级者、rollback/release/错误资格沿正式实际migrator。不能把scratch同DDL v2 probe直接当业务迁移。 |

正式runner仅Bun1.4按精确文件；触及过期负向核心测试须转为完整正向状态或删除，不能全量bun test。typecheck、正式schema/route/currentmodule-topology含clean imports均需按真实最终source重验，但不代真桌面。Root D1原closed真实数据可作为旧producer输入，不能从活用户DB迁移或写假grant；后态Main/Settings中英、Side与自然Task及必要exactSol独立bounded scopes。MCP App调用直接Authority而非普通wrapper，其Part依附原artifact Message；本batch需单独正向owner/result/retirement检查，否则保持未覆盖，不因普通Chat成功外推。

## 10. 尚待Root冻结/未知

本方案已给出推荐而非预写生产。待Root最终决定新U系统actor标识、per-request只读snapshot边界和上述两纯逻辑搬移；本轮不会自行扩大文件。历史旧eligible-read的撤销串行化不能补证；没有discriminator的slotless stale source只作审计关联；MCP remote payload/手工reconciliation更深业务不借本图校验重设计；actual semantic migration物理代码、postcommit unlock真实故障、外部ACP/channel视觉、全部Task/Mission/Provider组合仍未达成。

以原facts和source关系为依据：不由scope名称、model自述、终态标签或时钟排序推授权。所有当前图错误严格抛出，迁移失败原backup/rollback保留；所有provider执行/消息/批准来自原参与者。Root完成Recall/正式授权后才开始红→实现→绿及真实验收。



## UI正式实施冻结
Root2fb988全文读取UI现方案与7路径supplement，批准所有明确步骤与私有索引中性标签；既有Question/Permission phase-part原语、strictdecision、Task真实toolName标题及Settings operationStatus用原业务事件，保所有peer语言key。原文下面的待授权状态由本冻结取代。

# 408 Task Permission history and pending title: current-locale plan

Read-only preparation following Root's explicit choice: if 408 exposes automatic provenance on existing Task Permission history, include its current-language rendering in the same batch. Reuse 405's canonical request/response phase parts and CardParts/TextPart path. No production, SDK, test or shared-document changes; no UI-test search/run, service, page, model or fabricated Task interaction. Root-authorized D1 tool-only corrections are tracked separately in `d1/review01-diff.patch`; their original inputs remain in `d1/review01-before/`.

Root's subsequent choices are now recorded: **missing/unknown Permission decisions produce an explicit error**; pending Task Permission heading is included at one precise `InteractionCard.tsx` presentation point using actual `payload.toolName` plus the existing localized label. Main/Side raw technical Tool names stay unchanged. Backend title remains original technical data and is never prefix-stripped. This expands the candidate frontend allowlist from three to four files only; still no production implementation authorization.

## 1. Proven current cause and exact path

`packages/overlay/src/utils/interaction.ts:106–121` already gives resolved **Questions** stable IDs `ctx:interaction:<id>:request|response` and an `interaction-question` part containing the original interaction and phase. CardParts formats it when mounted. Permissions instead fall through to `textSeed:50–64,124–135`, which calls `interactionRequestText` and `interactionResponseText` during tree construction, stores translated `text`, and derives identity from that text's hash and time.

`utils/transcript.ts:141–146` formats Permission automatic provenance with `t('interaction.auto_reply')`, then the actual scope label. Once stored in a text part, a later locale change cannot recover its original decision/automatic flag. The existing TextPart worker correctly reacts to locale changes but receives the **same pretranslated source string**, so it cannot translate that source back into facts. This is an upstream presentation-data problem, not a Markdown worker or i18n cache failure.

The request side has a second current-language issue: `engine/store.ts:684` and the permission producer in `engine/interaction.ts:327` create `Permission: <toolName>`. `interactionRequestText` currently trusts that title as display text. Its exact same raw Tool identity is already present as `payload.toolName` (`store.ts:692`, producer:335). The fix should format the product label at render time and retain the raw Tool name; no English-prefix stripping or translation of stored body/scope.

Current typed public Interaction type is `permission | question` (`engine/model.ts:301`). Production source search found the Permission producer in `EngineInteraction.upsertPermission`; the other two insertEngineInteractionRequest callers are Questions (real Question publication and Task activity reconciliation). Current Task Permission projection supplies real decision, `time.resolved`, and responseOrderKey from original ledger time. 408's backend canonical decision reader will also derive `response.auto_reply` from the **original grant_used**, never INDEX time/name or user text.

## 2. Full touched callers and ownership

| Definition or consumer | Current role / effect of proposed change |
| --- | --- |
| `utils/interaction.ts` `interactionToCardSeeds` | Sole conversion of Board/standalone interactions into conversation seeds. Pending IDs and parts remain exactly unchanged; only resolved Permission presentation gains original phase parts |
| `tree-writer.ts:3041` regroupTimelineSegments | Reads seed order keys as interaction boundaries. Preserve both exact request and response keys; the new part type does not change chronological boundaries |
| `tree-writer.ts:3816` rebuildInteractionCards | Seeds feed upsertInteractionCard and attach to the latest owning Session turn at or before the original order key. Preserve Session/Task ownership; no new Message wrapper |
| `tree-writer.ts:3878` validateConversationBoardInteractions | Checks seed identity uniqueness and order domains. Stable interaction+phase IDs remove content-dependent identity for resolved Permission; no need to edit or add a validator path |
| `tree-writer.ts:3756` upsertInteractionCard | Card ID comes from seed ID; original role/system, time/order and parts are stored. Existing alive-card pruning removes replaced old text-seed cards on rebuild; old IDs are transient UI data, not a new persistent migration |
| `CardParts.tsx:56,114–125` | Resolved Question phase part formats through existing TextPart. Generalize the same condition/helper to resolved Permission before the pending InteractionCard branch |
| `utils/transcript.ts` | Existing request/response formatting and current locale source. Existing labels cover permission request, exact scope decisions and Auto Reply; no new locale key is necessary for the smallest plan |
| `utils/interaction-dialog.ts` | Collects original interaction objects from both part types and deduplicates IDs; `pickDialogInteraction` selects only pending. Two resolved phase parts do not open a second Dialog or make a history row actionable |
| `InteractionDialogHost.tsx` | Keeps current pending selection/dismissal/reply lifecycle. No need to change its keyed Show or draft ownership |
| `utils/permission-interaction.ts` and Main/Side services | Standalone Permission is pending-only and is removed by real Replied/Terminated. Its payload currently has choices, while raw toolName is its title. This batch does not fabricate standalone answered history to reuse the new Task renderer |
| `transport-protocol/src/index.ts:674–675` | Both interaction part types already exist as renderable/display types. No new SDK/transport part type, phase schema or event is needed |
| `TextPart.tsx`, `text-part-model.ts`, `utils/i18n.ts` | Mature asynchronous Markdown pipeline; model tracks current text/localeSeq/revision, ignores stale worker responses and cleans up on unmount. `t()` reads `appStore.localeSeq` through localeValue. Existing reactive getter call is the correct boundary |

Search was restricted to production `src` trees and the named 405/current architecture records; no new or old UI tests were searched or run. Full original three sources and relevant caller excerpts will accompany this report in `task-history-source/`.

## 3. Proposed minimum implementation (not authorized by this report)

### `utils/interaction.ts`

Rename/generalize existing QuestionHistoryPhase/questionHistorySeed to a single interaction history helper for `question | permission`. It returns the same original `interaction` object and `phase`, with part type selected from the actual type (`interaction-question` / `interaction-permission`). Keep ID `ctx:interaction:<id>:<phase>`, system role, request/response orderKey and original time.

Keep pending branch exactly as delivered. Resolved Questions retain answered/rejected/expired validation and phase behavior; resolved Permissions accept current canonical answered/rejected states. Permission grant expiration remains grant history, not an invented Interaction expired status. Missing response order/time or unsupported status/type is an explicit current contract error, not a guessed phase/time.

Remove the superseded textSeed path and its formatter/hash imports from this module. All currently public Interaction types are now handled by the single existing phase-part path; retaining the generic text branch would preserve a second translated-history implementation. Current `clarification`/other-type wording in its header/doc comment does not match the current public closed type and should be corrected within this same edit.

### `utils/transcript.ts`

For a Permission request, derive the display product label from existing `t('interaction.icon.permission')`. Append the **original** nonempty `payload.toolName` as technical identity, e.g. `Permission request · read` / `权限请求 · read` using the same neutral separator. Preserve body/scope exactly as original formatter semantics (no translation or prefix stripping). The public Interaction payload is optional: if no actual Tool name is present, display only the localized generic label rather than invent a name or parse the old title. Current canonical Task producer always supplies the name; unsupported historical missing payload remains distinguishable in backend data, not repaired by UI text guessing.

Keep Question titles/body/answer content untouched. Format the Permission response from actual decision plus actual `response.auto_reply`, using existing t keys **at render time**. Root has selected replacing the current unknown/missing decision default-to-allow_once with an explicit decision contract error. `interactionReplyLabel` has only this production caller, so this stays within the same file; no new public schema or renderer. Validate the actual decision even for rejected status (which currently returns before reading it): answered requires a real allow decision, rejected requires deny; invalid/missing authority must never format as an approval. No UI formatter/text test should be added.

The only source caller of exported `hashText` is the textSeed path being removed. Source-wide `packages/**/src/**` search found no other caller. Remove that function/export header entry in the same transcript edit if the text-seed path is retired. This is scoped dead-code removal and immutable identity replacement; it is not a claim that every hash is an invalid acceptance gate or permission to remove unrelated protocol digests.

### `components/CardParts.tsx`

Rename questionHistoryText to a shared interactionHistoryText (or equivalent single existing helper), and extend the resolved phase Match to both known interaction types. Both request and response use the same `TextPart text={...}` reactive expression. Keep this Match before the pending InteractionCard branch. Preserve unknown-phase explicit error, original Markdown behavior, body spacing, system role and current TextPart worker ownership. No CSS, new renderer, replacement messages, locale key, selection control, CardTree or reply-service edit is required.

These changes alter derived rendering only. Do not write translated body/title back to Board, ledger, card source interaction or backend payload; do not add getLocale to tree-writer to rebuild identities on every language switch; do not key/remount on language or create per-locale caches.

### `components/InteractionCard.tsx` — Root-selected fourth file

Add optional `toolName?: string` to the existing payload presentation type. Replace only the displayed title accessor/JSX binding: for Permission with the existing structured payload Tool name, format that actual name with the current `t('interaction.icon.permission')`; otherwise preserve the original current title used by standalone Main/Side and Question. Main/Side normalizer currently places the technical Tool name in title and choices-only in payload, while canonical Task Permission supplies payload.toolName. This is real structured data selection, not an English-title test, endpoint rewrite or new Task owner field.

To avoid duplicating the product title formula between history and pending controls, extract the small Permission-title formatter into the already-touched transcript utility and call it from both existing presentation locations. No new module or stored title source is needed. Keep the current icon, its localized aria-label, Show structure, body, controls, reply route, mutex, drafts and afterReply capture unchanged. Backend producers remain untouched for this title concern: their original technical title/payload are still intact.

## 4. Lifecycle, language and semantic boundaries

The request/response pair has two stable presentation identities owned by one original interaction. Changing locale reruns the TextPart prop formatting through `t()`; it does not construct a new Request, choose another decision, reattach history to a newer Session turn, or submit a reply. Request/response order and times are supplied by backend, including the old original grant capture time after an approved INDEX; the renderer does not infer them.

Original user/model words, technical Tool IDs, scope JSON, Request IDs and human reply content stay original. `interaction.auto_reply` is the existing generic label (“Auto Reply” / “自动回复”), currently shared with automatic Question answers. Reusing it is the minimum consistent behavior; if product wording should explicitly say “saved approval applied”, that is an additional semantic-label decision with exact en/zh keys, not a reason to infer provenance from source grant actor/reason or to relabel all automatic Questions.

The selected fourth-file point addresses the current pending Task heading that formerly displayed the backend's English title directly. Root must visually verify both pending inline/Dialog title and resolved history during same-page language switches. Main/Side technical Tool title remains original; standalone settled permissions still leave the pending projection rather than gaining history cards. Historical incomplete payload does not authorize reconstructing a Tool name from English prose.

The stable IDs also avoid two same-time, same-translated-response Permission interactions colliding solely because their text hashes match. This is a source-level consequence, **not** an independently reproduced new defect or a reason for an extra UI test. Every positive behavior still needs Root's real page evidence where naturally reachable.

## 5. Support checks and real desktop acceptance

After Root approves exact source changes: focused overlay typecheck, private Node/Vite build under the existing owned deadline; no source-string/formatter/DOM/render/snapshot/browser test. These support compilation only. Backend canonical graph/error/provenance tests remain in the backend scope and are not replaced by UI checks.

Root's real Task page should first record a natural pending Permission and actual human resolution. Confirm both historical request and response, raw Tool name/body, scope label and original times. Switch English→Chinese→English in the same page/session and review actual screenshots, plus cold reopen ordering. Exercise natural answered and rejected rows where allowed; original pending controls/keyboard/Question draft behavior remains current.

An automatic grant reuse often emits **no Asked** and thus creates no Task Interaction. Do not seed an interaction, set auto_reply in a helper, rewrite a Board response or use a static text flag to fabricate its visual acceptance. If a real already-Asked request naturally settles by grant reuse, capture that real card and automatic response. Otherwise label the auto provenance/arrival-order path backend/protocol-qualified only and keep its specific desktop arrival unverified; a human-resolved Task history page does not replace that evidence.

D1 Main/Settings naturally verifies the actual grant graph and Settings records, but **cannot** alone qualify this Task history renderer because standalone Permission projection remains pending-only. Mobile/external ACP/channel and every Task/Mission workflow are not included by this small visual change.

## 6. State

The Root-selected candidate allowlist is exactly `utils/interaction.ts`, `utils/transcript.ts`, `components/CardParts.tsx` and the one heading presentation point in `components/InteractionCard.tsx`, including scoped removal of obsolete text-seed/hash code. Strict invalid-decision errors and pending Task title are selected as above; pending owner/data/reply/SDK contracts remain unchanged. All actual UI and automatic-arrival proof remains pending. No production file has been edited.

## 7. Final 408 implementation supplement — awaiting Root spec entry

User now requires completing the known issues in this batch and stopping; no next iteration. Root has selected the backend event `grant_decision_indexed` and revision2. Its sole purpose is to point at the original grant_used; its own timestamp is actual indexing/migration time, not permission capture time. This UI supplement does not select a winner or resolve source_event_id itself. Root owns the fixture/catalog/Memory repair and all physical/UI acceptance.

Current exact seven-file scope: the four files above, `components/settings/PermissionsPanel.tsx`, and one private event key in each `i18n/en-US.json` / `zh-CN.json`. All seven originals plus existing diff are saved in `implementation-before01/`. The five code files were clean at capture. Each language has seven peer additions (five channel keys and two project_runtime keys); those remain verbatim. No SDK, public type, backend, CSS, locale remount, new component or shared documentation edit is included.

Re-read current production source confirms all four-history-path observations still apply: only textSeed calls hashText in production; only the Permission response formatter calls interactionReplyLabel; tree-writer has three seed consumers, while dialog collection deduplicates the same original interaction and selects only pending. The one phase renderer dispatches through TextPart. Pending Question and Permission seeds, reply mutex/source/authority/selectEpoch, Question option/draft ownership and all U3 layout work remain unchanged.

Precise implementation:

1. Generalize `questionHistorySeed`/phase to the existing shared original-interaction history seed for known question/permission. Preserve exact `ctx:interaction:<id>:<phase>`, original request/response order and original authority times. Question allows answered/rejected/expired; Permission allows answered/rejected only. Unsupported type/status/time/order is an explicit contract error. Delete the replaced translated textSeed, its imports and the now-unreferenced hashText function/header. No parallel old text path.
2. Add one small `permissionRequestTitle(toolName)` formatter to the existing transcript utility: current `interaction.icon.permission` plus original nonempty technical name; absent structured name uses that localized generic label. Permission history calls it directly. The single pending InteractionCard title accessor calls it only when a real `payload.toolName` is present; standalone Main/Side choices-only payload retains original technical title, Question title unchanged. No stored-body changes or English-prefix stripping.
3. Permission responses accept only allow_once/allow_task/allow_project/deny. Missing or unknown decision throws an explicit contract error. Answered+deny or rejected+allow is also an explicit mismatch error; rejected cannot bypass inspecting the actual decision. Original `response.auto_reply === true` adds the current existing Auto Reply label. No guessed allow_once, no index timestamp or actor-based provenance inference.
4. CardParts extends its existing resolved-phase Match to interaction-permission, ahead of the pending InteractionCard Match, and uses the same reactive TextPart formatter for request/response. Unknown phase remains an explicit error. No second renderer or language-keyed owner.
5. PermissionsPanel adds `grant_decision_indexed` to its existing event-label map. The exact private key is `permissions.event.grant_decision_indexed`, proposed labels `Historical grant decision indexed` / `历史批准决定已索引`. It is a neutral timeline entry, not another approval/reply. Existing per-event `event.time_created` rendering already gives its true actual indexing date/time (localized visible time, exact ISO title); do not backdate or copy U's timestamp into I.
6. `operationStatus` preserves execution-first semantics. Its non-execution search skips both requested and grant_decision_indexed, then selects the actual requested row only if no business delta exists. An all-index/no-request group is an explicit incomplete-history error, not a fabricated approval. Current `PermissionAuthority.history` returns all project rows ordered by descending rowid without pagination, so a valid canonical indexed operation includes its requested/source/business rows. UI does not dereference I or derive scope from it. Existing approval-scope finder already explicitly uses allowed_once/grant_created/grant_used/denied and ignores I; retain it. Current project owner grouping remains unchanged.

Source evidence for added Settings scope: PermissionsPanel:42–59 eventLabels; 80–82 localized time; 131–150 execution-first status plus current broad latest-nonrequested branch (would incorrectly let new indexing overwrite an unexecuted operation's status); 305–359 status/approval/timeline rendering. Authority:1450–1458 returns complete newest-first history; route permission:56–68 exposes that array. The backend canonical validator owns graph completeness. The local UI event type remains its existing private string; closed public LedgerEvent is backend-owned and no SDK mutation is made here.

Support and verification: Root first records this exact supplement in spec, then implementation may begin. Only focused typecheck and mature private Node/Vite build are allowed if separately scheduled; no UI/formatter/source-text/DOM/render/snapshot tests and no existing UI-test scan. Root must use real development /ui for same-mounted Settings timeline/status/date language switches, natural Task pending/history and original actual automatic provenance when reachable. Before02 proves Main/Settings before facts but not Task history or same-mounted General. Code/build success alone does not close those visual requirements.


工具输入实际修复与原资格：7个当前源码原像已独立保存catalog-memory-before，5个tracked路径前diff为空。fixture函数从实际header取safe baseRevision、原ordered coverage并核实际evidence、保CURRENT MEMORY正文且明示Controlled Provider fixture；共享writer调用时动态import、strict过程根/真实parent/exclusive新文件、当前public bundled+现ModelsDev两primitive。CLI/artifact/D1按实际正确环境后import，旧clone/keyword detector删除。原fixture408-current01 ae1cab真实exit0、parent75384→88980/03ef35f8-8c38-4a65-a09f-63e6ab746956、started1791962732725/deadline1791963332725/end1791962739129，request/physical/output实际joins；正式runner精确1file/1test/6expect，真实SSE decoded baseRevision3/ordered2IDs/原memory与非空正文（844b12原完整stdout/stderr），只局部contract，尚无Memory生产commit资格。

Root844b12全文读UI完整catalog分析报告，纠正本记录早先算术：原939 JSON日志共有102 ERROR（7catalog.read+95=19×5 loader），不是96。原7与19×5分组/原stderr没变；2 Memory WARN仍原344/531。公开Session/title在日志中，不称匿名；无完整Provider request body/messsages的结论来自实际完整结构/producer检查，原长输出截断保留。分析report/7原source及reviewJSON后续archive，只公有实际范围；before02保留runtime不整体承接。

## 物理升级正式实施方案冻结

Root已重读完整migrator与实际db configure/open/cleanup、现正式迁移checker/worker、原已qualified默认WAL与dual/guarded实验。真实根因是BEGIN IMMEDIATE只挡writer，旧cached/read-only decoder仍可访问新语义；runtime_process不是全DB owner registry。Root选唯一migrateSchema入口内的原handle物理保护，不加队列/发现gate/第二配置：入场NORMAL，finalized读取main version/objects建立WAL attachment，非fresh旧版升级严格要求实际WAL（私有:memory:不涉及共享file）。旧版非WAL报SCHEMA_MIGRATION_REQUIRED与精确维护说明；不得修改旧file journal_mode以假称已排除idle旧decoder。fresh/current正常事务；BEGIN内若初判fresh/current变成未持guard的真实旧版则明确required并rollback，不偷偷unguarded升级或另起fallback/retry。

实际旧版WAL升级：设置EXCLUSIVE并在原BEGIN IMMEDIATE获取实际file独占，BEGIN内重读version，原同handle backup→suspend indices/triggers→semantic全图validate→target rebuild→currentvalidate→commit。先前双候选合法current+upgraded或busy+upgraded/busy+busy，不能固定两者都from1。任何guard尝试的成功/失败路径都在原handle恢复NORMAL，必须finalized main访问与实际mode确认才暴露Client/启动checkpoint；纯pragma返回不能算物理解锁。原foreign_keys配置亦恢复。

所有原主错/rollback/FK恢复/physical release错误都保留；commit后release失败明确说明版本已commit、connection未安全释放，不说已rollback、不重跑semantic、不暴露Client。rollback失败的活动transaction不能被一次read伪装release，原初始化strictclose负责真实owner闭合并保cleanupcause。原SCHEMA_AHEAD/BASELINE/REQUIRED/FAILED与current DATA_INTEGRITY合同保持，不扩大publiccode。版本2语义由backend同源方案接入，本物理入口不解读权限业务。

精确Rootallowlist：storage/schema-migration.ts、test/storage/schema-migration.test.ts与原fixture/schema-migration-process-worker.ts。三个原像已保存physical-implementation-before01且原diff为空。正式checker统一真实WAL文件输入；当前baseline断言用实际registry版本，未来revision用nextversion；真实cached生产owner阻塞、release后upgrade、失败rollback与实际NORMAL读取保原数据/备份；不以最新源码hash或negativeabsence作验收。现两writer测试中的parent cached连接必须先真正close，否则按已provedWAL旧reader合同只能BUSY，不通过偷偷保DELETE模式旧测试。

仍未知边界为非标准VFS/alias/compiled旧Bun与真实postcommit unlock故障；不模拟pragma假失败作端到端。已有本机真实实验支撑此实施，正式测试及真实before02自然旧producer→v2升级仍待执行，原scope没有复开或延时。

原physical408-formal01 ed385c/67023→6a1ba9真实exit1，parent25336→83976/b4849913-fa0f-46be-aff9-e36affa9450b，started1791963292590/deadline1791963892590/end1791963314941，原request/physical/output全部join。134c9e完整原stdout/stderr：22tests中21pass/1fail/72expect；真实cached WAL只读连接→BUSY/完整原v1→realclose→upgradev2/NORMAL/另只读连接实际新行，unsupported rollback maintenance、rollback/backup/并发真实paths均正向通过。唯一失败是旧checker断言migration-backups目录只有.sqlite文件；真实序列化WAL backup被只读打开后SQLite正常产生该backup的-wal/-shm。该断言从目录无额外文件推功能正确性，已与当前WAL输入不符；原backup实际完整rowid/Unicode/BLOB/version1已验证，current2→2准确回执也已验证。不是生产丢数据或共享锁失败，不删除原失败/延期限。

Root选删除这条过期目录排他断言，保真实完整backup和current状态验收；另一dual断言同样改为真正backup原version/rowid/body而非排他目录。实际Root三文件运行期间未改，已在physical-formal01-sources保本次精确source；未把后续peer registry变化当原运行输入。后续只新fresh正式scope重跑完整22tests。

Root已全文审UI实际7文件diff和review01（6c0ca1及完整补读），与冻结方案一致；语言JSON期间另有peer复数格式18keys变动，只本任务新增1event key可纳own提交，原peerpreimage/diff与现变更均保留。agent同模型容量结束后Root接管验收，不把其未做support当通过。Root准原唯一private builder接受显式afterNN scope，以保原build-before01/ui-before并创建fresh build-after01/ui-after01，原600/540/60期限/Node argv/自然Vite配置/3join/cleanup不变。只编译，不UI自动化或Vite服务器。后续开发模式/ui必须真实Main/Settings/Task人工截图，不以本build代视觉。

## 真实旧producer升级与当前桌面输入方案

Root22正式物理tests已绿（physical408-formal02原1a1e66/62798→1721af exit0；64044→61060/9fff5d06-0687-48c0-8b7f-9de8f8ba39f1，1791963443764/4043764/3455678，3joins；2ee3fa完整22/71stderr）。原UI私有build-after01 65fc20/46560→eb3903 exit0，87012→68012/037e69bf-3ff0-432c-9c66-d19db194e02e，1791963533014/4133014/3590755、原540s childdeadline4073014、3receipts同exited0/4joins、exactruntime removed、primary/cleanup空；当前after01 privateindex11891bytes只是support。overlay-types01原4153d9/23773→b07211 exit0，83008→90728/8c617403-b769-44c3-a845-bd57cae62c48、1791963563000/4163000/3578148，3joins，真实tsc --noEmit正常0。原React use-client/dynamic-static/chunk警告完整保留（d69b7d尾和完整buildlog可archive），不称build替代视觉。

现backend已正式v2，Root选择两个独立600/60桌面scope：先原before02完整闭合保留环境同handle当前应用open→实际semantic升级→cold原Session/Settings；再fresh当前环境两真人读取→保存/复用批准→真实Memorycommit+正确pending。核心正式验证/报告当前仍在推进，下面只prepare，Root审完成后另准运行。

复用driver只新增显式reuseScope参数（strict自有d1/before02范围），核原driver status closed、request/physical/output/handle四joins与原exited0、原pageclosure，再核真实retainedRoot/Runtime/OS-temp严格后代/原owner marker version1/pid与nonce。以原实际marker恢复该已授权Root数据环境的HOME/TestHome/ProcessRoot/Owner/XDG/Temp变量，再沿现applyIsolatedTestUserEnvironment原语清用户配置；不创建第二HOME、跳过runtime guard、伪造当前PID/旧nonce或访问用户DB。原数据owner marker仍原84828，当前Native child/Runtime occurrence重新真实产生并分别记，不能混为一轮。旧原环境全closed后再开新的scope，不延before02原deadline、不复制liveDB。

reuse前仅用独立readonly SQLite+queryAllFinalized记录真实原user_version1、database_authority及permission_ledger/results公开行，strictclose后才新service；不dump整DB/config/auth/models或完整Provider request。保原Message/原G/U/source/time/原readCSV地址，原public API acceptance按原bytes复制为旧输入且明确出处，不造新请求/Message/批准。server reuse原bootstrapProject目录及原CSV（验证原内容），唯一新public模型目录为同原runtime/data/models.json（旧无该file），当前完整bundled writer；既有localProvider配置通过真实public PATCH更新当前endpoint后才preflight。正常关闭后仍准确声明retained，到全部实际验收/归档结束再用精确原owner安全清理。

新增after公开checker仍只真实HTTP/公开事实，适配fresh与旧acceptance：original已成功Message和Tool输出、原grant/use/attempt/result→currentcanonical decided；currentfresh U占slot且saved-grant-policy；legacy原U不回写、I引用准确U且有自己的真实迁移时间/actor，S仍source原U。pending/coldpending是当前明确全集，Board idle；原first/second读取错误原件不回写为通过。追加真实/project-memory API，fresh先观察首revision及第二revision/有序coverage，记录实际Provider Memory baseRevision/IDs元数据（不全body）；旧数据可两pending合批成revision1，不能硬套fresh2。Root必须看真实cold页面和Settings原行/中英，Task自然历史仍需另外真实到达，不seedUI或伪事件。

复用旧数据prepare补充：旧before02保两Memory pending且stored local Provider endpoint已随原进程正常关闭。若先启动恢复再PATCH，真实Memory可能先请求失效旧端点；因此reuse模式在catalog建立/provider开启后、listener/recovery之前，用当前/global/config PATCH本身调用的唯一updateGlobalConfigPatch primitive写本Scope明确控制配置，随后以真实GET /global/config与/provider公开核验；fresh模式保持真实PATCH。不是再建配置或绕产品校验，两个模式都沿同一canonical mutator，一轮只写一次；原旧config不改写为原运行“正确”。Root已读update-global.ts完整、真实route handler、原phaseBConfig，所有值是公开local fixture，当前精确model不变，无真实凭据/付费请求。

## 通知横审与外部共享消费者实施冻结

Root c86fbc全文读interaction-resolved-audit/external-permission-consumers-review，bb6617亲核4实际消费者源与全部ProtocolStore生产订阅入口。原source-task03仍8/33+Task5pass1fail/28且真实join，不能反写pass。两实际Asked/Replied delivery都重读同canonical authority并各发ephemeral projection；全部生产subscribeEvents只有diagnostic/SSE/read投影，Task Session订阅过滤此类event，Overlay现Board/tree GET与原debounce，Permission真resume仅原Authority won/waiter边界；无新控制扫描/Message/Provider/userInput路径。Question单独control scan不能混为Permission消费者。Root准测试按原2/1到达通知全集+每通知原ledger/order/Task/Session+唯一durable决定/真实callback/result正向核验，不加影子去重；没有真实Task LLM，此fixture只局部底层合同。

共享caller缺陷已具体证明：ACP排队B可在A显示期间被另一真实operator决定，队头仍用旧Asked；CLI live Asked直接打印等待；Channel runtime raw Asked直接发等待；真实Channel命令在opencorvus/src/channel/ingress.ts按attempted字词确认而非Task API返回canonical winner。CLI permission.ts本来就打印实际Resolution，无需改。old report core.ts命令位置误指已纠正，不凭旧label扩大。

Root准backend agent新增精确4路径：opencorvus/src/acp/agent.ts、opencorvus/src/cli/cmd/run.ts、channel-runtime/src/core.ts、opencorvus/src/channel/ingress.ts。前三在原queue head/真正emission边界通过既有durablePendingPermissionsForSession（跨package为现SDK permission.list）重读准确Session/Request及原directory，使用完整当前Request；settled只停止pending投影，不推断allow/deny。ACP实际reply使用throwOnError/原SDK错误合同，失败的局部projection marker仍可由原hydration重投当前pending；不新queue/poll/cache。Channel ingress从真实返回Interaction.response.decision/status给当前scope/拒绝确认，未知/缺decision明确完整性错，不defaultattempted，三个Permission分支复用同格式，Question不改。所有已打印历史notice不能说已撤回，已显示ACP peer Dialog的物理关闭、外部真实Slack等客户端视觉仍未验。

Agent先存当前原像/diff、限定backend聚焦正向实际SDK/队列/CLI输出/Task赢家合同；不能UI文案/DOM/组件/浏览器自动测试、core负向“不调用”断言，不访问外部真实应用/凭据、不再委托。必须真实adapter/checker路径，不 detached helper冒端到端；当前原4process scope结束前禁止改变其已冻结Authority/consumer source。Root审差异/原回执和统一types/module-topology后交付。下面两报告是本批完整实施依据与边界。
# 408 Task permission projection invalidation audit

## Original observation and limits

`implementation/source-task03` original exec65115 joined68065f exit1. Migration 8/33 passed. Task checker 5 passed/1 failed/28 expects: the reply-first case's actual Board was HTTP200, answered, allow_task, original ledger resolution time; its next assertion expected one `interaction.resolved` and observed two events with the same interaction/request/ledger/status. The original source/stderr/owner remain unchanged. This report does not reclassify that run as passed.

The checker uses the established Task fixture and real Authority/Bus/Engine/Protocol/Board code plus a real execution callback. It does not run a Task LLM or create a ToolPart. Message/Provider effects therefore require source-path exclusion here, not a fabricated assertion about a nonexistent model call. Actual public TCP Prompt coverage passed separately in projections01; it is not this Task order scenario.

## Definitions and complete production subscription surface

Search input/output is `implementation/interaction-resolved-callers.txt`. Exact production producers are engine/interaction.ts projectPermissionTermination and resolvePermission. `ProtocolStore.dispatchEphemeral` (store.ts746) makes a new transport event/liveSequence, stores only the bounded in-memory live replay entry and calls dispatchEvent; it does not call appendEvent, Bus, Session writer, Permission reply, Task control or any model. dispatchEvent300 only invokes registered `subscribeEvents` callbacks matching aggregate/Task/Session/types (290).

All production `ProtocolStore.subscribeEvents` callers from the full repository search:

* engine/event-log.ts320: selected event timeline/NDJSON logging; resolved branch257 writes diagnostic lines only.
* server/routes/orchestrator.ts644: exact Task identity filter, cursor/liveCursor and SSE output. Ephemeral occurrences have separate liveSequence values; no execution admission or domain mutation.
* server/routes/session.ts1265/1269: session aggregate and an explicit Task lifecycle allowlist of agent.execution.lifecycle/session.error. Task interaction.resolved is outside both matching filters; it does not become a standalone Main/Side pending update or a Session wake.
* server/routes/work-ledger.ts378: mailbox/task-list projection notification, SSE writing only. Even if selected by a projection predicate, the callback does not issue a command or wake.

No Task/Mission/Session execution owner subscribes to this protocol event. The event model enum and event-log allowlist are declarations/logging, not execution consumers. Engine/interaction's only `requestTaskControlScanInBackground` call is the separate Question projection after its original typed control resolution (line511), not either Permission invalidation producer. Permission's real continuation resides in replyValidated1060–1062 (won decision and no physical waiter), original local waiter release, and the existing explicit recovery scan. None is reachable from dispatchEphemeral subscribers.

## UI and reconnect handling

Overlay event-policy.ts132–170 classifies interaction.* as Board invalidation and interaction.resolved as a tree projection. tree-writer.ts890 routes it to handleInteraction2078 which only rebuilds cards from current boardStore.board.interactions, not event payload or a reply action. services/events.ts's task-event routing schedules Board reload for the active Task. store/board.ts757 captures API authority/selectEpoch and coalesces refresh timers with its existing bounded debounce; loadBoard is a GET projection. Two transport notifications may cause one or two GETs depending on arrival timing; neither route starts a Tool or emits userInput. No new dedupe/cache is proposed.

Reconnection can replay both bounded live transport occurrences; both have the same original resolution orderKey and reread the same canonical Board. Restart loses ephemeral memory and hydrates the canonical stored decision; no extra persisted interaction outcome is introduced. Task/session/Project identities are checked by resolvePermission against the canonical request and Task row before dispatch; matchesEvent isolates exact Task streams. Parallel tasks and multiple Projects do not share a domain decision solely because they share the global subscription registry.

## Two causal projections, not two decisions

In the new deterministic reply-first fixture, the first real Asked subscriber calls the actual reply writer synchronously through decision/outbox commit before awaiting publication retry. The Engine Asked subscriber then reads the committed decision, materializes the one real request-backed interaction, and emits its current terminal projection. The original Replied publication still owns its durable Engine delivery; when that subscriber runs it validates the same ledger and emits the same terminal projection again. In the reverse registration order, Asked reads pending and materializes without a terminal invalidation; Replied later emits the only terminal projection. Both paths call the same canonical reader. The existing durable delivery contract is idempotent by occurrence, not a promise of exactly one ephemeral invalidation across different Asked/Replied causes or replay.

No duplicate userInput is manufactured: late Asked calls resolvePermission without userInput; only the winning Replied carries original input and assertResolvedReplay captures the immutable occurrence using original interaction identity/time. Current local test uses no userInput, so that last statement is source evidence; original engine-interaction-recovery positive user-input replay cases passed in projections01 separately.

## Positive checker correction proposed after this audit

Keep original failed expectation/source. For each actual order assert the complete canonical request/decision/start/success/result and one executed callback; retain the actual full notification array, and check every event's original Task/Session/request/interaction/ledger/orderKey plus exact terminal fields. Deterministic order-specific transport counts are 2 for reply-first and 1 for Asked-first; those are local observation expectations, not an exactly-once global contract. The reader/Board has one durable authority regardless. Do not add a shadow notification cache, a workflow gate or a synthetic terminal.

Remaining boundaries: this audit and local fixtures cannot prove external SSE consumer implementations, real model Task completion, or undocumented third-party clients. No UI automated tests were run. Root's real desktop/actual model evidence remains separately scoped.

# 408 existing external Permission consumers: bounded current-source review

This is read-only scope feedback, not authorization to edit the paths below or a new batch. No external app, transport, model or UI was started. All four original candidate files were clean when reviewed; current implementation locations matter more than older report labels.

## ACP queue

`packages/opencorvus/src/acp/agent.ts:338` receives raw Bus permission.asked. `projectPermissionRequest:602–670` immediately marks the request projected, queues by Session, and at queue head `:611–637` opens connection.requestPermission from the originally captured event without rereading canonical pending. Hydration `:673–677` already uses the mature `durablePendingPermissionsForSession` helper, whose single source is public permission.list then exact Session filtering (`permission/pending-projection.ts:3–15`).

Concrete input: while request A's external prompt occupies the queue, B Asked is enqueued; another legitimate operator/transport settles B before A completes. B reaches queue head and still opens its old pending dialog. Core reply is now strictly winner-owned, so this does not create a second authorization, but the stale external prompt is real. `.reply:655–661` also ignores the SDK error/result object. Existing ACP cancellation/failure removes the local projected marker; it does not prove the peer UI prompt physically closed.

Minimal candidate: at queue head call the existing helper with exact session.cwd/session ID; only project the matching current complete Request, validate identity against original event as appropriate; settled means skip pending projection, never infer allow/deny. After real selection use normal public reply with throwOnError and consume/log actual winning Resolution if a notification is needed. No new queue, cache, server endpoint or policy. Cannot promise closing an already displayed peer dialog or third-party visual acceptance. Candidate source: acp/agent.ts only; focused tests must exercise the actual adapter queue/SDK requests, not a new detached helper.

## CLI live notice and existing explicit reply

`cli/cmd/run.ts:449–473` permissionRequested marks IDs and prints “waiting” from the passed event. Initial hydration `:475–481` is current canonical, but live event `:597–599` calls the same synchronous function from unverified old Asked. Minimal candidate: make this projection async and reread exact current pending at the actual emission boundary using the existing helper, await both callers, mark only accepted current requests. Already printed historical terminal output cannot be erased and must not be described as withdrawn.

`cli/cmd/permission.ts:84–101` **already prints `resolution.decision` and canonical request**, not args.decision. No confirmation-text fix is required there. Keep this path unchanged unless tests expose another concrete defect. Its `attach.result` owns SDK error handling.

## Channel notice and actual Channel command owner

`packages/channel-runtime/src/core.ts:1069–1087` sends mirror/system “waiting” notices from raw Asked without current lookup. It has a typed SDK client and known directory, so the minimal candidate is public permission.list with error propagation, exact Session/request match before mirror/safeSend, using the returned current Request. This package cannot import an opencorvus internal runtime helper; use the existing SDK contract locally without duplicating decision resolution. There is **no** current permission.reply/always command branch in this core file (full src search confirmed). Its test stubs retaining permission.reply do not prove such a production path still exists.

The actual “always” confirmation lives in **`packages/opencorvus/src/channel/ingress.ts:281–326`**, not the prior four-file allowlist. It selects a pending projected Task interaction from EngineService.listTaskInteractions, calls actual replyUserInteraction/rejectUserInteraction, then returns unconditional strings based on attempted words (`Permission granted`, `granted (always)`, `rejected`). Task API `task-api/index.ts:2762–2820` awaits the real Permission winner then returns fresh `viewInteraction(requireInteractionInCurrentProject(...))`. A race where another valid decision won therefore can return `response.decision` different from the attempted branch while the channel message still claims attempted success.

Minimal candidate requiring **explicit added path approval**: Channel ingress uses the returned Interaction's canonical `response.decision`/status for its existing result text (including allow_once/task/project/deny); no second Authority reader or raw ledger query. Exact missing/malformed decision should be an integrity error, not fallback to attempted text. Common response rendering may be local to the three Permission branches only; do not change Question interpretation or add new channel commands. Existing `channel-ingress-fact-storage.test.ts` verifies durable ingress receipts but not this winner race; a focused actual Task/Permission ingress test must cover real competing decision and exact returned outcome. External Slack/Telegram/etc rendering is still unverified.

## Shared scope and verification boundaries

These consumers observe raw global Bus events, so the new Session mirror lateAsked protection does not automatically fix their queues/notices. Task/Main/Side and multi-Project identities must stay exact at each existing SDK boundary. Core single-slot CAS remains the only decision writer; public pending disappearance is never approval. Recovery hydration already uses canonical pending, but queued pre-hydration events and already emitted historical notices are separate facts. Proposed source list is acp/agent.ts, cli/cmd/run.ts, channel-runtime/src/core.ts plus newly identified channel/ingress.ts; cli/cmd/permission.ts needs no production change based on current evidence.

Read-only searches had two Windows wildcard path errors and two guessed file names (`task-api.ts`, `task-api/interactions.ts`) not present; corrected searches located `task-api/index.ts`. Those search errors do not indicate product defects. No tests or source changes were made as part of this adapter review.


process01原77225→521829 exit0/4case58expect/8children，6正常0及2原设计cut23；所有case真实physical/output/request/Provider response/Resource handler/serverclosed全true/errors空。agent检查全部原8stderr发现Bun --tsconfig-override directory mismatch诊断，不能说整个工具clean；code行为通过与工具诊断同时保留。Root基于同已资格lock自然package cwd/tsconfig机制，准仅permission-execution-owner-process.test.ts删除当前旧override argv，worker不改、原源/log/600期限和120expiry不回写，fresh process02同4case/8真实owner复验。没有扩大宿主/延deadline/绕checker；等Root全文审原源码差异及最后stderr才称复验通过。

Root a6d62a全文复审review04当前driver/server新增部分及原不变closure，current/legacy facts patch亦已逐段审。准首个独立legacy-after01 actual开发/ui，Bun1.4/自然package cwd/empty-bunfig、原driver可选reuseScope精确before02、已闭合private ui-after01；600/60新scope。原旧producer before02真实v1 snapshot只读handle先strictclose，child原Native startup/semanticupgrade/normal runtime发生在新scope；Root亲看cold原Session/Settings，先公开legacy checker再实际截图，最后pageclose→explicit normalstop→原driver/外层exec alljoins。coreSource现API已正向33/139、projections21/142、retirement28/152和原process4/58资格（各原报告仍须Root全文读），不外推全部Task/外部Provider；types02正常0。This scope无GPT/Sol/真实凭据、live数据复制或用户应用操作。新发现错误保原并先调查，绝不续before02旧期限。
## 最终收尾：真实旧数据复核与审计原因展示方案

Recall：用户最新明确“做完了已知的问题可以收尾了”，本批已知修复交付后结束，不启动下一批。实际旧数据 legacy-after01 原221a3e/43697→3b3758 exit0，原72848→86920/7ca68f36-990c-40b5-b4e0-130e1303cd3d；600秒原期限/all joins/page40关闭/明确stop，原数据仍保留。真实API checker73f1e0通过：原grant_used的空slot与actor、原execution source、两次完整CSV和final身份/时间不变；新增I per_g0VY0d5jc00qRwsLedpA源指向原U并使用实际索引时间。真实冷打开原会话已收敛pending与coldpending为空；7张原桌面截图已人工查看。旧Memory原revision0/retry_wait/pending2保留，不称已修复或已完成组织。

新观察：中文截图07中“请求已关闭”下仍直接显示英文“The continuation reached its persisted conclusion”。直接触发点是PermissionsPanel把原event.reason放在主时间线的产品正文。根因：reason是无来源类型的原审计自由文本，既可能由host产生也可能是原参与者内容；stale实际actor/source/metadata均null，现接口不能可靠识别或翻译。旧语言键仅覆盖event label，未解决这段自由文本。全仓既有Panel只有此主时间线输出和technical details中的owner/scope，不存在同源reason解释器；不改接口/ledger/旧数据，不按英文关键字或actor猜来源。

选择最小展示修复：从主时间线移除原reason正文，仍在每个原event的existing技术详情区域完整显示原reason，配当前语言标签“Recorded reason/记录原因”并带原event label+原ID，保留事实身份与顺序。主正文保现localized事件/时间/批准范围；原用户/模型内容、技术标识与审计数据不翻译。精确追加scope仅Panel和en/zh各一个私有键，已保存reason-before01原像并审差异。未知历史文本来源明确保留，不引入双源协议或新schema。纯UI改动只用fresh private Node build、实际页面交互/截图人工复核；不增加或运行UI自动测试。

最终真实验收准备：复用已逐行审的D1 fresh driver/server/control/facts，独立after02服务，固定600/60原期限，完整public catalog+实际local streaming model，不使用真实凭据/GPT。两次Main读取实际公开CSV，第一次Root项目范围批准，第二次自然复用；实际publicAPI核U自己的slot/saved-grant-policy、完整输出/final、pending与coldpending为空、Memory实际revision1→2/原accepted IDs/pending0。随后第三个独立真实Task输入读取另一个公开文件，令真实Ask naturally产生Task Interaction，Root实际页面批准并复核pending/历史中英文、冷打开次序；不seed Interaction、不制造auto provenance。仅scratch Provider固定fixture增加明确第5次read/第6次final（与之前两个Main occurrence分开），不是产品gate或真实模型能力证据。Task若仍active通过既有Task cancel API关闭自己的执行再关闭页面/stop服务。自然Task未产生自动回复则只报告该路径backend/protocol资格，不能伪造截图。本批结束前归档原失败/成功、更新当前架构、聚焦checker、精确提交并正常fetch/merge/audit/push。
## 实际Task交互暴露的phase生命周期修正

current-after02真实Task tsk_g00VY0irwj00236j0Ff4，由/task accepted202产生read请求，Root亲看英文pending Dialog和中文inline，再点本任务允许。截图07原“unknown history phase undefined”保留。Root源码全链调查：唯一seed writer pending part不带phase；CardParts用可变interaction.status选history分支，Board同一reactive对象先从pending变answered、旧pending part尚未被新request/response seeds替换，误把原pending形状交history formatter。tree-writer完整三seed调用点及upsert保原part.slice，无phase丢字段。不是后端多决定/唤醒；HTTP后端实际赢家另行保存。Question有同一生命周期风险。旧预译textseed没有这个dispatch边界，最新改动仅按status选择尚未根治。

精确修正只有原utils/interaction.ts和CardParts.tsx：pending seed明示phase:'pending'；renderer依据稳定part.phase选择history，pending分支要求明确phase:'pending'且真实interaction.status仍pending。已resolved旧pending形状在替换边界不再产生操作控件；真正request/response原phase/identity/time/formatter保持，未知history phase仍显式错误。不造history、default response、不增加renderer/影子state/locale重挂，不改Board或Bus。保存两个当前原像后实施，fresh Node build+实际相同已批准Task冷打开/中英切换+fresh pending→answered正向人工交互复验，无UI自动测试。

此次Task的失败与该UI异常分开：实际stderr841/842/848/849显示controlled fixture第7 prompt已越原6上限而HTTP400。这是bounded Provider输入范围不足，原run不称Task completion/model资格；不放宽产品调度。保原失败与请求metadata，在下一独立视觉scope只冷打开原失败Task历史，不重新启动它/延原期限。后续fresh正向Task scope用明确独立fixture receipt阶段，若没有完整真实report则按正常cancel关闭ownTask，不伪称完成。
Root实际Task public事实读取纠正：task-observe原77d663 exit1，不把execution_succeeded预期当事实。原Task确有唯一grant_created/allow_task和原authority时间，但actual execution_failed为明确TaskProcessBoundaryError，原文件在Task精确process root外；后续模型第7请求越fixture限额另导致Task failed。授权不取消精确process root，是当前合同，不修产品绕边界。新视觉scope对同一已结束Task冷读；fresh Task以同一公开文件再次触发真实Ask→human approval→相同明确边界错误，其范围是卡片转换/历史语言与规范错误，不宣称Task读取成功。原HTTP数据和checker失败保留；修checker为actual明确错误合同及原source/attempt事实。没有调度/恢复异常证据，不把fixture范围不足推断为生产bug。

Root准唯一fresh current-visual03 reuse current-after02完整闭合owned runtime：version2不变，现完整public catalog保持同源并真实/provider预验；原driver owner/nonce/pid/root实际校验和strictreadonlysnapshot保留，复制原accepted Main和原Task身份供cold page选择。same global production config PATCH原primitive更新新localendpoint，不触动原ledger/消息/Task终态。新Provider明确Task-only read ordinal1，后续bounded6actualstreamedfinal且若仍active正常cancel，不创建fakehistory/自动reply。original before02/v1reuse路径保持strictversion1，不能重复升级已v2库。新600/60scope独立，页面关闭再stop/all joins，不续期旧run。
原current-after02生命周期未按计划成功：Root关闭page41后stop控制原d6180f报原close reserve已到，原service已自行按固定reserve正常stop并exited1，原driver812af0/99804→ce4962 exit1。request/physical/output/handle所有真实join、terminal preparationFailure null/errors[]，原失败不改写/不称scope成功。两Main实际完整HTTP正向事实仍保，UI原phase失败与Task边界结果仍保。允许复开的是这个物理已结束的精确owned输入，而非恢复原deadline：driver current分支显式检查原failed/exited1、固定reserve原因/alljoins/errors[]与page已关闭/owner marker，old-v1原正常分支不变。新scope600/60，不延时、不重复原checker伪称原绿；新scope必须真正pageclose→explicit stop→normal0。
最终工具链追加调查：cli408-check01原ce4208/90531→35c4e6 exit1/alljoins，actual first local-chat错误ToolSchemaBudgetError：当前完整工具105228chars/26321估计tokens超fixture旧32768 context的50%预算。complete catalog已正常，不能叫凭据缺失/Memory问题；未有Provider prompt可通过。原checker源码多年小模型limit与现完整通用tool面不一致，产品budget检查正确，不缩通用tools/绕budget/换真实模型。Root准仅现CLI checker localcontrolled模型context明确131072（保持check/check-model、output1024、所有流式请求和同cases/45s期限），与已合格本地fixture现context同级；保存实际before与首次rawresults/log后fresh cli408-check02重跑原完整checker。artifact checker现context已131072无需改其model limit。global408-check01 original8f7a81/9061→43b9cc0，正式单文件真实crossprocess1/37，core408-types04 original4ba39a/27242→cfe5790，全currenttypes通过。此类工具输入修复不作为UI或真实GPT理解资格。
## 本批最终结果与交付范围

截至本记录收尾：用户有限停止要求有效，不启动下一批。唯一ledger-facts当前实施按字段真实存在校验choices（显式null为scope_material_invalid），最末explicit-choices06原19264→108f46正常0/10tests39expect；agent22原scope已join，最终去重103tests540expect。Root全文复审全部production diff、leaf及migration；agent再次全文8触及tests与原process02八子stderr及真实源码/回执，具体局部合同和限制见HUMAN-AUDIT，不冒外部客户端或模型Task全链资格。

Root另有physical408-formal02 22/71、共享fixture408-current02 2/10、global408-check01 1/37真实cross-process；互不重复合计128tests658expect，CLI完整18cases另计，不累计重跑数量。最终core408-types04和overlay408-types02当前源均0；module-topology原7b9add/93437→9036c5 0，1168modules5965runtimeedges/4cleanimports；migration408-final01原56541b0精确version2目标对象一致。docs408-final01原b24904 0，architecture408-final01原5be8260。这些是后台/编译/文档支持，不代人工视觉。

旧真实数据闭合比对原24c1e3正常0：原before02/v1→actual2，原9权限行（含rowid/源/身份/时间/原scope文本）、2份真实结果与database_authority逐值完全保留，actual完整v1backup可读90tables。真实legacy-after01 7张原桌面人工复核、冷pending空、原success/header时间保真及索引真time（原221a3e/43697→3b3758正常0/alljoins）。旧revision0/retry_wait/pending2 Memory没有追写，保留原事实。

fresh Main真实publicfacts：current-first原8fb023、current-second原50d1ce均0，per_hyxk0dkOQKgXbzGiZUOi决定U拥有自己的slot及saved-grant-policy；两CSV完整读取/final2和4、live/coldpending为空、Memory确有revision1和2/accepted msgIDs/pending0。截图01至04 Root查看；current-after02原812af0/99804→ce4962 1保原phase渲染失败和到fixedreserve，不叫此scope整体通过。

修复后的current-visual03原8efe7d/30391→74b97b正常0，original50232→82172/0cf3176d-76c1-4346-b9ff-b44a475b6e45、started1791966959798/deadline1791967559798/end1791967358385，page42关闭1791967357...→explicitstop原d7d35b1791967358228→service normal0/error空/request物理输出handle alljoin。8张原JPG均Root人工查看：原Task真实request/response英→中，fresh自然pendingDialog→Root本任务批准→history中文，Settings真实中文timeline及rawreason完整details，恢复英文freshhistory/visibleCancelled。App原primarypage保持mounted/inert（非Show remount），Task语言变化不重建interaction；General切tab会remount，因此不称Settings same-mounted locale证明。Task错误属于真实process boundary，approval仍原grant_created/allow_task。task-qualified原6a62d3及cancel原8cf671均0；精确ownTask取消API202→visibleCancelled，不称模型report完整成功。原helper失败77d663、fixedreserve与UI截图07全保。历史pair相对请求/响应次序与原时间保留，既有Task父message/子interaction分组布局没有改；未承诺所有message内容混合的全局交错排序。

CLI预算段更正实际配置数：artifact checker为200000context，D1已有fixture为1000000context，前段131072同级说法只是Root输入选择，不能代actual源。CLI最终131072的真实资格为cli408-check02原b34b1e/4430→fb75b3 0，65060→84736/b485996a-d05d-4672-92bd-fc3d3a6f4626，18actualCLIcases包含本地/attached/重启/两project并行/明确错误，所有actual requests严格check-model+stream；stdout全文0fd03a亲读，完整首失败ToolSchemaBudgetError保留。没有真实Provider凭据或GPT请求。

本批根spec/current架构及三索引同步，final01 981原件46544537原bytes+manifest/README已归档（archive原66822b0/alljoins）。原成功/失败均保、原JPG直接可读。排除DB/config/auth/models/runtime/private UI bundle/完整Provider正文，存储回读不作为功能门槛。CLI最后/正式docs与最后Git回执以supplement承接，不伪改原manifest。本批没有bump版本、Release/tag/PR/发布；没有触用户应用/窗口/进程。已停止所有ownservice，保留两个明确owned测试runtime供本地核对，不宣称已删除。

交付边界：没有本批实际GPT-6.1 Sol质量验收（本批0请求，本项为权限数据/投影修复且实际effect/HTTP/OS证据明确）；自动reply自然UIarrival未制造，仅backend/protocol实际合同证明。未验外部ACP/Channel客户端视觉、所有Task/Mission/model组合、跨OS grant capture对revoke/expiry独立race、物理alias/customVFS/旧compiledBun/真实postcommitunlockfail。当前已知修复没有未提交实现例外；正式提交、freshupstreammerge/完整待推集合/normalpush将在实际完成后写独立回执，不能在此预称已push。
范围提交准备原d61d23正常join但exit1：唯一diff-check为新0002 SQL目标快照继承生成DDL三处行尾空白（329/3080/3983），不把prepare称成功。Root准在尚未发布的新revision2文件只去三处行尾空白，保存当前完整原像；不改不可变0001/生产schema生成器/结构/持久语义。重跑实际database-migrations对象checker与精确staged diff-check，不绕check/hook。agent原运行源快照仍保真，换行/源码摘要不作为功能验收。
新SQL格式修正原migration408-final02 9a7504实际exit1/alljoins：当前registry按SQLite实际保存的对象sql精确标识比较，行尾格式亦进入该对象标识，结果index:engine_artifact_invalid_task_process_binding_idx drift。这不是许可功能回归。Root撤回自己仅三处格式编辑，diff全文31bfe0及下一precise3hunks已审并保存：新0002仍当前生成DDL的唯一完整原目标，原实测源码及不可变基线保真。无需扩大修schema-contract或重生成配置。自有commit准备的格式检查从该明确generated `.sql` 目标排除，仍检查其余staged文本；这是删除无意义行尾格式门槛，不是--no-verify/跳过Git hook，正式migration/schema对象检查和全部行为验收保持。原失败不会改写成功，fresh原目标复验。
## 已验证的正常实现交付

主实现提交7207021392f134b602e772980498ea6d3677d09c，parent0bc24d22903e1f8b2dfda559419617c4d6d2911f，1211范围路径；原a97753/53491→996bb7正常0，alternateindex精确ordinaryindexReconciled true。精确新文件/3架构/7UI/8Root fixture+物理/agent24源与本批artifact/Recall；三公共索引只入本批一行，peer其他行保留且未混提交。旧负向UI测试未运行或新增，原源码/失败归档保留。Root的SQL格式试验已撤回到原生成目标，migration408-final03原20a11d正常0。

freshfetch原4e737b0→upstreammerge原aa6db30（alreadyup-to-date），完整upstream..HEAD原47d4d1只有该本批主实现commit。正常精确SHA push原1f0d15/77618→273ba60：83776→64252/a865d484-dc1c-4e13-982b-c16913a2c84f，started1791968173866/deadline1791968773866/end1791968341757，request/physical/output全部joins。普通hook没有绕过：Bun1.4、SDK/AI检查、迁移v2、专家types、8实际workspace类型检查（7cache1fresh）、routes35files/6rules、docs345/26、control18/23、architecture20、packages10、release5authorities、exact treeish720702 module1170/5982/4cleanimports、secret scan0全部0。原4d3b13全文stdout/stderr审阅，remote更新0bc→720。此1170/5982是最终treeish实测，早前1168/5965不是回写错误。

再次freshfetch原ba4ddd0及原ee62f8 ancestor0，确认origin/main含720，HEAD等于720且完整pending[]。delivery-pending-audit01是post-push snapshot，不伪装成早前prepush记录；早前Root47d4d1完整集合另原证据。Git remote的dependabot摘要保在原stderr，未扩大本批为新的依赖或安全扫描。

最终Git原回执以gitdelivery01补充写入独立文档提交；不把补充自己的未来push结果写进它自己。此阶段只文档/原证据，无产品变化，按原规则仍将freshfetch/merge/fullpendingaudit/正常push，不新增批次。用户有限停止要求保持有效，所有own页面/服务/checker已闭合，onlypeer三索引其他行与.bun等未处理；当前范围没有遗留未提交产品改动。
