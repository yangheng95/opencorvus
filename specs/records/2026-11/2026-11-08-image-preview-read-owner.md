# 全图读取归属与窗口内恢复

## Recall

用户要求持续按批并行体验UI（User Interface，用户界面）/UX（User Experience，使用体验）、功能调查，根因/影响分析先落盘，真实桌面/ui交互与截图人工复核、聚焦正向测试及获授权的GPT-6.1 Sol验收，范围提交、上游合并和正常推送后继续，直到明确停止。前批b8c2538c0已正常推送，本批开始HEAD/upstream 0/0、git status --short原177条逐项保持、暂存空。Sol凭据授权仍待答复，本批零消息/零模型请求，不读/复制/调用凭据。

本批两只读子代理并行核对previewLoader全部生产入口、Host资源/原生解码、revision（预览修订）与UI布局/焦点，禁止再次委托。主代理已读ImagePreview/服务、FilePart、ScreenshotBrowserPanel及来源准入/thumbnail队列、main代理图片事件、图片URL映射、Dialog/Feedback/Button、当前图片CSS（Cascading Style Sheets，层叠样式表）、image-preview-authority纯服务测试与07-panel、近三批媒体/下载/派生错误记录。全仓搜索previewLoader/pendingRequestRevision/loadPreviewSource、所有预览revision接口与调用，只有两个生产预读提供者（FilePart、ScreenshotBrowserPanel）。已核对历史677f7afd1授权Host读取和e0b4cb3d7资源映射变更，其后仍保留原预读，未合并读取所有权。

## 根因、深度与影响

候选现象：已显示有效缩略图，首次点击全图时实际读取失败，当前Host根本未打开，只往应用日志写错；用户没有当前操作的窗口/诊断/恢复。前批发现日志分支，本批必须真实复现再改产品。

数据/控制流：两消费者提供previewLoader，PreviewableImage先await显示资源、成功才openImagePreviewForRequest；失败catch仅reportError。成功后Host已按canonical resourceUrl通过attachmentImagePreviewUrl和授权createResource独立读取相同显示地址，通常第二次命中缓存。故预读是重复所有权，删除后Host仍拥有完整真实资源，不需要新增提示副本、缩略图fallback（备用路径）或第二loader。当前URL映射只有SVG（Scalable Vector Graphics，可缩放矢量图形）选image-preview派生，PNG/JPEG全图读取原件，不能宣称所有图片全图都走variant。

生产影响包括Composer/消息图片、截图图库，以及所有共用Host的工具/浏览器证据、Markdown和产物图片。ScreenshotBrowser既有isStoredAttachmentUrl与thumbnail来源校验确保其resourceUrl规范，现thumbnail懒加载/逐帧队列与取消保持。没有Task/Mission/Session（任务/多步任务/会话）调度/唤醒/恢复/终态异常证据，不由UI点击失败推断后台调度故障；现共享Blob的失败清理/槽释放已有正向合同。本批不动缓存或调度。

所有权清理：删两previewLoader调用、私有type/prop、组件pendingRequestRevision/异步预读/catch及其失用导入。删除后服务的ImagePreviewResource和预留/取消/延后发布接口只剩自身包装和旧测试，须同步删除，不为测试保留旧协议。同步open/close直接更新唯一imagePreviewState.revision；去掉失用的独立imagePreviewRevision计数及current helper，copy/download依旧使用同state.revision、各自generation和authority（连接权限身份），不建立第二修订来源。服务只投影当前图片身份，Host为授权资源读取者。保留resourceUrl相对路径完整性校验。

错误边界：Host resource.error是授权读取/HTTP（Hypertext Transfer Protocol，超文本传输协议）失败，原imageFailed是浏览器原生解码失败，两者继续用现Feedback；只给前者HTTP重试。成功Blob无法解码时已进入缓存，refetch不能修坏数据，不给误导性重试。尺寸仍仅来自真实native onLoad的正naturalWidth/Height，不把thumbnail尺寸当全图。初始加载须明确common.loading并隐藏无source的image元素，避免空白/坏图图标冒充就绪。

现Host错误区420px上限，失败时imageReady=false，startPan/modified-wheel已退出，按钮不被平移捕获；只对长诊断增加内部限高滚动。读取中/error未清时保留同反馈、忙态aria-disabled与.loading动作守卫。不复制失败历史。当前Solid1.9.13源码确认refetch返回settled loadEnd链、失败信息在Resource.error；完成时会先清error并卸载Retry再完成Promise，不能照抄b07清本地失败前的焦点判断。

焦点沿当前CommandPalette.loadMore成熟模式：调用前捕获本按钮是否持焦点，等待同Resource refetch，只有同预览revision/authority仍当前、成功、旧按钮已卸载且activeElement为BODY时，交回现Header Download；用户仍在Close/Details等控件时保留其焦点。不加计时器或全局focus监听。需真实失败→失败、恢复成功、下一Tab、Escape验收。

无外部API（Application Programming Interface，应用程序接口）/SDK（Software Development Kit，软件开发工具包）、配置、消息或持久格式变化，无迁移。内部预览服务收敛须改过期纯信号测试为同步open/close、精确资源身份/递增revision及明确错误合同；不新增或运行UI自动化。两原生/HTTP错误分支与下载/复制既有归属不得混为一谈。

## 前态方法、方案与验收

新私有临时根opencorvus-iteration-20261108-b09、全新OPENCORVUS_HOME和自有项目，before38934/after38935原开发serve /ui。复用b06自有media-recovery.png（已渲染人工查看的PDF页图）和b07自有original-preview.svg，不生成用户消息/截图图库记录。真实上传PNG缩略图成功后、首次全图打开前定位精确原件/sidecar，核完整输入字节及移动两端在本私有根内，暂存原件；点击缩略图应真实原GET404、仅日志而没有Host。恢复同字节后再开应成功，排除旧路径完全不能恢复的误判。

前态吻合后执行上述单Host方案。after新普通构建/新实例，重复同条件，立即打开具名窗口，真实404与完整详情/重试；仍缺失时重试保持失败及焦点；恢复原件同窗口重试，真实PNG全图固有尺寸/缩放和原下载字节、成功焦点/下一Tab/Escape返回。新增SVG成功对照映射/原件下载，中文/英文及长诊断实际截图人工复核。图库共享代码核对；若无真实持久记录则明确未做该入口实页，不造消息。

运行聚焦纯服务正向合同、typecheck/check:i18n、普通build/renderer和docs/architecture；不以这些替代页面。必要布局修正须新构建/实例重验。本人服务正常shutdown并消费原启动句柄exit0，精确暂存原件全部归位，下载事件确认本人文件字节后移私有根，用户窗口/Downloads其他文件不动。范围提交、上游合并、完整待推集合审查和正常推送后继续。

## 前态与最终决定

本批前态成立：01/JSON确认真实PNG缩略图完整解码170×240；25076字节原件暂存后实际原GET404。首次点击全图的实际请求ff03439e-a809-41e0-9445-5c8dad051bef完成404，随后overlay:ui记录Image preview及同ID的Not found/stack；02页面仍在首页，只有原缩略图保持焦点、无Host（before-open-log.jsonl）。日志的Copy failed措辞只是旧错误文案，根因仍由预读控制流和该次404证明，不能按标题推断复制失败。

恢复精确字节后原GET200，03旧路径再次打开正常PNG全图，真实固有尺寸794×1123、正文READ_ORIGINAL_PDF_B06可读。不是完全不能恢复，而是失败时缺少窗口内操作。本人before标签19已关闭，38934正常shutdown且消费原启动句柄exit0，暂存原件已归位。

据此实施原方案。内部服务同步open/close只保留一个state.revision，删除预留/异步发布/取消协议及其失用API（应用程序接口）权限快照；Host各实际读取/复制/下载仍捕获原authority并按该state.revision及各自generation守卫。纯服务测试改为同步身份、顺序修订、关闭态与非法资源路径错误的正向合同，不保留已无生产消费者的pending测试。

## 最终验收与交付

实施及只读复核完成。两个previewLoader调用、组件异步预读及服务旧预留/取消协议已删除，单一state.revision服务同步open/close；Host唯一Resource按canonical source/revision/authority读取和refetch。native decode失败只保留说明，HTTP错误才提供重试；未引入缩略图备用源、错误副本、计时器或focus监听。长诊断沿既有反馈规则共享限高/内部滚动。

实际after38935/ui使用普通build main-DIElkItX.js（53.45秒），本人标签20、桌面1280×720。真实PNG缩略图170×240成功后首次全图前暂存原件，立即打开具名Host并显示原GET404与Close/Retry（04稳定图）；首次截图为开窗过渡帧，后已重新实拍覆盖为稳定状态，不用过渡帧冒称布局故障。05英文完整HTTP诊断，Tab进入可滚动详情再到Retry，Enter实际出现Retrying/aria-disabled，结清仍404、request ID更新且焦点仍为Retry（after-repeated-failure.json）。

中文浅色再次打开原图，06完整失败/摘要/详情/重试；从Close按Tab到Details、Enter展开、Tab诊断/End滚至原Not found body（07）再Tab到Retry，确认错误控件不被平移事件截获。恢复相同25076字节原件和原URL200，保持同一Host用Enter重试，08完整PNG真实解码794×1123、正文READ_ORIGINAL_PDF_B06可读，原Retry卸载后焦点确实到Header下载（after-retry-success.json）。

恢复后实际原生拖动[640,420]→[640,270]，图片body.scrollTop从0到150，09实际画面和after-pan.json记录；两次缩小到50%，10人工查看原图/缩放/关闭完整可操作。Header原下载保存media-recovery.png，与输入25076字节完全一致；Header Tab到Close，Escape后11和after-escape-focus.json确认原PNG缩略图持焦点。

再从现缩略图同步打开SVG，实际状态观察到“加载中…”及可用Close，未强行延迟响应或伪造持续加载截图；12成功全图显示READ_ORIGINAL_SVG_B07、真实640×320，完成时仍保留先前Close焦点（after-svg-loaded.json），没有无条件抢Header焦点。浏览器原下载original-preview.svg为567原字节，与输入相等，并未把WebP下载成SVG（after-svg-download.json）。全部12张截图均人工查看。

聚焦bun test test/image-preview-authority.test.ts test/blob-cache.test.ts test/api-authority.test.ts test/file-download-authority.test.ts test/attachment-resource.test.ts：31 pass/105 assertions（267毫秒），包括更新后的四项纯服务正向状态/路径错误合同。overlay typecheck/check:i18n（2914键、两语言）、普通build/renderer surface、docs:check（352 ops/26 groups）和architecture-index通过。未新增或运行UI自动化，服务/Blob夹具不替代实页。

图库入口只做源码共享路径复核；本批全新项目无真实持久图片消息，未造消息或伪称图库端到端。没有取得原生坏图解码样本或实页API权限轮换，也未人为延迟请求验证用户等待中转移焦点分支；该分支沿现成熟模式并经代码复核，不能当作上述实页范围已覆盖。Sol凭据授权仍待答复，本批零模型请求。

本人标签19/20均关闭，38934/38935均正常HTTP shutdown并消费原启动句柄exit0，两次暂存PNG均已归位；下载事件对应本人PNG/SVG核原字节后移至本批私有根，未处理其他Downloads文件/用户窗口。无版本/Release/标签改动。范围提交、上游合并与正常推送依实际Git回执收尾，之后进入下一批。
