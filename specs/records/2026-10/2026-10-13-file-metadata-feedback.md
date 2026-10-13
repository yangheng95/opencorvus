# 文件忽略规则坐标与操作提示事实

## Recall

用户要求持续按批次并行体验 UI（User Interface，用户界面）和调查功能缺口；分析落盘后实施，真实桌面交互、截图人工复核、聚焦正向功能测试、必要的已授权 GPT-6.1 Sol 流式验收，范围提交、同步上游和正常推送，再继续。没有停止请求。上一批 `a0c45a9af584c5c6a0df7d54b342e0a6b77c7fdc` 已正常推送，当前 main/upstream `43a596c26` 包含该提交；上一规格末尾待提交文字是历史阶段快照。

已重读上一批 Recall、实际工作树回执失败、语言切换截图与运行收尾边界。当前其它任务的 package.json、bun.lock、Kobalte 补丁、权限消息测试及383/385/386记录和共享索引调整均保留，不属于本批。不得创建分支/工作树，新增或运行任何 UI 自动化测试，操作用户进程，或制造会话消息。本批文件能力由正常 HTTP（Hypertext Transfer Protocol，超文本传输协议）接口与桌面用户动作完整覆盖，无需 Provider 请求，不移交凭据或模型目录。

一层限定只读委托 file_alias_contracts 调查 File.nodeForPath/list 规则坐标和链接身份；functional_audit 调查 Explorer 各提示生命周期和语言投影；均禁止再次委托。主 agent 已读 File/index.ts、全部 nodeForPath/isIgnored/ignore 调用、FileRoutes、07-panel、FileExplorerPanel、file-workbench、ApiError、i18n、Feedback、formatErrorDetails，以及先前隔离 Native Host 的完整启动/正常 shutdown 工具。全仓确认 File.list 还有 debug CLI 入口，create/move/copy 只有真实文件路由消费 Node 回执；FileIgnore watcher 的 glob（路径模式）策略是另一公共语义，不能替代 Git 忽略规则。没有 UI 自动化测试进入本次验收。

## 现象、控制流根因与旧路径

1. 当 Instance.directory 是子项目目录、Instance.worktree 是合法父 Git 根时，create/copy/move 到 `../*.md` 完成物理发布后，nodeForPath 把 directory 相对路径交给加载 worktree 根 `.gitignore/.ignore` 的 ignore 库；该库拒绝越出其规则根的 `..`，实际 API（Application Programming Interface，应用程序接口）500 UnknownError，真实文件却已写入。File.list 使用同一错误坐标和独立规则加载副本，父目录列举也500；即使路径不含 `..`，子项目路径丢失 worktree 前缀也会产生错误 ignored 元数据。自原始基线两处实现存在，根源是把公开显示身份和规则坐标混为一谈，不是凭据、模型或文件发布失败。上一批仅修根源准入，未修改此独立元数据链。

2. Explorer 在动作发生时调用 t/tc（当前语言翻译/数量翻译），保存 mutationMessage/uploadMessage 和另一 status 字符串。i18n 已通过 localeSeq 在渲染时响应语言变化，但保存的字符串不再调用它，因此旧成功、校验和失败提示冻结。错误还被压为 Error.message，丢失真实 ApiError 的 status、body、requestID 和方法。上传已提交但刷新失败是明确独立事实，不能描述为普通上传失败。已有 ImagePreview typed key、FileEditorPane 原 cause 和 Feedback 可复用，无需语言监听或新的通知缓存。

## 影响、公开合同与边界

File Node.path/absolute 继续是当前项目的真实目录相对/绝对身份，不能为了规则匹配重写显示路径；权限仍只认可现有 directory/worktree，根源保护、no-replace 发布、文本修订、Git 基线和上传 publication 不改。单一规则加载器必须合并现有 `.gitignore` 与 `.ignore` 顺序，列表每批只加载一次，回执复用同一 matcher；缺失规则与读取故障须区分，不能把未知读取错误吞为忽略=false。非 Git 项目保留 false 合同。

链接坐标仍需实际矩阵收敛：worktree 内的逻辑 entry 必须保留 Git entry 名字，不能对终端链接 fullPath 做 realpath 后改成目标身份；当 scope/祖先链接使词法路径在根外但实体准入合法时，需要明确规则根映射。仅 `path.relative(worktree, fullPath)` 还会给 ignore 传非法 `..`。此选择在真实链接事实和权威资料明确前不实施后端，不新增隐式 fallback（后备路径）或平行配置。

Explorer 覆盖 create-file/create-directory/rename/copy/move/delete/refresh 的 success、当前明确 validation reason、请求 cause，以及 upload pending/success/failure/reload-failure。mutation 与 upload 仍各自拥有 scope/token，切语言只重投影，不重复请求或清空动作；数量用现有当前语言格式化。按 ApiError.body.name 和稳定 data.path/name/targetDir 投影本地化摘要，不根据英文消息猜根目录、权限或其它子原因；原错误完整放已有 Details（详情）。loading/empty/retry 已渲染翻译；目录和 search 的原 cause 也应由原 owner 保留，而非另建诊断缓存。共享 AppDialog 当前全仓36个string协议调用的打开时语言快照是另一个未验范围，本批不由 Explorer effect 重写。

本批没有 Task/Mission/Session occurrence（执行轮次）的调度、队列、恢复异常新证据。上一批原 Host AggregateError 的具体分支仍未知，受控外部输出 sink（接收端）断开矩阵另列待调查；不把其正常后续运行当作原失败根因排除。

## 实施和验收方案

1. 前态：本人全新隔离父 Git 根与 scoped-project，通过合法 `.git` pointer/core.worktree 获得真实不同 directory/worktree；正式私有 bin/ui 与 Bun1.4、当前源码 CLI serve 共置，实际 `/ui` 绑定资源入口。Native Host/Windows Job 明确发生实例、输出 drain、请求清理与900秒上限，普通 shutdown 结束。不启动独立前端服务器。实际桌面 Copy/Move 到父根、当前语言提示冻结，保存原 HTTP/磁盘事实与截图逐张查看。
2. 后端完成链接矩阵分析后补充精确方案，再授权 file_alias_contracts 实施单一 matcher 和真实 TCP（Transmission Control Protocol，传输控制协议）正向 API 合同。正常/父根/子根/链接/点段、`.gitignore/.ignore`、多项目独立规则、create/copy/move/list 的 ignored 明确正确值与字节回执必须一致。测试不以旧路径“不调用/不存在”为核心断言。
3. 前态截图后授权 functional_audit 实施 Explorer 原事实状态，删除旧 message/status 双源，渲染时用当前 t/tc、稳定错误类型摘要和完整 Details。保留 scope/authority/selectionEpoch、上传已提交和重读失败区别、部分成功回执与原错误。无需 UI 单元测试；类型、纯数据/服务合同与真实页面交互验证。
4. 后态私有正式 UI 重建，真实桌面英语/中文重复成功和失败提示，切语言立即变化，展开 Details 检查长诊断与滚动、列表/按钮布局；父根操作真实成功回执及正确物理内容，实际文件编辑路径身份保持。截图人工复核后再结论。记录未验的共享弹窗 locale、POSIX（Portable Operating System Interface，可移植操作系统接口）运行和强制 I/O（Input/Output，输入输出）故障，不包装为已完成。
5. 聚焦真实功能测试、两个 package 类型检查、正式 UI 构建、当前 docs:check/architecture-index；独立源码复核，当前架构与根/月/artifact 索引同步。范围清晰的私有 Git index 提交保留别人暂存；fresh fetch/merge，审阅全部 upstream..HEAD，必要验证，正常 push 后自主下一批。

## 当前进度

根因和影响分析、限定实现、独立源码复核、真实前后桌面、聚焦功能与同一生产服务字节/API验收已完成。范围提交、上游同步和正常推送正在收尾；持续目标保持active，未要求停止。

## 真实前态与坐标决策收敛

本人18441开发服务实际 `/ui` 绑定上一批最终私有 main-D5xckEg5.js，本批目标组件此前无其它源码差异。新父Git根的scoped-project有真实.git pointer/core.worktree；正常接口创建空Chat、实际侧栏选中，没有消息或模型。桌面1280×720 Copy note.md到note-copy.md成功后切中文，图01仍为英文Copied to；图02真实复制到已存在conflict.md，长英文409路由和错误占据顶部；图03 Copy到../parent-copy.md真实显示500。四个完整文件字节证明源/普通副本/父根副本正确，冲突目标保持EXISTING CONFLICT CRLF；正确query的父目录listing500，requestID为4450bdee-4cd3-4b1c-b23c-ef17de9bdb80。三张截图已逐张人工查看。当前语言产品摘要与完整技术详情需分工，不翻译路径或诊断事实。

运行器第一次因外部evidence/before目录未创建，在process.Start之前写inputs.stage失败，未创建Host/Target；保留原错误并修复本人launcher创建该目录，使用全新before02发生实例。第一条手写探针因PowerShell `-join` 优先级将两个query合成错误directory，真实400 ProjectDirectoryIntegrityError保留在probe-malformed-query.json，不把它称父目录500；更正明确query后实际500落physical-and-parent-list.json。工具错误已修复并重跑原探针。before02页面已关闭，普通shutdown200、原Host/Target退出0、输出drain、request cleanup及父launcher joined0完整。

委托真实矩阵证明：普通逻辑worktree内alias-child必须按原entry名匹配；back-link从内部指向父再入同worktree时，原API200且ignored=true，若一律canonical父路径或连续物理锚点则折成sub/note、错误false。因此确定单一坐标准入算法：完整条目词法位于Instance.worktree时，直接使用该根的词法relative，保留所有内部链接suffix；只有词法在该域外而既有实体权限准入合法时，才映射目录的最外层连续physical-worktree内祖先锚点，拼其规则根offset与原entry suffix。不对终端链接realpath，不通过异常catch返回false。列表按resolved目录计算一次锚点及规则matcher；回执使用同一规则加载/匹配实现。

`Instance.refreshedContext/applyContext` 的worktree来自 `Project.fromDirectory` 的sandbox（实际Git show-toplevel），不是project.worktree（共有主仓库）；因此链接工作树的规则归属仍是当前checkout，不添加另一个Git发现或root状态。完整外部scope坐标的准入边界继续由独立复核确认后实施。

当前Windows另有独立分类事实：terminal junction的move回执使用stat得到directory，list的Dirent给file，使directory-only规则结果不同；本批保持现公开Node类型产生方式，单一matcher沿调用给的directory hint，不借规则坐标修复暗改目录分类。该类型投影问题须后续独立根因分析。Git和普通POSIX symlink说明不能代替Windows junction实机事实。

已查阅[ignore维护者的路径合同](https://github.com/kaelzhang/node-ignore#1-pathname-should-be-a-pathrelatived-pathname)和[Git官方忽略规则](https://git-scm.com/docs/gitignore)：规则坐标相对规则文件目录，ignore不负责发现规则；本批保留原根级.gitignore/.ignore组合，不宣称实现全部嵌套Git配置语义。前端限定 typed 事实实施已授权；英语catalog真实为en-US.json，保留其它owner的provider.form.api_invalid修改。

## 后端实施前的最终域合同

完整真实调查进一步证实，用户显式配置 `.git` pointer/core.worktree 到另一合法Git根时，directory实体确可位于规则worktree外；当前File权限两根允许这类文件。旧listing把规则根`/report.md`错误套在另一directory的report.md，ignored=true；再访问真实worktree时500。不能宣称Project发现排除了此输入。

当前ignored是该唯一worktree根级规则的适用结果：词法域外、物理父链也没有规则根锚点的合法directory entry，明确坐标为“不适用”，ignored=false；不能换读directory规则、复制配置、异常catch降级或把它拒为无权限。物理和规则读取的未知异常仍传播，不因false合同吞错。字符串坐标与不适用结果由同一确定domain函数产生，后者是合法对象的规则域判定。对真实worktree实体的访问仍返回准确relative/ignored值，公开Node身份不改变。实机 linked-worktree 也确认当前Instance.worktree为该checkout，project.worktree为共有仓库，独立规则不混用。

实施限定File/index.ts及新的真实File API聚焦测试；先记录新测试旧态明确失败，再修改。复用现有path/isWithin/realpath/NamedError和成熟runner，不抽象不相关Git读基线或watcher。列表matcher及锚点不新增跨请求缓存，保持实时规则更新和多项目隔离。终端junction类型差异独立待修，nested.gitignore语义和File.read对显式域外条目的Git比较未在本批更改。

独立file_alias_audit已核对outside的真实TCP输入、自然Instance发现与物理两根权限，确认上述域合同；指出architecture应精确表述为既没有logical坐标也没有continuous physical-parent映射，而非笼统physical-outside，以保持内部outward/back-link的优先逻辑语义。规则offset空串是有效root锚点，不能判空为无域；完整entry坐标空串则是规则根容器自身，ignored=false，不送ignore空输入。主方案和架构同步该精度，新增正向root-container合同。

## 实施验证进度与独立复核

前端四文件事实状态实施完成，类型检查exit0，55项纯服务测试194断言通过（file-workbench-mutation 27/87、api-error 28/107）；CSS token checker及限定diff check通过。正式私有UI构建exit0，耗时1m10s；这些不代替实页视觉，后态仍待执行。旧upload_error单组件键替换为稳定摘要，upload_reload_error数量文案保留已提交事实；其它owner的Provider语言调整原样保留。原检查输出持久化位置正在补核，不以口述成绩代替原日志。

独立源码复核确认t/tc/localeTag从渲染getter调用、响应localeSeq，upload pending只来自原操作owner，权限/scope/selectionEpoch与加载token结构保留；NamedError schema稳定字段匹配，原ApiError可进入Details。局部有界滚动仍需实图。继承的批量双失败边界明确未修：成员E1失败后finally的required刷新E2再失败会覆盖E1，本批typed cause保留最终抛出的E2，不能宣称两错均保留。该场景须下一批单独复现并完成根因修复，不把原cause表述扩成完整双失败合同。

首次后端12项旧态4pass/8fail、47断言，正常runner exit1，8项均为真实错域；首版single matcher 12pass/76断言、exit0。独立复核进一步发现root-container交叉遗漏：scope本身为worktree junction时，列其物理父根，factory只按parent选物理锚点，会把完整entry==worktree根容器变成junction.basename，被同名规则误忽略。须按原方案在coordinateFor逐完整entry优先判logical root，empty neutral；新增13th真实TCP正向链接容器案例，使用不带尾斜线的/checkout-alias以避免Windows Dirent file hint掩盖错误。先复现再修，原12pass不能作为该交叉排除证据。

已启动的本人after发生实例尚未打开页面或做验收，因最终源码需修该交叉已普通shutdown，原Host/Target与输出/请求收尾正常；最终实页改用全新after02实例，不重启或操作任何用户进程。UI代码没有变化，私有正式bundle无需重复构建。最终Overlay类型单独捕获exit0（原委托最终组合shell没独立捕获类型exit，这次补足资格而非例行重复）；委托原55测试输出已如实转录并标注tool-output来源，没有伪造原stdout文件。

## 最终实现与验收

File/index.ts最终45+/24-，createIgnoreMatcher是listing与create/copy/move回执唯一根级规则加载器，保留原.gitignore然后.ignore的顺序；仅ENOENT表示该根下规则不存在，ENOTDIR/EISDIR/EACCES及未知realpath错误均继续传播。按Filesystem.contains判域，原path.relative/join构造坐标，normalizeWindowsPath只移除Windows namespace（命名空间）语法而不改文件名case/空白。完整entry先匹配逻辑worktree域，空坐标为根容器false；其余使用列表一次计算的连续实体祖先offset或明确不适用null。公开Node.name/path/absolute/type、权限和发布过程不变，无跨请求缓存或目录规则替代。首次计划提到isMissingPathError的通用ENOENT/ENOTDIR分组，在实际规则文件读取处已收紧为ENOENT，不能以坏根或I/O故障伪称缺失。

最终13项真实TCP合同79断言、exit0，含自然junction根容器、internal back-link、terminal entry、不同当前checkout、独立多项目并行与实时规则更新、正常和父worktree三动作、完整Unicode/CRLF字节及真实EISDIR的公开500错误。最终同一源码18项根保护294断言、8项Git读取57断言均正常runner exit0；合计39项430断言。后端类型、测试Prettier和限定diff check均exit0。与前端55项194断言合计94项624断言；没有UI自动化测试。

最终18442本人after02生产服务实际/ui私有入口main-CbXGaPPU.js，真实空Chat/侧栏选中/Files流程；没有模型请求或合成消息。英语Copy note.md成功后切中文，图01立即“已复制到note-copy.md”。真实复制到conflict.md的409显示中文“目标已存在”，图02展开完整HTTP方法/status/path、requestID、stack与body；实际滚动到诊断最后大括号见图03，列表仍可见。切英语图04同一冲突立即本地化，原requestID c8b77452-e726-4b0f-a421-2b0c66ea802f和诊断保持。图05真实Copy到../parent-copy.md成功；打开move.md后真实Move到../parent-move.md，现行file-workbench将原编辑目标自然移到新路径，图06显示SCOPED MOVE及正确工具栏。通过正常文件选择器上传本人新建upload-proof.txt，英语单数Uploaded 1 file切中文后图07“已上传1个文件到.”，实际文件行存在。七张最终截图与三张前态均逐张人工查看，桌面1280×720，无多端扩展或图像修改。

同一18442服务checker真实create ../parent-created.md、list当前/父目录和8文件content共11请求，全部200；child-ignore.txt准确true，parent-copy.md准确true，普通/移动/新建条目false。8个完整明确字节含CRLF均与真实物理文件和生产read正文一致，编辑修订存在，见after/actual-files-and-api.json。不是mock/stub或仅夹具端到端。after02普通shutdown200、原Host/Target exit0、两个输出drain、request cleanup与父launcher joined0全部完成；端口释放。

额外18443本人failure发生实例补看目录反馈布局：正常加载nested-check后将其本人目录按明确绝对路径移到同一scope的nested-retired，实际展开旧行产生目录读取失败，图01显示明确路径、Details、Retry和行尾Error。按原路径恢复后，已有15秒刷新真实恢复marker.txt（图02）；没有把该自动恢复称作手动Retry。根规则.ignore处实际新建目录，正常菜单Refresh触发真实EISDIR：图03同时看到独立刷新、嵌套目录与根读取失败owner；图04根Details实际完整HTTP500及原诊断，有界布局正常。移走该本人故障目录后，尝试旧数字Retry索引遇“No node with given id found”，因为真实周期恢复已退休该按钮；未计为Retry点击通过，图05记录实际自动恢复及上一动作的历史失败提示。改用最新页面的正常背景菜单再次Refresh，图06“Explorer refreshed”且marker成员正确；真实目录与content请求200、物理完整NESTED RETRY EXACT CRLF正确。此工具时序失败如实保留，后续操作必须在外部实体变化后再取当前页面状态。原failure页面已关闭，普通shutdown/物理退出/输出和请求收尾/父join全部exit0。

本批明确修复坐标RangeError与语言/诊断投影，没有把publication之后所有I/O失败原子化。未实机覆盖POSIX、EACCES/设备故障、上传pending/reload-failed和搜索失败的全部视觉分支、共享打开弹窗语言快照、批量E1/E2双失败合并，以及terminal junction类型统一；这些边界继续调查，不能扩称本批已修。当前目录与根失败的真实布局、正常复制/移动/上传、双语转换及原诊断滚动均有截图证据。
