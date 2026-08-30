# Search-native Capability Phase A1 — Catalog Single-source Hard Replacement

Status: complete; final independent closure review PASS

## Recall

### 用户原始要求

- 当前 Tool、Skill、MCP、Expert Squad、Mission Skill 与 Harness 各自成体系，改为模型可搜索发现的统一 Harness。
- 先调查行业与框架根因，再逐批重构；每批必须成体系，不能拆东墙补西墙。

### 本批验收

1. 删除 `tool/capability-catalog.ts` 这一临时全能 builder，不保留 wrapper、fallback 或双读。
2. `capability/descriptor.ts` 成为 stable descriptor/source、caller projection/view 与 set schema 唯一事实源；`capability/catalog.ts` 成为 canonical snapshot、cache 与 search 唯一实现；`tool/capability-runtime-catalog.ts` 是唯一owner组合点，避免pure capability内核反向依赖Tool/Expert Squad。
3. Source revision 必须由 Tool Registry、Skill catalog、Mission Skill catalog、Expert Squad catalog、Harness/Worker descriptor、MCP config/status 等真实 owner fact提供；Catalog 不再把最终 entries 重新 hash 后冒充 owner revision。
4. Snapshot hash覆盖完整 canonical caller context、owner/projection revision vectors、stable descriptors、caller views与sets；相同输入返回同一个 immutable snapshot实例，revision或context变化返回新实例。
5. Conversation、Mission、Task scheduler、Task worker和stage-owned Tool均进入同一 runtime catalog组合路径；现有execution surface保持eager，本批不伪称完成lazy reveal。
6. Search继续只返回metadata，不认证、不批准、不执行；现有`capability_search` Tool输入合同本批保持不变，避免与Phase C/D reveal receipt产生过渡双协议。
7. Owner读取失败返回typed owner-unavailable错误，不发布缺owner的“完整”snapshot。
8. 聚焦正向测试覆盖descriptor/view/source canonicalization、`__proto__` owner、digest/duplicate/set合同、owner revision、snapshot identity/cache、Mission held set、Conversation与scoped MCP状态、Task/stage source与stale revision。

### 硬约束

- 保持所有LLM调用流式；不修改Provider调用链。
- 不新增Harness表、权限系统、binder、Provider特判或active capability影子状态。
- 不修改Expert Squad manifest V1；manifest V2是Phase B原子替换。
- 不修改模型面eager Tool集合；leaf reveal、receipt、AttachmentStore binding和rolling active set属于Phase C/D。
- 本批只允许一个Catalog实现；旧文件和旧imports必须同批删除。
- 不运行或新增UI自动化测试。
- 保留用户已有未跟踪文件。

### 已读资料

- `specs/records/2026-08/2026-08-30-search-native-capability-harness-refactor.md`
- `specs/current/architecture/{04-extensions,06-provider,17-code-work-agent-platform}.md`
- `packages/opencorvus/src/capability/{ref,harness-projection,fuzzy}.ts`
- `packages/opencorvus/src/tool/{capability-catalog,capability-search,registry}.ts`
- `packages/opencorvus/src/{skill/manager,mission-skill/catalog,mcp/index}.ts`
- `packages/opencorvus/src/expert-squad/prompt-profile-resolver.ts`
- `packages/opencorvus/src/agent/{runner,worker-turn-descriptor-facts,dispatch-adapter-contract}.ts`
- Capability Catalog、Conversation MCP、Expert Squad Catalog现有聚焦测试。

### 全仓搜索与当前根因

- 重构前生产调用只从`capability-search.ts`进入旧`CapabilityCatalog.runtimeSnapshot()`；测试另有两个直接imports，因此旧builder可以一次性替换。
- 当前一个约500行文件同时定义schema、生成伪owner revision、读所有owner、做caller projection、ranking和snapshot；没有模块边界可用于精确invalidations。
- Tool source revision由最终entry hash产生；Skill虽已有cross-process publication revision但未进入Catalog；Expert Squad内部已有catalog revision但`recommendationCatalog()`丢弃它；Mission Skill没有公开snapshot revision。
- Task Harness已有immutable projection hash，Worker descriptor已有stage tool identity/materializer facts；当前Catalog却遗漏stage Tool。
- MCP已有`needs_auth`/disabled/failed状态和listChanged事件；旧Catalog只把assignment描述为`visible`，没有把完整config digest、只读status provenance和scoped Task owner状态投影出来。
- 当前search input、Panel/Skill owner和文档仍依赖`query`、`next_owner_kinds`与`catalog_revision`。本批保留这一model-visible合同，但只保留一个新实现，不增加compat reader。

### 独立 Agent 反馈

- 实施前：无。
- 首轮验证后：独立只读审查判定FAIL，发现4项P1、2项P2：owner descriptor与caller view未拆分；owner revision混入projection且MCP identity不完整；runtime single-flight key跨mutation复用旧Promise；普通object/NUL连接key存在`__proto__`/碰撞合同漏洞；Task scoped MCP状态未进入Catalog；测试与spec声明不一致且无关Markdown被整体格式化。
- 处理：descriptor/view/source/projection已实体拆分；MCP发布完整配置不可逆摘要及global/scoped status revision；删除runtime in-flight map；revision vector改用`Map`+`Object.fromEntries`，cache key改为canonical tuple digest；补齐合同与真实Computer scoped-owner测试；无关Markdown恢复后仅保留单行架构更新。
- 第二轮独立审查：判定FAIL，发现2项P1、2项P2：stable behavior仍复用model-facing字符串navigation；global MCP owner吸收Project内其他scoped owner inventory；scoped owner关闭后仍报告connected；scoped tuple排序重新使用NUL拼接。
- 处理：新增exact-ref `CapabilityBehavior`并验证全部target存在，legacy `CapabilityNextOwner`仅留在caller view/search result；global MCP owner只读global connection，Conversation Browser/Computer改由exact Host Session owner独立发布；scoped owner closing/closed时抛typed错误且runtime映射owner-unavailable，成功close清空catalog；tuple改为canonical JSON并以反序/NUL真实owner测试验证。
- 第三轮独立审查：判定FAIL，发现1项P1、1项P2：Conversation Harness仍将Host Session MCP Tool编码为`mcp-config` ref而Catalog改写成Host owner ref；MCP owner revision preimage仍有locale-dependent排序。
- 处理：Host Session物化owner现在发布exact Capability refs，Session Loop把ordinary global与Host scoped ref分别交给Conversation Harness原样冻结；Runtime只消费Harness完整ref且不按local ID改owner。MCP config/status/tool/tuple与Harness canonical排序统一使用code-point comparator/canonical digest，并以大小写、重音、非ASCII和反序输入验证相同revision。
- 第四轮closure独立审查：无P0/P1，剩余1项P2：Mission Skill新owner revision仍使用locale/NUL拼接排序。
- 处理：Mission Skill scan、Skill name与issue tuple全部切到canonical code-point/JSON tuple排序；revision构造抽成owner pure function，并以大小写、重音、非ASCII、NUL及反序facts验证相同revision。
- final closure独立审查：PASS；完整staged差异无剩余P0/P1/P2。

## 1. 本批边界

本批是Phase A的第一刀，不宣称完成整个search-and-reveal运行时。它完成metadata Catalog的单源硬替换，并为后续A2/Phase C/D提供稳定owner revisions和context snapshots。

明确排除：

- AttachmentStore catalog binding与input Part metadata；在没有reveal receipt消费它之前提前持久化只会形成无人读取的影子事实。
- `queries[]`、`exact_refs`、discover/execute grants、leaf schema materialization、CAS receipt与active set；这些必须与Phase C/D执行面原子切换。
- Manifest V2、CapabilitySet在package authoring面的实际使用；本批只建立schema并验证非嵌套约束。
- MCP动态leaf enumeration；本批只统一configured/projected inventory与真实status，inspection后successor occurrence属于Phase C/D。

## 2. 目标模块与合同

```text
owner facts
  -> tool/capability-runtime-catalog.ts adapters
  -> CapabilityCatalogSource (stable descriptors + explicit owner_revision)
  -> CapabilityCatalogProjection (caller views + projection_revision)
  -> capability/catalog.ts canonical context snapshot/cache
  -> caller metadata view
  -> capability_search
```

### `capability/descriptor.ts`

- `CapabilityDescriptor`：typed ref、bounded metadata/search terms、exact-ref `CapabilityBehavior`与metadata digest；行为使用`tool_ref`、`loader_tool_ref`、`action_tool_ref`及MCP exact ref，禁止复用model-facing字符串navigation，也禁止携带caller、assignment、policy或当前availability。
- `CapabilityCatalogViewEntry`：以descriptor ref+digest绑定owner metadata，仅携带caller visibility、availability与当前exact next-owner。
- `CapabilitySetDescriptor`：one-level leaf members；set不得嵌套。
- `CapabilityCatalogSource`：`owner_ref`、explicit `owner_revision`、stable descriptors、sets。
- `CapabilityCatalogProjection`：`owner_ref`、context `projection_revision`与caller views；Catalog不得把projection digest冒充owner revision。
- Descriptor digest由descriptor构造器对除digest外的完整canonical metadata计算；parser拒绝错误digest。

### `capability/catalog.ts`

- `createCapabilityCatalogSnapshot({context,sources,projections})`验证owner/ref/view/set/duplicate/digest、所有behavior target存在并canonical sort。
- `catalog_revision = SHA-256(canonical complete payload)`；不是entries-only hash。
- project-local bounded cache按完整revision返回immutable snapshot；相同hash必须复用对象。
- Search只消费snapshot，不读取Config、filesystem、MCP或Session。

### `tool/capability-runtime-catalog.ts`

- 唯一runtime composition root；判定caller并读取owner facts。
- 聚合器留在Tool组合层；`capability/**`保持不依赖Skill/MCP/Expert Squad/Tool runtime，遵守既有module-topology单向边界。
- Tool Registry source包含完整registry inventory与revision；context view仅投影当前execution/Harness允许的Tool。
- Skill source在同一个publication owner范围内返回revision+inventory。
- Mission Skill与Expert Squad返回`{revision, items}` snapshot，不在Catalog重新hash伪造revision。
- Task package/Harness source绑定projection hash；stage source绑定Worker descriptor hash、adapter ABI和stage IDs。
- MCP global owner revision覆盖完整config的不可逆digest、global connection inventory与observed status，不吸收任何scoped owner；Conversation Browser/Computer由exact Host Session owner独立发布，并在物化后把同一完整Capability ref写入Harness，Runtime禁止按local ID换owner。raw配置/凭据不出owner API。scoped Task MCP owner按共享connection下的每个精确provider alias发布config digest与connected/auth/failed状态；Task所有`mcp_*` view消费该status，Harness assignment仅进入projection。closing/closed owner fail-closed；`needs_auth`、disabled/failed映射为明确availability。
- runtime composition不跨请求join Promise；每次读取当前owner snapshot，复用只来自owner既有cache/single-flight和Catalog内容寻址publication，防止mutation后的请求加入旧in-flight结果。

## 3. 删除清单

- 删除`packages/opencorvus/src/tool/capability-catalog.ts`。
- 删除`source()`、`sourcesFromEntries()`、entries-derived revision和每call临时snapshot builder。
- 所有生产/test imports切到`capability/{descriptor,catalog}`与唯一`tool/capability-runtime-catalog`。
- Tool inventory revision来自cycle-free `tool/capability-inventory.ts`，不得由runtime aggregator反向导入会动态加载`capability_search`的`ToolRegistry`。
- current architecture中“每次调用重建”改为A1已完成；lazy reveal仍保持pending。

## 4. 聚焦验收

正向合同：

- 相同source/projection/context不受输入顺序影响，产生相同revision并复用同一frozen snapshot。
- owner revision、set member、descriptor metadata、caller context任一变化均产生新revision。
- duplicate owner/ref/view、foreign owner ref、nested set、错误descriptor/view digest与未知behavior target映射到明确typed contract error；`__proto__`是正常own key且duplicate仍被拒绝。
- Skill source返回Skill publication revision；Mission Skill/Expert Squad snapshot暴露各自revision。
- Task worker snapshot包含stage owner source；scheduler不伪造stage source。
- MCP`needs_auth`返回`requires_auth`，disabled/failed返回`unavailable`，正常assignment保持`visible|installed_unbound`；config-only观察有明确provenance并且endpoint变化推进owner revision；真实Conversation Host Session与Task scoped Computer owner各自发布独立connected inventory，closed owner映射typed unavailable。
- stale expected revision返回现有typed stale error。

命令：

```text
bun test test/capability/catalog.test.ts test/mcp/computer-contract.test.ts test/expert-squad/catalog-index.test.ts
bun test test/conversation-tool-execution-authority.test.ts test/execution-authority-tool-surface.test.ts test/server/conversation-capability-route.test.ts
bun run docs:check
bun run check:architecture-index
bun run check:module-topology --index
```

## 5. 后续批次门

A1通过后，下批A2只做catalog binding/admission与owner event invalidation；Phase B再替换manifest声明；Phase C/D才原子删除eager model surface并引入reveal receipt。任何后批都不得恢复`tool/capability-catalog.ts`或新增第二个search index。

## 6. Delivery record

- 已删除旧`tool/capability-catalog.ts`；pure descriptor/catalog与唯一Tool-layer runtime composition root已替换全部production/test imports。
- 实施中横向发现并修正既有module-topology边界：owner aggregator不能放回`capability/**`；最终位于`tool/capability-runtime-catalog.ts`，cycle-free Tool inventory单独由`tool/capability-inventory.ts`发布。
- 实施中发现`MCP.status()`会首次初始化state并拥有staged credential settlement；Catalog改用只观察已存在state的`MCP.observedCatalogSnapshot()`，未初始化server从Config纯投影为带`config_only` provenance的disconnected/disabled状态。
- `CapabilityCatalogSource`与`CapabilityCatalogProjection`分别保存真实`owner_revision`与context `projection_revision`；Catalog revision覆盖完整context、两组revision vector、stable descriptors、caller views与sets。
- `owner_ref`/revision vectors全程使用`Map`，最终通过`Object.fromEntries`产生own data properties；source cache key使用canonical tuple digest，不使用可碰撞分隔符拼接。
- stable descriptor behavior已与legacy search navigation拆分为exact-ref union；Catalog验证所有行为target存在并把descriptor digest绑定到该exact行为。
- MCP global owner发布full-config irreversible digest、read-only provenance/status revision且不union scoped inventory；Conversation Host Session与Task scoped owner分别发布独立inventory/revision。Host Session exact ref从物化层贯穿同一Harness/Catalog，scoped close fail-closed，runtime in-flight request join已删除。
- 所有进入MCP/Harness revision preimage的字符串排序使用仓库canonical code-point comparator，不依赖locale/ICU。
- Mission Skill owner revision同样使用canonical Skill name/JSON issue tuple排序，不依赖locale或NUL分隔符。
- 聚焦测试：69 pass / 0 fail / 275 assertions，覆盖Catalog合同、exact behavior/ref、Mission/Expert Squad canonical owner、global/Host Session/Task scoped Computer MCP、关闭生命周期、NUL/Unicode canonical tuple、Conversation capability、真实Task scheduler Catalog、execution authority和真实Worker stage/restart路径。
- `bunx tsc --noEmit -p packages/opencorvus/tsconfig.json`、`docs:check`、`check:architecture-index`、`check:module-topology --index`与diff check通过。
- 独立只读审查：首轮4项P1、2项P2、第二轮2项P1、2项P2、第三轮1项P1、1项P2及第四轮1项P2已全部处理；final closure复审PASS，无剩余P0/P1/P2。
