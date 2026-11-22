# 在搜索命中的目录内新建并保存文件

## Recall

用户要求本人持续独立按批次工作，先调查、分析并落盘，再实施有证据的改进、真实桌面与人工截图、聚焦正向验收、提交上游同步及正常推送。第 380 批远端 `main` 为 `7d6c66930`，上下游 0/0，177 项既有工作区状态逐行保持。本批补验目录搜索后的真实新建和保存，使用本人新建的两个独立同名 `site-notes` 项目和单独的 `40442/ui/` 服务。允许测试样本新建与编辑保存，原始样本和南区只读，无需外部模型、凭据或发布。

已读 [搜索项目文件夹](2026-11-23-explorer-search-folder-entries.md)、[打开所在目录](2026-11-23-file-editor-containing-folder.md)、共享新建及目录刷新焦点合同、`FileExplorerPanel.createEntry`、`contextTargetDirectory`、`capturePathMutationFocus`、文件读取和保存逻辑及 `main.tsx` 的右栏作用域。全仓查搜索结果身份、目录按钮、新建目标、公开 `file.create`/`file.content`、工作台及路径测试。旧策略已经能定位到项目目录。本批目的是验证搜索条目激活真实写命令和刷新后焦点的接续，先保留实际可观察结果。

## 起始事实和范围

`40442/ui/` 实际提供 `main-BH6ntxSk.js`。北区搜索 `Empty Intake` 命中真实物理空目录。回车在目录树打开该行，显示 `Empty` 状态并聚焦该行，工具栏 `New` 确认当前目录。南区同名项目使用独立已登记目录和独立原文。 [空目录搜索与打开原图](../../artifacts/2026-11-23-explorer-search-folder-create-save/README.md)

工作台通过已存在的作用域和目录类型计算新建目标，文件写入接口确认为真后再刷新当前列表和原查询。目录新建按真实回执和当前查询将焦点给新行，文件新建在原工作台打开编辑器。若出现焦点、列表或持久内容差异，先明确实际触发、读写身份和旧路径原因，再依证据修复。影响面限文件和目录工作流，禁止修改原项目或向任何对话发送消息。无 Task（任务）、Mission（多步任务）、Session（会话）调度调查线索。

## 验收计划

在英文页面以搜索命中的北区空目录为父级，使用共享操作创建 `Intake Review`，检查正式父级、当前查询刷新、实际新目录和焦点。切简体中文，从真实新目录查询选中其行，使用工具栏新建 `复验 %23.md`。真实空文件应打开到可编辑源码，输入一行已知测试内容并通过页面保存。切回资源管理器使用完整文件位置搜索并打开实际保存内容。直接核对真实公开目录与读取响应、磁盘字节、原北区和南区的已知样本、南区范围内的项目视图及服务正常关闭。生产代码改动以实际证据为准；没有证据支持修改时保留验收记录，相关聚焦正向与文档检查照常执行。

## 实际结果

英文搜索行的右键菜单打开新建目录对话框，提示 `Create in records/Empty Intake`。回车创建后保留 `Empty Intake` 查询，返回原空目录与新子目录。成功回执与查询行一致，当前选择和键盘焦点落在 `records/Empty Intake/Intake Review`，同一目录成为工具栏新建目标。无须改变目录刷新或焦点归属。 [真实桌面原图](../../artifacts/2026-11-23-explorer-search-folder-create-save/README.md)

切简体中文后搜索 `Intake Review`，新建菜单与文件对话框都给出同一个父目录。`复验 %23.md` 创建后以空白源码打开并聚焦编辑区。输入 `北区验收记录 %23` 后显示未保存状态，`Ctrl+S` 成功后保持编辑区焦点并显示 `没有未保存的更改`。关闭编辑器后以完整 Windows 路径查询，得到精确文件行。按下方向键进入结果再按回车，重新打开的 Markdown 预览显示原句。单独在输入框按回车保持输入框焦点，符合[既有键盘约定](2026-11-09-explorer-search-keyboard-entry.md)。

通过正式接口独立读取北区父目录和新目录，分别列出唯一预期子目录和文件。以原生完整路径调用 `GET /find/file`，得到唯一真实文件，`GET /file/content` 返回文本和保存后的修订，磁盘为 22 个精确 UTF-8（Unicode 转换格式）字节。南区同名目录在正式接口和真实页面均为空；使用同一项目相对文件路径读取返回 `404 FileNotFoundError`。两区原始 `records/Intake Notes/reference.txt` 的接口内容和磁盘字节逐项匹配，南区编辑器显示 `Workspace: south`。服务首次访问为两区生成标准 `.gitattributes`、`.gitignore` 和 `.opencorvus/opencorvus.jsonc`，测试中新增的业务文件只在北区测试仓库。

本批的界面、正式接口、磁盘内容和现有快捷键约定一致，交付实测记录。范围限两个隔离项目、当前 Windows 桌面、一次真实目录创建及一次 UTF-8 文件创建和保存。未覆盖并发写冲突、项目配置差异或其他操作系统的同类交互。隔离数据库 `quick_check` 为 `ok`，会话、消息、执行任务、任务计划、计划运行、Provider（模型服务提供方）用量及权限日志均为零。服务进程通过正式端点正常关闭，关闭响应为 HTTP（超文本传输协议）200，启动进程退出码为 0，端口已释放。

## 检查

- 核心 `bun run test test/server/file-read-identity.test.ts test/server/file-write-identity.test.ts test/server/file-error-contracts.test.ts` 通过 33 项，317 个断言。
- 覆盖层 `bun test test/file-workbench-refresh.test.ts test/file-workbench-revision.test.ts test/file-workbench-mutation.test.ts` 通过 67 项，206 个断言。这些测试核对服务回执和资源身份。本人另逐张复核了 12 张真实桌面图。
- `bun run docs:check` 核对 26 组的 353 项操作，`bun run check:architecture-index` 核对 20 项架构文档和链接。
