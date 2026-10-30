# L06/0.3 完整业务建设：实施前独立审查

结论：方向有实质能力增量，未发现必然不可达的数学矛盾，可推进下述最小提取切片。**不能据此认定完整0.3已可解、已实现、冻结或小时级。** 提取前两个关键歧义已由主方本轮澄清，须进入唯一当前规格；其余状态/信息格式仍应按下面边界落地，而不是直接开始大实例求解。

本轮仅设计/源码/既有原件阅读，无委托、实施、Docker、native、solver、Provider、GPU、UI或用户进程操作；未触碰运行中的L02或其reader。旧L06/0.2.0 public/rubric/FREEZE及两真实100保持原事实。

## 1. 已证源码事实与本轮决策

旧唯一物理源是 `evaluator/qualification/current-source/check_l06.py`，不是另一个current-source目录。`inspect_plan`先严格验证输入/动作shape/domain，核common前缀，再预算每情景全期订单到货/费用，逐周做库存、生产、现金诊断；收集全部violations与constraint_checks。`evaluate`另取首错。不可行时scenarios/expected_cost不发布可信数值，但代数上继续运行以支持多个独立叶的诊断。l06_numeric与delivery还消费这些细分结果，不能仅比较一个feasible布尔值。

本轮初读提出、主方随后明确的两项处理是合理的，当前还只是实施决定：

1. 唯一纯周kernel返回tentative代数下一态、周行、约束观察与violation。旧collector可用tentative继续**假设性诊断**；新在线仅零violation才提交真实下一态。不能把负库存导致的负持有费、未实际交货的phantom收入等当可执行财务。不是两套业务算法。
2. 权威checkpoint只存post_week，初始next_week=0。begin-week是从该原态和本周已发布事实作纯投影，不消费/写队列；advance从原post_week重新算一次，合法后next_week+1、清除本期due并登记新承诺。绝对due-week队列；恢复cash可为负至信用下限，不能套initial_cash>=0规则；AR可期后到期，正原料订单仍禁止期后到货。

旧实现预读整条未来订单计划来构建arrivals，仅对旧离线完整计划是可用计算方式。新权威状态只能从**已经实际提交的过去订单**登记到货，从已经交付的过去需求登记应收；不能直接暴露旧预算的未来动作/收入数组。非法旧诊断的假设值也不能混入线上prefix。

## 2. 周内顺序必须成为明确接口

建议第一版保旧语义：静态价格/提前期，销售回款lag为正整数，初始pipeline/AR=0。不暗加取消、欠交、随机丢失旧订单、lag0销售即时回款或需求满足率选择。若未来要这些能力，需新明示合同/可达性，不能在本次提取中顺带加入。

唯一周transition的输入是静态实体/单位/合同、原post_week、当周权威已发布外生事实和完整动作；它不读未来leaf或候选自报库存。顺序如下：

| 阶段 | 必须发生/观测的事实 |
|---|---|
| post_week(t−1) | 上周结算后的raw/FG/cash、绝对due队列、原已提交prefix、next_week=t |
| begin-week纯投影 | 历史已到期销售回款、历史已承诺本周原料到货，以及全部本周合法公告/需求/供应订单容量/产能。新lead0订单还没产生 |
| 当前决策 | 整包order_lots[S,M]、truck_on[S]、production[P,J]；强制交付需求是确定结果，不偷偷增加可欠交的delivery自由度 |
| 当前采购与到货 | 核包装、0/1开关、跨物料共享供应容量、MOQ、运费；订单周全额付款；lead0进入本周原料，lead>0登记未来due，期后正单报错 |
| 物理执行 | raw峰=旧期末raw+全部本周到货，发生于生产前；FG峰=旧期末FG+全部产量，发生于全部需求交付前。BOM/产线资格/共享工时、非负库存/全交付按旧合同核 |
| 结算/commit | 原料/FG期末持有费，采购/运费/生产费；cash=上期cash+历史到期款−本周费用。中间周>=−credit，末周>=0；合法才提交post_week(t) |
| horizon完成 | FG必须0；raw可剩、无残值并照付持有费；原料正订单不得在T之后到货。期后AR保留为应收，不能变现金，不继续多跑一周“改善”末周余额 |

旧cash只约束结算余额。因lag>=1、历史回款先到、当周各成本非负，可将回款显示在begin projection而保持同一末余额；不要在提取时新增“采购瞬间需非负现金”规则或误把当前销售先到账。供应容量按**下单周**核，旧订单后续到货不会因到货周订单容量为0而被撤销；第一版不能把“停供”换解释成既有订单丢失。

全动作向量和所有单位/索引必须明确；可选inventory声明只作对账，不能参与状态或信息集构造。truck=1、数量0若MOQ=0，旧规则允许并照付运费；不能提取时额外强加“开关iff正数量”。

## 3. 可操作的状态及恢复边界

state至少要能唯一恢复：版本、episode/静态输入身份、next_week及phase=post_week、raw/FG库存、signed cash、已付订单的绝对到货周/数量、已交付销售的绝对回款周/金额、完整实际承诺及观察prefix。累计费用/账可由prefix重建；若随state提供，也是派生字段，不成为另一套可写事实来源。

原prefix是业务事实，库存/cash/queues是其唯一递推投影。候选内部优化状态自由，可完全重求或查表；候选给的state不能修改历史或决定当前处于哪个隐藏leaf。若checkpoint同时含prefix和派生余额，恢复须核一致，不能任选较方便的一份。

begin-week重复读取应得到同一投影且不变原post_week。advance必须接收**原post_week**而非已加到货/回款的projection，避免双加。每次commit只有一个当前week动作；重试/恢复须先查实际已提交next_week/原动作，不能重付或覆写。新持久在线格式是首次baseline，可显式版本化；若以后交付格式演进，仍需保数据迁移，不以“非产品数据库”豁免。

可用于第一切片的手算状态卡（只是建议，**本轮未运行**）：3周、初cash1/credit1；周0订1单位、单价2/lead1；周1生产并交付1，销售价3/lag1；其它成本0、仓容工时足够。post0 cash=−1且due1原料1；post1 cash=−1、raw/FG=0、due2 AR=3；begin2投影cash=2，重复读仍2；一次合法advance后final cash=2、AR=0，总支出2。不能把begin2的2当post原cash再收3变5。这个确定性语义卡不冒充信息树或完整factory资格。

## 4. 0.2等价提取的真正验收

保旧schema验证、common_weeks信息含义、概率及期望成本精确有理数、所有周账字段、终期AR、active_constraints、violations/family/count与first-error契约。0.2在K开始已知整条情景未来；不能拿新0.3逐周信息规则追溯拒绝旧合法计划。共享kernel只管物理，旧前缀约束和新真实history信息约束各属于明确版本的输入/政策层，不做猜格式fallback。

旧loop的order约束是在情景内先全期扫完、再扫物理周；直接改成“每周order→physical”可能改变多个错误同时出现时evaluate的首错。实现可让同一kernel输出带week/family/顺序标签的观察，再由旧collector按原顺序组装；不要保留第二份旧数学loop。至少对已封存具名错误fixture保持原首错/where和完整families，不把“同样不可行”当等价。

主方已在提取前保存 `l06-v03-transition-qualification-20261030/source-before`、两原sealed业务输入/动作/inspection，本轮只读这些收据：OC成本476871/10、Codex95283/2，旧family counts已保。它们是主方约.099秒原checker重算，不是我重新运行或未来kernel已通过。文中的“925业务谓词”是另一历史核验口径；提取应逐family对照当前baseline字典，而非把925当本kernel总检查数或难度指标。

不要为复用改旧public/rubric/FREEZE/两100/旧参考L。先在同一业务计划上比较新核输出与原已捕获结果；无需求解或启动候选。

## 5. 完整信息构造：必须保真的边界

1. **权威观察不是候选node名。** 每周公开给执行者的事实由唯一材料decoder按发布周构造：所有已发布的当周需求/容量/状态、完整过去，以及任何已发布的未来公告/信号。第一版若只发布当周事实，应明确没有其它未来公告；若L/H本身携带未来支持集信息，它就是应纳入history的真实发布事件。不能只核current物理数值而漏信号。
2. **完整记忆。** 曾看过L/H不同、后来当前信号/库存相同的路径，仍可知道不同未来分布，不能错误合并。反之两个raw node标签不同但全部合法观察相同，必须合并；不同标签不等于多了信息。所有显式ID/index与单位需稳定，不能靠CSV行序或候选自报state分组。
3. **状态派生不能洗白前瞻。** 从同一初始状态向前验证：先按实际外生history组节点、核当前完整动作一致，再推进其状态。不能先容许隐藏叶决定早期动作，再以“过去动作/库存已不同”作为以后不受非前瞻限制的借口。
4. **公开支持与实际选择分开。** 完整有限树、所有可能路径/概率允许离线使用。选中的未来路径不能通过argv/env/挂载/目录/seed等提前传入；候选从合法观察推出唯一支持路径是合法推断。不能做禁止所有leaf字符串的关键字门。
5. **分阶段要是真的。** 至少一个第一次揭示后的真实信息集仍含两个正概率、未来业务事实不同的支持路径；再有一次后续缩小及之前的lead-time承诺。若第一次当前事实已唯一识别终叶，后面贴两个事件名不能证明多阶段增量。
6. **概率单源。** 正有理叶质量和为1，条件概率由真实history支持的叶权重求得；若材料同时列条件概率，核其一致，不能两个都自由配置或重复相乘。期望成本按leaf path加权或等价node reach-weight计一次，共同成本不重复计。

在线格式尚需明确实际读取的state/observable-history/action ABI和版本，但不要求特定语言、每周重求、solver内部checkpoint或作者节点ID。低成本隔离资格先比较相同完整prefix下的实际输入/状态，不强求两个独立运行输出逐字相同：合法随机tie-breaking也可产生不同正确动作。若要比较单一政策在两个未来的同prefix动作，使用同一已实现/冻结policy realization或声明的同一随机条件；不要把不同随机实现误判泄漏。

## 6. 最小切片与必要代表计划名单

先只做S1；S2/S3是其后建设顺序，不以本报告批准它们已实现。

| 切片/代表对象 | 最小实际验收（均为后续，不是本轮执行） |
|---|---|
| S1-A 两原sealed完整计划 | 用新kernel组合重算上节OC/Codex原输入/动作，与source-before保存的完整周账、exact cost/AR/mincash/active/family counts对照；旧scalar首错正常路径相符。无solver |
| S1-B 多违例诊断 | 选已有raw/FG两峰旧具名错误样本，或1周lead0下单生产交付后库存0、两仓容0的闭式卡；两峰均报，不能只剩first-error；infeasible的可信scenarios/cost仍None |
| S1-C 包装/装运/能力 | 少量既有具名边界：整包单位成本、合单共享cap、MOQ、truck binary、产线资格/工时；包括MOQ0的空车开关仍合法收费，避免无意收紧0.2 |
| S1-D post/begin/advance | 上节3周现金−1→收款2手算卡；重复begin与合法负cash恢复、绝对due1/due2队列、lead0当周进入raw峰；一次advance恰推进一次 |
| S1-E 终期/账界限 | raw剩余允许并收holding；FG剩余失败；期后正raw订单失败；lag>=T的期后AR允许但不抵cash；末周cash>=0与中间信用分开。复用原样本为主，不做全枚举 |
| S2-A 权威history/state对照 | 同标签不同已知到货/现金应分开；不同标签但同真实完整history应同信息；相同当前状态但不同过去观察保perfect recall；候选inventory声明不能改变节点 |
| S2-B 可达完整policy | 在适中全factory材料上给一个所有正概率路径均物理/现金/终期可行的合法政策，含两后续真实揭示和此前lead承诺；以同一kernel逐path核，不把单个9/2信息primitive当业务可达 |
| S3-A 信息/承诺/质量对照 | 同一物理条件的合法policy、clairvoyant放松、至少一个可执行但高成本的合法替代；错误提前知叶/改旧承诺/错现金/漏峰具名拒绝。新界新注册，不用旧47380 |

可优先复用的已存在原件位置：`l06-v03-transition-qualification-20261030/{opencorvus,codex}/{business-input,operational-plan,baseline-inspection}.json`；旧v2 tiny-solver的instance/plan、full-business-contracts-final完整见证及原具名CLI样本；旧reference全账/报价控制只在需要验证相关提取行为时选取，不重跑其solver/源码搜索。

S2/S3建设必须有完整原始材料和decoder身份/维度/发布合同，而不是只给normalized模型矩阵。先保守构造可行政策，再查信息活跃性/合法高成本替代和适用下界；不因某机制未使动作翻转硬加要求。信息放松界与合法UB之差只有界意义，没有双方最优证明不能称精确信息价值；要归因某成本差给信息，仅放松信息，所有物理/现金条件保持一致。

新实例不可达时先定位现金、峰值、lead/终期及宣布时点是否自相矛盾，保失败材料；不能让候选通过改旧承诺修一个不可能状态。报告说明真正可行选择、未知风险与恢复边界，再做新rubric/参考/执行/独立校准，之后才审freeze和fresh双系统。数据维度、求解器耗时、行数及本次旧两100都不证明0.3小时级。

## 阶段结论

允许推进单一kernel+旧计划等价及post_week状态的廉价切片；收到的phase/诊断澄清解决了初始两歧义，但实现与真实验收尚未发生。当前仍欠新格式/材料、权威完整history绑定、完整多阶段可行policy/账、在线隔离/恢复、有效新界与低质量对照、职业交付/rubric/校准。未批准完整0.3、旧0.2改分、case冻结、候选小时或十题完成。
