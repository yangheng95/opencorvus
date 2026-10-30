# L02完整UTC材料/解码方案：独立设计审查

当前方案可以继续进入材料生成、唯一decoder与逐事实许可资格。初审发现的两个真实语义阻断已在计划和两处grid定义中修正；本轮没有运行生成器、decoder、worker或研究参考，不能认可材料已正确、完整L02可达、全rubric冻结、职业/统计成熟或数小时。4leaf/2zone、三年和修订行数本身不构成难度证据。

审查范围是L02记录末节、现有公开原语合同、目标网格修正的两个明确源码位置，以及标准库日历算术。没有读取fresh Codex项目、发送私有消息、再委托、Provider/solver/GPU/Docker/UI或用户进程操作，也没有改主仓。修改前计划、初两源、修后计划和grid源码副本均保留。

## 两个原阻断与当前修正

1. 原“09:00 origin、首end次日00、未来14完整日”不一致。2025-01-15T09:00Z的次日00目标，对应[2025-01-15T00:00Z,2025-01-16T00:00Z)，含已过去9小时；那是当日总量nowcast加13未来日，不能称14个全未来日。当前选择已明确：首区间[01-16T00,01-17T00)，首end后天00，再逐24小时共14个目标。builder的origin构造和decoder的forecast_grid均从+1改为+2；直接diff留存。没有执行错误旧grid，也没有据其产生候选成绩。

2. “开发release截断Jan1”与“所有target/final labels均私有”原来不能并存。2024Jun–Nov开发origin的14天终审行在2025-01-01T09:00前均已发布，必然可作为后来开发历史公开。当前分清三层：公开开发标签用于回测/设计；2025 outer受测标签不公开；每个worker的特征仍只能来自其origin合法快照。这个修正允许真实回测，不冒称开发结果是内容全盲预测。完整开发档案不能原样挂给较早origin的worker，后发布终审值也不能回填历史特征。

当前spec明确写入这两项选择，我已只读核对。decoder差异中还出现plain-decimal格式收敛；本次仅记录其存在，没有借grid审查认证其完整值域或执行行为，留给实际材料/decoder资格。

## 可达的日历部分及其边界

独立check_calendar_math.py计算12个outer×3个inner×两种grid共72个日历配对。按已声明固定终审release=end+21天6小时，两种grid的所有最晚内层标签均严格早于outer；新全未来grid最近余量483小时，即20天3小时。原nowcast口径余量507小时。因而修正grid后不需要扩大112/84/56天间隔来制造安全性，也不能把计算次数当实验样本或难度。

新grid最后2025Dec外层目标end为2025-12-30T00:00Z，终审release是2026-01-20T06:00Z。完整2025-12-31业务日end为2026-01-01，rev2在2026-01-22T06:00Z。事件覆盖至2025年底不等于发布时间也截断至2025年底；私有档案须保留这些2026发布尾部。若迟报/终审另有额外延迟，上述483小时只是固定规则下的算术，必须再以实际每条所需label的真实release验证，不能用origin表自报truth_lag_hours代替事实。

每个目标应有明确start/end，start=end−24h；event_end映射到固定2022-01-01T00:00Z整数小时，保持绝对坐标，不按全未来时间排序编号。UTC（Coordinated Universal Time，协调世界时）日界没有夏令时23/25小时差；闰日仍须进入实际日期校验。来源须拒绝无时区、非canonicalZ、非整小时、非法日期或错误24h区间；同end/revision却不同start的行不能折叠成同一事实。

日历计算与输入身份/许可验证是不同证据。calendar-math.json不证明已生成CSV、独立truth真实值或decoder实际执行正确。

## 材料/decoder下一闭环需要证明的具体事实

- **真实权限**：把原始CSV逐行独立解成(series/event_end/revision/release/value/flag)，用既有唯一asof core选择合法事实；新decoder只做严格格式、身份、单位与时间映射。不能再写一套release过滤器或在decoder提前丢弃旧修订。每个outer/inner的真实label发布日期要逐目标匹配；inner特征截止inner，选模可用的inner结果必须在outer已发布，outer目标不能参与反选。完整接口以后统一提供24h target_ticks，旧range(origin,origin+h)只属于已归档小时toy，不能作新任务fallback。
- **开发截断与运营信息**：公开开发包不但行值，注册表、文件名、schema字段、catalogue、manifest和说明也不能提前标出未宣布的A2停用/A1承接时间。固定leaf/zone名和canonical单位可以公开，未来变化应进入带announce/release的通用运营事实。必要的便宜控制是改变cutoff之后尚未宣布的运营日期/载荷，检查公开开发对象及当时快照的全部语义不变；不是仅比较forecast值。已经公开的日历和真实提前宣布安排则可合法覆盖未来valid_end。
- **forecast的版本含义**：明确天气issue就是发布时刻还是另有publication；release必须是实际可获得时间，不能用较早内部issue回填。每个(variable,valid_end)的多个issue须映射唯一有序revision，最高已发布revision代表什么要一致。当前builder检索结果可见issue与13−lead映射，但本轮没有运行/全面审实现；实际档案仍须证明不重复、次序正确、迟到旧issue不覆盖更高权威。observed实际天气只能end后发布；known_future不是绕过release的通行证。
- **逐revision单位**：每行按其自己的L/m3转换，registry canonical单位固定L；不能用站点“现在的单位”转换旧版本。Decimal必须精确且finite；例如0.001m3=1L，若规范要求整数L，0.0005m3应有明确错误而不能默默四舍五入。温度若采用C_tenth等整数尺度，要公开独立单位映射。相同物理量的跨单位对照应同规范值，但真实修订可以改数量，不能强迫同事件所有revision归一化后都相等。
- **truth与missing**：预测特征取最高已发布版本，最高missing不能回填旧值，沿用已资格原语。评估truth是固定独立终审量；需明确受测目标终审是否全有有效值、若missing如何固定eligibility/mask，zone truth缺任一leaf时如何定义。不能按候选可预测性删除目标或让分母随交付改变。必须分别证明leaf与zone真值加总及truth发布时间，不以生成器自身函数重算替代独立核算。

这些是下一次材料资格需要给出的对象/错误合同，不是本轮已执行测试，也不要求完整研究pipeline先完成才能生成原材料。最便宜闭环是一次封存源码生成/解码，独立CSV/Decimal/UTC/SQLite复核，选一个迟报跨origin、一个新missing、一个跨单位版本、一个issue/release界、一个announce前后和一个伪造label-lag例；不重复toy worker或启动完整预测研究。

## 方法来源与不超范围的结论

时间交叉验证须以各训练时点可用历史构造真实多步预测，不能用全样本拟合残差冒充；这与本方案区分feature cutoff、validation labels和outer评估相符。[Hyndman原说明](https://otext.robjhyndman.com/hyndsight/tscv/)、[FPP当前教材5.10](https://otexts.com/fpp3/toolbox.html#time-series-cross-validation)。它们不自动证明这套发布时间数据的合法性。

后续区间评价可采用有明确quantile集合和权重的WIS（Weighted Interval Score，加权区间评分），但还须独立手算/错误对照；计划引用的[原论文](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1008618)及[2022更正](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1010592)已实际阅读，更正涉及示例值及图，不能复制未更正示例当oracle。本轮不审评分实现或设质量阈值。leaf真值可加总为zone，不意味着各级概率区间端点必须直接相加；日后若要求分布一致性，需要明确联合分布/相依语义。

12个outer、相关leaf/zone及重叠时间窗不是独立统计样本。完整方法/质量、无提升结果、决策价值和研究可复跑性将分别审；不能为迎合基准强迫“论文趋势/提升”。先看完整参考和差质量对照，再定质量线与完整原子rubric。当前只认可修正后的材料建设设计可以进入实际资格，不认可全L02、成熟benchmark或小时级。
