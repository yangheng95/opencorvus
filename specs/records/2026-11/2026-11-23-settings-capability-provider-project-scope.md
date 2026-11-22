# 聊天、通用工作与模型服务商设置区分同名项目

## Recall

- 用户要求本人独立持续迭代 OpenCorvus，先调查根因和影响并落盘，再实施、真实桌面交互与人工截图复核、聚焦正向测试、范围提交、合并上游和普通推送。第 399 批 `25bf97e0b` 已推至上游，两端 0/0，177 项无关工作区状态逐行保留。本批产品目标文件没有既有本地改动。
- 已读 Chat／Work 设置宿主、`ConversationCapabilityPanel`、`ProvidersPanel`、`SettingsProjectScope`、现有工作记录项目查询、项目名称与目录函数、两语言目录、公开能力路由和服务商配置／读取范围。全仓检索 `settings.product.scope_project`、`implicitProjectSuffix`、`scopeDirectory`、`scopeProjectLabel` 和现有专用样式。同语义共享范围已在网络代理、通道、技能与模型上下文协议（Model Context Protocol，MCP）设置使用。Chat 和 Work 共享一处能力设置呈现，服务商还有一处独立旧呈现，其他 `scopeLabel` 消费决策权限身份。没有发现本批路径内界面自动化。 [界面架构](../../current/architecture/07-panel.md) · [供应商架构](../../current/architecture/06-provider.md) · [已确认分配焦点](2026-11-10-capability-assignment-save-focus.md) · [服务商原范围](2026-11-05-provider-scope-context.md) · [共享项目范围的网络先例](2026-11-10-network-proxy-same-name-project-context.md)
- 在正式开发服务使用两个本人创建的 Git 项目 `alpha/workshop` 与 `beta/workshop`，目标是三处折叠状态明确区别实际目录、展开保留完整路径、键盘焦点可用且设置内容与当前目录匹配。复看英文和简体中文、动态切换、现有共享界面与可以通过真实页面进入的无目录情形。验收只读，使用实际能力与服务商配置读取回执，无配置写入、凭据、添加连接、调用工具或模型。

## 实施前现象、根因与影响

1. 基线 `40524/ui/` 200，实际入口 `main-jM2QDImN.js`。两个同名测试项目通过实际 `/project/current` 得到不同项目标识，实际 `/work-ledger` 有两条独立目录。真实侧栏显示 `workshop · beta`、`workshop · alpha`，从 Alpha 点击 Beta 后首页明确切到 `workshop (beta)`。
2. Alpha 和 Beta 的 Chat、Work 与 Providers 折叠标题均为 `Current project: workshop`，三个设置面均需要展开才能判断目标。Beta 模型服务商可用 Enter 展开真正的 `beta/workshop` 完整路径，焦点和路径正确。公开 `/chat/capability` 与 `/work/capability` 按两项目分别返回各自 `scope.directory`，分别 37 和 41 项内置工具、各 6 项技能。两项目独立服务商目录均为 88 项、0 已连接。数据和切换正确。 [七张基线截图和请求](../../artifacts/2026-11-23-settings-capability-provider-project-scope/README.md)
3. 两个面板各自组合目录的 basename（末级名称）和仅适用于隐式项目的短标识。显示源码都从 `projectDirectoryLabel(...).name` 取末级名称，丢弃已有 `.parent`，另展开完整目录。早期服务商范围说明和能力页面的焦点修复给了明确作用域、原回执及完整目录，未把父路径带入折叠状态。现有共享 `SettingsProjectScope` 已用登记名或目录名、隐式标识和短父路径，适用于这三处。源项目来自各面原权属逻辑，工作记录只提供同一规范目录的已登记显示名称。
4. 影响限于聊天与通用工作原生能力的项目范围、服务商项目作用域与两处路径样式。真实配置读取、写入、选择代次、重试、配置继承、全局模式、服务商共享登录和密钥、权限及模型都沿原合约。无新增调度、队列、唤醒、重启恢复、并发写入或轮次终态异常。风险为切换期间旧目录标签、同名项目或自定义名称取错、长路径撑栏、原能力核对后的焦点引用消失，以及服务商全局模式被误认为项目范围。

## 实施与验收计划

1. 两处采用当前 `SettingsProjectScope`。能力页继续使用已接受的能力响应目录或当前请求目录，保留重试成功的范围触发器引用。服务商继续使用其唯一活动目录。已有项目登记名从规范路径匹配的 `workLedgerProject` 只读取得。按确切目录挂载展开项，原有全局和无项目文案继续由各自界面判断。删去两处旧字符串派生和专用路径样式，保留各自需要的外部布局。
2. 用独立服务复验英文两项目三处范围，真实键盘及鼠标可展开精确路径，简中至少经过同名范围切换和原项目说明。确认没有改变共享目录界面的路径样式、服务商目录、原能力声明内容及全局说明。鼠标和键盘证据来自本人操作和复核截图。使用两项目公开响应、Git 文件、隔离数据库以及现有目录投影、能力路由、服务商投影的聚焦正向测试。运行类型、双语、样式令牌、真实构建、根文档和架构索引。不依赖凭据或模型，不将界面自动化用于验收。
