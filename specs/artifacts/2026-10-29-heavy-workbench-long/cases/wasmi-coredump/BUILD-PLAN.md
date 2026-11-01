# 下一完整任务：Wasmi trap coredump（实施前Recall）

用户要求继续十个具有实质深度的完整任务和真实Codex/OC产品比较，禁止作者研究、文档、组件或最低耗时填充代替结果。SQLite原pair已真实闭合，原60项通过与嵌套全回滚缺口均保；月结/L01/L02/L06等也不重开。总十题/有效候选小时仍0/10，心跳ACTIVE/20min，不凭来源标签或编译耗时补资格。

## 选择前资料与来源

已读当前AGENTS、主Recall最新原pair终态、总体任务与cases库存矩阵；原113份DeepSWE任务metadata/标题保持同一固定档案。本次再只读GQL原prompt，以及Wasmi和Bandit两个原prompt；没有为后两题读取solution、private tests、轨迹或模型分数。选择原`wasmi-trap-coredumps`，固定`datacurve-ai/deep-swe@0b9fabbb63b9104d678fe965e1632f2dd9eaa2ea`，完整upstream `wasmi-labs/wasmi@e1f76e285b9ad68a952b7cf5297bbb7ab91e6028`。

选择基于完整契约覆盖解释器配置、真实Wasm（WebAssembly，可移植二进制指令格式）执行/trap、帧/参数/局部值类型、跨host重入、多实例索引、线性memory/global快照，以及真实二进制消费者。它覆盖一个现有VM（Virtual Machine，虚拟机）的全链能力，不是单独编码器或玩具表。不能仅按任务标题/原标记3小时称有效小时，最终必须实际候选执行和完整产品比较。公开来源潜在污染未知，不宣称官方Linux/Docker/网络锁定成绩。

本机只读确认cargo/rustc均1.98.1可用。官方Wasmi仓库与WebAssembly二进制规格仅提供当前实现/格式资料，不使用未来答案。实现和消费必须以原task明确四个custom section及标准memory/global/data要求为准；官方规范随时间变化时不偷偷替换原固定合同。

## 深度、数据流与影响面调查

可观察目标：调用`generate_coredump(true)`后真实Wasm trap的原Error持有可供事后调试工具读取的Wasm bytes；默认/配置名和非Wasm错误按原公开合同观察。binary须保四个指定custom section、unsigned/signed LEB128（Little Endian Base128，可变长整数编码）、UTF-8名字、从最年轻到最旧的Wasm帧、精确参数/局部类型和值，以及真实memory/global内容和实例索引；host重入不能丢外层或覆盖内层帧。不能用一个固定dump、候选自报JSON或摘要替代实际执行状态。

调查链：Config公共入口→Engine/translator保类型信息→Store/stack/call-frame/host重入→实际trap/Error传播→coredump序列化→外部Wasm parser及独立按原输入预期的状态读取。改动可能涉及frame布局、引擎优化/缓存、std/no_std特征与普通Error/API/执行回归。现在只按原prompt推定范围，实际定义/调用/数据布局/测试/feature依赖/平台能力未知；必须读完整相关原base后逐项定位，不能把名称当根因。

本仓库生产Task调度未出现新异常，不扩大生产框架。只有真正生产共享调度/恢复/并发异常才按AGENTS横审；候选VM错误/工具故障不是自动的共享产品事故。此处无产品UI/用户窗口或视觉自动化，不需启动网页验收；无数据库schema迁移/发布版本，不改现有服务/凭据。

## 实施、冻结与真实比较

1. 先将本选择/原prompt固定登记，完整原task/private/reference和原base另封。下载原base只读source，搜Config/Error/trap/frames/translation/type/reentrant调用与Cargo全部依赖/原环境；原reference不改，不写作者实现。
2. 调查完整原private consumer的覆盖、独立预期与是否公平接纳合法帧组织/二进制布局。只按原公开语义适配现有positive实际状态/具名错误合同，不运行核心为不发生/不存在的旧negative或UI自动化。原件保作来源；不按作者私有symbol/精确源码/字节布局、文件量、测试数或速度评分。二进制解析必须读真实dump且核对真实输入预期，不让candidate自报claim代签。
3. 只建立本任务自有Cargo缓存/target/runtime，原科学venv/GPU/用户Rust配置不动，不Docker/WSL。先声明相同native依赖和工具给两方；原完整reference只作必要全链可达性、合法表示/真实错误programme的事前消费见证。工具链故障先保原错再修工具、重原验收，不补reference/候选或缩合同救通过。缺失source/关键前提则如实未就绪。
4. 事前固定完整输入、独立预期、真实最后消费者和分层质量。至少覆盖实际trap二进制、参数/局部类型和值、memory/global及reentrant全层，而不只参考测试的有限普通路径；完整来源可达性若未建立不启动model。合法变化与真错误必须是完整programme进入同消费者，不堆组件资格。
5. 条件真正就绪、正常Git保存后，只一次必要真正fresh Codex fork none无override与OC既有Inspect/native Task/全流式新隔离实例。候选同完整base+public原任务/声明runtime，不见reference/tests/答案/私有grader/Recall/凭据，禁止再次委托。新OC auth+models成对核usable/projected/actual，旧服务/预算/凭据副本均退休，不复用。原prompt新branch由用户main规则公开覆盖，不另建branch/worktree。
6. 自然终态/自有子进程结束后先封完整project/Git/source/原dump/log，OC另保SQLite及canonical工具/实际Provider事实，再同原冻结消费者对两份未改源码实际编译/执行/解析，主方读完整源码移交/文档和真实普通回归。生命周期/编译/eval侧耗时不当有效候选小时，不造总100/强制胜负/同模型资源因果。结果先分列完整能力、真实缺陷、交付与未知；最后正常dispose新实例并清stagedcredentials，源凭据不动。

本计划先于私有源码/测试读取与准备实现。正常任务设计自主推进，不能在此计划/作者消费处结束替模型结果；又不能未就绪便启动新请求。任何本任务repo修改结束前范围commit，正常fetch/merge审全部待推/必要检查/完整hook/push，只推本任务或已核授权验证peer，保全部foreign，不rebase/force/noverify。当前没有新candidate/Provider/审查请求，旧所有对象不重跑。通用verification修正已实施、行为改善/根治未证继续有效。

## 读取原源后的事前完整消费边界

原reference31,108bytes/原tests32,325bytes已按原包保，原reference未改准确应用；native `cargo check --locked -p wasmi --lib --features portable-dispatch`首次0，只证明库编译/依赖可用。Cargo1.98.1/rustc1.98.1与wasmi原Rust1.86最低版本相容；自有CARGO_HOME/target和锁文件不触全局配置。portable-dispatch是为两未来候选事前同声明的原生执行feature，不是功能源补丁；本机适配不是官方成绩。

原22个新函数包含3个以coredump缺失为核心的断言、无memory/global的小模块空字段断言和普通stack空断言；不直接运行该原测试。当前消费保每个原实际请求/WAT（WebAssembly Text，Wasm文本表示）与预期语义，将禁用trap/坏module/host错误改为实际明确ErrorKind/TrapCode/消息及dump状态的完整响应合同，空模块按完整frame/schema计数联合预期确认，普通operand-stack按对应真实frame预期长度确认；不只重命名旧negative。原对象留来源，改动逐项保存且不动reference。

完整二进制消费还须用wasmparser实际校验标准Wasm模块，保每次真实trap原bytes再独立读custom字段/值，不用magic/name存在代签“valid”。新增同一个事前固定的跨实例重入工作流：inner/outer两个真实Wasm实例各有不同memory/global内容，outer经host回调inner trap；原合同要求所有Wasm层、正确实例/模块/内存global映射。按实际独立输入值和引用关系评分，不规定私有表序/实例索引数字或内存段布局。原测试的same-instance回调仍保；不是为挑失败换输入或新增组件资格。

静态原reference序列化目前只emit一个module/instance，跨实例语义是否足够仍未知，必须在模型前用真实VM执行检查。若原可达性见证在原完整合同失败，保真实失败、标未就绪，禁止改reference/删跨实例要求/启动候选以有限22项通过冒全题公平。不追加作者修复研究；只完成这一次必要完整消费并据证据决定该对象是否可继续。
