# 晚期 Newton 资格脚本独立审查

审查者：`/root/benchmark_review`。本报告针对`reviewed-source/qualify_late_newton.py`的实际捕获版本。只读原脚本/公开合同/评估工具，没有读取作者实现或凭据、没有再次委托、没有修改主仓库或干预正在运行的资格进程。仅向本自有外部目录写入快照、CPU边界执行结果和报告。

## 阶段结论

Nyström/PCG/Armijo的主数学方向符合当前公开合同，但捕获版本的**接受更新计数、分解异常分支收敛、PCG失败收据**有实际缺陷；修复并按原合同复验前，不能把该脚本的全部晚期分支收据认作完整资格证据。本报告不是候选失败判定，不是官方PaperBench评分。R9、晚期真实刷新路径、完整候选长跑及清洁复训仍未通过本审查。

## 已认可的数学与控制流

- `solve_triangular(lower, shifted.T, upper=False).T`等于`Ys C^(-T)`，与`C C^T=sym(Q^T Ys)`的下三角Cholesky合同一致。
- sym投影、nu/shift、薄SVD、截断非负近似特征值，以及逆预条件器缩放方向一致。它稳定的是投影/低秩近似，未把整个H+muI正定作为既成事实。
- PCG从零起点解`(H+muI)d=-g`，实际每次更新后重新计算`b-Ax`，成功条件使用显式相对残差，非仅递推残差。
- Armijo使用`w+alpha*d`和`L_old+.1*alpha*g^T*d`，从1至2^-30，共允许30次减半；失败候选会恢复旧参数。符号正确。
- 每次外循环先以当前parameters重建value/gradient和raw_hessian；PCG用本轮raw_hessian。inverse闭包仅保存由detach的海森矩阵向量积形成的U/lambda，不保存旧参数的自动微分图。前20步复用旧预条件器是合同允许的近似；第21次尝试重新sketch。没有从代码找到“刷新后仍使用旧参数Hessian图”的事实，实际晚期21步收据仍待核验。

## 实际缺陷及修复要求

### LATE-01：零参数变化计为接受更新

`run_branch`在GD/Armijo获得有限loss后直接`accepted += 1`，没有比较前后参数。`probe_cpu.py`使用**真实四层100宽tanh网络、真实canonical输入、真实目标/梯度**，没有mock模型/目标/海森矩阵。该有限饱和网络的梯度非零，但GD位移小于float64分辨率；两次尝试后的所有参数逐单元完全相同，脚本却报告`accepted_updates=2,status=max_updates`。

这只是资格工具边界模型，不是声称实际选优基点已经出现此行为。修复应检查真实接受前后参数变化；零变化记具名有限停滞并按公开语义结束，不能计更新或继续空转凑200。若新增续训停滞状态，应与公开合同同步。

原始证据：`probe-results.json`的`actual_neural_gd_zero_update_count`，以及`zero-update-gd/result.json`、`final.npz`；精确命令、退出码、stdout/stderr见`execution.json`和`probe.*.txt`。

### LATE-02：Nyström分解异常未经分支级捕获

对真实零Hessian，既定公式得到nu=shift=0，Cholesky确实抛出`_LinAlgError`。这是合同允许报告的分解失败，并非应当静默换公式。捕获版本的nystrom、run_branch和main没有异常边界，分解失败会直接退出整批运行，无法封存当前分支具名失败、有限checkpoint和成本后继续其他注册分支。

修复应将实际Cholesky/SVD数值异常映射到具名分支终态，保留异常、sketch/海森矩阵向量积成本和此前有限状态，再继续其他分支；不得为了让见证通过暗加未注册jitter或换预条件器。

证据：`probe-results.json`的`zero_hessian_nystrom`及捕获源码。直接函数探针证明真实分解异常；“会退出整个main”来自源码没有捕获的控制流审查，不冒充已在真实晚期PINN上触发。

### LATE-03：PCG失败收据和错误分类不完整

真实二维非正曲率例返回`pcg_nonpositive_curvature,iterations=0,history=[]`，没有显式终值残差；本审查者独立重算其相对残差为1。非有限operator探针同样被标为`pcg_nonpositive_curvature`，实际curvature是NaN。

修复应将有限非正曲率与非有限数值故障分开；所有失败出口保留可计算的显式残差，无法有限计算时明确记录状态，不能补造有限值。顶层hvp总计在正常返回的失败分支中实际会累加初评、失败曲率及显式检查调用，不能笼统声称全部计量失效；但失败行和异常中断路径也应完整保留成本。

证据：`probe-results.json`的`nonpositive_curvature_receipt`和`nonfinite_operator_classification`。

## 已完成的独立正向复核

本审查者在一次性CPU容器独立运行捕获脚本的known_spd，得到64维正定系统解相对误差约6.14e-9，精确rank4近似误差约7.01e-15，逆预条件器误差约7.00e-15，均通过脚本断言。该CPU执行显式选择cpu，未请求GPU；它不冒称重新执行主评估者GPU资格，也不用于性能比较。

`known-spd-observed.json`是主评估者已运行GPU结果的只读快照；其GPU数值与本次CPU输出分开保存。正向数值成功不能覆盖上述错误出口和计数缺陷。

## 证据与复跑边界

`source-manifest.json`记录捕获时间、实际来源和逐字节复制事实；不以摘要代替功能正确性。`probe_cpu.py`和`run_probe.py`只在本目录工作。原始命令使用本目录唯一可写挂载，不接入GPU、不挂载主仓库或私有凭据。复跑会因`zero-update-gd`已存在而停止，以免覆盖原始证据；如需复跑，应整体复制到另一个明确授权的自有目录并记录新的执行身份。

即使这些资格脚本问题修复，本题仍处开发校准阶段；不得将私有见证、known-only或边界探针包装为正式候选长程交付。
