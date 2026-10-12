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

根docs:check通过345 ops/25 groups。本轮没有UI自动化测试，没有网站部署或GitHub Issue关闭操作。主线程的clipboard-copy.ts与非本任务生成文件未纳入提交。
