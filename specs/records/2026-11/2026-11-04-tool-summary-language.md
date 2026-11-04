# 工具摘要的语言与文件身份

## Recall

- 用户授权持续自主改进整个产品UI（User Interface，用户界面）/UX（User Experience，用户体验）与功能、实际体验后提交推送；后续仅一个agent要求覆盖长期Goal中旧三Astra文字。本人单独执行，不操作用户18571窗口、进程和数据库。
- 上轮924是progress：d648fc3275f0c769d498b0a0d76f573233183809已正常推送；2026-11-03T20:46:53Z fresh fetch/普通合并后HEAD=origin/main、0/0，本轮前无本人未提交文件，177条无关状态保留。真实原生冷读/刷新/项目返回/中文Question历史与Sources已验收，44条非UI数据/传输测试通过。
- 本轮数据源为已正常关闭、保全并退役的924-after：285813行、92表/schema（数据库结构）10、111项目和273附件，累计1367模型请求。接受前端为924/ui-after/main-0GaABhLf.js。新批次before38690/after38691、可选final38692，共同90分钟绝对截止与至少5分钟退役预留，各0模型请求。使用923真实两阶段Goal和原Tool记录，不造消息、不发新模型请求，不强制刷新有效认证。
- 已读AGENTS、924 Recall/根因/验收、07-panel工具呈现合同、tool.ts共享摘要/状态/工具注册表与所有调用、InlineToolPart/CardParts/dialog/tool-card-node、QuestionTool和ApplyPatchTool原生产者、tool-file-changes与transport bounded metadata/完整Tool读取；检索全仓定义/调用和908 Office工具本地化、read摘要与602冲突摘要历史。没有委托。
- 搜索到的目标路径没有UI自动化测试；不新增、修改或运行源码文案、组件、DOM（Document Object Model，文档对象模型）、快照、浏览器fixture（夹具）或截图自动断言。真实原生开发/ui、自有隐藏页、截图人工复核是唯一UI验收。此次只改UI投影，不增加非UI业务合同或以文案测试替代视觉。

## 修改前问题深度与影响面

可观察现象：924图09中文行是“询问用户 · Asked 1 question”，图05/11的补丁行是“修改文件 · Success. Updated the following files: A deliverables/final.md”。原Tool事实、回答、文件和Goal完整；中文动作名称已翻译，但紧邻摘要仍是工具英文格式，并把关键文件身份放在技术前缀之后。

直接触发与根因：QuestionTool返回固定英文title，ApplyPatchTool返回包含全部成功输出的title；共享displayToolDetail在无filePath请求参数时进入通用state.title。Question有结构化questions输入，apply_patch有files元数据而其输入只有patchText；先前精确ID动作名称注册和Office profile映射没有为这两类增加事实摘要，因此翻译导航或注册动作名称不能解决。禁止解析英文标题/patch文本或关键词替换来推测结果。

影响面：Main操作行、InlineToolPart芯片、选中Agent/Side Chat、session dialog和派生工具卡均读取同一utils/tool描述；通过共享函数修一次，保持原ID、输入、输出、状态、失败、tool message身份与来源不变。精确question与apply_patch名称当前已有注册。未知扩展和authored标题不纳入此修复；完整工具记录仍按原披露合同可读。

数据边界：完整补丁metadata.files与大Tool的现行bounded conversationToolFileChanges是同一原Tool比较的两种当前传输形态，均使用原filePath/movePath；不是新增持久副本或兼容旧协议。若bounded元数据没有完整文件身份集合，不解析被截断title补计数。Question的超长input可能被既有2KB投影省略，不捏造问题数量；metadata.status=expired可据真实状态使用已有到期提示。失败仍优先显示原错误合同，不能把已完成传输等同于用户已经回答。

非适用/风险：没有后端、SDK（Software Development Kit，软件开发工具包）、OpenAPI（接口规范）、schema、迁移或调度更改；未发现新的队列/恢复/终态异常，原Task/Mission/Session共享入口通过真实只读回归核对。主要风险是有界/完整Tool展开前后摘要不一致、语言切换不反应或原文失去读取入口；必须在真实记录上同时展开原结果和查看来源文件，不能用typecheck（类型检查）替代。多文件/删除/移动若本批没有自然原记录，明确不作对应视觉完成声明。

## 实施前方案

1. 准备0模型前测并验证成对认证与完整模型目录，实际原生/ui检查中文工具行、原Question输出和补丁文件，记录截图。初末真实读取15 Mission/4 Task、信箱、Office文件、既有Goals及923两Goal完整Tool和Question事实；正常关闭、原句柄exit0、物理/输出/请求结清、成对退役和保全后继承后测。
2. 只在共享displayToolDetail为精确question/apply_patch增加结构化摘要。Question用实际questions数量本地化，真实到期使用既有提示；补丁单文件显示原目标相对路径，多文件显示本地化数量，展开保留所有原比较。复用现行bounded文件事实读取器，不形成循环import或第二完整比较实现。
3. 仅新增必要中英语言key，接入当前语言；未知工具和原始披露合同保持。当前架构补充共享摘要事实来源。纯UI不写/跑自动测试，执行类型检查、Node普通构建和正式文档/架构检查。
4. 后测用真实相同923记录，中文/英文切换、原结果披露、Sources最终文件和已答历史均实际互动截图复核；并复读原公开合同和持久事实。任何未覆盖状态如实记录。
5. 共同绝对边界内正常退役并保全，归档真实证据、同步三索引，范围提交；fresh fetch/普通合并、完整待推集合复核和正常push，再fresh同步。无分支/工作树、版本或发布操作，长期Goal保持active。

## 暂停与恢复 Recall

用户先明确继续相同两项摘要修复，随后暂停Goal；已按暂停要求停止推进并如实报告尚未实页后测/提交。暂停前已完成真实before38690、自有页261的两张中文截图，确认两处英文摘要；HTTP初末事实已保存。2026-11-03T20:54:19Z原81213句柄exit0、shutdown200，物理/输出/请求结清、认证/模型目录2副本退役；20:55:01Z保全成功：285813→285815行，仅本次控制授权与租约各一行，全部原业务行、源库、111项目和273附件保持，0模型请求。

2026-11-04用户恢复Goal后重新读取工作区、当前Recall和原句柄；HEAD仍d648fc327，产品差异仅tool.ts与两语言key，架构仅7行本人新增，其他工作区更改保留。原类型/Node构建/docs句柄在暂停期间正常结束0并已消费；原925截止1793744463109已过，不改写、续期或重启原实例。恢复后另声明独立90分钟只读验收（tool-summary-resume-926，端口38693，必要修正后38694），各0模型，仍累计1367；继承已正常退役保全925-before的285815行及925/ui-after候选构建。该实例的内部phase名称before仅为既有验证工具入口，角色明确是本轮修复后的恢复验收，不当作未修复前端或额外模型额度。

继续相同根因和实施方案：共享Question摘要使用实际数量及真实expired状态；完成补丁使用现行完整/有界规范文件事实，单路径或去重目标数量。没有英文标题匹配、patch解析、新比较实现或循环import。没有新增UI自动化测试，后测与原始披露仍须实页证明。恢复并非观察超时后的重启；原实例终态和用户明确恢复均有记录。

恢复后的main-NhAzoS6e.js实页已确证中英数量和单文件摘要；图09展开原补丁却显示冗长绝对路径。进一步修改前分析：CardParts折叠身份已按Task/Session选取目录，InlineToolPart的完整结果描述与toolFileChangesFromState仍只传selectedTaskDirectory（普通Session无Task因此为空），其延迟读取另外用board.directory补值；tool-card-node和session dialog也只取Task目录。这是多个工具呈现消费者对同一所选会话目录的重复、分歧读取，不是原filePath或比较端点错误；不改全局cwd，不改selectedTaskDirectory的冻结Task合同。

相关定义/调用全仓检索覆盖board selectedSource、selectedTaskDirectory、conversationSourceDirectory、InlineToolPart两入口、CardParts裸patch/ExecutionEventRun、toolToCardNode和session dialog。新增无状态selectedConversationDirectory投影：Task仍读冻结board.task.directory，Session读其已选source.directory，无选择返回空；将上述工具呈现/延迟原Tool读取统一接入，删除其局部Task/Session分支与board.directory补值。原Task Goal操作继续使用selectedTaskDirectory，不扩大更改。全部为UI数据读取与呈现，不新增后端/持久合同或UI自动测试。必要二次构建和新后测使用恢复批次原截止内的38694；原38693须正常终态、退役和保全后继承，不能只因观察超时重启。

## 后测保全失败与终端配置根因（修改前）

38694实页摘要/文件打开已通过，但原qualify-after退出1：旧801项目Git status新增`.opencorvus/opencorvus.jsonc`修改。数据库原行、文件/Git HEAD/ref/index检查在失败前均通过；不能据此宣称完整保全。保存原完整diff/配置私有副本，结构化比较显示仅terminal.default_profile_id、terminal.profiles.pwsh.command和新增$schema变化。原基线Git该文件clean，当前index=HEAD；mtime为2026-11-04T15:24:51Z，与打开原801 Mission一致。公开请求记录没有配置写入请求，只有流订阅/日志/正常关闭；不是语言设置显式保存或另一用户操作的推测。

根因链为Project bootstrap的terminal-profile.ensure-default→ensureProjectDefaultProfile→按ID/label/icon/args/env/command basename推断“生成配置”→与当前host列表不同即Config.update。已有自定义pwsh路径恰好具有默认外观，因而被替换并改变默认项；没有可靠来源事实能证明该配置属于自动生成器。旧Config读取已删除自动冻结全局值，但此独立初始化路径仍写项目。全仓检索唯一生产入口为bootstrap；list/resolve只读取并给出明确TerminalProfileConfigError。ForTest再生成导出无测试调用，仅由生产自动再生成使用；相应来源推断、旧单配置迁移和合并辅助是这次将删除的死路径，不扩大到其他终端/配置清理。

修改方案：既有非空profiles完整保留，不再按外观或host差异推断归属；只为尚无profile的项目创建现有系统默认。真实配置错误继续由既有list/resolve给出明确错误，不替换用户选择。删除失效自动再生成及仅为其服务的commandNames字段/旧推断辅助；不加来源标志、兼容层、额外配置或新持久格式。新增非UI正向测试验证自定义但外观相似的完整配置字节与resolved身份、缺省初始化的可解析默认项、显式无效default的精确错误合同；真实checker再重开原801证明全文件/Git保持。

原801配置只允许在已证明基线clean、index=HEAD、当前字节仍等于捕获的本次改写内容时，精确恢复该单文件的原始字节。保留首次失败和修复记录，不改变原基线、其他staged或用户文件，不豁免Git状态；重跑原after保全以证明恢复，然后原926截止内38695实际验证修复后的完整读取路径。必须如实区分“发生后恢复”与“新实例读取保持”。没有调度/队列/恢复异常，终端配置修复不改其控制机制。

## 最终实现与实际验收

- UI共享摘要只读取真实questions数量、expired状态、完整或现行有界文件事实。单文件显示实际相对目标名，多文件显示去重目标数量；中英2个key按当前语言。新selectedConversationDirectory把普通Session和Task的目录读取收敛到一个无状态投影，8个UI文件/语言目录接入，原错误、ID、输入、输出、比较、模型/用户原文保持。
- 终端初始化保留所有现存非空profiles，只为未配置情况生成默认；删除221行来源外观推断、旧单配置再生成及其专用辅助/commandNames字段。没有新增持久格式、schema迁移或终端启动权限。新增terminal-profile-preservation非UI测试3条/13断言全部通过，覆盖自定义默认外观身份两次重开、缺省初始化可解析默认、无效显式default的精确ConfigError。
- 最终core/overlay类型检查、Node普通构建exit0，入口main-CwnbdKAa.js；正式docs检查352操作/26组、架构20文档通过。没有新增/修改/运行UI自动化测试，未用文案断言替代视觉。
- 18张真实截图已逐张人工查看：01/02旧摘要，03–09中间候选和展开路径缺陷（07仅文件摘要上下文），10–16最终UI的英文/中文双文件数量、相对文件名、过期问题、单文件、从比较打开正确应用内预览及刷新后数量；17/18是在终端修复后独立38695再打开801/823的实际结果。自然记录没有单次多问题、删除/移动补丁专门用例，不作相应视觉声明。
- 38694的首次qualify-after退出1，真实改写配置保留私有diff，不掩盖为成功。15:39:11Z已精确恢复801原跟踪内容，HEAD/index/原Git status完全保持；原隐藏配置working字节未单独快照，不能声称其原行尾格式恢复证明。重跑原保全成功，但823/801的project-context可用性generation分别1→2、4→5，与两次terminal-default真实阶段及metadata记录完全对应，文档/信箱保持；明确不宣称该阶段全部旧行精确，也不猜测回写未留原文的忽略配置。
- 38695/自有页264使用同一原截止与0模型额度；15:43:17Z正式账号HTTP200/ok，配对目录精确openai/gpt-6.1-sol。增强原文件快照纳入101份现存项目配置。实际重开原801 Mission与823双文件对话，初末terminal/profiles均HTTP200，原pwsh/powershell默认保持、两个原配置完整字节一致。15:45:08Z原6372句柄exit0、shutdown200，物理/输出/请求结清，配对副本退役、余量3444880毫秒；15:45:49Z最终保全通过：285819→285821行，仅新控制授权/租约各一行，全部原业务行、源库、111项目文件/Git、101项目配置和273附件保持，无可用性或容量例外。
- 整项任务四个原生实例（925-before、926-before/after/final）均正常关闭，8份配对副本退役；0新模型请求，累计1367。两原923 Goal complete/idle、470051/472109令牌、各1自动轮次、各12原Tool事实及四原文件保持；原4 Task完整conversation对象相等，15 Mission/4 Task、24/24信箱及2/7/0查询、Office精确404/200binary/200text、915完成Goal均复读通过。自然823/801完整HTTP对象初末相等。没有操作用户18571或其数据库/窗口。

产物：[截图说明](../../artifacts/2026-11-04-tool-summary-language/README.md)、[运行资格](../../artifacts/2026-11-04-tool-summary-language/qualification.json)。本轮新增终端后端修复，公共API/SDK、数据库schema10、版本、Release和tag保持；不是一次新模型工作流或已安装0.1.44发布。
