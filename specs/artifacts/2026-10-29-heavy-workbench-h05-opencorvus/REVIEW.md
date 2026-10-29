# 独立非盲证据复核

审查者是原benchmark独立agent `benchmark_review`，只读，不参与本轮启动器实现、不再委托、不读取任何凭据或模型目录。它独立读取Task/Inspector/审计/用量和本次自有SQLite中的Task、Session、usage事实；不以主agent求和或agent名称作为唯一依据。

1. 首轮35条总量2,060,878，分组与原用量一致；去独立预检后Case仍2,027,671。公开终态cancelled/running0，实例及凭据收尾回执成立。此轮缺预算执行约束，不具备正式评分资格。
2. 第二轮指出本地计量错误：实例1,009,509里预检33,188，Case仅976,321；不能称H05耗尽100万。原始注册没有计量范围字段，不能事后改名成Case结果。此发现促成第三轮在启动前固定Task血缘边界。
3. 第三轮独立按`engine_task.session_id`与`session.parent_id`递归重算，16个Case usage ID集合与启动器触发/最终导出精确一致；Case=1,088,634，其他Session=33,217，无归属0，实例=1,121,851。
4. 独立确认末次前998,170、末次90,464；结算179ms后取消，符合结算后软阈值。不得写“严格100万内”。最终cancelled/inactive/running0，清理成立。18次Provider请求均目标模型、流式且EOF，和18条用量一致。
5. 第三轮原对话15个tool均completed：read5、snapshot1、artifact_read3、select6；没有worker业务调用或正式产物。可报告交付未完成和预算取消，不能认定调度异常或业务修复错误。

前三轮当时结论：认可Task用量归属及结算后资源控制，未发现新的实际计量阻断；**H05交付未完成，不能判通过**。前两轮失格必须共同保留，业务rubric不能从生命周期0分推算。本次不是盲评、真人评分器校准或排名资格。

## 用户纠正后的第4轮最终复核

用户未设100万上限；旧轮次取消不能解释为用户预算不足。独立agent先核实新资源条件实际进入registration/Inspect/生产Task并在超过旧阈值后继续执行，再从同一模型源码提交与冻结原输入实际独立复跑19.706秒退出0，逐身份查9个新库；真实诊断20/20、16业务叶非盲开发80/80。最终Task自然completed/inactive/running0，Inspect成功，195次精确模型流式请求均EOF；按耐久会话父链重算193条Case=20,901,186，预检33,190另计，无归属0。三份最终源码与实跑版本逐字节相等；两报告仅换行区别，原开发业务评审继续适用。实例和配对凭据已结清。最终结论为本题开发业务验收通过，formalBenchmarkQualified=false；不能冒充整个benchmark成熟度、职业专家盲评或正式固定预算比较。原评审pending状态原样保留，新事实见[最终独立附录](attempt-4-uncapped/reviewer-final-assessment.json)。
