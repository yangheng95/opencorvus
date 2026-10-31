# L06/0.4完整主动验货业务：实施前Recall与合同

## Recall和影响面

用户要求原生Windows完成完整十题/真实整题测试；禁止Docker/WSL/UI自动化、重复组件资格/旧矩阵/故意耗时。0.3的fresh Codex与新OC已同冻结真正各100/allcritical，原结果在dcf447652及两个pilot，故另升0.4；不是改旧60044或重旧solver。L01原GPU矩阵继续且源不热改。此处只新增一个完整case，旧版本/生产Task/Mission/Session/LLM路由/用户数据与UI均不改；无现存用户DB迁移问题，新题是新独立实验数据，旧真实数据库原件只读。

已读当前AGENTS、最新长程Recall、0.3完整public/业务/runner/checker及两pilot。全仓当前L06只有固定公开联合树：信息到达不受行动影响，完整因果政策可以直接用共享前缀整数模型表达。两个新系统均自然通过是原题缺少区分度的真实证据，不是其程序错误。0.4新增内在问题为：购买/保留/选择验货决定何时观察哪家供应商，观测改变后验与后续采购，同时已付成本、物料、实验室峰值和已收现金必须逐原承诺保留。不能给actor所选未来，不能从有限随机观测推断不可识别的供应商别名。

## 首次完整实验前登记的业务与科学底线

完整8周、每周实验室和运营两阶段。两供应商每包2件；正常订单下周到，一周最多订一包，每供应商最多保留一包未验货料，验货前有空仓才可抽该包。每周最多验一包，结果要么2件合格、要么0件；包在验后消耗，不可把期望产量当已收库存。已知好料容量4，验后/消耗前峰值也受限；当周生产必须完整满足公开需求，生产每件成本1，销售每件12，销售款两周后到。紧急认证原料即到，每周价格公开可变；可依法提前储备，但持有每件每周1。正常采购价格A3/B4，验货费用1。周末好料持有，末周好料及未验包按每件/包1自动结清，未到订单不得越过终期。正常期不能任意销毁保留好料/未验货包、改旧订单或借用未来应收款。

信用：base初始现金18，期初旧业务应收10在周1结算；每个阶段真实已收现金不得低于−15，最后现金必须非负。应收周8/9按绝对到期日列示，不提前收；末期合格料及未验货包清零。需求和认证价格由原CSV给出。另两个完整公开输入只改变先验/期初融资，非任意扰动认证；每个均须完整可行、相同科学底线。行序控制不改变ID语义。

四个潜在标签，A1/A2有完全相同的全部供应商结果律，B1/B2同理。A类验A合格概率17/20、验B3/20，B类相反；条件于类，各批结果独立。base标签先验1/8、3/8、3/8、1/8，故同类标签比率不能由任何自适应试验改变；只可识别分布类，不能索要未知标签或未来单批结果。后验必须从全部实际验货观测及真实选择更新；未验货/延迟验货不是失败/成功样本。此完整来源律是定义，不从作者未来结果倒填。

正式质量预登记：每个完整输入的合法策略期望经营成本≤1.01×同信息最优值；逐正概率路径物理/现金/原承诺/后验/原键恢复均critical，不能用期望值或方法分补。恰当声明不可识别性也是critical。最优值必须依据同信息精确有限动态规划或独立可证界，不拿偷看真实类/未来结果作可执行目标。另报“预先知道分布类但不知道未来批结果”的精确下界，明确其信息价值；禁把禁止验货同时失去实物的成本差叫纯信息价值。不预设动作必须翻转，也不匹配非凸轨迹或唯一最优policy。

## 直接整题建设与一次便宜完整实验

首次计算直接使用上述完整8周base原料/4标签/全部正概率验货分支，非三期toy、组件资格或旧solver；先封全部public、源和登记。用缓存的有限状态Bellman递推和Fraction精确算术，状态包括周/阶段、真实库存/未验包/现金及完整观测对应的后验；必须给出压缩状态充分性和风险可达理由。根据后验与原物料/现金在所有结果上可行才接受动作，不用期望现金筛掉坏路径。先记录实际时间/状态/最优值与信息松弛，不设最低时长、不把参考运行/队列/评估算候选小时；若工具失败保存原件并修真实根因，不能改质量线凑通过。优先本机CPU/stdlib，不与L01新开GPU。

随后直接完成同case公开唯一exercise、任意语言stdio actor/全部可见原prefix、持久SQLite原键receipt、真正订单commit失ACK和验货result commit失ACK两中断后续、完整原账/逐观测后验/概率/成本/现金/AR、实际图、报告/自含重建、同checker实际错误programme、原子rubric与真实grade。所有源首次执行前封；所选未来只在parent stdin/内存，原SQLite只含已观察事实，不授同用户OS侧信道/掉电/任意并发安全认证。验货receipt必须保原结果，不能在恢复时重抽。事件切换/两个阶段不属于产品工作流/LLM工具路由，不新增通用框架。

只有完整产品/全部真实正错/图/原子评分齐后才复用唯一benchmark_review一次集中整题独审，实质阻断集中修、仅必要复验；不做组件review。开发freeze/fresh真实比较/有效小时尚未完成，不因此称第十题或难度成熟。新candidate仍仅公开材料/依赖、fork none/nooverride，不给私有评价/参照/旧答案；自然交付先封所有workspace/Git/untracked/失败，再同冻结实际执行/内容独评/真正grade。两个good仍需另版，快而正确始终允许。

## 完整首次科学与原生链后的证书核验登记

三个原8周输入的首次Fraction Bellman均自然0（各约.7–.8秒），base300834939/4000000、shifted90125954529/1280000000、cash-tight11287373277/128000000；提前知道分布类的差值各严格正。原planner/源与输入在首次计算前封，不改原输出或1%目标。真实完整actor三输入/全部自身政策分支/两commit中断与行序控制随后一次native0/90.9964303秒；这是完整新case，不拿秒数/分支数当难度或小时。

必须闭合的科学证据是同信息“最优”而非仅可行。原planner已保存每个可行状态的实际最优action，现只对这份原policy做一次完整Bellman证书核：通过唯一public物理primitive枚举所有合法动作/两正概率结果，验证原选择等于局部最小、遗漏状态确不可行，用有限时域归纳闭合根界；不import/重跑Planner、不生成另一policy、不重actor/native/旧solver/组件资格。此核验若失败保原错误和数据，不能把可行root值当最优或倒填阈值。独立整审之后只读本完整证据，不做阶段review。

## 首次账和图后补齐稳定历史身份（不改数值/政策）

首report真实0/3152stage行与三原生期望值相同、3图已生成。设计完整私有checker时确认episode随机目录只为不泄漏未来，不能用它要求候选的原账匹配另一次私有随机目录（公共合同也未限定episodeID）。直接根因是新auditor导出AR以episode作键，未来M05若照此绑定会误拒同一个真实策略；尚未跑该错误checker/无候选失败，不假报观测反例。原源/CSV/summary/实际图先完整封pre-logical-path-export.zip。当前唯一导出改用完整实际付费验货历史的可读逻辑path（周/供应商/观察），instance+path+seq定位；保episode作为原件坐标但不当跨执行身份。确定性策略下同一付费观测史唯一决定全过程；全部正概率支持仍用原完整账/原似然核，不能hash替功能。只派生新导出/AR定位并证明其余原字段与图逐值同一，不重actor/native/优化/旧矩阵。源/public在开发冻结前明确此合同，不留自动旧格式fallback。独立整审的一次自含新源完整重建将天然换episode目录，实际同时验证该身份合同。

## 完整同checker错误programme登记

原正确reference的全部native/数学/导出已齐，不重这些对象。四个真实独立actor programme各只把声明argv加一个具名故障（原源/三计划不改）：prior-belief忽略已观察验货、expected-stock在reject后把一件期望料当实物、ar-credit用未来应收提前买满4件、random-key在新进程重放换随机key。预期分别产生精确后验/实际需求/已收现金/原键重放的具名错误；从各原实际wire/SQLite核，不从故障命名判断，未执行的依赖blocked/总分null。每个先封源码再通过同一public真实exercise与同一private prepare，不额外组件资格或重正确矩阵。另一真实report.py --claim false-certainty只在正确原native数据上生成完整数字/图正确但断言有限观测精确识别别名及现实无限保证的弱报告；同checker全部M和一次整题独审5H判断，不能由作者手写aggregate或拿它当LLM成绩。

## 原错误programme的prepare设施阻断集中修复

四programme原生实际分别已bayesian_original_observations、complete_current_demand、settled_cash_floor及原键重放错误；第一次prepare均是工具RecursionError/native1，不是候选成绩。直接触发为owner将assessment置于delivery自身内部，prepare复制交付时把新closed目录继续包含进源；根因是private CLI未先校验输出/输入边界。主方正确reference先前12Mpass的assessment在交付外，未受影响。已搜当前prepare/copytree同语义：仅新增0.4设施和该四调用需要本轮修，旧已交题/0.3只读且其既有assessment都在交付外，不扩泛化框架或重审。原source/wrapper/全部失败命令已封pre-overlap-facility-source.zip，原partial目录和独立原programme/run保外部，不删除失败。新增明确FacilityInvalid assignment_output_overlaps_input先于创建/复制；正确调用用原programme作为交付根、layout programme为.，assessment置独立error-assessments，不再复制failed assessment树。只原四run重新prepare，不重actor/native/优化/正向矩阵；主方main原对象仍同一闭合来源。它是实验设施路径错误，无生产调度/Task/Mission/Session/共享恢复调用。

## 必要完整可行低质量programme登记

现4错误programme分别真实破坏后验/实物/现金/原键，尚不能单独证明1%质量线区分“真实物理且后验正确，但规划假定错”。新增一个完整IID-class控制：离线planner误把每批质量的潜在分布类重新从原先验抽取（固定边际预测），实际actor仍从原完整历史报告正确后验，所有硬约束继续对好/坏两支都检查。政策/声明首次执行前封。假设在真正持久类法则下物理/后验可行但期望成本超事前101/100界；不按观测改线或把失败源码名当结论。直接通过完整三输入public真实exercise及同checker，不是旧矩阵/资格；增量预算为3个秒级新错模型规划和约一次90秒新不同政策全链，全部只是作者错误控制，不算candidate小时。若该控制仍过质量线如实保，不倒填阈值或虚报区分度。

## 集中整审B02的真实programme补证登记

独审实际局部synthetic partial-wire控制确认laboratory物理错误会被private partial mapper漏作blocked；该控制不是E2E。主方新增完整正确actor/3计划，仅将seq0空quarantine时误test A，预期public真实exercise给available_quarantine_pack。首次代码/计划先封，真实programme执行后送同checker保修前漏归因。只在整审完整清单集中修后，对这个同rawrun重新prepare，不重actor/正确matrix/组件资格，明确分开synthetic与真正原生错误programme。

## 唯一集中整题独审的两项实际阻断集中修

08:25:27Z初评/原5H/原源/实际反例已封，只有B01/B02两项。主5H全pass；弱H01/H05fail其余pass，仍无总分/未冻。唯一独立自含完整source-only cold自然0/168.5232507秒，新3plans/证书/native/图齐，原和cold各3152SQL阶段原CSV/Fraction/源/两73及rowcontrol闭合，随机episode不同而同实际逻辑path的原数字导出仍12Mpass。wrongIID独立实际2768阶段/物理后验恢复正确但三输入成本超原101/100证实质量控制，不是仅改声明。

B01：原stage-ledger receivables_json将确切due_week整数1改JSON true，旧Python列表/字典等值True==1导致实际prepare M05仍pass。必须按原AR字段schema核receipt_id字符串、amount/due_week严格int再比较，拒绝bool数值伪装；同触及的Fraction组件/概率读取也先拒绝bool，保留合法数值表达，不改物理/概率/目标。B02：partial分支只对operations重建advance，lab无quarantine却test A的已知物理错误被blocked。原synthetic映射控制只作局部；主方已补真正完整actor原3计划、仅seq0误test A，实际exercise1/available_quarantine_pack，旧prepare仍M02blocked，原源/命令/结果保wrong-early-inspection。修partial对laboratory按声明skip/paid可观察类型重建合法性，将实际已知lab物理/信用错误归M02/M06；未执行下游仍blocked/totalnull，不能全判通过或全扣。

影响只此新0.4私有评价器及其原对象；公料/原型源/native/controller/actor/原DP/原目标均不变，L01/旧版/生产入口/UI不涉及。集中修后仅原badAR、原真实badLab及主/弱/IID原已闭合对象必要prepare/evaluate复核，不重actor/native/DP/cold或组件审。原checker和全部原评级保before-concentrated-review-fixes.zip及独审observations；任何分数仍须唯一H绑定及真正grader。

## 集中修后唯一结案与真实grade

最终独审见whole-case-tests/independent-review，B01/B02仅原对象必要复验，主/弱/IID原closed重算保正确输出，未重actor/native/DP/cold。FREEZE只登记L06/0.4.0-dev开发metadata，原raw/17ID/权重100/critical/90及各输入101/100不变。真正grade对子项重新从closed原run/source/delivery计算，再接原绑定5H：主参考100/allcritical/goodtrue；弱90、H01/H05criticalfail/goodfalse。两次直接原生exit分别0/4，全argv/真实时间/stdout/stderr保存；非LLM候选或手写聚合。四原故障、真实badLab和完整IID错误模型仍按原已知失败/未执行blocked，未伪造整分。

静止全原件唯一archive 46,839,470bytes/5626members，逐成员及排除理由在archive.json；保全部独特原DP/native/SQL/wire/源码/正确错误/初评误过/修后/唯一cold。第三方report-env/cache、assignment重复closed副本和首次递归自复制临时树原封外部，不谎称小ZIP包含那些字节。不重复任何旧0.3/旧solver/原训练/已完审查。fresh比较尚未启动，作者秒数/业务阶段不当有效小时；全目标ACTIVE。

## 用户再次纠偏：停止把开发验收分当成重型benchmark有效性

用户指出连续两系统满分暴露设计问题。根因不是需要把正确答案扣低，也没有证据表明这次100的数值聚合算错，而是我把工程验收题的合规分作为“数小时重型全链路评估”的成绩和推进依据。最初Recall已写“状态空间/依赖链过小、内容完整不等于分辨率”，我仍重复相同失败：有限合成题→全链合规检查→两个满分→换版本。此路线停止，不能再拿0.5编号作为修复结果。

已核的具体证据：12个机器叶75分，其中只有M04的10分直接检验优化质量，且仅为是否进入1%阈值的二值通过；其余65分是正确性、身份/完整性、运行/恢复和交付验收。5个人评叶25分也均为二值通过，主要评说明、证书/移交/图和诚实范围。二值rubric本身并非必然无效，但在这份低上限任务中，一旦合法解达到数值最优并写全报告，整个100很容易同时封顶，没有建立要测的高水平工作质量分布。

题目核心是完整公开的小型有限状态模型；三个输入只改变少量融资/先验参数，同一个算法覆盖。public已提供物理/后验/原生执行/对账primitive，大量交付由固定运行器产生。首次完整三个精确DP各不到1秒，两个新系统均独立达到同信息最优，真实同grader全部17叶通过。这些事实只能证明它们完成该验收任务，不能证明题目具有重型难度、数小时有效工作、专家质量分层或模型区分度。坏programme拒绝和一轮完整独审也只支持规则/验收正确，不能替代这些缺失证据。

不适用与影响面：本次只纠正benchmark任务定义/评分解释/资格状态及下一步执行路线，不修改生产调度、Task/Mission/Session、数据库、UI、Provider或凭据。L01原长训练不取消、不热改或重开。所有原题面、权重、阈值、正确/错误programme、评分、原失误/审查及完整workspace保留；不回写旧100、不临时拉高线、不在观察答案后造扣分。停止自动创建0.5同型题、启动新candidate或做重复资格/独审。

原始“10个真正重型任务、实际数小时有效工作、对齐成熟benchmark”的目标未完成。9份工程合同只是库存，不能再表述为重型benchmark已完成9/10；有效小时资格仍0/10。L02/L06的天花板问题已有实际证据，其余仅作者参考通过的题尚未取得fresh区分度证据，不能假定合格。后续必须回到完整任务本身的真实未解决工作、交付质量和失败模式，先建立有依据的实质质量层次及上限/可达性，再做完整任务实测；不得扩通用评分框架/堆叶数、规模或耗时，也不以保证“没人满分”为目标。原另版义务转为实质重建需求，而非机械升版复跑。
