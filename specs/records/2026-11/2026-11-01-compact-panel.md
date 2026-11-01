# 紧凑面板与统一对齐

## Recall

用户要求建立 Goal，整体页面改为紧凑面板，改善字体间距、行距、凌乱布局、对齐和设计感；必须先截图定位 UI（User Interface，用户界面）/交互设计问题，再完善修复和实页复核。Goal 已建立；本轮单 agent，无委托。保留现有工作区的视频/旧截图删除、共享索引修改和未跟踪运行目录，不操作用户窗口，不发布版本。初轮仅空数据视觉；用户追加明确要求实际端到端任务，现改为独立新数据根/本人项目、配对复制认证与完整模型目录，真实流式模型完成代码/文件/产物任务并实页检查全过程，不能以空状态或静态检查宣称通过。

已读 AGENTS.md、07-panel.md、overlay-typography.md、原首页/设置/Goal/导航记录、package scripts 和 pre-push。全仓搜索 typography role、density、home composition、s-row/config-*、sidebar/work-ledger、Mission Board、automations、usage 的定义与消费者；字体和控件由 design-language.css 唯一拥有，样式由各 surface 拥有，check-css-token-usage.ts 同步当前尺度。当前架构不能用额外 override 文件、第二套紧凑配置或缩放整个页面规避。未发现本次路径上的 UI 自动化测试；不新增/运行此类测试。

## 修改前问题与影响面

独立新数据根启动正式 `bun run dev serve ... --port 19741`，经 `/ui/` 的 1280×720 真实页截图定位（01—06）：首页在 y≈175 才出现标题，输入与快捷操作分别居中；General 的 28px 大标题、32px 区组间距和至少60px行，把诊断行推到首屏边缘；设置分组文字比条目标题多缩进4px，导航底部需滚动；Scheduled 搜索、两行筛选、空状态、建议之间存在连续大间隔，建议身份/时间轴不稳定；Mission Board 顶栏/筛选与主体没有明确面板分界；Usage 标题/身份/指标/热图叠加大间距。

直接触发是默认桌面宽高下进入这些页面。根因为历史单独修复虽然统一 token 名称，却保留营销式首页几何、设置大页标题/宽松行最低高度，以及各 surface 的重复内外间距。不是后端读取/调度/模型问题。旧字号收敛只约束词汇，未定义紧凑布局与对齐契约。数据、API（Application Programming Interface，应用程序编程接口）、持久化、迁移、Task/Mission/Session occurrence（执行轮次）、权限、发送与目标生命周期均排除；未观察到调度异常。真实长会话的密集内容风险未知，须在既有可读原文上保留阅读字号/行距，并实页检查实际可用表单、菜单与文件工作区。

## 实施方案

1. 唯一设计尺度调整：页面22px、强调15px、界面正文13px、代码13px、辅助12px；紧凑chrome行高1.35保留，普通说明1.5和连续阅读1.68保留。控件30px、按钮/图标28px、导航28px、标题栏/面板头40px；只改当前定义与checker契约，不造局部字号。阅读正文显式保持现有14px角色（如确有需要则在唯一token增加语义reading role并同步当前架构，不能直接写局部px）。
2. 首页去18vh大留白，采用紧凑顶部内容区，共同左边线；说明与工具分组，快捷动作等高对齐。Composer收紧空输入高度与外间距，真实输入/菜单/模型选择仍由原组件负责。
3. 设置统一20px页面内边距、20px区组间距、44px行、8px上下内边距；导航分组与行标题同轴、收紧上方留白。保留长说明自然换行、操作列与键盘焦点。Scheduled/Usage/Board在原surface内收敛大块留白和边界。
4. 先构建候选，在新独立服务冻结候选静态资源，重复首页、设置、计划表单、Goal、Providers、Usage、看板和文件实页操作；中英文、深浅主题及1280/较宽桌面截图。视觉不合格继续改再构建截图。

依据：[Microsoft 桌面 compact sizing](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/compact-sizing) 推荐对鼠标/键盘密集场景减少控件高度和padding；[WCAG（Web Content Accessibility Guidelines，网页内容无障碍指南）2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) 定义24 CSS px指针目标及间距例外。本轮标准操作维持至少24px，不以不可读小字换密度。

## 验收与交付

正式 Overlay typecheck、check:css-tokens、check:i18n、build/renderer checker；docs:check、check:architecture-index 与正常pre-push。不运行UI自动化、不用源码字符串/DOM断言/截图差分验收。截图原图存 `specs/artifacts/2026-11-01-compact-panel/`，逐张人工查看；只读几何测量用于说明证据，不替代视觉。只提交本次代码、架构契约、记录与截图以及共享索引本次行。结束前检查status，commit；fresh fetch/merge upstream，核对完整待推集合，正常hook push并回读远端。

## 结果

第一候选 types/CSS token/i18n/build/renderer/docs/architecture检查通过。1280×720实页09—14已查看：首页同轴且上移，General四组底部约717→590px，Scheduled筛选同排、建议固定列，Usage完整官方来源摘要进入首屏。Goal原快捷草稿交接正确。13实际计划表单仍为880px宽单列，首屏底部才到Model；根因是automation-form-grid固定单列、form/header各20px留白，与行控件紧凑化无关。全仓搜索只有本surface声明和唯一表单调用；改为原DOM顺序的两列，已有wide字段保持跨列，640px内容宽度以下回到单列；收紧头/字段组间距，不改字段、提交/预算/执行合同。该问题未修好前不称紧凑表单完成。

真实任务验收计划：新独立运行根配对复制auth.json/models.json，分别核验openai凭据可用、目录投影openai/gpt-6.1-sol、实际请求model一致且stream=true。沿既有native-provider-audit-plugin，启动前固定每进程最多40次真实请求，包括现有memory和工具轮次；不改运行中预算，不写凭据到prompt/日志/spec。创建本人小型数据统计项目，通过真实/ui选择Code/Task发起读取、修复、命令验收、报告和CSV产物任务；不委派子agent。截图覆盖执行中工具、最终回复、展开/折叠、文件/产物预览、切换和中英/主题；功能验收以实际文件内容和独立程序输出为准。若产品主流程不支持所选组合，记录真实错误并按现契约处理，不能合成会话或fixture替代。

实际入口只有Chat/Mission，本轮选择Code Chat执行多步骤真实工作，不把Chat冒称Task/Mission生命周期验收。19743正式服务的精确模型经真实picker选中。16—18真实read/bash/apply_patch流表明：单次文件读取占72px（24px工具+6px来源前距+24px来源+6px后距+12pxrun距），三个来源重复叠加；pending补丁的原始不完整JSON进入工具摘要，挤压状态。根因分别是既有run gap和source margins叠加，以及CardParts的identity无条件消费describeToolPart的raw detail；不是持久化/工具协议故障。工具摘要/ARIA（Accessible Rich Internet Applications，可访问富互联网应用）共享toolIdentityDetail，唯一调用点已搜索；原完整参数继续由同一InlineToolPart展开体提供，不能删除原Part或伪造文件名。修改为pending身份只显示真实工具名与既有receiving状态；解析完成后正常显示现title/detail。run间距12→8、Sources上下6→2、用户气泡内边距16→12。保留24px目标、原Sources打开/复制、完整工具输入输出、消息正文14px及阅读行距；新构建重放同一真实历史并再发跟进任务核验流式pending和完成态。

19真实完成后还看到Files changed三行文件居中散排。独立Python检查器实际执行修复程序、读CSV及报告，四组金额/排序与明确预期一致，功能已闭合；不能因此忽略布局失败。全仓定位ConversationArtifactSummary通过FileRowContent渲染共享oc-file-row，但surface把它与artifact合组写成display:flex，破坏primitive原有icon/name/trailing网格并继承Button的居中。修正该surface消费原file-row网格与密度，只为artifact保留flex；头部图标36→28、头部padding12→6、提示正文使用同行12px inset，文件列表恢复左侧身份/右侧计数同轴。未知行数事实保留，不在本次排版任务修改变更记录协议。

## 用户审美纠正后的设计修订

用户明确指出“紧凑不代表丑陋，抢救一下你的审美，产品设计是一门学问，不会就学”。第一候选虽压缩尺寸并完成真实任务，视觉仍未获认可，不能据此交付完成。复核09/11/20/31后，主要问题为：13px全局正文过小，页面标题/导航/行标签的重量接近；首页贴顶部并排裸控件，剩余画布与主内容比例失衡；设置全宽横线分隔重复、分组关系弱，暗色大面积同灰，浅色缺少内容层。不是再减少几像素能解决的问题。

已查阅并采用[Linear 2026设计复盘](https://linear.app/now/behind-the-latest-design-refresh)的内容优先/辅助导航退后/克制边界原则、[Linear整体UI重设](https://linear.app/now/how-we-redesigned-the-linear-ui)的完整界面与层级复核，以及[Atlassian间距](https://atlassian.design/foundations/spacing)/[排版](https://atlassian.design/foundations/typography)的邻近分组、大小间距区分和光学平衡。不是移植这些产品，也不引入其流程或依赖。

实施前决定：正文恢复14px、强调16px、页面24px，移除本轮新增而已无必要的reading字号角色，阅读行高从1.68改为1.6，界面tight保持1.35；按钮/导航30px、表单32px、头部44px。紧凑来自可预测行网格及分组，不靠小字。设置在原SettingsGroup内形成轻边框/12px圆角的完整面板，统一header/body inset，页面800px受控宽度，导航辅助标题12px且选中项使用现主题强调色。首页恢复64px的固定上方空间，标题/说明与右侧工具成为一个头区，输入和快捷项形成主次，快捷单元等高40px；窄桌面分栏自然折为两列。输入框使用原palette的面层/边界/轻阴影；dark/light只在唯一palette内调整中性色层次，其余主题继续消费同一布局。真实任务、Sources和文件网格修复保留。

仍只改现design-language、surface与palette owner，无平行主题、density开关、后备样式或数据协议变化。下一构建使用同一完整真实任务历史核验浅深主题、设置/首页/工具/产物，再发真实跟进操作核验流式与完成页；默认1280×720实桌面，不为截图好看扩宽视口。最终以新原图为准，前31张保留为调查过程。确切pending阶段在第二轮没有截图捕捉，不把该瞬态说成已视觉确认。

## 最终实施与真实验收

最终尺度以上一节修订为准，覆盖早期候选的22/15/13px和28px方案：正文14px、页面24px、阅读行高1.6、按钮/图标/导航30px、表单32px、头部44px。原图32—44均来自最终设计构建。首页标题、说明、输入和快捷项共轴；设置按功能形成完整面板，44px最低行高随说明自然增长；计划表单按原字段顺序排两列；来源、变更文件网格、会话与文件预览均使用原primitive。深色34/36、中文服务37、计划列表/表单38/39、看板40、中文浅色设置/首页41/42和最终并排交付44已逐张人工查看。没有用页面缩放、扩宽视口、截图加工或分数替代视觉复核。

真实开发入口为`bun run dev serve --hostname 127.0.0.1 --port <19743/19744/19745> --project-dir <isolated-project>`的`/ui/`，没有单开Vite。初次任务从空数据根创建；候选更新只复制本人已静默的完整运行根，保留同一个真实会话，不合成消息。会话`ses_-zUQH4qBczzrHUFQ3HGh`三轮：

1. 从界面提交10条订单的真实代码修复任务，模型使用read/bash/apply_patch修正Decimal金额、状态去空格、退款/取消及按团队/币种聚合，执行命令并生成summary.csv、REPORT.md。
2. 同界面跟进读取结果、重跑命令、追加中文交付复核；实际展开工具、查看报告源码/渲染和结果表格。
3. 最终设计构建中提交生成delivery.json任务，模型实际读取已有文件、写清单并用Python读回验证。界面打开右侧文件预览并点击下载，独立核验下载的306字节与项目原文件完全相同，且JSON四个对象、顺序、字符串金额与明确预期相同。

独立`task/checker.py`实际运行模型修复后的程序并读CSV/报告，输出North/CNY=25.29、North/USD=-1.25、South/CNY=44.00、South/USD=0.30；不是只核验模型自述。保存原始输入、真实输出、模型代码、三阶段报告、独立检查器和结构化事实，见[产物索引](../../artifacts/2026-11-01-compact-panel/README.md)。最后从保存产物目录重跑同一检查器通过。首次检查器未指定cwd误写仓库根summary.csv，已精确删除本人文件并改用目标项目cwd；另一次把Windows换行当输入完整性条件失败，已删除无效换行门槛，改验10条CSV实际记录及实际计算/清单内容。两次均修复本地检查工具后重跑原行为验收。

启动前分别确认Provider（模型服务提供方）认证有效、完整models.json投影包含openai/gpt-6.1-sol、picker与审计的实际model一致；17+7+6=30次真实请求均为gpt-6.1-sol、stream=true、HTTP 200，没有超出预先固定预算。审计包含产品本身的记忆辅助请求；没有本轮子agent。服务模式的reader状态为awaiting_binding，因此审计只能证明请求/模型/流式/HTTP事实，不能声称它证明响应读取EOF（End of File，流结束）。完成依据是公开消息中的真实完成态、工具结果、实页最终回复和独立文件/命令/下载验证。

最终构建`bun run --cwd packages/overlay build`成功（含renderer checker）；Overlay typecheck、CSS token（9014引用/268全局token）、i18n（两种语言2688键）、docs:check（352操作/26组）、architecture-index（20文档）通过。未新增或运行UI自动化测试。正常pre-push检查与最终Git结果由提交及push工具输出留证。

范围限制：本轮为1280×720桌面、中英/深浅主题和真实Code Chat三轮工作验收；Mission看板只验证版面，未验证Mission/Task执行生命周期、定时执行、其他主题或移动端。pending不完整参数的精确瞬态未捕获最终截图；修复来自真实旧截图、共享identity消费链和最终类型/构建检查，不能冒称该瞬态视觉通过。未知变更行数仍如实展示，没有以排版修改数据协议。

五个本人隔离开发服务均通过自身/shutdown正常退出，五个本人浏览器标签页已关闭。live/verified/design下临时复制的auth.json及models.json已配对移除；用户原认证、运行根和窗口未操作。交付保留所有无关工作区改动；本轮只提交产品样式/三个组件、尺度checker、当前字体架构、这份记录与截图事实，以及共享索引中的本轮条目。
