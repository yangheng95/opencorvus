# 产物请求摘要实页

对应[方案](../../records/2026-11/2026-11-06-artifact-request-summary.md)。原生开发页面、真实输入/输出及人工截图，不运行UI自动化。

| 原图 | 人工复核内容 |
| --- | --- |
| [01](01-before-search-summary-zh.png) | 前态：主卡及成员详情中文动作仍夹固定英文Artifact queries (1)。 |
| [02](02-before-read-summary-zh.png) | 前态：读取摘要仍是Artifacts (1)，原结果保留。 |
| [03](03-after-single-request-en.png) | 后态英文：主卡与成员单项查询/读取使用1 search request/1 read request。 |
| [04](04-after-single-request-zh.png) | 后态中文：主卡与成员显示1项查询请求/1项读取请求，原invoice.py查询可展开。 |
| [05](05-after-two-queries-zh.png) | 中文2项查询请求和原两个筛选项；下部完整原文可继续阅读。 |
| [06](06-after-five-read-requests-zh.png) | 中文5项读取请求，reads数组5项与results5项可对应。 |
| [07](07-after-five-read-requests-en.png) | 同一5项读取在英文使用5 read requests。 |
| [08](08-after-two-queries-en.png) | 同一双查询在英文使用2 search requests，原参数保持。 |
| [09](09-after-partial-read-result-en.png) | 原只读审查的5项读取仍complete=false，next_reads有1项。 |
| [10](10-after-partial-read-result-zh.png) | 同一未完整读取的中文摘要和真实续读标记。 |
| [11](11-after-continuation-request-zh.png) | 后续1项读取请求保留原byte_offset4915；不是新增完整文件的数量。 |
| [12](12-after-refresh-request-summary-zh.png) | 中文刷新后重新打开原成员，分组展开选择、5项摘要及未完整结果保持。 |
| [13](13-after-original-read-error-zh.png) | 原795引用错误优先显示出错和完整真实诊断，不被数量标签遮盖。 |
| [14](14-after-seven-read-requests-zh.png) | 原后续成功工具显示7项读取请求，原reads数组及结果各7项。 |

14张原图均本人查看。01—02为main-B-xKJnLe.js前态；03—14为main-C7lJnm6J.js后态。中文1/2项查询、1/5/7项读取、英文单复数、主卡/窄成员栏、原输入与输出及中文刷新均实际操作。09/10的complete=false和next_reads1项、11的续读偏移4915保留原事实；请求项数不能当成文件数、独立产物数或完整读取数。13保留原引用错误与中文出错状态，14另示原后续成功7项请求，不把一图当成所有结果。

初次用成员Session作为Work链接被真实404明确拒绝；随后从实际搜索选择所属Task，再打开原成员完成验收。没有猜测多个链接、创建替代资料或把入口误用当成本显示问题。原参与者、原错误和技术字段保留原语言，不翻译或改造其事实。

17个真实会话的60份完整工具Part、原输入/59份完整结果/1份原失败、HTTP历史与SSE连接快照在前后和结束精确一致。查询23次/26项请求、读取37次/128项请求只是本次历史覆盖统计，不能合并成154个文件或独立产物。原提问/文件三会话8完整工具亦精确保持，本批仅做其公开事实回归，没有把972的旧实页图片计入本批。

8包类型、两语言2901键、普通Node构建、文档352操作/26组、20份架构文档、CSS9183引用检查通过。没有UI自动化、后端、SDK、数据库/迁移、模型工具或调度改动。两阶段公开关闭200、原生/启动器exit0、物理/输出/请求结清，4份成对认证/完整目录副本退役，63—65本人三页关闭。310422→310424→310426仅正常控制lease/grant各阶段各1；所有原业务行、源库、130项目文件/Git和301附件保持，schema10/92表、零文件系统豁免、0新请求、累计1474。用户窗口、18571、进程及真实数据库未操作。[资格记录](qualification.json)保留具体范围与限制。
