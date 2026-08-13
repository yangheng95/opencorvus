# CS-075 — Fact Check domain-incomplete settlement

## Recall

- 用户要求持续直接修复代码异味清单，并让并行agent深挖而不是抢同一文件；本批只实现CS-075，首轮验证后冻结交付父agent复审。
- 验收目标：Fact Check自然结束但未发布required review，或发布review的四字段target scope与adapter解析的exact target不一致时，保存真实不完整事实并结算为`domain_incomplete`，Research Studio Writer保持关闭；合法exact-scope review保存一个canonical Artifact并打开Writer；语义校验失败的真实tool result保持可见且不能提升成功；coordination handoff保持独立结算。
- 硬约束：复用既有`DispatchOutcome.domain_incomplete`、exact Engine Artifact locator、dispatch settlement与`describeTask` frontier；不增加host gate、第二套workflow判定、隐藏/合成消息或非流式LLM调用；不碰`workspace.ts`、Overlay或Provider；只做非UI聚焦正向测试。
- 已读资料：根`AGENTS.md`；持续审计CS-075；修复program；Fact Check agent、collector/schema/persistence/adapter；Research Studio workflow与Fact Checker/Writer contracts；Artifact Catalog、dispatch lineage/settlement、describe frontier；CS-034/047/054现有domain-incomplete实现和验收。
- 全仓搜索：缺review唯一错误提升在`orchestrator/fact-check-tool.ts`的`!result.review -> terminal`；review唯一合法producer是`record_fact_check_review` collector与`fact-check/persist.ts`；workflow frontier已经严格只认`terminal_success`，无需改共享scheduler或consumer；Workbench只解析`fact_check_review`，因此不完整事实必须使用独立kind而不能伪装成review。
- 独立agent反馈：无；本批由并行子agent实现，按父agent要求首轮验证后冻结并由父agent安排独立复审。

## 根因与边界

Fact Check streamed Turn的物理结束只证明Session有final message，不证明required FactCheckReview已发布。当前adapter把process-local collector缺值直接提升为domain success，与Research Studio的必需前驱边和Writer的exact review消费契约冲突。

唯一修复边界是Fact Check producer settlement：合法review继续由canonical persistence写`fact_check_review`并成功；缺review写一条`fact_check_incomplete` Artifact，携exact target/Turn/provenance与typed reason，再返回该locator的`domain_incomplete/fact_check`。Artifact持久化失败仍是既有post-Turn `partial`，coordination仍走现有handoff。共享frontier、HTTP/OpenAPI/SDK、其它domain adapter和Workspace不改；Engine Artifact表的kind列本来是text，新增当前kind不需要data migration。

## 实施方案

1. 在Fact Check schema/persistence定义canonical incomplete Artifact及返回exact locator的writer；typed reason区分`review_not_published`与`review_scope_mismatch`，review和incomplete使用不同kind，避免双源或让展示consumer误读。
2. adapter在唯一settlement mapper中把review scope的target Session、Agent、Message与content hash逐字段对照resolved target；缺review或identity mismatch均读取同一真实Turn provenance、持久化incomplete Artifact并返回`DispatchOutcome.domainIncomplete`；只有exact match review由现有review writer授权`terminal_success`；两条persistence共享现有post-Turn failure处理。
3. 将runtime/prompt/tool文字与真实契约对齐：工具不终止Turn，但Fact Check domain completion需要有效review；不强制模型调用，不重试或合成review。
4. production adapter仅加入构造期一次解析的`runFactCheck`测试seam；唯一production caller不注入并继续使用`FactCheckAgent.run`。
5. 聚焦测试穿过真实adapter execute、真实Session/Artifact、dispatch settlement和`describeTask`：natural no-review→exact incomplete/closed Writer；target mismatch→exact typed reason/locator/closed Writer；valid exact-scope review→one review/open Writer；semantic validation tool result→真实Error留在Session且adapter仍incomplete；handoff→coordination。

## 正向验收

- `bun test --timeout=0 test/fact-check-domain-incomplete-settlement.test.ts`
- `bun run typecheck`（`packages/opencorvus`）
- `bun run docs:check`（仓库根）
- task-owned `git diff --check`

## Verification Log

- 首轮实现完成：`!review -> terminal_success`已删除；missing/semantic-invalid review均保存canonical `fact_check_incomplete`及exact locator并结算`domain_incomplete/fact_check`；合法review仍是唯一success authority；handoff保持`coordination`。
- 首轮聚焦production adapter + Session/Artifact + dispatch settlement + `describeTask`测试4/4 PASS：缺review关闭Writer；合法review打开Writer；semantic validation Error tool result完整可见且结算incomplete；handoff保持独立结果。
- 独立复审发现并修复两项：唯一adapter settlement mapper新增resolved target与review scope四字段exact identity校验，错配保存`review_scope_mismatch`而非伪称未发布；新增public Artifact kind通过canonical SDK generator同步OpenAPI与JavaScript SDK generated files。
- 修复后聚焦production adapter + Session/Artifact + dispatch settlement + `describeTask`测试5/5 PASS，新增target mismatch case断言exact typed reason/locator及Writer frontier关闭，同时合法exact scope仍打开Writer。
- `bun run typecheck`、根`bun run api:routes-check`、`bun run check:sdk-imports`、`bun run docs:check`、task-owned `git diff --check`均PASS；SDK generator只改`openapi.json`和`js/src/gen/types.gen.ts`三处kind union，各新增`fact_check_incomplete`，无其它generated漂移。
- 二次独立只读复审已核验四字段scope一致性、两类incomplete reason、canonical locator/frontier、合法review成功路径及精确generated差异，结论PASS且无剩余actionable；提交与push由父agent执行。
