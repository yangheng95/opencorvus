# 连续文件修改的汇总结果端点审查

## Recall

Root 要求在 fresh Sol Work/Chat Write→Read 进行期间继续只读产品审计：沿 canonical Write/Edit/apply_patch/Read 完成回执→真实 Parts→InlineToolPart/ToolPayload 链发现其他有证据的功能缺口；不得重复已修 Read 边界或 next-product-result-review.md 已识别的 Write plain-output 隐藏。当前 registry/queue/audit/native 源冻结。本 agent 使用 gpt-6.1-sol，不委托、不改源码/测试、不执行生产 imports、运行器、Provider、凭据、进程、UI 或 Git；只新增此审查，README/record/提交交 Root。

已读 current architecture/07-panel.md 的 expanded Tool、Review 单一数据源与 inventory resolution 契约，next-product-result-review.md，InlineToolPart、ToolPayload、Card/CardParts 调用点、utils/file-change-summary、ChangesPanel、ConversationArtifactSummary、FileChangesView、DiffPreviewPanel、services/diff、store/card-tree，canonical backend write/edit/apply_patch/read 的实际结果字段，session/processor 的真实 patch Part 生成，现有 diff-resolution.test.ts 正向数据合同。全仓搜索 collectAgentFileChanges、collectAgentFileChangeGroupsFromNodes、currentConversationAgentChangeGroups、conversationArtifactFileRows、mergeChangeGroups 和 resolveDiff。未执行任何测试；没有取得本问题的实际 screenshot/Clipboard/physical file 证据。

本轮选择一个独立缺口：多次真实文件修改被合并成一行后，完整 after 端点保持第一次结果。它不同于 Write 回执文本缺失，不能靠显示成功文案修复。没有将模型自述、缺失截图或测试名当根因。

## 可观察源症状与确定触发

同一 agent 的同一个 CardNode.parts 中有两个完成 canonical Edit：第一份 metadata.filediff 是 before="value=0\n", after="value=1\n"；第二份是 before="value=1\n", after="value=2\n"。每份 metadata 有真实 before/after 和 additions/deletions。这是合法连续修改，既有 Task owner 正向场景已经使用同文件修复，不过本审查没有读取或调用该测试去充当真实 UI 复现。

utils/file-change-summary.ts:108–121 的 mergeFileChange 按 agentID+openPath 合并。第一个 change 存入 map；后续 change 增加 sources、累加 additions/deletions，只在 current.before/current.after 为 undefined 时填充。对 canonical Edit/ApplyPatch，第一次 after 是明确字符串，因此第二个真实 after 永远无法更新汇总端点。

在上述明确有序两份 Parts 的情况下，确定输出是 sources=2、before=value=0、after=value=1，虽然第二份结果已是 value=2。若分别+1/-1，汇总计数+2/-2，而实际展示的0→1正文只是一轮变化。该结论由函数分支直接证明，未执行 fixture 或声称真实页面已复现。即使输入两份顺序相反，算法仍仅保留首先访问的 after，不能表达完整修改序列。

collectFromNode:124–144 遍历 node.parts，再递归 child；collectAgentFileChangeGroupsFromNodes:208 起给结果生成 agent:<agentID> 单一 group，before/after 被完整传入。DiffView 按传入 before/after 计算真实正文，不会自行读取当前磁盘刷新。因此 Review 可以准确渲染一个错误选择的旧端点。

## 生产链及公共合同

canonical EditTool 先执行真实 files.writeFile，再读取结果，返回 metadata.diff/filediff（edit.ts:90–145）。canonical ApplyPatch 返回 metadata.files，每项含 oldContent/newContent 投影的 before/after、路径、type、移动路径和行计数（apply_patch.ts:165 起）；执行后才成功返回。这些是完成事实，不是输入推断。canonical Write 仅返回 filepath/exists，缺少 structured diff 已在前一审查说明，本轮不扩大到这条 producer 合同。Read 不生成文件变更结果，不是汇总输入。

toolFileChangesFromState:82–94 只读取 metadata.files 或 metadata.filediff。toolPartFileChanges:97–103 限定 completed，patchPartFileChanges:105–108 接收真实 patch files。session/processor.ts:1300 起在 Snapshot.patch 成功并通过其证据完整性校验后生成 patch Part；这能带来同一变更的另一真实观察，而不是允许重复累加或任意覆盖的理由。

InlineToolPart:421–425 每一个 completed Tool 单独提取 toolDiffs，ToolDiffList:296 起传入独立 DiffView。因此单个卡片仍能各自显示0→1和1→2；本问题在共享汇总阶段，不应改 ToolPayload 或单个 result 渲染器，不应改 backend 的真实完成结果来迎合汇总。

全部调用面：collectAgentFileChanges、collectAgentFileChangeGroups、collectAgentFileChangeGroupsFromNodes 都复用 collectFromNode/mergeFileChange；currentConversationAgentChangeGroups 按 cardTreeStore.order 遍历根，保留 agentID 并提供给 ChangesPanel 和 ConversationArtifactSummary。ChangesPanel:70–77 合并 live agent groups 与 persisted groups；FileChangesView 接收这一具体 group 集，选择行保持 groupID/agentID，DiffPreviewPanel 将同一 groups 交给 resolveDiff。services/diff.ts:152–189 若 before/after 已存在就用这一明确 body，不会从磁盘纠正旧端点。这与 architecture/07-panel.md:395 起的“inventory 集合同时是 diff-resolution authority”吻合，但要求上游集合本身表达正确事实。

ConversationArtifactSummary:48–51 对 session 且存在完整 persisted diff 时直接使用 persisted；所以不能声称所有已结束 Conversation 汇总必坏。persisted 缺失或未完成收敛时用 live groups，ChangesPanel 仍合并 live groups。因此实际页面严重度依赖本轮真实 runtime、git snapshot 可用性、persisted group 身份和 chronology。已有历史 Session diff 可能遮蔽此 bug，不代表共享 reducer 正确。

mergeChangeGroups 的另一个同语义点：mergeChange:167–178 合并相同 change.file 时优先保留 left.before/left.after、计数取max；对真正同一不可变观察的去重可能合理，对不同时刻端点不能直接当序列合成。groupMergeKey 按 session/artifact/id+agent 区分不同 subject。必须在修复前区分相同观察去重、连续修改与不同 subject，不要在此处统一改成“最后值赢”。

## 根因、风险与排除

根因是把连续真实修改当作只补充缺失字段的重复描述：sources/计数表达多次活动，但端点保持首次观察。没有携带或使用 canonical 修改顺序/观察身份去区分顺序合成与同一事实的 Tool/Patch 双观察。旧 Review exact-group 修复保证选中正确 owner 集，不能修复该集已存入的旧 after；重开面板会重新运行同一函数，不能恢复完整序列。

影响是所有由 live CardTree 汇总的同agent同path completed Edit/ApplyPatch/patch 活动；Task root、Chat/Work/Mission 实际获得这些工具的 occurrence、child cards 都走同一个 helper。不同 agent 被 key 隔离，不能据此把不同 agent 的修改覆盖合并；多项目由当前 selected board 的 tree/source 管理，这里未证明隔离失效。单次修改和单个 InlineToolPart diff 不受这条合并缺口影响。没有调度、队列、唤醒或终态异常证据，本轮不声称系统完成状态错误。

特殊边界需同一修复分析：修改→删除、创建→修改的净 status 与after应一致；修改→还原的净差异与累计活动量语义须分开；移文件按 openPath 变更会形成不同键，需要既有路径身份/移动证据确定合成边界；并行不同 occurrence 同agent同path 不能凭数组遍历猜因果。当前 CardNode 有 orderKey，Parts 有真实时间/身份；确切根/child/part排序及重复观察关联本轮尚未完成核验。不得仅一行 current.after=change.after 就宣称深度修复完成。

源码当前还可看到 canonical Write structured inventory 缺少 metadata.files/filediff，但 processor 的真实 patch/SessionSummary 可能补充；因此本轮不将 Write 缺少filediff直接判定为“Write永远不出现在Changes”。前序审查已排除按钮缺本地onClick：data-file-path由main委托处理。Read Input/Output修复及Write plain-output待修均不在此建议范围。

## 建议的最小后续调查与批准方案

先由 Root 选取安全owned新小文件，在同一真实 UI session 中自然执行两次确切Edit（0→1→2）且单独Read确认最终2；保存两份真实completed metadata、实际Card/Part orderKey或时间、persisted session diff，以及展开两个Tool和Review同path截图。需要明确live group是否成为实际选择来源，不能把disk2而persisted0→2的成功当排除live0→1。此次仅提供方案，不授权或执行真实写。

批准实施前补完共享ordering/observation身份调查，选择现有真实Parts事实为唯一序列来源：同一连续subject保留最早before与最后实际after；同一不可变观察的Tool/Patch事实应按现有身份关系去重；断裂链或并行无因果不可冒充一条精确净diff。不要新增文件内容cache、当前磁盘fallback、另一个group owner或第二套Review renderer。累计活动次数可保留sources，但界面已有additions/deletions如用于净变化应依据最终before/after的成熟diff库计算，与正文一致。任何类型/status合同变化须全仓审计现有FileChange/ChangeGroup消费者，限于这一shared helper及必要positive tests。

非UI正向测试可放在现有diff-resolution相关纯数据测试或专属纯reducer测试：提供有明确顺序和身份的真实completed结果shape，断言0→1→2映射为before0/after2与正确netstats；创建→修改/修改→删除/还原验证明确最终状态；重复同一事实验证确切sources/端点；两agent同path与两个project/source分别得到独立明确groups；相同path不同时序输入的因果错误应对应明确error或明确分组合同，不能核心断言“不发生/不调用/不存在”。resolveDiff已有正向测试只证明选择live group，不覆盖连续端点合成。无组件渲染、DOM、snapshot、source文案或UI自动化测试。

Root 的实际验收应独立证明：两个单卡diff仍有原真实结果，Review展示真正最早before→最后after，readback最终字节一致，计数与显示正文一致；折叠重开、history reload、会话切换仍保持精确source；真实移动/并行资格是额外场景，不由顺序小文件pass代替。类型/lint/build只是支持证据，不替代页面截图。

## 当前结论边界

确定存在“连续结果进入同一live aggregate时首次after锁定”的源码缺口；共享调用与渲染路径已定位。实际产品页严重度、真实chronology/duplicate observation关系和最佳精确合成实现仍需Root补充事实，不能从此只读审查宣称修复已准备完毕或视觉失败已复现。本轮只新增本文件，无其他修改或执行。
