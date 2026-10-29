# L06 CP-SAT / HiGHS交叉seed：独立局部资格复核

本次独立复核确认新完整业务可行上界 **490329/10 = 49032.9 分**，比原51263分减少 **22301/10 = 2230.1 分**。CP-SAT与后续HiGHS返回动作相同；交叉seed没有再改善上界。该数学研究范围未发现新的计划/模型实质阻断。**不批准L06重型冻结，不认证1%，不形成候选成绩或小时级结论。**

## 输入、固定矩阵与原生接口

已快照实际 `executed-source-cpsat/`、`executed-source-cross-seed/`、cpsat-input、两组原始计划/向量/solver记录、命令/CID/日志、依赖清单与Recall。`source-inventory.json`记录原始路径及直接复制身份，仅作来源定位；功能正确性由下面实际业务和精确整数算术确认。

CP读取的 `full-model.json` 与先前已从唯一v2输入独立逐行重建的完整模型结构相同：1488整数变量、1096双侧整数行、有限整数盒、概率成本整数分子及分母10。交叉seed的build_model语义AST与此前已审版本相同。CP程序没有另写BOM/库存/现金/非预见性业务方程；它导入该固定模型全部行和变量。

`qualify_cpsat_model.py`用new_int_var导入盒，逐行add_linear_constraint导入上下界；目标仅最小化整数分子，不将10分母误乘约束。hint逐列身份匹配，再验整数/盒/全部行，最后add_hint；原51263 hint由审查者另按整数行与精确目标验证通过。实际model.validate在solve前运行，非空错误会终止该路径；当前原始执行产物在这一步之后正常落盘。

当前接口调用与[官方CP-SAT整数合同](https://developers.google.com/optimization/cp/cp_solver)、[固定v9.15 Python API](https://raw.githubusercontent.com/google/or-tools/v9.15/ortools/sat/python/cp_model.py)一致。原生状态2为FEASIBLE：已找到可行解但未证明最优；不能当OPTIMAL。[固定状态定义](https://raw.githubusercontent.com/google/or-tools/v9.15/ortools/sat/cp_model.proto)支持这一解释。

原生CP日志实际打印9.15.6755、random_seed20261029、max_time_in_seconds30、num_search_workers8；与请求和记录一致。这里使用的是固定版本支持的num_search_workers字段；[参数定义](https://raw.githubusercontent.com/google/or-tools/v9.15/ortools/sat/sat_parameters.proto)说明它控制并行worker，当前更推荐的字段名为num_workers。只按此次实际8worker研究记录，不作同资源速度/模型排名。固定seed也不被当作多线程搜索轨迹的严格可复现保证。

CP原生约30.018216秒，statusFEASIBLE，scaled objective490329、scaled bound472303。分母10后UB49032.9、数值界47230.3。`values.json`逐坐标为整数，精确目标与solver记录一致；原生响应文本也对应这些数值。branches0/conflicts0并不证明没有搜索：官方response proto明确这些多线程统计对应首个subsolver，不是全部worker汇总。本次保留了完整portfolio日志，不以这两个字段代表总计算量。

交叉seed实际为HiGHS1.8.0，status13/limited、primal feasible，60.009353秒、7252节点、UB49032.9、数值界47275.9；其请求选项time_limit60/mip_rel_gap0.002/output_flagtrue完整。warm业务成本49032.9，1488列setSolution/getSolution读回一致的事实由执行源码及原生回执支持，本次不重新执行原生API。浮点model_objective49032.899999999994是原生成本系数表示，审查者另外精确核算490329/10，没有拿这处浮点尾差扣业务分。

## 唯一投影及两份计划的实际复核

两个快照的l06_plan.py直接字节相同，属于唯一当前向量到plan序列化实现。实际用该纯标准库模块对保存的CP向量投影，与保存plan完整结构相同；没有重新写业务方程或用旧结果目录喂给程序。

另用原始v2输入和本次两份计划，各实际运行一次快照业务checker：

| 计划 | checker退出 | checker调用秒数 | 独立前缀核对 | 完整精确向量 |
| --- | ---: | ---: | --- | --- |
| CP-SAT | 0 | 0.14301800029352307 | 925项通过，0.006991800386458635秒 | 1488坐标/1096行通过 |
| HiGHS交叉seed | 0 | 0.14300249982625246 | 925项通过，0.006977099925279617秒 | 1488坐标/1096行通过 |

独立前缀公式使用累计到货/累计生产耗料/累计交付求库存，与作者逐周递推实现分离；逐字段确认阶段物理峰、合单费、BOM、产线资格与容量、持有成本、当周全部履约、前4周共同承诺、信用和终期现金/应收。它只执行自己已审的纯函数，不导入求解器或作者递推函数。

向量核算从动作和独立累计式重算raw/FG，然后按所有model key构造每一坐标，确认整数盒、1096行精确整数和概率目标。CP保存的完整values与该独立构造向量逐项相同；两份目标均为490329/10。原生输出值与独立业务账不是只比总数。

两份计划实际逐场景事实相同：

| 场景 | 完整运营成本 | 最低现金 | 期末现金 | 期末应收 | 原料峰 | 成品峰 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| base | 48507 | −5369 | 30843 | 24150 | 214 | 92 |
| supplier_disruption | 49428 | −5369 | 29922 | 24150 | 215 | 95 |
| demand_shift | 49755 | −5369 | 31755 | 25230 | 207 | 91 |

原料/成品阶段cap仍240/100，最低信用5369仍是v2可达上界，不继承旧v1最优下界。

完整检查保存于各分支 `prefix/independent-full-audit.json`、`independent-exact-vector.json` 和实际 `business-check.json`；所有CLI输入/输出/命令见 `commands/`。21项本地身份/接口状态/参数/目标/记录核对均通过。

## 严格界、数值界与可行上界

| 数值 | 性质 |
| ---: | --- |
| 46220.3 | 已独立验证的严格有理LP证书，再用1/10整数目标格点得出的严格下界；本次未重求LP |
| 47230.3 | 本次CP-SAT原生搜索数值界，不是独立可核验的精确证明证书 |
| 47275.9 | 本次交叉seed HiGHS原生数值界，同上 |
| 47281 | 前一轮HiGHS已记录的数值界，比本轮两个界略强；没有因新运行覆盖旧事实 |
| 49032.9 | 本次新计划的独立业务可行上界 |

用严格46220.3与新UB计算，区间宽度/下界 **6.0852049857%**，区间宽度/上界 **5.7361485859%**。CP与交叉seed记录的数值gap/新UB分别约3.6763071326%与3.5833083501%。它们都不是已知的真实最优误差，更不能认证1%。没有把CP的原生整数传播解释成已交付独立精确search proof。

## 执行证据待补与审查工具记录

有一处来源记录缺口：本次捕获的 `execution/cpsat-full-command.json` 有start/end/session_id，但没有completion/exit_code；交叉seed命令则实际包含completion exit0。CP完整原生响应、最后输出、向量和独立业务核对足以支持这里的可行上界和当前数学资格；但报告不凭这些倒填进程退出码。若主方保留原工具终态回执，应另附原件，保留当前快照。该缺口不是计划错误，也不被包装为正式生命周期评测通过。

第一次审查脚本因复用旧审查runner触发其顶层历史路径初始化，报FileNotFoundError（缺reviewer-tools/source-snapshot/v2/check_l06.py），发生在任何本次业务CLI之前。修复为仅显式执行已审的独立纯函数AST，去除对旧runner初始化的依赖，再--resume使用未变快照完成；未重跑任何求解器。原错误与成功续跑收据在commands，属于审查工具问题，不是受测系统/业务失败。

本次仅标准库核算，没有新Provider、GPU、LP/MIP求解、Docker启动、暂停容器恢复或再次委托。候选没看到这些评估侧参考。此研究已回答不同搜索和交叉seed的有限假设，应保留不足并转向题目原始材料与rubric；这些资格原件不等价于完整L06或十题完成。

## 后续来源补全（保留以上历史观察）

原custom_tool_call及同call_id原response已补到审查侧：session87433明确绑定终端chunk069218/exit0，9项来源核对通过，先前的终端回执缺口已补全。见[来源追加报告](terminal-addendum/ADDENDUM.md)和[机器结论](terminal-addendum/final-source-assessment.json)。旧command/缺口历史未改写，没有重跑solver、模型或业务。上述可行上界与1%/重型冻结边界不变。
