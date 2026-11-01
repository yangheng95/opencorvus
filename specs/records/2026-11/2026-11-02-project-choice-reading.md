# 多项目选择的身份线索（883）

## Recall

用户要求仅一个agent（代理）持续自主检查并修复整体UI（User Interface，用户界面）/UX（User Experience，用户体验）与功能，实际页面验证后提交推送；不要操作用户使用中的窗口，不再追逐已解决的Rendering闪烁。本轮不委托，持续Goal保持active。旧三Astra目标文字已被后续单agent要求覆盖。

882有实质进展：7f4b5a3a8520ae69b724f1a99bdc5ba390722c8d已正常推送，fresh HEAD=origin/main、0/0，18图与4项纯标识符契约通过。before/after原句柄98638/35005 exit0、shutdown200、物理/输出/请求结清，四份配对副本退休。合格after为schema9/92表、258681行、100项目、229附件、累计1260模型请求。工作区177项无关视频/产物删除、共享索引和缓存保留，只有实际不安全冲突才等待。

本轮从默认页检查开始工作、持续目标、任务看板与专家团入口关系；不凭技术名称判断误路由。代码已发现可核验的项目选择缺口：MissionBoard的项目筛选、选中值和卡片只用目录最后一段；MissionCreateDialog菜单保留完整目录，但选中后只剩最后一段。多个不同目录都叫project时，用户失去辨别线索。先在已有真实Mission和项目记录复现，再改产品，不创建/执行模型任务。

验收：默认页现有Goal入口与基础导航仍可用；看板项目选项可辨别同名目录，选中后与卡片持续提供真实项目路径线索；创建表单也清楚指出当前选中目录。实际切换两个真实项目后，筛选结果/创建目标与目录一致，原表单草稿不因显示改动丢失，取消不创建业务。中英文真实交互、截图人工复核，不以源码、构建或DOM文字断言代替视觉。

已读：AGENTS.md；882 Recall/合格闭合和fresh推送；07-panel默认恢复、Primary navigation、Mission board、模态与文件/项目选择合同；App/main看板和市场导航owner；MissionBoard、MissionCreateDialog、MissionDraftEditDialog的项目值/标签、切换和原始目录传递；project-directory的name/parent、projectDisplayName/匿名项目后缀单一工具；SelectControl及TextField.Description、现有ComboboxControl的用途和调用、mission-board.css对应规则；2026-10-29-project-search-journey已为命令面板保留完整目录，不另建项目检索事实源。

## 修改前根因与影响分析

- 可观察线索：MissionBoardCard/筛选selected value/option都只呈现missionDirectoryLabel(...).name；项目名只剩project等basename（路径末段）。真实数据包含多个不同项目下的project目录。实页数量、具体目录和视觉效果尚待before确认，未知项不作为完成证据。
- 直接触发：现有真实directory始终是选项value和筛选/创建请求的来源，但显示层丢弃parent/完整value；创建菜单中有description目录，关闭菜单后又丢失。数据/路由并未因此被证明错误，问题是选择前后缺少持续身份线索。
- 旧路径未根治：创建菜单/命令面板已经展示目录，未覆盖看板项目选项、关闭后的选中状态和卡片。不能以源路径正确或选项值唯一代替用户能辨认。
- 单一来源：继续从原directory和现projectDirectoryLabel工具生成显示；保留现有标签和技术路径身份，不改项目注册、重命名/别名、隐式目录存储或模型配置。匿名项目可直接复用现projectLedgerDisplayName的现有后缀合同，避免另造名称映射。自定义Project title如何进入此旧目录选择接口不是本轮重命名功能，不另建缓存/配置。
- 实施范围：MissionBoard项目filter菜单使用现SelectControl的description/tooltip支持；selected value附近暴露实际所选directory的辅助说明，卡片显示实际项目路径上下文并保留完整路径tooltip。MissionCreate项目Root用现TextField.Description关联所选目录，保留菜单现路径和所有字段/回调。具体长路径排版按before/after实际截图调整，不能简单拼长字符串后截掉关键目录名。
- 影响：同一Mission board的所有项目/筛选/卡片、创建表单项目选择及默认目录、相邻搜索/刷新和模态有界布局。Search、Project value、默认目录/任务创建、expert squad加载序列、权限、原用户草稿和原数据始终由现owner拥有。不引入平行Combobox/搜索状态；已有ComboboxControl服务命令面板/独立列表，本轮不为这项显示修复另建选择器。
- 风险：长路径挤压控件/卡片/底部动作，筛选行高不齐；新增说明若不关联ARIA（Accessible Rich Internet Applications，富互联网应用无障碍语义）会只改善视觉；选项可辨而关闭后仍不清楚；匿名项目露出内部路径噪声。需实际同名项目选择、路径菜单/选中/卡片、草稿切换、取消、键盘与双语复核。已存在公共项目标签工具优先，不复制路径处理。
- 不适用：数据库/持久格式/schema、Provider/LLM（Large Language Model，大语言模型）模型或工具协议、Task/Mission/Session调度、队列、唤醒、恢复、并发/重试/终态不改。目前没有运行异常；若出现立即按AGENTS共享机制横审全部生产入口/轮次/正常终态/重试重启/串并行/多项目，不能根据页名降级。此轮不更新版本、Release、tag或PR。

## 首次资源与实施顺序

before/after首次各0 Provider请求，首次prepare前声明75分钟共同绝对截止，预留5分钟正常闭合，不提高额度、不重启阶段或延长截止。复制882-after完整已合格数据库及附件命名空间，保护所有100旧项目业务文件/Git及229附件；原认证/完整模型目录配对复制、验证和退休，不输出内容。before复用882实际main-DeBepK0O.js及原成功回执；after用Node.js构建。项目CLI（Command Line Interface，命令行接口）开发/ui/，后台本人独立端口38583/38584，不操作用户18571或其他窗口/进程。

1. before从/ui/默认页查看Goal/任务/专家团既有入口；在真实Mission board读取项目筛选和卡片，选择两个现存同名目录；打开创建窗口，查看项目菜单与选中值，编辑不提交的明确草稿后正常取消。截图人工查看后正常退出，原句柄exit0、shutdown200、物理/输出/请求及出生身份结清、配对副本退休、完整旧数据资格。
2. 按已分析范围修改现显示面和样式，07-panel同步当前合同；具体视觉处理先落盘再实施。纯UI变更不新增、修改或运行任何UI自动化文案/源码/DOM（Document Object Model，文档对象模型）/组件/快照/像素测试。未改后端协议或非UI算法，辅助typecheck/build/i18n/token/docs不能代替截图。
3. after同真实记录验证项目选项路径、选中说明、筛选结果/卡片和创建目标、键盘/双语、草稿与取消；全程不按有效创建或Run，不调用模型。实际截图逐张人工查看，若长路径视觉不合格继续调整，保留失败证据。
4. 正常关闭本人服务/页面并核对原生闭合、0请求/累计1260、全旧行/全部项目文件与Git/229附件/来源DB/原认证及模型目录保护。同步三索引，仅本轮文件/字段提交；fresh fetch/普通merge、完整待推集合复核、正常hook/push及随后fresh同步。持续Goal仍active。

## 实施与真实证据

before实页后按实际结果补记。

### before确认与实施收敛

真实02看板菜单为六个完全相同project；03关闭后的创建项目无路径；04菜单虽然保存全路径，但相同长前缀占满一行，关键后段被截断。原生菜单两次带反斜线的locator未命中，改用真实AX菜单项操作；05保留草稿但截图仍显示菜单展开，因此不把该图当作完成第二次选择的证据。06第二看板project准确筛出批准后提交801，仍无法从标签辨认。01默认页Goal入口可见。

视觉方案据此收敛：菜单采用现projectDirectoryLabel.parent简短父目录并正常换行，使用现SelectControl Tooltip提供完整原目录；匿名项目复用现projectLedgerDisplayName真实后缀。看板选择后的完整目录另起一条紧凑辅助行，与筛选器ARIA关联；卡片项目名称下面保留父目录上下文和完整title。创建项目字段使用现TextField.Description显示完整所选目录并正常换行，菜单也采用共享description/tooltip primitive，消除只露共同前缀的原嵌套option排版。保留现value、筛选、默认目录和changeProject草稿/资源上下文行为。不修改共享SelectControl或路径算法。

### 新发现：创建默认目录与明确筛选上下文分离

02选择第一个project后看板仅剩会话问候确认；03创建仍选approved-code-801/project（04原生菜单真实选中项已确认）；06第二project才筛出批准后提交801。代码MissionBoard底部始终传props.defaultProjectDirectory，完全忽略本地projectDirectory筛选；创建open effect按该prop初始化。这是控制流默认上下文错误，之前同名标签掩盖了实际跨项目。现将明确筛选目录优先传入创建默认值；All projects时仍用原全局默认目录，不增加状态源。影响只在现组件创建默认选择，后续changeProject/数据请求/执行保持原值合同。该修改属于UI交互布线，禁止UI自动化；after必须分别实际筛选737/801打开创建，核对完整实际目录，并验证用户可主动切换和保留草稿。

### 已实施与实页结论

MissionBoard、MissionCreateDialog、mission-board.css和07-panel单一显示合同已更新。两个同名目录737/801真实筛选、相应创建默认目录、全部项目原工作区默认、原生键盘匿名项目d3b428、AI原请求及手动标题/说明切换保全、正常取消、中英文和默认Home持续目标窗口均实际操作；18原图已逐张呈现人工查看。未有效创建/执行或调用模型。项目Select使用现description/Tooltip，路径算法及真实directory保持原owner。完整路径说明通过现TextField/Select aria-describedby关联；非UI协议/算法未变，不新增UI测试。

第一构建main-DYIlBsPj后补入经证明的默认上下文修复，保留第一成功回执并重新构建最终main-CZA89Cze.js，之后才准入after；不替换阶段/额度/共同截止。typecheck、i18n两语言2746键、CSS9044引用402源码、docs352操作26组通过，正常push hook还将覆盖最终类型与接口工具链。两次Vite均exit0，既有大chunk提示保留。

原native句柄55792/54158 exit0、shutdown200、物理/输出/请求和出生身份结清，四份认证/模型目录副本退休。两阶段0请求/累计1260，完整旧行258681→258683→258685，变更只为两阶段各新增两条进程租约；schema9/92、100项目业务文件/Git、229附件、源数据库与原认证/完整模型目录全部保留。before/after资格和18图详见[证据](../../artifacts/2026-11-02-project-choice-reading/README.md)。

限制：没有将原05菜单展开截图当成选择完成；after真实切换以11/13为准。未实际运行屏幕阅读器、悬停完整目录Tooltip、全部项目/主题/缩放或模型创建执行；现Goal/专家团并未被本轮重做，Goal只实际打开关闭窗口，专家团入口只核过原owner代码。无数据库迁移、共享调度变化或版本发布。持续Goal保持active。

### 提交前可访问名称复核

07/10/15视觉已可辨，但after真实AX中看板及创建菜单的option Value仍只有project，父目录是Select.ItemLabel旁的small描述，没有加入现选项命名；before创建原嵌套标签则包含目录。这是本轮拆description后的辅助阅读回归，不能以视觉通过交付。修复仍限两个产品组件：父目录作为现renderOptionLabel的第二行，与名称同属Select.ItemLabel；Tooltip和canonical optionTextValue/value不变，不改公共SelectControl。现mission-project-parent继续换行并明确caption/soft样式。

原before/after资格和18图完整保留。新增final阶段首次额度0，仍使用原75分钟共同截止、不延长、不重启旧阶段；源为本轮after合格258685行，私有38585、独立本人页面，最终build receipt另存。真实菜单选项名称必须实际包含父目录，原生键盘选择及创建目录仍正确；重新截图人工复核英文与中文。此项不新增UI自动化，不使用DOM断言，AX只作为实际辅助阅读观察。

### 最终交付复核

最终main-9mBp8NKe.js经独立38585真实验证。19/20/22原生AX菜单option Value明确含project和实际parent，23图人工确认视觉、原生Home/Enter切换737至801与请求保留、中文737默认创建正确。18旧图及中间main-CZA89Cze.js保留为过程证据，最终23图全部已实际呈现/人工查看；没有UI自动化。

第三阶段原句柄23943 exit0、shutdown200、物理/输出/请求及出生身份结清，配对副本退休；三阶段合计六份副本退休，实际0请求/累计1260。最终258687行，仍只增加进程租约；schema9/92、全部旧业务行、100项目业务文件/Git、229附件、来源DB和原认证/完整模型目录均保留，无豁免。最终typecheck、2746键翻译、9046引用CSS/402源码和352操作26组文档检查均通过。未提高首次额度、延长共同截止或重启旧阶段。最终交付使用新的私有index，保留首次暂存的完整审查；只收本轮文件和三条索引，正常同步与hook推送。
