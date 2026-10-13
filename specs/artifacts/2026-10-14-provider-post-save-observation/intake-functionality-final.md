# 第12批只读补充：Provider 保存后读取与已提交回执

## Recall、范围与证据强度

Root要求一层只读审计完整相关历史、唯一 committed receipt producer/consumer、可复用的顺序 settled followups，以及纯业务正向测试和诊断中的配置凭据边界。只允许此独有 scratch；没有产品、测试、正式 spec、索引或其他 owner 文件修改，没有运行测试、服务、UI 自动化、模型或真实凭据请求，没有再次委托。

当前源码读取时 HEAD 为 `04fcd0115d7dcfea514ce14aedb0baa196a6f707`，工作区存在并行 server/restart/compaction 等修改，全部保留。`git rev-parse --is-shallow-repository` 为 `false`。结论仍是源码与历史合同证据，不是本轮实际 HTTP 409 或 UI 复现。前一份 intake 位于 `.tmp-codex-provider-empty-declarations-01a133/intake-functionality-batch12.md`。

## 一、唯一回执及全部直接解释者

当前后端唯一定义在 `packages/opencorvus/src/config/config.ts:2014–2048`：

```ts
class GlobalConfigCommittedReconcileError extends AggregateError
class ProjectConfigCommittedReconcileError extends AggregateError
// 两者 readonly committed = true，readonly config: Info，errors 来自 AggregateError。
Config.committedMutationReceipt(error: GlobalConfigCommittedReconcileError | ProjectConfigCommittedReconcileError)
// => { name, data: { committed: true, message, config, failures: string[] } }
```

`config` 是完整当前 `Config.Info`，不是安全诊断摘要。`failures` 是实际 Error.message / String(error)，不是缓存状态或推测。

生产直接构造点：

- `config.ts:2112`：MCP.reconcileProjectConfig、Provider.reset、NativeAgentRegistryLifecycle.reset、ChannelSupervisor.sync 的实际拒绝，经 Promise.allSettled 聚合为 Project 回执错误。
- `:2131`：config.changed 的 GlobalBus.emitAndWait 失败，同一 Project 错误。
- `:2173`：原 pending transition 未收敛时保留 queued target / writer retry，再以本次 transition.after 生成 Project 错误。
- `:2924`：global writer 的 cache/project settlements 聚合为 Global 错误，config 来自 getGlobal。

HTTP（Hypertext Transfer Protocol，超文本传输协议）直接 producer 只有两处：

- `server/routes/config.ts:103–104`：只捕获 Project 类，调用唯一 `committedMutationReceipt`，返回 409。
- `server/routes/global.ts:1291–1292`：只捕获 Global 类，调用同一函数，返回 409。

因此 409 本身不是提交证明。候选模型/能力校验 400、NonCanonicalConfigFileError 409、AuthReadError 503、任意网络异常保持原合同。SDK（Software Development Kit，软件开发工具包）与文档生成没有找到这两个名称；路由目前把 409 描述为 NonCanonicalConfigFileError。这是既存公开文档缺口，不能据此抹去实际回执，也不要求为本次 Overlay 消费修复更换后端协议。

另外两个直接后端消费者：

- `config/update-global.ts:25–33`：普通成功与 Global committed 错误都发布原 global settlement；错误仍 rethrow。三个公开包装签名分别是 `updateGlobalConfig(config: Config.Info)`、`updateGlobalConfigPatch(patch: Config.ProjectMergePatch)`、`updateGlobalConfigPatchAtomic(resolve(currentGlobal: Config.Info, currentWritable: Config.Source))`。
- `skill/manager.ts:1454–1462`：Skill replacement 尝试按唯一 durable publication 收敛；backward 或原错误是 Global committed 时保留抛出，不把已发布配置误当未写入。

同一 writer 的生产调用面另外包含 Conversation capability、Provider removal、MCP configure/cleanup、Expert Squad profile 切换、System Terminal profile、Skill mounts 与 Skill manager。具体当前直接调用为 conversation/capability.ts:289、provider/removal.ts:63/67、mcp/index.ts:2808/2872、routes/expert-squad.ts:396/422、system-terminal/profile.ts:588、skill/mounts.ts:635、skill/manager.ts:932。它们复用 writer，并不都是上述两个 HTTP 回执 producer；不要假称所有外围路由都已显式序列化这种 409。

前端唯一 decoder 在 `packages/overlay/src/services/config.ts:139–146`：

```ts
function committedConfigFromError(error: unknown): Record<string, any> | undefined
```

当前要求 ApiError、对象 body.data、committed===true 与对象 config；没有检查专门 name/status，也没有排除数组。唯一三个直接消费者是 `patchConfig:165`、`patchGlobalConfig:188`、`updateConfigPath:478`。均在原 authority/selection/directory ownership 成立时更新 appStore.config，并继续抛出原错误。`updateConfigPath` 的 GET→mutator→mergePatch→PATCH 签名与短路无 diff 成功合同保持：

```ts
async function updateConfigPath(
  configPath: string,
  mutator: (config: Record<string, any>) => void,
  ownsResponse: () => boolean,
  authority: ApiAuthority,
): Promise<any>
```

全仓当前源码名字搜索没有第二 config receipt decoder。其公开 wrapper 被 ChatComposer、TaskDirBar、NetworkPanel、ChannelsPanel、ProvidersPanel、expert-squad service、permission-mode service 使用；导出 reader 不应改变这些调用的成功值、原错误 identity 或 owner 规则。普通 task deletion 的 committed/taskIDs 回执是不同公共合同，不可混作 config 回执。

## 二、历史为何留下当前缺口

完成的相关全部 refs 路径搜索：

```text
git log --all --format='%h %s' -G 'committedConfigFromError|committedMutationReceipt|ConfigCommittedReconcileError' -- packages/overlay/src/services/config.ts packages/opencorvus/src/config/config.ts packages/opencorvus/src/config/update-global.ts packages/opencorvus/src/server/routes/config.ts packages/opencorvus/src/server/routes/global.ts packages/opencorvus/src/skill/manager.ts
git log --all --format='%h %s' -G 'followups|settled.push' -- packages/overlay/src/components/settings/ProvidersPanel.tsx
git log --all --format='%h %s' -S 'formatErrorDetails(e)' -- packages/overlay/src/components/settings/ProvidersPanel.tsx
```

已读相关原 diff/blame：

- `65d0bfc983`（2026-08-07，保留的根提交 OpenCorvus v0.0.35beta）已有两类错误、serializer、前端 reader、SaveKey 的 followups 和 Save 内 configCommitted 成功后置 true。不能猜测根提交之前的事故来源。
- `6264aff841`（2026-08-14）把 project config 的 GlobalBus.emit 改成 await settlement，与 MCP 拒绝一起进入 Project committed 错误；对应历史记录 `2026-08-12-random-expert-squad-self-evolution-e2e.md:3138–3158`，根因是 Organizer 监听者 project identity 与跨 Instance 归属，原记载明确已提交投影失败可见与精确重试。
- `c01d96cd3`（2026-08-26）Skill catalog replacement 改为 durable occurrence，保留 Global committed 错误的前向事实/回滚边界。
- `830204e0d7`（2026-08-27）配置跨 backend generation 收敛。pending / queued latest target / writer retry / identity lease 归入原共享机制；既有回执用于已提交但未收敛，不是让客户端再 PATCH 一次的请求。
- `677f7afd17`（2026-10-06）Provider 的 authority/selection 修复将 SaveKey `Promise.allSettled(followups.map(run))` 改成现在逐项 await 的 settled loop，明确 cleanup 完成/失败后再 reload。保留原 accepted/private outcome；没有修正 Save 的首次 committed receipt 分类，也没有无 Key reload。
- `6f8c5905fd` 调整 SaveKey 清理调用格式/范围保真；没有新增回执定义。
- `373d8682d`（第10批）用可展开 `formatErrorDetails` 替换 Provider 旧 `describeFailure`（旧函数只取 ApiError/Error.message）。这提高诊断完整性，但 typed config receipt 现在带完整 body 进入详情的风险必须在当前触及保存路径解决；原 console.error raw error 更早已存在。
- 历史查询中的 `2a55323e1` / `4ae54dbe3` 是 checkpoint / LF 恢复，不是第二回执实现。

`specs/artifacts/2026-10-05-connection-workspace-authority/next-provider-panel-audit.md:7,59,71,78–83` 明确原 authority 贯穿复合动作、已提交不能被后续 GET 失败改称未提交，允许为已证重复保存行为抽取实际生产 helper，但不能做 test-only orchestrator。`root-review-project-aba.md:50,58` 明确 committed receipt 的真实 config/failures/original identity 保留，UI 退休只阻止过期投影。当前 05-config:204–221 和 06-provider:403–409 继续约束 owner、pending transition 与原 accepted outcome。

## 三、顺序收敛 primitive 调查结果

没有找到前端或 util 已导出的通用 async serial-settled helper。可复用的最小实现就是 `ProvidersPanel.tsx:774–809` 的 SaveKey loop：

```ts
Array<{ phase: string; run: () => Promise<unknown> }>
// 顺序 await 每个 run，收集 PromiseSettledResult；再由 phase 派生 issues。
```

两个名字接近但不能替代的现有 primitive：

1. `overlay/services/diagnostics.ts:44` 的 `runPostCommitUiEffect(input: DiagnosticInput, effect: () => void): void` 只捕获同步异常并写 AppLog。传 async callback 不会等待/捕获 rejection，且不能返回每阶段状态；不能用于保存后网络请求。
2. `opencorvus/src/server/provider-refresh.ts:4` 的 `settleProviderRefreshInvalidation(operations): Promise<Provider.LoadIssue[]>` 使用 Promise.allSettled 并行操作，属于后端 Provider/native agent cache reset，依赖后端模块。它不能供 Overlay 串行 cleanup→reload 复用，也无需重写成全仓工作流。

建议仅抽取 Provider 保存已存在的实际重复顺序 into 一个小的无 UI business helper，由 Save 与 SaveKey 都调用，旧 inline loop同步移除。保留 phase 和 Error 原因至诊断投影前，不新增 retry、全局 queue、状态持久化、cache、workflow engine 或 authority 模拟。若实现只需 Panel-local helper，也可先在组件范围复用；但要新增聚焦非 UI helper 测试，应把这段真实生产业务函数放在 provider service 模块，测试不能 import/render Panel。

## 四、最小统一行为与当前签名

当前 `updateActiveProviderConfig(directory, mutator, options): Promise<any>` 按 directory 选 updateConfig 或 updateGlobalConfig。`providerLoadOptions` 捕获 authority、selectionEpoch、scopeGeneration、directory。`refreshAuthState(options)` 当前返回 `Promise<void>`，仅当 isCurrentDirectory 成立才 await `loadProviderInfo(undefined, options)`。实际 `loadProviderInfo(timeoutMilliseconds?, options?): Promise<ProviderLoadIssue[]>` 已把独立资源问题写 appStore.providerLoadIssues 并返回 issues；正常 fulfilled 不是“所有资源都成功”。

建议冻结下列结果合同：

| 生产事实 | 后续动作与结果 |
| --- | --- |
| Config 正常返回，无 Key 输入 | 使用原 scope 重读一次 Provider，成功后关闭/reset；provider 部分 issues 保持其唯一 owner |
| Config 返回明确 committed receipt | 视为配置已提交；保留原 reconcile issue；完成已授权后续并重读；saved_with_issues，不要求重复提交 |
| Config 已提交，填写的 Key PUT 失败/未知 | 保留配置已保存事实与 auth 阶段错误；仍重读；不能声称这次 Key 保存成功 |
| Auth PUT 返回 `{ok:true,issues}` | Key 持久保存事实成立；之后清理当前 scope override，再重读；cleanup 失败也继续 reload |
| 初次 Config 普通拒绝/未知 | 原错误合同和输入保留；没有明确 receipt 时不能推断已提交 |
| ownership 已退休 | 已派发原结果保持；不重新捕获新 authority、不把旧表单关闭/反馈/Provider结果写入新 scope |

推荐 Config committed 后仍继续用户在同次 Save 已明确填写的 Key 意图，沿捕获 authority 执行；这是原顺序已有授权内容，不是自动重试。无论最终 spec 选择继续还是停止 Key，都必须明示实际阶段结果，不能 Key 被跳过却显示 Key 已保存。Auth PUT 失败时不要清理 config.options.apiKey，因为清理的前提是替代 Auth 已确证写入；cleanup 拒绝不能阻挡 Provider reload。

不能只把 reload 放在现 catch/finally 尾部：`resetForm:495` 会递增 formOccurrence，若先 reset 再 `ownsForm()`，当前动作会被自己退休而跳过。需要在 close/reset 前完成尾部读取，最后一次 owner-qualified 发布反馈。SaveKey 的 saved result 也不应被之后的读错误重命名为 save_failed。

无需从 catalog.apiKeyConfigured 推断本次 Key 写入成功：true 可来自旧 Auth/config/env。无需自动刷新 canonical remote model catalog、发现模型或发模型请求；本批尾部只复用 `loadProviderInfo` 当前公开 GET。

## 五、唯一 reader 与凭据诊断边界

最小 `export committedConfigFromError` 足以修复 committed 分类，但不能单独解决诊断：现函数只返回 config，而 Panel 会为了拿 failures 再解析 body。请在正式方案选择一种单源方式并删除被替代路径：

- 若严格保留现函数签名，Panel 只用它确认 committed；安全回执诊断也应由同一 config service 模块输出，识别必须调用此 reader，不能在 Panel 另写 status/name/body 判断。
- 更清楚的单源设计是把现私有 reader 改为一个导出的 typed receipt reader，统一返回 `{config, message, failures, name}` 等已验证数据，三个原消费者使用 `.config`，Panel 和安全诊断使用同一结果。现函数是私有，不存在必须保留的外部 export 合同；不要同时留下新旧两个独立 decoder 或兼容解析器。函数命名/具体类型由最终方案定，不需要后端公共 schema 变更。

当前 decoder 宽度（未查 name/status）若收紧，要在这一个位置改，给出明确当前接受/分类合同，不要在 Panel 局部加更窄判断。现有 A/B/A fixture 的 receipt 缺 message，但保留 config/failures；正常后端 producer 固定包含 message。是否把异常不完整回执视为 ordinary error，应显式决定，不能让旧消费者与 Panel 分歧。

凭据暴露的具体链条：

1. Config.Provider 的 options 可携带 apiKey、headers 等配置；HTTP receipt.data.config 原样携带完整 Info。GET/config 原合同和 store 恢复需要它，不能为了隐藏详情删掉原 ApiError.body 或就地修改回执。
2. `utils/error-details.ts:7–37` 为 ApiError 输出 method/status/path/requestID/stack，再 `JSON.stringify(meta.body,null,2)`；没有配置红线。
3. `ProvidersPanel.tsx:683` 会 `console.error('[providers] save failed', e)`；`:689/:696` 把同一 error 原样给 formatter。SaveKey cleanup 的 `:804` 同样把原 receipt 给 formatter。
4. `ApiError.message` 正常具名 receipt 只取 data.message；但缺 message 的对象会在 `api.ts:236–237` JSON.stringify whole body，所以安全输出不能盲目复用任意 err.stack/err.message 并认为永远无 config。

本批 touched save 路径建议只显示 typed 回执的 method/status/path/requestID、错误名称、已提交 message 与明确 failures；不把 `config` 或 raw error/body 交给 Feedback、console 或 AppLog。精确保留安全的请求身份和实际失败信息，保持原 Error/receipt 对象供原逻辑消费。直接去掉/改造 raw console error 是修本触及红线的一部分。

`utils/debug-text.ts:17` 现有 boundedDebugText 是剪贴板诊断专用启发式脱敏器，并且截断/折叠空白。不能靠给整个 config JSON 套一层关键字正则来保证秘密不泄露，也不能用它替代完整配置对象不进入诊断这个根因修复。`failures` 本身来自任意生产 error.message，其内容是否一律安全没有全仓证明；本批可精确保证排除 receipt.config，不能宣称已修复所有上游消息的秘密安全。实际故障资格必须只含自有无凭据数据。

## 六、最聚焦正向非 UI 测试建议

这轮只阅读，未运行。当前直接相关文件检查没有 render/DOM/component/screenshot/Playwright/source-string 核心断言：

- `overlay/test/config-service-fail-fast.test.ts:58–83`：fakeTransport 模拟 committed409，验证 store 新值和原 reject；可作为局部业务回归，不是实际 backend/UI 资格。
- `overlay/test/project-configuration-ownership.test.ts:131–140`：本地 transport 的 A/B/A 正向状态与原 receipt 保留；不是实页。
- `overlay/test/api-error.test.ts`：ApiError 真实构造器、UTF8 body materialization、exact diagnostic metadata 与普通错误契约；部分用 transport fixture。不能广泛改掉原普通 body 诊断合同。
- `overlay/test/provider-form.test.ts` 为纯数据 helper。`config-load-ownership` / `provider-auth-authority` 亦属 service ownership 局部合同；不因位于 Overlay 就称 UI，也不冒充真实 HTTP。
- backend `config-peer-convergence.test.ts:53–94` 有真实 writer/GlobalBus，但故障是测试 listener 第一次抛出；`memory/project-memory.test.ts:827+` 更使用 MCP spy/mock。二者不是无 mock 真实公开 HTTP checker。

建议新增/延展一个精确纯业务文件（例如 `overlay/test/provider-post-save.test.ts`，路径尚待正式授权），只 import 实际生产 helper/ApiError/唯一 reader，不 import Panel、不渲染组件。合理正向矩阵：

1. Global/Project 两个真实 envelope 形状经 ApiError 构造器和唯一 reader得原 config 与可用诊断 metadata；UTF8 bytes body 与普通对象 body得到同一解码值。
2. config 中放清楚标识的 fictional apiKey/token/header 值，安全 formatter 断言**完整预期输出/对象**，保留 method、path、409、requestID、name、message、failures；同时原 receipt/config 的完整精确值保持不变。不要用 `not.toContain(secret)`、源码包含检查或删除 Error.body 的测试。
3. 顺序 followups 用真实导出的纯函数验证明确结果序列：cleanup成功→reload成功；cleanup明确拒绝→reload明确成功；reload返回部分 issues；两阶段拒绝合并。可用原生 promise/数组证明实际函数顺序和输出；这些只是 helper 单元合同，不称 Provider/HTTP/UI E2E。
4. save 的业务 outcome（如真的从组件抽取）覆盖 Config200无Key、Config committed409、Config200/Auth error、Auth200/cleanup409与普通拒绝、原Auth issues保留，以及 reload局部问题。若最终只抽取 settled loop，不能让该 loop fixture 冒称已覆盖完整 Save。
5. 现 service 成功值、原ApiError identity与A/B/A store保持继续按明确输出验证。未承诺更换通用 ApiError/host transport、并发模型目录刷新或新增全局缓存。

本轮未发现/运行相关 UI 自动化；若后续选中的其他测试文件实际包含 UI/源码断言，应先报告并排除，不能直接运行整个 Overlay 测试集合。

## 七、实际公开故障资格所需控制输入

现成无 mock 的 production Config committed409 checker仍未找到；以下是源码支持但未实跑的资格设计。

隔离输入需要：独有 runtime config/data/home、空 Provider Auth/模型目录、独有项目与端口、未配置 MCP/channel/expert assignments，明确禁用自动外部行为。先真实 public project PATCH 写公开 username 得200，让 Config/MCP reconciliation与project registration预热。不要绑定/读取用户 auth、MCP auth 或 models文件。

随后只把新实例自己的 `<Global.Path.data>/mcp-auth.json` 写为 `{`，没有凭据内容。该文件由 `McpAuth.all:268–274` 的 Filesystem.readJson（原生 JSON.parse）读取；仅 ENOENT 视为空，其余错误抛出。MCP.reconcileProjectConfig:3134先 settleStagedCredentials（3026立即all），3135又all，即使changed为空也在后续早退前读取。Config.applyProjectRuntimeTransition在持久写入后聚合它的实际拒绝。

资格主输入为公开 `/config?directory=<owned-project>` PATCH 修改合法 Provider 名称/零模型声明；真实 page可在相同故障已准备后发它自己的 Save。收集实际响应status/name/committed/requestID与无敏感投影、对应canonical源里的新公开值、GET/config与Provider GET的实际结果。不要把完整 receipt body dump到通用日志；有需要保留的本地样例也只能用完全虚构数据并明确白名单字段。

global 资格必须先登记上述实际项目，再 PATCH `/global/config`，让原 global project transitions进入相同MCP reader。无项目global正常并不否定候选；首次预提交/初始化读取若抢先失败也不是committed资格。确实发生的status及持久新值才是依据。

结束时恢复**该新实例自有**空/缺席MCPauth，保留项目owner让原pending transition重试自然成功，再正常关闭自有服务。不要用监听者throw、spy、fakeHTTP、延长timeout、kill或伪造回执取代资格。如果出现自然重试/并发项目/terminal不收敛，立即按AGENTS审计全部生产Task/Mission/Session occurrence、正常/终态、重试重启、串并行和多项目；本轮源码审查没有排除所有共享机制故障，也没有发现新的实际异常可据此定性。

## 结论边界

最小修复由一个回执解释源、一个Provider保存后顺序收敛实现、原loadProviderInfo/ownership以及安全诊断投影构成。不要更换后端writer/调度器、catalog来源、Auth权威或通用HTTP协议。当前已证代码缺口与既存历史；真实 committed409、页面即时投影、双语反馈、秘密不进入真实详情，以及故障恢复/停机均仍待Root实际资格。

## Root 后续收敛与配置写入日志路径补审

Root随后明确拟采用：纯 committed-receipt 模块唯一解析器，原三个 config consumers 与 Provider保存共享；formatErrorDetails 通过它输出整份省略 config 的诊断投影；原 ApiError.body/配置快照保留；Provider console 使用安全 details。本段是该最终方向的只读补审，取代上文第五节尚未决的模块位置选项，尚无产品实施。为了保持纯模块，不应从通用 formatter 导入整个 config service（它加载 store、workspace、meta 等）；轻量 receipt 模块可避免该耦合。ApiError 当前本身不 import formatErrorDetails；若未来为了 decoder import ApiError 引入循环，须按实际依赖图检查，不能凭名称假定纯。

全仓当前 `updateConfig` / `updateGlobalConfig` 标识与 config import 已核对，没有其他 alias 包装漏出：

| 实际配置调用链 | 捕获与公开输出 | raw error/body 是否直接打印 |
| --- | --- | --- |
| ProvidersPanel updateActiveProviderConfig:160–167 → Save:651 / cleanup:669 | catch:682，console.error:683，formatErrorDetails:689/696 | **683直接打印 e，是确认缺口**；统一 formatter 不会自动覆盖此 console，必须由调用方传安全详情 |
| 同 wrapper → SaveKey cleanup:778–784 | settled catch:795–796；formatErrorDetails:804 → describeProviderIssue → Feedback:812 | 没有 raw console；统一 formatter 可以覆盖 cleanup 的 typed receipt |
| ChannelsPanel updateConfig:215 | catch:222–225，只取 Error.message/String 到 showNotice | 没有 raw console/AppLog/body输出 |
| ChannelsPanel updateConfig:240 | catch:247–248，只取 Error.message/String 到 showNotice | 没有 raw console/AppLog/body输出 |
| expert-squad.ts setProjectExpertSquadActive:278–298 → updateConfig:284 | 唯一 caller ExpertSquadPanel.activateProject:845，包在 runBusy:842；runBusy catch:802–804只取 Error.message/String 到 actionError | service不打印，Panel没有raw console/AppLog；不是 updateExpertSquadConfiguration 独立 PUT 路由 |
| updateGlobalConfig | 唯一外部调用为 ProvidersPanel:167 | 已在Save/SaveKey两行覆盖 |

同一 decoder 的另外两个 wrapper（patchConfig/patchGlobalConfig）所有当前调用方也一并核对，避免新 formatter 只覆盖 Provider：

| 调用 | catch/formatter/log sink |
| --- | --- |
| ChatComposer.saveRunControl patchConfig:715 | catch:716；reportError:718–723，message由submitErrorMessage:1017+（普通Error.message），details由formatErrorDetails:722；diagnostics.ts:17–25将details字符串写AppLog，没有rawerror字段 |
| permission-mode.ts patchConfig:41 / patchGlobalConfig:48 | catch:51；reportError:53–58，普通message由:23–25，details由formatErrorDetails:57；同一个diagnostics→AppLog路径 |
| NetworkPanel.saveProxy patchConfig:231 | catch:240–241，describeFailure:65–67只取message/String，写error signal |
| NetworkPanel.deleteProxy patchConfig:254 | catch:263–264，同describeFailure；没有rawlog |
| TaskDirBar.localEnvironment patchConfig:512 | catch:523–525，errorMessage:76–77只取message/String，写localEnvironmentError；该路径没有AppLog/rawconsole |

`diagnostics.ts` 的 reportError 自身不是 raw-error sink：它只接收已构造的字符串/details；`utils/log.ts:171–175` 会把entry持久化并放store，故通用 formatter省略 config 会真实影响日志保存，而不是只改可见文案。正常生产具名回执总有固定 data.message，因此上述 message-only 路径不会自行序列化配置；不完整/第三方body若无message时 ApiError.message 的通用fallback另见上文第五节，不能扩大宣称任意错误message天然安全。

严格区分两处相邻但未证为本次updateConfig链的raw打印：

- `ProvidersPanel.tsx:897` 的 `console.error('[providers] delete failed', e)` 属于 DELETE provider 路由。它不是updateConfig/updateGlobalConfig直接caller，当前两处configHTTPproducer只在PATCH config/global-config。可以同Panel统一改为安全details，但本审计不伪称已证明DELETE返回同一回执。
- `main.tsx:337–340` 的 reportOverlayRuntimeError 在i18n未ready时直接console.error原error；ready时:342使用统一formatter，:352写AppLog。当前所有上表配置调用均有自己的catch处理，未发现原Config回执自然抵达这个未处理异常兜底的证据；不以理论可达扩大本批产品范围。

本补审没有沿无关上传/文件/Session错误全面扫描，也没有运行测试或服务。最初对整个packages/specs做的宽目录历史pickaxe耗时过长并触发Git自身对象维护提示；只中止本agent自有只读Git命令（原exec19866 exit1），没有操作用户服务。替代的精确生产路径 `git log --all -G ...`（原exec7216）已实际exit0，相关原diff/blame和当前全仓直接调用搜索均已完成；没有把中止命令当作成功验证。
