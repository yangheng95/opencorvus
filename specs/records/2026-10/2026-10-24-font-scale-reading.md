# 字体缩放后的正文阅读位置

## Recall

579延续用户单agent自主迭代、Sources/Rendering优先、实际页面验证及提交推送的长期要求。最新“只在冲突的时候等待”持续适用，不委派、不操作用户18571或其窗口/库。578布局修复544058b18已提交，25自有文件/17图，真实100→160%自动让出左栏、160→80→100恢复偏好，键盘范围主区500、中英默认页与加号Goal表单实际查看；三个原生scope全部物理闭合、零Provider、完整原90表207330字段时间保持。中间因并发DDL缺迁移失败保留，最终当前checker7通过后隔离6→7正常启动。778修改后视口未获得，不冒充该尺寸验收。

当前正常push被并发后台schema新增owner_unresolved而两个公开projection类型尚未同步拦住，TS2322分别automation-projection170与event-projection449。不改另一会话正进行的公共协议/SDK，不绕过hook，只对这项真实冲突等待，独立overlay继续。保留无关171删除、后台Channel/Event/Automation/Worktree/schema7/API改动及缓存目录，不建branch/worktree。

已读578/552 Recall与实图10/11，当前07-panel/07-panel-reactivity，SubagentConversationScroll完整position保存/激活/宽度恢复、Side同调用、setupAutoScroll输入与ResizeObserver/restore完整路径、conversation-reading-anchor工具字符/正文块/来源分支、Slider现有Kobalte primitive和TitlebarMenubar缩放写入。全仓搜索capture/resolve/readingPosition/viewport变化与相关合同；未发现本次触及路径UI自动化，不增加运行UI测试。沿用computer-use、benchmark-debug-template，真实原生 `/ui`、截图与人工复核。

## 修改前深度与影响分析

可观察现象：578图10来源与前后正文可见，后续160→80→100字号往返，图11已读到final表格/列表；没有先固定首个可见字符，因此只能证明有新线索，不能直接判定Source或锚点已故障。原高频Rendering仍未知，不将字体缩放位置误判为Markdown owner退休。

触发候选：Markdown正文锚点仅message/textIndex/blockIndex加整个块的像素offset，长段落重新换行、行高变化后可能保留块顶而丢失正在阅读的文字；工具payload已在552用TreeWalker/Range保存字符偏移，正文没有使用这一能力。source分支只有此前选中/聚焦的来源且仍可见时优先，未聚焦来源下方之前可能选到长段落。控制器仅clientWidth变化触发onViewportResize，只有字号行高改变而物理宽度固定的组合尚不明确。保存会抑制尚未处理宽度变化及restoring期间的布局scroll，但字高变化是否被覆盖仍未知。

该共享能力由Main（含虚拟消息定位）、Side、成员三处调用。类型当前是UI内存，不写schema/API/持久消息；若确认修改，必须全仓同步类型/解析调用并复用现有字符Range primitive及单一scroll writer，不能加平行锚点、计时器、keyword或隐藏真实内容。没有发现新的后台调度/队列/终态异常；若出现则按全共享入口审计。风险包括长Markdown、表格/代码、隐藏details、Sources焦点、虚拟历史定位、字号变化通知，以及restore取消/真实用户滚动抢占；不能以局部截图推及全部。

## 实际调查与验收方案

本批先不改产品，原578最终生产UI上仅私有被动观察：生产capture/resolve仍原调用，记录其真实anchor、物理宽度、已应用scale；对当前text块用已有captureTextReadingAnchor额外读取首个可见字符偏移，写诊断属性。属性不改尺寸、内容、滚动、事件或状态，不参与ResizeObserver；不增加UI测试或DOM断言，人工读取属性只能支持截图结论。

从已闭合577完整90表207330行/schema6与原canonical/PNG复制fresh隔离scope54067，按当前已通过的registry7正常迁移目标；复制完整models，不复制auth，Provider预算0，原Task/原B继续只读，不创建业务或模型请求。当前Node正式私有诊断构建由项目原生服务 `/ui` 提供，不单启Vite。20分钟原生资源边界、至少五分钟提前公开shutdown，180秒启动无活动；全部exec/native/launcher/physical/output/request/出生链闭合，catalog清退、源全字段/时间/字节mtime/配置保持，目标迁移变化单独记账。

真实页打开原B，实际滚轮读到长段落中部，记录当前真实anchor与首字；截图后用现有View缩放到160/80并回100，人工检查同段同字符与来源边界。不将菜单已换页或首次加载帧当稳定读位。另在真实Source聚焦后复验其同宽度变化；根据第一次真实失败补齐控制流根因与影响方案再实现。End后菜单切换需区分按键传播与字号改变后的指针hover，不能先加事件拦截。未复现或覆盖不足如实保留。

本批先读证据再决定产品补丁；完成当前文档检查、范围提交、fresh fetch/merge/完整待推送集合审查与正常push。578公开类型冲突解除即重跑原push链，不等另一个会话整体完成。

## 真实复现与实施决策

私有诊断构建main-BxC0dIy1.js完成68秒，未改变生产capture/resolve结果；启动前曾因并发global_creation_allocation DDL与registry不一致被内存checker拦住，未启动数据库/进程。其修正后checker7通过便启动原生54067。另两处projection类型已收敛，578重跑正常push越过全部类型检查，当前卡在新增worktree.recovery_preserved事件尚未同步的OpenAPI，未绕过或生成混入其他会话接口产物。

实页252在原B的真实ReConcile长段落中部，实际滚轮使following=false。图01记录msg_g0VYn1Dr400aVXO3GoJ3、textIndex0、blockIndex1，旧块offset=-151.046875，生产字符定位读到textOffset208、字符offset=-7.953125，宽380/高576、top20314、scale1.000。实际View字号End到160，图02已回到标题和作者部分；相同Message/块offset仍-151.09375，首字却为106、offset2.46875，宽448/高440、top41621。resolve原输入仍旧块offset=-151.046875，说明共享恢复执行了，但恢复的是整个段落块的像素位置而非读者正在看的文字；不是缺失消息、来源或模型内容变化。

全仓确认text锚点只有该共享capturer构造，Main/Side/成员用同一resolver，Main虚拟定位仅依messageID并可保持。复用当前captureTextReadingAnchor/resolveTextReadingTop：text分支新增必需textOffset，offset改为该字符行相对scrollport的偏移。捕获当前可见块时仅在同message/textIndex/blockIndex的上一字符仍可见时保留它，否则从实际首个可见字符重捕获；Source身份与tool-payload现有合同保持。解析text和tool均用现有Range字符定位，删除旧text整块offset路径，不留双路/fallback。此类型只在当前UI内存中，不需旧持久化协议兼容或数据库迁移。

同时shared setupAutoScroll应将viewportHeight纳入它已有width测量和hasViewportResize判断：字体缩放会改变header/scrollport高度，即使用户持久化Dock宽度使clientWidth不变，也要进入同一restore回调。沿已有ResizeObserver监听scrollport，不加Observer、计时器、全局zoom状态或第二scroll writer。following=true仍按原底部锁定，真实用户输入仍优先退休restore；隐藏0尺寸不作为新有效几何。Main默认回调保持虚拟历史owner。

采用[CSS Scroll Anchoring草案](https://drafts.csswg.org/css-scroll-anchoring/)仅作背景：其按锚节点几何调整，不能用浏览器节点锚定证明块内字符稳定。字符Range能力已在552工具输出实页验证，本次复用，不发明新算法。当前尚未获得修改后截图，实施后必须fresh scope按同原文和真实动作复验，再测持久化宽度下的小字号变化、Source焦点。独立Side/Main未实际进入前不得泛化为全端到端通过。

本轮End前实际点击slider，让指针离开顶层菜单后，End到160仍保持View；此前换到Edit与指针位置相关，尚不能判定为键盘传播故障，不加stopPropagation。初次启动恢复期间成员打开操作没有留住Dock，恢复完成后同入口正常；未取得该次控制流证据，作为独立初始选择线索保留。

before已公开shutdown200、原exec93775/native/launcher exit0，提前882027ms，physical/output/request/精确出生链闭合，catalog退休，页252关闭，零Provider。关闭后90表207330原行/字段/时间/源字节mtime/canonical保持，目标当前迁移7新增事实单独保留。再修改两个UI utility与现行架构，不修改后台数据实现。

## 修改后实际复验

最终私有诊断构建main-DVohYl6w.js完成57.81秒，overlay typecheck exit0。fresh native54068、页253，在任务恢复/模型提示完成后打开原B，真实同一段落点击及up0.1/down0.4滚轮：与before完全相同Message/块、top20314、character208、offset-7.953125、380×576、scale1。图03作为真实同条件基线，不通过源码或文字断言代替。

图04实际End到160后anchor.textOffset仍208、offset-7.96875，448×440/top41782；原始resolver输入208/-7.953125、输出top41781.984375。当前首行自然从字符204起，208仍在该行；不能把换行后行首必须相同当合同。旧图02则首字106，确证修复保留的是正在阅读的字符，非仅整段起点。

随后实际160→80→100、右分隔条左/右键保存380px偏好，再从100→105：图05仍width380，height576→569，字符208保持，offset-7.953125→-7.6875（整数scrollTop舍入），证明新增高度通知实际进入同一恢复路径。图06真实复制Tabs来源显示Copied并聚焦，Source原身份与offset271.75；图07放大到160后同身份offset271.640625保持、来源实际可见。未改copy writer、Source事实或焦点协议。

未新增或运行UI自动化。诊断属性仅人工读取真实生产capture/resolve元数据；没有把JSON数值断言当视觉测试。七图均实际显示并人工查看。Main虚拟历史、独立Side、专用code/media/disclosure、极短视口和778实窗未独立复验；当前修复的共享合同明确，但这些场景的视觉资格保留，后续继续。原高频Rendering根因仍未确认。

## 数据、生命周期与交付

两个scope均零Provider、没有auth；before公开shutdown200提前882027ms、原exec93775/native/launcher0，after提前857464ms、原exec57636/native/launcher0；两套physical/output/request/精确出生进程链闭合、catalog各清退1，页252/253关闭。真实原生HTTP/生产parser核对原B33消息107 Parts9来源、plan1517与final1775字及原PNG200/643字节；关闭后完整原90表207330行的所有原字段/时间、源字节mtime/canonical保持，源6、隔离目标7/integrity ok。当前未提交migration7新增字段和6221原发布owner行单独记账，不混入本UI提交，迁移1–7均未改动。

初次normal push544越过全部类型检查后被新增Worktree事件未同步OpenAPI阻塞；该接口属于另一会话活跃改动，当前不覆盖其生成产物，不绕过hook。本批提交包括两个UI utility、当前面板架构、本记录/七图/evidence和三索引。fetch/merge后审查全部待推送集合（544布局与本读位修复），契约收敛即重跑正常push，未完成推送不得宣称已推送。其他后台工作、171无关删除与缓存目录保留。
