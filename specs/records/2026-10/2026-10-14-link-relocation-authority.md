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

## 当前状态

当前已完成Copy类型保留根修与Root最终验收。最终link35 pass/375断言、143真实HTTP（200×102/400×13/404×24/409×4），原0；首版三组66 pass/748断言、244HTTP中唯一500是原ignore rule-read明确错误合同，非复制失败。修前137HTTP唯一500来自同深度普通tree复制后外域内容读取拒绝；完整原输入/body/请求身份与失败都保留。source类型原0，FileRoutes实际路径与私有production reader已运行；没有UI自动化或模型请求。

新服务18457实际fixture=ad19ccf5-247d-428f-8d7a-af8d4faf7135、Host89856/Target90392及原birth/occurrence完整保存。Root亲自SourceJ→copied-j英语复制、SourceS→copied-s中文复制各一次200，4张1280×720原JPEG全部实际查看；原A marker Editor完整可见，内容读回证明copied aliases读取同一完整A正文。四注册、首before六、repaired before六、after八请求（共24脚本HTTP）全部200/201；两UI copy独立计。五原source身份/text、六registered文件bytes和A/B正文保持，after实际新entry的JUNCTION/SYMLINK+directory属性与text精确核验。

首次before原phase1发生在完整result写盘：新native HANDLE是BigInt，旧工具save直接JSON.stringify失败。原六HTTP/全流/600B stderr保留，但当时未写盘的source Native汇总不补造。Root保两原工具全文，以明确type/value保BigInt、不转Number，修复后在新before-repaired namespace按原真实输入重跑0；同服务未重启/延长或重放mutation。原service stdout541B/stderr138321B全文Root解析无warn/error/timeout诊断，浏览器原warn/error数组为空；只证明该小实例，不排除旧meta/proxy共享根因。

关闭Root自有tab3后普通shutdown实际200，Native exited0/三joins/四writes与physical/output/request settled、原Host/Target退休/port释放均收齐，launcher自然0。PowerShell调用另记returned，不冒native退出码；没有用户窗口/进程、凭据/catalog/数据库或发布。原UI资产未改，source启动时own diff/HEAD保留；不声称其它owner同步改动的UI已资格。

199份完整原件9255819B已无损归档，新JPEG直接存原bytes；另8份最终检查与交付工具原件有独立manifest。首次归档误列了由空git diff pipeline未创建的before patch，原ENOENT/1保留，删除准确不存在选项并只在原件直接字节相同条件恢复未完成归档，不制造空capture或修改原日志。当前07-panel已同步实际创建类型/strict检查合同，三个owned索引与相关README同步；最终docs和architecture检查原0，范围提交/latest upstream同步/正常push尚待原结果。完整shared source/future权限、alias深度变化、未来cycles/短名、非Windows实机与目录link浏览仍未修复或未资格，持续目标保持active，下一步继续这一完整目标。

## 历史执行记录

以下保留各阶段当时的状态与失败，不代表当前未完成项；最终验收以“当前状态”及原回执为准。

第一原FileRoutes checker运行实际30 pass/5 fail、352断言；同深度tree Copy回执200后content实际500/UnknownError，原readScope禁止B访问，故不是A API已读取外域。四创建类型正向合同中健康dir的红态也包含旧私有字段只有symbolic的合同差异；真实tag/属性变化仍由前述Native原件证明。Root调用时误将Bun test的筛选参数传给本仓只接受文件的run-tests.ts，原运行另把两个参数当文件并各报module missing，整runner原1保全；不把额外故障归产品。后续采用正确文件入口，不扩改成熟runner。

首修后正确checker35 link+18 root+13 ignore共66 pass、748断言、原runner0。Root复核进一步让filter只收原descriptor、普通成员完成后再创建link，不在predicate内发布FS；最后直接受影响link35与source类型检查正在重新运行，首66不借给此最终版本。新18457页面工具已沿原已关闭guard成熟launcher/fixture精确准备独立copy-kind-after namespace，六原脚本与完整修改保存；输入仍95B、五健康links、A/B两独立Git根，四注册请求，无root循环或model/Auth/models。UI仅手动两次Copy source-j/source-s到copied-j/copied-s，前6/后8只读HTTP及真正native tag/directory/text/原身份/六注册后完整bytes读回；broken与nested tree由真实FileRoutes合同单独证明，不借健康UI图替完整浏览。仅当前原service900s/120s，准备60s/20s、注册与读取120s/30s，所有原收尾保全。工具parser后再Root首次授权Prepare/Launch/Register/页面；当前没有新service或UI截图。

已完成当前源码/历史合同调查并落本计划。Root已准备且全文审阅唯一qualifier/固定inputs与现wrapper精确新增分支：Node/Bun各8case，预声明原literal总432B；旧wrapper原件先保历史，不复制第二Native驱动。每host第7例两动作，因此共9次原OS操作（7次copy、2次rename），第5/6例显式保存source与target p/q/u/r及不同A/B marker。当前仅输入生成0，没有fixture或native运行；Copy类型改变仍只是官方固定源码推导。完整shared relocation修复和目录浏览尚未达成，持续目标active。下一步Root先纯syntax，再按原固定输入首次Prepare/Read。
