# 连接校验反馈的当前语言与诊断

## Recall

用户要求持续按批并行体验 UI（User Interface，用户界面）/UX（User Experience，使用体验）、调查功能和缺陷，先根因/影响分析落盘，再真实桌面 /ui 交互、截图人工复核、聚焦正向功能测试，范围提交、合并上游和正常推送后继续，直到明确停止。上批 bf92f668d 已通过全部钩子正常推送，main/upstream 0/0、暂存空、原 177 条工作区事实逐项保持。Sol 授权仍待回答，本批不需要模型，不读/复制/使用凭据，不产生产品消息。

两个既有代理并行只读复核，无再次委托/编辑/浏览器操作。已读 ServerConnectionSettingsGroup 全实现与唯一 NetworkPanel 入口、唯一 saveConnectionSettings 服务、saveSettings 串行事务/结构与 URL（Uniform Resource Locator，资源地址）准入/持久回执/SettingsActivationError、createWorkspaceDepartureIntent、共享 ServerBaseUrlError/parseServerBaseUrl 五原因、当前 t()/Feedback/formatErrorDetails、两语言现有设置键；全仓搜索具名错误、调用和同语义 setError(t(...))。已读当前 05-config 与 07-panel 的连接/本地错误合同、10 月 5 日 URL/保存授权决策、10 月 14 日 network-feedback-locale 和本次 b12 日志反馈，以及三份相关纯数据/服务正向测试。

代理确认：10 月 14 日只修 NetworkPanel 代理反馈，未改嵌入的 ServerConnectionSettingsGroup；其它 Appearance/General 仍有各自字符串生产者，但没有本批实页证据，不把它们混入。原始错误 formatter（格式化器）不递归标准 Error.cause，不能宣称它已完整展示激活内部原因链。空地址先由结构准入拒绝，真实 malformed 必须用非空 http://，不补第二套校验。

## 修改前根因与影响分析

可观察候选：英文 Network 的 Connection 只把当前完整自有本机地址追加 #b15 并 Save，应得到本地 ServerBaseUrlError(fragment)；同一页面原地换中文，标题/字段会翻译，已 setError(t(...)) 的失败前缀可能仍英文。原错误被 errorMessage 压成 message，未提供既有 Feedback Details；原技术错误的 name/stack 可能不可见。键盘 Save 临时 native disabled 也可能失焦，尚需真实观察，不能从源码直接当复现。

直接根因与控制流：组件保存 {serverUrl,username,password} 局部 draft，clearFeedback/保存代次保持独立原 owner（生命周期所有者）；catch 当场翻译 settings.save_failed 并存纯字符串，或直接存 SettingsActivationError 固定英文 message，render 只打印该字符串。全局语言偏好可在原组件仍挂载时更新，因此存译文不会重新投影。切 Appearance 再返回会销毁局部状态，不能用它证明原地重译。

本地准入边界：saveConnectionSettings 先创建工作区离开意图工厂，但实际 prepare/reservation（离开准备/预留）只在返回闭包内发生。saveSettings 到串行队首，先 bootstrap 结构校验、parseServerBaseUrl，再执行 prepare/native settings.save/确认与连接发布。无预留的全新 profile 中，本机完整地址加 fragment 在这些写入和 checkConnection 前明确拒绝。五原因只有 malformed、unsupported_protocol、query、fragment、user_info，错误不保存原 URL 或它的 cause。类型输入原文和服务身份保持，不在前端再次解析或改写用户地址。

旧路径未根治：历史修复解决唯一 URL/事务/代理反馈，独立连接组件仍保存译文。它的 try 同时包住持久化后的健康检查和工作区刷新，未知错误不能统称“设置未保存”。SettingsActivationError 表示 persisted=true（已确认持久化）且应用失败，必须单独呈现这一事实。原 ApiAuthorityChangedError 在已持久化后的特殊成功分支、FileEditorAdmissionError 取消/过期分支、saveGeneration 与清理不能被局部反馈改写。

条件实施：若实页成立，唯一 error 改为 {cause:unknown}|null，所有清理仍沿原调用；删除仅服务旧字符串的 errorMessage。私有穷尽具名五原因投影到两语言修正说明，未知失败用“连接更新未完成，请查看详情”动作摘要，SettingsActivationError 独立“已保存，但应用失败”。保留原错误对象，用现 formatErrorDetails 接入原 Feedback Details；非 keyed Show（稳定内容所有者）随当前语言呈现，不存译文/第二状态。公共 settings.save_failed 仍被其它生产者使用，不能改其参数合同或全局删除。

如果真实 Save 失焦，仅该按钮以现 aria-disabled/aria-busy 表示忙态，复用已有 if(saving()) return；字段继续原 native disabled，保存快照、串行事务与真实代次保持。不加定时聚焦、全局监听、host 路由或新表单验证。没有 API（Application Programming Interface，应用程序接口）、SDK（Software Development Kit，软件开发工具包）、公共错误/parser、持久格式/数据库结构或配置策略改变。

当前没有 Task/Mission/Session（任务/多步任务/会话）调度、队列、唤醒、重启恢复、并发或终态异常事实；串行偏好事务的已声明合同保持。若运行出现该类事实，按共享机制完整横审，不能以本地校验结论排除。真实原生持久失败/激活失败无法靠注入伪造，本批只保留原服务正向证据与未测界限。

## 条件验收与交付方案

系统临时根 opencorvus-iteration-20261108-b15，新 project、profile-before/after；before 开发 serve /ui 38948，after 普通最终 build 后 38949。无认证/模型绑定，无待离开文件/工作台预留，空密码字段不编辑。仅本人后台页面，不操作用户窗口/进程。

前态从真实 Network 记录当前完整有效本机 URL；仅追加 #b15，经原生键盘 Tab 到连接 Save/Enter，观察真实摘要/焦点；顶部 View/Language 原地中文，不重按 Save，不切 Appearance，截图语言混合是否成立。该错误是发请求前本地拒绝，没有 HTTP（Hypertext Transfer Protocol，超文本传输协议）状态或 Request ID。语言偏好动作会正常持久化已应用的有效地址文档，不能宣称整个旅程没有设置写入；局部无效 draft 不进入该偏好保存。

真实成立后先补记录再实施。after 五安全输入均实际校验：非空 http://；ftp://127.0.0.1:<自有端口>/；当前完整本机地址加 ?b15=public-placeholder；加 #b15；http://b15-public-placeholder@127.0.0.1:<自有端口>/（仅明确公开占位用户名，无密码/真实秘密，不做认证请求）。每个只含对应非法成分，按真实当前端口填写；英文触发后原地换中文，不重触 Save，逐张查看正确说明及原草稿，fragment 可再返回英文。展开 Details 核原 name/message/stack，不捏造 reason 属性、HTTP/请求 ID 或完整 activation cause 链。

明确验证 Save 后实际焦点/下一 Tab、修改输入原反馈退休和最终恢复原有效地址；不按有效 URL Save，不测试真实凭据/认证/外部服务。若覆盖空地址，它是结构错误，用本地动作摘要+真实 Details，不误报 typed malformed。activation 等不可达故障只由原聚焦正向事务合同支持，不冒 UI 端到端。

不新增/运行 UI 自动化、DOM（Document Object Model，文档对象模型）/文案/组件/快照/截图基线测试；现纯协议 server-base-url 和 overlay server-base-url/settings-save-transaction 测试已读，按最小范围执行，不能替代实页。另跑 overlay typecheck（类型检查）/i18n（Internationalization，国际化）/正常 build/renderer surface、docs:check/architecture-index。本人页面正常关闭、公共 shutdown、原启动句柄 exit 0；精确三索引、范围提交、保留原 177 条状态、fetch/普通 merge upstream、完整待推集合复核与正常 push 后继续下一批。

## 前态事实与最终决定

38948/main-C-qzEdCk.js、1280×720 真实前态确认：完整有效地址实际为 http://localhost:38948，仅追加 #b15，经原生 Tab 三次到 Connection Save、Return 得到英文 local fragment 拒绝（01）。稳定完成时焦点仍 Save，native disabled=false，下一 Tab 正常到原 network-proxy-llm-provider 输入；失焦候选被本次实际否证，**不修改原按钮/字段 disabled、busy、焦点或 guard**，不把其它长时路径也说成通过。

同 Network 原地 View/Language 切中文，不重按 Save，标题/字段中文而错误仍完整英文（02）。再用同 invalid URL 真正 Save，出现“设置保存失败：Server URL must not include a fragment.”（03），说明只延后外层翻译不足：校验说明本身属于本地产品摘要，需要从具名 reason 投影。两次都未展示 Details；本地错误没有服务请求身份，不捏造 HTTP 状态/Request ID。before-observations 保留原输入、状态与焦点事实。

最终决定：按原始错误单源、具名五原因当前语言说明、未知动作级摘要、已持久化激活失败独立摘要和现 formatter Details 实施；保留保存/清理/事务原实现。恢复原有效输入后未按 Save，本人 IAB 33 关闭、服务正常 shutdown，原启动句柄 75233 exit 0。after 从新 profile 和最终构建覆盖五安全原因及真实诊断，前态证据不改写。

已完成纯数据/服务聚焦正向测试：transport-protocol server-base-url 33 测试/71 断言（包含原 25 输入协议语料）；overlay server-base-url/settings-save-transaction 13 测试/61 断言，共 46/132。后者的原生 transport/storage 为隔离适配器，证明本地事务/持久与 applied/confirmed/cause 合同，不冒原生窗口或实页激活故障。overlay typecheck、2 语言 2921 键、普通 build 56.62 秒/renderer public surface、docs:check 352 操作/26 组、architecture-index 20 文档通过，未新增/运行 UI 自动化。

两代理最终只读复核无必须修正项；ui_audit 提出 query 包含空 ?，中文“查询参数”略窄。采纳为“查询部分”，没有改 reason/算法；因新的实际文案调整重新正常构建与 i18n，不重复无新疑点的纯协议/事务测试。最初 after 服务在任何浏览器页面创建前已正常 shutdown、原句柄 48135 exit 0；最终构建完成后用原自有新 profile/38949 启动 after-final，不把未被实页使用的中间构建当最终视觉证据。

## 最终实现与真实桌面验收

最终普通构建 1 分 1 秒、renderer public surface 通过；实际 after-final 38949/main-BydIgfm3.js、NetworkPanel-D5TKXP8n.js、1280×720 桌面。产品只改独立 Connection 组件、七个双语键及 07-panel 合同。error 单源存原 cause，私有具名 reason 投影摘要，非 keyed Show 保留 Feedback/Details。原 errorMessage 删除；事务、按钮/字段 busy/disabled、清理代次与公共 parser/错误合同未改。

真实页面完成：

- 片段：本机原有效地址实际 http://localhost:38949，追加 #b15，原生 Tab 三次到 Save/Return，英文摘要直接说明移除 fragment（04）。Save 焦点保持；下一 Tab 真正进入 Summary、Return 展开原 ServerBaseUrlError/message/stack（05）。原地顶部 View/Language 切中文，不重按 Save，摘要和 Details 名称中文、同一原诊断保持、details.open=true（06）；再回英文仍为同一错误/打开状态（after-observations）。
- 非完整地址 http://：英文真实拒绝后只切语言，分别显示“Enter a complete, valid server URL.”与“请输入完整有效的服务地址。”（07/08），原输入保持。
- 不支持协议 ftp://127.0.0.1:38949/：英文拒绝和原地中文分别说明 HTTP(S) 要求（09/10），不发起 FTP（File Transfer Protocol，文件传输协议）连接。
- 查询：原地址加 ?b15=public-placeholder，英文拒绝和原地中文说明移除 query/查询部分（11/12）。另在中文输入只有尾随 ?，真实仍为同一 query 原因及“查询部分”修正说明（15）。
- user_info：只输入公开 b15-public-placeholder 用户名、无密码的自有本机 URL，真实在准入处拒绝；原地中英文均指导移除内嵌用户名/密码并用独立字段（13/14）。这不是认证/凭据验收，没有使用真实秘密、编辑密码或请求认证。
- 结构边界：输入空地址，真实 TypeError: persisted overlay settings payload is invalid，当前中文动作级摘要与原 Details 可读（16）。没有把它误映射为 ServerBaseUrlError/malformed，没有前端二次校验。此路径同样 Save 后焦点保留，Tab/Return 展开 Summary。
- 最终仅编辑恢复原有效地址，原反馈退休、输入焦点保持、密码仍空（17），没有按有效 URL Save。返回主界面实际连接诊断为“在线 · 端口 38949”；再真实打开设置/Network，新挂载 draft 从已应用事实读取原 http://localhost:38949、无旧反馈（18/after-observations），证明非法草稿未作为连接发布。语言偏好本身沿原事务正常保存，不把整个旅程说成零偏好写入。

前态 01–03、最终 04–18 共 18 张截图逐张人工查看；观察文件只读保留实际输入/摘要/原技术诊断、焦点、Details 打开状态与最终连接标签，不是 UI 自动化或文案断言。五原因各自真实英文触发、原地中文均完成，键盘 Save 焦点一直保留，因此本批没有添加焦点修复。

纯协议/服务正向 46 测试/132 断言、typecheck、i18n（Internationalization，国际化）2 语言/2921 键、最终普通 build/renderer、docs:check 与 architecture-index 通过。原生持久化 adapter（适配器）失败/SettingsActivationError 的持久/applied/confirmed/cause 合同有原纯服务证据；本批没有伪造实际页面激活失败。formatErrorDetails 不递归标准 Error.cause，不能宣称原生激活内部链已视觉验证。

未独立实页覆盖：真实原生持久或激活故障、持久化后健康检查/工作区刷新异常、长时 Save/切权限与并发偏好竞争、有效端点切换、真实密码/认证、原生 Tauri 窗口及其它 General/Appearance 字符串生产者。未知失败摘要只表示连接更新未完成，不误断言一定未持久化。零模型/产品消息，Sol 授权仍待回答。

本人 IAB 33/34 已关闭；before 38948 原句柄 75233、未使用中间 after 38949 的 48135、最终 after-final 38949 的 53301 均公共 shutdown 成功并 exit 0。无额外锁/helper/下载资源。最终只提交本批四个产品/架构文件、记录、必要截图/观察和三个精确索引入口；保留原 177 条工作区更改，正常提交、fetch/merge 上游、完整待推集合复核、正常钩子 push 后继续。
