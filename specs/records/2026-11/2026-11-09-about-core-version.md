# 关于页 Core 版本来自当前健康探测

## Recall

用户要求持续分批迭代到明确停止，最新要求本人独立、不委托。每批先落盘根因与影响分析，经真实桌面交互、本人复核截图、聚焦正向检查、范围提交及正常同步推送。前批 `0a1766d79` 已正常推送，本地/上游 0/0，原工作区 177 条状态未变。GPT-6.1 Sol 凭据授权无新答复；本批不读凭据或模型目录、不调用模型。

已读 ConfigDialogHost 的 About 运行摘要、`aboutTechnicalRows`，Config.Info、配置刷新、`global.health` 的应用接口（API，Application Programming Interface）及生成的 SDK（Software Development Kit，软件开发工具包）类型、Installation.VERSION、apiJson 与 API-state authority，连接 monitor、启动回执、工作目录探测、连接偏好确认、原生托管服务器同 URL 轮换、Chat 成功路径及 connection-startup-diagnostics/API authority 的服务测试。已读当前架构 05-config 的连接准入/请求归属、07-panel 的 About 合同和上一批记录。全仓搜索 `coreVersion` 仅有 appStore 声明和空字符串初始值；`global/health` 在 Overlay 仅由连接服务读取。现有受检测试是服务测试，不含界面渲染、浏览器或截图基线；本批不新增或运行界面自动化。

## 根因与影响分析（实施前）

上一批前后均在真实连接上看到 Core 不可用，而独立 HTTP（Hypertext Transfer Protocol，超文本传输协议）健康响应为 `local`。本批用 39029、独立项目/profile、桌面页 IAB120 重现：About 显示 Connected、Browser、原服务地址，却显示 Core Unavailable（01）；同一服务运行接口的 `/global/health` HTTP 200 且按实际 OpenAPI 契约验证，原值 `healthy:true, version:"local"`，两个项目接口也匹配该独立项目。前态页和服务已正常关闭并消费退出 0。

控制流：服务从 Installation.VERSION 读进程版本，`global.health` 响应与生成类型均已有 string；同一浏览器/Tauri 连接探测通过现 HostTransport 得到响应，检查请求 authority，发布路径和连接状态，却从未给既有 `appStore.coreVersion` 赋值。About 用项目有效 `/config` 中的 `version` 作事实源，Config.Info 不定义此进程版本；旧配置读/刷新、语言切换、连接重试和不同项目均无法补全错误来源。该版本与项目目录、前端构建版本及原生进程标识各自独立。About 另有可选平台/Go 信息，无可观察问题或权威来源证据，本批排除；保持服务地址、进程标识、路径、连接控制和更新策略原语义。

实施：现连接服务用生成的 GlobalHealthResponse，接受当前 authority 的实际 `healthy:true` 响应时把原版本写入既有 appStore 字段，与 online 状态同一批发布；`onHealthy` 仍收到原探测的精确 authority。探测最终离线清除版本；URL/认证变化或确认的原生同 URL 轮换通过既有 onAuthChange 清除，项目目录改变不推进此 authority。异常/不完整响应不能提供版本，旧 authority 响应不能发布。保持数据库不可用时的已有效运行路径诊断和现离线处理。About 直接读取字段，无配置后备、第二请求/轮询、版本别名或人工构造值。`local` 原样呈现。沿用已有连接探测和相同 authority 内的响应接受语义；不将版本推断为进程身份。无持久数据、配置 schema、接口、发布或更新日志改动；本批只有连接诊断，未观察到 Task/Mission/Session 执行轮次、恢复或终态异常。

风险是旧端点或旧托管进程版本泄漏、背景探测使已在线界面闪烁、恢复时没显示新值、错误把空值或项目字段当版本。已有 authority 保护和 probe 生命周期作为控制点；聚焦服务测试验证背景探测成功时当前版本/online 及旧请求完成后的新 authority 精确版本。真实同页重连使用同端口、同独立 profile/项目的新进程，给真正启动的进程设置明确的 `OPENCORVUS_VERSION` 标记并以健康响应核对；不模拟接口、不操作用户进程。浏览器路径实际验证，原生侧车行为只做服务契约范围验证，不能宣称安装版验收。

## 验收

39030 正常开发 `/ui`，从真实 About 展开技术详情看到原样 `local`；切换中文仍显示原值与正确连接摘要。正常关闭自有服务，等待同页确认离线、版本不可用；重启同一项目/profile/端口，实际健康版本改为 `0.0.0-b54-recovered`，不刷新页面，等待已有 monitor 自然恢复并截图复核版本、地址与原路径。保留前态、英/中后态、离线和重连截图。三阶段实际健康、当前项目和项目列表各验证 HTTP 200/OpenAPI，恢复项目 ID 与前次相同。聚焦服务测试、类型、语言、正常构建及文档检查；所有隔离进程正常退出，原 Git 文件/提交和零任务/消息/模型调用数据一致，原工作区状态保留。证据目录：[真实桌面与服务回执](../../artifacts/2026-11-09-about-core-version/README.md)。

## 真实验收结果

39030 同一个桌面页（121）手动打开 About、展开技术详情，英文显示 Connected 和 Core `local`（02）；用菜单切到中文，同一展开项显示「已连接」、原样 `local`、相同地址和项目目录（03）。正常关闭自有服务后，现有监测自然变为「未连接」和 Core「不可用」（04）。同一项目/profile/端口启动另一个真实进程后，无刷新、无额外探测操作；同页恢复「已连接」并显示健康端点报告的新版本 `0.0.0-b54-recovered`（05），工作目录和地址仍相同。本人复核全部五张原始桌面截图。

前态、后态和恢复各 3 项真实 HTTP 200 均按运行时契约检查；恢复与初次后态的项目标识 `prj_h879AbrcOT3dkLymS0hz` 及工作目录相同，三次原服务会话各自正常退出 0。隔离原 Git 文件和提交一致，各数据库 1 个项目，0 个会话、消息、任务、Provider 用量和活动请求；独立配置无文件。Overlay 聚焦诊断服务测试 7 通过（含当前版本、旧端点晚到、新端点正确、原启动失败与数据库不可用诊断），类型和双语 2935 键检查通过；正常构建 54.15 秒（`main-5bV3Cvaq.js`），文档与架构检查通过。未调用模型，未实测原生安装包。
