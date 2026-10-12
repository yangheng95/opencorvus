# Parallel Search MCP：Issue 40 验收

[方案与Recall](../../records/2026-10/2026-10-12-parallel-search-issue-40.md)。2026-10-12，仅本侧对话单agent执行。

## 已完成

中英文指南新增可选`parallel`配置：remote、streamable-http、https://search.parallel.ai/mcp、oauth=false、enabled=true。说明合并配置、匿名Fast搜索、免费档较低限流及连接后实际验证搜索/抓取。默认配置与运行时代码没有改动。

最终checker从两份指南直接解析JSONC（JSON with Comments，带注释的JSON），验证结构相同，把原始配置写到全新临时项目的规范配置文件，再经生产Config.get加载。真实MCP capability discovery返回web_search、web_fetch；同一ScopedConnectionOwner持有连接，exactScopedCatalogTool实例化工具，通过正式PermissionAuthority执行与保存结果。未调用模型，未复制或读取用户凭据，未生成模型消息。

[verification.json](verification.json)记录实际项目/Session、调用身份与结果：搜索10条结果，随后抓取其返回的MDN相对URL解析页面，返回3738字符摘录；对应两条execution_succeeded权限事实可回溯到请求。临时runtime的auth.json/models.json/mcp-auth.json均未生成。连接owner已close，Instance已dispose，数据库effect队列已结算，checker实际退出0。

真实输入、输出、工具schema、权限历史、checker和日志以gzip完整保存在[raw](raw/)；[archives.json](archives.json)列出对应关系，按解压后完整字节校验归档，不以可变源码哈希作验收。

## 失败与修正

首次checker以无owner的新连接调用callScopedTool，没有已发现的inventory而被拒绝；随后改走实际catalog工具，但缺少权限执行上下文，同样在本地被拒绝。checker补齐真实隔离Session、权限调用和连接owner后重跑。首次owner又缺connectionIdentity，补齐后通过。未修改产品边界或绕过检查。

服务曾明确返回免费档限流。等待后同一个匿名连接中的搜索/抓取通过；文档增加等待后重试、避免反复重连的说明，不承诺固定额度。各失败JSON保留。一次临时脚本括号错误在运行前被解析器拒绝，修正后重跑。

## 文档页面

独立18440文档服务：首次Node预览的页面因网站现有bun:依赖报错；关闭本次PID38292后改用package要求的Bun运行时。Astro在agent环境默认后台运行，Bun后台启动超时，随后按其现有ASTRO_DEV_BACKGROUND标记以前台方式启动成功。没有修改预览工具或项目配置。

最终英文、中文页面均HTTP200，人工查看配置代码、段落和章节顺序；最终截图为[english-final.png](english-final.png)和[chinese-final.png](chinese-final.png)。其他截图记录此前阅读位置与调整前顺序，不作为最终画面。浏览器页面已关闭；本次前台服务以Ctrl+C结束，原句柄50283实际返回1（人为中止），不是构建失败，也不伪称exit0。

根docs:check通过345 ops/25 groups。上述初次修复阶段没有UI自动化测试、网站部署或GitHub Issue关闭操作。主线程的clipboard-copy.ts与非本任务生成文件未纳入提交。

## 用户随后授权发布和回复

用户随后明确要求“发布新版，回复issue”。[发布记录](../../records/2026-10/2026-10-12-release-0.1.24.md)保留0.1.24官网失败、停止发布及0.1.25修复过程。源码89ec8c2ad的官网run38236988822成功部署后，通过独立浏览器页实际核对了英文、中文章节锚点、配置代码与限流说明：

- [官网英文指南](parallel-search-published-en.jpg)
- [官网中文指南](parallel-search-published-zh.jpg)
- [官网0.1.25日志](release-0.1.25-notes.jpg)

三个截图均为生产网站实际页面，非自动断言或截图基线；本次独立浏览器页已关闭。GitHub v0.1.25于11:07:15 UTC公开，29项产物；[Issue回复](https://github.com/yangheng95/opencorvus/issues/40#issuecomment-6123047685)于11:08:07 UTC发送并通过API读回完整正文，Issue仍为OPEN。回复只陈述已完成的文档、匿名搜索/抓取和公开版本事实。

发布回执：

- [公开产物、根日志一致性、更新通道与下载清单验收](release-public-readback.json)，checker实际退出0；[官网原始下载JSON](website-public-downloads.json)保留18个用户下载入口。
- [原生联合run](native-release-run.json)与[全部job结论](native-release-jobs.json)：原生矩阵通过，最终联合结论为cancelled。
- [原联动官网run](linked-website-run.json)及[Windows取消日志摘录](linked-website-windows-cancelled.txt)：40分钟父预算耗尽，不能记为联合发布成功。
- [后续独立官网run](website-followup-run.json)：11:16:04至11:22:40 UTC，完整验证和生产切换成功。
- [Issue状态与评论原始回读](issue-reply.json)：已回复，保留OPEN。

公开交付已到位，原40分钟联合成功指标仍未满足。官网补部署没有改变原生源码tag、原始run或其时钟，也没有覆盖失败记录。

## 完整公开更新日志修订

用户指出更新日志遗漏大量实质改动后，按最后公开版0.1.23至0.1.25核对代码与验收记录，补齐Sources、会话、Mission、编辑、设置、模型、恢复和工具等产品分组。根日志修订来源为2219db818；[专项Recall与结果](../../records/2026-10/2026-10-12-release-notes-completeness-0.1.25.md)说明遗漏原因、证据与边界。

- [GitHub正文修订回执](release-notes-correction.json)：4379字符正文与根日志渲染结果完全一致，保留原发布时间和29项资产。此前release-public-readback.json是原发布时的记录，不改写为修订后的历史。
- [官网修订部署回执](release-notes-website-run.json)：同一文案提交，首次GitHub状态请求15秒超时后，同一个run重跑失败job并成功；不涉及重发安装包。
- [版本和完整升级基线](complete-notes-top.jpg)、[编辑/设置/模型具体修复](complete-notes-settings.jpg)、[用户影响与已知限制](complete-notes-impact.jpg)：生产中文详情页的真实截图，均已人工查看。正文层次、列表换行、代码标识和限制说明可读；没有UI自动化测试或截图基线。

用户明确选择“先修正公开日志，安装包随下版更新”。GitHub和官网现已展示完整修订；现有0.1.25安装包离线日志仍为原文案，下个版本随包更新。没有覆盖资产、移动tag或声称旧二进制内容已变化。
