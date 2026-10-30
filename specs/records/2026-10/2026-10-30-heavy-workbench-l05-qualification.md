# L05脏现场与跨系统副作用：便宜协议资格

## Recall

用户要求十项真正重型全链路benchmark、可执行rubric、单层独立agent审查、真实OpenCorvus/fresh Codex对照，双好升级，数小时必须是有效工作。没有用户总token/墙钟额度；最新“从便宜的实验开始做”有效，六旧昂贵容器保持暂停。本记录先做秒级真实外部副作用协议闭环，不将它算冻结L05/候选分/小时或十题完成。

已读：长程、L06、L04、横向Recall，九题独立H05设计、旧H05输入与双系统天花板。全仓搜索script/benchmark、Inspect和三个benchmark artifact树中的idempotency_key/outbox/ack_lost：旧H05只有联合身份/持久去重，新HTTP收据/故障执行器不存在。第一次Windows目录通配符rg失败已用明确目录重查，不能当未找到证据。已有L04标准库SQLite/进程握手可参考；不调用生产Task/Mission/Session调度、Provider、LLM、UI或用户服务。L06独立冻结的真实Task正在运行，本资格不占GPU/长solver。

## 修改前分析与影响范围

现象：旧H05两系统100，事件载荷一致，用一个SQLite事务就能做完；题目没有外部收据事实、脏已确认历史或跨提交边界恢复，无法区分“本地标sent”与真实生效。直接触发是输入/验收仅覆盖本地账，数据流根因是没有第二个独立事务域。增加重复数/字数不能修复；不能要求无法查询/去重的不可逆服务在丢ACK后绝对一次。

本轮定义唯一公开合作副作用服务和私有小参考/执行器。真实服务用独立SQLite与HTTP（Hypertext Transfer Protocol，超文本传输协议），效果与幂等收据在同一事务；候选业务账另库，用稳定键恢复。所有HTTP进入同一存储函数，不提供fallback/第二事实源。故障仅为本执行器启动、握手确认的服务/worker子进程；不能把资格的故障误报成生产共享队列异常。若发现资格多个入口共有恢复缺陷，横向审计服务POST/查询、worker首次/重试/重启、串并行与实例隔离再修。

本轮不提供完整revision/业务更正/历史修复/旧写者栅栏/监测全题，不能将局部mini倒充完整L05。完整题后续必须有权威journal、历史ACK/outbox/外部收据脏现场、版本/冲突/冲正的可判合同、修复及职业交付、固定分母critical rubric和错误实现对照。金额为整数minor units，当前小实例仅USD且明示合成，不混币种；完整版本须另注册数据和合同。

## 实施前公开协议与便宜执行计划

1. 合作服务`POST /effects`请求精确字段：tenant、event_id、kind（post/reversal）、amount_minor、reverses。联合身份为tenant/event_id；post金额正整数且reverses=null，reversal金额负整数、reverses为同租户post身份，不可超累计冲正额。请求合法性失败422/invalid_request，引用未生效409/dependency_pending，超额409/reversal_exceeds_original。
2. 同键同业务载荷返回原持久receipt（200/replayed）；同键不同合法载荷409/idempotency_conflict，不以last-write-wins覆盖。首次201/applied；收据与业务effect在独立服务事务内提交，`GET /effects?tenant=&event_id=`返回200/found或404/unknown，查询不是另一个账源。记录服务自己的append-only effect rows与requests状态，候选sent标记不能代替该证据。多余/非整数/bool字段进入明确错误合同。
3. 接口只监听自有loopback随机端口。测试控制是启动时给定、只消费一次的指定联合键“已commit后关闭连接不发响应”；控制消费同事务持久，重启不会再注入。实际POST/GET/独立SQL共同核对未知ACK，不能把stdout声称commit当事实。另一自有worker可在本地receipt提交前通过stdout checkpoint等待，执行器只结束其握手PID；恢复仍使用原键。
4. 小脏现场：A/E1=+100已在服务生效、worker本地待收据；B/E1=+200未生效；A/R1=-30引用A/E1。并行重复后恢复，目标服务A70/B200，三联合身份各一条effect。额外A/E1载荷101为冲突；跨租户同event_id不可误去重。服务重启同键原receipt身份保持，新的实例/数据库同键可独立工作。服务requests记录每次实际请求结果，不用“无调用”负向断言。
5. 使用明确响应/持久行/金额/绑定/进程终态正向核对；实际HTTP并发和数据库查询，冷目录源码复跑后由已授权独立reviewer一层复核，禁止再委托。错误实现应产出真实可定位错误账：全局event_id、调用后换新key、先标sent等，不能只写文案或静态字符串测试。
6. 本轮先实现上述唯一服务/小参考/执行器，秒级实跑和必要反例。无效或失败原件保留，修复后只必要重验。结果与源码原件归档cases/L05，文档同步当前三个索引并做范围提交、fetch/merge/待推集合审查/push。

## 当前状态

独立计划审查指出两项mini自身的实际风险，实施前收敛：静态schema后先查已生效联合键，重放/冲突先于动态引用/余额校验；dependency_pending/超额拒绝不占effect身份，前置到达后同键可成功。已成功全额冲正的重放必须返回原receipt，不能按剩余额度再拒绝；并发不同冲正检查与insert共事务。

未知ACK现场必须由worker首次POST真实commit后socket关闭建立，不能seed服务效果再对重放丢响应。worker观察transport_unknown后，新进程GET原receipt、在本地确认提交前发checkpoint等待；只结束该Popen句柄，再重启恢复同一收据。静态receipt对象不变，applied/replayed/found仅外层状态；reverses是同租户post的event_id字符串。完整外部计划报告待归档。按上述修正实施，不添加完整题尚无的revision/epoch/监测承诺。

实现依据另查[SQLite原子提交](https://www.sqlite.org/atomiccommit.html)与[独立连接隔离/BEGIN IMMEDIATE](https://www.sqlite.org/isolation.html)：只以本库事务保存effect/receipt，不能推断两个独立服务库自动有共同事务。当前尚无HTTP执行/参考证据、正式rubric或冻结，L06候选与本资格完全分开。

### 首轮实际协议与下一步

主方首次从三个源码独立副本启动真实HTTP/worker与新数据库，5.189533秒、40项正向状态/金额/收据/具名错误核对通过，exit0。外部`D:/opencorvus-benchmark-runs/l05-effect-qualification-20261030/executed-source-a`与`run-a`保留实际源、命令、PID、HTTP、SQL结果和原库。首次A/E1确为本地accepted→GET unknown→POST commit/drop→transport_unknown；新worker GET原receipt、确认前握手进程中断→本地仍pending→服务重启/同键POST重放→正常确认。B同event_id独立+200、A冲正−30，逐身份原件一致；其他租户T/X是分开的依赖/全额重放/并发超额协议探针，非候选额外业务。

单层reviewer进行独立新目录源码冷跑/独立SQL及边界挑战，不把40计数当难度。独立计划另提醒“先标sent”坏实现尚未被现有正确参考鉴别；下一便宜工作是显式mini状态checker，按原accepted事件对其全部租户域逐身份检查两个库/receipt、输出具体business_mismatch。T/X协议探针与A/B核心分区明确，不把分区check当全题评分。另隔离构造两个真实坏实现：全局event_id去重导致B缺交；先写本地sent，在实际HTTP前自有握手中断，重启误判already_sent而服务仍unknown。各自在新服务/数据库通过同checker得到具体错误身份；不修改正确当前实现、不增加fallback，也不靠源码字符串或“不调用”断言。调用后换key的错误资格仍pending，不冒称已测。预计数秒，无新GPU/solver/模型请求。


主方新mini状态checker已实际读取原始服务/业务库：A/B完整分区三身份business_success；两种独立新服务错误控制都真实exit2/business_mismatch。全局event_id漏B/E1账与效果；提前sent在HTTP前握手中断、重启already_sent，服务GET unknown且三效果缺交。原源码/命令/库/响应打包L05/evaluator/qualification/main/originals.zip，未重跑原40资格。单层独立冷跑/SQL/边界和两控制审查仍进行中；没有全L05/候选分/小时结论。新判定器主动检查重复实际身份，避免dict折叠遮住重复行；不是完整候选grader。L06在20:24:51Z仍真实active，60次gpt-6.1-sol流式请求且有新源码/报告链，不作评分，后续按外部动态定位接续。

## mini之后的完整现场建设预案（不是已实现合同）

不能再重复本小例或把服务源码存在当重型题已建。下一实现单位为完整、闭合的事故现场：真实旧业务库/完整accepted journal/人工调整及用户注释、旧写者与旧投递代码、投递/ACK原日志和由旧程序真实HTTP生成的接收方snapshot。初始public材料足以证明哪些字段权威、哪些仅观察；已生效原receipt/错误效果不得删除来修总额。服务snapshot只由评估侧启动副本，候选只拿URL和公开取证快照，不能写服务数据库。

拟用最高revision唯一载荷/同revision冲突隔离/更高唯一版解除的乱序无关业务折叠，接受传输身份与业务身份分开；仍需最终独立审查，不能直接复活已搁置H05旧草案。完整题先明确单USD范围，不机械加入币种制造字段数。账务更正生成持久posting段：正段用当前post协议，负段指向原正段reversal，外部effect身份是posting身份、与可修订业务事件身份分开。所有posting及其来源在同一本地事务保存；未知ACK恢复沿用该身份，不能重放旧备份或重建新key。并发、依赖未到达和累计冲正仍由当前唯一合作服务事实核对。

旧程序要真实产生联合身份漏记、已接受未投递、已生效响应未知、错误projection、用户合法调整/注释混存的现场；不能直接把“根因=全局去重”告诉候选。保留足够完整原始journal、posting与外部receipt定位，让修复结果可判且不要求猜丢失事实。无法认定的字段明确unknown及业务处置，不靠oracle补缺。恢复采用合作写者的持久epoch/短停写和已接受前缀，区别于L04的schema升级主轴；新接受事实与修复/前向补偿均须保留。

先做公开小闭环的完整可达参考和独立逐身份checker，再组合版本冲突、乱序、未知ACK、修复中/提交前后故障、并发投递与切换，逐一保存真实进程/SQLite/HTTP原件。监测按明示时钟/窗口/分母与阈值实际注入和恢复，不靠告警文案或sleep凑时长。交付还要事故证据链、修复映射、重算报表、操作/恢复决策与代班复跑。完成整链后才写完整原子rubric/多质量锚点及reference/error资格，独立冻结后才新候选；当前mini及历史20叶均不自动变成全题评分。


## 20:42 UTC接续状态：L05 mini独立关闭，L06继续真实CPU工作

L05单层独立审查最终mini_protocol_locally_qualified_no_current_substantive_blocker、blocking=[]。唯一source-only冷复跑整体6.194199秒/内部5.754852秒；独立24项SQL逐身份/载荷/receipt/真实首次POST失ACK顺序通过。另两错误控制真实5.116847秒、五个checker CLI错误（同总额错身份/缺项+多项/重复身份/交换receipt/expected重复）和14项新HTTP边界均按明确错误/状态通过。数量分属重叠层，不能相加称统计样本、专业校准或难度。全部自有服务/worker已终态，不重复原40。计划/执行原件、原库和源封存L05/evaluator/independent-review/originals.zip，当前六执行源与原快照同一；只认可明确合成USD mini，完整L05/正式rubric/候选/小时仍未完成。

L06 Task在20:40:39仍active。最近60真实模型HTTP请求全部streaming、gpt-6.1-sol，最后reader在20:24:47已EOF但原生tool part仍running；这不能当模型挂起或有效LLM思考16分钟。独立读取真实tool part和自有PID链，正在执行其自然生成的docker run CPU优化命令；容器l06-refined-main、CID59907a5e8513aa2c8c53bed2eb10b11eeb397814575789408a112bde1efbed27，20:24:48.321Z启动，精确绑定本候选project、networknone/已验依赖镜像。20:42:32真实CPU799.83%、275.8MiB，仍有有效计算；尚无异常/终态或候选成绩，不取消/重启。--rm自然退出自动清理后以原生工具exit/output及候选结果封存，不能因容器不存在重跑。八核CPU时间不得换算成数小时候选墙钟，当前小时资格仍0/10。

六旧昂贵容器重新inspect仍Paused，未恢复/重启；当前只这一组候选CPU工作。listener/Inspect继续存在，3600只观察无活动，若观察器停止而此类真实CPU仍有效必须调查/接续观察，不能cancel。下一轮先按动态定位看Task及该实际子工作终态；封存后同冻结rubric清洁执行/实际图/独立评分，再顺序fresh Codex。其他九题按完整现场预案推进，合同冻结1/10不等于十题完成，心跳ACTIVE。


本阶段最终docs:check通过351 ops/26 groups，新增L05六Python语法、五JSON、两个ZIP原件完整性及11相对链接通过，仅包装检查。功能以真实HTTP/两个库/自有进程/独立冷复跑与错误控制为依据；没有生产代码修改、没有新Provider/LLM smoke或GPU恢复。三个共享索引只暂存本任务hunk，其他视频/旧图删除、CSS和其他架构改动完整保留。本范围提交后正常fetch/merge、审查完整待推集合并push；目标未全成、心跳继续ACTIVE。


## 完整现场独立审查归档与下一实施决定

完整预案单层独立审查已封存[full-scene-design-review](../../artifacts/2026-10-29-heavy-workbench-long/cases/L05/evaluator/full-scene-design-review/README.md)，结论construction_decisions_proposed_not_implemented_not_approved；不是mini复测或完整冻结。原三个矛盾和条件性算术例完整保留。下一合同选择：最高revision多载荷quarantined且有效贡献0，唯一更高版可解除；settle非负整数/cancel0；批准调整进入本地和远端目标，用户注释只保留。单USD合法账户域提供已批准不可修订opening事实和真实post/receipt，全部允许负调整（包括后续注入）须满足O+Σmin(0,a)≥0，而不只检查原顺序/最终和。业务来源与冲正parent资金来源分离；负调整可以消耗同租户opening/其他正post，保留原开账事实/receipt不等于要求parent余量永远原值。

epoch只在本地事务阻止旧generation新登记，不能撤回已飞行HTTP。合作旧程序所有wire动作必须先以唯一载荷持久登记，暂停线性化取得有限完整key集合；通过查询/同键POST让每项达到确定原receipt，再按固定accepted前缀与旧真实effects前向补偿。包括晚到旧请求及ACK未知；缺键/身份不确定明确保留中止，不猜新key。原parent须同租户正post、累计旧reversal合法且可拓扑执行，故障最终解除。新旧接受与修复前缀分开，已接受重试可查询原结果，不能由stale推断从未接受。

后续先做真实旧程序生成的完整小现场、source-only可达参考及独立逐业务/调整来源checker；两种正确即时/延迟posting图均须通过，冲突先到先得/失ACK换key/回备份漏accepted作为三个真实错误控制。不能匹配参考ID/路径/中间动作数。再补完整职业交付与原子rubric/审查冻结，当前尚未实施。其间L06真实试跑暴露共享运行时问题，已按全入口审计并修复，[独立资格](2026-10-30-heavy-workbench-tool-liveness.md)不改变本mini或完整题完成度。


## 完整现场第一闭环：修改前Recall与实施计划

本轮已先查Git并重读长程/L06/L04/横向/工具活动Recall、L05完整计划审查及当前effects/worker/checker。原L06仍有效冷求解，不重启/取消；不并发新昂贵任务。已有mini只按不可修订effect身份正确投递，不能表达accepted传输与可修订业务的区别；完整现场审查指出最高版冲突、负调整资金域和旧HTTP切换三个构造条件，已选定闭合语义，尚未真实实现。搜索L05全部Python/文档，仅mini service/worker/checker与历史证据，没有当前revision/opening/adjustment/epoch业务实现。原H05历史旧稿不复活；本轮只新增benchmark私有整链资格与明确draft合同，不改生产Task/Mission/Session/UI/凭据/数据库协议或冻结L06。

唯一当前接收方仍为public/l05_effects.py，真实HTTP请求复用现有l05_worker.request，不复制另一个网络协议。新author scene程序为资格参考/可运行旧现场制造器，旧错误入口显式只用于生成不可变原现场，不是生产fallback。旧账schema从一开始保存完整accepted journal、opening/approved adjustments/notes、不可变posting载荷/来源和稳定receipt身份；原错误projection/全局business去重是调查对象，不能覆盖accepted事实。新参考在原库上暂停旧generation、结清全部旧intent原键receipt、按独立定义的最高版折叠逐来源补偿，然后恢复高generation；先只认证顺序无进程故障闭环，后续受控HTTP在途/epoch并发/真实中断另取证，不能拿本轮顺序执行认证全部并发。

第一原始实例明示合成：A/B复用业务X；A/X有最高版冲突，B/Y撤销，A/Z已接受而未投递；A负调整/B正调整与注释保留；两个opening真实post。旧程序实际投递A/X首次commit丢ACK，原receipt/请求事实由服务SQLite保留；不预灌假effect。后续解除冲突、迟到低版、新撤销、新调整和新注释走正确接口。参考接受两种合法posting资金分配/中间更新策略，checker独立用SQL分组重建业务目标、逐来源归属/实际receipt/冲正parent余量/原事实保留，不要求参考ID、posting数量或精确轨迹。先用确定小实例手算、真实HTTP与source-only冷执行证明基本可达，再加入三错误控制及单层独立审查；无小时/全L05/候选分声明。


### 首轮顺序闭环及独立真实反例（修复前）

主方先真实生成原库0.9367秒；同一原现场两正确源码冷执行1.3642/3.2783秒，14/19 postings、最终A1130/B510；三个真实错误控制及独立checker CLI分别得到最高版冲突错误、换键产生未登记远端effect、恢复备份丢accepted/绑定/来源（后者总额仍正确）。11实际CLI预期exit均对，所有自有服务自然stop。原远端A1100/B570，1015/710是修复目标，不能混同。单层reviewer仅一次newest/deferred冷复跑1.621727秒/17postings通过、158独立SQL/手算核对，确认epoch2/active1、NUL全文、旧receipt及跨source资金parent，仍发现两真实checker错误通过，不能因正确参考通过就批准。

反例1：只删新posting本地payload的kind/reverses，checker仍success；根因逐payload已有键与receipt比较，未验证字段全集。同语义横查scene deliver_one也有此subset比较，若GET已有收据会接受不完整local wire。原mini checker先用完整可信expected、entry payload整体相等比较，不走本地任意subset，本缺口属于新scene两消费点；生产Task/Session/共享调度无此路径，原service.decode已完整字段/类型/唯一键验证。修复复用唯一public effects.decode，并核row tenant/event_id与wire一致，checker具名posting_wire_invalid而非崩溃/假pass，deliver返回明确本地wire错误。

反例2：新posting boundary_seq=-1/epoch=-1仍success；当前只检原行不可变，漏新行治理字段。修复认证本顺序资格的公开合法范围及business来源在boundary之前已接受：epoch1原切片内、epoch2从原切片到最终切片，非负整数。不能一律要求所有新post epoch2（repair暂停期仍epoch1），不能匹配参考posting时点/ID/数量。调整approval完整因果日志与真正并发栅栏仍待完整现场，不据此宣称全时序证明。保留两原失败与当前executed-source-a，修后仅必要checker/损坏wire真实消费复验，不重复完整冷跑或旧40mini。


修后producer/checker复用public完整wire解码、联合身份绑定及本顺序范围的epoch/接受切片检查。单层独立复验两原坏库得到posting_wire_invalid/epoch_boundary_invalid；三正确14/19/17图继续成功，另唯一自有接收方实际合法consumer confirmed、缺字段/联合身份错位均具名ValueError，正常exit0。主方只补五次既有结果checker CLI，未重跑完整HTTP/cold或原40。独立最终author_schema_sequential_constructive_qualification_accepted_after_checker_repairs、blocking=[]，五执行源直接与最终快照一致；全部原失败/旧源/修后原件归档evaluator/scene-independent-review及qualification/scene-main。只认证顺序作者schema，完整L05/并发在途/进程中断/全因果/逻辑导出自由/监测/职业交付/全rubric/冻结/小时均未完成。

下一最便宜有增量的实验是合作接收方真实HTTP before-apply握手：旧已登记wire实际在途，暂停/截取完整旧集合后，同键恢复可先拿确定receipt；随后释放旧HTTP应原键replayed。必须实际证明本地epoch不撤销旧socket、暂停只禁止新登记及原facts保留，之后再做修复前缀/进程中断。现有service只有drop-once，尚无该握手；需要修改唯一service并审全入口/必要正向回归，不能用mock/文本替代或宣称已通过。本轮先封存当前顺序版本，L06已自然终态进入唯一基例评估侧CPU冷复跑，不并发新长求解。


## 在途HTTP握手：修改前分析与实施方案

本轮先查Git/全部Recall，L06唯一评估侧基例仍有效计算，不新开solver/GPU。顺序资格已提交push4172af983；真正缺口是尚未将旧已登记HTTP停在服务apply之前与pause/同键收敛并发，因此没有证据证明epoch安全不依赖“旧socket已结束”。这不是已观察到的产品调度异常；新实验是检验完整场景合作假设。全L05源码搜索只发现唯一public effects服务、mini/counterexample/scene三个CLI启动器和decoder导入；它们都用stdin stop关闭，不存在生产Task/Mission/Session/模型路由调用。当前HTTP语义/数据库effects+receipt同事务保持；UI/凭据/产品schema/队列不适用。原服务只有drop-once，无法拿真实握手替代sleep/HTTP stub；pause/resume在scene_app.repair中内联，不能单独观察线性化切片。旧源已保存外部source-before。

拟改唯一服务：增加只属于评估侧的--hold-once TENANT/EVENT，在静态decode后、apply前，仅第一次匹配请求通过锁领取一次真实停点，stdout发含PID/联合身份的held事件，等待评估者stdin release；正常stop/EOF必须先释放held请求再关闭并join。此是实际HTTP故障注入，不指导LLM选工具、不新增LLM路由/隐藏消息或第二接收方。GET和第二个同键POST继续正常处理；late旧POST在释放后走同一apply，必须获得replayed及同receipt。hold只限一个服务进程的一次实验，和持久drop-once消费明确区分，不能声称重启自动保持hold状态。现有无hold模式/stop合同保持，非法operator控制具名回应。

scene_app抽出唯一pause(db,epoch)/resume(db,epoch)共享业务primitive，原repair调用它们；pause在同一BEGIN IMMEDIATE内验证epoch/active、更新暂停并读取accepted边界/完整当前intent目录，receipt更新可继续，新接受/intent登记按旧事务guard拒绝。resume只在同epoch暂停且所有已登记intent有确认时推进更高代。该局部receipt不冒充跨进程恢复checkpoint；未来完整审批/并发日志仍须实现。保留所有原accepted/posting字段，不能把暂停当旧HTTP远端栅栏。

实验只复制同一真实original-input到新目录/receiver，另一个真实自有sender进程沿原pending键发请求。收到服务before-apply held后，先独立GET unknown；调用pause，验证切片完整及旧epoch新请求paused/已接受重试duplicate，随后原reconcile/resume沿同键先获得确定receipt并完成目标。release旧HTTP后让sender自然返回，独立核late replay/原receipt一致、逐来源/原事实和control终态，再走旧epoch新请求stale。无随机race、睡眠、假响应或用户进程。先主方一完整新interleaving及一次必要无hold既有路径回归（非重复旧40），再单层独立审查/唯一必要新目录复核。结论只覆盖这次受控并发，在途多故障/修复中进程退出/监测/职业交付/完整L05冻结仍未认证。


### 在途首轮与EOF真实失败后的修复前分析

主方新interleaving1.4318秒自然exit0，原键先applied、late旧HTTP随后replayed，同receipt/初修复1015/710及原事实通过；独立一次inflight1.489秒、一次无hold2.066秒和204SQL/原首次drop→GET→replay均过，仍发现EOF真实阻断B01。审查者先持自有SQLite BEGIN IMMEDIATE锁，再EOF释放held请求：receiver PID6968在约0.548秒自然exit0，client实际ConnectionResetError/WinError10054、effects/requests均空，held_request_settled未产生。不能拿主方成功路径或进程exit0包装请求已settled。原EOF失败/source-red均保留。

根因是Python ThreadingHTTPServer显式daemon_threads=True，原finally只join serve_forever线程，server_close只等待非daemon请求线程。已读取实际Python3.14库源码及官方socketserver/http.server合同确认（https://docs.python.org/3.14/library/socketserver.html，https://docs.python.org/3.14/library/http.server.html）；本服务全部GET/POST/hold/drop/stop/EOF共享此路径，不能降为单个EOF偶发。生产Task/Mission/Session与此资格服务无导入关系；mini历史只在客户端完成后关闭，仍支持其已证范围，不能借此认证在途关闭。

不只把daemon改false：当前header/body读取无固定截止，半包会让新join无限等待。拟让唯一server显式non-daemon/block_on_close，并给每个连接在setup武装固定header/body-read deadline：默认20秒，可由同CLI显式缩为正有限值作诊断；到期只关闭接收方向唤醒实际read，完整头但半body明确HTTP408/request_timeout。完成读取/GET解析后撤销并join该timer，之后仍按既有SQLite20秒/有界socket写治理；held是已解码故障停点，stop/EOF先release再server_close join请求。不能用可重置idle替代固定读界，不能让半包无限延长，也不能声称cancel查询就是远端工作已停止。接口变化只属本地合成接收方/评估operator，无产品schema/Provider/UI/路由变更。

修后仅重放原EOF+DB锁探针（确认锁期间receiver仍活、释放后真实201与effect/receipt落库），加真实半body固定截止/408/自然join和必要合法请求边界；不再完整cold或旧40。新read超时只治理单个测试服务请求，不是候选/用户总额度或凑时长。仍不认证任意并发/修复中进程退出/完整L05。


EOF修后独立原探针：receiver81088在持自有SQLite锁2秒观察期仍运行，解锁后旧HTTP真实201/applied/receipt与effect落库，随后自然exit0（2.154秒）；原0.548秒exit0/ConnectionReset/effects空的失败保留不覆盖。最终timer回调只set expired/SHUT_RD，不做输出I/O，避免日志背压卡住timer.join。真实半body用1秒诊断参数得到408/request_timeout，EOF短body422/invalid_request/body_length，随后合法完整POST201、idle连接EOF约1.023秒自然join；fresh首次commit/drop→GET→原receipt replay也通过。公共PROTOCOL已同步固定read窗口/<=60参数与边界，独立只读绑定，未新跑完整cold/旧40。主方同修后六源真实main兼容复验1.9762289秒exit0、原键late replay/逐来源通过，独立只读七项绑定。最终stage-assessment-repaired blocking=[]仅限一个受控在途交错和有限请求收尾，完整L05/任意并发/进程中断/持久恢复checkpoint/逻辑导出自由/监测/职业交付/全rubric/冻结/小时仍未认证。原/修后源码、真实失败、204SQL、冷跑及必要边界归档qualification/inflight-main与inflight-independent-review。

最后将重复可执行默认20/上界60提取为同文件单源常量，serve/CLI/guard共同引用。独立只读内联完整AST与原fixed快照相同，并对最终字节另启动一个自有receiver：ready默认20、真实POST201/SQL effect及receipt对应、正常stop/exit0（0.946989秒）。原EOF/body测试仍绑定原执行源，当前常量重排关系单独说明，不伪称旧测试逐字节执行新文件。CONFIGURATION-FINAL-ADDENDUM及配置合同/源对象在inflight-independent-review及ZIP，未再跑旧套件。

## 最新Recall：L05整题交付，开发合同9/10

用户纠偏先交十题完整成品/真实测试最高优先。L05本轮由原真实旧事故两个SQLite/ACK/NUL notes到真实在途旧HTTP、固定accepted prefix/完整旧key目录、确定receipt处及计划提交后两次进程故障、原repair_id持久续接/前向补偿/epoch切换、迟到原receipt重放、新业务/两个接受者/双sender/服务重启、持久监测/零分母与三CSV/实际图/自含复建/运营移交全部真实运行。只操作自有进程、原料只读/networknone/1CPU，无Provider/凭据/UI/用户进程。跨系统副作用是本题主测，不重L04迁移。

原件D:/opencorvus-benchmark-runs/l05-full-case-20261031；最终main绑定closed-main-final-base/results/run + closed-main-amount/tenant，weak绑定原三closed-weak；另一合法newest资金策略与真实保数据改名outgoing_live也实际native0，无兼容postings对象。三控制最终A/B1130/545、1153/545，新租户另C360；初修复1015/710，新增真实B/W35不能套旧B510。最高冲突0/高唯一解除，业务source与资金parent分离，不要求参考key/动作数。

一次集中整审l05-whole-case-independent-review-20261031从原SQL/实际请求/完整wire/收据/切片/monitor独立重算，唯一额外cold11.1992800s；主/独立均实际看图。六真实缺口集中修：active_json数组；actual UID/PID隔离矛盾设施优先；完整自身持久plan/wire绑定；旧cut边界/计划key的epoch；三CSV完整语义；执行器不再直接依赖candidate.postings而用冻结原wire的sender。另静态20s旧sender对多个合法90s调用有时间区间冲突，只有owner-held sender显式None，普通app20不改；未复现实际超时/未做21s慢探针。当前最终base实际走None/held/release/replayed，native11.3013694s，wrapper11.6293706s另计。amount/tenant/weak/独立原cold保原helper字节，不回写成新源全矩阵。

原五反例/旧checker/初评、schema原阻断、partial内层continue导致误读stage、首缺monitor_after判断均保留。只读原对象复验后，已观察失败/依赖未执行/设施错误明确分开，未交或未完总分null。JSON等价重排正向控制通过，不用词法/参考ID做门。六错误programme真实进同checker；最高冲突先到、换新key、提前确认、恢复备份、全局传输dedup、伪监测均具名关键失败。

20:14:53Z单层独审允许仅devmetadata冻结，权重15M75+5H25=100/critical/90与原事实不改。主方实际check_l05 CLI接同三run和5真独评：reference100/20pass/allcritical/goodtrue，weak94/H02criticalfail/goodfalse；不是模型候选分。L05/0.2.0-dev FREEZE、规范public/完整软件/可读报告图/原件ZIP在cases/L05。旧mini/scene/current-source仅历史退役，不重旧40/204/EOF。

当前9/10完整开发合同，有效候选小时0/10、真人专业/统计成熟未认证。无新增活跃LLM/solver/独审；六旧昂贵容器只读核Paused，不恢复。下一直接完整L01：先已有权重便宜重算独立PDE误差/残差/条件质量与合理可达，study_complete与solution_reproduced分开，方法分不补质量；不按现误差倒填宽线/匹配非凸精确轨迹，不自动恢复五GPU。之后履行L02/L06真实双100已触发的另版升级与必要fresh区分度/有效小时，旧public/rubric/分数及退休API只读不重开。所有未完要求保留，心跳ACTIVE。

本轮范围commit/正常fetch merge/审全待推/必要验证/push；精确Git与外部publish-delivery.json才是推送收据。保用户overlay/删视频图片/索引排序/Bun等foreign改动。
