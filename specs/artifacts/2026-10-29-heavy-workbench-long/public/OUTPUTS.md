# L01 机器交付合同（未冻结）

`profile.json`是配置ID、参数及选择范围的唯一注册表。本文规定交付形状，不取代TASK的真实执行、数值方法、恢复、谱、论文与清洁重训要求。当前质量阈值尚未校准，本文和profile均未冻结。

## 入口与目录

在项目根执行`python run_study.py --output <不存在的新目录> --device cuda`，完整运行仅读取公开输入与自己的源码。`--only <config-id>`执行指定注册配置的清洁重训；续训须在同一新输出根先完成必要父候选选择，不得偷偷读取旧运行。`--resume <自己的完整状态文件>`只加载真实模型、对应优化器和随机状态，再继续剩余轨迹；不重复前缀。默认交付输出目录为`results/`。评估者显式选择`<输出目录>/manifest.json`，项目根与输出根分别定位，无须将合法新目录改名为results。

每个输出根有`manifest.json`，以下示例是一个记录的形状；正式`runs`必须恰含profile的19基础与5续训ID，各一次。参数从对应注册ID解释，执行收据还需记录实际参数。数值记录中的JSON（JavaScript Object Notation）不得出现NaN/Infinity，缺失的非有限数值用null并附具名失败证据。不能用null替代必需计数。所有文件引用使用相对**项目根**的`/`路径，解析后必须仍在该根；不允许指向其他运行、评分器或宿主私有文件。

```json
{
  "format": "heavy-pinn-study/1",
  "benchmark": "HeavyWorkBench-Long/0.2.0-dev",
  "case": "L01",
  "runs": [
    {
      "config_id": "convection-hybrid-s345-lr1e-04",
      "status": "max_updates",
      "reason": "11000 Adam and 30000 nonzero L-BFGS updates completed",
      "parent_id": null,
      "phases": {
        "adam": {"attempts": 11000, "accepted_updates": 11000},
        "lbfgs": {"attempts": 30000, "accepted_updates": 30000}
      },
      "costs": {
        "closure_calls": 61000,
        "gradient_calls": 72000,
        "hvp_calls": 0,
        "lbfgs_native_iterations": 30000
      },
      "checkpoints": {
        "initial": "results/init/seed345.npz",
        "switch": "results/convection-hybrid-s345-lr1e-04/switch.npz",
        "final": "results/convection-hybrid-s345-lr1e-04/final.npz"
      },
      "trace": "results/convection-hybrid-s345-lr1e-04/attempts.jsonl",
      "receipt": "results/convection-hybrid-s345-lr1e-04/execution.json"
    }
  ],
  "solution_checkpoints": {"convection": null, "reaction": null, "wave": null}
}
```

示例cost数字只说明格式，**不是预期工作量、真实结果或正确答案**；最终必须用实际次数。示例只含一个run因此不是完整manifest；`solution_checkpoints`的null只在该PDE没有合格终态时合法，完整提交必须按下述规则填写。

## 状态、计数与引用

- Adam单独配置的状态仅`max_updates/numerical_failure/incomplete`。L-BFGS和hybrid还可为`gradient_converged/finite_plateau/optimizer_stalled`。GD续训可为`max_updates/gradient_converged/optimizer_stalled/numerical_failure/incomplete/dependency_incomplete`；NNCG另可为`algorithm_failure`。停止判据精确数值以TASK为准。
- `numerical_failure/algorithm_failure`必须给非空`failure_code`和具体`reason`。失败与incomplete不同；资源/环境异常不能伪装成数值失败。
- `phases`恰为方法对应的`adam`、`lbfgs`、`adam+lbfgs`、`gd`或`nncg`。每阶段`attempts`和`accepted_updates`为非负整数；有限但零变化、算法失败尝试不能增加接受数。首次失败/零步后终止，不重复调用凑数，因此每阶段未接受的终结尝试至多一次。中断时记录已经实际进入的尝试和最后已接受更新。
- `max_updates`必须达到每阶段注册的实际更新数，且各阶段attempts=accepted_updates；hybrid为11000+30000。finite_plateau最后阶段至少25次接受更新、没有未接受尝试；optimizer_stalled及NNCG algorithm_failure最后阶段必须恰有一次未接受的终结尝试。必要计数成立不证明真实连续轨迹或梯度判据。只在完成11000 Adam后启动L-BFGS，并提供`switch`纯数值权重与另存的完整优化器/随机状态。其他方法`switch`为null。
- `costs`四字段均为真实非负整数。`closure_calls`只计L-BFGS回调，其他梯度求值仍计`gradient_calls`；`hvp_calls`计实际Hessian向量算子求值，包括sketch、PCG和线性系统显式复核。native迭代只计L-BFGS原生内部迭代。共享前缀在各逻辑轨迹中有来源引用，实际计算成本在总账中只计一次。
- 各基础run的`parent_id`为null；续训为profile原三混合候选按独立训练loss选出的ID，不能改用其他seed/方法。若全部不合格，所有五续训均`dependency_incomplete`、父为null、各计数0、checkpoint/trace/receipt为null。已经选择父但尚未执行的续训为`incomplete`且保留该父ID。
- 有实际尝试或有合法/数值/算法终态的记录必须提供initial、final、trace和receipt；失败final是最后有限checkpoint，不能冒充失败后的状态。所有非null纯数值checkpoint均满足TASK的8数组float64/shape/finite合同。未开始的incomplete可以全null；进行中的incomplete保留可用有限状态和真实已发生计数。
- 同一PDE/seed的基础方法与学习率必须复用同一初始化权重。续训initial必须逐参数等于选定父final。允许多个记录引用同一真实共享文件；完整优化器状态和随机状态与纯数值NPZ分开保存，评估者不执行候选pickle来评价网络。

## 真实执行证据

`attempts.jsonl`使用逐行JSON，逐尝试记录phase、阶段attempt编号、是否接受、更新前后训练loss、梯度无穷范数、参数变化无穷范数、原生计数、真实各类调用增量和累计值，以及UTC时间/单调耗时。L-BFGS附全部实际closure试探点标识、损失/方向导数、步长与可取得的线搜索状态；NNCG附实际sketch种子/刷新、显式及递推PCG残差、曲率、gᵀd、Armijo两边和向量乘成本。按TASK保存停止证据与必要前后权重；不能用每100次的汇总证明中间未出现零步。

`execution.json`保存该实际执行的源码Git提交、argv、工作目录、开始/结束UTC、进程/自有容器身份、环境版本、实际配置参数、退出码和共享前缀/恢复来源。长进程可有多段执行收据，manifest引用汇总，原段逐一保留。PID（Process Identifier，进程标识）与容器内PID1不是跨进程身份凭据，记录外部容器ID或宿主真实进程事实。可信自有完整状态只用于复训/恢复，不向评估者提供自报推理函数作为权重评价入口。

这些日志和收据是待独立交叉核验的证据，单独存在或自述成功不证明训练真实发生。评估侧还会从公开输入在清洁新目录受控运行完整候选源码，复核方法、轨迹、计数、恢复和实际结果。结构夹具通过不能充当该验收。

## 同一checkpoint的结果质量

`profile.solution_selection`为每个PDE选一个**最终**数值checkpoint：seed345基础run的合格有限终态，convection还包括本注册五续训的合格有限终态；按评估者重算的终态训练total_loss最小选优，完全相等时config ID字典序。所有不合格则该PDE为null。`solution_checkpoints`只写ID，引用该run的final，不另选中间状态。续训基点选择仍按原profile.selection的三混合LR及较小学习率tie规则，二者分别计算。

从同一个选定checkpoint报告L2RE、全部8385公开评价点的PDE残差、每个初边值族质量，不拼不同模型的各项最小值。指标定义：`evaluation_residual_loss=.5 mean(r²)`，`evaluation_residual_rmse=sqrt(mean(r²))`；训练`residual_loss`保留原定义。`constraint_families`逐族给`count/loss/rmse`，其中loss同为半均方、rmse为均方根；convection/reaction是`initial_value/periodic_value`，wave是`initial_value/initial_velocity/boundary_left/boundary_right`。训练constraint_loss为按各族count加权的loss，不能改成无权族均值。

独立权重检查只能证明离散公开网格上的这些量。数值实现的1e-10/1e-9一致容差与物理解质量阈值分开；当前后者仍pending。结构/端点检查返回`artifact_contract_checked`仅表示注册覆盖、声明计数、文件/权重合同、配对及选优的检查，不认证逐尝试日志内容、训练来源、科学结论、恢复、完整复训或论文。`study_complete/solution_reproduced`必须经相应实际执行与独立审查后另行判断。

当前逐行字段和前置依赖按[TRACE-CONTRACT.draft.md](TRACE-CONTRACT.draft.md)明确；无更新的梯度终态检查不伪算attempt，shared prefix须提供完整可验证逻辑轨迹。科学结果与固定分母聚合按[OUTCOMES.draft.md](OUTCOMES.draft.md)，未评/未执行不再混称已失败或已有0分；原权重100/19+5及单final选择不变。

当前用户指定原生本机执行；载体、混合环境及闭合收据合同见[LOCAL-EXECUTION.md](LOCAL-EXECUTION.md)。原科学注册与质量要求不变。
