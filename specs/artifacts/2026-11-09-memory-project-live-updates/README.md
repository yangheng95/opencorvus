# 记忆项目实时更新证据

对应[Recall、根因、实现与验收](../../records/2026-11/2026-11-09-memory-project-live-updates.md)。本人独立执行，无子agent、UI自动化、凭据或模型调用。

- 01–04：真实前态；公开PATCH及原生SSE已更新，同页仍旧名，重进后才Beta。
- 05–09：真实新实现；实时改名、原目录/选择/未提交查询、中英排序往返。07为新菜单保留选择的证据。
- 10–11：只关闭自己的服务，离线改未选项目Gamma，真实重连后显示新全集，Beta和草稿保留。11为主要交付图。
- 12：选Gamma的正常加载瞬间，不能作为稳定视觉资格；13为稳定当前目录文档及空Notes。
- 14：返回主界面仍Alpha，原main订阅同步显示Gamma/Beta/Alpha。

before/after-rename-sse-response.json保留真实HTTP请求标识/响应与原生WorkLedgerEvent，公开schema与原ID/目录/发布sequence合同通过。offline-project-update.json为服务停机时真实领域改名。live-tcp-schema-check.json为恢复后四项实际HTTP200及当前/doc schema验收。

owned-project-final-check.json/seed.json保留六项目原文件字节与初始Git HEAD核验、实际DB Session0/Message0、原生产元数据未跟踪状态及两profile空配置。可变timeUpdated不设伪常量门槛。stream-contracts.log为2项/15断言纯服务合同，不能替代实页或引擎端到端。

三个startup receipt标识自有启动；三进程均正常shutdown200/原session exit0，自有页均关闭。辅助typecheck/i18n/Node build/renderer/docs通过，main-LXDIZF0V.js。Sol/Provider/权限及Task/Mission/Session执行恢复不在本批已验范围。helper文件仅为明确隔离项目的后端领域/API观察，未操作UI或使用用户数据。
