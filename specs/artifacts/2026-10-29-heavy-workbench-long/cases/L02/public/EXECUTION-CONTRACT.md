# L02 数值程序提交合同（L02/0.2.0 开发合同已冻结）

候选交付研究源码、方法池、预测/选择/报告程序和依赖说明。算法及语言自由；评估者准备声明所需的运行环境，记录实际固定镜像身份。执行器不会自动安装任意依赖。精确wire见INTERFACES.md，冻结状态见profile.json。执行验收与完整科学/运营/质量判断分别记录。

## 提交

提交根目录的`submission.json`有且只有`format`、`pool`、`programs`三个键，format为`l02-numerical-submission/1`。`programs`有`predict`、`select`、`report`；各有普通相对文件名数组`files`和字面参数数组`argv`。程序以声明的argv替代镜像entrypoint执行，不拼接宿主shell，不替换隐藏参数。相对路径规范化后仍须留在提交内；链接或路径越界具名拒绝。每个程序只得到自己声明的文件。

`pool.format`为`l02-method-pool/1`；`methods`每项有唯一非空字符串`method_id`、`role`和任意JSON对象`configuration`。角色包含baseline、extension、ablation。`selection_ids`至少包含两个方法且覆盖baseline和extension；`outer_ids`包含所有声明方法，所有格必交。ID作为身份字符串存储，不拼宿主路径；`selected`也是合法方法ID。科学区别另由研究审查判断，改名或无作用配置不能证明科学有效性。

选择按三个已注册inner的平均scaled MSE取最小，精确同分按Unicode码点字典序取最小ID。不得按失败或成绩删除声明方法、切点或改变分母。输出方法指标置于`aggregate_exact.per_method`，选择策略整体指标独立置于`aggregate_exact.selected`，无方法名别名覆盖。

## 每个数值进程

工作目录是`/project`，只读；输入根`/input`只读。容器根文件系统只读，只有新建的`/output`和独立`/tmp`可写，1个CPU、无网络、无自动重启、无额外capability或特权。固定数值线程环境与实际镜像/argv/权限进入原始执行证据。候选不能声明网络、宿主挂载或凭据。程序输出须为根内普通文件；链接输出具名失败并保留终态事实。

| 程序 | 输入 | 输出 |
|---|---|---|
| predict | `/input/packet/packet.json`及原CSV授权行；`/input/method.json`仅本方法ID/冻结配置 | `/output/result/forecast.json`，完整已分配节点/14个未来UTC日/mean及注册分位点 |
| select | `/input/inner.json`完整已发布inner预测/标签/尺度；`/input/study.json`指标定义 | `/output/result/selection.json`，原池中的既有ID；可附精确inner均值 |
| report | `/input/results.json`已验收的研究结果、外层终审及指标；`/input/provenance/manifest.json`及其指向的原数值程序输出副本 | `/output/result/report.md`、配套图/表等；`report.json`含format=`l02-report-receipt/1`和原顺序`outer_ids` |

预测包的发布时间、单位、缺测、最高revision和目标日定义沿用[每日原材料合同](MATERIALS.md)与[研究合同](STUDY-CONTRACT.md)。预测进程得不到全档案、评分尺度、真值、别的进程或评估器。选择进程只能使用该outer之前已发布的inner终审；不能输出新参数让外层调参。报告程序与全部源代码/方法池在首预测前冻结，直到完整正式assignment所有数值单元验收后才得到外层结果；报告不能修改已执行程序/输出。

报告来源包format为`l02-report-provenance/1`。`cells`每项包含不透明`cell_id`、实际完整逻辑`identity`、收窄的`execution`和`artifacts`索引。执行事实仅声明源码相对文件名、argv位置投影、原native起止时间/status/exit；argv只展示执行文件basename、声明的源码路径及规范sandbox路径，其他参数为`opaque`且value为null。每份artifact有原`output_member`、本包相对`input_path`、字节数与“候选程序自报输出”来源说明。报告应消费适用于本方法的真实诊断；经验残差、解析分布和Bayesian posterior可采用各自正确的来源形式，不强制任何候选输出作者参考的`fit.json`。

来源包只复制已验收原对象中的数值`output/*`，不提供原accepted/prepared ZIP、评估器/权重/固定外部参照、评分assessment、SQLite、完整inspect、宿主路径/环境或Provider日志。提供文件和native事实不证明拟合声明真实，也不能单凭numeric sidecar证明report programme何时被冻结；科学来源与版本仍须独立审计。来源包在所有数值格式/选择验收后提供，不以通过质量条件为前提，失败的科学假设也应如实交付报告。

正式assignment是合同注册的全部12个outer及其36个inner，不能扩展、替换或分批取得私有反馈后重提。评估侧的`--author-diagnostic-outer-id`仅用于私有作者工具资格，其结果不回送可重提候选，不计正式研究完成或候选成绩。它不是候选探索接口。

## 持久状态与失败

首次注册封存原提交、方法池、材料、合同和环境。`runs.sqlite3`是唯一cell生命周期来源，schema baseline1；后续版本须保留已有数据迁移，未知格式具名拒绝。真实操作系统锁保证同run只有一个执行者，竞争者返回`run_busy`，owner崩溃后由内核释放；不凭PID或计时猜测接管。

恢复只指定原runroot，不能同时重新指定提交/材料/参数。create前持久化唯一名称，CID持久化后才start；即使host中断，也先核实际Docker状态。只有真实`created`可启动；`running`等待原进程，`exited`收集原终态，不能重新start同CID。原对象丢失或身份不明属设施调查，不静默重跑。

输入在prepared原子发布时固定，只有原prepared尚未存在才调用唯一输入factory。已有原prepared，即使数据库仍为planned，也继续其原输入，不按新版host代码重造或追加sidecar。恢复仍核原程序/source与实际物化输入；forecast实际捕获的packet按独立许可集合与assignment核验，selector捕获的已发布inner事实/预测与原数值对象核验。当前只是任意输入文件map新增文件，表结构、phase、registration和results格式均未演进，故保留schema1；历史原report只得到results.json的事实如实记为`report_provenance.status=not_delivered`，不补造新材料、不给推测分数。

成功和失败均先封存真实终态/输出。验收通过的accepted对象原子落盘后才提交verified，随后精确清理原容器；恢复从accepted对象读取，不用后来被编辑的working文件。已认证的程序非零退出或明确坏输出可归候选，即使stdout自称`run_invalid`也不能免除。未知host validator异常、损坏/漂移对象、OOM或外部终止原因未明保持设施调查/无分；不能将未知异常默认归候选。

原native生命周期未执行就仍是未执行，不伪造failed。评估叶只有真实必要候选依赖缺交才可blocked_candidate并列原根因；例如selector所需inner预测已证失败，report所需numeric未交。各预测不因其它方法或selector失败自动失败，独立未调度仍unassessed。固定分母不等于把首错之后所有格置零。候选缺交、依赖阻断、评估未完成及设施无效分开记录。归档/设施错误具名`facility_*`，失败单元不自动换程序或重跑。

数值`requested_execution_complete`只表示请求矩阵和报告传输已验收；`complete_assignment`只表示网格覆盖，`formal_full_assignment`另核权威日程和正式注册身份，私有诊断即使覆盖全网格也不当正式候选。唯一只读sealed reader从原SQLite/registration/prepared/accepted重建同一数值矩阵及实际report来源覆盖，不从working或外部新索引补造。`study_complete`、`quality_success`、`candidate_score`仅由冻结合同和完整科学/业务审查发布；report输入中的candidate_score保持null，不是候选自评入口。没有最低时长或用户总墙钟/token截断；进程崩溃资格不冒充掉电耐久、跨平台实跑、研究质量或有效小时认证。

[逐叶研究锚点](REVIEW-ANCHORS.md)公开二元实质边界、等价格式和真实依赖。它不把程序exit0或一个合格来源schema当作全部科学结论通过；是否冻结以profile.json为准；执行成功不能代替实质研究评估。
