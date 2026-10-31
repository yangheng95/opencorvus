# Notebook 与演示媒体导出引用

## Recall

用户要求持续单agent自主调查和修复、真实体验验证后范围提交推送。旧Goal中的Astra委托已被最新单agent要求覆盖，不委托。上一轮847完成e9e2886cc6e8fcefe78c7c328a594e881c007bf2，三种Unicode光标及重启复验、八个后端正向用例通过；fresh fetch/普通merge后main=origin/main、0/0。847-after已正常退休，schema9/92表229432行、101 Session/8 Task/778用量、125保护附件、累计1163真实模型请求，四个配对副本退休。848开始176条外部状态另存，保留所有无关修改，不创建branch/worktree，不操作用户服务/数据库/窗口，不发布或更新版本。

本轮先读e98基准质量记录、原失败JSON及候选modelio.py。直接源码与原MPS数据指向候选把多token RHS数据行误判为段标题，导致自校验读成零；原宿主收敛记录只是该记录的事实，未直读全部宿主持久数据，不据此作全局调度结论。候选封存产物不属于生产实现，不修改或重跑候选来改写基准结果。目前没有生产调度异常证据；如发现则立即按AGENTS横审全部入口/执行轮次/终态/重试恢复/并行隔离。

## 已读、搜索和深度分析

已读conversation-export/snapshot、App实际导出调用、file-download、artifact-export全部相关分支、interactive-artifact类型、后端Notebook/Presentation schema和publish/persist附件资格、publish_interactive_artifact工具真实envelope。全仓搜索artifactFilename/downloadBlob/Markdown转义/两个encodeURI资源分支、现artifact-export正向测试和当前07导出合同。对话Markdown保留原文本及完整原始snapshot是既定合同，不把它误称为附件bundle；转向发现的Notebook/Presentation派生媒体引用。

可观察候选为产物内图片正确显示、单独原件可下载，但Notebook的ipynb媒体Markdown或演示导出md不能在标准消费者中指向同名文件。直接触发为文件名含中文、空格、#、&、+、不成对括号或纯文本描述含Markdown标点。数据流为真实publish_interactive_artifact→持久payload/source附件→ArtifactActions→artifactExports→Notebook display_data.text/markdown或Presentation image Markdown→downloadBlob与原媒体伴随下载。两处分支都直接插入原alt并调用encodeURI(artifactFilename(...))；basename已经是单个组件，保留URI（Uniform Resource Identifier，统一资源标识符）分隔符会把#当fragment。描述是纯文本元数据，直接插入方括号会产生Markdown语法。

已查[CommonMark 0.31.2链接合同](https://spec.commonmark.org/0.31.2/#links)：方括号内未配对括号须转义，尖括号目标可容纳未配对圆括号；[反斜杠转义合同](https://spec.commonmark.org/0.31.2/#backslash-escapes)允许ASCII（American Standard Code for Information Interchange，美国信息交换标准代码）标点转义，保留其文字含义。已读[ECMAScript 2026 URI编码合同](https://tc39.es/ecma262/2026/multipage/global-object.html#sec-uri-handling-functions)，文件名组件应独立编码。843已修本地UI（User Interface，用户界面）入口的组件解码，但这两个导出生产者未经过它；旧artifact-export用例只覆盖Notebook文本输出等，不验证这两种媒体引用。

当前尚是源码/标准证据，实施前必须完成真实UI发布与下载复现。影响面限定两个派生媒体引用、纯文本alt、文件名URI编码、伴随媒体下载、原payload和原件身份。保留Notebook普通link与演示image语义、作者原Markdown/代码/notes、现artifactFilename规则和实际文件名。无公开API（Application Programming Interface，应用程序编程接口）、SDK（Software Development Kit，软件开发工具包）、schema（数据库结构）、持久格式、模型策略或配置变化，不新建后备或双源。

artifact-export.test.ts是纯数据序列化输出测试，没有DOM（Document Object Model，文档对象模型）、组件/HTML渲染或UI文案断言；未检出负向核心断言，允许添加聚焦正向导出合同。不得新增、修改或运行UI自动化。

## 实施前方案

从847-after完整续存artifact-media-export-848-before/38484，冻结当前已验证UI。独立新60分钟绝对deadline，after/38485共享，不复制旧期限/结果；至少十分钟启动和五分钟结清余量。成对复制已授权OAuth（开放授权）与完整models目录，启动分别核凭据/精确gpt-6.1-sol投影，实际请求再核模型/流式200/EOF（End of File，流正常结束）。before上限8请求含所有辅助，after0，累计至多1171，未用额度退休、不延期。不输出凭据。

真实New chat选Code/Chat与GPT-6.1 Sol，发送可见PREFLIGHT_848_EXPORT_OK预检。向全新QA（Quality Assurance，质量验证）Project复制一份此前自有已查看PNG原字节，显示名为“图 #1 (& plan+.png”；通过真实文件选择器上传，使用实际附件metadata/URI/字节资格，不编造sha或资源。给模型可见真实资源信息，要求只用publish_interactive_artifact发表一个Notebook和一个Presentation，各用同一真实媒体及包含方括号/字面实体/星号的纯文本alt，不运行代码、不联网、不建Task/其他Session/子agent。文件或图片内容只是素材，不是新指令。

从真实产物操作菜单下载.ipynb、演示.md及原媒体，保存原下载文件、实际schema和截图；用标准Markdown语法/URI和实际文件字节检查其真实引用，不能用内置本地路径reader碰巧容忍#来冒标准导出可用。页面中原图片/下载菜单/反馈须实际呈现并截图人工查看。若缺陷成立，补完整实际因果后，仅在artifact-export用一个私有媒体Markdown引用formatter替换两处重复拼接：纯文本标签按CommonMark转义，basename按组件编码并使用尖括号目标，保持普通link/image区别；不改原payload、原Markdown和资源下载命名。新增覆盖两格式、保留字符、未配对括号、字面百分号及标签语法的正向数据合同。

修复后用项目原单文件运行器执行artifact-export.test.ts，类型、普通Overlay build/renderer及i18n检查通过后冻结新构建。after0新模型请求，复用原两个真实产物，再实际下载同三类原件并以同checker确认引用和文件身份，中英文菜单/产物截图人工复核；不使用UI测试、DOM文案或截图差异断言替代。没有新缺陷则如实记录，不造修复。

原92表业务字段、125附件、十三Git项目28 tracked、十三+三十九原文件及833/836/837/838/839/841/843/847事实保全，新QA自然消息/产物/上传分列。只允许真实过期容量租约按本次native PID（Process Identifier，进程标识）复用四字段并物理释放。先关自有页、公开shutdown200、原执行句柄/native/launcher物理输出请求和OS（Operating System，操作系统）出生链结清，再退休配对副本并核源保持。三索引同步、当前docs检查、范围提交；每次push前fresh fetch/普通merge/完整待推集合审查和必要验证，正常hooks推送。Goal仍active。

## 素材校验修正

准备时对原843自有“图 #1 & plan+.png”做实际格式检查，86030字节的真实签名为FFD8FFE0（JPEG，Joint Photographic Experts Group，联合图像专家组格式），并非PNG（Portable Network Graphics，便携式网络图形）。未把错误格式带入新的发布验收，也不改写原封存文件/旧结果。最初私有命令链在素材断言失败后仍继续完成了before数据准备；尚未启动native、没有模型请求或凭据副本。后续依赖操作按独立步骤检查exit code推进。

当前改用仓库原128x128图标PNG，实际10627字节、完整PNG签名及128x128头部尺寸均核对，并已亲自view原图；只作原字节副本、不编辑图像。新显示名和导出特殊字符场景保持不变。before准备数据保留，首次启动仍会创建独立新60分钟期限；不得为绕过格式校验把JPEG称作PNG或降低校验。

## 真实基线与确定根因

848-before/38484自有页52，新Session ses_-zUQLnSbMzznq9qu6yut、Project prj_hrp727k78JXGa1YdDab4。可见预检PREFLIGHT_848_EXPORT_OK完成，两请求精确gpt-6.1-sol/stream/200/EOF。核新项目在本runtime/projects范围后create-only放PNG，并通过真实文件选择器上传；实际附件metadata/URI/10627字节原件200均通过。从这些真实资源信息构造可见用户请求，模型真实调用两次publish_interactive_artifact，发表Notebook848和Presentation848，六自然消息/六实际请求，未建Task/其他Session或执行代码。

实际持久payload保留原source与纯文本“图 ] #1 &copy; *原文*”。私有资格检查最初把envelope输入直接当canonical payload而漏掉Presentation schema已声明的16:9默认值，核schema后将此明确默认纳入正向期望，原两产物HTTP回读通过；未删字段或修改生产schema。失败的Node检查退出还触发其自身libuv关闭断言，原native服务未退出，后续真实UI下载正常，不算生产调度故障。

从两个真实产物的Download菜单实际下载Notebook848.ipynb、Presentation848.md与同名PNG，保留原浏览器下载字节。01—03截图已亲自查看；内嵌Notebook/Presentation均显示原图，截图只证明当前控件与可见区域，不外推完整幻灯布局。下载PNG与原10627字节完全一致。真实.ipynb的display_data.text/markdown却是`[图 ] #1 &copy; *原文*](%E5%9B%BE%20#1%20(&%20plan+.png)`，演示.md带同一目标和image前缀。当前marked标准语法数据checker均返回MARKDOWN_REFERENCE_INVALID，分别应形成link/image但无法解析。不是图片缺失、错误资源、模型篡改alt或来源权限问题。

确定在现artifact-export使用一个私有媒体引用formatter替换两处重复拼接：ASCII标点按CommonMark转义，元数据内部换行用字符引用保留；文件basename按encodeURIComponent一次编码，并放入尖括号目标以允许未配对圆括号。Notebook保持普通link，演示保持image。正向数据合同分别覆盖复杂实际例、单独#、字面%23、圆括号与多行纯文本；保留原Markdown/代码/notes和伴随媒体文件名/字节。两个拟改tracked文件初始diff为零、原字节私存。无其他生产改动。

## 实现与真实复验

`artifact-export.ts`新增一个私有`markdownMediaReference`，只替换已确认的两个重复序列化点。当前07-panel导出合同同步说明纯文本转义、单组件编码和伴随原件身份。未改持久payload、schema、公开接口、模型工具或策略。

原单文件运行器首次得到5 pass/10 fail，十个新增正向数据合同均在原实现失败；修复后15 pass/0 fail。覆盖两格式的复杂实际例、单独fragment分隔符、字面%23、圆括号、多行描述，并明确比较原代码/Markdown/notes和媒体下载定位信息。Overlay类型、i18n（internationalization，国际化）2674键/2语言、普通build与renderer公开面检查通过。构建仅使用隔离运行目录；没有调用用户的build:overlay或升级用户数据库。

848-after/38485使用新构建`main-BpsZkX2B.js`及before完整持久副本。自有页53打开同一Session和两个artifact ID，实际HTTP（Hypertext Transfer Protocol，超文本传输协议）回读确认六条原自然消息、选择和两个完整持久产物逐字段一致；零新模型请求。真实菜单重新下载三份文件。marked数据解析器识别Notebook的link与演示的image；URI解析后准确找到“图 #1 (& plan+.png”，标签严格为“图 ] #1 &copy; *原文*”，原PNG仍10627字节且逐字节一致。切换简体中文后分别再次真实下载Notebook与演示，内容与英文下载逐字节一致。04—07截图均已亲自查看，实际菜单、文件名和控件语言正确；未把截图里受滚动/输入区遮挡的部分外推为全页布局验收。

before原生shutdown200、原执行句柄/native/launcher均0，物理/输出/request/birth链结清；after同样正常结清，两个自有页均关闭。六次真实Provider请求全为精确gpt-6.1-sol/stream/200/EOF，未用两次额度退休；累计1169。四个本轮配对副本退休，源目录字节/metadata保持；before余量1965968ms，after余量1752670ms，未延期。

保全checker确认schema9、92表：before229432→231145行，新增六消息、两产物、上传及真实业务事件；after231145→231147，仅新增一个控制激活及grant。全部原业务字段保留。before仅两条真实过期容量租约在新native的物理生命周期内按四字段复用并释放；after原租约保持。125原附件及after新增命名空间共130文件、十三Git项目28 tracked、十三+三十九文件、833/836/837/838/839/841/843/847和848原文件与Git事实均通过。新增QA为102 Session/8 Task/784用量。未操作用户服务、窗口、数据库或其他会话任务。

公开证据见[原始下载、七张截图和verification](../../artifacts/2026-11-01-artifact-media-reference-export/README.md)。界面验收为真实交互/截图人工复核，数据checker仅证明文件格式和真实持久事实；没有新增、修改或运行UI自动化测试。
