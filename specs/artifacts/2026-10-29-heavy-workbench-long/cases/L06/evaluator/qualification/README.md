# L06评估者资格原件

`originals.zip`保留早期外部工作目录的完整捕获版本、v1/v2源、错误输入/输出、求解器日志及命令。坏JSON/Infinity等故障对象作为原始研究材料留在归档，不作为合法评分结果。`current-source/`当前只有一个整数模型构造器和OR-Tools9.15.6755 CP-SAT整数执行路径，连续松弛用SciPy1.15.3 linprog；输入事实校验器与独立精确业务递推分开。原SciPy milp整数入口仅在已执行历史快照，当前已替换。新业务原材料由同一`l06_packet.py`编译规范JSON，不存在自动双读后备。

`full-v1/`是真实infeasible输入，不能当通过；`minimum-credit/`是旧期末模型的5369信用结果，不能当成本界或v2最优。`cash-relaxed.*`是暂停中的旧成本搜索原件，没有自然终态，不把进程活着或日志incumbent当完整可达交付。旧源码和数据的重现使用`originals.zip`对应版本，不增加活跃兼容分支。

`v2/inputs/`是建设性的阶段峰值实例；`v2/full-witness/`保留动作，完整峰值/现金由真实checker重算。`v2/tiny-solver/`保存实际微型运行源和结果；`v2/full-business-contracts-final/receipt.json`保存22条真实CLI命令/退出及结果身份，完整逐例输入/输出在归档。源码、可达性、枚举、错误合同和成本界各自记录，不能互相代替。

例如在Python标准库环境独立重算已有完整动作（输出到新的自有路径）：

```text
python current-source/check_l06.py --input v2/inputs/full.json --plan v2/full-witness/plan.json --out <新收据.json>
```

当前完整参考使用准备好的Python3.11.13、NumPy2.4.6、SciPy1.15.3、OR-Tools9.15.6755与Matplotlib3.10.3环境；旧highspy及SciPy milp整数执行只在历史捕获。只重跑有新假设或修改的聚焦路径，不因本目录存在就重复求解。原探针脚本针对外部工作目录捕获结构，完整复核先在新目录解包、仅复制所需源/输入/参考状态，并使用新的输出根，不能覆盖原件。

`v2/cheap-necessary-cuts.json`仅约.0014秒就由原始需求得出物理成品容量至少66，证明旧42不足。通过必要条件不证明可行，完整动作账另外核对；这一廉价顺序优先于昂贵求解。

[连续松弛资格](v2/continuous-relaxation/README.md)使用同一当前build_model取得严格有理成本下界约46220.2662；原51263仅为可行上界，认证区间仍不能支持1%。源码/原始执行身份、融资分支修复与已知3/6及2/5锚点均保存，分数解不当计划；[独立数学复核](../independent-relaxation/REVIEW.md)另从输入重建所有变量/业务行并精确核算。

[整数原生状态与不同搜索资格](v2/integer-search/README.md)保留SciPy状态适配缺口、唯一native整数路径替换、根节点/30秒warm/30秒CP-SAT/60秒交叉seed原件；阶段上界49032.9仍不能认证1%。后续一个CPU参考任务已自然终态并独立核算成本47808/native界47380，基例以明示native信任口径取得1%可达见证并预注册，详见`quality-reference/`。严格LP格点仍46220.3，单独不能支持1%。该历史CP-SAT研究入口后来正式替换为唯一当前整数后端，未成为产品路由/失败fallback；`active-quality/`只是历史启动/快照，当前无新增活跃长计算。

[原材料编译资格](v2/business-packet/README.md)有5条真实CLI：完整事实同值、报价单因素、索引重排和重复键具名错误。它不证明输入扰动的决策/成本参考已资格；逐叶grader、完整职业交付与解质量仍待完成。

[10叶summary/ledger primitive](v2/delivery-projection/README.md)已实际11CLI验证精确金额、分场景最低现金、可选库存、缺交/候选阻断/评估侧故障，以及手算应收/现金。它不评其余37叶，不认证源码执行或质量，不出总分；完整逐叶adapter仍待完成。

[30数值叶局部资格](v2/numeric-findings/README.md)和[真正source-only完整参考链](v2/source-reference/README.md)分别保留新谓词采集/参考完整性修复与从raw运行到报告三图的证据。旧10叶/Highs描述是历史阶段，当前路径以current-source及这两份记录为准；全47叶/变体/冻结和候选小时级仍未完成。

L06/0.2.0已完成[最终独立合同审查](../independent-freeze-review/REVIEW.md)并冻结，规范rubric.json/public文件名不再有.draft。历史原件不改；合同资格不是新候选或小时级结果。
