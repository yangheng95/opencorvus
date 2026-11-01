# April完整月结待审包

已交一份从实际公开来源构建的[完整工作簿](D:/opencorvus-benchmark-runs/gdpval-month-end-task-20261101/reference/Aurisic_Financials_4-25-1.xlsx)，覆盖目录、April总账、现金/银行/资金来源、预付、费用、两笔贷款、应付/应收、工资及各应计支持，并将缺失来源与真实账差放入CFO待审事项。它是**可复建、已核数和实际看图的作者参考待审包**，不是已签字财务报表、独立整审通过、冻结benchmark或模型成绩。没有自动启动候选/审查。

用户随后明确授权的[一次集中独立整审](independent-review/README.md)已自然完成。其结论为参考完整质量/公平全题评分/数小时深度/模型启动均未就绪，9项问题有原源、代码和实际图定位。原数值匹配仍保，不能替完整质量；没有修复/复验/候选或第二次审查。下文作者阶段事实保原时点。

[实施前方案](BUILD-PLAN.md)、[公开质量合同](public/QUALITY-CONTRACT.md)、[输入定位](public/INPUTS.json)、[源关系](SOURCE-FLOW.md)、[财务负责人交接草稿](CFO-HANDOFF.md)和[逐维作者复核](AUTHOR-REVIEW.md)共同说明当前边界。原任务要求保留March结构/顺序、更新3a往后，遇缺失/不一致须明示后交CFO；本包按这一交付语义处理，没有编造AP明细或将未知银行余额视作0。

## 来源与公私边界

原根为`D:/opencorvus-benchmark-runs/gdpval-month-end-task-20261101`。GDPval task `ee09d943-5a11-430a-b7a2-971b4e9b01b5`的17份输入均从固定revision `11e7900cdcac61bc4daf59e65feb238acda98fbf`取得；原prompt来自实际捕获row响应。固定parquet逐字段比较发现prompt、rubric_json、rubric_pretty三文字字段字节不同，**不能称所有字段完全相同或该row服务revision已核**。prompt实际diff显示固定文件的替换字符与捕获文本的标点/项目符号、末尾换行不同；文件列表、文件URI和task身份相同。两原对象、完整diff与[原身份收据](evidence/fixed-source-identity.json)均保留，未用文本归一强行宣布字节一致。

先读原prompt和公开输入、写质量合同及源关系，之后才查原专家AP表。专家表含未随公开输入发布的供应商金额，故不能从相同公开材料构建该AP明细，也没有抄入本包或当正例真值。专家/rubric/parquet/row整行保在外部分区，不供未来候选；候选只可取`public/`原料、原任务及公开合同。原数据卡未声明具体SPDX许可，原XLSX/专家/完整parquet不进入仓库，不宣称受本仓库许可覆盖。[官方固定来源](https://huggingface.co/datasets/openai/gdpval/tree/11e7900cdcac61bc4daf59e65feb238acda98fbf)。

## 实际数值与消费

总账保105个division/account联合身份、名称、类别及带符号期间/YTD金额，March原97个账户保原行定位后追加8个新账户，避免旧跨表引用错行。现金控制6,610,926.80，未清支票16,166.78；独立银行余额缺失，不能据总账反造对账成功。两笔本金18,300,000和13,500,000合计31,800,000与GL2600/2601相符；合并应计利息67,315.06432876726与GL67,315.07仍保约0.00567差额。

专用预付1250按供应商重算692,501.3131313132，对GL692,501.33差约0.01687；保险1251专用版本5,493.27与GL54,630.68差49,137.41。combined版本重算保险49,137.41，版本/期间不一致仍待公司确认，未选最接近GL的版本作答案。法律源表重复小计已改为逐交易计一次，435,284.69对GL；工资原带符号滚动−318,500对GL−141,033差177,467。完整已知/未知见交接草稿，不用小残差或表格存在冒财务正确。

生产与消费为不同输入解析/计算途径：生产用regex归一原TB、Artifact Tool公式；消费者从原TB右端字段独立解析并以Decimal求和原始交易；预付/贷款/工资/杂项公式由独立`formulas 1.3.4`重算源precedents，逐供应商结果进入比较。它没有把原缓存、作者JSON或专家结果当预期。两引擎同读同一源文件仍不代签公司政策或完整职业判断。[公式引擎官方说明](https://formulas.readthedocs.io/en/stable/doc.html)。

最终实际生产02:19:49.306→02:20:02.197Z/native0，保存可见性元数据后同[数值消费者](check_package.py)02:20:03.012→02:20:04.618Z/native0：105账户，5项现金控制、122项支持结果、874个保留原始输入全部匹配其明确预期。错误完整programme仅在首次生产时将April总账换成March原97条，其全部支持表/原始输入保留；同一当前消费者native4，159项总账差异、33项支持结果不匹配、874原始输入仍匹配。错误programme没有重跑，原源/完整XLSX另保。所有[真实命令收据](evidence/final-delivery-commands.json)、[逐值参考结果](evidence/reference-measurements.json)和[错误结果](evidence/wrong-measurements.json)保留，controller成功不替子进程exit4。

该消费者是当前模板参考的坐标适配器，只认证明确列出的数值/输入合同，**尚非兼容所有合法交付布局、源版本判断或未知事项表达的通用candidate grader**。不把上述匹配或一次错误拒绝合成100、职业/统计成熟或重型资格。

错误的33项支持不匹配中，30项是已有结果与真实April预期不同，3项为最终补加的本金控制E84:E86在旧错误产物中未提供；不能将后三项当作额外算法错误。比较中的1e−7仅用于引擎浮点表示误差，原财务残差继续原数显示，不是新增公司重要性/可接受账差线。

## 实际重算、视觉和复建

保存XLSX后真实导入/重算，19张表的23个关键视图实际呈现查看；费用源标题截断、长浮点控制值、预付遗留错误/说明相互覆盖均在同一producer修正后复看。图见[views](views/00-toc.png)。只有内存副本把GL1024 YTD加1时，现金及银行页独立标出的book控制各加1，银行独立调节仍保持unavailable；[刷新收据](evidence/actual-refresh.json)保留，交付文件未被该实验覆盖。并非Microsoft Excel原生窗口验收。

本机Node24.22.1/Artifact Tool2.8.106负责唯一财务工作簿作者路径；Python3.12.14/openpyxl只读输入/实际输出，OOXML小工具仅补原源可见性与outline属性，不改变数值/公式/样式/缓存。独立公式库只装入本任务`calc-deps`，原科学venv/GPU未改。首次扩展核数错误为把杂项B5（实际`=-7892+3452`）当字面数读；保首次工具错误，增加该源的独立公式重算后原核数通过，不是候选或生产共享异常。

必要原生复建顺序如下；已闭合本次对象没有重复需要：

```powershell
python prepare_source.py --root D:/opencorvus-benchmark-runs/gdpval-month-end-task-20261101
python recompute_sources.py --root D:/opencorvus-benchmark-runs/gdpval-month-end-task-20261101
node build_package.mjs D:/opencorvus-benchmark-runs/gdpval-month-end-task-20261101 <new-output-directory>
python preserve_layout.py --root D:/opencorvus-benchmark-runs/gdpval-month-end-task-20261101 --output <new-output-directory>/Aurisic_Financials_4-25-1.xlsx
python check_package.py --public D:/opencorvus-benchmark-runs/gdpval-month-end-task-20261101/public --workbook <new-output-directory>/Aurisic_Financials_4-25-1.xlsx --source-calculations D:/opencorvus-benchmark-runs/gdpval-month-end-task-20261101/independent-source-recalculation.json --output <new-output-directory>/measurements.json
```

作者源/合同/交接/实际数值/视图投影在仓库，完整原料、原专家、所有原/错XLSX、依赖、日志、首次与修正前源包在外部原根；[scope](evidence/projection-scope.json)逐成员说明，不冒完整工作区。原模板ID在跨工作簿copy的中间阶段有missing-sheet警告，最终唯一dated引用已改为April、实值消费/重算通过；原警告照保。

原公式引擎stderr进度行保留回车/空白字节，完整`git diff --check`因该原日志返回2；源码/维护范围返回0。没有格式化原日志去冒验收通过，这一格式诊断不替实际财务消费。

本任务具备实质跨表核对及缺失信息处理，但多数支持表已预填、作者生产很快；这些事实**不证明候选需要数小时**。作者交付时尚无独立整审；现在唯一获准整审已完成并指出质量/测量缺口，仍无专业真人/统计成熟、合法变体覆盖、候选区分度或Codex/OC结果。十题目标和有效候选小时0/10不变；不以本包再开作者研究/参考/图/组件资格、机械升版或自动候选。通用验证修正已实施，行为改善/根治效果仍未证实。
