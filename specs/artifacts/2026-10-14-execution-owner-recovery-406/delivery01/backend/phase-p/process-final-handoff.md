# 406 Phase P 最终过程交接

本次 production 仍只有 permission/authority.ts，四项任务源（authority、permission-two-mode、新process checker/worker）均冻结。`source-freeze-check.json`直接比对执行时原源，当前相同；这只是源归属记录，不替代功能验收。控制租约 owner registry 新入口计数由 Root 另按完整方案处理，本 agent 没改注册/架构/共享文档/Git，也没有绕过 hook。

## 正式检查与原失败

| 原 stage | 正式结果 | 原结算 |
| --- | --- | --- |
| red01 | 17 pass / 6 fail / 67 assert，旧生产 + 6个新增正向合同 | exec2283 join1，原父完整结算 |
| green01 | 23 pass / 0 fail / 92 assert | exec82791 join0 |
| related01 | 28 pass / 0 fail / 97 assert | exec79068 join0 |
| process01 | 2 pass / 2 fail / 32 assert | exec9411 join1；live误期待立即stale；八child全部闭合 |
| process02 | 3 pass / 1 fail / 58 assert | exec80030 join1；dead-unexpired行为之后metadata body错误，不能补称该case原resource.stop已执行 |
| process03 | 4 pass / 0 fail / 58 assert | exec50614 join0；真实专用outer已提供 |
| package-entry01 | 0 case / 无child业务 | tool334b06 exit1；薄监督自身漏supervisor env，原源/owner保留；一行修正未动产品 |
| package-entry02 | 4 pass / 0 fail / 58 assert | exec85562 join0；正常唯一package入口，专用outer确实未提供 |
| types06 | package声明Node8GB tsc --noEmit exit0 | exec5962 join0，parent90396/child90392，36s，600s原截止及physical/output/request true |

**去重覆盖为55 tests /247 assertions**：permission-two-mode 23/92 + related四文件28/97 + 新process四场景4/58。process03/package02是同四场景不同入口复验，不相加；types01–06不算功能测试。

related01精确分组：permission-continuation-recovery.test.ts 8/25；session/permission-message-settlement.test.ts 10/22；session/permission-message-recovery.test.ts 6/39；process-liveness-owner.test.ts 4/11。原日志保留，未全量bun test或UI自动化。

## 两个最终过程 owner

- process03：start1791943394606 / 原deadline1791943994606（2026-10-14 02:03:14.606Z→02:13:14.606Z）；parent84452、正式子90796/f4cb29c2-0f80-4b70-b50b-5fa64b579d05；ended1791943585354，190.748s。原owner/stderr/stdout在process03/，汇总process03-summary.json。
- package-entry02：start1791943710820 / 原deadline1791944310820（02:08:30.820Z→02:18:30.820Z）；parent61428、正式子91024/a1b044f7-53d5-4a79-89b6-6ab808fb922c；ended1791943881768，170.948s。原owner/stderr/stdout在package-entry02/，汇总package-entry02-summary.json。

每个入口八child实际退出顺序均 `[0,0,0,0,23,0,23,0]`；23只代表自有故意crash进程，不是业务成功。各原PID/occurrence/deadline/argv都在case `*-spawn.json` 与 `*-physical-owner.json`。全部physical/output/request、Provider responses/servers、resource handlers/server均true，errors=[]，最终stdout四条managedDirectoryRemoved:true；没有自有服务或checker继续运行。

process03每case outerDeadlineObserved:true、wrapperDeadlineAt为原scope截止；package02每caseouterDeadlineObserved:false/wrapperDeadlineAt:null，自身原600000ms case预算。包默认900000ms文件监督没改，package02额外原600s外监督是独立事实，不伪称case收到它。每个child仍最多180s，HTTP/资源30s，case保留60s；没有续期或时间/lease/grant修改。

实际dead-expired：process03原expires1791943580438，实际observed1791943580439；package02原expires1791943878435，实际observed1791943878437。recovered原lease expiry保持、exactOSdead和原attempt unknown单独匹配。dead-unexpired为原lease提前release时间等unknown事件原时间。

## 过程证明的内容

真实普通 public Session创建/POST message、受控流式Provider、真实webfetch、同请求Permission allow_once、独立HTTP公开CSV、真正callback结果写入唯一result与ledger。两个backend同时活跃、同Project与两个Project都有各自完整canonical请求集合与CSV结果。crash producer物理join后，新backend走正常bootstrap，按原process/lease/start身份结算未知。

各case a/b-completed或recovered原件保留实际Message/Tool/Permission/API/result/OS；没有直接造完成Message、改DB、手造lease/clock或调用真实模型。Provider证据只保留请求metadata和明确bodyState，不保存完整请求体；公开CSV配置及固定public fixture apiKey不是真实凭据。没有读取/复制auth/models。

## 辅助差异与交付文件

1. 正式新增 test/permission-execution-owner-process.test.ts、test/fixture/permission-execution-owner-process-worker.ts。
2. 已授权 production packages/opencorvus/src/permission/authority.ts 与现有 test/permission-two-mode.test.ts；完整既有production/test差异在handoff-preparation和process03-preparation/frozen-authority.patch，不从peer变更取文件。
3. process03-preparation/before及两patch保存metadata/关闭/可选真实outer修正前后。原process01-checker-before.ts、process02-checker-before.ts保存失败版本。
4. run-formal.ts仍原已审唯一process专用outer发送逻辑；run-package-entry.ts只外部监督正常包命令，一行supervisor修法见package-entry-preparation/first-launch-correction.md和package-entry01原源。
5. 实际raw公开证据：process-evidence01/02/03、package-evidence02各四scope；package-evidence01为空前置失败，不能算过程。不得整个复制runtime/DB或其他任务source。

## 未满足与不得外推

- 普通Ask成功Message后normal retirement缺触发已在 `../retirement-timing-review.md` 全横审，独立未闭合；新四case检查当前四条执行账本，并不证明该产品时机。
- Question Phase Q、Task ordinaryQuestion死owner、同DB活backend错误恢复Question均未修改。此处普通Session Webfetch不称Task/Mission/Question完整恢复验收。
- MCP同taskId/显式handback为已过集中authority合同，不是实际SDK远端任务端到端。missing/opaque/unknown为集中原事实合同，没有造真实OSunknown过程。
- live自然expired不被抢的生产条件已实现；本过程只真实等待dead lease自然120s，并未让真实live效果跨原120s或改时钟。异常serialization/commit的精确合同见集中测试，不能以本过程替代每个故障型。
- 没有真实Sol或页面验收；Root自己的Phase U页面按其独立证据，不与本55/247累计。所有历史失败继续保留。
