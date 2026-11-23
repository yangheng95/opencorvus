# 从文件结果返回搜索输入框

## Recall

用户要求本人持续分批迭代，先并行调查实际用户界面、功能和缺陷，完成根因、范围和规格，再实现、本人真实桌面操作和复核截图、聚焦验证、范围提交、合并最新上游并正常推送。第 455 批 `1e42f7200` 已确认远端与本地 0/0，原有 177 条状态逐行保留。本批使用无凭据开发服务及自有项目，实际测试只读。被操作的两个同名文件是隔离夹具。

已读 [面板架构](../../current/architecture/07-panel.md)、[文件搜索键盘入口](2026-11-09-explorer-search-keyboard-entry.md)、[资源管理器查找快捷键](2026-11-19-explorer-find-shortcut-scope.md)、[项目入口聚焦](2026-11-23-project-files-opener-focus.md)、[当前查询读状态](2026-11-10-explorer-returning-query-read-status.md)、`FileExplorerPanel` 的行、查询、虚拟焦点、快捷键和菜单及共享 `SearchField`。全仓核对 `handleRowKeyDown`、`handleExplorerFind`、`focusRow`、`explorer.search_keyboard_hint`、`aria-keyshortcuts`、工具入口及 `find.files`、`file.read`。现有项目搜索、文件正文、普通树行和上下文菜单各自有既有入口，相关路径未发现用户界面自动化测试。快捷键按现有属性向辅助技术暴露。 [WAI-ARIA 1.2 快捷键属性](https://www.w3.org/TR/wai-aria-1.2/#aria-keyshortcuts)

## 基线和影响

实际 `40780/ui/` 加载 `main-CF6whGgk.js`。英文 100% 从项目首页选 Browse files，真实搜索 `November checklist.md` 后得到南仓旧档案和北仓交付两条同名结果。Down 到第一条，Escape 后焦点仍在原结果，框内搜索词和两条结果可见。此时继续输入无法直接修改搜索词，可以用现有 Ctrl+F 回到输入框并选中文字。实际 Shift+F10 打开结果菜单，该菜单内 Escape 返回行；从输入框 Escape 仍清空并恢复项目树。正式搜索返回同样两文件，两个 `/file/content` 分别为 70 和 63 字符并与实际文件正文相同。 [真实桌面截图](../../artifacts/2026-11-23-explorer-result-return-to-search/README.md)

输入框和结果行分别处理各自的键。输入框方向键通过现有焦点所有者进入当前已接收搜索结果。原结果行只读方向键、Home、End；Escape 落到默认分支。共享 SearchField 的清空功能只在输入框自己接收 Escape 时触发。先前的查找快捷键是使用相同输入框并选全文，保留整个 Explorer 可用，在此之上增加同一键盘浏览过程的逆向动作。影响限搜索结果按钮、现有输入、当前区域本地化提示和快捷键声明。搜索归属与请求、目录行、文件选择与打开、菜单关闭、文件内容、服务、数据库、授权和交付保持各自现有路径。观察的是本地键盘交接缺口，没有调度、队列、唤醒、并发、恢复或执行轮次异常。

## 实施和验收方案

未被消费且由实际搜索结果按钮收到的 Escape 使用当前可聚焦搜索输入，无滚动聚焦以承接相同查询，使用既有行按键消费语义。行的 Escape 不等于清空。焦点已经在搜索输入后，独立再按 Escape 时仍按原搜索控件清空。上下文菜单内 Escape 应先按菜单生命周期关闭，焦点回到原行后可以再次返回搜索；目录树行保持原按键。搜索结果与既有两语言提示标明动作，普通目录提示不加该键。使用真实界面检查两个语言、同名结果、菜单取消、搜索改词唯一命中并用 Enter 打开正式文件、明确第二次 Escape 清空、Ctrl+F 和文件预览能继续正常操作。检查正式文件读取、原字节和隔离库，运行现有文件身份正向检查、类型、语言、样式、构建和文档检查，再正常提交推送。

## 实施和验证结果

实际候选 `40782/ui/` 英文 100% 搜出两个 `November checklist.md`。Down 到南仓结果后 Escape 聚焦原输入，查询和两条结果仍可见。Up 到北仓结果，通过 Shift+F10 进实际菜单，第一次 Escape 关闭菜单并获选中行焦点，第二次回原查询；选择状态仍可见。从输入直接改查 `Freight receipt and exceptions.md`，Down 和 Enter 打开实际北仓交付文件，正文为 `Flag missing seal numbers before unloading.`。文件 Ctrl+F 进入源码查找，查询出现在文件自身控件。简体中文 160% 查看 `交接清单` 的本地化返回提示和搜索框焦点，从输入再按 Escape 清空恢复项目树。普通 `archive` 行用 Escape 仍聚焦原行，Ctrl+F 后重新找到并打开 `records/验收/交接清单.md`，预览显示「检查文件和现场记录。」 [14 张本人复核的真实桌面原图](../../artifacts/2026-11-23-explorer-result-return-to-search/README.md)

两个运行实例分别从正式接口按三个查询返回 2、1、1 个原路径，四份正文与文件逐字匹配，五份原件下载与 Git 提交和磁盘字节相同。两份 SQLite（嵌入式数据库）通过 `quick_check`，会话、消息、计划和执行活动为零。已验证归属的服务关闭均为 200、进程退出 0，40780 与 40782 释放。核心 `bun run test test/server/file-read-identity.test.ts` 通过 7 项和 52 断言。类型、双语、样式、实际构建和渲染器公共接口、文档与架构目录检查通过。该浏览操作使用本地文件，无模型请求。
