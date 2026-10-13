# 392 电子表格无障碍名称的当前语言

## 当前状态与 Recall

本记录先落盘根因方案，再完成26文件依赖补丁、同实例双向语言与真实桌面验收；结果和边界见末节，范围提交待root收敛。root须独立读取本方案后实施、构建和操作真实桌面页面。audit_ui本次仅获准写本spec及自有scratch，不修改共享索引、不启动服务/浏览器/模型、不运行UI（User Interface，用户界面）自动化、不提交、不再次委托。

用户持续目标是按批并行体验和调查UI/UX（User Experience，用户体验）、功能完成度与缺陷，先完成根因/影响分析并落盘，再实施、真实页面交互和截图人工复核、聚焦检查、范围提交、合并上游并正常推送。当前批次承接389已经实页观察的三个英文AX（Accessibility Tree，可访问性树）名称：`Sheet tabs`、`Close sidebar`、`Notifications alt+T`；root又明确将同一个Sidebar组件的`Sidebar panel`、`Resize sidebar`纳入正式语言字段。默认桌面范围，移动端不增加验收承诺。

实施指标：当前产品中英切换后，同一个表格实例的工作表标签列表、侧栏面板/关闭/调整宽度控件、消息与通知区域名称跟随语言；保留快捷键、真实工作表名称、当前工作簿、选区及命令行为；正常/fullscreen入口均可用。不得只在导航上翻译，不使用DOM（Document Object Model，文档对象模型）遍历改标签，不重建工作簿或重复语言源。名称来自库当前语言资源，订阅有明确销毁路径。

恢复时先读本Recall及[389最终范围](2026-10-13-spreadsheet-fullscreen-popups-389.md)、[391本地编辑说明](2026-10-13-spreadsheet-local-edit-guidance-391.md)、[07-panel当前架构](../../current/architecture/07-panel.md)。389已交付`2aedc39d9`，修全屏宿主与菜单后代事件/关闭生命周期；391已交付`59a82456e`，补当前视图编辑与CSV（Comma-Separated Values，逗号分隔值）说明。它们均明确保留本批名称问题，不能将旧验收追认为392完成。原真实产物为Desk budget，Chat `ses_h0VKkCl7hbz3BKHVW2Xp`、artifact `art_g0VXv65e1004ErsrwSJs`；可复用已清理凭据的规范数据，不新增模型或合成产物。

已读和搜索：

- SpreadsheetArtifact、唯一univer-spreadsheet-adapter、Frame、语言目录与当前getLocale→同一UniverAPI.setLocale路径；全仓生产src中的Univer导入仅此适配器，不涉及其它19个renderer或391已完成提示。
- 安装0.25.1的ui/design/sheets-ui运行时、语言资源、公共类型和四种分发；匹配全部目标字面量、Sidebar结构、MessageContainer/Notification服务注册、桌面/移动控制器和公开配置。
- 当前389两个patch、root patchedDependencies、preset实际解析路径、Sonner2.0.7公开类型和默认标签拼接、redi1.1.1公开useUpdateBinder及useObservable实现。
- [Univer官方国际化说明](https://docs.univer.ai/guides/sheets/getting-started/i18n)说明preset合并语言包、setLocale选择已注册包及语言与layout direction分离。当前网页标v1.0.4，只用作原则，API（Application Programming Interface，应用程序接口）可用性仍以安装0.25.1源码/type为事实。Sonner公开`containerAriaLabel`以安装v2.0.7 `dist/index.d.ts:117`及实际实现为准，不因线上文档版本推定新API。

未检索或运行UI自动化测试，不把名称源码字符串检查当成网页验收。当前共享README有root改动、`packages/opencorvus/bun/`是既有未跟踪内容；本任务不回滚或夹带。新spec索引、文档检查和提交由root统一负责。

## 实际现象、直接根因与旧路径遗漏

389真实中文页面仍出现三个英文名称，来源记录在[389人工摘要的剩余边界](../../artifacts/2026-10-13-spreadsheet-fullscreen-popups-389/observations/final-review.json)；不是根据截图标题猜测。392此时尚未重新操作页面；Sidebar panel/Resize sidebar是本次同组件源码明确存在的硬编码，需root通过真正打开侧栏取得当前实页样本，不能伪称已在389独立复现。

当前安装ESM（ECMAScript Module，ECMAScript模块）定义如下。行号按已经包含389补丁的版本记录：

| 名称/定义 | 当前生产链及根因 | 公开覆盖能力 |
| --- | --- | --- |
| sheets-ui `SheetBarTabs:23125` 的Sheet tabs | RenderSheetFooter→SheetBar→SheetBarTabs，适配器footer.sheetBar=true；组件已有LocaleService，却将tablist的aria-label写死。 | footer.sheetBar只是开关，没有名称参数。需在组件内读取当前语言键。 |
| ui Sidebar:4991/5002/5031 | DesktopWorkbenchContent挂载Sidebar，面板role=complementary、resize role=separator/键盘方向键、close button分别写死Sidebar panel/Resize sidebar/Close sidebar。 | ISidebarMethodOptions支持header/children/footer/width/onOpen/onClose等，没有这三个名称的覆盖属性；自定义header不能替代控件名称。 |
| ui MessageContainer:7029、Notification:7074 | DesktopMessageService和DesktopNotificationService分别登记global组件，前者渲染Messager、后者Toaster；目前只传theme和direction。 | Design两包装均公开转发Sonner props，可直接传containerAriaLabel，无需改Sonner或Design。 |
| Sonner2.0.7 `dist/index.js:927/1089` | containerAriaLabel默认Notifications，最终区域名称为它与hotkeyLabel的拼接，形成Notifications alt+T。 | `containerAriaLabel?: string`是正式参数；保留alt+T，不修改快捷键数组或用户通知内容。 |

387修复了初始locale快照未随产品语言变化的问题，使同一UniverAPI运行时切换语言；但字面aria-label不会因此自动翻译，未传参数的Sonner继续使用英文默认值。389修宿主/可见性，391补本地编辑提示，两者均不拥有库内部名称。这是语言数据与消费缺口，不是模型发布、数据持久化、API权限或Fullscreen失败。

当前应用链为产品getLocale→SpreadsheetArtifact的createEffect→runtime.setLocale→同一UniverAPI→LocaleService.setLocale。安装core的setLocale（ESM约17893）发出currentLocale$和localeChanged$，不会据此重建工作簿；direction有独立setter/Observable（可观察流）。英文和中文均为ltr（left-to-right，从左到右），MessageContainer/Notification现在订阅direction不能作为语言变化的可靠信号。必须订阅真正的currentLocale$，不要订阅一个不相关字段来间接碰巧重绘。

## 单一语言来源与最小正式字段

仅补ui与sheets-ui自己的现有语言对象；不在OpenCorvus `i18n/*.json`复制一份库文案，不向适配器注入平行locale overlay，不替换工作表真实名称。建议正式键和值如下，英文保持当前含义：

| 插件键 | en-US | zh-CN |
| --- | --- | --- |
| `sheets-ui.accessibility.sheetTabs` | Sheet tabs | 工作表标签 |
| `ui.accessibility.sidebarPanel` | Sidebar panel | 侧边栏面板 |
| `ui.accessibility.resizeSidebar` | Resize sidebar | 调整侧边栏宽度 |
| `ui.accessibility.closeSidebar` | Close sidebar | 关闭侧边栏 |
| `ui.accessibility.notifications` | Notifications | 通知 |

preset的en-US/zh-CN分发从各插件`/locale/...`导入并mergeLocales，其中已包括ui和sheets-ui；适配器已经同时注册两种完整preset语言包。新增键自然进入现有同一个LocaleService，不需要修改preset、adapter、Frame、SpreadsheetArtifact或391的说明。Sonner最后仍会显示`Notifications alt+T`或`通知 alt+T`，技术快捷键保持真实。

## 成熟订阅与组件实施方案

正式方案使用现成 `useUpdateBinder(localeService.currentLocale$)`，替代初步调查中建议的useObservable。原因已按真实安装源码核对：

- redi1.1.1的useObservable仅在观察对象更换时unsubscribe，本次读到的函数没有卸载effect；不能凭名称假定新增调用自动清理。本392不据此宣告全库已产生用户可见泄漏，也不扩大为该helper或所有旧调用的改造。
- 同一公开包已有useUpdateBinder，文档注释明确用途是Observable发射时重绘、无需消费其值；实现用React useEffect订阅并在cleanup unsubscribe。此处LocaleService及其currentLocale$在同一组件生命周期中稳定，满足其当前空依赖effect合同，不产生自建语言signal或全局订阅。
- 稳定身份有实际代码依据：core构造LocaleService时仅创建一次`_currentLocale$`和`currentLocale$ = _currentLocale$.asObservable()`（当前ESM:17830–17831）；setLocale只向既有subject发射，销毁才complete。redi的useDependency通过useMemo获取当前组件所属injector中的服务；当前Spreadsheet在onMount创建一次Univer，切语言只调用这个runtime的setLocale，onCleanup才dispose。故此四个React组件在同一Univer实例内订阅同一个服务流；表格重建则连同React组件重新挂载并订阅新实例，不把旧流跨实例复用。若将来在不卸载组件的条件下替换injector或LocaleService，必须重新审查binder的空依赖合同，本批没有此路径。
- ui运行时ESM的既有react-bindings import已经包含useUpdateBinder，`lib/types/utils/di.d.ts`公开重导出；sheets-ui从`@univerjs/ui`的既有import增加这一名称即可。CJS（CommonJS）和UMD（Universal Module Definition，通用模块定义）已有完整命名空间可调用对应导出，无需新依赖。

四个组件的最小变化：

1. **SheetBarTabs（桌面）。** 复用已有localeService，调用useUpdateBinder(currentLocale$)，tablist名称改为t(sheetTabs键)。不改变sheetList、activeSheetId、Tab键盘、重命名、排序或子菜单状态。
2. **Sidebar。** 通过现有useDependency注入LocaleService，使用同一binder；三个硬编码aria-label统一改为上表ui键。角色、aria-expanded、aria-orientation、tabIndex、关闭焦点、鼠标拖宽、ArrowLeft/ArrowRight宽度命令和既有280–800限制均不变。名称变更不会更换sidebar DOM。
3. **MessageContainer与Notification。** 两者已有localeService，在各组件上增加binder，分别向Messager/Toaster传`containerAriaLabel: localeService.t("ui.accessibility.notifications")`。两条global入口都处理，不能只修一次copy toast而遗漏通知区域。维持现有theme、dir、消息内容、hotkey和显示寿命。

UI纯名称及语言订阅变更，无新增业务状态、后台接口、CSV行为、权限写入或用户/模型内容改写。已有389的宿主、WeakSet事件归属、关闭条件、Tooltip定位，以及391的局部flex和编辑说明必须原样保留。

## 同语义消费者与移动端准确范围

安装sheets-ui有第二个Sheet tabs字面量：MobileSheetBarImpl（ESM:25419，UMD Pd）。当前适配器使用桌面UniverSheetsCorePreset和桌面footer，本392不修改移动标签组件或新增移动UI验收。不要通过全文件替换两个同词条来悄悄扩大范围；移动名称尚未补齐属于明确保留边界。

UniverMobileUIPlugin注册表也复用DesktopMessageService、DesktopNotificationService和DesktopSidebarService。因而共享MessageContainer/Notification名称修复会静态影响其复用面，不能声称“对移动端绝无影响”；但本仓库实际生产只通过桌面Spreadsheet适配器消费Univer，没有独立移动产物路径。本批只对当前桌面入口做真实验收，不宣称整个Univer、所有移动模式或所有语言完成。

Sidebar的三名是一组当前同组件控件，按root明确范围一起修复。其它旧无障碍缺口，例如More Colors无href和取消后body焦点，不以本392名称补齐自动算作修复；不进行无边界的全库字面量清理。其它19个renderer、Provider设置、Usage和文件工作台不进入本批生产范围。

## 安装、发布格式与精确文件范围

本次从overlay安装的preset package.json创建createRequire并解析生产消费，而非从Bun patch工作目录推断依赖。当前实际解析：

- ui：`node_modules/.bun/@univerjs+ui@0.25.1+fb6a3c66a95eaf3d/node_modules/@univerjs/ui`。
- sheets-ui：`node_modules/.bun/@univerjs+sheets-ui@0.25.1+fb6a3c66a95eaf3d/node_modules/@univerjs/sheets-ui`。
- design：`node_modules/.bun/@univerjs+design@0.25.1+7492c01c6988791b/node_modules/@univerjs/design`。
- ui的真实redi依赖：`node_modules/.bun/@wendellhu+redi@1.1.1+e14d3f224186685e/node_modules/@wendellhu/redi`，已读其`dist/cjs/react-bindings/index.js`的订阅实现。

`node_modules/@univerjs/ui`在当前patch流程中可能是工作拷贝，其相邻依赖链接与preset实际`.bun`路径不同。从工作拷贝使用Node require无法解析某个传递依赖不构成产品故障，不能误报生产缺包。先区分编辑副本与真实消费，完成patch/install后重新核对preset实际入口及私有构建。

当前ui/design仍各只有389的四runtime patch，没有.bun-tag缓存diff；sheets-ui没有既有patch。392只扩展 `patches/@univerjs%2Fui@0.25.1.patch`，新增 `patches/@univerjs%2Fsheets-ui@0.25.1.patch`，通过现有root patchedDependencies及bun.lock登记；design patch不需要变化。

每个被修改包精确包含：

| 分发/类型 | 每包文件数与路径 |
| --- | --- |
| runtime | 4：`lib/index.js`、`lib/es/index.js`、`lib/cjs/index.js`、`lib/umd/index.js`。 |
| 中英语言JS | 8：`lib/locale/{en-US,zh-CN}.js`、`lib/es/locale/{en-US,zh-CN}.js`、`lib/cjs/locale/{en-US,zh-CN}.js`、`lib/umd/locale/{en-US,zh-CN}.js`。 |
| 当前公共语言形状 | 1：`lib/types/locale/en-US.d.ts`，加入同样正式键。 |

所以两包共26个vendor文件。初步估计曾计入两个zh-CN.d.ts，重新读类型后已排除：它们都是`import type enUS from './en-US'; declare const locale: typeof enUS`，中文类型自动继承，无需重复修改。组件props签名不变，不改其它d.ts。包发布只有lib，本次这两包lib没有source map，不复制386的src/map范围。公共exports同时开放import、require和`./lib/*`，所以不能只补Vite当前用到的ESM。

保持Apache许可证及未触及vendor内容，不重格式化UMD全包。按仓库正常Bun patch/patch-commit/install流程，保留已提交389修复与其它patch；复查patch头仅有预期文件，剔除意外Bun缓存标记。安装/build/typecheck用于检查依赖整合，不能替代下一节的语言与视觉验收。

## UMD真实绑定与实施风险

| 函数 | 当前绑定及最小操作注意 |
| --- | --- |
| UI Sidebar=`Wo` | 外层`t`是core命名空间，但Wo内部`t`是sidebarOptions，直接新增`t.LocaleService`会被局部遮蔽甚至触发暂时性死区。应先按真实绑定将这一个外层局部sidebarOptions变量及其memo引用改为不冲突名称，再使用core的LocaleService；不要替换所有嵌套函数的同名变量。依赖/hook命名空间为`i`。 |
| UI MessageContainer=`cc`、Notification=`dc` | 已有`e`为LocaleService，`i.useUpdateBinder(e.currentLocale$)`可复用；传给`o.Messager/o.Toaster`的containerAriaLabel取`e.t(...)`。局部`r`是direction，不能拿它当React命名空间。 |
| sheets-ui桌面SheetBarTabs=`lu` | 已有`x`为LocaleService，`r`为ui命名空间，可调用`r.useUpdateBinder(x.currentLocale$)`；标签取`x.t(...)`。 |
| sheets-ui移动=`Pd` | 仅记录同名定义，不进入本批runtime变更。 |

必须逐个查看修改后的作用域和调用目标，避免389首次UMD pl发生的align参数遮蔽重演；语法解析成功不能证明绑定正确。ESM/CJS/UMD三种实际命名不同，但四种分发应使用同样五个键、同样订阅和同样组件消费。不能把UMD原内嵌Sonner默认字符串直接替换为中文，那会失去当前locale并形成第二来源。

## 桌面真实可达路径与验收计划

root先在自己的当前开发 `/ui` 页面读到实施前中文AX名称；选用现有真实Desk budget，无需模型、凭据或伪造fixture。页面/服务有独立owner和正常退出方式，优先沿389/391已使用的规范数据。所有UI结果由真实交互、截图人工看和必要的AX读取共同证明；禁止新增或运行源码文案、DOM、组件渲染、快照、Playwright test或像素差异测试。

1. **Sheet tabs。** 在普通视图查看真实清单工作表标签列表，记录中文名称与真实工作表文字；当前表名仍为清单，不翻译模型/用户内容。同一实例切英文后名称为Sheet tabs，再切中文回到工作表标签。实际Tab聚焦标签、切换/返回全屏，验证已有选区和网格可操作。
2. **真正打开Sidebar。** 右键清单，选择“查看所有保护范围”/View All Protection Ranges。代码链为sheetPermissionViewAllProtectRuleSheetBarMenuFactory→ViewSheetPermissionFromSheetBarCommand（`sheet.command.view-sheet-permission-from-sheet-bar`）→SheetPermissionOpenPanelOperation（`sheet-permission.operation.openPanel`，showDetail:false）→ISidebarService.open；初始props.width为330，仅查看，不提交权限更改。该操作为当前已显示菜单的实际入口，不通过内部API造一个Sidebar。
3. **三个侧栏名称与宽度键盘。** 侧栏打开后核对面板、关闭按钮与role=separator的调整宽度名称。通过真实键盘聚焦separator，记录当前宽度，ArrowRight按原合同增加20（受280–800夹取），ArrowLeft恢复；截图确认实际宽度变化、正文/表格和关闭按钮均可用。不把名称已翻译当成宽度命令通过。侧栏保持打开切换语言，名称立即更新且宽度/当前工作簿保留，再用关闭按钮正常关闭。
4. **两个通知区域。** 分别核对MessageContainer和Notification对应Sonner区域的当前语言名称，不能只读第一个匹配。选择已知单元格区域并点击状态栏复制值，观察真实Messager反馈，保留原alt+T含义；Notification若尚未因其lazy service创建则明确记录实际可见的实例，不伪造通知或为了验收触发不必要外部操作。可见的两种区域均须正确传入名称；未实页触发的一种只记录静态覆盖，不宣称独立完成。
5. **同实例与布局回归。** 在已编辑9/14的同一实例切换中文/英文与全屏，确认391说明、389菜单/色盘/Dialog及实际当前CSV下载仍正常。保留中英截图和实际AX字段，名称不会因为控件隐藏而被误判已完成。恢复英语偏好并正常关闭自有tab和原owner服务，记录实际terminal/join。

首轮真实392前态可据实际Sidebar/通知状态补充精确范围，但不能为了快而绕过真实入口。只读包代码证明两个Message/Notification消费都需要修改；真实页面是否当时已实例化两个lazy service仍以观察为准。分包类型检查/构建、当前docs:check和patch安装取证由root完成；本spec阶段没有执行它们。

## 实施前交接（历史状态）

目前只完成根因、范围和可实施方案：五个名称尚未修改，392未有新页面/截图、订阅后态、构建或依赖安装结果。移动标签组件保留英文原定义，共享服务对移动复用的静态影响已记录；不宣称移动端、多实例或全库所有语言/AX完成。新名称不会修复More Colors焦点或其它无障碍交互。

root独立读完后可按上述26文件vendor范围实施。audit_ui只写本spec并冻结，不改生产/patch/共享文档；root负责同步spec索引、归档当前新证据、独立复核、正常范围提交、合并upstream与push。没有Release/tag授权或动作。

## 392 前态新增：已打开权限侧栏的正文语言生命周期

本节补充上文实施前状态。root已实际在英文Desk budget中从View All Protection Ranges打开侧栏，保持同一表格实例，通过Settings→Appearance→Chinese Simplified→Back切换中文。五个目标AX名称仍英文，侧栏正文也保留Protect Rows and Columns、Current sheet、All sheets、英文空态和Add new permission。随后点击Close sidebar，重新右键清单，菜单已经中文；选择“查看所有保护范围”重新打开后，标题、两类工作表列表标题、空态和添加按钮全部中文，五个AX名称仍英文。根本不是LocaleService没有切换。

root原始证据在`.tmp-spreadsheet-accessibility-locale-392/`：`before-zh-ax.txt`、`before-zh-reopen-ax.txt`、`screenshots/before-zh-sidebar.png`和`screenshots/before-zh-reopen-sidebar.png`。audit_ui已只读核对两份AX中上述具体正文与两个Notifications区域；页面交互和截图人工复核由root完成，scratch不是已归档证据。本节不把其它尚未打开的侧栏推定为实页已复现。

### 已证实控制流与392获准的最小增强

1. `SheetPermissionOpenPanelOperation`（sheets-ui ESM:5926起）把`header.title`保存为正式语言键`sheets-ui.permission.panel.title`，`children.label`保存为`UNIVER_SHEET_PERMISSION_PANEL`，View All入口传`showDetail:false`。这条前态路径并没有提前保存英文标题字符串。
2. `DesktopSidebarService.open`（ui ESM:7149起）发射新的sidebarOptions；切语言不调用open，也不产生新options。Sidebar的`useMemo(..., [sidebarOptions])`（ESM:4892起）将header/children/footer三个描述各转为CustomLabel JSX（JavaScript XML）元素并缓存。原外层没有locale订阅；即使只按392最初方案加binder，也仍会取回原来缓存的元素对象，不能依靠父渲染保证该内容树重绘。
3. `CustomLabel`（ui ESM:454起）在渲染时读取`localeService.t(title)`，或按label从ComponentManager取组件。React默认注册处理器原样返回组件，权限面板注册的是原`SheetPermissionPanel`函数；本链无React.memo阻断。`SheetPermissionPanel`（sheets-ui ESM:26845起）返回同一个`SheetPermissionPanelList`，key来自当前工作表/选区，而非语言。List（ESM:26539起）在render中直接t()所有这次实页可见的正文，但没有locale订阅。其旧React元素没有重绘，便保留旧文本。
4. close/reopen生成新sidebarOptions，重跑三个CustomLabel元素的投影，header和list重新读取已经切为中文的LocaleService；这与root的真实对照完全吻合。该事实证明数据流已更新，同时将缺口定位到已打开内容的缓存依赖。

root已明确批准392在原四组件/五名称外增加以下同一Sidebar函数内的最小变更：保留`useUpdateBinder(localeService.currentLocale$)`，每次render读取`const currentLocale = localeService.getCurrentLocale()`，把options useMemo依赖改为`[sidebarOptions, currentLocale]`。`getCurrentLocale(): LocaleType`在安装core公开`lib/types/services/locale/locale.service.d.ts`及ESM:17901起均存在；不读取私有subject、不再订阅第二个流、不使用direction代替locale。仍只有原26个vendor文件，UI四种runtime各同步这一依赖，未引入新包或新类型字段。

语言变化后binder触发Sidebar渲染，当前语言值使memo重新投影；同类型、同原itemKey的CustomLabel获得新props，再创建同类型/同key的权限面板和列表元素。保留原owner、位置、key和React状态，不对任何节点设置语言key，不开关visible，不调用sidebarService.open/close，不重建Univer或工作簿。React官方说明同位置同类型组件保留状态，而缓存JSX对象可避免子树重渲染；此处只修缓存遗漏的输入。[React状态身份](https://react.dev/learn/preserving-and-resetting-state)、[useMemo与JSX缓存](https://react.dev/reference/react/useMemo)。

具体生命周期审查：List的`isCurrentSheet`、`ruleList`、`currentRuleRanges`和其它useState继续保留；订阅effects依赖isCurrentSheet/已有规则刷新值等，语言值未加入，因而不执行挂载reset或重新请求权限列表。侧栏关闭按钮focus effect只依赖`options.visible`，语言变化不会再次抢焦点。width memo虽因新的options对象重算，但首先读取现有`sidebarService.width`，保留已调宽度；拖动中仍读dragWidthRef。scroll容器/事件effect依赖同一sidebarService，也不会卸载。当前language更新本身不改变工作簿选区，因此权限List的原选区key不变。以上为源码合同，后态必须用真实页面核验正文、All sheets选择、宽度与当前编辑值，不能用代码推断代替验收。

### 全部当前preset侧栏消费者的横向核对

全仓overlay生产src只有univer-spreadsheet-adapter导入Univer；当前core preset实际注册ui、sheets-ui、sheets-formula-ui、sheets-numfmt-ui和docs-ui等插件。对这些实际依赖的ESM主体和ui facade检查ISidebarService调用，得到以下同一Sidebar宿主入口；其它已安装但当前preset未注册的drawing、comments、data-validation、table、conditional-formatting插件属于安装库存，不能误报为本表格的生产入口。

| 当前入口 | 保存标题/正文方式及语言边界 |
| --- | --- |
| ui ToggleShortcutPanelOperation→ShortcutPanel | 标题保存`ui.shortcut-panel.title`键。正文已经订阅currentLocale$，updateShortcuts依赖currentLocale，属于已有语言刷新实现；本批不改其旧hook。 |
| sheets-ui权限面板 | Toolbar/ContextMenu/SheetBar的Add、View及SetRangeProtectionFromContextMenu等均进入同一个OpenPanelOperation；List编辑handleEdit也保存标题键。当前View All的key标题和即时t()列表由此次最小增强覆盖。PermissionDetailFooterPart确认后回列表、List的Add new permission则把`t(panel.title)`结果提前放入header，是另外两处标题快照。 |
| sheets-ui SidebarDefinedNameOperation→DefinedNameContainer | 标题提前`t(definedName.featureTitle)`；正文使用LocaleService但包含编辑/校验状态。共用宿主会获得重渲染机会，既有标题快照和所有编辑态语言不得据此宣称完成。 |
| sheets-formula-ui MoreFunctionsOperation→MoreFunctions | 标题保存`insert.tooltip`键。正文包含已选择functionInfo、参数等状态；渲染中的语言键会刷新，已经保存的描述/参数文案是否应随语言重取需独立实际调查。 |
| sheets-numfmt-ui面板控制器→SheetNumfmtPanel | 标题提前`t(sheets-numfmt-ui.title)`；typeOptions在空依赖useMemo内翻译，且type state使用翻译后的label作为身份。单纯重绘无法修这些缓存，直接补memo语言依赖还可能使当前类型身份失配，不能本批顺手修。 |
| docs-ui SidebarDocHeaderFooterPanelOperation→DocHeaderFooterPanel | 标题提前`t(docs-ui.headerFooter.panel)`；属于preset注册的文档能力，当前表格产物无已实证自然入口。不能把内部单元格文档编辑器等同独立文档侧栏已验收。 |
| docs-ui DocParagraphSettingController→ParagraphSettingIndex | 标题保存语言键。正文已有currentLocale订阅，并有语言变化后改变内部key的既有行为；本批没有新增这条reset，不将它作为保留编辑态的参考实现。实际桌面可达性仍需独立验证。 |
| ui facade openSidebar公开桥接 | 将调用者提供的params转交同一ISidebarService；本应用未直接调用。用户提供的任意标题/内容保留真实内容，不能按语言字面匹配替换。 |

此次增强只重新渲染同宿主现有元素，不会将已经保存的英文字符串逆转为locale键。因此权限详情返回/新增标题、DefinedName、Numfmt、docs header/footer的快照，以及PermissionPanelDetail在useState中保存的rangesErrMsg，均明确留待后续394独立调查。392不新增对上述包/业务状态的生产修改，也不宣称所有Sidebar语言已完整；针对已实证View All列表的修复无需等整个库语言改造。本次尚未创建394文件，交root后续决定范围。

### 增补真实验收与当前交接

后态必须重复**侧栏已打开时**英语→中文→英语，不以关闭重开代替：核对标题、Current/All sheets、空态、添加按钮和五个AX名称同步变化。先选All sheets并调宽，再切语言，确认相同选项与宽度保留；确认相同表格的已编辑值和原选区仍可用。另正常关闭/重新打开一次验证原菜单路径。root执行实际页面/截图复核并记录通知两个区域的真实状态；audit_ui只补本spec，接下来只读检查root的26文件patch生成脚本和UMD绑定，不实施、不改共享文档或提交。

## Root实施与前态决定

root完整读取本Recall、实际组件/语言/类型、redi ESM订阅清理和Design转发，另查官方Univer国际化说明与Sonner v2.0.7公开类型，接受五名/26文件方案。仅当前桌面适配器消费的库组件与语言字段进入本批；原389两包修复及391说明保留。

前态复用`.tmp-spreadsheet-artifact-identity-387/launch-review.ps1 -Stage 392-before`，私有UI为已验收391构建；目标Univer/Sidebar/通知区域在该构建与当前实施前源码一致。它经过正常production listener/recovery，在18505提供`/ui`，不用独立Vite服务器，不新增凭据或模型。原387物理退出和配对清理先由launcher验证；本scope有自己的PID/occurrence/20分钟物理上限，root只在自有页面关闭后写stop-requested，正常join。验收以实际Sidebar打开、名称读值与截图为准，不把服务准备当作产品通过。

生产修改前将保存root package.json、bun.lock及原UI patch差异，并通过正常Bun patch流程产生两包编辑副本；26个目标文件逐个保存前态。后态使用新私有构建及新的正常owner，避免把旧图或旧服务套到本轮。当前还没有392新页面结论或产品改动。

## Root前态证据与正文增强授权

自有392-before production listener在18505真实打开Desk budget，英文View All Protection Ranges得到Sidebar panel/Resize sidebar/Close sidebar及Sheet tabs、两个Notifications alt+T；中英截图与AX已保存scratch。保持表格实例切中文后五名仍英文，已打开侧栏正文亦保留英文；关闭再由中文查看所有保护范围重新打开，正文全中文而五名仍英文。此差异排除LocaleService未更新：原Sidebar memo只依赖sidebarOptions，CustomLabel与权限列表不订阅语言，缓存节点未重绘。

audit_ui读到View All操作保存标题键，CustomLabel→SheetPermissionPanel→同selection key SheetPermissionPanelList没有React memo阻断，正文在render调用t；重新创建同类型同key节点即可更新语言且保留state。root另核对安装core公开getCurrentLocale():LocaleType。root批准在原四组件五名称范围内，Sidebar读取同一LocaleService.getCurrentLocale()，将现有options useMemo依赖改为[sidebarOptions,currentLocale]。既有binder负责发射后的重绘，currentLocale只是同步读取事实用于memo依赖，不增加第二状态/订阅或open/close。width仍从现有sidebarService.width取值，不换工作簿/selection/key/owner。两包26vendor文件数不变。其它提前t标题的消费者和详情错误快照需单独后续审查，不伪称全面解决。

前态tab30已关闭，恢复English偏好；原PID80260在stop-requested后正常terminal并launcher88318实际exit0，耗时452527ms。此前态服务没有使用模型或凭据。

## 最终实施、真实验收与剩余边界

两包正常Bun patch-commit登记，每包13个vendor文件；保留389补丁，Design未变。独立agent复核八runtime绑定与实际preset消费：UMD sidebarOptions重命名覆盖memo和关闭.id，LocaleService未被遮蔽；四组件使用成熟binder销毁路径，Sidebar memo含实际currentLocale。正常frozen install、overlay typecheck及私有build均exit0，构建1m32s，原大chunk提示保留；没有运行UI测试。

真实新owner PID41976在18505/ui提供私有新构建。tab31原Desk budget里B2改9，B4自然重算14；真实View All侧栏选All sheets，ArrowRight宽330→350。保持已打开侧栏与相同实例，English→简体中文→English：五名称和两个实际Sonner区域同步，header/list/空态/添加按钮正文更新，All sheets蓝色选中和宽350保留；B3原选区与9/5/14均保持。普通视图和全屏截图人工复核。回英文ArrowLeft恢复330，Close sidebar正常关闭；选择B2:B4实际点击Sum28产生Copied消息。真实Download菜单键盘下载CSV为61字节，完整字节核对9/5/14而非模型自述。

独立Notification服务消息没有单独触发；两个实际区域名称均读到中英，Messager真实Copied已呈现。其它预翻译标题、数格式类型身份、权限详情错误状态、移动SheetBar及旧More Colors焦点、只读/collapse/virtual scroll均没有本批验收承诺。共享SideBar刷新使原render文案获得更新机会，不能据此宣称所有面板状态语言问题完成。

初次后态launcher显式误用Windows PowerShell5，ArgumentList不支持且未创建owner/进程；保留此工具失败事实，改用当前PowerShell7重跑原launcher。两前后态owner均只在自有页面关闭后stop-requested，launcher88318/22528真实exit0，terminal记录listener停止与recovery释放；后态耗347549ms，无模型/凭据。

[人工摘要](../../artifacts/2026-10-13-spreadsheet-accessibility-locale-392/observations/final-review.json)、[中文全屏截图](../../artifacts/2026-10-13-spreadsheet-accessibility-locale-392/screenshots/after-zh-fullscreen-sidebar.png)、[全部证据](../../artifacts/2026-10-13-spreadsheet-accessibility-locale-392/README.md)包含9截图、实际AX、宽度、CSV、安装/build/typecheck及owner/terminal。
