# Tool有限执行期限：独立实现审查

最终追加资格已完成，当前无实质阻断，可认可本轮实现与所列资格；见 [FINAL-ADDENDUM.md](FINAL-ADDENDUM.md) 和 `stage-assessment-final.json`。下文原阶段的pending表述保留为当时记录，不倒改历史。

对当前所审的固定deadline、SDK执行边界、Bash物理收尾和MCP取消投影，未发现尚存实质代码阻断。最初反馈的异步迭代返回形状、deadline构造保护和物理cleanup截止不一致已在当前修订中关闭。**认可范围限这些实现与已验路径；主方仍须对最终固定源码完成最后聚焦回归/类型与文档检查，不能据此宣称旧L06运行已热修或候选业务已通过。** 此处不认证所有任意第三方Tool都具备长程治理。

只读源/原件，未改主仓、提交或操作原候选/容器/用户服务。实际新增仅本目录的局部SDK/monitor探针，没有Provider、模型、solver、GPU、Docker或UI，无再次委托。原完整源审的45份快照和旧occurrence在l06-idle-shared-review-20261029，本目录另保存实现初版及审到的修订，不覆盖历史。

## 源码链与边界

`tool/execution-deadline.ts`真正武装固定绝对截止，组合外部取消，timer按宿主有限范围分段，deadline及settlement时间冻结。WeakSet品牌只有同模块实际对象能获得，dispose后撤销；普通字典不能取得资格。它不是Task总墙钟/词元限额，也没有按工具名称/命令字符串开例外。

`session/loop.ts`的内部typed observer先断言真实对象和running Part，再经唯一appendToolProgress保存期限事实，随后向本processor的活跃SDK call授予hold。普通ctx.metadata、MCP结果或package数据里的同名execution_deadline并不进入授权。没有新表、队列、影子工作状态或LLM工具选择流程。

`session/processor.ts`在SDK真实execute入口先标副作用边界、证明first-byte并取得该call的pause。同步返回、Promise finally、AsyncIterable finally均按真实完成结算，consumer晚到不会为已经settled调用再制造ghost owner；result/error关闭对应call。run和hold属于其activity attempt，processor实例和Session不共用执行Map。不同call保留独立owner，释放A不解开B；旧monitor注销也按对象身份，不能注销后来的monitor。已开始副作用仍不能在同assistant自动重放，原unsafe-retry保护保留。

`llm/activity.ts`安装monitor时继承既有pause owners/finite holds；SDK真实开始的first-byte证明避免先执行而首chunk尚未消费的窗口。monitor超时原cause/paused owner现在保留，不再改写成180秒Provider idle。`util/stream-activity.ts`只有pause时才应用hold，普通Provider idle不能借此延长；hold固定、释放或到期后有限观察恢复，无timer假bump或CPU轮询。

`tool/bash.ts`先在spawn前校验数值域，实际deadline构造也已进入拥有supervisor的try/finally。此前“只预校验但构造仍在spawn后保护外”确有时钟安全整数边界；当前构造失败仍进入有界disposal。terminate与dispose现在使用同一个缓存absolute cleanup deadline，取本次canonical清理窗口与已发布settlement的较早值，不再各自重新获得多段完整预算。正常、timeout、external abort、observer失败均走此收尾。原background readiness/lease另有合同，本次不把background返回后父LLM无限暂停。

`mcp/index.ts`普通catalog、scoped definition和direct Scoped API均把调用者signal传到既有callToolWithTaskRecovery；底层call/recovery/poll共享取消。没有从MCP Task TTL或working轮询制造执行lease，也未将package可重置inactivity错当固定deadline。无可信期限的工具仍受原有限guard。此变更只证明传输取消链，不能声称外部不可逆效果被撤销；Docker daemon任务也不等同于本机CLI子树。

## 第一轮实际风险与修正历史

| 观察 | 反馈/当前处理 | 证据边界 |
| --- | --- | --- |
| async execute包装把直接AsyncIterable变成Promise对象 | 当前保留sync/Promise/AsyncIterable原返回形状，迭代finally结算 | 初次读到的源码风险已反馈；初快照捕获时主方已开始修订 |
| 仅用`Symbol.asyncIterator in output`会误认非函数属性 | 当前按SDK要求检查函数 | 最终三形状独立SDK探针包括该普通对象边界 |
| settlement字段未实际约束terminate/dispose | 当前共用同一绝对清理截止 | 源审确认；不把字段存在本身当治理通过 |
| create deadline在spawn后try外；前验与创建重新读时钟仍可不同 | 当前构造在supervisor finally内，失败也有canonical cleanup | 源审确认，无复制生产进程或clock故障实验 |
| disposed deadline仍可能被当armed | 当前dispose撤销品牌 | 初快照已含修正，不伪称本审查独立发现并复现 |

原ROUND1及source-initial保留。source-reviewed为本轮后续审到的九源，不覆盖初版；其inventory中的字节比较仅用于审查对象身份，不代替功能正确性。

## 独立真实探针

没有重复主方43项回归、13条shell测试或mini40。实际运行收据如下：

- `sdk-probe-repaired-command.json`：对捕获的**确切production wrapper AST**做类型擦除，放入真实安装AI SDK，原始/包装AsyncIterable均真实yield2、两次preliminary和相同final；pause/resume各一。模型端仅SDK有限内存参与者，无HTTP/真实LLM。没有完整调用SessionProcessor，明确只认证包装/SDK合同。
- `sdk-shapes-command.json`与`sdk-return-shapes-observation.json`：针对已修函数判定，三种实际返回形状均与原SDK一致：直接AsyncIterable、带非函数Symbol.asyncIterator的普通同步值、Promise。3/3匹配，不按内部结构或源码字符串判结果。
- `finite-probe-command.json`与`finite-monitor-observation.json`：四个captured真实monitor合同通过：无pause的hold不能延长普通idle；两owner独立释放且最后resume恢复idle；有限hold不释放也会到期并保留pause/owner；外部取消保留同一reason对象。仅局部primitive，不能冒充真实Tool/候选E2E。

首个SDK探针是**审查脚本错误**：Bun.Transpiler消除了无可观察用途的顶层箭头，生成的callback为空。原sdk-iterable-observation.json的regression_observed=true无效，不作为产品反例；原命令/空JS/脚本保留，INVALID-PROBE-INITIAL.md写明。修后另存文件并断言callback类型后才进入真实SDK，未篡改原收据。

## 主方原始执行的只读核验

已读D:/opencorvus-benchmark-runs/l06-tool-liveness-qualification-20261030的原始stderr/stdout和对应当前测试源：

- real-loop-b：1项真实SessionPrompt→SessionLoop→SDK→Bash→自有标准库子进程路径通过，实际静默2.2秒超过缩短父pause1秒，生成实际文件/exit0/Tool completed，数据库ToolPartProgress有固定deadline事实。Provider是有限MockLanguageModelV3，不能当真实Provider验收或长候选。
- mcp-projection：三个真实stdio接收方分别收到tools/call后，由调用者取消；底层返回保留原因的McpError，接收方实际收到匹配requestId的notifications/cancelled。3项通过，非仅检查signal属性存在。
- sdk-owner-additions：无治理SDK工具仍有有限pause错误、并行owner独立、直接AsyncIterable三个增量测试通过。只读主方收据，不冒称本审查再次执行。

首轮real-loop resident Session清理超时和MCP fixture/错误wrapper预期修订有原件。real-loop-b通过是正确地结束本次resident Session后重验，不是据首次超时包装产品通过。43相关回归/typecheck及13 shell属于主方先前报告；最终固定源码后的必要收据由主方完成，本审查没有自行重跑它们或将较早结果当逐行最终版本认证。

## 认可范围与限制

可认可所审根因修复的结构及上述证据：父Provider不再把具有真实固定工具timeout的静默Bash执行强行截在较短pause观察窗；无治理promise及工具完成后交接仍有限；真实取消/物理收据/副作用fence保留。没有把任意deadline metadata、MCP TTL或自报working作为豁免，亦未添加Task总额度。

尚不据此认证：所有第三方工具都实现可信期限、任意远端Task被实际终止、宿主崩溃/断电、全部入口本轮重新E2E、旧运行后端已加载新源、原L06业务分数或小时级/职业/十题benchmark完成。旧Task发生过运行时干扰和自动续跑须如实保留，不能据修复给它抹去历史。

最终发布前仍须主方固定源码，完成最后受影响的Bash清理/异常路径、类型和文档检查，并保留真实命令/出口；若仅格式/文档变动，不需要重跑无关矩阵或长任务。当前没有本审查确认尚存的实质代码阻断，测试真实性与最终源码身份应由最终追加收据明确。
