# 项目禁用连接时保留专家团和技能设置

## Recall

- 用户要求持续迭代，本人独立体验和调查，先落盘根因及影响，再修复、验证真实桌面与截图、运行聚焦正向测试、范围提交、正常合并推送。未委托。上一批 `2abdad969` 已推送，主分支与上游 0/0，原 177 条状态逐行一致。
- 已读 `04-extensions.md`、`07-panel.md`、`17-code-work-agent-platform.md`、[技能库读取与结算](2026-11-10-skill-library-read-settlement.md)、[项目连接执行引用](2026-11-12-mcp-runtime-exact-project-reference.md)。全仓查 `SkillMount.matrix/setOverride`、`skill/mounts`、`expert-squad/catalog`、`resolveSkillProjection`、`resolvePackageCapabilitySet`、`defaultMcpServersForRefs`、`active_agent_projection`、`active_skill_projection`、`projected_tool_ids`、Browser 和 Computer 配置判定、Task（任务）包固定版本、真实 scheduler（调度器）和 worker（执行者）轮次的调用点。已读相关两个路由、活动目录和设置界面、配置变更验证、技能挂载数据、运行合同与权限续跑。未检索到相关界面自动化测试。
- 目标是显式禁用 Browser 时仍可查看专家团和分配不依赖该连接的技能。目录应说明当前专家团要求的已禁用连接，使用同一份能力事实显示剩余成员与技能。当前明确的执行阻断必须可验证，保留另一个同名项目、已有任务包版本和实际授权边界。中英真实 `/ui/`、实际项目和 Session（会话）读取、正向聚焦测试、保存/重启隔离验证。本批可用本地配置与生产轮次解析验证，不使用外部模型或凭据。

## 修改前证据、根因和影响

两个同名真实项目 `archive-review` 都以 `dynamic` 为有效专家团，主项目显式写 `mcp.browser.enabled:false`，另一项目使用正常内置默认。主项目 `GET /config` 200、`GET /mcp/project` 200 显示 Browser 已禁用、`GET /skill/installed` 200 有六项技能。项目、会话及显式 `base` 的 `GET /skill/mounts` 均 500，另一项目同三条入口均 200。项目和会话的 `GET /expert-squad/catalog` 在主项目均 500，另一项目均 200。英文设置首页出现技能或连接读取错误，专家团入口只剩错误和重试，技能库仍显示六项。另一项目中文列表与 Dynamic 成员详情正常。[真实页面及回执](../../artifacts/2026-11-12-squad-catalog-disabled-mcp/README.md)

主项目 `PATCH /skill/mount` 为 `dynamic-builder` 分配已安装的 `default/skill/grill-me` 返回 500 `dc428f4f-34c3-4a47-b8cb-ae4d5a9df512`，持久配置原文一致。该请求先调用同一矩阵验证作用域、精确专家团、成员和技能，失败发生在写入前，保存结果未丢失或重复。四条独立服务诊断与真实页面的请求 ID 关联到同一个错误 `Active expert squad projects default MCP server default/mcp/browser, which configuration has disabled.`

共享 `resolvePackageCapabilitySet` 同时生成编排器、平台工作者和包工作者的能力。其 `defaultMcpServersForRefs` 为执行读取必需连接，显式禁用时抛出。专家团目录与技能矩阵也使用该全量执行解析，因单个已禁用 provider 丢失可读配置、成员和其它能力。此前隔离的技能安装读取绕开执行投影，故保持健康。实际生产 `resolveSchedulerTurnProjection` 和 `resolveWorkerTurnProjection` 并行复验，禁用项目两者仍应被阻止、另一项目的真实 `orchestrator` 和 `dynamic-builder` 解析通过。已审计新轮次、复启重新构造、Session 权限继续、Task 固定包版本、Mission（多步任务）派发与 Project 隔离的调用点。正常 Task/Worker 和权限恢复仍要完整的连接投影，终态收敛从已持久化事实读取。未观察到队列、重试唤醒或跨项目执行异常，基线没有启动 Task 或模型轮次。

## 实施与验收

- 同一个角色能力解析器显式接收执行或设置查看的上下文，继续使用原授权、Skill（技能）解析和默认连接声明。设置查看接纳已配置但被显式禁用的连接并收集其准确名称，仅投影其余可用默认工具、提示和资源。执行继续原有严格校验。无法加载或缺失配置继续遵循现错误合同。全程一份项目配置、包声明和角色定义，设置结果不成为执行授权。共享默认连接解析消除调度器和工作者重复的输入清点。通过真实设置的生效能力投影和可用工具关系检查技能依赖，保留不依赖该连接的技能、权限和作用域。
- 目录和技能矩阵在同一结果中可见该项目的已禁用连接集合。专家团设置使用现反馈组件显示中英文提示、准确名称和当前项目原因，用户仍能浏览列表和成员。项目和 Session 分配仍使用同一矩阵作保存前的目标校验和保存后读回。配置、持久消息、任务记录和执行权限 schema 无需迁移。
- 实际覆盖禁用项目、启用对照项目、项目和 Session 作用域、`dynamic` 与独立 `base` 查看，以及真实技能保存、读回和恢复。运行原执行入口及同版本恢复相关聚焦检查，确保当前检查器继续阻止禁用配置，控制项目正常。真实英文与中文桌面均复核专家团、技能或设置入口，人工查看对应截图。运行接口文档、生成 SDK、类型、语言和构建。关停自有进程，范围提交与正常同步。
