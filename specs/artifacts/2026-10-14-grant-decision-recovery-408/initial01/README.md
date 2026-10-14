# 408 初始证据与407实际交付承接

[本批Recall](../../../records/2026-10/2026-10-14-grant-decision-recovery-408.md)、[精确清单](manifest.json)保留136原件/637,854bytes；gzip解压为原bytes，不用源码hash作为验收。

- [407实际范围commit](407-delivery/delivery-commit.json.gz)：8354ac331，637路径、精确普通index同步true；[原commit owner](407-delivery/commit407-delivery01/owner.json.gz)。
- [fresh fetch](407-delivery/fetch407-delivery01/owner.json.gz)、[merge](407-delivery/merge407-delivery01/stdout.log.gz)、[正常push完整stdout](407-delivery/push407-delivery01/stdout.log.gz)/[stderr](407-delivery/push407-delivery01/stderr.log.gz)/[owner](407-delivery/push407-delivery01/owner.json.gz)：八实际types及所有hooks0，exact treeish1163/5937/4imports，main58096d4d7→8354ac331。
- [再次fetch](407-delivery/verify407-fetch01/owner.json.gz)、[ancestor原0](407-delivery/verify407-ancestor01/owner.json.gz)证明upstream已有835，不能把另一个peer后来的5449398b当Root创建的提交。
- [grant-used原共享根因](audit/grant-used-followup.md.gz)、[主/Task/Settings投影](audit/grant-projection-408-analysis.md.gz)、[原客户端真实边界](audit/raw-permission-adapters-408-analysis.md.gz)、[schema旧连接协调与WAL候选](audit/grant-migration-coordination-408-analysis.md.gz)。当前source/query/history/官方机制注释分别在`audit/grant-408`、`audit/raw-adapters-408`、`audit/migration-coordination-408`。

当前408没有生产、正式测试、index/revision实现、数据库实验、页面或Provider资格。官方文件锁规则只是实验候选；不证明本机Bun已取得真exclusive，不证明任意用户进程已停止。没有auth/models内容、用户数据库、私有bundle或Provider完整正文；407原运行失败及人工桌面截图见其独立交付档案。
