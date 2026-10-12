# Issue 40：可选 Parallel Search MCP 示例

## Recall

用户在独立侧对话明确要求修复 https://github.com/yangheng95/opencorvus/issues/40 。范围为中英文 MCP（Model Context Protocol，模型上下文协议）指南中的可选配置示例，并实际验证匿名工具发现、搜索和抓取搜索结果页。只由当前单agent执行，不继续主线程其他工作，不使用其凭据或进程。开始工作区干净，HEAD e9eeaa249。无需新分支、worktree、发布或GitHub留言。

## 分析与资料

已读根AGENTS.md、两份mcp-servers.mdx、config/mcp-schema.ts、MCP.createRemoteTransport及匿名连接路径、scoped capability/call接口、04-extensions架构MCP章节、Config加载路径及本地检查命令。全仓搜索search.parallel.ai/parallel.search，在当前文档与代码没有现有集成示例。Issue及Parallel官方 https://docs.parallel.ai/integrations/mcp/search-mcp 明确匿名/mcp端点、web_search/web_fetch、Fast默认模式和较低限流。

现象：两份指南仅有通用远程OAuth和本地文件服务示例。触发点是用户想接入匿名搜索时必须自行推导配置。根因是文档未覆盖已经可用的远程匿名组合；配置schema已支持type=remote、transport=streamable-http、oauth=false，现有连接路径可直接使用，无需另建传输或搜索实现。旧通用示例没有说明Parallel端点与免费档限制。影响仅两份指南；无数据库、公共接口、执行调度、消息、UI组件、版本或默认配置变更。外部服务的实际可用性在运行前未知，需真实检验，不能用文档自述代替。

## 实施与验收

在Examples/典型配置示例中增加对应段落，配置字段两种语言一致，强调合并到现有mcp配置、用户自行启用、无需账户/API密钥、匿名Fast模式及较低限流，引用官方文档；不承诺永久免费或固定额度。提供检查连接与实际调用两个工具的步骤。

验收在全新临时项目和独立HOME/OPENCORVUS_HOME中进行，解析指南实际JSON配置，通过生产Config loader与MCP discovery/call链验证实际工具名，再查询公开的Web标准资料并抓取其中真实返回的官方网页。不复制auth/models，不调用LLM，不触碰用户浏览器/MCP连接。记录真实输入、输出、时间、结束与清理结果。检查为真实后端集成，不是UI自动化。两份MDX通过文档检查与可用的构建/编译验证；本次只补正文，不改UI布局。

同步spec索引；仅提交本任务文件。按当前仓库要求在正常push前fetch/merge并检查全部待推送提交；主线程提交若仍待推送且本侧对话无法确认交付权限，则记录为独立阻塞，不代替主线程继续其工作。不得关闭Issue或发布版本。

## 验收补充

真实匿名发现及搜索已通过。初始私有checker未持有连接inventory及正式PermissionAuthority上下文，分别被现有边界拒绝；修正checker使用同一个ScopedConnectionOwner和exact catalog工具，经默认权限策略记录真实执行，再重跑。未修改产品权限/传输实现，未制造模型消息。曾遇到Parallel明确的免费档限流；等待后在同一连接中完成搜索10条结果和抓取其中MDN相对URL文档，返回有用正文。无账户、API密钥或本地auth/models复制。

为查看本次文档实际排版，使用独立18440端口的Astro文档页面；应用/ui不提供这些指南，故此处使用文档服务。只操作本侧对话创建的页面和该服务，人工截图检查中英文正文，不运行UI自动化测试。

## 最终结果

[实际证据](../../artifacts/2026-10-12-parallel-search-issue-40/README.md)：生产Config加载指南配置、匿名发现两工具、同连接搜索10条并抓取真实结果页3738字符；两项权限execution_succeeded事实和真实工具响应已保留，checker exit0。中英文实际文档页面人工复核、两张最终截图，根docs:check通过。仅扩展文档；没有模型调用、用户凭据、公开发布或Issue操作。预览工具初始运行时/后台模式问题与修复过程均保留。侧对话只提交本任务文件，主线程正在修改的复制组件保持原样。
