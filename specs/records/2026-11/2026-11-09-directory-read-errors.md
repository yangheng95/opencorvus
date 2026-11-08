# 目录读取的具名缺失合同

## Recall

持续批次迭代，先根因/影响与方案落盘，再有证据实现、真实桌面/ui交互与截图本人复核、聚焦正向checker（检查器）、范围提交/普通上游合并/正常push后自主下一批。用户要求“不要用子agent，你自己工作”，本批单人。b27 1928cfdbf正常push、全钩子/密钥0；原177状态保持、暂存空。GPT-6.1 Sol凭据授权仍未收到，继续零模型/凭据。

已读File.list整个控制流、canonicalPath/isPathAllowed/isMissingPathError/fileNotFound，以及原readFile/读附件/下载对ENOENT/ENOTDIR的同语义具名处理；全仓File.list生产调用仅HTTP file.list和debug file list命令。已读route/file.ts的fileMutationErrors/当前file.list响应、共享error-handler已有FileNotFoundError→404、前端loadDirectory的原失败Map/刷新/selection退休、fileErrorSummary现具名本地化/Details及root显示合同。相关File链路/链接目录正向checker、server/file-error-contracts运行时/doc/Ajv2020真实schema验证、SDK正式build生成流程已读；不运行UI自动化。07-panel/02-data公开原身份、路径权属、反馈/真实读取合同保持。

权威[Node.js 22系统错误说明](https://nodejs.org/docs/latest-v22.x/api/errors.html#common-system-errors)区分ENOENT路径组件缺失与ENOTDIR某组件并非目录，并指出后者常由readdir产生；error.code比可变message适合分类。仓库现isMissingPathError已统一这两种无法解析预期目标的情况，本批复用，不用文案匹配，不扩大到权限/IO（Input/Output，输入输出）未知故障。

## 根因、影响和实施前方案

候选可观察现象：File.list直接await readdir，目标缺失或某组件为普通文件时原系统错误进入UnknownError/HTTP500；当前OpenAPI（OpenAPI Specification，接口描述规范）也未声明404。前端已有FileNotFoundError中文/英文摘要，却收不到该领域合同，只显示通用加载失败。尚待正式checker及真实TCP（Transmission Control Protocol，传输控制协议）/页面确认，不能仅凭最后错误状态当根因。

直接触发为目录在读取前被外部移动/替换，或公共API请求原本就非目录的路径。数据/控制流根因是仅目录列表的readdir边界漏接现missing分类与EntryNotFoundError；原文件读取/下载已使用这一分类，但列表旧路径未同步。只在readdir这次观察失败处转换明确ENOENT/ENOTDIR；不把子项stat/ignore读取/越权/权限/未知错误整个包进catch，不做stat预检查或新重试/后备路径，原路径权属和真实观察保持。原成功ListingNode/type/directoryTarget/排序/Unicode路径/根空key合同不改。

拟实施（以红证和实际结论补定稿后为准）：readdir(...).catch仅复用isMissingPathError并发布fileNotFound({path:dir??"", message:目录缺失明确文本})，其它错误throw原对象；路由file.list新增现FileNotFoundError的404响应。共享handler/错误类型无新实现。正式SDK生成和根API文档同步，必须比较完整运行时协议，仅该operation增加404、共享components/其余操作保持。CLI收到原领域错误但不再冒报内部系统异常，不改其输出成功格式。

影响涵盖HTTP/CLI两个生产入口、现File命名错误工厂/数据、前端目录load反馈和共享错误分类、SDK类型/文档/架构、真实正常/缺失/非目录/未知错误检查。数据库schema（结构）与持久格式无变化。Task/Mission/Session occurrence（执行轮次）调度/队列/唤醒/恢复无异常实证，不改其机制。风险为过宽catch吞未知错误、把非目录错误硬编码成某平台message、隐藏原路径、根空key摘要失去名称、操作链只验证假schema。以原code分类、局部catch/真实文件checker/公开doc和实际页面验证。

根空key是有效列表输入，404仍须保留原空path身份；若真实页面显示空白根路径，使用现explorerDirectoryDisplayPath仅在load目录摘要展示根目录标签，不改API/Details路径，也不改其它文件操作的空路径语义。该条件必须先获实际证据再改UI。空目录全局搜索与portable（便携）持久路径升级仍是原开放项，不混入本批。

## 验收计划

先新增正式backend正向测试：普通缺失路径、普通文件路径、file/child中间非目录的实际请求返回明确404/FileNotFoundError且原path/message；正常有内容/空目录的明确ListingNode输出、原字节保持；未知IO故障保留明确500/UnknownError（若用局部系统函数注入，仅局部合同，不称真实OS（Operating System，操作系统）/端到端）。接运行时/doc验证响应schema。全仓相关旧测试只运行非UI正向合同，禁止负向核心断言和无目标全量测试。

Temp opencorvus-iteration-20261109-b28，自有Git/原文/目录、fresh profile-before/after、私有Git配置，dev38974/38975 /ui。真实TCP记录原500及改后404/正常200。本人在列表已加载后把自有目录精确移动到同Temp内的保存位置（先验证两个绝对路径属于本批目录），再立即在隔离页面展开原目录，读取真实服务错误；不删用户资料、不改变用户窗口/进程、不使用模型。自动15秒root刷新可能先退休原行，应如实记录时序，不能强制DOM或伪造响应来通过。必要时在自有全新页面/服务再做一次受控正常尝试，未获截图不能宣称视觉达成。根目录缺失若验证，必须保留源数据并恢复后核字节，检查原owner是否允许进入列表，不能假设成功。

最后恢复自有目录、原文/具名错误/正常目录回读，正常关闭页面/HTTP shutdown/原session退出0；类型、必要SDK/Plugin构建、正常UI构建/语言（UI发生变化时）、docs:check/architecture-index是辅助。保留原177、三个共享README仅本条，范围提交、拉取并普通合并upstream、待推全集审查、正常push后单人继续。

## 实施前实证与定稿

正式原runner定向directory listing共6项：3pass/3fail/20断言，三个缺失/非目录输入都实得500/UnknownError而非404；正常具体ListingNode/空目录与EACCES/EIO局部注入的原500合同通过，物理/output结算true，保留失败runtime fiwsBX。真实TCP同三项500/UnknownError，empty/gone正常200；完整before运行时doc存本人Temp，用于改后完整协议差异比较，原回执见before-tcp.json。IO注入只证明现catch分类边界，未冒称实际权限/磁盘故障。

本人38974/IAB59第一次子目录移动后，15秒root刷新先退休原行，点击没有匹配；IAB60第二次跨工具移走后菜单也先退休，均不算视觉通过。尝试移动整个自有项目root前核对两个绝对路径同属本批Temp，Windows返回WinError5拒绝访问，root没有移动；当时子目录已恢复，原数据保持。具体哪个打开handle造成拒绝访问未知，不推断为运行调度故障，不杀进程或关服务绕过，也不宣称root缺失视觉合格。

第三次把已核对范围的Node.js自有fixture目录rename与真实CUA（Computer Use Automation，计算机交互工具）菜单Expand操作在同一人工交互调用内连续执行，避免模型/工具往返超过刷新窗口；未拦截网络、注入DOM或伪造响应。实际01页面显示Unable to load gone/Unable to load files，02展开Details为HTTP GET500/UnknownError、Request ID 2b8d6fd2-9542-4342-87ee-1aaa164b2315。原目录恢复后真实Retry成功显示marker.txt，03截图。三张均本人呈现查看。原notes/marker公开200与物理字节核对保持；本人页面59/60关闭、正常HTTP shutdown与原session13770退出。

按原边界实现readdir本次ENOENT/ENOTDIR观察→现FileNotFoundError/404，原path不改，message为Directory entry not found，根空key的诊断显示点。仅file.list新增原具名404 schema；其它error/权限/ignore/stat观察原样传播。根空key的UI（用户界面）路径通过代码可见：FileNotFoundError data.path仍空，原summary直接插值会留空。为避免此次具名合同把有效root标签丢失，修订原条件方案：目录load的path摘要直接复用现explorerDirectoryDisplayPath，与已有targetDir展示共用；其它文件操作/原数据/Details不变。根视觉因上述Windows限制未验，明确保留；改后真实子目录错误区域与两种语言仍须完整呈现复核。此为展示事实修订，不以局部注入声称root端到端通过。

## 最终验收与限制

正式runner：server/file-error-contracts 10pass/150断言，file-link-entry-contract 56pass/523断言，共66pass/673；物理/output结算通过、原runner session83869退出0。新六项覆盖三种实际missing输入、正常具体/空目录、EACCES/EIO局部系统函数注入的明确500；后者只局部合同，不宣称真实权限/磁盘故障。已有链接目录/物理源边界真实checker通过，没有运行UI自动化，没有新增负向核心断言。

backend/overlay typecheck、双语2923键、正式SDK build、Plugin typecheck/build、正常UI build90秒/renderer public surface通过。实际页面main-CqR40y3e.js。运行时352操作仅file.list增加404，共享components精确保持；正式SDK协议只去除其CLI（Command Line Interface，命令行接口）专属x-codeSamples扩展后，paths/components与真实/doc完全一致。生成改动只有FileListErrors现404类型、对应OpenAPI响应及中英文API文档该行，无新错误schema/并行事实源。协议/真实TCP细节after-tcp-and-protocol.json，另外Node.js Ajv2020直接请求真实TCP/doc与六个文件列表响应全部schema有效，tcp-schema-check.json；不是静态字符串或只拿fixture判断。

本人38975/IAB61，已核对同批Temp绝对路径后实际移动自有gone目录，真实菜单Expand请求到404/FileNotFoundError；04英文摘要准确提示文件项不可用，05原Details为Request ID 503e3b0d-8d97-423f-8839-3473b5134609及原path/message，06当场切换中文显示“请求的文件或文件夹不可用：gone”，原诊断不翻译。恢复后首次跨工具点击Retry前，正常root刷新已收起旧错误，这次点击未发生；不算失败重试通过、不为其改刷新机制。随后真实关闭/重开本人Explorer，连续进行同样物理移动→Expand错误→原目录恢复→真实中文“重试”成功显示marker.txt，07截图；08实际打开gone/marker.txt原文。全部8张截图均实际呈现、本人查看。

真实TCP三种无目录目标为404且原path/message精确匹配；empty/gone/root空key正常200。源notes.txt33字节/CRLF与gone/marker.txt19字节/LF在公开读取和物理UTF-8字节均精确保持，before-restored-bytes/after-tcp-and-protocol可核。目录全部恢复，未丢弃资料、未用摘要作功能门槛。页面61关闭；服务13770/94061均正常HTTP shutdown200、原session退出0，未动用户窗口或进程。

产品改动为File.list局部missing分类、file.list原404响应、目录load根key使用既有显示primitive（基础组件）；公共错误/handler/授权/读取顺序/持久格式保持。07-panel与正式SDK/API文档同步。根目录实际缺失的视觉和Windows拒绝移动根因仍未验；字段空key保留及根标签处理为代码数据流证据，不能宣称该分支端到端通过。未获GPT-6.1 Sol凭据授权、模型验收未达成，零模型/凭据。原空目录全局搜索、portable持久路径升级仍开放。保留原177状态，范围提交/上游普通合并/完整待推集合审查/正常push后自主单人下一批。
