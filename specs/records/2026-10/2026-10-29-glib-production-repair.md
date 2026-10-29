# GLib生产源码与正式原生构建修复

## Recall

用户要求单agent持续自主产品体验/功能/修复，分析方案落盘、真实验收、范围提交和正常fetch/merge/push，直到明确停止；后续单agent指令覆盖旧Goal的Astra，不委托、不建分支/worktree。789是进展：1521be8d7历史原件数据归档、507c4971e真实Linux候选资格均已正常推送，08:49:57Z fresh0/0、28自有路径干净。两优化等级s/3各4项真实GLib合同通过，580锁记录仅glib源变化、421Linux metadata包/12父节点引用同一候选。库候选不是生产Tauri交付。8条GitHub告警仍open，未dismiss/ignore；不能继续仅把未收敛称作异步成功。

重读789 Recall/实际失败/结果及私有next-production-phase，读取现Cargo清单/锁、唯一check-rust-dependencies.ts与Rust合同、build-overlay/build-docker/Dockerfile、package-build-environment、Script版本来源和backend build/首次运行合同；检索所有Cargo/patch/Docker/Bun配置调用和相关架构。当前root packageManager=bun@1.4.0；Dockerfile却默认1.3.14且固定平台tag只inspect既有镜像，未核对源变化。Docker入口将项目flatten为/overlay/src-tauri，根级../../../patches在该布局解析到/patches，必须挂载同一源码。没有额外package AGENTS。开始工作区171旧媒体删除、3共享索引修改、114项他人benchmark staging和2缓存目录，全部保留；只有实际冲突才等待。

789所有原生容器已真实退休，旧截止1793262838134过期，禁止复活/续期。可复用已验证自有镜像opencorvus-native-advisory-789:linux-amd64（Rust/Cargo1.99.1、Bun1.4.0、GLib/GIO2.74.6/GTK3.24.38/WebKit2.50.6）和纯公开cache volumes oc-native789-cargo/target-s/target-3。Ubuntu WSL HCS超时不构成当前Linux阻塞。新阶段另立原始固定生产构建截止，内部timeout/精确容器身份与真实Docker wait共同观察，不把客户端观察超时当原任务终态；不重启用户WSL/Docker，不操作18571/用户应用/窗口或DB。模型0/累计793，无auth/models复制。

权威依据：[RustSec](https://rustsec.org/advisories/RUSTSEC-2024-0429.html)、[官方两行修复](https://github.com/gtk-rs/gtk-rs-core/commit/b5a4071e439bef2b5eea76c3aa25e5ae84839e34)、[Cargo单一patch规则](https://doc.rust-lang.org/cargo/reference/overriding-dependencies.html)、[Rust cfg语义](https://doc.rust-lang.org/reference/conditional-compilation.html#test)、[proc_macro2源位置](https://docs.rs/proc-macro2/latest/proc_macro2/struct.Span.html#method.byte_range)。已读取当前官方说明。仅不可变发布crate校验用于资源身份，不把可变源码摘要作为验收门槛。

## 修改前根因、影响面与实施方案

正式Cargo仍选择registry glib0.18.5。VariantStrIter::impl_get将不可变指针槽&p交给C变参函数写入，违反Rust引用规则，优化可保留null；已在官方修复与原始0.18.5源码确认。官方可用修复版本>=0.20，但当前Tauri2.12.5/Wry0.57.1/GTK0.18家族共同要求0.18，强改版本会破坏类型图或留下旧源。候选已证真实数据行为，旧路径未根治是仅记录兼容父链限制/Windows未编译该库，未交付正确生产源码和Linux当前应用资格。

1. 从已核对的官方发布crate保留MIT/COPYRIGHT、标准manifest/生产源码和features/版本0.18.5，应用唯一官方out指针两行修正，放到根patches/rust/glib-0.18.5。生产Rust类型、借用所有者、Item/结构字段/C接口均不改，不伪装0.20，不改registry缓存。上游通用tests/benches及测试专用源码不作为项目新测试引入；用成熟syn AST（Abstract Syntax Tree，抽象语法树）按Rust cfg在test=false必定不成立的声明省略测试脚手架，不用关键字删除/运行负向用例。保留所有生产条件/feature代码，禁用该vendor自身自动测试/doctest，只由现有应用合同测试真实库。该准备器为私有一次性编译工具，不是另一个应用/fixture Cargo图；省略清单与原件来源落盘，实际库和应用构建验证结果，而非静态摘要，才是功能验收。
2. 唯一Overlay根Cargo.toml声明一个crates-io patch。由真实Cargo生成/验证当前锁；审查全部580节点及父边，只接受glib同版本source/checksum退休，当前12父节点使用唯一source。旧registry不作为生产fallback。源码原件/许可归属记录在当前架构及spec数据，vendor不新增平行spec。
3. 扩展唯一check-rust-dependencies.ts与唯一Rust合同文件：Windows21项/event2现路径保持，Linux从同一次canonical build:overlay的实际application/runtime profile绑定新path库，按返回的唯一rlib/features/native链接owner编译4正向合同；另以同锁opt3真实库调用做独立优化资格，不能合并为另一生产artifact或冒充GUI。通过Host明确分派，错误/原始输出保留。新增实际代码/配置有聚焦正向输出，禁止UI自动化、源码文案/DOM/截图断言。
4. 现Docker入口挂载同一根patch源码，Bun版本只读根packageManager；Dockerfile不保留另一个默认版本。通过成熟Docker build缓存构建当前输入，不用只inspect固定旧tag或源码hash门槛替代。审查所有调用点/路径和实际构建行为，不引入第二builder或fallback。正式版本未变，根Unreleased中英文日志记录增量和用户影响。
5. 真实Linux源码输入通过Git独立index/tree导出当前base+本任务改动，排除未授权工作区staging/用户配置；这是隔离构建输入而非额外Git branch/worktree。源码/node_modules/target在自有Linuxvolume，仅读取公开缓存；不可复用Windows node_modules。全流程用当前canonical checker/build:overlay，frozen/ignore-scripts依赖安装，明确dev/现版本构建元数据，OPENCORVUS_HOME/HOME/TEMP隔离，packaged first-run realProvider=false。API/SDK生成、内存迁移校验、真实编译/链接和原backend首次运行都进入原入口，不stub payload或跳过失败检查。
6. 源码准备工具每次有限执行，正式应用第一次启动验证时固定60分钟绝对截止、至少5分钟收尾；所有重试共用该截止和真实已终态判断，不因观察超时重启。Docker外部daemon不是Windows CLI物理子树，必须绑定精确CID/label/image，等待真实退出/输出并正常退场。资源限额只作用自有验证容器，不操作用户服务。无新调度/队列/唤醒/恢复/并发/终态产品异常；如出现则按共享机制横审，不能归咎模型。
7. 验收包括真实production path来源、全部父链/锁审查、正式Linux应用构建及s/3真实合同、Docker mount/runtime配置实际行为、聚焦类型/文档和正常push hooks。原生GUI、ARM/macOS运行、更新安装或发布没有实测不得声称完成；本次无UI代码改动，不用build/console替代视觉。GitHub仅只读核对实际默认分支/manifest图和告警，旧记录原件不改写，不dismiss/ignore，不猜收敛。每阶段所有修改范围提交、fresh fetch/merge并审查完整待推集合、正常push，保留他人改动，总体Goal active。

## 正式构建第一次失败后的工具链补充分析

09:19:19Z production-01实际退出1；canonical build:vite在CSS PostCSS8.5.23 require nanoid5.1.16时，Docker Debian默认Node18.20.4返回ERR_REQUIRE_ESM。锁内依赖未改，CI setup-bun现明确Node22；因此直接触发是旧Docker Node与已声明CI构建运行时不同，不是GLib或凭据故障。不能patch node_modules或跳过Vite。全仓检索Node配置/消费者后，将当前Node22声明提升到根package.json engines.node作为唯一来源，setup-node读取该文件，Docker同现Bun从根读取构建ARG并复制官方Node22镜像runtime；不用单独版本常量或fallback。官方setup-node支持package.json engines.node，Node22支持该同步require(ESM)路径。新增配置通过真实官方镜像node运行冻结依赖及同一canonical build正向验证。重试仍共用09:19:14Z起原60分钟截止09:19:14Z+60m，不续期。无产品数据库/接口/迁移/调度状态变化。

09:28:13Z production-02实际退出1；新镜像/冻结依赖和完整Vite构建通过（7353modules，76s），随后Generate OpenCorvus build artifacts读取registry的SDK expert-squad-manifest-v2发布dist失败。全仓4个generateOpencorvusGeneratedBuildArtifacts调用点：Overlay、backend build/build.local、root generate；它们均在SDK准备前可能调用。SDK包已声明source条件，SDK自身OpenAPI生成也已用bun --conditions=source；当前公共生成器仅lazy import环境隔离，遗漏源码条件的进程边界。方案：同一公共函数统一调用同文件唯一生成实现的source条件子进程，全部4调用方共享该边界，保留现有环境绑定、输入root和逐行日志/错误，禁止复制旧dist或调整依赖排序掩盖循环。实际canonical首次构建及后续完整SDK/OpenAPI作为正向验收；无公共API/数据库schema变化。隔离Git archive另须提供自己的精确tracked index用于现有Git来源生成，属于验收输入要求，不改产品生成器为无Gitfallback。

09:34:48Z production-03真实退出1；source条件已成功选到SDK TypeScript，但package-tool-bundle的compilePluginRuntimeClosure把真实project-path源码读为字符串，放进强制loader=js的虚拟namespace，导致TS类型注解解析失败。旧路径只在已有SDK JavaScript dist时偶然成立；相同闭包也供OpenAPI/工具加载，属共同生产边界问题。全仓只此SDK namespace定义/使用，其他两个虚拟模块内容本身已是JS。修复采用现有Bun成熟file resolver：SDK onResolve返回真实解析文件路径，按文件扩展名选择解析器，删除仅包裹该文件的namespace/readFile/onLoad路径；保留工具白名单、文件沙箱、真实闭包输出和完整性合同。源/发布包共用同一文件解析，不加source字符串猜测、fallback或人工TS剥离。聚焦正向测试应验证真实工具闭包的project path函数输出，完整fresh canonical/OpenAPI继续原截止；不以新的失败次数延长期限。

Docker完整消费者复核继续发现flatten布局不符合build.rs的server-defaults路径，且Tauri beforeBuildCommand在没有package.json/node_modules的/overlay执行build:vite，前端dist也未挂载。检索消费者只有Overlay package与package-local，原生产布局是/repo/packages/overlay/src-tauri。修复在现有宿主build:docker入口先用原build:vite生成一次前端，容器挂载精确的canonical source/dist/patch/server-defaults/prebuilt-server路径，关闭该次Tauri重复beforeBuildCommand；不用挂载整个用户仓库或搬运其node_modules/凭据。Cargo cache改为当前独立home volume，统一存registry和既有公共Git依赖，不复用旧registry卷为不同语义。正式canonical应用资格正在生产volume中进行；Docker新镜像已真实成功，入口layout应单独实际探针验证，不冒称整个独立Docker打包路径已经通过。

## 当前实际结果

09:39:25Z隔离新源公共生成合同通过：117包/122本地化/6Skills/general Mission，读取实际生成模块验证身份。source条件工具闭包在Windows和Linux分别真实编译执行成功，Windows普通发布JS解析也通过同一正向合同；普通和中文项目路径输出正确。94生产源文件由syn省略41测试专用声明，全部真实580锁记录复核通过，生产只有GLib源/校验和归属变化。

09:53:41Z production-04真实Docker wait退出0，原始09:19:14Z起60分钟截止保持。完整canonical build:overlay通过：Vite、SDK/OpenAPI、内存schema9校验、后端和真实打包first-run（4sessions/2跨重启保留/realProvider=false）、原生Tauri编译链接均成功。生产s等级绑定应用实际GLib rlib的4合同、独立opt3真实库4合同全部通过；12GTK父节点引用唯一生产源。没有运行上游通用测试、UI自动化或真实模型。本轮模型0/累计793，用户18571、窗口和真实DB未动。实际证据见[产物入口](../../artifacts/2026-10-29-glib-production-repair/README.md)。

既有Docker源码文案断言仅检查函数名是否出现，不能覆盖缺失挂载的真实错误，已删除该失效块与专用导入；保留实际artifact命名函数合同。Docker选择挂载Tauri资格、最终scope提交/fetch merge/push及GitHub回读继续收敛，不将该阶段的应用资格冒称ARM/macOS/Windows跨平台传输、installer或GUI验收。

09:56:34Z Docker精确选择挂载资格实际退出0：只挂载当前入口所需src/src-tauri/dist-vite/patch/server-defaults/prebuilt-server，未挂整个源仓库/Node依赖/Git，真实Tauri locked release构建成功（原生cache复用，1m59s）。实际metadata12父节点仍选择唯一生产源，原参数/返回artifact/终态已记录。全部6个确切scope容器仅在确认真实exited后正常rm；自有公开cache/source卷和镜像保留，不操作用户daemon。当前证据明确区分该真实Linux布局构建与尚未实测的Windows payload传输/其他平台/安装器/GUI。
