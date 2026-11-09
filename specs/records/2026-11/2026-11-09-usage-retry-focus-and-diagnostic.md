# 用量读取失败诊断与重试焦点

## Recall

用户要求持续按批迭代至明确停止；最新要求本人独立，无子agent。先分析落盘，实施后真实桌面交互和人工截图、聚焦正向检查、范围提交和正常推送。前批 `5023789fc` 正常推送，HEAD/上游 0/0，原177条状态精确保留。GPT-6.1 Sol授权仍无新答复，本批不加载凭据、模型目录或发送模型请求。

已读 UsagePanel 的周期、刷新、请求清除、反馈、热力图及键盘控制；services/usage、apiJson 当前 authority（连接归属）、UsageStats 查询/返回、OfficialUsage 当前三种环境凭据入口、Feedback/Disclosure 现诊断、两语言用量键、07-panel 用量和 2026-11-05 数字记录。全仓搜索 `loadUsageStatistics` / `UsageServerVersionError` 仅一个 UI 消费者，`global.usage` 已有生产聚合及专门正向测试。本批只触及显示，保留现 SDK、测试和接口，不新增或运行 UI 自动化。UTC（协调世界时）和实页地区时间各按后端自然周期核对。

## 根因与影响分析（实施前）

待实证：已加载真实用量后点刷新或切周期，读取失败把原 reason 压成字符串；现 Feedback 用本地化标题但通用错误正文直接出现英文原始错误、没有可展开的堆栈或原诊断。特殊 UsageServerVersionError 的帮助当前在 catch 时翻译成字符串，语言改变可能保留旧语言；目前不伪造旧服务复现。Retry 位于仅在 error 存在时渲染的卡片；点击把 revision 加一，effect 即同步清除错误并卸载当前 Retry，焦点可能退回页面。既有刷新按钮在活动区域常驻、aria-disabled 保持忙碌焦点，但重试没有接入该已有控件。要验证实际断网、用户同页重试成功及焦点；如果前态行为已有正确保留则撤回对应改动。

若证实，用单一 cause 保留现实际失败；Feedback 以当前语言呈现摘要、按原 typed version error 显示现专用帮助，通过现 formatErrorDetails 展开原诊断。保留现版本分类路径和原后台异常，不构造 HTTP 状态。让焦点原在 Retry 的用户在触发现同一 revision 刷新前转移到常驻 Refresh，忙碌期间原 guard 保护；不新增 reload/后备缓存或异步 focus owner。当前周期、成功数据清除、热力图和取消/归属由原路径负责。非焦点触发不抢焦点。

影响仅用量设置读取错误呈现与重试焦点、当前语言及原诊断。公开 API（Application Programming Interface，应用接口）、模型用量计算、价格/官方对账、请求传输、数据库和持久格式、任务执行均不改。局部隔离服务器停止是受控验收，不是 Task/Mission/Session occurrence 调度或终态问题。风险是重新出现 raw 错误、丢失合法版本帮助、重复重试、错误类型错误或作用域/键盘焦点被接管。现 UsagePanel 初读在同步调用 apiJson 时跟踪 authority，原控制流保留；不声称完整迟到竞态或第三方服务覆盖。

## 验收

Temp b50 两独立 Git 项目、空使用记录和私有 profile。已识别官方读取仅在三个独立后台环境键存在时请求，启动自己的进程时移除这些键并禁 Bun 自动 .env，不读取值；实际聚合响应复核官方来源状态。无复制认证或模型目录、无真实官方请求或模型。旧版/修复后分别在真实开发 `/ui` 键盘打开 Usage，选择实际 Today；正常关闭自有后台后从原刷新触发真错误，复核摘要/Details 和切换语言。用同一端口/profile 正常重启自己的服务、不刷新页面；使用原 Retry 确认当前周期真实零值、实际焦点位置，并通过下一按键验证可操作。原零值热力图的具体日期/时区和详情保持。真实 `/doc` 核验自然周期返回、实际 200、真实零值和独立官方状态，截图本人查看。类型、双语、正常构建和 docs/架构为辅助；关停自有进程并消费退出，核对 Git 原文件、数据库计数。未涉及 UI 自动化、产品发布或用户应用操作。

## 真实前态与实施定稿

39021/IAB112 在 Asia/Shanghai 的真实 Today 显示 24 个零值小时段（01）。正常关闭该服务，同页按 Refresh：原行内标题英文，正文只有 `Failed to fetch`，无展开诊断（02）；切换中文，摘要与重试更新但正文仍为英文（03）。正常重启同一服务地址和 profile、页面不刷新，实际离线全局提示退去，原错误/今天仍在。按真实「重试」后今日数据恢复，实际焦点 BODY/网页，截图04无刷新或表格焦点。两个阶段各三项 HTTP 200/current schema，年365、日24、周7，三条凭据驱动来源均 `unconfigured`；各自进程退出0、页关闭。

按方案将显示状态改为一个带真实 cause 的 failure，当前语言摘要放在同一 Feedback，现 version-only 指引在渲染时本地化，原 cause 由现 formatter 展开。版本错误原服务包装不变，不声称带来该版本错误的 HTTP 响应恢复。重试和原刷新共用同一个 load revision 与 busy 判断；仅 Retry 真持焦点时在卸载前聚焦常驻 Refresh，现周期、清除、解析、authority 和数据流保持。

## 验收结果

39022/IAB113 最终 `main-MDtrSJdd.js` / `UsagePanel-Cb3B6lVU.js`。05 英文 Today 实际零值和活动图。正常关闭同一隔离进程，在原页按 Refresh 得到 06 本地化摘要和 Details。07 展开保留真实 `TypeError: Failed to fetch` 与堆栈；08 切换中文时摘要和 Details 跟随界面，原诊断和「今天」仍在。网络断开没有 HTTP 响应，未附会状态码或响应正文。

正常重启同端口/profile、未刷新页面；页面连接恢复后原失败保留到手动重试。按中文「重试」后的真实日汇总和24个零值小时段恢复，选中「今天」、焦点为 `BUTTON / 刷新用量`，09 可见原按钮焦点。Tab 进入 00:00–01:00，右箭头切换 01:00–02:00，10 复核真正的 GMT+8 时段、0 令牌和可见焦点，未操作用户页面。

旧/新版的初态与恢复态共 12 项 HTTP 200/current schema，年365、日24、周7，首末时间窗口和零值汇总一致；三个凭据驱动的官方来源全程 `unconfigured`，无远端官方查询。两个隔离 Git 文件/HEAD 原字节核对，两个库均 Project 1，Session、Message、engine_task、provider_usage_event 和 provider_activity_request 均0；config 文件清单空。两个自有页、四个隔离服务均正常退休，原进程退出0，待结算 Prompt 0。

[10 张桌面图与实际数据记录](../../artifacts/2026-11-09-usage-retry-focus-and-diagnostic/README.md)本人复核。类型、双语2932键、构建53.37秒、渲染器公共面和文档/架构索引通过。未验证旧版后台404、已配置的官方服务、任务执行或模型；保留其原后端合同。
