# L03 整题运行与审查

closing_rules.py是唯一原材料/金额/期间/结算业务定义，reference.py用它完成全部交付。check.py只读原材料和真实交付，核十四独立数值投影，权重/critical/90规则来自唯一../rubric.json。分录拆合/行序/有依据注释等价，不匹配作者特定输出轨迹；一组缺交不会使其他已交数据假失败。格式坏/未交、已证业务错、设施原因、未评内容分开。

evaluate.py接收候选声明源和固定镜像，从全新只读source/raw、1CPU/netnone真实顺序跑base/金额变动/新期间/截止前更正；保create/inspect/原stdout-stderr/输出/退出，退出后才精确rm原CID。不重启用户进程/容器。OOM/外部终止原因未明保持设施，不直接给候选0。原任务没有总token/墙钟截断。

```text
python evaluator/evaluate.py --submission <source declaration> --input public/inputs --run <new path> --image <prepared immutable image>
python evaluator/check.py --input <actual base input> --output <actual result> --execution <trusted evaluator execution.json> --review <assigned independent review.json> --assessment <new path>
```

程序传输只一个l03-submission/1的files/argv，任何正确语言/依赖可在封存前准备；不增加LLM路由/队列/隐消息。report和结果在同一程序执行链产生，source-only变化测试不能用旧缓存替代。是否通过人评，须实际读原材料/代码/报告/图；存在文件或正确schema本身不证明正确。

独立review.json含case=`L03/0.2.0-dev`、实际output_root及findings的H01–H05；每项status为pass/fail/missing、basis为实质理由、sources为可定位原件。review须由评估者分配并在候选目录外，不接受候选自评。缺评仍null，版本/对象不同是设施错误。该简单合同不宣称密码学认证或职业真人盲评。

全链主原件与源快照在D:/opencorvus-benchmark-runs/l03-full-case-20261030。最终review-final-run四个native均exit0；其父命令exit4只表示五内容叶尚未评。随后实际check CLI接同一原执行与独立review，exit0/参考100；这是作者参考角色。完整失败/修复/定版源及真实命令见[whole-case-tests](whole-case-tests/README.md)，不覆盖旧原件，也不把参考分当真实模型成绩或数小时证明。
