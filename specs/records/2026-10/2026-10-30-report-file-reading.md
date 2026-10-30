# 已完成报告的文件阅读与交付体验

## Recall

用户要求持续单 agent 自主排查并修复产品 UI/UX（用户界面及体验）和功能，真实页面交互、截图人工复核、范围提交、同步上游后正常推送；不再委托。旧 Rendering 闪烁已经解决，不将其作为本轮问题。一次 Dependabot 重扫已执行，不再重扫。起点 c64f5ae52d0c450d4064e839cabb1bce7bfaa470，177 行其他工作保留；上一轮完成目标入口固定页脚和归档历史原因文案，真实报告已经生成，不能重复付费运行来观察同一结果。

已读 AGENTS、当前 07-panel 文件证据/工作台合同、812 Recall、10-27 文件阅读编辑和差异审阅记录，以及 FileEditorPane、FileChangesView、DiffPreviewPanel、file-workbench。检索了工作台打开/关闭、文件引用、变更目标和比较证据；既有文件编辑器已经提供下载、源码阅读、比较和草稿离开确认。Review 是原工具区间证据，不能把它替换成磁盘当前文本，也不能直接绕过唯一工作台导航权威。Markdown 原码出现在差异中本身不是缺陷，先实际核对阅读入口。

本轮读取已正常关闭和退休的 goal-report-812-final 完整库（schema 9、92 表、208565 行），原 75 附件、旧八项目 28 个 tracked 文件及新增 support-report 两份输入/两份输出保留。真实 Sol 模型累计 1096，本轮新模型硬额度 0，不重复预检或目标；配对认证/完整模型目录仅在隔离 HOME 使用和退休，不记录内容。用户 18571 页面、进程及数据库不操作。新 scope report-reading-813-before/38407，候选新 scope 38408（若需要）；首次启动新建 60 分钟绝对期限，后续同批不得延长，至少提前五分钟物理结清。开发 serve /ui，冻结原生资源，不单开 Vite。

## 修改前调查与验收方案

1. 启动前保存源库完整副本、附件、项目 Git/文件及新报告文件前像。固定新期限后实际从已完成会话打开 report.md 与 summary.csv，核对消息引用、变更审阅、文件工作台、阅读及下载；先截图确认真实现象。
2. 若发现问题，补充可观察现象、直接触发、控制或数据流根因、旧路径遗漏原因、全仓定义/调用/同语义/历史决定、公共合同、数据、测试、文档、交付及风险后才改产品。无证据不制造缺陷，不重复建立 Markdown 渲染器或文件选择事实源。调度类异常立即按共享机制横向审计全部生产入口及执行轮次。
3. UI 只做真实页面、截图人工复核，不新增、修改或运行 UI 自动化测试。非 UI 改动补聚焦正向契约测试和真实 checker。当前范围发现过期 UI 测试时删除其独占路径。本轮查到的上述产品组件没有 UI 自动化测试文件。
4. 如改动冻结资源，先关闭原自有 scope 再启动候选，共用原绝对期限；原模型请求保持 0。验收中英文与当前目标页面的实际阅读/原文件下载字节，不用构建绿灯替代。
5. 公共 shutdown、原 native/launcher/exec 退出、出生身份/输出/请求结清，配对副本退休；原认证元数据及模型目录字节/元数据保持。原生 SQLite 全表原值 EXCEPT 必须为零，本轮没有模型执行，不沿用上一批物理容量槽变化例外。附件、八旧项目和报告四文件逐字节保持；真实文件改动必须单列。
6. 三索引和当前文档检查同步，类型/构建/语言检查按改动执行；范围提交、fresh fetch/merge、审查完整待推集合、正常 hook push、fresh 回读远端。未覆盖分支明确记录，长期 Goal 保持 active。

## 实页现象、根因与实施决定

38407 原生页面图01显示已完成目标和原两份产物；图02实际点 Files changed 的 report.md，进入 Review（变更审阅），右侧有原 +31 行差异、过滤和文件列表，但没有打开当前文件/下载入口。图03从原 read 的 Sources（来源）打开同一 report.md，既有 File 工作台立即正常显示31行原文件、保存/比较/下载/重新读取控件，证明读取能力已经存在。结果正文的行内代码不是这里声明的文件动作，不把一次段落点击当作链接失败。

直接触发为结果卡片打开唯一 Review dock；控制流为 ChangesPanel → FileChangesView → DiffPreviewPanel，仅传历史 DiffTarget/groups，标题只展示路径、来源和行数；当前所属项目目录没有传到预览，无法在这里调用已有文件工作台。旧记录10-27分别验收过差异展开与 Sources/文件引用阅读，未覆盖两者间的直接衔接。全仓定义/调用确认 FileChangesView 与 DiffPreviewPanel 各仅一个生产调用，文件打开唯一控制器是 file-workbench 的 openFileReference → prepareFileEditorTarget，已负责真实草稿离开确认、权威/导航修订、保留当前草稿与焦点。当前源目录取自 board.selectedSource，Task 回退仅使用既有 selectedTaskDirectory；不读取另一个项目目录猜所有权。既有比较证据/文件读取 API（应用程序接口）、SDK、持久 schema、运行调度不变，不是队列或终态异常。

实施：显式将当前 source 所属目录经既有两层 props 传递，Review 标题新增“打开当前文件”按钮及完整无障碍名称/提示，调用同一 openFileReference，绝不把磁盘内容覆盖原差异。按钮作为下一行阅读动作，与历史来源/行数分开，窄 dock 仍能阅读路径；使用现有 Button/Icon/Feedback，打开失败保留完整详情且反馈归属当前 source/target/API 权威。文件不存在仍由原读取错误合同呈现，不根据旧删除状态猜当前磁盘。UI 操作忙碌仅是局部呈现，不新增导航状态源、公共服务、读取协议或 fallback。补齐中英文；实页验收原两文件打开/下载、草稿 Cancel 后原草稿保留、切换文件/回到 Review 时原差异保留，候选真实中文与英文截图。截图/行为验收代替 UI 测试；纯 UI 接线不添加镜像单元测试。

风险为把历史快照误作当前磁盘、目录错归与草稿覆盖；明确动作名、显式 source 目录、唯一工作台导航机制和真实 Cancel 体验覆盖。仅新增能力入口，不删除原 Sources/Review 或双建事实源。当前查询到的 file-workbench 系列测试是纯服务契约；不为本 UI 改动运行它们，未发现当前组件的 UI 自动化测试。交付文档更新07-panel对应合同，无版本/发布流程变更。

## 候选实页追加发现与根因分析

38408/main-Dgwz-g96 图04/05真实从 report.md 原差异一键进入当前文件；浏览器实际下载1920字节。输入未保存备注后返回 Review，当前选择错误跳到 summary.csv。图06真实打开 summary.csv触发原 report.md 的 Unsaved changes 确认，Cancel后图07切回 File，原备注及未保存星号完整保持；没有保存磁盘文件。草稿机制通过，但不能把审阅选择连续性写为通过。

全仓追查选中行 writer：FileChangesView 唯一 selectedRowKey effect 在 filteredRows 为空时清空当前选择；ChangesPanel 的 panelActive 是现 dock 的唯一显示事实，隐藏时已有投影刻意返回空数组以停止广泛树扫描。隐藏 File/Review 切换与真正过滤无结果被该 effect混同，重新显示时只能选第一条。旧宽度/差异展开/点击重点验收没有覆盖隐藏面板后返回；新入口使此已有缺口更直接显现。不是后端、调度或数据终态异常，现 API/持久比较证据和原行保持。

修正决定：从原 panelActive 传一个仅呈现用 active 属性，选中行协调 effect 仅在可见时运行；直接使用既有选中行状态，不缓存旧数组、不新增选中源，也不改变实际过滤无结果或源切换的处理。全部生产调用仍仅 ChangesPanel→FileChangesView。既有过滤和异步投影/来源身份继续决定行归属。原候选关闭并退休后，以同一绝对期限新建 report-reading-813-verified/38409，冻结最终资源，再实际重复 report→File→Review，要求仍为同一 report，随后切 summary 并验证下载；原失败图保留，不以新图替换旧证据。

38409/main-C6J2IgPz 实页再次失败：打开 report 后返回 Review 仍显示 summary，原图08保留为失败证据。此前把临时空投影当作根因的假设被真实路径排除。继续追查 main.tsx 唯一 TabPanel 与共享 Tabs 原语：Review 没有 forceMount，标签切换直接卸载整个 FileChangesPanel/选中行状态；panelActive 的真实定义是标签是否打开，打开 File 时仍为 true，并非当前标签是否可见。因此追加 active guard 没有作用，已完整删除，不保留无效流程判断或影子状态。

已核对全部同级面板生命周期：Explorer、浏览器和 File 依现有标签集合保留挂载，Review 唯独缺此声明；isCenterWorkbenchPanelOpen 读取唯一标签集合，TabPanel 原语直接传递成熟库 forceMount。main 文件原差异为零。最终修复只在 Review 使用与 Explorer 相同的 forceMount={isCenterWorkbenchPanelOpen("diff")}；标签仍打开时保留原组件选择/过滤/阅读，真实关闭标签正常释放，不缓存数据、不维护额外状态。调度/数据库/公共 API 不变。38409关闭并退休后，同批截止内另起38410/report-reading-813-final，重新构建冻结所有资源并重复原行为，不能用类型/构建或前一图冒充成功。

## 最终真实页面与数据验收

38410/main-ItZU1En5 图09实际 report 差异→当前 File→Review，仍选中原 report/+31。图10真实输入 report 筛选、切 File 再返回，查询和唯一 report 选择共同保留。图11实际从结果卡片定位 summary、直接打开，原 P1/P2/P3/TOTAL 五行完整可读。真实浏览器下载 report.md 为1920字节、summary.csv为63字节，分别与812原模型产物、磁盘原文件逐字节相等；首版候选的报告下载1920字节也相同，详见 qualified.json 的实际文件回执。

最终版实际添加未保存中文备注，图12打开 summary 时原 report 的草稿确认可见；Cancel 后图13切 File，原备注、文件身份与未保存标记完整保持。Ctrl+Z撤销本轮备注，保存控件重新为禁用，没有写入报告或输入。真实 Settings→Appearance→Language 切中文后，图14显示“打开当前文件”和原历史差异；实际点击后图15显示原汇总及中文文件控件。图16从全局搜索进入另一个项目的已完成 Task，原交付仍可见；该任务当前环境仅提供资源管理器及不可变产物，未提供 Review，所以不声称 Task Review 分支已实页覆盖。再搜索返回原报告项目，图17/18从中文 Review 正确打开该项目原 report，排除停留在另一个项目的可观察错归。当前浏览器 error/warn 记录为空；这只是补充证据，页面18张原图均实际呈现并人工查看，不是 UI 自动化测试。

四个自有 scope 共用首次12:51启动的唯一绝对截止13:51:25.611Z，均公共 shutdown200、原 native/launcher/exec退出0，出生身份 dead_or_reused、物理/输出/请求结清，配对认证与完整目录副本退休。最晚关闭仍有2009246ms余量；前面3279483/2963682/2721158ms。全部新模型请求0、未触及额度、累计1096保持；原认证元数据、目录字节与元数据保持。92表schema9逐原值 EXCEPT 全零，208565起点全部值保留至208573，四次只各追加一个正常控制 lease/grant（租约/授权记录），没有更改任何已有行，也没有沿用物理容量槽例外。75附件、八旧项目Git/28文件、新报告四文件逐字节保持。

原 Task/Mission/Chat/已完成Work 的68/80/3/8条完整 HTTP（超文本传输协议）快照和会话/目标原记录保持，整个原报告/Goal在before、after、verified、final及UI后均与812最终快照深相等；Goal修订、完成状态、380471用量/1接受轮次没有人为改写。没有重复完成目标或注入会话消息。四个退出scope和文件回执汇总见本轮 qualified.json。

工具链失败单列：追加第三阶段数据checker时，内联 Node 命令被 PowerShell 解析拒绝，后续旧checker仍只接受before/after并明确失败；没有取得通过结果。改用精确文件patch扩展真实阶段、保持原全表逐值合同，唯一新标签重跑后退出0。没有改产品数据迁就checker。最终 Overlay类型/正式Node构建通过，2语言2641键检查通过；文档在最终记录后重新执行。未新增、修改或运行UI测试；不是发布，不升级用户schema，不创建tag/Release/PR。

边界：本轮没有实际覆盖缺失当前文件、外部绝对来源、不可变Build文件的打开、原生IDE、键盘完整遍历、宽屏差异布局或Task Review分支。原工作台错误/只读/草稿权威保持；不将共享代码接线或类型绿灯冒充这些未运行用例。关闭Review标签释放组件的行为沿既有Tabs合同，未单独声称该关闭分支已实页截图验证。当前仍是长期迭代中的一个批次，不宣称全产品目标完成。
