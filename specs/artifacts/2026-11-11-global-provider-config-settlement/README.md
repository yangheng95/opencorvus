# 全局配置回执顺序的证据

- [项目目录仍在等待](01-project-read-pending.png)时触发真实关闭项目。
- [全局先显示已接受的配置](03-new-config-catalog-pending.png)，原目录仍在等待。
- [较早目录到达后的搜索](05-stale-search-zero.png)显示该已保存名称为 0/88。
- [重新进入后的真实读取](06-real-reread-restores.png)恢复已保存行，目录为 89 项。
- [基线实际回执](baseline-api-evidence.json)包含真实读取、写入、完成顺序和五项接口响应校验。

这组截图是已由本人查看的基线。候选页面的同序交互与故障重试待补验。[根因、范围和当前验收](../../records/2026-11/2026-11-11-global-provider-config-settlement.md)
