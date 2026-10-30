# L06 S1 周内核提取：独立实施审查

S1核心数学提取及旧检查器等价范围通过本轮独立源码/原件/廉价运行审查；没有发现会使两份原完整计划、残差收集或首错口径改变的缺陷。当前另发现P2资格工具的实际输入构造错误，下面保留，不将该工具的错误当业务checker或原候选失败。此时不批准整个0.3、在线checkpoint或新case冻结。

## 当前源和调用范围

只读当前qualification/current-source下l06_physics、check_l06、l06_input、l06_numeric、l06_delivery、l06_grade、l06_packet及qualify_delivery/numeric/grading。自有source/保存10原源和旧新diff，source-identity.json记录它们与主方source-final具体对象逐字节相同；这只绑定被审对象，不是功能哈希门。另读reproduce/l06_integer的evaluate调用、BUSINESS-CONSTRUCTION及原独立PLAN。未修改主仓或操作L02实际grade、旧run、用户进程。

check_l06不再保留旧周数学循环。它保留严格实例/动作domain、shape、共同前缀层，逐周调用唯一propose_week；该内核本身仅假设调用者已严格验证dimensions/domain。l06_numeric仍消费inspect_plan完整violations/constraint_checks，delivery及其他消费者仍通过evaluate。三个资格包装都携带新增physics依赖；qualify_delivery移除四个已缺失的隐式旧路径，改为显式业务input/plan和闭式信用卡参数，未新增fallback。旧路径缺失只是静态观察，未伪称执行过旧red。

## 数学/状态判断

* l06_physics.py:14/22/36：initial_state创建post_week/next_week0及绝对周队列；begin_week从原态投影历史到货/到账，不消费或变成checkpoint。propose对原态deepcopy后清当期due，登记本期lead0或未来到货、未来AR，next_week加1。
* 采购按整包单位收费，运费/最低量/跨物料供应容量与下单周绑定；MOQ0空车仍收费。旧单不因到货周新订单容量0而撤销。BOM、共享工时、产线资格、生产前raw峰、交付前FG峰和期末holding顺序与旧代码一致。
* cash只在结算核中间信用/末周非负；恢复态signed cash不经过initial_cash非负规则。receipt lag>=1，当前销售不提前变现金。期后AR保留，raw正单期后到货仍违例；raw余额允许持有，FG期末0由caller另核。
* check_l06.py:73–93：旧诊断允许tentative代数继续，order观察全期先收、physical随后，保持多错first-error次序、where/context/family/count。不可行的scenarios与两种期望成本均None。非法路径负库存/假设收入不成为可信财务。

week_admissible只证明该周内观察；最终FG等终期规则仍由caller执行，不代表可直接发布终态成功。状态仅是内部可信派生，尚无权威历史/prefix一致性或不可信checkpoint decoder；begin对格式/phase/week的检查不构成持久恢复验证。scenario_id只是旧离线定位前缀；未来online必须由公开中性定位派生，不能把私有chosen leaf放进where、异常或收据。S1没有实现/验证该online安全能力。

## 本轮真正独立执行

audit_s1.py从自有源快照运行一次，实际exit0，0.2948112秒；audit-command.json/stdout/stderr保留。138项观察全部通过，不当独立实验样本：

1. 两份原sealed输入/控制动作逐scenario完整账由审查者另写的整数/Fraction前缀算法核算。全部周成本分项、库存/峰、到货/生产/消费/工时、supplier volume、回款/cash、AR、min cash、active constraints与当前及提取前实际保存对象同值同型。精确期望成本分别476871/10和95283/2。
2. 一张独立3周卡实跑cash −1/−1/2、原已付订单在到货周容量0仍到货、绝对AR3仅到账一次；重复begin及proposal不改原态，返回external是副本，末态再次begin映射week_state_phase_invalid。
3. 一个真实checker CLI把晚周shipment_binary与早周两仓容峰违例同时交入。inspect保留三个残差，finance为None；真实CLI exit2/first-error=shipment_binary，where=public-card.week1.S。

这是一次廉价标准库审计和一个真实Python子进程checker CLI，无Docker容器、solver、LLM、Provider、GPU、UI或新候选。原41检查/26CLI、13完整残差比较、两个历史100重评及11投影CLI作为主方实际原件另读，不冒称我重跑或独立实验。

## P2：参数化资格工具将有理数近似误作精确十进制

qualify_delivery.py:44把--expected-cost-exact的Fraction转float，再把这个数写summary并要求全部叶通过。合法概率分母3不必产生有限十进制。本轮新1周三等概率、仅一个场景成本1的可行实例，精确成本1/3；首个full-valid真实10pass，下一“exact-decimal-and-unreduced”传0.3333333333333333，正确业务输出checker判C01 verified_fail/exit2，helper因此AssertionError/exit1。原输入、计划、实际两CLI结果和异常均在fractional-reference-probe及fractional-reference-command.json/stdout/stderr。

不是physics错误，也不是输出checker误拒；是helper自造了不等价的summary。现冻结两原计划的分母/成本可表示，原11CLI仍是其实际对象的正确证据；但显式参数工具不能据此宣称所有合法有理输入都可用。应使用独立有限十进制闭式控制，或从精确有理数的有限十进制性产生真正等价字面值；非有限十进制须保有理表示，不能float近似冒充精确。修后仅需本反例和必要有限十进制控制增量，不重旧11或优化。

## 结论边界

S1唯一tentative数学、原离线组合及诊断/财务mask可认可；P2当前资格工具应修后再收敛其参数化可用性。完整新tree材料、权威完整history、非前瞻政策/实际承诺、持久在线/崩溃/候选checkpoint安全、私有未来隔离、完整0.3参考/质量/rubric/冻结/有效小时均未由S1完成。旧0.2 public/rubric/FREEZE及两原100不改。本审查为同一非盲AI-agent局部实现复核，不是职业专家/统计成熟或十题完成认证。
