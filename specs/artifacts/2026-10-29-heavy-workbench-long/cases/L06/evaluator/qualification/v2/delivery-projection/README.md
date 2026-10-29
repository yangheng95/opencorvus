# 10个派生交付叶的只读primitive

`current-source/l06_delivery.py`只检查C01、C07–11、D03–06，不评分其余37叶、不认证源码运行/最优性/全部rubric，不出总分。完整逐叶adapter仍pending。它从冻结原始packet和原始控制动作调用唯一`check_l06.evaluate`，任何候选库存声明都不供物理状态；可选库存声明另由D03与实际递推比较，不误报成物理缺料。

`initial-nine-cli.zip`保留初9条真实执行和源，`final-eleven-cli.zip`保留增补库存声明后的11条实际CLI/收据/完整输入输出与固定源；分别约2.92/3.04秒。两轮不是新候选或重跑solver。后者实际覆盖：

- 完整49032.9策略对应的summary/ledger全部10叶通过；精确小数与非最简分子/分母也同值通过。
- 保持期望成本正确、把base.minimum_cash_minor改成+5369，只C08真实失败；费用账错误映射D05，可选库存错误/坏形状映射D03，其他独立完整叶可继续评。
- 缺ledger为相应4叶candidate_incomplete；概率布尔为C11 candidate_incomplete；坏计划依赖为10叶blocked_candidate；评估侧原材料重复报价为run_invalid/exit3。候选失败原因和评估器故障不混分。
- 两周手算融资例独立常量锚点：收款[0,10]、应收[10,0]、现金[−5,4]、运营成本7，完整CLI10叶通过。

共享JSON reader只新增显式decimal_numbers参数：默认原有限float合同保持，summary选择Decimal按JSON十进制精确读取。不依赖浮点四舍五入容差。所有状态均来自真实CLI，固定100分评分与其他叶仍须完整执行器；这些fixture/局部输出验证不冒充全任务source-only复跑。

独立agent又抓到极大合法JSON指数使Decimal构造InvalidOperation逃逸、exit1且无收据。共享reader现统一捕获DecimalException映射具名输入错误，`decimal-repair.zip`保留修后固定源与3条真实CLI：该边界变summary candidate_incomplete、正常精确小数通过、默认1e999仍plan_json。原11CLI/原失败独立源不覆盖；最新当前reader与已执行版本分别保留。

`initial-public-contract.zip`保留独立审查前42叶/任意CSV账草案，后续修成固定ledger/summary/run语义与47叶，权重仍100。叶数变化不是难度提升；summary覆盖、错误状态及无solver算法公平性是合同修复。专业多质量盲评/评分一致性仍未完成。
