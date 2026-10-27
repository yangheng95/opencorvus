# 当前原生依赖告警复核

## Recall

用户要求持续单代理自主体验与修复、真实验收、范围提交和正常推送，直到明确停止；不使用子代理。上批为progress（实际进展）：54b530d5ed456d47be87bb79f3686598d61bf1bd已正常推送main，2026-10-27T22:06:16Z新fetch/merge后0/0，本任务文件干净，176项外部改动保留。成果JSON/CSV/Sources/下载/独立工作区实页已验证，共享qs6.16.1依赖修复21项/26断言通过，npm只读报告为空。747原进程及输出/请求/launcher已全部结清，92表91300旧行保持、schema9，无认证副本/真实模型调用，累计模型726。

本批先兑现剩余原生告警核查，不能沿用2026-10-05的旧审计或把npm空报告扩大为全生态无告警。随后根据真实证据选择可修复的父依赖或其他产品路径，不重查已修复的闪烁。无需用户逐步确认；不新建分支/工作树，不操作用户18571、窗口、进程、数据库或认证。旧Goal的多人文案由后续单代理指令覆盖。

## 已读与全仓检索

已读上批Recall、当前两个Cargo manifest/lock、原依赖修复记录及quickxml-rustsec-audit-02原纠正说明、现有check-rust-dependencies唯一正式检查器入口、cargo-audit本地help、官方README与glib/rand公告。cargo-audit0.22.2的既有安装位于自有忽略目录，可复用，无需重新安装。当前cargo/rustc1.98.1；历史审计曾因JSON静默忽略registry初始化失败而遗漏yank平面，因此本批必须同时保留正常terminal输出与JSON，验证当前真实registry更新。

锁文件当前直接观察到glib0.18.5和rand0.7.3/0.8.6/0.9.4；公告分别将glib修复点列为0.20.0，rand列为0.8.6/0.9.3/0.10.1。0.8.6与0.9.4不按名称误报。历史父链指向GTK与PHF/selectors/kuchikiki，但当前链及当前可用父版本仍待真实检查。0.1.27历史发布记录说明另两项GitHub告警来自历史取证lock，当前push仍报4项；这是线索而非本批已回读的当前远端告警清单。不使用额外GitHub凭据，也不删除原历史证据以消除告警。

## 实施前分析与执行边界

可观察现象为正常push仍报2 moderate（中等严重度）/2 low（低严重度），直接命中与控制流根因尚待当前完整报告。只有实际包版本、父节点/feature和原生消费代码可证明影响，标题/历史结论不能替代。先审计，不预先改Cargo依赖或应用实现。

1. 复用官方cargo-audit，使用独立空HOME、CARGO_HOME及公开sparse registry，显式绑定已安装Cargo绝对路径；显式--file读取两个现有锁，从仓库外的自有工作目录运行，避免生成锁或读取用户Cargo认证/配置。新RustSec数据库存于本批自有目录，允许正常fetch，不使用ignore、target/severity/category、no-fetch、stale或no-yanked过滤。
2. 原检查运行器控制真实进程和180秒无输出超时；每次保留独立stdout/stderr、开始/结束、退出码、精确参数和原锁字节一致性。分别运行terminal及JSON；退出0可能仍有unsound/unmaintained/yanked警告，必须读取完整类别。数据库与registry更新若失败，先修工具链后重跑原完整验收，不冒称干净。
3. 当前生产定义/调用/同语义、父约束、平台/feature、公共合同、数据、测试、文档、交付和风险在真实修复前补齐；接口/数据schema/调度未触及则明确排除。涉及调度、恢复或终态异常则立即按共享机制横审，不以用例或模型行为降级。
4. 任何依赖替换保持唯一事实源，优先成熟兼容父版本，禁止伪装包身份、隐藏告警或新增fallback。聚焦正向合同须进入原正式checker；UI若改动必须普通构建、新隔离开发/ui、当前代理实际交互截图人工复核，不运行UI自动化。新文档/证据同步三索引、当前docs检查、范围提交、fresh上游合并/完整待推集合审查及正常push，无Release/tag/PR。

## 当前结果

当前cargo-audit0.22.2确已执行：新数据库99670cfc0bc574433034b75876a4b791ccaa2efb，1380条公告。Overlay615依赖命中9漏洞/15警告；Supervisor22依赖为0。最初Overlay JSON及一次terminal遇到registry超时，保留原件，随后同一公开缓存上的完整JSON registry-recheck与完整terminal current-complete均正常更新registry且没有查询失败，结论一致；所有原锁字节保持。不能用最初部分registry结果宣称完成。

## 修改前根因、调用链与完整影响

- 四项rustls公告RUSTSEC-2026-0346至0349：0.23.45的会话Debug暴露秘密、ECH（Encrypted Client Hello，加密客户端问候）拒绝后的缓冲应用数据处理、Brotli预认证分配以及未认证ServerHello影响后续密钥交换提示。官方0.23.46统一修复。实际父链为hyper-rustls/reqwest/rustls-platform-verifier/tauri-plugin-updater/tokio-rustls；当前原生功能确有更新HTTP及TLS消费者，但各可选攻击条件不能仅凭版本声称已触发。
- rustls-webpki0.103.14及webpki-root-certs1.0.9命中RUSTSEC-2026-0382/0383，分别由证书路径接受已撤信任emSign中间密钥与打包根证书列表保留相关根引起；官方修复为0.103.16和1.0.10以上，选择当前正常发布0.103.16/1.0.11。平台证书实现与交叉平台根包需区分，Windows握手不冒充Android/Unix证书执行。
- 三项ZIP公告RUSTSEC-2026-0367至0369影响zip4.6.1的解压权限/符号链接合同，修复9以上。当前唯一父为updater2.12.0；已读取真实原生main.rs的check→download→prepared bytes→install，以及上游download中的minisign验证和extract_zip的真实ZipArchive::extract调用。应用只保存已下载验证的原包，网络攻击条件与签名边界保留；库版本问题仍需修复，不能只以签名降低处理。
- 公开registry实际发布updater2.14.0仍要求zip^4；当前上游v2源码同名版本已改zip9，不能只按版本名冒认发布内容。未认证公共GitHub API给出真正修复提交ba98bfadc4c868c9a7e1a226c83af528e1f11b89（2026-10-16，PR3698），只改ZIP主版本声明/对应锁/变更说明。已经按该不可变SHA读取完整updater与workspace manifest、配置和实现。该提交不含后来的base64/rand改动，要求Tauri^2.12、Rust1.90，当前编译器1.98.1满足。选择该官方精确Git来源，替换唯一原updater依赖；不复制私有库实现、不伪装ZIP版本、不新增后备源或关闭ZIP能力。Git供应源成为显式交付依赖，完整锁与native验收必须绑定此来源。
- 新增Tokio1.50.0的RUSTSEC-2026-0386为Unix AsyncFd安全接口合同，官方1.51.6或1.53.3以上修复。选择较近的1.51.6分支；当前父均允许^1。其新unsafe注册API与旧构造器弃用由上游持有，不修改应用流程。实际WindowsTCP正向验收不能冒充Unix AsyncFd内存安全实验。
- 其余glib0.18.5/rand0.7.3、十项维护警告、clipboard-win5.4.1与uds_windows1.2.0的yank继续按实际报告保留，不用过滤消除。所有直接父节点与公开registry元数据已保存；这批首先落实已证明的9项漏洞和Tokio合同修复，整体持续目标并未缩减或完成。

旧路径未根治原因：上次原生完整审计为2026-10-05，当前这些公告与修复大多在之后发布；旧Windows应用能构建并不能证明之后的交叉平台依赖安全。正式checker固定旧补丁包身份，必须与新的唯一锁同步，不能继续声称其patched命名足以证明当前没有新漏洞。

全仓定义/调用与契约：native updater调用集中在main.rs，前端通过现有三个本地更新命令，准备状态只存真实Update和已验证bytes；本批不改命令、公开路由/SDK/OpenAPI、更新签名策略或数据库。原生Cargo清单与锁是唯一依赖事实；普通Node前端/后端构建、版本化迁移检查与packaged first-run仍按原完整build:overlay执行。schema与用户持久格式无变更，不运行用户进程或安装更新。调度/队列/恢复未发现异常，本批不改其合同。

## 落地方案与验收

1. 保存当前清单/锁/正式checker/fixture差异与原件，在新自有公开Cargo目录复制此前已有无认证缓存；旧缓存与旧结果保持。显式Git公共配置禁用凭据提示，正常TLS验证，来源固定上述官方提交，不读取用户Git/Cargo认证。普通Cargo解析新updater，审查全节点/边变化并保存原因；以原Cargo update --precise选定rustls0.23.46、webpki0.103.16、root-certs1.0.11和Tokio1.51.6。父要求升级Tauri2.12家族属于ZIP修复的实际必要面，不扩大升级其他插件，不手写锁。
2. 同步唯一check-rust-dependencies当前包绑定，保留原12项生产合同和2项单独event库合同。追加实际生产编译单元的TLS1.2往返、Tokio本地TCP、ZIP普通文件解压/明确路径错误、updater公开feed解析正向合同；按实际新库输出确定错误类型，不使用“未调用/不存在/未包含”等核心断言。新增extern全部来自同一正式应用编译的精确package/profile/features，不用独立项目或缓存库补齐缺失单元。
3. 使用原canonical build:overlay/--cargo-message-format-json，独立HOME/OPENCORVUS_HOME/TEMP和独立CARGO_TARGET_DIR，初始化已安装MSVC的命名变量；不会覆盖用户当前二进制或修改运行页资源。原PKI继续使用官方0.23.45公开测试样本（它是固定测试输入，不是旧库fallback），密钥原件只在忽略目录，内容不进入日志、spec或Git。构建只校验迁移，packaged first-run使用自有临时数据；无真实Provider、无发布/安装/原生用户窗口操作。
4. 冻结本批源码与输入直到正式构建/输出完全结清，禁止在运行中换源或重复启动。随后对两个最终锁重跑无过滤terminal+JSON完整audit，检查registry与真实类别；预计9→0、Tokio警告退休只是待验证假设。构建、正向原生行为、类型、文档/架构、范围提交/最新上游合并及正常push均需实际完成；macOS/Linux运行和真实更新安装没有执行就明确列未验证，不以Windows替代。

## 当前实施与工具链复核

普通Cargo已解析官方Git固定来源，updater2.14.0/ZIP9.1.2、Tauri2.12.5及其2.12 runtime/2.10.2 utils家族进入唯一锁；四次精确更新另得到rustls0.23.46/webpki0.103.16/root-certs1.0.11/Tokio1.51.6（带其必要mio1.2.4）。原始615→622节点的完整新增、删除、边变化已保存并审查：Tauri家族带入新的WebView2、Tao/菜单/托盘、构建TOML/HTML、minisign0.3、URLPattern0.6及ICU实现；五个旧UNIC节点因此退休。此前声明的updater commit不含后来的updater base64升级，但Tauri-utils当前父链仍正常带入独立base640.23；没有将这两个来源混为一谈。没有升级其他已有插件版本，没有手写或隐藏锁变化。

追加测试覆盖新父接口：真实ZIP普通文件原字节输出及逃逸符号链接的明确InvalidArchive错误、updater实际platform feed及TargetNotFound错误、URLPattern命名捕获及重复名Parser错误、minisign0.3的公开验证向量及InvalidSignature错误。向量只有上游公开验证公钥/签名和4字节公开输入，无签名私钥或用户凭据。新增生产合同共7项，原12项完整保留，总19；既有event库2项保持独立。

初次使用通用run-with-inactivity包装Cargo metadata时，原测试bootstrap按合同创建并在成功后退休自己的工具缓存，metadata中的manifest_path因此不能再被之后的源审查使用。原输出/成功事实保留，未修改生产bootstrap。私有构建工具改为直接调用其底层同一runHostCommandWithInactivity生产primitive（基础组件），使用已完整预构造的唯一私有HOME/Cargo/target，保留真实deadline、180秒无输出及物理/输出结清。随后移除多余tsconfig override，解决固定Bun的directory-mismatch诊断；metadata-owned-final退出0、无诊断，真实源路径持续存在。

候选锁的完整JSON报告目前0漏洞、9警告；同批最初terminal仍有部分registry查询超时，已保留该不完整结果，不以退出0认定完整registry平面。最终构建之后继续用相同公开缓存重跑无过滤terminal+JSON直到查询实际完整。正式原生运行将使用独立target，不覆盖已有应用。新完整构建的40分钟绝对截止只创建一次，重跑若有必要仍沿该截止；未开始前不宣称构建或原生UI通过。

## 正式验收中的失败、根因与重跑

native-01的完整应用构建成功，但正式checker在选择serde_json运行时编译单元时失败。初次修改把metadata合并后的unbounded_depth误当成运行时特性：实际opt_level=0的Host工具单元有该特性，opt_level=s的应用单元只有alloc/default/raw_value/std。保留精确package、profile和features绑定，改正运行时所需特性；没有放宽匹配、借Host库或扫描缓存补齐。首次失败结果与编译事实保留。

其外层私有验证进程随后等到180秒无输出才结清，不能用result.json的failed提前宣称物理结束。实际默认Host wrapper选择terminateChildrenOnRootExit=false；这适用于持有整棵工作进程树的调用，有限构建检查应明确选择现有true策略。私有工具改用现有supervisedHostProcessFacade(owner,true)，不改产品Task策略、不增加process.exit绕过收尾。原现场观察到一个仍存活Bun子进程，但命令行取证不完整，其具体角色未知；没有将编译器守护进程猜测写成已证明根因。

即时横向审计覆盖command-inactivity、process-facade、ProcessSupervisor、runtime process-occurrence及03-control合同，并搜索全部生产Host/Task入口：插件、通用process、metrics、browser node executor、execution capsule file broker、ripgrep、codebase tools、expert-squad package capsule、MCP/browser launcher、restart handoff及plugin tool host。共同层区分根进程终态、输出结清和整树物理结清；Task绑定taskID/cwd与取消租约，运行时恢复绑定进程实例/occurrence及精确active-zero回执，禁止按裸PID清理。Mission/Session走所属Task及原轮次，不是各自另造一套进程策略。正常/错误、取消/检查点、重试/重启、串并行及Project隔离分别由这几层合同持有，不能全局把false改true。此次真实运行只证明私有有限检查的选择错误已纠正；没有用两个探针排除全部产品跨轮次/重启故障，也没有修改产品调度或宣布共享机制完成全面动态验收。

两个真实探针并行使用各自独立目录：前台Node退出7、留下活跃自有子进程，原finite策略2262ms返回exit7且完整结清；原checker加真实离线空Cargo目录，metadata返回101，checker保留错误并以1退出，2661ms完整结清。均非mock（模拟）或伪造终态。原native-01在2026-10-27T22:58:25Z物理结清后才重跑。

native-02沿同一绝对截止2026-10-27T23:22:48.027Z执行，2026-10-27T23:13:20.234Z原调用exit0且物理/输出完整结清，剩567793ms。普通build:overlay、Node/Vite、SDK、后端编译及原生release全部成功。构建只校验内存SQLite目标schema9；隔离的真实打包后端首次运行创建4会话、重启保留2会话，realProvider=false。当前UI嵌入442文件；原生应用19项真实生产库合同通过（原9、plist3、安全升级7），另2项event库合同通过。event的Linux交叉编译不是Linux实际运行。

## 生成文件与交付范围

Tauri正常构建同步三份现有gen/schema文件，新增的是app exit及指定monitor fullscreen的allow/deny可声明标识；默认capability文件没有增加授权。它们属于当前Tauri2.12清单的生成结果，不是数据库schema升级。

普通生成阶段还发现已交付efa51438e的真实Skill名称修复尚未同步到embedded expert-squad payload。39处生成行均来自当前已提交expert-squads输入，主要是/shared/旧名称改可执行短名以及对应包revision日期；当前expert-squads目录无工作区差异。保留正常生成输出一起交付，保证源码包与实际内嵌内容一致；不修改源包、生成器或混入外部工作。该事实不作为9项原生漏洞的根因。

构建后的完整terminal与JSON再次正常更新数据库/registry，无查询失败。Overlay622依赖为0漏洞/9警告：unmaintained五项fxhash0.2.1、proc-macro-error1.0.4、zbus_names4.3.1、zvariant5.10.0、zvariant_derive5.10.0；unsound两项glib0.18.5、rand0.7.3；yanked两项clipboard-win5.4.1、uds_windows1.2.0。Supervisor22依赖为0漏洞/0警告。所有原锁输入字节保持；未用过滤参数。正式checker显式TypeScript检查通过。最终节点审查615→622，包含精确TLS/Tokio补丁和必要父链。

未达成/限制：没有启动或操作用户原生窗口，没有执行真实更新安装、Unix AsyncFd实验、Linux/macOS应用或原生GUI视觉验收；本批未改UI，不能把构建当视觉证据。Tauri CLI仍输出STATIC_VCRUNTIME弃用提示，构建成功，尚未修改其配置。上述9警告与远端历史告警不是本批清零范围；没有删除取证文件、抑制告警或宣称整个产品目标完成。凭据和用户数据库均未进入本批验收，新增模型请求0。
