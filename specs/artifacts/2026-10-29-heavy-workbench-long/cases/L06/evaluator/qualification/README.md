# L06评估者资格原件

`originals.zip`保留外部工作目录的完整捕获版本、v1/v2源、错误输入/输出、求解器日志及命令。坏JSON/Infinity等故障对象作为原始研究材料留在归档，不作为合法评分结果。`current-source/`是本轮独立认可的v2实现：一个输入事实校验器、成熟SciPy MILP构造器、独立精确业务递推，以及廉价探针；当前求解入口只读显式JSON，旧生成入口只保留历史原件。

`full-v1/`是真实infeasible输入，不能当通过；`minimum-credit/`是旧期末模型的5369信用结果，不能当成本界或v2最优。`cash-relaxed.*`是暂停中的旧成本搜索原件，没有自然终态，不把进程活着或日志incumbent当完整可达交付。旧源码和数据的重现使用`originals.zip`对应版本，不增加活跃兼容分支。

`v2/inputs/`是建设性的阶段峰值实例；`v2/full-witness/`保留动作，完整峰值/现金由真实checker重算。`v2/tiny-solver/`保存实际微型运行源和结果；`v2/full-business-contracts-final/receipt.json`保存22条真实CLI命令/退出及结果身份，完整逐例输入/输出在归档。源码、可达性、枚举、错误合同和成本界各自记录，不能互相代替。

例如在Python标准库环境独立重算已有完整动作（输出到新的自有路径）：

```text
python current-source/check_l06.py --input v2/inputs/full.json --plan v2/full-witness/plan.json --out <新收据.json>
```

MILP需要准备好的SciPy1.15.3环境。只重跑微型输入即可核对求解路径；完整优化尚未资格，不因本目录存在就启动长跑。原探针脚本针对外部工作目录捕获结构，完整复核先在新目录解包、仅复制所需源/输入/参考状态，并使用新的输出根，不能覆盖原件。

`v2/cheap-necessary-cuts.json`仅约.0014秒就由原始需求得出物理成品容量至少66，证明旧42不足。通过必要条件不证明可行，完整动作账另外核对；这一廉价顺序优先于昂贵求解。
