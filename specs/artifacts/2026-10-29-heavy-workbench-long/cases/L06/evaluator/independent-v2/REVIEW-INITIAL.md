# L06 v2 廉价独立复核：初始快照

2026-10-29，既有唯一独立审查agent；未再次委托。主仓、v1原件和主agent原证据只读，写入仅本新目录。没有import/执行SciPy或MILP、GPU、Provider、容器/暂停工作或用户进程；只运行标准库脚本和checker CLI。

**已确认v2阶段仓容、严格输入主要缺口和既有坏JSON/顶层错误合同的修复；完整已得动作账在新容量与5369信用下成立。新增两项实际reader边界仍需关闭：溢出指数使错误输出出现Infinity、无效instance与坏plan并存时先报plan错误。没有批准冻结、1%运营成本、小时级或全套成熟。** 本文件记录本轮初始快照，不覆盖后续修复源/失败收据。

## 证据与实际执行

`source-inventory.json`保存118个文件：v2当前源、公开前输入、完整动作计划、原有20项CLI输入/输出/收据、tiny既有求解及枚举证据，加根目录当前校验/业务脚本；Recall另存。`source-identity.json`显示复制时根与v2三份源相等、完整plan与原minimum-credit动作相等，属于来源身份说明，不是功能门槛。

实际入口：

```powershell
python -B D:/opencorvus-benchmark-runs/l06-cheap-v2-independent-review-20261029/prepare_and_replay.py
python -B D:/opencorvus-benchmark-runs/l06-cheap-v2-independent-review-20261029/independent_checks.py
```

前者复制源到自有`replay/`后，真实运行作者的v2标准库枚举与20CLI。后者另写独立标量oracle和完整前缀/阶段/现金公式，并执行5个新边界。精确命令、cwd、exit、wall和stdout/stderr保留`commands/`。原tiny MILP0.016秒只读取其已存在结果，没有重跑；枚举脚本中的“MIP匹配”是本次枚举与既有记录比较，不能叫第二次求解。

## 认可范围

### 阶段仓容已真正进入数学模型和独立递推

模型的raw峰为前周原料库存加本周所有应到货（周0改为已知期初库存）；FG峰为前周成品加本周全部生产，随后才交付。初始常数从rhs扣除，与业务递推一致。无须再加另一套期末总容量约束：BOM/交付非负且期末非负，期末容量自然不超过先前峰值。变量单品upper bound只是由物理cap导出的有效界，不能当另一种仓容语义。

真实完整计划由独立前缀公式核算到货/耗料/库存、峰值、购运产存费、付款/回款、产能/资格、包装/合单/共享容量、共同承诺和终期；925个本地条件都匹配，约.0106秒。数目只是检查覆盖，不是rubric叶数或难度指标。见`independent-full-audit.json`。

| 场景 | 运营成本分 | raw峰/周（cap240） | FG峰/周（cap100） | 最低现金 | 末现金 | 末应收 |
| --- | ---: | --- | --- | ---: | ---: | ---: |
| base | 50929 | 227/14 | 94/10 | -5369 | 28421 | 24150 |
| supplier_disruption | 51557 | 223/7 | 96/13 | -5369 | 27793 | 24150 |
| demand_shift | 51657 | 230/11 | 91/5 | -5369 | 29853 | 25230 |

加权总成本精确51263，信用5369只证明这份计划可达。仓容240/100是据原动作账构造的合成输入，不伪装现实场地或候选表现。v1信用下界、最优性及旧成本资格不移用到v2。

另从48个原始需求行独立计算了必要条件：demand_shift索引13必须交付体积66。先全部生产再交付意味着FG峰至少66，因此旧物理cap42不可能履约，与是否使用本计划无关；新100通过该必要条件，但充分可达仍要靠完整动作账。见`independent-necessary-cut.json`。本复核没有为这个结论运行优化。

### tiny域已包括提前生产，并获得独立逐方案核对

当前tiny有正FGcap2；早产1或2均须枚举，末期产量由终期成品0确定。采购A周0为0..1、A末周正订单禁止；B两周各0..2；正MOQ让truck由是否有货确定。周0必须交1且生产能力2，故早产域恰1..2；不存在被漏掉的0/3。前缀共同承诺包含早产量。

| 域 | 实际遍历组合（含违反约束者） | 可行 | 最优 |
| --- | ---: | ---: | --- |
| 共同承诺 | 648 | 12 | 9/2 |
| 去掉共同承诺对照 | 1296 | 54 | 4 |

作者标准库脚本重跑与我另写、不调用checker的标量公式逐方案完全相同，含可行性和精确成本。标量公式先限制周0raw峰`1+B0<=2`，再扣早产并计算周1raw峰；不是旧期末模型改名。见`independent-tiny-common.json`、`independent-tiny-clairvoyant.json`。这支持微型可解性与共同承诺真实作用，不能外推完整成本最优或小时级。

### v1主要输入/错误缺口已经关闭

`l06_input.py`无solver/计划方程，负责输入schema、维度、整数/符号、正概率归一化、唯一ID、前缀信息；两侧都调用同一个函数。bool不被当整数，raw持有向量缺维度与负概率均已进入`instance_invalid`，没有zip截断漏费。

重跑20个真实CLI全部得到预期代码或独立重算数值：完整可达/可行高成本、需求/信用/BOM/共享供应、声明库存、期末在途、伪报成本、非预见性/生产资格/非整数、两个旧容量峰失败、负概率/维度、坏plan类型/JSON、坏instance JSON、重复字段。坏计划原生AttributeError/JSONDecodeError已有明确plan_contract/plan_json。独立新探针也确认显式NaN、bool weeks及重复instance字段被正确分类。

## 新实际缺口

### B1：有限数值入口仍有溢出路径，输出不是严格JSON

真实命令目录`independent-boundaries/overflow-exponent-format/`：plan文件内容为合法JSON数字形式`{"format":1e999}`。`read_json`的parse_constant只拦NaN/Infinity字面量，Python把1e999解成inf；下游PlanError实际值携带inf，`json.dumps`写裸Infinity。CLI虽exit2、error=plan_contract，严格JSON消费者拒绝该result。

实际输出和严格读取错误完整保存于`independent-boundaries.json`，没有把含Infinity对象再写成另一个伪合法机器JSON（保留原文字符串）。应在共享read_json中拒绝解析溢出的非finite float，或有明确安全表达规则，并让错误输出严格有限；不能只给NaN字面量加关键字。业务决策仍要求整数，不需要放宽范围。

### B2：instance结构校验发生在plan解析之后，错误归属可错

`independent-boundaries/invalid-instance-plus-bad-plan/`同时给`raw_holding_minor=[]`和plan`{`。当前`evaluate(read_json(input),read_json(plan))`先求两参数，再进入evaluate中的validate_instance；坏plan先抛plan_json，掩盖评估输入已经无效。

正式评分入口应先read+validate权威instance，再解析candidate plan。此处不是主张隐瞒多个问题，而是输入无效时运行本来不具评分资格，不能先归成候选错误。直接evaluate(data,plan)已先校验data，其CLI路径尚未遵守同一顺序。该组合实证的结果是plan_json；单独坏input+好plan已有instance_invalid，不能以单独例通过代替组合优先级。

## 后续源清理/阶段边界

主agent补报已删当前qualify_l06的未调用instance()/tiny_instance()及Fraction import，保留tiny真实执行源与v2原根快照。此清理能避免影子默认数值；本轮初始源快照仍保留旧定义，不能覆盖或把清理后的源伪称早先执行源。后续只需静态核对solve/校验无数学变化，不需重跑MILP。

checker中旧概率归一化/前缀信息检查在严格validate_instance之后已不可达，可作为小范围清理处理；这不影响本轮有效实例结果。公开时序仍应精确写索引0..3共同、索引4开始前揭示，且揭示后已知整张情景表。

本题还是评估侧合成资格，未有冻结公开材料/原子业务rubric、同v2可信运营成本下界/1%资格、真实受测系统完整作答/清洁交付重建、实际有效时长或专业多质量评分校准。一个已有动作账的秒级验算是正确且足够便宜的当前步骤，不证明创建它的完整任务需要几小时。B1/B2修复后可认可局部工具边界，仍不能发布候选长程成绩。
