# Windows 监管的直接父进程查询

## Recall

持续单agent，旧goal三Astra文案已被后续单agent要求覆盖。上一批445是progress：6f3a126c4e59ba294f845beaf162795158fd1c94正常push，fresh fetch HEAD=origin/main；修复Provider四类可变引用，真实生产插件跨两Project/global/source的失败→通过与16例25断言通过。完整QA（Quality Assurance，质量验证）412保留77 Project、schema2，canonical完整恢复；原服务/检查句柄physical/output/request及launcher均结算，445 auth/models对退休，源授权metadata不变。原.bun/和packages/opencorvus/bun/保留。

持续benchmark-debug-template，全历史开发服务与正式441 UI（User Interface，用户界面），不清库/缩样本，不运行UI自动化，不碰用户18571进程或窗口，不分支/worktree。完整配置性能仍failed：cold19505.1606ms、restore5469.5452ms、真实GET16241ms/200，原10s/5s/20s门槛不变。真实Provider预检需完整auth/models对，credential/catalog/实际gpt-6.1-sol流式分别验证；原句柄完整退出后才退休副本。

## 修改前调查、合同与风险

已读443原生阶段测量、444 CPU（Central Processing Unit，中央处理器）剖析、445 Recall与结果、ProcessSupervisor全部Windows命令/壳/请求入口、Rust run_request及Toolhelp枚举/后代终止、测试/运行helper构建和sourceIdentity目录、Cargo绑定及现有原生正向合同。443实测每个helper父进程全表快照22–30ms，每次完整Git约156–214ms；444 spawn仍是主要采样热点。不能把重叠Git跨度相加作墙钟，也不能假设替换父查询就达到全量门槛。

现象为所有冷Project的两轮Git身份确认重复支付每命令的监管启动成本；触发点是run_request为取得自身parent PID（Process Identifier，进程标识）创建全机Toolhelp快照并枚举全部进程。直接父查询是否显著更快尚待实际测量。队列/唤醒/恢复终态没有新异常；本轮审计共享Windows Host/Task/Mission/Session正常命令、shell、detached重启、串并行及多项目入口，均进入相同run_request。原owner PID与出生时间、Job原子归属、ready/launch-failed/settled、输出与请求结算不可删除。

已核对[Microsoft NtQueryInformationProcess](https://learn.microsoft.com/en-us/windows/win32/api/winternl/nf-winternl-ntqueryinformationprocess)：ProcessBasicInformation的InheritedFromUniqueProcessId是真实父PID；同时该接口有未来变化风险，官方要求动态绑定并处理不可用。现有windows-sys0.59的SDK（Software Development Kit，软件开发工具包）已提供完整PROCESS_BASIC_INFORMATION结构，通过Win32_System_Kernel feature可用；无需自造布局。动态GetModuleHandleW/GetProcAddress通过Win32_System_LibraryLoader，接口缺失/NTSTATUS失败/返回长度或自身PID不符均返回明确启动错误，不切回旧算法。作为成熟实现参考，[Chromium父进程查询](https://raw.githubusercontent.com/chromium/chromium/main/base/process/process_handle_win.cc)同样使用该字段。

拒绝管道PID替代：它证明管道参与者，未证明helper直接父进程，不能降低当前合同。后代终止真正需要进程图，继续使用同一现有Toolhelp函数；这与只查询自身父PID是不同数据需求，不是查询失败fallback。运行/测试helper已按Cargo manifest/lock/main内容隔离构建目录，新源码产生新目标，不覆写用户使用中的旧helper；发布构建也执行真实cargo，不存在凭猜测断言的旧binary问题。

## 实施前方案

1. 先在自有scratch编译无Provider/数据库的Rust诊断：同一当前进程直接查询父PID并与原Toolhelp独立观察比较，记录两者真实耗时与明确PID/长度/状态；只读系统事实，原句柄及时关闭。测量证明后才改生产。诊断不能冒充全量服务验收。
2. 若证据支持，唯一run_request父查询换为直接查询，SDK结构、动态地址、NTSTATUS、返回长度、当前PID及父PID范围全部校验，原请求owner比较与出生时间核验不变。无持久化/协议/配置/schema/LLM（Large Language Model，大语言模型）变更。没有查询fallback、非流式模型或共享缓存。接口未来不可用时明确pre-target失败，属于已知平台风险，不能宣称跨未来Windows版本验证。
3. 聚焦正向Rust合同以Toolhelp独立系统事实证明直接父查询；通过现有原生helper测试与真实Process API（Application Programming Interface，应用程序接口）覆盖命令、输入、错误、owner退出、物理/output/request结算及detached，检查真实编译与相关后端身份/配置合同。源码parser测试只证明局部错误合同，不替代真实运行。
4. 使用完整77以上QA历史、真实原helper/正式UI和Config service→HostTransport→HTTP（Hypertext Transfer Protocol，超文本传输协议）原两次保存与恢复checker；信号使用445修好的durable atomic发布。保留原性能资格和实际页面交互截图，不以诊断分数、暖缓存或少项目通过。
5. 同步对应架构/三索引、docs与architecture-index，安全摘要归档；所有原native句柄完整结算、凭据对退休后范围提交，fetch/merge upstream、完整待推集合检查、正常hook push与fresh fetch。goal保持active。

## 结果

进一步共享终态审计发现原pre-target边界不完整：owner PID/出生时间、标准句柄或helper身份校验在create_suspended_target之前直接return Err，未发布原launch-failed事实；仅detached containment两分支及CreateProcess错误发布了该事实。新查询的明确失败也会落入同一缺口。主程序仅stderr+exit125，而Host等待durable物理事实，原错误可能被额外结算失败遮蔽。生产Shell/Command、Task与detached都受同一run_request影响，重试/恢复会观察未收敛请求，不能当作某条Git命令局部问题。

实施前补充：对已有非空runtime/owner身份字段的可关联请求，统一一个prepare_target边界，包含helper marker、真实父/owner实例/containment/标准句柄与原CreateProcess，成功返回原owner handle与SuspendedTarget。CreateProcess是末个可失败步骤，只有成功返回才有target；所有Err由run_request唯一catch发布现有pre-target marker，原错误与marker错误按原格式保留。删除detached与create失败中的重复发布。之后的已创建target结算原样保留。无法反序列化或缺少关联字段的非法输入仍原样明确拒绝，不能伪造有效关联或终态事实。

正向验收补充真实native owner PID及出生时间两种拒绝：原错误精确匹配，同时原helper/请求/occurrence与target_not_created/active0 marker精确匹配。独立系统Toolhelp仅作为测试真实父查询的oracle，不是生产fallback。若实际测量不支持性能改动，也仍需修复这个已证明的共享终态边界；整体性能资格保持原目标。

诊断已完成exit0：12次实际Windows直接父查询24.7–42.8微秒，独立原全表快照21744.3–25168.5微秒，全部父PID相同，NTSTATUS=0、SDK返回48字节、自身PID匹配。仅当前进程诊断，不含Provider/数据库，不作为全量提速资格。新native正向owner错误→精确pre-target事实合同在原代码实际失败：95193 joined101，返回原owner拒绝后读取不到launch-failed事实；测试自己先精确清理新建目录再报告失败。现有其他生产修改尚未开始，随后按上述已落盘边界实施。

实现后原生6例全部通过，包含原Job/drop/后代/transfer codec及新增真实父查询和两种owner错误终态。prepare_target返回原helper出生身份供后续真实ownership transfer使用，不重新观察或改写该事实。初次编译因移动局部变量漏传helper_instance_id而失败，已返回原字符串并重跑成功；没有用另一次查询替代同一事实。

后端原checker尚未进入用例，正常prepare-test-process-supervisor构建失败E0583：其隔离Cargo home的windows-sys0.59源码缺少Kernel和LibraryLoader模块；同锁版本完整本机cache中的SDK诊断/原生编译均已通过，故不是删除新feature或改本地结构的理由。缺失来源未知。修复限于该仓库自有临时build cargo-home的精确crate extraction：先确认无cargo/rustc仍运行，用Cargo.lock的不可变发布包checksum验证原.crate身份与真实模块清单，再把不完整提取目录重命名为同父目录的隔离记录，让原Cargo自己按原archive重新提取，重跑同一原checker。不修改用户cargo home、锁文件或任何凭据；这是验证官方不可变资源的真实完整性，不是可变源码摘要验收。

缓存修复执行后原checker20419 joined0，实际Cargo重新提取并编译所需模块，6文件16例41断言通过。仅格式化新增Rust函数与两个新增native tests，未格式化原有区域；最终34490再次用当前source构建并通过两owner拒绝及选中的13个control-plane合同，含真实owner退出后的listener回收、Job/输出/请求结算、前后台root语义和Task Capsule配置下的真实Host命令。按文件最后有效运行去重为29个backend用例/72断言；最终原生6例重跑exit0，总35例。typecheck37419 joined0，真实cargo --release --locked编译64534 joined0。未宣称这些局部合同代替UI或全目标资格。

真实服务18685使用该原manifest的发布优化helper，操作系统CIM（Common Information Model，通用信息模型）按原Host父PID观察到实际helperPID81632及唯一可执行路径，确认没有落到其他binary。完整auth/models对预检credential usable/catalog projected/实际gpt-6.1-sol streaming通过。78个完整历史Project、初始loaded2；原42313 checker joined0，cold19395.3382ms、restore5234.7129ms，canonical完整恢复、Ask保留。保存中实际New chat的GET/global/config从22:00:55.385Z到22:01:11.551Z，16166ms/200，起点在原cold PATCH内。

完整性能仍failed，原10s/5s门槛均未达；page≤20s通过。12次点查询局部诊断改善不能宣称整体保存改善，77→78项目且release与debug构建条件不同，也不计算严格提速比例。仍需调查宿主spawn及全量配置工作成本，不删身份观察、缩小样本或以部分通过改写goal。

浏览器41实际查看OK/openai/gpt-6.1-sol/Ask、保存中及恢复后默认页，人工截图复核，无UI源码/自动化改动。公开shutdown200，原21282 launcher joined0，原native physical/output/request及Host/Target精确实例终态全部核实后才退休私有446 auth/models，源授权metadata未变。独立SQLite readonly/create:false确认user_version2、Project count78，无生产初始化器/迁移或数据清理。

[安全原始结果、检查与人工截图](../../artifacts/2026-10-20-native-parent-query/README.md)保存诊断、原失败、Cargo缓存修复、发布构建、实际helper路径、完整服务请求及结算；完整配置、Provider正文、开发日志保持私有，归档前扫描实际凭据值。server-runtime-readiness与三索引同步；docs/API、architecture-index及正常Git hook在范围提交推送结算。goal保持active，不创建branch/worktree/tag/Release。

归档review捕获本agent的工具错误：复用collector时只改了scope tag，漏改独立artifact目录名，当前446结果覆盖了445本地证据。先保存完整binary diff并核对batch/occurrence及原始输入，15份本批输出按实际bytes保存到446正确目录；445在任务开始时无改动，故仅对确认被本次覆盖的7个tracked文件分别用原HEAD精确单文件restore，8份本次新增错位文件在成功保存后精确退休。没有整仓回退、历史改写、用户文件或生产数据变化。445目录已恢复原提交内容；修复collector目标及generator的显式目标guard，不能用文档掩盖归档损坏。安全修复回执存artifact/archive-path-repair.json。
