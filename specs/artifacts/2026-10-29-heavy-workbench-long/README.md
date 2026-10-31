# HeavyWorkBench 长程任务建设与真实验收

> 用户纠偏后的当前结论：这些100分是原开发合同的合规验收分，不能作为所要求重型benchmark的性能分或有效性证明。连续封顶反映任务内容与评分上限不适合本目标；停止机械升版和再跑同型题。原记录/分数不改。

目前保有9份工程验收合同和相应原始记录，**不再据此报告重型benchmark完成率**。L02/L06已在真实对照中连续封顶；其余作者参考通过的题没有fresh区分度证据，不能假定合格。原始目标仍是10个具有实质难度、真实数小时有效工作的完整任务及可区分交付质量的评价。机械“两方good就再换一版”路线已停止；原合同/原分不改，先重建完整任务和质量测量的实质依据。

[当前十题矩阵](cases/README.md)列出每题实际成品和剩余缺口；[最新持续Recall](../../records/2026-10/2026-10-29-heavy-workbench-long.md)保留全部阶段/原失败/当前活跃定位。此前本页的组件资格历史已在月度Recall及Git中保留，本页只写当前可核对状态，不用旧active表启动重复任务。

| Case | 当前完整产物与真实测试 | 当前界限 |
|---|---|---|
| [L01论文复现](public/TASK.md) | 部分数值/恢复与真实训练资格 | 三方程解质量/完整可达/冻结尚未完成，方法分不能补偿解质量失败 |
| [L02发布时间预测研究](cases/L02/README.md) | 冻结66叶；完整科学参考/私有执行/独评；真实OpenCorvus候选100/66pass | fresh Codex原157/38独评/Q26/实际grade也100，已触发另升新版本 |
| [L03多源结账](cases/L03/README.md) | 原材料→全账/决策/实际图；四输入与真实错误程序/整审已交 | 作者参考资格，不是fresh模型难度证明 |
| [L04版本与恢复](cases/L04/README.md) | 原应用/实际库/ACK/双写者切换/真实进程故障/费用退款/前向修复/继续营业/图与移交；三输入和错误程序/集中整审已交 | 参考100、伪保证96关键失败；非fresh模型成绩或小时证明 |
| [L05事故与外部副作用](cases/L05/README.md) | 真实事故/在途/持久计划与两次中断/双sender/服务重启/逐来源账/监测/图/自含移交；三输入、真实正错程序与整审冻结 | 作者参考100、伪保证94关键失败；非fresh模型或小时证明 |
| [L06主动验货经营](cases/L06/evaluator/upgrade-v0.4/README.md) | 原0.4两个新系统均真实通过原合同/100；原全链、原失败和一次审查保留 | 仅工程验收通过，重型难度/区分度未成立；停止机械升版与新试跑 |
| [L07研究合成](cases/L07/README.md) | 原HTML族/依赖/六分析/更正/图；三输入/计算错/缓存/弱声明/整审 | 弱声明90仍关键失败；无fresh小时结论 |
| [L08项目恢复](cases/L08/README.md) | 真实组件验收/原付款/资源现金/最小延期/移交；三输入/七错误弱程序/整审 | 弱声明98仍关键失败；模拟工作日非agent墙钟 |
| [L09课程与陌生评分](cases/L09/README.md) | 六真实相依实验/commit后退出与恢复/陌生作业/完整教材及教师移交/图；三输入/两SQL路线/整审 | 弱学习声明95仍关键失败；30学时非agent小时，虚构试跑非真人成效 |
| [L10因果能源闭环](cases/L10/README.md) | 原资料→实际逐步控制/物理月账/commit恢复→独立重建NPV/选择/图/交接；三输入/真实错误programme/集中整审 | 作者参考100；错误保证96、可行idle85关键失败；不是fresh模型或小时证明 |

## 已发生的模型候选结果

[L02真实OpenCorvus完整评分](cases/L02/evaluator/pilot-opencorvus-20261030/final-assessment/README.md)：原Task12:07:30→14:09:01UTC自然completed；mode=code、builtin/base2026.10.14.1、gpt-6.1-sol全流式、orchestrator+developer+tester。完整工作区封存后才真正私有121运行/38独评/Q26/同冻结grader，16:00前实际100/66pass/study_complete/quality_success/good。不是Inspect完成分或作者publication投影。

全新Codex（fork none/无模型override/同16公开对象）已自然交付ee1ab32，全944文件/794.7MB原字节完整封存。16:24:40UTC开始真正同合同私有157（合法三选模方法），18:11实际grade100/66pass，已触发新版本。当前唯一动态定位D:/opencorvus-benchmark-runs/L02-current-pair-20261030.json；不重开旧Task/API。Codex实际model/usage和精确native起止未暴露，comparable=false，不能作同模型资源速度/费用因果排名；两good已真实触发新L02版本，旧线不改。

[L06旧成对实际结果](cases/L06/evaluator/pilot-codex-20261030/paired-comparison.json)两100已经触发0.3，旧public/rubric/FREEZE/成绩保留。作者参考分、任务生命周期、准备/故障/评估侧计算、缓存token、多核CPU均不代替候选有效小时；不能用材料行数或叶数冒充难度。

## 执行与边界

每题的public是候选输入，evaluator/参考/权重/私有作业及旧答案不能进入候选。新题从原料、真实执行、可复核输出和正确/错误程序进入同一checker，再一次集中整审；只修实质阻断、仅必要复验。当前只由熟悉资料的非盲AI进行开发审查，未作职业真人/统计成熟认证。更多真实区分度、小时与可靠性证据仍须实际取得。

旧reaction已自然0/AutoRemove；余五旧任务只保最后已知Paused，按最新用户指令不再Docker查询或恢复。L01原41k首格保留，原pending于05:06Z在本机CUDA继续；唯一locator/active与实际末态优先，不能另开矩阵/热改源。L06/0.3已完成整题本机/错误programme/一次集中整审及开发冻结，仍须真实fresh比较。全目标与有效小时未达，心跳保持ACTIVE。

最新L01：[完整研究源与真实科学结果](evaluator/l01-whole-case/README.md)已接首份19+5实际矩阵；原reaction完整训练仍3.5651%误差，结构对照的同架构可达不能替代旧优化轨迹。当前仍9/10，未冻L01、不报小时。动态入口与原失败见最新Recall，不重复启动原矩阵。

最新整题checker已接真实闭合native/逐步计数/14同final质量与175独评锚点；真实更新却报0的错误programme被同入口拒绝。完整正向研究/可达/独审/冻结仍待，[原错误与接受边界](evaluator/l01-whole-case/checker-construction/REPORT.md)不冒充第十题成品。


最新本机接续（2026-10-31）：用户明确停止Docker依赖。L01原首格已完成，仅原pending于05:06Z在本机CUDA续跑；真实训练PID18416/owner23296，动态locator优先。L06/0.3已真实本机8路径128commit、73后原receipt恢复、另16行序控制，全12M通过，完整交付/图/弱programme已交唯一集中整审；还未冻结/发布总分。当前9/10开发合同、有效候选小时0/10；不重复旧solver/41k/组件资格，L02升级仍待。详见对应最新README与持续Recall。


最新L06/0.3已按一次整题审查集中修六阻断并只冻结metadata：[完整可读交付、原件与实际评分](cases/L06/evaluator/upgrade-v0.3/whole-case-tests/README.md)。真正grader从closed对象重算，参考100，虚假保证弱报告95/H05criticalfail；不是LLM成绩或小时。旧0.2和L02两100只读，新L02升级仍待。


新L06/0.3：[首fresh Codex同冻结真实100](cases/L06/evaluator/pilot-codex-v03-native-20261031/README.md)，全原件先封后私有实跑/独评/实际grade；[同输入OC原生新Task](cases/L06/evaluator/pilot-opencorvus-v03-native-20261031/README.md)已开始，分仍null。两系统判定和小时未达，旧线不改，L01原pending继续。


最新真实结果：[L06/0.3两个新系统同冻结各100/全关键项](cases/L06/evaluator/pilot-opencorvus-v03-native-20261031/README.md)，新OC完整交付/原生私有整链/原图/一次内容独评/真正grader已封；触发另升0.4，不把双100称难度成熟。L01原pending本机继续、完整十题/新L02/L06及有效小时仍未达。


最新0.4：[同21public的新OC原生Task](cases/L06/evaluator/pilot-opencorvus-v04-native-20261031/README.md)已启动，fresh Codex也自然活动；均无业务分，完整交付后才私有整链/一次内容独评/同grader。只读属性复制导致的真实行序设施失败保原，不作策略分；不重已完成作者参考/冷跑/独审。


最新0.4：[首fresh Codex真正同冻结100/17pass/allcritical](cases/L06/evaluator/pilot-codex-v04-native-20261031/README.md)，完整自然原件先封后私有全链/实际图/唯一候选内容独评/真正grade；原readonly设施失败和修复分开保。OC本版原Task仍活动、业务分null，尚未两good；旧线和1%事前质量不改，L01原矩阵继续、小时未认证。
