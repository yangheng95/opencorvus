# 253 主阅读区会话返回位置

## Recall

用户要求持续自主体验/修复Sources（来源）和Rendering（渲染）等问题，最新只用单agent。root独立工作，不派Codex子agent或新应用子会话。上一轮252真实Sol/网页验收是进展：3d175d1b43071cd119b720d1078ca6c073ae599a正常推送、起始工作区干净；同正文Part保留真实开始时间、70384ms、7次流式200/eof（End of File，流结束）和原Native/foreground（原生进程/前台命令）实际0。原子Dock（停靠面板）全帧未证，持续目标不缩减。

实际Main来源区scrollTop360，切换已有preflight（启动验收）再返回，同来源/正文/1m29s恢复，稳定位置却为2787.333251953125末尾。原即时空白加载帧与稳定帧分别保存，不能当正文丢失或推断加载耗时。证据见[252实际失败](text-part-time-live-252/live-01/README.md)。本轮修复这一真实阅读意图丢失，不依赖未回复的新增应用子执行范围问题。

已读252 Recall/事实、07-panel-reactivity架构、Conversation主阅读器/虚拟列表/卡片滚动、dom-utils唯一setupAutoScroll（自动滚动基础组件）、conversation-ui唯一UI（User Interface，用户界面）状态、api-state连接授权revision（轮次）、BoardSource（当前源）、普通Session/Task/Mission选择、workspace/连接退出、selected-task-recovery及同一hydrate/历史页路径；Side与子Dock恢复实现也读过。全仓搜索所有clearUi/reset/cancelReplay/hydrate/bottom调用，只有普通Session、Task和Mission共用此Main，无额外宿主方案。

相关现存测试是transport/data（传输/数据）选择、历史路由、compound authority（复合授权）和agent活动契约，没有DOM（Document Object Model，文档对象模型）/组件渲染/截图夹具；本轮不运行这些测试或任何UI自动化。读取误猜文件名产生的缺路径已经使用rg --files找到当前文件纠正，不当作产品失败。

## 深度与共享影响

直接触发：session选择清空UiState、reset/hydrate都bottom；Task切换与初次hydrate、Mission入口、重建恢复也bottom。Conversation以bottom初始化，treeEpoch（内容轮次）bottom会setTracking(true)并滚末尾。数据与模型/物理终态已在252独立证明正常；归因是主reader没有按source保存/恢复操作员位置，不是模型、偶发或正文存储失败。

旧206子/239Side仅保存自己的位置；现UiStore只有展开、来源摘要、Side位置，不能给Main提供阅读意图。API（Application Programming Interface，应用编程接口）authority revision由实际URL/凭据/确认的原生替换产生，目录选择不改变此revision；Task/Session ID在同一后端全局唯一，kind区分两类。bookmark（阅读位置）必须按同一authority/kind/id隔离，退休连接、旧source、加载空几何和隐藏主区不能写入新位置。

正常、运行中与终态共享reader；初次源应跟随末尾，已有暂停阅读才恢复；同源hydrate/replay（载入/重放）不得把暂停变成跟随。重试/重新连流使用原授权与数据入口；确认更换后端或浏览器新生命周期是新view owner（视图拥有者），不复用退休授权的记录。Task/Session/Mission串行选择和快速并行选择的旧响应已有选中epoch/authority fence（轮次/授权界限）；新UI恢复只依赖它们与当前controller对象，不新增业务调度或第二轮次事实。跨Project通过全局真实source ID与当前授权隔离；业务调度、Task/Mission终态、Provider和消息协议不改动。

长历史风险：初次只载入末尾80条（Task入口另有尾页设置），旧历史页会在选择时取消，单独恢复像素值可能对应另一段内容。主位置记录必须同时保留实际可见消息锚点及相对偏移；按现loadOlderConversationHistory加载到这个真实Message后，通过现virtualizer的card滚动使该锚点真实挂载，再恢复相对偏移。记录只是UI坐标/标识，不缓存业务消息或制造历史。无消息锚点的首屏/生命周期阅读保持其本源位置；其长历史矩阵不能由小对话测试替代。

## 实施方案

在现conversation-ui加入最多50条Main位置（实际top/following、可见message锚点/正文序号/偏移），key由同一authority revision与source kind/id产生。它不随普通Primary选择的临时展开清理而清除，浏览器生命周期仍是边界；不另建配置/localStorage协议或第二份内容。主区注册一个同步capture（捕获）回调；现唯一cancelConversationReplay在退休旧历史/选择前先调用它，reset投影也在变更前捕获。只捕获当前可见、已载入且当前授权的真实reader。

Main按source/authority建立同一setupAutoScroll controller；未知新源bottom，暂停记录通过现pending top（待恢复位置）保留目标，绝不把空载入时的clamped zero（受限零值）写成新阅读意图。Tree bottom刷新恢复同源记录；明确Scroll to latest（滚到最新）与实际用户动作取消待恢复并保存新意图。getter（读取函数）返回当前真实已载入历史归属；恢复使用现公共历史loader与virtualizer/card-scroll唯一机制，旧controller/source/authority及用户新动作退休旧恢复操作。

完整分析结束后才修改：UiStore、Main呈现与现conversation生命周期/UI滚动动作桥；不改后端模型/消息协议、Provider配置或runtime状态。若实现证据要求改变方案，先补本spec（规格）并保留原失败，不堆补丁。错误沿现历史载入/AppLog（应用诊断）边界可见，不静默宣称恢复成功。

## 验收与交付

UI只用真实开发 `/ui`、隔离页面、截图亲自查看，不运行任何UI自动化或快照/DOM断言。先新真实普通单会话Sol复核252同类来源区→已有会话→返回、不同各自阅读点、明确跟随末尾；授权凭据同时完整models目录、实际preflight/请求gpt-6.1-sol一致。成熟NativeService固定600000ms、累计12请求，准备唯一退出/原命令join/完整pair/进程端口与原结果归档后才启动，窗口内立即关闭，不操作用户23/18107。

现真实153已完成Task/两个子会话可补Task/Main共享回归：重新只读核对原精确进程/端口/持久状态/配置/全部恢复前沿后，成熟完整复制90表逐行相等，新的无凭据历史Native固定900000ms，不重跑Task或新建应用agent。它不是252同Task，也不能替代新主会话或原ResearchStudio实时子生成。Mission、长历史页和授权更换未获得实际页面时明确保留未达成项，不能以代码/类型支持推导完整通过。

类型/build（构建）、当前docs/架构及必要检查只辅助，不替代视觉。所有原失败/出口保存、精确自身文件归档最后执行；同步根/月/相关README，范围commit（提交）、fetch/merge upstream（取回/合并上游）、完整outgoing（待推送集合）检查后正常push（推送），无分支/工作树/Release/tag/PR（发布/标签/拉取请求）。整体目标保持进行中。

## 当前实施与首个实际范围

现UiStore已有50条Main位置与真实可见quotation-message（引用消息）锚点/正文序号/偏移，唯一注册的可见reader捕获回调在cancelReplay与reset之前调用；Source/authority退休不写旧geometry（几何）。Main按同source/authority构建同一controller，Tree bottom改为载入其既有阅读意图。恢复按真实Message在当前cards及历史页查找，通过现virtualizer/card-scroll挂载该卡片后定位原正文偏移；readingRestore只标识这个UI内部动作，不改业务协议或伪造用户输入。明确用户动作取消pending（待完成）恢复；现AppLog诊断承接真实错误，退休操作不发布反馈。

首类型检查原71562实际0，首build原18577实际0/约1分钟，现renderer public surface（渲染器公开边界）1/1，仅辅助。新真实R2026-10-10/main-reading-position-253-live-01、E main-reading-position-253/live-01、port18187，成熟NativeService固定600000ms/12累计请求。先验一个普通Main与现真实preflight间的Source/阅读区往返，完成后立即关闭，原失败和完整过程保留。Task/Mission/长分页及更多边界没有真实截图时仍明确未达成，不从类型和代码推导通过。

## 首次真实页面结果

实际main--d2TSAAV.js，独立94/18187，真正读取3页并生成指南；15s帧真实Running/跟随，后续59s帧实际已结束，不因“growing”文件名说成生成中暂停。当前来源区318.6666564941406往返后同值，User引用偏移-228.00001525878903、preamble（前导正文）109.09375与最终正文431.3958282470703均保持；第二次正文中段1038.6666259765625往返后同值，最终Message引用偏移-288.6041717529297保持。Scroll to bottom（滚到末尾）恢复following=true、2550.666748046875，往返后同值与true，未旧位置拉回。

全部实际截图亲自查看；一次middle-return合并捕获的图片在工具展示异常，原文件保留，另取main-middle-return-final真实完整截图确认，不用几何替代视觉。新Main普通Session/跨两个Project实际往返通过，初次/终态Source及固定59s正常；生成中切换、长分页、Task/Mission、授权更换/错误恢复尚未实际资格化。

自身94于22:14:36.420Z关闭，唯一shutdown0、原foreground56126实际join0，Target71700/Host74384于22:14:50.431Z正常0、物理/输出/请求/完整auth-models退役与独立读回均0；固定截止1791584343200内，无延长或重启。7个实际请求均gpt-6.1-sol/stream/200/eof，12累计预算内；11464当次日志、未知时间0。继续补共享验证及如实记录未完成矩阵，整体目标未完成。
