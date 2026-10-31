# 项目文件引用中的编码文件名

## Recall

用户要求持续单agent自主体验、查根因和影响面、实际页面/截图人工复核后提交推送；只有真正冲突才等待，不委托。最新842已交付9693e0e07b001355a3748cb56afa30b8e3637107，fresh fetch/普通merge后HEAD=origin/main、0/0。本轮开始177外部状态，包含并行research记录新增十行；842原176状态全部保留，三共享索引正文保留。用户18571服务、数据库、进程、用户页1不操作，不建branch/worktree、不重复Dependabot管理写入、不发布或改版本。

842已退休source-citation-navigation-842-before保存schema9/92表226305行，99 Session/8 Task/767用量，121保护附件，累计1152真实Provider请求。四次真实正文原件导航及结构化Sources、跨项目草稿正常，十一实图如实保留截图采集缩放边界；自有40–44均关、原exec98169/native28884/launcher0、shutdown200、配对auth/models退休与源保持均通过。本轮继续调查项目文件URI（Uniform Resource Identifier，统一资源标识符）中的真实保留字符，而不是重复已通过的canonical附件路径。

## 已读、搜索与深度分析

已读utils/markdown.ts的renderer.link、markdownProjectFileReference/FILE_EXT_RE与canonical附件分类，utils/file-reference.ts的parseFileReference/范围/属性读写，main.tsx的project-file delegation与document相对路径入口，utils/server-path.ts的规范路径/resolveDocumentFilePath；FileEditorPane的previewImages reader、MarkdownDocumentImages的相对图像slot/可见性加载/失败反馈；当前07-panel路径、Markdown链接、document-relative图像和原件语义。全仓搜decodeURI/decodeURIComponent、resolveDocumentFilePath、相关定义/调用与历史。decodeURI仅在这两个本地路径入口使用；SourceParts的URL可见文本解码是另一合同，不改。历史037d42c0c引入scoped document-relative图像，65d0bfc98含现Markdown解码；1f8fad512等后续修复canonical附件、文件名和正文点击属性，没有改变该边界。

已查阅[ECMAScript 2026 URI函数规范](https://tc39.es/ecma262/2026/multipage/global-object.html#sec-uri-handling-functions)，19.2.6.1/2明确区分完整URI与组件解码：decodeURI保留分隔符的转义，decodeURIComponent还原组件中的文字字符。代码中两个入口在完成URL/附件分类后，实际需要的是文件名/路径文字，继续保留%23、%26、%2B会将文件名拼成带百分号的另一文件。这个判断目前是代码/规范证据，须经真实UI（User Interface，用户界面）和后端实际请求确认后再实施。

可观察候选为模型或文档中有效的编码文件链接打不开；直接触发点是点击Markdown项目文件链接或预览含编码相对图片路径的Markdown。控制流为token.href→parseFileReference（先分离真实行范围）→decodeURI→data-project-file-path→原属性委派→公开file内容接口→精确文件系统路径；图像为原src→document image slot→reader decodeURI→文档目录解析→同一file内容接口。预期根因是UI路径边界错用了保留URI分隔符的解码器；后端按真实文件名查找是正确合同，不能猜测或再次解码来混淆字面%23文件。

旧修复未根治原因：canonical附件正文URL走独立ProjectID/name资源路由，根本不经本地文件名解码；显示名、属性保真及目录生命周期修复也不改变此URI入口。影响面为正文与文档内链接、行范围、相对图片、UTF-8（Unicode Transformation Format，8位统一字符编码）文件名、字面百分号、当前Project/API authority、结构化Sources和原件/编辑器语义。parseFileReference应在解码前分离作者写出的#L范围，不能把编码的文件名#误当定位；字面%23需要只解码一次。

检索到的file-reference.test.ts仅验证纯路径/范围数据映射，没有DOM（Document Object Model，文档对象模型）或HTML渲染；保留且不为本轮重跑无关用例。未发现本轮路径的现存UI自动化；不新增、修改或运行UI测试。拟修改仅是两个UI路径入口使用现有标准组件解码器、当前07合同和证据，不改公共API（Application Programming Interface，应用程序编程接口）、SDK（Software Development Kit，软件开发工具包）、数据库或配置，不增加解析后备路径/影子状态/协议兼容层。三个候选tracked文件初始差异0、原字节私有保存；最初PowerShell空输出未落盘diff后，已改由Node写入真实零字节差异文件。

没有调度/队列/唤醒/恢复/并发/终态异常证据。若验收发现这些异常，立即按全部Task/Mission/Session执行轮次、全部入口/终态/重试重启/串并行/多项目横审，不将其归为当前UI用例。

## 实施前真实方案

完整续存842已退休数据到encoded-file-citations-843-before/38476，冻结main-Rn-pJKfx.js；如缺陷成立，候选after/38477复用同一绝对60分钟deadline、不延期，至少五分钟结清余量，after必须剩至少十分钟才启动。before最多8真实流式gpt-6.1-sol调用（含所有辅助），after0新调用、复用失败的自然消息，整批最多8、累计最多1160，不扩额或因观察慢重启。auth与完整models成对复制，启动分别核OAuth（开放授权）/精确模型投影及before真实请求模型；不记录凭据。只用native开发serve /ui和自有隐藏内置页，不单独Vite。

真实New chat选Code/Chat与GPT-6.1 Sol，发送只回复PREFLIGHT_843_BEFORE_OK的可见预检，先核实际stream/200/reader EOF（End of File，流正常结束）。在这个新QA（Quality Assurance，质量验证）Project中放置四个自有输入：含空格/#/&/+及中文的文本原件、名字字面含%23的对照文本、overview.md与一份已发布自有PNG（Portable Network Graphics，便携式网络图形）原图的字节副本。overview.md真实包含编码项目文本/字面百分号链接、#L2-L3范围和编码相对图片；这些是可见文件内容，不是合成模型消息。模型实际read主TXT与overview.md，按原文回复字段并保留Sources，末尾给项目文件Markdown链接；提示不泄露原件字段，不解码图片、不改文件、不联网、不建Task/其他Session/子agent、不委派。

真实点击自然回答的编码文件链接，记录实际file内容请求、明确错误/正确原件、页面截图；结构化Sources核对精确原路径。实际打开overview.md预览，查看其文件链接、字面%23对照及相对图片。直接公开内容读取只用于证明实际原件及错误契约，不能替代UI激活。若两个入口确实失败，先补真实因果证据再将其decodeURI替换为decodeURIComponent，保持分类、范围、属性委派与后端精确路径合同；不改无关代码。

候选普通Overlay类型检查/build/i18n通过后，冻结当前产物。从已退休before保留全部DB行、新QA输入文件、Git、自然消息和受保护附件进入after，0新Provider请求。通过同一失败的原消息及overview预览复验：真实文件名、原字段、#L2-L3定位、字面%23对照、相对PNG及原Sources；英文/中文控制与错误/空闲状态绑定实际截图人工查看。不以源码文案、DOM断言、组件渲染或截图差异测试验收。所有自有新页均关闭，临时viewport恢复。

旧92表逐列、121附件及before新发布canonical文件、十三Git项目28 tracked、十三+三十九原文件与833/836/837/838/839/841/842事实完整保护；新QA仅真实消息/用量/Tool/许可/原生执行记录增加。容量槽仅允许真实过期租约按当前native PID（Process Identifier，进程标识）复用四字段并物理释放。原完整历史/Goal/Sources/两暂停计划继续真实回读。先关页、shutdown200、原exec/native/launcher0及物理/输出/请求/OS（Operating System，操作系统）出生链后退休配对副本并核源保持。三索引、docs检查、范围提交、fresh fetch/普通merge/待推全集审查/正常push hooks；本轮不创建Release或tag，持续Goal仍active。

## 基线实际根因确认

38476/main-Rn-pJKfx.js，自有页45真实Code/Chat明确GPT-6.1 Sol，预检PREFLIGHT_843_BEFORE_OK。新Session ses_-zUQMMOfWzzM4JVQUxAt、Project prj_h7XG4vDvqjrfblbqtJ10；实际新项目位于本轮runtime/data/projects之内，核边界后只向其根目录create-only复制四份自有输入。模型实际read主TXT和overview.md，正确回复BIRCH_843/43，产生真实Sources及编码项目链接，共六自然消息、两个completed read，未读图片或写文件。六实际请求全部精确gpt-6.1-sol/stream/200/EOF，累计1158，余2额度退休，after仍0请求。

实际点击自然回答中的主TXT链接，当前DOM属性仅作为诊断显示path=复核 %231 %26 plan%2B.txt；真实界面错误详情记录HTTP GET 404、requestID a5b6d031-0d16-4365-8278-9a9a26c614ec、query path含%2523/%2526/%252B及FileNotFoundError.data.path同一错误名字。点击真实Sources按钮则打开正确复核 #1 & plan+.txt原三行，证明文件、模型和后端原件有效。Project内Source沿现合同进入可编辑项目workbench，Save禁用代表未修改；不将其误称为canonical附件的只读reader，也不改现权限语义。

再打开真实overview.md并切Preview，相对图片出现失败反馈；展开详情为HTTP404、requestID 10d03158-ee26-4cfd-b18f-34c039a7c6c9，实际请求图 %231 %26 plan%2B.png及同名FileNotFoundError。同一预览的字面百分号链接却成功打开百分号%23.txt及原两行，证明后端必须保留字面百分号、只在URI入口解码一次。公开file/content checker对四个真实名字均200，48/42/325/86030原字节完全匹配；对两项实际UI错误名字返回精确404/FileNotFoundError，原请求/返回均保留。03/05是实际UI错误而非Node回读构造，04/06是实际正确原件，全部六张已亲自查看。两个DOM role选择器未匹配工具的native角色，均重新读取AX（Accessibility，辅助功能）状态后用现控件索引完成点击，不算产品失败或验收通过条件。

确定仅将markdownProjectFileReference与FileEditorPane.previewImages的decodeURI改为decodeURIComponent。两处在现URL/资源分类之后承担本地路径文字解码；保留先parse范围、单次解码、原属性委派、当前Project/API authority、HTTP/canonical附件处理和后端原始文件名。无新增公共helper、重复实现、输入猜测或后备分支；纯UI路径修复按仓库约束只以真实交互/截图验收，不新增UI自动化。

基线页45关闭，public shutdown200，原exec42118/native12628/launcher0，物理/输出/请求/出生链结清后退休auth/models副本，源保持，余3105872毫秒。schema9/92表、原226305所有业务行字段保持，当前227960；100 Session/8 Task/773用量，仅新增本轮真实六消息/十四Part、两read及正常receipt/记忆。两个原过期容量槽只四字段按当前native身份复用并物理释放；121附件及旧文件/Git保持。候选使用同一未延期deadline及本轮原六消息。

## 修复与候选实际验收

两处现UI入口已直接使用标准decodeURIComponent；没有新函数、模型/协议/后端改动或路径猜测。Overlay类型检查、普通build及renderer public surface检查均exit0；i18n检查两语言2674 top-level keys通过。未运行任何UI自动化。候选冻结main-BYRLiwcz.js，38477从已退休before续存原227960行、121旧附件加新QA发布的两canonical文件，共123保护文件；所有输入四文件及原Git继续保留。目标模型仍精确投影，但候选0请求。

自有页46直接打开原Session，未让模型重写回答。真实点击同一正文链接，属性现在是复核 #1 & plan+.txt，原三行及BIRCH_843/43正常出现。真实打开同一overview.md并切Preview，原图片实际显示；点击文档第2至3行链接，属性path正确且line=2/endLine=3，编辑器准确选中第2–3行，09实图已亲自查看。再点击字面百分号原件，仍打开百分号%23.txt及原两行，验证只解码一次。中文切换后再次实际点击原模型链接、打开文档预览，中文菜单/源码与预览/来源/保存下载/空闲状态/日期均正常，模型原文和真实文件名保留。07–12六张候选实图全部亲自查看；十二图均为实际JPEG（Joint Photographic Experts Group，联合图像专家组格式）输出，没有修图或截图基线。

原六自然消息的完整snapshot与selection逐字段一致；候选公开file/content回读四输入均200且精确原字节，两次实际read仍completed。浏览器warn/error计数before/after均0仅作诊断：基线实际UI仍有明确404，不能用console clean冒充体验通过。候选无新Provider请求，整批6、累计1158，原六请求全部流式200/EOF，余2额度已退休不追加。

八组原真实HTTP（Hypertext Transfer Protocol，超文本传输协议）checker通过：Task68/Mission80/Chat3/Work8完整原历史与Goal、旧Sources4/3消息、README176字节原件、824六消息双来源、825两/四消息、空历史选择及22原件、额外预检2/Goal9消息242063 token/39原件、两暂停计划及三命名原件保持。所有原数据和物理文件/Git保护亦覆盖841两组五消息/原件及842续存事实，不用当前用例通过外推调度恢复合同。

页46关闭，public shutdown200，原exec18889/native/launcher0，物理/输出/请求/OS出生链结清后退休配对副本，源auth metadata与catalog字节/metadata保持，余2329326毫秒。schema9/92表、原227960业务行字段保持，当前227962；仅新增一次runtime_process物理身份receipt及一grant，PID/出生身份与native ready精确一致，按process-liveness现合同保留历史，不是待运行工作或死亡deadline。容量槽无变化，100 Session/8 Task/773用量保持。123附件、四输入、十三旧Git项目28 tracked及十三+三十九原文件、旧各用例通过保全。没有真实用户数据库升级、版本更新或发布。

本轮范围为两处UI解码、当前07合同、方案/四输入/十二实图/脱敏回执及三索引。提交前执行docs检查；每次push前fresh fetch/普通merge/待推全集审查，正常hook检查准确提交树，保留其他工作区改动。最终远端收敛结果私有回执保留，持续Goal仍active。
