# UI最小结构方案第二只读复核

## 范围与结论资格

已重读2026-10-14-directory-target-navigation.md当前Recall/共享读owner补充、原server-path规范key、Explorer loadDirectory/两token、selection、cache、move/copy/refresh源码。仅补本owned scratch，不改产品/spec/test/Git，不执行新实例/API/模型/UI或委托。本报告是候选代码方案资格，所有新自然先后/外部变更窗口仍未实机验证。

Root方案的唯一relation、accepted-success结构退休、现clear primitive同步token/loading、mapped意图required并行collector方向正确；有一处必须明确修正的覆盖关系，另有一个条件性mutation意图范围缺口，见下。

## 1. immediateChildPath需要对所有parent排除首个剩余`..`段

仅在parent==空时排除leading`..`不够。规范parent=`..`、path=`../../folder`会满足`../`前缀，截取剩余`../folder`再取首段得到`..`；候选将返回`../..`。但它是parent的上级，并非成功list(`..`)的child。该list不含`../..`不能证明它missing，照此会误退合法更上级expanded/cache/required token。parent=`../..`、path=`../../../folder`同样。

唯一relation应沿现canonical project-relative key比较：排除parent自身；取root时全path或非空parent精确`parent + '/'`前缀之后的suffix；**每个parent**的首段均精确排除空/`..`（`.`由既有normalizer归约）；其余返回这个parent下首个剩余child key。不是`startsWith('..')`，`..notes`是合法文件名。既有normalizeExplorerPath负责Windows分隔符/词法点段，不trim文件名、不lowercase全key、不把POSIX反斜杠当分隔符，relation不再提供第二归约/物理匹配。

应有明确源码真值表（不是新增/运行UI文案测试）：

| parent | path | 覆盖的child key |
| --- | --- | --- |
|空|空|不覆盖parent自身|
|空|dir/child|dir|
|空|../folder/child|不覆盖|
|空|..notes/child|..notes|
|..|../folder/child|../folder|
|..|..|不覆盖parent自身|
|..|../../folder|不覆盖：更上级|
|../..|../../folder/child|../../folder|
|../..|../../../folder|不覆盖：更上级|
|dir|dir/child/grandchild|dir/child|
|dir|directory/child|不覆盖：非segment前缀|
|..|空|保原scope-root容器键，不以此parent读退休root|

reconcile selection/anchor/drop与accepted-list枝退休都应用这一份关系；不覆盖者保原投影，覆盖者由同一new members Map判missing或明确false。entry叶节点仍按kind/name核，后代资格按directoryTarget；drop目录即使等于仍存在file/link entry，也要以其true资格判，不能只用叶selection存在性。

## 2. accepted成功list的顺序及unknown keys

old parent children必须在setChildrenByPath覆盖前捕获；其old entry paths和当前expanded/cache/errors/loading/两token keys只用于**临时枚举被该parent实际覆盖的child**，不保存新target state。新nodes中的false也纳入。由new nodes Map确认该child缺失或directoryTarget===false，才能变成invalid subtree roots。未知/非该parent命名空间的key不判false；当前scope/token失败parent不执行此步骤。new field是必需当前协议，不添加旧kind推断或缺字段fallback。

同一batch内publish parent、按invalid roots清原cache/errors/两token/loading、删对应expanded并协调selection/anchor/drop。parent自身和空root不属枝退休，避免删除当前parent token/刚成功parent list。只退对应invalid child subtree；成功root含true新alias时必须保mapped new expanded、已先完成child cache及在途child token，不能按旧children缺少新alias退它。

clearDirectoryCaches的metadata invalidation与accepted-list的结构退休仍是两个已有用途：前者同步删指定原token/loading但**不删expanded**，供mutation保意图后发真实required读；后者在确认invalid的成功事实下显式退expanded。给同一cache primitive加expanded全清会删除move刚mapped的意图，故不可合并这两个不同事实。

clear token不取消/替换原HTTP Promise。旧pending success→现ownsLoad false而retired/superseded；旧pending error→同retired且observedFailure保原error；finally沿原token guard，不能清后继读。原read已published/returned loaded则保其fulfilled事实；后来的parent invalid退当前tree，不追溯改历史receipt。当前collector按原Promise.allSettled收齐所有directory/search，失败/退休均不是success，真实completed mutation不因刷新资格丢失。

## 3. mutation接管ambient：足够的部分与条件性缺口

同步clear两token/loading再开始本action required reads足以退休受影响的prepublication ambient/旧required：原required load:501本已抢同path ambient，新primitive还覆盖old subtree中之后并不重读的路径。不能把token删除伪称原请求取消；独立upload/前action被superseded的read保原collector结果。无须新queue/epoch/等待缓存/自动重试。

updateExpandedPathsAfterMove返回实际被映射的expanded keys，连同old/new parents与原entity-directory读放同refreshTargets，覆盖本批正常主case：已展开健康link及nested expanded子目录move/rename后，Node仍file但真实required新路径读齐。parent与child仍原并行；parent true保child，parent false/missing退休pending child；parent失败不推false。原新key还无target是这些required读建立事实的正常输入，不准用target absence gate。

**条件性源码缺口，未实机复现：**destination已有expanded intent，entry在外部移走但尚无成功parent list确认missing，此时Move一个未expanded的健康link到已空闲destination。source没有mapped keys，Node=file只刷新parents/root；clearDirectoryCaches删destination cache却保原expanded，fresh parent含true，因此accepted-list也保expanded；15秒poll:575因destination既无cache也无error略过。结果可以保空的expanded箭头，而本action未读它。Copy也同样只刷新parents。它需要自然外部变更窗口，不是仅凭普通主case成功就已排除。

若本批合同包括所有本次失效后的现expanded destination意图立即required确认，最小延伸是从**原expanded set**收齐此次affected destination枝的现有展开意图，与mapped keys共同交原collector，仍不复制receipt target bool、不新建cache。若Root不将此外部变更窗口纳本批，应明确该资格仍未知，不称所有mutation失效展开意图已覆盖。不要为此让每个Copy无条件读未展开的新target目录，或从entry.type猜link target。

## 原始读取/工作区资格

当前scope/token success、error和finally实现与上述原Promise规则一致；新目录owner结构变更未实现，当前未运行任何新测试。只读时工作区其它owner的CHANGELOG/server/runtime/session/storage/config与规格差异存在，已保留。main Mission:1493–1552确认requestWorkspaceSelection(kind=session,sessionKind=mission,directory)、原epoch/authority及selectedSource.directory链；Task owning directory由现唯一taskOwningDirectory核一致，未引入Task/Mission/Session执行occurrence或lease owner。本第二报告不重复ui-impact.md的完整矩阵，也不把原Capsule/Native未知改成已排除。
