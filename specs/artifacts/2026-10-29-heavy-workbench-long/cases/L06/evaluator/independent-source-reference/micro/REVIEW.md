# L06当前整数后端与source-only参考：独立微型复核

**本次冻结源码的微型source-only冷跑通过，未发现该范围P0/P1。** 认可的是当前CP-SAT后端与一周合成原始包的参考管线局部资格；不批准16周完整职业参考、其余17叶、小时级、整题冻结或十题完成。

## 实际独立执行

只复制9份实际源码、README、DATA及一周手算raw包到自有新目录。源码项目和原始输入分别只读挂载，新输出目录单独可写；唯一容器使用 `--rm --network none`，没有挂载旧矩阵、策略、hint、注册下界、rubric或16周数据。实际argv、文件清单、CID及环境镜像身份保存在cold-command.json、source-inventory.json、owned-container.cid、image-identity.json；未用源码摘要作为功能验收。

唯一Docker冷跑退出0，完整Docker进程 **5.921520700212568秒**；run.json主流程 **1.123046386986971秒**（明确不含module imports）；原生solve **0.10199418338015676秒**。三者包含关系重叠，不能相加。真实依赖为Python3.11.13、NumPy2.4.6、SciPy1.15.3、Matplotlib3.10.3、OR-Tools9.15.6755。

本次只运行了该微型CPU优化，未再次执行完整16周、LP、旧模型研究或Provider/GPU任务，未操作用户服务/进程或其他容器，未再次委托。

## 当前后端与数据路径

qualify_l06.solve统一调用l06_integer.solve_integer；当前整数路径为CP-SAT，连续linprog保留不同数学目的，历史highspy捕获不在这条执行路径。独立比较的build_model及LinearModel payload定义与此前逐输入/逐行审过的版本相同；替换是整数执行后端，不是另一套BOM/现金模型。

整数目标始终使用模型整数分子，原生objective/bound按objective_denominator缩放；融资模型由构造器使用分母1，不能按场景概率误缩放信用目标。主方已执行的6/LP3、4.5、融资5/LP2原件按实际记录审读，本轮未重复这些求解。

默认未设max_time，actual solver_options中requested/native time字段为null且native_time_policy为unset default infinite。显式solver-seconds仅用于诊断。默认worker8、seed20261029、relativegap0.009记录真实；README已将旧“unseeded”更正为无外部warm hint的新搜索。新管线未传warm_start。

本次调用链为：raw read_packet→新build_model/payload→实际CP-SAT→当前输出目录里产生的first-incumbent→同一业务checker核对主方案和局部替代→ledger/summary/run/manifest/report/三图。output和solver子目录都要求不存在，baseline读取的是本轮solver/first-plan，不是旧结果。该结论结合了只读输入集隔离、源码审读、新输出及原生事件；没有声称做过系统调用级文件读取追踪。

## 独立业务与模型核对

从raw重新按公开身份/index解析，用自己先前的标准库业务公式核算，完整primary ledger与summary逐值相同。再对这个明确微型域穷举全部12个联合选择：包装数0..2、装运0/1、生产0..1，库存由到货/生产/交付决定。只有两份完整可行策略：

| 包装数 | 装运 | 生产 | 到货/生产前raw峰 | 期末raw | 费用 | 期末现金 | 期末AR |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 1 | 2 | 1 | 6 | 94 | 10 |
| 2 | 1 | 1 | 4 | 3 | 10 | 90 | 10 |

费用分别为采购2/运费2/生产1/持有1，以及采购4/运费2/生产1/持有3。收入10尚未回款，没有被当可用现金；期末成品0、生产后交付前峰1等于cap1。这里的整数最优6由完整小域枚举支持，不只相信solver的OPTIMAL字样。

实际交付主方案6，基线为本轮第一个真实可行incumbent6；替代方案是真实不同动作、业务可行的10，没有虚构其比6更优。alternative-search和alternative-business与实际策略一致。该替代只是本模型的成本/资源比较，不包装成模型外风险收益。

从独立实际库存和控制动作映射新生成model的5个坐标，有限盒、8行整数约束与精确目标6都通过。actual native scaled bound6、分母1、objective6一致。主流程状态completed、native OPTIMAL within requested gap与实际退出及日志一致；不能将这一含gap状态一般性解释成精确最优。

manifest路径按新输出根定位，run真实argv、版本、参数及native/交付成本一致。报告6/6/10比较表、现金100+0−6=94和AR10都有独立账支持；source-map与operations定位公开字段和共同承诺，不是只验文件存在。

21项本地核对全部通过，详见independent-checks.json、independent-scalar-enumeration.json、new-model-vector-audit.json。两条未取得可行计划的输出分支本轮只审源码：run_metadata共用完整argv/依赖/参数/终态，incomplete manifest明确列缺失项；未额外声称独立执行了这些端到端失败分支。

## 三图实际视觉复核

独立agent在本次冷跑后逐一通过view_image实际打开PNG；没有UI自动化、DOM/像素断言或截图基线。

- cash.png：week0现金点94，信用底线0，标题、单位、周序、图例可读。
- cost.png：堆叠总6，四层2/2/1/1与费用账一致；从0起，外置图例没有遮挡数据。
- storage.png：原料峰2/cap4、成品峰1/cap1，两轴从0起，容量线与图例可辨。成品点在容量线上正确表达绑定。

图与数据均来自本轮ledger。图形和观察记录保存在cold-output/run/figures/及manual-visual-review.json。这只证明单周微型图形；没有据此外推16周/多场景视觉质量，也没有冒称专业人类双盲校准。

## 下一阶段边界

微型通过不证明完整16周reference已从raw冷跑交付，更不证明完整47叶或人评质量。后续完整新运行须独立核对注册基例C06；其固定L口径与本轮solver自身的动态bound/gap是不同对象，不能仅看OPTIMAL/0.009就宣布case质量通过。

完整职业报告/多场景图形/操作交接、其余执行与人评17叶、变体可达性与质量、正式fresh候选/比较和有效工作时长仍待实际资格。本轮无完整16周solver、无Provider/GPU、无暂停容器恢复、无共享仓库修改。全部独立源、命令、输入、原生输出、新账和图都保留，可供主方精确归档。
