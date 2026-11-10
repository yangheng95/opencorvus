# 提供方模型目录如实声明可选的自定义地址

## Recall

- 用户要求持续迭代，每批由本人并行调查用户界面（User Interface，UI）、功能完成度和缺陷，先写规格再改动；使用真实桌面交互、本人查看截图、聚焦的正向功能验证，按需经授权使用 GPT-6.1 Sol，按批提交、合并上游和普通推送。明确禁止使用子 agent。本批起点 `92aa59a7d`，本地和上游相同；保留原有 177 条无关工作区状态。
- 已读 `AGENTS.md`、[提供方当前架构](../../current/architecture/06-provider.md)、[已保存凭据发现](../2026-10/2026-10-13-provider-discovery-bootstrap.md)、[模型投影隔离](../2026-10/2026-10-20-provider-projection-isolation.md)、`provider/{models,model-schema,provider,operations,transform,base-url}.ts`、project/global 两条目录路由、软件开发工具包（Software Development Kit，SDK）生成器、运行时 OpenAPI 测试、提供方发现和投影测试。
- 全仓搜索 `ProviderModelSchema`、`api.url`、`loadBaseURL`、`fromModelsDevModel`、`provider.list`、`global.providers.list`：一个公共模型声明，两路读取共用；项目和全局走同一个投影生成器，配置覆写也可能没有地址。转换和环境选择已有可选读；通用已保存凭据发现按真实声明地址比对；Overlay 和生成 SDK 没有依赖必填地址的运行时消费者。独立 `base-url.ts` 导出同语义函数但没有调用者，运行时调用的是 `provider.ts` 内的实现；删除会影响架构索引，不属于本批契约修复。

## 根因和影响

1. 基线隔离开发服务 `39656` 从真实页面打开 Settings → Providers，显示 88 个提供方、0 已配置。显式刷新从公开 [Models.dev](https://models.dev/) 获取声明，真实 `POST /provider/refresh` 请求 `f0cd3b7f-1217-4d14-9ed1-8587556fb063` 返回 200，写入同一份 `models.json`；页面在重新读取后显示 236 个提供方。键盘焦点丢失与投影读取时提前解除等待状态另有截图和两次请求证据，属于独立界面状态，留下一批。
2. 同一持久目录内，项目 `GET /provider`（`e077311b-1062-4280-808f-0ba35d8f1e96`）和全局 `GET /global/providers`（`e3870313-8524-47bd-aed7-6ab0f0bcda62`）实际返回 HTTP 200、236 个提供方、8,108 个模型、0 连接。用各自正式 `/doc` 响应契约完整校验，两路各有 1,173 条失败，唯一错误种类是 `Model.api` 要求 `url`，共涉及 24 个提供方。首条 `cerebras/gpt-oss-120b` 的源模型与提供方均未声明地址，真实投影保留 `{id:"gpt-oss-120b",npm:"@ai-sdk/cerebras"}`。已安装 Cerebras SDK 默认地址是 `https://api.cerebras.ai/v1`；Bedrock SDK 按区域和自身配置解析，目录不应猜测固定地址。
3. 源目录的 model/provider 两级地址本来就是可选。投影中的 `provider.api!` 只压住类型不一致，运行时依然可能产生 `undefined`，通过 JavaScript 对象表示法（JavaScript Object Notation，JSON）序列化时省略。SDK 构造只在地址已解析时才传 `baseURL`，这一行为已存在。接口路由直接序列化数据而未按输出声明重解析，所以页面能展示，并且过去的操作清单检查仍通过；严格客户端却会拒绝目录响应，生成类型也会让地址访问者误以为总是字符串。
4. `api.id`、`api.npm`、配置优先级、实际请求目的地、地址白名单、错误和来源保持原契约。没有地址的模型不贡献可用于已有凭据的自定义地址；显式地址仍走同一解析与归属校验。现有持久目录无需迁移。无任务、队列、唤醒、恢复或终态异常；未涉及模型调度、数据库结构、凭据、流式推理和发布。目录存在不证明有权限或可执行；不会为验收该元数据合同发出 GPT-6.1 Sol 推理请求。

## 实施与验收

1. 在唯一 `ProviderModelSchema.api.url` 声明可选并说明其含义，删除模型投影对提供方地址的非空断言；发现流程明确接收可缺省地址。同步当前架构并从正常生成器重新生成 OpenAPI 和 SDK。对比差异，英文和中文接口索引若因只列操作而保持一致则无需改写。不开新配置，不生成合成地址。
2. 加聚焦正向测试：序列化后由同一个 `Provider.Info` 解析，保留 SDK 自定地址模型的真实标识与包、提供方声明地址及模型覆写地址。执行直接相关的投影、发现、目录和正式 OpenAPI 测试以及类型、文档、架构检查。
3. 复用基线保存的真实公开目录启动候选服务，无凭据。用运行时 `/doc` 完整校验真实项目和全局响应；对比缺省样本和显式地址的身份与持久声明。在实际桌面页进入 Providers、搜索并查看相关目录条目，人工复核实际截图。确认只关闭本批自有服务；证据与聚焦提交归档后，检查完整待推送集合，正常合并上游并推送。

## 交付证据

- 候选 `39658` 使用基线真实刷新后的同一个持久目录重新启动，没有迁移、重写或再次请求外部目录。用 Ajv 对真实 `/doc` 响应 schema 和完整响应体做结构校验（两边使用相同设置；不额外断言格式关键字）。项目 `provider.list` 请求 `eb206d26-510a-4e37-aaed-1b22229c8d77`、全局 `global.providers.list` 请求 `62eb8f23-a6ad-4821-b68e-e8e003c66279` 均为 200，结构校验通过。分别核对 236 个提供方、8,108 个模型、0 连接；与基线逐条比对 1,173 个缺省地址模型的提供方、模型及软件包标识。Cerebras 样本仍是 `{id:"gpt-oss-120b",npm:"@ai-sdk/cerebras"}`；OpenCorvus `glm-4.7` 样本保留其与磁盘声明相同的 `https://opencorvus.ai/zen/v1`。
- [桌面截图](../../artifacts/2026-11-11-provider-catalog-optional-api-url/README.md)：实际 Settings → Providers → 搜索 Cerebras → 展开配置 → 搜索 Amazon Bedrock。本人确认 `Configured 0`、`Catalog 236`、Cerebras 2 个模型和 Bedrock 163 个模型可见，空凭据表单没有误报配置。真实 Web 桌面页面；未验收安装版原生窗口。
- 正向投影、凭据地址归属、实时目录与 OpenAPI 相关四组共 29 项、64 次断言通过；正式 SDK 生成只更改 `Model.api.url` 的可选性和描述，双语接口索引检查仍一致（353 个操作、26 组）；架构索引 20 篇和路由检查通过。基线服务和代理以及候选服务均通过身份核对、公开关停、进程退出码 0 和监听关闭。隔离 SQLite 完整性检查为 `ok`，会话、消息、执行任务、提供方使用事件、提供方活动请求及权限流水均为 0；没有模型推理、凭据读取或保存操作。
