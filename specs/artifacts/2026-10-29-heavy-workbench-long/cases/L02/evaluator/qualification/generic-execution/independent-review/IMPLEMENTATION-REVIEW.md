# L02 通用执行器：实现与局部真实资格独立审查

结论：原实施前三项已在当前实现和限定实证中闭合，可认可**顺序通用数值ABI、Windows单run所有权、同CID五窗口进程崩溃恢复、sealed对象复用和失败分类的组件资格**。本范围当前无剩余阻断。新执行器尚只真实跑了两份私有单outer诊断提交，不是新完整12outer矩阵、L02职业研究交付、质量线、正式rubric/候选分数、冻结或小时级证明。

本审查仍为熟悉原参考的单层非盲AI开发复核，未再次委托，未改主仓或启动Docker、预测、solver、Provider、GPU或UI。所有分析程序只读原件，或运行从精确源隔离出的标准库归档/聚合primitive。`stage-plan.json`和原计划问题不覆盖；当前报告作为实现追加。

## 五个恢复窗口的独立原件核验

`audit_recovery_stage1.py`修后实际0.405719秒、19项通过，命令在`recovery-audit-repaired-command.json`。原第一次自身脚本有`__name__for`语法笔误，在执行前即失败；原源/exit1/stderr保留为`audit-recovery-initial-syntax.py`及对应收据，不能当执行器失败。

我只读SQLite、实际Docker命令/inspect、三个原ZIP和checkpoint，而未采用record-assessment自报作为唯一oracle。原记录只有一条真实create、一条start和一条精确rm：

- CID：`dcda2a778fb387412c01a482ccd18c9d04dfb2b09e90b429c0ddd38740c1917b`。
- 原生StartedAt：`2026-10-30T05:06:23.954156802Z`；FinishedAt：`2026-10-30T05:06:24.281418834Z`。所有inspect一致、RestartCount=0、RestartPolicy=no。
- 五个独立driver进程实际exit81，checkpoint分别位于create已返回未登记CID、start已返回但ledger仍created、terminal ZIP已封存、accepted ZIP已写未提交verified、verified已提交但未cleanup。最终resume exit0、SQLite唯一cell verified。
- 源程序真实`/output/count.txt`和terminal/accepted中的值都是`1`，原stdout为`1\n`；prepared→terminal→accepted只增加该次实际输出/终态/验收，不换源码或输入。
- 在首窗口原owner仍持锁时，实际第二个Windows进程返回exit3/run_busy；各次os._exit后下一owner可恢复。此为Windows内核锁资格，未声称已实际跑POSIX锁或硬件掉电。

代码也只在实际Docker State=created时允许start，不从ledger created推导重启权限；running只等原CID，exited验收原终态。source-current记录证明了这些窗口；source-loop/final后来增加错误/身份边界，并未冒充原窗口逐字节执行后来的文件。

初source-initial的真实失败另核：候选native exit2且stdout自报run_invalid，SQLite记candidate_program_failed、终态ZIP仍保存原stdout/输出，随后精确清理原CID；候选自述未取得设施豁免。该证据准确绑定初源，修后同语义路径源审，不伪称新重跑。

## 两种语言的真实全链ABI与权限

`audit_generic_loops.py`只读7.343696秒，290项通过，原件在`implementation-loops/`。两份source-loop提交各11真实程序：6 inner预测、1 selector、3 outer预测、1 report，均自然exit0/verified。22组逐一核了唯一create/start/rm、原CID、固定image/argv、1CPU/netnone、只读rootfs、只读project/input、新output、独立tmp及SQLite提交后cleanup；每组内部顺序执行。

原提交/方法池与原材料逐对象绑定registration ZIP，各阶段代码只包含其声明files，原CSV和方法配置按角色进入最小input。每份预测的原CSV业务身份/原字段与独立SQL发布许可恰等，不挂入完整私有archive/outer labels/别的程序结果。selector只得到3个实际inner预测和已发布真实标签/固定尺度；report最后才收到被冻结的已完成数值结果。两次注册均明示private_author_diagnostic且complete_assignment=false，不冒称正式12outer。

18份新预测各84格，独立Fraction逐节点MSE/MAE/WIS、固定层级宏平均和inner最小ID选择均与accepted对象及当前summary一致，没有调用作者score当唯一oracle。Python实际选择ridge-weather-operations；Node实际选择其自定义ID `selected`。配置/科学方法是否有研究价值与这次格式/权限有效性分开。

Python首cell verified后driver实际exit82。原submission manifest随后被外部编辑，第一份working forecast也被改写；注册原manifest与accepted原预测仍被复用，其余cell继续使用封存方法/代码，真实resume完成。不能据此声称已经测试了所有源文件篡改情形。

Node进程的原程序/日志显示真实v22.23.4，argv使用Node而非Python桥；ID `../../baseline / 零`、`selected`和`ablation:mean`作为业务字符串保留，宿主路径始终是不透明整数cell目录。证明了这份准备runtime和语言无关ABI，不声称任意未安装语言已实跑。

## 发现及修复的真实问题

**业务ID与selected别名冲突。** 初source-current允许合法method_id=selected，但driver/summary平铺aggregate会覆盖未选中同名方法的指标。已改为`aggregate_exact.per_method[任意ID]`与独立`aggregate_exact.selected`，不限制候选ID。当前唯一`aggregate_study_metrics`供driver和summary共用固定分母。除Node实际同名ID外，我从最终源隔离该函数作两origin闭式验证：同名方法平均7、other平均3、实际所选平均4，三者分别保留；缺一必交cell明确facility_aggregate_invalid。没有重跑预测。

**归档设施错误遗漏。** 初source-current坏ZIP实际helper抛未被CLI catch的BadZipFile；source-boundaries修后常规坏ZIP已具名，但我再以真实DEFLATE数据首字节损坏得到未被捕获的zlib.error。初代码、坏压缩文件和实际类型/输出都保存在`implementation-stage1/`、`implementation-loops/corrupt-deflate.zip`及archive-helper-probes中。这两次是精确源的纯helper反例，不虚称已执行完整CLI。

最终source-final相对封存source-boundaries**只**增加zlib import及同一reader的zlib.error catch；其他文件直接同一。只重放原坏DEFLATE/坏ZIP均得到facility_archive_invalid，合法原accepted ZIP仍逐成员读出相同值。最终源另已有统一read_archive及SQLite CLI错误边界；主方原真实坏SQLite CLI为facility_storage_invalid/exit3，我只读核其收据，不冒称自己又运行该CLI。`audit_final_generic_boundaries.py`11项全部通过，未重做290项或任何容器。

真实Linux输出链接程序也已读原件：源码调用os.symlink，native exit0，但host把link.txt判为非普通可接受文件，cell记candidate_output_invalid，terminal ZIP保存无效输出inventory，随后精确rm。Windows inventory的is_symlink实际为false，不能伪称host该字段识别为true；拒绝结果来自普通文件/解析边界，目标内容未被当业务输出接受。参数重绑/旧格式/未知user_version=2的原真实CLI均具名run_invalid/exit3，原件保留。

## 实际报告/图与二进制探针界限

我实际用view_image打开`python-report-view/forecast.png`，并将其直接绑定至Python report cell11的accepted原PNG。六面板A1/A2/B1/B2/ZA/ZB、litres单位、14个assigned UTC day index、真值/选中均值/中央80%图例可读；报告MSE/WIS展示与已独立重算指标一致。程序明确其是author protocol diagnostic、full_assignment=false、边际区间无覆盖/联合分布认证。这是运输/产图资格，不是完整职业论文评分。

主方另外的binary探针失败属于**自身断言**：它要求accepted stdout仍为程序写入的0xff/0xfe，而实际封存的文字是UTF8 replacement字节`ef bf bd ef bf bd 0a`。原probe exit1/AssertionError保留；我另核真实程序native exit0、result有效、ledger verified且精确cleanup。没有实证UnicodeDecodeError，也不能推断转换发生于daemon还是CLI层。未修改日志实现、未重跑；不认可lossless任意二进制stdout资格，不能把该探针失败计入候选失败。

## 当前认可范围

三个实施前问题已有当前代码、真实恢复/两语言链与必要错误合同支持，当前限定组件无剩余阻断。版本关系、原坏ZIP/DEFLATE、初selected冲突、原断言失败及审查器语法错误全部保留。私有diagnostic不能回送给候选重提调参；正式默认完整assignment的代码路径尚无新完整12outer实跑证据，本次不给它补造结果。

下一步可继续构建完整研究/运营交付、预先质量目标与低质量对照、原子rubric/人评锚点及正式聚合；这些仍未批准。不存在用此原语检查数、两种语言、作者计算时长或已有旧120数值参考来替代L02冻结、fresh候选区分度、有效小时或十题完成的依据。
