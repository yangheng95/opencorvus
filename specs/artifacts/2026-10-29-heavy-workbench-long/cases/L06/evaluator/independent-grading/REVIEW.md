# L06 47叶聚合与真实参考材料独立复核

结论：本轮只认可聚合代数、身份/错误/未评分合同，以及已真实观察参考材料的私有评级接入。未批准完整候选评分或冻结。原空提交身份P2已经真实复现并修后关闭；原始源码和原错误结果保留。

## 真实协议复跑与固定分母

独立复制当前7源码、原始公开raw、唯一rubric与注册捕获后，实际回放13条已声明CLI协议，全部通过。其all-full材料明确为synthetic protocol fixture，既不是独立评审判断也不是参考/候选100分。

额外从唯一rubric权重独立用Fraction重算聚合代数：全叶full100、D01候选缺交93但critical失败、全部12人评half88且未达作者90阈值、C06质量失败92但critical失败。固定权重和100，不删失败叶重标；高分不能补偿critical。二元D01的half映射review_evidence_invalid；叶内half只按已有12具体锚点。

未评rating保留unassessed/assessment_incomplete；候选缺交/阻断是定位后的0分，设施错误为run_invalid无成绩。草案、资格前置未关闭或有未评叶时total_score始终null；已验证critical失败仍可明确business_success=false。正式冻结/全评之前没有good=true或成功总成绩。

## 真实参考观察，与夹具分离

actual-review.json是我基于此前唯一实际完整source-only冷复建、原始业务/模型核验、源码读取、报告/运营表和三张真实view_image观察制作的私有非盲开发评级。rater明确是此独立agent，任务来源是本对话授权指派；我已熟悉参考，不冒称匿名专业人类评审。

17叶中：D02 unassessed，因为原完整复建只验证了语义行序，尚未审查同一封存源码在报价变体上的真实完整新运行。变价可行见证不能替代这个执行。E03 half：中断容量/开关/实际到货耗料正确，但命名替代供方/提前期或保持策略依据的解释不足。E06 half：另一完整真实策略和47739.1费用成立，但未解释相对47737.6的增量1.5及产线费用/容量取舍。其余14叶的full均逐项定位本轮既有真实观察，未用合成all-full替代。

真实CLI得到44 verified_pass、2 verified_partial、1 unassessed，D02唯一未评；status=assessment_incomplete、exit4；total_score/business_success/good均null。30数值pass来自原适配器实际重算，不由评级文件覆盖。该结果是参考材料的开发审查，不是受测系统候选成绩，不自动等于专业校准通过。

## 实际P2与修复

初源仅比较submission_id相等，真实CLI中空--submission-id与空review ID可以得到assessment_incomplete而非注册错误，丢失匿名提交身份约束。原件在executions/empty-submission-id-protocol-probe/及source-initial/。修后在唯一assess入口、读rubric/numeric之前验证字符串且strip非空。原空串、空白串、真实partial17评级三项必要CLI全部按期望：两错误review_evidence_invalid/run_invalid/exit3且无finding/分数；真实材料仍44/2/1与exit4。修后source-repaired与repair-executions独立保存，初源/失败未改写。

## 信任边界和剩余工作

评审路径必须在候选交付之外的评估根，artifact_bindings绑定实际input/四输出路径；已评判断有观察/定位，执行和视觉叶要求对应材料类别。此为结构/采集约束。路径存在、角色字符串、assignment文字或schema通过都不能认证判断真实性，也不能证明评分者身份；受信任主评估者仍须从真实委托/原始执行与手工观察核验后接受rating。候选自身不能借写一份rating取得分。

本轮actual-evidence是原始完整复建证据的精确副本，evidence-origin-map.json保留来源/字节相等事实；这只说明被观察对象身份，不用摘要代替业务正确性。实际图片是此前已打开并人工核对的同一字节对象，非文件存在测试。

D02新真实运行终态及独立核算另待主方提供；本阶段没有运行或操作它。多质量匿名材料/独立评审分歧校准、最终冻结、fresh双系统候选与十题有效小时资格仍未达。独立agent不是专业真人认证。评级文件与引用校验不能消除这些剩余事项。

## 精确证据

source-initial/source-repaired、case-initial、GRADING-initial/repaired；protocol-command与protocol-replay/（13原始CLI/明确synthetic代数）；independent-algebra.json；actual-review.json与actual-evidence/来源映射；executions/（两个独立CLI含原空身份反例）；repair-executions/三原始执行；stage-assessment-initial/当前stage-assessment。全部只写本独立目录，solver/Docker/Provider/GPU/再次委托均0，未改共享仓库。
