# 通用文本写入的真实差异交付

## Recall

用户要求持续自主迭代整体体验和功能，只用单agent；不再排查已关闭的Rendering闪烁，实际体验后精确提交并正常推送，仅实际冲突才等待。598/599已分别以2850b9ea4、1666c857a推至main：原Office文件保存/下载、紧凑PDF和四文件摘要已实际验证。599为零模型请求的完整自有数据副本验收，已提前1123957ms公开关闭，原调用/物理/输出/请求均结清；累计真实Sol请求102。598提前关闭验收未达标及首轮原生batch、594连接失败根因未知仍保留。

开始HEAD95418d3d1是另一已授权CI会话的七测试修复，已正常推送，不与本轮业务源文件重叠；其完整三平台CI仍由该会话处理，不发送消息、不使用子agent。工作区无关旧产物删除、共享索引排序及历史Bun目录保留，无额外branch/worktree。用户18571和真实数据库不操作。

已重读599 Recall及02-data、04-extensions和07-panel相关契约；全仓搜索WriteTool/EditTool/ApplyPatchTool、metadata.diff/filediff、ConversationToolFileChange完整/延迟投影与前端comparison、CLI打印、FileTime全部调用点、File.writeText、Task原生/Capsule文件绑定、全局Tool目录和对应测试。成熟diff库与现行edit合同提供当前文本端点/行数原语，无新增框架或平行diff面。

## 修改前分析

可见现象：当前write文本分支实际写入成功，但仅返回filepath/exists。它已计算的diff局部变量被丢弃，完整前端normalizer无filediff可读；后端延迟投影又只在edit分支读取filediff。故修复附件的599没有解决普通文本write漏出摘要的问题。不能从filepath和输入内容推断历史before，更不能回填旧结果。

本轮将write在实际文本写入后读回真实after，返回现有diff/filediff合同及明确added/modified；现有完整/延迟投影同时支持该合同。前端保留filediff自身的明确status，既有edit缺status时继续其真实未声明状态。源码已有未使用diff改为真正交付，不增加第二比较算法；计数使用现有成熟diffLines。通用metadata已经是开放Tool结果，复用既有filediff字段，不改变持久schema8、旧消息、API类型或已交付迁移。

读取FileTime时同时发现：edit已使用当前实例的文件锁，而write未使用。为使本次真实before/write/after和文件事件保持同一写入范围，write接入同一个FileTime.withLock，并在获得锁后检查取消；二进制分支仍以wx提供跨进程新建冲突保护。

按共享并发机制立即横向审计：全局目录、CLI、Chat/Work/Task/Mission角色公开的三个内建写工具都引用同一定义；Task原生/Capsule通过executionFiles保留各自真实文件权属，并等待物理文件调用完成。FileTime状态按Project Instance隔离、Session读取记录独立，已有edit与本轮write共享同一进程内锁，finally释放覆盖错误和取消；服务器重启不恢复文件内存锁，不把它当作持久Task轮次或队列事实。单次和并行调用、同路径和多项目须有真实文件正向合同。没有Task/Mission/Session调度、唤醒、恢复或终态异常证据。

横向审计仍有边界：apply_patch的更新和GUI File.writeText使用不同的现有完整性机制，后者有实际revision和跨进程锁；外部程序/插件也不受FileTime约束。单凭当前代码不能证明所有跨入口竞争均安全。本轮不宣称统一修复全部文件并发，也不把进程内锁升级成跨进程承诺；这些路径需要另批真实运行追查，不能以此次写入成功排除。附件wx合同、旧编辑权限与数据/控制流均保持。

影响面为WriteTool完成结果、所有使用其全局定义的角色、完整/延迟Tool及Review摘要；文件输入、权限、事件身份、文本输出和原始内容保持。风险为输入字符串与实际UTF-8（Unicode转换格式8位）字节不一致、覆写错误的before、新建/修改状态丢失、延迟后丢观察以及并发事件跨越端点。本轮验收覆盖这些明确输出；旧历史缺端点和跨不同用户turn的多次写入不猜测合并。

## 实施与验收

1. 使用现有FileTime锁与filediff契约完成生产实现。聚焦正向测试验证实际新建、读后覆写、UTF-8真实读回、并行新建的当前读取前置错误、Task原生权属与完整/延迟三种transport入口。不得新增或运行UI自动化测试。
2. Node.js普通生产构建后由开发CLI `/ui`验收，完整复制已关闭599的自有数据库/附件并保留全部旧失败，不操作用户数据。新scope600最多12次真实流式gpt-6.1-sol请求，历史102次保留、累计上限114；凭据与完整模型目录成对准备，启动前分别确认凭据、模型投影和实际请求模型一致。不因观察超时扩额、重启或重置。
3. 原Chat自然请求用当前通用write保存一份真实三行中文验收说明，不创建Task/Mission/其他成员。核对实际Tool输入/结果、磁盘内容、摘要5份文件与新增说明的真实text diff；手动交互、截图并人工复核，不以DOM断言或模型自述冒充验收。
4. 20分钟原生物理边界不延长；本次在15分钟内公开关闭，并结清原调用、native/launcher/输出/请求后退休自有凭据与模型目录副本。更新架构/索引/证据，文档和必要后端合同检查后精确提交，fetch/merge、完整待推集合复核、正常hook与证书校验推送。

## Windows路径身份的真实复现（修复前）

对新文件Alias.txt/alias.txt并行调用同一真实WriteTool，原checker得到11通过/1失败：两次均声称added，第二次after甚至读到第一次内容。FileTime已尝试realpath，但新文件尚未存在，normalizePath只能保留原大小写，导致同一Windows实际文件获得两把锁；不是模型行为或UI问题。已保留原失败进程输出和原始调用68610，原进程退出1且物理/输出结清。

现行File.writeText的normalizeCanonicalPath已经按Windows不区分大小写的路径身份处理。本轮使FileTime的读取记录、get与写锁都对同一normalizePath结果使用Windows小写身份键；assert仍用真实规范路径做stat和错误展示。仅统一当前平台现有身份政策，不修改用户文件名或持久记录，不宣称约束外部程序和其它锁机制。已有fileTime所有调用点共用该键，覆盖新建/已存在、读后写、同/不同Session、普通/Task绑定和多项目，随后重跑原实际别名合同。

进一步全仓搜索找到现有`Filesystem.normalizeForCompare`，其已统一绝对路径、分隔符和Windows大小写。实际实施直接复用该原语与normalizePath，不复制第三份路径比较算法。

修复后另一次checker中，别名写入已形成正确的added→modified及真实内容链，但测试把Promise输入列表顺序当作实际到达锁的顺序，造成33通过/1失败。现行权限/路径检查是异步的，不承诺调用列表先后；正向合同改为恰有一次added/modified、完整实际新内容集合、前后端点连续及磁盘最终字节与最后观察一致，同路径与跨write/edit用例也遵循实际顺序。未改变生产锁来迎合测试，原始两次added的失败仍由当前断言捕获。最终34项通过、110次断言。

## 实际交付与收尾

普通Node生产构建为main-BXg7TeEn.js，当前后端typecheck与docs:check（350操作/26分组）通过。聚焦三文件34项/110断言通过，覆盖真实Task文件绑定、新建/覆写、UTF-8实际字节、不同Session并发的当前读取前置错误、等待后取消、多项目、write/edit共同锁和Windows大小写别名。最初12项中11通过/1失败的原始别名复现保留，不用后续成功覆盖。

scope600完整复制已关闭599的自有92表及56份附件/sidecar，Provider凭据与完整模型目录成对准备。正式业务前预检证明OAuth可用、模型已投影且实际gpt-6.1-sol流式请求匹配。第一次业务请求在实际流中收到`AI_StreamProviderError: Our servers are currently overloaded. Please try again later.`，没有执行写入；该助手错误、原用户请求和原截图完整保留。未改本地retry策略或宣称修复上游容量。

在原Chat自然发送续跑请求后，模型实际read目录、write指定三行文本并read回3行，最终真实stop/completed。未脚本代写业务文件、构造生产消息或清除失败。独立只读验证127字节UTF-8内容、末尾换行及filediff.before为空、after等于真实文件、added/+3/-0；原MD/CSV与最初实际patch输入一致，原DOCX/XLSX与canonical源精确字节一致。旧message/part/Tool request/outcome/Artifact逐行保持，Task/root ingress/task plan事实保持，schema8、integrity ok。

实际页面281已人工查看：摘要5文件、新文本+3/-0，从该行进入Review展示Added和完整三行正文，原Office二进制语义及文本行数保持。第一次截图因展开后底部部分被固定composer遮住，实际点击Scroll to bottom重新截图；Review调整宽度后重新查看完整正文，不修改图片或以DOM断言代替视觉。三张实际截图和结构证据落对应产物目录。

总计9次真实请求（含预检、失败及后台调用）全部物理reader结清，HTTP200/EOF仅作为传输事实；业务以失败记录与最终stop/实际Tool/真实文件分别判定。累计111次、未用3次退休，上限未重置或扩大。13:28:05UTC公开shutdown200，原调用47658已收集exit0，native/launcher退出0，物理/输出/请求清理及精确进程链结清，预留533287ms大于300000ms；随后删除自有auth/models副本，源Auth stat与完整模型目录保持。自建页面281关闭，用户18571和真实数据库未操作。

仍需后续真实追查的共享机制边界是apply_patch、GUI及外部写入器之间的竞争，不能用本轮同实例write/edit通过排除；历史缺端点的文本write也不重建。598提前关闭失败、原生首轮batch未知原因和594连接失败仍保留，持续Goal active。准备脚本曾因重复创建已准备的helper停止，未启动服务；核对已有自有DB/附件后只补齐剩余准备步骤，未重复复制、重启或重置真实请求。
