# HeavyWorkBench-10 · 0.1.0-dev

十项从原始材料到可复核成品的重型工作任务。每题 100 分：4 个可执行诊断叶项共 20 分，16 个领域工作物叶项共 80 分；合计 200 个叶项。研究、组织和业务数据均为原创虚构资料，适用于开发评估，**尚未取得成熟 benchmark 的经验效度**。

| Case | 完整任务 | 工作链的关键瓶颈 | 最终工作物 |
| --- | --- | --- | --- |
| [H01](cases/H01.md) | 完整实证论文 | 聚类分配、差异失访、文献依据、稳健性与可识别结论 | 完整论文、图表、分析代码、可复跑包 |
| [H02](cases/H02.md) | 预测研究复现与扩展 | 时间边界、滚动预测、泄漏、消融与负结果 | 研究仓库、实验记录、报告 |
| [H03](cases/H03.md) | 年度经营分析 | 多币种、多状态、费用/现金口径、差异驱动与决策翻转 | 可重算工作簿、管理报告、核对底稿 |
| [H04](cases/H04.md) | 保数据版本迁移 | 身份规范化、货币精度、原子升级、失败恢复 | 实际数据库、迁移程序、读取接口、运维手册 |
| [H05](cases/H05.md) | 生产事故修复 | 跨租户身份、持久幂等、历史重放、重启与并发 | 修复服务、账本、事故报告、恢复实证 |
| [H06](cases/H06.md) | 采购库存优化 | 周期物料流、容量、加急、持有成本、供应压力 | 可行采购计划、求解器、决策包 |
| [H07](cases/H07.md) | 系统性证据综述 | 研究筛选、偏倚、异质性、合成与证据强度 | 完整综述、证据地图、提取及分析包 |
| [H08](cases/H08.md) | 资源受限项目交付 | 依赖下界与资源可行性、预算、延期重排 | 基础/压力排程、审批材料、风险及移交包 |
| [H09](cases/H09.md) | 课程与考核开发 | 学员分层、完整教学材料、可运行实验、量规与试教修订 | 六周课程、六个实验、考核、教师指南 |
| [H10](cases/H10.md) | 储能设计与投资决策 | 逐时能量守恒、效率、容量功率限制、现金流 | 实际调度、设计报告、经济模型、运维包 |

`suite.json` 是任务、公开委托、交付合同和 rubric 的唯一编辑来源；`cases/` 是其可读派生视图。`inputs/` 是冻结原始材料；`oracle/` 及 `reference_calculations.py` 仅属于评估端。参考计算只证明诊断子问题可解，**不是完整专家参考交付**。逐项证据范围见 [VALIDATION.md](VALIDATION.md)；正式协议见 [PROTOCOL.md](PROTOCOL.md)；与成熟方法的对照见 [COMPARISON.md](COMPARISON.md)；独立审查见 [REVIEW.md](REVIEW.md)。

在仓库根目录用 Python 3.10+ 执行（标准库，无新增 Provider 调用）：

```powershell
python script/benchmark/heavy_workbench.py validate
python script/benchmark/heavy_workbench.py prepare H01 D:/isolated-benchmark/H01-attempt1
python script/benchmark/heavy_workbench.py objective H01 D:/sealed-replay/H01 --out D:/evaluation/H01-objective.json
python script/benchmark/heavy_workbench.py verify-plan H06 D:/isolated-benchmark/H06-attempt1/inputs D:/sealed-replay/H06/allocation.csv --scenario base --out D:/evaluation/H06-feasibility.json
python script/benchmark/heavy_workbench.py grade H01 D:/sealed-replay/H01 --run D:/evaluation/run.json --review D:/evaluation/reviewer-a.json --review D:/evaluation/reviewer-b.json --out D:/evaluation/H01-score.json
python -m unittest discover -s script/benchmark -p test_heavy_workbench.py
```

`prepare` 只导出公开输入和用户委托，不创建沙箱、不调用模型、不保证隔离。`objective` 只检查传入的诊断表，不能证明谁生成了它。`grade` 要求实际产物定位、两份独立盲评以及复跑证据；本地无法认证操作者身份，结果始终 `comparable=false`，不能当作正式排名。受测 agent 必须在与仓库和评分端真正隔离的现有 Inspect/Harbor 执行环境中工作，详见协议。

`verify-plan` 独立验算H06的逐周物料守恒/采购约束、H08的工期/依赖/角色重叠/预算、H10逐时功率/SOC（荷电状态）/电网能量守恒，允许任意满足公开合同的正确计划。它只检查可行性，不证明最优性、经济建议正确或完整工作物通过。`python script/benchmark/verify_heavy_workbench.py --out <回执路径>` 可重跑全部诊断与七组基础/压力可行见证。

本包没有运行被测模型、没有职业专家完整交付、没有职业专家双盲校准，预算与 8–32 小时估计尚未实测。不得用“200 项通过”“独立 agent 看过”或诊断 20/20 宣称完整任务已通过、达到专家水平、或与成熟 benchmark 等效。所有缺口保留至真实证据取得，不能补造分数。
