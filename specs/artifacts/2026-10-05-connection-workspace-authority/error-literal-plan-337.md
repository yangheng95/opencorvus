# 337 工具错误正文保留诊断原文

## Recall

用户要求持续自主修复Sources/UI/UX（User Interface/User Experience，界面与体验）和功能，最新只允许单agent开发。336已推送845ab6a67b9b95e3a5c1eab3fcc73af2310d24fb，上一目标轮属实质进展，本轮开始git status干净。按既有benchmark-debug-template调查/实证/修复流程；不新增、不运行UI自动测试，Root真实交互和截图人工查看。

336/06-actual-error-details.png显示实际read缺失文件错误：canonical failure.message、摘要和Details保留Windows路径hengu\.codex，正文却显示hengu.codex。不是推断模型输出：同一tool_part_outcome有完整原字符串和tool-execution分类。继续修正文保真，不重建合成错误、伪消息或UI夹具。

已读336 Recall、299错误摘要方案、07-panel错误/传输契约、InlineToolPart/StaticTextPart/StreamingMarkdownPart、Feedback和两处CSS、utils/toolFailurePresentation、transport-protocol ToolFailureCause/renderToolFailureCause、后端tool-failure-cause/ReadTool以及transport正向契约测试。全仓检索失败信息和StaticTextPart入口，只有InlineToolPart错误正文进入Markdown；CardParts part-error、ChatBubbleFailureState、Conversation渲染失败已通过文本节点呈现。组件测试目录相关检索未发现UI自动测试。本轮不改也不跑未涉及的后端协议测试。

## 修改前根因、旧路径与影响

直接触发点InlineToolPart将error()交给StaticTextPart；后者总是调用异步Markdown解释器。Markdown把反斜杠转义、括号、下划线、HTML及软换行当作格式，而ToolFailureCause.message是普通string，没有媒体类型或格式契约。后端fromUnknown直接保留Error.message（现有内联凭据脱敏后），并未生成Markdown。全仓错误生产路径检索未发现声明式Markdown错误格式；完整诊断本来就由plain-text Details呈现。

299只统一摘要与正文的失败事实，刻意保留旧Markdown正文与链接；当时真实404错误不含路径，未验证转义字符。新证据说明旧呈现契约应替换：错误正文按真实文本呈现，包括Markdown样式字符串的字面字符；不再将这些诊断文字解释为格式化链接。URL文本仍完整可选择复制，原输入/完整Details不变。不添加自动linkify、字符特判、转义补丁、第二错误源或另一失败消息。

准入在既有Feedback内部用单个文本div替代错误StaticTextPart，局部class只设置white-space:pre-wrap与user-select:text；继承Feedback颜色、字号、自动换行与Details，不重复容器样式。StaticTextPart仍用于本组件真实loaded-instructions文档与其他叙述，不删共享renderer。普通消息仍由当前Markdown引擎呈现。

影响面为使用InlineToolPart的主/Side/子会话实际工具失败正文，包括结构化和既有未结构化原错误；普通成功结果、Summary、来源和工具输入不变。公开API、模型请求、持久化、权限、工具错误类型/分类/来源、ANSI处理、deferred读取和bodyReady所有权不变。不是调度/队列/恢复/唤醒/并发/终态修复，若实际发现这些异常立即横向审计。风险是长路径在窄列换行、多行建议列表、原文选择复制、普通Markdown叙述及历史返回；不能以主对话通过宣称全部子侧栏流式帧已验证。

## 实施与验收

基线引用336真实错误截图与canonical数据，避免付费重造同一已证实故障。修改后overlay typecheck/build、docs:check；不写源码文案/DOM/渲染/截图自动断言。

fresh NativeService error-literal-337-live-01，http://localhost:18313/ui，成对复制已授权auth和完整models，预检credential usable/catalog projected/actual gpt-6.1-sol/streaming。累计8请求，Native出生600000ms固定成本上限及180000ms无活动观察不延长。隔离项目创建两个含方括号/下划线/括号的真实文件，通过Work Chat先read缺失的共同前缀，产生真实多行File not found和两条建议路径；再read正确文件确认成功路径及Sources仍正常。模型不委托、不创建Task、不写文件。

Root真实打开工具失败、检查\.与标点/换行、Details完整诊断、原生选择复制、普通正确文件来源、关闭重开和历史返回。记录实际Provider/canonical请求与错误/文件原件、输入和截图。关闭自建页并由sole helper收敛精确进程/端口/输出/请求和auth/models配对，原启动句柄实际join。证据归档/脱敏；同步根/月/目录README，范围提交后fresh fetch+merge、完整待推送集合检查与正常push。goal保持active、单agent继续，不发布版本。

## 实施与真实验收

InlineToolPart错误正文改为真实文本节点，messages.css局部类仅保留换行与原生文本选择；完整Details、原失败projection和Markdown叙述保持当前所有者。同步替换07-panel旧Markdown错误正文约定。typecheck47719、build25954、docs检查均实际exit0，真实服务提供main-CZcZi190.js。

fresh NativeService18313、Native60836/Host14908，预检真实usable/projected/gpt-6.1-sol streaming。正常Work Chat先read字面缺失名report_[draft]_(v1)，得到包含\.codex、方括号/下划线/括号、空行和两条真实建议路径的tool-execution错误；随后read实际.md文件成功，Source与原件内容正确。共6次真实Provider请求HTTP200/reader EOF。后端事实checker实际exit0：两次request/result归属、失败首三行/两条建议和成功来源/文件原件核对通过；此checker没有UI或剪贴板断言。

Root逐张人工查看7张截图。01生成过程中真实错误正文立即保持原字符/空行，02原生鼠标选择完整错误并复制（人工查看复制结果含完整两条路径，且恢复原剪贴板），03展开Details保留完整classification/origin/callID，04成功来源点击后仍在加载的中间帧，05加载完成的文件内容及窄列错误换行，06键盘Enter重开错误（底部随页面可滚动），07切至另一段真实历史再返回仍完整呈现。04不作为加载完成证据；没有将页面文本、分数或模型自述当作视觉验证，也没有UI自动测试。

自建页面120已关闭；sole shutdown实际exit0，原启动7508已join实际exit0，6个Provider流均EOF，精确Host/Native/端口/输出/请求及auth/models配对清理闭合。33份文本/解压证据凭据扫描0匹配，日志无损压缩且私有原件保留。[证据索引](error-literal-337/README.md)。本轮覆盖主Work Chat真实路径和共用组件代码；所有子侧栏流式帧与其他历史格式组合仍未逐一网页验收，不宣称原Rendering问题全局根治。

范围提交、fresh上游合并复核与正常推送后继续单agent迭代；goal active，不发布版本。本轮明确诊断正文按字面显示，旧Markdown形式链接也作为原文字面保留，不另增解释规则。
