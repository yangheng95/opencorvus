# 377 嵌套页面语言资源与启动失败呈现

## Recall

用户要求持续自主改进 Sources、渲染和 UI（User Interface，用户界面），最新要求仅单 agent，不委托。376 已提交并推送 379782230c58fd0239ef2ebc4c2a6e5c1b427a10；本轮开始工作区干净。实际 /ui/inspect/resource/ 请求错误的嵌套 i18n 地址，HTTP 200 返回 HTML，JSON 解析失败，截图停留 Preparing Environment。证据见 ui-resource-snapshot-376/after/04-nested-path-observation.png 和完整网络、console 归档。

已读 i18n.ts、main.tsx、index.html、native-menu.tsx、Markdown worker 入口、Vite 配置、renderer-public-surface checker、语言加载测试、当前 07-panel 和 server-runtime-readiness。全仓检索 __OPENCORVUS_ASSET_BASE__ 只找到加载器和测试，生产无赋值；检索 acceptance-startup 只有 HTML 的模拟加载/失败/主题入口，删除这些触及的 UI 夹具。旧语言测试假设不存在的 VS Code 注入方，并保留不再请求的负向断言，本轮替换为加载数据和明确错误合同，不运行旧测试。

## 根因及影响

加载器向 fetch 传相对页面的 i18n 路径；服务端首页资源重写只覆盖 HTML 的 assets/i18n 引用，无法改变 JavaScript fetch 的定位。加载异常使 main 顶层 await 拒绝，既有 startup 只接收 Native 环境准备事件；Web 提前返回还跳过 Retry 绑定。main 的错误日志又调用未加载字典的 common.error，产生额外 MissingI18nKeyError 日志；该函数仅日志并返回 key，并非再次 throw。纠正 376 记录中“MissingI18nKeyError 阻断”的错误推断，真正中断是最初 JSON 解析拒绝。

主页面初次加载、initApp 重用加载函数和原生窗口共用此加载器。Markdown worker 由请求注入语言数据后 setLocale，原生菜单接收已翻译菜单模型；均不增加独立语言目录。静态图片交给 Vite 的现有资源转换，需在真实嵌套页面查看。没有 Task/Mission/Session 调度、队列、数据库或 Provider 协议改动；实际错误请求与调用链已解释故障，无证据指向调度异常。

## 实施

语言文件以执行模块为定位来源，沿当前 dev utils / build assets 的同级目录结构定位 ../i18n；删除无生产写入方的全局 override。保留既有完整静态语言发布目录和缓存，避免加入第二套语言资源。参考 [Vite 官方静态资源说明](https://vite.dev/guide/assets.html#new-url-url-import-meta-url)：变量 URL 保留原生 import.meta.url 解析；通过真实构建和页面确认实际结果。

把 index 与 main 之间既有启动 Promise 替换为一个启动生命周期对象：ready、完成接管；启动画面拥有接管前的真实 window error / unhandledrejection，复用现有失败呈现，保留原始错误，前端失败 Retry 刷新当前页面，Native 准备失败仍调用原重试命令。接管时移除临时监听器，不保留平行错误画面。同步公开表面声明。语言就绪前的日志直接保留原错误，不查询缺失翻译。清除未使用的 acceptance-startup UI 模拟分支。

## 验收与边界

聚焦语言服务的正向数据及错误合同，类型、构建、文档、公开表面检查。禁止 UI 自动化测试或 UI 注入。实际独立开发服务 /ui/inspect/resource/ 及 /ui/：人工截图观察、真实 GPT-6.1 Sol 读文件产生 Source，再点开来源查看。另用正式产物私有副本删除一个语言文件后启动真实服务，人工查看真实 HTTP 404 的错误画面并点击重试；不拦截网络或伪造事件。

预声明独立 locale-bootstrap-377-after（18384）和 locale-bootstrap-377-failure（18385），每个 NativeService 固定 600000ms / 12 Provider 请求，沿原 launcher、auth/models 成对复制和三项预检、原进程 join 与完整清理协议，不延长或重用运行轮次。私有 Bun 及正式 UI 构建不触及用户应用。结束更新根/月/产物索引和当前契约；范围提交、fresh fetch/merge、待推送集合审查和普通 push。未验原生窗口、反向代理、其他平台需明确记录。goal 保持 active。

## 实施与验收

已删除无生产赋值的资源 override，以原生模块 URL 解析已发布语言目录；JSON 解析失败附实际资源地址并保留 cause。启动生命周期取代原单 Promise，移除模拟启动/主题参数。主入口在语言就绪前保留原错误日志，不再查询空字典。原生进度在前端失败后保持当前失败诊断；原生准备 Retry 命令保持原合同。触及的公开表面检查是安全接口清单，未做 UI 文案或布局断言。

4 tests / 8 assertions 全通过，类型检查 66576 exit0，私有正式 build 53476 exit0 / 约61s。18384 的真实嵌套、根入口均成功，实际 gpt-6.1-sol 读取文件产生 L2–3 Source 并点击高亮正确。18385 的真实私有目录移出 zh-CN.json 后，页面显示真实 404 和 Retry；人工点击再次产生文档和语言 GET，仍明确显示未解决错误。5 张截图逐张人工查看，详见 [证据与限制](locale-bootstrap-377/README.md)。

原 launcher 48038 / 42687 实际 exit0；Native 88720 / 51374ms；5 / 2 次 Sol streaming HTTP200 EOF，均小于预声明600000ms/12请求。后者只运行 Provider 预检，不冒充失败页面任务执行。所有临时 auth/models、进程、输出、请求、端口和自己的202/203页面清理闭合。真实运行检查器验证 Source range/ToolOutcome/文件完整字节、两次语言200和实际重试404、Provider与Native收敛，不断言UI。未运行原生桌面、反向代理和其他操作系统，未测试所有异常种类。
