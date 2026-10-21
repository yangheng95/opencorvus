# 配置来源顺序验证

[Recall、根因和方案](../../records/2026-10/2026-10-22-config-source-order.md)。修复global资源目录扫描时重复合并global文件、覆盖较高优先custom声明的问题。普通文件、精确/dot/Windows大小写别名均沿同一loader和既有Filesystem比较；原global command/plugin目录职责保留。

| 实际页面 | 结果 |
| --- | --- |
| [01首页](01-before-home.jpg) / [02菜单](02-before-mode.jpg) | 修复前custom Full access被global Ask覆盖 |
| [03首页](03-after-home.jpg) / [04菜单](04-after-mode.jpg) | 修复后custom Full access生效，global仍Ask |
| [05项目覆盖](05-after-project-override.jpg) | 手动将新自有project设为Ask，覆盖custom Full access |
| [06最终首页](06-final-case-home.jpg) / [07最终菜单](07-final-case-mode.jpg) | 最终源码、Windows大写/点资源目录别名仍正确Full access；零模型 |

七张真实图均已人工查看，未新增/运行UI自动化。三个自有页112/113/114已关闭，用户18571未操作。UI源码和正式main-DhV28lza未改，未伪称新前端构建。仅本批配置/页面资格，没有新Sources/成员Rendering/Mission/WebView2资格。

[验证摘要](validation-summary.json)：初始六例4pass/2fail，case边界旧条件7pass/1fail；最终8来源+23继承+7peer+4全局候选，唯一42pass/122断言，两个backend typecheck均0。各原日志以.log.gz保留全部字节；中间重复轮不加入唯一计数。真实原/config及/global/config结果见[after初态](after-initial-config.json)、[项目覆盖](after-project-override-config.json)、[最终大小写别名](final-read-config.json)，requestID头null照实保留。

[资源摘要](resource-summary.json)及各physical-terminal.json.gz：before8872/after45522各2/4真实Sol，全gpt-6.1-sol/stream/200/source EOF，共4/8；runtime/private auth+models八成员已退休，unused4退休。final43298严格0/0，仅完整公开catalog、无auth，不构成新凭据资格，catalog也已精确退休。全部公开shutdown200、原native/output/request/launcher及精确出生链闭合。

首个工具7e2bff在复制凭据和Provider请求前因绑定旧项目而exit1，原完整失败证据以failed-before-startup前缀.gz保存；私有验证器改成真实owned project后沿原未用before预算继续，无活跃重启/扩额。另[HTTP前提误报](read-precondition-failure.json)保留只覆盖同名叶子的事实：global未声明username，custom用户名自然保留；完整before响应未保存，不能补造。[原错误工具快照](read-config-before-precondition-repair.mjs)保留。两错误都未靠新模型请求重跑掩盖。

before/after的数据观察和final-read-data-preservation.json.gz保留90表157001原行完整复核。前两target仅2旧容量租约自然变化，最终zero target零原行变化；原业务行/实际schema3/integrity与完整canonical保持。新真实预检/Project/Session/事件不回填；Provider activity各392→393与实际两请求口径不同，final392→392。[最终原字节与目录复核](source-bytes-and-directories-final.json)确认原库/canonical bytes/size/mtime及全部166目录dev/inode/realpath与519闭合快照精确相同。用户数据库未操作，没有schema或版本演进。

[最终实际秘密值扫描](credential-scan-delivery.json)覆盖全部当前交付、gzip解压内容、生产/测试/架构和索引。[首扫](credential-scan.json)末尾“no authority copied or provider calls”仅描述扫描器本身；本批实际4次调用及八成员退休以资源事实为准。私有数据库、原行、配置完整快照、凭据与模型响应正文不归档。脚本保留原输入/依赖/阶段事实，不是独立安装包。原10秒保存/5秒恢复性能仍未达，本批没有新的全量性能结论，长期Goal active。
