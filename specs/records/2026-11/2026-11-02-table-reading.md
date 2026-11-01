# Markdown 表格与窄文件面板阅读

## Recall

用户要求持续自主改善完整UI（User Interface，用户界面）和功能，实际体验验证后提交推送，不操作正在使用的窗口。后续多次明确只用本人一个agent，覆盖旧Goal中的三个Astra表述。上一轮b6a137f3a已正常推送且fresh fetch后main为0/0：Sources聚合布局、友好操作名称、14个真实Sol请求及13张截图构成实际进展。本轮继续875图09中真实生成reference-notes.md在窄文件面板里英文题名竖排、用途列被挤到右侧的问题，不重做已通过的闪烁修复。

开始时177条无关媒体删除/索引及未跟踪目录保留，无产品源文件改动。已读AGENTS、875 Recall/结果、当前07-panel文件与原生Markdown表格合同、FileEditorPane/StaticTextPart/Marked表格renderer、markdown.css/workspace.css和122历史方案。全仓定义/调用搜索覆盖共享表格样式、同步与worker Markdown、主/侧/成员、Document/Notebook/Presentation、架构/设置说明。第一次历史检索过宽并命中大体量归档日志，已以原句柄确认退出，后续只读明确Markdown规格与当前代码，不把被截断日志当作证据。

## 修改前调查与影响面

- 观察：875实际模型产出的3列文档在380px右面板中，英文题名被压成多行，长URL占据大部分列宽，用途列需要横向查找。是否涉及当前布局的列分配或继承仍需本轮真实页面计算样式与截图，不能从截图猜最终规则。
- 数据/显示流：FileEditorPane当前draft→StaticTextPart→共享异步Markdown owner→同一Marked原生table；renderer仅增加tabindex=0，保留thead/tbody/对齐/链接。共享markdown.css使用display:block、width:max-content、max-width:100%、overflow-x:auto、normal换行；表头keep-all。文件面板仅负责局部滚动/padding，无独立表格数据源。
- 旧路径：122已解决强制100%宽度与任意字断行破坏ID的问题，并补键盘访问，本轮不能退回强制压窄、nowrap全部正文、隐藏列或改写URL。122当时侧栏窄表格接受结果不证明875实际长URL/英文题名组合可读。需要重查实际匿名表格布局和列宽。
- 影响范围：同一原生表格规则覆盖主/侧/成员文本、文件Preview、文档/Notebook/Presentation Markdown及静态说明；交互式Table artifact、用量表、源码编辑器和Sources不是该规则的替代实现。不改schema（结构）/原文/draft保存/链接目标/模型工具/调度/消息协议，不产生非UI公共契约变更。若出现调度或恢复异常，按共享机制全入口横审。
- 测试调查：检索到artifact-table.test.ts为交互表格的纯标量格式化/字面搜索数据合同，没有DOM、组件、页面、快照或源码文案读取；与本轮原生Markdown表格无关，不运行不修改。禁止UI自动化；真实CLI `/ui/`、本人手动交互/原图视觉复核为验收依据。CSS改动仍需样式与构建检查，不能代替视觉。
- 权威参考：已读[MDN overflow-wrap](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow-wrap)及[MDN table-layout](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/table-layout)。前者区分normal、anywhere与break-word对内在最小宽度的作用；后者说明列宽算法由table-layout决定。具体产品取舍须以原页面测量和视觉结果为准。

## 首次资源、方案与验收

先启动当前已交付875构建的独立before页面，读取原真实生成文件及本人新建、明确合成的短表/宽表阅读材料；再完成根因和精确实现方案，落盘后才改产品。before/after首次各0个Provider请求，共用首次prepare前声明60分钟绝对截止、至少5分钟正常闭合余量；不启动新模型任务、不提高live额度、不重启旧occurrence（执行轮次）、不延长截止。原已完成Sol材料继续读真实文件，不把本轮0请求说成新模型验收。启动如配对复制认证和完整目录，仅为现有身份投影，分别验证来源与模型，凭据不进入产物。

来源为已闭合合格875-after（schema9/92表、255244结果行、累计1249请求）；实际项目与附件数量在准备时读取。保护全部原行、项目文件/Git和附件命名空间，不触碰真实用户DB。两阶段均须原native句柄0、public shutdown200、精确出生身份与物理/输出/请求结清、认证和目录副本退休及完整数据资格。原生table应保持完整列/标题/URL/ID/对齐，窄处可读、宽处自然布局，鼠标及键盘横向到达末列，正文纵向阅读与Sources可用；中英产品控件实页复核，不修改用户原文语言。

最终方案尚待before实测；当前不修改产品。新增spec同步根和月度/产物三个索引，运行现有docs:check。交付使用当前main范围提交、fresh fetch/普通merge、完整待推送集合复核与正常hook推送，不创建分支/worktree/发布。持续Goal保持active。

## Before实测与实施方案（产品修改前）

原Sol文件实际table为display:block，client354/scroll435、tabindex0，三列66.25/240.48/127.28px，正文行约101px。同页普通URL在normal换行下决定240px内在最小列宽，其余列退至最长单词/表头的最小宽度；不是当前字断行继承失效。本人短表只有153px且内容正常，长网址材料的用途列仅47px，正文一行两字、表高305px；长ID材料列47/357/47px，完整ID保留但说明列同样挤压，图01–03已实际查看。仅增加横向滚动未给正文列可读宽度，故旧122路径对这些内容组合不够。

实施只修改共享markdown.css原生表格owner：单元格min-inline-size设12ch，保留内容决定的更宽列，并统一顶端对齐；这是当前字体对应的阅读下限，不是按列数/页面/模型内容分支的固定列宽。普通表格链接使用overflow-wrap:anywhere，使长URL不再独占内在最小宽度；排除code内的链接并让code保留normal换行，原标识继续使用完整内容和局部横滚。表头keep-all、原table滚动/焦点边框/renderer/结构/对齐/链接字节不变，不用nowrap所有正文、固定table-layout、隐藏列或新wrapper/parser。同步07-panel的同一合同。

原before正常闭合和资格后才修改/构建。after必须实际检查：原Sol文件每列、短表、长链接表、原始ID旁正文、8列宽表末列；宽/窄桌面面板、Preview/Source切换、原生水平键盘滚动、复制/打开准确链接、原文档纵向阅读及主会话Sources。若12ch导致短表或其他正文可读性变差，须按实际像素重新分析，不以尺寸数字代替通过。

## 第一次after与列对齐根因（补充修改前）

真实文件在354px表格中变为104.23/109.28/139.48px，scroll=client、两行约65px，图04/08可完整读三列；宽面板及中英文、Source/Preview、实际下载412字符原文和准确链接打开通过。合成短表271px仍在面板内；长URL表高度从305降164px，ID旁说明列从47增90px，code保持normal。第一次after虽改善阅读，但不能验收通过：图09及实际属性明确显示Markdown数量列align=right、状态列align=center，而全部计算text-align仍为left。

定义与旧路径：同一Marked原renderer已正确保留align属性，直接触发点是markdown.css共享单元格默认text-align:left覆盖HTML列的表现属性；早期md-content规则也重复该默认。这与模型、文件内容或本轮新增min-width无关，是现有共享显示合同遗漏。调用/数据/风险仍是前述全部原生Markdown消费者，不触及Table artifact、持久数据或非UI公共契约。

补充方案：在同一个原生单元格owner删除重复默认，把默认左对齐限定于没有align属性的单元格，让现有原生right/center/left属性按浏览器标准生效；不重写renderer/HTML，不从正文猜列类型或按“数量”关键词分支。实际重新核对表头与正文left/right/center、数字和末列。原第一次after须正常闭合/资格且保留失败原图，新的alignment-after使用新occurrence和端口38569、首次0请求、原同一60分钟截止，不重启/改额旧实例或延长时限。后测最终结果不能倒填第一次after。

## 最终实施、实页验收与边界

当前实现只有共享markdown.css原生单元格规则：12ch阅读下限、普通链接换行、code保真、顶端对齐、默认左对齐仅作用于未声明align的单元格。重复的md-content对齐已并入同一owner；Marked renderer、消息/文件/模型/路由与数据schema均未修改。07-panel已同步该唯一合同。

21张原图逐张人工查看。原真实Sol文档在最终新构建中三列104.23/109.28/139.48px、scroll=client354；Source/Preview及下载412字符原文、点击CSV准确原网址并核对官方标题均完成（下载/链接在第一次after，最终仅补对齐CSS且原文件完整保护）。短表271px正常容纳；最终表头和正文left/native-right/native-center实页有效，首次失败的left状态没有倒填。原生Tab从Preview按钮经阅读区域到TABLE，15次真实右键到八列表格577px末端、显示末列876-A/B；Tab离开TABLE，指针横滚回0。长ID方向键到184px末端，code仍normal，旁列说明可读。中英与381/473px桌面面板已复核。

额外真实历史覆盖：874主对话原责任人表181px，数量3/3/2右对齐；801已完成Task的原base-tester会话只读打开，338px视口/423px完整表，指针到85px末端查看完整长代码和正文。均未启动新agent/模型请求。最终中文页面同时展示真实Markdown表格、两网页来源展开；复制JSON来源得到准确原URL，未改来源顺序或目标。只读库调查找到了真实既有Markdown表格，用于选择这些现存界面，没有伪造消息或改写历史。

闭合资格：before原255244→255249行，首次after255249→255251，最终255251→255253；schema9/92表，原97/98/98项目业务文件与Git、227附件、所有旧业务行和来源DB均保留，无文件系统豁免。原exec句柄18414/93754/77889各正常exit0/public shutdown200，出生身份、物理进程、输出和请求结清；6个配对副本退休，原来源认证/目录未变化。三阶段均0请求，累计既有真实请求仍1249，首次截止保持原值，最终尚余约33分钟。

实际Node两次构建与两次本地化/样式/docs检查均exit0。聚焦检索overlay/test中的renderMarkdown/md-content/msg-text/table-layout无结果；没有新增、修改或运行UI自动化。纯CSS显示改动未新增非UI单元测试。详见[原图/动作/非敏感资格](../../artifacts/2026-11-02-table-reading/README.md)。本轮未验证移动端，也未将整个产品的持续迭代标为完成；长代码和真正宽表继续使用原生局部横滚保存所有列和字符。
