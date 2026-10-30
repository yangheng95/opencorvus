# 合成管理账政策

金额输出一律CNY分整数；原币金额为非负、最多两位小数的十进制字符串。所有发布时间为UTC。company.json的as_of及months是本次资料截止和报告期间，允许后来增加期间；不是程序固定常量。服务责任按整月模型确认，不按日摊销。

## 来源与版本

documents/fx/advice/budgets/commitments各JSONL行有source_id（导出来源）、业务身份、整数revision及released_at。先保留released_at<=as_of，再每业务身份取最高revision；同版本同载荷的重复导出只算一次，比较时忽略source_id。最高版出现不同载荷则冲突，不选择旧低版或较小金额。单据冲突保留quarantined、金额null，不进入已确认账，并在异常/报告披露潜在未确认责任；这不等于责任为零。后续更高唯一版可以解除。单据cancelled贡献0且保留身份。

身份：documents为doc_id；fx为currency+rate_date；advice为bank_tx_id；budgets为department+month；commitments为commit_id。银行是稳定bank_tx_id，无版本；同一交易的多次导出只算一次。当前合法材料不存在同银行身份不同金额的矛盾，也没有无法取得唯一汇率的已确认单据。

## 原单、分录和期间

每份posted单据用其currency/rate_date的最高已发布汇率。**每行**amount×rate换算为分并ROUND_HALF_UP，先逐行到分再加总；不是先合计原币再舍入。invoice为正、credit为负。贷项是独立业务，不是覆盖另一个doc_id。每份原单保原币、汇率revision、各行转换结果、部门/供应商/期间与总额。

book_month：借Prepaid:部门、贷AP:供应商，按有符号总额。service_months列出的月按其原次序分摊：总额绝对值整除月份数，前面各月取商，全部余数放最后月，再恢复正负号；各月借Expense:部门、贷Prepaid:部门。这些服务月按升序连续且均在本次months内。Finance在本材料专用于银行手续费，不是单据部门。

分录以借方正数/贷方负数表示。来源类型opening/doc/bank及真实source_id、month、account必须可定位；同来源/期间/科目可拆合，0行可省。原始科目为Cash、OpeningEquity、Prepaid:部门、AP:供应商、Expense:部门、FX:部门、Suspense。期初仅有company指定现金，借Cash贷OpeningEquity，其他余额0。

## 银行与结算

bank.amount_minor为实际现金流出，fee_minor是其中明确手续费。只有当时资料截止下最高版本advice为confirmed，才能按allocations确认为结算；ambiguous、withdrawn、冲突或无通知都不能凭金额/vendor_hint猜配。允许一发票多付款和一银行多发票。分配只针对正invoice，累计原币量不超过其原币总额。

同一单据按银行posted_at、bank_tx_id顺序处理。设单据原币总分N、记账总分B、此前累计已分配原币n、当前分配a，则本次清应付账面值为`round_half_up(B*(n+a)/N)-round_half_up(B*n/N)`；不是每次单独对比例舍入。分配现金为advice给出的cash_minor，差额cash-book进FX:对应部门（可负，表示收益）。手续费进Expense:Finance。银行现金扣实际总额；扣除确认分配及手续费后的非负余款进Suspense。每笔银行分录借贷必须平衡，但仍须逐来源核真实身份和分配。

供应商月末净AP=-累计AP科目余额。净额正数列payable，负数绝对值列vendor advance；不得截掉负数。独立贷项可在原发票结清后形成供应商预付。现金、预付、应付/预付供应商、suspense逐月滚动；原外币与记账差额不得吞进服务费用。现金为银行净余额，允许题设bank_overdraft_limit_minor内的负数；已用透支=max(-cash_close,0)、额度余量=limit-已用，不能把负数截零或伪造借款入账。

## 预算、原账与管理方案

预算取最高已发布版本，按部门/月比较真实费用。服务费用、FX和手续费均进入总expense；commitments仅最高版本status=open在expected_month单列，不入费用或应付。legacy-close.csv是有问题的原导出，不是正确答案；只对其已有期间给原数、正确数及差额，不为新期间编造历史导出。

choices的概率是明确场景假设，按精确有理数加权。每方案cost=fixed_minor+unit_minor×units；容量须覆盖所有场景最大units，upfront_minor须<=末月现金-正应付款-现金reserve。供应商预付和未决现金不能再当成可用现金重复加回。可行方案中按期望成本最小、精确同分按id字典序选择；无可行方案则selected=null并说明。

每对方案交点为`(fixed_right-fixed_left)/(unit_left-unit_right)`，单位成本相同时为null。负数/超容量交点仍如实报告并解释不在可行范围；不要求建议必须翻转。比较没有包含未提供的质量/因果/联合风险事实，不能将确定性题设最优扩张为真实采购保证。

当前资金不足本身可以是正确结论，不能用偷偷提高期初现金使方案可行。另按每份funding_offers明确新增资金情景重复方案可行性：available增加additional_cash_minor，方案期望成本另加fee_minor；先在各情景按原规则选择，再对有可行方案的情景按总成本、funding_id、plan_id排序给条件建议。offered_unaccepted是未接受融资报价，不入实际现金账，建议须以批准/到账为条件。只验证预付款约束，不认证全部未来货款偿付。每原方案另报minimum_new_funding_minor=max(upfront-当前available,0)。
