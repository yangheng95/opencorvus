# 222 文件读取错误反馈与恢复

## Recall

用户要求持续自主改善UI（User Interface，用户界面）/功能与Sources，授权现有OpenAI完整auth/models配对及gpt-6.1-sol真实验收，最新只使用单agent。221的同名path/六文件读identity和真实file打开已推送58e8f4c3，起始干净；前轮属于真实进展。本轮继续文件来源打开失败的反馈/恢复，不委托agent、不动用户IAB（In-App Browser，应用内浏览器）23，不伪造Source/Message或运行UI自动化测试。

目标：文件读取失败时有简短可理解提示、完整原始Details、明确Retry，恢复文件后同一Source/选择可继续读取；真实404/重复读取失败/恢复成功/Source返回及截图人工复核。原221巨长400截图是可观察视觉线索，不代替当前404，也不重新引入已修模型初始化错误。

## 修改前深度与影响

已读FileEditorPane全部target/load/save/reload/leave/cleanup、SharedFeedback/Disclosure、error-details、workspace文件pane样式、en/zh keys和221Recall。初始加载捕获cause后errorMessage字符串化到loadError；失败区域file-editor-empty直接插入API/path/JSON长串，原始ApiError(method/path/status/body/requestID)被丢失。只有header小reload icon；再读失败写入footer error而初始loadError仍旧，导致主提示与新请求诊断分离。直接触发为真实文件移动/暂不可访问→File content GET404或其他读错误；根因是同一load错误只存字符串、缺恢复操作且reload catch另写error。旧221修复Source path/GET authority，未改这一UI错误owner。

共享Feedback已有title/body/details/actions和本地Disclosure，可复用现有formatErrorDetails保留原错误；不新建组件、formatter、错误协议、重试缓存或自动循环。File loadGeneration/target/API（Application Programming Interface，应用编程接口）authority fence及reloadGeneration/draftRevision/leave/reservation合同必须保持。拟把唯一loadError改成nullable原cause记录，初始与当前未加载文件的retry失败更新同一记录；成功/新target清理。loaded/dirty file reload失败仍保留既有footer/draft保护，不扩大到save/close/dialog重构。HTTP（Hypertext Transfer Protocol，超文本传输协议）/SDK（Software Development Kit，软件开发工具包）/File backend/公开revision/path/模型合同不变；没有新调度/并发/终态异常，若发现按共享机制横审。

全仓相关搜索load_failed/ContentLoadError/FileEditorPane/Feedback/formatErrorDetails当前定义、调用、en/zh和07合同完成，唯一load_failed渲染调用。UI错误state是呈现/交互，不新增组件/DOM（Document Object Model，文档对象模型）/源码文案自动化测试；类型/build/docs只能局部验证，必须真实页面。Root项目文件Source detail与title相同可能冗余，只有真实before印证才限定取消相同次级文字，不改变身份/Tooltip/actions/有不同path的221布局。

## 实施前方案

先准备成熟归档工具，再fresh NativeService R=C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-09/file-read-recovery-222-before-01、18146、B/file-read-recovery-222/before-01，builtin Base累计12、固定600000ms不延长。完整授权OpenAI entry/相邻models配对，分别usable/projected/actualgpt-6.1-sol stream200/EOF后才UI普通Code/Chat，请只read该fresh项目CLI（Command Line Interface，命令行接口）正常生成的README前12行/简述标题，不增加源、写文件或agent。原Models/Auth内容不进prompt/log/spec/Git，成熟内存redaction归档。

真实Source/回答自然完成后，把且仅把该新scope自己README从已核对Run.project移到同Run.quarantine保留，绝对边界与owner绑定receipt先落盘，单文件Move而非delete/递归清理；这不触及用户仓库/用户项目/原221文件。自己UI真实Source click→真实File GET404、截图人工查看，原错误保留。正常sole shutdown/原foreground/Native0/物理-output-request/独立birth/port/pair闭合。

按实证补分析后改唯一UI loadFailure/SharedFeedback title-hint/details/Retry调用既有reload，en/zh同面；若实际同目录Source重复标题/路径，再限定仅detail()与label()相同时省略次级行。types/build/docs后原before完整readonly（只读）Config/terminal/lease/恢复/Project GC（Garbage Collection，垃圾回收）前沿、全90表逐行相同副本保留原Project/Session/Source/文件路径，fresh18147 after固定900000ms。原README保持quarantine以先验404，实际Details/再次Retry404保留最新请求，按同一receipt把自己文件移回原路径，再真实Retry成功/准确原正文与range/Source返回截图。源文件移动与恢复造成的明确预期Project inventory差异须独立解释，不能用相同count/hash伪称整个属性未变。

结束全部自有页面/public shutdown/Native0与freshOS（Operating System，操作系统）/port/pair完整；独立13表完整行相同、README完整实际bytes/原路径恢复和源Project其他变化核对，原失败保留。FFI（Foreign Function Interface，外部函数接口）自己5文件在全部观察结束按实际birth/精确workspace界限单文件归档。spec/root/月/B/架构索引同步，docs，范围提交、fetch/merge upstream、完整待推送集合复核、正常hook/push。持续goal active；不是child流式/全Source矩阵完成。

## 当前修改前实证与准入

真实paired预检usable/projected/actualgpt-6.1-sol streaming200/EOF后，IAB41 currentmain-BXbA1aB2的Code/Chat自然产生ses_-zUSTrjVszzh1W8zdo6P/msg_g0VXW8GkR00fQrjb9eIA与唯一真实README source-file。CLI生成README只有1行，完整读取无range字段，不发明1–12引用选择。[原Source](file-read-recovery-222/before-01/original-source-visible.jpg)亲自查看，叶片可见README.md两次，detail/label确实相同。

绑定新Run.owner/project/occurrence，绝对源/同Run.quarantine边界与原完整46bytes receipt先保存，再唯一单文件Move。用户仓库及221原文件没有操作。真实Source button激活GET file/content404，[原失败](file-read-recovery-222/before-01/raw-read-failure.jpg)/[原事实](file-read-recovery-222/before-01/raw-read-failure.json)亲自查看，仅长API/path/message，无主区域Details/Retry。自己的41关，正常公共闭合保留原真实Provider/native资格。

据此准入唯一nullable loadFailure原cause+SharedFeedback短title/hint/完整formatErrorDetails/既有reload动作；初始失败后Retry仍失败更新同一loadFailure最新cause，loaded draft reload失败保留原footer策略，不改变generation/target/authority/leave保护。Source.file次级文字只在detail()!=label()时展示，移除刚确认的重复；不同路径的221行为保持，不以标题碰撞改变数据。完整实际新页面/404 Details/重复Retry/原文件恢复成功才交付。

## 首次after真实诊断溢出与修正

42/18147真实新main-B6wz42Br有简短hint/Retry和Source单行；Details真实HTTP GET404/Request ID dc641b9f…及完整FileNotFoundError body保留，Retry404后更新为0ec553bf…，没有第二footer。原截图/观察保留。但真实wheel不能看到底部响应：[布局事实](file-read-recovery-222/after-01/details-overflow-original.json)显示file-editor-pane height635/overflowhidden、body599、Feedback754/min-height:auto/overflowvisible，末尾诊断超出panel且没有scroll owner。[原截图](file-read-recovery-222/after-01/details-overflow-original.jpg)亲自查看，不能称完整视觉诊断或恢复已通过。

直接根因为Feedback作为该固定高度flex body的子项仍保留auto最小高度；通用Feedback在可滚动父容器不承担panel滚动，新file局部placement遗漏约束。准入仅现有file-editor-load-feedback加min-height:0、overflow-y:auto、overscroll-behavior:contain，使同一个错误region按当前body高度收缩并承接native wheel，不改全局Feedback/formatter/Source/action/data，避免双滚动区。原42已关/原scope完整正常闭合后新fresh after02/18148固定15分钟，不延长或重启原scope，freshSource前沿/90表copy不省略。新页必须真实Details底部wheel可读、Retry新cause、归还原README后同一Retry成功/Source返回，才能交付。

## 最终完成核对

43新main-C66LIH6m原生wheel到完整响应末尾、Retry404新requestID、原46bytes逐字节确认并归还原路径后同一Retry200/准确原正文/Source返回均实际截图人工查看。首轮overflow与原404/类型tone错误保留，按事实修复；原Source无range，不猜1–12。两after13表完整行相同，主Project明确README恢复+根mtime变化/其他原属性相同，Anonymous44无变化。三Native/原foreground均正常0/full cleanup，全部自己页关/用户23未动，完整pair清理。详细[结果](file-read-recovery-222/README.md)，持续单agentgoal active，更多矩阵如实未验。
