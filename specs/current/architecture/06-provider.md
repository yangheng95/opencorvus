# 06 — LLM Provider 适配层

> 对应代码：`src/provider/` · `src/session/llm.ts` · `src/config/config.ts`
>
> 实际目录：`provider/llm.ts` · `provider.ts` · `transform.ts` · `vendor.ts` ·
> `vendor-headers.ts` · `vendor-messages.ts` · `auth.ts` · `bundled.ts` · `error.ts` ·
> `base-url.ts` · `models.ts` · `dashscope.ts` · `install.ts` ·
> `policy.ts` · `hexin-discovery.ts` · `hexin-profiles.ts`
>
> `vendor.ts` 已拆分为三块：核心 loader 在 `vendor.ts`、HTTP header 注入在 `vendor-headers.ts`、
> 消息修复在 `vendor-messages.ts`。`hexin-discovery.ts` / `hexin-profiles.ts` 是项目特化的内部供应商
> 发现机制（同心同德）。`policy.ts` 提供模型策略 / 限制校验。原 `codex-live.ts` 已删除；Codex 认证由 Provider Auth Plugin 承担。

## 核心挑战

不同 LLM 提供商在 4 个维度上各不相同：

| 维度         | 差异                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------- |
| **API 协议** | OpenAI Chat/Responses · Anthropic Messages · Google GenerateContent · Bedrock InvokeModel     |
| **认证方式** | API Key (env) · OAuth · AWS IAM Role · GCP Service Account · 嵌入式密钥                       |
| **参数格式** | reasoning → `thinking` / `reasoningEffort` / `thinkingConfig` / `reasoningConfig`（四种写法） |
| **模型能力** | tool_call · vision · audio · reasoning · streaming · caching — 每个模型组合不同               |

## 主流方案对比

| 方案                           | 示例                   | 优缺点                                                               |
| ------------------------------ | ---------------------- | -------------------------------------------------------------------- |
| **A. 统一 SDK 适配**（本项目） | Vercel AI SDK          | ✓ 类型安全 · 灵活 · 官方维护 · 可定制 · ✗ provider-specific 逻辑分散 |
| **B. 代理网关**                | LiteLLM / OpenRouter   | ✓ 零代码 · 100+ provider · ✗ 额外跳转 · 参数丢失 · 第三方依赖        |
| **C. 抽象基类**                | LangChain / LlamaIndex | ✓ 清晰分层 · OOP · ✗ 抽象泄漏 · TypeScript 生态弱                    |

**本项目采用方案 A 深度定制**，围绕 OpenCorvus runtime 维护 provider 装载、认证与消息适配，当前注册 24 个 bundled provider package（见 `provider/bundled.ts`），六层适配。

## 六层适配架构

调用顺序 **Agent → Provider API**：

```
┌─ Layer 1 · Model Registry ──────────────────────────────────┐
│  canonical models.json + config.provider 覆盖              │
│  → 统一 Provider.Model 对象                                │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─ Layer 2 · SDK Router ─────────────────────────────────────┐
│  BUNDLED_PROVIDERS (24 package) + 动态 npm install         │
│  + canonical SHA-256 索引与 exact-source equality 缓存      │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─ Layer 3 · Auth ───────────────────────────────────────────┐
│  env API Key · OAuth Plugin · AWS IAM · GCP SA             │
│  · DashScope 动态密钥 · 配置覆盖                            │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─ Layer 4 · Custom Loader ──────────────────────────────────┐
│  OpenAI / Azure responses API · Bedrock 区域路由 ·         │
│  Vertex GCP Auth · Anthropic beta header · OpenCorvus 内置 │
│  free-tier 过滤 · DashScope 动态密钥                        │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─ Layer 5 · Parameter Transform ────────────────────────────┐
│  reasoning: thinking/reasoningEffort/thinkingConfig        │
│  caching: cacheControl/promptCacheKey/cachePoint           │
│  message 修复: Mistral tool ID · Anthropic 空内容过滤       │
│              · 缓存标记注入 · 不支持模态降级                │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─ Layer 6 · Error + Streaming ──────────────────────────────┐
│  Overflow 检测 (19 regex) · HTTP 错误提取                   │
│  流不活跃超时 (300s) · 可重试判定                           │
└─────────────────────────────────────────────────────────────┘
```

## Provider.Model — 统一模型抽象

### Final route budget authority

每次真实流式请求只有一个 final resolved route/model record。它同时绑定 Provider ID、请求模型
ID、API 模型 ID、endpoint、catalog revision，以及该请求实际使用的 `context` / `input` /
`output` limits。Session 的预测预算不得继续读取 transform 之前的另一个 model projection。

- `context` 是 prompt 与 generated output 的组合窗口；
- `input` 是可选的独立 prompt 上限；
- `output` 是 Provider 声明的 generated-output 上限；
- `effective_output` 是当前 request transform 对 output 的进一步收窄。

context-derived prompt budget 为 `context - reserved_output`。同时存在独立 `input` 时使用
`min(input, context-derived)`，不能再从 `input` 重复扣除 output reservation。只有 `input` 时
直接使用 input；只有 `context` 时使用 context-derived；两者都缺失时 predictive authority 是
typed unknown。估算器在同一单位中计算 system blocks、可见 messages、Tool schemas、附件/媒体
估算与 output reservation。禁止猜保守上限、动态学习第二阈值或自动换模型。

Provider 原始流错误只在 `Message.fromError(raw, { providerID })` 规范化一次。Tool cleanup 只消费
canonical Message error 的严格投影；它不得重新解析 Provider object。predictive 与 reactive
compaction 都由 SessionLoop 通过同一个 `ContextBudget` 驱动；Provider 在声明上限以下拒绝时，
canonical reactive overflow 仍负责可见压缩和同 Session continuation，但不能反推真实未知上限。
Assistant、受影响 Tool 与 `session.error` 共用一个
`session_id + assistant_message_id + error_name` occurrence。Tool terminal 写入即使在提交后的事件发布处
抛错，也必须从数据库读回后再报告真实未收敛 Part；写入/发布错误、物理未收敛 ID 与读回失败是
不同字段。Snapshot patch 等次生 observation 只能附着于该 occurrence，不能替换主 Provider 错误。
所有合法持久化 Session kind 走同一自动压缩路径，不存在按 kind 禁用的 policy gate。

所有 agent 消费同一 Zod 类型：

```ts
{
  id: string                 // "qwen3.5-plus"
  providerID: string         // "alibaba-cn"
  api: { id, url, npm }      // API model ID · base URL · SDK package
  capabilities: {
    temperature, reasoning, toolcall, attachment,
    input:  { text, audio, image, video, pdf },
    output: { text, audio, image, video, pdf },
    interleaved: boolean | { field: "reasoning_content" | "reasoning_details" },
  }
  cost: { input, output, cache, available? } // $/M token + 请求时价格是否已知
  limit: { context, output }        // token 限制
  variants: Record                  // reasoning effort (low/medium/high)
  options: Record                   // provider 透传
  headers: Record                   // 自定义 HTTP 头
}
```

## 调用链路

```
Agent.run()                                     agent 发起 LLM 调用
  │
  └→ ProviderLLM.stream({ model, system, ... })  统一 LLM 入口 (provider/llm.ts)
       ├→ Provider.getLanguage(model)             Layer 1-4: 解析 + SDK + Auth + LanguageModelV2
       ├→ ProviderTransform.options(model)        Layer 5: 参数适配 (reasoning, caching, store)
       ├→ ProviderTransform.providerOptions()     Layer 5: SDK namespace 封装
       ├→ ProviderTransform.maxOutputTokens()     Layer 5: 输出 token 限制
       ├→ ProviderLLM.wrapModel() + message()     Layer 5: 消息格式修复 middleware
       └→ streamText({ wrappedModel, ... })       Vercel AI SDK 统一调用
  │
  └→ Error Normalization                          Layer 6: 错误分类 + 超时
```

**session/llm.ts** 复用 `ProviderLLM.wrapModel()` + `baseHeaders()`，叠加 session 特有逻辑
（plugin / trace / permission / inactivity）。

原生 OpenAI / Azure OpenAI 在复杂 Tool surface 上采用单步串行 function-call 策略。凡
`requiresSerializedOpenAIToolCalls(model)` 为真且当前请求携带 Tool，参数转换层必须在进入
`providerOptions()` 命名空间封装前设置 `parallelToolCalls: false`。这是 `tool-call-policy.ts` 拥有的
Provider 执行策略，不是 Structured Outputs 或 `tools[].strict` 声明；Provider-bound schema 继续作为
best-effort function definition，并由 canonical Zod schema 在执行前完成最终校验与默认值 materialization。
Zod 开放 record 的 provider projection 必须保留可接受非空 JSON map 的语义，不得因生成器用
`propertyNames + additionalProperties:false` 表示不可投影值而把它静默收窄为空对象。该策略只串行化
单个 Provider step 内的 Tool calls，不得串行化不同 Session、Task、Agent、Project 或 scheduler
delivery，也不得通过兼容输入、Host 重试或 prompt 顺序指令另建协议。`@ai-sdk/openai-compatible`
不暴露 parallel-call request option，不能伪装为已约束；其他 Provider 保留其显式配置的并行策略。

## Provider 物理容量

每个真实语言模型 SDK fetch 在进入网络传输前取得一个跨进程物理容量槽。槽的资源键只包含
Provider ID、credential generation 的非明文 SHA-256 身份和 `language-model` resource class；
表中不保存 key、URL、请求、Session、Task、重试或业务状态。全局
`execution_capacity.provider` 是唯一配置来源，Project 配置不能覆盖它。

容量槽是当前物理租约，不是第二套 scheduler。请求等待槽时尚未进入网络；响应 body 的正常 EOF、
读取错误、consumer cancel、调用方 abort、activity timeout 和无 body 响应都收敛到同一次 fenced
release。abort 可立即终止下游读取，但只有上游 reader 的 cancel 已完成或拒绝后才释放容量；无法证明
物理清理完成时继续持有并续租该槽。进程崩溃由有限 lease expiry 接管，同一 SQLite data root 上的并行 backend 因而共享同一
上限。Provider 的业务重试、幂等、usage 和 Message 终态仍由原有 occurrence owner 管理；退避期间
不持有物理槽，下一次真实 fetch 重新 admission。

## Token 与计费统计单一链路

所有 bundled 与动态安装的语言模型 Provider 都必须通过 `llm/api.ts` 的共享流式
`streamText` wrapper。该 wrapper 的 `onStepFinish` 是每次真实上游 step 的唯一用量
落账点；Session、Provider 连通性、提交信息生成、Metric Judge 和验收翻译不得各自维护
统计旁路。统计层不得新增 Provider 分支或本地 Tokenizer 估算。当前归一化优先读取 AI SDK 6 的
`inputTokenDetails.{noCacheTokens,cacheReadTokens,cacheWriteTokens}` 与
`outputTokenDetails.{textTokens,reasoningTokens}`。旧 flat aliases 只用于读取仍由
SDK 暴露的兼容字段，不构成另一套统计实现。

`outputTokens` 是包含 reasoning 的输出总量。持久化的 `tokens.output` 只保存 text
output，`tokens.reasoning` 单独保存 reasoning，因此成本与总量都只能各计一次。
输入总量同理以 Provider total 为权威；当特定 Provider family 不返回 total 时才由
no-cache、cache-read、cache-write 三个归一化分量组成。非法、非有限或负计数统一
归零，禁止让一个 Provider 的异常 usage 污染全局账本。

模型价格仍来自请求时的 canonical model metadata 或显式 Provider config。
`cost.available` 是必填布尔值，区分真实零价格与缺少价格；catalog、config 和动态
Plugin projection 都必须在模型进入 registry 时归一化它。超过 200K 的费率选择包含
no-cache、cache-read 和 cache-write 全部输入分量，config merge 必须保留 catalog 的
long-context rate。每次调用把 `priced` / `unpriced` 和请求时计算的 USD cost 写入
`provider_usage_event`。统计不得按当前 catalog 重算历史成本。

`provider_usage_event` 是当前本地请求账本的唯一事实源，保存 event time、Provider、model、
purpose、Token 分量、total、成本和价格覆盖。共享 stream wrapper 对每个完成的 upstream step
写一行，所以 multi-step Session 与非 Session helper 都按真实 API 调用计数。注册迁移
`2026-08-11-provider-usage-ledger` 创建该表，并把历史 assistant `step-finish` Part 精确回填；
旧 Part 没有覆盖字段时写成 `unknown`。Session 继续保留 Part/assistant aggregate 只服务于
对话投影，统计不再双读它们。

`GET /global/usage` 是 Overlay 的唯一自然周期聚合 API：按严格 IANA 时区计算
day/week/month/year 半开区间和上一周期，补齐真实 DST（Daylight Saving Time，夏令时）
hourly/daily buckets，并返回总量、比较、Provider/model 分组和计费覆盖。自然周从周一开始；
year heatmap 使用真实 weekday offset。

同一路由还返回独立的 official-source inventory：

- `OPENAI_ADMIN_KEY` 只调用 OpenAI Organization Usage + Costs；
- `ANTHROPIC_ADMIN_KEY` 只调用 Anthropic Messages Usage Report + Cost Report；
- `OPENROUTER_MANAGEMENT_KEY` 分别调用 OpenRouter Credits 与 Keys List；Keys 以官方每页 100 条、
  `offset` 递增的契约分页并显式设置 `include_disabled=true`，保留默认工作区中每个活动或已禁用
  Key 的 lifetime/daily/weekly/monthly usage、BYOK usage、limit、remaining 和 reset，不把不同重置
  周期的额度相加；未配置 `workspace_id` 的接口事实不得声明为跨工作区完整账户账本；
- AWS Bedrock、Azure OpenAI、Google Vertex AI 声明其 CloudWatch/Azure Monitor/Cloud Monitoring
  与官方账单控制面所需的 account/project/subscription scope，在这些身份尚未配置时保持
  `requires_configuration`，不得复用普通 inference key 或猜测 URL；
- 一个官方子接口失败时保留另一个已验证子接口的事实并返回 `partial`，分页缺 cursor、未知币种、
  非法 schema 或超过有界页数都显式失败；
- Provider 日桶对非 UTC 自然周期返回明确的 `utc_day_envelope`。只有官方窗口与本地窗口完全一致
  才返回 reconciliation；组织用量可能含其他客户端且与本地调用重叠，规则永远是
  `compare_never_sum`。本地 request-time cost 是估算，官方 Costs/Cost Report 是财务权威。

API 始终返回完整 inventory 以保留配置与诊断事实；Overlay 不渲染状态为 `unconfigured` 的
admin-key source，只有管理凭据存在后才显示其 connected/partial/error 事实。云控制面不是普通
API key，仍显示 `requires_configuration` 以说明账户、项目或订阅级统计边界。

## Runtime identity -> Model 映射

固定身份、worker 模板和精确动态 worker 分层配置：

```jsonc
// opencorvus.jsonc
{
  "agent": {
    "orchestrator": { "model": "anthropic/claude-sonnet-4-..." }, // 协调者，最强
    "coding": { "model": "openai/gpt-5" }, // Primary Assistant
  },
  "runtime_templates": {
    "requirements": { "model": "anthropic/claude-sonnet-4-..." },
    "build": { "model": "anthropic/claude-sonnet-4-..." },
  },
  "expert_squads": {
    "review-team": {
      "agents": {
        "security-reviewer": {
          "runtime": { "model": "openai/gpt-5" },
        },
      },
    },
  },
  "model": "anthropic/claude-sonnet-4-...", // 全局默认
}
```

**格式**：`{providerID}/{modelID}` → 运行时通过 `Provider.getModel()` 解析为 `Provider.Model`。

精确 worker 覆盖 runtime template，runtime template 覆盖全局默认。`base_role` 只选择模板，不是 agent identity。
所有 Task worker 都使用这条统一流式 Provider 链路；人类显式启动的 coding CLI 不构成 Task worker。
Project `MEMORY.MD` Organizer 是固定身份中的显式例外：配置 schema 不提供 `agent.memory.model`。它只读取待整理 FIFO 队首证据所属 Task/Session 的有效顶层 `model`，请求入口不携带或覆盖模型所有权。

## 核心文件

| 文件                                                | 职责                                                                               |
| --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `llm/api.ts`                                        | 所有生产 `streamText` 的共享 wrapper、per-step 用量唯一落账点                       |
| `provider/llm.ts`                                   | `wrapModel` / `baseHeaders` 与 request-time model metadata                         |
| `provider/provider.ts`                              | Model Registry + SDK Router + 状态管理                                             |
| `provider/transform.ts`                             | Parameter Transform + Message 标准化                                               |
| `provider/vendor.ts`                                | Custom Loaders — per-provider 特殊逻辑                                             |
| `provider/vendor-headers.ts`                        | per-provider HTTP header 注入（拆自 vendor.ts）                                    |
| `provider/vendor-messages.ts`                       | per-provider 消息修复（拆自 vendor.ts）                                            |
| `provider/policy.ts`                                | 模型策略 / 输入限制校验                                                            |
| `provider/hexin-discovery.ts` · `hexin-profiles.ts` | 内部供应商发现 / profile 管理（项目特化）                                          |
| `provider/hexin-endpoint.ts`                        | Hexin 私网连接地址、原始 HTTPS hostname/TLS SNI 与共享请求 transport               |
| `provider/auth.ts`                                  | Auth 管理 — API Key / OAuth / IAM                                                  |
| `provider/error.ts`                                 | Error Normalization + Overflow 检测                                                |
| `provider/bundled.ts`                               | 24 个打包 Provider package 映射                                                     |
| `session/index.ts`                                  | AI SDK usage 归一化、一次计费与覆盖状态                                             |
| `usage/usage.sql.ts`                                | `provider_usage_event` 本地请求账本 schema                                          |
| `usage/index.ts`                                    | 严格 IANA 自然周期、本地账本聚合与唯一 HTTP response contract                       |
| `usage/official.ts`                                 | 官方组织用量/成本/额度 source inventory、分页、部分成功与对账                       |
| `provider/base-url.ts`                              | 自定义 base URL 解析                                                               |
| `provider/models.ts`                                | canonical model catalog 的读取、校验与显式刷新                                     |
| `provider/dashscope.ts`                             | 特殊 provider 实现（动态密钥）                                                     |
| `session/llm.ts`                                    | Session LLM — 复用 ProviderLLM helpers + plugin/trace/permission                   |
| `config/config.ts`                                  | Agent model 配置 + Provider 配置                                                   |

## 刷新语义

- 启动和普通模型解析只读取 `OPENCORVUS_MODELS_PATH` 指向的 JSON；未配置时读取 durable data 目录下的 canonical `models.json`，该文件不属于版本化 cache 清理范围。默认 durable catalog 从旧版（曾主动移除 OpenCorvus declaration）升级时，由 catalog owner 在同一文件锁内一次性原子补入 bundled OpenCorvus declaration；显式 `OPENCORVUS_MODELS_PATH` 是用户完整 authority，缺少 required local provider 时仍严格失败，不自动迁移。
- fresh install 缺少默认 canonical 文件时，runtime 从编译进 executable 的唯一 bootstrap asset 离线校验并原子创建该文件；这是安装 provisioning，不是 lookup fallback。已有默认文件永不被 bootstrap 覆盖，普通启动不隐式访问 models.dev 或 Hexin `/v1/models`。
- 显式 override、已有默认 catalog 的 JSON 无效、schema 无效或缺少必需本地 provider 时立即报错；不存在 snapshot read、空 catalog 或其他来源的回退链。
- Provider 目录与已配置 Provider 的实时模型身份是两个独立显式刷新入口：`Provider.refreshCatalog()` 只由设置面板 `/provider/refresh` 和 CLI `models --refresh` 刷新 registry declaration；`Provider.refreshModels()` 只由 `/provider/models/refresh` 刷新 live model identities。两者都写入同一个 canonical catalog，但不得彼此调用。任一 writer 提交后由同一个 canonical invalidation owner 清除 global、全部 project Provider projection 与全部 native-agent registry projection；发起刷新的 project scope 不得限制共享 catalog revision 的可见范围。
- `ModelsDev.refresh()` 合并远端 registry 与必需本地 provider（OpenCorvus / Kilo），校验后原子替换同一个 catalog 文件。
- 当当前配置可解析出 OpenCorvus API key 时，`Provider.refreshModels()` 使用 `config.provider.opencorvus.api`（未覆盖时为 canonical OpenCorvus declaration 的 top-level `api`）作为唯一 discovery endpoint；`/models` 是 identity authority，`/model/info` 提供完整严格 metadata。已知 identity 缺少新 metadata 时可保留同一 canonical declaration 中已有 metadata；新 identity 缺少完整 metadata 必须失败，禁止伪造 capability、release date 或 token limits。全部 response 校验完成后一次原子写回统一 `models.json`，再由 route owner reset provider/agent 缓存。畸形 response、空 identity 集或冲突 duplicate 严格失败且不改写旧 catalog。
- live model refresh 使用该 top-level Provider endpoint、saved credential 与 `network.proxy.llmProvider` transport 配置；不得从 per-model inference endpoint 反推 discovery endpoint，也不得另建 refresh-only credential 或 transport authority。
- 打开 Providers 配置页时只按当前 project/global scope 读取稳定的 Provider catalog、Auth method 和 config owner；不得隐式执行网络刷新。Provider 目录刷新和实时模型刷新只由两个显式按钮分别触发，各自完成后重读 Provider owner，各自拥有独立错误面。
- 没有活动项目目录的桌面首次启动使用 `/global/providers`、`/global/providers/refresh`、`/global/providers/models/refresh`、`/global/providers/discover-models` 和 `/global/providers/:providerID/test`；这些路由把 `Config.getGlobal()` 显式传入与项目路由共用的 Provider 实现。`/auth/:providerID` 仍是唯一 API credential 写入面，项目目录不是新增 Provider、保存 API key、发现模型、测试连接或使用内置 Provider OAuth 的前置条件。`Plugin.listGlobalProviderHooks()` 是唯一 project-independent built-in hook catalog，同时投影 auth method、OAuth loader 和 Provider model projection；installed project plugins 仍只由真实 Project `Instance` 的 `Plugin.list()` 拥有。

### Provider Auth occurrence authority

`ProviderAuth` 是 plugin 认证 method 执行的唯一 owner；`ProviderCredentialExchange` 是所有远端 Provider
credential exchange 与 credential commit 的唯一 owner。HTTP project/global route、Overlay 和
`opencorvus auth login` 都只通过它的 `execute`、`authorize` 和 `callback` 进入；`execute` 只接受 API
credential method，OAuth 只能通过 `authorize` 开始。CLI 只负责 method/prompt
呈现和输入收集，不得直接调用 plugin `authorize` / OAuth callback closure，也不得解释 callback result 后自行
写 `Auth`。CLI 在当前 Project `Instance` 中使用 project scope，因而保留 installed project plugin catalog；它
不能改用只包含 built-in hooks 的 global scope。

每次 OAuth authorize 先从 method-level `credentialProvider` 得到静态 credential target，为其建立/读取持久化
Auth generation，并由 `ProviderOAuthFlowStore` 在任何 loopback server、browser open 或 device-code request 之前持久化
exact flow occurrence。pending executor 自身持有 Provider-wide renewable owner；同 source 或 target 的另一授权/refresh
在其存活期间得到 typed 409，不能替换 executor 或让其资源失去结算路径。plugin executor 创建成功后才以 `flowID`
绑定；callback 必须携带该 exact `flowID` 和 owner，不存在按 provider/scope 查找 current flow 的后备路径。
method/scope mismatch、settled、generation replacement 和 executor 丢失均使用 typed refusal。
Project `Instance` 释放时，Provider auth state 先停止 owner renewal，再把仍属该 exact owner 的 pending occurrence 结算为
`failed` 并释放 plugin executor；loopback listener 等 process-local 资源由 OAuth result 的 `dispose` 生命周期统一回收。
同一 executor 的并发清理共享一条 disposal Promise，失败后才允许后续重试；清理旧 settled executor 在新 durable
occurrence 和新 plugin side effect 之前完成。pending owner 过期后的结算与资源回收会在瞬态文件锁或 disposer 故障后重试。
code method 缺少 code 时返回 typed refusal 且不 claim/settle flow，因此调用者可携带 code 完成同一 occurrence。

callback 在调用 token endpoint 前核对 authorize 时绑定的 `expectedCredentialGeneration`。远端调用前 occurrence 从
`pending` 进入 `exchanging`，返回 credential 后先写 `credential_ready`、credential digest 和预铸的 output generation，
再以 compare-and-swap 提交 `auth.json`，只有该 generation 的 credential commit 成功后才能进入 `consumed`。
普通 API/CLI writer、remove 后的 tombstone 以及值相同但 generation 不同的 ABA 都会赢过陈旧 exchange。
owner 过期时，已落盘 credential 的 generation 与 digest 同时相符才收敛为 `consumed`；否则进入
`exchange_uncertain`。Project、global 和 runtime refresh 共用 Provider ID fence，因为 `auth.json` 是 data-root-global。
credential alias 是 OAuth method 的静态声明，因此 source 与 target 在任何 plugin side effect 前共同参与 admission。
Flow store 是 admission/phase/terminal fact；PKCE callback closure 仍是 process-local live capability，restart 后不可伪造恢复。
pending/exchange renewal 遇到 thrown file-lock 或 I/O observation 时继续重试，只有 store 返回 exact owner 已不存在才视为
owner loss。journal 的 `error` 只写阶段化固定诊断，不持久化 plugin、token endpoint 或任意 exception message；这些文本可能
含 `refresh_token`、`access_token`、client secret 或响应 body，不能依赖通用日志 redactor 后落盘。

运行期 OAuth refresh 通过 `PluginInput.credentials.refresh` 进入同一 exchange owner；OpenAI account usage 也复用该
primitive。plugin 不获得完整 SDK client，只获得受管 credential 能力和 Provider header 装饰所需的窄只读 Session facts，
不能通过公开 transport 或反射在 token endpoint 返回后自行写 credential。
并发 refresh 等待 live owner 并返回其已提交 credential；过期且无法由 digest 证明已提交的 refresh 拒绝自动 replay，
refresh closure 的网络/协议异常同样视为远端结果不确定；该 fence 在其 expected Auth generation 仍是当前代时不按
24 小时 terminal retention 淘汰，只有显式 credential generation 前进后才能回收。非网络 API credential metadata 只允许
`PluginInput.credentials.updateApiMetadata` 对 observed API key 做 compare-and-update，不能发布 OAuth token 或恢复陈旧 key。

`authorize` 是 total OAuth-only contract：未知 Provider、未知 method index 和 API method 误入分别返回具名的
`ProviderAuthProviderNotFound`、`ProviderAuthMethodNotFound` 和
`ProviderAuthMethodAuthorizationTypeMismatch`，成功则总是返回非空 `ProviderAuthAuthorization`，不存在 undefined
成功响应。普通 `ProviderAuth*` 具名拒绝在 HTTP 边界映射为 400；live exchange owner 冲突明确映射为 409，
而不是泄漏为通用 500。authorize 在创建 occurrence 前读取 generation，因此 malformed、schema-invalid 或不可读取的
saved Auth authority 与 callback 一样投影 typed `AuthReadError` 503；Project/global OpenAPI 都必须声明该响应。

## Provider 故障隔离

- Provider/config 管理与修复路由只需要 project identity，不得先运行完整 `InstanceBootstrap`。失效模型或其他 runtime bootstrap 输入不能阻塞读取 catalog/Auth/config、保存 key、刷新模型或修复 config；Task/runtime 路由仍严格执行完整 bootstrap。
- Provider state 是同一个 canonical catalog/config/Auth 的部分成功投影，并携带结构化 issues。catalog 读取、插件 catalog、单个 Provider model projection、Auth store、plugin auth loader 和 custom loader 各自拥有错误边界；单个 Provider 阶段失败只移除该 connected projection，不得清空其他 Provider 或吞掉错误。
- Auth 持久化读取以 typed `Auth.ReadError` 区分合法缺失与 `io`、`malformed_json`、`invalid_credential`。只有缺失的 `auth.json` 表示空 authority；已经存在但不可观察或损坏的 authority 必须让 project-effective Config fail closed，不能把 declared well-known organization layer静默替换为合法本地配置。直接 Config/Auth consumers收到严格的安全 503，不公开凭据路径、credential key、原始 API URL、parser input 或 token。Provider catalog 的现有结构化 `issues` 是唯一允许的部分成功投影：它只报告一次共享 `auth.read` 根因，插件阶段因同一 typed cause 失败时不得重复放大。Global Config 本身不枚举 Auth，仍可独立读取；需要 saved Auth 的 global Provider 操作遵守同一 typed failure。
- 显式刷新 durable writer 的成功与后续 cache invalidation 分开报告。cache invalidation 的问题必须作为 issue 返回，不能把已经成功的 catalog/model 写入改写成不相关的顶层 HTTP 400。
- Auth 写入/删除的 durable commit 与后续 Provider/Agent cache invalidation 分开报告；cache issue 不能把已成功保存或删除的 key 改写成失败。
- Overlay 的 catalog、Auth method 和 global config 请求独立 settle、独立校验、独立提交；失败 owner 保留旧值并显示 resource-tagged 错误，成功 sibling 必须立即可用。禁止 `Promise.all` 让单个请求拒绝阻止全部 Provider 数据落库。

`models.dev` 的模型级 `experimental` 是可选对象，不是布尔开关。当前唯一合法结构是
`{ modes: Record<string, { cost?: { input, output, cache_read?, cache_write? }, provider: { body, headers? } }> }`。
普通读取与显式刷新复用同一个严格 Zod schema；历史布尔结构、未知字段或不完整 mode 都直接失败，刷新失败时不得改写现有 catalog。

## 设置页数据所有权

- `config` 与 `channel` 属于基础配置 owner，并在同一 owner 内原子提交。
- `provider` 与 `provider/auth` 是 Provider 设置面的两个独立只读资源；每个成功响应独立提交，失败资源保留旧值并进入同一 Provider diagnostics 列表。
- 无活动目录时，Provider 设置读取全局 config/catalog/auth methods 并写入全局 config/Auth；内置 Provider subscription/API auth 通过 `/global/providers/**` 的显式控制面执行，不创建或读取 Project `Instance`。Overlay 不再提供 Agent Models 设置面；Composer 是当前新建草稿或当前 Task / Chat / Work / Mission 根 Session 模型的唯一前端投影。切换持久化会话时，它通过根 Session Config 重新加载该会话自己的有效模型；选择模型时只写回当前根 Session，新建草稿则保持零持久化直到首次有效提交。每次 Chat、Work、Task 创建或 follow-up 请求仍显式传递当前投影。后端保留 top-level 与 `agent.<id>.model` 配置和解析能力，供非 Overlay 调用方使用。
- Projected scheduler 的每个 continued model Turn 都从当前 Task 根 Session overlay 解析模型；Orchestrator 子 Session 的历史 user Turn 只属于审计历史，不能作为当前请求的 `explicitModel` 覆盖根 Session。Projected worker 仍使用不可变 worker Turn runtime model，普通 Session 仍使用最新可见 user Turn 的显式模型。
- `config/prompt` 属于 Prompt owner，独立校验和提交。
- Settings 可并发刷新三个 owner，但任一 owner 失败只能阻止该 owner 的提交；错误仍必须显式上抛并进入通知面，不能清空或阻断其他已成功 owner。模型选择面只消费 Provider owner 的 canonical catalog。

## 新增 Provider 三条路径

### 上游 OpenCode Provider/API 同步边界

- `provider/bundled.ts` 是 bundled SDK（Software Development Kit，软件开发工具包）唯一注册表，
  覆盖 Bedrock/Mantle、Anthropic、Azure、Google Generative AI、Google Vertex、Vertex Anthropic、
  OpenAI、OpenAI-compatible、OpenRouter、xAI、Mistral、Groq、DeepInfra、Cerebras、Cohere、
  Vercel AI Gateway、Together、Perplexity、Vercel、Alibaba、GitLab、GitHub Copilot 和 Venice。
- `plugin/openai/codex.ts`、`plugin/github-copilot/**`、`plugin/digitalocean.ts`、
  `plugin/snowflake-cortex.ts`、`plugin/xai.ts`、`plugin/cloudflare.ts` 和 `plugin/azure.ts` 来源固定为
  上游固定提交 `8e2d422ffe56f3b2eb52e3f7195a2f9722a9fc46`；包名、客户端调用形态和产品 header
  只做 OpenCorvus 适配。上游的静默模型目录、持久化、浏览器启动和 transport fallback 不保留。
- Auth 的 `metadata` / `enterpriseUrl`、声明式 prompt `when`、Provider model projection 通过
  `@opencorvus-ai/plugin` 契约、`auth.json` 和 `Provider.buildState()` 单路流转；CLI、Server、Overlay
  不另存订阅状态。
- Google Vertex 明确投影 `GOOGLE_VERTEX_PROJECT` / `GOOGLE_VERTEX_LOCATION`，ADC 使用
  `cloud-platform` scope；Vertex Anthropic 的 `eu` / `us` 使用 regional endpoint。
- Hexin 仍由本地 canonical catalog、显式 refresh、profile、budget、sticky header 与 request
  transform 拥有；上游同步不得扫描、覆盖或替换这些 owner。

### Path 1 — OpenAI 兼容（零代码）

```jsonc
// config.provider 配置 api URL + env API Key
{ "provider": { "my-oai-compat": { "api": "https://...", "env": ["MY_KEY"] } } }
```

自动使用 `@ai-sdk/openai-compatible`。

### Path 2 — 有 Vercel AI SDK 包（一行代码）

在 `bundled.ts` 加映射：

```ts
"@ai-sdk/new-provider": createNewProvider
```

自动参数适配。

### Path 3 — 特殊行为（vendor.ts）

```ts
CUSTOM_LOADERS["new-provider"] = {
  getModel,
  options, // 区域路由 / 认证流 / API 切换
}
```

**所有路径**：models.dev 或 `config.provider` 定义模型元数据 + capabilities + cost。

## 与 Agent 架构的集成原则

1. **所有生产调用使用 `llm/api.ts` 的 `streamText`** — 不直接 import AI SDK 原始实现，统计和 tool-call repair 都由共享 wrapper 拥有
2. **session/llm.ts 复用 `ProviderLLM.wrapModel()` + `baseHeaders()`** — session 特有逻辑留在 session 层
3. **每个 Agent 通过 config 独立选模型** — Orchestrator 可用 Claude，Eval 可用 GPT
4. **新增 provider 只改 `provider/`** — agent 代码零变更

## 相关文档

- [17-code-work-agent-platform.md](17-code-work-agent-platform.md) — 哪些 agent 消费 Provider
- [04-extensions.md](04-extensions.md) — Provider 与 Expert Squad/Plugin/MCP/ACP 的独立关系
