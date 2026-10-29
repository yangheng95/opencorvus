# 原生依赖告警与历史证据归属

## Recall

用户要求单 agent 持续自主产品体验、修复和功能迭代，分析/方案先落盘、真实验收、范围提交后正常 fetch/merge/push；后续单 agent 要求覆盖旧 Goal 的 Astra。788 是进展：cc7175c9b 已正常推送，2026-10-29T07:20:30.836Z fresh同步0/0，34自有文件干净；UTF16预览/双语错误/下载、真实Sol JSON读取、16原图/5原件/9纯字节测试已验。两个自有实例正常退休，源用户认证/目录/数据库保持，模型累计793。当前171旧媒体删除、7份他人benchmark/索引修改及2缓存目录保留；不建分支/worktree，不操作用户18571/窗口/进程。

用户明确允许本机现有GitHub登录只读获取告警；788两次实际GET均为8项：当前Tauri锁 #5 glib0.18.5；历史quickxml-parent-preparation/before/Cargo.lock有7项（#31 zip critical、#27—30 rustls、#13 glib、#14 rand）。不授权dismiss、远端配置/发布或新增凭据。当前本地HEAD与upstream为cc7175c9b；本批重新检查工作区，不将告警计数当运行可达性。

已重读AGENTS、760当前告警调查/正式验收、590依赖记录、Oct05 glib-backport候选完整计划、原生Overlay manifest/lock、check-rust-dependencies/fixture和Docker构建入口；当前Tauri2.12.5/Wry0.57.1/GTK0.18.2/GLib0.18.5。760已修rand旧父链和正式TLS/ZIP，不能重复升级或改历史原件制造完成。全仓搜索before路径只见原始事实/告警JSON与旧计划；历史before目录仅Cargo.lock、旧checker/fixture，不含可构建Cargo.toml。源码/规格查找中Windows字面glob与误猜架构文件名失败不作产品证据，已改从真实文件列表定位。

权威资料已重新读取：[RustSec RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html)、[GTK-rs官方修复PR1343](https://github.com/gtk-rs/gtk-rs-core/pull/1343)。官方修复是VariantStrIter::impl_get的可变out指针；旧版本的共享引用被C变参写入导致未定义行为，不能用空值检查或替代getter遮掩。已知可兼容GTK3发布修复尚未证实；旧计划提出合法同版本源码回移、单Cargo patch源和真实Linux优化库/消费者验证，未实施。不能把第三方伪版本或Windows未编译glib当修复。

## 当前可观察事实与方案

WSL（Windows Subsystem for Linux，适用于Linux的Windows子系统）只读列表确认Ubuntu-24.04/docker-desktop。自有最小env Python探针原exec1922已真实终态exit1：Wsl/Service/CreateInstance/HCS_E_CONNECTION_TIMEOUT，虚拟机未响应，未获得uname/系统库/Rust结果。没有重启WSL/Docker/用户进程，也不能据此断言Linux不存在。下一步仅用隔离Docker配置、明确本地pipe及有限时限读取现有daemon信息；可用才考虑自有容器/既有官方构建环境。若必须重启用户服务才能恢复，则准备精确影响和动作，授权前不执行；继续独立可完成工作，不把整个Goal降为blocked。

先确认历史锁的唯一Git来源/原字节、所有实际消费者和GitHub依赖图规则；若它确为只读取证数据，则以明确文本证据身份保留原字节/原始文件名映射，而非活跃Cargo.lock。完整保留历史查询JSON中的原路径和旧构建事实，不改历史版本内容、不删除漏洞证据、不dismiss告警。移动前分析引用/索引/工具输入、正向归档身份验收与风险；全仓搜索所有真消费点，更新当前入口说明和三索引，并以远端只读回查确认GitHub实际处理结果，异步未收敛不冒称关闭。

GLib继续重新核对官方当前0.18源码与发布父图；可用Linux环境下，先补足源码回移/许可证/唯一Cargo来源、生产构建和优化Iterator行为/借用生命周期验收方案，再实施和进入原checker。不得只为消除scanner强改版本，不能通过未验证的GTK大版本迁移或只跑静态源码断言交付。Linux运行目前未知/未成功，真实环境问题先调查，未完成范围如实保留；如可安全修复自有工具则修后重跑原探针。

已确认现有DockerDesktopLinuxEngine响应29.7.2/x86_64，项目既有builder镜像尚未创建；这改变了下一步，不能沿用旧“没有Linux环境”结论。使用当前packages/overlay/docker/Dockerfile，通过其既有BUN_VERSION参数选择仓库声明1.4.0，构建本批独立opencorvus-native-advisory-789:linux-amd64；不改生产Docker路径或重启用户daemon。镜像构建由原finite ProcessSupervisor owner持有，首次固定60分钟截止，180秒无活动边界；公开依赖下载无认证，Docker配置/HOME/runtime/TEMP隔离，源目录只读入builder context。镜像成功后仍须实际容器uname/pkg-config/rustc验证，不将daemon或build成功等同Linux库/GUI验收。当前Dockerfile默认1.3.14与根1.4.0差异为已见工具风险；本阶段使用现有参数，不擅改版本事实，若进入正式Docker生产构建再补统一版本来源分析。

本批无UI修改时不虚构视觉验收，无Provider调用或auth/models复制，模型预算0。API/SDK/schema9/用户DB/持久消息、调度/队列/唤醒/恢复/并发/终态均不触及；目前无此类产品异常，若出现立即按共享机制横审。所有修改必须范围提交并正常推送，正常hook失败先修根因；总体Goal保持active。

## 历史数据身份的实施前分析

GitHub官方[依赖图支持说明](https://docs.github.com/en/code-security/reference/supply-chain-security/dependency-graph-supported-package-ecosystems)将Cargo.lock作为推荐Cargo依赖输入，不要求该目录同时有Cargo.toml；当前只读API明确7项的manifest为before/Cargo.lock。现before目录只有旧锁/旧checker/旧Rust合同三份取证数据，并无生产或工具读取入口。全仓搜具体before文件路径仅得到历史告警/事实；旧计划引用该目录作为saved exact before，不是当前构建配置。真实构建的Cargo.toml/lock仍在packages/overlay/src-tauri，正式checker亦在packages/overlay/script。误归属根因是原字节取证以活跃清单/源码文件名进入仓库，旧原生依赖升级无法改变另一份历史依赖图，不能将其旧漏洞数当当前版本运行曝光。

将同一组3份旧输入各增加.txt后缀，明确其取证数据身份；不改任何内容、版本、旧查询JSON中的原路径或旧报告事实，不删证据，不dismiss或给Dependabot加ignore。新增before/README说明原始路径→数据路径映射、Git原来源与原字节验收；原父README增加入口，根三索引链接本次记录/证据。现.gitattributes已有精确保留手工payload/调查原件的惯例，本组*.txt同用-text保留其原字节，避免未来checkout转换。正式清单/构建/升级逻辑均不改，不产生第二当前Cargo图或产品配置。

移动前保存/核对每份当前工作副本、HEAD blob及首次Git来源的原字节，保存私有备份；精确文件移动，不覆盖目标，不动他人删除/修改。移动后通过实际Git新数据blob/导出内容与历史来源逐字节核对，确认可恢复原始Cargo.lock/checker/fixture输入。这是真实不可变原件身份验收，不是可变源码摘要门槛。风险是阅读者按旧名寻找、脚本误读和远端索引异步：以当前映射入口、全仓生产消费者搜索、docs检查及推送后只读回查处理。历史API里的旧路径仍是查询时真实事实，不做全局替换。

实际归档已完成：三文件均逐字节等于首次来源c59cf33bc765d17f079d1d4c5665a4f5e9df4a01及移动前HEAD，160323/20698/13282字节。独立临时Git index的真实add/write-tree/archive、tar导出和check-attr全部通过；三个新数据blob保留同一原Git blob身份，Git识别为100%原样改名。归档属性text=unset，当前生产锁/清单/checker/fixture没有变化。旧父目录README和新before映射入口、当前三索引已同步；[实际记录](../../artifacts/2026-10-29-native-advisory-evidence/README.md)。该独立交付先范围提交与正常推送，随后只读查询远端实际告警，不提前声称关闭。GLib生产修复仍在继续，镜像构建中不作完成声明。

## Linux候选实物资格（生产修改前）

归档1521be8d7已正常推送，fresh同步0/0；07:51:27Z只读回查仍8项open，远端尚未证实收敛，不作关闭声明。镜像原exec28618真实exit0/560027ms、finite owner物理结算；自有只读/无网络容器探针exit0，Linux6.6.87.2/x86_64、Rust/Cargo1.99.1、Bun1.4.0、GLib/GIO2.74.6、GTK3.24.38、WebKit2.50.6已实际返回。Ubuntu WSL失败不再是本批Linux库验证的阻塞。仍沿1793262838134原绝对截止，无续期；无原生GUI/发布或模型。

官方glib0.18.5.crate已从static.crates.io取得，精确匹配当前Cargo.lock声明的不可变发布checksum；这个校验用于发布原件身份，不用于可变源码验收。实际normalized Cargo.toml确认全部0.18 registry依赖、lib/features/最低Rust1.70；src/variant_iter.rs仍含官方已定位的共享out指针。MIT/COPYRIGHT需随任何源码回移保留，不能从Git工作区manifest引入GTK兄弟path依赖。

先在私有候选目录原样导出当前Git的同一Overlay Cargo项目/锁/原合同文件，复制已校验的完整官方crate，仅应用官方两行修正，并给这个现有项目声明单一候选Cargo patch路径。不是新增fixture Cargo项目或生产fallback。用自有Docker容器/缓存/target，仅读取此前本agent无认证public Cargo缓存registry/git；不挂载用户HOME或凭据。先离线解析，保存真实错误，若缺公开缓存则修复自有工具链后重跑，不以缺缓存冒充不可修。

只对真实glib库按该项目release opt-level=s及显式opt-level3分别构建，保存独立Cargo compiler JSON，精确选择本次path包唯一rlib/profile/features；用原合同文件的独立GLib cfg区段编译实际优化测试并运行。正向输出覆盖混合next/next_back/nth/nth_back/last、完整正反Unicode顺序、跳跃后的size_hint/count、原Variant存活而iterator已释放后的借用字符串字节。不得运行upstream通用测试（含未审负向用例），不按文件名glob/mtime挑缓存库。库级候选资格不能冒充实际Tauri production artifact或Linux GUI；通过后再完成生产唯一patch源、全父图/锁、所有构建入口及原checker整合，另行落实真实生产构建。当前生产源未改，未宣称GLib修复交付。

首轮外层Docker客户端因静默cache复制超时而exit1，随后inspect确认同一CID仍running且原timeout/复制进程在推进（目录374→524/572），不能据客户端超时重启真实任务。已向原CID注册docker wait，真实容器于08:14:37Z退出1且--rm完成；原始失败及等待回执保留。真实错误并非GLib或Cargo图：覆盖RUSTUP_TOOLCHAIN=stable要求安装另一个toolchain，而镜像实际default是1.99.1-x86_64-unknown-linux-gnu，Rustup试写只读/usr/local/rustup/tmp。已用新只读容器实际rustup show/which确认cargo/rustc/rustdoc的精确已安装路径。缓存准备完整保留在本批自有volume，不重拷；原helper/results保留，新结果目录02、同一候选源/锁/合同、精确compiler二进制/PATH、原截止和5分钟收尾重跑。未改镜像或系统权限，没有重启用户服务、扩大网络或让模型运行。

02已真实终态exit1/物理结算：精确rustc成功，Cargo update成功，580个全平台锁记录逐项核对，只改变glib同版本的source/checksum；metadata随后因离线缺少bumpalo3.20.2失败。该包属于非当前Linux目标缓存，Linux库资格使用实际rustc host过滤metadata，完整580锁审查仍保留；不把本次库级metadata称作全平台生产编译。03允许无认证的官方锁定包下载，保留TLS/只读rootfs/非特权，同一候选/缓存/目标，结果目录03，不增模型或用户凭据。原绝对截止仍1793262838134，执行时间扣除5分钟收尾后至少5分钟；原private launcher额外要求10分钟执行预算的保守检查不属于验收用例，按此阶段实际预算修正，两个优化等级和4项真实合同均不缩减。一次Node/PowerShell参数转义错误与拒绝准入保留在工具输出，没有启动额外容器或改动目标；改为保存的结构化参数脚本，避免拼接shell代码。

## 候选真实结果与未完成项

原exec39754已join0，Docker/finite原receipt exit0、settlementConfirmed，原CID自动退休；本批label下所有容器均已退出。03从08:21:47Z到08:22:44Z完成，原截止前余673538ms，未续期。真实release opt=s与opt=3各4项合同全部通过，完整原输出保留，不能只拿版本/manifest或build冒充行为。两次实际compiler unit均是唯一path glib0.18.5、同一feature集合default/gio/gio_ffi及v2_58到v2_70；分别从本次Cargo JSON的返回rlib/profile/features编译原合同cfg区段，没有glob/mtime选旧库。借用字符串/中文/混合双向迭代的明确输出均已执行。全580锁记录只变glib来源；Linux metadata421包，12直接父节点均引用唯一候选包。上游旧源码在新Rust有34条lifetime语法警告，未扩展为无关清理或声称无警告。

当前生产Cargo.toml/lock、原checker/fixture、Docker脚本/文件均与HEAD相同，生产glib尚未修复交付；候选目录不是第二当前实现或用户入口。必须继续完成唯一licensed生产patch源、所有父边/构建入口、正式checker整合与canonical应用编译，Linux GUI/安装及所有平台运行也未验。现有Docker入口flat mount若使用根patch路径需要一并处理；Dockerfile默认Bun1.3.14与根packageManager1.4.0的来源差异已见，实际本批使用既有参数1.4.0，后续进入正式入口前应收敛单一版本来源，不保留平行配置。不能把候选8项通过包装成Tauri已修复或整体Goal完成。

08:26:51Z远端仍8项open，默认分支/main的远端HEAD已确认为1521be8d7，没有dismiss或设置修改；异步依赖图尚未证明收敛，需要继续依据实际远端事实处理。源用户DB/应用、OpenAI凭据/模型目录未触及，模型0/累计793。保留原失败、自有公开cache/target用于下一独立生产构建阶段，不复活已退休任务/截止；证据见[候选资格](../../artifacts/2026-10-29-native-advisory-evidence/glib-candidate/README.md)。本阶段证据和方案范围提交、fresh fetch/merge与正常push，整体Goal继续active。

提交检查识别原始diff的空白上下文和Rust test原输出结尾空行；不改写原始证据来迎合格式检查。补丁使用仓库既有.patch数据类型（原字节不变），原生产日志按既有调查证据惯例以限定目录的-text/原始空白属性保存，实际Git导出须再逐字节核对原producer输出。范围不覆盖产品代码或其他目录，不绕hook；首次失败的私有index保留，新index重新审查。
