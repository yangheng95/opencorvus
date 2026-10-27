# 会话下载与离线历史交付

## Recall

持续单agent（代理）深入体验全产品UI（User Interface，用户界面）、UX（User Experience，用户体验）和功能完成度，修复或补齐真实旅程，实际交互/原图人工复核后提交并正常推送；旧Goal（目标）的Astra委托已被后续单agent要求覆盖。已解决的Rendering（渲染）闪烁不重开，不只找同一类小缺陷。前轮属于进展：7bc5084ff4672eaaf1891d3b7c1ebb0be27bfc2f修复恢复归档丢失后页/焦点，106→105实页保持、真实Sol原文和中英/浅深复核，16原图；正常hooks（钩子）/push（推送）0，2026-10-27T07:41:29.311Z新fetch/merge（拉取/合并）0/0，24项交付来源清洁、176项他人改动保持。701/702全部物理/输出/请求结清，认证/模型副本退休，累计真实模型349；源schema（结构）9及原事实保持。

本批不操作用户18571、真实数据库、用户进程/窗口；只新隔离开发服务与自有标签，不建交付分支/工作树、不发同行消息、不发布/tag（标签）/PR（拉取请求）。本轮使用702已经关闭的真实会话历史，不复制认证、不产生新模型消息；读取的正文来自701真实gpt-6.1-sol，不伪造对话或改持久数据凑验收。

## 已读资料、搜索及实施前调查

已读现07-panel的会话身份/历史/共享请求权属、server/routes/export唯一会话导出、getActiveProjectSession项目谱系校验、Session.messages无limit的全持久消息读取、CLI（Command Line Interface，命令行界面）export、共享project-route-context、当前App.ChatViewTitle菜单、conversation-session/api、file-download和artifactFilename现下载原语；搜索全部export路由定义/挂载/SDK（Software Development Kit，软件开发工具包）调用、会话菜单与历史决策。服务器注释明确退役Task JSON/archive导出及导入，本轮不恢复它们。现会话导出只返回所选Session元数据与该Session全部原始Message/Part，不是Mission/Task执行归档、子树打包或重新生成内容。

可观察能力缺口：普通对话菜单只有复制诊断、置顶、重命名、归档，已有GET /export/session/:sessionID没有产品入口。用户保存自己的原始对话必须离开页面。另有代码候选：此只读导出路径未被project-route-context列为identity，默认runtime可能在Provider（模型服务商）未挂载时先失败；需要703真实请求确认，不把源码推断当已复现。现getActiveProjectSession仍必须校验目录和原Session项目，不得用全局路由旁路导出。

尚未修改生产代码。先在703/38208从关闭702整库只读备份，复用已验收main-f9xQwgaU.js，真实开发CLI /ui，无认证/零模型。实际打开原Chat、菜单截图，公开带原目录GET导出，记录状态/错误及相同Session/message读取。若缺口/故障确认，先关闭703并完成根因、影响和定案，再实现及704实页验证。

## 候选实现与验收边界

优先复用现唯一会话导出API（Application Programming Interface，应用程序接口）与downloadBlob/安全文件名；只给Chat/Work原对话增加“导出对话（JSON）”入口，任务/使命归档不恢复。导出JSON（JavaScript Object Notation，数据交换格式）包含后端原session/messages，不能用当前已加载卡片拼接而截掉历史、翻译正文或合成消息。调用捕获当前接口权属及原Session/目录，返回后仍按当前选中身份/代次验证，下载异步失败进入现本地化诊断，忙碌/成功反馈可访问且不泄露后台实现。

若证实Provider耦合，只在现Project路由上下文分类给精确只读GET导出identity，保留项目谱系校验/原HTTP错误，新增聚焦正向测试验证冷启动无模型下原Session/全部原消息输出以及跨项目明确错误合同，不改执行、权限、schema或SDK协议。若发现调度/恢复/队列/并发/终态异常，立即按共享机制全入口/轮次/串并行/多项目审计；当前没有该类证据。

704新正式Node构建、独立开发服务，实际点击菜单下载真实Sol对话，读取真实下载文件并与公开API/原Message/Part逐项核对；再复核原空Work下载、切换项目身份、中文/英文菜单与成功反馈、键盘操作。原数据/用户原话保留；没有认证仍能导出，原消息可读。UI验收只真实交互与原截图人工查看，禁止新增/修改/运行UI自动化；非UI改动聚焦正向测试。每实例20分钟原生物理边界、十分钟目标关闭、至少五分钟结清余量，不重启重置计时；自有标签关闭、公开shutdown200、原exec/native/launcher（执行/宿主/启动器）0、物理/输出/请求结清后退休模型副本。同步当前合同/三索引、文档/类型/构建、范围提交、最新上游合并/待推集合复核和正常push；不把进展宣称全产品完成。

## 703实证、根因与实施定案

703/38208从已关闭702只读复制92表238840行。原Chat同目录GET /coding/chat/session/:id与GET /session/:id/message均200、2条原消息；GET /export/session/:id实际400 ProviderModelNotFoundError。原图01实际菜单仅Copy diagnostics/Pin/Rename chat/Archive，原用户消息和Sol回复仍正常可读。缺口和错误由公开输入输出证实，不由模型自述推出。

根因：共享project-route-context漏掉精确GET /export/session/:id，默认runtime进入InstanceBootstrap的config.validate.models，未挂载配置模型时在导出handler前失败。该handler实际只用getActiveProjectSession与Session.messages，后者无limit完整读取原持久消息；需要Project identity而无需执行模型。旧历史/归档能力修复覆盖session读取/控制，没有覆盖export命名空间。全仓已核对唯一定义ExportRoutes、app挂载及生成SDK；退役的Task JSON/archive与import不重建。CLI自身bootstrap不改，本轮修复公开HTTP读取和产品下载入口。无调度/恢复/终态异常，不扩大成执行状态修改。

定案：在现分类数组增加精确GET导出identity；原Project谱系/404/handler及响应结构保持，SDK和OpenAPI（开放接口描述）不变。新增服务端聚焦正向测试，经真实Server.App路由在冷启动不可用模型下读取Chat/Work、超过100条原消息/Unicode原文并验证完整返回，以及跨项目/缺失ID的明确404合同。测试夹具只作局部合同，不能冒充真实对话验收。

App.ChatViewTitle复用现菜单/图标、apiJson和生成ExportSessionResponse类型、directoryScopedPath、downloadBlob/安全文件名，给kind=chat（含Chat/Work）增加原会话JSON下载。保持API原session/messages全部值，按原标题与Session ID命名，不从可见卡片拼接。导出捕获原目标/接口权属/selection epoch（选择代次）和AbortController（取消控制）；选中范围/连接变化或组件退出取消原请求，返回仍核对相同身份后才下载。原反馈区统一承载复制/导出反馈和4秒清除，菜单显示忙碌、完成提示准确写为“下载已开始”，错误概要本地化、原错误进现诊断详情。仅临时UI请求/反馈状态，不加域影子事实、缓存、配置或二次导出协议。

验收再增加真实695代码对话下载，核对原Tool Part（工具片段）与用户/助手原文；701普通Chat、695含工具Chat和701空Work三种原记录，使用各自真实目录，不发新消息、不改数据。记录真实下载路径/字节及与原API的结构相等，不用可变源码摘要或自己重算期望哈希。异常/空记录走原公开错误而不造备用数据。

703已关闭200，原30174/native/launcher均0，物理/输出/请求结清，余量1142356ms。模型0/累计349，目录副本退休、源认证/目录字节或元数据保持；92表238840源行、7117原关键行、166旧文件及schema9/integrity ok均保持。修改从已关闭状态开始。

## 实现、工具链校正与704真实验收

按定案增加唯一精确GET导出identity；原export handler/Session读取、谱系和响应结构不改。App现菜单只在Chat/Work显示JSON导出，复用生成SDK类型及apiJson/目录/Blob下载，保留原菜单项。原复制反馈区扩展为共享动作反馈，不另造通知或持久状态；范围memo（派生值）只在selection epoch/接口修订/种类/ID/目录改变时触发退休，避免普通行更新误取消下载。每个响应仍按原目标/目录/代次/接口权属复核；原取消控制负责请求中止与卸载清理。既有安全文件名处理标题中的路径分隔和保留Session ID。新增四项中英文案，原消息、文件身份和技术标识保持。

初次测试命令把Bun全局参数传进仓库的逐文件runner（运行器），--timeout/60000被误当文件；新夹具又在assistant已completed后追加Part，命中正确的不可变约束。没有用工具失败当产品失败或改存储约束：修正为仓库test脚本精确两个文件，新夹具先写正文再完成，原失败执行已结清。最终16项正向测试/26断言全通过（新增导出3项/13断言，原上下文13项/13断言），含两个各121条消息的全历史/Unicode合同和跨项目/缺失Session明确404。类型0、普通Node构建0 main-CUI7eQ55.js、两语言2570键0、docs351/26组0。没有新增/修改/运行UI自动化，夹具不是实际模型资格。

704/38209从关闭703整库只读复制92表238840行，旧21Task均终态、唯一当前自动化rev2 paused，零认证/零模型启动真实开发CLI。公开导出原701 Chat返回200/2消息4片段、原701 Work返回200/0消息、原695代码Chat返回200/5消息15片段3工具；用项目B请求项目A Chat为明确404 NotFoundError，项目谱系保持。

真实英文深色菜单点击导出，浏览器实际保存原Chat文件6063字节；跨项目切Work保存213字节，空messages保留真实空态。切中文/亮色、打开原695工具对话，菜单Home聚焦导出、Enter实际保存26489字节；用户/助手/工具原文及所有JSON字段分别与各自公开API逐项相等，原Session ID在文件名和内容中一致。中文成功反馈“对话下载已开始”，不伪称浏览器已保存。现复制诊断实际仍成功。09捕获返回原Chat的加载过渡，另开自有标签88在同一服务原发生轮次等待真实加载完成并查看10，原标题、用户话和Sol正文完整。未重启704；87/88都关闭。

704公开shutdown200，原89306回收0、native/launcher均0，物理/输出/请求全结清，余量852157ms。模型目录副本退休、源认证元数据与模型目录字节/元数据保持；源92表238840行完整保持、目标7117原关键行和166原文件逐项保持，两个专用项目README/Git HEAD保持，schema9/integrity ok。两实例模型请求0、累计349。10原图均人工复核，无凭据摘要归档。

范围为App共享菜单/反馈、精确路由分类、导出正向测试、两语言键、现07-panel合同、本记录/证据和三条索引，176项他人改动保持。没有新模型执行、Task/Mission归档/导入或子Session整树导出；没有制造延迟网络的竞态UI验收，不扩大为全产品通过。最终提交、最新上游合并/完整待推集合和正常push以实际Git/交付回执为准，不能预填尚未完成结果。持续目标仍进行中。
