# 权限配置未加载时的真实呈现

## Recall

用户要求持续单 agent 自主体验、修复、验证和推送；最新反馈是 Goal 用法不可发现、默认页布局奇怪。ca3293af9 已将同一 Goal 控件整合到首页输入下方，明确三步用法、帮助与真实会话创建入口；c724299ed 修复后续发现的全局配置读取归属、鼠标开关和写入回执。本轮从这两次交付继续，当前 main 与 upstream 为 c724299ed。仅一个 agent，不操作用户 18571 页面或进程；保留原 .bun/ 和 packages/opencorvus/bun/，不清库、不改 schema、不发布版本、不增加 branch/worktree。

## 修改前分析

已重读两份前序 Recall、AGENTS、05-config 与 07-panel 相关合同；全仓搜索 currentPermissionMode（两个生产消费者）、setPermissionMode、configLoadIssues、loadConfigInfo、reloadProjectScope、apiJsonWithTimeout、transportRequestSignal，阅读共享服务、两处权限 UI、SegmentedControl、Feedback、GeneralPanel、app store 和后端 Config.Info/getGlobal。

真实证据：434 的 22-final-navigation-during-write.jpg 在全局配置仍为 Ask、原写尚未完成时，新首页工具栏显示 Full access；433 首页截图亦有同样初始值。本轮已人工查看原图。直接触发是 config 尚为 null；根因是 currentPermissionMode 将所有非 ask 值映射为 full_access，Composer 又用同样标签作默认值，Settings 则始终选择一种模式。旧修复补齐读请求及归属，未修复尚无已确认快照时的呈现语义。服务仍在实际执行 Ask；本问题不能据此推断服务器权限扩大。

影响面：Composer/General 的启动、切换项目、无目录新对话及读取失败状态。现有 store 的 config 是唯一事实源，配置 reader 已有原始错误和 epoch/authority 归属，重试应复用它。真实快照中的 ask/full_access 逐值投影；空值或无有效字段返回未加载状态，禁止再猜默认模式。未知时 UI 允许进入设置并重读，模式选项必须等实际配置到达。串行保存路径、安全策略、协议、数据库、Task/Mission/Session 调度均不改；没有新的调度或终态异常证据。非 UI 更改只涉及纯模式投影，提供聚焦正向结果测试，不写 UI 自动化测试。

已排除一个调查假设：apiJsonWithTimeout 传入 AbortSignal.timeout(20s)，transportRequestSignal 在 input.signal 存在时直接返回该 signal，因此并无默认 15s 截断，不修改此链。配置保存 44–76s 的成本分布仍未知，前序原始请求证明有限成功；本轮不以删验证、缓存或超时绕行掩盖性能问题。

## 实施前方案

1. currentPermissionMode 返回 PermissionMode | undefined。Composer 未加载时使用中性未知图标和双语标签，仍可打开设置；未读取配置的菜单选项不可提交。Settings 用同一投影显示说明和既有 loadConfigInfo 重读按钮，读取期间显示真实按钮忙碌状态，错误继续由既有反馈呈现。
2. 聚焦非 UI 测试验证两种已确认模式及未加载快照的明确投影。官方隔离 package build environment 构建，类型和 locale parity 检查；不增加、修改或运行 UI 自动化测试。
3. 使用新独立 native 服务 permission-config-435-after，端口 18635，成熟 413 harness、600 秒物理期限；既有授权凭据及完整模型目录成对复制、真实 gpt-6.1-sol 流预检。通过真实页面复核首页 Goal 步骤和布局、冷启动/写入等待中的权限未加载、原 Ask 到达后的正确选择、重读及中英文。只改 QA 的可恢复 username 并完整恢复，不扩大安全权限、不发业务消息。
4. 关闭自有页、公开 shutdown、原句柄 join、native physical/output/request 结算后精确退休凭据对；归档必要截图和实际检查/运行事实，更新三索引与架构，文档检查、范围提交、fresh fetch/merge、完整待推集合审查、正常 push。持续 goal 保持 active。

## 验证与结果

聚焦模式投影 3 项/5 expect 与配置读取归属 7 项/14 expect 均通过。首次 typecheck 发现新增 Button 漏填公共必填 tone，已修正并完整重跑通过；首次并发构建已通过，但生产源码在构建期间修正，因此该包未用作验收。后续 50.93 秒完整构建与 renderer surface checker 成功后才发布独立 18635 服务。

18635 实际首帧无配置时辅助名称是 Permissions not loaded，01 已读取后显示原 Ask；02/03 是真实全局 writer 期间 New chat，显示未知且菜单两个模式均 disabled，仍可进入 General。04 为真实配置读超时后明确未加载说明及重读；05 是点击后实际 Loading 按钮。截图人工发现英文长标签压缩了 Work/Chat 标签，因此将工具栏短标签改成 Not loaded（完整权限语义由原图标、title/aria 和菜单上下文保留），中文为权限未加载；后续必须新包、新服务再截图，不能把当前包宣称最终版本。

06 是 18635 重读真实成功后的 Ask；原配置错误随成功 reader 清除。实际 writer 通过生产 config service → browser HostTransport → 原 HTTP server → canonical config 文件，username 临时值被接受，完整解析后的 canonical source 在 finally 恢复，Ask 保持；48,593ms 写入与 17,174ms 恢复，原服务请求也均 200。此脚本不是 UI 测试，没有浏览器 DOM 或 UI 断言。

最终 50.09 秒正式构建发布到新的不可变 18637 服务；构建后只补了两个源码注释，没有行为修改。07 的英文 Not loaded 保留完整 Work、Chat、Skills & squads 和模型标签。08 是中文未加载说明，实际点击重新加载后按钮为加载中；09 是中文首页未知状态且整张三步 Goal 引导可达。10 为真实中文帮助。11/12 确认读取后 General 和首页均恢复先询问。13/14 为原有 Work 会话的顶部创建入口及真实表单，包含成果/验收标准、令牌与轮次预算和创建即自动续跑说明；只打开并关闭，没有提交 Goal、业务消息或启动执行，不把此证据称为新的自动续跑端到端资格。

最终真实写入 50,155ms、恢复 17,367ms，生产 checker 的接受、恢复和完整解析源相等合同均通过，原请求均 200。配置写入成本仍未分解，本批不宣称性能根因已修复；已有 General 原始技术错误诊断未改写为翻译文本。

两处页面均已关闭，两个自有服务通过公开 shutdown 200、原 exec 6862/30243 joined exit0、native physical/output/request 完整结算后退休各自 auth/models；两份原生物理回执均归档。私有 authority 的额外文件对也已精确退休。两 scope 各两次实际 gpt-6.1-sol 流预检均 200、reader EOF，总计四次。准备和最终退休时原 Codex authority 的尺寸与 mtime 一致，此处只声明 stat 观察，不用哈希或 stat 冒充全部字节身份。归档选择性回执、脚本、检查日志和 14 张实际截图；凭据、DB 和完整 Provider body 不入库，已用内存中的实际凭据值检查所选 artifact 及解压内容通过。

最终 typecheck、locale parity（两语言 2504 keys）、正式 Node Vite/renderer surface、docs:check（345 ops/26 groups）和 architecture-index 通过。前序失败 typecheck 和未用于 publication 的首构建日志保留。没有新增或运行 UI 自动化测试，10 项纯服务合同不能替代上述人工视觉验收。三索引和当前架构已同步。接下来按当前分支 fresh fetch/merge、完整 pending 审查和正常 hooks 提交推送；持续 goal 保留 active，性能问题继续独立调查。
