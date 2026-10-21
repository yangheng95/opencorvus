# 权限历史的系统终止语义

## Recall

505持续单开发agent，不委托；旧Goal的三个Astra描述被人类后续多次单agent要求覆盖。504为progress：9d21557be265c2bd9f70f9e41d541e8aa2b3199c已正常push/fresh HEAD=origin/main、正式hooks通过；真实新Task唯一Researcher、两个真实Sources、12节5836字元、15/24实际Sol全流式200/源EOF、12张人工图，Task/成员自然完成。原75904/native72240/IAB80已完整结算、auth/models退休。源90表141633原行保持，504副本只两capacity槽真实变更。并发/重连/连续帧、Main虚拟挂载精确触发与149目录10秒保存/5秒恢复仍未完成。开始status仅原.bun/与packages/opencorvus/bun/。

用户授权自主深入产品UI/UX（User Interface/User Experience，界面与体验）、功能完成度、Sources与成员Rendering优先、真实验证和提交推送，明确只用主agent及内置浏览器。沿已读benchmark-debug-template/computer-use。本轮使用已有真实已取消QA Task数据做历史显示，模型额度0、不复制凭据或模型目录，不创建Task/Message/Permission，不重放效果或取消。无委托反馈；长期Goal保持active。

## 现象、触发与根因（生产修改前）

501原真实Task tsk_g00VYeMccK0078SroWDw在第二合同等待Ask时取消，后端已修复取消收敛和恢复，原int_g0VYeNJZT003I5AZCoPJ/per_h9Tts9cnzyWtqrAjnwjN账本requested→cancelled。真实页面仍将其标成Reject/拒绝，误导为用户拒绝。502/503/504均明确留待语义修复，不把该label当取消运行故障。

全仓定义/调用搜索：permission/ledger-facts的authority是唯一决定槽赢家，保留denied/cancelled/stale及reason/id/time；grant后追加的slotless stale是retirement，不替代原授权。PermissionAuthority settlePendingTermination同事务发布Terminated，Task取消501写入正确事实。engine/store projectInteractionRowInTransaction将三个事件都投影status rejected/decision deny，response只携带decision/auto_reply，丢失终止类别；viewInteraction直通该response，listTaskInteractions和workbench/board共用投影。Overlay interactionToCardSeeds保留response，但transcript interactionResponseText只看deny并调用动作label Reject，因而无法区分。旧501修复真实取消写入/恢复，没有添加展示原因，不能根治该信息丢失。

相关公开契约：Interaction.response是现有开放Metadata对象，新增从同一ledger authority派生的termination元数据不改status/decision/排序/时间、决定槽、权限执行或现存持久字段。Board validator来自完整实际JSON canonicalDigest，新增response会自然改变弱ETag，不需要另加缓存版本或无效源码摘要。Session/Mission自身权限只保留pending投影，Replied/Terminated删除pending，不以Task历史适配为由合成终态消息。Question的expired/infrastructure来源已有独立显示语义，保持原自然参与者。Task内Main/成员/递归卡片共享transcript显示；Channel/API消费者保持canonical deny决策。

影响与风险：后端一处唯一投影+前端一处现有历史formatter；UI复用permissions.event.cancelled/stale当前中英文key，不新建标签双源。真实operator denied仍是原deny，已批准随后retired的历史仍answered。终止元数据只由决定槽赢家产生，不能把latest stale误作拒绝。无数据库schema/迁移或JSON持久格式变化，无Provider调用、消息隐藏、host流程门、执行重放或调度改动。现存UI自动化测试在本次检索的Overlay路径没有发现；不新增/运行UI测试。backend API/ledger正向合同与真实页面分别证明各自范围。

已读501 Recall/结果、504 Recall/结果、security-permission、02-data/03-control相关合同、ledger-facts/authority/permission.sql、engine/store/view/model、Task API listInteractions、workbench/board与HTTP路由、server/task-board-validator和task-cancellation-permissions正向合同、Overlay transcript/interaction/CardParts/tree-writer、现有双语label、成熟502-final零模型CLI与原生结算。当前没有新的调度/队列/恢复异常；若出现立即横审全部Task/Mission/Session occurrence（执行轮次）、入口/正常终态/重试重启/串并行/多项目，不降级为文案问题。

## 实施前计划与验收

1. 从完整关闭504-before只读serialize新permission-termination-history-505-before。完整90表全部原行/字段/rowid或主键、schema3/integrity、源bytes/mtime和完整五键canonical保持。只读核对原501Task/权限/原cancelled事件，寻找实际denied/stale决定及已有approval-retirement案例；不捏造UI数据或改旧事实。
2. 正式当前Node.js/Vite配置构建隔离before UI，由Source CLI（命令行开发服务）18913呈现 /ui；零模型审计使用现成RealProviderAudit(modelSol,maxRequests0)，在Provider导入前安装，记录真实0请求/exhausted状态；无凭据/目录拷贝，不给测试3次等隐含额度。只读API Board/interaction列表和真实IAB（内置浏览器）2页面，人工看现存取消记录中英文错误文案与原授权历史。自有20分钟资源边界、180秒启动无活动，用户18571窗口/进程/库不操作。
3. 原before全部公开shutdown200、原exec/native精确出生/物理/output/request/launcher完整结算后，才修改唯一后端投影：cancelled/stale决定的response带termination={status,ledgerEventID,reason}，取原赢家reason（可null），不读取后置retirement代替赢家。前端在有效rejected/deny历史中按termination status复用当前语言cancelled/stale label，真实deny/允许仍走现有决策显示；冲突/未知元数据沿既有明确错误，不静默遮蔽。
4. 聚焦非UI正向测试：Task取消全部分页/后代的原决定身份、系统reason与新termination；同毫秒stale真实HTTP Board新body/ETag及原事件；明确denied/allow响应精确保持，已授权后retirement仍answered；跨Project/重开旧决定沿现有原合同。优先复用被证实相关后端测试，不写UI源码文案/DOM/组件/快照/截图断言，不无目标全量bun test。
5. 独立after从已结束before完整数据复制，正式当前新前端+Source CLI18915，同口径0模型审计。公开旧Task的response与canonical账本身份/时间/决定保持、before ETag请求返回真实200新body，再同after ETag返回304；这些是有效HTTP对象身份，非无效hash门。真实页面中英文显示已取消/Cancelled和实际适用的已关闭/Request closed，原批准/实际deny如实可读；人工截图后复核。无此页/图则UI验收未达，不用类型/构建替代。
6. 全90表source/clone原字段、canonical/schema3/integrity与Provider持久活动逐项核对，0外部模型观测；所有自有publicshutdown200/exec/native/output/request/launcher/精确出生链结算，关闭自有页面。不重置/迁移/删除用户数据，无auth/models可退休，不借零模型UI资格宣称真实Provider/执行重放。
7. 正式i18n/typecheck/build/API/docs按影响面，更新security-permission公开派生合同、三spec索引；范围提交，freshfetch/merge、完整待推集合审查、正常hooks/push/fresh相等。无branch/worktree、无版本/Release/tag/PR，不混入原未跟踪目录。保留Rendering/性能等剩余工作，单agent继续。

## 实际失败、修复与真实页面

完整关闭504源复制90表145033原行/全部字段，before18913/原68133/native77296。原Board HTTP200、Task cancelled、原int_g0VYeNJZT003I5AZCoPJ response仅decision deny；原决定槽赢家精确per_g0VYeVhyT00XzS04yhz9/cancelled/system/time1792554430041，reason来自原QA操作者结束请求，不根据标题或模型自述重建。[01英文](../../artifacts/2026-10-21-permission-termination-history/01-before-cancelled-shown-reject-en.png)显示Reject，[02中文](../../artifacts/2026-10-21-permission-termination-history/02-before-cancelled-shown-reject-zh.png)有设置hover，[03中文清晰图](../../artifacts/2026-10-21-permission-termination-history/03-before-clear-zh.png)显示拒绝。原两次已批准历史仍真实Allow Once/本次允许。零模型守卫actual0/max0/exhausted false；原before publicshutdown200/exec0/物理/output/request/launcher/精确出生完整结算，IAB81关闭后才修改生产。

唯一后端投影现在由canonical authority的cancelled/stale决定派生termination.status/ledgerEventID/nullable reason，保留rejected/deny与排序/resolve时间。前端唯一历史formatter消费该类型并复用现有permissions.event.cancelled/stale中英文资源。实际deny、允许、Question路径不另建实现。backend source、formatter、两份聚焦后端测试及security-permission公开合同为本轮范围；无schema或原数据改写。

独立after18915/原86358/native75012，正式新前端真实加载同一Task；[04英文](../../artifacts/2026-10-21-permission-termination-history/04-after-cancelled-en.png)现在为Cancelled，[05中文](../../artifacts/2026-10-21-permission-termination-history/05-after-cancelled-zh.png)现在为已取消，两原批准仍保持。画面中的模型配置不可用是本次明确无凭据/目录的隔离阅读范围；没有点击Retry/Send或改成正常Provider资格。原两对照界面均用实际Source CLI /ui，没有单独Vite、DOM断言、组件/截图测试；五图均人工查看。

after真实Board200提供原赢家ID/status/reason；interaction id/原time/Task原epoch及terminal身份均与before精确一致，原其它已批准response/time完整相同。携带原before弱ETag的HTTP请求真实200新body；携带after ETag真实304，证明完整JSON对象校验随新投影变化，不是源码hash检查。原Task全部决定行/时间保持原值。原数据没有Task denied/stale赢家，未构造历史页面或用夹具冒充；stale和实际denied由聚焦真实后端写入/公开API合同覆盖，取消历史由真实UI覆盖。

## 测试与验收差异

12项/331断言通过：task-cancellation-permissions4项/293，server/task-board-validator8项/38。覆盖67请求分页/后代/同Task并发与精确系统赢家ID/reason、旧取消恢复、另一Project、显式重开新occurrence（执行轮次）、SQLite真实故障后的生产retry、同毫秒stale的真实Board body/ETag、实际operator denied的rejected/deny精确原形、既有allow_task两种事件顺序及Channel真实决定竞争。

第一版新断言按创建顺序请求与listInteractions最新优先顺序逐项配对，导致不同权限的ledgerEventID比较失败；原focused-contracts.log完整保留。源store.listInteractions明确按time_created/id降序；修正为按externalID一一核对原请求和其canonical赢家，不用任意字符串或删掉身份字段放宽验收。未为测试改生产排序。原失败不是新取消/调度异常，修正后原两个文件全部通过。没有运行全量bun test或UI自动化。

正式Node前后构建50.28/50.60秒、原55463/24752 exit0；全仓typecheck8项成功（其中两源码包新检查）、i18n两locale/2525 keys、docs345 operations/26 groups、architecture-index20文档通过。当前生产diff检查通过；归档保留原始构建/失败输出，不把历史日志重写为成功。

## 资源与数据结算

after publicshutdown200、原86358 exit0、原native物理/output/request/launcher及精确出生链全部结算，IAB82关闭。两scope audit均0/max0/exhausted false，未复制auth/models，未进行Provider模型资格。两scope各完整90表145033原行/字段/rowid或主键0差异；源bytes/mtime、完整canonical/schema3/integrity保持，Provider activity364→364。无新Task/消息/权限或执行效果，未清库/迁移/重置数据，用户18571进程窗口/数据库未操作。

[完整证据索引](../../artifacts/2026-10-21-permission-termination-history/README.md)。本批修复系统终止被展示为用户拒绝的已证实根因；实际stale历史UI样本、并发成员/重连/连续帧、Main虚拟回收精确触发、149目录完整性能和既有Rust父图告警仍未完成。正常提交/push与远端同步在本轮收尾，长期Goal active，单开发agent继续。
