# 连接角标与恢复提示统一表达

## Recall

550延续用户单agent自主体验、修复Sources/Rendering/UI与功能后提交推送的长期要求，不委托。549已推送8863199ee并fresh0/0：配置GET不再被过期健康状态挡住，9服务合同、8次Sol EOF、四服务/两页闭合、16份配对退休。上一轮是progress。549原页03真实截图同时显示Online角标和后端不可达banner，已明确为下一体验问题。当前保留原两处未跟踪缓存；无活跃自有服务。

已读549Recall、548/549实图与日志、ConnectionBadge/Banner、App唯一角标调用、app/message连接状态、checkConnection/monitor-tick/init恢复、SSE状态生产入口、07-panel独立边界合同、conn-banner/sidebar CSS及中英文翻译。全仓检索两个组件/props/status类型/相关样式与测试；匹配的生产角标调用只有App，相关测试检索未找到UI测试。现有ConnectionBadge重复声明与appStore相同的状态类型，banner data-status却输出backend/stream，现有CSS连接中样式要求connecting，故一直不能匹配。computer-use/benchmark-debug-template沿用，禁止UI自动化，当前工作是纯UI表达，不制造非UI单元测试。

## 根因、影响及决策

角标优先把sseStatus=connected显示online；banner优先把connectionStatus非online显示后端不可达/未响应。两者来自真实但独立的最后观察，连接流先恢复、健康探测后更新时出现直接矛盾。549只修GET资格，不修改全局状态，因此正确保留此可观察缺口。既有grace只控制延迟显示，不能统一两处判断；data-status的枚举错位又把恢复状态染成故障色。

共享范围为普通Session/Mission/Task选中流、新建空对话（idle）、初次连接与真实reconnecting、健康失败/恢复、同authority原流、连接/项目切换时原状态退休。后端队列/唤醒/模型执行无改动；不把stream open写入全局connected，否则monitor可能误判workspace已恢复、跳过原onReconnect。健康返回数据库不可用仍是原失败事实，不修改探测结果、控制入口、重试/恢复算法或数据。

新增一个无状态UI投影供角标和banner共用原两状态：backend online且stream正常/初次连接→online；backend online且已建立stream重连→connecting并说明实时更新恢复；backend未online但stream connected→connecting，说明实时更新已连接、服务连接尚待确认；其余按原backend offline/connecting说明。最后一项不伪称已完成workspace恢复，也不把未确认当成功。保留原grace与setup/reload动作，新问题类别切换仍以原timer规则处理。Banner data-status使用该显示状态接回现有红/黄CSS，问题类别另存data-problem。角标状态类型直接使用appStore定义，保留现有显式status展示prop，不新增事实状态。

新增恢复文案进入en-US/zh-CN当前语言；既有stream文案简化为服务已连接、正在恢复实时更新，保留边界事实。公共API、schema、Provider与版本不改。两组件删除原平行判断，禁止另加timer/影子store/后备逻辑。纯UI不新增/运行DOM、源码文案、组件或快照测试；typecheck/i18n/build只能支持构建，验收必须实际截图。

## 固定实页计划

1. 以已闭合549-fixed-after完整90表历史为固定源，精确复制原字段/时间/canonical，核对native/原exec/输出/request0闭合、2次Sol EOF、4配对退休。原parent ses_-zUS0X33CzzWEKMgCk98/member ses_-zUS0WzzQzzDOGrIbYwN/project prj_hSQinOa1MIVoNEeARpn5及自有目录保持；无新业务输入或成员。inventory实际发布附件，不把文件名当来源。
2. 只用自有Source CLI /ui，port19113顺序三scope（before/after/zh-after），共用一次Node正式私有诊断构建。前两个同页英语离线→恢复；页面通过真实设置切换中文后，关闭第二服务并启动第三scope，保持选择、URL与阅读位置，以中文再核对同一恢复边界。当前UI反例已由549同版本组件代码与截图证明，不重复制造无关任务。
3. 每scope最大4次、批次最多12次gpt-6.1-sol独立preflight，完整当前App OpenAI条目与models.json配对，预检分别证明凭据、投影和实际模型一致；20分钟原生资源边界、180秒启动/Provider无活动界限，保留五分钟收尾。build先完成再复制凭据/启动。UI变更不需要新的业务模型调用。
4. 私有只读诊断观测原backend/stream及统一UI投影，保留成员owner。真实查看在线、离线、流先恢复/健康待确认、最终在线的badge/banner颜色与正文；窗口过快时如实标记当前截图阶段，不以最终online替代中间边界。设置菜单切换locale限自有隔离origin，不操作用户现有页/进程。
5. 关闭所有页与服务，原exec/native/输出/request闭合，配对退休，源数据字节mtime及目标原行复核；最小非秘密证据、三索引与当前架构、类型/locale/build检查，范围提交、fresh fetch/merge/待推全集审核与正常push。Goal保持active，ResizeObserver和Mission独立实页仍开放。

## 首轮观察与复验调整

前两scope各2次Sol EOF，原exec56161/46152正常0与配对退休。页171真实离线/在线截图可读，35正文/11来源保持。CN550实际记录backend=offline、stream=connected时统一显示connecting/health，20:10:43.084至48.124约5.040秒，但人工两张截图分别过早/过晚，尚未获得中间态实图。原banner在问题类别从backend变health时close并重新等待5000ms，理论可见机会仅约40ms，不能把日志当作看到了闪烁或完成视觉验收。

补充根因：已显示的连接故障转入恢复时，事实类别变化不应销毁已经可读的同一提示再延迟重建。删除该kind变化分支的banner.close，保留初次宽限期、未显示时新kind重计时、完全恢复时close与清理；已经显示的提示直接更新真实文案和颜色。这是同一可读提示的连续性，不改变健康/流状态或重试策略。

原zh-after未启动、未复制凭据。改为verified-before/verified-after两份fresh scope，仍同完整549固定源，backend19119、私有原字节Node relay19117，同页保持URL与authority。总尝试上限仍12（已用4、复验预计4）。relay只可暂停已知GET /global/health向真实backend的转发，最多120秒自动释放；其他正文/事件/配置请求与响应原样pipe，绝不伪造消息、响应或状态。正常关闭before、自然恢复after时保留一段实际健康请求网络延迟，使已恢复事件流与待确认健康观察可稳定手工查看。分别查看英文/通过真实Settings切换中文后的同一提示，再释放健康请求，查看真实200后恢复。该临时网络控制不进入生产，不是UI自动化测试或fixture；本轮不以自然窗口未截图作为通过。

### 私有转发器监听器修正

verified页172已实际查看黄色English/中文health提示，真实语言设置切换和健康释放后online，原35正文/11来源与阅读位置保持；四后端各2次Sol EOF、正常0/配对退休。relay73294也正常0，全部client/upstream socket、request和pending=0、输出排空，但原stderr有MaxListenersExceededWarning。工具源码在每个outgoing request的socket事件上重复给同一keep-alive Socket注册once(close)，实际Set虽去重socket，却没有去重监听器。不能用最终0关闭掩盖工具缺陷。

按物理socket已在同一Set中时直接返回，保持原网络字节和所有权，禁止setMaxListeners压制告警。新增final单一scope：backend19121、relay19123，仍同完整549固定源与已验收的52.38s UI资产，不再改生产代码；总模型上限仍12，预计累计10次。真实页面先正常在线，再仅延迟健康请求以经历原5秒传输超时和grace，持续原事件流，实际查看英文/中文同一恢复提示、释放到online及关闭。该复验还验证在同一服务多次复用上游socket时监听器只安装一次。原转发器和原告警保留在私有历史，最终记录分别说明两轮，不回写原证据。

## 最终结果

[八张已人工查看的实图与原事实](../../artifacts/2026-10-23-connection-status-presentation/README.md)。生产实现只有一个无状态connectionPresentation，两个控件共用真实backend/stream观察；banner显示状态与已有颜色样式一致。已经显示的提示在backend→health恢复时直接更新文字/颜色，完整恢复才关闭；保留初次grace、独立事实与原发送/写入控制。

页172完整经历原服务正常关闭、同一URL/authority新服务恢复。真实relay健康转发延迟104.417秒（20:18:00.936→20:19:45.353），原客户端按5秒超时处理，事件与配置正文持续实际传递。图08黄色Connecting与英文health说明一致，真实设置切换后图10为中文“连接中/实时更新已连接，正在确认服务连接”，图11真实健康200后在线；原35正文/11来源、组件owner和64017原阅读位置保持，手工上滚到62577后继续保持。没有用日志替代中间态实图。

工具修正后页173以同一服务的真实网络健康请求延迟复验，图14/15分别英文/中文黄色提示，释放后图16在线，原来源/正文/62577保持。原Socket只安装一次清理监听器；最终152次原样转发、19个物理socket注册，close listener总数每次注册时均为3，原exec94785退出0且无新输出。首转发器73294也已完整0结算，但其重复监听器告警保留为工具失败，后续复验才是最终工具资格。两个relay终态均serverClosed、client/upstream socket/pending/request=0、outputDrained=true。

五个后端原exec56161/46152/62247/12982/63513均公开shutdown200、native/launcher/原exec0、精确出生dead_or_reused、输出/request闭合。各2次current Sol流式200/EOF，共10/12；20份runtime/private auth+models配对退休，App原始条目、完整catalog和mtime保持。每scope源均90表165802行、所有原字段时间与canonical字节保持，目标实际schema3/对象/integrity一致，原行仅两条运行租约变化。所有资源均在20分钟边界前且预留超过五分钟关闭；zh-after未启动/未复制凭据。

验证为真实UI交互与截图。Overlay typecheck通过；check:i18n两语言2539键；Node正式诊断build首轮53.09s、最终52.38s，final复用同一最终资产；docs:check345ops/26groups、architecture-index20篇、diff检查通过。没有新增/运行UI自动化测试，未把类型/构建充当视觉验收。公共API、数据库schema和版本未改，未发布。

持续仅一个开发agent，Goal active。首轮自然恢复中间态未抓到实图已明确排除；持久在线backend下的单独流重连提示仍需独立验证，原SSE重启有idle→reconnecting瞬态可进一步检查其grace影响；ResizeObserver及Mission独立实页继续开放，不宣称全部闪烁和体验问题已根治。
