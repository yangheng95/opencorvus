# CS-021 Provider live-model refresh

## Recall

- 原始要求：修复两个公开 Provider models refresh 路由返回空成功的问题；先深挖定义、调用、公共 SDK、文档、数据和测试，再用单一真实 refresh authority 实现，无 fallback，并增加聚焦非 UI 正向测试。
- 验收：project 与 global 路由都调用同一个 `Provider.refreshModels`；该 owner 从已配置 OpenCorvus Provider 的 `/models` 获取 live identity，严格校验后通过唯一 catalog transaction 原子提交；成功 receipt 返回精确 provider/count/ids，失败保留旧 catalog；route 成功后仍由 canonical invalidation owner 清缓存。
- 硬约束：不触碰 `workspace.ts`、Overlay 或共享 spec 索引；不运行 UI 自动化；不委托；不 stage/commit/push；无旧空实现、fallback、双读或平行 writer。typed 503 属公共契约，必须同步生成 OpenAPI、SDK error type 与 API 文档。
- 已读资料：根 `AGENTS.md`；`specs/current/architecture/06-provider.md`；连续审计台账 CS-021；`provider/{provider,models,operations,model-schema}.ts`；`server/routes/{provider,global}.ts`；`server/provider-refresh.ts`；Auth/Config 定义；bootstrap catalog；SDK/OpenAPI 与 API docs 调用面。
- 全仓搜索：`Provider.refreshModels` 只有 project/global 两个 route caller；SDK/Overlay 只消费既有 response contract；不存在 `hexin-endpoint.ts`、`hexin-discovery.ts`、`hexin-profiles.ts` 或 `/v1/model/info` 实现，历史可达与 unreachable tree 也未找到可复用协议实现。现有唯一真实 OpenAI-compatible `/models` transport 是 `provider/operations.ts`，唯一 durable writer 是 `models.ts` 的 catalog transaction。
- 独立 agent 反馈：无（本批明确禁止委托；完成后由父任务安排只读复审）。

## 根因与影响面

`Provider.refreshModels` 直接构造 `{ ok: true, providers: [] }`，因此两条公开路由会执行 cache invalidation 并向 SDK/Overlay 宣告刷新成功，但没有网络观察或 durable mutation。现有 `discoverProviderModels` 只能返回临时 ID，不能成为 catalog writer；`ModelsDev.refresh` 刷新 registry declaration，不能兼任 live identity writer。正确边界是在 Provider 层解析当前 scope 的已配置 OpenCorvus endpoint/credential并获取 identities，在 ModelsDev 层复用唯一锁、严格 schema 与 atomic write 提交 provider models。

远端协议/校验失败保持 HTTP 200 的现有显式 `{ok:false,error}` contract；saved Auth observation 失败保留 `AuthReadError` typed 503，因此两条 refresh 路由必须公开声明该 error 并同步生成 OpenAPI/SDK/docs。catalog 是共享 durable authority，因此 project/global 两路成功后继续使用同一个全局 invalidation owner。

## 方案

1. 在 `ModelsDev` 暴露窄的 `replaceProviderModels` transaction：只接收一个完整 provider snapshot，并在已有 catalog 上原子替换；仍由现有锁、strict parse、mode 0600 atomic write、Data reset 唯一拥有提交。
2. `Provider.refreshModels(config?)` 解析相应 scope 的 canonical Provider state，只刷新 provider ID `opencorvus`。top-level `config.provider.opencorvus.api`（或 catalog declaration `api`）是唯一 discovery endpoint；调用 `/models` 与 `/model/info`，拒绝空/重复 identity、重复 metadata和新 identity metadata缺失。已有 identity可保留既有canonical metadata；禁止制造 capability/limit默认值。远端全部成功后一次提交。
3. bootstrap 中的 OpenCorvus declaration 必须进入 canonical catalog，和 Kilo 一样由 bundled local declaration 保留；registry refresh 不得删除它。旧默认 durable catalog 由唯一catalog owner在锁内原子迁移补入；显式override不迁移并保持strict。
4. 增加 production-route 测试：真实本地 HTTP fixture、隔离 catalog/Auth/Config，project/global写入不同scope endpoint并断言分别命中；每次成功后经真实 public reader 验证 shared catalog invalidation 与 scope projection，验证精确 receipt 与 durable catalog；duplicate/strict metadata response走显式失败并断言旧 bytes 未变；保存恢复既有Auth/config。损坏真实 Auth 文件时两条 route 共用的 server error owner投影 typed 503。

## 验证计划

- `bun test --timeout=0 test/provider-live-model-refresh.test.ts`
- `bun run typecheck`（`packages/opencorvus`）
- 根目录 API route/docs/SDK import checker（若 package scripts存在）
- task-owned `git diff --check`

## reviewer 阻断与修复

- `Auth typed 503`：refresh owner 在读取 Config/Provider projection 前严格观察真实 Auth owner；`AuthReadError` 不再压成 `{ok:false}`，project/global route均声明 503，并同步 OpenAPI、SDK error type与生成文档。
- `strict live-info schema`：新增独立 `LiveModelInfo` wire schema，拒绝 unknown fields，且 `temperature/options` 不继承 persisted catalog default；非法 metadata 不进入唯一 writer。
- `真实 default catalog 迁移 seam`：默认 durable file 在原 catalog lock 内严格读取、补 bundled OpenCorvus declaration并 atomic 0600写回；测试对真实临时文件验证首次迁移与二次幂等。显式 override仍不迁移且 strict validation。
- `scope projection/invalidation`：project refresh 后立即经 `/provider` 看到 project IDs；随后 global refresh 经 `/provider` 与 `/global/providers` 同时看到 global IDs，证明 shared catalog revision 的全 project/global invalidation。

## 首轮验证记录

- `bun test --timeout=0 test/provider-live-model-refresh.test.ts`：PASS，5 tests / 17 assertions；覆盖真实默认catalog文件迁移、explicit override strict、project/global独立endpoint、每次刷新后公共projection、duplicate/strict metadata bytes preservation和Auth typed 503。
- `bun run typecheck`（`packages/opencorvus`）：PASS。
- `bun run typecheck`（`packages/sdk/js`）：PASS。
- `bun run docs:check`：PASS（338 operations / 25 groups）。
- `bun run check:sdk-imports`：PASS。
- `bun run api:routes-check`：PASS（6 rules，34 route files）。
- task-owned `git diff --check`：PASS。

## 独立交付复审

- 最终结论：PASS，无剩余 actionable。
- 独立 reviewer 逐项核验并复跑了 saved Auth typed 503、strict `/model/info` publication schema、默认 catalog 的 locked/atomic 幂等迁移、显式 override strict 合同、project/global scope endpoint 选择及 canonical invalidation 后的公共 projection。
- 独立复验保持 focused `5/5`、`17 assertions`，OpenCorvus 与 SDK typecheck、docs checker、route checker、SDK import checker、task-owned diff check 全部通过；未运行或新增 UI 自动化。
- Commit/push：实现已具备精确提交条件；push 延后到完整 remediation goal 收口并按用户要求先 fetch/merge upstream。
