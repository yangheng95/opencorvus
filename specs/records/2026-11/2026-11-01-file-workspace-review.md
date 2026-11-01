# 文件工作区连续操作体验

## Recall

用户要求继续自主排查UI/UX（User Interface/User Experience，用户界面/体验）及功能，实际验证后提交推送，仅单agent，不操作用户正在使用的窗口。上一轮857已推送b62c80cb9并fresh fetch确认本地/远端一致，语言选项同源与中英文发现16张实图验收通过，全部自有页面/服务结清。长期Goal旧Astra措辞被用户后续单agent要求覆盖，不委托。

858开始git status保存于私有工作目录，保留176项既存无关状态。已读AGENTS、857 Recall、当前07-panel文件创建/编辑/预览/查找/草稿/下载契约，FileExplorerPanel目录与搜索/操作反馈/创建及上下文菜单、FileEditorPane当前资源和编辑状态，CodeEditor保留视图与查找能力及既有运行器。全仓搜索将随真实问题追加。本批首先实际走文件工作区浏览、搜索、打开和连续导航，证据不足前不修改产品。

## 调查范围与验收方案

可观察问题暂未知。优先发现会中断文件处理、误导当前选择或丢失草稿的真实缺陷，避免重复已交付的查找/预览/语言问题。源码及真实页面联合确定直接触发、数据或控制流根因、旧路径原因、全部定义/消费者/历史合同/测试，再补齐实施方案后修改。若发现调度、队列或恢复异常，按共享生产机制横向审计。

从已退休857-after复制完整QA（Quality Assurance，质量保证）库，新独立60分钟绝对期限，before/38509与after/38510共用，保留原schema（数据库结构）9、92表234499行、140附件、62项目业务文件/Git身份及9Goal。文件快照排除.opencorvus运行元数据，.git以HEAD/ref/index/status核对，不宣称全元数据字节覆盖。配对复制已授权OpenAI认证及完整models目录，核验Provider凭据注册与精确gpt-6.1-sol投影，新增模型请求上限0/累计1180。实际UI使用正式开发serve的/ui、自有后台标签页，不接触用户18571服务、页面、窗口或用户数据库。启动余10分钟、物理结清余5分钟；不延长期限。

仅真实页面交互、原始截图与人工视觉复核，无UI自动化测试；非UI修改需聚焦正向契约测试。类型、语言键、普通构建及当前docs:check辅助。完成后关闭自有页，公开shutdown、原exec/native/launcher、物理/输出/请求与出生身份结清，退休配对副本。逐表全列/源库、附件、项目文件/Git和原Goal公开事实保全。同步三索引，范围提交，fresh fetch/普通merge、完整待推审查、正常hook推送及远端回读；无关工作保留。

## 真实发现、根因与实施前决定

38509/main-DqgM6m1u.js自有79页，从Ctrl+K的827 Work进入Explorer，打开现notes-855-after.md及返回均正常。展开notes-828-after后按Down，焦点仍停在文件夹而未移到下一draft.txt，01原图亲自查看。可观察缺口是连续键盘浏览只能反复Tab，方向键不支持层级浏览；其根因是普通/搜索行仅onClick调用当前选择/打开/展开，列表没有方向键控制，也没接现Virtua的索引滚动/挂载能力。既有原生按钮Tab/Enter可用，但不覆盖树形连续浏览；不是数据、文件读写或执行调度异常。顶栏Edit实际仅全局搜索/Providers，不存在此前猜测的Undo菜单问题。

已全仓搜索FileExplorerPanel引用、方向键/roving实现和历史文件键盘合同；当前相同功能无实现，触及test搜索没有UI自动化测试。已读现Button传递ref/键盘事件、稳定rowKeys/rowByKey、当前选择Map和目录加载，以及已安装virtua/solid VirtualizerHandle/keepMounted/scrollToIndex声明。[W3C树形键盘参考](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/)用于方向约定及焦点与多选独立；[Virtua官方源码入口](https://github.com/inokawa/virtua)与已安装声明用于索引滚动。现行仍为原生按钮集合，本批补方向键快捷导航，不更换为宣称完整tree模式的ARIA（Accessible Rich Internet Applications，无障碍富互联网应用）组件，也不改变原按钮Tab/Enter/Space和Ctrl/Shift点击选择。

方案为同一renderRow的普通/搜索按钮消费本地键盘导航：无修饰Up/Down/Home/End按现rows顺序聚焦前后/首尾；普通行Right展开当前目录或聚焦已出现首子项，Left收起当前目录或聚焦可见父项。移动焦点独立于现selection/active文件，不打开文件、不生成新选择状态，Enter仍沿唯一原onClick。修饰键、组合输入和已处理事件保持原归属。行key本已包含API（Application Programming Interface，应用程序编程接口）authority/directory/selection epoch，聚焦使用同一key与真实button ref；虚拟行通过现keepMounted保留当前焦点项并挂载目标、scrollToIndex就近滚动，普通行用scrollIntoView。延迟聚焦需仍同请求/当前rows，原焦点未被用户移走、列表可见、原button仍有效；清理/换scope/关闭工具/外部聚焦后不得抢焦点。只保存临时焦点请求/DOM（Document Object Model，文档对象模型）引用，不另建文件/选择/目录数据源。增加一行当前语言键盘说明，现focus-visible样式保留。

风险包括虚拟目标未挂载导致焦点落body、异步聚焦越过用户新焦点、回收行后悬空引用、跨目录key混用、文件夹展开读取未完成时跳错子项、按方向键误打开文件/改变多选，以及新增提示挤占窄栏。候选真实验证普通目录左右/上下/首尾、Enter打开及原文件草稿/焦点，搜索结果上下/Enter、中文提示和布局；在原QA项目中只新增keyboard-review-858目录/132个已知小文本用于真实大目录虚拟呈现，原文件/HEAD/ref/index保持，Git status仅允许该精确新增目录；不把这些样例或静态检查当作UI端到端证据，不创建消息/Goal或模型调用。UI-only改动不新增UI测试，依实页/原图核验。

## 首候选实际失败与补齐分析

类型/2677键/普通build及renderer公共面通过，首候选main-B2iloEc2.js/38510自有80页：02 Down真实聚焦draft.txt且原父目录选择保持，Left回父项再Left收起、Right展开再Right进入子项均正常；03 End定位末文件，Home定位首.opencorvus。随后Down到keyboard-review-858并Right展开132项，04实际焦点成为AXWebArea，键盘链中断，不能当通过。

根因为原For与Virtualizer阈值切换确实替换行owner，原架构明确未承诺跨阈值焦点；首实现仅在显式移动目的行时创建聚焦请求，目录异步加载稍后触发换呈现，已完成请求无法保留当前真实焦点。不能仅在Right按下时排一次聚焦，因为异步读取完成在其后。补齐同一行ref生命周期：只有被清理的button仍拥有真实焦点、同key仍在当前rows且当前scope有效，才将这个焦点交给现唯一pendingFocus；已存在的显式目标请求优先。新行挂载沿同一范围/可见性/外部焦点校验完成移交。真实行删除、筛选退休、外部焦点和关闭工具不建立恢复。仍只有一个当前呈现和一份临时聚焦请求，不保留旧For/虚拟双行。

132项准备脚本首次以execFileSync误假定原QA仓库已有HEAD；实际是未提交仓库，原head事实也是code128。文件已创建，未重写；改用现保全检查的完整code/stdout/stderr契约，逐文件核对后继续，原HEAD/ref/index原事实及原status加132精确新增项通过。基线92表234499→234501，仅正常激活lease/grant各一行，全部原行/附件/项目/源库保持，9Goal事实已读取。首候选结清后在同一原858绝对期限内准备after2/38511，不延长期限；最后保留失败图并以新构建重验。

第二候选main-C1wjanUv.js/38511自有81页，从真实焦点Right展开同一132项后AX仍为body，05保留失败证据。说明不能以cleanup时的activeElement重建之前的焦点归属：原生移除已经使它成为body。删除这一无效判断路径，改由真实onFocus记录element/key/原scope，连接中的普通onBlur退休该事实；新同key行注册后的微任务只有旧element已移除且事实未被后续焦点替代，才交给现pendingFocus完成原范围/可见性/当前焦点校验。不是从body猜上一次选择，也不自动聚焦新文件；所有权来自真实focus事件。after3仍沿原绝对期限，重新验证两向阈值和外部焦点。没有后端调度异常。

第三候选main-2MMSygWq.js/38512的82页同样失败，06保存，不宣称完成。查已安装Kobalte Trigger/当前封装，focus/blur/key及ref确实传递，row key也保持同scope/路径；不能继续只靠推测补丁。临时加入FOCUS858的focus/blur/register/settle诊断，普通build main-K4TMOprN.js；关闭82页后将静态产物复制到同一自有bundle，再开83页的真实DOM script仍指main-2MMSygWq.js，console也无新诊断，证明该活服务仍发布其已载入的入口。这个发布尝试不作为新构建验收；服务未重启，原deadline未变。83页关闭，after3原exec/native结清并退休配对副本后，新debug/38513发生轮次从新产物启动。只在自有页做诊断，不动用户窗口。最终必须移除全部临时诊断并以新final服务重新验收。

debug的84页实读script为main-K4TMOprN.js，FOCUS858记录04:07:03.865真实focus原目录/connected=true，04:07:03.915 blur时connected=true、activeElement已body，此后没有register移交。此前认为连接中的blur只来自主动离开被真实日志否定；原生移除在连接仍true时也发blur，故这条状态追溯无法区分呈现替换和主动失焦。

第四候选删除onBlur/onFocus事实缓存及cleanup重建路径，尝试在现shouldVirtualize改变时用[Solid同步createComputed](https://docs.solidjs.com/reference/secondary-primitives/create-computed)先于条件呈现替换捕获真实document.activeElement。全部临时console诊断删除，日志作为真实观察证据保留。38514的85页实读script=main-8_rJEgTO.js，同步捕获仍未保住焦点，07保存失败，不能依赖框架内部条件分支/DOM插入顺序的补偿。

最终2改为修复结构触发点：删除小目录For/大目录Virtualizer两套行呈现的阈值分支和常量，所有成功非空目录及搜索结果均使用现Virtualizer/rowKeys/rowByKey；目录展开数量变化不再切换owner。删除同步捕获及全部旧焦点历史/blur/cleanup恢复机制，只保留显式键盘目的行的单次范围守卫请求、当前焦点项keepMounted与实际行ref索引。小列表无额外依赖、原行高/顺序/宽度/按钮/选择/打开不变；大列表原库的窗口化保持。CSS内滚动边界从已挂载virtual-window推导，空/加载/失败保留原列表滚动。影响面仅同一Explorer生产调用与现CSS；FileChangesView等独立消费者原行为不改。需额外真实验证小目录、两向数量变化、虚拟首尾及相邻项、搜索/空状态/回到原文件、未保存草稿、中文和普通Tab。新final2/38515沿原期限；前面所有失败构建完整保留为失败证据，不混入通过计数。

final2/main-iM31oKJY.js/86页08真实Right展开132项，原同ID的目录button保留焦点，证明单一呈现修复跨数量边界。Right进入entry-000也通过。随后End滚到尾部但焦点掉body，09是失败：当前settle先focus后scrollToIndex，库再滚动更新窗口，已经结清的请求无法覆盖这次原生移动。此处是显式滚动的完成时机，不恢复任何阈值补偿。修改前核对现VirtualizerHandle的getItemOffset/getItemSize/scrollOffset/viewportSize和onScroll回调：focusRow从同一真实目标索引判定是否需滚动，在现pending请求中标记等待；先调用库索引滚动，实际onScroll通知后微任务及目标ref注册共同进入同一settle，范围/当前key/可见性/未转移焦点仍校验，最后focus。无需滚动则当前微任务即可。删除focus后的滚动，避免再次退休目的焦点；不加计时器、重试轮询或上一焦点缓存。final3沿原期限重验首尾、视窗相邻项和双向折叠。

启动final3前继续真实滚轮复核，86页尾部向上两页，10实际仍停entry-122到末文件。深入读取已安装Virtua source map中的真实Virtualizer实现：默认scrollable=container.parentElement，虚拟容器inline高度=totalSize；UPDATE_VIRTUAL_STATE更新后通知onScroll。Explorer原CSS将真实父列表设overflow:hidden，却把虚拟总高度容器当作height:100%/overflow:auto的滚动窗，inline总高使后者不形成视窗，原父隐藏滚动阻止滚轮。程序scrollToIndex仍可改父scrollTop，所以只测程序跳转漏掉了真实滚轮。

横向核对四个生产消费者：Conversation显式scrollRef；FileChangesView与ScreenshotBrowserPanel均让父列表overflow-y:auto，虚拟总高容器仅宽度约束，符合库合同。只Explorer存在上述错位，故删除Explorer的父隐藏规则和虚拟容器height/overflow规则，让原file-explorer-list成为唯一真实滚动面，沿同库契约加现overscroll contain。空/错误依旧该父滚动面；不新增:has边界或第二scrollRef。final3仅完成普通构建、尚未启动；最终选用含此CSS修复的final4/38516，从已结清final2复制，仍沿原858期限。最终验收必须实际滚轮和手动键盘跳转都通过，不能以滚动API代替滚轮。

final4/main-XEghmMeR.js/87页展开保焦点与实际滚轮修复通过，尾部向上两页真实移动到entry-064区域。首次End即使等待后仍body（11）；读取真实DOM显示父scrollTop3963/clientHeight549/scrollHeight4512/overflow auto、目标末文件已连接且最终可见。随后从中部再次End，12真实聚焦末文件。这个“首次失败、已读目标成功”的对照定位到新行测量就绪，而非查询或范围错误。深入已安装Virtua ListItem源码确认：未测量的真实item使用visibility:hidden，挂载与滚动通知先于ResizeObserver测量/解除隐藏。此前用isConnected当可聚焦就绪，focus静默失败后清了请求。

补齐直接渲染合同：将仅被此Explorer使用的现CustomItem包装移入本组件的焦点owner，现style输入变化后通知同一settle；目的button必须真实computed visibility=visible，且focus后activeElement确为该button才结清。库的真实测量解除隐藏带来style变化，原请求自然在这个点完成；不加计时器/重试/DOM观察器/焦点历史，也不改Virtua内部或其他消费者。滚动通知仍解开原请求的滚动阶段，现scope/未外部转移焦点/当前key/列表可见性守卫保留。新final5/38517沿原期限；先前11为失败而12仅已测量对照，不冒充首次End通过。必须新页面首次屏外跳转、回首、滚轮、折叠、搜索与原草稿全验收。

## 最终真实验收与结清

final5的88页实际script=main-DTsRoIV5.js，13首次打开132项目录并End即真实聚焦末notes-855-before，Home返回首.opencorvus，14 Down到目录后Left收起仍保留同一目录焦点。原小目录Right展开/进入子项、Up/Down/Left返回父项和收起均复核。End/Up/Enter打开原notes-855-after，追加DRAFT858_KEEP仅为未保存草稿；切Explorer后搜索entry-12，15 Down到真实第二候选entry-126，16 Enter遇原未保存决策、Cancel后17原全文与新增草稿完整保留。原编辑器Ctrl+Z撤销本次输入，Save禁用且原内容恢复。原生Tab从搜索经Clear/New进入首候选；搜索Home/End/Down/Enter真实打开entry-126，18正文File 126来自原QA磁盘。搜索顺序保留真实fuzzy结果，不假设字母顺序。19无匹配稳定空状态，Clear恢复目录。

切中文后20全部文件面板与新键盘提示为当前语言，文件身份保留原名。21真实向下滚轮到entry-043一带，22向上返回首项；23相邻方向键聚焦entry-015。没有把定位API当滚轮，也不把23的原生focus定位算成独立纯键盘跨视窗证明；首次真正屏外跳转由13证明。23张原图全部实际呈现/亲自查看，04–07/09–11保留失败含义；最终通过图13–23共11张。首候选02–03和中间08/12为局部/对照证据。未重放所有修饰键、屏幕阅读器、全部读取错误、并发文件变动或多平台原生窗口，不宣称完整ARIA tree模式。

本批共9个实际服务发生轮次（before/after/after2/after3/debug/final/final2/final4/final5），final3仅构建未启动。同一原绝对期限未延长；全部原exec、native/launcher为0、公开shutdown200，物理/输出/请求与出生身份均结清。最后余1040179ms，早于5分钟结清边界；18份配对副本退休、新增模型请求0/累计1180，源认证元数据及模型目录字节/元数据保持。自有79–88页全部关闭（其中83为未生效诊断发布检查页），受控库存为空，用户18571窗口/服务/数据库未操作。

92表全部原行/全列与各原源库保持；234499→234517只新增9对正常激活lease/grant记录，原9Goal公开事实每轮深相等，无消息/执行或Goal写入。140附件和62项目快照内原业务文件保全，无项目排除；QA额外132个小文本的范围/内容及原Git事实已核对，未修改原文件。快照排除.opencorvus，.git仅HEAD/ref/index/status，不扩大字节覆盖结论。最终Overlay类型、2677键/两语言、普通build/renderer公共面通过；纯UI改动不新增或运行UI自动化测试。

接着同步三索引与当前docs:check，独立范围提交，fresh fetch/普通merge、完整待推审查、正常hook推送和远端回读。长期Goal保持active，继续单agent迭代；初始176项无关状态保留，只有真实冲突才等待。
