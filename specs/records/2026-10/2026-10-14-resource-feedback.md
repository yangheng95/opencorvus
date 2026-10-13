# Skill 与模型上下文协议（Model Context Protocol，MCP）操作反馈（持续迭代第16批）

## Recall

用户要求持续按批次调查、先根因与影响分析/specs、实际修复、真实桌面交互和截图人工复核、聚焦正向非UI（User Interface，用户界面）合同、必要且授权的GPT-6.1 Sol端到端验收、范围commit、fresh上游merge和正常push后进入下一批，直到明确停止。最新要求“停止所有子agent，你自己做并验收”；所有本树子agent保持停止，本批Root独立，不委托、不发消息。

第15批f79bd5f16265744687fb71a1f2436dd2cdabb754，parent625c7c5c2e4c9ef1e2835f6ad19d195f8d59f257，100路径。原正常commit23686完成3bd569实际0，原blob/共享index精确结算0；fresh fetch49c79f/merge6428d2均0，完整pending仅自己。正常push73883完成6668bd实际0，全部原钩子及secret scan0；7ca2ed实际远端main确认f79bd5f16。当前main/origin/main，自己的源、记录和证据干净，保留工作区其它授权任务。前批原输入输出与实际exit将在本批单独承接，避免自引用；不借用其它owner推送。

已读：当前04-extensions、07-panel/07-panel-reactivity相关合同将继续按目标路径核对；SharedResourceManagementPanel（SkillMarketPanel.tsx）两mode、全部setPanelNotice及唯一Feedback消费、currentDirectory/reload/导入/market/更新/open/删除/MCP操作、ConfigDialogHost两个真实入口、services/extensions.ts真实目录/authority归属、services/mcp.ts::buildMcpAddRequest/parseMcpArguments/addMcpServer、现有Feedback、两locale、locale-preference和i18n。全仓rg确认SharedResourceManagementPanel只有Skill/MCP两个公开wrapper，setPanelNotice仅本组件内部。没有运行UI自动化；触及业务函数不改其合同。本节是源码线索，不把页面或竞态假设记为已实跑。

## 现象线索、触发与根因候选

资源页多处catch将error.message直接setPanelNotice，唯一Feedback把notice字符串当产品正文，没有可展开details。MCP本地参数未闭合引号会由现有真实parseMcpArguments抛出固定英文“MCP arguments contain an unterminated quote”；Skill安装错误来自真实API原错误。当前中文页面因此可能将技术英文当完整错误摘要。其它成功/警告先调用t再存字符串，若同一notice存活于语言变化，文字不能随render使用当前语言；该存活路径尚未实跑，不用源码推定用户已看到冻结。

直接触发是上述操作失败或生成本地化提示；数据/控制流候选根因为notice信号保存已经格式化的字符串、tone单独保存，渲染既不知道翻译键/变量，也无法将技术诊断放详情。旧Provider反馈修复只在ProvidersPanel拥有独立键/变量/原诊断结构，没有覆盖该资源页，不能复制第二全局错误系统。

## 影响与边界

同一个当前实现服务Skill和MCP，覆盖目录加载、更新、market查详情/安装、路径/拖放导入、打开/显示文件、删除和MCP添加/状态/全部删除。必须逐个保留已有scope归属、真实接受事实、成功/警告/error tone、通知关闭及原表单，不扩大为资源调度/权限改造。现有loadSkillIssues已在render调用t，技术owner/path与原message保真，本批不重写后台错误类型或技能加载合同。

错误details最多保存当前本来显示的error.message/String(error)，不增加完整对象、stack、HTTP body、配置、认证字段或日志，避免扩大敏感数据面。用户/技能正文、名称、路径、品牌和技术ID保留原文。若改动前实跑支持候选，复用既有Feedback/Disclosure，以唯一notice对象保存message key/vars/tone/details，render翻译；删除原平行noticeStatus/已格式化消息路径，不新增全局store、模型消息或错误协议。已有路径显示helper若只服务旧拼接，先核对调用与删除影响再移除本组件未用import；不改共享helper或其它页面。

不修改SkillManager、MCP（Model Context Protocol，模型上下文协议）调用、Config/Auth、Provider/SDK（Software Development Kit，软件开发工具包）、LLM（Large Language Model，大语言模型）流、Task/Mission/Session调度/恢复/终态。本批若发现这些机制真实异常，立即单独横审并先补方案，不把它掩在UI修复中。纯UI呈现不创建/运行UI测试；若非UI公共合同确需改动，先补正向明确输出/错误测试。当前推理合同未变，不重复凭据使用或冒充本批Sol资格。

## 实施前冻结调查与验收

1. fresh自有默认/A/B Git与独立端口，Config之前核对真实root；复用当前已资格生产backend `/ui`运行器、完整canonical目录和自有生成假Auth，不复制用户凭据。不启动独立Vite；原75分钟服务预算不延长。归档前批完整原日志采用无损gzip，避免remote自带行末空格被错误改写。
2. 先实际进入中文Skill与MCP页面。Skill只提交本批明确不存在的本地路径，保存真实公开API错误与原图；MCP只使用自有名称、虚构命令和未闭合参数，引发当前真实客户端明确解析错误，禁止启动子进程/远端连接或输入真实凭据。记录实际失败路径，不能把MCP本地校验说成backend端到端。
3. 视实际证据冻结notice实现细节再改产品。后态真实中英错误摘要、展开/折叠原诊断、键盘可达及关闭后继续编辑；已有表单原值保留。成功/警告分支只在使用自己生成的简单本地SKILL.md且不执行工具/模型的可逆安装或已有目录提示时资格；不安装外部第三方能力，不因UI调查扩大权限或发布。
4. 同一notice切语言的存活若实际导航会退休/清空，明确排除该运行结论；不能注入locale/app state或用UI断言代替。必要时以真正支持的本产品语言入口观察，仍不操作用户窗口。所有目标区域截图本人查看，视觉修改后重拍。
5. 类型/Node构建、当前docs:check与全部自己运行的原日志/失败/局限分开保存；正常关闭自有页面和进程，确认物理exit、监听0、假Auth/models整对清理及完整日志检查。更新当前架构与根CHANGELOG双语未发布、根/月/artifact索引；范围正常commit、fresh fetch/merge、完整pending审阅、正常push，不Release/tag/PR，再继续。

当前状态：在新运行器、页面操作和产品修改前落盘；源码候选尚待本批实际页面验证。

## 实际前态与实施冻结

原before launcher50085，PID79352、18630/18631、occurrence1bd91f6c-2876-4212-a806-b370335a7bb7，默认/A/B精确Git在Config之前验证，完整catalog91与三个自有假Auth，0推理/0 Sol。读取04-extensions明确path Skill source进入唯一全局Skill配置，project文件导入/mount仍需目录；本批不改该合同。自己的明文SKILL.md输入只有名称、描述、版本和普通正文，不执行工具或模型，不加载用户外部Skill。

Root tab12通过真实Appearance切中文，Skill资源页提交本批明确不存在路径。POST/skill/install requestID61c5f82a-24be-43f7-b070-412fc56d6546于23:09:07.590开始、07.595真实500。中文正文直接显示完整API 500+encoded directory+固定英文Internal server error，原表单保留。图01是自动滚到表单的原viewport，错误在上方，不冒充错误区域视觉证据；Root实际向上滚动取得图02，清楚看到无本地化摘要/无详情展开的技术英文。

MCP真实本地表单输入owned-parse-only、虚构owned-never-started和未闭合参数，点击添加由既有parseMcpArguments直接抛出固定英文；图03中文页面正文为“MCP arguments contain an unterminated quote”，原三个字段保留。此例是实际客户端校验，不称backend端到端或命令执行资格。两个mode共享notice信号与唯一Feedback，候选的错误摘要问题已实跑成立。

同notice跨语言存活没有证明：ConfigDialogHost只渲染当前active TabPanel，切Appearance会退休资源面板并由重入加载清空notice。因此不声称已经复现语言冻结；render时翻译键/变量是本次唯一notice实现的直接自然方案，而不是补造跨窗口同步。真实后台/技能原文仍不翻译。

额外问题独立记录：manager.ts::validateSkillDirectory先Filesystem.isDir，false直接普通Error Skill directory not found；/skill/install route直接await SkillManager.install，未声明或映射该业务错误，未知Error由server收敛为generic500。原server日志保存了同requestID、manager.ts:911→installResolved:482→真实共享锁调用栈。相关validator还被git/url解析、更新/导入引用，不能按字符串把所有Error改400。此后端错误资格不由UI摘要修复；下一独立批次需横向核对全部调用/错误合同及正向真实路由测试，本批保持明确未修复。另外Skill表单失败提示会在当前viewport上方，图01/02已证明，需要后续单独分析显示位置与操作owner；本批不添加会抢焦点或越权的滚动机制。

实施冻结：唯一notice对象携带key、vars、Feedback原tone及可选details，删除原字符串notice/noticeStatus双信号；所有已翻译成功/警告调用改存同一key/vars，render使用t。异常用mode对应skill.action_failed/mcp.action_failed摘要；现有skill.open_failed/pick_folder_failed若全仓仅当前caller，则保留这两个键作短摘要、原错误移入details，删除旧{{error}}插入语义，不保留双键。details只使用原来已经展示的error.message/String(error)；对真实ApiError另附原x-opencorvus-request-id技术标识，禁止增加body、stack、配置或凭据对象。pathRevealFailureText的当前输出继续原样作为诊断，不改其它caller。现有scope检查、表单、MCP参数解析、后端写入和加载问题列表保持原契约；notice关闭清空唯一对象。复用现有Feedback原生Disclosure，实际中英展开、键盘、关闭和保留输入验收。

Root已关闭tab12，stop f609df；原50085完成7c57e4实际0，正常settle/日志关闭、监听0、假Auth/models整对清理。先启动的privacy35832完成9396cd实际0，完整backend147330bytes/stdout0/stderr0检查与归档均无当前已知假凭据。三张原图本人均已看过，01仅承载表单与viewport事实。以上分析在产品修改前落盘。

## 实现与真实后态

唯一ResourceNotice信号保存key、tone、可选details及render时求值的变量；变量访问器使更新提示中的builtin标签也在当前语言渲染，原name/version/path值保持真实内容。所有原setPanelNotice调用已逐个迁移，旧noticeStatus及已格式化字符串状态删除。只改SkillMarketPanel.tsx与两locale各四行；没有修改任何服务、manager、路由、SDK或MCP参数函数。共享Feedback提供原生Disclosure，ApiError详情仅在原message后附实际requestID，不加入body/stack/凭据。编辑前474aff保存的三个目标tracked路径diff为空；formatter87d15a只处理本批两hunk，原基线0差异。

Overlay类型91114完成e22d7f实际0；Node构建77824完成147d52实际0、52.83s，原chunk警告保留；格式化只有空白，不改构建输入语义。后态launcher38818，PID72448、18632/18633、occurrence243c8e12-afcf-430a-ac99-b4e96fe75659，fresh默认/A/B Git与完整canonical91、假Auth。没有运行UI自动化或模型请求。

Root tab13亲自操作：04英文Skill action failed摘要、05键盘Return展开完整原API500消息和x-opencorvus-request-id c3cbda65-9c33-4dea-b82e-a35a9aa3c916，Space收起、Dismiss后原地址仍保留；06–07英文MCP摘要/原未闭合参数诊断；08–09中文Skill摘要及原消息/requestID94f170ee-6ac9-409d-b570-55b578b6ee2c；11–12中文MCP摘要/原诊断。MCP三个字段持续保留，关闭只清空notice。两个语言均用真实Appearance入口；导航会退休notice，未宣称同notice跨语言存活通过。

关闭中文Skill错误后，Root在同一原表单替换为自己生成的有效本地Skill目录并点击安装。真实API接受后表单自然关闭，图10显示owned-feedback已加载、原描述与真实SKILL.md路径；名称、说明不翻译。后续真实公开GET/skill/installed及GET/global/config的正向checker核对唯一own名称、config_path来源、实际目录身份和已接受全局path source。

原checker a9d67c失败不是产品回滚：API保留用户输入D:/分隔符，ready目录为D:\分隔符，最后一条错误把两者作裸字符串相等比较；前面的真实200、唯一身份、source_type和目录归一化均已通过。Node25.7在未捕获断言后另触发UV_HANDLE_CLOSING，原进程exit -1073740791，完整原日志/exit/输入副本保留；这不是后端PID72448崩溃。修正为path.resolve后的同一实际目录身份，再跑原公开GET checker82ca25实际0。没有重算哈希、改接口输出、放宽到任意路径或以文字断言替代功能。

13–14通过真实New chat进入无项目scope，分别查看中文/英文目录警告与warning配色，明确提示选择工作区，没有把它说成可用项目资源。共14张原图全部本人查看；同批不资格market外部安装、远端MCP连接、native目录打开/选择或所有成功提示路径。Skills原描述保留英文是资源原文，不属于未翻译产品正文。缺失目录HTTP500与离屏提示仍未修复，已在本记录给出真实根因/影响并作为后续范围，不包装成本批完成。

Root关闭tab13后stop83d158，原38818完成e011eb实际0，正常settle/日志关闭、监听0、假Auth/models整对清理；此前privacy56861完成c8b7e7实际0，完整backend163889bytes/stdout0/stderr0检查与归档无当前已知假凭据。实际输入没有真实Provider凭据、没有第三方Skill代码安装、未执行所填MCP命令或产生模型成功消息。0实际推理、0 real Sol，测试和视觉证据不借其它owner。

当前等待证据归档、唯一CHANGELOG双语未发布、架构与索引同步及当前docs:check，然后范围正常提交和fresh上游合并/完整pending审阅/本任务正常push。未产生的提交/推送不提前写成功；后续Recall承接其原始回执。
