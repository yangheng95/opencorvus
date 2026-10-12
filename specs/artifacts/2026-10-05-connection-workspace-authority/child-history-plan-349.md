# 349 分散网页来源与32份Markdown缓存边界

## Recall

用户持续要求自主迭代，重点Sources视觉和子Dock反复Rendering；最新只用单agent，覆盖旧goal的Astra并行措辞。348属于progress：真实66来源/6224字、同名复制控件修复，6c07120f5183cee2f5676b15b3ed24d33c529cd7已推送且开始干净。开发/调查/修改/页面复核由root独自完成；仍沿328/329/348相同方式，以隔离产品Task中的唯一研究员产生真正的子会话，不委派开发agent。

## 资料、全仓搜索与影响分析

已读348 Recall/实际证据，328和196原修复边界，SubagentConversationPanel资源/实时投影/阅读位置、CardParts全部分组/Index、TextPart/text-part-model和markdown-render/worker、07-panel/07-panel-reactivity。createStreamingTextPartModel唯一生产调用来自TextPart，所有相关Markdown展示共享worker。完成结果缓存32份/4000000 UTF-16 code units，worker块缓存512份；前者仅成功非流式最终HTML。348的64个Source是纯来源UI，不是64个Markdown正文，实际只4份，无法覆盖缓存逐出。

可观察现象是用户原图有大量分散webfetch与每条Sources、持续Rendering。当前代码中pending且frozenHtml为空才显示占位；requestKey和targetKey保持子面板owner，正文已有HTML保留，完成缓存跨最后subscriber卸载存在。超过32份后的重新进入确有普通cache miss可能，但不能仅从这个上限推断反复闪烁根因，更不能先扩大缓存或隐藏状态。Source/Message中间插入导致Index迁移仍为待证候选。旧196只明确warm completed return及受限主界面验收，长child/逐出明确未覆盖；348也未覆盖。

本轮先无生产修改。共享消费者包含主对话、Side、child和其他TextPart静态文档。若复现再分析具体身份、请求/回复、Part时序与全部调用、契约、数据、测试、文档、交付风险后实施。若遇渲染队列或Task/Mission/Session调度/恢复/终态异常，必须按共享机制横审所有生产入口、执行轮次、正常/终态、重试重启、串并行及项目隔离。未有证据前不判局部。无新增接口、策略或持久化；相关检索范围没有专用UI自动测试，不运行/添加它们。

## 独立真实验收

四个已实际查阅的MDN原始页面作为公开资料：[URL](https://developer.mozilla.org/en-US/docs/Web/API/URL)、[构造器](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL)、[URLSearchParams](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams)、[Fragment](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment)。这仅确认可访问与资料主题；不是产品UI证据。编写36个独立资料审阅问题，每题由唯一研究员实际webfetch相应指定页面，随后直接正常可见输出80—120汉字，再进行下一题。每题独立留真实读取与来源，不用脚本/并行工具将结果打包成一段；不伪造Source/消息、不直接写数据库。完成后负责人按真实消息证据读取全部原文与工具范围，简短收尾，不要求整篇重写。

fresh child-history-349-live-01，18326/ui，沿成熟Task启动器及当前构建main-enuOTKXR.js；不单开Vite。预先批准本隔离运行累计64次Provider请求，以容纳36题、原系统读取/预检/负责人核验；仍保留原Task openedAt起900000ms、180000ms无活动与native1500000ms固定边界，不延长。授权auth与完整models配对分别验证usable/projected/实际gpt-6.1-sol streaming。全部脚本/输入/退出路径在启动前准备，创建request-id落盘，未知结果只恢复原ID。

先开页面再创建Task，及时进入真实child，在早段来源/正文已就绪时保持阅读旧区域，观察后续增长。在后端真实正文超过32份后，人工截取原阅读区域，再关闭重开、切换All agents返回和来源复制/原链接导航；实际截图逐张查看。只读页面几何辅助观察但不做DOM/截图/源码/组件断言，不自动截图循环。实际API事件/持久化/Provider区间检查只证明数据链路，不能替代视觉。

若实际模型没有生成超过32份独立正文，应如实记录未达目标，不把多条Source算成通过。单次重开首次cache miss也不得直接当作持续更新反复Rendering。结束逐一取得实际Task/Provider/CLI/观察器/原启动exit、关闭自己页面、精确Native/Host/output/request/端口与凭据配对退休，完整脱敏归档。无问题则只交付新证据与限制；有问题先补分析再修复复验。根/月/目录索引、docs检查、范围commit、fresh fetch/merge、完整待推送集合与正常push，goal继续active。

## 已完成与下一步（恢复先读）

真实Task tsk_g00VXpnbRn00L81V59Oh / worker ses_huwYlKst4LVMvtJUgEta完成36次webfetch、37份独立assistant正文5682字符，负责人完整取得36题原文已逐值核对。计数器中途修正role范围，原检查事实保留。13张真实截图已人工查看：前五张实际处于worker reader；首次重开06已在worker EOF之后，处于负责人新reader区间，不能写成worker仍在流式重开。子侧栏top1137.6与R05/R06始终保留，内容height4637→9796。

发现真实主会话位置变化：05在orchestrator/研究员进度卡，06/07在更早用户R20—R25。完成态08—11分别用开关、成员Open重做保持同一orchestrator区域，宽度变化本身不足解释。已追加阅读Conversation的anchor/reader/treeEpoch、Virtualizer generation/focus、main开关入口；没有确切DOM owner、写scrollTop者或共享队列异常证据，不先改机制。下一批围绕worker完成、负责人恢复、主投影更新与重开组合追查。这是待修的现象，不算已解决。

Task448813ms，47实际Sol流均HTTP200/EOF。创建器0、观察器69669 join0、原启动15819 join0，自有138/139页与Native77744/Host14344、端口、output/request/auth+models配对全部闭合，Native773412ms。125份监督文本和完整日志/脚本/原数据已脱敏归档；实际checker通过，53文本凭据0。当前无生产代码修改，下一步文档检查、范围提交及fresh fetch/merge/push，goal仍active。证据入口child-history-349/README.md及checks/return-phase-association.json，原始运行私有目录和完整数据库保留，可在后续精确隔离场景使用，不重建假Task或消息。
