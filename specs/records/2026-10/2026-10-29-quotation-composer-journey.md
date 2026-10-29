# 引用卡片、草稿与键盘连续性

## Recall

用户要求持续自主体验当前UI（User Interface，用户界面）/UX（User Experience，用户体验）与功能、分析后修复、真实截图人工复核及范围提交/正常push，明确仅单agent。旧Goal中的三Astra已被覆盖；不回到陈旧Rendering。上一轮784为progress：60466c411deb311e92a849d00174da92f12295c2已推送，04:28:33.638Z fresh fetch/merge为0/0，30本任务文件干净、176外部状态保留。真实来源失败/重试和Windows大小写改名已验证，16项非UI合同/170断言及后端类型/正常push检查通过。原两开发实例exec8032/11198、native/launcher及物理/输出/请求/出生身份均已退休，公开shutdown200，副本退休；不能复活旧截止。源闭合784-after为92表112184行/schema9，累计模型782。

本轮转向新的输入协作路径。已读当前QuotationSelection、QuotationChip、ChatComposer引用/附件、SideChatPanel引用/textarea、composer-draft、quotation及main接入点，以及07-panel当前草稿/暂存附件清理、引用归属/提交合同和765/768/743历史决策。已全仓检索QuotationSelection、QuotationChip、setComposerQuotation和moveFileItem/草稿消费。首次误猜Composer/WorkspaceChat/workspace-runtime路径及services/selection*检索失败，随后按rg --files定位真实文件；不把这些命令错误作产品证据。

现合同：只有同一真实Message容器中的选区可以Quote/Ask in side chat；文件编辑器选区不属于Message引用。引用拥有原sessionID/messageID和可见原文，随当前草稿存储；用户未发送时不制造消息。跨项目/全局New Chat导航清理volatile附件，但文本/引用草稿保留各自owner；Settings往返保留当前附件。这些是既有设计，不能误报为附件丢失。

待证线索：共享QuotationChip移除按钮仅调用onRemove，主输入和侧聊父调用都直接删除引用，未看到Attachment Remove现有的键盘焦点交接。若键盘激活后按钮随卡片卸载，可能回到BODY而非输入区；目前没有本轮实际页面证据，不能先判定缺陷。引用选择toolbar本身有scroll/resize/selection清理及Escape，未证过期选区错误。引用/草稿纯前端UI状态不是调度事实。

## 调查与实施方案

新785自有开发serve /ui，38345，当前普通main-D3yYQ3l6.js，从已闭合784-after完整备份DB与durable事实并复制真实旧附件namespace。默认项目仍为784新QA项目，使用其真实Code Chat ses_-zUQb23QSzzjAhs9qntn/八处来源/原模型回复，不改写消息或引用。完整models目录副本、无auth副本，Provider（模型服务）最大0/累计782；本轮不发送请求/Goal或自动执行，不操作用户18571/窗口/进程。首次启动固定60分钟绝对物理截止、不续期，UI预定15分钟公开正常关闭，至少5分钟收尾；若需修复后实例38346共用同一截止，不覆盖活跃bundle。

真实页面先选择模型回复段落，经Quote建立原Message引用，输入独立已知草稿；通过真实Tab/Shift+Tab将焦点移到Remove quotation，再Enter，观察AX（Accessibility，可访问性树）焦点和原图、立即键盘编辑的归属。侧聊通过同一真实原文的Ask in side chat打开独立参考副本，只操作未发送草稿/引用，不调用模型；重复移除和文字编辑，保留两owner文本。择需补文件选区切回、文件附加/核对以及跨项目返回，沿当前明确的附件清理/草稿归属合同核对，不扩为新的文件引用能力。主要桌面端，原文件不编辑或执行。

如实际复现，生产修改前补完整现象、直接触发、数据/控制流根因、旧路径遗漏、定义/调用/公共契约、数据/测试/文档/交付/风险分析。预计复用现有textarea引用、作用域/authority（连接权威）和同步按钮事件，按原拥有者交接；不加全局监听、影子状态、通用快捷键、假消息或持久化格式。若发生调度/恢复/并发/终态异常立即按共享机制横审所有Task/Mission/Session轮次及正常/终态、重启/重试、串并行/多项目。

纯UI只真实交互/未编辑截图并人工查看；DOM（Document Object Model，文档对象模型）只读定位不是自动化断言，不新增/修改/运行UI自动化、组件/DOM/源码文案/浏览器fixture或像素基线。若有非UI契约改动再补聚焦正向真实checker。纯UI修复用当前普通build/类型/必要语言辅助，新进程/最终构建实页覆盖主输入/侧聊和草稿保留；类型/构建不冒充视觉资格。

收尾公开shutdown200、原exec/native/launcher0，物理/输出/请求及精确身份退休后才删除本轮目录副本；核对全部旧业务行/源库、正常可变租约如有需逐项解释、schema9/integrity、十原文件与附件精确字节/元数据。无模型调用即不能宣称新Provider验收。三索引和package.json当前docs:check，范围提交，fresh fetch/merge、完整待推集合审查、正常hooks/push；无关工作保留，不新branch/worktree/tag/Release/PR，总体Goal保持active。

## 已证问题与修复前分析

主对话实际拖选原模型回复的一段，经原Quote建立真实messageID/sessionID引用，输入已知草稿；Shift+Tab两次依次经过输入高度splitter和Remove quotation，确认焦点在按钮后Enter。图04–05及AX原输出显示引用被移除、原文草稿保持，但焦点落到AXWebArea页面根。随后从同一Message选区Ask in side chat，经普通复制建立Side chat 1（3条继承消息），未发送问题；侧聊输入独立草稿，Shift+Tab确认Remove quotation后Enter，图07同样删除引用/保留文本而焦点到页面根。不是文字草稿丢失或模型错误。

根因：共享QuotationChip只负责调用onRemove，删除会卸载当前聚焦的按钮；全仓两个生产调用分别在ChatComposer与SideChatPanel，都只清草稿quotation，没有交还输入焦点。765已修附件列表移除的后继焦点，但引用不是附件数组，未覆盖此两个独立父输入owner。QuotationSelection创建引用及main/side入口已有自己的textarea聚焦，不拥有卡片移除操作；改选择toolbar或全局keydown不能根治。

唯一修复位于两个真实父输入的当前onRemove：沿原setComposerQuotation清引用，再同步聚焦其现有textareaRef/textarea，preventScroll保留阅读位置。保留fileEditorReserved准入（main与现Side一致），仅连接、启用、可见且不在inert/hidden/aria-hidden中的当前输入可接焦点。同步当前用户事件内完成，没有等待窗口或跨owner异步回调，不能在未来抢回用户移走的焦点。不新增组件props、全局监听、焦点状态表、草稿副本或持久协议，不改引用原文和真实作者。两个本地callback属于不同现有输入owner，不抽象通用调度/资源机制。

影响面已核对：QuotationChip全仓仅这两个生产消费者，主Chat/Task/Mission共用ChatComposer，Side引用独立key。存储setComposerQuotation保持同一text且只替换quotation，原提交/模型块引用序列化不变；API/SDK/schema/数据库/Provider不适用且不修改。调度/队列/并发/终态无异常证据且实现路径不涉及它们。主风险为隐含输入或离开的owner被聚焦，使用原ref的连通/禁用/可见条件并同步事件解决；风险验收为主/侧不同草稿、真实键盘移除后直接追加文字、语言/面板往返原文保持，不发送消息。

另有边界观察：第一次三击整末段使浏览器选区延伸至Message外的usage控件边界，超出当前同Message选区合同，故未出现toolbar；缩小拖选后原Quote/Ask正确。未证明此为产品缺陷，不用改DOM/伪造选区或新文件引用协议绕过。初阶段文件/附件跨项目属可选调查，当前优先修复已证共享引用焦点；未执行的路径保留为后续，不宣称通过。

初实例已公开shutdown200、原exec13795/native/launcher0及三项/出生身份退休，余约54分钟原绝对截止；auth无副本，模型0/累计782、目录副本退休，源元数据/字节保持。生产修改后普通build、Overlay类型与必要当前checker；新38346开发实例加载真实新产物并重做主/侧移除与键盘续写截图人工复核，不运行UI自动化。现三击/源文件业务不属于此次修复。

## 实施、验收与交付边界

生产只修改ChatComposer/SideChatPanel原onRemove，保留现fileEditorReserved边界，沿原setComposerQuotation删引用后同步聚焦现textarea；连接、启用、实际可见及非inert/hidden/aria-hidden条件和preventScroll保持当前owner。QuotationChip接口、选区规则、引用原文、草稿单一存储和提交语义均不变。07-panel合同及根CHANGELOG未发布双语同步，不改版本。

Overlay类型原exit0；普通build生成main-Cd7eVutE.js、renderer原exit0，保留原既有大chunk提示，不把它冒充本轮新增性能故障。新38346开发实例使用完整新bundle：主同样Shift+Tab两次、Enter移除后AX落原textarea，未再次点击输入，直接End+typing追加“继续键盘输入。”；侧聊真实新Side chat 2同样键盘移除后直接追加“侧聊继续键盘输入。”，两个独立原文均完整。设置切中文往返、关侧聊标签后重开仍保留原Side chat 2草稿，图09–12逐张人工查看。新Ask明确创建另一真实参考副本，不改写首次Side chat 1的身份或数据。没有模型/发送验收或UI自动化。

两原服务exec13795/22628均join0，公开shutdown200、native/launcher0、三项/精确出生身份退休，分别保留3248921/2814982ms原绝对截止余量，没有续期。均无凭据副本，目录副本已退休，源catalog字节/元数据及auth元数据保持，模型请求0/累计782。92表旧行112184/112575及各源库逐行精确，最终112966、schema9/integrity ok；十原文件和两namespace各17原附件精确保留。新增两Side Session、各3条复制Message/14 Part、一对原工具请求结果及总线事实，未新执行工具或伪造用户消息。详见[12张原图及机器记录](../../artifacts/2026-10-29-quotation-composer-journey/README.md)。

本轮完成已证的共享引用移除焦点问题。未新增Task/Mission页面、authority在途切换/隐藏输入矩阵、文件选区或附件跨项目资格；初步更广协作调查不据此宣称全部完成。整体Goal仍active，继续单agent自主产品迭代；本轮所有文件范围提交并按实际正常hooks/同步回执推送，不混入176外部工作。
