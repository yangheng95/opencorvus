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
