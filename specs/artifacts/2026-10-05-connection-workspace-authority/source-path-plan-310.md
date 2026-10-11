# 310 来源文件路径关系

## Recall

用户持续自主改善Sources、UI（User Interface，用户界面）和功能，最新明确单agent；旧goal并行措辞不执行。309已推送bc1b9257942be5c61097bb9b8d53203f6e104326，修复真实无标题站点重复和下划线层级，上一轮progress；本轮起始干净。

先查提示框边界：共享Tooltip已有overflow-wrap:anywhere、Kobalte的视口与safe-area处理，未取得新提示框缺陷，不推测打补丁。进一步发现来源文件进入项目编辑器前使用relativePathFrom，而该函数无条件把base/target转小写，且只判断原始分隔符前缀。已读SourceParts、CardParts、tool.ts、file-change-summary、FileWorkbench入口与后端File.read/readSource/canonicalPath，搜索全仓定义和调用及当前07-panel。

## 根因与影响范围

当前relativePathFrom在POSIX（Portable Operating System Interface，可移植操作系统接口）大小写不同的兄弟目录之间可能返回项目相对路径，导致SourceParts选错project File接口；Windows同一目录若混用斜杠则可能被当作外部来源。根目录“/”还会被尾分隔符裁剪为空。后端canonicalPath只在Windows折叠大小写，当前客户端前缀规则与该契约不一致。旧来源显示、range与布局修复未触及共享路径比较。

唯一relativePathFrom被SourceParts的显示/打开、CardParts文件摘要、tool摘要和file-change-summary使用。后者还独立把全部反斜杠变成斜杠；改由同一个关系函数决定路径风格，避免POSIX路径名称被误写。shortRelativePath对外部文件保留原完整路径；不改source.path/sourceId、后端权限、物理realpath判断、API（Application Programming Interface，应用程序接口）、工具/Provider协议或调度。

方案：在现函数中按绝对路径语法识别Windows盘符/UNC（Universal Naming Convention，通用命名约定）；Windows比较统一分隔符并延续忽略大小写，输出规范相对分隔符。POSIX保持大小写与合法反斜杠字符，保留根“/”，以完整目录边界比较。输入仍是已由服务端产出的目录/来源路径，不增加客户端物理文件探测、后备路由或新存储。所有调用搜索完成后再实现，先运行当前真实函数取得before数据。

相邻FileWorkbench通用路径归一化仍有独立的POSIX反斜杠文件名处理疑点；本轮关系函数修正不声称它或所有文件名边界已修复。该路径需要后续独立定位到实际资源请求，不用改变权限路线掩盖。任何调度/队列/恢复/终态异常仍立即共享全入口横审。

## 检查与真实页面

新增聚焦纯路径数据契约测试：同目录/子目录、大小写区分的外部POSIX身份、Windows混合分隔符/盘符/UNC、根目录及兄弟前缀。只比较明确完整输出，不做UI自动化、DOM（Document Object Model，文档对象模型）或组件测试，也不新增以空/不存在为核心的断言。既有file-change-evidence-reducer属于纯来源/差异数据归约，与真实视觉资格分开。

正常构建后独立/ui18276，已授权完整auth/models配对，分别usable/projected/实际gpt-6.1-sol流式。NativeService固定600000ms/20请求；普通单会话真实read隔离项目README，以及仓库已存在公开的tool.ts前12行，核对项目内编辑器和跨盘只读来源的真实打开/路径提示/引用range。不得造Source消息或UI fixture。Windows真页面不能冒充Linux原生端到端；POSIX此次资格限真实共享函数的数据契约，限制明确记录。

只关闭自己的页和服务，原执行器actual join与精确Native/Host/port/auth-models退休；全部observer终态后保管Native生成文件。更新当前相关契约/根/月/目录索引，当前文档检查、范围提交、fetch/merge/待推送集合审查及正常push；goal active，单agent继续。

## 实施结果

共享函数与唯一摘要调用完成修复；28项纯数据测试通过，类型检查与构建实际exit 0。真实独立/ui和gpt-6.1-sol确认项目内编辑器/跨盘只读来源与行号，6次累计流式请求均200和EOF；原服务执行器10130实际exit 0，精确进程/端口/凭据配对清理已独立复核。[完整证据、截图和未达成边界](source-path-310/README.md)。不扩张为Linux原生或所有Rendering问题完成。
