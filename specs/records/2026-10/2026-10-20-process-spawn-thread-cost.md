# 监管命令的启动线程与 Git 包装器成本

## Recall

持续单开发 agent，不委托；用户后续单 agent 要求覆盖 active Goal 的旧三 Astra 文案。上一轮 474 为 progress：4c9c4c03c65a124fc26ad8375ae79d92ee13c75a 正常推送，fresh fetch 后 HEAD 与 origin/main 一致；唯一实例工厂先获得原目录注册 authority 再发布并结算 discovery，修复真实连续写入等待环。112 pass/2 平台 skip/236 断言、全仓正常 hooks 通过；三 native、reader/writer、运行与私有 auth/models 对全部结算。自有完整 QA（Quality Assurance，质量验证）145 Project/194 Session/schema3，所有旧身份、双会话来源和完整 canonical 保留；未访问用户数据库或 18571 进程/页面。当前仅原 .bun/ 与 packages/opencorvus/bun/ 未跟踪。

原完整保存 cold≤10000ms、restore≤5000ms、保存中四种真实读取≤20000ms 保持。474 最终两轮保存 15811/16618ms、恢复 16342/16228ms，性能仍失败。全项目初始/准入后身份各自新鲜观察、全部项目候选与模型/插件验证、原注册 queue/generation/occurrence、物理/output/request 结算不缩减；不增大身份缓存或特判 username。无 UI（User Interface，用户界面）自动化、额外 branch/worktree 或子 agent。沿用已读 benchmark-debug-template。

已读 474 Recall 与实际阶段、443 监管与 batch、444 CPU（Central Processing Unit，中央处理器）归因、446 父查询、448 并发和 Git 双路径、465 DEBUG/INFO 与 detached flag 反证；当前 05-config、task-runtime-directory、Project/Instance、hostGit、Process/ProcessFacade、Windows supervisor、Rust helper、util/process-node 和 which 全调用定义。官方 [Node worker_threads](https://nodejs.org/api/worker_threads.html)、[Node child_process](https://nodejs.org/api/child_process.html)、[Git for Windows wrapper](https://gitforwindows.org/git-wrapper.html) 已查阅。Node 建议 I/O 优先原异步 API；不能仅凭线程概念认定收益。Git 官方说明包装器负责环境设置且内部安装布局会变化，不能硬编码内部路径取代实际 PATH 命令。

## 修改前深度分析

现象：完整保存仍约16秒，原 Git 重叠阶段累计约100秒（非墙钟）。直接触发为全量 Project 的两次实际 Git 身份确认。474 消除了多余物理路径查询及缓存发布等待环，没有改变每命令同步启动 helper 的时段。旧单 leaf Bun/Node、并发、overlapped、detached flag、DEBUG/INFO 都未提供稳定整体收益，不重复。当前具体剩余成本未知，不能先选择 worker 协议或新缓存。

本机实际 PATH 是 C:/Program Files/Git/cmd/git.exe（45032字节），内部 mingw64/bin/git.exe 为4003816字节，同为2.45.1.windows.1。包装器可能多启动一次目标；它对完整保存的影响尚未知。第二可证伪点是同一原 Process.runHost 整个执行放在标准工作线程后，是否只改善主线程可响应性，或也减少命令总时长。线程与 agent 无关，不执行 LLM（Large Language Model，大语言模型）或委托。这里只诊断现有执行实现，不把私有探针的消息协议交付成生产第二路径。

共享面：Windows Host/Task/Mission/Session shell/command 与 detached 重启共用原 spawnWindowsRequest/run_request；父 PID（Process Identifier，进程标识）与出生时间、Job（Windows作业对象）原子归属、ready/launch-failed/settled、取消、后代及请求清理均不可弱化。线程诊断仍执行完全相同的原生产 Process.runHost 和原 release helper；其 native 父仍为同一物理宿主，需检查真实 owner/target/最终 live 记录。不修改任何生产定义/调用/公共错误、配置面、数据库/schema、数据、工具/模型消息或 UI。新调度/恢复/终态异常一经发现立即横审全部生产入口、occurrence、正常/终态、重试/重启、串并行及多项目；不能归为探针偶发。

## 实施前方案与验收

1. 在自有新 runtime、导入生产模块前设置隔离路径；不复制凭据，不启动模型或用户服务。读取上一轮已有私有只读项目快照作输入，选实际 Git 目录；两种 Git 可执行文件只用于诊断对照，生产仍按当前 PATH。使用现有 release helper、原 Process.runHost，实际输出与真实工作树路径比较，每个原 handle 完整结算。
2. 同样数量及并行度的主线程/标准工作线程、包装器/内部真实 Git 交错测量；记录完整结算时长、主线程计时器实际延迟、同步 spawn 时间及实际 request/owner 身份。内部 Git 必须实际结果相同；不能用更快但不同输出作收益。工作线程按轮次自然关闭端口并 join，不能在尚有子进程时 terminate。无活动时限沿用原15秒；观察超时只重新读取同句柄，不重启。
3. 诊断不冒充端到端或原性能达标。若无稳定收益，不引入 worker/内部 Git 路径；记录排除证据。若有收益，先补完整生产设计、所有调用与生命周期风险、正向合同和打包/宿主边界，再修改生产；必须回到原完整 QA native 开发服务、production checker、原门槛和真实浏览器交互/截图人工复核。Provider 若后续需要则完整 auth+models 成对预检 actual gpt-6.1-sol/stream，原生结算后退休。
4. 不运行 UI 自动化；非 UI 行为改动需聚焦真实正向合同。只有诊断与文档则不把静态检查当产品资格。新增 spec/artifact 同步三个索引，运行 package.json 当前 docs/architecture 检查，审查范围创建提交；fresh fetch/merge、完整 upstream..HEAD 集合、正常 hooks/push/fresh fetch。未达原性能目标如实保留，长期 Goal active。

## 真实诊断结果与实施裁决

首次 scratch 相对导入用了三级父目录而实际需两级，原执行exit1且发生在任何生产模块导入之前。修正工具后原78949自然exit0；不重启活跃进程，不把工具错误当成产品缺陷。输入为474开始时的142项私有既有快照，当前文件系统141项有本地.git，选24个实际目录用于局部因果诊断；不是用它替换当前145项完整配置验收。

16组、每组24次、共384次真实Process.runHost/native Job命令全部exit0。每条实际Git顶层物理目录与所选worktree一致、common目录可读取、stdout/stderr逐项等于首轮同目录真实输出；原helper close0，原request完整清理，每组原ProcessSupervisor live0。物理宿主40708的同一出生时间在主线程和工作线程请求中一致；三个工作线程自然关闭端口并exit0，原78949随后exit0。四个自有runtime/data目录为空，无DB initializer、Provider请求或凭据复制。

同为并发12的正反轮：主线程包装器809.884/1118.756ms，一个worker1603.355/891.182ms，三个worker855.057/1172.477ms；内部Git对应617.089/900.848、1752.854/1021.092、708.298/774.578ms。一个worker没有稳定完整吞吐优势，三个worker也未稳定优于原主线程。主线程最大计时间隔在包装器组98.585/211.129ms，worker1为7.844/68.279、worker3为10.752/30.023ms；这证明局部响应性改善，不是全链路性能或CPU百分比。串行组也只有一轮，不能将其4059→2529ms当作已排除热身/顺序效应的提速。

内部Git虽有局部优势，不能把自动拼接mingw64/ucrt64路径作为当前生产修复；官方入口承载环境与安装布局合同。工作线程若移整个Process模块还会引入每线程独立的runtime occurrence，而原物理PID/出生时间相同；需要显式生产身份与结算设计，不能直接交付本探针。当前证据不支持引入worker池、内部二进制路径、并发常数或另一命令配置面，生产代码保持原唯一执行实现。

本轮为progress：实际证据排除了“整个Process移至一个/三个线程即可稳定提升完整吞吐”的简单方案，明确区分了主线程停顿和总时长，并识别线程身份设计风险。没有新生产调度/恢复异常，所有探针本轮正常收敛；不宣称修复原完整配置性能。保存≤10秒/恢复≤5秒仍失败，继续沿完整关键路径调查，禁止重复以局部分数或更少项目宣称通过。当前架构、迁移/schema、消息/工具/模型与UI合同均无变更，不改写其文档。

[完整安全证据与原终端](../../artifacts/2026-10-20-process-spawn-thread-cost/README.md)同步三索引。只对文档变更运行当前docs/architecture和差异检查；正常hooks在提交/推送执行。不新增或运行UI自动化、不虚报新网页/模型验收，范围提交后fresh fetch/merge和正常push，长期Goal保持active。
