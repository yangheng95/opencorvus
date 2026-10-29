# L06 native 整数与 warm start：独立局部复核

本次认可原生状态适配、显式选项投影、warm start 映射及返回计划的**局部资格**，未发现该范围新的实质阻断。30 秒参考诊断自然限额结束，未改善已知可行上界。**不批准 L06 重型题冻结，不认证 1% 质量、不形成候选分或小时级结论。**

## 实际范围与证据身份

只读主仓 Recall 和外部 `v2/root-node-diagnostic-20261029/`，把实际 `executed-source-native/`、`executed-source-warm/`、原始输入/计划、native/SciPy 原记录、命令/CID/输出日志和已有 exact LP 证书复制到本目录 `source-snapshot/`。源码包实际各有五份 Python 文件，其中四个为求解器、业务 checker、严格输入与证书模块，第五个是已知资格脚本；报告没有把“五份快照文件”误称只有四份。

审查者未导入或执行 highspy、NumPy、SciPy，未重跑 LP/MIP、小穷举、Docker、GPU、Provider 或用户服务，未恢复六个暂停容器，未再次委托。主仓只读；所有本次写入均在这个新外部目录。

## 三种数学对象分别记录

| 对象 | 本次事实 | 可认可的含义 |
| --- | --- | --- |
| 先前独立核算的严格有理 LP 下界 | 577753327609889925273/12500000000000000 ≈ 46220.266208791196 | 有完整有理证书的全域下界；本次只读已有证书，未重新求 LP |
| 整数目标的 1/10 格点推论 | 46220.3 | 严格目标下界；对目标取合法格点上整，不是四舍五入 LP 变量 |
| 原生无 warm start 根节点 | 数值 dual 47039.5，nodes1，无 incumbent，4.08404965698719 秒 | 原生数值分支定界信息，不是精确证书；不表示实例无解 |
| 原生 warm start 终态 | 数值 dual 47281，nodes1713，30.007902392651886 秒 | 比根节点更强的数值界，没有新的精确证明对象 |
| 独立重算可行计划 | 51263 | 可行上界，且本次返回动作与输入 warm start 相同，没有上界改进 |

native 报告 gap 使用可行目标为分母：(51263−47281)/51263 = **7.7677857324%**；以 native 数值界为分母为 **8.4219876906%**，不能混用。沿用严格有理 LP 证书时区间宽度相对该下界约 **10.9102223004%**。这些是当前可证/数值区间宽度，不是已知计划距真实整数最优的真实误差。当前不认证 1%。

完整字段在 `bound-comparison.json`，没有将原生数值界晋升为严格证书。

## 原生状态和选项审读

旧 SciPy1.15.3 的实际原件 `evidence/full/solver.json` 保留 status4、objective/dual/nodes 为 null；原日志记录 native status16、Solution limit、nodes1。这与该固定版本的[状态映射源码](https://raw.githubusercontent.com/scipy/scipy/v1.15.3/scipy/optimize/_linprog_highs.py)一致：映射表未列 kSolutionLimit，落入通用状态4；其[包装源码](https://raw.githubusercontent.com/scipy/scipy/v1.15.3/scipy/optimize/_highspy/_highs_wrapper.py)还存在带结果回传范围的筛选。旧记录没有被改写成新格式。

当前整数 `solve` 只有 highspy 原生路径；`build_model` 与此前独立逐行重建且验证的版本语义 AST 完全相同，仍为同一 1488 整数变量/1096 行模型。LP 仍用 linprog。模型按 CSC 传递成本、零下界、有限上界、双侧行与全部整数类型，未另造业务模型或失败后换数据。

`qualify_l06.py` 第166–172行实际逐项 setOptionValue 并 getOptionValue 比对后保存有效选项；原生根节点保存 mip_max_nodes1/time_limit30/mip_rel_gap0.002/output_flagtrue。warm 完整运行明确只有 time_limit30、mip_rel_gap0.002、output_flagtrue，没有伪填 node_limit1。调用方30秒是这一明确参考数学诊断的计算限额，不是候选或用户任务总额度。

native 根节点实际 status16/termination limited/primal_status0/incumbentfalse；objective null、dual47039.5、nodes1，非有限 gap 显式记为 null 并在 native_nonfinite_fields 记录 inf。warm 实际 status13/termination limited/primal_status2/incumbenttrue，objective51263/dual47281/nodes1713；既未称 optimal，也未称 infeasible。数字与[固定 HiGHS1.8.0 枚举](https://raw.githubusercontent.com/ERGO-Code/HiGHS/v1.8.0/src/lp_data/HConst.h)相符，native status 与 run status 两者分别保留。

API 的 passModel/getSolution/getInfo/getModelStatus 与[固定版本官方示例](https://raw.githubusercontent.com/ERGO-Code/HiGHS/v1.8.0/examples/call_highs_from_python.py)一致；setSolution 为[官方公开接口](https://raw.githubusercontent.com/ERGO-Code/HiGHS/v1.8.0/src/Highs.h)。科学镜像与 highspy 都标1.8.0，但实际日志不同 Git 标识，不当作同一二进制。

## 计划与 warm start 的独立实际复核

使用宿主 `C:/Python314/python.exe` 对快照 checker 实际运行两次：返回计划 **0.15230630012229085 秒**、输入 warm start **0.132965300232172 秒**，均退出0、精确期望成本51263。完整命令、stdout、stderr 在 `commands/`；没有接受旧生成的结果作为此次 checker 输出。

另外实际运行自己之前的**独立前缀公式**，从冻结输入和此次动作逐周重算累计到货、BOM、库存、阶段物理峰、采购/合单运费/生产/持有成本、4周延迟回款、信用/终期与共同承诺；925 项通过，算术约 **0.007890499662607908 秒**。该代码不导入作者业务递推函数，结果逐字段与此次真实 checker ledger 对照。

| 场景 | 完整成本 | 最低现金 | 期末现金 | 期末应收 | 原料峰 | 成品峰 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| base | 50929 | −5369 | 28421 | 24150 | 227 | 94 |
| supplier_disruption | 51557 | −5369 | 27793 | 24150 | 223 | 96 |
| demand_shift | 51657 | −5369 | 29853 | 25230 | 230 | 91 |

信用5369仍只是当前 v2 可达上界，不能移用旧 v1 信用最优下界。仓容240/100满足阶段峰，未将期末库存代替物理峰。

再从动作与自己重算的库存按每个 model key 构造向量，对 warm start 和最终计划分别检查**1488 个整数坐标的有限盒、全部1096行整数算术、精确概率成本51263**，均通过。结果见 `mapping/warm-start/`、`mapping/native-final/`，含完整键/向量与行核对；没有用 LP 分数变量舍入成计划。

warm 源第183–206行先进入精确业务 checker，再把 q/truck/produce 原动作和重算 raw/FG 库存映射，验证模型行/盒后调用 setSolution，并将 getSolution 的完整 col_value 与向量比较。手算5变量例的实际回执和完整1488变量回执均记录 native_readback_matches；完整原生日志还实际输出 MIP start 可行、目标51263。审查者没有再次执行 highspy，也没有独立插桩原生 API 导出读回向量，所以这里的 API 执行证据是**源码审读+主方原始原生回执/日志**；本次独立行为验收是标准库计划递推与精确向量核算，二者不混称。

## 工具与资格边界

19 项本地状态/选项/输入/模型/目标及记录核对全部通过。native-known 的整数6/4.5/融资5与LP3/2仅按原始实际回执审读，本轮未重复求解；它们不替代完整计划复核。

审查工具第一次运行在已完成最终计划业务 checker 后，因审查者复用独立算术工具时漏设其本地 helper 导入路径，报 ModuleNotFoundError: prepare_and_replay。补明确路径后用 --resume 继续已封存快照，没有覆盖主方源码或重跑求解；原失败调用收据另存 `commands/reviewer-initial-invocation.json`，成功续跑收据也保留。这是审查工具错误，非求解器/计划失败。

这次30秒没有改善上界，实际支持“原生结果适配和已知可行 warm start 可用”，不支持任意长自动续跑、更不支持反推候选小时级难度。当前仍缺接近1%的可靠参考可达计划/界、完整公开重型任务与 rubric、真实候选校准和独立专业/统计验证；这些不由本次局部通过补齐。
