# 空闲对话后台活动停止验收

对应[方案与根因](../../records/2026-10/2026-10-31-idle-background-stop.md)。本轮只用单agent，在自有38437/38438原生开发服务的/ui进行真实内置浏览器交互；没有操作用户18571服务/数据库。

## 已完成

- 空闲Chat/Work侧栏行菜单提供明确的停止后台活动入口；运行中停止及Task/Mission域规则保持原合同。
- 确认框默认取消，说明保留对话/消息并可发新消息继续；取消后焦点返回原行，实际owner及消息完全保持。
- 精确OwnedPromptControllersError转换保护显示本地化标题和侧栏操作指引，保留技术详情；中文菜单改为命名项目。
- 用户实际确认停止后，原两消息保持、后台owner释放、已发表idle事实保留；随后真实UI转换成功，Project/generation/Session、六文件及Git身份保持。
- 转换后在同一Session发新消息，正常回复PREFLIGHT_825_RESUME_OK，新Prompt代实际建立；再次从UI确认停止，四消息保持。

interaction-qualified.json记录真实身份、生命周期、浏览器来源的两次abort与三次conversion请求及结果合同；没有在UI交互前插入、伪造或隐藏消息。所有生产改动均为UI，无backend/schema/SDK结构变更。

## 证据与边界

两scope共六次gpt-6.1-sol请求，均streaming、HTTP200和EOF，累计1118；包含辅助请求，无额外模型调用。schema9/92表214198→214790→215866。旧十一项目28 tracked、75附件、十三原文件、另二十五文件和before新预检两消息/六文件保持；唯两个共享容量槽位按本次runtime事实复用并释放，其余旧业务各列保持。新会话继续后增加的两文件为现capability catalog occurrence快照及附件元数据，六原文件/Git均保持，未把它们误报为模型改码。

两服务public shutdown200、原exec/native/launcher0、物理/输出/请求和OS出生身份结清后退休配对auth+完整models副本；原认证元数据和目录字节/元数据保持。基线原deadline不改写；基线退休后用户中断/续行跨越原窗口，首次候选在独立固定窗口启动，故最初全批单墙钟窗口要求未达成，已在启动前改写计划并保留两份原始deadline。各服务各自至少五分钟结清余量。

普通最终前端build/renderer、typecheck（初轮TS2339修复后重跑）、双语2661键及docs通过。纯UI改动未新增、修改或运行UI自动化测试；全部二十截图实际呈现人工复核。原Task68/Mission80/Chat3/已完成Work8/报告Goal12及原Sources完整HTTP事实保持。Task与Mission仅阅读历史实页，未重新执行它们，也未冒充运行中停止覆盖；原生Tauri/多项目同时活动停止不属本轮实操。初次手工组合Task链接不符合当前导航合同，改用真实命令面板打开原Task成功。

## 截图

01—06为当前版预检、空闲缺失入口及typed保护藏在详情；04明确是请求中间帧。07—10为候选真实预检、英文入口/默认取消和明确转换指引；11—14为中文命名/引导/入口/确认；15—17为实际转换与同会话继续、再次停止保留历史；18—20是原Task/Mission及中文历史Source阅读回归。

- [01-before-real-preflight-ready.png](01-before-real-preflight-ready.png)
- [02-before-real-idle-reply.png](02-before-real-idle-reply.png)
- [03-before-idle-chat-menu.png](03-before-idle-chat-menu.png)
- [04-before-conversion-request-pending.png](04-before-conversion-request-pending.png)
- [05-before-generic-conversion-error.png](05-before-generic-conversion-error.png)
- [06-before-owner-guard-details.png](06-before-owner-guard-details.png)
- [07-after-real-preflight-ready.png](07-after-real-preflight-ready.png)
- [08-after-idle-stop-menu-en.png](08-after-idle-stop-menu-en.png)
- [09-after-stop-confirm-cancel-focused-en.png](09-after-stop-confirm-cancel-focused-en.png)
- [10-after-actionable-conversion-guidance-en.png](10-after-actionable-conversion-guidance-en.png)
- [11-after-named-project-menu-zh.png](11-after-named-project-menu-zh.png)
- [12-after-actionable-conversion-guidance-zh.png](12-after-actionable-conversion-guidance-zh.png)
- [13-after-idle-stop-menu-zh.png](13-after-idle-stop-menu-zh.png)
- [14-after-background-stop-confirm-zh.png](14-after-background-stop-confirm-zh.png)
- [15-after-project-converted.png](15-after-project-converted.png)
- [16-after-original-conversation-resumed.png](16-after-original-conversation-resumed.png)
- [17-after-resumed-work-stopped-history-kept.png](17-after-resumed-work-stopped-history-kept.png)
- [18-after-completed-task-review.png](18-after-completed-task-review.png)
- [19-after-mission-review.png](19-after-mission-review.png)
- [20-after-protected-source-still-readable.png](20-after-protected-source-still-readable.png)
