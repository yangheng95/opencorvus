# L02 归因与 partial 组件：最终独立结论

结论：**本轮发现的 B01 已通过唯一分支修复及必要真实 CLI 复验关闭，当前限定状态组件没有尚存实质阻断。** 可认可已实际覆盖的原对象/归因/缺交/依赖边界资格；不能据此认可完整 grader、40 叶锚点、外部 review/reference 闭环、新正式完整参考、L02 冻结、小时级或十题完成。

我是熟悉既有作者参考的非盲 AI-agent 独立审查者，未再次委托。主仓只读，未提交。只执行一次获准的缺交微程序，零科学预测；其余全部是既有原件的读取、一次旧完整请求重建及明确标为评估端 mutation 的协议控制。未使用 Provider、GPU、solver、UI 或用户进程。

## 真正执行的范围

| 对象 | 实际结果 | 精确证据 |
|---|---|---|
| 唯一新增正式注册缺 forecast 微程序 | native自然exit0/driver2；candidate_output_missing、candidate_incomplete；121 expected为1候选失败/2真依赖阻断/118独立未评，score与全期聚合null | `missing-forecast/driver-command.json`、`actual-facts.json`、`inspection.json` |
| 该新原件独立标量/raw/native核验 | 从原CSV origins与pool另构121身份，核依赖、冻结source、实际argv/权限/同CID，10项全过 | `audit_missing_facts.py`、`missing-facts-assessment.json` |
| 主方原bad-json与native-two | 只读原DB/terminal/native及create/start/rm；分别native0候选坏JSON、native2假报run_invalid仍候选程序失败。未重跑它们 | `audit/bad-json-original-facts.json`、`native-two-original-facts.json` |
| 一次旧完整请求纯只读重建 | 54.455878秒；11格全verified/9forecast、formal=false、旧report not_delivered；原canonical DB和capsule字节不变 | `audit/old-reader-receipt.json`、`old-complete-summary.json`、`checks.json` |
| 合法原输出但评估端改标failed | 真L02原capsule副本，改副本ledger及移除副本accepted；实际CLI正确run_invalid/facility_failed_outcome_contradiction | `audit/valid-output-failed-command.json`及对应result |
| B01原反例与修复 | 原CLI exit4误判候选失败；修后原副本准确exit3/run_invalid，0候选失败/1facility/120未评 | `REVIEW-INITIAL.md`、`audit/contradictory-native-reason-command.json`、`repair/original-contradiction-command.json` |
| 修后原正常missing回归 | Python subprocess准确exit4/assessment_incomplete，原1/2/118及candidate_incomplete不变 | `repair/original-missing-command.json`、`repair/assessment.json` |

唯一新 CID `b03ff24e4d1a0a1c108d0d08d3a9bc019bf17fb90e639d324fc18c3863a9cf06` 已自然退出并先封存terminal再精确cleanup；原create/start/rm各一次。inspect证实1CPU/netnone、rootfs/project/input只读、新output。driver host14.510841秒，控制含原inspection的wrapper22.452519秒；native精确起止在actual-facts。没有第二Docker、没有新预测矩阵，也没有重复旧54秒reader。

## B01的根因与修复

初源 `source-executed/l02_sealed.py` 在native0、实际候选输出检查失败时，没有对照已持久failure.code。我复制真实bad-json正式run，仅将副本failure.code改为candidate_program_failed，原native0及坏JSON不变，实际CLI仍以candidate_output_invalid归候选，未报告原“非零退出”证据与native0矛盾。

这只是评估端原判定完整性反例，不是候选自己修改了ledger，也不把坏JSON当作正确输出。原失败 `audit/assessment.json` 为12项观察11过1失败，完整原命令/输出/源均保留，未覆盖为all-pass。

修后唯一failed分支同时闭合三个同语义位置：native0却原code声称candidate_program_failed立即设施矛盾；invalid filesystem output标记与原code核同；实际typed输出错误与原failure.code核同。detail中的诊断包装/临时路径没有被强制逐字匹配。原件、源和候选程序不改。`source-repaired/`与初执行快照只差`l02_sealed.py`该补丁（实际diff见repair目录）。

我仅用Python subprocess对原反例副本和自己原missing对象各做一次真实summary CLI：准确returncode3与4，四个必要状态/计数检查全过。wrapper exit0不是替代CLI退出码，CLI原argv、stdout、stderr与准确returncode均单独保存。没有额外native、重启或新reader全矩阵。

## 可以认可的实现边界

当前唯一inspection短持既有OS owner锁捕获原DB与canonical capsule后释放；完整入口是同一inspection的complete断言，不是第二reader。expected identity由权威日程/冻结pool推导；成功与失败共用prepared/source/input/native/sandbox身份，accepted再闭合其terminal及assessment。失败时读取真实非零退出，不拿成功exit0门排掉失败证据。非failed.failure、phase/cid/accepted矛盾也作设施问题。

候选失败以原native和typed candidate output边界支持；host未知validator异常保设施terminal，不能听stdout自报设施。failed标签而真实原输出合法、原typed原因与实际原因冲突，均不能直接扣候选。原坏DB/ZIP或身份漂移无候选成绩；没有working fallback或补跑。

独立预测不依赖其它预测或selector。只有selector的完整inner和report的全部numeric是实际依赖。故首错误后独立未调度格仍unassessed，依赖叶明确blocked并保根因；selector packet与完整assembler共用。全部numeric闭合前，不造全期selected loss或quality，不以较小分母发分。旧diagnostic即使请求完成仍formal=false，历史report来源如实not_delivered。

没有修改SQLite baseline1、cell phase或旧注册/原输入；检查只从原对象派生评估状态。基础source-final对象与本轮实际执行/修复增量的区分已记录，不把初版本完整运行冒称逐字节运行最终补丁。

## 仍未覆盖

真实OOM、signal/external termination与跨平台故障因果没有本轮实跑证据；当前保守设施待调查规则不等于这些场景已资格。没有重做Windows锁/五窗口、旧120、75或其它历史完整套。本轮没有科学图新增，故无新增视觉结论。

完整grader、40研究锚点/多质量校准、固定reference与外部review版本闭环、首预测前全部程序冻结的新formal12参考仍是后续工作；本结论不批准上述完成、L02冻结、职业真人/统计成熟、有效小时或整套十题。所有候选总分保持null。
