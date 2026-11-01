# 模型自产测试逐次故障清单（续R09）

本轮分开记录作者测试、模型内部Reviewer、root独立消费和root观察工具。源测试/最终源码/实际输入输出未消费前不预填效果。原R06正向自验敏感性不足已直接证实，旧结果不回改。

## R09：修前SQLite查询导出Task

已登记，按当前共享规则自然执行。表列标识符、字面过滤值与实际源库状态是独立义务；模型源码中使用quote或参数绑定，不自动证明自产测试实际构造并断言了这些区别。

真实Task `tsk_g00VZjU1kW00TlEcoBgt`已自然completed，33实际Provider增量，32canonical工具请求/32结果（30completed、2failed、pending0）。两项patch错误加一次Bash native1，共三次过程故障。最终自产六项测试的原回执为`prt_g0VZjVL7m00K8OHf3HT5`，原测试真实执行复制pyz、字面JSON预期和原库byte/logical dump/user_version比较。复杂表列名、单引号/SQL样文本值、大小写/数值类型已在修前覆盖。外部三项相符，发布snapshot程序与消费文件逐字节一致。

### R09-F01：首次补丁的旧源码上下文不相符

part `prt_g0VZjUDnD00rKcd9NAXx`，apply_patch verification failed，期望的minified main.py行与实际文件不符（SQL拼接上下文）。这次Tool不能算写入成功。下一次`prt_g0VZjURUd00szhTyKjmn`成功后才构建/测试；独立call身份及终态均保，不是同一次成功写入被队列重复执行。原hunk/错误全文在trace/canonical。

### R09-F02：自产测试夹具SQLite连接未关闭，Windows清理报锁

原Bash `prt_g0VZjUfeX00Nl43pnte8`运行四项测试，native1/FAILED(errors=4)，temporary cleanup对source.db报PermissionError WinError32。连接的事务context不会自动close底层连接，进程内清理临时目录时句柄仍在；四个错误为同一生命周期缺陷，不能当四项独立业务错误。

模型在`prt_g0VZjUi4900OeL72mHgQ`为连接加显式contextlib.closing，随后四项、扩充后的五项、最终六项通过。最终交付源码也明确关闭只读数据库连接。该问题属于作者测试资源管理，原自测实际发现并修复；没有共享调度/恢复异常证据，root没有手工补测试或交付。

### R09-F03：修订测试时再次引用过期的一行断言上下文

part `prt_g0VZjV17d00hSs1RaDRx`拟替换PRAGMA user_version断言，但当前文件实际已是不同格式/上下文，verification failed。之后按当前源重做补丁并新增样例验收，最终原Bash六项通过。原失败保，不把后续成功抹作“一次干净执行”。

## R10：修前UTC台账Coding Session

已登记。会单独核模型测试中的原始offset文本、实际入口、UTC换算/分日/时长断言，不能以外部固定预期相符冒自产测试。

Session `ses_-zUQGUOpDzzgGK8wu2PX`自然结束，25实际Provider增量，23canonical请求/结果（22completed、1failed、pending0）。自产七项原回执`prt_g0VZjWLsw00vAW8GCxbt`。原fixture含+02:00到+00:00的本地倒序正时长、-02:00跨UTC日、微秒、CSV换行/文本ID，断言固定canonical UTC、daily和total。外部四项相符，其中negative interval按合同native2/error响应。

### R10-F01：测试fixture修订补丁上下文未匹配当前排版

part `prt_g0VZjW40l00OVqtdjZoU`的test_ledger.py hunk未找到期望行，Tool error；模型随后读取/按当前文件修订。首轮五项与最终七项真实运行都native0，没有将未执行的旧fixture算运行失败。原新程序/测试不由root补写。

R10使用最后自然Message交接用法、构建和七项测试；公开合同未要求必须HANDOFF.md，不因没有该文件新增失败门槛。模型说明没有提交Git，原初始化HEAD、工作区和原源码另保，不伪称源码已提交或Git clean。

## R11、R12：共享修复后的登记历史

待修前自然结束后按计划改共享原则，再同公开材料作新独立执行；不传前轮测试/答案或私有结果。

after开始前原计划修订：两个修前新任务的自产测试已对指定合理错误敏感，后续仅作跨领域回归；追加R13新鲜归档Task查原native-source缺口，使用原公开合同/初始原型，不给旧答案。after新独立上限180，before实际60/剩余80已退休。after-registration保修订真实时间；不改最初registration冒事前全登记。R11/R12仍按原新SQL/UTC顺序，R13在末尾。

## R11：修后SQLite实际终态

Task `tsk_g00VZjXqvp00kPXoh3G6`自然completed，67实际Provider增量；65canonical请求/结果（63completed、2failed、pending0），三个额外Bash非零，共五次过程故障。外部3/3相符；原snapshot `a5164cd0-ec42-5079-a6cc-bc2d2a9abc30`程序与实际消费对象相同。producer原五项回执`prt_g0VZjYTtd00X1aiQAKm0`，Reviewer后又对原发布程序运行该五项，不能把Reviewer执行回填成owner额外测试。

### R11-F01：自产正向夹具用了Windows拒绝的目录名

part `prt_g0VZjYHNk00giK4ZYZZR`的四项测试全部在setUp.mkdir失败，原名`input #? Unicode`，OSError WinError123/native1。此时尚未消费导出器，不能当四个业务错误或有效的正向测试。

模型改成`input # 雪`后继续，保持需要URI转义的合法字符，原程序不因这项修改而变。该故障显示fixture本身的本机允许域仍会选错；新共享规则未证明已消除该类分类错误。只把实际后续成功的合法fixture列入覆盖。

### R11-F02：修订fixture的hunk未匹配实际文件

part `prt_g0VZjYK4a00fl0K4uf0B`的NUMERIC行旧上下文未找到，Tool verification failed。之后按当前源码修订成功。不能用第一次预期补丁当已实施；完整原patch/failure在canonical-tools/trace保。

### R11-F03：SQLite事务context被当连接关闭，重复文件锁清理错误

part `prt_g0VZjYQIq00IlQZFSC1C`运行五项，FAILED(errors=5)/native1，tempfile清理source.db报WinError32。与R09同类连接生命周期误判：交易context不释放底层句柄。模型为fixture连接加关闭管理后五项实际通过，生产源码也有finally.close。五个错误同根因，不计五个独立功能缺陷；重复发生说明预防效果未证。

### R11-F04：Reviewer下载原发布程序写到Task授权根之外

part `prt_g0VZjZDAF00sQIFaBWf4`，write的实际目标位于runtime tmp下`independent-export-review-neh2l4oq/deliverable.pyz`，而Task精确root是`.../opencorvus-delivery-scope-SFFo5R/query-export`。Tool报TaskProcessBoundaryError，模型Reviewer正确保为blocked、通知owner，随后改项目内一次性目录继续。

这是实际绝对目标选址错误，不是相对cwd错误、程序源路径误拒或关闭保护就应放行的情形。源和Tool权限域分开；原错误及后续成功对象绑定保，任务根保护不放宽。

### R11-F05：内部Reviewer验证脚本语法错误

part `prt_g0VZjZpFD00fFR1UsCXp`的inline Python列表推导括号失配，SyntaxError/native1，在脚本statement前结束。该次不算完成任何export验证。修正脚本后`prt_g0VZja0tW0080ZNnQWDs`实际54个固定预期exports、两次empty以及原五项测试相符；root没有修脚本或候选。

### R11-P01：违背原“不委托”流程要求（未被最终功能通过消除）

原公开operator要求`Work directly in this project without delegation`。实际`prt_g0VZjYoAe00UO9NMIKo8`派出base-tester，边界受阻后`prt_g0VZjZQBY00tZTBK00j1`继续同一Reviewer。producer/Reviewer最终都承认违反该流程约束，Task仍completed。完整技术交付和诚实披露不使已违背的约束事后满足；该原义务保持未满足，不给“全流程通过”。

默认base workflow独立review文字与用户限制有冲突风险，唯一因果未隔离，本轮未以host gate/流程重构修复它。只陈述已发生违约，不把额外Reviewer工作当作者自产覆盖或本轮收益。Reviewer还校正了owner关于测试修订历史的简略描述：最终producer有INTEGER/表达式样标识符测试，独立NUMERIC补测归Reviewer。

## R12：修后UTC实际终态

Session `ses_-zUQGPIdkzzZ70ePVhJe`自然结束，20实际Provider增量，18canonical请求/结果全部completed、pending0，无观察到Tool/native非零。原六项最终回执`prt_g0VZjbGsg00PFk109sch`，测试实际调用最终pyz，固定UTC/分日/时长/ID断言保。外部4/4，末项正确native2单列。

root评估副本将astimezone改为replace(tzinfo=UTC)，原正向方法失败，保持判别性。修前R10已经同样敏感，不能把R12通过或年宽度等新增边界计为已估计的整体改善；没有新的观察故障不等于全域无错。

## R13：新鲜归档回归与目标自产覆盖变化

Task `tsk_g00VZjbPA600hXrQhaLJ`自然completed，28实际Provider增量，27canonical请求/结果（26completed、1failed、pending0），另一次Bash非零，共两次过程故障。原最终五项中`test_native_source_separators`在Windows实际ok、未skip，原回执`prt_g0VZjc8Dj00mPyTldJ3N`/`prt_g0VZjcPQ100j4gHdAh1S`。

该自产方法真实创建`sub/native.bin`，将`sub\\native.bin`写入manifest source，target为ZIP语法`folder/native.bin`；调用复制到异地cwd的原pyz（-I），核完整ZIP成员、二进制字节及排序index。root没有添加/更改该测试。没有委托或独立Reviewer，当前Task直接完成。外部4/4另列，snapshot `a9e33028-778b-5dc9-a903-0d235d06843d`程序与封存/消费对象同字节。

### R13-F01：主测试fixture未考虑Win32源目录尾点行为

part `prt_g0VZjbutp0043v2JJyIz`原五项运行中exact-bytes方法写源`Unicode 雪, dots.../café.txt`时报FileNotFoundError/native1，其他方法包括native-source正向方法已有实际运行。模型将源夹具目录改为`dots...folder`，保ZIP目标/所需字节不变后整组通过。问题是模型自产源fixture的本机路径构造，不能据此扣程序的Unicode/ZIP功能，也不能把失败的该次fixture算已完成覆盖。

### R13-F02：第一次fixture修复hunk未匹配现有多行代码

part `prt_g0VZjbwpz00RvQ6D2dN5`预期旧tuple一行，实际源不匹配，verification failed。后续读当前内容并成功修正，再构建和完整五项通过。首失败保，root未手工补程序/fixture。

### R13目标判别性资格化（root后验，不是新增模型动作）

原测试/交付已先封。root只在评估副本让source_path拒合法反斜杠，保持原测试字节，执行该原正向方法native1，因被测程序2而断言0失败。对照旧R06 owner正向及模型Reviewer脚本在同类错误下仍0。这支持本轮一次具体自产覆盖变化；root外部四项通过没有被当作这个结论的替代。

## root工具与启动记录

- 观察原trace的inline Python命令因shell引号SyntaxError在执行前失败；随后保存helper读取原事实。
- 首观察helper已完成原工具事实与index快照，打印Unicode时cp1252错误；源JSON写UTF-8完整保，不冒模型错误。
- 第一before启动选择旧Linux布局的auth路径，缺相邻models.json，在Provider前失败，cases=[]/requests=[]。原cleanup聚合false是缺源models的ENOENT，不能据此宣布源凭据改变或配置不可用。该初次原件独立存before-startup-failed，按代码路径找到当前Windows单一runtime/data后核auth/models两文件存在，新复制启动；不是模型故障，不消费题数。
- 首失败的registeredCasesAgree因空数组every为true，overall明确execution_failed；聚合工具缺陷已修为声明case数匹配且全部相符。真实fixture启动失败输出现在registeredCasesAgree:false，0模型执行；该局部工具合同测试不冒真实模型端到端或自产测试改善。
- 一次prettier从package cwd误传仓库相对路径，未匹配文件；随后用正确相对路径执行。源/测试未被该失败改写，50聚焦后端测试、9项Python真实消费者/启动合同及core类型检查已过。

## 自产覆盖测量的当前结论

R09与R10自产测试不仅有输入文字：root在评估副本分别取消identifier quoting、将astimezone改为本地钟面重标UTC，原未修改正向测试均native1，故对这两个合理错误有判别性。该root事后实验只资格化原测试敏感性，原模型自己的成功执行仍靠原Tool事实绑定；不能把这次root运行计为模型先前执行。

这两题修前已经覆盖，不计after收益；R06原模型自验仍漏缺陷的历史事实保。R13出现目标原正向输入的自产/原执行/原断言链，敏感性区别如上；只观察到这个具体case的行为变化。五次新真实执行、177流式Provider和165 canonical Tool均自然收敛；没有新共享调度异常。R11流程约束仍未满足，恢复过的本机fixture/连接/patch/权限错误原件均保；整体改善率、唯一提示因果和根治仍未证明。
