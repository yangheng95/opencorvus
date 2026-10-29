# L01 物理信息神经网络优化器研究：实现、实验、论文与复现

本题研究物理信息神经网络（Physics-Informed Neural Networks，PINNs），是《Challenges in Training PINNs: A Loss Landscape Perspective》（Rathore等，国际机器学习大会，International Conference on Machine Learning，ICML2024）的**公开限域派生研究**。阅读随包原论文、图和补充说明，从头完成研究方案、实现、数值验证、训练、诊断、论文和复现交接。不要把本题结果称为官方PaperBench分数或完整原研究复现。

当前版本为未冻结审查稿。最终冻结文件将去除本句并给出已审查的精确实验清单。允许中文或英文。负结果应如实报告；不得编造实验、引用、时间或声称尚未完成的训练。

## 研究问题与范围

在固定三隐藏层、每层100节点、双曲正切tanh激活、线性单输出的全连接网络上，比较Adam、L-BFGS（Limited-memory Broyden–Fletcher–Goldfarb–Shanno，有限记忆拟牛顿法）和Adam后切换L-BFGS，研究优化停滞与PDE（Partial Differential Equation，偏微分方程）残差/真实解误差的关系。进一步在convection最优指定混合配置上研究NNCG（NysNewton-CG，采用Nyström预条件共轭梯度的阻尼牛顿法）与GD（Gradient Descent，梯度下降）续训。

本研究不是原论文跨4宽度、5种子、全部学习率和3切换点的完整搜索。三问题默认配置仅seed345；convection默认配置补充456/567；学习率敏感性仅convection seed345。明确区分单问题配对稳健性、单种子敏感性与跨问题移植，不把19配置当19个独立统计样本，不外推reaction/wave跨种子稳健性，不声称全网格最优。原论文数值只作有标注参考，本题采样/误差网格口径不同。

## 精确数学与数据合同

坐标输入为原始`[x,t]`，不缩放、嵌入或加入傅里叶特征；模型不读取解析解作预测。参数与运算float64，Xavier normal初始化gain=1、bias=0。固定初始化顺序：`torch.manual_seed(seed)`，在CPU（Central Processing Unit，中央处理器）依次构建2→100→100→100→1的四层Linear与隐藏tanh，移动到CUDA（Compute Unified Device Architecture，统一计算设备架构），依层在CUDA调用`torch.nn.init.xavier_normal_(weight,gain=1)`及bias置零。初始化位置、设备和随机生成器不能混用；保存每seed未训练权重并在所有方法/学习率间复用。训练仅用残差、初边值条件，不以额外解析解监督拟合。

- Convection：x∈[0,2π]，t∈[0,1]，`u_t+40u_x=0`；初始`sin(x)`，周期边界值配对；解析解`sin(x−40t)`。
- Reaction：x∈[0,2π]，t∈[0,1]，`u_t−5u(1−u)=0`；初值`h(x)=exp(−(x−π)^2/(2(π/4)^2))`，周期边界值配对；解析解`h exp(5t)/(1+h(exp(5t)−1))`。这里没有空间扩散项。
- Wave：x∈[0,1]，t∈[0,1]，`u_tt−4u_xx=0`，初值`sin(πx)+0.5sin(5πx)`、初始速度0、两端Dirichlet值0；解析解`sin(πx)cos(2πt)+0.5sin(5πx)cos(10πt)`。系数为4。

随包每个问题的NumPy数组归档（NPZ）是公共训练/评价数据。权威生成规则：残差候选网格x为257等距含端点网格去掉两端（255点），t=j/101、j=1…100；按x主序展平，NumPy1.26.4 `default_rng(20261029).choice(25500,10000,replace=False)`抽样。所有训练seed共用此数据。初值257个等距含端点x、t=0；每边101个等距含端点t，两边同t配对。公开评价网格为129个含端点x×65个含端点t、x主序，共8385点；评价集不作为监督训练集。评估者自行按规则重建全部点。

损失`L=.5 mean(residual²)+.5 mean(concat(constraints)²)`。convection/reaction的constraints按顺序拼接257个初值差和101个周期两侧值差，共358个标量；wave按顺序拼接257初值差、257初始速度、101左边界值和101右边界值，共716个标量。不得分别mean每组后再求和。L2相对误差（L2 Relative Error，L2RE）定义为`L2RE=sqrt(sum((prediction−exact)²)/sum(exact²))`，在全部8385评价点计算；同时报告训练残差项和条件项，不能混淆训练损失、评价误差或与原文不同口径。

## 基础矩阵：19个唯一配置

每个配置最多41000次**实际优化更新**。这是预注册实验轨迹长度，不是agent token/总墙钟预算。

Adam统一`betas=(.9,.999),eps=1e-8,weight_decay=0,amsgrad=False`，仅学习率按矩阵变化；不加调度器、裁剪或正则。网络调用中的train/eval模式不含dropout/batch normalization。

1. 每个问题seed345分别跑Adam、L-BFGS、Adam11000更新后切换L-BFGS30000更新，计9配置。Adam学习率convection为1e-4，其余1e-3。
2. Convection seeds456/567各跑以上3方法、同默认学习率，计6配置。
3. Convection seed345另在1e-3、1e-2学习率各跑Adam与11k切换混合，计4配置。

L-BFGS统一lr=1、history_size=100、strong-Wolfe线搜索；`.step`尝试、native内部迭代、非零参数更新和closure（损失与梯度回调）分别计数，必须记录最终梯度、步长、线搜索状态。PyTorch2.7.1实现允许使用，每次`.step`设`max_iter=1,max_eval=25,tolerance_grad=1e-9,tolerance_change=1e-15`。`max_eval`不是本题的closure硬上限，native线搜索可以有更多真实评估，全部计入。不得把closure次数当更新次数，不得把`.step()`返回的旧损失当最终损失。

Adam必须实际完成11000步才可进入固定切换分支；若此前非有限，整个对应混合配置为数值失败，不提前切换。L-BFGS终态分别为`max_updates`、`gradient_converged`（梯度无穷范数≤1e-9）、`finite_plateau`（连续25次非零更新同时满足参数变化无穷范数≤1e-12且损失绝对变化≤1e-14·max(1,|旧损失|)）、`optimizer_stalled`或`numerical_failure`。Adam非混合配置仅在非有限值失败时提前结束。

`optimizer_stalled`用于有限梯度仍高于阈值但native直接返回零参数变化的情形，包括`gᵀd > −1e-15`方向导数保护或线搜索返回零步长；它与收敛不同，不能当作有效更新。保存前后checkpoint、独立重算损失/梯度、native迭代计数、实际方向导数/步长及全部真实closure试探记录；无法取得的native内部字段明确未知，以实际可验证的试探点/损失/导数和源码路径为证。不得重复零步调用到41k或25次来凑次数。真实数值失败保留此前有限checkpoint、最后正常状态和具名错误，继续其他配置，分析其意义，不隐去失败样本。资源/工具异常或尚未结束的训练为`incomplete`，不能冒充数值失败。保存每项判据实际数值，不因“看起来收敛”提前结束。

相同seed/learning-rate的Adam前11000步可以合法共享给对应混合分支，保存共同分叉的模型、优化器及随机数生成器（Random Number Generator，RNG）状态及来源记录，累计工作量不得重复计费。方法比较按相同优化更新上限，同时另报真实耗时、closure数、梯度/Hessian向量乘次数，不能称为相等算力实验。

## 二阶方法、消融与故障恢复

按**训练损失**从convection seed345的三个混合学习率配置选基点，ties按较小学习率；不能按评价网格误差选优。候选限已完整到达`max_updates/gradient_converged/finite_plateau/optimizer_stalled`且终值有限的配置，排除`numerical_failure/incomplete`的中途checkpoint。三配置都无合格基点时，五个续训分支明确记`dependency_incomplete`，不能偷换其他seed/方法或把中途checkpoint称为已选最优。用同一合格基点进行2个GD分支（lr=1e-4、1e-3）及3个NNCG分支（阻尼μ=.01、.1、1），各最多200次实际续训更新。μ=1为本派生研究的额外阻尼敏感性设置，不能称作原论文同参数复现。

NNCG用真实全批Hessian-vector product，Nyström sketch rank20，每20更新刷新；PCG（Preconditioned Conjugate Gradient，预条件共轭梯度）每次初始解为0，最大200次，停止条件为`||b−(H+μI)x||₂/max(||b||₂,1e-30)≤1e-8`，其中b=−g。递推残差与显式残差分别保存，不能只信递推值。Armijo从步长1开始，c=.1、缩减因子.5，最多30次减半，验证`L(w+αd)≤L(w)+.1α gᵀd`。每步保存显式线性系统残差、方向与梯度内积、线搜索充分下降量、实际sketch刷新/向量乘计数。原PDF算法6的`v0`未定义，本题明确PCG分母为当前`pᵀ(H+μI)p`。非正曲率、非下降方向、达到PCG上限、线搜索失败均须具名记录，不得静默换成GD或另一优化器来充当NNCG。零梯度可作为`gradient_converged`终态，不产生伪更新。

Nyström合同：在CUDA上以float64和单独`torch.Generator(device="cuda").manual_seed(sketch_seed)`抽取标准高斯p×20矩阵，做薄QR分解（分为正交因子Q和上三角因子R）得Q，Y=HQ；ν=√p·eps64·||Y||₂，δ=max(0,−λmin(sym(QᵀY)))+ν，Ys=Y+δQ。以`C Cᵀ=sym(QᵀYs)`的下三角Cholesky构造`B=Ys C^(−T)`，薄奇异值分解（Singular Value Decomposition，SVD）得U,σ，λ=max(σ²−δ,0)。`P⁻¹v=(λmin+μ)U diag(λ+μ)⁻¹Uᵀv+(I−UUᵀ)v`。这是本派生任务明确的稳定化约定，记录δ及采样种子；Cholesky/SVD真实失败就具名失败，不能静默切换预条件器。sketch采样种子分别为20261029+分支索引×1000+刷新索引，分支μ=.01索引0、μ=.1索引1、μ=1索引2，刷新索引从0开始。

δ只用于投影/低秩近似的稳定化，不保证整个`H+μI`正定；实际PCG的曲率/方向仍须检查。预条件与原系统比较须用同一基点、同一右端项b=−g、同一μ、零起点和1e-8显式相对残差，比较中计入sketch成本。若做谱比较，采用对称变换`P^(−1/2)(H+μI)P^(−1/2)`，不能把非对称`P⁻¹H`交给对称Lanczos。

不能靠自称“NNCG”获得方法分。必须在已知正定二次问题上验算PCG解与显式残差，并用有限差分与独立自动微分交叉核对网络一/二阶输入导数、Hessian向量乘及预条件器。谱估计、NNCG晚期路径与最终结果锚点仍待评估侧资格，当前题面仍是审查稿。

续训遇到PCG非正曲率、迭代上限仍不满足显式残差、非下降方向、Armijo失败或非有限值时立即终止当前分支，分别标记具名算法失败，继续其他注册分支。一次失败是一次真实尝试，完整保留当次向量乘/closure成本，但不算接受的参数更新；不自动换阻尼、加rank或重试并隐藏失败。GD按固定学习率更新，若新状态非有限，保留此前有限状态并终止为`numerical_failure`。所有方法都须核对真实逐参数变化；有限但舍入成零变化的尝试记`optimizer_stalled`，不得增加接受更新数。零梯度可正常终止，不凑200步。谱/论文中的失败分析可以得方法与诚实分析分，失败不能冒充已复现的结果。

在被选混合基点，以可重跑Lanczos或其他明确Hessian向量方法估计至少5个极端特征值，给出Ritz残差；比较预条件前后的谱或可验证线性系统收敛，不把有限rank估计当整个Hessian严格条件数。

数值验收：NumPy独立标量指标与Torch在`atol=1e-10,rtol=1e-9`内一致；单位方向的梯度中心差分误差≤1e-7·max(1,|方向导数|,|差分值|)；Hessian向量差分误差范数≤1e-7+1e-4·||Hv||，差分epsilon=1e-5。测试至少含非平凡四层网络和已知二次矩阵，不能只测试解析解自洽。真实谱至少5个最大Ritz值须有`||Hv−λv||/max(1,|λ|)≤1e-3`证据；未达到者报告未收敛的估计并失对应结果分，不能删除残差或称为精确特征值。所有实际小/负Ritz值如实报告，不能据此声称完整条件数。

独立启动进程测试一次真实训练中断恢复：至少500个Adam更新后保存模型/optimizer/随机状态、退出训练进程；以新进程标识符（Process Identifier，PID）对应的进程恢复并再训练100更新，与未中断分支逐参数及损失数值比较，`atol=1e-10,rtol=1e-8`，报告真实最大误差。恢复必须依赖存盘状态，不能重跑前500步冒充恢复。再测试选定混合分支至少100次L-BFGS非零更新后的状态保存/新PID恢复，后续比较最多20更新或先到达相同合法终态，明确history与计数继承；容差同上。数值不一致如实失分并调查，不能事后放宽容差。

## 交付与评估

- `plan.md`：执行前形成研究问题、预注册矩阵、选优规则、失败判据和分析范围；偏离逐条记录。不得事后伪造注册时间。
- `src/`、锁定依赖、实际数值单测及命令；提交`run_study.py --output <新目录> --device cuda`，能够只用公共输入从头完成全部注册实验；支持`--only <config-id>`清洁重训、`--resume`实际恢复。全量复跑不读取本次旧训练结果或评估器。
- `results/manifest.json`按[OUTPUTS.md](OUTPUTS.md)的机器合同列出全部19基础配置和5续训分支的参数、初始checkpoint、父分支、实际更新、closure、梯度/Hessian向量乘、状态、停止理由、路径和开始/结束时间；真实进度与命令收据对应提交版本。保存init、11k分叉、final及关键续训checkpoint与实际训练轨迹，避免大量重复完整权重。每PDE按profile.solution_selection的训练loss规则选同一个final评价全部质量项；续训父选择单独保持原规则。
- 每个待评价checkpoint同时导出纯NumPy NPZ，仅`weight_0,bias_0,…,weight_3,bias_3`8数组，shape依次100×2、100×100、100×100、1×100与对应bias，全部float64、finite。评估者独立重算前向、PDE导数、损失、L2RE，候选推理函数和自报指标不能充当评分器。
- `paper.md`、`paper.pdf`、`figures/`、`references.json`：完整引言/方法/结果/讨论/局限；所有图由实际数据生成并实际查看，曲线标明更新/closure/秒单位、失败/停止状态、配对关系和本派生范围。报告原文Table2 convection NNCG为3.63e-7（Markdown抽取丢指数），不要照抄错误OCR。不得用论文数值充当本次结果。
- `reproduction.md`：环境、命令、源码版本、未决失败与恢复、重新训练和仅重新评价的区别。清洁环境评估实际重训与独立数值重算，不能只重新绘图/读取已交结果称作复现。

评估分别记录`study_complete`（协议与研究交付完成）和`solution_reproduced`（已知方程的解复现成功）。诚实负结果可以获得方法、执行和分析分，不自动等于解复现成功。后者要求每个PDE的同一合格checkpoint同时满足解误差、独立评价网格残差、各初边值质量底线；任一PDE质量失败不能由其他分数补偿。数值底线与选优/原子化细则必须经可达见证和低质量对照校准，并在冻结前公开；当前仍待校准，不能发布总成绩或据91分方法交付宣称整题成功。产品Task的生命周期完成只是一项执行事实，也不替代上述业务结论。

使用已准备本地Docker科学镜像和GPU（Graphics Processing Unit，图形处理器），在自己的运行目录创建自有容器；不要重启Docker或Windows Subsystem for Linux（WSL，适用于Linux的Windows子系统）、关闭用户进程或修改宿主全局依赖。只读取本项目公开输入和系统工具/已准备依赖，不读取仓库评分器、其他运行根、旧答案或私有凭据。禁止作者代码（随包blacklist）与外部模型；无须外部数据集或账号。原论文/图的许可与来源见随包SOURCE.md。

没有总模型token或总墙钟截断。环境准备、有效模型/工具工作、有效训练/复训和无活动等待分别记录；重叠时间不相加。不要等待凑时长，完成即交付；单次训练耗时长时保存真实进度与可复核状态，不能用心跳文字冒充工作。没有完成的配置如实报告，最终分数以实际执行与交付证据为准。
