# 新一轮逐次详细故障清单（续R01–R05）

历史原件和故障见[上轮清单](../2026-11-01-outcome-quality-repair/FAULTS.md)。旧R04-F01不被新交付覆盖。本轮每个执行进入真实OpenCorvus Session/Task/流式Provider/工具，再由独立消费者读取原最终pyz及真实数据。过程错误、交付缺陷和主方工具故障分别记。

## R06：同原公开合同的全新归档Task

Task `tsk_g00VZjH6bI00LSmU24SV`，自然completed；原公开合同、原型和operator prompt与旧R04逐字相同，新模型没有收到旧源码、旧失败说明或私有输入/参考。请求增量55，canonical工具53请求/53结果（52completed、1failed），pending0。最终原pyz四项消费相符；模型后消费者布尔类型修复再消费仍四项相符。原发布snapshot `265fa50f-fcd2-5d1c-a3e6-8d31463ed561`/attachment与执行pyz字节一致。全源/build/HANDOFF已读。

### R06-F01：最终资源复核使用了Task根之外的目标路径（typed错误后继续）

- 触发part `prt_g0VZjIUwO00m9JrW9RDN`、call `call_784b79b2d54341c78f8fc47d51cc74ca`：write以公开attachmentUrl下载刚发布资源，filePath实际为`C:\Users\hengu\AppData\Local\Temp\opencorvus-test-run-XLnNJr\runner-9312-MhKylz\runtime-root\tmp\review-delivered.pyz`。
- 实际：TaskProcessBoundaryError说明目标位于当前Task精确process root之外；未执行该次写入。不是该资源本身不存在或业务归档source不合法。
- 合同区别：模型工具写权限属于Task操作授权域，业务程序的本机source允许域属于用户归档合同。根因修复不能通过关闭工具权限保护来“放行”这次操作。
- 恢复：模型随后用项目内.review-delivered.pyz继续原资源检查；后续最终消费者结果另记，不把这次错误归为最终功能失败或共享调度异常。
- 根因层级：原始绝对参数已指向runtime tmp，write对相对参数使用Instance.directory；不是共享cwd解析把项目相对路径错解到外部，也不是源路径合法性故障。保安全边界，记录为模型选址失误。
- 证据：原bundle-trace的input/failure、`runs/R06/canonical-tools.json`和之后项目内write/read/bash；完整原trace在original-traces.zip，资源绑定见observed-runs.json。最终产品没有因该次过程错误失败。

### R06-V01：作者自测的本机路径正向覆盖仍不足

新实现已经分开source和target验证，实际消费者中的本机路径通过。但原test_delivery.py仍使用正斜杠source；target反斜杠错误测试不能代替source合法本机表示。没有观察到新的功能失败，不计为一次runtime故障；它限制了“模型自验习惯已修复”的结论。当前通过来自独立消费者真实执行，而不是把随机内容/文件数量或模型自述当覆盖证明。

## R07：真实HTTP批量文档下载Task

Task `tsk_g00VZjJNJk00aPMKO3pr`，自然completed；请求增量21，canonical工具20请求/20结果（19completed、1failed），pending0。三项真实消费者均相符。原业务`part/one`请求为`part%2Fone`，字面`%2F`请求为`%252F`，空格/加号/百分号/问号及Unicode片段也保持单路径段；本机输出路径、原ID/receipt、二进制/空文件字节相符。全main/build/HANDOFF/demo已读。

### R07-F01：apply_patch沿用格式化前源码上下文

- part `prt_g0VZjJyX200pHxau9Sg2`、call `call_fc3997079a994183b71cd6eb75e12816`。补丁期望URL赋值是一行`base_url.removesuffix('/') + '/documents/' + quote(...)`；当前文件实际已被格式化成多行。
- 原工具报`Failed to find expected lines`，同批还含build/HANDOFF改动；该次校验拒绝，不能算写入成功或功能消费。
- 根因是作者对当前源状态的认知过期，未先读取实际上下文；不是URL合法性、网络、Provider或调度失败。
- 模型随后读实际main并重做补丁，后续打包、自验和最终外部GET/文件消费成功。过程故障已恢复，不另造产品扣分。
- 原输入/错误全文见`runs/R07/canonical-tools.json`和original-traces.zip。`artifact_snapshot`成功发布snapshot `71e68db6-ce40-595e-a7a3-6898e0740ea2`；原snapshot程序与被消费pyz字节一致。只搜publish命名工具会漏掉这个真实发布事实。

## R08：温度换算与校准报告Coding Session

Session `ses_-zUQGfYK9zzL1TFMvcI2`，自然结束；请求增量23，canonical工具21/21completed，pending0，无非零bash。四项真实消费相符：-40C/-40F/233.15K等温；先换算再校准和阈值；绝对零度原单位边界；-1K按合同返回native2、success:false及准确BELOW_ABSOLUTE_ZERO/sequence/sensor。最后一项是正确错误响应，不冒成功报告或native0。

原main/build/HANDOFF已读，使用精确Fraction/Decimal换算，原单位下界先于校准，ID文本保留。Coding入口的正式交付是项目pyz，不要求Task snapshot；没有snapshot绑定记录不是交付失败。本轮未观察到工具或最终功能故障；四项通过不外推任意精度/输入/环境。

## 主方工具/测量修复

准备新温度消费者重用数值JSON比较器时，发现bool是Python int子类，旧numeric分支会误拒合法True/False。修改该唯一helper先比较真实bool类型及值，正向成功/错误对象测试通过；旧forecast没有bool预期，旧原成绩不改。此为检查器实现问题，不列作新模型故障。模型前实际HTTP和温度完整正确/错误programme均进入真实消费者验证；这些参考不是模型产物。

模型结束后按登记审计当前同语义调用，workflow index/report仍直接使用Python `==`，漏过了JSON类型。原正确witness只改空文件bytes为false、或库存success:false为0，两份完整错误programme实际都被冻结初版全项误收。当前唯一workflow改用现有same_value后，空文件两case及库存错误case被检出，其他项相符。R06原pyz按受影响消费者再验仍四项全相符。保`typed-json-before.json`、`typed-json-comparison.json`和前后完整输出；不补模型、改预期、旧评分或将主方工具错算作模型故障。

提交前复核发现共享数值helper默认1e-8不能直接用于原来精确相等的bytes/计数。当前helper递归传绝对容差，workflow明确0，forecast/温度维持原默认。最终`precision-recheck/`中R06仍四项相符，false字节数、success:0、以及字节数多1e-9的完整programme均检出。6项聚焦Python测试再过（含微小错误完整programme）。这是工具合同保护，不增加模型故障/题数或回填事前测量充分性。

root的首次发布资源收集仅识别attachment URL，R07通过artifact_snapshot发布，最初binding数组为空。随后读真实artifact_snapshot输出/存储契约补原snapshot资源绑定，字节一致；保observed-runs.attachment-only.json外部首观察。是观察覆盖缺口，不是候选没发布，也没有再运行模型。

## 当前结论边界

三次运行原控制器native0，Provider101次gpt-6.1-sol/streaming/200（预检2，三run增量55/21/23），canonical94/94全终态。自有实例正常dispose、成对副本retired、源字节保留。没有新生产共享调度异常证据。旧R04错误原件和本轮过程错误不被新结果覆盖。

旧误拒/旧测量盲区已直接复现并修到共享规则与唯一消费者，新原件及两个不同领域的已测消费均相符；R06作者本机正向自验仍缺直接证据。没有修前修后随机对照、总体故障率、模型排名、小时或全域根治结论。50项后端测试、6项真实Python消费者测试、core类型检查通过，只补工具与实现验证；业务结果仍以上述原程序/真实输入输出为准。
