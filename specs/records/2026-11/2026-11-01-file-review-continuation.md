# 文件交付后的审阅与继续操作

## Recall

用户要求预览修复后继续自主排查 UI/UX 与功能，只用一个 agent，真实体验验证后提交推送，不操作正在使用的窗口。持续 Goal 保持 active，旧目标中的多 agent 描述已被用户后续单 agent 指令覆盖。上一轮 e814995f6 已交付，完整两轮 Goal 指南真实产物位于闭合的 goal-runtime-870-after；不重启该实例、不增加其额度。

验收：在新的独立 CLI 开发 `/ui/` 和隐藏浏览器页，从真实历史交付进入审阅，核对选中文件、证据不足提示、当前文件打开、返回会话与继续操作。真实截图逐张人工复核；未知结果如实保留。不得创建或运行 UI 自动化。用户 localhost:18571 和所有现用窗口不动。保留全部旧项目、消息、Goal、附件、文件和 Git 状态，不触发 schema 演进。

已读：AGENTS.md、computer-use 技能、07-panel 的 Review 契约，ChangesPanel、FileChangesView、DiffPreviewPanel、DiffView、services/diff、review-focus、tool-file-changes、file-change-summary、ConversationArtifactSummary；上一轮 Goal 记录及紧凑面板最新 Recall。全仓检索相关定义/入口：会话摘要、Review 唯一集合、工具比较收据、保存 Session 的路径覆盖、原文件编辑器。现有 diff-change-group-identity 测试为纯数据契约，未发现本次检索路径内的组件/浏览器自动化验收；不运行 UI 测试。独立结果质量记录中的模型补丁误用和验收额度耗尽不作为本产品审阅缺陷证据。

## 深度与影响面分析（实施前）

- 现象：870 完成态显示行数未知，Sources 能定位 45–111 行且 Markdown 可读。Review 入口尚未实点；不能把未知行数直接认定错误。
- 直接触发与数据流：多次 apply_patch 同一路径进入 reduceToolFileChangeGroups；现有只证明单次比较或严格连续 edit/read 链。apply_patch 生命周期合并不满足现合同，返回 unsupported_lifecycle；保存 Session 路径也只证明覆盖，不能用当前文件补造历史端点。
- 控制流：摘要 requestReviewPanel/requestReviewFocus → 唯一 ChangesPanel 集合 → FileChangesView → DiffPreviewPanel/resolveDiff；当前文件通过独立且显式 openFileReference 读取。审阅选中、恢复、错误提示的实际表现未知，先实页确认。
- 旧路径未根治原因：此前仅验证 Sources/原文件，没有声称已验证 Review；历史差异与当前文件本就是不同事实。不扩大合并协议，不通过伪计数消除警告。
- 公共契约/数据：保持收据身份、原消息与比较来源。预期本轮不改 API、数据库、调度、持久化、Provider 或模型行为；若发现共享生命周期异常，立即横向审计生产入口，不按局部 UI 绕过。
- 同伴与风险：CardParts/ConversationArtifactSummary/Composer/Settings/样式正在另一个已授权会话改动，只调查并保留，不接管其排版。新缺陷定位在独立 owner 后才修改；没有真实缺陷则提交审阅证据，不制造补丁。
- 文档/交付：根 specs 三索引与该记录；检查 docs/types/build 仅辅助，视觉结论必须来自真实交互。提交限本任务范围，拉取普通合并后检查待推送集合并正常 push。

## 首次资源边界

871 独立阶段 before/after 首次请求上限均为 0；仅使用已保存真实对话，不发送模型请求。共用首次准备时起 75 分钟绝对截止，至少留 5 分钟闭合，不延长、不重启旧 occurrence。before 来源是已闭合且资格通过的 870-after；若有修复，after 来源是本轮闭合 before。完整拷贝 schema9/92表、原行/对象、旧项目/Git/附件命名空间；配对认证及模型目录只用于成熟的真实开发准入检查，使用后退休，凭据不进入仓库或日志。每实例保留原 native handle、正常 /shutdown、物理/输出/请求结清和源数据保留证据。无 UI 改动时只需 before；不用未发生的 after 冒充验证。

## 实页发现与实施决定

before 38552/tab122，main-B5wBZSQk.js，91旧项目/221附件。01原图：Review精确选中真实指南，unsupported_lifecycle说明可读，但只有当前文件入口，未提供逐次原比较。实际打开当前文件成功，说明历史比较读取而非文件工作台失效。缺口是用户被要求离开当前审阅面板自行查找长对话里的工具结果；没有数据丢失证据。

修复唯一DiffPreviewPanel：保留合并证据不完整的原因，在tool_interval拥有可定位原收据时，按原receipt顺序提供逐次展开比较。每项只在展开时请求正式session.messagePart接口，以原Session/Message/Part/fileIndex和directory定位，复用toolFileChangesFromState及DiffView；原状态、行数和端点来自该次工具结果，不读当前文件补造。复用并统一tool-part读取器，将原仅延迟结果的入口扩为同一个已完成Tool读取入口；延迟状态仍验证原完整性合同，普通收据验证原身份和completed结果。同步原两个调用点，删除旧函数名，避免第二读取实现/缓存。缓存仍有界并受API authority/目录/身份约束，错误释放，切源后旧结果不能进入当前项。

范围限DiffPreviewPanel、services/diff、services/tool-part、InlineToolPart调用名和双语新增文案；不触碰同伴CardParts/摘要/样式owner。检查器补聚焦非UI读取/原比较数据契约正向测试；UI仅真实原图。当前正式GET已校验项目拥有Session且返回精确持久Part，无需修改路由/SDK/schema/调度/模型。折叠、加载、错误、非文本/无路径原记录按原合同显式呈现，不把缺失收据作为合并可靠的证据。

## 中间复核与第三阶段准入前修订

after 38553/tab123，main-ZsUnoWKx.js，两份真实原比较成功读取：新增49/删除0与修改新增62/删除0；第二次原文含43行可展开未改内容。03/04原图同时揭示新增标签误用单花括号，实际呈现字面量index。仓库fillTemplate只支持双花括号；修正两种语言并让序号使用当前界面locale。保留中间失败图，不以原类型/语言键检查通过冒充正确显示。

同一首次75分钟截止内追加一个全新 final 阶段，首次模型请求上限0、来源为本轮正常闭合且通过资格的after；不重启/修改已准入after，不扩大其额度，不更改共同截止。新冻结构建实页复核准确序号、中英说明、两次比较、未改内容展开、原文件切回及原Review选择/阅读状态。若仍需改动，先保留证据和闭合原实例再决定，不热换缓存HTML。

聚焦非UI契约初跑两项成功、两项因测试共用了同一不可变Part身份/API权限版本而读到先前成功缓存；测试每例建立新的真实API authority生命周期后原四项通过。此为测试隔离修正，未以清缓存绕过生产不可变语义。无UI组件/DOM/文案自动化断言。

## 最终真实结果

final 38554/tab124/main-m3njh3k3.js。05–14原图均实际查看：英语和中文序号为1/2，原新增49/0、修改62/0分别正确。手动展开43行未改原文，查看原14–19行；打开当前文件切Markdown预览后回到Review，仍停在同样行段且第二份原比较与上下文保持展开。切中文后两份原比较、原因、状态、原文件入口与上下文控件均随当前语言显示，模型/文件正文保留原文。主输入实际键入“请继续核对指南第二章的源码依据。”，切文件/审阅后原稿仍在；没有发送，不声称验证新模型请求。原对话第二次apply_patch也实际展开，仍呈现同一62/0比较，证明共享读取器原入口可用。

最终服务正式记录两次来自浏览器的精确session.messagePart GET，分别对应两个原Part，目录仍是指南所属项目；原对话随后展开消费同一有界共享读取器。没有拷贝原始消息到新模型或构造另一条展示流。四项非UI数据合同覆盖原fileIndex选择的端点/行数、真实完整延迟状态校验、身份不符明确错误、非completed明确错误。最终延迟夹具补全原kind并使用超过4KiB的实际状态，四项重跑0；检查的是不可变协议资源身份，非可变源码摘要门槛。

before/after/final均按原native handle退出0，/shutdown 200，精确出生进程链全部dead_or_reused，物理/输出/请求结清，六配对副本退休且源auth metadata/catalog bytes与metadata保持。三阶段请求均0，累计仍1227。每次保留全部旧行/非内部对象、91项目/Git和221附件，无文件排除、无schema迁移；249142→249144→249146→249148，仅各次新增正常控制激活租约及grant，没有旧行替换。最终闭合距首次共同截止仍3451806ms，不延长或重启。

两种语言目录2689键、Overlay类型、正式Vite三次构建、renderer公共surface、docs352操作/26组和聚焦4项服务合同均通过。构建原有大chunk和依赖use-client提示保留，未当本功能失败或视觉通过证据。未触及数据库/后端路由/SDK/调度/版本/发布，不使用子agent。14原图含两张中间失败，不将其计为最终正确呈现。最终截图后只整理证据、测试夹具和Git，没有再改产品源码。

共享HEAD收敛了同伴f8bd73d08输入域交付及ad3fc0b49紧凑排版；各自既有用户授权和真实验收记录保留。本任务仅新增三个双语键，不混入其他locale、README或媒体清理；私有Git index仅暂存本范围，保持其他工作区内容。普通拉取/合并、完整待推送集合及正常hook以最后真实Git回执为准，持续Goal继续active。
