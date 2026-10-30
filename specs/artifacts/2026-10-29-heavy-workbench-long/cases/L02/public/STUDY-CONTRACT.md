# L02 每日研究接口与指标（L02/0.2.0 开发合同已冻结）

本页解释唯一公开[study-contract.json](study-contract.json)；具体wire见[INTERFACES.md](INTERFACES.md)。质量底线链接同目录quality-policy.json，不以本页另立关系。状态见profile.json；冻结前不发布候选总分。

每次预测只读被分配origin的原始发布行、静态身份/层级/单位和显式target_ticks；14个完整未来UTC日，不能用小时range。完整canonical/未来终审/其它worker结果不进入预测进程。2023公开探索不当盲评；2024+内层与2025外层使用候选事先声明的同一源码/配置池。合法全公开开发用于探索，不代表授权每个早期预测读取其较晚事实。

输出`l02-distribution-forecasts/1`恰含format、method_id、origin_tick和forecasts数组。每行恰含series_id、target_tick、mean和quantiles；每个注册节点/时点恰一行，不能删除困难节点。quantiles的键为0.025、0.1、0.25、0.5、0.75、0.9、0.975，值有限/非负/单调；mean另代表条件均值。均值按层级相加，容差`1e-6*max(1,|parent|,sum|children|)`；边际分位点不要求相加，mean不强求等于median。JSON数值最多256有效位、指数绝对值1000、量值不超过1e12L；使用精确十进制→有理数读取，布尔值不充当数值。这些是文件协议约束，不是用户工作预算。

每个节点的尺度s为2023年终审日量均值，最小1L，aggregate按同日leaf相加。所有用于尺度的实际终审在2024-02-01T09Z前已发布；尺度仅评估侧及不早于该时刻的selector可读，不能作为2023预测worker的晚发布先验。点选择指标为`((mean-y)/s)^2`，解释指标为`|mean-y|/s`。WIS（Weighted Interval Score，加权区间评分）用median及50/80/95中央区间，alpha=.5/.2/.05、权重w0=.5/wk=alpha/2，分母3.5，最后除s。叶和aggregate各占一半，层内节点/时点等权，内层origin等权；WIS只是边际评分，不能认证联合路径/相关性。

真实selector只能收到本outer之前已发布的三个inner终审标签/合法预测/固定尺度及事前配置池，按完整inner平均scaled_mse最小、同分稳定ID字典序选一个既有配置ID；不能创建新配置/修改预测或参数。池需至少两个科学上有差异的配置，不能用改名或死flag凑数，不强迫预测恰好不同或有提升。失败单元保留固定网格/分母，不删除后取较好均值；设施失败须具名run_invalid并修复，无候选分数。具体失败配置与强制基线/消融的资格状态须在完整runner执行前固定，不能看结果后改变义务。

选择器还须接受同一公开格式的合法数值控制，按实际完整loss选择而非返回固定ID：控制可改变已声明方法的inner预测数值以产生明确最小值或同分，身份/标签的可知时点/完整网格及原配置池保持相同。它不要求原自然模型的胜者翻转，也不把控制中的合成perfect预测当实际模型成绩；不能注入新配置参数给outer。

选后outer按同一合法packet实际执行基线/扩展/消融，私有后续外层结果不能反馈给已封存研究代码以再调参。正式研究必须覆盖完整12outer及36inner的声明矩阵；局部闭环、旧数值结果或事后补报告不能代替该次清洁执行。研究/质量分别判断，所有实质必交和等价格式边界见RESEARCH-DELIVERY.md及REVIEW-ANCHORS.md。

方法资料：[WIS原论文](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1008618)、[层级预测教材](https://otexts.com/fpp3/hierarchical-forecasting.html)。真实闭式资格：单点MSE4/WIS6/7、层级单位尺度MSE3/WIS13/14；尺度2/5/10时MSE27/100、MAE7/20、WIS5/28。原JSON极大指数异常和忽略interval_metric声明的假通过均保留，修后具名错误及合法非单位锚点已实际重验；它们不构成完整研究验收。
