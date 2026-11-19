# 从真实监听器发布规范服务来源

## Recall

- 用户要求本人持续独立分批迭代，先完整根因/影响分析并落盘，再实现、真实桌面交互及截图人工复核、聚焦正向测试和需要的真实检查器、范围提交、合并上游及正常推送；不用子 agent。上一批 `572426d66`、`02eccc6b5` 已推送，上游 0/0，原有 177 项工作区状态保持。
- 已读 ACP（Agent Client Protocol，代理客户端协议）和 serve 命令、网络选项、Server.listen、runtime-url、启动回执写读、启动恢复/停止合同、重启握手定义及全部调用点、正式重启检查器与当前 server-runtime-readiness/03-control 架构。全仓搜索动态服务 hostname/port URL 拼接、所有 `beginRestartHandoff` 调用、来源配置消费及相同测试。监听器已提供 URL（Uniform Resource Locator，统一资源定位符），核心 HTTP（Hypertext Transfer Protocol，超文本传输协议）服务也已用它设置唯一 runtime-url。
- [Bun 官方 Server 文档](https://bun.sh/docs/runtime/http/server)声明 `server.url` 为带实际端口的标准 URL，href 带尾斜杠；消费 origin（来源，由协议、主机和有效端口组成）可保持原来的无尾斜杠公共形式。复用此事实，不增加 IPv6（Internet Protocol version 6，第六版互联网协议）手工括号格式器或第二个地址配置。
- 指标：IPv4（第四版互联网协议）和 IPv6 的真实绑定来源可访问；ACP 实际创建、提示、载入和派生可用；serve 启动回执、内部服务地址、日志/网页入口及重启 ready 地址采用同一真实来源。真实 IPv6 桌面页面、原件下载和重启后持久历史复核；无 UI（User Interface，用户界面）自动化、外部凭据或 GPT-6.1 Sol 冒充验收。

## 真实基线与根因/影响分析

1. 本机真实 IPv6 回环监听能 GET 200，Bun 报告 hostname `::1`、规范 URL `http://[::1]:<实际端口>/`；手拼 hostname/port 得到无法解析的 `http://::1:<端口>`。已使用实际监听与请求核对，不据字符串外观猜测。
2. 官方 ACP 客户端连接自有 CLI `--hostname ::1 --port 40182`：初始化成功，真实 newSession 返回 `RequestError`、码 -32603，details 明确指出构造 `http://::1:40182/session?...` 的 Request 失败。正常 EOF 后退出 0。故不是监听、认证或初始化能力声明失败，实际失败在会话 HTTP 请求边界。
3. 自有 serve `40188` 的机器启动回执已经发表 listening、真实 pid 和同一个错误 URL；按回执发出的 health 请求实际报 Invalid URL。用已知正确 IPv6 监听地址读取为 200，公开 BLOB 上传、Chat 和本机精确 local 流式输入均成功。基线网页仅证明手动诊断地址可用，不代表已发表地址或 ACP 可用。
4. 直接根因为 ACP 和 serve 各自用模板重造地址，丢失 IPv6 authority（主机权威部分）的括号。serve 同一错误字符串进入 `OPENCORVUS_SERVER_URL`、启动回执、控制台入口和重启 ready 通知；下游 SDK/Channel 消费者可因此得到错误地址。原服务 runtime-url 已保存正确原生 URL，旧路径却没有消费这一事实。默认 IPv4 路径的检查未暴露此差异。
5. 横向审计重启发现父进程在 `restart-handoff.ts` 也独立按 hostname/port 拼预期 ready URL。只改 child 的发布会让 IPv6 新值与父端旧预期冲突；必须同步使用真实原监听器的 canonical origin（规范来源）作为本次握手的预期事实，仍严格核 request/完整物理 successor identity（继任进程身份）和准确 URL，不放宽到任意可解析地址。实际 bind hostname/port 继续表达物理绑定，origin 是该已绑定监听器的派生事实，不是新增配置。
6. 受影响生产入口为普通/托管 serve、ACP、机器启动/SDK 和 Channel 内部地址消费、原生重启成功及故障恢复分支；`beginRestartHandoff` 生产调用只有 serve，另两项调用在真实检查器中。Server 准备阶段、Task/Mission/Session 启动后恢复、串并行和多项目隔离仍走当前共享执行/终态合同。未观察到队列/所有权/恢复异常；地址失真不能通过放宽恢复门槛、跳过任务恢复、改 pid 或假 ready 掩盖。
7. 其他搜索结果：SDK/overlay/defaults 的地址来自当前固定 IPv4 声明，OAuth 回调来自各自固定主机，browser-preview 有其独立 URL 解析合同，不改它们；Channel 适配器另有 webhook 诊断日志的拼接，未证实这些固定监听配置导致功能故障，不把本批扩成外部平台验收或日志清理。当前核心服务地址是可验证修复边界。
8. 公共回执/重启 wire schema（传输结构）和持久格式保持，继续 protocol 1 和真实物理所有权转移，不改数据库或已交付迁移。内部握手函数新增本次监听器规范 origin 参数，并同步全部三个调用；没有并行默认来源。旧的 stdout（标准输出）从来不是 ready 权威，不能通过解析控制台补齐地址。
9. 风险：origin 去掉尾斜杠但保留默认端口语义；重启期间不能读取无关全局监听器或 probe（探测监听器）的地址，必须在调用时从实际原监听器捕获。不能用“仅比较端口”代替准确目标 URL，不可削弱 request/进程出生标识/occurrence（执行轮次）证据。中断和故障恢复保留原真实父进程，不主动操作用户进程。

## 实施方案与验收

1. ACP 和 serve 直接读取其实际 server.url.origin，删除动态手工拼接。重启握手使用调用者从真实原监听器取得的 origin，严格比较 ready；检查器原两项调用同样读取各自实际监听器，原协议证据保持。
2. 聚焦正向验证绑定来源、真实 IPv6 ACP 会话/流式输入/历史及派生、启动回执可访问和准确 PID、原件 URI 与下载；正式源代码重启检查器继续验证其 13 项 IPv4/托管/并行/转移/故障恢复/物理终态合同。不跑无目标全量测试、不使用 UI 自动化。
3. 候选 ACP `40184` 与 serve `40190` 采用独立 profile，启动前核本机模型投影，实际请求精确 local/stream。对本人服务执行真实 `/restart`，核新进程身份、准确 URL、health 和持久会话，随后正常关闭；不动用户服务。本人在 `/ui/` 展开原件、截图人工复核及实际下载。
4. 记录所有实际失败和未验证范围，文档/类型及相关检查后范围提交；保留 177 项用户状态，fetch/merge 上游、审查完整待推集合、普通 push，自动下一批。无 Release/tag/版本发布或新分支。
