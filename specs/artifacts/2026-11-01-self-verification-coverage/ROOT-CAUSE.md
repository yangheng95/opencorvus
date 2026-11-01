# 从“知道差异”到“实际测试差异”的断点

## 原模型可观察事实

R06实现明确分开`source`的本机Path语义与`target`的ZIP语义。其正向测试却把所有manifest source写为`one/same.bin`等手工正斜杠字符串；Path只用于把文件建出来，manifest仍保存原字符串。target反斜杠非法输入与source本机表示的接受义务不同。

内部Tester虽然从合同独立推导字节和索引预期，仍将source固定生成为`folder %d, é/same.bin`。它扩充Unicode、乱序、JSON escaping和块大小，实际七次执行都未触发本机source表示差异。原执行part与脚本在original-r06-observable-facts/self-verification中保。这个结论检查了所有模型参与者的实际测试，不仅限于最终保存的文件。

敏感性实验仅在评估副本恢复“任何反斜杠source都拒绝”的具体错误，原作者正向方法和原Tester脚本均继续native0，独立本机source消费则native1。原生产程序、原测试字节与历史结果不改。这直接证明原自验对该类回归不敏感；实验由root事后执行，不能当原模型先前执行或改善证据。

## 通用层为什么仍漏

前轮共享原则定义了输入合法域的权威，要求测试合法表示，且实际已投影到请求。实现代码能遵守该原则，并不等于测试构造兑现了它。原测试选择从主要已坏效果和示例类别展开，没有把后来作出的角色条件校验连接到能区分错误复用规则的实际输入和断言。内部review独立计算了oracle，却继续沿既有样例类别扩展，测试选择的语义前提仍相同。

存在具体的证据断点：代码中的角色区别→测试条件→实际序列化值→最终程序调用→可判别的独立断言。原有“合法变化”“独立预期”仍可被大量同表示样例满足。没有证据证明全局Windows禁令、环境缺失、文件工具妨碍或调度异常导致该遗漏；内部注意力和唯一提示心理因果保持未知。

## 当前唯一共享修复

verification fragment明确要求找出仍会通过所选检查的合理错误规则，从原合同构造合法正向判别输入，追踪实际fixture/serialization、最终入口和独立断言；实现后反查本次实际决策与执行条件，修生产者自己的缺口。创建数据用了某库、正确分支、另一角色拒绝测试、测试名称与PASS数量均不能替代该链。独立Reviewer按原authority重建链，新增同类数值不自动补语义缺口。

完成工具说明引用同一原则，明确producer self-check和downstream检查的来源区别。schema、host业务流程、模型路由与权限不变；没有新增强制coverage表、固定测试数量、Windows关键字白名单或通用mutation框架。聚焦测试和实际请求投影只证该规则可见。

## 事前测量与修前天花板

新SQLite和UTC完整任务先按修前共享规则自然执行。SQLite原自产测试实际创建复杂合法标识符/字面过滤值、消费复制的原pyz并核完整JSON和原库；UTC自产测试实际构造混合offset/本地倒序、UTC分日、微秒和ID，核固定独立预期。原工具回执分别为六项与七项通过。root在评估副本去掉标识符引用、把offset转换改为本地钟面重标UTC，原测试分别失败，错误都沿其原数据和最终入口抵达断言。

因此这两题修前就有判别性。它们的修后结果仅能作跨领域回归，不能当改善收益。after开始前追加一次新鲜归档Task，沿用原公开合同和初始prototype，直接查模型自产native-source测试；原候选不重开。新增执行及原初计划差异见after-registration，不把追加包装成初始预登记。

## 评估侧独立修复

首次before在选错auth目录、缺models时退出，0case/0Provider，overall execution_failed；`.every`对空数组使registeredCasesAgree错误为true。当前唯一runner先要求完成case数匹配声明case数，真实fixture启动失败验收现在明确false。原错误收据保。该修复只保护评估结果的数据语义，不当模型自验改进，也没有把凭据误配算成模型故障。

## 结论界限

各次producer、内部Reviewer、root消费者和root敏感性实验分列。只有原模型实际构造输入、执行最终程序并断言区别，才能记自产覆盖；root新增/执行的检查提供另一路证据。修前已有的覆盖不计收益。

## 最新实际结果与未解决项

R13 producer自行生成`test_native_source_separators`，物理文件`sub/native.bin`、manifest source`sub\\native.bin`、ZIP target`folder/native.bin`，实际复制原pyz到异地cwd以-I调用，再按已知二进制字节/完整成员/index断言。模型原最终五项Tool回执显示该方法ok（Windows条件成立，非skip）。root评估副本仅将source_path改为拒反斜杠，原测试字节不动，原方法native1并显示被测程序错误2；旧R06 owner与Tester同类错误仍过。这支持本轮目标漏项的一次自产覆盖变化。

SQL/UTC修前和修后都能通过原模型测试的判别性核验，故不计收益。R11模型Reviewer额外补NUMERIC/编码等属于Reviewer，不能回填producer；root外部消费3/4/3/4/4也另列。没有总体漏验率或唯一提示因果结论。

R11仍违反原“不委托”约束，实际dispatch后又继续同一Tester；模型最终已披露，但披露不使约束事后满足。当前base owner/method的默认独立review文案与显式直接执行约束存在冲突风险，header又声明workflow是可选示例；该次唯一心理/提示因果未隔离。本轮没有加host gate或扩为流程重构，保为新的未满足项。R09/R11连接生命周期错误、R11非法本机fixture路径与越界write、R13尾点fixture和patch失配都原样记录；恢复不证明预防机制根治。

两真实phase自然结束、177请求与165 Tool请求/结果全收敛，source-reader均settled，原发布资源绑定一致。没有新的调度/恢复/并发异常证据。有限源码和实际运行复核完成，其他OS/任意合法输入、总体行为效果与根治仍未证明。
