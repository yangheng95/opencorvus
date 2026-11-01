# L02 清洁复建与冻结交接

## 入口和依赖

根submission.json严格仅含format/pool/programs。每个program.files是完整源码和静态资产闭包，argv是Linux字面命令，没有shell、变量替换或网络安装。依赖为Python 3、NumPy及Matplotlib；开发实跑使用ENVIRONMENT.md的既有镜像sha256:23ff8bfbf8055caa0b9fa5745ddb27cceea2f31d7d15b7a900c81112cdfe8ddf，入口/opt/cpsat/bin/python。不是要求其他环境安装同一宿主Python。Python/NumPy/Matplotlib实际版本由verify_delivery.py的容器检查记录，不以名称推测。

predict只需NumPy及标准库，select只需标准库，report需Matplotlib及标准库。无其他依赖、模型下载或预训练资产。将全部程序、pool和静态引用一起封存于首私有预测前；报告后得结果，不改变代码或参数。清洁程序目录只复制相应files即可运行。

正式输入/输出按INTERFACES.md：predict读取/input/method.json、/input/packet/下三文件，输出/output/result/forecast.json及fit-audit.json；select读取/input/inner.json和study.json，输出selection.json；report读取/input/results.json及provenance/manifest.json与其所有原产物，输出report.md/report.json、原结果和执行来源副本、CSV和三张PNG。输入只读，项目只读，输出新建，/tmp可写，单CPU无网。-B禁止写源码缓存；设置MPLCONFIGDIR=/tmp/mpl、OPENBLAS_NUM_THREADS=1、OMP_NUM_THREADS=1。报告目录内含静态原文与方法说明，可单独阅读。

## 从唯一开发ZIP清洁执行

在全新空目录解开交付源码包，保留原16公开输入，然后执行：

```text
python -B run_development.py --run-dir fresh-development
python -B verify_delivery.py --run-dir fresh-development
python -B -m unittest test_l02.py
```

宿主仅负责原公开ZIP解码/合法投影、精确研究指标与调用Docker；宿主需Python 3及NumPy（测试重放用），Docker CLI和可用Linux Docker服务、上述预置镜像。候选程序不见开发ZIP、后验尺度、宿主源码、网络或私有数据。run_development.py为可读候选开发工具，不是评估侧decoder、评分器或正式runner。

六个公开2023origin全部三方法真实执行。开发额外选择预测在各origin前48/44/40日执行两个选择方法，标签实际发布不晚于对应2023origin；但全年尺度仅2024可得，所以所有选择器的outer_origin_tick明确为公开截止2024-08-01，属于回顾性开发诊断，不能当2023的真实运营决策或私有注册inner。报告保留此范围与complete_assignment=false。正式评估侧另提供真实已发布固定尺度及注册3inner，当前程序无权替换。

每个cells/数字序号（从不使用method ID当路径）有input、project、output、execution.json、原stdout/stderr、native.json和packet-row-map.json。行映射指向原ZIP成员的真实行号；fit-audit中sources指向各自packet行号，二者连接闭合。原开发ZIP不修改。报告位于completed.json指向的cell/output/result。开发六origin外层预测18份、额外选择预测36份、选择6次、报告1次。科学/质量/正式完整性独立判断。

## 完成、中断和错误

forecast/selection/JSON诊断采用临时文件原子替换。独立调用应分配新/output，不把旧forecast当新成功。数据不足、坏网格、非整数L、缺少完整校准等抛具名异常并非零退出；失败目标不得删除。开发工具在create前保存命令，created后持久CID，真实inspect终态后持久退出码与输出，最后清理该CID；原容器从不按名字批杀。

同一个开发目录仅可复用已确认exited/exit0的原单元；源码与冻结副本直接比较，不使用自生成校验和代替行为检查。失败、creating/created/running或中断未收集单元均停止，不自动重启。操作者按execution.json中CID核实原Docker状态、保留原输出，再在新的run-dir重建开发实验；不宣称本开发工具具备评估侧SQLite、进程锁或掉电恢复能力。官方正式运行恢复按EXECUTION-CONTRACT.md由评估者负责。本地重跑仅公开开发，绝不用于私有反馈调参。

## 研究阅读与边界

METHODS.md给完整模型公式和时间语义，references/claims.json给核读原文主张映射。captcha响应仅为文献获取失败证据，不当方法依据。开发报告所有表格均由实测预测生成；固定参照私有预测不可用，不能宣布质量过线。未执行2025私有12outer/36inner，不能把18份开发外层预测叫完整正式交付实验。代码与静态资产可供随后独立侧一次冻结执行。

## R1报告修复与仅报告复建

独立审查发现数值正确但报告三处固定推论不随输入变化。报告现在按精确MSE差值分别计数改善/退化/同分，按节点覆盖相对名义值区分欠覆盖/过覆盖/恰等，按分位与mean实际行动损失区分高于/低于/同分；不由这些描述性结果推断原因或运营保证。预测、选择器、方法池及原数值实验未修改。

将更新的源码包和研究包解压到同一新目录（研究包保存原sealed-development及独立审查evidence.zip），无需重算预测：

```text
python -B verify_report_repair.py --output fresh-report-repair
python -B build_package.py --run-dir sealed-development --repair-dir fresh-report-repair
```

第一条实际运行8项叙述单测及5个report入口：原审查反例逐字节重放、退化/欠覆盖、同分/过覆盖/行动劣势、正负零混合、原自然开发结果。控制清楚标为SYNTHETIC，不是模型或私有成绩；引用原拟合诊断仅审计公开执行来源。所有输入、旧失败报告、新输出、命令、终态和原生收据持久保存；新目录必须不存在，失败不覆盖重跑。原反例及自然结果的11张CSV、原results/provenance和精确宏值逐字节比较，验证报告修复未改数值。

第二条从源码ZIP新解压目录在同一受限Linux镜像运行test_l02.py和test_report.py，共15项测试，并仅在报告源码/静态闭包与实测副本完全一致时打包修复报告。完整自然报告位置由repair目录verification.json中natural-development条目给出；sealed-development/completed.json仍指向保留的修复前历史报告。发布稳定副本delivery/report/report.md采用修复后自然报告。研究包同时保留原审查包，不改测试者证据。首私有预测尚未执行，最终含report的全体源码仍须一起冻结；后续私有结果不允许反馈调参。
