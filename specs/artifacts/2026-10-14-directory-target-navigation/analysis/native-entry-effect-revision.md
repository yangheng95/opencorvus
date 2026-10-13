# Native entry metadata 修正：不能统一 Windows logical anchor

## Recall、当前决定与范围

Root 当前任务仅后端基础：修已取证的 source-dependent Move 发布404、实体相对relocation准入。目录链接完整UI（User Interface，用户界面）浏览延期后批；本报告不推进ListingNode/SDK（Software Development Kit，软件开发工具包）/Explorer实现。用户持续迭代要求、先完整分析/正式spec/正向真实功能/真实页面证据/正常交付仍由Root负责。

本子任务授权仅只读方案修正及scratch报告：不改任何产品、工具、正式spec/测试/Git，不运行新实例/API（Application Programming Interface，应用程序接口）/Native metadata实验/模型/进程，不再次委托。已读取Root新原 `hop-qualification-{inputs,results}.json`、`hop-qualification.ts`、六项 `trailing-observation.json`；全仓再次检索Win32文件metadata、FFI（Foreign Function Interface，外部函数接口）、Koffi、Host加载/构建和当前架构。

**撤回前建议**：`post-evidence-design.md` C段“Windows仅按logical dirname展开relative hop”的单平台分支不正确。那个建议明确列了未验absolute symlink ancestor风险，但未验不是继续实施它的理由；现在已经反证，必须替换。原完整报告独占保存 `post-evidence-design.before-native-entry.md`，当前报告首页明确本修正；不可同时保留两个可执行路径。

保留仍成立的对象区分：source退休entry用实际parent＋basename与lstat身份，不用ultimate target或裸inode；move当前访问链依赖与sharedrelocation未来实体声明是两个不同验证对象。既有Node.type=entry、publicpath/readlink、两个权限root、native noReplace、copy verbatim/strict checker不改。

## 新原证据及此前错误推荐会造成什么

Root两个独立owned小fixture是实际指定Bun1.4.0和生产 `util/rename-no-replace.ts` 调用，不是File API、UI或tag metadata资格；我没有运行它们。原工具最多2次Native Move，两个marker完整字节相等、原namespace不重用。

```text
case/project = A
A/context/source-link -> A/data               即将退休source，真dir symlink
case/source-link -> A/data                    同target的独立真dir symlink
A/other-relative text ../source-link
A/context/root-alias -> A                    仅祖先kind不同：dir symlink / junction
newPath = A/context/root-alias/other-relative/moved
实体 destination = A/data/moved
```

| 原实际case | 原source dev/inode | 唯一native结果 | 原raw newPath | 实体destination |
| --- | --- | --- | --- | --- |
| absolute dir symlink祖先 | 3260155833 / 1970324841487153 | returned | present，同source inode/readlink；parent仍可到达 | present，同source inode |
| absolute junction祖先 | 3260155833 / 1970324841487162 | returned | ENOENT | present，同source inode/readlink |

dir祖先遇真正absolute symbolic link时，访问prefix先被目标A替换；接着other-relative的`../source-link`到达case/source-link独立entry，搬A/context/source-link不破坏它。junction祖先保留指定访问context；relative替换落到A/context/source-link，source退休后访问链失效。两个最终目标都A/data，ultimate equality完全不能回答依赖；所有terminal lstat/readlink谓词也不能区分祖先kind。

因此旧单Winlogical方案会把dir祖先正确可寻址的Move也判source-dependent，错误400。这是影响现正常合法行为的阻断；不得以“Windows特殊”忽略、按fixture命名猜kind、只加case名分支、或查ultimate目标相等替依赖。

Root另六项只读trailing事实：Bun1.4 `junction-dir`、`absolute-dir-link`、`root-link`各原path与末尾`\\`的lstat，都link=true/directory=false、同dev/inode；构造actual parent+basename的地址亦同entry。它们只资格该宿主这三实际operand，不证明所有host/slash或Win32 OPEN_REPARSE_POINT末尾slash行为。不会以去尾后不同操作节点冒称原lstat观察。

## 官方可获得的真实native事实

[Microsoft GetFileInformationByHandleEx](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-getfileinformationbyhandleex)的FileAttributeTagInfo(9)返回[FILE_ATTRIBUTE_TAG_INFO](https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_attribute_tag_info)：固定两个DWORD（FileAttributes/ReparseTag）。它是公开Win32 metadata，不是读取/解析NTFS（New Technology File System，Windows文件系统）reparse buffer。

[Microsoft Reparse Point Tags](https://learn.microsoft.com/en-us/windows/win32/fileio/reparse-point-tags)定义tag为系统类型事实；[MS-FSCC Reparse Tags](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-fscc/c8e77b37-3909-4fe6-a4ea-2b9d423b1ee4)给MOUNT_POINT=0xA0000003、SYMLINK=0xA000000C。应比较实际读取的完整tag，不按目录名、readlink文本拼写、stat.isDirectory或仅某一高bit猜junction。name-surrogate bit有官方语义，但它不足以细分这两个行为；未知path-changing tag必须保留未知，不默认任何分支。

[Microsoft Creating Symbolic Links](https://learn.microsoft.com/en-us/windows/win32/fileio/creating-symbolic-links)说明真正absolute symbolic link替换此前prefix，relative symbolic link替换其所在指定path分量并处理dot；本次实际dir祖先对照正好证明该差别。junction retaining-context的关键行为由新旧原native样本证明，不把“拥有MOUNT_POINT这个标签名字”本身当完整解析证明。

[Microsoft CreateFileW](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew)允许OPEN_EXISTING(3)、FILE_FLAG_OPEN_REPARSE_POINT(0x00200000)读本体、FILE_FLAG_BACKUP_SEMANTICS(0x02000000)取得directory handle；零desired access允许查询一些metadata，share READ|WRITE|DELETE(7)避免人为保留排他访问。仅打开既有metadata，不创建/截断、不调整token权限、不加DELETE_ON_CLOSE。失败立即读取原GetLastError；本次未实测这些API/flags组合，不能先宣称已经够权限或适配成功。

另一官方入口FindFirstFile/FindClose通过WIN32_FIND_DATA.dwReserved0取得tag，但它有路径/wildcard/末尾slash/枚举handle语义。当前建议选FileAttributeTagInfo一条owner；不增加FindFirstFile失败后备用、PowerShell LinkType探针或GetAttributes位猜测。FileAttributes只有REPARSE_POINT位不足以区分kind。

FileAttributeTagInfo仅给kind，不给SYMLINK_FLAG_RELATIVE payload。readlink仍交成熟fs.promises.readlink，Windows官方current-drive relative输入创建时转absolute；绝对/相对target的判定复用成熟node:path及当前native返回文字，不另写NTFS offset/flag parser。非标准/无法确定namespace仍未知，不能用一个Windows-prefix正则把任意payload当支持的target。

## 全仓成熟Host路径：Koffi，不能新增Bun-only通道

找到且已读的唯一合适先例：

- `packages/opencorvus/package.json:129`已直接pin Koffi3.3.2；实际本仓安装的 `node_modules/.bun/koffi@3.3.2/node_modules/koffi/package.json`声明Node-API（Node.js API，原生扩展接口）8、Node16基线，Win32 x64/arm64预构建依赖。不能误用并存2.16.3或全局包。
- `src/mcp/computer/windows-dpi.ts:40–58`用现 `requireRuntimePackage("koffi")`、kernel32.dll、typed stdcall函数、GetLastError，模块保原nativelibrary/function lifetime。这是Host绑定范式，不是可直接调用的文件metadata能力。不得import/触发prepareComputerHostDpi来读文件：它会更改进程DPI（Dots Per Inch，每英寸点数）状态，与本能力无关。
- `src/runtime/package-require.ts`已有source/packaged唯一加载规则；`script/build-artifact.ts:50–63/150–167`将Koffi外置，Windows runtime明确带koffi与`@koromix/koffi-win32-${arch}`。复用该加载/包owner，不复制nativeAddon、不加配置或从工作区parent node_modules偷偷兼容加载。
- 裸Node executable旁没有package.json时现runtimePackageRequireForExecPath会明确失败，这是已有加载合同；不能为了新测试加Node/Bun名字fallback。独立library ABI（Application Binary Interface，应用二进制接口）资格可合法显式createRequire当前已安装package做C函数读取，但只能声明library/host资格，不冒称packaged loader或File API验收。最终packaged Node Host应使用其真实成熟部署路径。
- `src/util/filesystem.ts`已是File的现单一FS（File System，文件系统）primitive；`util/rename-no-replace.ts`和process-occurrence有现Bun:ffi绑定，但没有entry reparse-kind public reader。不能复制它们形成Bun-only的通用依赖validator。
- 已检索全部 `GetFileInformationByHandleEx/FileAttributeTagInfo/GetFinalPathNameByHandle/REPARSE_TAG/OPEN_REPARSE_POINT/koffi`，当前没有成熟entry tag helper可直接调用。architecture Host adapter是能力与宿主实现的分层，不授权把Files改挂Computer runtime或新增sidecar/process/模型工具。

最小方向是在现Filesystem层增加一个宿主无关的**entry traversal metadata**合同，Windows adapter用已部署Koffi的公开Win32 metadata；POSIX（Portable Operating System Interface，可移植操作系统接口）adapter沿成熟fs.lstat/readlink。具体代码实现可在现util一个独立Windows私有模块，但只有一个当前公共primitive，不暴露DLL/tag/宿主包给API或Node DTO（Data Transfer Object，数据传输对象）。

候选结果表达的是`symbolic`/`mount-point`/ordinary或显式unsupported facts，给validator决定namespace effect；不是“名字含junction”的产品逻辑，不给模型门。实际unknown tag/nativefailure始终throw，不能返回symbolic/defaultmount。普通Node.type、ignored hint仍由现entry producer，不由tag重建。

Koffi官方是Node.js FFI，已安装文档明确stdcall/UTF-16/struct支持；当前没有找到官方保证“该API已Bun1.4验证”的文档。Bun Node-API兼容和现DPI源码只能支持候选，不能代替实际资格。因此下一准入必须分别记录确切Bun/Node executable、实际Koffi/native addon加载路径/版本与原metadata输出，不能声称跨宿主已通过。构建已包含包也不是实际DLL调用/关闭handle证明。

## 修正后的单一依赖验证方向

源entry address与lstat仍按前报告A/B成立：parent真实地址＋basename、纯namespace/case key、不followterminal。**绝不可用**canonicalPath/normalizeCanonicalPath/Filesystem.normalizePath作为key，它们会再次followterminal，误把source与other的同D当同entry。不同hardlink同inode地址不同，不被退休。

validator仍只Move，先原path/root/parent、existing-target conflict，再新依赖验证、sharedrelocation、唯一native rename；copy不退休source，不调用它。private guard的BigInt lstat snapshot可复用；root保护/普通source/missing/authority顺序不变。

状态需要表示**当前实际访问namespace与其剩余suffix**，不能只把original targetParent每个prefix永远放在原名字下检查。按prefix观测entry身份、取得实际link kind和原readlink后：

1. 先比较当前访问到的entry地址及原lstat身份；命中将退休source exact directory-entry时才构成400 witness。不能先follow那个entry，再由targetD作判断。
2. 真symbolic + absolute target：记录这个已遇到link的依赖，按官方语义替换此前prefix为absolute target、拼原未消费suffix，继续检查改写后的当前namespace。Root dir祖先因此重置到A，other-relative到case/source-link独立entry；不能再扫描已被替换而实际不会经过的A/context/source-link并错误拒绝。
3. 真symbolic + relative target：替换当前访问namespace中的该component，保相应parent及未消费suffix；Windows按当前已由此前真absolute symlink更新的context处理dot，junction没有替换的context仍保留。POSIX relative以实际containing parent处理。single typed规则基于nativekind＋target性质，而不是失败后尝试另一坐标。
4. mount-point/junction：验证其declared target中的entry/hop依赖以覆盖“junction自身target经source才能到达”的间接链，但保留当前对外访问context与剩余suffix继续逐prefix。该dependency分支检查一个真实挂载target，不是替代rename路径或第二坐标fallback。原metadata/GetTag命中MOUNT_POINT以及实际context资格是这条分支的事实来源。
5. 完整visited/active状态须含当前namespace＋未消费suffix，不能按裸inode/ultimateD去重。root-link finite重复不等于cycle。真实循环或unknown namespace保持原ELOOP/明确观察error，不能解释成independent/允许或猜source-dependent400。

这个有限walk的输出只为source-retirement依赖witness/成功完成当前观测，不产生resolved source/target给rename，不重写API/publicNode/readlink，不创建general custom Windows filesystem resolver。node:path只做官方需要的root/分量拼接，源/target终态仍由成熟OS rename与原entry producer决定。

如果实现发展成自行解析NTFS reparse buffer、每遇不支持就用ultimate path绕过去或并行计算两种anchor取一个成功，应停止该实现并回正式Root方案，而不是把它包装dependencyvalidator。新的两case证明纯lstat/readlink缺必要kind事实，但没有授权重建完整NTFS path resolver。

现matrix的明确正确结果是：原三个J/S-self/relative dependent400、independent A/B同D200；新absolute true-dir祖先合法200/addressable，新junction祖先准确400/source保真。native两个case本身不是File API状态资格；未来TCP（Transmission Control Protocol，传输控制协议）测试必须在两个合法scope布局重建这两个实际关系，不能覆写Instance或引用case名伪造行为。

## metadata adapter须审的完整I/O（Input/Output，输入输出）与生命周期边界

新增事实读取有实际影响，不能只审tag常量：

- native绑定使用现Koffi stdcall/UTF-16定义，FILE_ATTRIBUTE_TAG_INFO两个uint32由官方layout/库struct表示；不是长度offset NTFS payload parser。Pointer/INVALID_HANDLE_VALUE、x64/arm64、DWORD尺寸、out参数都需实际资格。不试到碰巧运行的prototype后掩盖原first failure。
- OPEN_EXISTING、OPEN_REPARSE_POINT确保terminal本体；directory flag必要，share7、无继承/无写权限/无创建。零access候选最小，但GetInfo实际ACL（Access Control List，访问控制列表）资格仍未知；不能nativeEACCES就当普通link放行。末尾separator准确operand与tag结果需另验，不拿6个Bun lstat等同native handle已资格。
- 同步函数失败立即读取GetLastError、保operation/raw win32 code；CloseHandle在finally，原失败和关闭失败都保 cause，不能Close覆盖第一次错误。不要跨异步worker后在另一线程读取GetLastError，也不要加背景队列/额外进程。DLL function/library按现Host lifetime保持，不跨请求缓存entry/tag事实。
- 原lstat/readlink与native metadata不是原子一项读取。建议前后lstat精确identity复核同entry并保rawtag，身份改变不可当确认依赖/独立；仍不承诺外部并发retarget与rename原子绑定。读metadata的native handle不是把目的父目录固定为rename-ownedhandle。
- knownmissing source仍404、target parent失效仍现400；unknownwin32/I/O/unsupported kind500与真实requestID/原cause，不加新的公开message流水或500→false。因为这个metadata是在publish之前，失败应让原source保持实际可寻址事实。
- 若只向现lstat.isSymbolicLink的prefix查询tag，它覆盖当前symlink/junction两样本；其它reparse/provider可能被fs投影成普通entry，这一范围不能被误称全部Windows reparse已验证。要声称完整prefix效果，需adapter依据真实FileAttributes/tag识别当前ordinary与name-changingreparse；不能未知tag直接走ordinary。是否接受官方non-name-surrogate作为无namespace替换的合同需正式明确，不能隐含默认，且不得不加说明地让云目录等合法路径全500。
- 额外prefix metadata读取会增加I/O/可能同步阻塞，尤其网络卷/驱动；此处没有实现额外超时driver/增负载/并行fallback。当前原fs准入也不保证外部namespace原子快照；新API长期remote行为未知须保，不能声称local两个case覆盖UNC（Universal Naming Convention，通用命名约定）/SMB（Server Message Block，服务器消息块）/ReFS。

## shared relocation保持实体parent方案，不和namespace walker混合

它的对象是**本体声明**，所以故意独立于上面的当前访问namespace。仍只改唯一assertRelocatedSymlinkTargetsAllowed sourceTarget和futureTarget计算：实际source parent realpath＋原text；一次真实top destination parent realpath＋basename/suffix建立future普通tree位置，其relative text按未来实体parent解释。未来nested parent不存在不能realpath整个未来link，也不能rewrite原text/只做terminal两个case。

原relative Move/Copy经junction root-back的raw入口在A而实体浅entry可指B；未来实体声明出两root则准确现relocation400，原A/B/source/逻辑control全bytes保真。nativekind新的validator不会把这个实体权限修正改回raw合法fallback。普通relative对照仍200，in-scope missing/broken合法entry，source外域保持现400；两Project/currentdirectory/worktree及unknown I/O沿原权威。

copy不走retirementguard，但走同sharedrelocation实体准入；verbatimSymlinks、原staged/full strict tree checker/noReplace/cleanup合同不变。真实目录move遇source exact ancestor400与terminal-link到相同D的合法Move仍区分。delete/create/upload/read/write和native其他catalog/registry/skill调用不扩。

生产调用/公共影响已核完整仍是上一报告链：FileRoutes sole Move/Copy → File helper → original notify/entry Node → file-workbench only success commits/Explorer only success required refresh。无需修改MoveResult/CopyResult/API request/schema或生成SDK；unknown500仍使用现server error owner。新的低层native metadata具独立模块/类型/打包/真实ABI检查面，不能假称“只需File加一行”或由纯build/types代替功能。

## 下一最小资格建议（仅计划，当前未执行）

正式Root先明确scope/adapter合同，再授权准备/运行，不复用原服务receipt。没有模型或凭据需求。

1. 一份透明只读 native metadata qualifier：exact owned qualifierID、Bun1.4与Node executable、actual current Koffi3.3.2 loader/nativeaddon路径、flags/API prototypes、所有调用原inputs/outputs/win32 cause/Close结果；对真实normal directory、true absolute/relative/file symlink、junction、broken symlink、Root new两 ancestor各输出actualtag与同lstatidentity。最多十余small reads，无native mutation/新UI/模型；所有original failure保原。不借sourcehash或fixture声明kind作成功门。
2. 若library/basic WinAPI资格通过，真实Node/Bun adapter角色加载/packaged dependencies分别验证；裸library ABI与productionFile path不能混为一个通过。当前Koffi package/installed文档无Bun专门保证，实际双host结果是必须证据。
3. 新真正TCP File合同在新owned小Project，核心新对照为dir ancestor200/identity/raw可寻址、junction ancestor400/source原identity/bytes。补原3dependent400、独立alias200/同inode不同entry正向、source别名/root及ordinarydirectory祖先、relative实体A→B move/copy400、nestedtree未来parent、knownmissing/循环准确errors；case数量/requests事前固定，不为失败无限重试或改fixture身份。
4. 本轮UI只需Root已有Files Move/错误/源保真与后态动作合同所需真实页；不宣称已实现目录target浏览。所有现node.type=file和无法展开的已知限制继续当前公开契约，后批独立落plan/UI/SDK。

当前新增unknown包括nativeGetTag实际flags/ABI/rights/CloseError、Bun/Node runtime loading、unknownreparse/provider/volume mount、source-link hardlink支持、网络/跨卷/外部race、POSIX `component-link/..`/Darwincase。新两nativecase正好解决旧未证祖先kind差异，不能当完成metadataadapter或所有caller验收。

建议Root最小正式决定：前report统一Windowsanchor撤回；保entry-address witness和shared实体relocation；新增现Filesystem层native **kind observation**，validator按实际SYMLINK absolute-prefix替换与MOUNT_POINT保context的完整访问状态验证source退休依赖，全部unknown原error。先真实metadata/Host资格后才产品实现，不引入NTFS parser、第二路径resolver或Bun-only能力。
