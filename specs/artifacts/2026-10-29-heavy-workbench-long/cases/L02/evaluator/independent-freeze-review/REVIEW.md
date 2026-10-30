# L02/0.2.0 最终开发合同冻结审查

**可以冻结为 fresh development OpenCorvus/Codex pilot 的可执行合同。** 本轮发现的两项问题已修并完成必要增量核查，当前无剩余实质冻结阻断。允许下节列出的纯结案状态/说明变更；冻结元数据的最终reference仍须重新派生并由现有loader实际确认，不能复用候选metadata包冒称已验证最终frozen对象。

这不是十题完成、有效小时、职业真人/统计成熟或同模型因果排名批准。该case的预测区分度/有效工作量由冻结后的fresh候选实证；不把未来成功或小时当本次合同冻结的循环前置。

## 1. 实际审查对象和权限

完整读取16份公开文件、三个规范JSON及rubric.json，对照current-source实际producer/consumer：StudySource packet、pipeline forecast/selector/report assembler、scoring、selection、provenance、quality/registered reference、execution及评估publication。还核真实formal/716c assignment、原38/24与概率裁决、真实66pass grade及相关已完成组件证据。没有重跑reader、121矩阵、模型、report、Docker、solver、Provider、GPU或UI；未修改主仓/原run/原评审。

public-initial/、source-initial/、registration-initial/保存本轮初对象；public-reviewed/、source-reviewed/保存修后被批准对象。原代码初始与formal业务语义不变；此次仅selection的optional精确loss字符串边界修复，不能将原formal说成运行过这行新代码。实际原12选择输出均为正确字符串，主方限定回归与本轮闭式边界另证，不重建原历史。

## 2. 公开合同闭合

当前public清单恰16文件，三JSON和profile的相对引用闭合；本轮对象审计确认development-materials.zip仍与真实formal冻结提交5b445d92b原对象同一。材料时钟、UTC完整日、发布时间/最高revision含missing、单位、真实终审、开发截断、36inner/12outer、13/14天气可用性没有变更。

INTERFACES现覆盖真实submission/pool/programs、predict packet/原CSV、forecast精确网格和数值、inner/context/labels、selection必需/可选项、完整results及metrics/inner_selection嵌套、provenance和report receipt。与当前唯一producer/consumer一致：层级weight在原CSV metadata为字符串、score context为整数；预测数值不能用字符串或bool；mean与median分开，分位点不强求相加；scales及精确指标为有理串；IDs不作宿主路径且selected可作真实方法ID，精确tie按Unicode码点。

预测只收当前原始授权行、显式targets和本方法配置；selector只收已发布inner；完整numeric验收后report才收外层和窄来源副本。report programme与全部源在首私有预测前封存。没有把私有参照预测、rubric权重、grader、完整host环境/凭据泄给候选。原行/拟合/诊断来源与有限native事实各有真实边界；sidecar不证明训练，也不能单独证明reporter冻结时点。

方法/语言/依赖自由仍保留；科学角色/真实消融和声明全部方法的交付由公开任务及逐叶实质审查共同判断，不靠作者ID或强制ridge/经验残差。JSON全文、CSV、公式、索引等已交材料合读；报告主入口和传输验收不替代科学判断。公开F02明确私有host事实由评估原包补核，不能要求候选从sanitized来源伪造未知原始命令。

ENVIRONMENT准确限定实际镜像/NumPy/线程和容器权限，未认证的版本/跨平台/任意语言不虚报；PROVENANCE声明原创合成/许可和实际方法原文，WIS correction当前为1010592。最初错误DOI的编辑记录保留，不当科学结果或更改数据。

## 3. 本轮两个发现及闭环

**F1：report wire嵌套不完整。** 初INTERFACES只称metrics为普通研究指标、inner_selection为loss核对。当前已补score的status/metrics_exact/node_metrics_exact/rows/scope/candidate_score及inner_selection.status/expected/scope和expected所有字段；与l02_scoring.score、l02_selection.assess_selection、pipeline.assemble实际返回对照一致。没有新增候选必交项或更改数值。

**F2：bool冒充optional有理loss。** 原assess_selection把False/True经Fraction当0/1，违反公开精确有理串合同。我以三inner/完整局部目标的闭式wire控制真实调用，原0/False、1/True均selection_verified；原源/payload/output/函数回执保存，未说成真实预测或整案失败。唯一边界修后先type is str再作有理等值比较，同原两payload经candidate_assessment实际映射selection_invalid且candidate=True；0/7、2/2仍通过。四项独立修后观察通过，见type-repaired/assessment.json及selection-repaired-command.json。原错误码、算法、日程、池、评分与历史原件不变。主方20观察含12真实accepted的原选择回归另读，不冒称我重新执行。

自有初审定位中曾猜测不存在的GRADING.md和qualification/review-calibration；随后按实际EVALUATION-PROTOCOL.md及evaluator/review-calibration定位。ENOENT是我的文件定位，不是candidate或grader失败。所有实际原件通过明确现存路径核对，不把这些猜测作阻断。

## 4. reference派生与真实旧成绩

独立audit_registration.py只读对象检查29项全过，registration-audit-command.json记录实际exit0：

* 原parent registry就是716c实际assignment里reference.zip；新旧97成员集合完全相同，仅study-contract.draft.json和policy-before-results.json两个metadata成员改变，另95成员原字节不动。
* 逐类型完整diff只含study status/scope/quality_floor、policy status/scope；derivation完整列出，registration-source-objects.zip保old/current四原对象。原数据、material/grid/scales/固定配置、全部source/native/forecast不变，12参照预测仍1008格。
* 新study/quality内容就是当前公开规范对象；quality_floor只引用同一quality-policy.json和reference_id，没有复制第二组阈值/算法。
* 66规则/锚点/method/权重/critical及publication90与原assignment完全同型同值，40研究85分/26质量15分/固定100不变；现rubric仍draft、七readiness均false。当前case版本从-dev收敛为0.2.0只是发布身份，anchor1语义不变。

主方实际单一loader已对派生包完成完整12/1008资格；本轮独立只做上述对象/差异核对，不又跑loader矩阵或旧数值。archive内部study-contract.draft.json是格式1固定member键，保它不构成当前文件fallback；磁盘当前入口已唯一规范化。

旧formal/716c assignment/原38 review/旧grade原样保留。原真实grade66pass、draft/null/exit4；不把metadata更新回写旧native输入、report或grade。冻结后可仅用真实66findings对当前同语义publication调用原算术器，明确命名publication projection、注明reference角色；不能称新source-bound grade/native或候选成绩，不能用synthetic全pass代替。

## 5. 七readiness允许置true的精确范围

| readiness | 已有实际依据及批准范围 |
| --- | --- |
| registered_quality_reference | 原固定seasonal8配置/真实12参照及来源已独立核，当前metadata派生逐对象闭合。最终frozen metadata须再次派生/现loader确认 |
| quality_controls_independent | 预先封policy；selected26/26、baseline-self24/26只宏strict失败、zero0/26、wide11/26、coherent单叶退化23/26及参照/设施优先/同义行序/typed绑定等已有真实只读资格。它们是数值控制，不是候选 |
| formal_full_assignment_cold | 全programme及资产首私有预测前封存，真实108predict+12select+report共121verified，原源/输入/OS权限/终态/输出/报告封存，并已独立核其真实关系 |
| complete_scientific_reference | 原38逐叶真实初评和原图已实际查看；完整点/区间/coverage-width/2016行动双账/负结果/来源审查通过。未重新拟合全部系数的范围如实披露，不把自报fit当训练证明 |
| complete_grader_evidence_binding | 唯一reader/assembler的完整与partial/typed归因、stage/原对象/外部review/reference绑定资格，以及本次真实66pass grade；当前optional类型修复另有真实边界增量 |
| independent_rubric_review | 66叶/100分/critical非补偿/未评null/设施无分及完整本次38研究判断已审；本轮原新规则逐类型同一，公开字段与方法公平边界闭合 |
| review_anchor_calibration | 仅六内容叶×两质量×两完整等价格式共24项，初评/key封存及裁决齐。概率理由已纠正，初评不倒改；其余32个人评及两个执行叶没有同等负例覆盖。该true只代表明确范围的AI开发校准，不认证全38职业/统计可靠性 |

以上足以冻结可执行**开发pilot合同**，不能把readiness位名字扩大为未有的真人专家/整案盲评/充分统计估计或小时级证明。研究完成与Q26仍分开，全部critical不可用加权分补偿；诚实负结果不强迫改变论文趋势或精准复刻参考轨迹。

## 6. 允许的精确结案动作

允许study/policy/profile.status→frozen；rubric.status→frozen及上表七readiness→true；版本/phase/scope、每叶readiness说明和文档/README/索引只改发布状态与已完成事实。允许新增FREEZE记录指向本审查/具体证据，改正当前README已滞后的“尚未完成”状态及REFERENCE-LITERATURE当前链接。历史dated记录、ZIP和旧执行对象不重写。

不允许改原材料/日程/单位/尺度、数值域/公式/quantile/alpha、选择与配置义务、固定参照预测/方法、Q26关系、66 IDs/锚点/权重/critical、90比较标准，或把未实施能力写进scope。除已审selection严格类型修复，不借结案再改程序算法。任何这些实质变更需新审，不由本批准覆盖。

最终frozen metadata必须新派生reference并保存相同白名单diff/95原证据成员身份，现唯一loader实际确认；若发生差异或设施错误，停止宣称冻结完成、保失败并修根因。必要的publication算术确认只消费真实findings，原null/exit4不改。范围文档/提交/push与fresh公开输入pilot随后由主方按原授权执行，无须新增矩阵/reader重复来凑资格。

## 最终结论

没有剩余实质冻结阻断；允许按上述受限结案动作发布L02/0.2.0开发合同并开展fresh双系统pilot。该批准不是套件完成或用户总目标结案。未来区分度/实际有效工作、剩余九题、职业/统计成熟及模型比较限制须继续真实采集，不用作者参考计算和评估侧读取时间替代。
