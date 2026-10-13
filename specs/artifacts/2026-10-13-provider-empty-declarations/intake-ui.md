# 下一批只读 UI 候选：Provider 模型声明为空时的编辑合同

## Recall 与证据范围

Root 在第10批真实桌面页发现：编辑已保存的零模型 owned-bootstrap，只改名称或 API 仍被“请至少添加一个模型”阻挡。委托要求只读调查定义、调用、同义路径、当前架构、历史规格与后端公开合同，并与 testResults 反馈候选比较；仅允许写本 scratch 文件，禁止产品/测试/spec 修改、UI 自动测试、浏览器/进程操作、凭据使用和再次委托。

已读 ProvidersPanel、provider-form 及纯数据测试、Config.Provider、Config routes/global routes、Provider buildState/runnable/configured views、discovery/test operations、Overlay config writer、两语言目录，05-config/06-provider/07-panel、2026-10-04-product-experience、第五批地址意图、第八批发现 bootstrap、第九批凭据事实与第十批 Recall。全仓搜索 providerFormValues/applyProviderForm/providerModelIDs/models_required 只有 Panel 一个生产表单调用，helper 内部和现有纯数据测试消费；后端 Config 没有模型数量非空校验。git 开始状态含 root 第10批及其他并行修改，本调查未更改这些文件。

亲自使用 view_image 查看 `.tmp-codex-config-diagnostics-01a133/after-form-validation-zh.png`：可见 owned-bootstrap 行为“0 个模型”、Key placeholder 为已配置，编辑表单模型 textarea 为空（显示灰色示例），下方显示“请至少添加一个模型”，更新按钮仍在。该图直接证明合法已保存零模型条目的编辑阻挡；“只改名称/API”的具体操作序列来自 Root 的真实交互报告，图本身不能独立还原点击历史。本调查没有新执行真实页面交互。

## 结论与选择

选择“Provider 空模型声明保存阻挡”作为下一批单一候选。它有 Root 的真实操作、本人复看的截图、完整静态数据流和当前公开合同支持；testResults 只有本轮源码依据，保留后续候选，不合并实现。

核心不是单纯允许某个特殊零模型 Provider：表单编辑的是配置中的显式模型声明/覆盖，配置声明不等于完整有效模型目录，也不等于运行准入。页面却把 textarea 至少一项作为所有配置保存的前置条件。

## 直接触发、根因与影响

源码行号为本调查快照，最终实施前应重新核对：

- `packages/overlay/src/components/settings/ProvidersPanel.tsx:519–531` 的 startEdit 从 configProviders 取得配置，providerFormValues 把原 models 投影为 textarea；缺席 models 与空 record 都投影为空串。`provider-form.ts:71–77` 是唯一投影实现。
- `ProvidersPanel.tsx:616–647` 的 handleSave 在捕获 initial 后仍于643–646无条件要求 `providerModelIDs(values.models).length > 0`；这个 return 在 updateActiveProviderConfig/API 写入之前，所以不是后端拒绝、网络、密钥或发现失败。
- `provider-form.ts:92–138` 已有明确字段意图合同：以最新 canonical current 为底，只有 model ID 集合实际变化才修改 models；零初始集合与零提交集合会保留当前 models 字段及并发补入的模型。Panel 的提前 return 使这条正确路径不可达。
- `Config.Provider` 在 `packages/opencorvus/src/config/config.ts:1292–1314` 从 partial provider 扩展，models 是 optional record，没有 min/nonempty 约束。`ModelsDev.Provider`（models.ts:109–116）的 record 同样可为空；目录完整 schema 与配置 partial schema不能混为一谈。
- `provider/provider.ts:367–380` 从 canonical catalog 的 existing.models 构造模型，再逐项应用 config models。因此配置缺席或空 models 也可能拥有继承的可运行模型。Panel 行数量来自原配置 `ProvidersPanel.tsx:921–924`，不能用其“0模型”推断运行时一定没有模型。候选的最保守结论是“零显式声明阻挡普通配置编辑”。
- `provider/provider.ts:822–842` 已明确配置事实与 runnable 派生视图；`06-provider.md:369` 要求零模型 Provider 保留发现所需配置和凭据，实际选择/准入从有可用模型的同一事实派生。放开配置编辑并不需要也不允许绕过模型运行准入。
- 范围包含 global/project 的既有零显式模型配置；名称、API、环境变量修改；models-only 配置的缺席 API 保真；canonical catalog 继承；显式清空最后一项本地模型覆盖；以及新建 bootstrap 声明是否允许为空。空 models 不应被解释为删除 Provider、删除 Auth、禁用整个 Provider 或覆盖 canonical models.json。

## 后端创建/更新公开合同

没有另一个 Provider create/update endpoint 或单独“至少一个模型”创建合同：Panel 通过 `services/config.ts:439–483` 读取当前配置、clone、应用 mutator、计算 mergePatchDiff，再 PATCH 所属 scope。全局 `server/routes/global.ts:1260–1289` 和项目 `server/routes/config.ts:74–120` 都走配置 patch writer及候选验证；零声明由上面的 Config.Provider 允许。

existing helper 对新建 ID 冲突和编辑已删除 ID 有具名错误；API 地址有第五批唯一 validateProviderFormApi；这些边界与空 models 候选独立，应保留。后端 Config 源/有效层合并和候选解析目前由并行395修改，本批不应重写或新增另一份模型声明校验。

## 历史与旧路径未根治原因

`git log -S 'provider.form.error.models_required'` 最早可核对保留快照是65d0bfc98（2026-08-07）；其 handleSave 先 parseModels，再同样拒绝0项。快照只能证明已有该规则，无法证明最初产品意图；本次未找到专门要求所有配置声明必须包含模型的架构/spec。未声称历史从未有这种偏好。

2026-10-04-product-experience 先修模型 metadata 丢失，并建立 applyProviderForm 的显式编辑/并发保真；第五批地址意图只处理新/显式 API 编辑，保留缺席或模板 API；第八批只修 configured/runnable 事实与发现；第九批只修凭据存在事实。上述交付均未替换 Panel 旧的必填数量 guard，所以新后端事实通过后，旧 UI 阻挡仍在。第十批只是把同一个错误转换成结构化反馈，没有创造这个条件。

## 最小完整方案建议（未实施，由 Root 落盘后决定）

依据当前公开配置合同，优先删除 Panel 的“至少一项模型”前置条件，而不是仅给 owned-bootstrap/已保存零模型加例外。删除该分支后，配置声明编辑和新建均继续走同一个 applyProviderForm；空新建由现有 helper自然产生 models:{}；空既有未编辑声明保持原来缺席或{}形状；显式删除最后一项只应用实际 ID 移除，保留并发新增 ID。

同步移除 Panel 唯一的 providerModelIDs import（helper与纯数据测试仍需保留该函数），删除两语言目录唯一的 provider.form.error.models_required 键。现有 models_hint 可明确说明模型可稍后添加/发现，仍保留精确ID、标签和metadata提示；不新增两套表单模式、关键词豁免、ready缓存或后端 gate。

此完整方案会同时开放“新建零模型声明”和“清空最后一个显式覆盖”。这是基于同一配置合同的明确行为变化，必须写入 Root spec、真实矩阵及更新日志，不能只验一个 rename 就声称覆盖。若 Root 只授权既有空模型未编辑例外，则应明确把新建/显式清空保留为额外产品限制；目前没有源码之外证据支持新增这种不对称政策，故本调查不推荐另加条件分支。

保留 API/address 校验、ID冲突、配置读写/原子性、scope/authority/occurrence退休、已成功提交后的反馈、Auth写入顺序、模型选择准入与所有并发保真。发现成功更新 textarea 后仍需正常 Save 才持久化，不能为了验收跳过这一现有动作。

## 正向数据与真实桌面验收建议（均未执行）

1. 数据合同：原 models 缺席与{}各一例，名称/API/env分别变化后对完整结果精确比较；零初始集合编辑期间 current 增加模型后只改名称，完整输出保留并发模型与metadata；有一个模型时显式清空，完整输出保留其他配置和并发新增模型；新建空声明得到精确 `{name,api,env,models:{}}`。沿用 provider-form 的纯数据测试，不创建UI源码/DOM/组件测试。
2. 后端资格：在新自有 scope 用真实HTTP创建、读取和更新缺席/空models配置，两scope分别验证精确持久化字段；检查目录继承的模型与零真实模型都维持原运行准入。若直接复用第八批测试，只能作为其已覆盖合同，不能把旧运行等价成新改动验收。
3. 新前态：独有生产 /ui，中文对已保存0模型行只改名称、然后只改有效API，实际 Update 看到阻挡；取得与当前目标绑定截图，并读回真实Config确认保存结果。英文至少保留一次等价前态或后态；不要用截图文件名替代操作事实。
4. 后态两scope：名称、有效API、env修改后 Save、重开编辑、真实Config读回；模型仍为空/缺席而其他字段准确；空 models 的目录继承项保持canonical运行模型。普通1模型配置编辑作为对照，保留名称/能力/成本等metadata。
5. 后态生命周期：新建空声明→列表→编辑→显式Discover（自有公开loopback参与者、无真实凭据/推理）→实际保存返回模型；显式清空最后一个自定义模型→重开编辑；global/project切换或取消后原表单反馈按现有scope退休。keyboard保存与发现控制应按真实页面支持的操作验收，不假定当前按钮已有Enter提交合同。
6. 视觉：中文版/英文版空模型提示、成功列表及重开编辑截图人工查看；0数量保持既有tc；不产生填入虚构模型才能保存的引导。若改hint，检查原桌面密度与换行，不扩移动端。

## 与 testResults 候选比较

`ProvidersPanel.tsx:297–305` 的无模型测试分支仍把t结果快照存入testResults；`1252–1258` 对API结果优先展示 result.message，因此 `provider/operations.ts:238` 固定英文“Provider is reachable.”会直接覆盖中文成功提示。异常catch还仅存 message，未复用第10批完整诊断descriptor。这些是清楚的代码线索；本轮没有新真实测试操作或截图，也没有资格把模型响应/第三方错误原文按中文产品正文翻译。

成功分支实页需要模型流式请求；无模型分支可本地触发，但它只覆盖另一路径。相比已真实阻挡普通编辑的当前候选，testResults验收范围更大而证据较少，因此明确延期，不合并本批。

## 排除与未知

- 没有访问真实凭据/私有配置、调用模型、启动或操作服务/浏览器，未运行任何测试。仅阅读源码、历史、指定截图并写本scratch。
- 缺席/空模型的后端schema接受与helper语义是源码证据；本轮没有重新执行实际创建/更新HTTP。Root 已有第八/九/十批scope证据不自动证明全部新矩阵。
- 新建0模型、显式清空、目录继承和并发覆盖的最终实页行为均待验证；不因模型数0标签推断 ProviderReady、凭据存在或连接状态。
- Task/Mission/Session、队列、调度、恢复没有进入此次数据流；没有发现共享终态异常，不声称对应矩阵通过。模型推理不是这个表单保存修复的必需验收，若另做Sol必须沿用户既有授权和完整配对预检。
- 触及路径所见 provider-form/provider-discovery-bootstrap/provider-credential-presence 为纯数据/服务合同；没有检索到该组件的UI自动化测试，未运行。一次猜测的provider-discovery.test.ts及PowerShell通配路径不存在已改为rg定位真实provider-discovery-bootstrap.test.ts，不把失败读取当覆盖。
- 本文件仅调查交接，正式spec/架构/日志/索引/提交由Root在第10批交付后安排；未创建平行实现或改变现有产品合同。
