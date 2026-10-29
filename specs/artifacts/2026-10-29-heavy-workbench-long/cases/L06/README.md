# L06耦合采购/生产/现金：完整合同审查稿

这是旧H06的升级设计，**尚未冻结重型case，没有新版候选分或小时级证明**。当前公开原始材料、完整合同和局部checker已有独立资格；完整实施/清洁参考与后续验证仍待完成。十题目标未达成，不能以本题代替整套交付。[方案/Recall及全部失败历史](../../../../records/2026-10/2026-10-29-heavy-workbench-l06-qualification.md)保留每阶段真实证据。

[公开任务](public/TASK.draft.md)、[数据字典](public/DATA.md)、[输出合同](public/OUTPUTS.draft.md)、环境/来源/profile及11CSV+facility形成一个原始业务包：16周、4原料/4产品、3供应商/2产线、3情景，含提前期/包装/共享容量、固定费、BOM、周内仓容、现金及揭示前共同承诺。材料明确合成，不冒称真实企业采集。任务没有总token/总墙钟截断或最低时长，接受成熟高效算法。

[47叶100分rubric稿](rubric.draft.json)把物理/资金/质量/清洁执行设为critical，高方法/文档分不能抵消关键失败。候选缺交与候选依赖阻断明确0分；评估器故障为run_invalid、整次不发总分。无外部solver的合法算法有公平的终态合同，正确不变策略不强迫动作翻转。叶数不是难度证明。

目前实际取得的证据：

- [完整合同独立审查](evaluator/independent-public-contract/REVIEW.md)：独立557标量事实同值，5个原材料CLI按真实输出/错误通过；关闭summary场景值漏评、账语义/精度、错误状态、目录属性、可选库存及运行根歧义等具体P1。12人评半分已具体化，尚未多质量校准。
- [10叶输出primitive](evaluator/qualification/v2/delivery-projection/README.md)：主方11CLI及独立8正常CLI/默认reader5合同，另真实复现并修复Decimal指数崩溃，必要3CLI复测通过。原失败/初源保留；这不评其余37叶，不认证实际源码求解或发总分。
- [基例质量终态与预注册](evaluator/qualification/v2/integer-search/quality-reference/README.md)：一个CPU参考任务、8worker，1332.55秒自然结束；完整可行成本47808，成熟CP-SAT native界47380，相对该界gap约0.9033%。[独立追加](evaluator/independent-public-contract/quality-addendum/REVIEW.md)重算925业务/1488整数坐标/1096行，认可该明示信任口径下1%可达。唯一L已私有注册，变体未注册。原生OPTIMAL为非零gap内终态，不是精确最优或独立search proof；该计算不计候选时长。

- [30数值叶适配与独立审查](evaluator/qualification/v2/numeric-findings/README.md)：28真实CLI，schema后逐家族采集，原22业务/11输出回归；独立实际发现并关闭注册输入漂移和负gap错误通过。只评30叶，其余17未评、总分null。
- [完整源码参考链](evaluator/qualification/v2/source-reference/README.md)：同一build_model、唯一当前CP-SAT后端，从11CSV+facility到新计划/账/报告/真实三图约7分钟，自然exit0；成本47746.2在保持不变的注册参考下30数值叶通过。源码只读/新输出/networknone/未带旧答案；独立微型冷跑通过，完整CSV行序反转的独立复跑正在进行。

仍缺：完整独立冷复跑的末态/职业交付结论，17执行/审查叶与固定分母聚合，数值变体参考与准确评价范围，多质量校准及最终冻结，随后fresh OpenCorvus重型pilot/同规则独立评价/Codex对照和实际有效工作时长。参考链约7分钟不证明候选数小时；两系统都好时另升新版本，不事后改当前评分线。

[历史资格](evaluator/qualification/README.md)、[v1审查](evaluator/independent-v1/REVIEW.md)与[v2审查](evaluator/independent-v2/REVIEW.md)保留仓容共同漏项、不可行、修复和低质量对照；51263/52201只是早期可行成本。旧v1最小信用5369不能移作v2最优界。[严格有理LP下界](evaluator/independent-relaxation/REVIEW.md)约46220.2662、金额格点46220.3，仍不足单独认证最终解1%；不与native搜索界混称。

[S06微型管线](smoke/README.md)真实原生650.922秒及两方独立源码冷复跑只验证小合同，不计十题/重型难度。六个旧昂贵GPU/成本容器保持Paused。主方完整参考已自然终态不重启；唯一新增完整CPU复跑由独立agent持有，最新身份以Recall末节为准。后续优先全grader/变体和其他题，不重复成本搜索或小例凑时长。
