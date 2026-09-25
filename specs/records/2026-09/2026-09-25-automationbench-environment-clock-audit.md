# AutomationBench 环境时钟与计数审计

## Recall

- 用户在侧对话要求检查 benchmark 环境是否有 bug，随后要求修复全部问题。此侧对话只修改范围内的本地集成，不干预主线程正在运行的进程、世界或评分。
- 已读 `AGENTS.md`、`specs/current/architecture/inspect-benchmark.md`、本地 AutomationBench/Inspect 的 `world.py`、`task.py`、`mcp.py`、`solver.py`、`adapter.py`、相关测试及官方固定 `4a8e106` 的 `WorldMeta`、Salesforce 查询与 rubric。只读查看已结束的 Cycle3 `.eval`，没有重算原分或修改历史。
- 起始工作区干净；`he-01` 两个样本已 scored、host stopped、active_after_cleanup 为空，没有需要中断的本任务实验。已有其他任务提交和上游推送状态不属于此修复。

## 现象、根因和影响

| 观察 | 根因/准确分类 | 影响 |
| --- | --- | --- |
| sales/9 样本输入显示 `current_time: unspecified`，Cycle3 真实世界 `2026-09-25T06:04:20.060212Z` | 官方 `WorldMeta.current_time` 缺省为真实 UTC 当前时间；适配层仅读原始 `initial_state.meta`，两个来源没有在建 Sample 前收敛 | 对带 TODAY/THIS_QUARTER 等相对日期的业务查询会影响结果；内存只读验证同一账号续约日，在 2025-11-20 时本季度返回1条、2026-09-25 时0条。旧 Cycle3没有相对日期 API 调用，不能将金额误验收归于此 |
| `OfficialWorld.seal` 和 `rescore` 重建初始 World | 原 `self.initial` 不含缺省时钟，rubric重建时再次读取真实时钟；`rescore` 还从无时钟的原 Case 新建初始 World | 评分/回放在日期边界可能不一致；这是一条未观测到历史分数实际翻转的可证伪风险 |
| `api_catalog` 没进入 `world.events` | 它是适配器拥有的操作目录读取，`world.events` 记录的是官方模拟业务 Tool | 上次将它称作“官方工具漏计”过于宽泛。官方 Tool 调用数与全部 agent Tool/Provider 成本须分开统计；不改变官方事件或评分器 |
| sales/9 partial=0 而6个保持性断言通过 | 官方 rubric 按设计排除初始已通过的断言，只剩复合正向断言要求账号、阶段、金额同时正确 | 这是评分粒度限制，不能改官方分数，也不能用0推断所有业务事实错误 |

旧实现/测试仅验证显式时钟和“缺省时向模型写 unspecified”，没有验证缺省世界真实时钟、原 Sample、初始评分与离线回放共享同一值。代码未把缺省时间冻结到业务事实源，后续加强读取或角色无法修复这一点。

## 单一修复合同

1. 原始上游 Case 和原 SYSTEM/USER 保持只读。在构建每个 Inspect Task 时，缺省时钟的 Case 复制一次，并将一个 UTC 时间写进该复制品的 `initial_state.meta.current_time`；同一复制品产生 Sample 输入/metadata 与 `sample_environment` 的业务 World。显式官方时间原样使用。
2. 公共 Task 参数允许提供一个已冻结的 UTC 时间给缺省案例，供成对观察共享；不给定时在 Task 构造时取一次当前 UTC，不在世界构建、评分或回放时重新取。显式官方时间不得被覆盖。保持现有 epoch/project 隔离和源 Case 身份。
3. `OfficialWorld` 同步把世界实际采用的缺省时间写进 `self.initial`，使官方 rubric 初始 World 使用相同时间；`rescore` 从已封存 snapshot 恢复同一个时间来构造初始 World。保留官方 rubric 函数、断言和原分。缺少/畸形的 snapshot 时间得到明确输入错误，不能无声回退为此刻。
4. 不增加 Host 业务判断、日期关键字、第二世界账本或替代评分器。固定官方1.0.6的`tools/api/impl`中搜索到68处直接调用墙上时间；其中Calendly、DocuSign、Google Ads、Salesforce等都含此类写入。它们不能靠上述修复泛称已消除，也不能仅凭出现`datetime.now`断言每一处影响正式分数；不擅改`.venv`安装件。`api_catalog`与official world events继续保持各自定义。

## 聚焦验收

- 原真实 Inspect Task 入口构造 sales/9：模型可见请求、sample metadata 和实际 World `meta.current_time` 三者精确相同；纯原 Case 和原 SYSTEM/USER 不变。
- 有显式官方时钟的案例保留原值；成对任务指定同一缺省时间时，两个独立世界可作同一相对日期查询并得到同一结果。覆盖时区和畸形输入的明确错误。
- 官方 `World.seal` 与从真实 snapshot 的 `rescore` 在冻结时间不同于执行墙上时间时给出一致断言/分数；历史原分只读。模拟 stdout 或静态字符串检查不能替代生产 `OfficialWorld`/`opencorvus_automationbench` 路径。
- 聚焦 pytest、ruff/mypy、文档检查和差异复核；没有 UI 变更，不运行 UI 测试。不启动新模型、用户服务或旧世界。

## 未验证范围

- 该修复不证明 Luna 的定价关系推理改善，也不证明两臂结果由时钟导致。上游各业务 API 的其它实时戳行为另列实际调用点；不修改上游包或官方 scorer。
- Benchmark 全部 47 类服务的行为正确性不能由这个局部测试保证。用户的“全部问题”以本次可复现环境问题、相关调用点和真实 checker 为范围；若发现更多确定缺陷继续调查与范围修复，不对未知路径宣称无 bug。

## 实施与验收 checkpoint

- 单一`Case`副本在Inspect Task构造时取得已给定或一次生成的UTC时间；同一副本进入Dataset与`sample_environment`，删除了原来二次调用`load_cases`造成的另一个数据投影。显式官方时钟原样保留，原SYSTEM/USER逐字不动。公共`unspecified_clock`只用于官方未定义时间的样本；时区缺失明确拒绝。
- `OfficialWorld.initial`记录真实World采用的同一时间，避免rubric初始World再读取墙上时间；`rescore`从封存snapshot取得时间，与显式官方时间冲突时返回精确错误，不用当前时间补档。`CASE_CONTEXT_POLICY`递增到`official-world-clock-v2`，历史v1分数原样保留。成对driver在单进程初始化时冻结一个时间，在两臂Inspect参数与matrix receipt共用。
- 聚焦25个Python测试通过：包含真实`opencorvus_automationbench` Dataset输入及metadata、官方`OfficialWorld`和真正`api_fetch` Salesforce查询；同一记录在2025 Q4返回1条，在2026 Q3返回0条；官方score/封存snapshot replay一致。其它现有合同涵盖多个独立world、MCP端点关闭、Mission accepted/blocked scoring、Sheets瞬态行写追踪、严格断言模式。
- 跨语言实际检查：`automationbench-project-admission`通过真实本地产品配置、专家团投影及官方Model Context Protocol服务（1项11断言），`automationbench-expert-squad`验证真实包loader（1项5断言）；均无外部Provider。聚焦Ruff/Mypy通过，根docs:check 342 ops/25 groups，差异检查通过。没有启动模型或用户服务、刷新凭据、改上游安装件或重算历史。
- 准确限制：这修复可复现的适配时钟分裂与评分回放不一致风险，**不证明**全部上游服务已经使用模拟时钟；68处直接墙上时间需要单独逐调用按业务影响审查。`api_catalog`不属于官方world事件，之前将它称“漏计”已更正；全Tool成本应从原Task/Provider轨迹汇总，不改官方评分器。sales/9官方partial=0是分母里只剩一个复合正向断言的结果，不等于所有保持义务都失败。Cycle3金额误验收与本时钟问题的因果关联未证。
