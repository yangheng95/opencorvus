# 读取路径拒绝的具名合同

## Recall

持续批次迭代直到用户明确停止；先完整根因/影响落盘，再有证据实现、实际开发模式/ui桌面交互和本人截图复核、聚焦正向checker（检查器）、范围提交/普通上游合并/正常push后自主下一批。用户要求“不要用子agent，你自己工作”，本批单人。b28 3178fb0c9已正常push、全钩子/密钥0、本地upstream（上游）0/0、原177状态完整、暂存空；66项673断言、6真实TCP（Transmission Control Protocol，传输控制协议）/schema（结构）校验、8截图及33/19原字节。Sol授权未收到，零模型/凭据。

已读File.read/list/canonicalPath/isPathAllowed/realpathIfExists/fileInvalidPath、writeText/assertAllowedFilePath/openDownload/upload现具名拒绝，及绝对source citation（源文件引用）单独权限路径。全仓File.read/list生产调用仅HTTP（Hypertext Transfer Protocol，超文本传输协议）各一路与debug CLI（Command Line Interface，命令行接口）各一路；另搜索全部同义“Access denied: path escapes project directory”，三处仍是通用Error，两处写入/下载复用的assertAllowedFilePath已是FileInvalidPathError。已读routes/file.ts的400共享响应、error-handler现具名400、FileExplorerPanel具名错误摘要、FileEditorPane实际load失败/Details/Retry；读test/server/file-error-contracts与file-link-entry-contract、file-mutation-root-contract当前正向路径拒绝合同、当前07-panel/02-data路径身份/物理归属公开约束与b28完整Recall。未发现第二读取/目录权限来源，不修改高级source-content引用原约束。

## 根因、影响与实施前方案

候选现象是普通项目文件读取/目录列表的越界路径或链接目标已被原isPathAllowed拒绝，却进入UnknownError/500，原请求路径未随具名领域错误发布。直接触发为词法项目外路径或解析到项目/工作树范围外的链接；当前三处拒绝直接throw new Error。旧write/download已经用现fileInvalidPath工厂与400，read/list的路径拒绝遗漏了同一事实表达。此时访问决策本身正确，不能把诊断缺口包装成扩大访问范围的理由。尚待正式实际文件checker和TCP/页面红证，未确认不实施。

方案候选仅把File.read的初次full路径、解析后的physical路径，以及File.list的resolved路径三处已存在拒绝，发布现fileInvalidPath({path:原输入, message:原拒绝文本})。保留原isPathAllowed/canonical/realpath检查与顺序、工作树范围、成功格式、非原子物理重定向风险；不合并两个有意义的读取观察、不加预检查/重试、重写路径、fallback（后备实现）或新权限gate（流程门）。根空目录合法输入保持，missing仍是b28的具名404，真实权限/IO（Input/Output，输入输出）未知故障仍按原500。仅file.read和file.list的400声明用现fileMutationErrors[400]合并原BadRequest与FileInvalidPathError，handler/公开错误类型无新实现。

影响面包括HTTP/CLI四个入口、现FileInvalidPath工厂/消息/原path、读取成功/目录节点与既有链接/跨工作树事实、SDK（Software Development Kit，软件开发工具包）类型/完整运行时协议、两语言API文档、当前架构及正向测试。所有实际源和项目外文件都是本人Temp自建内容，不访问用户私有文件。UI（User Interface，用户界面）产品源码预计不改，编辑器仍展示原load失败/Details；本批只声明具名路径诊断改善，不夸成新增专用拒绝页面。截图需实际打开自有项目外链接并查看真实400/原path，正常项目/范围内链接正文保持。

无数据库或持久格式、消息/LLM（Large Language Model，大语言模型）、Task/Mission/Session occurrence（执行轮次）队列/并发/唤醒/恢复/终态修改；未观察相关异常，不扩展共享调度审计。风险是误改原访问约束、把原始逻辑别名换成物理外部路径、吞掉未知错误、改source-content高级引用、Schema与真实响应漂移或测试误把非法读内容当成功。分别以原条件完全保持/原path精确错误合同、正常范围内正向内容/原字节和350个其它操作完整协议保持验证。API拒绝响应只验证明确名称/path/message，不添加“未读取/不包含”等负向核心断言。

## 体验和验收计划

先在现正式server/file-error-contracts增加正向实际文件检查：项目外词法文件读取/目录列表、外部文件链接读取/目录junction（目录联接）列表，均预期原FileInvalidPathError/400/原逻辑path与原拒绝文本；同一项目的正常文件/合法范围内链接读取与精确目录输出/原字节。现handler已有映射，不新增测试专用权限实现。先红后补实证定稿，真实操作与当前运行时/doc的Ajv2020（JSON Schema验证器）合同一致。相关原链接/目录/下载checker按影响面聚焦，不运行UI自动化或无目标全量测试。

Temp opencorvus-iteration-20261109-b29，fresh profile-before/after、自有Git项目/私有配置；dev38976/38977 /ui，项目外的自有普通文件/目录位于同批Temp并通过路径核对。链接由正常Node.js文件系统创建，不移动用户数据、不操作用户窗口/进程。本人真实打开项目内普通文件和外部目标链接，查看原500与改后具名400 Details、中文/英文和重试/恢复正常读取，截图人工呈现复核；不能以source/DOM（Document Object Model，文档对象模型）文本或构建代替视觉。外部链接拒绝是原权限事实，页面没有专用拒绝提示的范围如实记录。

正式SDK生成、必要包构建/类型/正常UI构建与docs:check/architecture-index辅助；完整before/after/doc及正式SDK协议比较只允许file.list/file.read的400变化，共享schema及其余操作保持。真实TCP进入Ajv checker；本批所有自有原文件/外部文件准确字节保持。正常关闭本人页面/HTTP shutdown与原session退出0，原177状态/三个README仅本条，范围提交/拉取并普通merge上游/待推全集审查/正常push后单人继续。b23空目录搜索、b25持久portable路径、b28root缺失视觉与其Windows移动拒绝具体handle原因仍开放，不混入本批。

## 实施前实证与定稿

正式原runner定向5项：1pass/4fail/18断言，四种真实词法/链接目标拒绝全部500/UnknownError而非具名400，正常文件/范围内链接/准确列表通过；物理/output结算true，失败runtime yNJ5TY保留。不是模型或外部文件内容引起的请求异常，代码在原范围判断失败处直接throw通用Error、共享handler按Unknown发布。真实TCP同四项500；普通notes/inside链接200，before-tcp-and-bytes记录全部回执、四项自有原始字节和正文。

本人38976/IAB62实际打开outside.txt，01普通加载失败，02展开原Details为HTTP GET500/UnknownError，Request ID 95f4286f-aba4-47dc-9832-aea2e3a4d348；03实际打开inside.txt显示范围内原文。三截图均本人呈现查看。页面62关闭、正常HTTP shutdown200，原session42429退出0。整个流程只有自有项目/同批外部自有内容，没有Provider凭据/模型。

实施定稿：三个原拒绝条件与顺序完全不变，只把原通用Error改为现fileInvalidPath({path:file或dir??"", message:原拒绝文本})；File.read仍保留full及physical两次真实观察，File.list仍保留原目录观察，source-content/下载/写入/上传权限不变。file.list/file.read的400使用原共享fileMutationErrors[400]，保留BadRequest和已有404/500；不新增错误class/handler或路径策略，不把项目外实体误报为内部运行故障。正式SDK/API文档与07-panel同步原路径诊断。UI源码不改，真实页面继续展示现加载失败/原Details，本批不声称新增专门的拒绝文案。

## 验收和交付范围

正式runner：server/file-error-contracts 15pass/180断言、file-link-entry-contract 56pass/523，共71pass/703，原runner54754退出0、物理/output结算通过。四种新实际拒绝输出400/FileInvalidPathError/原逻辑path/原文本；正常内容与范围内链接、目录节点及四项自有原字节正确；b28的missing404与未知IO局部注入500也通过。没有运行UI自动化或负向核心断言。

backend/overlay typecheck、双语2923键、正式SDK build、Plugin typecheck/build、正常UI build88秒/renderer public surface通过；实际页面仍main-CqR40y3e.js，UI源码没有变化。完整352操作对比，仅file.list/file.read的400响应从原BadRequest拓为原BadRequest|FileInvalidPathError（含原共享响应描述），其余350操作、404/500和共享components精确保持。正式SDK paths/components去除CLI专属x-codeSamples后与真实/doc一致；对应types、OpenAPI与中英文API文档同步。9次Node.js Ajv2020直接真实TCP/doc响应全部schema有效，含4项400、正常读取/列表/root200、missing404。证据after-tcp-protocol-bytes/tcp-schema-check，不以静态类型或假schema代替实际契约。

本人38977/IAB63：04实际打开原outside.txt仍为原加载失败页面，05 Details为HTTP GET400/FileInvalidPathError，Request ID 7787d112-de93-4929-8af2-c8b74794679d、path=outside.txt及原拒绝文本；06当场中文提示/重试控件/标题，技术原诊断保持。没有新增专门的路径拒绝标题，此限制明确保留。07核对自有Temp/链接类型/原目标后，将该测试链接临时指向范围内folder/notes.txt，真实点击中文“重试”读出原范围内正文；原逻辑名称outside.txt保持。页面关闭后恢复该自有链接的原外部目标，真实TCP再次400，后续物理resolve核对准确。不是放宽权限或改写用户数据，只有自有测试链接目标恢复操作。

全部7张截图均实际呈现、本人查看。公开正常notes/inside读取与物理原文保持；四份自有原文分别39/26/48/28字节（项目原文/项目子文件/外部自有文件/外部自有目录文件），CRLF/LF及Unicode逐字一致。原外部链接与范围内链接的物理目标恢复正确；没有使用摘要/校验和作功能门槛。页面62/63关闭，服务42429/12486正常HTTP shutdown200，原session退出0，未动用户窗口/进程。

产品范围只原read/list拒绝的具名诊断、两个400声明、正式SDK/API文档与07-panel；原权限/读取顺序/source-content/持久数据保持。full与physical两次观察之间的真实重定向竞争、完整高级引用和所有权限/IO矩阵本批未重验，不声称新增原子保障。GPT-6.1 Sol授权未收到，模型验收未达成、零模型/凭据。此前空目录全局搜索、portable持久路径、root缺失视觉/Windows移动拒绝handle原因仍开放。保留原177状态、共享三个README仅本条，范围提交/普通上游合并/完整待推审查/正常push后继续单人下一批。
