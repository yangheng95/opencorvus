# L02：按发布时间投影输入的低成本资格

## Recall

用户目标是10个真正重型全链路任务、可执行严格rubric、单层独立审查及OpenCorvus/fresh Codex横向比较，两好则升级。最新“从便宜的实验开始做”优先，无用户总token/总墙钟额度；不能用等待、重复或数据/叶数凑小时。当前冻结仍只有L06；其原Task已自然完成，基例/报价评估侧冷计算通过，唯一行序容器b6754c...还在运行。先查Git并读长程/L06/L05/L04/工具/横向Recall，保护无关改动，不启动新完整solver/GPU/Provider/UI或用户进程。

本轮已读九题独立设计H02、旧H02题面/计算合同，搜索当前long各Python/JSON，没有L02当前实现。旧题392单序列/4切点/3指定基线缺发布版本和物理信息边界，全部未来CSV给程序后仅靠自述不能证明合法as-of（按当时已知信息）预测。旧题的作者总token/墙钟/CPU额度不移植；后续用户指令覆盖它们。旧20/80评分与所谓8–32小时未校准估计不当新成绩。

## 修改前分析与范围

直接问题是业务发生时点和发布时点混为一体：修订值、当时发布的未来协变量预测和事后实测可能被同时读取。根因是输入交付一次包含全部未来，checker只看模型自报max_time；改变模型或多加报告不能根治。新接口须由评估侧逐origin投影，只把合法快照交给实际预测程序，未来目标/原始完整vintages留在worker之外。已知未来日历/预测与事后观测分别有公开发布规则，不能禁止所有未来event_tick来误伤合法信号。

先做明确合成整数tick解析小例，不声称完整研究数据或任务冻结：t0..6的10+2t在origin7已发布，t3的999修订在release9才出现；合法线性预测为24/26。日历和当时温度预测可覆盖未来，事后温度实测在release8不可给origin7。未来数据扰动保持所有合法历史同值，应得到语义相同输入；同一确定参考在两个真实隔离进程中预测一致。相同预测不是普遍无泄漏证明，须同时核真实输入投影和挂载。

只有benchmark私有评估工具/公开draft信息合同受影响。无生产Task/Mission/Session/LLM路由/队列/配置/数据库迁移/UI/凭据变化；实际工作进程只是标准库Python数值程序，不是新LLM执行器。只用已有依赖镜像和Docker primitive，1CPU微型worker、networknone/readonly源与快照、新输出，无原完整vintages/targets/旧答案挂载；不与行序控制并发长求解。所有结果仅局部能力资格，不计十题完成或小时。

## 实施与验收方案（执行前）

1. 唯一投影实现明确release_tick<=origin、观测event_tick<origin、known-future协变量按变量注册类别、不同revision的权威与缺测含义。当前tick是合成日界，不假装已定义真实时区/ISO数据；完整任务另补多系列/修订/迟报/单位/层级/内外选模范围。
2. 参考只从快照选择已发布最高revision，再以标准库Fraction做普通最小二乘，不硬编码24/26。评估侧独立SQL重建许可行与手算误差；泄漏快照加入未发布修订/事后实测，应被具名availability_violation，不按文件名判断。
3. 两个原始未来版本投影origin7，分别实际Docker执行同封存源码；核readonly实际挂载/网络/新输出/自然exit和预测24/26、last22/22的解析MAE3。origin9只做发布时间边界投影，确实允许新修订，不将合法但可能质量差的修订误判泄漏。
4. 独立agent一层审查/有限新目录冷复核与错误输入挑战，禁止再委托、新完整solver/Provider/GPU/UI；保留所有失败，修根因后仅必要重验。公开接口/来源投影/预测数值不等于真实研究质量、统计可靠性或全L02可达见证。
5. 新spec与产物同步三个索引和目录README、当前docs:check；本任务范围提交，正常fetch/merge/待推集合审查/hook/push。L06行序自然终态时优先封存/核算/独立D02/真实聚合，然后启动已注册fresh Codex，不能被本资格搁置。

## 初跑与独立格式反例

主方两个实际1CPU/readonly快照/netnone worker合计约6.1秒，精确OLS预测24/26、解析MAE0、last22/22 MAE3；修改未发布未来后快照与预测一致。晚修订/事后实测具名availability_violation，伪造origin具名assigned_origin_horizon_mismatch；origin9确实允许999修订。原件在D:/opencorvus-benchmark-runs/l02-asof-qualification-20261030/main。这里只是局部解析可达与信息边界，不是完整L02成绩。

独立审查实测三个假通过：revision_id的0→False、release_tick的1→True及calendar值1→True，checker均exit0/projection_verified。原件与初源保存在D:/opencorvus-benchmark-runs/l02-asof-independent-review-20261030/initial-probes，不覆盖。根因是原raw严格校验而snapshot行直接用Python dict/tuple等值，bool与int同值，因而没有证明事实类型身份。影响所有snapshot表/索引/值，不是单一字段或预测算法问题。当前checker是唯一消费者；投影本身产出整数，worker仅读已验证快照，无产品/数据库/LLM/UI路径受影响。

修复仅让snapshot事实复用唯一validate，然后仍以独立SQL重建许可集合；不复制schema、不开fallback、不用字面文本/摘要验收。修后独立重放原三个真实CLI错误，分别应为input_invalid/row_tick或valid_value，并执行唯一独立微型冷worker及必要新修订/缺测边界。主原始6.1秒执行属于初字节，不能冒称其已执行修后checker。

## 最终局部资格与下一步Recall

单层独立agent已实际重放原三个CLI：revision/release的bool得到input_invalid/row_tick:observations，covariate值bool得到input_invalid/valid_value:covariates。修后唯一独立1CPU/netnone/readonly微型worker自然exit0、24/26、MAE0对照last MAE3，完整15项核算合计4.483秒。新最高版本missing例的旧值999被明确缺测取代，参考真实18/20；再减少合法历史时输出execution_failed/insufficient_history:S。所有自有worker自然终态后精确移除，原失败/原初源与修后源/argv/inspect/新预测都保留。

独立最终REVIEW/stage-assessment/final-source-identity明确blocking=[]仅限本小原语，四当前源与审查快照逐字节身份只绑定实际执行版本，不当功能验收。资料在cases/L02/evaluator/qualification/main与independent-review，原完整ZIP保留初次审查脚本路径错误及三个真实假通过；不把工具首失败算候选业务错误。未启动额外完整solver/Provider/GPU/UI，没有候选分数。

下一步须从完整多系列研究问题出发建设原始发布/修订/单位与实际时间资料，给出逐origin程序接口、外层预测与内层选模隔离、点/区间/聚合质量与决策/复跑交付，独立完整参考和具名错误对照进入全rubric后才冻结。当前信息边界原语不能证明完整L02可达、专业/统计可靠性、难度或数小时；不要重复这个小cold凑量。整体冻结1/10、候选小时资格0/10。

L06已于00:27UTC取得实际完整OpenCorvus100/100后才启动fresh Codex /root/codex_l06_fresh（fork none、同18public、禁止再次委托），动态定位仍L06-current-pair-20261029.json；后续先看其真实状态，不启动重复候选或旧API。基例/报价/行序评估侧已全部自然终态封存，不再重复solver。
