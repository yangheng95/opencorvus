# HeavyWorkBench-10 构建与独立审查

## Recall

- 用户原始要求：构思并做成 10 个重型、从头到尾的全链路任务（例如论文从零到交付），编写 rubric（评分细则），形成 benchmark（基准测试）；找一个独立 agent 对照成熟 benchmark 审查，反复修订，禁止敷衍。
- 交付目标：恰好 10 个差异化任务；每个包含可获得的冻结输入、完整用户委托、交付物、依赖链、原子评分细则、关键失败规则、资源预算、复跑及人工审查办法。提供本地可执行的输入导出、客观检查、证据绑定评分和聚合工具、聚焦正向测试及真实工具运行记录。
- 质量边界：方法对齐、工具通过、参考计算正确、agent 能力实测、职业专家效度与评分一致性是不同结论。任何未取得的证据标为未达成；独立 AI agent 不冒充职业专家，合成输入不冒充真实客户资料；10 题不代表总体职业表现。
- 硬约束：保护工作区其他修改；不创建 branch/worktree；不使用凭据、额外 Provider（模型服务）或外部业务写入；不操作用户应用；不新增/运行 UI（用户界面）自动化；不以摘要和文件存在断言代替行为验收。所有模型交互沿现有流式路径；本次工具不发起模型调用。提交本任务文件，按仓库规则 merge upstream 后 push。
- 已读：根 AGENTS.md、benchmark-debug-template/SKILL.md、package.json、specs/README.md、月度与 artifact 索引、specs/current/architecture/inspect-benchmark.md、现有 Inspect benchmark definition/dataset/scoring/task、Harbor README、AutomationBench 证据边界、pre-push hook。
- 全仓搜索：`rg --files` 与 `rg -n` 搜索 benchmark/eval/harbor/inspect、AGENTS.md。现有 Inspect 是运行/并发/重试/日志的唯一集成；Harbor 有独立容器执行方案。本次新增的是任务数据包和离线评估工具，不新建运行调度器，也不伪装为 AutomationBench 或 PaperBench 的官方变体。
- 资料：PaperBench https://openai.com/index/paperbench/ 与 https://arxiv.org/html/2504.01848v1；GDPval https://openai.com/index/gdpval/ 与 https://arxiv.org/html/2510.04374v1；TheAgentCompany https://github.com/TheAgentCompany/TheAgentCompany/blob/main/docs/EVALUATION.md 。访问日期 2026-10-29。
- 委托：用户明确要求的一个独立 agent `benchmark_review`，仅只读审查，禁止再次委托。初审要求输入/评分隔离、原子叶项、实跑复现、盲评校准、预算公平、基础设施错误分离，并明确经验成熟度不能靠设计或自测获得。

## 问题深度与影响面（实施前）

可观察现象：用户需要一套尚未存在的跨领域重型任务基准。直接触发是当前要求；尚未观察到产品执行故障。数据/控制流问题是「任务描述 → 输入 → 可执行产物 → 独立证据 → 评分 → 比较」尚无本次 10 题的闭合契约，只有任务标题或通用 rubric 会导致自述评分、输入缺失、难度不明及评分器可投机。

现有路径不是待修复的旧实现：Inspect 支持现有已注册 benchmark，但本次任务的数据、职业评分和参考证据尚不存在，不能靠复用其成功率证明本次质量。新增包使用自有明确身份，不修改官方 benchmark 语义。生产调度、持久化 schema、Provider、UI、发布均不适用；不改生产接口。调用点为新离线 CLI（命令行接口）、其聚焦测试和文档索引；公共契约为版本化 JSON（JavaScript Object Notation，结构化数据）任务/评分记录。

数据采用明确标注的原创合成组织资料，仓库许可证适用；避免外部下载失效与隐私问题。输入不能只列链接，必须随包可取得。参考计算是 objective oracle（客观判定依据），不是专家完整交付基线。风险包括题集过小、题目公开导致污染、客观数字被硬编码、定性评价偏差、缺专家校准和资源预算未试测；以干净环境复跑、证据级评分、质量维度分离、开发集身份与明确未达成项处理，不能靠宣传消除风险。

## 实施方案

1. 在 `specs/artifacts/2026-10-29-heavy-workbench/` 保存单一机器定义、逐题可读任务、原创输入、方法协议与成熟 benchmark 对照。
2. 在 `script/benchmark/` 增加无模型调用、无任务调度的 Python 标准库工具：校验、导出、客观评分、双人证据评分合成与报告。使用现有 Inspect/Harbor 负责未来正式运行，不建立竞争调度器。
3. 每题划分输入审计、方法、执行结果、实质交付和复现交接；以原子叶项评分，不奖励字数、文件数或看起来完整。公开委托包含所有业务要求，私有评分仅含实现与 oracle。正确负面结论、不可行证明可以得分。
4. 实跑全部 10 题的客观参考计算与检查器，运行恶化/边界样本的明确评分或错误合同；这些只验证工具和局部可解性。人工/专业交付评审、真实系统全链路能力运行独立列账。
5. 独立 agent 多轮审查，每轮保存发现、修订和复审结论；阻断项不隐藏、不自签成熟认证。
6. 更新本记录及相关索引，运行 `bun run docs:check` 与相关正向测试；审查 scoped diff，创建范围明确提交，fetch/merge upstream，检查完整待推送集合，完成必要 hook 后 push。

## 当前状态

已实现十题及200叶，原始输入、私有oracle、40张诊断表、可读题卡、完整协议、比较表和离线工具全部落盘。参考计算不是完整专家交付。

## 实施与验证

- 第一轮独立审查退回八项：H01方法证据不足、H07无原始档案、H08无资源竞争、H05重启事故不真实、诊断身份未公开、oracle故障被算零分、汇总缺身份/条件校验、现金舍入错误。均修复，细节见[审查账本](../../artifacts/2026-10-29-heavy-workbench/REVIEW.md)。
- 第二轮独立实跑确认八项修复，又要求H08实际工作范围；已补24项任务的范围、交付和验收。第三轮独立确认范围与计划检查，另发现输入完整性漏洞；已绑定公开合同和全部冻结原始记录。第四轮独立复验后认可开发集设计/离线工具，审查范围内无剩余阻断，明确经验成熟度未达成。
- `python -m unittest discover -s script/benchmark -p test_heavy_workbench.py -v`：34/34通过，包括每领域已知小输入、错误合同、独立双评机制、条件相同的聚合、物料/排程/能量及固定输入完整性。合成评分样例只验证机制。
- `python script/benchmark/verify_heavy_workbench.py --out specs/artifacts/2026-10-29-heavy-workbench/validation/checker-replay.json`：全部十题40个客观诊断叶通过；H05真实旧服务重启翻倍；H08实际可行见证38日/67400 CNY，依赖下界26日/工程师资源下界38日；七组基础/压力计划通过独立约束验算。没有模型调用，不是十项全链路模型能力结果。
- `python script/benchmark/heavy_workbench.py validate`：10题、200叶、权重和输入合同有效。
- `bun run docs:check`：通过，351 ops / 26 groups。

## 尚未满足的严格成熟度要求

本次没有完整职业专家参考交付、专业人员盲评及真实多质量评分校准、两个系统十题各三轮的实际运行、正式Inspect/Harbor适配与操作系统隔离资格验证。故只能交付公开开发基准，不能宣称成熟经验效度、专家等效或任何模型通过十题。独立agent不能替代职业专家，本次未获私有Provider凭据使用授权且未使用。后续需取得专业评审与实际运行资源后，按已冻结协议收集证据并修订新版本；不以继续改文案填补实证缺口。

未发现本次范围需要删除的旧实现。未修改生产运行、调度、数据库、Provider、UI或发布路径。
