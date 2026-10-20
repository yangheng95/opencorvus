# 网络依赖与开发编辑器安全修复

## Recall

用户要求单agent持续自主体验、修复、验证、提交推送；不使用子agent。487原真实成员网页来源流已验证并推送7ff35bccd，fresh fetch后HEAD=origin/main；21图、六个Sol流、两个原服务完整结算及凭据对退休。原客户端超时准确保留为exit1，不等于服务端挂起。Goal长期active；仍有完整配置性能缺口。当前只原.bun/与packages/opencorvus/bun/未跟踪。

本批来自正常push所报依赖线索及实际`bun audit --json`：SDK（Software Development Kit，软件开发工具包）1.31.0的任务会话归属/跨origin重定向，follow-redirects1.16.0敏感头，Hono4.13.7路径二次解码；实际锁中Vite6.4.3、两个8.2.1也落入Windows launch-editor漏洞范围。不能以GitHub告警数量或审计遗漏某版本断言利用已发生；没有凭据外泄证据。

## 修改前根因、影响面与资料

生产MCP（Model Context Protocol，模型上下文协议）createRemoteTransport经SDK SSE（Server-Sent Events，服务器发送事件）/StreamableHTTP，materializeRemoteRequest把实际配置头/静态凭据放入requestInit，SDK旧版允许重定向，因此存在真实敏感请求跨origin的入口。OAuth（Open Authorization，开放授权）也由SDK参与。全仓生产没有taskStore/InMemoryTaskStore，当前不暴露该实验性服务端任务漏洞；Browser/Computer真实McpServer工具仍需验证SDK兼容。唯一权限wrapper/宿主scope不能替代HTTP客户端处理。

Hono用于全部公开HTTP（Hypertext Transfer Protocol，超文本传输协议）服务；当前静态资源由OverlayUI冻结目录reader处理，全仓生产未使用serveStatic，因此本次Hono公告条件未在该路径成立；仍升级同主版本补丁。follow-redirects是axios1.20.0传递依赖，需要从中央override/锁统一修复，不能添加临时fetch包装或并行HTTP实现。Vite仅开发/构建，正式`/ui`是冻结资源，不把开发编辑器漏洞说成已发布页面漏洞；Windows项目真实使用开发工具，修其当前6系及Astro依赖8系，不跨大版本统一。

已读当前security-permission/server-runtime/07-panel合同、MCP transport定义及凭据物化、overlay-ui、root/overlay/opencorvus package声明与锁、现有隔离测试runner。全仓精确版本搜索：SDK root override与两个package共三处1.31.0，Hono root catalog/override同为4.13.7；Vite只有root未被消费的catalog7.1.4与overlay实际^6，锁的Astro两个8.2.1来自其依赖范围。保持现有版本声明方式，不因本次扩大清理无关catalog。旧路径未修原因是此前锁/override尚停留在补丁前，不是应用默认权限可以修复。

官方资料：[SDK重定向公告](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-6prh-2h8m-c8cw)、[任务归属公告](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-22jm-h49p-29qw)、[Hono4.13.11](https://github.com/honojs/hono/releases/tag/v4.13.11)、[follow-redirects1.16.1](https://github.com/follow-redirects/follow-redirects/releases/tag/v1.16.1)、[编辑器公告](https://github.com/vitejs/launch-editor/security/advisories/GHSA-698v-4r3x-3vcv)。Bun官方update文档确认指定包可更新其锁中传递出现、保留其他包；实际使用前先dry-run，最终须由锁定1.4.0 frozen install/type/build兼容验证。风险是SDK重定向失败错误形态和多版本Vite锁重解析；数据schema/迁移/Goal调度不改，模型调用零，无凭据复制，不操作用户18571/进程/窗口。

## 实施前方案与验收

1. 保存原三个manifest与锁及原审计；SDK统一1.32.0、Hono统一4.13.11、follow-redirects中央override1.16.1。Vite实际overlay升当前6系补丁6.4.4，原catalog7系若仍不被消费不扩大修改；按原Astro范围选择8系修复版本。只执行指定依赖更新，审查完整锁差异；不运行安装lifecycle脚本，不隐式升级Bun/项目版本。
2. 聚焦非UI正向合同：使用真实本地HTTP和生产createRemoteTransport，验证正常JSON-RPC（JavaScript Object Notation Remote Procedure Call，JSON远程调用）初始化与重定向的明确错误/状态；现有静态资源真实字节/HTTP reader、MCP原凭据/issuer合同、相关类型与OpenAPI检查。必要时补正向合同测试，不用“没有发送/没有调用”作核心断言。用官方隔离runner，不运行UI自动化或全量bun test；本地HTTP来源不使用真实凭据。
3. 正式UI构建后一个独立488服务18861，用完整已关闭482原库/配置副本、Bun1.4.0、413 owned-host/446监管20分钟，保持全部原事实；无Provider预检/模型输入/新Goal或成员。实际内置浏览器检查Home Goal说明/创建草稿、既有Sources与页面加载，截图人工复核。此为兼容冒烟，不声称修复新UI或全链路MCP远端服务。
4. 公开shutdown一次、原handle/native物理/output/request/launcher结算、关闭自有页；核对原数据/源metadata/schema，归档完整实际检查与限制，更新三索引/docs/architecture。只范围提交，fresh fetch/merge、完整pending审查、正常hooks推送再fresh fetch。若出现真实队列/唤醒/恢复异常立即横审所有Task/Mission/Session occurrence与入口、终态/重试/重启/串并行多项目；不能归为单个工具。长期Goal继续。

## 首轮结果与工具链纠正（继续前）

实际SDK1.32.0/Hono4.13.11/follow-redirects1.16.1/overlayVite6.4.4，Astro原^8范围选择8.3.4及其实际所需Rolldown/OXC依赖；未修改未消费的catalog7.1.4。Bun1.4.0 frozen install通过，审计{}；原隔离runner14个正向合同通过（MCP同origin初始化/两个跨origin307错误共3，原静态HTTP完整字节/错误合同11），八包typecheck与正式UI build通过。没有使用真实凭据或模型。

官网第一次原7149 exit1：我把Astro输出指定到根目录.tmp-product-iteration，其生成SSR（Server-Side Rendering，服务端渲染）代码解析到根node_modules/solid-js，缺少该位置seroval。原packages/web/node_modules/solid-js实际属于其虚拟1.9.13安装且有自己依赖，root残留1.9.14是另一个物理目录；此自定义输出路径可能改变外部依赖解析，须标准目录复验，不能先宣称Vite产品回归或已完成。

我误先启动了额外Bun1.4.0强制重装。原51194/进程64280/出生2026-10-20T20:49:30.593678Z持续约5分钟，20:54:22Z采样CPU294%、IODataOperations/IORead/IOWrite每秒均0，日志仍只到resolve13。这是该自有工具命令的异常，非产品调度或18861服务异常；不重复启动强制重装。下一步精确核对PID/出生时间/原命令行后取消这个额外installer，join原51194，保留退出及失败日志；用正常冻结安装恢复依赖状态，再在packages/web标准dist重跑原Astro构建。原5756/18861服务不重启，仍20分钟资源边界；8个原assistant已完成、原protocol仅agent.lifecycle、恢复attempted0。根因结论待实际标准构建，不能把错误路径当未验证的依赖修复。

## 最终实际结论

原51194精确取消后join-1。正常冻结安装首次EBUSY的watcher.node实际由自有原89792加载，未操作用户进程。原5756服务在11图验收完成后按原一次public shutdown200退出0，native物理/output/request/launcher全部完成、自有60关闭；接着正常冻结安装通过，锁定Bun1.4.0 frozen-final也通过，并以原官方隔离runner重跑全部14项HTTP合同通过。settle私有命令初次多传不存在的Scope参数，未改变任何进程或事实；按实际参数重跑后原结算通过。

原24993标准Astro构建exit0、263HTML/23.25秒；同一真实模块解析对照证明根scratch/server仍解析到root残留Solid1.9.14且seroval缺失，而标准web/dist/server解析到其原虚拟Solid1.9.13/seroval1.6.3，根残留未改。此前“安装缺包导致官网回归”的判断更正为自定义输出位置造成依赖scope错误；没有新增平行依赖、删除原文件或以放宽检查绕行。正式UI60676 exit0，类型75172八包通过，原routes11569六规则/35文件通过，最终审计{}。更新current security-permission公开transport默认同origin及SDK允许的同主机标准端口HTTP→HTTPS合同；不开放follow旁路。

实际11图包括中英文Home/Goal说明、英文表单、中文草稿真实预填及取消保留、原会话首次加载/输入区及最终两条真实Source聚焦。07加载和08输入URL不能算Source通过，09才是真实来源截图。本批无新模型流资格或UI源码补丁，不能宣称修复全部Rendering瞬时状态。原87行/全部字段/时间/源size/mtime保持，副本仅1新增Project，schema3和canonical{}不变，没有有效Goal或新消息。

25个实际锁包条目只包含SDK/Hono/follow-redirects/Vite及后者的Rolldown/OXC/picomatch；原未消费的Vite7 catalog不变。完整差异、原失败、恢复与11图归档[本批证据](../../artifacts/2026-10-21-dependency-redirect-hardening/README.md)，三索引同步。不升应用版本、不发布。真实第三方MCP/OAuth凭据交换、实验性服务端任务资格未测；完整配置性能原目标仍未达，单agent长期Goal active。
