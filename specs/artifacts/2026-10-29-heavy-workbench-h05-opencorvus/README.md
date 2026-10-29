# H05 · OpenCorvus真实开发试跑

纠正：**用户未限制本次试跑的token额度。前三轮被本agent自行设置的评测器阈值提前取消，没有最终业务交付，不能据此声称用户预算不够。** 下文保留当时的全部原始事实；用户纠正后的无token截断开发运行已完成，注册与结果另行保留。真实运行使用`openai/gpt-6.1-sol`、`base`、`code`，经现有Inspect适配器进入OpenCorvus公共Task与生产流式执行路径。没有用参考程序冒充被测系统。

前三轮修复了两项本地评测工具问题，其原始记录全部保留，不选最好一次，也不把前两轮当正式Case成绩。

**用户纠正后的第4轮已自然完成并通过独立清洁复跑。** Task运行34分13秒；真实诊断20/20，外部独立agent逐16叶非盲开发评审80/80。三租户各52,680、720身份均经新生成SQLite逐键核验。完整原交付、两次评估侧真实复跑、审查和收尾见[第4轮：无token截断开发试跑](attempt-4-uncapped/README.md)。这是本题本机开发验收通过，不是正式盲评或排名资格。

| 轮次 | Task | 实例已记录词元 | H05归属词元 | 结论 |
| --- | --- | ---: | ---: | --- |
| [1](attempt-1-tool-budget-gap/summary.json) | tsk_g00VZMw8Ce00pQsoS61K | 2,060,878 | 2,027,671 | 启动器缺自动预算约束；评测资格失败，人工取消 |
| [2](attempt-2-budget-enforced/summary.json) | tsk_g00VZMzeYe00fLcMVyjK | 1,009,509 | 976,321 | 错把独立预检计入Case预算，提前取消；归属错误 |
| [3](attempt-3-task-lineage/summary.json) | tsk_g00VZN2mKc00HuXdJoOS | 1,121,851 | **1,088,634** | 正确按Task及子会话归属计量，结算后触发预算取消 |
| [4](attempt-4-uncapped/summary.json) | tsk_g00VZOYBUC00Kv0WzDFa | 20,934,376 | **20,901,186** | 撤除自设上限；自然完成，独立清洁复跑及开发业务验收通过 |

第三轮Task在北京时间2026-10-29 02:34:30–02:35:42运行约72秒，Inspect整体约80秒。预算100万；触发前998,170，末次结算增加90,464，累计1,088,634，179ms后发出公共取消请求。**这是按已结算用量触发的软阈值，实际超额88,634；不是严格零超额硬配额。** 独立预检33,217已分开，无归属用量0。使用[现有会话归属接口](../../../packages/opencorvus/src/engine/task-session-lineage.ts)的启动器结果，与独立只读SQLite（Structured Query Language数据库）父链重算的16个usage事件集合完全一致，详见[归属证据](attempt-3-task-lineage/case-accounting.json)。

第三轮Case用量集中在编排准备阶段：orchestrator 15次/1,085,561词元，memory 1次/3,073；缓存输入965,504。原始对话有15个已完成的读取/产物准备工具调用，没有worker业务调用或最终工作物。没有`service.py`或`reproduce.py`提交，因此没有执行清洁业务复跑，也没有给200项rubric（评分细则）中的本题20叶补造分数。Inspect的`task_completed=0`只表示生命周期结果，**不是0/100业务评分**；业务评分为null（未评估）。这组证据定位成本热点，不建立生产调度故障根因。

三轮原Task均最终`cancelled / inactive / running=0`，三个自有实例均已结清并删除配对凭据副本。原始预检证明凭据可用、模型已投影，实际请求模型精确一致且流式。第三轮18次请求均正常读到EOF（End Of File，流结束），与18条实例用量对应；前两轮分别有37/19次请求尝试、35/17条用量，失败或中止时未返回的消耗未知。记录中的价格估计不是外部账单，本次真实费用未知。

输入保持原H05委托与公开文件；没有修改生产模型路由、提示词、调度或冻结题目以追求通过。三份`registration*.json`均在对应轮次启动前写入。`result.json`保留总结果，每轮目录包含原Task/状态/可见对话、产物索引、用量、流式审计、预算事件和原始Inspect `.eval`。

此为单题、本机开发试跑，`comparable=false`。操作系统强隔离、CPU（Central Processing Unit，中央处理器）/内存硬配额未资格验证；独立agent做非盲证据复核，不是职业专家双盲评分或成熟评分器校准。完整结论见[独立复核](REVIEW.md)与[执行记录](../../records/2026-10/2026-10-29-heavy-workbench-h05-opencorvus.md)。

源码身份补充：注册文件保留最初源码基线；运行期间另有并行任务提交。根据启动时间与本地Git reflog，三次启动的checkout分别为b92f01e30、ff502f56a、9cf0ed178；检查的生产核心源码及专家包路径差异为空，但发布元数据发生变化。本次没有建立不可变运行镜像，不能把注册基线字段当三轮完整运行快照，详见[source-identity.json](source-identity.json)。

执行器仍为现有Inspect；新[薄启动器](../../../script/benchmark/serve_heavy_workbench.ts)只准备自有实例、审计与资源取消、收尾，不实现Task调度。命令中的项目/日志路径来自各自注册文件，第三轮实际调用：

```powershell
packages/inspect-benchmark/.venv/Scripts/python.exe -m inspect_ai eval opencorvus_inspect/opencorvus_benchmark -T dataset=D:/opencorvus-benchmark-runs/heavywork-H05-lineage-20261029-5402f7b6/dataset.jsonl -T base_url=http://127.0.0.1:7878 -T project_dir=D:/opencorvus-benchmark-runs/heavywork-H05-lineage-20261029-5402f7b6/project -T model=openai/gpt-6.1-sol -T prompt_profile=base -T product_pillar=code -T scorer=task_completed -T timeout_seconds=600 -T poll_seconds=5 --model none --ctl-server false --max-samples 1 --epochs 1 --log-dir D:/opencorvus-benchmark-runs/heavywork-H05-lineage-20261029-5402f7b6/inspect --display plain
```

重复试验必须新建运行根和公开输入项目，并在启动前新建注册记录；已封存目录不复用、不重置历史。凭据路径通过启动器显式参数提供，配对模型目录经现有primitive（基础组件）验证并与访问一起暂存，不把值放进任务。
