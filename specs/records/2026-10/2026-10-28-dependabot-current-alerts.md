# 当前 GitHub 告警与原生父依赖

## Recall

用户要求单代理持续自主迭代、根因分析先落盘、真实验收后范围提交并正常推送，直到明确停止。旧Goal的三Astra文字已被后续单代理要求覆盖。759是已交付进展：04c24d743246fa887a1a96fb2c04ad9b9f685747已推送，2026-10-28T05:24:48.902Z fresh fetch/merge为0/0，23自有文件干净、176外部改动保持。真实Chat/Work Markdown及JSON下载、六原图人工复核、8正向格式合同16断言、构建/类型/语言/文档及全部正常hooks通过。原应用实例正常关闭、schema9/原数据保持、无auth复制/模型0，累计759。总体目标active，不重查已修复Rendering。

2026-10-28用户明确答复“允许只读获取告警”，授权本机已有GitHub登录仅用于只读告警清单。实际gh GET open Dependabot alerts已在05:24:24.165Z成功读完1页8项，凭据未进入输出、prompt、spec或提交。不授权dismiss告警、修改远端设置或发布。此前匿名401不是当前阻塞，不重复询问。

已读本轮原始API结果、759 Recall、748原生升级完整记录及最终报告、当前两个Cargo清单/锁、check-rust-dependencies正式入口、748父节点/公开registry/编译metadata和私有有限进程运行器。已全仓检索相关依赖、调用与历史决定。748已将正式rustls升级0.23.46、Tauri2.12.5和官方固定Git updater/ZIP9并通过正式应用19行为+独立event2行为及打包后端检查；其glib/rand与维护/yank警告仍保留，不能重复升级已修复TLS或把0漏洞扩大为无警告。

## 修改前分析与范围

可观察事实为正常push报告8项（3中/5低），实际API中#5 glib、#6 rand指向当前packages/overlay/src-tauri/Cargo.lock；#13/#14与#27—30均指向2026-10-05 quickxml-parent-preparation/before/Cargo.lock历史取证。当前锁为glib0.18.5、rand0.7.3/0.8.6/0.9.4、rustls0.23.46。告警数量不能证明当前运行时存在8种可达漏洞，也不能因历史副本而直接dismiss或删除证据。

官方RustSec RUSTSEC-2024-0429说明glib VariantStrIter可变out指针使用错误，修复范围>=0.20；RUSTSEC-2026-0097说明rand在log/thread_rng、自定义重入logger、重新播种等组合条件下不健全，修复分支0.8.6/0.9.3/0.10.1。当前0.8.6/0.9.4已在修复范围；0.7.3的真实父链、启用特性、构建平台与可用兼容父升级仍未知，需要新的实物证据。glib的当前父链跨GTK3/WebKit家族，不能用单一根级强制版本破坏ABI（Application Binary Interface，应用二进制接口）或伪造包身份消除警报。

旧路径未根治的已知原因是748只交付有完整正式验收的TLS/证书/ZIP/Tokio修复，余下两项已明确保留；本批先核对当前父包和上游发布，不预先决定vendor、fork或清空告警。先用当前正式锁、原完整metadata及公开registry/上游代码确定定义、所有父边与feature；若存在兼容修复，补全真实调用、公共契约、测试/构建/交付影响方案后修改并运行原checker；若不存在，明确根约束及未验证范围，继续处理其他产品问题，不能只无限重复相同审计。

本阶段只读调查，不改产品UI、Provider、调度/队列、API/SDK、schema/迁移或用户数据。没有新的终态/并发异常；如发现则按共享机制立即横审。无模型调用，不复制凭据/模型目录、不启动用户18571/窗口/进程。有限工具使用现有隔离HOME与原ProcessSupervisor，保留原退出和物理/输出结算；公开HTTP请求有明确时限，不读取用户Cargo配置或认证。

## 实施前方案

1. 保存无凭据的最小告警编号/manifest/版本范围/公告引用及精确查询时间，核对当前生产锁和历史锁与构建消费关系，不改历史原件。
2. 核对当前锁与748最终审计的实际输入相等后复用其完整metadata；重新读取公开registry的glib/rand及真实父包版本、约束和features，并读取必要官方源码。新旧工具失败分开保留，不把无输出/观察超时当终态或重启依据。
3. 根据实际证据选可兼容父升级或明确未完成原因。生产变更必须再补充分支/平台/测试/交付风险和聚焦正向验收，不用版本/摘要或告警消失代替真实行为，不运行UI自动化。
4. 本记录和证据同步三索引、文档检查、范围提交；fresh fetch/merge审查全部待推提交及正常hooks推送。整体Goal保持active、继续单代理迭代，无tag/Release/PR。

权威资料：[glib公告](https://rustsec.org/advisories/RUSTSEC-2024-0429.html)、[glib原修复](https://github.com/gtk-rs/gtk-rs-core/pull/1343)、[rand公告](https://rustsec.org/advisories/RUSTSEC-2026-0097.html)、[rand原修复](https://github.com/rust-random/rand/pull/1763)。首次误猜两个维护者Security URL返回404、两次无关RustSec编号不作证据；以上准确引用均来自实际告警references，已经读取。

## 父链根因与实施决定

当前正式锁逐字节等于748最终审计输入，先前metadata明确带--filter-platform Windows，只能证明Windows编译选择，不能代表全平台glib父链。已另解析全平台原锁并完整读取公开registry。rand0.7.3唯一父链为tauri-plugin-dialog2.6.0 → tauri-plugin-fs2.4.5 → tauri-utils2.10.2的build/html-manipulation → kuchikiki0.8.8-speedreader → selectors0.24 → phf_codegen/phf_generator0.8 → rand0.7.3。逐个父manifest/metadata确认只有fs2.4.5仍要求utils/build；当前Tauri/build/codegen/plugin均已要求build-2，不能笼统归为整个Tauri未修。原Windows rand特性未启用log，PHF实际使用SmallRng；仅限定当前可达条件，不代替依赖修复或关闭告警。

官方fs2.5.0已移除旧utils/build，当前稳定2.7.1继续使用utils而不启用旧build，dialog现有^2.4.5允许此同2系升级，当前Tauri2.12.5与Rust1.98.1满足其要求。选择当前稳定2.7.1，使用唯一Cargo update精确父节点，审查全部节点/边；不添加根级rand强制版本，不vendor/fork、伪装版本、关闭功能或手写锁。最新GTK0.19要求glib0.22，但当前Tauri仍要求GTK^0.18，因此glib不能靠此兼容父更新修复，保留其真实告警与Linux验收限制。

升级影响为真实原生dialog携带的fs库和其构建能力，不增加产品fs权限或更改dialog注册。当前capability只有dialog:default，没有fs:*；main只注册dialog。上游2.7.1同时包含安全路径/文件句柄修复及相对冒号路径解析修复，需以当前正式编译单元验证公开SafeFilePath：原路径、file URL、Unicode及明确unsafe/URL错误，不能只比版本号或断言旧crate不存在。正式checker同步新增fs精确package/profile/features绑定和原19合同之外的聚焦正向行为，删除过期的“必须保留rand0.7.3”残余身份断言，当前glib残余事实继续记录；不把lib合同冒充真实原生对话框交互或所有Linux路径攻击覆盖。

用已验证、无认证的自有748 Cargo公共缓存与native target复用编译产物，760独立HOME/runtime/TEMP/输出/原绝对40分钟截止，finite host配置true持有物理树与输出结算。复用缓存不是读用户Cargo配置或启动用户应用；原748产物/结果保持可核对。完整原build:overlay、实际打包后端首次运行、全部原生19+新增合同、独立event2合同后，对最终两个正式锁重跑不带过滤的cargo-audit terminal+JSON，验证数据库/registry完整更新及类别。正常类型/文档/范围提交、fetch/merge/正常hooks推送后再只读核对远端告警。构建只校验内存迁移目标schema9，打包首次运行只用隔离临时数据，模型0。无UI代码修改，不启动原生GUI或把构建当视觉验收。

父锁第一次公开registry探针误按四字符规则拼三字符gtk地址导致404，原命令exit1且物理/输出已结清；修正标准sparse索引路径，用新输出名和allSettled核对每项后重跑exit0，失败保留，不以部分结果冒充完整。

唯一Cargo update fs2.7.1已正常0并物理/输出结清，原622→580节点，唯一新增fs2.7.1，43旧节点退休；完整差异已落盘审查。旧HTML链退休也带走PHF0.10/0.11和rand0.8.6，因此原两个PHF专用合同不能继续绑定已不在生产图的库；它们合并替换为当前实际PHF0.13单一确定性查询合同，原功能断言保持。移除只为两个旧库服务的宏和4个extern，保留当前实际2个extern；原编译artifact显示host PHF shared精确features default/std、runtime只有std，继续按host精确绑定，不用metadata合并特性冒充运行单元。修正后总21个生产合同（原19减2旧PHF加1当前PHF加3fs），另event2独立。剩余rand0.9.4当前修复分支事实保留于唯一图；checker不再要求已退休rand0.7.3作为残余存在。

## 正式验收与交付

正式native-01仅运行一次，原exec5358退出0，原ProcessFacade receipt exited/exitCode0、物理与输出结算fulfilled。05:37:00Z开始，原截止06:16:57.244Z从未重置；05:47:37.409Z完整结清，余1759835ms。普通build:overlay成功：当前442个UI内嵌文件、两次Node/Vite、SDK正式生成、后端编译/运行载荷和Windows release。实际打包后端首次运行4会话、重启保留2，realProvider=false；构建日志明确只校验内存SQLite目标schema9。无原生窗口/用户进程操作、无auth或模型目录复制、模型0/累计759。

21项生产合同全部真实通过，包括新增fs相对冒号/Unicode路径、file URL解码、typed traversal/URL错误，和当前PHF0.13原确定性查询。原其余17项合同保持TLS1.2/1.3、错误alert、ZIP、updater、Tokio TCP、Minisign、配置/serde/plist行为；event2独立库合同亦通过。精确package/profile/features继续从唯一正式应用compiler artifact选取，未用旧缓存缺失单元补齐或放宽身份。Linux交叉编译event分支不是Linux运行。SDK、capability和原生生成schema未产生tracked差异，产品版本未改变、无发布。

规范化后16个真实边变化已完整审查：dialog→新fs、utils旧HTML子图退出和现有TOML1分支选择、syn不再选旧生成特性，以及现有Windows系统库在上游允许范围内的重新解析；没有新增另一个包版本。当前Rust编译/链接及实际生产合同已覆盖Windows结果，不扩大为所有平台证明。原Cargo清单不变，唯一锁为正常Cargo输出。

审计首轮terminal虽exit0但registry请求超时，明确不完整。只复制此前已完成审计的公开registry index/cache/src至本轮自有CARGO_HOME，未复制任何认证；保留原失败后，相同无过滤JSON及terminal均真实更新数据库/registry成功，Overlay580依赖0漏洞/7警告：glib0.18.5不健全；proc-macro-error1.0.4、zbus_names4.3.1、zvariant5.10.0、zvariant_derive5.10.0四维护警告；clipboard-win5.4.1、uds_windows1.2.0两yank。Supervisor22依赖JSON/terminal均0漏洞/0警告。原锁输入字节保持，源缓存仍为公开无认证资源；没有删除/改写历史锁或dismiss告警。

单文件TypeScript最初未从私有config加载Bun类型，显式types后又发现根目录未链接该类型；改用当前后端已声明安装的@types/bun类型目录后，原checker的聚焦TypeScript重跑成功。两次失败保留，无临时类型声明或生产绕行。文档检查351操作/26组通过；最终文档再校验后范围提交、fresh fetch/merge、完整待推集合审查和正常hooks推送，推送后只读回查实际GitHub状态，不能提前宣称告警已关闭。

证据见[目录](../../artifacts/2026-10-28-dependabot-current-alerts/README.md)。当前glib告警未修，Linux/macOS实际运行、原生GUI/真实对话框、更新安装及全部攻击配置未验证；本批非UI依赖修复不伪装成视觉验收。总体Goal仍active，单代理继续产品迭代。
