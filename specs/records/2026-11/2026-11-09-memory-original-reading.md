# 长篇记忆原文的键盘阅读与选择

## Recall

用户持续批次迭代至明确停止，最新明确不用子agent；本人独立。前批3af7a99f6已正常push全部hook通过、HEAD/upstream0/0，原177条工作区状态精确保持。根因/影响先落盘，真实前态后才实施、本人真实桌面开发/ui交互截图、聚焦正向检查、范围提交/fetch普通merge/全待推审查/正常push后继续。Sol/凭据授权仍未获新答复，不重复问、不读认证或模型目录，不进行模型调用。

已读MemoryPanel完整展开/单文件身份/详情原文pre、MemoryContextPanel唯一调用、现07-panel/07-panel-reactivity/02-data、settings.css全部memory-detail基础/compact规则、cascade/base的body user-select与根reset、现focus样式primitive（基础组件）及token（设计变量）、main中End只处理独立dock resize的调用边界。未知路径先rg --files；一次只读rg传Windows通配路径失败，已通过实际文件清单纠正，无产品影响。全仓未见原pre的tabIndex/role/名称或局部选择覆盖；本轮不新增或运行UI（User Interface，用户界面）自动化。

技术决策查阅以下权威当前资料（不是运行其自动化测试）：[W3C（World Wide Web Consortium，万维网联盟）滚动区域键盘可达规则](https://www.w3.org/WAI/standards-guidelines/act/rules/0ssw9k/)、[Chrome原生滚动容器焦点说明](https://developer.chrome.com/blog/keyboard-focusable-scrollers)、[MDN（Mozilla Developer Network，Mozilla开发文档）region角色](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/region_role)。资料指出部分浏览器可自动Tab到scroller，故不能凭未写tabIndex判定本浏览器不可用；命名region须有描述性名称，且仅用于重要阅读区域，避免无意义landmark过多。本组件同一时刻只展开一个真实文件，前批已修唯一文件投影。

## 修改前根因与影响分析

当前原文pre最大400px/overflow-y:auto，只有class和原始文字，没有明确focus/命名契约。浏览器实际是否自动Tab到它、End/PageDown是否滚动内部未知，须真实长文体验。若本浏览器已有原生键盘滚动，明确记录通过，禁止虚报键盘阻塞；可按当前缺少命名的事实提供稳定本地化原文阅读区域，而不是重复实现滚动或键盘处理。

另一相关疑点：全局body为原应用chrome禁用user-select，原文pre没有局部user-select:text覆盖；可观察后果可能是原记忆内容无法原生选取。此为原文阅读/复用的产品行为，不修改用户剪贴板或伪造选择状态。需在自己页面实际指针选择/截图，并以原computed CSS辅助解释；空selection本身不能证明问题，必须核对指针确实落在实际文字、原选择策略以及改后相同原文选择成功。若未能真实操作，则标未知，不把静态CSS当视觉资格。

条件方案：在确认当前事实后，使原pre成为单一稳定tabIndex=0的命名阅读region，名称经现语言目录包含原真实file标题；用现token提供focus-visible，必要在该原文区域恢复原生user-select:text与webkit声明。原浏览器承担Tab/Arrow/PageDown/Home/End和指针选择，不新增JS（JavaScript，脚本语言）键盘路由、滚动状态、复制按钮、剪贴板读写或文档副本。明确一个短原文也可有一个可读Tab位置；不增加ResizeObserver/长度猜测来维护第二focus state。若原交互/名称均已正确，则排除疑点，不为符合方案修改产品。

直接影响为一个当前展开文件的原文pre、键盘焦点和原生滚动、选择/无障碍名称/当前语言，布局密度与400px原边界保留；源正文/文件title/日期/source原事实保持，不翻译或截断。全仓该class仅此MemoryPanel与现CSS。原单文件展开/详情ID、查询/项目scope/文件动作/删除确认路径保持；Tab会经过原Delete按钮但本轮不执行删除。无公共API（Application Programming Interface，应用接口）/SDK（Software Development Kit，软件开发工具包）/schema/持久格式、模型流式、调度/队列/唤醒/终态变化，无迁移。现未观察相关执行机制异常。

风险包括误把浏览器已支持功能说成故障、多region淹没导航、从title翻译改变原文、焦点样式被裁剪、手写滚动拦截原快捷键、为选择改全局用户交互/读取私人剪贴板。单一展开区域加当前语言+原标题、局部现token focus边界和原生输入避免上述扩展；不使用系统剪贴板、不更改用户浏览器/IME（Input Method Editor，输入法）设置或窗口。

## 验收方案（修改前）

Temp b44 before/after各一个真实Git项目、独立profile、私有Git身份/禁签/autocrlf=false及原notes/HEAD seed。原Memory.writeFile写一份确定性60行长原文和后继短note，不创建Session/消息或模型输出、不调Provider/embedding。before39008开发/ui实际展开长文，观察原生Tab顺序/焦点、键盘滚动和区域名称，截图首尾；只读DOM（Document Object Model，文档对象模型）布局/焦点/选择可解释真实交互，不作自动化断言。按新截图中实际文字位置用指针选择（若CUA能力支持），不注入selection/事件或读取系统剪贴板。确认根因/能力边界并补落盘后才改产品。

after39009真实/ui使用同一类原生操作，Tab进入当前语言+原file标题的阅读区域，有明确focus外观，PageDown/End到后段/最后第60行、Home回首段；指针可原生选取原文（若已取得真实可执行方式），原查询/展开/切语言名称同步，退出Tab到下个真实控件。必要补稳定截图，不以DOM或build代替视觉；未验证跨浏览器/屏幕阅读器实际朗读，不宣称全平台资格。所有UI验收仅手动真实页面，无组件/DOM/文案/快照/浏览器fixture自动化。

原TCP list/get与当前/doc schema、完整60行原文及两原file身份只证明未改后端集成；纯UI改动无UI测试。辅助typecheck/i18n/正常Node build/renderer/docs/架构。最终原Git字节/HEAD、原记忆身份/Project归属/内容/不可变创建时间保持，正常shutdown自己服务/原exec exit0、关闭自己页。只提交必要MemoryPanel/CSS/两语言/现架构/spec/artifacts/三个README本条，原177状态保留。无branch/worktree/tag/Release/用户进程窗口/凭据/剪贴板操作。Sol/完整模型权限/Task/Mission/Session执行恢复、未知历史错归属数据继续未验。

## 当前状态

已完成下述真实前态、原文选择修复/命名阅读改进及实际桌面复验。原浏览器键盘滚动本已通过，未虚报阻塞；跨浏览器/朗读及Sol/模型/权限/引擎执行仍未验。


## 真实前态与收敛方案

39008/IAB94由当前领域写入原60行长文与独立后继note，01实际pre clientHeight398/scrollHeight1175/scrollTop0。原生Tab从长文主按钮→原删除控件→pre成功，当前浏览器已自动聚焦该pre；没有tabIndex不等于本浏览器键盘失败。实际End内滚动至777/末第60行，03稳定截图证明；02为原生平滑滚动中间帧（32–51行），不当终点。Home回scrollTop0/首行，04稳定截图。原生键盘功能明确通过，不虚报修复不可达故障。

原pre没有role/aria-label，当前焦点无障碍说明是整段Line001…原文容器而非描述性当前文件名称。CSS实际computed userSelect=none，与全局body继承及无局部覆盖一致。根据04实际首行位置原生drag从[442,267]到[800,267]，05实图原文字未出现选择高亮。一个附加只读document.getSelection观察因CUA DOM facade不提供该函数失败；没有读取系统剪贴板或退向隐藏state，也不以该工具限制断言产品失败。真实drag已完成，05是其实际视觉结果；修复后必须用同类真实文字手势确认选择能力，不使用脚本设置Selection。

三个真实TCP list/get两file均HTTP200/current运行时/doc schema，原两file ID/标题及完整60行正文精确。before原session74467正常shutdown200/exit0/prompts0，自有页94关闭后才实施。

最终范围：键盘已支持，提供明确且稳定的命名原文region、显式原生tabIndex=0和现token focus-visible，保持原生键盘行为；局部pre恢复user-select:text及webkit对应声明，允许原文字选择。名称由当前语言+get返回的原真实file title提供，只有一个展开region，不创建隐藏/伪正文或第二滚动状态。无Copy按钮/剪贴板读写、JS快捷键/全局样式变更。新名称是可访问性功能改进，文本选择则修复被应用chrome全局策略误覆盖的原内容行为。


## 实施与实际复验

原pre现在role=region/tabIndex0，以现两语言memory.original_content_label包含原get文件title提供名称。局部user-select:text/-webkit-user-select:text修复原文继承应用chrome禁选，focus-visible使用现边框宽度/accent变量与内侧offset；无全局样式、额外滚动/焦点state、JS快捷键或剪贴板操作。源码/现架构和两语言单一目录同步，不复制正文或改数据。

39009/IAB95：原生Tab从Long原主按钮经过原删除控件到pre，06真实焦点说明Original memory content: Long original note、role=region/tabindex0、computed userSelect=text，实际蓝色app focus外观。原End仍由浏览器滚动，07稳定scrollTop777/client398/scrollHeight1175、末第60行；Home回0，08首段。原浏览器Before同样已能End/Home，改动不宣称新修键盘不可用。06–08及首段截图本人呈现查看。

在08实际首行位置执行与before完全相同原生drag [442,267]→[800,267]，09出现Line001原文的实际选择高亮；before05相同位置手势没有高亮，根因与原computed none一致。没有脚本创建Selection/写事件或读剪贴板；不依赖前态不支持的document.getSelection观察。选择后Tab实际到Following original note按钮，10有清晰焦点，原Long仍展开，未执行任何删除。切中文后真实区域名称记忆原文：Long original note，11该具名region可实际focus/Home，原内容/标题/展开保持。名字由原生无障碍树/实际焦点观察确认，截图绑定原区域；未启动屏幕阅读器，不冒充实际朗读验收。

11张原始截图本人全部呈现查看；02是before平滑滚动中间帧，不作稳定终点，03/07才是before/after末行证据。没有UI自动化、DOM/源码文案断言、组件/快照或截图基线；AX（Accessibility，可访问性）/CSS布局观察仅解释实际交互与画面。

before/after各三项实际HTTP list/get两file（合计6次）全部200/current运行时/doc/Ajv2020 schema，原两file ID/标题与全部60行正文精确。两Git项目原notes与seed/HEAD:notes.txt逐字节一致，两原HEAD相同；四个原记忆file身份/Project归属/title/source/kind/不可变创建时间/content完整保持，两DB各Project1/Session0/Message0/memory_file3/memory_chunk3（含host文档），config文件0。原正常生成未跟踪元数据如实记录，无清理。可变host文档时间不设跨读伪常量门槛。

## 检查与交付范围

Overlay typecheck、i18n2语言/2933键、正常Node build1m6s（main-Dxl2eBc2.js）及renderer公共面通过；docs352operations/26groups、架构索引20文档与精确diff提交前检查。纯UI改动无UI自动化或负向测试，未改后端故不无目标重复领域测试；实际HTTP仅原接口/持久内容集成烟测，不替代实页或模型端到端。无API/SDK/数据库结构/持久格式/迁移或模型流式变化。

原before74467与after30934均正常POST/shutdown200并消费原session exit0/prompts0；自己的页94/95关闭。after初次exec只返回profile，随后等待原session实际listening与receipt（pid3172）才开页面，未把普通启动等待报为执行机制异常。

范围只MemoryPanel、局部CSS、两语言单一键、当前07-panel、spec/artifacts及三个README本条，原177无关工作区状态保持；fetch普通merge/完整待推集合审核/正常push，以Git回执为准。无子agent、用户窗口/进程/设置/凭据/剪贴板操作，无branch/worktree/tag/Release/发布。资料来源见Recall；不把浏览器原生支持归为新功能，跨浏览器/屏幕阅读器朗读、Sol/Provider/权限/Task/Mission/Session执行恢复和未知用户历史数据仍未验。
