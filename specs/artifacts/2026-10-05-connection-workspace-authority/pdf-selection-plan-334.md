# 334 PDF 来源文字选择

## Recall

用户持续授权自主体验、UI/UX（User Interface/User Experience，界面与体验）和功能迭代，重点 Sources；最新仅允许单agent开发，覆盖旧goal多agent措辞。上一轮333已提交并推送edc32e6c27f0053d8e3a944631027461ed6d403d，空文本预览修复有真实页面与后端事实，开始时工作区干净。上一目标轮为实质进展，不是等待或状态复述。

已读332/333 Recall、当前07-panel及共享PdfPreview完整实现、FileEditorPane/FilePreviewArtifact两个调用入口、PDF相关messages/workspace样式、根user-select规则、包内PDF.js5.4.394 TextLayer公开类型与实现、官方viewer的文字层/旋转样式，以及TextLayer/getTextContent全仓定义/调用检索。当前项目没有文字层实现或相关UI测试。继续已有benchmark-debug-template分析/真实验收流程；用户的UI禁用自动化规则优先，只用真实交互、截图和人工视觉复核。PDF技能仅用于只读核对既有公开16页文档，不编辑原PDF或新建伪装来源。

权威资料：[PDF.js API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html)、[官方文字层使用方](https://github.com/mozilla/pdf.js/blob/master/web/text_layer_builder.js)。实现以当前已安装5.4.394的TextLayer参数/取消/尺寸契约为准，不照搬master差异。

## 修改前分析

现象候选：来源PDF可以翻页/缩放，但原文不能选择和复制。直接根因候选是共享PdfPreview仅调用page.render画canvas，没有page.streamTextContent和TextLayer；canvas本身没有可选字符。332补上可视预览与读位，但没有文字阅读层。先通过真实Source拖选确认，不以源码替代视觉验收。

范围是唯一PdfPreview和局部文字层样式；文件API、base64内容、canonical附件、写入只读、模型工具和持久化不变。FileEditorPane和FilePreviewArtifact必须共用新增能力，不能有第二解析器、服务器纯文本备份或OCR（Optical Character Recognition，光学字符识别）替代路径。已有PDF.js同页的streamTextContent提供文字和字体定位数据，TextLayer负责布局，canvas仍负责页面视觉。

拟在当前画布外加一个尺寸一致的页面容器，文字层覆盖其中，使用显示缩放的viewport而不是设备像素倍率。同一effect拥有canvas renderTask和TextLayer：更换页、缩放、尺寸或资源时取消旧任务并移除旧文字节点；两者完成后才发布当前绘制完成并恢复读位。异常保留原Feedback诊断并清理同轮兄弟任务，不能留下后台旧文本写入。使用现有取消/销毁、API权限和原错误流，不新增全局缓存/状态机。

官方viewer全量CSS还含dialog/button等全局规则，不直接引入；只在本阅读器局部实现TextLayer所需的透明绝对定位、字体原点、原页旋转、选择颜色和尺度变量。全局app不可选必须由该文字层明确允许选择。自然页旋转与userUnit纳入当前viewport契约，不将TextLayer和canvas分别估算几何。公共工具、SDK、配置、后端无改动；不新增镜像UI逻辑的测试。任何真实Task/Mission/Session调度/终态异常仍须立即横向审计，不能用模型行为降级。

风险包括字体/文字位置偏差、设备像素比、旋转页、快速翻页与缩放、隐藏重开读位、图片型PDF无文字、错误恢复、两个入口资源寿命。桌面实际验收当前公开16页英文PDF；扫描件不做OCR，不能宣称所有字体和文档类型已覆盖。

## 实施和真实验收

先fresh18308/live-01开发模式 `/ui`，成对复制已授权OpenAI auth及完整models；分别验证usable/projected/实际gpt-6.1-sol streaming。正常单人Work/Chat实际read未修改PDF产生source-file，并通过正常publish_interactive_artifact展示当前项目实际上传返回的PDF引用。所有消息/Artifact来自真实参与者；不写数据库、不造消息。root在来源页面拖选标题，截图并记录选择文本，确认原失败。

完整关闭自有页面和首轮服务/输出/请求/端口/复制配对后才实施；执行前端类型/构建，再fresh18309/live-02使用同一原文字节、新构建及正常单人对话。实际检查来源标题拖选/复制、125%或更大缩放的对齐、第二页文本选择、快速翻页后的当前页、关闭重开读位，以及Artifact入口中的文字选择。只读DOM选区记录作辅助事实，不写UI断言或截图基线。每轮累计12请求，原生出生起600000ms固定成本上限与180秒无活动观察分开；等待过期不算终态，不续租旧轮。

记录原始输入、Provider/工具/来源/Artifact事实、服务完成和截图，归档脱敏证据。只对实际后端数据执行正向事实checker，不对DOM/图片执行自动化测试。同步根/月/目录索引、当前架构并运行docs:check；范围提交后fresh fetch/merge、审查完整待推送集合并正常push。goal保持active，后续继续单agent。

## 基线修改准入与后续问题

首轮真实read实际选择了给定canonical附件URL，生成的是其物理存储文件来源；不是请求文字中的项目根路径，但字节仍是同一原PDF，不能依模型自述混称路径。普通publish_interactive_artifact生成一个真实PDF预览。root打开实际source-file，在宽722px侧栏拖选标题，亲见无选区，selection-before.json为空，截图01已人工查看。与canvas-only代码对应，准入上述同页TextLayer实现。

115页面已关闭，原85007实际exit0；6次Sol流式请求均200/EOF，Native78728/Host49864/18308及输出/请求/复制配对收敛。后续图文布局范围按实际文件来源与Artifact两个入口验收。

另有实际发现待后续修复：read canonical附件来源显示摘要文件名及.opencorvus内部存储路径，虽然原上传引用有source-document.pdf。截图01提供线索；根因仍待追查AttachmentStore元数据、read路径解析和source-file发布，不能用当前PDF选择修复宣称已经解决。应作为后续Sources显示问题优先调查。

## 首轮文字层与边界疑点

类型20947、构建9385均actual exit0，51.61秒，02实际服务main-NZiF0CMr.js。实际Source标题可选择并原生复制；125%摘要标题与第二页RELATED WORK能正确选择，深阅读top336关闭/重开仍336。但某些从字形边缘开始的选区和Artifact展开后的选区包含前面的行号，见selection-title-after/selection-zoom/selection-artifact及截图02/05/10，不能把这些算作精确选择通过。

只读几何显示125%摘要A的边界left952.854/top427.792/width10.979/height16.469，与可见字形对齐，命中元素也是A；958,436到1027,436可精确选择ABSTRACT。仍须区分浏览器原生边界/交互坐标与实现缺失，当前不凭猜测判定根因。复核安装版官方文字层样式发现本实现遗漏了容器z-index:0与文字节点z-index:1的层叠契约；准入补齐这两条局部规则，再使用同一真实输入验证选择边缘和Artifact入口，不改写PDF阅读顺序或添加复制后处理。

02页面116已关闭，原57514actual exit0，6次Sol流式EOF；Native70052/Host10268/18309及复制配对和输出请求收敛。最终03使用新构建和fresh18310，固定边界不续租02。若补齐层叠规则仍未解决，保留结果继续追查，不宣称选区边界已修复。

## 03 空白容器选择根因

补齐层叠后的79980构建actual exit0，03服务main-oIIjbHrA.js；相同699,268起点仍包含行号，说明z-index不是该异常的根治。真实命中诊断selection-whitespace-diagnosis.json显示699,268是文字层DIV，704,268才是字母O的SPAN；坏选区anchor为DIV/offset13而非文字节点。文字容器被显式设为user-select:text，使空白起点按PDF节点原始顺序纳入前面的行号。几何与字体定位不应因此改写。

准入将文字层容器设为不可选，只让已显式user-select:text的实际span/br文字节点支持原生选择；保留官方层叠契约。预期从字形内开始可跨字词选择/复制，空白起点不再创建跨行号选区。此为同一UI缺陷的根因修复，不排序PDF内容、不按字词过滤结果、不加复制后备通道。

仅CSS改变，后端/当前会话不变；构建后刷新自己的117页面，让同一个03服务提供新bundle并重新打开真实持久化对话验收。保持原出生+600000ms上限，不重启或续租该进程。若范围内仍有异常继续记录，不能把未完成核对写为通过。

## 最终执行结果

56038构建actual exit0，49.26秒；同一03服务实际提供main-BHcN3tvx.js。117刷新后从真实历史重开对话，root再次同坐标拖选：空白起点为空，文字起点为完整标题，Ctrl+C原生复制得到同样原文且已恢复剪贴板。125%选择层与可见字形一致；快速Next/Next/Previous后第二页RELATED WORK正确，Artifact展开后能跨字体run拖选完整PROFESSIONAL。原生双击仍按PDF字体run取词，记录ROFESSIONAL；这不算完整词双击通过，也没有引入自定义分词。所有原始失败和实际部分选择结果均保留。

03页面117关闭，原16516actual exit0，6次Sol流式EOF；Native77576/Host77448/18310、输出请求与复制配对正常收敛。三轮均在原固定边界内结束。详细截图、检查与未覆盖范围见[334证据](pdf-selection-334/README.md)。下一轮优先追查真实发现的canonical附件Sources摘要名称问题，goal保持active、开发仍单agent。
