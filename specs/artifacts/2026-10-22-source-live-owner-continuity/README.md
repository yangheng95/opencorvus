# Sources 与成员正文连续性证据

按[Recall/根因/实施/限制](../../records/2026-10/2026-10-22-source-live-owner-continuity.md)交付。单agent，修复成员总览/详情导航后焦点落到BODY；没有把未复现的Rendering候选当成修复。正式after main-CVqU1gha；before main-CiNKIrGg含被动诊断，独立于未被观察的warn级别重建。

| 实图 | 实际内容 |
| --- | --- |
| [01](01-member-initial.png) | 初始已有成员末尾 |
| [02](02-old-source-reading.png) | 键盘定位原ACL来源 |
| [03](03-old-tool-expanded.png) | 真实旧webfetch展开 |
| [04](04-live-old-reading-retained.png) | 新W3C一次权限与原阅读位置 |
| [05](05-live-old-tool-retained.png) | MDN批准后旧结果保持 |
| [06](06-live-new-sources.png) | 新两项来源与正在输出正文 |
| [07](07-live-all-agents.png) | before总览、AX焦点BODY |
| [08](08-live-member-return.png) | before详情、AX焦点BODY |
| [09](09-live-dock-closed.png) | 流中关闭dock |
| [10](10-live-dock-reopened.png) | 流中重开，来源位置保持 |
| [11](11-live-text-tail.png) | 实际生成中段正文 |
| [12](12-final-text-tail.png) | before24节结束 |
| [13](13-final-sources.png) | before新来源完整标题 |
| [14](14-after-old-source.png) | 正式after原来源位置 |
| [15](15-after-live-list-focus.png) | Enter总览，work Running聚焦 |
| [16](16-after-live-detail-focus.png) | Enter详情，All agents聚焦 |
| [17](17-after-selector-open.png) | 原成员下拉框选项 |
| [18](18-after-selector-focus.png) | 选择后仍聚焦原trigger |
| [19](19-after-pending-without-dialog.png) | 后台待决但对话框关闭的调查窗口 |
| [20](20-after-pending-recovered.png) | 自有页重载恢复同一MDN权限 |
| [21](21-after-final-list-focus.png) | EOF后同一成员row焦点 |
| [22](22-after-final-detail-focus.png) | EOF后返回按钮焦点及完整结尾 |
| [23](23-after-final-sources.png) | 正式after两条真实来源 |

23图全部实际呈现人工查看。before10份console合计198唯一事件，input后3个新正文owner保持身份，最终0→1→52块；[owner观测](owner-observation.json.gz)是描述，不是UI自动化断言或逐帧证明。[焦点事实](after-focus-observations.json)记录两次真实Enter往返及原下拉框。

[资源/Provider摘要](resource-summary.json)：实际12/16 Sol（含预检/记忆），全部stream/200/原source EOF；两原service exit0/public shutdown200/native physical/output/request/launcher/精确出生链闭合，两页面关闭，8配对凭据成员退休。[数据观察](data-preservation-observation.json.gz)覆盖90表156566原行/schema3/canonical；源原行精确保持，两个target各5自然更新行，Provider activity391→395。

after原input63551 **exit1**，[原日志](after-input.log.gz)保留等待权限时的默认idle TimeoutError；没有重复POST。修复后的[有界HTTP工具](http-json.ts)通过真实公开GET读取[同一输入与完整结果](after-reconciled-result.json)，原user/assistant parentID、stop、5096字符/24节和待决权限空列表均为实际持久事实。新POST经修复工具的独立资格尚未达成，不伪称原POST成功。

[MDN原待决](after-pending-permissions.json)及[同一ledger](after-recovered-permission-ledger.json)保留requested→allowed_once→execution_started/succeeded→自然退休。非模态对话框允许外部focus关闭，且导航发生在请求提出约8秒之后；该关闭归因是代码/时序支持的推断，没有原因日志。未修改权限/调度机制，未将正常待授权前沿判为调度丢失；不声称Task/Mission/全部恢复/并发或所有Rendering资格通过。

构建/输入日志为原始输出gzip，实际完整DB/原行快照/凭据未归档。原before90951首次7314模块/1m6s构建只有工具回执；diagnostic-build.log.gz属于未被观察的warn重建，不能当其日志。正式after-build.log.gz为7314模块/52.77秒原构建。

脚本使用既有私有413/446原生监督链、504 Source CLI服务、525准备helper和497冻结Bun，按仓库parent ed2abe213的before代码及本提交after代码执行；不是独立安装器。send-original.ts为两次原输入实际工具，send.ts/http-json.ts为超时边界修复后的后续工具，reconcile.ts为实际运行的公开结果checker。未新增或运行UI自动化测试。
