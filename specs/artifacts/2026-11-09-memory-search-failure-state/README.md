# 记忆搜索失败状态证据

对应[Recall与根因调查](../../records/2026-11/2026-11-09-memory-search-failure-state.md)。全部为本人在隔离项目真实桌面 `/ui` 交互与截图复核。没有自动化页面断言或模型调用。

- [01](01-before-earlier-successful-search.jpg)–[04](04-before-zh-list-raw-error.jpg)：旧版先命中第一份原文，真实离线提交新查询弹错；关闭后新查询仍显示可操作的旧结果；中文列表错误只显示原诊断。
- [05](05-after-earlier-successful-search.jpg)–[09](09-after-zh-current-list-failure.jpg)：同样操作，新查询失败显示行内摘要、保留输入，详情保留原网络诊断；可切换中文，清除后对应列表加载摘要。
- [10](10-after-service-recovered-query-retained.jpg)–[12](12-after-clear-restored-original-list.jpg)：同页同服务地址重新上线，保留输入；手动重试返回第二份完整原文，清除恢复两条原始记录。

[旧版接口记录](before-tcp-schema-check.json)与[修复后接口记录](after-tcp-schema-check.json)各5项实际HTTP 200，按服务 `/doc` 校验请求所得响应。两个阶段、一次恢复均有启动收据。[数据复核](owned-final-check.json)记录独立Git文件/HEAD、原笔记身份和正文、数据库计数及配置清单。工具文件供复查服务契约，不驱动浏览器。
