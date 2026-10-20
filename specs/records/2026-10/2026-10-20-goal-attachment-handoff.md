# Goal 创建与真实附件移交

## Recall

持续单 agent 自主迭代，后续用户单 agent 要求覆盖旧 goal 的三个 Astra 文案，不委托。上一轮属于 progress：f64ab040b9e620303ab40cea88c85b8fff2430aa 已完成正常 push，fresh fetch 确认 HEAD=origin/main。461 在真实项目、全局首页和 SideChat 验证草稿预填/取消、两个 gpt-6.1-sol 流式 Goal，以及真实 quotation 保留；16 张截图已人工查看。113 Project/155 Session、schema 2 的完整隔离 QA412 历史保留，两个 native/输出/请求/launcher 和 runtime/private 凭据+完整模型目录已结算退休。文件/目录附件移交、Task/Mission 分别实操及配置完整保存10s/恢复5s仍未达。本轮开始只有原 .bun/ 和 packages/opencorvus/bun/ 未跟踪。

原始要求是深入体验并修复、Goal 可发现性与默认布局、Sources、Rendering 闪烁；本轮延续真实输入流程，先把文件附件的未验收项变成明确证据，不把引用当作文件。已重读461 Recall、当前 continuous-goal/02-data 附件合同、ChatComposer addAttachment/addFiles/addFolder、attachment-upload、workspace.pickDirectory、主入口 resolver。全仓搜索表明目录选择经 HostTransport workspace.pickDir；浏览器 nativeCommands 声明 false，Tauri 有唯一实现。是否仍展示不可用控件及具体行为未知，必须真实查看。CUA 已选 IAB browserID2，正式 Tab.playwright.waitForEvent('filechooser') / chooser.setFiles 和 clipboard 接口已完整读取；所有 UI 只通过 CUA，不新增/运行任何 UI 自动化或 Playwright test。

## 调查范围、根因分析边界与验收

可观察风险：已上传文件与输入文字在全局/项目首页进入新 Goal Session 后是否仍可见、可继续发送；是否保持同一 Project 归属；表单是否明确 pending 上下文；已有 Goal 创建是否错误消费尚未发送附件的文本。直接触发点是 onStartGoal 的新 Session 创建与选择；461 为这一个创建路径明确 preserveComposerAttachments，普通历史选择仍清 staged 集合。当前单一 staged 来源是 messageStore.chatAttachments，字节已经持久化，Goal API 本身仅接收成果和预算；尚未发消息时不能声称模型读到文件。新 Session 的正常发送需验证 persisted FilePart 的 presentation=attachment-index 和 canonical reference 的原 Project 一致。

未确认具体产品失败前不修改源码。若发现问题，先补齐定义/全部调用、历史决策、数据和公共合同、为何461未覆盖、测试/文档/风险再实施；不能创建第二附件store、复制字节跨 Project、合成用户消息或放宽持久化/权限验证。本轮目前没有调度或终态异常证据；若真实运行发现即按共享 Task/Mission/Session occurrence 机制横向审计。

1. 创建独立 native 开发 /ui occurrence 18743，新冻结461正式构建，使用当前源码后端，保留全部QA412历史；不操作用户18571/窗口/进程/真实用户数据库。自制无敏感内容的 txt 和目录只存在本轮隔离空间。
2. 如实际发送/创建有限 Goal，复制已授权新鲜 auth 与完整 models 成对，预检凭据可用、目标目录投影、实际请求 gpt-6.1-sol 且 streaming；不刷新/交换/写源凭据，不将秘密放入日志/spec/提交。20分钟只界定自有native监管安全寿命，进度/请求验收按现有活动语义，不把观察超时当成终止或重新启动。
3. 真实文件 picker 选本轮 txt；人工查看上传卡片、全局匿名 Project 分配、Goal预填/提示/取消/保留，再通过真实发送验证同一归属、实际模型输出和持久化 FilePart。另实际观察目录入口；原生目录picker在 IAB 不可用时如实限定验收，不能以HTTP目录调用冒充真实选择器。
4. 有 UI 修改则新正式 build 与语言/类型检查，并冻结新前端重新截图；无产品改动则只归档实际证据。非UI合同变化需聚焦正向测试；禁止源码文案、DOM、组件、快照、浏览器fixture或像素自动化测试。
5. 原始 native、物理进程、输出、请求与launcher全部结算后 readonly SQLite 对照全部原Project/Session身份、目录、归属和schema；实际秘密值扫描、runtime/private授权目录成对退休。三索引/文档检查、范围提交；fetch/merge和完整待推提交集合审核终止后正常push，fresh fetch确认。保持原性能和Task/Mission未达项，不创建版本/tag/Release。

## 本轮状态

18743 自有 IAB tab5 已通过真实 filechooser 上传本轮自制 goal-attachment-462.txt。全局首页保留原文字并建立匿名 Project，进入真实新 Session ses_-zURQoMYtzz8WelEaej0 的 Goal 表单后 objective 正确预填且显示 pending 上下文提示，取消后仍显示文件卡片及原文字。已提交一个真实 human 消息，请模型通过 read 读取第二行，运行结果仍待观察。没有创建 Goal 或伪造 controller 消息。

发现并截图复现独立 UI 失败：在浏览器点击 Add a folder，立即弹出 Attachment upload failed，正文暴露 workspace.pickDir/browser 原生命令错误，根本没有选择过目录。根因是 ComposerAttachmentLoaders 不读取已存在的 HostTransport.capabilities.nativeCommands['workspace.pickDir']，无条件展示可操作目录选项；openFolderPicker 只看整个输入是否disabled，然后进入 workspace.pickDirectory，浏览器transport按当前正式合同拒绝。旧461处理的是选定输入的作用域移交，未覆盖宿主能力呈现。

影响面已搜索：目录附件的唯一菜单及 handler 均在 ChatComposer，普通文件选择是浏览器 input[type=file]，不依赖 workspace.pickFiles；SkillMarketPanel 和 TitlebarMenubar 已按同一原生能力声明呈现控件。nativeCommands 单一声明、workspace picker、Tauri 当前实现与严格目录manifest合同正确，无需新增宿主/HTTP/SDK/DB协议或fallback，也不能把浏览器folder入口改成递归上传。本轮不修改调度、恢复、并发、终态或存储合同，没有相应异常证据。

具体修复：ComposerAttachmentLoaders 直接读取现有 workspace.pickDir 能力，浏览器菜单中保留一个明确标为“桌面应用”的禁用目录项及本地化说明；Tauri 能力为true时沿用原正常目录项。handler 使用同一能力阻止不支持的输入，不增加配置或第二事实源。文件入口保持原正式HTML文件选择器。仅改组件和中英语言正文；禁止UI自动化，必须新正式build后在真实浏览器查看中英禁用项、文件仍可上传/发送及Goal移交。桌面原生目录选择器未实际运行时继续记未达，不能凭能力声明称Tauri视觉通过。

## 实施、实际验收与结算

已按上述能力声明修复，不改HostTransport、HTTP/SDK、目录manifest、持久化格式或调度。相关test路径检索没有ChatComposer/该目录项的UI自动化命中；未新增/运行UI自动化。正式 build:overlay --skip-tauri 原45803 exit0，Vite1m5s；overlay类型/语言/renderer表面原32149 exit0，中英2508keys。检查不代替视觉验收。

18743真实新会话ses_-zURQoMYtzz8WelEaej0与上传均属prj_hgqQa1ZLyOzGYXMlkEJr，只有一个真实human提交。模型实际调用read，人工Allow Once后读取3行并返回ATTACHMENT462READY；Sources以原文件名和Attachment呈现，打开精确只读内容。18745新冻结正式前端恢复同会话/文件及回复，英文和中文菜单实际显示禁用的桌面应用目录项，本轮重新通过正式filechooser成功上传同一自制txt。

带真实pending文件及“待发送文件草稿462”创建另一个明确的一轮Goal pev_g0VYZCrcz00MUBQ5p7sw，修改后的确认成果实际执行返回PENDING462READY；累计34515令牌、1/1轮，原文件卡片与文字保留。operator在UI提交完成证据，公开更新协议author=user，不能误写为模型自动完成或虚构operator字段。两套preflight均独立验证凭据可用、完整模型投影与实际gpt-6.1-sol streaming；实际read两次Provider请求及Goal一次均HTTP200/eof、归属原Session/work。

[10张真实1280×720截图](../../artifacts/2026-10-20-goal-attachment-handoff/README.md)均人工查看。源码与实际界面证明文件附件移交、取消/成功创建保留及真实发送读取通过；目录的原生picker在当前IAB没有native-app控制，继续明确未达，禁止用HTTP代替。Task/Mission分别实操、原完整历史配置10s保存/5s恢复仍未达。本轮只对单个附件Sources取得新证据，没有侧agent Rendering的新验收。

自有tab5/tab6关闭；公开shutdown均200，原57863/82413 exit0，物理/输出/请求/launcher结算及runtime复制对退休。readonly SQLite最终schema2、116 Project/158 Session，113/155和115/157两个基线每个原身份/归属/目录保留；persisted FilePart为attachment-index、URL Project与Session一致，source-file路径及sidecar对应同引用，实际字节与原自制输入完整相同。证据查询先误用part.session_id，改为已有message_id关联；完成作者字段先错误假设，读取store/公开route后使用正式payload.author=user；collector重跑exit0。这些为证据工具错误，没有改生产合同或掩盖产品失败。

归档截图/文本、两套native范围及任务源码的实际秘密值扫描通过，两套private auth+完整models复制对随后退休，源凭据元数据未变且未写入/交换/刷新。无用户进程、窗口或数据库操作，无版本/tag/Release。三索引与当前panel架构已同步，docs:check345操作/26组、check:architecture-index20文档均exit0，git diff --check通过；准备范围提交和正常远端同步，目标继续active。
