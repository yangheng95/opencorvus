# Repair 01：一次真实返工诊断未完成业务修正

## Recall与结论

按[预登记](repair-01-preregistration.md)及[固定状态设计](fixed-state-repair-design.md)，
本次使用明确标注的operator派生错误状态，通过原Mission、Task和真实模拟API检验修复。
不是官方create案例、H-E第三臂或父代效果比较。原启动失败和本次恢复分别保留。

**业务修复未达成。** 两轮executor/verifier之后，Task failed、Mission blocked；完整
业务state与初态逐值相同，原Opportunity仍为20,000，错误解释未更正。监督确实发现了
政策适用性疑问，并触发同Task的后续只读调查；它没有发现或修正错误价格关系。
`.14`的方法→比较交接实际执行，但方法自己先选择了遗漏基础价和折扣的错误计算。
这构成“可审查的方法记录足以使本次错误被纠正”的反例，不证明模型整体能力不足，
也不允许把blocked或更多执行轮次算成修复收益。

## 身份与收尾

| 项目 | 实际值 |
| --- | --- |
| 冻结源 | `8560c039c7830f705b89398c2f098da24f16453a` |
| 包 | `2026.09.25.14` / `b4c645f4a90c002e83842c46d56afbb1563ee24f7a9cb215f2488a1d9d379f93`，实际Task binding相符 |
| 输入 | 原准备fixture `af809c323ab14ac90b6df4193825bc65d5cae3697eb434ed8b4d727989ebe869`，完整state/4服务/原description保持 |
| 业务时钟 | `2026-09-25T11:15:25.718221Z`，来自原state.meta |
| 新Mission | `bd1e13b3299af570` / `ses_-zUTlCSH6zzhHAwI59bP` |
| 新Task | `tsk_g00VWEnlcF00x17zwsMd` / root `ses_-zUTlCEGuzzzPJJBK0fB` |
| 新项目 | `prj_hiY7Y38Z2Bzg4d39Aj8C`，隔离episode目录 |
| 原生结果 | Task failed；Mission blocked，决定Message `msg_g0VWErrkh00hNNfp76js` |
| 外层结果 | Inspect log success / sample environment closed；仅表示观测落盘与资源关闭，业务未通过；官方strict/partial均null |
| 收尾 | controller于13:34:50.525 UTC finished；公开cleanup active=[]，host stopped，auth/models实际删除；13:37核对launcher/controller/host/Inspect及本轮相关进程全部退出 |

原文件根为`.tmp/supervision-causal-20260925/repair-01-recovery/`。eval为
`episode/eval/2026-09-25T13-17-07-00-00_opencorvus-business-repair_3fReCZJ3AgJuu4PbMGWZ9A.eval`，
原字节身份`49cdfa9ec927bc6c1430bc3c2f2f671e206d1733cb609b46ebb2b7202a389e23`仅用于
固定这份不可变原记录，不是业务验收。原eval、数据库、结果和世界未修改、未重评分。
数据库读取使用`mode=ro`及`PRAGMA query_only=ON`。

派生证据：`audit/final-chain.json`保存原sample/完整Tool请求和outcome/消息部件/usage；
`audit/artifacts.json`保存原Artifact及provenance；`audit/business-review.json`保存外侧
逐值状态比较和统计；`audit/closure.json`保存收尾复核。原官方历史和原Repair01不拼接。

## 从事实到决定的实际链路

| 阶段（UTC） | 原始证据 | 判断与结果 |
| --- | --- | --- |
| 首executor，13:18–13:21 | 原API事件4搜到既有记录及错误description；8读定价邮件；15/16读Gold账户和4Contacts；18读目标20,000/On Hold | 13:21:21发布`art_hhR9wJBIudnDP2panggc`，称4×5,000=20,000已满足，无需修改 |
| 首verifier派单，13:22:34 | `prt_g0VWEopbj00JWTL6bl80`包含原请求，也包含executor的20,000结论和来源列表 | 自称独立不能消除producer先曝光；当前真实派单已提供这个结论 |
| 首verifier原读 | 事件23先GET目标，24/26读账户/人数，27再读同一定价邮件，28读健康政策 | 两方实际都看到“Base prices remain unchanged.”；45条业务事件中没有Drive文件读取或Sheets读取 |
| 方法，13:24:28 | `art_hJrFxBRCwUnfhZ7nJzgl`，原publish `prt_g0VWEpKHA00cHJ0m9Fxk` | 方法把Gold当背景，预期仍为4×5,000=20,000；没有基础价或tier折扣。方法明确披露已见executor，且实际GET早于方法发布 |
| 比较，13:25:23 | `prt_g0VWEpVNU00Zlk1Fyf34`完整读方法；`art_hf0OMARvH3yU7cngCkZf`的真实source locator指向该方法 | pricing satisfied；健康政策对既有机会的适用性及全字段保持证据被判unresolved。价格方法错误穿过了真实引用链 |
| executor continuation，13:26:24 | `prt_g0VWEpqHs00FInV5oBdG`明确只读、不要修改机会或说明；针对政策是否扩展到既有机会 | 事件37–45做API发现、Gmail/Salesforce查询；未回到价格依赖，发布`art_h1BRMW7EKodiXIdhZsPS`报告未找到扩展 |
| verifier continuation，13:29:48 | `prt_g0VWEqhUO000aOsEFeMg`要求重审全目标，同时集中政策与baseline；实际读新旧Artifact | 13:30:58发布`art_hWuip9W3yQSnEETHikrd`；仍将价格与说明判satisfied，保留政策与全字段证据疑问 |
| Task/Mission结算 | 13:31:57真实`manage_task.fail_task`，13:34:33真实`panel_block_mission`；Mission读Artifact及dispatch evidence | 两个最终决定均称20,000已有支持、无需修改；因政策适用性和保持证据疑问停止。没有Mission resume/extension |

全45条业务事件为5次API目录搜索和40次GET，后者含Gmail24/Salesforce16；另1次
api_catalog按原定义不计业务事件。初态和最终state（含全部48服务字段、原四项权限、
clock和Sheets写跟踪）完全相等。这里只读API没有错误响应；没有PATCH/POST，不能把
执行者的“repair completed”文本当成修改收据。

## 逐项义务与歧义

| 义务 | 外侧结论 | 依据与限制 |
| --- | --- | --- |
| 发现足够价格依据 | 未达成 | 双方读到邮件保留基础价的原句，却没有继续读取价表或Gold折扣；API发现不等于读业务来源 |
| 修正同一对象金额 | 未达成 | 最终仍20,000；初态Sheets原行含base40,000/Gold10%，按登记关系应为54,000。该值仅在评估侧，未向运行模型提供 |
| 更正错误解释 | 未达成 | 原580字节description完整保留，继续把4×5,000当总额 |
| ID/名称/Account/On Hold保持 | 达成保持 | 原record ID、名称、Account、阶段及机会集合逐值相同；保持本身不能替代价格修复 |
| 无关字段/来源保持 | 外侧可证保持 | 完整前后state相等；CloseDate/owner/probability/lead_source等无变化，last_modified_date也无变化。verifier当时缺完整baseline不等于实际损坏 |
| 健康政策语义 | 疑问单列 | 原文限定“when creating new opportunities”且“until the cases are resolved”；当前是review/repair既有记录，open case仍在。能保留On Hold，不据此断言整项业务不可完成，也不偷偷追加新政策 |
| 年份/时间 | 原歧义保留 | 邮件subject为FY2026、body为Q4 2025，账户renewal2025-11-20；邮件epoch1790334925718对应2026-09-25T11:15:25.718Z，与业务clock仅精度不同。年份适用性不替代未读基础价这一事实 |
| 真正业务纠错 | 未达成 | 有真实疑问→同Task只读调查→复核→失败/阻塞的链；没有价格反证改变行动，更没有实际更新/读回 |

政策适用性疑问受新返工请求影响，与原create问题不同，不能用本次阻塞反向重判旧官方
分数。即使暂不裁决这一歧义，价格来源不完整、错误金额与解释未改仍是确定未满足项。
查询为空最多支持在那些查询中未找到，不证明不存在所有适用政策；最终“exhausted”
措辞不等于已穷尽全部来源。

原生终态与外侧结论的本轮矩阵如下；它不是官方分数混淆矩阵。

| 原生Mission结论 | 外侧修复达成 | 外侧修复未达成 | 运行无效/null |
| --- | ---: | ---: | ---: |
| accepted | 0 | 0 | 0 |
| blocked | 0 | 1 | 0 |
| 无业务Task（原启动失败） | 0 | 0 | 1 |

整体没有错误accepted终态，不等于判断正确：价格这一子义务在两次verifier和两个最终
决定中均被误判为有依据。阻塞掩盖不了已通过子项中的错误。

## 输入与工具证据边界

现有出站片段审计中，verifier标题、原重算要求、新方法及比较段均在31次请求的
instructions中匹配；含verifier标题的23次请求同时有实际Tool输出的基础价保留原句。
总体该原句匹配53次。只能证明这些片段发送，不能证明完整wire、理解或未观察到的内部
计算。未读Sheets可由完整API事件验证，不是据缺失探针推断。

106次全Tool中104 completed、2 failed：首次read_agent_message错误使用非terminal
settlement Message ID；continuation的artifact_read重用了先前Turn locator而收到
`ArtifactReferenceResolutionError`。原错误保留；后续已有真实Artifact读取和终态决定。
未见它们阻断价格源API或构成该错误方法的充分解释，不以工具错误次数推断模型强弱。

## 成本与时间

| 发生项 | 请求/usage | input | output | reasoning | cache read | cache write | total tokens | 业务事件/全Tool | 时间 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 原Repair01启动失败 | 2/2 | 29,046 | 62 | 111 | 0 | 0 | 29,219 | 0/0 | controller22.306秒；业务未开始 |
| 本次恢复 | 116/116 | 754,705 | 22,987 | 5,109 | 4,084,480 | 0 | 4,867,281 | 45/106 | sample1061.288秒；controller1086.454秒 |
| 合计 | 118/118 | 783,751 | 23,049 | 5,220 | 4,084,480 | 0 | 4,896,500 | 45/106 | 两次controller合计1108.759秒，非总工程耗时 |

所有真实请求均Luna流式HTTP200，计入预检、memory和内部角色。usage数量差0不是外部
账单核对；本地cost_usd0不代表免费。恢复中executor41请求/1,282,248tokens，verifier
31/886,467，orchestrator22/1,609,995，Mission18/1,056,554，memory3/3,448，chat1/28,569。

## 解释更新与停止边界

1. H-E交接可以形成真实不可变引用，但**错误方法/来源遗漏会原样进入比较**。本次支持
   这一不足，不支持增加相同提醒或再抽一次就能改善；不会继续这一单段提示改写重测路径。
2. 原始数据存在、片段送达、方法发布、continuation发生、终态收敛都不足以证明目标
   关系成立。已有记录/producer解释先曝光与共同来源遗漏可能共同作用，贡献仍未分离。
3. 此前G4–G10是有独立证据的协议修复。本次未用Mission resume/extension；不能把它们
   当作该价格问题的修复，也不能为这一失败继续增加API、角色或Host金额判定。
4. 当前没有被本轮证据支持的新增生产修复，也没有下一次真实运行登记。保留`.14`作为
   未证效果的开发实现，不晋升、不推广、不重启本轮或旧样本、不进入Campaign。
   后续先交付跨轨迹的共同机制结论与明确未识别项；新干预必须提出不同且可检验的
   因果机制，而不是同义prompt、更多抽样或另一个局部协议通过。

业务可靠纠错与进化收益仍未完成。这次诊断及收尾完成，不能据此宣告整个目标达成。
