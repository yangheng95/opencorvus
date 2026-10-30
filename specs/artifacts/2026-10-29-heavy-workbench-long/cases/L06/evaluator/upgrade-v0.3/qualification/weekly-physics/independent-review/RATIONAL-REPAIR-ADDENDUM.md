# P2 精确有理控制修复追加

初版source/、fractional-reference-probe两原CLI输出、helper exit1及REVIEW-INITIAL.md全部保留。修复只改变qualify_delivery.py，其余9份被审当前源与原初评字节相同；修后source在rational-repair/source，具体diff与身份逐项保留。source-at-close.json曾观察到这一个文件漂移，是主方修复发布时序，不是周数学源被热改。

当前main只调用唯一unreduced_summary，把精确成本和各概率的分子/分母同时乘100，保所有合法有理分母，不再任意Fraction转float。没有新业务公式或第二解码器。

我独立执行audit_rational_repair.py一次，仅两条新实际delivery CLI，driver exit0，核心约0.528725秒：

1. 原合法1/3控制用同一formatter生成100/300和未约分概率，10叶verified_pass/exit0。
2. 从原0/1成本分支各取一条、等概率构造精确1/2；实际JSON字面0.5进入原Decimal reader，10叶verified_pass/exit0。

原0.3333333333333333仍是与1/3不等价的输入，其原C01 fail/exit2是正确的checker行为；我未重写为通过，也未把helper失败归于候选。主方原11CLI不重跑，S1原138观察/原计划不重算，无solver、Docker、预测、LLM、Provider、GPU或UI执行。

P2已在该工具范围闭环。S1核心实施与三个资格包装依赖可认可，本轮无剩余P0/P1/P2实施阻断。该结论仍不认证权威tree/history、持久online/不可信checkpoint、私有未来诊断隔离、完整0.3/新rubric/冻结、有效小时或十题成熟。
