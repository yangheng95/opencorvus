# L07 独立整题审查

**当前L07/0.2.0-dev已是完整开发题，可保持材料/权重/阈值作metadata开发pilot冻结；没有剩余实质阻断。** 正常成品H01–H05均pass。弱成品H02、H03 fail，其余三叶pass；两份评级绑定各自consolidated实际输出，不由目录标签决定，也未手写总分。

## 原文与独立数学

我逐档读取注册/报告/附录/更正及往来，另写HTML提取和Fraction计算，不导入review_rules作算数oracle。两截止分别26报告/12注册/7独立单位、29/13/8；R01/R06明确同人，R10/R12只是possible，主分析保守合组且assume_distinct另算，不能称已证实重叠。

全部选中原组/来源、注册与观察人数/风险事实、末次结局/随访优先级、SE/SD、points/proportion、errors反向均与独立重建一致。R05治疗组按总平方和合并、共享C只一次，MD44/7、v106236/28175；R03已报ICC .04/DE34/25，R04缺ICC约定.03/DE127/100，低高敏感性只改未知者。R08的NR不是0，R09观察51/随机100及49%失访保留。

主分析、DL、失访排除、ICC0/.10、assume_distinct、全部留一的效应/方差/权重/Q/I²/tau²和区间逐项独立相同。主MD5.2530964425→2.06121632994；R02初APP的7变为截止后COR的−4，R13新加入−5，更正未倒灌初阶段。updated固定区间[0.637444,3.484988]，DL约[−1.296177,6.096490]，异质性I²约.844886；正常报告诚实讨论模型/未知改变解释，不以固定显著代替所有假设稳健。

方法原文已实际核对[Cochrane章6](https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-06)、[章23](https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-23)及[章10](https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-10)：单位/分析单位要一致，共享对照须妥善合并，设计效应属于有假设的近似；合成模型不能消除原研究偏倚。本题规定的固定/DL正态计算只作可比合同，不认证现实最佳模型或小cluster精确覆盖。

## 整题发现与修复

1. **低rank冲突被过早判设施。** 我追加同rank矛盾摘要，而同逻辑8周组已有唯一更高MAIN、主选12周亦未变；原程序却提前抛facility_corpus_conflict。当前先收完整rank，只判最高rank事实冲突。原合法输入修后可合成、effects/analyses不变，主方也有真实source-only成功原件；真正最高rank冲突仍设施无分。原反例及首次probe自有tr属性/row_id不一致的修正记录保留。
2. **公开合计容差与实现不一致。** 原3.484988端点+1.2e−7在公开abs+rel和界内，原math.isclose的max却误扣M07。现按同一合计界比较，原probe十数值叶通过。正常软件的有限JSON数与有理串均可，不能强制百位分数字符串制造格式难度；我将真实整本结果转标准float并重排行序，当前十叶仍通过。人数/身份/bool/null严格，不能把DE=True当1。

主方自查的新R14注册Cohort N与正文M矛盾亦已实质改为N；当前good/weak new-report原文的注册与正文一致。我未把旧矛盾档案追认为正确。以上仅必要受影响核对，没有再运行三输入矩阵或六错误程序。

## 实际成品与复建

正常和弱版当前各三次实际native原件已读：base/mean-change/new-report，同封存programme、1CPU/netnone、只读source/input，全部native0和numeric verified。旧六错误native、缓存错误M11fail作为有范围的反例保留，不据其声称所有错误已覆盖。

我只做一次允许的独立基例冷跑，声明两源码及原public、新目录、1CPU/netnone，native0；含封存及精确清理约2.9745秒。完整数值对象与正常consolidated成品及初原件相同。programme只读原HTML/协议/往来，没有预清洗答案挂载。先保原inspect/log/source/input/output ZIP，再只移除本次自有CID。最后数量表示/容差改动只在checker和文档，programme/native未变，未为此重跑。

实际调用view_image查看当前森林图：initial七项、updated八项及各合成区间、正向点单位、零线/阶段/ICC imputed标记均可读；负向R02/R09/R13及区间暴露清楚，数据与本次结果一致。正常/弱图为同一65325字节1950×900原内容，弱图没有因报告文本错误被误判为坏图。

## 内容评级依据

| 叶 | 正常版 | 弱版 | 依据 |
| --- | --- | --- | --- |
| H01 | pass | pass | 原族/时点/来源、报告与独立单位、当前选择定位真实且可核；弱末句没有改变其机器提取事实 |
| H02 | pass | fail | 正常版量化全部敏感性/留一/更新并限于合成档；弱末句宣称现实每位成人100%获益，无真实人群/个体效应识别或保证依据。不是用某次CI跨零来逻辑反证概率保证，而是该主张根本未获相应证据支持 |
| H03 | pass | fail | 正常版具体要求R10/R12去标识重叠核查、R04真实ICC、R08分散度、R09失访/缺失机制；弱末句宣布随机效应消除失访与重叠全部偏倚，抹去尚未核证的问题。前面的正确未知表/取证计划不能洗掉相反强声明 |
| H04 | pass | pass | 实际图、数据、单位/方向/阶段正确；报告解释错误归H02/H03，不凭标签连带扣图 |
| H05 | pass | pass | 声明源/依赖/命令/输出索引可复建与更新；弱程序同样真实生成成品，再实际追加错误结论，技术可复建不等于科学结论正确 |

逐叶具体原件见review.json、review-weak.json；主方须用真实check CLI合并M01–M11，我未代填总分。

## 冻结与难度范围

允许保持L07/0.2.0-dev身份、当前完整材料/模型/数值参数/16叶权重critical/90标准及最终执行对象，仅改开发pilot冻结metadata与README状态。原错/修后/控制与非盲AI审查范围保留。

本题有真实完整研究交付与可执行变化控制，但原档为规则明确的结构化合成HTML，参考/独立计算仅秒级。fresh候选区分度和几个小时有效工作尚无实证；不以文件数、检查数或等待强凑重型，也不因此结案十题/专业真人/统计成熟。两系统都好仍按既定规则另版升级。此次正常/弱版为作者控制，且我知道其背景，不能冒称匿名模型比较或标签遮蔽专家校准。
