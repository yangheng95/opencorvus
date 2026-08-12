# CS-028 — 显式 Storage table registry

## Recall

- 用户要求持续直接修复审计问题，并用并行 agent 做独立反证，避免以局部补丁形成新双源。
- 验收目标：SQLite DDL、schema fingerprint、migration/reset 与 MySQL transfer 从同一个显式 typed table registry派生；任何 table遗漏、重名或无效声明都明确失败，禁止异常探测后静默忽略。
- 硬约束：先分析影响面；聚焦非 UI 正向测试；无 fallback/双 registry；实现后独立只读复审至 PASS。
- 已读资料：审计 CS-028；`storage/schema.ts`、`ddl.ts`、`db.ts`、`mysql-transfer.ts`、`schema-contract.ts`；`test/storage/schema-contract.test.ts`；AGENTS.md。
- 全仓搜索：`storage/schema.ts` 只导出 Drizzle tables；`db.ts` 把整个 module作为 Drizzle schema；`ddl.ts.collectTables()`反射所有 exports并吞掉 `getTableConfig`异常；DDL和MySQL transfer都消费它。Fingerprint/reset基于生成DDL/实际SQLite schema，因而会与同一遗漏共同自洽。没有其他 `collectTables` consumer。
- 独立 agent 反馈：方案 PASS，但唯一 authority 必须是 typed `ApplicationSchema` object，ORM/DDL/transfer 全部消费该对象；named exports只能是相同引用。不得保留 module-reflection 或平行 names list；验收须锁定 DDL/fingerprint/table set/transfer set与重构前一致。

## 根因与影响面

`collectTables` 将“schema module export能否被 `getTableConfig`解析”作为隐藏注册协议。helper或非table export被异常过滤；table漏export则对所有下游不可见。DDL、fingerprint、DB bootstrap和transfer共享同一不完整投影，互相对比也发现不了遗漏。

当前 `schema.ts` 是 Drizzle query schema的事实来源，不能另造平行名单。最小边界是在该模块显式导入每张 table、导出同一 table symbol，并用这些相同 binding组成 `ApplicationSchema` object；`db.ts`、DDL和transfer共同消费该对象。table枚举按registry key的code-unit顺序稳定排序，以保持旧ES module namespace的MySQL transfer fingerprint合同。

## 实施方案

1. 将 `schema.ts` 从纯 re-export改为显式imports；保留当前named exports，并新增唯一 `ApplicationSchema` object，类型约束为 `Record<string, AnySQLiteTable>`。
2. `db.ts` 的 Drizzle schema与 `ddl.ts.collectTables()`都只消费 `ApplicationSchema`，不反射module。逐项取得table config；无效声明和重复物理table name映射为typed `ApplicationSchemaRegistryError`。
3. DDL与MySQL transfer继续调用同一 `collectTables()`；不增加第二registry或fallback。
4. 扩展真实 storage schema contract：registry names唯一；内存SQLite执行 `SCHEMA_DDL` 后，`sqlite_schema`的application tables与registry names精确相等（明确排除FTS extension virtual tables及SQLite internals）；MySQL transfer snapshot table names等于registry扣除local-only表。
5. 不改持久schema、不迁移数据、不改OpenAPI/SDK。

## 正向验收

- `bun test --timeout=0 test/storage/schema-contract.test.ts`
- `bun run typecheck`（packages/opencorvus）
- `bun run docs:check`
- task-owned `git diff --check`
- 独立只读交付复审至PASS。

## Verification Log

- 方案独立复核：PASS（已采用唯一 ApplicationSchema object 与 ORM/DDL/transfer共同消费边界）。
- 实现/首轮验证：完成。唯一 `ApplicationSchema` 同时进入 Drizzle ORM、DDL和MySQL transfer；异常探测已删除。真实 schema contract 首轮5/5、31 assertions PASS；OpenCorvus typecheck、docs check、task-owned diff-check PASS。
- 独立交付复审首轮：BLOCK。发现object插入顺序改变MySQL transfer fingerprint，且缺少无效/重复registry的typed failure正向测试。
- 修复：`collectTables`按registry key code-unit排序，精确保持旧module namespace 50张表顺序；固定MySQL fingerprint `c4ac1845...4918`并断言snapshot有序表集合；新增invalid/duplicate registry → `ApplicationSchemaRegistryError`正向合同。修后schema contract 6/6、35 assertions PASS；旧/新顺序实测 `same:true`；OpenCorvus typecheck与task-owned diff-check PASS。
- 独立交付复审二轮：pending。
