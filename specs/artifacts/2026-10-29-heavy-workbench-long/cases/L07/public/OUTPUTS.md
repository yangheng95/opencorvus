# 交付与清洁执行

result.json的format为l07-review-result/1，stages为以protocol.json阶段ID为键的对象，每阶段包含：

* reports：每份截止内来源的report_id/registry/kind/revision/released_at，含注册与被替代原报告，不能只列最终采用文件。
* studies：每注册研究registry、report_ids、population/allocation/cohort/role/registered_on、status（excluded_design/excluded_population/excluded_comparison/no_endpoint/not_estimable/nonindependent/included）、reason、selected_endpoint/selected_week（无则null）、main_representative（无则null）、risk_facts和groups。
* risk_facts：randomized_n/observed_n、attrition_exact、high_attrition、concealment/assessor原文事实；无所选组时observed_n/attrition_exact/high_attrition均null，不用作者自评标签代替。
* groups：每原组arm/n/mean_points_exact/sd2_points_exact（未知null）/source，source为report_id/table_id/row_id；原组统计可按等价表示额外保留。
* effects：每可估研究registry/md_exact/variance_exact/icc_exact（individual为null）/icc_status（reported/imputed/not_applicable）/design_effect_exact；多治疗组已合并、对照一次。
* analyses：以规定分析名为键，每个含status、studies（实际registry集合）、k、mean_exact/variance_exact/q_exact/i2_exact/tau2_exact/lo/hi、weights（registry/weight_exact/normalized_exact）；不可估时k=0、数值null、weights空。leave_one_out为以被移除registry为键的同结构对象。

changes是以每阶段向其下一阶段的from/to为身份的数组，每项含studies（registry/before_status/after_status/before_md_exact/after_md_exact/before_variance_exact/after_variance_exact/before_sources/after_sources）以及before_main_exact/after_main_exact/delta_main_exact。before_sources/after_sources为各原组source数组，无所选组时空。新增注册保留before_status=null。所有表行序自由；阶段/研究/组/来源不能因排序混淆。*_exact量字段可用有理字符串或有限JSON数，依PROTOCOL统一精度比较，不强迫分数库；原人数须int且不能bool。

另交可读REVIEW.md、extraction.csv/effects.csv/analyses.csv/change-log.csv（或报告明确索引的等价完整机器表）、实际森林图和复建说明。报告须说明筛选与报告/研究/独立人群数量的区别、关键来源/替代理由、依赖/缺失/偏倚事实、主敏感性/留一和更新差异、结论界限与后续核证动作。原文定位必须实际支持数字；正确底表不能洗掉错误的强结论。图须显示本次每个独立研究及合成的区间、方向/点单位和阶段。

submission.json采用format=l07-submission/1、files普通相对声明文件列表、argv直接参数数组。所有解析真实路径须在提交内，不能经父目录链接读题外文件。/project和/input只读，/output和/tmp可写；程序完整成品写/output/result。封存全部声明源码后，同一程序从全新目录接原始archive、协议和往来重建；不预装清洗表/旧输出/凭据。不要求作者语言、文件名或库。
