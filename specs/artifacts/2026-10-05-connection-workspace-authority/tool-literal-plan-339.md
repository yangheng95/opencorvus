# 339 工具参数保留原始字符串类型

## Recall

用户授权持续自主修复Sources、UI/UX（User Interface/User Experience，界面与体验）和功能，直到明确停止；最新要求只用单agent。338已推送88604d7b7cd0aa3cf1a86cad9d81305de97e2d22，上一目标轮为实质进展，本轮开始git status干净。沿用benchmark-debug-template证据流程。UI仅真实页面交互、截图人工查看，不添加/运行UI自动测试；本轮是共享后端参数修复，必须有聚焦正向契约。

338读取参数调查发现Tool.define的coerceArgs在schema前遍历所有顶层值，把字符串true/false改成boolean；filePath、content、oldString/newString以及string|boolean union同样受影响。注释称转换“unambiguous”，但类型取决于字段schema，不能从字符串文字推断。需要真实文件和完整工具包装器验证，而非只凭函数名判断。

已读Tool.define/ReadTool/WriteTool/EditTool、Truncate、executionFiles/authority、ToolRegistry、SessionLoop registry执行/Provider schema、normalizeToolInput、现有conversation-tool-execution-authority和provider输入契约测试、04-extensions及security-permission。全仓coerceArgs只有一处定义和调用；生产Tool.define检索49处，覆盖内置/Skill/Panel leaf和其他通用包装器。Provider/Session/capability检索未见相同的按值布尔字符串全局改写。规范化输入只做对象/JSON（JavaScript Object Notation，结构化数据格式）容器解析，不改字段原始值。

## 根因、旧路径和影响分析

直接触发点是parameters.parse(coerceArgs(args))。z.string字段接收到boolean后错误拒绝合法文件名/内容；union字段可能静默选择boolean分支；嵌套字符串没有被遍历，造成同值不同层级行为不一致。ReadTool自身知道filePath是string，Write/Edit也声明content/oldString/newString为string，旧共享层却在这些声明之前改写值。此前只避免number coercion破坏字符串ID，未覆盖同样含义的boolean文本。

准入删除唯一coerceArgs及调用，直接把原始args交给当前工具schema.parse。执行继续使用parsed值，因此schema明确声明的数值coercion、preprocess/default/transform仍是该字段的唯一解释来源；正常boolean原值继续通过。对于z.boolean字段的字符串true/false，按既有无效参数Error+ZodError cause明确拒绝，不加按字段猜测的预处理器、不双parse、不复制49个入口、不增兼容层。模型看到的字段声明、持久化原输入、权限invocation与实际执行语义更一致；权限准入/指纹/ledger/执行所有权都不改。

影响覆盖所有Tool.define包装的字符串/union/boolean/default/显式转换参数，包含文件读写编辑、搜索、命令、调度布尔字段、控制工具等。已搜索replaceAll/oneShot/blocking/includeDiff字符串字面调用，没有找到依赖该隐藏转换的直接typed调用；公开声明均为boolean。非Tool.define的原MCP/plugin执行链不扩展修改。旧调用若把boolean错误编码为string，当前统一返回schema错误，而非暗中猜测。当前是参数类型错误，未发现调度/队列/恢复/唤醒/并发/终态异常；如出现这类实际异常立即横向审计，不按场景降级。

## 实施与验收

先新增真实ReadTool读取名为true/false的两个文件、WriteTool写入精确true/false内容、EditTool用字面false/true和真实replaceAll boolean改写实际文件的测试；同时用Tool.define当前包装器验证string|boolean union、嵌套/数组文本、boolean/default/明确Zod转换以及格式错误cause。先运行保留原失败，再删除转换，重跑同一checker。聚焦旧读取和工具结果物化契约，后端typecheck、docs；不无目标跑全量测试。Frontend/SDK契约不改，真实UI复用338已验收main-HB6Ez6mO.js构建并核对实际服务，不无意义重构建。

fresh NativeService http://localhost:18315/ui，tool-literal-339-live-01，成对复制已授权auth和完整models，分别预检credential usable/catalog projected/actual gpt-6.1-sol/streaming。累计12请求、Native出生600000ms固定上限和180000ms无活动观察。正常Work Chat要求read的filePath精确为字符串true和false（不加./规避）；再write literal.txt内容字符串false，edit到字符串true（replaceAll为JSON boolean），最后read核对。所有写入只在本轮新建隔离项目，模型不创建Task、不委托、不修改其他文件。

Root实际检查原输入/输出、Sources与真实文件预览、编辑差异和历史返回；后台核对真实request/outcome、字符串原类型、成功结果与磁盘精确字节、Provider流EOF。关闭自建页，通过sole helper清理精确进程/端口/输出/请求和auth/models配对，原启动句柄实际join。归档脱敏证据，更新根/月/目录README，范围提交，fresh fetch+merge、完整待推送集合复核后正常push。goal active，单agent继续；Skill异步大文件总行数仍待后续调查，不借本轮宣称修复，不发布版本。

## 修改准入

38129原checker实际exit1，0 pass/8 fail。两个实际文件名、两种实际写入内容和Edit旧/新字符串均因被改成boolean而收到expected string错误；union实际输出从字符串true变成boolean true；本应由boolean schema拒绝的字符串false被隐式接受。错误来自真实Tool.define包装器和实际文件工具，非运行器故障。保留原日志后准入删除该唯一通用转换，继续同一聚焦验收。

## live-01 截止失败与共享终态审计

原启动49246实际exit1，完整checker在native exit期望0/实际1处失败。不可改写该失败。native-host-settled证明reason=deadline_exceeded，deadlineAt=1791785078186，实际06:04:38.321Z完成物理回收；root-manual关闭准入06:04:43.659Z，目标已经退出，因此未发送shutdown。最后模型回复05:56:25.675Z已完成；七张人工截图最后为06:03:24，人工交互/归档准备耗时越过固定上限。这个结论来自时间线、真实控制参数和物理回执，不从退出码猜测。

立即检查共享ProcessFacade的deadline lease、controlledHandle、监督Host/Task适配器、全部ProcessSupervisor生产引用、spawnTaskCommand/spawnHostCommand、Task cancellation barrier、runtime mandatory gate、Windows orphan恢复及server shutdown/recovery入口。固定时间来自验收父进程的明确deadlineAt，经唯一ProcessFacade lease触发terminate，再等待native Job/output/request；自然退出与deadline_exceeded在架构契约中明确区分。Task、Mission和Session语义终态不由这项NativeService外层时限判定。继续用只读数据库核对本轮Task/Mission实例和Session完成事实、不同project身份及Provider EOF；串行自然退出与并行截止/自然peer由已有真实foreground facade测试复核。重启恢复按原runtime occurrence和物理出生身份检查，不能靠重新启动覆盖原失败。当前未发现共享机制误终止证据；未在本轮实际执行Task/Mission重试/恢复，不把代码审计写成运行通过。

修正本轮验收节奏而不延长截止：归档/检查脚本在启动前准备完毕；新的live-02独立重做同样五个真实工具操作，在第5分钟内完成必要人工Sources/原始参数/实际diff截图并关闭自己的页面和服务，剩余历史截图已由live-01提供局部视觉证据。仍为12个请求、同一600000ms上限及180000ms无活动观察，不延长、不重写live-01、不把重跑本身作为根因修复。最终checker分别记录功能、Provider与完整qualification结果；live-01保留失败，live-02必须实际自然exit0方可成为完整验收。

## 本轮结果

聚焦17 tests/74 assertions和backend typecheck通过；共享foreground facade真实2 tests/6 assertions通过。live-01功能checker通过但整体exit1已归档。live-02约2分钟完成UI/Provider/Tool路径并正常关闭，原启动16909实际exit0，9次真实Sol流EOF、5个工具、Source/磁盘内容及物理配对清理全部通过。两轮11张截图人工查看；具体结果和未执行范围见[证据README](tool-literal-339/README.md)。后续继续Skill大文件事实调查，不能据此关闭持续目标。
