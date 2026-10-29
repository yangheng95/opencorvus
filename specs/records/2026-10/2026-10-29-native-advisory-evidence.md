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
