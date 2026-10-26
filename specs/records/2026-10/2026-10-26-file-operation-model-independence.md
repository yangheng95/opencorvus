# 文件操作与模型可用性边界

## Recall

持续自主改进产品UI（User Interface，用户界面）、UX（User Experience，用户体验）与功能，只用当前单agent（代理）；旧Goal（目标）中的Astra并行描述被后续单agent要求覆盖。不重查已解决Rendering/Sources闪烁，不恢复独立首页Goal创建区。上一轮f990a067e正常提交推送，2026-10-26 15:36:51 UTC（协调世界时）fresh fetch/merge（拉取/合并）后0/0；本轮开始git status检查177项同行清理、索引排序、发布记录及临时目录保留。641及原exec69105/native/launcher（原生宿主/启动器）、自建tab24全部结清，未复制认证，新模型请求0，累计218。不操作用户18571、用户数据库或用户窗口，不建分支/工作树，不改版本/发布。

## 修改前调查、现象与未知

已读07-panel文件读写/原件/修订/格式化与模型无关读取合同、server-runtime-readiness；当前FileRoutes全部读写声明、project-route-context、server全局Project（项目）准入、Instance.provide/identity（运行/身份）与capability preflight（能力预检）、InstanceBootstrap/validateInstanceConversationCapabilities、File.writeText/notifyEdited/init、Format.file及lazy state（延迟初始化状态）。相关当前正向测试包括file-read-identity、file-save-conflict、file-formatting与project-route-context；本轮没有发现或运行UI自动化测试。

代码事实：GET文件读取已用identity，PATCH /file/content、创建、上传和其它文件变更仍落入runtime，必须经过完整会话能力预检；InstanceBootstrap注册的配置验证会核对执行模型。File.writeText自己执行原相对/物理路径权限、文件身份、锁、完整UTF-8（Unicode字符编码）文本、expectedRevision（已加载版本）、原子写入、配置格式化和规范file.edited（文件编辑事件）。Format自己延迟读取Config和配置的原命令，未直接读取模型；File索引也延迟按同一项目状态初始化。现行file-read-identity最后一项明确把缺失模型的文件保存400当作原合同，不能为了过旧测试保留不合适产品依赖。

当前尚无本批真实保存/创建/上传失败证据，不能从路由分类直接宣称用户文件保存失败。问题候选是可编辑的普通文件，在模型不可用上下文仍提供Save（保存），点击后却被无关会话模型预检阻止。旧工作只隔离读取与取消/归档，没有审计完整文件写入边界。需要实际确认及继续搜索全部生产文件变更、事件订阅、格式化/配置/插件与当前runtime复用；在分析完整前不改产品代码。若涉及调度/并发/恢复或终态异常，立即按全部入口/轮次/多项目/重启的共享机制审计。

## 第一阶段实际验证方案

1. 创建仅在自有607测试项目的file-model-boundary-642目录及write-check.txt，明确为可写/可删除的验收数据；保留原summary/README等原件。独立642/38147从完全关闭641只读备份数据库，逐表及13组附件核对，复用未改的正式UI main-BGrTrwC8.js；当前源码开发CLI（Command Line Interface，命令行界面）的/ui，不单开Vite。不复制认证，模型预算0，累计218不变。
2. 实际页面打开该自有文本、输入新内容并保存；无论成功失败均保留真实界面、原HTTP（Hypertext Transfer Protocol，超文本传输协议）原因、文件字节及修订。再实际创建单独验收文件、上传自有非敏感文件，通过公共API（Application Programming Interface，应用程序接口）核对实际结果。不要改用户Provider或把无认证配置故障包装为热认证失效；本轮验证的是文件能力是否需要执行模型。
3. 页面/HTTP通过也如实记录，不制造bug。若确认耦合，先补齐根因、完整变更路径、公共错误/权限/事件/formatter合同、同语义实现、原测试/文档及交付风险，再确定唯一当前实现；禁止fallback（后备路径）、额外配置、双写或模型驱动的宿主流程门。
4. 十分钟关闭目标、20分钟物理边界、至少五分钟结清。先收集实际关键事实，再关闭自建标签/public shutdown、原exec及native/launcher、物理/输出/请求；源历史与原文件核对。后续实现、聚焦正向后端测试及另一独立运行真实验收在本规格追加，不在已关闭服务重绑前端或重启原运行。
5. 产生文件须本轮范围提交、三索引及文档检查、fetch/merge和全部待推集合审查后正常push；不混入177项同行更改，整体Goal保持active。

## 642实际失败、完整根因与确定实施范围

01真实打开write-check.txt并输入新内容后点击Save，原PATCH /file/content返回400/ProviderModelNotFoundError openai/gpt-6.1-sol，输入仍保留、磁盘仍为初始38字节。02/03在目录菜单New file确认created-ui.txt，同样POST /file/item 400；Details保留原请求ID和完整具名错误。上传本阶段使用真实公共HTTP，未冒充文件选择器实测。独立API观察的8个实际请求：GET内容200，save/create-file/create-directory/upload/copy/move/delete七项均400/同一具名模型错误。原写入文件38字节、两个独立移动/删除输入各32字节保持，summary完整201字节保持。只有自有验收输入，没有用户文件变化。

642先结清：自有草稿通过原确认Discard后tab25关闭，公共shutdown200，原exec99207/native/launcher均0，物理/输出/请求结清，余量860476ms。源92表29842行与目标816条原关键事实、13组附件保持；无认证、模型新调用0。当前没有运行中的付费或无认证服务。

全仓实际生产File.writeText/create/copy/move/remove/upload只有这六个HTTP handler调用；模型Tools的write/edit/apply_patch使用各自原执行权属与原Format/事件路径，本轮不改变。所有六个变更路由落runtime，InstanceBootstrap的配置模型引用预检发生在文件handler、路径/版本/上传载荷校验之前；七种操作因此同源失败。旧读取修复刻意保留变更路由runtime，并有file-read-identity最后一项保护原模型错误；该旧合同须按当前独立文件能力替换，不能用测试自洽维持产品断点。

继续审计发现不能只把路由改成identity：完整Bootstrap还调用Plugin.init注册config、service与Bus.subscribeAll事件；直接跳过会使正常冷项目的插件编辑事件退化。FileWatcher/File索引/Vcs各自已有独立状态所有者；本轮不新建部分Runtime、改变Instance.initialized、启动调度或恢复权限续跑。已有活动Runtime的监听继续保持；冷的文件API只准备该文件操作必需的插件，File索引/格式化仍由唯一原实现延迟读取，文件写入的原Bus.publishOwned通知保留。插件初始化当前只有Bootstrap一个调用点，新增文件入口后必须复用同一初始化事实，避免后续正常Bootstrap重复注册插件事件。

确定方案：六个精确HTTP变更路由加入既有Project identity集合；FileRoutes在各原validator之后、实际handler之前使用同一个插件准备middleware（中间件）。该中间件只await原Plugin.init。Plugin.init现有config/service/event实现原样进入createInstanceState的唯一初始化Promise，完整Bootstrap和各HTTP复用它；沿原项目状态销毁、失败移除与重试合同，不加另一个插件仓库/配置或fallback。保留完整InstanceBootstrap对模型工作、配置候选验证和其它runtime端点的原约束，不扩大为所有API免校验。已核对[Hono官方middleware合同](https://hono.dev/docs/guides/middleware)及仓库实际类型；使用原调用链顺序和await next，不替换handler或修改响应。

影响与风险：文件原相对/真实路径边界、根目录保护、无覆盖发布、原锁/expectedRevision、UTF-8、原格式化、文件通知、错误及Project隔离均保留在File原实现。不得只用成功保存覆盖这些合同。聚焦正向验收须覆盖两冷Project的六路由/七操作、原错误400/404/409、真实格式化后正文及下一版本、配置插件事件一次交付、重复插件初始化和完整Bootstrap之后的事件、并发实际写入/修订冲突；以生产Server.App和真实文件/命令验证，不mock模型/路由/文件系统。相关原file-read-identity保存用例改为当前正确保存合同，project-route-context分类同步。发现任何共享生命周期或并发异常须继续横审，不能用本轮单例通过降级。

后续步骤：先写并运行明确输出的正向红测试；再实现上述唯一方案，重跑聚焦测试和类型/接口/文档检查。新643从已关闭642复制并保留输入和原历史，使用不变正式UI/新后端，实际Save、创建和适当文件入口复核并截图；上传、复制、移动、删除用公共HTTP完整回执与真实字节验证，UI未覆盖的动作明确标注。需要进一步UI文件选择器操作时仅使用已文档化浏览器API，不猜测接口或操纵用户窗口。原保存错误正文过长另作已发现呈现线索，本轮先根治模型耦合，不用隐藏错误代替文件能力。

## 实施与聚焦验证

六精确路由、validator之后共享Plugin.init以及原初始化body的createInstanceState复用已落地。修复前实际红测试为3通过6失败；后端类型检查通过。检查器自身的两点已纠正：Bun 1.4的toMatchObject会把收到的revision改成非JSON matcher，故对实际响应的structuredClone断言，原响应继续用于下一请求；上传原API返回宿主路径，Windows使用path.join验收，未为测试改产品路径协议。最终五个聚焦文件完整通过，具体数量随最终日志记录，包含实际跨进程/重启HTTP版本检查。

进一步核对Bus.publishOwned、executeDurableRow、失败回执及重试：Plugin.init注册的原subscribeAll没有durableID，原合同是本次交付成功或明确记录transient投影错误后结清，不是自动反复执行插件；未引入插件自动重试。现有活动Runtime的EventService持久订阅继续沿同一Project状态与原Bus实现；冷identity操作不冒充完整Runtime、不会初始化调度执行。此次没有修改Bus、调度、发生轮次或恢复协议；尚未用实际运行排除独立的冷项目调度订阅需求，不能把本轮插件成功当作全部调度恢复验收。该候选应另按共享机制审计，不能偷偷改变全局重试为identity以绕过模型预检。

643将在同一自有测试输入上实际保存、创建，随后七文件操作HTTP和版本/路径错误检查；每次请求使用真实Server，检查磁盘正文/上传原字节与原summary。只使用新隔离端口38148，不刷新/重启用户18571；无认证、模型预算0，UI复用已交付的main-BGrTrwC8.js，产品改动仅后端，无需独立前端或前端重新打包。

## 643实际完成与交付证据

实际目录打开原write-check.txt，输入保存验证正文，点击Save后原星号结清、Save回已保存，磁盘和公共HTTP回读为完整CRLF（回车换行）正文。原目录菜单New file表单创建created-ui.txt成功，自动打开实际空文件。随后16个公共HTTP观察确认七操作200、原移动/删除入口404/FileNotFoundError、外部更新的过期修订409/FileWriteConflictError、创建重名409/FileConflictError、越界400/FileInvalidPathError，以及原UI结果回读200。上传原字节、复制/移动内容与外部更新原文完整核对，summary原201字节保留。实际目录更新和上传文件原文再由页面手工打开并截图复核；不声称上传选择器或所有调度恢复已经验收。

合计八张真实1280×720原图，[原图与事实](../../artifacts/2026-10-26-file-operation-model-independence/README.md)。643自建tab26关闭后公共shutdown200，原exec30512/native/launcher均0，物理/输出/请求结清，剩余1038006ms。源92表29842行、816条原关键历史与13组原件保持，数据库版本8，无迁移改动，未复制认证，模型新增0、累计218保持。

聚焦正向测试文件file-write-identity、file-read-identity、project-route-context、file-formatting、file-save-conflict合计28项127断言，全部通过；实际跨进程/重启HTTP检查也在原canonical runner（规范检查器）内完成。新增与触及测试连同全部后端源码的tsc --noEmit通过，docs:check通过351操作/26组。格式化器产生的无关排版改动已精确退回，只保留本轮行为变化。完整正常pre-push（推送前）检查与最新远端合并后推送将在下面追加；不得提前宣称远端交付。
