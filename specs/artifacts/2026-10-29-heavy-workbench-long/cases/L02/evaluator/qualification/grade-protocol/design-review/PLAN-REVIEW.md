# L02 完整 grader：实施前独立设计审查

结论：可沿现有唯一 sealed reader/assembler 实施，暂不需要新执行状态机、数据库版本或第二 reader。完整 grader 当前尚不存在，不能以 `read_completed` 的异常转成候选零分。实施前必须明确下面的结果分类、原对象绑定和 40 叶可操作锚点；它们是本阶段建设阻断，不是本轮已经复现的候选失败。26 条质量关系、85/15 权重和 90 比较规则维持原稿，不根据后续参考或候选结果改线。

本审查为熟悉作者参考的非盲 AI-agent 设计审查，未再委托。只读当前源码、公开草稿、原有边界记录及 L06 的证据绑定接口；没有运行 Docker、预测、solver、Provider、GPU、UI 或旧实验。原来源组件报告保持不改。本目录保存精确源范围、快照及静态 rubric 清单，静态计数不充当功能测试。

## 1. 必须先关闭的设计边界

| 编号 | 当前证据及风险 | 最小处理 |
|---|---|---|
| P1-01 | `l02_sealed.read_completed` 调 `numeric_records`，后者要求所有 expected numeric 为 verified；`assemble` 首个异常即返回。缺 row 可能是前序错误导致 runner 停下，不能证明候选自己缺交。 | 在同一 reader 内先读取完整 expected assignment 与逐格 outcome，再将已闭合部分交给同一 assembler；完整入口仅对该同一结果要求 complete。明确真实依赖阻断和未调度独立单元的区别。 |
| P1-02 | `validate_terminal` 把身份核对与 exit=0 混在一起，不能直接读取已失败原 terminal。`Executor.invoke` 约 397–404 行还把 validator 的未知 Exception 默认标成 candidate_output_invalid。 | 复用同一 source/input/native/sandbox 身份校验，再按真实退出和有来源的 typed checker 结论分类。只把明确的候选协议/输出错误归候选；未知 host 异常进入设施调查。这里仅静态发现误归因可能，未声称本轮已运行反例。 |
| P1-03 | `l02_rubric.aggregate` 现在只是可信 findings 的算术，缺原提交、数值选择、报告、review 版本闭环。路径相同或 ID 相同不能证明内容未换。 | grader 唯一从封存原 run 取数值，外部指定固定 reference；独立 review 绑定同一原 run、registration/program/input/output/report 原对象和具体 rubric/anchor 版本。review 在候选目录外。 |
| P1-04 | 40 叶多仍使用统一的“实际证据完整支持”锚点，格式自由、依赖范围、没有主张时如何判断等未闭合。 | 在任何候选运行前公开逐叶二元边界、必交范围、必要依赖及等价格式。下文给最小一版。二元现稿无需引入 half；若另加 partial，须先写每叶精确条件并重新校准，不能事后临时折半。 |

完整新参考及多质量评审是实施后验收与 freeze 前件，不是本设计审查已完成的事实；future fresh 候选、有效小时与十题进度不作为本次实施前的循环条件。

## 2. 单一 reader 的最小形态

在 `l02_sealed.py` 内建立一个 canonical inspection/reconstruction，读取当前 baseline1，不另造 `partial-reader.py` 或把 grader 直接读 SQLite/ZIP 的逻辑复制一遍。现在的 `read_completed` 可作为同一结果的“要求完整”的薄入口；summary、quality、grader 都消费同一对象。该对象是由既有事实派生的评估结果，不写新的 cell phase，不改原 accepted。

处理顺序：

1. 从原 registration、固定合同和原 pool 建 expected identities；先核注册、材料、版本、尺度、环境及外部 reference 的设施事实。method ID 继续是不透明字符串，不把 `selected` 或路径形状当保留 ID。正式身份必须是 `formal_full_assignment` 且全部权威 12 outer；不能只信注册自报 all_outer_ids，不能把 private diagnostic 覆盖全 grid 自动晋升正式。
2. 取得一个可解释的一致快照。优先只验已停止/交接的 run；若运行中需要阶段观察，用既有 OS owner/锁协议短暂捕获 DB 与 canonical capsule 清单，遇忙返回观察未完成，不能给候选失败。人评不长期持有锁；先封存供评审的稳定对象再释放。不新增第二套锁或影子状态。
3. 遍历所有 expected identity，找原 row/phase、prepared、terminal、accepted、native、原 host failure/checker 事件，保留每格位置与 outcome。发现额外身份、重复身份、坏归档、源/输入/native 归属漂移是设施无效，不能靠另一个 working 文件补救。
4. 对 verified 单元复用当前捕获输入校验与原 assessment 重算。对 failed 单元，按同一身份函数核原 terminal 和真实输出，再核原失败来源；不能要求它拥有成功 accepted/exit0。对 terminal-but-unassessed，只记录终态，评估器未验完不算候选失败。
5. 同一 assembler 消费逐格 typed outcome：可以完成的独立数值和选择照原规则重算；必要输入缺失时输出显式 dependency，而非抛一个“整组零分”异常。已有公式和 score 不另复制一套。没有完整选中策略时不生成可信全期质量数字，不在较小样本上算替代均值。
6. report 只按原实际交付材料审；没有原 report 不补跑、不给它拼外部诊断。旧 report 的 not_delivered 仍是原来源事实。grader 本身不启动程序，也不改 runner 调度。

正式单元数按冻结 pool 推导：每 outer 为 `3×selection_methods + 1 selector + outer_methods`，全 run 另有 1 report。原作者 2 个选择方法、3 个外层方法时是 120 个 numeric + 1 report，不能硬编码“120 总 cell”，更不能要求任意候选恰好作者方法数或 ID。

### outcome 到叶状态的界限

| 原事实 | reader outcome / 评分规则 |
|---|---|
| 原 verified 且原输入、终态、输出及重算均闭合 | 可供该叶独立判断；verified 不自动使全部科学叶 pass。 |
| 已认证原 terminal 非零退出，host 记录候选程序失败 | candidate_failed；直接的运行/交付叶 verified_fail，真正受其阻断的必交产物可 blocked_candidate。stdout 自报 facility 不能改变归因。 |
| native exit0，候选输出确实缺失、坏类型、缺格或数值违约 | 对应 typed candidate error；缺交用 candidate_incomplete，有输出但错误用 verified_fail，并定位真实 checker/字段。 |
| selector 必需的一个 inner 预测候选失败 | selector 结果不能构造；明确 blocked_dependency 到该原 inner。不能任取其余 inner 或跳过难单元。 |
| 某独立 outer 尚无 row，因为 runner 在更早的错误处停止 | 未调度/评估未完成，unassessed；不是原 native failure，也不是凭空的候选缺交。若将来要继续独立单元，须在同一 assembler 明确实施，不能由 grader 发起执行。 |
| 某个结果缺失仅因真实必要候选依赖未交 | blocked_candidate，保存 dependency 链与原根因；不反向把所有同组或未来单元都判失败。 |
| host 主动取消、未知 native 丢失、OOM/外部终止原因未明、坏 DB/ZIP、host checker 异常 | 设施或原因待查，run_invalid/无成绩；没有已冻结资源合同与来源不能把 OOM/外部退出码一概算候选失败。 |
| 仍 running/planned，或 terminal 已封存但评估尚未完成 | assessment_incomplete；不机械计时变零，不重启或重放原程序。 |
| 原材料/reference/评审文件无效，同时候选也坏 | 设施优先，run_invalid。可保存已观察事实，但无正式分数。沿用此前 quality 的设施优先规则。 |

`blocked_candidate` 必须有真实候选依赖；`unassessed` 是评估方尚未完成，不是较轻的零分。固定分母不等于强行给所有未评项打零。已知关键候选失败可以显示 `known_critical_failures`，相应 study/good 的已知失败结论可提前 false；任何未评或设施无效仍禁止发布 total_score。当前算术 primitive 已保 pending null；新整合不得把它绕开。

## 3. 数值、固定参照与 review 的闭合对象

最小的评估侧证据包应包含：

- 评估者分配的非空 submission ID、case/协议版本、原 run_id；正式 assignment、authority material/study/policy 的版本与实际原对象引用。
- 原 registration ZIP 中实际 submission/program/pool/source；各 expected cell 的身份、prepared/terminal/accepted 原 capsule 引用、native CID/argv/环境/终态；未执行的理由不伪造 native。
- 当前同一 reader 重算的选择结果：每个 outer 只能使用原 selector 实际选中 ID 对应的原 outer forecast。候选 report 中的“selected”、合成拼接节点或 outer 最优方法都不进入质量输入。
- 评估侧指定、候选不可写的 registered reference 原 ZIP。沿 `load_registered_reference` 核完整原材料语义/日程/单位/尺度/metric/policy、固定 seasonal8 配置、12 个真实原 native 及 1008 个 forecast 格；来源真实性仍须已分配评估者核原件，schema 不能认证一个随手造的 registry。
- 原 report 所见的 results/provenance 和实际产出的全部材料。独立 review 引用具体原 capsule member/表行/图与源码位置；允许报告数字以闭合公式加实际可定位表代替复制数字，不能把私有 oracle 的缺失信息补给候选。
- review 协议版本、唯一 rubric 与 anchor 版本/原对象、reviewer ID、assignment 原来源、非盲及熟悉程度；候选输出目录外的私有证据根。没有评审文件保 unassessed；坏版本、错 run、错对象或候选自评是具名设施错误。

不把一个可写绝对路径或可变源码 hash 当身份门。原 capsule 内的实际 source/input/output 与冻结原件直接比较，业务材料用既有严格 typed 语义身份（行序自由）；review 绑定经评估者收集的封存对象。若文件后来被换，同路径并不保留原身份。无需引入签名平台、网络服务或第二份运行登记。L06 可借鉴“候选目录之外的 assigned reviewer、逐叶证据定位、对象绑定与 truth-limit”，不能复制其五路径 ABI、业务数学或特定叶 ID。

case/rubric/anchor 版本放在唯一私有评估包的 assignment 头，引用原 execution registration 实际对象；它是判定来源，不是第二个 cell 生命周期或运行登记。不要为了给旧 run 补版本而修改原 registration。只要新增的 grade/review 是独立评估产物且不重解释旧 phase/input，baseline1 可保持；若实施选择新增持久字段、改变 registration/results 原语义，则必须先定义版本化保数据迁移，不能借本方案自动宣布无需迁移。

## 4. 四十个研究叶的最小二元锚点

以下为当前 criterion 的可操作化建议，不新增作者算法/文件名要求，不改权重。所有材料一并阅读，表、JSON、CSV、代码、公式与图只要闭合可定位即等价；不要求逐字 JSONPath。每叶仍有自己的结论，相关叶可以引用同一证据，但不能以一条泛化“总体好”替代。

共通规则：pass 是完整支持本叶；有实际反例为 verified_fail；必交内容确实未交为 candidate_incomplete；真实候选依赖缺交为 blocked_candidate；尚未完成评审为 unassessed；设施错误整次无分。没有 half，没有用 N/A 删分母。是否缺交须按公开要求判定，不因评审偏好格式判缺。涉及全量可数值验证的叶按完整 grid 核，不以随意抽样顶替；方法语义需源审与实际输入/行为共同支持。

| 叶 | pass 所需最小闭合证据；实质反例/边界 |
|---|---|
| A01 | 实际用到的原值/单位按权威表精确为 L，任意等价内部表示可；用单位变更前系数处理后段是反例。无需强交一份作者 canonical。 |
| A02 | 每次实际 fit/predict 的事实满足真实 release cutoffs，合法 prefix 与内部伪时点均核；见过被合法输入但尚不能用于其伪时点的数据仍属违约。 |
| A03 | 每业务键先选最高已发布 revision（含 missing），再作显式缺测处理；回退旧 valid 冒充当前观测为反例。合法估计不能冒充原事实。 |
| A04 | 全实际 forecast 是分配的 14 个完整 UTC 日、每节点完整格；使用 origin 起算滚动小时窗为反例。 |
| A05 | 注册 leaf/aggregate 身份、权重与实际 mean 相加闭合；不强迫边际 quantiles 相加。 |
| A06 | 报告关键数字通过表/公式/索引能定位原输出与来源身份；只有“数据来自附件”而不能闭合为不足。 |
| B01 | 至少 baseline 与 extension 的实际科学机制不同，冻结代码/参数及真实使用一致；ID 改名或无作用 flag 不是不同机制。相同正确预测不构成反例。 |
| B02 | 消融在实际训练、预测及不确定性路径上移除所声明机制；只改标签或预测阶段仍用该机制的校准为反例。不强迫消融变差。 |
| B03 | 全部程序（含 reporter）、池/配置在首私有预测前已封存，实际使用等同原对象；事后 reporter 生成历史报告只能作为组件，不得给本叶 pass。 |
| B04 | 实际拟合样本、窗口及版本来自该使用时点的合法历史；自报 training_rows 与事实不一致或未来观测入 fit 为反例。 |
| B05 | 不确定性特征符合其真实声明使用时点；经验法核伪origin特征，解析/Bayes 核真实 fit/predict，不能强迫后两者做经验残差校准。 |
| B06 | 不确定性观测/参数来源闭合：经验校准核当前可发布标签，解析/Bayes 核冻结先验、模型假设、合法数据；不以一句 N/A 或私有原文补缺来源。 |
| B07 | 实际末日天气缺测有可执行处理并准确说明；强行读取后 issue 或说全14日均有预报为反例。无需指定某种插补法。 |
| B08 | 实际 mean 目标与 MSE 所估条件均值解释一致；拿 median 当 mean 而无正确理由或宣称 MSE 评中位数为反例。 |
| B09 | 所报边际分位点/区间对象和估计解释一致；把边际带称为联合路径保证为反例。 |
| C01 | 全正式 expected numeric identities 实际执行且完整 checker 通过；诊断覆盖、缺格或仅 exit0 都不足。没有被 runner 调度的独立单元先未评，不伪造它失败。 |
| C02 | 实际 selector 输入许可且完整，原输出等于全 inner 精确损失最小 ID、同分 Unicode 排序；outer hindsight 选择或删 inner 为反例。 |
| C03 | 全 outer 实际 source/config/packet/mount 保持冻结与授权；复制最早的参数表而真实不同为反例。合法晚 origin 新发布观察可用。 |
| C04 | 全实际预测严格格式、finite/domain、quantile 顺序、grid、层级 mean 检查通过；不能仅核已选择方法或报告重写后的数值。 |
| C05 | 原提交声明与实际使用程序/argv/依赖镜像相符；以候选自述版本代替实际环境为不足。语言与任意合法 ID 自由。 |
| C06 | 已观察正常/故障单元状态与实际持久记录及报告相符；没有发生故障不强迫注入新故障。设施持久化错误归设施，不能作为候选错误扣本叶。 |
| D01 | 全声明方法在相同 outer/node/grid 的 MSE 与配对比较均保留；可以由完整表加明确公式闭合，不要求固定表格样式。 |
| D02 | 同上，WIS/概率结果完整且方法和目标对应；不能只展示好的置信带/好节点。 |
| D03 | 提供足以识别节点和切点失败的实际误差/图及有内容的观察；只给总均值不足，不强迫复述作者 June 失败。 |
| D04 | 实际 coverage/width 的区间、目标、分母可定位并重算；不能用主观“多数落入”或删失败格。 |
| D05 | 报告拟合/校准诊断与自身真实方法及执行一致；不强交 fit.json，也不因作者文件存在认定训练真实。 |
| D06 | 机制主张有对应冻结配对实验或明确识别限制；诚实“无因果识别、仅描述”可正确闭合，无须虚构一个因果效应。 |
| D07 | 所有实际反证/消融/局部失败与总结一致，无挑选隐藏；无实际负结果不强造负结果，可完整说明观察范围。 |
| D08 | 明确区分已知公告、未识别量效及未宣布变化；不能把后见 transfer 量当预测前事实。 |
| D09 | 统计结论尊重层级、重叠时窗等依赖；诚实描述性结果及未做显著性推断可 pass，不强迫 p 值或不适用的独立样本检验。 |
| E01 | 成本场景到 q=.5/.75/.9 的映射在 truth 前固定，action 来自原冻结 forecast；报告见 truth 后换 q/选 mean 为反例。 |
| E02 | 全四leaf×12outer×14日×3成本的实际 action/truth/缺余量/成本闭合，即 2016 行等价信息；公式加完整可定位表可，不要求重复打印。 |
| E03 | 全 mean-action 诊断按同 truth/cost/grid 算；不能把其较好格混入正式 quantile 策略。 |
| E04 | 三成本的实际量化对照与建议、局部暴露相符；闭合量表/公式可，不强制打印份额或某个建议结论。 |
| E05 | 声明真实单期连续 L/边际模型边界，未实测不扩称库存、容量、联合尾风险或机构可用性；没有这类更强主张也需公开模型范围。 |
| F01 | 评估侧实际 fresh 全正式 assignment 从冻结源/raw 到 report 完成并独立核算；不用某次作者历史 ZIP 或仅新 report adapter 代替。无需第二次完整求解同一候选。 |
| F02 | 源/实际命令终态/输入输出之间可定位；报告可消费窄 sidecar，完整 host 私有事实由评估包补核。不得因报告没有 credentials/host env 而扣分。 |
| F03 | 实际呈现并人工查看图：必要轴/单位/方法/truth/区间清楚，数据与原输出一致；只看路径或自动像素/关键词不能 pass。图数和固定配色不是要求。 |
| F04 | 实际采用的关键方法、评分及数据来源/许可引用可查原文且支持相关主张；不按引文数量或强迫作者参考相同文献。公开原创合成材料也须如实说明来源。 |
| F05 | 依赖/argv/输入域/复建流程及适用限制能让新操作者实际执行；其他材料已完整提供的内容可以交叉引用，不能因 README 排版不同扣分。 |

E02 的 2016 是本题固定 4×12×14×3 的动作格，不是质量叶个数或独立统计样本。candidate 方法池变化不会改变这组已选择策略行动格。

## 5. 完整 grader 输出与发布规则

每叶必须有：leaf ID、原权重/critical、状态、评估方式（机器/可信独立评审）、规则版本、实际来源对象/locator、观察值或原因、依赖根因、适用的 pass/fail 锚点。26 质量叶还保 exact candidate/reference loss、比较符及固定分母；缺格不默认 true。输出 schema 是新评估产物版本，不是 SQLite migration。

先核设施事实，再核 candidate 结果，再合并 assigned review，最后调用唯一 `l02_rubric.aggregate`。grader 不读取候选自评 findings，不把 trusted review schema 当判断为真的证明，不以文件存在或 evidence kind 自动 pass。原人工与机器重叠时指定本叶唯一结论来源及可审冲突处理，不能取较高分。

当前 40 叶是二元 85 分，26 叶二元 15 分，共固定 100。全部 critical 真正 pass 才可相应成功；关键 quality 不由文案或方法分补偿。pending、draft/readiness 未就绪、设施错时 total 始终 null；缺交/真实候选依赖阻断计零但分母不变。reference 真实错误比候选缺格优先，无效 reference 不得诱发全质量0。保留完整 findings 和 known critical failures，但禁止拿非正式 diagnostic 合成总分作候选成绩。

## 6. 最便宜的实施顺序与必要验收（本轮均未执行）

1. 先完成同一 reader 的 outcome inventory 与来源绑定，纯标准库对已封存对象做定向协议测试；不重旧 75/335/120 或 Windows 五窗口。
2. 再接质量/reference 与可信 review reader，固定逐叶 mapping。采用最少的新反例，均断言明确输出/状态/错误码：
   - 一个真实已非零 terminal 仍认证原 source/input/native 后判 candidate_failed；stdout 自报 run_invalid 同结果。
   - 同样 ledger 标签但 terminal/CID/Name/源对象不符，映射具名设施错误。
   - 一个 inner 失败，selector 必需依赖 blocked；另一个未调度独立 outer 保 unassessed，total null。
   - terminal 已存在而 host 尚未验收，保 assessment_incomplete；坏 accepted ZIP 为 facility，不改用 working。
   - host validator 主动抛出的未知异常映射设施错误，原 native exit0 保留；候选坏 JSON/缺字段仍映射明确候选错误。
   - private diagnostic 即使包含12outer也不能变正式；正式缺一个权威outer具名拒绝或 incomplete。
   - 评分取原 selector 实际输出；outer 最优拼接、报告自报 selected 不改变质量输入。
   - 原 registry 正常及语义行重排可核；参数/尺度/原事实漂移、同名弱 baseline、坏 reference+坏候选映射设施错误。
   - review 的错 run、错 submission、换 report member、锚点版本不符、候选目录评级映射具名设施错误；缺 review 保未评。
   - 任何 critical 候选失败即使其余高分也 good=false；draft/一个未评/设施故障均 total=null，精确100权重不变。
3. 针对 40 锚点做少量标签遮蔽的多质量材料校准：完整但负结果诚实、夸大或隐藏失败、关键证据缺失、等价 JSON/CSV/公式表达。每个争议必须按全部已交材料裁决，不用私有 oracle 填候选缺项。保原独立初评、作者预先 key 和后来裁决；熟悉参考的 AI 一致率只是开发校准，不是专业真人/统计认证。不能为了匹配 key 固守错标签。
4. 方法/合同/anchors/完整 grader 及依赖定稿后，**仅一次必要的全正式新 generic reference**：在首预测前封存 predict/select/report 全源与池，raw 权威，所有数值真实新目录运行，report 最后才见外层。不提供旧 model/plan/prediction/graded outcomes 给程序；旧固定质量参照保持评估侧，不按新结果换线。该参考所有实际 PNG 呈现、查看，研究结论/运营账/来源再独立审查。
5. 若新参考质量或科学交付失败，保失败并修实现/论证或明确达不到当前政策，不能事后放宽 26 条。若需改变科学任务或政策，必须另版本并重新登记，旧线和原结果保留。

不需要重演所有旧故障、另造完整通用平台、引入候选可调用的私有诊断反馈，也不需要为了冻结先跑未来两系统或证明小时。全参考资格与 anchors 关闭后才是独立 case freeze 审查；fresh 候选、两好升级、有效工作时长和整套十题是之后的实证。

## 当前判断

最小设计路线可实施；当前 full grader、partial 分类的真实资格、外部评审闭环、40 具体锚点和校准、新全正式研究仍未完成。本报告不批准这些能力已实现，不批准 case freeze、成熟或小时级。只读搜查也未发现本范围须改生产 Task/Mission/Session/LLM/队列的理由；本阶段仅为 benchmark 数值/来源/评分数据流。
