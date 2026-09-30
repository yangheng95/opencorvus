# 十条关闭 trace 的独立审计

## 审计边界与证据读法

第一版先依据锁定的 `sample.json`、十份原始 `agent/instruction.txt`、完整公开 transcript 中的真实参与者与 Tool 输入/输出/失败、业务事件、最终世界、native result 和结束观察形成判断，再查看各条 `official-score.json` 核对差异。第一版保存时尚未读父报告、父 summary 或旧 restart 调查。保存后的父报告对照与补充复核明确记录在末节及 `comparison.md`，不冒称仍是盲审结果。没有补跑、替换样本、调用模型、使用凭据或修改原件。工具查找结果只是接口文档；模型能否发现源与审计者从最终世界/官方任务实现看到源是两种事实。

以下 `M<n>` 是该条 `agent/opencorvus-transcript.json` 的一基数组位置；Message、callID、Session 是原件身份。`event <n>` 是 `verifier/automationbench-events.jsonl` 的 sequence，仅 `kind=tool` 计业务工具；score 事件不计入。各条路径均相对固定 job 根 `.tmp/harbor-factorial-20260930/jobs/harbor-factorial-runtime-a0a879ed-20260930/`。官方接口源码来自 `D:/myhexin-local/benchmark-runtime/harbor-0.23.0/Lib/site-packages/automationbench/`，只作为事后接口与原世界核对，未当成模型当时可见资料。

十条 native result 均没有 exception，terminal-summary 都是 settled，last-public-observation 的 durable_settlement.passed 都为 true，没有待执行 Session、Provider、Tool、协议或 automation。Task 的 completed/failed 与这些物理结束事实不同。下述业务缺陷不能解释为任务仍悬挂，也不证明全部生产调度机制正确。

## 独立总判断

| Case / arm | native Task | 原请求业务判断 | 审查与协调判断 | 官方 partial / correct |
| --- | --- | --- | --- | --- |
| 1 候选人 / TS | failed | 未准备/发送任何 package；tracker 有可修复发现缺口 | 发现一次缺口，但错误接受“源不存在”并询问用户 | 0 / 0 |
| 2 商机 / TE | completed | 有效修正 stage，价格仍错误 | 三方共同漏基础价和 tier 折扣，错误接受 | 0 / 0 |
| 3 QBR / MS | completed | 已发送，但错误/未证集合包含 Vanguard | 审查实际读源却未审 Churned 排除条件 | 6/7 / 0 |
| 4 Facilities / TS | failed | 所请求 create、description、Backlog 放置均已实现 | 把额外最终 GET 要求变成不可完成门槛 | 1 / 1 |
| 5 Probation / TE | completed | 已有效更正 Sarah 通知；原错误 urgent 仍在 | 正确发现延期并原 Session 修复；不能抹去旧发送 | 0.4 / 0 |
| 6 Late fees / ME | completed | 两项收费、两封 notice 正确 | 实质验算有效；遗漏原 SYSTEM 的总结约束 | 1 / 1 |
| 7 Capacity / ME | completed | 计数式 agent 再分配及全部指定产物已有真实效果 | 实际独立复核；报告保留部门总量超标，权重语义有限 | 17/18 / 0 |
| 8 Podcast / TE | failed | 指定宣传与两人邮件已有效果；执行前漏订阅表 | 后读出真表，却强求额外 opt-in 字段并错误宣称无源 | 6/7 / 0 |
| 9 Inventory / ME | completed | 选人和通知正确；due column 身份没有来源证据 | 错把自选 due_date 回执当目标字段验证 | 0.75 / 0 |
| 10 Budget / MS | completed | 最终预算及 consolidated totals 更正邮件正确 | 有效发现算错，第二次修复补正邮件；原错邮件保留 | 0.7 / 0 |

这不是四十条失败率估计。主要问题至少包括可修复源搜索、计算/排除条件、目的字段身份、审查额外义务和不可逆错误后的更正；不能归为一个单一普遍根因。

## 1. hr.candidate_submittal_docs / TS

Trial `hr-candidate-submittal-docs__dZngBD4`；Task `tsk_g00VWfNdrR00DiJmpnWv`；executor `ses_hO2qDisSuZRbQ18zmYhv`；verifier `ses_hRyGlPRvsFIXAPCJ2bip`。

原要求是读取 tracker 和近期 correspondence，按资格准备/发送 Meridian submittal，以来源原值为准，并处理 portal 特殊要求。原世界/final-world 中 `ss_submittals` 名称是 **Meridian Technologies Submittals**，有 Candidate Pipeline、Submittal Template；Elena、Marcus、Yuki 是可处理记录，Derek 已撤回，Nadia 尚未 cleared。邮件另规定 Senior subject、Rachel sole contact、Yuki 最早 April 7，以及 portal 只能由 Account Manager 提交。

执行者真实读了六封近期邮件，包含 `msg_client_format`、`msg_portal_policy`、`msg_tanaka_notice`、`msg_withdrawn`（M16、23、33、34；对应 call `call_bbR5UcP7QVHyLALSm9RURljz`、`call_MNsvGc1FwQvv0qFCsPLwRTZs`、`call_3onr1EiZjc8XFVtPYTgGKECl`、`call_0nRHV8ezEYwClCyHGaT9YrhV`）。Airtable、Recruitee、Salesforce、Trello、BambooHR 的 401 都是业务 JSON 结果，外层 Tool completed 不意味着有可读账户。初始 Drive `q="trashed = false"`（M13，`call_0QvfYRnhc0L5pV1g4G6EX9aw`）为空；没有读任何 candidate sheet；全条没有 send、draft-create 或 portal write，最终世界 drafts 与新增 sent 都空。

审查者实际重读六封邮件及上述失败源（M52–64），并检查 Gmail drafts/send 证据（M74–75），不是只重复 executor final。它指出 Sheets 未发现；协调器 M79 `call_Q9HBU6SQtiGh4IXWYk8HcbAi` 将缺口继续给**原 executor Session**，M91 `call_hCUWawcfJuNcbyIDdtjAB7Fk` 又继续给原 verifier。故同 Task 路由正确。

但恢复只试 `trashed=false + mimeType=spreadsheet` 和 `name contains 'candidate'`（M86–87，`call_v1BcT5tl55Pm1MYXj73RMqp6`、`call_vDuC7mzIz3LUUmWCutkDvX74`）；后者不匹配真实 workbook 标题。没有无过滤 `q=null/""` 或最小原请求锚点 `name contains 'Meridian'`。verifier M98–99 又重复同两查询后宣称覆盖已闭合。官方 `tools/api/impl/google_drive.py:23–46,96–178` 明确把 Sheets 纳入 files.list，但只解析 name equality/contains；`trashed=false` 和 MIME-only 查询落入标题字串比较而假空。**接口查询语义局限与三方未用更简单锚点共同成立**，不是“tracker 根本不存在/必须外接”。其他五系统 401 无法排除已有 Sheets。

M118 `call_yydHM0zTSLupbamuQapoTDwG` 询问 tracker access，直接违反原 SYSTEM “Do not ask clarifying questions”；deadline 后 `call_YocgB4de0d6Q1slUs1kN04J5` fail_task。真实业务未完成，失败判决并非虚假成功，但 force-majeure 根因错误且一轮返工没有治根。门户政策的遵守有源依据，不能把不访问 portal 当故障；准备 package/Account Manager handoff 则未做到。官方 0 与无 package 相符；其额外要求更新 Derek tracker 状态不是原请求明确授权的必需交付，不能据 gold 反向增加义务。

## 2. sales.create_new_opportunity / TE

Trial `sales-create-new-opportunity__wNNhgiX`；Task `tsk_g00VWfSkjz006dIf9kvv`；executor `ses_hKxLFT2N5oHe306ihsyO`；verifier `ses_h199bryreWhCSDVN4SjA`。

要求 Summit Analytics 商机按 account size、tier、最新 pricing 和 health policy 定价。原世界/final-world 的 Standard Pricing（`ss_standard_pricing/ws_module_pricing`）给 Analytics 基础价 `$40,000`，Tier Discounts 给 Gold `10%`；账户有四个 Contact、Q4-2025 renewal、Open/High case；邮件更新 per-contact 到 `$5,000` 并明确 **“Base prices remain unchanged.”** 合成应为 `(40,000 + 4×5,000)×0.9 = 54,000`，stage On Hold。

执行者读了正确账户、case，却只 Gmail 搜 Summit Industries 和 Drive 搜 Summit/trashed=false，没有 pricing policy 邮件或 Sheets 基价/discount；其它 ContentNote/Product2/PricingUpdate__c unsupported 不能证明定价无源。M39 `call_UhilYAkMw3coLISj42jgsgtT`（event33）以无关 Gold 平台 benchmark 猜 `$60,000`，Prospecting；M40 exact-ID GET 确认真实错误写入。它把源不可得当猜数授权，违背自己的 prereq prompt。

verifier M64 简化跨实体 Gmail 搜索后真实读到 pricing（M65 `call_yfBmbrG26pohdLM95aCYs6wr`）和 health policy（M69 `call_uGJlXPhXyBxJugh4HyEQkSk1`）；M76 阻止接受，M78 `call_tcjkVcoqEvN8JGjZNYXTYVFP` 回原 Session 修复。修复读 Contact（LIMIT1000 被真实查询契约拒绝，改200成功），event62/M90 `call_yt2CnhQxdBTFwJTd7EMyOiFE` 写 `$20,000`、On Hold；event64/M92 `call_H88KfOLrBqPeAcAfHCupMV1L` 改 description 并 readback。stage 纠错有效，价格错误仍在。

审查 M71 方法 `call_vcTVui0pqJS95XwZFxGJ96Zz` 已把 pricing expectation 定义成“rate multiplied by count”，没有把邮件的 unchanged base 列为 unknown，也没应用 tier 折扣。M112 修订方法 `call_r2Q5Yzt3rxJNP3kHk0iRfUYP` 再固定“4×$5,000=$20,000”；M115 comparison `call_wd9cwDuGgrFthv1DRangPGkU` 判 satisfied，M118 `call_ujqkIzMRW79SRmnQKschQiZS` completed。root M97 handoff还指定 `$20,000` 为验收候选数值，不过 reviewer 自己第一方法已经同样漏项，不能把错误唯一归因为 root 候选答案污染。

没有查 Standard Pricing，也没有用 Drive 最小 `pricing` 锚点；空 Drive 查询受同一接口局限影响，但“base unchanged”这条已真实可见反证被忽略。最终 opportunity 保留 `$20,000`、On Hold。官方 0/0 的54,000与业务源可独立推导一致。结论是**真修复 + 漏项错误接受**，不是调度丢失修复或没有实际复核。

## 3. sales.unreliable_label_account_review / MS

Trial `sales-unreliable-label-account-r__ma8SJBf`；Task `tsk_g00VWfXMjk00YWHTFeu9`；executor `ses_hmyeXUnAeQNIrVmUNKHc`；verifier `ses_hG1QLT5OKVUfpe3lN1bk`。

要求以 Health Criteria 和 Activity Log 判 QBR 真风险，只发 at-risk，含 relevant amounts。sheet 既有 inactivity/value-decline 的 OR 规则，也有 **Churned = expired/cancelled；Exclude from QBR**。NovaTech、Stratos 符合风险；Vanguard Activity 为空且 Salesforce `health_status=Churned`。标签陈旧要求独立查事实，既不能单信该标签，也不能因此省略整个 churn 排除问题。

executor M22 `call_CTJObhD6DQrg3Y6rmgjzyjkl` 读全规则；M42 `call_kG4HClag8HGMgLT73GSlFwru` 读六行 Activity；M23 `call_FFmZwDztMA6r0LoYxwmqLl1C` 的 Salesforce projection 只选 AnnualRevenue/Type等，没选 HealthStatus/contract cancellation。它把空日期当 risk 的足够条件，把 Vanguard 加进去并用 `$900,000` AnnualRevenue 补缺失 contract amounts。第一个 raw send event25 因非ASCII subject 422，event27/M47 成功，Gmail `7108d7acb1dd4792` 确实 SENT，final-world 身份与原文一致。

verifier M63–66 真正重读 Criteria、Activity、Salesforce projection、sent message（`call_55MwIwWnMm3Km7pgXHhvfRe0`、`call_76tLxUQ6u7bVttcw4bh3mj8o`、`call_z2l5AdGR34BAUbLrSzBjj1vn`、`call_od7QHoZ8uZkyhQXIDMEmJmdn`），但仍没读/核对 churn 字段、expired/cancelled来源。M67 方法 `call_0SURYAUTTnDAQdBO6f8pufSr` 记下Churned定义却 expectation固定三个risk、unknowns=[]；M79 verdict accepted，M81 `call_JZL5GDUM7UDKBbgLs0mLm4AX` completed，Mission读canonical后接受。没有进入业务返工。

这不是只看worker summary；是两次实际分析均漏排除分支。原公共数据可以证明排除问题未检查，最终世界及官方任务 `domains/sales/tasks.py:30902–30920` 进一步确认Vanguard原样本设计为Churned排除。**隐藏解释不是模型当时可见证据**，故独立业务判断应表述为错误/未证集合接受，而不能说模型读过真实取消证明后违抗。官方6/7唯一缺口是Vanguard；与集合错误相符。

邮件尾句“Non-risk accounts are intentionally omitted.”、executor M53/审查 M79和Task摘要列出未acted-on三人，违反原SYSTEM只总结acted-on；Health Criteria要求不把Churned纳QBR，没有要求向客户或全局报告列排除清单。Mission `panel_complete_mission` 一次引用不覆盖当前occurrence报错（M89 `call_cV7AvwO61ulWLyBGMkKKggj2`），后用canonical complete读集解决；这是证据引用修复，非业务纠错。

## 4. operations.sheets_asana_approved_request / TS

Trial `operations-sheets-asana-approved__6pRbRm5`；Task `tsk_g00VWfZD3h00dKbr08i3`；executor `ses_hfKQtj7acnP93aGboL8X`；verifier `ses_hXzd5VJlQJOEbW70wCse`。

原要求先看全部政策/Notes/成本流程阈值，选最urgent eligible facilities，create到Facilities/Backlog，due2026-02-10，description含原requested date、cost、是否email reapproval。executor M12 `call_ughOK8xYfUwgqHa7s3V4Jwu0` 同时读Requests/Processing Policy；M15 `call_5rHal9e6emvmotmHUuezQ8Fh` 读row4 reapproval；M16取消HVAC、M18 safety scheduling没有signoff。成本minimum200、准确Facilities、去重/hold/cancel等处理有直接源。选row4 lobby plants、800、2026-01-22有充分证据。

M27 `call_7cYK4DTxLfkNQaTZp32bpuRo`（event20）create返回完整同步task字段；M28 `call_3IX0OEL5UTKlxML1cviKPyUY`（event21）addTask成功。最终世界 `asana.actions.create_task` 和 `add_task_to_section` 各一条，保存准确cost/date/reapproval及project/section；没有额外create。业务交付已实现。

verifier用原source causal receipts检查，但 evidence读一次总量超30,000、一次把part ID当Message ID报错（M33、35），之后实际读到全规则/邮件。它M39 `call_UWPWufTCXEogeyOrVubuttHZ`、M40 `call_hgIydsqlzyYor3ahp7uWL8ae` 试未实现GET，404；M52认creation/description satisfied-at-commit，却把final membership/fields判unresolved。

M54 continuation第一次input=null schema拒绝后 `call_WkQ5Lx3PG0vAKFE9z7MdFAVD` 正确回原Session；executor M60 `call_Y8E7QTiu4IwTQT1dFPV1MsDu` 只读section，确认catalog没有task-get。root M63继续原verifier，M67仍不接受；M69 `call_xIYQyWlMATLHkgyf4E9hVXDc` fail_task，理由只是无法独立最终GET。冻结static verifier prompt明确完整同步回执证明commit字段，non-reflecting query不可抹去；原用户也未要求额外后来GET。因此这里是**接口readback局限 + 过强审查造成失败终态/冗余返工**。不是合法mutation没执行，也不是发现实际业务差异。官方1/1仅作佐证，动作记录/回执已经独立证明完成。

## 5. hr.probation_review_reminder / TE

Trial `hr-probation-review-reminder__XDdPgDs`；Task `tsk_g00VWfdkXO00EqIWEGXr`；executor `ses_hTOVjoChB4iDsi1J202b`；verifier `ses_hIewhVPbcZbGzcdwVHBz`。

原要求latest policy、approaching/overdue经理提醒、days、urgent，仅原值。policy `msg_probation_policy` 明确90days、within30days、已过date才urgent，并要求查manager communication的批准延期。Hire sheet Sarah12/1、Marcus1/15、Frank completed、Aisha2/20。Sarah Slack批准120days，适用date3/31、remaining16；Marcus4/15、remaining31，在书面30day window之外。

executor M17 `call_gG1U3CfIuWJQCjOdFvhEMULj` 已读manager-channel要求，但仅查两次Gmail（M20 `call_OgcP53dqTZvyv6huyCJUwcZ8`、M21 `call_POLUZQ9NSWzCocM0G1fInfUR`）；其中第二返回policy，M24仍自述“两查询都无消息”。没有初始Slack读；M23 `call_JRmxfKzImumnJNjGtga2NOrA`（event17）真实发Sarah urgent14days，Gmail `034639d2420342dc`。

verifier M40 `call_SM3vuwY5VDewKCCyFG71Fxcu` 查Slack probation，实际得到David批准120days原文；M41读错误邮件；M51 failed并给最小nonurgent correction。root M53 `call_uAE4nfuCwnneyMypyB2ESl0a` 回同executor，后者复合Slack零命中后简单名字成功（M58–59），M60–61重读policy/source，M65 `call_S2BlVrp0dFsuPntKTx6AI2xU`（event36）发更正 `4de2d6582ad4471b`，M66 readback准确。root M69继续原verifier，M76–79独立重读policy/sheet/Slack/newmail，M83 accepted、M85 `call_ViiC6u8Ca6QgHHl8jat81hdh` completed。

这是**有效纠错链**，且前置源覆盖漏项已造成不可逆错误通知。最终世界同时保留两封SENT，更正不能撤回已送达urgent。root continuation给出120days/16days候选结果，但来自审查先独立读出的事实且executor、verifier都重新读源，不能当无源答案灌入。

原分0.4有两类原因：urgent历史邮件仍在（真实残留）；gold另外要求Marcus31days/April15通知，却源policy说within30days，`domains/hr/tasks.py:2338`甚至注释“within30days,31daysremaining”，自身边界矛盾。故**不把Marcus未通知认作已证业务漏人**，也不以0.4否定更正有效。原SYSTEM总结约束在verifier排除列表仍有遗漏；不会因此否定正确manager correction。

## 6. finance.late_fee_calculation / ME

Trial `finance-late-fee-calculation__9Z2HtmH`；Task `tsk_g00VWfh92300d5oS9dxs`；executor `ses_hDEvMYqpfov7WCUfp2e2`；verifier `ses_hbCXLx1ONbfb0qcKgA6E`。

原请求fee policy、tracker更新和各customer notice包含原balance、fee、新total。policy M26 `call_y6kq71gviSI1pa69tGV77KdJ` 原文为1–30days1.5%、31–60days3%、61+5%，VIP waive、under500 no fee、roundnearestcent，**没有要求发布排除通知/报告**。最初Drive trashed=false为空；executor没有就此停下，M44 `call_NOFHfBUUzxp4mPGPYm5kFF9o` 改最小invoice name找到ss_overdue，M46读四invoice/Notes。

M47 `call_HocyZIdg3FjMcUvnboGPUCoF`（event25）只写F2:F3：8,000×1.5%=120.00（21days）；22,500×5%=1,125.00（62days）。M50、51（event28、29）只发Nova/Meridian，Gmail `dc21b52f74ca45b0`、`47d6e05bcb9f48a7`；M52、55、56读回余额/fee/total分别8,000/120/8,120、22,500/1,125/23,625，金额source字符串原样。

verifier M74 `call_p8ASzXxEmb5TrbDtMpIYQkZI` 重读tracker，M77 `call_SKuraNkSvn8797d2J7QbOX0i` 重读policy，M79–80读两exact-mail，M82 sentsearch只有两项；M83发布derivedmethod、M86发布comparison，M89 PASS。M91 `call_xoNeMWShSVs4ukjl50wnDGTJ` Taskcompleted，Mission再次读canonical并accepted。没有业务返工需求；官方1/1与实质行为一致。

仍有明确原SYSTEM遗漏：executor final M63 `msg_g0VWfibHK00RWnE3IYsx` 单列 **“Excluded under-$500 INV-9003 and VIP INV-9004.”**，root completion M91也列两未acted-on invoice。policy只要求waive/nocharge，不要求排除说明，原用户没有排除notice义务，故不存在SYSTEM exception的源。验证方法为了推导eligible set记录排除事实有必要，不能仅凭方法有excluded字段判违规；**这里指的是这些明确总结工作/Task completion文字**。verifier说all original criteria/no discrepancies，却没查这条真实约束。其fee/notice验算仍有效。executor final“independently verified”在verifier启动之前，只证明自我readback，不能作为当时独立审查事实。

## 7. support.zoho_desk_capacity_planning / ME

Trial `support-zoho-desk-capacity-plann__mktozwA`；Task `tsk_g00VWfknyR00eLtBQhmM`；executor `ses_h0jiBtindBq2TPEnXhTT`；verifier `ses_hoKXESCwpeCAT2PgnvXb`。

要求读明确给出的roster/benchmarks，agent overload再分配，每moved ticket internal redistributed，报告用Agent_ID，Gmail email subject capacity，Slacksummary。executor M23 `call_oU7w3pkEGerDShuNurU1L8rt` 真读6agent与3dept benchmarks；M24 `call_aDIfx25DQ4HThUKsp2nkaGN9` 全ticket集合15open，A1=5/max3、A2=2/max4。Engineeringcount7/maxdept6；billing3、onboard5。

event16–19/M31–34只把cap_t3、cap_t5从a1到a2，分别 internal redistributed comment，原calls `call_KJFwiyHvzp7YZs0tsU486lIr`、`call_wg6e5BifLhcRqh5RO9ZBbCBp`、`call_bFjPfZ2xuzC2PYKSZu9X96eZ`、`call_ndjMjQjqchnOlUro7Uqmxgg1`。event20/M35报告3rows using IDs；event23/M42 Gmail dfe63f12600e4bb0、event24/M43 Slack C_CAP。初始ticket query cap_t3为空但转无filter集合read成功，正确保留read契约区别；M46、47、48、49 readback effects全部在。

verifier M66–70独立batchsheets、全tickets、exactmail、Slackhistory，不用emptycap_t3推翻commit。M79方法marker typo redistribued自行修订，M85 comparison再做，M86 ACCEPT；root M88 `call_S8BmArjk3ZL1OMYkwiEwOzIB`completed，Mission读canonical后accepted。没有外部业务返工；方法拼写更正是有效审查记录修复。

真实final A1count3、A2count4，满足明确Max_Tickets计数；deptEngineering仍7>6，因此报告“Rebalanced”仅能表示agent平衡，不能证明部门总容量问题已消失。benchmark还有Priority_Weight，但原字段叫Max_Tickets、任务没有明定weighted阈值算法；三方未解释权重，仅用priority挑move。保留这一语义限制，不从weights擅自增加host接受标准。email recipient未给，executor合理假设capacity-planning@company.com并公开说明，与禁止clarification约束相容。

官方17/18唯一非excluded失败是Slack缺字面 **“overload”**；真实Slack明确“Engineering was over capacity (7 tickets vs department limit6)”和move，业务语义已表达，不把keyword失败当遗漏通知或无容量分析。官方任务 `domains/support/tasks.py:51733–51734` 用未加权ticket count描述A1overloaded，亦支持计数解释。pre-owner历史可在原M24全集合和mutationcalls证明，当前集合没有历史字段只是接口局限，不能要求改写原世界。

## 8. marketing.podcast_episode_promotion / TE

Trial `marketing-podcast-episode-promot__qEHVrUF`；Task `tsk_g00VWfmSev00WZEh639x`；executor `ses_h7odjNZY3MULfaEvf2Eb`；verifier `ses_hOwFFrH5z6xMWuzwoDAm`。

要求ss_podcast新集、social-posts、订阅名单中的podcast subscribers，显式给listener/regular，promotion含guest/keytopic原文。M10 `call_XaMg99ZNpkJQ8poDzEtonvk9` 真读所有episodes/notes；42可promote，43embargo、44revoked不能仅看Published。guest/topic正确。executor没找到subscriber，因为Drive只查trashed=false、猜ss_subscribers、其它401，没做subscriber最小标题search；却M34说显式两addresses actionable并send。event26/M32 Slack `1790741146.759920`；event28/M34 Gmail `60411e7616d0492c`，M35–36实际读回。

verifier M50 `call_0rZofmkc0g3FkdHml2sno8WG` 用namecontains subscriber立刻找到 **ss_subs Podcast Subscribers**；M52 `call_oqwmBqRLKIMt0v8Y0igqgs5H` 实读名单有两指定地址和subscribed_date、blanknotes，第三bounced禁止send。M55–56查真post/mail。此前executor source coverage不充分，这是可证的前置缺口，而实际两人选择与真表相符。

但M58方法 `call_iYwJoBprDAVEv8XdqNOdRfCz`、M63 verdict另要求 **单独podcast_updates opt-in字段**。原用户未指定schema，名单标题/subscribed_date/显式收件人与可合理假设已是语义证据；缺专属boolean字段不等于没有订阅来源。M65连续两次schema调用错误后 `call_0HKGqBTNZAStOp7vq10pbYI9` 才回原Session，却要求exhaustive找explicitfield。executor M81又宣称Driveempty/ss_subscribers不存在，**没有继承verifier已读ss_subs真源**；未读ss_subs作为本轮source，只扩401系统。root M83直接称audit conclusive；verifier M93又读ss_subs，M101仍按额外field判UNRESOLVED；root M103 `call_ZnK7XOckun4V3sl2jg0DMbjk`fail_task。

结论为**执行前源遗漏 + 事后读源修复 + 过强schema验收/退化返工 + 业务effects保留**，不能把最终failed当没有发邮件，更不能把字面不存在字段当权限未授权的唯一事实。真explicitconsent若确实有另外来源，本trace不能证明，保留未知；没有证据足以要求额外布尔字段。官方6/7唯一content缺口是regular邮件没“Episode42”；原请求明确要求guest/topic，未明确每promotion必须episode number，不能把这个字面gold义务替代原请求。

## 9. operations.monday_slack_inventory / ME

Trial `operations-monday-slack-inventor__LAQ6UQy`；Task `tsk_g00VWfry7O00gXPqtHU1`；executor `ses_hsW6ieui2o55PfgGKutD`；verifier `ses_hADkYYKTfBi3JsQlKInq`。

原要求2026-02-19最urgent Waiting badge，Monday status InProgress、copy NeededBy到due column，ops-updates、必要时ops-alerts，原值/affected names。M20 `call_sOvLPnorFFm8PGdS1nmVX0JK` sheet含TempWorkerhold；选ContractorCritical2/6而非holdworker有正确源。M25 `call_dnVyQQiU8BTZCIw9ZrNbZABc` itemsfind正确itm411；event11/M28 `call_4cfYWfHyIbte9oLzePlkXwvz`status，event12/M29 `call_e9oZCuQkYQz0rCoyDtTPbWW9`date；event13、14发两真实Slack，后history读回准确。

date write却自选 **column_id=due_date**，没有任何boardcolumns/schema来源。itemsfind只返回column_values=[]；API docs虽接受通用column_id，不证明due_date是该board真实due。verifier M53–59独立读sheet/item/history，M69、78按returnedcommittedvalue和onlyselectedscope接受，root M80completed；但 **receipt只证明所填任意ID被记录，不证明目标due column身份**。final-world mondayaction就是due_date，官方所求due。官方 `tools/api/impl/monday.py:75–165`对任意ID生成action/返回用户输入；这不是真实boardcolumn解析。原source没有seed列schema，因此模型当时无法靠隐藏gold知道dueID；独立结论是目的列身份未证/错误接受，而不是假称读过due映射。其他选项/通知确实完成。官方0.75单个date字段检查失败，与此identitygap一致。

Mission的疑似active/completed“mismatch”已精确排除为正常竞态：M82 `call_hHaquh0M7vUQ2VeTYyYpFYrU` panel_query start1790742804975、end2806015返回active、epoch1/opened `pev_g0VWfry9g004a0lHFP4T`；terminal recorded **1790742806247**（查询结束后232ms）；M83 `call_UYCXgp64NBtlUjnFOyPlqaXs`请求start2819741，因completed拒绝；M84 `call_E2YCFb5qmRM7CJl0ABLoOTLR` start2832423读completed同terminal `pev_g0VWfuLfO00i5dFsB6CL`。前置M80 notification（event `pev_hCEUWRn1ww6mRGNXcqTV`）在terminal前发送。因此没有同一occurrence分裂、丢wake或未结算证据。额外状态request无害，随后canonicalread/Missionclosed。不能以M83模型自述controlmismatch作runtime根因。

## 10. finance.annual_budget_prep / MS

Trial `finance-annual-budget-prep__gYPARj7`；Task `tsk_g00VWfwNIU00l2Z5SPkx`；executor `ses_haXl6LDyWXqQ0yR8nYEY`；verifier `ses_hgimHgCbmQrmxSPOh0js`。

原要求RateCard各categorygrowth、每in-scope一rowappend、整数字符串comma、排除ScopeExclude、consolidatedtotals寄CFO并列affectednames。M19 `call_FqdaM3vEXkNOLd9nkEDg8Vni` 真读RateCard4/10/20%与actuals，全源已足够。executor M20 `call_oFUfUqtSY1stlYqfDedYEsch`（event8）把Sales800,000按10%错算880,000，其它两rows正确；M22 `call_vhARKsstc2dtaoUvXSrJhGe2`（event10）错误salarytotal2,960,000邮件 `957a8d465a8f40a6`。readback只是确认错误值persist，未重算，却M26称independentlyverified。

verifier M35 `call_5eCIuaeoJThRsKUTfAKQuyt0`独立batchread、M36exactmail；M42–43重算832,000及2,912,000，failed。root M45一次input=null拒绝后 `call_5J2E7GFlczoEpaO9MbtCl3nD`回原Session；executor M49重新读源，M50 `call_vmNRqGu8naQlHjtBpZT9frl9`（event19）只改B3，正确readback。它合法指出Gmail没有sent-bodyedit，却将不可编辑旧email等同不能修复通知、没发correction；M55notaccepted。

root M57继续原reviewer；M60–61重读正确workbook和旧wrongemail；M68准确指出**支持sendcorrectiveemail**。root M70 `call_034oTTMQP8tKyxbD2AqZ7tPZ`再次回原executor，M75 `call_MrJK2ybZCDBZxWrXNsSLHfs2`（event26）correction `381961108d374ffe`，M76exactreadback。M80继续原reviewer；M83–84freshreads，M89accepted；M91 `call_gA2DeYdr8XEC9RSWGLdXR0OI` completed，Missioncanonicalread后closed。

这是**正确算错拦截、两阶段业务修复及外发补正**，第一次恢复因把“不得replaysuccessfulcreate”过度解释成无更正通知而浪费一轮，最终未停在平台边界。旧wrongmail仍在SENT，纠正效果不抹去历史损害。最终world三rows为1,560,000/832,000/520,000等，CFOcorrectedtotal准确。root给出候选数值来自审查的真实算式，后续均重读源，未见被未授权新增任务替代。

官方0.7的三失败要求邮件包含**各部门细项**，原用户却要求consolidatedtotals；两封邮件有affectednames与最终正确consolidatedtotals。不能把隐藏各部门分项gold作为原request必需。原SYSTEM禁止总结excluded，与user“SkipScopeExclude”只要求操作排除相区分；executor/审查/Task-summary的LegacyOpsomitted总结未由任何要求排除notice的流程授权。

## 共享机制横向审查与限制

第9条疑似时序问题出现后立即按共享机制查冻结commit `a0a879ed759f980e6d72c9df7a10b51bb2d8f1a2`，不把当前变动源码当冻结事实。已核对 status 单一projection（`engine/task-status.ts`）、scheduler active authority（`protocol/delivery.ts:466–473`）、project isolation、Task/Mission scheduler endpoints、taskcontrol重试、Missionprocessrecovery、持久occurrence身份入口（`protocol/scheduler-message.ts`、`engine/task-control-driver.ts`、`mission/process-recovery.ts`、`runtime/process-occurrence.ts`）。主要可运行证据是该条232ms顺序以及十条terminal/durable结束记录；续派真实结果均回对应原workerSession，没有业务duplication。

本抽检没有新启动/崩溃重启、多project并发或所有生产入口的真实运行验收；源码库存/契约检查不能冒充那些验收。因准确时序已证明本条正常演进，**没有已证共享调度根因，也没有全域排除共享问题的结论**。重试/重启/多project风险保留未知。个别引用/schema错误在本次生命周期都被模型修正，不证hostqueue丢失；prompt/handoff候选数字也不能单独证明审查依附，须以上述实际源读、方法算式和差异判断。

共同可证接口局限：Drive `trashed=false`假空但namecontains可读（1、2、3、6、8）；Asana无taskGET（4）；Monday自选columnID回执与不反映column的lookup（9）；Gmail既往sentbody不可编辑（10）。相同“无finalGET”在4被过强拒绝、9被有限接受，显示**审查证据标准不一致**，不只是官方score严格。有效纠错证据在2stage、5extension、10salary/notice，错误接受证据在2完整pricing、3排除、9字段身份；最终失败而已有业务效果在4/8，必须分别报告。

## 保存后 task-evidence 复核修订

第一版有覆盖遗漏：第9条的业务责任链和232ms正常终态演进已核对，但没有展开 `agent/task-evidence.json` 的 `board.executionProjection` / `board.processIncidents` 历史 occurrence（执行轮次）层。完整 public transcript 的 `info.error` 和最终 terminal-summary/last-public-observation 均不能替代这一层。第二阶段父报告指出另一个历史 runtime error 后，本审计重新直接读取锁定十条的原始 task-evidence；发现本十条中**一条**该错误，只在第9条，不把父报告四十条中的“五条”数量移植给本样本。

第9条 `task-evidence[0].board.executionProjection.occurrences[4]`：input `msg_hYTdw8Q8FEFmjUT2zNEZ`，Orchestrator Session `ses_-zUTK816izzWemxFUlSo`，event `pev_g0VWftKAx00zs5Ue3NOK`，sequence103，emittedAt **1790742569102 / 2026-09-30 04:29:29.102 UTC**，真实 status=`terminal/error`，原文 **“Session message runtime contract missing for ses_-zUTK816izzWemxFUlSo (orchestrator)”**。`processIncidents[0]`保留同一身份与错误。这修正第一版任何可能被读成“第9条没有中途 runtime fault”的含义；最终收敛和稍后的正常active→completed不抹去它。

因果前后链可直接复核：Mission M62 `call_lTWWSXYWScn4CoJJNpHFXLAv`（1790742563386–2566038）发状态request，返回scheduler event `pev_hYZV0RHIfF1t6HBH7Ek6` / inbox `pib_h3I3Vef36381mUfer57S`；该输入产生上述错误occurrence。后续M68 `call_jPAWK5Qh1hHyumFzrQPmBut9`（1790742583436–2585628）真实reply_to同requestevent，告知独立审查仍在进行。原server log第3976–3977行先有该rootMessage loop，3992行在 **04:29:31.174** 才有同Message的orchestrator starting。再往后Task通过M80真实complete，Missioncanonicalread完成。这是**真实中途共享执行契约错误 + 后续原请求回应及结束**；不是初稿232ms竞态的另一种说法，也没有证据将column identity业务错误归因于它。

依照共享机制约束进一步核对冻结源码：`orchestrator/agent.ts:444–449`先把scheduler Message置入Session，`:730`后安装runtime contract；`:941–961`保持成功standby owner却清旧contract；`session/loop.ts:3458–3475`可因新真实输入/控制/contractwake唤醒。`protocol/scheduler-message.ts:322–364`Task recipient材料化/有界retry/deadletter，`:530–606`按project分配recipient与Mission恢复，`protocol/delivery.ts:464–475,672–704`检验active、exactowner与siblingauthority。creator路径`:784–825`install后write不能证明scheduler路径相同。上述顺序与真实错误支持**可见输入早于runtime安装的race候选**；没有精确异常stack、owner交错、restart/多project重放，不宣称唯一已证根因或全入口排除。

另一个保存后核实的source遗漏：第9条final-world确有 `ss_inventory/ws_badge_policy`（Badge Policies），规则为“Notes indicating a pending security clearance review must not be processed until clearance is confirmed”，effective2025-09-01。两worker都未metadata枚举或读该worksheet；其实际TempWorkerhold解释与该规则吻合，但不能说完整processsource coverage已完成。这是补充原第9条判断的源覆盖边界，不改变真实Contractor选择/通知或due column身份未证的结论。
