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
