# 完整配置保存的日志成本归因

## Recall

持续单 agent 自主迭代，不委托；后续用户禁止子 agent 覆盖旧 goal 三 Astra 文字。上一轮464为progress：8aad1bc2409ed55e8c13cf8aeb23c8981708fd5e正常push并fresh fetch确认HEAD=origin/main。最终产品修复只有服务商首次读取的中英文反馈，12张真实截图人工复核；无收益扫描并发实验及其测试已精确撤回。123 Project/165 Session/schema2全部原身份/归属/目录保留；七套自有进程、输出、请求、launcher及凭据/模型目录复制对均结算。仅原.bun/与packages/opencorvus/bun/不相关未跟踪，本批开始无tracked修改。完整历史保存10s/恢复5s仍失败，四并发读20s通过；新Task Goal执行、原生目录picker、Sources与侧agent直播Rendering没有464新资格。

沿用benchmark-debug-template。已重读464完整Recall、当前AGENTS、05-config全局候选枚举与identity retention合同，实际Log创建/emit/sanitize/Pino destination、SkillReadDiagnostics request/phase/span/observe以及CLI日志默认值。源CLI明确本地开发默认DEBUG、安装版默认INFO；原413隔离wrapper始终传DEBUG。不能未经测量把诊断成本归为产品身份I/O，也不能把改成INFO或放宽原指标当作开发模式修复。

## 修改前分析与实施方案

症状是全部注册历史的全局保存/恢复约15s，期间首次Provider页等待；464已修呈现但性能未修。当前直接触发仍是完整候选验证和身份准入。已证每次原DEBUG保存约2.9万realpath/stat各一轮，原spawn同步约4.7–5s；并发累计非wall time。并行扫描、提高并发、overlapped、单leaf宿主切换均无稳定整体收益，不重复。新的未知是DEBUG真实阶段/安全清洗/Pino日志和Promise观察的额外成本。Log.emit已先检查level，SkillReadDiagnostics在INFO直接返回原operation，不能先假设这些开销存在或删除安全清洗。没有本轮调度/队列/终态异常证据，若出现按全部Task/Mission/Session occurrence、生产入口、重试重启、串并行及多项目横审。

1. 先只建立两个相继且完整结算的自有native开发服务18765(DEBUG)/18767(INFO)，使用同一464正式UI和当前后端，保留全部QA412历史，不动用户18571/窗口/进程/真实用户数据库。每scope最多4、整批最多12实际Provider请求；auth+完整models成对，credential/catalog/实际gpt-6.1-sol流式分别预检，不refresh/exchange/写源。20分钟仅是自有监管安全寿命，不把观察超时当终止依据。
2. 复用原production config client→HostTransport→实际HTTP与完整canonical恢复checker；保存10s/恢复5s、四并发读取20s保持。两个scope只有CLI log level不同。INFO没有DEBUG阶段日志，私有被动wrapper仅透传原Diagnostics request/phase，并在原config.global.before实际进入时发布一次当前HTTP requestID标记；两种level使用相同标记，reader等待该原阶段再发四个实际请求。它不选择业务流程、持有锁、改队列/stdio、插入缓存或替换Promise/返回值。标记只用于观察真实已发生的准入，不是产品host流程门。
3. 原先reader每100ms扫描不断增长的整个DEBUG文件，本轮改为读取该确切小标记，记录测量工具边界；不能把reader工具的成本误算成Log或身份实现。实际完整请求为性能证据；DEBUG/INFO比较仅归因，开发模式原门槛继续保留。若差异明显，再用官方Profiler或原Log透传观测定位具体热点；没有真实证据前不改生产。修改前补齐全部定义/调用/公共合同、数据、测试、文档/交付风险分析。
4. 若非UI根因成立，聚焦正向测试及原真实checker必须通过；UI变化必须正式build+真实CUA截图人工复核，不新增或运行UI自动化。若只得出诊断结论，明确排除未证根因，不提交无效优化。不得降低日志完整性/脱敏或删除诊断功能换分数，不新增fallback/旧协议/影子状态。
5. 每个writer、reader及native原句柄与physical/output/request/launcher完全结算后才启动下一scope；实际parsed canonical完整恢复，readonly SQLite对比每个原Project/Session的身份/归属/目录及schema2。秘密值扫描后runtime/private复制对退休。spec与三索引、当前相关文档检查、范围commit，fetch/merge及完整pending审查后正常push，fresh fetch确认。长期goal保持active，不创建分支/worktree/tag/Release。

## 对照结果与下一项可证伪实验

原DEBUG1237 exit0、writer52235/reader92546 exit0：124项目，保存15638.152/恢复14851.803ms，四读最长15892.972ms。原INFO63659 exit0、writer4641/reader94887 exit0：125项目，保存14819.465/恢复14484.729ms，四读最长15086.892ms。两组完整canonical恢复、Ask、227Provider/8133模型与实际Sol保持。实际CUA tab12/13等待与目录恢复四截图已查看，页已关闭、公开shutdown200、native physical/output/request/launcher及runtime复制对结算。INFO和减少reader日志扫描均没有解决原性能，不改默认日志、不删除脱敏/诊断功能。

464原CPU采样startTime为epoch微秒，timeDeltas累计与end相差1.659ms，并与原native出生时间一致。按真实HTTP窗口拆分：首写1403个sample中602在native spawn，恢复1558中691在同一栈，经Node child_process→原观测透传→spawnWindowsRequest。另有真实which/isexe stat、DB rows和MoveFileExW成本；sample不是毫秒。未按函数名合并所有匿名frame作为根因，记录具体frame/调用位置。完整原采样仍私有保留。

当前spawnWindowsRequest无论foreground还是durable detached均以Node detached:true/windowsHide:true启动每个helper。Node官方 https://nodejs.org/api/child_process.html#optionsdetached 明确Windows detached关联独立console/父退出行为；真实成本未知，不能直接更改共享生命周期。既有454只比较pipe/overlapped，447比较Bun/Node单leaf；本次只在私有实验透传原Process.runHost及原Rust helper，比较helper detached flag的同步启动成本与完整结算，保持windowsHide、原stdio/环境/Job/ready/cancel/settled和request文件，不触及持久detached转移或production源码。

私有flag-probe以全量readonly QA枚举选24个真实Git目录，交错单并发/12并发detached与attached，各原Git identity输出和2MiB stdout/512KiB stderr/1MiB stdin对比，所有原child close与live handle事实结算。仅声明此局部合同，不冒充Task/Mission/Session、重启/后台转移或完整保存资格。无Provider/凭据、无生产DB initializer、全新自有runtime。若无稳定收益则排除该flag根因，不保留生产改动；若有收益，先补齐共享全部入口与父死亡、正常/取消/失败、串并行、多项目/重启恢复、实际Task/root/Host及durable detached合同后才考虑更改。

## 结果与交付

INFO未解决耗时，维持原CLI默认值。按实际epoch/sample delta拆开原CPU request窗口，首写native spawn602/1403、恢复691/1558；调用栈明确进入原spawnWindowsRequest。先前只按函数名汇总匿名frame的私有概览不作为根因证据，正式归档按完整frame身份区分。没有将sample数等同毫秒。Node detached flag的148个原命令完整输出/结算通过，但12并发attached1347.992/1282.295ms，对照detached992.139/1105.427ms，没有稳定收益，生产不变。flag探针原67277 exit0，ProcessSupervisor.live0，独立runtime data未产生数据库文件；只读输入枚举125项目/124本地Git，选24个真实目录。

两个scope的四个原reader/writer和两个native都已exit0，public shutdown200，native physical/output/request/launcher与运行复制对结算。CUA tab12/13关闭，四张实际截图人工查看，真实等待提示和227目录/Connected OpenAI恢复。每scope2个、总4/原12个Provider请求，均gpt-6.1-sol/streaming/200/eof。两套私有auth+完整models复制对经实际秘密值扫描后成对退休，源metadata保持、无写入/refresh/exchange。最终readonly schema2、125 Project/167 Session，原123/165及124/166快照的每个身份/归属/目录保留；两个checker完整parsed原canonical恢复、Ask保留。

本轮属于progress：新增真实证据排除了DEBUG诊断、reader整日志扫描和helper detached flag作为简单性能修复，修改了下一步行动；没有生产修复或UI测试，不能把调查包装为达标。原10s/5s仍failed，四读20s通过。完整全局保存的独占范围涉及Skill catalog/reference/Config generation及所有Project身份，尚未证明可安全缩短；不以用户名特判、缓存旧身份或跳过项目绕过。下一批先回到实际新Task Goal执行链及用户可见行为，保留完整保存性能为未完成项；不重复上述无收益微实验，长期goal active。

[四张截图、实际请求、CPU调用栈、原生探针、历史与复制对证据](../../artifacts/2026-10-20-config-log-cost/README.md)已归档。三索引同步后运行当前docs/architecture检查，范围提交与正常fetch/merge/pending审查/push；不创建branch/worktree/tag/Release或绕过hooks。
