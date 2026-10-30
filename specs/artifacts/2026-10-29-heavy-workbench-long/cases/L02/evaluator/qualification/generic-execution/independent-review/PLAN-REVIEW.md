# L02 通用执行器：实施前独立审查

方案方向可行：把提交、方法池、输入权限和数值执行绑定到单一冻结注册，用 SQLite 记录每cell事实，以真实OS锁排除同run双owner，并对原CID恢复。这能补齐旧作者专用Python入口的实际缺口。以下3项须在实现中明确，尚不能认可任何新执行资格。它们是代码/合同时间线反例，不是已经执行出的新失败。

我只读了04:35 UTC Recall、当前旧runner/StudySource及public研究合同，补查既有锁实现与数据架构；完整原件快照、实际读取命令见 `source-plan/`、`capture-receipt.json`、`read-only-command-receipts.json`。未新启Docker、预测、模型、HTTP、solver、Provider、GPU或UI，未修改主仓，未再次委托。

## 实施前必须明确的3项

**P1-R1：恢复的start权限必须来自实际进程事实，不能来自ledger的created标签。** Recall第4项说“恢复created复用原CID”，仍须明确仅实际Docker状态确为从未启动的created才允许start。反例：SQLite已保存CID/created；Docker接受start；程序已经写结果并自然退出；host在更新ledger前崩溃。resume看到ledger仍created若再次start同CID，会重执行同一容器，复用CID并不等于at-most-once。必须先inspect；running只等原执行，已exited无论ledger落在哪一phase都走原终态收集/验收，不能start。记录实际StartedAt/FinishedAt、真实退出与重启策略（禁自动restart），paused/dead/removing/缺失分别保留具名设施状态，不借恢复去控制非自有进程。

create回执丢失的方向正确：持久唯一name后才能create，按同一name查找并核run/cell、固定image ID、argv、环境、只读mount真实源、网络/资源和实际状态，不能只信候选可见label/名称。查不到时也只能使用同一已注册name；不能换随机name再创建第二实例。CLI attach断开/host失联不是候选终态，必须以同CID的实际State为依据。

最小未来验收：一个秒级自有程序，实际start并exit但故意不写ledger终态，恢复后验证它原先的执行记录/实际StartedAt保持同一次、原输出被验收；不能只测create-before-start这一窗口。

**P1-R2：任意候选身份和输出均须受到与files清单同等严格的路径边界。** Recall第1项已约束submission.files，但自由method_id也不能直接拼宿主目录、归档成员或container name。当前旧validate_pool仅要求非空字符串，而旧runner直接把method_id拼job路径；这对封存作者ID够用，不能直接推广给任意候选。比如ID `../../outside` 作为字符串可通过旧池格式，却改变路径含义。可用评估侧不透明cell目录/已注册映射保存原ID；或者公开清晰且不绑定作者名的ID语法。稳定tie规则要明示字符串排序语义，避免不同语言对非ASCII ID排序不一致。

候选终态输出的读取/封存也必须核普通文件、根内路径、链接和成员身份；不能让report或forecast文件的链接使host读取输出根之外的材料。当前旧 `rglob/is_file/z.write` 归档路径只对作者可信输出成立。owned ZIP用唯一规范成员、拒绝重复/越界项，恢复时不能让ZIP提取改写runroot或ledger。输入/输出身份核对是具体对象完整性，不是源码摘要质量门。

兑现“只有/output、/tmp可写”还需要实际只读rootfs及独立tmp，不能只有两个readonly bind；候选不得决定privilege、mount、网络、restart或镜像。环境由评估者准备，但不会因任意argv而自动支持尚未安装的所有语言；第二语言实跑只证明其明确准备的runtime及通用ABI，不是所有语言已资格。

最小未来验收：路径身份具名拒绝或映射到根内不透明cell；候选外链输出映射明确output_contract错误；真实inspect核实际rootfs/只读mount/tmp配置。无需对旧120组追加这些要求或回溯扣分。

**P1-R3：成功验收、失败封存和清理要有闭合的持久顺序。** Recall第4/5项规定先验收封存、再标verified、再rm；还需明确候选exit2/坏JSON/缺row等失败也有已封存终态，不能因为未verified而跳过原件，或在finally先清理掉唯一失败现场。建议用同一cell的终态分类/封存事实区分成功与候选失败，不建立第二份影子状态。依赖未执行的selector/report保持dependency_incomplete/unassessed，不能当成它们实际执行失败，也不能算通过。

ZIP必须先在独立临时名完整写出并原子发布，再在SQLite短事务中提交它对应的终态/验收结果。断在ZIP已完成但DB未提交：从原容器/同一ZIP核验后提交；断在DB已提交但cleanup未完成：只核原CID再清理，不再执行程序；已提交但accepted对象丢失/变坏：run_invalid、保存事实，不用working输出冒充原接受对象或静默重跑。没有声明掉电耐久资格前不要把普通close/rename称为掉电证明；首阶段进程崩溃资格不必扩成硬件掉电试验。

最小未来验收可利用同一微型终态加两个observer checkpoint（封存后/DB提交前、提交后/rm前），多次恢复同一原件而不是重做完整forecast组。候选自报run_invalid的真实exit2仍应candidate_execution_failed，终态/失败原输出仍留存；设施分类只由host独立事实支持。

## 两个需在公开执行ABI中收口的决定

1. **report的数据释放域。** “所有请求inner/outer”不应在正式候选路径中允许一次diagnostic单outer取得外层标签，再以新root重提调参。正式report应绑定完整且不可扩展的full_assignment；单outer资格的report必须明确是私有author-diagnostic、不是可反复反馈的候选成绩接口。终态后报告程序得到该冻结研究的标签/已接受结果没有问题，但之后不能恢复添加新预测cell。这里是评估信息边界，不是要求增加LLM路由或通用工作流门。
2. **语言无关ABI与池。** 公布predict/select/report的固定挂载根、输入文件schema、输出入口、允许的argv字面量/是否有唯一受控占位替换、cwd和退出契约。实际entrypoint要替代镜像自带entrypoint，不能靠shell拼接。pool需在首次执行前一次性验证唯一ID、角色/必交集合、至少两个选择配置及完整outer集合；配置为冻结JSON，不能把Python参考算法schema当候选白名单。源码和配置注册后，resume不接受重绑。角色/科学差异的评价与executor格式有效性分开，不能用ID改名即认证两个科学方法。

这些是实现/候选公开前的合同约束，不要求本轮预先发明完整研究rubric或quality_floor。

## 唯一状态、锁和作用域

`runs.sqlite3`作为单一cell真源合理；注册ZIP存不可变对象，inspect/log/原始stdout为证据，其他JSON只是可重建投影，不能反向驱动phase。run/cell唯一键、argv、环境、input对象与assigned origin/method应在短事务中固定；长wait不持未提交写事务。SQLite的user_version=1首次基线合理，未知版本具名拒绝；日后追加保数据迁移，不改写旧资格或清空库。

锁应基于同一规范runroot的真实OS句柄，非继承到数值子进程，driver崩溃后由OS释放。已有生产 `process-lock.ts` 使用proper-lockfile的mtime更新/compromise语义，不是本计划要求的kernel-owner锁；不应仅因名称相似复用其超时猜测。也不要求改动该生产机制。当前检索未发现此benchmark被产品Task/Mission/Session导入，本轮改动应继续限数值执行器，锁按run隔离而不是全局阻塞不同项目。

对真实支持的host平台做最小锁竞争/owner崩溃资格；若只验Windows就准确写Windows已验，不因文案写“跨平台”而声称另一个OS也已实跑。无法取得同run锁返回run_busy并保留原owner，不靠PID/存活时间夺锁。Docker控制面请求的观测超时也不等于给数值程序设置用户任务总墙钟额度。

## 最便宜下一闭环及避免过度建设

先实现一个顺序executor和一张ledger，不引入任务队列、后台daemon、分布式租约、跨host调度、自动重试或事件溯源平台。保留旧运行历史ZIP，但当前仅一个执行实现、一个新注册格式；旧作者summary可随历史源查看，不需要当前双协议reader。

一次注册outer提交可以覆盖6inner+selector+3outer+report；本轮计划的create-before-start/第二owner/run_busy、首次accepted后恢复有价值，但R1启动响应窗口和R3提交窗口用极小本地记录程序验证更便宜，无需为每个故障再跑10份拟合。第二语言也可用同原CSV、任意合法简单算法/方法ID通过真实predict/select/report ABI，只证明通用执行及权限，不把它当新增高质量参考。非法manifest/未知版本/重绑/错误自报设施用明确机器错误合同覆盖。

本次没有实现或执行这些资格，也不批准新执行器、L02冻结、完整grader、质量线、候选小时或十题成熟。上列三个边界纳入唯一实现后，等待当前源与实际原件进行下一阶段必要独立审查；不再运行旧120、54投影、toy、L06 solver或任何模型候选。
