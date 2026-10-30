# L02 多系列发布时间材料（建设稿，未冻结）

材料是原创合成计量需求，不能代表真实供水单位或用于现实业务决策。4个leaf站点A1/A2/B1/B2，ZA=A1+A2、ZB=B1+B2；规范量为整数L。材料/解码资格不等于完整预测研究、rubric或候选成绩。

日区间为UTC自然日`[00:00, 次日00:00)`。`event_end_utc`/`valid_end_utc`是该区间末端。所有发布时间是canonical `YYYY-MM-DDTHH:00:00Z`，没有本地时区或夏令时推断。固定2022-01-01T00:00:00Z为0，每小时一个tick；坐标不依赖完整未来档案有哪些发布时间。

`observations.csv`的业务键是series_id/event_date/revision_id；同一事实各发布版本以release_time_utc决定可知性，以最高已发布revision_id决定权威。当前材料rev0为初报、rev1为复核、rev2为终审标签。最新missing表示明确未知，value为空，不能改读旧有效值。终审实际release取自原行；`origins.csv`里的truth_lag_hours只是应满足的上界说明，不能代替原事实。

`value`为不含指数的十进制非负数量；`unit`逐行给出L或m3，按评估侧唯一material-contract注册的单位表精确换算为整数L；输入units.json须与之同义。先以Fraction保留完整十进制有理数，再检查整L，不能先转float或用低精度Decimal运算后检查。历史发布格式改变后，同一个event_date的不同revision可以使用不同unit，不能把最新单位倒套过去。covariate值为整数；temperature使用十分之一摄氏度，可为负。

`covariate-vintages.csv`含variable_id/valid_date/valid_end_utc/release_time_utc/revision_id/value/unit/quality_flag。`availability.json`逐变量声明known_future或observed：日历、当时发布的天气预测、运营计划是known_future，事后实测是observed。已知未来仍须已经发布。运营安排是可修订的计划，未宣布变化不能出现在静态catalogue；每次issue/revision分别保留，不能用事后实测替代当时预测。当前原材料每个zone的forecast覆盖issue当日及后13日，因此本任务14个完整未来日中只有前13日有当时forecast，最后一天该协变量明确缺测；允许合法外推/缺测策略，不能读次日issue或实测来补齐。

`series.csv`/`hierarchy.csv`定义身份和相加关系，不定义未公布的停用日期。aggregate标签由同一日两个leaf终审量相加，不能以混合发布版本凑一个“已知aggregate观测”。后续正式任务会明确层级点预测一致性及区间评价，当前材料资格不规定任意分数线。

`origins.csv`列开发、外层和附属内层切点。cutoff为日09:00；预测首个**完整未来UTC日**从次日00:00开始，首target_end为后天00:00，之后逐24小时，共14天。当天00:00至09:00已过去，不能将当天总量混称完整未来日。每个inner的实际终审标签必须在所属outer cutoff前已发布；声明上界和实际原行均核对。

公开开发截止2024-08-01T09:00:00Z，只交付在此之前已发布的vintages，包含可探索的开发标签和已发布的未来日历/原计划。开发origin为2023年6–11月15日，仅供公开探索，不称盲评；36个inner全部晚于公开开发截止。外层为2025年每月15日，6月为20日；日期和内层父关系均来自评估侧注册日程，输入不能自行改切点或把outer改成development。内层后续标签和外层受测标签保留在评估侧。公开开发包不是对早期origin的授权快照：执行仍必须按各自cutoff重新投影，不能直接把开发包里的较晚修订带到早期切点。

评估侧唯一`decode_materials.py`要求调用者明确指定`--role archive`或`--role development`及评估侧分配的`--contract`。输入clock/cutoff/units/grid声明须与该唯一注册合同匹配，不能由被核包自报授权截止。前者核完整目标终审存在及实际发布边界；后者核每条事实的开发截断和开发标签。role不从输入文件自报推断。输出canonical事实只能交唯一asof投影；完整canonical档案不能挂到预测worker。材料缺失/身份或单位错误、未发布开发事实、终审缺失/真实发布超界，均为具名input_invalid，不能计成候选预测失败。

当前整数原语的`forecast_reference.py`仍仅用于此前7时点解析资格。每日目标必须用明确target_ticks，不能使用`range(origin, origin+horizon)`把小时和日混在一起；正式研究接口、选模/点区间指标、完整参考/坏对照和评分合同仍待建设。未来拟采用滚动预测与WIS，方法依据[滚动origin说明](https://otext.robjhyndman.com/hyndsight/tscv/)和[加权区间评分论文](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1008618)，不强求显著性或固定提升。
