# 模型推理选项投影实验与回归合同

## Recall

持续单agent，用户后续明确单agent要求覆盖旧goal中的Astra文案，不委托。上一轮为progress：060c9d58691fd28552b7e4ebb39d5ddf2caf52a5已正常提交、fetch/merge、全部待推集合复核、完整hook push、fresh fetch HEAD=origin/main。51正向用例/149断言、2 POSIX skip；真实HTTP子项目与父仓库配置隔离通过。完整88 Project性能cold13158.709ms/restore12379.774ms，25个真实并发GET最长10041ms；原10s/5s/20s门槛仍为failed/failed/passed。补充HTTP后保留全部89项目/schema2及450父Git/普通child fixture，未清库。全部450原服务/检查句柄与临时auth/models配对已结算退休。开始只有既有.bun/与packages/opencorvus/bun/未跟踪。

继续已应用benchmark-debug-template（基准测试调试模板），不改原指标、不减少Project、不增加跨调用缓存或物理索引、不跳过初次/准入身份观察、不改schema，不创建branch/worktree，不运行UI自动化，不操作用户18571及用户窗口/进程。非UI改动须正向合同，真实页面仍用独立开发/ui、截图与人工复核；真实模型仅沿已授权完整auth/models配对并核对实际gpt-6.1-sol流。任何本轮修改均须范围提交、同步upstream并正常push。

## 修改前分析与影响边界

已读450 Recall/当前原阶段、Project.sameFilesystemLocation/filesystemObservation/findExactWorktreeRow/fromDirectory/identify、05-config与task-runtime-directory、ProjectDirectoryAdmission、全部公共物理谓词调用点、既有wide inode/真实hardlink/替换/alias/duplicate测试。补读438 project-identity-observation、439 physical-identity-scan、443 native-git-cost历史：扫描并行曾未获完整收益，439还暴露并已另行修复MCP/能力初始化锁序环；不重新引入那些已删除实验。共享owner与Task/Mission/Session轮次不在本轮改变；若出现新队列/恢复异常，按全部生产入口、正常终态、重试重启、串并行和多项目横审。

当前可证：450 cold的172次lookup累计32410ms、restore168次累计28324ms，包含并发重叠，不能直接当墙钟。每次lookup完整扫描当前registry，target观察仅在本次scan惰性复用；每个peer比较先正规路径，再realpath，再bigint device/inode。公共谓词同时用于Git路径展示、marker归属、注册重校验和identity-convergence；错误、alias/hardlink、宽inode和跨调用新观察都不能因性能而改变。

排除无证据方案：Node官方说明canonical pathname不唯一，hardlink/bind mount可有不同真实路径；不能只以realpath差异判断不同对象。当前directory occurrence允许inode字符串0，不能假定全部支持强inode并删除真实路径规则。stat-first、全局缓存、已注册主目录跳过Git、单纯并行扫描均尚无本轮安全/总性能证据，不实施。既有注册与schema数据保持，无旧协议/兼容层可保留。

本轮先测一个不改变语义的可能因素：当前fs/promises.realpath/stat与标准异步callback/native API在已安装Bun1.4.0、Node上的实际开销。查阅[Node22文件系统官方文档](https://nodejs.org/docs/latest-v22.x/api/fs.html#fsrealpathnativepath-options-callback)：native接口是异步系统realpath；Promise与callback版本仍须核对真实输出和错误，不能凭文档的性能建议宣称本机改善。

## 实施前方案

1. 仅自有scratch诊断，不改生产代码：在450原native完全结算后，直接只读SQLite读取完整89个注册路径，不调用生产DB initializer。统计实际realpath/stat读结果与耗时，比较fs/promises、promisify标准callback和native callback，在当前Bun及Node实际运行。所有接受的操作完整结算，原错误类型/code保存，输入包含原目录、真实junction、真实hardlink、缺失路径，正向输出归类保持。诊断只证明底层成本，不冒充完整Config或UI验收，不复制凭据。
2. 如新调用有可靠等价输出且稳定收益，再补充实现影响/错误/平台合同并落盘后修改；保留一个当前实现、原path→realpath→bigint判定顺序、每次新观察、初次/准入完整检查。没有证据就不留下生产替代路径或纯性能复杂度，继续追查更大的原生启动成本。
3. 真正生产改动后需原checker正向回归物理身份/Project Git/identity convergence/目录准入/全局候选等相关合同、类型/文档/OpenAPI检查；以450完整历史结果为before，新自有native服务真实模型预检、原保存恢复和全部并发GET、手动页面截图后才做整体判断。各原句柄和物理/输出/请求结算后退休配对。
4. 所有证据按精确新artifact目录归档并扫描实际敏感值，更新索引与必要当前架构，正常提交、fetch/merge/待推集合审查和push。未达到原保存目标则继续根因调查，goal保持active，不因局部测量通过而完成。

## 底层调用实测与下一步诊断

原450 exact Host/Target再次观察均dead_or_reused后，只读读取89个Project/89个目录，schema2；创建本轮真实junction/hardlink/missing fixture，无凭据复制或生产初始化。Bun1.4.0与Node25.7.0两进程均完整exit0，每组470次真实操作，交错两轮，concurrency1/12。当前Promise realpath在Bun并发12下16.20/17.47ms，native callback16.79/16.16ms；标准callback60.98/59.27ms，较慢。stat两种接口亦接近。native在Bun缺失路径的syscall为realpath，原Promise为lstat，Node的映射又不同。没有稳定收益或完全相同错误证据，生产API保持原实现；不以更换调用形式宣称优化。

新读Provider当前buildState/fromModelsDevProvider和model-reference-validation：源models.json为9155406字节；每个配置投影先转换完整目录，再选择活跃Provider和构建模型引用。445已修复四处字段引用污染，现有转换保持独立可变投影，不能为了减少分配而共享可变Models。完整保存CPU历史仍有Provider投影样本；模型对象分配/垃圾回收是否放大native spawn同步时间未知。

下一步只做同进程因果诊断：自有OPENCORVUS_HOME，调用原公开纯转换函数，记录完整目录投影耗时/只含数量的heap统计；交错测原446 release helper的无子进程--detached-capability查询，在分配/持有投影与释放后分别记录同步spawn及真实close/输出。所有原叶子句柄结算，不创建服务、Provider请求或复制凭据，不写原QA Project marker/DB；该诊断不能冒充实际ProcessFacade/完整配置验收。若分配无影响，排除该假设并继续原生启动调查，不新增懒投影、缓存或worker协议。

## Provider转换诊断与实施前补充方案

第一次叶子查询已close0后，scratch错误使用protocol_version断言，真实合同字段为protocol。原probe明确exit1，保留失败日志并修正后重跑原测量，未重启服务或遗留子进程。成功probe120个原叶子均close0/输出结算：持有1–8份投影时通常spawn7.76–8.25ms，baseline8.48ms，两次单样本71/72ms抖动不足以证明持续内存因果；释放后7.81ms。不能声称已证明分配导致原生启动慢。

另有明确实际CPU工作：原完整目录每次投影227 Providers/8162有效Models，8轮交错叶子后转换87.18–101.31ms。源8423个模型的options全部为空record，261个deprecated被原转换排除；当前却对每个有效模型调用structuredClone({})。同进程纯转换交错临时拦截并完整比较所有投影值：首次78.76→34.15ms，热轮20–26ms差异不稳定，JIT（Just-In-Time，即时编译）/拦截影响未知，不能作为实际提速结论。

选择只验证并移除空record的冗余序列化，不引入懒模型、冻结source、跨项目共享或缩减模型集合。影响已全仓核对：fromModelsDevProvider生产仅buildState，公开转换测试及所有当前模型输入映射共享fromModelsDevModel；catalog、Project/global模型验证、插件与custom loader均保持完整Info和独立可变metadata。ModelsDev.Model schema的options为record、默认{}；JSON目录为空时直接分配一个新{}与原structuredClone空record输出相同；非空声明继续原structuredClone，嵌套隔离/错误保持。runtime config函数不经过该目录边界。无路由、配置、schema/数据、队列、Task/Mission/Session执行合同变化。

实施：唯一options表达式对空record创建新对象，非空仍标准深复制；新增正向明确值合同覆盖两个空默认投影各自写入不同值、第三投影和source的明确默认值，复用原真实插件/两Project/global以及模型成本/状态/variants/Provider缓存合同。先类型/格式及聚焦测试，再不拦截全局函数重跑原纯转换测量，最终新native全历史服务与原10s/5s/20s完整checker。如果实测未改善，按精确本轮差异撤回性能实验，不以无收益代码复杂度交付；实际成本证据仍保留，goal继续。

## 空record实验结算及最终实施前方案

原90项目18701完整实验cold14397.131/restore12797.325ms，均200且完整canonical恢复，没有稳定整体改善；原56915 native launcher和56856 checker均joined0，公开shutdown200，原physical/output/request及runtime配对结算，直接readonly库为schema2/90项目。类型63139及Provider四文件78076亦joined0。按方案精确撤回唯一options条件表达式，保留正向空默认独立值合同作为现有ownership覆盖，不将实验称为提速。

继续核对实际转换函数发现：fromModelsDevModel对整个目录立即调用ProviderTransform.variants，随后buildState又对活跃Provider的模型按最终config重算。前者还服务目录/插件读取，不能直接删掉或缩减Models。全仓variants仅三处生产调用均在provider.ts；原函数读取id、api.id/npm、capabilities.reasoning、limit.output、release_date六组原始字段，均由ModelsDev已校验JSON构造，没有插件回调、I/O或运行时函数。调用者/错误/来源合同已读，当前Info与Model schema仍要求完整可枚举的variants record。

最终方案是在同一个已有Model对象上延后生成初始variants：非reasoning维持原新{}；reasoning模型捕获上述原始字段的独立小snapshot。将variants设为可枚举可写语义的getter/setter，首次读取沿唯一ProviderTransform.variants计算并在原对象替换成普通可写data property；提前赋值则直接替换，原活跃Provider重算仍按最终配置立即执行。只捕获原始值，保持修改model字段前后与原eager初始variants相同；不借用可变source，不冻结插件输入，不增加跨项目cache、Provider过滤或另一个计算算法。定义最小VariantInput类型，由TypeScript约束计算与snapshot的字段契约，避免将来新增依赖未同步捕获。

验证：正向合同覆盖字段变更前的初始选项snapshot、独立可变variants、提前赋值、真实JSON/structuredClone输出和原插件作用域；原成本/状态/自定义loader/缓存以及全局候选继续回归。先私有保存当前227 Provider/8162 Model的完整6289750字节投影值，改后实际序列化深比较全部字段（不用摘要或源码哈希）。再实际纯转换计时和最终新18703 native全90+历史、精确gpt-6.1-sol流式预检、原完整checker及手动截图。全部原门槛保持，source/UI/schema/协议范围不扩大。

getter复核发现，首次读取时替换own property会使插件冻结/密封DTO后的正常读取失败。实施前将其收敛为该字段唯一的本地值和已初始化标记：读取首次计算并保留，赋值设置同一值；冻结对象的赋值按原data property返回TypeError，密封但可写的对象仍能赋值。这样读取不修改DTO的property descriptor，保留JSON、structuredClone、冻结读取和密封写入；没有额外全局模型表或第二计算实现。

## 最终实测与实施裁决

第二个完整实验（18703，91个保留历史Project）cold12973.354ms、restore12765.218ms；两次HTTP200、完整canonical还原、全部页面GET有完成结果。与已交付450的88项目13158.709/12379.774ms以及第一个90项目14397.131/12797.325ms不能视为同负载严密因果对比；真实页面到达时间、项目数及系统抖动均不同。原10s/5s门槛仍失败，不能宣称解决。局部完整目录构造39.401ms→11.243–21.688ms，六轮227 Provider/8162 Model全字段序列化值逐项一致；但基线序列化计时包含保存，实验包含parse，二者不直接比较。局部收益未转化为稳定完整保存改善。

因此按既定无收益撤回规则，审查本轮两份生产源码的全部差异后精确恢复provider.ts和transform.ts；也撤回后者纯格式变化。最终交付保留原即时计算、原options深复制、原字段descriptor和公共类型，不落地getter、额外状态、快照类型或替代API。当前架构契约没有变化，不更改06-provider架构。四个新正向用例保留，约束当前既有行为：空默认值各投影独立、推理默认与源字段时间关系、可写值JSON/structuredClone和冻结读取/密封写入。它们是现有纯转换及真实插件合同的补充，不冒充性能修复或UI验收。

实验最终页已通过真实浏览器交互和人工截图复核：Goal创建入口、实际OK回复、精确openai/gpt-6.1-sol和Ask可见；本轮没有UI源码变化。两次实验均为已授权完整auth/models配对，预检分别确认凭据可用、目录已投影、实际精确模型和streaming=true。只操作本轮自有页面/服务；用户18571未操作。

18703公开shutdown200，原native launcher49096 joined exit0；生产ProcessFacade/ProcessSupervisor记录terminal exit0、physicalCompletion/outputDrainComplete/requestCleanupComplete均true，host/target精确实例再次观察dead_or_reused后退休runtime配对。原checker11479的最终工具输出在上下文截断中已消费，之后轮询返回Unknown process id；不捏造其数值exit code。其原最终canonical-write-final.json及write-final.log均已产出，accepted/restored=true、failures=[]，本轮将此作为明确行为完成证据并记录句柄观察限制。18701原checker56856与native56915已joined0。最终直接readonly SQLite为schema2/91项目；未初始化或迁移用户数据库，保留完整历史。当前生产代码已恢复已交付450源码，重新运行保留代码的七文件正向合同，而不是把实验检查日志当作最终代码验收。

原保存目标仍未达成，持续goal保持active。下一轮继续以完整保存实际阶段调查，物理API替换、Provider空记录优化及推理选项懒计算均已用本轮证据排除为可交付解法；禁止重新以同一局部数据宣称性能修复。

最终保留代码原runner44832 joined exit0，七文件38个正向用例/129断言/0skip；格式检查exit0。两个实验从启动到测量冻结之间的全部原GET分别73/117个，均200，最长10112/10370ms，原20s页面门槛通过。归档位于[模型投影实验与回归合同](../../artifacts/2026-10-20-model-variant-projection/README.md)，原大catalog/全投影/dev日志不入仓。扫描实际敏感值后，原授权metadata未变、完整catalog与源值相同，精确退休本轮私有auth/models配对。
