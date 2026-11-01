# 下一完整任务：SQLite安全导入与持久化不变量（实施前Recall）

用户要求十个具有实质深度的完整任务和真实Codex/OC成果比较，禁止以作者研究、文件数量、机械版本或小组件资格代替。月结原pair已真实终态/保存，不重开；本任务是新的完整仓库开发任务，尚未取得有效小时/十题资格，不凭来源的long-horizon标签称成熟。

## 来源、选择与已读资料

先读当前AGENTS、主Recall最新月结末态、原十题矩阵及公开任务/输出合同。旧九份仅工程库存，不直接按100升级；L01/L02/L06/月结全部旧对象保持关闭。本次只读调查成熟任务的公开源：DeepSWE官方仓库、原论文和任务结构，不依赖排行榜成绩选题。固定官方源码`datacurve-ai/deep-swe@0b9fabbb63b9104d678fe965e1632f2dd9eaa2ea`，完整ZIP封在外部`D:/opencorvus-benchmark-runs/deep-task-intake-20261101`；选题前只读113份metadata和两份原prompt，没有读取reference/tests/轨迹或模型分数。

选择原任务`sqlite-utils-safe-import-checkpoints`，base为`simonw/sqlite-utils@8d74ffc93292c604d5827e2b44fffedca0c28c19`。理由是它覆盖实际SQLite数据库的导入、DDL（Data Definition Language，数据定义语言）变更、嵌套checkpoint、不变量持久化、CSV/JSON入口和真实命令行结果的一整个可用功能；原料为完整真实仓库而非合成小表。它无需操作用户窗口/服务，可在本机独立数据库文件验证。另一已读GQL任务需多transport协议；此处不并行做另一任务或扩大通用框架。

官方源：[DeepSWE](https://github.com/datacurve-ai/deep-swe)、[原任务](https://github.com/datacurve-ai/deep-swe/tree/0b9fabbb63b9104d678fe965e1632f2dd9eaa2ea/tasks/sqlite-utils-safe-import-checkpoints)。独立执行不构成官方Docker/网络锁定成绩，也不因来源宣称污染免疫。

## 深度、影响与单一合同

可观察目标：真实bulk insert/upsert、CSV/JSON、CLI bulk UPDATE在safe mode成功时提交，失败时恢复准确原数据库内容及表/列/索引/trigger；checkpoint状态/错误类型和持久化不变量可在重开DB后使用。触发链为public API/CLI→同一数据库事务/保存点→原写入/DDL→原不变量求值→commit或rollback→返回具名结果/错误。普通非safe路径保当前公开合同，不能添加影子数据库、手工修输出或host业务gate。

当前未知：原代码定义/全部调用点、事务嵌套与DDL语义、完整verifier是否公平接受合法实现、reference是否真的可在同原料/本机运行、依赖/平台差异及任何测试缺陷。必须先读原base代码、配置、测试和原环境，再定位，不能以任务标题当根因。此时不修改sqlite-utils实现或先做一份作者解答。只使用原reference作一次必要可达/消费见证，空base作具名失败见证；不能反复调作者解或拿二者结果作模型结果。

审查原verifier的公共语义/完整结果、合法实现/表示、基于原字段的独立预期与真实SQLite/CLI最终消费者；不按私有symbol名、布局/文件数量、源码摘要或候选自述评分。只测试数值/状态/实际错误/持久化契约，禁止UI自动化和核心为不存在/未调用的负向测试；若原verifier有此类冲突，保原件并先明确本地派生合同/正向输出检查，不能偷偷改官方结果。发现真正本仓库共享生产调度异常才按AGENTS横审；本题SQLite样例/准备工具问题不自动冒生产事故。

## 实施与真实对照顺序

1. 封原任务的prompt、metadata、tests、solution、environment及base完整源码；保持public/base与私有reference/verifier分离。对独立运行所需版本/命令进行native Windows调查，不Docker/WSL，不改原科学venv/GPU或用户程序。
2. 明确所有API/CLI/状态/数据/文档契约和现有调用，使用完整原base与原reference各一次实际最终消费；原错误/平台问题保原，局部工具故障先修工具后原验收。必要合法表示/独立预期验证事前登记，保持原功能范围，不扩另一套框架。
3. 冻结两方同一完整base、原任务与公开澄清/声明runtime。原task的“新branch”由用户当前“不另建branch/worktree”覆盖，保原文字但公开说明本地执行当前单一来源；原固定agent总超时不当小时资格，本地只按既有真实无活动机制，不设最低耗时。网络/平台/底层model未知均披露，不冒官方协议。
4. 具备完整可达、公平实际消费后按已有必要fresh授权启动一次真正Codex fork none/无override和OC既有Inspect/native Task/全流式新自有隔离实例。不给候选solution/verifier/参考/旧答案/Recall/凭据；不用旧退休服务/预算。正常自然终态完整先封，再同消费者测真实提交的整题功能、源码移交与原公开合同。原候选不补码/重试救成绩。
5. 分列原功能结果/错误与质量向量、完整交付/回归、有效活动时长/资源归因及未满足项；不造总100或保证必有失败。实际参考/失败/候选全链结果才更新，不以本计划或官方名义补十题/小时。修改repo须范围commit、正常fetch/merge审全部待推/完整hook/push；保foreign。

当前仅启动任务原料和公平执行准备，未启动candidate/Provider/独审，旧月结与其他原对象全部不重跑。总体心跳ACTIVE/20min持续，只有真实重要结果/失败/必要选择才通知。

## 原消费者读取后的事前本地适配

原test.patch有1030行真实API/CLI测试，包含以`table not in ...`为核心的旧断言；不运行该原测试或整个未审的base自动化。原件完整封存作来源。当前单一native消费者从同一完整原测试派生：保各请求/原数据/预期语义；不透明非空ID改为明确string+长度契约；CSV/JSON错误测试在操作前后比较独立SQLite读取的完整相关用户对象schema/data状态，删除设置阶段冗余的“drop后不存在”断言；原非零CLI码按原合同映射成明确operation_error码族并保native码/异常。最终正向状态/具名错误、API调用不减少，不按reference结果选择测试。所有转换逐项落收据，原官方grader不当运行fallback或官方成绩。

另加一个事前登记的真实子进程全链：原无safe普通导入→启用/注册不变量→safe insert/upsert/UPDATE实际成功与错误回滚→独立sqlite3重开核全部用户schema/data→不变量list/validate/disable与具名API状态。这里只补真实进程/文件消费者，原60个测试函数仍逐项报告，无总100；完整旧base pass-to-pass广覆盖未认证。先保持原reference不动，首次全消费若失败保存具体原结果，不补reference或缩小任务救成功。

首次未改reference已实际60个函数通过、真实子进程全链及独立重开状态相符；原base的新异常类型未实现导致collection error（不能当60个独立失败），普通insert0而enable命令真实1，后续未执行。原外层PowerShell为1，首base的Python父进程码没有单独采集，不用源码意图4冒实录。首次consumer已运行后，准备脚本重写注册文件时漏保首consumer源快照；原input/reference/原结果/所有子命令未动，首源仅chat中原patch可追，不能伪称磁盘原snapshot齐全。最终冻版前修其证据记录/opaque invariant ID的CLI字符串表示和collection分类；reference实现保持原patch，最终消费者另封存后实际验证。

另事前登记两个完整programme：合法实现只改内部metadata表名及不透明ID前缀（公共经济/事务语义不变），错误实现把rollback方法真的执行commit（其余代码完整）。同最终消费者必须分别真实通过/暴露状态错误；不得按测试结果改reference、再选变体或以通过计数作难度/模型成绩。

这一轮实际已0/0/4，错误programme有真实已写入状态与预期恢复状态差异，未修改reference。冻结前继续全题语义读取发现：原private测试把具名异常限定从sqlite_utils.db导入，但原prompt只规定异常名称，没有规定定义/导出模块。当前消费者改为在真实请求处检查实际异常type名称，避免强加作者组织结构；不增加原prompt以外的异常位置要求。两方候选前最终完整consumer单独封存/登记，再必要验证原参考/合法/错误及空base，所有前期0/0/4原件保。没有候选或模型数据用于修正。

最终本地适配还接受具名错误的Python子类MRO（Method Resolution Order，方法解析顺序）家族，不将正当子类强判别名；opaque invariant ID在观察JSON中只做default=str表示，保持API/CLI实际同一身份，不按作者token格式认定合法。完整最终原生消费者注册/快照在validation-final-native；前几次适配测量不是新候选/重型小时，全部单次命令及未改reference保，禁止再增加预检版本凑资格。只在真实失败/变化需要时验证，不假装先前无测量缺口。
