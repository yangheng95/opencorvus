# 336 读取工具摘要与附件来源名称一致

## Recall

用户要求持续自主体验、修复Sources和UI/UX（User Interface/User Experience，界面与体验），直到明确停止；最新指令只使用单agent开发，覆盖旧goal多agent描述。上一目标轮属实质进展：335修复附件来源名称/只读打开，971bc44eae77115af2af19c2d1befdd6cd3eac98已推送；本轮开始git status干净。继续既有benchmark-debug-template流程；严格禁止UI自动测试，真实页面交互和截图由Root人工复核。

335的真实截图03/07中Sources原名正确，但紧邻read摘要仍以/attachment/Project/64位摘要URL为主体。已从同一已结束隔离运行数据库只读核验三个completed tool_part_outcome：title分别为研究材料（终版）335.pdf、Résumé（记录）335.md、project-note.md；原工具输入仍是真实canonical URL/项目路径。来源与结果名称已有当前事实，不需再读metadata、猜文件名或改写消息。

已读AGENTS、335 Recall、07-panel工具传输/来源契约、read返回、tool-part-facts持久化、processor/loop标题赋值、conversation/transport的boundedToolTitle，以及overlay utils/tool、CardParts、InlineToolPart、tool-card-node、card-tree/store统计、subagent-presentation、dialog的共享调用。全仓displayToolDetail/describeToolPart/describeToolCall/displayToolArguments检索覆盖全部生产入口；只在utils/tool一个展示函数改语义。当前路径关系test/tool-path为资源路径运算测试，不是UI/DOM测试，不改不跑；本轮检索未发现工具摘要UI自动测试。

## 修改前深度与影响分析

可观察现象是已完成read行仍显示长canonical地址，Sources虽正确但相邻重复内部地址降低可读性。直接触发点displayToolDetail的path分支在state.title分支之前返回；335仅修真实read结果与source-file，未更改摘要优先级。completed结果title已持久化，传输小结果原样、大结果256字节UTF-8（Unicode Transformation Format 8-bit，统一码转换编码）预算内保留前缀，展开由原deferred reader取完整事实。

准入：对于已完成read/readfile，只要真实结果title非空，摘要使用该原始title；尚未完成或无结果标题时继续展示当前实际请求路径。同一段既有offset/limit/startLine/endLine与lines/totalLines计算保留，普通文件的后端相对标题同样直接呈现。失败仍优先显示原错误；其他工具不变。显示名称不再进行路径裁剪或字符过滤。完整input由现有ToolPayload可展开核查，不隐藏参与者或制造第二消息。

影响面包括主对话与子会话的共享工具行、折叠运行摘要、工具卡和会话详情；统一函数覆盖，不复制规则。不改公开API、持久化、模型请求、执行权限、来源身份、工具输入/结果正文、读取器、组件identity或异步生命周期。当前是同步展示问题，未发现调度/队列/唤醒/恢复/并发/终态异常；若真实运行出现则立即横向审计。风险包括completed/streaming/error区分、目录根空标题、引用范围、deferred完整输入、历史再进入；不以当前主对话窄场景宣称所有子会话流式帧已验收。

## 实施与验收

先用既有335真实截图及只读结果title记录做基线，不再次付费重建同一故障。实施后前端typecheck/build和docs:check。纯UI展示不新增或运行UI自动测试。

真实开发模式NativeService http://localhost:18312/ui，fresh read-summary-336-live-01；已授权OpenAI凭据和完整models成对复制，预检usable/projected/actual gpt-6.1-sol/streaming。Root正常Work Chat读取原名PDF、Résumé Markdown24-25行、普通项目文件，以及明确不存在的隔离文件验证真实错误呈现。模型不创建Task或委托、不修改文件。预算累计12请求、Native出生600000ms固定上限、180000ms无活动观察保持。

逐项手动检查已完成read摘要与Sources相同原名、范围信息、实际PDF/文本内容、展开Input保留canonical URL、普通文件与错误信息、关开和历史回看。留真实截图、Provider请求/EOF、canonical请求/结果title/Source、原字节、原启动句柄实际exit和精确物理/配对清理回执。所有自有页面/服务清理；不操作用户窗口。同步根/月/目录索引，范围提交、fresh fetch+merge、完整待推送集合复核、普通push。goal保留active，下一批继续。

## 本轮结果与未完成项

仅修改utils/tool的共享read摘要优先级及对应架构说明；已完成且有非空title时用原始title，原范围/行数逻辑保留。63118类型、60398构建、docs检查均从原执行得到实际exit0。服务真实提供main-DxxueFc7.js。

NativeService18312、Native58264/Host57004，授权配对预检usable/projected/gpt-6.1-sol streaming。累计8次实际Provider流式请求全部HTTP200/reader EOF；4次真实read产生3个completed和指定缺失文件的tool-execution/错误消息。结果title与3个来源title一致，两个附件仍是原始字节；没有模型写文件或任务委托。18559原启动句柄已join实际exit0，输出、请求、物理进程、端口和复制的auth/models配对清理收敛；自建页119关闭。

Root实际查看7张截图：01运行中已有完成read显示原名，02展开Input保持完整canonical URL和实际offset/limit，03PDF预览与原名一致，04Markdown范围（当时悬浮提示覆盖部分摘要），05Escape后无悬浮遮挡的完整摘要/Source/范围，06故意缺失文件的实际错误详情，07切至另一真实会话后返回历史仍显示原名与24-25行。未运行UI自动测试。后端事实checker实际exit0；34份文本/解压证据扫描0凭据匹配，原日志私有保留。

未完成项明确保留：截图06确认错误正文中的Windows路径`hengu\.codex`被呈现为`hengu.codex`，而摘要、原始详情和canonical failure.message都保留反斜杠。InlineToolPart第633行把原始error传给StaticTextPart Markdown渲染，已定位后续调查入口；本轮摘要修复没有解决错误正文保真，下一批继续。原有read摘要还保留模型实际提交的@1+2000，PDF不产生行计数；这是原请求范围展示，不能当作PDF有2000行的验收事实。

本轮只证明主Work Chat的上述实际交互和共享代码修复，不宣称所有子会话/流式帧或所有长标题都经网页验收。[证据](read-summary-336/README.md)。范围提交、fresh上游合并复核与正常推送后继续单agent；goal保留active，不发布版本。
