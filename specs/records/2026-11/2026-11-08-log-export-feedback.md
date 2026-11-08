# 日志导出反馈与键盘焦点

## Recall

用户要求持续按批并行体验UI（User Interface，用户界面）/UX（User Experience，使用体验）、调查功能和缺陷，先根因/影响分析并落盘、真实桌面/ui交互和截图人工复核、聚焦正向功能测试及获得具体授权时的GPT-6.1 Sol验收，范围提交、上游合并和正常推送后继续，直到明确停止。上批92dd407e9已正常推送，当前HEAD/upstream 0/0、暂存空、原177条工作区逐项保持。Sol凭据授权待答复，本批零模型/零消息，不读取/复制/使用凭据。

本批functional/ui两代理并行只读审计，无再次委托。已读GeneralPanel全部导出状态/handler/按钮/反馈、Button、现Network键化错误反馈、log-export/project-archive唯一下载链、后端log/export、Log.files/buildLogSupportBundle、Global与runtime-paths；全仓搜索导出调用/状态/同语义忙按钮，当前07-panel设置语言/搜索/焦点与10月31日、11月5日相关记录。另一候选是设置导航仍用整段子串而命令元数据已支持组合词，留后续批次，不混入本批日志旅程。

## 修改前根因与影响分析

待真实确认两项：英文General成功Export ZIP后，通过顶部View/Language原地切中文，成功反馈可能仍英文；键盘Enter触发导出时native disabled可能使按钮失去焦点，完成后无法自然续接。尚未取得本批实页证据，不由源码缺少focus直接宣称复现。

当前handler先setLogExporting(true)，清旧notice，await downloadLogSupportBundle，成功/失败时立刻t()并把完整译文存进logExportNotice；另一个logExportNoticeStatus持有tone事实。render只消费两个signal，不重新翻译。当前语言可以在General仍挂载时经唯一顶栏语言动作applyLocalePreference改变，因此按钮/标题会更新而已存译文可能冻结；切Appearance再返回会销毁该局部状态，不能用那条旅程误判原地切换已通过。现Network已存key/details并在render翻译，不应重做其状态。

忙按钮当前disabled={logExporting() || !connected}，Button仅透传属性，不自带动作防重入。若真实失焦，复用已验证的aria-disabled/aria-busy加同步handler guard，保留!connected的原native禁用；不加定时聚焦、监听器或新焦点状态。所有普通导出、失败与再试共用同一真实动作，原按钮一直存在，保留其键盘owner即可。

日志数据/错误链无待修证据：downloadLogSupportBundle唯一调用downloadZipArchive(path=log/export)，后者按原二进制apiRequest读取，非2xx由ApiError保留响应、method/path/status/request ID，成功按真实Content-Disposition下载ZIP（压缩归档）。boolean仅在实际saveBytesAsDownload后返回true，无成功false分支，不改接口。后端flush→Log.files→真实文件读取→raw/格式化副本/manifest/README，不新增导出协议、错误类型、后备来源或配置。

隔离证据已由代码确认：显式绝对OPENCORVUS_HOME优先，所有Global.Path.log懒读取<root>/log；Log.files只枚举该目录真实普通.log文件，无项目/用户目录扫描后备。本人GET /log/files仅给directory/current/files元数据，可与实际ZIP manifest核对。全新profile不复制旧日志、认证、模型目录或数据库；归档只验证本批私有根。实际运行日志留私有临时根，公开证据只收截图、明确自有输入和必要诊断/归档回执，不把用户日志打进提交。

影响仅General的导出通知及同按钮忙态。若实页成立，唯一notice改存成功事实或原失败cause，render用现settings.log_export_complete/failed键；status/tone由同一事实派生，删除旧并行译文/tone状态。原技术错误和文件身份不翻译，若实际失败诊断不足，仅在原Feedback复用formatErrorDetails保留原ApiError。通知权限、Git偏好等其他General错误生产者虽有字符串状态，但有独立持久/准入语义，未实测不扩大本批；无API（Application Programming Interface，应用程序接口）/SDK（Software Development Kit，软件开发工具包）、schema（数据库结构）、持久格式、权限或模型策略变化。

当前没有Task/Mission/Session（任务/多步任务/会话）调度、队列、唤醒、恢复或终态异常事实。UI busy焦点若成立，横向代码复核覆盖现媒体Retry、图片下载、文件编辑按钮等同语义aria-disabled primitive，沿一个真实按钮owner处理，不据此推断后台调度异常。若真实归档任务出现控制/终态异常，按仓库硬约束另作完整共享审计。

## 前态与条件实施方案

私有临时根opencorvus-iteration-20261108-b12，新project与profile-before，开发serve /ui before38942；after38943为新profile/最终构建。输入只有本批明确自有read-contract.log纯文本，非合成产品消息。先读取/log/files核对私有目录，再真实General键盘Export ZIP，保存实际下载到私有根、检查manifest/raw自有字节与条目，观察稳定焦点及下一Tab；同页View→Language原地切中文并截图。若当前正确则据实否证，不修改该项。

失败路径若需验证，使用本人read-contract.log的独占读取锁制造真实文件系统失败，不mock（模拟）API。独立自有helper只持该精确文件，准备/释放通过私有标志文件，保留原exec句柄并在finally释放；不锁当前服务日志，不触及用户路径/进程。具体实际状态/错误以响应为准，不预设EBUSY名称。锁释放后同页同按钮实际再导出成功，证明真实恢复；日志根和源文件字节保持。若此方法不能形成可证明的失败，记录未知，不换假响应。

先补前态/根因再改产品。纯UI不新增/运行任何UI自动化；归档/二进制纯服务正向测试仅按实际改动需要执行，真正验收为实页、原下载和标准ZIP读取。最终普通构建后新实例重复成功/失败、中文/英文原地切换、键盘焦点及必要重试，截图人工复核。本人服务正常shutdown、原exec exit0、页面关闭和锁helper结清；更新当前架构/三索引/docs，范围提交、上游合并、完整待推集合审查、正常推送后继续。

## 前态与最终决定

已在38942/main-DWOQ6czO.js真实复现。键盘Enter导出ZIP，原浏览器下载39125字节/6条目，manifest只含本profile-before/log的dev.log/read-contract.log，原自有日志30字节完整；稳定后按钮已恢复可用，但activeElement为BODY，下一次原生Tab也未回到按钮。01与before-success-observation.json为证，不能把下载成功当键盘已接续。

同页View→Language切中文，General仍挂载，标题/按钮中文而成功通知仍英文（02/before-mixed-language.json）。本人read-contract.log独占读取锁使真实/log/export返回500 UnknownError，服务原记录精确为EBUSY/open该私有文件；公开响应带请求ID，UI失败提示要求查看该header却没有展示其值/Details（03/before-failure-observation、before-locked-http、before-owned-read-cause）。原地切回英文后失败前缀仍中文（04）。这同时证明成功/失败都受译文固化影响，诊断也被旧describeError字符串压平。

锁helper原句柄99493经私有release标志正常释放并exit0，实际源日志仍30字节；释放后真实HTTP（Hypertext Transfer Protocol，超文本传输协议） /log/export恢复200/ZIP，read-contract原字节保持（before-http-recovery.json），排除服务凭据/模型/目录未投影等无关解释。原IAB 27已关闭，before服务正常shutdown，句柄62642 exit0。未修改产品前，根因与实际IO（Input/Output，输入输出）错误、恢复证据均已齐全。

最终实施：General唯一notice改存complete事实或failed+原cause；同一个createMemo视图投影在当前语言下生成旧翻译键的正文/tone及formatErrorDetails，不存译文/独立tone。原翻译正文/键不变，原技术错误原文留作事实。Feedback失败Details直接使用原ApiError的method/path/status/requestID/body，不重建请求身份。按钮仅!connected用native disabled，忙态复用aria-disabled/aria-busy；handler先guard当前busy/连接，防重复激活。原按钮保留焦点，不增加恢复timer、focus监听或全局状态。其它General错误、权限、原日志/ZIP读取/导出协议保持原实现。

after用全新profile-after/38943/最终普通构建和同自有30字节输入，重复成功键盘/双语原地切换、真实独占锁500完整Details、失败双语、释放后同按钮恢复；实际新ZIP核私有根和原字节。未观察到的竞争分支明确保留，不以源码/构建代替UI证据。

## 最终实现与真实验收

最终产品仅GeneralPanel及07-panel合同。notice单源保留complete/failed+原cause；译文/tone/details是响应式视图投影。原导出服务、日志范围、二进制传输、ZIP协议、翻译键和内容、其它设置状态均保持。无UI自动化测试、模型消息或凭据使用。

新profile-after/38943/main-CwbrNz6g.js（普通构建1分3秒）、1280×720桌面实页：

- 键盘Enter触发真实导出时，实际观察Exporting...、aria-disabled=true、aria-busy=true、native disabled=false，当前BUTTON就是原导出按钮（after-busy-observation）。下载完成后仍BUTTON/原按钮，成功提示英文（05）。实际Shift+Tab到settings-offer-git-init原INPUT/role=switch，Tab返回原导出按钮，没有定时聚焦。
- 顶栏View/Language原地切中文，General保持挂载，成功提示立即变“日志支持包已开始下载。”，正文/按钮当前语言一致（06/after-translated-success）。原始成功ZIP34811字节、6条目、2个本profile日志文件，自有30字节raw内容精确保持（after-browser-success-archive）。
- 只独占锁本人profile-after/log/read-contract.log，再用同按钮真实请求失败，完成后当前按钮仍持焦点。原生Tab进入SUMMARY/详细信息，Return展开完整诊断，实际HTTP GET 500 log/export、Request ID、ApiError及UnknownError响应可读（07）。UI请求ID b1515069-d569-4828-a828-ff8aec1310b1在本人服务日志中对应同一EBUSY/open自有文件（after-owned-read-cause），不是凭标题或最后错误猜原因。
- 保持Details打开，顶栏切英文后“Log export failed”与“Details”立即更新，诊断仍是同一请求ID、同一原响应/堆栈，details.open=true（08/中英文原文本）。原生End从SUMMARY将现#configContent滚到92，viewport684/scrollHeight776，响应正文完整进入视口（09），没有新增内层滚动或CSS补丁。
- helper63339经私有release标志释放并exit0，原自有文件仍30字节。原页/同按钮Enter再次真实成功导出119285字节ZIP，焦点保留、旧失败随新操作退休（after-recovery-focus/after-browser-recovery-archive）。新ZIP仍6条目/2文件和同一profile-after/log、原raw字节；切中文成功反馈正确（10/after-final-chinese）。未使用刷新、重启、更换endpoint或假响应恢复。

01–04前态、05–10最终构建共10张截图全部已人工查看。即时几何/焦点与状态JSON只读观察，不是UI测试；原ZIP仅留私有临时根exports，本目录保存必要manifest/条目/原输入字节回执。标准zipfile读取真实下载，实际协议/内容对象验证，不用可变源码摘要门槛。本人三个浏览器下载全部精确移出Downloads，不触碰其它文件。

聚焦纯服务正向合同：api-error 28测试/107断言、binary-api-error-services 5测试/40断言通过（33/147），覆盖原错误身份/请求ID/二进制响应；它们使用隔离transport/Response夹具，只证明局部合同，不冒充网页验收。Overlay typecheck、2语言2914键、最终build/renderer public surface、docs:check（352操作26组）和architecture-index通过。

未独立实页覆盖：断线期间原native禁用、长时间导出时跨连接/关闭页面、并发重复激活的精确请求计数、其它General通知/Git错误、本机原生Tauri窗口。同步busy guard及非keyed Show/localeSeq依赖已由代理只读复核；实页已证明真实忙焦点和Details展开保持。不把本批扩为这些未测矩阵。Sol授权仍待答复，零模型/消息。

最终本人IAB 27/28关闭；38942/38943公共shutdown成功、原启动句柄62642/87860 exit0；锁99493/63339均释放并exit0，resource-settlement确认两原输入均30字节。只提交本批General/架构/spec及必要证据、三索引新增入口；保留原177条工作区状态，完整待推集合审查、正常钩子推送后继续。
