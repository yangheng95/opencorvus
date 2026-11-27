# 图表主题、重建尺寸与悬停明细

## Recall

- 用户要求本人持续按批次迭代，不用子agent（代理），真实调查/根因影响先落盘、修复、桌面截图人工复核和聚焦正向检查、提交/普通上游合并/正常推送后继续。GPT-6.1 Sol现有凭据与完整模型目录配对已授权，请求不限且全部流式；不创建分支/工作树、版本/发布或其他线程。不操作用户窗口、进程或Office认证界面。
- 上批`fb9c5fc53de272dc9503b122bc993bc37cc40cc0`已交付复合图尺寸和未使用手势信号重放修复；原push（推送）句柄91518已join（等待）退出0，真实远端/上游/本地一致、0/0、暂存空，原177状态保留。15人工复核截图、真实27110字节SVG（Scalable Vector Graphics，可缩放矢量图形）和正式API（Application Programming Interface，应用程序接口）/数据checker（检查器）已归档。run45–49共14次精确Sol流式200全部settled/eof（读取结算/流结束），原服务退出、配对副本退役，所有自有标签关闭。
- 上批深色截图`specs/artifacts/2026-11-27-chart-selection-review/accepted-dark-selected.png`中副标题与金额文字偏黑。未把状态保持验收包装成所有深色视觉通过，明确留作本批。已有原始CSV（Comma-Separated Values，逗号分隔值）5/35.60、华东3/28.25、华南2/7.35、退款A003/-2.05及零值A004/0.00，不猜币种或日期。所有历史产物和21项目文件保护，不改写原作者业务内容。
- 已读07-panel主题/原生Vega公共契约、theme-color.ts、inline-vega-view.ts、ChartArtifact/DashboardArtifact、发布工具和共享interactive-artifact-guidance、Chat/Work实际提示入口及相关后端测试。全仓搜索确认artifactVegaConfig仅由共享inline helper调用；发布描述同时进入Tool注册与AI（Artificial Intelligence，人工智能）SDK（Software Development Kit，软件开发包）工具工厂，Chat/Work共享同一指导片段。相关后端prompt/schema（提示/结构）测试验证声明与实际入口，并非UI（User Interface，用户界面）自动化，禁止新增/运行界面文案、DOM（Document Object Model，文档对象模型）、组件或截图测试。

## 修改前现象、根因与影响

- 确认两类来源：真实旧chart金额text mark明确`color="#111827"`，不是缺省色；它的subtitle没有指定颜色。真实旧Dashboard汇总、逐单标签、区域标签均没有指定文字颜色；区域bar/point明确使用`#0F766E`，含业务视觉含义，必须保留。不能把所有黑色或显式颜色一概替换。
- 直接触发为切换产品深色主题；共享artifactVegaConfig提供axis/legend/title色和透明表面，却遗漏title.subtitleColor及text默认前景，库默认黑色落在深色产品表面。旧路径只有标题/坐标/图例投影，主题重建虽成功且上批交互修复保持状态，默认文字仍未接入同一主题事实源。
- 另一个可证实的上下文缺口：PUBLISH_INTERACTIVE_ARTIFACT_DESCRIPTION和CHAT_INTERACTIVE_ARTIFACT_GUIDANCE目前只说明选择renderer（渲染器）、内联数据与安全边界，没有说明普通图表文字应继承产品主题。模型为浅色图形显式写入深前景后，native（原生）mark颜色按库优先级覆盖config。应在现有同一片段说明普通文字/表面继承产品主题、显式颜色用于数据语义或明确设计要求，不在host（宿主）增加颜色关键字匹配或工具路由。
- 权威资料：[Vega-Lite Text Config](https://vega.github.io/vega-lite/docs/text.html)规定config.text提供默认文字样式、mark编码可覆盖；[View Title](https://vega.github.io/vega-lite/docs/title.html)单独定义subtitleColor并允许title配置提供主题。方案只使用库公开配置，不写SVG后处理、CSS（Cascading Style Sheets，层叠样式表）覆盖、颜色推断、载荷迁移或另一套主题。
- 影响范围：Chart及Dashboard全部共享native View；只补缺省文字前景与副标题色。既有明确mark/encoding颜色及显式text配置的作者意图须保持；fontSize/align等作者配置保持。共享指导须同时投影到模型上下文与真实请求工具描述；工具能力仍直接可用、不增加白名单/发现步骤。原消息、payload（载荷）、持久结构、下载协议、CSP（Content Security Policy，内容安全策略）及上批状态转移不改。无数据库迁移、调度/唤醒/队列/执行恢复修改；若真实任务出现此类异常，立即按全部入口/执行轮次/终态/重试与项目隔离横审。
- 风险与未知：需补真实旧Dashboard深色默认标签复现；显式旧chart黑色mark属于已发表作者样式，不能通过此缺省修复伪称已被改写。新真实Sol任务须验证当前上下文能产出来源正确、语义颜色保留且在深浅主题可读的作品。普通动态日期、移动端与其他renderer未在本批范围，不凭本批截图声称全覆盖。

## 实施与验收方案（先于产品修改）

1. 仓外创建chart-theme-text批次，复用正常退出run49的隔离项目/数据库与配对目录。校验21源文件并保存当前完整持久行作为新基线，启动开发模式`/ui/`，分别验证凭据可用、目标模型投影、实际精确流式请求。先从已有真实Dashboard获得深色默认文字截图和人工复核，再修改产品。
2. 在唯一artifactVegaConfig补title.subtitleColor和text缺省前景，后者保留source.text显式配置。沿现有配置合并结构处理，不更改model（模型）业务数据、显式颜色编码或mark声明。共享一段创作指导供Chat/Work与两个发布工具入口使用，不复制平行文案。
3. 后端仅运行相关prompt正向集成/可执行示例检查及必要类型检查；不写测试断言某段新指导的逐字文案。真实输入框发起源于sales.csv的主题友好销售汇总/标签图任务，本人原生操作与筛选/交互、深浅主题截图人工复核；真实checker核对发布API/原始字段/整数分、旧行/源文件及原生下载必要结果。类型/构建/无错误日志只作补充。
4. 同步索引、文档检查、范围清晰提交，fresh fetch/merge（拉取并普通合并）全部上游、审查完整待推送集合、正常push并join原句柄、核对真实远端收据，再进入下一批。不得把只写记录或仅模型自述当验收完成。

## 修改前真实基线补充

- run50复用run49，原21文件一致，当前322消息/973部分/312请求/312结果/19产物共1938旧行建立私有完整副本。预检目标`openai/gpt-6.1-sol`的凭据可用、完整模型目录已投影、实际流式模型精确一致。
- 真实页面打开旧Dashboard、原生菜单切深色并展开，`before-dashboard-dark.png`已人工查看：汇总及10.10、20.20、-2.05、0.00、7.35文字黑在深色表面。只读原生SVG确认汇总和金额标签fill=black，坐标fill=#b4b4bb。该payload各text mark确实未写颜色，因此不是把作者显式样式误当缺省问题。
- 实施细化：text默认色来自同一个theme.text；source.text显式字段覆盖这个缺省，保留原生mark/encoding更高优先级；title副标题色来自theme.muted。现有axis/title/legend合并政策不变。只复用source对象校验以表达两种现有优先级，避免复制配置校验或深改payload。

## 视觉复核新发现：主题往返引起显式高度累减（修改前分析）

- run51旧Dashboard文字确实变亮，实际汇总/标签fill=#dddde1，语义色区域柱仍#0F766E。但深色→跟随系统后两张图继续缩小：真实SVG高度由159/102变为86/25，`found-dashboard-light-sizing.png`中订单标签与柱形重叠。65高度无坐标汇总保持65。不能把前景颜色改善当完整视觉通过。
- 真实持久规格分别声明汇总65、订单220、区域160，width均未写；Dashboard measure固定默认height=260，已排除从图形自身高度测量形成的循环。唯一共享createInlineVegaView在主题/语言变化时捕获所有原生signal并setState到新View，随后只为未定义/container维度调用尺寸API，显式数字高度沿旧值不重设。
- 数据/控制流根因：Vega fit（适配）布局把减去坐标/留白后的绘图区高度写入公开height信号；getState会包含这个计算结果。vega-runtime.setState直接更新这些信号，Vega View 6.1.2 `initializeResize`监听height，把收到的值作为新的_viewHeight/尺寸基准；随后resize再次扣除坐标，旧绘图区尺寸被错误当成新画布尺寸。width因宿主末尾重新设置了当前容器宽度而正常；明确数字height没有该步骤，故每次重建继续扣减。先前interactionChanges只比较初始值、忽略空手势，不表达尺寸事实源，因此没有根治。
- 共享影响：Chart和每个Dashboard子图均走此helper；两条投影入口CardParts/ProjectDeliveries相同，终态/活动/主题/语言同路。尺寸属于当前规格/容器，不能属于旧View的交互快照。复合图原生子图尺寸必须仍由声明布局负责，不恢复根width/height；未指定/container的单图尺寸仍从measure赋值。数组数据/嵌套信号/选区/语义颜色和卸载finalize保持合同。没有Task/Mission/Session执行恢复异常；此时新真实Work也已finish=stop、6请求全部settled/eof，执行与布局分别有事实排除。
- 修改前方案：在唯一interactionChanges中仅对根上下文省略公开width/height信号；这两个名字是Vega公开尺寸API的确切契约，不是按模型关键词选择工具。新View保留当前规格初始化的画布尺寸，现有末尾逻辑继续更新自适应尺寸，嵌套真正交互状态和声明数据仍一次转移。禁止复制旧computed尺寸成为另一配置源，不添加第二次setState或像素选区补丁。更新07-panel合同，最终候选须对旧Dashboard连续深浅/语言往返至少三次，人工确认220/160/65声明高度稳定、5订单/区域柱无重叠，并回访上批框选保持。
- 新真实任务事实：UI（用户界面）从明确项目的“在project中开始工作”提交，session `ses_hsexwMLYDYTBLk3B2AEC`，正式read与publish工具completed，产物`art_g0Vc9LWg500nnHSiR3le`/chart@1。5行数据保留整数分与原字段，图包含普通/退款/零金额语义分类、310/270宽300高的复合视图，文字mark未写前景、区域柱显式#0072B2。实际模型6次精确Sol流式200、全EOF。尚未以模型自述宣称视觉通过，须在最终候选人工查看。

## 悬停明细被原生作品窗口遮挡（实施前分析与方案）

- run52三次主题/语言往返的旧Dashboard实际高度均65/220/160，退款筛选为1/5、-2.05，恢复全部为5/5、35.60；截图已人工查看。新Sol图表五笔数据和标题/副标题正确，但原生指向A003时截图没有明细；只读页面支持证据显示已有原生table，内容为A003/华东/-2.05/退款，且处于作品dialog之外。因此不能把DOM有文本冒充可见交互通过。
- 直接触发是作品进入HTML（HyperText Markup Language，超文本标记语言）popover顶层。已安装vega-tooltip 1.0.0的`src/Handler.ts`每次调用按公开`options.id`查找元素；缺少时追加到document.fullscreenElement或document.body。作品使用popover而非fullscreen，body浮层位于原生顶层下面，z-index无法跨越该边界。全仓搜索只有vega-embed.css使用全局默认`vg-tooltip-element`，没有工具提示的作品归属处理；现有topLayerPortalMount用于Kobalte等弹层，但Vega原生处理器不经过该路径。旧路径没有根治原因是默认单一body节点同时跨越多个图表和不同原生顶层。
- 影响为Chart和Dashboard全部共享helper、消息卡片和项目交付查看入口、行内/作品展开/关闭、主题重建、多子图与卸载。现有发布、读取、数据与正式Work终态均完成，run51六个真实流已EOF；不存在已发现的调度/队列/执行轮次收敛异常。只修改浏览器呈现生命周期，不变更模型工具、数据载荷、持久结构、下载或外部资源安全策略。原生工具提示继续负责内容格式化、清理与坐标，不另写平行处理器。
- 依据[官方vega-tooltip](https://github.com/vega/vega-tooltip)及当前安装的Handler/Options：支持自定义`id`、theme和disableDefaultStyle，没有container参数。计划每个createInlineVegaView用Solid唯一ID预置一个原生`.vg-tooltip`元素，作为host的同父节点，保持在原作品的DOM子树内；它随原作品自然进入/退出顶层，也不会被vegaEmbed清空host移除。公开id选项将当前原生Handler绑定到该节点，多Dashboard视图各有唯一归属；不移动作品、不提高body层级、不添加观察器或兼容路径。
- 静态CSS选择器由全局默认ID改为库原生class，接入现有产品surface/text/border/font/shadow令牌；原生内容仍是作者字段和值，不翻译业务数据。删除旧硬编码light/dark两套提示表面，保留disableDefaultStyle和现有内容安全策略。主题配置只有产品令牌一个来源。
- 生命周期风险：Handler在收到空值时也可能先创建默认元素。常规卸载在finalize之后移除自有ID；若异步embed完成时owner已卸载，next.finalize后finally再次按唯一ID清除其可能重建的节点。不删除其他视图节点。实际坐标/祖先裁切、重复图表隔离与行内/展开切换须经真实原生页面截图验证，尚不能凭方案认定通过。最终候选还须复验上批30.30/2框选跨主题/语言保持、真实SVG下载与21文件/1938旧行checker，再提交推送。

### run53复验后的方案修正（再次实施前）

- 原生展开页A003/-2.05/退款、A004/0.00/免费样品、华东28.25/3明细已经真实截图可见，深色也可读。然而关闭展开后指向A002，真实行内截图明细落到右下角、表格被压窄；不得把展开成功扩大成行内通过。只读祖先CSS证实对话virtualizer（虚拟列表）外层contain=layout style，chat-scroll亦contain=layout；其固定定位包含块偏移叠加到库的viewport（视口）坐标。证据`inline-tooltip-ancestors.json`对应原生截图，非猜测transform。
- 因此前述“始终作为host同父节点”方案被真实视觉结果推翻，实施替换为现有唯一`topLayerPortalMount(host)`的归属契约：普通行内挂document.body，已在dialog/作品popover中则挂最近顶层owner。每View仍用公开唯一ID保留同一个原生Handler及同一明细元素，不增加formatter（格式器）或第二状态。作品原生toggle事件重新计算归属并移动该元素，绕开virtualizer布局包含块，同时保持popover内可见；不是根据模型内容或错误词选择路径。
- 全仓已确认原作品在原位用showPopover/hidePopover切换，toggle直接发送给frame；Chart和Dashboard唯一helper均有可确定最近msg-artifact owner。新增这一个生命周期监听，卸载先解绑，再finalize并移除自有ID，保留异步完成清理。ProjectDeliveries最近dialog同样由共享函数解析，无新平行弹层策略。需要新候选重新验证普通行内/展开/关闭再展开、深浅主题与多子图，原run53不能作为完整通过版本。

## 最终候选与实证结果

- run54开发模式`http://127.0.0.1:55397/ui/`使用最终构建，本人原生操作Chrome，15张最终截图及4张发现/修改前截图逐张人工复核；[完整证据](../../artifacts/2026-11-27-chart-theme-text/README.md)。没有新增或运行UI自动化测试、DOM断言、组件快照、浏览器夹具或像素比较。只读SVG/DOM用于解释根因及补充尺寸/归属，截图负责视觉结论。
- 新真实Sol作品的原生点/文字保留10.10、20.20、-2.05、0.00、7.35，区域标签28.25·3笔/7.35·2笔，总计5/35.60，副标题说明来源、退款、零金额和缺少币种/日期。深色普通文字与副标题清楚，显式#0072B2区域语义色保留。A003原生明细显示华东/-2.05/退款；A004显示华南/0.00/免费样品；区域显示华东28.25/3。行内A002明细显示20.20及中文客户，展开再关闭仍在指针附近，未再叠加虚拟列表偏移。
- 旧Dashboard最终候选截图显示默认文字正常、订单/区域视图不重叠。三个原生View各有唯一Tooltip ID，展开归属同一原作品；订单退款明细和区域28.25/3分别真实显示，仍由各View的原生Handler负责。深色→系统、中文→英语后真实SVG仍65/220/160；筛选退款显示Showing 1 / 5 rows、1笔/-2.05，清除恢复5/35.60。此前run52同一尺寸修复还覆盖三次主题/语言往返。
- 上批联动图再次真实拖拽框选A001+A002，结果30.30/2；关闭展开、英语→中文、系统→深色→系统后矩形和联动结果保持。该旧作者显式#111827文字在深色仍保留原样，本批未伪称修改历史作者前景。新主题指导已在真实新作品得到无显式普通文字色的结果，历史payload未改写。
- 原生“保存为SVG”实际下载`visualization (4).svg`，27035字节、766×513。XML内容检查保留全部五个金额、两个区域汇总及5/35.60；归档`sales-review.svg`为同一实际下载字节，没有源码摘要或自行重算哈希作为正确性门槛。CSV归档与真实181字节源文件完全一致。
- 正式读取/发布均completed，最终消息finish=stop；run50–54共14次精确gpt-6.1-sol流式HTTP（HyperText Transfer Protocol，超文本传输协议）200，所有读取settled/eof。每轮分别验证凭据可用、完整目录投影、实际模型一致；全部自有服务正常退出、流读取完成后清理配对副本，原句柄15388/40716/24566/41991/98525均join退出0，所有验收标签关闭。未授权修改或操作Office认证窗口。
- 真实live API（实时接口）checker核对正式publication input/output、数据库/接口payload、源CSV字段及整数分、样本项目HEAD、21文件集合与逐字节内容、1938旧行完整字段以及SQLite完整性，全部通过。它只验证实际数据和持久契约，不是UI自动化。授权请求不限，未用请求数量作为通过指标。
- 聚焦后端prompt示例/schema/Chat与Work投影集成3项通过、5条正向断言；overlay类型检查、CSS令牌检查、最终构建54.05秒、renderer公开表面检查均通过。文档/架构索引检查通过，提交前随最终记录复跑。安全/外部资源和持久格式无变化，无新增迁移。
- 范围限制：ProjectDeliveries投影已搜索调用及dialog归属契约，未在本批另开该模态页做人工验收；当前真实验收是消息中的Chart/Dashboard行内和原生作品窗口。桌面以外、Office原生编辑、其他renderer未在本批扩展。仓外配对文件、完整数据库/含加密推理旧行副本、原始Provider输入均不进入提交。

## 交付收敛

最终提交仅包含上述四处产品源文件、07-panel、当前记录/证据及三个索引的本批单行链接；177项原有工作区状态保持。提交后执行fresh fetch、普通merge上游、审查完整upstream..HEAD集合及正常push，原push句柄完成后再以实际远端身份收据确认交付。该收据保存在本批仓外目录，避免将待发生的push写成已经完成。
