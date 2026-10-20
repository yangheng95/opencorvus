# 配置验证的物理路径读取成本

## Recall

持续单开发 agent，不委托；用户后续单 agent 要求覆盖长期 Goal 中已过时的三 Astra 文本。482为 progress：6f1604f396acf1ec8122bb2cc8c7f68c5ae21b12已正常推送，fresh fetch后HEAD=origin/main；Sources关开/调宽跳动根因修复、28张人工实图、10/12发现批和4/6独立Sol修复批全部原source EOF及native/output/request/launcher结算，runtime/private完整auth/models退休，源不变。当前仅原.bun/与packages/opencorvus/bun/未跟踪。单主会话网页来源资格不扩大为成员或SideChat网页流资格。

用户要求持续实际体验、查根因、修复并提交推送。完整配置保存≤10000ms、恢复≤5000ms、四类并发读取≤20000ms仍未达整体目标；478的完整149目录两轮保存17302/16874、恢复17259/16332ms，读取通过。该问题不能用新小数据根或局部速度代替。沿用已读benchmark-debug-template与内置浏览器；不运行或增加UI（User Interface，用户界面）自动化，不操作用户18571/用户进程/用户数据库，不创建分支或工作树。

已读474/475/478 Recall与实际phase、05-config、Project.fromDirectory/scanExactWorktreeRows/capturePhysicalRegistrationAuthority、目录接纳key/keySync、Config全目录candidate、Provider/Skill当前投影和Windows监管。全仓定义/调用搜索显示初始与admitted分别实际Git，目标惰性物理观察只在单次scan内；物理注册capture/revalidate分别解析全注册目录，不能省略。历史已排除简单扫描并发、线程数、内部Git路径、FFI（Foreign Function Interface，外部函数接口）绑定与Bun/Node叶子切换、日志等级、创建标志等方案，不重复这些实验或增加身份缓存。

## 修改前分析与未知

原478 HTTP（Hypertext Transfer Protocol，超文本传输协议）PATCH部分更新请求窗口290条原Git调用，Git phase累计107584ms、lookup累计32833ms，含12并行项目与并发读取，均不是墙钟或CPU（Central Processing Unit，中央处理器）独占时间。实际源码仍每个身份lookup逐行stat，而物理注册两次逐行realpath；这些I/O（Input/Output，输入输出）与native请求文件/ready/settled共享运行时文件系统。当前没有证据把17秒全归因原生spawn，或把43k级物理查询删掉。

本轮新可证伪点：当前锁定运行时中，成熟Node.js文件系统API（Application Programming Interface，应用程序接口）的Promise realpath和原生callback realpath是否有可测差异、语义是否完全一致。目录接纳同步事务已经使用realpathSync.native，异步key使用fs.promises.realpath；不能仅凭native命名假定更快，也不能直接改成同步调用阻塞事件循环。若同一底层或收益不稳定，明确排除，不交付重复实现。初始/admitted、身份别名/硬链接、缺失目录祖先、错误原对象及所有跨进程注册/删除保护保持。

## 实施前方案

1. 对既有自有QA根只读读取149 Project/198 Session/schema3及全目录列表；不加载生产数据库initializer、不修改旧数据。新483 scratch只存安全计数、相对身份和时段，不复制凭据，不创建Provider请求。
2. 先核对锁定Bun与Node的官方API语义及本地实现表面，再在同一完整实际目录集上交错测Promise与promisified native callback；全部路径逐项比较原始输出与实际目录身份，覆盖同目录别名、missing与非目录输入的明确错误。只观察，不新增生产文件系统实现；保留原异步语义。记录真实执行句柄和自然终态，超时不认作退出或重启。
3. 局部探针不冒充完整配置/UI资格。若不支持新方向，保留排除证据并继续关键路径；若支持，先补完整定义/调用、公共合同、错误/数据/测试/交付风险分析再实施唯一成熟API调用，删除被替换读取路径，不能跨准入保存旧物理事实。非UI改动必须有聚焦正向合同。
4. 只有生产修复成立才启动当前正式482 UI/源码CLI（Command Line Interface，命令行界面）独立服务，用全部当前原目录、完整canonical前快照、原production Config service→HostTransport→公开HTTP（Hypertext Transfer Protocol，超文本传输协议）checker/四读取与10s/5s/20s原指标验收，实际内置页面截图人工复核。若需要真实Provider，启动前另行固定预算、完整auth/models成对并分别验证凭据/精确模型/实际Sol请求，原请求/native全部结算后成对退休；此时尚无新模型额度或凭据副本。
5. 实际发现调度/队列/恢复/终态异常立即横审全部Host/Task/Mission/Session occurrence、正常终态、重试重启、串并行和多Project。保持schema与用户数据。归档真实事实、三个索引、当前docs/architecture检查、范围提交、fresh fetch/merge/完整pending审查/正常push；长期Goal保持active。

## 局部实际证据与混合负载诊断（启动前）

只读当前QA实际149 Project/198 Session/schema3。第一工具不慎使用PATH里的Bun1.4.3，在缺失路径的syscall差异断言处exit1、未进入性能轮；保留原失败日志，没有改产品或重启活跃任务。随后明确使用当前正式482冻结的Bun1.4.0及Node25.7.0，独立新scope执行原全149²=22201次/轮，顺序Promise/native/native/Promise，两个原句柄均自然exit0。Bun为910.422/812.540/767.303/764.890ms，Node为917.526/832.830/817.161/852.546ms；同一轮所有原项目输出逐项相同。新建目录、junction和大小写路径结果相同，Bun missing与non-directory的原错误均ENOENT但syscall为lstat/realpath，Node两API全部观察相同。没有稳定大幅收益，不替换生产API。

已查官方[Node Promise realpath](https://nodejs.org/api/fs.html#fspromisesrealpathpath-options)、[native callback](https://nodejs.org/api/fs.html#fsrealpathnativepath-options-callback)与锁定[Bun1.4.0 Promise实现](https://raw.githubusercontent.com/oven-sh/bun/bun-v1.4.0/src/js/node/fs.promises.ts)/[callback实现](https://raw.githubusercontent.com/oven-sh/bun/bun-v1.4.0/src/js/node/fs.ts)；实现表面不同不等于实际提速。只读取API源码和计时，不能据名字或单轮约0.1秒差距宣称根因。

接下来在新483-data克隆完整原数据库与完整canonical；原QA只读、保留所有原项目/会话/归属，原项目真实目录继续作为全量验证对象，不能缩小为新根。服务使用当前正式482 UI/源码CLI18841、原413 owned-host/446 release监管20分钟。原始源/克隆的所有行事实和来源基线在启动前冻结；项目本来需要的身份复核仍发生在实际原目录，记录任何原目录写入，不将“克隆数据库”误称全部磁盘复制。

新独立混合负载scope固定最多4次真实Sol请求，包含两次实际预检及所有辅助；不发业务模型输入/Goal/成员任务。完整private/runtime auth/models成对、当前凭据与精确投影及实际gpt-6.1-sol预检分别核对，禁止refresh/exchange/源写入。新诊断preload仅pass-through观察原fs.promises调用和原spawn同步进入/返回，保留参数、原promise/输出/错误，不消费stdout、不记录文件内容、环境、凭据或请求正文；时段与原HTTP request ID在最终原日志关联。观察所有文件系统操作的开销须标明，不把该scope计时当无探针性能资格。

原production完整checker执行一次保存/完整恢复与四并发read，真实IAB设置等待/恢复截图人工查看。目标是比较真实混合负载下原文件系统等待、native同步启动、read/ready/cleanup与候选各阶段的区间和重叠，不相加当CPU或墙钟，不改变全量候选、队列、身份、原10s/5s/20s阈值。如果无支持修复的新因果证据，不修改生产。原scope自然完成后公开shutdown，原句柄/物理/output/request/launcher及所有reader/writer与原source EOF结算，完整runtime/private对按实际值检查后退休，关闭自有页；源日志冻结后才允许后续scope。

## 混合负载实际结果与后续裁决

首个工具保留完整canonical但继承了482空对象断言，在安装Provider audit前退出1、0模型请求；随后Copy-Item遇到尚不存在的日志也失败。原工具806405 exit1、原native 66088/84092精确出生时间与physical/output/request均已结算，完整runtime对退休。工具修为比较冻结的完整原canonical，并仅在日志存在时复制，避免遮蔽原退出；再启动全新final occurrence，不是观察超时重启。失败没有进入生产CLI、没有修改旧源库。private完整对为同一已声明固定4次诊断保留，未重拷或扩额。

final原52880/18841、writer93366、reader33574全部exit0。整批实际2/4（真实credential/catalog/model预检及全部辅助），全部gpt-6.1-sol、流式200、原source EOF，无业务输入/成员/Goal；未用2次退休。原production Config checker保存18568.5697、恢复18440.2292ms，完整canonical/Ask恢复；四read最长18674.1227ms，全部200、227 Provider/8133模型。原10秒/5秒失败、20秒读取通过；探针/新增2项目与历史条件不同，不能将此计时作为相对退化/提升比例。02在第一次真实PATCH区间显示Loading，03显示已加载227目录与Connected OpenAI，04显示完整恢复Ask；4张实际截图都人工查看，没有UI源码或UI自动化变更。

263352次原文件系统观察、896次原spawn完整记录。保存窗口294次同步spawn并集6909.7491ms，恢复292次并集6516.3270ms；分别有45436/45129次原目录realpath及44696/44394次stat。一个261.0713ms stat区间与260.6553ms同步spawn重叠，恢复的260.7361ms原request readFile区间与260.0186ms同步spawn重叠。这是具体的同一事件循环重叠证据，原异步完成观察包含主线程执行不可用时段；没有内核完成时间，不能把重叠全部称作纯磁盘或精确CPU时间。累积realpath259361ms更不能当18秒请求的排他耗时。原registry capture/revalidate仍只是部分阶段，已有lookup扫描并发实验不重做；局部native callback交错结果也不支持替换。

新证据收敛下一关键点为原ChildProcess helper同步启动与异步文件/marker完成的耦合，不能只继续缩减文件读取。475已经排除“整个Process移一个/三个工作线程”的简单吞吐方案，仍不得直接交付该探针；若要改变启动时序，必须先明确同一物理父PID/birth/runtime occurrence、原Job/stdio背压/取消/ready/错误/重启和shutdown全部生产合同及真实整体收益，不能引入另一身份源、缓存或仅为配置绕过监管。本轮没有足够交付该架构变化的证据，因此生产保持唯一现有实现，性能未解决项继续保留。

源QA七表3665行再次逐项完全相同（含所有原rowid/data/time），源库size/mtime保持；副本所有原Project身份/归属和Message/Part/Session/Tool/protocol事实同样保留，changedProjectFields为空。当前151 Project/199 Session/520 Message/1159 Part/1411 protocol/119 request/119 outcome/schema3，完整原parsed canonical恢复；原目录写入观察为空。副本包括完整数据库与配置，原项目目录仍用于真实验证，没有虚称全部磁盘复制。用户18571、用户进程和用户数据库未操作。

公开shutdown200，原52880 join0与物理/output/request/launcher结算后完整runtime对退休；清理打印分母残留6已修正，原audit与receipt始终max4/actual2。1377文件/167067231字节经5个实际秘密值检查clear，三个自有空junction逐一验证避免重复扫描；完整private auth/models退休，源credential metadata不变、无refresh/exchange/源写入，完整private模型目录与源逐字节相同。自有50页关闭。[实际汇总与四张人工图](../../artifacts/2026-10-21-config-physical-path-cost/README.md)同步三索引；本轮无生产/架构/schema变更，真实性能仍未达到，长期Goal保持active。
