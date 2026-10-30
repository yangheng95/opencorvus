# L04：已有应用版本演进、真实切换与恢复

当前完整成品已通过一次集中整题独审并限定[开发冻结](FREEZE.json)，不证明候选小时。题包包括[完整公开任务](public/TASK.md)、真实原库/已交付SQL/旧应用、权威身份、[业务合同](public/DATA.md)、[执行与公开演练器](public/EXECUTION.md)、[交付合同](public/OUTPUTS.md)、环境和业务来信；数据是明示原创合成，不含真实用户。

完整链：原v1实际读取/用户批注/写入ACK→SQLite备份→迁移提交前/后进程故障→两个旧写者跨切换→v2费用/退款/新写失ACK→同键恢复→拒绝丢新ACK的旧备份回卷/前向修复→继续营业→逐身份真实数据库/导出/分币种账、实际图和替班说明。数据/schema版本/epoch同事务，未知稳定身份明确保留中止。无任意无损降级/物理掉电/零停机承诺。

[参考软件](evaluator/app.py)、报告/自含reproduce入口、公开exercise_app.py与[独立检查器](evaluator/check_l04.py)走真实程序/进程/SQLite；[rubric](rubric.json)为16机器+5独立内容叶、固定100分/关键叶不补偿。[完整实测/原件](evaluator/whole-case-tests/README.md)中真实参考100、假保证报告96/H02关键失败；外部原根`D:/opencorvus-benchmark-runs/l04-full-case-20261031`。机器从实际live.sqlite取事实，原request独立递推每笔新写，report实际无特权只读原事实，不能用内部互相一致洗掉错误。

基例、金额及权威身份变化从同封存程序新执行；按邮箱合并、金额截断、错连退款、版本早提交、恢复旧备份、缓存旧authority及错误保证报告均有真实错误程序/同checker结果。未完整评审的错误对象分数仍null，不手填总分。集中审查三项实质阻断及原反例保留于[建设与修复方案](evaluator/BUILD-PLAN.md)。参考秒级和场景数不是agent小时或职业统计成熟。

旧微型资格和NULL身份原失败保存在[历史资格](evaluator/qualification/README.md)、[原独立复核](evaluator/independent-review/repair-review/REVIEW.md)及evaluator/historical-micro-input.zip；其current-source命名是当时封存源，已退役，不是当前完整任务入口/协议fallback，不重复旧112/27。完整任务的旧应用输入与其已发布version1历史另列于public，不能由候选改写。

[持续Recall](../../../../records/2026-10/2026-10-29-heavy-workbench-l04-qualification.md)和[整题升级建议](../../evaluator/nine-case-review/H04.md)记录先前边界；十题、fresh区分度/有效小时目标均尚未完成。
