# Provider 保存结果与目录观察（持续迭代第 12 批）

## Recall

用户原始要求：持续迭代当前版本直到明确停止；每批并行调查 UI/UX（User Interface / User Experience，用户界面与体验）和功能，先完成根因、影响分析与落盘方案，再修复，做真实桌面交互、截图人工复核、聚焦正向功能测试及必要且已授权的 GPT-6.1 Sol 端到端资格，范围清晰提交、同步上游和正常推送后进入下一批。

硬约束：只操作自己的隔离页和服务；不运行 UI 自动化测试；不用模型自述、可变源码摘要或 mock（模拟）冒充真实验收；不新增状态来源、后备实现或 LLM（Large Language Model，大语言模型）工具选择流程门；私有凭据不进入输出与提交；不创建分支/工作树，不混入其他 owner 的更改。两个既有子 agent 只读调查，禁止再次委托。当前目标保持 active。

上一批交付：f757ca4791155569bc0679cb65f8ec1eddb6faff；共享 writer 已在 9438501d5d6eaa627cd7276d481f1dfc2696b7b1 集成。48 项正向测试、159 断言、30 张原截图、4 个真实 gpt-6.1-sol 流式请求。normal push 原 73415 实际 exit0，远端 5107ed64 已包含该提交；本批 artifact 承接完整 delivery receipt。旧 receipt 的 indexRecovery 重复 actualExit 属性错误合并了两次工具结果：原 58058 exit1、38874 exit0；保留原件后改为两个独立对象，不改变实际 Git 交付结论。

本批开始 HEAD 04fcd0115d7dcfea514ce14aedb0baa196a6f707。git status 中 server shutdown/restart、compaction、mysql-transfer 与共享 spec 索引有并行更改，均保留。工作日期 2026-10-14（Asia/Shanghai）。

已读资料：current architecture 05 Config、06 Provider、07 Provider Form/Panel Reactivity；上一批空声明与 bootstrap discovery spec/artifact；ProvidersPanel、config/config-load、ApiError、formatErrorDetails、diagnostics/AppLog、permission-mode、ChatComposer、TaskDirBar、NetworkPanel；后端 Config.committedMutationReceipt、两配置路由、MCP（Model Context Protocol，模型上下文协议）reconcile、McpAuth reader 和 server-runtime。全仓搜索覆盖配置 writer 定义与全部消费、409 receipt 生产与三处读取、目录加载与凭据事实、错误详情/console/日志路径及历史 decoder 65d0bfc98、authority fence 677f7afd。没有可复用的网络异步串行结算 primitive；已有 Save Key loop 是可提取的重复，runPostCommitUiEffect 仅同步 UI effect。

委托反馈：UI agent 确认 receipt.config 可包含 provider.options.apiKey、proxy password 和自定义 headers；原 APIError 对象与 formatErrorDetails 携带它，permission-mode/ChatComposer 可将 details 送 AppLog 持久日志；标准两路由直接返回 JSON，不能套用通用后端错误 handler。现有 redactor 模块含 backend/Node 依赖，跨端迁移超出最小需求。功能 agent 确认 service 发布 committed config 后仍 rethrow，而 Panel 只在 fulfilled 置 configCommitted；Save Key cleanup 失败仍 reload，普通 Save 没有此保证。完整反馈原件归档。

验收指标：无 Key 的明确保存后立即观察当前目录；typed committed receipt 的已保存事实与协调失败同时保留；Auth（authentication，身份认证）和 cleanup 后续结果分阶段可见，目录 read 由原 loadProviderInfo 唯一拥有；失败显示 unknown/原实际事实，不由输入猜测；业务 config 保持原值，诊断不携带整份 config；scope/authority/form occurrence 不被绕开。英语和中文桌面前后截图人工查看。纯数据/服务测试只证明局部合同，真实 HTTP（Hypertext Transfer Protocol，超文本传输协议）与桌面分别资格。

## 根因与影响分析

可观察现象：上一批真实 global 新建无 Key 的 config PATCH200、canonical row 出现，但 Key 占位仍 unknown；后续 Key 保存重读才显示明确事实。不同 scope 的不同输入不能作为 scope 差异证据。本批先复现独立无 Key 保存和受控 committed409，后者目前只有源码证据，尚未实跑。

直接触发：handleSave 的 reload 在 if(apiKey) 内；首次 PATCH 抛 typed receipt 时，service 已更新 config，Panel 却未置 configCommitted，走普通失败。Auth/cleanup 失败也可越过 reload。初始 effect 只依赖目录/authority/selectEpoch，不随 config mutation 加载目录。

根因是把 config commit、Auth commit、runtime 协调和目录观察混为一个 fulfilled 成功状态。loadProviderInfo 原本独立结算 global 三资源/project 两资源，维护 optional credential boolean；不能改成表单/APIKey/config 的影子事实。旧路径未根治：第 11 批只修声明/writer 空对象意图并明确列出目录观察边界；Save Key loop 没有被普通 Save 共享。

第二条根因是 receipt 同时携带恢复快照和诊断，消费者 JSON.stringify(error.body)/console.error(raw Error) 把业务快照提升为诊断。ProviderError redactor 的现有公开模块依赖 ai/http/backend；boundedDebugText 是剪贴板启发式，不适用。本批用精确 typed receipt 的诊断投影整份省略 config，不新增未知秘密关键词规则，不改后端快照或将脱敏配置写入 store。仅保证该配置快照不被额外带入诊断，不宣称任意 failure free text 的万能保密。

公共合同：唯一 producer 为 Config.committedMutationReceipt，两名字 GlobalConfigCommittedReconcileError / ProjectConfigCommittedReconcileError，data.committed=true、message、config、failures。普通 400/409/503 不是已保存事实。现有三处 reader 收口到公开类型，原 snapshot 按现有 fence 发布。全部 writer/错误消费和目录 owner 已搜索；普通配置 writer 仍不自动加载 Provider，Provider 行为观察自己的目录。外部 config hot reload、同字段 CAS（Compare-and-Swap，比较并交换）并发、其他设置页 saved-with-issues 体验不在本批。

调度审计适用性：当前是 UI 消费/诊断问题，没有已观察调度、队列、唤醒、重启或终态异常。受控 MCP reader 仅资格真实 receipt；若原恢复不能收敛，立即扩大到全部生产入口、Task/Mission/Session occurrence、正常终态、重试重启、串并行多项目横审，禁止局部降级。

交付风险：取消/重开会改变 form occurrence；旧 read 不得覆写新 scope。后续按 commit 事实执行，不重放 config/Auth。fulfilled load issues 也必须保留。只用隔离生成样例，不复制真实凭据；本批不修改推理/模型路由，暂不需重复 Sol 请求，扩大范围后重新判定。

未知：坏 JSON 的 McpAuth 是否在 persist 后触发、真实 Auth/cleanup 故障输入资格、当前 peer runtime shutdown 的真实结算。保留每次实际失败，禁止响应拦截/mock 冒充复现。

## 实施与验证方案

1. Node.js 冻结前态 UI 与真实 backend /ui；独立 HOME/XDG/data/project 和 loopback participant，启动前检查18600/18601占用。真实无 Key、新/旧 model/env 保存并截图回读 config/catalog。
2. 仅把自有 mcp-auth.json 改为无凭据坏 JSON，真实 public PATCH 检查 named409、canonical persist/GET、现有 retry owner；恢复输入并观察收敛。资格失败先更新分析；Auth/cleanup 文件权限输入仅在原路径确认且可恢复时采用，不加生产开关。
3. 一个纯 receipt decoder 供三个 service reader 与 Panel commit 判定；同一解码结果给通用 formatter 安全诊断 name/committed/message/failures，保留 ApiError 原 body 和业务 config。触及的 raw console 配置错误改用安全格式，全调用点审核防遗漏。补纯数据/服务正向测试，完整 payload/snapshot/metadata/typed error；不新增 UI 测试。
4. 从 Save Key loop 提取最小共享串行后续结算；config200/typed409 均进入后续阶段，真实 Auth 成功后 cleanup，最终独立 reload；原错误与 returned load issues 一起保存。precommit 保留表单，已 commit 按事实关闭表单并显示分阶段提示。保持全部 ownership fences。
5. 更新 architecture/locale 必要合同；聚焦测试、typecheck、Node build、当前 package.json docs:check；两语言两scope真实桌面人工截图，真实 HTTP 和故障恢复资格，build 不替代视觉。
6. 自有服务正常 stop/join、原 exec exit 和 listeners 证据；归档脱敏输入输出/原截图/失败修正。精确 index 提交保留 peers，fetch+merge upstream、审查完整 pending 集合、正常 hook/push，将 receipt 带入下一批 Recall。持续目标不结束。

## 执行记录

方案落盘时：根因与影响分析已完成，尚未实施。以下记录保留各次实际结果；当前验收状态以末尾收敛记录为准。

实施前资格：docs-plan 原8e7e6c和retry cc8915 exit1为并行 Session loop 重复completedSummary声明，未更改peer；owner改为publishedSummary后重跑原检查10d03f exit0（348/26）。Node前态build原10978实际exit0，真实backend原23807自有PID85632、18600/18601。真实桌面项目新建owned-new-no-key config200，Configured16/Catalog17，原截图清楚显示API key status unavailable。坏JSON自有McpAuth经公开project/global PATCH均真实409（6d7c00 exit0），canonical provider名称均已提交；UI再改名实际行更新但Save failed、form保留，前态截图已人工看。恢复原缺席文件并通过同一writer再写，2598ad exit0，两scope200。这里只证明公开恢复写入收敛，不冒称完整restart/自动retry矩阵。未产生新的调度/终态异常。resetForm实际同步setSaving(false)，成功reset后finally退休不会遗留busy，旧finally不应清掉新form。

已核对权威[OWASP日志资料](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html#data-to-exclude)：事件结果、原因与关联信息应保留，配置凭据不应因诊断被额外记录。本批只做typed config快照的投影边界，不作万能秘密文本识别。

后态故障资格补充（执行前决定）：Auth store只读已真实资格PUT500；global canonical config发布后，独有fs watcher看到公开名称Owned cleanup write fault再设该文件只读，真实第一Config200/Auth200/cleanup500/目录GET200链已获得，原watcher88988实际exit0，随后恢复原mode。为了资格fulfilled load issues，下一输入沿同一“公开名称实际发布”边界，仅把本实例Auth改成无凭据坏JSON；初始Config请求可正常接受，尾部原loader按既有三资源allSettled读取，canonical config成功与catalog/Auth读取失败独立保存。先保存自有完整Auth与相邻models成对原输入，恢复仍用这份原代次；不读用户凭据、不改生产hook或浏览器响应。若实际读取失败抢在初始commit前，本case不成立，必须保留结果重设计。该受控reader故障本身不代表新的调度异常。

生命周期资格设计：读取Config.withConfigFileLock与Auth.mutate后确认二者都使用util/process-lock的真实跨进程文件租约（realpath:false）。仅用原acquireProcessLock持有本实例canonical Config与Auth的原文件租约，让真实配置写入在原路径排队；不改API回复、timeout或生产hook。分别手动释放两租约，先让旧Config完成，再让新form的Auth仍在等待，用真实页面截图查看Cancel→同ID重开→新Save的busy/字段与最终结果。另用独立租约occurrence验证当前scope退出/恢复；所有helper正常release并记录实际退出。正常受控排队不是已发现调度异常；若释放后不能收敛，按共性机制横审。

生命周期执行：第一轮自有租约持有超过host-transport.ts原15秒（不是20秒）请求时限，实际新form报TimeoutError，失败截图保留，不能称new-busy通过。Config/Auth两个原helper均正常release/exit0，真实后读source是已派发旧配置Owned cancelled original intent、Auth仍未写入；这符合客户端超时而服务端已接受写入的原合同，没有发现释放后队列不收敛。第二轮工具动作按既定控制串行批量进行，在原时限内完成：先Cancel→同ID重开新Save，然后释放旧Config，截图真实新名称Owned current fast occurrence、Key隐藏输入和保存中按钮保持；再释放新Auth，表单关闭、目录16/凭据已配置。四个helper原3659/29002/79144/7424实际exit0，未改timeout。此时公共scope A/B/A仍待实页资格，后续结果见下。

## 后态验收与收敛

已实施：唯一纯receipt解码器供Config消费者和诊断投影共享；原业务快照与请求错误保留。Provider普通保存和行内Key保存共享已有串行后续结算，明确配置提交后观察目录，Auth实际接受才清理覆盖，拒绝和fulfilled局部读取问题保留各自stage、phase、resource、providerID。配置普通失败保留输入，保存事实与后续失败分开显示。原scope/authority/form occurrence边界保持。architecture与中英Unreleased日志同步更新。

真实英语项目页面：无Key新建后立即显示当前目录与明确Key事实；坏McpAuth产生真实Project committed409，配置和Auth接受后关闭原表单，显示已保存及协调问题。展开详情只显示安全receipt投影，原HTTP错误仍包含供业务读取的完整配置。请求b1b77823-ab6b-4b84-8322-ebaf2990d68d可与实际响应核对。Auth文件只读使真实PUT500（f5b7d9f8-61d0-4f83-937f-579eb22646d0），配置已保存、目录已读、Key实际false；行内Key失败保留输入，恢复权限后原入口保存成功并清空输入。

真实全局页面：无Key新建、仅env/model编辑均经原公开配置与目录路径完成，env presence不冒充模型有效性。General权限消费者真实committed409（b666fc7a-bc6c-433b-a28c-da2357ad53c3）经AppLog→POST/log落入后端原日志，安全诊断没有附带完整配置。中文新实例真实Global committed409（d350bbc3-8db3-496c-9e51-9b2686dc9187）保留已保存事实、当前语言摘要和原技术详情。

清理故障：初始Config200/Auth200后真实cleanup500（baf379af-8151-4e12-87f4-83fb4be9ca7e），独立GET200仍显示实际配置和凭据；原覆盖未清理的持久事实由探针核对。恢复文件权限后原行内入口再次接受并完成清理，2a60bf exit0。没有生产故障开关或浏览器响应拦截。

局部读取资格的实际结果修正前述预期：发布后Auth坏JSON也被初始runtime协调观察，因此初始响应实际为Global committed409（ed55b41a-bc1d-498c-9133-1f6b619685f1），不是200。随后三个公开GET均200，catalog返回明确auth.read issue；原loaderfulfilled结果的原resource/phase与初始协调问题同时显示，Key为unknown。35ea42 exit0保留完整响应与源事实。本case证明typed committed后fulfilled局部问题，不独立证明Config200和该局部故障的组合。恢复同一自有完整Auth及相邻models后，后续真实目录读取清除问题；临时成对副本在自有runtime实际退出后删除。

公共scope A/B/A已实际完成：原全局Save的Auth由原跨进程租约保持pending；Back→真实项目→New chat→全局Provider，同ID打开新草稿Owned protected returning draft。释放原Auth租约后，实际凭据generation从88a3cb76-37fc-4eb9-8954-f34b528f2769变为b42e298d-72bb-4078-9329-c91344485a69，原全局配置仍为已派发名称，新草稿与可编辑按钮保留。原租约21561 exit0，实际源探针08a6c1 exit0。此为真实全局/项目/全局及表单轮次资格，不宣称全部server authority或Task/Mission/Session恢复矩阵。

聚焦六个纯业务/服务测试文件79项、242个正向断言，原cadd0a exit0；agent精确四文件54项176断言，ba2d29 exit0。最初错误filter检索额外scratch同名文件导致d914ad exit1，精确./路径后重跑原合同；不是忽略失败。初次typecheck98939 exit2暴露新增helper的void迭代类型错误，修复后28960 exit0。Node最终build51722实际exit0；中途未等build目录生成的启动93108实际exit1/ENOENT原件保留，完成build后新实例9089才用于后态验收。

桌面原截图22张均由主agent实际查看，含2张前态、19张成功后态及1张失败超时资格；截图数量不作为验收门槛。英语/中文、项目/全局、分阶段错误、恢复、busy及返回草稿均有对应实页和持久事实。没有UI自动化测试。局部fixture不能替代这些实际交互；本批没有新增真实推理请求，因范围是保存回执/观察与诊断，沿用第11批4次真实gpt-6.1-sol流式交付记录，不把生成participant当作Sol。

自有前态23807实际exit0/PID85632；失败启动93108实际exit1/PID48688；最终9089实际exit0/PID81052。两个自有浏览器tab已关闭，原文件权限已恢复，18600–18603监听器实查为0；未操作用户实例。归档5c01e2 exit0保留原日志、脱敏HTTP事实、输入脚本、22张原图与明确失败。真实样例凭据逐字安全扫描为0，原完整Auth不入artifact。后续提交/上游同步/push回执由下一批Recall承接；未发布版本、tag或Release。

提交前当前HEAD复核：精确六文件bda798 exit0，仍79项242断言；types原session86481完成497837 exit0；docs5eba38 exit0（当前345 ops/26 groups，数量变化来自另行交付的API变更）。313cd9虽exit0却只跑5文件76项：本轮手输config-fail-fast而真实文件是config-service-fail-fast，Bun忽略缺席路径；发现后完整重跑正确六文件并保留两次原输出，不把exit0当作覆盖证明。最后归档208548 exit0，148个文本对象按真实生成样例字节扫描为0，首次成对副本删除收据未覆盖。
