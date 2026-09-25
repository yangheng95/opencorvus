# H-E：比较前方法记录的单一干预

## Recall与当前状态

用户要求从全局机制定位误验收，并检验反证是否真正改变判断与行动。
本设计承接[主记录G12](../../records/2026-09/2026-09-25-supervision-causal-iteration.md)、
[交接调用图](handoff-design.md)及[原关系证据](input-observation.md)。
**这是完成到可应用差异的预登记设计，尚未应用、发布包、启动运行或证明收益。**

当前读过的生产版本为Git `64c441821f5c8635e6164a6bb1fe8790e7be7a94`；
baseline为`builtin/automationbench 2026.09.25.13`，不可变包digest
`9061cb18bd24f80563430abb437afb4460843cc48fb4c4a8eaa60171e6a74a8b`。
已有Skill流程用于定义真实超时和证据层级；无子Agent委托。

## 问题、责任与唯一改动

当前失真是把“每项来源/输入存在”替代“交付结果满足原义务要求的关系”。
现有verifier和core已有独立推导要求，但真实报告没有留下可审查的方法形成边界。
H-E只预测：**先产生并保留方法，再比较实际结果，会使某些未经证明的接受变成
可指出原因的差异，并可能推动原Task的真实修正。** 它不保证方法正确，也不等于盲审。

干预仅替换`.13`的`agents/automationbench-verifier/system.md`中四行
`Compare raw mutation receipts...Retain all mutation attempts...`段。
精确差异为[verifier-method-handoff.patch](verifier-method-handoff.patch)。
其它verifier段、orchestrator、executor、core、流程图与工具权限保持同一版本。
未来包版本递增只用于不可变包身份，不是第二项行为干预；本轮未创建这个包。
不修改既有`.13`不可变存档，不产生进化作者或冒称自动进化候选。

Agent负责选择方法、判断前提与适用性、解释新反证。Host继续只核对真实身份、
来源、类型与不可变性。方法记录没有生命周期权限，不要求Host运行公式、判分或转派。
消息、工具和已见结论全部可见，不删除、遮挡或伪造producer材料。

## 精确替换段

下列英文是patch的唯一新段；它不是额外operator消息，也不传入案例答案。

<!-- intervention:start -->
```text
Make your verification method inspectable before using it to accept the delivered result.
After reading the original obligations and the authoritative facts needed to derive an
expectation, publish one `automationbench/verification-method` Artifact with the existing
`artifact_publish` tool. In its payload, record each original obligation, the applicable
conditions and preservation constraints, the method connecting its premises to an expected
effect, the exact source evidence for those premises, the derived expectation, and any
unknowns that prevent derivation. A list of available inputs is not that method. Record any
producer conclusion or actual result already encountered as prior exposure; do not claim
blindness. Actual receipts may supply original values needed for a preservation check,
but the observed final value cannot supply its own acceptance expectation.

Use the existing Artifact search and complete read to obtain the method's real read reference.
Then compare raw mutation arguments/results and current authoritative destination records
with that recorded expectation. A synchronous receipt with full record fields proves those
fields at commit time; a later authoritative same-record observation may supersede it.
An unrelated or non-reflecting query cannot by itself erase that evidence.
Publish `automationbench/verification-comparison`, selecting the completely read method
in `source_read_refs`. Its payload maps the original obligations to the method, expected
effect, actual effect, supporting source/operation evidence, and satisfied/failed/unresolved
judgment with the reason for each difference or unknown. Use `resource_set: null` when
there are no files. A copied Artifact ID in prose is not a source-read reference.

If new evidence changes a premise or exposes an error in the method, publish a revised
method with the previous method as a completely read semantic source, identify the changed
premise and its counterevidence, and compare again against that method. On continuation,
re-read the prior immutable method in the current Turn before selecting it; re-examine any
old conclusion depending on a changed premise, even if the named follow-up was narrower.
Keep previous methods, comparisons, mutation attempts and unresolved contradictions visible.
Your final participant result must identify the operative method/comparison and any superseded
judgment, and state the supported repair or remaining unknown. Producing these records does
not accept the business outcome; finding a discrepancy does not authorize you to mutate it.
```
<!-- intervention:end -->

这段替换的是可观察的产物交接，不是又添加一段“更认真/独立计算”。相比baseline，
实际需要发生方法publication→search/read→comparison publication及选源。
若模型仍只写最终报告，干预未被执行，不能将它当方法有效性的反例或成功。
若模型执行了但选错方法，则H-E的充分性被反例推翻，不能以两个Artifact成功辩护。

## 真实生产输入输出与调用边界

| 环节 | 当前生产入口 | 预期观察及边界 |
| --- | --- | --- |
| 初始verifier输入 | `orchestrator/delegated-worker-tool.ts`→`delegated-worker/context.ts`/`agent.ts`→原runner | 仍包含真实派单、原Task request、选中Slice；不承诺producer结论从未出现 |
| 方法形成 | 当前verifier的原业务只读工具与`artifact_publish` | 原作者自己选择来源和方法。外部API证据的精确Tool/记录引用放payload，不能伪造成Artifact read-ref |
| 方法→比较 | `tool/artifact-catalog.ts`的原search/read/publish；`agent/artifact-read-facts.ts`解析当前Turn完整读取 | search返回真实locator ref，分块读完再选`source_read_refs`；不能把同一并行Tool step内尚未读到的返回当已读事实 |
| 方法更正 | 同一publisher及原read-ref | 新产物关联旧方法，旧产物不可改写。未知前提不能自动补成零、缺失或不适用 |
| Task返工 | 同一worker Session continuation、原真实participant final、原scheduler | scheduler没有新提示或自动路由；是否读取并据此派真实修复本身就是测试结果 |
| Mission裁决 | 原当前终态证据与Panel Tool | 是否接受/提出gap按原权限；不要求人为触发G10或虚假终态来制造纠错 |

路径相对`packages/opencorvus/src/`。当前generic publisher已经支持这些命名空间和任意
JSON payload，故不新增typed publisher、schema、状态表或工具。字段含义由原Agent判断，
它们不是第二份验收ledger。没有把G3的离线计算器接入。

`02-data`和原Task completion合同会要求terminal node的全部current expert_output进入
完成证据或交付集合。因此方法、比较和被更正的旧方法均可能随Task进入Mission复核。
不得隐藏旧错方法或将其从Host目录移除；最终报告要说明有效引用与改判原因。
由此增加的读取、tokens和延迟必须计入成本，不能把旧方法的存在当当前接受。

## 预登记的最小行为对照

固定**两个episode，不追加样本**；一次baseline、一次treatment，各为独立新host/项目/
官方世界，以相同Mission入口执行同一`sales.create_new_opportunity/9`。
选择它是因为原义务和可公开验证的关系已有明确反例，不因新分数换例。
它是开发机制复现，不能叫独立留出、完整Campaign或总体效果实验。

| 固定项 | 预登记值 |
| --- | --- |
| 次数和顺序 | B1 baseline先，T1 treatment后，各一次；每个自然收尾后才下一次，无替补 |
| baseline | 上述不可变`.13`；全部角色/工具使用同一当前运行源 |
| treatment | 仅此patch的verifier段和不可变版本身份变化；精确新包版本/digest须在首次模型请求前落盘 |
| 模型 | 所有内部角色/压缩/预检都为流式`openai/gpt-5.6-luna` |
| 官方输入 | `specs/artifacts/2026-09-24-automationbench-self-evolution/probe-manifest.json`中的sales/9原SYSTEM/USER、world clock和scorer，两个世界同一初始配置 |
| 环境/超时 | 沿现有Inspect outer none、真实无活动300秒、poll2；不增加请求/总时长预算 |
| 预留目录 | `.tmp/supervision-causal-20260925/he-01/B1`与`he-01/T1`，单一controller；路径存在则查明身份，不覆盖/重启 |
| 观察 | 原官方Tool/Artifact/participant/Task/Mission/评分；两臂同启G11已登记输入探针，另在同一配置中登记新段原文片段以观察投影，探针不传给模型 |
| 费用 | 每臂全部请求、每条可得usage、缺usage数、tokens、Tool、时长，方法交接的额外成本一并计算 |
| 收尾 | 原公共API只处理本轮自有残留，核对零活动、host退出、auth/models复制件删除，完成后原证据只读 |

**本文件尚不是启动冻结收据。** 还缺新包实际加载/材料化的确切身份、两臂共同source SHA、
实际manifest/Inspect参数解析结果、目录未占用及成对auth/models预检。
这些在未来实施后、首个模型请求前统一落盘；不能用占位字符串或“与原来相同”代替。
本轮不装包、不使用凭据、不发预检或模型请求，也不改旧controller。

直接复用已有`run_factorial_trials.py`的host/Inspect/公共cleanup primitive；不得重新设计
平台或恢复旧矩阵。旧cycle脚本只作只读入口参考；不能直接重跑已使用目录。
当前`.13`原包只读位置已由Cycle3实际controller确认，为
`.tmp/automationbench-eligibility-20260925/task/TS/runtime-root/data/expert-squad-package-revisions/v1/`
下的上述完整digest目录。未来必须由原loader核验其身份，不能把当前可变源码目录当该原包。
两个episode不保证executor产出相同，也没有盲审/等token控制，因此前置业务状态、
来源曝光和努力量差异都可能解释结果。报告逐条链路，不把两次运行之差当随机因果量。

## 区分竞争解释的实际判定

每项用满足/违背/未知，附真实Tool/Message/Artifact引用与时间顺序。
模型自称“独立”不是证据；输入文字的精确匹配也不证明理解。

| 观察类别 | 判定及允许结论 |
| --- | --- |
| 投影/可达性未知 | 无对应verifier请求的可靠身份/片段位置或缺原始来源，不能声称已排除数据流解释。G11只有局部片段；不能补写完整wire |
| 已执行交接，但先形成错误方法 | 若原义务/必要源可见，错误在方法形成或适用性判断；单靠顺序产物不充分。不能直接定性整个模型弱 |
| 已遇producer结论后才形成方法 | 记录污染来源；不能称排除了锚定。仍可观察它是否修订该解释 |
| 初始方法合理、比较后向错误实际值改判且没有支持反证 | 支持结果牵引/自证的行为解释；不将正式read-ref当方法正确证明 |
| 正确差异但scheduler未派修正或仍accepted | 断在判断→行动/裁决；不能宣称H-E完成纠错，也不能再只改verifier文案 |
| 真实同Task修正、verifier再验、Mission基于实际结果裁决且原成功义务保持 | 仅支持该次链路闭合；须同时报告baseline和成本，不自动推广包或宣称进化收益 |
| 两臂都直接正确交付 | 只支持正常路径与干预执行情况，没有自然纠错机会；不补跑直到制造失败 |
| 两臂的executor原始结果/已见材料不同 | 方法和曝光事实可描述，但纠错机会不同；不能把最终分差单归verifier干预 |
| 未发布方法或比较未真实选源 | 干预执行失败；如是确定Tool/引用错误再按真实合同修，不能靠补造产物计入效果 |

对本例方法正确性的审定只能来自原请求与公开价表/人数/等级/更新/政策的实际字节和
适用顺序；将它们的计算关系单列复核，不能只看数值、关键词或官方strict分。
审定同时检查原请求中的Account/owner/stage和其它保持义务，不能只修一个金额。
operator审计知识和历史正确值全部留在评估侧，不传入模型或隐藏的第二消息通道。

## 失败处理与决策边界

- 无分、runtime失败、用户中止都保持null及精确原因，不当0，不补分、不替补episode。
- 明确共享数据/生命周期故障：保存原事实与进程身份，正常收尾当前自有运行，停止该对照；
  剩余项记未运行而非0。先共享横审，不把故障当方法能力证据。
- 自然语义失败：保留原分和全部交接，不中途喂答案/手改业务值。完成既定两个样本后停止，
  不能加提示重抽或临时开新作者。若已无可区分的信息则说明未解决原因。
- 只有方法、比较、实际修正、保持义务均有证据才讨论下一步扩大验证；两次样本不足以
  证明可靠性或选择进化父代。Campaign/metric/review/comparison/promotion仍是独立路径。

结果表固定为每臂：原strict/partial、原生终态、交接是否执行、方法正确性/未知、
producer暴露、差异判断、实际修正、保持义务、成本；null单列。
混淆矩阵只用Markdown，原业务歧义另记，不画图或修改官方评分器。
