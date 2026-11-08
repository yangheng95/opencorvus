# 新建文件夹后的键盘位置

## Recall

用户要求持续批次体验/调查、先根因与影响落spec（规格）、证据驱动修复、真实桌面/ui交互和本人截图、聚焦正向checker（检查器）、范围提交/普通上游合并/正常push后自主下一批，直至明确停止。用户最新要求“不要用子agent，你自己工作”，本批单人不委托。b26 5b24e4523已正常push，全钩子通过/密钥0，本地与upstream（上游）0/0、原177状态完整、暂存空。Sol凭据授权尚未收到，继续零模型/凭据。

已读FileExplorerPanel全部createEntry调用：工具栏New、目录上下文、背景上下文，file/directory共用API（Application Programming Interface，应用程序接口）/runMutation。已读createFileItem POST file/item/原FileNode回执、file.create路由合同、createEntry当前展开/清缓存/选择/required刷新/文件post-open。已读私有capturePathMutationFocus与rename/单Move/单Copy调用、Dialog的dialogOpeningFocusTarget菜单/调用者解析和动态returnFocusTarget、共享app-dialog选项透传；07-panel关于新建入口/文件编辑器与当前焦点公开合同，b23/b26明确未验的新建边界。全仓搜索createEntry/capturePathMutationFocus/returnFocusTarget/copyFileItem，未发现第二新建或焦点实现。原服务数据checker与纯路径检查不当作UI（User Interface，用户界面）自动化或真实网页验收。

## 根因、影响与方案

候选现象是新建文件夹成功后当前目录选择已指向新目录，但键盘可能仍回工具栏/父目录或BODY，尚待实际页面确认。直接路径为New folder命名→原File.create→setExpandedPaths/clearDirectoryCaches/setSingleSelection→required列表刷新；目录不会像新文件一样进入编辑器。现createEntry没有操作焦点owner，默认Dialog返回菜单调用者；清除parent缓存还可能卸载原调用行。b26只单Copy接入，不自动扩展未验证的新建路径。

控制/数据权属：新目录身份只能来自真实FileNode.path和当前成功refresh receipt（刷新回执），不能预测名字、留陈旧缓存、加timer（定时器）或第二选择状态。现capturePathMutationFocus已经拥有scope（作用域）/查询/active（活动面板）/可见性/用户新焦点/动态Dialog返回与虚拟行注册保护，可在已证实现象后复用。文件创建另有真实editor admission（编辑器进入许可）/post-open结果；不能把文件焦点拉回列表。目录与文件在同一函数，但输出体验不同，应仅目录创建取得/使用该owner，文件流程保持。

影响审计覆盖所有三个生产入口，原create请求、错误响应、Node/刷新/选择与私有helper调用；不改变公共函数/路由/配置、服务/后端、schema（结构）或持久数据。无Task/Mission/Session occurrence（执行轮次）队列/恢复/并发/终态异常证据，此为局部界面焦点候选，不改变运行机制。相关测试采用现纯路径正向checker辅助，禁止新增/运行UI自动化；文档同步07-panel、记录和三个索引，提交/推送保持原工作区。风险为命名取消/冲突抢焦点、搜索目录不可见、菜单调用者变化、文件创建进入编辑器时被回抢。分别用实际正向页面行为验证，未知时序明确保留。

先本人隔离基线实际体验工具栏/目录上下文New folder，截图与只读activeElement/当前selection并结合真实方向键确认；若证伪仅调查记录。证实后先补实证定稿，产品仅createEntry在type===directory时捕获现helper、原Dialog传动态返回者、真实refresh成功后在有效runMutation所有权内restore(node.path...)。不改helper、不抽象公共策略、不碰批量/删除/拖放。新建文件不取得目录焦点owner，保留原编辑器流程。

## 实际验收计划

Temp opencorvus-iteration-20261109-b27，fresh profile-before/after与自有Git项目、私有Git配置；dev38972/38973 /ui，隐藏独立页面，不触碰用户窗口/进程/凭据。普通源notes.txt、dest/other.txt与Unicode子目录；新目录为空是正常真实创建，不造占位文件来让它可见。基线与改后截图本人呈现查看，改后同目录/子目录的目录焦点和原生方向键继续、中文、取消/目标已存在错误、搜索中目录不可见时原搜索框、普通新建文件进入编辑器并保存。背景入口若未单独体验明确列为未验，不能借共用函数冒称全矩阵通过。

公开File.list及物理目录/普通原文字节回读，类型/双语/正常UI build/renderer和docs:check/architecture-index作为辅助，不能替代截图。53项纯路径检查仅在需要时运行，不重复已无新变化的检查。正常关闭本人页面和HTTP shutdown/原session退出，原177状态和共享README仅本条，范围提交/上游普通合并/完整待推审查/正常push后继续单人下一批。空目录全局搜索和持久portable（便携）路径升级仍是原开放项，不混入本焦点范围。

## 基线实证与实施定稿

本人38972/IAB57，工具栏New→New folder→new-folder成功，目标data-selected=true但真实焦点为New按钮；01人工截图。未重新聚焦直接原生Down，02截图和AX（Accessibility，无障碍）观察证明重新展开New菜单并聚焦New file，不是继续目录浏览。目录dest上下文Shift+F10→New folder→child-folder成功，03截图目标子目录选中，实际焦点却返回原dest父行；与源行卸载猜测不同，本次父行确实保留，不能记为BODY。两入口都未对成功目录结果进行目标焦点交还，默认Dialog按旧调用者返回。

before-directories.json公开GET /file父目录均200，原File.ListingNode的type=directory/directoryTarget=true与物理目录一致，两个新目录内容为空。本问题是目标选择与键盘位置的体验分离，不是目录创建失败、丢失或后端文件搜索回归。New文件已有post-open职责，只目录需要行焦点。截图01–03均本人呈现查看；页面57关闭、服务session93623正常HTTP shutdown/原session退出0。

按原方案仅目录分支捕获现capturePathMutationFocus，原Dialog透传该返回者；在同一已确认创建/required刷新且ownsOperation有效处调用focus.restore(node.path, outcome.refresh, ownsOperation)。文件分支focus为undefined，继续原openFileEditor/postOpen结果；不复制helper、不加timer、不改共享Dialog或原数据。公共07-panel同步目录创建这一参与者和文件编辑器边界。

## 验收与交付

overlay typecheck、双语2923键、正常build53.27秒/renderer public surface通过；本人最终页面加载main-Cwz56vdl.js。docs:check 352操作/26组、architecture-index 20文档及diff检查通过。本批只UI接入三行，现helper/路径/服务/后端没有改变，未重复b26已经通过的53项纯路径检查，也没有新增/运行UI自动化。验证以本人真实交互和具体输出为准。

本人38973/IAB58的最终构建：04工具栏创建new-folder后真实BUTTON焦点及选择均为新行；原生Right/End/Return正常打开notes.txt，05截图显示完整原文。06搜索notes时实际创建search-folder，目录不属于文件搜索投影，原搜索INPUT获焦且value保留notes。07中文目录dest上下文创建资料目录，提示/控件中文、原回执路径保留，目标真实行焦点；未重聚焦直接Down/Return打开同目录other.txt，08截图显示原正文和dest/other.txt身份。

09取消目录命名回到dest父行；10已有资料目录返回实际HTTP POST409/FileConflictError，Request ID 6eadda31-da64-414d-b578-f54fd5c842c3，先观察调用父行焦点再展开原错误Details。11原dest上下文新建编辑.txt仍自然进入contenteditable=true/aria-label=编辑.txt的DIV；没有locator重聚焦，直接typeText(null,正文)输入，实际保存后截图显示两行中文正文和正常保存状态。这证明文件post-open边界保持，不用类型检查代替体验。

after-directories-and-bytes.json公开GET /file逐一200、type=directory/directoryTarget=true与物理空目录一致：new-folder、search-folder、dest/资料目录。公开文件及物理UTF-8逐字一致：原notes.txt35字节/CRLF、原dest/other.txt19字节/LF、新dest/编辑.txt28字节/LF；没有以摘要/校验和作门槛。11张截图全部实际呈现、本人查看；IAB58关闭、正常HTTP shutdown200，原session38800退出0，未动用户进程。

范围为目录创建取得现操作焦点owner，原文件创建编辑器分支保持。背景上下文入口未单独体验，不能称三入口矩阵全部通过；100项虚拟/慢网期间scope-query-用户新焦点竞争、创建后编辑器进入失败/脏稿全矩阵本批未验。空目录全局搜索缺口与持久portable路径升级保持开放；未获Sol授权，模型端到端未达成，零模型/凭据。保留原177工作区状态、只纳入三个README本条与当前源/spec/artifact，范围提交、上游普通合并、完整待推集合审查及正常push后继续单人下一批。
