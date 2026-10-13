# 401 Design Dialog关闭控件的当前语言

## Recall与调查状态

2026-10-14 Root审读增强方案：接受完整19语言资源及既有ConfigContext/ConfigProvider的单一默认投影，明确无locale独立使用时旧默认footer大小写也随既有en-US资源。公开ConfigProvider仍接受可选locale，内部Content仅消费投影结果；绕过该入口而直接手造缺失locale的原始Context.Provider对象不是本批支持的配置输入，不把它声明为已验证。实施仅限既有Design patch所述81个发布文件，保留389改动。先完成Root真实前态，再授权audit_ui落地；禁止UI自动化、新增Host语言源、共享文档编辑、模型/凭据、额外agent、提交或推送。Root负责索引、前后截图、独立复核、构建和范围交付。

用户持续目标是逐批并行体验UI/UX（User Interface/User Experience，用户界面与体验），先完成根因/影响分析并落盘spec，再实施有证据的改进、真实桌面页面交互与截图人工复核，范围提交、同步上游并正常推送后继续。最初Root授权单层只读调查401；audit_ui仅可写本spec及`.tmp-design-dialog-close-locale-401`，不改生产、依赖、共享索引或测试，不启动服务/浏览器/模型，不读凭据、不提交、不再次委托。Root审读完整方案后决定实施并负责实际前后态、物理收尾和Git交付。

当前根AGENTS要求已重读：修改公共定义前横查定义/调用/同义实现/历史；所有界面含无障碍名称跟随当前语言；优先成熟primitive和单一事实来源；禁止UI自动化，真实截图与人工复核不可被源码/typecheck/build替代；工作区有并行修改，只操作本批允许文件。没有发现本任务新的调度/队列/终态异常，不扩大执行控制审计。

已知真实事实来自[397最终人工记录](../../artifacts/2026-10-13-spreadsheet-button-focus-397/observations/final-review.json)：中文Range/Delete Dialog的关闭按钮在AX（Accessibility Tree，可访问性树）中仍名为英文Close。397原生按钮焦点、398深色hover修复均未涉及此名称。这是调查开始的历史事实；本批Root真实前后态与物理收尾见下文。

已读[398独立候选](2026-10-13-spreadsheet-permission-hover-398.md)、[389弹层宿主/生命周期](2026-10-13-spreadsheet-fullscreen-popups-389.md)、[392同实例语言](2026-10-13-spreadsheet-accessibility-locale-392.md)、[397焦点范围](2026-10-13-spreadsheet-button-focus-397.md)与[07-panel当前契约](../../current/architecture/07-panel.md)。已核对安装0.25.1的Design Dialog/Confirm、ConfigContext、语言包/types/四分发、实际preset合并和直接/服务生产消费者。399 More Colors触发/返回焦点、400 Escape层级不计入401改动。

调查开始已检查工作区，存在其他已授权并行变更，本轮没有改动这些文件。当前最新状态为**81文件已实施、正常依赖安装、Root独立代码复核与类型/构建通过，真实中英普通/全屏页面及16张截图人工复核完成，两个自有服务正常退出；交付按本批范围提交与正常上游推送**。下列安装代码行号均为本次读取的ESM（ECMAScript Modules）文件定位，实施后允许随依赖patch（补丁）变动；函数名、发布路径与调用链才是长期定位。

## 可观察现象与根因

397实际中文表格的范围选择Dialog（对话框）和删除确认Dialog关闭按钮仍读作`Close`；正文和取消/确定已经是中文。新401尚无独立前态，因此此处引用397事实，不把只读调查当新截图验收。

安装`@univerjs/design@0.25.1`的`lib/es/index.js:670–683`中，共享`DialogContent`直接创建Radix `Close`，内含图标与`univer-sr-only`文本`Close`。该文本是按钮的无障碍名称。`Dialog`已经在825行读取`ConfigContext.locale`供底部Confirm文案使用，但`DialogContent`没有读取语言，四个发布runtime（运行时）均保留同一固定英文。

可到达链分别是：`RangeSelectorDialog → Design.Dialog → DialogContent → Radix.Close`，以及工作表删除命令`RemoveSheetConfirmCommand → IConfirmService.confirm → ConfirmPart → ContextConfirm → Design.Confirm → Dialog → DialogContent → Radix.Close`。标题、内容和`cancelText/confirmText`均不能覆盖这个独立的关闭文本。把取消翻译、传自定义footer或刷新父组件都不能改变硬编码`Close`。

直接影响是使用当前中文界面的键盘及辅助技术用户仍得到英文动作名称；视觉图标本身不需要改。没有证据证明此文本导致取消回BODY、Escape同时关闭菜单或编辑内容丢失，以上现象必须保留在399/400独立范围。此前389只处理弹层宿主与菜单归属，392只处理五个其他无障碍名称及Sidebar语言刷新，397只处理原生button焦点，398只处理权限卡片悬停样式，均没有修改本处语言源。Design patch历史仅检索到`2aedc39d9 fix(spreadsheet): preserve fullscreen popup and menu ownership`，不能把这些已交付批次称为本缺陷回归。

## 搜索、实际安装链与公共契约

全仓搜索覆盖：`packages/**/src`中的Univer导入、Dialog/Confirm/ConfigProvider及locale调用；`specs/current/architecture/07-panel.md`与389/392/397/398记录；root`package.json`、`bun.lock`及Design patch；所有安装`@univerjs`包的ESM中对Design Dialog/Confirm的导入别名及JSX（JavaScript XML）调用；`dialogService.open`、`confirmService.open/confirm`服务调用；Design四runtime、四locale目录、全部19个locale类型，以及preset注册插件与locale聚合。精确读取得到的有界调用片段保存于自有scratch的`dialog-consumers.json`、`service-consumers.json`、`runtime-close-evidence.json`，不是测试或正式页面证据。

实际消费从`packages/overlay/node_modules/@univerjs/preset-sheets-core/package.json`建立解析上下文，经preset导入找到的Design包为：

```text
node_modules/.bun/@univerjs+design@0.25.1+7492c01c6988791b/node_modules/@univerjs/design
```

root `node_modules/@univerjs/design`是Bun patch工作副本，不能用它的上游依赖解析代替实际preset解析。完成patch后须再次按相同实际消费者解析核对，而不是仅检查root工作副本。当前产品Univer入口是`packages/overlay/src/components/interactive-artifact/SpreadsheetArtifact.tsx`和同目录`univer-spreadsheet-adapter.js`；没有另一个Host Design Dialog实现需要同步。

安装包`package.json`公开入口为：import→`lib/es/index.js`，require→`lib/cjs/index.js`，types→`lib/types/index.d.ts`；`./locale/*`对应ESM/CJS及types，`./lib/*`可直接引用其他发布文件。还发布`lib/index.js`与`lib/umd/index.js`（Universal Module Definition，通用模块定义）；本次遍历安装Design的lib树未发现source map文件。不能只修ESM而留下其他发布runtime不同合同。

公共契约及本批判断：

| 定义 | 当前事实 | 本批处理 |
| --- | --- | --- |
| `IDialogProps` / `Dialog` | `closable`、`onClose`、`onOpenChange`、`keyboard`、`mask`、`maskClosable`、footer等；没有关闭名称参数 | 不新增Host传参或逐调用覆盖，不改变行为和签名 |
| `DialogPrimitive.d.ts` / `DialogContent` | Radix Content属性加`closable`、`onClickClose`；顶部Design入口不单独导出Content，`./lib/*`仍可深引用 | 在共享Content读取现有Context；不另造primitive或替换Radix原生Close |
| `IConfirmProps` | `cancelText/confirmText`是取消与确认，不是关闭按钮名称 | 不滥用两个动作字段 |
| `IConfigProviderProps` | `locale?: any`、`direction?: ltr/rtl`、`mountContainer` | 使用现有locale单源，不把方向当语言，不新增全局语言/状态 |
| `ConfigContext` | 默认只含`mountContainer`；没有默认locale | 明确下述外部可选locale边界，不隐藏为“所有库消费者均支持” |
| `ConfigProvider` | `useMemo`依赖`locale,direction,mountContainer`，将locale直接透传，无默认语言合并 | 当前产品完整注册中英资源；不引入英语literal fallback或第二配置面 |

### 实际语言传播与同实例生命周期

产品`utils/i18n.ts`只支持`en-US/zh-CN`。adapter的`spreadsheetLocale(language)`把这两种界面语言映射到安装Univer枚举；`createUniver`通过`mergeLocales(enUS/zhCN)`注册preset资源，`runtime.setLocale`调用同一`univerAPI.setLocale`。`SpreadsheetArtifact`现有effect订阅`getLocale()`并调用这个runtime，语言切换不重建工作簿。

core preset中英聚合文件从`@univerjs/design/locale/en-US`或`zh-CN`导入Design资源，再合并docs-ui、sheets、formula、formula-ui、numfmt-ui、sheets-ui和ui资源。因此补Design既有locale资源后即可自然进入产品，无须重复修改preset聚合、Host i18n JSON或adapter。

安装UI的`DesktopWorkbenchContent`在5169行订阅`LocaleService.localeChanged$`并执行`setLocale(localeService.getLocales())`；5187行的`ConfigProvider`收到`locale?.design`，global components在其React子树中。Dialog/Confirm服务的Portal移动物理DOM（Document Object Model，文档对象模型）并不改变React Context归属。ConfigProvider在locale对象改变时生成新value，Content的`useContext`自然重绘同一个关闭span，无需额外订阅、effect、ref、locale key或重挂载。

`DialogPart`虽按`dialogOptions`缓存attrs，Context消费者仍自行重绘；`ConfirmPart`的options订阅和清理保持原样。这只保证新关闭名称跟随语言，不保证各调用者已预翻译并缓存的title/body都响应语言。那些正文快照不属于401，不借本批宣称整个Dialog区域语言完备。

## 消费者与共享影响面

直接JSX生产消费者已按真实import别名核对，ESM位置如下；同义service生产入口分组列于后表，不能把每个已安装插件都当产品已启用功能。

| 包/位置 | 调用 | 影响 |
| --- | --- | --- |
| design 860 | `Dialog → DialogContent` | 唯一关闭名称定义 |
| design 1751 | `Confirm → Dialog` | 所有可关闭确认框共用 |
| design 1675 | `ColorPicker → Dialog` | 明确`closable:false`，本批不会新增关闭按钮；399另审 |
| sheets-formula-ui 4617 | `RangeSelectorDialog → Dialog` | 397已观察真实中文Range；可拖动、`mask:false`、`maskClosable:false` |
| sheets-ui 20752 | `DefinedNameContainer → Confirm` | 名称管理删除确认，静态覆盖，401未承诺真实逐项验收 |
| ui 6686/6821 | `ContextConfirm → Confirm`、`DialogPart → Dialog` | 保留beforeClose/beforeConfirm回调、service关闭/resolve与options生命周期 |

已安装包中共找到30个命名Dialog/Confirm服务调用点。当前core preset注册的包内有19处；其中独立Docs页面并非当前产品桌面Spreadsheet已验收入口。另11处所属插件安装存在但没有出现在当前core preset注册列表，不扩大产品功能承诺。

| 当前core范围 | ESM行号/语义 |
| --- | --- |
| docs-ui | 8845插入表格确认、11088页面设置；共2 |
| sheets-ui 删除/插入/隐藏/移动 | 5011向左删除；5045/5057向上删除；5492/5519隐藏行列；5735/5747向下插入；5785向右插入；6125/6156移除行列；6190移除工作表；共11 |
| sheets-ui 权限 | 8304权限Dialog operation；12937权限检查UI；26324权限用户详情（该详情显式`closable:false`）；共3 |
| sheets-ui 工作表名称 | 22782/22817 SheetBarTabs名称错误/重名Confirm；共2 |
| sheets | 9816合并单元格Confirm；共1 |

其他已安装未注册core插件：find-replace 687/1220（替换确认/查找Dialog），sheets-data-validation-ui 210/232（拒绝输入），sheets-drawing-ui 1385/2001（保存/粘贴图片），sheets-sort-ui 192/202/902（排序确认/扩展/排序Dialog），sheets-table-ui 1307/1841（选择表格/表格控件）。共享primitive静态影响这些包，但401不打开它们、不声称生产可达或已实页。

Desktop与Mobile UI均绑定同一DesktopDialogService/DesktopConfirmService；修复对两者共享代码有效，但用户默认范围是桌面，移动端没有实页和布局承诺。Dialog服务注册global component后仍在上述ConfigProvider中，需保留原register/dispose、Promise resolve、beforeClose及footer事件，不能为了名称替换这些生命周期。

## 第一轮13文件草案的拒绝与修正

Root明确未批准只补中英并让`locale?.Dialog?.close`在缺资源时返回undefined的草案：不能明知损坏当前可选locale公共合同。该草案的13文件数和“外部缺名称可以作为边界”均已撤回，不作为实施依据。下面改为既有ConfigContext/ConfigProvider中统一默认投影、完整19语言资源方案，待Root再次审读；这不是恢复Dialog固定英语分支。

## 最小完整实施方案与准确文件范围

推荐在安装Design唯一`DialogContent`中调用无条件顶层`useContext(ConfigContext)`，保持原Portal/Overlay/Content/Radix Close和所有props原样，仅将屏幕阅读文本改为该Context提供的`Dialog.close`。**不得将hook放在`closable &&`分支内**。本次语言资源键为`design.Dialog.close`，英文`Close`，中文`关闭`；不要重用语义不同的`Confirm.cancel`。

建议代码形状仅表示合同，不是另一份产品实现：forwardRef回调改为block，顶层读locale，return原JSX。关闭名称从既有ConfigProvider已投影的资源读取；不保留旧`"Close"`分支，不用文字回译、Host语言判断、DOM抓取、局部独立字典、额外props或语言key remount。

实施范围预计81个发布文件，沿用已登记的`patches/@univerjs%2Fdesign@0.25.1.patch`，不是再建平行patch：

| 文件集合 | 数量 | 改动 |
| --- | ---: | --- |
| `lib/index.js`、`lib/es/index.js`、`lib/cjs/index.js`、`lib/umd/index.js` | 4 | 同一个Content读Context；ConfigContext/ConfigProvider默认语言投影；依赖现有英文资源 |
| `lib/locale/*.js`的19语言 | 19 | 同语义`design.Dialog.close` |
| `lib/es/locale/*.js`的19语言 | 19 | 同资源 |
| `lib/cjs/locale/*.js`的19语言 | 19 | 同资源 |
| `lib/umd/locale/*.js`的19语言 | 19 | 同资源，保留原wrapper返回形式 |
| `lib/types/locale/en-US.d.ts` | 1 | `Dialog: { close: string }`资源字段 |

`zh-CN.d.ts`及其他17个非英文locale类型全部`typeof enUS`，无需复制改写这些别名。必须给19个locale的全部发布格式补齐required字段，而不是类型先承诺、运行时仍缺键。以下文字均直接来自同安装版本`sheets-ui.button.close`已发布的19语言资源，记录在scratch`locale-audit.json`；它是同语义翻译依据，不能让Design在运行时反向依赖Sheets UI。

| locale | 关闭名称 | locale | 关闭名称 |
| --- | --- | --- | --- |
| ar-SA | إغلاق | ca-ES | Tancar |
| de-DE | Schließen | en-US | Close |
| es-ES | Cerrar | fa-IR | بستن |
| fr-FR | Fermer | id-ID | Tutup |
| it-IT | Chiudi | ja-JP | 閉じる |
| ko-KR | 닫기 | pl-PL | Zamknij |
| pt-BR | Fechar | ru-RU | Закрыть |
| sk-SK | Zavrieť | vi-VN | Đóng |
| zh-CN | 关闭 | zh-HK | 關閉 |
| zh-TW | 關閉 | — | — |

### 默认locale的唯一配置面

再次读取官方v0.25.1和当前dev的ConfigProvider源码后，确认上游确实没有完整默认locale对象，也没有可移植的最新Dialog语言方案。当前Design各组件分散使用可选locale，其中Dialog旧footer自带`Cancel/OK`，Confirm Footer读取`locale?.Confirm.confirm/cancel`，Calendar直接解构`locale?.Calendar`。因此**不能只往默认Context塞`{Dialog:{close}}`**：把locale从undefined变成缺Confirm的truthy对象，会使原来可选读取的Confirm崩溃。

推荐既有单一ConfigProvider建立以下明确配置合同，不修改Host或所有调用者：

1. 完整英文默认对象只来自现有`en-US`资源的`design`。`ConfigContext`在没有Provider时以此完整对象作为默认locale，保留原mountContainer。不要另写一个只有Close的默认字典。
2. `ConfigProvider`继续接受现有可选locale输入。在原`useMemo`中，当整体locale省略/null时选用同一完整默认对象；当传入资源时保留原对象全部字段，仅投影新增`Dialog`对象及`close`默认值。`Dialog.close`使用调用者给出的非null值，否则取同一个英文资源字段。这是配置层对新增可选输入的默认投影，Content不包含英文literal、备用语言判断或另一个事实源。
3. 不泛化为递归merge工具，不更改Calendar/Select/ColorPicker等既有字段的合并合同。非空locale中未配置的旧字段保持原行为；本批只让新增Dialog字段完整。不要用DOM检测、语言代码硬编码、Host字典或用户不可见的并行状态补洞。
4. ConfigProvider memo依赖仍为`locale,direction,mountContainer`；投影随当前locale输入重算，同实例Context更新直接重绘Content，工作簿/对话框owner和原state不变。`closable:false`仍没有关闭按钮。
5. `locale?:any`输入类型不需要改为强制完整对象；内置语言资源的`Dialog.close`是required，所有19资源同步兑现。ConfigContext现有导出类型仍包含可选locale，外部若绕过ConfigProvider直接手造`ConfigContext.Provider value`就会绕过该配置归一化；当前安装全仓没有此类生产消费者，不能用这种任意手造对象替代既有公共ConfigProvider入口。若Root要求将裸Context Provider也视为必须接受缺locale的输入面，必须先决定额外类型/运行时合同，不能再次以空标签收尾。

这会改变无locale独立使用时部分旧默认显示：Dialog footer的`Cancel/OK`将采用资源已有的`cancel/ok`；Confirm footer在整体locale省略时会有英文资源文字，Calendar等也会得到完整默认资源。该影响仅来自省略locale的公共使用，当前完整中英产品上下文的旧字段值保持原样；本次必须明示该影响，不能声称仅一个span发生变化。没有为这些外部独立使用创建UI自动化，Root需审定它是否接受此最小完整配置合同。

ESM与root runtime可直接import相邻`./locale/en-US.js`，CJS require同一路径（实际该文件`module.exports = locale`，没有`.default`）。它们引用既有单一资源模块，不复制英文值。UMD不能新增对`UniverDesignEnUS`脚本全局、require或AMD依赖，否则会破坏现有独立bundle入口；应按编译bundle语义把同一个完整英文资源对象内联一次，修改脚本从已更新en-US资源生成该声明，禁止手写平行文案。UMD其余19语言入口保持原独立资源wrapper。这种发布格式内联属于同一资源的分发，不是新的语言选择面；要用读取对象/精确变更复核其来源，不用可变摘要验收。

### 四分发与UMD绑定

ESM和`lib/index.js`已有React `useContext`导入，可直接复用；CJS用现有`react.useContext`命名空间。UMD模块外层参数`t`是React、`n`是JSX runtime，`G`是ConfigContext，`va`是DialogContent。当前`va`解构参数里`children:t`**遮蔽外层React**；因此加入`t.useContext(G)`前须只把该children局部绑定与它在children数组的唯一使用改为明确的`dialogChildren`。不能误将React调用解析为children值，也不能全文件替换`t`。

UMD的`ga`是389已改的DialogPortal，`_a`是Overlay，`da`是Content，`ma`是Close，`D`是CloseIcon，`U`是clsx，`K`是borderClassName；`Rt`是ConfigProvider，`G`是ConfigContext。新增默认资源声明需用经全文件查重的清晰局部名并早于`G`初始化，不覆盖这些短绑定。必须保留原props/return结构。已有389的Dropdown/Popover/Tooltip/Portal修复四runtime都要保留。完成后由独立review核对当前patch相对已提交基线的精确新增范围、81个file header、无空`.bun-tag`缓存段、实际preset安装与构建消费；不以可变源码摘要作功能验收。

root正常Bun patch prepare/commit与frozen install后做当前声明的typecheck/build，并核对preset解析到的中英资源。这些检查仅证明类型/交付链，不替代真实Dialog名称与行为验收。没有后台数据模型、网络协议、权限决策或调度变更；不需要Provider/model调用。

## 权威资料与安装版本区分

已实际查阅[React useContext](https://react.dev/reference/react/useContext)：顶层读取并订阅最近Provider，value变化会重绘消费者；父组件memo不阻止Context更新。这里复用现有React Context，避免另添语言订阅和清理责任。

已实际查阅[Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog)：保持现有Close primitive与可访问名称，保留库管理的键盘/弹层行为。官网当前版本与安装版本不是同一发布，不据官网推定本地新增API；本地真实类型与实现是本次修改事实依据。

已实际查阅[Univer国际化文档](https://docs.univer.ai/guides/sheets/getting-started/i18n)：语言包注册和运行时setLocale是成熟集成方向，布局方向不是语言。页面当前文档版本高于安装0.25.1，本方案只使用已在本地核实的LocaleService、ConfigContext和setLocale，不升级库或采用新版接口。

补充核对官方[v0.25.1 ConfigProvider源码](https://raw.githubusercontent.com/dream-num/univer/v0.25.1/packages/design/src/components/config-provider/ConfigProvider.tsx)与[v0.25.1 DialogPrimitive源码](https://raw.githubusercontent.com/dream-num/univer/v0.25.1/packages/design/src/components/dialog/DialogPrimitive.tsx)，其可选locale、无默认locale及Close文字与安装包相符。当前[dev ConfigProvider](https://raw.githubusercontent.com/dream-num/univer/dev/packages/design/src/components/config-provider/ConfigProvider.tsx)和[dev DialogPrimitive](https://raw.githubusercontent.com/dream-num/univer/dev/packages/design/src/components/dialog/DialogPrimitive.tsx)也未提供可直接移植的语言实现；dev已有其他Portal/Close回调调整不属于本批，不从中顺带回移。

## Root真实桌面前后态计划

1. 重用已获授权的隔离、无凭据review scope与真实Desk budget Spreadsheet；记录其canonical runtime来源和固定截止，不称fresh数据库。无模型调用，不生成替代产物。先以当前版本读取中文Range与Delete Dialog可达路径、AX名称和实际截图；记录同一工作簿、语言、普通/全屏状态。
2. Range沿实际权限列表→Add new permission→Select data range入口打开。记录已有范围/输入、关闭按钮真实角色名称。后态英文名称为`Close`，中文为`关闭`；在真实可用的产品语言入口进行同实例切换并重新查看Dialog。若非模态Range允许Settings正常访问，优先证明保持已打开Dialog与输入时名称更新；若产品入口会关闭Dialog，按实际情况记录未取得同挂载切换证据，不能调用页面内部API强行改语言冒充正常交互。
3. Delete沿真实工作表菜单入口触发。优先使用本scope自行创建的临时空工作表，查看关闭按钮而不删除原数据。模态打开时不绕过遮罩去操作Settings；分别在中英语言下自然打开确认框。实际鼠标关闭与键盘聚焦原生按钮Enter/Space关闭，确认关闭后原工作表和内容保留；临时对象按原scope授权真实清理。
4. 普通视图与全屏各覆盖当前目标Dialog，检查关闭图标布局、弹层在正确fullscreen宿主内、名称、点击和键盘可用、语言切换保留现有表格内容。无需重复399颜色Dialog取消回焦或400Escape层级以扩大本批；若观察到它们，准确记录而不归因到文本修复。
5. Root人工查看与目标Dialog绑定的前后态截图，AX仅辅助验证名称，不能替代视觉。没有新增、修改、更新或运行UI自动化；不能编写源码文案断言、渲染/DOM/Playwright test、快照或像素差异检查。当前只读检索未打开或执行UI测试路径；与本批无关的并行测试删除由原owner负责。
6. 恢复原语言/主题/缩放，清理仅自建临时对象，关闭自己的tab和review owner并取得原launcher正常join。若真实Checker、页面、关闭或交付未完成则逐项列明；不以build/typecheck、DOM文字或功能局部通过包装全量验收。按显式allowlist保存必要截图、观察、构建/安装日志及物理收尾；不复制数据库、凭据、模型目录或whole vendor。

## 交付、风险与未完成项

Root审读后负责最小生产修改、真实前后态、共享索引/07-panel/双语CHANGELOG更新、当前文档检查、范围提交和正常上游合并推送。自有scratch`index-ops.json`只提供根索引与月索引精确建议，不由本agent改共享文件。当前不创建401artifact空目录占位，待实际证据产生后按根规范登记。

剩余风险/边界明确如下：撤回13文件草案，Root已批准81文件完整资源/默认投影方案及公开省略locale的旧文字影响；UMD children绑定和默认资源内联必须正确；所有发布格式和语言资源必须沿实际preset安装消费；同已打开Dialog切语言须真实自然入口证明；只读调用覆盖不等于各service场景实页。移动端、独立Docs、未注册插件、其他Dialog正文快照、399返回焦点、400Escape层级均未实页验证或不在本批。至此无产品修改、无服务/页面/模型调用、无测试运行。

## 实施前有界准备（仅scratch，等待Root消息）

`prepare-vendor.mjs`已离线完成81文件的AST（Abstract Syntax Tree，抽象语法树）定位预览：4 runtime、76语言资源、1资源类型。它只写自有`vendor-before/`、`vendor-planned/`及有界`vendor-files.json`，不写依赖或tracked patch。原完整Design patch、原工作区diff与暂存diff分别保存在`design.patch-before`、`design.patch-worktree-before.diff`、`design.patch-index-before.diff`；本次两个原diff均为空，没有覆盖既有未提交Design改动。

首次预览使用未规范化preset软链接路径建立createRequire上下文，读到了root patch工作副本；已保存该次元数据为`vendor-files.initial-root-resolution.json`，随后改为先`fs.realpathSync(preset package.json)`，从真实`.bun` preset文件解析实际Design包。规范化后再次逐字节核对81个已保存原文件：真实preset安装与root工作副本均等于原快照，所有生产文件和原patch仍未改变。该检查是防覆盖并行修改/确认实际物理消费者，不是哈希门或UI功能验收。

`preparation-review.json`记录四runtime的精确声明和绑定：ESM/root使用相邻en-US import；CJS使用现有直接`module.exports`对象；UMD只内联一次由同一更新英文资源生成的完整默认对象，外层factory依赖未增加。UMD `va`只把`children:t`及其数组使用改为`dialogChildren`；`t.forwardRef`/`t.useContext`均引用外层React，`Rt`原`useMemo`保持三项依赖，`G`默认配置增加完整locale。`projectDesignLocale`只在配置层执行，Content顶层hook读取`dialogLocale.Dialog.close`；portal、回调和原children表达式保持原合同。

81份预览均通过TypeScript parser语法读取；这仅为编辑工具的有界结构/绑定检查，没有运行组件、DOM或UI测试，也不替代Root的截图验收。`apply-vendor.mjs`已准备但**尚未执行**；它将在Root明确实施消息后先核对所有原文件与原patch，再只写这81份已审预览。Bun patch commit/frozen install、build/typecheck、前后态真实操作及物理收尾由Root安排。

## Root前态事实及授权后的实施结果

Root已完成独立401-before真实桌面验收：中文Range/Delete在普通与全屏下关闭AX名称均为`Close`，有目标JPEG截图；实际click/Enter/Space关闭，临时工作表1真实清理，English/System/100%恢复，0模型。tab42在17:17:31.408Z关闭，原native82420 normal exit0、launcher38715 join0，早于原deadline17:33:15。以上是Root操作与反馈，不是本agent静态检查推导；原截图/观察由Root后续按允许清单归档。

Root随后明确授权本agent按已提交`179797065`方案实施既有Design patch的81发布文件，并允许normal Bun patch/commit/frozen install。先前“apply尚未执行”是前态完成前的准备状态；以下为当前真实执行状态。

- 正常准备/实施：`apply-vendor.mjs`执行前核对所有原文件及原patch后，仅写原work副本的81个发布文件。4 runtime使用同一配置层投影；19×4语言资源及英文资源类型补齐；UMD只内联一次生成的完整英文资源，children局部绑定重命名，保留389原改动。
- 工具链事实：第一次未显式设置PATH时，系统Bun1.3.14执行prepare并exit0（session19465 / chunk a7fc25，30.54s）；`package.json`声明1.4.0。原日志`patch-prepare.log/exit`完整保留。复核表明package.json、bun.lock、81原文件与原patch逐字节均未改变（`toolchain-before-apply.json`及当时`preparation-review.json`），无需restore。随后按Root确认的仓库工具`.tmp-product-iteration/sse-compression-305/bun140/bun-windows-x64/bun.exe`重新执行1.4.0 prepare，正常exit0；之后apply、patch commit与frozen install全使用正确工具，未绕过husky。
- 日志与结果：`patch-prepare-1.4.log/exit`、`apply-vendor.log/exit`、`patch-commit.log/exit`、`install-final.log/exit`均保留，所有exit为0。prepare约976ms，patch commit约2.95s，frozen install约2.40s。没有把初次版本偏差隐藏成始终正确的命令。
- patch缓存：Bun生成了首部3行空`.bun-tag`diff；先保存完整`design.patch-with-empty-cache`，再只移除已读到的该3行，保留全部runtime/resource/type差异；随后正常frozen install再次应用成功。最终Design patch恰为81个file header，无缓存段。
- 实际消费：按规范化preset真实路径重新解析后，实际Design仍为`.bun/@univerjs+design@0.25.1+7492c01c6988791b/node_modules/@univerjs/design`。`installed-review.json`记录所有81份安装文件与已审预览逐字节一致，CJS语言资源直接导出完整对象，英文Close与中文关闭可从安装资源读取。该核对证明交付文件身份和安装链，不是UI自动化或名称实际可见性验收。
- 范围：只有既有`patches/@univerjs%2Fdesign@0.25.1.patch`生产tracked文件改变；package.json与bun.lock和实施前保存原字节一致，没有改变其他patch、共享文档或并行tracked内容。Design补丁当前增量为1018行增加、35行删除（其中原UMD长行是发布格式），不能把行数当功能覆盖。

此阶段没有启动服务/浏览器/模型、没有读凭据、没有新增或运行UI自动化、没有归档或提交。Root仍需独立阅读实际patch和安装、运行typecheck/build、进行中英普通/全屏真实后态和截图人工复核；尚不得宣称401 UI已通过，更不得扩展为所有库消费者、移动端或399/400均完成。

## Root最终人工复核与物理收尾

[独立401证据](../../artifacts/2026-10-14-design-dialog-close-locale-401/README.md)保存37个原始观察（16个原JPEG）、明确安装/构建日志及两自有scope。原始[人工复核](../../artifacts/2026-10-14-design-dialog-close-locale-401/observations/final-review.json)在2026-10-13T17:35:16.249Z落盘，后续不重跑改写时间。

前态tab42/native82420于17:17:31.408Z关页，原started17:13:15.142Z、deadline17:33:15.142Z；launcher38715实际join0，服务elapsed263288ms。中文Range/Delete普通/全屏均名Close。后态tab43/native88800于17:30:39.897Z关页，原started17:24:41.003Z、deadline17:44:41.003Z；launcher50144实际join0，服务elapsed367468ms。均满足原deadline前60秒关页，不延长预算，原18505端口释放。ready的fresh文字不准确：本次复用387已闭合且凭据已清理的canonical runtime，不是新数据库，也没有模型请求。

后态Range的Close/关闭在英文/中文普通及全屏可见于AX；同一已打开radix-_r_8_、标题_r_9_经真实Settings EN→ZH保持A1:B2草稿并更新标题、控件及关闭名称。中文Enter关闭，权限表单Cancel弃草稿。Delete的中英普通/全屏名称正确，中文全屏mouse及普通Space、英文普通Enter及全屏mouse关闭，实际工作表1仍保留；随后只对该自建空表执行Delete+OK清理。原清单选中、7/5/12可见；English/System/100%恢复、作品回普通视图后关页。

Root独立读取四runtime配置/Content及UMD绑定，完整默认引用已发布en-US单源，CJS直接exports，UMD children局部与React分离。Root overlay typecheck0、private build0（保留既有chunk-size warning），未新增/运行UI自动化。原fs/promises误用writeFileSync和只读AST辅助路径错误已经修正后完成原动作；失败事实保留。截图不编辑，AX可能为diff；未宣称其他17语言/格式、独立无locale/raw Context、移动端、Docs、未注册插件及所有service实页，也未扩为399/400或单元格编辑/公式重算/模型新发布。
