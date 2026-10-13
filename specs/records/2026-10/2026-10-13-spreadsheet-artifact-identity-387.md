# 387 电子表格产物的类型身份与运行时语言

## Recall

用户要求持续按批次并行体验和调查 OpenCorvus 的 UI/UX（User Interface/User Experience，用户界面与体验）、功能完成度和缺陷；每批先完成根因与影响分析并落盘，再实施有证据的改进，真实桌面页面交互、截图人工复核、聚焦正向功能检查及必要的授权 GPT-6.1 Sol 端到端验收，范围提交、合并上游并正常推送后继续。主 agent 已说明386与相邻交付 `da052db7d`、`69bfa2f9b` 正常推送且 hooks 通过。本轮工作区已有 Providers、Usage/FileExplorer及共享语言、规格索引等并行任务变更，必须保持不动。

主 agent 指派 audit_ui 单层只读审视产物异步动作后，又发现 Spreadsheet 向共享 Frame 传自定义导出函数却未传 payload。audit_ui 已核对全部20个 renderer、共享 Frame、两个非payload Inspector Frame、导出适配器、现有语言键及384历史。现在仅获准创建本387规格，不修改产品、共享 README/索引或其它规格，不启动服务或模型，不操作浏览器，不运行 UI 自动化，不提交或再次委托。真实页面、模型运行、实现、检查、归档、范围提交与推送由主 agent 负责。

已读资料与搜索：

- [384 产物工具栏的忙碌焦点](2026-10-13-artifact-action-focus-384.md) 的 Recall、类型徽标追加分析、真实 File/Document 验收与其余18个 renderer 未实页覆盖边界；[386 全屏菜单键盘循环修复](2026-10-13-artifact-fullscreen-menu-386.md) 的 Recall 和共享 Frame/menu 合同。
- [07-panel 当前架构](../../current/architecture/07-panel.md) 的 Inline Interactive Artifacts、编辑型 Code/Spreadsheet 当前挂载状态导出、共享工具栏、技术 renderer 身份和产品本地化合同；已读 inactive workspace paint isolation 与连接/选择归属历史，未据静态生命周期差异增加其它修复。
- `packages/overlay/src/components/interactive-artifact/SpreadsheetArtifact.tsx`、`ArtifactFrame.tsx`、全部20个 `ArtifactFrame` renderer 调用、`ConversationArtifactInspector.tsx` 两个非payload Frame、`univer-spreadsheet-adapter.js`、`services/artifact-export.ts`、后端 `interactive-artifact/schema.ts`、中英文语言目录。
- 全仓搜索 `<ArtifactFrame`、`payload=`、`exportFiles=`、`copyText=`、`artifact.kind.spreadsheet@1`，核对 Git 历史 `e782d749a`（384）与 `386c280ca`（统一可用产物导出）。Spreadsheet 是20个 renderer 中唯一缺少 Frame payload 的生产调用；未新增平行类型映射。

当前状态仅为源码根因确定、真实前态尚未取证。主 agent 尚未找到可直接复用的真实 Spreadsheet 历史，将使用已授权的 fresh GPT-6.1 Sol 标准 runner，配对凭据与模型目录预检、固定600000毫秒/12请求独立 scope，通过真实可见用户请求和发布工具自然生成一个小型 editable spreadsheet。前态截图确认后才修改产品。不得把拟执行的模型、截图、CSV下载或物理退出记成已通过。

## 现象、触发和根因

源码可确定的呈现：`SpreadsheetArtifact.tsx:36` 的 Frame 只传 `exportFiles`、`title={props.payload.title}` 和字面 `kind="Spreadsheet"`。`ArtifactFrame.tsx:68` 仅在 `props.payload` 存在时调用 `t(artifact.kind.<renderer>)`，否则显示 `props.kind`。因此该入口会显示字面英文 Spreadsheet，尽管中文目录已有 `artifact.kind.spreadsheet@1 = 电子表格`；英文目录的既有值为 Spreadsheet。此链同时适用于 editable 为 true 和 false 的表格，不能只将影响描述为编辑模式。

直接触发路径是正常持久化的 `spreadsheet@1` → `InteractiveArtifactPart` 的 Spreadsheet 分支 → `SpreadsheetArtifact` → 共享 `ArtifactFrame` 类型徽标。表格正文和真实标题没有用于推断类型；backend schema 已提供唯一 renderer 身份。漏传 payload 使身份在最后一层组件边界丢失，导出数据仍可通过自定义函数正常提供，从而掩盖了这处未接入本地化的调用。

384引入了 Frame 中“payload.renderer → 唯一语言目录”的显示方式，但其真实样本只有 File 与 Document。此前统一导出实现为 Spreadsheet 使用运行时工作簿的 `exportFiles`，Frame并不强制同时要求payload，所以384按20个 schema renderer添加语言键时遗漏了这一例外调用。384关于其余18个未实页验收的限制仍然准确；其“共享Frame类型合同覆盖”的静态判断对 Spreadsheet 未完整落实，本387记录这个实际调用遗漏，不将原先未取得的截图改写为通过。

## 全部调用、公共契约与影响

20个产物 renderer 中，FilePreview、Notebook、Model3d、Media、Map、Network、Timeline、Presentation、Diagram、Dashboard、Diff、Candlestick、Table、Chart均传原 payload；Terminal 传原 payload及同步选区复制器；MCP App 传当前 lifecycle payload；Code 传包含当前编辑 source 的 payload；Document、Tree同时传 payload与可选自定义 exportFiles。只有 Spreadsheet 仅传 exportFiles。这不是需要重写20个 renderer 的公共接口问题。

`ConversationArtifactInspector.tsx:293/363` 的 binary/snapshot 两个 Frame 没有模型 payload，也不属于20个 renderer；其 kind 已由现有 `t(...)` 提供当前语言名称。保持这两个入口的现有合同，不能强制它们构造伪 payload。Frame 的 `data-artifact-renderer={props.kind}` 是现行CSS身份，保留 Spreadsheet 字面技术 kind，禁止通过翻译 kind 改变选择器。

`ArtifactFrame.tsx:75` 的导出读取显式优先 `props.exportFiles()`，仅没有该函数时才走 `artifactExports(props.payload)`。`SpreadsheetArtifact.tsx:37` 的函数调用已挂载 runtime 的导出；`univer-spreadsheet-adapter.js:117` 调用 `workbook.save()`，按当前 sheetOrder、当前单元格内容及 sheet.name生成 `text/csv;charset=utf-8` 导出。文件名沿用真实标题与工作表名称，正文经现有 artifactCSV转换；`file-download` 继续提供既有CSV字节契约。补充 payload 不应改变这条优先级，否则会把已编辑值错误退回原始发布数据。

身份补齐后，Frame 的复制标签判断仍不会把 spreadsheet识别为带附件source的文件或MCP结果，真正不可用条件也仍只用于对应MCP路径；现有展示、菜单、忙碌归属、复制/下载和全屏保留同一renderer。数据schema、后端路由、SDK、持久化、权限、模型工具协议、调度/队列/终态、版本号及发布均无须修改。未发现本范围需删除的死代码或现存UI自动化测试；没有扩大扫描其它测试树。父任务的慢下载与MCP资源操作未实页覆盖仍是独立边界，不能拿本批标签修复代替其验收。

## 实施方案与准入

主 agent 先完成真实前态：在独立标准开发 `/ui` 页面打开自然发布的小型 Spreadsheet，切中文，查看并保存与该真实标题/renderer绑定的截图，确认类型徽标仍是英文，同时记录工作簿正常渲染和文件菜单实际身份。源码结论不能替代这个UI取证。

取证完成后只在 `SpreadsheetArtifact` 的现有 `<ArtifactFrame>` 增加 `payload={props.payload}`。保留当前 `exportFiles` 函数、其未就绪错误、运行时导出优先级、标题、`kind="Spreadsheet"`、Univer挂载/销毁/主题行为，以及所有现有Frame与工具栏实现。使用已存在的中英文语言键，无需改语言目录、共享Frame接口或新增类型映射。这是一处UI组件属性修复，不新增/修改/运行UI自动化、DOM（Document Object Model，文档对象模型）断言、源码文案断言、fixture或截图基线。

### 相关未知：Univer 内部语言与导出错误

主 agent 补读现有适配器发现：`SpreadsheetArtifact` 只在 onMount 调用 `mountUniverSpreadsheet(host, props.payload, getLocale(), ...)`；适配器把该语言快照传给 createUniver，返回的 runtime 只有 dispose、setDarkMode、exportFiles，当前没有语言变更订阅。因此切换产品语言时，Frame标签会更新而Univer内部界面可能继续显示挂载时的语言。此处目前是有源码依据的待实页确认问题，不能在未看真实完整表格前称为已复现，也不能将修一个类型徽标宣称为整个电子表格语言切换已覆盖。

前态/后态需要实际查看完整可见电子表格界面，包括Univer的工作表/公式区、菜单或其它当前可见控件；语言切换时同时核查已编辑内容和当前工作表是否保留。audit_ui随后只读核对安装版成熟locale接口与现仓历史。只有主 agent 实页证实内部语言问题、完成相应影响分析并追加明确方案后，才决定是否扩大本387实施范围；当前最小payload修改没有自动授权重建工作簿、复制编辑状态或替换Univer。

另有CSV导出超预算的英文Error文案线索，分别在静态导出与运行时工作簿导出路径；本轮尚无触发事实。保留为待确认线索，不以静态文案检索替代用户可见复现，也不顺带扩大到所有导出错误本地化。

### 已核对的运行时 locale 接口（仍待实页决定是否实施）

安装版 `@univerjs/core@0.25.1` 的公开 facade 声明 `lib/types/facade/f-univer.d.ts:146` 提供 `setLocale(locale:string):void`；`lib/facade.js:1384` 直接调用当前实例的 `LocaleService.setLocale`。服务实现 `lib/es/index.js:17893` 更新 `currentLocale$` 并发出 `localeChanged$`，该路径不重新创建或销毁工作簿。现有 `createUniver` 已返回同一个 univerAPI，适配器已同时加载 `LocaleType.EN_US` 与 `LocaleType.ZH_CN` 的 preset语言包，所以具备同实例运行时切换的成熟入口，不需要重新挂载表格或复制未提交编辑。

[Univer 官方国际化指南](https://docs.univer.ai/zh-CN/guides/sheets/getting-started/i18n) 明确区分语言包注册与选择语言：语言包加载后调用 `univerAPI.setLocale(LocaleType.EN_US)` 等切换，方法本身不下载语言包；[FUniver 官方API参考](https://reference.univer.ai/zh-CN/classes/FUniver#setlocale) 同样列出这个公开方法。文档可能比安装版更新，仅将已用安装源码/类型确认的setLocale用于本次判断，不据新文档推定其它region API可用或追加区域格式改造。

产品 `utils/i18n.ts:132` 的 `getLocale()` 读取响应式 `appStore.localeSeq`。如实页确认需要接入，可在现有Spreadsheet挂载生命周期内订阅这个既有信号，并经原适配器暴露的setLocale调用同一个univerAPI；它只是待追加实施方案的最小方向，当前不改生产。应复用初始化时的LocaleType映射，保留真实标题、工作表名称和单元格值，视觉验证所有当前可见内部控件及已编辑内容保留。既有Git历史 `386c280ca` 为Spreadsheet补运行时导出；后续没有此组件的locale订阅修复记录。本次未运行接口或UI测试，不能以方法存在宣称所有Univer控件已在实页即时更新。

## 真实模型与后态验收计划

主 agent 使用已有授权标准 runner 与独立 scope，固定600000毫秒总边界和12请求预算。若复制或绑定凭据，必须同时复制或绑定目标模型目录，启动业务前分别验证 Provider凭据可用、`gpt-6.1-sol` 已投影、实际请求模型一致且流式；禁止将凭据值写入prompt、日志或spec。既有真实runner自然创建可见消息、工具结果与持久化产物，不直接插入数据库、伪造消息/产物或手写工具成功。明确原始小表格内容与后续人工编辑值，使CSV可以按实际内容核对。

私有构建完成后，以真实生产 `/ui` 复核当前构建资源和同一真实产物，人工查看并保存以下证据：

1. 中文类型徽标显示电子表格，英文显示Spreadsheet；真实标题、工作表名称、单元格内容保留其原值。当前语言的复制、下载、打开/关闭等Frame控件可读。
2. 在真实表格中修改一个明确单元格并确认提交编辑；通过Frame菜单下载对应工作表CSV，核对文件名、文本内容和该单元格的实际新值，证明仍走 `workbook.save()` 而不是原payload静态导出。复制若被操作，也按实际完成反馈记录，不将图标变化冒充系统剪贴板读回。
3. 打开/退出同一Frame全屏，核查表格、菜单和类型徽标，正文没有第二份renderer。按实际交互范围复核中英文截图；未独立覆盖只读工作簿、多工作表或其它renderer时明确保留边界。

类型检查、构建和必要语言/文档检查遵循当前 package scripts，只证明相应结构合同；真实桌面交互、CSV内容和人工截图复核才证明本批行为。纯UI修复不为一行prop增加镜像式单元测试，也不运行已有UI自动化。新增本spec的根/月目录索引与 `docs:check` 由主 agent统一处理，子任务不改共享文档。

每个模型和复核服务按原owner正常shutdown/join，保留实际模型、输出、请求和过程终态；逐个确认自有页面关闭，配对凭据和模型目录按既有归属清理。旧386的tab18关闭未确认属于原记录，不能因本轮新页面正常关闭而抹去。主 agent 在验收后更新实际结果、归档安全证据，范围提交本任务文件，拉取并合并upstream，检查完整待推送提交集合与必要验证后正常push；不创建release/tag或执行发布。

未完成项：真实Spreadsheet模型发布、前态截图、产品修改、私有重建、后态双语/编辑CSV下载、完整物理收尾、共享文档检查、提交及推送均待主 agent执行。本规格只提供已完成的源码调查与明确验收计划。

## Recall 进度：真实前态已确认类型与内部界面语言遗漏

本节是后续实际进度，替代前文在方案创建时的“模型发布/前态尚未完成”状态，不倒填旧记录。主 agent 已用授权 fresh GPT-6.1 Sol 标准 runner自然生成真实可编辑的 Desk budget，工作表名为清单，并确认6个模型流完整 EOF（End Of File，流正常结束）。第一次发布工具输入带有 `value:null` 与 formula，被现有schema明确拒绝；模型自然移除null后第二次发布成功。该事实属于可见输入校验及模型纠正，没有调度、恢复或终态异常证据，不因此改schema或旁路发布协议。精确请求、产物身份与终态以主 agent原始回执为准；audit_ui没有调用模型或读取凭据。

主 agent 在自有tab22、`http://localhost:18505/ui` 操作，前态使用386的 `ui-after` 构建：先用英文挂载真实Spreadsheet，再切中文。`before-fullscreen-zh.png` 中共享控件已显示下载/关闭，但类型徽标仍为Spreadsheet；表格保留真实标题Desk budget、清单工作表及Item/Quantity等用户原文。普通视图右键清单后，`before-inline-menu-zh.png` 显示Delete、Copy、Rename、Change color等英文Univer菜单。由此两个问题均已真实复现：Frame缺失payload身份，以及已挂载Univer未接收产品语言变化。

三张原截图位于 `.tmp-spreadsheet-artifact-identity-387/screenshots/`，audit_ui已逐张人工查看 `before-inline-menu-zh.png`、`before-fullscreen-zh.png`、`before-sheet-menu-zh.png`。前两张分别清楚呈现中文产品界面中的英文内部菜单与英文类型徽标；第三张为全屏工作表底部右键操作后菜单不可见的截图。操作顺序与交互结果由主 agent提供，截图本身不证明未记录的调用栈、挂载节点或事件。正式证据归档仍由主 agent负责。

### locale 根因与完整影响分析

直接触发是已挂载工作簿后更改产品界面语言，而非重新进入一个全新工作簿。`SpreadsheetArtifact.tsx` 当前只在 onMount 读取一次 `getLocale()`，把字符串传给 `mountUniverSpreadsheet`；适配器只在初始化 `createUniver({locale,...})` 使用该值。随后只订阅产品主题，通过 `runtime.setDarkMode` 更新同一实例；没有对应语言订阅，runtime返回值也没有setLocale桥接。产品语言的唯一事实源已经改变，Frame的`t(...)`随其刷新，内部LocaleService仍停留在第一次挂载的值，造成同一工作区混合语言。

旧路径未根治原因是初始化时已装入中英两套preset包，初次选择语言本身正常，容易被当作“已经接入国际化”；而保留已挂载renderer的工作区不会因打开设置/切换语言而重新执行onMount。384只处理共享Frame类型徽标，不能通知成熟库内部的语言服务。本次真实英文挂载→中文设置→同一工作表右键菜单明确补齐了该生命周期缺口的证据。

全仓生产中只有 `SpreadsheetArtifact` 调用 `mountUniverSpreadsheet`；其它19个renderer不经此适配器。受影响的是这个已挂载Univer实例中的菜单、提示、对话框和其它由LocaleService供给的可见标签，普通及全屏共享同一实例。直接操作目前证实工作表右键菜单；未逐项打开的其它Univer界面仍以共享库合同覆盖，不冒称都已截图。工作簿标题、工作表名称、单元格文本、数值与公式是实际用户/模型数据，不应因UI语言变化被翻译或重写。

成熟接口与依赖影响已核对：`univerAPI.setLocale` 使用当前实例的LocaleService，更新其 `currentLocale$` / `localeChanged$`；已安装UI库的 `lib/es/index.js:2376` 读取currentLocale observable，`:5171/6052`订阅localeChanged。两种preset语言包已经在初始化注册，无需网络加载、升级依赖或替换语言包。该接口不调用createWorkbook或dispose；它证明可沿同一实例通知UI，后态仍必须实际确认可见菜单更新与编辑保留。工作簿snapshot中的原locale字段与真实内容不用重建，不将UI语言修复扩展为数字区域格式或公式方言迁移。

本轮扩展仍限于UI整合：无需改后台schema/路由、SDK、消息或产物持久化、模型工具、剪贴板/下载服务、调度或权限。没有引入新的locale store或持久化配置，也没有更改工作表导出上限。CSV超预算英文错误仍只有静态线索，保持前文未实页触发边界，不混入本次实现。

### 已获实证支持的实施方案

主 agent实施本387的产品范围现在为两个现有文件：

1. `SpreadsheetArtifact.tsx` 继续按原方案给Frame补 `payload={props.payload}`，从solid-js导入 `createEffect`。在现有 onMount 成功获得runtime后，建立确切订阅 `createEffect(() => runtime.setLocale(getLocale()))`；读取唯一产品语言信号，由该组件的Solid owner管理释放。订阅在runtime创建后建立，不在普通变量赋值前执行一次后失去依赖；组件销毁后不得继续调用已dispose的Univer。
2. `univer-spreadsheet-adapter.js` 新增唯一 `spreadsheetLocale(language)` 转换函数，映射到现有 `LocaleType.EN_US/ZH_CN`，供初始化locale和运行时更新共同使用。在现有runtime返回面暴露 `setLocale(language)`，调用 `univerAPI.setLocale(spreadsheetLocale(language))`。两种包原本已注册，既有 `workbook`、导出闭包、主题订阅、选区及dispose仍归同一runtime。主 agent已独立读取安装facade.js:1384与官方国际化文档，只使用已确认的安装版setLocale能力。

不重建工作簿，不从保存快照再创建第二个实例，不为了刷新翻译清空编辑、选区、历史或表格状态。保持 `exportFiles` 的现有优先级、`workbook.save()`当前值导出、文件名及技术 `kind="Spreadsheet"`。不改共享Frame/语言目录、不复制库的翻译，也不通过新增菜单实现规避库行为。对同一个语言重复通知的细节按当前响应式变化处理，不引入延时、重试或平行状态。实现仍由主 agent负责，audit_ui只追加本规格。

后态必须先在同一实例中编辑明确单元格并提交，再切中英：查看类型徽标、工作表右键菜单和当前可见内部控件是否跟随语言；核对清单及Desk budget等原名、已编辑值和原公式结果。下载真实CSV并检查编辑值，证明语言更新没有恢复发布时payload。应同时复核中文先挂载→英文与英文先挂载→中文，按实际完成的方向记录，不以初次中文挂载替代运行中切换。继续使用真实 `/ui`、截图及人工视觉检查，不新增或运行UI自动化/伪DOM测试。类型与构建只作为结构检查。

### 独立后续边界：全屏工作表右键菜单不可见

主 agent还观察到全屏状态下右键清单工作表标签，菜单不可见；退出全屏后同一右键入口能显示英文菜单。`before-sheet-menu-zh.png` 留有全屏不可见状态，`before-inline-menu-zh.png` 是退出后可见菜单的对照。该现象与类型/locale缺失分别记录，不能称为语言切换造成，也不能归因已修386的Kobalte键盘循环。

当前没有记录Univer弹层的真实物理父节点、是否处于浏览器top layer（顶层显示层）、定位边界、裁剪或具体事件结果；Portal/全屏层级只是后续调查方向，根因未知。本387的语言方案不移动菜单宿主、不修改全屏CSS/z-index、不新建Portal、不替换ContextMenu。后态若仍观察到此现象，明确保留为未完成的全屏内部菜单能力，并在独立调查中先补源码与真实节点/几何证据后再决定修复；不能因共享Frame下载菜单或普通Univer菜单通过而宣称全屏内部菜单已可用。

当前剩余交付：主 agent的两文件实现、私有构建、运行时双语与编辑CSV后态、模型/复核服务及自有页面物理收尾、安全证据归档、共享文档检查、范围提交和正常推送。已成功模型流和前态截图不替代这些未完成项；tab22与原服务的最终关闭/退出尚须主 agent回执，旧tab18仍保持原边界。

### 前态与模型 scope 的实际物理收尾补充

主 agent后续补充的已完成回执：preflight分别确认credential usable、catalog projected、实际 `gpt-6.1-sol` 和streaming；真实Chat为 `ses_h0VKkCl7hbz3BKHVW2Xp`，产物为 `art_g0VXv65e1004ErsrwSJs`。6请求均HTTP200/EOF，canonical checker通过。模型Host43836、Target10692以及launcher33320正常exit0（join chunk `a7e4cc`），配对凭据/模型目录清理完成。前态tab22已关闭，review PID74768及launcher83522正常exit0（chunk `fa0c44`），主 agent确认当前没有自有服务活跃。本段是新取得的实际收尾事实，更新上一段的待回执状态，不把源码阅读当作进程检查。

当前inventory中旧tab18也已不在列表；这是本轮库存观察，不能倒填386之前没有取得的关闭成功回执。两文件实现、私有构建、后态双语/编辑CSV与后态服务收尾、安全证据归档、共享文档检查、提交及推送仍待主 agent继续。

## 实施与后态完成事实

主agent按追加方案修改两个生产文件：Frame补原payload，onMount取得runtime后建立createEffect读取getLocale；适配器初始与运行时语言调用共用spreadsheetLocale并转调原univerAPI。无工作簿重建、影子编辑状态或新翻译目录。audit_ui独立只读复核diff通过。Overlay typecheck exit0；私有构建exit0（7300模块、72秒）。

[真实归档](../../artifacts/2026-10-13-spreadsheet-artifact-identity-387/README.md)保存同一自然发布产物前后态。主agent在后态tab23先中文挂载，实际通过名称框定位B2并将7编辑为9，原B4公式重算14、选区B3；随后中文→英文→中文→英文往返，普通工作表右键菜单依次跟随语言，类型徽标为电子表格/Spreadsheet，原标题与表名、编辑值与选区保留。真实Frame菜单下载61字节CSV，含Notebook=9、Pen=5、Total=14，精确UTF-8 BOM和原顺序比对通过，证明仍由workbook.save导出当前值。共享Frame全屏下载与返回焦点成功。

后态48796/launcher41932实际join exit0（4f65ca），tab23关闭，英文偏好恢复；前态74768/launcher83522实际join0，tab22关闭。此前模型Host43836/Target10692/launcher33320 join0，6请求HTTP200/EOF，配对清理完整。当前库存只有先前旧tab1，tab18已不在此轮清单，但不倒填原失败轮的关闭回执。所有截图主agent人工查看；54项明确归档清单经CredentialRedactor内存扫描，无凭据值、数据库或runtime归档。

全屏Univer工作表菜单仍失败，已用实际popup rect/style/父链证明active菜单在BODY下，真实fullscreen为Desk budget SECTION且不含它，单独389继续；库的Sheet tabs、Close sidebar、Notifications alt+T无障碍名称仍为英文，亦保留后续语言边界。没有把387类型和可见菜单成功扩大为全库本地化或全部全屏功能成功，未另验只读/多工作表。

本批共享索引、架构与未发布双语日志已按387范围更新；`bun run docs:check` exit0（348 ops/26 groups），类型与私有构建日志随证据保存。范围提交和正常上游推送以随后实际回执为准。
