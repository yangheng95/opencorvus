# 访问状态与未来树：进一步只读复核

## Recall 与准确范围

Root 已完整读取前两个scratch报告，实际两nativecase反证统一Windowslogical anchor；functional_audit仅准备双host裸库metadata qualifier，尚未执行。本子任务继续只读review当前candidate walk和sharedrelocation的解析边界；不改产品/工具/测试/正式spec/Git，不启动/运行新fixture/实例/API（Application Programming Interface，应用程序接口）/模型/Native实验，不再次委托。仅新增此scratch报告和前报告明确修正入口。

当前批正式目标仅后端基础，UI（User Interface，用户界面）目录target能力延期。原8APIcase、2actualnativecase、6Bun lstat trailing facts各有不同资格，不能混为新的metadata/解析/整树通过。当前node kind、原logical路径/原readlink、两个authority root、copy strictchecker/native owner不变。

## 一、candidate walk必须有内部返回的访问namespace

“只做dependencyvalidator而不生成rename替代路径”不等于“内部递归不能返回访问状态”。后续relative解释需要知道此前absolute SYMLINK究竟替换成什么访问namespace，否则会再次错用original fullname或ultimate realpath。

建议状态表达三个明确对象：

- 当前已消费的**access namespace prefix**，保对这个host有意义的context；不是ultimate物理目录字符串。
- 原还未消费的component suffix；readlink展开得到的分量插到这份suffix前，不能先无条件path.resolve折掉dot。
- 该请求的active/completed访问状态与原entry witnesses；key包含当前namespace＋remaining，不用裸inode/targetD去重。

每一步源身份观察应是：先对候选component的实际parent做mature realpath、加该实际basename构造entry address；仅namespace/case/尾分隔符的pure key；再该操作path的lstat身份（BigInt dev/inode/kind），验证地址匹配将退休的source occurrence。可以先构地址再lstat，但**地址匹配单独不是命中**，必须原lstat事实一致；parent/entry未知I/O（Input/Output，输入输出）原throw，不能先followterminal再比较ultimateD。源/候选不同hardlink同inode地址不同仍独立。

逐component的所有前缀不能预先生成在原名字下然后永远逐个扫描；一旦actualSYMLINK改变namespace，后续prefix由新状态构造。仍保已遇到的那个link依赖witness；它是在实际访问链内，不因为绝对替换就抹掉它。

### actual SYMLINK展开

absolute target重置该访问prefix；relative target根据当前host访问语义/containing parent展开。target本身继续递归消费其raw readlink components，并返回**展开后的访问namespace**。然后消费原suffix，不能跳过target内部的junction/relative/absolute symlink，也不能用realpath(target)作为返回值覆盖访问context。

例如以下是状态设计示例，不是新增真实fixture：

```text
original .../S/r
S是actual absolute SYMLINK，text=B/J
J是actual MOUNT_POINT/junction，目标D
r是relative SYMLINK，text=../source
```

处理S时prefix重置到B/J；处理J后访问context应保B/J，原suffix r随后按此context解释。若直接mature realpath(B/J)→D覆盖状态，r被改成D/../source，可能错判独立/依赖。若B/J内部又有actual absolute SYMLINK→C，必须返回该后续已替换状态C供suffix解释，而不是freeze第一次S.text或original .../S。这正是single typed状态转换，不是双坐标fallback。

### actual MOUNT_POINT展开

保当前candidate访问context，继续其剩余suffix；另按真实declaredtarget检查挂载target访问到的entry/hop是否依赖将退休source，以覆盖mount-point指向source-link或其祖先的间接情况。这个target依赖分支结束后不把它的ultimate或展开返回namespace写回外层context；否则又把Root已实证junction行为变成symbolic行为。

所以“SYMLINK target里遇junction必须保返回namespace”与“junction target的依赖检查不覆盖外层namespace”不是矛盾：前者在SYMLINK所引入的新的访问路径里，后者是该mount-point另一个真实target的dependency证明。返回state仅供内部walker，不给Filesystem.renameNoReplace，不改变API Node的地址。

当前两actualnativecase的必要结果仍是：true-dir-symlink ancestor替prefix→独立case/source-link，合法200/addressable；junction祖先保context→退休A/context/source-link，准确400/source保持。Native metadata实际tag尚未读取，不能按case名字代替它。

## 二、dot处理不能由一个通用path.resolve负责

[Linux man-pages维护者的path_resolution(7)](https://man7.org/linux/man-pages/man7/path_resolution.7.html)描述逐component lookup：遇symlink先解析并用得到目录继续，`.`/`..`基于当时lookup位置，native出现missing/ENOTDIR/ELOOP分别错误。该主来源本次取得；此前Open Group链接403仍保事实。本子任务没有POSIX（Portable Operating System Interface，可移植操作系统接口）实机运行。

因此POSIX rawlinktext中的`link-component/..`不能提前按文字删除link-component；它可能先改变lookup目录，再取实际parent。在POSIX反斜杠是文件名字符，不照搬Windows separator/case规则。runtime API输入的path.join词法归约是仓库既有公开合同；**文件系统存储的readlink文字**不是用户的API path输入，不能把该归约合同套进去。

Windows官方Creating Symbolic Links规定absolute prefix替换与relative component替换/dot；Root实际两个case只证两ancestor kind下`../source-link`，没有证“readlink text里先含另一个link再含`..`”的全部顺序。raw components需要保到host指定的转换阶段；不能既凭POSIX经验统一逐步pop，也不能先无条件path.resolve所有Windows/所有host文本，随后冒称已验证所有被折掉的hops。

最低额外语义资格是原生target identity/readlink/完整不同marker的只读对照：relative text=`component-link/../target`，component-link带ordinary/actualsymbolic/junction差别；原logical sibling target和经link后的physical-parent target有不同实体/字节。Node/Bun都读同原输入，保实际syscall结果；这仅资格host语义，不是新File mutation/UI通过。没有本授权，当前不执行、不修改已准备metadata qualifier偷偷增加case。

source-retirement依赖若要证明`component-link`是否实际被访问，必须按已资格host转换顺序判断，不能因rawtext含这个名称就抛400。若host实际在某阶段消去分量，那个未经过的entry不是依赖witness；反之不能因文字折叠后没有source就放行。仍需完整访问state＋actualmetadata，不能用keyword/名字猜。

## 三、futuretree parent＋suffix不是一个target解析器

前报告公式：真实top targetParent＋basename/suffix建立future ordinarytree中每个link的位置。它是正确的**位置映射起点**，不是完整readlink target解析。对terminal text只是`../project-b`的两个已证case，mature actualparent足以得未来实体B，从而发布前400；这不能外推含内部links的全部tree。

当前 `assertRelocatedSymlinkTargetsAllowed:1222–1237`对source/future两端都path.resolve(parent,text)；即使把parent换成实体，它仍可能提前抹掉text中实际hops。源端也因此有同类风险，不能只改futureTarget一行。

以下是由Linux公开解析合同推导、**未实际运行**的最小风险示例；不拿它冒称Windows复现：

```text
R/project=A，R/project-b=B
A/tree/v 是absolute symbolic link -> A
A/tree/u 的原readlink = v/../project-b
```

逐component语义：v先到A，再`..`到R，末项project-b到独立B。path.resolve(A/tree,"v/../project-b")却直接得A/tree/project-b。v自身的declaredtarget=A是allowed；检查tree里每个link的已fold文本不自动修好u。未来把普通tree搬/复制到A/result后，绝对v.text仍A；实体futureParent＋同text若仍提前fold，仍会漏这条链。缺失in-scope折叠路径会被误当合法broken declaration，而实际target可能外域。

现File canonicalPath入口也path.resolve(input)；所以不能把未解析rawlinktext直接交isPathAllowed，再声称由现权限primitive补足hops。对一个已通过native确切解析的物理目标，现两root仍应是唯一membership authority；但对future尚未存在的tree地址，mature realpath(top parent)不能生成future内部links的实际目标。

source端存在的raw declaration可由mature native fs.realpath/依赖state观测其实际语义；knownmissing须按真实组件状态保scope资格，不能catch任意错→折叠路径。future端native目录/links不存在，不能直接realpath整串，也不能发一个当前Filesystem.exists假true或mock future stat。

## 四、若完整修sharedrelocation，须有限future projection或先明示延期

一个完整方向是：只对当前准备copy/move的**真实source tree**做有限位置投影，作为prepublication计算输入；不创建shadow物理目录、不复制用户文件来试、不发布第二Node、不增加缓存/队列。当前源entries、原readlink、actualtag/identity是单一原事实，futureRoot＋relative suffix是operation声明的位置。

在未来路径解析时：

- 访问落入future普通tree的组件，读取对应source实际entry metadata/text，按future位置和同一已资格host转换语义解释；不把source当前targetrealpath直接平移成futuretarget。
- 访问跳出futuretree，沿现真正外部filesystem原语；authority roots仍是当前Instance.directory/worktree这两个，不新增future root配置。
- absolute target不会因源entry将搬而自动改写；如果move使旧source namespace退休，未来lookup需明确旧namespace已退休/knownmissing，而copy保源。这里operation=move/copy是输入事实，不是fallback。source绝对指旧tree的link搬后可broken且仍in-scope，不能拿当前旧entry仍存在冒充future存在。
- projected lookup不是当前native lstat成功，不得给它生成public receipt或label actual；进入预测分支的path/对应原entry/位置/lookup结果必须可审。不是UI/测试mock，而是必要的未来声明计算；实现若被迫成为完整通用filesystem resolver或“双读当前与未来择成功”，应重新审正式scope，不仓促实现。
- 输入tree边界、ordinary directory/no-follow link规则与当前shared traversal一致；copy/move共用一个实现，没有terminal helper和tree helper并存的新事实源。
- knownmissing、future cycles、unknownnative provider/retarget、snapshot变化与权限membership需正式定合同。尤其future自引用会不会由旧合法entry200变成预测ELOOP500，是实质错误语义变化，不能仅因text等于new basename就新加gate，不能在未知中当允许。

这个投影仍需hostGrammar/metadata/两Project和nestedtree实际TCP（Transmission Control Protocol，传输控制协议）正向合同；一份17字节symbolic test或纯类型/build不证明它。当前没有成熟公开futuretree resolver可直接复用，没有新模型/工具建议改变这事实。

## 五、能安全分批的边界

### 可独立准备和资格

functional已准备的双host裸库native tag reader，按原固定输入资格true symbolic/mount/ordinary/knownmissing、exactclass、原flags/errors及handle关闭；source/package路径和模型none原事实保全。它只解决**kind observation**，不解决prefix grammar/dot/futuretree；不得把其0升级成File retirement修复已完成。Source/packaged Koffi加载和bare library ABI亦分对象。

### 第一产品根修范围可收窄为当前Move访问依赖

仅在metadata与混合SYMLINK/MOUNT namespace/dot转换已资格后，完整实现current-existing-destparent的退休依赖validator；保源entry地址/身份、existing authority/root/顺序、native noReplace/Node/独立alias。聚焦正向API证原3dependent400、两个新增祖先对照dir200/junction400、hardlink/普通dir/root/finite repeat/cycle等准确合同。

若选择这个明确范围，**sharedrelocation现有缺口仍未修**，原relative浅alias和futuretree问题须写已知未满足，不能把copy/move权限都修好或新目录浏览安全作为交付声明。不是保两实现：现sharedrelocation仍只有当前一条，下一正式批替换；没有旧/新权限fallback同时运行。不把“text含..就拒”作为所谓保守临时修复，也不提前启用UI新目录target能力。

### 完整sharedrelocation单独完成再扩大能力

source/native declaration与future finite-tree解析完成正式plan后，一次替换旧fold计算，copy/move/terminal/nestedtree统一正向验收；root/currentauthority/missing/broken/retarget/dot/两Project、真实source/target内容与links、相应Native完整结算分别验。两个terminal physicalparent改动若直接合入只能说明该有限case变化；它会仍遗漏这份分析的共享tree根，不能称完整修复。

如果Root希望本批同时完成两根修，应把futuretree投影和错误语义纳入当前正式spec/完整资格，继续同一批；这不是“很难所以暂停”或让用户选技术偏好，而是确保完整数据流分析/测试与实际提交范围相符。新读adapter和明确范围guard可以作为基础交付，不能偷偷以未实现future预测宣称整批已达到更大能力。

## 当前结论与未知

当前精确修正是：SYMLINK递归返回**访问namespace状态**，MOUNT检查target依赖但保外层context，source exact entry地址＋lstat，active/completed按namespace＋suffix。绝对target内含junction必须保其返回状态，ultimate realpath不是这种状态。

future ordinarytree位置映射仍成立，但source/future rawtext中的内部link/dot会要求真实解析；无条件path.resolve抹hop仍未根治。公开两root是唯一authority，不新增parallel权限resolver或假future存在。

unknown继续：双host metadata API/flags/close实际结果尚无、混合ancestor与text内部dot实际顺序、POSIX/Darwin host/大小写/namespace、mount/otherprovider、futurecycle/missing错误选择、外部FS race/原子性、未来投影复杂度和API结算。Root原8API/2Native/6trailing只证明其原范围；当前没有新的运行/修改产品/模型事实。
