# 连接操作等待当前配置代际结算

## Recall

- 用户要求本人持续分批调查、先落盘根因与影响、实施并验证真实桌面、亲自复核截图、聚焦正向测试、范围提交和正常上游同步。本人独立完成。上一批 `ebfb1b270` 已正常推送，与上游 0/0，原 177 项工作区状态逐项一致。
- 已读 `AGENTS.md`、`04-extensions.md`、`05-config.md`、`07-panel.md`、[配置写入投影](2026-11-12-config-write-expanded-projection.md)、[项目连接精确归属](2026-11-12-mcp-runtime-exact-project-reference.md)、[连接路由](2026-11-12-mcp-exact-operation-routes.md)及现有配置读取、跨进程结算、凭据和目录测试。全仓查 `currentProjectStateUnderGenerationOwner`、`pendingPeerTransitions`、`queuedPeerTargets`、`pendingPeerSettlements`、`withRuntimeControl`、`durableGeneration`、`durableIdentity`、`ensureConfiguredConnections`、`MCP.connect/disconnect`、`startAuthFlow`、`supportsOAuth`、`readResource`、`getPrompt`、`observedCatalogSnapshot`、`exactCatalogTool`、`HostSessionRuntime` 与生产控制、命令、目录、会话及工具调用点。未发现本批路径的用户界面自动化测试。
- 验收使用两个真实开发后端共享独立数据目录、两个同名项目、本人启动的 Chrome 和匿名本地 Model Context Protocol（MCP，模型上下文协议）端点。对照真实保存回执、首次控制、重启、项目独立性与实际端点。无外部 Provider、账号或模型调用。OAuth（Open Authorization，开放授权）预检使用支持探测的匿名本机端点。

## 修改前证据

- 读取端已连接两个项目各自的 `review-tools`。写入端更新主项目的同名定义，由 `/project/normal` 改为 `/project/padded`，返回 200 `55c97f13-8f96-4412-ae59-505217cc4a71`。读取端第一次连接返回 500 `39d9a009-e1fd-4136-9b6a-074f41392a0d`，已能读回新地址，另一项目仍在线。约 700 毫秒后再次操作成功。真实英文桌面也复现 500 `04b51298-db3a-417c-9726-cc36fc27d063`，原位重试 `b7b529dd-5dc0-412a-86ae-2ab1236edf1d` 后在线。服务日志两条均为 `MCP server review-tools configuration changed before connection started`。[实拍和回执](../../artifacts/2026-11-12-mcp-peer-runtime-admission/README.md)
- 写入端再改回原地址，读取端实际点击断开得到 200 `706b71a6-5a22-4a7f-b229-a3cae119ae85` 和 `true`，项目读回是普通 `disconnected`。无同期写入时同一按钮明确得到 `disabled` 和 `reason:"manual_disconnect"`。独立直接请求也得到成功回执与未落实的手动状态。
- 另一项目的 OAuth 预检通过写入端启用自动探测并切换匿名端点。六次实际交叉保存中首次有一次返回 500 `6f3a9bb9-7d36-454b-9c68-c90a485ed993`，日志为 `configuration changed before OAuth startup`。其余五次在各自实际投影及时结算后返回 200 与空授权地址。两个项目并行控制刚提交的全局定义，一次 500 `f3dd5ce7-e96b-42f6-b50d-8fa8fd2cd029`，另一个同名项目已成功，正常重试后两者均在线。
- 真实资源目录在另一个协议端点提供具名资源和提示。三次写入新定义后立即读取 `GET /experimental/resource` 均为 200 空目标，约 270 毫秒后返回准确新端点资源。`GET /command` 首次读取正常端点命令，写入新端点后立即请求返回 404。实际新资源可读后，再次读取命令返回 200，命令仍使用旧描述却执行新端点的模板。命令列表的独立缓存已经观测到持续过期，需修复 `Command` 投影的所有权与更新机制。本批先修共用的 MCP 运行态准入，命令缓存问题保留实跑证据。

## 根因和影响

已加载后端从配置文件重新读取有效事实时，`currentProjectStateUnderGenerationOwner` 返回新 `Config.Info` 并异步调度该项目的运行转换。`MCP.state()` 只取得已初始化项目状态。`connect`、`disconnect`、OAuth 启动与资源读取此时会同时拿到已提交配置和较早的 `durableIdentity/durableGeneration`。连接直接报错误，断开提前返回而路由无条件确认，OAuth 启动按代际检查抛出，`ensureConfiguredConnections` 跳过未结算名称而使首个资源结果缺失。上一批统一了写入端候选，另一后端读取到新文件与运行态完成是两个顺序步骤。

横向核对项目和全局写入、热读取端与冷启动、同项目串行和两项目并行、连接/断开、授权探测、资源与提示读取、观察型目录及实际 Tool（工具）绑定。`observedCatalogSnapshot` 有明确的配置与运行观察合同，仅为准确配置身份发布工具绑定。已绑定工具和 MCP App 按原配置身份、目录代际及实际连接检查继续失败关闭。Task（任务）的固定包和授权从 `RuntimeContract` 读取，Task 和直接 Chat/Work（对话和通用工作）的会话范围 MCP 由 `HostSessionRuntime` 持有并按实际范围创建；Mission（多步任务）及普通 Session（会话）通过既有作用域和授权投影运行，权限继续保留原身份。直接控制和当前项目级资源、提示使用共享项目状态。恢复时从规范配置和已持久授权恢复，已结束 Task 或 Mission 的终态不由连接控制请求写入。已有代码和两后端运行证据覆盖了当前配置的作用域转换；尚未实际以模型重放 Task/Mission/Session 轮次。需通过现有重启、权限、代际、范围和固定合同检查确认这条边界。

`schedulePendingPeerTransition` 在取得项目运行锁前完成配置准入，避免写入者持有配置/目录所有权等待运行锁的倒序。本批应直接等待该项目已有结算 Promise，在配置读取、技能目录和具名运行控制的锁之外等待。已提交的 peer 代际在开始实际控制前完成；操作进行中遇到后续配置变更仍按真实快照和代际拒绝。原 OAuth 回调保留准确项目、授权发出时的端点和持久授权轮次。无需持久格式变化或迁移。

## 实施和验收

- 复用当前配置读入与待处理运行转换。为需要实际运行态的入口获取已结算的当前项目配置，等待同一项目的已调度转换完成，并报告真正失败的结算。普通配置读回、状态观察及其他项目保持各自入口，不引入第二份状态或人为休眠。显式连接、断开和 OAuth 启动共用一次准确配置与运行代际验证，资源与提示的当前项目读取也通过该准入。保留对后来变更的准确检查，断开只有成功记录目标代际时才返回肯定回执。对确实在操作期间更换的配置返回可辨别的冲突契约。具名 OAuth callback 的已绑定凭据继续依原有身份验证。
- 正向契约应覆盖真实 peer 已保存后首次 connect/disconnect/OAuth 预检和资源读取，断开应读回 `manual_disconnect`。测全局与项目真实保存、两个项目的串并行、重启后准确端点、真实协议数据、以及在途配置变更的明确错误。走真实 `/ui/` 英文和中文桌面，亲自截图复核。验证现配置收敛、固定 Task、权限恢复与 MCP 凭据路径，运行类型、接口生成、文档、构建和语言检查。关停仅本人拥有的验收服务及浏览器，范围提交和正常上游同步。
