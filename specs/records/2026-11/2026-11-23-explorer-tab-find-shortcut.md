# 在资源管理器标签上使用文件查找

## Recall

用户要求本人独立持续按批迭代，先调查实际界面和代码、记录根因及影响，再实施和真实桌面交互、本人截图复核、聚焦正向验证、范围提交、合并最新上游和普通推送。第 456 批 `36f5ec415` 已与远端核对为 0/0，保留原有 177 条状态。使用新的无凭据隔离开发服务和自有项目，操作只涉及文件搜索和读取。

已读 [面板架构](../../current/architecture/07-panel.md)、[文件搜索回焦](2026-11-23-explorer-result-return-to-search.md)、[资源管理器查找范围](2026-11-19-explorer-find-shortcut-scope.md)、[项目文件入口](2026-11-23-project-files-opener-focus.md)、[文件工作台正文查找](2026-11-01-file-workbench-find.md)、`RightDock` 标签和关闭焦点、`FileExplorerPanel` 查询和真实控件、工作台 `main` 的选中面板和明确浏览入口、共享标签和全局按键设施。全仓核对 `handleExplorerFind`、`handleTabKeyDown`、`openProjectFiles`、`restoreRightDockFocus`、`centerWorkbenchExplorer`、`file-explorer-search-input`、`cancelFileExplorerFolderReveal`、文件正文和对话查找。Explorer 和 Dock 各只在当前工作台挂载一次。相关路径未发现用户界面自动化测试。

## 基线和根因

标准开发 `40786/ui/` 加载 `main-BCgCXPXE.js`。英文 100% 从同名搜索结果中用键盘打开北仓 `November checklist.md`。按真实文件关闭按钮，文件关闭，焦点按当前 Dock 合同回到选中的 Explorer 标签。搜索词与两条结果可见。从标签按 Ctrl+F，焦点仍停在标签，文件搜索未选中文本。从实际结果行按同一键，焦点进入原输入且选中 `November checklist.md`。正式查询确认为南、北仓两个身份，四份本地正文和五个下载原件核对通过。 [本人复核的实图](../../artifacts/2026-11-23-explorer-tab-find-shortcut/README.md)

当前文件查找键的唯一 Explorer 处理挂在内容区 section 并检查事件来源。关闭文件后的标签是内容区的同级控制，按键无法进入这个监听。Dock 标签自身只补充 Delete（关闭标签）操作。上批 Escape 是结果行到搜索框，已有 Browse files 用明确导航后聚焦；都未覆盖位于选中标签时的查找快捷键。关闭后聚焦标签符合现有设计，无需修改关闭、标签选择或文件离开合同。无会话首页已实证，当前没有从活跃对话或隐藏 Dock 的同键误路由证据。影响范围是 Dock 内可见选中 Explorer 及其真实内容的 Ctrl+F／Command+F，邻接菜单生命周期、文件正文查找、对话查找以及隐藏工作区保持各自的现有路径。无调度、唤醒、恢复、并发或执行终态异常。

## 实施和验收方案

由包含真实标签及活动内容的 Dock 局部事件边界接收同一个 Explorer 查找动作。工作台利用已选 Explorer、可见 Dock、真实事件来路与当前输入的可用性判定，成功时按原行为聚焦和选中现查询。明确的 Browse files 也复用聚焦动作，保留自己原来的导航和归属判断。从标签明确查找后沿现有入口退休先前的文件夹揭示意图；内容区原捕获和导航复核仍适用。只在活动 Explorer 标签向辅助设备声明该键，保留 Delete 和标签切换。沿用现有查询、结果、目录、文件身份以及键盘输入方式。

候选在英文 100% 和简体中文 160% 实际检查关闭文件得到 Explorer 标签、Ctrl+F 进入搜索并选择原词、改查另一项后方向键及 Enter 打开确切文件。对照内容区 Ctrl+F、文件正文 Ctrl+F、其他已聚焦标签、Escape 和空搜索后目录。继续检查真实查询和原文件、库和进程退出，运行聚焦文件身份检查、类型、语言、样式、构建和文档检查，截图逐张复核后提交并正常推送。

## 实施和验证结果

候选英文 100% 从北仓 `November checklist.md` 的文件关闭按钮启动关闭，原焦点落点仍为 Explorer 标签。Ctrl+F 进入文件搜索并选中当前 `November checklist.md`，贴入新查询即可直接替换，方向键和 Enter 打开 `delivery/north warehouse/receiving/Freight receipt and exceptions.md`。向左移动标签焦点而维持 File 激活时，按 Ctrl+F 后已读文件继续显示。从文件正文按 Ctrl+F 进入已有编辑器搜索并使用 `missing seal numbers`。简体中文 160% 从活动标签选择原查询，换词后打开 `records/验收/交接清单.md`，复核正文「检查文件和现场记录。」关闭该文件，活动标签 Ctrl+F 选中中文词。搜索输入 Escape 恢复项目树，从普通 `archive` 目录行按 Ctrl+F 仍聚焦同一搜索框。 [11 张交互后逐张复核的真实桌面原图](../../artifacts/2026-11-23-explorer-tab-find-shortcut/README.md)

基线和候选正式查询分别按三个词得到 2、1、1 个精确路径，四份正文和五个原件下载匹配各自文件，原件字节与 Git 提交相同。两个 SQLite（嵌入式数据库）通过 `quick_check`，会话、消息、计划、引擎和模型活动表为空。两个已验证所属的服务关闭响应 200，进程退出 0，40786 和 40788 均释放。核心 `bun run test test/server/file-read-identity.test.ts` 通过 7 项、52 断言。类型、双语、样式、正常构建和渲染器公共接口、文档和架构检查通过。真实桌面操作在 Windows 执行 Ctrl+F，Command+F 与其走同一按键判断，未单独进行另一平台验收。
