# 406 process03 辅助修正待审

只修改正式 process checker 与唯一 worker；authority.ts 和 permission-two-mode.test.ts 冻结。没有启动 process03/正常 package 过程，也未修改共享受控 Provider、正式 package runner、配置或生产。

## 原失败

- process01：exec9411 join1，2/2/32；原 Ask 立即账本错误期待 stale。Root 已批准精确一处数组修正；原像 phase-p/process01-checker-before.ts。
- process02：exec80030 join1，3/1/58；dead-unexpired 行为断言之后，finally 的 `body.model` 访问 undefined。共享 fixture `controlled-streaming-provider.ts:36` 合法捕获 JSON 解析失败为 undefined，公开类型是 unknown。未解码原因无额外传输证据，不能断言一定是模型、崩溃或具体 HTTP 方法。
- 八个 child 已各自物理/输出/请求结算。失败 case 的 Provider.stop 调用已完成，之后资源关闭/cleanup.json未执行；外正式父退出后 managed runtime 实际不存在。原失败不能改称完整正常收尾。

本目录 before/保存 process02 实际 checker/worker/wrapper原像；完整原日志及事实仍在 phase-p/process02 与 process-evidence02，未覆盖。test-fix.patch 和 worker-budget-fix.patch 是仅本次辅助增量；frozen-authority.patch 仅记录当前冻结生产差异。

## 实施

1. 每个原 Provider request 都有一条 metadata，bodyState明确 unavailable/null/array/实际typeof；只有实际 string model、boolean stream、array tools 才记录各对应字段。Tools项没有实际name时明确null，不跳 request、不猜模型、不保存完整请求。
2. 原 child operations、Provider response promises/servers、资源 handler promises/server均先尝试结算，各闭合标志来自实际 await成功；失败收集而不虚报true。纯metadata导出置于这些关闭后。
3. 导出外层 finally 继续写cleanup；其内 finally在实际全闭合时删除原managed目录。每个关闭/导出错误仍汇总抛出，原case错误也保留；managed删除的实际结果单独进入最后stdout事实，不往已经删除的默认scope再写文件。
4. case一开始声明 `caseDeadlineAt=parentStartedAt+600000`。缺少专用outer变量是合法普通入口，显式记录 wrapperDeadlineAt:null / outerDeadlineObserved:false。若提供则验证safe future integer、parent取更早截止，绝不重置外父；case保留60s，child180s且clip casecloseBy，HTTP/resource30s。
5. worker以父实际argv的child截止为权威并验证future/最多180s；有原outer时再验证child≤outer−60s。缺outer如实记录null，而非猜外父身份。临时 run-formal.ts 未修改，仍只给唯一process文件传真实原600s外父。

## 待 Root 审读的精确执行参数

共同 PATH 为仓库 `.tmp-product-iteration/sse-compression-305/bun140/bun-windows-x64` 前置；只公开fixture，不auth/models/真实LLM/UI。

有outer：先确认process03与process-evidence03不存在，创建全新 evidence03，设置其绝对路径到 OPENCORVUS_PERMISSION_OWNER_EVIDENCE；运行：

```powershell
bun .tmp-task-question-recovery-406/phase-p/run-formal.ts process03 test test/permission-execution-owner-process.test.ts
```

唯一原wrapper在自身setup前声明600s并传本真实截止。四case仍live-same-project、live-two-projects、dead-unexpired、dead-expired，后者实际等待原120s，不改时间/lease/grant。

正常package：独立 fresh evidence-package01，明确该命令进程环境中专用 `OPENCORVUS_PERMISSION_OWNER_DEADLINE_AT` 未设置，仅执行：

```powershell
bun run --cwd packages/opencorvus test test/permission-execution-owner-process.test.ts
```

这是真实正式公开checker选文件路径，不用internal isolated entry，不跑全量。需要以原启动owner保存命令/环境键/物理与输出结算。现成 `run-tests.ts:43` 使用 `testCommandDeadlineAt()`；util原固定文件命令期限为900000ms（test-runtime-environment.ts:13），不是本辅助的600s，不能谎称它有专用outer。case仍自行600/60/child180/HTTP30。若Root需要整次实际诊断scope也固定600，建议仅外层同一NodeProcess owned_tree调用此原命令并不向被测package传专用变量；这是外部scope物理监督与测试可观察budget两件事实，须Root审该薄启动命令后执行，不能改generic runner默认。

本次类型检查 `run-formal.ts types06 typecheck` 原exec5962已实际join0；parent90396 / child90392-2e3b628b-1554-44bd-b1d1-0c173fcf269d，1791942892912→1791942928912，原deadline1791943492912，物理/输出/请求均结算。原包声明Node8GB TypeScript命令与stdout/stderr在types06，回执复制为types06-owner.json。类型通过不代表两个过程入口已经验证。

## 保持的边界

普通Ask completed Message退休时机见 ../../retirement-timing-review.md，独立未闭合；本修正不补生产触发。四case不会外推为Task/Mission/Question、OS unknown、MCP真实远端task或真实Sol完整验收。重复过程/类型检查不增加独立覆盖数。
