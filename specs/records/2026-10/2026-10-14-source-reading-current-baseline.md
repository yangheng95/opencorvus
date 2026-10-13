# 当前基线的真实 Sources 阅读体验

## Recall

用户要求持续自主迭代，主要问题是Sources显示及成员侧栏Rendering闪烁；随后明确只允许单agent。旧goal的Astra并行文字已过期，不执行。前一批为progress：fdf86894e9463987be9fa801190b6724cdec2ca9已由远端main确认，196项后台用例及正常push检查通过。用户明确删除旧数据并从当前版本迁移，当前用户库已建立版本1，本轮不恢复原Research Studio历史或版本0实验副本。

原394调查记录719 Message/209 Source，但未取得当前UI资格。349真实37份正文/36次webfetch曾完成长子会话检查，仍有主会话位置改变的未明现象。本轮不把旧图、历史计数或代码存在当作当前视觉通过。先核对当前共享Sources路径，以新真实记录检查Sources阅读，再依据证据推进成员/流式问题，不声称一个主会话覆盖全部目标。

已读当前AGENTS、394 Recall与349验收限制，SourceParts、CardParts、Markdown worker服务、messages.css、07-panel的来源/阅读意图/异步正文合同、正式serve和overlay-ui静态资源入口、成熟NativeService实测启动与关闭脚本。没有委托。computer-use技能已读取，浏览器按CUA能力操作；不操作用户已有页面/进程。单agent约束同样体现在本轮只运行一个手动产品会话，不为验收派发专家团。

## 调查与影响面

用户原图显示每个Tool下单独Sources 1和大量空白、反复Rendering。当前SourceParts第一来源直接可见、其余来源由Disclosure控制；URL正文、host/fragment、来源摘录与复制已有独立语义。CardParts按来源/普通Part的连续run渲染，SourceEntry按type/session/message/sourceId稳定；群组展开key另用首sourceId。TextPart使用异步worker与有限完成缓存，保留已显示正文。是否仍有布局拥挤、分组状态串扰或组件替换导致占位，需要真实运行证据，暂不预判根因或改缓存。

共享范围包括主对话、引用侧栏和成员对话的SourceParts/CardParts/TextPart、来源真实数据及Tool绑定、阅读锚点/展开状态、主题和当前语言。当前会话/side-chat服务有其他任务未提交改动，保留且不混入本批提交；需要修改共享文件时只处理有证据的本批范围。后端接口、schema及调度暂不修改。若发现队列/重启/终态异常，立即按共享入口、Task/Mission/Session轮次、正常/终态、重试/多项目横审，不能归因模型偶发。

## 执行方案与验收

1. 使用当前前端正式build:vite，复制输出到本轮独立bundle，正式开发serve提供localhost的/ui；不单开Vite，不注入DOM或造消息。新建独立runtime和空QA项目，保留用户的当前新库。
2. 复用既有391 NativeService启动/物理监督/公开shutdown流程，仅更换本轮路径和标识。运行前复制授权auth.json与完整models.json配对，分别核对usable、projected和实际模型；只记录脱敏回执。真实gpt-6.1-sol全程流式，累计最多16请求（含预检/标题），180秒无活动和既有服务物理期限保持，不延长一个失效owner。
3. 先打开隔离页面，再在一个正式手动会话请求逐次读取公开资料并保留实际Sources/正文。使用真实页面交互检查首来源/多来源、长标题和目标、摘录、复制、工具展开、正文更新和侧栏可用阅读入口。来源身份以原API事实核对；截图人工查看，不新增或运行UI自动化、DOM/源码/快照断言，不用分数替代视觉。
4. 有问题先补可观察现象、触发、根因及影响分析，再修唯一当前路径并同页面复验。纯UI改动不加自动化测试；涉及后台合同才运行聚焦正向测试。每个视图资格分开记录，没有成员流式证据则继续保留该未完成项。
5. 完成后关闭自己的页，通过公开shutdown关闭本轮服务，核对Native/Host/输出/request/端口和凭据配对退休；原句柄必须join。保存截图、模型/数据/退出事实和失败原文。同步spec索引与文档检查，范围提交、fresh fetch/merge和正常push，goal继续active。

## 已完成的真实运行

NativeService在18517/ui运行当前build:vite产物；构建81秒正常结束，没有独立Vite服务器。主会话ses_-zUS2N5z9zzkTWMo2EWo由真实页面发送两条用户消息，完成3次webfetch、1次read和1次websearch，产生7条原始Sources、7条assistant Message。侧聊ses_-zUS2MLXZzzk58TG4GTB由产品正式入口创建，包含9条继承历史、7条复制来源；这些引用副本不算新检索或再次执行的工具。只读持久事实checker验证7条来源均绑定同Message的completed Tool，侧聊来源payload与原来源精确相同，Tool身份按规范fork重映射。

12次实际gpt-6.1-sol请求均streaming=true、HTTP200且reader以eof结算；包含预检、主work对话及产品自动memory辅助请求，不代表12个工作agent或12次网页读取。累计上限16，未增加额度。没有发起专家团或委派。

11张原始JPEG均已人工查看：01流式开始；02读取继续时复制来源；03实际粘贴出的完整URL；04三条搜索来源展开；05侧聊准备完成；06引用历史展开；07侧栏正文/单来源；08侧栏三来源及两行长标题；09来源摘录；10中文重开后的来源；11实际README文件编辑器。主Sources首条可见、其余两条可独立展开；侧栏宽380像素时长标题自然换行且站点与动作保留。中文来源摘要/展开/复制名称、日期及文件行数正确，本来为英文的网页标题与工具原始结果仍保留原文。复制已通过真实Ctrl+V输入框粘贴验证，未发送粘贴草稿。

本轮短会话未观察到重复Rendering替换已有内容。新页面中文重开首次出现单次“正在渲染…”随后正文就绪，不能据此认定持续闪烁。原Research Studio长成员历史、超过32份正文的逐出/流式交错、成员自身生命周期、网页目标实际导航、浅色模式仍未在本轮验证；后续继续这些范围。无证据支持当前需要修改Sources生产代码，因此本批只交付真实证据，不把未复现当作所有问题已修复。

浏览器工具原连接2已不可用，当前库存为4；更换至实际可用的IAB后创建自有页1。第一次打开设置后，该页从所属session清单消失，根因未知，未归因产品；按当前空清单新建页2继续，未刷新或重启用户窗口。工具clipboard读取返回空，但实际复制后Ctrl+V得到准确URL，因此没有把工具观测局限误报为产品复制失败。Summary控件的一次Playwright role定位无匹配，按最新AX原生索引成功展开；未修改页面DOM或加入UI断言。

03:53:31（本地）Target80220正常exit0，Host84468及输出/请求清理完成；公共shutdown的关闭者/端口/物理身份核验和auth+models配对清理均通过，晚于最后截图但早于03:54:41固定期限。原启动句柄40117已join exit0，自有页1已消失、页2主动关闭，浏览器清单为空。原用户库未使用或改动。新QA库保留在私有runtime，版本1，可用于后续真实历史阅读，不恢复被删除的旧数据。

证据入口：[真实页面与数据回执](../../artifacts/2026-10-14-source-reading-current-baseline/README.md)。只读实际数据/模型/退出checker通过，docs:check与architecture-index通过；本轮没有生产代码修改，接下来范围提交和正常push。下一批优先在当前基线的新真实长对话中跨越32份Markdown正文缓存边界，结合主对话继续输出与侧栏阅读/重开，追查原闪烁和349记录的主区跳位；保持单agent，不以本次7条来源替代长历史资格，持续目标保持active。
