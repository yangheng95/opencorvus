# 成员真实流与呈现身份复核

当前生产9c90c1c的已有普通成员，一次有限公开输入、两次真实网页Allow Once、六次gpt-6.1-sol流式200且源EOF。生产未修改；未用额度退休，私有服务/页面/成对authority已全部结算。方案和完整边界见[调查记录](../../records/2026-10/2026-10-21-member-stream-owner-review.md)。

| 实图 | 人工观察 |
| --- | --- |
| [01 冷启动](01-existing-member-cold-view.png) | 原长文已可读；首个无障碍快照曾有初始Rendering，截图时已结束 |
| [02 网页来源](02-real-web-source-and-second-read.png) | 首个真实来源和第二工具读取；不充当最终长文流中证明 |
| [03 流中正文](03-live-guide-early.png) | 新最终assistant的早期节次 |
| [04 列表往返](04-live-list-return-and-paused-reading.png) | 原assistant仍未完成，返回成员并停在代码区阅读 |
| [05 完成位置](05-same-reading-position-after-completion.png) | 完成后的同一阅读区域 |
| [06 原工具结果](06-real-web-result-expanded.png) | 实际网页返回展开 |
| [07 来源与引用](07-final-reference-link-and-source-context.png) | 真实ACL来源卡与首节蓝色阅读入口链接 |
| [08 重开](08-member-panel-reopen-reading.png) | 完成后重开保留阅读区域 |
| [09 中文](09-chinese-returned-member-reading.png) | 完成后切换界面语言 |
| [10 调宽](10-chinese-width-change-reading.png) | 380→441宽度后的中文首节 |
| [11 代码阅读](11-chinese-code-block-reading.png) | 中文复制代码控件、完整段落 |

[runtime001](before-runtime-001.json)于05:19:04.642Z关联未完成最终Message、3001字元与真实source-reader reading；[runtime002](before-runtime-002.json)是完成后。最终4913字元/12节/46块，[响应描述](before-response-description.json)记录真实格式，[公开事实元数据](before-runtime-metadata.json)保留原Message/Part/来源/工具身份与字数，完整第三方网页、思考和正文留在私有目录。

[五次身份快照之一](before-owner-snapshot-001.json)、[最终快照](before-owner-snapshot-005.json)及[1819条去重诊断描述](before-observation-description.json)支持采集期间旧20个owner绑定稳定。before-console-001至007仅导出实际MD503被动日志。capture晚启、500条窗口和空档明确记录于[scope disposition](scope-disposition.json)；没有连续视频/完整初始挂载/每帧或性能证明。[私有诊断构建脚本](build-diagnostic.mjs)仅附加被动属性/日志，不是UI自动化测试，不修改生产或消息。

[待机观察](before-standby-observation.json)和[原物理结算](before-physical-terminal.json)区分逻辑idle与可复用物理owner；[公开关闭](before-public-shutdown.json)、[关闭后原事件核验](before-standby-closed.json)证明原seq52保留、shutdown追加同输入seq53/idle、实际owner释放。两个错误检查的原失败[待机假设](runtime-before.log)、[事件ID假设](closed-standby-original-failure.log)保留，不包装成产品bug；修正依照共享loop/status契约。

[完整数据对照](data-preservation-observation.json)和[精确变更资格](before-preservation-qualification.json)：源90表140168原行/全部字段及配置保持。隔离副本5个原行自然变化：同Project记忆两行、capacity两行及成员Session更新时间。原计划只允许Session变化漏算正常记忆整理，实际差异如实保留；不以整表豁免隐藏变化。schema3不变，不触碰用户库。

[原预检](before-preflight-ready.json)分别证明credential usable、catalog projected、实际Sol流；[凭据退休](before-authority-retirement.json)记录完整成对清理和原用户凭据/模型目录保留，六次实际源EOF。所有检查脚本仅是实际后端/原始数据资格读取与离线描述；未新增或运行UI测试。没有新的生产根因或修复，Task/Mission新成员、重启/重连全矩阵与持续性能目标仍未完成。
