# 启动页布局与模型目录刷新

## Recall

- 用户原始要求：截图中的启动页太丑，而且无法刷新模型。截图显示 models.dev 的 `experimental.modes.fast.cost.input_audio` 被拒绝，另有 OpenCorvus 凭据未配置错误。
- 验收：真实 models.dev 目录经正式刷新路由成功写入并可读；价格字段保留；聚焦后台正向契约；真实 `/ui` 桌面页中英文截图人工复核首页、示例、持续目标表单、Provider 刷新与未配置专用凭据提示。
- 硬约束：单 agent；先分析后改；不运行 UI（User Interface，用户界面）自动化测试；不操作用户窗口/服务；使用全新隔离数据根和开发服务，无用户凭据/模型调用；保留其他任务修改；范围提交并 fetch/merge/push 当前 main，不发布版本。
- 已读：AGENTS.md、根及两 package scripts、06-provider、overlay-typography、goal-home-hierarchy 记录；ModelsDev / Provider 刷新、项目/全局路由、ProvidersPanel、provider-refresh service、provider-live-model-refresh 合同、Conversation/App/ContinuousGoalControl 与对应样式及双语文案。
- 全仓搜索：ModelsDev refresh 由 Provider.refreshCatalog、项目/全局 refresh 与 CLI models --refresh 共用；experimental 仅在 models.ts 校验，runtime 不读取其 mode cost；实时刷新独立且仅针对 OpenCorvus；credential presence 已有 providerApiKeyConfigured 投影可复用。无委托。
- 初始工作区已有 App.tsx、ContinuousGoalControl.tsx、SideChatPanel.tsx、continuous-goal.css、三索引、continuous-goal 架构改动；初始差异保存在 `.tmp-startup-refresh/pre-existing.patch`。仅以独立 hunk 提交本任务修改。

## 根因与影响分析

1. 可观察：用户截图为目录整体校验失败。直接触发是实验模式的严格价格 schema 缺少音频字段。根因是基础模型价格与实验模式重复声明，后者仅接受 input/output/cache，未跟随上游成本契约。公开上游源码 https://raw.githubusercontent.com/anomalyco/models.dev/dev/packages/core/src/schema.ts 已确认共享 Cost 包含 reasoning/input_audio/output_audio。旧实现对普通 cost 丢弃音频字段，对 experimental cost 则直接拒绝，影响所有目录读取和显式刷新入口。
2. 第二错误来自独立的 OpenCorvus live refresh，不能证明其他已配置 Provider 凭据丢失。界面现把通用目录刷新隐藏在更多菜单，专用动作在未配置凭据时仍可直接触发。修复复用 backend 发布的 apiKeyConfigured，并提供明确的连接入口，保留真实后端错误与独立 writer。
3. 首页当前顶端8vh、760宽输入和148高说明卡形成重心偏上、说明与主输入竞争；预算文案挤在按钮旁。调整展示层与双语文案，保留标题→唯一输入→示例→目标入口顺序、原表单生命周期与执行流程。
4. 公共契约：成本字段需在同一 schema 中接受并保留，不新增目录、不吞坏数据。无数据库/schema版本迁移，无调度/队列/执行轮次改动，无模型请求；本次不涉及版本发布。风险：上游更多契约变化待真实全目录验证；缩减文案不可丢失目标用途/预算规则，后者保留在原表单与说明中。

## 实施与验证

1. 保存上游公开目录，正式解析复现并核对当前字段；统一基础成本声明并覆盖实验模式音频/推理价格的正向测试，维持字段类型校验。
2. 首页使用现有 token 重新组织留白、标题、示例与精简目标入口；中英同步；刷新按钮可见且准确命名，OpenCorvus 专用动作按当前 credential presence 提供连接/刷新操作。
3. 正式测试 runner 的聚焦非 UI 合同、Overlay typecheck/i18n/css token/build、docs:check、check:architecture-index；启动隔离开发服务，通过正式 HTTP（Hypertext Transfer Protocol，超文本传输协议）路由和真实 `/ui` 人工交互、截图复核。
4. 记录实际结果/限制与截图，关闭仅自有服务，审查任务范围提交，fetch/merge 上游并审查所有待推提交后 push。

## 结果

### 追加要求与表单分析

用户追加指出 Goal 的 UI/UX（User Interface / User Experience，用户界面与体验）明显差于 Codex，要求同轮改善。
真实 before19161 `/ui` 已人工打开 Goal：创建弹窗约570px高、近全宽，目标输入前有三段解释，后有固定目标、两种预算、累计超限、暂停区别等说明。功能与原草稿预填存在，问题是把完整运行合同全部暴露为首次创建的表单负担。
新增方案：使用现有普通宽度 Dialog；创建页只保留一句说明、原目标字段和明确开始动作；预算折叠为可选 Disclosure，沿用原字段和信号，已设置值重新打开时可见，错误字段会展开；详细预算/暂停语义仍在展开区与现有说明中。已有 owner 身份、草稿保留、创建确认、预算执行与暂停/停止契约不改。无新 host 流程、无后台执行修改。

上游完整目录本地正式解析已复现四条相同错误；改后正式解析233个 Provider 成功并保留3.6音频成本。后台3项成本合同及原5项真实本地HTTP live refresh合同均通过（8 pass）。此处不把本地fixture合同冒充上游网络验收，后续仍走真实在线路由。

### 在线请求与第二轮视觉修正

2026-10-23（北京时间）真实 refresh 观察到 ECONNRESET。系统代理127.0.0.1:7892显式传入隔离服务后仍复现，故前一代理归因不足。最小独立请求对照：原 `opencorvus/local/local/cli` 再现ECONNRESET，`opencorvus/local (local; cli)` 同代理、同URL返回200/6055335字节；PowerShell 的标准 HTTP UserAgent parser 直接拒绝原格式。RFC 9110 §10.1.5 规定 product/version 与 comment/product 序列，原连续多斜杠不是合法 product-version token。唯一声明 Installation.USER_AGENT 仅由 ModelsDev.refresh 消费（全仓搜索），因此一处修正真实产品标识格式，无更换URL、浏览器冒充、备用路径、凭据或代理产品配置变化。网络节点具体何处拒绝未知，不能将此错误冒充截图的schema根因。

真实 Provider 菜单验证发现：通用认证 helper 在 OpenCorvus 无 OAuth method 时直接返回，无法承担 API key 连接入口。改为沿用现有搜索与该Provider配置展开，使用唯一 ApiKeyEditor。两次视觉检查发现普通380px宽度展开预算时过窄，调整当前 Goal Dialog 到560px边界，创建预算说明简化且保持原限制语义。

### 最终验收

- 正式入口19167 `/ui` 英文点击目录刷新成功：无Provider凭据，目录88→233，原请求HTTP 200/1521ms。中文第二次刷新同样显示成功，Databricks26个模型可读。Node.js独立checker经全局、项目两条正式路由真实下载，200/ok:true，2734ms/1234ms，并读回同一canonical catalog确认audio价格3.6、OpenCorvus/Kilo身份保留。证据见[15张人工截图与在线合同](../../artifacts/2026-10-22-startup-model-refresh/README.md)。
- 首页完整中英标题、说明、示例、持续目标入口可读；新Goal表单保留唯一草稿，英文原示例预填，关闭重开保留5000/3预算。0预算折叠后提交会展开、聚焦原输入并显示正整数校验，实际未创建任务。中文默认表单约560×296，预算默认折叠，展开完整保留说明。桌面左分栏280→478→280，目标区折行后入口可用。
- 最终新增4项正向合同通过；原5项live模型刷新合同通过，合计9项。后台和Overlay typecheck通过，Overlay i18n（2语言2538键）、CSS token（8881引用）、renderer公开面、正式Node Vite构建（53.72s）通过。docs:check（345操作/26组）、architecture-index（20文档）通过。构建既有第三方directive/大chunk提示不作为视觉通过依据。
- 单独19161 before、19165中间预览已通过公开shutdown返回200并以原exec exit0结算。19163预览出现用户输入，保留该页面/服务；19167最终预览保留供用户查看。未重启、关闭或更新用户安装中的应用。最终服务全新数据根、清除catalog声明的Provider环境变量，不填凭据、不调用模型。模型真实跨轮执行不在本次展示修复资格中。
- 没有数据库结构或持久格式变更，没有版本/安装包/Release交付。本轮只提交明确代码、合同与spec/截图；初始其他任务的Goal owner改动由其自己的提交完成，本次保留其结果。

### 推送检查的接口同步

首次正常pre-push在全仓typecheck（8/8）通过后，被api:routes-check的generated-openapi-differs-tracked-openapi拒绝：ModelsDev成本声明同时进入公开目录response，新增可选字段尚未反映到受跟踪OpenAPI与客户端生成类型。此前范围分析遗漏了生成契约消费者；不能绕过hook。已读routes checker及SDK（Software Development Kit，软件开发工具包）build/generation transaction，确认生成文件无未提交差异，使用唯一 `bun run --cwd packages/sdk/js build` 更新，再审查只包含新增成本字段、重跑原checker并单独提交。此为公共元数据字段同步，不引入新接口、数据版本或模型执行流程。

正式SDK构建exit0，仅生成types.gen.ts的9个可选字段和openapi.json的27行对应声明，基础、长上下文和实验模式一致。原api:routes-check重跑通过（35文件/6规则与完整路由清单），docs:check也通过。
