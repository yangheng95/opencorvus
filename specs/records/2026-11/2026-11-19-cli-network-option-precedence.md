# 网络监听参数以命令解析结果决定优先级

## Recall

- 用户要求本人独立持续迭代。每批先分析和落盘，再实施、真实桌面交互及截图复核、聚焦正向验证、范围提交、上游合并与普通推送。上一批 `ef89f0154`、`c0d7d5d5e` 已推送，原有 177 项工作区状态保持。
- 已读 `cli/network.ts`、完整命令及桌面服务入口、`serve`/`acp` 调用、SDK（Software Development Kit，软件开发工具包）启动器、桌面原生启动参数、全局 Server 配置结构、监听器端口策略、mDNS（multicast Domain Name System，组播域名系统）默认值和 05-config/current server-runtime-readiness。全仓搜索 `resolveNetworkOptions`、`withNetworkOptions`、显式 hostname/port 拼写及同名默认值，查清三种生产命令入口与唯一解析函数。未检索到同合同的聚焦网络参数测试。
- 本机固定 yargs 18.1.0 解析实测确认等号与分隔值等价，`--no-mdns` 与 `--mdns=false` 解析为 false，`--port=0` 保持 0，`--` 后的标记留在位置参数。`defaultDescription` 在没有向解析器注入值时仍正确显示帮助默认值。参考 [yargs 选项文档](https://github.com/yargs/yargs/blob/main/docs/api.md#optionskey-opt)。
- 指标是实际 CLI（Command Line Interface，命令行界面）显式值优先于全局配置和共享默认值。等号、分隔、明确关闭和零端口均保留真实值。`serve` 实际按候选参数发布规范来源并承载 `/ui/`，人工复核真实会话和原件。无界面自动化。实际本机模型 `acp-review/local` 仅用于真实传输检查，未使用外部凭据。

## 基线与影响

1. 自有隔离配置指定 `127.0.0.1:40192`，真实 `serve --hostname=::1 --port=40194 --mdns=false` 仍回执 `http://127.0.0.1:40192`，该地址 health 200，真实会话和流式回复位于配置端口。桌面打开回执页面，展开真实原件并保存地址栏可见的基线图。两个地址均为回环。基线没有实际写到其他项目或启动外部监听。
2. yargs 正确解析，但 `resolveNetworkOptions` 再以 `process.argv.includes("--...")` 猜测存在性。等号写法、布尔否定没有精确 token，已解析值被全局值覆盖。`--` 后的位置内容还有反向误判风险。旧路径以常见的分隔值通过，原生桌面确实使用分隔写法。SDK 启动器使用等号写法，因此共享根因影响它的指定地址和端口。
3. 生产消费是普通 `serve`、桌面后端的默认 `serve` 及 ACP（Agent Client Protocol，代理客户端协议）。重启继任者仍由原真实绑定的 hostname/port 权威覆盖配置解析结果。服务启动、连接和发布站点的地址会受影响，执行队列、恢复持久化及 Task/Mission/Session occurrence（执行轮次）的处理机制没有变化。未观察到调度或终态异常。
4. 配置契约继续由 `Config.global().server` 拥有文件值。显式已解析值优先，未声明时读全局配置，再取共享默认。主机的 mDNS 既有语义是只有开启 mDNS 且无显式或配置主机时默认 `0.0.0.0`。安全的关闭语义必须保留 false，不能使用 `||` 合并。端口 0 继续交给 `Server.listen` 采取既有选端口策略。跨来源 CORS（Cross-Origin Resource Sharing，跨来源资源共享）名单仍按配置在前、命令在后累加。
5. 涉及 `withNetworkOptions` 的帮助和 `NetworkOptions` 类型，需保留帮助默认说明。主机、端口采用现有 `server-defaults.json` 导出值。mDNS 域名由同一个后端默认值服务 CLI 和出版器，避免为帮助和运行另留两处字符串。配置结构、公开接口和数据迁移不适用。风险是遗漏禁用布尔和默认发现行为，须专门以正向完整输出验证。

## 实施和验收

1. 让解析器只提供实际声明的值，移除四处原始参数 token 扫描。在共享 resolver 用空值合并表达明确优先级。默认描述复用实际常量。保留有效类型、重启覆盖以及附加 CORS 顺序。
2. 用实际 yargs 和隔离全局配置验证等号、分隔值、`--no-mdns`、显式端口 0、只用配置、默认主机和 mDNS 默认主机，核完整有效监听值和 CORS 次序。无需要执行的外部广播场景。
3. 新候选的配置地址为 `127.0.0.1:40196`，明确参数为 `[::1]:40200`。回执及实际 health 必须从后者获得，公开读取、上传、创建与本机流式结算成立。使用真实 Windows Chrome 打开该回执 `/ui/`，展开附件、实际下载并核字节。停止本人服务后核持久结算、工作区状态及必要检查，精确提交和推送后继续下批。
