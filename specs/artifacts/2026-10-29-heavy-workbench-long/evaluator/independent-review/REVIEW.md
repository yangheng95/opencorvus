# L01 独立阶段审查与实际复跑证据

审查者：`/root/benchmark_review`。仅审查公开派生任务与评估工具，没有读取作者黑名单实现、凭据或秘密推理，没有再次委托，没有修改主仓库。所有本轮新文件仅写入这个自有外部目录。

## 当前结论

**具体前轮阻断已收敛；仍不批准正式冻结。** 本报告评价的是设计与数值工具，不是候选交付，不是官方 PaperBench 成绩，不是人类专家校准，也不是小时级有效工作已验证的结论。

已核对的题面与profile修正：19个配置及不同研究目的；固定11k实际Adam后切换；step尝试/native迭代/非零更新/closure分计；finite optimizer_stalled与收敛分开；失败续训至多200次、失败立即终止；父配置只取合格有限终态、全部无效时dependency_incomplete；固定初始化顺序/gain/Adam参数；显式PCG残差和零起点；Nyström投影稳定化不等于整个系统正定；对称预条件谱合同；明确恢复、有限差分和Ritz残差容差。

仍未完成：R9结果锚点；晚期已训练checkpoint上的NNCG稳定化、PCG/Armijo、谱路径资格；完整19配置候选运行及清洁重新训练；实际数小时有效工作的经验观察；专业专家校准与成熟benchmark经验认证。这些不由单测、早期GPU资格或本审查替代。

## 本审查者的新鲜实际执行

精确命令参数、UTC开始时间、退出码、耗时与原始stdout/stderr均在`receipts/*.json`及同名文本。复跑使用`reviewed-source/`中实际复制的快照，不依赖继续变化的主仓库文件。

- `numpy-tests`：本机Python实际运行15项数值测试，包含非解算子、非零wave速度、8数组导出加载与真实CLI；退出0。测试不是完整研究复现。
- `torch-cpu-tests-and-boundaries`：自有一次性CPU容器、无网络、未请求GPU、只读挂载本目录。实际运行3项Torch正向测试并执行L-BFGS和已修复分量导数探针；退出0。没有扰动候选Task或使用候选Python。
- `numpy-boundaries-and-deep-jets`：实际重现数值primitive允许任意数据时的单点完美指标，随后在权威网格得到正误差；另对非平凡四层tanh网络核对输入一/二阶有限差分，退出0。当前CLI由评估侧生成canonical数据，原CLI输入通路已关闭；primitive本身不是防投机评分器。

L-BFGS实际探针为`f(x)=.5*x^2,x=1e-8`，使用题面指定PyTorch参数。得到参数变化0、梯度无穷范数1e-8、closure1次、native内部迭代1次。这是有限停滞，不是梯度收敛或一次接受更新。它证明新增optimizer_stalled合同有实际必要性。

分量导数修复后，用`u=.2*x+.3*t+.7`的convection残差，实际得到梯度`[332,8.3,0]`；方向`[1,-2,3]`对应海森矩阵向量积`[1520,38,0]`。输出bias的数学零导数被正确保留，没有通过额外正则改变目标函数。

## 历史观察与原始命令

`historical/cpu-original-command.ps1`和`cpu-original-tool-output.txt`是本审查者前轮真实工具输入/合并输出的原文转录，工具chunk为`3dd260`。原轮次只含2项Torch测试，并确实出现分量梯度unused-tensor异常。原执行UTC未被工具记录，metadata中明确为null；没有补造时间，也没有把旧失败移到当前修复版本上重演。

历史源文件未单独封存，因此不声称其可从当前源码原样复现。当前3测试和闭式分量探针的真实新收据证明修复行为，历史原件说明缺陷发现过程。原生L-BFGS零步行为则在本轮已独立再次复现。

## 对主评估者GPU资格收据的核对

`observed-main-agent-receipts/independent-component-check.json`是只读复制的主评估者资格收据。本审查者没有冒称自己执行该GPU命令。`component-receipt-independent-arithmetic.json`独立按公开容差重算3问题×3分量的方向差分和海森矩阵向量积误差，并保留每个分量最大的5个Ritz值及合格数量。

9个方向/海森矩阵向量差分检查通过，并不意味着所有分量的5个Ritz值均已收敛；实际未收敛残差仍完整保留。该收据使用早期资格权重，不能代替晚期基点资格或候选实验证据。

## 复跑与范围

执行`python -B collect_review.py`可重跑收集流程；它只向自身所在的精确授权目录写入，不修改主仓库。该操作会更新本目录的新鲜收据和审查源快照；封存原件时应整体复制本目录后再复跑。

机器可读阶段结论见`stage-assessment.json`。本轮未增加研究要求，也未调整候选分数或终止任何运行。
