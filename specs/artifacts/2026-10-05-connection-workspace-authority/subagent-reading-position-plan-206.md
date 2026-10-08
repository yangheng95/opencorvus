# 206 子侧栏切换后保留 Sources 阅读位置

## Recall

用户原始要求持续迭代UI（User Interface，用户界面）、Sources显示和子agent侧栏Rendering，最新指示只用单agent。当前HEAD2f63b697；205已完成原153完整90表逐行一致副本、当前生产serve与真实子侧栏，原页面18和自己的服务已关闭，原父工具95979/Host/Target/native整体自然0，原始事实未重判。普通Sol新Host未验，205未使用凭据或创建新模型请求。

205实际截图覆盖浅色/深色、原explore三份无摘要Sources、第一份展开/折叠、键盘完整title/URL/来源Tooltip（悬浮信息），切换真实tester再返回researcher。正文返回截图完整，没有在该采样复现重复Rendering；这不能替代流式/长摘要/更多会话矩阵。

**新明确失败**：researcher-before-switch-facts.json为top0/height2908/client577/follow=false，24段/3标题；researcher-return-facts.json返回同会话、相同Source展开状态和24段/3标题/height2908，却变top2330.666748/follow=true。researcher-return-immediate.jpg显示末尾，来源阅读被打断。来源是同一个ses_hMlVNrRdOLxQf4XhSds7，不能把完整正文缓存通过包装为阅读连续性通过。

## 根因与影响调查

已读SubagentConversationPanel.tsx全部请求/权限scope（范围）/资源/显示/滚动代码、dom-utils.ts当前初始化/观察/输入归属/cleanup、Conversation.tsx和SideChatPanel.tsx的全部setupAutoScroll调用、main.tsx唯一子侧栏挂载位置、当前07-panel-reactivity合同。全仓搜索setupAutoScroll仅三调用者，SubagentConversationPanel仅main.tsx调用，服务targetKey已经包含API authority（接口连接权威）、source（父Task/Session）、sessionID、directory。未发现已有跨会话阅读位置事实源；不能建立第二消息/转录实现。

直接触发是SelectControl选择子会话：requestKey变化导致displayedConversation暂时缺失，Show移除SubagentConversationScroll；新资源到来重新挂载。滚动组件tracking信号初始true且on(sessionID)重设true/scrollToBottom；共享setupAutoScroll初次rAF（requestAnimationFrame，动画帧回调）无条件到底。旧196只保留了完成Markdown编译结果和当前owner输入归属，不能保留已退役滚动owner的阅读意图；因此正文完整而位置/follow丢失。

影响面至少包括子会话切换和All agents列表返回；面板active/隐藏/关闭的组件生命周期仍须核对main挂载后再决定合适的唯一UI状态owner。跨API连接、父Task/Session、项目目录、重复会话轮次必须按现有targetKey隔离。流式内容增长、用户向上暂停、主动向下到尾重新跟随、Sources展开、冷Markdown延迟挂载和不同面板共享滚动初始化需要分别处理，不能靠隐藏Rendering、固定scrollHeight或pin全部行。

## 待实施方案与验收

在核对main的面板生命周期后，选择现有子侧栏UI owner保存每个规范targetKey的阅读视口/跟随状态；状态有明确生命周期及内存上限，不缓存消息或制造平行事实。卸载时捕获实际阅读状态，新owner按原状态恢复；首次访问仍落到最新。共享滚动器需要支持明确初始化意图并维护program-scroll（程序滚动）归属，原三调用者同步使用当前合同，不保留旧接口兼容。冷内容不足高度时应让同一滚动owner完成有边界的恢复，用户输入立即接管；不要引入独立旁路定时器。

UI代码修改前继续核对适用定义/公共合同/调用者，落实具体方案并追加到本文件后才编辑。禁止新增/修改/运行UI自动化测试，遇到的相关旧UI测试按仓库规则移除；类型/build不能替代视觉。实际独立页面复验：researcher停在Sources顶部/follow=false→tester→researcher，保持同身份/24段/3标题、Sources展开与顶部/follow=false；另测中间正文位置、首次tester落尾、主动到底后增长跟随、All agents和面板重开，未知项明列。真实源仍原153完整历史，不合成数据或请求。

截图立即/稳定都人工查看，配准真实子侧栏；使用自己的有限原生服务，结束前汇合页面/父工具/native/端口/凭据状态。docs/范围提交/拉取上游合并/审查待推送集合/正常推送。当前仅完成根因调查、尚未实施位置修复；连续目标进行中，单agent继续。

## 2026-10-09 实施前具体收敛

当前HEAD27f6b8c1/origin相同，工作区干净。上一目标回合完成实际页面/失败证据与交付，属于有进展；本轮直接实施。已补读main唯一挂载和ui/Tabs.tsx：TabPanel透传Kobalte Content的forceMount而未给subagent设置，切换tool tab会释放该owner。因此用现有forceMount明确保留子侧栏外层UI owner；inactive时现有requestKey=null/abort仍停止转录加载，不保留隐藏转录DOM。

唯一阅读handoff（交接）状态位于这个SubagentConversationPanel，按现有完整targetKey记录top和following；至多32个最近会话视口，父owner释放即清除。它只保存UI意图/几何，不缓存转录、消息或派生领域状态。滚动owner在scroll/跟随变化/cleanup捕获最新意图，重新挂载从同key恢复，首次访问仍跟随尾部。改成按targetKey keyed（身份键）挂载滚动owner，删除旧session effect无条件到底路径。

共享setupAutoScroll新增必填initialPosition联合合同bottom/position；三当前调用者同时改为明确意图，Main/Side Chat仍bottom。位置恢复由同一现有contentChanged/ResizeObserver/帧调度完成：内容高度不足时保留目标并在增长中恢复，到达即释放；所有属于当前滚动器的wheel/key/touch/pointer和Source阅读输入立即取消待恢复，原程序滚动归属继续有效。无额外计时器/代理owner/兼容缺省路径。恢复帧只处理当前已挂载owner，cleanup后停止。

保存准确修改前差异，补现行07-panel-reactivity，进行overlay类型/build及真实新页面206复核；不创建UI测试。全库准入和旧205自然0记录保留，206用同一个copier/launcher的新fresh副本/端口和新明确清单，不重启或重置205/原153。

首次真实206页面：顶部切换同key top0/followfalse/2908、24段/3标题通过；中段1440和All agents返回也通过。关闭重开却变1040：隐藏使布局先收缩，onCleanup再读取已钳制的位置覆盖最后可见1440。保存逻辑因此明确要求本scope仍active且容器具有可见高度；inactive/列表/目标变化时保留最后真实可见观察，不将隐藏几何写回阅读handoff。原失败截图/事实保留。修正后重新build并在自己的当前页面重新加载新asset复验；同一服务原deadline不延长、不重启。

第二次真实重开仍有890.666687→490.666656位移，故第一归因不足。已读ConversationAgentRail/main实际点击路径，没有子侧栏400px定位写入；workspace.css明确right-dock宽度/flex-basis/max-width存在slow transition（慢速过渡），inspector.css仅followtrue关闭overflow-anchor（浏览器滚动锚定）。恢复第一次可达就释放目标时，pane宽度仍在变化，后续重排/锚定改变了位置。当前修正保留同一恢复目标直到layout owner的宽/高和内容几何连续两帧稳定；已有ResizeObserver同时观察当前right-dock容器，原帧调度处理恢复，不新增计时器或用户输入旁路。position合同必填layoutRoot，由子侧栏规范容器提供；新输入仍立即取消恢复。高度暂不足时只等内容观察，不空转。两次失败与原206自然0保留，新的207独立有限页面再验，不能把前两次样本改写为成功。

## 207 最终观察与交付

最终页面已真实操作并人工查看立即/稳定截图：关闭重开top858.666687/follow=false保持；Sources顶部0、首项展开、24段/3标题、height2908在真实tester往返后保持；All agents中段1440保持；主动向下到尾follow=true。最终脚本main-3EEyiWb9在207原生服务实际请求200，构建51.17s/类型退出0。原父工具20642177/20712435分别退出0，原生产Native exited/0和output/request cleanup均完整，独立精确进程身份死亡、端口/pair闭合；自己的页面19/20已关闭。原153两个Project44/97项lstat元数据保持；只观察元数据，不以摘要替代内容验收。

文档检查345ops/25groups通过，当前实现/场景/失败/限制已落入[证据目录](subagent-reading-position-206/README.md)与月度记录。未增改运行UI自动化测试。流式增长、32项淘汰、冷长内容、触摸、跨连接/目录及恢复过程用户取消仍未知，持续目标未完成；后续单agent。交付创建范围提交、fetch/merge上游、审查完整待推送集合并正常push，禁止通过重新运行覆盖原失败。
