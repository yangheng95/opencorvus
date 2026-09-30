# 独立十条审计与既有报告的对照

## 顺序与范围

独立 agent 在没有父任务历史、未读既有报告的情况下，完成锁定十条的原请求、真实参与者/Tool、业务事件与world责任链，先保存 `independent-findings.md` 第一版；此后才读取 `../2026-09-30-harbor-runtime-comparison/report.md`、`summary.json` 和 `../../records/2026-09/2026-09-30-harbor-current-runtime-restart.md` 对照。比对对象是提交 `8ab05c43` 已发布的原内容；主任务在第二阶段未改写该对象。第一版的83个逐案call引用已解析到各自原始trace；主任务也独立核到其Message/Session身份和第6条SYSTEM总结文本。没有引用存在就等于结论正确的推论。

十条 summary slots 的case/arm/trial/Task、native acceptance、strict/partial、429个 `kind=tool`、每条一个score事件与原件逐项相符。该对照只核定本十条；没有重验四十条统计、其它三十条责任链、成本或全域运行结论，不把既有报告标题里的“independent”当证据。

## 逐条支持、修正和仍未知

| 锁定样本 | 对既有报告的判断 | 本次独立依据与补充 |
| --- | --- | --- |
| 1 Candidate TS | **支持**已有tracker发现失败与Drive假空解释；**补充**无clarification约束违反 | 原请求可见Meridian锚点；M86–87只查MIME/candidate不匹配标题；无业务write；M118真实question等待后fail。原report已有同source/queries论证，不能包装为本次新发现。新补充是原SYSTEM禁止clarification，而该302秒question并无不可替代外部facts证明。 |
| 2 Opportunity TE | **支持**60,000/Prospecting→20,000/OnHold的真实但不完整修复 | 首次pricing方法M71本来就漏base/tier，第二方法M112继续只count×rate；因此**修正因果强度**：root后续给20,000候选确实限制盲性，但不能唯一归因为候选答案灌入，reviewer在root再brief之前已自行缩减公式。真实54,000可从原world与完整邮件独立推导。 |
| 3 QBR MS | **支持**未查HealthStatus/churn排除与三人错误/未证集合接受；**保持原report的业务真值限制** | sheetChurned规则已读，两个Salesforce projection却没查该字段/cancellation。世界只给Churned标签、没独立取消事实，用户又说标签陈旧；不能把goldVanguard排除当模型已看到的独立expiry证明。新增SYSTEM总结遗漏：M53/M79/M81列出未acted-on三人，邮件也有全局排除说明。 |
| 4 Facilities TS | **支持**实际正确create/placement与finalread限制；**强化判断**为过强验收而非业务未做 | event20/21、M27完整同步receipt、finalactions满足原用户；M39/40缺GET是接口限制。冻包prompt允许同步receipt证明commit字段，原用户不要求后来GET；M54/M63只读返工没有业务缺陷可修，最终fail是审查门槛过强。原report已区分native拒绝/officialpass，但其“failed final-read standard”不应被读成合理必需交付。 |
| 5 Probation TE | **支持**Slack发现延期与原Session有效更正、历史错误SENT残留、Marcus31/30 gold矛盾 | 原calls和最终两封邮件吻合。按policywritten，Marcus31days不在30daywindow；不能为了strict0补发。根因是executor已读要求managercommunication却只查Gmail，不是不可读Slack。新版已从原源得出这一点，既有报告也已记录，**没有推翻既有更正结论**。 |
| 6 Late fees ME | **支持**requiredfee/notice正确且无独立业务修复；**限定“全部正确”的含义** | M47/50/51 effects及M74/77/79/80独立读支持fee业务；M63 executor final“Excluded under-$500 INV9003 and VIPINV9004”、M91Task-summary违反SYSTEMonlyacted-on。policy只waive/nofee，没要求exclusionnotice，例外不适用；方法需要记录eligible-set premises与最终work-summary违规分开。既有report“required effects correct”可保留，“all original constraints satisfied”若被推导则需收回。 |
| 7 Capacity ME | **支持**两ticket/comment/report/mail/Slack真实效果，缺字面overload与weight/recipient边界 | 同tickets最终A1=3、A2=4，部门Engineering仍7>6。只修审查方法marker typo，非业务修复。gold字面overload失败不等同没capacitysummary。不能用17/18否定计数式rebalance，也不能把部门容量已解决说成事实。无其它反证。 |
| 8 Podcast TE | **支持**先漏真subscriber、reviewer后来找到、额外field拒绝；**补充**返工丢失已发现source | M50/52实际ss_subs标题/订阅dates/两addresses；M81恢复仍“Driveempty/ss_subscribersnotfound”，未把ss_subs继承为source。rootM83称finalauditconclusive不成立。订阅语义有可合理推断，但无独立boolean事实；初稿“过强schema要求”须保留这一限制，不把consent当100%直接字段证明。既有report对此边界已有说明。 |
| 9 Inventory ME | **支持**due_date任意IDecho不能证明目标due；**补充**精确正常终态竞态；**修正本独立初稿的层覆盖遗漏** | 两次快照在不同时间正常演进，详见下节；另一个历史contracterror必须独立保留。保存后原task-evidence核实本条seq103的真实error，支持父report对应记录；第一版此前未展开该层，不允许反过来用durablepass抹掉。保存后另核ws_badge_policy存在但worker未读，与既有report吻合。 |
| 10 Budget MS | **支持**真实错算→单cell修正→correctiveemail的两轮修复与历史wrongmail | M20Sales错用10%是业务错误，reviewer源4%独立重算；第一轮只改sheet，第二轮补通知。正确consolidatedtotals无需gold每部门细项；父report已有此区分。新增SYSTEMsummary排除LegacyOps遗漏，不等同预算纳入LegacyOps。 |

十条没有推翻既有报告的主要逐案事实；这不是为了迎合父结论。独立初稿在读取父结论前已得到同样的原件链，既有报告也已经明确Marcus31days、Episode42、consolidated-only、overload等gold限制。把这些当“新反证”会误报新颖性。真正新增的分析是**原SYSTEM总结约束在核心业务正确时仍漏审**、**Podcas返工继续声称真源不存在**、**候选答案不是定价漏项唯一原因**和**第9条终态快照正常竞态的精确时间排除**；历史contracterror是既有报告正确、独立第一版覆盖不足的补正。

## 第9条两个完全不同的时序事实

**A. 正常active→completed演进，不构成rootcause反证。** M82 `call_hHaquh0M7vUQ2VeTYyYpFYrU` query结束1790742806015，activeepoch1；终态时间1790742806247，晚232ms；M83requeststart2819741后得到statuscompleted拒绝，M84query显示同terminal `pev_g0VWfuLfO00i5dFsB6CL`。此处没有同一快照version分裂、失去Task身份或未结算证据。模型自己说controlmismatch不能替代这些时间事实。该片段既不能推翻，也不能证明父报告另一错误。

**B. 真实中途runtimecontract缺失，最终结束不能否定。** 保存第一版后，经父报告线索直接读原 `task-evidence.json`：`board.executionProjection.occurrences[4]` / `processIncidents[0]`，event `pev_g0VWftKAx00zs5Ue3NOK` seq103 at1790742569102（04:29:29.102UTC），input `msg_hYTdw8Q8FEFmjUT2zNEZ`，Session `ses_-zUTK816izzWemxFUlSo`，terminalreasonerror，原错误“Session message runtime contract missing…”；这是A之前约四分钟的另一occurrence。Missionrequest `call_lTWWSXYWScn4CoJJNpHFXLAv` / event `pev_hYZV0RHIfF1t6HBH7Ek6`是真实前件，后reply `call_jPAWK5Qh1hHyumFzrQPmBut9`指向同request。

独立原件横扫十份task-evidence只有这个同错误。父报告四十条中的其余四个样本不在锁定清单，未重新审计，故本抽检**支持一个已核持久错误**，不把父“五次”冒称本十条结果。原serverlog在同Messageerror后约2072ms才orchestratorstarting；冻结源码先deliverywrite（`orchestrator/agent.ts:444–449`）、后runtimeinstall（:730）、standbyclear（:941–961）与loop新inputwake（`session/loop.ts:3458–3475`）支持visibility/installationrace候选。Taskrecipient、retry/deadletter、Missionwake、project/owner/epoch共享检查见独立稿修订节；精确failedstack与ownerinterleaving、retry/restart/多project真实复现仍未知。

父报告“存在历史contracterror但后续继续并最终settled”由本条原件支持；其“candidate race”因果强度合适。若解释成已修好/已证唯一根因/业务due身份问题由此导致，则都无证据。本独立稿第一版遗漏该层，已明确追加修订而不静默抹去旧判断。没有生产修复、新benchmark或额外样本在本次授权范围内。

## 对最终交付措辞的影响

可保留既有报告“可靠业务纠错与普遍evolution增益未实现”的结论：本样本实际同时含有效纠错（2stage、5extension、10budget）、错误接受（2pricing、3排除、9fieldidentity）和审查造成的额外阻塞（4、8），不满足一个统一可靠闭环。不能从十条抽检估计四十条失败率或声明全部入口正确。

交付应同时说清：十条物理结束；三条nativefailed中两条已经有正确业务mutation；fee业务正确不意味着SYSTEMsummary也合规；follow-upmail不撤回错误历史发送；officialstrictfailure可能是字面/额外gold而非原业务要求失败；第9条存在独立历史runtimefault，同时另一个快照差异是正常演进。所有分数、原世界和原trace保持原样。
