# L02 可按发布时间复建的层级预测研究（未冻结）

[任务草案](public/TASK.draft.md)、[原材料规则](public/MATERIALS.draft.md)和[研究接口](public/STUDY-CONTRACT.draft.md)定义原创UTC多系列数据、内外层许可、均值/边际区间、实际选模与科学交付。公开截止2024Aug1、六个2023公开探索切点不称盲评；36个inner均在公开截止后，外层12个2025切点含June20。完整private档案不能挂给预测worker。

[完整每日数值参考](evaluator/qualification/daily-full-reference/README.md)已实际完成12outer/36inner、108forecast/12selector。原CSV通过唯一project选行，worker/selector分别只读最小输入、1CPU/netnone、新输出；每forecast84格、原始发布/校准/拟合/选择来源和精确指标均经[单层独立核验](evaluator/qualification/daily-independent-review/REVIEW-FULL-MATRIX.md)。原失败、修后边界与全部源码/终态/实际新图分别归档，没有用参考耗时冒充候选小时。

全期去天气消融优于天气扩展；June转移边界A1/ZA真值日均13751.75L、所选预测9341.10L，四天中央80%区间全失覆盖。这些负结果和未识别量效如实留在[研究记录](evaluator/qualification/daily-full-reference/REPORT.md)，没有看outer结果改池或倒填宽松质量线。旧7时点OLS/qualify入口已退役，原程序仍在历史ZIP，当前只有每日参考入口。

[通用数值执行合同](public/EXECUTION-CONTRACT.draft.md)另有[两语言/原CID恢复/封存重算局部资格](evaluator/qualification/generic-execution/README.md)：候选自带files/argv和池，预测/selector/report分开获得授权数据，SQLite为唯一cell状态来源。原作者硬编码执行及双格式summary不保留当前fallback。单outer私有诊断不是正式12outer候选研究。

[相对质量政策与研究稿](evaluator/qualification/quality-study/README.md)新增事前固定的外部参照/单期损失条件，原真实选择26/26通过，基线自身、零预测、极宽区间与一致性联动单叶退化均被拒。新[66原子rubric稿](rubric.draft.json)和可信评估聚合明确关键项不能被高分补偿；作者研究分析保留June实际缺量，仍是事后分析稿。

目前认可数值参考/通用执行和质量局部证据；完整正式清洁assignment、报告执行来源通道、职业科学/运营参考、全grader绑定、人评锚点/独立冻结仍待。study中正式quality_floor仍null，建设期政策另立draft；候选成绩与小时证据不存在。整套合同冻结仍1/10、有效小时资格0/10。
