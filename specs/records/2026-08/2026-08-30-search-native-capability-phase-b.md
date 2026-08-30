# Search-native Capability Phase B — Manifest and capability-grant hard cutover

Status: implementation, final validation, and repeated independent review complete

## Recall

### 用户原始要求

- 将 Tool、Skill、Model Context Protocol（MCP，模型上下文协议）、Expert Squad 与 Harness 从各自成体系的声明面，重构为模型通过统一搜索自行发现能力的系统。
- 逐批实施，不保留 fallback（后备路径）、双 schema、双读写或拆东墙补西墙的过渡实现；持续复核到没有未解决问题与未知条目。

### 本批验收指标

1. 删除 Expert Squad manifest V1 schema、类型、SDK export、reader、writer 输入与全部 13 个 per-kind projection 字段；新 runtime 只接受 `schema_version: 2`。
2. `CapabilityRef`/codec/kind/source 只有一个跨 package 实现，SDK manifest authoring 与 Core Catalog 不再各自解析 capability identity。
3. V2 manifest 只用 package-root `capability_sets` 与每个 scheduler/Agent 的 `capability_refs`；set 只能包含 leaf，projection 只允许 leaf 或一层 set，不允许 nested set、foreign package set或悬空 ref。
4. platform base Tool pool 以显式 CapabilitySet 发布；`base_role` 只选 runtime template upper bound，不自动授予 Tool。Worker Task artifact/coordination transport 由 runtime owner 追加，scheduler transport 由 manifest 的 exact platform CapabilitySet ref 授权，两者都进入 projection revision。
5. `PromptProfileResolver` 只从 typed refs与一层 set expansion建立声明 grant，再按 ref kind/source/owner分派给现有唯一 Skill/Tool/MCP materializer；不得重新引入按 manifest 字段名分裂的 Resolver。
6. 122 个 tracked manifest、四个 embedded package、portable template、SDK authoring、generator/generated payload、OpenAPI/SDK类型、当前架构、测试与文档在同一批升级；V1 source 不留兼容入口。
7. Task package revision、workflow、prompt、permission、OAuth、streaming、Tool/result可见性与当前 eager execution保持；leaf reveal和 `HarnessProjection` grant/receipt hard cut属于 Phase C/D，不在本批形成半套运行时。
8. 聚焦正向测试证明 V2 schema、platform/package set expansion、typed ref materialization、122 个 package真实加载、SDK writer和生成产物一致；当前触及的过期 V1 测试按 V2 合同改写或删除。

### 硬约束

- 不增加 V1 runtime reader、translator、feature flag或 dual-schema parser；这是 unreleased beta 项目的源码/内置产物硬切，外部 V1 package 由 strict version error拒绝并显式重新导入，不在 runtime暗迁 immutable Task binding。
- 不修改当前 occurrence-bound Catalog V2 attachment/carrier、permission continuation、WorkerTurnDescriptor strict payload或 Tool execution owner。
- 不提前删除 eager Tool surface、role/runtime Tool pool、umbrella Tool、`batch`或现有 per-kind `HarnessProjection`；这些必须与 reveal receipt 在 Phase C/D 同一原子 release 删除。
- package MCP 物理目录和 inventory loader保留，但 role-specific字段协议删除；generic typed refs是唯一 projection入口。
- 所有 LLM 调用保持流式；不运行或新增 UI 自动化测试。
- 保留用户未跟踪文件 `packages/opencorvus/script/benchmark/`、`script/video/` 与 ``。

### 已读资料

- `AGENTS.md`
- `specs/records/2026-08/2026-08-30-search-native-capability-harness-refactor.md`
- Phase A1/A2 records
- `specs/current/architecture/{04-extensions,17-code-work-agent-platform}.md`
- `packages/sdk/js/src/{expert-squad-manifest-v1,expert-squad-authoring}.ts`
- `packages/opencorvus/src/capability/{ref,descriptor,harness-projection}.ts`
- `packages/opencorvus/src/agent/{tool-pool-data,tool-pool-contract}.ts`
- `packages/opencorvus/src/expert-squad/{registry,prompt-profile-resolver,provider-names,protocol-schema}.ts`
- 122 tracked `expert-squad.jsonc` manifests and their generator/payload paths

### 全仓搜索结果

- tracked manifest恰为122个，全部是`schema_version: 1`且包含 legacy projection字段；共713个scheduler/Agent projection。
- 13类数组合计：`built_in_tool_ids` 431、default Skill 4、package Skill 807、default Tool 8、package Tool 85、default MCP Tool 136，其余server/package MCP/prompt/resource当前为0；7个projection关闭inherit；264种不同资源组合。
- 201个非generated source/test/current-doc文件直接引用V1类型或legacy字段；SDK manifest V1是Registry、authoring、ProductPillar imports与生成器的公共源。
- `CapabilityRef`当前只在Core，SDK无法复用；Manifest V2若另写字符串parser会立刻形成第二typed identity。
- 当前Tool Catalog inventory只有45个global Tool，Agent Tool pools共有61个core Tool；16个scheduler private Tool未由tool-registry Catalog owner发布。platform set落地必须同时修正这个owner缺口。
- 当前PromptProfileResolver已将legacy字段转为`builtInToolIDs/defaultTools/packageTools/...`运行物化结果；这些结果可以继续作为eager execution内部结构，但它们必须只由一个generic expanded-ref输入产生。
- 当前`HarnessProjection`按kind保存refs，A2 Catalog context hash依赖其projection hash。把catalog ref/hash反写Harness会形成循环，因此本批不采用总方案早期草图中的该字段；catalog binding继续只属于canonical input TextPart。
- 仓库system prompt明确项目未发布且禁止“just in case”migration code；本批删除运行时V1，而不是为假设中的外部消费者保留pre-start V1 reader。V1 package碰到strict schema version错误后必须在V2 authoring/import控制面显式重建。

### 独立 Agent 反馈

- 实施前：无。首轮实现与验证通过后按仓库规则委托未参与实现的独立agent只读审查。
- 审查发现并已关闭：package-set Tool显式provenance丢失与base override不可表达、`expert_squad_author`按`base_role`隐式注入base set、current architecture残留V1引用、同一未发布批次重复version stamp、过期Market 115断言、Light Tool集合顺序断言、Windows内容寻址snapshot与Browser MCP bundle并发publication把合法winner误报为`EPERM`/`EACCES`/`EBUSY`。
- 每项有效修复后均重新运行对应正向合同并再次交给同一独立agent只读复核；最终反馈为无剩余生产代码P0/P1/P2。

## 1. 根因与边界

V1把 capability kind、source与projection membership编码进字段名，造成13列稀疏矩阵；Resolver再逐字段parse、lookup、expand、materialize并重建Harness ref。相同能力身份同时存在“字段类别 + ad-hoc ref string + Provider name + CapabilityRef”四种表示，platform base Tool又由`inherit_base_tools`隐式注入。根因不是缺少另一个统一Registry，而是声明没有直接引用A1已建立的typed capability identity与set。

Phase B只替换声明与grant解析。执行结果仍按现有eager runtime物化，是因为 discovery declaration与execution materialization是不同owner；提前只改一半模型surface才会构成危险双运行时。Phase C/D将以本批输出的exact refs为输入，原子替换Harness/reveal/active Tool surface。

## 2. 唯一 typed identity

`CapabilityKind`、`CapabilitySource`、`CapabilityRef`、`CapabilityRefCodec`与canonical encoded-ref schema移动到`@opencorvus-ai/util/capability-ref`。Core `capability/ref.ts`删除，SDK与Core直接导入util；不保留wrapper或第二codec。

V2 manifest存canonical encoded string：

```text
capability:<kind>:<source>:<percent-encoded-owner-ref>:<percent-encoded-local-ref>
```

公共codec负责decode、strict kind/source、canonical percent encoding与round-trip；manifest schema不使用regex近似解析。

## 3. Manifest V2合同

```ts
interface ExpertSquadCapabilitySetV2 {
  description: string
  member_refs: EncodedCapabilityRef[] // leaf only
}

interface ExpertSquadProjectionV2 {
  base_role: string
  capability_refs: EncodedCapabilityRef[] // leaf or one-level set
  prompt?: string
}

interface ExpertSquadManifestV2 {
  schema_version: 2
  // identity, selector, configuration, workflows unchanged
  capability_sets: Record<string, ExpertSquadCapabilitySetV2>
  capability_projection: {
    scheduler: ExpertSquadSchedulerProjectionV2
    agents: Record<string, ExpertSquadAgentProjectionV2>
    virtual_workflows: ExpertSquadVirtualWorkflows
  }
}
```

package set ref固定为`capability:capability_set:package:<manifest.id>:<set-id>`。`capability_sets` key必须canonical kebab-case；member不得为set、不得重复、必须canonical sort。projection ref不得重复且canonical sort；package set必须属于当前manifest且存在。SDK结构校验这些闭包；Registry再校验leaf对真实package/platform inventory可解析。direct leaf 与 package-set leaf 都是显式projection声明；显式leaf与同一platform base member重合时合并为一个effective grant并保留显式override provenance，两个显式声明或任何transport冲突仍是明确错误。

## 4. Ref owner与materialization映射

| 声明能力 | CapabilityRef | Resolver唯一映射 |
| --- | --- | --- |
| platform base set | `capability_set/platform/tool-registry/<role>-base` | platform set registry展开为Tool leaf |
| built-in Tool | `tool/platform/tool-registry/<tool-id>` | ToolRegistry exact ID |
| default Skill | `skill/platform/skill-manager/<default/skill/...>` | DefaultSkillRef exact lookup |
| package Skill | `skill/package/<squad-id>/<package/skill/...>` | packageSkills exact ref |
| default host Tool | `tool/platform/default-tool-registry/<default/tool/...>` | default Tool ref -> provider name |
| package Tool | `tool/package/<squad-id>/<package/tool/...>` | packageToolBundles exact ref -> provider name |
| default MCP server/leaf | `mcp_*/project/default-mcp-registry/<default/mcp/...>` | config-scoped default MCP owner |
| package MCP server/leaf | `mcp_*/package/<squad-id>/<package/mcp/...>` | package-root MCP inventory owner |

Worker transport 不由 manifest 重复声明：worker runtime 追加固定 platform `worker-transport` set 并把展开后的 leaf 写入同一 resolved projection revision。Scheduler transport 则必须由 projection 精确声明 platform `scheduler-transport` set；未声明就不获得该 Tool surface。Manifest 不能覆盖、冒充或平行实现 transport。

Resolver先canonical expand refs，再按上表dispatch。每个effective ref必须被恰好一个owner消费；unknown owner/kind/source、错误base set、foreign package owner、缺失inventory、provider-name collision、重复explicit来源与transport冲突都返回typed/明确contract error。materializer函数继续单源，不复制Skill/MCP/Tool实现。

## 5. Platform CapabilitySet owner

新platform set registry从现有`AgentToolPool`事实生成：

- `orchestrator-base`；
- 每个RuntimeTemplate ID对应`<runtime-template>-base`；
- scheduler/worker transport sets。

set member都是`tool/platform/tool-registry/<id>` leaf，canonical、无嵌套。tool-registry Catalog source的owner revision同时覆盖完整core Tool inventory与set membership；61个core Tool全部有descriptor，修复private scheduler Tool缺失。Manifest与`expert_squad_author`输入中的`base_role`只决定允许引用哪个base set和projectable upper bound，不隐式增加member；author caller需要base成员时必须把匹配的platform set写入`capability_refs`。

## 6. 122个manifest与生成面

机械转换规则唯一且可重复：

1. `inherit_base_tools: true`增加对应platform base set ref；false不增加。
2. 每个legacy leaf字段按§4映射为typed ref；runtime transport字段不从manifest复制。
3. 同一manifest内，被至少两个projection使用的完全相同非base leaf集合提升为`shared-capabilities-N` package set；其余refs保持flat。集合命名按canonical member tuple排序确定，不依赖文件遍历顺序。
4. 删除所有legacy字段，写`schema_version: 2`、`capability_sets`和`capability_refs`；保持identity、prompts、workflow与非projection字节语义。
5. 转换后用SDK V2 schema、Registry package loader与package source-closure validator正向验证；再次运行转换必须零差异。

相同转换helper由repository codemod、portable template generator、Multica import和`expert_squad_author` blueprint使用；它只生成V2，不成为runtime V1 translator。generated payload/revision/localization在源manifest转换后重建。

## 7. 删除清单

- `packages/sdk/js/src/expert-squad-manifest-v1.ts`及package export `./expert-squad-manifest-v1`；以V2文件/export单源替换。
- Core `capability/ref.ts`；所有调用点直接使用util codec。
- `ExpertSquadProjectionResourcesSchema`、V1 types与所有legacy projection字段。
- PromptProfileResolver的inherit/per-kind field readers、per-field package MCP expansion与由legacy结构反建projection的代码。
- Authoring Tool/SDK tests/docs中的V1字段和示例。
- 当前架构中把per-kind arrays描述为现行合同的文字。

不删除：Tool pool data、eager Tool Registry materialization、per-kind runtime resolved result、current Harness schema、package inventory loaders与execution owners；它们在C/D有明确原子删除门。

## 8. 聚焦验收

正向合同：

- SDK V2接受canonical leaf/set refs并输出同一类型；package set与platform set展开得到确定性相同leaf序列。
- nested/foreign/missing/duplicate/unsorted ref分别映射到明确schema或Registry contract error。
- `base_role`未引用base set时不获得base Tool；引用匹配set时得到与旧显式语义相同的expanded Tool IDs；transport始终由runtime owner加入。
- 122个tracked manifest全部通过真实Registry catalog/full load；embedded payload和portable template使用V2。
- default/package Skill、Tool、Browser MCP、package MCP synthetic fixture各有正向materialization测试。
- SDK writer写出的package可被同一Registry读取，authoring/Multica generator不再产生V1字段。
- Catalog snapshot包含platform sets与61个core Tool descriptor，private scheduler Tool行为target闭合。
- 现有scheduler/worker/runtime recovery聚焦测试继续通过，证明eager execution结果与package revision binding未破坏。

验证命令以本批实际触及测试组成隔离矩阵；另运行SDK tests、`typecheck`、payload/template generators check、docs/architecture/module/package/routes/control checks与`git diff --check`。

## 9. 完成门

- tracked当前源码、SDK、template、generated artifacts与current architecture无V1 schema/export/legacy字段引用；dated历史records可以保留历史事实。
- 聚焦矩阵与真实122-package checker通过。
- 独立只读审查完整差异，无未解决P0/P1/P2；任何有效发现修复后重跑并再次审查。
- 单独提交；fetch/merge upstream、检查全部待推送commit、复验并push后才进入Phase C/D。

## 10. 实施结果

- `CapabilityRef`、codec、kind/source schema 已移动到 `@opencorvus-ai/util/capability-ref`；Core wrapper 与 SDK manifest V1 文件/export 已删除。
- SDK、OpenAPI、Registry、authoring writer、`expert_squad_author`、Multica import、Catalog detail/active projection、Overlay 与 Web facts 已统一到 manifest v2 的 `capability_sets` + `capability_refs`。
- `PlatformCapabilitySetRegistry` 发布 Orchestrator、全部 Runtime Template base sets 及 scheduler/worker transport sets；worker transport 由 runtime 单一追加，scheduler transport 由 manifest 精确 typed set ref 授权。两者都包含各自的 Task Artifact transport 与 `publish_interactive_artifact`，manifest 不能删除 worker transport、覆盖 set membership 或用 package Tool 冒充 platform transport。
- `materializeExpertSquadCapabilities()` 是 Registry 与 Resolver 共用的唯一一层展开和 kind/source/owner dispatch；package set与direct leaf同为显式来源，显式leaf覆盖同一platform base member时保持单一effective grant及显式provenance；错误base set、foreign owner、unknown source/kind、重复explicit来源、transport冲突与悬空set都fail fast。
- tool-registry inventory 从 45 个 global Tool 扩为全部 61 个 core Tool，并在同一 owner revision 发布 platform sets。
- 122/122 tracked manifest 已硬切到 schema v2，legacy projection 字段为0；121个shipped revision record按同一未发布Phase B的最终bytes保持一次发布版本，不保留审查迭代产生的虚假中间版本。最终generator重跑为`{"packages":121,"stamped":0}`。
- generated payload/revisions/search localization、portable template、SDK generated types/OpenAPI、current architecture 和中英文 SDK/Agent 文档均已同步；repository codemod 已删除，不存在 runtime 或维护期 V1 reader。
- 当前 eager Tool/Skill/MCP execution、occurrence Catalog binding、permission/OAuth、Task package revision、streaming 与 Tool/result visibility 保持；Phase C/D 再原子替换 reveal/Harness surface。

## 11. 首轮验证证据

- `bun run typecheck`：SDK import、AI runtime、Expert Squad types 与 8 个 workspace typecheck 全通过。
- `bun run check:package-topology`：10 个 workspace package、lock input 与 generation cycle 全通过。
- `bun run check:module-topology`：1066 modules、5242 runtime edges、clean imports 全通过。
- `bun run check:architecture-index`、`bun run api:routes-check`、`bun run docs:check` 全通过。
- `bunx astro check`：0 errors；仅保留既有 warning/hint。
- SDK full suite：190 pass、0 fail、1002 assertions；包含122个source manifest/portable template authoring validation与Windows owned-process tests。
- V2 focused contract：9 pass，明确验证61 Tool inventory、platform/package set展开、direct/package-set显式语义等价、显式Tool覆盖base默认switch、双explicit冲突、`base_role`无隐式授权、worker transport追加与scheduler transport精确声明、错误base/missing set合同，以及malformed encoded ref通过`safeParse()`返回结构化issue而不抛异常。
- Domain package matrix：13个文件116 pass，覆盖首批10 + 第三至第十批80 + swimlane 10的真实Registry load、安装与scheduler/worker grant解析；16个专项包文件最终55项全部通过，Light顺序断言修正后单文件3/3。
- Generated payload matrix：10个文件20 pass、1207 assertions；Market唯一payload总量117。生产HTTP route matrix：11个文件11 pass，覆盖首批10、第三至第十批80、swimlane10与on-demand payload的Market、install、Settings exact detail、workflow与Skill materialization。
- Catalog/A2 binding：catalog 20 pass；occurrence binding通过包内隔离runner为16 pass、48 assertions；Task package revision pin 6 pass；Orchestrator Tool surface 4 pass；Browser MCP projection 1 pass；Computer MCP 15 pass。
- Authoring/evolution：squad-sdk 5 pass；candidate integrity 13 pass；mutation/feedback/Manager CAS全部通过；typed package Tool provenance fixtures已按真实Provider step + Tool Part合同修复并通过。
- 内容寻址publication：Expert Squad package snapshot单进程+真实双进程2 pass；Browser MCP Node bundle单次build/runtime、真实双进程共享cache与连接复用5 pass。所有竞争收敛都要求目标directory/file存在且实际digest精确匹配，错误目标不被吞掉。
- generator final rerun：portable template生成成功，revision `stamped: 0`，payload与search localization生成成功。
- 精确审计：`files=122 v2=122 legacy=0`；当前source/SDK/template/generated/current architecture的V1类型、export与13字段搜索结果为0。
- 真实Overlay视觉验收：隔离`/ui/`两轮进入Installed Expert Squads；Base Developer有效投影展开为29个Tool、1个package Skill、17个MCP项，Advanced package-set声明展开布局正常，最终Scheduler仅呈现单一`capability_refs`行并显示3个显式Tool计数；长ref换行、折叠交互与布局人工复核正常，浏览器console error为0。未运行UI自动化测试。

## 12. 首轮验证中发现并根治的问题

- 初始 transport set 遗漏旧运行时无条件提供的 `publish_interactive_artifact`，随后又把完整 scheduler transport 无条件追加到所有 scheduler；真实 Light 咨询验收证明这会重建隐藏 Artifact Tool tail。最终合同把 `publish_interactive_artifact` 保留在两个 platform transport set 中，仅 worker transport 由 runtime 追加，scheduler transport 改为 manifest 精确声明；Light 不声明该 set，其余保留旧有效 transport 的 shipped scheduler 显式声明。
- 多处测试把 Tool/Skill list误当顺序协议；V2 canonical ref展开后顺序稳定但不同。集合语义断言改为canonical/sorted comparison，运行输出仍确定。
- Mirror Prism fixture按字符串把 `deep-research-base`误改成不存在的`prism-base`；fixture改为保留真实Runtime Template base set，并在变更base role时同步替换typed base ref。
- 六个package Tool ABI测试只伪造scope中的Tool Part ID，未持久化真实Provider step/Tool Part，已按当前provenance合同补全真实事实并重跑通过。
- SDK full suite首次直接运行缺少Windows process supervisor；先运行仓库提供的helper构建器并显式绑定精确二进制后，原suite 190/190通过。
- SDK manifest父级`superRefine`首次直接decode malformed percent encoding会使`safeParse()`抛异常；manifest V2本地`decodedCapabilityRef()`改为try/decode guard，并仅在成功时执行owner/set闭包校验，新增回归后返回结构化issue。
- 独立审查复现package-set Tool leaf丢失显式provenance，导致build默认关闭Tool无法被package set启用，且base+direct leaf被误判双grant；统一GrantOrigin后，direct/package-set都为显式来源、base重合为单一override、transport仍独立。基于`git show HEAD`逐项补回V1显式Tool refs，122个manifest/713个projection审计为`effectiveMismatch=0, explicitMismatch=0`。
- 第二次上游集成终审发现 current architecture 仍有一段用已删除的 `inherit_base_tools` / `built_in_tool_ids` 描述 scheduler Artifact 投影。该段已改为 V2 typed capability-ref 契约：scheduler transport 只来自 manifest 的精确 platform set 或 direct leaf，worker transport 仍由 platform 唯一追加；修正后 current source/docs 的 legacy 字段搜索重新为零。
- 独立审查发现`expert_squad_author`仍依据`base_role`自动注入base set，与manifest/Resolver合同矛盾；builder注入已删除，Tool schema、两份authoring Skill和正向definition contract统一要求caller显式声明匹配base set。
- 独立审查发现current architecture仍引用已删除manifest V1文件、类型与入口表；`04-extensions.md`和`17-code-work-agent-platform.md`已统一到V2 current authority。
- 首轮generator后继续修复同一未提交Phase B bytes，若直接把工作区generated revision当新baseline会把普通包`.1`虚增到`.2`并制造未发布中间版本；已恢复单次发布目标版本，以最终bytes重建revision/payload/localization并再次确认`stamped: 0`。
- generated payload真实Market总量早已是117，但九个本批触及的integration测试名与断言仍写115；已统一到当前单一payload事实并重跑20/20。
- Windows下两个进程发布同一Expert Squad content digest时，loser可能在winner已原子发布完整target后收到`EPERM`/`EACCES`/`EBUSY`；Registry原先只承认`EEXIST`/`ENOTEMPTY`。现仅在target为directory且重算package digest精确等于basename时收敛，双进程barrier合同通过；source、embedded、Manager、Multica、feedback与runtime Resolver入口均复用该单一materializer。
- 横向审计发现Browser MCP内容寻址bundle存在同型竞争；现对五类Windows/POSIX竞争错误都要求已发布file的实际SHA-256精确匹配后才收敛，新增真实双进程共享cache合同并通过5/5。
- 直接`bun test`会绕过OpenCorvus测试runner的隔离root与supervisor生命周期，导致Catalog scoped MCP用例出现缺失settlement marker；改用仓库真实`script/run-tests.ts`后16/16通过，未以工具链失败掩盖产品验收。
