# 278 Side chat 实时来源阅读

## Recall

用户持续授权单agent自主体验改进Sources与Rendering/功能，不委托、不新Task/成员、不碰用户23/18107。277为实际进展：精确原Research Studio Task和372来源已只读核对，旧压缩问题已有当前修复，当前checker13pass；原数据库旧schema按现行契约不可直接启动当前副本。2c7748e22a6d667343ea68210522ab4ae29136a8已push/干净，原侧栏视觉未验。此前274只证明Side实时尾部跟随返回，固定阅读位置未捕到；不能把两者混同。

已读277 Recall、274实时方案、276代码来源实现和真实数据、SourceParts摘录恢复、SideChatPanel source/session阅读key和owner保存/恢复、conversation-ui及当前07-panel。当前预置read/external_code_search保持直接可见，Tool SourcePayload经唯一消息持久化和共享渲染；当前Exa声明numResults，276一次4结果真实通过。此次检查共享Side renderer/SourceEntry在模型正文增长和wholeDock卸载/返回的真实阅读行为，不合成来源或修改输出，不以Root别名替代原任务。

## 现象、触发与影响分析

原用户报告子侧栏Rendering闪烁和Sources呈现差；当前Source标题/域名/摘录与Markdown缓存/reading state已有多轮修复。现尚无证据证明普通Side固定阅读在真实流式增长中关闭/重开保持：274在尾部follow状态返回、DOM观察还用错选择器，只有实时跟随资格。直接待检查触发为工具真实Source先出现，用户展开并进入阅读，再在正文仍增长时wholeDock关闭/打开；数据链是真实Side session/message SourcePart身份与source excerpt reading key，以及Side AutoScroll owner保存视口。潜在影响为来源摘录内/外滚动、披露展开状态、原消息正文缓存、Main/Side共享renderer；根因未知，先实际观察，禁止补丁先行。

当前只验证，不修改接口、配置、消息、队列、恢复、并发或终态。若观察调度/收敛异常立即横审全部生产入口/Task-Mission-Session轮次/正常终态/重试重启/项目隔离。若观察UI问题，先补可观察几何/数据/定义调用与旧路径根因分析并落盘，然后修当前唯一实现。UI（User Interface，用户界面）验收只真实页面操作、截图人工复核；只读DOM（Document Object Model，文档对象模型）几何可辅助事实，但不能代替视觉或成为自动化测试/断言。

## 执行和接受标准

新独立R=2026-10-10/side-source-live-278-live-01，E=side-source-live-278/live-01，正常开发/ui18218，NativeService600000ms/累计12请求，不扩期、不因观察超时重启。用户既有OpenAI auth+完整models配对，分别核对usable/projected/实际gpt-6.1-sol及streaming=true；不新增Exa凭据或绕过额度。先普通Main简短准备回复，打开现有普通Side，再发一次自然请求：read当前README最多30行，external_code_search一次numResults4，依据实际资料写约4000–4500中文字/12节的键盘可访问性说明，不额外查询/写文件/委托。实际Provider行为和返回决定Sources，错误如实保留，不用gate或白名单指挥模型。

马上观察实际工具/来源与partial正文；来源可见时展开有长摘录的Source并用原生键盘/滚轮读中段，同时明确外层离开follow tail。只有对应Side chat/work reader未EOF并且截图实际显示partial，才给close/reopen实时资格。记录相同Side/真实assistant message、Source ID、外层top/clientHeight/scrollHeight、excerpt内top、reference披露及截图时间，与最终reader范围和完成时间关联。使用实际.side-chat-panel__scroll等节点，不能用AX data-ui名称当DOM id。Source是file/URL混合或分组等按实际结果，不强求预设工具顺序、Source5或某种图示。

若窗口过快错过、没有摘录、仍follow、关闭/重开后已EOF、reading top变化等均保留真实情况，不能宣称固定阅读通过或原Research Studio全帧合格。若异常可修先关闭自己页面/sole shutdown、原前台actual join与独立完整closure，再分析修复和准备新的固定01以外轮次，不延长旧服务。

目标至少deadline前4分钟完整闭合。自己的页关闭、唯一shutdown、原前台handle实际join、独立PID出生/物理输出请求/端口/pair退休、完整脱敏日志/Canonical/Provider归档。所有checker/observer实际结束后精确保管自己五Native文件。更新根/相关/月README，当前docs/architecture/凭据/diff检查，范围提交、fetch/merge upstream、完整待推送审核、普通push；goal active，单agent继续。

## 01实际观察与新UI根因

01实际read一个README来源和external_code_search四URL成功；Side真实长回复part prt_g0VXdcljE00HfH1NM7LX / message msg_g0VXdcjEV00Sb7Sw2Ybz，原始5721字符，正文是反引号codespan `details/summary`，没有作者Markdown href。03/04/05截图实际partial；最终chat reader09:39:55.624–09:41:47.589Z。05时间09:41:46.557Z仍partial、外层top720/client466/content7134、摘录4788字符内部top250.3999938964844/client286/content2574。close09:42:01.475和reopen09:42:10.387均已EOF，明确错过实时重开；07终态返回同Side且来源仍展开，外层top720/摘录top250.39999保持、viewport缩388。此轮只能给流式增长期间阅读和终态返回资格，不给close/reopen实时或原Research Studio全帧资格。

新真实错误：03和07把技术术语details/summary显示成a.file-link/href=#；08实际点击打开File tab，09真实GET file/content?path=details%2Fsummary返回FileNotFoundError/404、request6fc1470d-1d28-4807-9fc7-39f0982415fe。模型未伪造文件引用，直接触发是markdown.extractFileReference把任何含slash且合法字符的codespan当文件。data-file-path交给main唯一委托→openPathInSelectedEditor→Web内置workbench→既有file API真实失败；后端错误符合实际不存在路径，不修后端或用Source按名猜路径。

已全仓搜索extractFileReference/codespan/data-file-path、共享FILE_EXT_RE、显式Markdown解析与file-reference、main/workspace/workbench调用、07-panel及266/268决策。266只限制裸basename自动动作，仍无限接受slash；268只修盘符合法性，没有覆盖HTML概念对/MIME（Multipurpose Internet Mail Extensions，多用途互联网邮件扩展）类型/一般层级字符串。新修复只收敛共享自动codespan语义：明确根/./../~/盘符前缀表达路径；未带这类前缀的文本须有现有已声明文件扩展名并有目录分隔或合法行号，才表达文件目标。裸带行号文件、相对文件路径、rooted drive、已作者明确Markdown和结构化Source契约保持。扩展名列表沿用当前单一定义；不列HTML/MIME关键词、查猜Source路径、发多余文件probe或引入第二renderer/配置。

风险：无前缀且无文件扩展的codespan层级字符串不再自动打开；明确引用可写./path或rooted路径，作者链接仍按既有目的地契约。这属于UI自动动作/呈现语义，没有修改Tool/Source公共payload、后端API、config、消息或状态机。pure file-reference.test.ts只验证位置/范围数据，检索确认没有UI渲染/DOM/HTML断言，不新增改动或运行UI自动化测试；UI修复以真实页面before/after为准。

01自己127页已关闭，唯一shutdown/原前台27184 actual0、9EOF0取消/Native55360和Host46072真实闭合，所有closure/archive checker实际join后五自己Native文件已归档。实施前本分析完成且落盘；先修该唯一predicate、当前文档并typecheck/build，再独立02/UI18219/600000ms12请求，不延长/重启01。02只用正常Main准备和Side一次read README，输出自然技术解释并保留details/summary、text/html、api/v1字面code，以及真正README.md:1、./README.md和本次真实Windows绝对README:1引用。实际查看字面code呈现与明确引用点击目标/第1行，Source按钮一致，再正常闭合、全部join/归档/交付。

## 02限定after与03补齐Source按钮

02真Sol把三术语呈现为普通code、三明确引用仍为正确链接；原助手492字符保留六个自然codespan。05实际正文术语和链接同屏，07 located引用实际第1行蓝band、09 ./同一全文、10绝对Source只读同文件/第1行。typecheck原37730 actual0、build原41744 actual0/66秒，当前main-D6OgLH8i.js。新误路径修复视觉通过，未新增或运行UI测试。

02原53911 actual0、8EOF0取消、Native66704/Host38172/自己的128页18219/物理输出请求/pair完整闭合；结算09:58:23.459Z、deadline1791626524322、余220863ms，自设四分钟收尾目标缺19137ms，保留未满足，不改原结果。全部02observer实际join后五自己文件已归档。

02已点击三自然引用，但本轮Source按钮尚只显示、未实际点击；为补齐原计划的Source按钮一致接受标准，准备独立03/UI18220/R=side-source-live-278-live-03，600000ms/12请求，无新生产修改/不重跑已通过的广泛检查。只发普通Main自然read README前30行并简短说明，实际查看Source按钮→同一真实全文；正常关闭/sole shutdown、原前台join/独立closure/归档。03不能把02时间缺口或01错过实时关闭改写为通过。后续继续未完成原实时/子侧栏矩阵。

## 收敛与继续项
03 Source按钮真实点击同一README全文，5EOF/原9255 actual0、自己129关闭，Native45208和Host65252/18220/完整pair闭合，余504988ms。唯一codespan修复真实before/after与当前Source接受标准已核对，未改其他功能；原实时close/reopen与原Research Studio全帧尚未完成。当前docs/architecture/credential检查0，所有检查器actual join后保管完，持续goal active。
