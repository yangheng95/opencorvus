# 执行目录和授权保留项目连接原始名称

## Recall

- 用户要求持续分批调查和实现，本人独立工作。先记录根因与影响，再验证正式检查器、真实桌面及人工图片、聚焦正向测试、范围提交、合并上游和普通推送。未委托。上一批 `35be9876c` 已推送，`main` 与上游 0/0，原 177 条状态保持。
- 已读 `04-extensions.md`、`17-code-work-agent-platform.md`、`02-data.md` 的运行目录和持久化合同，以及[连接认证身份](2026-11-12-mcp-oauth-exact-connection-name.md)和[分配写入校验](2026-11-12-mcp-assignment-name-validation.md)。全仓查询 `CapabilityRef`、`CapabilityRefCodec`、`mcp_server`、`mcp-config`、`default-mcp-registry`、`defaultMcpServerRefs`、`resolveOccurrenceHarnessGrants`、`RuntimeCapabilityCatalog.snapshot`、`server_ref.local_ref`、`CatalogOccurrenceBinding`、`terminalizeRecoveredIncompleteAssistant`、设置显示和调用点。重点阅读 `capability-ref`、`harness-projection`、`descriptor`、`capability-runtime-catalog`、`HostSessionMcpRuntime`、`SessionLoop`、`MissionSkillRuntime`、专家团 `registry` / `capability-grants` / `PromptProfileResolver`。本批不改变原生项目分配文件合同，前批已用显式说明处理该编辑限制。
- 验收要求在两个真实同名隔离项目中，精确区分普通名、首尾空格名、空名。正常轮次授权和执行目录需产出正确的父连接引用及其配置状态，序列化及重新加载保持引用；普通连接和包授权保持旧合同。核对真实项目和执行轮次读回、重启、并发和相关恢复与终态检查；真实桌面检查项目连接和前批分配入口，并人工看图。全程隔离，真实模型需要单独的已确认授权。

## 基线及根因

用实际开发源码与 SQLite（结构化查询语言嵌入式数据库），在两个同名项目中并行保存普通和 Mission（多步任务）会话，使用 `Config.get`、`Session`、固定角色注册表和生产 `SessionLoop.resolveOccurrenceHarnessGrants`。主项目有 `review-tools`、`" review-tools "`、`""`，普通编程和 Mission 均报 `local_ref` 的 `too_small`。另一项目有前两个确切键，两个入口均报 `Harness grants contain duplicate capability reference capability:mcp_server:project:mcp-config:review-tools.`。两项目在不挂载连接时，普通编程和 Mission 均正常返回其他授权，项目和会话标识各自独立。随后在新进程读取同一持久会话，Chat（对话）在零分配时也会构建整个项目 MCP（Model Context Protocol，模型上下文协议）目录，主项目仍报 `too_small`，另一项目明确报 `CapabilityCatalogContractError` 的重复引用。基线[事实记录](../../artifacts/2026-11-12-mcp-runtime-exact-project-reference/README.md)。

输入配置允许普通字符串的对象键，多个真实入口从配置按原始键取名。共享 `CapabilityRef` 却在编码和目录发布前无条件裁剪并要求非空，破坏原始连接身份；后续授权和目录的去重正确地拒绝碰撞。项目连接描述又把原始名字作为非空且最多 240 字符的显示标题，修正身份后空名仍会在该层失败。既有设置校验只守护分配写入，不能保护全清单目录，也不能覆盖从全部项目键派生授权的编程和 Mission 入口。连接状态、凭据和精确路由已按原始键工作，不需改变。

## 影响和实施方案

- 普通轮次在 `SessionLoop` 中解析 grant 后进入目录并发布 occurrence（执行轮次）绑定；权限继续使用同一解析入口和持久绑定。Chat/Work（通用工作）自身分配受前批校验，但两者运行目录读取完整配置清单。Mission 和普通编程会话会从全部配置键派生。Task（任务）编排器与执行者优先使用其精确运行合同，不从项目清单创建服务器授权；专家团 `registry` 明确拒绝 `defaultMcpServerRefs`，只允许显式项目 Tool/Prompt/Resource 或包内引用，后者仍保留其原规范。其他 role 通过普通 `SessionLoop` 共用构造。现终态恢复从实际持久 Message（消息）和运行合同读取；权限重启继续读 occurrence 绑定并核对当前材料。没有观察到新的任务派发、队列、串并行唤醒或终态持久化异常，尚需通过相关真实检查器及复启读回来确认影响边界。
- 精确处理 `kind=mcp_server`、`source=project`、`owner_ref=mcp-config` 的 `local_ref`。其他类型和所有者保留现规范；继续复用同一个引用编码与目录、授权校验。已持久化引用先前经规范化，旧合法编码仍解码到同一字符串，旧普通名不推断为另一个带空白的键。不会重写已经结束的 occurrence，数据库结构和用户配置内容无需迁移；若需要读取已存非规范对象，先以实际写入点证明该格式可产生。保留原授权校验、作用域和去重；不修改运行中的权限规则。
- 目录显示沿用现有带引号的精确名称呈现规则，将共享显示格式供设置和运行目录使用；仅展示文字应用既有长度边界，引用及工具父关系保留全名。运行服务逐个使用精确键及其 scoped owner，校验无访问授权的连接、同时存在同形连接和另一项目的实际读回。若发现现连接提供方的命名规则冲突，使用既有显式错误，不添加第二种运行工具名称。
- 聚焦正向检查包括原样引用及编码、准确授权和目录描述、父工具引用、重复隔离项目并行、同一持久会话复启和恢复回执。正式桌面复核连接管理和两产品分配。运行 SDK（软件开发工具包）生成、公开结构与当前文档检查，保存本地真实协议与数据库证据；未调用真实模型时明确标出对应运行覆盖缺口。

## 真实协议验证发现的执行所有者碰撞

第一版修正后，持久会话的 Chat/Work 目录已成功。把两个项目的普通名 `review-tools` 和仅尾部多一个空格的 `"review-tools "` 分别连到匿名本地 MCP 的不同端点，实际协商及读取工具成功。普通编程和 Mission 仍在目录发布报 `CapabilityOwnerUnavailableError`。两个独立连接对象的 `server_id` 仍分别准确，但其 `owner_id` 均为 `session:<sessionID>:mcp:review-tools`。现 `HostSessionMcpRuntime` 用原名拼接 owner，`createScopedConnectionOwner` 对整体 trim，后续按 owner 建索引覆盖了普通名的工具清单。通用目录的 owner ID 也要求规范非空文本，因此不能让任意原始配置键作为未经编码的尾段。[实际回执](../../artifacts/2026-11-12-mcp-runtime-exact-project-reference/README.md)。

为尾部空白会被规范化的项目连接，在现有 Session owner 构造点用明确 `mcp-exact` 固定段和百分号编码保存原始身份，普通连接继续使用已规范且已发布的 `mcp` 固定段。两个命名空间在配置名之前即区分，任意配置名不能越界，也不需要改变通用 owner 解析。空名的旧 composed owner 以冒号结尾，现编码已唯一。之前可正常写出的普通 owner 原样可读。旧带空白连接的已记录目录保留历史值，恢复中继续按准确 owner、项目、原绑定和当前 revision 核对，无法重建原始引用时应由现陈旧契约拒绝新执行，不能猜测。第二版需通过真实 `tools/call` 分别返回各项目、空名、普通名、带尾部及首尾空格连接自身端点，记录同一轮次的明确父引用和 owner。启动第一次协议探测时隔离配置缺少 `transport`，补上现行 `streamable-http` 后重跑并得到上述真实结果。

执行 owner 区分后，另一项目的普通编程和 Mission 已分别通过 `PermissionAuthority.authorizeAndExecute` 执行三条真实调用，三个端点各返回自己的标识。主项目的空名仍在真实 PermissionRequest 构造中报 `providerID` 的 `too_small`，在任何执行前停止。第一次直接调用工具对象得到现有「需要权限 owner」错误，于是测试接入正式权限入口。`SessionLoop` 传的是连接准确 `serverID`，请求对象的最小长度检查却适用于所有提供方；已审计 ledger（权限账本）入口、事件落盘、归属校验、终态投影与恢复，SQLite 要求请求行 provider_id 为非 null，空字符串和 null 区分，读取同一个请求 schema，scope 和授权匹配都比较精确值。修改该 schema 仅对 `mcp` / `mcp_app` 接受空字符串，保持其他类型的最小长度；继承同一对象的 Session 权限事件使用安全 schema 扩展。设置的授权与历史技术详情用同一名称显示空和空白的 MCP 连接。需要验收两项目真实调用、持久记录、重启和桌面详情，SDK 和公开文档同步核对。[第二版运行证据](../../artifacts/2026-11-12-mcp-runtime-exact-project-reference/README.md)

## 最终结果

两个同名项目四条真实持久会话在新进程读回。普通编程与 Mission 由正式角色、轮次授权、目录、Host 精确工具和权限入口分别调用各自的匿名本地服务器。主项目两个角色各四次，另一项目各三次。十四个调用均获真实 200，输出对应准确端点，目录的父引用和 owner 与调用一致。Chat/Work 正常解析同一完整清单。第二次服务启动的公开 `/permission/history` 为两个项目分别读回 8 和 12 个终态，包括前一轮另一项目成功的六次。数据库只读核对二十个成功终态、权限来源、结果和四条会话，完整性为 `ok`，消息、执行任务及模型活动计数为零。

聚焦检查 21 项、109 断言通过，覆盖原生的搜索、确切工具、任务投影、权限继续和终态边界。另在第一次候选运行七项授权和路由检查，83 断言通过。软件开发工具包和实际接口结构、应用类型、双语 3214 项、样式、渲染器公开面、真实构建和文档均通过。模型驱动的真实任务、恢复和 GPT-6.1 Sol 验收没有执行，权限及恢复的覆盖来自正式检查器和本地真实协议。

1266×766 的真实候选 `main-DzAqcnvj.js` 已逐张复核。英文和中文权限详情准确显示空名与带空格名。正式开发服务首次在构建尚未完成时注册界面资源，`/ui/` 返回 404。构建完成后重启本人服务，正式页面 200 并复核。实际中文连接管理中，尾部空格名称可连接并恢复为已断开，独立请求均 200。空名手动连接生成 `/mcp//connect`，请求 `e168aa5d-78fb-4a6e-8bad-902008aae600` 返回 404，作为下一批公开操作路由的基线。两个项目另有 `skill/mounts` 500，实际后端诊断为已配置禁用 Browser 而活动专家团声明 Browser。该现象留作独立调查。连接分配继续显示现有范围，未提供特殊名称的 Chat/Work 分配。本人浏览器、服务和本地协议进程均正常退出。[实拍、实际协议及持久证据](../../artifacts/2026-11-12-mcp-runtime-exact-project-reference/README.md)
