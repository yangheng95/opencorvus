# 图像派生失败的公开领域错误

## Recall

用户要求持续按批并行体验UI（User Interface，用户界面）/UX（User Experience，使用体验）、功能调查、根因和影响分析先落盘，真实桌面/ui交互、截图人工复核、聚焦正向测试及获授权的GPT-6.1 Sol验收，范围提交、上游合并和正常推送后继续，直到明确停止。前批3f9c04712已正常推送，本批开始HEAD/upstream 0/0，git status --short原177条逐项保持、暂存空。终端Sol凭据授权继续待答复，本批零模型请求，不读/复制/调用凭据。

并行只读functional/ui子代理调查图像转换边界、NamedError（具名错误）公开/日志、正式文档生成、现有HTTP（Hypertext Transfer Protocol，超文本传输协议）测试和当前FilePart错误呈现，禁止再次委托。主代理已读attachment-store、attachment routes、attachment-reference、NamedError、serverErrorResponse/error声明、attachment-download全部三测试、当前02-data/07-panel、近两批媒体/原下载记录，搜索全仓imageRendition调用与同名/同语义错误、模型图片/Office领域校验。唯一生产调用为公开attachment variant路由；无当前ImageRenditionError定义。无触及UI自动化测试。

## 根因、影响和证据

真实前轮自有坏PNG上传成功后缩略图500 UnknownError，细节仅request ID和通用服务提示（50ee82c5e原图06及资源记录）。上传只承诺保存原字节，并不承诺所有图片可解码；成功上传符合合同。当前唯一imageRendition读取既有源文件，未缓存时在sharp链rotate/resize/webp/toBuffer生成派生表示，普通native Error向外冒泡，被全局错误处理正确屏蔽为UnknownError。缺口是转换阶段缺少公开领域结果，不是全局屏蔽策略错误。

历史两profile统一了派生处理/缓存和有效SVG验收，没有坏输入公开错误。本轮两子代理核对当前sharp0.35.5：任意无效字节、PNG签名及截断数据得到普通Error，缺少可靠结构化分类，不能按英文message关键词判400/415/422。官方[metadata说明](https://sharp.pixelplumbing.com/api-input/)仅读取头信息而不解码压缩像素，额外预读metadata也不能证明完整有效；[constructor说明](https://sharp.pixelplumbing.com/api-constructor/)区分failOn处理敏感度。本轮维持现failOn和profile，给失败稳定说明，保留500的服务未能完成表示生成语义；状态依据[HTTP 500标准](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.1)，不宣称它证明输入责任。

精确边界是整个sharp(sourceAbs)到toBuffer，包括库内部源文件读取；只能称表示生成失败，不能称所有I/O（Input/Output，输入输出）已排除或纯解码失败。外部source stat、缓存目录创建/写入、最终stat保持原错误。现有cache stat忽略读取错误后尝试生成是既有行为，本轮不扩展清理或改缓存策略。两种variant共用唯一边界，所有UI、浏览器证据、Markdown及产物的读取自然受同公开路由合同影响。消息、源URL（Uniform Resource Locator，统一资源定位符）、上传引用、原件与sidecar（元数据伴随文件）、派生profile/cache身份保持不变；不新增自动重试或备用图片。

NamedError.create已有{cause}选项，toObject只公开{name,data}，serverErrorResponse保留具名500并先记录原异常；Pino原错误序列化保留caused-by链。无需新全局错误映射或日志通道。公开data必须只由规范URL、当前variant和稳定安全message组成，原native message/stack/物理路径只留cause。FilePart现Feedback和formatErrorDetails会显示原HTTP路径、request ID及完整公开body，中英文摘要/控件随语言，技术原文不翻译；无需新增UI解析或字符串匹配。

无Task/Mission/Session（任务/多步任务/会话）调度、队列、唤醒、恢复、并发或终态异常事实；转换失败不降级归因为模型行为。无schema（数据库结构）、持久数据格式或配置变化，不需迁移。公共错误是新增契约，必须同步附件GET响应声明、正式OpenAPI（开放接口描述）/SDK（Software Development Kit，软件开发工具包）及API文档，不能只改服务实现。

## 方案与验收

新私有临时根opencorvus-iteration-20261108-b08、全新OPENCORVUS_HOME/自有项目，before38932/after38933开发serve /ui。复用自有坏PNG字节作为本批输入；先正式上传并查看真实缩略图Details，分别真实GET两variant的UnknownError500，再原件GET200/完整字节，记录前态后才修改。

实施在AttachmentStore导出单一ImageRenditionError/Schema，规范名AttachmentImageRenditionError，data={url,variant,message}，variant从现profile keys推导。仅catch原sharp链，将原cause交给具名错误；当前500状态不改。附件GET 500 response直接引用该Schema与NamedError.Unknown.Schema的union（联合类型），不另抄数据结构，不改全局ERRORS.500。当前07-panel记录派生结果与安全边界。

聚焦正向测试扩展现attachment-download.test.ts，使用真实Bun.serve和serverErrorResponse：正式POST坏PNG→两variant准确500具名body/request ID；同原件GET200原名和完整字节；真实转换抛出的cause为原native Error；有效SVG两种真实WebP尺寸/像素/缓存复读；自有临时项目将派生父目录占用为真实文件，外部mkdir失败仍得到通用UnknownError500，原件继续可读。图像编解码数值属于后端媒体合同，不是UI截图/像素自动化。

按package正式SDK build事务生成OpenAPI/类型/client/dist，只交付实际生成变化，再docs:api/docs:check及必要类型/架构检查。实际after/ui坏图片Details查看具名body、规范URL、variant、请求编号、中文/英文控件和技术原文、一次重试的新编号；同时真实原件下载字节与正常图片呈现/两profile功能回归。坏图保持失败，禁止把同类重试包装成成功恢复。界面不改时使用当前普通前端构建，不创建UI自动化。

本人标签/服务正常关闭，原启动句柄exit0，无原件移动/修改。范围提交、上游合并、完整待推集合审查和正常hook推送后继续。图片全图打开预载仅日志仍为后续线索，不混入本批。

## 前态与最终决定

本批前态成立：正式页面上传48坏PNG字节，01人工查看当前失败块和真实HTTP500路径/编号；两variant实际HTTP响应均为UnknownError500、仅通用提示；无variant原GET200/image/png/原名unrenderable.png，完整48字节等于输入（before-http.json）。截图为诊断顶部，不冒称画面已经显示底部UnknownError字段。前态标签17已关闭，38932正常shutdown且原启动句柄exit0；源文件未移动或改写。

执行原定方案，保持500，仅公开{url,variant,message}，原生原因留cause。测试真实故障将覆盖派生目录占用，不改sharp内部文件读取，不能用该故障证明所有底层I/O分类。API生成、类型和真实after页面均完成后再交付。

## 最终验收与交付

实现及生成完成：AttachmentStore唯一sharp链捕获为AttachmentImageRenditionError；路由直接引用该Schema与UnknownError.Schema。正式SDK build成功，实际生成差异只有OpenAPI新增schema/500 union（53行）和SDK错误类型（15行），客户端实现无差异；正式docs:api更新两份API文档的错误名，docs:check（352 ops/26 groups）和architecture-index通过。Backend/SDK各自typecheck通过。没有UI代码/字典变化，实际服务使用前批普通构建main-CI32b5Sh.js。

聚焦bun test --timeout=120000 test/server/attachment-download.test.ts：4 pass/34 assertions（7.27秒）。新增一项真实Bun.serve合同同时覆盖正式POST坏PNG、两variant具名500及规范源/类型/安全说明/request ID、真实cause保留、原件200/名称/完整字节、真实派生父目录占用的外部mkdir故障仍为UnknownError500且健康原件可读。原三测试继续验证SVG两profile真实解码尺寸/像素/缓存重复、Office传输和PDF/SVG响应。没有mock、UI自动化或负向核心断言，后端编解码数值不是UI像素比较。

after38933/ui真实桌面复核：正式上传48字节坏PNG以及前批自有original-preview.svg对照图。02看到原HTTP500路径/编号，03通过诊断实际End滚动看到variant和安全message，04 PageUp/ArrowUp逐段查看具名body，05中文浅色的加载失败/详情/重试/移除与同一技术名称完整可读。滚动为浏览器原生行为，有平滑过渡；截图均在到达目标后人工查看，不用中间帧冒称字段已显示。一次Enter重试仍真实500、产生新request ID且焦点保留（after-page-retry.json），不能称坏图修复成功。

after-http.json直接读取实际生产端点：两variant均具名500，原PNG200且48字节与输入相等；有效SVG两variant200/WebP，由Pillow完整实际解码640×320和360×180，原SVG仍200/567字节和原名称。06打开有效图全图显示READ_ORIGINAL_SVG_B07；从其Header Download产生真实浏览器original-preview.svg下载，567字节完整一致（after-browser-download.json）。原件均未移动、改写或重新编码；sidecar和canonical引用保持，派生不是替代源。

after-native-cause.json记录实际服务错误：最新UI重试request ID f38bec86-db95-473a-a1eb-1fc2d8ce2541对应具名错误，message/stack保留caused by原native“不支持图像格式”诊断。公开HTTP body只有批准的url/variant/message；未将物理路径或原native异常公开。两profile都已有真实HTTP证据，但只有缩略图失败经过UI，不能把它当成全图打开预载失败已修。

全部六截图人工查看，本人标签17/18已关闭，38932/38933均正常HTTP shutdown且消费原启动句柄exit0；本人浏览器下载经事件/字节确认后移到私有根，未处理其他Downloads文件。无模型/凭据/消息、版本、Release或标签操作。范围提交、上游同步和正常推送以实际工具回执收尾；后续继续调查全图打开预载失败的可见反馈。
