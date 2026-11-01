# 模型自产测试的语义覆盖：新任务有限对照

用户要求追清R06为什么实现正确而自测仍漏合法本机源路径，从共享层修复，并用不同新任务记录真实自验。原根`D:/opencorvus-benchmark-runs/self-verification-coverage-e2e-20261101`；[Recall与事前计划](../../records/2026-11/2026-11-01-self-verification-coverage.md)。

已有直接证据：R06 owner原正向测试与内部Tester额外七次执行都只用正斜杠source。只在评估副本恢复“拒绝本机反斜杠source”这个错误，原owner正向测试、原Reviewer脚本仍native0，外部合法本机case失败。原测试/原交付不改。这证明原自验对该缺陷不敏感，不是自验改善证据。

五次新执行已自然结束。两个新完整领域各修前/修后一次：SQLite查询导出Task、UTC台账Coding Session。修前两题已经有判别性，故在after启动前另登记一次新归档回归R13；初始registration与修订after-registration均保。公开材料/初始原型/私有预期的来源和比较不改，私料不给模型。

| 原件 | 模型自产测试证据 | root外部消费 | 效果判定 |
| --- | --- | --- | --- |
| R09 修前SQL | 六项原回执；复杂标识符/字面值/类型/源库保留；错引用规则被原测试检出 | 3/3 | 修前已有覆盖 |
| R10 修前UTC | 七项原回执；混合offset/UTC分日/微秒/精确ID；重标UTC错误被原测试检出 | 4/4，含正确native2 | 修前已有覆盖 |
| R11 修后SQL | 五项producer原回执；模型Reviewer另作54 exports+两次empty。NUMERIC补测归Reviewer | 3/3 | 回归保持，不能计收益；存在禁委托违约 |
| R12 修后UTC | 六项原回执；offset/UTC分日及固定期望；错误规则被原测试检出 | 4/4，含正确native2 | 回归保持，不能计收益 |
| R13 新归档回归 | producer自己写并运行test_native_source_separators，实际manifest source含反斜杠，调用复制的pyz并核ZIP完整内容/index | 4/4 | 目标漏项出现一次真实自产覆盖变化，非全域根治 |

R13关键证据在[runs/R13/source/test_delivery.py](runs/R13/source/test_delivery.py)：物理文件由Path创建，manifest source明确为`sub\\native.bin`、target仍为`folder/native.bin`，`run_app`调用复制的最终pyz（-I、异地cwd），`inspect`核完整成员/精确字节/index。Windows原模型回执`prt_g0VZjc8Dj00mPyTldJ3N`和`prt_g0VZjcPQ100j4gHdAh1S`均显示该方法实际ok而非skip。三Task发布snapshot的pyz与被消费项目pyz字节一致，Coding正式项目pyz另保，不新增必须有HANDOFF.md/Task snapshot的门槛。

root随后只在评估副本恢复“合法反斜杠source拒绝”，原测试字节不改，R13该正向测试native1（其被测错误程序native2）。原R06的owner正向方法和内部Reviewer脚本对同类错误仍native0。敏感性核验的执行者是root；模型自产覆盖来自此前原Tool回执和原fixture/断言链，不把root事后运行或外部四项通过计为原模型执行。见`after-test-sensitivity/results.json`、`original-r06-sensitivity/sensitivity.json`及`self-verification-assessment.json`。

两真实phase共177个实际gpt-6.1-sol/streaming/HTTP200，177个source-reader均settled；165 canonical Tool请求/结果（159completed、6failed、pending0）。另有5次Bash非零，共11次过程Tool/native故障；禁委托违约另外记录，不合成质量分。before/after控制器均native0，自有实例/成对副本正常退休、源字节保留。source model/credential不进入投影，fixture-only启动测试的auth.json为显式空对象，不含凭据。资源/成本和活动小时不据请求数推断。

`runs/R09..R13/source/`与source-and-program.zip是原模型源/交付投影；`participant-messages.json`保原交接与作者身份；canonical-tools来自关闭后的原生产SQLite。两phase original-traces.zip保完整原观察，原生产DB和含Git/发布资源的完整项目ZIP在外部原根保，位置/大小见export-receipt和各run location。约5.6MB投影不冒完整workspace。保存的模型测试是原证据，不注册为仓库的自动测试；root敏感性仅运行指定正向方法。

详细逐次问题续[故障清单](FAULTS.md)，原R01–R08见[上一轮](../2026-11-01-contract-domain-repair/FAULTS.md)。R11违反原不委托约束仍未满足；恢复后的夹具/连接/patch/路径问题不被最终通过抹掉。源码/交接和实际CLI/HTTP/数据库/ZIP数据已逐项复核；50项聚焦后端、9项Python及core类型检查通过，Git发布以真实后续收据为准。小样本、顺序和随机性限制保留；只观察到目标case的具体自产行为变化，没有整体改善率、唯一提示因果、全域根治、小时或模型总体优劣结论。
