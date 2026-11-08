# 通知权限反馈的当前事实与语言

## Recall

用户要求持续按批并行体验 UI（User Interface，用户界面）/UX（User Experience，使用体验）、调查功能与缺陷，先分析落盘，再真实桌面 /ui、截图人工复核、聚焦正向功能测试，范围提交、上游合并及正常推送后继续，直到明确停止。上批 68079f375 已通过全部钩子正常推送，main/upstream 0/0、暂存空、原 177 条工作区事实逐项保持。Sol 授权问题仍待回答，本批无模型需要，不读/复制/使用真实凭据，不产生产品消息或实际通知。

两个既有代理并行只读审计，无再次委托/编辑/浏览器操作。已读 GeneralPanel 通知三生产者、模块字符串/订阅集合/实例镜像、唯一反馈呈现、全局 action/ownsAction；saveSettings 原失败回调与确认事实；desktop-notifications 的 read/request/ensure、请求合并与独立 Mailbox（收件箱）投影；browser/Tauri 宿主桥及原 HostPermission 四状态；全部引用与两语言旧模板。已读当前 07-panel 的 General 与宿主通知合同、8 月 11 日原生通知 Recall、本次 b12 明确排除通知反馈的记录，以及三份相关纯服务/宿主适配器测试。

ui_audit 给出自然 off→on 权限旅程；functional_audit 独立确认模块字符串会跨卸载保留旧译文，建议一个模块 typed signal（响应式事实）替换整个字符串+订阅+实例镜像，不保留双源。已发现 notification-host-transports.test.ts 两条旧核心负向断言：拒绝后的 delivered 长度保持 1、原生路径 delivered=[]；本批触及该合同后应删除这两条及只为它服务的局部绑定，保留明确返回结果与实际原生命令载荷的正向契约。不新增/运行 UI 自动化，宿主 API（Application Programming Interface，应用程序接口）夹具不等于浏览器页面测试。

## 修改前根因与影响分析

候选现象尚待真实观察：General 默认通知开启，真实关→开保存后 ensure 会读取宿主权限；若自然得到 denied/default/unsupported，当前错误当场 t() 成字符串，并内嵌英文 permission 枚举。原地换语言或离开/返回 General 可能沿用旧译文；unsupported 时旧统一文案还要求去系统/浏览器允许，可能并不符合环境能力。不能预设 IAB（In-App Browser，应用内浏览器）的权限返回或凭源码直接宣称复现。

唯一生产流：先更新全局通知偏好，再走原 saveSettings。持久化失败的 onFailure 在 ownsAction 成立时恢复 confirmed.desktopNotifications 并记录保存失败译文；真正成功后清旧反馈，关闭分支直接结束。开启分支 ensureDesktopNotificationPermission 读取原 host；granted 正常结束，denied/unsupported 直接返回，default 才请求真实权限，当前设置关闭时按原 denied 结果退休。异常保存被压平 message。全局 desktopNotificationAction 与当前偏好值是原动作归属，不属于 Task/Mission/Session（任务/多步任务/会话）执行调度。

错误数据与呈现根因：persistedDesktopNotificationError 模块字符串为当前事实，经私有订阅集合复制到每个 General 实例 signal；三处写入全在保存/权限结果时翻译或压平异常，render 只打印字符串。订阅只同步值，不建立 locale 依赖；旧字符串又特意跨卸载持久，重进页面也不会重译。只有本组件消费这些私有定义，无公共订阅契约，删除影响限本反馈传递。旧其它 General 的 Git 错误另有生命周期，本批不扩改。

若自然非 granted 真实复现，方案维持一个模块级 typed failure signal：save+原 cause、permission+原 cause、unavailable+原非 granted 三状态。同步删除旧 persisted 字符串、订阅 Set、实例镜像和唯一 onCleanup；不是新增共享状态面。组件 memo（响应式投影）读取当前语言生成摘要/Details，非 keyed Show（稳定内容所有者）保留现 Feedback；跨 General 卸载仍由同一模块事实保留。保存、权限异常用现 formatErrorDetails 保留原技术诊断，denied/default/unsupported 各自准确中文/英文说明，不再把英文枚举当产品正文；旧统一模板若全仓仅此使用则同步删除。

不改原动作计数/归属、保存/回滚时序、权限检查/申请合并、通知发送、Mailbox 内容/队列/投影、宿主接口或系统权限。尤其不伪造权限状态、注入浏览器对象、制造通知或请求模型。只有实际页面自然结果才是验收事实；granted 或不可观察的 pending 无法证明此错误路径，须据实否证/记录，不能为了修改而改环境。

当前没有调度、队列、唤醒、恢复、并发或终态异常运行事实。MailBox 的序列投影和权限合并属于共享服务，本批保持原实现；若真实运行出现异常，按仓库共享机制完整横审，不降级为通知或单场景问题。无数据库/持久格式、SDK（Software Development Kit，软件开发工具包）、公共错误/路由、模型提示或配置策略改变。

## 条件验收与交付

系统临时根 opencorvus-iteration-20261108-b16，新 project、profile-before/after；before 开发 serve /ui 38950，after 普通最终 build（构建）后 38951。只使用本人隐藏隔离页面，无凭据/模型目录绑定、无现有用户页面/进程/权限操作。通知偏好只在本人实例真实关闭再开启，不发送通知；若出现本人来源的权限提示，实际选择 Block/阻止，不授予权限。若提示无法在支持的界面操作，记录真实 pending/阻塞并正常关闭本人页，不用注入或浏览器启动开关绕过。

前态记录原通知开关和真实反馈结果（仅从实际页面，不读取隐藏 Notification 全局）。若非 granted 路径可见，截图原地中英文、离页/重开 General 保留译文、再次关闭后反馈退休；若已有 granted 则据实不宣称故障。语言动作正常保存本地偏好，不能把整个旅程说成零写入。再决定产品是否需要改动，补前态与最终实施决定后才动产品。

after 沿同自然结果重复：实际开启结果、当前语言摘要、原地语言往返、关闭/重开 General 的同一反馈、原动作成功关闭清反馈、再开启的新真实结果。最终恢复本人初始偏好或如实记录当前受限状态。只证明自然返回的权限分支；其它两状态、异常 cause、原生窗口或实际送达没有真实运行则明确未测，不能靠夹具冒端到端。

聚焦非 UI 正向服务/宿主检查按当前真实合同运行；先删除已发现两条负向核心断言，保留原 true/false 交付回执、权限字符串和 native payload（原生载荷）输出。无新增 UI/DOM（Document Object Model，文档对象模型）/文案/组件/快照/浏览器 fixture（页面夹具）或截图基线测试。另跑 typecheck（类型检查）、i18n（Internationalization，国际化）、正常 build/renderer surface、docs:check/architecture-index；它们不能替代实际截图。

本人页面关闭、公共 shutdown、原启动句柄 exit 0；只提交本批范围，三索引精确新增入口，原 177 条工作区更改保持。fetch/普通 merge upstream、完整待推集合复核、正常钩子 push，再自主继续。未完成分支/自然权限阻塞明确记录，不向用户索要不必要的认证或操作许可。

## 实际前态与收窄决定

38950/main-BydIgfm3.js、1280×720 真实页面初始 enabled=true。实际关闭后可见 false，再开启后与稳定复查均为 enabled=true/status=null，页面截图只呈现已开启，没有非 granted 反馈（01/before-observations）。原地中文（02）、实际切 Appearance 再返回 General（03）也仍是 true/null；最后恢复英文，通知偏好已回初始 true。三张均人工查看。

没有观察到可操作的 Block/权限请求界面，没有从页面取得 granted/denied/default/unsupported 值。仅 true/null 既不能证明已授予权限，也不能证明请求正在等待；本批不读取隐藏 Notification 全局，不通过环境开关、对象注入或其它用户浏览器制造权限失败。源代码译文冻结风险仍只是候选，不能用正常页面冒充错误路径验收。

因此不实施 General/翻译/架构产品修复，不分配 after 页面/服务，也不为未改产品重建 UI。未满足要求是通知错误原地重译、跨页错误保留和三种非 granted 摘要的真实验收；影响限 General 通知反馈，真实权限结果/是否等待的根因仍未知。阻塞是当前支持界面没有提供可观察的非 granted 结果与可操作权限请求，不是模型/凭据问题。后续需真实可观察该条件后再修，不以此声称候选已解决。

本批只清理已证明的相关过期测试断言：宿主测试在已验证原交付 payload 后，以后续 delivered 长度保持 1 证明拒绝时不调用；Tauri 已验证原生命令 payload 后，又以 delivered=[] 证明未走网页构造器。删两条及后一处只为负向断言服务的 delivered 绑定，保留明确 true/false 交付回执、权限结果与实际原生命令载荷正向合同。浏览器测试标题改为当前权限的交付回执，不改变宿主实现或另抽平行路径；修后只跑此聚焦纯 API 适配器测试。

本人 IAB 35 已关闭，38950 正常公共 shutdown，原启动句柄 23256 exit 0；初始语言/通知偏好已恢复，没有发送通知、模型、消息或使用凭据。当前没有权限队列异常的真实证据，不把 UI 信息不足升级为已证明调度问题，也不把它降为偶发或模型原因。

## 本批交付范围与未完成项

聚焦 `bun test ./test/notification-host-transports.test.ts` 6 测试/17 断言通过，保留原权限请求返回、网页/原生交付回执、原生载荷及原异常响应。这是纯宿主 API 适配器夹具，没有 DOM、组件或页面渲染，不冒真实权限/通知送达。docs:check 352 操作/26 组、architecture-index 20 文档、差异检查通过。仅删除两条负向核心断言及对应局部绑定、调整一个测试标题；没有产品代码/翻译改动，未重跑无关完整构建。

原通知错误冻结候选未修，三种非 granted 路径与真实异常诊断尚未完成实页验收，事实和阻塞如上。最终提交精确测试清理、本记录、三张已查看截图/只读观察及三个明确“调查/未验”索引入口，保留原 177 条工作区更改；正常提交、上游合并及推送后进入下一批已独立审计的项目 ZIP（压缩归档）功能候选，不把本批包装为错误修复完成。
