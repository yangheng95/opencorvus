# 专家团目录游标错误契约：真实验收

真实隔离开发 `/ui` 的 1280 × 720 桌面截图，原图均由实施者本人复核。

- [01 原构建旧游标失败](01-before-stale-continuation-with-recovery.jpg)：保留前批恢复功能，底部局部失败和有效包列表。具体通用 500 见本批实际接口回执与[前批原始详情](../2026-11-09-expert-squad-diagnostics-continuation-recovery/07-after-original-diagnostics-and-usable-list.jpg)。
- [02 新后端的 409 详情](02-after-409-and-original-request.jpg)：真实冲突类型、请求标识及第一页恢复说明，可用列表仍在。
- [03 刷新后的真实续页](03-after-new-cursor-and-global-installation.jpg)：新全局安装、原筛选和原诊断，焦点准确进入追加的 `incomplete-020` 原详情。

[功能检查器](check-catalog-cursors.mjs) 对四个接口的五种游标输入使用实际运行文档校验响应。回执：[旧构建初始](before-snapshot.json)、[旧构建安装后](before-advance.json)、[新构建初始](after-snapshot.json)、[新构建安装后](after-advance.json)。[物理数据核对](owned-final-check.json) 与[检查器](audit-owned-data.py) 记录项目原文件、包字节和隔离数据库状态。完整根因、验收范围和限制见[本批规格](../../records/2026-11/2026-11-09-expert-squad-catalog-cursor-contract.md)。
