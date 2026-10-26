# 用户命令原文与停止结果

## Recall

继续单agent（代理）自主迭代，后续单agent要求覆盖旧Goal（目标）的Astra委托，不重查已解决闪烁。上一批e08e65695正常提交推送，2026-10-26 13:31:20 UTC（协调世界时）fresh fetch/merge（拉取/合并）后0/0，57项160断言、633实际运行/停止/完成和页面重开已通过。633原exec32077、两个原命令及认证/完整模型副本均结清/退休，累计真实gpt-6.1-sol流请求211。工作区177项同行删除/索引排序/发布记录保持；不改版本、发布、用户18571进程/窗口/数据库，不创建分支或工作树。

本轮处理633实图中直接用户命令的两个确定体验缺陷：用户输入显示固定英文“The following tool was executed by the user”，停止后的工具卡显示完成/非零退出，虽然参与者已正确Stopped（停止）。实际证据来自633原公开请求、Message/Tool/生命周期以及02原图，不能只改状态文案。只做当前唯一生产链路修复、后端正向合同和真实开发CLI（Command Line Interface，命令行界面）/ui人工截图，不新增/运行UI（User Interface，用户界面）自动化。

## 修改前根因与横向影响

已读SessionShell、原SessionPromptState取消回执/finish/resume、共享SessionStatus终态发布、Message.fromError及ToolFailureCause的唯一规范映射、SessionProcessor取消收敛、BashTool返回与原工具呈现/分组定义；读取现行03-control、07-panel的取消/输出合同及前批Recall/证据。全仓搜索占位文字、session-shell-execution-failed、User aborted、shell调用/模型解析和现有实际命令/重放/恢复测试。生产占位文字只有SessionShell一处，另一处为原后端崩溃切面fixture（夹具），应同步当前输入合同。

原文根因：请求command及ProjectMemory.userInputExtra.literalText保存真实用户原文，但生产userPart.text单独写成固定英文。历史、参与者inputPreview、模型重放及归档都从真实Message读取正文，因此缺少实际输入且本地化无法解决。应让这一真实用户Message的正文直接使用原command，保留原空格/换行/Unicode；不增加合成说明、第二条消息、翻译用户命令或另一个正文来源。

停止根因：直接shell的abort listener正确终止并等待原进程，后续排空原输出/进度，却只把aborted布尔转成英文输出备注，仍写Tool completed/Message finish=stop。BashTool同样返回物理命令结果，但LLM（Large Language Model，大语言模型）路径上层SessionProcessor会以原取消异常规范收敛；独立SessionShell没有这一上层。原通用toolFailureCauseFromUnknown对ExecutionCancellationError只保留普通Error名称，不能给现有取消呈现器提供规范MessageAbortedError和原cancellation元数据。

共享边界沿633横向审计继续核对：当前直接shell只有SessionPrompt.shell别名及公开路由，合法普通Chat/Work/Coding共用；Mission/投影worker仍走各自原权威入口。Task/Mission/Session的模型取消由SessionProcessor/原生命周期发布器负责，本轮不改变它们的工具选择、调度、重试、状态机或首终态规则。原物理ProcessSupervisor、精确lease（租约）/child（子进程）/输入轮次、双项目隔离和死亡所有者恢复均保留。正常非零命令退出必须继续completed；只有真实捕获的取消异常变成cancelled（取消）。恢复原不可变助手/Tool事实不回写。附加callbacks（回调）仍由原finish/resume流程处理后续输入。

## 实施前方案与验收

1. 先扩展实际Shell生命周期正向测试，证明原用户正文等于请求，以及手动取消后的原Tool/Message为规范MessageAbortedError，原请求身份、原因、actor/source/requestID、已观察输出和实际退出保持；随后新命令独立完成，旧取消不被覆盖。以当前错误结果构成合格红测试。
2. userPart.text使用原command。原进程/output/progress（输出/进度）结清后先保存实际最终输出及exit的规范进度事实，再让原abort signal抛出其原异常，复用当前失败事务收敛Tool/Message。取消分支复用toolFailureCauseFromMessageError与failureOccurrenceAnchor；普通进程/持久化错误继续原类型契约，不用关键字匹配。删除直接shell多余aborted标记、英文备注和终态布尔旁路。正常结果仍按原shellResultOutput呈现实际退出。
3. 聚焦实际命令、公开重放/恢复、流式进度、规范Tool事实及共享多项目取消合同，完整后端/触及测试类型与当前文档检查；无HTTP（Hypertext Transfer Protocol，超文本传输协议）/SDK（Software Development Kit，软件开发工具包）形状或数据库schema（结构）变化，不新增兼容层/回填旧消息。
4. 最终通过独立开发CLI /ui，真实公开API（Application Programming Interface，应用程序接口）提交原命令、实际UI手动停止，查看原用户正文、记录输出、取消工具和参与者，再自然完成下一命令并重开。优先使用不复制认证、不调用Provider（模型服务）的独立运行，因为直接用户命令不需要模型生成；模型ref（引用）使用请求中原有显式身份，不伪称模型调用已通过。若实际调用模型，再另行成对认证/完整models预检和设定请求预算。保留20分钟物理边界、十分钟关闭目标、至少五分钟结清；原exec/服务/命令精确身份、输出和请求全部结清。
5. 当前架构、三个索引、脱敏原事实/截图同步；范围提交、fresh fetch/merge、完整待推集合复核及正常hooks（钩子）自动推送。整体Goal持续active（活动），其它产品体验继续独立迭代。

合格红测试原exec54468退出1，1通过/2失败/10断言，物理/输出全部结清；分别直接得到固定英文正文、finish=stop/Tool completed，已排除夹具或仅文案断言。确定最终进度记录保存原解码输出与实际exit，再检查原abort；取消转换与原SessionProcessor复用同一Message→Tool规范映射和failure occurrence（失败轮次）锚点。既有completedCommandExitCode只读取completed状态，因此规范取消Tool不会再被工具组计入非零退出汇总；不改通用UI统计。

634已准备：从完全关闭633复制92表23682行及12组原附件，完整逐行/原件字节核对；自有38139，同一普通Node前端main-DqXsnf2O.js。原环境清空后只传既有基础路径与自有OPENCORVUS_HOME，认证文件未复制，模型目录仅供当前UI读取；所有命令显式携带原openai/gpt-6.1-sol引用，无模型生成步骤或模型验收声明，模型请求预算0、累计仍211。启动和关闭沿原native（原生）宿主精确实例监督、20分钟物理边界/十分钟关闭目标/五分钟结算；只读观察原命令handle承诺，不改变命令或执行器。原当前后端/触及测试类型已exit0，聚焦扩展合同仍在原exec35334运行。

634实际公开请求返回400 ProviderModelNotFoundError/openai/gpt-6.1-sol，当前无认证的Provider目录未投影该模型；不是用户热认证失效，不能声称实际命令验收通过。请求在创建命令之前被拒绝，未绕开现有模型身份检查。立即关闭tab17及公开shutdown200，原exec31510/native/launcher均0，提前1060054ms结清；源92表23682行及目标671条原事实保持，无认证副本与模型调用。

635从已关闭634复制同一原历史，改用已授权的成对认证/完整models及分别独立预检，实际模型必须gpt-6.1-sol、stream=true。最多4请求含预检/辅助，累计211起上限215；自有38140、原20分钟物理边界/十分钟关闭目标/五分钟结清保持。直接命令仍经原公开API，实际停止/阅读经原UI；原NoAuth拒绝记录保留，不使用假凭据、未投影模型或改变公共入口来让验收通过。

## 最终实际效果与资格

当前7文件49项162断言全通过，原exec35334退出0；随后样例加强为含原始前导空格/换行/中文/表情的真实命令，3项21断言再次通过（原exec6658退出0），不重复计为新独立用例。当前完整后端及两份触及测试类型原exec70813退出0。正常exit7仍completed，原用户取消Message/Tool均规范error/MessageAbortedError，原输出和数字exit保持，下一命令完成而旧取消生命周期不变。

635的01真实User正文就是请求中的中文命令，原实时输出/Running可见。点击原Stop后02显示Work stopped/1 cancelled、Recorded output与Cancelled通知；API返回同一助手finish=error、Tool error、实际exit1及skipped参与者。后续原命令自然exit0/completed，03原输出可读；刷新自建页面后04仍同一原取消/输出和Stopped。该既有会话真实UI按钮使用right_sidebar_conversation/right_sidebar.abort；原Message.error与Tool.failure.canonical_error_metadata的完整cancellation及failure_occurrence一致。私有证据脚本首次错误预设user/session.abort，已按原持久事实修正，不改产品原始权限来源；另修正原物理结算摘要未携带command的读取方式，回到原handle观察记录按精确identity关联，未以缺失字段跳过物理验证。直接user/session.abort另由实际后端合同覆盖。

635配对预检分别确认凭据可用、模型投影和实际gpt-6.1-sol/stream=true。4次真实模型流请求全部200/EOF settled，累计215，未超预算；直接命令本身无模型生成步骤。tab18关闭、shutdown200，原exec97247/native/launcher均0，提前934216ms关闭；两个原命令精确身份及terminal/output/settlement全fulfilled且OS（Operating System，操作系统）观察dead_or_reused。复制认证/完整models退休，来源模型字节和认证/模型元数据保持。635源92表23682行及目标671条关键事实保持，仅原Chat活动时间推进；12组原附件保持，schema仍8。634/635都已关闭，无付费运行存活。

现行03-control补充原文和直接取消合同；四张实际原图及原请求/响应/数据库/handle/关闭回执脱敏归档，旧消息/结果不改写。剩余当前文档检查、精确范围提交、fresh fetch/merge/完整待推集合复核及正常hooks推送；同行改动完整保留，整体Goal保持active。
