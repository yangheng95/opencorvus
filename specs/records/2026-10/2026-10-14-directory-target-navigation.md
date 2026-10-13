# 目录链接浏览与别名目的地的文件契约

## Recall

用户要求持续按批次并行体验 UI（User Interface，用户界面）/UX（User Experience，用户体验）与功能调查，先完整分析/落 specs，再有证据实施、真实桌面交互与截图人工复核、聚焦正向功能测试及必要的已授权 GPT-6.1 Sol 流式端到端验收，范围提交、最新 upstream（上游）merge（合并）和正常 push（推送）后下一批，直到明确停止。没有停止请求。上一轮是实质进展：5107ed64bc1c63b76a247d952b1f526a6c5da152已提交根目录当前语言展示/完整证据，23张真实JPEG人工查看、29个正向File读取请求与5项资源合同通过；第一轮deadline/parent1和最终独立普通shutdown/Native/parent0分别保存。原HEAD并发提交拒绝128、原push因远端已更新拒绝1后，fresh fetch/merge/完整待推送集合审查/正常hooks/push最终0；fresh HEAD=origin/main=5107ed64，own ancestor0。本轮开始状态再次核到相同HEAD/upstream、real index空。

工作区有其它owner的serve/server/restart/stop及其测试、Design patch、401/402/403规格和共享索引，全部保留，不创建branch/worktree、不粗回退/rebase/force/no-verify。Root已读根AGENTS、上一轮完整Recall/实现/真实结算和目录link前批Recall；原92项链接/根/ignore局部及Windows真实回执只证明各自合同，不替代本轮新目标。已读当前File.Node/唯一projector、canonicalPath/isPathAllowed、create/move/copy/remove/list/read及全部生产调用、SDK（Software Development Kit，软件开发工具包）成熟生成事务、FileExplorer目录/selection/expanded/mutation刷新/目的地/编辑owner、file-workbench及07-panel公开契约。全仓File.list只有routes/debug，mutation只有FileRoutes；搜索文件路径仍为string；Node列表和回执共用entry事实。

用户明确授权批次并行；本轮一层限定file_alias_audit只读UI影响、file_alias_contracts只读后端别名/relocation、functional_audit只读实际predicate/SDK/原工具预算，均禁止再委托、产品/测试/正式spec/Git修改或运行。已完整读上一候选next-batch-candidate.md；新报告待Root全文核验。file_alias_contracts的新源码推导包括source-through-self发布后可寻址与relative link经alias搬迁的物理目标范围，均尚未实测。不得凭名称/最后错误断定根因或把推导写成复现。

本轮继续使用benchmark-debug-template（基准调试模板）的Recall、原输入/原输出/真实活动期限及二次复核流程；已重读其SKILL。当前成熟PS launcher只有900000ms absolute execution（绝对执行预算）、startup观察45秒、shutdown观察45秒/其他owner join75秒，**没有**外部120000ms inactivity driver。无活动超时是独立待资格的既有ProcessFacade.run能力，不把absolute执行cap冒充无活动计时。工具观察expiry只继续原handle，绝不重开/重置执行input。所有准备、纯syntax和预算资格先完成，再启动真正页面，实际交互/读回后立即收束，后续分析和Git不耗服务预算。

## 已知现象、直接触发和历史边界

已有真实Windows junction/dir symlink的terminal lstat为link、followed target为目录，直接GET/file具体alias path200返回marker，后续真实TCP（Transmission Control Protocol，传输控制协议）合同也证alias子内容完整CRLF（Carriage Return/Line Feed，回车换行）字节。当前File.Node.type有意统一为entry目录或其它entry；terminal link= file，ignored目录hint来自同一entry。因此不是type回归。Explorer仅type=directory显示chevron/展开/目录菜单，其它行openFile，尚无独立target目录事实；新的真实修前点击图仍未取得。

前批修复list/receipt与broken link、物理rename成功后followed stat404的混淆，明确不引入link浏览。不能为了浏览把正确entry kind改回followed kind；否则重新引入选择退休、ignore坐标和发布后target I/O（Input/Output，输入输出）失败。File内容读取继续follow target，其权限/revision（版本标识）与entry mutation不同；path/name/absolute仍原逻辑文件身份。

新增目录目的地需要先确认两个相关实际边界。源码表明File.move先验证路径/parent/relocation，renameNoReplace之后nodeForPath读取原targetFull：source terminal link若移进通过其自身到达的target，旧source路径退休后targetFull可能不可寻址。另一alias到同target可能完全合法，不能用canonical target ancestor粗略阻断所有alias。relative readlink用path.resolve(logical parent,text)校验；alias改变实体parent深度时，实际新链接目标可能与逻辑声明目标不同。这是permission/publication共同影响，不能先加猜测gate或通过目录图标掩盖。当前仅推导，须小型真实checker（检查器）证实。

## 公共事实和最终能力范围

本批目标是健康、当前权限允许的目录link在真实Files中可展开/收起、打开alias子文件，并在现New/Upload/copy/move目录目的地中使用其原逻辑path；scope（项目范围）、错误Details、语言、已展开路径和编辑owner继续自然收敛。完整能力不得仅画folder图标而仍把上传发到parent，也不得为了更容易通过旧测试缩成只有普通目录。

候选最小公开合同为File.Node.extend形成必需File.ListingNode.directoryTarget:boolean，独立.meta ref；仅list/GET file/debug产出目标目录事实。Node与create/copy/move原成功回执仍只描述entry，不在成功发布之后追加新的target查询失败点。列表Map使用SDK ListingNode，mutation用SDK Node，替换手写重复类型。不给缺字段的旧协议fallback，不把target flag复制进selection/反馈或第二缓存。所有target事实由当前scope/token成功list唯一发布。

普通实体dir/file依成熟Dirent事实；真实link是否为允许目录由现isPathAllowed与stat判定。明确out-of-scope、regular target、已知ENOENT/ENOTDIR可false；未知realpath/stat错误原样失败，不能catch→false或假造成功列表。父list因未知link I/O失败是新增读影响，必须明示/实证；directoryTarget不承诺可写、ACL（Access Control List，访问控制列表）、未来目标稳定性或原子快照。Dirent对Bun1.4/Windows junction的三个predicate尚待实测，不能凭Node文档猜已资格。

SDK正常build生成OpenAPI/客户端，GET file200声明ListingNode.array；触及route应准确声明已有500错误合同，不能顺手将generic list/read500改成mutation400。UI rows/chevron/aria-expanded/contextOpen/目录目标/选择后代退休消费目标事实，entry identity/recursive self-copy/root guards仍用entry kind；link移动后的required reads根据真实expanded意图收齐，不从缺target的mutation回执猜false。search仅string路径的行保其当前文件结果，不增加每行metadata请求、rg --follow或另一个index。

如果真实alias mutation缺陷成立，先修现唯一File生产准入/relocation和可寻址回执根因，再兑现浏览能力；该修复必须完整覆盖move/copy、相对/绝对、源/目的alias、normal/broken/retarget、实体目录整树和两Project。Node原entry/ignore/readlink语义保持；不可通过host路由旁路、失败后猜磁盘成功、第二回执或关闭错误检查解决。没有模型工具选择/gate、LLM（Large Language Model，大语言模型）交互、调度、队列或Task/Mission/Session生命周期改动；已知Capsule/Native未验共享分支继续其原规格，不由本Files调查排除。

## 第一阶段有限真实调查输入

先准备并审阅唯一新scratch工具，再Root另授执行；当前未创建运行目录、数据或服务。新owned run为C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/directory-target-before-01a133，port18455，prefix/evidence directory-target-before。两个独立物理Git根沿成熟project/project-b布局、exclusive新run、原manifest UUID（Universally Unique Identifier，通用唯一标识符）/dev/inode/birth保存；source CLI（Command-Line Interface，命令行接口）/真实localhost:18455/ui与正式private immutable bin/ui，不单开Vite。构建先结束再启动；所有后端source与private资源身份按原输入/asset/真实错误记录，不用可变源码hash当功能门。

原用户数据零接触；A/B均本checker新建、tiny预声明UTF-8（Unicode Transformation Format, 8-bit，八位字符编码）/CRLF正文，总原文件bytes≤4096、entry数量有限。具体fixture包含：A target-dir/marker、真实Unicode名称、absolute junction/dir symlink、relative dir link、file link、broken link、root-link、A→owned B的外域link。仅原文件/链接事实，不注消息/SQL（Structured Query Language，结构化查询语言）/UI（DOM即Document Object Model，文档对象模型）状态或mock（模拟）错误。B自己的原marker与独立Git根保存。

两组限定API（Application Programming Interface，应用程序接口）调查另用专属entry，不碰要用于before截图的健康link：一组source绝对link→通过自身路径的destination及另一独立alias对照；一组A/from/link的相对text=../project-b，源实际A/project-b，目标逻辑A/aliases/root-back/moved且root-back→A，逻辑relocation在A/aliases/project-b但真实新link可能落到run/project-b=B。move/copy各用新独立source，禁止重试同mutation或搬Project根；每步原请求/全body/请求ID、lstat/readlink/realpath/原target完整bytes、命令原退出/同源birth分别保存。pre模式只报告实际值与差异，不把某旧失败当正确期望；post正确错误/成功契约在真实证据后补正式决定。

primitive先记录Bun1.4/Windows真实Dirent.isDirectory/isFile/isSymbolicLink及lstat/stat/readlink/realpath。unknown I/O若不能安全真实触发，保持未覆盖，不用注入错误冒称端到端。真实before UI至少健康junction/dir link行点击和原Editor/错误图、直接GET list与子content/fullbytes对照、两Project真实scope；每关键图实际呈现人工查看。普通关闭和原Native/drains/request/birth/port/parent join之后才改产品，避免source身份串用。typed根upload、external drop、POSIX（Portable Operating System Interface，可移植操作系统接口）实机、long path、所有late窗口不借旧图或此probe冒称完成。

## 工具预算、原活动与资格（设计待审）

当前ProcessSpawnRequest没有inactivityTimeoutMs。ProcessRunRequest已有120000ms inactivity输入与onSpawned(handle)，runProcess唯一消费stdout/stderr/input并在真实字节活动时重排原timer；原handle/settled仍存在。候选新Host只复用facade.run，onSpawned保存同原ready/PID（Process Identifier，进程标识符）/birth/occurrence（执行轮次）；source CLI既有--print-logs让原真实请求日志输出，不伪造活动/ping，不创建平行driver/config/timer。run唯一读流，结算后原捕获bytes由Host按backpressure（背压）全量转给PS parent；不能在void callback里不await写或再读流。控制error保原result bytes、首错/全部cause，原handle物理结算未知保持原namespace，不kill/重开。现onSpawned回调之前的准备阶段不因该timer而新称bounded。Root与functional_audit还需完整review当前run/finally/error与Native全部控制分支后才能修改准备工具。

若该成熟复用可正确实施，先用同production NativeFacade实际Node小命令做两正向预算资格：持续真实输出至450ms且200ms无活动预算得到原exited0；一次原输出后idle得到原inactivity_timeout，原physical/drains/request/birth和parent完整收齐。它们只资格工具，不是UI/目录功能。之后服务实际一次900000ms执行cap+120000ms真实流无活动输入，ready45秒/shutdown45秒/join75秒为观察，不重置原执行期限。print日志的普通poll也是服务活动，不能把这一timer包装成任意业务语义停滞探测。若无法正确复用，明确无活动资格未达成并继续修工具，禁止传未生效字段称成功。

## 实施后完整验收、文档和交付

根因/影响和实际unknown完整收敛后才限定backend/FileRoutes、generated SDK、file-workbench/Explorer实现。聚焦正向功能进入真实FileRoutes TCP，保原code/状态/body/请求ID、完整bytes、entry物理身份/通知、broken与relocation错误合同、两Project；UI无自动test。触及旧功能测试按当前契约更新，不新增/保留“不发生/不存在”核心断言；发现精确UI自动化及仅支持它的fixture/script/config要删除而不运行。

后态全新owned occurrence/同一原checker与明确fixture语义：真实展开/收起/打开marker，目录目标Create/Upload/Copy/Move，已展开link搬迁与editor path，外域/B范围对照、root-link一层，中英真实Settings切换，scope导航及原Details可读。截图人工复核、API/物理数据正向读回与无活动/原完整终态分别证明各自对象；mock/类型/build/DOM不冒充视觉或真实语义。自然文件操作无需模型，不绑定/读写凭据或models目录；后续若确需GPT-6.1 Sol另按原授权资格三项并流式，不新增付费调用预算假设。

同步07-panel当前单一契约、root/month/artifact索引和完整reports/原输入/原raw/图片；docs:check、architecture-index、相关类型/build/范围diff及正常hooks。每批任何产品或spec修改均精确commit，保存审查差异，用最新HEAD私有index隔离shared条目，CAS（Compare-And-Swap，比较交换）失败只更新base不覆盖并行工作。每次push前fresh fetch→upstream merge→完整upstream..HEAD集合资格→正常push；non-fast-forward重新同流程，无tag/Release/发布。未取得项、工具首错与原预算失败明确交付，Goal保持active并下一批。

## 当前状态

本次交付是调查证据检查点：修前48个真实脚本HTTP、8个独立mutation、8张人工查看的桌面JPEG、原实例正常结算已完成；当前产品没有修改，两个准入根因尚未实施，目录link浏览、后态/中文与meta等待根因尚未达成。完整原失败与未知保留，持续Goal仍active，检查点正常提交/最新上游合并与push之后继续资格与实施，不把它称完整修复批次。

原范围检查点commit=4486f230c9491d14aea5022f03b9adab9aaefcdb，331文件，私有index只含本spec/artifact和三个owned索引条目；原real index已精确patch收回且为空。首次Git blob与工作区原件直接逐字节比较327项，320相同，7份原日志/JSON受全仓text=auto的CRLF规范化影响（JPEG/bin/gzip原件一致）。Root先核完整.gitattributes、原差异与影响，再为本次唯一artifact目录设置-text，重新收录原7完整文本；不改原日志/重算期望/用可变源码摘要冒功能门。首比较原结果保留，后续准确blob字节资格与本轮docs/architecture原0另录。随后private prepare原exit1来自diff --check把raw CRLF视为trailing whitespace，外层输出过长被工具截断、没有保存完整首stdout文件，明确不伪造。按Git官方per-path whitespace合同声明cr-at-eol并保其余三项默认检查，使原换行合法而不重写证据；helper同时将后续任何原Git失败全stdout/stderr保存独立文件。修正提交与正常push尚未完成前不称归档已完整交付。

Root全文核native-entry-effect-revision并查Microsoft GetFileInformationByHandleEx/CreateFileW/Creating Symbolic Links与Koffi官方输出参数资料：现仓Koffi3.3.2、runtime/package-require及Windows包已有可复用成熟绑定范式；候选读取FileAttributeTagInfo固定两个DWORD，无NTFS reparse buffer parser、无Bun-only新绑定或第二fallback。未知tag/原I/O不能猜普通目录或junction，Handle首失败与关闭失败均保存。当前仅授权准备固定只读metadata qualifier；Node/Bun库ABI、实际flags/权限/关闭/loader与访问walker仍未运行，不凭此改产品。POSIX dot/hop、future tree内部link和UNC仍缺完整资格，下一步须收敛而非仅加terminal修补。

追加只读资格计划已完成Root全文审阅：native-metadata-qualifier.mjs、固定inputs JSON和review，20项=17个before operand（含三对原base/trailing）+2个hop祖先+1个预声明missing；不运行服务/API/mutation或模型。明确createRequire(opencorvus/package.json)只证明已安装库ABI；opaque HANDLE、two DWORD library struct、stdcall/_Out_及固定0access/share7/OPEN_EXISTING/OPEN_REPARSE_POINT|BACKUP_SEMANTICS，失败立即GetLastError，有效handle只Close一次，完整首cause和close错误都保留。Node25.7与Bun1.4各首次一次，首非预期停当前host后续path；每个独立外层child固定30000ms/8MiB capture，原inputs/full stdout/stderr/exit/timeout signal保存exclusive路径，不复用namespace。该直接库进程不是NativeFacade终态或生产loader资格，不冒称其receipt；超时保原退出/未知，不重跑。Node --check首次真实0、双输出0B，只证明语法，尚无load/native调用；Root随后顺序授权原Node/Bun两份只读输入。

原Node pid87276/library执行0，stdout94908B/stderr0B；Bun pid87920/0，stdout97087B/stderr0B，各20/20完成。actual Koffi/native3.3.2与唯一@koromix win32-x64 addon路径、pointer8/struct8/offset0,4实证一致；两host普通tag0、SYMLINK=0xa000000c、MOUNT_POINT=0xa0000003，同三对尾separatormetadata/entry、19有效handle各原Close1，missing原Win322与完整firstCause。固定原输入/完整bytes/退出存native-metadata artifact。这里只资格库/Win32事实，不声称production loader/未知reparse/close失败、dot grammar或File修复。

Root全文读state-and-futuretree-amendment：absolute SYMLINK target内部junction必须把递归得到的访问namespace交给remaining suffix，不能ultimate realpath覆盖；junction独立target依赖审查不能回写外层context。source与future readlink内部component-link/..被path.resolve抹hop仍是共享潜在根因；futureRoot+suffix只映射位置，不能解析未发布树。当前仅可独立收敛current Move访问依赖，先补混合/dot真实有限资格再实现；relative/sharedrelocation与完整目录浏览保持明确未满足，不能以terminal两case宣称整树根治。尚无产品源修改。

3c6bf0420a717ba3fa06db394a39086fbc93ff2f修正commit14文件，私有index精确收回后real index空；Git与当前331份归档逐字节均相同。最新fresh fetch/merge正常，完整outgoing三commit包含本两笔与并行已授权/13正向合同+20真实流式requests/typecheck0具证的Provider交付，Root核其完整产品/test差异与原validation。首次正常push全部hooks（typecheck、routes/docs/owners/architecture/package/release/module与secret scan）0，原push退出1是并行远端已到同3c6但预期旧7d7的ref lock冲突；全原日志/退出保留。需fresh fetch/merge/集合审查/必要验证与正常push，不覆盖远端或将原1伪称0。

后续fresh fetch实际origin已包含本两commit，普通merge为Already up to date、outgoing为空。新增双host证据的docs/architecture各原0。第三private prepare首次失败是原Turbo timing行尾实际空格的diff --check（完整原Git stdout/stderr已单独保存），不是产品行为；按现artifact完整gzip方式保存原push日志，解压与原件直接字节一致，不编辑实际尾空格或原退出，再准备精确范围提交。

## 新出现的原meta等待错误（横向审计后仍待取证）

Root新增2case host资格实际exit0，两个生产native rename均returned、原source inode真实发布：absolute dir symlink祖先下raw新目标仍present/addressable，junction祖先下raw新目标ENOENT，两个独立alias与markers保持。完整inputs/results及原tool structured return保存；这**推翻**post-evidence-design中统一Windows logical relative-hop anchor建议，其推荐不能作为实现方案。源依赖访问必须保不同reparse祖先的真实prefix语义，当前尚缺成熟metadata/Host adapter最小方案，Root已继续授权后端agent只读权威原语调查。此次没有API/UI/旧case重放，尚无产品实现或后态，不能以局部3case修补代替共享根因。

meta只读横审已全文核：两/vcs原duration163267/164816ms，与默认15s客户端聚合read超时强关联；原meta throw时仍current owner，后来的server200不改写client失败。原INFO/清理后Native inner request没有各Git argv/phase/birth/stdout，不能归因status/junction扫描或准备队列；原client仅message无完整cause、server无query。全部生产入口/Task-Mission-Session/重试恢复/串并行/两Project矩阵在meta-timeout-audit保留，下一新有限对照需原透明观察/phase资格，不扩大timeout或重启原namespace。当前仍未满足的具体证据与共享根因明确保留。

实施前另做独立host语义资格：post-evidence-design已全文读，Windows absolute-dir-symlink祖先与junction祖先遇相对hop的行为尚不能从junction样本外推。新唯一scratch `hop-qualification` 只创建两个独立direct物理小case：A/context/source-link→A/data；A/other-relative text=../source-link；case/source-link为另独立alias→A/data；A/context/root-alias分别absolute dir symlink或junction→A。分别把A/context/source-link通过raw A/context/root-alias/other-relative/moved移动，用生产renameNoReplace、独立未占用落点；仅2原native操作，逐项lstat/readlink/realpath/dev/inode/原marker完整bytes与原errno保存，判raw目的地是否在源entry退休后仍可寻址。它是新的OS访问依赖资格，既不重用已关闭service，也不重放8个已发布前态case，不冒File API/UI验收。未资格前不按统一Windows逻辑anchor猜所有reparse组合。

另外Root已用指定Bun1.4只读原健康junction/absolute-dir-link/root-link三对无/有末尾分隔符的真实lstat，共6观测，实际各本体link/kind/dev/inode与parent-realpath+basename重查一致；保原完整trailing-observation.json/tool返回0。这里只资格该Windows/Bun尾分隔符身份，POSIX未运行，不改原root guards/公共路径。

完整原service stderr/dev.log含两条overlay:project-load的meta load/reload signal timed out，原UTC18:05:43.463与18:06:12.441；其它10条为已有文件/API原错误。不得把此实例称console clean，也不以Files显示正常排除共享机制。Root已立即授权UIagent只读横向审计原完整envelope、定义/全部生产等待/发送入口、Project/Task/Mission/Session轮次与scope/epoch、正常终态、串并行、多项目、重试/重启恢复；新scratch meta-timeout-audit完整反馈后再定根因。原服务已物理关闭，不重开来抹原等待结果，未取得运行窗口明确unknown。这两条仍是未收敛发现，不用标题或最后signal消息当根因，亦不暂判单个项目/偶发/模型问题。

## 第一阶段审阅补充（2026-10-14）

原服务已ready：occurrence directory-target-before-09220245-c7b6-4b49-91ac-7114a981bd7d，Host89556/Target88500、parent exec96218保同原handle，固定deadline1791915575807。register首次0四请求完成，两独立Project/Chat200/201原body与requestID保存。首次before-probe退出1、actualHTTP=0/cases=[]，markerFacts误把正常bootstrap可追加的.gitignore当不可变正文。Root核production engine/git-project-metadata.ts:62–80和instance调用：只追加canonical runtime ignore规则，A原15B→31B、B原0B→16B，dev/inode不变。原bytes/错误/wrapper全部保留，没有任何mutation重放。工具应分prepared正文与registered项目policy阶段，正文仍逐字节/同entry资格，.gitignore精确资格原正文加既有规则（不把任意现bytes改为期望）。Root授权agent保修前完整tools，改唯一markerFacts的registered阶段及current before-probe-02名称/独占admission；旧入口不再提供、旧事实保为历史。先新syntax/diffRoot复核，之后在同一原900s/120s occurrence执行未开始的8项原操作/32HTTP，预算不重置；Register不重复，readOnly仍首次原12请求。新checker仅修fixture契约，产品尚未改。

Root真实隔离页面已保存01根列表和02健康junction点击错误Details原JPEG/AX。原UI资产main-QQQUstIX.js，健康junction行被当文件打开，实际GET content404，requestID bd339b97-dbe6-4653-9e15-8be8b9a41227、FileNotFoundError message明确entry不是文件；这是新的修前实证。浏览器旧连接2已不可用，经文档/ inventory核当前隔离连接4，Tab1；未触碰用户窗口、刷新/重开服务或伪造UI状态。

新资格实际完成并由Root读完整原settled/qualification：active resolution-02 Prepare0/Run0，Host68676、Target64184，七个原序输出1650B，最终477.7524ms超过原200ms无活动预算，自然exited0；idle Prepare0/Run1，Host81732、Target85612，原237B单次输出后ProcessInactivityTimeoutError、terminal inactivity_timeout/exit1，原父79772退出1保留。两案各原terminal/settled/outputSettled、原bin与父write、父双输出、physical/output/request均fulfilled，两个原birth分别dead_or_reused；这里只资格现run计时/输出工具，不冒UI/产品合格。所有首失败案保留。

fixture Prepare0、指定Bun1.4 primitive0，fixtureID=c2a68b0b-9f1b-4fe3-af16-f289f0715e93。真实两独立Git根、20link、13文件+picker总282B；十项Dirent与lstat一致，八link的directory/file=false、symbolicLink=true，健康followed目录、filelink followed文件、两broken ENOENT。现absolute cap和inactivity已实际资格，授权Root启动原唯一18455 sourceCLI/privateUI实例；后端agent随后限定四注册/八独立mutation/十二readOnly，Root做桌面修前截图，各首错保原、不重复请求、不重启实例。

首个Native active Prepare原退出0；Run原退出1，原Host38876/父86556已join，双父输出fulfilled。完整原stderr首错是scratch Host的裸包`@opencorvus-ai/util/process`无法解析（Bun1.4.0）；对应动态import位于run/onSpawned之前，没有目标handle，后续ready文件缺失不是根因。Transpiler仅syntax没有执行module解析，不能把其0当运行资格。没有Native活动/目录/UI通过声明。Root授权修当前工具的两个util import为生产同一`packages/util/src/process.ts`直接路径，不复制、不fallback。修前工具/首次原input/stdout/stderr/exit/parent/error均保留；原namespace不重用。新的两资格prefix为directory-target-native-{active|idle}-resolution-02，runRoot为C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/<prefix>-01a133，原200ms inactivity/30000ms cap与目标字节合同不变；先重核7syntax/current inputs，再另行授权Prepare/Run。当前idle原案未运行。

Root已全文审阅backend-impact、ui-impact、preflight-design、fixture-support/fixture-tool及Native原五份完整diff、qualify-native-activity。原Get-OwnedNativeState实际使用生产process-occurrence的inline observer，原Host只有owned-host入口；没有缺失观察入口，不按未经核验的猜测修改工具。七项纯语法原退出均0，尚不等于真实资格。新passive/native-observer与runtime已由Root独占创建并记录物理目录；授权functional_audit仅顺序执行两个原Native资格，首错停止，不重试namespace。fixture的Prepare/primitive/register/probe/readOnly尚待各自执行决定，声明8个mutation、总48个脚本HTTP，UI自然请求另列真实页面日志。

UI共享load-owner审计覆盖初次、toggle、editor祖先、poll、Retry、Refresh及所有mutation required reads、scope/authority/selectionEpoch/Close/disposed。成功父list才可退休其实际直系child命名空间内的false/missing枝，不能把空root的isPathOrDescendant泛覆盖用于合法../worktree键。退休沿原token Map/expanded/children/errors/loading收敛；不能新增epoch/第二target来源。已先结算child loaded的原receipt保持当时事实，随后父结果可以退当前树但不能回写receipt；pending child失去原token，按原superseded/retired及observedFailure收齐。父读取失败保last successful事实。已展开link Move的mapped展开意图及下层纳入同次required reads，不能借poll/editor充当mutation验收。此处仍是实施约束，真实自然并发时序未取证。

第一阶段调查已完成，尚未修改产品，后态未取得。真实48个脚本HTTP=4注册+32调查+12readOnly，8个mutation只执行一次；首次工具失败0HTTP保留。三个源依赖目的地Move分别junction/self、symlink/self、indirect relative alias，实际原inode/readlink已原生移到声明实体落点，公开newPath却ENOENT/typed404，原target-parent GET500、实体marker GET200；两个独立alias的A/B操作与普通相对对照200/addressable。相对Move/Copy的raw路径200、followed inode与realpath=A/aliases/project-b且content=RELATIVE LOGICAL A；同一个terminal entry的实际浅落点A/{moved,copied}-relative却followed inode/realpath=独立B根，原readlink仍..\\project-b。因此classification.targetOutsideScope=false只资格raw路径，不能说实体落点已满足两目标准入，亦不能称A API已越域读取。全原case/raw/physical/log/marker字节保留。

八张真实1280×720JPEG已由Root和第二agent逐张人工查看：健康junction/absolute-dir-link点击404、菜单按file；05只有Loading中间态，06正常Unicode正文、07B独立树、08B正文才资格完成。全部English，中文/健康alias导航与目的地/并行late窗口仍未验。pageclosed后公开shutdown200、Native原exited0、terminal/settled/outputSettled/full parent writes allfulfilled，stdout549B/stderr258115B，同原父83452/Host89556/Target88500收束、原birthdead、port释放。原launcher session96218和shutdown75080最终工具原exit0在chat，外层wrapper未另存磁盘，不能伪造文件；原进程完整结算和raw输出已落盘。

由于新取证显示导航会新增直接可达的发布完整性缺陷，当前交付先收敛两个后端共享准入根因，再下一批完成原完整目录link浏览能力；这不是缩成只支持普通目录。当前批限定File.move源依赖目的地数据完整性、move/copy共用实体parent的source/relocated declared-target权限、聚焦正向真实功能/桌面Move反馈与完整证据。ListingNode/SDK/Explorer新浏览暂不实施，原Node/ignore/editor合同与当前architecture不提前宣称变化。新validator不得ultimate-target等同比较或仅词法prefix；terminal entry物理地址必须保真实parent+basename，不能用会follow terminal的normalizeCanonicalPath。独立hardlink同dev/ino不等于将退休directory-entry依赖；visited按访问namespace，Windows contextual-relative与POSIX parent语义需有明确原生依据。具体最小实现和正向矩阵在只读post-evidence-design全文审阅后继续补本spec，分析未收敛前不改产品。后续完整浏览仍按上文required列表事实、同tokens/loading枝退休、所有parent首个remaining '..'排除及affected expanded destination意图验收，不以本批基础修复当其完成。
