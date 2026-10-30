# L02 固定参照质量：原数值与坏对照独立审查

本次**历史作者参考的质量可达见证成立**：原真实inner选中outer输出满足原先封存的26条件，且四种指定低质量对照均被同一政策拒绝。政策内容与本独立审查在结果前所见副本逐字节相同，未通过新结果调线。这里的“可达”只指这份合法历史作者预测，不是新候选成绩、formal full12通用reader资格、职业研究完成、冻结、统计成熟或小时级证明。

原计划报告/stage-plan不改写。本轮仍为熟悉原参考的单层非盲AI复核；获得新授权后才读取质量结果，未再次委托、修改主仓或启动Docker、预测、solver、Provider、GPU、UI，也没有重训或重做旧54投影/120进程。

## 原材料、参照及选择身份

`numeric-audit/`保存本轮执行源码、封存policy、原参照ZIP、五份原结果和实际命令。独立从原CSV重新解释整数L、修订/发布时间和层级事实，核归档canonical的全部13152观测和37632协变量；从1460条真实2023终审重新求四leaf/两zone固定尺度，并核其实际发布早于既定时点。没有将候选提供的truth、scale或baseline当权威。

质量参照ZIP的24个(role,origin)绑定覆盖12outer的原seasonal8和原实际选中方法。每份forecast/method/native终态直接等于所指原进程ZIP；参照的1008行mean+7quantile、12原终态和5份原执行源均核对，方法配置等于首预测前已注册的seasonal8/365日/56-84-112校准。外部参照并未由候选自带baseline或同名字符串替代。

对12次选择，我还读取原selector及其真实3inner预测ZIP，独立按原CSV终审/实际release、168格完整inner目标及固定尺度重算Fraction loss并取最小ID；选中ID、原选择结果与质量packet均相符。这里的168是三个inner各14日×4leaf的真值观测计量范围，指标本身仍按每inner6节点×14格/原层级权重计算；不把这些计数当独立样本。原selected确为weather，不是从outer真值选择方法。后续质量只比较该方法的原outer输出。

## 独立计算与实际结果

`audit_quality_numeric.py`实际5.978828秒，原335条检查保留。所有原ZIP/事实/选择、五组逐节点/宏指标、每origin每role全部168个动作及缺量/余量/损失分解共333条已通过；两条自有typed探针首先因错误context夹具而false，详见后节。指标oracle是我已有的独立Fraction实现，不调用新quality或作者score来生成期望值。

每个leaf/cost的分母为12outer×14日=168；行动分别是原已冻结q.5/.75/.9，连续L，overage=1/underage=1,3,9。逐origin的14日平均再对12origin等权，与直接168格平均相同。所有动作、shortage/surplus量、两项成本、总成本和说明性mean-action损失逐项核同；没有按结果挑quantile、日期或节点。两宏指标、12节点条件、12运营条件的原始有理数/比较符和critical标记全部对应，不用rounded展示或skill比值作接受依据。

| 输入 | 通过/26 | 独立结论 |
| --- | ---: | --- |
| 原真实选中参考 | 26 | 本作者固定参照政策可达 |
| 参照与自身比较 | 24 | 仅两宏严格改善失败，不能以复制baseline过关 |
| 零均值/零分位点 | 0 | 全部质量条件失败 |
| 同均值、极宽区间 | 11 | 7个点条件和4个median成本保持；7个WIS及8个高缺量成本失败 |
| A1及父ZA均值共同退化 | 23 | 维持层级一致；仅宏MSE/A1 MSE/ZA MSE失败，未误扣不变区间或成本 |

这四种坏对照是人为修改已有预测的诊断，不是四个模型或可达研究。可核对的全部精确loss在`numeric-audit/independent-quality-results.json`；335项逐条事实和五组原结果也一并保留。26个critical不代表26个独立能力或统计检验。

## 错误/设施边界与审查器自有错误

正常typed入口另实际核验：缺整个已分配origin→quality_incomplete；候选条目试图加入labels→quality_incomplete；bool action→facility_decision_values_invalid；独立手算under3的缺量/余量成本为6/2。

初两探针使用了带额外CSV字段的series_catalogue作为严格score-context，所以在进入坏forecast前正确得到facility_context_invalid。修复只在我的夹具把node投影为series_id/kind；首次修复脚本又忘记将grid边权字符串转int，在调用目标API前TypeError。原335中的2false、原repair脚本/exit1/stderr均保留。最终只实际复核三项：合法84格context→forecast_assessed；坏reference缺行→facility_quality_reference_invalid；候选缺行→prediction_incomplete，均通过。没有重算333项或改主源码。

这些是**直接typed primitive**错误合同，不冒充任意候选JSON CLI的安全总grader。

另一个真实需要收口的边界见`facility-priority-probe/result.json`：同一origin的candidate和外部reference均缺行时，当前入口先score(candidate)，返回prediction_incomplete，未先揭示同样损坏的reference。单独reference损坏已正确映射facility。这不影响本次有效参照的数值/可达见证，但在接入总grader前，必须由唯一入口或可信registered-reference预检保证所有authoritative contexts/labels/reference先有效，再分类候选缺交；否则设施损坏可能被候选错误遮住。当前primitive文档已经说明其caller提供独立注册权威事实，因此这是总grader集成前置边界，不能由这份历史packet假定已解决。后续修复/资格应另加，不覆盖此原探针。

## 当前认可范围与剩余事项

原政策、外部参照和这份历史作者预测的26逻辑及精确数值可认可。它与既知June A1/ZA四天区间0/4失效并不矛盾：政策约束的是全期平均，而非每一时段风险保障。这一失败仍须在完整研究/运营报告如实解释，不能因26/26就宣称转移量已识别、nominal coverage得到保证或现实供水调度安全。

当前l02_quality只接受caller提供的权威context/reference；原基线绑定由一次性qualification adapter及本独立原件核验支持。formal full12通用sealed reader仍需把这些权威绑定接起来，不能直接将任意候选JSON交给primitive、接受候选自报truth/scale/reference，或按本packet补造新候选成绩。上述混合错误优先级也须在该集成前明确。

完整科学/运营交付、预先原子rubric/评分聚合、人评多质量锚点、完整最终source-only资格及L02冻结均pending。新鲜候选区分度和有效小时亦未取得。本报告不修改政策、阈值或旧评分，不把历史参考和合成对照当十题完成。
