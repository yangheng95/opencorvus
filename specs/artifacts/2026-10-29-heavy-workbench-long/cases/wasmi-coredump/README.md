# Wasmi完整任务：参考见证未满足原合同，未启动候选

这不是新的Codex/OC结果，也不计十题/有效小时。按[事前计划](BUILD-PLAN.md)选择完整`wasmi-trap-coredumps`原任务后，原reference库在本机编译成功；完整消费实际20项中19通过、跨实例重入1失败，Cargo原native101。原参考实现未改，没有通过补作者解、删合同或再开模型来救这份见证。当前对象在可达性准备处关闭，候选/Provider请求均0。

原固定来源`datacurve-ai/deep-swe@0b9fabbb63b9104d678fe965e1632f2dd9eaa2ea`，完整上游`wasmi-labs/wasmi@e1f76e285b9ad68a952b7cf5297bbb7ab91e6028`。选择前只读metadata/prompts，没有读本题答案/测试/模型分数。原6,387,955bytes ZIP/332源成员、完整原task/private tests/reference及所有native环境在`D:/opencorvus-benchmark-runs/wasmi-coredump-pair-20261101`保存，原件身份不充质量。

## 真实失败

事前固定两个真实Wasm实例：inner内存前4bytes为`INN!`、global=11；outer为`OUT!`、global=22。outer经host回调inner触发原Wasm trap，要求保两层帧及真实instance/memory/global引用，不规定索引表顺序或段布局。原reference产生的实际dump通过标准wasmparser模块校验，帧函数顺序为inner0/outer1；但两帧都指向同一个outer快照。

| 从原真实dump跟随frame→instance引用 | 原合同独立预期 | 原实际结果 |
| --- | --- | --- |
| 内层frame | `INN!` / global11 | `OUT!` / global22 |
| 外层frame | `OUT!` / global22 | `OUT!` / global22 |

[实际原二进制](evidence/cross-instance-original.wasm)、[独立解码差异](evidence/independent-verdict.json)和[真实原stdout/stderr](evidence/reference.stdout.log)相互绑定。外部Python标准库reader只读取已产出的原bytes，未再执行VM或改源。原reference的`generate`把inner stack entries拼到outer entries，却只按当前outer instance重新输出一个module/instance及其资源；帧instance引用保持0，内层资源身份被覆盖。原测试覆盖same-instance host重入，不能据此代表跨实例完整语义。

这只是本次原reference没有建立完整可达性，不证明原题不可能实现、所有原样例都失败或整个DeepSWE无效。没有官方22项/全base成绩，也没有以库编译0冒整题成功。固定原20项与真实失败不事后改线；原始合同、原参考和已闭合SQLite模型结果都不改。

## 消费与工具边界

原private22函数不直接运行其absence-only断言。当前消费者保17原功能函数，把3个dump缺失断言替换为真实ErrorKind/TrapCode/消息+dump字段的完整错误响应；2个资源不存在断言替换为完整零资源模块/frame状态。删除冗余operand-stack为空断言，原binary仍逐值解析；增加实际标准Wasm校验/保存原dump和上述原合同跨实例输入。完整[适配与当前consumer](evaluator/coredump_contract.rs)、原差异及登记保留；未修改Wasmi实现。当前20函数是派生本地消费，不冒原官方测试数/分。

首次consumer编译native101、执行函数0，根因是root把公开`wasmi::errors::ErrorKind`写成`wasmi::ErrorKind`；4个E0433是同一个root路径错误，不是4个VM缺陷。只修消费者的公开路径后，原同验收首次实际执行得到19pass/1fail。原首源码快照/日志保。Rust WAT字符串引号在首次编译前修正，一次精准patch上下文拒绝没有执行任何功能。

独立reader首版漏读data offset表达式的`0x0B`终止字节，读到multiple-memory段时失败；原VM输出的标准校验已经通过。保首reader和错误，只按原Wasm格式修reader，再读同19个原dump，得到上表同一失败；没有重VM/参考。一次只读诊断缺`__file__`的NameError也保工具输出。这些是root工具问题，不能当候选、共享调度或源产品缺陷。

运行使用原Cargo.lock、cargo/rustc1.98.1、自有CARGO_HOME/target及事前声明的`portable-dispatch`feature；原生Windows不是官方Docker/网络协议。没有Docker/WSL、原科学venv/GPU、用户窗口/服务或全局Rust配置改动。模型前发现此缺口后，不再扩写作者实现、重复参考/变体/组件资格或启动本case候选。

本目录只保存原任务/许可定位、单次消费及真实缺口的小投影；完整源码/编译target/依赖、原private文件和所有19dump外部保。准备与编译不是有效候选小时。总十题/有效小时0/10仍未达，心跳ACTIVE；已有真实对照见[SQLite结果](../sqlite-safe-import/real-pair-20261101/README.md)，通用verification行为改善/根治仍未证。
