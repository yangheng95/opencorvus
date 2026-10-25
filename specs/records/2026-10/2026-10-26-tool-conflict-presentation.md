# 工具内容冲突的可读摘要

## Recall

用户要求持续自主找UI（User Interface，用户界面）/UX（User Experience，用户体验）与功能问题，单agent工作，只在实际冲突时等待，真实体验后精确提交并正常推送。Rendering闪烁已关闭，不再作为本轮主线。601 b6e88修复隐式格式化改变原始附件/复制源和保存回执，602 5da42b786修复mtime漏检、未来时间误拒绝及无效读取事实；602独立43项后端合同通过、真实Sol read→外部保留mtime写B→write冲突→再次read→write成功，最终113字节保留外部行、Review+1/-0，8次streaming请求累计119次，4次未用额度退休。原服务54110/exec44181及物理/输出/请求结清，提前988346ms，自有标签283关闭，auth/models副本退役，源auth元数据与模型目录字节保持。用户18571/用户数据库未操作。

602正常push exit0，fresh fetch/merge后HEAD/upstream同为615beec6505c50f3331bc67c8e050210300f2001，自己的22文件无未提交修改。615为另一用户授权CI任务的Config队列修复，本agent读其11行实现并实际跑config-peer/MCP recovery两文件14项/17断言全过；其完整三平台新轮仍未完成，不误报旧954全绿为当前源码通过。保留外部旧文件删除、三README索引排序、.bun等无关改动。未使用子agent、分支、工作树，也无向其他任务发送消息的授权。旧Goal工具状态仍blocked且带过期Astra目标，不能假称active；普通迭代继续。

已读602三张实际截图、业务原始ToolFailureCause（kind=tool-execution，name=FileWriteConflictError，data.canonical_error_metadata.path为真实路径）、utils/tool.ts全部相关失败/工具详情投影、InlineToolPart的摘要/Feedback/Details、shared ToolDisplay消费者、07-panel当前canonical错误原文合同、en-US和zh-CN唯一两份语言目录。全仓定义/调用搜索确认toolFailurePresentation由displayToolDetail/describeToolCall与InlineToolPart消费；当前FileEditorPane的HTTP冲突识别不属于Tool投影，不更改它。检索范围未遇到UI自动化测试，不新增、修改或运行UI自动化/文案断言。

## 修改前分析

实际602截图中，折叠write行显示“FileWriteConflictError: File C:\\Users\\...”，关键“已更改/重新读取”在长路径之后，900px主区仍被截断。展开原错误后原因可完整查看，模型也自然恢复；这不是新数据冲突或工具执行失败收敛问题，是信息优先级问题。直接触发为displayToolDetail在读取输入路径前立即返回完整failure.message；所有摘要使用该早期分支。既有修复强调canonical原文完整，成功保留了原证据，但没有区分可扫描的语义标题与原始技术诊断。

当前公开界面合同要求原始failure.message为literal、可选取文字，不进Markdown，Details保留完整renderToolFailureCause；必须继续保持。不能通过改写历史消息、截掉原始错误、字符串关键字猜原因或另建状态解决。现有已验证的kind/name提供准确语义，可从同一toolFailurePresentation派生本地化短headline。原message及diagnostic仍原样返回，expanded Feedback展示headline为标题并保留原message正文，Details保留完整诊断。Collapsed/detail消费者通过同一reader使用headline优先，原因在前、当前输入相对文件名在后；未识别失败继续展示原message，取消仍仅按原MessageAbortedError kind/name识别。

只识别当前已有FileWriteConflictError明确合同，不扩展到名字不确定的任意错误，不解析message路径或前缀。Input原值、文件身份、工具status=error与失败计数、源引用、模型原文及持久化事实不变。Main/Side/Squad/Mission复用同一Tool display/InlineToolPart投影；没有另建失败store或改恢复流程。正文保留原技术原文，新增产品摘要及标题分别接入en-US/zh-CN并随当前语言响应。路径复用既有shortRelativePath，不为标题重造basename/路径算法。没有后端/SDK/OpenAPI/schema/迁移变化；低影响纯UI修复不写自动化测试。

## 方案与验收

1. 给现有toolFailurePresentation增加可选headline，仅真实tool-execution/FileWriteConflictError派生本地化“文件已更改，请重新读取”。message与diagnostic保持原值；displayToolDetail用headline再拼当前输入的相对文件名，避免长路径遮蔽原因。InlineToolPart的Feedback使用同一headline作标题，取消标题与未知错误的原行为保留。
2. 双语言新增同一个key，更新07-panel当前契约；不运行UI测试。类型检查与普通Node生产UI构建只作实现检查，不冒充视觉验收。
3. 从已关闭602自有数据库做只读backup，保留全部行/消息原事实，继续使用其独立自有Project路径，启动新自有开发CLI54111的/ui。只复制完整非秘密模型目录，auth不复制，不请求模型。加载原真实失败Chat，人工查看折叠标题、展开原文/Details及最终Review；切换中文/英文实际复核语言和保存事实。截图与人工视觉复核后，根据结果修改再截图。不能使用旧602截图冒充603新页面。
4. 自有20分钟物理边界、至少5分钟提前公开关闭，结清原exec/物理/输出/请求并关闭自有标签。比较业务Session/Message/Part/工具失败原行，确认只是呈现改变。用户18571及用户数据不操作；不声明跨写入口原子性或完整CI已解决。
5. docs:check、必要类型/构建及精确提交、fetch/merge、完整待推集合复核和正常push。保持无关并行改动，继续自主迭代。

## 结果与交付证据

仅四个UI源文件改动：共享toolFailurePresentation增加可选headline，严格识别kind/name；displayToolDetail在原因后拼原输入的既有相对路径，InlineToolPart Feedback复用标题。两个语言key均已接入，原message/diagnostic/status/count/输入和成功交付数据保留。没有后端、OpenAPI、SDK、schema或迁移改动，没有UI自动化测试。overlay typecheck与普通Node生产build退出0，新入口main-BViLm3am.js。

自有602已关闭数据通过只读backup复制到603新运行目录，92表1996行逐行验证。真实开发CLI54111 /ui加载原实际Sol失败Chat；英文折叠原因/文件名完整，View→Language实际切换中文后摘要/Feedback标题及周围控件立即本地化，原英文技术错误与完整结构化诊断仍逐字可看，右Dock打开后的窄主区也能显示原因和文件名。四张截图逐张人工复核；初次第二张出现无关hover提示，已移开后重截，未编辑像素。原8个Session/Message/Part/Tool/Provider事实表共48行在实际页面交互后与克隆前逐行完全一致。

本轮未复制auth、未发新模型请求（累计仍119）；未配置模型的黄色提示是隔离环境预期，用户配置不操作。Main已真实视觉验收，共享Side/Squad/Mission只作代码影响分析，不伪造子会话。顺带实际检查发现Goal仅在输入区“更多操作→持续目标 /goal”提供创建入口，打开现行创建表单后关闭，未填/未提交，也未创建Goal；将继续单独改善其可发现性。

自有标签284关闭；公开shutdown200，原exec46440/native/launcher退出0，物理/输出/请求完整结清，原进程链dead_or_reused，较20分钟边界提前675932ms（至少5分钟）。用户18571及用户库未操作，自有克隆schema8/integrity ok。文档、精确提交、fetch/merge及正常push输出作为本批交付证据，完整CI不提前宣布，跨入口文件原子性与旧未知项仍保留。

初次私有数据复核脚本将Node SQLite返回的null-prototype行直接与JSON保存的普通对象做deepStrictEqual，因JS对象原型不同失败，字段并未改变。已按同一实际列值序列化比较，原Session/Message/Part/Tool/Provider八表48行逐行通过，未修改基线值或数据库。这是复核工具修正，不是产品数据损坏。
