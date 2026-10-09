# 252 live-01 实际生成与阅读返回失败

独立开发 `http://localhost:18186/ui/`，自身IAB（In-App Browser，应用内浏览器）93；后端为当前4b02a36b216b6b04aaa4e33007b5734373684d8d源码，实际[前端资源](served-assets.json)main-CvIYQtNa.js，251没有前端改动。固定600000ms从Host创建前计算，截止1791579651007（2026-10-09T21:00:51.007Z），累计12个Provider请求预算，真实NativeService（原生服务）范围，不借用Task的15分钟。

## 实际请求与视觉

[原输入](submitted-intent.txt)通过真实输入框发送，最终[只读事实核对](actual-clock-readback.json)与实际用户Message全文直接相等。Main Session ses_-zUSPUcomzz0VzPXrF8z、Project prj_h4zK3Mw2zhPkFP5evqeV，首用户msg_315bd338-6e21-439f-b20e-6fb230a07bad；另一个ses_hmQ8shKzzUxwuklrFChc是现成熟流程生成的真实preflight会话。当前库只有这两个assistant Session，parent_id均为空，没有新子Session。应用正常memory（记忆）/chat/work调用均在实际请求审计中可见，不说成只有一条物理请求。

- [首次真实来源](main-started.jpg)：work 8s、WAI（Web Accessibility Initiative，网页无障碍倡议）介绍页完整标题/域名、下一Tool输入准备。
- [生成中格式](main-sources-progress.jpg)：当时Running（运行中）56s，正文第二节已显示小标题、段落及强调，末句尚未完成；对应[当时只读库](running-canonical-metadata.json)20:52:58.035Z的2405字符未闭合Part。
- [三条来源同屏](main-final-three-sources.jpg)：1m29s、两个WAI页面及MDN（Mozilla Developer Network，开发者文档）的真实完整标题、www.w3.org/developer.mozilla.org域名与正文第一节。三条Source分别为prt_g0VXaVPBJ00wDfU51aJW、prt_g0VXaVQ9300fyHbE1T12、prt_g0VXaVR1W00APgc84E3T，原URL与canonical（持久事实）一致。
- [已结束的记录例子/列表](main-reading-sources.jpg)：名字源自原阅读计划，但实际截图是终态正文第四节附近，不能把该照片当Sources顶部或生成中证据。裸Home命令没有取得预期顶部照片，原因未单独资格化；随后实际鼠标滚动读取来源。
- [第一次来源返回](main-source-return.jpg)在输入附近，[一次滚动后的正文](main-final-sources.jpg)只露出MDN域名边缘，不能代替三条完整来源同屏；最终0.5页上滚得到上述正确区域。只读诊断第一次仅扫描子元素，遗漏#chatScroll自身，scrollables=[]不能证明没有滚动容器；后续[真实自身几何](main-final-reading.json)证明其overflowY=scroll、635高/3423内容、top720。

root亲自查看所有以上截图，没有文案/DOM（Document Object Model，文档对象模型）断言、截图比较、自动化循环或浏览器test（测试）。截图只证明实际观察帧，不代表全部Rendering帧。

## 主会话返回的真实失败

三条完整来源帧的实际只读观察20:55:35.196Z为scrollTop360。点击已有Reply with OK.再返回Main，[即时返回](main-history-return.jpg)/[当时几何](main-history-return-geometry.json)是清空加载中的0/635/635，没有卡片；[加载后的页面](main-history-settled.jpg)/[稳定几何](main-history-settled-geometry.json)20:57:23.496Z恢复全部来源与3681字符正文、固定1m29s，但位置为2787.333251953125末尾。没有把这一次完整数据恢复说成阅读位置通过；不能由观测间隔推断空白持续多久。

初步共享审计发现Conversation.tsx以bottom初始化，treeEpoch（内容轮次）遇bottom意图无条件跟随；conversation-session.ts切换清空UiState、reset和hydrate均bottom；task.ts Task切换/初次hydrate与selected-task-recovery回退重建也bottom；main.tsx Mission会话入口与workspace离开同样明确bottom。现conversation-ui没有Main阅读位置，普通Session不装载Task折叠持久状态。Side与子Dock通过同一scroll controller（滚动控制器）另保存位置，所以不能从这次Main失败推断它们失败，也不能用它们的旧成功缩减共享审计。尚未改生产代码；下一批需覆盖正常/终态、初次/返回、重试/重启、Task/Mission/Session及跨Project/authority（连接授权边界）隔离，先落盘完整方案再实现。

## 正文真实时间与物理闭合

[生成中观察](running-canonical-metadata.json)、[完成观察](final-canonical-metadata.json)和[关闭后直接读回](actual-clock-readback.json)/[当前检查器](clock-readback-checker.ts)：同prt_g0VXaVSJM00Pg5SIg81t、msg_g0VXaVR3n000nzo4aNry保留start1791579131656，end1791579202040，70384ms；Main Message created1791579126847/completed1791579202314、finish stop。主合并卡片覆盖三个Tool步骤与最终正文，1m29s不是Part的70.384秒，两者没有混作时钟。

- [移交完整凭据对](text-part-time-live-252-live-01-provider-pair-staging.json)与[当前preflight](text-part-time-live-252-live-01-preflight-ready.json)分别确认可用凭据、已投影目录和实际gpt-6.1-sol流式请求；没有只复制auth或把目标未投影说成无凭据。
- [实际请求审计](text-part-time-live-252-live-01-final-provider-audit.json)：7次全部gpt-6.1-sol/stream=true/200/reader eof；包括两次memory、一次chat和四次work，真实Model/Source-reader输入输出，不能用配置声明替代。
- 自身93于20:58:47.887Z关闭，唯一[shutdown](shutdown.log)0；原foreground35713实际join0，[原launch输出](launch.log)与[资格记录](text-part-time-live-252-live-01-qualified-surface-completion.json)保留真实结果。没有覆盖原失败/延长固定窗口。
- [原Native终态](text-part-time-live-252-live-01-native-host-settled.json)：Target68380/win32:639271758517809829、Host68164/win32:639271758510221361，20:58:59.819Z正常0，physicalCompletion/outputDrainComplete/requestCleanupComplete（物理完成/输出排空/请求清理）全真。
- [唯一清理](text-part-time-live-252-live-01-physical-terminal-and-pair-cleanup.json)、[独立读回](closure-readback.json)：精确进程退役、18186无监听，复制auth/models均移除，源凭据内容没有进入公开证据。
- [完整当次日志](text-part-time-live-252-live-01-runtime.log)、[HTTP（Hypertext Transfer Protocol，超文本传输协议）时间边界](text-part-time-live-252-live-01-http-summary.json)、[canonical完整元信息](canonical-current-conversations.json)：13711当次日志、376个服务请求观察、未知时间0，经CredentialRedactor处理；只按当前实际出生时间和canonical时间纳入，原私有日志保留。
- [精确自身文件归档](owned-native-pile-archive.json)：所有原命令、观察、只读检查结束后，仅将本次出生的五个.debug.pile逐文件移入私有目录，没有递归清理或操作用户窗口。

公共AX（Accessibility Tree，无障碍树）/日志仅统一换行与行尾空白，原字节私有保存，截图及实际失败事实不改写。本轮没有生产修改，未验证原ResearchStudio子Dock新执行、全帧或全部主题/错误重试。
