# H05 横向对照与难度校准

目标：实际比较OpenCorvus与独立Codex的H05交付，再根据预注册规则决定并验证难度升级。原版OpenCorvus结果在[既有试验](../2026-10-29-heavy-workbench-h05-opencorvus/attempt-4-uncapped/README.md)。本次不设token总量截止，不把历史与新题混算。

结论：**旧H05两方都通过原业务标准，触发预注册的升级条件；旧题不足以证明小时级能力。** 这里是非盲开发难度探针，不是正式双盲排名。计划与完整证据边界见[本轮Recall](../../records/2026-10/2026-10-29-heavy-workbench-cross-system.md)。

| 对象 | 真实执行与复核 | 原诊断 | 原16业务叶 | 开发合计 |
| --- | --- | --- | --- | --- |
| OpenCorvus | Task自然完成34分25秒；主评估侧21.649秒、独立审查侧19.706秒清洁复跑 | 20/20 | 80/80，critical全部满分 | 100/100 |
| 独立Codex app agent | 新项目、无父历史；主评估侧65.438秒、独立审查侧62.364秒清洁复跑 | 20/20 | 80/80，critical全部满分 | 100/100 |

OpenCorvus原件绑定：`productPillar=code`，`builtin/base 2026.10.14.1`，`direct`原生Task，实际流式请求`gpt-6.1-sol`。不是Mission或持续Goal；没有总token/总墙钟截断。Codex原生协作工具不暴露实际模型身份、推理设置或完整用量，因此不作同模型速度/成本排名。复跑耗时只是交付程序耗时，不能当agent完整工作时间。

## Codex原件与独立核验

- [注册](codex-v01/registration.json)、[真实启动与交付身份](codex-v01/invocation-and-result.json)，候选本地提交`5977e59b483fca22ae59a8a1c6da302fac948291`；[可读提交](codex-v01/submission/)、[原件封存](codex-v01/original-submission.zip)。仅用原相同公开委托和四输入，未提供旧答案或评分器。
- 主评估侧仅取7份源码/策略与冻结输入，在新目录执行真实`reproduce.py`：[执行](codex-v01/evaluator/replay-execution.json)、[真实checker](codex-v01/evaluator/objective.json)、[独立SQL核验](codex-v01/evaluator/independent-database-check.json)、[输出原件](codex-v01/evaluator-clean-output.zip)。逐身份核对12个新数据库，720个唯一业务键，每租户52,680分、合计158,040分。
- 独立agent另建新目录实际运行：[执行](codex-v01/reviewer-replay/execution.json)、[独立观察](codex-v01/reviewer-replay/independent-observations.json)、[checker](codex-v01/reviewer-replay/objective.json)、[16叶评分与定位](codex-v01/reviewer-assessment.json)、[输出原件](codex-v01/reviewer-clean-output.zip)。直接检查14库、38子命令、四进程3292次投递、真实崩溃/重启及备份后缀追赶。
- 第一次Codex CLI同模型请求4.564秒后400/model_not_found、未执行题目：[注册](cli-model-infrastructure-error/registration.json)、[执行](cli-model-infrastructure-error/execution.json)、[流式事件](cli-model-infrastructure-error/visible-events.jsonl)。这是基础设施失败，不计业务0分，也没有静默切换模型。

## 难度判断与后续

旧题直接披露两项根因，单一小输入使正确复合业务键配合持久化事务或单账本视图即可解决核心，20个宽泛叶项的满分不能证明有分辨率。两方交付良好，但旧H05难度不足；其他九题尚无真实横向运行，不能据此宣布它们都容易或都合格。

原[工程升级调查](H05-upgrade-proposal.md)及[合同草案](H05-v02-contract-draft.md)已搁置，未作为小时级版本发布。最新验收要求为数小时**有效**论文理解、实现、实验、分析和独立复训；[长程Recall](../../records/2026-10/2026-10-29-heavy-workbench-long.md)保留原PaperBench来源、实验矩阵、真实GPU资格与尚未完成项。新长题尚未冻结/长跑，不能声称已经达到成熟benchmark标准。旧冻结输入中的额度文字仅为历史原件，当前及后续真实试跑遵照用户指示，不再以自设总token额度终止。
