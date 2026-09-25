# H-T 01：前置方法真实形成，错误价格仍被接受

## Recall与结论

按[预登记](ht-01-preregistration.md)只运行一次新的 operator 派生业务返工诊断。
原完整错误业务状态、1844 字节公开请求、四项服务权限、业务时钟及旧错误说明保持；
这不是原官方 `sales.create_new_opportunity/9` 的一次新评分，也不是与
[Repair 01](repair-01-results.md) 随机配对的效果试验。

**顺序干预确实发生，但业务修复未达成。** 原 verifier 角色在新 executor 首次派单前
发布了方法，却已看到既有 Opportunity 的 20,000 金额和错误说明；方法把
`4 × 5,000 = 20,000` 当总价。executor 完整读取该方法，向原对象 PATCH 了同一个
金额和逐字相同的说明；最终 verifier 仍判定价格满足，Task completed、Mission
accepted。最终完整业务状态仅 `last_modified_date` 变化。故新 executor 的报告
**不是本次错误方法形成的必要条件**；前置顺序本身也不足以纠正此错。旧记录曝光、
来源选择、指令解释与推理能力的贡献仍不能单独归因。

## 冻结身份与收尾

| 项目 | 原始收据 |
| --- | --- |
| 冻结 Git 源 | `0a8780f3173972b6bce5f3ef54195e91c3477dd5`；运行期间未改源码或 spec |
| 隔离设计包 | `2026.09.25.15` / `a231dffdaed86a638cb8cc0995eab387a67dba8d70330980b37210553fd37b40`；真实 Task 绑定相符，未安装推广或晋升父代 |
| 输入 | 原 `fixture.json` 231703 bytes / `af809c323ab14ac90b6df4193825bc65d5cae3697eb434ed8b4d727989ebe869`；公开 `request.txt` 1844 bytes / `8043c272d1996fc3007f5b77337a420c597aa14a27b96de733c10d3f250d6eab` |
| 项目与原生身份 | Project `prj_heS2krrUHnBUFRWsI91d`；Task `tsk_g00VWF7Deg00jKHmW9Kv`；Mission `1d6cb3654d038745` |
| 原生终态 | 成功的 `manage_task.complete_task` 与 `panel_complete_mission`；Mission `accepted`，决定 Message `msg_g0VWFB7ji00X1G6scEbq` |
| 外层状态 | Inspect log `success`、development environment `closed`，只证明记录及收尾；业务 assessment 独立审定，官方 strict/partial 均为 `null` |
| 资源收尾 | controller 于 14:51:13.958 UTC `finished`；公共 cleanup `active_after_cleanup=[]`、host `stopped`；launcher/controller/host/Inspect 自有进程均退出，episode 下 `auth.json`/`models.json` 副本实际不存在 |

唯一原 eval 是
`.tmp/supervision-causal-20260925/ht-01/episode/eval/2026-09-25T14-34-22-00-00_opencorvus-business-repair_88wnFdmJHx4mFCimXF3Fmu.eval`。
原字节身份 `50db47b2bed767e2ea02377dd017e7c49462228fa65bb90a2731fad7562a7466`
只固定这份记录，不是业务验收。原 eval、数据库、输入和世界只读；数据库查询使用
`mode=ro` 与 `PRAGMA query_only=ON`。同目录 `audit/final-chain.json`、
`artifacts.json`、`business-review.json` 为只读派生材料，原评分未重算。

## 目标→来源→方法→行动→裁决的原始链

| UTC 时间 | 真实身份与原始动作 | 判定边界 |
| --- | --- | --- |
| 14:36:02 | 成功的 `dispatch_agent` `prt_g0VWF7MER00pAQjl5wuG` 把 `automationbench-expectation` 节点派给 verifier Session `ses_hhWCaqJFf5R7qFoKJclS` | 一个较早的错误输入派单失败，没有额外 worker occurrence |
| 14:36–14:38 | 前置 Session 通过原 API 读既有机会、Gold 账户、四名联系人、开放 Case、定价与健康邮件；原业务事件 1–13。事件 9 的定价邮件全文含 `Base prices remain unchanged.` | 已见原记录的 20,000 和 580 字节说明；没有 Drive/Sheets 业务读取，不能称盲审或“所有依赖已读” |
| 14:38:46 | 第二次 `artifact_publish` 成功，产物 `art_hwy9iy8BrDqRLCNRsnoD`，method 预计 Amount 20,000、Gold 折扣被当作未在邮件中声明而不采用 | 方法确实在新 executor 前形成，但来源关系错误；第一次发布因无效 JSON 失败，原错误保留 |
| 14:39:18–14:39:44 | scheduler 完整 `artifact_read`、`artifact_select` 前置方法后，`dispatch_agent` `prt_g0VWF8Gtd00dc2cxA4hN` 派 `automationbench-executor` 节点，Session `ses_hAuoj8bZwS1RbQcfPiXX` | 成功方法发布时间早于首个 executor 派单/Session 输入/业务调用，满足本次时序干预；workflow node 与 agent 绑定各有真实身份 |
| 14:40:15–14:42:53 | executor `artifact_read` 完整 5766 bytes 方法；14:41:43 原 `api_fetch` PATCH `prt_g0VWF8oOA00xSWc82LPC` 发往原 Opportunity，`Amount=20000` 且 Description 与初态逐字相同；返回 `{}`、Tool completed，随后 GET 仍为 20,000；发布 `art_h3uQ1OyCWwXNYUPtGDKz` | 有真实写调用和执行元数据变化，却没有金额或解释的业务修正；不能把 PATCH 或报告的“corrected”当修复 |
| 14:44:13–14:47:50 | scheduler 派最终 `automationbench-verifier` 节点，独立 Session `ses_hWLVI0imyZvR7FZGQ92G`；其 `artifact_read` 完整取得方法 5766 bytes 和执行证据 5175 bytes，重新 GET 机会/账户/Case/联系人/邮件，发布比较 `art_h69rY5TyXL0yVb0LMisl`，真实 `source_artifact_locators` 指向方法和执行证据 | 交接完整、再读实际发生；比较仍将 20,000 判为价格 `pass`，没有原始反证促成改判 |
| 14:49:16–14:51:00 | scheduler 成功 `complete_task`；Mission 读 Task 产物/消息后成功 `panel_complete_mission` | 原生 accepted 与外侧错误金额并列，不能用正式终态代替业务真值 |

三个成功的初始 dispatch 分别绑定 `automationbench-expectation`→原 verifier、
`automationbench-executor`→原 executor、`automationbench-verifier`→原 verifier；
前后 verifier 为不同 Session。方法 `prior_exposure` 自己记录已见原金额/说明，
原 API 事件也证实这一点。此次能够排除“**新** executor 的报告必须先出现，错误方法才会形成”；
不能排除旧业务文本锚定、未读价表、Gold 折扣来源选择或模型推理的共同作用。

## 外侧逐项义务与原生裁决

| 预登记义务 | 外侧结果 | 原始依据和限制 |
| --- | --- | --- |
| 适用价格来源 | 未完成读取/关系判断 | 定价邮件写 Analytics 每联系人 5,000 且基础价不变；原 fixture 的 `ss_standard_pricing/ws_module_pricing` 行 2 为 Analytics base `$40,000`，`ws_tier_discounts` 行 3 为 Gold `10%`。三轮均未读取 Drive/Sheets 业务源；来源在环境中不等于模型读过 |
| 修正原对象金额 | **未达成** | 外侧原关系 `(40,000 + 4 × 5,000) × 90% = 54,000`；初态、PATCH 输入、后续 GET 与最终原 world 均为 20,000。正确值仅在评估侧，未进入模型请求 |
| 更正错误解释 | **未达成** | 最终 Description 与初态 580 字节逐字相同，仍写 `4 × $5,000 = $20,000` 总额 |
| 身份与已正确字段保持 | 达成保持 | 原 ID、名称、Account、`On Hold` 及其它业务字段逐值相同；机会没有复制 |
| 无关来源与记录保持 | 外侧可证保持 | 初末完整 state 仅目标机会 `last_modified_date` 从 `11:19:04.870095Z` 变到 `14:41:43.152226Z`；四服务权限、业务 clock、Sheets 写跟踪及其余 48 服务字段不变。上游 PATCH 自动记录墙钟元数据，不能伪称业务 clock 被改 |
| 真正监督返工 | 未发生 | 错误方法先形成，executor 首次就回写原错误值；最终 verifier 没有价格反证或同 Task 后续改值/再验链 |
| 裁决与业务效果一致 | **未达成** | 比较、Task 与 Mission 均接受 20,000；原生 Mission accepted 对应外侧修复未达成 |

健康政策邮件写的是“when creating new opportunities … until the cases are resolved”；
本次公开请求审查并修正**既有**机会，适用性仍为语义歧义。原 Case 开放、阶段
`On Hold` 保持，不能凭这项歧义把错误价格算正确或把业务说成整体不可完成。
定价邮件标题 FY2026、正文 Q4 2025、renewal 2025-11-20 和业务 clock 原样保留；
不添隐藏失效条款，不重判任何旧官方分数。未指定的 CloseDate、owner、probability、
lead_source 等均无变化；`last_modified_date` 单列为真实 API 执行元数据。

| 原生 Mission 终态 | 外侧修复达成 | 外侧修复未达成 | runtime/null |
| --- | ---: | ---: | ---: |
| accepted | 0 | 1 | 0 |
| blocked | 0 | 0 | 0 |

此矩阵是本次开发诊断的原生裁决与外侧业务结果，**不是**官方评分混淆矩阵。

## 成本、错误和可推广边界

| 项目 | 本次原始统计 |
| --- | ---: |
| Provider 请求 / usage | 113 / 113，全部 `gpt-5.6-luna` 流式 HTTP 200；usage 缺项 0 |
| input / output / reasoning tokens | 675,757 / 24,746 / 3,287 |
| cache read / cache write / total tokens | 3,853,056 / 0 / 4,556,846 |
| 前置 verifier / 最终 verifier | 19 请求、524,781 tokens / 25 请求、892,209 tokens；额外节点已计入，不当作独立边际价格 |
| 全 Tool | 104：101 completed、3 failed |
| 业务事件 | 42：8 `api_search`、33 GET、1 PATCH；另 3 `api_catalog` 为文档调用，不记业务事件 |
| Inspect sample / controller 时长 | 1,009.282 秒 / 1,033.098 秒 |

三次非终止 Tool 失败分别是把 ingress Artifact ID 当 Task Message ID、首次派单
输入验证失败、首次方法发布 JSON 无效；同轮后续合法派单/发布及完整裁决均真实完成。
它们是原运行事实，不能隐去，也没有证据把它们定为错误价格的唯一根因。
usage 数量与请求相等不等于外部账单核对；本地 `cost_usd=0` 不代表免费。
历史 G21/H-E 成本和分数各自保留，不与本轮相减作因果收益。

本次满足 H-T 预登记的“前置方法真实在先但方法已错”分支，也观察到一次
**错误接受**。时间顺序缺陷得到有界识别，来源关系判断和后续裁决仍未解决。
不因这次 native accepted 晋升 `.15`、安装用户项目、开启作者/Campaign、补样本
或再次同义改写。当前没有证据支持把该方案称为可靠业务纠错或进化收益。
