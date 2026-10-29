# 文本编码与结构化附件实页体验

## Recall

用户要求一个 agent 持续自主体验、修复和迭代，真实开发 /ui 页面交互与截图人工复核，必要时用已授权 OpenAI 配对凭据及完整模型目录进行 gpt-6.1-sol 流式端到端，范围提交并正常 fetch/merge/push。禁止子 agent，后续单 agent 指令覆盖旧 Goal。787 的文本历史阅读能力已正常推送 6a57c05df；当前 main 另有已授权 benchmark 提交 c376b9fe9、9afd97ce8，工作区另有 171 项旧媒体删除、三索引外部修改和 .bun 目录，均保留。用户 18571 页面、进程与数据库不操作，不建分支/worktree。

已重读 787 Recall/结果、07-panel 附件合同、FilePart、ResourceTextPreview、ComposerAttachmentPreview、FilePreviewArtifact 和 CodeEditor，搜索 MIME 分类、AttachmentStore/upload、所有共享 reader 消费者；读取 util package 与 binary（仅排序工具，并非文本解码）。Work Ledger 的 canonical identity、后端创建事务/投影、前端存储/创建和行呈现已横向检索：experience 在 Session 创建时原子写入，未找到默认 Work 的控制流。787 的过滤文本摘要会保留含 review-ready 的 Work 说明、丢弃 Chat 说明及父子上下文，不能据此判定模式错误；仅用完整行和真实 metadata 复核。

当前共享只读 reader 对原始 Blob 使用 response.text()，按非严格 UTF-8 解码；是否在真实 UTF-16 中文文本中造成乱码尚待实页验证。存储接受真实 MIME 并保留字节，不从文件名改写。787 尚未有独立 JSON 消息，本批补真实 JSON chooser/发送/历史回看，按实际需要核对复制后完整侧栏行身份。

权威参考：[WHATWG Encoding TextDecoder](https://encoding.spec.whatwg.org/#interface-textdecoder)、[BOM 与解码](https://encoding.spec.whatwg.org/#decode)，2026-10-29 已查阅。标准规定 BOM 身份及 Unicode 解码，不把未知传统编码猜成 UTF-8 原文。

## 方案与验收

788 从已正常闭合的 787-authview schema9/92表/114655行备份，完整复制两个 QA 项目的附件 namespace/durable facts，不改源库、原输入和用户凭据。私有 helper 与运行记录保留在 .tmp-product-iteration/text-encoding-788。38353 为新自有开发 serve，修复后 38354 回看；每实例预定15分钟公开正常关闭，首次启动固定60分钟绝对截止和至少5分钟收尾，不沿用787截止。

初始配对认证及完整 models，分别验证凭据、目标模型投影与实际流式模型一致；最多6个真实请求含一次preflight，不增加/续期预算。仅自然发送一个无敏感 JSON QA 文件，要求读其中确定字段，不委托或调用无关命令。候选最终回看复制同一配对认证/目录但 maximumRequests=0，不新增preflight，不伪称另一次模型验收。累计起点788。

真实 chooser 选择 UTF-8 JSON、带 BOM 的 UTF-16LE/BE 中文/emoji 文本及无 BOM 非法 UTF-8 文本，先截图记录实际结果。仅 JSON 发送，其他三个通过真实移除按钮离开草稿。实际错误得到证据后，补全实施前根因/消费者/公共契约/数据/测试/文档/交付风险分析，再修改唯一共享 reader 的字节解码；按 BOM 使用明确 Unicode 编码、无 BOM 使用 UTF-8、非法序列映射到可本地化错误，避免替换字符伪装原文，不添加猜编码 fallback。原件下载仍须真实可用。

纯 UI 只能实际交互、截图与人工复核，不写/改/跑 UI 自动化测试。若新增独立字节解码合同，用 util 的聚焦正向测试覆盖正确 Unicode/空字节与明确错误类型/编码；类型、普通build、i18n/docs为辅助。截图覆盖修复前乱码、修复后两个 BOM 编码、非法文本可理解错误、原件下载字节、JSON真实回复/历史、双语；不宣称后端模型读工具或编辑器具备新的编码保存合同。

正常 public shutdown200、原 exec/native/launcher0 和物理/输出/请求/精确出生身份退休后才删除自有 auth/models 副本。逐表核对旧行、源库、namespace 和新消息/工具真实事实，正常 GC/记忆/租约更新逐项解释。新增 spec/artifact 同步三索引和当前 docs checker；范围提交，fresh merge 与完整待推集合审查，正常 hooks/push。总体 Goal 保持 active。遇真实调度/队列/恢复/并发/终态异常立即按共享机制横审，本批预期只触及只读呈现/字节函数；目前未发现此类异常。

## 实施前证据、根因与影响面

38353 main-Byhuis9j.js 的真实 chooser 完成4文件上传；图01/02分别显示 UTF-16LE/BE 的中文/emoji变为乱码和NUL控制字符，图03非法UTF-8显示四个替换字符，均没有错误摘要或下载入口。图04同一reader能正确显示UTF-8 JSON。三文本已真实移除，仅JSON经自然消息发送。认证目录投影与实际Sol流式preflight均通过。

直接触发是 ResourceTextPreview.loadText 的 response.text()：资源缓存保留正确原字节，reader按非严格UTF-8忽略UTF-16 BOM，并静默替换非法序列。旧路径仅复用同一个reader解决入口，未建立字节到原文的显式解码合同；修FilePart分类、存储MIME或给单个窗口换reader都无法根治三个真实消费者。全仓三个生产消费者为待发送窗口、已发送文本折叠体、FilePreviewArtifact。后两者已有下载/导出，待发送文本footer仅Close，错误时无取回入口。现OriginalFileDownload在FilePart内部供两处真实消费者使用；移到独立共享组件，同一资源cache/authority实现供待发送footer第三处使用，不另加下载协议或状态源。

实现采用util独立Unicode字节函数：UTF-16 BOM选择LE/BE，其余UTF-8，标准TextDecoder fatal解码并去BOM；显式TextDecodingError携带encoding，非法输入展示当前界面语言摘要。正向纯字节测试覆盖UTF8中文/emoji/CRLF、UTF8 BOM、两种UTF16 BOM、空文件与明确非法UTF8/UTF16错误合同。未识别传统编码不会猜编码；reader不改原件，不改换行字节，不承诺后端read工具、文件编辑/保存或模型新的UTF16能力。

仅shared只读reader、共享原件下载提取、待发送footer及双语文案变更；API/SDK、路由、上传MIME、消息事实、schema9和持久化均不变。风险为错误类型跨模块识别、authority切换、重复下载、代码高亮/CRLF与emoji显示、正常非文本下载回归；通过类型/纯函数测试及真实双语/原件下载/JSON历史与既有PDF/图片实际页面复核。错误分支不渲染替换字符伪原文；短文件高度继续沿787自然布局。调度/恢复等路径不触及且未见异常，明确排除本次实现；若后续真实请求/终态异常则按共享机制横审。

## 实际结果、验证与交付边界

初始38353真实JSON会话 ses_-zUQZxfS4zzCqp9pVfVD 通过唯一可见read读取canonical attachment，完成check=原文回看788、answer=42/number、status=ready回复，图05；共5次实际gpt-6.1-sol流式HTTP200/EOF（含preflight和正常记忆流程），未exhausted，未使用的第6次额度退休；累计793。新建及38354重新打开/跨项目返回的完整行均kind=chat/experience=chat，中英文说明符合canonicalmetadata；未证Work Ledger模式缺陷，不为过滤摘要误读改生产代码。

纯字节9项正向测试、util/overlay最终typecheck、最终普通build+renderer、i18n(2620keys)、docs(351ops/26groups)和架构20文档通过。提取下载组件时初次类型检查发现AuthedVideo/Audio/Pdf三处仍调用DownloadLink；已将它们指向同一共享纯链接组件，重新类型检查并完成新build后才发布38354。首次build不是最终视觉构建；最终main-D7log08P.js。没有新增或运行UI自动化。

38354配对认证和完整模型目录仅本地验证模型就绪，maximumRequests=0，无preflight或模型请求。图06实际JSON历史、07/08两种UTF16正确中文/emoji、09/10双语非法编码错误、11键盘末尾和中文文案、12gzip非文本下载、13Sources真实原件只读、14PDF第1页实际呈现、15JPEG全图、16跨项目返回JSON均已呈现和人工复核。五份实际下载JSON70/LE46/BE46/非法文本6/gzip84字节均与真实输入精确；不重编码下载，不修改上传或源输入。完整[16张原图和数据/运行记录](../../artifacts/2026-10-29-text-encoding-journey/README.md)。

两个实例public shutdown200、原exec64019/78362均join0、native/launcher0，物理/输出/请求及精确出生身份退休，距同一绝对截止分别3266240/2570498ms；配对auth/models副本均退休，用户源auth元数据和完整catalog原字节/元数据保持。未操作用户18571或真实用户数据库。

逐表92表：原114655旧行114651精确，四项正常变化为A项目记忆revision2→3/更新时间（保留旧covered occurrence并加入本次真实user）、过期容量slot0/1由原26540进程占用并正常释放。原最终116026；回看全部116026旧行精确，仅追加明确归属93104出生身份的runtime_process activation及grant，最终116028，物理已退休，保留生命周期事实。源数据库全部逐行精确，schema9/integrity ok。六份持久FilePart原件、真实JSON Tool request/outcome/Source映射、11份旧输入字节/元数据与4份新输入已核对。Source保留原实际读取物理path，下载使用当前DB canonical namespace，未改身份或伪造消息。

B的两个namespace各17文件精确；A初始8项中6项精确、旧未发送gzip及metadata已回收，源namespace/原输入仍精确；A回看16项全部精确。当前Instance bootstrap真实调用AttachmentStore.sweep且保护期60秒，该旧QA上传没有持久引用，其回收符合当前合同；初始dev.log未保存对应精确时刻，只能依据源码/文件身份推断，不能冒称有GC日志。回看B实际sweep日志deleted0/kept7。仅预览的三文本和gzip均真实移除，不构造持久引用阻止正常回收。

复制/归档、编码FilePreviewArtifact、实页UTF8 BOM/非法UTF16、Office/native picker及短视口未独立验收；纯字节测试覆盖BOM/非法UTF16。后端read工具、文件编辑/保存编码合同不变。总体Goal仍active，范围提交与正常fetch/merge/push后继续单agent；工作区外部删除、benchmark改动和共享索引其他条目保留。
