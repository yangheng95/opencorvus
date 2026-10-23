# 侧聊的主动回到底部与发送跟随

## Recall

563继续用户授权的单agent自主产品迭代，热认证OpenAI可用于有限gpt-6.1-sol真实端到端；不委托、不操作用户18571窗口/进程/数据库。562共享记忆修复已提交080c4d22e、正常完整hooks推送、fresh0/0，12正向合同88断言、7次真实Sol流式200/source reader EOF，三个scope全部物理/输出/请求闭合、auth/catalog各退休。整体Goal active。

562实图04在展开引用历史后主动发送新问题，回复已规范持久化但留在视口下方；05重新打开同一Side后回复实际可见。不能把DOM可读当视觉通过。当前Side send尚未恢复follow，且没有主Conversation的滚动到底部入口。当前HEAD080c4d22e，SideChatPanel、side-chat.css、07-panel-reactivity开始干净。工作区其余删除/新增/改动与本轮无关，当前staged空，提交前重新核对并保留。

已读562 Recall/实际阶段与原生闭合事实、07-panel的Side生命周期/引用语义及07-panel-reactivity阅读位置合同；SideChatPanel完整读位、连接、send、引用展开和composer，dom-utils共享AutoScrollController及所有三个生产caller（Main Conversation、Side Chat、SubagentConversationPanel）、Main显式按钮和ChatComposer发送路径、当前Side CSS和正式Node/Vite构建配置。三处都沿唯一setupAutoScroll，以isTracking决定新内容跟随；Main已有显式按钮恢复，成员只读正文沿相同controller。全仓同语义搜索未发现Side的其他恢复按钮或send后恢复。没有运行/新增UI自动化，相关源码路径未发现UI测试；非UI测试不充当视觉资格。

## 修改前分析

可见现象与触发：展开reference history通过pauseAutoScrollForReading主动暂停阅读位置；Side send用实际POST提交新Message，但只更新sending/error/draft。后续transcript effect仅contentChanged，按暂停状态保留读位；新回答可能在下方不可见。关闭重开、折叠引用或手动滚到底才能恢复，用户缺少直接且清晰的动作。

控制流根因是Side只接入共享阅读暂停与自然到底恢复，遗漏显式恢复操作。Shared controller本身按合同运行：new output不能自动夺走读位；scrollToBottom可退休待恢复位置并跳转，但由caller拥有tracking。不能让所有数据变化自动跟随，也不能以折叠/卸载历史、重建连接或伪造scroll事件遮蔽。562的copy捕获缺陷已独立修复，与此UI意图缺口不同。

影响面：Side的Chat/Task-root/Mission来源共用一个组件，按API authority/source/Session/selectEpoch拥有reader；新按钮与发送必须只操作当前owner。Explicit send在真正POST前恢复一次，后续模型流/完成/错误不得再次强制恢复，以便用户流式期间继续上翻。Main/member的既有行为与同一primitive保持，来源披露继续主动暂停。引用开关、草稿/quotation、消息ID重试、权限、stream连接、Task/Mission调度及终态不变。没有scheduler/队列/唤醒异常证据；此次仅UI阅读意图，不更改其公共控制流。

接口与数据排除：没有新API/工具/配置/模型行为/非流式调用；复用现有本地化chat.scroll_bottom、中英文已有标签和Button/Icon。SQLite schema、迁移、记忆格式与用户数据不改。当前source复制完整闭合562-after，所有源原行/字段/时间/字节/配置与actual schema/integrity逐一核对，目标正常新输入/记忆/租约变化单列。当前真实Provider必须同时复制完整凭据条目和完整模型目录并验证三项，不能只复制auth。

风险与验收：暂停读位被错误重置、退役owner写读位、发送完成抢回后来主动上翻的读位、浮动按钮遮挡文本/输入或挤压布局、窄Side目标不可点击、本地化/无障碍遗漏。必须实际呈现展开历史/浮动入口/点击恢复/真实发送后的可见回复，再上翻确认仍能阅读。UI-only不写自动化测试；类型/build/文档仅补充。

## 实施前方案

1. Side一个显式scrollToLatest动作，校验现有reader当前归属，设置现有tracking、调用原controller.scrollToBottom、沿原store保存。当前Side暂停且有正文时，在composer上缘显示与主会话同语义的浮动Button/Icon，复用chat.scroll_bottom，不新增影子状态或source。
2. 合法send的当前owner在POST前调用同一动作一次；不要在完成回调恢复，也不要修改contentChanged或Sources暂停策略。CSS只为Side按钮锚点与绝对定位，不改变composer/正文流高；用现有视觉token和组件。
3. 更新当前阅读架构与四索引。正式Node Vite完整构建到私有全新输出，不启动独立Vite，不改用户正在读取的dist。新的source CLI /ui冻结完整新bundle，隔离运行20分钟/180秒启动无活动/五分钟收尾，仅一个服务、至多4个模型请求（预检chat+memory、有限新Side问题chat+memory）。使用562封存04作before，after所有交互和截图实际手动呈现。
4. 读同一Side2，展开引用历史并上翻，截图按钮/原文/读位；点击按钮确认真实原回复可见。再次展开/上翻后发送有限问题，真实Sol流式回复在最新处可见；完成后上翻/点击恢复确认用户仍拥有跟随意图。实际locale和无障碍名至少核对中英文，保留每张资格边界。
5. 公开shutdown并join原exec/native/launcher，物理/输出/请求闭合，配对退休auth/models，全源数据保留和目标差异结算。只提交本轮文件，fetch/merge upstream、审查完整待推提交、正常hooks push、fresh0/0。整体Goal继续active。

## 实施与实页结果

Side唯一scrollToLatest沿reader的API authority/source/Session/selectEpoch归属校验，设置既有tracking、调用原controller.scrollToBottom并保存原读位。暂停且有正文时显示既有Button/Icon与chat.scroll_bottom本地化名；绝对定位于position:relative的composer上缘，不改变输入区或正文布局高度。合法send在实际apiJson POST前调用同一动作一次；stream effect与完成/失败回调没有恢复操作，原历史展开继续pause。

前端类型检查原85471 exit0；正式Node Vite完整构建原64258 exit0，71秒完成，输出全新私有ui并完整复制bundle，actual entry main-BGogOrxR.js。仅预存chunk体积提示，无构建错误，没有启动Vite开发服务器或更改用户dist。src CLI在原29821运行，target82992，端口54054，预检准确证明OpenAI OAuth usable、gpt-6.1-sol已投影且实际流式请求一致。

手动IAB224选择原Main ses_-zUR5coFizznlxwzV81M并打开原Side2 ses_-zUR54flpzzby4xUJQPT。真实展开参考历史，01保留原文且浮动按钮可见；实际点击后02原真实回答可见。再次上翻后输入有限验收问题，03较早历史/草稿/暂停按钮同时可见，发送后04实际新回复“回到最新跟随正常。”在最新视口；再次上翻05旧历史保持并重新显示按钮。设置实际切换简体中文，06原读位和中文无障碍名“滚动到底部”核对，实际点击后07新问题及回答再次可见、控件与时间已本地化。七图均实际呈现/人工查看，没有用DOM或checker冒充视觉资格。

新回复约2秒，发送后的首张实图已完成，因此本轮实测的是暂停时发送、实际新回复可见、完成后上翻和明确恢复；未演练长回复未完成时上翻，不包装成全部流式读位场景通过。只在dispatch前恢复、后续不恢复由当前控制流审核证明。原生重启和其他流式入口专项保留，整体Goal active。

实际4次gpt-6.1-sol全部流式200/原Provider reader EOF，maximum4且未耗尽；预检chat/memory2，新Side问题chat/memory2。原规范记忆revision3→4、221→321tokens、852→1238字符，pending正常消费，原副本source和历史保持。没有新建Side、Goal、Task、Mission或任何子agent。

## 闭合与数据

公开shutdown200，原29821 join terminal exit0，native/launcher exit0、physical/output/request均true，实际reserve960649ms超过5分钟，精确birth/occurrence原链dead_or_reused。auth/catalog各退休1，源catalog完整内容/9155406字节/mtime1791128890137.9968保持。源闭合562-after全部90表174518原行/全字段/时间、数据库字节/mtime与完整canonical配置保持，actualschema4→4对象一致且integrityok。target原行差异为本项目memory_chunk/memory_file、两容量租约及实际发送问题的原Side2 time_updated，其余原Task/Mission/Session/Goal保持，真实新消息/Part/运行事件正常新增。用户数据库及18571进程/窗口不参与。

[完整证据入口](../../artifacts/2026-10-24-side-chat-explicit-follow/README.md)记录截图、阶段数据、Provider原reader与原生闭合、安全请求观察。三索引和当前阅读架构同步；提交前重新核对HEAD/staged与其他任务改动，独立index只装本轮文件/README单行。交付正常fetch/merge、待推集合审查和hooks push，以原Git输出证明，不绕过检查。

提交准备时HEAD仍080c4d22e，默认index已有其他任务9个暂存文件（CHANGELOG、interaction/permission源码与测试、project-memory架构及expert-squad机制记录）；完整entries和binary patch已私有保存。17个本轮文件进入独立index，三个共享README只使用HEAD加本轮一行。未将任何其他暂存内容混入本轮，提交后只批量对齐本轮17个index entries并核对原其他集合。
