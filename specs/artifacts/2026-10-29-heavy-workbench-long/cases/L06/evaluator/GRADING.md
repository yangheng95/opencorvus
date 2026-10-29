# L06评估证据与聚合合同 · L06/0.2.0（已冻结）

唯一权重、critical及逐叶full/half/zero锚点在[当前rubric](../rubric.json)。[数值适配器](qualification/current-source/l06_numeric.py)自己从权威raw重算30叶；[完整聚合器](qualification/current-source/l06_grade.py)只将这些结果与评估侧独立审查的17叶合并，不从候选自报的分数、PASS、文件存在或solver状态推定成功。当前合同已获独立批准冻结；只有实际完整有效评估才可发布相应成绩，参考资格与候选成绩分别标识。

## 真实评分顺序与信任边界

评估者先封存候选完成版本和原始输出。另起只含源码、声明依赖与冻结raw的执行项目，新输出根完整实跑，记录实际argv、环境、PID/CID、挂载/文件选择和自然终态；源码检查确认不是复制旧答案。实际输出进入业务/数值checker，算法可以不同、最优动作不必与参考相同。D01评的是这次可重建的交付，不要求已通过的其他叶再重复拿分。

D02要求同一封存程序实际处理预注册报价控制及行序控制，分别从传入raw生成新输出，并独立核对30数值叶；基例参考不能套未知变体。不强迫正确策略翻转。变体参考的可达见证与候选程序在变体上实际执行是两个不同证据；有见证不自动给D02分。

审查者须实际读取代码/原始执行事实、业务核算、报告与运营表，并用view_image等打开真实图形。D08核对算法/库真实终态；D09核对本次未得到的可行解/界是否按真实未知报告，取得的结果与未取得的结果均由实际执行事实界定，不要求每个成功提交额外执行失败分支；D10核对本次输入/入口/参数。D07、E01–06、F01–05按唯一rubric的具体锚点评价来源、基线、业务解释、替代政策、操作交接、局限、真实图形与复建说明。诚实完成方法研究与可行运营/质量目标分列。

17叶输入是**私有评估证据**，必须由已分配的独立评估者制作，保存在候选输出之外；不把评分文件放进候选项目。聚合器校验身份、文件定位、证据类别和锚点合法性；这些结构检查不证明判断为真，也不替代执行或视觉复核。虚构rating不能因schema合格成为有效成绩。主评估者负责验证评审者身份/任务来源、归档原调用与观察，再接受其判断；目前是独立agent审查，不冒称专业人类认证。

## 17叶评审文件

传给CLI的`--submission-id`是评估者分配的匿名ID。`--delivery-root`为本次封存执行输出根，数值四文件须位于该根。`--review`位于私有`--evidence-root`内且在交付根之外。artifact_bindings的五个绝对路径必须等于本次实际数值输入路径，不能拿另一份报告的评级套当前计划。评估者在封存根只读评分，路径身份不能替代内容/行为正确性。

```json
{
  "format": "l06-review-evidence/1",
  "case": "L06",
  "submission_id": "anonymous-submission-id",
  "rater": {"id":"assigned-reviewer", "role":"independent_evaluator", "assignment":"actual authorized review invocation and scope"},
  "artifact_bindings": {"input":"<absolute raw path>", "normalized":"<absolute file>", "plan":"<absolute file>", "summary":"<absolute file>", "ledger":"<absolute file>"},
  "findings": [{"id":"D01", "judgement":"full", "observation":"actual located conclusion", "evidence":[{"path":"receipts/terminal.json", "kind":"process_receipt", "locator":"actual state/exit fields", "observation":"what was independently observed"}, {"path":"review/source-audit.md", "kind":"source_audit", "locator":"actual data and execution path", "observation":"what source inspection established"}]}]
}
```

每叶judgement为full、half、zero、candidate_incomplete、blocked_candidate、unassessed或evaluator_error。half仅允许rubric本叶有具体half锚点的12个人评叶；五执行叶为二元。所有已评判断都须有实际定位；引用ZIP时另给member。F04 full/half必须有rendered_figure证据，D01须process_receipt和source_audit，D02须process_receipt和business_oracle，D08–10/F05须process_receipt。类别是审查材料约束，不能按类别自动奖励通过。

缺少评估侧rating保留unassessed/assessment_incomplete、不出总分，不当成候选缺交。候选缺交或候选依赖阻断须评估者准确定位，计0分、分母仍100；设施故障或坏评审文件是run_invalid/无成绩，不能删叶重标100。evaluator_error使整次无成绩。12个人评叶只有full/half/zero三个已评分锚点，未评与0严格分开。

## 发布与比较

未冻结、前置资格未关闭或任何叶未评，total_score始终null；任何已验证关键失败可立即判business_success false。正式冻结且评估完整有效时才按固定100分权重求和；全部critical为verified_pass才可business_success true。D02属于必须的输入计算行为，已设critical：数值输入失败即使96分也不能判好；评估尚未执行控制仍是unassessed。总分与关键成功分列。“好”预注册为分数至少90、全部critical通过且真实源码复建成立；两新系统都好则升级新版本，保留旧版与成绩。90是本套作者决策规则，不宣称成熟benchmark统一阈值。

CLI退出码0表示完整有效评估（当前草案仍不发布分数），2表示已确认关键失败，3表示run_invalid，4表示assessment_incomplete。退出0本身不能代替各叶/成功判定。

计时分开任务墙钟、实际模型请求、工具/子进程活动，重叠区间取并集；准备、暂停、排队和无可观察证据空档单列，不把未知间隙当隐藏有效推理。快而正确的完成被接受。当前约7分钟主参考、约21分钟独立参考都不是候选数小时证据。

多质量校准应使用真实高质量参考、可定位半分材料及物理/质量失败对照，独立审查者不知构造标签/系统名；披露此前对原参考的熟悉程度与agent身份。记录逐叶分歧、复核与未解歧义，不用一次一致或合成评分schema证明专业/统计成熟。本地开发组件校准与最终合同审查已关闭；fresh双系统pilot、真实候选评价、有效小时和十题升级仍须另行实证。
