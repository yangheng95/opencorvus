# 文件移动后的键盘接续与目录发现调查

## Recall

用户持续按批并行体验UI（User Interface，用户界面）/UX（User Experience，使用体验）、功能和缺陷，先根因/影响分析落spec（规格），真实隔离桌面/截图人工复核、聚焦正向功能检查、清晰提交/普通merge upstream/正常push后下一批，直到明确停止。b22 d4c86939a已正常push，全部钩子/密钥扫描0通过；真实看板连续时间与原record已验。本人页面46/47与服务10898/22855均正常关闭退出0，main/upstream0/0、原177状态保留/暂存空。Sol凭据授权仍未答，不重复问、不读取/使用凭据、不模型调用。

本批functional_audit/ui_audit一层只读并行，禁止再委托。已读FileExplorerPanel所有create/rename/single/multi move/copy/drop/delete入口、runMutation所有权和applyMoveResults/applyCopyResults/cache/required refresh/rows/虚拟焦点、Dialog动态returnFocusTarget与app-dialog关闭流程、b10 file-rename-focus完整失败迭代/真实scope保护与07-panel合同、服务File API（Application Programming Interface，应用程序接口）具名错误/路径读写。当前检索命中的file-workbench-mutation为服务数据检查，后续读明确内容后才决定是否运行；不新增/运行UI自动化。

功能线另完成公开目录搜索与原历史审计：普通项目File.init由ripgrep --files生成文件及祖先目录，home/根目录特殊处理；公开Find.files文案支持目录，没有只承诺祖先限制。b01和11/02只改变排序/limit，所说“空目录查询”是空关键词。真实空文件夹未验，不能先称回归；当前只有FileRoutes/debug入口直接调用，Explorer固定type=file。搜索ignore由ripgrep负责，列表根ignore matcher仅ignored提示，不能替换或平行重建；任何新增目录扫描会影响bootstrap/File.init打开和文件搜索成本。保留边界后先做自有输入对照，不先补扫描。

## 修改前根因与影响分析

主候选：Explorer单文件通过Shift+F10→Move，移到另一自有已存在目录后，成功数据/selection已更新，原焦点行随缓存刷新卸载，默认Dialog仍记旧按钮，稳定焦点可能留BODY；箭头/Enter不能接续。触发是确认后applyMoveResults清原/新父缓存→当前行/Virtualizer退役→重新读取，而它只更新真实展开/选择/anchor，没有操作焦点交接。b10已修rename这一同源路径的动态返回者/刷新后真实row焦点，但明确保留move/drop原调用，不能假定已覆盖Move。

横向范围：单/多选Move dialog及拖放都调用移动应用层；Copy也清源/目标父缓存、可能退役按钮，context New folder清父缓存而toolbar New触发器稳定。Delete无新目标且清selection，需独立交接设计。它们均为待实证UI候选，不把可能性冒称本批覆盖或更改共享数据层。调度/队列/唤醒/Session occurrence（执行轮次）/恢复/并发/终态无实际异常；当前问题是原页面焦点归属，不改运行机制。

若Move真实稳定失败，方案优先从现rename提取已证实的私有操作焦点primitive，复用scope/query/active/loaded receipt/当前rows/rowElements/focusRow/Dialog动态返回者，不复制一份、加timer/监听器/伪事件或全局抢焦点。只给已证实的Dialog移动入口连接该primitive；拖放/Copy/Delete未验不默认接入。原rename语义、真实移动/保存/dirty editor/失败/取消/作用域与查询失效保护保持。多选若实证同根因，再在其原runMutation活跃范围内接入，选择真实已完成回执对应的原anchor；先补方案具体接口再实施，不靠结束后已退休token调焦。

风险是关闭过渡误诊、异步editor/新控件焦点被夺、query/deferredQuery不一致、失败读或旧scope回焦、目录跨层新行未挂载、虚拟跨屏等待不结算；沿b10既有真实行测量/操作保护，并逐项标记实际验收边界。API/数据库/文件内容/配置/持久格式/权限/消息/模型不需改；纯UI不增加自动化测试。成熟primitive已有明确证据，无新公共接口/平行行表。

## 真实输入与验收计划

本人Temp opencorvus-iteration-20261108-b23，新profile-before/after、自有Git项目及私有Git配置，dev38964/38965 /ui；before现main-LHPnVMSt.js，若改UI则普通build后after，无单独Vite/用户进程窗口操作。本人notes.txt、other.txt、dest目录与固定原文，真实移动限这些可重建输入，不删除用户文件。

先公开创建empty-target目录、列表确认、find/file type=directory查询、再其中创建seed.txt同查询，记录真实状态/输出/原字节；Explorer仅人工查看实际新目录，不冒称有目录搜索界面。结果据证决定后续能力改进，不混一套忽略扫描。

主体验Browse files，实际notes行原焦点Shift+F10→Move目标dest/notes.txt，稳定截图/focus后ArrowDown/Enter验证继续；公开文件/磁盘精确正文/目标和既有other字节。再按实际主缺陷核取消/冲突/搜索保留或退出、目录与多选，先证据后收拢范围。若现已正确则证伪不强改。

after新普通构建和隔离实例真实中英Move及同rename回归、键盘接续/原字节，截图人工复核；类型/语言/build/renderer/docs/architecture只是辅助。聚焦非UI服务正向测试仅真实数据契约，不代替页面或Provider E2E（End-to-End，端到端）。本人资源正常shutdown/原session退出0、原177状态/README本条、范围提交/上游合并/完整待推审查/正常push后继续。

## 实证与实施定稿

正式HTTP（Hypertext Transfer Protocol，超文本传输协议）先创建empty-target目录200，列表明确directory；同名type=directory返回[]，实际在其中创建本人seed.txt后原查询返回[empty-target/]。真实checker期望物理空目录可发现而红，原回执全保留。确认旧能力缺口，非b01排序回归；完整忽略与扫描成本合同尚需设计，不能用列表root matcher/新平行扫描根治，本批明确未修，不包装完成。

IAB48/38964实际Move前曾左键notes.txt，原工具正常打开编辑器；切回Explorer后Move该已打开文件，原服务重开映射后的编辑器，稳定DIV/notes.txt持焦，属于正确所有权，不能按瞬时BODY造补丁。随后仅用原other.txt行的Shift+F10→Move dest/other.txt，不先打开文件；成功反馈/新行/展开/真实selection均正确，稳定BODY。01/02实际截图人工查看；BODY原有焦点上ArrowDown/Enter后仍BODY、当前Explorer，明确键盘接续断点。公开200+物理字节证实两个移动文件及dest/next.txt均逐字保持。

定稿只接单文件Move和原rename：提取现rename完整捕获/动态目标/刷新后恢复逻辑为组件私有capturePathMutationFocus(scope)，返回原returnFocusTarget和restore(path,reads,ownsOperation)。两处都用真实result.path及当前required read，原scope/query/active/deferredQuery/visible/list矩形/新焦点保护保持原式。已打开文件进入编辑器时active=false，所以不抢回；失败/取消仍原返回者。多选/拖放/Copy/New/Delete没有本批真实接续证据，原调用不接入，不在applyMoveResults全局调焦。不改共享Dialog或文件服务，无定时器、平行状态或UI测试。

## 首轮后态发现与方案修订

首轮新构建main-CpqLifGE.js/38965/IAB49，未打开notes Move dest/notes.txt稳定BUTTON/notes.txt（03），直接ArrowUp/Enter打开dest/next.txt原邻文件正文（04），主修复已实证。搜索other→Move dest/other.txt仍匹配，焦点却归Search files，值other保持；05明确首轮此分支未通过，不称新行接续成功。CUA之后按旧精确名称other.txt定位失败，因为实际新结果可访问名为other.txtdest；该定位错误不等于新产品故障。

真实GET find/file(query=other,type=file)返回[dest\\other.txt]；rows搜索项保留该原路径，selection映射已有normalizeExplorerPath，移动回执则归一dest/other.txt。现helper沿原rename仅归一result.path、直接比较entry.path，因此Windows子目录搜索无法认同一实际路径。b10只证明顶层搜索aaa改名，未触发分隔符差异。根因是同一现有宿主路径规范未用于两侧身份比较，不是查询/文件错误或刷新并发；07-panel原路径身份合同保持。

修订只把helper当前row查找的路径同样经过现normalizeExplorerPath，再与nextPath比较；保持原row/key/原搜索结果/公共API身份，不做replace字符串或引入新规范。该primitive已按真实directory处理Windows分隔符与POSIX字面反斜杠，不复制另一算法。补新普通build/真实子目录搜索Move仍匹配→退出匹配，及原rename子目录搜索回归；原成功03/04保留首轮证据，最终新构建重验核心路径。旧页面/服务正常结算后复用本批私有profile，不动用户数据。

## 最终实现与验收

最终main-Dz-yHp9q.js（普通build61秒）/38965新IAB50，纯路径现checker53pass55断言，含Windows/UNC（Universal Naming Convention，通用命名约定）与POSIX（Portable Operating System Interface，可移植操作系统接口）字面反斜杠/空白身份；未改测试或路径算法。类型、两语2921键、renderer public surface、docs:check352ops26groups、architecture-index20docs通过。纯UI没有新增/运行UI自动化；首轮build53.07秒及其未通过搜索分支保留，不冒领最终全通过。

最终实际交互：新增本人fresh.txt未打开便Move dest/fresh.txt，新BUTTON/fresh.txt持焦（06），直接ArrowDown/Enter打开dest/next.txt原邻正文（07）。query=other下原dest/other.txt Move other-retained.txt后新搜索BUTTON持焦（08），同子目录搜索Rename other-renamed.txt仍新BUTTON持焦（09）；再Move dest/archived.txt退出匹配，原Search files INPUT/other持焦（10）。不刷新，Escape清query后切中文，Move archived→dest/资料.txt，新BUTTON/资料.txt持焦，摘要与控件中文、文件身份原文保留（11）。

notes.txt Move取消后原BUTTON/notes.txt持焦；再Move已存在dest/fresh.txt真实409 FileConflictError，Request ID a852044d-e4de-491f-972d-07b83f620419，原行仍持焦且完整Details可读（12）。原已打开next.txt经Explorer Move dest/neighbor-renamed.txt后原文件工具接管，实际DIV/neighbor-renamed.txt持焦（13），新primitive不抢回。四份最终文件公开200和物理原文逐字一致；中文查询公开返回原dest\\资料.txt。全部13截图逐一呈现人工复核。

产品仅FileExplorerPanel私有焦点归属提取/单Move接入/现路径比较两侧规范化；当前07-panel同步单项Move与rename共用合同。共享Dialog、移动/复制/新建/删除服务、持久数据/API/消息/模型不改。多选/拖放/Copy/context New/Delete、慢操作中换scope/query/新焦点、100项虚拟/大小写/dirty editor完整矩阵本批未验；b10旧证据不算本批覆盖。空目录发现缺口明确未修，Windows promotion叶名候选只有代码证据留下一批，未运行设备名探测。Sol授权仍未答，零凭据/模型。

本人before93884、首轮after56970、最终after32902均POST/shutdown并原session退出0，IAB48/49/50关闭。交付按原177状态/三README本条、范围提交、fetch普通merge/完整待推审查/正常hook push后继续。
