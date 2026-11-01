# 持续目标长文本表单阅读

## Recall

用户要求持续自主排查整个UI（User Interface，用户界面）与功能，实际体验验证后提交推送，不只修旧闪烁或Sources；反复要求只用本人一个agent、不动正在使用的窗口。旧持续Goal中的三个Astra文字被后续单agent指令覆盖。OpenAI认证及完整模型目录配对使用已授权，874由原认证Owner正常刷新，877真实Sol有限Goal已完成。本轮仅编辑未提交的界面草稿，不启动模型或更改旧Goal终态。

上轮属于progress：67912e5fe正常push原句柄78905 exit0，随后18:59:38Z fresh fetch/普通merge确认HEAD=origin/main、0/0，20项文件和两个语言key已交付、177条无关改动保留。878最终闭合来源258663行、schema9/92表、100项目、229附件、累计1260实际请求，两原native均exit0、shutdown200、配对副本退休。当前工作区产品文件干净，不建额外branch/worktree。持续Goal保持active。

已读877/878 Recall、877创建表单实际截图15、当前continuous-goal与07-panel草稿/校验/有界弹窗/AutoGrowTextarea（随内容增高的多行输入基础组件）合同，ContinuousGoalControl两个表单、原始TextField、公共AutoGrowTextarea及Metrics、GoalDialogHost和其他写入面的调用。全仓搜索所有AutoGrowTextarea/TextField.TextArea、持续Goal表单rows/refs/value/onInput、objective/reason校验与提交调用。当前范围发现Goal service/refresh测试属于传输身份和事件作用域，不是界面渲染；未找到AutoGrow或持续Goal表单自动化，不运行/新增UI自动化。只读原DB调查发现870-before的Goal最后用户意图是paused，拟在真实公共API（Application Programming Interface，应用编程接口）确认后，用它打开完成依据表单但不提交；不为凑验收新建active Goal或修改老记录。

## 修改前根因与影响分析

- 已观察线索：877真实创建Goal时较长目标挤在小输入区域，预算展开占据更多空间。当前ContinuousGoalControl创建objective用TextField.TextArea rows3，完成reason用同组件rows4；后者是否实际同样难读待本轮实页确认。
- 直接触发/数据流：value分别来自现有scoped createDraft.objective和reason信号；onInput清除customValidity/本地validation后更新原值。原生textarea只按rows给初始高度，TextField提供最小高度/vertical resize，未接入按内容高度增长。rows无法因预填、输入或语言/布局换行增高，需要用户手动拖拽或在窄小内区滚动。
- 共性根因与旧路径遗漏：07-panel已声明所有写入面由同一AutoGrowTextarea拥有内容高度，Chat/Mission/交付物GoalDialogHost等已采用；持续Goal控制器是独立写入面，仍直接用基础TextArea，漏接现有owner。公共primitive已处理value、可见非零宽度、宽度变化、10行上限和清理；无需再造ResizeObserver（尺寸观察器）、高度状态或CSS（Cascading Style Sheets，层叠样式表）算法。
- 相关契约：保留目标16000/依据4000长度、required、disabled、只读、ref/聚焦、aria错误关联、onInvalid与onInput处理、草稿作用域/指南往返、预算和requestID归属；不改变save/launch/mutate、模型请求、完成判断或后端。原创建rows3/完成rows4的最小高度保留，超过公共10行上限由输入框自身滚动，原Dialog固定头/底和表单体滚动继续拥有总体边界。
- 影响/风险：两个表单都需实际查看短文、较长文字、缩短后的回落、超上限长文内区滚动、指南往返草稿及焦点、必填本地校验和中英文；新高度可能挤掉预算或底部动作，必须截图检查现有框架。未知项不能用源码/构建代替。现有paused Goal仅打开完成依据并取消，不写入伪完成证据。用户/模型/文件原文和工具身份不翻译。
- 不适用：不改数据库schema/持久格式、Provider认证协议、LLM（Large Language Model，大语言模型）工具/权限/流式调用、Task/Mission/Session调度/恢复/并发。若实测发现真实执行异常立即按AGENTS共享机制横向审计，不能以旧标题或最后错误归因为局部。此轮不发布版本、tag、Release或PR。

## 首次资源、实施与验收方案

before/after各首次0个Provider请求，共用prepare前声明75分钟绝对截止、保留5分钟正常闭合，不提升额度、不重启occurrence（执行轮次）、不延长截止。复制878已闭合合格after完整数据库和229附件命名空间，保护所有100旧项目业务文件/Git；认证及模型目录配对验证，内容不入prompt/log/spec/Git。before复用878真实构建main-DA5cPY77.js及原回执，after由Node实际构建；实际CLI开发服务`/ui/`、本人后台隔离页面，不操作用户18571或其他窗口/进程。

先正常打开已有877完成Goal/当前项目Home，编辑明确合成且不提交的长目标草稿，复现固定小区域；再通过真实公共Goal/Session选择确认870-before处于paused，正常打开标记完成表单，录入明确“仅草稿、不代表完成”的依据并复现。全过程不提交目标创建或完成决策。截图人工复核后先正常闭合before。

确认现象后，两处TextField.TextArea统一替换为现有AutoGrowTextarea，直接复用其默认10行上限，保留全部既有输入属性/回调/refs和rows，删除这两处原固定写入路径；不改公共primitive或其他写入面、不新增CSS或第二状态。continuous-goal架构补充当前输入高度合同，07-panel已有公共合同不复制实现。

after真实页面重做目标与完成依据、短/长/超上限/缩短、指南往返/取消和中文/英文阅读；正常必填校验后继续编辑清除本地错误，但不提交有效决策。只读真实checker核对两个原Goal/Session/工具/数据完全保留，Provider累计1260不变；每阶段完整旧业务行/100项目文件和Git/229附件资格、源DB/原认证与模型目录、public shutdown200、原native句柄exit0、出生身份物理/输出/请求结清和配对副本退休。

构建/类型/语言/样式/docs检查只作辅助，不新增/运行任何UI自动化或源码文案/DOM（Document Object Model，文档对象模型）断言。三索引同步，范围清晰提交，fresh fetch/普通merge、完整待推送集合复核、正常hook/push及随后fresh同步。持续Goal保持active。

## 修改前实页与最终实施

本人38574后台真实页面确认：01从877已完成Goal打开新目标，录入9行明确不提交的草稿，实际可视高62.5625px、内容高158px；截图只显示开头约三行。02从870-before真实paused Goal经详情/标记完成打开依据表单，录入8行明确不提交完成判断的材料，实际可视高78.75px、内容高142px，截图只能读前约四行。尺寸是实页辅助观察，截图人工查看是视觉证据；未知rows辅助读取返回值不作结论。

真实公共Goal和Session选择接口确认877 complete/idle、383698令牌/1自动轮次，870-before paused/idle、503626令牌/1自动轮次。完成依据草稿已正常Close取消，原暂停条和Resume仍可见；没有提交Goal决策。before原native句柄10376 exit0、public shutdown200，出生身份物理/输出/请求结清，2份配对副本退休，0请求/累计1260，余量4344231毫秒；完整旧数据资格正在检查。

按既定方案只新增公共AutoGrowTextarea import，并替换objective和completion reason两个固定TextArea；保留原rows、ref、value、required、maxLength、disabled、readOnly与onInvalid/onInput。默认10行上限由公共组件单一拥有；不增加高度状态或样式。更新continuous-goal当前合同，其他写入面和原交付物Goal对话框实现不改。

## 首次后测发现的公共根因与方案修订（公共组件修改前）

03–12实页确认两个新输入已能展开9行目标/8行依据、缩短回落、指南往返草稿/12轮预算及焦点保留、原生必填英文提示正常、中文Home预填也实际增高。16/18证明长文尾段可由真实光标移动到达、完成依据中文必填仍有效。13–15和19保留另一实际故障：直接录入及实际粘贴24行后，selectionStart/End=695已在末尾，但scrollTop=0、视口停在01–10行；再次End未改变同一光标位置，先Home再End后才到scrollTop223、24行尾段。不能把这几张开头视口截图当作尾段通过。输入维持焦点、有效性在编辑后正常清除；未提交有效Goal决策。

另有精确尺寸事实：9行目标scrollHeight158、clientHeight156、外高158px，实际computed boxSizing=border-box、上下边框各1px。当前autoGrowHeight只把含padding的scrollHeight直接用作CSS height，因此边框吞掉2px可视区，产生未达上限也有细滚动条。公共AutoGrowTextarea.resize每次先height=auto再写高度，却未保留原本视口，也没有在原生value输入增高后恢复末尾编辑光标。实际粘贴排除了只由fill操作导致的解释；这是公共UI尺寸/滚动owner遗漏，不是Goal调度或模型执行。

横向代码调查覆盖所有AutoGrowTextarea入口：主Composer、SideChat、交付物Goal、持续Goal、Mission创建/草稿、Interaction、OperatorSteer、Task目录输入、Provider编辑与Scheduled表单。底层均为TextField原生textarea，应用base统一border-box，Composer使用无边框surface并保留自己的手动最小高度；Mission上限16行，其他默认10行或调用者显式值。autoGrowHeight/AutoGrowTextareaMetrics在当前生产代码只有该primitive一个调用点，另有原公共重导出；检索没有找到其UI自动化测试。问题不涉及Task/Mission/Session执行队列、恢复、轮次或终态；两个原Goal的真实公共读取在试验取消后仍与before逐字段相等，模型请求0。

查阅[CSSOM View规范](https://drafts.csswg.org/cssom-view/#dom-element-scrollheight)的滚动区域/内边界定义及[Autosize维护者当前源码](https://github.com/jackmoore/autosize/blob/master/src/autosize.js)的box-sizing尺寸修正和测量前后视口保护做法。采用现有primitive内部修正，不引入第二个库/镜像textarea、定时器或高度/草稿影子状态：公共height计算接收实际boxSizing、上下边框与padding，先按现有行数上限求内部高度，再转换为相应CSS高度；resize保存原scrollTop，纯几何测量恢复它。只有value变化、当前字段确实聚焦且折叠光标位于原生文本末尾时，恢复末尾编辑视口；宽度变化不强制追尾，用户阅读/pan的旧视口保留。中间编辑沿原生已有视口，不测量或猜测任意光标坐标。

风险与验收补充：公共高度与光标行为影响上述全部写入面；保留rows、调用者maxLines、CSS最小/手动高度、IME（Input Method Editor，输入法）原生值/选择、onInput/onScroll、observer清理与非零宽度合同。本轮新增一个final只读阶段，首次0请求，与原75分钟绝对截止相同、不替换或重启已结束after。先正常闭合after：原句柄41155 exit0、shutdown200、物理/输出/请求结清、2配对副本退休，258665→258667行、100项目/229附件/旧数据完整资格均通过；保留当前缺陷原图与回执。

final重新构建，实际粘贴重做Goal目标/依据、9/8行全读和24行尾段自动可见、缩短、指南/预算/必填及用户主动回看；至少补主Composer及可实际打开的另一写入面，其他写入面覆盖边界明确记录。纯UI尺寸修复继续禁止自动化UI/DOM/源码/像素断言；用真实交互、原图人工复核及只读尺寸辅助。原schema9、累计1260、全部原Goal数据/项目文件/Git/附件保护与完整原生闭合仍适用。未通过则继续查根因，不将首次after包装为最终通过。

## 最终实现与实际验收

五个当前文件完成本轮产品/合同改动：持续Goal两字段接入公共组件；公共Metrics按实际padding/边框/boxSizing计算CSS高度，resize保留scrollTop，value变化时仅为当前聚焦且折叠光标确在原生文本末尾的编辑呈现末尾视口；宽度测量保持原阅读位置。没有添加定时器、隐藏textarea、额外observer或另一份输入/高度状态，原值赋回仍只在原生value不同的时候进行。07-panel及continuous-goal同步唯一合同。

Node最终构建main-CkimZRe3.js；Overlay类型检查、2716项双语、60样式/401应用文件token与352规格/26架构文档检查均0。首次after的main-DjRtjGCF.js及缺陷原图保留，没有替换失败证据。final首次0请求/原绝对截止的独立执行轮次，未提升旧额度、重启旧服务或延长截止。

20–36最终实页由本人逐张查看，均为实际CLI开发服务、后台独立页面：

- 主Composer：9行完整、clientHeight=scrollHeight=156；24行实际粘贴即见24行尾段，selection695、scrollTop227、client172/scroll399，无需额外End。主动滚回开头后保留末尾selection695，打开Explorer使字段宽726→500，scrollTop仍0，原阅读位置保留。
- Home Goal：真实主输入草稿预填9行，height160/client158/scroll158，边框占用已正确计算；24行实际粘贴即见尾段，height176/client174/scroll401、scrollTop227；缩短回到height63/client61。空目标仍显示Enter an objective，编辑后恢复。指南往返保留9行草稿、12自动轮次草稿预算和原目标字段焦点，底部动作在有界框架内。
- 手动Mission草稿：从真实Tasks/Mission Board创建入口打开，切换手动方式，仅编辑未提交的Description。9行height160/client158/scroll158；24行实际粘贴保留原16行上限，height274/client272/scroll401、scrollTop129，尾段与Cancel/禁用Create draft均可见；随后正常Cancel。未创建Mission或执行模型。
- 中文完成依据：8行height144/client142/scroll142；24行实际粘贴即见尾段，height176/client174/scroll401、scrollTop227，selection695。中间第二行实际插入“校”，光标30/696、视口scrollTop5仍在开头附近；缩短回到height79/client77。空依据显示“标记完成前，请填写实际完成依据。”；编辑后原生错误清除。指南往返保留8行草稿及原字段焦点；最终Close取消，原503626令牌、1/2轮、paused/idle仍可见。

只读公共Goal与work-ledger接口在最终全部操作后均200，两个Goal完整JSON/Session选择与before逐字段相等：877 complete/idle、预算12/接收1轮/383698令牌，870-before paused/idle、预算2/接收1轮/503626令牌。未提交有效Goal创建、完成判断或Mission草稿；三个阶段实际Provider请求均0，累计1260。原native句柄10376/41155/56422分别exit0，public shutdown均200，同一出生身份物理/输出/请求结清，6份配对认证/模型目录副本退休。完整资格258663→258665→258667→258669行，每阶段仅增加一对正常控制租约记录；原schema9/92表、全部旧业务行、100项目业务文件和Git、229附件、三个来源DB及原认证/完整模型目录保留，零文件系统豁免；final闭合余量2517841毫秒。

36张原始JPEG、手动操作与非敏感资格见[证据](../../artifacts/2026-11-02-goal-form-reading/README.md)。首次预算原生summary用role按钮定位未匹配，读取当前AX（Accessibility Tree，无障碍树）后通过其真实Expand动作完成；未重发业务或伪报产品错误。首次after的未追尾、重复End与实际粘贴失败均如实保留，最终直接粘贴修复后复测成功。

边界：当前实页均为border-box；content-box分支没有构造额外样式进行实页验证。未逐一打开SideChat、交付物Goal、Mission草稿编辑、Interaction、OperatorSteer、Task目录、Provider及Scheduled各写入面，其共同调用链已审计；完整IME组合输入没有实页验收（本轮是实际粘贴和单字插入）。没有改后端/持久格式/Goal运行语义或schema，不操作用户18571/窗口/进程/数据库；本轮没有发布版本、Release、tag或PR。正常提交推送及随后fresh同步以实际原句柄/回执为准，持续Goal保持active。
