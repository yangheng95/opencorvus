# 草稿导出与未解决的保存反馈

## Recall

用户要求持续按批并行体验 UI（User Interface，用户界面）/UX（User Experience，使用体验）、调查功能和缺陷，先分析与落盘，再实际桌面 /ui、截图人工复核、聚焦正向功能测试，范围提交、合并上游和正常推送后继续，直到明确停止。上批 fa5114d26 已通过全部钩子并正常推送，main/upstream 0/0、暂存空；原 177 条工作区更改保留。Sol 凭据授权待答复，本批零模型/零产品消息，不读取、复制或使用凭据。

两个既有代理继续并行只读审计，没有再次委托、编辑或浏览器操作。ui_audit 指出 FileEditorPane.downloadCurrentFile 开始无条件 setError(null)；functional_audit 独立确认同一 error 承载保存/重载/关闭/下载的当前失败，比较按钮从 save_conflict 派生。已读全部 error 写入、下载两入口、唯一 save/write/compare/adopt/reload/leave/内容与权限退役路径、downloadBlob、文件读取/原件下载契约、纯 HTTP（Hypertext Transfer Protocol，超文本传输协议）保存冲突/原件下载测试、纯服务下载授权测试、当前 07-panel 与 11 月 6 日 file-save-recovery、10 月 26/27 日下载记录和本次 b11 普通脏草稿下载证据。

历史证据已证明真实 409/采用基准/焦点恢复，以及普通草稿下载字节；没有找到“409 后下载草稿”组合验收。不能把本批候选说成已承诺全部操作历史保留的回归，也不能说保存数据丢失。代理提出的另一候选是 ServerConnectionSettingsGroup 校验反馈在原地换语言后冻结，留后续批次，不混入本批。

## 修改前根因与影响分析

可观察候选：自有文本加载后写入本地草稿，另一程序修改同一磁盘文件；Save 应真实返回 409/FileWriteConflictError，保留草稿、旧基准和原错误/比较入口。随后 Download draft 只从当前 draft 构建 Blob（浏览器二进制对象），却先清空同一 error，可能让未解决的冲突及反馈 Compare 入口消失。须实页确认，不能凭 setError 行直接当成复现。

直接数据与控制流：downloadCurrentFile 的 text 分支不调用 writer，只 new Blob([draft()])→downloadBlob；base64 分支导出已加载字节，binary 分支按当前项目/资源/权限请求唯一 file/download。现下载开始的 setError(null) 不区分产生错误的操作；冲突比较 action 直接依赖这个被清空的单一 error。草稿、savedBaseline/revision（已加载基准/版本标识）和磁盘此时都未更新，因此 UI 反馈退休没有对应的保存/重载/显式采用事实。

旧路径未根治原因：11 月 6 日只在明确 adoptComparedDiskBase 更新产生冲突的基准时清除该 save_conflict，并限定采用后的焦点意图；这个退休有真实状态依据。下载开始仍把当前动作失败统一清掉，旧普通下载只验证字节，未走先前冲突组合。公共后端条件写入与错误响应无待修证据，禁止更改 expectedRevision、覆盖写入、合成冲突状态或新增自动采用。

若实页成立，最小方案维持一个当前 action error，不复制 priorError、不增加 saveConflict flag/第二错误缓存/汇总器。删除下载开始的无条件清空；在当前资源/权限/下载 controller 仍有效且 downloadBlob 正常返回之后，用 functional setter 只退休当前明确的 file.download_failed。精确判别现有错误身份，不解析错误自然语言或做原因关键字猜测。成功导出保留其它当前动作失败和原 cause；真实新下载失败仍按既有“最新失败”合同替换当前 error，成功重试只退休其自身下载失败。它不承诺同时展示全部历史失败。失败时不恢复旧快照，避免复活已保存/采用/换源退休的错误。

影响仅 FileEditorPane 两下载入口共用 handler 的反馈退休时机与 07-panel 合同。原 compare/adopt/save/reload/leave 的状态与焦点 owner（生命周期所有者）、真实 byte/export（字节/导出）、busy/cancellation（忙态/取消）、API（Application Programming Interface，应用程序接口）、SDK（Software Development Kit，软件开发工具包）、翻译键、schema（数据库结构）和持久格式保持。初始加载错误仍独立 loadFailure，不混入 action error。未知：文本本地 Blob 保存无法可靠制造实际失败；不会用浏览器注入/拦截伪造。真实 binary 文件移动→404→归位可覆盖下载失败/同页重试成功。

当前没有 Task/Mission/Session（任务/多步任务/会话）调度、队列、唤醒、重启恢复、并发或终态异常事实。本次是面板内错误反馈归属，不能据此推断或排除后台共享问题；若真实运行暴露该类事实，按全仓共享机制立即横审。

## 条件方案与真实验收

系统临时根 opencorvus-iteration-20261108-b14，下设 project-before/after 与 profile-before/after；before 开发 serve /ui 38946，after 普通最终构建后 38947。输入仅本批自有 note.txt、显式原文/草稿/外部文稿及 12 字节 payload.bin；不绑定认证或模型目录，不操作用户窗口/进程。先落盘输入及本方案，前态真实交互/截图成立后补根因证据，再改产品。

前态：真实打开 note.txt，输入完整自有草稿；只通过文件系统改本批精确磁盘文件；真实 Save→409，展开 Details 记录原请求身份及比较入口，实际 Download draft 保存浏览器文件并核完整字节，截图同 pane 原冲突反馈是否退休；再次 Save 核真实 409 与磁盘仍外部版，证明后端合同始终正确。

最终：新独立 profile/project/最终普通 build，重复冲突→实际下载→当前错误/原请求 ID/比较入口保持及焦点；中文原地切换时仍保留真实草稿/技术错误并翻译 UI。从原冲突入口比较实际磁盘/草稿，关闭仍回原入口；明确采用现磁盘基准后再 Save，实际磁盘/HTTP 200/完整重开正文一致。按实际可操作路径覆盖未保存决定内错误也保留，但不强行从模态外点击下载。

另用同 pane 的二进制 metadata-only 文件，加载后移动本人精确原件到私有 held 路径，真实 Download→404/FileNotFoundError/完整诊断；原件归位后同入口真实下载成功、字节精确、原下载失败退休。保留 header 与 empty-state 两入口的公共 handler/身份，不新增后备下载路径。独立纯服务/HTTP 正向测试按真实范围执行；无 UI 自动化/DOM 断言/截图基线，不用源码摘要代替对象字节和运行行为。

最终 typecheck/i18n/正常 build/renderer surface/docs:check/architecture-index，截图逐张人工复核。关闭本人页面、正常 POST /shutdown、原启动句柄 exit 0，所有本人的移动文件归位/下载精确移出 Downloads；记录未测分支。精确三索引、范围提交、fetch/普通 merge upstream、完整待推集合复核、正常 push，然后继续。原 177 条用户工作区事实不得混入提交或回退。

## 前态证据与最终决定

38946/main-C3zpoJNv.js、1280×720 真实桌面已复现。初始 HTTP 200/read 与磁盘均为明确 32 字节原文；编辑 54 字节草稿后，仅在本批 project-before/note.txt 写入明确 42 字节外部版，再 Save 得到真实 PATCH 409/FileWriteConflictError，请求 ID 85e15007-7e2d-496d-9f4a-388d644b6c63。01 显示原诊断，02 折叠 Details 后清楚显示原冲突摘要和反馈内 Compare。

原按钮 Enter 实际 Download draft，浏览器交付本人 Downloads/note.txt。54 字节全文等于 input-draft.txt，磁盘与真实 HTTP 200 仍为 42 字节 input-external.txt；03/只读观察显示原反馈退休，dirty 星号和原下载键焦点保持。再次 Save 得到新的真实 PATCH 409，请求 ID 8eda820c-89eb-4acf-a115-1b2fb63374fe（before-observations），证明条件写入仍正确，不能称为数据丢失或基准已经采用。实际下载精确移入本证据目录 downloaded-before-draft.txt，未触及其它 Downloads 文件。

现象、唯一无条件清空调用和实际原字节证据一致。决定按上述成功结果归属方案实施：只在仍当前、downloadBlob 正常返回后，以 functional setter 退休现存下载失败；保存/重载/关闭失败在成功下载时保留。此处 browser handoff（交付浏览器）成功表示原 downloadBlob 正常返回；实际保存仍另以真实下载事件及文件证明，不把函数返回当成用户落盘完成。

before 本人 IAB 31 已关闭、公共 shutdown 成功，原启动句柄 2022 exit 0。after 使用全新项目与 profile，不复活前态或改写前态证据。二进制真实失败优先按已写方案移动精确自有文件；若实际 watcher（文件变更观察）使 pane 自动退役，则先记录现象并改为仅锁定本人原件的真实读取失败，不假造响应或把退役误称下载复现。

已完成当前真实检查器的聚焦正向验收：`bun run test test/server/file-save-conflict.test.ts test/server/file-download.test.ts`，真实 HTTP 保存冲突 1 测试/32 断言、原件下载 11 测试/42 断言，共 12/74 通过；前者实际三个独立进程覆盖外部变更、同时间戳、同/跨进程竞写、重启与路径身份，全部正常结清。后者走真实文件/路由与流关闭，并非网页验收。overlay typecheck、2 语言 2914 键、docs:check 352 操作/26 组及 architecture-index 20 文档通过。无新增/运行 UI 自动化，最终构建/实页待完成。

functional_audit 已独立只读复核最终 diff：成功/失败/最终忙态均沿原 controller/目标/当前权限，换源/权限 effect 与 cleanup 原来就 abort 并清 controller；setter 读取当前错误、其它错误返回原对象，不保存旧快照。没有新平行事实源、条件写入变化或自动采用。二进制真实失败/恢复仍须实页，不以此代码核对代替。

## 最终实现与真实桌面验收

产品仅 FileEditorPane 的原公共下载 handler：删除开始时无条件清空，在 current() 内 downloadBlob 正常返回后 functional setter 只退休当时仍为 file.download_failed 的当前错误。07-panel 同步当前单一失败合同；原后端、输入基准、采用、比较、语言键、下载协议和权限没有改动。普通最终 build 1 分 11 秒、renderer public surface 通过。

新隔离 project-after/profile-after、38947/main-C-qzEdCk.js、1280×720 桌面真实交互完成：

- 初始真实 GET 200 为 32 字节原文，UI 输入 54 字节草稿，仅本批精确磁盘文件改为 42 字节外部版；真实 Save 冲突请求 d760a830-dd8a-4dc5-bb65-3311531accd1。Enter Download draft 后，同一冲突摘要、同一原请求 ID/ApiError/cause、反馈内 Compare 均保留，草稿仍 dirty，焦点仍下载按钮（04/after-observations）。实际浏览器下载 54 字节全文等于输入草稿，磁盘与 GET 200 仍为外部版（after-download-file-contracts）。原生 Tab 到 Reload from disk，键盘自然接续。
- 顶栏 View/Language 原地切中文，草稿原文保持、冲突摘要/控件名称中文，技术 PATCH 409、原请求 ID 和 FileWriteConflictError 保真（05）。原 Feedback 自身已有 overflow:auto；原生 End 从 Summary 将它滚至 338，完整原响应及反馈内比较入口可读（06），没有新增滚动补丁。
- 从保留的反馈内“与磁盘比较”进入，真正读取的对比是 b14-external/changed on disk 与 b14-draft/ready/保留草稿（07）。普通关闭后同一冲突和原入口焦点保持。随后 Close file 打开的未保存决定也自然展示同一原错误与比较入口（08）；Keep editing 正常返回当前文件，不从模态外触发下载。
- 再从原反馈入口比较，明确“保留草稿并采用此磁盘基准”，旧冲突此时合法退休，草稿仍 dirty，比较关闭后的实际焦点回现头部 file-editor-compare（09）。实际磁盘与 GET 200 仍是 42 字节外部版，证明采用本身没有写文件。接着明确 Save，dirty 退休（10）；完整 Close/Open 后显示全部四行原草稿（11），磁盘与真实 GET 200 为操作者明确选择的 54 字节全文（after-save-file-contracts）。
- 同 pane 改开自有 payload.bin，实际 metadata GET 200/type=binary/content=""，原件为明确 12 字节输入。仅把本人精确原件移动到同私有根 held 路径，当前 pane 未退役；正文 Download 入口真实得到 GET 404/FileNotFoundError，请求 19e82c4f-042c-4b86-9521-b9e5876bd2b9（12）。原件归位后同 pane 头部 Download Enter 真正交付 payload.bin，原下载失败退休、焦点留头部下载键（13）。浏览器文件、归位原件、实际独立 GET 200/application/octet-stream 全部等于声明的 12 字节；两个入口均共用原 handler，未增加读取后备或假响应。

前态 01–03、最终 04–13 共 13 张截图逐张人工查看。只读 DOM（Document Object Model，文档对象模型）观察和真实响应/字节回执是运行证据，不是 UI 自动化测试或字符串验收。一次辅助 Python 输出因 Windows 默认 cp1252 无法打印自有中文正文而失败，已改 JSON ASCII 转义重跑；此前真实读/证据写入成功、文件尚未移动，随后才精确移动并继续原实页验收，没有把输出故障当产品失败。

实际三份浏览器下载均精确移入本证据目录（前/后草稿各 54 字节、二进制 12 字节）；只移动已返回的本人下载路径，不扫描其它 Downloads。本人 IAB 31/32 已关闭，38946/38947 正常公共 shutdown，原启动句柄 2022/8346 均 exit 0；自有二进制已归位，无锁/helper 分配。

未独立实页覆盖：保存 404、普通重载/关闭失败后导出、文本 Blob 本地异常、长时间下载时与保存/换权限竞态、原生 Tauri 窗口。保留其它失败的判别和退休边界已只读复核，不能把它说成这些全部实页通过；当前合同仍为一个最新动作失败，新的下载失败可以替换原失败，不承诺错误历史。Sol 授权仍待回答，本批无模型需要、无消息/凭据。

范围提交只含当前 handler、架构、记录、必要自有输入/下载/截图/观察与三索引新入口。最终重跑当前文档检查、保留原 177 条工作区事实后提交；fetch/普通合并上游、审查完整待推集合、正常钩子推送，再继续下一批。
