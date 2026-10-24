# 工作区双侧栏的阅读空间分配

## Recall

578继续用户要求单agent自主修复UI、Sources与Rendering并正常提交推送。最新纠正“你只在冲突的时候等待”，不再等待其他会话整体完成；当前其c2fd5291f/0617ce48d已收敛。577真实14次Sol流和新Source均完成，未复现高频Rendering；其关闭预留276754ms低于300000ms，如实失败并单独安全闭合。577证据提交91d7edb1c，正常push正在执行。保留171无关删除及既有未跟踪目录，无额外branch/worktree、无开发委派。

已读577 Recall/实图01/11、552历史根因与改宽恢复、当前07-panel布局/反应性合同、main的两套宽度限制/开关/恢复/窗口缩放、App稳定三栏根、pane完整拖动/键盘/范围/持久化、layout-tokens、activity/workspace CSS、settings与TitlebarMenubar reset。全仓搜索所有sidebarCollapsed、PANEL_PANE_CONFIG、rightDockOpen与宽度引用。触及范围没有UI自动化测试，不新增或运行。沿用已读computer-use、benchmark-debug-template，真实原生开发服务 `/ui` 和截图人工复核。

## 修改前深度与影响分析

可观察现象：577真实778×884桌面IAB，两侧栏同时打开时主正文约155px，权限标题逐字断行；手动隐藏左侧栏后主正文恢复，右侧成员仍可阅读。不是新移动端任务，也不是来源事实缺失或Rendering根因证据。

直接触发点：pane只预留chat-min500，允许左栏占据rail-min208；rightDockResizeBounds与CSS又保证dock-min280，即使剩余空间不足780仍保持280，center min-width0承担所有短缺。控制流上两套局部宽度限制各自满足下限、却重复消费同一剩余空间。当前架构1970段明文允许主区承担全部短缺，2700段却称始终保证chat minimum，二者矛盾；只加CSS最小宽度、重新clamp右栏或固定窗口宽度都不能解决三栏总量不足。

原552修的是正文字符锚点与共享ResizeObserver，不解决面板分配；576修的是恢复后成员选择错误退休，也不能提供阅读宽度。后台Task/Mission/Session执行、队列、终态、schema、API与模型调用均不涉及；本批没有发现新的调度异常。数据与用户原文、Sources事实保持；新界面文案不增加，沿现有中英开关名称。风险在首次hydration、两栏开关后的焦点、左右拖动边界、窗口/zoom、保存偏好与实际呈现是否一致、成员内容是否退休。

## 实施方案

保留唯一持久化sidebarCollapsed/sidebarWidth/rightDockWidth和rightDockOpen，增加的仅是实际panelBody尺寸测量。派生左栏呈现：用户明确收起时保持收起；右Dock打开且工作区无法同时容纳导航、左栏最小宽度、两条分隔线及chat/dock最小宽度时，暂时释放左栏。关闭Dock或重新获得足够空间时恢复用户原偏好，尺寸变化不写偏好。窄工作区明确点击“显示侧栏”则关闭Dock并显示项目列表，使开关始终可操作；再次打开Dock让左栏释放空间。

仍用现有稳定根、inert/ARIA/动画和pane primitive。main提供一个当前PaneConfig，以Dock实际打开状态将其最小宽度和分隔线纳入左栏remainingMinWidth，三栏可以放下时先缩左栏而非挤正文。既有window/visualViewport一帧resize owner同步panel尺寸，mount与zoom采用同一测量，不增加Observer/计时器或第二宽度持久源。标题开关、左栏内容和分隔条语义统一读取派生呈现；自动隐藏时若焦点在左栏，交还标题开关。替换矛盾架构段落并保留极窄桌面只有chat+dock仍不足时的现有dock-floor边界。

## 实际验收与交付

577实图01为修改前真实证据，本批从已闭合577完整90表207330行/schema6复制新隔离库与原canonical/附件；完整模型目录复制但不复制auth，Provider预算0，不发模型、不创建业务消息/Task/Goal。当前Node正式UI构建发布给独立原生服务54064 `/ui`，20分钟生命周期、至少五分钟提前公开shutdown；用户18571/真实库/页面不操作。build仅验证迁移，不运行用户数据库升级。

在778×884真实桌面页面打开原Task/原成员B，人工检查默认页、双栏打开、关闭Dock恢复左栏、窄屏点击显示左栏、重新打开成员、键盘缩放边界及设置语言。截图并实际查看后再判断；必要时根据视觉结果修正。可获得更宽桌面时另做三栏同开，不能虚构viewport能力或以DOM数值代替截图。纯UI不添加UI测试；typecheck/build和正常push检查仅辅助。源90表全部原字段/时间/结构、字节/mtime/canonical保持，目标真实变化单独记账。全部原生/exec/launcher/物理/输出/请求闭合，catalog清退后范围提交，fetch/merge/审查全部待推送提交/正常push/fresh0/0。未覆盖场景与失败明确保留。

## 首轮实页发现与方案修正

首轮当前正式构建 main-19m0ftiE.js、Node62秒、类型检查通过。原生54064页249/250实际截图是1280×720，即使visible=true并请求打开也保持此尺寸（当前chat隐藏，open_in_codex返回queued）。没有擅自修改用户窗口或宣称获得778复验，后续用产品现有View→Zoom作为真实桌面空间压力路径；778像素复验仍未达成。

图01/02三栏在100%下正常。图03真实Zoom滑块End到160%，左栏仍呈现展开，主区被挤窄；图04关闭再打开Dock后正确暂时收起左栏，证明动态开关判断正常而scale通知缺口真实存在。只读DOM测量panelBody/body均1280、root scale1.600、dock true、left collapsed false，排除错误资产/视口推测；实际加载main-19m0ftiE.js。

控制流根因是sidebarNeedsReadingSpace直接订阅settings.zoom，而其读取的layout token是DOM当前已应用scale；Solid store改变会先触发部分依赖，TitlebarMenubar.setZoomPercent在store写入之后才applyZoom，外层theme effect也不能保证所有派生UI先后顺序。旧值计算后没有新的geometry通知，所以直到另一次Dock开关才正确。修正为尺寸测量signal在相同宽度时也通知，在唯一theme effect applyZoom之后测量；布局呈现只依赖该测量与canonical状态，不直接订阅未应用的zoom。既有window resize仍同一测量入口，无新Observer、定时器、偏好或策略面。

首轮服务公开shutdown200、原exec67596/native/launcher exit0、physical/output/request/精确进程链闭合，提前911033ms，零Provider、catalog清退；90表207330原行/全部原字段时间/源字节mtime/schema6/配置保持，目标原行差异0。页249/250关闭。补齐fixed独立54065 scope，当前源为已闭合577、同样完整数据与零Provider，重新构建最终实现后复验160%与100%双向切换、左栏显式打开及成员返回。首轮失败图03保留，不以图04手动切换冒充scale已通过。

## 最终实页验收

最终UI main-RwZqHg_7.js、Node55.35秒、overlay typecheck exit0；没有私有DOM状态注入或UI自动化。初次fixed scope75075因并发channel_ingress_accepted DDL未配迁移而被真实checker拒绝，随后180秒CLI_STARTUP_INACTIVITY，原exec报告1、native/launcher实际7，物理/输出/请求/精确出生链全部闭合；没有listener，未伪造shutdown200。清退脚本最初误把wrapper1当native1，按真实physical-terminal7修正后独立清退catalog，失败资格保持。依赖步骤在该错误后曾报缺文件，之后已改为逐步检查exit再继续，没有忽略失败。

另一会话补入迁移7后，真实check:database-migrations通过：in-memory对象与目标7一致，实际阻塞解除便继续，不等待其整体任务。fresh verified54066从原闭合577全部90表207330行/schema6复制，预算0、没有auth，复用已完成的最终UI资产；native启动按当前代码正常迁移隔离目标6→7，用户库与源库未操作。迁移1–7均未由本批修改。

实页251图05在160%直接投影收起左栏，主区740.40625、Dock448，支持空间压力路径；图06明确显示左栏使Dock关闭，图07再打开仍原B。图10实际Tabs来源与读取前后正文同屏。160→80→100后图11恢复左280/Dock380/主561，保存偏好没有被自动折叠重写。图12左栏End442/Dock280，图13左栏Home208/右栏Home最终513/主500；动画末尾ARIA min280/max513/now513与实际513一致，图13捕获时仍在过渡。中英切换图14、新对话默认页图15、加号持续目标图16及真实表单图17均查看，未提交目标/消息。

公有HTTP及生产conversation parser正向核对：原B33消息107 Parts9来源，plan1517字与final1775字、9Source与canonical存储一致，原PNG200/643字节。初次checker误把全部投影Part都当part表原始行（tool/handoff有各自真实投影源），因此断言失败；修正为本次真实assistant Part与9个持久Source及全库原行核对后重跑通过，不按模型自述判断。90原表207330行所有原字段与时间保持；源字节/mtime/配置保持、integrity ok。隔离7新增bus_publication_owner6221行，以及automation_run.target_project_generation、channel_ingress_accepted.project_generation/effect、event_job_fire.project_generation，均为另一会话当前migration的运行事实，不作为本UI提交内容。

verified公开shutdown200，提前741988ms，原exec65025/native/launcher exit0，physical/output/request/完整出生链闭合，零Provider、catalog清退。首轮、失败轮、最终轮全部自有页面249/250/251已关闭，无用户窗口/进程/数据操作。三份目录证据各自保留，不将中间失败抹成全轮通过。

## 证据边界与下一调查

修改后仅获得1280×720，778真实窗口重验未达成；160%是产品实际字号压力，不冒充778截图。窗口拖动、reduced-motion、独立Mission/Side、native desktop-host未独立覆盖。原高频Rendering仍未知，本批修复共享宽度根因，未隐藏Rendering状态。

实际缩放往返时成员来源视图后来变为最终表格，尚不能声称像素或字符锚点始终保持；应在固定首个可见文本/来源身份后专门复现。End到160时View菜单曾切Edit，而Home到80、箭头回100时保留View，可能涉及键盘事件或缩放后指针hover落入相邻菜单；尚无根因证据，不先加stopPropagation。后续继续自主排查这两条新线索。

范围交付仅main、当前面板架构、本记录/17图/evidence与三索引，保留其他会话Channel/Event/Automation/Worktree/迁移7工作、171无关删除和既有缓存目录。正常fetch/merge/完整待推送集合复核、正常hooks/push；遇实际冲突才等待。
