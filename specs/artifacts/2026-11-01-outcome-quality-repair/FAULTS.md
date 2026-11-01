# 逐次真实端到端任务与故障清单

## 口径

“过程故障”表示本次实际出现的工具调用或开发测试失败；后续自主恢复仍保留记录。“交付故障”以最终独立消费者的实际数据/状态为准。“验收故障”属于主方脚本/预算，不能归咎于OpenCorvus业务能力。相同根因引起的多个测试错误合并为一个故障原因，不将40个报错冒40个独立缺陷。

原根：`D:/opencorvus-benchmark-runs/outcome-quality-selection-e2e-20261101`。所有原始对象、失败补丁、CLI输出和状态保留，不给模型私有期望或验收反馈。

## R01：预测与补货发布，修前coding Session

入口：`ses_-zUQGwRSbzz50BBsjvo6`。任务要求修CSV读取、以独立验证集比较三种策略、使正式程序执行所选策略，交付标准库独立zipapp、源码和交接。样例数据之外的营业变化/星期模式、引号/Unicode/嵌入换行、列序/额外字段/记录顺序三种表示共六个输入由外部消费者执行。

结果：自然完成。归档原pyz复制到独立目录后通过6/6；两个情景分别选open、weekday，三种验证MSE和每条正式预测/补货与独立业务事实一致。原33工具调用31completed、2error；没有所测范围的最终交付故障。原HANDOFF记9项自测/40次归档调用，不能以这些数量代替主方六输入结果或泛化资格。

### R01-F01：Delete/Add同一路径，预验证拒绝（已恢复）

- 触发：`prt_g0VZj3nfN00Qm1jtZfW1`，apply_patch先Delete main.py，再在同一补丁Add main.py，提交完整替换源码。
- 实际：`Add File target already exists`；对应call为`call_9ccf08d003ab4580a27eff621e0247f3`。验证阶段拒绝，尚未进入写入；此次修改没有应用。
- 预期操作：用当前原文为上下文的Update替换现有文件。当前真实执行会先基于原文件验证全部段，Delete不会在Add验证前形成中间状态。
- 根因证据：原输入/错误及产品`src/tool/apply_patch.ts`的预验证循环、后续写循环；原模型可见txt说明未解释这一时序。可证明工具契约说明缺口和本次误用，不能单凭一次断言模型原因唯一。
- 影响/恢复：增加一次失败调用与修复轮次，未形成最终缺陷。模型随后用Update完成，最终原件6/6。当前产品说明已补真实时序和Update用法，实际Update正向测试通过；总体误用率改善未证。
- 复现：对已有main.py，向当前ApplyPatchTool传原trace该part的patchText；相同Add预验证给出上述错误。以source/原工具输入输出为证，本轮不再次执行破坏性Delete/Add尝试。

### R01-F02：测试文件补丁上下文不匹配（已恢复）

- 触发：`prt_g0VZj4P7a0004AMf1zZd`试图修改test_release.py，预期上下文含`record.update(metadata='ignored, "quoted"\\nmetadata', demand_hint=999999)`。
- 实际：`Failed to find expected lines`，call为`call_b05b586a04c24f0ba977e9c1112242dd`。现有文件文字与提供的上下文不同，derive阶段拒绝，修改未应用。
- 影响：一次开发编辑失败；没有把该失败包装成测试通过。后续模型读取实际内容并重新修改，自测和最终独立消费都过。
- 修复方向：以实际最新行重建上下文；当前工具说明明确该行为。它不是调度、并发或终态异常，没有证据支持共享调度根因。
- 证据：baseline/coding-trace.json精确part及baseline/extracted-faults.json完整patch/error。最终源码、HANDOFF和真实consumer仍保原件。

## R02：预测与补货发布，修前直接Task

入口：`tsk_g00VZj4zbS00mRzJ3Ogh`。公开业务合同与R01相同，入口不同；不能当作另一种业务任务。21个可见工具调用19completed/2error，另有一个completed bash携带真实进程exit1。

结果：验收运行器达到本阶段60次实际请求上限后中止；最后持久观察仍active，因此本次没有自然Task完成结果。实例已正常dispose、成对凭据副本退休、源文件保全。关闭后先封存中断项目，再对已有归档作一次诊断，6/6通过；这仅证明中断产物的所测功能，不能追认Task已完成。

### R02-F01：同一路径Delete/Add再次误用（已恢复）

`prt_g0VZj5E2W00tp17m0Kbv`/`call_b15db370550c435e93c49022cc615e04`对main.py组合Delete/Add，实际同样`Add File target already exists`。机制、影响与R01-F01相同，但确为第二次独立执行中的实际发生，逐次保留而不冒两个不同根因。模型随后继续修复。

### R02-F02：大段原文上下文重构错误（已恢复）

`prt_g0VZj5JXN004Om8ZYtzP`/`call_bf0d86a558ce4c169e9ab51db618f3b8`用整份旧main.py作Update上下文，其中补货append行括号与实际原文件不同，工具报`Failed to find expected lines`。属于依据非实际文字生成补丁的编辑误用；未进入写阶段。后续用实际上下文继续，保封原错误，不将最后成功覆盖该过程。

### R02-F03：模型自建测试生成器列投影错误（已恢复；40个ERROR共享一因）

- 触发：`prt_g0VZj5gDV00Ckih1VDJP`执行`python -m unittest test_release -v`。
- 实际：bash工具正常返回，但进程native1；四个test methods中generated子测试40次`ValueError: dict contains fields not in fieldnames: 'demand'`，末尾winners为空又触发一个assertion failure。
- 数据流：生成器复用了含demand的观测字典作为future数据，而future DictWriter列只有date/item/is_open和metadata。失败发生在写测试输入时，尚未执行这些归档消费者；不能把这40次当作40个业务输入失败或归档预测错误。winners为空是同一前置失败的结果。
- 恢复：模型自行把生成future的字段集合加入demand（它作为合同允许的额外metadata列），再次执行`prt_g0VZj5kcj00s9Iuoq7UG`四个test methods native0/OK，归档读取future时仍只取原required columns，不消费该标签。中断归档另经主方6/6。没有主方反馈或补候选。
- 修复方向：测试生成器也遵守原输入schema，生成输入与独立oracle分别核对。保留首次native1/完整stdout，再连接实际修复和后续结果，不能仅引最终OK。

### R02-H01：阶段请求上限在自然完成前耗尽（验收侧）

原result.status=failed，error=`E2E_REQUEST_BUDGET_EXHAUSTED`，共60实际请求；其中包含预检和R01，不是R02独占60。该上限由验收脚本设置，不能据此宣称OpenCorvus超时、死循环、调度失效或产品不可能完成。最后一个已接受Provider reader正常EOF；这不等同于Task终态。后续三任务单独登记最多120请求，总操作侧180，旧历史额度仍退休。

### R02-P01：上游Provider一次HTTP504（服务边界；随后仍有正常响应）

原baseline/result.json requests零基index57，实际模型gpt-6.1-sol、streaming=true，HTTP504，provider-source-reader.state=http_error，receivedAt=1793538268689。该时间在R02活动窗口；该失败reader没有绑定requestContext，故精确session/相同操作的重试关联未知，不能补造。总60事件为59个HTTP200和一个504，不能写全部请求200。后续两个已接受请求正常200/EOF，说明系统继续运行，但不单凭此证明504的原操作已精确重试成功。原返回体/上游网关内部原因未采到，未知；不是SQLite/预测错误，也没有共享调度故障证据。建议保留请求关联和明确的服务错误、实际恢复证据，不能靠增加盲重试或把最后成功覆盖首次失败。

## R03：修后预测coding

入口`ses_-zUQGtLGLzztUzaTmtpj`。自然完成，startedAt=1793538472780，settledAt=1793538734185；本run实际请求计数28−2=26，另两个预检属于阶段级。24个工具调用全部completed，未观察到tool-error或非0 bash。最终原pyz在同样六个固定输入全部native0，选择/MSE/正式预测/补货均逐项相符。所测范围无交付故障；这不是零风险或总体故障率结论。

已完整阅读main.py、build.py和HANDOFF：csv.DictReader/newline处理保持准确字段，fit仅train，validation单独评分，Fraction作精确比较，selected实际进入每条plan，build将同main.py封为__main__.py。HANDOFF实际披露8组归档自测和覆盖范围；主方依据是原六输入外部消费，不据其报告自评给分。

前后operator业务prompt和六输入/期望相同。R01也6/6，因此不能声称质量提升。R01两次恢复工具错误、R03未观察到工具错误只是本次事实，不足以归因说明修改或证明误用率下降。R02没有自然完成，不能以其预算中断与本coding时间作入口效率排名。

## R04：manifest文件归档Task

入口`tsk_g00VZj7l5b00HL9EHhy9`。自然完成；startedAt=1793538735760，settledAt=1793538960327；实际请求53−28=25。24个工具调用全部completed，未见tool-error或非0 bash。原三个固定消费者全部native0，实际ZIP payload逐字节和索引逐值相符：二进制/空文件/嵌套及重复basename、Unicode/空格/逗号、manifest顺序。主方完整读main.py、build.py和HANDOFF，随后发现并复现下述原池漏测的合同缺口。

### R04-F01：将ZIP路径规范误套到本机source，误拒合法Windows输入（最终交付缺陷，未补候选）

- 公开合同：source是相对INPUT_DIRECTORY的文件路径；target才明确要求forward-slash ZIP路径。本轮实际声明和运行环境是native Windows。未授权将所有本机source也限定为forward slash。
- 触发输入：原nested-binary完整业务数据不变，只把manifest.source的`left/a.bin`、`right/a.bin`写成本机相对路径`left\\a.bin`、`right\\a.bin`，target仍为`delivery/raw/a.bin`和`other/a.bin`。注册后先用实际Path读取，三个源的字节均与原输入相同，未逃逸或修改源。
- 预期：原三个payload的字节与目标路径、索引完整相同，程序native0。Python官方[Path采用本机路径语义](https://docs.python.org/3/library/pathlib.html)，且实际源读取已经正向成立。
- 实际：已封原deliverable.pyz执行native1，stderr=`error: paths must be relative and use forward slashes`。没有生成合格ZIP交付。候选前已经保存的正确witness对同一输入native0，ZIP与独立payload/index完全匹配，排除了不存在文件或原输入字节错误。
- 根因/控制流：main.py `relative_parts`统一在包含`\\`时抛ValueError；`load_entries`分别对source和target调用同一函数。两个接口各自的合法表示不同，共用validator导入了target侧更窄的规则。HANDOFF也把这个额外限制写成要求，但报告不能单方面缩窄原合同。
- 影响：使用普通Windows路径生成manifest的用户会在数据打包前失败；本轮没有内容损坏或越权证据。严重度为明确可复现的输入支持/完整交付缺口，不是Provider、调度或性能异常。
- 复现：原根`post-delivery-native-source-path/assessment.json`保存完整argv、cwd、JSONmanifest、源证明、原pyz及对照witness的实际stdout/stderr/native和期望内容；原`probe_native_source_path.py`可定位此次原观察逻辑。源程序未修改，未再调用模型。
- 修复建议：source按已声明本机Path语义解析并验证相对/边界/真实来源，target单独遵守ZIP命名合同；用同一业务内容在本机两种合法源分隔表示下消费最终归档。应验证实际来源与输出内容，不能只加反斜杠关键字特判或调整验收期望。
- 证据边界：这是完整交付人工复核后，先登记再对封存原件的一次具体合同诊断。不是原事前三个输入之一、不是heldout新模型试验。原3/3不回改，但不能再将其当作完整合同通过；当前交付保留此未修缺陷。

## R05：SQLite库存批次导入Task

入口`tsk_g00VZj8i3400dTaAvK8t`。自然completed，startedAt=1793538962229，settledAt=1793539161541；本run请求80−53=27。26工具调用25completed/1error，另一个completed bash包含真实native1自测。最终原pyz三输入全过：普通成功native0、引号/Unicode/多行/列序与metadata成功native0、不足库存native2且错误code/record/item正确，物理重开后整个批次的stock和审计行均回滚。原用户schema、cost_index、触发器、user_notes、保留行与PRAGMA integrity_check相符。

主方完整阅读main.py、build.py和HANDOFF：DictReader/参数绑定、普通INSERT/UPDATE、BEGIN IMMEDIATE、commit一次/异常rollback/finally close都与所测行为一致。HANDOFF明确七组自测及SQLite INTEGER范围、DB与JSON report不能跨文件原子提交的限制；没有把自测数量当完整数据库安全保证。

### R05-F01：自建SQLite测试连接未关闭，Windows临时目录清理失败（已恢复）

- 触发：`prt_g0VZj91N0001HkEXTF7x`执行`python -m unittest -v test_importer`。
- 实际：进程native1，六个test methods出现WinError32/PermissionError；被占用的是临时`actual stock.sqlite`，异常发生于TemporaryDirectory清理。不能据此认定六个库存算法或事务回滚错误。
- 根因：模型首次测试的建库/独立观察函数用`with sqlite3.connect(...) as db`，该context管理事务而不保证close。SQLite连接仍占Windows文件句柄；原工具输入保存这份源码，原异常栈从tempfile/shutil的unlink到PermissionError。
- 恢复：模型自己改为`contextlib.closing(sqlite3.connect(...))`，需要事务的建库路径显式提交，随后原测试七组native0/OK；最终业务程序原本已有finally connection.close，主方三输入物理重开也通过。因此本次是测试/验证工具实现错误及额外恢复成本，未观察到最终程序句柄泄漏。
- 影响与建议：会使正确业务行为被失败的自测环境掩盖。按真实API契约分别管理事务和资源生命周期，实际运行并核对最终消费者；不能忽略清理错误、强删目录或将它报成生产调度故障。主方自己的新消费者准备阶段也独立出现同类错误，已在主方问题区保留。

### R05-F02：修连接生命周期的补丁沿用非当前格式上下文（已恢复）

- 触发：`prt_g0VZj93V300h2ChoyJM0`/`call_972a3937f7a44b4eabf6a4674ae718e4`为test_importer.py增加closing和commit，依赖特定executemany多行布局。
- 实际：`Failed to find expected lines`，没有应用该次改动。上次apply_patch会真实Format.file后重读并更新metadata；源码核查排除了“metadata仍声称格式化前文件”的猜测。模型未先核实际当前布局便构造下一补丁。
- 恢复：接着`prt_g0VZj94c600hRxfKjGxF`读取test_importer.py前85行，再以当前文字构造`prt_g0VZj95l000MGpjdk4Ic`补丁，成功，后续真实测试通过。保原失败而不以最终OK遮蔽。
- 影响：一次恢复中的额外工具失败；没有最终业务数据损坏证据。当前工具说明虽已要求读实际上下文，仍发生了该问题，说明提示实施不能当行为根治证明。

## 主方检查工具问题（与OpenCorvus候选分开）

1. 首冻结脚本混用package cwd与repo相对路径，freeze/copy失败但PowerShell继续启动baseline。输入/预期源在启动前已写并测试，副本晚存；不伪事前完整归档。后续一次同类路径错误因ErrorActionPreference=Stop在任何新模型前终止，改绝对路径才启动after。
2. 首新增SQLite消费者未显式close sqlite3连接，Windows清理临时目录WinError32；只修seed/snapshot连接生命周期，在新v2目录重跑同正确/原错误programme后正常。非候选数据库异常。
3. 一次读取UTF-8 trace漏encoding触发cp1252解码错误，只重读原数据，未重跑候选。
4. 首根apply_patch Delete/Add组合被工具拒绝，未改文件；随后精确替换。root自身同类误用也如实保，不把它列为模型产物失败。
5. 首canonical工具统计读取了status而不是原表data.outcome，初观察显示unknown；查询真实字段后改为outcome，128request/128outcome完整保，5failed、123completed、pending0。原initial脚本/结果保外部；这是观察器字段错误，不是工具事实缺失。

## 结论范围

五次实际执行、三类业务任务：R01/R03/R05支持所测有限交付正确；R02预算中断、不支持自然完成；R04原固定池通过但有一个真实合法源路径交付缺陷。过程层合计5个失败工具outcome和2个native1自测调用，按逐次七个恢复故障记录；另外单列一次Provider504、一次验收侧预算中断。它们不是十个同性质的产品bug。

本轮合计140实际gpt-6.1-sol请求全部streaming，139 HTTP200/1 HTTP504。修后80请求全部200；两个隔离实例正常dispose、成对副本退休、源auth/models保全，当前没有活跃本轮模型或服务，不再查询退休服务。底层计费未知，不能把内部零成本或缓存作免费证据。

修前已经能按验证质量选正确正式策略，修后同样通过不能作为量化提升或根治证据。R04和R05也表明一般验证/工具使用规则没有保证所有合同边界和编辑行为正确。未覆盖任意大数据/数值极限、崩溃并发、多SQLite/Python版本、统计成熟及总体故障率。本轮不补封存候选、不重模型救成功、不恢复十题心跳。
