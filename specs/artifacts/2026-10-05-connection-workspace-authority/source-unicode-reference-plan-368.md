# 368 Unicode行内文件引用

## Recall

用户持续要求自主改善Sources/UI/功能并明确只用单agent。367提交f51c1ba9d72cdfc8e0794f3a6557a566e5d16861统一原列Source/SDK/workbench/正文范围映射；55聚焦非UI测试、13人工实页图、8/8类型、构建和文档通过。原10710验收exit1：固定累计12请求耗尽使Side最后文字失败；12实际Sol EOF、9实际Source和Native267121ms物理/输出/请求/配对闭合通过，不将原失败重写为成功；所有367页面/运行者结束。正常push94508正在等待返回，当前工作区clean，确认推送结果后才改生产。

新问题来自367/05真实模型回复与截图：`资料/列定位/同一长行.md:1:2542`被显示为普通code，没有data-file-path；点击仍停第二处5054。随后实际Markdown链接同一目标能够正确到2542，故不是file-reference列解析、源文件读取或编辑器问题。

已读367 Recall/代码/实际canonical与05图、markdown.ts完整codespan/link及extractFileReference/markdownProjectFileReference、file-reference、main.tsx两种委托、workspace两种打开/本地workbench/Native路由，架构07-panel及266/267/268历史决定。全仓搜索同定义/FILE_EXT_RE/属性/ASCII语法、当前tests文件清单；只有markdown.ts单一codespan实现，其他skill manager语法是无关仓库名。file-reference纯data测试保留；检索到的当前路径无renderer/DOM/UI自动化测试，没有复制或恢复历史测试。Native IDE未验不外推。

## 根因、影响与设计

直接触发是extractFileReference对pathPart应用仅含`\w`的token白名单，JavaScript该类只涵盖ASCII字母数字下划线。之前266解决裸basename误链接、268解决rooted Windows盘符，明确未覆盖Unicode；中文路径因中间guard失败，虽后续相对路径/已知扩展/行号条件都满足，也无法形成实际链接。显式Markdown路径已有独立的作者目标判断，结构化Source也已携带规范路径；不合并这些不同语义，不按Source反查、不自动读文件猜测。

在当前唯一codespan guard以Unicode属性类Letter/Number/Mark和下划线替换ASCII word类，启用u模式，其余现有路径标点、rooted Windows前缀及路径/扩展/行号条件不变。保留原Unicode序列，不NFC/NFD规范化或猜目录；组合字符文件名必须按磁盘原字符进入现属性/委托。此项支持文字类文件名，不宣称任意符号/emoji/空格命令都自动成为路径。显式Markdown与Sources仍沿已有合同。无需新公共API、配置、持久化或模型协议，不触及调度/队列/恢复；若发现其异常立即横向审计。

[MDN官方Unicode属性类说明](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Unicode_character_class_escape)确认word类与Unicode Letter/Number属性范围不同，属性转义需Unicode-aware模式。使用成熟语言特性，无自造字符表；Markup逃逸、URL/命令/裸文件名语义仍由同一现renderer负责。

风险是Unicode组合序列原路径、同名不同规范形式、行列保留和现ASCII/Windows路径语义。真实Main中引用中文、分解重音、日文+非ASCII数字及ASCII控制文件，并在Side验证同一中文引用和来源；重复打开及明确相对/绝对路径须对应真实文件。纯UI renderer更改只做真实页面手动交互/截图复核，无源码文案、DOM、组件、快照或Playwright测试。type/build/doc检查只提供结构资格。

## 验收与交付计划

367/05为原当前版本的失败基线。新scope source-unicode-reference-368/18369使用正常dev/ui与固定600000ms NativeService，预先声明12累计请求；只一轮Main实际搜索+自然代码引用，一轮Side实际搜索+自然代码引用，减少不必要模型轮次，不重开367或改变其原结论。auth/models按授权成对私有暂存，启动请求前分别验证usable/projected/actual gpt-6.1-sol streaming；完整原作者文件及真实消息/Source保持。手动观察每个正文链接并点击原文件位置，对比结构化Source；查看图后必要时调整再截，不能数据checker冒充视觉。

唯一页面关闭、原shutdown与launcher actualjoin、Native/output/request/port/pair闭合；归档真实canonical、生产ToolOutcome、Provider/HTTP/原文件、所有失败和人工截图。真实checker只核对数据合同。若仍耗尽预算则原失败保留，不扩期或后改预算。同步spec根/目录/月索引，跑当前docs检查，范围commit、fresh fetch/merge、完整待推集合审查后正常push；不branch/worktree/tag/release。原359首次复制未知保留，goal active。

367 normal push原94508 exit0，全部mandatory hooks通过，结束HEAD/upstream f51c1ba9d一致0/0，工作区clean；此后才实施368。

## 实施与验证

唯一markdown guard已按方案替换Unicode属性类，原路径字符/配置/导航/权限保持。overlay type原91688 exit0，正式build原4696 exit0 52.41s/main-aBfB0VSj.js；UI纯修改无UI测试。367已提交/push且0ahead0behind之后才动生产。

独立18369/page187真实Main search MATCH368获得4Source并最终输出五个原字符codespan；四文件所有内容字节准确。Main中文、分解重音、日文+阿拉伯数字、ASCII文件名、Windows绝对路径原2:10打开通过。日文换行链接初次locator点击落Conversation、未改文件，保留04；总bounds覆盖两行空白，仅可作为工具落点线索，随后实际可见文字直接点击成功05，不伪称首次均通过。Side实际检索MATCH368_中文并完整stop回复，代码引用及Source分别打开2:10；隐藏重开组合字符成功。全部11图人工复核，未加入UI断言。

原9Source（含继承4）/模型最终文本/生产ToolOutcome/原文件完整字节与身份由真实checker核对；9实际gpt-6.1-sol HTTP200流式EOF、exhausted=false。页面关闭→唯一shutdown exit0→原91532真实join exit0，Native221188ms内physical/output/request闭合和配对删除，完整NativeService qualification。没有重开367或修改其失败事实。所有运行者/观察器结束后精确自身5 pile归档；源码和spec完成范围提交/上游同步前执行docs与architecture检查。其他平台Native IDE/空格emoji命令语法不外推。
