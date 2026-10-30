# L03 完整题包的真实测试

最终定版源码从九份原资料完成原单/版本→结算/逐来源账→期间/往来/预算→资金方案→报告和真实图。同一源码在base、有效金额变化、新期间和迟到更正四个新目录实际执行；每次只读source/input、1CPU/networknone、native自然exit0。完整实际父命令见[review-final-command.json](review-final-command.json)：14.095秒/exit4表示当时五内容叶未评，不能当成运行失败或候选有效小时。

单层独立审查另从原资料以Fraction/事件账核算整本来源、舍入、费用、现金、往来、预算、异常和管理决策，未导入作者core作算数oracle；结果一致。只另作一次基例冷跑，native0，连封存清理约2.709秒。主方与审查者均实际看最终图。[最终审查](independent-review/REVIEW-FINAL.md)、[实际内容评级](independent-review/review.json)和[批准范围](independent-review/stage-final.json)保留原件。

主方随后进入真实check CLI，合并原四执行和五真实评级：[final-grade-command.json](final-grade-command.json)退出0，[final-grade.json](final-grade.json)为参考100/100、20pass、所有critical通过。没有手写总分或默认填pass。它是作者参考资格，不是LLM候选成绩。

| 真实错误或同义对照 | 实际结果 |
| --- | --- |
| 将逐行USD舍入72分改为汇总71分 | M02失败 |
| 重复计银行导出 | M04/M06失败 |
| 借贷仍平衡但虚构来源分录 | M03/M07失败 |
| 无通知把未知银行款硬配 | M04/M06/M14失败 |
| 真实缓存答案程序跑完四种输入 | 基例数值通过，变更不重算，M15关键失败 |
| 表行序/额外来源注释/等价有理字符串 | 正确数值通过 |
| 交换交点left/right | 修后正确通过；旧误扣保留 |
| 颠倒服务月份 | 修后M01失败；旧漏判保留 |
| 父目录junction把声明文件指向题外 | 实际声明源入口映射source_path_invalid；普通文件通过 |
| 只缺decision的局部交付 | M11/M12缺错，不抹掉已交独立叶的实际通过 |

整题审查发现的43个非法2025-02-29、服务月反序漏判、交点方向误扣、报告可行域不足和源码祖先逃逸均集中修复。旧source/input/output和原失败没有倒写；日历修复前后四份完整业务对象同一，详见[日历修复](calendar-source-repair.json)和[业务对象比较](calendar-business-equivalence.json)。独立审查自身journal拆分比较false和中文diff编码错误也保留，未算候选失败。

[originals.zip](originals.zip)封存主完整run/错误对照/历史与定版源、原输入/命令/inspect/log/输出，以及独立完整账/冷跑/反例/审查；[archive.json](archive.json)说明来源和越界链接排除。外部完整根D:/opencorvus-benchmark-runs/l03-full-case-20261030及l03-whole-case-independent-review-20261030仍保留。归档身份不能代替上述实际运行和业务核算。

参考成品可直接查看：[REPORT](reference-delivery/REPORT.md)、[完整机器账](reference-delivery/result.json)、[实际图](reference-delivery/dashboard.png)。本题保负现金与无当前可行方案，未接受融资报价不入银行实账。独立审查是熟悉材料的非盲AI，未证明真人专业评分、统计成熟、fresh系统区分度或数小时难度；整套十题尚未完成。
