# 归档恢复实际体验证据

对应[方案与根因](../../records/2026-10/2026-10-28-archive-journey-and-alert-reconciliation.md)。

- [汇总](runtime-review.json)：真实页面、21项断言、数据和原进程结清。
- 原图01–05来自端口38254/main-D85kJ8wr.js，展示空页、归档、检索、恢复后无确认，以及后端已恢复而侧栏仍是旧快照。
- [英文成功反馈](06-restored-visible-en.jpg)与[同一反馈即时中文](07-restored-visible-zh.jpg)，来自修复后端口38255/main-B03SQ_Ed.js。
- [恢复后的Mission及两个子Task](08-mission-restored-converged-zh.jpg)：受阻/失败/已完成与真实后端一致；没有刷新页面。
- [实际非UI检查](archive-ledger-fanout-lifecycle.log.json)：原Hono事件流、两个Project并发领域事务、归档/恢复及SQL状态。首次fixture错误单列原日志，不伪装为产品回归红灯。
- [所有原始行复核](all-rows-reviewed.json)：源91300行保持，两个自有实例只新增Bus及其结算事实，全部原行保持；schema9、integrity_check=ok。
- [原实例结清](retirement.json)及[修复实例结清](retirement-after.json)：相同绝对截止、公开shutdown200、退出0、物理/输出/请求结清，模型请求0、模型目录副本已退休。
- [公开依赖核对](public-dependency-review.json)：GitHub当前SBOM显示新依赖身份；匿名告警接口401。不能由SBOM或本地审计推断精确12项告警清单。

截图为当前代理实际查看的8张原始JPEG，未裁剪、重绘或修改。日志JSON的content字段原样封装工具输出。未执行永久删除、完整Chat/Mission归档及刷新故障注入；未访问用户运行窗口或数据库，未复制认证、调用模型、更新安装或发布。
