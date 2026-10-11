# 303 返回正文输入链取证

## Recall

最新人工约束为仅单 agent，root 独立工作。起始 a4760e7aa 已推送且工作区干净；302 是实际进展：两次真实任务各 12 次流式请求，补齐正文生成中的返回，并保存第二轮 14:05:28.774Z 第二节文字读回异常。实际读回出现 `**文档事实22/Understanding/focus-order.html)`，同次稍后截图正常，尚不能排除 DOM 快照跨更新。302 的两个服务和页面已完整关闭、原 exec 已 join，不重启它们。持续目标仍包括 Sources 外观与原 Rendering 闪烁，不把单一场景通过当成全面完成。

## 观察、触发与根因候选

明确触发为离开正在输出正文的 Task，在当前全局流重新接入后再次打开子侧栏。SubagentConversationPanel 的 requestKey 切换会重置 liveProjection；resource 的旧 conversation 可能仍可读。observeSubagentConversationLiveEvent 在第一条 delta 上从该 base 取 anchor，projectLivePartField 在当前 persisted 与 delta 无法按前缀吸收时可返回 anchor+delta。因此可能把旧 HTTP 前缀与返回后较晚增量拼接，中间缺口直到下一完整 Part 才修复。此为代码支持的假设，302 未记录同时原始输入，不能直接改实现。

另两个候选为 TextPart/Markdown worker 的中途排版以及 DOM 快照跨越更新。已读当前事件路由、SubagentConversationPanel、subagent-conversation、Side Chat、TextPart、text-part-model、markdown-render 与 AppLog。当前 renderer 以 owner/revision 过滤结果，接受仍为当前文本前缀的旧结果；AppLog 通过现有批量上传写入同一服务日志，能够保留完整原始输入及时间。正常 Sources/正文展示不依赖诊断。

## 影响面与共享审计

共享 projection 的生产调用者是 Task 子侧栏和 Side Chat；后者在有序 session.connected 后重置 base/live，子侧栏则独立 HTTP 刷新。Task 主会话 tree-writer 已由 301 的缓存完整快照修复覆盖，但仍须用真实事件对照排除新倒退。Standalone/Mission 的 Session cutover、Task 初载/返回/断线恢复、终态退休/重启 epoch、多项目隔离、顺序和并行输入属于复核边界。当前没有新的执行调度故障证据；若出现，立即按共享机制审计，不能归咎模型。

本轮先只在三个现有输入接点加临时只读诊断：子侧栏订阅事件及目标重置、HTTP/base/live/投影值、Markdown render 请求及接受的回复。记录 Message/Part/Session、真实游标、完整正文、anchor/delta 和 revision；使用 untrack 避免日志订阅改变产品依赖。各诊断组设明确计数上限并记录触顶，触顶范围不得宣称完整采样。诊断不改变合并、消息、流式、请求路由或组件身份，不增加 UI 自动化测试，不经浏览器注入脚本。

## 执行与验收

备份精确当前文件及差异，正常构建后才启动全新独立开发服务 /ui；页面资源冻结后不在原服务上重建。使用已授权 OpenAI 凭据与完整模型目录成对复制，独立预检确认真实 gpt-6.1-sol 流式请求，再执行与 302 同类单研究员长正文任务。所有开发工作仍由 root 单独完成。人工在早期正文阶段离开/返回项目并重开子侧栏，截图、原始输入日志及持久化正文联合判读。

真实根因确定后先补充具体契约与修复方案，再实施。若诊断只能排除某候选，明确保留剩余边界，不做猜测性补丁。临时诊断必须移除，正常重新构建；UI 改动必须重新启动正常页面、截图人工复核。非 UI 生产改动需聚焦正向后端测试。所有自有页面、原生进程和启动 exec 实际闭合，授权副本成对清理；完成文档索引/检查、范围提交、fetch/merge、完整待推送审阅和正常 push。持续 goal 不标完成。

## live-01 诊断完整性问题

类型检查与 49.05 秒构建成功后启动真实 Task tsk_g00VXkce2F00ZxF0f1vz，13 次实际流式请求、epoch 1 完成。早期跨项目返回的已保留输入没有投影缺口，但诊断序列 1290 后直接到 4795；浏览器自己的日志复制仍保留 2943 起的记录。AppLog 每个 token 追加响应式 2000 项数组，且在连接状态非 online 时 persist/flush 会丢弃记录。当前事实确认上传缺口，负载与连接状态的具体因果尚未证明，不能宣称完整观测。一次侧栏点击 CDP 超时、随后截图调用超时重置了 CUA 控制会话；绑定原 tab 61 后恢复，没有刷新或重启页面。侧栏关闭未获确认，不能当作已执行。

原 exec 93996 实际 join exit 0，Native 65936 / Host 71876 已关闭，自己的 tab 61 已关闭，授权副本成对清理。原始诊断源码保存在 diagnostic-v1，运行证据及客户端复制原件保留。不能以此工具链缺口结束原验收。

下一轮诊断减少负载并保留每个原始编号：输入记录先进入有界批量，在现有 POST /log 接口确认写入后释放；临时诊断直接复用该真实接口，避免逐 token 再更新日志查看器的响应式数组。记录错误次数与原始序列，失败批次保留重试，重复序列仅在原始内容一致时解释为重复投递。只捕捉文本事件及消息 metadata，原工具内容仍由正常产品完整展示。该诊断上传代码在交付前全部删除，不形成新的生产日志实现。新独立 live-02 重做早期返回，以完整计数、原始输入及真实页面判读。

## live-02 确认的数据缺口

第二轮完整保留 9714 条原始序列，1 至 9714 连续，上传失败为 0、队列为 0、没有触及上限；307 控制、3072 事件、1583 投影、4752 渲染记录。仅以 base 是否为 projected 的前缀检查会漏掉“旧 base 之后接错增量”，必须与相同 Part 的最终持久化正文核对。7914 次 Part 对照中有一次真实不一致；1041 次目标正文 renderer 输入中也有同一错误值，证明不是 DOM 读回工具单独造成。

14:42:38.194Z，HTTP 返回 Part prt_g0VXkh62j00r3fBPd4Ox 的 4675 字符正文，lastLiveSequence=3363。其末尾为“尤其不能只给模态背景设置 `”。随后 live 3364/3365/3366 为“宣”“称”“背景”；投影 trace 4248 与 renderer 输入 4249 合成 4679 字符“设置 `宣称背景”，缺少真实的 `none` 就（7 字符）。live 3367 的完整 4686 字符快照才补齐。错误正文进入 owner 15 revision 3，不能用后续完整画面或一次最终通过掩盖。

已对应到 processor 的 currentText 内存累加、200ms 完整 Part checkpoint、Session.updatePartDeltaImpl 的纯 ephemeral 发布，以及 Task Session conversation 路由在读取持久化正文之前采集 currentTaskLiveSequence 的路径：游标覆盖了尚未落盘的 delta，而返回正文只覆盖较早持久化前缀。现有字符串吸收逻辑无法补出从未收到的片段，301 的旧完整快照归并也不解决此种未落盘缺口。

进一步核对 renderer：revision 3 的错误输入已进入 render 调用，但本次应用到 DOM 的帧仍是 revision 2 的正确旧前缀，随后接受 revision 4 的完整补齐结果；不能宣称本次实际绘制过错误尾部。已经确认的是公共快照/游标缺口及错误渲染输入，原截图所有可见闪烁的充分归因仍未完成。

影响面必须继续覆盖 Task 子侧栏初载/重开/过期恢复、Inspector 的同一 HTTP 契约、Standalone/Mission/Side Chat 的订阅前未落盘 delta、reasoning 的自然结束 checkpoint、多项目与终态/重启。正在比较可复用的权威流式累加器读取、完整快照与真实游标的原子边界、现有 live replay 和统一 writer；尚未完成共享修复方案，禁止先补最长文本、延迟显示或仅跳过 delta。正确实现前先将上述公共契约与调用点分析补全。

两次原 exec 93996/42359 已实际 join exit 0，分别 13/14 次真实 gpt-6.1-sol 流式请求；所有自有页面和进程关闭，副本成对清理。第二轮 W3C 首次 webfetch 连接关闭，模型在相同 URL 成功重试，失败与来源均真实可见。临时诊断仍待移除，正常构建/页面复核与提交推送尚未完成。

## 正常产物恢复

临时诊断现已全部通过精确 patch 移除，三个生产文件与起始源码一致；诊断副本只留作审计。正常 typecheck 和 50.88 秒构建实际成功（原 exec 5906/66533 已 join）。新 live-03 用正常资源 main-Ck1XRYJ6.js 复核三条来源及正文，13 次实际模型流式请求、Task epoch 1 完成；原 exec 32835 join exit 0，自己的 Native 64252 / Host 36200、tab 63 与复制凭据目录均已闭合。该次仅证明诊断撤除后的正常产物恢复，不证明待实施的缺字修复。

大型原始日志已先扫描凭据、再无损压缩，逐文件比较展开实际字节并记录，私有原件保留。根因与完整样本将先收敛提交，后续直接从确切 HTTP/live 缺口和公共契约继续共享修复；生产问题仍未解决，持续 goal 保持 active。
