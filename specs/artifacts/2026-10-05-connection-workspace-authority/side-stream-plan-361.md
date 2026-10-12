# 361 当前SDK下侧栏长正文与来源流式体验

## Recall

用户要求持续自主体验/修复Sources和侧栏Rendering闪烁，最新人工要求只用单agent；本轮仍由root独自进行代码/测试工作，不委托开发agent，也不派遣产品成员。上一轮360是progress：Sources顶部动作随原展开状态切换，真实主/Side中英文和键盘、SDK 7实际gpt-6.1-sol两来源通过，当前main/upstream为c77213c22，范围提交05ac270c4及独立集成证据8e03b392e已推送。359跨网站首次复制异常仍未知，未加产品补丁。长期goal active。

已读最新AGENTS（包括产品语言约束）、360 Recall与合并后结果，300实际渲染生命周期/快照回退证据、301最新完整回放实现与真实Task验收，07-panel-reactivity的缓存/流式/读点合同，以及TextPart、text-part-model、markdown-render/worker、CardParts和Side/Subagent调用点。全仓检索当前Rendering、streaming与renderer定义。检索到的stream测试为传输/订阅/投影数据契约，不是DOM或组件渲染，本轮不运行它们作为UI验收。工作区其他用户的国际化、更新日志、页面及配置改动保持原状，不stage或覆盖。

## 深度分析与范围

TextPart仅在pending且尚无已排版块时显示Rendering；model保留frozenHtml直到当前来源回复，按真实text/streaming/locale/localeSeq判定请求，旧revision不能覆盖新内容。服务合并每owner最新请求，完整非流式结果按真实正文/语言/控件资源缓存，worker与DOM挂载有界。当前静态代码不足以证明存在新的反复占位根因，不能直接加延迟、长文本优先、同步parser或伪造稳定状态。

300实际发现旧Task完整快照把当前正文回退为空，301已修复真实缓存/缓冲归并，且13个实际模型请求和子侧栏4397字曾通过；不能重复把旧已修根因称为当前bug。新SDK 7改变LLM调用事件，本轮还缺当前持续输出/来源与正文交互的真实页面证据。先补Side Chat同一共享正文链的长输出和读点观察，再依据实测决定修改。其证据仅覆盖实际Side/共享renderer，不能推成原Research Studio成员侧栏全部问题已解决。

新隔离side-stream-361 /18358，单个NativeService固定600000ms、同scope12请求累计预算。沿用已授权OpenAI entry及完整models.json配对复制与独立usable/projected/actual gpt-6.1-sol streaming预检；正常Web UI先建立一个简短Main会话，再串行在其Side Chat中执行真实search_code并输出长正文。不存在开发子agent或产品Task/成员派遣，所有模型输出/工具来源自然产生并可见。

预检后创建两个目录下同名Markdown输入，每份8个STREAM361命中，共16个真实来源。Side请求先检索指定目录，再生成约3600–4500汉字的多节说明，包含真实来源区别、表格和多行代码展示；不修改文件、不创建Task或调用成员。真实输出不达到长度/结构或没有足够流式观察窗口时，保留事实并标记该项不足，不重写模型正文或伪造Source。

## 观察、风险与实施约束

在来源产生、长正文增长及完成时实际截图人工查看；正文已有内容后尝试展开/收起Sources和向上阅读，再收起/重开自建侧栏，查看真实阅读恢复。只在人工选择的时点读取可见DOM（Document Object Model，文档对象模型）文本/几何作辅助观察，没有断言、MutationObserver、浏览器fixture、组件/截图/像素测试或隐藏页面执行。不能以截图未捕获某一帧就证明永不闪烁；需要精确的可见现象、canonical和控制流证据才实施修复。发现问题时先补此方案的触发/根因/调用面/合同和风险再改，不加遮蔽症状的补丁。

模型、来源与任务调度契约本轮不改；若观察到队列、恢复、并发、唤醒或终态异常，立即按共享Task/Mission/Session全生产入口、执行轮次、正常/终态、重试/重启、串并行和多项目横审，不能用单场景或模型行为降级。UI真实流式操作与后端SQLite/Provider事实分开，后者不冒充视觉。原副本保留全部失败；自有页先关、公共shutdown、原handle实际join至终态，核对Host/Native/端口/输出/request及auth/models配对清除。

若只有范围内稳定观察而未定位新产品缺陷，交付复核范围与未满足项，不编造修复。需要代码修改时执行相应聚焦正向非UI契约检查，UI只实页截图。正式构建、类型/docs和必要检查后范围提交，fresh fetch/merge审查全部待推送集合并正常push；不发布、不升级版本、不操作用户应用，目标继续active。

## 真实流式结果、表格根因与实施决定

原361 NativeService/18358已关闭，原调用49515 exit0，8次Provider请求均到EOF（End Of File，流结束）；Host/Native真实退出、输出/请求清理及auth/models成对清除已归档，未重开或延时。实际Side最终5023个DOM文字字符/30块；流式中向上读到scrollTop3992，完成及重开后相同段落仍在top435.2875。截图02–05未出现旧Rendering占位，但离散观察不能证明所有帧或原Research Studio成员侧栏。16条来源来自真实search_code；来源展开截图08在完成后，不能宣称覆盖输出中展开。初版观察helper的visibleBlocks会包括折叠Reference history的后代几何；这些字段不作为已绘制内容证据，人工截图才是视觉依据，后续采样排除closed details。

实际06截图与table-before.json确认新缺陷：380px Side内表格348px，首/尾列44.3875/55.7625px，表头“比较项目”和“核对解释或待验事项”及正文逐字竖排。11行表格高1493.25px，clientWidth/scrollWidth同为346，横向滚动未触发。中间代码字段令两列各122.725px，自动布局把剩余可逐字换行的中文列压到很窄。

已重读122方案及1251241dd8的当前实现。122正确统一了native table的max-content/max-width100%/overflow-x:auto和normal换行，并通过原长ID横向键盘验证；它没有定义中文表头的最小词组宽度。当前table的normal策略允许CJK（Chinese, Japanese and Korean，中日韩文字）内部软换行，所以长ID案例通过不能排除本轮中文列被挤压。根因是共享表头的换行策略与自动列宽相互作用，不是Source丢失、renderer重挂载或后端调度。Marked表格仍为唯一原生table tabindex0，this.tablerow/tablecell保留原文本与对齐。

全仓检索表格/Markdown/keep-all及触及测试路径；没有本轮需删除的UI自动化测试。shared markdown.css统一作用于TextPart（Main/Task/Mission/Side/成员经CardParts）、DocumentArtifact和md-content消费者（Architect/Interaction/InlineTool/README/ReleaseNotes等）；交互式Artifact/Usage表格有各自类，不选择它们。表头是列的语义标识，应按词组提供intrinsic宽度，正文仍正常折行。实施仅给现有.md-content th/.msg-text th增加word-break:keep-all，保留空格/标点允许的断点和正文normal；不强制整表或正文nowrap，不按语言/内容关键字分支、不加固定列宽、新wrapper、事件或独立状态。现有焦点/本地水平滚动仍唯一负责溢出。无接口、消息、Source、Provider、调度、存储或配置契约变动，纯CSS不新增镜像测试。

权威依据：[W3C CSS Text Level 3](https://www.w3.org/TR/css-text-3/#word-break-property)定义normal与keep-all的CJK软换行差异；只支持CSS机制，不能代替实页验收。风险为无空格很长表头可能形成更宽的列；保留本地横向滚动和键盘可达而不截断正文，实际宽/窄页面验证后决定是否接受。

构建后新建独立credentialless完整历史scope side-stream-361-after/18359，先以当前schema/config/recovery/Memory与原终态事实验明，再复制全部原表/行且直接对照；不编辑原会话/工具/source/body数据，不追加模型或重开361原scope。固定600000ms内复核同一11行中文表格：完整列名、正文、横向键盘、宽窄阅读、16Sources展开/收起/目标与读点；可用范围外消费者仍未知。之后关页、公共shutdown及原handlejoin至真实终态，完成checks/docs/范围提交和fresh merge/push。

## 完成项与当前验证

根因修复为markdown.css表头唯一keep-all规则；没有模型、消息、Source或调度代码改动。after完整90表直接行对照通过，同表在380px侧栏从1493.25降至591.5625px，首/尾列72.8/132.8px；Right使scrollLeft到77.6、纵向读点保留，281px及600px侧栏截图16/15通过人工复核。16Source展开、甲目录末条实际第9行高亮、返回列表及Enter收起/焦点回到展开入口均有截图。共21张真实截图，Loading中间帧和未落到表头的帧均保留，不冒充完成状态。

实际live8个gpt-6.1-sol流式请求全部HTTP200/EOF，最终正文5223字符/3646汉字。live/after固定600000ms分别462383/195109ms内关闭；原exec49515/33553实际exit0。原build92431、typecheck98113退出0；bun run --cwd packages/overlay check:css-tokens、bun run docs:check、bun run check:architecture-index均通过。辅助guard缺目录及copy错manifest路径已在历史启动前修复并重跑，未更改真实运行事实。

证据README和checks/runtime-qualification.json详列未覆盖项；全归档含74条原supervision、41个压缩文件，94个文本/解压文本扫描没有已知凭据命中。没有新增/运行UI自动化测试。后续交付仅stage本轮CSS、表格架构段落和361索引/plan/record/evidence；保留其他用户国际化/更新日志/网站变更，提交后fresh fetch/merge、审查完整待推送集合及push。持续迭代目标不以本批完成标记complete。
