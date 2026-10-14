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
