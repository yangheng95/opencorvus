# 下一批只读功能调查：Provider 空模型声明保存

## Recall 与证据边界

用户已授权持续分批并行体验、分析落盘后修复与真实验收。本次 root 委托只读调查，唯一允许写入为此 scratch；不改产品、正式测试或 spec，不运行 UI 自动化、不操作服务或用户实例、不使用凭据/模型、不再次委托。已读 UI 分工的 next-intake-ui.md、Config/Provider 当前架构、2026-10-04-product-experience、第五批 provider-address-intent、第八批 provider-discovery-bootstrap、第九批 credential-presence，以及当前共享 395 的 Source/候选写入实现。

已全仓搜索 providerFormValues/applyProviderForm/providerModelIDs/models_required、Config.Provider、Provider configured/runnable 投影、配置读写和模型引用校验、generic/live discovery、纯 helper 测试及 bootstrap 测试。本轮没有新运行样例；root 的真实截图/操作结论由 UI 报告交叉提供，不冒称本 agent 亲自重现。行号为此次读取的当前工作区，平行 395 仍可能使 config.ts 行号移动。

## 结论

源码支持删除 Panel 唯一的“models 至少一项”保存 guard，覆盖新建和编辑，而非只给某种 Provider 加特例。它阻挡的是合法配置字段意图，不是运行准入。现有 helper 和后端已经允许空显式声明；本次无需新增 backend schema、第二份保存逻辑、伪模型或非流式连接测试。

必须区分三份数据：canonical models.json 的目录；global/project JSONC 的模型声明/覆盖；ProviderState 派生的实际 runnable 集合。尤其 project GET/config 是有效合并配置，textarea 还可能显示继承的 global 声明，不能把其中全部 ID 称为 project 文件自身声明。

## 唯一保存链与现有边界

- `packages/overlay/src/components/settings/ProvidersPanel.tsx:519–531`：startEdit 从 configProviders 取得 config，交 providerFormValues。`:616–647`：handleSave 在 ID、API 验证之后以 `providerModelIDs(values.models).length === 0` 提前 return，尚未进行 HTTP 写入。Save 按钮 `:1411` 本来只依赖 saving、ID、API；不存在另一条模型数量门槛。
- `provider-form.ts:71–77`：models absent 和 `{}` 都投影为空文本。`:92–138`：applyProviderForm 从保存时重读的 current clone 开始，按 initial 与 submitted 的差异应用字段意图。它没有 model count guard。
- 新建 `initial=null` 且 current 缺失时，空 models 合法产生 `{name, api, env:[], models:{}}`；既有 API 验证仍要求新建提供绝对 HTTP(S) 地址。同 ID 已由并发配置创建则保持 `PROVIDER_ALREADY_EXISTS`。
- 编辑空→空时 `changedModels=false`，不会重写当前 models。models originally absent 仍 absent，`{}` 仍 `{}`；保存前新增的 peer 模型原样保留。已被并发删除的 Provider 保持 `PROVIDER_REMOVED`。
- 非空→空时，只删除 initialIDs 中此次明确取消的条目；保存时 current 中的 peer 新增 ID 与它们的元数据保留。全部原声明删除后得到 `{}`，不是删除整个 Provider。
- Panel `:161–170` 根据捕获的目录选择 updateConfig 或 updateGlobalConfig。`services/config.ts:439–483` 读取最新 GET/config 或 GET/global/config、clone、调用 mutator、以 mergePatchDiff 生成 RFC 7396 JSON Merge Patch。未触碰字段没有进入差异；删除 model ID 对应 nested null，不是把整份 models.json 重写。
- helper 保证相对打开表单时的字段意图；它不是 Compare-And-Swap。若另一个 writer 在本次 GET 后、PATCH 前改同一个明确提交字段，原来的最后写入语义仍存在；不能宣称所有并发冲突都被消除。后端 file owner 内重读、patch 和原子替换继续保留。

## 后端接受与运行准入

- `config/config.ts:1287–1311`：Config.Provider 是 partial Provider 并扩展 `models: record(...).optional()`，没有 min/nonempty。`models.dev` 完整 Provider 中的 models record 同样可为空。
- `server/routes/config.ts:39–46/99–118` 和 `routes/global.ts:1256/1279–1303`：GET 返回有效配置；PATCH 走当前 canonical 配置 writer和候选验证。项目管理路由使用 project identity 而非完整 InstanceBootstrap（`server/server.ts:914–920`）；零模型本身不是配置管理的拒绝条件。
- 当前共享 395 的 `writeConfigFile:2682+` 使用 Source、resolve、parseSourceLayer 对已有原文及合并结果做同一候选解析；本调查不建议改变这些语义或把 Source 强转 Info。
- `candidate-validation.ts:23` 调用唯一 `validateConfigModelReferences`。后者检查 config.model、small_model、agent.*.model、runtime_templates.*.model、expert_squads.*.agents.*.runtime.model、command.*.model。其后仍有 profile、Skill/Conversation capability 约束。
- 因此“清空模型声明”不是无条件保存成功承诺。若最后一个仅由该配置定义的模型仍被上述字段引用，`Provider.getModel[Global]` 将按当前事实返回 ProviderModelNotFoundError；HTTP 仍为400（error-handler.ts:50）。全局 writer 还验证已登记项目的 after 配置，项目中的引用也可能保护该全局声明。应验证精确错误合同，不绕过它。
- `provider/provider.ts:367–380`：先以 existing catalog models 建立 parsed.models，再对 config models 逐条覆盖。配置 absent 或 `{}` 继承目录模型；清空某项配置覆盖会露出同 ID 的 catalog 默认。若 catalog 没有该 ID 且没有低层声明，则它不再是可运行模型。
- `:573–620` 继续应用 enabled/disabled、alpha、blacklist、whitelist 等既有过滤。`:822–842/850–873` 同一个 ProviderState 保留 configured 事实，并由 hasRunnableModels 派生 list/catalog-ready/getProvider；getModel/getLanguage 继续严格准入。删除表单 guard 不改变这些集合规则。
- project 全局继承由现有 Config 层合并处理。project nested null 删除自己的覆盖后，global 同 ID 声明可以重新出现。UI 清空文本不是表达“禁用 global/catalog 模型”；相应 whitelist/blacklist 或 Provider disabled 才各有现有配置语义，本批不增加屏蔽协议。

## Auth 与 discovery 后续

- Panel `:653–677` 先保存配置。只有用户实际填写了非空 formApiKey，才 PUT 唯一 `/auth/:id`，随后清理当前 scope 的 config.options.apiKey 并 refreshAuthState。空 Key 输入保持既有 Auth；空 models 不授权删除 Key。该 Auth authority 本来共享，项目目录不是独立的 credential store。
- 只编辑 Key、name、api、env 的零模型 Provider 因 guard 当前会在配置或 Auth 之前返回。删除 guard 后仍保留 configCommitted 与部分成功反馈：若后续 Auth 或清理失败，不能把已保存配置说成未保存。
- `operations.ts:87–120` 的 saved-key generic discovery 从 `getConfiguredProvider` 和当前 scope 的 top-level `config.provider[id].api ?? catalog.api` 判断地址所有权，正是第八批已建立的零模型 bootstrap 入口。新建空声明后可保存虚构 Key，再显式发现模型；不能强制先发现成功才能保存配置。
- generic discover 成功只返回 ID 数组；Panel 放到 textarea，用户保存才生成相应配置声明。live refresh 则仍由原 durable catalog writer 发布目录；二者不是同一个写入面。
- 实际连接测试仍依赖 runnable Provider/模型；它不能变成保存空声明的前置条件。零 runnable 的测试错误合同不因这次 UI 变更而修改。
- 地址层边界：top-level api 明确拥有 discovery，但 `loadBaseURL:100` 为 `options.baseURL ?? model.api.url`；`buildState` 只在逐个 config model 生成时应用 provider.api。对只继承 catalog 模型的声明改 api，不能据保存成功就声称所有继承 inference URL 已改变。本批不重写这一现有 endpoint 所有权；若需要改变它，应独立调查/规格。
- 未填 Key 的 handleSave 当前只更新 config store，refreshAuthState 位于非空 Key 分支；新 catalog fact 的立即刷新体验是现有行为边界，不在本轮源码调查中宣称已通过。真实页面应检查保存后行和再次刷新结果。

## 展示范围与死引用

configProviders (`ProvidersPanel:452–480`) 只把 api 为字符串或 models 为对象的合法配置显示为可编辑 custom 行，disabled 条目过滤。纯 `{name}` 且 api/models 都缺席的配置不是这个 guard 的可达编辑行，不把删除 guard 说成修复所有合法 Provider 配置的 UI 编辑入口。api-only（models absent）、models-only `{}`、新建空 models 都属于可达目标。

全仓 models_required 仅命中 Panel guard 和两个 locale；providerModelIDs 在 Panel 仅用于此 guard，服务 helper 及纯数据测试仍使用它。若移除 guard，只需移除 Panel 无用 import及该失去生产引用的翻译项；不得删除 helper 的 ID 解析功能。当前 models_hint 只承诺完整 ID/元数据保真，没有至少一项要求；若补“可留空”提示，应解释声明与目录继承，且双语一致。

## 历史与既有证据

- `git log -S 'provider.form.error.models_required' -- ProvidersPanel.tsx` 最早可核对保留提交为65d0bfc98（OpenCorvus v0.0.35beta）。本 guard 不是第8/9/10批新增。
- 2026-10-04-product-experience 的 Provider 元数据根因记录要求编辑保留未提交 runtime/model 字段，并引入当前字段意图 helper；旧数量 guard 留在调用它之前，正确空集合意图因此不能到达 helper。
- 第五批 provider-address-intent 保留未编辑 absent/template 地址，校验仅管明确 API 意图；不能为此次空模型改动重新强制地址或模板重写。
- 第八批 spec、06-provider:369 及 `provider-discovery-bootstrap.test.ts:213–242` 明确零模型 configured/credential 事实、ready 集合和 ModelNotFoundError 的不同正向输出。该文件已有保存 `{models:{}}`、project API override、两路 saved-key discovery、catalog inherited declaration、筛选后零模型、live refresh 等合同。
- 第九批 credential-presence 14项覆盖零模型配置/saved/env/OAuth、两 scope 三态及原 connected 集合。不能把 apiKeyConfigured 与 runnable 混为一谈。
- `packages/overlay/test/provider-form.test.ts` 只调用纯数据 helper，没有 DOM、组件、快照或浏览器；已有并发 metadata、模型增删、API 意图和具名冲突正向测试。但没有新建空 models、空→空保留、非空→空保留 peer 这三组聚焦用例。本次未运行这些测试。
- 本轮最后一次已完成后台回归45项71断言是第10批诊断/凭据/Auth范围，不是本候选表单修复验收。Root真实页面阻挡为本候选前态证据，后态尚未实施。

## 建议资格矩阵（尚未执行）

| 场景 | 明确正确结果与证据 |
| --- | --- |
| global/project 新建合法 API、空/纯空白 models、未填 Key | canonical 配置精确包含合法 bootstrap 声明；GET回读同scope；无目录模型时catalog configured行与ready集合输出符合现有合同。真实页关闭表单并显示已保存行。 |
| 已有 api-only models absent，仅改name/env；已有models:{}仅改api | helper准确保留absent或空record，保存指定字段与现有options/npm/filters；真实页面保存并重新打开回读。 |
| 已有 models-only:{}、API缺席，只改名称 | 沿第五批 unchanged API合同成功；新建空API仍返回现有PROVIDER_API_REQUIRED。 |
| 零声明编辑期间peer新增模型/改options/API | 原表单仅改name，完整数据期望保留peer模型metadata和未编辑字段；实际GET→PATCH仅提交name差异。 |
| 清空最后一个未引用custom模型 | helper输出models:{}；canonical source删除该ID覆盖；GET/canonical catalog/ready集合按真实来源精确输出，Provider与Auth仍由既有事实保持。 |
| 清空原模型时peer另增ID | 精确剩余peer ID及完整metadata；不把用户旧列表当全部当前目录。 |
| config models absent/{}、catalog有两个模型 | catalog/runnable仍为两真实ID；表单零声明保存后继续继承。删除同ID配置覆盖后恢复catalog既有metadata。 |
| project本地覆盖+global同ID模型 | 删除project覆盖后，project有效读取恢复global值；global canonical配置和其他项目明确覆盖各自按原数据输出。 |
| 被config/agent引用的唯一custom模型清空 | 真实PATCH返回原ProviderModelNotFoundError400且明确providerID/modelID；不要为了空输入成功绕过模型引用校验。 |
| 零模型保存同时填写虚构Key | 配置先提交、唯一Auth后续成功；三态字段true、zero/ready集合正确；只用自有样例participant验证saved-key发现成功，随后显式保存发现ID。 |
| ID已存在/Provider编辑时被删/API明确非法 | helper原具名冲突/API错误与页面反馈保持。 |
| 双语桌面 | Add/Update、空模型和清空最后覆盖、保存后重新打开、0模型Key与发现后IDs；实际操作截图人工复核，无DOM断言/UI自动化。 |

纯 helper 新正向用例在旧实现就应通过，只证明现有数据合同兼容，不能用它们代替 Panel guard 的真实前后态。后端新用例优先复用当前 Config/Provider 公开入口与现有单一catalog/Auth primitive，无需调用真实模型。若源文件需全局写入，沿已有单一文件级memoryProject、Auth/catalog先恢复、global恢复后dispose，避免已删除登记目录造成夹具失败。

## Unknown 与风险范围

没有本轮新 HTTP、桌面、进程或模型运行；本报告的保存成功、继承、引用拒绝和立即刷新组合是源码合同及既有测试覆盖推导，需上述自有真实样例资格。没有发现新的调度/队列/终态异常，也不以字段表单问题声称共享执行机制通过。未扩展query/模板、Provider启用禁用、凭据选择、catalog writer、395 source/effective、活跃Session历史配置或推理endpoint合同。真实远端供应商是否允许无模型声明与本地配置保存资格无关，仍未知且无需以模型调用来批准本地字段编辑。
