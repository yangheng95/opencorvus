# L06实质重建研究：原海运库存路径问题

这不是0.5题包、冻结合同或重型资格通过。旧0.4题面/分数只读，新candidate和重复旧测试已停止。

实施前Recall、来源比较、影响面、首轮原实例和真实输出要求在[主记录](../../../../../../records/2026-10/2026-10-29-heavy-workbench-long.md)的“实质重建”节。当前采用MIRPLIB原问题调查路线、库存、泊位、装卸和现货的实际经济质量，不能从文献声称困难就宣称本题已获区分度。

原问题资料来自[MIRPLIB](https://mirplib.scl.gatech.edu/instances)，相关成熟评价依据为[ML4CO组织者论文](https://proceedings.mlr.press/v176/gasse22a/gasse22a.pdf)。第三方数据许可尚未核清，原始下载保外部本地缓存；这里不对原资料改许可证。

当前未完成完整新题、公平可达的质量评价、完整参考/错误programme/实际图/一次整审及fresh实测，不能计作完成题数或有效小时。

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
D:/new-own-mirplib-env/Scripts/python.exe -B fetch_originals.py --out D:/new-own-mirplib-run/original-inputs
D:/new-own-mirplib-env/Scripts/python.exe -B run_original_baseline.py --original-inputs D:/new-own-mirplib-run/original-inputs --out D:/new-own-mirplib-run/native-first
D:/new-own-mirplib-env/Scripts/python.exe -B complete_published_routes.py --original-inputs D:/new-own-mirplib-run/original-inputs --out D:/new-own-mirplib-run/published-route-completion
```

后续仍须自主路线算法、从原运营数据到原模型的语义核对、完整研究方案/质量轨迹与实际图/报告/移交、真实错误programme/一次整题审查及合法fresh对照。原已发表路线只是控制；不能将其补全结果当新作者100，不能自动创建0.5或启动candidate。

## 首个自主方法尚未产出可行计划

[时间分解程序](run_temporal_routes.py)在首次计算前登记四个前沿15/25/35/45、每段15秒，只读原MPS，保留全45期物理约束、暂放松远期整数并拟逐步提交早期决定。没有读取官方MST或控制向量。

[真实原生运行](observations/native-temporal-first.terminal.json)11:16:33→11:17:19Z自然exit0，内部44.9243957秒。三例均在首个15前沿没有找到条件可行解，25/35/45从未执行，全部`solution_produced=false`、原可行目标null；[完整研究末态](observations/native-temporal-first/execution-terminal.json)保实际分支与计数。没有加时、调窗口重跑或加载已发表路线补成功。

这是自主方法的真实失败记录，尚不是可复现完整参考、资格通过或模型得分。提交决定、后续前沿与完整算法成功路径尚无本次执行证据；原已发表路线控制不替代它。接下来需实质算法与完整任务工作，不能循环改变窗口或换题编号冒进展。
