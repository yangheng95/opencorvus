# 交付记录的可读名称与原始身份（899）

## Recall

用户要求持续自主体验整个UI（User Interface，用户界面）/UX（User Experience，用户体验）与功能，只用一个agent（代理），真实页面和截图人工复核后提交推送，不操作用户正在使用的窗口。后续单agent要求覆盖旧Goal的多agent文字；持续Goal保持active。OpenAI刷新登录已在874完成、875真实验收，本轮没有再次刷新的必要证据，不重问认证。

898已提交并正常推送be1cf078095ee200c2a1b5ff1e5368b9f2f72251，2026-11-02T07:10:44.907Z fresh HEAD=origin/main、0/0，28本人普通文件/10本地化字段/三索引行干净，177项无关变化保留。已读898完整Recall、22图、资格、原句柄62898/88879/80216 exit0、HTTP（Hypertext Transfer Protocol，超文本传输协议）200与配对副本退休、真实九次产物读取和fresh回执；源898-final严格259662行、schema（数据库结构）9/92表、100项目文件及Git、229附件保全，0模型请求/累计1260。

当前实际线索是898中文18图：交付记录仍以“Task Artifact snapshot b43c89cb-84f7-54f7-a8b4-60f917f4145a”为标题、task_artifact_snapshot为副标题，周围产品界面已中文；801中资源记录副标题同样显示task_artifact_resource。已读根AGENTS、07-panel预览/请求归属、ConversationTurnArtifactSummary完整记录与文件分支、ConversationArtifactInspector完整内容/快照/请求/元数据、ProjectDeliveries完整浮动文件清单与预览、CardNode原turnArtifacts类型、后台snapshotCandidate/resourceCandidate和turn-artifacts声明投影、ArtifactCatalogEntry/版本/source契约、TaskArtifactSnapshotManifest、原发布序号保留与去重、现distinctIdentitySuffix和时间工具。全仓搜索原生成标题、三处Inspector调用、同语义标签及原始身份归属。没有子agent或UI自动化。

## 修改前深度与影响分析

现象与直接触发：展开原发票Task tsk_g00VZHNpHv00U1GVjV5r的交付记录，前端把entry.label与entry.artifact_type或kind直接渲染为主副标题，再把同一title传入Inspector。根因是自动生成的目录技术名称与产品显示名称共用一个呈现值。后台snapshotCandidate明确按真实snapshot_id生成固定英文标题，模型搜索/确切名称与原始资源身份依赖它；resourceCandidate保留真实路径。不能改写后台标签、存量数据或模型消息，也不能靠“Task Artifact”文本匹配识别来源。

旧路径处理正文、完整元数据和数字，却没有区分自动目录名称与界面阅读名称。当前CardNode条目没有保留publication_sequence或created_at_ms，不能凭列表次序创造版本/日期，也不应为这次UI修复扩大数据投影。用原locator.source判别真实快照/资源；快照使用本地化“已保存的文件 / Saved files”，同时存在多个快照时复用现distinctIdentitySuffix对真实snapshot_id计算最短可区分后缀。单一快照无需把整串标识塞进标题；完整标识进入现可展开文件信息，并保持API（Application Programming Interface，应用程序接口）原标签、精确locator和不可变身份。副标题复用现本地化文件快照名称，普通资源副标题用本地化“文件 / File”；引擎产物原类型、用户/模型标题和文件路径保留原文。

特别风险是语言切换：当前createArtifactContentResource把title作为请求身份的一部分，直接把新本地化标题传进去会退休请求、清空快照筛选和已选文件。因此原title继续从原目录事实构造，新增仅用于呈现的可选displayTitle，读取函数的输入/key（身份键）绝不读取它。记录中的显示标题用createMemo（响应式派生）从当前语言和真实身份生成，原openArtifactID仍只用现source/locator。Inspector只把显示标题用于已读取快照的Frame（内容框）标题，当前reader仍拥有原始title/filename/content；资源和引擎内容保持原始命名。FileInformation新增可选snapshotID，取原SnapshotArtifactView既有snapshot memo的真实标识，不新增查询/状态/缓存。

影响与全调用面：ConversationTurnArtifactSummary的两处调用，记录分支传显示标题、直接文件分支保留原文件名；第三处ProjectDeliveries只从declaredOutputs构造task_artifact_resource，继续真实文件名，不新增第二快照入口。Inspector定义与快照内部参数同步，既有元数据定义列表提供完整快照标识；现CSS（Cascading Style Sheets，层叠样式表）已允许长值换行，先复用，不预设样式改动。双语新增已保存文件、文件类型和快照标识字段，07-panel、本记录、三索引及真实截图同步。

不适用：没有后端/SDK（Software Development Kit，软件开发工具包）/数据库/持久格式、版本或发布变化；原请求/连接/目录/Task/Session（会话）/读取/导出合同不变。没有调度/队列/恢复/唤醒/并发/终态异常证据，若出现立即横审全部生产入口、Task/Mission（多步任务）/Session轮次、终态/重试/重启、串并行与多项目。风险包括标签识别依据错误、原身份丢失、多个快照名称混淆、语言切换重新读取并清空资源状态、显示标题冒充下载文件名或污染模型目录。未观测的多快照场景明确标未知，不用夹具或UI自动化冒充实页覆盖。

## 实施与验收

首次before/after均0模型请求、共享75分钟绝对截止、5分钟闭合预留；累计1260不加额。独立CLI（Command Line Interface，命令行接口）38629/38630的/ui/，源898-final单链继承、before复用最终UI，after用Node.js构建私有静态产物，不单开Vite、不动用户18571/窗口/数据库。认证及完整模型目录配对验证/复制/退休。

1. before真实打开原发票Task的快照与原801资源记录，保存技术标题/副标题截图；公共15Mission、原四完整TaskStatus与原发票conversation/快照条目保留。898定位器首次点击偏差尚不能证明产品根因；本轮优先使用新鲜截图中可见控件/原生滚轮再点击，不能把错文件图片当验收。正常关闭本人页/原服务句柄消费0/HTTP200/物理/配对副本闭合与严格旧数据资格后才改产品。
2. 按上述单一呈现方案改两组件与双语；类型、本地化、样式token（设计标记）、文档与Node构建作辅助。不新增、修改或运行UI自动化、DOM（Document Object Model，文档对象模型）断言、组件/源码文案/快照/浏览器测试。
3. after真实用可读名称打开同一原快照、核对完整原snapshot_id和原四资源，打开原test_invoice.py并保留筛选。切换中英文时标题/副标题/标识名称自然更新、原筛选和已选代码保留；原801资源记录显示可读文件类型，原引擎记录标题与类型保留事实；截图人工复核。公共目录原标签、版本、locator及真实快照清单身份逐字段核对，不改模型或执行，不用DOM事实代替视觉。
4. 正常关闭本人页与原服务、配对副本退休、严格全部旧业务行/100项目文件及Git/229附件/源数据库保全；清晰提交，fresh fetch（重新读取远端）、普通merge（合并）、完整待推集合/必要验证、正常hook（钩子）与push（推送）、fresh0/0。持续Goal保持active。

## 修改前真实证据与方案确认

01原快照记录与02浏览器确有同一整串机器名称，03原801两个资源条目确有task_artifact_resource；03首次截图被输入区遮住，保留私有原图后通过独立199页/真实滚轮补齐可见记录，不将AX（Accessibility Tree，无障碍树）文字当作图片验收。原198/199页均关闭，原45573消费exit0、HTTP200、settle物理/输出/请求闭合、认证/完整模型目录配对退休；严格259662→259664仅两本人控制租约、全部旧数据/100项目文件及Git/229附件和源数据库保全，0请求/累计1260，退休余4221371ms。实施前产品未改。

显示标题只进入可选displayTitle呈现参数；SnapshotArtifactView删除未再使用的原title参数，其默认呈现同一本地化“已保存的文件”，不会把目录机器名作为显示默认。原始title仍由唯一reader拥有并参与其身份。只有原source为task_artifact_snapshot才派生快照标识和标题，不检测原label关键字；完整标识使用原snapshot memo。三个原调用面已核对，ProjectDeliveries仅资源调用无需改动。保持所有原文件和引擎报告名字。

## 实施、实页结果与交付边界

只修改两个原组件、双语三键与架构：记录以原locator判别，快照标题使用响应式已保存文件名称，多个同时出现的快照复用原身份后缀工具；快照/文件副标题本地化。原目录标题、source/locator和openArtifactID不变，displayTitle不进入createArtifactContentResource输入和身份键；只更新原已读取快照的标题。完整快照标识进入现文件信息。未添加数据投影、服务、缓存、状态、样式或兼容路径。

04可读快照记录、05同一快照浏览器；06英文文件信息完整b43c89cb-84f7-54f7-a8b4-60f917f4145a及原校验值/大小；07搜索test_invoice并打开原test_invoice.py；08切中文后标题、计数和操作名称更新，test_invoice筛选与原代码仍在原处；09中文记录、浏览器与完整标识。10两个资源条目显示“文件”，11切回英文显示File，原counter.py/test_counter.py路径和中文作者报告名/base/test-report类型原文保持。12通过可见坐标打开原counter.py，13真实滚轮露出正文，确为原next_serial返回value+1。全部13图人工查看，没有拿被输入区挡住的正文或仅AX文字代替视觉；第一张被遮挡03另存私有调查后补齐正式图。

公开before/after初始和最终reader：原15条MissionRecord、四份完整TaskStatus及根Session/目录/生命周期逐字段相等；801与发票Task的完整turnArtifacts和transcript逐字段等于before，包括原“Task Artifact snapshot …”目录标签、原locator、版本/资源和原消息。实际artifact-read返回200，counter.py的45原始字节与before项目文件完全一致，媒体类型及既有不可变引用校验值一致；这是实际不可变资源身份/内容核对，不重算源码摘要。原页面DOM只读观察记录定位与当前文本/输入值作补充，无断言或测试脚本。

before原45573、after原68964均消费exit0，HTTP关闭200、settle原生/launcher退出0、物理身份/输出/请求闭合，四份认证/完整模型目录副本退休。严格259662→259664→259666仅四本人控制租约行，全部旧数据、源数据库、100项目文件及Git/229附件保全；schema9/92表未变，0模型请求/累计1260，最终沿首次绝对截止余3315472ms，无重启/续期/加额或用户窗口操作。

overlay类型、双语2770键、CSS9086引用/402TS或TSX、文档352操作26组与Node构建均exit0，实页main-EtX01Pmw.js；保留既有大chunk（构建分块）提示。纯UI未新增、修改或运行UI自动化。实际数据只呈现单快照，不宣称多快照后缀、其他尺寸、断线/错误、连接轮换或ProjectDeliveries入口已作视觉覆盖；后者已确认只传原资源，UI合同未改。Git范围审查、正常同步/推送/fresh结果以本轮delivery回执为准，Goal保持active，后续继续整体体验。
