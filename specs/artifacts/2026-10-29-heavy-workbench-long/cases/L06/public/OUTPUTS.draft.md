# 交付与复跑合同（审查稿）

项目根含reproduce.py、依赖/构建说明和README。调用`python reproduce.py --input <原始inputs目录> --output <不存在的新目录>`，从传入资料计算并写新输出，不读取既有结果作为求解。其他语言可由该薄入口调用，不能依赖评估端模型/答案。

输出目录：

- `normalized.json`：DATA.md的完整业务事实投影。
- `plan.json`：下述唯一机器计划格式。允许不同的正确策略，不匹配参考轨迹。
- `ledger.json`：按下述固定最小字段记录每场景每周物料/生产/装运/库存/费用/现金和应收。可以另外提供由同一账生成的人读CSV，机器评价只读取规范账，不猜列名/单位。
- `summary.json`：按下述固定字段报告各场景总成本/最低与期末现金/期末应收、期望成本及概率。逐场景报告和期望值分别核验。
- `run.json`：真实执行的输入路径、命令、依赖版本、算法/solver实际参数、终态、可行性及已得界；详见下文。未知值明确null/unknown，不把设施失败/限额状态写成最优。是否分线程、调用子agent及测时口径如实记录，不把重叠阶段相加。
- `report.md`和它引用的实际图表：基线核验、约束与动作的因果解释、费用和现金、运营交接、局限。图形须由交付数据生成；评分包含实际查看图形，不能只交脚本文字或图片文件名。
- `manifest.json`：上述文件/命令与报告依据的定位；不以无意义hash/摘要作为正确性条件。

plan.json对象的`format`为`l06-plan/1`，`decisions`恰按全部公开场景ID索引。每场景记录包含非负整数数组：

```text
order_lots[week][supplier_index][raw_index]
truck_on[week][supplier_index]                 # 每个值0或1
production[week][plant_index][product_index]
```

可另附`raw_inventory[week][raw_index]`和`finished_inventory[week][product_index]`，若提供必须与真实业务递推一致。它们是期末库存，不能代替TASK要求的两种阶段峰值。所有必须的现金/成本由评估者自己重算，不以自报summary或manifest证明物理可行。

## 规范账与汇总的最小schema

ledger.json的`format`为`l06-ledger/1`，`scenarios`恰按公开场景ID索引，每个值为`{"weeks":[...]}`。weeks按0到weeks−1排列，每行有整数`week`和下列字段；金额均为整数最小单位，不使用浮点容差，向量索引沿用DATA.md。

| 字段 | 形状/含义 |
| --- | --- |
| order_lots、truck_on、production | 对应plan同一周的三个决策矩阵/向量，严格同值 |
| arrivals、consumption、raw_inventory | 长度raw数；到货件数、BOM耗料件数、期末原料件数 |
| made、finished_inventory | 长度product数；本周完工件数、交付后的期末成品件数 |
| hours | 长度plant数；本周各线实际使用工时 |
| supplier_volume | 长度supplier数；本周各供应商下单的总体积 |
| raw_stage_peak_volume、product_stage_peak_volume | TASK定义的两个周内阶段峰值体积，各为整数 |
| purchase_cost、freight_cost、production_cost、holding_cost、cost | 本周采购、固定运费、生产、两类合计持有费及总支出，各为整数 |
| receipts、cash、receivable | 本周实际收款、周末可用现金、周末尚未收款销售额，各为整数 |

周t的receivable只包含已交付、但其付款周仍大于t的销售款：交付周k从max(0,t−receipt_lag_weeks+1)到t（包含端点），逐产品需求×销售价后求和。回款滞后为正整数，未来尚未交付需求不计应收。

summary.json的`format`为`l06-summary/1`，顶层`expected_cost_minor`为概率加权总成本，`scenarios`恰按公开场景ID索引。每个场景对象含`probability`、`total_cost_minor`、`minimum_cash_minor`、`final_cash_minor`、`final_receivable_minor`。后四项分别是全周期总支出、全部周末现金最小值、最后一周现金及最后一周应收，均为精确整数。

只有`probability`和`expected_cost_minor`可以用JSON有限数值，或`{"numerator":整数,"denominator":正整数}`；有理数无需最简形式。JSON小数字面量按十进制精确值读取，与公开概率/独立金额精确相等，没有四舍五入容差。例如期望值为1/3时应给分子/分母而非截断小数；整数与有限十进制表示同一有理数均接受。单位不会由显示格式改变，布尔值不当整数。其余必需字段不得用null替代已得结果。

数值超出解析器可表示范围时返回具名候选输入错误，不能导致评估器无结果崩溃；本题正确概率/金额均处于普通整数和有限小数或有理表示范围。

## 运行状态与完整性

run.json至少含`format:"l06-run/1"`、`input_path`、`command`（真实argv数组）、`dependencies`（名称/实际版本字符串的对象）、`parameters`（实际参数对象）、`algorithm`、`native_solver`及`feasibility`（feasible、infeasible、unknown之一）。algorithm含`name`、`termination_kind`（completed、resource_limit、failed、unknown之一）、`termination_detail`（实际观察的原因/事件来源）。native_solver对无外部solver的合法算法可为null；使用求解库时含`name`、`version`、`status`、`objective_minor`、`best_bound_minor`，后两项为有限数值或null。真实完成的自写枚举/构造算法也可获得完整终态分，不强迫选某库。最优性证明另给可核验依据，completed本身不表示最优。

manifest.json放在本次新输出根，含`format:"l06-manifest/1"`，用`outputs`对象定位normalized、plan、ledger、summary、run、report，以及`reproduce_command`真实入口argv。outputs路径均相对本次新输出根，可组织子目录且须位于该根内；新输出根可以在源码项目外。README的源码入口/依赖定位则相对源码项目根。引用的图表需报告中的实际链接和数据来源。

候选缺交/坏schema记candidate_incomplete；由候选缺陷导致其他叶无法计算记blocked_candidate，相应为0分并保留原因，不称已算出的物理违例。评估器/冻结输入/设施故障则记run_invalid，整次不出总分，修复后重跑；不删叶再重标100。有效总分固定100分，同时另报business_success，所有关键数据/物理/现金/解质量/清洁执行叶都须实际通过。当前成本/完整参考/变体/逐叶适配器尚未资格，仍禁止发布总分。

若未完成，保留实际运行结果和未知原因；不能用空数组、伪造日志或未实际执行的命令冒充成功。研究交付完成与运营可行/成本达标分列。正式版本冻结前还需完成逐叶评价适配器、成本参考和输入变体可达性；当前不发布总分。
