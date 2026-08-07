# 专家团开发集自进化 Mission

只优化 envelope（信封）指定的完整、自包含 Expert Squad（专家团）package revision（包修订）。本次仅运行
development Dataset（开发数据集）Case 3、4、10；候选作者不得读取、搜索或推断 holdout（保留集）与
certification（认证集）资源。

你是 Mission owner（任务群负责人）。请使用内置 `evolution-lab` 专家团的 binding virtual workflow（绑定虚拟工作流）
自然协调普通 Task（任务），完成一次可复核的 incumbent–challenger（现任版本—挑战版本）实验：

1. 创建并完成 `evolution-candidate-preparation`，冻结 development Campaign（实验活动）并发布一个完整候选包。
2. 候选只能修改 V1 允许的文本策略面；manifest identity（清单身份）、Agent topology（代理拓扑）、workflow graph
   （工作流图）、Tool（工具）源码、library（库）、Model Context Protocol（模型上下文协议）、configuration
   （配置）、permission（权限）和 assets（二进制或静态资产）必须与 parent（父修订）完全相同。
3. 按 envelope（信封）中的 18 个唯一 slot（槽位）分别创建真实目标专家团 Task：Case 3/4/10 × baseline/candidate
   × repetition 1/2/3。每个 Task 必须使用给定 Git execution directory（执行目录）、相同模型、权限、配置、预算、
   scorer（评分器）和 Dataset bytes（数据集字节），并在创建时绑定精确 `expectedPackageDigest`。
4. baseline 使用冻结 parent digest；candidate 使用 Candidate Artifact（候选产物）中已经 materialize（物化）的精确
   digest。不得修改 project installed baseline（项目已安装基线），不得安装候选，不得重试失败 Trial（试验）。
5. 所有 Trial terminal（终态）后，创建并完成 `evolution-campaign-evaluation`。Evaluator（评估者）必须从真实 Task、
   Session（会话）、Message（消息）、Tool、Artifact（产物）和 completion/failure（完成/失败）事实收集 exact evidence
   （精确证据），严格执行冻结 scorer contract 与 statistics contract。
6. failed、cancelled、inactive、awaiting-interaction 与 unavailable 都是实验事实；保留 typed reason（有类型原因），
   不替换模型、provider（提供方）或 scorer，不自动重试，不把不可测结果写成零分。
7. 发布完整 Campaign、Candidate、Run Evidence、Metric Receipt、Comparison、Integrity Review 和 Recommendation
   Artifact。Recommendation 只能建议继续实验、停止或请求显式晋升；禁止安装、promotion（晋升）、restoration
   （恢复）、动态 rank routing（排名路由）或任何生产变更。

预算与全部精确身份由随后唯一的 `<evolution_benchmark_envelope>` 提供。不得缩减 18 个 slot，也不得把其他 Case
加入当前 Project（项目）。如遇真实阻塞，发布可定位的 typed evidence 并坦诚终止，不得发明 fallback（兜底）。
