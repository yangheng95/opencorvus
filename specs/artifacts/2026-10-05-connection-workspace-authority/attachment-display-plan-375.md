# 375 附件正文引用的原始名称

## Recall

用户要求持续自主改善Sources、UI/UX（用户界面与体验）和功能，最新人类指令明确仅单agent。374 d06a62ec6b0ed58a12f8b3b6cd66a472f5e48e3b已正常提交推送；375开始git status为空。前轮是有真实代码、67项合同、9图和9个Sol EOF的进展，不是等待。目标保持active，旧goal文字中的Astra委托已被最新指令覆盖。

374 after/05显示原始附件名称，after/06和07通过正文打开同一blob时显示长数据库/内容存储名。已读374 Recall与完整当前实现、07-panel附件/身份/编辑合同；全仓检索FileContent、displayName、File.read/readSource、AttachmentStore.readReference/nameFromAbsolutePath、ReadTool标题、SDK（Software Development Kit，软件开发工具包）生成脚本与相关测试。FileEditorPane清空旧content后加载新资源，并以现有generation/authority/identity提交结果；无需新缓存或加载器。相关测试都是数据/服务，未发现本轮需运行的UI测试。

## 根因与影响

显式Source按钮传递来自canonical metadata的原始title，正文普通引用只携带路径；File.read虽已识别附件保护保存，但FileContent协议不投影显示名。工具栏、图片alt、PDF标签及文本编辑器无障碍名称均只读取target.displayName，因而正文入口展示存储路径。374仅修身份/只读边界，未加入内容呈现信息；不能靠截短hash或猜测文件名解决。

新增FileContent可选displayName，仅由项目文件读取在确认当前Project实际store归属后，读取AttachmentStore canonical metadata产生：有原始filename则完整保留，否则复用既有generated displayFilename规则。普通文件、metadata sidecar及同名普通副本不新增别名。File.readSource继续独立绝对字节读取、无可编辑revision；明确Source目标已有历史显示标签，保留该入口契约。字段不影响文件身份、revision、保存与导航admission。

File.read在原有权限及physical-path校验和内容读取后，针对canonical附件返回附带displayName的同一内容对象；文本、图片、PDF和binary均覆盖。显示读取与文本写入能力沿同一个nameFromAbsolutePath归属函数，不新增目录/哈希规则。缺失canonical metadata产生FileNotFoundError及明确metadata文案，错误不会改为存储名；其它原始metadata错误保持原异常。条件写入仍沿374的唯一锁内只读检查，不因展示metadata读取改变保存错误合同。

编辑器以明确Source目标的displayName或当前加载内容的displayName作为同一呈现值，复用于标题、图片alt、PDF label和CodeEditor ariaLabel；已有content生命周期清理防止串名。标题tooltip保留真实资源路径，便于区分原名相同而内容不同的附件。displayName不参与资源合并。没有新路由、数据库迁移、模型协议、调度、队列或恢复改动；如出现真实控制流异常立即横向审计共享机制。

## 验收

改前视觉复用374 after/06、07。先更新正向File内容合同并运行，证明当前字段缺失；再实施。测试覆盖原始Unicode/空格标点、同名不同bytes、文本/PNG/PDF/普通副本/metadata sidecar、项目内目录链接及Windows大小写、缺失metadata的明确错误。所有都是实际文件/store/service合同，不运行或新增UI自动化。按现有SDK build重新生成OpenAPI与客户端，类型/正式overlay build及docs检查。

声明唯一attachment-display-375-after /18382 NativeService，既有launcher固定600000ms和12累计请求，不延长或重开。授权auth与完整models成对私有复制，分别核对usable/projected/actual gpt-6.1-sol streaming。真实上传两份同名不同文本、仓库已有PNG及PDF，写入来源与原始完整字节；只有文本要求模型实际read生成Sources，媒体链接明确作为待查看输入，不伪称模型已读媒体。/ui实际点击Sources与正文相对/绝对引用，两同名文件内容可区分，图片/PDF正常显示原名且只读，切换普通文件及缺失metadata展示清楚；截图逐张人工检查。

所有输入都是自建隔离scope；不操作用户页面/进程或开发子agent。独立checker核对真实HTTP（Hypertext Transfer Protocol，超文本传输协议）、消息、ToolOutcome、Source及完整文件字节；视觉以实际截图为准。结束闭合原launcher、页面、Native/Provider/output/request/端口/auth-models，保留完整脱敏证据、更新spec索引，范围提交、fresh fetch/merge、完整待推集合审查及普通push。不创建分支、worktree、tag或Release。359首次复制、非UTF8与跨数据库目录未验不扩称通过。

## 实页发现的关联入口缺口

375 page200/18382 的真实PNG Markdown链接保留了普通相对href，实际点击后进入/ui/.opencorvus/...png并显示无样式Preparing Environment，00-image-link-before.png已人工查看。这不是Native/Task调度失败：模型已真实完成两次read与终答，运行服务正常，原链接缺少data-project-file-path，浏览器离开应用的实际URL与代码流一致。

全仓检索共享FILE_EXT_RE、markdownProjectFileReference、extractFileReference、main的两类点击委托、imagePreviewTrigger和File后端imageExtensions/mime投影。只有Markdown扩展集合遗漏常见图片，内联图片触发器不接管普通anchor；PDF/文档已在该集合。补齐现有唯一FILE_EXT_RE中的图片扩展，覆盖后端既有图片读取格式，不加独立点击监听或PNG专用路径。它同时修复正文链接与带路径的codespan。外部scheme和/attachment URL仍按原显式协议处理；不改Markdown图片语法。

这是当前媒体正文入口验收发现的问题，纳入375范围。正式重建前端后只刷新自身独立页面并重新选择同一实际会话；同一Native固定600000ms/12请求预算保持原值，不重启或延长。以真实PNG链接进入预览及图片原名截图验收，不新增UI自动化或源码文案断言。

## 完成证据与后续调查

改前7项File合同1pass/6fail，缺口包括文本/媒体显示名与明确metadata错误；改后7+1+6=14相关合同通过。SDK正式生成只改变FileContent displayName的OpenAPI/schema类型，74968 exit0；55289 overlay typecheck exit0。初始91514 build52.47s/main-DBS38_Bl.js；图片入口修复后补全File既有25种图片扩展（并不宣称浏览器能解码每种相机RAW格式），82271/46296两次重建均exit0，最终51.88s/main-CAo85tzZ.js。

after18382/page200实际read两份同名文本，各来源范围1–1、不同sourceID和不同正文内容；上传的PNG/PDF只作为待查看输入，没有声称模型读过。最终构建01–10实际打开两种正文引用、原Source、PNG及放大预览、16页PDF第一页、普通可编辑文件、缺失metadata的404详情、恢复metadata后Retry，以及切回第二份附件。原始名称、正文、只读和真实路径tooltip分别正确。00图片链接失败、00b重建期间旧worker失败及01–10共12图已逐张人工复核。6项真实内容HTTP检查成功，5个附件完整bytes与上传原件一致，ordinary正文一致，missing元数据已原样恢复。

00b是一个独立且已证实的资源生命周期问题：Back复用main-DBS38_Bl.js的旧页面，服务目录已重建，02:14:43.552实际GET markdown-render.worker-D_K6Yc7v.js返回404；自身页面刷新后02:15:21.800新main-CAo85tzZ.js为200，新worker-CF9y63Km.js亦200，正文正常。不是模型、LLM调度或Sources身份失效，不把最终刷新成功声称为已修复该旧页面问题。下一轮审查服务静态资源版本生命周期及旧页面恢复。两个浏览器console采集均为空，不能用其替代已见错误截图与实际HTTP404事实。

原15128和shutdown实际exit0，Native568620ms（原固定600000内），6次gpt-6.1-sol流式HTTP200/EOF，2个真实read与自然终答、另含预检终答。Host/Native/output/request/端口/成对auth-models及页面200闭合，最终IAB为空。没有开发agent委托。资料按完整脱敏日志/AX压缩并保留私有原件；普通提交和fresh upstream同步后继续goal active。
