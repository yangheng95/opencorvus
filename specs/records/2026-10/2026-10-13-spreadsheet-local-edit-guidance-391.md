# 391 可编辑表格的本地编辑说明

## 当前状态与Recall

当前已由root完成四文件UI（User Interface，用户界面）实现及可编辑桌面样本的真实后态，独立页面/服务已正常关闭；readonly等未实页范围见文末“最终实施与限定验收结果”，不宣称全部验收指标均已满足。下面保留实施前根因、方案和当时边界，不把389导出或390模型运行算作391验收。audit_ui仅获准只读复核实现并更新本spec与391证据目录；不修改生产/测试/共享文件，不启动服务/模型/浏览器、不提交或再次委托。共享索引、最终检查及范围交付由root负责。

用户原始目标是持续按批调查UI/UX（User Experience，用户体验）、功能缺陷，先完成根因/影响分析并落盘，再实施和真实验收。直接来源是389的真实桌面观察：同一Spreadsheet把B2从7改为9后Total由12变14；普通/全屏、设置英/中切换和菜单/Dialog期间保留9/14，实际导出CSV（Comma-Separated Values，逗号分隔值）证明当前编辑。点击另一已有Chat再返回时，新表格恢复原发布B2=7、Total12和A1选区。用户未导出修改可能因此丢失，不能因为已有数据合同便忽略界面告知缺口。

本391聚焦editable Spreadsheet的清晰、当前语言的本地编辑生命周期和下载提示，沿Code既定合同；不设计跨Chat缓存、自动保存、发布覆盖、dirty导航拦截或第二编辑状态。静态提示是否足够与modified标记的成本必须据实评估，不能因Code已有标记就机械对齐。

验收指标：editable表格在编辑前即显示本地生命周期与下载说明，普通/全屏均清楚可读；语言切换即时使用产品当前语言且仍是原工作簿；实际编辑与下载继续读取当前实例；切Chat返回仍按原合同显示发布值，说明不暗示跨会话保存。readonly表格按不可编辑合同呈现。视觉结论必须由真实页面交互、截图人工查看取得，不允许UI自动化、源码文案断言、DOM（Document Object Model，文档对象模型）/组件渲染测试或截图差异断言。

已读：当前 `07-panel.md` 的交互产物/全屏/不可变发布/本地编辑合同，`07-panel-reactivity.md`，389与387记录，2026-10-05连接工作区记录中的Editable Code章节及其实施方案；SpreadsheetArtifact、Univer适配器、全部20个renderer分派及编辑入口、CodeArtifact、ArtifactFrame/Actions、消息布局和两语言目录；InteractiveArtifactPart/读取服务、真实artifact发布/读取/MCP App lifecycle更新；会话选择、conversation hydrate/tree-writer/virtualizer、共享conversation-ui与file-workbench owner。读取当前安装Univer0.25.1的正式类型与分发代码，只读查看相关数据/服务测试，没有运行任何测试。

全仓定义/调用/同义搜索结论：`mountUniverSpreadsheet`唯一生产消费者为SpreadsheetArtifact；原生payload中仅Code和Spreadsheet声明editable。19个原生renderer与1个MCP（Model Context Protocol，模型上下文协议）App共享分派；Frame是全屏/操作表面的唯一owner，不能为了提示复制renderer。未发现通用跨Chat产物编辑保留primitive。当前有并行Session/Task、FileWorkbench、语言目录和UI等改动，实施前需重新核对精确diff并只增加本批必要内容。共享README、索引、架构/CHANGELOG和最终Git由root拥有。

## 真实现象与证据边界

389的[当前已编辑截图](../../artifacts/2026-10-13-spreadsheet-fullscreen-popups-389/screenshots/final-edited-workbook.png)、[实际导出检查](../../artifacts/2026-10-13-spreadsheet-fullscreen-popups-389/observations/final-export-check.json)和[原始CSV](../../artifacts/2026-10-13-spreadsheet-fullscreen-popups-389/downloads/final-edited-workbook.csv.gz)证明同一工作簿9/14及真实61字节导出。之后[重新挂载截图](../../artifacts/2026-10-13-spreadsheet-fullscreen-popups-389/screenshots/final-remounted-menu.png)显示原7/12和A1。二者是先后不同实例，不能合并声称跨Chat保留成功，也不能将恢复发布值当成此前导出失败。

本轮代码证据足以说明此重建为何发生；没有新增浏览器交互或独立实测。显式折叠与虚拟列表离屏也存在卸载路径，但尚未在本批对可编辑表格真实复现，不将它们登记为已观察到的丢失用例。刷新、窗口重开、多实例、多项目和重连的编辑寿命亦未实页覆盖。本记录不推断新的调度/恢复/终态异常。

## 直接触发、数据与生命周期根因

1. `services/conversation-session.ts:351` 的正常 `selectConversationSession` 路径先加载该会话的展示偏好，在378附近执行 `resetConversationProjection({ cause: "conversation-session-switch" })`，随后417附近正常hydrate所选源。
2. `services/conversation.ts:713` 的hydrate复用 `resetWriter`；`services/tree-writer.ts:592–635` 清空旧卡片并标记tree replacement；`store/card-tree.ts:352–360` 推进treeEpoch。`components/Conversation.tsx:359–366` 以该代次构建可见树，因此源切换使旧renderer卸载。
3. `SpreadsheetArtifact.tsx:18–25` 在onMount创建唯一Univer运行时并保存导出/主题订阅；31–33行onCleanup调用dispose。`univer-spreadsheet-adapter.js:114` 从 `workbookSnapshot(payload, locale)` 创建workbook，119行dispose整个Univer。当前编辑只属于该实例，卸载时没有另一个编辑owner接管。
4. `InteractiveArtifactPart.tsx:90–105` 以真实Session/directory/artifactID重新读取同一发布源；`services/interactive-artifact.ts:11–24` 只有明确GET（读取）路径。`interactive-artifact/persist.ts:138`插入发布payload，`findInteractiveArtifact:157`按Project/Session/Message归属读回。唯一update分支是 `updateMcpAppToolLifecycle:207`，不是Spreadsheet编辑API。返回时得到原7/12正是当前公开数据合同。
5. 同视图导出是另一路准确行为：适配器122–144行在用户导出时调用 `workbook.save()`，从当前运行时快照生成各工作表CSV，故导出的9/14与回访显示7/12并不矛盾。

全屏不重建：ArtifactFrame对现有section使用浏览器Fullscreen API，没有第二renderer树。设置面通过 `App.tsx:311` 的主页面data-active/inert保留当前DOM；locale通过同一UniverAPI.setLocale更新。因此389的全屏/设置/语言期间保留事实不能外推到真实会话源切换。

**根因定性：** 公开架构明确将Spreadsheet编辑定义为renderer-local、不修改durable workbook，当前实现符合该数据合同。具体产品缺口是可编辑Spreadsheet没有在编辑面告知此寿命及保存结果的下载动作；用户看到可修改网格和正确计算，却得不到Code已有的告知。风险是未导出的用户编辑在离开时被无意丢弃，而非已有持久写入失败、消息数据回滚或CSV导出错误。

## 20个renderer与共享owner影响

| renderer集合 | 当前数据/编辑合同与本批影响 |
| --- | --- |
| Code、Spreadsheet（2） | 唯二原生editable声明；Code唯一source signal拥有本地文字，Spreadsheet唯一Univer实例拥有工作簿。Code已有提示/派生modified；391只补Spreadsheet本地提示，不改变任一编辑值或导出源。 |
| Document、Diff、FilePreview、Notebook（4） | Document渲染发布Markdown；Diff、文件代码预览和Notebook代码显式readOnly。不存在本批对应的原生可编辑内容，不添加误导提示。 |
| Table、Candlestick、Chart、Diagram、Media、Map、Presentation、Dashboard、Timeline、Network、Tree、Terminal、Model3d（13） | 排序/过滤、选区、导航、缩放、搜索等展示交互。Timeline显式editable:false，Terminal只回放。交互可为renderer-local，但不等于用户改写发布内容；不扩为统一“未保存”警告。 |
| MCP App（1） | 独立协议/iframe应用，可能有服务器工具写入、表单及自身编辑逻辑；cleanup执行既有teardown，服务器事实与Host生命周期分别拥有。不能把原生本地编辑提示套给任意App，不能声称其业务写入会丢失。 |

`conversation-ui.ts:21–40` 的共享状态只承载卡片/披露展开、来源阅读位置和工具输出阅读偏好；只有折叠进localStorage，内存有界保留展示状态。它不是工作簿编辑仓库。`file-workbench.ts:104–130`只有一个真实文件编辑navigation owner；`workspace.ts:951–973`沿它准备关闭与Save/Discard/Cancel。真实文件的path/revision/写入合同不适用于不可变消息产物，不能为inline表格插入第二文件owner。

保留已装载主工作区的Settings方案、Frame全屏和virtualizer的focused/pinned item仅解决各自展示寿命，不提供跨Chat的产物编辑保留保证。后台schema、来源/附件、授权、任务执行、API读写、模型发布和不可变数据不需改变。若未来明确要求跨Chat编辑保留，那是另一项产品合同和独立分析，本391不预先设计实现。

## 历史与旧路径未覆盖原因

最初 `65d0bfc98`已有renderer-local的Code/Spreadsheet及工作簿导出。`01819949b`（2026-10-06）在真实Code37→54字节编辑、离开后回到37字节的证据后，按既定合同补Code可见提示和由当前source相对发布source直接推导的modified标记，没有持久草稿或原发布覆盖。[旧方案](../../artifacts/2026-10-05-connection-workspace-authority/artifact-editing-environment-implementation-plan.md)明确当时Spreadsheet可编辑区域尚未真实qualified，不能拿Table CSV冒充，故没有盲目扩展。

387提交 `099aaf2b3`补Spreadsheet payload身份与同实例语言更新；389修Univer弹层全屏/后代归属，实际证明编辑在同实例中保持并成功导出。这些修改都不拥有会话重建后的编辑持久化，不能被要求回滚或附加未经分析的保存逻辑。391首次有真实Spreadsheet编辑/返回证据，足以补该已存在合同的产品说明。

旧Code提示初次曾新增第三个body子节点，导致全屏两行grid把提示撑成大空白、编辑器被压缩；旧方案记录并最终把提示移入现有toolbar。这个已知布局事故要求391按当前Spreadsheet结构评估，不能仅复制Code JSX或追加段落后凭typecheck宣称可用。

## 最小静态提示评估与拟实施范围

静态提示已足够满足本批明确目标：在用户开始编辑前说明当前视图寿命，并提供现有Download作为保留结果的动作。它不需要知道工作簿是否dirty，也不把下载完成误称原发布已保存。该方案会降低不知情丢失风险，但不是跨Chat保留机制或离开阻断，不能宣传“不会丢失编辑”。

候选文案（最终由root随真实布局复核）：

- zh-CN：`编辑仅临时保留在当前视图，不会修改原始表格。离开或折叠前，请下载修改后的工作表 CSV；CSV 仅保留单元格值，不保留格式或可继续计算的公式。`
- en-US：`Edits are temporary in this view and do not change the original spreadsheet. Before leaving or collapsing it, download the edited sheets as CSV. CSV keeps cell values, not formatting or working formulas.`

用现有locale目录和t()响应当前产品语言，仅在payload.editable时呈现。说明是普通可读的caption/产品正文，不是alert、保存成功状态、toast、阻断确认或技术实现说明；保留原始表名、单元格、文件名与模型内容。优先下载措辞以匹配当前逐工作表CSV导出，不承诺保存公式、格式或整个工作簿快照。

拟最小生产范围仅 `SpreadsheetArtifact.tsx`、`styles/surfaces/messages.css` 必要的局部排版、`i18n/en-US.json` 和 `zh-CN.json`。同一Univer host/ref、onMount/cleanup、locale/theme订阅、payload、导出accessor不变；不改adapter、Frame接口、20个renderer共享行为、文件编辑owner或后端。root可在实施前收敛具体插槽和CSS差异，当前只批准写方案。

root读完Code/Spreadsheet/Frame及当前CSS后选择最小静态editable专属提示，不增加modified监听；倾向Spreadsheet专用workspace容器，将说明和原host放在同一flex列。布局约束：Spreadsheet现为body内单一host，普通高度520px/min360px（messages.css:2127），全屏通用规则令host height:100%（2077附近）。拟新增的局部workspace在全屏占满Frame header之后的剩余空间，提示flex-shrink:0并自然换行，原host使用flex:1/min-height:0占余下空间；普通host继续原520px高度，不把提示高度从现有普通编辑面积里扣掉。全屏适配应在唯一现有规则中精确协调Spreadsheet host的height:100%优先级，避免整高host再叠提示；不增加第二套高度补偿或另一个renderer。readonly和错误态按实际子项保持布局，host ref及DOM身份不随语言/可见文字变化重建。全屏网格footer、公式栏、工作表标签、滚动边界和多语言换行需真实查看；不改共享Frame，不增加固定像素补偿、计时器或重挂载。普通/全屏几何最终以真实截图为准。

### CSV导出实际语义及提示边界

适配器122–144行按用户操作即时调用唯一当前workbook.save()，按snapshot.sheetOrder为每张工作表生成一个CSV文件，读取cellData实际占用的行列矩形；超过2,000,000格给现有明确错误。单元格取值顺序为富文本body.dataStream.trimEnd()、v、f、空串。公式已有计算值时导出该值；如果只剩f，它进入文本序列化，不构成保存可继续计算的原公式。样式、数字格式、冻结、布局、工作簿资源和编辑历史不进入CSV，因此不应提示“保存工作簿”或“保留全部修改”。

`services/artifact-export.ts:10–23` 的唯一artifactCSV把单元格转成带双引号的CSV字段、双写嵌入引号、用CRLF连接行；以等号等特殊前缀开头的字符串会加单引号，保留文本身份。`services/file-download.ts:20` 对实际CSV下载加UTF-8字节序标记。这里精确记录既有行为，不改变导出实现、不另做规范化，也不把下载当作对发布payload的写回。389导出9/14的61字节证明当前计算值的真实样本，不证明CSV完整保存公式或格式。

上述文案明确“离开或折叠前下载”是依据当前卸载合同提供的预先告知，不声称本批已实页复现折叠丢失；虚拟离屏路径也继续保持未实测标记。提示只在可编辑视图呈现并响应现语言，内容长度带来的排版是391必须人工验收的主要实现风险。

## 为什么本批不增加modified标记

当前安装的官方Univer0.25.1确有相关API，但不能直接得到与Code字符串比较同样简单的事实：

- `@univerjs/sheets/lib/types/facade/f-workbook.d.ts:104` 明确 `save(): IWorkbookData` 返回快照；实际分发 `lib/es/facade.js:7091`调用 `_resourceLoaderService.saveUnit`。项目现在仅在显式导出时调用，不存在当前可复用的响应式dirty事实。
- 同文件类型339提供 `onCommandExecuted(callback): IDisposable`；实际7406实现只按params.unitId筛到该工作簿，并非“内容改变”或“用户编辑”判定。Core `f-event.d.ts:68`的ICommandEvent只有id/type/params/options，202附近示例要求显式dispose订阅。无证据可将任意命令直接等同modified。
- Code的 `source() !== props.payload.source` 比较同一结构的原文。Spreadsheet输入是压缩声明式sheets/cells；适配器转换成包含locale、styles、cellData、freeze等Univer工作簿，运行时还拥有公式计算和资源数据。对不同结构或整个快照盲目JSON比较不能证明语义编辑；命令置true也不能表达Undo回原值、选区/导航命令和系统计算的区别。

准确modified至少需要明确内容范围、监听/生命周期、Undo/Redo、公式/样式/工作表结构变化语义及快照成本边界。尚无实测性能数字，不能编造“很慢”；但代码已证明它会新增订阅与快照/规范化工作，超过本静态告知缺口的必要范围。391不增加dirty signal、快照基线、内容规范化器或命令关键字过滤，不把未实现marker列为修复阻塞。未来若有独立需求，再研究真实API与数据边界。

## 实施后的检查与真实验收计划

此项为纯UI告知和局部布局；不新增或运行UI自动化测试，也不为文本生成源码断言。现有 `artifact-export.test.ts` 是纯导出数据合同，`conversation-artifact-scope/compound-authority`是传输归属合同，不能替代视觉验收；本轮只读检查未发现触及范围内的UI自动化测试。若实施发现此类测试，先报告精确范围并遵循仓库规则，不运行。

root先冻结允许产品差异，检查两语言JSON有效/键一致，执行适当生产typecheck/build及当前docs:check。构建与类型通过只是实现检查。共享索引在正式接受本spec/实施时由root同步，本agent不自行编辑；本spec草稿阶段不以尚未运行文档检查冒充完成。

真实桌面优先复用389已真实发布的可编辑产物和普通开发 `/ui` 页面，明确自己的owner/原截止/关闭方式，不新增模型调用或凭据。若要新模型产物，另由root明确授权并按配对目录/流式/预算合同执行，不能把静态fixture或合成消息伪称真实发布。

1. 编辑前在中文/英文普通视图查看提示、原工作簿和Download；截图人工确认字号、对比度、换行、网格/工作表footer与既有工具栏可用。
2. 实际B2改9得到Total14；普通↔全屏、语言英↔中、已有菜单/色盘Dialog打开关闭后确认当前编辑仍在。同一页面截图必须绑定本次产物与区域，不使用389旧截图当391后态。
3. 在已编辑实例实际点击Download工作表，独立读下载CSV并与明确期望9/14比较真实完整字节；不以模型自述、DOM文本或源码哈希代替。确认提示不声称公式/格式保真，当前CSV合同保持。
4. 下载后切另一已有Chat再返回，查看原发布7/12和本地编辑提示；这证明告知与既有重建合同一致，不宣称改进了跨Chat保存。readonly产物按当前不可编辑表面人工查看，不显示误导编辑说明；避免添加只为验收的假消息。
5. 全屏提示占用自然高度后，实际查看工作簿公式栏、网格、工作表标签/状态栏及菜单/Dialog区域；确认没有重现Code历史空白/挤压问题。键盘Tab/Download/全屏返回保持现有交互。

显式折叠、虚拟滚动离屏导致卸载仅代码确认，尚未实页复现；如果后续实际检查覆盖则另附事实，否则继续列为未验收边界。移动端、多实例、重连、刷新/重启编辑恢复及任何自动保存均不属于本批达成指标。关闭自有页面与服务、收集范围证据、root复核/范围提交/上游合并及正常推送后才可宣称本批交付。

## 交接与风险

当前仅本spec新增，没有生产、语言目录、CSS、测试、共享文档或Git变更。静态提示是推荐的最小解；modified marker不是必要条件且尚未实现。root仍需独立选择具体实现位置并完成真实页面/导出验收。本批不改变数据或生命周期，最大实现风险是多语言说明带来的高度/密度和全屏网格空间；以局部布局和真实截图解决，不引入第二工作簿状态。

## Root实施决定（2026-10-13）

389/390已完成独立范围提交及正常上游推送后，root重读本Recall、原生组件/样式、当前架构、导出函数及全仓调用调查，接受静态说明与Spreadsheet局部flex workspace方案。生产范围冻结为上述4文件；语言目录已有其它线程Explorer改动，实施前备份并保存差异，只增加本批键，不夹带提交。文案简化为“编辑仅保留在当前视图。离开或折叠前，请下载修改后的工作表 CSV；CSV 仅保留单元格值，不保留公式和格式。”及对应英文；既有公式文本转义语义已确认，说明不承诺导出完整工作簿。

普通host保持现有520px/min360px；原fullscreen高度规则的Spreadsheet目标精确改为workspace，workspace列布局，提示自然高度且不收缩，全屏host flex:1/height:auto/min-height:0。onMount、导出、语言/主题订阅与同一ref不变。原始389已提供前态缺提示与真实编辑/切Chat事实，本次仍要在自己的当前构建页面完成后态证据，不重跑模型或复制凭据。当前尚无391后态结果。

## 最终实施与限定验收结果

### 四文件实现及独立复核

root按上节决定在SpreadsheetArtifact原host外加入局部flex workspace，仅editable时呈现普通说明段落，继续使用同一host/ref、onMount/cleanup、locale/theme订阅和当前workbook.save导出。全屏整高规则的Spreadsheet目标改为workspace，说明不收缩，host使用flex:1/height:auto/min-height:0；普通host仍为520px/min360px。两语言目录仅新增本批`artifact.spreadsheet.local_edits`，未将其它线程Explorer、Providers、Usage等差异当成391范围。

audit_ui独立只读复核四文件diff、当前Frame、适配器、artifactCSV与下载实现，未发现可证明的问题：locale只更新说明文本和原Univer实例，新增说明没有复制renderer或产生第二编辑源；CSV已有计算值时保存值，缺少值的公式表达式按文本转义，说明没有承诺公式/格式保真。该源码复核不替代以下真实后态。

### 当前构建的真实桌面证据

完整映射见[391证据目录](../../artifacts/2026-10-13-spreadsheet-local-edit-guidance-391/README.md)。root在独立tab29操作并人工查看全部八图；audit_ui归档时再次人工查看全部八图。沿用原真实Desk budget（Chat `ses_h0VKkCl7hbz3BKHVW2Xp`、artifact `art_g0VXv65e1004ErsrwSJs`），本轮没有新的凭据使用或模型执行，也没有UI自动化测试。

- 编辑前在全屏英文中已看到本地寿命和下载说明；普通英文两行、普通中文一行。实际B2=9后Total=14，普通↔全屏与英文→中文切换期间仍为同一已编辑实例。[普通英文](../../artifacts/2026-10-13-spreadsheet-local-edit-guidance-391/screenshots/normal-english-edited.png)、[普通中文](../../artifacts/2026-10-13-spreadsheet-local-edit-guidance-391/screenshots/normal-chinese-edited.png)、[全屏中文](../../artifacts/2026-10-13-spreadsheet-local-edit-guidance-391/screenshots/fullscreen-chinese-edited.png)保留这些实际状态。
- [原始几何](../../artifacts/2026-10-13-spreadsheet-local-edit-guidance-391/observations/fullscreen-geometry.json)中viewport为2560×1440、header64px、body/workspace1376px；说明rect.height为30.666667938232425px，host为1345.3333740234375px，host flex=1 1 0%、min-height0。它们不是32/1344。全屏公式栏/网格/工作表footer可见，[普通滚动图](../../artifacts/2026-10-13-spreadsheet-local-edit-guidance-391/screenshots/normal-chinese-footer.png)另证明当前底栏仍可见。
- 中文More Colors Dialog实际输入336699得到RGB51/102/153，之后取消；[Dialog截图](../../artifacts/2026-10-13-spreadsheet-local-edit-guidance-391/screenshots/fullscreen-chinese-dialog.png)同时保留背后的9/14与当前提示。快速两次Escape后曾仍看到菜单，下一次Escape才关闭，不能写成无条件“两键关闭”。
- 切到已有Reply OK再返回，表格重建为A1/Notebook7/Total12，提示仍显示；[重新挂载图](../../artifacts/2026-10-13-spreadsheet-local-edit-guidance-391/screenshots/remounted-chinese-published.png)证明的是说明与既有重建合同一致，没有跨Chat保存编辑的新增实现。

### 两份真实下载与未成功尝试

实际点击Download取得`Desk budget - 清单 (2).csv`，为61字节的9/14；[download-check](../../artifacts/2026-10-13-spreadsheet-local-edit-guidance-391/observations/download-check.json)保留原路径、精确字符串和检查结果。[edited.csv.gz](../../artifacts/2026-10-13-spreadsheet-local-edit-guidance-391/downloads/edited.csv.gz)保存该真实下载副本。

重新挂载后，通过原生点击Download、Down、Return的实际浏览器下载事件取得`Desk budget - 清单 (3).csv`，为61字节的7/12；[published-download-check](../../artifacts/2026-10-13-spreadsheet-local-edit-guidance-391/observations/published-download-check.json)和[published-keyboard.csv.gz](../../artifacts/2026-10-13-spreadsheet-local-edit-guidance-391/downloads/published-keyboard.csv.gz)分别保留核对与字节。两份四行CSV的header均为Item/Quantity，中间为Notebook/9或7、Pen/5，末行为Total/14或12；UTF-8字节序标记、三处CRLF和末行无结尾换行保持原样。归档又核对scratch副本与各自真实Downloads文件相同，gzip解压精确恢复61字节，不受Git换行影响。

此前混用Playwright定位接口Enter打开与原生Return的一次尝试未取得文件，不能追认为成功；未经独立根因调查也不将它直接判为产品故障。成功结论仅依据随后实际获得文件的鼠标(2)和原生键盘(3)路径，不将两次不同实例的CSV合并成同一编辑保留证明。

### 构建、物理收尾与归档检查

[构建日志](../../artifacts/2026-10-13-spreadsheet-local-edit-guidance-391/logs/build.log.gz)记录1m1s，root的session20477 exit0；[类型检查日志](../../artifacts/2026-10-13-spreadsheet-local-edit-guidance-391/logs/typecheck.log.gz)来自session34086 exit0。[方案文档检查](../../artifacts/2026-10-13-spreadsheet-local-edit-guidance-391/logs/docs-plan.log.gz)记录docs:check ok（348 ops、26 groups），不能替代最终共享索引变更后的检查。构建包含既有大chunk提示，没有凭构建通过宣称视觉通过。

tab29于2026-10-13T11:34:43.205Z关闭，英语偏好en-US恢复，见[page-closed](../../artifacts/2026-10-13-spreadsheet-local-edit-guidance-391/observations/page-closed.json)。原owner PID84388、occurrence `655041dc-6e4b-4c44-9c3f-55ff412a43ef` 经stop-requested正常退出，launcher23515 join exit0、terminal elapsed370031ms；[owner](../../artifacts/2026-10-13-spreadsheet-local-edit-guidance-391/logs/owner.json)、[ready](../../artifacts/2026-10-13-spreadsheet-local-edit-guidance-391/logs/ready.json)、[terminal](../../artifacts/2026-10-13-spreadsheet-local-edit-guidance-391/logs/terminal.json)及压缩stdout/stderr已保留。root又只读确认该进程与18505 listener均已结束，没有关闭或杀用户进程。

归档使用显式allowlist，仅八张当前截图、两份CSV、必要JSON和检查/服务日志；CSV与日志gzip保留原字节。没有复制数据库、运行环境、凭据、构建资产、工具脚本或初始差异备份。有限凭据模式扫描、本地Markdown链接与所有gzip原始字节恢复结果见[archive-check.json](../../artifacts/2026-10-13-spreadsheet-local-edit-guidance-391/archive-check.json)，属于证据安全/完整性检查，不是UI行为测试。

### 尚未实页覆盖与交付限制

计划中的readonly样本尚未实页；显式折叠、虚拟列表卸载也只作代码合同分析，没有独立页面证据。移动端、多实例、重连、刷新/重启恢复均未实页，因此不宣称所有验收指标都已满足。提示只在editable条件呈现的源码检查不能代替readonly视觉验收。

本轮完成的是可编辑桌面表格的预先告知、局部布局以及上述实际编辑/下载路径，不增加modified标记、自动保存、跨Chat缓存、离开拦截或完整工作簿导出。389剩余的英文可访问名称、More Colors无href及取消焦点问题也未在391修复，不扩写为整个表格无障碍完成。

audit_ui已完成授权的391规格/证据归档并冻结；共享README、最终文档检查、范围提交、合并upstream及正常push由root负责，本子任务未执行提交或发布。
