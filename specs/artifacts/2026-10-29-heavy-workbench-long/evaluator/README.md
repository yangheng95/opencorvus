# 评估侧材料：不得交给候选

`original-paperbench-rubric.json`是固定上游原件，1963叶；原有层级权重保留，不将叶数当权重，不将派生分数称官方成绩。上游来源、许可见包内来源清单及public/SOURCE.md。

`qualification/`是评估者的真实数值/环境资格，不是受测agent答卷：

- `events.json`：真实GPU训练/closure/Hessian-vector product测时、已知SPD PCG与实际高阻尼PCG；`qualify_pinn.py`为对应源，`numeric-exports.zip`含实际数值权重、权威数据及GPU输入导数。
- `numpy-crosscheck.json`：评估侧NumPy从上述权重独立重算三问题全部评价点，与GPU结果比较。
- `independent-component-check.json`：三个问题×三个损失分量、参数梯度/Hessian向量差分与实际Ritz残差；不能把30阶Krylov估计称为完整谱。
- `torch-cli-receipt.json`：新CLI实际运行及明确标量/梯度/Hessian差分接受条件。源码在仓库`script/benchmark/pinn_numeric_check.py`和`pinn_torch_check.py`；15个NumPy聚焦测试、3个Torch聚焦测试通过。增加的严格零bias导数是数学正确值，不额外加正则改变问题。
- `Dockerfile.science`、`science-environment.txt`与`receipt.json`给出准备环境和镜像身份。环境准备不计候选耗时；未将4GB基础镜像或任何凭据提交。

示例（在准备的依赖环境中，解压exports到自有目录）：

```powershell
python script/benchmark/pinn_numeric_check.py evaluate --problem convection --checkpoint <export>/convection-checkpoint.npz --out <receipt>.json
python script/benchmark/pinn_torch_check.py --problem convection --component residual --checkpoint <export>/convection-checkpoint.npz --device cuda --spectral-steps 30 --out <derivatives>.json
python -m unittest discover -s script/benchmark -p test_pinn_numeric_check.py
python -m unittest discover -s script/benchmark -p test_pinn_torch_check.py
```

这些检查不能认证训练来源/优化器/配置归属，完整验收仍需从公开输入执行实际候选源码、完整清洁复训和独立审查。晚期NNCG小阻尼、全注册矩阵、R9结果锚点和小时级行为尚未资格，不能用本目录的通过结论代替它们。

后续晚期原件与预冻结修订在[late-qualification/](late-qualification/README.md)：两小阻尼的真实失败、私有工具修复、已知矩阵与21步刷新资格分别保留。完整200步、当前终态合同及其他问题的代表运行仍以实际后续末态为准，不从局部通过推导整题通过。
