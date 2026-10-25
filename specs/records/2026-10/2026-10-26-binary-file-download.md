# 不支持预览的项目文件原件下载

## Recall

用户要求持续单agent自主查找并修复产品体验及功能完整度，不能再围绕早已关闭的Rendering闪烁，真实验收后精确提交推送。禁止子agent、新branch/worktree、操作用户18571进程或数据库；保留并行CI任务与旧视频/截图删除及索引排序。Goal通过/goal及+菜单启动是明确接受的设计，不恢复独立首页区域。

603 dfa4d966a工具冲突原因优先、604 cd4baaf305c67d4d522460e2a6b8f4e2daad787f的PDF/图片文件头下载已真实验收并正常push；fresh fetch/merge后0/0，上游包含604。604五张截图人工查看，四个真实下载PDF86787/PNG42339/干净文本113/草稿149字节逐字节核验，原文本保持113字节。54112/54113原exec85176/91661及native/launcher退出0，物理/输出/请求结清，提前781469/998899ms，标签285/286关闭。未复制凭据，新模型请求0，累计仍119。604明确尚未支持没有加载字节的未知二进制，本批继续这一功能断点，不以空载荷导出伪原件。

已读：AGENTS、当前07-panel文件/下载合同、server-runtime-readiness、File.Content/read/readSource/readResolvedContent/assertAllowedFilePath/stat/readBytes/attachment命名、FileRoutes全组、project-route-context冷读取权限分类、FileEditorPane完整读写/导航/下载/错误生命周期、apiRequest二进制/authority/signal及bytesToArrayBuffer、downloadBlob/project-archive/Artifact读取、SDK事务构建器、真实file-read-identity与file-attachment-editability正向合同。全仓搜索定义/调用：File.read仅公开路由与debug调用，未知binary当前返回空content；不存在普通项目原件路由。附件命名由AttachmentStore真实Reference决定，不能用内容寻址文件名代替用户文件名。相关已有service测试为非DOM合同，不运行UI自动化。

权威资料：[Node文件流](https://nodejs.org/api/fs.html#filehandlecreatereadstreamoptions)、[Readable.toWeb](https://nodejs.org/api/stream.html#streamreadabletowebstreamreadable-options)、[RFC6266](https://www.rfc-editor.org/rfc/rfc6266.html)。采用成熟文件句柄流与标准filename*，在实际固定Bun1.4.0运行路径验证，不凭当前Node文档宣称宿主兼容。

## 修改前分析与影响面

可观察实现：readResolvedContent对ZIP/Office/未知二进制只返回type=binary、content为空；FileEditorPane原件动作仅能消费已加载文本或base64 PDF/图片。压缩包等打开后只有不可编辑提示，功能流程无法取回原件。直接触发为文件浏览器打开该类项目文件。根因是预览合同刻意避免读取未知二进制大文件，而产品没有独立的显式原件下载合同；604只解决已有完整载荷，不能把预览的轻量投影改成所有文件默认base64读取。

本批保留原预览合同。新增唯一GET /file/download及File.openDownload，明确只接受项目相对路径。复用assertAllowedFilePath与真实路径检查，目录/缺失为FileNotFoundError，空/绝对/NUL/越界为FileInvalidPathError，其他读取失败保留真实错误。原read/readSource的路径与错误合同不顺带更改。普通文件使用basename；附件复用同一Reference命名读取，与File.read当前displayName保持一源。流在成功打开并确认是普通文件后移交Response，自动关闭句柄；客户端断开/Response取消沿同一Node Web流适配关闭，不另建计时器/后台任务。

新GET是读取事实，接入既有identity Project上下文集合，不能因为用户模型未配置而初始化执行；不修改运行时调度与权限。公开OpenAPI、SDK、route policy及API文档必须用现有完整库存/事务生成器同步，禁止手改生成物或跳过push hook。无schema、迁移、版本或Release变更。

界面只为没有完整载荷且属于项目的binary增加原件请求，已有文本草稿和已加载PDF/图片仍消费原载荷。使用apiRequest二进制、原authority及可取消signal，文件/authority切换与卸载退休当前请求；下载失败只写回仍归属当前文件的现有Feedback，双语摘要和完整原因保留。单一下载handler供文件头与空态按钮使用，不维护下载注册表、复制预览store或合成消息。现有transport客户端在显式下载时收集字节，服务端使用文件流，不能宣称浏览器客户端零内存缓存。

排除项：absolute source未知二进制不扩大原只读来源权限，其PDF/图片现有完整载荷仍可导出；原始下载不是不可变历史Artifact，不宣称文件在外部并发修改期间构成文件系统快照。没有发现调度/队列/恢复异常，本次不修改这些机制；如真实验收出现立即横向审计。

## 实施与验收方案

1. 从已关闭604-after自有库只读备份，逐表比对，普通604构建启动自有54114，实际打开自有真实ZIP并截图确认原缺口，再公开关闭、收齐原exec及物理/输出/请求，保留至少五分钟。
2. File.openDownload复用现有路径校验、普通文件与附件命名事实，Node文件句柄流自动关闭；FileRoutes增加标准二进制Response及UTF-8（Unicode字符编码）filename*。新路由进identity分类。保持其他公开读取行为。
3. FileEditorPane复用现有下载行为，补项目binary的可取消二进制请求、现有错误区及双语空态说明/直接按钮。文件切换取消其已退休请求，不禁用整个编辑/导航工作区。
4. 新增聚焦后端正向合同，覆盖两个冷Project同名不同字节、中文/特殊字符文件名、零字节、AttachmentStore真实名称、明确400/404、真实文件流结束与取消后的关闭状态。使用生产Server.App及实际文件/流，无UI测试；原读取/附件相关合同复核。不跑全量bun test。
5. 事务生成SDK/OpenAPI/API文档，类型及普通Node UI构建后，新自有54115 /ui真实打开ZIP下载、人工查看截图并比较实际下载原字节，确认双语提示/错误与原文本导出。必要的失败保留并修根因，不伪称mock/静态断言为端到端。
6. 两个服务20分钟物理边界、至少五分钟提前公开关闭，原exec/身份/请求/输出/物理结清，关闭自有标签；比较原业务表。文档三索引同步、docs:check、精确提交，fresh fetch/merge审查完整待推集合并正常push。原604之外的CI/全量资格按实际运行保留。

## 修前真实确认

54114使用604普通构建main-B5i-B_G8.js。自有archiver将原113字节review.txt以“交付记录.txt”归档为真实259字节“交付资料 (版本1).zip”；未操作用户文件。真实文件树打开该包后，右侧仅显示只读/重新加载/关闭及不能编辑空态，图01已人工查看确认，标签287关闭。公开shutdown200，原exec28661退出0，native/launcher退出0，物理/输出/请求结清，原进程链dead_or_reused。修前基线已完整关闭后才修改生产代码。

## 原件响应协议复核

收尾全仓核对SDK二进制类型与默认getParseAs读取器，发现新路由若按文件MIME返回text/plain或application/json，默认SDK会分别解析为string/object，而生成合同为Blob|File。此前真实ZIP调用显式指定parseAs=blob，不能据此证明默认客户端对任意原件正确。根因是把预览媒体类型与明确的原件二进制传输混用。修改本批方案：原件GET唯一固定application/octet-stream，与已声明OpenAPI二进制合同一致，原名继续由Content-Disposition表达；保留原预览接口的真实MIME。没有fallback、额外端点或手改SDK。补TXT/JSON原字节正向合同，并在新独立54116仅后端服务上用默认SDK（不传parseAs）实际下载ZIP/TXT/JSON核对Blob及字节，再完整收尾。之前界面下载使用显式binary transport，字节/文件名语义不变。

## 结果与资格

File.openDownload使用现有相对路径与canonical边界校验，打开实际普通文件并移交Node文件流；Project内别名正确读原字节，外部junction（目录连接）返回明确400。附件命名抽到与原File.read共用的Reference读取器，原读取合同保持。GET /file/download加入identity读取，标准UTF-8文件名与明确二进制传输、no-store、nosniff，终态与取消自动关闭句柄；交付前复核补上Response/header构造失败时的已打开流销毁，不改变正常响应。

客户端复用唯一下载handler和既有transport，文本仍取当前草稿，完整base64预览仍本地解码，只有Project未知binary显式请求原件。现有Feedback保留原因；新失败存语言key而非翻译后的字符串，两个错误呈现消费者都复用当前读者，真实错误切换语言立即更新。三个新语言key均覆盖en-US/zh-CN，语言检查为2543键。没有UI自动化或新UI store。

实际后端首轮18项/75断言，补请求signal后8项/33断言，再补真实内外目录连接后10项/36断言，交付前Response移交复核后同10项/36断言，最后TXT/JSON二进制合同11项/42断言；重叠合计22不同用例/87断言。包括两个冷Project同名、中文特殊字符名称、零字节、附件原名、400/404及2MiB正常/取消/AbortError实际流关闭。最初core类型检查指出Node/Bun分别声明Web-stream类型，显式边界后原检查通过；最初带语言key的overlay检查找出未同步的Dialog错误消费者，已修正并重新类型检查/构建。所有原失败日志保留，不以build成功替代类型检查。

SDK事务build退出0，三个生成文件及两份API文档同步，351操作/26组，routes-check通过。SDK先实际连54115显式按Blob下载259字节ZIP；协议复核后在54116使用默认客户端、不传parseAs，ZIP/TXT/JSON/空文件均返回Blob，259/113/35/0字节逐个与源相等。实际/doc确认最终file.download描述和binary schema；54117再次真实页面下载259字节，与原件和已保留ZIP均一致，图08人工查看。最终原件固定application/octet-stream，与OpenAPI及SDK默认读取一致，预览MIME保持。最终普通Node界面构建main-DfWO50jq.js，8张真实页面截图逐张人工查看。

英文压缩包空态直接下载259字节；移开自有原件后实际404，原始方法/路径/request ID及完整FileNotFoundError packet可展开并滚动到最后JSON；同一错误切中文摘要立即更新。恢复该自有原件后，不刷新直接由文件头再下载259字节成功并清除原错误。另实际下载原PDF86787字节、当前未保存文本149字节，逐字节核对；原磁盘文本仍113字节，UI撤销后干净。实际浏览器ZIP作为downloaded-original.zip保留，标准ZIP reader打开交付记录.txt并得到原113字节。

四个自有服务54114/54115/54116/54117公开shutdown200，原exec28661/75238/45610/34614及native/launcher退出0，physical/output/request结清，进程链dead_or_reused，分别提前1128122/733247/1154539/1113655ms，标签287/288/289关闭。四个92表1996行初始克隆逐表验证，原8个业务表48行在真实操作后完全一致，schema8/integrity ok。用户18571/用户库/auth未操作，新模型请求0，累计119。无迁移或发布；absolute source未知二进制、客户端收集显式下载字节、外部并发写入快照语义和慢下载UI取消资格均按证据保留边界。完整CI仅另一个授权任务实际615 head的Linux通过，不伪称本605三平台全量通过。
