# 终端记录的准确纯文本复制与导出

## Recall

用户要求持续批次并行调查 UI（User Interface，用户界面）/UX（User Experience，使用体验）、功能完成度和缺陷；每批先分析落盘，再修复、真实桌面交互/截图人工复核、聚焦正向功能测试及获授权时 GPT-6.1 Sol 端到端验收，清晰提交、合并上游和正常推送后继续。本轮第三批 7ec6207d2 已推送，main/upstream 0/0，暂存为空，原 177 条用户工作区状态保持；不创建分支/工作树，不发布版本。

两个只读子代理此前并行调查时间和终端，均未再委托或改文件。终端审计给出实际生产函数失败和测试/真实发布入口证据，主代理重新读取并亲自复现。已读 07-panel 产物发布/不可变终端/复制导出合同、artifact-export、TerminalArtifact、ArtifactFrame/Actions、InlineToolPart、utils/tool、当前 terminal schema、publish_interactive_artifact 工具和持久化所属消息合同、Overlay package/锁文件、artifact-export.test、tool-path.test 及相关导出记录。全仓检索 plainTerminalOutput、stripAnsi、terminal@1 和导出消费者：三处消费、两份手写实现；不存在必须保留的外部 SDK（Software Development Kit，软件开发工具包）接口。

当前相关测试全部是纯数据序列化、路径或明确错误合同，没有 DOM（Document Object Model，文档对象模型）、组件、快照或源码文案断言，没有本批需保留的负向核心断言。file-download-authority 的 fetch/transport 桩只证明局部服务合同，不能当真实下载验收。用户上传的 JSON/TXT 附件不会按 renderer 字段变成终端产物，不能用文件预览冒称终端页面。真实发布入口需要自然 SessionLoop（会话执行循环）的消息身份，不造消息或改数据库。

## 深度与影响分析（修改前）

真实当前函数 artifactExports 的终端 TXT（纯文本）输出：ESC]0;Project title BEL Ready 换行 → `roject title\\u0007Ready\\n`；以 ST 结束的标题 → `roject titleeady\\n`；OSC 8 链接包裹 Open source → `ttps://example.compen source\\n`。主代理已重新直接调用当前生产导出复现，子代理也直接调用 utils/tool.stripAnsi 得到同类损坏。ANSI（American National Standards Institute，终端控制序列）、OSC（Operating System Command，终端系统命令）、BEL（铃字符）和 ST（String Terminator，字符串结束符）均是日志中真实控制序列，不是文件名猜测。

直接触发为输出含终端标题或超链接序列。artifact-export 的正则先按通用转义分支匹配 OSC 起始，提前吃掉标题/URL 首字符；ST 的 ESC\\ 又会吞正文首字符。utils/tool 另存一份旧手写正则，虽注释称基于 strip-ansi，当前行为同样失败。旧测试仅检查普通 SGR（Select Graphic Rendition，颜色/样式）转义，11月1日导出工作关注文件名/媒体引用，均未覆盖 OSC 的真实输出。

影响：terminal@1 的 TXT 导出、无选择时全文复制，以及 InlineToolPart 输出/错误/进度/诊断呈现。原 payload、xterm 重放、选中屏幕文本、完整工具原结果、消息身份及文件下载所有权保持；不把本批扩大成完整终端屏幕解释器，不重排光标、退格、换行或 CR（Carriage Return，回车符）。不改公开 API（Application Programming Interface，应用程序接口）、配置、模型工具、权限、schema（数据库结构）或持久格式/迁移。没有调度、队列、唤醒、并发或终态异常证据。

已调查仓库现状并查阅[维护方 strip-ansi 文档](https://github.com/chalk/strip-ansi)和[ansi-regex 文档](https://github.com/chalk/ansi-regex)：前者明确支持 OSC 8 的可见链接文字；后者说明识别范围与不属于完整终端解释器的边界。tag URL 初次未能读取，随后官方仓库入口成功，安装源码/声明已独立读取。锁内已安装 strip-ansi 7.2.0 / ansi-regex 6.2.2，原样实测四类输入正确；选择现有锁内成熟版本，不复制正则或依赖某一宿主内建 API。通用库不是任意控制字节安全过滤器，不作此宣称。

## 实施与聚焦验收计划

Overlay 声明 strip-ansi 7.2.0 为直接依赖，三个消费者直接导入同一库，删除 plainTerminalOutput 和 utils/tool.stripAnsi 及全部原调用，不保留包装或旧兼容实现。锁文件只接受该直接边，审查其它变化。终端 payload 及屏幕重放不改；更新当前架构的复制/导出范围。

先把旧颜色单断言移入真实 artifactExports(terminal@1) 正向测试：纯中英文、SGR、BEL/ST 标题、两种 OSC 8 结束、8位 CSI（Control Sequence Introducer，控制序列起始符）和空记录，均断言完整文件名、MIME（Multipurpose Internet Mail Extensions，媒体类型）和准确文本。旧实现先运行留下实际失败，再替换并重跑同一测试与 tool-path。测试目标是产品导出，不镜像库实现；不加 UI 自动化。类型、语言及普通构建验证编译，不能替代实页。

真实验收准备一条非私密的自然可见对话，精确 openai/gpt-6.1-sol、全部请求流式，要求发布只读终端记录，原始 output 为标题及链接序列，准确可见文本 Ready 换行 Open source 换行。用户已要求仅在获授权时使用 Sol；本次凭据使用尚未单独确认，先完成代码、测试和具体 prompt，再依 AGENTS.md 第七节的凭据授权约束请求最终模型验收授权。未授权前不复制或调用凭据。

获授权后才在新隔离临时 profile 成对复制现有 auth.json 与完整 models.json，分别验证凭据可用、目标模型已投影、实际请求 apiModelID 精确匹配；不把缺少目标投影误报成缺少凭据，不输出秘密。上限8次流式模型请求、一条可见测试对话，不访问用户现用数据库。先正常发布真实产物，再人工看终端重放/截图、实际全文 Copy 和 TXT 下载并核对字节，刷新后回读同一真实产物。该产物不能单独证明 InlineToolPart 的真实工具卡视觉；如自然工具输出未发生则明确此范围未覆盖。

风险为文字丢失、换行误改、依赖漂移或将测试数据伪装真实消息；用同一产品导出正向输出、成熟库直接导入、最小锁文件差异和自然消息发布规避。真实端到端若未取得授权或无法完成，必须明确未达成，不把单测/构建当成完整交付。所有本批修改仍须清晰提交，不能留下未提交工作；完成必要验证后正常上游同步和推送，持续目标保持进行中。

## 实施与证据

新增八组真实终端导出正向用例并先运行旧实现：32 项中 27 通过、5 失败，36 次断言；失败为 BEL/ST 标题、两种超链接和8位 CSI，完整失败日志保存在私有临时目录。随后声明锁内 strip-ansi 7.2.0 直接依赖，三消费者直接导入，删除两份手写实现及旧工具导出。包管理器顺手排序 moment 的无关差异已精确撤回；锁文件仅新增该直接依赖一行，现有依赖版本不变。模型验收仍尚未授权。

修复后 artifact-export 的32项/36次明确输出断言全过，tool-path 的32项/54次断言全过；没有新增库镜像测试或 UI 自动化。具体拟发送的非私密输入已放 [proposed-sol-request.txt](../../artifacts/2026-11-08-terminal-plain-text/proposed-sol-request.txt)，模型只发布给定只读记录，不要求执行命令。原始模型目录已只读确认包含精确 gpt-6.1-sol 身份，认证文件仅确认存在，尚未读取/复制/调用凭据。

后续类型检查、两语言/2914键、普通 Node.js（JavaScript 运行时）构建及 renderer public surface 均退出0；docs:check 352 操作/26组、架构索引20文档、package-topology 10 package 和差异空白检查通过。锁文件只有直接依赖一行，package同样仅一行新增。拟发送的完整组合记录再次进入实际 artifactExports，返回 ANSI transcript.txt / text/plain / `Ready\\nOpen source\\n`，完整产品输出已保存 proposed-export-after.json。

模型凭据使用已通过异步问题请求本批授权，依据根 AGENTS.md 第七节；当前尚未收到答复。未复制或调用凭据，没有新模型请求、自然产物发布或终端 UI 实例。**本批真实终端页面、截图、无选择全文 Copy、实际 TXT 下载及持久化回读均未达成**；纯数据和构建不能替代这些项目，InlineToolPart 的真实工具卡视觉也未验收。根因修复与局部功能证据已完成，完整端到端仍由该授权阻塞，不能称为完整交付。

按 AGENTS.md 要求，已修改文件必须在本轮结束前形成清晰提交，即使端到端未完成；因此先提交本批代码/依赖/正向测试及上述真实范围，正常上游同步和推送。授权问题保持待答复，收到授权后继续同一已落盘验收，不能将未答复当成授权或拒绝，也不再重复询问。持续迭代目标保持 active（进行中）。
