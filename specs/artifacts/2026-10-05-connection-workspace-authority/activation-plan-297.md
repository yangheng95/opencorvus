# 297 子会话 Open 指针激活调查

## Recall

用户要求持续自主体验、修复 Sources 和子侧栏 Rendering 闪烁；当前明确只用单 agent，本轮只有 root。296 是有效进展：4649154c3 已推送，真实来源原文在 Dock/工具/对话/格式返回时保持读位。开始时工作区干净。原实时闪烁仍未知，当前完整目标保持 active。

296 的真实主进度卡 Open 在鼠标点击后未打开侧栏，卡片纵向位置改变；同一控件键盘 Enter 正常打开。截图与动作记录在 text-owner-296/history-02/12、13。不能仅凭结果判断 handler、虚拟列表或浏览器交互工具是原因。

已读296 Recall、Conversation 的 Virtua 窗口/焦点保留、SubagentProgressGrid、Button、main 的统一 openSubagentConversation、QuotationSelection、dom-utils、对应 CSS 与07-panel架构。全相关入口搜索确认：主进度卡按钮/卡片、agent rail及定位请求都进入同一 openSubagentConversation；按钮实际 stopPropagation 后调用 open。Virtua keepMounted 由当前焦点/读位生成索引集合，库内部与可见范围合并去重。现有hover样式只调整颜色/阴影，未发现显式布局尺寸变化。涉及的测试检索没有发现对应 UI 自动化测试，不新增或运行此类测试。

## 实施前诊断设计与影响

先只临时为真实 Conversation 容器增加模块内观察器，记录 pointerdown/up/cancel、mousedown/up、focusin/out、click 的真实目标、当前 Open 按钮的 DOM（文档对象模型）对象身份/连接状态/矩形、容器 scrollTop 和虚拟窗口高度。指针起点保留为本次观测身份；捕获阶段、microtask与下一 animation frame分别采样，最多保留64条，批量写入既有 AppLog INFO 管道。无正文、配置或凭据内容；不改事件传播、焦点、默认动作、调度或点击 handler，不写页面全局，不通过浏览器注入事件或构造UI夹具。

读取矩形可能影响测量时序，因此诊断仅供归因。移除全部临时代码后必须正常构建和真实点击复核，不能把诊断状态通过当交付。若证据不足则保留未知，不修改点击时机、加延时或把 click 换成 pointerdown。

使用原 Task153 完整真实历史，在独立 dev `/ui`18254 开已有成员；无新 Task、成员、Provider 请求或凭据移交。新实例前重新只读核实原关闭身份、当前 schema、完整恢复前沿和配置，完整90表复制，固定900000ms且留300000ms收尾目标，不因观察超时延长期限。原用户窗口和进程不操作。真实页面交互、截图由root人工复核；types/build仅辅助。生产修复前补齐直接触发、根因、旧路径不足、所有调用与合同、风险和文档范围。

任何真实后台调度/恢复异常立即按共享机制横向审计。每个实例结束关闭自己页面、sole shutdown、原exec实际join、独立物理/输出/请求/端口/配对关闭和19表/47生命周期保管。按范围提交，fetch/merge上游，审核完整待推送集合后正常push。原 Rendering 与本轮指针问题分别报告，不扩大通过范围。

## 实证归因与生产改动前分析

18254/tab46，02-locator-events-read：真实pointerdown坐标(1136,269)在按钮矩形x=1102.927、y=256.604、w=65.406、h=24内；按钮DOM身份一直为2且connected=true，但按钮及虚拟窗pointer-events=none，pointerdown/mousedown/up/click全部以chat-scroll容器为target。03-coordinate-events中滚动结束后同一按钮身份2、同一坐标和scrollTop=531.333，pointer-events=auto，完整事件都到达按钮并实际打开侧栏。没有按钮退休/重挂载证据；焦点保留不是这次事件丢失的原因。

定位点击在派发前引发了滚动，不能据此声称普通静止坐标点击也失败。不过实际已呈现行在任何滚动输入来源下都继承了相同命中抑制；当前Conversation自定义shell直接接受Virtua0.49.3的isScrolling指针优化，交互行没有声明自己的命中合同。因此共享影响面是主会话可见按钮、来源链接与工具控件，而不只是Open handler。子侧栏直接ConversationCard不经过这一虚拟窗，本修复不宣称解释其Rendering。

决定在既有.conversation-virtual-item唯一CSS基础规则声明pointer-events:auto，使真实已呈现内容始终保留原生交互。保留虚拟窗的测量、范围、滚动补偿、背景和默认事件处理，不修改库、按钮事件、服务端或调度，不加时间延迟/重试/第二点击路径。CSS属性可由子元素显式覆盖继承，依据[MDN pointer-events](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/pointer-events#description)；安装库实际Solid发行代码是本版本行为证据，未获取到的GitHub版本URL不作依据。代价是滚动期间可见内容仍参与命中/hover；不扩大挂载范围，真实桌面点击、工具与来源交互人工复核，性能全域仍未量化。

删除临时观察器及唯一接入后正常build，在同一原Native固定预算内刷新自己的46页，复核原定位点击与坐标/键盘路径；若剩余不足收尾目标则先关闭，使用另一个明确正常构建验收实例，不延长原预算。实时流式大规模子会话依然未验。

## 第一阶段闭合

正常build52887实际0（49.73s）。移除诊断后在原18254/tab46复核，原失效的定位点击打开了正确base-researcher，键盘Enter、主会话真实W3C来源和工具展开也通过截图人工复核。46与其打开的47页均关闭，原95962实际0、独立closure与19表/47生命周期保管实际0。唯一生产变更为会话行样式，临时TypeScript没有留在src。继续原目标；本轮没有把主会话命中修复说成子侧栏Rendering根治。

## 交付前交互边界复核与替换

上述行auto通过了点击场景，但横向复核发现Dialog/Kobalte还有body/layer层的pointer-events所有权（Dialog.tsx及当前Kobalte的dismissable layer实现）。子行直接auto会过宽地覆盖祖先限制，不应保留。删除该CSS改动，改在既有VirtualWindowShell适配位置将库传入的pointer-events替换为inherit，其余style完整保留。这样只移除库的滚动期命中抑制，继承外围界面的auto/none，组件自己disabled/inert语义仍有效，不新增第二CSS规则或事件路径。

需要重新正常types/build及独立18255/history-02真实页面复核，包括同一Open指针入口、键盘、命令弹窗的原生外部交互边界。此实例是交付前替换实现的验收，原18254已在余420533ms时完全关闭；绝不续期原实例。此前CSS通过仅作为中间验证，不能代替最终适配层实现。

## 第二阶段启动错误与正确重验顺序

最终types67965与build4467实际0（53.50s），但root错误地将Native启动与构建并行。history-02进程11:23:18已启动，dist-vite/index.html至11:23:27才生成；overlay-ui.ts在路由注册前冻结source，缺失时固定missing。实际服务日志/ui返回308，/ui/返回404，浏览器将失败导航显示为ERR_BLOCKED_BY_CLIENT并留下about:blank。健康API为true不能证明UI可用；这不是认证丢失、浏览器权限结论或观察超时。48页关闭、原16577 join0、正常关闭和独立保管完成，但该阶段UI验收失败，原证据保留。

按真实依赖顺序重验：已实际完成且不再运行构建的最终产物，核对index及其本地资源路径存在后，重新fresh原历史资格、完整复制并启动history-03/18256。该新实例修复已确定的初始化前置条件错误，不延长或重启原02，也不绕过浏览器限制。所有后续UI结论必须来自最终03实际页面。

## 第三阶段验收失败与样式编译事实

03正常加载main-BudIr4v5.js，但原点击仍失败，不能交付。实际虚拟窗style在静止时没有inherit；构建输出TIe静态模板包含pointer-events:inherit，而其动态style更新只保留`{...C.style}`，会在每次库更新时写回none/undefined。由此确认直接JSX中混用spread与静态覆盖被编译为不同写入阶段，常量覆盖未留在动态对象。不是原按钮handler故障。

将完整style对象放入单一createMemo，JSX仅读取memo；每个动态更新都携带最终inherit值，保留其余库属性。03在原预算内关闭、原66849 join0、独立保管0，截图和构建片段保留为失败证据。后续04/18257必须在新build实际完成后启动，人工重验原点击、键盘及弹窗交互。前置资源检查第一次错误假定绝对/assets路径，当前Vite明确base='./'；已按真实相对资源路径核对，不把零匹配当构建失败或新UI实例。

## 最终第四阶段交付

最终types83513/build38693 actual0（50.96s），在build实际完成、实际相对资源存在后启动18257/tab50，main-DBFH-HgM.js。原失效点击与键盘均打开正确成员；命令弹窗出现时body/window/button均继承none、输入框持有焦点，外部点击关闭弹窗后侧栏仍关闭。真实工具展开、来源打开新51页均通过截图复核，50/51已关闭。原95621实际join0，独立closure、19表/47生命周期保管0；四次实例均正常收尾，第二/第三阶段UI失败仍按失败保留。唯一生产改动为Conversation中windowStyle memo及其消费，不保留CSS草案和诊断接入。旧失败bundle已因重建退休，其片段只来自此前实际工具读取记录，详见README。
