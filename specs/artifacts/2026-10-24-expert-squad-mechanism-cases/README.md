# 专家团机制案例输入与证据

`check-case.mjs`通过正式Task HTTP接口读取实际轮次、会话与产物，并结合原始Provider reader观察。用法：`node check-case.mjs <case-id> <isolated-run-root> <http://127.0.0.1:port> observe|watch|check`。`watch`按真实Task、transcript和原reader变化判断180秒无活动；`check`只证明Task completed、要求的产物类型、真实流式型号及交付文件存在。完整内容、来源/字节身份和独立复核仍须原始request/outcome及独立裁定，脚本不把结构通过冒充端到端正确性。启动器先完成凭据、完整模型目录和实际型号预检，且在建Task前记录预算；本脚本不使用凭据或更改Task。

[方案及验收](../../records/2026-10/2026-10-24-expert-squad-mechanism-cases.md)

运行中的Provider证据使用当前 `script/audit-snapshot.ts` 的不可变revision及同一latest读取器。旧轮结算后的原audit可归档为不可变副本，保留原文件；`*-current.json`只是检查器生成的交付视图。

- `01-data-analysis-original-cancelled.png`：首轮前驱参数契约错误后正式取消的原失败边界。
- `02-meeting-knowledge-completed.png`：原包会议知识交付的真实页面。
- `03-review-debug-baseline-completed.png`：原研究模板完整 baseline；不能当修复后版本。
- `04-review-debug-fixed-completed.png`：修复角色模板后的真实代码调查与验收。
- `05-data-analysis-completed-with-recovery.png`：经营分析报告完成、目标绑定最终复核；该轮保留实际发生的原生处置错误与恢复，不能用完成截图证明无故障。
- `06-data-analysis-completed-after-usage-compaction.png`：新完整轮真实成功用量触发压缩后的完成状态及可见检查点。
- `07-data-analysis-final-delivery.png`：同轮最终数字表格与 completed 状态，来源和文件身份另由原请求、产物与独立裁定证明。
- `11-context-compaction-totals.png`：同一根激活经过两次预测压缩后真实完成，表格总计1440笔、6610320分及实际完成工具；完整逐页读取和计算另核原始证据。

`acceptance-evidence.json`是原SQLite不可变请求、结果、产物、压缩控制/检查点与Provider事实的审阅子集，以及最终四项操作系统恢复矩阵的原报告结算字段。不是完整日志，也不以摘要/哈希替代行为验收。MK请求数属于包含首轮取消DA的原共享服务；DA/RD属于各自新隔离服务，均包含型号预检。恢复矩阵使用受控流式本地Provider，其usage是夹具输入；DA和交易案例的模型usage才是实际gpt-6.1-sol观测。

- `meeting-knowledge-meeting.md`、`data-analysis-operating-report.md`：真实原文件字节副本。
- `review-debug-invoice.mjs`、`review-debug-invoice.test.mjs`：真实修复源文件与实际非UI回归文件的字节副本，保留原项目中的相对导入路径，仅供审阅。

`inputs/`为本轮受控原始输入，不是模型或工具输出。三个案例分别进入独立项目，使用正式Task、原始专家团包和真实流式Provider执行。真实工具回执、产物及首轮失败均保留，原始日志位于方案记录的各隔离目录。

- `inputs/data-analysis/`：明确收入、成本、利润和分组的可复算数据。
- `inputs/meeting-knowledge/`：确认、提议、拒绝认领和更正并存的会议稿。
- `inputs/review-debug/`：可由Node.js原命令复现的小数金额截断缺陷。
- `inputs/context-audit/create-inputs.mjs`：在新的隔离项目目录复现两次定向压缩案例使用的八页完整原输入，不启动服务或使用凭据。
