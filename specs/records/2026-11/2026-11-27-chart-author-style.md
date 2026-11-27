# 作者图表配置与主题缺省的原生优先级

## Recall

- 用户要求本人持续迭代、不用子代理，先根因/影响落盘、真实桌面交互截图人工复核、聚焦正向检查和必要真实Sol任务，提交/普通上游合并/正常推送后继续。已授权凭据和完整模型目录配对、精确openai/gpt-6.1-sol、请求不限且全部流式。不创建分支/工作树、发布/标签、其他线程，不碰用户窗口/进程。
- 上批c6d0f1e3a217ba12c1bda77a7286c29da7025397已交付导出底色及旧背景信号排除，push（推送）原句柄7169退出0；本地/上游/实际远端一致、0/0、暂存空，原177项状态保留。10请求全部settled/eof（物理读取结算/流结束），run57–59正常退出、配对副本退役、原句柄已join（等待），自有标签全部关闭。
- 已重读上批Recall/限制、07-panel现行主题与View（视图）生命周期、theme-color/inline-vega-view、Chart/Dashboard和发布指导。保护当前22文件、2042旧持久行（343消息/1028部分/325请求/325结果/21产物）及样本HEAD，私有完整基线留仓外，不归档凭据、模型目录、完整数据库或加密推理。
- 上批真实截图已发现：新Dashboard在浅色主题下，config.background=#172b4d确实生效，但作者明确config.axis.labelColor/titleColor=#eef2ff被产品深色轴覆盖。旧框选图明确config.background=#FFFFFF、部分黑色text，深色产品默认浅轴/标题在该白底上失配；其深色截图不算视觉通过。已复制这些真实发现图及原payload（载荷）为本批基线，不能凭名称推断。

## 修改前根因、影响及排除

- 直接触发：作品在config中声明完整设计或切产品主题。唯一artifactVegaConfig先铺source再铺defaults；axis/legend/title/view还显式先作者后产品，font/range/bar/point/line等块也整体被defaults覆盖；text与background另有作者优先特例。因此同一种原生配置出现两种优先级，轴/标题/图例及部分作者字体、数据类别配色可能被吞，局部text/背景修复没有根治。
- 当前[官方Vega-Lite配置合同](https://vega.github.io/vega-lite/docs/config.html)允许config统一定义axis、title、legend、mark、range等。已安装vega-embed7.1.0实际通过公开vega.mergeConfig合并主题和用户配置；vega-util2.1.2的mergeConfig按后者字段优先合并配置块，额外处理signals按名合并、legend.layout/style递归及非法原型键拒绝。可直接复用成熟原生实现，不复制一套深合并或逐字段颜色特例。
- 全仓搜索：artifactVegaConfig只有inline-vega-view一个调用；该helper是Chart及Dashboard每个子图在消息/项目交付两入口共用的唯一View生命周期。artifactVisualTheme还被Map、Network、Diagram共享；它们不调用Vega配置，不能为了复用合并函数让这些渲染器新增重型Vega导入。计划将现有Vega专用配置函数移到其唯一Vega helper，设为私有，复用已声明vega-embed公开vega命名空间，不新增依赖或平行实现。theme-color保留通用令牌读取与主题类型。
- 风险/边界：这是统一作者配置优先级的合同调整，显式autosize/font/range/各mark样式也随原生规则生效；必须真实检查默认旧作品布局和筛选/选区、显式新设计与原生下载。root规格/mark/encoding继续由原生库决定更高优先级；上批背景、根width/height/background信号排除和工具提示归属不变。数据、工具能力/路由、持久格式、下载协议、外部资源加载器及内容安全策略不改，无迁移、无第二配置面。
- 不推测作者配色：只有固定背景、缺少相配前景的旧作品，本身没有足够声明来保证跨主题对比度。不能按颜色字面量猜浅深或重写历史payload；本批修复明确声明被吞，并在原有共享创作指导说明固定背景应同时声明文字/轴/标题/图例对比色。旧不完整设计依然作为限制保留；通过真实新任务验证完整声明能保持。界面不添加无依据告警或隐形修色。
- 发布指导只有CHART_ARTIFACT_THEME_GUIDANCE一个片段，已查Chat/Work与两个实际发布工具注册入口，追加说明必须沿同一片段投影，不加host（宿主）路由、白名单/发现步骤或合成消息。其后端正向集成测试可运行，禁止UI（User Interface，用户界面）文案、DOM（Document Object Model，文档对象模型）、组件、快照、Playwright或像素自动化；页面只做本人原生操作和人工复核。
- 无已发现的调度、排队、唤醒、恢复、并发或执行终态异常。若出现，立即按全部生产入口、Task/Mission/Session执行轮次、正常/终态、重试重启、串并行/多项目隔离横审，不能凭单用例或模型自述排除。

## 实施前方案与真实验收

1. run60复用正常退出run59，分别验证配对凭据、模型目录及实际精确流式模型。在真实开发页/ui/复核当前新Dashboard轴色失配。新的真实创作任务放到更新指导后的最终候选执行，确保实际模型上下文和工具描述都包含修订；从项目home（首页）输入框要求根据sales.csv发布完整固定浅色设计的销售图，以config统一表达背景/文字/轴/标题/图例与类别配色，保留所有负数/零值及5/35.60事实，不改源文件/创建执行单元/分派工作。
2. 把现有唯一Vega配置函数移到唯一调用helper，使用vega.mergeConfig(themeDefaults, authoredConfig)；删除旧手工混合优先级实现。通用主题函数保持轻量。共享指导补固定背景的完整对比设计要求，07-panel说明主题只负责未指定字段，明确作者设计保持。
3. 后端聚焦提示/工具正向集成检查及必要类型/构建；候选构建后正常停止/join旧服务并另启run61。本人真实切深浅/语言、原生展开/关闭、旧Dashboard筛选、旧框选和新完整设计；逐张截图人工查看。实际原生SVG（Scalable Vector Graphics，可缩放矢量图形）/PNG（Portable Network Graphics，便携式网络图形）下载及正式工具/产物API（Application Programming Interface，应用程序接口）、CSV/旧行/文件/SQLite checker（检查器）交叉验证。独立SVG仍仅本地安全渲染，禁止绕行浏览器已拒绝的file协议。
4. 同步三个索引各一链接、文档检查、范围清晰提交。fresh fetch/普通merge（拉取并合并）上游、审查完整待推送集合、正常push/join原句柄、核对实际远端与原177状态后继续下一批。不宣称旧不完整配色、Office、移动端或用户原生编辑器已通过。

## 实施及当前验证

- run60真实页面58170，三项模型预检通过。本人展开同一真实Dashboard并滚到蓝/绿背景图，截图`before-explicit-axis-colors.png`确认浅色主题下坐标数值/标题确实偏暗，与持久作者#eef2ff声明不一致；不是单纯模型配色遗漏。run60两请求全部结算/流结束，已正常停止清理，原句柄20166退出0，自有页面关闭。
- 现有默认配置块原样移入inline-vega-view的私有函数，只用公开vega.mergeConfig合并default/source；theme-color中原手工实现及特例删除。全仓搜索确认只有一个定义/一个调用；公共Map/Network/Diagram令牌读取不引入Vega。共享指导只追加一个固定背景对比设计句子，声明与Chat/Work实际入口同源，无新路由或隐藏工具。
- 后端提示/工具正向集成3项/5断言通过；类型与构建51.72秒、renderer公开表面检查通过，原构建句柄93481退出0；文档353操作/26组及架构20文档通过。不新增/运行UI自动化。新候选run61将加载当前构建并执行真实新创作及页面复核，尚不据此声称视觉完成。

## 最终真实任务与人工复核

- run61开发服务51443使用当前构建，原同一Dashboard浅色行内页面现按作者#eef2ff呈现蓝/绿底的轴文字和轴标题，截图人工确认清楚。最初一次关闭作品动作发现窗口已处于行内状态，按实际页面重新取证；未把点击尝试或不存在的关闭按钮当作成功。
- 从真实项目首页提交固定浅色报表任务，session `ses_hrwcHDrDJe7cezsinVXK`；正式read `prt_g0Vc9maU900mZqCerajT`、Decimal计算bash `prt_g0Vc9mbdn00sMsHkimrm`、publish `prt_g0Vc9mhkR00PtH7fdGVA`均completed，产物 `art_g0Vc9mmkV00BbTrQxUBF`/chart@1，最终finish=stop。四个原始字段及派生订单类型逐行匹配，5/35.60、华东3/28.25、华南2/7.35正确。
- 模型以config统一声明#f4f7fb背景、#1b2430文字/轴/标题/副标题/图例、13轴文字和18标题字号、sans-serif字体及#2563a6区域柱色。本人原生展开/关闭、切深色及英语，完整浅色设计均保持清楚，原作者中文/编号/备注保留。原生点选A003实际明细显示华东/-2.05/退款。没有在host根据颜色字面量另选配色，没有改写历史产物。
- 本人另打开原Dashboard，汇总5/35.60、五条订单金额与布局正常；退款筛选实际显示1/5、1笔/-2.05、零金额0，清除操作恢复筛选。旧原生框选A001+A002显示30.30/2，关闭/展开、英语转中文重建后选区保持。未声称该次旧Dashboard第三张区域图或所有历史作品均逐张新验收。
- 两份真实下载：`visualization (8).svg`33802字节、`visualization (5).png`86588字节，均911×562。原生下载真实字节核对后归档；SVG只读本地呈现和实际PNG都已人工查看，完整浅色背景、标题/坐标/图例、五订单及区域净额/笔数清楚。没有浏览器file导航绕行，没有后处理产品导出或像素/摘要验收。
- 正式产物API与checker核对22原文件、2042旧持久行、样本HEAD、SQLite完整性、原CSV逐字段/Decimal汇总和实际下载身份全部通过。10张本批原生截图（9最终/1修改前）均人工查看，另1张本地SVG呈现和原生PNG；[证据目录](../../artifacts/2026-11-27-chart-author-style/README.md)。

## 后台物理读取错误与真实恢复

- run61请求审计有一条memory（记忆整理）流在读取阶段报TypeError/ECONNRESET，已保留原错误，不把HTTP200或全部settled冒充全部EOF。实际同一个活动 `act_g0Vc9mZNT00c78w69mBJ` 的attempt0物理读错误，后续attempt1流完整EOF；四条Work工具/回复流全部EOF，模型主任务最终stop。
- 已追查唯一collectLLMText/withLLMActivity的分类、重试、terminal（终态）与清理代码，以及ProjectMemoryOrganizer的项目锁、租约catch释放、后台finally退役和三个生产入口（项目启动/事件、显式API、工具调用）。失败物理尝试由现行同一逻辑活动重试，非新增后备路径或另一调度事实源。正式`GET /experimental/project-memory`返回revision30/status=idle/pendingCount0/droppedPendingCount0，无notice，证明记忆整理已实际提交/收敛；不是仅凭模型自述或当前回复成功排除影响。
- 这是已恢复的Provider连接重置，未发现调度、排队、唤醒、执行轮次/终态异常，因此不把它降格包装为单个用例偶发。若有租约残留/待处理不收敛等相反事实，仍须立即按全部Task/Mission/Session及重启/并发/多项目共享机制横审。
- run60/61合计10请求全部物理读取结算，其中9 EOF/1读取错误，后者同一活动重试EOF；全部精确Sol流式。两服务正常排空退出，原句柄20166/31615退出0，配对副本退役，所有自有标签关闭。

## 交付与限制

只暂存本批三处产品源文件、07-panel、记录/证据及三个索引各一链接，保留原177项状态；正常提交、fresh fetch/普通merge、完整待推送集合审查、正常push/join原句柄及实际远端核对后继续。原生作者配置优先级已统一；缺少完整前景的历史固定背景仍是已知设计限制，不推断/重写。未验收每种原生配置组合、Office、移动端或用户外部编辑器；不以本批通过扩大结论。
