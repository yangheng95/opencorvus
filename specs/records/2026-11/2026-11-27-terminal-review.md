# 真实核对命令的终端记录与搜索

## Recall

- 用户要求本人持续迭代，不使用子代理；每批调查和影响分析先落盘，再修复、真实桌面交互/截图人工复核、聚焦正向检查及精确openai/gpt-6.1-sol流式验收，提交、普通合并上游、正常推送后继续。已有配对凭据和完整模型目录获授权，请求不限；不创建分支/工作树、发布/标签或其他线程，不操作用户窗口/进程。
- 上批d575ef493f85b70adda49d5ecbc46f9777f549e8已在真实远端核实，本地/上游/远端一致0/0、暂存空，原177项状态保留。原push句柄89981已经退役，最终join输出在上下文截断中未保留，不编造退出码；未重复推送。run62/63全部8条流EOF（End Of File，流结束），服务退出、配对副本退役、自有标签关闭。
- 已读07-panel的不可变terminal@1/本地搜索合同、TerminalArtifact、SearchField、artifact-export、publish-interactive-artifact及schema（结构），检索全部terminal@1、主题、搜索和样式入口。当前只存在一个xterm渲染器，搜索走原生SearchAddon；复制选择或去ANSI（American National Standards Institute，美国国家标准协会终端控制序列）原文，下载完整去控制序列的txt。终端记录只读，不是可执行系统终端。
- 隔离项目23文件及2091旧持久行（352消息/1056部分/330请求/330结果/23产物）已逐个保护；旧行完整基线留仓外。使用原sales.csv与table-review/source-files.csv，不新造业务数据，不改已有文件、样本Git状态或执行分派单元。已有受保护pyc文件，真实Python命令必须带-B避免改写。
- 继续使用computer-use与benchmark-debug-template技能；界面自动化测试示例不适用，严格只做真实手动语义操作/截图人工复核。不得以DOM（Document Object Model，文档对象模型）、构建或控制台无错误代替视觉验收。此前浏览器安全策略拒绝本地file导航，不能改用其他浏览器传输绕过。

## 调查、影响与未知

- 当前没有证据确认新缺陷，禁止为凑修改而改终端。静态路径显示文本输入调用增量findNext，按钮调用下一匹配；SearchField已有onSubmit合同，Terminal尚未传入。回车是否符合实际交互及是否被外层表单接管，须真实体验，不凭缺少属性判定。
- 生命周期为onMount创建Terminal/FitAddon/SearchAddon、写入不可变output、观察尺寸和当前主题，onCleanup释放。搜索、选择、滚动属于渲染器本地状态，不改变持久输出。潜在影响包括终端记录可读性、跨行/多匹配搜索、清除、展开/收起、主题/语言、复制与完整下载。schema、命令执行器、任务调度、工具消息及数据格式没有计划变更。
- 未发现调度/队列/唤醒/恢复/并发或终态异常；如发现立即按所有生产入口、Task/Mission/Session occurrence（执行轮次）、正常/终态、重试重启、串并行/多项目隔离横审，不凭最后状态或模型自述归因为偶发。

## 实施前任务和验收方案

1. run64从正常退出run63复用隔离项目，启动真实开发模式/ui/，分别验证凭据可用、目标模型目录投影和实际请求精确Sol且stream=true。
2. 在项目首页真实输入框要求执行只读Python核对：从现有sales.csv精确计算5笔/35.60、华东3/28.25、华南2/7.35，并逐行输出现有53行来源清单。命令-B/-X utf8，不写文件或创建分派执行单元。将该命令真实标准输出/错误和退出码发布一个terminal@1；发布原文必须与真实工具结果相符，不能模型编造日志。
3. 本人原生操作查看首尾/滚动、搜索多处实际关键词、下一匹配、Enter、清除、展开/收起、中英与明暗、复制/下载。保存与当前区域绑定截图并实际查看。下载以实际文件和完整数据checker（检查器）核对，不用下载事件超时替代文件证据。
4. 发现真实问题后，先补齐可观察现象、直接触发、控制/数据流根因、旧路径遗漏原因、所有定义/调用及公共合同/测试/文档/交付风险，必要时读权威原生API（Application Programming Interface，应用程序接口）合同，再实施唯一当前路径修复。UI（User Interface，用户界面）修复不新增或运行界面测试；非UI改动必须聚焦正向输出契约测试。
5. 新bundle需另起开发服务，重新真实复验。核对正式工具/产物API、源文件/旧行、SQLite完整性及真实下载，清理自有服务和标签，更新文档索引/检查；范围清晰提交、fresh fetch/普通merge/审查全部待推送集合/正常push/join并确认远端及原状态后继续。

上述为实施前计划；下文按实际证据记录结果。[证据目录](../../artifacts/2026-11-27-terminal-review/README.md)

## 真实复现与实施前根因/影响分析

- run64开发服务52768三项预检通过，真实项目首页session `ses_hq0kPwaXIYesZXn5rRE7`完成read/read/bash/publish四工具，finish=stop；8次精确Sol流式200全部settled/eof。真实命令退出0，计算总计5/35.60、华东3/28.25、华南2/7.35，逐条检查53行kib=bytes÷1024并原序输出。正式工具输出、发布payload及实际原文一致性另由数据checker核对，不依赖模型自述。
- 搜索缺口：真实展开终端，输入Conversation定位第32条Conversation.tsx；原生Enter后新截图仍高亮同一条；点击“下一个匹配项”后新截图实际高亮第33条ConversationAgentRail.tsx。直接触发是搜索输入的Enter，原因是Terminal只绑定onValueChange和外部按钮，未把已有findNext接到SearchField公开onSubmit；SearchField只在有onSubmit或外层form时接管Enter。不是SearchAddon失效。旧clear修复只关注清除，旧ANSI修复只关注控制序列纯文本，均未覆盖该键盘导航。
- 信息栏溢出：同一真实长命令下，截图显示工作目录/命令但退出码被窗口右侧裁掉；只读几何诊断确认父body宽1118.67，而其唯一隐式grid列及meta宽7112.34，退出码起点x7779.97。meta作为grid item（网格子项）仍为min-width:auto，长单行命令的内容最小宽度撑大隐式列。code自身已有min-width:0/ellipsis，但父轨道已变宽，故该旧局部收缩无效；xterm FitAddon也因此按超出实际窗口的空间计算。根因是尺寸约束传递，并非output损坏或终端读取错误。
- 已全仓审计TerminalArtifact唯一生产入口InteractiveArtifactPart、同类SearchField的onSubmit合同及所有meta/body样式；meta选择器只服务Terminal。其他Table/Code/Tree等也复用展开grid，但各自局部宽度/滚动合同不同，当前没有它们溢出的真实证据，不扩大修改全局body或所有产物。只读原文下载/选择复制、发布schema/工具/持久格式、语言键、数据源和调度无计划变化，无迁移、无host（宿主）路由或第二状态源。
- 实施决定：SearchField直接onSubmit={findNext}复用同一原生SearchAddon，不另写keydown或匹配器。Terminal专有meta设min-width:0并改两列grid：工作目录占完整首行并允许任意长路径换行，第二行是可收缩命令和固有宽度退出码；命令保留原文并用原生title提供完整内容。只改专有选择器，不改共享body。CSS（Cascading Style Sheets，层叠样式表）[Grid自动最小尺寸合同](https://drafts.csswg.org/css-grid-2/#min-size-auto)及当前安装SearchAddon0.16.0的公开findNext定义已核对。风险是信息栏多一行减少日志高度、长目录折行、展开Fit尺寸变化；必须候选真实复验行内/展开、首尾滚动、多次Enter/按钮、清除、明暗/中英和全文复制/下载。纯UI修复不新增/运行界面自动化。

## 首次候选发现的复制缺陷与实施前修订

- run65候选51393真实行内和展开退出码可见；输入Conversation后连续Enter实际高亮第33/34条、按钮第35条。首个方案已证明修复两项现象，非UI自动化断言。
- 真实搜索华东→点击清除→点击复制文本，剪贴板实际只包含“华东”6字节；完整4351字节下载成功。数据checker预期完整62行复制时明确失败，不能以下载成功掩盖复制失败。原始错误剪贴板留仓外保存，后续正确结果另存。
- 根因：SearchAddon以xterm原生selection（选择）定位匹配；现有空查询分支只调用clearDecorations。已安装0.16.0公开类型注释声称该方法也清除选择，但实际实现只清除装饰/结果缓存，原生selection保留。ArtifactFrame复制供应器按terminal.getSelection()优先，所以查询已空仍输出旧匹配。旧清除修复重在输入事件和装饰，未做“清除→复制全文”的真实往返。不是输出、剪贴板编码或下载序列化损坏。
- 影响仅Terminal本地搜索选择及后续选择优先复制。对同一组件全部findNext/clearDecorations、SearchAddon实际findNext/_findNextAndSelect与SearchEngine及复制供应器调用已审计。现有xterm6.0.0和SearchAddon0.16.0的公开findNext对于空term沿原生有效性检查清除selection和decorations；无需另写选择状态、解析日志、匹配器或修改库源码。
- 修订方案：onValueChange对所有输入（包括空值）直接调用同一个search.findNext(value, incrementalOptions)，删除不完整的空值clearDecorations旁路。按钮/Enter仍仅在有query时向前。主题重刷原路径保留。新增真实复验必须验证清除后全文62行复制、有效搜索后的选择复制、清除后原始4351字节下载和明暗/中英。纯UI改动不新增测试；重新构建、另起run66复验，run65不得冒称最终候选。

## 最终实现、真实验收与边界

- 产品改动只在TerminalArtifact的SearchField提交/输入路径、命令原生title和终端专有meta样式。没有修改共享ArtifactFrame/body、SearchField、xterm库、发布协议、下载/复制供应器或持久数据。架构同步当前唯一行为。类型、最终构建53.16秒/renderer公开表面通过，原句柄70932退出0；CSS检查首次误从根目录调用未声明脚本后，按packages/overlay的实际package声明重跑通过；文档353操作/26组、架构20文档通过。不新增/运行界面自动化。
- run66新服务54187加载最终bundle，7张最终截图本人逐张人工查看，另保留5张原始发现与6张中间候选截图，明确区分首次候选未修复制问题的范围。原生行内/展开工作目录、命令省略及退出码0同时可见；未修改原始命令。真实滚动到第53条InlineToolPart.tsx/27225/26.5869140625及末行“清单总行数：53”。
- 最终候选输入Conversation，连续两次Enter实际高亮第34条ConversationArtifactInspector.tsx，按钮继续到第35条ConversationArtifactSummary.tsx。关闭展开、切深色和英语后查询保留，继续Enter实际推进第32→33条；产品终端/搜索/下一匹配/退出标签随语言更新，作者中文正文/路径保留原文。当前匹配沿原生主题重刷行为，未伪称主题切换保持相同匹配索引。
- 选择复制仍返回真实“华东”。同一搜索点击清除后复制，中文/浅色实际剪贴板完整62行，与发布原文在平台换行表示归一后一致；英语/深色清除复制也为完整62行。原失败6字节“华东”单独保存，不覆盖成通过记录。清除后的最终截图和真实第53行证明页面与复制均回到完整记录。
- 查询活跃时实际菜单下载`销售与源文件清单｜命令核对记录 (1).txt`4351字节，逐字节与实际命令stdout及正式payload一致，62行/53条源清单完整。原生CRLF在native-download.zip成员中原样保存，同时提供可读文本；Git文本换行规范化不作为功能门槛。源清单每字段/原序与两区域金额均经真实数据checker核对，非模型自述、静态UI文本断言或无效源码摘要。
- 正式read/read/bash/publish全部completed，finish=stop，实际产物API与持久payload一致；23保护文件、2091旧持久行、样本HEAD及SQLite完整性通过。run64/65/66共12条精确Sol流式200全部settled/eof，服务排空正常退出、原句柄29527/4396/40859均退出0，配对副本退役，自有标签938/942/948关闭。没有调度/队列/恢复/执行轮次异常。
- 本批为桌面只读终端产物路径，未验收移动端、外部可执行终端或Office。没有更改全局产物布局；其他产物独立的网格宽度合同未作全面视觉声明。只做源码/构建之外的真实页面与实际文件往返验收，不将辅助控制台error=[]当视觉证据。

## 交付

仅暂存两处产品文件、07-panel、记录/证据及三个索引各一条链接，保留原177项工作区状态。正常提交、fresh fetch/普通merge、审查完整待推送集合、正常push并join原句柄、核对实际远端/本地/上游及原状态，仓外保存交付收据后进入下一批。不提前宣称尚未发生的推送成功。
