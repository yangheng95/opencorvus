# 目录监视与资源管理器搜索证据

真实开发服务和目录监视器运行于两个隔离的 Windows Git 项目上。该搜索在实际保持折叠的子目录中命中文件。

- [原始搜索](baseline-search-before-import.png)和[原生新增后的旧搜索](baseline-stale-after-poll.png)展示同一个已接受查询。
- [手动刷新立即返回两项](baseline-manual-refresh-finds-both.png)展示原产品可正确读到磁盘结果。
- [原生及工作记录事件](baseline-watched-membership.jsonl)、[实际浏览器读取](baseline-explorer-requests.jsonl)和[独立公开搜索](baseline-current-index-search.json)核对外部文件新增、两次后台根读取和原查询的恢复。
