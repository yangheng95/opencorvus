# 成员正文与来源的时序归属

## Recall

585继续用户要求的自主产品体验、Sources显示和成员侧栏Rendering闪烁调查；用户最新约束为单agent、只在实际冲突等待，不采用旧goal中的Astra委派。上个goal turn分类progress：583/584调查与主对话缓冲根因修复分别提交30942dcc0、6df785d56，正常fetch/merge/完整待推审查及push成功，11:12 UTC fresh upstream/HEAD均6df785d56、0/0。8次真实Sol流式200/原reader EOF，基线及after全部原exec/native/launcher0，physical/output/request闭合，auth+完整catalog退休；源577 schema6、90表207330原行字段时间与bytes/mtime/canonical保持。Main跟随范围重建39→正常离屏1；原非虚拟成员Rendering尚未复现，不能外推根治。所有旧隔离页关闭，用户18571不操作。

当前工作区另有76个已暂存后端/API交付、6项未暂存修改、171删除与2缓存目录，保留；本批只读调查先行，不修改其持久化/迁移/接口。已读584 Recall/闭合数据、TextPart、text-part-model、SubagentConversationPanel完整目标/资源/显示链、subagent-conversation投影及live reconcile、ConversationCard/ChatBubble、CardParts全部三层分组、message-part、card-message-run及07-panel/reactivity。全仓定位CardParts使用者、当前body/execution/source分组与稳定Source/Message/Part身份，历史最近六次CardParts提交已查；未检索/运行UI测试。

## 修改前分析与调查方案

可观察现象仍为原截图中的多次Rendering；当前真实流样本没有复现成员正文清空。TextPart在初始非空内容尚无HTML时显示Rendering，已有HTML仅在源实际变空时立即清空，非追加改写保留已呈现尾部到新结果完成；因此重复Loading需排查组件退休、文本短暂变空或上游分支更换，不能加延时或隐藏状态遮蔽。Subagent目标key稳定时保留scroll owner，实际Message/Part有完整身份，但CardParts的message run、body/execution run、citation run及普通Part目前按Index位置复用；较早可见内容插入时可能改变后续归属。此为候选，尚无发生时序证据，不据候选直接改代码。

先在完整已闭合577副本只读检查part实际存储schema/时间/身份与Source绑定，结合已存真实GlobalBus时序查找较晚来源/正文插入、同Message工具退休前已有后继Text，以及较早无正文Message变可见的事实。读取当前Session.updatePartRow、工具settleSources事务和真实发布/传输/投影链，区分持久化原子性与逐事件UI采样，不从最终排序冒充浏览器到达顺序。只输出非秘密身份/时序/长度，源库readonly且bytes/mtime保持；不打开用户数据库、不迁移或合成消息。

若取得真实归属异常，再补充全部定义/调用、旧修复缺口、公共契约、数据/测试/文档/交付及风险；若涉及调度/恢复/并发/终态，则按AGENTS要求立即横审所有Task/Mission/Session生产入口、轮次、正常终态、重试重启和项目隔离。UI修改必须真实隔离native /ui手工交互与截图人工复核；禁止新增/运行UI自动化。当前不预定新Provider调用；确需真实流时先定义有限范围、配对auth/models、精确模型、预算与关闭责任，不重启旧scope或扩大耗尽预算。无法复现时保留准确证据和未知，不拿单个样本通过宣称原问题解决。

新spec/产物同步三索引，docs:check和必要聚焦正向契约校验；所有本批改动范围提交，fetch/merge/全待推检查后正常push，不混入其他会话交付。

## 只读发现与下一步实页范围

完整577库part表1891项（text755、step-start516、step-finish476、source-file31、reasoning83、file1、source-url29）；工具请求/进度/结果在tool_part_request/progress/outcome中正规化保存，不能把part表当完整Tool历史。60条Source的实际time_created对照同Session/同Message中更靠后的text canonical orderKey，未找到“更靠后的text已先持久化、来源随后插入”的样本；此结果不证明浏览器到达顺序。当前Session.persistCompletedToolResult在同一immediateTransaction中先完成Tool再写display/source，重复Source按type+sourceId去重；provider citations走同一来源writer。现有583/584实时GlobalBus又均未出现Tool草稿退休时同Message后方已有Text的条件，现阶段维持分组候选未知，不做推测性补丁。

下一步同批端口54076、fresh完整577副本/原canonical/PNG、当前正常native /ui及已完成的当前6df对应Node构建（main-D8VUecr4，只有被动观察）；Provider预算0、不复制auth、不启动任何LLM或新成员。只手动打开View菜单，分别验证已聚焦slider和menu的真实Escape键，记录前后截图/AX；这是584实页未立即关闭的交互线索，若规范输入可正常关闭，则排除产品故障，不补自定义键处理。同时复核原Task成员来源阅读，若未更改产品只交付准确证据。20分钟进程上限、至少5分钟提前publicshutdown，原exec/native/launcher/physical/output/request及出生链闭合，完整模型catalog副本清退、所有源数据保持。任何实现仍需先补根因与影响分析并重新实页验收。

## 实际结果与交付

初版时序脚本直接读取part.data中的id/sessionID/orderKey不符合规范化存储，故其late=[]无效，未用于交付结论。按当前MessageStore.persistedPart实际合同重跑：Part身份来自row.id/message_id，Session来自父message.session_id，Part/Message规范键使用生产timelineOrderKey及真实time_created分别重建；跨Message比较使用父Message键，避免把Part时间错当整个对话排序。规范join后的chronology-verified对全部1891 Parts/755文本/60来源仍未找到已创建后继正文在前的迟到来源样本。源bytes/mtime保持。此结论只覆盖该已闭合持久样本，实时到达仍未知，不据此添加位置分组补丁。

实际native54076/页262，复用当前6df对应Node完成构建main-D8VUecr4.js（无产品源码改动，仅被动观察）；预算0/实际Provider0，未复制auth。真实聚焦slider的Escape在100%与160%均关闭View菜单并返回触发器焦点，584低层按键尝试未确认事件到达，不能据其添加重复close逻辑。实际菜单/正文8张截图均呈现并人工查看；模型不可用banner来自刻意未携带凭据，不误报用户OpenAI热认证失败。

原Task完成态51项历史实际载入；原B/X86d33消息107Parts9来源全部经实际HTTP200→生产parseSubagentConversation→原SQLite身份/URL→同Message completed Tool绑定核验。原Tabs与Free-MAD来源在Dock以标题、域名和复制控件呈现，与原tool/后续正文保持顺序。第一次Tabs复制后过早读剪贴板取得旧README位置；先实际观察Copied再读取的明确复核取得完整https://www.w3.org/WAI/ARIA/apg/patterns/tabs/，论文复制取得https://arxiv.org/html/2509.11035v1。早期值保留，不称为已确认复制失败，也不把仅有图标当完整剪贴板证据。当前静态Sources9项及Rendering0的DOM观察仅元数据，不冒充真实流或UI断言。

原exec69261 join0/native0/launcher0，publicshutdown200提前853042ms，physical/output/request及精确出生链闭合，页262关闭，原模型目录副本清退。源6的90表207330行/原字段/时间/canonical/bytes95682560/mtime1792828797672.7832保持；本零Provider目标8所有原字段差异也为0、integrity ok。两次实际工具问题均修正后重跑原验收：checker不应期待规范化JSON包含row身份，首版直接读取JSON的排序同样纠正。docs:check350/26、architecture-index20通过。

本批仅交付真实调查与排除证据，无产品补丁；原高频Rendering、长SourceExcerpt、778实窗仍未达成，继续优先实际运行生命周期调查。提交后正常fetch/merge/全集审查与push，不动其他76个暂存交付或171项删除。
