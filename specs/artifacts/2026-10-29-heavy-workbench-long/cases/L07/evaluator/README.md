# L07 整题执行与评分

review_rules.py从原始HTML和往来执行唯一业务计算；group_fact统一归一原组，checker的引用验证实际打开原文核事实，不匹配作者偏好的定位。最高完整rank的不同统计是facility_corpus_conflict，不任择或给候选0。reference.py交完整研究成品。run_case.py仅用成熟Docker CLI执行本题source-only和两种原档变化，没有通用队列/数据库/调度新实现。

```text
python evaluator/run_case.py --submission <declared source> --input public --run <new path> --image <prepared dependency image>
python evaluator/check.py --input <actual base input> --output <actual result> --execution <trusted execution> --review <assigned review> --assessment <new file>
```

声明l07-submission/1 files/argv，真实路径留在提交内，任何正确语言/依赖可以在封存前准备；只读source/input、1CPU/netnone、新output/tmp。每个自有容器保create/完整inspect/真实native/log/结果后才精确rm。未知终止/OOM等原因不明是设施，不能靠脚本退出掩盖或伪造业务0。未设用户总token/墙钟截断，不把作者计算当候选小时。

check读取唯一rubric的权重/critical/90规则。十数值叶各自投影，缺一组交付不抹去已交正确数据；M11只收候选外真实base/mean-change/new-report执行记录。候选外review须case=L07/0.2.0-dev和精确output_root，H01–H05每项有pass/fail/missing、basis、可定位sources。没有真实独评则total/good=null（CLI4）；设施CLI3、完成但不good为2、真实完整good为0。不接受候选自评/Inspect完成分，也不把schema正确当科学真。

当前外部l07-full-case-20261030保原reference-run/final-run/六真实错误native/stale-run和材料修复；最终是consolidated-run、consolidated-weak-run：最高rank修后同当前programme各三输入实际native0。之后只修checker按公开合计容差、接受标准有限数量，programme/参数/native未变，没有重复矩阵。独立整题核算/一次冷跑/实际看图及好/弱五评级后，真实CLI分别100/goodtrue与90/goodfalse，见[whole-case-tests](whole-case-tests/README.md)。两者是作者参考/低质量控制角色，不是模型成绩/小时证明。
