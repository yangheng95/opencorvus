# 让文件多选的现有键盘操作可发现

## Recall

用户要求本人独立持续按批体验、先落盘根因和影响、实现后真实桌面与截图人工复核、聚焦正向检查、提交并正常同步推送。上批 `de8deb7de` 已正常推送，本地和上游 0/0，原有 177 项工作区状态逐项一致。本批只在自有隔离项目复制测试文件，无凭据、模型目录或真实模型请求。

已读[文件搜索外选区](2026-11-09-file-search-outside-selection.md)、[批量复制](2026-11-09-file-multi-copy-keyboard-continuity.md)、当前 [07-panel](../../current/architecture/07-panel.md) 的浏览、选区、焦点和文件身份约束。全仓查 `handleRowKeyDown`、`handleRowClick`、`toggleSelection`、`selectRangeTo`、`explorer.keyboard_hint`、`explorer.search_keyboard_hint`、`aria-keyshortcuts`、文件行的 `aria-current` 和路径描述，以及所有上下文复制入口、现有文件测试。相关测试属于服务和数据，不新增或运行界面自动化。参考万维网联盟的[文件树键盘实践](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/)、[列表选择实践](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/)和[无障碍富互联网应用规范的快捷键属性](https://www.w3.org/TR/wai-aria-1.2/#aria-keyshortcuts)；当前组件是可操作的按钮行，不改成另一套部件角色。

## 真实基线、根因和影响

隔离 39096 的真实 `/ui` 提供 `main-BvBrcTbj.js`。英文普通文件列表，Ctrl+Space 在 alpha 行保持焦点并选中（01），原生 Down 后同一快捷键添加 beta，Shift+F10 菜单显示两项（02）。一次快速 Escape→Down→Space 进入了仍在关闭的菜单项，本人取消空的复制对话框，单步确认回到 beta 并使焦点到 gamma；Shift+Space 显示现范围选中 beta 和 gamma（03）。进入真实 `row` 搜索后已有选择保持（04），Ctrl+Space 和 Shift+Space 在结果内继续切换/选择（05–06）。普通提示只有 Browse/Folders/Open，搜索提示只有 Results/Open；已选和未选文件的可访问树没有对应选择说明。没有发复制请求，隔离服务正常退出 0。

源代码 `handleRowKeyDown` 处理无修饰键导航，实际 Chromium 按钮用修饰空格触发现有 `handleRowClick` 的 Shift 或 Ctrl/Meta 分支；真实操作已证明键盘选择存在，不能称为快捷键功能缺失。现 `data-selected` 只给视觉样式；`aria-current` 表示当前编辑文件，不是操作选择；原页脚和文件行未暴露已验证的键位与状态。缺口限现有行为的发现与可访问描述，保留动作和锚点、搜索/普通目录共享选区、Enter 打开和 Shift+F10 菜单、原路径、写入与权限、布局结构和模型/调度。本批不对其他浏览器或操作系统的修饰键转发作保证，也不以新增键处理替代当前已实证的实现。

## 实施与验收计划

在普通列表和搜索的同一现有键盘提示中增加一行本地化 Ctrl+Space 切换选择、Shift+Space 选择范围。两种文件行附相同 `aria-keyshortcuts`；仅在已选时由原 `isSelected` 事实提供本地化辅助说明并保留原路径身份。保持现按钮角色、打开行为、选区 Map、范围算法、原页面结构、源文件与公共接口，不加监听器、合成事件或状态。确认两行提示在桌面侧栏可读。

39097 真实 `/ui` 验收普通列表英文两种快捷键、焦点与菜单计数，中文搜索按键和已选辅助描述（保留原路径），以 Shift+F10 打开批量复制并通过实际按键完成；真实目录和原文件下载核对选定目标、来源物理字节、Git 原件与数据库零执行。逐张截图人工复核，发现布局问题先落补充方案再改并重截图。类型、双语、构建、聚焦文件检查、文档和架构；不运行界面自动化。范围提交、普通合并上游、待推核查与正常推送。

## 候选实页后的修订（修改前）

39097 加载 `main-C2QLhyV-.js`，英文真实页脚两行可读，Ctrl+Space 与普通 Down 保持原行为（07–08）。但已选 `row-beta.txt` 实际按钮虽已有 `aria-description="row-beta.txt · Selected for file actions"` 和快捷键属性，当前桌面可访问树读出的名称和说明仍未显示这个已选事实。只看属性存在不能当作可访问验收；不推断所有辅助技术都忽略该属性。为当前桌面提供可核实的名称：仅在选择时用当前语言为按钮名追加选择语义，并包含原完整路径；未选继续使用原渲染名称，`title` 仍提供原路径，不借 `aria-pressed` 或 `aria-current` 错报主要动作/当前文件。替换候选属性，不保留第二种状态提示路径。原页脚与按键行为不变。候选没有复制写入，服务退出 0；新建隔离 39098，必须实看名称、路径和完整键盘复制再交付。

## 交付复核

39098 的真实 `/ui` 提供 `main-wZKc4S2U.js`。英文文件树可见两行提示，Ctrl+Space 后当前可访问树显示 `row-alpha.txt · Selected for file actions`（09）；Down 与 Ctrl+Space 添加 beta，Shift+F10 显示复制两项（10）。分步 Escape、Down、Shift+Space 后，实际选中名称是 beta 与 gamma（11）。切中文并搜索 `row`，提示和已选名中文化，仍为原两项（12）；从搜索输入 Down 到 beta 后 Ctrl+Space 去选，原焦点及文件名保持（13）；Down 到 alpha、Shift+Space 后可访问树明确只选 beta 与 alpha（14）。

Shift+F10 打开菜单、Enter 进入两项复制、键盘填 `dest` 并 Enter（15）。公开写入 `5dd593ca-360e-4cee-be08-3e962fef69a7`、`68f0d83f-8a09-4660-922d-745037d47703` 均 200（93、71 毫秒）。完成后搜索仍是 `row`；两个目标的可访问名称含 `dest` 原路径及中文已选状态，焦点在最后完成的 alpha（16）；原生 Enter 打开目标编辑器，实际原文正确（17）。最终目标 `/file` 请求 `9e48712c-c706-4f13-9bd9-7086d806f0c0` 按 `/doc` 校验精确为 `anchor.txt`、`row-alpha.txt`、`row-beta.txt`；六份公开下载与磁盘及明确的原字节一致，含 CRLF、LF 和中文。

三个隔离项目的跟踪原件与 Git HEAD 保持，服务均退出 0；基线与候选没有复制，最终只有上述两次真实写入；数据库任务、会话、消息、自动化运行和服务商用量/活动为 0。逐张人工复核 17 张保存截图。类型、双语（2,974 键）、最终构建（50.60 秒）、两项文件服务/刷新聚焦检查、文档、架构与差异检查通过。未运行界面自动化或模型，键位和可访问验收范围仅为当前 Chromium 桌面中英文。[截图、公开接口及磁盘核对](../../artifacts/2026-11-09-file-selection-keyboard-discovery/README.md)。
