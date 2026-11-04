# 文件修改统计与摘要同步实页证据

单agent在独立原生开发`/ui`和本人隐藏页面完成；未操作用户18571窗口、进程或数据库。本轮没有新模型请求，直接重开之前真实模型生成、已正常完成的业务及持久原始记录。没有UI自动化测试，所有截图经真实交互和人工复核。

| 截图 | 人工查看结果 |
| --- | --- |
| [01](01-before-symbol-only-totals.png) | 单文件40行只以加减号显示，行数单位仅在无障碍名称中。 |
| [02](02-before-missing-file-stat-states.png)、[03](03-before-office-review-state.png) | 办公文件摘要缺少非文本/未知说明；原Review其实有对应类型和状态。 |
| [04](04-before-eight-file-totals.png) | 八文件真实完整比较的总量为+56/-0，仍只显示符号。 |
| [05](05-after-labelled-totals-en.png)、[06](06-after-labelled-totals-zh.png)、[07](07-after-narrow-summary-and-review.png) | 中英总量改为明确新增/删除行数，窄对话区可以正常阅读；原文件比较和读取入口保持。 |
| [08](08-after-explicit-unknown-states.png)、[09](09-after-unknown-original-comparisons.png)、[10](10-after-nontext-recorded-version.png) | 两个Excel显示非文本，纪要和合计行数未知；可进入逐次比较或创建时原版本。没有把未知数当零。 |
| [11](11-after-deferred-count-state.png)、[12](12-after-eight-file-labelled-totals.png) | 实页进一步发现：右侧已加载8文件/56行，但主摘要仍待加载，继续追查并修复缓存消费根因。 |
| [13](13-final-synchronized-counts-en.png)、[14](14-final-visible-summary-and-review.png) | 最终冷服务从原完整记录加载后，两处均为8文件/56行，英文统计含单位。14为同时完整可见的两个统计。 |
| [15](15-final-summary-retained-after-close.png) | 关闭Review后，主摘要保留已加载8文件和56行，可展开全部8项。 |
| [16](16-final-synchronized-counts-zh.png) | 中文两处同步8项/新增56行/删除0行，第8项定位到AC-08的原比较。 |
| [17](17-final-cross-project-single-file.png)、[18](18-final-office-states.png)、[19](19-final-returned-project-retained-counts.png) | 同一页面按真实侧栏切换单文件40行、办公项目3项及非文本/未知，再回到8文件56行；各自数据范围正确。 |
| [20](20-final-reloaded-synchronized-counts.png) | 刷新后由原记录重新加载，两处仍同步为8项/56行，完整原比较可读。 |

最终实现只有原128项Tool读取缓存：已验证完成值与原Promise在同一条目内，主摘要按原授权上下文、项目、消息/片段身份和完整性键消费同一个Part。原reducer继续负责全部统计。Review的请求key仍来自原始有界源，缓存通知只更新摘要，不反向重新调度读取；关闭面板不会把主摘要重新退回待加载。当前文件读取、历史端点和持久原记录均保持。

7项/14断言的非UI函数测试验证原比较端点、不可变结果、两项目各自的缓存值和明确错误；HTTP模拟只证明局部契约。正式8包类型检查、Node构建、接口6规则/36文件、文档352操作/26组和20份架构索引通过。三个阶段各initial/final的公开checker重复核对15项Mission、4项完整Task、既有Goal、24项收件箱/查询、Excel/文本与404错误、927四题八文件、928两轮四题/40行纪要/HTTP/SSE原事实。见[脱敏结果](qualification.json)。

before/after/final均0模型，累计仍为1400；三原生服务公开关闭200、原句柄exit0、物理完成/输出耗尽/请求清理齐全，六份认证和完整模型目录副本成对退休。schema10/92表保持，各阶段全部原始行、源库、113项目/Git身份、103隐藏配置和277附件保全；只有各自当前服务授权/租约各新增1行。未操作用户使用中的窗口或数据。

边界：缓存属于当前页面，刷新后按需重新读取；仍维持128项上限，不承诺永久持有全部历史。未进行超过128项的真实页面压力验收或另造千位数/单行统计场景，未伪造消息补覆盖。用户/模型原文、真实文件名、技术语言与参与者身份保留原内容。未改数据库迁移、公共接口、模型调用、运行调度、版本或发布。
