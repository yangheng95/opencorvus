# 367 文件来源与正文引用的列定位

## Recall

用户要求持续自主改善Sources/UI/功能，最新明确单agent，旧goal的Astra并行不执行。366为progress：超长行真实命中窗口与一致载荷处理已交付cf8dad679，32聚焦测试、14真实Sol流式EOF、14截图与两个Native闭合完成，正常push且工作区干净，所有366运行者结束。359首次复制未知保留，目标active。

已读366完整Recall及06真实原文件截图，当前grep/Ripgrep字节事实、SourceFileRange/SourcePayload/factory/persistence/模型投影、SourceParts、FileEditorPane、file-workbench全导航归属/校验、CodeEditor reveal/effect及code-editor-theme、workspace打开路径、file-reference完整解析。全仓搜索SourceFileRange/FileEditorLineRange/CodeEditorLineRange/startColumn/openFileEditor/parseFileReference/Source输入调用；共享三个renderer最终都走同一file-workbench/CodeEditor。现有file-reference和file-workbench-revision测试仅纯数据解析/服务目标状态，无DOM/渲染/快照，属于非UI服务合同；不添加或运行UI自动化。其余UI文件没有相关渲染测试被找到。

## 可观察问题与根因

366/06真实截图已经打开正确的中文长行第1行，但画面只见大量行首前缀，2500单位后的MATCH366不在视口；同轮Source Tooltip已能显示该命中。这是搜索来源精确定位能力缺口。当前SourceRange只有startLine/endLine，grep丢掉原匹配列；file-workbench与CodeEditor也只支持行，光标总设doc.line(...).from，所以预览改进不会自动改善打开位置。

同时发现更直接的现存错误：正文`path:line:column`在parseFileReference/HTML委托点击中保留了真实column，fileReferenceRange却只投影startLine/endLine，导致列事实进入同一workbench时被丢弃。不能只修改Sources点击或引入另一套编辑器。现旧行为对普通read的整文件范围仍有意义：光标落起始行并用行带标注，不把全部文本选中；这项语义保留。

## 当前合同与单一方案

SourceFileRange增加可选startColumn，定义为单行来源内1-based UTF-16编码单元位置（允许行尾下一位置）。提供列时必须是单行且为正的安全整数。没有实际匹配跨度的零宽记录仍只携带行事实；read/旧历史不回填列。列进入fileSource语义身份，区分同文件同一行的不同匹配；没有列的现身份保持。新字段由同一Source schema/持久化/SDK生成/模型source-file文本属性一路传递，不建旁路字段或兼容层。

grep使用首个真实submatch的原lineBytes起点。将该点两侧分别UTF-8解码后与整行规范显示拼接比对：若相同，前缀长度就是显示位置；若不同，边界位于一个解码单元内部，前缀末尾的刷新替换字符应回退一单位。这样中文/emoji、无效字节前缀以及字节正则落在合法或非法UTF-8单元中间，都定位到相应显示字符起点；不重跑正则、不indexOf猜匹配、不写手工UTF-8解码器。该同一matchOffset也供366窗口使用，列保留原行位置而不是已脱敏/裁切片段位置。先以真实字节搜索和明确列输出正向测试证明。

公开SDK SourceFileRange作为前端唯一range类型；移除file-workbench和code-editor-theme里重复的line-range结构声明，并更新所有引用。fileReferenceRange同时传递现已解析column；workbench现校验/规范化/同目标比较保留startColumn，正常导航revision仍唯一owner，草稿/权限/API归属与异步加载规则不变。CodeEditor现revealIdentity和响应依赖纳入列，从实际目标行起点加列偏移，用真实行长度及完整代理对边界约束位置；仍通过已有cursor/scrollIntoView/延迟可见恢复机制完成，不新增焦点或滚动状态写入者。

[CodeMirror官方Text合同](https://github.com/codemirror/state/blob/main/src/README.md)规定行从1开始、文档位置按UTF-16单位从0计数；项目现使用的EditorSelection.cursor/scrollIntoView与此一致。Sources完整位置/复制/tooltip呈现path:line:column；紧凑行标记仅在列大于1时显示本地化列信息，行首保留简洁行标记。正文引用和Sources共用同一后端事实与编辑器入口，不按显示文字再查找文件内容。整文件/多行来源保留现行定位；未知跨度不得伪造列。

影响面含Message公开schema/Source identity/去重/模型提示、grep生产输出、SDK/OpenAPI、SourceParts/语言资源、file-reference→workspace、file-workbench→FileEditorPane→CodeEditor。没有DB迁移或调度/队列/执行恢复改变；如果发现调度异常，立即按Task/Mission/Session全入口/轮次/终态/重启重试/串并行/项目隔离横审。风险是字节与UTF16换算、CRLF、同一行多来源身份、重复打开、隐藏面板新列、历史文件内容变化后超范围列，以及原单纯行/多行语义。超范围列由当前文档边界夹取，不假称历史内容未改变。

## 验收与交付

先新增Source列schema/factory/真实search_code/纯file-reference映射的正向测试跑出改前失败，再实现。补精确持久化及模型投影，更新所有已触及过期期望；不以“不出现/不调用”为核心测试。纯service target状态可测，CodeEditor/DOM/截图/文案不可自动断言。正式SDK生成、全类型、overlay build、docs/architecture检查仅补结构资格。

新source-column-367/18368固定600000ms NativeService、12累计请求，完整auth/models成对暂存并分别验证usable/projected/actual gpt-6.1-sol streaming。真实Main/Side检索自建长行和Unicode/CRLF/不同列文件，保留Source；用模型自然消息呈现明确真实的path:line:column引用。手动点击Source和正文引用后，在实际编辑器截图中直接看到目标词及光标位置；同文件切换两个列、重复打开、隐藏返回以及普通行来源对照。原366/06为现有行首基线，先再次亲自查看；如新UI不佳，更新方案后再调整，不能只以数据检查宣称视觉通过。

页面关闭→唯一shutdown→原handle实际join及Host/Native/output/request/port/配对凭据清除；不扩期或重开scope。实际canonical/ToolOutcome/Provider/HTTP、完整输入和人工截图归档，所有原失败保留。更新根/相关/月spec索引并运行当前docs检查，范围commit、fresh fetch/merge、完整待推送集合审查和正常push；不branch/worktree/版本发布，持续单agent active。

## 实施与中途证据

改前正式backend原74528 exit1：Source schema/identity/error合同4失败，真实搜索列5失败；改前纯file-reference精确文件3pass1fail。首次错误从根目录直接Bun按pattern匹配，误纳入tmp/gallery-project历史副本并因missing marked导入失败，未执行该历史UI断言；已在overlay cwd用精确 ./test/file-reference.test.ts重跑原验收。原失败保留。旧search预期按真实submatch列更新，空submatches仍行级，字节/Unicode/载荷片段分别按原列。

正式SDK生成36854 exit0；backend原77697 exit0，共40测试（12 Source+25搜索+1持久化+2模型投影）；overlay纯parser/service共15测试pass；全类型52472 exit0 8/8，build99057 exit0（main-Du3_bV1a.js），i18n exit0。未运行UI自动化。

真实scope18368/page186/original10710，Native birth 2026-10-12T22:53:09.914Z，固定600000ms。完整授权配对及真实preflight已分别确认usable/projected/gpt-6.1-sol/streaming。Main三工具获得长行2542/5054、短行2:10、read2–3；模型原始代码引用中文路径未变为点击目标，现场05保留；markdown.ts extractFileReference的ASCII token语法是另一处可观察缺口，下一迭代处理，不能冒称其已通过。补充真实模型消息生成标准Markdown链接，第一处/第二处/普通行逐一点击确认列导航；01–10已手动检查（06截图在后续点击错误时未回显，需单独查看）。Sources两个列、重复点击、隐藏后新列、正文链接、普通行及多行band已看见正确原文。主侧栏原生控件在AX与Playwright role不同导致两次locator no_matches；使用实页可用入口继续，未当产品缺陷。

## 本轮收敛事实

13张实页图已全部人工查看，含06额外本地读取。Side实际工具来源5054已生成并可打开正确原文，最终文字因累计12请求预算耗尽未产生；保留11/13可见错误和canonical msg_g0VXsYMSY00Bb8uNmmLL UnknownError/E2E_REQUEST_BUDGET_EXHAUSTED。预算审计exhausted=true，12真实请求均HTTP200/stream/EOF，之后的尝试在隔离harness拒绝。该事实是明确配置边界，无调度/队列/恢复异常证据，不改生产调度。页面186关闭后原shutdown exit0，原launcher10710实际join exit1/OWNED_PROVIDER_COMPLETION_INVALID；Native exited0且physical/output/request闭合，267121ms在原固定deadline内，私有凭据对清除。原验收未通过，未重开、扩期或提高该scope预算。

生产ToolOutcome及实际SQLite的9个来源、原作者3文件完整字节、原列及Side复制身份逐值核对通过；checker只是facts观察，不替代失败的qualification或人工UI。新发现的中文codespan仅ASCII识别另轮修复；这轮Sources列与标准Markdown链接已有实际正向证据。最终需要docs/architecture检查、范围提交和fresh merge后普通push，持续目标active。
