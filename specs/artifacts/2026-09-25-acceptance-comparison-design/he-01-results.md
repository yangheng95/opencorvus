# H-E两次对照结果：交接可执行，纠错收益未识别

## Recall与结论

按[预登记](method-handoff.md)，同一sales/9原官方输入，以Mission入口顺序执行B1和T1，
各一次，无替补。共同Git源为`fe233643e8bfbea3cd46dc81ed6123fec5720c84`；
B1为`.13`、T1为唯一verifier段变化的`.14`，包身份见[主记录G13](../../records/2026-09/2026-09-25-supervision-causal-iteration.md)。
原world clock为null，保留unspecified。没有改世界、评分器、历史分数或运行中源码。

**T1正常交付及真实方法→比较交接得到证据；有效纠错和因果收益未得到证据。**
T1的executor在verifier介入前已正确创建54,000，而B1初始创建20,000。
待验对象不同，不能将两次最终分差归因于verifier干预；不能以补跑制造纠错机会。
两个episode已经结束，不追加第三个、不开作者或Campaign、不晋升父代。

## 原分与实际结果

| 臂 | 原严格分 | 原部分分 | Task / Mission | 首次及最终金额 | 最终Account / Stage | 真实纠错 |
| --- | ---: | ---: | --- | ---: | --- | --- |
| B1 `.13` | 0 | 0 | completed / accepted | 20,000 | 001xx000003SMT1 / On Hold | 未发生；错误被接受 |
| T1 `.14` | 1 | 1 | completed / accepted | 54,000 | 001xx000003SMT1 / On Hold | 没有自然纠错机会；直接正确 |

原严格/部分分描述差均为`T1-B1=+1`，只是本次观察差，不是随机因果估计。
该例唯一计入部分分的正向断言是名称、账号、金额、阶段的合取；B1的0不代表所有字段或
所有Tool都错。其名称、Account和On Hold均正确，金额漏基础价和Gold折扣。
两臂各只有一次Opportunity POST，无后续金额更新；官方事件记录其余调用为读取/查询。
原官方排除项照常保存，不重算纳入分母。CloseDate分别为2025-11-20与2026-12-31、
owner均为空；原请求未指定这些字段，不将这一差别补成隐藏验收项或额外收益。

以原Mission outcome与原官方严格分列混淆矩阵；native accepted不是官方通过：

| 原生Mission outcome | 官方严格1 | 官方严格0 | 官方null |
| --- | ---: | ---: | ---: |
| accepted | 1 | 1 | 0 |
| blocked | 0 | 0 | 0 |
| 未结算/其它 | 0 | 0 | 0 |

## B1：方法形成时遗漏依赖，后续层接受

- executor复杂Drive查询`name contains 'Analytics' or name contains 'pricing' or name contains 'policy'`
  在官方事件9返回空集合。该结果不能证明相关源不存在；本轮没有验证该复合查询的模拟API
  语义是否等价于真实服务，因此不把空返回全部归模型能力。
- 事件12和22分别为executor/verifier读原定价邮件，两次原字节均含
  `Base prices remain unchanged`。两者均未随后读取Sheets基础价/折扣；不是已知所有项齐全
  后单纯算错乘法，也不是Cycle3的全部事实已齐场景。
- 原POST `prt_g0VWEJnDf00luXsP7cWG`/官方事件17真实写入20,000，success=true，最终world一致。
  verifier Artifact `art_hhq98XNCPfLqTy4xdxng`明确把`4 contacts x $5,000/contact`判satisfied，
  final `msg_g0VWEKU7E00tbaGliGxz`接受；Task及Mission接着接受，没有continuation或Mission resume。
- 原任务/派单仍要求按规模、等级和最新定价，verifier也重新查过账号、联系人、邮件、
  case与机会。错误发生在决定哪些前提足以支持完整定价，身份/回读/“独立”标题不能修复它。
  与G3反例一致：有合法且显式的错误公式，仍能产生匹配实际值的错误接受。

## T1：正确前置结果与非盲方法记录

T1的executor以简单Drive查询找到标准价表，自己读取基础价/折扣、联系人与更新/政策，
在verifier阶段之前已经创建正确结果。真实持久化顺序（UTC）：

| 时间 | 原始引用 | 事实 |
| --- | --- | --- |
| 11:28:49.571 | `prt_g0VWEMFsx00xBksrTjw3`；官方事件22 | executor POST 54,000/On Hold，success=true；Opportunity `e68907e11e4142e282` |
| 11:29:14.983 | `art_hkWdkq1FV5vuQ6vpGpxF` | executor发布来源/写入材料，含正确公式与结果 |
| 11:31:08.225 | `prt_g0VWEMqQp009YKpuPsA2` | verifier已GET该Opportunity的实际结果 |
| 11:31:22.814 | `prt_g0VWEMu8K00yLRdKLROj`；官方事件32 | verifier重新读取标准价表/Gold折扣 |
| 11:31:50.117 | `art_h1YKQBld9fGslU5KgD8r` | 方法publication，明确推导`(40000 + 4 × 5000) × 90% = 54000` |
| 11:32:54.871 | `art_hHQZrQnqaH8IDvQHUwQj` | 比较publication的真实source locator指向上述方法，结果accepted |

publication时间取原Artifact，Tool时间取原request持久化；不混同开始、返回和发布时刻。
方法通过真实read-ref选择executor Artifact，比较通过另一完整read-ref选择方法，
这是原生产publisher校验/持久化形成的关系，不是正文里手写Artifact ID。

**方法Artifact先于比较Artifact成立，未见结果时先形成方法不成立。** 方法自己声明已接触
executor报告；实际Opportunity GET也早于方法发布。方法的opportunity项写“Deferred to
comparison”，不能据此倒置真实GET顺序或认定没有先前实际值曝光。
它形成了可审查公式并重新读取源，但无法区分独立推导与先见正确解释后的确认。
两臂均只出现executor、verifier各一次initial dispatch，没有真实continuation、
Mission resume或金额纠正。新的改判/保留旧方法机制尚未受行为检验。

## 出站输入证据与边界

| 已登记片段 | B1匹配请求数 | T1匹配请求数 | 实际位置与含义 |
| --- | ---: | ---: | --- |
| verifier标题 | 18 | 25 | `/instructions` |
| 原逐项计算要求 | 18 | 25 | 原规则随角色输入出现，不代表被正确执行 |
| 新方法交接要求 | 0 | 25 | T1 `/instructions`；支持干预实际投影 |
| 新比较发布要求 | 0 | 25 | T1 `/instructions` |
| 原邮件base不变片段 | 19 | 19 | `/input/.../output`中出现，支持片段已发送，不证明理解 |

这些是原审计器观察的真实出站JSON位置。`role=null`表示该位置无邻近标准role字段，
不表示缺系统指令；这里明确位于Responses风格`instructions`。没有重建或保存完整wire，
不能只凭匹配次数判定模型理解或全部上下文相同。两臂原任务/派单措辞、Goal选择与
executor读取轨迹也不同，不能假装已固定所有前置条件。

## 请求、tokens、Tool与时长

所有请求为流式`openai/gpt-5.6-luna`且HTTP200。以下请求/usage覆盖本轮隔离runtime，
包括真实preflight和内部memory等调用；时长为Inspect单episode的原`total_time`，不含
启动/清理间隔。全Tool为原`tool_part_request`计数，官方Tool为原官方事件数，二者不可混用。

| 指标 | B1 | T1 |
| --- | ---: | ---: |
| 实际Provider请求 / usage记录 | 79 / 79 | 78 / 78 |
| 数量缺口 | 0 | 0 |
| input tokens | 472,109 | 400,516 |
| output tokens | 14,190 | 15,036 |
| reasoning tokens | 2,111 | 2,726 |
| cache-read tokens | 2,337,792 | 2,309,376 |
| cache-write tokens | 0 | 0 |
| 原usage total tokens | 2,826,202 | 2,727,654 |
| 官方Tool / 全Tool请求 | 27 / 71 | 32 / 70 |
| Inspect时长（秒） | 534.622 | 626.884 |
| verifier usage次数 / total tokens | 18 / 490,273 | 25 / 946,978 |

合计157请求、157条usage、5,553,856 tokens、59官方Tool、141条全Tool请求。
记录数量相同不等于外部账单逐条对账；原`cost_usd=0`只是本地计价记录，不是免费。
T1 verifier用量增加，而其它角色用量不同导致全量tokens稍低，不能将总差解释为交接省钱，
也不能从此对照分离新增产物的纯边际成本。

## 收尾、证据和后续决定

controller于11:35:10.971结束。两host都stopped，cleanup为零活动；11:44 UTC重新核对
controller/host/Inspect自有进程均退出，auth/models复制件实际删除，未刷新凭据。
完整原始证据仍为`he-01/B1`和`he-01/T1`各自的`.eval`、SQLite、Provider审计与日志，全部只读。
派生读取不启动产品runtime，不迁移/重置旧DB，也不重新调用评分器。

以下路径相对`.tmp/supervision-causal-20260925/he-01/`：

- `freeze.json`、`controller.json`：原共同运行身份、输入、结果及cleanup。
- `audit/B1-final-chain.json`、`audit/T1-final-chain.json`：从原eval及SQLite `mode=ro/query_only`
  读取的官方事件、世界、原分、真实请求/participant/Artifact/usage/输入探针。
- `audit/pair-summary.json`：上述字段的只读汇总；`audit/closure.json`：进程/凭据核对。
- `audit/T1-initial-method-handoff.json`、`audit/T1-first-mutation-receipt.json`：运行中早期观察，
  其中“评分尚未结束”是当时事实；最终结果以原eval为准，不回写早期记录。

保留`.14`为开发交接实现，**不将它选为已证更优父代或已修复可靠纠错**。
本次自然运行无法识别H-E的纠错效果，按预登记关闭这两个episode，不同义改写后重抽。
整体目标仍未完成。后续若继续检验纠错，必须先解决“两个待验对象不同”的设计限制：
审查能否通过真实、明确归属的只读交接固定同一自然错误及允许来源，而不复活旧Task、
篡改官方世界、伪造producer消息或向模型泄露正确答案。未得到合法可执行设计前，不新增
模型或随机世界；不能继续用更多随机分数代替这项识别问题。
