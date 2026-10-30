# 原创模拟培训：报告族与更新综述

本档不是现实成人培训研究，不提供真实人群/教育/医疗政策效果保证。问题、来源时点、构念/随访优先级、独立队列与模型按事前protocol。没有因效应负向、不能估计或未决重叠而静默删除研究。

## 方法和来源

先按archive/index.csv的真实发布日期筛选；注册定义人群、比较、随机机制和角色，原报告outcomes表提供观察组。correction高于appendix/full_report/abstract，未来更正不回填初始结论。表的report_id/table_id/row_id为定位键，可在对应HTML原文直接核对。
同注册的多报告只形成一个研究；A队列R01/R06有明确同人证据。R10/R12仅possible，主分析保守合组并保最早primary；assume_distinct才假设其独立，这不是已核清。满意度不替代迁移构念，12周优于8周醒目摘要/24周。SD与SE、points与proportion及errors方向均显式换算。
多治疗组用人数/均值与组间项合并SD²，只用一次共享对照。classroom按DE近似，已报ICC保原值，缺ICC的.03是约定不是估出的真值，另做0/.10。固定逆方差为注册主计算，DL随机仅敏感性；两者都不能消除选择/失访/测量偏倚。见随包ENVIRONMENT的Cochrane章节6/10/23方法链接；这些是方法来源，不是本合成档案的研究引用。

## initial阶段

报告26份；注册研究12项；主分析独立人群7组。报告/注册/独立分析单位三个数量不可混同。

|研究|状态|选中构念/周|主代表|失访/不明事项|
|---|---|---|---|---|
|R01|included|transfer_score / 12|R01|失访0；分配隐藏sealed central assignment；评估者masked|
|R02|included|transfer_score / 12|R02|失访0；分配隐藏sealed central assignment；评估者masked|
|R03|included|transfer_score / 12|R03|失访0；分配隐藏sealed central assignment；评估者masked|
|R04|included|transfer_score / 12|R04|失访0；分配隐藏not reported；评估者masked|
|R05|included|transfer_score / 12|R05|失访0；分配隐藏sealed central assignment；评估者masked|
|R06|nonindependent|transfer_score / 12|R01|失访0；分配隐藏sealed central assignment；评估者masked|
|R07|excluded_design|None / None|None|失访None；分配隐藏sealed central assignment；评估者masked|
|R08|not_estimable|transfer_score / 12|None|失访0；分配隐藏not reported；评估者masked|
|R09|included|transfer_score / 12|R09|失访49/100；分配隐藏sealed central assignment；评估者not masked|
|R10|included|transfer_errors / 12|R10|失访0；分配隐藏sealed central assignment；评估者masked|
|R11|no_endpoint|None / None|None|失访None；分配隐藏sealed central assignment；评估者masked|
|R12|nonindependent|transfer_score / 12|R10|失访0；分配隐藏sealed central assignment；评估者masked|

### 主分析与规定敏感性

|分析|独立k|均值差（点）|95%正态区间|Q|I²|tau²|
|---|---:|---:|---|---:|---:|---:|
|main_fixed|7|5.253096|[3.695084,6.811109]|10.229745|0.413475|0.000000|
|random_DL|7|5.313263|[3.220925,7.405600]|10.229745|0.413475|3.213469|
|exclude_high_attrition|6|5.678161|[4.075145,7.281177]|5.350544|0.065516|0.000000|
|icc_zero|7|5.243292|[3.715755,6.770828]|10.233672|0.413700|0.000000|
|icc_high|7|5.266275|[3.668215,6.864335]|10.224466|0.413172|0.000000|
|assume_distinct|8|5.331052|[3.856585,6.805519]|10.321891|0.321830|0.000000|

本阶段固定主区间是否排除零=True；DL区间是否排除零=True，DL tau²=3.213469。模型假设可改变区间判断，不能只挑较窄的一个宣传所有假设下都稳健。
逐研究留一的合成点估计范围4.911863–6.040470点，完整移除ID/权重/区间在result.json，不把留一变化当新独立研究或显著性投票。
R08缺组分散度：NR不是0，保not_estimable并向作者索取原SD/SE及对应观察数；R07按轮流入组不是随机，R11仅满意度，保排除理由。R09观察25/26相对随机50/50，失访49%，主分析保留但exclude_high_attrition另核。未报告隐藏/ICC不写成低风险。
R05共享C组不重复计权；R03的ICC=.04是原注册已报近似输入，R04缺ICC采用.03并作范围敏感性。R10原SE与0–1错误率转换后方向为正；不能把SE当SD、直接合并反向错误率或把n放大为有效独立人数。

## updated阶段

报告29份；注册研究13项；主分析独立人群8组。报告/注册/独立分析单位三个数量不可混同。

|研究|状态|选中构念/周|主代表|失访/不明事项|
|---|---|---|---|---|
|R01|included|transfer_score / 12|R01|失访0；分配隐藏sealed central assignment；评估者masked|
|R02|included|transfer_score / 12|R02|失访0；分配隐藏sealed central assignment；评估者masked|
|R03|included|transfer_score / 12|R03|失访0；分配隐藏sealed central assignment；评估者masked|
|R04|included|transfer_score / 12|R04|失访0；分配隐藏not reported；评估者masked|
|R05|included|transfer_score / 12|R05|失访0；分配隐藏sealed central assignment；评估者masked|
|R06|nonindependent|transfer_score / 12|R01|失访0；分配隐藏sealed central assignment；评估者masked|
|R07|excluded_design|None / None|None|失访None；分配隐藏sealed central assignment；评估者masked|
|R08|not_estimable|transfer_score / 12|None|失访0；分配隐藏not reported；评估者masked|
|R09|included|transfer_score / 12|R09|失访49/100；分配隐藏sealed central assignment；评估者not masked|
|R10|included|transfer_errors / 12|R10|失访0；分配隐藏sealed central assignment；评估者masked|
|R11|no_endpoint|None / None|None|失访None；分配隐藏sealed central assignment；评估者masked|
|R12|nonindependent|transfer_score / 12|R10|失访0；分配隐藏sealed central assignment；评估者masked|
|R13|included|transfer_score / 12|R13|失访0；分配隐藏sealed central assignment；评估者masked|

### 主分析与规定敏感性

|分析|独立k|均值差（点）|95%正态区间|Q|I²|tau²|
|---|---:|---:|---|---:|---:|---:|
|main_fixed|8|2.061216|[0.637444,3.484988]|45.128012|0.844886|0.000000|
|random_DL|8|2.400156|[-1.296177,6.096490]|45.128012|0.844886|23.519208|
|exclude_high_attrition|7|2.258073|[0.800202,3.715943]|43.612926|0.862426|0.000000|
|icc_zero|8|2.156901|[0.756499,3.557303]|45.660906|0.846696|0.000000|
|icc_high|8|1.934518|[0.480378,3.388657]|44.422392|0.842422|0.000000|
|assume_distinct|9|2.410535|[1.051363,3.769706]|47.735453|0.832410|0.000000|

本阶段固定主区间是否排除零=True；DL区间是否排除零=False，DL tau²=23.519208。模型假设可改变区间判断，不能只挑较窄的一个宣传所有假设下都稳健。
逐研究留一的合成点估计范围1.373815–3.455526点，完整移除ID/权重/区间在result.json，不把留一变化当新独立研究或显著性投票。
R08缺组分散度：NR不是0，保not_estimable并向作者索取原SD/SE及对应观察数；R07按轮流入组不是随机，R11仅满意度，保排除理由。R09观察25/26相对随机50/50，失访49%，主分析保留但exclude_high_attrition另核。未报告隐藏/ICC不写成低风险。
R05共享C组不重复计权；R03的ICC=.04是原注册已报近似输入，R04缺ICC采用.03并作范围敏感性。R10原SE与0–1错误率转换后方向为正；不能把SE当SD、直接合并反向错误率或把n放大为有效独立人数。

## 追加来源与更正差额

initial→updated：主MD从5.253096变为2.061216，差-3.191880点。
- R02：状态included→included；MD 7→-4；来源[{"report_id": "R02-APP", "table_id": "outcomes", "row_id": "R02-app-12-C"}, {"report_id": "R02-APP", "table_id": "outcomes", "row_id": "R02-app-12-T"}]→[{"report_id": "R02-COR", "table_id": "outcomes", "row_id": "R02-cor-12-C"}, {"report_id": "R02-COR", "table_id": "outcomes", "row_id": "R02-cor-12-T"}]。
- R13：状态None→included；MD None→-5；来源[]→[{"report_id": "R13-MAIN", "table_id": "outcomes", "row_id": "R13-12-C"}, {"report_id": "R13-MAIN", "table_id": "outcomes", "row_id": "R13-12-T"}]。

## 结论边界与下一步

上述点估计和区间仅描述本合成档案在指定选择、近似与独立性假设下的计算，不证明现实有效、因果可推广或95%的某个个体保证。正向主结果不能覆盖负向单研究、新更正或敏感性；DL也不修复失访/重叠偏倚。区间未跨零也不自动意味着实际重要性。
优先取得R10/R12可去标识的重叠核对，R04真实ICC及cluster分析信息，R08分散度，R09失访原因/随机组结局和缺失机制证据；核证前保留现有未决和敏感性。没有微观数据去验证缺失随机，也未实施完整RoB2/GRADE或职业专家确信裁定。

## 复建与交接

按submission.json与ENVIRONMENT准备依赖：reference.py --input <含原archive/protocol/correspondence目录> --output <不存在新目录>。源码从原HTML重做全部阶段/族/组统计/分析和图，不读旧CSV或机器结果。主要分析合同之外的更好模型可另交，但不能回头替换预注册选择。
extraction/effects/analyses/change-log与result.json互相索引；source定位对应原HTML的outcomes表及tr id。更新只追加新来源/修订，不删除旧档案、倒写旧阶段或只改结论段。未接受任何外部实际执行/现实委员会决策。
