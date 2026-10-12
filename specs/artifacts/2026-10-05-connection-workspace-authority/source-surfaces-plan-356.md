# 356 主聊天与Side chat多来源体验

## Recall

用户要求持续自主体验并修复当前版本，主要关心Sources显示与子Dock Rendering；最新要求单agent。355为progress：4e6ddb8ad已推送，同一Task隔离副本真实epoch2恢复成功，37段5499字符完整读取、36Source与旧失败保留；9截图复核状态呈现，全部运行闭合。当前HEAD4e6ddb8ad，git status为空，仍不运行开发子agent或擅自发布/重启用户应用。

重读355 Recall、348/351多来源证据与07-panel来源公开合同；读取SourceParts/SourceEntry/SourceChip、sourceDirectory/openSourceFile、source excerpt的原identity、cardExpanded、clipboard primitive、共享reading-intent事件及SideChatPanel的消息/滚动/连接路径。全仓搜索这些定义、调用和样式。SourceParts已用于Main、Side、child；351明确只完成child 64条来源实际验收，不能自动外推其他区域。当前没有生产bug结论，也没有调度异常。

## 真实体验方案

使用全新本人持有的source-surfaces-356-live-01，2026-10-13目录、18339/ui；沿现有NativeService原生前台监督器运行，固定600000ms窗口，180000ms无活动边界，Provider请求总预算24，所有调用gpt-6.1-sol流式。按原授权复制OpenAI entry和完整models.json，并分别验证凭据、catalog和实际preflight模型；值不进日志/spec/提交。仅测试自己创建的项目与页面。

先创建两份真实只读Markdown输入，各32行SOURCE356命中，两个不同目录下同一个较长文件名；这些是输入文件，不是伪造Message/Part/Source或浏览器fixture。通过真实Web UI在该项目建立普通Chat，让模型使用内容搜索得到实际来源，并输出一段正常解释。随后从该主会话进入Side chat，独立搜索相同输入并按本次真实工具结果回答。开发过程保持单agent，产品中的两个普通会话先后运行，不派遣新研究员。

逐区域实际展开来源、阅读到两文件交界及末行，使用真实点击/键盘复制两目录第20行并核对完整地址，打开实际文件确认第20行内容，然后返回原阅读区域检查来源顺序、展开与位置。检查窄侧栏中的长名称、行号、按钮与提示是否易读；Sources计数必须与当前真实Source Part对应。若发现问题，完成根因与全仓影响分析并在此增补后再修改，使用当前primitive与单一状态源修复。只做实际交互、截图人工复核，不建立或运行UI自动化测试。

实际消息、模型请求、tool request/outcome、Source与session lineage只通过真实路径产生；通过当前canonical读取器核对源文件/行号和全部请求结算。不要以模型自述、raw part表遗漏Tool的查询或UI文本断言冒充功能证明。发现任意调度、队列、唤醒、恢复、终态异常立即按全部Task/Mission/Session入口与轮次、正常终态、重试重启、串并行和项目隔离横审。

结束前关闭自建页面、按原Owner收尾Host/Native/端口/输出/request及auth/models，join原启动句柄到真实exit。超过原窗口保留失败，不延长同一scope。UI若需修复，在新完整历史副本或新真实运行中看正式构建。更新根/月/目录索引、docs检查、范围提交、fresh fetch/merge审查待推送集合、正常push。持续goal active；本轮也不能替代原Research Studio更大数据集的全部验收。

## live-01原始结果与重跑

主聊天与Side chat均真实完成64条搜索来源；4份甲乙第20行复制值正确，两个入口打开编辑器均呈现原第20行，Side返回保持第47–55个来源读点，Side收起时Main仍展开。截图01–12已实际查看。第03张因可访问性点击作用于视口外控件，只能证明当前主列表，不能单独证明复制控件的可见反馈；第04张用实际键盘定位补足该区域。

追加主列表宽度变化观察时已经接近原600000ms硬边界。Native49784/Host53388于16:29:36.861Z以deadline_exceeded/exit1完整物理退出，原launch19753实际exit1、OWNED_QUALIFICATION_BOUNDARY_REACHED；监督器fixed-preparation-maximum收尾，配对凭据已清除。页面152于16:29:46Z关闭。所有原失败事实保留，不把会话已完成或多数截图已取得转换为整体资格通过。主列表的布局读点只取得改变前观察，暂不形成bug结论。

使用fresh source-surfaces-356-live-02、18340/ui复做同样的两个真实会话及来源复制/定位/返回，保留同一600000ms和24次预算，不延长或重启01。正式操作集中在已定义的两个来源入口，新疑点另以其完整闭合历史独立复核，避免在本次已运行窗口追加无界调查。

## 已复现的宽度重排问题与实施方案

live-02原launch25012实际exit0，9个Provider流EOF，NativeService资格通过并已完整收尾。两个入口64Source、四份第20行复制、文件真实选区和Side返回/独立收起已重复核对。主列表读点问题有明确截图15/16及manual-positions-live-02：打开甲第20行文件前，主列表942.2px宽、顶部第43条、offset约-19px；打开File Dock后宽561.2px、顶部第30条，但scrollTop仍1787.2。长标签由一行变两行，旧像素位置已经对应别的来源。

根因在Conversation.rememberReadingPosition：候选只含data-quotation-message下的md-frozen-block，Sources行没有Markdown正文锚点，因此纯来源区域只保存像素top。旧350修复正文段落宽度重排，351提供长来源末尾收起，均未覆盖来源行。已全仓检索MainConversationReadingPosition、两个anchor函数、SourceEntry和相关公开架构；唯一Main读取/构造/恢复调用均在Conversation，位置存储为既有按authority/source隔离的瞬态Map，SourceParts共享renderer用于所有会话，但此次恢复行为只由Main的现有controller承担。相关检索未发现UI自动化测试。

将Main原anchor合同显式分为text/source两类，共用Message ID及offset。SourceEntry的实际可见row暴露现有sourceIdentity和原Message ID（display:contents的外层不能作为几何锚点）；不生成新Source、Message或Part。Main按同一DOM顺序选择首个可见正文块或来源行，来源锚点使用稳定原身份，正文仍保留textIndex/blockIndex。恢复沿用原Message历史加载、虚拟化pin及setupAutoScroll.resolveTop，不添加滚动写入者、定时器或第二个状态Store；删除仅能处理text的旧命名/选择路径。source组展开/收起仍由cardExpanded负责。

风险为身份选择错误、虚拟化时找不到原来源行、切换authority/会话串读点、正文锚点回归。Source identity含type/session/message/sourceId，DOM选择按CSS.escape处理；缺原Message身份时不伪造锚点。服务端schema/路由/工具、Source顺序与复制值无变化。来源Excerpt内部滚动和Side/child自身宽度拖动没有在本次复现，不宣称一并解决。

正式构建后使用已闭合live-02的完整无凭据历史副本source-surfaces-356-history-03，18341/ui、固定600000ms。先对全部schema/config/恢复前沿/Message/Memory和原物理资格做当前检查，再逐表完整复制，selectedSubject为真实Main Session。人工重新定位来源第43条附近，打开文件、返回/隐藏Dock，记录首个来源身份及offset和实际截图，并复核普通正文仍按原段落读点恢复。检查只作为人工观察，不编写DOM/像素断言。类型、构建、CSS/docs仅为补充。

history-03正式main-BzN8YRth.js实际Sources复核成功：同一个第45条来源从宽942.2px/-8.2px到窄561.2px/-8.09px，再回宽/-8.2px；切换到另一真实会话后返回，仍为同一Source身份和offset。实际文件第20行选区正确。25号截图尚在来源区域；26–27的正文probe用向下滚动到达底部，属于自动跟随而非暂停阅读，不能拿其offset变化证明正文锚点回归。原history启动54269实际exit0，页面154先关闭、全链正常收尾。补充fresh history-04/18342/ui/600000ms，仅复核明确向上滚动离开底部后的正文宽度恢复；不延长03或新建模型请求。

## 完成与复核

history-04页面155先打开Side让Main变窄，再由真实滚轮离开底部。29号图实际已滚至顶端，因此继续定位原最终正文；30–31号图才是本项正文验收。窄561.2px时scrollTop612、followLock=false、唯一可见内容锚点为原最终正文，offset36.85；关闭Dock后宽942.2px、scrollTop499.2、followLock=false，同一正文offset36.70。原文首句和完整可见段落人工确认一致。页面17:05:48Z关闭，按原launch-owner前缀调用公共shutdown，全链正常闭合，原启动72785实际exit0。首次shutdown参数使用自拟前缀被严格拒绝；立即改用原owner中的准入前缀，未建立第二个收尾Owner。未延长窗口。

真实数据checker通过：Main与Side各自实际search_code分别产生64来源，两份原文件各32行命中、完整2–33行范围、第20行四次实际剪贴板值、各自真实完成消息和对应流式请求均一致。Side的3条继承消息另含64来源，完整canonical保留；本次验收的是Side自己的真实搜索消息，不把继承来源重复计为新结果。Main实际agent为work、Side为chat；初版checker误把两者均限定chat而失败，已按实际assistantMessageID与canonical agent绑定修正并重跑通过，原失败日志保留。没有修改产品会话类型以迁就检查。

检查已完成：overlay typecheck原72989 exit0、正式build原5050 exit0、CSS token检查exit0；真实数据check-actual.ts exit0。文档检查、提交与上游同步见最终证据及Git。未新增或运行UI自动化测试。31张图保留实际观察范围，失败live-01保持exit1；live-02、history-03/04分别完成独立exit0、页面先关和配对清除/物理退出。下一轮仍需继续自主体验；此次不宣称旧Research Studio数据、SourceExcerpt内部或Side/child自身宽度重排全面通过。
