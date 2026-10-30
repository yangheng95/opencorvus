# L02 新 grader/来源绑定与40锚点：独立增量结论

**本轮发现的 B01 逻辑阶段遗漏已修复，原反例与必要正常路径复验通过，当前限定绑定组件没有尚存实质阻断。** 结论只覆盖已行使的 partial fail-fast、来源/阶段/私有pending review及锚点结构；不认可完整成功路径、38科学评审、正式全12参考或L02冻结。

我是熟悉作者参考的非盲AI-agent独立审查者。未再委托、未改主仓，未启动Docker、预测、solver、Provider、GPU、UI或用户进程。原状态组件的54秒旧请求、missing/native控制、本轮主方10组/77秒均未重复执行。

## 实际读审与新执行

读审当前 `l02_evaluation.py`、`l02_grade.py`、`l02_rubric.py`，以及其对唯一 `inspect_run`/`bound_execution`、实际selected记录、registered reference loader的调用；读当前唯一rubric与公开REVIEW-ANCHORS。初源、原rubric/公开锚点在 `source-initial/`、`rubric-initial.json`、`REVIEW-ANCHORS-initial.md`。主方10项原CLI的源码与必要命令/结果也只读核对，不把它们称作我的重跑。

唯一初始新增控制是 **一个评估端ledger-only mutation CLI**（见FINDING-INITIAL）。没有改候选程序，也没有生成预测。它证实旧 assignment 可被套到改变phase/failure后的原capsule：原C01候选失败消失为未评。该初失效源、变异副本、真实argv/returncode/stdout/stderr保留。

修复后仅做必要四条CLI及一项结果闭合：

| 控制 | 实际Python subprocess结果 |
|---|---|
| 原缺stage prototype assignment | exit3，facility_evaluation_stage_unbound |
| 从原真实阶段新prepare私有assignment | exit0，evaluation_assigned |
| 新包用于原ledger-only变异副本 | exit3，facility_evaluation_binding_invalid |
| 新包用于原真实run及自己的私有pending review | exit4，assessment_incomplete |
| 正常partial逐叶状态 | C01 verified_fail；C02及Q26共27blocked；38独立研究叶unassessed；total/study/quality/good均null |

五项通过，原始收据在 `repair/*-command.json` 和 `repair/assessment.json`。外层脚本exit0不是替代CLI退出码。自己的review只含 **38个unassessed**，标明熟悉程度和“纯协议夹具、无科学判断”，不把它当独立科学初评或候选分数。

## 修复与实际对象身份

修后 `capture` 在同一已有短owner锁内、给row附加objects前，封存原run完整 `{id,created}`、run_id、cell/event逻辑行，作为 `originals['ledger-snapshot.json']`。它是已有SQLite事实的一次内存观察，不写入原run、不增加DB/phase/运行登记；没有本次capture时间或临时路径导致伪漂移。原registration/capsule仍照原字节收集。

`load_assignment` 要求该stage对象并与当前同一capture闭合。旧prototype缺stage具名拒绝，不回填；原阶段有实际进展则需新assignment，不静默沿用旧review。新评估产物加必要事实没有重解释原schema1/phase/registration或覆写旧包。

比初源仅 `l02_sealed.py` 和 `l02_evaluation.py` 变化，实际diff见 `repair/source.diff`。我运行的修后四个核心源（这两文件及l02_grade/l02_rubric）直接字节等于主方封存 `source-stage-repaired`，含最后补充的run完整行（`repair-vs-parent-final-identity.json`）。没有把初版运行冒称执行了最终补丁。

## 锚点、数值来源与发布边界

`rules-audit.json` 的8项只读对照通过：66叶ID/原weight/critical/quality元组与前稿一致；40公开pass边界逐条等于rubric；85研究+15质量=100，38独立研究+2原执行checker+26质量；二元锚点含缺交/依赖/未评，没有half/N/A；原publication90与readiness未变。它们是结构/声明核对，不是40科学叶或26数值条件的本轮实跑。

C01由完整正式numeric原执行/检查结论得出；C02由实际selector及其完整合法inner得出。38研究叶没有由“verified总数”自动pass。Q26只读取原selector真实选中的原outer forecast，与评估侧原固定seasonal8 registry比较；不会读取报告自报selected、outer事后最优、候选自带弱baseline。固定参照预检在候选坏结果之前，主方原坏method+坏candidate设施优先收据已核读，没有重复该CLI。

私有评估包保存原registration/capsule/逻辑stage、rubric/policy/reference/expectedmethod和assigned reviewer/submission/version信息；review实际收到的assignment副本需和原包逐字节一致，且位于候选/run之外。原run及其原对象漂移、错submission/anchor/member等主方既有具名拒绝路径与新代码一致。这里是具体原对象身份闭合，不是可变source hash门。

schema/文件存在/引用member合法只证明结构与定位，**不能认证科学判断为真**。实际来源审查、图形呈现观察、权威引用核读及多质量校准仍由可信独立评估者完成。全材料/等价格式规则允许JSON/CSV/代码/公式/图的闭合信息，不强迫作者fit.json、ID、特定算法或版式；不以缺review当候选缺交。真实blocked依赖需根因；独立未调度保持unassessed。

固定分母100、全部critical、原26质量关系与90作者比较规则保持；设施错无成绩，draft/readiness未就绪或任何未评时总分null。当前受信任评审的存在和赋值仍须由主评估者核真实assignment/观察，不能凭一个合格JSON虚构38项pass。

## 未达成范围

没有完整real-success formal12新generic参考，没有首预测前全源/报告冻结后的新完整研究，没有38研究叶多质量真实评级/校准，没有新研究图的视觉审查；本阶段也没有新图或视觉结论。不能批准完整grader成功路径、case freeze、职业真人/统计成熟、候选有效小时、两系统排名或十题完成。上述仍需后续真实证据，不能由本次局部绑定通过外推。
