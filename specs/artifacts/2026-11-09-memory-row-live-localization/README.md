# 记忆条目语言更新证据

对应[Recall、根因、当前结果与后续线索](../../records/2026-11/2026-11-09-memory-row-live-localization.md)。本人独立，未使用子agent、UI自动化、凭据或模型。

- 01–02：真实前态。英文原列表切中文，详情日期已2026/11/9，列表仍11/9/2026。
- 03–04：真实FTS搜索唯一原条目，中文界面仍Score0.25。
- 05–07：修复后列表与同条详情随语言更新，原文与展开保留。06为菜单淡出过渡，07才是稳定视觉资格。
- 08–10：真实搜索英文Score→中文相关度→英文Score，原查询/展开/内容保持。09是主要交付图。
- 11：Escape恢复原两列表，但保留了新发现的普通列表(search)错误标记。该mode/style线索未在本批修复，不能宣称完整列表模式正确。

before/after-tcp-schema-check.json保留实际list/get/search各HTTP200及current/doc schema结果、原请求ID/文件ID/标题/内容/正FTS得分。UI验收来自上述实际交互与本人截图，不以这些HTTP或DOM替代。

seed.json、before/after-memory.json与owned-final-check.json保留原Git文件/HEAD、真实领域Memory写入/FTS、四份原记忆身份/归属/内容/不可变创建时间、DB Session0/Message0与两profile空配置。正常host Project MEMORY.MD可变时间不作常量门槛；运行时未跟踪项目元数据如实记录。

两个startup receipt属于隔离39000/39001，原进程均正常shutdown200/原session exit0，自有页86/87关闭。typecheck/i18n2931/Node build51.65s/renderer/docs/架构通过，main-DYPmdYoB.js。helper仅访问明确自有领域/HTTP，不控制UI。Sol、Provider与Task/Mission/Session实际执行恢复未验。
