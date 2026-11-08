# 设置中刷新时间的语言与键盘阅读

## Recall

用户要求持续批次并行体验 UI（User Interface，用户界面）/UX（User Experience，使用体验）与调查功能，先分析并落盘 specs，再修复、真实桌面交互/截图人工复核、聚焦正向功能测试及需要时授权的 GPT-6.1 Sol 端到端验收，范围提交、上游合并和正常推送后继续。第一批 7b817212e 已正常推送，完整推送钩子通过，main 与 origin/main 为 0/0；原 177 条已有工作区状态保留。新批继续不建分支或工作树、不发布、不操作用户既有窗口/服务。

两名只读子代理分别核对设置时间来源/Tooltip 和 Explorer 键盘线索，均未委托、改文件或运行 UI 自动化。后者确认当前键盘合同先 Tab 聚焦行再 Enter；输入框 ArrowDown/Enter 不属打开契约，不能据上批中间态修复。设置审计确认两处原生 title 绕过 localeTag，成功时间来自真实 fetchedAt，不是持久历史。主代理已读 ProvidersPanel 全部刷新/作用域生命周期、provider-refresh 服务、utils/time、utils/i18n、Tooltip、TodoProgress 相同 span 触发器、Appearance/locale-preference、相关样式及 07-panel/07-panel-reactivity/05-config；全仓搜索无参 toLocaleString、两时间 signal 的定义/写入/消费和旧刷新规格。全 overlay 只有这两处及 Evolution 授权日期还用无参 toLocaleString；后者无当前真实记录，作为后续待验收候选，本批不改。

权威资料已打开 [Kobalte Tooltip](https://kobalte.dev/docs/core/components/tooltip/) 和 [W3C（World Wide Web Consortium，万维网联盟）Tooltip 模式](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/)，结合安装 0.13.11 和当前公共补丁核对焦点打开、Escape 关闭及 aria-describedby（无障碍说明关系）。在线 Kobalte 为 0.13.14，不据文档版本假定本地行为；W3C 页面注明模式仍在完善，不将它当已完成共识的标准。复用仓库公共 Tooltip，不新写键盘处理或弹层状态。

## 深度与影响分析（实施前）

代码观察：ProvidersPanel 两个成功刷新说明 span 的 title 使用 new Date(ts()).toLocaleString()，相对说明则使用当前 t。界面语言不同于浏览器默认语言时，完整日期与正文不一致；原生 title 没有键盘焦点入口，实际可视复现正在新隔离 38922 中文页面取得。直接触发为成功刷新后读取完整日期，localeTag/preciseStamp 已是统一语言事实，旧相对时间本地化及刷新范围修复没有触及完整日期。

数据/控制流：两个 signal 初始 null，目录刷新/在线模型刷新分别仅在规范刷新成功后接受 result.fetchedAt；目录、连接权限修订或选择轮次变化清空，结果通过已有序号/权限/目录所有权发布。没有持久恢复来源。preciseStamp 保留原毫秒时间并按 localeTag 格式化到秒，localeTag 订阅 appStore.localeSeq。时间错误是呈现边界遗漏，不是后端时间或恢复问题。不改公开接口、SDK（Software Development Kit，软件开发工具包）、配置、权限、请求、模型、数据库/持久格式或迁移；未发现调度/队列/唤醒/终态异常。

方案：在 ProvidersPanel 建立两个既有重复说明共用的轻量刷新时间呈现组件，用现有 Tooltip.Root/Trigger as=span tabIndex=0/Portal/Content 及 preciseStamp；保留原相对说明和 .provider-refresh-meta 样式，删除原生 title。两个生产者只传原 fetchedAt 和本地化说明，共享一个当前完整时间实现，不新建缓存、时间来源或持久状态。可键盘阅读完整日期是此问题相关的体验改进；Escape 交给公共弹层，保持设置页与触发焦点。先记录真实前态，再按此落盘决定改产品。

风险是新增焦点入口影响 Tab 顺序、提示超出窗口或 Escape 关闭整页；真实页面逐项复核。当前主题沿原样式，若真实截图显示焦点或排版问题再修正。没有组件、DOM（Document Object Model，文档对象模型）、源码文案或快照测试；本批是纯界面呈现，不新增或运行 UI 自动化。类型/构建/语言检查仅作编译辅助，不能替代截图。

## 资源与验收

新临时根 opencorvus-iteration-20261108-b02，全新 OPENCORVUS_HOME 与空项目，无真实数据/凭据复制。原开发模式 /ui，before 38922、after 38923，模型额度 0。公开 models.dev 目录刷新不需要 API（Application Programming Interface，应用程序接口）密钥；不执行依赖共享凭据的在线模型刷新，也不宣称该生产者端到端已运行，两个说明的同一呈现由实际目录刷新验证。截图与实际日期属性/提示保存在本批 artifacts。

前态取得中文设置 + 真实成功刷新时间的浏览器默认格式。改后普通构建，新进程捕获新前端，实际 Tab 阅读完整时间、Escape 保持设置页/焦点、中文和英文格式及显示密度、切页后的生命周期；不注入时间或伪造刷新结果。正常关闭本人标签和实例，消费原启动句柄至 0，完成文档检查、范围提交、上游同步和普通推送。若无真实失败或模型刷新授权，不制造该状态或将未覆盖分支冒称实页验收。

## 前态与最终决定

38922 中文实页实际点击公开目录刷新，目录由 88 更新为实际 236 项，成功说明为“服务商目录 · 刚刚”，原 title 为 `11/8/2026, 3:32:27 PM`。原属性保存 before-date.json，01 中文截图已本人查看。第一次读取使用审计描述里的“上次目录刷新”而未找到；重新读取实际 DOM 后按当前“服务商目录”精确读取，未改产品适配假定文案。原生 title 不能通过当前页面截图呈现其浏览器提示，前态明确以实际 DOM 属性补证，不称截图包含完整日期。

修改前最终决定采用上述共用 Tooltip 呈现，完整日期用 preciseStamp，不改数据生产或请求；这使后态的真实完整时间可通过键盘直接显示并截图，而不是以标题属性或构建冒称视觉复核。模型在线刷新共用同一个呈现组件，保留未运行该生产者的验收边界。Evolution 授权日期仍不在本批修改范围。

## 实施与验收结果

两处重复 span 替换为同一 RefreshTimestamp；沿现有 Tooltip 和 preciseStamp，保留真实值、相对说明和样式，删除原生 title。没有新增事件处理、时间状态、网络请求、CSS（Cascading Style Sheets，层叠样式表）或测试。公共架构同步当前语言及焦点语义。Overlay 类型检查、两语言/2914 键、普通 Node.js（JavaScript 运行时）构建和 renderer public surface 检查退出 0；最终普通前端 main-D7j_6bAJ.js 由 after 新进程捕获，不替换运行中资源。构建有已有第三方注释、模块指令和体积提示，但构建与原检查完整通过。

真实 38923 后态页面实际目录刷新成功，从搜索框 Shift+Tab 聚焦成功时间，02 截图显示完整 `2026年11月08日 15:36:18`；03 实际 Escape 后提示关闭，设置页面和“服务商目录 · 刚刚”焦点仍在。通过原 View/语言菜单原地切换同一成功时间，04 显示 `Nov 08, 2026, 03:36:18 PM`，没有再次刷新、重新挂载或注入时间。05 原菜单切浅色后同一英文时间、可见焦点与正文均清晰。五张 1280×720 实页截图全部本人查看；没有用 DOM 属性或构建替代后态完整时间的视觉复核。

辅助读取焦点时，宽泛 document.querySelector 首先取得背景工具页“新标签页”，不是设置的 selected tab；不据该值判断页面状态，03 截图和真实设置页验证归属。最后实际切外观再回 Providers，刷新时间按原面板挂载生命周期清空，目录与配置继续正常展示；不新增持久恢复。当前完整模型目录已真实更新为 236 项，并非初始内置 88 项；原状态与两语言切换均以实际结果描述。

before/after 本人标签 4/5 已关闭，两次公开 shutdown 均 200，原始启动句柄 43693/47190 正常退出 0，prompts 为 0。没有凭据复制或模型调用。在线模型刷新生产者、刷新失败状态及 Evolution 授权时间本批未执行或修改，不将共享呈现的实际验证扩大成这些生产者的端到端证据。GPT-6.1 Sol 验收不适用于本次纯呈现改动，没有声称运行。docs:check 352 操作/26 组、架构索引 20 文档和差异空白检查通过。
