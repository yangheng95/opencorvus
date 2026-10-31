# 预览默认使用应用内普通弹窗

## Recall

用户原话：“为什么每次弹出来都是全屏，影响使用？？很多时候都是全屏，修复这个问题”；随后明确“先暂停其他迭代，把预览弹窗默认全屏的问题修好，改成应用内普通弹窗，不要影响我正在使用的窗口。只用你一个 agent，实际验证后提交推送。”本轮只处理该问题，不委托，不操作用户窗口/服务，不发布。前一轮45b22a787已在origin/main，原176项其他改动保留。

此前进行851原生Office复验，已取得当前版本三真实交付卡和11张原图。实际“打开”使自有页面从普通1280×720切换到1920×1080系统全屏，普通下载菜单原件顺序和当前复制正确。851自有页59已关闭、公开shutdown200、原句柄5013/native/launcher0、物理/输出/请求出生链结清，auth/models配对已退休；本轮新增模型请求0，累计1180。旧598收尾余量失败保留，不重新启用旧服务或额度。851调查和原图作为本修复的直接输入证据，不继续其他迭代。

## 分析与全仓影响面

已读AGENTS、当前架构07-panel、851完整Recall、ArtifactFrame/ArtifactActions、McpAppArtifact、ImagePreview、Dialog及其类型、messages/dialog样式、SelectControl、fullscreen工具、main的文件打开交接、dom-utils阅读位置控制及相关纯数据测试。全仓搜索requestNativeFullscreen、requestFullscreen/exitFullscreen、fullscreenElement/change、fullscreenPortalMount、所有Dialog fullscreen传参及样式/架构调用。

直接触发与根因：ArtifactFrame的“打开”被实现成element.requestFullscreen，当前文案仅称作品视图，没有说明会改变浏览器/宿主窗口；所有共用Frame的文件/PDF（Portable Document Format，便携文档格式）、工作表、演示和其他产物都受影响。MCP（Model Context Protocol，模型上下文协议）App的fullscreen模式也调用同一原生函数，虽初始inline，应用请求/显式按钮均可能触发整窗切换。ImagePreview则强制传Dialog fullscreen，样式铺满应用并以近不透明遮罩覆盖原页面。两条不同路径共同造成预览经常占满窗口。此前“全屏可读/portal可见”验收只证明了旧行为可操作，没有验证用户当前要求的普通弹窗与窗口连续性。

编辑器、画布、WebGL（Web Graphics Library，网页三维图形）和MCP iframe已挂载在原节点；把同一渲染器再创建进Dialog或通过DOM（Document Object Model，文档对象模型）重挂会丢编辑/交互状态，不能用两个产物实例替代。已检查Solid Portal源码，mount变化会创建容器并移动内容；因此不把重挂Portal当状态保全的证明。

浏览器Popover属于页面自己的顶层，保留原节点与事件生命周期；采用当前MCP已使用的平台primitive（基础能力），把共享展开行为改为auto popover，居中有边距的普通作品窗，按平台语义支持外部点击/Esc关闭与返回焦点。首项下载和真实导出仍用原ArtifactActions。菜单/下拉portal必须归属当前实际展开根；原阅读位置控制必须识别被预览覆盖的对话，并在收起后恢复。文件链接导航需先关闭所属作品窗，再进入已有文件工作台。原生媒体控件的用户显式全屏属于浏览器能力，保留其阅读可见性观察，不再由产物预览主动请求。

图片复用现有Kobalte Dialog，使用普通有边距窗体、可见标题及关闭/缩放/下载，保留图像原件、真实来源及上下文。不改用户/模型原文、HTTP（Hypertext Transfer Protocol，超文本传输协议）/SDK（Software Development Kit，软件开发工具包）、模型工具、数据库schema或持久消息。MCP协议的displayMode字符串保持fullscreen，宿主投影为应用内展开，iframe与协议队列沿用唯一当前实现；画中画继续用原manual popover。

## 实施前方案与验收

在修改前保存相关tracked文件原差异及字节；将requestNativeFullscreen替换为唯一应用内展开/关闭helper，Frame与MCP均接入，删除旧原生请求路径。浮层portal和阅读覆盖观察接入实际展开节点，更新原文件导航交接；原:fullscreen产物布局改为当前展开根布局，居中宽高受应用视口约束并留边距。图片去掉强制fullscreen并调整普通窗体标题/图像/工具条布局。同步现有中英文文案和当前架构合同，不维护并行展开实现。

在851已彻底退休的数据基础上建立新的preview-dialog-852隔离发生轮次，当前schema9完整保全、当前构建，经开发serve /ui实测，零模型请求；必要时在独立同批只读页面回看850真实工作表，验证实际编辑值跨展开/关闭保持，不操作用户窗口。852新60分钟绝对期限，启动余十分钟、结清余五分钟，不延期；配对auth和完整models分别验证，额度0，累计1180保持。851原期限不延长或复用。

实际查看普通页面的DOCX/XLSX作品窗、图片预览、下载菜单、复制、缩放、Esc/关闭与焦点返回，截图必须同时显示周围页面和应用菜单/标题栏。至少下载真实Office源文件及派生PDF，核canonical attachment字节和内部数据；工作表若进入需验证当前编辑值跨开关及CSV（Comma-Separated Values，逗号分隔值）内容。英文/中文必要入口均人工查看，不用DOM断言或无控制台错误代替视觉验收。运行类型、i18n（internationalization，国际化）、普通Overlay构建/renderer检查；纯UI修改不写/运行UI自动化、组件/快照/像素断言。

完成自有页面及服务结清、退休配对副本、源库/全业务字段/附件/Git/消息保全核对；同步三个spec索引及当前文档检查，范围提交。fresh fetch/普通merge后审查完整待推集合，正常hook推送，再次同步。实际未覆盖的入口如实说明，不以样本通过宣称所有renderer实页覆盖。

## 实页反馈后的共享浮层补充分析

首个构建main-C9zprbYp.js已在852-office/38492和852-sheet/38493实际运行，使用原已完成交付及原Spreadsheet850，没有新模型请求。Office、图片和可编辑工作表均在1280×720普通窗口内展开，有周围页面/应用菜单，未切换系统全屏；真实下载、图片缩放、Esc及关闭返回通过。工作表A1实际改为Alpha852 retained，收起后公式栏仍保持该值。

同一工作表右键后，实际可访问性状态产生Copy/Cut等菜单，但画面没有菜单；12原图保留，不能把菜单文本视为视觉通过。已定位现有Univer UI依赖补丁：其稳定floating-content container仅在ownerDocument.fullscreenElement包含mountContainer时移入顶层，普通popover展开仍挂body，因而被页面顶层遮挡。这是本次替换的共享浮层归属，不是模型或调度问题。Kobalte下载菜单在同一普通作品窗已真实显示并下载，当前不据推测扩改该依赖。

实施前扩展范围仅到现有@univerjs/ui补丁及其实际安装/锁文件投影：同一容器选择包含挂载节点的实际popover或原生媒体fullscreen；增加原生toggle捕获观察、同步清理，保留原容器、菜单/子菜单/对话生命周期和所有旧补丁。按[Bun官方patch流程](https://bun.com/docs/pm/cli/patch)先建立与cache断开的可编辑副本，再生成唯一当前补丁并同步锁文件；不写第二个宿主菜单。真实表格重验右键菜单、子菜单/对话、关闭与编辑保全，重新构建后用新的隔离发生轮次验收，不延长已声明852期限。[HTML平台Popover合同](https://html.spec.whatwg.org/multipage/popover.html#the-popover-attribute)用于页面顶层、light dismiss和close request语义，不以静态检查代替以上实页验收。

## 实现及实际验收

### 提交终审发现的演示高度补充方案

主修复提交f13248后逐项复核产物布局，发现PresentationArtifact仍把展开内容高度定为100vh减64px。当前普通窗已有独立标题和上下边距，旧高度超过实际内容区。852-media/38496以相同p29构建、原Presentation849真实数据实页确认：22图底部页码和翻页控件被裁掉。直接触发是展开时旧视口高度规则覆盖inline宽高比；根因是原系统全屏尺寸约束随选择器迁入普通窗，未转为父内容区尺寸。已搜索同语义展开样式、读取Frame/body flex约束及Reveal resize/layout调用；其余工作表/Office/图片当前截图已实际覆盖，未发现同一高度式。无接口、协议、持久数据或队列改动。

实施前范围仅限当前演示展开规则，改为height:100%并允许min-height:0，使用既有父内容区与ResizeObserver驱动Reveal布局。保留同一实例及翻页状态。沿用852原绝对期限，media基线退役后新media2发生轮次加载新普通构建，实测页码/翻页、关闭重开与图像预览交接；补充原图和数据/退出核对，独立后续提交，正常推送两个本任务提交。

唯一top-layer工具替换旧fullscreen工具文件，Frame与MCP展开使用同一open/close函数，保留原DOM节点、iframe/编辑器实例和inline卡片高度。普通居中窗限制于当前视口并留边距，支持外部点击、Esc和原关闭按钮；原生媒体显式全屏只保留观察。下载/Select浮层跟随实际top-layer，阅读位置控制按覆盖状态保留原位置。Markdown文件导航及图片打开先收起所属作品窗。ImagePreview复用普通Kobalte Dialog，显示文件名与关闭/缩放/下载工具条。中英文“展开/应用内展开”与当前行为一致。删除原产物主动requestFullscreen路径，没有复制payload进第二个渲染器。

Univer现有稳定浮层容器改为选择挂载节点的实际popover或显式媒体fullscreen；四个发布格式均更新同一补丁并清理toggle/fullscreenchange监听。原Bun1.4.0的patch命令在隔离安装布局按名称及精确路径均返回ENOENT，并移除了一份已装包；原错误保留。立即以原frozen-lockfile安装修复，随后对断开缓存的私有完整副本反向应用原补丁取得真实pristine基线，用Git生成包含所有既有修改的新唯一补丁并执行canonical apply检查；正常install及原frozen安装均通过。没有更换依赖版本、另加宿主菜单或绕过hook，package.json/bun.lock无差异。首次私有生成只在三份私有格式完成后因UMD逗号清理表达式断言退出，依据实际代码修正后完整生成四格式。

CSS检查先指出动态占位变量缺默认声明和两处重复间距字面量；补齐私有初值并使用原gap token后原检查通过。类型、2674键/两语言、CSS入口图/8968引用及普通Overlay build/renderer通过，最终main-p29xDJyQ.js。两次构建之间的差异是已发现的浮层及CSS合同修正，不重写早期失败截图。

真实页面及21张截图均亲自查看：Office/XLSX、DOCX和图片均以普通有边距窗呈现，1280×720页面和应用菜单一直保留，没有切换系统全屏。实际原件/派生PDF下载、图片放大、复制原件名称后原生粘贴、关闭与Esc及点击外部返回通过。当前复制草稿未发送且已清空。最终构建另启office2/38494、sheet2/38495复验，沿用852原期限，没有重启已完成发生轮次。

在同一真实工作表先实际改A1为Alpha852 retained，关闭/重开及CSV均保持；12图记录旧浮层被遮挡。修复后的最终构建另在原完整payload实际改为Alpha852 final，16—17图确认右键菜单/子菜单真实可见，工作表页签菜单及原名的行内改名入口可操作；不把行内入口说成模态对话验收。中文切换后菜单跟随语言，关闭返回后公式栏仍是Alpha852 final，两CSV中英文实际下载逐字节相同。原持久A1仍Alpha850，原五消息/选择及原三Office卡的82消息/选择逐字段保持。

实际下载的DOCX/XLSX/PDF/PNG与canonical attachment逐字节相同；文件解析器核DOCX十三文本段、四模块/状态及36／25／−11、PDF单页内容、PNG与两CSV全部单元格。隔离Python首次因HOME隔离未投影已有pypdf/Pillow而失败，绑定已验证库目录后出现cp1252输出错误；在本轮私有运行器声明UTF-8后重跑同一原checker通过，没有安装或改动用户Python环境。数据检查与人工视觉验收互不替代。

office/office2原92表24575→24577→24579、sheet/sheet2原92表234299→234301→234303，每轮仅新增控制激活和grant各一行，原业务字段、源库、58/140附件及8/62项目文件/Git均保持。无排除文件目录，原schema9保持，没有用户数据库访问或模型新请求，累计1180。四轮均shutdown200、原句柄83594/8220/75822/37509及native/launcher0，物理/输出/request出生链结清；8份auth/models副本退休，源保持，余量2774508/2774492/2502151/2278030ms。自有页60—63关闭，受控库存为空，未操作用户窗口或服务。

本轮未运行真实MCP App，也未逐一实测其余全部renderer；其共享展开/协议投影已改并通过类型/构建，未以Office或表格截图替代这些实页覆盖。没有运行UI自动化，没有额外branch/worktree、Release或版本变化。最终提交与推送以Git交付核对为准；原图、真实下载、完整数据checker及收尾汇总见[验收目录](../../artifacts/2026-11-01-in-app-preview-dialogs/README.md)。

### 演示补充验收完成

最终演示规则使用父内容区100%高度并允许收缩，既有Reveal ResizeObserver负责重排。普通build/renderer及CSS原检查通过，构建main-B454iFzK.js。media2/38497当前真实Presentation849页面亲自查看24—27原图：窗内页码、箭头与进度完整可见，实际翻到2/2，关闭重开仍2/2，点击第二张原图后原作品收起并打开普通图片窗，周围应用和1280×720窗口保持。23为首轮加载切换后实际尚在inline的中间截图，不作为弹窗成功证据；未据AX文本宣布通过。

原六条自然消息、选择及两个artifact payload经公开接口逐字段回读保持。media原234303→234305、media2原234305→234307，仅控制激活和grant各新增一行，原92表全部业务字段、140附件及62项目文件/Git、源库逐项保持，无排除。原句柄7263/63749及native/launcher均0、shutdown200，物理/输出/请求出生链结清，余量986564/794120ms，新增四份配对auth/models已退休且源保持。自有64/65页关闭，受控库存为空；累计新增模型请求仍0/1180。852原期限未改动，全部六轮12份配对副本已退休。主修复及演示补充分别提交，其他迭代保持暂停。
