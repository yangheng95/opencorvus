# H-T精确设计：将预期形成放到新执行之前

G24已另行完成[H-T01行为预登记](ht-01-preregistration.md)，使用这里的不可变隔离设计包。
本文件保留G23本地检查时点；实际启动和结果以新ht-01 freeze/controller为准，不能由
下列本地合同推断已经运行或业务通过。

## Recall与范围

用户“怎么不做了”纠正了[机制决策](mechanism-decision.md)后不必要的等待。原无人值守
授权覆盖本地设计与检查，本轮继续完成这一步，不以未证明效果为由停止有信息的工作。
此前失败及停止重抽的决定保留，详见[主记录G23](../../records/2026-09/2026-09-25-supervision-causal-iteration.md)。

这份[未应用补丁](expectation-first.patch)把同一专家团的可见协作从executor→verifier
变为原verifier前置方法节点→原executor→原verifier最终复核节点。唯一研究变量是
**新producer结果产生与预期形成的先后关系**，同时有必要的阶段职责和交接改动；不能
把它说成仅一句prompt或没有额外成本。这里没有证明效果，没有新模型运行登记。

## 精确差异与当前实现

| 文件（相对原包） | 当前`.14` | 隔离设计副本 |
| --- | --- | --- |
| `expert-squad.jsonc` | `execute-verify`两节点，verifier依赖executor | 同workflow ID增加`automationbench-expectation`，使用原verifier角色；executor依赖前置节点，最终verifier依赖executor |
| `agents/orchestrator/system.md` | 执行后交接原请求/实际结果给verifier | 先派原verifier做expectation formation，真实读取方法后交接executor；最后另一个节点做outcome verification；后续复核回到最终节点 |
| `agents/automationbench-verifier/system.md` | 同一后验阶段发布方法与比较 | 按真实delegated instruction的阶段区分前置方法、最终比较；前置不声称交付；后置可以用新反证修订错误方法 |
| `README.md` | 执行后复核 | 明示两worker角色/三节点/新增成本及未验证状态 |
| executor、selector、权限/core | 原字节及能力 | 保持；无新角色、工具、Host gate、计算器或第二ledger |

未应用patch共四个文件改变；原生产source及原不可变`.14`仍保持。设计副本只在
`.tmp/supervision-causal-20260925/ht-local-design/staged-squad`，真实loader产生的
不可变副本也只在该本地检查runtime内，没有安装到用户项目或发布为更优父代。

原版本格式只允许`YYYY.MM.DD.N`。首次设计使用`2026.09.25.15-ht-design`被原loader以
明确ZodError拒绝；已改为合法的`2026.09.25.15`，未发布身份由本设计及收据说明，不
放进不合法版本后缀，也未放宽schema。原失败记录保留在`checker-run/failure-review.json`。

真实loader/reload的设计内容身份为
`a231dffdaed86a638cb8cc0995eab387a67dba8d70330980b37210553fd37b40`；它只确认这六个
不可变文件的身份和完整性，不是效果验收。原`.14`重新加载为原
`b4c645f4a90c002e83842c46d56afbb1563ee24f7a9cb215f2488a1d9d379f93`。

## 三个真实责任节点

| 节点 | 角色及输入 | 预期的真实输出/消费者 | 不能代表什么 |
| --- | --- | --- | --- |
| `automationbench-expectation` | 原verifier；完整原请求、原环境；真实instruction明确expectation formation | 自行发现来源，原artifact_publish发布方法/预期/未知；scheduler读真实participant及完整Artifact | 新executor尚未发生，不得声称其业务效果已经满足；未知不等于不可完成 |
| `automationbench-executor` | 原executor；原请求、实际前置方法的不可变坐标和未知；自己取得本Turn read-ref | 把方法视为可质疑主张，自行核对前提、进行原授权的修改/读回并报告 | 前置方法不是正确答案或新权限，不能盲目复写 |
| `automationbench-verifier` | 原verifier但独立节点/Session；原请求、前置方法坐标、真实executor证据；instruction明确outcome verification | 完整读方法，独立核对来源与实际结果；方法错则保留旧方法并发布有反证的新方法；比较引用有效方法 | 前置方法发布、后验引用和节点terminal-success都不是业务通过 |

初态已有的错误record/description可以在任何阶段被正常读取，不能删掉、隔离或隐藏以
制造盲审。前置节点消除的只是尚未发生的新executor报告曝光，不消除既有文本和模型
先验。如果前置方法已错，只能否定“新executor报告是该错误必要条件”。

## 真实代码交接边界

本轮审查路径相对`packages/opencorvus/src/`，SDK另列：

| 边界 | 事实与本设计处理 |
| --- | --- |
| manifest/worker身份 | SDK `expert-squad-authoring.ts`验证node依赖和已声明agent；`engine/workflow-binding.ts`按node_id选择既有agent_id，同角色可属不同节点；没有新增第三worker角色 |
| workflow顺序 | `expert-squad/prompt-profile-resolver.ts`明确图由真实Agent可见决策遵守，不由Host强制执行方法检查。本设计也不新增工具门或自动派单 |
| 初始阶段可见性 | `orchestrator/dispatch-turn-projection.ts`的ordinary initial不渲染continuation正文；`delegated-worker/agent.ts::buildDelegatedWorkerUserPrompt`原样加入真实instruction。因此scheduler必须写阶段，不能假称descriptor自动补正文 |
| 原请求 | `delegated-worker/context.ts`及`intent/request-prompt.ts`保留原目标/附件入口。阶段说明不替换原请求，不增加业务公式或指定来源ID |
| 方法跨Session读取 | 使用现有Task Artifact catalog/search/完整read；传不可变坐标，不能把前一Session的read-ref复制成新Session读过的证明 |
| 最终证据 | `engine/completion-decision.ts`当前按terminal agent及package归属收集expert_output，故同verifier角色的前置方法也进入证据。保留全部旧方法/反证；最终复核指出有效和被取代的判断，不改Host去隐藏前置产物 |
| continuation/失败 | 继续沿原节点/Session的真实dispatch authority；不通过重开旧Task、伪造终态或新ledger换取下一步。本轮不改变这些生产实现 |

本地测试只证明包和纯输入/绑定合同；模型能否真实选择三个阶段、读齐来源、质疑错误
方法、修改并保持其它义务，都还需要真实行为证据。顺序如果没有发生，应记录干预
未执行，不能人为补dispatch或修业务值。

## 已执行的本地检查

[明确test-driver检查器](check-expectation-first.ts)使用原production loader及immutable
reload核对六文件；原capability materializer核对两个worker全部授权相等、四MCP工具
坐标相同；原topology analyzer返回三个串行frontier；原dispatch binding分别返回
expectation/verifier、executor/executor、verifier/verifier的准确绑定；原初始prompt
renderer在两个明确fixture instruction下保留阶段与完整测试请求。

它没有运行scheduler、创建Task/参与者Message、发布Artifact结果、启动业务MCP或调用
Provider。fixture字符串明确为TEST DRIVER，不能冒充模型已选阶段。能力投影相等也不
冒充新项目实际MCP服务已连通。运行收据位于
`.tmp/supervision-causal-20260925/ht-local-design/checker-run-02/receipt.json`。

复核还包括`git apply --check`（原包未应用）、实际四文件numstat、检查器类型检查及
docs/diff。专用typecheck配置首次只include检查器，遗漏项目已有的Markdown模块声明，
补入原`src/**/*.d.ts`后通过；没有新增声明或改生产类型。最终完成证据的归属目前是
源码审查结论，本轮未创建Task运行completion sealing。没有UI改动，未运行UI测试。
只要后续修改设计字节，就必须更新局部收据，
不能沿用当前内容身份伪称已核验。

## 预测与下一步边界

- 方法在新executor之前已经错：新producer报告不是必要原因；来源选择、旧文本锚定
  与能力贡献仍未知。不得继续同义提醒重抽。
- 方法正确而后续无新原始反证却被错误结果带偏：定位比较/裁决阶段；不把它归成源
  缺失，也不因局部方法正确就判整体成功。
- executor首次正确：只支持该次正常交付；不能追加样本制造监督机会。
- 正确差异→真实同Task修正→再次复核/裁决且保持义务：才支持该次纠错链，仍不代表
  更优父代、总体收益或可以推广。

下一步可自主推进具体的测量预登记审查，而不是再次要求用户批准本地设计：固定哪种
公开输入、研究问题、只读初态与评估侧、唯一新版本、次数、目录和停止规则，检查它
是否真能区分上述预测。**本文件不是那个运行收据；当前不启动模型、世界或Campaign。**
未满足模型行为/业务验收必须继续明确为未知，不能用本地checker通过替代。
