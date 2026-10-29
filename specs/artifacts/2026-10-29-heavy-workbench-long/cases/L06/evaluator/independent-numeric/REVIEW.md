# L06 30数值叶：独立局部复核最终记录

认可修后实现对当前注册基例的**30数值叶局部资格**。本轮发现的两处P1参考完整性漏洞已修复，并用原反例真实CLI确认；在已审范围内无尚未修复的实质阻断。**不批准全47叶grader、完整源码交付链、数值变体、盲评、重型冻结、小时级或十题完成。**

本报告审查的是冻结输入/数值谓词/依赖/错误合同，不给候选打分。初轮6源码、原始错误通过的完整输入/引用ZIP/输出，以及修后6源码和实际重跑分别保存在source-initial/、runs/与source-repaired/、repaired-runs/；没有覆盖原件。

## 审读与独立方法

已读最新Recall、check_l06/l06_input/l06_numeric/l06_delivery/l06_packet/qualify_numeric六源、公开资料、47叶及唯一registered-reference。候选normalized仅用于A组投影，业务公式从权威raw编译结果取数；基例公开事实与现有封存input/full.json逐值一致。未将候选自报的库存、现金或成本放入实际业务状态。

自己用标准库实现独立采购/生产/库存/费用/延迟回款与条件策略核算，从原公开事实及既有47808计划生成测试ledger/summary，不调用被测expected_delivery生成期望。对多重违例逐家族重算，独立判定B/C物理结果与依赖状态；未调用solver、Provider、GPU、Docker、UI或用户进程，也未再次委托。

代码仍只有inspect_plan中的一套业务递推，evaluate/旧CLI从其结果返回首个具名错误。先校验完整控制张量的形状与非负整数域，再收集每一可计算语义残差。原始金额、库存和大整数仍参与精确算术；diagnostic_value只在错误证据呈现中投影大整数。没有添加第二个优化模型或备用业务状态。

## 本轮实际结果

初轮**13次数值CLI**中11个预期合同通过；两处参考漏洞真实表现为不当通过。另独立运行一次旧business CLI的大整数例。修后只做受影响的**10次必要数值CLI**及**4项共享decoder直接合同**，全部按预期。每次实际argv/退出码/耗时/stdout/stderr/JSON均在相应目录，不用脚本总退出码代替子项结果。

| 路径 | 独立实际观察 |
| --- | --- |
| 注册47808基例 | 30 verified_pass、17 unassessed；total_score null、business_success null，未把numeric完成写成整题成功 |
| normalized目录属性错误 / bool冒充整数 | A01或A03 verified_fail；业务与C06仍按权威raw正确核算，已知critical失败使business_success false |
| 同时多物理违例 | 独立B03/B06/B07/B08/B10/B11/C05等结果与采集器一致；B03非法使MOQ/容量叶blocked；资金与质量blocked |
| 零动作 | 履约失败；质量和派生财务blocked，未因负库存带来低费用或伪现金而获分 |
| 手算两周期 | C=7，现金[-5,4]、应收[10,0]；信用4仅C02失败，零销售回款时仅C03失败，另一现金叶仍按真实计算；C06均因业务不可行blocked |
| 可选库存误报 | D03 verified_fail，B08和C06仍verified_pass；没有把声明错误当实际缺料 |
| 未注册独立数值输入 | reference_input_unregistered/run_invalid；不是候选物理0分 |
| 可行但成本49032.9的策略 | 修后C06 verified_fail，物理/资金与输出保持正确，非整体业务失败或假装无解 |
| 全部CSV行序改变 | 修后当前public与注册封存数据按语义同一，30叶通过；不是字节/hash门 |
| Decimal、非最简分数、默认有限数 | 修后合法表示正确接受；超大Decimal指数得到具名候选错误；默认1e999计划被plan_json捕获，非原生异常崩溃 |

多重违例的独立代数结果保存在independent-multiple-violation-oracle.json。资金叶使用显式terminal context；未解析where文案猜期中/期末。inspect_plan对不完整可执行策略的scenarios、expected_cost_exact和expected_cost_minor均为null，direct API实际核对见multiple-inspection-summary.json、zero-inspection-summary.json。

## 两个真实P1及修复

### 1. 注册路径可与待评输入一起漂移

初版load_reference第79–80行只读取当前case/public/inputs与args.input比较，未使用已声明的input_identity.captured_input。独立副本保留原registered-reference和封存ZIP，仅把该副本public的A/R0单价25→24并按新公开数据生成规范账，原代码仍exit0/30pass，用原L47380给新成本47729、gap349/47380判C06通过。该输入是未注册语义变体，不能只因两个当前目录相同就复用旧界。

完整真实失败在runs/reference-target-drift/及case-reference-target-drift/。这不是对用户/候选服务的攻击实验，也不主张候选能改私有评估目录；它验证评估侧资料/注册漂移必须被检测。

修后使用已有captured_input指向的封存ZIP成员，通过唯一decode_json和validate_instance解码，去除明确的status/qualification_variant构造元数据，再分别与current public及args输入逐值比较。原反例现在exit3，reference_public_input_drift/run_invalid；独立args变体仍reference_input_unregistered。完整11CSV行序反转仍通过，证明这是业务语义身份检查。

### 2. 将负gap当成质量通过

初版第133行直接对完整可行成本计算gap<=maximum。独立相同原输入/可行47808策略，只将其自有注册副本的所谓下界改100000，原程序对负gap−1631/3125仍给C06 verified_pass/exit0。真正可行C低于所谓下界表示参考/模型矛盾，不是候选获得超额质量分。

原错误通过在runs/reference-bound-contradicted/及case-contradictory-bound/。修后只在完整业务可行后检查C<L，返回reference_bound_contradicted/run_invalid，原反例exit3、无候选成功判定或总分。没有将参考错误扣给候选。

这两项修复没有引入hash验收、第二份当前业务输入、兼容回退或候选路由；封存输入只证明界对应的不可变业务身份，当前业务数据仍唯一来自公开raw。

## 大整数与旧入口

真实JSON输入为4300位正整数包装数，乘公开包装×体积系数后诊断量超过Python默认十进制输出限制。独立numeric CLI现在exit2，B05 verified_fail、C06 blocked；旧business CLI也exit2/supplier_capacity。投影为large_exact_integer、bit_length14289、sign1，独立精确乘加所得bit_length相同。未提高全局整数解析上限，未舍入/截断控制值，未将错误输出渲染异常当候选通过。

原多重物理检查收集全部残差，同时保留家族前提：非法truck_on不会因乘出额外capacity被奖励；财务须物理/信息/终期条件可执行，质量须完整业务可行。比较的是实际控制动作，optional库存只是D03投影。

## 认可范围与剩余事项

本轮可以认可：注册基例上的30数值叶适配与所列正常/错误路径的局部执行资格；已有唯一数学递推的逐谓词审读；候选/设施错误及参考矛盾的明确分流。不是对任意输入的形式化完备性证明，也没有重新证明原生CP-SAT下界；此前明确的trusted-native-bound政策继续适用。

仍有**17叶未评**（执行/独立人评），其中关键D01未实现，所以30叶全过也不能推定business_success true或发布100分。完整47叶grader、raw→求解→全部机器账/图表/报告/README/manifest的独立源码冷复跑、数值变体独立注册、专业/多质量盲评、真实两系统重型试跑及有效工作时长均未达成。不能用此处24次局部CLI或既有参考计算替代这些证据。

主方提出的整数后端替换在其他文件，未纳入本次数值审查或认可。本轮未修改主仓、未操作暂停容器、未读取凭据/隐藏推理。Git状态已记录；全部写入都在本自有外部目录。
