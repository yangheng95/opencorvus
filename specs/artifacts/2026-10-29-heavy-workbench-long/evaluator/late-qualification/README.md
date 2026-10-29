# 晚期资格与预冻结修订

本目录不是候选答卷或正式成绩。原件zip保留实际数值导出、逐步PCG/Armijo记录、已执行源副本及独立重算；未完成的reaction/wave/合同重验没有封成通过。

- `initial-convection-representative.zip`：最初评估侧convection seed345、Adam11000后L-BFGS30000次native尝试，实际训练3604.738秒。独立NumPy结果见`initial-convection-independent.json`：loss0.0007902502413，L2RE0.368155。这是达到上限，不是梯度收敛。最初probe未逐attempt排除零步，不能作为最新first-zero-stop合同的R9规范锚点，已安排当前合同重新执行。
- `known-spd.json`：真实64维正定系统解相对误差6.42e-9；已知精确rank4的Nyström近似相对误差1.24e-14，逆预条件器误差8.14e-15。已知例不代替真实晚期Hessian资格。
- `late-newton-attempt-a.zip`及`attempt-a-summary.json`：同一上述晚期基点，原μ=.01/.1均发生PCG非正曲率、0接受更新；GD两分支指标退化，保留原结果。60阶谱存在负Rayleigh Ritz值约−.143，但小特征值未充分收敛，不声称其为严格最小特征值；晚期Hessian向量差分相对误差4.39e-11。投影稳定化δ未保证整个H+μI正定，失败不能伪装成NNCG成功。
- `independent-review-late/`：独立审查者实际CPU复核，发现私有资格工具零变化误计接受更新、分解异常未转分支终态、非有限曲率/失败残差语义缺失。原源快照与失败证据保留；这些属于资格工具缺陷，不声称候选失败。
- `repaired-local-contracts.json`：修复后真实神经网络零变化为optimizer_stalled/0接受/1尝试；PCG非正曲率与非有限类型分开并保留显式残差。分解异常envelope使用明确标记的局部错误注入，仅证明该错误合同，不冒充端到端验收。
- `late-newton-attempt-b.zip`、`attempt-b-summary.json`与`attempt-b-trace-audit.json`：修复后的新occurrence。原两失败保留；探索μ=1、10都实际接受21更新、通过第21更新的刷新。逐接受步PCG显式相对残差≤1e-8、gtd<0、Armijo条件、逐参数非零变化通过独立算术核验。μ=1为第三分支，刷新seed20263029/20263030。21步不证明200步；此基点不是已完成三学习率选优。

独立审查认可在冻结前保留两小阻尼失败、增加μ=1作为派生敏感性；公开5续训分支的C组权重仍15，其他组和待校准R9不变。μ=10只保留为探索证据，没有进入公开矩阵，不能把资格调参称作预注册候选结果。μ=1全200步资格、当前合同convection复验和另外两问题仍在自有容器运行，后续按真实终态追加原件。
