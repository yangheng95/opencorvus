# 首页草稿与 Goal 创建的衔接

## Recall

持续单agent迭代，后续单agent要求覆盖旧goal三Astra文案，不委托。460为progress：2263dca93b4af22d325bdcbb815d95db7420542c已正常push并fresh fetch确认HEAD=origin/main；四个原命名失败修复，24项/95断言、当前stage模块拓扑、真实gpt-6.1-sol一轮自动Goal、手动改名/同会话reload及五张实际截图；自有native、原checker及成对runtime/private授权目录均结算退休。完整历史schema2/110 Project/149 Session保留。配置完整保存10s/恢复5s原性能仍未达，持续目标active。开始仅原.bun/和packages/opencorvus/bun/未跟踪。

用户原始关注是Goal难以发现/使用、默认页布局、Sources和侧栏Rendering；本轮延续实际Goal使用流程，不能凭代码猜测丢数据后直接修改。已应用computer-use/benchmark-debug-template。所有UI动作只用CUA同一已选IAB/browserID2的新自有tab，不操作用户18571/窗口/进程/真实用户DB。禁止UI自动化、组件/DOM/源码文案断言、浏览器fixture、快照和像素测试；使用真实交互、截图和人工查看。保留完整QA412历史，不建分支/worktree，不清数据，不提高性能门槛。

已读460 Recall、459/441 Goal入口资料、continuous-goal当前契约，main onStartGoal/App startGoal/ContinuousGoalControl的全部GoalFormRequest定义和调用，canonical composer-draft存储与workspaceComposerDraftKey、conversation-session创建/选择、main attachment项目分配时的草稿搬运。全仓搜索GoalFormRequest只有三个当前UI文件；onStartGoal没有读取草稿，create表单open重置objective为空。选择新Session会切换draftKey并清附件；旧文本可能保留在旧key，不能直接说已从持久化删除。导航确认、quotation/附件、重试/切换authority和选择epoch的实际影响仍未知，先调查和真实重现。

## 修改前分析与初始方案

预期体验：用户已经写出的成果，在点击Goal入口后能清楚地继续使用；未确认目标时保留可继续编辑的输入。当前疑点是launcher作用域草稿与新Session作用域、表单本地输入之间没有衔接，而非Goal API或数据库格式问题。必须实际查看文本、创建/取消、返回原作用域和必要的reload，区分“新页面不可见”和“持久化丢失”。同时审计已有附件/引用，不让新的文本修复静默丢掉其他输入。未完成根因/影响面分析前不修改产品源码。

1. 新自有native开发/ui scope用当前460后端及未改变的459正式前端，完整保留QA历史。需要隔离Provider时复制新鲜已授权auth和完整models成对，分别验证credential/catalog/实际gpt-6.1-sol streaming；不交换/刷新或写源凭据，秘密不进入日志/spec/提交。
2. 自有IAB实际输入一段有身份的首页成果草稿，再点击创建Goal，查看表单及取消后的composer。截图人工复核，按实际现象补齐触发、控制流、旧路径遗漏、全部调用/当前合同/数据/文档/风险。引用和附件先确认当前机制，未覆盖时明确限制，不能凭纯文本成功宣称所有输入兼容。
3. 修复落在现有草稿单一存储与一次性GoalFormRequest/创建authority内，保留精确Session、原API authority和selection epoch。不得制造用户消息、第二Goal store、跨会话影子草稿或仅以关键字分流。具体搬运与表单初始化策略待实际证据确认后先落盘再改。
4. UI变更只做相关类型/语言/正式构建检查，必须新冻结服务实际检查项目/全局入口、预填编辑/取消及保存的目标是否使用确认值。需要真实自动Goal时只用明确有限预算的gpt-6.1-sol流式请求。没有新增UI自动化；非UI合同若改变再补聚焦正向测试。
5. 原native/输出/请求/launcher及checker全部结算，readonly比较所有原身份/归属/目录/schema、实际秘密扫描、配对退休；归档和三索引/当前架构、文档检查、范围commit、等待fetch/merge/完整待推集合审核后正常push并fresh fetch。无版本/tag/Release，目标保持active。

## 实际复现与变更前完整分析

18739自有IAB tab3实际在项目首页输入“草稿衔接验收 461”及第二行要求；点击Create goal后，真实新Chat ses_-zURQx2m5zz3BgVygJdE的Goal objective为空，关闭表单后composer也为空。三张1280×720截图已人工查看。没有提交Goal或发送草稿；只做原Provider预检。源码canonical草稿store仍保留旧launcher key，所以结论是新作用域不可见，不称持久化删除。

根因链：main.onStartGoal创建并选中Chat，却没有把当前composer作用域输入传递给新Session；conversation-session选择时清空全局唯一chatAttachments；ChatComposer按draftKey读取新的空槽；ContinuousGoalControl.open(create)再次把objective置空。requestWorkspaceSelection只保护文件编辑器和选择epoch，不负责composer。旧441/459入口解决可发现性与说明，没有这条输入handoff。全部创建入口共用createConversationSessionFromPath；全部选择入口共用selectConversationSession，普通历史导航仍应清附件，不能全局删除清理。

已核对附件处理：唯一messageStore.chatAttachments是staged附件事实；上传前resolveAttachmentDirectory会先准入实际Project，Goal为该activeDirectory新建同Project Chat。quotation在canonical ComposerDraftEntry里，普通文字submission marker属于旧请求身份，不能带入新Session重用。Goal API只接受objective和预算，引用/附件并不会因为预填文字就自动成为持久化消息；保留这些pending输入并在实际存在时清楚提示，不能自动制造user Message或假称文件已发送。

具体方案：创建函数接受可选composerDraftKey，仅Goal入口传入。HTTP创建成功并复核原API authority/selection epoch后、选中新Session之前，用现有composer-draft单一store一次写入移动text/quotation到新Session key，退休旧scope和旧submission marker。目标是本次新创建、尚未选择的精确Session，避免在hydrate等待后覆盖用户刚写的目标草稿。创建选择明确保留staged附件；普通历史选择继续清理。没有新增持久格式/DB迁移、后备路径或跨Project拷贝协议。

表单在open(create)按当前Task/Chat/Mission的canonical workspaceComposerDraftKey读取原文字；不扩展GoalFormRequest或另存一份持久Goal草稿。保留一个与当前表单同寿命的key/text消费快照，source/authority/epoch变化即退休。取消不改原composer；确认成功且原key仍为同一文字、没有pending附件/引用时清除该文字。若用户期间改了草稿或仍有pending上下文，保留其当前值。pending上下文提示通过primary App向control传附件存在性，quotation按精确草稿key读取，不能拿主会话附件冒充SideChat的上下文。所有新提示进入中英语言面。

公共影响：仅UI创建参数、draft移动与表单初始化/消费，不改变HTTP/SDK/Goal调度/预算/终态、消息角色或数据库schema。普通创建调用省略新参数，普通选择清理原合同保留。失败时真实已创建Chat及已移交草稿留在它的canonical作用域；不回写到可能已切换的旧首页，也不伪造删除。重试Goal仍用现有requestID与精确owner。验证重点为项目/全局预填、取消、编辑确认、同会话reload，以及至少一个实际pending输入；没覆盖的附件类别明确记未达，不能用静态代码检查冒充视觉验收。

## 实施和验收结果

已按上述单一store移动方案实现。核对SideChatPanel后，control明确接受实际composerDraftKey：primary来自workspaceComposerDraftKey，SideChat沿用原包含server/directory/selected身份的side-chat key，避免把primary草稿误当侧聊输入。新的Session条目保留text/quotation，旧请求submission marker退休；GoalFormRequest保持原精确Session/authority/epoch合同。

- 正式build:overlay --skip-tauri原66574 exit0，Vite58.93s；overlay typecheck/check:i18n/check:renderer-surface原48852 exit0，2语言/2506 keys。这些不是视觉验收。
- 18741新冻结正式前端的项目入口实际预填“项目草稿延续461”，取消后原文可编辑，同一ses_-zURQuLTRzzalZmMI8Az reload后恢复。重新打开并编辑成果为“从草稿确认的目标461”，明确一轮预算，真实gpt-6.1-sol流式HTTP200/eof返回DRAFT461READY，38356令牌、1/1轮；确认成功后原纯文字草稿被消费。Goal pev_g0VYZ5zD2000SZMmOzNS随后由operator明确提交完成证据，不称模型自动完成。
- 实际拖选该回复并点击Quote，形成真实待发送引用与另一段草稿，打开新Goal表单显示英文提示、文字预填；编辑并创建第二个有限Goal pev_g0VYZ6lNu00j5oEHbk9m后，待发送引用和文字仍完整保留。实际流式回复QUOTE461READY，38534令牌、1/1轮，随后operator完成。中文新Goal表单也实际显示提示并取消，未创建第三个Goal。
- 全局New Chat真实directory-free首页输入“全局草稿预填461”，进入新匿名Project/Chat ses_-zURQsjwjzzB06w0DRDL后正确预填，取消保留。该Chat内打开实际侧聊，输入与主会话不同的“侧聊草稿461”；侧聊Goal表单读到自己的文字，取消后两个输入分别保留。没有发送这些草稿或伪造用户消息。
- [16张1280×720原始截图](../../artifacts/2026-10-20-goal-composer-draft/README.md)全部人工查看，涵盖修改前、上述项目/全局/侧聊和双语pending提示。没有新增/运行UI自动化。原截图中的Task/Mission未实际操作，不能扩称其视觉通过；真实文件/目录上传尚未验收，引用成功不能证明附件路径成功。
- 自有tab3/tab4均已关闭；18739/18741公开shutdown200，原25799/52653 exit0，native物理、输出、请求、launcher结算。readonly SQLite schema2、113 Project/155 Session，110/149与111/151两个基线所有身份、归属、目录保留。首次collector误用ID词典序，对照MessageStore改为time_created/id后重跑exit0；四条持久化消息是两条真实goal-controller和两条work回复。实际秘密值扫描通过后两套runtime/private授权+完整模型目录复制对退休，源文件元数据相同且未写入/交换/刷新。用户18571与真实用户DB未操作。

未达项：文件/目录上传的实际视觉验收、Task/Mission分别实操、原配置完整保存10s/恢复5s性能；继续目标保持active。本轮不改Sources/Rendering，也不将这些截图称为其新流式验收。

三索引及当前Goal架构已同步，docs:check 345操作/26组、api:routes-check 35文件/6规则、check:architecture-index 20文档均exit0，git diff --check通过。相关测试检索发现composer-draft/continuous-goal-service/side-chat-transport现存纯JSON记录、HTTP与流传输合同，已读到的部分没有DOM、组件渲染或截图逻辑；没有把这些协议/数据合同当作视觉验收，也没有运行UI自动化。
