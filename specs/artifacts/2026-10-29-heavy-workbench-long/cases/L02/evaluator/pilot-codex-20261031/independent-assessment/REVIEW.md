# Codex L02/0.2.0 — 原始候选38内容叶独立初评

原38评级已封存：**38项 verified_pass**。这仅为本候选的内容/科学执行评审，不是Q26或总分结论；没有手写分数。`review.json`与`initial-review.json`原字节相同，供主方真正l02_grade使用。

assignment `2b857108932140b2bf0b79d5bb9501ac`；submission `Codex-L02-ee1ab32a6819-20261031`；run `a6a98cfe716044bcb2d7b72eecbf0e27`；anchor `L02-research-anchors/1`。实际收到的原assignment.zip已按字节复制，所有逐叶source/object/member定位已核存在。初评17:44:47.174139Z封存，未沿用作者或OpenCorvus评级。

## 本次真实交付与方法自由

本池有3个合法selection IDs：seasonal-8、weather-operations、without-weather。因此正式矩阵是144predict+12select+1report=157；固定121薄协调器的错误不属于候选，原157对象未被重执行。全部实际prepared/accepted source/config/argv与首private之前16:24:43.966Z原registration同一，报告程序和静态方法资产也预先封存。actual native/CID/Name/readonly mounts/netnone1CPU逐原件核同。

季节基线和加权ridge是真实科学机制差别。扩展用合法actual历史、发布天气、seasonal climatology及历史issue-lead bias纠正，并明确局部level adjustment、A2闭店先验/可学习closed level、A1转移量效未识别。without-weather在主和全部pseudo fit去掉温度、climate/bias路径，保留calendar/运营。它可以合法进入选择池且可以赢；不强迫固定作者ID、残差方法、同一条预测或更差的消融。

## 独立核验范围

`audit_candidate.py`仅用Python标准库读本包原始CSV/JSON/ZIP，未import候选或作者核心充当oracle：

- 逐实际packet原值/单位/版本与注册raw核同，授权集合完整；observed end<origin、release<=origin，predict没有labels/scale/全archive额外挂载。
- 所有actual/pseudo origin重新重建最高发布revision含missing。训练完整合法窗口、季节同weekday样本、实际feature/bias/climatology引用，以及历史forecast issue和当前fit actual标签的双时点闭合。
- 按真实raw标签与存储X/权重/系数检查回归正规方程、local offset/RMSE；最大相对正规方程残差1.0895e-15。没有重新求解/拟合参数。
- 历史天气bias的完整配对来源、lead cutoff、14-day shrink算术一致；这些重复行核验不是独立统计样本。
- 此候选全部校准为42完整四leaf向量，label取当前origin最高已发布版，pseudo训练/特征仍按pseudo cutoff。center/raw残差与原非负样本相加、均值和七边际分位逐实际输出重建一致，mean层级相加。
- 对3个方法在3inner上的真实Fraction MSE选择、Unicode同分规则和全部outer节点/宏MSE/MAE/WIS独立核同，不只核selected。

真实选择为January/June/July/August用weather-operations，其余8个origin用without-weather；不是事后把所有outer设成最好方法。

|实际方法/策略|scaled MSE|scaled WIS|
|---|---:|---:|
|seasonal-8|0.0255107818978475|0.0716160898681179|
|weather-operations|0.00316408006313827|0.0216615553366792|
|without-weather|0.00306681161988254|0.0212865169418708|
|真实inner所选策略|0.00307200380249406|0.0214232929178773|

这些是普通研究损失，不是bench分数或私有质量自证。报告如实保留无天气消融优于扩展，June20转移低估及多节点欠覆盖；既不为了负研究结果扣内容叶，也不因此宣布Q26通过。

`audit_report.py`独立从原raw最高rev2重建终审、2023固定scale；4032报告预测行（3方法+真实所选复制）、50/80/95逐格coverage/width及14/168分母和summary一致。8064行动行含4方法/策略×4leaf×12origin×14日×3成本，每行完整q/mean双账；所选策略2016格。行动固定q.5/.75/.9对应under1/3/9、over1，全部缺余量和费用/summary按Fraction重算相符，mean没有看truth替换正式行动。156numeric窄原生time/exit和300forecast/diagnostic/selection原产物与记者输入绑定。

本次两个只读核验分别241.28秒、13.72秒；不是新forecast、模型训练、完整sealed reader或agent工作时长。

## 报告、图和交接

已实际打开本次metrics.png、worst-origin.png、decisions.png。完整节点和切点MSE/WIS、各方法/选择策略、June20六节点L/lead/truth/selected80-95%带，以及三个成本/q/leaf图标识清楚，与独立原数值一致。A1/ZA未学会真实转移量的漏覆和A2结构关闭先验都可见；没有只挑好图。

报告解释边际区间/42向量经验尾部和漂移限制，依赖节点/fold不独立、描述性而非因果比较、不承诺joint/path/95%保证。运营仅单期连续L，不扩称库存、容量、跨站或真实机构/收益保证。表/公式与完整机器数据被公平接受，无需重抄作者格式。

根README确实存在于原immutable completed-project.zip（已实读和复制original-root-README.md），不是programme closure目录。它列原依赖、字面argv、清洁新目录/readonly/netnone和中断保原件步骤及范围；非运行文档不在program.files而被提取器省略，不是候选缺交。README封交时说明私有待评，与本次后来真实记者输出有清楚时序。

F04实际引用的Gneiting、WIS及correction支持均值/平方损失、分位/不对称损失与边际区间评分；[FPP3滚动验证](https://otexts.com/fpp3/toolbox.html#time-series-cross-validation)及[层级聚合](https://otexts.com/fpp3/hierarchical-forecasting.html)支持相应时点与bottom-up主张，[NumPy文档](https://numpy.org/doc/stable/reference/generated/numpy.quantile.html)支持linear插值公式。文献不替代本题时点/数值验收，也不为本合成应用认证。

## 保留限制与工具错误

本评审为熟悉作者参考、开发校准和先前OpenCorvus结果的非盲AI；真实Codex model/usage未知，不作同模型因果排名/专业真人或统计成熟认证。没有调用sealed reader/prepare，没有新Docker/Provider/forecast/report/solver/GPU/UI，没有改候选、run或assignment。未来Q26与总分由主方实际评分器独立计算。

自有初始脚本把utf-8-sig误写成不存在的utf8-sig，封存评级脚本首次heredoc多一个括号，两者均在写评级前失败，未计作候选错误；原命令/工具事实和修后源码保留。探索cell11实际为季节模型，其fits没有A1键，初读假设导致KeyError，随后按实际cell12扩展阅读；没有把探索输出错误归给候选。根README提取时basename碰撞在复核后另存精确根成员，原ZIP不变。

原件入口：assignment.zip；candidate-audit.json/command及audit_candidate.py；report-audit.json/command及audit_report.py；original-root-README.md/handover-source-observation.json；初评initial-review.json/initial-review-seal.json。观察数、行数和拟合次数均不宣称难度、独立样本或有效小时。
