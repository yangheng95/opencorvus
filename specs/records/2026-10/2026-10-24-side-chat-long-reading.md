# 长回复中的阅读意图与原 Sources

## Recall

564按用户后续明确要求只用一个agent；旧Goal中Astra表述不再适用，不委托。用户授权OpenCorvus热认证OpenAI用于有限gpt-6.1-sol真实流式验收，持续自主排查、修复、提交推送。上一Goal turn为progress：080c4d22e修复复制历史/消费后重放重复记忆登记，6551a2f49补齐Side显式到底和主动发送跟随，两者已正常hooks push/fresh0/0。563七张中英文实际截图、正式Node UI main-BGogOrxR、类型/文档通过；四真实模型请求EOF，原29821/native82992全部闭合，auth/catalog各退休1，源90表174518原行/字节/时间保持。短回复约两秒，尚未实际覆盖长回复生成期间上翻。整体Goal active。

当前HEAD6551a2f49；开始git status完整保存私有目录，默认index仍有其他任务9个暂存文件（CHANGELOG、interaction/permission、相关测试、project-memory架构及expert-squad机制记录）。SideChatPanel/dom-utils/07-panel-reactivity开始干净，不覆盖他人暂存或未暂存，不创建branch/worktree，不操作用户18571进程、页面或数据库。

已重读AGENTS、562/563 Recall/证据、07-panel-reactivity读位与Sources合同，复核Side send/contentChanged/acceptedDraft composer及共享dom-utils的所有输入归属、宽度恢复、内容resize、program echo、跟随与恢复实现，上一批已读全部三个生产caller（Main/Side/member）。source CLI默认项目与实际会话项目独立，完整隔离数据库与模型目录用于真实验收。没有UI自动化测试。

## 修改前调查与影响面

563的未覆盖项是验收缺口，不直接当成产品bug：send只在POST前恢复一次；完成/失败和transcript effect沿原tracking。实际长流期间用户上翻后是否保持、acceptedDraft隐藏输入及完成后输入恢复造成的高度变化是否影响读位仍未知。共享controller对真实上翻暂停，对后来内容增长保持；viewport width变化复用原anchor，height变化沿原native scroll/controller行为。不可仅凭代码自述判断视觉通过。

Sources另使用现存真实来源，不合成消息/Part或mock流。封存563数据库中，Task tsk_g00VYhrJxy00qIC54qvM、root ses_-zURI8flEzz7XOW5XhCo、orchestrator ses_-zURI8ekpzzskoESwwiP属于prj_hlVwmME4dYUkGLOkDqOR。两条实际Source分别在子成员ses_hM7XNBWOoUj94oRFpAmh与ses_h0gcSAerl0lMXEbz1cq3，不在orchestrator正文。后者规范Part prt_g0VYhrsML00F2uyTDsUa指向ACL S2-MAD页面，前者指向arXiv Free-MAD。来源title/URL/provider/toolPartID由只读SQLite查明，不从最后界面标题猜身份。560实图18已实际查看，可见原ACL来源卡片、域名与复制按钮。

私有只读分析脚本最初误查不存在part.session_id，已按实际message_id关联message取得Session归属重跑；随后排除orchestrator不是来源成员的错误选择，用整个真实Project内明确Source Part类型找到子Session。只读失败不触碰原数据，不改产品迁就checker。规范Task URL来自当前workspace-location唯一taskID契约，不试猜URL别名。

本轮先作真实验收，未发现产品失败前不改生产代码。若发现读位/Rendering/恢复异常，必须补齐直接触发、共享根因和影响审计后修，不能用缩短输出、隐藏Sources、禁用流、host gate、重建连接或倒退跟随策略遮蔽。若涉及调度/队列/终态异常，立即按AGENTS横向审计全部生产入口/occurrence/重启/项目隔离；当前只证明有UI验收缺口，不能提前下共享运行时结论。

公共接口、持久格式、schema及模型行为暂不改；没有非UI新功能或测试替代合同。UI/视觉仅手动实际页面、截图与人工阅读，DOM/AX只作目标/状态诊断，不写断言、截图基线或自动化测试。长回复用真实有限用户请求自然产生，一次最多80项一般界面观察内容，不用sleep或工具制造假流。单服务最多6请求（预检chat/memory2、真实长回复chat/memory2，另保留2用于原项目既有正常整理），20分钟原生边界、180秒启动无活动、至少五分钟收尾。不能把预算未耗尽或静态文本当验收结果。

## 实施前验收方案

1. 从已完全闭合563完整复制90表/配置与完整main-BGogOrxR UI，启动独立source CLI `/ui/`，未改前端时不重build。完整当前OpenAI条目与完整相邻models配对复制，分别验证OAuth可用、目标模型投影和实际gpt-6.1-sol流式预检。记录原exec/native/occurrence和截止时间。
2. 单agent手动开两个隔离IAB页面：原Side2的主会话，和上述实际Task的成员来源。先展开真实ACL Source并看图，再在Side2发一次有限长回复请求。观察原Provider reader仍进行中时，上翻Side并记录较早原文、暂停按钮、Working/Stop；切到来源页实际看图确认原Source内容/读位，回Side检查完成后同一阅读位置，再手动到底查看最终真实正文。
3. 以真实请求/EOF时刻与截图时刻区分进行中/完成资格，不以文本增长或模型自述证明还在流式。若首次观察太晚则保留未达证据，在当前时间/预算允许下修正验收设计，不能伪称覆盖。完成后继续实际Sources核对，必要时在原两个页面正常隐藏/返回确认所有权保持，不重启用户应用。
4. 若有失败，先落盘完整共享分析和具体修复方案，再改当前唯一实现、必要聚焦正向非UI合同或UI人工复核；UI代码变化后正式Node完整构建至全新私有目录并用新source CLI重新实际查看。不能为了绿色指标保留旧实现或UI自动化。
5. 公开shutdown、join原exec/native/launcher/物理/输出/请求，配对退休凭据/模型目录；全源原行/字段/时间/字节/canonical/actual schema/integrity与目标真实差异逐一记录。更新四索引，当前package docs:check，精确独立index提交本批证据/必要修复；fetch原进程terminal后merge upstream、完整待推集合审查、正常hooks push/fresh0/0。整体Goal继续active。

## 实际执行与资格

从完全闭合563复制90表175427原行与完整UI，不改前端、不重build，entry main-BGogOrxR。原93807 source CLI、target93056，启动预检证明当前完整OAuth条目可用、完整models投影正确、实际api.id=gpt-6.1-sol。IAB225按真实Task ID直接打开原Task，实际点击base-researcher · 1cq3，看到原ACL Source。IAB226打开原Main和原Side2，发送一次有限80项一般阅读观察练习；没有创建或运行任何子agent/Task/Mission/持续目标。

实际新user msg_efa47225-5028-494d-9cb0-85b346ff1477、assistant msg_g0VYv5h4100McYySB2lj，完整正文4377字符，第一项01、最后80；Message创建至完成101527ms、finish=stop。真实chat原reader 23:50:29.688→23:52:09.218 UTC后EOF，规范完成23:52:09.252。期间原memory helper独立正常完成，Project记忆revision4→5、321→482tokens/1238→1866字符，pending正常消费。

02（23:50:36.709）真实流中上翻到旧消息，03（23:50:55.939）流中查看另一页原Source，04（23:51:40.849）仍在流中原读位保持。04原文件名误写after-reply，看到实际Stop且原reader未EOF后已改名still-paused-during-stream，不伪称完成。05（23:53:12.313）真正EOF后输入框恢复，旧阅读位置和恢复按钮仍在；06实际点击恢复后第77—80项真实可见。01/03/07原成员Source在流前/流中/EOF后真实查看，标题、域名、复制控件、原正文位置保持。七图均人工查看。AX仅定位/诊断，资格来自实页图和原模型流时间，不是自动化UI测试。

两个页面实际五个stream ID：两个work-ledger、Task、Main和Side各一。原请求观察逐个配对短admission与实际request，关闭两页时五者都abort；本次保持各自原实例。此证据与当前范围内的Sources稳定一致，不宣称全产品所有Rendering入口都已穷尽或根治。本轮没有复现新产品失败，不为制造修复而修改正常共享controller。

## 完整闭合与数据

四真实gpt-6.1-sol请求（预检chat/memory2、长问题chat/memory2），全部流式200/原reader EOF，cap6未耗尽。公开shutdown200、预留802537ms，原93807 join terminal exit0，native/launcher exit0，physical/output/request全true，精确birth/occurrence原链dead_or_reused。完整auth/models配对退休各1，源catalog完整内容/9155406字节/mtime1791128890137.9968保持。

源90表175427原行、全字段/时间、DB字节/mtime与canonical配置保持；actualschema4→4对象一致、integrityok。target原行差异仅memory_chunk/memory_file、两条运行容量租约及本次接收新问题的Side2 time_updated，其余原Task/Mission/Session/Goal与原Source Part保持，真实新Message/Part/事件为正常新增。没有用户数据库、18571进程或用户窗口参与。

[完整证据入口](../../artifacts/2026-10-24-side-chat-long-reading/README.md)保留七图、阶段/原生/Provider/全表事实、安全请求和规范来源身份。回链563未覆盖项，四索引同步，当前docs:check及正常Git hooks交付。只提交本轮文档/证据，保留默认index的其他9个文件和全部其他改动；最终Git事实以原commit/fetch/merge/push输出为准。整体Goal继续active。

## 后续发现，不作未审计根因

原始请求记录显示三个当前owner Goal GET分别72/62/59，总193次；持续目标事实应读protocol_event中的continuous_goal.created，目标三owner都没有该created事实。最初只读查看engine_goal的5行，复核store才确认那是Task验收目标，已从公开证据去除错误分类，换成实际protocol事实（总17个其他owner创建）。不能把Task目标与持续目标混成事实源。

当前ContinuousGoalControl既使用listenContinuousGoalRefresh（connected/intent/settled）也设置周期refresh，在可见、归属有效和非busy时发GET。该计数是后续性能/刷新机制审计线索，不足以证明Sources闪烁因果；本轮五流和原Source正常。下一批需要横向查清Chat/Task/Mission/Side所有目标入口、事件投影/终态/恢复与活动统计的更新需求，再决定唯一刷新实现，不在本轮未经分析删除timer或增加parallel状态。
