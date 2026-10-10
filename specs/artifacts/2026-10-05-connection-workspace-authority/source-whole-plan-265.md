# 265 范围引用切换到整文件来源

## Recall

持续自主体验与修复Sources/子Dock及功能，最新单agent要求优先，只root、不委托/新成员/Task/分支/worktree。上一轮有实质进展：a7a09fef8785f82798071f9217d5ec268bf633bb已push main，真实Source隐藏重开定位206与键盘/范围、手动阅读resize保持；原首版失败和归档次序偏差保留，宽矩阵未完成。当前git status干净，原264 Native/父工具0、端口/pair闭合。

已读264 Recall与当前CodeEditor完整实现、read.citedReadRange/Source生产、SourceFile公开类型、file-workbench资源/range/reveal revision、FileEditorPane contentTarget相等规则、code-editor-theme StateField/effect和07-panel。全仓搜索citedReadRange/revealLinesEffect/SourceFileRange/同资源实现与range调用，直接相关CodeEditor路径没有UI自动化测试，未运行/新增UI测试。

## 现象、数据/控制流与影响

候选问题：同一文件先打开真实27–37引用，再点击真实整文件来源，旧范围band可能继续显示。当前没有该场景实际截图，先体验，不提前判通过或修改。read整页从offset1开始且未truncated时，citedReadRange不附range，来源表达文件本身而非伪造1..N位置；fileSource语义身份含实际range，Tool结果与Source持久化自然产生。

file-workbench资源身份为目录/path/sourceAbsolutePath，位置另含range，每个accepted open推进revision。FileEditorPane contentTarget按同资源相等保留loaded content/单一draft，范围改变不重加载。CodeEditor在无range时只把revealedIdentity置空返回；唯一StateField的band只有收到revealLinesEffect(null)才明确清空，否则同文档不会变化。候选根因是位置契约去掉range时遗漏当前视觉范围的清理，不是正确源数据被移除或reload失败；实际UI和canonical仍需证明。

全共享CodeEditor消费者为FilePane/CodeArtifact/TextPreview/Notebook，只有FilePane传range。本轮若确证，仅用同一已有StateEffect更新当前band，不造新的Source、状态库、fallback、renderer或remount；无range不指定行位置，不擅自跳1/选全文件。已有只读、API（Application Programming Interface，应用接口）authority/epoch、目录/权限/导航owner保持。接口/LLM/调度当前不改；若出现队列/恢复/并发/终态问题仍必须全入口/轮次/正常终态/重试重启/串并/多项目横审。

风险为range→none→range、同资源反复及隐藏当前none重开、保留用户阅读与焦点；大文件/不同权限和其他artifact未验不能冒称通过。先实际确认旧路径和全部影响，再补完整修改方案实施。純UI不写测试/DOM（Document Object Model，文档对象模型）断言或截图基线，types/build不替代视觉。

## 当前实际方案与预算

用户授权真实OpenAI/GPT-6.1 Sol及完整auth/models同时复制，启动前分别验证credential usable、catalog projected、actual model gpt-6.1-sol及streaming true；秘密不得进日志/spec/Git。只新普通Base会话，由模型自然两次read同一现有公开仓库packages/opencorvus/src/tool/read.ts，第一段offset27/limit11、第二次offset1/limit1000完整文件；当前262行/9354 bytes且源码不含凭据。实际页若完整未满足不拿请求limit冒充成功范围。

新R=C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-10/source-whole-265-live-01，E=source-whole-265/live-01，开发/ui18203/自己IAB（In-App Browser，应用内浏览器）页。不动用户23/18107；成熟NativeService固定600000毫秒/最多12个累计真实Provider请求（含预检/title/memory），启动前唯一关闭/原前台join/独立物理输出请求与精确出生/端口/完整pair退休、完整脱敏归档和自己5产物保留准备。过时观测不重启或延长。

真实UI请求只read这一个公开代码文件两次、短答，不创建任务/委托/改文件/读取auth/models。canonical成功outputs、实际Source.range有/无与完整目标文本crosscheck；两个引用实际出现后本人打开27–37→整文件→原27–37，截图人工检查范围/无范围、内容/阅读定位、only原loader。辅助只读几何/属性用于解释，不自动断言。必要UI修复在原预算内重建并仅刷新自己页面，重新实际截图。

自己页关闭、sole shutdown、原前台实际join与Native物理输出请求结算、独立出生/18203/pair退休；当前工具成功outputs和Source全文事实完整脱敏保管。所有checker/观察器都实际join后才精确退休自身5产物，不重复264提前移动的偏差；helper不声称未验证的caller状态。root/月/相关README、当前docs/architecture检查、范围提交、fetch/merge上游、完整待推送集合审查/普通push。持续goal active，未验完整矩阵明确保留。

## 当前真实复现与实施前方案

当前Native77968/出生win32:639272012987920575、Host33660，原前台20142；固定deadline04:04:57.879Z、600000/12不改。预检credential usable/catalog projected/实际gpt-6.1-sol/streaming true及pairedModels资格通过。现目标9354 bytes、生产分页函数实际262行且truncated=false，未改文件。自然模型15秒完成两次read：27/11成功11/262，1/1000成功262 lines；UI两个实际Source分别带27–37和文件本身。

03范围截图有27–37 band。04点击整文件后仍是这11行band，当前Source chip却read.ts无范围；辅助metadata也实际列出11条，但人工截图才证明视觉错误。FilePane按同资源保留doc，CodeEditor无range仅清空identity，StateField按原内容返回旧decorations；数据/调用/公开契约和旧路径根因已确证。当前response还含模型自然撰写的read.ts/#链接，其行为另待查，不用它替代真实Source按钮或伪造来源。

修改唯一revealIdentity使无range也包含现path/revision（range位置为空），作为当前同一个显式打开请求身份；无range执行已有revealLinesEffect(null)后记录该身份，不移动selection/scroll。这样range→none即清空实际band，即使前一个range未settle也不依赖旧完成标记来推断视觉状态；普通resize不会反复提交清空或抢焦点。range→range仍走原实测布局管线，invalid target清除band但不伪装合法位置完成。

不新增状态/接口/renderer/强制reload/Host流程，也不拿whole-file请求limit制造1..N range。现公共Source/权限/readonly/owner/revision保持；无range普通Artifact初始一次空decorations状态不改变文档，下一次resize按同一身份跳过。所有UI修改本人真实重建/刷新自己的112、再次截图确认range→whole→range和none隐藏重开；其他artifact视觉/大文件/实时子Dock未验保留。仅types/build，无UI自动化或源码文案断言。

## 当前完成事实与边界

最终main-CmdIWcOX.js实际范围/无范围/范围返回及无范围隐藏重开通过，正常背景与原阅读上下文保留，readonly仍true，原9354bytes/262行代码全文与属性相等。类型0/build1m2s/renderer surface0，原04错误截图和模型/#文本保留，后者行为另待查。

自己112已关闭，sole settlement owner04:04:55.723、公有shutdown04:04:57.555/200；Native04:04:57.848 exited/0早于固定04:04:57.879，仅约31ms，不能包装充足缓冲。前台20142 actual0，当前6EOF/取消0，独立物理输出请求/出生/18203/pair闭合。全部当前Source和outputs完整归档；所有后续checker实际join之后才精确退休自己的5产物，不复写提前结束声明。宽矩阵未验，goal active。
