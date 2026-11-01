# 首次实际原料关系与未确认事项

这是实施中的来源定位，不是整题通过报告。原根为 `D:/opencorvus-benchmark-runs/gdpval-month-end-task-20261101`，全部原件原字节分区保留。以下来自原公开输入，尚未用专家答案选择金额或设评分线。

| 原料 | 目标/核对 |
| --- | --- |
| March financials + April final TB text | Tab0/3a；division+account联合身份；105个April账户，March97个，新8个，不能仅按account跨division合并 |
| April TB | Cash availability、intercompany loans、各支持余额的GL控制；period/YTD分别保原符号 |
| Outstanding checks | Bank recon：两张未清支票5708.78/10458，合计16166.78；源Bank Balance单元格空，不能以GL数冒银行对账单证明 |
| March funding layout + TB | 月预算保原、YTD收入/利息与月份分母更新；原模板两行同名Aurisic UK需保原位置/映射来源，不凭猜测改公司身份 |
| Combined prepaid file + PPD1250 + PPD1251 | 原工作簿中存在多个版本/公式/缓存，不能只选最像GL的一份；April各月来源/差异需明示 |
| Prof fee / Legal dumps | 正负列包含reversal，不能把credit绝对值当费用；源Legal末行日期标签仍写March，明细已含April |
| Two loan files | Principal、quarterly payments、April30利息及合并2402控制；不把本金、当月利息、累计利息相加混作同一余额 |
| AR / payroll / rebates | April支持表与GL逐账户/期间核对；payroll两来源含相同April表，不能重复计入；公司主表还保March表作为来源 |
| Accr2011 / Bonus / Misc | 新支持表追加末尾并列TOC，核各GL负债与明确借贷口径 |
| Missing AP_TB | April AP总账已知，详细账龄未知；标CFO待补，不抄March明细当April |

## 已观察的具体核对线索

- 原April文本确有105条账户行，按division/account联合识别；新增包含division12的1101/9999以及多个division10费用/清算账户。原本97条不能固定行数覆盖。
- March1250余额577321.53，April period为−49820.20而YTD为692501.33；二者跨期差165000。其他权益/清算/费用账户亦有跨期差。它们是需追溯的差额，不凭这条算式就断言账务错或补调整。
- April1251 GL为54630.68；独立PPD1251缓存显示April期末5493.27，combined预付文件同位置缓存49137.41且其期初/期间布局不同。需完整比较供应商/期间/公式，不能按标题取一个数或为了对平而选择版本。
- 源PPD1250多个汇总公式范围经过其汇总行或后续控制行；实际是否形成循环以及引擎如何处理尚待真实重算，不能据原缓存静态判已正确。
- 原March现金/银行/资金来源/TOC/预付标签五视图已实际呈现查看。March银行末行标签仍为February、资金来源利息平均公式除9而该表其他行除3；April更新不能只换标题。原模板全留，不将这些观察扩展为未核整题错误结论。

尚未确认：全部源表真实重算结果、来源冲突的可解释范围、原专家交付一致性、完整参考/消费者、独立整审、实际任务深度和任何模型结果。没有新模型请求。

## 实际闭合补充（前文为首次观察，保留时点）

原始预付vendor closing、两笔贷款、工资公式和杂项B5由独立formulas1.3.4实际重算，源错误不转0。combined两版本也各自重算，不仅看原缓存。专用1250为692501.3131313132、combined为692501.3231313131；专用1251为5493.27、combined为49137.41。公司未确认主版本，参考采用专用来源但明确保GL差额。原PPD1250 P50/S50是literal #REF!错误，未参与vendor closing；其旧check意图仍未知，当前以unavailable及CFO来源说明表达，原错误完整保。

原法律L62=SUM(L3:L61)包含L60已有小计，当前汇总改为L60/M60，最终净435284.69对GL6200；原交易/符号不变。两loan principal分别18300000/13500000对GL2600/2601，合计31800000；2402利息控制与原两源累计利息差约.00567保留。工资rollforward原源与GL差177467，源130%估算与实际posting差51.112，均待公司解释。跨期12桥只作疑问不自动判账错。

独立原公开支持缺AP；查原专家后发现其AP表有公开材料未给的供应商数据，因此不作同公开来源可达见证、不抄入参考/预期。固定parquet与捕获row有三文字字段字节差，prompt中替换字符/标点及末尾换行不同，原料和交付文件列表/URI同；不同原对象和完整diff保，未声明rowrevision字节一致。

完整参考19页/真实错误19页已进入同数值消费，范围和实际0/4见README；19页23关键视图实际看过，现金源+1的真实下游消费保。独立整审、公司来源/政策确认、所有合法变体、专业深度和模型比较仍未取得。当前仅作者参考/待审包交付闭合，不再重复作者研究/生产/错误/刷新/图来凑资格。
