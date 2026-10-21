# 配置准入与全量发现性能

[Recall、根因/风险与未达项](../../records/2026-10/2026-10-22-config-admitted-discovery.md)。单开发agent，原165登记worktree及真实预检新增1个全部验证，Source CLI /ui、正式构建；仅已登记主目录用原物理查重后的登记owner作为待准入候选，完整Git/occurrence/registry仍在同一durable admission内。无缓存或配置旁路，无UI自动化。

| 两轮真实完整负载 | before 保存/恢复 | after 保存/恢复 | 三个较慢读取的最长值 |
| --- | --- | --- | --- |
| cold | 22.60 / 21.37秒 | 14.15 / 13.96秒 | 22.75 → 14.23秒 |
| repeat | 21.11 / 20.72秒 | 13.62 / 13.70秒 | 21.20 → 13.72秒 |

**读取20秒通过；保存10秒与恢复5秒仍失败。** 四轮accepted/restored均true，全部HTTP200，原完整canonical字节恢复，目录227 Providers/8133模型。原[before](before-observation.json)/[after](after-observation.json)保留每个请求/阶段/阈值结果；writer均因真实门槛exit1，after readers exit0，before readers exit1，不拿接口成功或工具0代替性能。四次原身份初始/准入数保持164/162/162/162，Git326/322/322/322→163/161/161/161；跨度相互重叠，不当排他CPU/磁盘时间，也不保证固定比例。

| 已实际查看的图 | 页面与资格 |
| --- | --- |
| [01](01-before-general.png) / [04](04-before-complete-restore.png) | before原General/完整恢复Ask |
| [02](02-before-providers-during-write.png) / [03](03-before-providers-loaded.png) | 原写入期间Loading、自然完成227目录 |
| [05b](05b-after-general-ready.png) / [08](08-after-complete-restore.png) | after原General/完整恢复Ask |
| [06](06-after-providers-during-write.png) / [07](07-after-providers-loaded.png) | 新写入期间Loading、自然完成227目录/Connected |
| [原05](05-after-general.png) | 工具中仅呈现标题局部，保留而不用于完整布局资格；原因未归因 |

九原始捕获文件、八完整实际视图；[图文件/人工观察](image-observations.json)不含像素或DOM断言。原返回字节为JPEG，.png是当时捕获的文件身份，保留原字节。局部05不能证明或排除Rendering根因，05b后取得完整视图；没有新Sources/成员流/Mission/WebView2资格。

聚焦后端[最终Git合同](git-discovery-tests-final.log)10pass/1 Windows不适用POSIX skip与[filesystem](filesystem-identity-tests.log)6pass；真实坏Git/不可用Git/目录替换/继承init/物理peer重复登记/marker/别名等合同。[首个失败](git-discovery-tests.log)为新夹具未提供occurrence，原guard未改，[补齐后复跑](git-discovery-tests-fixed.log)通过。后端类型检查0，正式Node构建0/main-DhV28lza，[原构建输出](build-after.log.gz)保留全部警告/空白，不以构建替代视觉。

[after工具失败事实](after-tool-pre-admission-failure.json)与after-cold/after-repeat目录中before-prefix-repair快照保留过宽after-替换误改occurrence前缀。它在PATCH前拒绝；原reader98482与服务78859确认仍live，修正仅proof文件名后沿原轮次重跑，未重启/扩额。失败快照不是当前运行入口。四个round目录各保留原service→HostTransport→真实HTTP checker、原gate/request证明及结果，两个完整parsed canonical恢复不是直接覆盖源文件。

[资源摘要](resource-summary.json)及before/after原physical-terminal.json.gz保留两原5047/78859 exit0、公开shutdown200/native/output/request/launcher/精确出生完整，110/111页关闭。实际共4/8（各2/4）全Sol/stream/200/原source EOF，只含预检及memory；两层auth/models共8个文件成员退休，原源不变。各authority-retirement.json保留真实扫描与退休，未用额度退休，未发业务模型输入。

[数据摘要](data-summary.json)、before/after-data-preservation.json.gz与[memory逐字段观察](memory-observation.json)：90表156566原行/原源全字段/身份/时间/schema3对象/integrity/canonical保持，目标字节亦恢复。仅2容量租约及旧project-memory file/chunk的自然元数据改变，JSON仅availabilityGeneration79→83和timeUpdated，markdown保持、tokenCount7577/revision39不变；未回填。Provider activity391→392与全实际请求各2口径不同。新预检/事件事实保留，用户库未操作。

[打包事实](source-packaging.json)保留十个原checker与失败源快照的全部字节：这些文件以原名加.gz归档，终端空行未规范化。archive.mjs保留初次采集路径，pack-sources.mjs记录随后精确压缩步骤。

[打包后最终秘密值扫描](credential-scan-packed.json)覆盖当前源码/测试/记录/索引/所有产物与gzip解压内容，[初次扫描](credential-scan.json)亦保留。数据库/原行私有快照/完整日志/Provider正文/凭据不归档。脚本依赖现有504/413与私有路径，非独立安装包。当前仍未达到10秒保存/5秒恢复，下一步继续完整fresh准入链，长期Goal active。
