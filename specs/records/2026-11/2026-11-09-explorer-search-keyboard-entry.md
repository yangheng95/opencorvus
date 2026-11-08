# 文件搜索框方向键进入当前结果

## Recall

用户持续迭代直至明确停止；本人独立，不使用子agent。每批分析落盘、真实开发/ui与本人截图、聚焦正向行为检查、范围提交、fetch/普通merge/完整待推集复核/正常push后继续。前批4b6798052已正常推送全部hook通过，HEAD/upstream0/0，原177条状态保持。Sol/凭据使用授权仍未收到，零认证/模型/合成消息，不重复询问。b01搜索框ArrowDown/Enter曾未得到可核实打开结果，本批以新真实项目验证，不把旧中间状态当根因。

已读FileExplorerPanel SearchField/全部rows/currentSearchResult/searchLoading/error/operation scope、唯一focusRow/pendingFocus/settleRowFocus/row-ref/虚拟measurement/现行行onKeyDown及全部focusRow调用、共用SearchField完整onKeyDown/onValueChange/Escape、07-panel原生按钮与唯一虚拟焦点合同、11-01-file-workspace-review的历史修复。全仓定义/调用与旧决策搜索，未发现相关现存explorer UI自动化测试；不运行或新增DOM/组件/源码文案/快照/浏览器fixture等测试。现成SearchField已有onKeyDown扩展点；已有focusRow是唯一跨虚拟窗口焦点owner，不能另建选择状态/定时焦点/第二列表。

[W3C按钮键盘合同](https://www.w3.org/WAI/ARIA/apg/patterns/button/)确认焦点按钮的Enter/Space原生激活；不将该普通按钮集合假称完整ARIA（Accessible Rich Internet Applications，无障碍富互联网应用）tree或combobox。补充调查Memory初始revision0的时间：ProjectMemory.initialEnvelope在首次访问事务中实际写入持久文件/chunk，后续读同一timeUpdated，不是Date.now虚假刷新；没有证据把它当时间缺陷，不修改。

## 修改前根因与影响分析

当前唯一Explorer SearchField未传onKeyDown或onSubmit。SearchField只有Escape清除和存在onSubmit时的Enter提交；方向键保持文本输入原生行为。↑/↓/Home/End处理器只绑定已聚焦结果按钮，故从搜索框需依Tab经过clear/new/menu等控件才能进入结果。该能力边界和旧行级焦点修复是有意分层，不能声称已证明引擎/接口异常；本批是补齐搜索到已有结果导航的键盘体验，须先在真实前态确认缺口。

搜索rows只来自currentSearchResult；该reader校验deferredQuery/source/authority/directory/selection epoch。raw query可能先于deferredQuery变化，资源刷新可暂时保留latest结果，因此输入handoff仅在trim后的raw query非空、与deferredQuery一致、资源完成且结果当前有效/无错误时接受。仅无修饰且非composition的ArrowDown取当前第一行、ArrowUp取当前最后行，消费后调用同一focusRow；焦点独立于文件选择/打开，Enter仍走原生按钮原onClick。未准备/无结果时维持输入原生处理，不创建待网络完成后自动跳焦请求。

新增入口的origin会是searchInput；用户继续编辑时origin元素仍相同，原focus owner的activeElement检查不能独自说明旧query意图仍有效。输入onValueChange在发布新query前取消同一个pendingFocus，避免旧键盘请求在虚拟测量后打断继续输入；不增平行focus owner/query影子状态。现scope切换/原焦点移走/row key失效/隐藏列表等检查原样保留。现focusRow的其他调用仅行键盘及操作反馈复核定位，全部继续同一机制，不改数据或持久关系。

在搜索状态将原目录键盘提示替换为两语言搜索结果提示“↑ ↓ Results · Enter Open”，避免搜索文件行仍提示左右展开目录；普通目录提示保持。共享SearchField/全仓其他消费者不改，只在Explorer使用其现事件接口。影响仅Explorer私有事件、query setter入口、当前语言提示与架构07；文件后端/API（Application Programming Interface，应用接口）/SDK（Software Development Kit，软件开发工具包）/搜索排序/范围/文件内容/权限/数据库与格式都不改，无迁移。没有调度/队列/唤醒/恢复或Task/Mission/Session occurrence（执行轮次）异常，不以UI异步焦点推断引擎故障。

## 验收方案（修改前）

本人Temp b37，before38994/after38995新profile/独立131原文件项目（notes+130实际match文件），从创建Git时即绑定本人私有配置/identity/禁签/autocrlf=false。两项目原字节和初始HEAD记录seed.json；不操作现用窗口/进程或原用户文件。

前态真实开发/ui搜索match-，输入ArrowDown后焦点/截图，再Enter实际效果，借普通Tab到结果并Enter确认原行激活可用；明确定性为搜索入口缺口。after Node正常构建再新服务：input↓聚焦第一当前结果，继续↓到下一行/Enter打开原文件；input↑越虚拟窗口到第80个可见结果/Enter打开正确原文；已有行Home/End/↑↓继续，Escape清空恢复目录，零结果后合法恢复、中英文提示和稳定焦点截图。组合输入、真实慢网和多进程时序未必能自然获得，不注入fake事件/DOM状态或冒称已测。更换输入立即取消旧pending请求以代码数据流及普通继续输入体验核实，不新增UI自动化测试。

真实TCP（Transmission Control Protocol，传输控制协议）公开find/file按运行时/doc schema确认实际81路径及原顺序，辅助界面“首80/还有更多”的事实，不把接口或DOM文本当视觉资格。UI（User Interface，用户界面）改动不新增后台镜像测试；overlay typecheck/i18n/build/renderer和docs/architecture辅助，本人截图才是视觉资格。正常shutdown/原session exit0/原文件逐字及Git保持，范围提交/普通上游合并/正常push；不发版本/tag/Release或安装外部软件。

## 未达成

原待实施/验收状态由下方最终结果更新。Sol/完整模型端到端不在已验范围；空目录索引、历史计划修复/子树删除等旧线索仍待独立调查。


## 前态与方案校正

80/38994真实match-搜索，01中ArrowDown焦点仍在输入，接续当前焦点Enter也仍在输入。实际连续Tab依次Clear/New/首结果按钮，02首行真实焦点环，再原生Enter进入match-000。现结果按钮导航/打开可用，缺口是搜索输入到结果的方向键入口，不是后端失败。实页及当前SEARCH_LIMIT=80明确现窗口为80，初始草案误记100，已在任何产品修改前修正为80及checker81项，不改变原容量。初次本人TCP脚本漏传必需directory，得到明确400 DirectoryRequiredError；已保留原错误并按公开contract加本人项目header重跑，不能误报产品搜索400。

03已加载原match-000.txt正文、Save禁用，证明原生结果行Enter有效；页面80关闭，before40392正常shutdown200/exit0/prompts0后实施。修正directory的实际TCP200返回81个明确有序路径000至080，运行时/doc/Ajv2020校验通过。产品仅接入SearchField现事件、复用focusRow、query变化取消原pendingFocus和两语言搜索提示，无额外数据/焦点owner。


## 最终实现与辅助验证

FileExplorerPanel新增一个私有handleSearchKeyDown，通过SearchField现onKeyDown扩展点接受当前、成功、已完成、非空查询的无修饰↓/↑，从同一rows首/末项调用现focusRow。raw/deferred不一致、加载中、错误或无结果均沿原输入归属；没有网络完成后自动跳焦队列。现onValueChange发布新query前取消唯一pendingFocus，避免输入origin元素未变化却属于过期查询。搜索模式提示只增加两语言各1键；普通目录提示保持，无API/搜索容量/排序/虚拟器/文件操作变化。

Overlay typecheck exit0、check:i18n两语言2931键通过；正常Node构建1m5s、renderer检查通过，build main-B1jIp4MA.js。docs352操作/26组、architecture20文档和精确diff检查通过。不新增/运行UI自动化，不用静态字符串、DOM断言或构建替代视觉资格。纯UI事件/提示变更未添加镜像后台单测；公开接口真实checker仅辅助确认原搜索事实。

## 真实桌面交互与本人视觉复核

after38995/IAB81使用新构建，实际输入match-并完成结果。04中搜索框↓直接聚焦match-000，焦点环本人确认；继续当前焦点↓到001，原生Enter打开001，05完整原文/路径/Save禁用。随后关闭干净文件回Explorer，输入↑进入第80项match-079，06展示从067到079的虚拟窗口及末行真实焦点环。原行Home到000、End回079的实际焦点输出核实，再Enter打开079，07原文/路径正确。没有重新聚焦input后冒称结果行Enter；按键始终送给实际:focus。

切中文后真实修改match-02，立即↓时焦点仍在输入；继续输入1得到match-021，保持输入编辑，完成后↓聚焦唯一021，08中文结果提示/焦点可读。Enter打开021，09原文/路径/保存状态正确。该真实交互覆盖一次自然快速查询切换，不等于受控网络时序或所有pending交错证明。10无结果时input接受↓后仍为当前文本输入与明确空状态，Escape经原SearchField清除；11实际目录/原目录导航提示恢复。新查询notes完成后↓首行，12当前焦点正确，Enter打开13本人原notes原文，保存禁用。全部13张前后截图均实际呈现本人查看。

未模拟composition/网络延迟、未注入事件/DOM/应用状态，IME（Input Method Editor，输入法编辑器）组合输入和修饰键保留由原风格guard及代码审查支持，未冒称人工实测。失败网络、目录切换时任意竞态和屏幕阅读器播报未测；当前首/末入口、行导航/打开、语言、空/恢复的实际场景通过。

## 真实接口、原始数据与资源退役

before/after真实TCP的find/file指定本人directory，返回原81条000至080，顺序和身份精确，运行时/doc/Ajv2020 schema均通过。当前UI仍仅首80且显示more提示，末可见项079；checker没有擅改窗口或把81项全称为可见。最初漏directory的400 DirectoryRequiredError为检查脚本自身错误，原body/参数证据保留并已修复重跑，不能当产品失败或忽略原验收。

两个项目各131原文件，before5375字节/after5374字节全部逐字匹配最初seed文本，tracked路径集和初始HEAD保持。Runtime初始化额外生成未跟踪.gitattributes/.gitignore/.opencorvus，已在核验报告如实列出，不把本人临时项目称为空工作区，也不混入当前仓库提交；profile配置文件清单空。从创建临时Git起即私有配置/identity/禁签/autocrlf=false，未碰用户配置或凭据。

页80/81关闭，40392/92206分别正常shutdown200/原exec session退出0/prompts0。零模型/凭据或合成消息，Sol/完整模型端到端仍未获授权和未验。当前修复为键盘体验补齐，旧空目录索引、计划历史/子树删除等线索仍独立待查，不宣称本批已修复。

## 交付范围

组件、两语言、当前07-panel、根因本记录/13图/接口及项目核验/检查器、三个README仅本条；保留原177条工作区状态。范围提交后fetch/普通merge/全待推提交复核/正常push，实际提交和推送事实记入下一批Recall。不创建branch/worktree/tag/Release或发布版本。
