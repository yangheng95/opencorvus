# OpenCorvus多任务真实端到端故障记录

本目录记录用户要求的当前产品修复与多个不同端到端任务。总十题探索与心跳仍暂停。原始完整运行根为`D:/opencorvus-benchmark-runs/outcome-quality-selection-e2e-20261101`；不是旧模型对照的补丁或重评。

已完成本轮五次真实执行：两个修前预测入口、一个修后预测入口，以及文件归档、SQLite库存导入两个不同的真实Task。四次自然完成，一次被验收预算中断。每次进入生产Session/Task、实际流式Provider、真实工具和独立最终消费者。有限结果不证明全域根治或总体模型优劣。

| Run | 业务/入口 | 终态与实际质量 | 本次故障 |
| --- | --- | --- | --- |
| R01 | 预测发布/coding修前 | 自然完成，六输入相符 | 两次补丁错误后恢复 |
| R02 | 预测发布/Task修前 | 预算中断，已有pyz诊断六输入相符，缺正式完成和handoff | 两次补丁错误、一次测试生成器错误；另列Provider504与验收预算 |
| R03 | 预测发布/coding修后 | 自然完成，六输入相符 | 所测过程和交付未观察到故障 |
| R04 | manifest归档/Task | 自然完成；原三输入相符，另有一个真实合同缺口 | 合法Windows source反斜杠路径被拒绝，原程序实测native1 |
| R05 | SQLite批次导入/Task | 自然完成，两个成功及整批回滚三个场景相符 | 自测连接未关闭、恢复补丁上下文不符，后自主修复 |

详见[逐次故障清单](FAULTS.md)和[实施与验收Recall](../../records/2026-11/2026-11-01-outcome-quality-repair.md)。自然完成、交付正确、过程错误及验收运行器中断分别记录；不以统一100分合并。

原完整项目、Git、生产SQLite和完整trace外部保留。本目录包含每个run的原source-and-deliverable.zip、可读源码/原handoff、独立消费原输入/输出和grade，另有raw-traces.zip、实际Provider收据、具体Windows路径复现、冻结合同/期望及观察脚本。仓库投影不冒完整runtime/用户workspace；源凭据不进入目录。

[结构化结论](assessment.json)、[逐次工具错误和消费者向量](observed-runs.json)、[持久化工具request/outcome核对](canonical-tool-facts.json)分别保留不同层次。共128request/128outcome、pending0；5failed工具outcome和2个native1自测仍保原错。140实际流式Sol请求为139 HTTP200/1 HTTP504，两隔离runtime均已dispose，配对凭据副本退休、源文件未变。预算中断不是自然终态，固定池通过不是完整合同认证。

完成49项聚焦后端测试、核心package类型检查和docs:check（352ops/26groups）。前后预测均正确，无量化效果改善证据；R04最终交付缺口尚未修复，未补候选或再次调用模型。普通旧十题心跳仍PAUSED。
