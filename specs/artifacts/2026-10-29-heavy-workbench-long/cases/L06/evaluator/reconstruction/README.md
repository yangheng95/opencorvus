# L06实质重建研究：原海运库存路径问题

这不是0.5题包、冻结合同或重型资格通过。旧0.4题面/分数只读，新candidate和重复旧测试已停止。

实施前Recall、来源比较、影响面、首轮原实例和真实输出要求在[主记录](../../../../../../records/2026-10/2026-10-29-heavy-workbench-long.md)的“实质重建”节。当前采用MIRPLIB原问题调查路线、库存、泊位、装卸和现货的实际经济质量，不能从文献声称困难就宣称本题已获区分度。

原问题资料来自[MIRPLIB](https://mirplib.scl.gatech.edu/instances)，相关成熟评价依据为[ML4CO组织者论文](https://proceedings.mlr.press/v176/gasse22a/gasse22a.pdf)。第三方数据许可尚未核清，原始下载保外部本地缓存；这里不对原资料改许可证。

当前已有原问题实测与实际质量图，仍未完成完整新题、公平可达的质量评价、完整参考/错误programme/一次整审及fresh实测，不能计作完成题数或有效小时。

## 原问题首轮实测

第一次计算前在主记录固定三个原45期实例，单CPU线程，PySCIPOpt6.3.0，成熟算法保留，数值可行容差1e-8。每例一次60秒原MPS完整求解，11:00:10→11:03:11Z实际native0，三例均time-limit且未发现可行解；不是工具失败，也没有候选得分。没有加时或更换原实例重跑。

官方MST仅给全部整数路线，未给连续装卸和库存。随后固定原已发表整数，真实LP补全三完整原模型；合计2.0709316秒，逐一用独立标准库reader重算原约束、界、整数性和目标。它是已发表路线的可达性控制，**不是自主发现路线的参考算法**；三个`optimal`仅指固定路线后的问题，不能当原MILP最优。

| 原实例（均t45） | 原60秒运行 | 已发表路线补全后的可行目标（原MPS最小化） | 独立原约束重算 |
| --- | --- | --- | --- |
| LR1_1_DR1_3_VC1_V7a | 无可行解 | -13272.086123138663 | 7909行、8045变量，全部满足 |
| LR1_2_DR1_3_VC3_V8a | 无可行解 | -12010.195344820282 | 12325行、12745变量，全部满足 |
| LR2_22_DR2_22_VC3_V10a | 无可行解 | -24749.808525111606 | 26234行、24631变量，全部满足 |

原数值与限度在[首次原生末态](observations/native-first.terminal.json)、[完整原问题结果](observations/native-first/execution-terminal.json)和[已发表路线控制](observations/published-route-completion/execution-terminal.json)。这支持“确有可行计划，路线选择与连续补全是不同工作”；尚不能证明重型难度、候选数小时有效工作或质量区分度。L01与本CPU研究同时运行，也不能据此作绝对速度排名。

原输入/原完整模型、MST、完整解向量和所有运行输出保在`D:/opencorvus-benchmark-runs/l06-substantive-reconstruction-20261031`；仓库只保自写程序、实际参数/日志/数值验证和来源成员事实。第三方原始ZIP和数值向量未以本仓库许可证再分发。外部[原料获取收据](observations/acquisition.json)记录原URL/字节/成员；这些身份事实不替代约束和目标的功能验证。

## 从原料重新运行的方法

以下用于全新的自有研究目录，不应据此重跑已完成的首轮：

```powershell
python -m venv D:/new-own-mirplib-env
D:/new-own-mirplib-env/Scripts/python.exe -m pip install -r requirements.txt
D:/new-own-mirplib-env/Scripts/python.exe -B fetch_originals.py --group 1 --out D:/new-own-mirplib-run/original-inputs
D:/new-own-mirplib-env/Scripts/python.exe -B run_original_baseline.py --group 1 --original-inputs D:/new-own-mirplib-run/original-inputs --out D:/new-own-mirplib-run/native-first
D:/new-own-mirplib-env/Scripts/python.exe -B complete_published_routes.py --original-inputs D:/new-own-mirplib-run/original-inputs --out D:/new-own-mirplib-run/published-route-completion
```

后续仍须自主路线算法、从原运营数据到原模型的语义核对、完整研究方案/质量轨迹与实际图/报告/移交、真实错误programme/一次整题审查及合法fresh对照。原已发表路线只是控制；不能将其补全结果当新作者100，不能自动创建0.5或启动candidate。

## 首个自主方法尚未产出可行计划

[时间分解程序](run_temporal_routes.py)在首次计算前登记四个前沿15/25/35/45、每段15秒，只读原MPS，保留全45期物理约束、暂放松远期整数并拟逐步提交早期决定。没有读取官方MST或控制向量。

[真实原生运行](observations/native-temporal-first.terminal.json)11:16:33→11:17:19Z自然exit0，内部44.9243957秒。三例均在首个15前沿没有找到条件可行解，25/35/45从未执行，全部`solution_produced=false`、原可行目标null；[完整研究末态](observations/native-temporal-first/execution-terminal.json)保实际分支与计数。没有加时、调窗口重跑或加载已发表路线补成功。

这是自主方法的真实失败记录，尚不是可复现完整参考、资格通过或模型得分。提交决定、后续前沿与完整算法成功路径尚无本次执行证据；原已发表路线控制不替代它。接下来需实质算法与完整任务工作，不能循环改变窗口或换题编号冒进展。

## 成熟整数构造试验也未找到路线

[构造程序](run_constructive_routes.py)按事前登记把原连续数量暂限制为整数，以CP-SAT找首解，再拟由[原模型优化阶段](refine_constructed_plan.py)处理实际经济目标；没有读取MST/控制解。第一轮三例CP均UNKNOWN、无向量，后SCIP阶段全部未执行，原成本和分数null。[原native末态](observations/native-constructive-first.terminal.json)11:38:05→11:39:40Z实际exit0，研究内部92.1663761秒。不能拿CP无目标响应中的0作经济成本，不能将原不可行与未知混同；优化阶段没有本轮执行成功证据。

目标声明新合同有一次必要局部正向重算：[未声明/真实声明原目标](observations/nullable-claim-original-model-check.json)使用同一已闭合真实原模型和完整向量，前者一致性null，后者true。这不是重跑原LP，也不把此局部信息合同算新构造方法成功或整题资格。

## 已取得正确计划之间的真实经济质量差异

Group1侧重找到任意可行解，连续短冷启动不能建立所需质量层次。按[Group2原模型](https://mirplib.scl.gatech.edu/sites/default/files/Group2_MIP_Model.pdf)的不同结构，在首次本机结果前登记三个原120期实例：船类聚合、每区一个港、整载运输，损产/缺货以显式代价进入目标。没有把Group1数据放大或将其原失败换成新成功。

首次Group2完整源执行11:49:55→11:52:56Z原生exit0、内部180.022284秒。下表中的首解和终解都满足同一原问题，**不是一份错答案和一份对答案**；全部实际BESTSOLFOUND向量均由原MPS独立重算约束、界、整数性与原经济目标。此处没有作者100、候选成绩或新评分线。

| 原实例（t120） | 首个实际可行成本（约） | 终值原可行成本 | 求解器终态下界 |
| --- | --- | --- | --- |
| LR1_DR02_VC01_V6a | 1389364.23 | 55730.689596818054 | 32031.272148783784 |
| LR1_DR02_VC05_V8a | 1313142.66 | 162058.53609443826 | 35918.905468874844 |
| LR1_DR03_VC03_V16a | 1837581.53 | 201932.05230586205 | 71454.3854662436 |

均为time-limit，未证最优；下界是求解器报告，未冒独立精确最优证明。具体首值/事件/数值误差以[完整原质量研究](observations/native-group2-quality-first/execution-terminal.json)、原事件及[作图数据](figures/plot-data.json)为准。原问题允许有代价的损产/缺货，不能把它偷偷变成另一个“必须零缺货”的隐藏硬约束。

![实际经济质量轨迹](figures/actual-quality-trajectories.png)

![实际库存与损产缺货量](figures/actual-inventories-and-shortfall.png)

两图实际呈现并查看；首版和补显式Alpha图例后的原图/源/命令均保。时间是每例BESTSOLFOUND的实际观察wall时间，含读入、搜索及记录开销，原始求解器时间另外保留；终态下界只画在终态时点。不据此作速度排名/有效小时结论。真实可行质量跨度支持继续建设评价，**不等于该来源已经成为合格重型benchmark**。

复建只对新的自有目录执行；当前已完成研究不得重复求解：

```powershell
python -m pip install -r requirements.txt
python -m pip install -r plot-requirements.txt
python -B fetch_originals.py --group 2 --out D:/new-own-mirplib-run/original-group2-inputs
python -B run_original_baseline.py --group 2 --original-inputs D:/new-own-mirplib-run/original-group2-inputs --out D:/new-own-mirplib-run/group2-quality
python -B plot_quality_axis.py --run D:/new-own-mirplib-run/group2-quality --out D:/new-own-mirplib-run/figures
```

原始输入ZIP/全部原矩阵和解向量继续保外部；本目录只保自写源、原生日志/质量事件及重算/图，范围见[本轮原件清单](observations/constructive-and-quality-scope.json)。缺少的仍是完整新任务/公开质量合同、强弱正确方法锚点、全链科学研究与移交、同checker错误programme、一次集中整题独审及后来合法fresh实测；禁止机械0.5和当前启动candidate。

## 运营计划、经济账与实际移交

[完整任务与输出合同草稿](TASK.reconstruction.draft.md)已明确科学研究目标和未冻结范围。[三份实际运营交付](operational-delivery/README.md)与[真实原生命令移交](operational-delivery/HANDOFF.md)来自已闭合的原计划，没有重新求解。30条匿名路径完整分解562个原弧单位，1200行港口账闭合，最大库存残差2.842170943040401e-14；原数学行/界/整数/目标与raw船队、初始库存/容量、航时、前120期生产消费、泊位和成本来源均已实际核对。

原初始source弧要支付目的港费，原人工sink退出弧也参与本港装卸/泊位和终点调整；三例实际费用分解及匿名路径图没有把它们省略或伪造现实未来航程。同类流的一种路径分解不等于原船名的唯一未来分配。raw元数据360期与原MPS120期边界明确。

这些核对支持已列字段与原模型/当前计划一致，尚未独立重建raw到MPS的完整生成器和全部允许弧集合；没有将未核生成规则作为另一份隐藏评分标准。

首导出器source费用误设0、第二例原多类航时文件误读两项设施失败及原源/全部命令保[原件范围](observations/operational/scope.json)。港费修后首例成功，单一格式解析修后仅执行第二/第三例，未重已成功首例或任何solver；两个成功源版本据实记录，不冒同一源码的全新cold或独立整审。全部运营CSV/完整原向量保外部，仓库交付报告/图/源/原检查与范围清单。

原站当前记录三例120期可行成本33809/36659/82837，远低于本轮原计划55730.69/162058.54/201932.05；[来源记录](observations/operational/group2-published-table-operational-context.json)与[原表数值](observations/operational/group2-published-scalar-context-rows.json)明确它们是舍入网页事实，未将其冒本机独立最优证书或新通过线。现有合法解仍有明显改进空间，文件齐全不代表经济质量高。

当前仍缺更强研究方法/有依据的质量锚点、正式质量标尺和整题正错程序/一次集中独审与fresh测量；本轮运营交付不计作合格重型题数或有效候选小时。

## 整类时间网流的实际方法对照

[首次成对研究报告与实际曲线](method-study/README.md)已完整执行。同一原可行起点、同一预登记120秒名义方法wall，两例分别将全模型热搜索和一次整类对串行pass比较；单线程/seed0/原模型/成熟算法保留。原单类例没有再跑一个结构重复的“类对对照”。

| 原实例 | 全模型热搜索成本 / 实际秒 | 整类对成本 / 实际秒 |
| --- | --- | --- |
| LR1_DR02_VC05_V8a | 114048.99020035022 / 120.2398 | 41950.612252912506 / 90.4147 |
| LR1_DR03_VC03_V16a | 182399.0062253472 / 119.7144 | 159303.84020757372 / 120.7171 |

五类的10段条件最优后自然提前结束，三类的3段均time-limit；条件最优和条件界不能冒原模型全局最优/界。46个实际原生改进事件与四终值均核原约束/整数/目标，四份新运营计划/账也真实导出；完整向量/16CSV保外部，[原件范围](observations/class-pair-study-first/scope.json)列每项。没有重复旧冷基线或组件资格，没有按结果换预算/排序或新建候选。

这证明此轮方法对照有实际经济作用；两个公开实例、单次受控研究还不能证明未知输入泛化、无污染、统计区分度或有效小时。正式质量标尺/完整新题正错programme和一次整审仍待，不能按这些数值倒填新的100分线。

当前运营导出CLI已改为显式原MPS、完整向量、真实目标声明和计算作用域，不再要求作者baseline目录/文件名。历史交付中旧命令只对应其已封源码版本，不保当前fallback。当前命令为：

```powershell
python -B export_operational_plan.py --original-mps <original.mps> --values <actual-values.json> --reported-objective <genuine-native-quote> --computation-status <actual-status> --computation-scope original_model --raw-archive <Group2_data_format_only_files.zip> --instance <original-name> --out <new-output>
```

类对pass使用`--computation-scope conditional_pass`且不传原全局界；真正没有目标声明时省略该声明，一致性保持null。原数学reader仍唯一，不重算期望自比。四臂原生→原向量/真实声明→运营账→实际报告/图的本轮全链有记录，但没有冒同一源码的新cold或整题独审。
