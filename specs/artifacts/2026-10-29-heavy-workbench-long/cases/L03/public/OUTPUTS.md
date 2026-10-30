# 机器账、报告和执行交付

输出目录下result.json，format=`l03-close-result/1`，包含以下数组/对象。整数金额不能用布尔值或浮点代替。机器表的行序自由，来源身份和月份真实唯一；service_months是有序服务月份序列，须按POLICY严格升序/连续并保原顺序。journal允许同来源科目拆合，聚合后相同即等价。精确有理数字段使用字符串，可用等价未约分表示。可以另交工作簿/表格/代码/公式等辅助材料，主报告清楚索引。

| 字段 | 每行/对象必须提供 |
|---|---|
| documents | doc_id/revision/status；posted再给vendor/department/book_month/service_months/currency/native_minor（带贷项符号）/fx_revision/gross_minor、lines。每line有line_id/native_minor（原币绝对值分）/base_minor（带符号）。cancelled的gross_minor=0；quarantined的gross_minor=null |
| bank | bank_tx_id/month/amount_minor/fee_minor/allocated_minor/unallocated_minor/status，status为confirmed或unresolved |
| settlements | bank_tx_id/doc_id/month/native_minor/book_minor/cash_minor/fx_minor，只列确认分配 |
| journal | source_type/source_id/month/account/amount_minor，有符号借贷整数。opening的source_id为opening，doc和bank用原业务ID |
| monthly | month、cash_open_minor/cash_out_minor/cash_close_minor、service_expense_minor/fees_minor/fx_minor/expense_minor、prepaid_close_minor/ap_net_close_minor/ap_payable_close_minor/vendor_advance_close_minor/suspense_close_minor、budget_minor/variance_minor/open_commitments_minor、overdraft_used_minor/overdraft_headroom_minor |
| vendors | vendor/month/net_ap_minor/payable_minor/advance_minor，每已确认供应商每期间一行 |
| departments | department/month/expense_minor/budget_minor/variance_minor，所有已确认部门/预算部门及Finance每期间一行 |
| exceptions | document_conflict：kind/identity/revision/status=unresolved。bank_unallocated：kind/identity/amount_minor/status=unresolved/evidence_status（null、ambiguous、withdrawn、conflict，或确认通知仍有余款时confirmed） |
| legacy_bridge | month/legacy_expense_minor/corrected_expense_minor/expense_adjustment_minor/legacy_cash_close_minor/corrected_cash_close_minor/cash_adjustment_minor，只列legacy导出已有月 |
| decision | available_cash_minor、options数组、selected、break_even数组、funding_scenarios和conditional_recommendation。option有id/capacity_ok/cash_ok/minimum_new_funding_minor/expected_cost_exact；break_even有left/right/volume_exact（可null）。funding每行funding_id/status/additional_cash_minor/funding_fee_minor/available_cash_minor/selected_plan/expected_total_cost_exact。conditional_recommendation为null或funding_id/plan_id/expected_total_cost_exact |

须另交REPORT.md（可索引等价机器内容）、真实图形及清洁重建说明。报告至少包括：来源/版本审计、原账到重述桥、逐未决项所缺证据和行动、管理方案约束/成本/翻转范围、材料限制与交接。图坐标/币种单位、系列身份、数值与本次账一致；图表/数字不能来自另一次运行。没有规定作者表格名称、图数、页数或措辞。

submission.json：format=`l03-submission/1`，files为本模型所需普通相对文件路径，argv为直接执行参数字符串数组。工作目录/project，原材料/input只读，/output和/tmp可写；程序应将完整成品写到/output/result。不得读取其他项目、作者模型/答案或外部凭据。依赖在封存前声明准备，不能靠worker联网安装。

例如可以声明某语言解释器和自己的main程序，参数显式指向/input及/output/result。不要求Python、作者源文件名或特定优化器。评估者首运行前封存全部声明源码，后续三类变化继续同一源码真实执行，不能反馈成绩后重提调参。参考程序及私有checker不属于候选输入。

break_even的left/right表示无序方案对，左右交换等价；每一无序方案对恰好一行。files中所有文件的真实解析路径须仍在提交目录内；不能通过文件链接或父目录junction指向题外文件。
