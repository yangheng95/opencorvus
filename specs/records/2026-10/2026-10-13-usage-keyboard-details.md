# 持续迭代第四批：用量时间桶的键盘详情

## Recall

用户要求持续按批次并行体验UI/UX（User Interface/User Experience，用户界面/用户体验）、调查功能和缺陷，直到明确停止；非简单修改前根因与影响分析落盘，实施后真实桌面交互与截图人工复核、聚焦正向功能合同、必要且授权的GPT-6.1 Sol验收、范围提交、fresh fetch/merge upstream与正常push，再进入下一批。

上一批1bd7c4978已交付。首次正常push的全部hook通过，但另一个并发push已将远端更新到同一1bd7；本轮重新fetch/merge后待推集合为空，正常push重试实际exit0、Everything up-to-date，HEAD=origin/main=1bd7c4978。没有发布、tag或版本改动。本批开始检查git status，保留其他任务file-alias、PDF、webfetch、Sources/recovery与共享索引/07-panel改动，不创建分支或工作树。

用户已授权并行调查。仅两个既有一层分工、禁止再次委托：UI分工只读审计热力图及现有primitive，功能分工只读检查官方统计。主agent重读上一批Recall、当前06-provider/07-panel合同、UsagePanel、usage.css、Listbox/Tooltip/TodoProgress、安装Kobalte0.13.11的selection/Listbox/Tooltip源码和公开类型。全仓搜索UsageActivityGrid/bucketLabel/usage-activity、Listbox/Tooltip与keyboardDelegate：唯一时间桶事实为/global/usage响应；唯一可视实现为UsagePanel私有ActivityGrid，没有其他热力图读写或周期配置。检索到turn-usage-projection.test.ts是纯Token聚合函数正向合同，不是UI自动化；本批范围未发现DOM/渲染/截图UI测试。

权威资料：[W3C Listbox](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/)说明单选项、单组焦点与Home/End；[W3C Grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)说明视觉方向导航与一个Tab入口；[Kobalte Tooltip](https://kobalte.dev/docs/core/components/tooltip/)与[polymorphism](https://kobalte.dev/docs/core/overview/polymorphism/)说明复用focus/hover/Escape、描述关联与组合组件。当前库公开KeyboardDelegate按视觉above/below/left/right计算目标，现有Listbox负责实际焦点和集合。采用Listbox的检查项语义，不把它伪装成缺少row契约的ARIA（Accessible Rich Internet Applications，可访问富互联网应用）grid。

## 现象、触发、根因与旧路径

主agent已实际启动独有`.tmp-codex-usage-grid-01a133/before`、18573生产listener/recovery与上一批私有前端快照，凭据环境清空、空真实账本、无模型调用。中文Today页面鼠标定位实际03:00桶，截图显示0与03:00；从刷新按钮按Tab，焦点直接跳到官方对账Disclosure并滚动，下方取得真实聚焦截图。所有24个零桶被跳过。基线页面已关闭、生产stop完成、原exec78045实际exit0。

直接触发：桶为不可聚焦span，专属CSS仅:hover显示aria-hidden浮层；外层role=img只有笼统图名，内部sr-only不能成为逐桶键盘交互。数据可见但没有可检查集合。旧鼠标视觉验收只覆盖外观，没有覆盖键盘读取；给每个桶tabIndex=0会把365/366个Tab停靠点引入年图，不能作为最终方案。

影响覆盖day/week/month/year、空/非零桶、正常及DST（Daylight Saving Time，夏令时）23/24/25小时与半小时末桶、年度七行列向布局、首尾非完整周、locale（语言地区）、刷新与切周期退休旧集合。桶必须以真实start标识，不能用翻译字符串作key或把前导空位当假数据。本批不改服务端窗口、账本、SDK（Software Development Kit，软件开发工具包）、费用或Provider接口。它不触及Task/Mission/Session调度、恢复、唤醒、队列或终态，没有此类新异常，明确排除这些机制。本批不使用真实管理密钥或模型验收。

分工发现三个官方统计独立候选：tokens:null/costUSD有效的partial费用被UI隐藏；OpenRouter负余额被费用formatter置空；Usage失败且Costs币种不支持时没有有效事实仍标partial。仅有源码与显式虚构env/Response的局部合同证据；没有真实官方/页面验收。无凭据隔离页面无法进入这些管理接口状态，记录未验收，不把假响应当真实证据或捎带修复。

## 修改前实施方案

1. 使用现有ListboxRoot/ListboxItem，single检查项、selectOnFocus、一个Tab入口、不自动聚焦、不循环。默认选中首真实桶，使从工具栏进入/返回按集合合同处理。Kobalte独占focus/selection；组件只保存真实桶元素ref用于视觉位置，没有独立焦点状态或持久化影子账本。
2. 私有keyboardDelegate按当前真实元素几何找同列/同行最近桶，覆盖七行年图及其他周期真实换行，不另建通用键盘框架/宽度硬编码。Home/End按Listbox合同进入时间序首/末，Ctrl组合同样首/末；边缘维持当前位置。所有0桶可检查。year按真实桶index+weekday offset显式定位，删除旧前导span与spacer专属CSS，视觉空白由grid布局表达。
3. 使用共享Tooltip Root/Trigger/Portal/Content，彻底删除usage专属hover浮层Chrome与显示机制。桶标签使用同一个真实区间描述：响应timeZone、完整本地日期、小时start/end与UTC（Coordinated Universal Time，协调世界时）偏移，区分重复小时；简短轴标签保持。按Intl与当前语言生成，无新增文案硬编码。
4. 组合必须保持li/option、真实ref与事件。安装源码显示ListboxItem会吞掉外部aria-describedby，而反向组合的undefined描述属性也会覆盖Tooltip默认关联；不能只凭as类型通过宣称可访问。使用共享Listbox暴露原库ItemDescription部件，由Tooltip.Content as该部件、Portal在item上下文内注册同一个实际弹层id。其他Listbox定义、调用点不变，不覆盖库controlled role/tabIndex。
5. 主agent保存产品preimage后实施；UI分工只读复核组合事件/描述/布局，功能分工只读复核后端/官方范围未误扩大。纯UI改动不新增UI自动化；聚焦真实使用的usage-stats正向数据合同回归、Overlay类型/i18n（国际化）/私有Node构建、docs checker，不无目标跑全量测试。
6. 后态使用新scope和私有前端构建，真实/ui桌面1280×720验收中文/英文：Tab进入首桶，方向键阅读，Home/End首末，year跨周及首尾、mouse同桶详情、Escape关闭、Tab/Shift+Tab一次进出、切周期/刷新后工具栏焦点。截图必须实际呈现、人工复核后再修、再截图；不得把DOM文本、types/build或空库分数当视觉验收。无响应拦截、假账单、系统时间修改或独立Vite服务器。
7. 更新本spec、07-panel、双语未发布日志和根/月/artifact索引；各自scope先关自有tab再生产stop并取实际exit/物理PID和端口。只stage本批范围与共享精确条目，正常提交、fresh上游同步、审核完整待推集合、验证及正常push。持续goal保持active。

## 当前状态

上述真实基线与根因/影响分析已完成；产品源码尚未修改。下一步按方案实施并实际复核，组合描述关联、几何方向及像素未验证前不声称完成。

## 初版复核与继续修改前的分析

初版renderItem误信类型注释将普通CollectionNode当accessor，实际typecheck报不可调用；安装实现和既有Composer调用确认后改为普通item访问，原typecheck重跑通过。数据正向合同30项/238断言通过，类型和两语言2158键检查通过，Node私有build实际exit0（82秒）。初次错误日志保留，不把工具失败当验收。

真实intermediate页面：已加载的Today从刷新按钮Tab进入00:00–01:00首桶，LI/option、可见焦点和完整中文GMT+8区间/0 Token均正确，aria-describedby准确指向同一个实际tooltip内容。Escape后popup不关闭，截图和焦点保持事实已实证。直接根因是Listbox集合先preventDefault；Kobalte Tooltip的DismissableLayer会调用onEscapeKeyDown，但默认dismiss检查defaultPrevented，故被跳过。最小修复是在Tooltip.Root上下文内的局部详情组件读取公开useTooltipContext，Content.onEscapeKeyDown明确preventDefault并调用该唯一owner的hideTooltip(true)；不新建open状态、不覆盖shared Listbox全局Escape，也不解锁Settings的Escape。

另外，首次“点击Refresh立即Tab，不先观察请求完成”的工具操作落到BODY，随后按真实已加载状态重验可正常进入首桶。这是刷新时退休旧数据组件的时序线索，尚未证明稳定根因，不可据此声称busy期间的快速Tab验收通过；后续须保留此事实并尝试复现，不能静默删除。正常已加载Tab、组合Escape、year几何与其他周期仍需最终实页复核。

## 快速刷新复现与稳定载体方案（继续修改前）

Escape修复后的真实页面已验证popup关闭且LI焦点保留；中文day首/末、year Jan1→Right Jan8→Down Jan9、首尾空白边缘、month Oct31和week Oct18、鼠标同03:00桶、英文区间与UTC偏移均有实页截图。另一条实际键盘链：Escape→Shift+Tab回刷新→Return→立即Tab，再次落到BODY；有最终构建的截图和DOM activeElement事实。不能归因偶发或工具，也不能把先等待加载完成的通过当成根治。

直接触发与根因：UsagePanel仍用Show(data)挂载整个ActivityGrid。刷新同步清data，图和下部可聚焦控件暂时消失；快速Tab没有稳定的后继载体，进入页面/浏览器外部。第三批只稳定toolbar，尚未覆盖数据区入口；初版新增可检查项但没有改变这个加载生命周期。影响initial loading、周期/刷新及连接重新查询，错误/空数据同样需要一个稳定当前状态，不涉及后端调度。

修正方案：ActivityGrid及唯一ListboxRoot始终挂载，当前数据缺席时options为空、aria-busy跟随真实loading，不保留旧周期数据。复用公开createListState作为同一个Kobalte集合/选择/焦点owner，dataSource只读当前buckets；数据退休时通过其selectionManager清检查项，库现有createComputed自行清理无效focusedKey。几何ref仅随真实节点生灭，禁止恢复旧桶索引或手写focus计时器。加载时Tab可停在同一个空载体，完成后仍保留该载体焦点；方向键进入新周期首真实桶。给载体本身加现有token的focus-visible描边，避免空状态不可见焦点。当前bucket详情在无数据时退休，不猜本机时区；新数据仍以响应timeZone格式化。重跑类型/私有构建，真实复验快速Return→Tab、方向键进入新数据以及原day/year和中英合同，再交付。

外部state复核补齐：Root传state后不再构造SelectionManager，故原Root.disallowEmptySelection不能单独表达策略。唯一createListState按真实buckets是否非空配置该策略，Root从同一manager读回；有数据时点击当前项保持检查选择，无数据时允许退休clearSelection。不得新建平行选中信号。格式命令曾误在Overlay目录使用根路径而报MODULE_NOT_FOUND，已在根目录重跑原Prettier，实际通过且源码未变；构建独立记录，不混淆为格式验收。

复核资格：空载体已经获焦点时新数据完成保留该载体；前向键进入首桶，后向键按库合同进入末桶，不能泛称所有方向入首桶。本批显式刷新/周期操作先聚焦toolbar，库退休新集合后保持载体。不据源码扩称外部被动刷新删除当前LI时仍自动保留焦点，也不把未取得的空年度loading帧当视觉通过。最终UI须重验最新非空选择策略与上述快速Tab路径。

## 最终结果

最终唯一createListState直接供给永久Listbox载体，无默认值或平行焦点/选中信号；已替换原方案第1项的defaultValue。当前数据缺席时集合为空、非空选择策略放开以退休旧检查项，库自行清失效focusedKey；数据出现时同一manager禁止取消唯一检查项。Tooltip以原owner关闭，ItemDescription注册与popup同id，专属hover浮层和假spacer旧路径删除。简短轴、原七行列向/单行布局、强度色保持，详情真实完整区间/UTC偏移按当前语言。

最终真实快速刷新Tab及Return→立即Tab均通过，listbox-cl-234在所有英文周期/刷新中保持；空载体焦点保留后方向键可进入当前周期。中文载体2618同样通过快速Tab和03:00详情。实际点击当前项仍LI/option/aria-selected=true。最终中英文day、year跨周及末端、month/week末桶、Escape关闭/LI焦点、单Tab进出均重验并人工截图复核。四自有scope均正常exit0并物理复核；全部[证据与准确边界](../../artifacts/2026-10-13-usage-keyboard-details/README.md)。

30测试/238断言正向数据合同通过；最终Overlay类型和Node私有build实际exit0（73秒）。只改三个UI文件、07-panel公开合同、双语未发布日志、一个新spec/证据目录与根/月/artifact索引的本批条目。共享其他改动保留，不创建分支/工作树、版本或发布。格式/i18n/docs及范围提交、fresh fetch/merge与正常push在本轮继续完成；不伪造尚未执行的push回执。持续目标active，下一批继续调查。

最终Prettier三个UI文件与范围git diff --check通过，i18n实际2178键/两语言、docs:check实际348操作/26组均exit0。差异审核确认07-panel未提交部分只剩本批9行合同，CHANGELOG只剩本批中英两条；三个索引仍有其他任务383顺序整理，本批使用精确缓存patch只stage自身条目。提交/push之前再次检查完整暂存及待推集合，不把并行未提交文档混入。
