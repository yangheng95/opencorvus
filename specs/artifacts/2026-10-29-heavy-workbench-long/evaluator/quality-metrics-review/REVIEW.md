# R9新增独立数值指标：只读独立复核

审查者：`/root/benchmark_review`。本轮仅审阅最新`pinn_numeric_check.py`与`test_pinn_numeric_check.py`及其实际导出数值对象。没有改主仓库、读取作者实现或凭据、再次委托、启动模型/服务或训练。所有新文件仅在本自有外部目录。

## 结论

**捕获版本的新增指标未发现实质阻断，局部数值工具变更可认可。** 18项原正向测试由本审查者实际运行通过；三个既有真实四层导出的快照CLI输出与独立PyTorch输入自动微分逐字段匹配。新字段和本轮对照均不构成候选成绩、R9阈值依据或整题冻结批准。

## 数学、身份与兼容口径

- 训练`residual_loss=.5 mean(r_train^2)`保持不变，新`residual_rmse=sqrt(mean(r_train^2))`；二者满足RMSE平方=2*loss。
- 评价PDE残差使用**evaluation坐标**重新生成jets，再代入相同的公开PDE算子；不是复用训练残差。报告全公开8385点的loss/RMSE，没有暗换内部子网格或训练集合。
- convection/reaction的族为`initial_value`257、`periodic_value`101。周期条件是一对同t边界的值差，101个方程，不能误计202个独立条件。
- wave的族为`initial_value`257、`initial_velocity`257、`boundary_left`101、`boundary_right`101，共716。新测试的非零速度与左右不同误差实质验证了族身份。
- 每族loss=.5 mean(error^2)，RMSE=sqrt(mean(error^2))。原`constraint_loss`仍为拼接后均值，等于`sum(count_i*family_loss_i)/sum(count_i)`，不是各族loss等权相加。原total_loss和各训练标量保持原口径。
- 同一次CLI加载的同一份8数组四层网络用于训练残差、评价解误差、评价残差和全部条件族；没有从多个checkpoint拼指标，也不执行候选推理代码。三个实际CLI均以权威canonical数据计算。
- 有限值检查同时扫描新增评价标量、训练RMSE以及嵌套family的count/loss/RMSE。独立边界探针使用有限的真实四层权重构造“训练残差有限而评价残差平方溢出”，实际映射到`ContractError.code=nonfinite_metric`。这是辅助数值primitive的明确错误合同，不是候选运行。

## 本审查者实际执行

`executions.json`及每项stdout/stderr包含精确命令、UTC、耗时、退出码；六项命令均退出0：

1. 快照`test_pinn_numeric_check.py`：18 tests通过，包含真实CLI及已知手算输入。
2. `diagnostics.py`：六个实际四层零/常数网络、三个解析初值延拓，以及评价残差非有限错误合同。
3. 三个实际CLI：convection的既有非选优NNCG200资格导出；reaction/wave的既有早期资格导出。均是评估工具资格材料，不能称当前候选或当前规范参考解。
4. `torch_crosscheck.py`：在本审查者自有一次性CPU容器中，重新实现四层前向、输入一/二阶自动微分及PDE/条件计算；不导入候选Python或`pinn_torch_check.py`。全部新增标量和族字段在atol1e-10/rtol1e-9内与三个CLI输出匹配；样本数加权池与原constraint_loss也匹配。

容器未请求GPU，网络关闭，CPU限制1，只挂载本自有目录；没有操作三个活跃资格训练容器。这里不作运行速度或独占算力比较。

## 低质量对照的正确解释

`diagnostics.json`明确标注类型：

- 六个零/常数对照是实际四层100宽tanh网络的数值权重，未训练。三个零解的评价残差为0且L2RE=1；reaction常数1同样残差0，L2RE约.888，但初值族误差明显。因此小物理残差不能独立构成成功解复现。
- 三个“初值沿时间不变延拓”仅是解析诊断函数，**没有伪称成四层网络或候选实现**。它们满足初始及值边界，wave初始速度为0，但动态PDE残差非零，体现条件质量也不能替代域内物理质量。
- convection既有资格权重的指标仅用于验证计算。其分池误差与解误差没有被转成通过阈值。reaction/wave早期资格导出更不能当最终可达性锚点。

## 保留边界

本轮只证明独立数值指标的计算、族身份、数目、有限错误和CLI路径；不证明训练真实发生、算法正确执行、连续域严格误差界、R9质量底线可达或完整研究完成。阈值、每PDE最终checkpoint选择及study_complete/solution_reproduced仍需独立冻结和实际验收。本轮不批准freeze。

所审源码快照与差异在`source-snapshot/`、`source.diff.patch`，导出对象来源在`source-manifest.json`。原始执行对象与收据保留，无摘要功能门槛。
