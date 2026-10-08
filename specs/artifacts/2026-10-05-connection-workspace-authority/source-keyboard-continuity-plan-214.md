# 214 Sources 跳转后的连续键盘与侧面板调查

## Recall

用户持续要求自主体验与修复 Sources、Rendering 闪烁、UI（User Interface，用户界面）及功能；最新明确只用单 agent，旧goal文字中的Astra委托已被该要求取代。上轮969c4cda已推送，工作区开始干净，213长真实两回合修复End虚拟重测量，8个实际GPT-6.1 Sol流式200/EOF（End of File，流结束）及Native0，原212 UI和503资格失败保留。

新线索来自213原观察：从Sources URL焦点CtrlEnd挂载尾卡后activeElement为BODY，随后验收以locator.press先聚焦chatScroll再Home，没有证明连续原生按键。必须先真实复现，无焦点注入或改变起点来掩盖。Side Chat及子面板的当前End时序尚未完整复测。此次操作隔离页面；用户页面23及所有不属本轮服务保持。

## 深度、资料与影响

已读213方案/结果、现行07共享阅读/键盘合同、dom-utils归属/编辑/嵌套框/跟随控制、Conversation实际VirtualizedConversationCards定义/调用/测量与pin入口，以及SideChatPanel共享controller初始化和canonical inherited消息分组。全仓搜索焦点、虚拟item及测量定义，虚拟窗口在Conversation.tsx而不是独立同名文件。现有pin来自historyAnchorPinID，尚未知主动焦点被卸载时是否有独立保留机制；BODY只是线索，不直接作为根因。需要同一个真实Source A CtrlEnd→CtrlHome→End连续输入、稳定截图和current DOM（Document Object Model，文档对象模型）观察，区分浏览器本身导航、虚拟卸载与owner丢失。没有调度/并发异常证据，后端修改不预设。

UI可观察失败出现后再补定义/调用/公共合同/数据/历史方案/测试/风险完整分析，更新本方案后才改生产代码。新End当前共享三个caller；不能把Main通过外推Side Chat/child。原213保存真实长6消息/2 Source且已全闭合，可以完整新runtime副本查看完成态初次未测尾卡及连续键盘；Task153完成原历史用于child另行fresh scope，不能新增agent或复活原Task。

## 隔离调查方案

先验证原213精确Host/Target出生身份已死亡、原端口已释放、两个凭据副本已清理、生产physical/output/request完整。只读原库全表/Project/Session身份与可执行队列/轮次安全资格，所有真实runtime文件完整复制到fresh214，不只取消息子集；不改Project/Session/Part ID、原project目录或终态。两库所有表实际行内容直接比对，不使用哈希替代完整性。原有Task专用copy/launcher不会接受Chat伪装Task；本轮私有工具只使用当前真实Session选择，复用相同成熟Native Host/公共shutdown及原归属检查，明确scope/合同，不改生产平台或建立并行产品配置。没有auth/models复制、模型请求或重新运行原Task。

实际当前build资产main-Bg2eNYXQ；开发模式http://localhost:18134/ui进入已完成真实213会话。原生输入前后观测，保存并亲自看截图，不新增/运行UI自动化测试。所有输入通过CUA（Computer Use Automation，计算机界面操作）工具，不script改状态。先完成main连续键盘及Sources读图，再进入真实Side Chat已有/合法fork视图调查；是否发模型请求须根据实际数据另开完整授权配对scope，不在credentialless回放发送消息。child另用原153完整副本，不因为旧证据存在就宣称当前测试完成。

每scope固定原生总期限，不因观察超时重启/延长；准备好再启动。自己页面关闭、唯一public shutdown、原父工具、独立出生/端口/pair闭合，原失败/不足证据保留。生成FFI（Foreign Function Interface，外部函数接口）debug文件按本轮精确出生时间单文件移到私有忽略目录。文档三索引/当前docs检查、范围提交、fetch/merge上游/完整待推送集检查/正常push，持续目标不标完成。

## 214 实际失败、完整根因与修复前决定

当前完整213副本90表逐行相等，schema drift无、Task/dispatch/mission/provider/tool/publication/delivery待恢复集合为空，两个原Project终端无需重生成；原namespace/目录/消息ID保持。私有原Task copy的精确SQL引号替换和已归档settled文件命名曾准备失败，尚未copy/start；先修正为原runtime生产settlement唯一路径及真实Session身份选择，原记录保留，没有降低closure/完整行比较。原native父34094仍当前live，固定15分钟deadline1791501759365，自己page29。

23:08:21实际Source A在chatScroll内，CtrlEnd后首assistant卡卸载，active BODY，真实尾9092/height9727/client635/followtrue。23:08:25不重聚焦原生CtrlHome短暂top0但follow仍true，23:08:32重新拉回9092；同scope仅作为独立对照的owner焦点CtrlHome稳定0/false。故原因是原生焦点所属虚拟item被卸载，后续按键已不经过owner keydown；不是modifier未识别或End几何修复无效。截图和JSON都保留，不以BODY标签单独推论。

全仓VirtualizedConversationCards/pinnedCardID/keepMounted及focusin/out搜索，当前只有Conversation本地虚拟窗口使用virtua，已有keepMounted仅保留历史加载anchor；SideChat和child不用这个虚拟窗口。本地virtua0.49.3实际声明与实现确认keepMounted同可见range合并indexes，现有API（Application Programming Interface，应用程序编程接口）适合保留正在键盘使用的item。查阅[virtua官方仓库](https://github.com/inokawa/virtua)及[MDN focusin](https://developer.mozilla.org/en-US/docs/Web/API/Element/focusin_event)；实现判断以安装源码为准，不升级依赖。

修复仅Conversation的虚拟渲染策略：来自真实focusin/focusout的当前顶层virtual item ID与当前historyAnchor合并到同一keepMounted indexes，去重并限制当前实际存在项；最多额外保留焦点item和历史anchor。退出item、移到编辑框/侧栏、换scope或卸载时现有native事件/生命周期收敛，焦点不是新的消息事实来源。监听只在当前container，cleanup移除；focusout直接用relatedTarget衔接到新item，避免转到同item时先释放造成卸载。无强制focus、全局键盘代理、preventDefault、新增计时器、抑制虚拟化或复制转录状态。真实sources/Tool内部输入/历史anchor现有交互不改。

风险是最多多保留一个大正文DOM，按当前真实焦点限定；不存在id不固定，历史anchor功能仍同源Set去重。新恢复/异步Session切换与其他平台未知，需实际行为验收，不扩张为调度改动或宣称SideChat/child通过。纯UI变更禁止自动化测试，当前types/build后只reload自己page29到新资产，完整连续原生Source A→CtrlEnd→CtrlHome→End，不以locator.press重新聚焦；编辑框/合法离开焦点与Sources展开读图复核。版本不改，不发布，07补公开虚拟焦点合同；成功再逐步调查SideChat/child余项，期限内先闭合自己scope。

### 214 焦点交接再调查

首修75568 types0/94549 build0/49.21s，新main-CepKGnNz真正page29原生连续End/Home/End通过，原Source A一直保留，Home稳定0/false，尾9092/true。随后真实Tab却落BODY且焦点item释放；不能把前三步通过当整个连续键盘完成。当前事件序列/relatedTarget未知，先只在同一onFocusChange临时输出event target/relatedTarget/active owner和当前focusedItemID的元数据，并记录微任务后的实际native activeElement。只读观察不移动focus、不干预默认动作，不记录正文或凭据。实际新own页面复現同一Tab及console序列后再判定直接释放是否在native handoff完成前卸载下一控件；诊断代码最终全部删除，不能留下平行焦点修复或以延迟试绿代替根因。原当前Tab失败和成功矩阵都保留。Side Chat创建原HTTP400明确ProviderModelNotFoundError，credentialless真实catalog未投影，未产生新模型请求；该限制不记成用户auth缺失或已修复产品bug。

### 原生序列证据与最终实施决策

23:15:55.945–.946Z实际focusout relatedTarget是同item的MDN Tool button，随后focusin正确保留同ID；.949Z才button focusout/null并清空，排除了首个交接提前清pin假设，禁止加猜测性的微任务恢复。actual候选元素为work-details-toggle，CardParts只有click开合而没有focus阅读，Button是原生按钮；全源blur/Tab处理没有该按钮的额外键盘代理。same Tool在已暂停的Source A后Tab，23:18:16仍保留BUTTON/owner、top448.666/followfalse，证明跟随中的控件焦点阅读意图缺失。当前共享controller没有focusin，只有SourceParts的四处Source叶焦点触发暂停；普通Tool焦点后仍true，测量/既有frame持续拉尾。该后续Tool DOM失焦精确内部删除时点仍未知，不以元数据给它推测新缓存根因。

最终同时补共享真正阅读输入：setupAutoScroll统一接收自己owner内真实后代focusin并复用现有清理意图/暂停跟随函数；owner自身focus保留导航语义，其他owner不接管。SourceParts四处特有focus暂停删除，Source URL/file/document/excerpt都走同一共享native输入，pointer/click阅读仍现有事件，避免保留双焦点路径。三个现有controller消费者不换接口。Conversation只保留原focus pin，无微任务恢复；全部临时console诊断删除。现行07明确通用控件焦点阅读输入。types/build后完整连续End/Home/End/Tab、Sources展开与编辑caret实测；当前Side Chat/child通用focus矩阵若未完成明示，后续实际流式资格另轮。固定原214 deadline仍不延长，原失败及诊断事实保留。
