# 332 PDF 文件来源阅读

## Recall

用户持续授权自主体验、UI/UX（User Interface/User Experience，界面与体验）改进和真实功能修复；最新只允许单agent，覆盖旧goal的并行措辞。root独立调查、开发和浏览器复核，不派发成员。331完成共享图片解码失败提示与恢复，提交 `ed31e83581f25768f18133f9b306ca93579e00b9` 与远端一致、工作区干净、自有资源结束；本轮转向PDF（Portable Document Format，便携文档格式）来源。

已读当前FileEditorPane/FileContent、File.read/readSource/readResolvedContent/写入保护、所有生产调用（文件API与debug CLI）、file-source-content与server/file-read-identity测试、FilePreviewArtifact中唯一PdfPreview实现、共享资源读取、PDF样式、07-panel/331记录。当前PDF只返回binary空content，因此来源面板无法展示；已有PDF.js阅读器只接在交互文件Artifact入口。新能力须复用这一实现，不造Artifact或第二阅读器。

按PDF技能只读检查仓库既有公开论文 `packages/web/public/papers/opencorvus-poc.pdf`：4472337字节、16页。原文不编辑，只复制原字节到隔离项目作为正常输入；使用Poppler渲染首页并人工查看。PDF.js官方[API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html)及[示例](https://github.com/mozilla/pdf.js/blob/master/docs/contents/examples/index.md)说明URL/二进制数据输入；现有fetchResourceAsObjectUrl已把data地址转换为blob URL，沿用该单一资源路径。

## 改动前分析

现象候选：read工具读取PDF会产生真实source-file，但File API按.pdf二进制扩展名返回空内容，FileEditorPane显示不可编辑。直接控制流是readResolvedContent的早期二进制分支，后端没有提供预览字节；前端也未接入已有PdfPreview。330只处理图片，不能覆盖PDF。需要先实际点击来源保存原失败画面。

拟沿当前FileContent的encoding=base64/mimeType契约返回PDF原字节，shape不变，不新增接口或SDK协议。项目内与绝对来源读取共用同一实现；现有写入在type/encoding检查处拒绝二进制，PDF仍只读。debug CLI将获得实际编码内容；文本、图片、其他二进制以及错误/物理路径边界保留。所有定义/调用及旧决策已检索，未发现已有PDF来源读取替代实现。

把FilePreviewArtifact内部PdfPreview移为共享组件，改为url/label输入并删除原内部实现；Artifact和文件面板都调用它，不构造虚假Artifact。保留原PDF.js worker、资源所有者、页码/缩放/绘制取消和文档销毁。现有资源读取可能throw，共享组件须先检查loading/error再读取，避免失败绕过原错误区域。文件面板按编码PDF呈现只读预览，按需加载组件；局部约束和toolbar换行适应窄侧栏。公共API返回值变化需要聚焦正向真实文件/路由测试，不用UI自动化。

风险包括大文件编码传输、原Artifact入口复用、页码/缩放、侧栏大小变化、源切换、失败/销毁和文本/图片分类。实际覆盖16页4.47MB文档；不预先宣称所有PDF功能、格式或入口完备。若发现调度、唤醒、恢复、并发或终态异常，立即横向审计共享Task/Mission/Session机制，不凭最后错误标签归因。

## 实施与验收

先fresh NativeService `/ui`18303（before），正常单人Work/Chat实际read本轮PDF、仅简述首页标题，产生真实来源后点击查看。授权OpenAI和完整models成对复制，预检分别usable/projected/实际gpt-6.1-sol流式；累计12请求，原生出生起600000ms固定边界。before完整收敛后才改后端，不能指望旧进程加载新模块。

新增server/file-read-identity正向PDF契约：真实项目副本、不可用执行模型下两条真实读路由仍200、正确MIME/编码、解码字节准确；先记录原实现失败，再改唯一实现并重跑原测试及file-source-content。既有测试都是后端/服务契约，不是UI测试。按源码范围执行类型、构建和docs:check，禁止全量bun test。

新构建完成后fresh NativeService `/ui`18304（after），新的完整固定边界和配对预检，同一原文副本、真实read来源。root逐张截图人工核对首页、第二页、前后翻页、缩放/适宽、窄侧栏与关闭重开；必要时实际错误反馈并按原读取动作恢复。两个运行是有目的的修改前后验收，不因观察超时重启或延長旧轮次。UI（User Interface，用户界面）只允许真实交互、截图人工查看，不写/跑组件、DOM、截图基线、浏览器fixture或像素断言。

原始证据、输入身份、来源、实际请求模型与各checker句柄分别核对。所有自有页面、Native/Host/output/request、端口和复制auth/models成对收敛，归档脱敏事实。同步当前架构和根/月/目录索引，范围提交后fresh fetch/merge、审查完整待推送集合并正常push，goal保持active。

## 修改准入：真实基线

普通Chat真实read16页PDF产生source-document.pdf来源；root点击后亲见不可编辑占位，截图01已人工查看。实际GET /file/content返回200、type=binary、content为空，见pdf-content-before.json。新后端契约测试通过原3项，但PDF期望失败（86973实际exit1，16断言），正是空二进制分支；不是工具链失败。

before页面110已关闭，原41845 actual exit0；Native51776/Host58168/18303、输出请求和复制配对正常收敛，5次Sol流式EOF。按上述唯一实现准入后端PDF编码与共享阅读器；SDK数据shape不变，禁止为了旧空二进制返回保留双路径。既有PDF渲染取消/销毁和资源错误守卫必须一并保持。

提取前进一步核对生命周期：原PdfPreview仅onMount观察首个viewport，错误Show撤下再恢复的节点不会重绑观察器。共享组件改由当前viewport ref绑定/替换唯一ResizeObserver，cleanup断开；并在读取resource前检查error，避免Solid失败resource读取直接throw。以上属于当前阅读器的恢复边界，after须加真实无效PDF→原字节恢复→重新缩放/窄宽复核。错误显示保留原解析/资源诊断并使用现有Feedback，不增加第二错误来源。

## after-02 实际读位缺陷与最终修复范围

首轮修改后后端5测试/24断言、前后端类型及56.86秒构建通过。18304真实Source已显示16页，第一页/第二页/125%和翻页均亲见；但同页同缩放关闭重开，scrollTop从29.33333396911621回到0。进一步实际记录表明canvas始终623×806，隐藏时viewportWidth/Height变0且scrollTop=0，重开回380×533仍是0，见pdf-position-before-fix.json及截图05/06/07。证据排除了“必须是画布缩小重绘”的最初候选；直接根因是隐藏滚动容器归零，而当前PdfPreview没有记录可见阅读位置。不是Task/Mission/Session调度或数据终态异常。

02自己的111已关，6763 actual exit0，Native37444/Host70036/18304/output/request与复制配对正常收敛，5次Sol流式EOF，旧边界没有延长。原错误和所有数据保留。

准入当前PDF文档/页内的本地top/left阅读位置：只在可见且布局稳定时记录，隐藏时保留原值，重显后等待当前宽度绘制完成再恢复；源或页更换清理原位置，组件退出取消帧。复用已有animation-frame调度器；将CodeEditor既有有限祖先动画判断提取为共享函数供两个真实使用方调用，保持原语义，不复制一份算法。聊天自动跟随控制器含会话/纵向跟随契约，不用于PDF页内双向滚动，不添加跟随状态或全局读位缓存。

最终采用新构建fresh18305/live-03，仍独立600000ms/12请求，不续租02。真实普通Chat读取同PDF并检索普通source-review.md第24行作为CodeEditor调用方复核。root必须检查深滚动→关闭重开的位置、页码/缩放、页切换、无效PDF/原件恢复后重新布局，以及文本第24行定位。03是有具体已复现缺陷的修复后验收，不是因观察过期重启。其他交付/配对/原句柄/提交规则保持。

## 最终执行结果

03 实际六次 gpt-6.1-sol 流式请求全部 200/EOF，两个真实文件来源。16 页 PDF 的第二页 200% 下横向/纵向深阅读，关闭重开保持 top=252、left=153.3333282470703；第三页适宽正常。实际替换隔离副本为无效 PDF 后显示原始 InvalidPDFException，恢复原始字节并 Reload 后恢复 16 页；随后窄宽调整仍重绘，验证 observer 重新绑定。共享动画判断的另一调用方也以真实文本来源第 24 行定位、可见高亮及编辑器焦点复核。截图 08–16 均已人工查看，未进行 UI 自动化。

三个固定边界运行已全部生产 Native exit0、Host/output/request/port 与复制配对清理。03 的原 launch 65995 最后一次 join 结果在上下文恢复时不可见，再查询已 Unknown process id，故不伪造其 shell 返回值；生产物理完成事实完整保留。全部来源、请求、对照 API、输入恢复及三轮完成事实的正向 checker 通过。后端5测试24断言、前后端类型和最终构建通过。详细交付证据及边界见 [332 README](pdf-source-332/README.md)。继续保持 goal active，单 agent 执行后续 Sources 调查。
