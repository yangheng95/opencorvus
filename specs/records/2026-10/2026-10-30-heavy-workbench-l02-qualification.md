# L02：按发布时间投影输入的低成本资格

## Recall

用户目标是10个真正重型全链路任务、可执行严格rubric、单层独立审查及OpenCorvus/fresh Codex横向比较，两好则升级。最新“从便宜的实验开始做”优先，无用户总token/总墙钟额度；不能用等待、重复或数据/叶数凑小时。当前冻结仍只有L06；其原Task已自然完成，基例/报价评估侧冷计算通过，唯一行序容器b6754c...还在运行。先查Git并读长程/L06/L05/L04/工具/横向Recall，保护无关改动，不启动新完整solver/GPU/Provider/UI或用户进程。

本轮已读九题独立设计H02、旧H02题面/计算合同，搜索当前long各Python/JSON，没有L02当前实现。旧题392单序列/4切点/3指定基线缺发布版本和物理信息边界，全部未来CSV给程序后仅靠自述不能证明合法as-of（按当时已知信息）预测。旧题的作者总token/墙钟/CPU额度不移植；后续用户指令覆盖它们。旧20/80评分与所谓8–32小时未校准估计不当新成绩。

## 修改前分析与范围

直接问题是业务发生时点和发布时点混为一体：修订值、当时发布的未来协变量预测和事后实测可能被同时读取。根因是输入交付一次包含全部未来，checker只看模型自报max_time；改变模型或多加报告不能根治。新接口须由评估侧逐origin投影，只把合法快照交给实际预测程序，未来目标/原始完整vintages留在worker之外。已知未来日历/预测与事后观测分别有公开发布规则，不能禁止所有未来event_tick来误伤合法信号。

先做明确合成整数tick解析小例，不声称完整研究数据或任务冻结：t0..6的10+2t在origin7已发布，t3的999修订在release9才出现；合法线性预测为24/26。日历和当时温度预测可覆盖未来，事后温度实测在release8不可给origin7。未来数据扰动保持所有合法历史同值，应得到语义相同输入；同一确定参考在两个真实隔离进程中预测一致。相同预测不是普遍无泄漏证明，须同时核真实输入投影和挂载。

只有benchmark私有评估工具/公开draft信息合同受影响。无生产Task/Mission/Session/LLM路由/队列/配置/数据库迁移/UI/凭据变化；实际工作进程只是标准库Python数值程序，不是新LLM执行器。只用已有依赖镜像和Docker primitive，1CPU微型worker、networknone/readonly源与快照、新输出，无原完整vintages/targets/旧答案挂载；不与行序控制并发长求解。所有结果仅局部能力资格，不计十题完成或小时。

## 实施与验收方案（执行前）

1. 唯一投影实现明确release_tick<=origin、观测event_tick<origin、known-future协变量按变量注册类别、不同revision的权威与缺测含义。当前tick是合成日界，不假装已定义真实时区/ISO数据；完整任务另补多系列/修订/迟报/单位/层级/内外选模范围。
2. 参考只从快照选择已发布最高revision，再以标准库Fraction做普通最小二乘，不硬编码24/26。评估侧独立SQL重建许可行与手算误差；泄漏快照加入未发布修订/事后实测，应被具名availability_violation，不按文件名判断。
3. 两个原始未来版本投影origin7，分别实际Docker执行同封存源码；核readonly实际挂载/网络/新输出/自然exit和预测24/26、last22/22的解析MAE3。origin9只做发布时间边界投影，确实允许新修订，不将合法但可能质量差的修订误判泄漏。
4. 独立agent一层审查/有限新目录冷复核与错误输入挑战，禁止再委托、新完整solver/Provider/GPU/UI；保留所有失败，修根因后仅必要重验。公开接口/来源投影/预测数值不等于真实研究质量、统计可靠性或全L02可达见证。
5. 新spec与产物同步三个索引和目录README、当前docs:check；本任务范围提交，正常fetch/merge/待推集合审查/hook/push。L06行序自然终态时优先封存/核算/独立D02/真实聚合，然后启动已注册fresh Codex，不能被本资格搁置。

## 初跑与独立格式反例

主方两个实际1CPU/readonly快照/netnone worker合计约6.1秒，精确OLS预测24/26、解析MAE0、last22/22 MAE3；修改未发布未来后快照与预测一致。晚修订/事后实测具名availability_violation，伪造origin具名assigned_origin_horizon_mismatch；origin9确实允许999修订。原件在D:/opencorvus-benchmark-runs/l02-asof-qualification-20261030/main。这里只是局部解析可达与信息边界，不是完整L02成绩。

独立审查实测三个假通过：revision_id的0→False、release_tick的1→True及calendar值1→True，checker均exit0/projection_verified。原件与初源保存在D:/opencorvus-benchmark-runs/l02-asof-independent-review-20261030/initial-probes，不覆盖。根因是原raw严格校验而snapshot行直接用Python dict/tuple等值，bool与int同值，因而没有证明事实类型身份。影响所有snapshot表/索引/值，不是单一字段或预测算法问题。当前checker是唯一消费者；投影本身产出整数，worker仅读已验证快照，无产品/数据库/LLM/UI路径受影响。

修复仅让snapshot事实复用唯一validate，然后仍以独立SQL重建许可集合；不复制schema、不开fallback、不用字面文本/摘要验收。修后独立重放原三个真实CLI错误，分别应为input_invalid/row_tick或valid_value，并执行唯一独立微型冷worker及必要新修订/缺测边界。主原始6.1秒执行属于初字节，不能冒称其已执行修后checker。

## 最终局部资格与下一步Recall

单层独立agent已实际重放原三个CLI：revision/release的bool得到input_invalid/row_tick:observations，covariate值bool得到input_invalid/valid_value:covariates。修后唯一独立1CPU/netnone/readonly微型worker自然exit0、24/26、MAE0对照last MAE3，完整15项核算合计4.483秒。新最高版本missing例的旧值999被明确缺测取代，参考真实18/20；再减少合法历史时输出execution_failed/insufficient_history:S。所有自有worker自然终态后精确移除，原失败/原初源与修后源/argv/inspect/新预测都保留。

独立最终REVIEW/stage-assessment/final-source-identity明确blocking=[]仅限本小原语，四当前源与审查快照逐字节身份只绑定实际执行版本，不当功能验收。资料在cases/L02/evaluator/qualification/main与independent-review，原完整ZIP保留初次审查脚本路径错误及三个真实假通过；不把工具首失败算候选业务错误。未启动额外完整solver/Provider/GPU/UI，没有候选分数。

下一步须从完整多系列研究问题出发建设原始发布/修订/单位与实际时间资料，给出逐origin程序接口、外层预测与内层选模隔离、点/区间/聚合质量与决策/复跑交付，独立完整参考和具名错误对照进入全rubric后才冻结。当前信息边界原语不能证明完整L02可达、专业/统计可靠性、难度或数小时；不要重复这个小cold凑量。整体冻结1/10、候选小时资格0/10。

L06已于00:27UTC取得实际完整OpenCorvus100/100后才启动fresh Codex /root/codex_l06_fresh（fork none、同18public、禁止再次委托），动态定位仍L06-current-pair-20261029.json；后续先看其真实状态，不启动重复候选或旧API。基例/报价/行序评估侧已全部自然终态封存，不再重复solver。


## 本轮实施前方案：完整UTC原始材料与唯一解码（未冻结）

### Recall与修改前分析

用户仍要求十题/严rubric/独立审查/真实双系统，两good升级，cheap-first、无总token/墙钟额度。新鲜Codex L06仍独立运行；不得给其本文或任何答案。已重读所有相关Recall/根AGENTS、H02独立设计、L02四源及公开原语合同；全仓范围检索l02-vintages/asof_input/known_future未见另一L02材料或解码器，specs无嵌套AGENTS。当前只有7时点合成原语，缺真实UTC、完整研究材料及预测目标网格，不能冒充完整研究题。

直接缺口是材料和任务规模/机制尚未实现，不是原投影数学失败。保留唯一asof_input/check_projection，不复制第二投影；新decoder只把严格UTC/单位CSV恢复为它们的整数事实（固定2022-01-01T00:00:00Z起的整数小时，绝不按全未来时间点排名）。这样未来发布日期改变不应改合法历史的坐标。core仍不解释每日目标网格，本轮只建设材料/解码/逐origin权限审计，不将原range(origin,origin+h)预测器用于这些按24小时步进的新目标，也不声称完整冷预测已通过。后续统一演进正式snapshot/target-grid及参考/选模接口，旧解析代码仅作已明示原语资格，不能成为全题fallback。

影响限L02私有材料生成/解码与公开研究材料草案，无产品Task/Mission/Session/路由/队列/LLM/数据库迁移/UI/凭据变化。无新模型候选/GPU/完整solver；标准库生成、解码、独立CSV/Decimal/SQLite审计应秒级。原始材料/所有失败和实际字节封存外部新目录，不能覆盖之前微型资格。

### 当前建设决定

- 原创且明示合成的2023-01-01至2025-12-31日度计量需求，4leaf站点/2zone；zone真值为两leaf之和，层级关系固定公开。绝不伪称真实客户/公用事业数据。业务区间为UTC自然日[start,end)，event_end是次日00:00，发布时间均canonical UTC且整小时；origin是日09:00，预测未来14个完整UTC日，首个完整未来日是origin次日00:00起的日区间，目标end从后天00:00起逐24小时。
- 每leaf事件有初报rev0（通常end+2h，部分迟报）、rev1（end+7d+4h）、终审rev2（end+21d+6h）。有可定位的迟报/缺测/修订；最高已发布版本为权威，最新missing不可回填旧有效值。隐藏评估真值是独立终审量，不按候选误差修改。原单位L/m3逐行明确、按Decimal精确转整L；部分站点发布格式在历史中改变，跨更改发布的同一事件各revision可有不同unit，不能把当前unit倒套全部过去。
- 外生变量分known_future的日历/当时温度forecast/已宣布运营安排与observed的事后temperature_actual。天气forecast有每次issue和valid_end；未来实测留评估侧。站点A2停用及A1承接安排先在真实announce时刻发布、后生效，完整原始档案可含这些未来事实，但public开发包和逐origin快照只含当时已发布事实；静态catalogue不预告未宣布停用。另有未提前宣布的局部需求机制改变用于漂移研究，不要求猜隐含参数。
- 公开开发截止2025-01-01T09:00:00Z，开发origin为2024年6至11月各15日；外层2025年1至12月各15日09:00，h14。每outer的inner origin为其前112/84/56天同一时刻，最后内层目标end+终审发布均早于outer；decoder须实际验证该许可，不能只说前缀。开发时点之后已经发布的开发标签允许在公开开发包内用于回测；外层2025受测标签只在评估侧。每个worker的特征仍严格按其origin投影，不能把开发包的最终修订带到较早origin。公开的是规则/日期/开发已发布资料，不含外层未来目标值或DGP参数。
- 生成器是私有作者事实源，decoder是唯一公开格式→规范事实入口，既有asof是唯一投影。独立审查从CSV/单位/时点逐行计算规范值、SQL许可集合和开发截断；不能只调生成器的同一函数当oracle。机制作用至少有实际旧/新修订数值差、迟报在origin前后改变许可、跨单位同一事件换算一致、事后实测与当时forecast的发布差、宣布前后运营信息差。

### 原则与后续完整合同（本轮不宣称已实现）

滚动预测依据作者[时间序列交叉验证说明](https://otext.robjhyndman.com/hyndsight/tscv/)和[教材](https://otexts.com/fpp3/tscv.html)。区间拟采用Weighted Interval Score（WIS，加权区间评分），公式与恰当性依据[原论文及其更正](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1008618)，后续在完整评价器用独立手算和错误对照验证。选模须真正inner快照隔离，outer结果不能反选超参；研究零提升与预测质量分列。点/区间质量底线、站点权重/归一化、统计重采样/依赖、专业交付及全rubric均需完整参考/坏对照/单层独立审查后冻结，不预写任意提升阈值或以数据量/切点数当小时证明。

验收先为材料/decoder实际CLI和逐origin独立许可/单位事实，再由已授权reviewer单层新目录一次必要冷生成/解析并挑战机制/数据身份，禁止再委托/新LLM/solver/UI/用户进程。完整研究pipeline/最终参考与评分类仍未完成，不重复旧微型cold。资料新增同步三索引/相关README/docs:check，范围提交/fetch/merge/待推全集检查/push。


独立实施前审查发现两项真实合同矛盾，未执行原grid或据其给分：09:00的origin配次日00:00 target_end其实含已过去9小时，是nowcast而非完整未来日；开发公开release截止2025Jan1必然含Jun–Nov开发标签，不能同时把开发标签全称私有。修为首个完整未来日从次日00:00开始、首end为后天00:00，并明确开发标签公开回测/outer标签私有/每origin特征权限三层不同语义。旧计划矛盾与初两源保存独立计划审查目录initial-grid-source；无数据/候选成绩被覆盖。独立72个日历配对手算证明新grid内层终审到outer最近余量483小时，仍有可达性，不为修正而扩大网格或计算。


首个完整材料实际生成/解码成功：1096业务日、4leaf/2aggregate、13152观测vintage、37632协变量vintage、54个origin；开发合法release截断得8660/26524行。生成+两解码合计约6秒，纯标准库，无forecast/solver；行数不当难度。封存源/argv/stdout在D:/opencorvus-benchmark-runs/l02-full-materials-20261030/main。

主方主动实际挑战发现decoder把origins.csv提供的truth_lag_hours当事实：把一inner改到outer前20日并把lag写0，真实终审release仍晚于outer，但实际CLI exit0/materials_decoded。初源与反例raw/decoded/收据保留initial-probes/understated-inner-label，非候选错误。根因是只算元数据日期边界，未核权威原观察rev2的真实release，且调用端没有明确archive/development身份，无法正确区分开发有意缺outer标签和完整archive缺真值。

修复前影响审计：新decoder唯一函数/CLI及本轮三收据是全部消费者，无产品/其他case导入；旧asof/check_projection/历史原语不变。增加评估侧必传role=archive或development，不从文件自报scope推断；development每事实须release<=开发cutoff、公开开发目标需实际终审。archive各开发/内外origin每leaf目标必须有rev2有效量，实际release不得超过声明上界，inner再逐原标签实际release<=父outer。规范值仍只从raw解码，标签核查不把它们写进worker快照；未知/缺失具名input_invalid。新接口替换原无role调用，不保留fallback。修后重放原失真lag应truth_release_bound错误，并实际跑新完整/开发解码、合法延迟与错误发布时间合同；独立新目录用CSV/Decimal/SQLite核验。


独立唯一source-only cold后新增两个真实P1：完整archive只把输入time-axis的开发cutoff改为2026Feb1，以外部role=development仍exit0，根因为授权截止仍由被核输入自报；另一L值6236.0000000000000000000000000000001被Decimal默认28位上下文在乘单位时先舍成6236，再整数校验而假通过。原源与probes-initial/{self_declared_later_development_cutoff,inexact_decimal_litre}原执行保留，均非候选失败。

修复影响分析/决定（实施前）：全部当前生产入口只有本轮材料builder/decoder/CLI，既有asof及其正确数学不变。新增唯一evaluator/material-contract.json作为评估侧注册的clock/cutoff/单位/grid/终审协议来源，builder和decoder必传--contract，public clock/units仅为从此导出的可读资料，decoder逐语义匹配注册值后才使用。不得从input clock更改授权，也不新增猜测/双读fallback；配置从builder重复字面值收拢到单一合同。数量用Fraction对已限制为plain decimal的字符串精确求值，换单位后分母必须1且范围合法；不使用可能已舍入的Decimal乘法，不用增大context掩盖精确性。注册合同与原允许语义保持相同，不改变现有材料或任何分数。实际复测原两个反例应registered_clock_mismatch/quantity_integer_range；再合法多尾0小数/元数据漂移/真实label晚发布等必要合同，不重复旧toy或全预测。原54投影与核心不变，用实际原材料身份绑定有效范围；新builder当前字节仍须实际生成/核同一，不能仅凭静态替换声称已执行。


独立数据覆盖审计另观察到两项，当前未评分/未冻结，不掩盖为原先预期：移到完整未来日后，每origin/zone只有13/14个目标有当时已发布weather forecast，末日原lead14不存在。明确将末日预测协变量缺测保留为公开条件，允许合法外推/缺测策略，不能偷用次日issue或实测；不会对不存在的信号要求固定提升。原每月15日outer没有窗口跨7月1日，不能声称outer测了提前应对。现预先修材料采样合同，将6月outer换成6月20日（同日09:00），使合法已宣布计划到生效的跨期确实进入外层目标；其3inner随父日偏移，其余50origin不变，无候选结果用于此决定。

日程也进入唯一注册material-contract.schedule，builder从唯一expected_origin_rows生成，decoder按身份/完整字段与外部注册日程核同义，CSV行序自由。不能允许输入自行移动outer或换role来改变实验；这是评估输入完整性，不是LLM流程门。新材料仅origins.csv四行变化，DGP观测/协变量/时轴/单位应与现有真实源同一；实际新生成及4增量投影/真实标签/跨生效运营事实须重验，原50输入/54旧检查保留而不冒称新54重跑。后续完整研究/预测质量及小时依旧未认证。


## 本轮最终材料/decoder资格与接续Recall

最终独立blocking=[]仅限材料/解码。唯一新目录初cold10.003s，独立从CSV/Fraction/UTC全量重算13152obs、37632cov及开发8660/26524，原54与独立SQL匹配。天气issue检查自身timedelta.days丢-6h产生首false，原件保留；局部按完整UTC比较后2192组过，不是材料/候选失败。两独立P1用原CLI实际具名拒绝，中间注册版9CLI15.781s属于其中间8源，不冒称最终字节。

最后注册日程演进后，主方实际新builder/两role decoder exit0；新增4origin真实投影5.178s。独立复制最终源/原材料/收据，只做6必要decoder CLI和4实际core/独立SQL/真实label/运营跨生效，共23项11.535s通过，没有第二次生成或重跑原54。14个非schedule文件/full canonical同一、50grid继承；4新grid明确新验。当前最小inner终审余量483h；June20运营A2.open为10个1+4个0，A1.transfer_in相反；weather最后目标明确未知。全部源/失败/原收据在full-material-main、full-material-independent-review、full-material-plan-review及ZIP，当前源8py/唯一合同与执行快照直接身份绑定，不把它当正确性测试。

当前只有原始材料、单源注册/精确解码及发布/完整未来日grid资格，不是全L02、研究模型或候选成绩。下一步应统一正式worker的daily target-grid、逐inner/outer物理输入及选择权限，完成baseline/扩展/真实消融、点/区间/层级指标与低质量对照、研究报告/决策交付及完整原子rubric，完整冷参考和独立审查后才冻结。旧toy预测器不适用新grid，不能改名当full参考；不要重跑本轮生成/54/微型cold凑量。整套冻结仍1/10，小时资格0/10。

最新Codex L06已自然完成，完整554文件/Git/未跟踪原件封存，HEAD eef74425dcd9b9d6e161c9aa303b38c90f400e25；01:25:16Z是观察/封存收据时间，接口未给精确native终态时刻。主方冻结raw独立30numeric全部过，17执行/人工及实际私有两控制还待，不能预判good或触发升级。唯一评估侧Codex base源码冷执行oc-l06-codex-eval-source-20261030-base/CIDb8af7d5f558d6c64923b19b4fd344df99cd6261e4795b3467c4b507cfcd80dbb于01:26:50Z启动，无旧输出/参考/评估器/凭据，readonly12源/冻结raw/new results/networknone8CPU，同准备镜像和原README默认阶段参数。动态定位L06-current-pair-20261029.json；先读其真实终态，不重跑/取消有效计算。自然完成后封存/30numeric/新图，再顺序注册报价和行序；同冻结独立17叶与真正l06_grade之后，若也good才另升新版本。


## 下一实施前方案：每日worker、真实内外层选择与适当指标

### Recall及影响审计

继续十题/严rubric/单层审查/双系统，两good另升版本，cheap-first且无总token/墙钟额度。先查Git/AGENTS及全部Recall；L06 row仍是唯一完整solver，待自然终态先封存/数值/新图/同冻结最终审查，不并发重复；OC100、Codex当前46pass/D02未评/totalnull。L02当前材料资格不等于研究执行。已搜索current-source的worker-packet/study-contract/WIS/quantile/selection：只有素材target_ticks，没有正式worker/metric/selector；旧OLS按小时range不能复用成每日参考。

新实现限L02评估数值接口，不改产品Task/Mission/Session、Provider/LLM路由/队列、UI、凭据或数据库。唯一asof投影保留，worker packet只映射其许可业务键到原始CSV行，不再实现第二个发布过滤器。完整canonical/未来labels只在评估侧，worker只挂readonly源码+本次合法packet/config与全新output，networknone；不同origin新进程/新输出，不能读别的worker成果。模型选择是实际数值selector程序，不是教LLM选工具的host gate。允许任意正确语言/方法，初参考使用既有Python/NumPy成熟环境。

### 开发信息与回测的新增根因分析（实施前，尚待独立审查）

当前公开开发截止2025Jan1，而首outer的inner在2024Sep–Nov。尽管runtime快照正确，作者从公开开发包可见这些inner的后续标签；若再把它们当盲内层验证，或把公共全期拟合权重塞worker，会使内层研究结论失真。outer2025仍私有，但不能由此夸称inner盲。拟在任何L02候选/分数前将公开开发截止移到2024-08-01T09:00:00Z，并把6个公开探索origin改2023Jun–Nov15；其终审皆已公开，明确只探索不计外层成绩。全部36个inner在新开发截止之后，固定inner112/84/56d和12outer保持现有日程（June20不变）。原full观测/协变量不变，只重导出开发子集和6开发grid；原48不变grid可精确继承，新6必须实际查验。此前材料/错误/资格全部留档，注册新值前先独立计划审查，不在看模型成绩后改信息边界。

量纲尺度固定来自2023终审量，取在2024-02-01T09截止已发布的该年leaf日量均值，zone尺度取同日leaf合计均值，至少1L。这早于开发封包/所有盲inner/outer，是公开历史尺度；必须逐实际release证明，不能从outer真值归一化。public开发包可用于探索算法/固定先验，但worker拟合与特征统计只读本origin合法历史；不能携带来源晚于origin的预训练状态。

### 正式协议拟定（本轮范围）

1. 每次预测packet含注册target_ticks（14个、24h间隔）、固定clock/静态catalogue/hierarchy/单位/可用类别，以及唯一asof许可的原始vintages。不能同时给规范答案供候选绕过单位处理，也不含role/outer标签/他origin评分。origin ID仅在私有receipt中；origin时间本身合法可用。程序/config声明在候选交付完成前冻结；每次实例真实执行，不读旧输出。
2. 点输出明确为条件均值，用固定历史尺度的标准化MSE作为选择指标（RMSE/MAE只作解释）；WIS另用中位数和50/80/95中央区间。mean必须按leaf相加保持zone一致；不强求分位数相加，也不强迫mean等于median。每个series/target恰一行，全finite、非负、分位点单调；合理浮点表达接受，使用有界Decimal→Fraction精确读数，舍弃超长/极端指数需具名prediction_invalid，不能让默认Decimal舍入造同值。均值一致性容差公开为1e-6*max(1,abs(parent),sumabs(children))。
3. WIS按alpha=.5/.2/.05，w0=.5、wk=alpha/2，除以3.5；leaf与zone各占一半，层内等权、时点等权，再inner origin等权；所有权重和尺度在study合同/公开manifest，未知质量底线不填值。参考[原WIS论文](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1008618)及[层级预测教材](https://otexts.com/fpp3/hierarchical-forecasting.html)，引用不替代真实手算和错误对照。
4. selector是候选的真实进程，只拿本outer之前已发布的inner预测及终审label/固定尺度/候选config池；future outer labels不挂入。模型池至少2个有科学区别的已声明配置以真正选模，但不强迫无意义大网格或强求输出不同/提升。初合同min标准化MSE、同分按稳定ID字典序；独立checker从实际inner结果重算，不能只信selection.json。选后outer每种基线/扩展/消融同一合法snapshot实际预测，最终selected标记必须一致；报告零提升可得方法分，质量分/critical目标独立。
5. 协议/指标先用明确解析锚点和必要真实隔离进程闭环，再立即做完整注册矩阵参考，不循环同toy凑量。锚点y10、mean12、median11，50%[8,12]/80%[5,15]/95%[0,20]，MSE4/WIS6/7；零点退化区间WIS10。两leaf真值10/20、zone30，means12/20/32，leafB median20且退化20；zone median30（允许不等于子median31），区间[27,33]/[20,40]/[0,60]，在各scale1、两层各半下MSE3、WIS13/14。这是待实际验证手算，不伪称已通过。
6. 当前只先实现packet/指标/选择原语与真实隔离代表闭环；完整baseline/扩展/消融、盲inner→outer全矩阵、点/区间质量底线、多质量审查/专业研究交付、全rubric与数小时验证仍须后续真实结果，不能以新字段/配置数或计时冒充完成。新增/改spec同步索引README/docs、保留所有反例/版本，范围commit/fetch/merge/待推审查/push。


手算例在实施前改用leafB mean20/zone mean32，避免用低于其分位点积分必要下界的均值作概率示例；最终层级MSE3、WIS13/14。mean/分位点只作边际预测，WIS不能认证联合路径分布或跨站点相关性；研究报告需明确这一边界。所有质量阈值仍未冻结。

独立计划初审指出2023尺度直到2024Feb1才完成发布，晚于拟2023探索origin；因此固定尺度仅评分侧及不早于该公布时刻的2024+selector可读，2023预测worker不得拿它作为晚发布先验。明确scaled_mse=((mean-y)/s)^2、scaled_wis=WIS/s；增加sA2/sB5/sZ10的手算锚点MSE27/100、MAE7/20、WIS5/28，防止原scale1例无法区分错幂/漏尺度。完整失败分母固定，缺失/错误预测不跳过origin、节点或方法来选模；设施问题无研究成绩，需要具名修复重验。初实施真实15个metric CLI/2个直接手算共20断言2.074秒通过，仅指标原语。

主方追加极大指数JSON实际发现新CLI设施缺陷：1e9999999999999999999999在Decimal构造阶段抛InvalidOperation而非ValueError，原source-initial进程exit1/traceback且没有结构结果，外部oversized-exponent-initial原件保留。根因是共用read_json新增精确数值模式直接把Decimal作为parse_float，CLI只捕获原JSON/InputError；所有精确模式消费者当前仅新scorer，既有材料合同/decoder默认模式调用点已全查，不能在单一探针外包字符串补丁。拟在唯一JSON reader把Decimal构造异常映射InputError(numeric_json)，候选forecast由既有独立读取边界映射prediction_schema_invalid；facility合同错误仍run_invalid。保持默认reader行为、没有fallback或产品/调度/UI影响；仅重放原巨大指数和必要合法decimal/材料decoder正向边界，不重复全54/生成矩阵。

修后原巨大指数实际exit2/prediction_schema_invalid、合法精确decimal指标一致；共用默认reader的真实材料development解码8660/26524/54通过。首个增量脚本把已知目录development-public写成development导致ENOENT，原命令保留，随后按原收据精确路径执行，不当代码修复或候选失败。独立另发现真实P2：study.interval_metric改raw_wis仍exit0且实算scaled_wis。根因是新声明进入合同后，load_study仅验证point_metric而漏同义interval/公式声明；唯一scorer/CLI及本轮测试是全部调用。实施前决定将已支持的mean/point/interval及公式语义在唯一load_study明示校验，冲突为facility_study_invalid；不是评分候选错误。只重放原P2与合法非unit锚点，不重复完整材料/既过20项。


## 最新接续Recall：新公开信息边界和指标原语完成，完整研究仍待

独立计划/metric审查blocking=[]，21手算+初6CLI/修后2CLI分别绑定源；原raw_wis假通过保留，当前facility_study_invalid、合法非unit2/4/6得11/36,5/12,19/84。主方极大指数原source-initial异常保留，修后同反例具名prediction_schema_invalid，默认reader真实材料decoder通过；首增量路径ENOENT也保留不当候选错。资格在study-metric-main及study-protocol-independent-review。

唯一material-contract现cutoff2024Aug1、dev2023Jun–Nov，实际新build/两role decode过；完整6静态/数值源文件/fullcanonical和原同一、48内外grid同一，6新dev实际唯一projection/SQL过。新public6823/21934，全部36inner在截止之后；1460真实2023终审Feb1前已发布，四leaf精确均值与zone相加尺度存新assessment。主首脚本把6个series含aggregate当都有观测，assert失败保留；complete_delta按catalogue四leaf/层级补核，不重做生成/原54。新包和旧原件均封存，材料仍未冻结；尺度不交早期worker。

下一代表闭环应包含一个完整registered outer及三个inner、两科学配置真实隔离worker→实际selector只选既有ID→outer，私有outer标签不反馈后续改参。固定缺失/失败分母/配置资格规则须先注册，均值MSE与边际WIS/质量critical分开。之后完整矩阵参考/坏对照/研究决策交付/全rubric/独立冻结，尚无完整L02或候选小时。L06现在真实两100已触发另升0.3，旧冻结不改；整套仍1/10、小时0/10，心跳ACTIVE。

最终增量独立L02材料35项2.079秒通过，仅6新开发origin的core/SQL，未新build/decode/旧48矩阵/forecast；8个public ZIP成员与实际开发一致、9个当前源/尺度/发布事实核同。首validator assert只有主方当时工具输出，未捕获原生terminal文件，后补observer收据明示来源，独立审查不称已读该原生文件。L06/0.3计划和17项小机制也无当前数学阻断，完整新业务/冻结/小时仍未批准。全部候选/本轮评估完整求解已终态，六旧昂贵容器刚实际再次inspect均Paused。
