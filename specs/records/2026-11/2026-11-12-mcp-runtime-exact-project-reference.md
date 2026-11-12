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
