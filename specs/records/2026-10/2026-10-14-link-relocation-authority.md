# 相对链接迁移的实体范围与未来树

## Recall

用户要求持续迭代当前版本：分批调查界面体验与功能，先根因/影响和spec（规格）落盘，再有证据实现、真实开发页面桌面交互/截图人工复核、聚焦正向功能测试、必要的已授权GPT-6.1 Sol流式验收，范围提交、最新upstream（上游）合并和正常push（推送）后下一批。用户最新明确“停止所有子agent，你自己验收”，已全部停止；本批由Root单独工作，不再委托。持续目标没有停止，不创建branch/worktree，不碰用户进程/窗口，不新增或运行UI自动化测试。

上一批是实质进展：9a8c1a856修复Move（移动）退休源entry（目录项）依赖，46926caf7将11张截图存为可直接查看的原JPEG；最终link30/334断言及真实页面5次Move、20个脚本HTTP（Hypertext Transfer Protocol，超文本传输协议）请求、原Native完整收尾通过。首次push全部hooks（钩子）0而并发ref拒绝1；fresh fetch/merge/完整集合核验后重试push0。2026-10-13T21:26:02.4266950Z最新HEAD=origin/main=74ff844f，两个own commit均ancestor0、own scope clean、real index空。原回执在本批artifact承接，不用最终0覆盖原1。并发阅读提交曾带回旧展示树，a71a3ee恢复；Root核469..最终own产品/测试/spec/artifact净差异为空、621原件与Git逐字节相同。此字节检查只证明固定原件完整性，不替功能验收。

本批开始git status保留他人的compaction、Provider错误诊断、相关测试及三个共享README改动；当前main继续被其它已授权任务推进。只改本批范围，真实index不整体重置，提交时用最新HEAD的精确owned差异。已重新读AGENTS（含持久格式自动迁移原则）、目录target原Recall/冻结合同/原始Windows证据、relocation-implementation-plan/positive-contracts与state-and-futuretree-amendment。已读File canonicalPath/isPathAllowed、Move/Copy/Delete前置、唯一shared relocation遍历、Native renameNoReplace、Copy cp/staging/strict checker，以及file-entry原NOFOLLOW（不跟随终端链接）地址/tag读取、07-panel公开entry/target合同。

全仓搜索结果：assertRelocatedSymlinkTargetsAllowed定义仅File.index，生产caller仅Move/Copy；FileRoutes是其公开mutation（文件变更）入口。没有成熟future-tree（未来树）解析器。isPathAllowed仍是当前directory/worktree两root的唯一membership（范围归属）来源，canonicalPath会先path.resolve，再真实realpath或最近存在父目录。Copy唯一实现是fs.promises.cp，recursive按真实source目录、errorOnExist=true/force=false/dereference=false/verbatimSymlinks=true，之后strict tree与原不覆盖rename发布；现strict link checker只核lstat类型和原readlink，不区分Windows junction与真symbolic及其directory标志。新SDK/路由/Node字段当前不需要；目录link浏览仍待完成，不能由本批提前宣称安全或通过。

继续使用已经应用的benchmark-debug-template与computer-use技能；只用自有新namespace、成熟NativeFacade原执行/输出/物理结算、真实页面与原图。当前纯文件任务不需要模型或凭据，没有Auth/models复制、网络Provider或数据库改动。

## 现象、根因与影响

原before的相对Move/Copy已有实际200/原entry发布事实：raw逻辑路径指向A内目标，同entry的实体浅落点却指向另一个B根；完整identity/readlink/realpath/正文保留。不能说A API（Application Programming Interface，应用程序接口）已读到B。触发是alias改变实际parent深度；旧shared validator在source及future两端都用逻辑dirname+path.resolve，并只观察当前文件系统，无法证明未来真实目录项的目标。

终端physical-parent替换只能修已证两例；普通整树中尚未发布的内部link、absolute/relative hop、junction与symbolic的不同namespace、Move退休旧namespace、Copy保留旧namespace仍要求一致的有限解析。旧current guard只证明目的parent在源退休后可访问，不校验链接的新声明；旧cp严格字节/readlink一致也不证明访问语义相同。因此本批目标是完整替换唯一shared规则，保留两root、错误path/原text/entry回执和原发布通知；不以“含..就拒”、ultimate target等同比较、物理试发布或失败后猜成功解决。

另一个实施前必须收敛的producer边界：Bun1.4.0的官方cp源码onLink在verbatim=true时保文本，但调用symlink(resolvedSrc,dest)省略type。Node25.7官方文档说明省略type在Windows只自动选择dir/file，缺目标用file。这是Copy可能改junction/directory-symbolic实际类型的源码证据，**尚未作当前宿主运行结论**；会影响未来projection使用哪一种link grammar，也影响broken dir链接。不能把保readlink当成已证明保reparse类型。见[固定Bun源码](https://raw.githubusercontent.com/oven-sh/bun/bun-v1.4.0/src/js/internal/fs/cp.ts)、[固定Node文档](https://nodejs.org/download/release/v25.7.0/docs/api/fs.html#fspromisessymlinktarget-path-type)、[Microsoft relative替换合同](https://learn.microsoft.com/en-us/windows/win32/fileio/creating-symbolic-links)。这些公开资料不能补本机原调用或取代真实FileRoutes验收。

影响覆盖terminal、普通nested tree、current/future权限、Win32实际kind/目录标志、Copy staging producer/checker、missing/ENOTDIR（不是目录）/ELOOP（循环）/unknown I/O（输入输出）合同及两Project；Move原guard/root/conflict先后和Node五字段不变。当前FileEntry观察只有link种类，不暴露symbolic directory标志，是否扩展须先看原tag属性与复制结果。POSIX（Portable Operating System Interface，可移植操作系统接口）逐分量dot语法保留，不外推Windows词法折叠；Darwin卷别名、UNC（Universal Naming Convention，通用命名约定）、外部retarget竞态没有本机资格。当前无新增调度/队列/恢复异常，旧meta/proxy共享横审与未知继续保留，不能因本Files通过而排除它们。

## 实施前有限宿主资格

先准备并Root全文审查固定新工具，再语法检查、再首次执行。只创建新owned run `C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/relocation-copy-kind-01a133`，两个宿主各8个独立小case，各自A/B实体树，最多4096B预声明正文，Root Node一次Prepare保存原UUID（Universally Unique Identifier，通用唯一标识符）/实体manifest。Node25.7与Bun1.4各首次一次处理自己的case，保真实full stat、NOFOLLOW handle原name/tag/flags/Close、readlink、realpath、完整bytes和错误cause；不使用已消费原fixture或重试同mutation。

八例：健康junction、健康directory symbolic、broken directory symbolic、broken junction、两层内部junction/relative链的源A/B及复制后A/B对照、absolute symbolic内部junction且namespace固定对照、绝对指旧树的Move与Copy位置差异、从合法missing声明搬到self-cycle的原OS结果。每项保原输入/生产相同cp options或原OS rename输入、前/后source身份/文本/marker和target实际tag/目录属性。rename资格是OS语义而非File.renameNoReplace或UI通过；cp原语相同也不冒全FileRoutes通过。结果先记录，不按期望猜kind/target；原operation/native/manifest准入意外失败保全并停止phase，readonly目标读取的成功或完整原错误都作观测，不借phase0声称每个target可读。

执行wrapper复用现唯一run-dot-native与原Native Host，不增加第二无活动驱动：各新prepare/read namespace原60000ms执行cap、15000ms真实Target输出无活动，parent只收完整Host流/自然close，原terminal/settled/outputSettled/四writes均收齐。输出只来自实际输入、原操作完成与真实读取，不造ping。Host自身系统代理发现的旧warning仍按原件保留；不关闭代理、扩大等待或把Target stderr0当Host无错误。

## 产品方案待资格收敛的边界

### 原运行资格与先行producer冻结合同

Root已完成首次Prepare、Node Read、Bun Read并全文解析原输出：fixture=e30c3c94-6c2b-4aa2-bb79-2bdc6e33c741；Prepare原262865B，Node1448353B/Bun1476317B，各Read101原record、8case/9原操作、60次原NOFOLLOW tag/name/Close观察。三个phase原Target/parent均0、stderr均0，原terminal/settled/outputSettled和四writes收齐。Node/Bun四基础例一致：健康junction的tag从0xA0000003变0xA000000C；broken junction也变symbolic且directory属性从true变false；broken directory symbolic仍0xA000000C但directory属性从true变false；健康absolute directory symbolic保dir。全部原readlink保持，没有由文本变化解释此差异。

第5例Source内部junction/relative链的原u读到A/B的QUAL INNER A，复制后u实际读到独立B的QUAL OUTER B；第6例absolute symbolic→固定junction的链复制后仍读A/B的QUAL FIXED A，证明不能统一ultimate parent。第7例绝对回旧树：Copy原链接继续读旧note完整正文，Move同text的新entry存在而旧目标ENOENT。第8例合法missing声明的同原inode搬到self-name后，原realpath/stat均ELOOP。以上是原OS/相同cp原语事实，尚不是FileRoutes或UI通过，也不排除未来别名/竞态等unknown。

这揭示两个独立共享根因：validator没有完整future view，Copy producer还改变其必须预测的访问grammar。完整本批目标不缩减；先落可独立交付的类型保留根修，再继续统一权限解析。此先行修复不宣称修了深度变化的外域结果、自循环准入或目录浏览。实施范围冻结为FileEntry私有link字段直接使用fs.symlink创建类型file/dir/junction，Win32同原TagInfo的directory属性区分true symbolic，POSIX该参数按原平台合同被忽略；它不是followed-directory导航事实，不增加第二缓存/旗标。

Copy仍只有一个成熟fs.promises.cp调用。其正式filter扩展点观察全部source symlink：原BigInt lstat确认entry，现readFileEntry验证准确原地址/identity并读取创建类型，原readlink与明确type收为本次操作的唯一descriptor；filter只排除默认链接分支，普通目录/文件继续同一次cp。普通成员完成后，现fs.symlink按该descriptor在stage创建全部链接，不在filter回调内写目的文件系统；按目标key的本地Map避免重复predicate观察导致重复创建，不成为跨请求缓存或权限事实。删除默认onLink对本产品symlink的实际执行路径，不保两种链接复制实现或fallback。staging/不覆盖rename/原通知/Node保持。strict checker除原text/完整bytes外核真实source/target创建类型；未知观察和关闭失败原throws。触及的函数/调用已重新全仓搜索，FileEntry仅Move guard/current helper，本创建类型改变不改其junction与symbolic grammar判断。

聚焦正向合同使用原真实FileRoutes TCP helper：healthy/broken junction、healthy/broken dir复制200后真实tag/type和text保持，broken目标实际创建后读取完整正文；同深度普通tree复制后内部junction/relative链应仍指原A目标并读回完整bytes（先运行原版本checker保红态，不把新版私有字段本身当旧Native事实）。Scope/root/link/ignore原契约聚焦回归。Root新18457真实页面亲自Copy、查看反馈/原图，再独立读tag/text/完整正文，普通收尾后提交。没有新增UI代码或自动UI测试。Private helper创建类型是从同一个原native observation派生，不是第二目标事实。

资格后在修改前补准确冻结合同：current/future共用一条已资格访问namespace与实际lookup位置转换；真实source tree是唯一entry/text事实，只按destination真实parent+原suffix作有限位置投影，跳出未来树读真正外部FS，不创建shadow tree/第二权限root或并行validator。Move退休source普通subtree或terminal entry，Copy保原；absolute文本不改写。known missing/非目录的合法broken声明与unknown error区分；source/未来cycle、snapshot变更、绝对回旧地址、未来短名等先明确公开错误和证据，禁止以未知当成功。

若实际cp改变链接kind，必须先冻结单一Copy producer的保留语义和原strict checker影响，不能预测source kind却继续发布另一种kind；成熟cp扩展点/原symlink primitive优先，不复制通用FS框架。当前只是候选，未授权以未运行猜测修改产品。完整权限解析及nestedtree证据齐备后再兑现完整目录浏览，不把终端两例或本调查检查点包装为根治。

最终真实FileRoutes正向合同覆盖两动作、source/future外域、独立合法alias、terminal/missing/retarget、nested普通树/内部link/dot、绝对旧namespace、cycles与两Project，并复用原root/link/ignore checker。实际开发模式 `/ui` 用新18457自有A/B fixture；Root亲自查看typed拒绝/原entry保持、合法复制/移动及中英文反馈、内容读回原图，普通shutdown/Native/父drains/实体身份收齐。没有UI自动化，静态类型/build不替视觉。同步07-panel当前合同、三个spec索引与artifact README，当前docs:check/architecture、范围提交、fresh upstream合并/完整待推送集合核验/正常push。尚未取得的宿主/产品/页面/错误资格明确为未达成。

## Copy类型保留阶段（历史）

当前已完成Copy类型保留根修与Root最终验收。最终link35 pass/375断言、143真实HTTP（200×102/400×13/404×24/409×4），原0；首版三组66 pass/748断言、244HTTP中唯一500是原ignore rule-read明确错误合同，非复制失败。修前137HTTP唯一500来自同深度普通tree复制后外域内容读取拒绝；完整原输入/body/请求身份与失败都保留。source类型原0，FileRoutes实际路径与私有production reader已运行；没有UI自动化或模型请求。

新服务18457实际fixture=ad19ccf5-247d-428f-8d7a-af8d4faf7135、Host89856/Target90392及原birth/occurrence完整保存。Root亲自SourceJ→copied-j英语复制、SourceS→copied-s中文复制各一次200，4张1280×720原JPEG全部实际查看；原A marker Editor完整可见，内容读回证明copied aliases读取同一完整A正文。四注册、首before六、repaired before六、after八请求（共24脚本HTTP）全部200/201；两UI copy独立计。五原source身份/text、六registered文件bytes和A/B正文保持，after实际新entry的JUNCTION/SYMLINK+directory属性与text精确核验。

首次before原phase1发生在完整result写盘：新native HANDLE是BigInt，旧工具save直接JSON.stringify失败。原六HTTP/全流/600B stderr保留，但当时未写盘的source Native汇总不补造。Root保两原工具全文，以明确type/value保BigInt、不转Number，修复后在新before-repaired namespace按原真实输入重跑0；同服务未重启/延长或重放mutation。原service stdout541B/stderr138321B全文Root解析无warn/error/timeout诊断，浏览器原warn/error数组为空；只证明该小实例，不排除旧meta/proxy共享根因。

关闭Root自有tab3后普通shutdown实际200，Native exited0/三joins/四writes与physical/output/request settled、原Host/Target退休/port释放均收齐，launcher自然0。PowerShell调用另记returned，不冒native退出码；没有用户窗口/进程、凭据/catalog/数据库或发布。原UI资产未改，source启动时own diff/HEAD保留；不声称其它owner同步改动的UI已资格。

199份完整原件9255819B已无损归档，新JPEG直接存原bytes；另8份最终检查与交付工具原件有独立manifest。首次归档误列了由空git diff pipeline未创建的before patch，原ENOENT/1保留，删除准确不存在选项并只在原件直接字节相同条件恢复未完成归档，不制造空capture或修改原日志。当前07-panel已同步实际创建类型/strict检查合同，三个owned索引与相关README同步；最终docs和architecture检查原0，范围提交/latest upstream同步/正常push尚待原结果。完整shared source/future权限、alias深度变化、未来cycles/短名、非Windows实机与目录link浏览仍未修复或未资格，持续目标保持active，下一步继续这一完整目标。

## 历史执行记录

以下保留各阶段当时的状态与失败，不代表当前未完成项；最终验收以“当前状态”及原回执为准。

## 下一批：未来树访问输入资格

上一轮属于实质进展，625c7c5c2e4c9ef1e2835f6ad19d195f8d59f257已普通提交/精确index收敛，fresh fetch/merge后完整待推送集合只有该提交；正常push原0，全部hooks通过。2026-10-13T22:55:03.582Z fresh upstream=HEAD=该提交，own scopes clean、真实index空；他人共享工作区改动保留。本轮仍由Root独立推进完整shared source/future权限，用户停止子agent的要求持续有效。

进一步全仓核对当前唯一shared遍历及两caller、FileEntry创建类型、Move退休访问guard、canonicalPath/isPathAllowed、FileInvalidPathError400和现真实TCP合同。现未来输入仅长名字的有限位置投影仍有未经排除的缺口：Windows真实8.3（短文件名）可参与链接文本，复制重新生成别名，Move子项保身份但顶层rename可能改变别名；把未知未来短名字直接当合法missing可能漏掉内部链接链。此前entry-name原运行已实际返回REGULA~1.TXT等别名，当前C卷不能假定无短名。源/目的地址、访问namespace、lookup实体位置是不同的执行事实，不可互换。当前无新增调度异常；API/SDK/Node/配置/凭据/模型无改动需求；非Windows、UNC、大小写敏感卷和外部retarget仍未知。

在产品解析器实现前，先对这一个有实证来源的输入边界作有限原生资格。新owned root为C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/future-short-input-01a133；Node25.7/Bun1.4各4个独立case（稳定别名与碰撞创建顺序，各Copy/Move），预声明所有普通目录/文件/链接及正文总预算1024B。Prepare一次建立原UUID、A/B独立实体和original full stat/readlink/bytes，原GetShortPathNameW返回的完整路径和basename是唯一alias输入；API未返回改变终端拼写时显式未资格，禁止猜~1。碰撞case按显式先创建两个JUNCTION、再创建同前缀普通目录，保存真实短名；u文字只从首JUNCTION的原API结果形成。没有用户窗口/进程、Provider、auth/models或数据库。

Read对各host自己的原case每项只做一次原操作：Copy使用现同一fs.cp正式filter/普通成员后原fs.symlink明确type协议，Move只用fs.rename观察OS语义，不冒生产renameNoReplace。所有before/after长名、真实短名、NOFOLLOW原tag/name/close、lstat/realpath/stat和完整正文/错误及source变化全文输出。Copy资格只证明原库/OS协议，不冒FileRoutes、网页或视觉验收；不根据名字、最终错误或预期推alias身份。此前已资格的完整native reader保持不改；同一NativeFacade wrapper只增本新mode分支，先保旧全文与精确差异，再syntax，Prepare/NodeRead/BunRead各首次独立namespace，60000ms cap/15000ms真实Target输出无活动；三joins和四writes完整收齐。未知/failed native observation立即保全停phase，readonly目标错误作为原观测，不用phase0冒所有目标可读。

Windows官方[Reparse Points](https://learn.microsoft.com/en-us/windows/win32/fileio/reparse-points)规定当前路径最多63个reparse point；[Linux path_resolution](https://www.man7.org/linux/man-pages/man7/path_resolution.7.html)规定40个符号链接。它们是原生合同来源，不是本产品任意次数策略，尚未作为本机边界资格或新代码常量。原self-cycle ELOOP证据仍有效，当前不能用裸inode去重拒绝不同namespace的有限访问。未来完整解析器必须只保一个snapshot/位置投影事实来源，显式区分Current、Copy保源及Move退休旧源；短名结果决定是否必须在原staging生产后取得实际子项别名，再基于final位置核权限。禁止以关键词拒绝、物理试发布、原target成功代future成功或新增平行权限root替代完整解析。后续实际FileRoutes正向错误/成功、完整bytes/身份和Root桌面验收仍必要，本资格不关闭原完整目标。

### 本轮首次运行结果与方案修正

Root全文复核固定新工具、原23处精确变化与preflight纠错后，三项Node syntax原0。唯一Prepare建立fixture=0d7295b0-5876-41db-834f-5b1a2ce57d51、8独立case、304B普通正文；所有u的原文字JUNCTI~1/r来自各原GetShortPathNameW返回，非猜测。随后Node/Bun各自己的4case/4操作首次原0：Prepare252632B，Node2036904B，Bun2064307B，stderr均0；Read各175完整record、71次NOFOLLOW目录项观察、5次copy link原观察/明确type创建。三phase原Target/parent 0、三joins、四writes与physical/output/request settled收齐。142次目录项观察不包括另外10次copy-filter观察；不把两个计数混同。

两host完全一致：u原完整正文SHORT INNER A\r\n（15B）；stable Copy、stable Move和collision Move后均为SHORT OUTER B\r\n（15B），原NOFOLLOW同短名指JUNCTION且长entry地址精确落到result下原链接名。collision Copy后u为SHORT ORDINARY\r\n（16B）：JUNCTI~1实际目录项tag=0、ordinary directory，长地址是junction-altar-folder；alpha/alpine两个链接仍tag=0xA0000003，但实际短名变为JUNCTI~2/~3。collision Move保两子项的JUNCTI~1/~2及原身份，随后相对namespace变浅导致u读B。原text/创建类型并未变化；复制新目录项的实际别名分配随普通目录先创建、链接后创建的真实协议变化。完整stat/readlink/native原buffer/关闭/realpath/正文与错误保全，不由正文推断entry身份。

这不是新的FileRoutes回执或网页通过，A/B是隔离实体目录而非注册Git Project；也不是“Copy改变type”的旧根。它明确排除了源树长名map，以及源树短名map不加区分地直接用于Copy future的方案。下一实施合同须将Copy future检查放在原staging完整生产/strict检查之后、noReplace发布之前，使用该实际树的长名/实际别名与创建类型，按最终实体位置解释；Current与Move仍使用原source实际目录项，Move显式退休旧namespace。只保持一个解释器，不双读择成功，不制造未来stat、不先发布再撤销，不以~关键词拒绝。顶层长名字rename后的新short alias、short-name政策/关闭卷、非Windows、UNC与retarget原子性仍没有本轮资格；原source/future权限/循环/完整整树实现与目录浏览均未达成。由本新证据继续完整实现，不能将本调查检查点称该批功能已完成。

## 顶层发布名称资格与统一解析器

上一轮是实质进展：9fe59dcacbdfef230e9cf69b06095df17629a19a的60个spec/证据文件已普通提交。首次push所有hooks0但curl35/连接中断而原1；fresh fetch证实未送达，重新merge/完整集合核验及普通重试原0。2026-10-13T23:23:46.718Z fresh HEAD=upstream=7897d1bd、own commit ancestor0、own scope clean/index空，完整原1与重试0分别保留。625c7c5c2的三项产品/测试文件与当时HEAD净差异为空。本轮Root单独继续，保留他人compaction、恢复、Provider/SkillMarket、问题投影和持久格式改动。

顶层发布名称还不能借子项Move保身份来预测。[Windows FileRenameInformation合同](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-fsa/87f86c9b-6c2a-4803-84b7-131a74a434fa)描述新目录项和short-name/tunnel处理，生成名称由文件系统实现决定且须唯一；此前实际子项事实不能填补顶层rename。当前Windows生产noReplace使用MoveFileExW flags0；本新观测的fs.rename只资格库/OS命名，不冒生产noReplace和网页通过。必要先行观测不缩小完整current/future权限与目录浏览目标。

新owned root为C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/future-top-name-01a133，Node25.7/Bun1.4各4独立普通树rename：同父同前缀长名、同父不同前缀长名、跨父stage长名到final长名、目标父已有两个同前缀普通目录的跨父rename。固定目录/正文总预算512B；source/root与r/marker全文、独立B marker、现有同前缀目录身份均保存。Prepare唯一UUID，u原text为../加原GetShortPathNameW返回的source basename加/r，不猜新短名。Read每case仅一次原rename，before/after原NOFOLLOW tag/name/buffer/关闭、lstat/readlink/realpath/stat/完整正文/原错误、原短名入口以及新API返回的目标短名入口均保存。无别名返回则明确未覆盖；unknown/native/close失败保全停phase，不把只读ENOENT观测当phase失败。仍同一成熟NativeFacade、60s原cap/15s真正输出无活动、三joins/四writes；先原工具/精确差异落盘及全文审查，syntax后首次Prepare/两Read。无Provider/凭据、数据库、UI或用户窗口操作。

观测后冻结实现：现shared遍历只一条，Current和Future必须共享namespace与实体lookup转换，不再用提前fold的逻辑目标加当前realpath冒未来声明。真实source或Copy staging目录项、真实创建类型/文本/实际短名和两个现权限root是唯一输入；有限位置投影不生成stat或public Node，不建立另一个权限root，不把未知择成功。完整错误/成功合同、原顺序/通知、Source保持与Move退休、普通/nested tree、链接链/dot/循环、外域与合法missing/retarget、两Project和Root真实页面验收均仍必要。顶层新别名的未知必须依据原OS合同与实证解决，不能凭固定~规则预测或静默当missing。当前仍没有产品解析器改动或本新页面通过。

### 已观察结果与实施前冻结合同

唯一fixture=f456dba2-87b5-4329-9663-8a25585fdead；Prepare178184B/Node2029212B/Bun2063986B、stderr均0，三phase原0与三joins/四writes完整settled。各Read153个完整record、65个NOFOLLOW目录项观察；8个原rename每项目录dev/ino/birth保持、新r/marker完整15B。两host同父同前缀PUBLIC~1保留且u仍完整读note；其它SOURCE~1/STAGIN~1变DESTIN~1，collision变DESTIN~3，u text保持而stat/realpath为ENOENT。新短名入口由实际API结果读取并保存，不从算法、名称或字节结果推身份。这证明顶层short alias既不能一律保持也不能一律退休，不新增“遇~就拒”的规则。

实施范围为FileEntry私有实际短名观察、一个通用访问walker及一个有限树投影；替换现shared的两次逻辑path.resolve检查，Move destination independence复用同一个walker，不保第二份namespace解释。walker只持访问namespace和实际lookup位置，普通目录按实际entry地址推进，SYMLINK按raw声明展开并返回状态；Windows JUNCTION检查实际target但保外层namespace，Windows在展开stage词法fold，POSIX保分量顺序及dot。现平台原生链接上限Win63/Linux40/Darwin32集中在此FS抽象，Darwin依据[Apple原sys/param.h](https://raw.githubusercontent.com/apple-oss-distributions/xnu/main/bsd/sys/param.h)，不是任意产品次数策略；未知平台明确ENOTSUP。knownmissing/ENOTDIR保明确缺失位置，unknown I/O原throw，循环用访问状态和原生上限，不用裸inode拒有限多namespace访问。

所有未来事实都来自真实source（Move）或实际staging（Copy）的NOFOLLOW metadata、原text、完整成员名和实际short basename；同一snapshot提供child name/short-name查找，位置只投影到目的真实parent和原suffix。Root长名及内部别名不新增stat/权限root。Move退休旧source namespace，Copy保原。Copy Current先检查真实source，普通copy/type保留/strict完成后检查实际staging的Future，再noReplace发布，原strict/cleanup/通知/五字段Node保留；源及stage身份/文本/成员集合与访问witness在发布前重读验证，外部retarget最后竞态不宣称原子消除。

顶层额外short alias未分配前不能生成某个“真实名字”。采用完整不确定性证明：当Future目的父中某分量将缺失、且新root名可能产生额外short name时，同时计算缺失解释及该分量可能成为新root别名的投影解释；只有每个解释均在两个现权限root内且可有限解析才准入，不双读择成功。候选资格按[MS-FSCC 8.3语法](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-fscc/18e63b13-ba43-4f5f-a5b7-11e871b71f14)的ASCII/长度/点规则，不猜~前缀或数字。真实存在且不会退休的名字占用不能成为新别名；额外别名确定不可能时只保实际缺失解释。投影解释标记为可能，绝不称其为已生成或真实observed entry。合法missing和旧绝对namespace退休在所有解释均在域内时继续200；有外域解释用既有source/future400错误，可能的递归解释明确400“Cannot verify … recursive future access”，不冒实际Native ELOOP。现已有明确循环同样归准确400解析合同；unknown I/O仍原错误。

聚焦正向验收必须走现FileRoutes真实TCP helper：终端实际parent浅alias造成外域的Move/Copy400、同两Project B原正文保持；普通整树内部SYM/JUNCTION链，Current外域与Future外域、合法depth相同/绝对固定链200、Copy原short alias重新分配的实际staging200/400、Move源旧绝对名称/short namespace退休后合法broken200+content404、nested self-cycle的准确400、有限重复链200及原link/root/ignore。新short语法只是必要的不确定性范围，不拿静态字符串单测替功能。随后Root新开发/UI实例亲自中英文拒绝与合法Copy/Move，原截图人工复核及身份/完整正文/实际原NoReplace和完整收尾。没有新增UI自动化/SDK/路由/config/model请求；07-panel及本spec/证据必须同步，范围提交、fresh upstream/全部待推送集合检查/普通push后继续目录浏览。

Root独立桌面输入冻结为18458、owned relocation-permission-after-01a133新root及relocation-permission-after-tools独立工具；沿已关闭copy-kind成熟launcher/fixture/BigInt serializer/Native reader精确适配，原六脚本全文及差异保留。A/B两普通注册Git Project、7条健康链接及预声明正文最多512B；五原Data aliases保留，增加aliases/root-back→A及context/relative text ../project-b→A内project-b控制目录，真实B为run/project-b。实际目的根Root后同text会指B，不由标题猜。Prepare/四Register请求沿原60s/20s与120s/30s，service900s/120s、before/after120s/30s原预算；不重启/延长或复用已消费namespace。

Root手动四个mutation：英语Copy relative→aliases/root-back/rejected-copy400，中文Move relative→aliases/root-back/rejected-move400；合法Copy source-j→copied-j200、Move source-s→alias-s/allowed-move200。拒绝后relative身份/text/Inner A正文保，合法copy类型JUNCTION/text及A marker保、Move原source-s身份/text在原raw/实体目标保持；原source-s内容读取准确404。Read-only before8/after11个普通HTTP和native身份/原tag/name/buffer/关闭；所有普通registered完整bytes（含运行时忽略规则）及A/B正文保持；只能由Root手动实际页面做mutation。至少四张绑定目标/反馈与一次原A Editor的原JPEG人工查看，不新增UI自动化。缺截图/真实页面或原收尾不能宣称本批已完成。当前49 link/468正向断言原0，root/ignore还在同一次聚焦runner中；最初test内注册错误的原34/1及随后四个子path separator期望错误的原43/4均保留，原API正确200/400不借测试失败错误归产品。

### 最终实现与Root验收

已实现一个file-access walker及file-relocation有限树视图，删除旧shared逻辑fold/当前FS推future路径及Move guard的第二份解释器。私有FileEntry.shortName来自实际GetShortPathNameW，不进入SDK/Node；Current/Move树和Copy实际staging树分别供同一解释器，根额外别名只做所有可能解释的权限证明，不冒真实名字。Current普通成员也核真实位置，snapshot/访问witness/目的parent发布前复核；创建类型/原text/strict bytes/noReplace/cleanup/原通知/五字段Node保留。没有目录target导航字段、LLM路由gate、fallback或并行权限root；没有模型/凭据请求。

最终当前产品链link49/468、root18/294及正确入口ignore-coordinate13/79均0，共80项841正向断言；237+43=280实际HTTP（200×179/400×68/404×28/409×4/500×1），唯一500为原ignore规则read-error明确合同。原三文件runner1因Root写错第三个文件名file-ignore-contract而module missing；改用实际file-ignore-coordinate-contract，原单组13/0保全，不伪称原runner0。最早34/1是新增test误置于已有test回调，真实root-link Copy200；43/4是新增子path期望用了/而原契约path.join在Windows用\，产品实际400；两次原失败都完整保留，未改产品迎合错误期望。两次source类型0，格式与diff检查0，最终源码运行前完整内容/HEAD/差异已捕获。

新服务18458 fixture=d64d0488-10ee-4f20-a524-c3130085defd、occurrence=relocation-permission-after-b44a2875-fb78-4774-b63d-807332924d97，Host73968/Target79888及原birth已保存。Root自有IAB tab4亲自四mutation完成：英语Copy相对声明400、中文Move400；中文合法Copy200及合法Move200；页面原A Editor全文RELOCATION DATA A 01a133可见。六张1280×720原JPEG逐张人工查看，原中文/英语错误摘要与成功反馈保留；UI源码及公共Node未改，资产沿已资格私有Bun/UI对，无Vite、UI自动测试或新模型请求。四Register、before8、after11共23脚本HTTP；其中旧source-s内容明确404，其余200/201。Native读回7原链接在明确位置的同身份/text（source-s在alias-s/allowed-move）、新JUNCTION和SYMLINK+目录属性、所有registered完整字节及A/B正文保持，复制别名及移动别名都读同原完整A正文。

Root关闭自有tab4后普通shutdown。第一次调用漏必填三个参数，shell非终止binding错误后继续写了outcome=returned文件；该文件仅是外层shell继续的原件，不是关闭成功或native0，Root准确纠错单独保存。服务handle当时仍live；用精确RunRoot/EvidenceRoot/EvidencePrefix/PageClosed参数正常shutdown返回，原launcher0及Native terminal0/三joins/四writes/physical-output-request settled、原owner退休及port释放均收齐，没有重启/扩预算/杀用户进程。browser原warn/error数组为空，服务诊断完整stderr未检出WARN/ERROR/timeout；不排除旧meta/proxy共享未知。

07-panel已同步单一实际/未来树及额外别名证明合同。完整非Windows实机、Windows大小写敏感目录/关闭短名卷、原生极限边界与最后的外部retarget原子性仍未资格；目录链接浏览仍未实现，持续目标active。文档检查、原件归档、范围提交和fresh upstream/普通push尚待原结果，不把当前功能通过扩称全平台或持续目标已完成。

第一原FileRoutes checker运行实际30 pass/5 fail、352断言；同深度tree Copy回执200后content实际500/UnknownError，原readScope禁止B访问，故不是A API已读取外域。四创建类型正向合同中健康dir的红态也包含旧私有字段只有symbolic的合同差异；真实tag/属性变化仍由前述Native原件证明。Root调用时误将Bun test的筛选参数传给本仓只接受文件的run-tests.ts，原运行另把两个参数当文件并各报module missing，整runner原1保全；不把额外故障归产品。后续采用正确文件入口，不扩改成熟runner。

首修后正确checker35 link+18 root+13 ignore共66 pass、748断言、原runner0。Root复核进一步让filter只收原descriptor、普通成员完成后再创建link，不在predicate内发布FS；最后直接受影响link35与source类型检查正在重新运行，首66不借给此最终版本。新18457页面工具已沿原已关闭guard成熟launcher/fixture精确准备独立copy-kind-after namespace，六原脚本与完整修改保存；输入仍95B、五健康links、A/B两独立Git根，四注册请求，无root循环或model/Auth/models。UI仅手动两次Copy source-j/source-s到copied-j/copied-s，前6/后8只读HTTP及真正native tag/directory/text/原身份/六注册后完整bytes读回；broken与nested tree由真实FileRoutes合同单独证明，不借健康UI图替完整浏览。仅当前原service900s/120s，准备60s/20s、注册与读取120s/30s，所有原收尾保全。工具parser后再Root首次授权Prepare/Launch/Register/页面；当前没有新service或UI截图。

已完成当前源码/历史合同调查并落本计划。Root已准备且全文审阅唯一qualifier/固定inputs与现wrapper精确新增分支：Node/Bun各8case，预声明原literal总432B；旧wrapper原件先保历史，不复制第二Native驱动。每host第7例两动作，因此共9次原OS操作（7次copy、2次rename），第5/6例显式保存source与target p/q/u/r及不同A/B marker。当前仅输入生成0，没有fixture或native运行；Copy类型改变仍只是官方固定源码推导。完整shared relocation修复和目录浏览尚未达成，持续目标active。下一步Root先纯syntax，再按原固定输入首次Prepare/Read。
