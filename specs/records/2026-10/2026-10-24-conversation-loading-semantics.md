# 对话加载指示器的状态与无障碍语义

## Recall

572继续单开发agent自主迭代，不委托；用户持续要求体验UI（User Interface，用户界面）/UX（User Experience，用户体验）与功能、Sources/Rendering优先、实际验证后提交推送。571为progress：df5a66a14已正常hook推送、fresh0/0，13张人工查看实图和原B新增Source闭环，未复现Rendering且没有产品补丁；18次实际Sol流为17EOF（End Of File，流结束）/1显式shutdown-aborted，后者原pending经正常Project打开恢复revision18/retry_wait→19/idle，三个scope/exec/native/launcher/物理/输出/请求全闭合、配对凭据均退休。原18571未操作。当前开始git status只含171原无关删除、.bun/及packages/opencorvus/bun/未跟踪，无暂存，HEAD为该提交。整体Goal active，旧三个Astra文字已被用户多次单agent要求覆盖。

本批追查571真实页面反复呈现的“正在加载Task”辅助功能节点。已读571 Recall/结果、App/main/CSS、board store、Task选择、Chat选择和失败清理/删除归档、Mission激活、连接重绑、当前07-panel架构及相关历史工作区epoch决策。全仓搜索taskSwitchProgress/task-switch-progress/workspace.loading_task及全部taskSwitching调用；当前只有App声明、main属性写入、两份CSS与两语言文案。检索到的相关store/service测试是非DOM状态/传输测试；没有找到本批相关UI自动化测试，全部不运行。未新增或运行UI自动化。

## 修改前分析

可观察事实：571 Task已完成/正文完整时辅助功能树仍有“正在加载Task”容器；同一真实页面只读属性为data-active=false/aria-busy=false，截图中顶部没有进度线。不是可见Rendering正文闪烁，也不是队列卡死。App固定挂载命名div，CSS仅用opacity0隐藏；透明度不改变辅助功能暴露。main另用effect写data-active与aria-busy，初始声明硬编码false，节点命名一直保留。根因为视图的可见性/可访问性没有一起归属真实响应式状态，旧视觉修补只保证绝对定位不挤出2px空隙，没有处理辅助功能合同。

影响面：Task选择、Chat/Work会话选择、Mission会话激活、连接重绑共用boardStore.taskSwitching；原“Loading task”在Session路径同样出现，范围错误。当前epoch/authority终态清理仍由各真实选择owner拥有，未发现调度、队列、唤醒、恢复、并发或终态异常，本批不改这些控制流或后端Task/Mission/Session occurrence。若实际发现此类异常，立即横审全部入口、正常/终态、重试重启、串并行与多项目，不能凭本UI修补排除共享根因。

公共约束与风险：保留当前非阻塞固定2px绝对位置、原CSS/减少动态效果、键盘输入与选择流程；不新增busy事实源、百分比或轮询。App已直接读boardStore。main对该节点的唯一effect可以删除，让App唯一声明同时读同一flag。两语言旧loading_task键仅一调用，同步替换为loading_conversation；不改模型/用户原文。数据库schema/持久格式/Provider流程无变化，不迁移或读取真实用户库；仅完整已闭合历史副本。纯UI改动不增加组件/DOM/文案/快照测试。

权威语义依据：[WAI-ARIA 1.2 progressbar](https://www.w3.org/TR/wai-aria-1.2/#progressbar)规定不确定进度省略aria-valuenow；加载区域以aria-busy及关联描述表达。[aria-hidden](https://www.w3.org/TR/wai-aria-1.2/#aria-hidden)控制辅助功能暴露。使用现有元素表达不确定进度，空闲时隐藏其辅助功能投影；不添加合成百分比或持续播报。真实辅助树与截图仍必须人工复核，规范或typecheck不替代体验。

## 实施方案与验收

1. App的现有chatSection直接以boardStore.taskSwitching声明aria-busy，并仅忙碌时关联既有进度条ID；同一div role=progressbar、通用本地化名称、aria-hidden与data-active均由同一flag控制，不设置数值。移除main对应属性写入effect，保留其他effect及旧CSS几何布局。同步两语言及当前架构。
2. 复用571真实before截图/辅助树/属性和当前未改产品源码作为故障证据；正式Node Vite构建先完成并发布准确entry，再启动自有开发CLI `/ui`。不单启Vite，不操作18571窗口/进程。仅真实Task board与原Chat读取加12秒固定延迟，内容/路由/响应原样；这属于手动慢网体验条件，不是UI自动化、fixture或mock。
3. 从已闭合571-after完整schema5/90表数据复制，保留所有原事实/时间/源库bytesmtime/canonical与原资产身份。不发新用户责任、不创建Task/Goal/成员，不调用模型，不复制auth；完整模型目录可用于只读模型投影，Provider请求审计记录实际0请求，若意外出现按事实处理。固定20分钟native deadline，180秒启动无活动，至少五分钟主动收尾；不用观察超时重启。
4. 实页人工检查Task及Chat冷读的实际progressbar名称、busy关联、顶部可见细线；完成后以实际正文/可用输入为正向状态，辅助树与真实属性符合空闲。复核新对话首页及中英文名称、快速改选的当前加载owner；不改store、不注入浏览器内部状态，不用DOM自动断言。每个目标区域截图亲自查看，记录局限；若未运行屏幕阅读器，不宣称语音输出验收。
5. 运行聚焦类型/语言/正式构建/文档检查。UI无需新增非UI测试；保留原非UI服务合同。正常关闭自有页/服务，join原exec，核对native/launcher/物理输出请求及完整数据差异、原资产后清退自有模型目录。归档安全证据及截图、更新三索引/目录README，精确提交、fetch完成/merge upstream/审核全部待推集合/正常hooks push/fresh0/0。未达要求明确保留，整体Goal继续active。

## 启动前资格

标准Node Vite构建完成59.78秒，准确entry main-33iLUm4L.js已发布后才允许native启动；目标完整schema5/90表/197241原行及所有原字段时间保持，构建前后副本DB92295168字节/mtime完全一致，未升级数据库。overlay类型及2语言2535键检查通过。只读身份检查初稿把产品conversation语义误作持久SessionKind，当前session.sql明确kind=assistant，chat/identity唯一分类器按metadata.conversation确定experience=chat；已修正私有检查并以生产分类器重跑，不改数据。选定原Chat ses_hmMOeHbVmtnygDqxg0lA，及原Mission ses_-zURQjvQ8zz3y3NgFyVx（原463验证记录），均从完整历史读取，目录真实存在于自有QA路径。Mission只读其原conversation，加入同样12秒真实GET延迟，不唤醒、新建或提交责任；原带pendingPrompt的另一Mission不选用。

## 实际结果与交付边界

App当前唯一声明已落地，main旧effect删除，两语言统一当前conversation-loading键；现有store/epoch/authority/所有后端控制流及CSS几何布局未改。十五张实图逐张人工复核：英文/中文Chat、Task及Mission均捕获实际progressbar与busy/description，再读取完整原正文后的idle/hidden状态。中文Chat慢读时输入未发送草稿，原正文出现后草稿保持，随后清空。加载标志只由原当前选择owner拥有，UI没有新增状态或数值。

首Task截图已加载完成，不能作为加载中证据。实际请求记录表明Task正常入口是`/task/<id>/conversation`，未命中私有board延迟钩子；第04图与同时属性/辅助树记录直接捕获未修改真实conversation加载，不能把它称作12秒慢读。Chat coding/chat/session与原Mission session/conversation分别真实延迟12秒，实际时序完整保留。没有为观察未命中而重启、延长或重置预算。

第一次回首页发生在Chat已完成后，已将观察标签修正，不能充作快速改选。第二次在同一次人工工具交互中观察到Chat active/busy=true，373毫秒后回首页active/busy=false、hidden=true且description清除；原12秒请求结束后首页/空草稿保持。无新的队列、恢复、并发或终态异常。默认页主输入/建议布局与加号中的Goal入口已查看，原Goal表单/帮助/取消可用且目标字段得焦；没有创建新Goal或执行责任。既有Mission目标已完成状态保留。

公共服务资源头匹配准确main-33iLUm4L.js；原Mission公开conversation200且boardSessionID与原Session一致，原Chat经生产身份分类器验证，原PNG200/643字节与源原件一致。无auth副本、无新模型调用，原Provider审计预算0/请求0/未耗尽；隔离页模型未配置提示属于此只读范围，不误报热认证失败。原数据schema5/90表/197241原行/全部字段时间与canonical保持，原行差异0，provider_activity_request仍490条；源库bytes/mtime与完整模型目录源字节/mtime保持。

公开shutdown200后原exec67010/native/launcher全0，物理/输出/请求清理及原出生链完整闭合，距固定20分钟deadline保留611836毫秒；随后清退复制的模型目录。只操作自有新页/服务，18571未操作。局限：未运行实体屏幕阅读器或语音输出验收；只核对实际辅助功能树和实图，不把它扩大成所有辅助技术已覆盖。当前修复是实际加载语义根因，不是成员Rendering闪烁全场景根治。本批交付四份UI源码、当前架构、记录、十五图及安全证据/三索引，正常提交/拉取合并/全待推集合检查/正常hook推送后记录实果；整体Goal继续active，仍只用一个开发agent。

最终聚焦检查：overlay typecheck、check:i18n（2语言/2535键）、标准Node Vite构建59.78秒、check:renderer-surface（真实公开全局声明与赋值各1，仅模块公共面检查，不是UI自动化）、docs:check（346ops/26groups）、差异检查均通过。没有新增/运行DOM、组件、文案、快照、浏览器fixture或像素自动化测试。
