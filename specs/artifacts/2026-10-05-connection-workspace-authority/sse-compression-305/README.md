# 305 压缩事件流与运行时修复

## Recall

承接 [304 完整字段](../field-value-304/README.md)，实施前分析见 [305 方案](../sse-compression-plan-305.md)。用户要求持续自主改善 Sources、Rendering、UI/UX（用户界面与体验）和功能，最新人工要求单 agent；本轮无开发委托。起始85bcc029e已推送且工作区干净。

## 最终改动

共享 `server/sse.ts` 通过标准 HTTP（Hypertext Transfer Protocol，超文本传输协议）Accept-Encoding 协商 gzip/identity，每连接独立压缩器、每原始 SSE（Server-Sent Events，服务器发送事件）帧立即 flush。所有8个路由文件的9处流入口使用同一边界。事件内容、顺序、游标、完整value及原始delta不改写，取消沿 Web stream 传回原 Hono owner。无额外刷新计时器、合成事件、隐藏消息或旧协议后备。

原 Bun1.3.14 的 fetch 压缩正文缓冲已在独立 node:http 探针复现：gzip/deflate/br均等到1200ms服务端关闭才提供第一帧；Node25.7约20ms、官方隔离 Bun1.4.0约14ms即时提供。根packageManager升级到1.4.0，CI沿现有根版本配置获取对应编译运行时；全局Bun和用户进程未替换或重启。类型包采用上游修复的 @types/bun1.4.2：1.4.0的memoryPressure重载遮蔽Node<=24的off/removeListener，上游1.4.2恢复通用重载，因此全部临时MCP方法修改已还原。共享ProxyFetchInit接纳Bun1.4支持的标准URL代理值，既有配置覆盖规则不变。

资料依据：[Node流式flush](https://nodejs.org/api/zlib.html#flushing)、[Hono压缩](https://hono.dev/docs/middleware/builtin/compress)、[HTTP编码协商](https://www.rfc-editor.org/rfc/rfc9110.html#section-12.5.3)、[官方Bun1.4发布](https://github.com/oven-sh/bun/releases/tag/bun-v1.4.0)、[Bun类型1.4.2声明](https://unpkg.com/bun-types@1.4.2/overrides.d.ts)。Hono现有压缩中间件明确跳过Transfer-Encoding，因此不能直接套用；本轮复用其Accepts解析和标准流适配。

## 验收证据

[检查记录](verification-results.json) 保留所有初始失败、实际重跑及原进程join。61项聚焦后端检查通过：SSE压缩17、原Provider流式前缀6、Session连接11、Task replay8、Inspect2、代理字段1、Browser MCP Node进程5、授权生命周期5、Provider重试6。包括真实HTTP首帧、完整gzip尾部、多字节正文、每连接内容隔离、消费取消/重连和真实公共Session两项目快照。它们不进行UI组件、DOM、浏览器或截图自动化。

根类型检查8个包通过，Bun1.4下正常Overlay build通过（48.88s），输出同一main-1LYwgkry.js。实际Windows原生CLI使用生产entrypoint/defines/external模块构建到私有目录，产物124,732,416字节；首次只编译未附运行模块，--version明确报缺少package.json，按生产runtime模块/manifest staging补齐后真实 --version 输出0.1.23。本轮没有构建安装器或发布矩阵，也没有创建Release或版本tag。

真实Task `tsk_g00VXl5hD700hVMdFR1S`，Project `prj_hFND5NLAruqz7d195aO4`，Bun1.4.0 Native11300/Host32404，端口18268。凭据与完整模型目录分别预检，12次实际gpt-6.1-sol请求均流式、HTTP200、源读取结束；Task自然Completed，页面显示4m9s。

[原始公共流观测](live-compression-observation.json) 使用node:http读取原始压缩字节，并通过同连接gunzip检查事件，避免把fetch自动解压后的长度当成网络压缩量：6005个已接收Task事件、5246个文字字段更新；压缩字节2,900,365，对应解压字节62,719,532，同次传输减少95.38%。观测在Task启动后附着，不能声称记录所有初始Task事件。最长正文Part `prt_g0VXl5tnl00l08HAhZm9` 的4952次字段更新连续，最终8446字符与[持久化正文](canonical-current-conversations.json)完全一致。前言末尾换行被原有text-end trimEnd删除，所以[原始精确比较](field-values-canonical-comparison.json)仍保留false；不修改观察记录以掩盖自然最终重写。

## 人工视觉复核

root在独立正常开发服务 `/ui` 标签66实际操作：生成期间打开完整子会话、上翻Sources、关闭/重新打开右侧栏、切换预检项目并返回，然后查看完成状态。截图已人工查看：

- [流式代码与正文](01-active-body.png)：Running1m49s时显示第七、八节，证明压缩正文没有等到任务完成才出现。
- [生成期间三条Sources](02-sources-running.png)：标题、域名和长标题换行；此帧真实hover tooltip遮挡首条上方区域，保留原画面。
- [完成后Sources](03-completed-sources.png)：Completed4m9s，三条来源和子会话内容保留，无tooltip遮挡。来源组件无本轮样式修改。

## 收敛与边界

原live exec16895实际exit0已join；公共流观察exec17246 exit0。Native/Host原始出生身份、物理和输出结束、端口关闭、复制的auth/models成对清除均由[独立回读](closure-readback.json)验证。诊断堆文件按真实出生时间归档到私有路径。当前runtime日志先按真实进程出生边界筛选和脱敏，再无损压缩，原件保留；实际凭据扫描为零。

压缩减少的是网络字节，不消除完整value的解压、JSON解析和字符串分配成本；没有宣称所有Rendering现象或全产品质量已经完成。当前仓库要求Bun1.4.0，旧的全局1.3.14仍在用户机器上；后续开发启动应遵循根packageManager/LOCAL_PACKAGING，现有用户进程未动。

一次相对目录命令在packages/opencorvus/specs下误建了空的sse-compression-305目录。自动审批两次拒绝其非递归清理（仅返回blocked by policy）；目录无文件、被忽略、未纳入提交。原有同层reader-helper-observation-126目录保留。全部正式方案、截图和记录均在根specs。
