# 研究协议与计算合同

protocol.json是阶段、边界与参数的唯一注册值。问题是模拟成人工人在培训后8–16周的迁移任务表现，相对常规练习的0–100点均值差（正值代表较好）。只纳入注册为成人、simulator vs routine、individual lottery或classroom lottery的研究；alternating intake weeks不是随机。先筛设计/人群，再取transfer_score；没有该构念时可取同构念transfer_errors并反向。满意度不是替代结局。相同构念取最接近12周，等距取较晚，不能取效果最大者。只用末次水平，不混变化值。

索引仅标来源身份/发布时点。HTML的Registration record和注册原文构成报告族；同逻辑原组(endpoint,week,arm)在截止内按correction > appendix > full_report > abstract，接着revision、released_at取最高；若最高完整rank仍有不同统计，材料未定义唯一值，设施须保留冲突并明确更正后才评分，不能给候选0或私自择较好结果。注册文件定义设计/角色/随机人数/cluster，报告表提供观察组统计。输出必须保原report_id/表id/row_id；另一个截止内原文确实支持同一当前组事实的引文同义，不能因作者偏好定位而扣分。correspondence.csv是有时点的原始往来：certain_same是明确同队列，possible是未核清重叠。主分析的连通分组内，先保primary角色，再最早注册日、再registry字典序；筛选记录保其他研究，效果可计算但不独立计权。possible只按保守分组用于主分析，另作assume_distinct敏感性；不能称重叠已被证明。

先将均值和分散度换到0–100点：points乘1、proportion乘100；transfer_errors乘−1使MD正值为好（组均值可以写成负的错误点，不必虚构准确率）。SD的组均值方差为SD²/n；若原文为SE，先SD²=SE²*n，再方差。NR不是零，缺一组方差则保not_estimable，不从p值猜SD。观察n不替代随机n的失访事实。

同研究多治疗组共享同一对照：把全部eligible治疗组合并成一个比较。N=Σn，均值m=Σ(n*m)/N，合并SD²=[Σ((n−1)*SD²)+Σ(n*(m_i−m)²)]/(N−1)。只使用一次对照，MD=m_T−m_C，v=SD_T²/N_T+SD_C²/n_C。独立个体适用此式；本档cluster均等大小，按注册m用DE=1+(m−1)*ICC乘v（均值/SD不再改）。报告ICC用原值，未报告ICC按注册主约定.03，且必须明确是imputed；敏感性只将未报告ICC改为0/.10，不改变已报告者。这个近似不证明小cluster下置信区间具有精确覆盖。

主分析用固定逆方差w=1/v，MDbar=Σ(w*MD)/Σw，V=1/Σw，95%区间MDbar±1.96*sqrt(V)。Q=Σw*(MD−MDbar)²，I²=max(0,(Q−(k−1))/Q)，Q=0时I²=0。规定DL随机效应作为敏感性：tau²=max(0,(Q−(k−1))/(Σw−Σw²/Σw))，再用1/(v+tau²)合成和同样正态区间；不能声称随机模型治好偏倚。k=1时Q/I²/tau²=0，k=0为不可估，保留状态。

每阶段必交main_fixed、random_DL、exclude_high_attrition、icc_zero、icc_high、assume_distinct，以及对main全部研究逐一留一。high_attrition指选中随访合并观察人数/注册随机人数<.8。allocation concealment与assessor事实如实摘录，未报告保持未知；此规则不是完整RoB2/GRADE工具或因果/确定性评级。

效应、方差、权重、Q/I²/tau²等量可交精确有理字符串，也可交标准软件的有限JSON数；不要求大整数或分数库。名为*_exact的字段提供精确保留能力，不把它作为超出数值精度需要的门槛。量字段与有限数区间统一按abs(actual−expected)<=1e−7+1e−8*abs(expected)核对；人数、身份、布尔与null仍须原类型。等价未约分串合法。主/敏感性正确不要求统计显著。更新逐研究列纳入状态/来源/MD/v变化与总体变化，报告不得将旧阶段倒写为最后更正版本。更正/新研究改变后同源码必须重新做提取到结论。
