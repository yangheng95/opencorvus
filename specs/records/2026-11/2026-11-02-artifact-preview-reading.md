# 交付文件预览的信息层次（898）

## Recall

用户要求只用一个agent（代理）持续自主排查整个UI（User Interface，用户界面）/UX（User Experience，用户体验）与功能，真实页面、截图人工复核后提交推送，不操作正在使用的窗口。刷新OpenAI登录已于874完成并在875真实Provider（模型服务提供方）验收；后续未过期证据仍有效，不重复刷新。旧Goal中的多agent要求由后续单agent要求覆盖；持续Goal保持active。

897已正常推送337ccf0a4ad7cbb42dff08997983290d9cf8b43a，fresh HEAD=origin/main、0/0，177项无关工作区变化保留。897-after严格259656行、schema（数据库结构）9/92表、100项目文件及Git与229附件保全；原65054消费exit0、HTTP（Hypertext Transfer Protocol，超文本传输协议）关闭200、物理资源及配对凭据/完整模型目录退休，累计1260模型请求。本轮继承同一已退休源，只读原15条Mission（多步任务）和四份Task（子任务）状态，不创建执行。

已读897完整Recall、当前07-panel预览/请求归属合同、ConversationArtifactInspector完整加载/请求/内容分流和快照资源选择、ConversationTurnArtifactSummary交付入口、既有Disclosure（原生折叠区）/ArtifactFrame和conversation样式、双语目录、882执行导航调查。全仓搜索inspect、metadata、byte_count及共享入口。左侧短线为882已交付的紧凑导航，不重新认定为闪烁。当前线索是普通交付文件的正文之前固定展示mediaType（媒体类型）和截断SHA-256（安全散列算法256位）摘要，快照浏览器同样如此；是否实际妨碍阅读须先在原文件预览中确认。未运行UI自动化。

## 修改前深度与影响分析

直接触发点：点击真实交付文件进入ArtifactContentView，或展开文件快照进入SnapshotArtifactView。两处都固定把原始媒体类型、字节数、sha256短串排在正文或资源列表之前，完整摘要只能依赖title悬浮，缺少字段说明。公共reader返回的真实内容元数据由这里直接输出，属于呈现层次问题，不是源数据或校验失败。

旧路径改善了外部全屏、CSV（Comma-Separated Values，逗号分隔值）和JSON（JavaScript Object Notation，JavaScript对象表示法）阅读与请求归属，却保留了始终展开的技术行；普通用户需要先理解这些机器标识才能进入正文。不得删除真实完整性信息、伪造类型、将摘要检查当验收或增加第二reader。before实页若不支持该现象，停止这项产品修改并如实记录。

拟定方案：保留原正文渲染、原文件资源、请求/连接/目录/Task/locator（资源定位符）归属、导出和快照选择；用一个本组件内共享的文件信息呈现组合替换两处同语义技术行。通过既有原生Disclosure提供“文件信息 / File information”入口，默认先读正文；展开后使用本地化字段名称展示原媒体类型、按当前语言格式化的原字节数和完整SHA-256，长值允许换行。Disclosure状态由浏览器拥有，不另建状态/缓存/持久偏好，不用悬浮作为唯一读法。此处是两处已证实重复的同语义呈现，可共享；其余文件大小、producer（产生者）、技术记录原文不扩散清理。

影响覆盖共享外层普通资源和快照资源预览的两个调用点、一个同文件呈现组合、既有样式和两个语言目录、07-panel/本记录/三索引。没有API（Application Programming Interface，应用程序接口）、函数对外合同、后端、SDK（Software Development Kit，软件开发工具包）、数据库或持久格式、调度/队列/恢复/唤醒/并发/终态变更，当前无这类异常证据。若真实运行出现执行异常，立即按AGENTS横审全部生产入口、Task/Mission/Session（会话）轮次与终态、重试/重启、串并行和多项目隔离。风险是折叠区挤压内容、完整摘要横向溢出、键盘难以展开、关闭后请求或选中资源被重建，以及语言切换遗漏。

## 实施与验收

首次before/after均声明0模型请求、同一75分钟绝对截止和5分钟闭合预留；累计1260不加额。独立CLI（Command Line Interface，命令行接口）38626/38627的/ui/真实页面，before复用897最终构建，after用Node.js构建私有静态产物；不单开Vite、不动用户18571/窗口/数据库。复制认证时同时复制完整models目录文件并按原约束验证、退休。

1. before只读打开原741完成Task、真实README.md和原交付记录快照，保留正文前技术行截图。原四Task状态、15Mission、全部旧行/100项目文件及Git/229附件作为保护证据。正常关闭本人页、原句柄消费exit0、HTTP200、物理/配对副本退休和严格资格后才改产品。
2. 按上述方案替换两处重复技术行，保持完整真实值与原请求/渲染owner（归属者）。纯UI不新增、修改或运行UI自动化、DOM（Document Object Model，文档对象模型）断言、组件/源码文案/截图测试。类型、本地化、样式token（设计标记）、文档检查和Node构建只作静态辅助。
3. after真实README正文、CSV表和JSON树默认阅读、鼠标与键盘展开/收起文件信息、完整真实元数据、快照选择资源和中英文截图人工复核。真实reader返回值与原资源身份辅助核对；不将DOM事实、静态检查或fixture（夹具）当视觉验收。
4. 正常关闭本人页/服务、原exec消费0、物理/输出/请求/配对副本闭合、严格旧数据资格，补齐实际覆盖与限制。清晰提交；fresh fetch（重新读取远端）、普通merge（合并）、完整待推集合审查、正常hook（钩子）和push（推送）、fresh0/0。持续Goal不置complete。

## 修改前真实证据与方案确认

01是原741 README真实预览，02是同Task的engine_artifact（引擎产物）JSON交付记录，03是原发票Task tsk_g00VZHNpHv00U1GVjV5r 的真实快照b43c89cb-84f7-54f7-a8b4-60f917f4145a，四个资源为README、invoice.py、test_invoice.py、verification_report.md。三图均人工查看，均在正文/资源列表前固定显示媒体类型、未本地化数字和只能悬浮完整阅读的短摘要。公开conversation reader（对话读取接口）检查原8个子Task定位后才选中持有真实快照entry的发票Task，不根据payload（载荷）中引用过快照就假定有可点击快照。原741/801导航和文件内容保持原事实。

before本人195页关闭、原62898消费exit0、HTTP200、settle/配对副本退休，严格259656→259658仅两本人控制租约、schema9/92表、全部旧业务行/100项目文件与Git/229附件保全、源数据库和认证/完整目录元信息不变，0请求/累计1260、退休余4249082ms。真实证据支持上述方案；实施前未改产品文件。

## 实页发现的同一区域计数问题

after 11/13图真实快照筛选test_invoice后显示“1 resources”。直接触发为filteredResources.length=1；根因是SnapshotArtifactView使用独立resource_total固定复数字符串，而交付记录已用resource_count及tc（本地化单复数函数）。全仓搜索证实resource_total唯一生产调用在本组件，两个语言目录各一条定义；旧改善没有统一这两处同义计数。选择复用既有resource_count/tc，删除两个已无调用的resource_total字段，避免第二计数词源。仅UI文案/目录和单调用改动，无数据/API/执行合同影响；风险是复数或中文计数变化，须最终新构建实页验证原四项、过滤一项和中文计数。维持首次0请求和绝对截止；先正常关闭196页及原88879服务exit0/HTTP200/退休/资格，再用38628新增最终不可变构建验收，不重启原服务或覆盖其UI发布。

## 实施结果与真实复核

共享ArtifactFileInformation只在原组件内组合现Disclosure和定义列表，替换普通内容与快照浏览器两处固定技术行；默认折叠、原始完整值可选择阅读/换行，无新增状态/缓存/reader。文件大小和快照资源字节数使用当前localeTag格式化；过滤资源数复用原resource_count/tc并删除两条无调用旧词源。请求、连接/项目/Task/locator归属、内容分流、导出、快照选择与后端/schema保持原实现。新增四键、删除一键，各双语完整同步，未扩大到其他文件列表或产生者命名清理。

04/05英文README正文、Enter展开与收起；06/07原CSV三行；08 JSON原四节点；09引擎交付记录完整信息，10,823字节分组；10原快照四资源默认折叠信息，11过滤test_invoice并展开原1,359字节清单，12真实代码，13再次键盘收放后原筛选与已选代码保留。11/13同时保留最初“1 resources”发现证据，最终14已为“1 resource”，15为原四资源/完整清单信息，16为test_invoice.py原1,520字节和完整校验值。17/18中文仍保留同一资源/筛选，字段、大小、四项/一项计数均正确；19/20是真实JSON中文正文/完整信息，21/22为原README中文默认正文/完整信息。22图全部人工查看；原文、文件名、媒体类型、目录树标识与完整校验值保留事实身份。

两次首次通过定位器点击README后实际展开review-summary.json；未把错文件图片当成README验收，第一张另存私有调查，19/20以真实JSON身份命名。本人页刷新后，只读DOM（Document Object Model，文档对象模型）事实显示README已在屏内y128.859375/高62、跟随true，故“屏外”只是最初假设，并未成立。按真实截图可见坐标650,160直接点击，准确展开README、跟随转false，随后可见坐标展开文件信息、Enter收起均准确，21/22保存正确结果。已读Button透传、单一output identity闭包及共享setupAutoScroll焦点/读取意图/程序滚动归属；目前只能证实定位器路径与可见坐标路径结果不同，不能证明产品选错文件根因，不改写既有滚动合同，也不把未查清的工具内部原因包装为已根治。此现象保留为后续手动体验线索。

真实artifact-read接口共9读取：八个原交付资源的实际响应体逐字节等于before保存的原项目文件，媒体类型/大小/既有不可变引用校验值与Content-Range（内容范围）一致；原快照清单的四资源逐字段等于原declaredOutputs。这里只验证真实不可变资源身份/内容，不重算源码摘要。私有checker最初错误要求206，读服务的公开200响应契约与c.body(bytes,200)后修正checker并重跑成功，没有为工具假设更改产品。最终构建再次9读取成功。15条原MissionRecord及四份完整TaskStatus在各阶段开始/结束都与before逐字段相等，根Session、原状态和目录保持，未开始/恢复/取消执行或发送消息。

before原62898、after原88879、final原80216均消费exit0，各HTTP200/settle原生及launcher退出0、物理身份/输出/请求结清、认证及完整模型目录配对副本退休。严格259656→259658→259660→259662仅六本人控制租约行，三阶段全部旧行、源数据库、100项目文件及Git、229附件保全，schema9/92表未变；0模型请求/累计1260，最终沿首次截止余3030277ms，无重启续期加额或用户窗口操作。

最终overlay类型、两语言2767键、CSS（Cascading Style Sheets，层叠样式表）9086引用/402TS或TSX、文档352操作26组与Node构建均exit0，最终页面main-VmqKCqRv.js；保留既有大chunk（构建分块）提示。相关检索到的测试路径未出现UI渲染/源码断言/快照/浏览器测试入口，未新增、修改或运行UI自动化。媒体/PDF（Portable Document Format，便携式文档格式）/二进制、断线/错误/连接轮换和其他尺寸未作本轮视觉覆盖；完整产品体验仍持续，不宣称全部界面问题完成。Git范围审查、正常上游同步/推送及fresh结果由本轮delivery回执提供，持续Goal保持active。
