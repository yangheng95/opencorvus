# 设置搜索接管焦点时退场导航提示

## Recall

- 用户要求本人独立持续按批迭代，先真实体验、保存根因和影响，再实施、真实桌面交互、人工截图复核、聚焦正向检查、合并上游及普通推送。第 436 批 `dda0a9b16` 已推送，原 177 条工作区状态一致。本批仅界面焦点和提示退场，不使用凭据或 GPT-6.1 Sol。
- 已读 `AGENTS.md`、[现行界面架构](../../current/architecture/07-panel.md)、[上一批导航提示层](2026-11-23-navigation-tooltip-workspace-layer.md)、`ConfigDialogHost` 搜索聚焦和 Escape、`openConfigDialog`、共享 `SearchField`、`WorkLedgerNavigationAction`、Tooltip 和 Kobalte 已安装的 Trigger、Root、Content、DismissableLayer 及其声明。全仓查 `.config-search`、`settingsSearchInput`、`focusin`、`onFocusOutside`、`closeSettings` 和六个导航调用。触及路径未发现界面自动化测试。
- 参考 W3C（万维网联盟）对键盘焦点可见性的解释和 Kobalte 受控 Tooltip 的原生接口。目标是完整能看到输入和焦点，且保持现有搜索按键合同。 [键盘焦点可见性](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) [Kobalte Tooltip](https://kobalte.dev/docs/core/components/tooltip/)

## 根因和影响

1. 隔离 `40672/ui/` 实际加载 `main-cMILGJOy.js`。1280×720 英文 100%，鼠标停在 Tasks，键盘 Alt+H、End、Enter 打开 About。搜索框已实际聚焦，`focus-visible=true`，盒为 `72,84,199,30`；遗留提示为 `68,89,280,71`，盖住占满宽度的 25 像素高度，包括占位提示、输入内容和大部分轮廓。在当前焦点输入 `MCP`，设置实际筛选出 MCP Connections，但用户仍看不到输入。第一次 Escape 清空值，第二次关掉提示，第三次才退出设置。中文 150% 复现同一操作，实际输入框 `108,126,299,43`，提示 `98,133,420,105`，盖住占满宽度的 36 像素高度。 [基线实拍](../../artifacts/2026-11-23-settings-search-dismiss-navigation-tooltip/README.md)
2. `ConfigDialogHost` 已正确在设置打开时聚焦 `SearchField`。左栏六入口的 Tooltip 开立在独立 Portal。前批把工作台导航提示降到 `--ui-z-overlay`，保证菜单优先；真实 `.workspace-page-stack` 又自成层叠上下文，因此仍低于提示。鼠标停在导航触发器，Kobalte Tooltip 的焦点离开处理默认保留提示。现提示本身仍通过 DismissableLayer 注册为可用退出层，空搜索的 Escape 被它先消耗。仅隐藏外观或修改设置搜索本身不能一并修复焦点画面和按键交接。
3. 影响限于工作台导航提示和设置搜索及其清除动作共存时的输入、画面、焦点和 Escape。保留非搜索状态的滑过/键盘提示、其层、定位、普通菜单交接及搜索查询和下／上键进入结果。共用 Tooltip、共用 SearchField、其他卡片提示、数据、布局、接口、回执、凭据、Task（任务）／Mission（多步任务）／Session（会话）执行轮次、队列、唤醒、恢复和终态无改动需求。基线只打开页面与输入本地查询。没有执行异常。

## 实施与验收

- 给 `WorkLedgerNavigationAction` 的 Tooltip 使用 Kobalte 既有受控 open 接口。将实际设置搜索所在根及其控件作为所有者。当真实焦点进入该处，关闭已显示提示并卸载实际退出层。打开请求同时检查当前焦点，覆盖之前预约的悬停延迟。只在提示开放期间观察其文档 `focusin`，关闭即清理，无单独的设置焦点事实来源或新计时器。新悬停、焦点和正常开闭仍由 Tooltip 产生。焦点离开搜索后使用原规则接受新提示。
- 候选覆盖英文 100% 和简体中文 150% 下的真实菜单入口、键盘输入可见、第一次 Escape 清查询、第二次退出、正常搜索匹配、方向键进入结果和点击清除后的焦点。复核新悬停重新显示提示、前台帮助菜单可用，检查组件和原图，运行现有聚焦正向非界面合同、类型、国际化、样式、构建及文档。用实际项目及隔离持久数据核对范围，关停自有服务，提交、合并上游并正常推送。

## 结果

- `40674/ui/` 加载 `main-BXpIDKhP.js`。英文 100% 和简体中文 150% 分别沿基线打开关于，在指针仍位于任务栏时，实测搜索焦点仍为 `focus-visible=true`，原输入框的可见区域完整，独立导航提示节点已经卸载。输入 `MCP` 后查询、清除、提示和匹配均可见。第一次 Escape 清查询并保持焦点，第二次 Escape 返回多步任务和原帮助触发器。再次主动悬停可完整显示导航提示，未影响前台帮助菜单的原读序。
- 中文 150% 在搜索焦点有效时将鼠标重新移入任务按钮，搜索焦点与可读输入框保持。点击实际清除按钮将焦点留在搜索；从查询框按上方向键聚焦最后一个匹配 `MCP 连接`，Enter 实际进入当前项目的连接面板。本人复核 19 张[实拍](../../artifacts/2026-11-23-settings-search-dismiss-navigation-tooltip/README.md)。没有对内部计时器的精确边界或全部六个入口组合做专项实测。
- 两个服务都读回准确项目目录，`/mcp/project` 及 `/mission` 均 HTTP 200 且为各自的空状态。两份 SQLite 数据库完整性通过，相关会话、消息和模型记录为零。93 字节原始项目文档与提交完全一致。隔离服务正式关停后以 0 退出，两个端口已释放。
- 工作台选择读取与菜单就绪共 5 项、8 断言通过。界面类型、3277 个双语键、9349 处样式令牌引用、正式构建、渲染公开面、接口文档和架构索引通过。未启动运行、写入连接配置或使用模型、凭据。
