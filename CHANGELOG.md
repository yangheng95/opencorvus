# 更新日志

本文从 `0.0.35beta` 的完整功能基线开始，逐版本记录新增、调整与修复，也保留已删除发布页和未公开候选的记录。历史日期取自保留的版本源码，原始发布状态以相应回执为准。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)；产品版本使用 `0.0.35beta` 形式，代码元数据使用对应的 SemVer（Semantic Versioning，语义化版本）形式 `0.0.35-beta`。

## 未发布

## 0.1.26 - 2026-10-14

### zh-CN

#### 新增

- Chat、Task 与 Mission 支持持续目标模式，保留目标、状态和执行进展；重开与进程恢复沿同一持久化目标继续。

#### 调整

- 原始压缩证据提供可分页的事实目录树；读取完整用户文本、工具输入输出、失败诊断及调用来源时保留原消息身份和可用响应预算。连续压缩继续引用原始持久化事实。
- Git 源条目读取与暂存共用物理条目定义，正确处理链接、文件/目录类型变化和真实索引事务；生成提交信息时缺少模型配置会显示可操作的设置入口。
- 整合十项 Dependabot 依赖升级，并更新工具目录、权限执行结果与进程恢复的后端契约验证。

- 归档页支持搜索全部已归档工作；查询覆盖未加载的分页记录，清除搜索恢复列表，恢复记录后保留当前查询。

- 更新日志按界面语言显示独立的中文或英文正文、摘要、搜索结果、日期和官网链接；历史版本保留原始日期、来源和发布状态。
- 待办状态与优先级、专家团演进统计、提交说明和用量单位使用现有国际化目录，日期与数字格式跟随界面语言。

#### 修复

- 通道页的保存、加载和教程错误使用当前语言摘要，并可展开原始详情；错误持续保留供查阅。公网地址保存失败后保留输入草稿，修正问题后可直接重试。

- 生产专家团与可移植模板的包修订 `2026.10.14.1`（2026-10-14）统一使用集合委派，单成员使用一成员集合；修复 OpenAI 单步工具调用策略下独立成员被逐轮串行安排的问题。平台 `orchestrator-base` 能力集同步改用集合委派，引用它的冻结包使用当前平台定义；已绑定任务保留原包字节、显式能力引用与历史，已安装包通过现有授权更新流程接受新修订。

- 通道目录说明、编辑字段和提示跟随当前界面语言，技术示例保持原值，并分别呈现配置与运行状态。通道 API 使用 labelKey 与 example/hint 占位结构，客户端应使用同步更新的 SDK。

- 清空或删除配置后，界面接收完整服务器快照并同步移除旧字段；修复通道公网地址清空后重新显示旧值的问题，保留原项目和请求归属。

- 通道公共 URL 在保存前执行字段校验，非法输入保留草稿并显示当前语言的行内错误；修正地址及大小写 HTTP(S) 可正常保存。

- 网络设置中的校验、保存与删除反馈跟随当前界面语言；切换语言时保留原草稿和错误，原始失败详情可展开查看。

- 代理测试期间编辑连接草稿后，迟到的结果按原草稿退休；测试按钮仍等待真实请求结束再恢复，可继续测试当前输入。

- 命令面板使用 Chat/Work 的统一体验图标，并在工作项提示中显示类型与项目；同项目同名记录可清楚区分，原始标题和选择目标保持。

- 正常助手消息完成时同步关闭已成功工具的权限续行；静默写入、导入与相同完成重放共用原事务。退休写入失败保留真实错误并回滚本次消息发布，已提交的工具结果继续可恢复。

- 工作记录和归档搜索支持真实的 Work 会话类型，改名后的会话仍可按类型查找；命令面板使用服务器接受的工作项，保留 Mission 子项和本地命令的原筛选规则。

- 权限执行开始与原进程租约同时提交；另一个后端恢复时确认原执行者确已退出，避免活跃工具的真实结果被抢写为未知。恢复按原项目、尝试和租约收敛，租约自然到期不被当作进程死亡。

- 问题选项的短标题与说明分行显示，并为实际选择控件提供独立名称和描述；说明可原生点击选择。键盘选择保留侧聊标题、目标和输入区的位置，现有技能与连接复选框使用当前语言名称。

- 定时任务的日期、基础重复频率和星期跟随当前界面语言；列表、详情与搜索共用摘要，高级日历规则保留完整原表达式。

- IPv6 模型服务商的自动标识保留压缩零段的位置，两个非零段相同但零段位置不同的地址可分别保存。已保存的服务商标识保持不变。

- 新增本地模型服务商时，自动标识保留完整 IP、localhost 或 IPv6 地址及非默认端口，同一地址的不同端口可分别保存；编辑已有服务商时保持原标识。

- 侧聊自动重连时使用当前连接状态显示提示，原断流诊断保留在日志；真正的会话与操作失败继续显示。重连后的同一问题保留可编辑草稿和原回答归属。

- 问题历史按当前语言显示空标题和真实终态，区分到期与基础设施关闭；原问题正文、答案和时间保持，切换语言后历史提示同步更新。

- Skill 安装与 MCP 新增失败时，提示和原诊断显示在当前表单的提交区域，保留输入与原提交焦点；收起表单后仍可查看诊断，迟到响应遵循原项目归属。

- 本地 Skill 来源的目录缺失、路径为文件或目录为空时返回明确的 400 错误，包含路径与原因；有效目录及目录链接继续按原配置与目录发现流程安装。

- Skill 与 MCP 资源操作使用当前语言的简短摘要，原始诊断和可用的真实请求 ID 可展开查看；关闭反馈保留表单输入，目录警告沿同一反馈状态呈现。

- 服务商行的模型数量、摘要和搜索使用同一公开目录，正确显示空声明或部分覆盖继承的模型；编辑继续保留原配置覆盖。目录读取失败时显示本地化未知状态，成功重读后恢复。

- 服务商全局凭据保存跨项目完成后，当前面板按实际服务商清除过期连接测试；项目配置保持目录范围，并行服务商测试独立收敛。此项覆盖当前前端实际收到的接受回执。

- 服务商连接测试从有效目录选择默认模型，空模型声明继续可测试；零有效模型与配置不可用保持明确原因。结果使用当前语言摘要、实际模型身份和可展开的原始模型回复或完整诊断；保存配置、Key、删除及目录刷新后退休对应旧结果和在途回写。

- 同页重连保留待答问题的自定义草稿，主会话与侧聊使用完整待答快照和同一请求身份。回答、拒绝、超时及基础设施结束按原始事实收敛；延迟问题事件和 Task 恢复不会重新打开已结束请求。

- Git 检查点保持原工作目录和冻结仓库身份，修复 Windows 长目录显式 Git 参数导致的基线失败；操作系统原生进程目录限制仍需单独处理。

- 独立 Chat 与侧聊显示真实待批准权限，冷加载和重连恢复同一请求；实时事件保留原请求说明和时间，取消或失效按真实账本清理卡片。回复后仅刷新仍被选中的原 Task。

- 拒绝工具操作后，将真实工具错误交给下一次流式模型请求形成正常回复，修复会话停止在 tool-calls 并报缺持久回复的问题；删除旧 continue_loop_on_deny 停止选项，现有权限和取消契约保持。

- Task 看板的 HTTP 条件校验使用完整响应投影，修复状态、身份、项目名称或任务标题变化仍返回旧 304 的问题；响应正文与 ETag 使用同一份快照。

- 服务商保存配置后立即重读当前目录，即使没有填写密钥；已提交但协调失败的配置保留保存事实，密钥、清理和目录问题分阶段显示。原操作完成不会覆盖取消重开或跨作用域后的新表单。已提交配置回执的完整快照不再进入错误详情或持久诊断，业务读取仍保留原配置。

- 服务商允许保存空模型声明，并可稍后添加或发现模型；名称、地址和环境变量编辑保留当前声明及并行新增模型。项目覆盖删除可恢复全局模型，仍被引用的自定义模型保持明确错误。配置合并正确持久化空对象并归一化嵌套删除标记。

- 配置语法错误仅显示错误码与行列位置，避免将配置全文及展开的环境变量或文件内容带入诊断；保留配置路径、原解析顺序和读写语义。服务商操作使用简短的当前语言摘要与可展开详情，准确保留已保存及后续失败的事实，两个刷新入口各自恢复。

- 零模型服务商正确显示已保存或已配置的 API Key；凭据、配置或目录读取失败时显示状态暂不可用，恢复后重新确认。行内与编辑输入使用同一事实，OAuth 登录不会被误当作 API Key，模型选择继续只显示真实可用模型。

- 已保存密钥的服务商可在尚未配置模型时发现模型；OpenCorvus 实时目录刷新可恢复空模型目录或已被模型筛选清空的目录。全局与项目地址按各自配置解析，模型选择仍只显示真实可用模型。

- 表格的工作表标签、侧栏和通知名称随界面语言切换；已打开的保护范围列表同步更新标题与正文，并保留工作表编辑、侧栏选项和宽度。

- 鼠标点击表格侧栏按钮并交回编辑焦点时保留聊天读位，修复普通视图跳回上方导致点击未完成的问题；现有内部导航、编辑和当前视图 CSV 导出继续可用。

- 表格原生按钮保留激活前的键盘焦点，可通过Tab、Enter和Space操作权限详情、范围弹窗、缩放与工作表菜单；原有菜单执行后的编辑回焦继续有效。

- 修复深色主题下保护范围卡片悬停时浅底白字难以阅读的问题；编辑、删除悬停区和规则说明使用既有主题配色，普通与全屏视图保留当前规则及界面语言。

- 表格范围选择与删除确认框的关闭名称跟随当前界面语言；已打开的范围框切换中英文时保留草稿、布局及原有鼠标和键盘关闭行为。

- 稀疏项目配置继续继承未声明的全局设置，修复保存无关字段会覆盖提示配置、授权模式和嵌套默认值的问题；明确项目覆盖保持有效，读取、保存候选与可写源使用同一配置契约，已保存的任务与权限策略保持其原事实。

- 表格权限面板的新增详情和确认返回列表保留当前语言标题；范围校验信息随语言切换更新，原范围、说明和权限选项继续保留。

- 可编辑表格明确提示编辑仅保留在当前视图，离开或折叠前可下载修改后的工作表；说明 CSV 仅保留单元格值。提示随语言切换，全屏仍保留完整工作表操作区域。

- 服务商搜索的显示数量与实际行集合一致，修复已配置项被目录重复计入总数的问题；服务商、发现模型、模型选择与用量统计共用模型数量翻译，英文单模型使用正确单数，发现成功提示跟随当前界面语言。

- 修复电子表格全屏时工作表菜单、颜色对话框、缩放菜单和提示不可见的问题；子菜单重复打开保持可用，关闭父菜单后同步收起。全屏与语言切换保留当前工作簿及编辑导出。

- 修复 MCP 合法空文件、音频内容和资源链接导致整个工具结果失败的问题。音频保存为附件并保留当前模型传输限制；资源链接保留原始引用信息。

- Venice 流式请求使用正确的用量参数，并保留每次调用的显式选择；修复 Token 总量重复计入输出、缓存输入重复计费和推理分量丢失的问题。历史账本保留原记录，不重算。
- 关闭或重启服务时先取消所有项目的后台工作，再等待其物理清理完成，修复 Memory 整理等后台任务反向等待停机取消而卡住的问题。

- 修复原生服务在工具等待批准时关闭超时的问题；关闭与重启共用真实取消和监听器排空流程，失败回滚保留原归属，并维持5秒超时失败退出的边界。

- 通用 MCP 工具保留结构化结果正文，超限时可保存完整文件并继续读取；合法空文本资源不会再使整个结果失败。

- 用户附加的 MCP 资源保留合法空文本和零字节文件，混合内容按原顺序呈现；普通 Chat 续聊正确绑定所属项目的附件，保留原始引用、文件名与严格字节校验。

- 电子表格产物的类型名称与工作表菜单跟随界面语言；切换语言保留当前编辑值、公式结果和选区，导出继续使用当前工作簿。

- Provider 表单的地址错误、保存和发现入口使用同一校验，修复已标为无效的地址仍可添加的问题；仅编辑其他字段时保留当前声明的地址与模型配置。

- 修复全屏产物中按 Enter、空格或向下键打开下载菜单时页面卡死的问题；关闭菜单后可继续键盘操作，保留文件阅读位置。

- 用量热力图可用键盘逐桶查看完整时间区间、时区偏移和 Token 数值；加载时保留检查入口，修复快速刷新后按 Tab 丢失焦点的问题。
- 能力搜索完成事务保留模型工具请求的原始元数据，修复 OpenAI 等带注释请求在成功搜索后被误判为不可变事实冲突的问题。
- 投影包工具和 MCP 工具保留已验证的执行授权，超限结果可按原有合同保存到所属 Task/Session 的完整输出文件。
- 产物复制与下载的忙碌状态保留键盘焦点，完成后可继续操作；类型徽标跟随界面语言，原始标题、文件名和内容保持不变。
- 网页读取保留 Markdown 硬换行、代码缩进、空行和原生文本的换行符，避免通用空白清理改变正文含义；输出预算按实际保留内容计量。
- PDF 阅读器支持网页引用与文档内部链接，键盘可聚焦和打开；跳转遵循文档目的地并显示本地化失败提示，缩放、旋转和文字选择共用原页面几何。
- 用量统计正确覆盖半小时夏令时和午夜切换的自然周期，修复部分调用漏入时间桶、错分到上一周期或周期终点越界的问题。
- 用量周期选择和刷新保留键盘焦点，可连续切换周期并继续操作；加载时显示当前请求状态。
- 网络代理设置保留用户名和密码的首尾空格及字面百分号，修复保存或发起请求时认证信息被改写的问题。此前已被裁剪并保存的内容需要重新输入。
- 清空代理认证字段后保存会移除当前配置中的旧值，修复清空密码后又被回填的问题。
- 搜索框清除后可直接继续键盘输入；清除操作遵守输入框的禁用状态，并保留页面原有的搜索行为。
- 文件读取和技能附属文件的长行截断保留完整 Unicode 字符，修复边界处的 emoji 或补充平面汉字变成乱码的问题。
- 修复英文版本搜索结果的单复数，以及更新日志固定使用中文语言属性和官网入口的问题。
- 修复官网文档切换语言后返回首页又恢复旧语言偏好的问题；文档与其他官网页面共用同一语言偏好。
- 补齐中文文档代码框的终端标题、复制提示和反馈；源文件 URL 使用对应文档集合的语言。
- 模型服务商的地址校验说明改为页面可见的本地化提示。

#### 用户影响与已知限制

- 已建立受支持数据库基线的数据使用版本化自动迁移，升级前创建备份并保留历史、原批准和结果。尚未版本化的旧库返回 `SCHEMA_BASELINE_REQUIRED` 并保留数据，需要独立且明确授权的维护；程序不会自动删除旧库。
- 压缩的原始证据保留和预算处理已有改进，但长用户文本、多次授权修订与连续压缩的真实模型测试仍有失败，不保证模型准确沿用最新指令，也不宣称已达到 Codex 等效或无损语义压缩。
- Linux/macOS 上，Bun 运行时仍可能错误解析包含字面反斜杠的合法文件名，影响路径读取与实体身份校验；[上游问题仍在处理](https://github.com/oven-sh/bun/issues/33403)。保留原测试与诊断，不将 Windows 验收当作跨平台问题已修复。

### en-US

#### Added

- Continuous goals are available in Chat, Task and Mission, retaining the goal, status and execution progress. Reopening and process recovery continue from the same persisted goal.

#### Changed

- Original compaction evidence has a paged factual directory tree. Reading complete user text, tool inputs and outputs, failure diagnostics and call provenance preserves source-message identities and the available response budget. Repeated compaction continues to refer to the original persisted facts.
- Git source reading and staging share physical entry identities, including links, file/directory type changes and actual index transactions. Commit-message generation shows an actionable settings entry when model configuration is missing.
- Integrated ten Dependabot dependency upgrades and aligned backend checks for tool catalogs, permission execution results and process recovery.

- Search all archived work from Settings, including records beyond the loaded page. Clearing search restores the list, and restoring a record keeps the current query.

- Release notes use independently authored English or Chinese bodies, summaries, search results, dates and website links according to the interface language. Historical dates, sources and release status are retained.
- Todo statuses and priorities, squad-evolution statistics, commit labels and usage units use the existing translation catalogs. Dates and numbers follow the interface language.

#### Fixed

- Channel save, load and tutorial errors use the current interface language with expandable original details that remain available for review. A failed public base URL save preserves the authored draft for correction and retry.

- Production Expert Squads and the portable template use collection dispatch in package revision `2026.10.14.1` (2026-10-14), including one-member collections. This fixes independent workers being scheduled serially under OpenAI's per-step tool-call policy. The platform `orchestrator-base` capability set also grants collection dispatch, and frozen packages referencing it resolve the current platform definition. Bound Tasks retain their original package bytes, explicit capability references and history; installed packages receive the revision through the existing authorized update flow.

- Channel descriptions, editor fields and hints follow the current interface language while preserving technical examples and separate configuration/runtime states. The channel API now uses labelKey and example/hint placeholder descriptors; clients should use the updated SDK.

- Complete server configuration snapshots now retire removed fields in the interface, fixing a cleared channel public URL reappearing while preserving project and request ownership.

- Channel public URLs are validated before saving, retaining invalid drafts with a localized inline error. Corrected addresses and case-insensitive HTTP(S) schemes remain supported.

- Network validation, save and delete feedback follows the current interface language. Switching languages preserves the original draft and error, with original failure details available in the existing disclosure.

- Editing a proxy draft retires an in-flight test's result for the previous draft. The test button still recovers after the actual request settles, allowing the current input to be tested again.

- The command palette uses the shared Chat/Work experience icons and shows each work item's type beside its project, making equal titles within one project distinguishable while preserving original titles and selection targets.

- Completed assistant messages now retire successful permission continuations in the same transaction, including silent writes, imports and identical completion replay. Retirement failures propagate and roll back that Message publication while preserving previously committed Tool results for recovery.

- Work Ledger and Archive searches match the canonical Work conversation experience after renaming. The command palette uses accepted server items while retaining its Mission descendant and local action filters.

- Permission execution starts and its original process lease commit together. Recovery verifies that the original executor has exited before settling an unfinished attempt, preserving live tools' real results. Recovery retains the exact project, attempt and lease; natural lease expiry is not treated as process death.

- Question options show separate short labels and descriptions with distinct input names and supplemental descriptions. Descriptions support native click selection. Keyboard selection preserves the Side Chat header, goal and composer positions, and existing skill and connection checkboxes use names in the current language.

- Scheduled task dates, basic recurrence descriptions and weekday names follow the current interface language. Lists, details and search share the same summary, while advanced calendar rules retain their complete original expression.

- IPv6 provider IDs preserve the position of compressed zero segments, so addresses with the same nonzero groups in different positions can be saved separately. Existing provider IDs remain unchanged.

- New local model providers derive their IDs from the complete IP, localhost or IPv6 address and non-default port, allowing services on different ports to be saved separately. Editing retains the existing provider ID.

- Side Chat reconnect feedback follows the current connection while preserving the original interruption diagnostic in logs. Session and action failures remain visible, and the same Question retains its editable draft and answer owner after recovery.

- Question history localizes empty titles and actual terminal outcomes, distinguishing deadlines from infrastructure closure. Original questions, answers and times are preserved, and history labels update with the current language.

- Failed Skill installations and MCP additions show feedback and original diagnostics beside the current form controls, retaining input and submit focus. Closing the form retains its diagnostic, and late responses keep their original project ownership.

- Local Skill sources report a typed 400 error with their path and reason for missing, non-directory or empty directories. Valid directories and directory links retain the existing installation and discovery flow.

- Skill and MCP resource actions show localized summaries and expandable original diagnostics, including the actual request ID when available. Dismissing feedback retains form input, and directory warnings use the same feedback state.

- Provider model counts, summaries and search use the public catalog, including models inherited by empty or partial configuration. Editing retains the original overrides. Catalog read failures show a localized unknown state until a successful reload.

- Accepted global provider credential saves retire the affected connection test across project navigation. Project configuration retains its directory scope, and parallel provider tests settle independently. This covers accepted responses received by the current frontend.

- Provider connection tests select the default model from the effective catalog, including inherited models with an empty declaration, and distinguish unavailable configurations from zero models. Results show localized summaries, actual model identity and expandable original model output or complete diagnostics; accepted configuration, key, deletion and catalog changes retire the corresponding observations and late completions.

- Reconnecting the same page preserves custom drafts for pending questions in the main conversation and Side Chat. Complete pending snapshots retain request identity; original answers, rejection, expiry and infrastructure termination converge without delayed events or Task recovery reopening a resolved request.

- Git checkpoints preserve the original workspace and frozen repository identity while fixing baseline failures from explicit Git directory arguments on Windows long paths. The native operating-system process-directory limit remains a separate limitation.

- Standalone Chat and Side Chat show real pending permissions and restore the same requests after cold loading or reconnection. Live events preserve the original request summary and time; ledger-backed cancellation or staleness retires the card. Replies refresh a Task only while its original selection remains current.

- A denied Tool action passes its real error to the next streamed model request for a normal reply, fixing Sessions that stopped at tool-calls and reported a missing durable reply. The former continue_loop_on_deny stop option is removed; permission and cancellation contracts remain intact.

- Task Board HTTP validators identify the complete response projection, fixing stale 304 responses after state, identity, project-name or Task-title changes. The body and ETag use the same materialized snapshot.

- Provider configuration saves immediately reread the current catalog, including saves without a key. Committed configurations retain their saved outcome when reconciliation fails, with credential, cleanup and read issues reported separately. Older completions preserve reopened forms and returning scopes. Full committed-configuration snapshots stay out of error details and retained diagnostics while business consumers keep the original configuration.

- Providers accept empty model declarations so models can be added or discovered later. Name, endpoint and environment edits preserve current declarations and concurrent additions. Removing a project override can restore global models; referenced custom models retain their explicit error contract. Configuration merges persist empty objects and normalize nested deletion markers.

- Configuration syntax errors report codes and line/column positions without copying the full configuration or expanded environment/file values into diagnostics. Paths, parser order and read/write semantics are retained. Provider operations use short localized summaries with expandable details, preserve saved and follow-up failure facts, and recover each refresh independently.

- Providers with no models correctly show saved or configured API keys. Credential, configuration or catalog read failures show an unavailable status until a successful read. Inline and edit inputs share the same fact; OAuth sign-in is distinct from API-key configuration, and model selection retains usable models only.

- Providers with saved keys can discover models before any model has been configured. OpenCorvus live refresh can restore empty catalogs or catalogs fully filtered by model settings. Global and project discovery use their own configured endpoints, while model selection continues to show runnable models.

- Spreadsheet sheet-tab, Sidebar and notification names follow the interface language. Open protection-range lists refresh their title and content while retaining workbook edits, selected panel options and width.

- Mouse clicks on spreadsheet Sidebar buttons retain the Chat reading position when focus returns to the editor, fixing incomplete clicks caused by the ordinary view scrolling upward. Existing internal navigation, editing and current-view CSV export remain usable.

- Native spreadsheet buttons retain keyboard focus before activation, enabling Tab, Enter and Space for permission details, range dialogs, zoom and sheet menus. Existing editor focus after menu actions remains effective.

- Fixed unreadable white text on light hover backgrounds in dark spreadsheet protection cards. Edit/Delete hover regions and rule descriptions use existing theme colours, retaining current rules and interface language in ordinary and fullscreen views.

- Spreadsheet range and deletion dialogs use the current interface language for their close names. Open range dialogs retain drafts, layout, and existing mouse and keyboard close actions when switching English and Chinese.

- Sparse project configuration inherits undeclared global settings, fixing unrelated saves that overwrote prompt selection, authorization mode and nested defaults. Explicit project overrides remain effective; reads, write candidates and writable sources share one contract, while existing task and permission records retain their original facts.

- Spreadsheet permission details opened from Add and lists returned from Confirm retain current-language titles. Range validation messages update with the language while preserving entered ranges, descriptions and permission choices.

- Editable spreadsheets now explain that edits stay in the current view and that changed sheets should be downloaded before leaving or collapsing it. The localized note clarifies that CSV retains cell values and leaves the workbook usable in fullscreen.

- Provider search counts use the actual row collections, fixing configured entries being counted again in the catalog total. Provider rows, discovery, model selection and usage share model-count translations; a single model uses the correct English singular, and discovery receipts follow the current interface language.

- Fixed spreadsheet sheet menus, color dialogs, zoom menus and tooltips being hidden in fullscreen. Repeated submenu activation stays usable, and closing its parent also closes the submenu. Fullscreen and language changes retain the current workbook and edited exports.

- Fixed valid empty files, audio content and resource links failing whole MCP tool results. Audio is retained as an attachment with the current model transport limits, and resource links preserve their original reference fields.

- Venice streaming requests use the correct usage parameter and preserve explicit per-call choices. Fixed output counted twice in Token totals, cache input charged twice, and missing reasoning components. Historical ledger records are retained without recalculation.
- Service shutdown and restart cancel background work across all Projects before joining its physical cleanup, fixing background work such as Memory organization waiting for cancellation from a later shutdown stage.

- Fixed native server shutdown timing out while tools await approval. Shutdown and restart share actual cancellation and listener drainage, preserve ownership during rollback, and retain the five-second failed-exit boundary.

- Generic MCP tools preserve structured result content, including full-file recovery for oversized output. Valid empty text resources no longer fail the whole result.

- User-attached MCP resources retain valid empty text and zero-byte files, with mixed content in its original order. Chat follow-ups correctly bind attachments to their owning project while preserving references, filenames and strict byte validation.

- Spreadsheet artifact type labels and sheet menus follow the interface language. Language changes retain edited cells, formula results and selection, and exports continue to use the current workbook.

- Provider address feedback, saving and discovery use the same validation, fixing invalid addresses being added despite a visible error. Editing other fields preserves the current endpoint and model definition.

- Fixed page freezes when opening fullscreen artifact download menus with Enter, Space or Arrow Down. Keyboard interaction continues after closing the menu, and file reading position is preserved.

- Usage heatmap intervals are accessible by keyboard with complete event times, time-zone offsets and Token counts. The inspection entry stays available while loading, fixing focus loss when pressing Tab immediately after refresh.
- Capability-search completion preserves the original tool-request metadata, fixing immutable-fact conflicts after successful searches for annotated requests such as OpenAI tool calls.
- Projected package and MCP tools retain their validated execution authority so oversized results can be saved to the owning Task and Session output directory.
- Artifact copy and download controls retain keyboard focus while busy for continued operation. Type badges follow the interface language while original titles, filenames and content retain their identity.
- Web fetching preserves Markdown hard breaks, code indentation, blank lines and native text line endings. Generic whitespace cleanup no longer changes content meaning, and output budgets count the retained content.
- PDF previews support web references and internal document links with keyboard focus and activation. Navigation follows the document destination, reports failures in the interface language, and shares page geometry with zoom, rotation and text selection.
- Usage covers natural periods across half-hour daylight-saving and midnight transitions, fixing calls missing from time buckets, assigned to the previous period, or counted beyond the period end.
- Usage period controls and refresh retain keyboard focus for consecutive actions. Loading shows the current request state.
- Network proxy settings preserve leading and trailing spaces and literal percent signs in usernames and passwords, fixing credentials being changed when saved or used. Values already trimmed and saved must be entered again.
- Saving cleared proxy authentication fields removes the old values from the current configuration instead of restoring them in the form.
- Clearing a search field returns focus for continued typing. Clear actions follow the input's disabled state and retain each page's existing search behavior.
- Long-line truncation in file reads and Skill supporting files preserves complete Unicode characters, fixing corrupted emoji and supplementary-plane characters at the boundary.
- Fixed singular and plural English release-search counts and Chinese-only language attributes and website links in release notes.
- Fixed documentation language changes reverting to an earlier preference on return to the homepage. Documentation and other website pages share one language preference.
- Added Chinese terminal titles, copy hints and feedback for documentation code frames. Source-file URLs use the language of their document collection.
- Provider address validation now shows a visible, localized explanation in the form.

#### User impact and known limitations

- Supported database baselines use automatic versioned migrations with a pre-upgrade backup, retaining history, original approvals and results. An unversioned legacy database returns `SCHEMA_BASELINE_REQUIRED` and keeps the data for separately authorized maintenance; the application does not automatically delete old databases.
- Original evidence retention and compaction budgeting have improved, but real-model tests still fail on long user text, repeated authorization revisions and consecutive compaction. Accurate continuation from the latest instruction is not guaranteed, and Codex parity or lossless semantic compression is not claimed.
- On Linux and macOS, the Bun runtime can still misresolve valid filenames containing literal backslashes, affecting path reads and physical identity checks. [The upstream issue remains open](https://github.com/oven-sh/bun/issues/33403). Original tests and diagnostics are retained; Windows acceptance does not establish a cross-platform fix.

## 0.1.25 - 2026-10-12

### zh-CN

本版汇总自上一个公开正式版 **0.1.23** 以来的产品更新。重点是长会话与子 agent 的阅读体验、来源和文件预览、Mission 与定时任务、编辑数据保护，以及专家团调度和模型配置。0.1.24 是未公开的候选版本；以下完整列出本次正式升级的变化。

#### 新增

- **Mission 草稿编辑**：创建后可以修改待执行请求、取消修改或保存后重新查看。保存会核对当前草稿；另一处已经更新时给出冲突提示，并保留本次输入，避免旧页面覆盖新请求。
- **来源独立复制**：Sources 条目可直接复制完整网页链接，或文件路径与行号；流式回复继续增长时保留已经显示的复制反馈。
- **从来源打开图片和 PDF**：图片来源进入图片预览，PDF 来源进入分页阅读界面；PDF 支持选择和复制文字，并在返回时保留阅读位置。解码失败会展示明确提示和恢复入口。
- **本地搜索结果定位**：代码搜索命中可作为文件来源打开到实际文件与行号；结果数量、上下文和路径来自真实搜索结果。
- **已加载日志搜索**：日志查看器支持在当前已加载记录中查找文字，过滤后的显示与复制使用同一组结果，保留原始日志及级别。这不是全历史日志检索。
- **可选 Parallel Search 配置指南**：中英文 MCP（Model Context Protocol，模型上下文协议）文档增加匿名搜索与网页抓取示例，包含 `streamable-http`、`oauth: false`、Fast 模式和限流处理。已通过真实无凭据连接验证搜索后抓取结果网页。

#### 调整

##### 专家团与任务执行

- **预置工作流改为可选参考**：专家团保留明确的角色身份和能力范围，调度者根据实际任务与交付证据选择专家、并行拆分、调整顺序、继续调查或安排复核；不再要求机械执行预设图的所有节点。
- **默认选团先查找再生成**：没有手动指定专家团时，原生助手和 Mission 先搜索、查看已有专家团；没有高度匹配候选时，再由内置 Dynamic 按当前任务组织专家。手动选择优先，已创建 Task 保持自己的固定包身份。
- **同一专家可以承担多次独立执行**：按真实任务、会话和派发身份区分工作，支持直接派发和继续已有工作；完成判定围绕实际交付与核查证据。
- **已授权通用 Skill 直接可用**：通用 Skill 加载工具进入常驻工具集合，减少模型知道能力存在却无法直接加载的情况；专业扩展仍通过既有能力目录取得。

##### 会话与工作区

- **统一长文本渲染路径**：Markdown 解析移入独立工作线程，流式增长的段落、列表、表格与代码块使用同一解析路径；实时事件采用支持即时输出的流式压缩。
- **来源信息重新分层**：主对话、侧边对话和子 agent 停靠区统一展示来源标题、网站、章节、文件名及行号；完整摘录进入可阅读的正文区域，减少狭窄提示框和重复位置标签带来的阅读负担。
- **任务活动显示对应真实执行**：区分工具参数准备、执行、停止、失败和完成；同一回复接收的多个输入按实际执行批次呈现，并保留完成耗时。

#### 修复

##### 长会话、侧边对话与子 agent

- 修复已完成的长 Markdown 在切回页面后仍停留于 `Rendering…`、内容高度恢复不正确，以及来源展开时正文或控件反复重建的已验证场景。
- 修复打开来源、向上阅读、切换任务、关闭重开停靠区后被拉回底部或丢失阅读锚点的问题；保留来源展开状态、摘录与工具正文滚动位置及键盘焦点。
- 修复关闭侧边对话再打开时历史内容或引用关系缺失、查找失败后缺少重试入口的问题；提交接受与面板关闭按实际请求结算。
- 修复断线重连、错过增量和回放快照后正文前缀丢失，以及已完成子会话的正文、来源成员或空文本状态恢复错误的问题。
- 修复已结束输入残留为 Pending、停止后活动状态含糊，以及完成时间被后续渲染覆盖的问题。
- 改善键盘阅读：表格、代码来源、只读文件和差异视图可获得焦点；Home/End、列表选择、菜单关闭与工具页签切换保留对应的阅读和焦点位置。

##### 网页来源、文件和预览

- 修复来源使用抓取地址替代真实页面标题、章节片段丢失、国际化网址不可读、长链接遮蔽网站身份及重复标题的问题；展示名称与实际导航地址分别保留。
- 修复 Windows 完整路径、附件原名、精确文件名、混合换行文件的行号定位和整文件引用高亮残留问题；普通代码术语和裸文件名保持字面含义。
- 修复空文本附件加载后仍显示占位、已加载文件重载失败缺少诊断，以及预览继续显示旧内容的问题；只读来源与可编辑文件状态更加明确。
- 修复文件树和差异预览在实时更新时丢失选中项、焦点或预览内容的问题；目录首次读取、失败与恢复具有明确状态。
- 修复已有图表产物进入全屏后仍被原始宽度限制、中文字体与应用不一致的问题；紧凑视图和全屏继续使用同一份真实产物。

##### 编辑、设置与模型配置

- 修复文件和产物的未保存内容在导航、重载、外部更新或晚到响应后被覆盖的问题；文件保存快捷键恢复实际写入行为，版本冲突保留用户输入并提示处理。
- 修复设置搜索临时切换页面时销毁正在编辑的定时任务或网络配置草稿的问题；清空搜索可回到保留的编辑状态。
- 修复只修改 Provider（模型服务提供方）显示名却丢失环境变量、模型能力、限制或其他配置的问题。模型 ID 按完整值保存，例如 `qwen3-next:80b` 不再被截成 `qwen3-next`。
- 修复模型发现请求在表单关闭、重开或切换项目后，把旧结果写入新表单的问题；已保存但暂不在当前目录中的模型和推理选项仍可辨认，并能明确恢复为项目默认。
- 修复模型配置不可用时，历史会话、事件、文件、Git 信息和工作树也无法只读访问的问题；执行所需配置错误与已有工作数据的读取分开处理。
- 修复连接草稿保存、服务地址校验和恢复入口的问题；保留有效的地址路径和空用户名语义，操作结果归属实际连接与工作区。
- 改善窄桌面窗口下输入区和控件的可达性；全局搜索可找到 Mission，从设置跳转到目标会话时正确进入工作界面。界面语言、编辑器文案、侧栏宽度、浏览器标签与外部地址按其实际状态保留。

##### Mission、定时任务与运行恢复

- 修复首次派发消费 Mission 草稿后，同一个请求重试被误判为没有草稿，或影响后来新草稿的问题；请求重放对应原来已经接受的执行。
- 修复定时任务只改名称却改动起始日期、执行星期或下一次时间的问题；开始日期、星期、时间与时区显式保存，UTC 日历在摘要中显示正确时区，复杂规则保持原值。
- 修复任务上下文压缩后原始请求和参与者证据边界丢失、重复纳入来源，以及协调者读取不到早期 worker 正文的问题；继续执行使用真实持久化消息和来源。
- 修复 Windows 独立服务重启时，旧进程退出连带终止已准备好的替代进程的问题；原生前台请求的超时、退出原因和物理进程结算按实际归属处理。
- 修复专家团安装范围、内置身份、固定 Task 选团和不可变包发布中的一致性问题；嵌入专家团进入本地化搜索，已完成的包发布及时收敛。

##### 工具结果、错误与交付

- 修复工具参数被通用转换改变原始类型的问题，按工具声明保留字符串、数字、布尔值等真实输入；文件和 Skill 的分页返回实际读取范围及完整行数。
- 修复 UTF-8 文本按字节截断时切断字符、纯文本网页结构被破坏，以及 HTML/XHTML 内容类型识别错误的问题。
- 修复工具摘要丢失实际读取名称、路径或失败正文的问题；保留搜索服务诊断、完整多行错误和失败历史，错误详情支持鼠标及键盘复制。
- 修复流式服务错误只剩难懂内部信息、Sources 后缺少会话失败原因，以及没有实际内容仍展示空交付卡的问题。
- 修复官网读取 Dynamic 内置专家团时使用错误目录，恢复全部五个内置专家团的归档和 Registry 数据生成；支持合法省略静态工作流的包，完成对应生产构建与数据库生命周期验证。

#### 用户影响与已知限制

- **升级前备份运行数据。** 本版调整了存储结构和专家团调度契约。不兼容旧数据库会以 `SCHEMA_RESET_REQUIRED` 拒绝启动，需要用户显式重建；当前没有自动历史迁移，不要在未保留副本时重建。
- **自定义集成需核对任务创建参数。** 低层 SDK（Software Development Kit，软件开发工具包）、HTTP `task.create` 及 `panel_create_task` 需要明确传入选定专家团的 `promptProfile`；CLI（Command Line Interface，命令行接口）使用 `--expert-squad` 指定专家团。默认助手的自动选团流程不等于低层接口隐式替调用方选团。自定义专家团的预置工作流现在可以省略。
- Sources 和长会话已完成多轮真实流式与页面验收，但复杂长会话的连续渲染和页面切换仍有持续调查，不将所有闪烁、跳动场景视为已经解决。
- Parallel Search 是用户自行启用的第三方服务。匿名模式限流较低，触发限流后应等待再试；额度与认证方式以服务商当前说明为准。
- v0.1.24 因官网构建失败在公开前停止。本版五个平台的原生构建与安装包验收通过，正式产物和更新通道已发布；联合流水线在官网阶段超过 40 分钟上限，官网后来通过独立完整部署补齐。公开交付已核验，原联合流水线仍保留超时取消结果。

#### 版本范围

- 以上按 [v0.1.23 到 v0.1.25 的实际源码变化](https://github.com/yangheng95/opencorvus/compare/v0.1.23...v0.1.25)整理；验收、文档和生成提交没有被计作独立功能。v0.1.25 之后继续开发的改动不属于本版。

### en-US

This release brings together product updates since the previous public stable release, **0.1.23**. It focuses on reading long conversations and agent work, sources and file previews, Missions and scheduled tasks, protection for edits, Expert Squad dispatch, and model configuration. Version 0.1.24 was an unpublished candidate; the complete changes in this stable upgrade are listed below.

#### Added

- **Mission draft editing**: edit a pending request after creation, discard edits, or save and review it. Saving checks the current draft; a concurrent update produces a conflict notice and preserves your input so an older page cannot overwrite a newer request.
- **Copy individual sources**: Sources entries can copy a complete web URL or file path and line range. Copy feedback remains visible as the streamed answer grows.
- **Open source images and PDFs**: image sources open in the image preview and PDF sources open in the paginated reader. PDFs support text selection and copying, and retain the reading position on return. Decoding errors provide a clear explanation and recovery action.
- **Locate local search results**: code-search matches can open their actual file and line. Counts, context and paths come from the real search results.
- **Search loaded logs**: find text in currently loaded log records. The filtered display and copy action use the same results while preserving original records and levels. This does not search the complete log history.
- **Optional Parallel Search setup guide**: English and Chinese Model Context Protocol (MCP) documentation adds anonymous search and page-fetch examples, including `streamable-http`, `oauth: false`, Fast mode and rate-limit handling. Real credential-free connections verified searching and then fetching a result page.

#### Changed

##### Expert Squads and task execution

- **Preset workflows are optional references**: squads retain explicit roles and capability boundaries. The coordinator uses the actual request and delivery evidence to select experts, divide work, change order, continue investigation or request review, without mechanically running every node in a preset graph.
- **Search before generating a default squad**: when no squad is selected manually, the native assistant and Missions search and inspect existing squads first. Built-in Dynamic organizes a squad for the request when no close match exists. Manual selection takes precedence, and existing Tasks retain their fixed package identity.
- **Multiple independent executions by one expert**: work is distinguished by its actual Task, Session and dispatch identity. Direct dispatch and continuing existing work are supported; completion depends on actual delivery and review evidence.
- **Authorized general Skills are directly available**: the general Skill loader is included in the resident tool set, reducing cases where a model knows a capability exists but cannot load it directly. Specialized extensions still use the existing capability catalog.

##### Conversations and workspace

- **One long-text rendering path**: Markdown parsing runs in a worker. Growing paragraphs, lists, tables and code blocks use the same parser; live events use streaming compression that can produce immediate output.
- **Clearer source hierarchy**: main conversations, side conversations and agent docks consistently show source titles, websites, sections, filenames and line ranges. Full excerpts open as readable body content, reducing cramped tooltips and repeated location labels.
- **Activity follows actual execution**: preparation of tool arguments, execution, stopping, failure and completion are distinguished. Multiple inputs received during one reply appear in their actual execution batches and retain completion duration.

#### Fixed

##### Long conversations, side conversations and agents

- Fixed verified cases where completed long Markdown remained at `Rendering…` after returning to a page, content height restored incorrectly, or expanding sources repeatedly rebuilt text and controls.
- Fixed jumps to the bottom or lost reading anchors after opening sources, reading upwards, switching Tasks, or reopening docks. Source expansion, excerpt and tool-body scroll positions, and keyboard focus are retained.
- Fixed missing history or reference relationships after reopening side conversations, and missing retry actions after lookup failures. Submission acceptance and panel closure settle against the actual request.
- Fixed lost text prefixes after reconnection, missed deltas and replay snapshots, and incorrect restoration of completed agent text, source membership or empty text states.
- Fixed finished inputs remaining Pending, unclear activity after stopping, and completion timestamps being overwritten by later rendering.
- Improved keyboard reading: tables, code sources, read-only files and diff views can receive focus. Home/End, list selection, menu closure and tool-tab switches retain the appropriate reading and focus positions.

##### Web sources, files and previews

- Fixed fetched addresses replacing actual page titles, missing section fragments, unreadable international URLs, long links hiding website identity, and repeated titles. Display names and actual navigation addresses are retained separately.
- Fixed Windows absolute paths, original attachment names, exact filenames, line positioning in mixed-line-ending files, and stale whole-file reference highlights. Ordinary code terms and bare filenames retain their literal meaning.
- Fixed placeholders remaining after empty text attachments loaded, missing diagnostics after file reload failures, and previews retaining old content. Read-only sources and editable file states are clearer.
- Fixed lost selections, focus or previews during live file-tree and diff updates. Initial directory loading, failure and recovery have explicit states.
- Fixed existing chart artifacts remaining constrained to their original width in fullscreen and Chinese fonts differing from the app. Compact and fullscreen views use the same actual artifact.

##### Editing, settings and model configuration

- Fixed unsaved file and artifact edits being overwritten by navigation, reloads, external changes or late responses. File-save shortcuts perform actual writes; version conflicts retain input and explain how to proceed.
- Fixed settings search destroying scheduled-task and network drafts when temporarily switching pages. Clearing search returns to the preserved editing state.
- Fixed changes to a Provider display name losing environment variables, model capabilities, limits or other settings. Full model IDs are retained: `qwen3-next:80b` is no longer truncated to `qwen3-next`.
- Fixed model-discovery responses writing old results into a new form after closure, reopening or a project switch. Saved models and reasoning options temporarily absent from the catalog remain identifiable and can explicitly return to the project default.
- Fixed unavailable model configuration preventing read-only access to historical conversations, events, files, Git information and worktrees. Configuration errors required for execution are separated from reading existing work data.
- Fixed connection-draft saving, service-address validation and recovery actions. Valid address paths and empty usernames are retained, and results belong to the actual connection and workspace.
- Improved access to inputs and controls in narrow desktop windows. Global search finds Missions, and settings navigation opens the correct conversation workspace. Interface language, editor text, sidebar width, browser tabs and external addresses are retained according to their actual state.

##### Missions, scheduled tasks and runtime recovery

- Fixed retrying an accepted first dispatch after it consumed a Mission draft being mistaken for a missing draft or affecting a later draft. Request replay refers to the execution already accepted.
- Fixed renaming scheduled tasks changing their start date, weekdays or next run. Start date, weekdays, time and timezone are saved explicitly; UTC calendars show their timezone and complex rules retain their original values.
- Fixed lost original requests and participant-evidence boundaries after context compaction, duplicate sources, and coordinators losing access to earlier worker text. Continuation uses actual persisted messages and sources.
- Fixed the old Windows service taking down a prepared replacement when it exited during a standalone-service restart. Native request timeouts, exit reasons and physical process settlement retain their actual ownership.
- Fixed squad installation scope, built-in identity, fixed Task selection and immutable package publication consistency. Embedded squads participate in localized search, and completed package publication settles promptly.

##### Tool results, errors and delivery

- Fixed generic conversion changing original tool argument types. Strings, numbers, booleans and other inputs retain the tool's declared contract. File and Skill pagination reports actual read ranges and complete line counts.
- Fixed byte truncation splitting UTF-8 characters, damaged plain-text web structure, and incorrect HTML/XHTML content-type handling.
- Fixed tool summaries losing actual read names, paths or failure text. Search-service diagnostics, complete multiline errors and failed history are retained; error details support pointer and keyboard copying.
- Fixed streamed service errors showing only opaque internal information, missing conversation failure reasons after Sources, and empty delivery cards when there was no actual content.
- Fixed the website reading built-in Dynamic from the wrong directory. All five built-in squad archives and Registry data generation were restored. Packages can legally omit a static workflow, with corresponding production-build and database-lifecycle validation completed.

#### User impact and known limitations

- **Back up runtime data before upgrading.** Storage structure and squad-dispatch contracts changed. Incompatible databases refuse startup with `SCHEMA_RESET_REQUIRED` and require an explicit rebuild. There is no automatic historical migration; do not rebuild without retaining a copy.
- **Check task-creation arguments in custom integrations.** The low-level Software Development Kit (SDK), HTTP `task.create` and `panel_create_task` require the selected squad's `promptProfile` explicitly. The command-line interface (CLI) selects a squad with `--expert-squad`. Automatic selection in the default assistant does not imply implicit selection in low-level calls. Custom squads may now omit preset workflows.
- Sources and long conversations have undergone multiple real streaming and page checks. Continuous rendering and switching in complex long conversations remain under investigation; not every flicker or jump is considered resolved.
- Parallel Search is an optional third-party service enabled by users. Anonymous access has low rate limits. Wait before retrying when limited; quotas and authentication follow the service provider's rules.
- Version 0.1.24 stopped before public release because the website build failed. This version passed native builds and installer acceptance on all five platforms, and published its official artifacts and update channel. The combined pipeline exceeded its 40-minute limit at the website stage; a separate complete deployment subsequently delivered the site. Public delivery was verified, while the original timeout/cancellation result remains recorded.

#### Version scope

- These notes are based on [actual source changes from v0.1.23 to v0.1.25](https://github.com/yangheng95/opencorvus/compare/v0.1.23...v0.1.25). Validation, documentation and generation commits are not counted as separate features. Development after v0.1.25 is outside this release.

## 0.1.24 - 2026-10-12

### zh-CN

#### 新增

- 来源条目新增独立复制按钮，可复制完整网页链接或文件路径与行号；代码搜索结果可直接定位到对应文件来源。
- 文件来源支持图片和 PDF 预览，PDF 可选择和复制文字；完整来源摘录可在正文区域展开阅读。
- Mission 草稿支持编辑，日志查看支持在已加载记录中搜索。
- 中英文 MCP（Model Context Protocol，模型上下文协议）指南新增可选 Parallel Search 匿名配置示例，说明搜索、网页抓取、Fast 模式和免费档限流，并通过真实无凭据调用验证。

#### 调整

- 优化主对话、侧边对话和子 agent 停靠区的来源布局，保留网页域名、章节、文件名和行号，改善长链接与国际化文字的可读性。
- 专家团按任务实际需要安排执行，优先查询已有专家团；安装范围、选中身份和任务委派保持明确归属。
- 已授权的通用 Skill 加载工具直接提供给模型，文件与 Skill 分页返回实际读取范围和完整行数。
- Markdown 渲染移至独立工作线程，增长中的列表、表格和代码块使用统一解析路径；实时事件支持即时流式压缩。

#### 修复

- 修复流式更新、展开来源、切换会话和关闭重开停靠区时，正文或来源控件反复重建、阅读位置丢失的问题；保留滚动、键盘焦点和展开状态。
- 修复重连或遗漏增量后正文前缀、已完成子会话和来源成员恢复不完整的问题；同一回复接收的多个输入按实际执行批次展示，避免额外的永久 Pending 活动。
- 修复部分来源标题、附件名称、Windows路径、章节片段和重复位置标签显示错误；保留真实导航地址与文件路径语义。
- 改善流式服务错误与工具失败的可读提示，保留完整诊断；错误详情支持单击和键盘复制，历史导入保留完整失败记录。
- 修复模型配置不可用时历史会话、文件、Git信息和工作树无法只读访问的问题，并提供明确的重试与恢复提示。
- 修复工具参数原始类型、UTF-8字符截断、网页纯文本结构及HTML媒体类型处理，减少读取结果失真。
- 修复任务压缩上下文的来源边界、原始参与者证据、后台提示释放和恢复归属；改进Mission派发、定时计划、原生进程退出和截止时间结算。
- 修复文件与产物编辑草稿在导航、重载或外部更新后被覆盖，以及设置选择、界面语言、侧栏宽度和浏览器标签状态丢失的问题。

#### 用户影响与已知限制

- 本版包含存储结构与专家团调度契约调整。升级前请备份现有运行数据；不兼容的旧数据库会以 `SCHEMA_RESET_REQUIRED` 明确拒绝启动，需要用户显式重建，当前不提供自动历史迁移。不要在未保留数据副本时执行重建。
- Sources与阅读保持已完成多轮真实页面验证；复杂长会话的连续流式渲染仍需持续回归，不承诺所有闪烁场景均已消除。
- Parallel Search仍由用户自行启用，匿名服务有较低限流；遇到限流应等待后重试，额度与认证方式以服务商说明为准。

### en-US

#### Added

- Individual source-copy buttons copy complete web URLs or file paths and line ranges; code-search results open the corresponding file source.
- File sources support image and PDF previews, PDF text selection and copying, and full source excerpts in the message body.
- Mission drafts can be edited, and the log viewer can search loaded records.
- English and Chinese MCP guides add optional anonymous Parallel Search examples for search, page fetching, Fast mode and free-tier rate limits, verified with real credential-free requests.

#### Changed

- Improved source layouts in main conversations, side conversations and agent docks while retaining domains, sections, filenames and line ranges, and improving long-link and international-text readability.
- Squads organize execution for the actual Task and search existing squads first. Installation scope, selected identity and delegation have explicit ownership.
- Authorized general Skill loaders are directly available to models. File and Skill pagination returns actual ranges and complete line counts.
- Markdown rendering runs in a worker; growing lists, tables and code blocks use one parser. Live events support immediate streaming compression.

#### Fixed

- Fixed repeated reconstruction and lost reading positions when streaming, expanding sources, switching conversations or reopening docks; scrolling, focus and expansion are retained.
- Fixed incomplete restoration of text prefixes, completed agent sessions and source membership after reconnection or missed deltas. Inputs to one reply appear in actual execution batches without permanent extra Pending activity.
- Fixed some source titles, attachment names, Windows paths, section fragments and repeated location labels while retaining actual navigation and path semantics.
- Improved streamed service and tool failure messages with full diagnostics. Error details support pointer and keyboard copying; history imports preserve complete failures.
- Fixed unavailable model configuration blocking read-only history, files, Git information and worktrees, with clear retry and recovery actions.
- Fixed original tool argument types, UTF-8 truncation, web plain-text structure and HTML media-type handling to reduce distortion in reads.
- Fixed source boundaries in compacted Task context, original participant evidence, background prompt release and recovery ownership. Improved Mission dispatch, schedules, native process exits and deadline settlement.
- Fixed file and artifact drafts being overwritten during navigation, reloads or external updates, and lost settings selection, interface language, sidebar widths and browser-tab state.

#### User impact and known limitations

- Storage and squad-dispatch contracts changed. Back up runtime data before upgrading. Incompatible databases return `SCHEMA_RESET_REQUIRED` and require an explicit rebuild; automatic historical migration is unavailable. Retain a data copy before rebuilding.
- Sources and reading retention passed multiple real page checks. Continuous streaming in complex long conversations still needs regression work; not every flicker is guaranteed resolved.
- Parallel Search is optional and anonymous access has low rate limits. Wait before retrying when limited; quotas and authentication follow the service provider's rules.

## 0.1.23 - 2026-09-30

### zh-CN

#### 新增

- 官网新增按版本浏览的更新日志及单版详情，补齐从 0.0.35beta 到 0.1.22 的历史与原始来源。
- 设置新增更新日志：默认查看当前安装版本，搜索历史版本与功能内容，离线阅读完整说明，并从关于页直接进入。

#### 调整

- 每次发布要求先编写更新日志；GitHub Release 和网站使用根目录的同一份版本说明，保留发布归属与原始来源。
- 项目环境概览采用圆角面板和独立操作菜单，按变更、分支、子 agent、来源排列；显示真实角色头像与统计，保留项目工具和交付物入口。

#### 修复

- 设置、计划任务和专家团页面挂载到常驻导航旁的同一页面容器，左侧导航始终可见，切回对话或 Mission Board 时正确关闭设置并更新选中状态。
- 设置搜索由统一导航状态管理，重新选择当前页面会清空旧搜索，避免仍停留在其他搜索结果页。
- 环境概览关闭时同步释放操作菜单和目录／分支菜单；长名称截断、收起后的变更统计及深浅主题保持一致。

### en-US

#### Added

- Added website version history and individual release pages, covering versions 0.0.35beta through 0.1.22 and their original sources.
- Added release notes in Settings, starting with the installed version, with history/content search, complete offline notes and a direct About-page entry.

#### Changed

- Releases require authored notes first. GitHub Releases and the website use the same root version notes, retaining publication ownership and original sources.
- The project environment overview uses rounded panels and a separate action menu, ordered by changes, branch, agents and sources. It shows actual role avatars and counts and retains project tools and delivery entries.

#### Fixed

- Settings, scheduled tasks and squad pages share the page container beside persistent navigation. Left navigation remains visible; returning to a conversation or Mission Board closes Settings and updates selection correctly.
- Settings search uses unified navigation state. Selecting the current page clears old search instead of retaining another results page.
- Closing the environment overview releases action, directory and branch menus. Long-name truncation, collapsed change counts and light/dark themes are consistent.

## 0.1.22 - 2026-09-30

### zh-CN

#### 新增

- 新增独立侧边对话与消息引用，文件编辑器按实际文件语言加载语法高亮。

#### 调整

- Base 普通交付由任务负责人直接执行，再由独立测试方核验原始要求；来源调查与并行交付保留各自的委托工作流。
- 工具结果使用最近一次真实调用名称作为统一展开入口，移除重复嵌套的工具计数外层，改善主对话与侧边对话的间距。

#### 修复

- 修复子任务暂停等待 Mission 时仍显示运行中的问题，暂停、唤醒和重连会同步更新任务与 Mission 的活动状态。
- 改善 handoff 上下文的阅读布局，展开和收起时保留当前阅读位置。
- 修复上下文压缩检查点校验和请求预算处理，统一 Task 证据读取与根工具执行。
- 补齐电脑操作按需指南与有序动作说明，分离桌面端 MCP 载荷服务契约。
- 修正网站中文 Base 工作流元数据，使其与当前单一独立测试节点一致，恢复市场生成与 Registry 生命周期检查。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/1de814728820f3d00579e8293b26f832bf604550) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/b255ed5b6787d863b167ecc9d65cfe3fe6e8e6cb...1de814728820f3d00579e8293b26f832bf604550)。

### en-US

#### Added

- Added independent side conversations and message references. The file editor loads highlighting for the actual file language.

#### Changed

- Base's ordinary delivery is performed directly by the Task owner and checked against original requirements by an independent tester. Source investigation and parallel delivery retain their delegated workflows.
- Tool results use the latest actual call name as a single expansion entry, removing repeated nested tool-count wrappers and improving main/side conversation spacing.

#### Fixed

- Fixed paused child Tasks waiting for a Mission still appearing active. Pause, wake and reconnection synchronize Task and Mission activity.
- Improved handoff-context reading layouts while retaining reading position on expansion and collapse.
- Fixed compaction-checkpoint validation and request-budget handling, unifying Task evidence reading and root-tool execution.
- Completed on-demand computer-use guidance and ordered action instructions, separating the desktop MCP payload-service contract.
- Corrected Chinese website Base metadata to match its single independent-test node, restoring market generation and Registry lifecycle checks.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/1de814728820f3d00579e8293b26f832bf604550) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/b255ed5b6787d863b167ecc9d65cfe3fe6e8e6cb...1de814728820f3d00579e8293b26f832bf604550).

## 0.1.21 - 2026-09-29

### zh-CN

#### 修复

- 修复原生安装包已生成，却在可选缓存保存或上传收尾阶段提前超时的问题；独立打包任务的基础设施时限与整次 40 分钟发布期限一致。
- 安装包传输保留原始文件并避免重复压缩，完整平台矩阵、签名更新和网站部署继续由同一发布流程验收。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/b255ed5b6787d863b167ecc9d65cfe3fe6e8e6cb) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/97a3a6807fe40fc045a354c17c99b256a2f0f2a8...b255ed5b6787d863b167ecc9d65cfe3fe6e8e6cb)。

### en-US

#### Fixed

- Fixed native installers finishing but optional cache saving or upload cleanup timing out early. Standalone packaging infrastructure limits match the overall 40-minute release deadline.
- Installer transfer retains original files without repeated compression. The complete platform matrix, signed updates and website deployment remain validated by the same release process.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/b255ed5b6787d863b167ecc9d65cfe3fe6e8e6cb) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/97a3a6807fe40fc045a354c17c99b256a2f0f2a8...b255ed5b6787d863b167ecc9d65cfe3fe6e8e6cb).

## 0.1.20 - 2026-09-29

### zh-CN

#### 调整

- 调整工作区导航和用量统计的信息布局，统一常用入口、选中状态与阅读层级。

#### 修复

- JSON 和 Markdown 预览的复制、下载保留原始内容与实际文件名，不再导出用于展示的包装文本。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/97a3a6807fe40fc045a354c17c99b256a2f0f2a8) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/386c280caffe4de04b38069ff0918d77ab6a5059...97a3a6807fe40fc045a354c17c99b256a2f0f2a8)。

### en-US

#### Changed

- Improved workspace navigation and usage-statistics hierarchy, unifying common actions, selection and reading levels.

#### Fixed

- JSON and Markdown preview copy/download preserve original content and actual filenames rather than exporting presentation wrappers.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/97a3a6807fe40fc045a354c17c99b256a2f0f2a8) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/386c280caffe4de04b38069ff0918d77ab6a5059...97a3a6807fe40fc045a354c17c99b256a2f0f2a8).

## 0.1.19 - 2026-09-29

### zh-CN

#### 新增

- 为交互产物提供复制、按实际格式下载和打开操作；代码、表格和 MCP（Model Context Protocol，模型上下文协议）应用保留真实内容与资源下载入口。

#### 调整

- 重整工具调用、结构化输出与交付卡片，支持原始内容、全文展开和复制；文件名、格式与交付操作更突出。
- 统一设置、权限历史、右侧停靠区和输入栏的布局与主题；简化多层选择菜单，并保存项目内的选择。

#### 修复

- 修复环境状态跨目录残留、GitHub CLI 状态误报、二进制文件的虚假行数，以及非 Git 目录反复查询工作树的问题。
- 项目启动只读取目录状态，Git 初始化由显式操作触发；活动会话占用项目时明确报告 Git 身份变更冲突。
- 修复完成后的报告跟进与历史交付展示，保留每次执行轮次的实际文件；MCP 卡片在晚打开或断线恢复后读取最新持久化结果。
- 改进 Harbor 评测中的工作区归属、原生桥接就绪、时钟传递和失败/用量证据记录。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/386c280caffe4de04b38069ff0918d77ab6a5059) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/cca50888d07198ba68e4493ed29821eef088d170...386c280caffe4de04b38069ff0918d77ab6a5059)。

### en-US

#### Added

- Added copy, actual-format download and open actions for interactive artifacts. Code, spreadsheets and MCP apps retain actual content and resource-download actions.

#### Changed

- Reorganized tool calls, structured output and delivery cards with raw content, full expansion and copying. Filenames, formats and delivery actions are more prominent.
- Unified settings, permission history, right docks and composer layout/themes. Simplified nested selectors and retained project selection.

#### Fixed

- Fixed directory-crossing environment state, inaccurate GitHub CLI status, invented binary-file line counts and repeated worktree queries in non-Git directories.
- Project startup only reads directory state; Git initialization requires an explicit action. Git identity changes report conflicts when active conversations use the project.
- Fixed post-completion report follow-ups and historical delivery display, retaining actual files for each execution. Late-opened or recovered MCP cards read the latest persisted result.
- Improved workspace ownership, native-bridge readiness, clock transfer and failure/usage evidence in Harbor evaluation.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/386c280caffe4de04b38069ff0918d77ab6a5059) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/cca50888d07198ba68e4493ed29821eef088d170...386c280caffe4de04b38069ff0918d77ab6a5059).

## 0.1.18 - 2026-09-29

### zh-CN

#### 修复

- 修复电脑休眠或长时间暂停后，后端因进程心跳过期而持续拒绝多项目请求的问题。进程存活统一依据操作系统进程号与启动身份，项目关闭、重开和时间变化不会撤销仍存活进程的身份。
- 遗弃任务恢复核对原执行进程是否实际退出；已有终态结果可直接补齐投递。缺少物理身份的历史未完成记录会明确报告证据不足，保留原数据。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/cca50888d07198ba68e4493ed29821eef088d170) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/b1d01e71e7c56a62cd97baf3bb3bc11bf173fff9...cca50888d07198ba68e4493ed29821eef088d170)。

### en-US

#### Fixed

- Fixed expired process heartbeats causing persistent rejection of multi-project requests after sleep or long pauses. Liveness uses the operating-system process ID and start identity; project closure, reopening and clock changes do not revoke a live process's identity.
- Abandoned-task recovery checks actual original-process exit. Existing terminal results can complete delivery. Historical unfinished records lacking physical identity report insufficient evidence and retain original data.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/cca50888d07198ba68e4493ed29821eef088d170) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/b1d01e71e7c56a62cd97baf3bb3bc11bf173fff9...cca50888d07198ba68e4493ed29821eef088d170).

## 0.1.17 - 2026-09-28

### zh-CN

#### 修复

- 修复 Bun 依赖缓存恢复/保存的收尾行为，让已完成的原生构建按既定整体期限结算，不被可选缓存操作阻断。
- 延续此前候选的完整产品改动，完成原生安装包、签名更新通道和网站的一体发布。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/b1d01e71e7c56a62cd97baf3bb3bc11bf173fff9) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/f4be7e43b3ae0c8c0afcb7d5e708e071ac5e74f8...b1d01e71e7c56a62cd97baf3bb3bc11bf173fff9)。

### en-US

#### Fixed

- Fixed Bun dependency-cache restore/save cleanup so completed native builds settle within the existing overall deadline without optional cache operations blocking them.
- Retained the preceding candidate's complete product changes and delivered native installers, signed update channels and the website together.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/b1d01e71e7c56a62cd97baf3bb3bc11bf173fff9) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/f4be7e43b3ae0c8c0afcb7d5e708e071ac5e74f8...b1d01e71e7c56a62cd97baf3bb3bc11bf173fff9).

## 0.1.16 - 2026-09-28

### zh-CN

#### 修复

- 改善 macOS Intel 发布任务的缓存处理，为安装包完成后的上传与网站部署保留整体发布预算。
- 保留原生打包失败诊断，继续使用同一平台矩阵与发布身份校验。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/f4be7e43b3ae0c8c0afcb7d5e708e071ac5e74f8) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/dd999804c984360146231386550c2cf17e7ab0e0...f4be7e43b3ae0c8c0afcb7d5e708e071ac5e74f8)。

### en-US

#### Fixed

- Improved macOS Intel release caching, retaining overall release time for uploads and site deployment after installers finish.
- Preserved native packaging failure diagnostics and the same platform matrix and release-identity validation.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/f4be7e43b3ae0c8c0afcb7d5e708e071ac5e74f8) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/dd999804c984360146231386550c2cf17e7ab0e0...f4be7e43b3ae0c8c0afcb7d5e708e071ac5e74f8).

## 0.1.15 - 2026-09-28

### zh-CN

#### 新增

- 为专家团演化增加隔离诊断入口，固定模型目录、试验对象和测量来源，并提供完整的工具请求检查记录。

#### 调整

- 演化比较保留未发布、不可用和无法判定的结果；每次试验归入明确的比较槽，推广决定重新核对当前审查证据。
- 数据分析团队把报告发布参数统一为一个结构化产物，保留来源和正式发布授权。

#### 修复

- Mission 验收与后续修正读取当前 Task 的完成、产物和审查证据，保留仍未满足的要求，避免早期摘要覆盖后续事实。
- 产物发布按包内声明的生产者权限执行；反复导入、测量别名与用量回执保留精确来源和执行身份。
- 修复 AutomationBench 时钟解析、冻结试验、评分输入和跨 Task 测量证据读取中的归属问题。记录的评测结果不作为普遍性能提升保证。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/dd999804c984360146231386550c2cf17e7ab0e0) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/b9a72f4134de3a582dcf55cb09b6c1b299f8b3d1...dd999804c984360146231386550c2cf17e7ab0e0)。

### en-US

#### Added

- Added isolated squad-evolution diagnostics with fixed model catalogs, experiment subjects and measurement sources, and complete tool-request inspection records.

#### Changed

- Evolution comparisons retain unpublished, unavailable and inconclusive outcomes. Each experiment has an explicit comparison slot; promotion rechecks current review evidence.
- The data-analysis team uses one structured artifact for report publication parameters, retaining sources and formal publication authorization.

#### Fixed

- Mission acceptance and follow-up correction read current Task completion, artifacts and reviews, retaining unmet requirements rather than replacing later facts with early summaries.
- Artifact publication follows the package's declared producer permissions. Reimports, measurement aliases and usage receipts retain exact sources and execution identities.
- Fixed ownership in AutomationBench clock parsing, frozen trials, scoring inputs and cross-Task measurement reads. Recorded evaluation results are not a general performance guarantee.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/dd999804c984360146231386550c2cf17e7ab0e0) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/b9a72f4134de3a582dcf55cb09b6c1b299f8b3d1...dd999804c984360146231386550c2cf17e7ab0e0).

## 0.1.14 - 2026-09-24

### zh-CN

#### 调整

- 重新设计“关于”和“用量统计”设置页：集中展示版本与连接状态、突出周期用量总数，技术详情与快捷键仍可展开查看。
- Chat 会话输入栏不再显示项目当前专家团名称；Mission 与 Task 仍显示对应身份，引用查看入口保留。
- 将 Provider 菜单中的模型刷新明确标为“刷新 OpenCorvus 模型”，说明它需要单独配置 OpenCorvus Provider 凭据。

#### 修复

- 修复子 Agent 下拉选择器在活动更新时自动收起，并缩短进展卡片预览；完整会话仍可打开。
- 修复 Work Ledger 行操作可能误触停止任务的问题：菜单触发区保持稳定，停止 Chat、Mission 或 Task 前显示对应名称的确认对话框。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/b9a72f4134de3a582dcf55cb09b6c1b299f8b3d1) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/6ebed7625c8db3780652deb48e2f6329725b4aac...b9a72f4134de3a582dcf55cb09b6c1b299f8b3d1)。

### en-US

#### Changed

- Redesigned About and Usage Settings around version/connection status and period usage totals, with expandable technical details and shortcuts.
- Chat composers no longer display the project's current squad name. Missions and Tasks retain their corresponding identity and reference entry.
- Model refresh in the Provider menu explicitly says Refresh OpenCorvus models and explains that separate OpenCorvus Provider credentials are required.

#### Fixed

- Fixed agent selectors closing during activity updates and shortened progress-card previews while retaining complete conversation access.
- Fixed Work Ledger row actions accidentally stopping work. Menu triggers remain stable, and stopping a Chat, Mission or Task shows a confirmation naming the item.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/b9a72f4134de3a582dcf55cb09b6c1b299f8b3d1) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/6ebed7625c8db3780652deb48e2f6329725b4aac...b9a72f4134de3a582dcf55cb09b6c1b299f8b3d1).

## 0.1.13 - 2026-09-23

### zh-CN

#### 新增

- 新增 Inspect AutomationBench 评测接入和专用专家团，使用官方场景状态与评分规则，并保留明确的运行、调用和验收证据。

#### 调整

- 将待办读写、任务列表/状态/看板/计划查询、交互回应、工作区定位的 10 个工具入口合并为 4 个；Chat 工具声明从 39 项降到 33 项，Mission 从 39 项降到 34 项。
- 同步专家团作者说明、交互与接口契约，以及中英文工具迁移文档。直接引用旧工具名称或分别配置待办权限的集成需更新为新名称和参数。

#### 修复

- 桌面端启动、恢复可见和运行期间会检查正式更新通道，并自动下载及验证新版本；安装仍需确认重启。修复重复检查或安装失败后丢失已验证安装包状态，以及 Windows 安装程序启动失败时直接退出而未报告错误的问题。
- 改进 macOS 安装包失败诊断，并避免 Windows 依赖缓存的收尾步骤让已打包成功的发布任务超时。
- 新对话记住最近选择的模型，减少重复选择。
- 修复 Chat 和 Mission 的通用预置工具被额外白名单隐藏的问题；已授权的搜索、记忆、计划、定时和任务控制工具直接提供给模型，专业与扩展能力继续按需加载。
- 修复 Inspect 评测的项目配置入口、长完成摘要读取、流式活动观察、轮询时限校验和评分策略检查；同轮评测固定专家团源版本，避免后续样本读到变化中的配置。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/6ebed7625c8db3780652deb48e2f6329725b4aac) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/5c615ae5c84ac65348914a753c4fcbd53c2bd962...6ebed7625c8db3780652deb48e2f6329725b4aac)。

### en-US

#### Added

- Added Inspect AutomationBench integration and a dedicated squad, using official scenario state and scoring rules with explicit runtime, call and acceptance evidence.

#### Changed

- Consolidated ten tool entries for todos, task lists/status/boards/schedules, interaction responses and workspace locations into four. Chat declarations decreased from 39 to 33 tools and Mission declarations from 39 to 34.
- Updated squad-author guidance, interaction/API contracts and bilingual migration docs. Integrations referring to old tool names or separate todo permissions must adopt the new names and parameters.

#### Fixed

- Desktop startup, return to visibility and runtime check the stable update channel and automatically download/verify new versions; installation still requires restart confirmation. Fixed lost verified-installer state after repeated checks or installation failure, and Windows exiting silently when installer launch failed.
- Improved macOS installer-failure diagnostics and prevented Windows dependency-cache cleanup from timing out successfully packaged releases.
- New conversations remember the most recently selected model.
- Fixed extra allowlists hiding authorized general Chat and Mission tools. Search, memory, planning, scheduling and task controls are directly available; specialized extensions remain on demand.
- Fixed Inspect project configuration, long completion-summary reads, streaming observation, poll-limit validation and scoring-policy checks. Each evaluation round fixes its squad source version so later samples cannot read changing configuration.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/6ebed7625c8db3780652deb48e2f6329725b4aac) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/5c615ae5c84ac65348914a753c4fcbd53c2bd962...6ebed7625c8db3780652deb48e2f6329725b4aac).

## 0.1.12 - 2026-09-22

### zh-CN

#### 调整

- 新增暖白、鼠尾草绿、雾蓝和石墨紫四套主题，覆盖工作区、设置、弹框与菜单，并支持保存偏好及内容明暗适配。
- 子 Agent 进展改为单列自然高度，由外层对话统一滚动与跟随；统一弹框、菜单和选择浮层的层级、边距与短暂开合效果，并改善截图面板与图片预览工具栏。
- 发布总时限扩展到 40 分钟，原生包、桌面更新、官网部署和最终状态汇总共享同一计时；明确触发后的无人值守执行与失败边界。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/5c615ae5c84ac65348914a753c4fcbd53c2bd962) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/6817a581e55eaff616c1a731869309849f2926d8...5c615ae5c84ac65348914a753c4fcbd53c2bd962)。

### en-US

#### Changed

- Added Warm White, Sage Green, Mist Blue and Graphite Violet themes across workspace, settings, dialogs and menus, with saved preferences and light/dark content adaptation.
- Agent progress uses natural-height single columns with conversation-owned scrolling/following. Unified overlay levels, spacing and brief transitions; improved screenshot panels and image-preview toolbars.
- Extended the shared release deadline to 40 minutes for native packages, desktop updates, website deployment and final status. Clarified unattended execution and failure boundaries after dispatch.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/5c615ae5c84ac65348914a753c4fcbd53c2bd962) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/6817a581e55eaff616c1a731869309849f2926d8...5c615ae5c84ac65348914a753c4fcbd53c2bd962).

## 0.1.11 - 2026-09-22

### zh-CN

#### 调整

- 重整工作区的基础组件、明暗主题、间距与图层，统一侧栏、输入区、Mission 看板、消息面板和设置页的视觉层级。
- 使用静态背景与半透明表面呈现轻盈玻璃质感，移除输入区轮播提示和持续脉冲效果。
- 设置内容统一为单栏；专家团与 Mission 技能采用列表进入详情、返回列表的交互，保留筛选与独立启用状态。
- 精简工具与来源展示，工具引用改为可展开的紧凑文本；Chat / Work 的项目范围与完整路径按需展开。
- 改善对话与专家协作的阅读布局，压缩重复边框、头像、标签和说明文字。

#### 修复

- 修正侧栏图标与文字、首页标题与输入区的对齐，以及设置详情残留的分栏边框与缩进。
- 改进发送失败和资源加载错误的内联提示，保留可展开、可复制的完整诊断信息。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/6817a581e55eaff616c1a731869309849f2926d8) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/8bd7c75332676b44312159210904c1ff67604cc4...6817a581e55eaff616c1a731869309849f2926d8)。

### en-US

#### Changed

- Reworked workspace primitives, light/dark themes, spacing and layers, aligning the hierarchy of sidebar, composer, Mission Board, messages and Settings.
- Static backgrounds and translucent surfaces create a light glass appearance; removed rotating composer hints and continuous pulse effects.
- Settings use one column. Squad and Mission Skills use list-to-detail navigation with filters and independent enabled states retained.
- Simplified tools and sources with compact expandable tool references. Chat/Work project scope and full paths expand on demand.
- Improved conversation and expert-collaboration reading by reducing repeated borders, avatars, labels and explanatory text.

#### Fixed

- Corrected alignment of sidebar icons/text and home headings/composers, and residual split borders and indentation in Settings details.
- Improved inline send/resource errors with expandable, copyable full diagnostics.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/6817a581e55eaff616c1a731869309849f2926d8) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/8bd7c75332676b44312159210904c1ff67604cc4...6817a581e55eaff616c1a731869309849f2926d8).

## 0.1.10 - 2026-09-21

### zh-CN

#### 修复

- 二进制发布自动等待网站部署及公网下载清单校验；整轮共享 30 分钟期限，重试不重置计时。
- 修复 RPM 验收错误比较 Tauri 恢复后的编译文件，按实际包格式标记绑定不可变编译输入。
- 修复流式发布中止后已落盘内容漏登记的问题，重试清理覆盖本轮完整内容。
- 研究决策整合者使用普通工作者执行契约汇总研究证据，避免误进入要求 RequirementSet 输入的架构投影流程。

- 正常关闭已结算的数据库连接时允许仍被查询对象持有的已完成语句释放，重置和重建仍保留严格关闭检查。

- 修复 RPM 打包依赖在短写时重复计算整个缓冲区哈希的问题，消除随包体积平方增长的额外工作并修正备用载荷摘要；新增真实 RPM 文件安装与摘要验收。

- 修复工作者续调时只能继承旧输入的问题；可在同一会话中显式更新本轮目标选择，并同步模型上下文、工具校验和执行记录。
- 修复运行器拒绝更新工作量审查目标的问题，保留工作流、会话和前驱身份校验。
- 修正过期的协调指令，改善调度标识和消息读取错误提示。
- 修复任务控制验收把首个工作者的完成事件误当作最终验收事件的问题。
- 本地安装包的内置服务与桌面元数据统一使用产品版本，避免服务显示分支开发版本号。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/8bd7c75332676b44312159210904c1ff67604cc4) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/161bf0bfff0ff6deaa3e5d369f72a3ee26a5202a...8bd7c75332676b44312159210904c1ff67604cc4)。

### en-US

#### Fixed

- Binary publication waits for website deployment and public download-manifest validation. The whole run shares a 30-minute deadline that retries do not reset.
- Fixed RPM acceptance comparing the wrong compiled file after Tauri restoration; immutable compilation inputs are bound according to the actual package-format marker.
- Fixed persisted content missing registration after interrupted streaming publication; retry cleanup covers all content in the current run.
- The research-decision integrator summarizes evidence under the ordinary worker contract instead of entering architecture projection that requires RequirementSet input.
- Normal closure of settled database connections permits completed statements still held by queries to release. Reset/rebuild retain strict closure checks.
- Fixed RPM dependencies repeatedly hashing entire buffers on short writes, removing quadratic work and correcting the alternate payload digest. Added actual RPM installation and digest acceptance.
- Fixed continued workers being limited to old inputs. Current target selection can be explicitly updated in the same Session and reflected in model context, tool validation and execution records.
- Fixed runners rejecting workload-review target updates while retaining workflow, Session and predecessor checks.
- Corrected stale coordination instructions and improved dispatch identifiers and message-read errors.
- Fixed task-control acceptance treating the first worker's completion as final acceptance.
- Embedded services and desktop metadata in local packages use the product version rather than a development-branch version.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/8bd7c75332676b44312159210904c1ff67604cc4) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/161bf0bfff0ff6deaa3e5d369f72a3ee26a5202a...8bd7c75332676b44312159210904c1ff67604cc4).

## 0.1.9 - 2026-09-20

### zh-CN

#### 修复

- 修复 Windows 开发服务器监听目录时，浏览器截图及任务产物发布因移动父目录而出现 `EPERM` 的问题；统一由清单原子提交确认发布，保留原有完整性、归属和清理约束。
- 修复已引用产物的清单或快照丢失后，产物目录仍错误显示完整的问题；损坏的持久引用返回明确错误，尚未提交的准备目录仍保持不可见。
- 修复 Advanced 专家团中实现、测试和界面完整性审查角色缺少 Browser MCP 能力的问题；新版本使用明确的角色授权，已有任务的冻结授权保持不变。
- 能力恢复提示根据当前实际可调用工具指向协调、提问或设置入口，区分角色授权、操作批准、认证和执行故障。
- 同步专家团生成的版本记录，修复持续集成中的生成产物不一致。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/161bf0bfff0ff6deaa3e5d369f72a3ee26a5202a) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/36772e0533f65c645a0067909835aeb075fb4900...161bf0bfff0ff6deaa3e5d369f72a3ee26a5202a)。

### en-US

#### Fixed

- Fixed `EPERM` when Windows development-directory watching conflicted with moving parent directories during browser screenshot or Task artifact publication. Manifest atomic commit confirms publication while retaining integrity, ownership and cleanup constraints.
- Fixed artifact directories appearing complete after referenced manifests/snapshots went missing. Corrupt persisted references return explicit errors; uncommitted preparation directories remain invisible.
- Fixed missing Browser MCP capabilities for Advanced implementation, testing and UI-integrity roles. New versions have explicit role grants; existing Tasks retain frozen authorization.
- Capability recovery points to coordination, questions or settings using currently callable tools, distinguishing role grants, approval, authentication and execution faults.
- Synchronized generated squad revision records, fixing inconsistent generated content in continuous integration.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/161bf0bfff0ff6deaa3e5d369f72a3ee26a5202a) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/36772e0533f65c645a0067909835aeb075fb4900...161bf0bfff0ff6deaa3e5d369f72a3ee26a5202a).

## 0.1.8 - 2026-09-20

### zh-CN

#### 修复

- 修复 Mission 无法使用已编写 Task 分配，以及工作者继续执行时输入与恢复责任不一致的问题。
- 保留任务的原始需求附件和来源，修复浏览器 Node 运行时存活判断与断线 MCP 会话恢复。
- 修复 Windows 启动回执、取消和超时原因在实际进程收敛前被提前报告的问题。
- 同步当前专家团版本与验收契约，避免无效哈希比较或缺少原始证据的重试被当成交付验收。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/36772e0533f65c645a0067909835aeb075fb4900) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/581feef4e29295568e908eb06b8e4964d978087f...36772e0533f65c645a0067909835aeb075fb4900)。

### en-US

#### Fixed

- Fixed Missions being unable to use authored Task assignments and inconsistent inputs/recovery responsibility for continued workers.
- Preserved original requirement attachments and sources; fixed browser Node liveness and disconnected MCP session recovery.
- Fixed Windows startup receipts, cancellation and timeout reasons being reported before actual process settlement.
- Synchronized squad versions and acceptance contracts so invalid hash comparisons or retries lacking original evidence cannot count as delivery acceptance.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/36772e0533f65c645a0067909835aeb075fb4900) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/581feef4e29295568e908eb06b8e4964d978087f...36772e0533f65c645a0067909835aeb075fb4900).

## 0.1.7 - 2026-09-20

### zh-CN

#### 修复

- 修复旧格式内置专家团无法读取或更新、已安装列表出现大量 unrecognized_keys 的问题；内置团队更新到当前包，原内容保留备份，第三方自定义包按其实际契约处理。
- 修复 Windows 并发测试目录清理和共享依赖准备顺序；Linux 安装包按 DEB、RPM、AppImage 格式使用可独立核验的打包任务。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/581feef4e29295568e908eb06b8e4964d978087f) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/a6e0ae3c25ea47024b796b0661d976c8fdfcf31e...581feef4e29295568e908eb06b8e4964d978087f)。

### en-US

#### Fixed

- Fixed older built-in squads being unreadable/unupdatable and installed lists reporting many `unrecognized_keys`. Built-ins update to current packages with original content backed up; third-party packages follow their actual contracts.
- Fixed concurrent Windows test-directory cleanup and shared dependency preparation order. Linux DEB, RPM and AppImage packaging uses independently verifiable jobs.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/581feef4e29295568e908eb06b8e4964d978087f) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/a6e0ae3c25ea47024b796b0661d976c8fdfcf31e...581feef4e29295568e908eb06b8e4964d978087f).

## 0.1.6 - 2026-09-19

### zh-CN

#### 修复

- 修复 Mission 携带已上传文件或文件夹发送消息时的 `unrecognized_keys` 错误；首次发送与后续回复统一按接口契约提交附件引用。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/a6e0ae3c25ea47024b796b0661d976c8fdfcf31e) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/6775a92aa80f0436fabd49f97a4380e38200b5c9...a6e0ae3c25ea47024b796b0661d976c8fdfcf31e)。

### en-US

#### Fixed

- Fixed `unrecognized_keys` when Missions send uploaded files/folders. First sends and follow-ups use the same attachment-reference API contract.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/a6e0ae3c25ea47024b796b0661d976c8fdfcf31e) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/6775a92aa80f0436fabd49f97a4380e38200b5c9...a6e0ae3c25ea47024b796b0661d976c8fdfcf31e).

## 0.1.5 - 2026-09-19

### zh-CN

#### 修复

- 修复重复打开 Provider（模型服务商）登录时，同一有效授权被误报为冲突；取消授权码输入时释放待处理流程，并改善真实并发冲突提示。
- 托管服务启动回执从持久化文件状态确认，修复文件通知丢失后已启动进程仍被判定启动超时的问题。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/6775a92aa80f0436fabd49f97a4380e38200b5c9) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/3010ea34c1b99fe35bf9f36840f5dfb9000f5b7a...6775a92aa80f0436fabd49f97a4380e38200b5c9)。

### en-US

#### Fixed

- Fixed reopening Provider login reporting conflicts for the same valid authorization. Cancelling authorization-code input releases the pending flow, with clearer actual concurrent-conflict messages.
- Managed-service startup receipts confirm persisted state, fixing ready processes being reported timed out after missed file notifications.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/6775a92aa80f0436fabd49f97a4380e38200b5c9) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/3010ea34c1b99fe35bf9f36840f5dfb9000f5b7a...6775a92aa80f0436fabd49f97a4380e38200b5c9).

## 0.1.4 - 2026-09-19

### zh-CN

#### 新增

- 官网新增按任务输入、调用模型和协作关系呈现的案例画廊，并将案例、机制与研究资料整理为中英文博客。

#### 调整

- 精简首页内容，突出长程任务与专家团协作；改进协作图、导航和原有产品视觉。
- 子 agent 流式更新保持会话卡片稳定；缩紧停靠区标签间距，调整宽度后仍能看到当前选中会话。
- 原生发布与网站部署使用明确的触发选项，保持正式版安装包版本一致。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/3010ea34c1b99fe35bf9f36840f5dfb9000f5b7a) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/f0d1063affc2e3bedb94fee6ce909e4b20ab9db8...3010ea34c1b99fe35bf9f36840f5dfb9000f5b7a)。

### en-US

#### Added

- Added a website case gallery showing actual Task inputs, models and collaboration, and organized cases, mechanisms and research into bilingual blogs.

#### Changed

- Simplified the homepage around long-horizon work and squad collaboration, improving collaboration graphs, navigation and established product visuals.
- Streaming agent updates keep Session cards stable. Dock labels use tighter spacing, and resizing retains the selected conversation in view.
- Native releases and website deployments use explicit dispatch options and consistent stable-installer versions.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/3010ea34c1b99fe35bf9f36840f5dfb9000f5b7a) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/f0d1063affc2e3bedb94fee6ce909e4b20ab9db8...3010ea34c1b99fe35bf9f36840f5dfb9000f5b7a).

## 0.1.3 - 2026-09-19

### zh-CN

#### 新增

- 提供连接已有服务的 Mission、Task、Work Ledger、Question 与 Permission 命令行入口，支持结构化 JSON 输出、分页和交互回复。

#### 调整

- 发布正式版 `0.1.3`，使用 stable 桌面更新通道。此前 beta 安装使用独立通道，可通过本版安装包切换到正式版。
- 改进子 agent 消息停靠区的阅读布局，弱化交接提示并隐藏无动作回执。

#### 修复

- 专家团已授权的平台基础工具直接进入初始能力面，保留 Skill 与 MCP 的按需加载；明确主目录执行与托管工作树的 `merge_back` 交付契约。
- 修复全局清理等待定时任务释放项目租约、而取消信号尚未发送所导致的循环等待。
- 修复交互测试绕过不可变 Task 归属事件的问题，以及子 agent 实时消息来源为空时的处理。
- 命令行无损传递问题回答和远端项目路径，正确输出 JSON、Ledger 游标与 Task 取消中的状态。
- Windows 构建提前检查被占用的可执行文件，准确覆盖 Cargo 实际写入路径。

#### 安全

- 将网站传递依赖 `devalue` 更新到 `5.9.2`，修复 GHSA-9rgm-9g3h-6x36。

#### 升级

- 本版相对 `0.1.2-beta` 未修改数据库结构定义。更早 beta 数据库若报告 `SCHEMA_RESET_REQUIRED`，仍需按该版本边界显式处理旧数据；Provider 配置应保留。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/f0d1063affc2e3bedb94fee6ce909e4b20ab9db8) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/57077bf019e5a427e6a37c6d850f926fd47a2665...f0d1063affc2e3bedb94fee6ce909e4b20ab9db8)。

### en-US

#### Added

- Added Mission, Task, Work Ledger, Question and Permission CLI entries for existing services, with structured JSON output, pagination and interaction responses.

#### Changed

- Published stable `0.1.3` on the stable desktop update channel. Earlier beta installations use a separate channel; this installer can switch them to stable.
- Improved agent-message dock reading, reducing handoff emphasis and hiding receipts without actions.

#### Fixed

- Authorized platform primitives enter squads' initial capability surface, with Skills and MCP loaded on demand. Clarified main-directory execution and managed-worktree `merge_back` delivery.
- Fixed cleanup waiting for scheduled tasks to release project leases before sending cancellation, which caused a circular wait.
- Fixed interactive tests bypassing immutable Task ownership events and handling of empty source data in live agent messages.
- CLI responses preserve question answers and remote project paths and correctly output JSON, Ledger cursors and Task cancellation state.
- Windows builds check occupied executables early across the files Cargo actually writes.

#### Security

- Updated website transitive dependency `devalue` to `5.9.2`, fixing GHSA-9rgm-9g3h-6x36.

#### Upgrade

- Database schema definitions are unchanged from `0.1.2-beta`. Earlier beta databases reporting `SCHEMA_RESET_REQUIRED` still require explicit handling under that version boundary. Retain Provider configuration.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/f0d1063affc2e3bedb94fee6ce909e4b20ab9db8) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/57077bf019e5a427e6a37c6d850f926fd47a2665...f0d1063affc2e3bedb94fee6ce909e4b20ab9db8).

## 0.1.2beta - 2026-09-18

### zh-CN

#### 修复

- 修复 Project 删除后遗留的 Question、Permission 与内联交互失去 Task 归属并使 Work Ledger 整体返回 500；Task-root reducer、删除、重启恢复与交互写入现在使用同一不可变归属契约。
- 修复带 worker descriptor 的 Project 无法删除，以及删除后 Overlay 继续使用失效目录请求 Provider 和 Work Ledger 的问题。
- 修复 Windows 已终止进程仍被判定为活动 owner，阻塞运行时恢复与清理的问题。
- 修复 Side Dock 切换子 agent 后仍显示旧子会话的问题。
- 移除附件目录的数据库 authority marker；附件归属由当前数据库和 Project 事实直接校验，不再因重建数据库留下跨库锁。

#### 升级与已知限制

- 本版数据库结构指纹发生变化。旧 beta 任务数据库会返回 `SCHEMA_RESET_REQUIRED`，需要显式重置后使用；这是预发布数据边界，不是保留任务数据的原地迁移。Provider 配置存放在独立配置面，应在重置时保留。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/57077bf019e5a427e6a37c6d850f926fd47a2665) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/9faeb1c7ba879c94e38b25a0b2614398cc5a795b...57077bf019e5a427e6a37c6d850f926fd47a2665)。

### en-US

#### Fixed

- Fixed Question, Permission and inline interactions losing Task ownership after Project deletion and causing Work Ledger to return 500. Task-root reducers, deletion, restart recovery and interaction writes use one immutable ownership contract.
- Fixed deletion of Projects with worker descriptors and Overlay requests for Providers/Work Ledger retaining invalid directories after deletion.
- Fixed terminated Windows processes still appearing as active owners and blocking runtime recovery/cleanup.
- Fixed Side Dock retaining the old agent Session after selection changed.
- Removed attachment-directory database authority markers. Attachment ownership is validated from current database and Project facts, without cross-database locks surviving rebuilds.

#### Upgrade and known limitations

- The database schema fingerprint changed. Old beta Task databases return `SCHEMA_RESET_REQUIRED` and require explicit reset. This is a prerelease data boundary, not an in-place migration preserving tasks. Provider settings live separately and should be retained during reset.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/57077bf019e5a427e6a37c6d850f926fd47a2665) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/9faeb1c7ba879c94e38b25a0b2614398cc5a795b...57077bf019e5a427e6a37c6d850f926fd47a2665).

## 0.1.1beta - 2026-09-17

### zh-CN

#### 修复

- 修复任务委托准备失败后的执行收敛、关闭期间的任务接纳顺序和首次委托前的 Mission 验收责任绑定。
- 修复永久工具再次被搜索揭示后，能力投影重复导致后续模型步骤失败的问题。
- 修复原生包连续加载动态插件，以及工具输入进度重连和终态任务耗时显示的问题。
- 降低数据库调度证据校验的 SQL 嵌套深度，修复系统 SQLite 创建数据库时的解析栈溢出。
- 启动失败在进程及输出流收敛后保留有界诊断，首次使用检查失败时保留隔离现场。
- 修复 OAuth 回调身份探测超时后仍返回空响应时，被误判为外来服务并轮换回调地址的问题。

#### 升级与已知限制

- 本版数据库结构指纹发生变化，旧 beta 任务数据库会返回 `SCHEMA_RESET_REQUIRED`，需要显式重置后使用。程序不会自动迁移或删除旧数据；Provider 配置应单独保留。
- 历史上出现过单次模型响应持续生成工具参数、迟迟无法结束的情况，根因仍在调查。此前候选构建通过的真实任务验收也不能证明该问题已根治。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/9faeb1c7ba879c94e38b25a0b2614398cc5a795b) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/d1f974e58306ea3058e356192e2ffd2de910cafe...9faeb1c7ba879c94e38b25a0b2614398cc5a795b)。

### en-US

#### Fixed

- Fixed execution settlement after delegation preparation failures, Task admission ordering during shutdown and Mission acceptance ownership before first delegation.
- Fixed permanent tools being rediscovered and duplicated capability projection breaking later model steps.
- Fixed repeated native-package dynamic-plugin loading, tool-input progress reconnection and terminal Task duration display.
- Reduced SQL nesting in dispatch-evidence validation, fixing parser-stack overflow when system SQLite creates a database.
- Startup failures retain bounded diagnostics after process/output settlement; failed first-use checks retain their isolated environment.
- Fixed OAuth callback identity probes returning empty responses after timeout being mistaken for foreign services and rotating callback addresses.

#### Upgrade and known limitations

- The database fingerprint changed. Old beta Task databases return `SCHEMA_RESET_REQUIRED` and require explicit reset. No automatic migration or deletion occurs; retain Provider configuration separately.
- A historical model response kept generating tool arguments without ending. Its cause remained under investigation. Real Task acceptance in earlier candidates did not prove this resolved.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/9faeb1c7ba879c94e38b25a0b2614398cc5a795b) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/d1f974e58306ea3058e356192e2ffd2de910cafe...9faeb1c7ba879c94e38b25a0b2614398cc5a795b).

## 0.1.0beta - 2026-09-16

### zh-CN

本版本纳入当前运行时与专家团改进，并修复全新安装环境的 Work/Chat 创建失败，继续使用 beta 更新通道。

#### 修复

- 全局配置文件缺失、为空或只有空白时，由统一配置边界补齐默认值，修复首页创建 Work、Chat 时的 500 错误。
- 用户原始要求在任务委托与模型输入中保留真实来源，终态任务证据可按精确消息身份读取，初始消息偏移采用统一契约。
- 改进运行时恢复、消息发送回执与任务证据读取，保留当前分支的执行收敛修复。

#### 调整

- Base 专家团补齐源数据发现、完整事实覆盖、执行结果和外部修改验收的提示词约束。
- 新增原生二进制首次使用检查：隔离无凭据运行目录，通过真实 HTTP（Hypertext Transfer Protocol，超文本传输协议）创建 Work/Chat，并在重启后核对持久化会话；桌面内嵌后端和命令行包共用此检查。
- 纳入 AutomationBench 的 Harbor 运行适配与验收记录；这些记录不等同于本次发布的新模型评测结论。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/d1f974e58306ea3058e356192e2ffd2de910cafe) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/5b11c32e5b5e914cfda9979b12d67c6ed1170714...d1f974e58306ea3058e356192e2ffd2de910cafe)。

### en-US

This version includes runtime and squad improvements and fixes Work/Chat creation on fresh installations. It continues to use the beta update channel.

#### Fixed

- Unified configuration initialization supplies defaults for absent, empty or whitespace-only global files, fixing 500 errors when creating Work/Chat from Home.
- Original requirements retain actual sources in delegation/model inputs. Terminal Task evidence can be read by exact message identity, and initial-message offsets use one contract.
- Improved runtime recovery, send receipts and Task evidence reads, retaining the branch's execution-settlement fixes.

#### Changed

- Base prompts require source-data discovery, complete fact coverage, execution outcomes and acceptance of external changes.
- Added native-binary first-use checks: isolated credential-free roots create Work/Chat through real HTTP and verify persisted Sessions after restart. Embedded desktop backends and CLI packages share this check.
- Included AutomationBench Harbor adapters and acceptance records; these records are not new model-evaluation conclusions for this release.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/d1f974e58306ea3058e356192e2ffd2de910cafe) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/5b11c32e5b5e914cfda9979b12d67c6ed1170714...d1f974e58306ea3058e356192e2ffd2de910cafe).

## 0.0.64beta - 2026-09-11

### zh-CN

本版本汇集 `0.0.63-beta` 之后的运行时、授权与网站改进，继续使用 beta 更新通道。

#### 调整

- 初始工具列表直接暴露已授权且当前可执行的常规工具；专业扩展能力继续通过能力搜索发现，工具清单与实际授权保持一致。
- Provider（模型服务商）物理请求身份贯穿流式调用、错误记录与工作台诊断，便于追踪实际请求使用的模型。
- 网站新增中英文工作台入门指引、可下载示例、产品演示与标注为 PoC（Proof of Concept，概念验证）及 Under Construction 的论文 PDF。

#### 修复

- 修复 OAuth（开放授权）处理中活动交换的持久化与租约续期，以及设备码和浏览器授权的截止时间处理。
- 生命周期事务在读取状态前取得 SQLite 写入保留，覆盖调度、任务文件引用、完成结算及消息确认等共享路径。
- 统一文件、预览与项目目录的精确路径身份，修复 Windows 原子重命名与活动读取冲突，并等待异步日志写入完成。

#### 安全

- 将 `qs`、`svgo` 与 `@ai-sdk/provider-utils` 分别锁定到 `6.16.0`、`4.1.0` 与 `4.0.38`，采用上游对查询数组限额、SVG（Scalable Vector Graphics，可缩放矢量图形）清理及响应读取限额的修复；`@ai-sdk/provider` 同步到配套的 `3.0.14`，统一适配器错误类型。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/5b11c32e5b5e914cfda9979b12d67c6ed1170714) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/752d8b3d27dfc3a95ba7ef2956efd69250683fa7...5b11c32e5b5e914cfda9979b12d67c6ed1170714)。

### en-US

This beta-channel version combines runtime, authorization and website improvements after `0.0.63-beta`.

#### Changed

- Initial tool lists directly expose authorized, currently executable ordinary tools. Specialized extensions use capability search; declarations match actual grants.
- Physical Provider request identity follows streaming calls, errors and workspace diagnostics, making the actual requested model traceable.
- Added bilingual workspace guides, downloadable examples, product demos, and a paper PDF labeled Proof of Concept (PoC) and Under Construction.

#### Fixed

- Fixed persistence and lease renewal of active OAuth exchanges, and deadlines for device-code and browser authorization.
- Lifecycle transactions reserve SQLite writes before reading state across dispatch, Task file references, completion and message acknowledgement.
- Unified exact file/preview/project-directory identity, fixed Windows atomic-renaming conflicts with active reads, and waited for asynchronous logs to finish.

#### Security

- Pinned `qs`, `svgo` and `@ai-sdk/provider-utils` to `6.16.0`, `4.1.0` and `4.0.38` for upstream query-array limits, SVG sanitization and response-read limits. Matching `@ai-sdk/provider` `3.0.14` unifies adapter error types.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/5b11c32e5b5e914cfda9979b12d67c6ed1170714) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/752d8b3d27dfc3a95ba7ef2956efd69250683fa7...5b11c32e5b5e914cfda9979b12d67c6ed1170714).

## 0.0.63beta - 2026-09-07

### zh-CN

本版本替代已生成二进制但网站未完成激活的 `0.0.62-beta`。旧 tag 与 Release 保持不可变；本版本在新的 source identity 上重新执行完整原生矩阵、更新清单和网站发布。数据库继续只接受当前 pre-release schema epoch，不增加历史 migration、兼容 reader 或线上注册表绕行。

#### 修复

- 修复 Evolution Lab 内容变化后仍复用旧 package revision 的生成闭包：canonical generator 现在发布新的内部 revision，并同步 payload 与 revision registry；发布工作流在取得 tag/draft owner 前执行同一 fixed-point 检查，内容不同的 immutable revision 仍由网站数据库严格拒绝。
- 修复 Worktree population 失败及命名 stale reclaim 在持有自身目录 acquisition 时调用移除、因而把自己误判为 active owner 的收敛矛盾；唯一精确 acquisition 现在原子转换为 removal ownership，并在移除后继续保护同一创建区间，真实 peer acquisition 仍优先阻止删除。
- 修复 Task 创建与转储校验混用 root Session 逻辑目录、process binding 物理目录的问题，以及 macOS `/tmp` 与 `/private/tmp` 指向同一物理根时的 process-binding 冲突；接受快照、物理执行 authority 与后续 Project relocation 各自保持单一事实来源。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/752d8b3d27dfc3a95ba7ef2956efd69250683fa7) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/63b52453f233ba6b1eeeac6bd2eb8c7007c6af3a...752d8b3d27dfc3a95ba7ef2956efd69250683fa7)。

### en-US

This version replaces `0.0.62-beta`, whose binaries were generated but whose website was not activated. The old tag and Release remain immutable. A new source identity reruns the complete native matrix, update manifests and website publication. The database accepts only the current prerelease schema epoch, without historical migrations, compatibility readers or a live-Registry bypass.

#### Fixed

- Fixed Evolution Lab generation reusing old package revisions after content changed. The canonical generator publishes a new internal revision and synchronizes payload/Registry. Publication checks the same fixed point before tag/draft ownership; the website database still rejects different content under one immutable revision.
- Fixed failed worktree population and stale-name reclamation treating their own directory acquisition as a live owner during removal. Exact acquisitions atomically convert to removal ownership and continue protecting the same creation interval; real peers still prevent deletion.
- Fixed Task creation/dump validation mixing root Session logical directories with process-binding physical directories, and macOS `/tmp` versus `/private/tmp` bindings for the same physical root. Acceptance snapshots, physical execution authority and later Project relocation each retain one source of truth.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/752d8b3d27dfc3a95ba7ef2956efd69250683fa7) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/63b52453f233ba6b1eeeac6bd2eb8c7007c6af3a...752d8b3d27dfc3a95ba7ef2956efd69250683fa7).

## 0.0.62beta - 2026-09-06

### zh-CN

本版本在 `0.0.61-beta` 的不可变发布基础上同步最新源码，修复干净环境的发布前检查，并重新发布完整桌面端、命令行、更新清单和公开网站。数据库继续采用当前 pre-release schema epoch：不新增历史 migration 或兼容 reader，不兼容的旧数据库需要显式重置。

#### 调整

- 已知的精确能力引用可以直接分组 reveal；未知能力仍通过 Search-native 目录发现，所有授权、冻结输入和 receipt replay 约束保持不变。
- Light 专家团在不可变 package 内容中声明完整的调度、报告读取、完成、方法 Skill 与文件读取 locator；清单仍是唯一授权来源，提示词引用不会新增 grant。
- 发布工作流在原生矩阵编译前取得唯一 tag/draft owner，失败重跑只恢复同一 workflow-run/source 的发布身份，不会创建或接管另一运行的草稿。

#### 修复

- 修复 Dynamic 专家团内容与 revision 记录漂移，确保 canonical generator 在干净 runner 上保持零差异。
- 修复 Architect 与跨进程 workflow-node 测试夹具未建立真实 Task-root ingress、Orchestrator Tool occurrence 和 dispatch-lineage 顺序的问题，使 CI 验证当前数据库约束而不是旧的宽松夹具。
- 修复网站 package-tool 源码 export 解析、公开工具事实、下载页面缓存验证器和 immutable Squad 路径匹配；普通刷新会读取当前发布版本，同时内容寻址资源继续使用长期 immutable 缓存。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/63b52453f233ba6b1eeeac6bd2eb8c7007c6af3a) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/22ce8838a043c3cd8c0a0107ef5cee2aa238c059...63b52453f233ba6b1eeeac6bd2eb8c7007c6af3a)。

### en-US

This version updates source from immutable `0.0.61-beta`, fixes clean-environment release checks and republishes desktop/CLI packages, update manifests and the website. The database keeps the current prerelease schema epoch. No historical migration or compatibility reader is added; incompatible databases require explicit reset.

#### Changed

- Known exact capability references can be revealed in groups. Unknown capabilities use the search-native catalog, retaining authorization, frozen inputs and receipt replay.
- Light's immutable package declares full dispatch, report-read, completion, method-Skill and file-read locators. Its manifest is the sole grant source; prompt references do not add grants.
- Publication acquires unique tag/draft ownership before native compilation. Retries restore only the same workflow-run/source identity and cannot create or take over another run's draft.

#### Fixed

- Fixed Dynamic package-content/revision drift so canonical generation has no changes on clean runners.
- Fixed Architect and cross-process workflow-node fixtures lacking real Task-root ingress, orchestrator tool occurrences and dispatch-lineage ordering; CI checks current database constraints.
- Fixed website package-tool export parsing, public tool facts, download-page validators and immutable Squad-path matching. Normal refresh reads the current release while content-addressed resources retain long immutable caching.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/63b52453f233ba6b1eeeac6bd2eb8c7007c6af3a) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/22ce8838a043c3cd8c0a0107ef5cee2aa238c059...63b52453f233ba6b1eeeac6bd2eb8c7007c6af3a).

## 0.0.61beta - 2026-09-05

### zh-CN

这是承接此前未公开候选的版本，保留其功能并完成发布控制面的修复。

#### 修复

- 草稿发布从完整 Release inventory（发布清单）读取并校验唯一的工作流运行/源码归属；存在同一归属草稿时恢复它，刚创建的草稿采用有界可见性重试。
- 重跑同一发布继续使用既有身份，避免重复草稿和由此引起的安装包上传失败。

#### 调整

- 汇入 0.0.55beta 至 0.0.60beta 已实现的渲染安全、全局对话、Light 咨询、动态团队、运行时与调度改进；对应改动在各候选记录中分别说明。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/22ce8838a043c3cd8c0a0107ef5cee2aa238c059) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/988128d4e455c099f3959818645b551bfa35dbd9...22ce8838a043c3cd8c0a0107ef5cee2aa238c059)。

### en-US

This version carries forward unpublished candidates' functionality and fixes the release control plane.

#### Fixed

- Draft publication reads complete Release inventory and validates unique workflow-run/source ownership. Matching drafts are resumed, with bounded visibility retries for newly created drafts.
- Retries reuse the existing publication identity, preventing duplicate drafts and resulting upload failures.

#### Changed

- Includes rendering security, global Chat, Light consultation, Dynamic squads, runtime and dispatch improvements implemented in 0.0.55beta through 0.0.60beta, recorded separately in their candidate entries.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/22ce8838a043c3cd8c0a0107ef5cee2aa238c059) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/988128d4e455c099f3959818645b551bfa35dbd9...22ce8838a043c3cd8c0a0107ef5cee2aa238c059).

## 0.0.60beta - 2026-09-05

### zh-CN

这是未公开候选；当时原生矩阵完成，草稿可见性与重复记录问题阻断了后续发布。

#### 修复

- 将草稿发布归属查询改为可读取 draft（草稿）的完整发布清单，修复只面向公开 Release 的标签查询无法读取新草稿的问题。
- 原生产物继续绑定既有精确标签和源码，后续版本进一步修复草稿创建后的可见性与续跑。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/988128d4e455c099f3959818645b551bfa35dbd9) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/0a4d4180f9cbf8a9c27a8f3c67b72a7609ed466e...988128d4e455c099f3959818645b551bfa35dbd9)。

### en-US

This was an unpublished candidate. The native matrix completed, but draft visibility and duplicate records blocked later publication.

#### Fixed

- Draft ownership uses complete inventory including drafts, fixing public-Release-only tag lookups being unable to read new drafts.
- Native artifacts retain their existing exact tag/source binding; later versions further fix post-creation visibility and continuation.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/988128d4e455c099f3959818645b551bfa35dbd9) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/0a4d4180f9cbf8a9c27a8f3c67b72a7609ed466e...988128d4e455c099f3959818645b551bfa35dbd9).

## 0.0.59beta - 2026-09-05

### zh-CN

这是未公开候选，记录 0.0.58beta 之后的运行时与调度改动；发布汇总在读取新草稿时失败。

#### 调整

- Task、Mission、Session、等待与定时任务使用持久化执行轮次、精确请求归属和租约/结算记录处理接纳、唤醒、重试与恢复。
- 并行工作者的最终报告按明确消息集合批量读取；Light 咨询按分配的来源和工具预算组织调查与最终报告。

#### 修复

- 修复终态 Task 关闭尾部、等待信号、定时任务重试与信箱投递中的重复、遗漏和错误接管。
- 能力搜索公开有界覆盖范围，统一空筛选和已激活 Skill 引用的读取；Mission 完成核对精确证据与实际最终回复。

#### 性能

- 等待、定时与恢复查询采用索引和有界分页/批量处理，减少随定义和历史记录增长的重复读取。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/0a4d4180f9cbf8a9c27a8f3c67b72a7609ed466e) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/42e6d28c7cc565f2cbe00fbfb0ba1966db9eb67a...0a4d4180f9cbf8a9c27a8f3c67b72a7609ed466e)。

### en-US

This unpublished candidate records runtime/dispatch changes after 0.0.58beta. Release aggregation failed while reading the new draft.

#### Changed

- Tasks, Missions, Sessions, waits and schedules use durable execution rounds, exact request ownership and lease/settlement records for admission, wakes, retries and recovery.
- Parallel workers' final reports are read in batches by explicit message sets. Light consultations organize investigation and reporting within assigned source/tool budgets.

#### Fixed

- Fixed duplicate, missing and wrongly claimed terminal-Task shutdown tails, wait signals, schedule retries and mailbox delivery.
- Capability search exposes bounded coverage and unifies empty filters and active-Skill reads. Mission completion checks exact evidence and actual final replies.

#### Performance

- Wait, schedule and recovery queries use indexes and bounded paging/batching to reduce repeated reads as definitions and history grow.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/0a4d4180f9cbf8a9c27a8f3c67b72a7609ed466e) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/42e6d28c7cc565f2cbe00fbfb0ba1966db9eb67a...0a4d4180f9cbf8a9c27a8f3c67b72a7609ed466e).

## 0.0.58beta - 2026-08-29

### zh-CN

这是未公开候选，承接前一候选的架构与能力改进。

#### 新增

- 新增 Dynamic 动态专家团，按当前请求生成成员分工和工作流说明，供运行时组织工作。

#### 修复

- 原生 Overlay 打包选择工作区 source export condition（源码导出条件），修复干净 runner 无法解析 SDK、util 与 plugin 源码导出的问题。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/42e6d28c7cc565f2cbe00fbfb0ba1966db9eb67a) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/fc390c86cb18f4d7ba74b3e763070c7b81ef1361...42e6d28c7cc565f2cbe00fbfb0ba1966db9eb67a)。

### en-US

This unpublished candidate carries forward the previous candidate's architecture and capability improvements.

#### Added

- Added Dynamic squads that generate roles and workflow guidance for the current request, allowing the runtime to organize work.

#### Fixed

- Native Overlay packaging selects workspace source export conditions, fixing clean runners being unable to resolve SDK, util and plugin source exports.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/42e6d28c7cc565f2cbe00fbfb0ba1966db9eb67a) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/fc390c86cb18f4d7ba74b3e763070c7b81ef1361...42e6d28c7cc565f2cbe00fbfb0ba1966db9eb67a).

## 0.0.57beta - 2026-08-29

### zh-CN

#### 调整

- 将下一次原生打包候选统一为 0.0.57-beta，沿用 0.0.56beta 及其编号候选的产品功能和发布恢复改动。
- 本次版本提交集中在版本投影，没有单独增加产品功能；随后干净环境打包暴露的源码导出问题在 0.0.58beta 修复。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/fc390c86cb18f4d7ba74b3e763070c7b81ef1361) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/f55fef191afd74352611da0235938a011d6d7766...fc390c86cb18f4d7ba74b3e763070c7b81ef1361)。

### en-US

#### Changed

- Unified the next native-packaging candidate as 0.0.57-beta, retaining product and release-recovery changes from 0.0.56beta and its numbered candidates.
- This version commit updates version projections without separate product features. Source-export problems exposed by later clean packaging were fixed in 0.0.58beta.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/fc390c86cb18f4d7ba74b3e763070c7b81ef1361) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/f55fef191afd74352611da0235938a011d6d7766...fc390c86cb18f4d7ba74b3e763070c7b81ef1361).

## 0.0.56beta.1 - 2026-08-29

### zh-CN

#### 修复

- 改善 beta 发布的草稿与重跑处理，保留成功构建的产物并让失败阶段可恢复；更新相应版本与生成投影。
- 沿用 0.0.56beta 的功能基线，后续候选继续处理依赖与原生打包问题。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/f55fef191afd74352611da0235938a011d6d7766) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/8691c972d18486f8c5848b869b184d9c7e6395cb...f55fef191afd74352611da0235938a011d6d7766)。

### en-US

#### Fixed

- Improved beta drafts and retries, retaining successfully built artifacts and recovering failed stages; synchronized version and generated projections.
- Retained the 0.0.56beta feature baseline. Later candidates continued dependency/native-packaging repairs.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/f55fef191afd74352611da0235938a011d6d7766) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/8691c972d18486f8c5848b869b184d9c7e6395cb...f55fef191afd74352611da0235938a011d6d7766).

## 0.0.56beta - 2026-08-29

### zh-CN

这是集中整合架构与能力改进的候选版本；其改动随后进入后续公开版本。

#### 新增

- 新增全局 Chat，支持在项目任务之外开展持续对话；新增运行时 Skill Market 与 Inspect AI benchmark（评测）接入。
- 新增 Light 轻量咨询团队，用于只读咨询、证据调查、比较和规划。

#### 调整

- 统一 Task、Mission、Session、Provider、MCP、调度、持久化与桌面工作台的责任与组合边界，清理重复状态和废弃入口。
- 任务、需求、验收、产物与工具结果通过类型化事实和精确来源交接，专业能力按已授权的引用提供。

#### 修复

- 修复跨项目初始化和身份归属、原生 OpenAI 工具调用序列化、MCP 会话运行时归属，以及 Mission 验收和唤醒恢复的多个共享问题。
- 原生 SDK、util、plugin 和依赖投影与候选版本同步；安装预检使用实际打包输出。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/8691c972d18486f8c5848b869b184d9c7e6395cb) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/22832f8fb97df24a50c14145fc03bf995db54e42...8691c972d18486f8c5848b869b184d9c7e6395cb)。

### en-US

This candidate consolidates architecture and capability improvements subsequently included in public releases.

#### Added

- Added global Chat outside project Tasks, the runtime Skill Market and Inspect AI benchmark integration.
- Added Light for read-only consultation, evidence investigation, comparison and planning.

#### Changed

- Unified responsibility/composition boundaries for Task, Mission, Session, Provider, MCP, dispatch, persistence and desktop workspace, removing duplicate state and retired entries.
- Tasks, requirements, acceptance, artifacts and tool results exchange typed facts and exact sources; specialized capabilities use authorized references.

#### Fixed

- Fixed shared issues in cross-project initialization/ownership, native OpenAI tool-call serialization, MCP session runtime ownership and Mission acceptance/wake recovery.
- Synchronized native SDK, util, plugin and dependency projections with the candidate version; installation preflight checks actual packaged output.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/8691c972d18486f8c5848b869b184d9c7e6395cb) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/22832f8fb97df24a50c14145fc03bf995db54e42...8691c972d18486f8c5848b869b184d9c7e6395cb).

## 0.0.55beta - 2026-08-25

### zh-CN

#### 新增

- 官网新增可展开的长程 Mission 案例与协作关系图，呈现 DeBERTa CUDA 研究产物和 AutomationBench 的原始证据入口。

#### 安全

- 移除桌面渲染器暴露在 window 上的实时设置、应用与看板状态，以及明文服务密码和业务写入函数；生产代码改用类型化模块依赖。
- 清理依赖这些全局对象的调试入口，收紧渲染器可直接读写的业务边界。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/22832f8fb97df24a50c14145fc03bf995db54e42) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/b10c5ebc407b6fcefb93a44a27db6b162379c1ea...22832f8fb97df24a50c14145fc03bf995db54e42)。

### en-US

#### Added

- Added expandable long-horizon Mission cases and collaboration graphs on the website, showing DeBERTa CUDA research artifacts and original AutomationBench evidence entries.

#### Security

- Removed live settings, app/board state, plaintext service passwords and mutation functions exposed on the renderer's window. Production uses typed module dependencies.
- Removed debugging entries relying on those globals and tightened direct renderer read/write boundaries.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/22832f8fb97df24a50c14145fc03bf995db54e42) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/b10c5ebc407b6fcefb93a44a27db6b162379c1ea...22832f8fb97df24a50c14145fc03bf995db54e42).

## 0.0.54beta - 2026-08-25

### zh-CN

本版本为共享 LLM 流停滞恢复增加明确上限，并修复公开网站“页面显示新版、主按钮却未绑定精确新版安装包”的下载交互；桌面端、命令行二进制和网站使用同一份 `0.0.54-beta` 发布事实。

#### 调整

- LLM 首字节等待缩短为 90 秒；首字节或流式空闲超时各只重试一次，使同一停滞请求链在十分钟内以具名错误收敛，不再重复等待长超时。
- 网站下载菜单逐项显示架构、格式、当前版本和精确文件名；Windows 主按钮明确标出 EXE，避免与同架构 MSI 混淆。

#### 修复

- 修复首次标题生成在执行轮次开始后、主会话处理器启动前可能无限等待的问题；标题、项目记忆整理和提交信息生成现在统一使用共享的首字节、语义空闲与总时限契约。标题继承所属执行轮次的取消信号，项目记忆整理和提交信息生成继承各自调用方的取消信号。
- 修复浏览器不提供高熵架构提示时，Windows 主按钮仍停留在 GitHub Release 页面、却显示为直接下载的问题；当发布清单证明该平台只有一个架构时，按钮现在绑定清单排序的当前 EXE。
- 修复无法安全判定平台或架构时仍把 Release 链接包装成下载动作的问题；此时主按钮会展开当前版本的显式选择菜单。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/b10c5ebc407b6fcefb93a44a27db6b162379c1ea) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/23df4780d31336c97bfaaa2460e8747be70f0d7f...b10c5ebc407b6fcefb93a44a27db6b162379c1ea)。

### en-US

This version bounds shared stalled-LLM-stream recovery and fixes website downloads showing the new release without binding the primary button to its exact installer. Desktop, CLI and website use the same `0.0.54-beta` release facts.

#### Changed

- LLM first-byte waiting is 90 seconds. First-byte or streaming-idle timeouts retry once each, settling one stalled chain within ten minutes with a named error instead of repeated long waits.
- Download menus show architecture, format, current version and exact filename. Windows primary buttons explicitly say EXE to distinguish MSI on the same architecture.

#### Fixed

- Fixed first-title generation waiting indefinitely after execution began but before the main Session processor started. Titles, project-memory organization and commit messages share first-byte, semantic-idle and overall deadlines. Titles inherit execution cancellation; memory/commit generation inherit caller cancellation.
- Fixed Windows buttons pointing to GitHub Releases while appearing to download directly when high-entropy architecture hints were unavailable. If the manifest proves one platform architecture, the button binds the current EXE in manifest order.
- Fixed Release links being presented as downloads when platform/architecture could not be safely identified. The primary button then opens explicit current-version choices.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/b10c5ebc407b6fcefb93a44a27db6b162379c1ea) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/23df4780d31336c97bfaaa2460e8747be70f0d7f...b10c5ebc407b6fcefb93a44a27db6b162379c1ea).

## 0.0.53beta - 2026-08-24

### zh-CN

本版本修复长时间运行任务的唤醒、活动续期与恢复终态收敛，同时恢复桌面端右侧工作区、工作台重命名和工具详情交互，并同步发布桌面端、命令行二进制和公开网站。

#### 调整

- 延迟唤醒现在公开稳定的持久化结算事实；长时间 Tool 执行会根据真实流式输出和持久化进度续期，不再被固定的绝对暂停时限误判为失活。
- 临时 Provider 诊断在进入持久化日志和错误边界前统一脱敏，避免上游请求上下文被意外记录。

#### 修复

- 修复恢复执行的 Task occurrence 在子 Session 已终止后仍无法收敛父级终态的问题。
- 修复 Overlay 右侧 Dock 的切换与新增菜单交互、Work Ledger 双击重命名，以及工具披露需要点击两次才能展开的问题。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/23df4780d31336c97bfaaa2460e8747be70f0d7f) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/d2b6fef84c158f3e92479f15da3ecd6cb82facd1...23df4780d31336c97bfaaa2460e8747be70f0d7f)。

### en-US

This version fixes long-running Task wakes, activity renewal and recovery settlement, restores right workspace panels, workbench renaming and tool details, and publishes desktop/CLI packages and the website together.

#### Changed

- Deferred wakes expose stable durable settlement. Long tools renew activity from actual streaming output and persisted progress, avoiding fixed absolute pause limits incorrectly declaring them inactive.
- Temporary Provider diagnostics are redacted before persisted logs/errors to avoid recording upstream request context.

#### Fixed

- Fixed resumed Task occurrences failing to settle parent terminal state after child Sessions terminated.
- Fixed right Dock switching/add menus, Work Ledger double-click renaming and tool disclosures requiring two clicks.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/23df4780d31336c97bfaaa2460e8747be70f0d7f) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/d2b6fef84c158f3e92479f15da3ecd6cb82facd1...23df4780d31336c97bfaaa2460e8747be70f0d7f).

## 0.0.52beta - 2026-08-22

### zh-CN

本版本收敛专家团工作流的公开投影、交付结算与独立验收权威链路，并同步发布桌面端、命令行二进制和公开网站。

#### 调整

- 公开 Market 与双语架构文档现在投影 Base 的 2 条、Advanced 的 6 条当前工作流；注册表、生成目录与详情页使用同一份当前 package 事实。
- Base、Advanced 与生成专家团模板的独立验收改为从原始要求和有限权威来源重建 action matrix，并按实体、规则与实际效果逐行核对。

#### 修复

- 修复调度器在 Agent Session 已完成、但父级尚未收到终态投递时缺少持久化结算事实的问题；协议现在公开可复核的 Session delivery settlement。
- 修复验收链在接收交付声明时可能丢失权威来源和效果证据，导致后续接受判断无法证明原始要求的问题。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/d2b6fef84c158f3e92479f15da3ecd6cb82facd1) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/06ccca072ae3dac3522438628c8ef77176c74b93...d2b6fef84c158f3e92479f15da3ecd6cb82facd1)。

### en-US

This version aligns public squad-workflow projection, delivery settlement and independent acceptance authority, publishing desktop/CLI packages and the website together.

#### Changed

- Market and bilingual architecture docs project Base's two and Advanced's six current workflows. Registry, generated catalogs and details use the same current package facts.
- Independent acceptance for Base, Advanced and generated squad templates reconstructs action matrices from original requirements and bounded authorities and checks each entity, rule and actual effect.

#### Fixed

- Fixed missing durable settlement when an Agent Session completed but the parent had not received terminal delivery. The protocol exposes reviewable Session delivery settlement.
- Fixed lost authority/effect evidence while receiving delivery claims, which prevented later acceptance from proving original requirements.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/d2b6fef84c158f3e92479f15da3ecd6cb82facd1) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/06ccca072ae3dac3522438628c8ef77176c74b93...d2b6fef84c158f3e92479f15da3ecd6cb82facd1).

## 0.0.51beta - 2026-08-22

### zh-CN

本版本继续修复多 Agent Harness 的调度、工具分配和外部业务系统验收质量，并同步发布桌面端、命令行二进制和公开网站。

#### 调整

- Base 与 Advanced 会先把验收标准拆成稳定编号，并按真实 Tool 能力把规划、执行和独立验收交给对应 Agent；只读 Agent 不再接收本地客户端、命令或外部状态变更。
- 对由当前政策、流程、模板或历史记录决定的批量业务操作，执行 Agent 会先冻结有限权威来源清单，再建立逐实体、逐规则、逐效果的 action matrix；Tester 会从原始要求和当前权威源独立重建并逐行核对。
- 可移植 Expert Squad 模板同步采用有限来源闭包、同效果表示证明和独立验收契约，避免新生成的专家团重复旧缺陷。

#### 修复

- 修复同一编排 Turn 内先更新 Goal、随后并行 dispatch 时，后续 Tool 会因决策身份漂移而被拒绝的问题；重启恢复继续使用持久化的同一决策集合。
- 修复运行时 prompt 标签、Prompt composition 指纹和实际 Agent/Session 归因可能不一致，导致 Provider 调用证据无法稳定复核的问题。
- 修复 `squad-sdk` 当前包字节仍声明旧 revision，以及 revision digest 读取平台相关 checkout 换行符、使 Windows 与 Linux 对同一提交生成不同基线的问题；生成器现在与 package payload 共用 UTF‑8/LF 规范字节。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/06ccca072ae3dac3522438628c8ef77176c74b93) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/a7f173cb69b488b72448ef35e5a87745bc4f6503...06ccca072ae3dac3522438628c8ef77176c74b93)。

### en-US

This version continues multi-agent Harness dispatch/tool allocation and external-business acceptance improvements, publishing desktop/CLI packages and the website together.

#### Changed

- Base and Advanced assign stable requirement IDs and allocate planning, execution and independent acceptance according to actual tool capability. Read-only agents no longer receive local-client, command or external-mutation work.
- For bulk business operations governed by policies, processes, templates or history, execution freezes a bounded authority inventory and builds an entity/rule/effect action matrix. Testers reconstruct it independently from original requirements and current authorities and check every row.
- Portable squad templates use the same bounded sources, effect-equivalence proof and independent-acceptance contract to prevent newly generated squads repeating old defects.

#### Fixed

- Fixed updating a Goal then dispatching in parallel in one orchestration Turn causing later tools to be rejected for decision-identity drift. Restart recovery retains the same durable decision set.
- Fixed inconsistent runtime prompt labels, prompt-composition fingerprints and actual Agent/Session attribution making Provider evidence unstable.
- Fixed `squad-sdk` current package bytes declaring an old revision and revision digests depending on checkout line endings, yielding different Windows/Linux baselines. Generator and package payload use the same canonical UTF-8/LF bytes.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/06ccca072ae3dac3522438628c8ef77176c74b93) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/a7f173cb69b488b72448ef35e5a87745bc4f6503...06ccca072ae3dac3522438628c8ef77176c74b93).

## 0.0.50beta - 2026-08-21

### zh-CN

本版本修复多 Agent Harness 在外部业务系统交付中的 Skill 投影与独立验收链路，并同步发布桌面端、命令行二进制和公开网站。

#### 调整

- Advanced 对外部系统的变更统一绑定到 `planned-delivery` 工作流；执行变更的 Agent 不再用自己的交付物充当独立验收，Tester 会从原始要求和权威数据源重新观察结果。
- Base 同步明确：变更执行者发布的 Artifact 是交付声明，不是独立验收证据。

#### 修复

- 修复 `universal-build` 能解析 Expert Squad Skill、却不出现在 Skill mount matrix 中的双源问题；matrix 现在同时覆盖 scheduler-only 与 package-projected Agent，并标明能力由 package 还是 platform 提供。
- 修复 Advanced 外部系统任务可能直接派给通用 worker、绕过计划交付和独立测试的问题。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/a7f173cb69b488b72448ef35e5a87745bc4f6503) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/0a6c203a320e411b16aac804db164498a9a56b97...a7f173cb69b488b72448ef35e5a87745bc4f6503)。

### en-US

This version fixes multi-agent Harness Skill projection and independent acceptance for external-system deliveries, publishing desktop/CLI packages and the website together.

#### Changed

- Advanced binds external mutations to `planned-delivery`. Executors do not use their own artifacts as independent acceptance; testers observe outcomes again from original requirements and authoritative sources.
- Base likewise treats executor-published artifacts as delivery claims rather than independent acceptance evidence.

#### Fixed

- Fixed `universal-build` resolving Squad Skills without appearing in the Skill mount matrix. The matrix covers scheduler-only and package-projected agents and identifies package versus platform capabilities.
- Fixed Advanced external work being assigned directly to a generic worker, bypassing planned delivery and independent testing.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/a7f173cb69b488b72448ef35e5a87745bc4f6503) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/0a6c203a320e411b16aac804db164498a9a56b97...a7f173cb69b488b72448ef35e5a87745bc4f6503).

## 0.0.49beta - 2026-08-19

### zh-CN

本版本把公开站与 README 的主张收敛到长程任务与自进化上，并汇总自 `0.0.48beta` 发布以来的用户可见改动。

#### 新增

- 落地页新增三段：**长程工作在哪里断**（跑不彻底、结果不能核对、工作流永远不会变好，各自对应真实机制）、
  **专家团组合起来**（以「从调研资料到一篇可投的论文」为案例，6 支专家团 / 33 个具名角色，另附三组已集成组合）、
  **会修订自己的专家团**（反馈修订与度量式活动两条路径，以及「没有你的确认就不安装」的边界）。
- 新增三篇双语文档：`concepts/long-horizon`、`concepts/squad-composition`、`expert-squads/evolution`。
- 双语 README 同步换主张，并新增同样的三节内容。
- 专家团组合的支数与角色数改为构建期从已发布目录解析（`squad-compositions.generated.ts`），
  文案里不再出现手抄的计数。

#### 调整

- 落地页与 README 的定位从「开箱即用的多 Agent Harness」改为「面向长程任务的 Harness」。
- 内置工具数量按注册表更正为 43（此前 README 多处写作 42）。

#### 修复

- 修复 Work Ledger 行内固定项没有带上所属 Project。
- 修复 Release 标签打在派发时的分支头部而不是实际构建出的那个提交上。
- 修复 Mission 收不到自己已完成子任务的消息：两处解码用的 schema 要求存储层放在 SQL 列里的字段，
  判定永远不可能成立。
- 修复子 Agent 在多个界面里各出现一次：同一个会话的多轮执行收敛为一条记录，查找也不再返回最旧的那次。
- 修复重试被租约拖住：记录「500 毫秒后重试」却仍持有两分钟租约时，实际要等两分钟；租约现在可以提前到期。
- 修复 macOS 红绿灯按钮与窗口顶栏没有对齐。
- `artifact_publish` 的 JSON 解析错误改为报出行号、列号与出错处的原文摘录，不再报字节偏移
  —— CJK 载荷下字节偏移与作者能数的位置相差三倍。

#### 移除

- 删除无人引用的落地页文案模块 `packages/web/src/content/landing.ts`。

#### 性能

- Overlay 不再在每一个流式片段到达时重新推导整段会话。
- Overlay 启动包从 2.89 MB 降到 1.70 MB：七个 artifact 渲染器与代码编辑器改为按需加载。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/0a6c203a320e411b16aac804db164498a9a56b97) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/ffa867ae02f9d0a1b9f6ab4cafd0432f0f2a4f5d...0a6c203a320e411b16aac804db164498a9a56b97)。

### en-US

This version focuses public-site/README claims on long-horizon work and evolution and combines user-visible changes since `0.0.48beta`.

#### Added

- Added three landing sections: **Where long-horizon work breaks** (unfinished work, unverifiable results and unchanging workflows, each tied to an actual mechanism); **Compose Expert Squads** (from research to a submission-ready paper, six squads/33 named roles and three integrated compositions); and **Squads that revise themselves** (feedback and measured-campaign paths, with installation requiring your confirmation).
- Added bilingual `concepts/long-horizon`, `concepts/squad-composition` and `expert-squads/evolution` docs.
- Bilingual READMEs adopt the same positioning and three sections.
- Squad/role counts are derived at build time from the published catalog in `squad-compositions.generated.ts` instead of copied counts in prose.

#### Changed

- Landing/README positioning changed from an out-of-the-box multi-agent Harness to a Harness for long-horizon work.
- Corrected built-in tool counts to the Registry's 43, previously shown as 42 in several README passages.

#### Fixed

- Fixed pinned Work Ledger rows losing their Project.
- Fixed release tags using the branch head at dispatch instead of the actual built commit.
- Fixed Missions missing completed-child messages because two decoding schemas required fields stored separately in SQL columns and could never match.
- Fixed repeated agent entries across interfaces: multiple executions of one Session become one record, and lookup returns the current rather than oldest execution.
- Fixed retries retaining two-minute leases after recording a 500-millisecond retry; leases can expire earlier.
- Fixed macOS window controls misaligned with the titlebar.
- `artifact_publish` JSON errors show line, column and a source excerpt instead of byte offsets, which differ by a factor of three for CJK text.

#### Removed

- Removed the unreferenced landing-copy module `packages/web/src/content/landing.ts`.

#### Performance

- Overlay no longer rederives the entire conversation for every streamed fragment.
- Startup bundle size fell from 2.89 MB to 1.70 MB by loading seven artifact renderers and the code editor on demand.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/0a6c203a320e411b16aac804db164498a9a56b97) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/ffa867ae02f9d0a1b9f6ab4cafd0432f0f2a4f5d...0a6c203a320e411b16aac804db164498a9a56b97).

## 0.0.48beta - 2026-08-19

### zh-CN

本版本汇总自 `0.0.46beta` 发布以来的全部用户可见改动。`0.0.47beta` 发布过二进制，但没有单列条目，其改动一并计入本节。

#### 新增

- 落地页 hero 之下改为播放一段真实运行录屏：滚入视口才开始下载和播放，滚出即暂停，`prefers-reduced-motion` 下不自动播放，读者按过播放器后由读者说了算。它取代了原先二十张交付物截图的轮播。
- 专家团详情页可直接唤起桌面端安装（`opencorvus://expert-squad/install`），ZIP 下载降为次选路径；客户端仍会重新校验重定向、字节长度与 SHA-256，并要求显式作用域。
- Overlay 侧边栏可一键下载并安装更新，且只在确有可用更新时出现。
- Overlay 输入区的专家团选择器接入专家团市场：输入两个字符即可搜索未安装的专家团，并就地装入当前 Project。
- 进化面板可回到目标持有过的任意修订，反馈可直接修订清单。
- 编排器名册展示每个投影 worker 实际可调用的 Tool 集合。
- 关于面板写明作者与联系方式；README 与落地页 FAQ 说明运行时与桌面端都出自本仓库，底层没有第三方 agent 引擎。

#### 调整

- 通用公开 `/session` 面收紧为：Mission Session 只能经 Mission 授权访问。
- 桌面更新清单改为描述本次实际构建出的平台，不再因为缺少某个平台而拒绝整个 Release。
- 进化实验室的候选作者提示词补上「一次修订如何改变行为」，此前每次修订只会在既有指令旁追加一句对冲表述，导致两个对照臂无法区分。

#### 修复

- 修复 VS Code Dark 等主题下 K 线图渲染为空白：主题把颜色写成 `color-mix()`，图表库只认旧式语法，颜色改在边界处解析回 `rgba()`。
- 修复浅色主题下终端选中色丢失强调色（同一根因，同一处解析器）。
- 修复图表导出菜单常驻展开，恢复为点击展开。
- 修复 Mission Board 侧边栏行的悬浮提示与其它导航行样式不一致。
- 修复 Overlay 只从协议信封取回 Session 身份、丢掉 Task 身份，导致 `review.stream.*` 找不到可投影的 Task。
- 修复公开站页脚的访问统计：改为按页面访问计数，删除按浏览器 opt-in 的令牌、Cookie 与同意标记，不再存任何与读者相关的东西。
- 修复手动触发的 Release 把紧凑版本号（`0.0.48beta`）原样传给打包任务，导致十个平台全部以 `Invalid OPENCORVUS_VERSION` 失败。
- 修复落地页 hero 的第二段录制永远不会播放。
- 修复更新安装失败后卡在 `DESKTOP_UPDATE_NOT_DOWNLOADED`：宿主在两条失败路径上都归还已准备好的安装包，客户端重试将重新下载。
- 修复单个构建机停滞就丢弃全部九个已完成平台、整个 Release 无从重跑的问题。
- 修复打包的 Work Artifact 验收先把助手消息置为完成再追加 Tool Part，导致 CLI 归档任务的生命周期检查失败。
- 修复仓库工具文件放在专家团授权根目录下会让生成流程抛错。
- 修复原生命令种类枚举存在手抄副本。
- 修复两个内置专家团在已发布版本号下更换了工具字节，导致站点注册表导入失败。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/ffa867ae02f9d0a1b9f6ab4cafd0432f0f2a4f5d) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/10b548e8c35e0858b58292c0fa871c7d4f32fb53...ffa867ae02f9d0a1b9f6ab4cafd0432f0f2a4f5d)。

### en-US

This entry combines all user-visible changes since `0.0.46beta`. Version `0.0.47beta` published binaries without a separate entry at the time; its changes are included here.

#### Added

- Replaced the twenty-artifact screenshot carousel below the hero with an actual runtime recording. It downloads/plays only in view, pauses out of view, respects reduced motion and retains viewer playback choices.
- Squad details open desktop installation directly through `opencorvus://expert-squad/install`, with ZIP downloads secondary. Clients still verify redirects, byte length and SHA-256 and require explicit scope.
- Sidebar update download/install appears only when an update is available.
- Composer squad selection searches uninstalled market squads after two characters and installs into the current Project.
- Evolution can return to any revision previously held by its target and revise manifests through feedback.
- Orchestrator rosters show tools actually callable by each projected worker.
- About shows author/contact information; README/landing FAQs explain that the runtime and desktop come from this repository without a third-party agent engine underneath.

#### Changed

- Mission Sessions on the public `/session` surface require Mission authorization.
- Desktop manifests describe platforms actually built instead of rejecting a whole Release for a missing platform.
- Evolution candidate-author prompts explain how a revision changes behavior, correcting revisions that merely added hedging beside existing instructions and left comparison arms indistinguishable.

#### Fixed

- Fixed blank candlestick charts in themes such as VS Code Dark by resolving `color-mix()` colors to `rgba()` at the chart boundary.
- Fixed terminal selections losing accent colors in light themes through the same color resolver.
- Chart export menus expand on click rather than remaining open.
- Aligned Mission Board sidebar tooltips with other navigation rows.
- Fixed Overlay losing Task identity from protocol envelopes and preventing `review.stream.*` Task projection.
- Website footer statistics count page visits, removing browser opt-in tokens, cookies and consent markers and retaining no reader-specific data.
- Fixed manual releases passing compact versions such as `0.0.48beta` unchanged into packaging and all ten platforms failing with `Invalid OPENCORVUS_VERSION`.
- Fixed the second hero recording never playing.
- Fixed failed update installation remaining at `DESKTOP_UPDATE_NOT_DOWNLOADED`. Hosts return prepared installers on both failure paths; retry downloads again.
- Fixed one stalled builder discarding nine completed platforms and making the Release impossible to resume.
- Fixed packaged Work Artifact acceptance completing assistant messages before adding Tool Parts, causing CLI archive lifecycle checks to fail.
- Fixed repository tool files under squad-authorized roots making generation throw.
- Removed hand-copied native-command kind enumerations.
- Fixed two built-in squads changing tool bytes under published versions and breaking website Registry import.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/ffa867ae02f9d0a1b9f6ab4cafd0432f0f2a4f5d) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/10b548e8c35e0858b58292c0fa871c7d4f32fb53...ffa867ae02f9d0a1b9f6ab4cafd0432f0f2a4f5d).

## 0.0.47beta - 2026-08-19

### zh-CN

#### 新增

- 从输入栏的专家团选择器进入市场；专家团演化可查看已有版本，并通过反馈修订清单。

#### 调整

- 编排器获得当前工作者真实可调用能力的投影，完善验收、产物和审查阶段的交接。
- 当时的发布流程保留成功平台的文件，并在说明中列出缺失平台；完整矩阵要求在后续发布流程中继续收敛。

#### 修复

- 修复 Mission 与其 Task 的公开会话通信、验收助手执行收敛及运行时恢复。
- 对 Linux 打包依赖安装设置有界等待和镜像重试，避免单一依赖下载无限阻塞发布。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/10b548e8c35e0858b58292c0fa871c7d4f32fb53) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/9d41a3f3c02782e668efa7792014e0589db24d07...10b548e8c35e0858b58292c0fa871c7d4f32fb53)。

### en-US

#### Added

- Composer squad selection opens the market; evolution shows existing versions and revises manifests from feedback.

#### Changed

- Orchestrators receive workers' actual callable-capability projections, improving acceptance, artifact and review handoffs.
- Publication retained successful-platform files and listed missing platforms; later processes continued work toward a complete matrix.

#### Fixed

- Fixed public Session communication between Missions and Tasks, acceptance-assistant settlement and runtime recovery.
- Linux packaging dependencies use bounded waits and mirror retries rather than indefinitely blocking releases on one download.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/10b548e8c35e0858b58292c0fa871c7d4f32fb53) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/9d41a3f3c02782e668efa7792014e0589db24d07...10b548e8c35e0858b58292c0fa871c7d4f32fb53).

## 0.0.46beta - 2026-08-18

### zh-CN

#### 调整

- 官网收敛为落地页与专家团市场，统一双主题、布局和设计组件，并将旧入口重定向到当前位置。
- 恢复桌面更新入口与侧栏操作，统一模型搜索和 Provider 选择。

#### 修复

- 改善 Task 恢复、运行时故障和专家团演化的责任边界；修复上下文压缩与产物因果关系、工作树会话归属和共享数据库启动。
- 修复重复项目删除、Mission 唤醒来源投影及破坏性操作的交互处理。
- 修复任务流切换、启动页任务布局、子 agent 停靠区实时跟随，以及稀疏 K 线首次插入不可见的问题。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/9d41a3f3c02782e668efa7792014e0589db24d07) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/df953b97cc96c43dcff96114fb826176ea9bf2cd...9d41a3f3c02782e668efa7792014e0589db24d07)。

### en-US

#### Changed

- Consolidated the public site into landing and squad-market surfaces, unifying dual themes, layouts and design components and redirecting old entries.
- Restored desktop updates and sidebar actions and unified model search/Provider selection.

#### Fixed

- Improved responsibility boundaries for Task recovery, runtime faults and squad evolution. Fixed compaction/artifact causality, worktree Session ownership and shared database startup.
- Fixed repeated Project deletion, Mission wake-source projection and destructive-action interactions.
- Fixed Task-stream switching, start-page Task layout, agent-dock live following and invisible first insertion of sparse candlesticks.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/9d41a3f3c02782e668efa7792014e0589db24d07) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/df953b97cc96c43dcff96114fb826176ea9bf2cd...9d41a3f3c02782e668efa7792014e0589db24d07).

## 0.0.45beta - 2026-08-15

### zh-CN

#### 调整

- 执行状态以不可变运行事实为依据，统一任务决策、接纳、取消和关闭的责任边界。

#### 修复

- 修复 Task 根执行的多步骤回复、决策修正、并行接纳、无动作暂停与信箱重放的收敛。
- 修复 Task 向 Mission 发布、项目删除与数据库约束、权限继续执行中的故障处理。
- 网站部署等待实际就绪后再结算，避免服务尚未可用便报告部署完成。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/df953b97cc96c43dcff96114fb826176ea9bf2cd) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/f2d4e0dc0a4808972641eb43c65f3d9c77a7130e...df953b97cc96c43dcff96114fb826176ea9bf2cd)。

### en-US

#### Changed

- Execution state uses immutable runtime facts with unified decision, admission, cancellation and shutdown ownership.

#### Fixed

- Fixed settlement for multistep root replies, decision correction, parallel admission, pauses without actions and mailbox replay.
- Fixed Task-to-Mission publication, Project deletion/database constraints and faults during permission continuation.
- Website deployment waits for actual readiness before reporting completion.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/df953b97cc96c43dcff96114fb826176ea9bf2cd) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/f2d4e0dc0a4808972641eb43c65f3d9c77a7130e...df953b97cc96c43dcff96114fb826176ea9bf2cd).

## 0.0.44beta.1 - 2026-08-15

### zh-CN

#### 修复

- 隔离 OfficeCLI 的打包启动检查，修复原生包验收受宿主办公工具环境干扰的问题；检查仍针对实际随包运行时。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/f2d4e0dc0a4808972641eb43c65f3d9c77a7130e) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/9392dee6db6d9721dcbc174f80c5bc385883bb84...f2d4e0dc0a4808972641eb43c65f3d9c77a7130e)。

### en-US

#### Fixed

- Isolated OfficeCLI packaged startup checks from host office-tool environments while still checking the actual bundled runtime.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/f2d4e0dc0a4808972641eb43c65f3d9c77a7130e) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/9392dee6db6d9721dcbc174f80c5bc385883bb84...f2d4e0dc0a4808972641eb43c65f3d9c77a7130e).

## 0.0.44beta - 2026-08-15

### zh-CN

#### 调整

- 默认启用浏览器和电脑操作能力，实际调用仍受角色授权与操作权限约束。
- 会话显示当前公开提示词消息，便于检查模型获得的真实上下文。

#### 修复

- 修复已提交请求决策、取消、项目删除、Mission 关闭和记忆订阅的归属与结算。
- 引用文件保留在右侧停靠区，修复被替代的 Mission 发送请求和命令截止时间原因的展示。
- 原生归档按精确源码/产物身份完成，打包与单元检查采用各自清晰的执行边界。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/9392dee6db6d9721dcbc174f80c5bc385883bb84) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/5a0f972b1dde004b64572c877caa2f973de82062...9392dee6db6d9721dcbc174f80c5bc385883bb84)。

### en-US

#### Changed

- Browser/computer capabilities are enabled by default; actual calls remain subject to role grants and operation permissions.
- Sessions show current public prompt messages so actual model context can be inspected.

#### Fixed

- Fixed ownership/settlement of accepted-request decisions, cancellation, Project deletion, Mission closure and memory subscriptions.
- Referenced files remain in the right dock; fixed superseded Mission send requests and command deadline reasons.
- Native archives bind exact source/artifact identities, with clear independent packaging and unit-check execution boundaries.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/9392dee6db6d9721dcbc174f80c5bc385883bb84) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/5a0f972b1dde004b64572c877caa2f973de82062...9392dee6db6d9721dcbc174f80c5bc385883bb84).

## 0.0.43beta - 2026-08-14

### zh-CN

#### 新增

- 引入统一产物 Harness，连接类型化内容、快照、工具来源与独立验收；完善任务与 Mission 的证据交接。

#### 调整

- 统一 Mission、Task、调度投递、权限和项目记忆的持久化身份，减少重复控制状态。

#### 修复

- 修复任务执行轮次、Mission 关闭/恢复唤醒、进程归属、并发数据库初始化和精确请求重试。
- Task 与 Work Ledger 终态时间按一致事实投影；缺失或无法取得的验收证据得到明确结算。
- 修复 Windows 原生工具依赖与跨平台打包的多个阻塞，保留真实失败诊断。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/5a0f972b1dde004b64572c877caa2f973de82062) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/640984800e06cb368ac562284638a5c0fe05635e...5a0f972b1dde004b64572c877caa2f973de82062)。

### en-US

#### Added

- Added a unified artifact Harness connecting typed content, snapshots, tool sources and independent acceptance, improving Task/Mission evidence handoffs.

#### Changed

- Unified persisted Mission, Task, dispatch delivery, permission and project-memory identities, reducing duplicate control state.

#### Fixed

- Fixed execution rounds, Mission closure/recovery wakes, process ownership, concurrent database initialization and exact request retries.
- Task/Work Ledger terminal times project consistent facts; missing or unavailable acceptance evidence settles explicitly.
- Fixed several Windows native-tool and cross-platform packaging blockers while retaining actual failure diagnostics.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/5a0f972b1dde004b64572c877caa2f973de82062) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/640984800e06cb368ac562284638a5c0fe05635e...5a0f972b1dde004b64572c877caa2f973de82062).

## 0.0.42beta - 2026-08-12

### zh-CN

#### 新增

- 提供项目记忆与权限模式的界面入口；新增 Provider 用量看板和模型服务计量信息。
- 官网专家团 Registry（注册表）使用数据库发布，生成内容、精确版本与签名资源按同一份事实提供。
- Mission 创建可获得市场专家团建议，Provider 凭据输入得到明确提示。

#### 修复

- 统一权限、项目与记忆的责任边界，修复无执行方唤醒、定时运行回复结算及持久化唤醒竞争。
- 修复运行时存活、交付汇总、网站精确标签源码和发布检查；改善公开导航、品牌图标与下载入口。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/640984800e06cb368ac562284638a5c0fe05635e) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/9652cff4da8e45e547b4a85a5e4c93570cf1a10e...640984800e06cb368ac562284638a5c0fe05635e)。

### en-US

#### Added

- Added Project memory and permission-mode interfaces, Provider usage dashboards and model-service metering.
- The website squad Registry publishes through a database, serving generated content, exact versions and signed resources from the same facts.
- Mission creation receives market-squad suggestions and explicit Provider-credential guidance.

#### Fixed

- Unified permission, Project and memory ownership, fixing wakes without executors, scheduled-reply settlement and durable wake races.
- Fixed runtime liveness, delivery aggregation, exact-tag website source and release checks; improved navigation, brand icons and downloads.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/640984800e06cb368ac562284638a5c0fe05635e) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/9652cff4da8e45e547b4a85a5e4c93570cf1a10e...640984800e06cb368ac562284638a5c0fe05635e).

## 0.0.40beta - 2026-08-11

### zh-CN

#### 新增

- 扩充多个专业领域的专家团，覆盖业务、研究、工程和行业分析；完善自包含团队的创作与质量契约。
- 官网提供同步版本的下载页、外部 Agent 宿主说明和可选播放的 Mission 概念演示。

#### 调整

- 精简公开产品路径，改进响应布局、字体和导航；桌面端可复制有来源依据的诊断信息。

#### 修复

- 修复调度执行归属、持久恢复、提示词清理与 Windows 输出中断后的 Mission 继续执行。
- 任务标识更紧凑，仍保留精确持久化身份与可追溯关系。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/9652cff4da8e45e547b4a85a5e4c93570cf1a10e) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/6f8e5be59af0724b361afe31a3965955985b9128...9652cff4da8e45e547b4a85a5e4c93570cf1a10e)。

### en-US

#### Added

- Expanded professional squads for business, research, engineering and industry analysis and strengthened self-contained squad authoring/quality contracts.
- Added synchronized-version downloads, external-agent-host guidance and an optional Mission concept demo.

#### Changed

- Simplified public product paths and improved responsive layout, typography and navigation. Desktop can copy diagnostics backed by sources.

#### Fixed

- Fixed dispatch ownership, durable recovery, prompt cleanup and Mission continuation after Windows output interruption.
- Task identifiers are more compact while retaining exact persisted identities and traceable relationships.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/9652cff4da8e45e547b4a85a5e4c93570cf1a10e) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/6f8e5be59af0724b361afe31a3965955985b9128...9652cff4da8e45e547b4a85a5e4c93570cf1a10e).

## 0.0.39beta - 2026-08-10

### zh-CN

#### 新增

- 新增托管专家团市场与统一来源，扩展研究、办公及业务团队；网站研究来源持久化供后续引用与核对。

#### 修复

- 修复任务取消、项目刷新后的能力检查、运行时状态隔离和本地恢复打包。
- 调整专家团产物与研究路径契约，控制目录检索的上下文范围并修复有顺序要求的交付发布。

#### 移除

- 关闭当时不再使用的 LSP（Language Server Protocol，语言服务器协议）运行路径。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/6f8e5be59af0724b361afe31a3965955985b9128) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/2c86f25c1264b99eea8b4890fca7c357b1d78e48...6f8e5be59af0724b361afe31a3965955985b9128)。

### en-US

#### Added

- Added a hosted squad market with unified sources and more research, office and business squads. Website research sources persist for later citation/review.

#### Fixed

- Fixed cancellation, capability checks after Project refresh, runtime state isolation and local recovery packaging.
- Improved squad-artifact/research-path contracts, bounded directory-search context and corrected ordered delivery publication.

#### Removed

- Disabled the then-unused Language Server Protocol (LSP) runtime path.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/6f8e5be59af0724b361afe31a3965955985b9128) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/2c86f25c1264b99eea8b4890fca7c357b1d78e48...6f8e5be59af0724b361afe31a3965955985b9128).

## 0.0.38beta - 2026-08-09

### zh-CN

#### 新增

- 增加 Provider 错误凭据脱敏契约，防止 API Key 和 Bearer Token 进入诊断消息与响应正文。

#### 调整

- 将 workspace 的 Bun 类型依赖和独立决策站点的包管理器规范统一到 Bun `1.3.14`，重新生成依赖锁定结果并移除旧 Bun 类型 package。
- 退役旧 benchmark 执行树及其专用测试与 CI job，把仍在使用的浏览器停滞检测迁移到当前脚本路径，并保留 Host MCP（Model Context Protocol，模型上下文协议）的真实连接统计契约。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/2c86f25c1264b99eea8b4890fca7c357b1d78e48) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/3522bc534c9762a462fb51daacef5b788a1219a9...2c86f25c1264b99eea8b4890fca7c357b1d78e48)。

### en-US

#### Added

- Added Provider-error credential redaction to keep API keys and Bearer tokens out of diagnostics and response bodies.

#### Changed

- Aligned workspace Bun types and the standalone decision site's package-manager declaration with Bun `1.3.14`, regenerated locks and removed the old Bun-types package.
- Retired the old benchmark execution tree, dedicated tests and CI job. Moved remaining browser-stall detection to current scripts while retaining Host MCP actual-connection statistics.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/2c86f25c1264b99eea8b4890fca7c357b1d78e48) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/3522bc534c9762a462fb51daacef5b788a1219a9...2c86f25c1264b99eea8b4890fca7c357b1d78e48).

## 0.0.37beta - 2026-08-09

### zh-CN

#### 新增

- 增加签名桌面热更新通道，并由发布矩阵统一生成和发布跨平台更新清单。
- 建立根更新日志，并在发布流程和中英文 README 中提供唯一入口。

#### 调整

- 在中英文 README 顶部加入下载入口，直接指向按平台选择桌面安装包和命令行运行时的说明。

#### 修复

- 在共享启动流程中显式初始化原生 Task 进程模式，保持命令行与桌面打包运行一致。
- 打开模型选择框时刷新模型，进入 Providers 时刷新 Provider；刷新失败写入应用日志并保留界面可用性。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/3522bc534c9762a462fb51daacef5b788a1219a9) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/565ef8d79b048e4b30c13b633f7fa76b0f51a4fd...3522bc534c9762a462fb51daacef5b788a1219a9)。

### en-US

#### Added

- Added signed desktop updates with cross-platform manifests generated/published by the release matrix.
- Established the root changelog as the single release-process and bilingual-README entry.

#### Changed

- Added download links atop both READMEs, pointing to platform-specific desktop-installer/CLI-runtime guidance.

#### Fixed

- Shared startup explicitly initializes native Task process mode for consistent CLI/desktop behavior.
- Opening model selection refreshes models; entering Providers refreshes Providers. Failures enter app logs without disabling the UI.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/3522bc534c9762a462fb51daacef5b788a1219a9) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/565ef8d79b048e4b30c13b633f7fa76b0f51a4fd...3522bc534c9762a462fb51daacef5b788a1219a9).

## 0.0.36beta - 2026-08-08

### zh-CN

#### 修复

- 在严格 CSP（Content Security Policy，内容安全策略）下正确渲染 Vega 交互图表。
- 修复干净构建环境的测试准备与发布触发条件，统一候选版本投影。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/565ef8d79b048e4b30c13b633f7fa76b0f51a4fd) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/08381d24b36f5c743d5eb71144fe56ea92513caa...565ef8d79b048e4b30c13b633f7fa76b0f51a4fd)。

### en-US

#### Fixed

- Vega interactive charts render correctly under strict Content Security Policy (CSP).
- Fixed clean-build test preparation and release triggers and unified candidate-version projections.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/565ef8d79b048e4b30c13b633f7fa76b0f51a4fd) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/08381d24b36f5c743d5eb71144fe56ea92513caa...565ef8d79b048e4b30c13b633f7fa76b0f51a4fd).

## 0.0.35beta.4 - 2026-08-08

### zh-CN

#### 修复

- 按 SemVer（Semantic Versioning，语义化版本）正确标记 beta 预发布，避免候选版本被当成正式版本。
- 桌面、命令行与原生元数据统一使用本次编号候选。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/08381d24b36f5c743d5eb71144fe56ea92513caa) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/2d3ec81e426d5e40419cfe88fe6394a7410f7501...08381d24b36f5c743d5eb71144fe56ea92513caa)。

### en-US

#### Fixed

- Correctly marks beta prereleases under Semantic Versioning (SemVer) so candidates are not treated as stable releases.
- Desktop, CLI and native metadata use this same numbered candidate.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/08381d24b36f5c743d5eb71144fe56ea92513caa) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/2d3ec81e426d5e40419cfe88fe6394a7410f7501...08381d24b36f5c743d5eb71144fe56ea92513caa).

## 0.0.35beta.3 - 2026-08-08

### zh-CN

#### 修复

- Windows 归档验收从实际本地打包目录读取文件，修复校验时路径与目录归属不一致的问题。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/2d3ec81e426d5e40419cfe88fe6394a7410f7501) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/b1cedfa539eb5533c98acf2e3d51479173bb6060...2d3ec81e426d5e40419cfe88fe6394a7410f7501)。

### en-US

#### Fixed

- Windows archive acceptance reads actual local packaged files, fixing mismatched paths and directory ownership during validation.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/2d3ec81e426d5e40419cfe88fe6394a7410f7501) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/b1cedfa539eb5533c98acf2e3d51479173bb6060...2d3ec81e426d5e40419cfe88fe6394a7410f7501).

## 0.0.35beta.2 - 2026-08-08

### zh-CN

#### 修复

- Windows 原生包携带真实的 ripgrep 可执行文件，修复把错误内容当成搜索运行时打包的问题。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/b1cedfa539eb5533c98acf2e3d51479173bb6060) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/81fb867782966a14f2a5b9b94cd3007c2ff63c62...b1cedfa539eb5533c98acf2e3d51479173bb6060)。

### en-US

#### Fixed

- Windows native packages include the actual ripgrep executable rather than packaging incorrect content as the search runtime.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/b1cedfa539eb5533c98acf2e3d51479173bb6060) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/81fb867782966a14f2a5b9b94cd3007c2ff63c62...b1cedfa539eb5533c98acf2e3d51479173bb6060).

## 0.0.35beta.1 - 2026-08-08

### zh-CN

#### 修复

- 恢复桌面停止控制和排队活动展示，明确对话工具的执行授权，改善 Provider 取消后的运行结算。
- 原生消费者构建前先生成 SDK（Software Development Kit，软件开发工具包）；桌面与命令行平台矩阵携带已验证的 Bun 编译运行时。
- 修复 GitHub Actions 工作流与独立安装包分发，补齐 Hermes 和 OpenClaw 的 Skill 控制说明。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/81fb867782966a14f2a5b9b94cd3007c2ff63c62) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/65d0bfc983ca7ed301a83354f27e5cf5f1b19a19...81fb867782966a14f2a5b9b94cd3007c2ff63c62)。

### en-US

#### Fixed

- Restored desktop stopping/queued activity, clarified conversation-tool authorization and improved runtime settlement after Provider cancellation.
- Generates the SDK before native consumers build. Desktop/CLI matrices include the verified compiled Bun runtime.
- Fixed GitHub Actions workflows and standalone-installer distribution, and completed Hermes/OpenClaw Skill controls.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/81fb867782966a14f2a5b9b94cd3007c2ff63c62) · [Commits in this version](https://github.com/yangheng95/opencorvus/compare/65d0bfc983ca7ed301a83354f27e5cf5f1b19a19...81fb867782966a14f2a5b9b94cd3007c2ff63c62).

## 0.0.35beta - 2026-08-07

### zh-CN

本版本是历史记录的完整功能基线。以下集中说明当时仓库已有的产品能力；后续版本再逐项记录变化。实际运行取决于配置的模型、已安装工具、权限和持续在线的运行时。

#### 对话、长程任务与组织协作

- 提供桌面工作台、项目内对话与流式模型交互，可查看用户消息、agent 回复、工具调用和结果。
- Mission 把较大目标拆为责任明确的 Task，保留需求、决策、交互、上下文、依赖与交付记录；每个 Task 使用固定专家团和声明工作流。
- 独立工作可并行推进，依赖工作通过已验收的类型化产物交接；规划、实现、研究、测试与审阅可以组成同一交付链。
- Task 支持消息跟进、取消、重试、重新规划与恢复；周期性任务保留运行历史，后台运行依赖本地或托管服务持续在线。

#### 专家团、工作方法与演化

- 专家团把专业角色、指令、Skill、工具、MCP（Model Context Protocol，模型上下文协议）服务器与工作流封装为自包含能力包，可为项目选择、配置与安装。
- 已有编码、前端复刻/创新、审查调试、深度研究、股票研究、专家团创作与 Evolution Lab 等团队及相应方法；研究团队覆盖规划、来源、写作、知识整理与引文审阅，股票团队覆盖事实、基本面、估值、论点和报告。
- Squad SDK（Software Development Kit，软件开发工具包）支持创建、校验、版本化和安装自定义团队；算法及外部 agent 通过明确适配器、契约、证据和产物参与协作。
- Evolution Lab 提供候选团队修订、试验、观察、评价与反馈的工作方式；用户可审阅变更，试验结果和来源保留用于比较。
- Skill 可按角色与任务使用；支持与外部宿主、Hermes、OpenClaw 的既有 Skill 入口协作。

#### 模型、工具与实际执行

- 可连接多种 Provider（模型服务商）和模型，管理模型选择、服务配置与认证；兼容的 Provider 插件参与流式工具调用。
- 提供文件读取/写入/编辑、补丁、目录与代码搜索、命令执行、规划、待办、提问、等待和记忆等基础能力，工具执行受实际角色授权与权限约束。
- 实验性 LSP（Language Server Protocol，语言服务器协议）工具提供定义、引用、符号和调用层次查询；需要启用当时的实验开关、获得工具授权，并具备对应语言服务器。后续版本将这一路径退役。
- 浏览器能力覆盖页面操作、网页搜索/获取、截图与可观察的浏览器证据；Computer Use（电脑操作）连接宿主应用，供已授权角色执行桌面操作。
- 可执行本地代码和仓库工作，管理项目目录、Git 与隔离工作树；外部编码执行器可接入 Codex 和 Claude Code 等受支持工具。
- MCP 支持外部工具与交互应用，Agent Client Protocol（智能体客户端协议）和插件入口连接其他 agent 能力；未配置的执行器或集成须先满足实际环境条件。

#### 产物、编辑与可审阅交付

- 保存类型化、内容寻址产物及精确谱系、来源和验收证据；研究、规划、开发与独立审阅可以引用同一份可核对交付。
- 文件与目录可作为请求附件和产物引用；对话、Mission、Task 与右侧面板呈现相应上下文和交付内容。
- 工作台具备源文件编辑器与终端，以及 Markdown、HTML、PDF（Portable Document Format，便携式文档格式）、代码、图表、地图、关系图和交互应用等阅读表面。
- 提供 OfficeCLI 办公能力以及可编辑文档、表格、演示文稿的产物处理；表格、幻灯片、图表与图形可在相应交互组件中查看和操作。
- 独立验收可检查实现、运行时、视觉、来源与产物；缺少证据、需要权限或遇到真实阻塞时保留明确状态，交付记录可追溯各阶段贡献。

#### 持久化、记忆、权限与观察

- Task、需求、调度谱系、交互、产物、验收证据、Session 状态和项目知识持久化到本地 SQLite，支持重启后的运行读取与恢复。
- 项目/会话范围与全局记忆、偏好用于后续工作；上下文压缩和会话记录帮助长程任务保留必要信息。
- Question（问题）和 Permission（权限）支持人工回应，工具与外部操作按批准范围执行；操作者反馈可进入后续 Task 工作。
- 记录模型调用、工具活动、token（令牌）与费用统计，并提供日志、诊断、模型与 MCP 状态检查；这些观察用于追查实际执行。

#### 桌面、服务、频道与开发接入

- 提供 Tauri 原生桌面壳和本地网页工作台；仓库具备 Windows x64、macOS x64/ARM64、Linux x64/ARM64 的桌面与命令行打包入口，以及各平台安装格式说明。
- 无头 HTTP（Hypertext Transfer Protocol，超文本传输协议）API（Application Programming Interface，应用程序编程接口）管理 Task 生命周期，并通过 SSE（Server-Sent Events，服务器发送事件）提供进度流。
- 命令行提供服务启动、模型/认证、MCP、会话导入导出、统计、配置检查和 doctor 诊断；JavaScript SDK 与 GitHub Action 为开发及仓库自动化提供入口。
- Slack 网关可从话题串启动工作、同步进展、处理 allow/always/reject 权限回应并传递跟进消息；仓库还有 Telegram、Discord、飞书、WhatsApp、Google Chat、Microsoft Teams、Line、Matrix、Mattermost、Signal、企业微信和钉钉适配器，使用前需配置相应服务。
- 提供中英文说明、开发/构建/打包指引、配置与集成文档；项目以 MIT 许可证开放源码。

#### 版本边界

- 本记录描述 0.0.35beta 的源码能力基线，历史安装文件是否仍可下载以对应发布页面为准。后续新增的签名桌面更新、托管市场、全局 Chat、侧边对话和引用功能分别记录在其实际版本中。

#### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/65d0bfc983ca7ed301a83354f27e5cf5f1b19a19) · [初始中英文说明](https://github.com/yangheng95/opencorvus/blob/65d0bfc983ca7ed301a83354f27e5cf5f1b19a19/README.zh-CN.md)。

### en-US

This is the complete historical feature baseline. The following describes capabilities already present in this version; later entries record subsequent changes. Actual execution depends on configured models, installed tools, permissions and an online runtime.

#### Conversations, long-horizon work and collaboration

- Desktop workspace, project conversations and streamed model interactions display user messages, agent replies, tool calls and results.
- Missions divide larger goals into Tasks with explicit responsibility, retaining requirements, decisions, interactions, context, dependencies and delivery records. Each Task uses a fixed squad and declared workflow.
- Independent work proceeds in parallel; dependent work exchanges accepted typed artifacts. Planning, implementation, research, testing and review can form one delivery chain.
- Tasks support follow-ups, cancellation, retries, replanning and recovery. Recurring work retains history; background execution requires an online local or managed service.

#### Expert Squads, methods and evolution

- Squads package professional roles, instructions, Skills, tools, MCP servers and workflows as self-contained capabilities selected/configured/installed for projects.
- Existing squads cover coding, frontend replication/innovation, review/debugging, deep research, stock research, squad authoring and Evolution Lab. Research roles cover planning, sources, writing, knowledge organization and citation review; stock roles cover facts, fundamentals, valuation, theses and reports.
- Squad SDK supports creating, validating, versioning and installing custom squads. Algorithms/external agents participate through explicit adapters, contracts, evidence and artifacts.
- Evolution Lab provides candidate revisions, trials, observation, evaluation and feedback. Users review changes, and experiment results/sources remain for comparison.
- Skills are used by role/Task and integrate with existing external-host, Hermes and OpenClaw Skill entries.

#### Models, tools and execution

- Multiple Providers/models, model selection, service settings and authentication are supported. Compatible Provider plugins participate in streamed tool calls.
- File read/write/edit, patches, directory/code search, commands, planning, todos, questions, waiting and memory are subject to actual role grants and permission boundaries.
- Experimental LSP tools query definitions, references, symbols and call hierarchies, requiring the then-current experiment flag, grants and language servers. Later releases retired this path.
- Browser capabilities cover page actions, web search/fetching, screenshots and observable browser evidence. Computer Use connects host applications for authorized desktop actions.
- Local code/repository work manages directories, Git and isolated worktrees. External coding executors integrate supported tools such as Codex and Claude Code.
- MCP supports external tools/interactive apps, and Agent Client Protocol/plugin entries connect other agent capabilities. Unconfigured executors/integrations require their actual environment prerequisites.

#### Artifacts, editing and reviewable delivery

- Typed, content-addressed artifacts retain exact lineage, sources and acceptance evidence. Research, planning, development and independent review can cite the same verifiable delivery.
- Files/directories serve as request attachments and artifact references; conversations, Missions, Tasks and right panels show the corresponding context and outputs.
- The workspace includes a source editor and terminal, with Markdown, HTML, Portable Document Format (PDF), code, charts, maps, relationship graphs and interactive-app readers.
- OfficeCLI and editable document/spreadsheet/presentation artifact processing are available. Sheets, slides, charts and graphics can be viewed/operated in their components.
- Independent acceptance checks implementation, runtime, visuals, sources and artifacts. Missing evidence, required permissions and actual blockers retain explicit states; delivery records trace stage contributions.

#### Persistence, memory, permissions and observation

- Tasks, requirements, dispatch lineage, interactions, artifacts, acceptance evidence, Session state and project knowledge persist in local SQLite for reading/recovery after restart.
- Project/Session and global memory/preferences inform later work. Compaction and Session records retain information required for long-horizon work.
- Questions and Permissions support human responses; tools/external operations follow approved scope. Operator feedback can enter subsequent Task work.
- Model calls, tool activity, tokens and cost are recorded alongside logs, diagnostics and model/MCP checks to investigate actual execution.

#### Desktop, services, channels and developer integration

- Tauri desktop shell and local web workspace are available. The repository provides desktop/CLI packaging for Windows x64, macOS x64/ARM64 and Linux x64/ARM64, with platform-format guidance.
- Headless HTTP APIs manage Task lifecycle and provide progress through Server-Sent Events (SSE).
- CLI supports services, models/authentication, MCP, Session import/export, statistics, configuration checks and doctor diagnostics. JavaScript SDK and GitHub Actions support development/repository automation.
- Slack gateways start work from threads, synchronize progress, process allow/always/reject permission responses and send follow-ups. Adapters for Telegram, Discord, Feishu, WhatsApp, Google Chat, Microsoft Teams, Line, Matrix, Mattermost, Signal, WeCom and DingTalk require service configuration before use.
- English/Chinese guides cover development, builds, packaging, configuration and integrations. The project is open source under the MIT license.

#### Version boundary

- These notes describe the 0.0.35beta source capability baseline. Historical installer availability follows its release page. Signed desktop updates, hosted markets, global Chat, side conversations and references are recorded in the later versions that actually introduced them.
#### Record sources

- [Version source](https://github.com/yangheng95/opencorvus/tree/65d0bfc983ca7ed301a83354f27e5cf5f1b19a19) · [Original bilingual guide](https://github.com/yangheng95/opencorvus/blob/65d0bfc983ca7ed301a83354f27e5cf5f1b19a19/README.zh-CN.md).
