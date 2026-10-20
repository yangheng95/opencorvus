# 当前 Sources 与成员阅读复核

本轮没有修改产品源码。当前正式前端来自467，使用当前后端的独立18781服务；只有一个开发agent，没有新建产品成员。已有真实来源及正在输出的原成员会话通过实际页面观察。

| 截图 | 人工观察 |
| --- | --- |
| [价格来源](price-sources-visible.png) | 原价格成员显示 README.md、L2 和复制按钮，来源位于真实 read 后，正文归属正确。 |
| [价格原文](price-source-opened.png) | 实际 File 页签准确选择第2行。 |
| [交付来源](delivery-sources-visible.png) | 另一原成员显示 README.md、L3。 |
| [交付原文](delivery-source-opened.png) | 复用同一 File 页签后准确选择第3行。 |
| [普通成员原内容](ordinary-member-before-live.png) | 原普通成员的 read、L2–3、原说明和历史输入均可读。 |
| [新流中的旧来源](live-original-sources.png) | 原 Sources 和段落保持可见；截图在新 assistant 开始约18秒时采集。 |
| [新流中列表往返](live-list-return.png) | All agents 真实切换后返回同一成员，原顶部和 Sources 保持；截图采集时间早于同一回复完成时间。 |
| [完成回复](completed-member-reply.png) | 新回复4392字符、16节及末尾Markdown核对表可读，STREAM469END可见。 |

[最初价格页底部](before-price-sources.png)和[原主区位置](ordinary-parent-before-live.png)记录进入时的阅读状态，不用于判断视口外的 Sources。共10张真实1280×720截图，均已人工查看；没有浏览器自动化测试、截图断言或截图基线。

实际点击价格来源复制按钮，剪贴板得到完整原路径加 `:2`，随后恢复原内容，没有打印原剪贴板数据。两个 Task 成员是真实既有 Session qpRU/0sM0，原 read 分别绑定第2/3行。主区使用虚拟列表；最初在末尾看不到较早成员卡，公开 hydration 实际包含其父子身份，真实向上滚动后成员入口正常出现，没有据此误判数据丢失。CUA 直接滚动容器曾被表格单元覆盖而拒绝，改从实际空白边缘滚动后成功，未修改产品滚动逻辑。

[真实输入、回复与只读保留核验](results.json)：给已存在普通成员 ses_-zUS0WzzQzzDOGrIbYwN 发送一次正式公开 Session 输入；没有新建成员。原请求73809正常HTTP200/exit0，assistant msg_g0VYa9kDc00CY5LiJnwV接收原输入msg_g0VYa9kCG005PSduzw9Q，finish stop，实际gpt-6.1-sol。原12 Message/29 Part每行原始数据及时间逐一保持，现为14/33；四份原Source仍绑定各自原Message/read。全库133 Project/179 Session/schema2，启动前132/178的每个身份、目录和归属保持。

[第一帧运行事实](live-01.json)在截图后仍观察到同一assistant未完成、2593字符；[第二帧运行事实](live-02.json)记录同一assistant完成时间，截图时间比其早419毫秒。两个帧均有实际模型流关联。人工观察未见原段反复Rendering；采样截图不能排除所有瞬时帧，也不等于两个成员同时流中切换或所有渲染场景通过。

[原native/Provider结算](native-settlement.json)：4/当前scope预设4、整批预设8个实际流，全部200/stream/EOF，其中2个preflight、原成员的memory/work各1个。Host88316/Target83572与原21663均正常结算，公开shutdown200，物理/输出/请求/launcher完整收尾。自有tab20关闭，原用户18571未操作。[复制对退休](private-pair-retirement.json)记录实际秘密值扫描、runtime/private完整auth/models对清理、源metadata未变且无refresh/exchange。没有新前端build、UI自动化或数据库迁移。

Event新建内部Session缺少Chat/Work身份、配置性能和未采样的Rendering场景仍是后续范围。本轮增加当前真实运行证据，不宣称为新修复或整体目标完成。
