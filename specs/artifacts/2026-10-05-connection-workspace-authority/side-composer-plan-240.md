# 240 Side Sources阅读空间与共享输入框测量

## Recall

用户要求持续自主体验、修复，重点Sources显示与Side Dock rendering闪烁；最新要求只用单agent。239已推送6c6306bf0，工作区干净。当前原238完整真实会话在新隔离Native18174/own81读取；未复制凭据、未发起Provider或Task。240新readonly readiness与frontier已亲自审查：schema90、两个Project44/66条目录事实、四个terminal profiles不会写、现browser/computer MCP；所有Provider/Tool/publications/deliveries终态，8assistant已完成，memory idle/14 recovery表空；仅原71204/birth lease尚未过期但物理dead。全90表复制实际原行相等，Session/Project/directory沿用。固定15分钟scope，只操作自有页面，完成后sole shutdown和实际foreground join。

验收：新打开空Side文本框在现72px最低值附近，Sources阅读区获得释放的高度；短文、长文十行上限、清空、整个Dock重开与真实pane宽度变化均保持按当前内容测量，原Sources及Main内容可读。真实截图人工复核，typecheck/build仅为辅助。禁止UI自动化测试/fixtures/DOM断言；检索overlay/test中AutoGrow/textarea/TextField未发现此类文件。本轮UI纯修改不新增自动化测试。无版本/协议/数据/调度变更。

已读：AGENTS.md；07-panel.md；239 Recall/记录；AutoGrowTextarea/纯metrics/TextField；SideChatPanel及side-chat/text-field/composer/base CSS；全部11类调用点（Main、Side、Goal、Mission create/edit、Question custom、Operator steer、Git commit、Providers与Scheduled）；现ResizeObserver/Dialog/dom-utils使用。全仓rg发现只有共享primitive写此自动高度，Main现rows1、其他调用rows各异，Side默认rows；原生rows缺省2不足以解释199px。MDN textarea/scrollHeight/ResizeObserver权威资料已查阅。参考：https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver 与 https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollHeight 。不委托。

## 修改前分析

可观察事实：真实首次打开空Side textarea inline height199px（18.9*10+padding10的上限）、form262px、scrollport261.333px，720px桌面截图before-empty.jpg。真实输入“短问题”后textarea72px；清空后正常。关闭整个Dock后current Return重开再次空textarea199px。匹配样式仅现TextField/min72，原生未指定rows，值为空；不是保存的草稿或Side高最小值。

数据/control根因：共享resize只响应value effect和onMount microtask，它把一次scrollHeight读数永久写为inline height。挂载/显隐/pane布局变化完成后没有任何尺寸失效通知，因此首次布局读数达到上限后会一直保留，直到真实input触发重算。初次读数时具体width/placeholder分行未采集，标记未知，不能虚称已观测；已证明正确稳定布局可测出72且重开重现。旧路径没有布局观察，添加Side rows或硬高度会遮蔽shared失效并损害长文。原CSS72px floor与十行cap不是错误，不改产品密度tokens。

影响面：同一primitive全部调用会受宽度/显隐变更影响；用唯一resize保持真实内容/现行floor/cap，TextField/ARIA/IME/input/store不改。不影响Session/Source数据/HTTP/SDK/调度/Provider。现metrics仍唯一数值cap。风险是ResizeObserver自身height写入反馈循环、隐藏0width测量、卸载后的microtask和窄宽度重排；观察当前元素width，只在实际width变化重算（记录0以接收重显）、测量仅可见非零geometry且连接，cleanup disconnect/disposed。height-only回调不另写。CSS floor/现rows仍归调用者，无fallback/影子状态。Main现drag floor必须保持。

## 实施方案

只在AutoGrowTextarea增加onCleanup，使用现原生ResizeObserver跟踪content宽度变化；统一调用现resize，在测量前验证有效geometry/生命周期，默认初次observer回调重测；callback忽略相同width和height-only变化；卸载断开。原value/onMount必要及时测量保留，observer不拥有新height算法。观察尺寸记忆只用于事件失效，不持有内容或第二height来源。

实施后build/typecheck，隔离own81 reload加载新bundle，通过实际Side入口验证空/短/长/清空及Dock重开；实际Sources展开/阅读截图，pane resize检查长文重排。15分钟期限前关闭页面/Native，原foreground actual exit、独立closure、fullstdout/HTTP、核心表custody与项目属性复核。随后更新architecture/记录/README、docs check；本范围commit、fetch/merge upstream、完整待推送审查、正常push。若scope到期保留原失败，不延长期限或重置事实。
## 已完成与验证

真实首次empty199→72、阅读viewport261.333→388.333；短文72、18行内容350/区域199，pane width330.667→391.667时height142→123，清空/整Dock重开72；原Source5/Reference4与5211字符摘要实测。对应真实截图与geometry见[证据](side-composer-240/README.md)。前景91109/Native51404 actual0，14:55:47Z早于固定期限15:02:49.672Z，全部physical/output/request/pair闭合；13核心表完整原行相同、两Project仅primary.git目录mtime变。UI role selector一次无匹配改按当前可见文本成功，原工具差异保留于记录，不报产品bug。types60102/build52914 actual0；docs:check与architecture-index当前0。未覆盖其他UI调用、中文深色、新stream/Rendering与字体宽度以外变化。
