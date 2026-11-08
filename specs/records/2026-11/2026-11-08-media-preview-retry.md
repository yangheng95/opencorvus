# 媒体附件失败后的原位重试与诊断

## Recall

用户要求持续批次并行体验UI（User Interface，用户界面）/UX（User Experience，使用体验）、调查功能与缺陷；先完成根因/影响分析并落盘，再修复、真实桌面交互/截图人工复核、聚焦正向测试及获授权时Sol验收，清晰提交、上游合并和正常推送后继续。上轮04e20dd84已推送：真实浏览器否证Unicode空白原名落盘方案，源码/测试/架构候选已精确撤回并重新构建，不能再把它当作已修能力。本轮开始main/upstream 0/0，原177条已有状态保留，暂存为空。终端Sol凭据授权问题仍待答复，不重复询问，不复制或调用凭据。

两个只读子代理并行审计了FilePart四媒体资源、API（Application Programming Interface，应用程序接口）缓存和Composer预览链；主代理已核对FilePart、ComposerAttachmentPreview、ChatComposer上传/缩略图、capture/upload、AttachmentStore/公开附件路由、Feedback/Button、ResourceTextPreview、错误诊断、相关CSS（Cascading Style Sheets，层叠样式表），当前07-panel及最近文本/原下载恢复记录。全仓搜索LoadError、四Authed组件、createResource及refetch、fetchResourceAsObjectUrl和同语义反馈。现blob-cache/api-authority/file-download-authority是服务/Blob合同，attachment-resource为纯URL（Uniform Resource Locator，统一资源定位符）输出，没有本批UI自动化或负向核心断言；不新增或运行UI自动化。

本批使用pdf技能和已定位的官方依赖运行时生成/渲染一份自有有效PDF（Portable Document Format，便携式文档格式）测试输入。遵守技能创建标记和渲染检查；生成文件作为QA（Quality Assurance，质量检查）输入放本批specs/artifacts，用户的仓库位置要求覆盖技能默认output路径。不生成模型消息或使用用户附件。

## 修改前深度与影响分析

候选现象：授权媒体首次读取失败后只显示具名摘要，同一页面缺少原位重试和完整诊断。四个AuthedImage/Video/Audio/Pdf都只取createResource的值，丢弃refetch（重新读取）；共享LoadError只有一行file.load_failed。失败守卫已经存在，不是旧的整张消息卡片异常。恢复原件/网络但source和authority（请求权限身份）不变时没有新读取触发；关闭重开可重新挂载，不能称完全无法恢复。

根因属于呈现层缺少恢复动作和诊断投影。共享fetchResourceAsObjectUrl只缓存成功Blob，成功/失败均按原entry身份清理in-flight（在途请求），finally归还请求槽，消费者正常释放；不需改缓存、并发队列或传输。现有服务测试已有404原路径/原body到同URL成功、取消/共享消费者和槽释放正向合同。本次没有Task/Mission/Session（任务/多步任务/会话）调度、唤醒、执行恢复或终态异常证据，不用UI缺少重试推断共享调度故障。

真实前态计划：自有隔离项目真实上传有效PDF，上传链不预取PDF；ComposerAttachmentPreview只在首次点击后创建FilePart→AuthedPdf。先在上传成功且尚未预览时，按真实url定位本项目数据库namespace下的精确原件，将该自有blob暂存至同一私有根内，保留sidecar和原字节；首次预览触发真实GET 404。恢复原件后保持原弹窗，验证错误仍在、无重试；关闭重开应能阅读同一PDF。不得注入消息、浏览器路由/响应、缓存或假事件。只有实际前态与代码根因吻合后才改产品。

存储路径必须依据当前Project.worktree和AttachmentStore.resolveAbsolute规则核实，不猜全局attachments目录；原件和备份均须在本批临时根内，移动前验证路径。原件恢复后通过原公开URL和完整字节确认，不重算可变源码摘要作门槛。sidecar及原引用不改。

## 方案（前态后定稿）

优先扩展现有唯一LoadError为Feedback（反馈）+完整formatErrorDetails+显式Button重试，四处分解取得原refetch，动作调用当前资源，loading（加载中）禁止重复。保留原source、捕获authority、initialValue缓存、成功媒体和原件下载。不新增失败状态、缓存、备用URL、自动重试、定时器或页面刷新。正常加载应有本地化忙反馈，避免重试中空白；具体取当前Resource状态，不复制错误历史。

复用file.load_failed、file.retry_preview和common.retrying等当前字典；按钮无障碍名称带原显示名，原错误/URL保留真实内容。图片Composer父chip限宽220px且overflow:hidden，丰富Feedback可能裁剪Retry或Remove，必须实际错误截图；优先复用公共Feedback布局并只在该失败chip内调整排版，不为测试塞DOM。若替换后.msg-file-error旧颜色/字体规则失去用途，删除其旧呈现，仅保留必要布局，不留下两套错误样式。

影响限授权媒体读取失败的UI能力。文本/未知格式、OriginalFileDownload、原字节、附件身份、消息排序及PDF/浏览器解码维持原合同。ImagePreviewHost全图请求、原生媒体解码和PDF解析错误属于独立生命周期，不冒称本批覆盖。现架构只承诺文本/原下载重试，修改后明确增加媒体读取恢复，不伪称所有媒体过去已有该合同。无接口/SDK（Software Development Kit，软件开发工具包）、配置、权限、schema（数据库结构）或持久格式/迁移变化。

## 资源与验收

四Authed呈现的共享调用还包含用户图片条、CardParts、工具附件、TaskDirBar和Media/Notebook/Presentation产物；本批不新增各处特例。操作名使用displayLabel或原filename，图片alt保留作者语义（自定义alt不应替代重试文件身份）。独立失败Resource需各自重试，不宣称一次点击会自动恢复其他实例。

新临时根opencorvus-iteration-20261108-b06、全新OPENCORVUS_HOME、自有项目；before38928/after38929均原开发模式/ui。模型请求预算0，不发送消息。自有有效PDF先渲染人工查看；自有故意无效PNG（Portable Network Graphics，便携式网络图形）用于真实缩略图失败及窄chip控件可达性，不能当作图片成功恢复证据。按工具可用性增加有效音频/视频；未取得的分支须明确范围，不能用一个PDF证明全部播放器解码。

本批纯UI呈现改动不新增自动化测试；类型/语言/普通构建及文档/架构检查仅作编译辅助。真实after重复404→恢复原件→同弹窗点击重试→原PDF可读，展开诊断查看实际路径/状态，键盘操作、中文/英文和窄图片chip的Retry/Remove实际截图复核。若需调整布局，重新构建、新实例截图，不向活实例热换资源。正常关闭本人标签/服务、消费原始启动句柄退出、检查源字节和暂存结清，范围提交、上游同步和普通推送后继续。

## 前态与最终决定

首轮真实after英文截图05/06证实重试、详情、原名和移除完整可见，长HTTP GET 500诊断在块内滚动。用Tab从详情进入可滚动诊断，再进入Retry preview，Enter产生同源新请求和新的request ID；原PNG仍故意无效，不能声称成功恢复。结束后实际document.activeElement落到BODY，说明新动作使用native disabled会丢失键盘焦点；从重试重新Tab可到Remove。补充决定：沿当前PdfPreview的aria-disabled+动作loading守卫保留按钮焦点，复用Button现有禁用视觉；不加焦点定时器或第二状态。重新构建新实例，复核失败重试后焦点和成功恢复路径。

真实前态完成：自有PDF首次原路GET 404，弹窗只显示具名失败；恢复1753字节原件后同URL 200，原弹窗仍失败，关闭重开立即显示原PDF的READ_ORIGINAL_PDF_B06内容。01/02/03截图已人工查看。故意损坏PNG上传后真实缩略图失败，04截图显示错误摘要在220px chip内被压成多行、名称省略，当前移除仍可点击；不能把压缩文字当作控件已不可达。

因此实施上述呈现层方案。子代理核对当前安装Solid 1.9.13源码：refetch开始不清除error，.loading为true，结束时才清除旧error，因此现有外层error守卫可保留失败反馈并禁用重试，不引入第二份错误状态；initialValue即使undefined也影响state值，统一以.loading判断。首次未成功的非Composer媒体内层补本地化status；Composer图片保持原缩略占位。

错误chip采用当前父级直接子项布局：Feedback独占一行并纵向放置摘要/详情和动作，名称与移除保留下一行，详情限定内部滚动高度。附件带的交叉轴按自然高度顶部对齐，避免正常chip被失败chip撑高。删除原.msg-file-error重复颜色/字体/背景，只保留必要宽度约束。编译后必须在真实页面复核具体几何，不以CSS推导冒充结果。

## 最终验收与交付

最终构建main-B9p12tec.js在隔离开发服务38929/ui验收，无模型请求。两轮候选的本人标签13和服务均正常关闭后才重建，最终标签14已经关闭，所有精确暂存原件已恢复；38928/38929服务通过原HTTP shutdown并消费启动句柄exit 0。用户窗口和进程未操作。

- 真实PDF 404展开完整HTTP方法、路径、request ID、原body和stack；恢复1753字节原件后，保持弹窗用Enter重试，显示READ_ORIGINAL_PDF_B06原文，09/10截图人工复核。没有刷新页面或重建附件。
- WAV与MP4分别首次404，在各自同一弹窗恢复精确原件并点击重试。11–14截图人工查看播放器及视频测试首帧；原生媒体DOM读取WAV readyState4/duration0.5、MP4 readyState4/duration1、320×180，无媒体错误。证明读取和解码首态，未执行播放/音质验收。
- 图片故意坏字节反复得到真实500；05/06英文深色和08最终中文浅色显示完整摘要、Details/详细信息、Retry/重试与移除，详情有内部滚动；最终Enter重试结束后焦点仍为具名重试按钮（07和JSON），Tab到移除、Enter成功移除并把焦点交给邻近真实控件（15）。新有效PNG正常缩略图及具名预览按钮显示（16）。没有证明图片“失败后成功重试”或ImagePreviewHost全图恢复，不能用此替代。
- 恢复PDF/WAV/MP4分别真实原GET200，sidecar保持，最终与各自输入完整字节比较相等。浏览器原视频下载6368字节与输入相等，下载事件所得本人文件核实后移至本批私有临时根，未处理Downloads其他文件。对应final-byte-receipt.json。
- 编译辅助：overlay typecheck、check:i18n（2914 keys/2 locales）、普通build和renderer surface检查通过；docs:check（352 operations/26 groups）、architecture-index通过。真实页面使用最终第二次build（54.18s）。未新增或运行UI自动化。
- 聚焦正向服务回归：在packages/overlay执行bun test test/blob-cache.test.ts test/api-authority.test.ts test/file-download-authority.test.ts test/attachment-resource.test.ts，27 pass/98 assertions。这些是本地Response/Blob/权限合同，不能当作网页端到端证据。初次编译命令cwd重复导致ENOENT，立即改为当前package脚本重跑成功；没有以工具错误跳过验收。

加载态的aria-disabled与动作守卫沿现有Button/PdfPreview合同，失败重试后的焦点已真实验证；未注入延迟响应或捕获持续忙态截图。终端Sol授权问题继续待用户答复，与本批零模型页面验收无依赖。无发布/标签/版本改动。

下一批只读并行线索：图片打开全图和原件下载的catch仅调用reportError（只写日志），需要先真实复现再定方案；损坏图片派生500应另行调查具名领域错误，不能把无结构化code的sharp异常按英文关键词映射4xx。两项尚未修复，不混入本提交。
