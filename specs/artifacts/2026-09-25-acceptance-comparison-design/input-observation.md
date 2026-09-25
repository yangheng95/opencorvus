# 关系义务与实际输入观察

本产物是operator的只读诊断与观察配置，不是新的模型样本、候选或业务验收器。
对应[主记录G11](../../records/2026-09/2026-09-25-supervision-causal-iteration.md)。
原消息、世界和官方分数不变；本轮没有新模型请求。

## 新的可见区别

Cycle3的原请求和Task Goal要求依据账号规模、等级和适用定价确定机会价格。
两个真实`artifact_publish`请求展示了判断对象的变化：

| 原始证据 | 实际报告内容 | 能得出的结论 |
| --- | --- | --- |
| `prt_g0VWD4qjQ001d6Og7Htl`，`automationbench/verification-evidence` | `pricing=satisfied`，列出loyalty rate 5000与amount read-back 5000；另将account-size列为unresolved | 报告把价格更新与写入值相等当作pricing支持，完整计价仍未在报告中得到证明 |
| `prt_g0VWD50Zc00vVYjbcLeC`，executor continuation | 聚焦account-size/source coverage，并要求保持机会不变，除非新事实支持具体修正 | 修复范围保留了前次定价判断；指令仍允许有依据的更正，不能说它绝对禁止修正 |
| `prt_g0VWD5puT00r7bhWD5gq`，verifier continuation | 检查新contacts/standard sheet，同时确认机会保持不变；末句仍要求判断原请求是否全面满足 | 包含窄化关注与完整验收两种要求，可能锚定；因果贡献尚未分离 |
| `prt_g0VWD6ETd00e8wda3MsV`，`automationbench/final-verification-evidence` | 用account_size、standard_pricing_basis、latest_pricing、opportunity等行分别记录来源/字段并全部接受；完整列出base、count、discount、rate和实际amount | 各个事实存在与目标金额满足它们的关系是不同命题。报告没有给出该关系的推导/比较；不能据此断言模型内部从未运算 |

原始完整记录位于
`.tmp/supervision-causal-20260925/global-audit/cycle03-final-evidence.json`。
其official events 47–52保留了最终verifier的contacts、价表、定价邮件、政策邮件、
Account与Opportunity独立读取。这里不是根据官方0分倒推“没读”。

原Task Goal仍保留“using the account’s current size and tier plus the latest applicable
pricing updates and account health policies to determine pricing”。当前角色/core也已有
独立推导与重算要求，因此本轮没有再添加同义提示或Host金额判断。

## 观察器的真实边界

历史DB的`provider_activity_request`只有id、assistant_message_id、time_created；
WorkerTurnDescriptor的system摘要不能还原完整wire请求。新观察器复用现有
`RealProviderAudit`，按显式预登记文本定位实际出站JSON中的字符串，不保存正文。

输入为一个非空JSON数组，每项仅含`id`和`text`；见[input-probes.json](input-probes.json)。
这份清单只供审计器使用，不得附加到模型提示或作为新的业务依据。
其中目标关系来自原USER，重算片段来自`.13` verifier，base条款来自已读的原定价邮件。
它不包含operator计算结果或修复答案，也不触发新的官方请求。

已经批准并独立登记的未来隔离运行，可在原host启动环境中指定：

```powershell
$env:AUTOMATIONBENCH_FACTORIAL_INPUT_PROBES = (Resolve-Path 'specs/artifacts/2026-09-25-acceptance-comparison-design/input-probes.json').Path
```

此配置本身不启动host/模型。审计保持原精确model、stream、凭据expiry与预算约束；
调用方后续改动数组不会改写已注册的文本。默认关闭时保留原请求记录形状。

每个已观察请求可附`input_evidence`：

- `body_utf8_bytes/body_sha256`：实际出站请求体的长度与身份，不是功能分数。
- 每个probe的ID、原片段长度/身份及所有精确匹配位置；不复制正文。
- `json_pointer`：匹配所在的JSON字符串。它可能属于instructions、用户消息、
  Tool结果或Tool描述，必须根据位置解释，不能只看“匹配了”。
- `message_role/role_json_pointer`：最近的标准role字段及其位置；没有该字段则为null。
  这是实际JSON字段的观察，不能把Tool定义示例中的role字段提升为消息权限。
- `decoded_value_utf8_start`：解码后字符串内的UTF-8字节位置，**不是序列化JSON的字节位置**。
- `pointer_redacted=true`说明位置含已知凭据而被掩码，不能把掩码路径当完整原路径。

请求头与认证URL不进入证据。登记文本/ID若含原redactor已知凭据则明确拒绝配置。
摘要只用于不可变输入身份，不是业务正确性或可变源码验收。无匹配可来自合法改写、
换行/编码、不同位置或实际未包含，不能自动升级成“模型没看到语义”。
HTTP状态也不证明远端模型理解了文本。本方法只留存**已知片段**的出站证据，
没有声称保留全部wire上下文，且无法追补Cycle3。

## 接下来的可证伪问题

1. 若重算要求及必要来源在对应verifier出站输入有精确证据，而报告仍只核对输入存在，
   “该要求/来源没有进入该请求”的解释应缩小；这仍不能独自区分锚定和模型能力。
2. H-E交接方案应测试比较前真实产生的方法记录、之后明确的比较与改判引用。
   若只有两份Artifact而仍遗漏原关系或先选错方法，交接预测失败。
3. 只有差异判断导致实际同Task修正且保存原成功义务，才支持纠错闭环。
   观察器通过、输入匹配、方法文档完成都不是这个结论。

任何实际对照仍须另行冻结输入、唯一干预、生产入口、版本、目录和样本数，
并明确先验正确来源及全部失败处理。此文件没有授权或启动新世界、作者、候选、
Campaign或四十例，也不把再次得到同一个错误当成有信息的验证。
