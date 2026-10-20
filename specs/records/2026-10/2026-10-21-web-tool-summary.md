# 网页工具摘要与 Sources 阅读

## Recall

持续单开发 agent，不委托；用户后来明确的单 agent 要求覆盖长期 Goal 中旧三个 Astra 文本。上一轮484为 progress：完整原配置对照明确隔离 helper 创建仍为15秒级，10秒保存/5秒恢复未达；复杂私有传输未交付。aa2287c0ffc88a6706e87c54f7552eb3d7fae70f 已正常推送，fresh fetch 后 HEAD=origin/main。原 scope 全结算，私有凭据已退休；仅原 .bun/ 和 packages/opencorvus/bun/ 未跟踪。

用户原要求持续深入体验、修复并提交推送，优先 Sources 显示与成员侧栏 Rendering 闪烁。482已修复主会话聚焦来源在宽度重排时的阅读锚点；它没有重新设计工具摘要。原完整配置性能问题继续保留，不能以本轮界面改进替代其验收。

已读 AGENTS、482/481/484 Recall、07-panel 中工具与引用展示契约、07-panel-reactivity 的阅读与渲染契约，SourceParts、CardParts 的顺序分区及 ExecutionToolIdentity、InlineToolPart、utils/tool 的唯一摘要投影、webfetch 生产器和现有隔离开发入口。全仓精确调用搜索确认 describeToolCall/displayToolDetail 的使用由同一 utils/tool 提供，Main/Side/成员经相同工具行呈现；未发现相关界面自动化测试。没有委托反馈。

## 修改前调查与边界

可观察线索：用户原图里每次 webfetch 的完整 URL（Uniform Resource Locator，资源地址）与媒体类型占据整条工具行，随后另有来源行。当前 SourceParts 已显示真实标题与站点，但摘要仍独立读取工具标题。直接代码流为真实 Tool state → displayToolDetail → describeToolPart → ExecutionToolIdentity，另一处 InlineToolPart 使用同一投影。通用摘要先选择真实 state.title；webfetch 的标题包含请求 URL 和响应媒体类型。来源事实不是通用 Tool 的子属性，不能按相邻 URL 或正文猜测绑定、隐藏工具或合并真实消息。

旧修复主要处理引用身份、来源标题、密度和宽度锚点，未改变 webfetch 的工具身份投影。是否当前实际画面仍受该标题挤占，须先用482实际网页会话的完整副本和正式482前端截图确认，未复现前不修改生产。语义事实包括真实请求、结果、错误、Source、URL、媒体类型均保留；不变更 Provider、工具执行、持久化、接口、数据库 schema（结构）或调度。无调度/恢复异常证据，相关共享运行机制不在本轮修改范围。

风险：过度缩短 URL 会让同站不同请求无法区分；替换成来源标题会混淆请求身份和出版物身份。若确有问题，优先在既有唯一摘要函数按 webfetch 的结构化 input.url 投影完整请求地址，避免把响应媒体类型当定位文字；完整结果事实仍通过原输入/输出/元数据披露。错误继续优先展示原真实 failure。不能解析标题字符串或添加缓存、第二数据源、后备协议、合成消息。

## before 实际确认与实施裁决

原39640/18847使用完整482原事实副本与冻结正式482 UI；自有53页通过原侧栏会话入口和原 Agent activity 跳回真实首轮，两张人工图01/02确认宽区完整 URL+媒体类型重复占据工具行，窄区出现 `text/html; c…` 与 `(t…` 媒体类型残片，两个真实 Source 标题和站点本身保持可读。没有来源数据错误或重复 Rendering 证据。直接根因是通用 state.title 用于定位摘要，webfetch 把响应媒体类型拼入该标题；修复只在已有 displayToolDetail 的精确 webfetch 工具分支读取真实 input.url，完整 URL 继续作为摘要与其原 hover/无障碍名称，不缩短或猜测出版标题。若参数尚未形成 URL，摘要为空，原 pending/running 状态继续提供。完整输入/结果/错误均沿原披露；纯界面投影不改生产工具返回值或新造类型。

## 实施前方案与验收

展开代码复核发现现有 InlineToolPart 在有正文时不显示原 state.title，媒体类型仅存在持久结果，不能宣称原详情已提供可见响应标题。本轮同步在同一 webfetch 的完成态原详情内显示该完整原标题，使用现有 msg-tool-state 排版，不解析、重写、翻译或新造结果事实。原参数与正文输出披露仍各自保留。第一轮摘要构建4708/类型9564已exit0，最终验收须等待包含此详情改动的新构建，不将初版当最终版本。

1. 新485 scratch 与独立运行根，源为已关闭的 web-sources-live-482-data；SQLite（Structured Query Language，本地关系数据库实现）readonly 事务 serialize 全库，原七表含 rowid/data/time 全部保留。独立 HOME/config/log/tmp；不操作用户18571、用户数据库、窗口或旧服务。不得复制 auth/models 或发模型请求；Sources 来自原真实已完成工具，不伪造历史。
2. before18847 使用冻结482正式 UI（User Interface，用户界面），after18849 使用本轮正式构建 UI，均由原开发 CLI（Command Line Interface，命令行界面）/ui、413 owned-host 与446原生监管器提供，20分钟资源边界；180秒无活动只代表观察失败，不重启原句柄。每次按精确 PID（Process Identifier，进程标识）/出生时间公开 shutdown 后 join 原物理/output/request/launcher，才准备下一 scope。
3. 先实页打开同一真实 Sources 段、截图人工查看，确认后补足具体根因并实施唯一投影。对照同一会话、宽窄区域、展开真实工具输入/输出、来源标题与完整提示；用页面交互切换中英文，保持工具/出版内容原文。只通过人工视觉评审，不新增/运行任何界面自动化、DOM（Document Object Model，文档对象模型）/组件/文案/截图断言；类型、语言、构建只作为辅助检查。
4. 修改前再审查全部调用点与真实 webfetch 数据。若没有足够视觉收益或破坏身份，调整同一投影并重建实页，不能将截图记录当修复。仅显示改动无需伪造非界面契约测试，后端不修改。source 数据与原七表逐项核对，以公开读取证明真实数据，不以 UI 文本断言代替截图。
5. 完成后归档人工截图、真实对象/数据与原 scope 结算、检查结果，同步根/月度/产物索引及 docs。仅本轮文件提交，fresh fetch/merge、完整 pending 审查、正常 hooks 推送并复核远端；不创建分支/工作树、版本、Release、tag 或拉取请求。长期 Goal active，未覆盖新流/成员真实网页场景或原配置性能时明确保留。

## 实际结果与交付范围

before原39640/18847在冻结482正式UI复现媒体类型残片，after原19152/18849在最终本轮构建实际复核。共11张实图全部人工查看：04对02的相同窄区两条请求地址完整显示；05/06实际展开响应标题、媒体类型/编码、结构化url/format和真实输出；07回宽区原两条来源仍可读；设置切换中文后08—11的导航、来源动作、输入/输出标签与提示保持当前语言，实际出版标题/工具名/URL原文保留。09实际Shift+Tab聚焦原来源，完整标题、地址与本地化网页读取提示可见。03有悬浮Agent activity提示遮挡，作为早期画面保留，未宣称清晰宽区通过；07顶部用量提示不遮目标区域。

非界面原数据checker完整核对源与两个副本的七表87行，含rowid/全部字段/时间逐项保留，源库size/mtime原样；各副本只增加自己的1个Project，最终5 Project/4 Session/schema3，canonical{}。after公开Session GET200，原两条Source的真实id/message/toolPartID/URL/标题逐项一致，原两个webfetch completed、正文5088/16346字符、原响应标题仍保留。原工具执行与Source生产器均未改，公开读取与数据库原事实不能替代人工页面资格。

原检查器初次误认为Part data包含id/message_id，实际身份来自关系列；原fe0fc9公开读取200之后校验失败，修正列投影重跑原checker通过。关闭工具初次使用Windows PowerShell5，现有ProcessStartInfo.ArgumentList不可用，原713390 exit1；使用PowerShell7对同一原scope正常shutdown，没有重启服务。一次patch上下文不匹配未应用，复核后精确重新应用。最终正式UI构建原66071 exit0/51.35秒，类型原14580 exit0，两语言2523键；初版构建4708/类型9564也exit0，但最终页面使用包含详情补全的新构建。

两个原scope公开shutdown200、原39640/19152均join0、精确物理/output/request/launcher全部结算后，自有53/54关闭。未复制凭据或模型目录、未发预检/模型输入；只有482已保留的真实工具历史，不消耗或复活旧预算。after终态又完整核对原数据与schema3，用户18571/用户库未操作。生产修改仅utils/tool唯一摘要与InlineToolPart原详情，共6行新增；当前07-panel契约同步，无新持久化、接口、调度、locale键、CSS（Cascading Style Sheets，层叠样式表）或UI自动化测试。

本轮资格限定真实完成态主会话的网页摘要和详情，Main/Side/成员共享调用已审查/类型通过，但没有新流或成员真实网页E2E（End To End，端到端）资格，不能宣称全部Rendering闪烁已修复。原完整配置10秒保存/5秒恢复仍未达；未修改该实现。[11张图片、公开原事实与完整结算](../../artifacts/2026-10-21-web-tool-summary/README.md)同步三索引，范围提交与正常推送后继续长期Goal。
