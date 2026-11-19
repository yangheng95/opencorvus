# 网页按实际发布位置选择默认服务

## Recall

- 用户要求独立持续迭代，按批次先落盘根因和完整影响，再实施、聚焦正向测试、真实 Windows 桌面互动与逐图复核、提交、合并上游及正常推送。上一批 `eecfb353f`、`670bd36ce` 已推送，分支与上游 0/0，保留原 177 项状态。
- 读过 10 月 5 日连接恢复记录、本月连接键盘、等价地址和 SDK（Software Development Kit，软件开发工具包）逻辑路由记录。读过当前 05-config、server-runtime-readiness、`default-server.ts`、`api-state.ts`、`api.ts`、`settings.ts`、`init.ts`、host transport（宿主传输）、持久设置、`utils/i18n.ts`、`overlay-ui.ts`、Vite 配置与实际产物。全仓查 `serverUrlFromOverlayLocation`、`originOnlyServerUrlFromOverlayLocation`、`currentDefaultServer`、`DEFAULT_SERVER`、`oc_settings`、资源前缀及同语义测试。三个旧发现函数没有模块外调用。真正的应用默认端点由 `DEFAULT_SERVER` 给设置及请求模块共用。
- 目标是首次访问反向代理后的页面时，浏览器直接采用实际部署前缀，完整加载项目，设置显示同一地址。根路径、普通代理路径、含 `ui` 的代理路径和更深的页面文档均应使用各自真实目标。显式持久配置优先，独立宿主的共享环回默认地址和本机托管进程换址继续原有合同。
- Vite 6 的相对构建让产物资源相对部署位置加载。当前构建与服务端重写的真实产物证明模块位于公开的 `/ui/assets/`，语言路径也已基于 `import.meta.url`。把模块地址用作发布位置为本批据此作出的设计决定。[Vite 6 构建文档](https://v6.vite.dev/guide/build#relative-base)

## 基线、根因与完整影响

1. 新 Chrome 隔离环境访问 `40218/team/ui/edge/ui/`。真实反向转发把 `/team/ui/edge` 去掉，无 `X-Forwarded-Prefix`。HTML（HyperText Markup Language，超文本标记语言）文档、主模块和英中两个语言文件均是 200。页面显示 Offline，Network 表单默认 `http://127.0.0.1:40218/team`。代理记录实际 `/team/global/health` 回 404。正确 `/team/ui/edge/global/health` 为 200，指向独立服务 `40214` 的健康目录。随后通过页面把地址改为完整前缀，真实保存显示 Saved，返回应用见 Online。同一服务全过程在线，错误是浏览器选择的目标。
2. `serverUrlFromOverlayLocation` 将文档路径按 `/` 分段，取第一个 `ui` 前的路径。反向代理可以合法把 `ui` 用于前缀，网页也可在 `/ui/` 之后有多级文档路径，取第一个或最后一个都可能截断或多取。服务交付已经正确定位资源，只有默认连接仍依文档路径猜测。`initApp` 先载入单一设置文档再同步至 `configure`，后续健康检查及任务/项目/会话读、事件等统一使用已配置请求基址。重复健康检查继续请求同一错误地址，无法从重连修正发现。
3. 普通 `/ui/` 和不含 `ui` 的常见部署前缀让此前猜测偶然正确。10 月验收主要验证离线找得到 Network，显式配置来源存在未知；此前 SDK 验收不覆盖完整子路径网页。`originOnlyServerUrlFromOverlayLocation` 已无调用，也不能处理任意前缀。完整修复应删除这些旧发现实现。
4. 本批只改变浏览器初次默认地址选择。实际发布 UI（User Interface，用户界面）模块的同源 HTTP 或 HTTPS（Hypertext Transfer Protocol 及其安全版本，超文本传输协议）地址给出正确的前缀。以模块目录末尾 `/ui/assets/` 为标识，按其实际拼写移除发布后缀。独立静态和本机宿主使用现有共享环回默认，托管本机服务由现有原生地址确认。嵌入的文档也用自身 origin 核对模块来源。
5. 已保存的 `oc_settings` 和原生偏好继续优先。已有错误地址若已经明确保存，仍可在原 Network 表单纠正。持久文档不携带地址来源，自动把可能是用户真实选择的地址覆写会破坏原契约。配置格式、数据库、发布/安装和模型凭据均无需改变，未发送消息。真实观测为健康请求的路径错误，未进入任务执行、调度、队列、重启恢复或终态，未出现执行归属异常。
6. 风险为混淆文档与资源位置、误用跨源模块，或者把重建的默认值覆盖持久设置。以当前服务已明确交付的同源模块目录为据，删除旧路径猜测，不增加服务器传递字段、备用探测或额外存储。根、普通前缀、重复 `ui`、嵌套文档和特定宿主行为均各自验证。

## 方案与验收

1. `default-server.ts` 用一个可聚焦测试的解析函数读取当前文档 origin、当前模块 URL（Uniform Resource Locator，统一资源定位符）。真实同源发布模块从固定末尾目录得出服务前缀，其他宿主使用共有环回默认。保持 `DEFAULT_SERVER` 单一导出值，删除原位置扫描和无调用的 origin-only 选择。无需界面文案或样式。
2. 聚焦正向测试确切默认地址，覆盖根、重复前缀及独立宿主，再运行同源请求、Connection Save、启动诊断、Overlay 类型/语言/样式、正式构建和文档检查。测试不操纵 DOM（Document Object Model，文档对象模型）或渲染页面。
3. 真候选服务 `40216`，隔离反向代理 `40220`。首次访问含 `ui` 的部署地址，截图人工核对 Online、项目与设置地址；检查代理上实际健康和项目接口成功。新上下文复核嵌套文档及有转发头的普通前缀，直接根 `/ui/` 复核。通过页面保存另一自有端点，并用同一浏览器上下文重载以确认真实选择优先。通过固定隔离根和真实公开接口关闭服务，不接触用户窗口、存储或凭据。不调用模型。
4. [基线截图与转发记录](../../artifacts/2026-11-19-mounted-ui-server-default/README.md)。完成后范围提交、合并上游、检查完整待推集合并正常推送，继续下一批。

## 实施与验收结果

- `DEFAULT_SERVER` 由一个解析函数选定。删除按文档 `pathname` 扫描 `ui` 和未调用的仅 origin 函数。保持单一持久文档及原保存、配置发布和连接探测路径。没有新增界面文案或样式。
- `bun test ./test/default-server.test.ts ./test/connection-settings-endpoint.test.ts ./test/api-authority.test.ts ./test/connection-startup-diagnostics.test.ts` 共 34 项通过、103 次断言。Overlay 类型、双语、样式令牌、正式构建与渲染器公开面均通过。文档及架构索引检查通过。
- 本人在隔离 Windows Chrome 逐图复核。首次打开 `40220/team/ui/edge/ui/` 显示 Online 和 `mount-path-review` 项目。Network 显示完整的 `/team/ui/edge` 及 `candidate` 目录的实际代理作用域。嵌套文档 `/team/ui/edge/ui/tools/ui/details`、带 `X-Forwarded-Prefix` 的 `/team/edge/ui/`、直接 `40216/ui/` 在各自新上下文在线。转发实录中，两种前缀的健康检查和项目发现均为 200，并加载了两种语言。
- 继续在同一候选页手动保存 `40218/team/ui/edge`。真实保存显示 Saved。重载后候选页面仍由 40220 提供，Network 地址保持为 40218，项目的代理作用域是另一服务的 `baseline` 目录。这个行为证明真实意图优先于首次默认连接。对于以前已手动保存的错误地址，原 Network 纠正入口依然适用。
- 专用浏览器关闭。两服务经启动归属和健康目录核对后正常停机，两转发器通过各自控制输入正常关闭，四个端口均释放。未发送消息或使用模型凭据。本轮实际验收是本机 HTTP 和 Windows Chrome；安全加密站点的地址逻辑及本机宿主由聚焦测试覆盖。
