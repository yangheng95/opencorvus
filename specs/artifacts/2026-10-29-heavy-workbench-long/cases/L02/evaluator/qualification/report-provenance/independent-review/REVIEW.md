# L02 报告来源与 prepare-once：独立增量审查

结论：本轮限定组件没有尚存的实质阻断，可认可当前报告来源投影、原输入 prepare-once、同一组装器及 sealed reader 的局部资格。它不构成完整 L02 冻结或候选成绩。我是熟悉既有作者参考的非盲 AI-agent 审查者，本轮没有再次委托。

## 实际对象与执行

主仓源码只读。实际审计 `run_l02_study.py`、`l02_execution.py`、`l02_pipeline.py`、`l02_report.py`、`l02_sealed.py`、`summarize_l02_study.py`、`l02_study_data.py`、共享 typed JSON 比较与当前澄清后的 `report_l02_reference.py`。当前逐字节快照在 `source-final-audited/`，与我的执行侧源码以及主方 clarified 快照的直接字节比较见 `source-identity.json`；增量见 `source-current-vs-parent-clarified.diff`。这是对象身份记录，不是以摘要代替功能正确性。

我只启动了一次新的 report-only 冷进程，使用原 `original-numeric-projection.zip` 的既有十个数值单元结果，未重新预测。实际 CID 为 `88aa3de03a35fab8d83c7577e2cf6c5a70b3b29aef92ee2950c188f670a65b10`；原生开始 `2026-10-30T07:15:28.129157645Z`，结束 `2026-10-30T07:15:30.010666316Z`，自然 exit 0，host 总时 **4.695843 秒**。原 inspect 证实 network none、1 CPU、只读 rootfs/project/input 和新 output。`cold-report/cells/1/` 保留 create/start/wait/inspect/log、prepared/terminal/accepted 与实际 rm 回执：只有一个 create、一个 start、一个自然完成后的精确 CID rm；原件先封存再清理。`cold-command.json` 和 `cold-execution.json` 为实际收据。

## 源码、恢复与输入边界

- 三个生产 invoke（predict/select/report）均使用同一 callable input factory。canonical prepared.zip 已发布后，恢复从其原始源和输入物化；不会重新调用 factory 覆盖旧输入。未发布时仍是 planned，允许重新准备。所有实际 source/input 还与原 prepared 绑定。
- SQLite `user_version=1` 和持久表结构与既有原 ledger 相同。新增来源是原通用 input member 中的文件，不是另建运行状态或双写 DB，因此本改动无需持久 schema 迁移。旧 accepted 仍保持原字节；若将来改变表或已捕获对象语义，须另做版本化迁移，不能由本结论外推。
- live driver 与只读 sealed reader 共用 `assemble`/数值验收；reader 从原 registration、prepared、accepted、原 native 终态恢复完整分配，重算 selection 和固定分母。原 forecast CSV prefix/metadata、method typed 配置、selector 输入/许可 labels 均绑定真实原输入，不拿最新生成 packet 替换历史。
- 当前 `validate_terminal` 比 clarified 父快照进一步绑定 native Name 与 cell name、ledger exitcode 的整数零值；这一实际增量已审，主方 11 个原 native 对象的绑定收据也核读。它不更改程序、预测或已执行输入。
- 来源 sidecar 只导出原 candidate output 和窄 native 事实（逻辑身份、sanitized argv、声明源码、起止、exit）。本次实际投影库存恰为 `results.json`、manifest 和 **19 个原输出**，十单元分配由 registration/raw/pool 独立对照。未把 grader、权重、参考预测、完整 host env、完整 native capsule 或 credentials 注入 reporter。
- 历史 report 实际只收过 results，reader 正确给出 `not_delivered`，没有补造“旧 report 已看过新增来源”或据此扣候选分。这是观察原 capsule 的事实类别，不是第二套当前 reporter 执行路径。

主方两个真实 os._exit73 资格的原件与 SQL/ZIP/程序消费已读：发布前崩溃，factory 两次、最终消费 `second`；发布后崩溃，factory 一次、最终消费原 `first`。两个崩溃点当时都是 planned、CID=null，恢复后各只有一个实际 create/start/rm，**不能称这两次新资格证明运行中同 CID 恢复**。该范围与旧五窗口资格不同，不重复执行。

## 独立新表与实际图

纯只读审计 `audit-repaired/assessment.json` 的 **75 项检查全过**；它们包含逐对象/逐输出绑定，不是 75 次端到端实验。新 reporter 实际复制的 19 个输出逐字节等于原 numeric accepted output。36 行 fit-index 均绑定原 fit 输出的训练行、截止、特征、系数和 calibration origins；seasonal 的 coefficient=null 为合法数据。这只能证明诊断未被 reporter 改写，不能独立证明原训练过程真实。

我使用独立 Fraction 算术重算 **18 行 node MSE/WIS/80% 覆盖计数**及 **168 行单期运营 action/truth/shortage/overage/loss**，全部匹配；没有调用 reporter 的 WIS 函数充当 oracle。手算定义使用均值误差平方除尺度平方，WIS 为 median 及 50/80/95 三区间加权和除 7/2，再除尺度；运营动作固定 q=.5/.75/.9、under=1/3/9 和 over=1。证据在 `audit-repaired/table-checks.json`、审计源码和实际 CSV。

实际通过 view_image 打开 `cold-output/result/forecast.png`：六节点（A1/A2/B1/B2/ZA/ZB）分面、14 日轴、litres 单位、truth/selected mean/central 80% band 可读；没有用文件存在或图名替代视觉检查。本次为 Jan15 的一组参考报告，不是全 12 outer 的新报告执行。

澄清后的新 reporter 在此次真实冷跑里明确：数值来源本身不能证明 report programme 相对历史预测何时冻结，fit 是 self-reported，科学正确性另审。主方第一次新 report 的笼统 freeze 表述及原 accepted/source 保留；不能说那次旧执行已运行当前文字。

## 保留的工具与证据限制

我的首次只读审计已完成 `read_completed` 并保存 `audit/old-reader-summary.json`，随后在处理合法 null 系数时发生审查脚本 TypeError。原命令、源码和 stderr 保留。修复仅处理我的读取假设并使用已保存的成功 reader 结果，未重开 reader、预测或第二 report。修后纯只读审计 exit0，约 0.538 秒；首次 reader 没单独保存计时，不编造其耗时。这不是组件或候选失败。

主方 preparation owner/resume 原 argv 收据只留 common prefix，缺少 `--value` 与 `--stop-stage` 实际后缀；执行 harness 源码、owner-exit、准备历史、prepared 与真实程序输出仍共同支持上述结论。保留为非阻断的原始命令记录精度限制，不能把复原 argv 冒充当时完整原回执。

## 未作出的认证

本轮没有 fresh 全12矩阵、没有完整科学/运营人工 rubric 或候选评分、没有独立职业真人/统计校准，没有认证 L02 冻结、小时级难度或十个重型 case 已完成。报告数据交付、实际使用、诊断真实性、科学解释和 benchmark 成绩是不同判断。本结论只关闭当前实现及已真实行使的来源/恢复/报告组件范围。
