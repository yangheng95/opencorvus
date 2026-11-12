# 配置写入以真实展开后的候选结算

## Recall

- 用户要求本人持续按批次调查用户界面、功能和缺陷，先落盘根因和影响，再实施、实拍、人工复核、聚焦验收、范围提交及正常推送。没有委托。上一批 `9ef3b1017` 已正常推送，与上游 0/0，原有 177 项工作区状态逐项一致。
- 已读 `AGENTS.md`、`04-extensions.md`、`05-config.md`、`07-panel.md`、[新增连接原名](2026-11-12-mcp-add-exact-name.md)、[精确操作](2026-11-12-mcp-exact-operation-routes.md)和现配置读写、JSONC（JSON with Comments，允许注释的 JSON）诊断、同进程与跨进程收敛、连接代际和凭据提交测试。全仓查 `ConfigPaths.parseText`、`loadSourceSnapshot`、`parseSourceLayer`、`parseConfig`、`migratePermissionText`、`writeConfigFile`、`updateProjectPatchAtomic`、`resolveProjectCandidate`、`resolveGlobalCandidate`、`commitGlobalCandidate`、`settleProjectRuntimeTransition`、`prepareProjectConfigReconciliation`、`Config.Event.ProjectChanged`、`resolveOccurrenceHarnessGrants`、`MCP.configure` 和 `ApiError`。未发现本批路径的用户界面自动化测试。
- 验收覆盖项目和全局读写、两个同名项目的独立实时连接、真实连接协议、进程重启、正常名称的实际新增及可行动的双语拒绝。使用两个隔离项目、独立 Chrome、本机无凭据协议端点和非敏感配置变量。无真实 Provider、账号或模型请求。

## 修改前证据

- 主项目的 `review-isolated` 指向本地 `/project/normal`。英文真实表单新增 `review-{env:OPENCORVUS_BROWSER_MODE}` 指向 `/project/padded`，原名正确发出，HTTP（Hypertext Transfer Protocol，超文本传输协议）200 `18fe9422-51fe-4603-bf32-fc8fd7d25f39` 的响应却只有 `review-isolated`。表单保留草稿并提示无法确认。项目文件确实同时保存两键，`GET /config` 只得到一个 `review-isolated` 指向 `/project/padded`。点击原行获 200 `42c9a028-5668-4a6d-9829-3b2839197737`，初始化、完成通知和工具列表均抵达 `/project/padded`。另一项目的直接 `POST /mcp` 使用 `review-{file:review-mode.txt}`，同样 200 后覆盖生效名称的地址。两测试新增原键随后按原名删除，原本项目地址恢复。对照项目作者主动配置的 `authored-{env:OPENCORVUS_BROWSER_MODE}` 仍展开为 `authored-isolated` 并指向 `/alternate/dot`。[实拍与实际请求](../../artifacts/2026-11-12-config-write-expanded-projection/README.md)
- 对照项目已连接 `authored-isolated` 时，正常新增 `fresh-review` 返回 200 `93c37422-69dd-42fe-be0b-ebc83a454853`，导致既有连接由 `connected` 变 `disconnected`。独立 `PATCH /config` 更新无关字段 `autoupdate:false` 也在 200 `38a6dc79-a290-46f9-9b84-27e661b2472d` 后断开该连接。项目模板定义字节含义和有效地址相同。全局修改无关字段时，项目自己的展开连接仍在线。冷启动后两个项目分别连接由隔离全局配置展开的 `global-isolated`，均 200，`PATCH /global/config` 无关变更 200 `0396fa53-c555-4bb9-b328-57562396567e` 后两个已连接运行态均成断开。全局文件仍保留原变量声明。
- 在运行服务上先手工引入全局变量定义再立即控制时，两条连接尝试先返回 500，随后实际状态可见。冷启动相同定义的两次控制均通过。该瞬态生产路径需要独立验证 peer（同数据目录的另一后端）运行态跟进时序，当前证据未能断定其触发原因。全局冷启动对照已排除该现象对本批全局写入断连证据的干扰。[跨入口回执](../../artifacts/2026-11-12-config-write-expanded-projection/README.md)

## 根因与影响

配置读取的 `load` 用 `ConfigPaths.parseText` 先替换环境和文件表达式，再解析与验证。写入生成文本后，`migratePermissionText` 也实际读取展开的投影，但只用来决定旧权限格式的迁移。`writeConfigFile` 随后丢弃该投影，用原始 `parseConfig` 构造 `resolveProjectCandidate` 或 `resolveGlobalCandidate`、执行写入校验和提交后运行态结算。等真实文件再次加载才有展开后的准确事实。项目和全局均走该共用写入器。`MCP.configure` 的定义写入受该事务所有者保护，仍然接受了投影会改变键或连接设置的字面输入。旧的确切回执发现缺键时，磁盘和有效定义已经改变。

运行态直接按候选差异决定移除、代际推进、授权材料比对、连接关闭、断开覆盖清理以及发布 `project.config.changed`。首轮把旧生效名当成删除，下一轮重读看到展开的生效名再加入，原已建立的连接不会随第二轮恢复。全局与项目各自解析作用域，故受断开的连接取决于哪一份源被错用。凭据清理由当前配置复核准确身份，待处理运行转换、跨进程读取、渠道监督、原生角色和 Provider 目录也消费同一配置投影，验收需检查序列和作用域。项目的 MCP 新增/删除、Chat/Work 分配、技能挂载、Provider 移除、默认专家团与终端配置用现项目写入器。全局设置和全局原子补丁共用全局写入器。命令行直接编辑 JSONC 的 `writeMcpConfigEntry` 以及会话叠加层分别拥有独立的持久化入口。

横向审计覆盖有效配置在正常 Session（会话）、Mission（多步任务）与 Task（任务）执行轮次的读入、会话权限继续、Task 固定运行合同、投影目录及重启恢复入口。Task 的已固定授权从既有 `RuntimeContract.harnessGrants` 读取，普通会话与 Mission 从准确的项目或会话投影取得当前授权；配置结算还会影响共享连接代际。已完成与取消的执行由持久事实收敛，配置写入本身不产生模型消息或终态。现已实际复现项目和全局的运行态异常，尚未观察到任务调度、唤醒或消息回放异常。将用现项目代际、peer 重试、真实配置持久化及最相关的任务固定合同检查核验上述边界。已保存的碰撞原文无可靠意图标识，由操作者选择原定义后恢复；隔离测试已恢复两项目的字面输入试验。

## 实施与验收

- 共用 JSONC 写入器从用于权限迁移的同一个解析结果获得展开候选。运行校验、候选覆盖、全局与项目运行结算和写入回执使用该候选；原始文本用于保留作者表达式、注释和文件编辑。现项目和全局锁、原子写入、重试、跨项目隔离及凭据事务继续使用现入口。整个转换只保留一份展开后的运行事实。现有已持久表达式以及合法的显式配置补丁可以继续展开。
- `MCP.configure` 的输入是精确字面身份和配置。比较实际候选中展开后的项目 MCP 配置与对展开旧值应用原提交的合并补丁结果。比较在同一持久事务且实际提交前执行，保护既有其他连接，命中实际变值或候选无法解析时返回结构化 400，凭据阶段沿已有失败回滚。采用真实解析与完整结构比较，保留全部可无损投影的连接名。当前写入器在值会被配置替换时拒绝该笔字面新增，不提供自动转义。桌面保留草稿并显示本地化提示和正常诊断入口，用户可以修改输入重新提交。界面继续支持其他合法名称和同名更新。
- 核对两个同名项目的英文与中文真实表单、正常新增和连接状态、直接环境与文件碰撞、重启读回、项目及全局无关变更、真实工具列表协议回执和 SQLite 持久化。针对配置读取和写入、peer/代际、聚焦公开路由、凭据提交、会话及 Task 授权检查运行仓库检查。运行构建、双语、类型、公开生成和文档检查，精确关停本批自有资源后提交并正常同步。

第一轮英文实拍确认错误在提交区显示，原草稿和在线连接均可见。错误文字中的“配置引用”较抽象，改为指出变量或文件引用，并写明可以修改名称或设置。第一轮已用同一草稿改名重提并取得 200。移除该验收用条目后用最终构建复核两种语言。

## 验收结果

- 最终英文变量请求 `6ee18d7d-4d61-4dfd-abde-87f0bccccb10` 与中文文件请求 `ca350973-cc60-40df-beb7-7dfbbbcc23c7` 均返回 400 `mcp_configuration_projection_changed`。真实页面保留名称和地址，原连接继续在线并指向原端点。分别只改名称，正式请求 `f0a5fe81-ea3a-477b-8fcb-13466c020018` 和 `d95254c7-4703-401b-aeb1-a663f91c4e38` 均 200，列表显示两条与三条项目连接全部在线。本人逐张复核六张候选截图。
- 已连接的项目定义经过无关项目保存和恢复仍在线。两个项目的全局连接经过无关全局保存和恢复均在线。显式项目和全局配置补丁分别使用测试文件和环境引用，两笔返回 200、有效 `username` 为 `isolated`，原文件保留作者表达式，读取、回执和运行连接一致。生成的软件开发工具包实际发送 10 笔候选请求，核对字段值变化、环境或缺失文件引用返回明确错误。重启后再发 13 笔请求，五个项目定义与全局定义的两个项目运行实例均重新连接。七个本机端点共 27 组初始化、通知和工具目录协议成功回执。
- 核心 86 项、194 个断言全部通过，覆盖项目与全局源归属、配置读取和写入诊断、冷配置、跨进程重试、MCP 代际和凭据、固定 Task 合同、会话权限恢复与真实 Mission 持久关闭恢复。前端服务 29 项、55 个断言。两包类型、样式、双语 3218 项、完整构建、渲染器公开面、接口生成与文档 353 个操作、路由、20 个架构索引检查均通过。隔离数据库检查为 `ok`，两个原会话保留，消息、引擎任务、模型请求、结果及用量均为零。本人启动的 Chrome 和服务均正常退出。没有使用真实 Provider 或 GPT-6.1 Sol。
- 运行态刚读取另一进程手工写入时的控制请求 500 仍待独立复现及修复，本批已验证的本地提交和重启路径可以完成现验收。[最终截图及回执](../../artifacts/2026-11-12-config-write-expanded-projection/README.md)
