# L02 冻结前合同收敛：独立方案审查

方案可以进入公开合同/归档收敛实施，但**不是最终冻结批准**。三项实施前边界必须明确：不可变旧assignment与新publication状态分开；派生reference逐字段限定且不回写历史native输入；公开wire必须覆盖真实接口并保持方法/语言/表达自由。下面给出最小实现和验收，不建议新增执行平台、兼容协议或重跑研究。

本轮只读FREEZE-PLAN、当前公开八文档/三机器合同/rubric、相关唯一源码和真实原件；received/与source-range.json保存读到的对象。没有运行sealed reader、预测、报告、Docker、solver、Provider、GPU、UI或旧run，也没有改主仓。public新profile尚未存在是方案中的建设项，不是候选失败。主方正在实施文档时序另记，不能把本报告快照当作尚未生成的新文件最终批准。

## 1. 当前真实依据

原formal的121实际程序及原38/24审查已经完成，既有源码/信息许可/输出/图的实质核验不重做。本轮实际读grade-terminal.json和grade.stdout.txt：冻结5b的真正grade于11:23:55.900205UTC自然exit4，875.7613秒，subject=reference_qualification，66 verified_pass、无未评/失败，status=draft_assessment_complete；total/study_complete/quality_success/good仍null。这是正确publication限制，不是计算失败，也不手写100。

原38在校准前封存；24标签遮蔽初评及原key保留。概率追加澄清已核：June0/4是本次局部暴露，不逻辑否定有假设的80%概率保证；B09 fail依赖未经支持的joint/finite-sample宣称。只能据这些原件说熟悉作者参考的AI-agent开发校准，不能称职业真人、内容初见双盲或统计成熟。未来fresh候选/小时/九题不是此case可执行合同冻结的循环前置。

## 2. B1：旧评估原对象不能被新状态覆盖

代码事实：l02_evaluation.py:48把实际rubric/policy/reference/原execution一并封入assignment；:78–89逐版本和原执行对象核；:187–191又要求review持有的整个assignment字节相同。inspection.study来自原run注册/封存输入。load_registered_reference在study和policy上做逐类型全对象比较，不仅比较度量公式。

所以不能原地把716c包内rubric从draft变frozen、替换policy元数据或study.quality_floor，再让旧review看似评价了新包。也不能只改旧review.assignment_id。旧66pass/draft/null/exit4与其包、review、native继续是原事实。

最小实施任选一个明确目标，不混称：

* **不需要新整案grade**：冻结后用真实原66 findings对同权重/锚点的frozen publication作纯算术正向确认，命名为publication projection；附原assessment及逐叶身份/状态/权重同一证明，明确不是又一次source-bound grade、native执行或原输出变成有分。不能用synthetic全pass代替真实findings。
* **确需新source-bound grade**：新assignment/new review对象，保原evaluation stage/程序输入；独立评估者实际接收新包，核原对象与原38/锚点未变并显式再确认，不偷偷改原review。新reference必须与该run实际捕获的study/policy匹配。若使用当前派生reference而old study不匹配，应具名设施错误，不能临时忽略metadata校验来绕过。

冻结决策可由真实证据和最终合同审查作出；无须为把旧null变数字而重复15分钟reader或新预测。publication正向确认是实现验收选择，不应变成伪历史或新的资源开销循环。

## 3. B2：reference派生的最小严格边界

新公开study/quality与旧包全对象不同，创建新的注册对象是合理的。当前archive固定member名study-contract.draft.json是已交付archive格式键，保留这个不可变格式并不构成当前文件fallback；当前磁盘入口只有新规范路径。

派生应保存完整旧registry原对象及一份机器差异记录。允许变化的JSON路径事先枚举，仅status、scope、quality_floor公开引用及必要发布说明；material数值/units/schedule、scales、指标/容差/数字域、selector、quantile/alpha、固定method/configuration、Q26关系全部同类型同值。所有原forecast、实际method、source、terminal等证据成员原字节保留。不用“元数据”这个标题替代完整差异核对。

新包顶层对象应明确是**当前注册元数据**，与旧native真正接收的study/policy分离；旧原包或原execution contract对象必须仍可定位。不能用新quality_floor非null去声称旧report曾看过它。派生资格只需标准库直接对象比较及原loader适用性/具名漂移边界的必要局部确认；不重预测，不把zip整体字节变化当功能不一致。

study.quality_floor可只含公开quality-policy相对路径和相同reference_id，不复制26关系或loss算法。发布核查应证明引用存在、实际受信任quality参数为该同一公开对象、reference_id同一。实际指标结果中quality_floor由l02_pipeline.assemble直接传播，故新旧results这个metadata差异要明确；不能说所有报告输入字节完全未变。

## 4. B3：公开wire要与唯一实现逐字段闭合

INTERFACES应从真实唯一生成/解析点说明required/optional/extra-key、精确类型、路径、版本、顺序和错误责任。公开固定JSON与文档不能出现第三份可自由配置的指标/政策。

| 边界 | 必须闭合的公开事实及现实现依据 |
| --- | --- |
| submission/pool | submission.json三键、三个programs的普通相对files和字面argv；method_id不透明且可含selected/路径状字符串，不拼宿主路径。role/configuration及selection_ids/outer_ids完整义务；别把作者ridge/seasonal ID写成必需 |
| predict input | l02_study_data.packet_metadata的全部字段：clock/origin_tick/显式target_ticks、catalogue/hierarchy/units/variables/quantiles；恰两份原CSV及其header/单位/UTC/quality/missing/revision规则；无origin role、future labels或尺度。method.json只ID/configuration |
| forecast | 严格四顶层键、逐节点/target完整唯一网格、mean独立于median、精确数值域/量纲、七quantile的键/单调、均值层级容差；数值是JSON integer/decimal，Fraction文本仅用于规定的精确结果字段 |
| selector input | selection_packet的五顶层键及frames六字段；context的format/origin/targets/catalogue/hierarchy/scales；labels完整行、实际labels_released_at；所有selection IDs及三个inner。只合法已发布label，不提供outer truth。尺度release边界不变 |
| selection output | format/outer_origin_tick/selected_method_id必需；method_mean_inner_scaled_mse可选但若提供须准确；complete_inner_origins等未被checker要求的诊断不能悄悄变为新缺交项。tie按Unicode码点字典序，任意语言实现均应有明确依据 |
| results | l02-completed-numerical-results/1各顶层/outer_results真实结构；aggregate_exact.per_method与.selected分离；context/labels/inner_selection来源、精确有理字符串字段、candidate_score为null。报告获得外层结果仅在全部必交numeric验收后，不要求先quality pass |
| provenance | l02-report-provenance/1真实cell identity、收窄execution/argv kind、artifact output_member/input_path/bytes；只是候选原输出和native事实，不证明训练。作者fit.json不是通用必需；接受解析/Bayes/经验方法的真实来源表达。reporter冻结时点须由注册/源另证 |
| report | report.md及receipt最小验收与科学内容审查分开；任意可操作等价格式/图表，不要求作者固定表名/措辞。host原CID、完整env/路径不交候选，因此不能要求候选从sanitized sidecar恢复未知host命令或伪造native收据 |

例子可以是明确标注的公开手算schema例；不能把私有outer forecast、truth、固定参照预测、rubric权重、评估器/完整host env放进候选包。完整研究报告结果发布与预测worker权限仍严格分离。ENVIRONMENT列真正准备的依赖/版本/运行入口和支持范围，不据镜像标签声称未知宿主/多语言都实际验证。

## 5. readiness与路径迁移验收

主方补充已确认：rubric仍只用draft/frozen；freeze-review属于说明/phase，不增加第三loader状态或兼容分支。公开候选稿阶段保持draft和readiness false，最终独立批准后才切frozen。

每个readiness位应有具体原件/批准范围映射：原registered reference及新派生一致证明；既有低质量质量控制；真正121 formal cold/全程序预封；实际38研究判断及新图；真实原对象绑定/归因组件与本次完整grade；当前66规则独立复核；六内容叶×双格式校准及概率裁决。最后一位只能表示**明确范围的开发校准已完成**，不能把其余32未做同样反例的科学叶称为统计/专业校准。没有新阈值/新candidate结果，不按既有误差放宽线。

最终待审发布包只留public/material-contract.json、study-contract.json、quality-policy.json、profile.json及规范文档；rubric.json为评估侧当前权威，公开研究锚点与其38/40规则对应。当前调用方参数及README/相对链接同步；冻结的历史archive内部键和历史记录可保原名，不当当前入口。建议用以下一次小范围发布清单，而不是再跑旧矩阵：

1. 机器比较新旧contract/rubric的完整字段diff：仅准许声明metadata/version/status/readiness；全部数值/条件/66 IDs/权重/critical/90与anchor语义不变。
2. 公开清单逐对象检查：所有候选必读链接/JSON引用能解析、Development ZIP原字节保留、无私有材料；接口由以上唯一函数逐字段映射，optional与extra-key真实一致。
3. 派生registry保旧对象/新对象及白名单diff，loader不增加忽略meta或双格式fallback；新正常metadata闭合，数值/ID/引用漂移仍具名拒绝。
4. 最终独立case审查签明开发pilot可冻结范围及七readiness证据；随后才状态切换、必要真实findings publication投影、docs与范围commit/push。原formal/grade/38/24保持。

## 结论

可推进上述最小公开收敛；B1/B2在plan中还需更精确的来源方案，B3需实施后逐字段核实，未认定任何新实现已通过。当前没有要求新科学方法、重复121、未来候选成功或最低时长。最终freeze审查必须看实际公开包/注册差异/readiness映射，不可只据本方案批准切状态。即使开发case冻结，十题完整、有效小时、职业专家/统计成熟与同模型因果排名仍未由这些事实完成。
