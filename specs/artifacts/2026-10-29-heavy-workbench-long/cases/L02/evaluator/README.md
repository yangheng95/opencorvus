# L02 每日研究执行与局部资格

`current-source/asof_input.py`是唯一发布时间投影；`check_projection.py`共享格式校验、独立SQL重建许可集合，绑定评估侧origin/horizon。`decode_materials.read_fact_tables`是全档案与每日原始packet共用的唯一UTC/单位/缺测解析。完整原始vintages和终审只在评估侧，不能挂给预测进程。

当前入口`run_l02_study.py`接受[候选自带数值程序合同](../public/EXECUTION-CONTRACT.draft.md)，声明predict/select/report的files/argv，执行器不固定Python文件或算法。`l02_execution`真实顺序执行1CPU/netnone/readonly root进程，SQLite记录唯一cell状态，原CID与accepted对象恢复；`l02_study_data`从唯一投影选原CSV，`l02_scoring`是唯一精确均值MSE/WIS、固定层级权重和完整分母聚合。预测器不拿标签/完整档案，selector只拿合法inner，全部正式数值完成后冻结report程序才得外层结果。参考方法池在[运行前注册](reference-pool.json)，它不是强制候选算法，也不是质量线。

[完整12outer/36inner数值参考](qualification/daily-full-reference/README.md)已真实闭环：主Jan/独立June/其余10组，共108forecast和12selector，每输出84格；独立核查源码/权限/指标/拟合来源和负结果通过。旧7点OLS与其专属qualify入口已从current-source退役，原程序仍在历史ZIP，不能作为每日fallback。新执行原件与独立审查按[资格记录](../../../../../records/2026-10/2026-10-30-heavy-workbench-l02-qualification.md)归档；数学质量底线/研究决策成品/完整rubric/冻结与候选有效小时尚未通过。

作者参考调用（原材料路径仅评估侧）：

```text
python current-source/package_l02_reference.py --pool reference-pool.json --out <全新作者提交目录>
python current-source/run_l02_study.py --submission <封存前提交目录> --raw <full-private> --material-contract material-contract.json --study study-contract.draft.json --out <全新目录> --image <评估者准备依赖镜像ID>
python current-source/run_l02_study.py --resume <原运行目录>
python current-source/summarize_l02_study.py --run <原运行目录> --out <全新重算目录>
```

正式执行注册全部outer，不能在同run替换或扩展。仅私有作者资格可指定`--author-diagnostic-outer-id`，不会向可重提候选释放外层反馈。代码入口没有总墙钟/模型token限制；每个数值程序参数和资源在真实收据记录。中断后核原容器/原件，不自动重跑已验收cell。旧120组的作者专用runner/summary源码只在历史ZIP，不提供当前双格式fallback。新代码只执行数值程序，不添加LLM路由、隐藏消息或host工具选择流程。

[主方原执行](qualification/main/result.json)是两个真实微型worker与解析对照；[独立最终审查](qualification/independent-review/REVIEW.md)及[机器结论](qualification/independent-review/stage-assessment.json)记录三个假通过/修复与唯一新cold。两边originals.zip保留原字节、实际命令/退出/挂载和所有首失败；主方初checker执行不冒称修后执行。当前局部blocking=[]不代表全题批准，不重复秒级实验凑工作量。
