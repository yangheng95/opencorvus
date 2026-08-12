# CS-034 — Architect domain-conflict settlement

## Recall

- 用户要求持续直接修复长清单并并行深挖，不能拆东墙补西墙；push前必须先fetch并合并remote。
- 验收目标：Architect预检冲突和持久化竞态都保留唯一structured GoalGraphCandidate，却不能再投影为`terminal_success`或打开successor frontier；合法projection保持成功；post-Turn persistence failure保持`partial`。
- 硬约束：复用现有`domain_incomplete`与exact Engine Artifact locator，不增加第三种outcome、host gate、fallback或Artifact双读；真实production dispatcher路径正向测试；独立只读交付复审至PASS。
- 已读资料：审计CS-034；`orchestrator/architect-stage.ts`；`engine/persist.ts`、`dispatch-outcome.ts`、`dispatch-settlement.ts`、`describe.ts`、GoalGraph projection/store；CS-047/054/055实现与测试。
- 全仓搜索：两条错误成功都在Architect stage：preflight conflict持久化candidate后直接`terminal`；`persistArchitectGoalProjection`竞态抛`GoalGraphProjectionConflictError`后持久化candidate，再落到末尾`terminal`。canonical persist函数已经返回exact candidate locator且保证非空structured conflicts。settlement/describe已经接受`domain_incomplete`并只以`terminal_success`开frontier。
- 独立agent反馈：深挖确认本项仍真实，但共享primitive已完成；修复应严格收缩为Architect两个producer分支和production-chain测试，不改共享settlement/consumer。方案复核要求把真实tip竞态列为强制验收：仅测preflight不能证明`GoalGraphProjectionConflictError` catch已迁移。

## 根因与影响面

Architect worker Turn物理完成与其GoalGraph候选被Host接受是两个事实。当前冲突路径正确保存了`projection:null`、typed conflicts、observed current/prior locator等证据，却丢弃persist返回的candidate locator并将Turn提升为success。数据projection拒绝执行candidate，而workflow settlement却打开successor，形成durable跨面矛盾。

本项只迁移Architect adapter结果。Engine Artifact schema、Goal/Contract持久化、public HTTP/OpenAPI/SDK与其他domain adapters不变；无需migration或生成文件更新。

## 实施方案

1. 两个candidate persist分支接住`candidateProjectionArtifactLocator`，返回`DispatchOutcome.domainIncomplete({domain:"architect_projection", ...})`；合法projection仍`terminal_success`。
2. 保留candidate persist唯一authority、TaskUpdated事件与post-Turn catch；任何candidate persistence失败继续由现有outer catch映射为`partial`。
3. 为production dispatcher仅增加构造期一次解析的可控`coordinateArchitect` seam，唯一production caller不注入并继续使用`ArchitectAgent.coordinate`；不注入persist/settlement/describe替代物。
4. 聚焦测试穿过真实dispatcher、SQLite Artifact、dispatch settlement和describe：preflight conflict→domain_incomplete/exact candidate/nonempty conflict/closed frontier；合法projection→terminal_success/open frontier；candidate writer failure→partial；真实tip竞态必须确定性构造：worker选择旧tip A，coordinate seam返回前用canonical projection authority发布基于A的新tip B，dispatcher随后以A持久化并进入真实`GoalGraphProjectionConflictError` catch，Candidate必须含`stale_prior_projection`与exact observed-current B locator，outcome/settlement为domain_incomplete且frontier关闭。

## 正向验收

- `bun test --timeout=0 test/architect-domain-incomplete-settlement.test.ts`
- `bun run typecheck`（packages/opencorvus）
- task-owned `git diff --check`
- 独立只读交付复审至PASS。

## Verification Log

- 方案独立复核：首轮ACTIONABLE，已把真实tip竞态从可选改为强制正向验收；二审PASS，无剩余actionable。
- 实现/验证：完成。Architect两个candidate分支均返回`domain_incomplete/architect_projection`并携canonical persist返回的exact Candidate locator；唯一production caller仍用真实Agent，测试seam只在factory构造期解析一次。真实dispatcher+SQLite+settlement+describe测试4/4 PASS，覆盖preflight conflict、确定性tip A→B竞态及`stale_prior_projection`/observed-current B、合法terminal success/open frontier、candidate schema failure→post-Turn partial；OpenCorvus typecheck与task-owned diff-check PASS。
- 独立交付复审：PASS。preflight与真实tip A→B catch均使用canonical Candidate exact locator并投影domain_incomplete；合法成功、post-Turn partial、frontier和唯一production authority均无actionable。
