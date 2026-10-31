# L06/0.3 完整业务建设：权威历史与单一物理递推

## Recall

用户十题/严格rubric/单层独立审查/双系统两好另版升级/有效数小时目标不变，cheap-first优先。0.2.0两真实100已触发升级，冻结public/rubric/FREEZE和旧成绩不改。原三期9/2合法与7/2提前知叶只是信息primitive资格，不是完整0.3。L02唯一新正式参考在后台执行，不能重复它或恢复旧Paused GPU/搜索。本方案不动任何活跃运行和产品Task/Mission/Session、LLM消息/路由、Provider、UI或数据库。

已读upgrade-v0.3/PLAN及信息primitive/独立时序追加，旧public/DATA和qualification/current-source的l06_input、check_l06。已搜索当前及历史同名源：旧执行快照只在各qualification ZIP/目录，唯一当前0.2物理checker为qualification/current-source/check_l06.py，不是不存在的evaluator/current-source。旧实现已完整覆盖包装、合单运费、到货、工时/仓容峰值、延迟回款/信用与终期，但仅K周共同动作之后整条情景可知。新版本必须消除这个一次揭示限制，而不能通过重复solver或叶数提高表面工作量。

## 问题深度与影响面

旧common-prefix约束只核record[:K]，没有任意后续完整可见历史的等价类；primitive又把外部分配的观察字符串当权威，尚不证明真实业务事实已经全部可见。若复制一份新周递推，会出现库存/到货/现金不同口径；若只比较L/H，则可能错误强迫可见状态不同的路径同动作。真正缺口是权威信息、决策前状态和实际承诺之间缺少统一构造/回放。旧全部成功并没有行使这个新合同。

影响包括新材料解码、单周纯业务递推、旧完整计划checker的等价组合、新树政策checker、在线执行/续接、原始来源/运营交付与新质量注册。风险是历史周内顺序被无意改变、信息提前泄漏、旧动作被改写、重复实现或用0.2下界套新问题。生产控制流/版本迁移/真实采购付款均不适用；是否需要新的数值后端目前未知，先完整可达和便宜下界，不开长搜索。

## 拟实施的最小完整合同（待独立设计审查）

1. **业务事实与观察。** 新输入明确为tree-instance，静态实体/包装/费用/初始库存/现金/信用/回款滞后与每条有限路径的逐周需求、供应/产线容量及正有理概率来自唯一原材料解码。第一版价格/提前期可保持静态已知，不假称已有随机变价能力。每周决策前可见全部当周外生值及过去已执行事实；节点等价由真实完整历史构造，不能信候选自报node/信号。公开有限支持树及所有可能路径可离线使用，实际将走哪条未来路径是评估侧私有事实。
2. **同一周语义。** 先到账历史到期回款及旧订单当周到货，公布当周需求/容量等可知事实，再决定新订单/装运/生产；lead0订单同周到货。然后核原料生产前峰值、原料可用/BOM、共享工时/产线许可、成品交付前峰值、全部需求交付、期末持有费/采购/运费/生产费与现金底线。最终在途、成品和现金要求按新公开合同明确。不得因为新代码移动现金/到货阶段而宽松。
3. **单一递推。** 从旧checker提取明确的纯周transition/初始状态/终期检查，旧整条计划检查和新政策回放都调用它；不保留第二份旧周循环作为fallback。提取前保存旧当前源和已封存代表计划，提取后只重算同一原业务计划及完整账/925业务谓词等必要正向等价检查，不重旧solver/LLM。旧0.2输入/评分语义不改；新tree解码入口不让旧格式自动落入新题。历史执行快照保留原件，不热改。
4. **承诺/状态。** 状态至少含周数、期末原料/成品/现金、已登记未来到货及应收、完整已执行动作和已观察外生前缀。决定前状态由原prefix唯一重建；候选不以自报inventory控制业务事实。新动作只能追加当前周，不能修改旧订单/生产/交付。非法动作产生具名业务错误和未提交边界，不把负库存后继续递推的数字当可执行财务。允许任意正确方法/语言/表策略或重求解次数；需恢复的是业务事实，不强迫保存某种优化器内部状态。
5. **非前瞻政策。** 完整离线政策可按公开路径表示，但每个真实完整观察/已执行前缀下的完整动作向量必须一致；当外生历史相同且过去动作一致时，transition算得的实际状态也必须相同。不同可见历史可以同动作，不强迫翻转。状态不同不得仅因信号同名而强迫同动作。完整业务可行和这个信息约束分别给可定位结果，信息primitive通过不替代业务可行。
6. **执行隔离。** 固定sandbox路径与相同声明源，只向执行程序逐步提供公开支持资料、当前完整历史/权威状态。未来实际chosen leaf、未公布事件、评估key不得进入argv/env/挂载名/packet/source。episode随机中性ID与事前私有排列不得编码路径；当前观测合法识别节点不被当泄漏。完整可能树可以公开，不能混淆“支持资料”和“实际已选未来”。先做真实程序输入/挂载和同prefix对照，再声明此范围隔离；静态文件名检查不能证明任意程序安全。
7. **完整材料与参考。** 逐步构造一个保留所有主要耦合机制的适中完整工厂实例，至少有两次后续信息揭示且揭示前有真实提前期承诺。维度不是难度门槛。先给完整可行信息政策、完整逐路径物理/财务账与独立递推，证明一项新信息/承诺机制确实影响可达成本或恢复选择；错误前瞻、漏周内峰值、改旧承诺、错现金时点各进入同一checker。可执行低质量政策不能只用不可行计划替代。不会强迫每项机制都让动作变或某种solver更好。
8. **质量和交付。** 新政策期望成本按原严格有理概率计算；可行、信息合法、真实执行成功与成本质量分开。注册新的可达见证/可核下界口径，不能继承L47380或非凸精确轨迹。报告比较合法政策、充分信息放松界和可执行替代，解释信息/提前期/仓容/信用的实际作用及新决策风险；图须实际呈现/查看。完整参考/反例/运行/职业交付和原子rubric/固定分母/critical/校准后再独立冻结，之后fresh双系统。此方案没有批准0.3或有效小时。

## 第一实施切片与验收

独立设计审查后先落实单一周transition及精确旧计划等价，连到新完整历史/状态构造。只做秒级重算/小闭式边界，不新增整数求解。然后才完整新原材料→合法政策/独立账→原程序执行/恢复→报告/质量注册。任何反例保原源/输入/输出，按根因修复再必要复验，不能拿方案或一个周状态例冒充完整新题。L02完成后原38研究评审仍按其独立正式对象进行；两个任务证据和分数不混用。
## S1实施前已采纳的独立澄清

独立PLAN-REVIEW/stage在l06-v03-business-construction-review-20261030，本轮仅设计、零实验，认可最小S1，未批准完整0.3。旧collector先收所有order谓词再收physical谓词，evaluate的first-error/完整family/count与infeasible cost/scenarios mask均必须保留；提取为同一纯kernel的tentative诊断结果，不能用fail-fast破坏旧分项，也不能将诊断负库存/假设收入发布为online合法状态。

初始pipeline/AR=0、静态价格/lead、receipt lag>=1、全需求必须交付，暂不加入欠交/取消/旧单丢失/即时销售款。供应容量核下单周；旧单到货不因到货周容量0撤销。raw期末可剩且付holding/无残值，FG必须0；正raw单不得期后到，AR可期后而不算现金。MOQ0的空车允许并照付运费，不增加on iff正数量规则。仅结算现金受信用/终期底线，不能新添采购瞬间cash非负约束。

唯一checkpoint语义post_week、next_week0初态；队列按绝对due-week。begin只投影本周历史到货/到账，不修改原态；advance从原post态算一次，零违例才commit、next_week+1/清本期due/登记本期承诺。恢复cash可合法为负，不能沿用initial_cash>=0验证。原prefix是事实，库存/现金/队列是唯一派生，恢复必须核一致。旧离线完整plan的未来订单预算不能用于online队列或提前暴露；新状态只从已提交订单/已交付销售推得。由初态先核同观察组当前动作再推进，不能用前瞻造成的不同过去动作/库存洗白信息违规；支持合法随机ties，不比较独立随机运行输出逐字相同。

S1先增l06_physics纯周内核并使旧inspect_plan调用，shape/common信息层和旧返回保持；不改0.2public/rubric/FREEZE/两100。影响面已搜索：l06_delivery/numeric/integer/reproduce和qualify工具消费inspect/evaluate，没有产品入口或活跃L02导入。提取前source-before及两真实sealed计划原inspection已保存（约.099秒，成本476871/10、95283/2），非独立重验或完整0.3。后验按原完整账/active/family/成本全对象比对，再3周cash−1→2语义卡、两峰/多错首序、包装/空车/终期边界进入实际checker，不重旧solver/648枚举。新持久online/权威tree材料不在本S1内，未来交付格式演进仍须版本化保数据。

S1全仓消费者核查另发现qualify_delivery.py是早期一次性目录布局：四个work/v2硬编码输入在当前source目录均实际不存在，而current numeric/grading包装源清单也需加入新physics依赖。该脚本不是业务根因，也没拿它失败掩盖新交付。按当前工具合同修为显式reference-input/reference-plan/expected-cost-exact和闭式credit-input/credit-plan参数；保原历史执行脚本/argv，当前不保旧隐式路径fallback。仅必要地跑此真实派生CLI工具以证明新显式输入和源依赖闭合，不重整数搜索/旧矩阵/LLM，相关错误响应仍为具名输出合同。

后续online还须约束诊断出口：现共享kernel的scenario_id只是旧离线错误定位前缀，旧整树输出可列公共叶；新episode必须传中性公开定位，不把私有实际chosen leaf放入where/异常/收据而让故意非法动作成为未来oracle。节点可由合法history推断与直接泄漏所选未来须区分，不能靠屏蔽所有叶字符串的关键字门替代真实数据流隔离。

## 整份0.3业务实施Recall（2026-10-30，非新组件资格）

目前L01原作者矩阵owner54408持续训练，不能重启/热改；L06旧两100和退休API/旧L47380只读。本轮在此期间补完整多阶段题包，不增加通用runner/消息/调度能力，不重复S1/信息toy或原solver。已重读当前l06_packet/read_packet、唯一l06_physics、qualify_l06/build_model、l06_integer/solve_integer和原CSV；原线性模型只含共同K周，故新模型应在同一物理线性模型上增加由完整事件前缀推导的非前瞻等式，不另抄物理方程。

实施对象为新0.3目录：原始商业/排产说明和11CSV、公开支持树/合同、唯一tree_business权威事件前缀/重放/动作验证、一次完整源参考、真实在线固定packet/pipe执行与SQLite不可撤承诺/同键恢复、全账/报告/实际图、同checker正错programme和原子rubric。旧0.2公开/冻结/权重/分数完全不变。新物理事实仍由唯一raw decoder读取，normalized不是候选权威；公开支持路径可全部读，实际路径只留在父进程内，actor只挂固定public/source/output并由stdin取得当前history/state，错误出口使用中性week定位。

材料采用16周4原料4产品3供应商2工厂、三个后续揭示时点的8条有限联合路径，含真实lead1/2订单、lead0应急、合单包装/MOQ、共享工时、两段峰值仓容和延迟回款。这是新原材料构造，原静态目录/商业语义继承来源明确，时变需求/供应容量组合和现金等新事实独立登记，不能套旧参考界。先构造一个可执行高成本政策，在全部路径同信息合法并满足业务；再至多一个有明确120秒内部上限的CPU参考求解，假设是完整非前瞻模型可以找到更低成本可行政策并给出可核native界。120秒只此作者代表验证参数，不是用户总额度/候选限制，若unknown或无可行解原样保留，不通过重复短solver冒充进展。质量线必须另登记/论证，不从旧L或未完成求解推分。

online单独验证真实源只获当前完整prefix/权威状态、原动作只追加、commit后进程退出与原receipt续接，过去动作更改/自报库存/前瞻政策/错回款/漏峰值及可行高成本控制进入同一checker。不会把表策略或不保存优化器状态判错；原实际业务state由完整journal唯一重建，SQLite只是事实持久化。新报告解释信息/成本/资金风险，并保留真实算法/数值失败。完整源执行/所有路径/真实图/完整错误programme与原子评分齐后才一次整题独审；本计划和任何中间模块不宣布完整0.3、十题或有效小时。

## 用户指定本机执行的整题接续

“别用docker了，本机搞”覆盖旧容器载体；不再查询/启动/恢复Docker。原120秒政策求解已完成且原件保留，不重求解。当前source/execute_policy尚未实际native运行，先保存其原设计源码；改为本机真实Popen stdio worker、独立工作目录/收窄环境及真实SQLite commit后os._exit73/同键恢复。唯一当前入口只本机，不保Docker fallback。public运行合同同步改Windows/本机声明，任意正确语言的argv不变。

数据流根因/影响面：原Docker挂载为source/public提供路径边界；本机同一用户不能声称OS文件系统/进程内存隔离。新控制父进程只在内存持有当前所选未来事件，不把chosen leaf放worker argv/env、源/工作目录名、packet或错误出口；argv从submission逐项映射公开/project/public根，固定模型支持树仍全部可读。范围是实际输入/状态/承诺的因果合同、源码审查和有限同prefix回放，不宣传OS侧信道安全。原private_path持久字段/parent --path-id若进入实际启动参数会泄露真实未来，当前本机设计改用父控制输入的事件序列与事后路径关联，未来事件不写worker可读文件。

整题实际一次8条路径，其中一条在week7真实commit后退出73，原DB恢复余下周，合计128个真实业务commit不重整条路径；另做一次公开CSV行序控制的完整16周代表。保实际输入输出/native/SQLite/原receipt/全部源码，动作与原因果政策/周内递推一致并接同整题checker。此前logical错误programme和120秒数据复用原件，不重复组件数值。整题正错闭环及完整报告/固定分母grader齐后一次集中benchmark_review，禁止再委托。

首native全链已实际6.516秒/控制73后9个0/128commit+16控制，原件保native-whole-run。主方整题自审发现该初稿沿公开场景顺序执行、控制也固定T07，未落实此前“私有排列”要求；同时row控制误比较与业务无关的request_id，且host-controller源码没有首执行前副本。集中修为本机SystemRandom私有顺序/独立私有控制路径，只在全部终态后发布关联，控制比较完整业务事件/动作/收据数值而不强迫ID格式；首执行前同时封actor/controller源。旧成功不改写为最终资格，修后只需一次必要整题全链，不重solver/逻辑错误programme/组件资格。真实SQLite schema2此前无native持久DB，旧未执行schema1代码只作历史；没有已交付持久数据迁移对象，L04/L05用户库不涉及。

## 整题checker与唯一集中审查接续

完整check_whole.py只此case，prepare复制闭合source/public/native/delivery后独算12M，五H严格assignment绑定并只能评H。固定100/90+allcritical，未知/未冻totalnull。实际5.5132287秒修后native全链与作者/弱报告两个prepare均12Mpass；主方实际view新图清晰。报告由真实report_policy CLI生成，weak只增加现实无限保证，主体真实数据/actor保持，不能冒充不同执行。四个已有实际error_policy输出只读复用，形状/信息/物理具名失败，改policy未执行和依赖阻断保留，不造whole-score。

一次集中/root/benchmark_review已收到两个闭合assignment/完整原料/源/native/CSV/图/rubric，禁止再委托/Docker/Provider/操作L01/新solver或组件测试；允许必要的一次自含reproduce完整native独立冷链。审核前后原对象和原评级不覆盖，实质阻断集中修且仅必要复验。当前还未给新0.3冻结或候选小时。

## 唯一集中整审六阻断的集中修复方案

独审原初评级和六阻断已封REVIEW-INITIAL/main-review-initial/weak-review-initial/INITIAL-SEAL，原业务/信息/原SQL全部独算正确；不是降低目标或换policy的理由。直接触发/根因和影响面：公开笼统terminal及wire无法独立实现；runner硬造table_actor/submission且controller仅封副本却执行canonical路径；M05用Fraction字符串比较造成等值误拒/少核最低现金；公开交付漏逐路径AR到期表；raw/public ZIP自己一起漂移但SQL meta没有绑定权威原事实；grade信任可编辑prepared M。全部限新0.3public/本题runner/report/grader/交付，旧0.2、生产Task/Mission/Session、用户DB、UI/凭据与L01活跃源不涉及。

本批一次修：完整公开terminal/现需spot算法/70640及60044/全部状态packet与CSV/summary精确wire；runner必须消费明确交付programme/argv，实际controller/checker从事前封副本执行，声明policy单独绑定，不重造actor；Fraction数值等值比较且核所有摘要财务量、真实逐路径cash/AR/due表入交付；权威registered-facts独立保原业务规范，原SQL meta须与当次public完整事实一致，设施漂移不当候选成绩；grade从closed原对象重算M再接严格五H，prepared M不是事实来源。

保初native与初评分/真实probe。修复触及真实programme消费和controller执行来源，主方仅一次必要最终8路径真实整题复验，沿用原policy不重solver；使用合法另名actor入口及不同稳定request前缀以实际证明不硬造table_actor，动作/资金/原始数据/成本和阈值不变。原唯一独立cold不再重跑。之后独审只核本批相关源/原反例/金额等值/新AR表与新原对象，集中结案；不再组件资格或新完整独审。

## 首个fresh真实交付的输出定位阻断（冻结公共合同不变）

全新候选自然交付后先封完整9368文件/385012753bytes workspace与public(含其如实披露的5个bytecode缓存)。原25public源/原表逐字节仍同原不可变public ZIP，cache例外保留，不把身份核验当功能成绩。候选源、原失败、wheel/venv、无Git事实全部封后才私有执行，不改候选programme/报告/池/阈值。

新真实交付把公开指定的CSV/summary/AR放outputs，source-map用JSON、reproduction用PowerShell、实际图是4独立PNG；公共合同没有限定根目录、source-map.md、reproduce.py或operations.png。原private checker却硬编码作者平铺/文件名与Python，因此M05/M12会把合法定位/语言判缺交。已全仓搜索check_whole prepare/grade消费者，仅本题当前README与历史原件；公共OUTPUTS明确允许等价表达和任意正确语言。这个是评价器格式偏置，不能把作者结构/新wrapper塞入候选来遮盖。

本批限本题private工具：单一显式--layout owner定位JSON，列原交付中真实的相对policy/programme/report/两CSV/summary/AR/source_map/reproduce/requirements/figures；prepare闭合其原字节和布局，grade按同closed布局重算，不新增内容、不改原programme/报告、不靠名字判正确。当前私有assignment协议升/2明确布局来源，不保旧协议fallback；旧作者100/weak95及原source/capsule/初新候选评分不覆。M01-M12/H01-H05、100/90/critical、原raw与60044不变，public25文件不动。必要验收只实际新候选同一次私有run的重prepare和原作者flat的机器正向定位；不重native/solver/整题作者独审。候选内容只一次独评，真实图/独立数字及原件在新candidate专用assessment，不能用作者旧稿。无生产调度/共享路径/API/UI或L01活跃源影响。

## 同一冻结public的OC原生对照启动方案

首fresh Codex已自然交付并封全workspace，真正私有8路径/原receipt恢复与row控制已0；当前只等待同17叶候选内容独评/实际grade。后续OC对照复用现有serve_heavy_workbench.ts与Inspect opencorvus_benchmark/nativeTask，不造路由/隐藏消息/队列或新组件资格；从同Git24c013239原25public复制到全新own project，既有base/code/gpt-6.1-sol全流式。Codex实际model/usage未知，仍comparablefalse，不作费用速度因果排名。

已读注册parser/serve/Inspect task+活动期限实现、stageDiagnosticProvider/real-provider-audit；现有launcher仅原生进程、独立home/DB/随机新port。旧退休API不访问、不重启。凭据仅从已授权本机authSource由既有staging成对复制auth/models；模型catalog完整源存在且OAuth未过期（仅打印有效性/时间，未输出凭据）。实际usable/投影/actual request model须由现有preflight真实流式进一步确认，ready后才由Inspect发唯一新Task。没有用户总token/墙钟额度，registration total_model_tokens=null，3600秒只无真实活动的观察期限，Inspect超时不撤有效Task。遇启动设施错误保原源/收据，不能当候选成绩。

不触用户服务/窗口、Docker/WSL、旧Task或L01活跃源；公共源只读和允许依赖/own环境规则同Codex。Task自然终态且子进程终态后封全workspace/Git/untracked/失败，再同冻结原生private/source-only/真实图/独评/同grader。auth/models只临时own runtime，停服务须在其Task结案封原件后按原正常dispose清理，源凭据不动。所有消息仍真实参与者可见；模型/preflight/Inspect生命周期不是业务分或有效小时。只新增本题启动材料和脚本调用，不改共享生产实现。
