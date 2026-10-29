# L06公开合同与输出primitive：独立审查最终记录

认可修后公开合同的**局部设计收敛**、原材料的无损事实投影以及**10个输出叶primitive的局部资格**。本轮发现的具体P1问题已修到文案或实际错误合同，未发现尚未修复的同范围实质代码阻断。**不批准完整47叶grader、重型L06冻结、1%参考资格、候选成绩或小时级声明。**

原42叶和修后47叶逐项审读分别保存在 [LEAF-REVIEW.md](LEAF-REVIEW.md)、[LEAF-REVIEW-REPAIRED.md](LEAF-REVIEW-REPAIRED.md)、[最终47叶矩阵](LEAF-REVIEW-FINAL.md)及对应JSON。矩阵是要求/证据/实现缺口审查，不是候选评分。初轮snapshot、后续snapshot-repaired与snapshot-final分开，没有覆盖历史。

## 独立事实与可实施性核对

以公开DATA语义自己实现标准库投影，不调用l06_packet构造期望值。11CSV+facility的**557个规范标量（含格式/业务ID）**与来源full.json全部业务字段同值，差异0；只排除来源明确的status/qualification_variant构造元数据。目录index和联合键覆盖完整，不依赖CSV物理行序。行数为原料4、产品4、产线2、供应3、情景3、报价12、routes8、BOM16、需求192、供应容量144、产能96。

从自己快照的公开输入实际执行5个packet CLI：原包、全部11表反转行序、A/R0单价25→24准确单字段投影、重复报价→packet_invalid、缺需求行→packet_invalid，全部按明确输出/错误合同通过。输入完整性、时间/单位、BOM、非预见性、阶段物理仓容、购买时点付款与4周延迟回款、末周成品0/现金非负和期末AR在公开稿中都有依据。尚未发现完成基本物理计划所缺的外生业务事实。

另将此前已独立核验的49032.9动作**不变**用于已声明的降价输入，真实业务checker仍可行，费用244642/5=48928.4。该对照只证明当前价格下降保持旧动作可行；不证明其变体质量，也不要求正确策略必须翻转。输入变体尚需独立可达/质量参考，不能把loader能变价当反缓存或策略泛化已通过。

这批“原始材料”是明确声明的合成规范事实拆表，资料分散本身不是职业难度证据。实质组合来自采购提前期/包装/共享供应、BOM/产线/阶段仓容、现金与共同前缀。不能用文件/行/叶数量推断数小时。

## 发现并收敛的P1问题

| 初轮具体问题 | 修复与独立确认 | 当前边界 |
| --- | --- | --- |
| C01只看期望成本，summary场景成本/min/finalcash/AR/概率可误报而无明确叶落点 | C07–11逐字段新增；原mincash改成+5369的真实CLI现在仅C08 verified_fail | 这些新增叶已进10叶primitive；完整47叶仍无grader |
| 任意ledger CSV/manifest定位不足以客观解析；summary有限数值精度不定 | 固定l06-ledger/1、l06-summary/1及字段/维度；JSON小数字面量按精确十进制，等价有理分数接受 | 无隐藏CSV列名；实际全部adapter仍待实现 |
| 机器依赖缺失统一unassessed，候选缺交与设施错误未分 | candidate_incomplete/blocked_candidate为0、固定分母；run_invalid不发布整次分数；critical必须实际verified_pass | 已真实验证缺ledger子集状态；完整依赖图/评分器仍需实现 |
| 允许任意算法，却要求原生solver状态 | algorithm终态独立、无外部solver的native_solver可null；自写算法可得终态分 | D08不在这10叶primitive内，未来需真实执行证据适配 |
| 原料/产品数值属性未在A组明确归属 | A01显式包括volume/holding/initial/hours/sales等全部目录属性 | 文案覆盖关闭；A组候选projection grader未实现 |
| plan可选库存声明错误与物理动作混在primitive中，评分落点不明 | D03明确接可选库存；operational_decisions只取原控制动作，库存由唯一业务递推算，声明单独比较 | 实际错值仅D03 verified_fail，错shape仅D03 candidate_incomplete，其余9叶通过；未误报缺料 |
| 输出根与源码项目根相对路径混用 | manifest在新输出根、outputs相对新输出根且在根内；README源码/依赖相对源码项目根 | 路径文案明确，真实manifest/replay适配仍待完成 |
| 人评half统一“部分正确” | 12叶均改为各自可观察的部分条件 | 仍未做多质量样本双评分/专家校准 |
| 新Decimal路径超大指数触发未捕获异常 | 真实1e9999999999999999999触发Decimal.InvalidOperation、exit1/无结果；共享read_json捕DecimalException为InputError后原反例真实exit2、summary6叶candidate_incomplete/ledger4叶pass | 原失败/源码保留；未用工具崩溃当候选物理失败 |

最终47叶仍为100分，27个critical共65分；12个人评叶共24分。叶数增加没有新增成熟度含义。business_success与总分分列，文档/方法分不能抵消关键物理/现金/质量/执行失败。

## 新10叶primitive的真实独立运行

仅评C01、C07–C11、D03–D06。自己从公开输入和既有可行控制动作生成全部ledger/summary：到货、完工、BOM耗料、阶段峰、逐供应体积、逐线工时、四类费用、回款、现金及“累计交付销售额−累计实际回款”的AR，未用expected_delivery生成期望夹具。手算二周例另由原始小包重新投影与独立递推得到AR[10,0]、收款[0,10]、现金[-5,4]、成本7。完整主实例AR公式48周及3个期末值另有51项核算通过。

初版9次真实CLI中8个常规合同通过：独立完整交付、原mincash反例、精确小数/非最简分数、可选库存值、可选库存shape、手算AR/现金、账费误报、缺ledger。第9次超大指数真实复现exit1，原命令/输入/stdout/stderr和source-initial完整保留。5项直接reader正向合同也通过：默认1.25为float、显式Decimal模式精确1.25、默认1e999/NaN及重复键映射具名InputError。

修复只改变共享l06_input的DecimalException捕获；其他四份工具与初版相同。使用独立source-repaired再实际执行必要的3个CLI，全部通过：原超大指数→exit2并输出明确候选状态；正常Decimal→10叶pass/exit0；默认reader的1e999计划→plan_json/10叶blocked_candidate/exit2。没有重复求解。详见 `delivery-review/receipt.json`、`repair-assessment.json`、`commands/`、`source-initial/`与`source-repaired/`。

该部分验证的是标准库输出投影和具名错误，不验证程序是否真正训练/求解、是否从源码完成全部交付、最优界是否可靠，也没有评估其他37叶或发总分。当前私有checker一处业务错误仍可能阻断后续计算；完整评分器必须按已公开依赖状态处理，不推定未执行的约束为通过。

## 冻结前仍必须完成

1. **C06参考资格和注册**：为基例与所有数值变体注册有效正L及证据种类，独立核验可达C≤1.01L。当前快照lower_bound仍null。实时或新取得的native incumbent/bound必须另做终态/业务/界审查，不能直接更新本次合同结论；原生数值界不等于有理dual证明。
2. **完整参考交付与清洁复跑**：实际仅从公开原始CSV/JSON与源码生成normalized/plan/ledger/summary/run/manifest/report/真实图表；独立执行者按README完整复建。known-plan夹具、10叶输出checker、S06小smoke和旧normalized模型求解都不能替代这一链。
3. **剩余37叶与聚合器**：实现逐叶字段/约束/执行证据适配、candidate/blocked/run_invalid依赖图及固定分母/critical规则。机器结果不要只靠文件存在、声明日志或“最终checker成功”给所有叶分。
4. **变体可达及反投机范围**：注册到底只判可行还是还判质量、相应参考和允许变化类别。选择能识别错误输入依赖/缓存失效的对照，但不得强迫正确不变策略变化。行重排只是身份稳健性，不证明新决策能力。
5. **人评校准和真实图形**：12个具体half文案只是起点，需完整参考和多质量交付的独立双评分/分歧裁决；F04实际打开图形，不能以源码/图名代替。基线允许真实不可行，不能暗加参考特定策略；E03应接受准确的约束解释，不强迫没有证据的因果故事。
6. **正式环境与新候选**：冻结真实运行环境/权限/依赖/角色模型与资源记录，保留总token/总墙钟null政策。实际fresh候选与比较之后，分别记录准备、有效活动、数值计算、环境等待；本轮不提供小时级证据，不以后台参考计算充作候选工作。

本次未启动solver、Provider、GPU、UI、用户服务或容器，未恢复暂停任务、未再次委托，未读取隐藏推理或凭据，未修改主仓。全部写入只在本独立外部目录。根目录当前报告及machine assessment可归档；任何后续参考质量终态应使用追加记录保留本轮快照与失败。
