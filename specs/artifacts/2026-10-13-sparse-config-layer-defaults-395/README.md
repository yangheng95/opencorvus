# 395 稀疏配置层继承证据

对应[395规格](../../records/2026-10/2026-10-13-sparse-config-layer-defaults-395.md)。配置修复的聚焦后台合同已通过，真实Scope01仅通过配置继承、Settings和Ask请求事实；**页面allow_once、read成功结果、最终数据回答及NativeService exit0资格未达成**。本目录保留原失败与迟收尾，不把物理停止、HTTP200/EOF或后台测试代替完整端到端验收。

Root负责真实页面和截图人工复核，后端agent收集唯一只读终态，audit_ui仅按允许清单归档。没有重跑历史probe、live helper、完整checker、Provider或UI测试，也没有读取凭据/数据库或复制原始Provider审计。全部源路径、字节数和资格说明见[manifest](archive-manifest.json)。

## 公开配置探针与正式合同

[原probe](probe/probe.ts)、[原结果](probe/probe-results.json)、[原输出](probe/probe.log.gz)、[exit0](probe/probe.exit)和[输入完整性事实](probe/probe-integrity-facts.json)记录PID86520的2635ms有界调查。9组旧生产输入有8组解析、1组ConfigInvalidError；这表示探针完整记录了缺陷，不能追认为修复后九项全通过。[公开输入汇总](probe/public-inputs.json)只从原probe记录抽取globalInput和各原文，8个实际项目文件以gzip保字节；absent组的缺失状态显式记录，没有伪造文件或复制probe runtime。

最终独立后台用例共58 pass、0 fail、165断言：

| 用例文件 | pass / 断言 | 最终证据 |
| --- | --- | --- |
| config-layer-inheritance.test.ts | 23 / 72 | [after-final](logs/formal/after-final.log.gz)、[exit0](logs/formal/after-final.exit) |
| config-global-defaults.test.ts | 6 / 19 | [direct-final](logs/formal/direct-final.log.gz)内本文件DONE exit0 |
| server/conversation-capability-route.test.ts | 4 / 21 | 同direct-final内本文件DONE exit0 |
| config-peer-convergence.test.ts | 7 / 8 | [related-final](logs/formal/related-final.log.gz)、[整体exit0](logs/formal/related-final.exit) |
| server/config-candidate-status.test.ts | 11 / 32 | 同related-final |
| execution-capacity-config.test.ts | 2 / 2 | 同related-final |
| config-catalog-lock-order.test.ts | 4 / 8 | 同related-final |
| config-skill-recovery-lock-order.test.ts | 1 / 3 | 同related-final |

Root随后[独立重跑](logs/formal/root-final-functional.log.gz)、[exit0](logs/formal/root-final-functional.exit)为29 pass、91断言，覆盖第一、第二文件，是58项中的重复确认，不累加成87项。

以下过程失败全部原样保留，不能用文件名“final”重命名为成功：

| 阶段 | 原输出与退出 | 资格 |
| --- | --- | --- |
| 原版本红测 | [before](logs/formal/before.log.gz)、[exit1](logs/formal/before.exit) | 20项6 pass/14 fail/20断言，旧层默认注入问题 |
| 首轮实现 | [after-first](logs/formal/after-first.log.gz)、[exit0](logs/formal/after-first.exit) | 当时20 pass/51断言，不是最终23项 |
| 源数组自审 | [source-array-before](logs/formal/source-array-before.log.gz)、[exit1](logs/formal/source-array-before.exit) | 实施后的边界红测，不冒充全旧版本红测 |
| 边界红/绿 | [boundary-before](logs/formal/boundary-before.log.gz)、[exit1](logs/formal/boundary-before.exit)；[boundary-after](logs/formal/boundary-after.log.gz)、[exit0](logs/formal/boundary-after.exit) | 修复source/global null等合同后21 pass/59断言 |
| 含非法Provider样本的组合运行 | [direct-final](logs/formal/direct-final.log.gz)、[整体exit1](logs/formal/direct-final.exit) | agent.public样本非法；另两个文件独立DONE exit0有效，目标样本修为agent.chat后after-final23项通过 |
| 关联检查原轮 | [related](logs/formal/related.log.gz)、[exit0](logs/formal/related.exit) | 原关联结果保留；最终统计取related-final |
| 类型传播第1轮 | [typecheck-first](logs/formal/typecheck-first.log.gz)、[exit2](logs/formal/typecheck-first.exit) | 直接调用者旧Info签名暴露 |
| 类型传播第2轮 | [typecheck-inputs](logs/formal/typecheck-inputs.log.gz)、[exit2](logs/formal/typecheck-inputs.exit) | Skill输入签名边界 |
| record键类型收敛前 | [typecheck-final](logs/formal/typecheck-final.log.gz)、[exit2](logs/formal/typecheck-final.exit) | 虽名final仍失败 |
| 最后有效核心类型检查 | [typecheck-source-records](logs/formal/typecheck-source-records.log.gz)、[exit0](logs/formal/typecheck-source-records.exit) | 唯一Info派生Source的record值合同修正 |
| 格式与diff | [format-final](logs/formal/format-final.log.gz)、[exit0](logs/formal/format-final.exit)；[diff-check](logs/formal/diff-check.log.gz)、[exit0](logs/formal/diff-check.exit) | 静态整合，不替代功能 |

这些测试使用正式隔离runner和真实canonical配置文件/公开handler/PermissionAuthority；既有无副作用后台allow_once结果不等于本次真实UI已批准。未重复运行所有Task/Mission恢复或全部配置入口，具体范围沿395规格。

## 变更与验收准备的边界

[精确配置变更快照](implementation/config-only.patch.gz)和[分段复核](implementation/config-hunk-split-review.json)只保留395配置source/effective改动；不复制完整config前像、其它源文件、全仓diff或vendor。最终提交范围及直接调用者类型变化由Root的真实Git差异审核，不能把这份保存时点的patch冒充整个工作区。

[live helper](implementation/live-395.mjs)、[完整checker](implementation/check-live-395.ts)、[LIVE-HELPERS](implementation/LIVE-HELPERS.md)保存审读后的准备文件。LIVE-HELPERS开头的“Prepared only”属于准备时态：后来start/send已实际执行，但**完整checker未执行**。原[helper syntax](logs/formal/helper-syntax.log.gz)/[exit0](logs/formal/helper-syntax.exit)、[checker syntax](logs/formal/checker-syntax.log.gz)/[exit0](logs/formal/checker-syntax.exit)、[checker transpile](logs/formal/checker-transpile.log.gz)/[exit0](logs/formal/checker-transpile.exit)只证明准备整合；scope.resource.paths及真实directory的后续纠正没有构成完成验收，也没有在关服后跑离线成功替代。

[运行bundle选定源码摘录](implementation/permission-bundle-code-evidence.json)及[摘录脚本](implementation/read-permission-bundle-evidence.mjs)用于说明实际Main投影缺口与当前源码相同，没有复制整个构建包，也不是UI文案断言测试。

## Scope01真实配置和待授权观察

原选择[内置Base](live-01/builtin.json)与[公开CSV](live-01/public-external.csv.gz)为本scope输入。CSV解压53字节，内容是CEDAR395、Maple=3、Iris=4；它是要求模型读取的原文，**不是read完成输出**。固定20请求/600秒原scope未延长。

1. [预检](live-01/owner/preflight-ready.json)分别确认credential usable、catalog projected、actualModel gpt-6.1-sol及streaming=true；[初始配置层](live-01/owner/owned-config-hierarchy.json)和[profile准入](live-01/owner/profile-selection-admitted.json)记录原输入。这里只保留选定元数据，不含配对内容。
2. 正常[Global Chat请求](live-01/global-chat-start-request.json)与[202响应](live-01/global-chat-start-response.json)产生Session `ses_hxQa5jQTUbR8tnvMY6gA`、Project `prj_htaqdXH2yXa4W5BGreGP`。实际项目目录来自响应，不能与native初始project混淆。[首条自然回复](live-01/first-completed.json)及[AX](live-01/observations/chat-first-completed-ax.txt)实际完成，这不代表第二条CSV回答完成。
3. [global事实](live-01/global-config-facts.json)显示仅把原全局permission从full_access改ask；[project事实](live-01/project-config-facts.json)显示返回项目原有$schema/terminal，本次仅PATCH username，profile/permission来源始终global。公开GET/config实际base/ask，Root没有点击模式或向项目新增覆盖。
4. [普通Chat Base/Ask截图](screenshots/chat-base-ask.jpg)、[AX](live-01/observations/chat-stable-config-ax.txt)、[Settings继承Ask截图](screenshots/settings-inherited-ask.jpg)及[AX](live-01/observations/settings-inherited-ask-ax.txt)由Root真实页面人工检查。以上是395配置前后数据链的实际UI资格。
5. 第二条[真实请求](live-01/public-message-request.json)让模型read本scope项目外public-external.csv。[实时公开观察](live-01/observation-1791905827294.json)记录真实Ask、read_local、scope.resource.paths及请求`per_hnAtJviYIcPphDoaRGRp`。[pending截图](screenshots/permission-pending.jpg)/[AX](live-01/observations/permission-pending-ax.txt)显示Main read Running；[历史截图](screenshots/history-pending-read.jpg)/[AX](live-01/observations/history-pending-read-ax.txt)仅有Requested记录，没有实际批准控件。Root没有API回复、切换另一Session或伪造消息。

[start原日志](logs/live-01/start.log.gz)与[send原日志](logs/live-01/send.log.gz)保留执行事实。send handle19231 exit1；[失败回执](live-01/helper-failure-send-1791906100148.json)的时间15:41:40.148Z早于Root关闭，原send日志底层为UND_ERR_HEADERS_TIMEOUT。该HTTP等待失败不能凭最后异常定为Provider失败，也不是取消原owner的凭证。

## 唯一只读终态与未完成项

后端在物理退出后用一次readonly SQLite BEGIN快照产出[terminal-observation](live-01/terminal-observation.json)，observedAt=2026-10-13T15:55:13.511Z。归档只复制该选定结果，不读数据库，也不复制其引用的原Provider audit。该文件明确是证据收集，不是完整checker、HTTP替代或恢复执行。

它显示同一新Session策略为ask、账本仅requested、read请求存在而toolOutcomes为空；第二轮assistant没有completed时间或最终数据回答。选定Provider记录7次实际gpt-6.1-sol流式请求均HTTP200/EOF，预算未耗尽，包含preflight和业务请求；这些流式终态不能代替获准工具执行或最终回答。

未达成：页面allow_once、read execution_succeeded、中文CSV最终回答及引用、正常NativeService exit0资格。共享权限投影缺口另归[402](../../records/2026-10/2026-10-13-standalone-permission-projection-402.md)，关闭异常另归[403](../../records/2026-10/2026-10-13-native-shutdown-pending-permission-403.md)；395不添加超时、强停或后备授权路径以掩盖失败。

## 原期限、迟关闭与物理回收

[launch owner](live-01/owner/launch-owner.json)、[startup](live-01/owner/startup.json)、[native ready](live-01/owner/native-host-ready.json)记录NativeTarget88712、Host84240，原deadline=2026-10-13T15:44:15.154Z，closeBy=15:43:15.154Z。[页面关闭记录](live-01/observations/page-closed.json)为tab39于15:43:43.984Z确认关闭，**比closeBy晚28.830秒**；不能把尚在最终物理期限内写成预留窗口合规。

[shutdown admission](live-01/settlement/shutdown-admission.json)在15:43:54.849Z；[原native stdout](logs/live-01/native-stdout.log.gz)/[stderr](logs/live-01/native-stderr.log.gz)保留listener quiesce5000ms超时/escalating及Server stop timed out after5000ms。shutdown handle25175 exit0只表示收尾完成；launcher74529 exit1、OWNED_NATIVE_COMPLETION_INVALID才是本次资格事实。

[native settled](live-01/owner/native-host-settled.json)与[physical/pair cleanup](live-01/settlement/physical-terminal-and-pair-cleanup.json)记录15:44:02.509Z物理settled、exit1，physicalCompletion/outputDrainComplete/requestCleanupComplete均true；15:44:05.426Z配对副本删除完成，原target/host occurrence退出、端口释放。原deadline未延长，没有杀用户进程。[配对staging元数据](live-01/owner/provider-pair-staging.json)与[settlement owner](live-01/settlement/settlement-owner.json)只记路径/大小/身份，不含auth/models内容。

## 归档边界

[manifest](archive-manifest.json)为显式96源文件允许清单，另有本README、manifest及[归档检查](archive-check.json)，共99文件。4张JPEG原字节保存，34个gzip用于原日志、CSV、公开fixture及精确patch，解压须与源逐字节一致；其余选定JSON/AX/helper均保留原文件内容。没有复制raw Provider audit、runtime/DB/auth/models、workspace-before.diff、完整source前像、vendor或ui-build。

本次归档做有限凭据模式扫描、局部链接检查及字节恢复，不使用hash或截图差异作验收。Root另负责基于原授权SourceAuth的KnownCredentialRedactor内存扫描；audit_ui未读取该文件，有限扫描不能宣称普遍保密保证。最终共享索引/文档、范围提交和推送仍由Root完成，原Scope01失败不会被后续批次覆盖。
