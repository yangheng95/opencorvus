# L02/0.2.0 程序数据接口

本页与material-contract.json、study-contract.json、quality-policy.json共同定义候选可用接口。当前开发合同已冻结，状态见profile.json。JSON（JavaScript Object Notation，JavaScript对象表示法）字段名区分大小写；布尔值不能代替整数。预测量必须是有限JSON数值，不能用字符串表示；带`_exact`的指标及`scales_litres`使用精确有理数字符串，例如`3/2`。身份字符串按原值保留，不作为宿主路径。输入列表次序只在明确规定时有意义，不能依赖CSV行序决定科学结果。

## 声明与执行

提交根的submission.json恰含format=`l02-numerical-submission/1`、pool和programs。programs恰含predict/select/report，每项恰含files（普通相对文件名字符串数组）和argv（非空字面参数字符串数组）。路径不能越界或是链接；文件在首私有预测前一起封存。以argv直接执行，cwd=/project，源码在/project只读、输入/input只读、新输出/output及/tmp可写、1 CPU、无网络。依赖先声明并由评估者准备；没有隐式shell、argv占位符或网络安装。详见EXECUTION-CONTRACT.md。

pool.format=`l02-method-pool/1`；methods数组的每项恰含method_id（唯一非空字符串）、role（科学角色baseline/extension/ablation）及configuration（任意JSON对象）。selection_ids为至少两个已声明ID，覆盖基线及科学扩展；outer_ids含全部声明方法，消融必须实际执行，所有格必交。配置可有合理的任意方法参数，ID为`selected`、Unicode或含标点也按身份处理；科学区别另审，不靠ID拼写认定。正式日程按公开material-contract.json，不由候选改origin或减少格。

## predict

/input/method.json恰为`{method_id, configuration}`，来自原池。/input/packet内只有packet.json、observations.csv、covariate-vintages.csv。两个CSV保留MATERIALS.md及开发ZIP相同的原字段/单位/版本，已按真实origin许可投影，仍含全部合法修订；候选先选最高已发布revision，包括missing，再作合法缺测处理。

observations.csv的字段集合为series_id、event_date、event_end_utc、release_time_utc、revision_id、value、unit、quality_flag；covariate-vintages.csv为variable_id、valid_date、valid_end_utc、release_time_utc、revision_id、value、unit、quality_flag。字段次序不作为身份；日期/UTC末端必须对应同一完整自然日。revision_id是规范非负整数字符串；quality_flag为valid或missing，missing的value为空。观测valid值是无指数的非负十进制原量，按该行unit精确换为整数L；协变量valid值是可带负号的规范整数字符串，单位按variables注册，不能先float舍入。

packet.json字段为：

| 字段 | 值 |
|---|---|
| format | `l02-daily-worker-packet/1` |
| clock | epoch_utc、tick_unit、event_interval，取公开时钟定义 |
| origin_tick | 当前分配cutoff的整数小时坐标 |
| target_ticks | 14个完整未来UTC日末端的整数坐标，按时间递增 |
| series_catalogue | 每项series_id、parent_zone、kind（leaf/aggregate）、canonical_unit |
| hierarchy | 每项parent、child、weight；此原材料投影中的weight为整数字符串 |
| units | 原单位到L的换算表，与material-contract.json同一 |
| variables | 以variable_id为键的对象；每值恰含unit字符串和availability（known_future/observed），同开发材料availability.json |
| quantiles | study-contract.json规定的七个分位点键字符串 |

输入没有终审标签、固定尺度、其它worker输出、完整档案或评分器。早期伪origin必须对其自己的时点重新作许可选择，输入在当前origin合法不等于在任意过去伪origin都可用。

输出/output/result/forecast.json恰含format=`l02-distribution-forecasts/1`、method_id、origin_tick、forecasts。method_id及origin_tick须与本次输入一致。forecasts每项恰含series_id、target_tick、mean、quantiles；每节点/目标恰一行，共84行。quantiles恰有`0.025`、`0.1`、`0.25`、`0.5`、`0.75`、`0.9`、`0.975`七键，值非负有限且单调。mean代表条件均值并满足层级相加容差，分位点不强求相加，mean不必等于median。量值和数值表示边界见study-contract.json。

可以另交可定位诊断文件，供后续报告和独立审计。经验校准、解析模型、Bayesian posterior按实际方法提供样本/观测/参数/先验及来源，不强制使用作者fit.json或某个文件名。自报诊断仍须实际审计，不能证明训练声明为真。

## select

/input/inner.json恰含format=`l02-inner-selection-packet/1`、outer_origin_tick、inner_ids、selection_ids、frames。inner_ids是本outer的三个注册inner；frames每项恰含origin_id、context、labels、labels_released_at、forecasts。labels_released_at为实际本组终审最晚发布tick，已核不晚于outer；forecasts以selection_ids各ID为键，值为其完整原forecast输出。

context恰含format=`l02-score-context/1`、origin_tick、target_ticks、series_catalogue、hierarchy、scales_litres。此处catalogue每项仅series_id/kind，hierarchy每项parent/child/weight且weight是JSON整数；scales_litres按节点给正精确有理数字符串。labels每项series_id/target_tick/value，value为终审整数L，包含合法相加后的aggregate。/input/study.json为同一公开指标合同。

输出/output/result/selection.json至少含format=`l02-selection/1`、outer_origin_tick（原整数）和selected_method_id（既有selection_ids之一）。如交method_mean_inner_scaled_mse，须为所有selection_ids到精确有理数字符串的完整映射，与原三inner独立重算一致。可附解释诊断；其它字段不会成为新outer配置。按三个inner完整层级scaled MSE的平均最小选择，精确同分按Unicode码点ID字典序。不能生成新参数、重新拟合或把标签送入outer。选择器还须对同格式合法数值控制按实际loss选择，见STUDY-CONTRACT.md。

## report

正式全部数值单元验收后才交/input/results.json及/input/provenance；报告程序此时执行，但源码已在首预测前封存。results.format=`l02-completed-numerical-results/1`；字段为outer_ids、all_outer_ids、complete_assignment、pool、aggregate_exact、outer_results、candidate_score、quality_floor。

aggregate_exact.per_method以所有原方法ID为键；aggregate_exact.selected是实际inner所选策略的完整宏结果，不能用同名方法覆盖。值含scaled_mse、scaled_wis、scaled_mae等精确有理数字符串。outer_results每项含outer_id、selected_method_id、inner_selection、metrics、forecasts、context、labels、label_release_tick。forecasts为各方法原完整预测；metrics为其普通点/区间研究指标，inner_selection为实际选择及完整loss核对。context/labels采用上述同一格式；该阶段允许读外层结果作研究报告，不能修改已封存程序或预测。candidate_score仍null；quality_floor仅指向公开政策，不含固定外部参照预测或rubric判断。这些普通研究指标不等于私有质量/总分评估。

metrics以方法ID为键，每值恰含status=`forecast_assessed`、metrics_exact、node_metrics_exact、rows、scope、candidate_score（null）。metrics_exact恰含scaled_mse/scaled_mae/scaled_wis三个精确有理数字符串；node_metrics_exact以series_id为键，每值同样三个字段；rows为84，scope说明仅边际研究指标。它不是私有质量判断或正式分数。

inner_selection恰含status=`selection_verified`、expected、scope。expected含format=`l02-selection/1`、outer_origin_tick、selected_method_id、method_mean_inner_scaled_mse及complete_inner_origins；最后一项为3，其余字段对应上节从实际完整inner独立得到的精确选择。该expected是普通选择算术，不是外部参照预测；report已经在数值完成后才收到此结果。

provenance/manifest.json的format=`l02-report-provenance/1`，含scope及cells数组。每项cell_id是不透明执行身份；identity给kind/outer_id及适用的origin_id/method_id/level。execution含declared_source_files、argv_projection、started_at、finished_at、status、exit_code。argv_projection每项position/kind/value：kind为executable_basename、declared_source、sandbox_path或opaque；opaque的value为null。artifacts每项output_member、input_path、bytes、origin；input_path相对于/input，指向该原数值程序的输出副本。它不交完整native环境、宿主路径、凭据、原数据库、外部参照预测或私有权重。

输出/output/result/report.md为非空研究主入口，可清楚索引等价JSON/CSV/公式/图及其它普通文件；report.json至少含format=`l02-report-receipt/1`和与results.outer_ids同顺序的outer_ids。传输验收不代替RESEARCH-DELIVERY.md和REVIEW-ANCHORS.md的实质研究判断。所有已经交付的等价格式合读，不能凭文件名、排版或一个合格schema认定科学结论正确。

## 终态与结果

非零退出、坏JSON、错误网格/选择或真实缺交按原事实归类；候选自报设施失败不改变native错误事实。设施、尚未执行、依赖确被候选错误阻断分开，详见EXECUTION-CONTRACT.md。没有最低时长或token额度，完成可立即交付。数据/格式/质量政策版本冻结后不因某候选成绩改线；两个系统都达到预注册的好标准则建设新版本。
