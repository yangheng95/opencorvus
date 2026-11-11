# 全局配置回执顺序的证据

- [项目目录仍在等待](01-project-read-pending.png)时触发真实关闭项目。
- [全局先显示已接受的配置](03-new-config-catalog-pending.png)，原目录仍在等待。
- [较早目录到达后的搜索](05-stale-search-zero.png)显示该已保存名称为 0/88。
- [重新进入后的真实读取](06-real-reread-restores.png)恢复已保存行，目录为 89 项。
- [基线实际回执](baseline-api-evidence.json)包含真实读取、写入、完成顺序和五项接口响应校验。

- [候选项目目录仍在等待](07-candidate-project-pending.png)，[全局新配置先到](08-candidate-new-config-pending.png)。
- [较早目录到达后的候选搜索](10-candidate-search-keeps-row.png)保持 1/89，[编辑表单](11-candidate-global-edit.png)打开同一声明。
- [配置读取失败](13-candidate-config-diagnostic.png)保留目录和重试入口，[成功重试](14-candidate-retry-search.png)后直接键入查询得到 1/89。
- [候选实际回执](candidate-api-evidence.json)记录同序操作、真实截断和重试，以及五项接口响应校验。

基线和候选截图均由本人查看。[根因、范围和验收](../../records/2026-11/2026-11-11-global-provider-config-settlement.md)
