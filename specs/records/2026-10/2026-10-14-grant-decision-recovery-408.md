# 408 保存批准的唯一决定与安全升级

## Recall

用户原始要求：持续按批次并行体验和调查UI（User Interface，用户界面）、功能完成度与缺陷；每批先根因/影响分析落specs，再有证据实施、真实桌面交互/原截图人工复核、聚焦正向功能测试及需要的已授权GPT-6.1 Sol流式端到端验收、范围提交/上游merge/正常push，然后自主下一批，直到明确停止。goal active、无预算；只既有audit_functionality/audit_ui单层委托，不再委托。

407已实际交付8354ac3319bdf66a0292beb615c56208c6f0d8f7，parent58096d4d7cf5695cf290e6737da50332a85c8ae0、637范围路径；独立index正常commit原3968 join54a2e8 exit0，ordinary index精确同步true且空。最终11 selected files、62不同tests/355assert；真实process4/58/8child闭合，公开terminal回复1/22/两listener闭合，4原桌面JPEG人工复核，第二独立Sol原5EOF资格0。首Sol读ECONNRESET资格1、前三公开失败与related01旧wait边界失败保留。完整[407 Recall](2026-10-14-message-continuation-retirement-407.md)和[551交付原件](../../artifacts/2026-10-14-message-continuation-retirement-407/delivery01/README.md)是证据，不把已捕获API核验当新模型轮。

fresh fetch e1950e/merge729190各0、完整pending唯一8354ac331；原正常push88358 join613631 exit0，parent85932→90380/b58e97fa-b9be-41b1-9b83-0c0f177fb660，started1791953230394/deadline1791953830394/end1791953469558。Bun1.4版本、8实际package types（6cache/2fresh）、SDK/AI runtime/迁移v1/专家类型/routes/docs345/26/control owners18/23/architecture20/package10/release5 authorities、exact推送treeish module1163/5937/4clean imports、secret-scan全部正常0；main58096d4d7→8354ac331。这里5937是推送treeish实测，不回改较早运行5936边的原件。再fetch7df990/ancestor911c84各0，确认upstream包含835；HEAD/upstream后来5449398be8381d4ecd9e3669eb86ce4da3220a42、pending空。不是Root创建release/tag/PR。

开始核git status：407本任务文件全部clean，只peer Git扫描/compaction、各索引和`.bun`等改动，保留；不新branch/worktree、不reset/clean/rebase/force/no-verify、不触用户进程/窗口/数据。407收尾检查/Git回执由本批archive承接，不能为写自身commit回执篡改前一提交。

已读：407完整Recall和10 backend路径/所有失败与最后实际owner；完整backend grant-used-followup、UI grant-projection/raw-permission-adapters和151行migration-coordination报告/补读原截断区、当前permission authority/decision/Engine直接slot投影、schema-migration全实现/immutable registry、Database lazy open/strict close/current configure顺序、所有version/liveness/raw openers/fence queries与历史。18段storage原源、24段grant/UI原源、20段raw adapter与已安装ACP（Agent Client Protocol，代理客户端协议）SDK1.4.0保持只读。SQLite官方[WAL锁矩阵](https://sqlite.org/walformat.html#locking_matrix)、[locking_mode](https://www.sqlite.org/pragma.html#pragma_locking_mode)、[WAL共享内存](https://www.sqlite.org/wal.html#use_of_wal_without_shared_memory)及pager源只支持机制推导，不代本机Bun/SQLite实测。一次猜测sqlite-connection.ts不存在已纠正到实际db.ts/openOwnedSqlite，没有当缺失功能证据。

约束：唯一append-only权限账本/唯一current reader-writer/真实Project-Session-Message-call-attempt-activation-occurrence；无新Permission queue/timer/tombstone/平行配置/fallback/历史回写/假批准或时间。全部LLM流式，通用预授权工具实际提供，不以host gate教工具流程。所有非UI改动正向明确输出/错误契约，真实checker；UI不新改跑自动化，只真桌面截图人工看。任何自有验证600s parent/180s child/30s HTTP/60s收尾，原期限不续；Provider需已授权auth+完整models配对、可用/投影/精确请求分别证明、全物理/输出/请求闭合后清理，不能写凭据。当前阶段不访问用户数据库、Provider或用户应用，不改0001基线，不延测试或绕hook。

压缩恢复先读本Recall，再核精确已做/未做/原owner/deadline/命令与最新授权。当前只有调查和实验准备，**无408生产、测试、schema revision、数据库实验或服务/page/model启动**。

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
