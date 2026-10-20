# 网络依赖补丁与真实页面兼容性

[实施前分析与结果](../../records/2026-10/2026-10-21-dependency-redirect-hardening.md)。488单agent；不新建成员/Goal，不复制凭据、发Provider预检或模型请求，不改schema/迁移/版本，不发布。

## 正式改动及验收

- [完整依赖差异](dependency-changes.json)：SDK1.31.0→1.32.0，Hono4.13.7→4.13.11，follow-redirects1.16.0→1.16.1，桌面Vite6.4.3→6.4.4，Astro两条Vite8.2.1→8.3.4及其Rolldown/OXC/picomatch，共25个实际锁条目；未跨大版本统一。root未消费的Vite7 catalog保持，不属于安装图。
- [原审计](audit-before.json)与[最终审计](audit-final.json)：最终{} / exit0。告警不是实际泄露证据，实验性SDK taskStore和Hono serveStatic在当前生产未采用；生产远程MCP确实经两个受影响SDK传输。
- [最终14项实际HTTP合同](contracts-final.log)：生产`MCP.createRemoteTransport`真实同origin307初始化保留POST正文/配置头、正常serverInfo；HTTP/SSE跨origin分别得到明确307和SDK same-origin错误，3项/7断言。原静态资源HTTP完整字节与明确错误合同11项/32断言。全部由锁定Bun1.4.0官方隔离runner执行，不是UI/DOM/组件或截图测试。
- [Bun1.4.0冻结安装](frozen-final.log)、[八包类型](typecheck.log)、[正式桌面构建](ui-build.log)、[官网标准构建](web-build-standard.log)、[OpenAPI路由](routes.log)：全部通过；官网263 HTML、23.25秒，桌面含renderer公共surface检查。没有制作/发布安装包或宣称`build:overlay`发布验收。
- [原服务完整结算](owned-scope.json)：原5756/18861，一次shutdown200、join0、精确native物理/output/request/launcher完成、自有60关闭，恢复attempted0，模型0。另有自有强制installer原51194取消exit-1，失败如实保留；没有关闭用户进程。
- [原数据](after-preserved.json)：完整原87行/字段/时间与源bytes/mtime保持，副本仅新1Project到5/4/14/33/28/2/2，schema3/integrity ok，canonical{}。未创建有效Goal/新消息，草稿只是页面未发送输入。

## 人工实页

11图均在实际开发`/ui`呈现并人工查看。没有UI自动化；完成态 Sources 不当新模型流，本批不宣称修复新的Rendering根因。

| 图 | 实际复核 |
| --- | --- |
| [01英文首页](01-home.png)、[02英文Goal说明](02-goal-guide.png)、[03创建表单](03-goal-form.png) | Goal入口、模型准备说明、预算/暂停含义与完整表单。 |
| [04设置](04-settings.png)、[05中文首页](05-home-zh.png)、[06中文说明](06-goal-guide-zh.png) | 实际通过外观设置切换中文，页面语言完整，用户/论文原文不改。04是General实页，并非Loading。 |
| [07原会话首次加载](07-original-conversation.png)、[08原输入位置](08-original-web-sources.png)、[09真实来源聚焦](09-focused-web-sources.png) | 07/08不算来源呈现通过；09两原工具来源标题/站点及第一来源焦点真实可见。用户输入URL与Source区别记录。 |
| [10草稿预填](10-goal-draft-zh.png)、[11取消后保留](11-home-draft-retained.png) | 首页未发送正文进入Goal目标字段，取消后原草稿保持，没有确认新Goal。 |

## 原失败及修复

[首轮官网构建](web-build.log)指定根scratch输出后exit1。其SSR外部依赖解析落在根残留Solid1.9.14，找不到seroval；[实际解析对照](website-resolution.json)证明标准web输出解析到其原虚拟Solid1.9.13及seroval1.6.3。标准原构建通过；根残留未修改，未用添加平行依赖掩盖错误输出路径。

额外[强制重装日志](reinstall.log)/[精确取消回执](installer-cancelled.json)保留：Bun1.4.0额外force进入高CPU/无I/O，取消后正常冻结安装曾返回[原EBUSY](install-recovered.log)。实际模块观察确认原自有服务89792加载同一watcher.node；按原UI验收结束后公开shutdown，随即[正常冻结安装恢复](install-after-settlement.log)，再以锁定1.4.0和原14项合同复验。没有终止用户18571，没有重启原业务请求/测试服务，没有把失败说成通过。

局限：未对真实第三方MCP/OAuth服务交换凭据，未复测实验性SDK服务端任务；这些不冒充端到端资格。完整配置保存10秒/恢复5秒问题仍未达，长期Goal继续。
