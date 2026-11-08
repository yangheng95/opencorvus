# 记忆搜索模式证据

对应[Recall、根因与完整本批验收](../../records/2026-11/2026-11-09-memory-search-result-state.md)。本人独立，无子agent、UI自动化、凭据或模型。

- 01–03：独立真实前态。01原普通列表；02首次真实搜索错误沿用普通mode；03清除后普通两条反而出现英文(search)/绿色metadata，中文界面仍英文。
- 04–06：修复后普通列表→真实唯一搜索，正确Search result/绿色；06中文搜索结果/相关度，原查询、展开、原文保持。
- 07–09：清除恢复原两普通条目/灰色metadata；重新搜索正确中文结果，再切英文保持当前结果与查询。

全部九图本人呈现查看，07为普通列表模式主要证据；不是DOM文字/分数/构建代替视觉。原CSS生成产品文字已删除，由真实组件文本与现两语言键提供名称。

before/after-tcp-schema-check.json保存各三项实际HTTP200/current/doc schema与原ID/标题/内容/唯一正FTS得分。before/after-memory.json为真实Memory.writeFile/SQLite FTS领域回执，没有模型参与。seed.json与owned-final-check.json记录两Git项目原文件/HEAD、四个原记忆身份/归属/内容/创建时间、原生产元数据未跟踪状态、DB Session0/Message0及两profile空配置。可变host项目文档时间不设伪常量比较。

initialize-memory.ts、check-memory-tcp.mjs、audit-owned-data.py只访问明确隔离领域/HTTP/只读DB，不控制UI。两个startup receipt为自有39002/39003，均正常shutdown200/原exec exit0，自有页88/89关闭。typecheck/i18n2932/Node build51.60s/renderer/docs/架构通过，main-XG8JNngj.js。Sol/Provider/权限和Task/Mission/Session执行恢复仍未验。
