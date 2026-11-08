# 记忆分块项目归属证据

对应[Recall、调用审计、根因、实现与资格](../../records/2026-11/2026-11-09-memory-chunk-project-ownership.md)。本人独立，未使用UI自动化、子agent、凭据或模型。

- 01–03：原领域writer接受错pair后，真实Caller列表为自己的note；实际搜索却投影Owner标题/探针正文，展开按Caller读取返回明确404。错误不是UI切错项目。
- 04–05：修复后真实Caller合法分块搜索/详情一致；Owner原始内容保留。五张原始截图本人呈现查看，04为主要合法集成图。

before/after-domain-probe.json含真实领域结果、NotFoundError、SQLite父子关系和实际FTS。唯一生产上层writeFile本来传正确pair，底层writer无公开HTTP入口，不能宣称外部可利用漏洞或模型端到端。before故意复现的一条不一致诊断数据保留；未知用户历史数据未查或改写。

before/after-tcp-schema-check.json各五项真实响应（200/200/200/200/404），current/doc schema与明确原身份/内容/错误合同通过。chunk-contracts-before.log为真实5项3pass/2fail，错误为接受外pair/SQL外键；after为5+3项8pass/23断言。全部是实际SQLite服务合同，不是UI自动化。helper-parse-failed.log保留初版helper漏括号导致的纯解析失败，已修复并重跑原验收，不是产品缺陷证据。

seed/owned-final-check记录四Git原文件/HEAD、四原Memory身份/归属/创建时间、原合法Owner内容与明确合法Caller替换、before复现错父关系及after精确合法关系、DB Session0/Message0与空配置。可变host项目文档时间不作常量门槛。正常运行未跟踪元数据如实记录。

两个startup receipt为自己39004/39005，领域进程退出后独立服务完成持久复读；原服务均正常shutdown200/原exec exit0，页90/91关闭。backend类型/聚焦测试通过，前端未改，沿用main-XG8JNngj.js。helper只操作明确隔离领域/HTTP/只读DB，不控制UI。Sol/Provider/权限与引擎Task/Mission/Session执行恢复仍未验。
