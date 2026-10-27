# 附件存储身份与HTTP失败阶段调查

## Recall

继续用户授权的单agent（代理）持续产品体验、功能完善及修复，不委托。旧Goal（目标）Astra文字被后续单agent要求覆盖；不回到已解决Rendering闪烁。上一轮属于实际progress（进展）：1f8fad512修复附件原名/正文链接，fcf6ece2e修复全局→项目→会话草稿回流，真实Sol/原图/聚焦数据契约和全部正常hook（钩子）通过。2026-10-27T13:30:03.226Z再次同步main/upstream（上游）一致0/0；28任务文件清洁、176他人工作保留，722原exec91610/native/launcher0、配对副本退役，模型累计373。当前状态仍同fcf6ece2e/176项。当前Goal入口按用户后来的纠正保留在加号和/goal，不恢复首页常驻Goal区域。

未解决的实际观察：719/720新对话分配项目后侧栏Failed to fetch，服务端已完成列表请求均200（719有75、720有13），720实际Retry恢复；721/722有36/50次200且未复现，不代表根因排除。720模型未认证范围还实际POST/attachment 400 ProviderModelNotFoundError。当前整体功能未完成，不缩减Goal，不把最后错误文案当根因。

已读上一轮Recall/17原图说明/运行与数据审计，当前07-panel和server-runtime-readiness的最小Project（项目）身份/独立于可执行模型的文件操作合同；全仓搜索HTTP（超文本传输协议）transport（传输）、请求失败/阶段、runtime路由分类及实际附件入口。源码覆盖WorkLedger reload的controller/sequence/authority、apiRequest/apiJson、api-state、唯一tauri/browser HTTP request、AppLog与diagnostics、Server权限/CORS/请求ID、project-route-context、InstanceBootstrap.validateConfigCandidate、AttachmentRoutes和AttachmentStore.write。只有根AGENTS.md。原始消息和模型结果保持，不修改用户18571/窗口/数据库，不建分支/工作树，不发布。

## 修改前根因、影响与实施方案

1. 已证实的附件能力边界错误：POST /attachment、POST /attachment/directory-reference只验证/存储字节或路径manifest（清单），实际AttachmentStore不调用Provider（模型提供方）。但project-route-context精确身份集合漏了这两条，落入默认runtime（完整运行环境），Server在handler前执行InstanceBootstrap的可执行模型配置校验。720原错误stack（调用栈）正是该路径，导致未认证/模型不可用时文件尚未存储就400。旧文件read/save/upload等已做身份分离，此前遗漏附件和目录引用，不能清空数据或放宽模型配置来绕过。

修复在现有唯一精确路由分类增加上述两条identity（项目身份），保留全球认证/Origin（来源）/CORS（跨来源资源共享）检查、目录选择、validator（输入校验）、实际AttachmentStore原权限/字节/不可变资源命名空间。不是替代路由/host（宿主）模型流程旁路：实际聊天/Work/Mission/Task（工作/使命/任务）发送和执行仍通过原runtime准入。全入口范围涵盖Composer文件选择/拖拽/粘贴共享POST、原生目录引用POST、直接HTTP调用；模型tool（工具）结果及真实执行中AttachmentStore现有调用保持。两项目/冷启动与重复请求检验各自真实字节和metadata（元数据），所有旧消息/来源/持久格式/schema（数据库结构）9不变，无迁移和SDK（软件开发工具包）变化。

2. 侧栏网络根因仍未知，当前证据缺口已确认：唯一HTTP入口把fetch（发送/接收头部）和readResponse（读正文/解码）放在同一个catch，原样错误没有请求阶段或服务端请求ID。服务端200不能证明客户端读完正文，也不能证明失败的那次到达服务端。先补单一生产入口的只读诊断：host kind、HTTP方法、origin/path（排除查询/URL凭据）、fetch/response_body阶段、已收到的真实状态/请求ID、响应格式、真实signal.aborted、耗时和固定错误类型分类。仅console（控制台）记录，不记录headers/body/query/raw error message/stack（头、正文、查询、任意错误文本/栈），不引入AppLog→api→transport循环或日志上传递归；不新建store（状态库）/监听状态/配置面。原错误对象、权限过期和调用方取消/超时合同保持。已取消请求用debug（调试），当前非取消失败用warn（警告），不吞错误/按关键词过滤/自动重试。该诊断改进不能冒称Failed to fetch已修复。

这是共享HTTP机制，审计覆盖所有生产HTTP调用（Task/Mission/Session读取、正常/错误/取消/过期权限、并行刷新和跨项目目录），不新增模型请求或改变WebSocket/SSE（服务器发送事件）所有者及执行轮次。当前没有调度/队列/唤醒/恢复异常证据；若新证据涉及这些，立即覆盖其全部生产入口/轮次/正常终态/重试重启/串并行/项目隔离。独立模型运行仍需有有效认证/精确目录投影，不把离线文件存储和模型执行资格混为一条路径。

验收：先写真实Server.App附件/目录身份测试，在当前实现确认400失败，再修复后验证同名两项目原字节、规范URL/metadata/目录manifest及明确命名模型错误的执行准入；已有route-context正向分类同步。现tauri-transport-error-body.test只有非UI HTTP/取消合同，没有DOM（文档对象模型）、组件或浏览器页面fixture（夹具），可增加实际本地TCP（传输控制协议）连接拒绝/200正文解码失败的正向诊断对象输出，原mock（模拟）只证明其局部合同。禁止UI自动化/源码文案断言，不用局部mock冒充真实页面；额外新普通Node构建后亲自CUA（计算机交互）体验、原图人工复核、观测真实网络失败。

723/38228从关闭722只读整库备份，保留原166文件/92表原行、7232以上关键事实；完整模型目录复制、auth（认证）不复制、模型最大0且累计373保持。维持已配置但未认证模型的原条件，以验证真正存储修复；不点击发送或创建Task/Goal，不刷新用户认证。真实选择仅自制143字节原件，目录引用HTTP使用自有目录；浏览器原生目录选择不可用则明确不宣称实测原生选择。先检查旧Task全终态/定时定义paused（暂停）和复制逐行相等。新普通UI无注入/替换响应，实际新对话→项目分配→附件保存/移除/再次选择与列表刷新，抓取同一入口的实际console失败阶段和服务器完成日志；未复现只记录有限观察，继续追查。

每个实例10分钟关闭目标、原生20分钟边界/至少5分钟结清，原exec/native/launcher全0、公开shutdown（关闭）200、物理/输出/请求结清后退役目录副本；源认证/目录元数据记录不输出秘密。三索引/当前合同/文档检查同步；原有UI自动化若触及必须删除而非运行，当前纯HTTP/记录契约保留正向测试。任何任务修改都范围提交，最新fetch/merge（拉取/合并）、完整待推审查和正常push（推送），不绕hook，保留176他人工作。Goal保持active（进行中）。

首次聚焦验收实证：新增路由用例修复前2失败/1通过（两种存储400，模型执行错误正确）；改精确identity后3/3通过18断言。旧route-context矩阵仍把两条附件写入列runtime，属于已触及的过期合同，改为identity并去掉新加的重复分类用例，不保留旧初始化。HTTP实际200解码失败诊断已通过，已关闭本地端点的原生fetch实际返回TypeError，初稿误猜Error，按真实标准错误类型修正测试后重跑，不改产品错误来迎合猜测。两次未通过运行均已原句柄退出且物理/输出结清、原证据保留。

723普通main-BweDwgBa.js真实无auth页面原filechooser已成功保存原件143字节/原名和草稿，01原图已查看；同一公开HTTP服务进一步验证规范原件200/逐字节一致、目录引用200和精确manifest、执行会话创建仍400 ProviderModelNotFoundError。实际模型0/累计373。CUA导出console只能看到“[transport.http.failure] Object”，无法读元数据，此处是已证实取证格式不足，不能冒称已读到HTTP阶段。关闭723后原exec10941/native/launcher0、shutdown200、物理/输出/请求全结清，剩917243ms；源92表246149原行/7286关键事实/166原文件保持，目录副本退休，源认证/目录元数据保持。

先把同一白名单对象按JSON单行序列化，保留原控制台级别/原异常，不增加字段/查询/私有内容；聚焦HTTP测试改为解析该实际记录后的完整对象比较。新724/38229从关闭723整库备份、新普通Node构建后再复核真实页面和相同日志导出，禁止热换bundle/重启重置额度。724仍无auth、模型0、累计373，原十分钟关闭目标/二十分钟边界/至少五分钟结清和数据保护合同不变。当前本机正向测试16后端（31断言）及7 HTTP（20断言）通过，前后端类型/普通Node构建通过；新序列化需重新验收。

## 本批结果与明确未解决项

724普通main-KciMKUK9.js页面实际选择原件、移除、重复选择，再新建独立第二项目选择同名原件，两个新Project的物理文件和公开GET均200、143字节逐字节与原件一致，原名和各自文字草稿保持；05原图可见第二独立项目和草稿。真实目录引用POST/GET均200，manifest与规范自有目录一致；真实会话创建仍400 ProviderModelNotFoundError。浏览器原生目录选择器显示桌面限定，本批没有冒称已验收原生目录选择。无LLM调用，累计373保持。

新JSON日志在真实浏览器成功导出三个完整记录：mailbox/work-ledger/mission均fetch阶段、aborted=true、DOMException、status/requestID为空，均为主动取消。相同scope中没有非取消失败。已确认取证字段可用，但719/720偶发Failed to fetch根因仍未知；不能把本次有限未复现或服务端200包装成修复。

724公开shutdown 200，原exec72920/native/launcher均0、物理/输出/请求结清，剩782753ms；配对目录副本退役，源auth元数据和catalog原字节/元数据保持。723/724全部92表原246149/246152行逐一相等，7286关键事实/166原文件全部保持，schema 9/integrity ok。原图01—05均实际查看。最终7 HTTP正向合同20断言、16后端31断言通过，前后端类型和普通Node构建通过。

继续真实操作时发现新的独立缺陷：在724A项目草稿有附件时点全局New chat，文字进入空的全局草稿，但旧附件仍可见（04原图）；这是附件状态归属调查入口，不在本批声明已修复。随后实际移除残留再建立724B，避免错误项目原件进入下一请求。下一批需先分析唯一messageStore附件状态、草稿key、显式导航/自动分配/提交和异步上传所有者，再落盘方案并修复，不能仅在单个按钮清空。Goal保持active，单agent继续。

文档检查通过：351操作/26组，当前架构索引20篇全部链接可用。无API（应用程序接口）schema变化，无SDK生成或数据库迁移。
