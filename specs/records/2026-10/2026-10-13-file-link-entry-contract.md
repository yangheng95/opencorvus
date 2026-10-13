# 文件链接条目与操作回执

## Recall

用户要求持续批次并行体验 UI（User Interface，用户界面）、调查功能与缺陷；先完成根因和影响分析并落盘 specs，再实施真实桌面交互、截图人工复核、聚焦正向功能测试、必要的已授权 GPT-6.1 Sol 流式端到端验收，范围提交、同步上游、正常推送并继续。没有停止请求。上一批 Explorer 操作结果与刷新回执提交 `66b470b3cda1ab8ced77204dacf68adfb434014b` 已正常推送；61项聚焦服务测试214断言、16张实页截图与同一物理项目15请求/10文件字节验收通过。其后态900秒截止 exit1 原样保留，不改称普通退出；独立 post 只读验收实例普通 shutdown200、Host/Target/output/request/parent join均0。

开始 git status 已检查。其它 owner 的共享索引、compaction-stress规格及 packages/opencorvus/bun 未跟踪内容保留。当前分支原地工作；不创建额外 branch（分支）或 worktree（工作树），不回退外部改动，不混入暂存。上一批共享索引仅本人的旧入口定位若有未提交残余须精确归位；不调整其它条目顺序。上一批 pending Git 文案是阶段快照，本批 Recall 记录实际推送事实。

一层限定并行、禁止再次委托：file_alias_contracts 完成 File API（Application Programming Interface，应用程序接口）入口、元数据、权限与真实 fs primitive 调查；functional_audit 独立审计 Overlay 全部 Node 消费者及编辑目标；file_alias_audit 继续 Native Host 外输出异常横审，本轮尚未授权其启动进程。主 agent 阅读上一 Recall/最终记录、14项真实 TCP（Transmission Control Protocol，传输控制协议）链接调查、File/index准入/列表/内容/创建/复制/移动/删除/上传、相关HTTP路由、根保护与ignore坐标测试、file-workbench和07-panel当前架构。

全仓搜索 nodeForPath/assertFileMutationPaths/assertRelocatedSymlinkTargetsAllowed/stat/lstat/readlink/verbatimSymlinks、FileNode和全部Overlay消费者，确认File/index为唯一生产事实来源；SDK（Software Development Kit，软件开发工具包）保持二元type合同。全仓当前Node消费者只有FileExplorer与只读数量的TaskDirBar；工作台在真实成功API之后唯一commit编辑目标。搜索路径型结果固定file；本批不引入symlink枚举或target能力字段。检索到的相关测试均纯功能/真实HTTP，未运行UI自动化。

## 现象、直接触发、根因与旧路径

1. 上一调查实际相对文件/目录链接rename已经完成，inode与readlink保持，随后nodeForPath的followed stat因新位置目标missing返回404；retry旧位置再404。操作失败导致file-workbench不commit新path，原打开编辑器停留旧链接。移动后retarget为现存其它目标则followed stat掩盖条目与目标的区别。
2. list用Dirent.isDirectory描述entry，nodeForPath用stat.isDirectory描述target。健康Windows junction移动返回directory/ignored=true，下一list返回file/ignored=false；row key和reconcileDirectorySelection把它判为类型变化并退休选择。错误不是图标文案问题。
3. assertFileMutationPaths已有真实lstat及词法/物理根保护，后续move/copy/delete又followed stat并catch所有异常为undefined。已有broken entry因此404；未知I/O（Input/Output，输入输出）也被误报missing。assertExistingParent同类catch-all将未知错误误报400。内容read/write的followedstat是真实目标内容合同，不应替换。
4. copy使用dereference:false，但fs.cp默认将相对readlink改为绝对；validateCopiedTree严格原文字校验因此真实500并回收staging。仅删除校验会改变链接事实，不能作为修复。copy自目录保护及recursive也用了target stat，将独立terminal目录链接误作递归实体目录。
5. preflight要求realpath当前目标存在，broken link即使source/destination声明目标都在同一允许项目也被拒。general isPathAllowed对missing链接会沿存在父重建词法路径，不能替代对链接声明目标的显式权限检查。已有healthy外部目标或relocation escape400仍是当前正确边界。
6. 上一2a统一ignore坐标，66统一成员和刷新回执；都没有改变后端entry/target混用。禁止从物理磁盘猜造第二成功回执、保留旧followed分支或宿主旁路。

## 影响与明确范围

所有生产入口为create/move/copy/remove节点回执、list、HTTP路由、SDK二元Node、Explorer菜单/批次/拖放、行key/选择/anchor/展开/创建/上传/drop目标/self-dir guard/move刷新、工作台编辑准入与FileEditor真实内容读取。Node.type当前应统一为实体目录entry=directory，其它entry（包含terminal symlink/junction）=file；ignored目录hint由同一entry事实提供。保持现list导航边界：UI目录链接不新增展开能力，明确不宣称目录链接浏览已完成或Windows Git junction全部忽略语义对齐。直接GET具体允许链接目录仍沿现list合同。

终端链接与经ancestor link再进入根的不同操作语义保留；lstat实际host尾分隔符决定条目语义，不人为strip。普通实体目录copy递归/self-copy边界、无覆盖rename、严格staging/bytes/readlink校验、真实API错误/通知、项目隔离均保留。错误读取不猜成ignored=false。

copy/move遍历真实实体目录及每个终端链接，用readlink解析当前声明目标与原文字在最终destination的声明目标，分别经过现单一isPathAllowed；missing但in-scope可准入，declared外部精确FileInvalidPathError400。不require链接目标存在、不跟随terminal link遍历。Delete只删除entry，本批不增加新的target范围政策：general入口权限仍适用，已准入的broken entry用unlink，目标原身份不变。原general对healthy外部target拒绝保持。并发unlink、未知权限错误、POSIX不同尾斜线、多卷rename尚未实机覆盖，不能声称已消除所有publication后metadata异常。

移动已打开链接成功后原file-workbench commit新path，FileEditor按真实新path读取：悬空显示独立真实404并清除旧内容，retarget读真实新字节。成功Node不声称内容可读/可编辑；revision仍由真实内容API唯一决定。本批不加alias编辑器缓存或物理别名映射，不处理另一路径移动链接target的跟随能力。

该缺陷不是调度/队列/Task/Mission/Session occurrence（执行轮次）问题；串并行、多项目HTTP事实与旧调用owner边界须聚焦回归。独立Native输出异常必须继续共享机制横审，原失败分支仍未知，普通后续实例不能排除。上传active-search未refetch另记代码候选，尚无本批实页，不混入本修复。

## 权威与真实primitive证据

已查[Node.js fs.cp](https://nodejs.org/api/fs.html#fspromisescpsrc-dest-options)的verbatimSymlinks公开选项、[lstat](https://nodejs.org/api/fs.html#fspromiseslstatpath-options)链接自身合同及[symlink](https://nodejs.org/api/fs.html#fspromisessymlinktarget-path-type)Windows junction绝对目录语义。当前实际宿主Bun1.4.0经正常隔离runner实测：相对file/dir/broken file默认cp改为绝对、verbatim=true保全文字；整实体目录同含relative file+dir link与目标时新目标完整字节正确；绝对normal/broken junction两选项均原文字。真实renameNoReplace与unlink对broken file/junction成功，保原inode/readlink/目标marker。原10项cp与3项broken外部请求及日志在.tmp-codex-link-plan-01a133，不把primitive通过冒称完整HTTP/桌面验收。新回归将通过真实FileRoutes TCP检验生产路径。

## 实施与验收计划

1. 先启动本人全新独立Native Host/Windows Job服务，正式私有bin/ui、Bun1.4.0、PID（Process Identifier，进程标识符）/birth/occurrence事实、固定900秒截止、双输出drain（排空）和request cleanup。使用真实/ui桌面空Chat/Files，不请求模型或复制凭据，不注入消息或数据库。构建先完成，视觉运行与后续API checker分离，提前普通shutdown，保留所有失败。
2. 修前UI真实Open relative-file.md旧字节，再Move到根moved-relative.md：确认原操作404但原文字entry已移动、编辑目标仍旧path。截图人工查看反馈/编辑目标与原cause；同服务完整readlink/inode/文件内容API记录。普通shutdown且parent真实join后才授权修改生产源码，防止修前源码身份失真。
3. 单一私有Node projector接收真实entry目录事实及现ignore matcher；list使用Dirent，回执用精确lstat。assertFileMutationPaths返回原entry供copy/remove复用，move删重复followed stat。preflight以原readlink与source/destination声明目标校验；cp加入verbatimSymlinks:true；现严格checker保持。仅已知missing映射已公开错误，未知I/O原样throw。无新队列/缓存/owner/兼容层。
4. 更新触及旧terminal回执测试到当前entry合同；新增聚焦正向真实TCP测试覆盖relative file/dir/junction健康、broken、retarget、独立copy+整树copy、root-link entry与根marker、scope/parent坐标、精确400权限、200delete、完整entry/readlink/bytes/真实内容404或200、公开通知及跨项目并行。不得以不发生/不存在为核心断言；删除后以公开404错误合同及保留目标完整字节证明。未知I/O没有可确定真实条件时如实未覆盖，不能用mock冒称真实E2E。
5. 修后新实例真实junction移动目标保持选择、已打开relative link移动悬空的新path/独立read404/旧内容清空、retarget真实新字节、copy原文字、broken Rename/Delete成功。截图逐张呈现人工查看，现语言摘要/技术path和Details保持真实。没有模型交互所以本批无需GPT-6.1 Sol；若后续Native进程审计需要模型必须另行目标目录+凭据+请求模型分别资格，保持流式。
6. 独立源码review、聚焦功能/根保护/ignore坐标/文本写入回归、后端类型、必要SDK/文档检查、07-panel当前架构与根/月/artifact索引。私有Git index范围提交，fresh fetch+upstream merge、完整待推送集合资格检查、必要验证、正常push。仍有真实未覆盖项要交付明确，不包装全部完成，然后下一批。

## 当前阶段

分析和方案已落盘；尚未修改产品、运行本批真实修前/修后页面或新HTTP回归。两份独立只读调查已完成，Native外输出调查待补完整方案，不授权当前进程操作。下一步执行修前再限定实现。

## 真实修前与实施准入

准备时root `build`的参数只传到后续renderer检查，首次私有bin/ui缺失，launcher在启动任何进程前拒绝。原日志和exit1保留；改用正式build:vite实际入口，53.19秒exit0，私有main-D8HA6GqE.js绑定。初次build仍真实完成但输出到现默认ignored目录，不称私有验收；未操作其它已运行应用。docs:check348 ops/26 groups exit0。没有将工具失败降级成功。

新owned服务18447真实/ui，在原File/index源码下运行；公开coding/chat/session201创建真实右侧空Chat，actual侧栏选择/右dock/Files。fixture用本任务新物理项目与source links、原完整CRLF字节，无凭据或模型调用。实际Open link-cases/missing/relative-file.md显示MISSING MOVE OLD资料；真实菜单Move至moved-relative.md只提交一次。HTTP PATCH404原requestID `81f6dc4e-4508-4c15-bc03-3290b92eb0c5`，完整FileNotFoundError指向新path；反馈未确认完成，15秒真实列表已出现moved-relative.md。

3张截图均实际呈现人工查看：原编辑内容、Move404原Details、操作后File标签仍missing/relative-file.md且保旧文本。纯只读checker真实同entry inode/dev/readlink不变；旧source与新dangling内容各公开404精确错误、原target200/revision及完整字节，exit0。未重发mutation或以目录list猜第二成功。真实页面16已关闭；普通shutdown200，原Host/Target/物理证明/双输出/request cleanup fulfilled，父launcher真实join exit0，在截止前完成。根因已与文件系统、真实API和可见编辑器三方事实绑定，允许限定后端实现和聚焦功能测试。

## 最终实现与独立复核

唯一产品文件File/index.ts完成：sourceguard保原顺序与两个逻辑/实体物理根保护并返回准确lstat；move删除重复followed存在判断，copy/remove复用guard事实。私有nodeForEntry在Dirent/list与lstat/receipt共用相同entry目录事实及原matcher；回执knownmissing→当前path404，其它错误原样throw。preflight直接readlink解析两声明目标，in-scope missing允许、source/destination越界400；cp只加verbatimSymlinks:true并用entry决定recursive/self-directory保护，原严格tree/readlink/完整bytes checker、staging、noReplace和清理全部保留。parent只把knownmissing映射原400，未知错误传播；内容read/write和upload/search未改。

独立file_alias_audit只读逐处核对最终root/terminal/ancestor、Node/ignored、权限、strict复制、delete原策略与file-workbench成功协调，没有阻塞发现。复核没有运行测试、修改文件或启动进程；不能冒称其独立执行端到端。未知I/O、外部并发替换、POSIX尾斜线、跨卷及其它metadata发布后故障仍待真实覆盖，原规则目录EISDIR500保持原错误，不猜成成功或ignored=false。

## 聚焦功能和工具检查

正常Bun1.4隔离runner共92项正向测试847断言exit0：新link20/245、原root18/294、原ignore13/79，文本准入26/150、Git别名8/57、附件7/22。前3文件51/618由独立functional_audit执行，真实物理runner67.39/122.06/32.02秒；后三文件41/229由主agent执行，73.42/56.14/30.73秒，不重跑已过用例。新文件原日志含99次生产FileRoutes TCP请求，69×200、7×400、21×404、2×409，共21个实际API Project身份；真实lstat inode/dev、readlink、完整目标字节、content/revision、Bus原durable通知和两项目并行规则均正向核对。minimal harness成功响应无request-ID header，不造ID；真实错误ID原样保留。测试不能代替桌面或完整CLI服务。

两个旧terminal回执按当前file/ignored entry-hint更新；新及两旧测试HTTP helper额外类型检查暴露原Promise<Response|Promise<Response>>→TS2322/exit2，精确async handler展开原请求路径后同额外类型0。原TS2322与日志保留；未改产品配置或放宽断言。三测试格式首轮1，新增长日志行按本地Prettier最小格式修复后同check0；不重新跑无语义变动的测试。后端产品typecheck0、限定diff0。整File/index格式check1为5个既有hunk（7处），实际HEAD与现源格式diff逐hunk原lines完全一致，既有status/content/strictchecker未扩清理；原失败及对照保留，不能写整文件format已通过。

## 真实修后与字节收敛

全新18448 Native Host70872/Target86576及各原birth/occurrence，原正式私有main-D8HA6GqE.js与修后源File/index服务绑定；同样实际空Chat/Files，不注入消息、数据库、Provider凭据或模型。11张后态截图逐张实际呈现人工查看，1280×720桌面。原schema/SDK字段保持，当前前端路径和owner自然消费真实回执；其它owner正在改动的源码和未验证UI不混入此bundle资格。

图01 Open relative link为MISSING MOVE OLD资料；真实Move至moved-relative.md自动进入原File标签，新标题已更新，旧内容清空，图02独立GET/content404原ID `5b681175-c451-4f0d-a1fa-372a93659193`及完整错误；这是真实目标不可读，不能称Move失败。回到Files图03目标行实际选中。具体资格：已打开资源的成功commit切换File标签并卸载Explorer，所以返回Files没有保留当次Move反馈横幅；不能将图03命名或解释为可见成功横幅。其entry200由生产功能与物理事实证明，新编辑path/真实read错误由实页证明；反馈跨工具标签保留是后续共享owner调查候选。

健康junction真实菜单Move至moved-junction，图04绿色成功提示；图05滚到真实目标行，required列表重读后该file entry仍选中，未因target-directory回执翻转退选。原/新metadata与directory-only忽略规则均file/ignored=false，原target marker完整。Open retarget原链接显示RETARGET OLD资料（图06），移动至moved-retarget.md后实际内容为根中RETARGET NEW资料（图07）；首次AX仍Loading而同截图已NEW，后续Ready AX另存，没有把Loading当读取已确认。

真实Copy相对copy-file.md至根copied-file.md图08绿色完成、新行选中、原源行保留。原readlink文字copy-target.md精确保留；新根内容missing允许为独立404，不将link200冒称内容可读。broken-file.md真实Rename为renamed-broken.md图09绿色完成；删除前checker同inode/dev/readlink正确0。图10当前中文重命名提示且技术名称保持；实际菜单/确认一次删除该本人可丢弃条目，图11中文已删除。目标本来missing，没有伪称target恢复；其余所有原targets完整保留。

同一原物理项目纯只读checker13次实际请求（8×200、5×404），5个原文件完整CRLF bytes/API content/revision、3个移动link的原inode/dev/readlink、copy原文字、三目标Node与ignoreflag、retarget NEW和junction marker全部核对exit0。旧source/newdangling/copiedmissing/删除前后broken paths各精确FileNotFoundError公开内容合同；没有mutation重放、hash或摘要验收。前后共14张截图已呈现并人工查看。

后态页面17已关；2026-10-13T12:23:29.459Z普通shutdown200、Host/Targetterminal reason=exited/exit0、生产physical/output/request结算fulfilled，两个parent输出drain及真实parent join0，早于固定截止1791894608954。本批前后均正常物理收尾，不挪用上批deadline1或未知sink失败。

## 交付阶段与下一批

原HTTP/条目/全字节、原native事实、14图、独立review、正常runner和类型/格式首败均已归档到本批artifact。日志与实际脚本按原bytes gzip保存，避免日志空白成为无效diff门槛；未trim或改写失败。当前正在完成docs/architecture检查、私有index范围提交、上游同步和正常push；此段为提交前快照，下一Recall须记录实际Git事实。

下一候选：成功移动已打开资源后Explorer结果跨标签卸载保留；upload active-search不重查；Native外真实stdoutreader关闭的共享横审。前二者分别有本批实页或代码证据，不能混称都已复现。Native第一轮正常尾部输出vs仅关闭本人Host.stdout reader需另落盘并限定授权；现公开Facade settled不能冒名独立raw Supervisor settled，透明观察应返回原Promise/同handle，全部Task/Mission/Session正常终态/重试恢复/多项目矩阵仍未完成，不因本批两个正常退出排除旧共享根因。
