# 对话查找、归档与恢复体验

[Recall、调查与实施](../../records/2026-10/2026-10-27-conversation-archive-journey.md) · [运行事实](evidence.json)

26张原图来自649/38154、650/38155及651/38156独立开发CLI（Command Line Interface，命令行界面）的/ui桌面真实手工操作，1280×720，逐张人工查看。没有UI（User Interface，用户界面）自动化、截图基线或像素断言。

| 原图 | 实际观察 |
| --- | --- |
| [01-original-result-session.jpg](01-original-result-session.jpg) | 649原会话与已存真实结果 |
| [02-original-menu-without-rename.jpg](02-original-menu-without-rename.jpg) | 649原侧栏菜单；当前架构有意不含改名 |
| [03-renamed-original-session.jpg](03-renamed-original-session.jpg) | 649原标题菜单改名后同步 |
| [04-search-original-renamed-result.jpg](04-search-original-renamed-result.jpg) | 649英语查询把Chat分到Tasks |
| [05-archived-selection-closed.jpg](05-archived-selection-closed.jpg) | 649归档后退出原选择 |
| [06-archive-row-en.jpg](06-archive-row-en.jpg) | 649原英语归档与长目录 |
| [07-archive-no-match-en.jpg](07-archive-no-match-en.jpg) | 649英语无匹配状态 |
| [08-archive-row-zh.jpg](08-archive-row-zh.jpg) | 649中文归档与日期 |
| [09-restored-query-state-zh.jpg](09-restored-query-state-zh.jpg) | 649恢复后保留查询/无匹配状态 |
| [10-empty-archive-after-restore-zh.jpg](10-empty-archive-after-restore-zh.jpg) | 649清空查询后真正空归档 |
| [11-restored-search-zh-before.jpg](11-restored-search-zh-before.jpg) | 649中文原查询把Chat分到任务 |
| [12-restored-original-reply-zh.jpg](12-restored-original-reply-zh.jpg) | 649恢复后原ID/回复 |
| [13-current-search-en.jpg](13-current-search-en.jpg) | 650最终英语查询与分组 |
| [14-current-item-menu-en.jpg](14-current-item-menu-en.jpg) | 650最终英语工作项菜单 |
| [15-current-project-menu-en.jpg](15-current-project-menu-en.jpg) | 650真正英语项目菜单 |
| [16-current-archived-row-zh.jpg](16-current-archived-row-zh.jpg) | 650新菜单实际归档后的同一记录 |
| [17-current-search-zh.jpg](17-current-search-zh.jpg) | 650最终中文查询与分组 |
| [18-current-search-entry-zh.jpg](18-current-search-entry-zh.jpg) | 650最终中文空输入提示 |
| [19-current-item-menu-zh.jpg](19-current-item-menu-zh.jpg) | 650中文工作项菜单 |
| [20-current-restored-original-reply-zh.jpg](20-current-restored-original-reply-zh.jpg) | 650恢复后的原消息 |
| [21-current-project-menu-zh.jpg](21-current-project-menu-zh.jpg) | 650真正中文项目菜单 |
| [22-final-search-en.jpg](22-final-search-en.jpg) | 651最终英语查询分组 |
| [23-final-no-match-en.jpg](23-final-no-match-en.jpg) | 651最终英语无匹配 |
| [24-final-search-zh.jpg](24-final-search-zh.jpg) | 651最终中文查询分组 |
| [25-final-no-match-zh.jpg](25-final-no-match-zh.jpg) | 651最终中文无匹配 |
| [26-final-original-reply-zh.jpg](26-final-original-reply-zh.jpg) | 651最终原ID与原回复 |

归档/恢复数据旅程在修改前已通过：原真实模型结果会话正常改名、搜索、归档、查询、恢复及重新打开，同一Session/Message/Part（会话/消息/消息片段）身份保留。本轮修复当前查询分组和中英语义，以及所选工作项菜单错误的项目标签；不虚构归档丢失或后台故障。侧栏不提供改名是当前明确架构约定，标题菜单现入口已正常保存，保留该设计。

最终650从标题菜单再次归档、中文恢复和搜索后，原SCHEDULE648READY仍在同一Session中。工作项菜单为More actions/更多操作，真正项目菜单继续为Project actions/项目操作。所有原名称、技术类型和目录身份保留；搜索入口当前语言显示对话、工作和命令。

649只读克隆92表543行，650再克隆92表582行；各自原源全部行保持，24条原会话/消息/执行事实保持，仅目标规范标题/归档/恢复时间变化。两次均未复制认证，Provider（模型服务商）预算0且实际0，累计222不变。刻意无认证显示配置不可用提示，阅读、改名和归档仍通过，不能将其当现用户认证失败。

两次自建标签和原exec（执行会话）已关闭，公共shutdown（关闭）200，原生宿主/启动器均0，物理/输出/请求结清；余量分别791625ms与911251ms。未新做运行中Task/Mission恢复、历史分页或多项目并发，不把当前静态会话成功扩大为这些场景验收。

651补齐同源空态后的最终页面：英语与中文无匹配状态都明确包括对话、工作和命令，正常结果分组/原身份及重新打开也实际复核；650图仍属中间正式构建。651仅0认证/0模型读取，源650全部行和原消息/执行事实保持，公共关闭200、双进程0、物理/输出/请求结清。最终构建和余量见运行事实中的final。
