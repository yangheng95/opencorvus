# 291 Sources 跨对话阅读返回

## Recall

用户要求持续自主体验/修复Sources显示、侧栏Rendering和整体功能，最新明确只用单agent，覆盖旧goal中的多agent文字。当前仅root，不委托或创建成员。上一轮290为进展：6585ed019已推送，开始工作区干净，历史Diff读入口及双栏可访问/暗色/语言真实通过；原一次Provider网络失败继续保留。整体goal active，不能按单批通过完成目标。

已读290 Recall/实际结果、SourceParts完整代码、conversation-ui状态与全部调用、messages来源样式、07-panel来源/阅读公开合同，259/260/241/238原来源资格与截图说明。现来源标题、域名和摘录内容来自真实parts，不制造UI夹具、模型消息、数据库事实或来源数据。检索使用rg并按Windows实际路径处理，首次通配目录路径错误只是检索方式错误，未当产品缺陷。

## 本轮问题深度与待证实项

sourceExcerptPositions由唯一conversation-ui store持有，SourceExcerptBody按API authority revision加type/session/message/sourceId定位，真实滚动记录并在挂载/布局恢复。loadConversationUiStateForTask与clearConversationUiState在primary切换时均清空摘录位置；主正文mainReadingPositions则跨primary保留。来源组/摘录展开状态已按task存储，故可能出现返回时仍展开但内容回到开头的割裂体验。当前这是完整控制流线索，先实际复现，不把代码猜测当可见故障。

影响面是Main/Side/子会话共用SourceEntry和当前UI store，所有reader调用、primary/API切换边界、状态上限、已有生命周期与样式需一同核对。权限、Provider、Source存储、URL/文件身份和模型调用合同暂不改。没有现有调度/队列/恢复/终态异常；若运行中出现必须立即横审共享入口/轮次/恢复/隔离后处理。副本的完整当前恢复前沿与物理闭合须另行准入。

## 真实页面方案

原238已关闭真实Main ses_-zUSRNG7gzzHK6lCxuV4、Side ses_-zUSRMeqOzzMIcHtNUpl、Project prj_hbX7wQvlJTJuJSGHqBov；五条MDN来源有5211/266/2625/6057/957字符的原snippet。原数据早期退出及Side actor drift失败保留，不改旧事实。新source-return-291-history-01、正常dev/ui18242，完整90表当前内容复制，无auth/models或Provider请求，无新Task/成员；自己的隔离页面，用户18107/原23页不动。固定900000ms，目标至少300000ms收尾余量，唯一shutdown/原前台join/独立closure/完整19表与生命周期保管，所有checker结束后精确保管自产物。

真实展开Sources和长摘录，键盘End/PageUp到明确原文段落，再切到已有另一普通对话并返回，观察展开状态、可见内容和焦点/滚动。进一步检查来源组折叠重开、Side引用阅读与当前语言（按剩余预算）。只以本人真实页面截图判断UI，通过只读DOM几何解释现象；不新增/运行UI自动化、源码/DOM/组件断言、快照或截图循环。

若复现，先补完整根因、现旧路径原因、唯一现状态策略与风险，再改同一个store/调用链，保留API和Source身份隔离及有界内存。当前原生界面设计可迭代，但不预先制造新能力/平行缓存。若无新问题，明确记录范围证据并继续，不能虚构修复。后续正常类型/构建、实际新页面复核、docs/architecture检查、索引、范围commit及fetch/merge/完整待推送审核/普通push，持续目标保持active。

## 真实复现与唯一修复设计

history-01当前18242/tab32，03实际长摘录在.button CSS段落，top2016/height287/total2553。切到原另一个Project的Reply with OK.再返回，04是未加载中间画面，不算终态；05已加载后Sources原生details.open=false、摘录body已卸载，原位置附近变为后续正文。重新展开group/excerpt后DOM top0；06截图仍在展开过渡帧，不能把它称为完整顶部视觉证据。丢失分组/摘录展开已由05真实页面与实际details属性直接证实，原2016阅读位置已由03截图证实。

进一步全仓检查：Task选择调用loadConversationUiStateForTask从localStorage恢复expandedCards，却清空摘录/Side位置；普通Session及Mission入口直接clearConversationUiState，所以连展开都丢失。旧store是单个当前Task工作区，Main自身另有按API/source保留的有界读位，Sources已在共享component层修复折叠重开，但其上层primary边界仍无跨对话持有者，这是前轮局部返回测试未根治的原因。生产调用仅task.ts、conversation-session.ts、main.tsx Mission和workspace.ts清空边界；全仓没有这几个store接口的UI测试，也没有conversationUiStore外部读取者。runtime/模型/调度/数据库不改；本例19受保护表和19生命周期值完整相等，没有后台恢复异常。

把当前单个presentation record替换成同一个store内按API revision、source.kind/id索引的有界conversation records；所有现有card/disclosure/excerpt/Side读位接口直接读写当前record，不保留另一份活动拷贝或平行缓存。普通Session、Task、Mission同步选择同一个当前source入口，空workspace仅解除当前选中。原50对话、每类200条UI记录上限沿用并统一命名；对话按最近访问顺序驱逐；各展示字段沿有界键集合裁剪，不声称精确的最近使用条目排序。主正文自己的阅读接口和事实不变。

现折叠状态仍只经同一localStorage序列化，持久key限定server URL/source kind/id；volatile记录再限定API revision。旧仅Task ID的折叠key不再读取，没有兼容回退或双写，首次升级该小型展示偏好会从默认开始；旧条目按现有50项索引正常淘汰，不改用户消息或文件。切换前同步flush，沿原400ms保存节奏避免快速导航丢选择。API旧revision的瞬时阅读record不被新authority选中，失效项受同一上限驱逐。用户已授权范围内迭代无需额外确认。

所有三个选择入口在原同步batch内选定presentation与board source，避免旧树观察到新对话状态的中间帧。SourceExcerpt现authority/epoch/identity guard、原生滚动/恢复、正文内容和Sources顺序不改。需实际验证同源返回、跨Project空白对照会话保持其自身状态、group折叠恢复、Side引用及语言/Settings返回；超出实际覆盖的Task/Mission/跨API/重启宽矩阵如实留待后续。UI store属于展示层，按硬约束不写自动化UI状态测试，以真实页面为验收。

## 最终结果

history-02正常18243/tab33/main-B_9-ur-u.js：稳定02→04为Main同一CSS段落和top2016，跨Project普通对话返回保留Sources/摘录展开；05组重开保持。06→08是已有Side 1 Reference历史与Sources摘录top3108保持，Main与Side位置独立。07切回Main时Dock按原导航行为关闭，点击Side后08才是实际侧聊验收。Reference标题getByLabel未匹配，按现DOM的精确文本定位成功；不把工具定位错误算产品问题。

build47926实际0/51.79s，type23864实际0。原前台8628/67619及Native分别actual0，固定预算余711617/648371ms，自己页面关闭、19表/19生命周期完整值及原Project文件元数据保管actual0。首次PowerShell余量展示因默认DateKind转换而有时区/毫秒误差，已用原JSON字符串正确计算，未改实际deadline。两阶段checker完成后精确保管自己五产物。

已全仓核对所有card/disclosure接口使用者，包括Task Goals/Requirements当前作用域；未引入空作用域的备用store。Task/Mission独立UI、跨API/重启、满容量裁剪、中文切换、原ResearchStudio新实时子Dock/全帧Rendering仍未逐项验收。明确旧Task裸ID的折叠偏好升级后从默认开始，不做兼容双源。完整证据见source-return-291/README.md；文档检查/扫描/范围提交/普通推送后继续，goal active。
