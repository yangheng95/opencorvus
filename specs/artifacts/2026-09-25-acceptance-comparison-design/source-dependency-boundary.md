# G26：来源发现噪声与业务关系判断的边界

## Recall与问题

用户要求按全局链路定位局部失真，并继续有依据的无人值守工作；禁止把局部协议、
更多 Artifact、同义提醒、正式终态或分数当根治。[H-T01结果](ht-01-results.md)新增的
反证是：方法在新 executor 之前形成，包指令已明说后来通知称基础价未变时要读原
base 记录，但 Agent 仍只用四联系人 × 5,000，并最终错误接受。[Cycle3](../../records/2026-09/2026-09-25-supervision-causal-iteration.md)
又有双方实际读齐 base、人数、折扣和费率却仍误验收的反例。本轮只读核对现有
Agent、模拟 API（Application Programming Interface，应用程序接口）发现、Task/Mission 裁决的定义和真实收据，不改原 Tool、世界、
评分器、专家包、历史分数或消息，也不启动新模型/世界/候选。

要回答的不是“怎样让本例涨分”，而是能否在当前单一实现里指出一个同时解释
**未读来源**与**读齐仍误判**、由真实 Agent 自主执行、可证伪且不让 Host 选择业务公式的
具体修复。以下区分观察、触发点、控制流根因与未识别的认知贡献。

## 现有定义、调用与真实反证

| 边界 | 当前代码/合同与真实收据 | 允许推断 |
| --- | --- | --- |
| Tool 文档发现 | `packages/inspect-benchmark/src/opencorvus_inspect/automationbench/mcp.py` 的 `api_catalog` 从上游全部 schema 列服务；`ApiSession.call` 将 `api_search` 原样交给上游 `automationbench.tools.api.search.api_search`。该函数在**全部** schema 的 BM25（Best Matching 25，文本相关性排序）索引取前 `top_k`，不接收 `world.meta.allowed_services` | 当前发现文档不是本世界“已连接服务清单”，它可能把无权限服务排在真正相关服务前；目录结果不是业务来源读取，也不是服务已连接证明 |
| 真正 API 权限 | 上游 `api_fetch` 按 `world.meta.allowed_services` 对路由服务做 401；G17共同 API 会话保留原四服务 `gmail/google_drive/google_sheets/salesforce`，完整世界仍有48个服务字段 | 权限边界未被突破；文档全集与可执行四服务是两种不同事实。不能把 48 字段重新当授权，也不能说 Sheets 不可达 |
| H-T01 前置发现 | 前两次 `api_search` 各返回20条：第一次6条 Salesforce/14条未连接服务，第二次13条 Salesforce/7条未连接服务，均未给 Drive/Sheets 合约；Agent 后续没有发起针对 Sheets 的发现或业务读取。完整原 API 42事件保留；原 schema 明确有 `sheets.spreadsheets.values.get` | 泛查询被目录噪声稀释是可观察摩擦，但不能证明若只返回四服务，Agent必会查询Sheets、正确选择关系或修正业务 |
| Agent已见规则 | `.15` verifier 指令要求逐项列出 base/count/tier 调整，读“后来通知称未变”的 base 原记录；executor/scheduler亦要求源坐标与完整关系。G11只保留局部片段位置：44次 verifier 请求的 `/instructions` 匹配组成项规则，30次 Tool output 匹配“Base prices remain unchanged”；实际前置方法却认20,000 | 不是当前源文件完全没写这条规则，也不是业务邮件没读。片段不等于完整wire、理解或注意力；旧错误记录/说明已曝光，来源选择、锚定和推理贡献仍未分离 |
| 关系判断反例 | Cycle3两方后续读齐base40,000、4 contacts、Gold10%、每联系人5,000仍接受错误5,000；H-T01在少读Sheets时接受20,000；H-E T1 executor另一次可直接写54,000 | 即使改善目录发现，也只触及“找到来源”边界，不能充分解释或修复“读齐仍选择错方法”。一次成功不证明整体模型能力稳定，失败也不证明总体无能力 |
| 原生结算 | `CompleteTaskInputSchema`把原义务、反证与证据连接交给 Orchestrator 描述；`prepareTaskCompletionDecision`校验 Message/Artifact/工作流身份和证据引用，并不计算价格；Mission再读原Task结果自行裁决。H-T01三轮真实产物及终态是已发生的错误业务判断，而非投递/调度丢失 | Host的正确职责是身份、来源、类型和一致性。添加金额 gate、关键词路由或自动公式会转移语义责任，且不能泛化处理业务政策 |

只读派生核对保存在`.tmp/supervision-causal-20260925/ht-01/audit/source-discovery-review.json`，
包含原两次查询、实际结果服务分布、四项允许服务、42业务事件与上游 Sheets GET
合约。首次用 Inspect 的虚拟环境 Python 读取 `.eval` 时，其标准库不支持该归档压缩
格式；改用本机已有的 Python 读取同一原归档和已安装 schema 后核对通过，未修改
运行器、上游包、原 eval 或工具结果。此收据证明目录/事件事实，不是模型效果验证。

这里的共同失真是把原请求中的**完整业务关系**退化为单项更新费率所能支持的局部
充分条件。H-T01说明这个退化可在新 executor 结论之前发生；Cycle3说明原始项读齐
后它也可能持续。目录噪声是可观察的来源发现摩擦，不是跨轨迹的唯一根因。

## 当前候选的可行性裁决

| 想做的局部动作 | 为何当前不能宣称解决共同问题 |
| --- | --- |
| 再写“记得读base/折扣”或发布另一份同类方法 | 当前 executor、verifier、scheduler 已有等价且更具体的明示规则；H-T01仍选错，G21真实方法→比较也漏依赖。再次同义提示没有新的可证伪机制 |
| 将 `api_catalog/api_search` 限为四项连接服务 | 可能降低当前BM25噪声，但改变官方 Tool 文档契约，原官方 Tool/案例必须保持只读；同时Cycle3读齐仍错。即使另行授权并验证此工具改动，也只能按发现能力交付，不能声称业务根治 |
| 让 Host 根据 `Base prices remain unchanged`、金额字段或 Artifact 来源列表拦截完成 | 这是关键词/业务公式 gate，违反 Host 与 Agent 的责任边界。来源引用完整或 Tool 成功不能证明关系正确；缺少来源也不等于该业务关系必错 |
| 增加同角色再验、更多 Artifact 或 continuation | H-T01前后 verifier、完整读和真实引用均存在却误accept；G21同Task后续调查没有重开错误价格；Cycle3补齐来源后仍误验收。次数不是新独立反证 |
| 用历史官方分或本次开发 `accepted` 选择父代 | H-E两臂初始执行结果不同，本次开发没有官方分；G1 typed blocker仅局部合同。没有同源完整Campaign测量、审查与父代选择收益证据 |

因此本轮**没有**一个已有代码缺陷的局部补丁能同时负责来源选择与关系判断。
当前不实施新的 Tool/Host/提示修改，不做另一随机世界或模型检查；保留全部失败及
G4–G10/G17/G19已证实的协议修复。若将来研究目录过滤，应作为独立发现问题，
先解决官方 Tool 不可改的范围约束，再预登记跨案例正向合同和业务限制；不能借
H-T01的错误接受直接授权其修改。

可靠交付、同Task纠错与原生进化收益仍未满足。要恢复效果研究，先需要一个**不同且
可实施的信息/判断机制**，能在真实 Agent 可见数据里产生可与旧错误关系竞争的独立
反证，并在同一Task把它连接到实际修复与再验；同时必须有条件区分旧记录曝光、
来源发现和已读后方法选择。当前证据尚不能唯一指定这样的最小改动。它不是通过
新增隐藏答案、伪造参与者或 Host 语义裁决可补上的接口缺口。
