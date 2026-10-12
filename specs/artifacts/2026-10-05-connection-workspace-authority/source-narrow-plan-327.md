# 327 窄侧聊来源与分隔条修复

## Recall

用户要求持续深入体验并改进UI（User Interface，用户界面）、Sources和Rendering；最新明确单agent，覆盖旧goal多Astra委托措辞。326已正常推送`ec302b0d44337f747af78946692e17c4a5710bf7`，当前git status干净；上一轮属于progress，真实主会话已证明中文来源/编码分隔符/章节显示和原导航。

已重读326 Recall、307窄来源与312 Rendering记录、当前SideChatPanel消息/继承历史/读位/提交路径、side-chat连接投影、主应用Dock激活与键盘resize、来源组件与工作区样式、07-panel。默认Dock380px，可由真实resizer的End键达到已有最小宽度。Side使用与子成员共享的ConversationCard/CardParts/SourceParts，但不能用Side样本宣称Subagent专属路径或所有帧已验收。开发工作仍由root一人完成，不启动开发子agent或产品Task/worker。

## 调查问题和边界

326只验证宽主会话；当前中文查询变短后，在窄Dock里的换行、完整身份、Tooltip和流式期间读位仍缺当前截图证据。旧307验证旧来源显示，不能代替这次国际文字改变。现阶段没有已确认的新bug，不预设ellipsis/高度/布局补丁。

唯一来源数据继续由实际Tool与Source持久化拥有；显示由SourceParts、展开/读位由现conversation-ui与AutoScroll拥有，不注入Source、不建立平行存储或合成消息。当前不改接口、配置、模型规则、路由或测试。如出现调度、恢复、队列、并发或终态异常，按AGENTS立即共享机制横审，不能按Side局部现象降级。

## 实际验收计划

使用326已完成的正常构建main-CtFWsPuO.js，独立正常开发`/ui`18297，不无改动重建或单启Vite。授权auth与完整models成对复制并预检usable/projected/实际gpt-6.1-sol流式；NativeService固定600000ms、20请求上限。进入真实预检会话，打开一个普通Side chat，顺序真实读取326同一北京市API、双标题%7C查询、MDN参数章节。无委托、无文件修改、无额外报告，只简短收尾。

通过实际resizer键盘调整窄Dock；人工查看完整Source文字、站点、换行、Tooltip和来源点击。第二回合只用既有材料生成约3000字/10节中文正文，无新工具；生成期间上翻读来源，关闭重开Dock，再看读位与文字。截图和只读几何只证明观察时段，不能宣称全帧无闪烁。严格不新增或运行UI自动化、DOM/源码文案断言、组件/截图测试、浏览器fixture。

如果复现问题，先落盘现象、触发、数据/控制根因、旧路径遗漏、所有调用/契约/测试/文档影响和风险，再实施唯一修复、新构建及真实页面复核。若本次表现正确，保留边界证据，不制造代码改动。

操作结束尽快关闭自己的页与服务，原handle join、Native/Host物理和output/request收敛、18297及复制配对清理；只归档自己的Native生成文件，完整脱敏证据入specs。同步根/月/目录索引，docs与架构检查，范围提交、fetch/merge upstream、审阅完整待推送集合并正常push。持续goal active。

## 已观察结果及修复准入

live-01的280px真实Side能阅读三来源，长Tooltip跨出Dock但保持在视口内；后续正文增长期间上翻读Source，关闭重开及终态后scrollTop均为543.3333129882812。读取中高度从3242到6051再到6573，证明同一记录发生在内容继续增长中；仍仅限采样时段，不能宣称原Subagent全帧Rendering问题全解。初始两次滚动截图没有定位到Source，因此保留但不作为来源可读性证据。真正Source截图为04/05/06/08/09/10。一次Playwright checkbox名称查询未匹配实际DOM角色，改用原AX开关完成，属于操作定位而非产品失败。

同时确认真实缺陷：分隔条已通过End键把Dock调到280px，实际辅助访问树却持续报默认Value50；只读DOM确认aria-valuemin/max/now三属性均为空。App的右Dock分隔条只声明role/orientation/name/controls，main的renderRightDockWidth只写CSS，输入处理也不发布数值。全仓separator横审：左pane、设置侧栏与Composer都已有实际min/max/now投影，遗漏局限于这个生产RightDock owner。共享Tool、Side、Subagent、文件、浏览器面板都复用该RightDock，不能只给Side组件加属性。旧103修的是宽度上下界，没覆盖分隔条的辅助访问合同。

已读rightDock全部定义/调用、开关effect、zoom/sidebar effect、window resize、pointer/keyboard、CSS bounds、pane与ConfigDialog语义实现、当前架构及103历史；检索该分隔条未发现UI测试。参考[W3C Window Splitter](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/)的当前位置和上下界语义。仅修数值投影，保留已有指针、箭头、Home/End方向与宽度持久化，不声明对整个可选键盘模式的合规审计。

唯一修复：从原clampRightDockWidth抽出同一个bounds读取函数，clamp和ARIA（Accessible Rich Internet Applications，可访问富互联网应用）范围共同读取它；现renderRightDockWidth调度语义更新，基于已约束的真实Dock几何设置min/max/now。用一个ResizeObserver观察同一Dock及workspace尺寸变化，经既有animation-frame primitive合并，涵盖开关过渡、左栏布局、zoom、窗口变化；关闭时去掉范围属性，原aria-hidden/tabIndex/focus owner保持。observer与待执行frame在当前主应用dispose中清理，不增保存宽度、计时器、影子状态或UI全局接口。取值限制在同一合法范围，过渡帧不暴露非法的min>now。

live-01已关闭102/103，Native14432/Host63716正常物理/output/request结束，18297及复制配对清理；原2323 actual exit0，10次实际Sol流式请求正常EOF。之后才改生产代码。新构建与类型检查后用fresh live-02 `/ui`18298，同NativeService固定600000ms、12请求预算；预检后进入真实Side，人工验证箭头/End/Home的Dock宽度和辅助访问值、关闭重开、左栏切换对范围的影响，截图复核。只读几何辅助观察，不新增任何UI自动化断言。两轮独立范围、句柄与配对均需清理归档；本轮仍按原要求提交并正常推送。

## 实测后的同处命中区域修复

live-02键盘/关闭重开/导航变化已确认当前值与280/304/441/330像素、max441/722对应。实际从视觉分隔条右缘x839拖至900没有改变宽度；读取当前几何确认handle在x838且width1，改为x838拖至950后宽度330、aria-now330。这不是未知鼠标失败：工作区CSS已明确配置::after两侧各5px命中区域，却在父.right-dock-resizer上使用overflow:hidden将其裁掉。横向对照左pane-resizer同样已有±5px区域且没有这项裁剪；设置侧栏/Composer有自身可见宽度。根因及输入路径均限定于共享RightDock分隔条，不新增另一套拖动逻辑。

准入删除该父级overflow:hidden，复用已存在的命中区域，视觉线宽、布局宽度、层级、pointer handlers和关闭态pointer-events:none均保持。此为纯CSS（Cascading Style Sheets，层叠样式表）改动，无UI自动化。先完成正式构建，再仅刷新自己的tab104以读取新构建，使用同一已结束回复的真实Side数据，在距线数像素处实际拖动并截图。当前live-02 Native仍在原固定600000ms/12请求界内，不重启、不延长、不追加模型任务；若无法在原期限完成，正常关闭后另开fresh范围，不能伪称本轮通过。

## 完成后的 Recall

[完整结果](source-narrow-327/README.md)记录两项修复与真实页面：ARIA范围/实际宽度对应，原±5px命中区恢复，两侧线外拖动分别337和380，原Source可读；普通Side长回复生成中读位543.3333129882812保持。第一轮10请求、第二轮6请求均实际gpt-6.1-sol流式200/EOF。后一次CSS构建仅刷新自用104，恢复原Side，不追加请求或延长Native预算。

类型44906、构建56557/68311、原启动2323/39970均已join exit0；页面102/103/104关闭，Native14432/61236与Host63716/72040物理/output/request结束，18297/18298和auth/models配对清理。后台核对不读取/断言UI。剩余范围提交、fetch/merge/push；持续goal active，原子成员全帧Rendering尚无此轮资格。
