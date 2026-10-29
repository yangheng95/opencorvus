# 原始材料到完整交付的源码参考

这是评估者参考构造，不是受测agent答卷。当前源码和用法见[reproduce.py](../../current-source/reproduce.py)与[README-reference.md](../../current-source/README-reference.md)。新整数执行统一为OR-Tools CP-SAT；同一build_model输出1488变量/1096行，与原注册模型逐业务对象相同。连续linprog承担不同数学任务，不是整数失败fallback；旧HiGHS执行仅留历史原件。

## 真实完整执行

[启动及只读输入集](full-cold/prelaunch.json)、[实际命令](full-cold/launch.json)、[容器终态](full-cold/terminal-inspect.json)表明project仅9源码+README/DATA、input仅11CSV+facility、新/results、networknone。未挂载旧矩阵/计划/hint、L、rubric或凭据。本次自然exit0，完整容器墙钟427.946551秒，main425.523913秒（不含imports）、solver423.676430秒，互相重叠不能相加。默认没有总solver时间限，8worker并非单核。

实际从raw编译新模型并搜索，123次真实改进incumbent；交付成本47746.2，第一可行基线49401.7，另一完整可行策略47747.7。native OPTIMAL是非零gap.009内，native界47323.7；它与预注册L是不同对象，不能替换注册参考或声称精确最优。按保持不变的注册参考实际进入[30叶numeric CLI](full-cold/evaluation/first-numeric.json)，30pass/17unassessed，无候选总分。

完整机器计划、ledger/summary、operations.csv、manifest/run、source-map、报告与PNG/SVG都在originals.zip:full-cold/results/delivery/；实际执行项目、原输入、模型、事件、原生日志亦同存ZIP。可解包到新目录查看，不覆盖原件。独立微型source-only冷跑5.92秒及完整小域枚举见[独立报告](../../../independent-source-reference/micro/REVIEW.md)，只认可微型范围。完整重排CSV后的独立源码复跑正在另一自有容器执行，当前不代签。

主方已真实打开三张16周PNG，核对现金曲线/信用底线、四费用构成、两类周内仓容、周序/单位/图例，没有UI自动化。原图可直接查看：[cash](full-cold/figures/cash.png)、[cost](full-cold/figures/cost.png)、[storage](full-cold/figures/storage.png)。

## 依赖与边界

实际reference镜像opencorvus-benchmark-reference:20261029、镜像ID见终态inspect，Python3.11.13/NumPy2.4.6/SciPy1.15.3/Matplotlib3.10.3/OR-Tools9.15.6755。初冗余下载构建被取消，原配方和原因保留；当前标准venv --system-site-packages使用镜像已有精确库并实际导入验证，没有改用户全局或L01环境。这不是完整可移植的传递依赖lock；正式候选环境仍须注册实际镜像/依赖。

新后端手算成本6/LP3、融资5/LP2、微型4.5及warm OPTIMAL6/INFEASIBLE真实合同通过。出处/命令/固定源在originals.zip:integer-qualification/与backend-contracts/。完整47叶、数值变体参考、人评校准和最终冻结仍未完成，约7分钟参考执行不是候选数小时有效工作或套件成熟证据。
