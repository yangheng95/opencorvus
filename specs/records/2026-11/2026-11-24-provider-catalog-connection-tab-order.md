# 公开服务商目录展开后的连接控件顺序

## Recall

用户要求本人独立持续分批体验、先落盘根因和影响、实施、实际桌面操作和人工截图、聚焦正向检查、提交、上游合并和正常推送。上一批表单焦点 `99f6e82c1` 已回读远端和同步，177 项原有状态保留。本批正式接口的真实公开目录和自有项目配置在无认证文件的独立开发服务中。只展示和聚焦控件，无账号连接、密钥写入、试验或模型请求。

已读 `ProvidersPanel` 目录行的 `expandedCatalogProviderID`、`authMethods`、原生 Configure、Connect、`ApiKeyEditor`、`handleAuth` 与自定义行的独立连接动作，目录行样式、`providerAuthMethods`、正式授权方式读接口和连接入口、设置键盘导航。全仓检索 `provider-catalog-configure`、`provider-row-key`、`providerAuthMethods`、`llm.auth_connect`、相关作用域及已有测试。对照 [面板架构](../../current/architecture/07-panel.md)、[服务商架构](../../current/architecture/06-provider.md)、[服务商搜索键盘](2026-11-24-provider-search-keyboard-navigation.md)、[万维网联盟展开模式](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) 和 [焦点顺序说明](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)。触及范围内无界面自动化测试。

## 可观察现象、根因与影响范围

实际 `41010/ui/` 加载 `main-BQ7I9OXA.js`。英文 100% 按 Up 从搜索到 OpenAI 配置按钮，回车展开。同一按钮获焦，Connect 才出现在它左边。下一次 Tab 直接进入 OpenAI 的 API 密钥输入。连续两次 Shift+Tab 才到 Connect。中文 160% 同路径也先到密钥输入。真实项目配置的授权方式读取对 OpenAI 投影三项，对 OpenRouter 投影零项。OpenRouter 展开后直接 Tab 到密钥输入符合其实际只有该入口的界面。 [桌面基线](../../artifacts/2026-11-24-provider-catalog-connection-tab-order/README.md)

目录的展开状态控制两个分散的渲染点。打开 Connect 时把它插入 Configure 之前的头部动作块，API 密钥输入在 Configure 之后的内容块。原生按钮焦点保持在触发器，正向 Tab 从它后面的内容开始，已插入的账号入口在反方向。此前方向键修复让搜索直接到 Configure，仍沿用这份排布。公开写入路径与控件的身份并未出错，键盘顺序的根因是展开内容在文档和视觉结构中的分布。

影响限公开目录里拥有账号连接方式的展开项。连接由现有完整提供方 ID（标识）、项目或全局作用域及既有确认处理，密钥与凭据入口不变。实际有无账号方式的投影、目录读取保留、计数、关闭时触发按钮和自定义服务商行沿原实现。无认证错误、状态变化、队列、调度或执行轮次异常证据。

## 方案和验收

将一个现有 Connect 按钮移到 Configure 后面的同一展开内容中，位于原生 API（应用程序接口）密钥控件之前。展开触发器保持原位置与焦点，由原生 Tab 向前进入真实账号入口，再到独立的密钥输入；Shift+Tab 反向沿同顺序返回。已有账号读取、出现条件、请求处理、缺少账号方式时的单一密钥入口和打开/收起仍由当前状态及组件控制。两个入口按视觉顺序排列，不新增快捷键、配置和文案。

在真实英文 100% 和中文 160% 以方向键进入 OpenAI，分别用 Enter 或 Space 展开，浏览 Configure、Connect、API 密钥的正常与反向焦点，并在原触发器收起。对 OpenRouter 复核原单入口及自定义项目结果。本人查看实际截图，正式回读两类授权方式、真实公开目录、保留项目配置及零认证和零执行活动。聚焦非界面契约、类型、双语、样式、构建、文档与架构后，完成范围提交和正常推送。
